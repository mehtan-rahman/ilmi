// The stroke being written, drawn by ilmi (2026-11-21): the same stroke, the same width, the same colour while the
// Pencil writes as when it has lifted.
//
// PencilKit still takes the Pencil: its canvas, its recogniser (moved onto the web view, or the surface's), its palm
// rejection. But its canvas is given an ink it draws with no colour at all, and what is seen while the Pencil writes is
// drawn here, in a layer inside the canvas (so the canvas's place, size, blend and hiding are the layer's too), from
// the touches the watcher sees: every one the system coalesced between two frames, and those it predicts for the next
// frame, so the line is at the Pencil's tip as soon as PencilKit's own was. The stroke is made as a `PKStroke` from
// those touches, with the ink's own width and the pen's pressure by a mapping fixed at the touch (`width`), and drawn
// by `native/stroke.m`, the code that draws the stroke kept (an outline filled; a fountain pen's and a pencil's,
// PencilKit's own picture of the stroke). When the Pencil lifts, that stroke, without the predicted touches, is the
// one kept: nothing is drawn again, nothing changes at the lift.
//
// `LiveInk.ours = false` (one line, below) gives the stroke being written back to PencilKit's canvas as it was before:
// its own drawing while the Pencil writes, and the stroke it made, reshaped by `InkPlugin.sensed`, kept.

import CoreImage
import PencilKit
import UIKit

final class LiveInk {
  /// The one switch: false, and PencilKit's canvas draws the stroke being written itself, as before 2026-11-21.
  static let ours = true
  /// Whether it is so now: `ours`, unless a dev run measures PencilKit's own against it (`pencilDev` `live-kit`).
  static var on: Bool { ours && !kitForDev }
  static var kitForDev = false
  /// A dev run's: the touch's place as UIKit rounds it, as before 2026-11-22, to compare.
  static var roughForDev = false

  /// The layer the stroke is drawn in, inside the canvas's own.
  private let layer = CALayer()
  /// What is on the glass: the strokes ended and not yet the page's (or the area's), then the one being written.
  private var shown: [CALayer] = []
  private var current: CALayer?
  weak var canvas: PKCanvasView?
  /// Where the stroke kept is drawn by the page itself (a PDF's page): a fountain pen's and a pencil's picture is then
  /// the one the page is given, scaled as the page scales it; else (a notebook's surface) the one its sheets paint.
  var asPage = false

  /// A page in the dark theme draws its ink as in the light and turns it as the page's print is turned
  /// (`invert(0.92) hue-rotate(180deg)`, `pdf.css`): the stroke being written on it is turned the same way, and not as
  /// PencilKit shows a colour on a dark canvas (`stroke.m`'s `colorOf`), which is what a notebook's sheets show.
  /// The page's turn as one matrix on sRGB: invert(0.92) is 0.92 − 0.84c, hue-rotate(180deg) is `hue` (rows sum to 1).
  private static let hue: [[CGFloat]] = [[-0.574, 1.430, 0.144], [0.426, 0.430, 0.144], [0.426, 1.430, -0.856]]
  static func turn(_ c: CGColor) -> CGColor {
    guard let s = c.converted(to: CGColorSpace(name: CGColorSpace.sRGB)!, intent: .defaultIntent, options: nil)?.components, s.count >= 3 else { return c }
    let v = hue.map { row in min(1, max(0, 0.92 - 0.84 * (row[0] * s[0] + row[1] * s[1] + row[2] * s[2]))) }
    return CGColor(colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!, components: v + [s.count > 3 ? s[3] : 1]) ?? c
  }
  private static let ci = CIContext(options: [.workingColorSpace: CGColorSpace(name: CGColorSpace.sRGB)!, .outputColorSpace: CGColorSpace(name: CGColorSpace.sRGB)!])
  static func turn(_ img: CGImage) -> CGImage {
    let m = hue.map { row in row.map { -0.84 * $0 } }
    let f = CIFilter(name: "CIColorMatrix")!
    f.setValue(CIImage(cgImage: img), forKey: kCIInputImageKey)
    f.setValue(CIVector(x: m[0][0], y: m[0][1], z: m[0][2], w: 0), forKey: "inputRVector")
    f.setValue(CIVector(x: m[1][0], y: m[1][1], z: m[1][2], w: 0), forKey: "inputGVector")
    f.setValue(CIVector(x: m[2][0], y: m[2][1], z: m[2][2], w: 0), forKey: "inputBVector")
    f.setValue(CIVector(x: 0, y: 0, z: 0, w: 1), forKey: "inputAVector")
    f.setValue(CIVector(x: 0.92, y: 0.92, z: 0.92, w: 0), forKey: "inputBiasVector")
    guard let out = f.outputImage?.applyingFilter("CIColorClamp"), let made = ci.createCGImage(out, from: CGRect(x: 0, y: 0, width: img.width, height: img.height)) else { return img }
    return made
  }

