// A native reader for a PDF's pages (prototype, phase 1 of the native page view; dev only, behind `ink_reader`).
//
// Two ways of showing a book's pages, side by side for measuring, each in a view laid over the web view where the
// page says (the pane's page area), with its own zoom and scroll:
//   A: PDFKit's `PDFView` (continuous, one column), a `PKCanvasView` over each page by `PDFPageOverlayViewProvider`
//      (iOS 16) for the ink.
//   B: a `UIScrollView` zooming a column of page views, each a `CATiledLayer` drawing its page with Core Graphics
//      (levels of detail to the zoom, no fade), a picture of the page at the fitted size under it, made ahead, and a
//      `PKCanvasView` over it for the ink, drawn again at the zoom's scale when the zoom ends.
// Each frame (a display link) is written down: when it came, the zoom, and for B whether any part of a page in view
// shows fewer pixels than it will once drawn (its tiles' levels against the level the zoom asks for). For both, a
// small piece of the middle of the view can be taken every few frames and its edges measured (how many of its steps
// are steep), to say how sharp it looks against how sharp it ends.

import PDFKit
import PencilKit
import Tauri
import UIKit
import WebKit

// MARK: - the reader's word with the page

struct ReaderArgs: Decodable {
  let op: String
  let path: String?
  let kind: String?
  let x: Double?
  let y: Double?
  let w: Double?
  let h: Double?
  let page: Int?
  let zoom: Double?
  let animated: Bool?
  let dy: Double?
  let ms: Double?
  let snap: Int?
  let tool: String?
}

extension InkPlugin {
  /// The prototype native reader: `open` (`path`, `kind` A or B, the area `x y w h` in the web view's points),
  /// `close`, `zoom` (to `zoom` times the fitted size, `animated`), `go` (`page`), `scroll` (`dy` points over `ms`),
  /// `mark` (begin measuring; `snap` every so many frames, 0 for none), `stats` (what was measured since), `tool`
  /// (`pen`, `eraser`, `lasso`; a finger writes from then on), `ink` (strokes on each page), `where` (a page's point on the glass).
  @objc public func reader(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(ReaderArgs.self)
    DispatchQueue.main.async {
      guard let web = self.webView, let over = web.superview else { invoke.reject("no web view yet"); return }
      switch args.op {
      case "open":
        ProtoReader.shared?.close()
        guard let path = args.path, let doc = CGPDFDocument(URL(fileURLWithPath: path) as CFURL) else { invoke.reject("not a pdf"); return }
        let frame = CGRect(x: args.x ?? 0, y: args.y ?? 0, width: args.w ?? web.bounds.width, height: args.h ?? web.bounds.height)
        let r = ProtoReader(kind: args.kind == "A" ? .pdfkit : .tiled, path: path, doc: doc, frame: web.convert(frame, to: over))
        over.addSubview(r.view)
        ProtoReader.shared = r
        r.start()
        invoke.resolve(["pages": doc.numberOfPages, "kind": args.kind ?? "B"])
      case "close":
        ProtoReader.shared?.close()
        ProtoReader.shared = nil
        invoke.resolve(["closed": true])
      default:
        guard let r = ProtoReader.shared else { invoke.reject("no reader open"); return }
        invoke.resolve(r.handle(args))
      }
    }
  }
}

// MARK: - the reader

final class ProtoReader: NSObject {
  enum Kind { case pdfkit, tiled }
  static var shared: ProtoReader?

  let kind: Kind
  let view: UIView
  let doc: CGPDFDocument
  let path: String
  /// B's column, A's view.
  private var tiled: TiledColumn?
  private var pdfView: PDFView?
  private var overlay: AnyObject?
  private var link: CADisplayLink?
  private var frames: [[String: Any]] = []
  private var marking = false
  private var markAt: CFTimeInterval = 0
  private var snapEvery = 0
  private var frameNo = 0
  private var tool: PKTool = PKInkingTool(.pen, color: .red, width: 4)

  init(kind: Kind, path: String, doc: CGPDFDocument, frame: CGRect) {
    self.kind = kind
    self.doc = doc
    self.path = path
    view = UIView(frame: frame)
    view.backgroundColor = UIColor(white: 0.9, alpha: 1)
    view.clipsToBounds = true
    super.init()
  }

