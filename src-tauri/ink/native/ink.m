// A PencilKit drawing as ilmi keeps it (milestone 58): taken apart into its strokes, each named by what it
// is; put together again from them; drawn as a PNG, cut to what the strokes cover or (milestone 67) as they
// lie on a page of a size. The same code on the Mac and on iOS, called from Rust.
//
// PencilKit gives a stroke no name, and a drawing saved twice is not the same bytes twice. What a save
// keeps of a stroke is when it was made, its seed, and its points; the name here is a hash over those, so a
// stroke left alone has the name it had, and one moved or cut by the eraser is another stroke.
//
// A stroke's bytes are a `PKDrawing` holding that one stroke, as PencilKit writes it.
// Records out of `split`: 16 bytes of name (hex), 8 of its instant (a little-endian double, seconds since
// 1970), 4 of length, the bytes. Records in to `join` and `picture`: 4 of length, the bytes.

#import <Foundation/Foundation.h>
#import <PencilKit/PencilKit.h>
#import <CommonCrypto/CommonDigest.h>
#import <TargetConditionals.h>
#if TARGET_OS_OSX
#import <AppKit/AppKit.h>
#else
#import <UIKit/UIKit.h>
#endif

#import <ImageIO/ImageIO.h>
#import "stroke.h"

#define INK_AVAILABLE @available(macOS 11.0, iOS 14.0, *)

static int give(NSData *d, uint8_t **out, size_t *out_len) {
  *out_len = d.length;
  *out = malloc(d.length ? d.length : 1);
  if (!*out) return 3;
  memcpy(*out, d.bytes, d.length);
  return 0;
}

void ilmi_ink_free(uint8_t *p) { free(p); }

/// The app's iCloud folder, its `Documents`: nothing unless the app is signed with an iCloud container and the person is signed in to iCloud.
int ilmi_icloud_folder(uint8_t **out, size_t *out_len) {
  @autoreleasepool {
    NSURL *c = [NSFileManager.defaultManager URLForUbiquityContainerIdentifier:nil];
    if (!c) return give([NSData data], out, out_len);
    NSURL *docs = [c URLByAppendingPathComponent:@"Documents" isDirectory:YES];
    [NSFileManager.defaultManager createDirectoryAtURL:docs withIntermediateDirectories:YES attributes:nil error:nil];
    return give([docs.path dataUsingEncoding:NSUTF8StringEncoding], out, out_len);
  }
}

/// A file of the iCloud folder asked down, and waited for up to `seconds`. 0: it is here, or is no file iCloud holds; 1: it did not come in time.
int ilmi_icloud_down(const uint8_t *path, size_t len, uint32_t seconds) {
  @autoreleasepool {
    NSString *p = [[NSString alloc] initWithBytes:path length:len encoding:NSUTF8StringEncoding];
    if (!p) return 0;
    NSURL *url = [NSURL fileURLWithPath:p];
    NSFileManager *fm = NSFileManager.defaultManager;
    if (![fm isUbiquitousItemAtURL:url]) return 0;
    [fm startDownloadingUbiquitousItemAtURL:url error:nil];
    for (uint32_t i = 0; i < seconds * 10; i++) {
      NSString *status = nil;
      NSURL *fresh = [NSURL fileURLWithPath:p];
      [fresh getResourceValue:&status forKey:NSURLUbiquitousItemDownloadingStatusKey error:nil];
      if ([status isEqualToString:NSURLUbiquitousItemDownloadingStatusCurrent]) return 0;
      usleep(100000);
    }
    return 1;
  }
}

/// PencilKit keeps a preference under the process's bundle identifier and traps where there is none: a bare
/// binary (a test's, a script's) is given one. The app has its own and this does nothing.
static void named(void) {
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    CFBundleRef main = CFBundleGetMainBundle();
    if (main && !CFBundleGetIdentifier(main)) {
      CFMutableDictionaryRef info = (CFMutableDictionaryRef)CFBundleGetInfoDictionary(main);
      if (info) CFDictionarySetValue(info, kCFBundleIdentifierKey, CFSTR("dev.ilmi.ink"));
    }
  });
}

