// A written notebook's pages as one surface of the system's own (milestone 87).
//
// Until now a notebook's pages were the page's (the web view's), with a PencilKit canvas a sheet kept over them and
// told where to lie: two things drawn by two processes, kept in step through a scroll and a pinch by ever more
// careful means (85, 86), and still not a scroll and a zoom that felt like the glass's own. Here the pages are one
// `UIScrollView`, laid over the web view where the page says its pages go. The scroll, its coasting, the pinch about
// the fingers, the give at either end are UIKit's and nothing of ours runs while they move. What scrolls is one view
// holding every sheet; a sheet is its paper and its ink in one picture (`Paint.swift`), so they cannot part.
//
// The zoom. The scroll view zooms that one view (a transform, the pictures stretched) while the fingers are down.
// When it ends, in the same turn of the main thread, the sheets are laid out at the zoom it ended at (every sheet on
// whole pixels of the screen, as 86 had them), the scroll view's own zoom is one again, and its offset is where the
// same place of the same sheet was: nothing moves, and the pictures are made again at the new size, sharp, a moment
// later. The room round and between the sheets grows with the zoom, so what is laid out is what was stretched.
//
// The ink. One PencilKit canvas, the size of the view and standing still over it, takes the Pencil: it shows the
// stroke while it is written, with PencilKit's own latency and prediction, and holds nothing else. When the Pencil
// lifts the stroke is taken from it, moved into its sheet's own points, kept in the sheet's strokes (still
// `PKStroke`s: what is stored and synced is unchanged), and drawn by us; the canvas is emptied in the same turn. The
// eraser, the lasso, shapes, undo and redo work on the sheet's strokes, and what changed is drawn again at once in a
// patch over the sheet's picture until the picture itself has been made again.
//
// Memory. A sheet near the view has a picture of the whole of it, as many pixels as the screen shows it with up to a
// count by the device's memory; zoomed in past that, the picture stays as it is and the part in view is drawn again,
// a pixel for a pixel, over it. A sheet far from the view has none: it is a plain view the colour of its paper. A
// sheet's strokes are asked of the page as it comes near (`want`), and kept from then on.
//
// A pageless notebook (88) is one sheet. Its sheets are still what is kept and synced, each a sheet's height of the
// long one, but nothing here shows where one ends: they lie with nothing between, the ruling runs through, and the
// long sheet is drawn only as far as what is written on it and a little more (`PaperArgs.runLength`), the last sheet
// cut there. It grows a few lines at a time as it is written toward its foot (`reach`): only the content's height
// and the last sheet's frame change, so nothing on the glass moves. A stroke is kept on the sheet its top lies on and
// may run on over the next; the eraser and the lasso reach across where two sheets meet, and what the lasso holds
// goes, together, to the sheet its top lies on (`commit`).
//
// What the page lays over the pages (a menu, page setup, the overview, a notice) shows through holes cut in this
// view, which takes no touch there. The page says where the surface lies and what it holds (`surface`), and asks it
// to go to a page or a zoom (`surfaceDo`); the surface says the page in view and the zoom, a box drawn by a held
// finger, a passage's tag pressed, and everything the canvases over a PDF's pages say of the Pencil.
//
// A book's pages (the native page view, phase 4). The same engine writes on a PDF's pages: a `NoteSurface` made
// `over` a `PdfSurface` is its guest. It has no scroll view, layout or paper of its own; it lies in the book's: its
// sheets are clear views over the book's pages, laid where the book lays them (`lay`), each in its page's own points
// (`p.<hash>.<page>`, the sheets the web reader's canvases kept: storage and sync are unchanged), drawn bare and laid
// on the page as ink is (multiplied, or screened on a dark page). The Pencil, the live stroke and its smoothing, the
// eraser, the lasso, shapes, undo and what the page asks of a sheet are this file's, unchanged. What differs is
// where: the book's zoom is its scroll view's own and stays, so a guest's sheets are drawn for it (`guestRefresh`),
// the canvas is told it, and a sheet's points to the screen's are its own (`sOf`), the book's pages being of any size.

import PencilKit
import UIKit

struct PadArgs: Decodable, Equatable {
  var top: Double
  var side: Double
  var bottom: Double
}

struct PlaceArgs: Decodable, Equatable {
  /// A page by its place in the notebook, from 1, how far down it (0 to 1), and how far across the pages the middle of the view is.
  var page: Int
  var y: Double
  var x: Double?
}

/// A passage's box on a page (by its place, from 1), in fractions of the page; `tag` is what stands beside it, none for no tag.
struct MarkArgs: Decodable, Equatable {
  var key: String
  var page: Int
  var x: Double
  var y: Double
  var w: Double
  var h: Double
  var tag: String?
  var cur: Bool?
  var dis: Bool?
  var flash: Bool?
  /// A box drawn and not yet made into anything: its number among them, when there are several.
  var pending: Bool?
  var no: Int?
}

struct HoleArgs: Decodable, Equatable {
  var x: Double
  var y: Double
  var w: Double
  var h: Double
  var r: Double?
  /// It lies on the pages (the lasso's menu, a box's bar): gone while they move.
  var rides: Bool?
}

struct SurfaceArgs: Decodable {
  var id: String
  /// Where it lies, on the page. None takes it away.
  var at: Box?
  /// The notebook's id: a sheet's strokes are kept under `p.<key>.<sheet>`.
  var key: String?
  var sheets: [Int]?
  var paper: PaperArgs?
  var look: LookArgs?
  var pad: PadArgs?
  /// The zoom it opens at, and where; read when it is made.
  var zoom: Double?
  var open: PlaceArgs?
  var marks: [MarkArgs]?
  var holes: [HoleArgs]?
  /// A pageless notebook's: how far down its long sheet the lowest thing written reaches, as the store has it.
  var foot: Double?
  /// Whether `add page` stands under the last sheet.
  var add: Bool?
  /// Room beside the pages for a passage's name: less, and its tag is a § in the gutter.
  var tagRoom: Double?
  /// Not shown, and taking no touch: the page shows a picture of it in its place, under something it has laid over all of it.
  var veiled: Bool?
}

/// Something asked of a surface: `go` to a place, `zoom` to a zoom (or a step `by`), `settle` (a dev run's: every picture made).
struct SurfaceDoArgs: Decodable {
  var id: String
  var op: String
  var place: PlaceArgs?
  var zoom: Double?
  var animated: Bool?
  /// (the checks) a point of a sheet, fractions of it, and a line down it to `y2`.
  var page: Int?
  var x: Double?
  var y: Double?
  var y2: Double?
  var lines: [[Double]]?
}

struct LeafState: Encodable {
  let id: String
  let sheet: Int
  /// Where it lies on the glass, in the screen's pixels.
  let device: Box
  let strokes: Int
  let loaded: Bool
  let dirty: Bool
  /// The pixels its picture has across and down; none when it has no picture. `fine` the part in view drawn over it, in pixels.
  let rest: [Int]?
  let fine: [Int]?
  let patches: Int
  /// The pixels of its picture to a pixel of the screen where it lies: 1 is a pixel for a pixel.
  let drawn: Double?
  let current: Bool
  /// How many of its strokes are drawn by us, and by PencilKit.
  let ours: Int
  let theirs: Int
}

struct SurfaceState: Encodable {
  let id: String
  /// On the glass, in the web view's points and in the screen's pixels.
  let at: Box
  let device: Box
  /// The zoom the sheets are laid out at, the scroll view's own over it (1 at rest), and their product.
  let base: Double
  let stretch: Double
  let zoom: Double
  let offset: [Double]
  let content: [Double]
  let inset: [Double]
  let phase: String
  let page: Int
  let pages: Int
  let sheets: [LeafState]
  /// The canvas that takes the Pencil: its zoom, the pixels it draws with to a pixel of the screen, the strokes it holds.
  let canvas: [Double]
  /// The bytes the pictures hold, about.
  let memory: Int
  let holes: Int
  /// The passages' boxes drawn on it, and the boxes drawn and not yet made into anything.
  let marks: Int
  let pendings: Int
  /// Each tag, on the page; `add page`, on the page; the last box drawn and not yet made into anything.
  let tags: [Box]
  let add: Box?
  let pending: Box?
  /// A pageless notebook's long sheet: how long it is drawn, in the sheet's points, and how many of its sheets that shows; none for pages.
  let length: Double?
  let shown: Int
  /// How many pictures are being made.
  let making: Int
  /// When the last zoom ended and when every picture was sharp again after it, in milliseconds between.
  let sharpAfter: Double?
  let blend: String?
  /// The paper it was told, and whether it is dark.
  let paper: PaperArgs
  let dark: Bool
  let colours: [String]
}

/// Over the web view, where the page's pages go: takes no touch where the page has laid something over it.
final class SurfaceView: UIView {
  weak var surface: NoteSurface?
  var holes: [(CGRect, CGFloat)] = []
  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    if isHidden || alpha < 0.01 || !bounds.contains(point) { return nil }
    if holes.contains(where: { $0.0.contains(point) }) { return nil }
    if event == nil || event?.type == .touches { surface?.arm(point) }
    return super.hitTest(point, with: event)
  }
}

/// The scroll view: what stands still over the pages is put back where the view is at every layout.
final class Pane: UIScrollView {
  weak var surface: NoteSurface?
  override func layoutSubviews() {
    super.layoutSubviews()
    surface?.pin()
  }
}

/// A sheet: its strokes, and the pictures of it.
final class Leaf: UIView {
  let sheet: Int
  var id: String
  /// (a book's page's sheet) The view's points to a point of the page, and the page's size in its points.
  var sc: CGFloat = 1
  var pts = CGSize(width: 612, height: 792)
  /// Where its corner fell between the screen's pixels when its pictures were last asked for (`phase`).
  var phase = CGPoint.zero
  var index = 0
  var model: [PKStroke] = []
  var geoms: [Geom] = []
  var cache: [StrokeMark: Geom] = [:]
  /// The strokes left out of its pictures: what the lasso has lifted.
  var lifted = Set<Int>()
  /// What the page last gave it or took from it.
  var given: [StrokeMark] = []
  var loaded = false
  var asked = false
  var dirty = false
  var stepped = false
  var quiet: DispatchWorkItem?
  /// Moves with every change to what it shows.
  var ver = 0
  /// How far down its lowest stroke reaches, in its points: past its own foot on a pageless notebook's.
  var low: CGFloat = 0
  let rest = CALayer()
  let fine = CALayer()
  let hair = CALayer()
  var restKey: [Int]?
  var restAsked: [Int]?
  var fineKey: [Int]?
  var fineAsked: [Int]?
  /// The part of the sheet the fine picture covers, in its points.
  var fineRegion = CGRect.zero
  /// Parts drawn again at once after a change, over the pictures, until those are made again: each with the part of the sheet it covers.
  var patches: [(layer: CALayer, region: CGRect, ver: Int)] = []

  init(sheet: Int, id: String) {
    self.sheet = sheet
    self.id = id
    super.init(frame: .zero)
    isUserInteractionEnabled = false
    isOpaque = true
    clipsToBounds = true
    for l in [rest, fine] {
      l.actions = ["contents": NSNull(), "bounds": NSNull(), "position": NSNull(), "frame": NSNull(), "hidden": NSNull()]
      l.contentsGravity = .resize
      l.isOpaque = true
      layer.addSublayer(l)
    }
    fine.zPosition = 1
    fine.isHidden = true
  }

  required init?(coder: NSCoder) { fatalError("no coder") }

  /// A sheet has its edge, a hair's width, as a page of the reader's has.
  func edge(dark: Bool, run: Bool) {
    // (sheets that run on as one have no edge between them)
    hair.isHidden = run
    hair.borderWidth = 1 / UIScreen.main.scale
    hair.borderColor = (dark ? UIColor(white: 1, alpha: 0.16) : UIColor(white: 0, alpha: 0.16)).cgColor
    if hair.superlayer == nil { hair.zPosition = 4; hair.actions = ["bounds": NSNull(), "position": NSNull()]; layer.addSublayer(hair) }
    hair.frame = bounds
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    hair.frame = bounds
    CATransaction.commit()
  }

  func bytes() -> Int {
    var n = 0
    if let k = restKey, rest.contents != nil { n += k[1] * k[2] * 4 }
    if let k = fineKey, fine.contents != nil { n += k[3] * k[4] * 4 }
    for p in patches { if let img = p.layer.contents { let i = img as! CGImage; n += i.width * i.height * 4 } }
    return n
  }
}

private enum Doing {
  /// (`before`: each sheet it has reached, by its number, as it was)
  case erase(before: [Int: [PKStroke]], last: CGPoint)
  case loop(points: [CGPoint], shown: [CGPoint])
  case drag(before: [PKStroke], at: [Int], from: CGPoint, moved: Bool)
  case resize(before: [PKStroke], at: [Int], origin: CGPoint, from: CGPoint, moved: Bool)
}

final class NoteSurface: NSObject, UIScrollViewDelegate, PKCanvasViewDelegate, UIGestureRecognizerDelegate, PenEars {
  let id: String
  unowned let plugin: InkPlugin
  let view: UIView
  let scroll: UIScrollView
  let content: UIView
  /// Written on a book's pages: the book's surface lays them out and scrolls them (`over`).
  let guest: Bool
  /// What is drawn over the sheets and scrolls with them: the passages' boxes and tags, the lasso's, the eraser's reach.
  let marks = UIView()
  let canvas = InkCanvas()
  /// The stroke being written, drawn by ilmi (`Live.swift`).
  private(set) lazy var live = LiveInk(canvas: canvas)
  let addButton = UIButton(type: .custom)
  private var watch: PenWatch?
  private let spare = UndoManager()

  private var key = ""
  private var order: [Int] = []
  private var leaves: [Int: Leaf] = [:]
  private var paper = PaperArgs(kind: "ruled", w: 612, h: 792, rule: 24, left: 0, right: 0, top: 72, bottom: 24, lines: [], run: false)
  private var look = LookArgs(paper: "#ffffff", rule: "#c3cfdd", dot: "#a9b7c8", margin: "#e7b9b9", desk: "#e8e8e8", dark: false, accent: "#b8860b", fg: "#222222", line: "#cccccc", tag: "#ffffff")
  private var pad = PadArgs(top: 22, side: 30, bottom: 80)
  private var markSpecs: [MarkArgs] = []
  private var holeSpecs: [HoleArgs] = []
  private var showAdd = false
  private var tagRoom: CGFloat = 210

  /// The zoom the sheets are laid out at: the scroll view's own zoom is over it, and 1 at rest.
  private(set) var base: CGFloat = 1
  private let zmin: CGFloat = 0.5
  private let zmax: CGFloat = 4
  private let fitMax: CGFloat = 1600
  private let gapAt: CGFloat = 18
  private var lastZoom: CGFloat?
  /// Laid out: each sheet's width and height, the points of the screen to a point of the sheet, where the sheets begin, the room between them.
  private var pageW: CGFloat = 0
  private var pageH: CGFloat = 0
  private var s: CGFloat = 1
  private var left: CGFloat = 0
  private var top: CGFloat = 0
  private var gap: CGFloat = 0
  private var laidFor = CGSize.zero
  private var rebasing = false
  private var settling = false
  private var made = false
  private var opening: PlaceArgs?