  // the stroke being written
  private var points: [PKStrokePoint] = []
  private var began: TimeInterval = 0
  private var made = Date()
  /// The touches of the stroke being written as they came, for the device's log (`InkLog`).
  private var raw: [[String: Any]] = []
  private var seed: UInt32 = 1
  private var force: CGFloat?
  private var ink = PKInk(.pen, color: .black)
  private var asked: CGFloat = 1
  private var sense: CGFloat = 1
  private(set) var writing = false

  /// The strokes ended, oldest first, until PencilKit hands each over: each is kept in place of PencilKit's.
  private var ended: [PKStroke] = []
  /// A dev run's: the last stroke drawn here, how wide it was on the glass (its points' mean width, in its points),
  /// and from the touch to the frame it was drawn in, the last few (ms).
  private(set) var shownWidth: Double = 0
  private(set) var lags: [Double] = []
  /// A dev run's: of the stroke last begun, how far UIKit's rounded place of a touch was from its precise one, at most (points on the glass).
  private(set) var rounding: Double = 0
  /// A dev run's: why the last stroke PencilKit handed over had none drawn for it here.
  private(set) var missed = ""

  init(canvas: PKCanvasView) {
    self.canvas = canvas
    layer.zPosition = 10_000
    layer.actions = ["sublayers": NSNull(), "contents": NSNull(), "bounds": NSNull(), "position": NSNull(), "frame": NSNull()]
    canvas.layer.addSublayer(layer)
  }

  /// The ink a canvas is given while this draws: PencilKit's stroke is made, and nothing of it is seen.
  static func unseen(_ tool: PKInkingTool) -> PKInkingTool {
    on ? PKInkingTool(tool.inkType, color: tool.color.withAlphaComponent(0), width: tool.width) : tool
  }

  /// A stroke begins: under this ink (its real colour), `width` points wide as asked (thinner than PencilKit's
  /// thinnest too), the pen's `pressure` as the tool has it.
  func begin(_ tool: PKInkingTool, width: CGFloat, sense: CGFloat?) {
    ink = PKInk(tool.inkType, color: tool.color)
    asked = max(0.05, width)
    self.sense = CGFloat(min(max(sense ?? 1, 0), 2))
    points = []
    raw = []
    force = nil
    began = 0
    rounding = 0
    made = Date()
    seed = UInt32.random(in: 1...UInt32.max)
    writing = true
    let l = CALayer()
    l.actions = layer.actions
    current = l
    layer.addSublayer(l)
  }

  /// The touches of one event: those the system coalesced since the last, and those it predicts.
  func add(_ t: UITouch, _ event: UIEvent?, ended last: Bool) {
    guard writing, let c = canvas else { return }
    let all = event?.coalescedTouches(for: t) ?? [t]
    for u in all.isEmpty ? [t] : all {
      points.append(point(u, in: c, keep: true))
      if InkLog.on { raw.append(InkLog.touch(u, in: c, predicted: false, event: t.timestamp)) }
    }
    let predicted = last ? [] : (event?.predictedTouches(for: t) ?? [])
    if InkLog.on { for u in predicted { raw.append(InkLog.touch(u, in: c, predicted: true, event: t.timestamp)) } }
    let ahead = predicted.map { point($0, in: c, keep: false) }
    draw(points + ahead, at: t.timestamp)
    if last { finish() }
  }

