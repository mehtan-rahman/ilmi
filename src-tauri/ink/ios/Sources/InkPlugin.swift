// Ink where the Pencil lands (milestones 69, 82). There is nothing to open: the canvases are already there.
//
// A layer lies over the web view and takes no touch. In it are PencilKit canvases, a sheet each: a page of a
// written notebook or of a PDF, or an ink area a typed note already holds, for what is on the screen and near
// it. Each canvas's drawing recogniser is on the web view, not on the canvas, and takes the Pencil only: so a
// finger goes to the web view as it always did, and scrolls and taps; the Pencil goes to the one canvas under
// it, and PencilKit inks from the first touch with no word from the page.
//
// Which canvas: every touch passes through the layer's `hitTest` before any recogniser sees it. It does not
// say what is touching, but it says where. So `arm` enables the one canvas under that point and takes the
// Pencil from the web view's own recognisers there (or gives it back where nothing is written: over the
// tree, a word, a menu, a typed note's text, the Pencil is a finger). Nothing opens a new area any more (82):
// a typed note takes no new handwriting, and what it holds stays a sheet.
//
// Where it stays. The page says once, each time its layout changes, where each sheet lies in its scroller's
// own content (`scene`). A scroller on iOS is a real `UIScrollView` inside the web view; the layer finds it by
// its frame and watches its `contentOffset`, and moves the sheets in the same turn of the main thread. So a
// finger's scroll never crosses to the page and back, and the ink keeps to the text it was written by.
//
// Between strokes a canvas is hidden and the page shows the picture of the same strokes: anything the page
// lays over a note lies over its ink, and the canvas comes back with the Pencil's next touch, at once, since
// it holds the drawing all along.
//
// The tools are the page's (82): there is no `PKToolPicker`. The page says which tool is held (`tool`) and every
// canvas takes it. A pen and a highlighter are PencilKit's inks. The eraser and the lasso are done here, since
// PencilKit's own do nothing through a recogniser moved onto the web view (69): with either held no canvas's
// recogniser is on, the web view still does not see the Pencil over a sheet, and the watcher's touches take
// strokes out or pick them and move them. One undo manager is every canvas's, PencilKit's strokes and these
// steps alike (`undo`, `redo`). With `finger` on a finger writes as the Pencil does and two scroll. The colour
// wheel is the system's, put up from where the page says (`color`).

import CoreHaptics
import PencilKit
import SwiftRs
import Tauri
import UIKit
import UIKit.UIGestureRecognizerSubclass
import WebKit

struct Box: Codable {
  var x: Double
  var y: Double
  var w: Double
  var h: Double
  var rect: CGRect { CGRect(x: x, y: y, width: w, height: h) }
  init(_ r: CGRect) {
    x = Double(r.minX); y = Double(r.minY); w = Double(r.width); h = Double(r.height)
  }
}

struct SheetSpec: Decodable {
  var id: String
  /// The canvas, in the scroller's content.
  var frame: Box
  /// Where the Pencil adds to this sheet, in the scroller's content.
  var hit: Box
  /// Points of the drawing to points of the screen: a book's page is drawn in its own.
  var zoom: Double?
}

struct HostSpec: Decodable {
  var id: String
  /// The scroller on the page, by which its scroll view is found.
  var view: Box
  /// What of it ink shows in and the Pencil writes in, on the page.
  var port: Box
  var top: Double
  /// How tall its content is: another scroller may stand in the same place, a tab behind this one.
  var height: Double
  /// Where a Pencil off every sheet opened a new one, before 82: read so an older page's scene still decodes, and not used.
  var open: Box?
  var sheets: [SheetSpec]
}

struct SceneArgs: Decodable {
  var hosts: [HostSpec]
  var dark: Bool?
}

struct SheetArgs: Decodable {
  var sheet: String
  var drawing: String?
}

struct HoldArgs: Decodable {
  var on: Bool
}

struct Held: Encodable {
  /// Whether the app is held awake now, and the seconds the system says are left to it in the background (-1 in front).
  var held: Bool
  var left: Double
}

/// A tap asked for by name: `light`, `medium`, `soft`, `warning`, `success`, `tick`; anything else makes none.
struct HapticArgs: Decodable {
  var kind: String
}

struct Haptics: Encodable {
  /// Whether this device has the hardware: an iPhone has, no iPad has.
  var can: Bool
}

struct PenArgs: Decodable {
  var on: Bool
}

/// The tool held: `pen`, `highlighter`, `eraser` or `select`; its colour as `#rrggbb`; the ink's width in points,
/// or for the eraser how far it reaches, in the screen's.
struct ToolSpec: Codable {
  var kind: String
  var color: String
  var width: Double
}

struct ToolArgs: Decodable {
  var tool: ToolSpec
}

struct ColorArgs: Decodable {
  var color: String?
  /// What the wheel points at, in the web view's points.
  var at: Box?
}

struct WheelArgs: Decodable {
  var color: String
}

/// The colour the wheel closed on; null when none was chosen.
struct Chosen: Encodable {
  let color: String?
  enum Keys: String, CodingKey { case color }
  func encode(to encoder: Encoder) throws {
    var c = encoder.container(keyedBy: Keys.self)
    if let color = color { try c.encode(color, forKey: .color) } else { try c.encodeNil(forKey: .color) }
  }
}

/// What can be taken back and put back now.
struct History: Encodable {
  let undo: Bool
  let redo: Bool
}

func colour(_ hex: String) -> UIColor? {
  var h = hex.trimmingCharacters(in: .whitespaces)
  if h.hasPrefix("#") { h.removeFirst() }
  guard h.count == 6, let n = UInt32(h, radix: 16) else { return nil }
  return UIColor(red: CGFloat((n >> 16) & 0xff) / 255, green: CGFloat((n >> 8) & 0xff) / 255, blue: CGFloat(n & 0xff) / 255, alpha: 1)
}

/// A colour as `#rrggbb`, in sRGB: the wheel gives wider ones.
func hex(_ c: UIColor) -> String {
  var parts: [CGFloat] = [0, 0, 0]
  if let space = CGColorSpace(name: CGColorSpace.sRGB), let s = c.cgColor.converted(to: space, intent: .defaultIntent, options: nil), let k = s.components, k.count >= 3 {
    parts = [k[0], k[1], k[2]]
  } else {
    var r: CGFloat = 0, g: CGFloat = 0, b: CGFloat = 0, a: CGFloat = 0
    c.getRed(&r, green: &g, blue: &b, alpha: &a)
    parts = [r, g, b]
  }
  let v = parts.map { Int((min(max($0, 0), 1) * 255).rounded()) }
  return String(format: "#%02x%02x%02x", v[0], v[1], v[2])
}

