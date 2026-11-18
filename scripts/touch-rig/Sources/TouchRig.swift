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
final class TouchRig: XCTestCase {
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
    let path = unsafeBitCast(rawPath.method(for: start), to: Start.self)(rawPath, start, pts[0], 0).takeUnretainedValue() as! NSObject
    // a rest where it lands, then 0.12 s a point
    var t = 0.25
    for p in pts.dropFirst() {
      unsafeBitCast(path.method(for: move), to: Move.self)(path, move, p, t)
      t += 0.12
    }
    unsafeBitCast(path.method(for: lift), to: Lift.self)(path, lift, t + 0.1)
    let rawRecord = recordClass.perform(NSSelectorFromString("alloc")).takeUnretainedValue() as! NSObject
    let record = unsafeBitCast(rawRecord.method(for: named), to: Named.self)(rawRecord, named, "loop", UIInterfaceOrientation.portrait.rawValue).takeUnretainedValue() as! NSObject
    _ = record.perform(add, with: path)
    var failed: NSError?
    let ok = unsafeBitCast(record.method(for: run), to: Run.self)(record, run, &failed)
    if !ok { print("rig: the path was not made: \(String(describing: failed))") }
    return ok
  }

  /// Several fingers at once, each through its own points with its own times, by the same pointer paths `through` uses.
  private func fingers(_ paths: [[(CGPoint, Double)]]) -> Bool {
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
    let record = unsafeBitCast(rawRecord.method(for: named), to: Named.self)(rawRecord, named, "fingers", UIInterfaceOrientation.portrait.rawValue).takeUnretainedValue() as! NSObject
    for pts in paths where !pts.isEmpty {
      let rawPath = pathClass.perform(NSSelectorFromString("alloc")).takeUnretainedValue() as! NSObject
      let path = unsafeBitCast(rawPath.method(for: start), to: Start.self)(rawPath, start, pts[0].0, pts[0].1).takeUnretainedValue() as! NSObject
      for p in pts.dropFirst() { unsafeBitCast(path.method(for: move), to: Move.self)(path, move, p.0, p.1) }
      unsafeBitCast(path.method(for: lift), to: Lift.self)(path, lift, (pts.last?.1 ?? 0) + 0.05)
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
    app.launch()
    let at = { (x: Double, y: Double) in app.coordinate(withNormalizedOffset: CGVector(dx: x, dy: y)) }
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
        switch parts.first ?? "" {
        case "tap" where n.count >= 2: at(n[0], n[1]).tap()
        case "tap2" where n.count >= 2: at(n[0], n[1]).doubleTap()
        case "press" where n.count >= 3: at(n[0], n[1]).press(forDuration: n[2])
        case "drag" where n.count >= 5: at(n[0], n[1]).press(forDuration: n[4], thenDragTo: at(n[2], n[3]), withVelocity: .slow, thenHoldForDuration: 0.15)
        case "flick" where n.count >= 4: at(n[0], n[1]).press(forDuration: 0.02, thenDragTo: at(n[2], n[3]), withVelocity: .fast, thenHoldForDuration: 0)
        case "type": app.typeText(String(ask.dropFirst(9)))
        case "open": XCUIDevice.shared.system.open(URL(string: String(ask.dropFirst(9)))!)
        case "away" where n.count >= 1: XCUIDevice.shared.press(.home); Thread.sleep(forTimeInterval: n[0]); app.activate()
        case "loop" where n.count >= 6 && n.count % 2 == 0:
          let f = app.frame
          let pts = stride(from: 0, to: n.count, by: 2).map { CGPoint(x: f.minX + n[$0] * f.width, y: f.minY + n[$0 + 1] * f.height) }
          if !through(pts) { print("rig: no path through points in this Xcode: \(ask)") }
        case "pinch" where n.count >= 8:
          let f = app.frame
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
          let f = app.frame
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
          let f = app.frame
          let secs = n[n.count - 1]
          var t = 0.1
          var pts: [(CGPoint, Double)] = []
          for i in stride(from: 0, to: n.count - 1, by: 2) {
            pts.append((CGPoint(x: f.minX + n[i] * f.width, y: f.minY + n[i + 1] * f.height), i == 0 ? 0 : t))
            t += 0.045
          }
          if let last = pts.last { pts.append((last.0, last.1 + secs)) }
          if !fingers([pts]) { print("rig: no rest in this Xcode: \(ask)") }
        case "turn": XCUIDevice.shared.orientation = parts.last == "landscape" ? .landscapeLeft : .portrait
        default: print("rig: not understood: \(ask)")
        }
        continue
      }
      if lines.contains(where: { $0.hasPrefix("done") || $0.hasPrefix("failed") }) { return }
      Thread.sleep(forTimeInterval: 0.25)
    }
    XCTFail("the smoke did not end in \(limit) s")
  }
}
