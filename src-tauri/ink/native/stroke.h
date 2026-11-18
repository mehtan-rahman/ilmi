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
/// Every stroke of a drawing (`PKDrawing *`), as `ilmi_stroke_draw` draws one: a highlighter's first, the rest over them in order.
void ilmi_drawing_draw(void *drawing, CGContextRef c, int dark);