/// The sheets a scene made anew: their canvases hold nothing yet.
struct Made: Encodable {
  let made: [String]
}

struct Took: Encodable {
  let took: Bool
}

struct Taken: Encodable {
  let strokes: Int
  let drawing: String?
}

struct SheetState: Encodable {
  let id: String
  let strokes: Int
  let shown: Bool
  let dirty: Bool
  /// The canvas on the screen, in the web view's points.
  let at: Box
}

struct HostState: Encodable {
  let id: String
  /// Whether it found the scroller's scroll view, and where that stands.
  let follows: Bool
  let offset: Double
  let port: Box
}

/// What the Pencil's last touch cost, in milliseconds from the touch's own instant.
struct Touched: Encodable {
  /// To the layer having a canvas under that point (the `hitTest`).
  var armed: Double?
  /// To the watcher seeing it.
  var seen: Double?
  /// To its first move.
  var moved: Double?
  /// To PencilKit starting the stroke.
  var ink: Double?
  /// To the page's answer, when a touch opened an area: none since 82.
  var page: Double?
  /// The stroke's first point against the touch, in points: nothing of it lost if near none.
  var lost: Double?
  /// Whether it opened an area: never since 82.
  var fresh: Bool = false
}

struct State: Encodable {
  let sheets: [SheetState]
  let hosts: [HostState]
  /// PencilKit's picker, which is gone: always false.
  let tools: Bool
  let tool: ToolSpec
  let finger: Bool
  let undo: Bool
  let redo: Bool
  /// The colour wheel is up.
  let wheel: Bool
  /// How many strokes the lasso holds.
  let selected: Int
  let down: Bool
  let scribble: Int
  let touched: Touched?
  let lastTouched: [Touched]
}

/// Over the web view: takes no touch, and is told of every one first.
final class InkLayer: UIView {
  weak var plugin: InkPlugin?
  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    if event == nil || event?.type == .touches { plugin?.arm(point) }
    return nil
  }
}

/// One port on the page: a scroller's visible part, with the sheets in its content.
final class Host {
  let id: String
  let clip = UIView()
  let content = UIView()
  var spec: HostSpec
  weak var scroll: UIScrollView?
  var watching: NSKeyValueObservation?
  init(_ spec: HostSpec) {
    self.id = spec.id
    self.spec = spec
    clip.clipsToBounds = true
    clip.isUserInteractionEnabled = false
    content.isUserInteractionEnabled = false
    clip.addSubview(content)
  }
}

/// A canvas whose strokes are undone by the plugin's one undo manager, not the window's.
final class InkCanvas: PKCanvasView {
  weak var history: UndoManager?
  override var undoManager: UndoManager? { history ?? super.undoManager }
}

final class Sheet: NSObject, PKCanvasViewDelegate {
  var id: String
  let canvas = InkCanvas()
  weak var host: Host?
  var hit = CGRect.zero
  var zoom: CGFloat = 1
  var dirty = false
  /// Something done on it may be in the undo manager: when it goes, what can be undone goes.
  var stepped = false
  /// The last place the page gave while a stroke was going on: taken up when the stroke ends.
  var waiting: SheetSpec?
  var grownAt: CGFloat = 0
  var quiet: DispatchWorkItem?
  weak var plugin: InkPlugin?

  init(id: String, plugin: InkPlugin) {
    self.id = id
    self.plugin = plugin
    super.init()
    canvas.backgroundColor = .clear
    canvas.isOpaque = false
    canvas.isUserInteractionEnabled = false
    canvas.isScrollEnabled = false
    canvas.showsVerticalScrollIndicator = false
    canvas.showsHorizontalScrollIndicator = false
    canvas.contentInsetAdjustmentBehavior = .never
    canvas.isHidden = true
    canvas.history = plugin.history
    canvas.delegate = self
  }

  /// What the page last gave it or took from it: PencilKit says a drawing changed when it is given one, whenever it likes.
  var given = PKDrawing()

  func place(_ frame: CGRect, zoom z: CGFloat) {
    if canvas.frame != frame { canvas.frame = frame }
    if abs(z - zoom) > 0.0001 || canvas.zoomScale != z {
      zoom = z
      canvas.maximumZoomScale = max(canvas.maximumZoomScale, z)
      canvas.minimumZoomScale = min(canvas.minimumZoomScale, z)
      canvas.zoomScale = z
      canvas.minimumZoomScale = z
      canvas.maximumZoomScale = z
    }
    if canvas.contentSize != frame.size { canvas.contentSize = frame.size }
    if canvas.contentOffset != .zero { canvas.contentOffset = .zero }
  }

  func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
    if canvasView.drawing == given { return }
    dirty = true
    stepped = true
    plugin?.changed(self)
  }

  func canvasViewDidBeginUsingTool(_ canvasView: PKCanvasView) {
    plugin?.inking(self)
  }
}

/// Sees the Pencil go by and takes nothing: the moment it lands and where it goes.
final class PenWatch: UIGestureRecognizer, UIGestureRecognizerDelegate {
  weak var plugin: InkPlugin?
  private var touch: UITouch?

  override init(target: Any?, action: Selector?) {
    super.init(target: target, action: action)
    cancelsTouchesInView = false
    delaysTouchesBegan = false
    delaysTouchesEnded = false
    delegate = self
  }

  func gestureRecognizer(_ g: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }

  override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
    guard touch == nil, let t = touches.first else {
      // a second finger beside the one writing: the two scroll
      plugin?.penJoined()
      return
    }
    touch = t
    plugin?.penDown(t)
  }

  override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
    if let t = touch, touches.contains(t) { plugin?.penMoved(t) }
  }

  private func finish(_ touches: Set<UITouch>) {
    guard let t = touch, touches.contains(t) else { return }
    touch = nil
    state = .failed
    plugin?.penUp()
  }

  override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) { finish(touches) }
  override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) { finish(touches) }
  override func reset() { touch = nil }
}

/// The system's colour wheel while it is up, and the page's asking that waits for it.
final class Wheel: NSObject, UIColorPickerViewControllerDelegate, UIPopoverPresentationControllerDelegate {
  weak var plugin: InkPlugin?
  let invoke: Invoke
  let view = UIColorPickerViewController()
  var chosen: String?
  private var done = false

  init(invoke: Invoke, plugin: InkPlugin, color: UIColor?) {
    self.invoke = invoke
    self.plugin = plugin
    super.init()
    view.supportsAlpha = false
    if let c = color { view.selectedColor = c }
    view.delegate = self
  }