  /// The Pencil lifted: the stroke as last drawn, without what was predicted, waits for PencilKit to hand its own over.
  private func finish() {
    guard writing else { return }
    writing = false
    draw(points, at: nil)
    if let l = current { shown.append(l) }
    current = nil
    if let k = stroke(points) {
      ended.append(k)
      if InkLog.on, let c = canvas { InkLog.shared.stroke(k, touches: raw, canvas: c, rounding: rounding, asPage: asPage) }
    }
    points = []
    raw = []
  }

  /// What began is no stroke after all (a second finger joined, the tool changed under it): gone from the glass.
  func cancel() {
    writing = false
    current?.removeFromSuperlayer()
    current = nil
    points = []
  }

  /// PencilKit handed over its stroke `theirs`: the one drawn here for it, if there is one, in its place.
  func take(_ theirs: PKStroke) -> PKStroke? {
    // (PencilKit's recogniser saw the lift before the watcher did: the stroke ends here, as far as it has come)
    if ended.isEmpty, writing { finish() }
    guard !ended.isEmpty else { missed = "none drawn"; return nil }
    let ours = ended.removeFirst()
    // (the same stroke: it begins where PencilKit's does, to a few points; else PencilKit's is kept, as before)
    guard let a = ours.path.first?.location, let b = theirs.path.first?.location.applying(theirs.transform), hypot(a.x - b.x, a.y - b.y) < 12 else {
      missed = String(format: "begun elsewhere (%.0f,%.0f against %.0f,%.0f)", ours.path.first?.location.x ?? -1, ours.path.first?.location.y ?? -1, theirs.path.first?.location.x ?? -1, theirs.path.first?.location.y ?? -1)
      return nil
    }
    var k = ours
    k.transform = theirs.transform.concatenating(k.transform)
    return k
  }

  /// The canvas is emptied (the page draws what it showed) or its strokes are its own again (a typed note's area):
  /// nothing of what ended is drawn here any more.
  func clearGlass() {
    for l in shown { l.removeFromSuperlayer() }
    shown = []
    ended = []
  }

  // ── the stroke ──

