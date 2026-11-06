// The canvas (milestone 58): PencilKit over the web view, the whole screen, its tool picker shown, until
// `done`. It is opened with a drawing or none and answers with the drawing it holds when it closes; while it
// is open `peek` says how many strokes it holds and, once it has been left alone a while, gives the drawing
// as it stands, so a page is kept when it goes quiet and not only when it closes.
//
// The Pencil draws and a finger scrolls, as the system has it. `finger` lets a finger draw too: a simulator
// has no Pencil, and the checks draw with what its test runner can make.
//
// Opened with `paper` (milestone 67) the canvas is a book's page: its picture under the strokes, `width` by
// `height` points, fitted to the screen's width. The canvas is zoomed by that fit and the picture laid out
// at it, so a stroke's points are in the page's own points wherever it is written, on any screen.

import PencilKit
import SwiftRs
import Tauri
import UIKit
import WebKit

struct OpenArgs: Decodable {
  var drawing: String?
  var finger: Bool?
  var paper: String?
  var width: Double?
  var height: Double?
}

struct PeekArgs: Decodable {
  var quietMs: Int?
}

struct Page: Encodable {
  let strokes: Int
  let drawing: String?
  let open: Bool
  /// Over a book's page: how far the canvas is zoomed to fit it, and where the page's top left corner is on the screen, in points. For a check that touches it.
  var zoom: Double? = nil
  var left: Double? = nil
  var top: Double? = nil
}

/// A book's page to write on: its picture and its size in points.
struct Paper {
  let image: UIImage
  let size: CGSize
}

class InkController: UIViewController, PKCanvasViewDelegate {
  let canvas = PKCanvasView()
  let picker = PKToolPicker()
  let done = UIButton(type: .system)
  var onDone: ((PKDrawing) -> Void)?
  var changed = false
  var changedAt = Date()
  private var loaded = false
  /// The drawing it is opened with, until the canvas has a size to draw it at.
  private var start: PKDrawing?
  /// The page written on, when it is a book's.
  let paper: Paper?
  private let sheet = UIImageView()
  /// How far the canvas is zoomed for the page to fit its width.
  private var fit: CGFloat = 1
  /// Room kept above the page for `done`.
  private let bar: CGFloat = 52

  init(drawing: PKDrawing?, finger: Bool, paper: Paper?) {
    self.paper = paper
    super.init(nibName: nil, bundle: nil)
    modalPresentationStyle = .overFullScreen
    start = drawing
    canvas.drawingPolicy = finger ? .anyInput : .default
    // a page is white paper whatever the system's appearance: its ink is drawn as on paper
    if paper != nil { overrideUserInterfaceStyle = .light }
  }

  required init?(coder: NSCoder) { fatalError("not from a nib") }

