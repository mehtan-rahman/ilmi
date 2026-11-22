// What a written notebook's sheet looks like, drawn here (milestone 87): its paper, and its ink at rest.
//
// The ink is drawn by `native/stroke.m` (an outline a stroke, filled by Core Graphics: an edge about a pixel of the
// screen, where PencilKit's is nearly two), the paper by the measures `src/app/paper.ts` has. Both go into one
// picture, so they cannot part; a picture is made off the main thread from things that no longer change (a `Geom` a
// stroke, the paper's numbers) and shown when it is done.

import PencilKit
import UIKit

@_silgen_name("ilmi_stroke_make") private func c_stroke_make(_ stroke: UnsafeRawPointer, _ dark: Int32) -> UnsafeMutableRawPointer?
@_silgen_name("ilmi_stroke_free") private func c_stroke_free(_ made: UnsafeMutableRawPointer)
@_silgen_name("ilmi_stroke_draw") private func c_stroke_draw(_ made: UnsafeMutableRawPointer, _ c: CGContext)
@_silgen_name("ilmi_stroke_box") private func c_stroke_box(_ made: UnsafeMutableRawPointer, _ out: UnsafeMutablePointer<Double>)
@_silgen_name("ilmi_stroke_ours") private func c_stroke_ours(_ made: UnsafeMutableRawPointer) -> Int32
@_silgen_name("ilmi_stroke_marker") private func c_stroke_marker(_ made: UnsafeMutableRawPointer) -> Int32
@_silgen_name("ilmi_stroke_page_picture") private func c_stroke_page_picture(_ made: UnsafeMutableRawPointer, _ box: UnsafeMutablePointer<Double>) -> Unmanaged<CGImage>?
@_silgen_name("ilmi_stroke_turns") private func c_stroke_turns(_ made: UnsafeMutableRawPointer, _ k: Double, _ out: UnsafeMutablePointer<Double>) -> Int32
@_silgen_name("ilmi_stroke_tune") func ilmi_stroke_tune(_ step: Double, _ flat: Double, _ even: Double)
@_silgen_name("ilmi_stroke_places") private func c_stroke_places(_ made: UnsafeMutableRawPointer, _ out: UnsafeMutablePointer<Double>, _ most: Int32) -> Int32
@_silgen_name("ilmi_stroke_evening") private func c_stroke_evening(_ made: UnsafeMutableRawPointer, _ out: UnsafeMutablePointer<Double>)
@_silgen_name("ilmi_stroke_seed_mark") func ilmi_stroke_seed_mark(_ seed: UInt32) -> UInt32
@_silgen_name("ilmi_stroke_outline") private func c_stroke_outline(_ made: UnsafeMutableRawPointer, _ path: UnsafeMutablePointer<UnsafeRawPointer?>, _ rgba: UnsafeMutablePointer<Double>, _ round: UnsafeMutablePointer<Double>, _ alpha: UnsafeMutablePointer<Double>) -> Int32

/// A stroke made ready to be drawn, on any thread, as often as it is asked.
final class Geom {
  fileprivate let made: UnsafeMutableRawPointer
  /// What it covers, in the drawing's points.
  let box: CGRect
  /// Its outline is ilmi's own; false for an ink PencilKit draws a picture of (a fountain pen, a pencil).
  let ours: Bool
  /// A highlighter's stroke: it lies under every other.
  let marker: Bool

  init?(_ k: PKStroke, dark: Bool) {
    let ref = k as PKStrokeReference
    guard let m = withExtendedLifetime(ref, { c_stroke_make(UnsafeRawPointer(Unmanaged.passUnretained(ref).toOpaque()), dark ? 1 : 0) }) else { return nil }
    made = m
    var b = [Double](repeating: 0, count: 4)
    c_stroke_box(m, &b)
    box = CGRect(x: b[0], y: b[1], width: b[2], height: b[3])
    ours = c_stroke_ours(m) != 0
    marker = c_stroke_marker(m) != 0
  }

  deinit { c_stroke_free(made) }

  func draw(_ c: CGContext) { c_stroke_draw(made, c) }

  /// How smooth its outline is on the glass at `k` pixels to the point (`ilmi_stroke_turns`): the largest turn and the 99th, in degrees.
  /// The middle of its outline as drawn (a pen's or the even line's): `x, y, radius` each, in the drawing's points.
  func places() -> [Double] {
    var out = [Double](repeating: 0, count: 3 * 20000)
    let n = Int(c_stroke_places(made, &out, 20000))
    return Array(out.prefix(3 * min(n, 20000)))
  }