  private var down = false
  private weak var active: Leaf?
  private weak var lastActive: Leaf?
  private var doing: Doing?
  private var spent = false
  private var joined = false
  private var clearing = false
  /// How many of the canvas's strokes are ours already: left on it while the Pencil was down.
  private var taken = 0
  private var swept: DispatchWorkItem?
  private var picked: (leaf: Leaf, at: [Int])?
  /// What the lasso's hold moved from sheet to sheet of a pageless notebook, so that what it holds is kept on one:
  /// each sheet as it was and as it is. Nothing a person did or sees, so no step of its own to undo: it is part of
  /// whatever is done next with what is held (one step with it), and is put back as it was when the lasso lets go
  /// with nothing done. Until then it is not the store's either (`taken`).
  private var regroup: [(leaf: Leaf, before: [PKStroke], after: [PKStroke])] = []
  private let held = CALayer()
  private var heldRegion = CGRect.zero
  private var snap: (leaf: Leaf, until: TimeInterval)?
  private var resting: DispatchWorkItem?
  private var grown: Int?
  /// A pageless notebook's long sheet: how long it is drawn, in the sheet's points (0 for pages), and the lowest thing the store has on it.
  private var runLen: Double = 0
  private var runFoot: Double = 0
  /// A pageless notebook's one edge, a hair's width round the whole long sheet, as a page has round itself.
  private let runEdge = CALayer()
  private let loop = CAShapeLayer()
  private let outline = CAShapeLayer()
  private let grip = CAShapeLayer()
  private let reach = CAShapeLayer()
  private let ghost = CAShapeLayer()
  private var boxFrom: CGPoint?
  private var boxLeaf: Leaf?
  private var tagRects: [(key: String, rect: CGRect)] = []
  private var pendingRect: CGRect?
  private var markLayers: [CALayer] = []
  private var moving = false
  private var touchedAt: TimeInterval = 0
  private var saidAt: TimeInterval = 0
  private var sayLater: DispatchWorkItem?
  private var said = ""
  private let painters: OperationQueue = {
    let q = OperationQueue()
    q.maxConcurrentOperationCount = 2
    q.qualityOfService = .userInitiated
    return q
  }()
  private var making = 0
  private var zoomEndedAt: TimeInterval = 0
  private var sharpAfter: Double?
  private var hold: UILongPressGestureRecognizer!
  private var tap: UITapGestureRecognizer!
  private var twice: UITapGestureRecognizer!
  private var two: UITapGestureRecognizer!
  private var three: UITapGestureRecognizer!

  private var screen: CGFloat { view.window?.screen.scale ?? UIScreen.main.scale }
  private func onPixel(_ v: CGFloat) -> CGFloat { (v * screen).rounded() / screen }
  /// The most pixels a sheet's whole picture has: past it the picture is coarser than the screen, and the part in view is drawn over it.
  private static let cap: CGFloat = ProcessInfo.processInfo.physicalMemory >= 7_000_000_000 ? 6_000_000 : 4_000_000

  init(id: String, plugin: InkPlugin) {
    self.id = id
    self.plugin = plugin
    let v = SurfaceView(), p = Pane()
    view = v
    scroll = p
    content = UIView()
    guest = false
    super.init()
    v.surface = self
    view.clipsToBounds = true
    p.surface = self
    scroll.delegate = self
    scroll.frame = view.bounds
    scroll.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    scroll.contentInsetAdjustmentBehavior = .never
    scroll.minimumZoomScale = zmin
    scroll.maximumZoomScale = zmax
    scroll.bouncesZoom = true
    scroll.alwaysBounceVertical = true
    scroll.decelerationRate = .normal
    scroll.delaysContentTouches = false
    scroll.canCancelContentTouches = true
    scroll.scrollsToTop = false
    scroll.panGestureRecognizer.allowedTouchTypes = [NSNumber(value: UITouch.TouchType.direct.rawValue)]
    scroll.pinchGestureRecognizer?.allowedTouchTypes = [NSNumber(value: UITouch.TouchType.direct.rawValue)]
    view.addSubview(scroll)
    scroll.addSubview(content)
    setUp()
  }

  /// A book's pages written on: in the book's surface's own view, scroll view and content.
  init(id: String, plugin: InkPlugin, over book: UIView, scroll sv: UIScrollView, content c: UIView) {
    self.id = id
    self.plugin = plugin
    view = book
    scroll = sv
    content = c
    guest = true
    super.init()
    made = true
    // (the Pencil writes; fingers scroll and zoom)
    scroll.panGestureRecognizer.allowedTouchTypes = [NSNumber(value: UITouch.TouchType.direct.rawValue)]
    scroll.pinchGestureRecognizer?.allowedTouchTypes = [NSNumber(value: UITouch.TouchType.direct.rawValue)]
    setUp()
  }