  func start() {
    switch kind {
    case .tiled:
      let c = TiledColumn(frame: view.bounds, doc: doc)
      c.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      view.addSubview(c)
      tiled = c
      c.layoutPages()
    case .pdfkit:
      let p = PDFView(frame: view.bounds)
      p.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      p.displayMode = .singlePageContinuous
      p.displayDirection = .vertical
      p.backgroundColor = UIColor(white: 0.9, alpha: 1)
      if #available(iOS 16.0, *) {
        let o = Overlays(tool: tool)
        overlay = o
        p.pageOverlayViewProvider = o
        p.isInMarkupMode = true
      }
      p.document = PDFDocument(url: URL(fileURLWithPath: path))
      p.autoScales = true
      view.addSubview(p)
      pdfView = p
      // (fitted, then free to go to half that and four times it)
      DispatchQueue.main.async {
        let fit = p.scaleFactorForSizeToFit
        p.minScaleFactor = fit * 0.5
        p.maxScaleFactor = fit * 4
        p.scaleFactor = fit
        p.autoScales = false
      }
    }
    let l = CADisplayLink(target: self, selector: #selector(tick(_:)))
    l.add(to: .main, forMode: .common)
    link = l
  }

  func close() {
    link?.invalidate()
    link = nil
    // (the canvases first, each on its own: a PencilKit canvas let go with the views it lies in, in one go, went on
    // to ask after a view already gone, and the app fell)
    CanvasKeep.letGoAll(in: view)
    view.removeFromSuperview()
  }

  /// The zoom, 1 at fitted.
  var zoom: Double {
    if let t = tiled { return Double(t.zoomScale) }
    if let p = pdfView { return Double(p.scaleFactor / max(0.0001, p.scaleFactorForSizeToFit)) }
    return 1
  }

  var scroller: UIScrollView? {
    if let t = tiled { return t }
    return pdfView?.subviews.compactMap { $0 as? UIScrollView }.first
  }

  @objc private func tick(_ l: CADisplayLink) {
    guard marking else { return }
    frameNo += 1
    var f: [String: Any] = ["t": (l.timestamp - markAt) * 1000, "dur": l.duration * 1000, "z": zoom]
    if let s = scroller { f["oy"] = Double(s.contentOffset.y); f["moving"] = s.isZooming || s.isDragging || s.isDecelerating || s.isZoomBouncing }
    if let t = tiled { f["coarse"] = t.coarseFraction(in: view) }
    if snapEvery > 0 && frameNo % snapEvery == 0 { f["edge"] = edges() }
    frames.append(f)
    if frames.count > 20000 { frames.removeFirst(5000) }
  }

  /// How sharp the middle of the view looks: of the steps between neighbouring pixels steeper than a little, the
  /// share that are steep (an edge drawn a pixel wide is one steep step; a blurred one, several gentle ones).
  private func edges() -> Double {
    let side: CGFloat = 160
    let r = CGRect(x: view.bounds.midX - side / 2, y: view.bounds.midY - side / 2, width: side, height: side)
    let scale = view.window?.screen.scale ?? 2
    let fmt = UIGraphicsImageRendererFormat()
    fmt.scale = scale
    fmt.opaque = true
    let img = UIGraphicsImageRenderer(size: r.size, format: fmt).image { _ in
      view.drawHierarchy(in: CGRect(x: -r.minX, y: -r.minY, width: view.bounds.width, height: view.bounds.height), afterScreenUpdates: false)
    }
    guard let cg = img.cgImage, let data = cg.dataProvider?.data, let p = CFDataGetBytePtr(data) else { return -1 }
    let w = cg.width, h = cg.height, row = cg.bytesPerRow, bpp = cg.bitsPerPixel / 8
    func grey(_ x: Int, _ y: Int) -> Int { let q = p + y * row + x * bpp; return (Int(q[0]) + Int(q[1]) + Int(q[2])) / 3 }
    var some = 0, steep = 0
    for y in stride(from: 0, to: h - 1, by: 1) {
      for x in stride(from: 0, to: w - 1, by: 1) {
        let g = grey(x, y)
        for d in [abs(grey(x + 1, y) - g), abs(grey(x, y + 1) - g)] where d > 24 {
          some += 1
          if d > 140 { steep += 1 }
        }
      }
    }
    return some > 0 ? Double(steep) / Double(some) : -1
  }