  /// The step its points were found rounded to and the sigma its middle was evened by (`ilmi_stroke_evening`).
  func evening() -> [Double] {
    var o = [0.0, 0.0]
    c_stroke_evening(made, &o)
    return o
  }

  func turns(at k: Double) -> [Double] {
    var o = [0.0, 0.0]
    _ = c_stroke_turns(made, k, &o)
    return o
  }

  /// For an ink PencilKit draws a picture of: the picture the page is given of it, and the drawing's points it covers.
  func pagePicture() -> (image: CGImage, box: CGRect)? {
    var b = [Double](repeating: 0, count: 4)
    guard let img = c_stroke_page_picture(made, &b)?.takeRetainedValue() else { return nil }
    return (img, CGRect(x: b[0], y: b[1], width: b[2], height: b[3]))
  }

  /// Its outline as `draw` fills it, for a layer that shows it (the stroke being written, `Live.swift`): the path in
  /// the drawing's points, its colour, and a highlighter's half thickness and how much of it is laid on. Nil for an
  /// ink PencilKit draws a picture of.
  func outline() -> (path: CGPath, colour: CGColor, round: CGFloat, alpha: CGFloat)? {
    var p: UnsafeRawPointer?
    var k = [Double](repeating: 0, count: 4)
    var r = 0.0, a = 1.0
    guard c_stroke_outline(made, &p, &k, &r, &a) != 0, let raw = p else { return nil }
    let path = Unmanaged<CGPath>.fromOpaque(raw).takeRetainedValue()
    let colour = CGColor(colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!, components: k.map { CGFloat($0) }) ?? UIColor.black.cgColor
    return (path, colour, CGFloat(r), CGFloat(a))
  }
}

/// What tells one stroke from another without walking it: when it was made, where it starts and ends, how it lies, its ink.
struct StrokeMark: Hashable {
  let at: Double
  let n: Int
  let a: [Float]
  let ink: String
  let colour: [Float]
  let masked: Bool

  init(_ k: PKStroke) {
    let p = k.path
    at = p.creationDate.timeIntervalSinceReferenceDate
    n = p.count
    let t = k.transform
    var v: [Float] = [Float(t.a), Float(t.b), Float(t.c), Float(t.d), Float(t.tx), Float(t.ty)]
    if let f = p.first, let l = p.last {
      v += [Float(f.location.x), Float(f.location.y), Float(l.location.x), Float(l.location.y), Float(f.size.width), Float(l.size.width)]
    }
    a = v
    ink = k.ink.inkType.rawValue
    var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, o: CGFloat = 0
    k.ink.color.getRed(&r, green: &g, blue: &b, alpha: &o)
    colour = [Float(r), Float(g), Float(b), Float(o)]
    masked = k.mask != nil
  }
}

/// A sheet's paper, as the page says it (`paperOf`, `paperLook` in `src/app/paper.ts`).
struct PaperArgs: Codable, Equatable {
  /// `blank`, `ruled`, `grid` or `dotted`.
  var kind: String
  /// The sheet, in points.
  var w: Double
  var h: Double
  var rule: Double
  /// The margins (88): how far in from the left edge and from the right the ruling begins and ends; 0 for none.
  var left: Double
  var right: Double
  /// How far down a ruled sheet its first rule is; the room a grid or dots keep at the head.
  var top: Double
  /// The room under a ruled page's last rule; what a grid or dots keep at the foot.
  var bottom: Double
  /// Where a line is drawn down the sheet, each from the left edge.
  var lines: [Double]
  /// The sheets run on as one.
  var run: Bool

  /// How much bare paper a pageless notebook keeps under the lowest thing written on it, in points (`RUN_ALLOW`).
  static let allow = 192.0