  /// One touch as a point of the stroke, in the canvas's drawing's points; `keep`: one of the stroke's own (its force
  /// counts for those after it), not a predicted one.
  private func point(_ u: UITouch, in c: PKCanvasView, keep: Bool) -> PKStrokePoint {
    let z = max(c.zoomScale, 0.0001)
    // (where a touch is in a scroll view is in its content's points: the drawing's, as large as it is zoomed). The
    // precise place: UIKit's `location` is rounded to the screen's points, and a curve made of places rounded so,
    // divided by the zoom, is a run of short straight steps meeting at corners (2026-11-22, BUILD-LOG)
    let at = LiveInk.roughForDev ? u.location(in: c) : u.preciseLocation(in: c)
    if keep {
      let rough = u.location(in: c)
      rounding = max(rounding, Double(hypot(rough.x - at.x, rough.y - at.y)))
    }
    let p = CGPoint(x: at.x / z, y: at.y / z)
    if began == 0 { began = u.timestamp }
    let pencil = u.type == .pencil
    let f = factor(u, keep: keep)
    let type = ink.inkType
    var w: CGFloat
    var opacity: CGFloat = 1
    var azimuth: CGFloat = .pi / 2
    if pencil { azimuth = u.azimuthAngle(in: c) }
    switch type {
    case .marker:
      w = asked * 2 / 3
    case .pencil:
      // (PencilKit's own pencil, read off: its point is 0.71 + 0.21 of the width, and half there; firmer is darker)
      w = 0.707 + 0.2055 * asked
      opacity = min(1, max(0.25, 0.5 * f))
    default:
      if #available(iOS 17.0, *), type == .fountainPen {
        // (PencilKit's own fountain pen, read off: 2.03 + 0.62 of the width; its nib lies as it is held)
        w = (2.03 + 0.62 * asked) * f
        if !pencil { azimuth = -.pi }
      } else {
        // a round nib, as `stroke.m` draws it: twice the point's size less four is the line's width
        w = (asked * f + 4) / 2
      }
    }
    return PKStrokePoint(location: p, timeOffset: u.timestamp - began, size: CGSize(width: w, height: w), opacity: opacity, force: pencil ? u.force : 1, azimuth: azimuth, altitude: pencil ? u.altitudeAngle : .pi / 2)
  }

  /// How much wider the pen is for the hand's force at a touch, by a mapping fixed at the touch: 1 for an average
  /// touch (UIKit's force 1), never under three tenths or over twice and a half; 1 for a finger, for an ink that does
  /// not follow the hand (the even line, the highlighter), and at `pressure` 0. The force is evened with the touches
  /// before it, never after: what is drawn is never drawn again.
  private func factor(_ u: UITouch, keep: Bool) -> CGFloat {
    var follows = ink.inkType == .pen || ink.inkType == .pencil
    if #available(iOS 17.0, *) { follows = follows || ink.inkType == .fountainPen }
    guard follows, u.type == .pencil, u.maximumPossibleForce > 0 else { return 1 }
    let even = force.map { 0.5 * $0 + 0.5 * u.force } ?? u.force
    if keep { force = even }
    return min(max(1 + sense * 0.85 * (even - 1), 0.3), 2.4)
  }

  private func stroke(_ pts: [PKStrokePoint]) -> PKStroke? {
    guard !pts.isEmpty else { return nil }
    var k = PKStroke(ink: ink, path: PKStrokePath(controlPoints: pts, creationDate: made))
    // (a pencil's grain is drawn from the stroke's seed: one seed for the stroke from its first touch to the one kept)
    if #available(iOS 16.0, *) { k.randomSeed = seed }
    return k
  }

  /// The stroke as it is now, on the glass: an outline as a shape (a pen, the even line, a highlighter), PencilKit's
  /// picture of it for a fountain pen and a pencil. `at`: the touch's time, for a dev run's measure of the wait.
  private func draw(_ pts: [PKStrokePoint], at touched: TimeInterval?) {
    guard let c = canvas, let l = current, let k = stroke(pts) else { return }
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    layer.frame = CGRect(origin: .zero, size: c.contentSize)
    let drawn = Self.paint(k, in: l, canvas: c, asPage: asPage)
    CATransaction.commit()
    guard drawn else { return }
    // (what the glass shows: as wide as this, at the time of the touch it shows)
    let round = k.ink.inkType == .pen || { if #available(iOS 17.0, *) { return k.ink.inkType == .monoline }; return false }()
    shownWidth = Double(pts.reduce(0) { $0 + (round ? max(0.05, 2 * $1.size.width - 4) : $1.size.width) } / CGFloat(pts.count))
    if let t = touched {
      let now = ProcessInfo.processInfo.systemUptime
      lags.append((now - t) * 1000)
      if lags.count > 400 { lags.removeFirst(lags.count - 400) }
    }
  }

  /// A stroke as `l` shows it on a canvas's glass, as the page or the sheets draw it: an outline as a shape (a pen,
  /// the even line, a highlighter), or a picture (a fountain pen, a pencil: on a page `asPage`, the page's own). `l`
  /// lies over the canvas's content, unscaled: what is in it is the canvas's zoom times the drawing's points. False
  /// when there is nothing of it to draw. In a transaction of the caller's.
  @discardableResult
  static func paint(_ k: PKStroke, in l: CALayer, canvas c: PKCanvasView, asPage: Bool) -> Bool {
    let dark = c.overrideUserInterfaceStyle == .dark
    guard let g = Geom(k, dark: dark && !asPage) else { return false }
    let turned = asPage && dark
    let z = c.zoomScale
    let screen = c.window?.screen.scale ?? UIScreen.main.scale
    if let o = g.outline() {
      let s = (l.sublayers?.first as? CAShapeLayer) ?? {
        let n = CAShapeLayer()
        n.actions = l.actions
        n.fillRule = .nonZero
        n.lineJoin = .round
        n.lineCap = .round
        n.contentsScale = screen
        l.addSublayer(n)
        return n
      }()
      var by = CGAffineTransform(scaleX: z, y: z)
      s.frame = CGRect(origin: .zero, size: c.contentSize)
      s.path = o.path.copy(using: &by)
      let colour = turned ? Self.turn(o.colour) : o.colour
      s.fillColor = colour
      if o.round > 0 {
        // (a highlighter: what its nib swept, and its thickness round that, one flat tint at three quarters)
        s.strokeColor = colour
        s.lineWidth = o.round * 2 * z
        s.opacity = Float(o.alpha)
      } else {
        s.strokeColor = nil
        s.lineWidth = 0
        s.opacity = 1
      }
    } else if asPage, let pic = g.pagePicture() {
      // the page's own picture of it, as the page has it, scaled to the glass as the page scales it
      // (brought down to the glass's pixels averaged, as the web view brings an image down)
      l.contents = turned ? Self.turn(pic.image) : pic.image
      l.contentsGravity = .resize
      l.minificationFilter = .trilinear
      l.magnificationFilter = .linear
      l.frame = CGRect(x: pic.box.minX * z, y: pic.box.minY * z, width: pic.box.width * z, height: pic.box.height * z)
    } else {
      // a picture, as many pixels as the screen shows it with
      let box = g.box.insetBy(dx: -2, dy: -2).integral
      let fmt = UIGraphicsImageRendererFormat()
      fmt.scale = screen * z
      fmt.opaque = false
      let img = UIGraphicsImageRenderer(size: box.size, format: fmt).image { r in
        let cg = r.cgContext
        cg.translateBy(x: -box.minX, y: -box.minY)
        g.draw(cg)
      }
      l.contents = img.cgImage
      l.contentsScale = screen
      l.frame = CGRect(x: box.minX * z, y: box.minY * z, width: box.width * z, height: box.height * z)
    }
    return true
  }
}