API_AVAILABLE(macos(11.0), ios(14.0))
static NSString *nameOf(PKStroke *s) {
  CC_SHA256_CTX c;
  CC_SHA256_Init(&c);
  double at = s.path.creationDate.timeIntervalSinceReferenceDate;
  CC_SHA256_Update(&c, &at, sizeof at);
  if (@available(macOS 13.0, iOS 16.0, *)) {
    uint32_t seed = s.randomSeed;
    CC_SHA256_Update(&c, &seed, sizeof seed);
  }
  const char *ink = s.ink.inkType.UTF8String;
  if (ink) CC_SHA256_Update(&c, ink, (CC_LONG)strlen(ink));
  CGAffineTransform t = s.transform;
  float m[6] = {t.a, t.b, t.c, t.d, t.tx, t.ty};
  CC_SHA256_Update(&c, m, sizeof m);
  uint32_t n = (uint32_t)s.path.count;
  CC_SHA256_Update(&c, &n, sizeof n);
  for (NSUInteger i = 0; i < s.path.count; i++) {
    PKStrokePoint *p = [s.path objectAtIndexedSubscript:i];
    float xy[2] = {p.location.x, p.location.y};
    CC_SHA256_Update(&c, xy, sizeof xy);
  }
  // the eraser cuts a stroke by masking it: what is left is another stroke
  if (s.mask) {
    CGRect b = s.mask.bounds;
    float r[4] = {b.origin.x, b.origin.y, b.size.width, b.size.height};
    CC_SHA256_Update(&c, r, sizeof r);
  }
  unsigned char h[CC_SHA256_DIGEST_LENGTH];
  CC_SHA256_Final(h, &c);
  NSMutableString *hex = [NSMutableString stringWithCapacity:16];
  for (int i = 0; i < 8; i++) [hex appendFormat:@"%02x", h[i]];
  return hex;
}

API_AVAILABLE(macos(11.0), ios(14.0))
static PKDrawing *joined(const uint8_t *recs, size_t len) {
  NSMutableArray<PKStroke *> *all = [NSMutableArray array];
  size_t at = 0;
  while (at + 4 <= len) {
    uint32_t n;
    memcpy(&n, recs + at, 4);
    at += 4;
    if (at + n > len) return nil;
    PKDrawing *one = [[PKDrawing alloc] initWithData:[NSData dataWithBytes:recs + at length:n] error:nil];
    if (!one) return nil;
    [all addObjectsFromArray:one.strokes];
    at += n;
  }
  return [[PKDrawing alloc] initWithStrokes:all];
}

int ilmi_ink_split(const uint8_t *data, size_t len, uint8_t **out, size_t *out_len) {
  @autoreleasepool {
    named();
    if (INK_AVAILABLE) {
      PKDrawing *d = [[PKDrawing alloc] initWithData:[NSData dataWithBytes:data length:len] error:nil];
      if (!d) return 2;
      NSMutableData *recs = [NSMutableData data];
      for (PKStroke *s in d.strokes) {
        NSData *one = [[[PKDrawing alloc] initWithStrokes:@[s]] dataRepresentation];
        double at = s.path.creationDate.timeIntervalSince1970;
        uint32_t n = (uint32_t)one.length;
        [recs appendBytes:nameOf(s).UTF8String length:16];
        [recs appendBytes:&at length:8];
        [recs appendBytes:&n length:4];
        [recs appendData:one];
      }
      return give(recs, out, out_len);
    }
    return 1;
  }
}

int ilmi_ink_join(const uint8_t *recs, size_t len, uint8_t **out, size_t *out_len) {
  @autoreleasepool {
    named();
    if (INK_AVAILABLE) {
      PKDrawing *d = joined(recs, len);
      if (!d) return 2;
      return give([d dataRepresentation], out, out_len);
    }
    return 1;
  }
}

/// The part `r` of a drawing, in its points, as a PNG on nothing, `scale` pixels to the point: every stroke drawn by
/// `stroke.m` (87; an edge about a pixel wide, where PencilKit's own picture has it nearly two), in its light colours.
API_AVAILABLE(macos(11.0), ios(14.0))
static NSData *drawn(PKDrawing *d, CGRect r, double scale) {
  size_t w = (size_t)MAX(1, ceil(r.size.width * scale)), h = (size_t)MAX(1, ceil(r.size.height * scale));
  // (never more than a picture can hold)
  if ((double)w * (double)h > 64e6) { double f = sqrt(64e6 / ((double)w * (double)h)); scale *= f; w = (size_t)MAX(1, ceil(r.size.width * scale)); h = (size_t)MAX(1, ceil(r.size.height * scale)); }
  CGColorSpaceRef cs = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
  CGContextRef c = CGBitmapContextCreate(NULL, w, h, 8, 0, cs, (CGBitmapInfo)kCGImageAlphaPremultipliedLast);
  CGColorSpaceRelease(cs);
  if (!c) return nil;
  CGContextTranslateCTM(c, 0, h);
  CGContextScaleCTM(c, scale, -scale);
  CGContextTranslateCTM(c, -r.origin.x, -r.origin.y);
  ilmi_drawing_draw((__bridge void *)d, c, 0);
  CGImageRef img = CGBitmapContextCreateImage(c);
  CGContextRelease(c);
  if (!img) return nil;
  NSMutableData *png = [NSMutableData data];
  CGImageDestinationRef to = CGImageDestinationCreateWithData((__bridge CFMutableDataRef)png, CFSTR("public.png"), 1, NULL);
  BOOL ok = NO;
  if (to) { CGImageDestinationAddImage(to, img, NULL); ok = CGImageDestinationFinalize(to); CFRelease(to); }
  CGImageRelease(img);
  return ok ? png : nil;
}

