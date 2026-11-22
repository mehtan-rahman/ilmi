// A PDF's page, or a piece of it, drawn by Core Graphics (the reader's tiles and pictures, `ilmipage:`).
//
// The reader asks for a page in pieces at the size it is shown (tiles), and for whole pages small: each asking is
// drawn on one of a few worker threads at once (`lib.rs`'s pool), so a device's cores draw a screen's tiles together.
// Each thread keeps its own open documents: Core Graphics draws one document from one thread at a time safely, and a
// document opened once a thread keeps its fonts and pictures read for the next tile.

#import <Foundation/Foundation.h>
#import <CoreGraphics/CoreGraphics.h>
#import <ImageIO/ImageIO.h>
#include <stdint.h>
#include <string.h>
#include <time.h>

static int region_give(NSData *d, uint8_t **out, size_t *out_len) {
  *out_len = d.length;
  *out = malloc(d.length ? d.length : 1);
  if (!*out) return 3;
  memcpy(*out, d.bytes, d.length);
  return 0;
}

/// This thread's open document at `path` (its last few), retained by the caller.
static CGPDFDocumentRef region_doc(NSString *path) {
  NSMutableDictionary *t = [NSThread currentThread].threadDictionary;
  NSMutableDictionary *open = t[@"ilmi.pdf.open"];
  NSMutableArray *order = t[@"ilmi.pdf.order"];
  if (!open) { open = [NSMutableDictionary dictionary]; order = [NSMutableArray array]; t[@"ilmi.pdf.open"] = open; t[@"ilmi.pdf.order"] = order; }
  id had = open[path];
  if (had) {
    [order removeObject:path];
    [order addObject:path];
    return CGPDFDocumentRetain((__bridge CGPDFDocumentRef)had);
  }
  CGPDFDocumentRef doc = CGPDFDocumentCreateWithURL((__bridge CFURLRef)[NSURL fileURLWithPath:path]);
  if (!doc) return NULL;
  open[path] = (__bridge_transfer id)CGPDFDocumentRetain(doc);
  [order addObject:path];
  while (order.count > 3) { [open removeObjectForKey:order[0]]; [order removeObjectAtIndex:0]; }
  return doc;
}

static double region_now_ms(void) {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return ts.tv_sec * 1000.0 + ts.tv_nsec / 1e6;
}

/// A 24-bit BMP of `w` × `h` pixels from RGBX rows (`row` bytes each, top first): nothing to compress or decode.
static NSData *region_bmp(const uint8_t *px, size_t w, size_t h, size_t row) {
  size_t line = (w * 3 + 3) & ~(size_t)3;
  size_t size = 54 + line * h;
  NSMutableData *d = [NSMutableData dataWithLength:size];
  uint8_t *b = d.mutableBytes;
  b[0] = 'B'; b[1] = 'M';
  uint32_t v;
  v = (uint32_t)size; memcpy(b + 2, &v, 4);
  v = 54; memcpy(b + 10, &v, 4);
  v = 40; memcpy(b + 14, &v, 4);
  int32_t iw = (int32_t)w, ih = -(int32_t)h; // (top first)
  memcpy(b + 18, &iw, 4); memcpy(b + 22, &ih, 4);
  uint16_t planes = 1, bits = 24; memcpy(b + 26, &planes, 2); memcpy(b + 28, &bits, 2);
  v = (uint32_t)(line * h); memcpy(b + 34, &v, 4);
  for (size_t y = 0; y < h; y++) {
    const uint8_t *s = px + y * row;
    uint8_t *o = b + 54 + y * line;
    for (size_t x = 0; x < w; x++) { o[0] = s[2]; o[1] = s[1]; o[2] = s[0]; o += 3; s += 4; }
  }
  return d;
}

