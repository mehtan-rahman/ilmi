import XCTest
import ObjectiveC

// The touch rig (PLAN 55, 57; docs/development.md, "The iPad"): the app's
// smoke asks for touches in its log (`smoke <mode>: do: <verb> <numbers…>`,
// places as fractions of the window), and this test makes each as the
// system's own synthesized touch, in order, until the smoke's `done` or
// `failed` line. The environment (each as `TEST_RUNNER_<NAME>` to
// xcodebuild): LOG the app's log on the Mac's disk, MODE the smoke's name,
// MAX seconds to wait (600), OUT a folder for `runner-methods.txt`, LINK a link
// to start the app with instead of a smoke, WAIT seconds to start it before.
//   tap x y · tap2 x y (twice, as one double tap) · press x y seconds · drag x1 y1 x2 y2 hold · flick x1 y1 x2 y2 · turn portrait|landscape
//   · type <text> (into what has the caret) · open <link> (as a Shortcut's "open URL" arrives)
//   · away <seconds> (the app sent home, and brought back after that long)
//   · loop x1 y1 x2 y2 x3 y3 … (one finger through every point in turn, slowly, and lifted: a lasso's loop,
//     which no public call of XCUITest draws; `through` below)
//   · pinch ax ay bx by ax2 ay2 bx2 by2 (two fingers down at a and b, moved together to a2 and b2, and lifted:
//     a pinch about wherever they are, which XCUITest's own `pinch` makes only about an element's middle)
//   · taps n x y (n fingers down at once round x y and up again: two are undo, three redo; `fingers` below)
//   · rest x1 y1 x2 y2 … seconds (as `loop`, but quicker along the way and resting `seconds` on the last point
//     before lifting: a stroke held still at its end)
//   · wpinch x1 y1 x2 y2 gap ax ay bx by ax2 ay2 bx2 by2 secs (one finger from 1 to 2 in 0.3 s and lifted; `gap`
//     seconds after it lifts two fingers down at a and b, moved to a2 and b2 in `secs`, and lifted: all one record,
//     so the pinch follows the stroke sooner than a second ask could be read)
//
// Every touch is the runner's own pointer path (`fingers`), a tap and a drag too. XCUITest's public calls
// (`tap()`, `press(forDuration:thenDragTo:)`) first find the application and read its whole accessibility tree,
// before the touch and five times after it: over a long typed note that is 10 s before a touch is made and 30 s
// before the next can be, so a smoke that waits 20 s for what a tap does saw taps that "did nothing" (they landed
// after it had given up, or on what it had moved to since). A pointer path asks the app nothing: the window's frame
// is read once, and again when the device is turned. `TEST_RUNNER_PUBLIC=1` makes the taps and drags by the public
// calls again, to compare (`TEST_RUNNER_SIDE=public`: only while the device is on its side).
final class TouchRig: XCTestCase {
  /// The app's window in the screen's points, read once and when the device is turned; and whether it is on its side.
  /// When the last touch asked for was made.
  private var lastTouch = Date.distantPast
  private var frame = CGRect.zero
  private var side = false
  private var orientation: Int { side && sideWay == "right" ? UIInterfaceOrientation.landscapeRight.rawValue : side && sideWay == "left" ? UIInterfaceOrientation.landscapeLeft.rawValue : UIInterfaceOrientation.portrait.rawValue }
  /// How a pointer path is said while the device is on its side (`TEST_RUNNER_SIDE`): `public` (not at all: the
  /// public calls), or the record's orientation `right` or `left` with the window's own places, or upright with the
  /// places turned into the upright screen's (`rotA`, `rotB`).
  private var sideWay = "rotB"
  private var upright = CGSize.zero
  /// A place of the window as a pointer path takes it: the upright screen's own, whichever way the device lies.
  /// (Found by trying each on a simulated iPad: a record said to be on its side, either way, put its taps
  /// elsewhere; upright with the places turned a quarter this way, they land.)
  private func screen(_ p: CGPoint) -> CGPoint {
    if side, sideWay == "rotA" { return CGPoint(x: p.y, y: upright.height - p.x) }
    if side, sideWay == "rotB" { return CGPoint(x: upright.width - p.y, y: p.x) }
    return p
  }

