// A PencilKit drawing as ilmi keeps it (milestone 58): taken apart into its strokes, each named by what it
// is; put together again from them; drawn as a PNG. The same code on the Mac and on iOS, called from Rust.
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

#define INK_AVAILABLE @available(macOS 11.0, iOS 14.0, *)

static int give(NSData *d, uint8_t **out, size_t *out_len) {
  *out_len = d.length;
  *out = malloc(d.length ? d.length : 1);
  if (!*out) return 3;
  memcpy(*out, d.bytes, d.length);
  return 0;
}

void ilmi_ink_free(uint8_t *p) { free(p); }

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

/// The drawing's own bounds and a margin, at `scale`, on nothing: the page it is shown on is the reader's. Empty for no strokes.
int ilmi_ink_picture(const uint8_t *recs, size_t len, double scale, uint8_t **out, size_t *out_len) {
  @autoreleasepool {
    named();
    if (INK_AVAILABLE) {
      PKDrawing *d = joined(recs, len);
      if (!d) return 2;
      if (!d.strokes.count) return give([NSData data], out, out_len);
      CGRect r = CGRectIntegral(CGRectInset(d.bounds, -12, -12));
      __block NSData *png = nil;
#if TARGET_OS_OSX
      // black ink is drawn white under a dark appearance: the picture is always the light one
      [[NSAppearance appearanceNamed:NSAppearanceNameAqua] performAsCurrentDrawingAppearance:^{
        NSImage *img = [d imageFromRect:r scale:scale];
        CGImageRef cg = [img CGImageForProposedRect:NULL context:nil hints:nil];
        if (cg) png = [[[NSBitmapImageRep alloc] initWithCGImage:cg] representationUsingType:NSBitmapImageFileTypePNG properties:@{}];
      }];
#else
      [[UITraitCollection traitCollectionWithUserInterfaceStyle:UIUserInterfaceStyleLight] performAsCurrentTraitCollection:^{
        png = UIImagePNGRepresentation([d imageFromRect:r scale:scale]);
      }];
#endif
      if (!png) return 2;
      return give(png, out, out_len);
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