/// The drawing's own bounds and a margin, at `scale`, on nothing: the page it is shown on is the reader's. Empty for no strokes.
int ilmi_ink_picture(const uint8_t *recs, size_t len, double scale, uint8_t **out, size_t *out_len) {
  @autoreleasepool {
    named();
    if (INK_AVAILABLE) {
      PKDrawing *d = joined(recs, len);
      if (!d) return 2;
      if (!d.strokes.count) return give([NSData data], out, out_len);
      NSData *png = drawn(d, CGRectIntegral(CGRectInset(d.bounds, -12, -12)), scale);
      if (!png) return 2;
      return give(png, out, out_len);
    }
    return 1;
  }
}

/// The strokes as they lie on a page `w` by `h` points, from its top left corner, at `scale`, on nothing: laid over
/// the page's own picture they are the writing on it (milestone 67). Whatever lies off the page is not drawn.
int ilmi_ink_page(const uint8_t *recs, size_t len, double w, double h, double scale, uint8_t **out, size_t *out_len) {
  @autoreleasepool {
    named();
    if (INK_AVAILABLE) {
      PKDrawing *d = joined(recs, len);
      if (!d || !(w > 0) || !(h > 0)) return 2;
      NSData *png = drawn(d, CGRectMake(0, 0, ceil(w), ceil(h)), scale);
      if (!png) return 2;
      return give(png, out, out_len);
    }
    return 1;
  }
}

/// What a drawing's strokes cover, in its points: four little-endian doubles (left, top, width, height), or nothing for none (milestone 69).
int ilmi_ink_bounds(const uint8_t *data, size_t len, uint8_t **out, size_t *out_len) {
  @autoreleasepool {
    named();
    if (INK_AVAILABLE) {
      PKDrawing *d = [[PKDrawing alloc] initWithData:[NSData dataWithBytes:data length:len] error:nil];
      if (!d) return 2;
      if (!d.strokes.count) return give([NSData data], out, out_len);
      CGRect r = d.bounds;
      double b[4] = {r.origin.x, r.origin.y, r.size.width, r.size.height};
      return give([NSData dataWithBytes:b length:sizeof b], out, out_len);
    }
    return 1;
  }
}

/// A drawing of `lines` lines of handwriting-sized strokes, `per` a line, made up from `seed`: what the tests and a measurement draw on.
int ilmi_ink_sample(uint32_t lines, uint32_t per, uint32_t seed, uint8_t **out, size_t *out_len) {
  @autoreleasepool {
    named();
    if (INK_AVAILABLE) {
      __block uint32_t x = seed ? seed : 1;
      double (^rnd)(void) = ^{ x ^= x << 13; x ^= x >> 17; x ^= x << 5; return (double)(x % 10000) / 10000.0; };
      NSMutableArray<PKStroke *> *all = [NSMutableArray array];
      NSDate *t0 = [NSDate dateWithTimeIntervalSince1970:1794000000 + seed];
#if TARGET_OS_OSX
      PKInk *ink = [[PKInk alloc] initWithInkType:PKInkTypePen color:NSColor.blackColor];
#else
      PKInk *ink = [[PKInk alloc] initWithInkType:PKInkTypePen color:UIColor.blackColor];
#endif
      for (uint32_t l = 0; l < lines; l++) {
        for (uint32_t g = 0; g < per; g++) {
          NSMutableArray<PKStrokePoint *> *pts = [NSMutableArray array];
          double px = 40 + g * 26.0, py = 60 + l * 42.0;
          int n = 8 + (int)(rnd() * 20);
          for (int i = 0; i < n; i++) {
            px += rnd() * 8 - 2;
            py += rnd() * 14 - 7;
            [pts addObject:[[PKStrokePoint alloc] initWithLocation:CGPointMake(px, py) timeOffset:i * 0.016 size:CGSizeMake(2.6, 2.6) opacity:1 force:0.2 + rnd() * 0.7 azimuth:0.8 altitude:1.0]];
          }
          PKStrokePath *path = [[PKStrokePath alloc] initWithControlPoints:pts creationDate:[t0 dateByAddingTimeInterval:(l * per + g) * 0.4]];
          [all addObject:[[PKStroke alloc] initWithInk:ink strokePath:path transform:CGAffineTransformIdentity mask:nil]];
        }
      }
      return give([[[PKDrawing alloc] initWithStrokes:all] dataRepresentation], out, out_len);
    }
    return 1;
  }
}

