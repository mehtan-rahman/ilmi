// A stroke drawn by ilmi itself (milestone 87).
//
// PencilKit draws strokes to pixels and softens every edge over about 1.7 of the pixels it draws with, on the
// glass and in a picture alike (BUILD-LOG 86). So ink at rest is drawn here, from the stroke's own path, as an
// outline filled by Core Graphics: an edge is then as sharp as coverage antialiasing makes it, about one pixel,
// at any size, and in a PDF it is a shape, not a picture. PencilKit still takes the Pencil (its canvas shows the
// stroke while it is written) and its `PKStroke` is still what is kept and synced.
//
// What PencilKit makes of a stroke was measured, not read anywhere (its pictures at eight pixels to the point,
// on the Mac and on a simulated iPad alike):
// - a pen and the even line (`pen`, `monoline`): a round nib whose width at a point is twice the point's
//   `size.width` less four, in the stroke's own points; the point's opacity, force, azimuth and `size.height`
//   change nothing; the ends are round. Under about a third of a point wide PencilKit draws a faint hairline;
// - a highlighter (`marker`): a flat nib, a bar a little under one and a half times the point's size long and
//   under half of it thick, lying the way the Pencil leans (the point's azimuth; a finger's is upright); swept
//   across itself it lays three quarters of its colour, swept along itself nearly all of it. Here it is that bar
//   swept along the path and filled once, flat, at three quarters: one tint, also where the stroke crosses itself;
// - a fountain pen and a pencil: a nib and a grain of PencilKit's own. Those are not imitated: a picture of the
//   stroke, by PencilKit, at twice the pixels it is shown with, is drawn in its place.
//
// The outline. The path is PencilKit's own curve (a B-spline through its control points), walked a fifth of a
// point at a time (2026-11-22; half a point showed as straight pieces at 400%); a stroke whose points were rounded
// as they were taken (UIKit's rounded `location`, before 2026-11-22) has the middle of its places evened along the
// path by twice the step it was rounded to, its radii as they are; a run of places that is straight, its width
// changing evenly, is kept as its two ends. Each place
// has a radius. From each place to the next the nib sweeps a band, and a disc at every place rounds the ends, the
// corners and the inner side of a tight curve. All of it is one path filled once by the nonzero rule, every piece
// wound the same way: one stroke is one flat shape, with no seam and no hole where its pieces overlap.

#import "stroke.h"
#import <PencilKit/PencilKit.h>
#import <ImageIO/ImageIO.h>
#import <TargetConditionals.h>
#if TARGET_OS_OSX
#import <AppKit/AppKit.h>
#else
#import <UIKit/UIKit.h>
#endif

#define STROKE_AVAILABLE @available(macOS 11.0, iOS 14.0, *)

/// How far apart the places of a path are, in the stroke's points (a fifth of a point: at four times its size a
/// curve is still not seen as straight pieces; 2026-11-22, was half a point).
static CGFloat STEP = 0.2;
/// A place may be left out when the outline without it is nowhere further than this from the outline with it.
static CGFloat FLAT = 0.004;
typedef struct { CGFloat x, y, r; } Place;

/// How far along the path the places are evened, as many times the step its points were rounded to (a Gaussian's
/// sigma); a negative `EVEN_FIXED` is unset, else that sigma in points for every stroke (the checks' tuning).
static CGFloat EVEN_BY = 2;
static CGFloat EVEN_FIXED = -1;

void ilmi_stroke_tune(double step, double flat, double even) { STEP = step; FLAT = flat; EVEN_FIXED = even; }

/// How far along the path a pen's width is evened (a Gaussian's sigma, in the stroke's points): what the force's
/// noise makes of the edges, a wobble, is taken out; a width is never more than the widest near it.
static CGFloat WIDE = 0;
void ilmi_stroke_tune_width(double sigma) { WIDE = sigma; }

/// The places' radii evened along the path (they are `STEP` apart), each the mean of those within three sigmas
/// either side, weighted as a Gaussian, the window as wide on both sides.
static void widthEvened(Place *at, size_t n, CGFloat sigma) {
  if (sigma <= 0 || n < 3) return;
  long w = (long)ceil(3 * sigma / STEP);
  if (w < 1) return;
  CGFloat *wt = malloc((w + 1) * sizeof(CGFloat)), *r = malloc(n * sizeof(CGFloat));
  for (long k = 0; k <= w; k++) wt[k] = exp(-0.5 * pow(k * STEP / sigma, 2));
  for (size_t i = 0; i < n; i++) {
    long reach = MIN(w, MIN((long)i, (long)(n - 1 - i)));
    CGFloat s = 0, sw = 0;
    for (long k = -reach; k <= reach; k++) { s += wt[labs(k)] * at[i + k].r; sw += wt[labs(k)]; }
    r[i] = s / sw;
  }
  for (size_t i = 0; i < n; i++) at[i].r = r[i];
  free(wt); free(r);
}