/// Page `number` (from 1) of the PDF at `path` as drawn `page_w` pixels across, the piece of it `w` × `h` pixels from
/// (`x`, `y`) (its top left; all of it where `w` is 0), on white: a JPEG of `quality` (`fmt` 0), a PNG (1), or a BMP
/// (2). `ms` is given how long the drawing took and how long the picture's making, in milliseconds.
int ilmi_pdf_region(const uint8_t *path, size_t len, uint32_t number, uint32_t page_w, uint32_t x, uint32_t y, uint32_t w, uint32_t h, uint32_t fmt, double quality, double *ms, uint8_t **out, size_t *out_len) {
  @autoreleasepool {
    NSString *s = [[NSString alloc] initWithBytes:path length:len encoding:NSUTF8StringEncoding];
    CGPDFDocumentRef doc = s ? region_doc(s) : NULL;
    if (!doc) return 2;
    CGPDFPageRef page = CGPDFDocumentGetPage(doc, number);
    if (!page || page_w < 1 || page_w > 65536) { CGPDFDocumentRelease(doc); return 2; }
    CGRect crop = CGPDFPageGetBoxRect(page, kCGPDFCropBox);
    int rot = ((CGPDFPageGetRotationAngle(page) % 360) + 360) % 360;
    CGSize z = rot == 90 || rot == 270 ? CGSizeMake(crop.size.height, crop.size.width) : crop.size;
    if (z.width <= 0 || z.height <= 0) { CGPDFDocumentRelease(doc); return 2; }
    double k = page_w / z.width;
    size_t full_h = (size_t)MAX(1, llround(z.height * k));
    if (w == 0) { x = 0; y = 0; w = page_w; h = (uint32_t)full_h; }
    if (w > 8192 || h > 8192 || x >= page_w || y >= full_h) { CGPDFDocumentRelease(doc); return 2; }
    double t0 = region_now_ms();
    CGColorSpaceRef rgb = CGColorSpaceCreateDeviceRGB();
    CGContextRef ctx = CGBitmapContextCreate(NULL, w, h, 8, 0, rgb, (CGBitmapInfo)kCGImageAlphaNoneSkipLast);
    CGColorSpaceRelease(rgb);
    if (!ctx) { CGPDFDocumentRelease(doc); return 3; }
    CGContextSetRGBFillColor(ctx, 1, 1, 1, 1);
    CGContextFillRect(ctx, CGRectMake(0, 0, w, h));
    CGContextSetInterpolationQuality(ctx, kCGInterpolationHigh);
    // the piece's top left at the context's: the page drawn from its bottom left, `full_h - y - h` below the piece
    CGContextTranslateCTM(ctx, -(double)x, -((double)full_h - (double)y - (double)h));
    CGContextScaleCTM(ctx, (double)page_w / z.width, (double)full_h / z.height);
    CGContextConcatCTM(ctx, CGPDFPageGetDrawingTransform(page, kCGPDFCropBox, CGRectMake(0, 0, z.width, z.height), 0, true));
    CGContextDrawPDFPage(ctx, page);
    double t1 = region_now_ms();
    CGPDFDocumentRelease(doc);
    NSData *made = nil;
    if (fmt == 2) {
      made = region_bmp(CGBitmapContextGetData(ctx), w, h, CGBitmapContextGetBytesPerRow(ctx));
      CGContextRelease(ctx);
    } else {
      CGImageRef img = CGBitmapContextCreateImage(ctx);
      CGContextRelease(ctx);
      if (!img) return 3;
      NSMutableData *d = [NSMutableData data];
      CGImageDestinationRef dest = CGImageDestinationCreateWithData((__bridge CFMutableDataRef)d, fmt == 1 ? CFSTR("public.png") : CFSTR("public.jpeg"), 1, NULL);
      if (!dest) { CGImageRelease(img); return 3; }
      CGImageDestinationAddImage(dest, img, fmt == 1 ? NULL : (__bridge CFDictionaryRef)@{(__bridge id)kCGImageDestinationLossyCompressionQuality: @(quality)});
      BOOL ok = CGImageDestinationFinalize(dest);
      CFRelease(dest);
      CGImageRelease(img);
      if (!ok) return 3;
      made = d;
    }
    if (ms) { ms[0] = t1 - t0; ms[1] = region_now_ms() - t1; }
    return region_give(made, out, out_len);
  }
}
