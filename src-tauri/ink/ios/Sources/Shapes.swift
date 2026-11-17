// A stroke held still at its end is a shape (milestone 85): a straight line, an arrow, a rectangle, an ellipse.
//
// PencilKit gives no way to its own shape recognition through a canvas whose recogniser is on another view, so
// this is ours, on the finished stroke's points: what was drawn is looked at once, when the Pencil lifts after
// resting where it stopped, and the stroke is put down again as the shape it most nearly was, in the same ink.
// It is kept narrow on purpose. Nothing is looked at unless the Pencil rested; nothing smaller than a word is a
// shape; a line is a line only when it hardly leaves its chord, a rectangle and an ellipse only when they close,
// stand upright and keep to their outline all the way round. Anything else stays exactly as it was written.
//
// The eraser that takes part of a stroke is here too: a stroke cut where the eraser crossed it, the rest of it
// left as strokes of the same ink.

import PencilKit
import UIKit

enum Shape: Equatable {
  case line(CGPoint, CGPoint)
  case arrow(CGPoint, CGPoint)
  case rect(CGRect)
  case ellipse(CGRect)

  var name: String {
    switch self {
    case .line: return "line"
    case .arrow: return "arrow"
    case .rect: return "rectangle"
    case .ellipse: return "ellipse"
    }
  }
}

enum Shapes {
  /// Nothing shorter than this, along the stroke, is a shape: a letter is not.
  static let least: CGFloat = 36

  private static func dist(_ a: CGPoint, _ b: CGPoint) -> CGFloat { hypot(a.x - b.x, a.y - b.y) }

  /// How far `p` is from the line through `a` and `b`, kept to the segment.
  private static func off(_ p: CGPoint, _ a: CGPoint, _ b: CGPoint) -> CGFloat {
    let dx = b.x - a.x, dy = b.y - a.y
    let len = dx * dx + dy * dy
    if len < 0.000001 { return dist(p, a) }
    let t = min(max(((p.x - a.x) * dx + (p.y - a.y) * dy) / len, 0), 1)
    return hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
  }

  private static func length(_ pts: ArraySlice<CGPoint>) -> CGFloat {
    var n: CGFloat = 0
    var last: CGPoint? = nil
    for p in pts {
      if let l = last { n += dist(l, p) }
      last = p
    }
    return n
  }

  /// Whether the points keep to the straight way between their ends.
  private static func straight(_ pts: ArraySlice<CGPoint>) -> Bool {
    guard let a = pts.first, let b = pts.last, pts.count >= 2 else { return false }
    let chord = dist(a, b)
    if chord < 1 { return false }
    let allowed = max(3, chord * 0.035)
    for p in pts where off(p, a, b) > allowed { return false }
    return length(pts) <= chord * 1.06
  }

  /// A line within a few degrees of level or upright is level or upright.
  private static func squared(_ a: CGPoint, _ b: CGPoint) -> (CGPoint, CGPoint) {
    let dx = abs(b.x - a.x), dy = abs(b.y - a.y)
    let lean: CGFloat = 0.06
    if dy <= dx * lean { let y = (a.y + b.y) / 2; return (CGPoint(x: a.x, y: y), CGPoint(x: b.x, y: y)) }
    if dx <= dy * lean { let x = (a.x + b.x) / 2; return (CGPoint(x: x, y: a.y), CGPoint(x: x, y: b.y)) }
    return (a, b)
  }