/// The step a stroke's points were rounded to, in its own points, or 0 when they were not: UIKit gives a touch's
/// place rounded to the screen's points (or pixels) unless asked for the precise one, which ilmi did not ask for until
/// 2026-11-22. Rounded on the glass and divided by the zoom it was written at, every move from one point to the next
/// is a whole number of one step. Found as the least move, and kept when nine in ten moves are whole numbers of it.
API_AVAILABLE(macos(11.0), ios(14.0))
static CGFloat roundedTo(PKStrokePath *path) {
  NSUInteger n = path.count;
  if (n < 12) return 0;
  CGFloat *d = malloc(2 * n * sizeof(CGFloat));
  size_t m = 0;
  CGPoint was = [path objectAtIndexedSubscript:0].location;
  for (NSUInteger i = 1; i < n; i++) {
    CGPoint p = [path objectAtIndexedSubscript:i].location;
    CGFloat dx = fabs(p.x - was.x), dy = fabs(p.y - was.y);
    if (dx > 1e-4) d[m++] = dx;
    if (dy > 1e-4) d[m++] = dy;
    was = p;
  }
  CGFloat q = 0;
  if (m >= 16) {
    CGFloat least = INFINITY;
    for (size_t i = 0; i < m; i++) least = MIN(least, d[i]);
    if (least > 0.02 && least < 1.5) {
      size_t whole = 0;
      for (size_t i = 0; i < m; i++) { CGFloat k = d[i] / least; if (fabs(k - round(k)) < 0.03) whole++; }
      if (whole * 10 >= m * 9) q = least;
    }
  }
  free(d);
  return q;
}

/// The places' middle evened along the path (they are `STEP` apart): each the mean of those within three sigmas
/// either side, weighted as a Gaussian, the window as wide on both sides (so an end stays where it is). The radii
/// are left as they are: evening never makes a stroke wider.
static void evened(Place *at, size_t n, CGFloat even) {
  if (even <= 0 || n < 3) return;
  long w = (long)ceil(3 * even / STEP);
  if (w < 1) return;
  CGFloat *wt = malloc((w + 1) * sizeof(CGFloat));
  for (long k = 0; k <= w; k++) wt[k] = exp(-0.5 * pow(k * STEP / even, 2));
  CGFloat *x = malloc(n * sizeof(CGFloat)), *y = malloc(n * sizeof(CGFloat));
  for (size_t i = 0; i < n; i++) {
    long reach = MIN(w, MIN((long)i, (long)(n - 1 - i)));
    CGFloat sx = 0, sy = 0, sw = 0;
    for (long k = -reach; k <= reach; k++) { CGFloat q = wt[labs(k)]; sx += q * at[i + k].x; sy += q * at[i + k].y; sw += q; }
    x[i] = sx / sw; y[i] = sy / sw;
  }
  for (size_t i = 0; i < n; i++) { at[i].x = x[i]; at[i].y = y[i]; }
  free(x); free(y); free(wt);
}

API_AVAILABLE(macos(11.0), ios(14.0))
@interface IlmiStroke : NSObject
@property (nonatomic) CGPathRef path;
/// The same outline as an SVG path's `d` (89), for a pen and the even line: the page draws it itself.
@property (nonatomic, strong) NSString *d;
@property (nonatomic) CGColorRef color;
@property (nonatomic) CGRect bounds;
@property (nonatomic) CGPathRef mask;
@property (nonatomic) int corners;
/// A highlighter's: the path is what its nib's middle line sweeps, each piece wound alike, and `round` half the nib's thickness, laid round all of it.
@property (nonatomic) CGFloat round;
@property (nonatomic) CGFloat alpha;
/// A pen's and the even line's places (x, y, radius, in the drawing's points), as the outline is made from them.
@property (nonatomic, strong) NSData *places;
/// The step its points were found rounded to (its own points; 0: not rounded), and the sigma its middle was evened by.
@property (nonatomic) CGFloat step;
@property (nonatomic) CGFloat even;
/// A stroke PencilKit draws: the stroke, and the picture of it last made, with the pixels to the point it was made at.
@property (nonatomic, strong) PKStroke *theirs;
@property (nonatomic) BOOL dark;
@property (nonatomic) CGImageRef picture;
@property (nonatomic) CGFloat pictureScale;
@property (nonatomic) CGRect pictureBox;
@end

@implementation IlmiStroke
- (void)dealloc {
  if (_path) CGPathRelease(_path);
  if (_color) CGColorRelease(_color);
  if (_mask) CGPathRelease(_mask);
  if (_picture) CGImageRelease(_picture);
}
@end