  func pick(_ c: UIColor) {
    let h = hex(c)
    if done || h == chosen { return }
    chosen = h
    plugin?.emit(["kind": "color", "color": h])
  }

  /// Closed, however it was: the page's asking is answered once.
  func finish() {
    if done { return }
    done = true
    invoke.resolve(Chosen(color: chosen))
    plugin?.wheelGone(self)
  }

  func colorPickerViewControllerDidSelectColor(_ viewController: UIColorPickerViewController) {
    pick(viewController.selectedColor)
  }

  @available(iOS 15.0, *)
  func colorPickerViewController(_ viewController: UIColorPickerViewController, didSelect color: UIColor, continuously: Bool) {
    pick(color)
  }

  func colorPickerViewControllerDidFinish(_ viewController: UIColorPickerViewController) {
    if viewController.presentingViewController != nil { viewController.dismiss(animated: true) }
    finish()
  }

  /// A tap outside it.
  func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
    finish()
  }
}

/// What the Pencil is doing with a tool of the plugin's own.
private enum Own {
  /// Taking strokes out: the drawing as the Pencil found it, and where the Pencil was last, in the drawing's points.
  case erase(before: PKDrawing, last: CGPoint)
  /// Drawing the lasso's loop: in the drawing's points, and in the host's content for showing.
  case loop(points: [CGPoint], shown: [CGPoint])
  /// Moving what the lasso holds: the drawing and its strokes as they were, which of them, where the Pencil came down.
  case drag(before: PKDrawing, base: [PKStroke], at: [Int], from: CGPoint, moved: Bool)
}

/// The strokes the lasso holds: which of the sheet's drawing, as long as the drawing is this one.
private struct Picked {
  let sheet: Sheet
  var at: [Int]
  var drawing: PKDrawing
}

class InkPlugin: Plugin {
  private weak var web: WKWebView?
  private var layer: InkLayer?
  private var watch: PenWatch?
  private var hosts: [String: Host] = [:]
  private var sheets: [String: Sheet] = [:]
  private var armed: Sheet?
  private var armedHost: Host?
  private var armedAt: TimeInterval = 0
  private var active: Sheet?
  private var down = false
  /// A finger stands in for the Pencil, for a check on a simulator that has none.
  private var standIn = false
  /// The page's `draw with finger`: a finger writes as the Pencil does, and two scroll.
  private var finger = false
  private var fingerWrites: Bool { standIn || finger }
  /// The tool held, and the ink every canvas has: the last pen or highlighter.
  private var tool = ToolSpec(kind: "pen", color: "#000000", width: 2.2)
  private var ink = PKInkingTool(.pen, color: .black, width: 2.2)
  private var ours: Bool { tool.kind == "eraser" || tool.kind == "select" }
  /// Every canvas's undo manager.
  fileprivate let history = UndoManager()
  private var told = (false, false)
  private var telling = false
  private var keeping = false
  /// Until when a change is kept at once: an undo's or a redo's.
  private var hurry: TimeInterval = 0
  private var own: Own?
  /// A second finger came down, or the tool changed, in mid-gesture: the rest of it does nothing.
  private var spent = false
  private var picked: Picked?
  private let loop = CAShapeLayer()
  private let outline = CAShapeLayer()
  private var wheel: Wheel?
  private var dark = false
  private var made: [String] = []
  private var penOff = false
  private var kept: [ObjectIdentifier: (UIGestureRecognizer, [NSNumber])] = [:]
  private var pans: [(UIPanGestureRecognizer, Int)] = []
  private var rootWatch: NSKeyValueObservation?
  private var scribble = 0
  private var touched: Touched?
  private var touchedAt: TimeInterval = 0
  private var inkedAt: TimeInterval = 0
  private var touchedAtPoint: CGPoint = .zero
  private var lastTouched: [Touched] = []

  /// How long the writing is left alone before it is kept.
  private let quietAfter = 2.5
  /// How near the lower edge the Pencil is when an area grows.
  private let edge: CGFloat = 72

