// Ink where the Pencil lands (milestone 69). There is nothing to open: the canvases are already there.
//
// A layer lies over the web view and takes no touch. In it are PencilKit canvases, a sheet each: an ink area
// of a note or a book's page, for what is on the screen and near it. Each canvas's drawing recogniser is on
// the web view, not on the canvas, and takes the Pencil only: so a finger goes to the web view as it always
// did, and scrolls and taps; the Pencil goes to the one canvas under it, and PencilKit inks from the first
// touch with no word from the page.
//
// Which canvas: every touch passes through the layer's `hitTest` before any recogniser sees it. It does not
// say what is touching, but it says where. So `arm` enables the one canvas under that point and takes the
// Pencil from the web view's own recognisers there (or gives it back where nothing is written: over the
// tree, a word, a menu, the Pencil is a finger). A note's column has a canvas with nothing in it for the
// Pencil that lands off every area: the catcher, moved to that point, which then becomes the new area's.
//
// Where it stays. The page says once, each time its layout changes, where each sheet lies in its scroller's
// own content (`scene`). A scroller on iOS is a real `UIScrollView` inside the web view; the layer finds it by
// its frame and watches its `contentOffset`, and moves the sheets in the same turn of the main thread. So a
// finger's scroll never crosses to the page and back, and the ink keeps to the text it was written by.
//
// Between strokes a canvas is hidden and the page shows the picture of the same strokes: anything the page
// lays over a note lies over its ink, and the canvas comes back with the Pencil's next touch, at once, since
// it holds the drawing all along.

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
  /// Where a Pencil off every sheet opens a new one, in the scroller's content; none on a book's pages.
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

struct PenArgs: Decodable {
  var on: Bool
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
  /// To the page's answer, the area open.
  var page: Double?
  /// The stroke's first point against the touch, in points: nothing of it lost if near none.
  var lost: Double?
  /// Whether it was the first touch on a sheet that held nothing.
  var fresh: Bool = false
}

struct State: Encodable {
  let sheets: [SheetState]
  let hosts: [HostState]
  let tools: Bool
  let down: Bool
  let scribble: Int
  let touched: Touched?
  let lastTouched: [Touched]
}

/// Over the web view: takes no touch, and is told of every one first.
final class InkLayer: UIView {
  weak var plugin: InkPlugin?
  override var canBecomeFirstResponder: Bool { true }
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
  var catcher: Sheet?
  init(_ spec: HostSpec) {
    self.id = spec.id
    self.spec = spec
    clip.clipsToBounds = true
    clip.isUserInteractionEnabled = false
    content.isUserInteractionEnabled = false
    clip.addSubview(content)
  }
}

final class Sheet: NSObject, PKCanvasViewDelegate {
  var id: String
  let canvas = PKCanvasView()
  weak var host: Host?
  var hit = CGRect.zero
  var zoom: CGFloat = 1
  /// The page has said this sheet is one of its own; until then it is a new area on its way.
  var adopted = false
  var dirty = false
  /// Where it is on the layer while the stroke that opened it goes on: the page moves under it, and it stays.
  var pinned: CGPoint?
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
    canvas.delegate = self
  }

  /// What it was last given: PencilKit says a drawing changed when it is given one, whenever it likes.
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
    guard touch == nil, let t = touches.first else { return }
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

class InkPlugin: Plugin {
  private weak var web: WKWebView?
  private var layer: InkLayer?
  private let picker = PKToolPicker()
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
  private var dark = false
  private var serial = 0
  private var made: [String] = []
  private var penOff = false
  private var kept: [ObjectIdentifier: (UIGestureRecognizer, [NSNumber])] = [:]
  private var rootWatch: NSKeyValueObservation?
  private var scribble = 0
  private var away: DispatchWorkItem?
  private var touched: Touched?
  private var touchedAt: TimeInterval = 0
  private var inkedAt: TimeInterval = 0
  private var touchedAtPoint: CGPoint = .zero
  private var lastTouched: [Touched] = []

  /// How long the writing is left alone before it is kept, and how long the Pencil is away before the tools go.
  private let quietAfter = 2.5
  private let awayAfter = 8.0
  /// The rig takes twenty seconds a touch: under the stand-in the tools wait for it.
  private var awayNow: Double { standIn ? 50 : awayAfter }
  /// How near the lower edge the Pencil is when an area grows.
  private let edge: CGFloat = 72
  /// Room over the Pencil's touch in a new area: a stroke goes up as well as down.
  private let head: CGFloat = 28