/// A disc, wound as the outline is.
static void disc(CGMutablePathRef p, CGFloat x, CGFloat y, CGFloat r) {
  static const CGFloat k = 0.5522847498;
  CGPathMoveToPoint(p, NULL, x + r, y);
  CGPathAddCurveToPoint(p, NULL, x + r, y - k * r, x + k * r, y - r, x, y - r);
  CGPathAddCurveToPoint(p, NULL, x - k * r, y - r, x - r, y - k * r, x - r, y);
  CGPathAddCurveToPoint(p, NULL, x - r, y + k * r, x - k * r, y + r, x, y + r);
  CGPathAddCurveToPoint(p, NULL, x + k * r, y + r, x + r, y + k * r, x + r, y);
  CGPathCloseSubpath(p);
}

/// The outline of a round nib drawn through `at`: one path, every piece of it wound alike. From each place to the
/// next the nib sweeps a band as wide as it is at either end; a disc at every place rounds the ends and the corners.
static CGPathRef nibOutline(const Place *at, size_t n, int *corners) {
  CGMutablePathRef p = CGPathCreateMutable();
  int count = 0;
  for (size_t i = 0; i < n; i++) {
    disc(p, at[i].x, at[i].y, MAX(at[i].r, 0.05));
    count += 4;
    if (i + 1 == n) break;
    CGFloat dx = at[i + 1].x - at[i].x, dy = at[i + 1].y - at[i].y, len = hypot(dx, dy);
    if (len < 1e-6) continue;
    CGFloat nx = -dy / len, ny = dx / len, a = MAX(at[i].r, 0.05), b = MAX(at[i + 1].r, 0.05);
    CGPathMoveToPoint(p, NULL, at[i].x + nx * a, at[i].y + ny * a);
    CGPathAddLineToPoint(p, NULL, at[i + 1].x + nx * b, at[i + 1].y + ny * b);
    CGPathAddLineToPoint(p, NULL, at[i + 1].x - nx * b, at[i + 1].y - ny * b);
    CGPathAddLineToPoint(p, NULL, at[i].x - nx * a, at[i].y - ny * a);
    CGPathCloseSubpath(p);
    count += 4;
  }
  *corners = count;
  return p;
}

/// A number as an SVG path takes it: two places, no trailing noughts.
static void num(NSMutableString *s, CGFloat v) {
  long n = lround(v * 100);
  if (n < 0) { [s appendString:@"-"]; n = -n; } else if (s.length && isdigit([s characterAtIndex:s.length - 1])) [s appendString:@" "];
  long whole = n / 100, frac = n % 100;
  if (frac == 0) [s appendFormat:@"%ld", whole];
  else if (frac % 10 == 0) [s appendFormat:@"%ld.%ld", whole, frac / 10];
  else [s appendFormat:@"%ld.%02ld", whole, frac];
}

/// What `nibOutline` makes, as an SVG path's `d` (89): the same discs and bands, wound the same way, a hundredth of a point fine.
static NSString *nibSvg(const Place *at, size_t n) {
  NSMutableString *s = [NSMutableString stringWithCapacity:n * 96];
  for (size_t i = 0; i < n; i++) {
    CGFloat r = MAX(at[i].r, 0.05);
    [s appendString:@"M"]; num(s, at[i].x + r); num(s, at[i].y);
    [s appendString:@"a"]; num(s, r); num(s, r); [s appendString:@" 0 1 0"]; num(s, -2 * r); [s appendString:@" 0"];
    [s appendString:@"a"]; num(s, r); num(s, r); [s appendString:@" 0 1 0"]; num(s, 2 * r); [s appendString:@" 0z"];
    if (i + 1 == n) break;
    CGFloat dx = at[i + 1].x - at[i].x, dy = at[i + 1].y - at[i].y, len = hypot(dx, dy);
    if (len < 1e-6) continue;
    CGFloat nx = -dy / len, ny = dx / len, a = r, b = MAX(at[i + 1].r, 0.05);
    [s appendString:@"M"]; num(s, at[i].x + nx * a); num(s, at[i].y + ny * a);
    [s appendString:@"L"]; num(s, at[i + 1].x + nx * b); num(s, at[i + 1].y + ny * b);
    [s appendString:@"L"]; num(s, at[i + 1].x - nx * b); num(s, at[i + 1].y - ny * b);
    [s appendString:@"L"]; num(s, at[i].x - nx * a); num(s, at[i].y - ny * a);
    [s appendString:@"z"];
  }
  return s;
}

static void svgStep(void *info, const CGPathElement *e) {
  NSMutableString *s = (__bridge NSMutableString *)info;
  switch (e->type) {
    case kCGPathElementMoveToPoint: [s appendString:@"M"]; num(s, e->points[0].x); num(s, e->points[0].y); break;
    case kCGPathElementAddLineToPoint: [s appendString:@"L"]; num(s, e->points[0].x); num(s, e->points[0].y); break;
    case kCGPathElementAddQuadCurveToPoint: [s appendString:@"Q"]; for (int i = 0; i < 2; i++) { num(s, e->points[i].x); num(s, e->points[i].y); } break;
    case kCGPathElementAddCurveToPoint: [s appendString:@"C"]; for (int i = 0; i < 3; i++) { num(s, e->points[i].x); num(s, e->points[i].y); } break;
    case kCGPathElementCloseSubpath: [s appendString:@"z"]; break;
  }
}