  /// The shape the points of a stroke make, in the order they were drawn; nil for anything that is not plainly one.
  /// `closed` false looks for a line alone (a highlighter's).
  static func find(_ pts: [CGPoint], closed: Bool = true) -> Shape? {
    guard pts.count >= 4 else { return nil }
    let all = pts[...]
    let total = length(all)
    if total < least { return nil }
    let a = pts[0], b = pts[pts.count - 1]
    if straight(all) {
      let (p, q) = squared(a, b)
      return .line(p, q)
    }
    if !closed { return nil }
    var box = CGRect(origin: a, size: .zero)
    for p in pts { box = box.union(CGRect(origin: p, size: .zero)) }
    // ── an arrow: a straight shaft, then a short head drawn back from its tip and returned to it or past it ──
    var tip = 0
    var far: CGFloat = 0
    for (i, p) in pts.enumerated() {
      let d = dist(a, p)
      if d > far { far = d; tip = i }
    }
    if tip >= 3, tip < pts.count - 2, far >= least, straight(pts[0...tip]) {
      let head = pts[tip...]
      let headLen = length(head)
      var reach: CGFloat = 0
      for p in head { reach = max(reach, dist(p, pts[tip])) }
      // the head is drawn near the tip, both ways off the shaft, and is short beside it
      var left = false, right = false
      let dx = pts[tip].x - a.x, dy = pts[tip].y - a.y
      for p in head {
        let side = dx * (p.y - a.y) - dy * (p.x - a.x)
        if side > far * 2 { left = true }
        if side < -far * 2 { right = true }
      }
      if headLen >= far * 0.12, headLen <= far * 0.9, reach <= far * 0.45, reach >= 5, left, right {
        let (p, q) = squared(a, pts[tip])
        return .arrow(p, q)
      }
    }
    // ── closed: it ends where it began ──
    let w = box.width, h = box.height
    let small = min(w, h)
    if small < 18 || dist(a, b) > max(10, total * 0.09) { return nil }
    // an ellipse upright in its box: every point near the ellipse the box holds
    let cx = box.midX, cy = box.midY, rx = w / 2, ry = h / 2
    var sum: CGFloat = 0, worst: CGFloat = 0
    for p in pts {
      let e = abs(sqrt(pow((p.x - cx) / rx, 2) + pow((p.y - cy) / ry, 2)) - 1)
      sum += e
      worst = max(worst, e)
    }
    let ellipseMean = sum / CGFloat(pts.count)
    // a rectangle upright in its box: every point near a side, and each corner come to
    var rsum: CGFloat = 0, rworst: CGFloat = 0
    for p in pts {
      let e = min(min(abs(p.x - box.minX), abs(p.x - box.maxX)), min(abs(p.y - box.minY), abs(p.y - box.maxY))) / small
      rsum += e
      rworst = max(rworst, e)
    }
    let rectMean = rsum / CGFloat(pts.count)
    var corners = 0
    for c in [CGPoint(x: box.minX, y: box.minY), CGPoint(x: box.maxX, y: box.minY), CGPoint(x: box.maxX, y: box.maxY), CGPoint(x: box.minX, y: box.maxY)] {
      if pts.contains(where: { dist($0, c) <= small * 0.16 }) { corners += 1 }
    }
    // once round, no more: a scribble's length is far over its outline's
    let rectRound = 2 * (w + h)
    let ellipseRound = CGFloat.pi * (3 * (rx + ry) - sqrt((3 * rx + ry) * (rx + 3 * ry)))
    let isRect = corners == 4 && rectMean <= 0.045 && rworst <= 0.14 && total <= rectRound * 1.12 && total >= rectRound * 0.85
    let isEllipse = ellipseMean <= 0.07 && worst <= 0.2 && total <= ellipseRound * 1.15 && total >= ellipseRound * 0.85
    if isRect && (!isEllipse || rectMean < ellipseMean) { return .rect(box) }
    if isEllipse {
      // nearly round is round
      if abs(w - h) <= max(w, h) * 0.08 {
        let d = (w + h) / 2
        return .ellipse(CGRect(x: cx - d / 2, y: cy - d / 2, width: d, height: d))
      }
      return .ellipse(box)
    }
    return nil
  }

  // ── a shape as strokes ──

  /// A stroke's points as they lie in the drawing, one every `by` points along it.
  static func points(of k: PKStroke, by: CGFloat = 2) -> [CGPoint] {
    let path = k.path
    if path.count == 0 { return [] }
    if path.count == 1 { return [path[0].location.applying(k.transform)] }
    return path.interpolatedPoints(by: .distance(max(by, 0.5))).map { $0.location.applying(k.transform) }
  }

  /// What a stroke's points are like, taken from its middle: a shape is drawn as that.
  private static func like(_ k: PKStroke) -> PKStrokePoint {
    let path = k.path
    if path.count == 0 { return PKStrokePoint(location: .zero, timeOffset: 0, size: CGSize(width: 3, height: 3), opacity: 1, force: 1, azimuth: 0, altitude: .pi / 2) }
    var sizes = path.map { ($0.size.width + $0.size.height) / 2 }
    sizes.sort()
    let m = path[path.count / 2]
    let s = sizes[sizes.count / 2]
    return PKStrokePoint(location: .zero, timeOffset: 0, size: CGSize(width: s, height: s), opacity: max(m.opacity, 0.9), force: m.force, azimuth: m.azimuth, altitude: m.altitude)
  }

  /// A stroke through `corners`, straight between them and sharp at each: a point every few points along, each
  /// corner said three times (the path is a spline, and rounds what is said once).
  private static func poly(_ corners: [CGPoint], like m: PKStrokePoint, ink: PKInk, at date: Date) -> PKStroke {
    var out: [PKStrokePoint] = []
    var t: TimeInterval = 0
    func add(_ p: CGPoint) {
      out.append(PKStrokePoint(location: p, timeOffset: t, size: m.size, opacity: m.opacity, force: m.force, azimuth: m.azimuth, altitude: m.altitude))
      t += 0.004
    }
    for (i, c) in corners.enumerated() {
      add(c); add(c); add(c)
      if i + 1 < corners.count {
        let n = corners[i + 1]
        let steps = max(1, Int(dist(c, n) / 6))
        for s in 1..<max(steps, 2) where steps > 1 {
          let f = CGFloat(s) / CGFloat(steps)
          add(CGPoint(x: c.x + (n.x - c.x) * f, y: c.y + (n.y - c.y) * f))
        }
      }
    }
    return PKStroke(ink: ink, path: PKStrokePath(controlPoints: out, creationDate: date), transform: .identity, mask: nil)
  }

