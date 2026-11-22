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

@_silgen_name("ilmi_drawing_names") private func c_drawing_names(_ drawing: UnsafeRawPointer, _ out: UnsafeMutablePointer<UnsafeMutablePointer<UInt8>?>, _ len: UnsafeMutablePointer<Int>) -> Int32
@_silgen_name("ilmi_drawing_describe") private func c_drawing_describe(_ drawing: UnsafeRawPointer, _ indices: UnsafePointer<UInt32>, _ n: Int, _ out: UnsafeMutablePointer<UnsafeMutablePointer<UInt8>?>, _ len: UnsafeMutablePointer<Int>) -> Int32
@_silgen_name("ilmi_ink_free") private func c_ink_free(_ p: UnsafeMutablePointer<UInt8>?)

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
  /// The page draws what the sheet holds, itself, in the page's own element (89: a PDF's page). The canvas then shows
  /// only what PencilKit has not yet handed over; what the sheet holds is kept beside it and told to the page.
  var vector: Bool?
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
  /// The names the store has the drawing's strokes under, in the drawing's order (89): what the page knows them by.
  var names: [String]?
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
  /// A dev run's stand-in for one stroke only: when the finger that wrote it lifts, a finger is a finger again
  /// (as a Pencil lifted and two fingers put down at once are, which no rig's finger can be otherwise).
  var once: Bool?
  /// A dev run's: what PencilKit's canvas shows of a sheet the page draws stays on it (true) until told otherwise
  /// (false), so a capture can be taken of a stroke lifted and still PencilKit's.
  var keep: Bool?
}

/// The tool held: `pen`, `highlighter`, `eraser` or `select`; its colour as `#rrggbb`; the ink's width in points,
/// or for the eraser how far it reaches, in the screen's.
struct ToolSpec: Codable {
  var kind: String
  var color: String
  var width: Double
  /// A pen's ink, by name: `pen`, `monoline`, `fountain`, `pencil` (85). None is `pen`; a highlighter's is the marker.
  var ink: String?
  /// How much a pen's line follows pressure: 0 an even line, 1 the ink's own (none is 1), up to 2.
  var sense: Double?
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
  /// Each `[x, y]`, with a size and then a force where it has its own.
  var points: [[Double]]
  var rest: Bool
  /// Handed over as PencilKit hands a written stroke over (through the canvas, so through the pen's `pressure` and
  /// thinness), where without it the stroke is put on the sheet as it is.
  var hand: Bool?
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
  /// The last telling of what the sheet holds (89, `tell`): what was taken is what that telling said.
  var seq: Int = 0
}

/// The strokes of a sheet the page asks the outlines of, by name (89).
struct OutlineArgs: Decodable {
  var sheet: String
  var names: [String]
}