/// Any path as an SVG path's `d`.
static NSString *pathSvg(CGPathRef p) {
  NSMutableString *s = [NSMutableString string];
  if (p) CGPathApply(p, (__bridge void *)s, svgStep);
  return s;
}

/// The places left once those the outline does not need are gone: a run that is straight, its radius changing evenly, is its two ends.
static size_t thinned(Place *at, size_t n) {
  if (n < 3) return n;
  size_t kept = 1, from = 0;
  for (size_t i = 2; i < n; i++) {
    // can every place between `from` and `i` go?
    BOOL flat = YES;
    Place a = at[from], b = at[i];
    CGFloat dx = b.x - a.x, dy = b.y - a.y, len = hypot(dx, dy);
    for (size_t k = from + 1; k < i && flat; k++) {
      CGFloat f = len < 1e-9 ? 0 : ((at[k].x - a.x) * dx + (at[k].y - a.y) * dy) / (len * len);
      if (f < 0 || f > 1) { flat = NO; break; }
      CGFloat off = hypot(at[k].x - (a.x + f * dx), at[k].y - (a.y + f * dy));
      CGFloat dr = fabs(at[k].r - (a.r + f * (b.r - a.r)));
      if (off + dr > FLAT) flat = NO;
    }
    if (!flat) { at[kept++] = at[i - 1]; from = i - 1; }
  }
  at[kept++] = at[n - 1];
  return kept;
}

API_AVAILABLE(macos(11.0), ios(14.0))
static CGColorRef colorOf(PKStroke *s, BOOL dark, CGFloat alpha) {
  CGColorSpaceRef srgb = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
  CGFloat k[4] = {0, 0, 0, 1};
#if TARGET_OS_OSX
  NSColor *c = [s.ink.color colorUsingColorSpace:NSColorSpace.sRGBColorSpace];
  if (c) { k[0] = c.redComponent; k[1] = c.greenComponent; k[2] = c.blueComponent; k[3] = c.alphaComponent; }
#else
  UIColor *c = s.ink.color;
  // what PencilKit shows the colour as on a dark canvas: black ink is white there, and the rest are turned with it
  if (dark) c = [PKInkingTool convertColor:c fromUserInterfaceStyle:UIUserInterfaceStyleLight to:UIUserInterfaceStyleDark];
  CGColorRef in = CGColorCreateCopyByMatchingToColorSpace(srgb, kCGRenderingIntentDefault, c.CGColor, NULL);
  if (in) {
    const CGFloat *v = CGColorGetComponents(in);
    if (CGColorGetNumberOfComponents(in) >= 4) { k[0] = v[0]; k[1] = v[1]; k[2] = v[2]; k[3] = v[3]; }
    CGColorRelease(in);
  }
#endif
  k[3] *= alpha;
  CGColorRef out = CGColorCreate(srgb, k);
  CGColorSpaceRelease(srgb);
  return out;
}

int ilmi_stroke_seed_drawn(unsigned int seed) { return (seed >> 8) == 0x1DCC5Eu; }

unsigned int ilmi_stroke_seed_mark(unsigned int seed) { return (0x1DCC5Eu << 8) | (seed & 0xFFu); }