  /// The strokes that draw `shape` in the ink and the weight of `k`, the stroke it was recognised from.
  static func strokes(_ shape: Shape, from k: PKStroke) -> [PKStroke] {
    let m = like(k)
    let date = k.path.creationDate
    switch shape {
    case let .line(a, b):
      return [poly([a, b], like: m, ink: k.ink, at: date)]
    case let .arrow(a, b):
      let len = dist(a, b)
      let head = min(max(len * 0.18, 9), 26)
      let ang = atan2(b.y - a.y, b.x - a.x)
      let spread: CGFloat = 0.5
      let l = CGPoint(x: b.x - head * cos(ang - spread), y: b.y - head * sin(ang - spread))
      let r = CGPoint(x: b.x - head * cos(ang + spread), y: b.y - head * sin(ang + spread))
      return [poly([a, b], like: m, ink: k.ink, at: date), poly([l, b, r], like: m, ink: k.ink, at: date.addingTimeInterval(0.001))]
    case let .rect(box):
      let c = [CGPoint(x: box.minX, y: box.minY), CGPoint(x: box.maxX, y: box.minY), CGPoint(x: box.maxX, y: box.maxY), CGPoint(x: box.minX, y: box.maxY), CGPoint(x: box.minX, y: box.minY)]
      return [poly(c, like: m, ink: k.ink, at: date)]
    case let .ellipse(box):
      let rx = box.width / 2, ry = box.height / 2
      let n = max(48, Int((rx + ry) * 0.6))
      var out: [PKStrokePoint] = []
      // once round and a little over, so the spline closes on itself
      for i in 0...(n + 3) {
        let a = CGFloat(i) / CGFloat(n) * 2 * .pi - .pi / 2
        out.append(PKStrokePoint(location: CGPoint(x: box.midX + rx * cos(a), y: box.midY + ry * sin(a)), timeOffset: TimeInterval(i) * 0.004, size: m.size, opacity: m.opacity, force: m.force, azimuth: m.azimuth, altitude: m.altitude))
      }
      return [PKStroke(ink: k.ink, path: PKStrokePath(controlPoints: out, creationDate: date), transform: .identity, mask: nil)]
    }
  }

  // ── the eraser that takes part of a stroke ──

  private static func far(_ p: CGPoint, from a: CGPoint, to b: CGPoint) -> CGFloat { off(p, a, b) }

  /// `k` with what lies within `r` of the way from `a` to `b` taken out of it: nil when the eraser did not come
  /// upon it, else what is left of it, as strokes of its own ink (none, when all of it went).
  static func cut(_ k: PKStroke, from a: CGPoint, to b: CGPoint, within r: CGFloat) -> [PKStroke]? {
    let path = k.path
    if path.count == 0 { return nil }
    let back = k.transform.inverted()
    // the eraser in the stroke's own points, so what is left keeps its transform
    let scale = max(sqrt(abs(k.transform.a * k.transform.d - k.transform.b * k.transform.c)), 0.0001)
    let la = a.applying(back), lb = b.applying(back), lr = r / scale
    let step = max(0.75, min(2, lr / 3))
    let pts: [PKStrokePoint] = path.count == 1 ? [path[0]] : Array(path.interpolatedPoints(by: .distance(step)))
    var runs: [[PKStrokePoint]] = []
    var run: [PKStrokePoint] = []
    var hit = false
    for p in pts {
      let half = (p.size.width + p.size.height) / 4
      if far(p.location, from: la, to: lb) <= lr + half * 0.5 {
        hit = true
        if run.count >= 2 { runs.append(run) }
        run = []
      } else {
        run.append(p)
      }
    }
    if !hit { return nil }
    if run.count >= 2 { runs.append(run) }
    return runs.enumerated().compactMap { i, r in
      // a crumb shorter than its own width is nothing to keep
      var len: CGFloat = 0
      for j in 1..<r.count { len += dist(r[j - 1].location, r[j].location) }
      let width = (r[0].size.width + r[0].size.height) / 2
      if len < max(1.5, width * 0.6) { return nil }
      // the ends said again, so the piece reaches them
      let ctl = [r[0]] + r + [r[r.count - 1]]
      return PKStroke(ink: k.ink, path: PKStrokePath(controlPoints: ctl, creationDate: path.creationDate.addingTimeInterval(Double(i) * 0.0001)), transform: k.transform, mask: k.mask)
    }
  }
}