/// A dev run's measure of the wait from a touch to the glass (2026-11-21), the same for the stroke drawn here and for
/// PencilKit's own: a row of squares in the window's corner counts the frames in binary (one more each frame the
/// display draws), and every frame's number is written down with the time it is to be on the glass; every touch the
/// writing finger made (each one the system coalesced) is written down with its time and place. A recording of the
/// screen then says, frame by frame, which frame it is (the squares) and how far the line has come (its tip): the
/// touch that was there, and when, against when the frame was on the glass.
final class LiveClock: NSObject {
  static let shared = LiveClock()
  static let bits = 12
  private var view: UIView?
  private var squares: [UIView] = []
  private var link: CADisplayLink?
  private var n = 0
  private var frames: [String] = []
  private var touches: [String] = []
  var running: Bool { link != nil }

  func start(in window: UIWindow) {
    stop(write: false)
    let side: CGFloat = 10
    let v = UIView(frame: CGRect(x: 4, y: window.bounds.height - side - 4, width: side * CGFloat(Self.bits + 2), height: side))
    v.backgroundColor = .white
    v.isUserInteractionEnabled = false
    v.layer.zPosition = 100_000
    squares = (0..<Self.bits).map { i in
      let q = UIView(frame: CGRect(x: side * CGFloat(i + 1), y: 0, width: side, height: side))
      q.backgroundColor = .white
      v.addSubview(q)
      return q
    }
    // (a black square at each end: where the count is, in any capture)
    for x in [0, CGFloat(Self.bits + 1) * side] {
      let e = UIView(frame: CGRect(x: x, y: 0, width: side, height: side))
      e.backgroundColor = .black
      v.addSubview(e)
    }
    window.addSubview(v)
    view = v
    n = 0
    frames = []
    touches = []
    let l = CADisplayLink(target: self, selector: #selector(tick(_:)))
    l.preferredFrameRateRange = CAFrameRateRange(minimum: 60, maximum: 120, preferred: 120)
    l.add(to: .main, forMode: .common)
    link = l
  }

  @objc private func tick(_ l: CADisplayLink) {
    n += 1
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    for (i, q) in squares.enumerated() { q.backgroundColor = (n >> i) & 1 == 1 ? .black : .white }
    CATransaction.commit()
    frames.append(String(format: "%d %.6f %.6f", n & ((1 << Self.bits) - 1), l.targetTimestamp, l.timestamp))
  }

  func touch(_ t: UITouch, _ event: UIEvent?) {
    // (any touch the watcher sees: a stroke's, or the eraser's)
    guard running, let w = t.window else { return }
    for u in event?.coalescedTouches(for: t) ?? [t] {
      let p = u.location(in: w)
      touches.append(String(format: "%.6f %.2f %.2f", u.timestamp, p.x, p.y))
    }
  }

  /// Stopped; with `write`, what was written down, as `live-clock.txt` in the app's temporary folder.
  func stop(write: Bool) {
    link?.invalidate()
    link = nil
    view?.removeFromSuperview()
    view = nil
    guard write else { return }
    let scale = UIScreen.main.scale
    let text = "scale \(scale)\nframes\n" + frames.joined(separator: "\n") + "\ntouches\n" + touches.joined(separator: "\n") + "\n"
    try? text.write(to: FileManager.default.temporaryDirectory.appendingPathComponent("live-clock.txt"), atomically: true, encoding: .utf8)
  }
}

/// The eraser on a page the page draws (a PDF's), on the glass at once (2026-11-22). The page draws its ink itself, in
/// the web view's process: told of what an eraser left, it drew it 40 to 55 ms later, and a telling each move, each
/// with every name the page holds, came faster than it drew them, so a stroke went from the glass up to 190 ms after
/// the eraser touched it (BUILD-LOG). Now, while the eraser is down, the sheet's strokes are drawn here, by name, in a
/// layer inside its canvas, and the page holds them unseen (as it holds a stroke still on the canvas while written);
/// what the eraser takes goes from this layer in the turn it is taken, and what it leaves of a stroke cut (`part`)
/// comes into it. When the eraser lifts the page shows its own again, and this goes when the page says it has drawn it.
final class EraseGlass {
  let layer = CALayer()
  /// The highlighters, under the rest, as the page lays them.
  private let marks = CALayer()
  private let pens = CALayer()
  private var shown: [String: CALayer] = [:]
  private weak var canvas: PKCanvasView?
  /// Lifted: the page shows its own from the telling `until` on, and this goes when it has drawn it.
  var ending = false
  var until = 0
  private static let still: [String: CAAction] = ["sublayers": NSNull(), "contents": NSNull(), "bounds": NSNull(), "position": NSNull(), "frame": NSNull(), "opacity": NSNull(), "hidden": NSNull()]

