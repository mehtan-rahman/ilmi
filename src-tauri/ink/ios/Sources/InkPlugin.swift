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
//
// What a handwriting app has besides (85). A pen is one of PencilKit's inks by name (`ink`), a highlighter has an
// opacity, the eraser takes a whole stroke or the part it crosses (`Shapes.cut`) and shows its reach as a ring
// under the Pencil. A stroke ended with the Pencil resting is a shape (`Shapes.swift`). What the lasso holds can
// be dragged, resized by the handle at its corner, cut, copied, duplicated, deleted and given another colour
// (`selection`), and what was cut or copied is put down where the Pencil rests under the lasso (`paste`); the
// page draws the menu, told where the selection lies (`picked`). The Pencil's own double tap and squeeze are told
// to the page (`pencil`), which changes the tool.
//
// As sharp as the screen, and a zoom that is the glass's own (86). A canvas lies on whole pixels of the screen and
// draws with more of them than it is shown with (`Sheet.over`), since PencilKit softens an edge over nearly two of
// the pixels it draws. Two fingers stretch the pages here, the web view's own layer for them and the sheets over it
// in the same turn (`Zoom`), with nothing sent to the page and back while they move; let go, the page says where the
// pages will lie, they are eased there, and the page lays them out exactly as they are shown.

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
  /// How its ink lies on what is under it: `multiply` (a highlighter leaves print dark), `screen` on a dark page. None is laid over.
  var blend: String?
}

struct HostSpec: Decodable {
  var id: String
  /// The scroller on the page, by which its scroll view is found.
  var view: Box
  /// What of it ink shows in and the Pencil writes in, on the page.
  var port: Box
  var top: Double
  /// How far it is scrolled sideways, when the page says (85).
  var left: Double?
  /// How tall its content is: another scroller may stand in the same place, a tab behind this one.
  var height: Double
  /// Where a Pencil off every sheet opened a new one, before 82: read so an older page's scene still decodes, and not used.
  var open: Box?
  var sheets: [SheetSpec]
  /// The column of pages that two fingers zoom, in the scroller's content, and the zoom it has now and may have (86).
  var pages: Box?
  var zoom: ZoomSpec?
}

struct ZoomSpec: Decodable {
  var z: Double
  var min: Double
  var max: Double
}

/// Where the page wants its pages shown, to be gone to smoothly: a point `l` of the column (from its corner as it
/// lies now) at `corner + (tx, ty) + k * l`; and where its scroller will then stand.
struct ZoomTo: Decodable {
  var k: Double
  var tx: Double
  var ty: Double
}

/// A zoom going on over a host's pages (86). Two fingers stretch the pages' own layer in the web view and the sheets
/// over it in one turn of the main thread, with no word to the page and back; let go, the page says where the pages
/// will lie at the zoom they stopped at (`ZoomTo`), they are eased there, and the page lays them out as they are shown.
struct Zoom {
  enum Phase: String { case fingers, waiting, settling, held }
  var z0: CGFloat
  var lo: CGFloat
  var hi: CGFloat
  /// The column's corner in the scroller's content, and the place between the fingers as it began, from that corner.
  var corner: CGPoint
  var from: CGPoint
  /// Where the scroller stood when `t` was said.
  var ref: CGPoint
  var k: CGFloat = 1
  var t = CGPoint.zero
  var phase = Phase.fingers
}

struct SceneArgs: Decodable {
  var hosts: [HostSpec]
  var dark: Bool?
  /// What the page lays over the sheets (a tool's settings, a menu), on the page: the Pencil does not write through it.
  var holes: [Box]?
}

struct SheetArgs: Decodable {
  var sheet: String
  var drawing: String?
  /// The canvas stays on the screen with what it is given: the page shows no picture of it (85).
  var show: Bool?
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
  /// A pen's ink, by name: `pen`, `monoline`, `fountain`, `pencil` (85). None is `pen`; a highlighter's is the marker.
  var ink: String?
  /// How much of the ink's own colour shows, 0 to 1: a highlighter's. None is all of it.
  var opacity: Double?
  /// The eraser's way: `stroke` takes each stroke it comes upon whole, `part` what of it lies under it. None is `stroke`.
  var mode: String?
  /// A stroke ended with the Pencil resting becomes the shape it most nearly is. None is no.
  var snap: Bool?
}

/// How the page's pages are stretched while two fingers pinch: a point `p` of the host's content is shown at
/// `k * p + (dx, dy)`. No `k` is as they lie.
struct PinchArgs: Decodable {
  var host: String
  var k: Double?
  var dx: Double?
  var dy: Double?
  /// Where the pages are eased to before the page lays them out (86), and over how many milliseconds.
  var to: ZoomTo?
  var ms: Double?
}

/// What is done with what the lasso holds: `cut`, `copy`, `duplicate`, `delete`, or `color` with a colour.
struct SelectionArgs: Decodable {
  var op: String
  var color: String?
}

/// Where what was cut or copied is put down: a sheet, and a place in its host's content.
struct PasteArgs: Decodable {
  var sheet: String
  var x: Double
  var y: Double
}

struct ShareArgs: Decodable {
  /// A file on the device.
  var path: String
  var at: Box?
}

/// A dev run's: the Pencil's double tap (`tap`) or squeeze, which no simulator has; or `three`, three fingers tapped on the pages.
struct PencilArgs: Decodable {
  var what: String
}

/// A dev run's: a stroke of the pen held, through these points of the sheet's drawing, ended resting or not.
struct StrokeArgs: Decodable {
  var sheet: String
  var points: [[Double]]
  var rest: Bool
}

/// A dev run's: a sheet, and the name its picture is written under in the app's Documents.
struct PictureArgs: Decodable {
  var sheet: String
  var name: String
}

/// What the lasso holds and what was cut or copied, after something was done with them.
struct Selected: Encodable {
  let selected: Int
  let clip: Int
}

/// The inks this system's PencilKit has, each with the widths it takes, and whether a Pencil can be squeezed here.
struct Caps: Encodable {
  let inks: [String: [Double]]
  let squeeze: Bool
}

struct Shared: Encodable {
  let done: Bool
}

struct ToolArgs: Decodable {
  var tool: ToolSpec
  /// Which telling this is: one numbered under the last taken is an older one arrived late, and is let go.
  var seq: Int?
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
  /// The pixels its strokes are drawn with to a point of the drawing: the canvas's zoom times its screen's scale
  /// (PencilKit draws a canvas's strokes anew at its zoom), which since 86 is more than the screen shows them with
  /// (`Sheet.over`). Ink at rest that is this canvas is as sharp as ink being written (85); a check measures the edges
  /// in a capture as well.
  let pixels: Double
  let blend: String?
  /// Where the canvas lies on the glass, in the screen's own pixels: whole numbers, or everything on it is drawn between pixels (86).
  let device: Box
  /// What stretches it besides its zoom, canvas to window: 1 at rest.
  let stretch: Double
  /// The pixels each thing PencilKit draws into has to a pixel of the screen where it lies: 1 is a pixel for a pixel.
  let drawn: [Double]
}

struct HostState: Encodable {
  let id: String
  /// Whether it found the scroller's scroll view, and where that stands.
  let follows: Bool
  let offset: Double
  let port: Box
  /// Whether the pages' own layer in the web view is found: two fingers stretch it here, with no word to the page (86).
  let zoomer: Bool
  /// The web view's layers that lie over the column, outermost first, for a dev run's notes: how deep, and where in the scroller's content.
  let layers: [String]
  /// A zoom going on: `fingers`, `waiting` for the page's word, `settling` there, `held` until the page has laid out.
  let phase: String?
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
  var sheets: [SheetState]
  var hosts: [HostState]
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
  /// Where they lie, in the web view's points; and how many strokes were cut or copied.
  let held: Box?
  let clip: Int
  /// The shape the last stroke ended resting became; none when it stayed as written.
  let shape: String?
  /// How far the sheets are stretched by a pinch: 1 when not.
  let pinch: Double
  /// A share sheet is up.
  let sharing: Bool
  let down: Bool
  let scribble: Int
  let touched: Touched?
  let lastTouched: [Touched]
  /// The notebooks open as surfaces of their own (87).
  var surfaces: [SurfaceState] = []
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
  /// The web view's own layer for the column of pages, and the zoom going on over it.
  weak var pagesLayer: CALayer?
  var live: Zoom?
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

  /// How many of its own pixels the canvas draws to each of the screen's, each way (86): PencilKit softens a stroke's
  /// edge over nearly two of the pixels it draws with, so the canvas is made larger than it is shown and shown
  /// smaller, and an edge is about one pixel of the screen. 1 where that would be more pixels than a canvas should hold.
  var over: CGFloat = 1
  /// Where it lies in its host's content, on whole pixels of the screen.
  var box = CGRect.zero

