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
  private var turned: Bool { asPage && canvas?.overrideUserInterfaceStyle == .dark }
  /// The page's turn as one matrix on sRGB: invert(0.92) is 0.92 − 0.84c, hue-rotate(180deg) is `hue` (rows sum to 1).
  private static let hue: [[CGFloat]] = [[-0.574, 1.430, 0.144], [0.426, 0.430, 0.144], [0.426, 1.430, -0.856]]
  private static func turn(_ c: CGColor) -> CGColor {
    guard let s = c.converted(to: CGColorSpace(name: CGColorSpace.sRGB)!, intent: .defaultIntent, options: nil)?.components, s.count >= 3 else { return c }
    let v = hue.map { row in min(1, max(0, 0.92 - 0.84 * (row[0] * s[0] + row[1] * s[1] + row[2] * s[2]))) }
    return CGColor(colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!, components: v + [s.count > 3 ? s[3] : 1]) ?? c
  }
  private static let ci = CIContext(options: [.workingColorSpace: CGColorSpace(name: CGColorSpace.sRGB)!, .outputColorSpace: CGColorSpace(name: CGColorSpace.sRGB)!])
  private static func turn(_ img: CGImage) -> CGImage {
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
    force = nil
    began = 0
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
    for u in all.isEmpty ? [t] : all { points.append(point(u, in: c, keep: true)) }
    let ahead = last ? [] : (event?.predictedTouches(for: t) ?? []).map { point($0, in: c, keep: false) }
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
    if let k = stroke(points) { ended.append(k) }
    points = []
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
    // (where a touch is in a scroll view is in its content's points: the drawing's, as large as it is zoomed)
    let at = u.location(in: c)
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
    guard let c = canvas, let l = current, let k = stroke(pts), let g = Geom(k, dark: c.overrideUserInterfaceStyle == .dark && !asPage) else { return }
    let turned = self.turned
    let z = c.zoomScale
    let screen = c.window?.screen.scale ?? UIScreen.main.scale
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    layer.frame = CGRect(origin: .zero, size: c.contentSize)
    if let o = g.outline() {
      let s = (l.sublayers?.first as? CAShapeLayer) ?? {
        let n = CAShapeLayer()
        n.actions = layer.actions
        n.fillRule = .nonZero
        n.lineJoin = .round
        n.lineCap = .round
        n.contentsScale = screen
        l.addSublayer(n)
        return n
      }()
      var by = CGAffineTransform(scaleX: z, y: z)
      s.frame = layer.bounds
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
      let frame = CGRect(x: pic.box.minX * z, y: pic.box.minY * z, width: pic.box.width * z, height: pic.box.height * z)
      l.contents = turned ? Self.turn(pic.image) : pic.image
      l.contentsGravity = .resize
      l.minificationFilter = .trilinear
      l.magnificationFilter = .linear
      l.frame = frame
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
    CATransaction.commit()
    // (what the glass shows: as wide as this, at the time of the touch it shows)
    let round = k.ink.inkType == .pen || { if #available(iOS 17.0, *) { return k.ink.inkType == .monoline }; return false }()
    shownWidth = Double(pts.reduce(0) { $0 + (round ? max(0.05, 2 * $1.size.width - 4) : $1.size.width) } / CGFloat(pts.count))
    if let t = touched {
      let now = ProcessInfo.processInfo.systemUptime
      lags.append((now - t) * 1000)
      if lags.count > 400 { lags.removeFirst(lags.count - 400) }
    }
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