void *ilmi_stroke_make(void *stroke, int dark) {
  if (STROKE_AVAILABLE) {
    PKStroke *s = (__bridge PKStroke *)stroke;
    if (!s) return NULL;
    IlmiStroke *g = [IlmiStroke new];
    g.dark = dark != 0;
    PKInkType type = s.ink.inkType;
    BOOL round = [type isEqualToString:PKInkTypePen];
    if (@available(macOS 14.0, iOS 17.0, *)) round = round || [type isEqualToString:PKInkTypeMonoline];
    BOOL marker = [type isEqualToString:PKInkTypeMarker];
    // a stroke PencilKit drew and that was kept as it drew it (`LiveInk.pencilKit`, 2026-11-23): its own picture, as
    // for a fountain pen and a pencil, so nothing of it changes when the Pencil lifts
    BOOL drewIt = NO;
    if (@available(macOS 13.0, iOS 16.0, *)) drewIt = ilmi_stroke_seed_drawn(s.randomSeed);
    if ((!round && !marker) || drewIt) {
      g.theirs = s;
      g.bounds = s.renderBounds;
      return (__bridge_retained void *)g;
    }
    PKStrokePath *path = s.path;
    CGAffineTransform m = s.transform;
    // how much the stroke's own transform makes of a length
    CGFloat grow = sqrt(fabs(m.a * m.d - m.b * m.c));
    // points rounded as they were taken: the steps evened out (twice the step, a Gaussian along the path)
    CGFloat step = roundedTo(path);
    CGFloat even = EVEN_FIXED >= 0 ? EVEN_FIXED * grow : EVEN_BY * step * grow;
    g.step = step;
    g.even = even;
    NSUInteger count = path.count;
    if (marker) {
      // the nib's middle line at each place, and what it sweeps from each place to the next
      CGMutablePathRef p = CGPathCreateMutable();
      __block BOOL any = NO;
      __block CGPoint a0 = CGPointZero, b0 = CGPointZero;
      __block CGFloat thick = 0;
      __block int pieces = 0;
      void (^nib)(PKStrokePoint *) = ^(PKStrokePoint *q) {
        CGFloat half = MAX(0, (1.336 * q.size.width - 0.47 * q.size.height) / 2);
        CGPoint u = CGPointMake(cos(q.azimuth) * half, sin(q.azimuth) * half);
        CGPoint a = CGPointApplyAffineTransform(CGPointMake(q.location.x + u.x, q.location.y + u.y), m);
        CGPoint b = CGPointApplyAffineTransform(CGPointMake(q.location.x - u.x, q.location.y - u.y), m);
        thick = MAX(thick, 0.235 * q.size.height * grow);
        if (any) {
          // (wound one way whichever way the nib was drawn across)
          CGFloat area = (a0.x * a.y - a.x * a0.y) + (a.x * b.y - b.x * a.y) + (b.x * b0.y - b0.x * b.y) + (b0.x * a0.y - a0.x * b0.y);
          CGPathMoveToPoint(p, NULL, a0.x, a0.y);
          if (area >= 0) { CGPathAddLineToPoint(p, NULL, a.x, a.y); CGPathAddLineToPoint(p, NULL, b.x, b.y); CGPathAddLineToPoint(p, NULL, b0.x, b0.y); }
          else { CGPathAddLineToPoint(p, NULL, b0.x, b0.y); CGPathAddLineToPoint(p, NULL, b.x, b.y); CGPathAddLineToPoint(p, NULL, a.x, a.y); }
          CGPathCloseSubpath(p);
          pieces++;
        } else {
          CGPathMoveToPoint(p, NULL, a.x, a.y);
          CGPathAddLineToPoint(p, NULL, b.x, b.y);
          CGPathCloseSubpath(p);
        }
        any = YES; a0 = a; b0 = b;
      };
      if (count == 1) nib([path objectAtIndexedSubscript:0]);
      else if (count > 1) {
        [path enumerateInterpolatedPointsInRange:[[PKFloatRange alloc] initWithLowerBound:0 upperBound:count - 1] strideByDistance:1.5 usingBlock:^(PKStrokePoint *q, BOOL *stop) { nib(q); }];
        nib([path interpolatedPointAt:count - 1]);
      }
      g.path = p;
      g.round = MAX(thick, 0.05);
      g.corners = pieces * 4;
      g.alpha = 0.75;
      g.color = colorOf(s, g.dark, 1);
      g.bounds = CGRectInset(CGPathGetBoundingBox(p), -g.round - 1, -g.round - 1);
#if !TARGET_OS_OSX
      if (s.mask) { CGAffineTransform mm = m; g.mask = CGPathCreateCopyByTransformingPath(s.mask.CGPath, &mm); }
#endif
      return (__bridge_retained void *)g;
    }
    __block size_t n = 0, room = 256;
    __block Place *at = malloc(room * sizeof(Place));
    __block CGFloat faint = 1;
    void (^add)(PKStrokePoint *) = ^(PKStrokePoint *p) {
      if (n == room) { room *= 2; at = realloc(at, room * sizeof(Place)); }
      CGPoint q = CGPointApplyAffineTransform(p.location, m);
      CGFloat w;
      w = 2 * p.size.width - 4;
      // under a third of a point PencilKit draws a hairline, fainter the thinner it would have been
      if (w < 0.3) { faint = MIN(faint, MAX(0.16, w / 0.3)); w = 0.3; }
      at[n++] = (Place){q.x, q.y, w * grow / 2};
    };
    if (count == 1) add([path objectAtIndexedSubscript:0]);
    else if (count > 1) {
      [path enumerateInterpolatedPointsInRange:[[PKFloatRange alloc] initWithLowerBound:0 upperBound:count - 1] strideByDistance:STEP usingBlock:^(PKStrokePoint *p, BOOL *stop) { add(p); }];
      // (the walk stops short of the path's end by up to a step)
      PKStrokePoint *last = [path interpolatedPointAt:count - 1];
      if (n == 0 || hypot(at[n - 1].x - CGPointApplyAffineTransform(last.location, m).x, at[n - 1].y - CGPointApplyAffineTransform(last.location, m).y) > 0.01) add(last);
    }
    evened(at, n, even);
    widthEvened(at, n, WIDE * grow);
    n = thinned(at, n);
    g.places = [NSData dataWithBytes:at length:n * sizeof(Place)];
    int corners = 0;
    g.path = nibOutline(at, n, &corners);
    g.d = nibSvg(at, n);
    g.corners = corners;
    free(at);
    g.color = colorOf(s, g.dark, faint);
    g.bounds = CGRectInset(CGPathGetBoundingBox(g.path), -1, -1);
    if (s.mask) {
#if TARGET_OS_OSX
      g.mask = NULL;
#else
      CGAffineTransform mm = m;
      g.mask = CGPathCreateCopyByTransformingPath(s.mask.CGPath, &mm);
#endif
    }
    return (__bridge_retained void *)g;
  }
  return NULL;
}