  /// One finger down at the first point, through the rest, and up: XCUITest's own pointer path, which its
  /// public calls build two points at a time. The classes are the runner's (`runner-methods.txt` lists what
  /// this Xcode's have); false when they are not there.
  private func through(_ pts: [CGPoint]) -> Bool {
    guard pts.count >= 2, let pathClass = NSClassFromString("XCPointerEventPath") as? NSObject.Type, let recordClass = NSClassFromString("XCSynthesizedEventRecord") as? NSObject.Type else { return false }
    let start = NSSelectorFromString("initForTouchAtPoint:offset:")
    let move = NSSelectorFromString("moveToPoint:atOffset:")
    let lift = NSSelectorFromString("liftUpAtOffset:")
    let named = NSSelectorFromString("initWithName:interfaceOrientation:")
    let add = NSSelectorFromString("addPointerEventPath:")
    let run = NSSelectorFromString("synthesizeWithError:")
    guard pathClass.instancesRespond(to: start), pathClass.instancesRespond(to: move), pathClass.instancesRespond(to: lift), recordClass.instancesRespond(to: named), recordClass.instancesRespond(to: add), recordClass.instancesRespond(to: run) else { return false }
    typealias Start = @convention(c) (AnyObject, Selector, CGPoint, Double) -> Unmanaged<AnyObject>
    typealias Move = @convention(c) (AnyObject, Selector, CGPoint, Double) -> Void
    typealias Lift = @convention(c) (AnyObject, Selector, Double) -> Void
    typealias Named = @convention(c) (AnyObject, Selector, NSString, Int) -> Unmanaged<AnyObject>
    typealias Run = @convention(c) (AnyObject, Selector, AutoreleasingUnsafeMutablePointer<NSError?>?) -> Bool
    let rawPath = pathClass.perform(NSSelectorFromString("alloc")).takeUnretainedValue() as! NSObject
    let path = unsafeBitCast(rawPath.method(for: start), to: Start.self)(rawPath, start, screen(pts[0]), 0).takeUnretainedValue() as! NSObject
    // a rest where it lands, then 0.12 s a point
    var t = 0.25
    for p in pts.dropFirst() {
      unsafeBitCast(path.method(for: move), to: Move.self)(path, move, screen(p), t)
      t += 0.12
    }
    unsafeBitCast(path.method(for: lift), to: Lift.self)(path, lift, t + 0.1)
    let rawRecord = recordClass.perform(NSSelectorFromString("alloc")).takeUnretainedValue() as! NSObject
    let record = unsafeBitCast(rawRecord.method(for: named), to: Named.self)(rawRecord, named, "loop", orientation).takeUnretainedValue() as! NSObject
    _ = record.perform(add, with: path)
    var failed: NSError?
    let ok = unsafeBitCast(record.method(for: run), to: Run.self)(record, run, &failed)
    if !ok { print("rig: the path was not made: \(String(describing: failed))") }
    return ok
  }

  /// Several fingers at once, each through its own points with its own times, by the same pointer paths `through` uses.
  private func fingers(_ paths: [[(CGPoint, Double)]], lift after: Double = 0.05) -> Bool {
    guard let pathClass = NSClassFromString("XCPointerEventPath") as? NSObject.Type, let recordClass = NSClassFromString("XCSynthesizedEventRecord") as? NSObject.Type else { return false }
    let start = NSSelectorFromString("initForTouchAtPoint:offset:")
    let move = NSSelectorFromString("moveToPoint:atOffset:")
    let lift = NSSelectorFromString("liftUpAtOffset:")
    let named = NSSelectorFromString("initWithName:interfaceOrientation:")
    let add = NSSelectorFromString("addPointerEventPath:")
    let run = NSSelectorFromString("synthesizeWithError:")
    guard pathClass.instancesRespond(to: start), pathClass.instancesRespond(to: move), pathClass.instancesRespond(to: lift), recordClass.instancesRespond(to: named), recordClass.instancesRespond(to: add), recordClass.instancesRespond(to: run) else { return false }
    typealias Start = @convention(c) (AnyObject, Selector, CGPoint, Double) -> Unmanaged<AnyObject>
    typealias Move = @convention(c) (AnyObject, Selector, CGPoint, Double) -> Void
    typealias Lift = @convention(c) (AnyObject, Selector, Double) -> Void
    typealias Named = @convention(c) (AnyObject, Selector, NSString, Int) -> Unmanaged<AnyObject>
    typealias Run = @convention(c) (AnyObject, Selector, AutoreleasingUnsafeMutablePointer<NSError?>?) -> Bool
    let rawRecord = recordClass.perform(NSSelectorFromString("alloc")).takeUnretainedValue() as! NSObject
    let record = unsafeBitCast(rawRecord.method(for: named), to: Named.self)(rawRecord, named, "fingers", orientation).takeUnretainedValue() as! NSObject
    for pts in paths where !pts.isEmpty {
      let rawPath = pathClass.perform(NSSelectorFromString("alloc")).takeUnretainedValue() as! NSObject
      let path = unsafeBitCast(rawPath.method(for: start), to: Start.self)(rawPath, start, screen(pts[0].0), pts[0].1).takeUnretainedValue() as! NSObject
      for p in pts.dropFirst() { unsafeBitCast(path.method(for: move), to: Move.self)(path, move, screen(p.0), p.1) }
      unsafeBitCast(path.method(for: lift), to: Lift.self)(path, lift, (pts.last?.1 ?? 0) + after)
      _ = record.perform(add, with: path)
    }
    var failed: NSError?
    let ok = unsafeBitCast(record.method(for: run), to: Run.self)(record, run, &failed)
    if !ok { print("rig: the fingers were not made: \(String(describing: failed))") }
    return ok
  }

