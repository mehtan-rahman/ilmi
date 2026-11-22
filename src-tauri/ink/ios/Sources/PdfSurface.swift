// A PDF's pages as a surface of the system's own (the native page view, phase 1).
//
// On an iPad, with the setting on, a book's pages are not the web view's: they are one `UIScrollView` laid over the
// web view where the page says (`ink_pdf`), the way a notebook's are (`Surface.swift`). The scroll, its coasting and
// the pinch are UIKit's; the scroll view zooms the column of pages itself and nothing is laid out again when it ends.
//
// What a page shows, bottom to top:
//   - its pictures, whole: half the fitted size for every page near the view, the fitted size for the pages in view and
//     about them (made once, kept on disk among the app's caches and in memory);
//   - its tiles, a layer a level: bands of the page drawn at 2^k times the fitted size, for what is in view and half a
//     view about it, nearest the middle first. As two fingers spread, the level the zoom has come to is asked for
//     at once (not only when they lift), and the next one up is drawn ahead for what is in view once the pages rest.
//     A finer level stays over a coarser one until the coarser one is wanted alone (the finer let go to memory).
// Everything is drawn by Core Graphics on a few threads at once (`PagePainter`), each with its own open document.
//
// Each frame (a display link) is weighed while measuring (`mark`): of points over the pages in view, how many levels
// coarser than the zoom asks for each shows; and every few frames how sharp the middle of the view looks.

import os
import PencilKit
import Tauri
import UIKit
import WebKit

// MARK: - what the page says

struct PdfHole: Decodable {
  let x: Double
  let y: Double
  let w: Double
  let h: Double
  let r: Double?
}

struct PdfPlace: Decodable {
  let page: Int
  let y: Double
  let x: Double?
}

struct PdfSurfaceArgs: Decodable {
  let id: String
  /// Where it lies on the page (the web view's points); none: it goes.
  let x: Double?
  let y: Double?
  let w: Double?
  let h: Double?
  /// The PDF's file.
  let path: String?
  let zoom: Double?
  let open: PdfPlace?
  let dark: Bool?
  /// The colour about the pages (`#rrggbb`).
  let desk: String?
  let holes: [PdfHole]?
  /// Room over the first page and between pages, points at the fitted size.
  let top: Double?
  /// The pages shown, from `first` to `last` (a chapter cut from its book); all where not said.
  let first: Int?
  let last: Int?
}

struct PdfSurfaceDoArgs: Decodable {
  let id: String
  let op: String
  let page: Int?
  let y: Double?
  let x: Double?
  let zoom: Double?
  let animated: Bool?
  let snap: Int?
  let dy: Double?
  let ms: Double?
  /// A search's question, and which hit on `page` is current.
  let q: String?
  let k: Int?
  /// (the checks) a selection's other end, fractions of `page`.
  let x2: Double?
  let y2: Double?
}

extension InkPlugin {
  /// A book's pages as a native surface: made, moved, told what it holds, or (no `x`) let go.
  @objc public func pdfSurface(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(PdfSurfaceArgs.self)
    DispatchQueue.main.async {
      guard let web = self.webView, let parent = web.superview else { invoke.reject("no web view yet"); return }
      guard let x = args.x, let y = args.y, let w = args.w, let h = args.h, let path = args.path else {
        PdfSurface.all[args.id]?.remove()
        PdfSurface.all[args.id] = nil
        invoke.resolve()
        return
      }
      let rect = web.scrollView.convert(CGRect(x: x, y: y, width: w, height: h), to: parent)
      let s: PdfSurface
      if let had = PdfSurface.all[args.id], had.path == path { s = had } else {
        PdfSurface.all[args.id]?.remove()
        guard let made = PdfSurface(id: args.id, path: path, plugin: self) else { invoke.reject("not a pdf"); return }
        PdfSurface.all[args.id] = made
        parent.addSubview(made.view)
        s = made
      }
      if s.view.superview !== parent { parent.addSubview(s.view) }
      s.take(args, at: rect)
      invoke.resolve(["pages": s.count])
    }
  }

  /// A book's surface asked something: `go`, `zoom`, `scroll` (dev), `mark` and `stats` (measuring), `state`.
  @objc public func pdfSurfaceDo(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(PdfSurfaceDoArgs.self)
    DispatchQueue.main.async {
      guard let s = PdfSurface.all[args.id] else { invoke.reject("no such surface"); return }
      invoke.resolve(s.handle(args))
    }
  }
}

// MARK: - the painter: a few threads drawing pages at once, nearest first

/// Draws pieces of a PDF's pages on as many threads as the device has cores, the asking with the least priority
/// first; an asking not yet begun can be let go (`keep`). Each thread keeps its own open document.
final class PagePainter {
  private static var byPath: [String: PagePainter] = [:]
  static func shared(_ path: String) -> PagePainter {
    if let p = byPath[path] { return p }
    let p = PagePainter(path: path)
    byPath[path] = p
    return p
  }

  struct Job {
    let key: String
    var priority: Double
    let draw: (CGPDFDocument) -> CGImage?
    var done: [(CGImage?) -> Void]
  }
  let path: String
  let workers: Int
  private let cond = NSCondition()
  private var queue: [String: Job] = [:]
  private var running = Set<String>()
  private(set) var drawn = 0
  private(set) var drawMs: Double = 0

  private init(path: String) {
    self.path = path
    workers = max(2, min(8, ProcessInfo.processInfo.activeProcessorCount))
    for i in 0..<workers {
      let t = Thread { [weak self] in self?.loop() }
      t.name = "ilmi.pdf.painter.\(i)"
      t.qualityOfService = .userInitiated
      t.start()
    }
  }

  /// Draws `key` (once, however often asked), then gives it to `done` on the main thread.
  func ask(_ key: String, priority: Double, draw: @escaping (CGPDFDocument) -> CGImage?, done: @escaping (CGImage?) -> Void) {
    cond.lock()
    if var j = queue[key] { j.priority = min(j.priority, priority); j.done.append(done); queue[key] = j }
    else if running.contains(key) { waiting[key, default: []].append(done) }
    else { queue[key] = Job(key: key, priority: priority, draw: draw, done: [done]) }
    cond.signal()
    cond.unlock()
  }
  private var waiting: [String: [(CGImage?) -> Void]] = [:]

