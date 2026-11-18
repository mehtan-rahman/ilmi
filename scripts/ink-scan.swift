// ink-scan.swift <mov> [dump dir] [t1,t2,…]: every frame of a recording of the `pdfink` smoke (milestone 89;
// `xcrun simctl io <udid> recordVideo --codec h264`), a line each:
//   t lamp | red x0 y0 x1 y1 n | orange n x0 y0 x1 y1 | green cx cy n x0 y0 x1 y1 | blue cx cy n x0 y0 x1 y1 | w h | under n x0 y0 x1 y1 dark
// in the recording's pixels (`under`: the orange above the green square, where
// the `lift` part writes, and `dark` the red there: orange laid on twice reads as red). Red is the cross written on the page, orange a stroke written by a finger, green and blue
// the squares that are the page's own, at the corners of what the cross covers; `lamp` is the grey of the square at
// the lower left, which says the part going on. With a folder and times, the first frames at or after those times as
// PNGs. Built with `swiftc -O scripts/ink-scan.swift -o ink-scan`; `scripts/ink-measure.py` reads what it prints.
import AVFoundation
import AppKit

let a = CommandLine.arguments
let asset = AVURLAsset(url: URL(fileURLWithPath: a[1]))
guard let track = asset.tracks(withMediaType: .video).first else { print("no video"); exit(1) }
let reader = try! AVAssetReader(asset: asset)
let out = AVAssetReaderTrackOutput(track: track, outputSettings: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
out.alwaysCopiesSampleData = false
reader.add(out)
reader.startReading()
let dumpDir = a.count > 2 ? a[2] : nil
var dumps = a.count > 3 ? a[3].split(separator: ",").compactMap { Double($0) } : []
if let d = dumpDir { try? FileManager.default.createDirectory(atPath: d, withIntermediateDirectories: true) }
var index = 0
while let s = out.copyNextSampleBuffer(), let buf = CMSampleBufferGetImageBuffer(s) {
  let t = CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(s))
  CVPixelBufferLockBaseAddress(buf, .readOnly)
  let w = CVPixelBufferGetWidth(buf), h = CVPixelBufferGetHeight(buf), row = CVPixelBufferGetBytesPerRow(buf)
  let p = CVPixelBufferGetBaseAddress(buf)!.assumingMemoryBound(to: UInt8.self)
  var rx0 = Int.max, ry0 = Int.max, rx1 = -1, ry1 = -1, rn = 0
  var ox0 = Int.max, oy0 = Int.max, ox1 = -1, oy1 = -1, on = 0
  var gx = 0.0, gy = 0.0, gn = 0, bx = 0.0, by = 0.0, bn = 0
  var gx0 = Int.max, gy0 = Int.max, gx1 = -1, gy1 = -1, bx0 = Int.max, by0 = Int.max, bx1 = -1, by1 = -1
  // (under the bar and its row of tools: their swatches are red, green and blue too)
  for y in Int(0.146 * Double(h))..<h {
    let line = p + y * row
    for x in 0..<w {
      let b = Int(line[x * 4]), g = Int(line[x * 4 + 1]), r = Int(line[x * 4 + 2])
      if r > 170 && g < 70 && b < 70 { rn += 1; if x < rx0 { rx0 = x }; if x > rx1 { rx1 = x }; if y < ry0 { ry0 = y }; if y > ry1 { ry1 = y } }
      else if r > 200 && g > 100 && g < 165 && b < 110 { on += 1; if x < ox0 { ox0 = x }; if x > ox1 { ox1 = x }; if y < oy0 { oy0 = y }; if y > oy1 { oy1 = y } }
      else if g > 170 && r < 90 && b < 90 { gn += 1; gx += Double(x); gy += Double(y); if x < gx0 { gx0 = x }; if x > gx1 { gx1 = x }; if y < gy0 { gy0 = y }; if y > gy1 { gy1 = y } }
      else if b > 170 && r < 90 && g < 90 { bn += 1; bx += Double(x); by += Double(y); if x < bx0 { bx0 = x }; if x > bx1 { bx1 = x }; if y < by0 { by0 = y }; if y > by1 { by1 = y } }
    }
  }
  // the orange over the green square, and the red there: a second pass, once the squares are known
  var ux0 = Int.max, uy0 = Int.max, ux1 = -1, uy1 = -1, un = 0, ud = 0
  if gn > 0, bn > 0 {
    let upto = Int(gy / Double(gn) - 0.06 * (by / Double(bn) - gy / Double(gn)))
    if upto > Int(0.146 * Double(h)) {
      for y in Int(0.146 * Double(h))..<min(upto, h) {
        let line = p + y * row
        for x in 0..<w {
          let b = Int(line[x * 4]), g = Int(line[x * 4 + 1]), r = Int(line[x * 4 + 2])
          if r > 200 && g > 100 && g < 165 && b < 110 { un += 1; if x < ux0 { ux0 = x }; if x > ux1 { ux1 = x }; if y < uy0 { uy0 = y }; if y > uy1 { uy1 = y } }
          else if r > 170 && g < 70 && b < 70 { ud += 1 }
        }
      }
    }
  }
  // the lamp: 40 px from the left and the foot of a window as wide as the recording is, 28 px square
  let k = Double(w) / 1032.0
  let lx = Int(54 * k), ly = h - Int(54 * k)
  let lamp = Int((p + ly * row)[lx * 4 + 1])
  let f = { (v: Double, n: Int) in n > 0 ? String(format: "%.2f", v / Double(n)) : "-" }
  print(String(format: "%.4f %d | %d %d %d %d %d | %d %d %d %d %d | %@ %@ %d %d %d %d %d | %@ %@ %d %d %d %d %d | %d %d | %d %d %d %d %d %d", t, lamp, rn > 0 ? rx0 : -1, rn > 0 ? ry0 : -1, rx1, ry1, rn, on, on > 0 ? ox0 : -1, on > 0 ? oy0 : -1, ox1, oy1, f(gx, gn), f(gy, gn), gn, gn > 0 ? gx0 : -1, gn > 0 ? gy0 : -1, gx1, gy1, f(bx, bn), f(by, bn), bn, bn > 0 ? bx0 : -1, bn > 0 ? by0 : -1, bx1, by1, w, h, un, un > 0 ? ux0 : -1, un > 0 ? uy0 : -1, ux1, uy1, ud))
  if let d = dumpDir, let i = dumps.firstIndex(where: { t >= $0 }) {
    dumps.remove(at: i)
    let ci = CIImage(cvPixelBuffer: buf)
    let rep = NSBitmapImageRep(ciImage: ci)
    try? rep.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: String(format: "%@/f%07d.png", d, Int(t * 1000))))
  }
  CVPixelBufferUnlockBaseAddress(buf, .readOnly)
  index += 1
}