  func handle(_ a: ReaderArgs) -> [String: Any] {
    switch a.op {
    case "zoom":
      let z = CGFloat(a.zoom ?? 1)
      let animated = a.animated ?? true
      if let t = tiled {
        // about the middle of the view, as the bar's steps are
        let c = CGPoint(x: t.contentOffset.x + t.bounds.width / 2, y: t.contentOffset.y + t.bounds.height / 2)
        let inContent = CGPoint(x: c.x / t.zoomScale, y: c.y / t.zoomScale)
        let w = t.bounds.width / z, h = t.bounds.height / z
        t.zoom(to: CGRect(x: inContent.x - w / 2, y: inContent.y - h / 2, width: w, height: h), animated: animated)
      } else if let p = pdfView {
        let want = p.scaleFactorForSizeToFit * z
        if animated, let s = scroller, p.scaleFactor > 0 { s.setZoomScale(s.zoomScale * want / p.scaleFactor, animated: true) } else { p.scaleFactor = want }
      }
      return ["zoom": zoom]
    case "go":
      let n = max(1, min(doc.numberOfPages, a.page ?? 1))
      if let t = tiled { t.go(to: n) }
      else if let p = pdfView, let page = p.document?.page(at: n - 1) { p.go(to: page) }
      return ["page": n]
    case "scroll":
      guard let s = scroller else { return [:] }
      let to = CGPoint(x: s.contentOffset.x, y: min(max(0, s.contentOffset.y + CGFloat(a.dy ?? 0)), max(0, s.contentSize.height - s.bounds.height)))
      let ms = a.ms ?? 0
      if ms <= 0 { s.setContentOffset(to, animated: false) } else { UIView.animate(withDuration: ms / 1000, delay: 0, options: [.curveEaseOut]) { s.contentOffset = to } }
      return ["oy": Double(to.y)]
    case "mark":
      frames = []
      frameNo = 0
      snapEvery = a.snap ?? 0
      markAt = CACurrentMediaTime()
      marking = true
      return ["marked": true]
    case "stats":
      marking = false
      let out = frames
      frames = []
      var info: [String: Any] = ["frames": out, "zoom": zoom, "kind": kind == .tiled ? "B" : "A"]
      if let t = tiled { info["tiles"] = t.drawn; info["tileMs"] = t.drawMs; info["thumbs"] = t.thumbsMade }
      if let s = scroller { info["contentH"] = Double(s.contentSize.height); info["oy"] = Double(s.contentOffset.y) }
      return info
    case "tool":
      switch a.tool {
      case "eraser": tool = PKEraserTool(.vector)
      case "lasso": tool = PKLassoTool()
      default: tool = PKInkingTool(.pen, color: .red, width: 4)
      }
      tiled?.setTool(tool)
      if #available(iOS 16.0, *), let o = overlay as? Overlays { o.setTool(tool) }
      for (_, c) in canvases() { c.drawingPolicy = .anyInput }
      tiled?.fingerWrites = true
      return ["tool": a.tool ?? "pen"]
    case "ink":
      var pages: [[String: Any]] = []
      for (n, c) in canvases() {
        let b = c.drawing.bounds
        pages.append(["page": n, "strokes": c.drawing.strokes.count, "bounds": b.isNull ? [] : [Double(b.minX), Double(b.minY), Double(b.width), Double(b.height)]])
      }
      return ["pages": pages]
    case "where":
      // where on the web view's glass a point of a page lies (fractions of it): for a touch put there
      let n = max(1, min(doc.numberOfPages, a.page ?? 1))
      var pt: CGPoint? = nil
      if let t = tiled, let v = t.pageView(n) { pt = v.convert(CGPoint(x: v.bounds.width * CGFloat(a.x ?? 0.5), y: v.bounds.height * CGFloat(a.y ?? 0.5)), to: view.superview) }
      else if let p = pdfView, let page = p.document?.page(at: n - 1) {
        let b = page.bounds(for: p.displayBox)
        let inView = p.convert(CGPoint(x: b.minX + b.width * CGFloat(a.x ?? 0.5), y: b.maxY - b.height * CGFloat(a.y ?? 0.5)), from: page)
        pt = p.convert(inView, to: view.superview)
      }
      return pt.map { ["x": Double($0.x), "y": Double($0.y)] } ?? [:]
    default:
      return ["unknown": a.op]
    }
  }

