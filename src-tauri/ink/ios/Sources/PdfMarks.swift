// A book's native surface: what the page lays on its pages (the native page view, phase 3).
//
// The page owns the marks (its store); the surface draws them, as vectors in each page's own points, so they are
// sharp at any zoom and go wherever the page goes: highlights in their four inks (a band; a rule, dashed, dotted
// under the line), the passages' boxes (current, dismissed, flashing, a box being drawn and its number), each
// passage's tag over its first box, the ruler's band, the read point, bookmarks in the left margin and portals in
// the right. A finger held where there is no word draws a box (`pdfbox`, the page's to make a passage or a card of).

import UIKit

struct PdfMarkSpec: Decodable, Equatable {
  /// `hl`, `box`, `pend`, `rule`, `read`, `bm`, `portal`.
  let k: String
  let key: String?
  let page: Int
  let x: Double
  let y: Double
  let w: Double
  let h: Double
  let ink: Int?
  let tag: String?
  let cur: Bool?
  let dis: Bool?
  let flash: Bool?
  let no: Int?
}

/// Colours of the page's own theme for the marks (`#rrggbb`).
struct PdfLook: Equatable {
  var accent = UIColor(red: 0.71, green: 0.54, blue: 0.16, alpha: 1)
  var fg = UIColor(white: 0.2, alpha: 1)
  var paper = UIColor.white
  var dark = false
}

enum PdfMarks {
  /// The highlights' inks as the web reader's styles have them (`pdf.css`, `.hl[data-ink]`): fill, and the line under it.
  static func ink(_ n: Int, dark: Bool) -> (UIColor, UIColor?, [NSNumber]?) {
    func c(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat, _ a: CGFloat) -> UIColor { UIColor(red: r / 255, green: g / 255, blue: b / 255, alpha: a) }
    switch n {
    case 2: return (dark ? c(52, 82, 130, 0.3) : c(169, 195, 240, 0.22), dark ? c(143, 179, 240, 1) : c(47, 99, 184, 1), nil)
    case 3: return (dark ? c(48, 104, 66, 0.3) : c(166, 220, 176, 0.22), dark ? c(132, 211, 155, 1) : c(46, 125, 69, 1), [4, 3])
    case 4: return (dark ? c(120, 60, 52, 0.3) : c(242, 169, 155, 0.22), dark ? c(240, 138, 122, 1) : c(194, 59, 43, 1), [1.5, 2.5])
    default: return (dark ? c(122, 106, 30, 0.6) : c(242, 214, 92, 0.55), nil, nil)
    }
  }