// ── pages as a PDF (milestone 85) ──
//
// A notebook's sheets, or a PDF's pages, with what is written on them, as one PDF to pass on. Each page is drawn
// as it is: a notebook's paper as its lines and dots (the measures are `src/app/paper.ts`'s), a PDF's page as the
// PDF's own page (its text stays text), and the ink over it as shapes (87: each stroke's outline, `stroke.m`; a
// fountain pen's and a pencil's as PencilKit's picture of them), blended as the reader blends it (a highlighter
// leaves print dark).
//
// `spec` is a record a page: ten little-endian doubles (width, height, in points; the paper's rule; its top; where
// the piece begins on a pageless notebook's long sheet or a number under 0; its left margin and its right, 0 for
// none; its bottom; and up to two places a line is drawn down the sheet, each from the left edge, or a number under
// 0), a u32 paper (0 none, 1 blank, 2 ruled, 3 grid, 4 dotted), a u32 page of the PDF at `src` (from 1; 0 none), two
// u32 lengths, the paper's colour and its lines' (0xffrrggbb where one was chosen, else 0), a u32 that is 1 where
// the paper is dark, the margin line's colour (as the others), and that many bytes each of stroke records as
// `ilmi_ink_join` takes them: the page's own, and those of the sheet before it, drawn a page's height up.

/// A sheet's paper: `rule` between its rules, lines or dots; `left` and `right` its margins, between which the
/// ruling lies; `top` how far down a ruled sheet's first rule is and `bottom` the room under its last (a grid's and
/// dots' room at the head and the foot); `at` how far down the long sheet of a pageless notebook this piece begins
/// (under 0 for a page on its own); `l1`, `l2` where a line is drawn down it (under 0 for none). As `paperLines`
/// has them (milestone 88).
static void rgb(uint32_t v, uint32_t otherwise, double *k) {
  uint32_t u = (v >> 24) ? v : otherwise;
  k[0] = ((u >> 16) & 0xff) / 255.0; k[1] = ((u >> 8) & 0xff) / 255.0; k[2] = (u & 0xff) / 255.0;
}