  /// The askings not yet begun that `wanted` says no to are let go.
  func keep(_ wanted: (String) -> Bool) {
    cond.lock()
    queue = queue.filter { wanted($0.key) }
    cond.unlock()
  }
  var depth: Int { cond.lock(); defer { cond.unlock() }; return queue.count + running.count }
  func isAsked(_ key: String) -> Bool { cond.lock(); defer { cond.unlock() }; return queue[key] != nil || running.contains(key) }

  private func loop() {
    let doc = CGPDFDocument(URL(fileURLWithPath: path) as CFURL)
    while true {
      cond.lock()
      while queue.isEmpty { cond.wait() }
      let job = queue.values.min { $0.priority < $1.priority }!
      queue[job.key] = nil
      running.insert(job.key)
      cond.unlock()
      let t0 = CACurrentMediaTime()
      let img = doc.flatMap { job.draw($0) }
      let ms = (CACurrentMediaTime() - t0) * 1000
      cond.lock()
      running.remove(job.key)
      let more = waiting.removeValue(forKey: job.key) ?? []
      drawn += 1
      drawMs += ms
      cond.unlock()
      DispatchQueue.main.async { for d in job.done + more { d(img) } }
    }
  }

  /// Page `n` drawn `pxW` pixels across, the piece `rect` of it (pixels, its top left), on white, turned for the dark theme.
  static func draw(_ doc: CGPDFDocument, page n: Int, pxW: CGFloat, rect: CGRect, dark: Bool) -> CGImage? {
    guard let page = doc.page(at: n) else { return nil }
    let crop = page.getBoxRect(.cropBox)
    let rot = ((page.rotationAngle % 360) + 360) % 360
    let size = rot == 90 || rot == 270 ? CGSize(width: crop.height, height: crop.width) : crop.size
    guard size.width > 0, rect.width >= 1, rect.height >= 1 else { return nil }
    let k = pxW / size.width
    let pxH = (size.height * k).rounded()
    let w = Int(rect.width.rounded()), h = Int(rect.height.rounded())
    guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { return nil }
    ctx.setFillColor(gray: 1, alpha: 1)
    ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
    ctx.interpolationQuality = .high
    ctx.saveGState()
    // the piece's top left at the context's (Core Graphics counts from the foot)
    ctx.translateBy(x: -rect.minX, y: -(pxH - rect.minY - rect.height))
    ctx.scaleBy(x: pxW / size.width, y: pxH / size.height)
    ctx.concatenate(page.getDrawingTransform(.cropBox, rect: CGRect(origin: .zero, size: size), rotate: 0, preserveAspectRatio: true))
    ctx.drawPDFPage(page)
    ctx.restoreGState()
    if dark {
      // the web reader's turn (`invert(0.92)`): turned, then from 0.08 to 0.92
      ctx.setBlendMode(.difference)
      ctx.setFillColor(gray: 1, alpha: 1)
      ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
      ctx.setBlendMode(.normal)
      ctx.setFillColor(gray: 0, alpha: 0.16)
      ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
      ctx.setBlendMode(.plusLighter)
      ctx.setFillColor(gray: 0.08, alpha: 1)
      ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
    }
    return ctx.makeImage()
  }
}

// MARK: - the pictures kept: in memory within a budget, whole pages on disk too

final class PageMemory {
  static let shared = PageMemory()
  private let lock = NSLock()
  /// Two pools, each let go of oldest first: the pages' small pictures (what a page shows the moment it is near, kept
  /// apart so the tiles of a zoom never push them out) and everything else.
  private struct Pool { var images: [String: CGImage] = [:]; var order: [String] = []; var bytes = 0; var most = 0 }
  private var small = Pool()
  private var rest = Pool()
  var bytes: Int { lock.lock(); defer { lock.unlock() }; return small.bytes + rest.bytes }
  /// What the pictures may take: a quarter of what the app may still use, at most 640 MB (a simulator says nothing of
  /// it: 640); a fifth of that for the small pictures.
  let budget: Int = {
    let free = Int(os_proc_available_memory())
    return free > 0 ? min(640 << 20, max(160 << 20, free / 4)) : 640 << 20
  }()
  init() { small.most = budget / 5; rest.most = budget - budget / 5 }

  private static func isSmall(_ k: String) -> Bool { k.contains("|pic|") && k.contains("|-1|") }
  func has(_ k: String) -> Bool { lock.lock(); defer { lock.unlock() }; return (PageMemory.isSmall(k) ? small : rest).images[k] != nil }
  func get(_ k: String) -> CGImage? {
    lock.lock(); defer { lock.unlock() }
    if PageMemory.isSmall(k) { return PageMemory.touch(&small, k) }
    return PageMemory.touch(&rest, k)
  }
  private static func touch(_ p: inout Pool, _ k: String) -> CGImage? {
    guard let i = p.images[k] else { return nil }
    if let at = p.order.lastIndex(of: k) { p.order.remove(at: at) }
    p.order.append(k)
    return i
  }
  func put(_ k: String, _ i: CGImage) {
    lock.lock(); defer { lock.unlock() }
    if PageMemory.isSmall(k) { PageMemory.add(&small, k, i) } else { PageMemory.add(&rest, k, i) }
  }
  private static func add(_ p: inout Pool, _ k: String, _ i: CGImage) {
    if let old = p.images[k] { p.bytes -= old.bytesPerRow * old.height; p.order.removeAll { $0 == k } }
    p.images[k] = i
    p.order.append(k)
    p.bytes += i.bytesPerRow * i.height
    while p.bytes > p.most, let first = p.order.first {
      p.order.removeFirst()
      if let gone = p.images.removeValue(forKey: first) { p.bytes -= gone.bytesPerRow * gone.height }
    }
  }