  private func setUp() {
    marks.isUserInteractionEnabled = false
    content.addSubview(marks)
    marks.layer.zPosition = guest ? 30 : 5
    canvas.backgroundColor = .clear
    canvas.isOpaque = false
    canvas.isUserInteractionEnabled = false
    canvas.isScrollEnabled = false
    canvas.showsVerticalScrollIndicator = false
    canvas.showsHorizontalScrollIndicator = false
    canvas.contentInsetAdjustmentBehavior = .never
    canvas.delegate = self
    // (its strokes are taken from it as they are written: what PencilKit would undo on it is nothing)
    canvas.history = spare
    canvas.layer.zPosition = 20
    scroll.addSubview(canvas)
    addButton.setTitle("add page", for: .normal)
    addButton.titleLabel?.font = .systemFont(ofSize: 14, weight: .medium)
    addButton.layer.cornerRadius = 6
    addButton.addTarget(self, action: #selector(addPressed), for: .touchUpInside)
    addButton.isHidden = true
    content.addSubview(addButton)
    for l in [loop, outline] {
      l.fillColor = nil
      l.strokeColor = UIColor(white: 0.5, alpha: 0.9).cgColor
      l.lineWidth = 1.5
      l.lineDashPattern = [6, 4]
    }
    grip.fillColor = UIColor.white.cgColor
    grip.strokeColor = UIColor(white: 0.42, alpha: 1).cgColor
    grip.lineWidth = 1.5
    reach.fillColor = UIColor(white: 0.5, alpha: 0.12).cgColor
    reach.strokeColor = UIColor(white: 0.45, alpha: 0.9).cgColor
    reach.lineWidth = 1
    ghost.lineWidth = 1.5
    ghost.lineDashPattern = [5, 4]
    held.actions = ["contents": NSNull(), "bounds": NSNull(), "position": NSNull(), "transform": NSNull()]
    held.zPosition = 3
    let w = PenWatch(target: nil, action: nil)
    w.ears = self
    scroll.addGestureRecognizer(w)
    watch = w
    let direct = [NSNumber(value: UITouch.TouchType.direct.rawValue)]
    hold = UILongPressGestureRecognizer(target: self, action: #selector(held(_:)))
    hold.minimumPressDuration = 0.32
    hold.allowableMovement = 10
    tap = UITapGestureRecognizer(target: self, action: #selector(tapped(_:)))
    twice = UITapGestureRecognizer(target: self, action: #selector(tappedTwice(_:)))
    twice.numberOfTapsRequired = 2
    two = UITapGestureRecognizer(target: self, action: #selector(fingers(_:)))
    two.numberOfTouchesRequired = 2
    three = UITapGestureRecognizer(target: self, action: #selector(fingers(_:)))
    three.numberOfTouchesRequired = 3
    // (a book's own surface has its taps and its held finger: the text's, `PdfText`)
    for g in (guest ? [two, three] : [hold, tap, twice, two, three]) as [UIGestureRecognizer] {
      g.allowedTouchTypes = direct
      g.cancelsTouchesInView = false
      g.delaysTouchesBegan = false
      g.delaysTouchesEnded = false
      g.delegate = self
      scroll.addGestureRecognizer(g)
    }
    if let pinch = scroll.pinchGestureRecognizer {
      // fingers that pinched are not fingers that tapped
      two.require(toFail: pinch)
      three.require(toFail: pinch)
    }
    setTouchTypes()
    canvas.tool = LiveInk.unseen(plugin.ink, scaled: true)
  }

  func gestureRecognizer(_ g: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith other: UIGestureRecognizer) -> Bool { true }

  func gestureRecognizerShouldBegin(_ g: UIGestureRecognizer) -> Bool {
    if g === hold || g === twice {
      // where a finger writes, a finger resting or tapping on a sheet is writing
      if plugin.fingerWrites, leaf(at: g.location(in: content)) != nil { return false }
      if g === hold { return leaf(at: g.location(in: content)) != nil && !down }
    }
    return true
  }

  // ── what the page says ──

  func take(_ a: SurfaceArgs, on parent: UIView, above web: UIView, at frame: CGRect) {
    if view.superview !== parent { parent.insertSubview(view, aboveSubview: web) }
    var relay = false
    var repaint = false
    if let k = a.key, k != key {
      key = k
      runLen = 0
      runFoot = 0
      for l in leaves.values { l.id = "p.\(k).\(l.sheet)" }
    }
    if let p = a.pad, p != pad { pad = p; relay = true }
    if let p = a.paper, p != paper {
      if p.w != paper.w || p.h != paper.h || p.run != paper.run { relay = true }
      // (pageless anew: as long as what is written and a little more, whatever it was before)
      if p.run != paper.run { runLen = 0; grown = nil }
      paper = p
      repaint = true
      for leaf in leaves.values { leaf.edge(dark: look.dark, run: p.run) }
    }
    if let l = a.look, l != look {
      let turned = l.dark != look.dark
      look = l
      repaint = true
      scroll.backgroundColor = colour(l.desk) ?? .lightGray
      view.backgroundColor = scroll.backgroundColor
      canvas.overrideUserInterfaceStyle = l.dark ? .dark : .light
      canvas.layer.compositingFilter = l.dark ? "screenBlendMode" : "multiplyBlendMode"
      for leaf in leaves.values {
        leaf.backgroundColor = colour(l.paper) ?? .white
        leaf.edge(dark: l.dark, run: paper.run)
        // ink is another colour on dark paper: every stroke is made ready again
        if turned { leaf.cache = [:]; regeom(leaf) }
      }
      addButton.setTitleColor(colour(l.fg) ?? .darkGray, for: .normal)
      addButton.layer.borderColor = (colour(l.line) ?? .gray).cgColor
      addButton.layer.borderWidth = 1
    }
    if let r = a.tagRoom { tagRoom = CGFloat(r) }
    if let add = a.add, add != showAdd { showAdd = add; relay = true }
    let keep = made ? place() : nil
    if let list = a.sheets, list != order {
      order = list
      var next: [Int: Leaf] = [:]
      for (i, n) in list.enumerated() {
        let l = leaves[n] ?? {
          let fresh = Leaf(sheet: n, id: "p.\(key).\(n)")
          fresh.backgroundColor = colour(look.paper) ?? .white
          fresh.edge(dark: look.dark, run: paper.run)
          content.insertSubview(fresh, belowSubview: marks)
          return fresh
        }()
        l.index = i
        next[n] = l
      }
      for (n, l) in leaves where next[n] == nil { retire(l) }
      leaves = next
      relay = true
      // (a sheet's place among the others is where a pageless notebook's ruling has got to)
      if paper.run { repaint = true }
    }
    if paper.run {
      if let f = a.foot { runFoot = max(runFoot, f) }
      // as long as what is written on it and a little more; never shorter while it is open
      let want = paper.runLength(foot: max(runFoot, inkFoot()))
      if want > runLen { runLen = want; relay = true }
      // (what is written runs past the sheets there are, a stroke taller than a sheet: the next is asked for now, not
      // at the next stroke)
      if runLen > Double(order.count) * paper.h { askMore() }
    }
    let moved = view.frame != frame
    if moved {
      view.frame = frame
      scroll.frame = view.bounds
    }
    if !made {
      made = true
      base = min(zmax, max(zmin, CGFloat(a.zoom ?? 1)))
      opening = a.open
      layOut()
      if let o = opening { go(o, animated: false) }
      opening = nil
    } else if relay || moved || laidFor != scroll.bounds.size {
      layOut()
      if let k = keep { go(k, animated: false, exact: true) }
    }
    if repaint { for l in leaves.values { l.ver += 1; l.restKey = nil; l.fineKey = nil; l.restAsked = nil; l.fineAsked = nil } }
    if let m = a.marks, m != markSpecs { markSpecs = m; drawMarks() } else if relay || moved { drawMarks() }
    if let h = a.holes { holeSpecs = h }
    if pageW > 0 { edgeRun() }
    let veiled = a.veiled ?? false
    if view.isHidden != veiled { view.isHidden = veiled }
    cut()
    tend()
    saySoon()
  }

  func remove() {
    painters.cancelAllOperations()
    for l in Array(leaves.values) { retire(l) }
    leaves = [:]
    if guest {
      // (the book's view is the book's: what is ours in it goes)
      if let w = watch { scroll.removeGestureRecognizer(w) }
      for g in [two, three] as [UIGestureRecognizer] { scroll.removeGestureRecognizer(g) }
      scroll.removeGestureRecognizer(canvas.drawingGestureRecognizer)
      marks.removeFromSuperview()
      CanvasKeep.letGo(canvas)
      return
    }
    // (the canvas on its own first, kept a turn: let go with the view it lies in, in one go, it crashed the app: `CanvasKeep`)
    CanvasKeep.letGo(canvas)
    view.removeFromSuperview()
  }

  private func retire(_ l: Leaf) {
    if picked?.leaf === l || regroup.contains(where: { $0.leaf === l }) { unpick() }
    if l.stepped { plugin.forget() }
    l.quiet?.cancel()
    l.removeFromSuperview()
  }

  /// The holes the page asks for, cut out of what is shown: all of them at rest, those that do not ride on the pages while the pages move.
  private func cut() {
    guard let web = plugin.webView, let parent = view.superview else { return }
    var list: [(CGRect, CGFloat)] = []
    for h in holeSpecs where !(moving && h.rides == true) {
      let r = parent.convert(web.scrollView.convert(CGRect(x: h.x, y: h.y, width: h.w, height: h.h), to: parent), to: view).intersection(view.bounds)
      if !r.isNull, r.width > 0, r.height > 0 { list.append((r, CGFloat(h.r ?? 0))) }
    }
    (view as? SurfaceView)?.holes = list
    if list.isEmpty {
      view.layer.mask = nil
      return
    }
    let path = UIBezierPath(rect: view.bounds)
    for (r, radius) in list { path.append(radius > 0 ? UIBezierPath(roundedRect: r, cornerRadius: radius) : UIBezierPath(rect: r)) }
    let mask = (view.layer.mask as? CAShapeLayer) ?? CAShapeLayer()
    mask.fillRule = .evenOdd
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    mask.frame = view.bounds
    mask.path = path.cgPath
    view.layer.mask = mask
    CATransaction.commit()
  }

  // ── where the sheets lie ──

  private func measure(_ z: CGFloat) -> (pageW: CGFloat, pageH: CGFloat, s: CGFloat, left: CGFloat, top: CGFloat, gap: CGFloat, size: CGSize, addH: CGFloat) {
    let v = scroll.bounds.size
    let side = onPixel(CGFloat(pad.side) * z)
    let col = max(120, v.width - 2 * CGFloat(pad.side))
    let fit = min(fitMax, col)
    var w = onPixel(fit * z)
    // narrower than the view, the pages are centred in it: as many pixels either side
    if w + 2 * side < v.width { w = (v.width - 2 * side) - 2 * onPixel(((v.width - 2 * side) - fit * z) / 2) }
    w = max(w, 8)
    let scale = w / CGFloat(max(paper.w, 1))
    let h = max(onPixel(CGFloat(paper.h) * scale), 8)
    let g = paper.run ? 0 : max(1 / screen, onPixel(gapAt * z))
    let t = onPixel(CGFloat(pad.top) * z)
    let n = CGFloat(order.count)
    let addH = showAdd ? onPixel(60 * z) : 0
    let total = paper.run ? cutAt(h) : n * h + max(0, n - 1) * g
    return (w, h, scale, side, t, g, CGSize(width: w + 2 * side, height: t + total + addH + onPixel(CGFloat(pad.bottom) * z)), addH)
  }

  private func topOf(_ index: Int) -> CGFloat { top + CGFloat(index) * (pageH + gap) }

  /// A pageless notebook's long sheet ends this far down its first sheet's top, each sheet laid out `h` high: at its length, and never past the sheets there are.
  private func cutAt(_ h: CGFloat) -> CGFloat {
    let most = Double(order.count) * paper.h
    return onPixel(CGFloat(min(max(runLen, paper.h), most) / max(paper.h, 1)) * h)
  }

  /// Where a sheet lies among the others: the whole of it, or of a pageless notebook's last sheet shown what is above the long sheet's foot.
  private func frameOf(_ l: Leaf) -> CGRect {
    let whole = CGRect(x: left, y: topOf(l.index), width: pageW, height: pageH)
    if !paper.run { return whole }
    return CGRect(x: whole.minX, y: whole.minY, width: whole.width, height: min(pageH, max(0, cutAt(pageH) - CGFloat(l.index) * pageH)))
  }

  /// The sheets put where they lie: a pageless notebook's past the long sheet's foot are not shown (they keep a sheet's place, so their pictures are ready when the foot reaches them).
  private func seat(_ l: Leaf) {
    let f = frameOf(l)
    let off = paper.run && f.height <= 0
    l.frame = off ? CGRect(x: left, y: topOf(l.index), width: pageW, height: pageH) : f
    if l.isHidden != off { l.isHidden = off }
    l.rest.frame = CGRect(x: 0, y: 0, width: pageW, height: pageH)
  }

  /// The long sheet's edge put round it; gone for pages, whose sheets each have their own.
  private func edgeRun() {
    if !paper.run { if runEdge.superlayer != nil { runEdge.removeFromSuperlayer() }; return }
    if runEdge.superlayer == nil {
      runEdge.zPosition = 4
      runEdge.actions = ["bounds": NSNull(), "position": NSNull(), "frame": NSNull(), "borderColor": NSNull()]
      content.layer.addSublayer(runEdge)
    }
    runEdge.borderWidth = 1 / screen
    runEdge.borderColor = (look.dark ? UIColor(white: 1, alpha: 0.16) : UIColor(white: 0, alpha: 0.16)).cgColor
    runEdge.frame = CGRect(x: left, y: top, width: pageW, height: cutAt(pageH))
  }

  /// The lowest thing written on a pageless notebook's long sheet, of the sheets held here, in points from its top.
  private func inkFoot() -> Double {
    var foot = 0.0
    for l in leaves.values {
      var low: CGFloat = 0
      for g in l.geoms where g.box.maxY > low { low = g.box.maxY }
      if low > 0 { foot = max(foot, Double(l.index) * paper.h + Double(low)) }
    }
    return foot
  }

  /// A pageless notebook's long sheet reaches at least to a little under `foot` (points down it): grown by whole lines when it did not, with nothing that is on the glass moved. It asks for the next sheet before the foot comes to the end of the last there is.
  private func reach(_ foot: Double) {
    guard paper.run, made else { return }
    let want = paper.runLength(foot: foot)
    if want > runLen {
      runLen = want
      // (while a pinch stretches the sheets they are left as they are: laid out when it ends)
      if abs(scroll.zoomScale - 1) < 0.0005, !rebasing { resize() }
    }
    askMore()
  }

  /// The long sheet's next sheet is asked for before its foot comes to the end of the last there is: once for each
  /// count of sheets, so a stroke that runs on over several is given them one after another as each arrives.
  private func askMore() {
    let n = order.count
    if paper.run, runLen + PaperArgs.allow > Double(n) * paper.h, grown != n, let last = order.last {
      grown = n
      plugin.emit(["kind": "surface", "id": id, "what": "grow", "sheet": last])
    }
  }

  /// The long sheet has another length: the content is as high, the sheets it now reaches are shown, and nothing else is touched.
  private func resize() {
    let m = measure(base)
    if m.size == scroll.contentSize { return }
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    rebasing = true
    content.frame = CGRect(origin: .zero, size: m.size)
    marks.frame = content.bounds
    scroll.contentSize = m.size
    for l in leaves.values {
      let was = l.isHidden ? 0 : l.frame.height
      seat(l)
      // paper come into view with no picture of it yet is drawn now: never a bare strip
      if !l.isHidden, l.frame.height > was, l.rest.contents == nil || l.restKey?[0] != l.ver {
        patch(l, CGRect(x: 0, y: was / s, width: CGFloat(paper.w), height: (l.frame.height - was) / s))
      }
    }
    edgeRun()
    rebasing = false
    CATransaction.commit()
    tend()
    saySoon()
  }

  /// The sheets laid out at the zoom the surface has, the scroll view's own zoom one.
  private func layOut() {
    let m = measure(base)
    pageW = m.pageW; pageH = m.pageH; s = m.s; left = m.left; top = m.top; gap = m.gap
    laidFor = scroll.bounds.size
    rebasing = true
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    if scroll.zoomScale != 1 {
      scroll.minimumZoomScale = min(scroll.minimumZoomScale, 1)
      scroll.maximumZoomScale = max(scroll.maximumZoomScale, 1)
      scroll.zoomScale = 1
    }
    scroll.minimumZoomScale = zmin / base
    scroll.maximumZoomScale = zmax / base
    content.transform = .identity
    content.frame = CGRect(origin: .zero, size: m.size)
    marks.frame = content.bounds
    scroll.contentSize = m.size
    for l in leaves.values {
      seat(l)
      if !l.fine.isHidden { l.fine.frame = onLeaf(l.fineRegion) }
      for p in l.patches { p.layer.frame = onLeaf(p.region) }
    }
    edgeRun()
    addButton.isHidden = !showAdd
    if showAdd {
      let y = topOf(max(order.count - 1, 0)) + pageH + onPixel(16 * base)
      addButton.frame = CGRect(x: left, y: y, width: pageW, height: onPixel(40 * min(base, 1.5)))
    }
    centre()
    CATransaction.commit()
    rebasing = false
    placeCanvas()
    ring()
  }

  /// A part of a sheet, in its points, as it lies in the sheet's view.
  private func onLeaf(_ r: CGRect, _ l: Leaf? = nil) -> CGRect {
    let k = l.map { sOf($0) } ?? s
    return CGRect(x: r.minX * k, y: r.minY * k, width: r.width * k, height: r.height * k)
  }
  /// A sheet's view's points to a point of it: the notebook's one for all, a book's page's its own.
  private func sOf(_ l: Leaf) -> CGFloat { guest ? l.sc : s }
  /// The screen's points to a point of a sheet as it is shown now (a book's zoom is its scroll view's own).
  private func ks(_ l: Leaf) -> CGFloat { sOf(l) * (guest ? scroll.zoomScale : 1) }
  /// A sheet's size in its points.
  private func sizeOf(_ l: Leaf) -> CGSize { guest ? l.pts : CGSize(width: CGFloat(paper.w), height: CGFloat(paper.h)) }
  /// Not in a zoom: the Pencil writes. (A notebook's zoom ends at one; a book's stays what it is.)
  private var steady: Bool { guest ? !(scroll.isZooming || scroll.isZoomBouncing) : abs(scroll.zoomScale - 1) < 0.0005 }
  /// The screen's points to a point of what the canvas holds.
  private var canvasK: CGFloat = 1
  /// The canvas's points (what PencilKit hands over) to a sheet's, as the canvas stands now.
  private func canvasTo(_ l: Leaf) -> CGAffineTransform {
    let o = scroll.contentOffset, k = canvasK, sl = sOf(l)
    func at(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
      let v = scroll.convert(CGPoint(x: x * k + o.x, y: y * k + o.y), to: l)
      return CGPoint(x: v.x / sl, y: v.y / sl)
    }
    let c0 = at(0, 0), c1 = at(1, 0), c2 = at(0, 1)
    return CGAffineTransform(a: c1.x - c0.x, b: c1.y - c0.y, c: c2.x - c0.x, d: c2.y - c0.y, tx: c0.x, ty: c0.y)
  }

  /// Narrower than the view, the pages stand in its middle.
  private func centre() {
    let v = scroll.bounds.size
    let w = scroll.contentSize.width
    let inset = max(0, onPixel((v.width - w) / 2))
    if scroll.contentInset.left != inset { scroll.contentInset = UIEdgeInsets(top: 0, left: inset, bottom: 0, right: 0) }
  }

  /// The canvas placed again (a dev run's change of who draws the pen).
  func replace() { placeCanvas() }

  /// The canvas that takes the Pencil: over the view, standing still, drawing a point of a sheet as large as the sheets are laid out.
  private func placeCanvas() {
    let v = scroll.bounds.size
    guard v.width > 0, v.height > 0 else { return }
    // (PencilKit's own drawing draws in a space `LiveInk.scale` times as large: `LiveInk.pencilKit`)
    // (a book's: the screen's points to a point of the page in the middle of the view, at its zoom)
    if guest {
      let mid = scroll.convert(CGPoint(x: scroll.bounds.midX, y: scroll.bounds.midY), to: content)
      let near = leaves.values.min { abs($0.frame.midY - mid.y) < abs($1.frame.midY - mid.y) }
      canvasK = (near?.sc ?? 1) * scroll.zoomScale
    } else {
      canvasK = s
    }
    let drawn = LiveInk.drawn(scaled: true)
    let px = v.width * v.height * screen * screen
    // as many of its pixels to the screen's as memory allows, up to two; and no more than keeps its zoom within
    // PencilKit's (`NoteSurface.pkMost`): past it the canvas stays at that zoom, whatever it is told
    var k = max(1, min(2, (Sheet.most / max(px, 1)).squareRoot()))
    k = max(1, min(k, NoteSurface.pkMost * drawn / max(canvasK, 0.0001)))
    let size = CGSize(width: (v.width * k * screen).rounded() / screen, height: (v.height * k * screen).rounded() / screen)
    canvas.transform = .identity
    canvas.bounds = CGRect(origin: .zero, size: size)
    canvas.transform = CGAffineTransform(scaleX: v.width / size.width, y: v.height / size.height)
    let zz = min(canvasK * k / drawn, NoteSurface.pkMost)
    if abs(canvas.zoomScale - zz) > 0.00001 {
      canvas.maximumZoomScale = max(canvas.maximumZoomScale, zz)
      canvas.minimumZoomScale = min(canvas.minimumZoomScale, zz)
      canvas.zoomScale = zz
      canvas.minimumZoomScale = zz
      canvas.maximumZoomScale = zz
    }
    // what is taken off the canvas is read at the zoom it has, not the one it was told: told more than PencilKit
    // allows, it had stayed at ten, and every stroke kept was moved down and right of where it was written, the
    // farther the more (2026-11-22: "it gets translated towards the bottom right ... after i lift the pen")
    canvasK = canvas.zoomScale * drawn / (size.width / v.width)
    if canvas.contentSize != size { canvas.contentSize = size }
    if canvas.contentOffset != .zero { canvas.contentOffset = .zero }
    pin()
  }

  /// The most PencilKit's canvas zooms: told more, it stays here (measured: told 15.2, it was 10).
  static let pkMost: CGFloat = 10

  /// What stands still over the pages, put where the view is.
  func pin() {
    let b = scroll.bounds
    let c = CGPoint(x: b.midX, y: b.midY)
    if canvas.center != c { canvas.center = c }
    if guest { return }
    if laidFor != b.size, made, !rebasing {
      // the view has another size (the iPad turned, the tree opened): laid out again, the same place at the top
      let keep = place()
      layOut()
      go(keep, animated: false, exact: true)
      drawMarks()
      tend()
    }
  }

  /// The place in view: the sheet under the top of the view and how far down it, and what of the pages' width is at the middle.
  private func place() -> PlaceArgs {
    let r = max(scroll.zoomScale, 0.01)
    let y = (scroll.contentOffset.y + 1) / r
    let step = pageH + gap
    let i = step > 0 ? min(max(Int(((y - top) / step).rounded(.down)), 0), max(order.count - 1, 0)) : 0
    let fy = pageH > 0 ? (y - topOf(i)) / pageH : 0
    let mid = (scroll.contentOffset.x + scroll.bounds.width / 2) / r
    let fx = pageW > 0 ? (mid - left) / pageW : 0.5
    return PlaceArgs(page: i + 1, y: Double(fy), x: Double(fx))
  }

  private func clamp(_ o: CGPoint) -> CGPoint {
    let v = scroll.bounds.size, c = scroll.contentSize, i = scroll.contentInset
    return CGPoint(x: min(max(o.x, -i.left), max(-i.left, c.width - v.width + i.right)), y: min(max(o.y, 0), max(0, c.height - v.height)))
  }

  /// The pages moved so a place is at the top of the view (a little room over it unless `exact`).
  func go(_ p: PlaceArgs, animated: Bool, exact: Bool = false) {
    guard !order.isEmpty else { return }
    let i = min(max(p.page - 1, 0), order.count - 1)
    var o = scroll.contentOffset
    // (the place said is a point under the view's top: come back to exactly, it is there again)
    o.y = exact ? onPixel(topOf(i) + CGFloat(p.y) * pageH) - 1 : onPixel(topOf(i) + CGFloat(p.y) * pageH - min(top, 12))
    if let x = p.x { o.x = onPixel(left + CGFloat(x) * pageW - scroll.bounds.width / 2) }
    scroll.setContentOffset(clamp(o), animated: animated)
    if !animated { tend(); saySoon() }
  }

  /// The pages at another zoom, about the middle of the view.
  func zoom(to z: CGFloat, animated: Bool, about: CGPoint? = nil) {
    let want = min(zmax, max(zmin, z))
    let r = want / base
    if abs(r - scroll.zoomScale) < 0.0005 { return }
    if abs(base - 1) > 0.005 { lastZoom = base }
    zoomEndedAt = 0
    if let p = about {
      let v = scroll.bounds.size
      let size = CGSize(width: v.width / r, height: v.height / r)
      // the place tapped stays under the finger as far as the pages allow
      let at = scroll.convert(p, from: content)
      let fx = (at.x - scroll.bounds.minX) / max(v.width, 1), fy = (at.y - scroll.bounds.minY) / max(v.height, 1)
      scroll.zoom(to: CGRect(x: p.x - size.width * fx, y: p.y - size.height * fy, width: size.width, height: size.height), animated: animated)
    } else {
      scroll.setZoomScale(r, animated: animated)
    }
    if !animated { rebase() }
  }

  /// A zoom has ended: the sheets are laid out at it, the scroll view's own zoom is one again, and nothing has moved.
  private func rebase() {
    let r = scroll.zoomScale
    if abs(r - 1) < 0.0005 {
      settling = false
      if r != 1 { layOut() }
      zoomed()
      return
    }
    var z = min(zmax, max(zmin, base * r))
    // all but fit is fit: eased there, then laid out
    if abs(z - 1) < 0.03, abs(base * r - 1) > 0.0005, !settling {
      settling = true
      scroll.setZoomScale(1 / base, animated: true)
      return
    }
    settling = false
    if abs(z - 1) < 0.03 { z = 1 }
    // the place at the middle of the view: the sheet it is on, and where on it
    let v = scroll.bounds.size
    let mid = CGPoint(x: (scroll.contentOffset.x + v.width / 2) / r, y: (scroll.contentOffset.y + v.height / 2) / r)
    let step = pageH + gap
    let i = step > 0 ? min(max(Int(((mid.y - top) / step).rounded(.down)), 0), max(order.count - 1, 0)) : 0
    let fy = pageH > 0 ? (mid.y - topOf(i)) / pageH : 0
    let fx = pageW > 0 ? (mid.x - left) / pageW : 0.5
    if abs(base - 1) > 0.005, abs(z - 1) < 0.005 { lastZoom = base }
    base = z
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    layOut()
    let o = CGPoint(x: onPixel(left + fx * pageW - v.width / 2), y: onPixel(topOf(i) + fy * pageH - v.height / 2))
    rebasing = true
    scroll.contentOffset = clamp(o)
    rebasing = false
    drawMarks()
    CATransaction.commit()
    zoomEndedAt = ProcessInfo.processInfo.systemUptime
    sharpAfter = nil
    zoomed()
  }

  private func zoomed() {
    tend()
    say(force: true)
    plugin.emit(["kind": "surface", "id": id, "what": "zoomed", "zoom": Double((base * 1000).rounded() / 1000)])
    if picked != nil { tellPicked() }
  }

  // ── the scroll view's ──

  func viewForZooming(in scrollView: UIScrollView) -> UIView? { scrollView === scroll ? content : nil }

  func scrollViewDidZoom(_ scrollView: UIScrollView) {
    guard scrollView === scroll, !rebasing else { return }
    centre()
    saySoon()
  }

  func scrollViewWillBeginZooming(_ scrollView: UIScrollView, with view: UIView?) {
    guard scrollView === scroll else { return }
    stir(true)
  }

  func scrollViewDidEndZooming(_ scrollView: UIScrollView, with view: UIView?, atScale scale: CGFloat) {
    guard scrollView === scroll, !rebasing else { return }
    rebase()
    if !settling { stir(false) }
  }

  func scrollViewDidScroll(_ scrollView: UIScrollView) {
    guard scrollView === scroll, !rebasing else { return }
    tend()
    saySoon()
  }

  func scrollViewWillBeginDragging(_ scrollView: UIScrollView) { if scrollView === scroll { stir(true) } }
  func scrollViewDidEndDragging(_ scrollView: UIScrollView, willDecelerate decelerate: Bool) { if scrollView === scroll, !decelerate { stir(false) } }
  func scrollViewDidEndDecelerating(_ scrollView: UIScrollView) { if scrollView === scroll { stir(false) } }
  func scrollViewDidEndScrollingAnimation(_ scrollView: UIScrollView) { if scrollView === scroll { stir(false) } }

  /// The pages begin to move, or have come to rest: what the page laid on them goes while they move, and is told where they are after.
  private func stir(_ on: Bool) {
    if on == moving {
      if !on { say(force: true) }
      return
    }
    moving = on
    cut()
    if on {
      plugin.emit(["kind": "surface", "id": id, "what": "moving"])
    } else {
      tend()
      say(force: true)
      if picked != nil { tellPicked() }
    }
  }

  private var phase: String {
    if scroll.isZooming || scroll.isZoomBouncing { return "zooming" }
    if scroll.isDragging { return "dragging" }
    if scroll.isDecelerating { return "coasting" }
    return moving ? "moving" : "rest"
  }

  /// The page in view: the last whose top is above a little under the top of the view.
  private func pageInView() -> Int {
    let r = max(scroll.zoomScale, 0.01)
    let y = (scroll.contentOffset.y + 48) / r
    let step = pageH + gap
    guard step > 0, !order.isEmpty else { return 1 }
    return min(max(Int(((y - top) / step).rounded(.down)), 0), order.count - 1) + 1
  }

  /// The page hears where the pages are: at most ten times a second while they move, and once when they rest.
  private func saySoon() {
    let now = ProcessInfo.processInfo.systemUptime
    if now - saidAt >= 0.1 { say(force: false); return }
    if sayLater != nil { return }
    let item = DispatchWorkItem { [weak self] in self?.sayLater = nil; self?.say(force: false) }
    sayLater = item
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1, execute: item)
  }

  private func say(force: Bool) {
    saidAt = ProcessInfo.processInfo.systemUptime
    let p = place()
    let z = Double((base * scroll.zoomScale * 100).rounded() / 100)
    var m: [String: Any] = ["kind": "surface", "id": id, "what": "view", "page": pageInView(), "pages": order.count, "zoom": z, "top": p.page, "y": (p.y * 10000).rounded() / 10000, "x": ((p.x ?? 0.5) * 10000).rounded() / 10000, "moving": moving]
    // where the first sheet lies on the surface, and how far it is from one sheet's top to the next's: every sheet's place follows
    let r0 = content.convert(CGRect(x: left, y: top, width: pageW, height: pageH), to: view)
    let pitch = (pageH + gap) * scroll.zoomScale
    m["lay"] = [Double(r0.minX), Double(r0.minY), Double(r0.width), Double(r0.height), Double(pitch)].map { ($0 * 100).rounded() / 100 }
    if !moving, let r = pendingRect {
      let on = content.convert(r, to: view)
      m["pend"] = ["x": Double(on.minX), "y": Double(on.minY), "w": Double(on.width), "h": Double(on.height)]
    }
    let text = "\(m["page"]!) \(m["pages"]!) \(z) \(p.page) \(m["y"]!) \(m["x"]!) \(moving) \(String(describing: m["pend"])) \(String(describing: m["lay"]))"
    if !force, text == said { return }
    said = text
    plugin.emit(m)
  }

  // ── the pictures ──

  private func visible() -> CGRect {
    if guest { return scroll.convert(scroll.bounds, to: content) }
    let r = max(scroll.zoomScale, 0.01)
    return CGRect(x: scroll.contentOffset.x / r, y: scroll.contentOffset.y / r, width: scroll.bounds.width / r, height: scroll.bounds.height / r)
  }

  /// Every sheet near the view has its strokes and its pictures; one far from it gives its pictures back.
  func tend() {
    guard made, pageH > 0 || guest else { return }
    let vis = visible()
    let near = vis.insetBy(dx: 0, dy: -vis.height * 1.2)
    let far = vis.insetBy(dx: 0, dy: -vis.height * 3)
    var want: [String] = []
    for l in leaves.values {
      let f = l.frame
      if f.maxY >= near.minY, f.minY <= near.maxY {
        if !l.loaded, !l.asked { l.asked = true; want.append(l.id) }
        if guest { guestRefresh(l, vis: vis) } else { refresh(l, vis: vis) }
      } else {
        // (a pageless notebook's stroke is kept on the sheet its top lies on and may run down into the view from a
        // sheet well above it: those sheets are given their strokes, no pictures, so what runs on from them is drawn)
        if paper.run, !l.loaded, !l.asked, f.maxY < near.minY, f.maxY >= near.minY - CGFloat(NoteSurface.runsOver) * pageH { l.asked = true; want.append(l.id) }
      }
      if f.maxY < far.minY || f.minY > far.maxY {
        if l.rest.contents != nil || !l.patches.isEmpty || l.fine.contents != nil {
          CATransaction.begin()
          CATransaction.setDisableActions(true)
          l.rest.contents = nil
          l.fine.contents = nil
          l.fine.isHidden = true
          l.restKey = nil; l.fineKey = nil; l.restAsked = nil; l.fineAsked = nil
          for p in l.patches { p.layer.removeFromSuperlayer() }
          l.patches = []
          CATransaction.commit()
        }
      }
    }
    if !want.isEmpty { plugin.emit(["kind": "surface", "id": id, "what": "want", "sheets": want]) }
  }

  private func job(_ l: Leaf, region: CGRect, pw: Int, ph: Int) -> PaintJob {
    var strokes = l.geoms
    if !l.lifted.isEmpty { strokes = strokes.enumerated().filter { !l.lifted.contains($0.offset) }.map { $0.element } }
    // what was written on the sheets before and runs on over this one: a stroke is kept on the sheet its top lies
    // on, however far down it goes
    var above: [(g: Geom, up: CGFloat)] = []
    if paper.run {
      var d = min(l.index, NoteSurface.runsOver)
      while d >= 1 {
        if let before = leaves[order[l.index - d]] {
          let up = CGFloat(d) * CGFloat(paper.h)
          for (i, g) in before.geoms.enumerated() where g.box.maxY > up && !before.lifted.contains(i) { above.append((g, up)) }
        }
        d -= 1
      }
    }
    if guest {
      // (a book's page: its ink alone, laid on the page as ink is)
      var pa = paper
      pa.kind = "blank"; pa.run = false; pa.w = Double(l.pts.width); pa.h = Double(l.pts.height)
      var j = PaintJob(paper: pa, look: look, index: l.index, strokes: strokes, above: [], region: region, pw: pw, ph: ph)
      j.bare = true
      return j
    }
    return PaintJob(paper: paper, look: look, index: l.index, strokes: strokes, above: above, region: region, pw: pw, ph: ph)
  }

  /// A book's page's pictures of its ink: the whole of it at the fitted size, and zoomed in, the part in view at the
  /// zoom (the book's zoom is its scroll view's own: these are stretched while it moves, and made again at rest).
  private func guestRefresh(_ l: Leaf, vis: CGRect) {
    // (nothing written on the page: no picture at all, not a clear one laid over it; most pages of a book)
    if l.geoms.isEmpty || l.lifted.count == l.geoms.count {
      if l.rest.contents != nil || l.fine.contents != nil || !l.patches.isEmpty {
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        l.rest.contents = nil
        l.fine.contents = nil
        l.fine.isHidden = true
        for q in l.patches { q.layer.removeFromSuperlayer() }
        l.patches = []
        CATransaction.commit()
      }
      l.restKey = nil; l.fineKey = nil; l.restAsked = nil; l.fineAsked = nil
      return
    }
    let zooming = !steady
    let z = scroll.zoomScale
    let fw = (l.frame.width * screen).rounded(), fh = (l.frame.height * screen).rounded()
    let f = fw * fh > NoteSurface.cap ? (NoteSurface.cap / (fw * fh)).squareRoot() : 1
    // (at the fitted size, a pixel for a pixel and on the screen's pixels: a pixel more each way, its corner the
    // fraction before the page's; at another size it is stretched whatever it is drawn on)
    let ph0 = f >= 1 && abs(z - 1) < 0.0005 ? phase(l) : .zero
    let pw = max(1, Int((fw * f).rounded()) + (ph0 == .zero ? 0 : 1)), ph = max(1, Int((fh * f).rounded()) + (ph0 == .zero ? 0 : 1))
    let key = [l.ver, pw, ph, Int(ph0.x * 64), Int(ph0.y * 64)]
    if l.restKey != key, l.restAsked != key, !(zooming && l.rest.contents != nil && l.restKey?[0] == l.ver) {
      l.restAsked = key
      let k = CGFloat(pw) / max(1, fw * f + (ph0 == .zero ? 0 : 1))
      let per = screen * f * k * sOf(l)
      let region = CGRect(x: -ph0.x / per, y: -ph0.y / per, width: CGFloat(pw) / per, height: CGFloat(ph) / per)
      paint(job(l, region: ph0 == .zero ? CGRect(origin: .zero, size: l.pts) : region, pw: pw, ph: ph)) { [weak self, weak l] img in
        guard let self = self, let l = l, l.restAsked == key, let img = img else { return }
        l.restAsked = nil
        l.restKey = key
        l.rest.frame = ph0 == .zero ? l.bounds : self.onLeaf(region, l)
        l.rest.contents = img
        self.settle(l)
      }
    }
    // the whole picture is as sharp as the screen shows it: nothing more is drawn
    if f >= 1 && abs(z - 1) < 0.0005 {
      if !l.fine.isHidden { l.fine.isHidden = true; l.fine.contents = nil; l.fineKey = nil; l.fineAsked = nil; settle(l) }
      return
    }
    if zooming { return }
    let part = vis.intersection(l.frame)
    if part.isNull || part.width <= 0 || part.height <= 0 {
      if !l.fine.isHidden, l.fineKey?[0] != l.ver { l.fine.isHidden = true; l.fine.contents = nil; l.fineKey = nil; l.fineAsked = nil; settle(l) }
      return
    }
    let zk = Int((z * 100000).rounded())
    let fp = phase(l)
    if l.fineKey?[0] == l.ver, l.fineKey?[5] == zk, l.fineKey?[6] == Int(fp.x * 64), l.fineKey?[7] == Int(fp.y * 64), !l.fine.isHidden, onLeaf(l.fineRegion, l).offsetBy(dx: l.frame.minX, dy: l.frame.minY).insetBy(dx: -0.5, dy: -0.5).contains(part) { return }
    // (the part in view and a little round it, in the sheet's view's points, drawn at the screen's pixels at this zoom)
    let grown = part.insetBy(dx: -vis.width * 0.2, dy: -vis.height * 0.2).intersection(l.frame).offsetBy(dx: -l.frame.minX, dy: -l.frame.minY)
    let px = screen * z
    // (its pixels the screen's: each edge where the screen has one, the page's corner `fp` off them)
    let x0 = (grown.minX * px + fp.x).rounded(.down) - fp.x, y0 = (grown.minY * px + fp.y).rounded(.down) - fp.y
    let x1 = (grown.maxX * px + fp.x).rounded(.up) - fp.x, y1 = (grown.maxY * px + fp.y).rounded(.up) - fp.y
    let fkey = [l.ver, Int(x0.rounded()), Int(y0.rounded()), Int((x1 - x0).rounded()), Int((y1 - y0).rounded()), zk, Int(fp.x * 64), Int(fp.y * 64)]
    if l.fineAsked == fkey || l.fineKey == fkey { return }
    l.fineAsked = fkey
    let sl = sOf(l)
    let region = CGRect(x: x0 / px / sl, y: y0 / px / sl, width: (x1 - x0) / px / sl, height: (y1 - y0) / px / sl)
    // (nothing written in view: the whole picture, coarse, has nothing there to be coarse)
    if !l.geoms.contains(where: { $0.box.intersects(region) }) {
      if !l.fine.isHidden { l.fine.isHidden = true; l.fine.contents = nil; l.fineKey = nil; l.fineAsked = nil; settle(l) }
      return
    }
    paint(job(l, region: region, pw: Int((x1 - x0).rounded()), ph: Int((y1 - y0).rounded()))) { [weak self, weak l] img in
      guard let self = self, let l = l, l.fineAsked == fkey, let img = img else { return }
      l.fineAsked = nil
      l.fineKey = fkey
      l.fineRegion = region
      CATransaction.begin()
      CATransaction.setDisableActions(true)
      l.fine.contents = img
      l.fine.frame = self.onLeaf(region, l)
      l.fine.isHidden = false
      CATransaction.commit()
      self.settle(l)
    }
  }

  /// A book's pages, where the book lays them (in its content, at its fitted size) and their size in their points:
  /// each a sheet, `p.<key>.<page>`. `dark`: the ink lightens what is under it.
  func lay(key k: String, pages: [(n: Int, frame: CGRect, pts: CGSize)], dark: Bool) {
    guard guest else { return }
    if k != key {
      key = k
      for l in leaves.values { l.id = "p.\(k).\(l.sheet)" }
    }
    if dark != look.dark {
      look.dark = dark
      for l in leaves.values { l.cache = [:]; regeom(l); l.ver += 1; l.restKey = nil; l.fineKey = nil; l.restAsked = nil; l.fineAsked = nil }
    }
    let blend = dark ? "screenBlendMode" : "multiplyBlendMode"
    canvas.overrideUserInterfaceStyle = dark ? .dark : .light
    canvas.layer.compositingFilter = blend
    let list = pages.map { $0.n }
    var next: [Int: Leaf] = [:]
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    for (i, p) in pages.enumerated() {
      let l = leaves[p.n] ?? {
        let fresh = Leaf(sheet: p.n, id: "p.\(key).\(p.n)")
        fresh.backgroundColor = .clear
        fresh.isOpaque = false
        fresh.rest.isOpaque = false
        fresh.fine.isOpaque = false
        fresh.layer.zPosition = 20
        content.insertSubview(fresh, belowSubview: marks)
        return fresh
      }()
      l.index = i
      if l.frame != p.frame || l.pts != p.pts {
        let resized = l.frame.size != p.frame.size
        l.frame = p.frame
        l.pts = p.pts
        l.sc = p.frame.width / max(1, p.pts.width)
        l.rest.frame = l.bounds
        if resized {
          // (laid out at another size: its pictures are made again; the one there stays, stretched, until then)
          l.ver += 1
          if !l.fine.isHidden { l.fine.frame = onLeaf(l.fineRegion, l) }
          for q in l.patches { q.layer.frame = onLeaf(q.region, l) }
          veil(l)
        }
      }
      l.layer.compositingFilter = blend
      next[p.n] = l
    }
    for (n, l) in leaves where next[n] == nil { retire(l) }
    leaves = next
    order = list
    marks.frame = content.bounds
    CATransaction.commit()
    placeCanvas()
    tend()
  }

  /// (a book's page) Where its corner falls between the screen's pixels, as a fraction of one each way. The book's
  /// scroll and zoom are its scroll view's own, so a page lies wherever they leave it, a fraction of a pixel off as
  /// often as not; a picture drawn a pixel for a pixel and shown that far off is drawn again by the screen between
  /// pixels, and a thin line comes out wider and paler than the stroke written (2026-11-22: "when pen strokes are
  /// pretty thin, it's as if the opacity goes down a little bit"). So its pictures are drawn on the screen's own
  /// pixels as the page lies at rest: read then, and kept while the pages move (nothing is drawn again for it then).
  private func phase(_ l: Leaf) -> CGPoint {
    guard guest, steady, !scroll.isDragging, !scroll.isDecelerating, l.window != nil else { return l.phase }
    let o = l.convert(CGPoint.zero, to: nil)
    let sc = screen
    func frac(_ v: CGFloat) -> CGFloat { let f = v * sc - (v * sc).rounded(.down); return (f * 64).rounded() / 64 }
    l.phase = CGPoint(x: frac(o.x).truncatingRemainder(dividingBy: 1), y: frac(o.y).truncatingRemainder(dividingBy: 1))
    return l.phase
  }

  /// A book's zoom has ended: the canvas told it, and the pictures made at it.
  func zoomEnded() {
    guard guest else { return }
    placeCanvas()
    tend()
    if picked != nil { ring(); tellPicked() }
  }

  /// A sheet's pictures asked for, where it has none as it is now: the whole of it, and zoomed past what that holds, the part in view.
  private func refresh(_ l: Leaf, vis: CGRect) {
    // (the pictures are of the sheets as they are laid out: while a zoom stretches them nothing is made but what has none)
    let zooming = abs(scroll.zoomScale - 1) > 0.0005
    let fw = (pageW * screen).rounded(), fh = (pageH * screen).rounded()
    let f = fw * fh > NoteSurface.cap ? (NoteSurface.cap / (fw * fh)).squareRoot() : 1
    let pw = max(1, Int((fw * f).rounded())), ph = max(1, Int((fh * f).rounded()))
    let key = [l.ver, pw, ph]
    if l.restKey != key, l.restAsked != key, !(zooming && l.rest.contents != nil && l.restKey?[0] == l.ver) {
      l.restAsked = key
      paint(job(l, region: CGRect(x: 0, y: 0, width: CGFloat(paper.w), height: CGFloat(paper.h)), pw: pw, ph: ph)) { [weak self, weak l] img in
        guard let self = self, let l = l, l.restAsked == key, let img = img else { return }
        l.restAsked = nil
        l.restKey = key
        l.rest.contents = img
        self.settle(l)
      }
    }
    if f >= 1 {
      if !l.fine.isHidden { l.fine.isHidden = true; l.fine.contents = nil; l.fineKey = nil; l.fineAsked = nil }
      return
    }
    if zooming { return }
    // the part of the sheet in view, and a little round it, on whole pixels of the screen
    let part = vis.intersection(l.frame)
    if part.isNull || part.width <= 0 || part.height <= 0 {
      // out of view, the part drawn fine is of the sheet as it was: it goes, and with it nothing is left to wait for
      if !l.fine.isHidden, l.fineKey?[0] != l.ver { l.fine.isHidden = true; l.fine.contents = nil; l.fineKey = nil; l.fineAsked = nil; settle(l) }
      return
    }
    if l.fineKey?[0] == l.ver, l.fineKey?[5] == Int((s * 100000).rounded()), !l.fine.isHidden, onLeaf(l.fineRegion).offsetBy(dx: l.frame.minX, dy: l.frame.minY).insetBy(dx: -0.5, dy: -0.5).contains(part) { return }
    let grown = part.insetBy(dx: -vis.width * 0.2, dy: -vis.height * 0.2).intersection(l.frame).offsetBy(dx: -l.frame.minX, dy: -l.frame.minY)
    let x0 = (grown.minX * screen).rounded(.down), y0 = (grown.minY * screen).rounded(.down)
    let x1 = (grown.maxX * screen).rounded(.up), y1 = (grown.maxY * screen).rounded(.up)
    let fkey = [l.ver, Int(x0), Int(y0), Int(x1 - x0), Int(y1 - y0), Int((s * 100000).rounded())]
    if l.fineAsked == fkey || l.fineKey == fkey { return }
    l.fineAsked = fkey
    let region = CGRect(x: x0 / screen / s, y: y0 / screen / s, width: (x1 - x0) / screen / s, height: (y1 - y0) / screen / s)
    paint(job(l, region: region, pw: Int(x1 - x0), ph: Int(y1 - y0))) { [weak self, weak l] img in
      guard let self = self, let l = l, l.fineAsked == fkey, let img = img else { return }
      l.fineAsked = nil
      l.fineKey = fkey
      l.fineRegion = region
      CATransaction.begin()
      CATransaction.setDisableActions(true)
      l.fine.contents = img
      l.fine.frame = self.onLeaf(region)
      l.fine.isHidden = false
      CATransaction.commit()
      self.settle(l)
    }
  }

  /// How many sheets past its own a pageless notebook's stroke is looked for: drawn, rubbed out and picked up there.
  static let runsOver = 8

  /// The sheets after `l` its strokes run on over (a pageless notebook's), nearest first: those `low` reaches, in
  /// the sheet's points, and always the next.
  private func under(_ l: Leaf, low: CGFloat) -> [(leaf: Leaf, up: CGFloat)] {
    guard paper.run else { return [] }
    let h = CGFloat(paper.h)
    var out: [(Leaf, CGFloat)] = []
    var d = 1
    while d <= NoteSurface.runsOver, l.index + d < order.count, d == 1 || low > CGFloat(d) * h {
      if let next = leaves[order[l.index + d]] { out.append((next, CGFloat(d) * h)) }
      d += 1
    }
    return out
  }

  /// A picture made off the main thread, and handed back on it.
  private func paint(_ j: PaintJob, then: @escaping (CGImage?) -> Void) {
    making += 1
    painters.addOperation { [weak self] in
      let img = Paint.make(j)
      DispatchQueue.main.async {
        guard let self = self else { return }
        self.making -= 1
        then(img)
        if self.making == 0, self.zoomEndedAt > 0, self.sharpAfter == nil { self.sharpAfter = (ProcessInfo.processInfo.systemUptime - self.zoomEndedAt) * 1000 }
      }
    }
  }

  /// A sheet's pictures are as it is now: the patches drawn over them meanwhile go.
  private func settle(_ l: Leaf) {
    defer { if guest { veil(l) } }
    let fineOn = !l.fine.isHidden || l.fineAsked != nil
    let v = min(l.restKey?[0] ?? -1, fineOn ? (l.fineKey?[0] ?? -1) : Int.max)
    let gone = l.patches.filter { $0.ver <= v }
    if gone.isEmpty { return }
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    for p in gone { p.layer.removeFromSuperlayer() }
    l.patches.removeAll { $0.ver <= v }
    CATransaction.commit()
  }

  /// (a book's page) Its pictures are clear where nothing is written, so one over another does not hide it: the
  /// whole picture, coarse at a zoom, showed round the edge of the sharp one over it, and an erased stroke through a
  /// patch, a blur round the ink (2026-11-22, "the ink blurs after i write with it"). Each is cut away under what
  /// lies over it: the whole picture under the part drawn at the zoom and under the patches, that part under the patches.
  private func veil(_ l: Leaf) {
    func mask(_ layer: CALayer, _ holes: [CGRect]) {
      let hs = holes.map { $0.offsetBy(dx: -layer.frame.minX, dy: -layer.frame.minY).intersection(layer.bounds) }.filter { !$0.isNull && $0.width > 0 && $0.height > 0 }
      if hs.isEmpty { layer.mask = nil; return }
      let path = UIBezierPath(rect: layer.bounds)
      for h in hs { path.append(UIBezierPath(rect: h)) }
      let m = (layer.mask as? CAShapeLayer) ?? CAShapeLayer()
      m.actions = ["path": NSNull(), "bounds": NSNull(), "position": NSNull()]
      m.fillRule = .evenOdd
      m.frame = layer.bounds
      m.path = path.cgPath
      layer.mask = m
    }
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    let patches = l.patches.map { $0.layer.frame }
    let fineOn = !l.fine.isHidden && l.fine.contents != nil
    mask(l.rest, patches + (fineOn ? [l.fine.frame] : []))
    if fineOn { mask(l.fine, patches) } else { l.fine.mask = nil }
    CATransaction.commit()
  }

  /// A part of a sheet (in its points) drawn again now, over its pictures: what was just written, erased or moved is on the glass before the pictures are made again.
  private func patch(_ l: Leaf, _ dirty: CGRect) {
    let whole = CGRect(origin: .zero, size: sizeOf(l))
    let d = dirty.insetBy(dx: -2, dy: -2).intersection(whole)
    if d.isNull || d.width <= 0 || d.height <= 0 { return }
    let s = ks(l)
    let pp = guest ? phase(l) : .zero
    let x0 = (d.minX * s * screen + pp.x).rounded(.down) - pp.x, y0 = (d.minY * s * screen + pp.y).rounded(.down) - pp.y
    let x1 = (d.maxX * s * screen + pp.x).rounded(.up) - pp.x, y1 = (d.maxY * s * screen + pp.y).rounded(.up) - pp.y
    // (a large part is drawn at once with fewer pixels, four million at most, and sharp a moment later with the
    // sheet's pictures, off the main thread: what the eraser took is off the glass in this turn whatever its size;
    // until 2026-11-22 a part that large was left to the pictures alone)
    let area = (x1 - x0) * (y1 - y0)
    let fewer = area > 4_000_000 ? sqrt(4_000_000 / area) : 1
    if fewer < 1 { plugin.eraseSkipped += 1 }
    let t0 = ProcessInfo.processInfo.systemUptime
    defer { plugin.erasePatch.append((ProcessInfo.processInfo.systemUptime - t0) * 1000); plugin.erasePatchPx.append(Int(area * fewer * fewer)) }
    let region = CGRect(x: x0 / screen / s, y: y0 / screen / s, width: (x1 - x0) / screen / s, height: (y1 - y0) / screen / s)
    guard let img = Paint.make(job(l, region: region, pw: max(1, Int(((x1 - x0) * fewer).rounded())), ph: max(1, Int(((y1 - y0) * fewer).rounded())))) else { return }
    let layer = CALayer()
    layer.actions = ["contents": NSNull(), "bounds": NSNull(), "position": NSNull()]
    layer.isOpaque = !guest
    layer.contentsGravity = .resize
    layer.zPosition = 2
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    layer.frame = onLeaf(region, l)
    layer.contents = img
    l.layer.addSublayer(layer)
    CATransaction.commit()
    l.patches.append((layer, region, l.ver))
    if guest { veil(l) }
  }

  /// Each of a sheet's strokes made ready to draw; one it had is the one it has.
  private func regeom(_ l: Leaf) {
    var next: [StrokeMark: Geom] = [:]
    var out: [Geom] = []
    out.reserveCapacity(l.model.count)
    var kept: [PKStroke] = []
    for k in l.model {
      let m = StrokeMark(k)
      guard let g = l.cache[m] ?? next[m] ?? Geom(k, dark: look.dark) else { continue }
      next[m] = g
      out.append(g)
      kept.append(k)
    }
    l.cache = next
    l.geoms = out
    l.model = kept
  }

  /// A sheet holds these strokes from now on: drawn at once where they differ (`dirty`, in its points), and its pictures made again.
  private func put(_ l: Leaf, _ strokes: [PKStroke], dirty: CGRect?, told: Bool = true) {
    l.model = strokes
    regeom(l)
    l.ver += 1
    if let d = dirty { patch(l, d) }
    // (a pageless sheet's strokes run on over the next, and a tall one over those after: as far as they reach now,
    // or reached before this)
    let low = l.geoms.map({ $0.box.maxY }).max()
    let reached = max(low ?? 0, l.low, dirty?.maxY ?? 0)
    l.low = low ?? 0
    for n in under(l, low: reached) {
      n.leaf.ver += 1
      if let d = dirty, d.maxY > n.up { patch(n.leaf, d.offsetBy(dx: 0, dy: -n.up)) }
    }
    // (and the long sheet is a little longer than what is written on it)
    if paper.run, let low = low { reach(Double(l.index) * paper.h + Double(low)) }
    tend()
    if told {
      let now = l.model.map { StrokeMark($0) }
      l.dirty = now != l.given
      changed(l)
    }
  }

  private func changed(_ l: Leaf) {
    plugin.historySoon()
    if !(down && active === l), ProcessInfo.processInfo.systemUptime < plugin.hurry { plugin.keepSoon(); return }
    wait(l)
  }

  private func wait(_ l: Leaf) {
    l.quiet?.cancel()
    let item = DispatchWorkItem { [weak self, weak l] in
      guard let self = self, let l = l else { return }
      if self.down && self.active === l { return }
      if l.dirty { self.plugin.emit(["kind": "quiet", "sheet": l.id]) }
    }
    l.quiet = item
    DispatchQueue.main.asyncAfter(deadline: .now() + plugin.quietAfter, execute: item)
  }

  private func box(of strokes: [PKStroke]) -> CGRect? {
    var b: CGRect?
    for k in strokes { b = b.map { $0.union(k.renderBounds) } ?? k.renderBounds }
    return b
  }

  /// A step of what was done on a sheet: undone, it holds `before` again.
  private func step(_ l: Leaf, from before: [PKStroke], to after: [PKStroke]) {
    // (what the lasso's hold moved between sheets is undone with this, under it: registered in one turn, one step)
    if !regroup.isEmpty {
      let moved = regroup
      regroup = []
      for g in moved {
        register(g.leaf, from: g.before, to: g.after)
        g.leaf.dirty = g.leaf.model.map { StrokeMark($0) } != g.leaf.given
        changed(g.leaf)
      }
    }
    register(l, from: before, to: after)
  }

  private func register(_ l: Leaf, from before: [PKStroke], to after: [PKStroke]) {
    l.stepped = true
    plugin.history.registerUndo(withTarget: self) { [weak l] me in
      guard let l = l, me.leaves[l.sheet] === l else { return }
      me.unpick()
      me.put(l, before, dirty: me.box(of: before + after))
      me.step(l, from: after, to: before)
    }
    plugin.historySoon()
  }

  /// Where the sheets run on as one, a stroke is kept on the sheet its top lies on. `after` is what a sheet is to
  /// hold, `moved` those of it just written, dropped or put down: when the top of what they cover has left the
  /// sheet they go, together, to the sheet it lies on (in that sheet's points), in the same step to undo. Says the
  /// sheet they are on and which of its strokes they are.
  /// `quiet`: nothing to undo and nothing to keep (the lasso's hold, `regroup`).
  @discardableResult
  private func commit(_ l: Leaf, from before: [PKStroke], to after: [PKStroke], moved: [Int], dirty: CGRect?, quiet: Bool = false) -> (leaf: Leaf, at: [Int]) {
    let h = CGFloat(paper.h)
    if paper.run, h > 0, !moved.isEmpty, let b = box(of: moved.filter { $0 < after.count }.map { after[$0] }) {
      // (the long sheet reaches under them first: the sheet they go to is there to take them)
      reach(Double(l.index) * paper.h + Double(b.maxY))
      let t = min(max(l.index + Int((b.minY / h).rounded(.down)), 0), order.count - 1)
      // (only onto a sheet whose strokes are here: one not yet given them would lose them)
      if t != l.index, let dest = leaves[order[t]], dest.loaded, !dest.isHidden {
        let dy = CGFloat(l.index - t) * h
        let going = Set(moved)
        let gone = moved.filter { $0 < after.count }.map { i -> PKStroke in var m = after[i]; m.transform = m.transform.concatenating(CGAffineTransform(translationX: 0, y: dy)); return m }
        let stay = after.enumerated().filter { !going.contains($0.offset) }.map { $0.element }
        let was = dest.model
        put(l, stay, dirty: dirty, told: !quiet)
        put(dest, was + gone, dirty: dirty?.offsetBy(dx: 0, dy: dy), told: !quiet)
        if !quiet {
          step(l, from: before, to: l.model)
          step(dest, from: was, to: dest.model)
        }
        return (dest, Array(was.count..<dest.model.count))
      }
    }
    put(l, after, dirty: dirty, told: !quiet)
    if !quiet { step(l, from: before, to: l.model) }
    return (l, moved)
  }

  // ── what the plugin asks ──

  func leaf(named id: String) -> Leaf? { leaves.values.first { $0.id == id } }

  /// What the store holds of a sheet. False when it is being written on, or holds what was not yet kept.
  func fill(_ l: Leaf, _ d: PKDrawing) -> Bool {
    // (the store's word on a sheet the lasso's hold had rearranged: the hold goes, and the sheets are as they were)
    if regroup.contains(where: { $0.leaf === l }) { unpick() }
    if l.dirty || (down && active === l) { return false }
    let marks = d.strokes.map { StrokeMark($0) }
    l.loaded = true
    if marks == l.model.map({ StrokeMark($0) }) { l.given = marks; return true }
    if l.stepped { plugin.forget() }
    if picked?.leaf === l { unpick() }
    l.given = marks
    put(l, d.strokes, dirty: nil, told: false)
    l.dirty = false
    return true
  }

  func taken(_ l: Leaf) -> (Int, String?) {
    var data: String?
    // (what the lasso's hold moved between sheets is not kept until something is done with it: kept on one sheet
    // and not the other, a stroke would be in the store twice or not at all)
    let model = regroup.first(where: { $0.leaf === l })?.before ?? l.model
    if l.dirty && !(down && active === l) {
      l.dirty = false
      l.given = model.map { StrokeMark($0) }
      data = PKDrawing(strokes: model).dataRepresentation().base64EncodedString()
    }
    return (model.count, data)
  }

  func dirtyLeaves() -> [Leaf] { leaves.values.filter { $0.dirty && !(down && active === $0) } }
  var isDown: Bool { down }
  var selected: Int { picked?.at.count ?? 0 }

  func toolChanged() {
    if down, let l = active, doing != nil { finish(l); spent = true }
    unpick()
    canvas.tool = LiveInk.unseen(plugin.ink, scaled: true)
    setTouchTypes()
  }

  func setTouchTypes() {
    watch?.allowedTouchTypes = plugin.penTypes
    canvas.drawingPolicy = plugin.fingerWrites ? .anyInput : .pencilOnly
    // where a finger writes, two scroll
    scroll.panGestureRecognizer.minimumNumberOfTouches = plugin.fingerWrites ? 2 : 1
  }

  /// A dev run's: a stroke as if written.
  func write(_ l: Leaf, _ k: PKStroke, rest: Bool) {
    let before = l.model
    let on = commit(l, from: before, to: before + [k], moved: [before.count], dirty: k.renderBounds).leaf
    if rest, plugin.tool.snap == true {
      DispatchQueue.main.async { [weak self, weak on] in if let self = self, let l = on { self.shape(l) } }
    }
  }

  /// A dev run's: a stroke of a sheet (its points) given to the canvas as if PencilKit had just taken it from the
  /// Pencil there: it comes to the sheet the way a written one does (`canvasViewDrawingDidChange`), pressure and all.
  func hand(_ l: Leaf, _ k: PKStroke) {
    var m = k
    m.transform = k.transform.concatenating(canvasTo(l).inverted())
    lastActive = l
    canvas.drawing = PKDrawing(strokes: canvas.drawing.strokes + [m])
  }

  func wipe(_ l: Leaf) { put(l, [], dirty: box(of: l.model)) }

  /// The surface as it is shown now, as a JPEG: what the page shows in its place while it stands aside.
  func picture() -> String? {
    let b = scroll.bounds.size
    guard b.width > 0, b.height > 0 else { return nil }
    let format = UIGraphicsImageRendererFormat()
    format.scale = screen
    format.opaque = true
    let img = UIGraphicsImageRenderer(size: b, format: format).image { _ in
      scroll.drawHierarchy(in: CGRect(origin: .zero, size: b), afterScreenUpdates: false)
    }
    return img.jpegData(compressionQuality: 0.9)?.base64EncodedString()
  }

  /// (the checks) A point of the sheet in place `page` (from 1; fractions of it) on the view, and on the web view's glass.
  func whereOn(page: Int, x: Double, y: Double) -> (view: CGPoint, glass: CGPoint)? {
    guard page >= 1, page <= order.count, let l = leaves[order[page - 1]] else { return nil }
    let sz = sizeOf(l), k = sOf(l)
    let v = l.convert(CGPoint(x: CGFloat(x) * sz.width * k, y: CGFloat(y) * sz.height * k), to: view)
    let g = plugin.webView.map { view.convert(v, to: $0.scrollView) } ?? v
    return (v, g)
  }

  /// A dev run's: every picture made, for a capture to be of the sheets as they are.
  func whenSharp(_ f: @escaping () -> Void, tries: Int = 80) {
    tend()
    if (making == 0 && leaves.values.allSatisfy { $0.patches.isEmpty }) || tries <= 0 { f(); return }
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { [weak self] in self?.whenSharp(f, tries: tries - 1) }
  }

  // ── a touch is coming ──

  private func leaf(at p: CGPoint) -> Leaf? {
    if guest { return leaves.values.first { !$0.isHidden && $0.frame.contains(p) } }
    let step = pageH + gap
    guard step > 0, !order.isEmpty, p.x >= left, p.x <= left + pageW else { return nil }
    let i = Int(((p.y - top) / step).rounded(.down))
    guard i >= 0, i < order.count, p.y <= topOf(i) + pageH, let l = leaves[order[i]] else { return nil }
    // (past a pageless notebook's foot there is no paper)
    if paper.run, l.isHidden || p.y > l.frame.maxY { return nil }
    return l
  }

  /// Every touch passes here first: the canvas's recogniser is on only where the Pencil writes.
  func arm(_ point: CGPoint) {
    // the page hears that the pages were touched (once a touch: this is asked more than once for each): what it has
    // open that closes at a press anywhere else, a menu, a tool's settings, closes
    let now = ProcessInfo.processInfo.systemUptime
    if now - touchedAt > 0.12 { plugin.emit(["kind": "surface", "id": id, "what": "touch"]) }
    touchedAt = now
    if down { return }
    let g = canvas.drawingGestureRecognizer
    if g.view !== scroll { scroll.addGestureRecognizer(g) }
    let p = view.convert(point, to: content)
    let on = !plugin.ours && steady && leaf(at: p) != nil
    if g.isEnabled != on { g.isEnabled = on }
  }

  private func isPen(_ t: UITouch) -> Bool { t.type == .pencil || plugin.fingerWrites }

  private func point(_ t: UITouch, in l: Leaf) -> CGPoint {
    let p = t.location(in: l)
    return CGPoint(x: p.x / sOf(l), y: p.y / sOf(l))
  }

  func penDown(_ t: UITouch) {
    // a pen's or a highlighter's stroke: drawn here as it is written, wherever PencilKit takes it (zoomed too, and off
    // the sheets: what PencilKit writes is drawn with no colour, `Live.swift`)
    if LiveInk.ours, isPen(t), plugin.tool.kind == "pen" || plugin.tool.kind == "highlighter" {
      live.scaled = true
      live.begin(plugin.ink, width: CGFloat(plugin.tool.width), sense: plugin.tool.sense.map { CGFloat($0) })
    }
    guard isPen(t), steady else { return }
    let q = t.location(in: content)
    guard var l = leaf(at: q) else { return }
    // what the lasso holds may lie over where two of a pageless notebook's sheets meet: pressed there, it is its own sheet's
    if paper.run, plugin.tool.kind == "select", let k = picked, k.leaf !== l, let b = heldBox() {
      let at = point(t, in: k.leaf)
      if b.insetBy(dx: -8 / s, dy: -8 / s).contains(at) || hypot(at.x - b.maxX, at.y - b.maxY) <= plugin.gripReach / s { l = k.leaf }
    }
    down = true
    active = l
    lastActive = l
    spent = false
    joined = false
    doing = nil
    snap = nil
    l.quiet?.cancel()
    // the Pencil writes: the pages stand still under it (a palm is not a scroll)
    if t.type == .pencil {
      scroll.panGestureRecognizer.isEnabled = false
      scroll.pinchGestureRecognizer?.isEnabled = false
    }
    let p = point(t, in: l)
    let tool = plugin.tool
    // the eraser and the lasso work on what is ours: nothing of PencilKit's is left over it
    if tool.kind == "eraser" || tool.kind == "select" { sweep() }
    if tool.kind == "eraser" {
      unpick()
      doing = .erase(before: [:], last: p)
      erase(l, from: p, to: p)
      ringEraser(at: q)
    } else if tool.kind == "select" {
      if let k = picked, k.leaf === l, let b = heldBox(), hypot(p.x - b.maxX, p.y - b.maxY) <= plugin.gripReach / ks(l) {
        doing = .resize(before: l.model, at: k.at, origin: b.origin, from: p, moved: false)
        lift(l, k.at)
        plugin.emit(["kind": "unpicked", "moving": true])
      } else if let k = picked, k.leaf === l, let b = heldBox(), b.insetBy(dx: -8 / ks(l), dy: -8 / ks(l)).contains(p) {
        doing = .drag(before: l.model, at: k.at, from: p, moved: false)
        lift(l, k.at)
        plugin.emit(["kind": "unpicked", "moving": true])
      } else {
        unpick()
        doing = .loop(points: [p], shown: [q])
        show(loop, path: nil)
        let item = DispatchWorkItem { [weak self, weak l] in
          guard let self = self, let l = l, self.down, self.active === l, !self.spent, case .loop = self.doing else { return }
          self.spent = true
          self.hide(self.loop)
          let on = self.content.convert(q, to: self.view)
          self.plugin.emit(["kind": "rest", "sheet": l.id, "host": self.id, "x": on.x, "y": on.y, "clip": self.plugin.clip.count])
        }
        resting = item
        DispatchQueue.main.asyncAfter(deadline: .now() + plugin.pasteAfter, execute: item)
      }
    } else {
      unpick()
    }
    let on = content.convert(q, to: view)
    plugin.emit(["kind": "begin", "sheet": l.id, "host": id, "fresh": false, "x": on.x, "y": on.y, "top": l.frame.minY])
    if paper.run {
      // a pageless notebook's one sheet never runs out under the Pencil: there is paper below wherever it is put down
      if tool.kind == "pen" || tool.kind == "highlighter" { reach(Double(l.index) * paper.h + Double(p.y)) }
    } else if !guest, l.index == order.count - 1, grown != l.sheet, p.y > CGFloat(paper.h) * 2 / 3, tool.kind == "pen" || tool.kind == "highlighter" {
      // a notebook never runs out of paper: a stroke begun low on its last sheet asks for the next, once for that sheet
      grown = l.sheet
      plugin.emit(["kind": "surface", "id": id, "what": "grow", "sheet": l.sheet])
    }
  }

  func penSample(_ t: UITouch, _ event: UIEvent?, ended: Bool) {
    guard LiveInk.ours, live.writing else { return }
    live.add(t, event, ended: ended)
  }

  func penJoined() {
    // (what began is no stroke: it goes from the glass)
    live.cancel()
    guard down, !spent else { return }
    spent = true
    joined = true
    hide(loop)
    // a second finger beside the one that writes: the two scroll, and what the first began is no stroke
    if doing == nil {
      let g = canvas.drawingGestureRecognizer
      if g.isEnabled { g.isEnabled = false; g.isEnabled = true }
    }
  }

  func penMoved(_ t: UITouch) {
    guard down, let l = active, !spent, let o = doing else { return }
    let q = t.location(in: content)
    let p = point(t, in: l)
    switch o {
    case let .erase(_, last):
      erase(l, from: last, to: p)
      if case let .erase(now, _) = doing { doing = .erase(before: now, last: p) }
      ringEraser(at: q)
    case let .loop(points, shown):
      if let first = shown.first, hypot(q.x - first.x, q.y - first.y) > 8 { resting?.cancel(); resting = nil }
      doing = .loop(points: points + [p], shown: shown + [q])
      let path = UIBezierPath()
      path.move(to: shown[0])
      for at in shown.dropFirst() { path.addLine(to: at) }
      path.addLine(to: q)
      show(loop, path: path.cgPath)
    case let .drag(before, at, from, _):
      let by = CGAffineTransform(translationX: p.x - from.x, y: p.y - from.y)
      carry(l, by)
      doing = .drag(before: before, at: at, from: from, moved: true)
    case let .resize(before, at, origin, from, _):
      let was = hypot(from.x - origin.x, from.y - origin.y)
      let f = min(max(hypot(max(p.x - origin.x, 1), max(p.y - origin.y, 1)) / max(was, 1), 0.1), 12)
      let by = CGAffineTransform(translationX: -origin.x, y: -origin.y).concatenating(CGAffineTransform(scaleX: f, y: f)).concatenating(CGAffineTransform(translationX: origin.x, y: origin.y))
      carry(l, by)
      doing = .resize(before: before, at: at, origin: origin, from: from, moved: true)
    }
  }

  func penUp(rested: TimeInterval) {
    guard down, let l = active else { return }
    down = false
    active = nil
    resting?.cancel()
    resting = nil
    scroll.panGestureRecognizer.isEnabled = true
    scroll.pinchGestureRecognizer?.isEnabled = true
    if doing == nil, !plugin.ours { plugin.lastShape = nil }
    if doing == nil, !plugin.ours, plugin.tool.snap == true, rested >= plugin.restFor {
      snap = (l, ProcessInfo.processInfo.systemUptime + 1.5)
    }
    finish(l)
    plugin.emit(["kind": "end", "sheet": l.id])
    wait(l)
    // what was left on the canvas under the Pencil goes once it has been up a moment (the stroke just ended is handed over by then)
    if taken > 0 {
      swept?.cancel()
      let item = DispatchWorkItem { [weak self] in
        guard let self = self, !self.down, self.taken >= self.canvas.drawing.strokes.count else { return }
        self.sweep()
      }
      swept = item
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.3, execute: item)
    }
  }

  private func finish(_ l: Leaf) {
    guard let o = doing else { return }
    doing = nil
    hide(loop)
    hide(reach)
    switch o {
    case let .erase(before, _):
      // (every sheet it reached, one step to undo: what is registered in one turn is undone together)
      for (sheet, was) in before {
        guard let on = leaves[sheet] else { continue }
        if on.model.count != was.count || on.model.map({ StrokeMark($0) }) != was.map({ StrokeMark($0) }) { step(on, from: was, to: on.model) }
      }
    case let .loop(points, _):
      if !spent { pick(l, within: points) }
    case let .drag(before, at, _, moved), let .resize(before, at, _, _, moved):
      drop(l, at, moved: moved, before: before)
    }
  }

  // ── PencilKit hands a stroke over ──

  func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
    // (the canvas emptied, in the turn the sheets show what it held: what was drawn of it here goes with it)
    if LiveInk.ours, canvasView.drawing.strokes.isEmpty { live.clearGlass() }
    if clearing { return }
    let all = canvasView.drawing.strokes
    if all.count <= taken { taken = all.count; return }
    // PencilKit hands a stroke over a moment after it ends, and by then the next may be under the Pencil:
    // only what it has not handed over before is new
    let strokes = Array(all[taken...])
    defer {
      // the canvas is emptied only with no Pencil on the glass: emptied under one, the stroke being written is lost
      if down { taken = all.count } else { sweep() }
    }
    if joined { joined = false; return }
    // the canvas stands over the view: a point of it is a point of the view, as large as the sheets are laid out
    let o = scroll.contentOffset
    guard let first = strokes.first?.path.first?.location.applying(strokes[0].transform) else { return }
    let at = scroll.convert(CGPoint(x: first.x * canvasK + o.x, y: first.y * canvasK + o.y), to: content)
    guard let l = active ?? lastActive ?? leaf(at: at) else { return }
    let by = canvasTo(l)
    let moved = strokes.map { k -> PKStroke in var m = plugin.keep(k, live: live); m.transform = m.transform.concatenating(by); return m }
    let before = l.model
    let on = commit(l, from: before, to: before + moved, moved: Array(before.count..<before.count + moved.count), dirty: box(of: moved)).leaf
    if let w = snap, w.leaf === l {
      snap = nil
      plugin.lastShape = nil
      // (in the main thread's next turn: a step of its own to undo, the stroke as it was written under it)
      if ProcessInfo.processInfo.systemUptime < w.until, moved.count == 1 {
        let count = on.model.count
        DispatchQueue.main.async { [weak self, weak on] in
          guard let self = self, let l = on, l.model.count == count, !self.down else { return }
          self.shape(l)
        }
      }
    }
  }

  /// PencilKit's own copy of what is ours already taken off the glass (ours is there first: never a frame with neither).
  private func sweep() {
    swept?.cancel()
    swept = nil
    guard taken > 0 || !canvas.drawing.strokes.isEmpty else { return }
    CATransaction.flush()
    clearing = true
    canvas.drawing = PKDrawing()
    clearing = false
    taken = 0
  }

  /// The stroke just written, drawn again as the shape it most nearly is: one more step to undo.
  private func shape(_ l: Leaf) {
    let before = l.model
    guard let k = before.last else { return }
    let marker = k.ink.inkType == .marker
    guard let found = Shapes.find(Shapes.points(of: k), closed: !marker) else { return }
    plugin.lastShape = found.name
    let made = Shapes.strokes(found, from: k)
    let kept = before.count - 1
    let on = commit(l, from: before, to: Array(before.dropLast()) + made, moved: Array(kept..<kept + made.count), dirty: box(of: [k] + made)).leaf
    plugin.emit(["kind": "shape", "sheet": on.id, "shape": found.name])
  }

  // ── the eraser ──

  private func erase(_ l: Leaf, from a: CGPoint, to b: CGPoint) {
    rub(l, from: a, to: b)
    // what was written on the sheets before and runs on over this one (a pageless notebook's) is under the eraser too
    if paper.run {
      var d = 1
      while d <= NoteSurface.runsOver, l.index - d >= 0 {
        if let above = leaves[order[l.index - d]], above.loaded, above.low > CGFloat(d) * CGFloat(paper.h) - 1 {
          let up = CGFloat(d) * CGFloat(paper.h)
          rub(above, from: CGPoint(x: a.x, y: a.y + up), to: CGPoint(x: b.x, y: b.y + up))
        }
        d += 1
      }
    }
  }

  /// The eraser passed over a sheet from `a` to `b`, in its points.
  private func rub(_ l: Leaf, from a: CGPoint, to b: CGPoint) {
    let t0 = ProcessInfo.processInfo.systemUptime
    defer { plugin.eraseNote(hit: (ProcessInfo.processInfo.systemUptime - t0) * 1000) }
    let r = CGFloat(max(plugin.tool.width, 1)) / ks(l)
    let reach = CGRect(x: min(a.x, b.x), y: min(a.y, b.y), width: abs(a.x - b.x), height: abs(a.y - b.y)).insetBy(dx: -r, dy: -r)
    var left: [PKStroke] = []
    var gone: CGRect?
    let part = plugin.tool.mode == "part"
    for k in l.model {
      if !k.renderBounds.intersects(reach) { left.append(k); continue }
      if part {
        if let rest = Shapes.cut(k, from: a, to: b, within: r) { gone = gone.map { $0.union(k.renderBounds) } ?? k.renderBounds; left.append(contentsOf: rest) } else { left.append(k) }
        continue
      }
      var hit = false
      plugin.along(k, by: max(1, r)) { p, half in
        if self.plugin.far(p, from: a, to: b) <= r + half { hit = true }
        return !hit
      }
      if hit { gone = gone.map { $0.union(k.renderBounds) } ?? k.renderBounds } else { left.append(k) }
    }
    guard let d = gone else { return }
    if case let .erase(before, last) = doing, before[l.sheet] == nil {
      var all = before
      all[l.sheet] = l.model
      doing = .erase(before: all, last: last)
    }
    let t1 = ProcessInfo.processInfo.systemUptime
    put(l, left, dirty: d)
    plugin.erasePut.append((ProcessInfo.processInfo.systemUptime - t1) * 1000)
  }

  private func ringEraser(at q: CGPoint) {
    let r = CGFloat(max(plugin.tool.width, 1)) / (guest ? scroll.zoomScale : 1)
    show(reach, path: UIBezierPath(ovalIn: CGRect(x: q.x - r, y: q.y - r, width: r * 2, height: r * 2)).cgPath)
  }

  // ── the lasso ──

  private func pick(_ l: Leaf, within points: [CGPoint]) {
    guard points.count >= 3 else { return }
    let path = UIBezierPath()
    path.move(to: points[0])
    for p in points.dropFirst() { path.addLine(to: p) }
    path.close()
    let b = path.bounds
    if b.width + b.height < 8 / ks(l) { return }
    /// The strokes of a sheet the loop holds, the sheet lying `dy` points below the loop's own.
    func held(_ on: Leaf, _ dy: CGFloat) -> [Int] {
      var at: [Int] = []
      for (i, k) in on.model.enumerated() where k.renderBounds.offsetBy(dx: 0, dy: dy).intersects(b) {
        var all = 0, inside = 0
        plugin.along(k, by: max(2, 4 / ks(on))) { p, _ in
          all += 1
          if path.contains(CGPoint(x: p.x, y: p.y + dy)) { inside += 1 }
          return true
        }
        if all > 0, inside * 2 > all { at.append(i) }
      }
      return at
    }
    var at = held(l, 0)
    var on = l
    if paper.run {
      // one sheet: the loop holds what is in it whichever of the sheets it is kept on, the one before (whose strokes
      // run on over this one) and the one after (which the loop may reach). All of it is then kept on one sheet,
      // the one its top lies on, so it is moved, coloured and cut as one thing
      let h = CGFloat(paper.h)
      var others: [(leaf: Leaf, at: [Int], dy: CGFloat)] = []
      // (the sheets before, as far up as a stroke of theirs runs on to here, and the one after)
      for d in (1...NoteSurface.runsOver).map({ -$0 }) + [1] {
        let i = l.index + d
        guard i >= 0, i < order.count, let n = leaves[order[i]], n.loaded, !n.isHidden else { continue }
        if d < -1, n.low <= CGFloat(-d) * h - 1 { continue }
        let got = held(n, CGFloat(d) * h)
        if !got.isEmpty { others.append((n, got, CGFloat(d) * h)) }
      }
      if !others.isEmpty {
        // (each moved into the loop's sheet's points first; `commit` then takes them where their top lies.
        // Nothing of it is a step to undo or a thing to keep by itself: `regroup`)
        let near = (max(0, l.index - NoteSurface.runsOver)...min(order.count - 1, l.index + 1)).compactMap { leaves[order[$0]] }
        let were = near.map { ($0, $0.model) }
        let before = l.model
        var after = before
        for o in others {
          let mine = Set(o.at)
          let was = o.leaf.model
          for i in o.at { var m = was[i]; m.transform = m.transform.concatenating(CGAffineTransform(translationX: 0, y: o.dy)); after.append(m) }
          put(o.leaf, was.enumerated().filter { !mine.contains($0.offset) }.map { $0.element }, dirty: nil, told: false)
        }
        let got = commit(l, from: before, to: after, moved: at + Array(before.count..<after.count), dirty: nil, quiet: true)
        on = got.leaf
        at = got.at
        regroup = were.filter { $0.0.model.map { StrokeMark($0) } != $0.1.map { StrokeMark($0) } }.map { ($0.0, $0.1, $0.0.model) }
      }
    }
    if at.isEmpty { return }
    picked = (on, at)
    ring()
    tellPicked()
  }

  private func heldBox() -> CGRect? {
    guard let k = picked else { return nil }
    return box(of: k.at.filter { $0 < k.leaf.model.count }.map { k.leaf.model[$0] })
  }

  private func tellPicked() {
    guard let k = picked, let b = heldBox() else { return }
    let on = k.leaf.convert(onLeaf(b, k.leaf), to: view)
    plugin.emit(["kind": "picked", "sheet": k.leaf.id, "host": id, "count": k.at.count, "clip": plugin.clip.count, "x": on.minX, "y": on.minY, "w": on.width, "h": on.height])
  }

  private func ring() {
    guard let k = picked, let b = heldBox() else {
      hide(outline)
      hide(grip)
      return
    }
    let r = k.leaf.convert(onLeaf(b, k.leaf), to: content).insetBy(dx: -4, dy: -4)
    show(outline, path: UIBezierPath(rect: r).cgPath)
    show(grip, path: UIBezierPath(ovalIn: CGRect(x: r.maxX - 7, y: r.maxY - 7, width: 14, height: 14)).cgPath)
  }

  func unpick() {
    if !regroup.isEmpty {
      // nothing was done with what the lasso held: each sheet holds what it held before the hold
      let moved = regroup
      regroup = []
      for g in moved { put(g.leaf, g.before, dirty: nil, told: false) }
    }
    if picked == nil { return }
    picked = nil
    hide(outline)
    hide(grip)
    plugin.emit(["kind": "unpicked"])
  }

  /// What the lasso holds comes off the sheet into a picture of its own, which is moved under the Pencil.
  private func lift(_ l: Leaf, _ at: [Int]) {
    guard let b = heldBox() else { return }
    let d = b.insetBy(dx: -3, dy: -3)
    let s = ks(l)
    let pp = guest ? phase(l) : .zero
    let x0 = (d.minX * s * screen + pp.x).rounded(.down) - pp.x, y0 = (d.minY * s * screen + pp.y).rounded(.down) - pp.y
    let x1 = (d.maxX * s * screen + pp.x).rounded(.up) - pp.x, y1 = (d.maxY * s * screen + pp.y).rounded(.up) - pp.y
    let region = CGRect(x: x0 / screen / s, y: y0 / screen / s, width: (x1 - x0) / screen / s, height: (y1 - y0) / screen / s)
    let most = (16_000_000 / max((x1 - x0) * (y1 - y0), 1)).squareRoot()
    let f = min(1, most)
    var j = job(l, region: region, pw: max(1, Int((x1 - x0) * f)), ph: max(1, Int((y1 - y0) * f)))
    j.strokes = at.filter { $0 < l.geoms.count }.map { l.geoms[$0] }
    j.above = []
    j.bare = true
    let img = Paint.make(j)
    l.lifted = Set(at)
    repaint(l, b)
    tend()
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    held.transform = CATransform3DIdentity
    held.anchorPoint = .zero
    held.contents = img
    heldRegion = region
    if paper.run {
      // (one sheet: what is carried is not cut where the sheet it is kept on ends)
      held.frame = onLeaf(region).offsetBy(dx: l.frame.minX, dy: l.frame.minY)
      marks.layer.addSublayer(held)
    } else {
      held.frame = onLeaf(region, l)
      l.layer.addSublayer(held)
    }
    CATransaction.commit()
  }

  /// A part of a sheet (in its points) is to be drawn again, as it is now: at once over its pictures, and where a pageless notebook's strokes run on over the next sheet, there too.
  private func repaint(_ l: Leaf, _ d: CGRect) {
    l.ver += 1
    patch(l, d)
    for n in under(l, low: d.maxY) {
      n.leaf.ver += 1
      if d.maxY > n.up { patch(n.leaf, d.offsetBy(dx: 0, dy: -n.up)) }
    }
  }

  private var carried = CGAffineTransform.identity
  private func carry(_ l: Leaf, _ by: CGAffineTransform) {
    carried = by
    // the picture's own corner is where the transform begins: about the sheet's
    let o = onLeaf(heldRegion, l).origin
    let sl = sOf(l)
    let tx = by.a * o.x + by.c * o.y - o.x + by.tx * sl, ty = by.b * o.x + by.d * o.y - o.y + by.ty * sl
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    held.setAffineTransform(CGAffineTransform(a: by.a, b: by.b, c: by.c, d: by.d, tx: tx, ty: ty))
    // the dashed box goes with it
    if let k = picked, let b = box(of: k.at.filter { $0 < l.model.count }.map { l.model[$0] }) {
      let r = l.convert(onLeaf(b.applying(by), l), to: content).insetBy(dx: -4, dy: -4)
      outline.path = UIBezierPath(rect: r).cgPath
      grip.path = UIBezierPath(ovalIn: CGRect(x: r.maxX - 7, y: r.maxY - 7, width: 14, height: 14)).cgPath
    }
    CATransaction.commit()
  }

  /// The Pencil lifted from what the lasso holds: its strokes lie where they were carried to, one step to undo.
  private func drop(_ l: Leaf, _ at: [Int], moved: Bool, before: [PKStroke]) {
    var strokes = before
    let was = box(of: at.filter { $0 < before.count }.map { before[$0] })
    if moved { for i in at where i < strokes.count { strokes[i].transform = before[i].transform.concatenating(carried) } }
    carried = .identity
    l.lifted = []
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    if moved {
      let now = box(of: at.filter { $0 < strokes.count }.map { strokes[$0] })
      // (dropped past where its sheet ends, a pageless notebook's selection is kept on the sheet its top now lies on)
      let got = commit(l, from: before, to: strokes, moved: at, dirty: was.map { w in now.map { w.union($0) } ?? w } ?? now)
      if picked != nil { picked = (got.leaf, got.at) }
    } else {
      if let w = was { repaint(l, w) } else { l.ver += 1 }
      tend()
    }
    held.contents = nil
    held.removeFromSuperlayer()
    CATransaction.commit()
    ring()
    tellPicked()
  }

  /// Something done with what the lasso holds. False when it holds nothing.
  func selection(_ op: String, color c: UIColor?) -> Bool {
    guard !down, let k = picked else { return false }
    let l = k.leaf
    let before = l.model
    var strokes = before
    let at = k.at.filter { $0 < strokes.count }
    if at.isEmpty { return false }
    let mine = Set(at)
    let was = box(of: at.map { strokes[$0] })
    switch op {
    case "copy", "cut":
      plugin.clip = at.map { strokes[$0] }
      plugin.clipBox = was ?? .zero
      UIPasteboard.general.setData(PKDrawing(strokes: plugin.clip).dataRepresentation(), forPasteboardType: PKAppleDrawingTypeIdentifier as String)
      if op == "copy" { tellPicked(); return true }
      fallthrough
    case "delete":
      strokes = strokes.enumerated().filter { !mine.contains($0.offset) }.map { $0.element }
      unpick()
      put(l, strokes, dirty: was)
      step(l, from: before, to: l.model)
    case "duplicate":
      let by = CGAffineTransform(translationX: 16, y: 16)
      let n = strokes.count
      for i in at { strokes.append(plugin.renamed(strokes[i], transform: strokes[i].transform.concatenating(by))) }
      unpick()
      let got = commit(l, from: before, to: strokes, moved: Array(n..<strokes.count), dirty: was?.offsetBy(dx: 16, dy: 16))
      picked = (got.leaf, got.at)
      ring()
      tellPicked()
    case "color":
      guard let c = c else { return false }
      for i in at {
        var k2 = plugin.renamed(strokes[i], transform: strokes[i].transform)
        k2.ink = PKInk(strokes[i].ink.inkType, color: c.withAlphaComponent(strokes[i].ink.color.cgColor.alpha))
        strokes[i] = k2
      }
      unpick()
      put(l, strokes, dirty: was)
      step(l, from: before, to: l.model)
      picked = (l, at)
      ring()
      tellPicked()
    default:
      return false
    }
    return true
  }

  /// What was cut or copied put down on a sheet, its middle at a place on the surface.
  func paste(on l: Leaf, at q: CGPoint) -> Bool {
    guard !down, !plugin.clip.isEmpty else { return false }
    let on = view.convert(q, to: l)
    var p = CGPoint(x: on.x / sOf(l), y: on.y / sOf(l))
    let size = sizeOf(l)
    let cb = plugin.clipBox
    p.x = min(max(p.x, min(cb.width / 2, size.width / 2)), max(size.width - cb.width / 2, size.width / 2))
    if paper.run {
      // (one long sheet: held only to its top)
      p.y = max(p.y, cb.height / 2 - CGFloat(l.index) * size.height)
    } else {
      p.y = min(max(p.y, min(cb.height / 2, size.height / 2)), max(size.height - cb.height / 2, size.height / 2))
    }
    let by = CGAffineTransform(translationX: p.x - cb.midX, y: p.y - cb.midY)
    let before = l.model
    var strokes = before
    let n = strokes.count
    for k in plugin.clip { strokes.append(plugin.renamed(k, transform: k.transform.concatenating(by))) }
    unpick()
    let got = commit(l, from: before, to: strokes, moved: Array(n..<strokes.count), dirty: cb.applying(by))
    picked = (got.leaf, got.at)
    ring()
    tellPicked()
    return true
  }

  private func show(_ l: CAShapeLayer, path: CGPath?) {
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    if l.superlayer !== marks.layer { marks.layer.addSublayer(l) }
    l.zPosition = 10
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

  // ── fingers: a box, a tag, taps ──

  @objc private func addPressed() {
    plugin.emit(["kind": "surface", "id": id, "what": "add"])
  }

  @objc private func held(_ g: UILongPressGestureRecognizer) {
    let q = g.location(in: content)
    switch g.state {
    case .began:
      guard let l = leaf(at: q) else { return }
      boxFrom = q
      boxLeaf = l
      // the hold is up: the finger's drag is the box's now, not the scroll's
      let pan = scroll.panGestureRecognizer
      pan.isEnabled = false
      pan.isEnabled = true
      ghost.strokeColor = (colour(look.accent) ?? .orange).cgColor
      ghost.fillColor = (colour(look.accent) ?? .orange).withAlphaComponent(0.08).cgColor
      show(ghost, path: UIBezierPath(rect: CGRect(x: q.x - 1, y: q.y - 1, width: 2, height: 2)).cgPath)
      plugin.emit(["kind": "surface", "id": id, "what": "boxing"])
    case .changed:
      guard let from = boxFrom else { return }
      show(ghost, path: UIBezierPath(rect: CGRect(x: min(from.x, q.x), y: min(from.y, q.y), width: abs(q.x - from.x), height: abs(q.y - from.y))).cgPath)
    case .ended:
      hide(ghost)
      guard let from = boxFrom, let l = boxLeaf else { return }
      boxFrom = nil
      boxLeaf = nil
      if abs(q.x - from.x) < 8 || abs(q.y - from.y) < 6 { return }
      func on(_ v: CGFloat) -> Double { Double(min(1, max(0, v))) }
      // (of the sheet whole, where a pageless notebook's last is shown in part)
      let f = CGRect(x: left, y: topOf(l.index), width: pageW, height: pageH)
      let x = on((min(from.x, q.x) - f.minX) / f.width), y = on((min(from.y, q.y) - f.minY) / f.height)
      let r = on((max(from.x, q.x) - f.minX) / f.width), b = on((max(from.y, q.y) - f.minY) / f.height)
      if r - x <= 0.005 || b - y <= 0.003 { return }
      plugin.emit(["kind": "surface", "id": id, "what": "boxed", "page": l.index + 1, "x": x, "y": y, "w": r - x, "h": b - y])
    default:
      hide(ghost)
      boxFrom = nil
      boxLeaf = nil
    }
  }

  @objc private func tapped(_ g: UITapGestureRecognizer) {
    guard g.state == .ended else { return }
    let q = g.location(in: content)
    if let t = tagRects.first(where: { $0.rect.insetBy(dx: -10, dy: -8).contains(q) }) {
      let on = content.convert(t.rect, to: view)
      plugin.emit(["kind": "surface", "id": id, "what": "tag", "key": t.key, "x": on.minX, "y": on.minY, "w": on.width, "h": on.height])
      return
    }
    // a tap lets go of the boxes drawn and of what the lasso holds
    if plugin.fingerWrites, leaf(at: q) != nil { return }
    if picked != nil { unpick() }
    plugin.emit(["kind": "surface", "id": id, "what": "tap"])
  }

  @objc private func tappedTwice(_ g: UITapGestureRecognizer) {
    guard g.state == .ended, !scroll.isZooming else { return }
    let fitted = abs(base - 1) < 0.005
    zoom(to: fitted ? (lastZoom ?? 2) : 1, animated: true, about: g.location(in: content))
  }

  @objc private func fingers(_ g: UITapGestureRecognizer) {
    guard g.state == .ended, !down else { return }
    plugin.turn(back: g.numberOfTouchesRequired < 3)
  }

  /// A dev run's: three fingers tapped, which no simulator's rig can make.
  func threeTapped() { plugin.turn(back: false) }

  // ── the passages' boxes and tags ──

  private func drawMarks() {
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    for l in markLayers { l.removeFromSuperlayer() }
    markLayers = []
    tagRects = []
    pendingRect = nil
    let accent = colour(look.accent) ?? .orange
    let roomy = scroll.contentInset.left + left >= tagRoom
    for m in markSpecs {
      guard m.page >= 1, m.page <= order.count else { continue }
      let f = CGRect(x: left, y: topOf(m.page - 1), width: pageW, height: pageH)
      let r = CGRect(x: f.minX + CGFloat(m.x) * f.width, y: f.minY + CGFloat(m.y) * f.height, width: CGFloat(m.w) * f.width, height: CGFloat(m.h) * f.height)
      let box = CAShapeLayer()
      box.path = UIBezierPath(roundedRect: r, cornerRadius: 2).cgPath
      box.lineWidth = m.cur == true ? 2 : 1.5
      box.strokeColor = accent.withAlphaComponent(m.dis == true ? 0.5 : m.cur == true ? 1 : 0.8).cgColor
      box.fillColor = accent.withAlphaComponent(m.pending == true ? 0.1 : m.flash == true ? 0.18 : m.cur == true ? 0.07 : 0.03).cgColor
      if m.dis == true || m.pending == true { box.lineDashPattern = [5, 4] }
      marks.layer.addSublayer(box)
      markLayers.append(box)
      if m.pending == true {
        pendingRect = r
        if let no = m.no { label("\(no)", at: CGPoint(x: r.minX + 4, y: r.minY + 3), size: 11, colour: accent, plate: nil) }
        continue
      }
      guard let tag = m.tag else { continue }
      let text = roomy ? tag : (tag.hasPrefix("↳") ? "↳" : "§")
      let at = CGPoint(x: f.maxX + (roomy ? 12 : 4), y: r.minY)
      let rect = label(text, at: at, size: roomy ? 12 : 13, colour: m.cur == true ? (colour(look.fg) ?? .black) : accent.withAlphaComponent(m.dis == true ? 0.6 : 1), plate: colour(look.tag), width: roomy ? min(tagRoom - 24, 220) : nil)
      tagRects.append((m.key, rect))
    }
    CATransaction.commit()
  }

  @discardableResult
  private func label(_ text: String, at: CGPoint, size: CGFloat, colour c: UIColor, plate: UIColor?, width: CGFloat? = nil) -> CGRect {
    let font = UIFont.systemFont(ofSize: size, weight: .medium)
    var box = (text as NSString).size(withAttributes: [.font: font])
    if let w = width { box.width = min(box.width, w) }
    let pad: CGFloat = plate == nil ? 0 : 4
    let frame = CGRect(x: at.x, y: at.y, width: (box.width + 1).rounded(.up) + pad * 2, height: (box.height + 1).rounded(.up) + pad)
    let t = CATextLayer()
    t.string = text
    t.font = font
    t.fontSize = size
    t.foregroundColor = c.cgColor
    t.contentsScale = screen * max(1, min(base, 4))
    t.truncationMode = .end
    t.frame = frame.insetBy(dx: pad, dy: pad / 2)
    if let p = plate {
      let back = CALayer()
      back.frame = frame
      back.backgroundColor = p.cgColor
      back.cornerRadius = 4
      back.borderWidth = 1 / screen
      back.borderColor = (colour(look.line) ?? .gray).cgColor
      marks.layer.addSublayer(back)
      markLayers.append(back)
    }
    marks.layer.addSublayer(t)
    markLayers.append(t)
    return frame
  }

  // ── how it stands, for the checks ──

  func state() -> SurfaceState {
    let sc = screen
    func device(_ v: UIView) -> Box {
      let r = v.convert(v.bounds, to: nil)
      return Box(CGRect(x: r.minX * sc, y: r.minY * sc, width: r.width * sc, height: r.height * sc))
    }
    let web = plugin.webView
    func onWeb(_ r: CGRect, from v: UIView) -> Box { Box(web.map { v.convert(r, to: $0.scrollView) } ?? r) }
    let current = pageInView()
    let list = order.compactMap { leaves[$0] }.map { l -> LeafState in
      let shownW = l.convert(l.bounds, to: nil).width * sc
      let has = l.rest.contents != nil
      var drawn: Double?
      if has, let k = l.restKey, shownW > 0 { drawn = (Double(CGFloat(k[1]) / shownW) * 1000).rounded() / 1000 }
      if !l.fine.isHidden, let k = l.fineKey, l.fine.contents != nil {
        let w = l.fine.convert(l.fine.bounds, to: nil).width * sc
        if w > 0 { drawn = (Double(CGFloat(k[3]) / w) * 1000).rounded() / 1000 }
      }
      return LeafState(id: l.id, sheet: l.sheet, device: device(l), strokes: l.model.count, loaded: l.loaded, dirty: l.dirty, rest: has ? l.restKey.map { [$0[1], $0[2]] } : nil, fine: l.fine.isHidden ? nil : l.fineKey.map { [$0[3], $0[4]] }, patches: l.patches.count, drawn: drawn, current: l.index + 1 == current, ours: l.geoms.filter { $0.ours }.count, theirs: l.geoms.filter { !$0.ours }.count)
    }
    let cv = canvas.convert(canvas.bounds, to: nil)
    let memory = leaves.values.reduce(0) { $0 + $1.bytes() } + Int(canvas.bounds.width * canvas.bounds.height * sc * sc * 4)
    return SurfaceState(id: id, at: onWeb(view.bounds, from: view), device: device(view), base: Double(base), stretch: Double(scroll.zoomScale), zoom: Double(base * scroll.zoomScale), offset: [Double(scroll.contentOffset.x), Double(scroll.contentOffset.y)], content: [Double(scroll.contentSize.width), Double(scroll.contentSize.height)], inset: [Double(scroll.contentInset.left), Double(scroll.contentInset.top)], phase: phase, page: current, pages: order.count, sheets: list, canvas: [Double(canvas.zoomScale), cv.width > 0 ? Double(canvas.bounds.width / cv.width) : 1, Double(canvas.drawing.strokes.count)], memory: memory, holes: (view as? SurfaceView)?.holes.count ?? 0, marks: markSpecs.filter { $0.pending != true }.count, pendings: markSpecs.filter { $0.pending == true }.count, tags: tagRects.map { onWeb($0.rect, from: content) }, add: showAdd ? onWeb(addButton.frame, from: content) : nil, pending: pendingRect.map { onWeb($0, from: content) }, length: paper.run ? runLen : nil, shown: leaves.values.filter { !$0.isHidden }.count, making: making, sharpAfter: sharpAfter, blend: canvas.layer.compositingFilter as? String, paper: paper, dark: look.dark, colours: [look.paper, look.rule, look.dot, look.margin, look.desk])
  }

  /// Its sheets as the checks know a canvas's sheet (`SheetState`), and itself as a host: what was asked of the canvases over a notebook's pages is asked of these.
  func sheetStates() -> [SheetState] {
    let sc = screen
    guard let web = plugin.webView else { return [] }
    return order.compactMap { leaves[$0] }.filter { $0.loaded }.map { l in
      let inWindow = l.convert(l.bounds, to: nil)
      let device = CGRect(x: inWindow.minX * sc, y: inWindow.minY * sc, width: inWindow.width * sc, height: inWindow.height * sc)
      var drawn: [Double] = []
      if let k = l.restKey, l.rest.contents != nil, device.width > 0 { drawn.append((Double(CGFloat(k[1]) / device.width) * 100).rounded() / 100) }
      if !l.fine.isHidden, let k = l.fineKey { let w = l.fine.convert(l.fine.bounds, to: nil).width * sc; if w > 0 { drawn = [(Double(CGFloat(k[3]) / w) * 100).rounded() / 100] } }
      return SheetState(id: l.id, strokes: l.model.count, shown: true, dirty: l.dirty, at: Box(l.convert(l.bounds, to: web.scrollView)), pixels: Double(sOf(l) * sc * scroll.zoomScale), blend: look.dark ? "screenBlendMode" : "multiplyBlendMode", device: Box(device), stretch: Double(scroll.zoomScale), drawn: drawn)
    }
  }

  func hostState() -> HostState {
    let on = plugin.webView.map { view.convert(view.bounds, to: $0.scrollView) } ?? view.frame
    return HostState(id: id, follows: true, offset: Double(scroll.contentOffset.y), port: Box(on), zoomer: true, layers: [], phase: phase == "rest" ? nil : phase)
  }

  /// A dev run's: where what the lasso holds lies, on the page.
  func heldAt() -> Box? {
    guard let k = picked, let b = heldBox(), let web = plugin.webView else { return nil }
    return Box(k.leaf.convert(onLeaf(b, k.leaf), to: web.scrollView))
  }

  /// A dev run's: a sheet as it is drawn here, a pixel of the picture to a pixel of the screen, and PencilKit's own picture of the same strokes at the screen's pixels and at twice them (made half the size again): to hold one against the other.
  func pictures(_ l: Leaf, name: String) -> [String: Int]? {
    // (the sheet's upper left, where a check's strokes are: the whole of a sheet far zoomed into is more than a picture holds)
    let part = CGRect(x: 0, y: 0, width: min(CGFloat(paper.w), 310), height: min(CGFloat(paper.h), 330))
    let pw = Int((part.width * s * screen).rounded(.down)), ph = Int((part.height * s * screen).rounded(.down))
    let region = CGRect(x: 0, y: 0, width: CGFloat(pw) / (s * screen), height: CGFloat(ph) / (s * screen))
    var j = job(l, region: region, pw: pw, ph: ph)
    j.paper.kind = "blank"
    j.look.paper = "#ffffff"
    j.look.dark = false
    guard let ours = Paint.make(j) else { return nil }
    let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
    let safe = name.replacingOccurrences(of: "/", with: "-")
    func write(_ img: CGImage, _ suffix: String) {
      let format = UIGraphicsImageRendererFormat()
      format.scale = 1
      format.opaque = true
      let size = CGSize(width: pw, height: ph)
      let png = UIGraphicsImageRenderer(size: size, format: format).pngData { c in
        UIColor.white.setFill()
        c.fill(CGRect(origin: .zero, size: size))
        c.cgContext.interpolationQuality = .high
        UIImage(cgImage: img, scale: 1, orientation: .up).draw(in: CGRect(origin: .zero, size: size))
      }
      try? png.write(to: docs.appendingPathComponent("\(safe)\(suffix).png"))
    }
    write(ours, "-ours")
    let d = PKDrawing(strokes: l.model)
    UITraitCollection(userInterfaceStyle: .light).performAsCurrent {
      if let one = d.image(from: region, scale: s * self.screen).cgImage { write(one, "-pk") }
      if let two = d.image(from: region, scale: s * self.screen * 2).cgImage { write(two, "-pk2") }
    }
    return ["w": pw, "h": ph]
  }
}