  func testDrive() throws {
    let env = ProcessInfo.processInfo.environment
    guard let log = env["LOG"], let mode = env["MODE"] else { XCTFail("LOG and MODE"); return }
    let limit = Double(env["MAX"] ?? "600") ?? 600
    if let out = env["OUT"] {
      // what this Xcode's runner can synthesize: the pointer path's own methods, for the notes
      var lines: [String] = []
      for name in ["XCPointerEventPath", "XCPointerEvent", "XCSynthesizedEventRecord"] {
        guard let cls = NSClassFromString(name) else { lines.append("\(name): no such class"); continue }
        var n: UInt32 = 0
        if let list = class_copyMethodList(cls, &n) {
          for i in 0..<Int(n) { lines.append("\(name) -\(NSStringFromSelector(method_getName(list[i])))") }
          free(list)
        }
        var m: UInt32 = 0
        if let meta = object_getClass(cls), let list = class_copyMethodList(meta, &m) {
          for i in 0..<Int(m) { lines.append("\(name) +\(NSStringFromSelector(method_getName(list[i])))") }
          free(list)
        }
      }
      try? lines.joined(separator: "\n").write(toFile: out + "/runner-methods.txt", atomically: true, encoding: .utf8)
    }
    let app = XCUIApplication(bundleIdentifier: "dev.ilmi.app")
    // LINK: the app not running, a link starts it, as a Shortcut does; with WAIT the app is started
    // that many seconds before it (Shortcut's Open App, Wait, Open URLs); a capture to OUT after 25 s
    if let link = env["LINK"], let url = URL(string: link) {
      if let wait = env["WAIT"].flatMap(Double.init) { app.launch(); Thread.sleep(forTimeInterval: wait) }
      XCUIDevice.shared.system.open(url)
      Thread.sleep(forTimeInterval: 25)
      if let out = env["OUT"] { try? XCUIScreen.main.screenshot().pngRepresentation.write(to: URL(fileURLWithPath: out + "/cold.png")) }
      return
    }
    // (a run that stopped while the device was on its side leaves it so: every run begins upright)
    XCUIDevice.shared.orientation = .portrait
    app.launch()
    let at = { (x: Double, y: Double) in app.coordinate(withNormalizedOffset: CGVector(dx: x, dy: y)) }
    let publicCalls = env["PUBLIC"] == "1"
    sideWay = env["SIDE"] ?? "rotB"
    frame = app.frame
    side = frame.width > frame.height
    upright = side ? CGSize(width: frame.height, height: frame.width) : frame.size
    /// A place of the window, as fractions of it, in the screen's points.
    let pt = { (x: Double, y: Double) in CGPoint(x: self.frame.minX + x * self.frame.width, y: self.frame.minY + y * self.frame.height) }
    /// One finger from `a` to `b` at `speed` points a second after resting `hold` where it lands, resting `rest` where it ends.
    let dragged = { (a: CGPoint, b: CGPoint, hold: Double, speed: Double, rest: Double) -> [(CGPoint, Double)] in
      let secs = max(0.05, Double(hypot(b.x - a.x, b.y - a.y)) / speed)
      let steps = max(4, min(240, Int(secs * 60)))
      var out: [(CGPoint, Double)] = [(a, 0)]
      for i in 1...steps { let t = Double(i) / Double(steps); out.append((CGPoint(x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t), hold + t * secs)) }
      if rest > 0 { out.append((b, hold + secs + rest)) }
      return out
    }
    let marker = "smoke \(mode): "
    var done = 0
    let t0 = Date()
    while Date().timeIntervalSince(t0) < limit {
      let text = (try? String(contentsOfFile: log, encoding: .utf8)) ?? ""
      let lines = text.components(separatedBy: "\n").compactMap { l -> String? in
        guard let r = l.range(of: marker) else { return nil }
        return String(l[r.upperBound...])
      }
      let asks = lines.filter { $0.hasPrefix("do: ") }
      if done < asks.count {
        let ask = asks[done]
        done += 1
        let parts = ask.dropFirst(4).split(separator: " ").map(String.init)
        let n = parts.dropFirst().compactMap(Double.init)
        print("rig: \(ask)")
        // The public calls waited for the app to be idle before a touch and were slow besides, and the smokes lean on
        // that: one asks for a touch the moment it sees what to touch, while a sheet is still coming in or the pages
        // are still settling from the pinch before. A pointer path waits for nothing. So no touch is made sooner than
        // three quarters of a second after the one before it (which also keeps two taps from being a double tap).
        let since = Date().timeIntervalSince(lastTouch)
        if since < 0.75 { Thread.sleep(forTimeInterval: 0.75 - since) }
        switch parts.first ?? "" {
        case "tap" where n.count >= 2 && (publicCalls || (side && sideWay == "public")): at(n[0], n[1]).tap()
        // (a double tap is XCUITest's own call always: two pointer paths a seventh of a second apart were not always one)
        case "tap2" where n.count >= 2: at(n[0], n[1]).doubleTap()
        case "press" where n.count >= 3 && (publicCalls || (side && sideWay == "public")): at(n[0], n[1]).press(forDuration: n[2])
        case "drag" where n.count >= 5 && (publicCalls || (side && sideWay == "public")): at(n[0], n[1]).press(forDuration: n[4], thenDragTo: at(n[2], n[3]), withVelocity: .slow, thenHoldForDuration: 0.15)
        case "flick" where n.count >= 4 && (publicCalls || (side && sideWay == "public")): at(n[0], n[1]).press(forDuration: 0.02, thenDragTo: at(n[2], n[3]), withVelocity: .fast, thenHoldForDuration: 0)
        case "tap" where n.count >= 2:
          Thread.sleep(forTimeInterval: 0.2)
          let p = pt(n[0], n[1])
          // (down, still there four hundredths of a second on, and up. A path of one point alone was no tap to the
          // page's buttons, and one held a tenth of a second was none to a row of the tree; the system's own popover
          // wants the longer one to be put away by a touch beside it, which a smoke asks for as a `press`)
          if !fingers([[(p, 0), (p, 0.04)]], lift: 0.02) { print("rig: no tap in this Xcode: \(ask)") }
        case "press" where n.count >= 3:
          let p = pt(n[0], n[1])
          if !fingers([[(p, 0), (p, max(0.05, n[2]))]], lift: 0.02) { print("rig: no press in this Xcode: \(ask)") }
        case "drag" where n.count >= 5:
          // (as the public call was: slowly, 250 points a second, a rest where it ends)
          Thread.sleep(forTimeInterval: 0.2)
          if !fingers([dragged(pt(n[0], n[1]), pt(n[2], n[3]), max(0.02, n[4]), 250, 0.15)]) { print("rig: no drag in this Xcode: \(ask)") }
        case "flick" where n.count >= 4:
          // (fast, and lifted while it moves: the pages coast)
          if !fingers([dragged(pt(n[0], n[1]), pt(n[2], n[3]), 0.02, 2000, 0)], lift: 0.004) { print("rig: no flick in this Xcode: \(ask)") }
        case "type":
          // (a field a tap has just given the caret, its keyboard still coming up, lost what was typed at once)
          Thread.sleep(forTimeInterval: 0.6)
          app.typeText(String(ask.dropFirst(9)))
        case "open": XCUIDevice.shared.system.open(URL(string: String(ask.dropFirst(9)))!)
        case "away" where n.count >= 1: XCUIDevice.shared.press(.home); Thread.sleep(forTimeInterval: n[0]); app.activate()
        case "loop" where n.count >= 6 && n.count % 2 == 0:
          let f = frame
          let pts = stride(from: 0, to: n.count, by: 2).map { CGPoint(x: f.minX + n[$0] * f.width, y: f.minY + n[$0 + 1] * f.height) }
          if !through(pts) { print("rig: no path through points in this Xcode: \(ask)") }
        case "pinch" where n.count >= 8:
          let f = frame
          let at = { (i: Int) in CGPoint(x: f.minX + n[i] * f.width, y: f.minY + n[i + 1] * f.height) }
          // down, a rest, then steps to where they end, and a rest there before they lift; a ninth number is how many
          // seconds the fingers take on the way (0.7 with none: a slow pinch takes two or three, a quick one a fifth)
          let secs = n.count >= 9 ? max(0.05, n[8]) : 0.7
          let steps = max(8, min(120, Int(secs * 40)))
          let way = { (from: CGPoint, to: CGPoint) -> [(CGPoint, Double)] in
            var out: [(CGPoint, Double)] = [(from, 0)]
            for i in 1...steps { let t = Double(i) / Double(steps); out.append((CGPoint(x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t), 0.2 + t * secs)) }
            out.append((to, 0.2 + secs + 0.25))
            return out
          }
          if !fingers([way(at(0), at(4)), way(at(2), at(6))]) { print("rig: no pinch in this Xcode: \(ask)") }
        case "taps" where n.count >= 3:
          let f = frame
          let c = CGPoint(x: f.minX + n[1] * f.width, y: f.minY + n[2] * f.height)
          let count = max(1, Int(n[0]))
          let paths = (0..<count).map { i -> [(CGPoint, Double)] in
            let p = CGPoint(x: c.x + CGFloat(i - count / 2) * 70 + (count % 2 == 0 ? 35 : 0), y: c.y)
            return [(p, 0), (p, 0.08)]
          }
          // (`taps n x y 1`: by XCUITest's own call, which taps the middle of the app whatever x and y say)
          if n.count >= 4 && n[3] == 1 { app.tap(withNumberOfTaps: 1, numberOfTouches: count) }
          else if !fingers(paths) { print("rig: no taps in this Xcode: \(ask)") }
        case "rest" where n.count >= 5 && n.count % 2 == 1:
          let f = frame
          let secs = n[n.count - 1]
          var t = 0.1
          var pts: [(CGPoint, Double)] = []
          for i in stride(from: 0, to: n.count - 1, by: 2) {
            pts.append((CGPoint(x: f.minX + n[i] * f.width, y: f.minY + n[i + 1] * f.height), i == 0 ? 0 : t))
            t += 0.045
          }
          if let last = pts.last { pts.append((last.0, last.1 + secs)) }
          if !fingers([pts]) { print("rig: no rest in this Xcode: \(ask)") }
        case "wpinch" where n.count >= 14:
          let f = frame
          let at = { (i: Int) in CGPoint(x: f.minX + n[i] * f.width, y: f.minY + n[i + 1] * f.height) }
          let gap = max(0.02, n[4]), secs = max(0.05, n[13])
          // the stroke: down, ten steps over 0.3 s, up 0.05 s after the last (`fingers` lifts a path then)
          var pen: [(CGPoint, Double)] = [(at(0), 0)]
          for i in 1...10 { let t = Double(i) / 10; pen.append((CGPoint(x: at(0).x + (at(2).x - at(0).x) * t, y: at(0).y + (at(2).y - at(0).y) * t), 0.06 + t * 0.3)) }
          let t0 = 0.36 + 0.05 + gap
          let steps = max(6, min(120, Int(secs * 60)))
          let way = { (from: CGPoint, to: CGPoint) -> [(CGPoint, Double)] in
            var out: [(CGPoint, Double)] = [(from, t0)]
            for i in 1...steps { let t = Double(i) / Double(steps); out.append((CGPoint(x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t), t0 + 0.05 + t * secs)) }
            out.append((to, t0 + 0.05 + secs + 0.2))
            return out
          }
          if !fingers([pen, way(at(5), at(9)), way(at(7), at(11))]) { print("rig: no wpinch in this Xcode: \(ask)") }
        case "turn":
          XCUIDevice.shared.orientation = parts.last == "landscape" ? .landscapeLeft : .portrait
          Thread.sleep(forTimeInterval: 1.5)
          frame = app.frame
          side = frame.width > frame.height
          print("rig: the window is \(Int(frame.width)) by \(Int(frame.height))")
        default: print("rig: not understood: \(ask)")
        }
        lastTouch = Date()
        continue
      }
      if lines.contains(where: { $0.hasPrefix("done") || $0.hasPrefix("failed") }) { return }
      Thread.sleep(forTimeInterval: 0.25)
    }
    XCTFail("the smoke did not end in \(limit) s")
  }
}