/// The page has drawn what a sheet said it holds, up to the telling `seq` (89).
struct ShownArgs: Decodable {
  var sheet: String
  var seq: Int
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
  /// The page draws what it holds (89); and then how many strokes PencilKit's canvas still shows (written, handed
  /// over, and not yet known to be drawn by the page), the last telling and the last the page said it had drawn.
  var vector: Bool = false
  var live: Int = 0
  var said: Int = 0
  var seen: Int = 0
  /// The last time the pages began to move with PencilKit's canvas still showing strokes: how long after the Pencil
  /// lifted that was, and how long after it the canvas was empty and away, ms (none while it is not yet).
  var hurriedAfter: Double? = nil
  var hurriedFor: Double? = nil
  /// What happened to what was last written here, each with its ms from the Pencil's lift: handed over by
  /// PencilKit, told to the page, said drawn by it, the canvas emptied.
  var trace: [String] = []
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
  /// The layer two fingers stretch, where it lies in the scroller's content (`x,y wxh`), for a dev run's notes: the column's own, never one that holds the bar over the pages too.
  var stretched: String? = nil
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
  /// A dev run's: the last touches as the layer met them, each a line (when, where, the sheet under it, where its
  /// canvas's recogniser stood, what the watcher then saw).
  var touchLog: [String] = []
  /// A dev run's: the stroke last written, how wide it was under the Pencil and how wide it is kept (its points' mean
  /// widths, in the sheet's points): the two are to be one, so nothing changes when the Pencil lifts.
  var lastWidths: [Double] = []
  /// A dev run's: the points PencilKit made of the stroke last written, a few of them (`w×h f a z o`: size, force,
  /// altitude, azimuth, opacity), with its ink and the tool's width: what its sizing is, read off.
  var lastPoints: String = ""
  /// A dev run's: from each touch to the frame the stroke being written was drawn with it, the last few (ms).
  var lastLags: [Double] = []
  /// A dev run's: how far UIKit's rounded place of a touch was from its precise one, at most, in the last stroke kept.
  var lastRounding: Double = 0
  /// A dev run's: each eraser move's hit test and its handing of the strokes left (ms); a notebook's picture of the
  /// place drawn again at once (ms, pixels; and how many were too large and left to the pictures); a PDF page's time
  /// from the strokes left until the page said it had drawn them (ms).
  var eraseHit: [Double] = []
  var erasePut: [Double] = []
  var erasePatch: [Double] = []
  var erasePatchPx: [Int] = []
  var eraseSkipped: Int = 0
  var eraseShown: [Double] = []
  /// A dev run's: the turn between neighbouring two-pixel pieces of the last stroke kept, as drawn on the glass now (degrees: largest, 99th).
  var lastTurns: [Double] = []
  /// A dev run's: the last stroke kept, measured (`lastCompare` in the plugin).
  var lastCompare: [String: [Double]] = [:]
  /// A dev run's: strokes kept as they were drawn while written (`Live.swift`), and those kept as PencilKit's.
  var liveKept: Int = 0
  var liveMissed: Int = 0
  var liveMisses: [String] = []
  /// The page's own word that a telling is on the glass is heard (89, `InkPlugin.bindSignal`): its scroller is found.
  var signal: Bool = false
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
  /// Until when two fingers' stretch waits for what PencilKit's canvas shows to become the page's (`InkPlugin.held`).
  var holdUntil: TimeInterval = 0
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
  /// The stroke being written on it, drawn by ilmi (`Live.swift`).
  lazy var live = LiveInk(canvas: canvas)
  /// While the eraser is down on it (a sheet the page draws): its strokes drawn on the glass (`EraseGlass`).
  var eraseGlass: EraseGlass?
  /// A telling held back while the page has yet to draw the one before (the eraser's moves come faster than it draws).
  var tellLater = false
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
    canvas.history = scratch
    canvas.delegate = self
  }

  /// What the page last gave it or took from it: PencilKit says a drawing changed when it is given one, whenever it likes.
  var given = PKDrawing()

  // ── a sheet the page draws itself (89) ──
  //
  // What is written on a PDF's page is drawn by the page, in the page's own element, from each stroke's outline: so
  // whatever scrolls, stretches or lays out the page carries its ink, by construction, and nothing here has to keep
  // step with it. The sheet then holds its strokes beside the canvas (`model`), and the canvas is PencilKit's place
  // for what is being written only. When PencilKit hands a stroke over it joins the model and the page is told of
  // it (`InkPlugin.tell`), to hold it unseen while the canvas still shows it (`glass`, `hidden`): a stroke is on the
  // glass once. When the writing pauses the page is told to show what it holds, says when it has (`shown`), and
  // only then is the canvas emptied (`InkPlugin.settle`): two frames with both, never one with neither.
  var vector = false
  var model = PKDrawing()
  /// What the sheet holds: its own strokes where the page draws them, the canvas's otherwise.
  var drawing: PKDrawing {
    get { vector ? model : canvas.drawing }
    set {
      if vector { model = newValue } else {
        setting = true
        canvas.drawing = newValue
        setting = false
        counted = newValue.strokes.count
      }
    }
  }
  /// A canvas that is its sheet (a typed note's area): how many strokes it held when it was last given a drawing or
  /// a stroke was last taken from PencilKit, and that it is being given one now. More than that is PencilKit's doing:
  /// a stroke written (`InkPlugin.took`).
  var counted = 0
  var setting = false
  /// How many of the canvas's strokes have joined the model, and that the canvas is being emptied (PencilKit says so as a change).
  var taken = 0
  var clearing = false
  /// The tellings: the last made, and the last the page said it had drawn.
  var said = 0
  var seen = 0
  /// The strokes of the model PencilKit's canvas still shows, by name; whether the page was told to hold them
  /// unseen; and the telling that had it show them (0 while they are unseen).
  var glass: [String] = []
  var hidden = false
  var revealed = 0
  /// When the Pencil last lifted here, and until when a stroke it ended may yet be handed over by PencilKit.
  var liftedAt: TimeInterval = 0
  var awaiting: TimeInterval = 0
  /// Until when what the canvas shows is handed to the page without the pause: the pages began to move under it
  /// (`InkPlugin.hurry`). And, for the checks, when that last was, how long after the lift, and how long it took.
  var rush: TimeInterval = 0
  var rushedAt: TimeInterval = 0
  var rushedAfter: Double?
  var rushedFor: Double?
  /// How the page says a sheet the page draws is laid on it (`multiplyBlendMode`, `screenBlendMode`): a highlighter's way.
  var blend: String?
  /// When the page was last told to show what the canvas shows, and the ticket that telling carried (`InkPlugin.stamp`).
  var revealedAt: TimeInterval = 0
  var stamp = 0
  var trace: [String] = []
  func mark(_ what: String) {
    if trace.count >= 60 { trace.removeFirst(20) }
    trace.append("\(Int(((ProcessInfo.processInfo.systemUptime - liftedAt) * 1000).rounded())) \(what)")
  }
  /// The strokes the page knows the outline of, by name.
  var told = Set<String>()
  /// PencilKit's own undo of what is on the canvas: not ours (a stroke handed over is a step of the plugin's).
  let scratch = UndoManager()

  /// How many of its own pixels the canvas draws to each of the screen's, each way (86): PencilKit softens a stroke's
  /// edge over nearly two of the pixels it draws with, so the canvas is made larger than it is shown and shown
  /// smaller, and an edge is about one pixel of the screen. 1 where that would be more pixels than a canvas should hold.
  var over: CGFloat = 1
  /// Where it lies in its host's content, on whole pixels of the screen.
  var box = CGRect.zero

  /// Laid where the page says. True when that is another place or size than it had.
  @discardableResult
  func place(_ asked: CGRect, zoom z: CGFloat) -> Bool {
    let screen = canvas.window?.screen.scale ?? UIScreen.main.scale
    // on whole pixels: a canvas between two is drawn across both, and all its ink with it
    let x0 = (asked.minX * screen).rounded() / screen, y0 = (asked.minY * screen).rounded() / screen
    let frame = Sheet.plain ? asked : CGRect(x: x0, y: y0, width: max(1, ((asked.maxX * screen).rounded() / screen) - x0), height: max(1, ((asked.maxY * screen).rounded() / screen) - y0))
    let px = frame.width * frame.height * screen * screen
    let k = Sheet.plain ? 1 : max(1, min(2, (Sheet.most / max(px, 1)).squareRoot()))
    // (a whole number of the canvas's own pixels each way, so nothing of it is between two)
    let size = Sheet.plain ? frame.size : CGSize(width: (frame.width * k * screen).rounded() / screen, height: (frame.height * k * screen).rounded() / screen)
    if box == frame, over == k, abs(z - zoom) <= 0.0001, canvas.zoomScale == z * k / LiveInk.drawn(scaled: vector) { return false }
    let first = box == .zero
    box = frame
    over = k
    zoom = z
    canvas.transform = .identity
    canvas.bounds = CGRect(origin: .zero, size: size)
    canvas.center = CGPoint(x: frame.midX, y: frame.midY)
    canvas.transform = CGAffineTransform(scaleX: frame.width / size.width, y: frame.height / size.height)
    // (PencilKit's own drawing draws in a space `LiveInk.scale` times as large on a page the page draws: `LiveInk.pencilKit`)
    let zz = z * k / LiveInk.drawn(scaled: vector)
    if canvas.zoomScale != zz {
      canvas.maximumZoomScale = max(canvas.maximumZoomScale, zz)
      canvas.minimumZoomScale = min(canvas.minimumZoomScale, zz)
      canvas.zoomScale = zz
      canvas.minimumZoomScale = zz
      canvas.maximumZoomScale = zz
    }
    if canvas.contentSize != size { canvas.contentSize = size }
    if canvas.contentOffset != .zero { canvas.contentOffset = .zero }
    return !first
  }

  /// A dev run's: the canvases as they were before 86, wherever the page puts them and a pixel for a pixel, to measure against.
  static var plain = false
  /// The most pixels a canvas draws with: a page at fit on a 13-inch iPad twice over each way and to spare, less where memory is short.
  static let most: CGFloat = {
    let memory = ProcessInfo.processInfo.physicalMemory
    return memory >= 7_000_000_000 ? 24_000_000 : memory >= 5_500_000_000 ? 16_000_000 : 8_000_000
  }()

  func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
    // (the canvas emptied, in the turn the page shows what it held: what was drawn of it here goes with it)
    if LiveInk.ours, canvasView.drawing.strokes.isEmpty { live.clearGlass() }
    if vector {
      if clearing { return }
      let all = canvasView.drawing.strokes
      // (PencilKit hands a stroke over a moment after it ends, and by then the next may be under the Pencil: only what
      // it has not handed over before is new)
      if all.count <= taken { taken = all.count; return }
      let fresh = Array(all[taken...])
      taken = all.count
      plugin?.wrote(self, fresh)
      return
    }
    let now = canvasView.drawing.strokes.count
    if !setting, now > counted, let p = plugin {
      p.took(self, from: counted)
      return
    }
    counted = now
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
  /// Every event of the touch that writes, with what the system coalesced into it and predicts after it: the stroke
  /// being written is drawn from these (`Live.swift`). `ended`: the last, just before `penUp`.
  func penSample(_ t: UITouch, _ event: UIEvent?, ended: Bool)
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
    LiveClock.shared.touch(t, event)
    ears?.penDown(t)
    ears?.penSample(t, event, ended: false)
  }

  override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
    guard let t = touch, touches.contains(t) else { return }
    let p = t.location(in: view)
    if hypot(p.x - stillAt.x, p.y - stillAt.y) > tremor {
      stillAt = p
      stillSince = t.timestamp
    }
    ears?.penSample(t, event, ended: false)
    LiveClock.shared.touch(t, event)
    ears?.penMoved(t)
  }

  private func finish(_ touches: Set<UITouch>, _ event: UIEvent?) {
    guard let t = touch, touches.contains(t) else { return }
    touch = nil
    state = .failed
    ears?.penSample(t, event, ended: true)
    ears?.penUp(rested: t.timestamp - stillSince)
  }

  override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent) { finish(touches, event) }
  override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent) { finish(touches, event) }
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
  private var standInOnce = false
  private var keepOnCanvas = false
  /// The page's `draw with finger`: a finger writes as the Pencil does, and two scroll.
  private var finger = false
  var fingerWrites: Bool { standIn || finger }
  /// The tool held, and the ink every canvas has: the last pen or highlighter.
  private var toolSeq = 0
  private(set) var tool = ToolSpec(kind: "pen", color: "#000000", width: 2.2)
  private(set) var ink = PKInkingTool(.pen, color: .black, width: 2.2)
  /// How much thinner than PencilKit wrote it a pen's stroke is to be (1: as written).
  private(set) var thin: CGFloat = 1
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
  /// How what the lasso holds is carried under the Pencil, on a sheet the page draws (89); and strokes' names, kept.
  private var carried: CGAffineTransform?
  private var named: [StrokeMark: String] = [:]
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
  private var touchLog: [String] = []

  // ── a stroke is on the glass once: the page's commit empties the canvas ──
  //
  // A stroke passes from PencilKit's canvas (a view of this process) to the page's own path (the web view's, drawn
  // by another process). Told by a message that the page has drawn it, the canvas was emptied some frames after the
  // path was on the glass: for those frames the stroke was there twice, and ink laid on twice is darker wherever it
  // is laid on by multiplying. The other order (the canvas emptied first) is a frame or more with no stroke at all,
  // which shows on every ink, black most of all. Neither: the web view's layers are put on the glass by this
  // process, in a transaction on the main thread that applies what the page's process committed, and that same
  // commit carries the size of every scroller's content. So the page, in the turn it shows a telling's paths, sets
  // the height of what a tiny scroller of its own holds to the telling's ticket (`stamp`; `signalDrawn` in
  // `pageInk.ts`); the web view makes that scroller a `UIScrollView` here, whose `contentSize` changes inside the
  // transaction that puts the paths on the glass; and the canvas is emptied in the observer of that change, in
  // that transaction. One frame has the canvas's stroke, the next the page's, whatever either is laid on with.
  // The page's message (`shown`) is still heard, for a web view that makes no scroll view of the scroller.
  private var stamp = 0
  private weak var signal: UIScrollView?
  private var signalWatch: NSKeyValueObservation?
  static let signalSize = CGSize(width: 3, height: 5)
  static let signalBase: CGFloat = 1000

  private func bindSignal() {
    if let s = signal, s.window != nil { return }
    guard let web = web else { return }
    signalWatch = nil
    signal = nil
    walk(web.scrollView) { v in
      guard signal == nil, let s = v as? UIScrollView, s !== web.scrollView, abs(s.bounds.width - InkPlugin.signalSize.width) < 0.6, abs(s.bounds.height - InkPlugin.signalSize.height) < 0.6 else { return }
      signal = s
    }
    signalWatch = signal?.observe(\.contentSize, options: []) { [weak self] s, _ in
      self?.drawn(upTo: Int((s.contentSize.height - InkPlugin.signalBase).rounded()))
    }
    // (found late: what it says already is heard now)
    if let s = signal { drawn(upTo: Int((s.contentSize.height - InkPlugin.signalBase).rounded())) }
  }

  /// The page's commit that shows every telling up to the ticket `t` is being put on the glass now.
  private func drawn(upTo t: Int) {
    for s in sheets.values where s.vector && s.stamp > 0 && s.stamp <= t && !s.hidden && !s.glass.isEmpty && s.seen < s.revealed {
      s.seen = max(s.seen, s.revealed)
      s.mark("on the glass, ticket \(s.stamp)")
      settle(s)
    }
  }
  fileprivate func noteTouch(_ what: String) {
    if touchLog.count >= 80 { touchLog.removeFirst(20) }
    touchLog.append("\(Int((ProcessInfo.processInfo.systemUptime * 1000).rounded()) % 1000000) \(what)")
  }

  /// How long the writing is left alone before it is kept.
  let quietAfter = 2.5
  /// How near the lower edge the Pencil is when an area grows.
  private let edge: CGFloat = 72
  /// How long the Pencil rests at a stroke's end for the stroke to be a shape, and under the lasso for `paste`.
  let restFor = 0.42
  let pasteAfter = 0.55
  /// How near the handle the Pencil comes down to take it, in the screen's points.
  let gripReach: CGFloat = 22

  /// `view` made one of a class of its own, a child of the one it had, whose `inputAccessoryView` is nothing. Once
  /// for each view: one that is of such a class already is left alone.
  private static let bareSuffix = "_ilmiNoAccessory"
  static func noAccessory(_ view: UIView) {
    guard let was: AnyClass = object_getClass(view) else { return }
    let name = NSStringFromClass(was)
    if name.hasSuffix(bareSuffix) { return }
    let bareName = name + bareSuffix
    var bare: AnyClass? = NSClassFromString(bareName)
    if bare == nil, let made = objc_allocateClassPair(was, bareName, 0) {
      let none: @convention(block) (AnyObject) -> UIView? = { _ in nil }
      class_addMethod(made, #selector(getter: UIResponder.inputAccessoryView), imp_implementationWithBlock(none), "@@:")
      // an iPad's keyboard carries the same two (previous field, next field) at the right of its own top row: that
      // row is left with what the system puts there (undo, redo, paste) and nothing of a form's
      let items = #selector(getter: UIResponder.inputAssistantItem)
      if let theirs = class_getInstanceMethod(was, items) {
        typealias Items = @convention(c) (AnyObject, Selector) -> UITextInputAssistantItem
        let ask = unsafeBitCast(method_getImplementation(theirs), to: Items.self)
        let plain: @convention(block) (AnyObject) -> UITextInputAssistantItem = { me in
          let item = ask(me, items)
          item.trailingBarButtonGroups = []
          return item
        }
        class_addMethod(made, items, imp_implementationWithBlock(plain), method_getTypeEncoding(theirs))
      }
      objc_registerClassPair(made)
      bare = made
    }
    if let bare { object_setClass(view, bare) }
  }

  override func load(webview: WKWebView) {
    web = webview
    // the disk caches of pages kept within the room the device has (`DiskBudget`)
    DiskBudget.start()
    // the page fills the window. The web view does, but it lays the page out short by the status bar and the home
    // bar (its scroll view keeps clear of them), and what is left along the foot is nothing, black; the page keeps
    // clear of both by itself (`env(safe-area-inset-*)`), so the scroll view is told to keep clear of neither
    webview.scrollView.contentInsetAdjustmentBehavior = .never
    let fill = { [weak webview] in
      guard let w = webview, let over = w.superview else { return }
      if w.frame != over.bounds { w.frame = over.bounds }
      w.autoresizingMask = [.flexibleWidth, .flexibleHeight]
      if w.scrollView.contentInsetAdjustmentBehavior != .never { w.scrollView.contentInsetAdjustmentBehavior = .never }
      w.setNeedsLayout()
    }
    DispatchQueue.main.async(execute: fill)
    NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { _ in fill() }
    // no bar over the keyboard. The web view puts its own there for any field of a page (previous, next, done), as
    // a browser must for a form it has never seen; over the app's own fields it is in the way (it lay over a new
    // card's `cancel` and `save`, which sit on the keyboard), and no app of the system's has one. The view that
    // takes the keys is the web view's content view: it is made one of a class of its own that has no such bar. Done
    // again whenever the keyboard is about to come up and when the app comes back, should that view have been made anew
    let bare = { [weak webview] in
      guard let w = webview else { return }
      InkPlugin.noAccessory(w)
      for v in w.scrollView.subviews where NSStringFromClass(type(of: v)).hasPrefix("WKContent") || NSStringFromClass(type(of: v)).contains("_WKContent") { InkPlugin.noAccessory(v) }
    }
    DispatchQueue.main.async(execute: bare)
    NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { _ in bare() }
    NotificationCenter.default.addObserver(forName: UIResponder.keyboardWillShowNotification, object: nil, queue: .main) { _ in bare() }
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
    "heavy": UIImpactFeedbackGenerator(style: .heavy),
    "rigid": UIImpactFeedbackGenerator(style: .rigid),
  ]
  private lazy var notes = UINotificationFeedbackGenerator()
  private lazy var ticks = UISelectionFeedbackGenerator()

  @objc public func haptic(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(HapticArgs.self)
    DispatchQueue.main.async {
      if self.canHaptic {
        if let impact = self.impacts[args.kind] {
          impact.impactOccurred(intensity: 1)
          impact.prepare()
        } else if args.kind == "warning" || args.kind == "success" || args.kind == "error" {
          self.notes.notificationOccurred(args.kind == "warning" ? .warning : args.kind == "error" ? .error : .success)
          self.notes.prepare()
        } else if args.kind == "tick" {
          // the selection's own tick is hardly felt through a case: a light impact, in full, is
          if let tap = self.impacts["light"] {
            tap.impactOccurred(intensity: 1)
            tap.prepare()
          }
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
    if g.state != .changed { noteTouch("pinch \(g.state.rawValue) scale \(String(format: "%.3f", Double(scale))) touches \(g.numberOfTouches) zooming \(zooming?.id.suffix(10) ?? "none")") }
    switch g.state {
    case .began:
      zooming = nil
      let q = g.location(in: layer)
      // the pages are about to move: what was just written is the page's to carry, not the canvas's
      for h in hosts.values {
        hurry(h)
        h.holdUntil = pending(h) ? ProcessInfo.processInfo.systemUptime + 0.12 : 0
      }
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
          noteTouch("pinch takes \(h.id.suffix(16))")
          emit(["kind": "pinch", "phase": "begin", "native": true, "host": h.id, "k": 1, "x": p.x, "y": p.y])
          // (a pinch the system was slow to know for one begins with the fingers already apart, and may say no more
          // before they lift: where they are when it begins is the first change. Without it such a pinch, which a
          // main thread held up a moment gives, ended at the zoom it began at: nothing)
          if abs(scale - 1) > 0.002, var z = h.live {
            z.k = rubber(z.z0 * scale, z.lo, z.hi) / z.z0
            // (the place between the fingers when they came down is not known: the pages grow about where it is now)
            z.t = CGPoint(x: (1 - z.k) * z.from.x, y: (1 - z.k) * z.from.y)
            h.live = z
            if !held(h) { stretch(h) }
            emit(["kind": "pinch", "phase": "change", "native": true, "host": h.id, "k": z.k, "x": p.x, "y": p.y])
          }
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
      // (a stroke lifted this moment is still PencilKit's: the pages wait for the frame it becomes the page's, a
      // tenth of a second at the most, and then go to where the fingers have them)
      if !held(h) { stretch(h) }
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
        // (not the scroller's whole content, which begins above the column and to its left with the desk the pages
        // lie on, 22 points of it on a device, and on a Mac with the bar: only a page's shadow is allowed above the
        // column and beside it)
        if f.insetBy(dx: -1.5, dy: -1.5).contains(want), f.minY >= want.minY - 12, f.minX >= want.minX - 16, f.maxY <= want.maxY + 600, f.width <= want.width + 600 {
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
    if let t = target {
      let g = t.canvas.drawingGestureRecognizer
      noteTouch("arm \(Int(p.x)),\(Int(p.y)) on \(t.id.suffix(14)) rec \(g.view === web ? "web" : g.view == nil ? "none" : "canvas") \(g.isEnabled ? "on" : "off") state \(g.state.rawValue) hidden \(t.canvas.isHidden) vector \(t.vector) penOff \(penOff)")
    } else {
      noteTouch("arm \(Int(p.x)),\(Int(p.y)) on nothing over \(over) penOff \(penOff)")
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
    noteTouch("watch began type \(t.type.rawValue) armed \(armed?.id.suffix(14) ?? "none")")
    guard isPen(t), let s = armed, let h = armedHost, layer != nil else { return }
    let now = ProcessInfo.processInfo.systemUptime
    down = true
    active = s
    spent = false
    own = nil
    s.quiet?.cancel()
    // (a sheet the page draws: its canvas is there for a stroke, not for the eraser or the lasso)
    if !s.vector || !ours { s.canvas.isHidden = false }
    if s.vector {
      if ours {
        // the eraser and the lasso work on what the page draws: what PencilKit still shows is the page's to show now
        settle(s)
      } else if !s.glass.isEmpty, !s.hidden {
        // written on again before the canvas could be emptied: the page holds what PencilKit shows unseen again
        s.hidden = true
        s.revealed = 0
        tell(s)
      }
    }
    if s.vector, tool.kind == "eraser" { beginGlass(s) }
    carried = nil
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
      own = .erase(before: s.drawing, last: p)
      erase(s, from: p, to: p)
      ringEraser(at: q, in: h)
    } else if tool.kind == "select" {
      let z = max(s.zoom, 0.01)
      if let k = picked, k.sheet === s, let box = held(k), hypot(p.x - box.maxX, p.y - box.maxY) <= gripReach / z {
        own = .resize(before: s.drawing, base: s.drawing.strokes, at: k.at, origin: box.origin, from: p, moved: false)
        emit(["kind": "unpicked", "moving": true])
      } else if let k = picked, k.sheet === s, let box = held(k), box.insetBy(dx: -8 / z, dy: -8 / z).contains(p) {
        own = .drag(before: s.drawing, base: s.drawing.strokes, at: k.at, from: p, moved: false)
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
      // a pen's or a highlighter's stroke: drawn here as it is written
      // (and made when a dev run has PencilKit draw it, drawing nothing)
      if LiveInk.ours {
        s.live.asPage = s.vector
        s.live.scaled = s.vector
        s.live.begin(ink, width: CGFloat(tool.width), sense: tool.sense.map { CGFloat($0) })
      }
    }
    emit(["kind": "begin", "sheet": s.id, "host": h.id, "fresh": false, "x": q.x, "y": q.y, "top": s.canvas.frame.minY])
  }

  func penSample(_ t: UITouch, _ event: UIEvent?, ended: Bool) {
    guard LiveInk.ours, let s = active, s.live.writing else { return }
    s.live.add(t, event, ended: ended)
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
        if s.vector {
          carry(s, base, at, by)
        } else {
          var strokes = base
          for i in at where i < strokes.count { strokes[i].transform = base[i].transform.concatenating(by) }
          let d = PKDrawing(strokes: strokes)
          picked?.drawing = d
          put(s, d)
          picked?.drawing = s.drawing
        }
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
        if s.vector {
          carry(s, base, at, by)
        } else {
          var strokes = base
          for i in at where i < strokes.count { strokes[i].transform = base[i].transform.concatenating(by) }
          let d = PKDrawing(strokes: strokes)
          picked?.drawing = d
          put(s, d)
          picked?.drawing = s.drawing
        }
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
    s.liftedAt = ProcessInfo.processInfo.systemUptime
    s.trace = []
    s.mark("up")
    if own == nil, !ours { s.awaiting = s.liftedAt + 0.5 }
    if standInOnce {
      // (a dev run's: the stand-in wrote its one stroke; the fingers that follow are fingers, to PencilKit too)
      standInOnce = false
      standIn = false
      // (in this turn: fingers that land a hundredth of a second on must find no canvas that takes a finger)
      webSeesPen(true)
      setTouchTypes()
      for f in surfaces.values { f.setTouchTypes() }
    }
    // a pen's or a highlighter's stroke ended resting: looked at when PencilKit hands the stroke over
    if own == nil, !ours { lastShape = nil }
    if own == nil, !ours, tool.snap == true, rested >= restFor {
      snap = (s, s.drawing.strokes.count, ProcessInfo.processInfo.systemUptime + 1.5)
    }
    finishOwn(s)
    if let spec = s.waiting, let h = s.host {
      s.waiting = nil
      apply(spec, in: h)
    }
    emit(["kind": "end", "sheet": s.id])
    wait(s)
    settleSoon(s)
  }

  /// The Pencil lifted, or the tool changed under it: what the eraser took or the lasso moved is one step to undo, and a loop picks.
  private func finishOwn(_ s: Sheet) {
    guard let o = own else { return }
    own = nil
    hide(loop)
    hide(reach)
    switch o {
    case let .erase(before, _):
      let after = s.drawing
      if after != before { step(s, from: before, to: after) }
      liftGlass(s)
    case let .resize(before, base, at, _, _, moved):
      land(s, base, at, moved)
      let after = s.drawing
      if moved, after != before { step(s, from: before, to: after) }
      picked?.drawing = after
      ring()
      tellPicked()
    case let .loop(points, _):
      if !spent { pick(s, within: points) }
    case let .drag(before, base, at, _, moved):
      land(s, base, at, moved)
      let after = s.drawing
      if moved, after != before { step(s, from: before, to: after) }
      picked?.drawing = after
      ring()
      tellPicked()
    }
  }

  // ── the eraser and the lasso ──

  /// A sheet's drawing set from here, and told as PencilKit's own change is.
  private func put(_ s: Sheet, _ d: PKDrawing) {
    s.drawing = d
    if let g = s.eraseGlass { g.sync(s.model.strokes, names: names(of: s.model)) }
    if s.vector {
      // (what the sheet holds changed otherwise than by a stroke written: the page shows it as it is, and what
      // PencilKit still shows of it goes once the page has)
      s.hidden = false
      tell(s)
      s.revealed = s.said
      settleSoon(s)
    }
    if s.drawing != s.given {
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
    let t0 = ProcessInfo.processInfo.systemUptime
    defer { eraseNote(hit: (ProcessInfo.processInfo.systemUptime - t0) * 1000) }
    let r = CGFloat(max(tool.width, 1)) / max(s.zoom, 0.01)
    let reach = CGRect(x: min(a.x, b.x), y: min(a.y, b.y), width: abs(a.x - b.x), height: abs(a.y - b.y)).insetBy(dx: -r, dy: -r)
    var left: [PKStroke] = []
    var gone = false
    let part = tool.mode == "part"
    for k in s.drawing.strokes {
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
    if gone {
      let t1 = ProcessInfo.processInfo.systemUptime
      put(s, PKDrawing(strokes: left))
      erasePut.append((ProcessInfo.processInfo.systemUptime - t1) * 1000)
      if erasedAt == 0 { erasedAt = t1; erasedSaid = s.said; erasedSheet = s.id }
    }
  }

  // a dev run's: what an eraser's move costs, and how long until what it took is off the glass (ms)
  private(set) var eraseHit: [Double] = []
  var erasePut: [Double] = []
  var erasePatch: [Double] = []
  var erasePatchPx: [Int] = []
  var eraseSkipped = 0
  private(set) var eraseShown: [Double] = []
  private var erasedAt: TimeInterval = 0
  private var erasedSaid = 0
  private var erasedSheet = ""
  func eraseNote(hit: Double) { eraseHit.append(hit) }

  /// A dev run's: what PencilKit's own drawing makes of a thin pen stroke, as stored points and as points four times
  /// as wide under a quarter's transform, as pictures at 8 px to the point (`pkthin-<width>-<scale>.png` in the app's
  /// temporary folder); and each ink's widths as PencilKit's tool takes them (`pkthin.txt`).
  private func pkThin() {
    let dir = FileManager.default.temporaryDirectory
    var text = ""
    for w in [0.3, 0.6, 1.0, 2.2] {
      for scale in [1.0, 4.0] {
        let size = (w * scale + 4) / 2
        let pts = (0...20).map { i in PKStrokePoint(location: CGPoint(x: (5 + Double(i) * 2.5) * scale, y: 10 * scale), timeOffset: Double(i) * 0.01, size: CGSize(width: size, height: size), opacity: 1, force: 1, azimuth: .pi / 2, altitude: .pi / 2) }
        let k = PKStroke(ink: PKInk(.pen, color: .black), path: PKStrokePath(controlPoints: pts, creationDate: Date()), transform: CGAffineTransform(scaleX: 1 / scale, y: 1 / scale), mask: nil)
        var img: UIImage?
        UITraitCollection(userInterfaceStyle: .light).performAsCurrent { img = PKDrawing(strokes: [k]).image(from: CGRect(x: 0, y: 0, width: 60, height: 20), scale: 8) }
        if let d = img?.pngData() { try? d.write(to: dir.appendingPathComponent("pkthin-\(w)-\(Int(scale)).png")) }
      }
    }
    var types: [(String, PKInkingTool.InkType)] = [("pen", .pen), ("marker", .marker), ("pencil", .pencil)]
    if #available(iOS 17.0, *) { types += [("monoline", .monoline), ("fountain", .fountainPen), ("watercolor", .watercolor), ("crayon", .crayon)] }
    for (n, t) in types {
      let r = t.validWidthRange
      let made = PKInkingTool(t, color: .black, width: 0.3)
      text += "\(n): widths \(r.lowerBound) to \(r.upperBound); a tool asked 0.3 is \(made.width)\n"
    }
    try? text.write(to: dir.appendingPathComponent("pkthin.txt"), atomically: true, encoding: .utf8)
  }

  /// The eraser down on a sheet the page draws: its strokes on the glass, the page holding them unseen.
  private func beginGlass(_ s: Sheet) {
    if let g = s.eraseGlass {
      // (down again before the page had shown its own: the glass is still up, and stays)
      g.ending = false
    } else {
      let g = EraseGlass(canvas: s.canvas, blend: s.blend)
      g.sync(s.model.strokes, names: names(of: s.model))
      s.eraseGlass = g
    }
    s.canvas.isHidden = false
    tell(s)
  }

  /// The eraser lifted: the page shows its own again; the glass goes when it has drawn it (or in a second at most).
  private func liftGlass(_ s: Sheet) {
    guard let g = s.eraseGlass, !g.ending else { return }
    g.ending = true
    s.tellLater = false
    tell(s)
    g.until = s.said
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self, weak s, weak g] in
      guard let self = self, let s = s, let g = g, g.ending, s.eraseGlass === g else { return }
      self.endGlass(s)
    }
  }

  private func endGlass(_ s: Sheet) {
    s.eraseGlass?.remove()
    s.eraseGlass = nil
    if s.canvas.drawing.strokes.isEmpty, s.glass.isEmpty, !(down && active === s) { s.canvas.isHidden = true }
    settle(s)
  }
  func eraseReset() { eraseHit = []; erasePut = []; erasePatch = []; erasePatchPx = []; eraseSkipped = 0; eraseShown = []; erasedAt = 0 }

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
    let d = s.drawing
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
    picked = Picked(sheet: s, at: at, drawing: s.drawing)
    ring()
    tellPicked()
  }

  /// Something done with what the lasso holds, one step to undo. False when it holds nothing.
  private func selection(_ op: String, color c: UIColor?) -> Bool {
    guard !down, let k = picked else { return false }
    let s = k.sheet
    let before = s.drawing
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
      step(s, from: before, to: s.drawing)
    case "duplicate":
      let by = CGAffineTransform(translationX: 16, y: 16)
      let n = strokes.count
      for i in at { strokes.append(renamed(strokes[i], transform: strokes[i].transform.concatenating(by))) }
      unpick()
      put(s, PKDrawing(strokes: strokes))
      step(s, from: before, to: s.drawing)
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
      step(s, from: before, to: s.drawing)
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
    let before = s.drawing
    var strokes = before.strokes
    let n = strokes.count
    for k in clip { strokes.append(renamed(k, transform: k.transform.concatenating(by))) }
    unpick()
    put(s, PKDrawing(strokes: strokes))
    step(s, from: before, to: s.drawing)
    if !s.vector { s.canvas.isHidden = false }
    repick(s, Array(n..<strokes.count))
    wait(s)
    return true
  }

  /// What the lasso holds covers this, in the drawing's points.
  private func held(_ k: Picked) -> CGRect? {
    let strokes = k.sheet.drawing.strokes
    var box: CGRect? = nil
    for i in k.at where i < strokes.count { box = box.map { $0.union(strokes[i].renderBounds) } ?? strokes[i].renderBounds }
    // (carried by the lasso on a sheet the page draws: where the page shows it meanwhile)
    if let by = carried, k.sheet.vector { box = box?.applying(by) }
    return box
  }

  // ── a sheet the page draws itself (89) ──

  /// What a call into `native/ink.m` gave, read as JSON.
  private func json(_ call: (UnsafeMutablePointer<UnsafeMutablePointer<UInt8>?>, UnsafeMutablePointer<Int>) -> Int32) -> Any? {
    var bytes: UnsafeMutablePointer<UInt8>? = nil
    var len = 0
    guard call(&bytes, &len) == 0, let b = bytes else { return nil }
    defer { c_ink_free(b) }
    return try? JSONSerialization.jsonObject(with: Data(bytes: b, count: len))
  }

  /// Every stroke's name of a drawing, in order: the name the page knows it by. A stroke given from the store has
  /// the store's name (`fill` says them: named here again, a stroke read back from the store came out under another
  /// name than the store's, on a simulated iPad). One written here is named as the store will name it when it is
  /// kept (`native/ink.m`, `nameOf`, asked of the drawing whole as `split` asks). Either way a stroke keeps the name
  /// it first had here, as long as it is the same stroke (`StrokeMark`).
  private func names(of d: PKDrawing) -> [String] {
    let strokes = d.strokes
    let marks = strokes.map { StrokeMark($0) }
    let known = marks.compactMap { named[$0] }
    if known.count == marks.count { return known }
    let ref = d as PKDrawingReference
    let got = withExtendedLifetime(ref) { json { c_drawing_names(UnsafeRawPointer(Unmanaged.passUnretained(ref).toOpaque()), $0, $1) } } as? [String] ?? []
    guard got.count == marks.count else { return marks.map { named[$0] ?? "" } }
    if named.count > 60_000 { named.removeAll() }
    for (m, n) in zip(marks, got) where named[m] == nil { named[m] = n }
    return marks.map { named[$0] ?? "" }
  }

  /// The strokes of a drawing at `at`, as the page draws them: each its name and its outline (`ilmi_stroke_shape`).
  private func outlines(of d: PKDrawing, at: [Int]) -> [Any] {
    if at.isEmpty { return [] }
    let ref = d as PKDrawingReference
    let indices = at.map { UInt32($0) }
    return withExtendedLifetime(ref) { json { c_drawing_describe(UnsafeRawPointer(Unmanaged.passUnretained(ref).toOpaque()), indices, indices.count, $0, $1) } } as? [Any] ?? []
  }

  /// The page is told what a sheet holds now: every stroke's name, in order, and the outline of each it has not been told of.
  private func tell(_ s: Sheet) {
    guard s.vector else { return }
    let erasing = s.eraseGlass.map { !$0.ending } ?? false
    if erasing, s.said > s.seen {
      // (the page has yet to draw the last telling: this one waits for it, and says what is then so; the glass shows it now)
      if !s.tellLater {
        s.tellLater = true
        // (and if the page says nothing of the last, it is told a quarter of a second on all the same)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { [weak self, weak s] in
          guard let self = self, let s = s, s.tellLater else { return }
          s.tellLater = false
          self.tell(s)
        }
      }
      return
    }
    s.tellLater = false
    s.said += 1
    let all = names(of: s.model)
    var fresh: [Int] = []
    for (i, n) in all.enumerated() where !s.told.contains(n) {
      s.told.insert(n)
      fresh.append(i)
    }
    s.mark("told \(s.said)\(s.hidden && !s.glass.isEmpty ? " unseen" : "")")
    var said: [String: Any] = ["kind": "ink", "sheet": s.id, "seq": s.said, "names": all, "add": outlines(of: s.model, at: fresh), "hide": erasing ? all : s.hidden ? s.glass : []]
    if !s.hidden, !s.glass.isEmpty {
      // (the canvas still shows some of it: the page says with its own commit when this telling is on the glass)
      stamp += 1
      s.stamp = stamp
      said["stamp"] = stamp
      bindSignal()
    }
    emit(said)
  }

  /// The outlines of those of a sheet's strokes the page asks for by name: one it was not told, or no longer has.
  @objc public func outlines(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(OutlineArgs.self)
    DispatchQueue.main.async {
      guard let s = self.sheets[args.sheet], s.vector else {
        invoke.resolve(["shapes": [Any]()])
        return
      }
      let want = Set(args.names)
      let at = self.names(of: s.model).enumerated().filter { want.contains($0.element) }.map { $0.offset }
      invoke.resolve(["shapes": self.outlines(of: s.model, at: at)])
    }
  }

  /// PencilKit added strokes to a canvas that is its sheet (a typed note's area), those from `n` on: each is made
  /// what the pen's `pressure` and thinness have it (`sensed`), as on a notebook's surface and a PDF's page, and is
  /// a step of the plugin's own to undo (the canvas's own undo is its `scratch`: a stroke changed after PencilKit
  /// took it is not the stroke PencilKit would take back).
  fileprivate func took(_ s: Sheet, from n: Int) {
    let all = s.canvas.drawing.strokes
    guard n <= all.count else { s.counted = all.count; return }
    let kept = Array(all[..<n])
    let fresh = Array(all[n...])
    let made = fresh.map { keep($0, on: s) }
    let before = PKDrawing(strokes: kept)
    if zip(fresh, made).contains(where: { StrokeMark($0) != StrokeMark($1) }) {
      s.drawing = PKDrawing(strokes: kept + made)
    } else {
      s.counted = all.count
    }
    s.dirty = true
    step(s, from: before, to: s.drawing)
    // (the area's canvas draws its strokes itself: what was drawn here of the one just ended goes as it does)
    if LiveInk.ours { s.live.clearGlass() }
    changed(s)
  }

  /// PencilKit handed strokes over on a sheet the page draws: they join what it holds, a step to undo, and the page
  /// is told of them, to hold them unseen while the canvas shows them.
  fileprivate func wrote(_ s: Sheet, _ fresh: [PKStroke]) {
    let before = s.model
    let made = fresh.map { keep($0, on: s) }
    s.model = PKDrawing(strokes: before.strokes + made)
    s.glass += names(of: s.model).suffix(made.count)
    // (the pages already moving: the page shows it from the first, and the canvas goes as soon as it has)
    let rushed = ProcessInfo.processInfo.systemUptime < s.rush
    s.hidden = !rushed
    s.revealed = 0
    s.awaiting = 0
    s.mark("handed over \(made.count)")
    tell(s)
    if rushed { s.revealed = s.said; s.revealedAt = ProcessInfo.processInfo.systemUptime }
    step(s, from: before, to: s.model)
    s.dirty = true
    changed(s)
    settleSoon(s)
  }

  /// The stroke PencilKit handed over on a sheet, as it is kept: the one drawn for it while it was written (`Live.swift`),
  /// or where there is none (`LiveInk.ours` off), PencilKit's own as the pen has it (`sensed`).
  func keep(_ theirs: PKStroke, live: LiveInk) -> PKStroke {
    if LiveInk.pencilKit, LiveInk.ours {
      // PencilKit drew it and it stays its own: kept exactly as it drew it (its widths, its pressure, its smoothing),
      // under a transform of one over the space its canvas draws in, and marked to be drawn as PencilKit draws it
      _ = live.take(theirs)
      var k = theirs
      let by = 1 / live.drawnAt
      k.transform = theirs.transform.concatenating(CGAffineTransform(scaleX: by, y: by))
      // (a pen's, the even line's and a highlighter's: a fountain pen's and a pencil's are PencilKit's picture already,
      // and a pencil's seed is its grain)
      let outlined = k.ink.inkType == .pen || k.ink.inkType == .marker || { if #available(iOS 17.0, *) { return k.ink.inkType == .monoline }; return false }()
      if outlined, #available(iOS 16.0, *) { k.randomSeed = ilmi_stroke_seed_mark(k.randomSeed) }
      let pts = Array(k.path)
      let mean = pts.isEmpty ? 0 : Double(pts.reduce(0) { $0 + max(0.05, 2 * $1.size.width - 4) }) / Double(pts.count) * Double(by)
      lastWidths = [mean, mean]
      lastPoints = "pencilkit's own, kept: \(pts.count) points, \(String(format: "%.3f", mean)) pt wide on the sheet"
      if LiveInk.compare { lastCompare = ["pencilkit": measure(k, live), "raw": live.rawStroke.map { measure($0, live) } ?? []] }
      return k
    }
    // (a stroke with a colour was not taken from the Pencil under the ink with none: a dev run's stroke put on the canvas)
    if LiveInk.ours, !LiveInk.on, theirs.ink.color.cgColor.alpha >= 0.001 {
      // (a dev run's PencilKit drawing, `pencilDev` `live-kit`: its stroke kept as before; the one made of the same
      // touches, drawing nothing, goes; how wide PencilKit made it, in the drawing's points, said)
      _ = live.take(theirs)
      let pts = Array(theirs.path)
      let mean = pts.isEmpty ? 0 : Double(pts.reduce(0) { $0 + max(0.05, 2 * $1.size.width - 4) }) / Double(pts.count)
      lastWidths = [mean, mean]
      lastPoints = "pencilkit's own: \(pts.count) points, \(String(format: "%.3f", mean)) pt wide in the drawing, the canvas at \(String(format: "%.3f", live.canvas?.zoomScale ?? 0))"
      let k = sensed(theirs)
      if LiveInk.compare { lastTurns = turns(k, live) }
      return k
    }
    guard LiveInk.on, theirs.ink.color.cgColor.alpha < 0.001 else {
      let k = sensed(theirs)
      if LiveInk.compare { lastTurns = turns(k, live) }
      return k
    }
    guard let ours = live.take(theirs) else {
      // (none drawn for it here, or not where PencilKit's is: PencilKit's own is kept, and a dev run says so)
      liveMissed += 1
      liveMisses = Array((liveMisses + [live.missed]).suffix(12))
      // (its ink is the one PencilKit was given to draw with no colour: kept in the pen's own)
      var k = sensed(theirs)
      k.ink = PKInk(k.ink.inkType, color: k.ink.color.withAlphaComponent(ink.color.cgColor.alpha))
      if LiveInk.compare { lastTurns = turns(k, live) }
      return k
    }
    liveKept += 1
    let round = ours.ink.inkType == .pen || { if #available(iOS 17.0, *) { return ours.ink.inkType == .monoline }; return false }()
    let pts = Array(ours.path)
    let mean = pts.isEmpty ? 0 : Double(pts.reduce(0) { $0 + (round ? max(0.05, 2 * $1.size.width - 4) : $1.size.width) }) / Double(pts.count)
    lastWidths = [live.shownWidth, mean]
    let pick = pts.isEmpty ? [] : [0, pts.count / 4, pts.count / 2, 3 * pts.count / 4, pts.count - 1].map { pts[$0] }
    lastPoints = "\(ours.ink.inkType.rawValue) asked \(String(format: "%.3f", tool.width)) n \(pts.count): " + pick.map { String(format: "%.3f×%.3f f%.3f a%.3f z%.3f o%.3f", $0.size.width, $0.size.height, $0.force, $0.altitude, $0.azimuth, $0.opacity) }.joined(separator: " | ")
    lastLags = live.lags
    lastRounding = live.rounding
    // (a dev run's measure, on the main thread: only when one asks for it)
    if LiveInk.compare { lastTurns = turns(ours, live) }
    // (PencilKit made its own of the same touches, drawn with no colour: measured too)
    if LiveInk.compare { lastCompare = ["pencilkit": measure(sensed(theirs), live), "ilmi": measure(ours, live), "raw": live.rawStroke.map { measure($0, live) } ?? []] }
    return ours
  }
  private func keep(_ theirs: PKStroke, on s: Sheet) -> PKStroke { keep(theirs, live: s.live) }
  private(set) var lastLags: [Double] = []
  private(set) var lastRounding: Double = 0
  private(set) var lastTurns: [Double] = []
  /// A dev run's (`pencilDev` `compare-on`): the last stroke as kept, by who drew it, and as its touches came: the
  /// largest turn and the 99th between two-pixel pieces of its middle, and its edge's wobble (the radius against its
  /// own evening over three pixels: largest and 99th, px), on the glass now.
  private(set) var lastCompare: [String: [Double]] = [:]
  private func measure(_ k: PKStroke, _ live: LiveInk) -> [Double] {
    guard let c = live.canvas, let g = Geom(k, dark: false) else { return [] }
    let px = Double(c.zoomScale * (c.window?.screen.scale ?? UIScreen.main.scale) * LiveInk.drawn(scaled: live.scaled))
    let t = g.turns(at: px)
    let m = g.places()
    var at: [Double] = [], r: [Double] = []
    var i = 0
    var run = 0.0
    while i + 2 < m.count {
      if i > 0 { run += hypot(m[i] - m[i - 3], m[i + 1] - m[i - 2]) * px }
      at.append(run); r.append(m[i + 2] * px)
      i += 3
    }
    var off: [Double] = []
    var lo = 0, hi = 0, sum = 0.0
    for j in 0..<r.count {
      while hi < r.count, at[hi] - at[j] <= 3 { sum += r[hi]; hi += 1 }
      while lo < j, at[j] - at[lo] > 3 { sum -= r[lo]; lo += 1 }
      let n = Double(hi - lo)
      if n > 0 { off.append(abs(r[j] - sum / n)) }
    }
    off.sort()
    let w = off.last ?? 0, w99 = off.isEmpty ? 0 : off[Int(Double(off.count - 1) * 0.99)]
    return (t + [w, w99]).map { ($0 * 100).rounded() / 100 }
  }
  /// A dev run's: how smooth a stroke's outline is as its canvas shows it now (pixels to the point: the canvas's zoom and the screen's).
  private func turns(_ k: PKStroke, _ live: LiveInk) -> [Double] {
    guard let c = live.canvas, let g = Geom(k, dark: false) else { return [] }
    return g.turns(at: Double(c.zoomScale * (c.window?.screen.scale ?? UIScreen.main.scale) * LiveInk.drawn(scaled: live.scaled)))
  }
  /// A dev run's: the strokes kept as drawn while written, and those that were PencilKit's (none drawn for them).
  private(set) var liveKept = 0
  private(set) var liveMissed = 0
  private(set) var liveMisses: [String] = []

  /// One for every place a stroke is written (a notebook's surface, a PDF's page, a typed note's area): the same
  /// stroke under the same pen is the same stroke on each.
  /// A stroke as the pen's `pressure` and its thinness have it. Pressure: each point's width follows the hand's force
  /// against the stroke's mean (and what the ink varies by itself is kept, less or more), none of it at 0; thinness:
  /// a pen set thinner than PencilKit's thinnest is thinned by what is missing.
  func sensed(_ k: PKStroke) -> PKStroke {
    let made = reshaped(k)
    // (for a dev run: what was under the Pencil, and what is kept)
    let mean: (PKStroke) -> Double = { st in
      let pts = Array(st.path)
      let round = st.ink.inkType == .pen || { if #available(iOS 17.0, *) { return st.ink.inkType == .monoline }; return false }()
      return pts.isEmpty ? 0 : Double(pts.reduce(0) { $0 + (round ? max(0.05, 2 * $1.size.width - 4) : $1.size.width) }) / Double(pts.count)
    }
    lastWidths = [mean(k), mean(made)]
    let pts = Array(k.path)
    let pick = pts.isEmpty ? [] : [0, pts.count / 4, pts.count / 2, 3 * pts.count / 4, pts.count - 1].map { pts[$0] }
    lastPoints = "\(k.ink.inkType.rawValue) tool \(String(format: "%.3f", ink.width)) n \(pts.count): " + pick.map { String(format: "%.3f×%.3f f%.3f a%.3f z%.3f o%.3f", $0.size.width, $0.size.height, $0.force, $0.altitude, $0.azimuth, $0.opacity) }.joined(separator: " | ")
    return made
  }
  private(set) var lastWidths: [Double] = []
  private(set) var lastPoints: String = ""

  private func reshaped(_ k: PKStroke) -> PKStroke {
    guard tool.kind == "pen" else { return k }
    let type = k.ink.inkType
    var fountain = false, even = false
    if #available(iOS 17.0, *) { fountain = type == .fountainPen; even = type == .monoline }
    let follows = type == .pen || fountain
    let q = thin
    let points = Array(k.path)
    guard follows || q < 0.999, points.count > 1 else { return k }
    let g = CGFloat(min(max(tool.sense ?? 1, 0), 2))
    let n = CGFloat(points.count)
    // a round nib's width is twice the point's size less four (`stroke.m`): the line is changed by its width, not its size
    let round = type == .pen || even
    let wide: (PKStrokePoint) -> CGFloat = { round ? max(0.05, 2 * $0.size.width - 4) : $0.size.width }
    let mw = points.reduce(0) { $0 + wide($1) } / n
    let mh = points.reduce(0) { $0 + $1.size.height } / n
    let mf = points.reduce(0) { $0 + $1.force } / n
    let made = points.enumerated().map { (i, p) -> PKStrokePoint in
      var w = wide(p), h = p.size.height
      if follows {
        // (the force evened over its neighbours: no lump where one reading jumps)
        let a = points[max(i - 1, 0)].force, b = points[min(i + 1, points.count - 1)].force
        let r = mf > 0.001 ? (a + 2 * p.force + b) / 4 / mf : 1
        let by = min(max(1 + g * 0.85 * (r - 1), 0.3), 2.4)
        w = max(mw * 0.2, (mw + (w - mw) * g) * by)
        if !round { h = max(mh * 0.2, (mh + (h - mh) * g) * by) }
      }
      w *= q
      if !round { h *= q }
      return PKStrokePoint(location: p.location, timeOffset: p.timeOffset, size: CGSize(width: round ? (w + 4) / 2 : w, height: h), opacity: p.opacity, force: p.force, azimuth: p.azimuth, altitude: p.altitude)
    }
    return PKStroke(ink: k.ink, path: PKStrokePath(controlPoints: made, creationDate: k.path.creationDate), transform: k.transform, mask: k.mask)
  }

  /// How long the Pencil has been off a sheet before what it wrote is the page's to show.
  private let pause = 0.25

  /// What PencilKit's canvas still shows of a sheet the page draws is handed to the page, when it can be. While the
  /// Pencil writes, and until a stroke it just ended has been handed over, nothing (a canvas emptied under the Pencil
  /// loses the stroke being written). Once the writing has paused the page is told to show what it holds; when it
  /// says it has (`shown`), the canvas is emptied and hidden. Never a frame with neither.
  private func settle(_ s: Sheet, force: Bool = false) {
    guard s.vector, !s.clearing, s.eraseGlass == nil else { return }
    let now = ProcessInfo.processInfo.systemUptime
    let writing = down && active === s && own == nil && !ours
    let on = s.canvas.drawing.strokes.count
    if on == 0, s.glass.isEmpty {
      if !writing, !s.canvas.isHidden, now - s.liftedAt >= pause { s.canvas.isHidden = true }
      if !writing { s.taken = 0 }
      return
    }
    if writing || now < s.awaiting || s.taken < on { return }
    if s.hidden {
      if keepOnCanvas, !(down && active === s) { return }
      // (under the eraser or the lasso at once: they work on what the page draws)
      // (a highlighter's stroke at once: PencilKit lays a highlighter's stroke it has taken over on more heavily than
      // while it was written, and than the page does; a pause of that is seen, and a highlighter is not written with)
      let marks = tool.kind == "highlighter" && s.canvas.drawing.strokes.allSatisfy { $0.ink.inkType == .marker }
      guard marks || now - s.liftedAt >= pause || now < s.rush || (down && active === s) else { return }
      s.hidden = false
      tell(s)
      s.revealed = s.said
      s.revealedAt = now
      return
    }
    guard s.seen >= s.revealed || force else { return }
    s.mark(force ? "emptied at a layout" : "emptied")
    s.clearing = true
    s.canvas.drawing = PKDrawing()
    s.clearing = false
    s.taken = 0
    s.glass = []
    s.canvas.isHidden = true
    s.scratch.removeAllActions()
    if s.rushedAt > 0, s.rushedFor == nil { s.rushedFor = (now - s.rushedAt) * 1000 }
    // (the pages waited for this under two fingers: they go to where the fingers have them, in this turn)
    if let h = s.host, h.holdUntil != 0, h.live?.phase == .fingers, !held(h) { stretch(h) }
  }

  /// The pages a host holds are about to move (two fingers on them, its scroller scrolling, a layout at another
  /// zoom): whatever PencilKit's canvas still shows of them is handed to the page now, not when the writing has
  /// paused. The page carries its own ink through anything; a canvas over it is kept in step from here, and while
  /// the pages move the two can part. So the pause is for writing on, never for the pages moving.
  private func hurry(_ h: Host) {
    for spec in h.spec.sheets { if let s = sheets[spec.id] { hurry(s) } }
  }

  /// Something of a host's is still on PencilKit's canvas, or on its way there from the Pencil.
  private func pending(_ h: Host) -> Bool {
    let now = ProcessInfo.processInfo.systemUptime
    return h.spec.sheets.contains { spec in
      guard let s = sheets[spec.id], s.vector else { return false }
      return !s.glass.isEmpty || !s.canvas.drawing.strokes.isEmpty || now < s.awaiting
    }
  }

  /// Two fingers have the pages, and a stroke just written is still the canvas's: stretched with the pages now, a
  /// canvas PencilKit is drawing anew at another size can show its stroke cut at a tile's edge for a few frames
  /// (seen once in a simulator's recording: the right end of a stroke gone for three frames). So the stretch waits
  /// for the page's commit that takes the stroke over, which is some hundredths of a second away, and for no
  /// longer than a tenth: after that the canvas is carried as it was.
  private func held(_ h: Host) -> Bool {
    if h.holdUntil == 0 { return false }
    if ProcessInfo.processInfo.systemUptime >= h.holdUntil || !pending(h) { h.holdUntil = 0; return false }
    return true
  }

  private func hurry(_ s: Sheet) {
    guard s.vector else { return }
    let now = ProcessInfo.processInfo.systemUptime
    // (nothing on the canvas and nothing on its way from PencilKit: nothing to hand over)
    if s.glass.isEmpty, s.canvas.drawing.strokes.isEmpty, now >= s.awaiting { return }
    if now >= s.rush {
      s.rushedAt = now
      s.rushedAfter = (now - s.liftedAt) * 1000
      s.rushedFor = nil
      s.mark("the pages move")
    }
    s.rush = now + 0.75
    settle(s)
  }

  private func settleSoon(_ s: Sheet) {
    guard s.vector else { return }
    settle(s)
    for after in [pause + 0.02, 0.56] {
      DispatchQueue.main.asyncAfter(deadline: .now() + after) { [weak self, weak s] in
        if let self = self, let s = s, self.sheets[s.id] === s { self.settle(s) }
      }
    }
  }

  /// What the lasso holds on a sheet the page draws, carried or resized under the Pencil: the page moves what it
  /// has drawn of them (a word, not their outlines again), and they are strokes anew where they are put down (`land`).
  private func carry(_ s: Sheet, _ base: [PKStroke], _ at: [Int], _ by: CGAffineTransform) {
    carried = by
    let moved: [String: Any] = ["names": at.filter { $0 < base.count }.compactMap { named[StrokeMark(base[$0])] }, "m": [Double(by.a), Double(by.b), Double(by.c), Double(by.d), Double(by.tx), Double(by.ty)]]
    emit(["kind": "ink", "sheet": s.id, "carry": moved])
  }

  private func land(_ s: Sheet, _ base: [PKStroke], _ at: [Int], _ moved: Bool) {
    defer { carried = nil }
    guard s.vector, moved, let by = carried else { return }
    var strokes = base
    for i in at where i < strokes.count { strokes[i].transform = base[i].transform.concatenating(by) }
    let d = PKDrawing(strokes: strokes)
    carried = nil
    picked?.drawing = d
    put(s, d)
    picked?.drawing = s.drawing
  }

  /// The page has drawn what a sheet said it holds, up to a telling.
  @objc public func shown(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(ShownArgs.self)
    DispatchQueue.main.async {
      if let s = self.sheets[args.sheet] {
        s.seen = max(s.seen, args.seq)
        s.mark("drawn \(args.seq)")
        if let g = s.eraseGlass, g.ending, args.seq >= g.until {
          // (the page shows its own again: the eraser's glass goes)
          self.endGlass(s)
        }
        if s.tellLater, s.eraseGlass != nil { s.tellLater = false; self.tell(s) }
        if self.erasedAt > 0, s.id == self.erasedSheet, args.seq >= self.erasedSaid {
          // (the page has drawn what an eraser left: its stroke is off the glass about now)
          self.eraseShown.append((ProcessInfo.processInfo.systemUptime - self.erasedAt) * 1000)
          self.erasedAt = 0
        }
        self.bindSignal()
        self.settle(s)
      }
      invoke.resolve()
    }
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
    noteTouch("pencilkit began on \(s.id.suffix(14))")
    // PencilKit may hear of the touch before the watcher does
    inkedAt = ProcessInfo.processInfo.systemUptime
    guard down, var t = touched, t.ink == nil else { return }
    t.ink = (inkedAt - touchedAt) * 1000
    touched = t
  }

  /// The stroke PencilKit just handed over, drawn again as the shape it most nearly is; as written when it is none.
  /// One more step to undo: taken back, the stroke is as it was drawn.
  private func shape(_ s: Sheet) {
    let before = s.drawing
    guard let k = before.strokes.last else { return }
    let marker = k.ink.inkType == .marker
    guard let found = Shapes.find(Shapes.points(of: k), closed: !marker) else { return }
    lastShape = found.name
    var strokes = Array(before.strokes.dropLast())
    strokes.append(contentsOf: Shapes.strokes(found, from: k))
    put(s, PKDrawing(strokes: strokes))
    step(s, from: before, to: s.drawing)
    emit(["kind": "shape", "sheet": s.id, "shape": found.name])
  }

  fileprivate func changed(_ s: Sheet) {
    if let k = picked, k.sheet === s, s.drawing != k.drawing { unpick() }
    if let w = snap, w.sheet === s {
      snap = nil
      lastShape = nil
      if ProcessInfo.processInfo.systemUptime < w.until, s.drawing.strokes.count == w.count + 1 { shape(s) }
    }
    historySoon()
    // an undo's change is kept at once
    if !(down && active === s), ProcessInfo.processInfo.systemUptime < hurry {
      keepSoon()
      return
    }
    // the stroke is the canvas's now: where it starts against where the Pencil came down
    if !ours, own == nil, var t = touched, t.lost == nil, let first = s.drawing.strokes.last?.path.first?.location {
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
    s.canvas.tool = LiveInk.unseen(ink, scaled: s.vector)
    h.content.addSubview(s.canvas)
    let g = s.canvas.drawingGestureRecognizer
    web?.addGestureRecognizer(g)
    g.isEnabled = false
    return s
  }

  private func retire(_ s: Sheet) {
    if picked?.sheet === s { unpick() }
    if s.stepped { forget() }
    // (on its own, kept a turn: `CanvasKeep`)
    CanvasKeep.letGo(s.canvas)
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
    let v = spec.vector == true
    if s.vector != v {
      s.vector = v
      s.canvas.history = s.scratch
      if v { s.canvas.isHidden = true }
    }
    // Laid out anew with something still on its canvas (pages pinched or scrolled the moment the Pencil lifted, and
    // the page slow to say it has drawn what it was told to show). The page laid itself out after it was told, so
    // what it was told to show is in it at the new size: the canvas is emptied here, in the turn that would have
    // laid it out again, and is never on the glass at one size over a page at another. Only a stroke PencilKit has
    // not handed over yet is still the canvas's to carry.
    let frame = spec.frame.rect, z = CGFloat(spec.zoom ?? 1)
    if v, s.box != .zero, !s.glass.isEmpty, !s.hidden, s.revealed > 0, abs(z - s.zoom) > 0.0001 || abs(frame.width - s.box.width) > 1 {
      let now = ProcessInfo.processInfo.systemUptime
      if now - s.revealedAt > 0.05 { settle(s, force: true) }
    }
    if s.place(frame, zoom: z), s.vector { hurry(s) }
    s.blend = spec.blend == "multiply" ? "multiplyBlendMode" : spec.blend == "screen" ? "screenBlendMode" : nil
    lay(s)
    if picked?.sheet === s { ring(); tellPicked() }
  }

  /// A sheet's canvas laid on what is under it as the page lays the same ink on: a canvas that is its sheet (a
  /// typed note's area) as the page says; one over a PDF's page plainly while a pen writes (the page's path of a
  /// pen's stroke lies over the print as it is: the stroke is one colour written and at rest, whatever a device
  /// makes of a filter over PencilKit's own layers) and as the page says under the highlighter.
  private func lay(_ s: Sheet) {
    let filter: String? = s.vector && tool.kind != "highlighter" ? nil : s.blend
    if (s.canvas.layer.compositingFilter as? String) != filter { s.canvas.layer.compositingFilter = filter }
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
    if h.content.frame.origin != origin {
      // (the scroller moved: what was just written goes with the page from here on)
      if h.content.frame.size.width > 0 { hurry(h) }
      h.content.frame = CGRect(origin: origin, size: CGSize(width: view.width, height: 1))
    }
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
      self.bindSignal()
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
        CanvasKeep.letGoAll(in: h.clip)
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
      if s.stepped, s.drawing != d { self.forget() }
      if self.picked?.sheet === s { self.unpick() }
      s.given = d
      s.drawing = d
      s.dirty = false
      // (a sheet the page draws: the page has these from the store, with their outlines)
      if s.vector, let known = args.names, known.count == d.strokes.count {
        for (k, n) in zip(d.strokes, known) { self.named[StrokeMark(k)] = n }
        s.told.formUnion(known)
      }
      // a page's writing is its canvas, at rest as while it is written: drawn from the strokes at whatever size the
      // page is, never a picture stretched
      if args.show == true, !d.strokes.isEmpty, !s.vector { s.canvas.isHidden = false }
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
      let d = s.drawing
      var data: String? = nil
      if s.dirty && !(self.down && self.active === s) {
        s.dirty = false
        // the page holds this from now on: an undo back to what it held before is a change
        s.given = d
        data = d.dataRepresentation().base64EncodedString()
      }
      invoke.resolve(Taken(strokes: d.strokes.count, drawing: data, seq: s.said))
    }
  }

  /// The page is showing a sheet's picture: its canvas goes until the Pencil's next touch.
  @objc public func rest(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(SheetArgs.self)
    DispatchQueue.main.async {
      if let s = self.sheets[args.sheet], !s.vector, !s.dirty, !(self.down && self.active === s) { s.canvas.isHidden = true }
      invoke.resolve()
    }
  }

  /// A dev run's: a sheet's canvas emptied as an eraser would, its change told as any change is. The rig's finger erases nothing (PLAN, 69).
  @objc public func wipe(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(SheetArgs.self)
    DispatchQueue.main.async {
      if let s = self.sheets[args.sheet] {
        if s.vector { self.put(s, PKDrawing()) } else { s.canvas.drawing = PKDrawing() }
      }
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
      self.standInOnce = args.on && args.once == true
      if let k = args.keep {
        self.keepOnCanvas = k
        if !k { for s in self.sheets.values { self.settleSoon(s) } }
      }
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
        // (a tool made narrower than PencilKit's range writes no narrower: tried, and the stroke under the finger was
        // as wide as at the range's foot. So the foot it is, and what is missing is thinned at the hand-over.)
        made = PKInkingTool(type, color: c, width: min(max(CGFloat(t.width), range.lowerBound), range.upperBound))
        // (PencilKit's own drawing: its canvases draw in a space as many times as large as the tool needs, `LiveInk.scale`)
        let before = LiveInk.scale
        LiveInk.scale = LiveInk.scale(for: type, width: CGFloat(t.width))
        LiveInk.asked = CGFloat(t.width)
        if LiveInk.pencilKit, LiveInk.scale != before {
          for s in self.sheets.values where s.box != .zero { _ = s.place(s.box, zoom: s.zoom) }
          for f in self.surfaces.values { f.replace() }
        }
        // thinner than PencilKit's thinnest: written at its thinnest, and thinned by this much when it is handed over
        self.thin = t.kind == "pen" && CGFloat(t.width) < range.lowerBound ? max(0.1, CGFloat(t.width) / range.lowerBound) : 1
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
      for s in self.sheets.values where s.vector { self.lay(s) }
      if let ink = made {
        self.ink = ink
        for s in self.sheets.values { s.canvas.tool = LiveInk.unseen(ink, scaled: s.vector) }
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
      self.hurry(h)
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
      if args.what == "smooth-old" || args.what == "smooth-new" {
        // (a dev run's: the outline as it was before 2026-11-22, a half-point walk, places as UIKit rounds them, nothing evened; or as now)
        let old = args.what == "smooth-old"
        LiveInk.roughForDev = old
        if old { ilmi_stroke_tune(0.5, 0.012, 0) } else { ilmi_stroke_tune(0.2, 0.004, -1) }
      } else if args.what == "pkthin" {
        self.pkThin()
      } else if args.what == "compare-on" || args.what == "compare-off" {
        LiveInk.compare = args.what == "compare-on"
      } else if args.what == "erase-reset" {
        self.eraseReset()
      } else if args.what == "live-kit" || args.what == "live-ours" || args.what == "live-pk" {
        // (a dev run's: the stroke being written drawn by PencilKit as before 2026-11-21, by ilmi, or by PencilKit and
        // kept its own, `LiveInk.pencilKit`)
        LiveInk.kitForDev = args.what == "live-kit"
        LiveInk.pencilKit = args.what == "live-pk" || (LiveInk.pencilKitBuild && args.what != "live-ours")
        for s in self.sheets.values {
          s.canvas.tool = LiveInk.unseen(self.ink, scaled: s.vector)
          if s.box != .zero { _ = s.place(s.box, zoom: s.zoom) }
        }
        for f in self.surfaces.values { f.toolChanged(); f.replace() }
      } else if args.what == "clock-on", let w = self.web?.window {
        LiveClock.shared.start(in: w)
      } else if args.what == "clock-off" {
        LiveClock.shared.stop(write: true)
      } else if args.what == "three", let f = self.surfaces.values.first {
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
      if args.hand == true, args.points.count >= 2 {
        // (the size a point has under this tool unless it says its own, and the force it says: 1 where it says none)
        let w = self.ink.width
        let pts = args.points.enumerated().map { i, p in
          PKStrokePoint(location: CGPoint(x: p[0], y: p[1]), timeOffset: Double(i) * 0.01, size: CGSize(width: p.count > 2 && p[2] > 0 ? p[2] : w * 1.3, height: p.count > 2 && p[2] > 0 ? p[2] : w * 1.3), opacity: 1, force: p.count > 3 ? p[3] : 1, azimuth: 0, altitude: .pi / 2)
        }
        let k = PKStroke(ink: self.ink.ink, path: PKStrokePath(controlPoints: pts, creationDate: Date()), transform: .identity, mask: nil)
        if let (f, l) = self.leaf(args.sheet) {
          f.hand(l, k)
        } else if let s = self.sheets[args.sheet] {
          if s.vector {
            self.wrote(s, [k])
          } else {
            // (given to the canvas as PencilKit's own: the sheet finds a stroke more than it counted)
            s.canvas.drawing = PKDrawing(strokes: s.canvas.drawing.strokes + [k])
            if !s.vector { s.canvas.isHidden = false }
          }
        } else {
          invoke.reject("no such sheet")
          return
        }
        invoke.resolve()
        return
      }
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
      let before = s.drawing
      let k = PKStroke(ink: self.ink.ink, path: PKStrokePath(controlPoints: pts, creationDate: Date()), transform: .identity, mask: nil)
      self.lastShape = nil
      self.put(s, PKDrawing(strokes: before.strokes + [k]))
      self.step(s, from: before, to: s.drawing)
      if args.rest, self.tool.snap == true { self.shape(s) }
      if !s.vector { s.canvas.isHidden = false }
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
        made = s.drawing.image(from: CGRect(x: 0, y: 0, width: size.width / z, height: size.height / z), scale: z * screen)
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
        var st = SheetState(id: s.id, strokes: s.drawing.strokes.count, shown: !s.canvas.isHidden, dirty: s.dirty, at: Box(CGRect(origin: onWeb.origin, size: s.canvas.frame.size)), pixels: Double(s.canvas.zoomScale * screen), blend: s.canvas.layer.compositingFilter as? String, device: Box(device), stretch: Double(s.box.width > 0 ? inWindow.width / s.box.width : 1), drawn: self.drawn(s.canvas, screen: screen))
        st.vector = s.vector
        st.live = s.vector ? s.canvas.drawing.strokes.count : 0
        st.said = s.said
        st.seen = s.seen
        st.hurriedAfter = s.rushedAfter
        st.hurriedFor = s.rushedFor
        st.trace = s.trace
        return st
      }
      var heldAt: Box? = nil
      if let k = self.picked, let box = self.held(k) {
        let z = k.sheet.canvas.zoomScale
        let on = k.sheet.canvas.convert(CGRect(x: box.minX * z, y: box.minY * z, width: box.width * z, height: box.height * z), to: layer)
        heldAt = Box(layer.convert(on, to: web.scrollView))
      }
      let hosts = self.hosts.values.sorted { $0.id < $1.id }.map { h -> HostState in
        var st = HostState(id: h.id, follows: h.scroll != nil, offset: Double(h.scroll?.contentOffset.y ?? -1), port: Box(h.clip.frame), zoomer: self.pagesLayer(of: h) != nil, layers: self.layersOver(h), phase: h.live?.phase.rawValue)
        if let l = self.pagesLayer(of: h), let scroll = h.scroll {
          let f = l.convert(l.bounds, to: scroll.layer)
          st.stretched = "\(Int(f.minX)),\(Int(f.minY)) \(Int(f.width))x\(Int(f.height))"
        }
        return st
      }
      let onSurface = self.surfaces.values.first(where: { $0.selected > 0 })
      if let f = onSurface { heldAt = f.heldAt() }
      var whole = State(sheets: sheets, hosts: hosts, tools: false, tool: self.tool, finger: self.finger, undo: self.history.canUndo, redo: self.history.canRedo, wheel: self.wheel != nil, selected: onSurface?.selected ?? self.picked?.at.count ?? 0, held: heldAt, clip: self.clip.count, shape: self.lastShape, pinch: Double(self.hosts.values.compactMap { $0.live?.k }.first ?? self.pinched.values.first ?? 1), sharing: self.sharing, down: self.down || self.surfaces.values.contains(where: { $0.isDown }), scribble: self.scribble, touched: self.touched, lastTouched: self.lastTouched)
      whole.touchLog = self.touchLog
      whole.lastWidths = self.lastWidths
      whole.lastPoints = self.lastPoints
      whole.lastLags = self.lastLags
      whole.lastRounding = self.lastRounding
      whole.eraseHit = self.eraseHit
      whole.erasePut = self.erasePut
      whole.erasePatch = self.erasePatch
      whole.erasePatchPx = self.erasePatchPx
      whole.eraseSkipped = self.eraseSkipped
      whole.eraseShown = self.eraseShown
      whole.lastTurns = self.lastTurns
      whole.lastCompare = self.lastCompare
      whole.liveKept = self.liveKept
      whole.liveMissed = self.liveMissed
      whole.liveMisses = self.liveMisses
      self.bindSignal()
      whole.signal = self.signal != nil
      whole.surfaces = self.surfaces.values.sorted { $0.id < $1.id }.map { $0.state() }
      for f in self.surfaces.values.sorted(by: { $0.id < $1.id }) {
        whole.sheets += f.sheetStates()
        whole.hosts.append(f.hostState())
      }
      invoke.resolve(whole)
    }
  }

  // ── a notebook's surface (87; `Surface.swift`) ──

  /// A book's surface's ink (`PdfSurface`, a guest of its pages): one of the surfaces, so what is asked of a sheet,
  /// kept, undone, lassoed or turned is asked of it as of a notebook's.
  func adopt(_ f: NoteSurface) { surfaces[f.id] = f }
  func disown(_ f: NoteSurface) { if surfaces[f.id] === f { surfaces[f.id] = nil } }

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