  /// Whole pages on disk, by the file's name: `<caches>/ilmi-pdf/<file>/<key>.jpg`.
  static func disk(_ path: String, _ key: String) -> URL? {
    guard let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else { return nil }
    return caches.appendingPathComponent("ilmi-pdf").appendingPathComponent((path as NSString).lastPathComponent).appendingPathComponent("\(key).jpg")
  }
  static func read(_ url: URL) -> CGImage? {
    guard let src = CGImageSourceCreateWithURL(url as CFURL, nil) else { return nil }
    return CGImageSourceCreateImageAtIndex(src, 0, [kCGImageSourceShouldCacheImmediately: true] as CFDictionary)
  }
  static func write(_ img: CGImage, _ url: URL) {
    // (kept only while the device has room for it: `DiskBudget`)
    guard DiskBudget.room(for: url) else { return }
    try? FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
    let tmp = url.appendingPathExtension("part")
    guard let dest = CGImageDestinationCreateWithURL(tmp as CFURL, "public.jpeg" as CFString, 1, nil) else { return }
    CGImageDestinationAddImage(dest, img, [kCGImageDestinationLossyCompressionQuality: 0.9] as CFDictionary)
    if CGImageDestinationFinalize(dest) { try? FileManager.default.removeItem(at: url); try? FileManager.default.moveItem(at: tmp, to: url) }
    DiskBudget.wrote(url)
  }

  /// Short of memory: every picture let go (those on the glass stay, held by their layers).
  func purge() {
    lock.lock(); defer { lock.unlock() }
    let (m1, m2) = (small.most, rest.most)
    small = Pool(); small.most = m1
    rest = Pool(); rest.most = m2
  }
}

// MARK: - a page

final class PdfPageView: UIView {
  let number: Int
  /// The page's whole picture shown, and its level (-1: half the fitted size, 0: the fitted size).
  let picture = CALayer()
  var pictureLevel = -2
  /// The tiles, a layer a level, by level.
  var levels: [Int: CALayer] = [:]
  /// Each level's tiles on the glass, by their place (`x,y` in pixels of that level).
  var tiles: [Int: Set<String>] = [:]

  init(number: Int, frame: CGRect) {
    self.number = number
    super.init(frame: frame)
    backgroundColor = .white
    layer.addSublayer(picture)
    picture.frame = bounds
    picture.contentsGravity = .resize
    picture.magnificationFilter = .linear
    picture.minificationFilter = .trilinear
  }
  required init?(coder: NSCoder) { fatalError() }

  func level(_ k: Int) -> CALayer {
    if let l = levels[k] { return l }
    let l = CALayer()
    l.frame = bounds
    l.zPosition = CGFloat(10 + k)
    layer.addSublayer(l)
    levels[k] = l
    tiles[k] = []
    return l
  }
  /// A layer of marks over the page (a selection, a search's hits), by name, made where there is none.
  private var named: [String: CAShapeLayer] = [:]
  func marks(_ name: String, color: UIColor) -> CAShapeLayer {
    if let l = named[name] { return l }
    let l = CAShapeLayer()
    l.fillColor = color.cgColor
    l.zPosition = name == "sel" ? 60 : 50
    l.frame = bounds
    layer.addSublayer(l)
    named[name] = l
    return l
  }
  func drop(level k: Int) {
    levels[k]?.removeFromSuperlayer()
    levels[k] = nil
    tiles[k] = nil
  }
  override func layoutSubviews() {
    super.layoutSubviews()
    CATransaction.begin(); CATransaction.setDisableActions(true)
    picture.frame = bounds
    for l in levels.values { l.frame = bounds }
    for l in named.values { l.frame = bounds }
    CATransaction.commit()
  }
}

/// Takes no touch where the page lays something over the surface: there the web view beneath has it.
final class HoledView: UIView {
  var holes: [CGRect] = []
  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    if holes.contains(where: { $0.contains(point) }) { return nil }
    return super.hitTest(point, with: event)
  }
}

// MARK: - the surface

final class PdfSurface: NSObject, UIScrollViewDelegate {
  static var all: [String: PdfSurface] = [:]

  let id: String
  let path: String
  let view = HoledView()
  let scroll = UIScrollView()
  let content = UIView()
  weak var plugin: InkPlugin?
  let doc: CGPDFDocument
  let count: Int
  private let painter: PagePainter
  /// Each page's size in points as the PDF says it, turned.
  var sizes: [CGSize] = []
  /// Each page shown's frame in the content at the fitted size, from the first shown (`first`).
  var frames: [CGRect] = []
  var first = 1
  var views: [Int: PdfPageView] = [:]
  private var dark = false
  private var shownLast = 1
  private var gap: CGFloat = 12
  private var top: CGFloat = 12
  private var side: CGFloat = 0
  private var opened = false
  private var lastPlace: CFTimeInterval = 0
  /// A zoom the page asked for is going on: when it ends the page is not told it as the reader's own.
  private var asked = false
  /// (the checks) Where it was told to open, and the sizes it was laid out at, in order.
  private var openedAt = ""
  private var laidOut: [String] = []
  private var link: CADisplayLink?
  var screen: CGFloat { view.window?.screen.scale ?? UIScreen.main.scale }
  // measuring
  private var marking = false
  private var markAt: CFTimeInterval = 0
  private var snapEvery = 0
  private var frameNo = 0
  private var frames2: [[String: Any]] = []