  override func load(webview: WKWebView) {
    web = webview
    NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in self?.wentAway() }
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
    standIn ? [NSNumber(value: UITouch.TouchType.pencil.rawValue), NSNumber(value: UITouch.TouchType.direct.rawValue)] : [NSNumber(value: UITouch.TouchType.pencil.rawValue)]
  }

  private func setTouchTypes() {
    watch?.allowedTouchTypes = penTypes
    let policy: PKCanvasViewDrawingPolicy = standIn ? .anyInput : .pencilOnly
    for s in sheets.values where s.canvas.drawingPolicy != policy { s.canvas.drawingPolicy = policy }
    for h in hosts.values { if let c = h.catcher, c.canvas.drawingPolicy != policy { c.canvas.drawingPolicy = policy } }
  }

  /// Where the Pencil writes the web view's own recognisers do not see it: no scroll, no caret, no selection, no tap.
  private func webSeesPen(_ yes: Bool) {
    guard let web = web, penOff == yes else { return }
    penOff = !yes
    if yes {
      for (_, k) in kept { k.0.allowedTouchTypes = k.1 }
      kept.removeAll()
      return
    }
    let pens = Set(penTypes.map { $0.intValue })
    let mine = Set(allCanvasRecognisers().map { ObjectIdentifier($0) })
    walk(web) { v in
      for g in v.gestureRecognizers ?? [] where !mine.contains(ObjectIdentifier(g)) && g !== self.watch {
        let was = g.allowedTouchTypes
        self.kept[ObjectIdentifier(g)] = (g, was)
        g.allowedTouchTypes = was.filter { !pens.contains($0.intValue) }
      }
    }
  }

  private func allCanvasRecognisers() -> [UIGestureRecognizer] {
    var out = sheets.values.map { $0.canvas.drawingGestureRecognizer }
    for h in hosts.values { if let c = h.catcher { out.append(c.canvas.drawingGestureRecognizer) } }
    return out
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
      } else if let open = h.spec.open?.rect, open.contains(q), let c = h.catcher {
        c.place(CGRect(x: open.minX, y: q.y - head, width: open.width, height: c.canvas.frame.height), zoom: 1)
        target = c
      } else {
        host = nil
      }
      break
    }
    // an eraser over the text opens nothing: there the Pencil is a finger
    if !(picker.selectedTool is PKInkingTool), target?.adopted == false {
      target = nil
      host = nil
    }
    // said for every canvas at every touch: PencilKit turns its recogniser back on when it likes (a canvas
    // new to the window, a tool from the picker), and two of them would each begin the stroke
    let want = target?.canvas.drawingGestureRecognizer
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

  private func isPen(_ t: UITouch) -> Bool { t.type == .pencil || standIn }

  fileprivate func penDown(_ t: UITouch) {
    guard isPen(t), let s = armed, let h = armedHost, let layer = layer else { return }
    let now = ProcessInfo.processInfo.systemUptime
    down = true
    active = s
    away?.cancel()
    s.quiet?.cancel()
    s.canvas.isHidden = false
    let wasFresh = !s.adopted
    touched = Touched(armed: (armedAt - t.timestamp) * 1000, seen: (now - t.timestamp) * 1000, ink: inkedAt >= t.timestamp ? (inkedAt - t.timestamp) * 1000 : nil, fresh: wasFresh)
    touchedAt = t.timestamp
    touchedAtPoint = t.location(in: s.canvas)
    if touchedAtPoint.x.isNaN { touchedAtPoint = .zero }
    let q = t.location(in: h.content)
    if wasFresh {
      // the catcher is this area now: it stays where it is while the page opens round it, and the next one takes its place
      s.pinned = s.canvas.convert(CGPoint.zero, to: layer)
      s.host = h
      sheets[s.id] = s
      h.catcher = makeCatcher(h)
    }
    s.grownAt = 0
    showTools()
    emit(["kind": "begin", "sheet": s.id, "host": h.id, "fresh": wasFresh, "x": q.x, "y": q.y, "top": s.canvas.frame.minY])
  }

  fileprivate func penMoved(_ t: UITouch) {
    guard down, let s = active, let h = s.host else { return }
    if var m = touched, m.moved == nil {
      m.moved = (t.timestamp - touchedAt) * 1000
      touched = m
    }
    let q = t.location(in: h.content)
    if s.hit != .zero, q.y > s.hit.maxY - edge, q.y > s.grownAt + 24 {
      s.grownAt = q.y
      emit(["kind": "grow", "sheet": s.id, "y": q.y])
    }
  }

  fileprivate func penUp() {
    guard down, let s = active else { return }
    down = false
    active = nil
    if let spec = s.waiting, let h = s.host {
      s.waiting = nil
      s.pinned = nil
      apply(spec, in: h)
    }
    s.pinned = nil
    emit(["kind": "end", "sheet": s.id])
    wait(s)
    goAway()
  }

  fileprivate func inking(_ s: Sheet) {
    // PencilKit may hear of the touch before the watcher does
    inkedAt = ProcessInfo.processInfo.systemUptime
    guard down, var t = touched, t.ink == nil else { return }
    t.ink = (inkedAt - touchedAt) * 1000
    touched = t
  }

  fileprivate func changed(_ s: Sheet) {
    // the stroke is the canvas's now: where it starts against where the Pencil came down
    if var t = touched, t.lost == nil, let first = s.canvas.drawing.strokes.last?.path.first?.location {
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

  // ── the tools ──

  private func showTools() {
    guard let layer = layer else { return }
    picker.setVisible(true, forFirstResponder: layer)
    if !layer.isFirstResponder { layer.becomeFirstResponder() }
  }

  private func goAway() {
    away?.cancel()
    let item = DispatchWorkItem { [weak self] in
      guard let self = self, !self.down, let layer = self.layer else { return }
      self.picker.setVisible(false, forFirstResponder: layer)
      if layer.isFirstResponder { layer.resignFirstResponder() }
    }
    away = item
    DispatchQueue.main.asyncAfter(deadline: .now() + awayNow, execute: item)
  }

  // ── where everything is ──

  private func makeCatcher(_ h: Host) -> Sheet {
    serial += 1
    let c = makeSheet(id: "new:\(serial)", host: h)
    let tall = max(h.clip.bounds.height * 2, 1600)
    c.place(CGRect(x: 0, y: -tall, width: max(h.spec.open?.w ?? 100, 100), height: tall), zoom: 1)
    return c
  }

  private func makeSheet(id: String, host h: Host) -> Sheet {
    let s = Sheet(id: id, plugin: self)
    s.host = h
    s.canvas.drawingPolicy = standIn ? .anyInput : .pencilOnly
    s.canvas.overrideUserInterfaceStyle = dark ? .dark : .light
    h.content.addSubview(s.canvas)
    let g = s.canvas.drawingGestureRecognizer
    web?.addGestureRecognizer(g)
    g.isEnabled = false
    picker.addObserver(s.canvas)
    return s
  }

  private func retire(_ s: Sheet) {
    picker.removeObserver(s.canvas)
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
    if !s.adopted, var t = touched, t.fresh, t.page == nil {
      t.page = (ProcessInfo.processInfo.systemUptime - touchedAt) * 1000
      touched = t
    }
    s.adopted = true
    s.hit = spec.hit.rect
    if down && active === s {
      s.waiting = spec
      return
    }
    s.place(spec.frame.rect, zoom: CGFloat(spec.zoom ?? 1))
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
    // the stroke that opened an area stays where it is, whatever the page does under it
    if let s = active, s.host === h, let at = s.pinned, let layer = layer {
      let here = layer.convert(at, to: h.content)
      if s.canvas.frame.origin != here { s.canvas.frame.origin = here }
    }
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
        for h in self.hosts.values { h.catcher?.canvas.overrideUserInterfaceStyle = d ? .dark : .light }
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
        if spec.open != nil {
          if h.catcher == nil { h.catcher = self.makeCatcher(h) }
          if let c = h.catcher, let w = spec.open?.w, abs(Double(c.canvas.frame.width) - w) > 0.5 {
            c.place(CGRect(x: spec.open?.x ?? 0, y: Double(c.canvas.frame.minY), width: w, height: Double(c.canvas.frame.height)), zoom: 1)
          }
        } else if let c = h.catcher {
          self.retire(c)
          h.catcher = nil
        }
        for s in spec.sheets {
          listed.insert(s.id)
          self.apply(s, in: h)
        }
      }
      // what the page no longer shows goes, once what is on it is safe
      for s in Array(self.sheets.values) where s.adopted && !listed.contains(s.id) && s !== self.active {
        if s.dirty { self.emit(["kind": "quiet", "sheet": s.id]) } else { self.retire(s) }
      }
      for id in Array(self.hosts.keys) where !named.contains(id) {
        guard let h = self.hosts[id] else { continue }
        if self.sheets.values.contains(where: { $0.host === h }) {
          h.spec.sheets = []
          h.spec.open = nil
          continue
        }
        if let c = h.catcher { self.retire(c) }
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
      // the picker remembers its tool across launches: a check starts from the pen
      if args.on && !self.standIn { self.picker.selectedTool = PKInkingTool(.pen, color: .black, width: 2) }
      self.standIn = args.on
      self.setTouchTypes()
      self.armed?.canvas.drawingGestureRecognizer.isEnabled = false
      self.armed = nil
      self.armedHost = nil
      if self.picker.isVisible { self.goAway() }
      invoke.resolve()
    }
  }

  /// How it all stands, for the checks.
  @objc public func state(_ invoke: Invoke) throws {
    DispatchQueue.main.async {
      guard let layer = self.layer, let web = self.web else {
        invoke.resolve(State(sheets: [], hosts: [], tools: false, down: false, scribble: self.scribble, touched: nil, lastTouched: []))
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
      invoke.resolve(State(sheets: sheets, hosts: hosts, tools: self.picker.isVisible, down: self.down, scribble: self.scribble, touched: self.touched, lastTouched: self.lastTouched))
    }
  }

  private func emit(_ m: [String: Any]) {
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
