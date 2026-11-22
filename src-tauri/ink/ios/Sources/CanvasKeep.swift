// How a PencilKit canvas is let go.
//
// A `PKCanvasView` released in the same turn as the views it lies in (a whole page or surface taken away at once)
// crashed the app: its tiled view's `dealloc` asks its superview, already freed in that release, whether it is in
// focus (`PKTiledView dealloc` → `removeFromSuperview` → `CALayerGetSuperlayer` on a freed layer; seen in the
// native reader's prototype, 2026-11-22). A canvas is therefore always taken out of its superview on its own first,
// its drawing gesture let go, and the canvas itself kept until the next turn of the main thread, so that whatever
// else goes in this turn goes before it and nothing it asks after is gone.
//
// Every place that takes away a canvas, or a view holding one, calls `CanvasKeep.letGo` for each canvas first.
// (`Surface.swift`'s `remove()` takes its view away with its canvas in it: it is to call this too, once the work on
// that file in hand is merged.)

import PencilKit
import UIKit

enum CanvasKeep {
  private static var held: [UIView] = []
  private static var asked = false

  /// `canvas` out of its superview, its drawing gesture off, and kept until the next turn of the main thread.
  static func letGo(_ canvas: PKCanvasView) {
    let g = canvas.drawingGestureRecognizer
    g.isEnabled = false
    g.view?.removeGestureRecognizer(g)
    canvas.delegate = nil
    canvas.removeFromSuperview()
    held.append(canvas)
    guard !asked else { return }
    asked = true
    DispatchQueue.main.async {
      asked = false
      // (a turn on: whatever was let go with it has gone by now)
      let these = held
      held = []
      DispatchQueue.main.async { _ = these.count }
    }
  }

  /// Every canvas within `view`, let go as above, before `view` itself is taken away.
  static func letGoAll(in view: UIView) {
    for v in view.subviews {
      if let c = v as? PKCanvasView { letGo(c) } else { letGoAll(in: v) }
    }
  }
}