void ilmi_stroke_free(void *made) {
  if (STROKE_AVAILABLE) {
    if (made) { IlmiStroke *g = (__bridge_transfer IlmiStroke *)made; g = nil; }
  }
}

CGRect ilmi_stroke_bounds(void *made) {
  if (STROKE_AVAILABLE) { return made ? ((__bridge IlmiStroke *)made).bounds : CGRectNull; }
  return CGRectNull;
}

void ilmi_stroke_box(void *made, double *out) {
  CGRect b = ilmi_stroke_bounds(made);
  if (CGRectIsNull(b)) b = CGRectZero;
  out[0] = b.origin.x; out[1] = b.origin.y; out[2] = b.size.width; out[3] = b.size.height;
}

int ilmi_stroke_ours(void *made) {
  if (STROKE_AVAILABLE) { return made && ((__bridge IlmiStroke *)made).theirs == nil; }
  return 0;
}

int ilmi_stroke_marker(void *made) {
  if (STROKE_AVAILABLE) { return made && ((__bridge IlmiStroke *)made).round > 0; }
  return 0;
}

int ilmi_stroke_places(void *made, double *out, int most) {
  if (STROKE_AVAILABLE) {
    if (!made) return 0;
    NSData *d = ((__bridge IlmiStroke *)made).places;
    int n = (int)(d.length / sizeof(Place));
    const Place *at = d.bytes;
    for (int i = 0; i < n && i < most; i++) { out[3 * i] = at[i].x; out[3 * i + 1] = at[i].y; out[3 * i + 2] = at[i].r; }
    return n;
  }
  return 0;
}

int ilmi_stroke_turns(void *made, double k, double *out) {
  if (STROKE_AVAILABLE) {
    out[0] = out[1] = 0;
    if (!made) return 0;
    NSData *d = ((__bridge IlmiStroke *)made).places;
    size_t n = d.length / sizeof(Place);
    const Place *at = d.bytes;
    if (n < 3) return 0;
    // the middle walked two pixels at a time, at k pixels to the point
    size_t cap = 4096, m = 0;
    CGFloat *rx = malloc(cap * sizeof(CGFloat)), *ry = malloc(cap * sizeof(CGFloat));
    rx[m] = at[0].x * k; ry[m++] = at[0].y * k;
    CGFloat carry = 0, step = 2;
    for (size_t i = 1; i < n; i++) {
      CGFloat ax = at[i - 1].x * k, ay = at[i - 1].y * k, bx = at[i].x * k, by = at[i].y * k, len = hypot(bx - ax, by - ay), t = step - carry;
      while (t <= len) {
        if (m == cap) { cap *= 2; rx = realloc(rx, cap * sizeof(CGFloat)); ry = realloc(ry, cap * sizeof(CGFloat)); }
        rx[m] = ax + (bx - ax) * t / len; ry[m++] = ay + (by - ay) * t / len; t += step;
      }
      carry = len - (t - step);
    }
    size_t q = 0;
    CGFloat *turn = malloc(MAX(m, 1) * sizeof(CGFloat));
    for (size_t i = 2; i < m; i++) {
      CGFloat a1 = atan2(ry[i - 1] - ry[i - 2], rx[i - 1] - rx[i - 2]), a2 = atan2(ry[i] - ry[i - 1], rx[i] - rx[i - 1]);
      turn[q++] = fabs(remainder(a2 - a1, 2 * M_PI)) * 180 / M_PI;
    }
    for (size_t i = 1; i < q; i++) { CGFloat v = turn[i]; long j = (long)i - 1; while (j >= 0 && turn[j] > v) { turn[j + 1] = turn[j]; j--; } turn[j + 1] = v; }
    if (q) { out[0] = turn[q - 1]; out[1] = turn[(size_t)(q * 0.99)]; }
    free(rx); free(ry); free(turn);
    return (int)q;
  }
  return 0;
}

void ilmi_stroke_evening(void *made, double *out) {
  out[0] = out[1] = 0;
  if (STROKE_AVAILABLE) {
    if (!made) return;
    IlmiStroke *g = (__bridge IlmiStroke *)made;
    out[0] = g.step; out[1] = g.even;
  }
}

int ilmi_stroke_weight(void *made) {
  if (STROKE_AVAILABLE) { return made ? ((__bridge IlmiStroke *)made).corners : 0; }
  return 0;
}

