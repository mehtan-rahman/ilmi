// pdfpng <pdf> <out prefix>: each page of a PDF as a PNG, two pixels to the point
import PDFKit
import AppKit
let a = CommandLine.arguments
guard let d = PDFDocument(url: URL(fileURLWithPath: a[1])) else { print("no pdf"); exit(1) }
for i in 0..<d.pageCount {
  let p = d.page(at: i)!
  let b = p.bounds(for: .mediaBox)
  let img = p.thumbnail(of: NSSize(width: b.width * 2, height: b.height * 2), for: .mediaBox)
  let rep = NSBitmapImageRep(data: img.tiffRepresentation!)!
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: "\(a[2])-\(i + 1).png"))
  print("page \(i + 1): \(b.width) x \(b.height)")
}