  /// How long a pageless notebook's one sheet is drawn, the lowest thing written on it `foot` points down it: as `runLength` has it.
  func runLength(foot: Double) -> Double {
    let need = (foot.isFinite ? max(0, foot) : 0) + PaperArgs.allow
    // (what fits on one sheet is one sheet, whole)
    if need <= h { return h }
    let step = kind == "blank" ? 24 : max(2, rule)
    // where the ruling begins down the long sheet, and what a grid that runs to the sheet's edges keeps clear at each
    var first = 0.0, edge = 0.0
    if kind == "ruled" {
      first = top.truncatingRemainder(dividingBy: step)
    } else if kind == "grid" || kind == "dotted" {
      edge = top > 0 ? 0 : h.truncatingRemainder(dividingBy: step) / 2
      first = top > 0 ? top.truncatingRemainder(dividingBy: step) : edge
    }
    return ((first + ((need - first - edge) / step - 1e-9).rounded(.up) * step + edge) * 1000).rounded() / 1000
  }
}

struct LookArgs: Decodable, Equatable {
  var paper: String
  var rule: String
  var dot: String
  var margin: String
  /// What lies round the sheets.
  var desk: String
  /// The paper is dark: ink is drawn as PencilKit shows it on a dark canvas, and lightens what is under it.
  var dark: Bool
  /// What a passage's box and its tag are drawn in, and the words of a tag and of `add page`.
  var accent: String
  var fg: String
  var line: String
  var tag: String
}

/// One picture to make: part of a sheet, so many pixels.
struct PaintJob {
  var paper: PaperArgs
  var look: LookArgs
  /// Which sheet of the notebook it is, from 0: where a pageless notebook's ruling has got to.
  var index: Int
  var strokes: [Geom]
  /// The strokes of the sheets before that run past their own foot onto this one (a pageless notebook's), each
  /// with how far up its sheet's top lies from this one's, in points: one sheet's height for the sheet before, two
  /// for the one before that (a stroke may be taller than a sheet).
  var above: [(g: Geom, up: CGFloat)]
  /// The part of the sheet, in its points, and the pixels it is drawn with.
  var region: CGRect
  var pw: Int
  var ph: Int
  /// No paper under the ink: what the lasso holds, lifted off the sheet.
  var bare = false
}

enum Paint {
  static func cg(_ hex: String, _ fallback: UIColor = .white) -> CGColor { (colour(hex) ?? fallback).cgColor }

  /// Where a paper's lines are, in the sheet's points: as `paperLines` has them. The ruling lies between the margins;
  /// `rowSpan` is how far across the sheet each row is drawn, `colSpan` how far down it each column.
  static func lines(_ p: PaperArgs, index: Int) -> (rows: [Double], rowSpan: (Double, Double), cols: [Double], colSpan: (Double, Double), margins: [Double], dots: (xs: [Double], ys: [Double])?) {
    let step = max(2, p.rule)
    let at = p.run ? Double(index) * p.h : 0
    func r3(_ v: Double) -> Double { (v * 1000).rounded() / 1000 }
    func steps(_ from: Double, _ to: Double) -> [Double] {
      var out: [Double] = []
      var v = from
      while v <= to + 1e-6 { out.append(r3(v)); v += step }
      return out
    }
    func running(_ first: Double) -> [Double] {
      let k = max(0, ((at - first) / step - 1e-9).rounded(.up))
      var out: [Double] = []
      var v = first + k * step - at
      // (a line at the sheet's very foot is the next sheet's first too: both draw their part of it)
      while v <= p.h + 1e-6 { out.append(r3(v)); v += step }
      return out
    }
    let x0 = p.left, x1 = p.w - p.right
    switch p.kind {
    case "ruled":
      return (p.run ? running(p.top) : steps(p.top, p.h - p.bottom), (x0, x1), [], (0, p.h), p.lines, nil)
    case "grid", "dotted":
      let head = p.top > 0, foot = !p.run && p.bottom > 0
      let offX = (x1 - x0).truncatingRemainder(dividingBy: step) / 2
      let xs = steps(x0 + offX, x1 - offX)
      var ys: [Double]
      if p.run {
        ys = running(head ? p.top : p.h.truncatingRemainder(dividingBy: step) / 2)
      } else {
        let y0 = p.top, y1 = p.h - p.bottom
        let offY = (y1 - y0).truncatingRemainder(dividingBy: step) / 2
        ys = steps(y0 + offY, y1 - offY)
      }
      // (each line ends on the grid's outermost line at an edge that has a margin, and runs to the sheet's edge at one that has none)
      let colSpan: (Double, Double) = p.run ? (head && at < p.top ? r3(p.top - at) : 0, p.h) : (head && !ys.isEmpty ? ys[0] : 0, foot && !ys.isEmpty ? ys[ys.count - 1] : p.h)
      let rowSpan: (Double, Double) = (p.left > 0 && !xs.isEmpty ? xs[0] : 0, p.right > 0 && !xs.isEmpty ? xs[xs.count - 1] : p.w)
      if p.kind == "grid" { return (ys, rowSpan, xs, colSpan, p.lines, nil) }
      let dx = Array(xs.dropFirst(p.left > 0 ? 0 : 1).dropLast(p.right > 0 ? 0 : 1))
      let dy = p.run ? (head ? ys : running(p.h.truncatingRemainder(dividingBy: step) / 2 + step)) : Array(ys.dropFirst(head ? 0 : 1).dropLast(foot ? 0 : 1))
      return ([], rowSpan, [], colSpan, p.lines, (dx, dy))
    default:
      return ([], (x0, x1), [], (0, p.h), p.lines, nil)
    }
  }