/// PencilKit's picture of one stroke, as many pixels to the point as `scale`.
API_AVAILABLE(macos(11.0), ios(14.0))
static CGImageRef pictured(PKStroke *s, CGRect box, CGFloat scale, BOOL dark) {
  PKDrawing *d = [[PKDrawing alloc] initWithStrokes:@[s]];
  __block CGImageRef img = NULL;
#if TARGET_OS_OSX
  [[NSAppearance appearanceNamed:NSAppearanceNameAqua] performAsCurrentDrawingAppearance:^{
    img = CGImageRetain([[d imageFromRect:box scale:scale] CGImageForProposedRect:NULL context:nil hints:nil]);
  }];
#else
  [[UITraitCollection traitCollectionWithUserInterfaceStyle:dark ? UIUserInterfaceStyleDark : UIUserInterfaceStyleLight] performAsCurrentTraitCollection:^{
    img = CGImageRetain([d imageFromRect:box scale:scale].CGImage);
  }];
#endif
  return img;
}

void ilmi_stroke_draw(void *made, CGContextRef c) {
  if (STROKE_AVAILABLE) {
    if (!made || !c) return;
    IlmiStroke *g = (__bridge IlmiStroke *)made;
    if (!g.theirs) {
      if (!g.path) return;
      if (g.mask) { CGContextSaveGState(c); CGContextAddPath(c, g.mask); CGContextClip(c); }
      if (g.round > 0) {
        // a highlighter: what the nib swept and its thickness round that, as one flat tint laid on at once
        CGContextSaveGState(c);
        CGContextSetAlpha(c, g.alpha * CGColorGetAlpha(g.color));
        CGContextBeginTransparencyLayerWithRect(c, g.bounds, NULL);
        CGColorRef solid = CGColorCreateCopyWithAlpha(g.color, 1);
        CGContextSetFillColorWithColor(c, solid);
        CGContextSetStrokeColorWithColor(c, solid);
        CGContextAddPath(c, g.path);
        CGContextFillPath(c);
        CGContextAddPath(c, g.path);
        CGContextSetLineWidth(c, g.round * 2);
        CGContextSetLineJoin(c, kCGLineJoinRound);
        CGContextSetLineCap(c, kCGLineCapRound);
        CGContextStrokePath(c);
        CGColorRelease(solid);
        CGContextEndTransparencyLayer(c);
        CGContextRestoreGState(c);
      } else {
        CGContextAddPath(c, g.path);
        CGContextSetFillColorWithColor(c, g.color);
        CGContextFillPath(c);
      }
      if (g.mask) CGContextRestoreGState(c);
      return;
    }
    // PencilKit's own picture of it, made with twice the pixels it is drawn into (its edges are soft over nearly two
    // of the pixels it draws with), and kept for the next time at this size
    CGAffineTransform m = CGContextGetCTM(c);
    CGFloat px = sqrt(fabs(m.a * m.d - m.b * m.c));
    CGFloat want = MIN(MAX(px * 2, 1), 12);
    CGImageRef img = NULL;
    CGRect box;
    @synchronized (g) {
      if (!g.picture || fabs(g.pictureScale - want) > 0.01) {
        CGRect b = CGRectIntegral(CGRectInset(g.theirs.renderBounds, -2, -2));
        // (never a picture past sixteen million pixels: a stroke across a page far zoomed into)
        CGFloat most = MIN(sqrt(16e6 / MAX(1, b.size.width * b.size.height)), 8000 / MAX(1, MAX(b.size.width, b.size.height)));
        CGImageRef fresh = pictured(g.theirs, b, MIN(want, most), g.dark);
        if (g.picture) CGImageRelease(g.picture);
        g.picture = fresh;
        g.pictureScale = want;
        g.pictureBox = b;
      }
      img = CGImageRetain(g.picture);
      box = g.pictureBox;
    }
    if (!img) return;
    CGContextSaveGState(c);
    CGContextSetInterpolationQuality(c, kCGInterpolationHigh);
    // a picture is drawn from its foot up
    CGContextTranslateCTM(c, box.origin.x, box.origin.y + box.size.height);
    CGContextScaleCTM(c, 1, -1);
    CGContextDrawImage(c, CGRectMake(0, 0, box.size.width, box.size.height), img);
    CGContextRestoreGState(c);
    CGImageRelease(img);
  }
}

int ilmi_stroke_outline(void *made, CGPathRef *path, double *rgba, double *round, double *alpha) {
  if (STROKE_AVAILABLE) {
    if (!made) return 0;
    IlmiStroke *g = (__bridge IlmiStroke *)made;
    if (g.theirs || !g.path) return 0;
    if (path) *path = CGPathRetain(g.path);
    const CGFloat *v = g.color ? CGColorGetComponents(g.color) : NULL;
    size_t n = g.color ? CGColorGetNumberOfComponents(g.color) : 0;
    if (rgba) {
      if (v && n >= 4) { rgba[0] = v[0]; rgba[1] = v[1]; rgba[2] = v[2]; rgba[3] = v[3]; }
      else if (v && n == 2) { rgba[0] = rgba[1] = rgba[2] = v[0]; rgba[3] = v[1]; }
      else { rgba[0] = rgba[1] = rgba[2] = 0; rgba[3] = 1; }
    }
    if (round) *round = g.round;
    if (alpha) *alpha = g.round > 0 ? g.alpha : 1;
    return 1;
  }
  return 0;
}