  init(canvas: PKCanvasView, blend: String?) {
    self.canvas = canvas
    for l in [layer, marks, pens] { l.actions = Self.still }
    layer.zPosition = 9_000
    // (ink is laid on the page as the page lays it: multiplied onto the paper, screened on dark paper)
    layer.compositingFilter = blend
    layer.addSublayer(marks)
    layer.addSublayer(pens)
    canvas.layer.addSublayer(layer)
  }

  /// What the sheet holds now, by name: what it no longer holds goes, what it holds anew comes, in this turn.
  func sync(_ strokes: [PKStroke], names: [String]) {
    guard let c = canvas else { return }
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    let size = CGRect(origin: .zero, size: c.contentSize)
    for l in [layer, marks, pens] where l.frame != size { l.frame = size }
    let want = Set(names)
    for (n, l) in shown where !want.contains(n) {
      l.removeFromSuperlayer()
      shown[n] = nil
    }
    for (k, n) in zip(strokes, names) where shown[n] == nil && !n.isEmpty {
      let l = CALayer()
      l.actions = Self.still
      if LiveInk.paint(k, in: l, canvas: c, asPage: true) {
        (k.ink.inkType == .marker ? marks : pens).addSublayer(l)
        shown[n] = l
      }
    }
    CATransaction.commit()
  }

  var count: Int { shown.count }