  init?(id: String, path: String, plugin: InkPlugin) {
    guard let d = CGPDFDocument(URL(fileURLWithPath: path) as CFURL) else { return nil }
    self.id = id
    self.path = path
    self.plugin = plugin
    doc = d
    count = d.numberOfPages
    painter = PagePainter.shared(path)
    super.init()
    for i in 1...max(1, count) {
      guard let p = d.page(at: i) else { sizes.append(CGSize(width: 612, height: 792)); continue }
      let c = p.getBoxRect(.cropBox)
      let rot = ((p.rotationAngle % 360) + 360) % 360
      sizes.append(rot == 90 || rot == 270 ? CGSize(width: c.height, height: c.width) : c.size)
    }
    view.clipsToBounds = true
    scroll.delegate = self
    scroll.minimumZoomScale = 0.5
    scroll.maximumZoomScale = 4
    scroll.bouncesZoom = true
    scroll.contentInsetAdjustmentBehavior = .never
    scroll.alwaysBounceVertical = true
    scroll.addSubview(content)
    view.addSubview(scroll)
    let l = CADisplayLink(target: self, selector: #selector(tick(_:)))
    l.add(to: .main, forMode: .common)
    link = l
    text = PdfText(surface: self)
  }
  /// The text: selection, taps, a search's hits.
  var text: PdfText?

  func remove() {
    link?.invalidate()
    link = nil
    view.removeFromSuperview()
    painter.keep { !$0.hasPrefix("\(self.id)|") }
  }

  // MARK: told

  func take(_ a: PdfSurfaceArgs, at rect: CGRect) {
    let wasW = view.bounds.width
    let place = opened ? here() : nil
    view.frame = rect
    scroll.frame = view.bounds
    if let d = a.desk { view.backgroundColor = UIColor(pdfHex: d) ?? .lightGray }
    let nowDark = a.dark ?? false
    if nowDark != dark {
      dark = nowDark
      for v in views.values { for k in Array(v.levels.keys) { v.drop(level: k) }; v.picture.contents = nil; v.pictureLevel = -2 }
    }
    top = CGFloat(a.top ?? 12)
    let f0 = max(1, min(count, a.first ?? 1)), f1 = max(f0, min(count, a.last ?? count))
    let rangeChanged = opened && (f0 != first || f1 != first + frames.count - 1)
    first = f0
    shownLast = f1
    if rangeChanged { for v in views.values { v.removeFromSuperview() }; views = [:] }
    // the holes: cut out of the view's glass and its touches
    holesFrom(a.holes ?? [])
    if !opened || abs(wasW - rect.width) > 0.5 || rangeChanged {
      layout()
      if !opened {
        opened = true
        let z = CGFloat(a.zoom ?? 1)
        if abs(z - 1) > 0.001 { scroll.zoomScale = max(scroll.minimumZoomScale, min(scroll.maximumZoomScale, z)) }
        openedAt = a.open.map { "\($0.page) \($0.y)" } ?? "none"
        go(a.open.map { ($0.page, CGFloat($0.y), $0.x.map { CGFloat($0) }) } ?? (first, 0, nil), animated: false)
      } else if let p = place {
        go(p, animated: false)
      }
    }
    refresh()
  }

  private func holesFrom(_ hs: [PdfHole]) {
    guard let web = plugin?.webView else { return }
    let rects = hs.map { web.scrollView.convert(CGRect(x: $0.x, y: $0.y, width: $0.w, height: $0.h), to: view) }
    view.holes = rects
    if rects.isEmpty { view.layer.mask = nil; return }
    let path = UIBezierPath(rect: view.bounds.insetBy(dx: -4000, dy: -4000))
    for r in rects { path.append(UIBezierPath(rect: r)) }
    let m = CAShapeLayer()
    m.fillRule = .evenOdd
    m.path = path.cgPath
    view.layer.mask = m
  }

  /// The pages laid out at the fitted size: the view's width, less a little either side.
  private func layout() {
    laidOut.append("\(Int(view.bounds.width))x\(Int(view.bounds.height))")
    let z = scroll.zoomScale
    scroll.zoomScale = 1
    let w = view.bounds.width - 2 * side
    var y = top
    frames = sizes[(first - 1)..<shownLast].map { s in
      let h = (w * s.height / max(1, s.width)).rounded()
      defer { y += h + gap }
      return CGRect(x: side, y: y, width: w, height: h)
    }
    content.frame = CGRect(x: 0, y: 0, width: view.bounds.width, height: y - gap + top)
    scroll.contentSize = content.frame.size
    // (a page laid out at another width: its picture stays, stretched, until the one at this width comes)
    for (n, v) in views { v.frame = frames[n - first]; v.pictureLevel = -2; for k in Array(v.levels.keys) { v.drop(level: k) } }
    scroll.zoomScale = z
  }

  // MARK: where

  /// The place at the top of the view: a page, how far down it, and what of the width is at the middle.
  func here() -> (Int, CGFloat, CGFloat?) {
    let z = scroll.zoomScale
    let y = (scroll.contentOffset.y + 14) / z
    var n = first
    for (i, f) in frames.enumerated() where f.minY <= y { n = i + first }
    let f = frames[n - first]
    let x = scroll.contentSize.width > scroll.bounds.width ? (scroll.contentOffset.x + scroll.bounds.width / 2) / max(1, scroll.contentSize.width) : nil
    return (n, max(0, min(1, (y - f.minY) / max(1, f.height))), x)
  }

  func go(_ p: (Int, CGFloat, CGFloat?), animated: Bool) {
    guard !frames.isEmpty else { return }
    let n = max(first, min(first + frames.count - 1, p.0))
    let f = frames[n - first]
    let z = scroll.zoomScale
    var o = CGPoint(x: scroll.contentOffset.x, y: (f.minY + f.height * p.1) * z - 14)
    if let x = p.2 { o.x = x * scroll.contentSize.width - scroll.bounds.width / 2 }
    o.x = max(0, min(o.x, max(0, scroll.contentSize.width - scroll.bounds.width)))
    o.y = max(0, min(o.y, max(0, scroll.contentSize.height - scroll.bounds.height)))
    scroll.setContentOffset(o, animated: animated)
    refresh()
    say(settled: true)
  }

  func zoom(to z: CGFloat, animated: Bool) {
    let zz = max(scroll.minimumZoomScale, min(scroll.maximumZoomScale, z))
    if abs(zz - scroll.zoomScale) < 0.0005 { return }
    // about the middle of the view: the same point of the pages there after as before, as far as the pages reach
    let c = CGPoint(x: (scroll.contentOffset.x + scroll.bounds.width / 2 - content.frame.minX) / scroll.zoomScale, y: (scroll.contentOffset.y + scroll.bounds.height / 2) / scroll.zoomScale)
    let cw = content.bounds.width * zz, ch = content.bounds.height * zz
    let to = CGPoint(x: max(0, min(c.x * zz - scroll.bounds.width / 2, cw - scroll.bounds.width)), y: max(0, min(c.y * zz - scroll.bounds.height / 2, ch - scroll.bounds.height)))
    let done = { [weak self] (finished: Bool) in
      guard let self = self else { return }
      self.refresh()
      // (told as the page's own asking: the page has the zoom already; one cut short by the next says nothing)
      guard finished else { return }
      self.asked = true
      self.say(settled: true)
      self.asked = false
    }
    if animated {
      asked = true
      UIView.animate(withDuration: 0.25, delay: 0, options: [.curveEaseOut, .allowUserInteraction, .beginFromCurrentState], animations: {
        self.scroll.zoomScale = zz
        self.scroll.contentOffset = to
      }, completion: done)
    } else {
      scroll.zoomScale = zz
      scroll.contentOffset = to
      done(true)
    }
  }

  /// The page is told where the pages are: as they settle, and a few times a second while they move.
  private func say(settled: Bool) {
    let now = CACurrentMediaTime()
    if !settled && now - lastPlace < 0.12 { return }
    lastPlace = now
    let (n, y, x) = here()
    var m: [String: Any] = ["kind": "surface", "id": id, "what": "pdfplace", "page": n, "y": Double(y), "zoom": Double(scroll.zoomScale), "settled": settled, "asked": asked]
    if let x = x { m["x"] = Double(x) }
    // the page at the foot of the view, and how far down it (the read point)
    let foot = (scroll.contentOffset.y + scroll.bounds.height - 8) / scroll.zoomScale
    var fn = first
    for (i, f) in frames.enumerated() where f.minY <= foot { fn = i + first }
    m["foot"] = fn
    m["footY"] = Double(max(0, min(1, (foot - frames[fn - first].minY) / max(1, frames[fn - first].height))))
    plugin?.emit(m)
  }

  // MARK: the scroll view

  func viewForZooming(in s: UIScrollView) -> UIView? { content }
  func scrollViewDidZoom(_ s: UIScrollView) {
    // under the fitted size, the column in the middle of the view
    let dx = max(0, (s.bounds.width - s.contentSize.width) / 2)
    content.frame.origin.x = dx
    refresh()
    say(settled: false)
  }
  func scrollViewDidScroll(_ s: UIScrollView) { refresh(); say(settled: false) }
  func scrollViewDidEndZooming(_ s: UIScrollView, with view: UIView?, atScale scale: CGFloat) { refresh(); say(settled: true); asked = false }
  func scrollViewWillBeginZooming(_ s: UIScrollView, with view: UIView?) { if s.pinchGestureRecognizer?.state == .began || s.pinchGestureRecognizer?.state == .changed { asked = false } }
  func scrollViewDidEndDecelerating(_ s: UIScrollView) { refresh(); say(settled: true) }
  func scrollViewDidEndDragging(_ s: UIScrollView, willDecelerate d: Bool) { if !d { refresh(); say(settled: true) } }
  func scrollViewDidEndScrollingAnimation(_ s: UIScrollView) { refresh(); say(settled: true) }

  // MARK: what is drawn

  /// The level the zoom asks for: the least doubling of the fitted size at or over it (half the fitted size under it).
  private var wantLevel: Int {
    let z = scroll.zoomScale
    if z <= 0.5 + 0.01 { return -1 }
    var k = 0
    while CGFloat(1 << k) < z * 0.98 && k < 2 { k += 1 }
    return k
  }
  private var moving: Bool { scroll.isZooming || scroll.isZoomBouncing || scroll.isDragging || scroll.isDecelerating || scroll.isTracking }

  /// What of the content is in view, in the content's own (fitted) points.
  var seen: CGRect {
    let z = scroll.zoomScale
    return CGRect(x: (scroll.contentOffset.x - content.frame.minX) / z, y: scroll.contentOffset.y / z, width: scroll.bounds.width / z, height: scroll.bounds.height / z)
  }

  /// The pages near the view are there, each with its pictures and the tiles of the level asked for; the rest go.
  func refresh() {
    guard !frames.isEmpty else { return }
    let v = seen
    // (the pages a zoom out to the least would show are there already, each with its small picture: never bare paper)
    let near = v.insetBy(dx: 0, dy: -max(v.height * 1.5, scroll.bounds.height * 1.6))
    let want = wantLevel
    var wanted = Set<String>()
    var madeSome = false
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    for (i, f) in frames.enumerated() {
      let n = i + first
      if f.intersects(near) {
        let pv = views[n] ?? {
          let made = PdfPageView(number: n, frame: f)
          content.addSubview(made)
          views[n] = made
          madeSome = true
          return made
        }()
        let inView = f.intersects(v)
        // the whole picture: the fitted size for the pages in view and about them, half of it else
        let pictureLevel = f.intersects(v.insetBy(dx: 0, dy: -v.height * 0.6)) ? 0 : -1
        // (a page's small picture first of all, wherever it is near: a few milliseconds, and a page is never bare)
        if pv.pictureLevel < -1 { picture(pv, level: -1, priority: 5 + Double(abs(f.midY - v.midY) / 1000), wanted: &wanted) }
        picture(pv, level: pictureLevel, priority: (inView ? 40 : 300) + Double(abs(f.midY - v.midY) / 100), wanted: &wanted)
        if inView || f.intersects(v.insetBy(dx: 0, dy: -v.height * (want == 2 ? 2.5 : 0.5))) {
          if want >= 1 || (want == 0 && pv.pictureLevel < 0) { tiles(pv, level: want, around: v, priority: 0, wanted: &wanted) }
          // at the finest level, the one under it about the view too: a scroll finds at worst a level coarser
          if want == 2 { tiles(pv, level: 1, around: v.insetBy(dx: -v.width * 1.5, dy: -v.height * 2.5), priority: 100, wanted: &wanted) }
          // resting: the next level up is drawn ahead for what is in view, for a pinch
          if !moving && want < 2 && inView && want >= 0 { tiles(pv, level: want + 1, around: v, priority: 600, only: true, wanted: &wanted) }
        }
        // the levels kept are the one asked for and those either side of it: a coarser one goes once the asked for covers
        for k in pv.levels.keys.sorted() where k > want + 1 || (k < want - 1 && covers(pv, want, v)) { pv.drop(level: k) }
      } else {
        if let pv = views[n] {
          pv.removeFromSuperview()
          views[n] = nil
        }
        // further out, as far again: the small picture made ahead, so a page laid out has it at once
        if f.intersects(near.insetBy(dx: 0, dy: -near.height * 0.5)) { ahead(n, width: f.width, priority: 30 + Double(abs(f.midY - v.midY) / 1000), wanted: &wanted) }
      }
    }
    CATransaction.commit()
    painter.keep { !$0.hasPrefix("\(self.id)|") || wanted.contains($0) }
    if madeSome { text?.pageShown() }
  }

  /// Whether the level `k` (or the whole picture where `k` is under 1) covers what of the page is in view.
  private func covers(_ pv: PdfPageView, _ k: Int, _ v: CGRect) -> Bool {
    if k <= 0 { return pv.pictureLevel >= k }
    let need = bands(pv, level: k, around: v, margin: false)
    let have = pv.tiles[k] ?? []
    return need.allSatisfy { have.contains("\(Int($0.minX)),\(Int($0.minY))") }
  }

  /// A page's small picture made ahead, kept in memory, for a page not yet near enough to be laid out: there at once when it is.
  private func ahead(_ n: Int, width: CGFloat, priority: Double, wanted: inout Set<String>) {
    let dark = self.dark
    let cacheKey = "\(path)|pic|\(n)|-1|\(dark ? 1 : 0)|\(Int(width))"
    if PageMemory.shared.has(cacheKey) { return }
    let key = "\(id)|pic|\(n)|-1|\(dark ? 1 : 0)"
    wanted.insert(key)
    let pxW = (width * screen * 0.5).rounded()
    let page = sizes[n - 1]
    let rect = CGRect(x: 0, y: 0, width: pxW, height: (pxW * page.height / page.width).rounded())
    let disk = PageMemory.disk(path, "pic-\(n)--1-\(dark ? 1 : 0)-\(Int(pxW))")
    painter.ask(key, priority: priority, draw: { doc in
      if let u = disk, let img = PageMemory.read(u) { return img }
      let img = PagePainter.draw(doc, page: n, pxW: pxW, rect: rect, dark: dark)
      if let img = img, let u = disk { PageMemory.write(img, u) }
      return img
    }, done: { [weak self] img in
      guard let img = img else { return }
      PageMemory.shared.put(cacheKey, img)
      if let self = self, let pv = self.views[n], pv.pictureLevel < -1 { self.show(pv, img, -1) }
    })
  }

  private func picture(_ pv: PdfPageView, level k: Int, priority: Double, wanted: inout Set<String>) {
    if pv.pictureLevel >= k { return }
    let n = pv.number
    let dark = self.dark
    let key = "\(id)|pic|\(n)|\(k)|\(dark ? 1 : 0)"
    let cacheKey = "\(path)|pic|\(n)|\(k)|\(dark ? 1 : 0)|\(Int(pv.bounds.width))"
    if let img = PageMemory.shared.get(cacheKey) { show(pv, img, k); return }
    wanted.insert(key)
    let pxW = (pv.bounds.width * screen * (k < 0 ? 0.5 : 1)).rounded()
    let page = sizes[n - 1]
    let rect = CGRect(x: 0, y: 0, width: pxW, height: (pxW * page.height / page.width).rounded())
    let disk = PageMemory.disk(path, "pic-\(n)-\(k)-\(dark ? 1 : 0)-\(Int(pxW))")
    painter.ask(key, priority: priority, draw: { doc in
      if let u = disk, let img = PageMemory.read(u) { return img }
      let img = PagePainter.draw(doc, page: n, pxW: pxW, rect: rect, dark: dark)
      if let img = img, let u = disk { PageMemory.write(img, u) }
      return img
    }, done: { [weak self, weak pv] img in
      guard let img = img else { return }
      PageMemory.shared.put(cacheKey, img)
      guard let self = self, let pv = pv, self.views[n] === pv else { return }
      self.show(pv, img, k)
    })
  }
  private func show(_ pv: PdfPageView, _ img: CGImage, _ k: Int) {
    guard k > pv.pictureLevel else { return }
    CATransaction.begin(); CATransaction.setDisableActions(true)
    pv.picture.contents = img
    pv.pictureLevel = k
    CATransaction.commit()
  }

  /// The bands of level `k` over what of the page is in view (and half a view about it, with `margin`), in that level's pixels.
  private func bands(_ pv: PdfPageView, level k: Int, around v: CGRect, margin: Bool = true) -> [CGRect] {
    let scale = screen * CGFloat(1 << max(0, k))
    let pxW = (pv.bounds.width * scale).rounded(), pxH = (pv.bounds.height * scale).rounded()
    var a = v.offsetBy(dx: -pv.frame.minX, dy: -pv.frame.minY)
    if margin { a = a.insetBy(dx: -v.width * 0.25, dy: -v.height * 0.5) }
    a = a.intersection(CGRect(origin: .zero, size: pv.bounds.size))
    if a.isNull || a.isEmpty { return [] }
    let bw: CGFloat = 2048, bh: CGFloat = 384
    var out: [CGRect] = []
    var y = (a.minY * scale / bh).rounded(.down) * bh
    while y < a.maxY * scale && y < pxH {
      var x = (a.minX * scale / bw).rounded(.down) * bw
      while x < a.maxX * scale && x < pxW {
        out.append(CGRect(x: x, y: y, width: min(bw, pxW - x), height: min(bh, pxH - y)))
        x += bw
      }
      y += bh
    }
    return out
  }

  private func tiles(_ pv: PdfPageView, level k: Int, around v: CGRect, priority base: Double, only: Bool = false, wanted: inout Set<String>) {
    let scale = screen * CGFloat(1 << max(0, k))
    let pxW = (pv.bounds.width * scale).rounded()
    let n = pv.number
    let dark = self.dark
    let centre = CGPoint(x: (v.midX - pv.frame.minX) * scale, y: (v.midY - pv.frame.minY) * scale)
    let layer = pv.level(k)
    for b in bands(pv, level: k, around: v, margin: !only) {
      let at = "\(Int(b.minX)),\(Int(b.minY))"
      if pv.tiles[k]?.contains(at) == true { continue }
      let cacheKey = "\(path)|t|\(n)|\(k)|\(at)|\(dark ? 1 : 0)|\(Int(pxW))"
      if let img = PageMemory.shared.get(cacheKey) { put(pv, layer, img, b, scale, k, at); continue }
      let key = "\(id)|t|\(n)|\(k)|\(at)|\(dark ? 1 : 0)|\(Int(pxW))"
      wanted.insert(key)
      let far = hypot(b.midX - centre.x, b.midY - centre.y) / scale
      painter.ask(key, priority: base + Double(far / 10), draw: { doc in
        PagePainter.draw(doc, page: n, pxW: pxW, rect: b, dark: dark)
      }, done: { [weak self, weak pv, weak layer] img in
        guard let img = img else { return }
        PageMemory.shared.put(cacheKey, img)
        guard let self = self, let pv = pv, let layer = layer, self.views[n] === pv, pv.levels[k] === layer else { return }
        self.put(pv, layer, img, b, scale, k, at)
      })
    }
  }
  private func put(_ pv: PdfPageView, _ layer: CALayer, _ img: CGImage, _ b: CGRect, _ scale: CGFloat, _ k: Int, _ at: String) {
    guard pv.tiles[k]?.contains(at) != true else { return }
    CATransaction.begin(); CATransaction.setDisableActions(true)
    let t = CALayer()
    t.contents = img
    t.frame = CGRect(x: b.minX / scale, y: b.minY / scale, width: b.width / scale, height: b.height / scale)
    t.magnificationFilter = .linear
    t.minificationFilter = .linear
    layer.addSublayer(t)
    pv.tiles[k, default: []].insert(at)
    CATransaction.commit()
  }

  // MARK: weighing

  /// Of points over the pages in view, the most levels coarser than asked any shows, and the share one or more coarser.
  private var why = ""
  private func coarse() -> (Int, Double) {
    let v = seen
    let want = wantLevel
    var worst = 0, all = 0, some = 0
    why = ""
    for pv in views.values where pv.frame.intersects(v) {
      let r = pv.frame.intersection(v)
      for i in 0..<6 { for j in 0..<8 {
        let p = CGPoint(x: r.minX + r.width * (CGFloat(i) + 0.5) / 6 - pv.frame.minX, y: r.minY + r.height * (CGFloat(j) + 0.5) / 8 - pv.frame.minY)
        var have = pv.pictureLevel >= -1 ? pv.pictureLevel : -9
        for (k, l) in pv.levels where k > have {
          if l.sublayers?.contains(where: { $0.frame.contains(p) }) == true { have = k }
        }
        all += 1
        let off = want - have
        if off >= 1 { some += 1 }
        if off > worst { why = "p\(pv.number) pic\(pv.pictureLevel) at \(Int(p.x)),\(Int(p.y)) of \(Int(pv.bounds.width))x\(Int(pv.bounds.height))" + pv.levels.keys.sorted().map { " L\($0)=\(pv.tiles[$0]?.count ?? 0)" }.joined() }
        worst = max(worst, off)
      } }
    }
    return (worst, all > 0 ? Double(some) / Double(all) : 0)
  }

  @objc private func tick(_ l: CADisplayLink) {
    guard marking else { return }
    frameNo += 1
    let (worst, share) = coarse()
    var f: [String: Any] = ["t": (l.timestamp - markAt) * 1000, "dur": l.duration * 1000, "z": Double(scroll.zoomScale), "worst": worst, "coarse": share, "moving": moving, "depth": painter.depth]
    if worst >= 2 { f["why"] = why }
    if snapEvery > 0 && frameNo % snapEvery == 0 { f["edge"] = edges() }
    frames2.append(f)
    if frames2.count > 20000 { frames2.removeFirst(5000) }
  }

  private func edges() -> Double {
    let side: CGFloat = 160
    let r = CGRect(x: view.bounds.midX - side / 2, y: view.bounds.midY - side / 2, width: side, height: side)
    let fmt = UIGraphicsImageRendererFormat()
    fmt.scale = screen
    fmt.opaque = true
    let img = UIGraphicsImageRenderer(size: r.size, format: fmt).image { _ in
      view.drawHierarchy(in: CGRect(x: -r.minX, y: -r.minY, width: view.bounds.width, height: view.bounds.height), afterScreenUpdates: false)
    }
    guard let cg = img.cgImage, let data = cg.dataProvider?.data, let p = CFDataGetBytePtr(data) else { return -1 }
    let w = cg.width, h = cg.height, row = cg.bytesPerRow, bpp = cg.bitsPerPixel / 8
    func grey(_ x: Int, _ y: Int) -> Int { let q = p + y * row + x * bpp; return (Int(q[0]) + Int(q[1]) + Int(q[2])) / 3 }
    var some = 0, steep = 0
    for y in 0..<(h - 1) { for x in 0..<(w - 1) {
      let g = grey(x, y)
      for d in [abs(grey(x + 1, y) - g), abs(grey(x, y + 1) - g)] where d > 24 { some += 1; if d > 140 { steep += 1 } }
    } }
    return some > 0 ? Double(steep) / Double(some) : -1
  }

  func handle(_ a: PdfSurfaceDoArgs) -> [String: Any] {
    switch a.op {
    case "go":
      go((a.page ?? 1, CGFloat(a.y ?? 0), a.x.map { CGFloat($0) }), animated: a.animated ?? false)
      return state()
    case "zoom":
      zoom(to: CGFloat(a.zoom ?? 1), animated: a.animated ?? true)
      return state()
    case "scroll":
      let to = CGPoint(x: scroll.contentOffset.x, y: max(0, min(scroll.contentOffset.y + CGFloat(a.dy ?? 0), scroll.contentSize.height - scroll.bounds.height)))
      if (a.ms ?? 0) <= 0 { scroll.setContentOffset(to, animated: false) } else { UIView.animate(withDuration: (a.ms ?? 0) / 1000, delay: 0, options: [.curveEaseOut, .allowUserInteraction]) { self.scroll.contentOffset = to } }
      return state()
    case "find":
      text?.find(a.q ?? "", page: a.page, k: a.k)
      return state()
    case "select":
      text?.selectFrom(page: a.page ?? first, CGPoint(x: a.x ?? 0.1, y: a.y ?? 0.1), to: CGPoint(x: a.x2 ?? 0.9, y: a.y2 ?? 0.12))
      return state()
    case "clear":
      text?.clear()
      return state()
    case "links":
      var st = state()
      st["links"] = text?.links(a.page ?? first) ?? []
      return st
    case "mark":
      frames2 = []
      frameNo = 0
      snapEvery = a.snap ?? 0
      markAt = CACurrentMediaTime()
      marking = true
      return ["marked": true]
    case "stats":
      marking = false
      let out = frames2
      frames2 = []
      var s = state()
      s["frames"] = out
      return s
    default:
      return state()
    }
  }

  /// Each page in view: its number, its picture's level, and how many tiles each level has on the glass.
  private func seenPages() -> [String] {
    views.values.filter { $0.frame.intersects(seen) }.sorted { $0.number < $1.number }.map { pv in
      "\(pv.number):\(pv.pictureLevel)" + pv.levels.keys.sorted().map { k in " L\(k)=\(pv.tiles[k]?.count ?? 0)" }.joined()
    }
  }
  func state() -> [String: Any] {
    let (n, y, x) = here()
    let (worst, share) = coarse()
    return ["page": n, "y": Double(y), "x": x.map { Double($0) } as Any, "zoom": Double(scroll.zoomScale), "pages": count, "views": views.count, "worst": worst, "coarse": share,
            "drawn": painter.drawn, "drawMs": painter.drawMs, "workers": painter.workers, "memory": PageMemory.shared.bytes, "budget": PageMemory.shared.budget, "level": wantLevel,
            "seen": seenPages(),
            "opened": openedAt, "laid": laidOut.suffix(6).joined(separator: " "),
            "hits": text?.hitCount ?? 0, "current": text?.current.map { [$0.0, $0.1] } as Any, "selected": text?.selection?.string ?? "",
            "offset": [Double(scroll.contentOffset.x), Double(scroll.contentOffset.y)], "content": [Double(scroll.contentSize.width), Double(scroll.contentSize.height)], "dark": dark, "holes": view.holes.count]
  }
}

extension UIColor {
  convenience init?(pdfHex hex: String) {
    var s = hex.trimmingCharacters(in: .whitespaces)
    if s.hasPrefix("#") { s.removeFirst() }
    guard s.count == 6, let v = Int(s, radix: 16) else { return nil }
    self.init(red: CGFloat((v >> 16) & 255) / 255, green: CGFloat((v >> 8) & 255) / 255, blue: CGFloat(v & 255) / 255, alpha: 1)
  }
}

// MARK: - the disk caches' budget

/// What the app's disk caches of pages may hold (the native surface's pictures, `ilmi-pdf`, and the scheme's whole
/// pages, `<bundle>/ilmi-pages`, which `pages.rs` budgets by the same rule): a twentieth of the device's free space for
/// what matters, at most 160 MB each, nothing under 500 MB free (an iPad said "not enough storage" twice beside a
/// 160 MB cache). The oldest go first. Short of memory (the system's warning) both are cut to half their budget and
/// the pictures in memory let go; on a device about to be full both are emptied.
enum DiskBudget {
  static let most: Int64 = 160 << 20
  static let floor: Int64 = 500 << 20
  private static var said: (CFTimeInterval, Int64)?
  private static var sizes: [String: Int64] = [:]
  private static let lock = NSLock()
  private static var listening = false

