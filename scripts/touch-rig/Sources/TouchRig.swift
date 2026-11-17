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
//   tap x y · press x y seconds · drag x1 y1 x2 y2 hold · flick x1 y1 x2 y2 · turn portrait|landscape
//   · type <text> (into what has the caret) · open <link> (as a Shortcut's "open URL" arrives)
//   · away <seconds> (the app sent home, and brought back after that long)
//   · loop x1 y1 x2 y2 x3 y3 … (one finger through every point in turn, slowly, and lifted: a lasso's loop,
//     which no public call of XCUITest draws; `through` below)
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