static void paper(CGContextRef c, uint32_t kind, double w, double h, double rule, double top, double at, double left, double right, double bottom, double l1, double l2, uint32_t color, uint32_t line, uint32_t edge, int dark) {
  // the colours a page setup chose, else white paper and its pale rules; on dark paper the rules are their dark selves
  double pc[3], lc[3], dc[3], mc[3];
  rgb(color, 0xffffff, pc); rgb(line, dark ? 0x353f4b : 0xc3cfdd, lc); rgb(line, dark ? 0x485462 : 0xa9b7c8, dc); rgb(edge, dark ? 0x653f3f : 0xe7b9b9, mc);
  CGContextSetRGBFillColor(c, pc[0], pc[1], pc[2], 1);
  CGContextFillRect(c, CGRectMake(0, 0, w, h));
  if (!(rule >= 2)) rule = kind == 2 ? 24 : 20;
  if (!(left > 0)) left = 0;
  if (!(right > 0)) right = 0;
  bool run = at >= 0;
  double x0 = left, x1 = w - right;
  // where the long sheet's lines from `first` on fall on this piece of it; a page on its own begins at `first`
  double (^from)(double) = ^(double first) {
    if (!run) return first;
    double k = ceil((at - first) / rule - 1e-9);
    if (k < 0) k = 0;
    return first + k * rule - at;
  };
  CGContextSetLineWidth(c, 0.5);
  if (kind == 2) {
    CGContextSetRGBStrokeColor(c, lc[0], lc[1], lc[2], 1);
    double end = run ? h - 1e-6 : h - bottom + 1e-6;
    for (double y = from(top); y <= end; y += rule) { CGContextMoveToPoint(c, x0, y); CGContextAddLineToPoint(c, x1, y); }
    CGContextStrokePath(c);
  } else if (kind == 3 || kind == 4) {
    // a grid, and dots on its crossings: centred in what the margins leave; with no margin at an edge, as before there were any
    bool head = top > 0, foot = !run && bottom > 0;
    double offX = fmod(x1 - x0, rule) / 2;
    double fx = x0 + offX, lx = fx + floor((x1 - offX - fx) / rule + 1e-6) * rule;
    double fy, ly;
    if (run) { fy = from(head ? top : fmod(h, rule) / 2); ly = fy + floor((h - 1e-6 - fy) / rule) * rule; }
    else { double y0 = top, y1 = h - bottom, offY = fmod(y1 - y0, rule) / 2; fy = y0 + offY; ly = fy + floor((y1 - offY - fy) / rule + 1e-6) * rule; }
    if (kind == 3) {
      // each line ends on the grid's outermost line at an edge that has a margin, and runs to the sheet's edge at one that has none
      double cy0 = run ? (head && at < top ? top - at : 0) : (head ? fy : 0), cy1 = foot ? ly : h;
      double rx0 = left > 0 ? fx : 0, rx1 = right > 0 ? lx : w;
      CGContextSetRGBStrokeColor(c, lc[0], lc[1], lc[2], 1);
      for (double y = fy; y <= ly + 1e-6; y += rule) { CGContextMoveToPoint(c, rx0, y); CGContextAddLineToPoint(c, rx1, y); }
      for (double x = fx; x <= lx + 1e-6; x += rule) { CGContextMoveToPoint(c, x, cy0); CGContextAddLineToPoint(c, x, cy1); }
      CGContextStrokePath(c);
    } else {
      CGContextSetRGBFillColor(c, dc[0], dc[1], dc[2], 1);
      double dx0 = left > 0 ? fx : fx + rule, dx1 = right > 0 ? lx : lx - rule;
      double dy0, dy1;
      if (run) { dy0 = head ? fy : from(fmod(h, rule) / 2 + rule); dy1 = h - 1e-6; }
      else { dy0 = head ? fy : fy + rule; dy1 = foot ? ly : ly - rule; }
      for (double y = dy0; y <= dy1 + 1e-6; y += rule)
        for (double x = dx0; x <= dx1 + 1e-6; x += rule) CGContextFillEllipseInRect(c, CGRectMake(x - 0.75, y - 0.75, 1.5, 1.5));
    }
  }
  // a line down a margin, the sheet's whole height
  if ((l1 > 0 && l1 < w) || (l2 > 0 && l2 < w)) {
    CGContextSetRGBStrokeColor(c, mc[0], mc[1], mc[2], 1);
    if (l1 > 0 && l1 < w) { CGContextMoveToPoint(c, l1, 0); CGContextAddLineToPoint(c, l1, h); }
    if (l2 > 0 && l2 < w) { CGContextMoveToPoint(c, l2, 0); CGContextAddLineToPoint(c, l2, h); }
    CGContextStrokePath(c);
  }
}

/// A drawing's strokes over the page, moved `dy` down it: shapes, cut to the page.
API_AVAILABLE(macos(11.0), ios(14.0))
static void inked(CGContextRef c, PKDrawing *d, CGRect box, double dy, int dark) {
  if (!d || !d.strokes.count) return;
  CGContextSaveGState(c);
  CGContextClipToRect(c, box);
  // (the ink as one layer laid on the page: a stroke over another is over it, and all of it darkens what is under)
  CGContextSetBlendMode(c, dark ? kCGBlendModeScreen : kCGBlendModeMultiply);
  CGContextBeginTransparencyLayer(c, NULL);
  CGContextTranslateCTM(c, 0, dy);
  ilmi_drawing_draw((__bridge void *)d, c, dark);
  CGContextEndTransparencyLayer(c);
  CGContextRestoreGState(c);
}

