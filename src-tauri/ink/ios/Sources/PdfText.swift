// A book's native surface: its text (the native page view, phase 2).
//
// PDFKit's document is the model of a page's text (`PDFDocument`, `PDFPage`; its view is not used): a finger held
// on a word selects it, and moved while held carries the selection on, across pages; the page is told the selection
// (its text, its lines as quads in fractions of each page, where it lies on the glass), and the system's edit menu
// over it offers `copy`, `passage` and `card` (the last two the page's own doing). A tap is told to the page, which
// follows a link there as it always has (its links are read by pdf.js). A search's hits are found here by PDFKit (on
// a document of its own, off the main thread), drawn on their pages, the one the page says is current brought into view.

import PDFKit
import UIKit

final class PdfText: NSObject, UIGestureRecognizerDelegate {
  weak var surface: PdfSurface?
  let model: PDFDocument?
  private var anchor: (Int, CGPoint)?
  private(set) var selection: PDFSelection?
  private var selText = ""
  private var menu: AnyObject?
  private var menuEars: AnyObject?
  // search
  private var findQ = ""
  private var finding = false
  /// The hits, by page: each a list of its lines' rects in the page's PDF points, in the document's order.
  private(set) var hits: [Int: [[CGRect]]] = [:]
  private(set) var current: (Int, Int)?
  private var pendingCurrent: (Int, Int)?