  override func load(webview: WKWebView) {
    web = webview
    NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in self?.wentAway() }
    history.levelsOfUndo = 200
    for name in [Notification.Name.NSUndoManagerDidUndoChange, .NSUndoManagerDidRedoChange, .NSUndoManagerDidCloseUndoGroup, .NSUndoManagerDidOpenUndoGroup] {
      NotificationCenter.default.addObserver(forName: name, object: history, queue: nil) { [weak self] _ in self?.historySoon() }
    }
    for l in [loop, outline] {
      l.fillColor = nil
      l.strokeColor = UIColor(white: 0.5, alpha: 0.9).cgColor
      l.lineWidth = 1.5
      l.lineDashPattern = [6, 4]
      l.zPosition = 10
    }
  }

  // ── Going to the background (not ink's: the plugin is the app's one piece of native iOS code) ──
  //
  // iOS suspends an app a moment after it leaves the screen, and with it the page and its sync. What was written in
  // the last seconds before the app was left would wait on the device until it is next opened. So when the app
  // goes, it asks the system for time (`beginBackgroundTask`, half a minute or so): a grace of a few seconds in
  // which the page hears it is hidden and starts its send, and the page's own hold (`hold`) while the send runs.
  // Each ends when it is done or when the system says time is up, whichever is first.
  private var grace: UIBackgroundTaskIdentifier = .invalid
  private var holding: UIBackgroundTaskIdentifier = .invalid
  private let graceFor = 6.0

  private func wentAway() {
    endTask(&grace)
    grace = UIApplication.shared.beginBackgroundTask(withName: "ilmi: the page hears it is hidden") { [weak self] in self?.endGrace() }
    DispatchQueue.main.asyncAfter(deadline: .now() + graceFor) { [weak self] in self?.endGrace() }
  }

  private func endGrace() { endTask(&grace) }
  private func endHold() { endTask(&holding) }

  private func endTask(_ task: inout UIBackgroundTaskIdentifier) {
    guard task != .invalid else { return }
    UIApplication.shared.endBackgroundTask(task)
    task = .invalid
  }

  /// The page's send has started (`on`) or ended: the app is kept awake for it in the background, as long as the system allows.
  @objc public func hold(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(HoldArgs.self)
    DispatchQueue.main.async {
      if args.on {
        if self.holding == .invalid {
          self.holding = UIApplication.shared.beginBackgroundTask(withName: "ilmi: what was written goes out") { [weak self] in self?.endHold() }
        }
      } else {
        self.endHold()
      }
      let left = UIApplication.shared.applicationState == .background ? UIApplication.shared.backgroundTimeRemaining : -1
      invoke.resolve(Held(held: self.holding != .invalid, left: left.isFinite ? left : -1))
    }
  }

  // ── Haptics (not ink's either; milestone 83) ──
  //
  // The page asks for a tap by name (`src/app/haptics.ts`): an impact for an answer shown and a grade by which it
  // was, a notification for `again` and for the queue's end, the selection's tick for small things done. UIKit's
  // generators do nothing where there is no Taptic Engine, and every answer says whether there is one, so the
  // page shows its setting only where it means something. A simulator has none and is taken at its word as a phone.
  private lazy var canHaptic: Bool = {
    #if targetEnvironment(simulator)
    return UIDevice.current.userInterfaceIdiom == .phone
    #else
    return CHHapticEngine.capabilitiesForHardware().supportsHaptics
    #endif
  }()
  private lazy var impacts: [String: UIImpactFeedbackGenerator] = [
    "light": UIImpactFeedbackGenerator(style: .light),
    "medium": UIImpactFeedbackGenerator(style: .medium),
    "soft": UIImpactFeedbackGenerator(style: .soft),
  ]
  private lazy var notes = UINotificationFeedbackGenerator()
  private lazy var ticks = UISelectionFeedbackGenerator()

  @objc public func haptic(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(HapticArgs.self)
    DispatchQueue.main.async {
      if self.canHaptic {
        if let impact = self.impacts[args.kind] {
          impact.impactOccurred()
          impact.prepare()
        } else if args.kind == "warning" || args.kind == "success" {
          self.notes.notificationOccurred(args.kind == "warning" ? .warning : .success)
          self.notes.prepare()
        } else if args.kind == "tick" {
          self.ticks.selectionChanged()
          self.ticks.prepare()
        }
      }
      invoke.resolve(Haptics(can: self.canHaptic))
    }
  }

  private func prepare() {
    guard layer == nil, let web = web, let parent = web.superview else { return }
    let l = InkLayer(frame: web.frame)
    l.plugin = self
    l.backgroundColor = .clear
    l.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    parent.insertSubview(l, aboveSubview: web)
    layer = l
    let w = PenWatch(target: nil, action: nil)
    w.plugin = self
    web.addGestureRecognizer(w)
    watch = w
    setTouchTypes()
    rootWatch = web.scrollView.observe(\.contentOffset, options: []) { [weak self] _, _ in self?.layOut() }
    silenceScribble()
  }

  /// Scribble turns a Pencil on editable text into typing, before any recogniser of ours: the Pencil writes ink here.
  private func silenceScribble() {
    guard let web = web else { return }
    walk(web) { v in
      for i in v.interactions where String(describing: type(of: i)).contains("Scribble") {
        v.removeInteraction(i)
        self.scribble += 1
      }
    }
  }

  private func walk(_ v: UIView, _ f: (UIView) -> Void) {
    f(v)
    for s in v.subviews { walk(s, f) }
  }

  // ── what is a Pencil here ──

  private var penTypes: [NSNumber] {
    fingerWrites ? [NSNumber(value: UITouch.TouchType.pencil.rawValue), NSNumber(value: UITouch.TouchType.direct.rawValue)] : [NSNumber(value: UITouch.TouchType.pencil.rawValue)]
  }

  private func setTouchTypes() {
    watch?.allowedTouchTypes = penTypes
    let policy: PKCanvasViewDrawingPolicy = fingerWrites ? .anyInput : .pencilOnly
    for s in sheets.values where s.canvas.drawingPolicy != policy { s.canvas.drawingPolicy = policy }
  }

  /// Where the Pencil writes the web view's own recognisers do not see it: no scroll, no caret, no selection, no tap.
  /// With `draw with finger` a finger is taken from them likewise, but for a scroller's pan, which keeps fingers
  /// and wants two of them.
  private func webSeesPen(_ yes: Bool) {
    guard let web = web, penOff == yes else { return }
    penOff = !yes
    if yes {
      for (_, k) in kept { k.0.allowedTouchTypes = k.1 }
      kept.removeAll()
      for (g, n) in pans { g.minimumNumberOfTouches = n }
      pans.removeAll()
      return
    }
    let pens = Set(penTypes.map { $0.intValue })
    let pencil = UITouch.TouchType.pencil.rawValue
    let mine = Set(allCanvasRecognisers().map { ObjectIdentifier($0) })
    walk(web) { v in
      for g in v.gestureRecognizers ?? [] where !mine.contains(ObjectIdentifier(g)) && g !== self.watch {
        let was = g.allowedTouchTypes
        self.kept[ObjectIdentifier(g)] = (g, was)
        if self.finger, let scroller = v as? UIScrollView, g === scroller.panGestureRecognizer {
          let pan = scroller.panGestureRecognizer
          self.pans.append((pan, pan.minimumNumberOfTouches))
          pan.minimumNumberOfTouches = max(2, pan.minimumNumberOfTouches)
          g.allowedTouchTypes = was.filter { $0.intValue != pencil }
        } else {
          g.allowedTouchTypes = was.filter { !pens.contains($0.intValue) }
        }
      }
    }
  }

  private func allCanvasRecognisers() -> [UIGestureRecognizer] {
    sheets.values.map { $0.canvas.drawingGestureRecognizer }
  }

  // ── a touch is coming ──

  fileprivate func arm(_ p: CGPoint) {
    if down { return }
    guard let layer = layer else { return }
    var target: Sheet? = nil
    var host: Host? = nil
    for h in hosts.values where h.clip.frame.contains(p) {
      // a scroller the web view had not yet made a scroll view of, when the page last spoke
      if h.scroll == nil {
        bind(h)
        follow(h)
      }
      let q = layer.convert(p, to: h.content)
      host = h
      if let s = h.spec.sheets.compactMap({ sheets[$0.id] }).first(where: { $0.hit.contains(q) }) {
        target = s
      } else {
        host = nil
      }
      break
    }
    // a touch off the sheet the lasso picked on lets go of what it holds
    if let k = picked, k.sheet !== target { unpick() }
    // said for every canvas at every touch: PencilKit turns its recogniser back on when it likes (a canvas
    // new to the window, a tool it is given), and two of them would each begin the stroke. Under the eraser
    // and the lasso none is on: the watcher's touches are the tool
    let want = ours ? nil : target?.canvas.drawingGestureRecognizer
    for g in allCanvasRecognisers() where g !== want && g.isEnabled { g.isEnabled = false }
    if let g = want {
      if g.view !== web { web?.addGestureRecognizer(g) }
      g.isEnabled = true
    }
    armed = target
    armedHost = host
    armedAt = ProcessInfo.processInfo.systemUptime
    webSeesPen(target == nil)
  }

  private func isPen(_ t: UITouch) -> Bool { t.type == .pencil || fingerWrites }

  /// Where a touch is in a sheet's drawing.
  private func point(_ t: UITouch, in s: Sheet) -> CGPoint {
    let p = t.location(in: s.canvas)
    let z = max(s.canvas.zoomScale, 0.01)
    return CGPoint(x: p.x / z, y: p.y / z)
  }

  fileprivate func penDown(_ t: UITouch) {
    guard isPen(t), let s = armed, let h = armedHost, layer != nil else { return }
    let now = ProcessInfo.processInfo.systemUptime
    down = true
    active = s
    spent = false
    own = nil
    s.quiet?.cancel()
    s.canvas.isHidden = false
    touched = Touched(armed: (armedAt - t.timestamp) * 1000, seen: (now - t.timestamp) * 1000, ink: inkedAt >= t.timestamp ? (inkedAt - t.timestamp) * 1000 : nil)
    touchedAt = t.timestamp
    touchedAtPoint = t.location(in: s.canvas)
    if touchedAtPoint.x.isNaN { touchedAtPoint = .zero }
    let q = t.location(in: h.content)
    s.grownAt = 0
    let p = point(t, in: s)
    if tool.kind == "eraser" {
      unpick()
      own = .erase(before: s.canvas.drawing, last: p)
      erase(s, from: p, to: p)
    } else if tool.kind == "select" {
      if let k = picked, k.sheet === s, let box = held(k), box.insetBy(dx: -8 / max(s.canvas.zoomScale, 0.01), dy: -8 / max(s.canvas.zoomScale, 0.01)).contains(p) {
        own = .drag(before: s.canvas.drawing, base: s.canvas.drawing.strokes, at: k.at, from: p, moved: false)
      } else {
        unpick()
        own = .loop(points: [p], shown: [q])
        show(loop, in: h, path: nil)
      }
    } else {
      unpick()
    }
    emit(["kind": "begin", "sheet": s.id, "host": h.id, "fresh": false, "x": q.x, "y": q.y, "top": s.canvas.frame.minY])
  }

  /// A second finger beside the one that writes: under a tool of the plugin's own the gesture is over, and the two scroll.
  fileprivate func penJoined() {
    guard down, own != nil, !spent else { return }
    spent = true
    hide(loop)
  }

  fileprivate func penMoved(_ t: UITouch) {
    guard down, let s = active, let h = s.host else { return }
    if var m = touched, m.moved == nil {
      m.moved = (t.timestamp - touchedAt) * 1000
      touched = m
    }
    let q = t.location(in: h.content)
    if spent { return }
    if let o = own {
      let p = point(t, in: s)
      switch o {
      case let .erase(before, last):
        erase(s, from: last, to: p)
        own = .erase(before: before, last: p)
      case let .loop(points, shown):
        own = .loop(points: points + [p], shown: shown + [q])
        let path = UIBezierPath()
        path.move(to: shown[0])
        for at in shown.dropFirst() { path.addLine(to: at) }
        path.addLine(to: q)
        show(loop, in: h, path: path.cgPath)
      case let .drag(before, base, at, from, _):
        let by = CGAffineTransform(translationX: p.x - from.x, y: p.y - from.y)
        var strokes = base
        for i in at where i < strokes.count { strokes[i].transform = base[i].transform.concatenating(by) }
        let d = PKDrawing(strokes: strokes)
        picked?.drawing = d
        put(s, d)
        picked?.drawing = s.canvas.drawing
        own = .drag(before: before, base: base, at: at, from: from, moved: true)
        ring()
      }
      return
    }
    if s.hit != .zero, q.y > s.hit.maxY - edge, q.y > s.grownAt + 24 {
      s.grownAt = q.y
      emit(["kind": "grow", "sheet": s.id, "y": q.y])
    }
  }

  fileprivate func penUp() {
    guard down, let s = active else { return }
    down = false
    active = nil
    finishOwn(s)
    if let spec = s.waiting, let h = s.host {
      s.waiting = nil
      apply(spec, in: h)
    }
    emit(["kind": "end", "sheet": s.id])
    wait(s)
  }

  /// The Pencil lifted, or the tool changed under it: what the eraser took or the lasso moved is one step to undo, and a loop picks.
  private func finishOwn(_ s: Sheet) {
    guard let o = own else { return }
    own = nil
    hide(loop)
    switch o {
    case let .erase(before, _):
      let after = s.canvas.drawing
      if after != before { step(s, from: before, to: after) }
    case let .loop(points, _):
      if !spent { pick(s, within: points) }
    case let .drag(before, _, _, _, moved):
      let after = s.canvas.drawing
      if moved, after != before { step(s, from: before, to: after) }
      picked?.drawing = after
      ring()
    }
  }

  // ── the eraser and the lasso ──

  /// A sheet's drawing set from here, and told as PencilKit's own change is.
  private func put(_ s: Sheet, _ d: PKDrawing) {
    s.canvas.drawing = d
    if s.canvas.drawing != s.given {
      s.dirty = true
      changed(s)
    }
  }

  private func far(_ p: CGPoint, from a: CGPoint, to b: CGPoint) -> CGFloat {
    let dx = b.x - a.x, dy = b.y - a.y
    let len = dx * dx + dy * dy
    if len < 0.000001 { return hypot(p.x - a.x, p.y - a.y) }
    let t = min(max(((p.x - a.x) * dx + (p.y - a.y) * dy) / len, 0), 1)
    return hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
  }

  /// A stroke's points as they lie in the drawing, one every `by` points along it, each with half its width.
  private func along(_ k: PKStroke, by: CGFloat, _ f: (CGPoint, CGFloat) -> Bool) {
    let path = k.path
    if path.count == 0 { return }
    if path.count == 1 {
      let p = path[0]
      _ = f(p.location.applying(k.transform), (p.size.width + p.size.height) / 4)
      return
    }
    for p in path.interpolatedPoints(by: .distance(max(by, 0.5))) {
      if !f(p.location.applying(k.transform), (p.size.width + p.size.height) / 4) { return }
    }
  }

  /// Every stroke the eraser came upon between `a` and `b` goes, whole.
  private func erase(_ s: Sheet, from a: CGPoint, to b: CGPoint) {
    let r = CGFloat(max(tool.width, 1)) / max(s.canvas.zoomScale, 0.01)
    let reach = CGRect(x: min(a.x, b.x), y: min(a.y, b.y), width: abs(a.x - b.x), height: abs(a.y - b.y)).insetBy(dx: -r, dy: -r)
    var left: [PKStroke] = []
    var gone = false
    for k in s.canvas.drawing.strokes {
      var hit = false
      if k.renderBounds.intersects(reach) {
        along(k, by: max(1, r)) { p, half in
          if self.far(p, from: a, to: b) <= r + half { hit = true }
          return !hit
        }
      }
      if hit { gone = true } else { left.append(k) }
    }
    if gone { put(s, PKDrawing(strokes: left)) }
  }

  /// The strokes with most of themselves inside the loop are what the lasso holds.
  private func pick(_ s: Sheet, within points: [CGPoint]) {
    guard points.count >= 3 else { return }
    let path = UIBezierPath()
    path.move(to: points[0])
    for p in points.dropFirst() { path.addLine(to: p) }
    path.close()
    let box = path.bounds
    let z = max(s.canvas.zoomScale, 0.01)
    if box.width + box.height < 8 / z { return }
    let d = s.canvas.drawing
    var at: [Int] = []
    for (i, k) in d.strokes.enumerated() where k.renderBounds.intersects(box) {
      var all = 0, inside = 0
      along(k, by: max(2, 4 / z)) { p, _ in
        all += 1
        if path.contains(p) { inside += 1 }
        return true
      }
      if all > 0, inside * 2 > all { at.append(i) }
    }
    if at.isEmpty { return }
    picked = Picked(sheet: s, at: at, drawing: d)
    ring()
  }

  /// What the lasso holds covers this, in the drawing's points.
  private func held(_ k: Picked) -> CGRect? {
    let strokes = k.sheet.canvas.drawing.strokes
    var box: CGRect? = nil
    for i in k.at where i < strokes.count { box = box.map { $0.union(strokes[i].renderBounds) } ?? strokes[i].renderBounds }
    return box
  }

  /// The dashed rectangle round what the lasso holds, in its host's content: it scrolls with the sheet.
  private func ring() {
    guard let k = picked, let h = k.sheet.host, let box = held(k) else {
      hide(outline)
      return
    }
    let z = k.sheet.canvas.zoomScale
    let o = k.sheet.canvas.frame.origin
    let r = CGRect(x: o.x + box.minX * z, y: o.y + box.minY * z, width: box.width * z, height: box.height * z).insetBy(dx: -4, dy: -4)
    show(outline, in: h, path: UIBezierPath(rect: r).cgPath)
  }

  private func show(_ l: CAShapeLayer, in h: Host, path: CGPath?) {
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    if l.superlayer !== h.content.layer { h.content.layer.addSublayer(l) }
    l.path = path
    CATransaction.commit()
  }

  private func hide(_ l: CAShapeLayer) {
    if l.superlayer == nil { return }
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    l.path = nil
    l.removeFromSuperlayer()
    CATransaction.commit()
  }

  private func unpick() {
    if picked == nil { return }
    picked = nil
    hide(outline)
  }

  // ── undo and redo ──

  /// A step of the eraser's or the lasso's: undone, the sheet holds `before` again, and the redo is the same the other way.
  private func step(_ s: Sheet, from before: PKDrawing, to after: PKDrawing) {
    s.stepped = true
    history.registerUndo(withTarget: self) { [weak s] me in
      guard let s = s, me.sheets[s.id] === s else { return }
      me.unpick()
      me.put(s, before)
      me.step(s, from: after, to: before)
    }
    historySoon()
  }

  /// The page hears what can be undone and redone, when that is not what it last heard.
  private func historySoon() {
    if telling { return }
    telling = true
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      self.telling = false
      let now = (self.history.canUndo, self.history.canRedo)
      if now == self.told { return }
      self.told = now
      self.emit(["kind": "history", "undo": now.0, "redo": now.1])
    }
  }

  /// A sheet that may be in the undo manager is going: nothing is left to undo, so no step acts on a canvas that is gone.
  private func forget() {
    history.removeAllActions()
    for s in sheets.values { s.stepped = false }
    historySoon()
  }

  /// Every sheet that has changed is kept now, not when it has been quiet: after an undo or a redo.
  private func keepSoon() {
    if keeping { return }
    keeping = true
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      self.keeping = false
      for s in self.sheets.values where s.dirty && !(self.down && self.active === s) {
        s.quiet?.cancel()
        self.emit(["kind": "quiet", "sheet": s.id])
      }
    }
  }

  private func turn(back: Bool) {
    if down { return }
    unpick()
    hurry = ProcessInfo.processInfo.systemUptime + 1
    if back {
      if history.canUndo { history.undo() }
    } else if history.canRedo {
      history.redo()
    }
    keepSoon()
    historySoon()
  }

  fileprivate func wheelGone(_ w: Wheel) {
    if wheel === w { wheel = nil }
  }

  fileprivate func inking(_ s: Sheet) {
    // PencilKit may hear of the touch before the watcher does
    inkedAt = ProcessInfo.processInfo.systemUptime
    guard down, var t = touched, t.ink == nil else { return }
    t.ink = (inkedAt - touchedAt) * 1000
    touched = t
  }

  fileprivate func changed(_ s: Sheet) {
    if let k = picked, k.sheet === s, s.canvas.drawing != k.drawing { unpick() }
    historySoon()
    // an undo's change is kept at once
    if !(down && active === s), ProcessInfo.processInfo.systemUptime < hurry {
      keepSoon()
      return
    }
    // the stroke is the canvas's now: where it starts against where the Pencil came down
    if !ours, own == nil, var t = touched, t.lost == nil, let first = s.canvas.drawing.strokes.last?.path.first?.location {
      let z = s.canvas.zoomScale
      t.lost = Double(hypot(first.x * z - touchedAtPoint.x, first.y * z - touchedAtPoint.y))
      touched = t
      lastTouched.append(t)
      if lastTouched.count > 40 { lastTouched.removeFirst() }
    }
    wait(s)
  }

  /// Kept when the writing has been quiet: the page is told, and asks for the drawing.
  private func wait(_ s: Sheet) {
    s.quiet?.cancel()
    let item = DispatchWorkItem { [weak self, weak s] in
      guard let self = self, let s = s else { return }
      if self.down && self.active === s { return }
      if s.dirty { self.emit(["kind": "quiet", "sheet": s.id]) }
    }
    s.quiet = item
    DispatchQueue.main.asyncAfter(deadline: .now() + quietAfter, execute: item)
  }

  // ── where everything is ──

  private func makeSheet(id: String, host h: Host) -> Sheet {
    let s = Sheet(id: id, plugin: self)
    s.host = h
    s.canvas.drawingPolicy = fingerWrites ? .anyInput : .pencilOnly
    s.canvas.overrideUserInterfaceStyle = dark ? .dark : .light
    s.canvas.tool = ink
    h.content.addSubview(s.canvas)
    let g = s.canvas.drawingGestureRecognizer
    web?.addGestureRecognizer(g)
    g.isEnabled = false
    return s
  }

  private func retire(_ s: Sheet) {
    if picked?.sheet === s { unpick() }
    if s.stepped { forget() }
    let g = s.canvas.drawingGestureRecognizer
    g.isEnabled = false
    g.view?.removeGestureRecognizer(g)
    s.canvas.removeFromSuperview()
    s.quiet?.cancel()
    sheets[s.id] = nil
    if armed === s { armed = nil; armedHost = nil }
  }

  private func apply(_ spec: SheetSpec, in h: Host) {
    let s = sheets[spec.id] ?? {
      let n = makeSheet(id: spec.id, host: h)
      sheets[spec.id] = n
      made.append(spec.id)
      return n
    }()
    s.hit = spec.hit.rect
    if down && active === s {
      s.waiting = spec
      return
    }
    s.place(spec.frame.rect, zoom: CGFloat(spec.zoom ?? 1))
    if picked?.sheet === s { ring() }
  }

  private func scrollView(for box: CGRect, height: CGFloat) -> UIScrollView? {
    guard let web = web, let layer = layer else { return nil }
    var best: UIScrollView?
    walk(web.scrollView) { v in
      guard let s = v as? UIScrollView, s !== web.scrollView, s.window != nil, !s.isHidden else { return }
      let f = s.convert(s.bounds, to: layer)
      if abs(f.minX - box.minX) < 3 && abs(f.minY - box.minY) < 3 && abs(f.width - box.width) < 3 && abs(f.height - box.height) < 3 && abs(s.contentSize.height - height) < 4 { best = s }
    }
    return best
  }

  private func onLayer(_ b: Box) -> CGRect {
    guard let web = web, let layer = layer else { return b.rect }
    return web.scrollView.convert(b.rect, to: layer)
  }

  /// Every host's clip on the layer and its content where its scroller stands.
  private func layOut() {
    for h in hosts.values { follow(h) }
  }

  private func follow(_ h: Host) {
    let port = onLayer(h.spec.port)
    if h.clip.frame != port { h.clip.frame = port }
    let view = onLayer(h.spec.view)
    let y = h.scroll.map { $0.contentOffset.y } ?? CGFloat(h.spec.top)
    let origin = CGPoint(x: view.minX - port.minX, y: view.minY - port.minY - y)
    if h.content.frame.origin != origin { h.content.frame = CGRect(origin: origin, size: CGSize(width: view.width, height: 1)) }
  }

  private func bind(_ h: Host) {
    let box = onLayer(h.spec.view)
    if let s = h.scroll, s.window != nil {
      let f = s.convert(s.bounds, to: layer)
      if abs(f.minX - box.minX) < 3 && abs(f.minY - box.minY) < 3 && abs(f.width - box.width) < 3 && abs(f.height - box.height) < 3 { return }
    }
    h.watching = nil
    h.scroll = scrollView(for: box, height: CGFloat(h.spec.height))
    h.watching = h.scroll?.observe(\.contentOffset, options: []) { [weak self, weak h] _, _ in
      if let self = self, let h = h { self.follow(h) }
    }
  }

  @objc public func scene(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(SceneArgs.self)
    DispatchQueue.main.async {
      self.prepare()
      guard let layer = self.layer else {
        invoke.reject("no web view yet")
        return
      }
      if let d = args.dark, d != self.dark {
        self.dark = d
        for s in self.sheets.values { s.canvas.overrideUserInterfaceStyle = d ? .dark : .light }
      }
      self.made = []
      var listed = Set<String>()
      var named = Set<String>()
      for spec in args.hosts {
        named.insert(spec.id)
        let h = self.hosts[spec.id] ?? {
          let n = Host(spec)
          self.hosts[spec.id] = n
          layer.addSubview(n.clip)
          return n
        }()
        h.spec = spec
        self.bind(h)
        self.follow(h)
        for s in spec.sheets {
          listed.insert(s.id)
          self.apply(s, in: h)
        }
      }
      // what the page no longer shows goes, once what is on it is safe
      for s in Array(self.sheets.values) where !listed.contains(s.id) && s !== self.active {
        if s.dirty { self.emit(["kind": "quiet", "sheet": s.id]) } else { self.retire(s) }
      }
      for id in Array(self.hosts.keys) where !named.contains(id) {
        guard let h = self.hosts[id] else { continue }
        if self.sheets.values.contains(where: { $0.host === h }) {
          h.spec.sheets = []
          continue
        }
        h.clip.removeFromSuperview()
        self.hosts[id] = nil
        if self.armedHost === h { self.armed = nil; self.armedHost = nil }
      }
      invoke.resolve(Made(made: self.made))
    }
  }

  /// What a sheet holds, from the store: at the page's asking, between strokes.
  @objc public func fill(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(SheetArgs.self)
    DispatchQueue.main.async {
      guard let s = self.sheets[args.sheet] else {
        invoke.reject("no such sheet")
        return
      }
      if s.dirty || (self.down && self.active === s) {
        invoke.resolve(Took(took: false))
        return
      }
      var d = PKDrawing()
      if let b = args.drawing, !b.isEmpty {
        guard let data = Data(base64Encoded: b), let read = try? PKDrawing(data: data) else {
          invoke.reject("not a drawing")
          return
        }
        d = read
      }
      // what the store holds is not what was written here: a step back would undo the store's, so there is none
      if s.stepped, s.canvas.drawing != d { self.forget() }
      if self.picked?.sheet === s { self.unpick() }
      s.given = d
      s.canvas.drawing = d
      s.dirty = false
      invoke.resolve(Took(took: true))
    }
  }

  /// The drawing a sheet holds, when it has changed since the last time it was given.
  @objc public func take(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(SheetArgs.self)
    DispatchQueue.main.async {
      guard let s = self.sheets[args.sheet] else {
        invoke.resolve(Taken(strokes: 0, drawing: nil))
        return
      }
      let d = s.canvas.drawing
      var data: String? = nil
      if s.dirty && !(self.down && self.active === s) {
        s.dirty = false
        // the page holds this from now on: an undo back to what it held before is a change
        s.given = d
        data = d.dataRepresentation().base64EncodedString()
      }
      invoke.resolve(Taken(strokes: d.strokes.count, drawing: data))
    }
  }

  /// The page is showing a sheet's picture: its canvas goes until the Pencil's next touch.
  @objc public func rest(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(SheetArgs.self)
    DispatchQueue.main.async {
      if let s = self.sheets[args.sheet], !s.dirty, !(self.down && self.active === s) { s.canvas.isHidden = true }
      invoke.resolve()
    }
  }

  /// A dev run's: a sheet's canvas emptied as an eraser would, its change told as any change is. The rig's finger erases nothing (PLAN, 69).
  @objc public func wipe(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(SheetArgs.self)
    DispatchQueue.main.async {
      self.sheets[args.sheet]?.canvas.drawing = PKDrawing()
      invoke.resolve()
    }
  }

  /// A dev run's: a finger stands in for the Pencil, or does not.
  @objc public func pen(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(PenArgs.self)
    DispatchQueue.main.async {
      self.webSeesPen(true)
      self.standIn = args.on
      self.setTouchTypes()
      self.armed?.canvas.drawingGestureRecognizer.isEnabled = false
      self.armed = nil
      self.armedHost = nil
      invoke.resolve()
    }
  }

  /// The tool held: every canvas takes it, and each made later.
  @objc public func tool(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(ToolArgs.self)
    DispatchQueue.main.async {
      let t = args.tool
      var made: PKInkingTool? = nil
      switch t.kind {
      case "pen", "highlighter":
        let type: PKInkingTool.InkType = t.kind == "pen" ? .pen : .marker
        let range = type.validWidthRange
        made = PKInkingTool(type, color: colour(t.color) ?? .black, width: min(max(CGFloat(t.width), range.lowerBound), range.upperBound))
      case "eraser", "select":
        break
      default:
        invoke.reject("no such tool")
        return
      }
      // a tool changed under the Pencil: what it was doing is done
      if self.down, let s = self.active, self.own != nil {
        self.finishOwn(s)
        self.spent = true
      }
      self.unpick()
      self.tool = t
      if let ink = made {
        self.ink = ink
        for s in self.sheets.values { s.canvas.tool = ink }
      }
      invoke.resolve()
    }
  }

  /// The last thing done on any sheet taken back.
  @objc public func undo(_ invoke: Invoke) throws {
    DispatchQueue.main.async {
      self.turn(back: true)
      invoke.resolve(History(undo: self.history.canUndo, redo: self.history.canRedo))
    }
  }

  /// And put back.
  @objc public func redo(_ invoke: Invoke) throws {
    DispatchQueue.main.async {
      self.turn(back: false)
      invoke.resolve(History(undo: self.history.canUndo, redo: self.history.canRedo))
    }
  }

  /// `draw with finger`: on, a finger writes as the Pencil does and two scroll; off, the Pencil writes and a finger scrolls.
  @objc public func finger(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(PenArgs.self)
    DispatchQueue.main.async {
      self.webSeesPen(true)
      self.finger = args.on
      self.setTouchTypes()
      self.armed?.canvas.drawingGestureRecognizer.isEnabled = false
      self.armed = nil
      self.armedHost = nil
      invoke.resolve()
    }
  }

  /// The system's colour wheel, from `at` on the page: answered when it closes, with the colour chosen or none.
  @objc public func color(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(ColorArgs.self)
    DispatchQueue.main.async {
      guard let web = self.web, var top = web.window?.rootViewController else {
        invoke.reject("no web view yet")
        return
      }
      if self.wheel != nil {
        invoke.reject("the wheel is up")
        return
      }
      while let over = top.presentedViewController, !over.isBeingDismissed { top = over }
      let w = Wheel(invoke: invoke, plugin: self, color: args.color.flatMap { colour($0) })
      w.view.modalPresentationStyle = .popover
      if let pop = w.view.popoverPresentationController {
        pop.sourceView = web
        pop.sourceRect = args.at.map { web.scrollView.convert($0.rect, to: web) } ?? CGRect(x: web.bounds.midX, y: web.bounds.midY, width: 1, height: 1)
        pop.delegate = w
      }
      w.view.presentationController?.delegate = w
      self.wheel = w
      top.present(w.view, animated: true)
    }
  }

  /// A dev run's: with the wheel up, as if that colour were chosen and the wheel closed.
  @objc public func wheel(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(WheelArgs.self)
    DispatchQueue.main.async {
      guard let w = self.wheel, let c = colour(args.color) else {
        invoke.reject(self.wheel == nil ? "no wheel is up" : "not a colour")
        return
      }
      w.pick(c)
      w.view.dismiss(animated: false)
      w.finish()
      invoke.resolve()
    }
  }

  /// How it all stands, for the checks.
  @objc public func state(_ invoke: Invoke) throws {
    DispatchQueue.main.async {
      guard let layer = self.layer, let web = self.web else {
        invoke.resolve(State(sheets: [], hosts: [], tools: false, tool: self.tool, finger: self.finger, undo: self.history.canUndo, redo: self.history.canRedo, wheel: self.wheel != nil, selected: 0, down: false, scribble: self.scribble, touched: nil, lastTouched: []))
        return
      }
      let sheets = self.sheets.values.sorted { $0.id < $1.id }.map { s -> SheetState in
        let at = s.canvas.convert(s.canvas.bounds, to: layer)
        let onWeb = layer.convert(at, to: web.scrollView)
        return SheetState(id: s.id, strokes: s.canvas.drawing.strokes.count, shown: !s.canvas.isHidden, dirty: s.dirty, at: Box(CGRect(origin: onWeb.origin, size: s.canvas.frame.size)))
      }
      let hosts = self.hosts.values.sorted { $0.id < $1.id }.map { h in
        HostState(id: h.id, follows: h.scroll != nil, offset: Double(h.scroll?.contentOffset.y ?? -1), port: Box(h.clip.frame))
      }
      invoke.resolve(State(sheets: sheets, hosts: hosts, tools: false, tool: self.tool, finger: self.finger, undo: self.history.canUndo, redo: self.history.canRedo, wheel: self.wheel != nil, selected: self.picked?.at.count ?? 0, down: self.down, scribble: self.scribble, touched: self.touched, lastTouched: self.lastTouched))
    }
  }

  fileprivate func emit(_ m: [String: Any]) {
    guard let web = web, let data = try? JSONSerialization.data(withJSONObject: m.mapValues { v -> Any in
      if let f = v as? CGFloat { return Double(f) }
      return v
    }), let json = String(data: data, encoding: .utf8) else { return }
    web.evaluateJavaScript("window.__ink&&window.__ink(\(json))", completionHandler: nil)
  }
}

@_cdecl("init_plugin_ink")
func initPlugin() -> Plugin {
  return InkPlugin()
}