  private func canvases() -> [(Int, PKCanvasView)] {
    if let t = tiled { return t.canvases() }
    if #available(iOS 16.0, *), let o = overlay as? Overlays { return o.canvases() }
    return []
  }
}

// MARK: - B: a scroll view of tiled pages

/// A page drawn by Core Graphics in tiles, at the level of detail the zoom asks for, with no fade.
final class TiledPage: UIView {
  override class var layerClass: AnyClass { FastTiledLayer.self }
  let page: CGPDFPage
  let number: Int
  /// The page's picture at the fitted size, under the tiles: what shows before a tile is drawn.
  let under = UIImageView()
  var canvas: PKCanvasView?
  weak var column: TiledColumn?
  /// The tiles drawn, by level (the context's scale, in pixels to a fitted point): their rects in the page's points.
  private let lock = NSLock()
  private var levels: [CGFloat: [CGRect]] = [:]

  init(page: CGPDFPage, number: Int, frame: CGRect) {
    self.page = page
    self.number = number
    super.init(frame: frame)
    backgroundColor = .white
    under.frame = bounds
    under.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    addSubview(under)
    let t = layer as! CATiledLayer
    t.tileSize = CGSize(width: 512, height: 512)
    // one level a doubling, from a quarter of the fitted size to sixteen times it
    t.levelsOfDetail = 7
    t.levelsOfDetailBias = 4
  }
  required init?(coder: NSCoder) { fatalError() }

  override func draw(_ layer: CALayer, in ctx: CGContext) {
    let box = ctx.boundingBoxOfClipPath
    let scale = ctx.ctm.a
    let t0 = CACurrentMediaTime()
    ctx.setFillColor(UIColor.white.cgColor)
    ctx.fill(box)
    let crop = page.getBoxRect(.cropBox)
    ctx.saveGState()
    ctx.translateBy(x: 0, y: bounds.height)
    ctx.scaleBy(x: bounds.width / crop.width, y: -bounds.height / crop.height)
    ctx.concatenate(page.getDrawingTransform(.cropBox, rect: CGRect(origin: .zero, size: crop.size), rotate: 0, preserveAspectRatio: true))
    ctx.drawPDFPage(page)
    ctx.restoreGState()
    let ms = (CACurrentMediaTime() - t0) * 1000
    lock.lock()
    levels[scale, default: []].append(box)
    lock.unlock()
    column?.drew(ms)
  }

  /// The finest level drawn over a point of the page (its points), 0 where none is.
  func finest(at p: CGPoint) -> CGFloat {
    lock.lock(); defer { lock.unlock() }
    var best: CGFloat = 0
    for (s, rects) in levels where s > best { if rects.contains(where: { $0.contains(p) }) { best = s } }
    return best
  }
  func forget(below s: CGFloat) {
    lock.lock(); defer { lock.unlock() }
    levels = levels.filter { $0.key >= s }
  }
}

/// No fade: a tile is on the glass the frame it is drawn.
final class FastTiledLayer: CATiledLayer {
  override class func fadeDuration() -> CFTimeInterval { 0 }
}

final class TiledColumn: UIScrollView, UIScrollViewDelegate {
  let doc: CGPDFDocument
  let content = UIView()
  private var pages: [TiledPage] = []
  private var tops: [CGFloat] = []
  private(set) var drawn = 0
  private(set) var drawMs: Double = 0
  private(set) var thumbsMade = 0
  private let stats = NSLock()
  private let thumbQueue = DispatchQueue(label: "ilmi.reader.thumbs", qos: .userInitiated, attributes: .concurrent)
  private var thumbAsked = Set<Int>()
  private var tool: PKTool = PKInkingTool(.pen, color: .red, width: 4)
  private let gap: CGFloat = 12
  var fingerWrites = false