  static var caches: URL? { FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first }
  /// The two caches' folders.
  static var folders: [URL] {
    guard let c = caches else { return [] }
    var out = [c.appendingPathComponent("ilmi-pdf")]
    if let b = Bundle.main.bundleIdentifier { out.append(c.appendingPathComponent(b).appendingPathComponent("ilmi-pages")) }
    return out
  }

  /// At launch: the warnings listened for, and each cache cut to what there is room for now.
  static func start() {
    let b = budget()
    DispatchQueue.global(qos: .utility).async { for f in folders { trim(f, to: b) } }
  }

  /// The budget of one cache now (the free space read again at most every half minute).
  static func budget() -> Int64 {
    lock.lock(); defer { lock.unlock() }
    listen()
    if let (at, b) = said, CACurrentMediaTime() - at < 30 { return b }
    var free: Int64 = -1
    if let c = caches, let v = try? c.resourceValues(forKeys: [.volumeAvailableCapacityForImportantUsageKey]), let f = v.volumeAvailableCapacityForImportantUsage { free = f }
    let b: Int64 = free < 0 ? most / 4 : free < floor ? 0 : min(most, free / 20)
    said = (CACurrentMediaTime(), b)
    return b
  }

  /// Whether there is room to keep a picture in the cache `url` lies in; where there is none, the cache is emptied.
  static func room(for url: URL) -> Bool {
    let b = budget()
    if b == 0 { for f in folders { trim(f, to: 0) }; return false }
    return true
  }
  /// A picture was kept: past its budget the cache's oldest go, to three quarters of it.
  static func wrote(_ url: URL) {
    guard let folder = folders.first(where: { url.path.hasPrefix($0.path) }) else { return }
    let n = Int64((try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0)
    lock.lock()
    let key = folder.path
    let size = (sizes[key] ?? total(folder)) + n
    sizes[key] = size
    lock.unlock()
    let b = budget()
    if size > b { DispatchQueue.global(qos: .utility).async { trim(folder, to: b * 3 / 4) } }
  }

  private static func files(_ folder: URL) -> [(URL, Int64, Date)] {
    guard let e = FileManager.default.enumerator(at: folder, includingPropertiesForKeys: [.fileSizeKey, .contentModificationDateKey, .isRegularFileKey]) else { return [] }
    var out: [(URL, Int64, Date)] = []
    for case let u as URL in e {
      guard let v = try? u.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey, .isRegularFileKey]), v.isRegularFile == true else { continue }
      out.append((u, Int64(v.fileSize ?? 0), v.contentModificationDate ?? .distantPast))
    }
    return out
  }
  private static func total(_ folder: URL) -> Int64 { files(folder).reduce(0) { $0 + $1.1 } }

  /// The oldest let go until `folder` holds no more than `most`.
  static func trim(_ folder: URL, to most: Int64) {
    var all = files(folder).sorted { $0.2 < $1.2 }
    var size = all.reduce(0) { $0 + $1.1 }
    while size > most, !all.isEmpty {
      let f = all.removeFirst()
      if (try? FileManager.default.removeItem(at: f.0)) != nil { size -= f.1 }
    }
    lock.lock(); sizes[folder.path] = size; lock.unlock()
  }

  /// The system's warnings heard once: short of memory, the caches cut to half and the pictures in memory let go.
  private static func listen() {
    guard !listening else { return }
    listening = true
    NotificationCenter.default.addObserver(forName: UIApplication.didReceiveMemoryWarningNotification, object: nil, queue: .main) { _ in
      PageMemory.shared.purge()
      let half = budget() / 2
      DispatchQueue.global(qos: .utility).async { for f in folders { trim(f, to: half) } }
    }
  }
}
