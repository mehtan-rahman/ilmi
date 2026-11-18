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
  var margin: Double?
  var top: Double
  /// The sheets run on as one.
  var run: Bool
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
  /// The strokes of the sheet before, which may run past its foot onto this one (a pageless notebook's).
  var above: [Geom]
  /// The part of the sheet, in its points, and the pixels it is drawn with.
  var region: CGRect
  var pw: Int
  var ph: Int
  /// No paper under the ink: what the lasso holds, lifted off the sheet.
  var bare = false
}

enum Paint {
  static func cg(_ hex: String, _ fallback: UIColor = .white) -> CGColor { (colour(hex) ?? fallback).cgColor }

  /// Where a paper's lines are, in the sheet's points: as `paperLines` has them.
  static func lines(_ p: PaperArgs, index: Int) -> (rows: [Double], cols: [Double], margin: Double?, dots: (xs: [Double], ys: [Double])?) {
    let step = max(2, p.rule)
    let at = p.run ? Double(index) * p.h : 0
    func steps(_ from: Double, _ to: Double) -> [Double] {
      var out: [Double] = []
      var v = from
      while v <= to + 1e-6 { out.append(v); v += step }
      return out
    }
    func running(_ first: Double) -> [Double] {
      let k = max(0, ((at - first) / step - 1e-9).rounded(.up))
      var out: [Double] = []
      var v = first + k * step - at
      while v < p.h - 1e-6 { out.append(v); v += step }
      return out
    }
    let offX = p.w.truncatingRemainder(dividingBy: step) / 2
    let offY = p.h.truncatingRemainder(dividingBy: step) / 2
    switch p.kind {
    case "ruled":
      let m = p.margin.flatMap { $0 > 0 && $0 < p.w ? $0 : nil }
      return (p.run ? running(p.top) : steps(p.top, p.h - step), [], m, nil)
    case "grid":
      return (p.run ? running(offY) : steps(offY, p.h - offY), steps(offX, p.w - offX), nil, nil)
    case "dotted":
      return ([], [], nil, (steps(offX + step, p.w - offX - step), p.run ? running(offY + step) : steps(offY + step, p.h - offY - step)))
    default:
      return ([], [], nil, nil)
    }
  }

  /// The picture a job asks for. Any thread.
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
      func row(_ y: Double) -> CGFloat { ((CGFloat(y) - j.region.minY) * sy - wide / 2).rounded() }
      func col(_ x: Double) -> CGFloat { ((CGFloat(x) - j.region.minX) * sx - wide / 2).rounded() }
      // (a picture is drawn from its foot up)
      func down(_ y: CGFloat, _ h: CGFloat) -> CGFloat { CGFloat(j.ph) - y - h }
      c.setFillColor(cg(j.look.rule, .lightGray))
      for y in l.rows { let at = row(y); if at > -wide, at < CGFloat(j.ph) { c.fill(CGRect(x: 0, y: down(at, wide), width: CGFloat(j.pw), height: wide)) } }
      for x in l.cols { let at = col(x); if at > -wide, at < CGFloat(j.pw) { c.fill(CGRect(x: at, y: 0, width: wide, height: CGFloat(j.ph))) } }
      if let m = l.margin {
        c.setFillColor(cg(j.look.margin, .lightGray))
        let at = col(m)
        if at > -wide, at < CGFloat(j.pw) { c.fill(CGRect(x: at, y: 0, width: wide, height: CGFloat(j.ph))) }
      }
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
    }
    // the ink, in the sheet's points from its top left: it lies on the paper as ink does, a highlighter leaving what is under it dark
    c.translateBy(x: 0, y: CGFloat(j.ph))
    c.scaleBy(x: sx, y: -sy)
    c.translateBy(x: -j.region.minX, y: -j.region.minY)
    // (one layer of ink laid on the paper: within it a stroke over another is over it, a highlighter's under the rest)
    if !j.bare {
      c.setBlendMode(j.look.dark ? .screen : .multiply)
      c.beginTransparencyLayer(auxiliaryInfo: nil)
    }
    let part = j.region.offsetBy(dx: 0, dy: CGFloat(j.paper.h))
    for pass in 0..<2 {
      if !j.above.isEmpty {
        c.saveGState()
        c.translateBy(x: 0, y: -CGFloat(j.paper.h))
        for g in j.above where g.marker == (pass == 0) && g.box.intersects(part) { g.draw(c) }
        c.restoreGState()
      }
      for g in j.strokes where g.marker == (pass == 0) && g.box.intersects(j.region) { g.draw(c) }
    }
    if !j.bare { c.endTransparencyLayer() }
    return c.makeImage()
  }
}