  func remove() {
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    layer.removeFromSuperlayer()
    CATransaction.commit()
  }
}

/// What the Pencil gave and what was made of it, for the last twenty or so strokes, in the app's own data (2026-11-22):
/// `Library/Caches/ilmi-ink.log` in the app's container (bundle `dev.ilmi.app`), never in a collection. One JSON line a
/// stroke: where it was written (`surface`), the canvas's zoom and the screen's scale, the ink, how far UIKit's rounded
/// place of a touch was from its precise one at most (`rounding`, screen points), every touch as it came (`touches`:
/// its time, its precise and its rounded place in the canvas's points on the glass, force, altitude, azimuth, whether
/// it was predicted, and the time of the event it came in), the stroke kept (`points`: the `PKStroke`'s control
/// points in the drawing's points, with size, force and time), and its outline's middle as drawn (`middle`: places
/// `x, y, radius` after evening), the step its points were found rounded to and the sigma they were evened by, and
/// its turns on the glass. Over a megabyte, the newest fifteen strokes are kept. `on = false` turns it off.
final class InkLog {
  static let on = true
  static let shared = InkLog()
  private let queue = DispatchQueue(label: "ilmi.inklog", qos: .utility)
  private let url: URL? = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first?.appendingPathComponent("ilmi-ink.log")
  private let most = 1_000_000

  static func r(_ v: CGFloat) -> Double { (Double(v) * 1000).rounded() / 1000 }

  static func touch(_ u: UITouch, in c: UIView, predicted: Bool, event: TimeInterval) -> [String: Any] {
    let p = u.preciseLocation(in: c), l = u.location(in: c)
    var d: [String: Any] = ["t": (u.timestamp * 10000).rounded() / 10000, "px": r(p.x), "py": r(p.y), "lx": r(l.x), "ly": r(l.y), "f": r(u.force), "ty": u.type.rawValue]
    if u.type == .pencil { d["alt"] = r(u.altitudeAngle); d["az"] = r(u.azimuthAngle(in: c)) }
    if predicted { d["pred"] = 1 }
    d["ev"] = (event * 10000).rounded() / 10000
    return d
  }

  func stroke(_ k: PKStroke, touches: [[String: Any]], canvas c: PKCanvasView, rounding: Double, asPage: Bool) {
    let zoom = Double(c.zoomScale)
    let scale = Double(c.window?.screen.scale ?? UIScreen.main.scale)
    let surface = asPage ? "pdf" : (c.superview is UIScrollView ? "notebook" : "area")
    let when = ISO8601DateFormatter().string(from: Date())
    queue.async { [weak self] in
      guard let self = self, let url = self.url else { return }
      let pts: [[Double]] = k.path.map { [Self.r($0.location.x), Self.r($0.location.y), Self.r($0.size.width), Self.r($0.force), ($0.timeOffset * 10000).rounded() / 10000] }
      var line: [String: Any] = ["at": when, "surface": surface, "zoom": zoom, "scale": scale, "ink": k.ink.inkType.rawValue, "rounding": rounding, "touches": touches, "points": pts]
      if let g = Geom(k, dark: false) {
        let m = g.places()
        var middle: [[Double]] = []
        var i = 0
        while i + 2 < m.count {
          middle.append([m[i], m[i + 1], m[i + 2]].map { v in (v * 1000).rounded() / 1000 })
          i += 3
        }
        line["middle"] = middle
        let e = g.evening()
        line["step"] = e[0]
        line["even"] = e[1]
        line["turns"] = g.turns(at: zoom * scale)
      }
      guard let data = try? JSONSerialization.data(withJSONObject: line), var text = String(data: data, encoding: .utf8) else { return }
      text += "\n"
      let fm = FileManager.default
      if let size = (try? fm.attributesOfItem(atPath: url.path))?[.size] as? Int, size + text.utf8.count > self.most,
         let old = try? String(contentsOf: url, encoding: .utf8) {
        let keep = old.split(separator: "\n").suffix(15).joined(separator: "\n") + "\n"
        try? keep.write(to: url, atomically: true, encoding: .utf8)
      }
      if let h = try? FileHandle(forWritingTo: url) {
        h.seekToEndOfFile()
        h.write(text.data(using: .utf8)!)
        try? h.close()
      } else {
        try? text.write(to: url, atomically: true, encoding: .utf8)
      }
    }
  }
}