  init(frame: CGRect, doc: CGPDFDocument) {
    self.doc = doc
    super.init(frame: frame)
    delegate = self
    backgroundColor = UIColor(white: 0.9, alpha: 1)
    minimumZoomScale = 0.5
    maximumZoomScale = 4
    bouncesZoom = true
    decelerationRate = .normal
    addSubview(content)
  }
  required init?(coder: NSCoder) { fatalError() }

  func layoutPages() {
    let w = bounds.width
    var y: CGFloat = 0
    for i in 1...doc.numberOfPages {
      guard let p = doc.page(at: i) else { continue }
      let b = p.getBoxRect(.cropBox)
      let h = (w * b.height / max(1, b.width)).rounded()
      let v = TiledPage(page: p, number: i, frame: CGRect(x: 0, y: y, width: w, height: h))
      v.column = self
      tops.append(y)
      pages.append(v)
      y += h + gap
    }
    content.frame = CGRect(x: 0, y: 0, width: w, height: y - gap)
    contentSize = content.frame.size
    keepNear()
  }

  func viewForZooming(in scrollView: UIScrollView) -> UIView? { content }

  func scrollViewDidZoom(_ s: UIScrollView) {
    // under fitted, the column in the middle of the view
    let dx = max(0, (bounds.width - contentSize.width) / 2)
    content.center = CGPoint(x: contentSize.width / 2 + dx, y: content.center.y)
    keepNear()
  }
  func scrollViewDidScroll(_ s: UIScrollView) { keepNear() }
  func scrollViewDidEndZooming(_ s: UIScrollView, with view: UIView?, atScale scale: CGFloat) {
    // the ink drawn again at the zoom's scale (a canvas zoomed with the pages is otherwise its pixels stretched)
    let px = scale * (window?.screen.scale ?? 2)
    for p in visiblePages() { p.canvas?.contentScaleFactor = px }
  }

  func drew(_ ms: Double) {
    stats.lock(); drawn += 1; drawMs += ms; stats.unlock()
  }

  /// The pages near the view are in the column, with their pictures and canvases; the rest are not.
  private func keepNear() {
    let z = zoomScale
    let lo = (contentOffset.y - bounds.height * 1.5) / z, hi = (contentOffset.y + bounds.height * 2.5) / z
    for (i, p) in pages.enumerated() {
      let near = p.frame.maxY >= lo && p.frame.minY <= hi
      if near && p.superview == nil {
        content.addSubview(p)
        thumb(i)
        let c = PKCanvasView(frame: p.bounds)
        c.backgroundColor = .clear
        c.isOpaque = false
        c.drawingPolicy = fingerWrites ? .anyInput : .pencilOnly
        c.tool = tool
        c.isScrollEnabled = false
        // (a canvas is a scroll view of its own: its pinch would take two fingers from the pages')
        c.minimumZoomScale = 1
        c.maximumZoomScale = 1
        c.pinchGestureRecognizer?.isEnabled = false
        c.contentScaleFactor = z * (window?.screen.scale ?? 2)
        c.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        p.addSubview(c)
        p.canvas = c
      } else if !near && p.superview != nil && (p.canvas?.drawing.strokes.isEmpty ?? true) {
        if let c = p.canvas { CanvasKeep.letGo(c) }
        p.canvas = nil
        p.removeFromSuperview()
        p.under.image = nil
        thumbAsked.remove(i)
      }
    }
  }

  /// A page's picture at the fitted size, made off the main thread once.
  private func thumb(_ i: Int) {
    guard !thumbAsked.contains(i) else { return }
    thumbAsked.insert(i)
    let v = pages[i]
    let size = v.bounds.size
    let scale = window?.screen.scale ?? 2
    let page = v.page
    thumbQueue.async { [weak self] in
      let fmt = UIGraphicsImageRendererFormat()
      fmt.scale = scale
      fmt.opaque = true
      let img = UIGraphicsImageRenderer(size: size, format: fmt).image { c in
        let ctx = c.cgContext
        ctx.setFillColor(UIColor.white.cgColor)
        ctx.fill(CGRect(origin: .zero, size: size))
        let crop = page.getBoxRect(.cropBox)
        ctx.translateBy(x: 0, y: size.height)
        ctx.scaleBy(x: size.width / crop.width, y: -size.height / crop.height)
        ctx.concatenate(page.getDrawingTransform(.cropBox, rect: CGRect(origin: .zero, size: crop.size), rotate: 0, preserveAspectRatio: true))
        ctx.drawPDFPage(page)
      }
      DispatchQueue.main.async { v.under.image = img; self?.thumbsMade += 1 }
    }
  }