int ilmi_ink_pdf(const uint8_t *spec, size_t len, const uint8_t *src, size_t src_len, const uint8_t *out_path, size_t out_len) {
  @autoreleasepool {
    named();
    if (INK_AVAILABLE) {
      NSString *to = [[NSString alloc] initWithBytes:out_path length:out_len encoding:NSUTF8StringEncoding];
      if (!to) return 2;
      CGPDFDocumentRef from = NULL;
      if (src && src_len) {
        NSString *s = [[NSString alloc] initWithBytes:src length:src_len encoding:NSUTF8StringEncoding];
        if (s) from = CGPDFDocumentCreateWithURL((__bridge CFURLRef)[NSURL fileURLWithPath:s]);
        if (!from) return 3;
      }
      CGContextRef c = CGPDFContextCreateWithURL((__bridge CFURLRef)[NSURL fileURLWithPath:to], NULL, NULL);
      if (!c) { if (from) CGPDFDocumentRelease(from); return 2; }
      int bad = 0;
      size_t at = 0;
      while (at + 112 <= len) {
        double w, h, rule, top, run, left, right, bottom, l1, l2;
        uint32_t kind, page, n, m, color, line, dark, edge;
        memcpy(&w, spec + at, 8); memcpy(&h, spec + at + 8, 8);
        memcpy(&rule, spec + at + 16, 8); memcpy(&top, spec + at + 24, 8); memcpy(&run, spec + at + 32, 8);
        memcpy(&left, spec + at + 40, 8); memcpy(&right, spec + at + 48, 8); memcpy(&bottom, spec + at + 56, 8);
        memcpy(&l1, spec + at + 64, 8); memcpy(&l2, spec + at + 72, 8);
        memcpy(&kind, spec + at + 80, 4); memcpy(&page, spec + at + 84, 4); memcpy(&n, spec + at + 88, 4); memcpy(&m, spec + at + 92, 4);
        memcpy(&color, spec + at + 96, 4); memcpy(&line, spec + at + 100, 4); memcpy(&dark, spec + at + 104, 4); memcpy(&edge, spec + at + 108, 4);
        at += 112;
        if (at + n + m > len || !(w > 0) || !(h > 0)) { bad = 2; break; }
        PKDrawing *d = n ? joined(spec + at, n) : nil;
        at += n;
        // what was written past the foot of the sheet before (a pageless notebook's): drawn at the head of this one
        PKDrawing *above = m ? joined(spec + at, m) : nil;
        at += m;
        CGRect box = CGRectMake(0, 0, w, h);
        CGContextBeginPage(c, &box);
        if (from && page) {
          CGPDFPageRef p = CGPDFDocumentGetPage(from, page);
          if (p) {
            CGContextSaveGState(c);
            CGContextSetRGBFillColor(c, 1, 1, 1, 1);
            CGContextFillRect(c, box);
            CGContextConcatCTM(c, CGPDFPageGetDrawingTransform(p, kCGPDFCropBox, box, 0, true));
            CGContextDrawPDFPage(c, p);
            CGContextRestoreGState(c);
          }
        }
        // from here the page's top left is the origin, as the strokes and the paper have it
        CGContextSaveGState(c);
        CGContextTranslateCTM(c, 0, h);
        CGContextScaleCTM(c, 1, -1);
        if (kind) paper(c, kind, w, h, rule, top, run, left, right, bottom, l1, l2, color, line, edge, dark != 0);
        inked(c, above, box, -h, kind && dark);
        inked(c, d, box, 0, kind && dark);
        CGContextRestoreGState(c);
        CGContextEndPage(c);
      }
      CGPDFContextClose(c);
      CGContextRelease(c);
      if (from) CGPDFDocumentRelease(from);
      return bad;
    }
    return 1;
  }
}

/// A PDF file's pages and its first page's size: a u32 and two doubles, little-endian.
int ilmi_pdf_info(const uint8_t *path, size_t len, uint8_t **out, size_t *out_len) {
  @autoreleasepool {
    NSString *s = [[NSString alloc] initWithBytes:path length:len encoding:NSUTF8StringEncoding];
    CGPDFDocumentRef doc = s ? CGPDFDocumentCreateWithURL((__bridge CFURLRef)[NSURL fileURLWithPath:s]) : NULL;
    if (!doc) return 2;
    uint32_t n = (uint32_t)CGPDFDocumentGetNumberOfPages(doc);
    CGRect box = n ? CGPDFPageGetBoxRect(CGPDFDocumentGetPage(doc, 1), kCGPDFMediaBox) : CGRectZero;
    double wh[2] = {box.size.width, box.size.height};
    NSMutableData *d = [NSMutableData dataWithBytes:&n length:4];
    [d appendBytes:wh length:sizeof wh];
    CGPDFDocumentRelease(doc);
    return give(d, out, out_len);
  }
}