  /// The marks of one page drawn into `layer` (made anew: they are few on a page), the page `size` points.
  static func draw(_ marks: [PdfMarkSpec], in layer: CALayer, size: CGSize, look: PdfLook, scale: CGFloat) {
    layer.sublayers?.forEach { $0.removeFromSuperlayer() }
    func r(_ m: PdfMarkSpec) -> CGRect { CGRect(x: m.x * size.width, y: m.y * size.height, width: m.w * size.width, height: m.h * size.height) }
    for m in marks {
      let f = r(m)
      switch m.k {
      case "hl":
        let (fill, line, dash) = ink(m.ink ?? 1, dark: look.dark)
        let band = CAShapeLayer()
        band.path = UIBezierPath(roundedRect: f, cornerRadius: 1).cgPath
        band.fillColor = fill.cgColor
        layer.addSublayer(band)
        if let line = line {
          let u = CAShapeLayer()
          let p = UIBezierPath()
          p.move(to: CGPoint(x: f.minX, y: f.maxY - 1)); p.addLine(to: CGPoint(x: f.maxX, y: f.maxY - 1))
          u.path = p.cgPath
          u.strokeColor = line.cgColor
          u.lineWidth = 2
          u.lineDashPattern = dash
          u.fillColor = nil
          layer.addSublayer(u)
        }
      case "box", "pend":
        let b = CAShapeLayer()
        b.path = UIBezierPath(rect: f).cgPath
        let pending = m.k == "pend"
        if pending {
          b.strokeColor = look.accent.cgColor; b.lineWidth = 1.5; b.lineDashPattern = [5, 3]; b.fillColor = look.accent.withAlphaComponent(0.07).cgColor
        } else if m.cur == true {
          b.strokeColor = look.accent.cgColor; b.lineWidth = 2; b.fillColor = look.accent.withAlphaComponent(0.12).cgColor
        } else if m.dis == true {
          b.strokeColor = look.fg.withAlphaComponent(0.3).cgColor; b.lineWidth = 1.5; b.lineDashPattern = [4, 3]; b.fillColor = nil
        } else {
          b.strokeColor = look.fg.withAlphaComponent(0.45).cgColor; b.lineWidth = 1; b.fillColor = nil
        }
        layer.addSublayer(b)
        if m.flash == true {
          let a = CABasicAnimation(keyPath: "opacity")
          a.fromValue = 1; a.toValue = 0.15; a.duration = 0.5; a.autoreverses = true; a.repeatCount = 2
          b.add(a, forKey: "flash")
        }
        if let n = m.no { layer.addSublayer(text("\(n)", at: CGPoint(x: f.minX + 3, y: f.minY + 2), color: look.accent, plate: nil, scale: scale)) }
        if let t = m.tag, !t.isEmpty {
          // over the box's top left, on a plate of the paper's colour
          let l = text(t, at: CGPoint(x: f.minX, y: max(0, f.minY - 15)), color: m.cur == true ? look.fg : look.fg.withAlphaComponent(m.dis == true ? 0.45 : 0.7), plate: look.paper.withAlphaComponent(0.9), scale: scale)
          layer.addSublayer(l)
        }
      case "rule":
        let band = CAShapeLayer()
        band.path = UIBezierPath(rect: f).cgPath
        band.fillColor = look.accent.withAlphaComponent(0.12).cgColor
        layer.addSublayer(band)
        let u = CAShapeLayer()
        let p = UIBezierPath(); p.move(to: CGPoint(x: f.minX, y: f.maxY)); p.addLine(to: CGPoint(x: f.maxX, y: f.maxY))
        u.path = p.cgPath; u.strokeColor = look.accent.cgColor; u.lineWidth = 1
        layer.addSublayer(u)
      case "read":
        // the read point: a line in the accent across the page, quiet, with a tick in the left margin
        let u = CAShapeLayer()
        let p = UIBezierPath(); p.move(to: CGPoint(x: 0, y: f.minY)); p.addLine(to: CGPoint(x: size.width, y: f.minY))
        u.path = p.cgPath; u.strokeColor = look.accent.withAlphaComponent(0.45).cgColor; u.lineWidth = 1.5; u.lineDashPattern = [6, 4]
        layer.addSublayer(u)
        let t = CAShapeLayer(); t.path = UIBezierPath(rect: CGRect(x: 0, y: f.minY - 6, width: 3, height: 12)).cgPath; t.fillColor = look.accent.cgColor
        layer.addSublayer(t)
      case "bm":
        let t = CAShapeLayer(); t.path = UIBezierPath(rect: CGRect(x: 2, y: f.minY - 5, width: 5, height: 10)).cgPath; t.fillColor = look.accent.cgColor
        layer.addSublayer(t)
      case "portal":
        layer.addSublayer(text("↗", at: CGPoint(x: size.width - 18, y: f.minY - 8), color: look.accent, plate: look.paper.withAlphaComponent(0.9), scale: scale, size: 13))
      default: break
      }
    }
  }

  static func text(_ s: String, at p: CGPoint, color: UIColor, plate: UIColor?, scale: CGFloat, size: CGFloat = 11) -> CALayer {
    let font = UIFont(name: "IBMPlexSans", size: size) ?? UIFont.systemFont(ofSize: size)
    let a = NSAttributedString(string: s, attributes: [.font: font, .foregroundColor: color])
    let w = ceil(a.size().width) + 6, h = ceil(a.size().height) + 2
    let l = CATextLayer()
    l.string = a
    l.contentsScale = scale
    l.frame = CGRect(x: p.x, y: p.y, width: w, height: h)
    l.alignmentMode = .center
    if let plate = plate { l.backgroundColor = plate.cgColor }
    return l
  }
}