  func place(_ asked: CGRect, zoom z: CGFloat) {
    let screen = canvas.window?.screen.scale ?? UIScreen.main.scale
    // on whole pixels: a canvas between two is drawn across both, and all its ink with it
    let x0 = (asked.minX * screen).rounded() / screen, y0 = (asked.minY * screen).rounded() / screen
    let frame = Sheet.plain ? asked : CGRect(x: x0, y: y0, width: max(1, ((asked.maxX * screen).rounded() / screen) - x0), height: max(1, ((asked.maxY * screen).rounded() / screen) - y0))
    let px = frame.width * frame.height * screen * screen
    let k = Sheet.plain ? 1 : max(1, min(2, (Sheet.most / max(px, 1)).squareRoot()))
    // (a whole number of the canvas's own pixels each way, so nothing of it is between two)
    let size = Sheet.plain ? frame.size : CGSize(width: (frame.width * k * screen).rounded() / screen, height: (frame.height * k * screen).rounded() / screen)
    if box == frame, over == k, abs(z - zoom) <= 0.0001, canvas.zoomScale == z * k { return }
    box = frame
    over = k
    zoom = z
    canvas.transform = .identity
    canvas.bounds = CGRect(origin: .zero, size: size)
    canvas.center = CGPoint(x: frame.midX, y: frame.midY)
    canvas.transform = CGAffineTransform(scaleX: frame.width / size.width, y: frame.height / size.height)
    let zz = z * k
    if canvas.zoomScale != zz {
      canvas.maximumZoomScale = max(canvas.maximumZoomScale, zz)
      canvas.minimumZoomScale = min(canvas.minimumZoomScale, zz)
      canvas.zoomScale = zz
      canvas.minimumZoomScale = zz
      canvas.maximumZoomScale = zz
    }
    if canvas.contentSize != size { canvas.contentSize = size }
    if canvas.contentOffset != .zero { canvas.contentOffset = .zero }
  }

  /// A dev run's: the canvases as they were before 86, wherever the page puts them and a pixel for a pixel, to measure against.
  static var plain = false
  /// The most pixels a canvas draws with: a page at fit on a 13-inch iPad twice over each way and to spare, less where memory is short.
  static let most: CGFloat = {
    let memory = ProcessInfo.processInfo.physicalMemory
    return memory >= 7_000_000_000 ? 24_000_000 : memory >= 5_500_000_000 ? 16_000_000 : 8_000_000
  }()

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

/// Who hears what the Pencil does: the canvases over the web view's pages, or a notebook's surface.
protocol PenEars: AnyObject {
  func penDown(_ t: UITouch)
  func penMoved(_ t: UITouch)
  func penUp(rested: TimeInterval)
  func penJoined()
}

/// Sees the Pencil go by and takes nothing: the moment it lands and where it goes.
final class PenWatch: UIGestureRecognizer, UIGestureRecognizerDelegate {
  weak var ears: PenEars?
  private var touch: UITouch?
  /// Where the touch last was when it moved more than a tremor, and when: a Pencil resting has not moved since.
  private var stillAt = CGPoint.zero
  private var stillSince: TimeInterval = 0
  private let tremor: CGFloat = 3.5

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
      ears?.penJoined()
      return
    }
    touch = t
    stillAt = t.location(in: view)
    stillSince = t.timestamp
    ears?.penDown(t)
  }

  override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
    guard let t = touch, touches.contains(t) else { return }
    let p = t.location(in: view)
    if hypot(p.x - stillAt.x, p.y - stillAt.y) > tremor {
      stillAt = p
      stillSince = t.timestamp
    }
    ears?.penMoved(t)
  }

  private func finish(_ touches: Set<UITouch>) {
    guard let t = touch, touches.contains(t) else { return }
    touch = nil
    state = .failed
    ears?.penUp(rested: t.timestamp - stillSince)
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
  /// Resizing it by the handle at its lower right: about its upper left `origin`, from where the Pencil came down.
  case resize(before: PKDrawing, base: [PKStroke], at: [Int], origin: CGPoint, from: CGPoint, moved: Bool)
}

/// Lets a recogniser of the plugin's go on beside the web view's own.
final class Beside: NSObject, UIGestureRecognizerDelegate {
  func gestureRecognizer(_ g: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }
}

/// The Pencil's own double tap and squeeze, heard for the page.
final class PencilTaps: NSObject, UIPencilInteractionDelegate {
  weak var plugin: InkPlugin?

  private func prefer(_ a: UIPencilPreferredAction) -> String {
    switch a {
    case .ignore: return "ignore"
    case .switchPrevious: return "previous"
    case .showColorPalette: return "palette"
    case .showInkAttributes: return "attributes"
    default: return "eraser"
    }
  }

  func pencilInteractionDidTap(_ interaction: UIPencilInteraction) {
    plugin?.pencil("tap", prefer: prefer(UIPencilInteraction.preferredTapAction))
  }

  @available(iOS 17.5, *)
  func pencilInteraction(_ interaction: UIPencilInteraction, didReceiveTap tap: UIPencilInteraction.Tap) {
    plugin?.pencil("tap", prefer: prefer(UIPencilInteraction.preferredTapAction))
  }

  @available(iOS 17.5, *)
  func pencilInteraction(_ interaction: UIPencilInteraction, didReceiveSqueeze squeeze: UIPencilInteraction.Squeeze) {
    if squeeze.phase == .ended { plugin?.pencil("squeeze", prefer: prefer(UIPencilInteraction.preferredSqueezeAction)) }
  }
}

/// The strokes the lasso holds: which of the sheet's drawing, as long as the drawing is this one.
private struct Picked {
  let sheet: Sheet
  var at: [Int]
  var drawing: PKDrawing
}

