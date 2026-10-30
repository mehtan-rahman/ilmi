import AppKit
import CoreText

let S: CGFloat = 1024
let paper = NSColor(srgbRed: 0xfd/255, green: 0xfd/255, blue: 0xfc/255, alpha: 1)
let ink = NSColor(srgbRed: 0x1a/255, green: 0x1a/255, blue: 0x1b/255, alpha: 1)
let gold = NSColor(srgbRed: 170/255, green: 127/255, blue: 0, alpha: 1)
let rule = NSColor(srgbRed: 0x1a/255, green: 0x1a/255, blue: 0x1b/255, alpha: 0.10)

// macOS icon grid: 824 body inside 1024, corner radius ~185
let body = CGRect(x: 100, y: 100, width: 824, height: 824)
func squircle() -> NSBezierPath { NSBezierPath(roundedRect: body, xRadius: 185, yRadius: 185) }

func render(_ name: String, _ draw: () -> Void) {
  let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: Int(S), pixelsHigh: Int(S), bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  NSColor.clear.setFill(); CGRect(x: 0, y: 0, width: S, height: S).fill()
  // body: paper with a hairline edge
  let p = squircle(); paper.setFill(); p.fill()
  NSColor(srgbRed: 0, green: 0, blue: 0, alpha: 0.12).setStroke(); p.lineWidth = 2; p.stroke()
  NSGraphicsContext.saveGraphicsState(); p.addClip(); draw(); NSGraphicsContext.restoreGraphicsState()
  NSGraphicsContext.restoreGraphicsState()
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "\(name).png"))
}

// a glyph run drawn centred on (cx, cy) by its ink bounds, at a size that makes its ink `h` tall
func glyphs(_ text: String, font: String, h: CGFloat, cx: CGFloat, cy: CGFloat, color: NSColor) -> CGRect {
  var f = CTFontCreateWithName(font as CFString, 400, nil)
  func line(_ f: CTFont) -> CTLine { CTLineCreateWithAttributedString(NSAttributedString(string: text, attributes: [.font: f, .foregroundColor: color])) }
  var l = line(f)
  var b = CTLineGetImageBounds(l, nil)
  f = CTFontCreateWithName(font as CFString, 400 * h / b.height, nil)
  l = line(f); b = CTLineGetImageBounds(l, nil)
  let ctx = NSGraphicsContext.current!.cgContext
  ctx.textPosition = CGPoint(x: cx - b.midX, y: cy - b.midY)
  CTLineDraw(l, ctx)
  return b.offsetBy(dx: cx - b.midX, dy: cy - b.midY)
}

// A: the letter ʿayn, the first of ʿilm, with the read marker in the margin
for (i, font) in ["DecoType Naskh", "Mishafi", "Diwan Thuluth"].enumerated() {
  render("a\(i+1)") {
    let b = glyphs("ع", font: font, h: 460, cx: 585, cy: 505, color: ink)
    gold.setFill(); CGRect(x: 268, y: b.minY + 6, width: 30, height: b.height - 12).fill()
  }
}
// B: the word in square Kufic, a gold rule under it
for (i, font) in ["Diwan Kufi", "KufiStandardGK"].enumerated() {
  render("b\(i+1)") {
    let b = glyphs("علم", font: font, h: 300, cx: 512, cy: 545, color: ink)
    gold.setFill(); CGRect(x: b.minX, y: b.minY - 70, width: b.width, height: 18).fill()
  }
}
// C: a page: lines of text, the read marker beside the read part, a card diamond
render("c1") {
  let x0: CGFloat = 330, x1: CGFloat = 760
  let ys: [CGFloat] = [720, 650, 580, 510, 440, 370, 300]
  for (k, y) in ys.enumerated() {
    let w = k == 3 ? (x1 - x0) * 0.62 : (k == ys.count - 1 ? (x1 - x0) * 0.45 : x1 - x0)
    (k < 4 ? ink.withAlphaComponent(0.82) : ink.withAlphaComponent(0.28)).setFill()
    NSBezierPath(roundedRect: CGRect(x: x0, y: y, width: w, height: 22), xRadius: 2, yRadius: 2).fill()
  }
  gold.setFill(); CGRect(x: 262, y: 500, width: 22, height: 244).fill()
  let d = NSBezierPath(); let c = CGPoint(x: x0 + (x1 - x0) * 0.62 + 64, y: 521)
  d.move(to: CGPoint(x: c.x, y: c.y + 34)); d.line(to: CGPoint(x: c.x + 34, y: c.y)); d.line(to: CGPoint(x: c.x, y: c.y - 34)); d.line(to: CGPoint(x: c.x - 34, y: c.y)); d.close()
  gold.setFill(); d.fill()
}