  init(surface: PdfSurface) {
    self.surface = surface
    model = PDFDocument(url: URL(fileURLWithPath: surface.path))
    super.init()
    let hold = UILongPressGestureRecognizer(target: self, action: #selector(held(_:)))
    hold.minimumPressDuration = 0.35
    hold.allowedTouchTypes = [NSNumber(value: UITouch.TouchType.direct.rawValue)]
    hold.delegate = self
    surface.scroll.addGestureRecognizer(hold)
    let tap = UITapGestureRecognizer(target: self, action: #selector(tapped(_:)))
    tap.delegate = self
    tap.require(toFail: hold)
    surface.scroll.addGestureRecognizer(tap)
    if #available(iOS 16.0, *) {
      let ears = PdfMenu(text: self)
      let m = UIEditMenuInteraction(delegate: ears)
      surface.scroll.addInteraction(m)
      menu = m
      menuEars = ears
    }
  }

  func gestureRecognizer(_ g: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { false }

  // MARK: where

  /// The page under a point of the scroll view, and the point in that page's view (fitted points).
  private func pageAt(_ p: CGPoint) -> (Int, CGPoint)? {
    guard let s = surface else { return nil }
    let c = s.scroll.convert(p, to: s.content)
    for (i, f) in s.frames.enumerated() where f.insetBy(dx: 0, dy: -6).contains(c) {
      return (i + s.first, CGPoint(x: c.x - f.minX, y: c.y - f.minY))
    }
    return nil
  }
  /// The transform from a page's PDF points to its picture's points at its natural size (y up), as the tiles draw it.
  private func pdfTransform(_ n: Int) -> (CGAffineTransform, CGSize)? {
    guard let s = surface, let page = s.doc.page(at: n) else { return nil }
    let size = s.sizes[n - 1]
    return (page.getDrawingTransform(.cropBox, rect: CGRect(origin: .zero, size: size), rotate: 0, preserveAspectRatio: true), size)
  }
  func toPdf(_ n: Int, _ v: CGPoint) -> CGPoint {
    guard let s = surface, let (t, size) = pdfTransform(n) else { return v }
    let k = s.frames[n - s.first].width / size.width
    return CGPoint(x: v.x / k, y: size.height - v.y / k).applying(t.inverted())
  }
  /// A rect of a page's PDF points as a rect of its view (fitted points, from its top left).
  func toView(_ n: Int, _ r: CGRect) -> CGRect {
    guard let s = surface, let (t, size) = pdfTransform(n) else { return r }
    let k = s.frames[n - s.first].width / size.width
    let q = r.applying(t)
    return CGRect(x: q.minX * k, y: (size.height - q.maxY) * k, width: q.width * k, height: q.height * k)
  }

  // MARK: selection

  @objc private func held(_ g: UILongPressGestureRecognizer) {
    guard let s = surface, let model = model else { return }
    let p = g.location(in: s.scroll)
    switch g.state {
    case .began:
      guard let (n, v) = pageAt(p), let page = model.page(at: n - 1) else { return }
      let pt = toPdf(n, v)
      anchor = (n, pt)
      select(page.selectionForWord(at: pt))
    case .changed:
      guard let a = anchor, let (n, v) = pageAt(p), let pa = model.page(at: a.0 - 1), let pb = model.page(at: n - 1) else { return }
      let pt = toPdf(n, v)
      let forward = n > a.0 || (n == a.0 && (pt.y < a.1.y - 2 || (abs(pt.y - a.1.y) <= 2 && pt.x >= a.1.x)))
      let sel = forward ? model.selection(from: pa, at: a.1, to: pb, at: pt) : model.selection(from: pb, at: pt, to: pa, at: a.1)
      if let w = pa.selectionForWord(at: a.1) { sel?.add(w) }
      select(sel)
    case .ended:
      tell()
      showMenu()
    case .cancelled, .failed:
      tell()
    default: break
    }
  }

  @objc private func tapped(_ g: UITapGestureRecognizer) {
    guard let s = surface else { return }
    let p = g.location(in: s.scroll)
    let had = selection != nil
    if had { select(nil); tell() }
    guard let (n, v) = pageAt(p) else { return }
    let f = s.frames[n - s.first]
    s.plugin?.emit(["kind": "surface", "id": s.id, "what": "pdftap", "page": n, "x": Double(v.x / f.width), "y": Double(v.y / f.height), "cleared": had])
  }

  /// The selection drawn on its pages (a layer a page, under nothing the page lays over it).
  func select(_ sel: PDFSelection?) {
    guard let s = surface else { return }
    selection = (sel?.string?.isEmpty ?? true) ? nil : sel
    // (a selection let go takes its menu with it)
    if selection == nil, #available(iOS 16.0, *) { (menu as? UIEditMenuInteraction)?.dismissMenu() }
    var byPage: [Int: UIBezierPath] = [:]
    if let sel = selection {
      for line in sel.selectionsByLine() {
        for page in line.pages {
          guard let model = model else { continue }
          let n = model.index(for: page) + 1
          let r = toView(n, line.bounds(for: page))
          byPage[n, default: UIBezierPath()].append(UIBezierPath(rect: r))
        }
      }
    }
    CATransaction.begin(); CATransaction.setDisableActions(true)
    for (n, pv) in s.views {
      let l = pv.marks("sel", color: UIColor(red: 0.30, green: 0.50, blue: 0.95, alpha: 0.28))
      l.path = byPage[n]?.cgPath
    }
    CATransaction.commit()
  }

  /// The page is told the selection: its text, its lines (quads in fractions of each page), its boxes, where it lies on the glass.
  func tell() {
    guard let s = surface, let web = s.plugin?.webView else { return }
    guard let sel = selection, let model = model, let text = sel.string, !text.isEmpty else {
      if !selText.isEmpty { selText = ""; s.plugin?.emit(["kind": "surface", "id": s.id, "what": "pdfsel", "text": ""]) }
      return
    }
    selText = text
    var quads: [[Double]] = []
    var onGlass = CGRect.null
    for line in sel.selectionsByLine() {
      for page in line.pages {
        let n = model.index(for: page) + 1
        guard n >= s.first, n - s.first < s.frames.count else { continue }
        let f = s.frames[n - s.first]
        let r = toView(n, line.bounds(for: page))
        quads.append([Double(n), Double(r.minX / f.width), Double(r.minY / f.height), Double(r.width / f.width), Double(r.height / f.height)])
        let inContent = r.offsetBy(dx: f.minX, dy: f.minY)
        onGlass = onGlass.union(s.content.convert(inContent, to: web.scrollView))
      }
    }
    let first = sel.pages.first.map { model.index(for: $0) + 1 } ?? s.first
    s.plugin?.emit(["kind": "surface", "id": s.id, "what": "pdfsel", "text": text, "page": first, "quads": quads,
                    "rect": [Double(onGlass.minX), Double(onGlass.minY), Double(onGlass.width), Double(onGlass.height)]])
  }

  func clear() { select(nil); tell() }

  private func showMenu() {
    guard #available(iOS 16.0, *), let m = menu as? UIEditMenuInteraction, let s = surface, let sel = selection, let model = model else { return }
    var r = CGRect.null
    for page in sel.pages {
      let n = model.index(for: page) + 1
      guard n >= s.first, n - s.first < s.frames.count else { continue }
      r = r.union(toView(n, sel.bounds(for: page)).offsetBy(dx: s.frames[n - s.first].minX, dy: s.frames[n - s.first].minY))
    }
    if r.isNull { return }
    let at = s.content.convert(r, to: s.scroll)
    m.presentEditMenu(with: UIEditMenuConfiguration(identifier: nil, sourcePoint: CGPoint(x: at.midX, y: at.minY)))
  }

  /// An action from the selection's menu: `copy` here, `passage` and `card` the page's.
  func act(_ what: String) {
    guard let s = surface else { return }
    if what == "copy" { UIPasteboard.general.string = selText }
    s.plugin?.emit(["kind": "surface", "id": s.id, "what": "pdfact", "act": what])
  }
  /// Where the selection's first page's part lies in the scroll view: what the menu points at.
  func menuRect() -> CGRect {
    guard let s = surface, let sel = selection, let model = model, let page = sel.pages.first else { return .null }
    let n = model.index(for: page) + 1
    guard n >= s.first, n - s.first < s.frames.count else { return .null }
    return s.content.convert(toView(n, sel.bounds(for: page)).offsetBy(dx: s.frames[n - s.first].minX, dy: s.frames[n - s.first].minY), to: s.scroll)
  }

  /// (the checks) A selection made as a held finger would, from one point of a page to another (fractions of it).
  func selectFrom(page n: Int, _ a: CGPoint, to b: CGPoint) {
    guard let s = surface, let model = model, let page = model.page(at: n - 1), n >= s.first, n - s.first < s.frames.count else { return }
    let f = s.frames[n - s.first]
    let pa = toPdf(n, CGPoint(x: a.x * f.width, y: a.y * f.height)), pb = toPdf(n, CGPoint(x: b.x * f.width, y: b.y * f.height))
    select(model.selection(from: page, at: pa, to: page, at: pb))
    tell()
  }

  /// (the checks) Each link on page `n` as the reader would press it: where it lies on the web view's glass, and what it is.
  func links(_ n: Int) -> [[String: Any]] {
    guard let s = surface, let web = s.plugin?.webView, let page = model?.page(at: n - 1), n >= s.first, n - s.first < s.frames.count else { return [] }
    let f = s.frames[n - s.first]
    return page.annotations.filter { $0.type == "Link" }.map { a in
      let r = s.content.convert(toView(n, a.bounds).offsetBy(dx: f.minX, dy: f.minY), to: web.scrollView)
      var m: [String: Any] = ["x": Double(r.midX), "y": Double(r.midY), "w": Double(r.width), "h": Double(r.height)]
      if let u = a.url { m["url"] = u.absoluteString }
      if let d = a.destination, let p = d.page, let model = model { m["to"] = model.index(for: p) + 1 }
      return m
    }
  }

  // MARK: search

  /// The hits of `q` found (once a question) and drawn; the `k`th on page `page` the current one, brought into view.
  func find(_ q: String, page: Int?, k: Int?) {
    let q = q.trimmingCharacters(in: .whitespaces)
    pendingCurrent = page.map { ($0, k ?? 0) }
    if q.isEmpty { findQ = ""; hits = [:]; current = nil; drawHits(); return }
    if q == findQ && !finding { setCurrent(); return }
    if q == findQ { return }
    findQ = q
    finding = true
    hits = [:]
    drawHits()
    let path = surface?.path ?? ""
    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      // (a document of its own: PDFKit's is not to be read from two threads)
      var found: [Int: [[CGRect]]] = [:]
      if let d = PDFDocument(url: URL(fileURLWithPath: path)) {
        for sel in d.findString(q, withOptions: [.caseInsensitive, .diacriticInsensitive]) {
          guard let page = sel.pages.first else { continue }
          let n = d.index(for: page) + 1
          found[n, default: []].append(sel.selectionsByLine().map { $0.bounds(for: page) })
        }
      }
      DispatchQueue.main.async {
        guard let self = self, self.findQ == q else { return }
        self.hits = found
        self.finding = false
        self.setCurrent()
      }
    }
  }

  private func setCurrent() {
    current = nil
    if let (n, k) = pendingCurrent, let on = hits[n], !on.isEmpty { current = (n, min(k, on.count - 1)) }
    drawHits()
    // the current hit into view: a third of the way down, where it is not in view already
    guard let (n, k) = current, let s = surface, let rects = hits[n]?[k], let r0 = rects.first else { return }
    let f = s.frames[n - s.first]
    let r = toView(n, r0)
    let v = s.seen
    let inContent = r.offsetBy(dx: f.minX, dy: f.minY)
    if !v.insetBy(dx: 0, dy: v.height * 0.1).contains(inContent) {
      s.go((n, max(0, (r.minY - v.height / 3) / f.height), nil), animated: false)
    }
  }

  /// The hits on the pages there are, the current one stronger.
  func drawHits() {
    guard let s = surface else { return }
    CATransaction.begin(); CATransaction.setDisableActions(true)
    for (n, pv) in s.views {
      let all = UIBezierPath(), cur = UIBezierPath()
      for (i, hit) in (hits[n] ?? []).enumerated() {
        for r in hit { (current.map { $0 == (n, i) } ?? false ? cur : all).append(UIBezierPath(rect: toView(n, r).insetBy(dx: -1, dy: -1))) }
      }
      pv.marks("hits", color: UIColor(red: 1, green: 0.85, blue: 0.2, alpha: 0.35)).path = all.cgPath
      pv.marks("hit", color: UIColor(red: 1, green: 0.6, blue: 0.1, alpha: 0.55)).path = cur.cgPath
    }
    CATransaction.commit()
  }

  /// A page come into view gets what is drawn on it.
  func pageShown() {
    select(selection)
    drawHits()
  }

  var hitCount: Int { hits.values.reduce(0) { $0 + $1.count } }
}

@available(iOS 16.0, *)
final class PdfMenu: NSObject, UIEditMenuInteractionDelegate {
  weak var text: PdfText?
  init(text: PdfText) { self.text = text }
  func editMenuInteraction(_ interaction: UIEditMenuInteraction, menuFor configuration: UIEditMenuConfiguration, suggestedActions: [UIMenuElement]) -> UIMenu? {
    guard let t = text, t.selection != nil else { return nil }
    let act = { [weak t] (what: String) in t?.act(what) }
    return UIMenu(children: [
      UIAction(title: "copy") { _ in act("copy") },
      UIAction(title: "passage") { _ in act("passage") },
      UIAction(title: "card") { _ in act("card") },
    ])
  }

  func editMenuInteraction(_ interaction: UIEditMenuInteraction, targetRectFor configuration: UIEditMenuConfiguration) -> CGRect {
    text?.menuRect() ?? .null
  }

}