/// A colour as `#rrggbb`, and how much of it shows.
static NSString *hexOf(CGColorRef c, CGFloat *alpha) {
  const CGFloat *v = c ? CGColorGetComponents(c) : NULL;
  if (!v || CGColorGetNumberOfComponents(c) < 4) { *alpha = 1; return @"#000000"; }
  *alpha = v[3];
  return [NSString stringWithFormat:@"#%02x%02x%02x", (int)lround(MIN(MAX(v[0], 0), 1) * 255), (int)lround(MIN(MAX(v[1], 0), 1) * 255), (int)lround(MIN(MAX(v[2], 0), 1) * 255)];
}

/// PencilKit's own picture of a stroke it draws, as the page is given it: six pixels to the point, fewer for one that covers much.
API_AVAILABLE(macos(11.0), ios(14.0))
static CGImageRef pagePicture(IlmiStroke *g, CGRect *box) {
  CGRect b = CGRectIntegral(CGRectInset(g.theirs.renderBounds, -2, -2));
  CGFloat scale = MIN(6, MIN(sqrt(4e6 / MAX(1, b.size.width * b.size.height)), 4000 / MAX(1, MAX(b.size.width, b.size.height))));
  if (box) *box = b;
  return pictured(g.theirs, b, MAX(scale, 0.5), g.dark);
}

CGImageRef ilmi_stroke_page_picture(void *made, double *box) {
  if (STROKE_AVAILABLE) {
    if (!made) return NULL;
    IlmiStroke *g = (__bridge IlmiStroke *)made;
    if (!g.theirs) return NULL;
    CGRect b;
    CGImageRef img = pagePicture(g, &b);
    if (box) { box[0] = b.origin.x; box[1] = b.origin.y; box[2] = b.size.width; box[3] = b.size.height; }
    return img;
  }
  return NULL;
}

NSDictionary *ilmi_stroke_shape(void *made) {
  if (STROKE_AVAILABLE) {
    if (!made) return nil;
    IlmiStroke *g = (__bridge IlmiStroke *)made;
    NSMutableDictionary *m = [NSMutableDictionary dictionary];
    if (g.theirs) {
      // PencilKit's own picture of it, six pixels to the point (fewer for one that covers much): an image in the page
      CGRect b;
      CGImageRef img = pagePicture(g, &b);
      if (!img) return nil;
      NSMutableData *png = [NSMutableData data];
      CGImageDestinationRef to = CGImageDestinationCreateWithData((__bridge CFMutableDataRef)png, CFSTR("public.png"), 1, NULL);
      BOOL ok = NO;
      if (to) { CGImageDestinationAddImage(to, img, NULL); ok = CGImageDestinationFinalize(to); CFRelease(to); }
      CGImageRelease(img);
      if (!ok) return nil;
      m[@"k"] = @"i";
      m[@"box"] = @[@(b.origin.x), @(b.origin.y), @(b.size.width), @(b.size.height)];
      m[@"src"] = [@"data:image/png;base64," stringByAppendingString:[png base64EncodedStringWithOptions:0]];
      return m;
    }
    if (!g.path) return nil;
    CGFloat alpha = 1;
    m[@"c"] = hexOf(g.color, &alpha);
    if (g.round > 0) {
      m[@"k"] = @"m";
      m[@"d"] = pathSvg(g.path);
      m[@"r"] = @(round(g.round * 200) / 100);
      m[@"o"] = @(round(g.alpha * alpha * 1000) / 1000);
    } else {
      m[@"k"] = @"p";
      m[@"d"] = g.d ?: pathSvg(g.path);
      if (alpha < 0.999) m[@"o"] = @(round(alpha * 1000) / 1000);
    }
    if (g.mask) m[@"clip"] = pathSvg(g.mask);
    return m;
  }
  return nil;
}

void ilmi_drawing_draw(void *drawing, CGContextRef c, int dark) {
  if (STROKE_AVAILABLE) {
    PKDrawing *d = (__bridge PKDrawing *)drawing;
    CGRect clip = CGContextGetClipBoundingBox(c);
    // a highlighter's strokes lie under everything else, as PencilKit lays them: what is written over one stays as it is
    for (int pass = 0; pass < 2; pass++) {
      for (PKStroke *s in d.strokes) {
        if ([s.ink.inkType isEqualToString:PKInkTypeMarker] != (pass == 0)) continue;
        if (!CGRectIntersectsRect(CGRectInset(s.renderBounds, -2, -2), clip)) continue;
        void *g = ilmi_stroke_make((__bridge void *)s, dark);
        ilmi_stroke_draw(g, c);
        ilmi_stroke_free(g);
      }
    }
  }
}