  /// The picture a job asks for. Any thread.
  /// How much wider than its outline a pen's stroke is drawn, in the picture's pixels: the stroke being written is
  /// drawn by the screen (a shape, `Live.swift`), whose edge reaches about this much past the outline, so a thin
  /// stroke kept came out a little paler than written (2026-11-22, `inksharp`: 0.04 to 0.2 px; 0.18 made it heavier than written at most zooms, 0.08 is within a few hundredths either way).
  static var edgeGrow: CGFloat = 0.08

  /// Strokes laid on what is drawn in `c` already (a book's page): highlighters multiplied, so the print stays dark
  /// under them, then pens over, each a hair wider (`edge`). `c` maps the sheet's points, `px` pixels to one.
  static func lay(_ strokes: [Geom], in c: CGContext, region: CGRect, px: CGFloat) {
    c.saveGState()
    c.setBlendMode(.multiply)
    for g in strokes where g.marker && g.box.intersects(region) { g.draw(c) }
    c.setBlendMode(.normal)
    for g in strokes where !g.marker && g.box.intersects(region) { g.draw(c); edge(g, c, px) }
    c.restoreGState()
  }

  /// How many times its pixels a picture's ink is drawn at, to be brought down to them: where a picture has few pixels
  /// to a point of the sheet (zoomed out, or at a small sheet's fit) a line comes out thinner than a pixel or two,
  /// and drawn at the picture's own pixels its edge steps (2026-11-22, the iPad: "whenever i write something small
  /// and then zoom out, it looks a little bit jaggedy"); drawn at twice them and brought down, it is as smooth as a
  /// book's ink seen from its finer tiles. Only for a picture of four million pixels or fewer (a tile; never a whole
  /// page's picture, which would want four times its memory).
  /// Only below one and a half pixels to the point (zoomed out past a page's fit): about a fit (a page of a book is
  /// near two at it) a stroke drawn so came out heavier or paler than the screen draws it written (`inksharp`, a
  /// 1 pt pen 2.7 px of ink kept, 2.35 live), and does not step.
  static func superK(px: CGFloat, pw: Int, ph: Int) -> Int { px < 1.5 && pw * ph <= 4_000_000 ? 2 : 1 }

