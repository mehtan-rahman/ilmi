// A stroke drawn by ilmi itself (milestone 87): see `stroke.m`.

#import <CoreGraphics/CoreGraphics.h>
#import <Foundation/Foundation.h>

/// A stroke made ready to be drawn, any number of times, on any thread: `stroke` is a `PKStroke *`. With `dark`
/// its colour is the one PencilKit shows it in under a dark appearance (black ink is white there). Retained:
/// given back with `ilmi_stroke_free`. Null where there is no PencilKit.
void *ilmi_stroke_make(void *stroke, int dark);
void ilmi_stroke_free(void *made);
/// Drawn into `c`, whose user space is the drawing's points with the origin at the top left and y down.
/// The blend mode and the clip are the caller's.
void ilmi_stroke_draw(void *made, CGContextRef c);
/// What it covers, in the drawing's points.
CGRect ilmi_stroke_bounds(void *made);
/// The same as four doubles: left, top, width, height.
void ilmi_stroke_box(void *made, double *out);
/// 1 when its outline is ilmi's own (a pen, the even line, a highlighter), 0 when PencilKit draws a picture of it
/// (a fountain pen, a pencil: their texture is PencilKit's).
int ilmi_stroke_ours(void *made);
/// 1 for a highlighter's stroke: it lies under every other stroke.
int ilmi_stroke_marker(void *made);
/// How many corners its outline has: for the notes.
int ilmi_stroke_weight(void *made);
/// A pen's or the even line's places, the middle of the outline (`x, y, radius` three doubles each, in the drawing's
/// points), up to `most`; the count there are. 0 for other inks.
int ilmi_stroke_places(void *made, double *out, int most);
/// How smooth a pen's or the even line's outline is on the glass at `k` pixels to the point: its middle walked two
/// pixels at a time, the turn between neighbouring pieces in degrees, the largest (`out[0]`) and the 99th of a hundred
/// (`out[1]`). The count of turns; 0 for other inks.
int ilmi_stroke_turns(void *made, double k, double *out);
/// The checks' tuning of the outline: the walk's step and flatness (points), and how much it is evened (a sigma in
/// points; negative: by the step its points were rounded to, as ilmi draws).
void ilmi_stroke_tune(double step, double flat, double even);
/// Its outline as `ilmi_stroke_draw` fills it, for a layer that shows it (the stroke being written, 2026-11-21): the
/// path (retained: the caller releases it) in the drawing's points, its colour (`rgba`, alpha included), and for a
/// highlighter `round` its half thickness (the path is then also stroked `2 × round` wide, round joins and caps, and
/// the whole laid on at `alpha`; 0 and 1 otherwise). 0 for a stroke PencilKit draws as a picture (no path given).
int ilmi_stroke_outline(void *made, CGPathRef *path, double *rgba, double *round, double *alpha);
/// For a stroke PencilKit draws as a picture (a fountain pen, a pencil): the picture the page is given of it
/// (`ilmi_stroke_shape`'s `i`), the same pixels, and in `box` (four doubles) the drawing's points it covers. Retained;
/// null for a stroke whose outline is ilmi's own.
CGImageRef ilmi_stroke_page_picture(void *made, double *box);
/// Every stroke of a drawing (`PKDrawing *`), as `ilmi_stroke_draw` draws one: a highlighter's first, the rest over them in order.
void ilmi_drawing_draw(void *drawing, CGContextRef c, int dark);
/// What the page draws it as, itself (89): `k` is `p` (a pen's or the even line's outline: `d` an SVG path filled by
/// the nonzero rule in `c`, `o` how much of it shows when not all), `m` (a highlighter's: `d` filled and stroked `r`
/// wide with round joins, the whole laid on at `o`) or `i` (a picture PencilKit made of it: `src` over `box`, the
/// drawing's points); `clip` an SVG path it is cut to, where the eraser of PencilKit's cut it. Nil when it is nothing.
NSDictionary *ilmi_stroke_shape(void *made);