  func visiblePages() -> [TiledPage] {
    let r = CGRect(x: contentOffset.x / zoomScale, y: contentOffset.y / zoomScale, width: bounds.width / zoomScale, height: bounds.height / zoomScale)
    return pages.filter { $0.superview != nil && $0.frame.intersects(r) }
  }
  func pageView(_ n: Int) -> TiledPage? { n >= 1 && n <= pages.count ? pages[n - 1] : nil }

  func go(to n: Int) {
    guard n >= 1 && n <= tops.count else { return }
    setContentOffset(CGPoint(x: contentOffset.x, y: min(tops[n - 1] * zoomScale, max(0, contentSize.height - bounds.height))), animated: false)
    keepNear()
  }

  func setTool(_ t: PKTool) {
    tool = t
    for p in pages { p.canvas?.tool = t }
  }
  func canvases() -> [(Int, PKCanvasView)] { pages.compactMap { p in p.canvas.map { (p.number, $0) } } }

  /// Of the points sampled over the pages in view, the share showing fewer pixels than the zoom will have drawn
  /// there: the finest tile level drawn under each against the level the layer settles at (the least doubling at or
  /// over the screen's pixels to a fitted point at this zoom). A page with no tile there shows its fitted picture.
  func coarseFraction(in host: UIView) -> Double {
    let want = zoomScale * (window?.screen.scale ?? 2)
    // the level the layer draws at: a power of two at or over what is wanted (from a quarter, `levelsOfDetail` 7, bias 4)
    var settle: CGFloat = 0.25
    while settle < want - 0.001 && settle < 16 { settle *= 2 }
    let picture = window?.screen.scale ?? 2
    var all = 0, coarse = 0
    let view = CGRect(x: contentOffset.x / zoomScale, y: contentOffset.y / zoomScale, width: bounds.width / zoomScale, height: bounds.height / zoomScale)
    for p in visiblePages() {
      let r = p.frame.intersection(view)
      if r.isNull { continue }
      for i in 0..<6 { for j in 0..<8 {
        let pt = CGPoint(x: r.minX + r.width * (CGFloat(i) + 0.5) / 6 - p.frame.minX, y: r.minY + r.height * (CGFloat(j) + 0.5) / 8 - p.frame.minY)
        all += 1
        let have = max(p.finest(at: pt), p.under.image != nil ? picture : 0)
        if have < settle * 0.99 && have < want * 0.99 { coarse += 1 }
      } }
    }
    return all > 0 ? Double(coarse) / Double(all) : 0
  }
}

// MARK: - A: PDFKit's own view, a canvas over each page

@available(iOS 16.0, *)
final class Overlays: NSObject, PDFPageOverlayViewProvider {
  private var byPage: [ObjectIdentifier: (Int, PKCanvasView)] = [:]
  private var tool: PKTool
  init(tool: PKTool) { self.tool = tool }
  func pdfView(_ view: PDFView, overlayViewFor page: PDFPage) -> UIView? {
    let id = ObjectIdentifier(page)
    if let had = byPage[id] { return had.1 }
    let c = PKCanvasView()
    c.backgroundColor = .clear
    c.isOpaque = false
    c.drawingPolicy = .pencilOnly
    c.tool = tool
    c.minimumZoomScale = 1
    c.maximumZoomScale = 1
    c.pinchGestureRecognizer?.isEnabled = false
    byPage[id] = ((view.document?.index(for: page) ?? 0) + 1, c)
    return c
  }
  func setTool(_ t: PKTool) { tool = t; for (_, c) in byPage.values { c.tool = t } }
  func canvases() -> [(Int, PKCanvasView)] { byPage.values.map { ($0.0, $0.1) } }
}