  /// The strokes `draw` draws (in a context mapping the sheet's points, and its pixels to one), drawn at `k` times the
  /// picture's pixels into a clear picture of their own and laid on `c` (its own pixels, from its foot) with `mode`.
  /// Only the part `box` (the strokes' bounds, the sheet's points) covers is drawn so: the rest has no ink.
  static func superPass(_ c: CGContext, pw: Int, ph: Int, region: CGRect, k: Int, box: CGRect, mode: CGBlendMode, draw: (CGContext, CGFloat) -> Void) {
    let ppx = CGFloat(pw) / region.width, ppy = CGFloat(ph) / region.height
    // the box in the picture's pixels from its top left, on whole pixels, a pixel about it
    let b = box.intersection(region)
    if b.isNull || b.isEmpty { return }
    let x0 = max(0, ((b.minX - region.minX) * ppx).rounded(.down) - 1), y0 = max(0, ((b.minY - region.minY) * ppy).rounded(.down) - 1)
    let x1 = min(CGFloat(pw), ((b.maxX - region.minX) * ppx).rounded(.up) + 1), y1 = min(CGFloat(ph), ((b.maxY - region.minY) * ppy).rounded(.up) + 1)
    if x1 <= x0 || y1 <= y0 { return }
    let W = Int(x1 - x0) * k, H = Int(y1 - y0) * k
    let space = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()
    guard let o = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: 0, space: space, bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue) else { return }
    let sx = ppx * CGFloat(k), sy = ppy * CGFloat(k)
    o.translateBy(x: 0, y: CGFloat(H))
    o.scaleBy(x: sx, y: -sy)
    o.translateBy(x: -(region.minX + x0 / ppx), y: -(region.minY + y0 / ppy))
    draw(o, sx)
    guard let img = o.makeImage() else { return }
    c.saveGState()
    c.setBlendMode(mode)
    c.interpolationQuality = .high
    c.draw(img, in: CGRect(x: x0, y: CGFloat(ph) - y1, width: x1 - x0, height: y1 - y0))
    c.restoreGState()
  }

  /// The bounds of some strokes, the sheet's points.
  static func bounds(_ gs: [Geom]) -> CGRect { gs.reduce(CGRect.null) { $0.union($1.box) } }

  /// A pen's stroke widened by `edgeGrow` pixels, as the screen draws it while written.
  static func edge(_ g: Geom, _ c: CGContext, _ px: CGFloat) {
    guard edgeGrow > 0, g.ours, !g.marker, px > 0, let o = g.outline(), o.round == 0 else { return }
    c.saveGState()
    c.addPath(o.path)
    c.setStrokeColor(o.colour)
    c.setLineWidth(edgeGrow / px)
    c.setLineJoin(.round)
    c.strokePath()
    c.restoreGState()
  }

  static func make(_ j: PaintJob) -> CGImage? {
    guard j.pw > 0, j.ph > 0, j.region.width > 0, j.region.height > 0 else { return nil }
    let space = CGColorSpace(name: CGColorSpace.sRGB) ?? CGColorSpaceCreateDeviceRGB()
    let info = (j.bare ? CGImageAlphaInfo.premultipliedFirst.rawValue : CGImageAlphaInfo.noneSkipFirst.rawValue) | CGBitmapInfo.byteOrder32Little.rawValue
    guard let c = CGContext(data: nil, width: j.pw, height: j.ph, bitsPerComponent: 8, bytesPerRow: 0, space: space, bitmapInfo: info) else { return nil }
    let sx = CGFloat(j.pw) / j.region.width, sy = CGFloat(j.ph) / j.region.height
    if !j.bare {
      c.setFillColor(cg(j.look.paper))
      c.fill(CGRect(x: 0, y: 0, width: j.pw, height: j.ph))
      // the paper's lines, in the picture's own pixels from its top left: each on whole pixels, half a point wide and never under one
      let l = lines(j.paper, index: j.index)
      let wide = max(1, (0.5 * sy).rounded())
      // (halves go up, on every sheet alike: the rule that falls exactly where two of a pageless notebook's sheets
      // meet is drawn by both, each its part of it, and the two parts are one line; 88)
      func row(_ y: Double) -> CGFloat { ((CGFloat(y) - j.region.minY) * sy - wide / 2 + 0.5).rounded(.down) }
      func col(_ x: Double) -> CGFloat { ((CGFloat(x) - j.region.minX) * sx - wide / 2 + 0.5).rounded(.down) }
      // (a picture is drawn from its foot up)
      func down(_ y: CGFloat, _ h: CGFloat) -> CGFloat { CGFloat(j.ph) - y - h }
      c.setFillColor(cg(j.look.rule, .lightGray))
      // (each line only as far as it runs on the sheet: from margin to margin, on whole pixels)
      // (where a span ends at a line of the ruling, on that line's own pixels, so a grid's corners close)
      let rx0 = max(0, l.rowSpan.0 > 0 ? col(l.rowSpan.0) : 0), rx1 = min(CGFloat(j.pw), l.rowSpan.1 < j.paper.w ? col(l.rowSpan.1) + wide : ((CGFloat(j.paper.w) - j.region.minX) * sx).rounded(.up))
      let cy0 = max(0, l.colSpan.0 > 0 ? row(l.colSpan.0) : 0), cy1 = min(CGFloat(j.ph), l.colSpan.1 < j.paper.h ? row(l.colSpan.1) + wide : ((CGFloat(j.paper.h) - j.region.minY) * sy).rounded(.up))
      if rx1 > rx0 { for y in l.rows { let at = row(y); if at > -wide, at < CGFloat(j.ph) { c.fill(CGRect(x: rx0, y: down(at, wide), width: rx1 - rx0, height: wide)) } } }
      if cy1 > cy0 { for x in l.cols { let at = col(x); if at > -wide, at < CGFloat(j.pw) { c.fill(CGRect(x: at, y: down(cy0, cy1 - cy0), width: wide, height: cy1 - cy0)) } } }
      if let d = l.dots {
        c.setFillColor(cg(j.look.dot, .lightGray))
        let r = max(0.6, 0.75 * sy)
        for y in d.ys {
          let cy = (CGFloat(y) - j.region.minY) * sy
          if cy < -r || cy > CGFloat(j.ph) + r { continue }
          for x in d.xs {
            let cx = (CGFloat(x) - j.region.minX) * sx
            if cx < -r || cx > CGFloat(j.pw) + r { continue }
            c.fillEllipse(in: CGRect(x: cx - r, y: CGFloat(j.ph) - cy - r, width: r * 2, height: r * 2))
          }
        }
      }
      if !l.margins.isEmpty {
        c.setFillColor(cg(j.look.margin, .lightGray))
        for m in l.margins { let at = col(m); if at > -wide, at < CGFloat(j.pw) { c.fill(CGRect(x: at, y: 0, width: wide, height: CGFloat(j.ph))) } }
      }
    }
    // (few pixels to the point: the ink drawn at twice them and brought down, `superK`)
    let k = superK(px: sx, pw: j.pw, ph: j.ph)
    if k > 1 {
      let mine = j.strokes.filter { $0.box.intersects(j.region) }
      let above = j.above.filter { $0.g.box.intersects(j.region.offsetBy(dx: 0, dy: $0.up)) }
      for pass in 0..<2 {
        let gs = mine.filter { $0.marker == (pass == 0) }
        let us = above.filter { $0.g.marker == (pass == 0) }
        if gs.isEmpty && us.isEmpty { continue }
        let mode: CGBlendMode = j.bare ? .normal : j.look.dark ? .screen : (pass == 0 ? .multiply : .normal)
        let box = us.reduce(bounds(gs)) { $0.union($1.g.box.offsetBy(dx: 0, dy: -$1.up)) }
        superPass(c, pw: j.pw, ph: j.ph, region: j.region, k: k, box: box, mode: mode) { o, px in
          for a in us { o.saveGState(); o.translateBy(x: 0, y: -a.up); a.g.draw(o); o.restoreGState() }
          for g in gs { g.draw(o); if pass == 1 { Paint.edge(g, o, px / CGFloat(k)) } }
        }
      }
      return c.makeImage()
    }
    // the ink, in the sheet's points from its top left: it lies on the paper as ink does, a highlighter leaving what is under it dark
    c.translateBy(x: 0, y: CGFloat(j.ph))
    c.scaleBy(x: sx, y: -sy)
    c.translateBy(x: -j.region.minX, y: -j.region.minY)
    // (one layer of ink laid on the paper: within it a stroke over another is over it, a highlighter's under the rest.
    // On light paper only the highlighters' is laid on as ink is (multiplied: the ruling stays dark under them); a
    // pen's ink, opaque, lies on the paper as it is: laid on through a layer the thinnest strokes came out a little
    // paler than written, which ink on a book's page, laid on by the screen, did not (2026-11-22, `inksharp`))
    let layered = !j.bare && j.look.dark
    if layered {
      c.setBlendMode(.screen)
      c.beginTransparencyLayer(auxiliaryInfo: nil)
    }
    for pass in 0..<2 {
      let marks = !j.bare && !j.look.dark && pass == 0
      if marks {
        c.saveGState()
        c.setBlendMode(.multiply)
        c.beginTransparencyLayer(auxiliaryInfo: nil)
      }
      for a in j.above where a.g.marker == (pass == 0) && a.g.box.intersects(j.region.offsetBy(dx: 0, dy: a.up)) {
        c.saveGState()
        c.translateBy(x: 0, y: -a.up)
        a.g.draw(c)
        c.restoreGState()
      }
      for g in j.strokes where g.marker == (pass == 0) && g.box.intersects(j.region) { g.draw(c); if pass == 1 { Paint.edge(g, c, sx) } }
      if marks {
        c.endTransparencyLayer()
        c.restoreGState()
      }
    }
    if layered { c.endTransparencyLayer() }
    return c.makeImage()
  }
}