  override func viewDidLoad() {
    super.viewDidLoad()
    view.backgroundColor = paper == nil ? .systemBackground : .secondarySystemBackground
    canvas.backgroundColor = paper == nil ? .systemBackground : .clear
    canvas.isOpaque = paper == nil
    canvas.alwaysBounceVertical = true
    if let paper = paper {
      sheet.image = paper.image
      sheet.backgroundColor = .white
      sheet.isUserInteractionEnabled = false
      canvas.insertSubview(sheet, at: 0)
    }
    canvas.delegate = self
    canvas.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(canvas)
    done.setTitle("done", for: .normal)
    done.titleLabel?.font = .systemFont(ofSize: 17)
    done.accessibilityIdentifier = "ink-done"
    done.contentEdgeInsets = UIEdgeInsets(top: 10, left: 16, bottom: 10, right: 16)
    done.addTarget(self, action: #selector(finish), for: .touchUpInside)
    done.translatesAutoresizingMaskIntoConstraints = false
    view.addSubview(done)
    NSLayoutConstraint.activate([
      canvas.topAnchor.constraint(equalTo: paper == nil ? view.topAnchor : view.safeAreaLayoutGuide.topAnchor, constant: paper == nil ? 0 : bar),
      canvas.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      canvas.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      canvas.trailingAnchor.constraint(equalTo: view.trailingAnchor),
      done.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 4),
      done.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -8),
    ])
  }

  override func viewDidLayoutSubviews() {
    super.viewDidLayoutSubviews()
    if let paper = paper, canvas.bounds.width > 0 {
      // the page fills the width: the canvas is zoomed by that much, and its strokes stay in the page's points
      let z = canvas.bounds.width / paper.size.width
      if abs(z - fit) > 0.0001 {
        fit = z
        canvas.maximumZoomScale = max(canvas.maximumZoomScale, z)
        canvas.minimumZoomScale = z
        canvas.maximumZoomScale = z
        canvas.zoomScale = z
      }
      sheet.frame = CGRect(x: 0, y: 0, width: paper.size.width * z, height: paper.size.height * z)
      canvas.sendSubviewToBack(sheet)
      // the tool picker lies over the page's foot: room to bring that up from under it
      canvas.contentInset.bottom = picker.frameObscured(in: view).height
    }
    // given before the canvas is laid out, a drawing is drawn only in part
    if let drawing = start, canvas.bounds.width > 0 {
      start = nil
      canvas.drawing = drawing
    }
    room()
  }

  override func viewDidAppear(_ animated: Bool) {
    super.viewDidAppear(animated)
    picker.setVisible(true, forFirstResponder: canvas)
    picker.addObserver(canvas)
    canvas.becomeFirstResponder()
    // the drawing it was opened with is not a change, whenever the canvas says it changed
    DispatchQueue.main.async {
      self.loaded = true
      self.changed = false
    }
  }

  /// The page is as long as what is on it and a screen more; a book's page is its own size.
  private func room() {
    if let paper = paper {
      let size = CGSize(width: paper.size.width * fit, height: paper.size.height * fit)
      if canvas.contentSize != size { canvas.contentSize = size }
      return
    }
    let bottom = canvas.drawing.strokes.isEmpty ? 0 : canvas.drawing.bounds.maxY
    let size = CGSize(width: view.bounds.width, height: max(view.bounds.height, bottom + view.bounds.height))
    if canvas.contentSize != size { canvas.contentSize = size }
  }

  func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
    // setting the drawing it is opened with is not a change
    if !loaded { return }
    changed = true
    changedAt = Date()
    room()
  }

  @objc func finish() {
    let drawing = start ?? canvas.drawing
    picker.setVisible(false, forFirstResponder: canvas)
    picker.removeObserver(canvas)
    dismiss(animated: false) { self.onDone?(drawing) }
  }
}

class InkPlugin: Plugin {
  var controller: InkController?

  @objc public func open(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(OpenArgs.self)
    DispatchQueue.main.async {
      if self.controller != nil {
        invoke.reject("the canvas is open")
        return
      }
      var drawing: PKDrawing? = nil
      if let b64 = args.drawing, !b64.isEmpty {
        guard let data = Data(base64Encoded: b64), let d = try? PKDrawing(data: data) else {
          invoke.reject("not a drawing")
          return
        }
        drawing = d
      }
      guard let root = self.manager.viewController else {
        invoke.reject("no view to draw over")
        return
      }
      var paper: Paper? = nil
      if let b64 = args.paper, !b64.isEmpty {
        guard let data = Data(base64Encoded: b64), let image = UIImage(data: data), let w = args.width, let h = args.height, w > 0, h > 0 else {
          invoke.reject("not a page")
          return
        }
        paper = Paper(image: image, size: CGSize(width: w, height: h))
      }
      let c = InkController(drawing: drawing, finger: args.finger ?? false, paper: paper)
      c.onDone = { d in
        self.controller = nil
        invoke.resolve(Page(strokes: d.strokes.count, drawing: d.dataRepresentation().base64EncodedString(), open: false))
      }
      self.controller = c
      root.present(c, animated: false)
    }
  }

  @objc public func peek(_ invoke: Invoke) throws {
    let args = try invoke.parseArgs(PeekArgs.self)
    DispatchQueue.main.async {
      guard let c = self.controller else {
        invoke.resolve(Page(strokes: 0, drawing: nil, open: false))
        return
      }
      let d = c.canvas.drawing
      var data: String? = nil
      if c.changed && Date().timeIntervalSince(c.changedAt) * 1000 >= Double(args.quietMs ?? 0) {
        c.changed = false
        data = d.dataRepresentation().base64EncodedString()
      }
      var page = Page(strokes: d.strokes.count, drawing: data, open: true)
      if c.paper != nil {
        // the content's own corner, wherever the canvas is scrolled to
        let at = c.canvas.convert(CGPoint.zero, to: c.view)
        page.zoom = Double(c.canvas.zoomScale)
        page.left = Double(at.x)
        page.top = Double(at.y)
      }
      invoke.resolve(page)
    }
  }
}

@_cdecl("init_plugin_ink")
func initPlugin() -> Plugin {
  return InkPlugin()
}