class InkPlugin: Plugin, PenEars {
  private weak var web: WKWebView?
  var webView: WKWebView? { web }
  /// The notebooks open as surfaces of their own (87), by the name the page gives each.
  private var surfaces: [String: NoteSurface] = [:]
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
  var fingerWrites: Bool { standIn || finger }
  /// The tool held, and the ink every canvas has: the last pen or highlighter.
  private var toolSeq = 0
  private(set) var tool = ToolSpec(kind: "pen", color: "#000000", width: 2.2)
  private(set) var ink = PKInkingTool(.pen, color: .black, width: 2.2)
  var ours: Bool { tool.kind == "eraser" || tool.kind == "select" }
  /// Every canvas's undo manager.
  let history = UndoManager()
  private var told = (false, false)
  private var telling = false
  private var keeping = false
  /// Until when a change is kept at once: an undo's or a redo's.
  var hurry: TimeInterval = 0
  private var own: Own?
  /// A second finger came down, or the tool changed, in mid-gesture: the rest of it does nothing.
  private var spent = false
  private var picked: Picked?
  private let loop = CAShapeLayer()
  private let outline = CAShapeLayer()
  /// The handle at the lower right of what the lasso holds, and the eraser's reach under the Pencil.
  private let grip = CAShapeLayer()
  private let reach = CAShapeLayer()
  /// What was cut or copied, and what it covered where it lay.
  var clip: [PKStroke] = []
  var clipBox = CGRect.zero
  /// The Pencil resting under the lasso: where, until it moves or lifts.
  private var resting: DispatchWorkItem?
  /// A stroke just ended with the Pencil resting on this sheet, which held this many strokes before it.
  private var snap: (sheet: Sheet, count: Int, until: TimeInterval)?
  var lastShape: String?
  private var pinched: [String: CGFloat] = [:]
  /// The host two fingers are zooming, and its scroller's pan, which waits while they do.
  private weak var zooming: Host?
  private weak var paused: UIPanGestureRecognizer?
  private var holes: [CGRect] = []
  private let taps = PencilTaps()
  /// Two and three fingers on the glass: a pinch, and taps. Heard here and told to the page, since where a finger
  /// draws the web view's own recognisers are not given a finger's touch on a sheet.
  private let beside = Beside()
  private var fingers: [UIGestureRecognizer] = []
  private var sharing = false
  private weak var shareSheet: UIActivityViewController?
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
  let quietAfter = 2.5
  /// How near the lower edge the Pencil is when an area grows.
  private let edge: CGFloat = 72
  /// How long the Pencil rests at a stroke's end for the stroke to be a shape, and under the lasso for `paste`.
  let restFor = 0.42
  let pasteAfter = 0.55
  /// How near the handle the Pencil comes down to take it, in the screen's points.
  let gripReach: CGFloat = 22

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
    grip.fillColor = UIColor.white.cgColor
    grip.strokeColor = UIColor(white: 0.42, alpha: 1).cgColor
    grip.lineWidth = 1.5
    grip.zPosition = 11
    reach.fillColor = UIColor(white: 0.5, alpha: 0.12).cgColor
    reach.strokeColor = UIColor(white: 0.45, alpha: 0.9).cgColor
    reach.lineWidth = 1
    reach.zPosition = 12
    taps.plugin = self
    let pencil = UIPencilInteraction()
    pencil.delegate = taps
    webview.addInteraction(pencil)
  }

  /// The Pencil was tapped twice or squeezed: the page changes the tool, by what the system's settings say it does.
  fileprivate func pencil(_ what: String, prefer: String) {
    emit(["kind": "pencil", "what": what, "prefer": prefer])
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
    w.ears = self
    web.addGestureRecognizer(w)
    watch = w
    let direct = [NSNumber(value: UITouch.TouchType.direct.rawValue)]
    let pinch = UIPinchGestureRecognizer(target: self, action: #selector(pinched(_:)))
    let two = UITapGestureRecognizer(target: self, action: #selector(tapped(_:)))
    two.numberOfTouchesRequired = 2
    let three = UITapGestureRecognizer(target: self, action: #selector(tapped(_:)))
    three.numberOfTouchesRequired = 3
    // fingers that pinched are not fingers that tapped, though they come up together: a tap waits to hear there was no pinch
    two.require(toFail: pinch)
    three.require(toFail: pinch)
    // a finger tapped twice on the pages: fit, or the zoom they were last at
    let twice = UITapGestureRecognizer(target: self, action: #selector(tappedTwice(_:)))
    twice.numberOfTapsRequired = 2
    for g in [pinch, two, three, twice] as [UIGestureRecognizer] {
      g.allowedTouchTypes = direct
      g.cancelsTouchesInView = false
      g.delaysTouchesBegan = false
      g.delaysTouchesEnded = false
      g.delegate = beside
      web.addGestureRecognizer(g)
      fingers.append(g)
    }
    setTouchTypes()
    rootWatch = web.scrollView.observe(\.contentOffset, options: []) { [weak self] _, _ in self?.layOut() }
    silenceScribble()
  }

  @objc private func pinched(_ g: UIPinchGestureRecognizer) {
    guard let web = web, let layer = layer else { return }
    let p = g.location(in: web.scrollView)
    let scale = g.scale.isFinite ? g.scale : 1
    switch g.state {
    case .began:
      zooming = nil
      let q = g.location(in: layer)
      if !holes.contains(where: { $0.contains(q) }), let h = hosts.values.first(where: { $0.clip.frame.contains(q) && $0.spec.pages != nil && $0.spec.zoom != nil }), h.live == nil {
        bind(h)
        follow(h)
        if let l = pagesLayer(of: h), let scroll = h.scroll, let zs = h.spec.zoom, let pages = h.spec.pages {
          // the pages stand still under the fingers: a scroll still running stops, and the scroller's own pan waits
          scroll.setContentOffset(scroll.contentOffset, animated: false)
          let pan = scroll.panGestureRecognizer
          if pan.isEnabled { pan.isEnabled = false; paused = pan }
          h.pagesLayer = l
          let c = g.location(in: h.content)
          let corner = CGPoint(x: pages.x, y: pages.y)
          h.live = Zoom(z0: CGFloat(zs.z), lo: CGFloat(zs.min), hi: CGFloat(zs.max), corner: corner, from: CGPoint(x: c.x - corner.x, y: c.y - corner.y), ref: scroll.contentOffset)
          zooming = h
          emit(["kind": "pinch", "phase": "begin", "native": true, "host": h.id, "k": 1, "x": p.x, "y": p.y])
          return
        }
      }
      emit(["kind": "pinch", "phase": "begin", "k": scale, "x": p.x, "y": p.y])
    case .changed:
      guard let h = zooming, var z = h.live else {
        emit(["kind": "pinch", "phase": "change", "k": scale, "x": p.x, "y": p.y])
        return
      }
      z.k = rubber(z.z0 * scale, z.lo, z.hi) / z.z0
      // (one finger lifted before the other: the place between them is no longer between two)
      if g.numberOfTouches >= 2 {
        let c = g.location(in: h.content)
        z.t = CGPoint(x: c.x - z.corner.x - z.k * z.from.x, y: c.y - z.corner.y - z.k * z.from.y)
      } else {
        // about the place it was last held by
        let was = h.live!
        let at = CGPoint(x: was.t.x + was.k * was.from.x, y: was.t.y + was.k * was.from.y)
        z.t = CGPoint(x: at.x - z.k * z.from.x, y: at.y - z.k * z.from.y)
      }
      h.live = z
      stretch(h)
      emit(["kind": "pinch", "phase": "change", "native": true, "host": h.id, "k": z.k, "x": p.x, "y": p.y])
    default:
      guard let h = zooming, var z = h.live else {
        emit(["kind": "pinch", "phase": g.state == .ended ? "end" : "cancel", "k": scale, "x": p.x, "y": p.y])
        return
      }
      zooming = nil
      paused?.isEnabled = true
      paused = nil
      z.phase = .waiting
      h.live = z
      // where the place the pages were taken by is now, on the page: the page says where the pages come to rest
      let at = h.content.convert(CGPoint(x: z.corner.x + z.t.x + z.k * z.from.x, y: z.corner.y + z.t.y + z.k * z.from.y), to: web.scrollView)
      emit(["kind": "pinch", "phase": "end", "native": true, "host": h.id, "k": z.k, "x": at.x, "y": at.y, "lx": z.from.x, "ly": z.from.y])
      // (a page that never answers leaves nothing stretched)
      DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak self, weak h] in
        if let self = self, let h = h, h.live?.phase == .waiting { self.unstretch(h) }
      }
    }
  }

  /// A zoom past either end gives a little, and comes back when let go.
  private func rubber(_ z: CGFloat, _ lo: CGFloat, _ hi: CGFloat) -> CGFloat {
    if z > hi { return hi * pow(z / hi, 0.35) }
    if z < lo { return lo * pow(z / lo, 0.35) }
    return z
  }

  /// The web view's own layer for a host's column of pages: the outermost under its scroller that covers the column
  /// and not much more (its pages' shadows, what hangs beside and under them). The page keeps the column a layer of
  /// its own (`will-change`).
  private func pagesLayer(of h: Host) -> CALayer? {
    guard let scroll = h.scroll, let want = h.spec.pages?.rect, want.width > 0, want.height > 0 else { return nil }
    var found: CALayer?
    func look(_ l: CALayer, _ depth: Int) {
      for k in l.sublayers ?? [] where found == nil {
        let f = k.convert(k.bounds, to: scroll.layer)
        // (not the scroller's whole content, which begins above the column with what stands over it)
        if f.insetBy(dx: -1.5, dy: -1.5).contains(want), f.minY >= want.minY - 64, f.maxY <= want.maxY + 600, f.width <= want.width + 600 {
          found = k
          return
        }
        // (a layer that draws nothing of its own may be no size at all, and hold the column all the same)
        if depth < 16 { look(k, depth + 1) }
      }
    }
    // (anywhere in the web view: the web view keeps a layer inside a scroller that is no stacking context of its own
    // beside the scroller, not under it, and moves it as the scroller scrolls)
    look(web?.scrollView.layer ?? scroll.layer, 0)
    return found
  }

  private func layersOver(_ h: Host) -> [String] {
    guard let scroll = h.scroll, let want = h.spec.pages?.rect else {
      // no scroller found for it: every scroll view the web view has, against where the page says the scroller is
      var all: [String] = ["view \(Int(onLayer(h.spec.view).minX)),\(Int(onLayer(h.spec.view).minY)) \(Int(h.spec.view.w))x\(Int(h.spec.view.h)) tall \(Int(h.spec.height)) pages \(h.spec.pages != nil)"]
      if let web = web, let layer = layer {
        walk(web.scrollView) { v in
          guard let s = v as? UIScrollView, s !== web.scrollView else { return }
          let f = s.convert(s.bounds, to: layer)
          all.append("\(Int(f.minX)),\(Int(f.minY)) \(Int(f.width))x\(Int(f.height)) holds \(Int(s.contentSize.width))x\(Int(s.contentSize.height)) \(s.window != nil) \(s.isHidden)")
        }
      }
      return all
    }
    var out: [String] = ["want \(Int(want.minX)),\(Int(want.minY)) \(Int(want.width))x\(Int(want.height))"]
    func look(_ l: CALayer, _ depth: Int) {
      for k in l.sublayers ?? [] where out.count < 40 {
        let f = k.convert(k.bounds, to: scroll.layer)
        if f.intersects(want), f.height >= 40 { out.append("\(depth) \(Int(f.minX)),\(Int(f.minY)) \(Int(f.width))x\(Int(f.height))") }
        if depth < 16 { look(k, depth + 1) }
      }
    }
    look(web?.scrollView.layer ?? scroll.layer, 0)
    return out
  }

  /// The pages and the sheets over them shown as the zoom going on has them: at once, or eased there over `ms`.
  private func stretch(_ h: Host, over ms: Double = 0, then: (() -> Void)? = nil) {
    guard let z = h.live else { then?(); return }
    let off = h.scroll?.contentOffset ?? z.ref
    // the sheets: a point `c` of the content at `k * c + d`, wherever the scroller has gone since
    let d = CGPoint(x: off.x - z.ref.x + z.corner.x + z.t.x - z.k * z.corner.x, y: off.y - z.ref.y + z.corner.y + z.t.y - z.k * z.corner.y)
    let b = h.content.layer.bounds
    let a = h.content.layer.anchorPoint
    let c = CGPoint(x: b.minX + b.width * a.x, y: b.minY + b.height * a.y)
    let ink = CATransform3DMakeAffineTransform(CGAffineTransform(a: z.k, b: 0, c: 0, d: z.k, tx: d.x + (z.k - 1) * c.x, ty: d.y + (z.k - 1) * c.y))
    // the pages' own layer, until the page has taken it over (`held`): about where it is pinned in the layer it lies in
    var web: (CALayer, CATransform3D)? = nil
    if z.phase != .held, let l = h.pagesLayer, let over = l.superlayer, let scroll = h.scroll {
      let corner = over.convert(z.corner, from: scroll.layer)
      let pin = l.position
      web = (l, CATransform3DMakeAffineTransform(CGAffineTransform(a: z.k, b: 0, c: 0, d: z.k, tx: z.t.x + (1 - z.k) * (corner.x - pin.x), ty: z.t.y + (1 - z.k) * (corner.y - pin.y))))
    }
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    if let then = then { CATransaction.setCompletionBlock(then) }
    func set(_ l: CALayer, _ key: String, _ to: CATransform3D) {
      if ms > 0 {
        let move = CABasicAnimation(keyPath: key)
        move.fromValue = (l.presentation() ?? l).value(forKeyPath: key)
        move.toValue = NSValue(caTransform3D: to)
        move.duration = ms / 1000
        move.timingFunction = CAMediaTimingFunction(name: .easeOut)
        l.add(move, forKey: "ilmi.zoom.\(key)")
      }
      l.setValue(NSValue(caTransform3D: to), forKeyPath: key)
    }
    set(h.content.layer, "sublayerTransform", ink)
    if let (l, t) = web { set(l, "transform", t) }
    CATransaction.commit()
  }

  /// No zoom is going on over a host: the sheets as they lie, and the pages' layer too unless the page has it.
  private func unstretch(_ h: Host) {
    let was = h.live
    h.live = nil
    if zooming === h { zooming = nil; paused?.isEnabled = true; paused = nil }
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    h.content.layer.removeAllAnimations()
    h.content.layer.sublayerTransform = CATransform3DIdentity
    if let z = was, z.phase != .held, let l = h.pagesLayer {
      l.removeAnimation(forKey: "ilmi.zoom.transform")
      l.transform = CATransform3DIdentity
    }
    CATransaction.commit()
    pinched[h.id] = nil
  }

  @objc private func tappedTwice(_ g: UITapGestureRecognizer) {
    guard let web = web, let layer = layer, g.state == .ended else { return }
    let q = g.location(in: layer)
    if holes.contains(where: { $0.contains(q) }) { return }
    guard let h = hosts.values.first(where: { $0.clip.frame.contains(q) && $0.spec.zoom != nil }), h.live == nil else { return }
    // where a finger writes, two taps are two dots
    if fingerWrites {
      let c = layer.convert(q, to: h.content)
      if h.spec.sheets.contains(where: { sheets[$0.id]?.hit.contains(c) == true }) { return }
    }
    let p = g.location(in: web.scrollView)
    emit(["kind": "double", "host": h.id, "x": p.x, "y": p.y])
  }

  @objc private func tapped(_ g: UITapGestureRecognizer) {
    guard let web = web, g.state == .ended else { return }
    let p = g.location(in: web.scrollView)
    emit(["kind": "fingers", "n": g.numberOfTouchesRequired, "x": p.x, "y": p.y])
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

  var penTypes: [NSNumber] {
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
      for g in v.gestureRecognizers ?? [] where !mine.contains(ObjectIdentifier(g)) && g !== self.watch && !self.fingers.contains(where: { $0 === g }) {
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
    // under something the page has laid over the sheets, the touch is the page's
    let over = holes.contains { $0.contains(p) }
    for h in hosts.values where !over && h.clip.frame.contains(p) {
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
    if !over, let k = picked, k.sheet !== target { unpick() }
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

  func penDown(_ t: UITouch) {
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
    snap = nil
    if tool.kind == "eraser" {
      unpick()
      own = .erase(before: s.canvas.drawing, last: p)
      erase(s, from: p, to: p)
      ringEraser(at: q, in: h)
    } else if tool.kind == "select" {
      let z = max(s.zoom, 0.01)
      if let k = picked, k.sheet === s, let box = held(k), hypot(p.x - box.maxX, p.y - box.maxY) <= gripReach / z {
        own = .resize(before: s.canvas.drawing, base: s.canvas.drawing.strokes, at: k.at, origin: box.origin, from: p, moved: false)
        emit(["kind": "unpicked", "moving": true])
      } else if let k = picked, k.sheet === s, let box = held(k), box.insetBy(dx: -8 / z, dy: -8 / z).contains(p) {
        own = .drag(before: s.canvas.drawing, base: s.canvas.drawing.strokes, at: k.at, from: p, moved: false)
        emit(["kind": "unpicked", "moving": true])
      } else {
        unpick()
        own = .loop(points: [p], shown: [q])
        show(loop, in: h, path: nil)
        // the Pencil resting where it landed asks for what was cut or copied
        let item = DispatchWorkItem { [weak self, weak s, weak h] in
          guard let self = self, let s = s, let h = h, self.down, self.active === s, !self.spent, case .loop = self.own else { return }
          self.spent = true
          self.hide(self.loop)
          self.emit(["kind": "rest", "sheet": s.id, "host": h.id, "x": q.x, "y": q.y, "clip": self.clip.count])
        }
        resting = item
        DispatchQueue.main.asyncAfter(deadline: .now() + pasteAfter, execute: item)
      }
    } else {
      unpick()
    }
    emit(["kind": "begin", "sheet": s.id, "host": h.id, "fresh": false, "x": q.x, "y": q.y, "top": s.canvas.frame.minY])
  }

  /// A second finger beside the one that writes: under a tool of the plugin's own the gesture is over, and the two scroll.
  func penJoined() {
    guard down, own != nil, !spent else { return }
    spent = true
    hide(loop)
  }

  func penMoved(_ t: UITouch) {
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
        ringEraser(at: q, in: h)
      case let .resize(before, base, at, origin, from, _):
        // the corner follows the Pencil, the shape kept: by how far it is from the upper left, against where it began
        let was = hypot(from.x - origin.x, from.y - origin.y)
        let f = min(max(hypot(max(p.x - origin.x, 1), max(p.y - origin.y, 1)) / max(was, 1), 0.1), 12)
        let by = CGAffineTransform(translationX: -origin.x, y: -origin.y).concatenating(CGAffineTransform(scaleX: f, y: f)).concatenating(CGAffineTransform(translationX: origin.x, y: origin.y))
        var strokes = base
        for i in at where i < strokes.count { strokes[i].transform = base[i].transform.concatenating(by) }
        let d = PKDrawing(strokes: strokes)
        picked?.drawing = d
        put(s, d)
        picked?.drawing = s.canvas.drawing
        own = .resize(before: before, base: base, at: at, origin: origin, from: from, moved: true)
        ring()
      case let .loop(points, shown):
        if let first = shown.first, hypot(q.x - first.x, q.y - first.y) > 8 { resting?.cancel(); resting = nil }
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

  func penUp(rested: TimeInterval) {
    guard down, let s = active else { return }
    down = false
    active = nil
    resting?.cancel()
    resting = nil
    // a pen's or a highlighter's stroke ended resting: looked at when PencilKit hands the stroke over
    if own == nil, !ours { lastShape = nil }
    if own == nil, !ours, tool.snap == true, rested >= restFor {
      snap = (s, s.canvas.drawing.strokes.count, ProcessInfo.processInfo.systemUptime + 1.5)
    }
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
    hide(reach)
    switch o {
    case let .erase(before, _):
      let after = s.canvas.drawing
      if after != before { step(s, from: before, to: after) }
    case let .resize(before, _, _, _, _, moved):
      let after = s.canvas.drawing
      if moved, after != before { step(s, from: before, to: after) }
      picked?.drawing = after
      ring()
      tellPicked()
    case let .loop(points, _):
      if !spent { pick(s, within: points) }
    case let .drag(before, _, _, _, moved):
      let after = s.canvas.drawing
      if moved, after != before { step(s, from: before, to: after) }
      picked?.drawing = after
      ring()
      tellPicked()
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

  func far(_ p: CGPoint, from a: CGPoint, to b: CGPoint) -> CGFloat {
    let dx = b.x - a.x, dy = b.y - a.y
    let len = dx * dx + dy * dy
    if len < 0.000001 { return hypot(p.x - a.x, p.y - a.y) }
    let t = min(max(((p.x - a.x) * dx + (p.y - a.y) * dy) / len, 0), 1)
    return hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
  }

  /// A stroke's points as they lie in the drawing, one every `by` points along it, each with half its width.
  func along(_ k: PKStroke, by: CGFloat, _ f: (CGPoint, CGFloat) -> Bool) {
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
    let r = CGFloat(max(tool.width, 1)) / max(s.zoom, 0.01)
    let reach = CGRect(x: min(a.x, b.x), y: min(a.y, b.y), width: abs(a.x - b.x), height: abs(a.y - b.y)).insetBy(dx: -r, dy: -r)
    var left: [PKStroke] = []
    var gone = false
    let part = tool.mode == "part"
    for k in s.canvas.drawing.strokes {
      if !k.renderBounds.intersects(reach) { left.append(k); continue }
      if part {
        // what of it lies under the eraser goes, the rest stays as strokes of its own
        if let rest = Shapes.cut(k, from: a, to: b, within: r) { gone = true; left.append(contentsOf: rest) } else { left.append(k) }
        continue
      }
      var hit = false
      along(k, by: max(1, r)) { p, half in
        if self.far(p, from: a, to: b) <= r + half { hit = true }
        return !hit
      }
      if hit { gone = true } else { left.append(k) }
    }
    if gone { put(s, PKDrawing(strokes: left)) }
  }

  /// The eraser's reach, a ring under the Pencil while it erases.
  private func ringEraser(at q: CGPoint, in h: Host) {
    let r = CGFloat(max(tool.width, 1))
    show(reach, in: h, path: UIBezierPath(ovalIn: CGRect(x: q.x - r, y: q.y - r, width: r * 2, height: r * 2)).cgPath)
  }

  /// The strokes with most of themselves inside the loop are what the lasso holds.
  private func pick(_ s: Sheet, within points: [CGPoint]) {
    guard points.count >= 3 else { return }
    let path = UIBezierPath()
    path.move(to: points[0])
    for p in points.dropFirst() { path.addLine(to: p) }
    path.close()
    let box = path.bounds
    let z = max(s.zoom, 0.01)
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
    tellPicked()
  }

  /// The page is told where what the lasso holds lies, in its host's content: its menu goes there.
  private func tellPicked() {
    guard let k = picked, let h = k.sheet.host, let box = held(k) else { return }
    let z = k.sheet.zoom
    let o = k.sheet.canvas.frame.origin
    emit(["kind": "picked", "sheet": k.sheet.id, "host": h.id, "count": k.at.count, "clip": clip.count, "x": o.x + box.minX * z, "y": o.y + box.minY * z, "w": box.width * z, "h": box.height * z])
  }

  /// What the lasso holds is these strokes of its sheet now.
  private func repick(_ s: Sheet, _ at: [Int]) {
    picked = Picked(sheet: s, at: at, drawing: s.canvas.drawing)
    ring()
    tellPicked()
  }

  /// Something done with what the lasso holds, one step to undo. False when it holds nothing.
  private func selection(_ op: String, color c: UIColor?) -> Bool {
    guard !down, let k = picked else { return false }
    let s = k.sheet
    let before = s.canvas.drawing
    var strokes = before.strokes
    let at = k.at.filter { $0 < strokes.count }
    if at.isEmpty { return false }
    let mine = Set(at)
    switch op {
    case "copy", "cut":
      clip = at.map { strokes[$0] }
      clipBox = held(k) ?? .zero
      UIPasteboard.general.setData(PKDrawing(strokes: clip).dataRepresentation(), forPasteboardType: PKAppleDrawingTypeIdentifier as String)
      if op == "copy" { tellPicked(); return true }
      fallthrough
    case "delete":
      strokes = strokes.enumerated().filter { !mine.contains($0.offset) }.map { $0.element }
      unpick()
      put(s, PKDrawing(strokes: strokes))
      step(s, from: before, to: s.canvas.drawing)
    case "duplicate":
      let by = CGAffineTransform(translationX: 16, y: 16)
      let n = strokes.count
      for i in at { strokes.append(renamed(strokes[i], transform: strokes[i].transform.concatenating(by))) }
      unpick()
      put(s, PKDrawing(strokes: strokes))
      step(s, from: before, to: s.canvas.drawing)
      repick(s, Array(n..<strokes.count))
    case "color":
      guard let c = c else { return false }
      for i in at {
        var k2 = renamed(strokes[i], transform: strokes[i].transform)
        // a highlighter's stroke keeps how much of its colour shows
        k2.ink = PKInk(strokes[i].ink.inkType, color: c.withAlphaComponent(strokes[i].ink.color.cgColor.alpha))
        strokes[i] = k2
      }
      unpick()
      put(s, PKDrawing(strokes: strokes))
      step(s, from: before, to: s.canvas.drawing)
      repick(s, at)
    default:
      return false
    }
    return true
  }

  /// A stroke as another of the same look: made a moment later, so the store knows it for a new one (a stroke's
  /// name is made of when it was drawn, where its points are and how it lies, `native/ink.m`).
  func renamed(_ k: PKStroke, transform: CGAffineTransform) -> PKStroke {
    let path = PKStrokePath(controlPoints: Array(k.path), creationDate: k.path.creationDate.addingTimeInterval(0.002))
    return PKStroke(ink: k.ink, path: path, transform: transform, mask: k.mask)
  }

  /// What was cut or copied put down on `s` with its middle at `q` (the host's content), and held by the lasso.
  private func paste(on s: Sheet, at q: CGPoint) -> Bool {
    guard !down, !clip.isEmpty else { return false }
    let z = max(s.zoom, 0.01)
    let o = s.canvas.frame.origin
    var p = CGPoint(x: (q.x - o.x) / z, y: (q.y - o.y) / z)
    // kept on the sheet, as far as it fits
    let size = CGSize(width: s.canvas.frame.width / z, height: s.canvas.frame.height / z)
    p.x = min(max(p.x, min(clipBox.width / 2, size.width / 2)), max(size.width - clipBox.width / 2, size.width / 2))
    p.y = min(max(p.y, min(clipBox.height / 2, size.height / 2)), max(size.height - clipBox.height / 2, size.height / 2))
    let by = CGAffineTransform(translationX: p.x - clipBox.midX, y: p.y - clipBox.midY)
    let before = s.canvas.drawing
    var strokes = before.strokes
    let n = strokes.count
    for k in clip { strokes.append(renamed(k, transform: k.transform.concatenating(by))) }
    unpick()
    put(s, PKDrawing(strokes: strokes))
    step(s, from: before, to: s.canvas.drawing)
    s.canvas.isHidden = false
    repick(s, Array(n..<strokes.count))
    wait(s)
    return true
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
      hide(grip)
      return
    }
    let z = k.sheet.zoom
    let o = k.sheet.canvas.frame.origin
    let r = CGRect(x: o.x + box.minX * z, y: o.y + box.minY * z, width: box.width * z, height: box.height * z).insetBy(dx: -4, dy: -4)
    show(outline, in: h, path: UIBezierPath(rect: r).cgPath)
    show(grip, in: h, path: UIBezierPath(ovalIn: CGRect(x: r.maxX - 7, y: r.maxY - 7, width: 14, height: 14)).cgPath)
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
    hide(grip)
    emit(["kind": "unpicked"])
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
  func historySoon() {
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
  func forget() {
    history.removeAllActions()
    for s in sheets.values { s.stepped = false }
    historySoon()
  }

  /// Every sheet that has changed is kept now, not when it has been quiet: after an undo or a redo.
  func keepSoon() {
    if keeping { return }
    keeping = true
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      self.keeping = false
      for s in self.sheets.values where s.dirty && !(self.down && self.active === s) {
        s.quiet?.cancel()
        self.emit(["kind": "quiet", "sheet": s.id])
      }
      for f in self.surfaces.values {
        for l in f.dirtyLeaves() {
          l.quiet?.cancel()
          self.emit(["kind": "quiet", "sheet": l.id])
        }
      }
    }
  }

  func turn(back: Bool) {
    if down || surfaces.values.contains(where: { $0.isDown }) { return }
    unpick()
    for f in surfaces.values { f.unpick() }
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

  /// The stroke PencilKit just handed over, drawn again as the shape it most nearly is; as written when it is none.
  /// One more step to undo: taken back, the stroke is as it was drawn.
  private func shape(_ s: Sheet) {
    let before = s.canvas.drawing
    guard let k = before.strokes.last else { return }
    let marker = k.ink.inkType == .marker
    guard let found = Shapes.find(Shapes.points(of: k), closed: !marker) else { return }
    lastShape = found.name
    var strokes = Array(before.strokes.dropLast())
    strokes.append(contentsOf: Shapes.strokes(found, from: k))
    put(s, PKDrawing(strokes: strokes))
    step(s, from: before, to: s.canvas.drawing)
    emit(["kind": "shape", "sheet": s.id, "shape": found.name])
  }

  fileprivate func changed(_ s: Sheet) {
    if let k = picked, k.sheet === s, s.canvas.drawing != k.drawing { unpick() }
    if let w = snap, w.sheet === s {
      snap = nil
      lastShape = nil
      if ProcessInfo.processInfo.systemUptime < w.until, s.canvas.drawing.strokes.count == w.count + 1 { shape(s) }
    }
    historySoon()
    // an undo's change is kept at once
    if !(down && active === s), ProcessInfo.processInfo.systemUptime < hurry {
      keepSoon()
      return
    }
    // the stroke is the canvas's now: where it starts against where the Pencil came down
    if !ours, own == nil, var t = touched, t.lost == nil, let first = s.canvas.drawing.strokes.last?.path.first?.location {
      let z = s.canvas.zoomScale
      t.lost = Double(hypot(first.x * z - touchedAtPoint.x, first.y * z - touchedAtPoint.y) / max(s.over, 1))
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
    let filter: String? = spec.blend == "multiply" ? "multiplyBlendMode" : spec.blend == "screen" ? "screenBlendMode" : nil
    if (s.canvas.layer.compositingFilter as? String) != filter { s.canvas.layer.compositingFilter = filter }
    if picked?.sheet === s { ring(); tellPicked() }
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
    // (and across: pages zoomed past their pane scroll sideways, and what is written on them goes with them)
    let x = h.scroll.map { $0.contentOffset.x } ?? CGFloat(h.spec.left ?? 0)
    let origin = CGPoint(x: view.minX - port.minX - x, y: view.minY - port.minY - y)
    if h.content.frame.origin != origin { h.content.frame = CGRect(origin: origin, size: CGSize(width: view.width, height: 1)) }
    // the pages eased to where they will lie, and the page moving its scroller there: the sheets stay where they are shown
    if h.live?.phase == .held { stretch(h) }
  }

  private func bind(_ h: Host) {
    let box = onLayer(h.spec.view)
    if let s = h.scroll, s.window != nil {
      let f = s.convert(s.bounds, to: layer)
      // (still the scroller's: one the web view has let go of, its content no longer scrolling, stands where it stood)
      if abs(f.minX - box.minX) < 3 && abs(f.minY - box.minY) < 3 && abs(f.width - box.width) < 3 && abs(f.height - box.height) < 3 && abs(s.contentSize.height - CGFloat(h.spec.height)) < 4 { return }
    }
    h.watching = nil
    h.scroll = scrollView(for: box, height: CGFloat(h.spec.height))
    h.watching = h.scroll?.observe(\.contentOffset, options: []) { [weak self, weak h] _, _ in
      if let self = self, let h = h { self.follow(h) }
    }
  }

  private func bindSoon(_ h: Host, tries: Int) {
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { [weak self, weak h] in
      guard let self = self, let h = h, self.hosts[h.id] === h, h.scroll == nil else { return }
      self.bind(h)
      self.follow(h)
      if h.scroll == nil, tries > 1 { self.bindSoon(h, tries: tries - 1) }
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
      self.holes = (args.holes ?? []).map { self.onLayer($0) }
      // the ink stands aside for what the page lays over it: a menu, a tool's settings, a notice
      if self.holes.isEmpty {
        layer.layer.mask = nil
      } else {
        let path = UIBezierPath(rect: layer.bounds.insetBy(dx: -4000, dy: -4000))
        for h in self.holes { path.append(UIBezierPath(rect: h)) }
        let mask = CAShapeLayer()
        mask.fillRule = .evenOdd
        mask.path = path.cgPath
        layer.layer.mask = mask
      }
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
        // laid out anew: whatever a pinch stretched is as the page has it now
        if self.pinched[h.id] != nil || h.live?.phase == .held {
          self.unstretch(h)
        }
        self.bind(h)
        self.follow(h)
        // (the web view makes a scroller's scroll view a moment after the page has laid it out: looked for again)
        if h.scroll == nil { self.bindSoon(h, tries: 8) }
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
        // a notebook's sheet on its surface (87)
        if let (f, l) = self.leaf(args.sheet) {
          var d = PKDrawing()
          if let b = args.drawing, !b.isEmpty {
            guard let data = Data(base64Encoded: b), let read = try? PKDrawing(data: data) else {
              invoke.reject("not a drawing")
              return
            }
            d = read
          }
          invoke.resolve(Took(took: f.fill(l, d)))
          return
        }
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
      // a page's writing is its canvas, at rest as while it is written: drawn from the strokes at whatever size the
      // page is, never a picture stretched
      if args.show == true, !d.strokes.isEmpty { s.canvas.isHidden = false }
      invoke.resolve(Took(took: true))
    }
  }

  /// The drawing a sheet holds, when it has changed since the last time it was given.
  @objc public func take(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(SheetArgs.self)
    DispatchQueue.main.async {
      guard let s = self.sheets[args.sheet] else {
        if let (f, l) = self.leaf(args.sheet) {
          let (n, data) = f.taken(l)
          invoke.resolve(Taken(strokes: n, drawing: data))
          return
        }
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
      if let (f, l) = self.leaf(args.sheet) { f.wipe(l) }
      invoke.resolve()
    }
  }

  /// A dev run's: the canvases laid as they were before 86 (`on`), or as they are; each is laid again by the next scene.
  @objc public func plain(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(PenArgs.self)
    DispatchQueue.main.async {
      Sheet.plain = args.on
      for s in self.sheets.values { s.box = .zero }
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
      for f in self.surfaces.values { f.setTouchTypes() }
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
      if let n = args.seq {
        // (a page loaded anew counts from one again)
        if n < self.toolSeq, n > 1 { invoke.resolve(); return }
        self.toolSeq = n
      }
      let t = args.tool
      var made: PKInkingTool? = nil
      switch t.kind {
      case "pen", "highlighter":
        let type: PKInkingTool.InkType = t.kind == "pen" ? (self.inkTypes[t.ink ?? "pen"] ?? .pen) : .marker
        let range = type.validWidthRange
        var c = colour(t.color) ?? .black
        if let a = t.opacity, a < 1 { c = c.withAlphaComponent(CGFloat(min(max(a, 0.05), 1))) }
        made = PKInkingTool(type, color: c, width: min(max(CGFloat(t.width), range.lowerBound), range.upperBound))
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
      for f in self.surfaces.values { f.toolChanged() }
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
      for f in self.surfaces.values { f.setTouchTypes() }
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

  /// The inks a pen can be, by the names the page uses, where this system's PencilKit has them.
  private lazy var inkTypes: [String: PKInkingTool.InkType] = {
    var all: [String: PKInkingTool.InkType] = ["pen": .pen, "pencil": .pencil, "marker": .marker]
    if #available(iOS 17.0, *) {
      all["monoline"] = .monoline
      all["fountain"] = .fountainPen
    }
    return all
  }()

  /// What this device's PencilKit can do: the inks and the widths each takes, and whether a Pencil's squeeze is heard.
  @objc public func caps(_ invoke: Invoke) throws {
    var inks: [String: [Double]] = [:]
    for (name, type) in inkTypes {
      let r = type.validWidthRange
      inks[name] = [Double(r.lowerBound), Double(r.upperBound)]
    }
    var squeeze = false
    if #available(iOS 17.5, *) { squeeze = true }
    invoke.resolve(Caps(inks: inks, squeeze: squeeze))
  }

  /// Two fingers pinch the pages: the sheets are stretched as the page stretches them, until it lays them out anew.
  @objc public func pinch(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(PinchArgs.self)
    DispatchQueue.main.async {
      guard let h = self.hosts[args.host] else {
        invoke.resolve()
        return
      }
      if let to = args.to {
        // the pages eased to where the page will lay them out; from rest when no fingers began it (a finger's two taps)
        if h.live == nil {
          self.bind(h)
          self.follow(h)
          if let l = self.pagesLayer(of: h), let scroll = h.scroll, let zs = h.spec.zoom, let pages = h.spec.pages {
            h.pagesLayer = l
            h.live = Zoom(z0: CGFloat(zs.z), lo: CGFloat(zs.min), hi: CGFloat(zs.max), corner: CGPoint(x: pages.x, y: pages.y), from: .zero, ref: scroll.contentOffset)
          }
        }
        guard var z = h.live, z.phase != .held, z.phase != .settling else {
          // nothing of the web view's to stretch: the page lays out at once
          self.emit(["kind": "pinch", "phase": "settled", "native": false, "host": h.id, "k": 1, "x": 0, "y": 0])
          invoke.resolve()
          return
        }
        // (already there, to a pixel: nothing to ease)
        let far = abs(z.k - CGFloat(to.k)) * max(h.spec.pages?.w ?? 1000, 1) > 1 || hypot(z.t.x - CGFloat(to.tx), z.t.y - CGFloat(to.ty)) > 1
        z.k = CGFloat(to.k)
        z.t = CGPoint(x: to.tx, y: to.ty)
        z.phase = .settling
        h.live = z
        self.stretch(h, over: far ? max(0, args.ms ?? 0) : 0) { [weak self, weak h] in
          guard let self = self, let h = h, h.live?.phase == .settling else { return }
          h.live?.phase = .held
          self.emit(["kind": "pinch", "phase": "settled", "native": true, "host": h.id, "k": to.k, "x": 0, "y": 0])
          // (and a page that never lays out leaves nothing stretched)
          DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) { [weak self, weak h] in
            if let self = self, let h = h, h.live?.phase == .held { self.unstretch(h) }
          }
        }
        invoke.resolve()
        return
      }
      if h.live != nil {
        // (the page takes the zoom back: as they lie)
        if args.k == nil { self.unstretch(h) }
        invoke.resolve()
        return
      }
      CATransaction.begin()
      CATransaction.setDisableActions(true)
      if let k = args.k {
        // a sublayer's transform is about the layer's own middle
        let b = h.content.layer.bounds
        let a = h.content.layer.anchorPoint
        let c = CGPoint(x: b.minX + b.width * a.x, y: b.minY + b.height * a.y)
        let kk = CGFloat(k)
        let t = CGAffineTransform(a: kk, b: 0, c: 0, d: kk, tx: CGFloat(args.dx ?? 0) + (kk - 1) * c.x, ty: CGFloat(args.dy ?? 0) + (kk - 1) * c.y)
        h.content.layer.sublayerTransform = CATransform3DMakeAffineTransform(t)
        self.pinched[h.id] = kk
      } else {
        h.content.layer.sublayerTransform = CATransform3DIdentity
        self.pinched[h.id] = nil
      }
      CATransaction.commit()
      invoke.resolve()
    }
  }

  /// What the lasso holds cut, copied, duplicated, deleted, or given a colour.
  @objc public func selection(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(SelectionArgs.self)
    DispatchQueue.main.async {
      // what the lasso holds on a notebook's surface, where it holds something there
      if let f = self.surfaces.values.first(where: { $0.selected > 0 }) {
        if !f.selection(args.op, color: args.color.flatMap { colour($0) }) {
          invoke.reject("not something done with a selection")
          return
        }
        self.hurry = ProcessInfo.processInfo.systemUptime + 1
        self.keepSoon()
        invoke.resolve(Selected(selected: f.selected, clip: self.clip.count))
        return
      }
      if !self.selection(args.op, color: args.color.flatMap { colour($0) }) {
        invoke.reject(self.picked == nil ? "nothing is selected" : "not something done with a selection")
        return
      }
      self.hurry = ProcessInfo.processInfo.systemUptime + 1
      self.keepSoon()
      invoke.resolve(Selected(selected: self.picked?.at.count ?? 0, clip: self.clip.count))
    }
  }

  /// What was cut or copied put down on a sheet, its middle at a place in the host's content.
  @objc public func paste(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(PasteArgs.self)
    DispatchQueue.main.async {
      if let (f, l) = self.leaf(args.sheet) {
        guard f.paste(on: l, at: CGPoint(x: args.x, y: args.y)) else {
          invoke.reject("nothing was cut or copied")
          return
        }
        invoke.resolve(Selected(selected: f.selected, clip: self.clip.count))
        return
      }
      guard let s = self.sheets[args.sheet], self.paste(on: s, at: CGPoint(x: args.x, y: args.y)) else {
        invoke.reject(self.clip.isEmpty ? "nothing was cut or copied" : "no such sheet")
        return
      }
      invoke.resolve(Selected(selected: self.picked?.at.count ?? 0, clip: self.clip.count))
    }
  }

  /// The system's share sheet for a file, from `at` on the page: answered when it closes, with whether it was sent anywhere.
  @objc public func share(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(ShareArgs.self)
    DispatchQueue.main.async {
      guard let web = self.web, var top = web.window?.rootViewController else {
        invoke.reject("no web view yet")
        return
      }
      let url = URL(fileURLWithPath: args.path)
      guard FileManager.default.fileExists(atPath: url.path) else {
        invoke.reject("no such file")
        return
      }
      while let over = top.presentedViewController, !over.isBeingDismissed { top = over }
      let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
      sheet.completionWithItemsHandler = { [weak self] _, done, _, _ in
        self?.sharing = false
        invoke.resolve(Shared(done: done))
      }
      if let pop = sheet.popoverPresentationController {
        pop.sourceView = web
        pop.sourceRect = args.at.map { web.scrollView.convert($0.rect, to: web) } ?? CGRect(x: web.bounds.midX, y: web.bounds.midY, width: 1, height: 1)
      }
      self.sharing = true
      self.shareSheet = sheet
      top.present(sheet, animated: true)
    }
  }

  /// A dev run's: the share sheet closed, as if nothing were chosen.
  @objc public func unshare(_ invoke: Invoke) throws {
    DispatchQueue.main.async {
      if let sheet = self.shareSheet {
        let done = sheet.completionWithItemsHandler
        sheet.completionWithItemsHandler = nil
        sheet.dismiss(animated: false) { done?(nil, false, nil, nil) }
        if sheet.presentingViewController == nil { done?(nil, false, nil, nil) }
      }
      invoke.resolve()
    }
  }

  /// A dev run's: the Pencil tapped twice (`tap`) or squeezed, as the system would say it.
  @objc public func pencilDev(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(PencilArgs.self)
    DispatchQueue.main.async {
      if args.what == "three", let f = self.surfaces.values.first {
        f.threeTapped()
      } else if args.what == "three", let h = self.hosts.values.first(where: { $0.clip.frame.height > 0 }), let web = self.web, let layer = self.layer {
        // three fingers tapped at the middle of the pages: what the recogniser says when it sees them (no rig's three fingers are taken for a tap)
        let p = layer.convert(CGPoint(x: h.clip.frame.midX, y: h.clip.frame.midY), to: web.scrollView)
        self.emit(["kind": "fingers", "n": 3, "x": p.x, "y": p.y])
      } else {
        self.pencil(args.what == "squeeze" ? "squeeze" : "tap", prefer: args.what == "squeeze" ? "palette" : "eraser")
      }
      invoke.resolve()
    }
  }

  /// A dev run's: a stroke of the ink held through these points of a sheet's drawing, as if written and, with `rest`,
  /// ended with the Pencil resting: what the shapes make of it is what they make of a written one.
  @objc public func stroke(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(StrokeArgs.self)
    DispatchQueue.main.async {
      if let (f, l) = self.leaf(args.sheet), args.points.count >= 1 {
        let w = self.ink.width
        // (a highlighter's points as a finger's are: the nib upright, two thirds of the tool's width)
        let marker = self.ink.inkType == .marker
        let pts = args.points.enumerated().map { i, p in
          PKStrokePoint(location: CGPoint(x: p[0], y: p[1]), timeOffset: Double(i) * 0.01, size: CGSize(width: p.count > 2 ? p[2] : marker ? w / 1.5 : w * 1.3, height: p.count > 2 ? p[2] : marker ? w / 1.5 : w * 1.3), opacity: 1, force: 1, azimuth: marker ? .pi / 2 : 0, altitude: .pi / 2)
        }
        self.lastShape = nil
        f.write(l, PKStroke(ink: self.ink.ink, path: PKStrokePath(controlPoints: pts, creationDate: Date()), transform: .identity, mask: nil), rest: args.rest)
        invoke.resolve()
        return
      }
      guard let s = self.sheets[args.sheet], args.points.count >= 2 else {
        invoke.reject("no such sheet")
        return
      }
      let w = self.ink.width
      let pts = args.points.enumerated().map { i, p in
        PKStrokePoint(location: CGPoint(x: p[0], y: p[1]), timeOffset: Double(i) * 0.01, size: CGSize(width: w * 1.3, height: w * 1.3), opacity: 1, force: 1, azimuth: 0, altitude: .pi / 2)
      }
      let before = s.canvas.drawing
      let k = PKStroke(ink: self.ink.ink, path: PKStrokePath(controlPoints: pts, creationDate: Date()), transform: .identity, mask: nil)
      self.lastShape = nil
      self.put(s, PKDrawing(strokes: before.strokes + [k]))
      self.step(s, from: before, to: s.canvas.drawing)
      if args.rest, self.tool.snap == true { self.shape(s) }
      s.canvas.isHidden = false
      self.wait(s)
      invoke.resolve()
    }
  }

  /// The pixels to a pixel of the screen of every layer under a canvas that holds a picture or is drawn into by Metal.
  private func drawn(_ canvas: UIView, screen: CGFloat) -> [Double] {
    guard let top = canvas.window?.layer else { return [] }
    var out = Set<Double>()
    func look(_ l: CALayer) {
      if l.bounds.width > 0, !l.isHidden {
        let shown = l.convert(l.bounds, to: top).width * screen
        var has: CGFloat = 0
        if let m = l as? CAMetalLayer { has = m.drawableSize.width } else if l.contents != nil { has = l.bounds.width * l.contentsScale }
        if has > 0, shown > 0 { out.insert((Double(has / shown) * 100).rounded() / 100) }
      }
      for k in l.sublayers ?? [] { look(k) }
    }
    look(canvas.layer)
    return out.sorted()
  }

  /// A dev run's: a sheet's drawing as PencilKit draws a picture of it, a pixel of the picture to a pixel of the screen
  /// where the canvas lies now, on white: what the canvas on the glass is held against (86).
  @objc public func picture(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(PictureArgs.self)
    DispatchQueue.main.async {
      if let (f, l) = self.leaf(args.sheet) {
        if let made = f.pictures(l, name: args.name) { invoke.resolve(made) } else { invoke.reject("no picture") }
        return
      }
      guard let s = self.sheets[args.sheet] else {
        invoke.reject("no such sheet")
        return
      }
      let z = max(s.zoom, 0.01)
      let screen = s.canvas.window?.screen.scale ?? UIScreen.main.scale
      let size = s.box.size
      var made: UIImage? = nil
      UITraitCollection(userInterfaceStyle: .light).performAsCurrent {
        made = s.canvas.drawing.image(from: CGRect(x: 0, y: 0, width: size.width / z, height: size.height / z), scale: z * screen)
      }
      guard let image = made, let cg = image.cgImage else {
        invoke.reject("no picture")
        return
      }
      let format = UIGraphicsImageRendererFormat()
      format.scale = 1
      format.opaque = true
      let px = CGSize(width: cg.width, height: cg.height)
      let png = UIGraphicsImageRenderer(size: px, format: format).pngData { c in
        UIColor.white.setFill()
        c.fill(CGRect(origin: .zero, size: px))
        UIImage(cgImage: cg, scale: 1, orientation: .up).draw(in: CGRect(origin: .zero, size: px))
      }
      let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      let name = args.name.replacingOccurrences(of: "/", with: "-")
      do {
        try png.write(to: docs.appendingPathComponent("\(name).png"))
        invoke.resolve(["w": cg.width, "h": cg.height])
      } catch {
        invoke.reject("not written")
      }
    }
  }

  /// How it all stands, for the checks.
  @objc public func state(_ invoke: Invoke) throws {
    DispatchQueue.main.async {
      guard let layer = self.layer, let web = self.web else {
        invoke.resolve(State(sheets: [], hosts: [], tools: false, tool: self.tool, finger: self.finger, undo: self.history.canUndo, redo: self.history.canRedo, wheel: self.wheel != nil, selected: 0, held: nil, clip: self.clip.count, shape: self.lastShape, pinch: 1, sharing: self.sharing, down: false, scribble: self.scribble, touched: nil, lastTouched: []))
        return
      }
      let sheets = self.sheets.values.sorted { $0.id < $1.id }.map { s -> SheetState in
        let at = s.canvas.convert(s.canvas.bounds, to: layer)
        let onWeb = layer.convert(at, to: web.scrollView)
        let screen = s.canvas.window?.screen.scale ?? UIScreen.main.scale
        let inWindow = s.canvas.convert(s.canvas.bounds, to: nil)
        let device = CGRect(x: inWindow.minX * screen, y: inWindow.minY * screen, width: inWindow.width * screen, height: inWindow.height * screen)
        return SheetState(id: s.id, strokes: s.canvas.drawing.strokes.count, shown: !s.canvas.isHidden, dirty: s.dirty, at: Box(CGRect(origin: onWeb.origin, size: s.canvas.frame.size)), pixels: Double(s.canvas.zoomScale * screen), blend: s.canvas.layer.compositingFilter as? String, device: Box(device), stretch: Double(s.box.width > 0 ? inWindow.width / s.box.width : 1), drawn: self.drawn(s.canvas, screen: screen))
      }
      var heldAt: Box? = nil
      if let k = self.picked, let box = self.held(k) {
        let z = k.sheet.canvas.zoomScale
        let on = k.sheet.canvas.convert(CGRect(x: box.minX * z, y: box.minY * z, width: box.width * z, height: box.height * z), to: layer)
        heldAt = Box(layer.convert(on, to: web.scrollView))
      }
      let hosts = self.hosts.values.sorted { $0.id < $1.id }.map { h in
        HostState(id: h.id, follows: h.scroll != nil, offset: Double(h.scroll?.contentOffset.y ?? -1), port: Box(h.clip.frame), zoomer: self.pagesLayer(of: h) != nil, layers: self.layersOver(h), phase: h.live?.phase.rawValue)
      }
      let onSurface = self.surfaces.values.first(where: { $0.selected > 0 })
      if let f = onSurface { heldAt = f.heldAt() }
      var whole = State(sheets: sheets, hosts: hosts, tools: false, tool: self.tool, finger: self.finger, undo: self.history.canUndo, redo: self.history.canRedo, wheel: self.wheel != nil, selected: onSurface?.selected ?? self.picked?.at.count ?? 0, held: heldAt, clip: self.clip.count, shape: self.lastShape, pinch: Double(self.hosts.values.compactMap { $0.live?.k }.first ?? self.pinched.values.first ?? 1), sharing: self.sharing, down: self.down || self.surfaces.values.contains(where: { $0.isDown }), scribble: self.scribble, touched: self.touched, lastTouched: self.lastTouched)
      whole.surfaces = self.surfaces.values.sorted { $0.id < $1.id }.map { $0.state() }
      for f in self.surfaces.values.sorted(by: { $0.id < $1.id }) {
        whole.sheets += f.sheetStates()
        whole.hosts.append(f.hostState())
      }
      invoke.resolve(whole)
    }
  }

  // ── a notebook's surface (87; `Surface.swift`) ──

  /// A sheet of some notebook's surface, by the name its strokes are kept under.
  func leaf(_ id: String) -> (NoteSurface, Leaf)? {
    for f in surfaces.values { if let l = f.leaf(named: id) { return (f, l) } }
    return nil
  }

  /// Where a notebook's pages lie and what they hold; with no place, the surface goes.
  @objc public func surface(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(SurfaceArgs.self)
    DispatchQueue.main.async {
      guard let web = self.web, let parent = web.superview else {
        invoke.reject("no web view yet")
        return
      }
      guard let at = args.at else {
        if let f = self.surfaces[args.id] {
          f.remove()
          self.surfaces[args.id] = nil
        }
        invoke.resolve()
        return
      }
      let f = self.surfaces[args.id] ?? {
        let made = NoteSurface(id: args.id, plugin: self)
        self.surfaces[args.id] = made
        return made
      }()
      // over the web view, and over the canvases' layer where there is one
      f.take(args, on: parent, above: self.layer ?? web, at: web.scrollView.convert(at.rect, to: parent))
      invoke.resolve()
    }
  }

  /// A surface asked to go to a place or a zoom.
  @objc public func surfaceDo(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(SurfaceDoArgs.self)
    DispatchQueue.main.async {
      guard let f = self.surfaces[args.id] else {
        invoke.reject("no such surface")
        return
      }
      switch args.op {
      case "go":
        if let p = args.place { f.go(p, animated: args.animated ?? false) }
        invoke.resolve()
      case "zoom":
        if let z = args.zoom { f.zoom(to: CGFloat(z), animated: args.animated ?? true) }
        invoke.resolve()
      case "settle":
        f.whenSharp { invoke.resolve() }
      case "picture":
        invoke.resolve(["data": f.picture() ?? ""])
      default:
        invoke.reject("not something a surface does")
      }
    }
  }

  func emit(_ m: [String: Any]) {
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
