//! ilmi's ink (milestones 58, 69, 82).
//!
//! Two things, both PencilKit's. On iOS the canvases over the web view that the Pencil writes on where it
//! lands, which is the plugin proper: a Swift package (`ios/`) Tauri builds and links, reached through
//! [`Ink`]: where the sheets lie and what they hold, and since 82 the tool held (the page's own bar, not
//! PencilKit's picker), undo and redo, writing with a finger, and the system's colour wheel. And, on the Mac as on iOS, what reads a
//! drawing (`native/ink.m`): [`split`] takes one apart into its strokes, each with a name that outlives a
//! save, [`join`] puts strokes together as the drawing PencilKit writes, [`picture`] draws them as a PNG, and
//! [`page_picture`] (milestone 67) draws them as they lie on a page of a size: the writing on a book's page.
//! The store keeps strokes, a row each; the drawing and the picture are made from them when they are read.

use serde::{Deserialize, Serialize};
use tauri::{plugin::{Builder, TauriPlugin}, Runtime};

/// One stroke of a drawing.
#[derive(Debug, Clone, PartialEq)]
pub struct Stroke {
    /// What it is found by: a hash over when it was made, its seed and its points. The same after a save.
    pub key: String,
    /// When it was drawn, in seconds since 1970: the order the strokes lie in.
    pub at: f64,
    /// A `PKDrawing` of this one stroke.
    pub data: Vec<u8>,
}

#[cfg(any(target_os = "macos", target_os = "ios"))]
mod native {
    extern "C" {
        pub fn ilmi_ink_split(data: *const u8, len: usize, out: *mut *mut u8, out_len: *mut usize) -> i32;
        pub fn ilmi_ink_join(recs: *const u8, len: usize, out: *mut *mut u8, out_len: *mut usize) -> i32;
        pub fn ilmi_ink_picture(recs: *const u8, len: usize, scale: f64, out: *mut *mut u8, out_len: *mut usize) -> i32;
        pub fn ilmi_ink_page(recs: *const u8, len: usize, w: f64, h: f64, scale: f64, out: *mut *mut u8, out_len: *mut usize) -> i32;
        pub fn ilmi_ink_bounds(data: *const u8, len: usize, out: *mut *mut u8, out_len: *mut usize) -> i32;
        pub fn ilmi_ink_shapes(recs: *const u8, len: usize, out: *mut *mut u8, out_len: *mut usize) -> i32;
        pub fn ilmi_ink_names_twice(out: *mut *mut u8, out_len: *mut usize) -> i32;
        pub fn ilmi_ink_sample(lines: u32, per: u32, seed: u32, out: *mut *mut u8, out_len: *mut usize) -> i32;
        pub fn ilmi_ink_pdf(spec: *const u8, len: usize, src: *const u8, src_len: usize, out_path: *const u8, out_len: usize) -> i32;
        pub fn ilmi_pdf_info(path: *const u8, len: usize, out: *mut *mut u8, out_len: *mut usize) -> i32;
        pub fn ilmi_ink_free(p: *mut u8);
        pub fn ilmi_icloud_folder(out: *mut *mut u8, out_len: *mut usize) -> i32;
        pub fn ilmi_icloud_down(path: *const u8, len: usize, seconds: u32) -> i32;
    }

    pub fn call(f: impl FnOnce(*mut *mut u8, *mut usize) -> i32) -> Result<Vec<u8>, String> {
        let mut out: *mut u8 = std::ptr::null_mut();
        let mut len: usize = 0;
        match f(&mut out, &mut len) {
            0 => {
                // SAFETY: on 0 the callee has set `out` to `len` bytes it allocated, which are copied and given back
                let bytes = unsafe { std::slice::from_raw_parts(out, len).to_vec() };
                unsafe { ilmi_ink_free(out) };
                Ok(bytes)
            }
            1 => Err("no PencilKit on this system".to_string()),
            _ => Err("not a drawing".to_string()),
        }
    }
}

fn records(strokes: &[&[u8]]) -> Vec<u8> {
    let mut recs = Vec::with_capacity(strokes.iter().map(|s| s.len() + 4).sum());
    for s in strokes {
        recs.extend_from_slice(&(s.len() as u32).to_le_bytes());
        recs.extend_from_slice(s);
    }
    recs
}

/// A drawing's strokes, in the order it holds them.
#[cfg(any(target_os = "macos", target_os = "ios"))]
pub fn split(drawing: &[u8]) -> Result<Vec<Stroke>, String> {
    // SAFETY: the pointers are to `drawing` and to the two outs `call` owns
    let recs = native::call(|out, len| unsafe { native::ilmi_ink_split(drawing.as_ptr(), drawing.len(), out, len) })?;
    let mut strokes = Vec::new();
    let mut at = 0;
    while at + 28 <= recs.len() {
        let key = String::from_utf8_lossy(&recs[at..at + 16]).into_owned();
        let when = f64::from_le_bytes(recs[at + 16..at + 24].try_into().unwrap());
        let n = u32::from_le_bytes(recs[at + 24..at + 28].try_into().unwrap()) as usize;
        at += 28;
        if at + n > recs.len() {
            return Err("not a drawing".to_string());
        }
        strokes.push(Stroke { key, at: when, data: recs[at..at + n].to_vec() });
        at += n;
    }
    Ok(strokes)
}

/// The drawing these strokes make, as PencilKit writes it.
#[cfg(any(target_os = "macos", target_os = "ios"))]
pub fn join(strokes: &[&[u8]]) -> Result<Vec<u8>, String> {
    let recs = records(strokes);
    // SAFETY: as in `split`
    native::call(|out, len| unsafe { native::ilmi_ink_join(recs.as_ptr(), recs.len(), out, len) })
}

/// The strokes drawn as a PNG at `scale`, cut to what they cover; empty for none.
#[cfg(any(target_os = "macos", target_os = "ios"))]
pub fn picture(strokes: &[&[u8]], scale: f64) -> Result<Vec<u8>, String> {
    let recs = records(strokes);
    // SAFETY: as in `split`
    native::call(|out, len| unsafe { native::ilmi_ink_picture(recs.as_ptr(), recs.len(), scale, out, len) })
}

/// The strokes as they lie on a page `w` by `h` points, as a PNG of the whole page at `scale`, on nothing (milestone 67).
#[cfg(any(target_os = "macos", target_os = "ios"))]
pub fn page_picture(strokes: &[&[u8]], w: f64, h: f64, scale: f64) -> Result<Vec<u8>, String> {
    let recs = records(strokes);
    // SAFETY: as in `split`
    native::call(|out, len| unsafe { native::ilmi_ink_page(recs.as_ptr(), recs.len(), w, h, scale, out, len) })
}

/// What the strokes of a drawing cover, in its own points: left, top, width, height. None for no strokes (milestone 69).
#[cfg(any(target_os = "macos", target_os = "ios"))]
pub fn bounds(drawing: &[u8]) -> Result<Option<[f64; 4]>, String> {
    // SAFETY: as in `split`
    let b = native::call(|out, len| unsafe { native::ilmi_ink_bounds(drawing.as_ptr(), drawing.len(), out, len) })?;
    if b.len() < 32 {
        return Ok(None);
    }
    let at = |i: usize| f64::from_le_bytes(b[i * 8..i * 8 + 8].try_into().unwrap());
    Ok(Some([at(0), at(1), at(2), at(3)]))
}

/// The strokes as the page draws them itself (milestone 89): a JSON list, a stroke each, its name and its outline
/// as an SVG path (`native/stroke.m`, `ilmi_stroke_shape`).
#[cfg(any(target_os = "macos", target_os = "ios"))]
pub fn shapes(strokes: &[&[u8]]) -> Result<String, String> {
    let recs = records(strokes);
    // SAFETY: as in `split`
    let json = native::call(|out, len| unsafe { native::ilmi_ink_shapes(recs.as_ptr(), recs.len(), out, len) })?;
    String::from_utf8(json).map_err(|e| e.to_string())
}

/// A made-up drawing: `lines` lines of `per` strokes each.
#[cfg(any(target_os = "macos", target_os = "ios"))]
pub fn sample(lines: u32, per: u32, seed: u32) -> Result<Vec<u8>, String> {
    // SAFETY: as in `split`
    native::call(|out, len| unsafe { native::ilmi_ink_sample(lines, per, seed, out, len) })
}

#[cfg(not(any(target_os = "macos", target_os = "ios")))]
pub fn split(_drawing: &[u8]) -> Result<Vec<Stroke>, String> {
    Err("no PencilKit on this system".to_string())
}
#[cfg(not(any(target_os = "macos", target_os = "ios")))]
pub fn join(strokes: &[&[u8]]) -> Result<Vec<u8>, String> {
    let _ = records(strokes);
    Err("no PencilKit on this system".to_string())
}
#[cfg(not(any(target_os = "macos", target_os = "ios")))]
pub fn picture(_strokes: &[&[u8]], _scale: f64) -> Result<Vec<u8>, String> {
    Err("no PencilKit on this system".to_string())
}
#[cfg(not(any(target_os = "macos", target_os = "ios")))]
pub fn page_picture(_strokes: &[&[u8]], _w: f64, _h: f64, _scale: f64) -> Result<Vec<u8>, String> {
    Err("no PencilKit on this system".to_string())
}
#[cfg(not(any(target_os = "macos", target_os = "ios")))]
pub fn shapes(_strokes: &[&[u8]]) -> Result<String, String> {
    Err("no PencilKit on this system".to_string())
}

#[cfg(not(any(target_os = "macos", target_os = "ios")))]
pub fn bounds(_drawing: &[u8]) -> Result<Option<[f64; 4]>, String> {
    Err("no PencilKit on this system".to_string())
}
#[cfg(not(any(target_os = "macos", target_os = "ios")))]
pub fn sample(_lines: u32, _per: u32, _seed: u32) -> Result<Vec<u8>, String> {
    Err("no PencilKit on this system".to_string())
}

/// One page of a PDF made of pages and what is written on them (milestone 85).
#[derive(Debug, Clone, Default)]
pub struct PdfPage {
    /// Its size, in points.
    pub w: f64,
    pub h: f64,
    /// A notebook's sheet: `blank`, `ruled`, `grid` or `dotted`.
    pub paper: Option<String>,
    /// A PDF's page: which of the source's, from 1.
    pub source: Option<u32>,
    /// What is written on it: a `PKDrawing` a stroke.
    pub strokes: Vec<Vec<u8>>,
    /// The paper's measures, in points, where its page setup says them: how far apart its rules, lines or dots are,
    /// its margins (how far in from the left and the right edge the ruling begins and ends), how far down its first
    /// rule is and how much room its last leaves (a grid's and dots' room at the head and the foot), and where a line
    /// is drawn down it, each from the left edge (88).
    pub rule: Option<f64>,
    pub left: Option<f64>,
    pub right: Option<f64>,
    pub top: Option<f64>,
    pub bottom: Option<f64>,
    pub lines: Vec<f64>,
    /// A piece of a pageless notebook's long sheet: how far down it this piece begins.
    pub at: Option<f64>,
    /// What is written on the sheet before, which may run past its foot onto this one.
    pub above: Vec<Vec<u8>>,
    /// The paper's colour and its lines', as 0xrrggbb, where they were chosen (87); `dark` when the paper is dark, and
    /// ink is drawn on it as PencilKit shows it on a dark canvas.
    pub color: Option<u32>,
    pub line: Option<u32>,
    pub dark: bool,
    /// The margin line's colour, where one was chosen.
    pub margin: Option<u32>,
}

/// `pages` written as one PDF at `out`: each its paper or its page of the PDF at `source`, drawn as they are, and
/// its strokes over it as a picture at four pixels to the point.
#[cfg(any(target_os = "macos", target_os = "ios"))]
pub fn pages_pdf(pages: &[PdfPage], source: Option<&str>, out: &str) -> Result<(), String> {
    let mut spec = Vec::new();
    for p in pages {
        let refs: Vec<&[u8]> = p.strokes.iter().map(Vec::as_slice).collect();
        let recs = records(&refs);
        let over: Vec<&[u8]> = p.above.iter().map(Vec::as_slice).collect();
        let above = records(&over);
        let paper: u32 = match p.paper.as_deref() { None => 0, Some("ruled") => 2, Some("grid") => 3, Some("dotted") => 4, Some(_) => 1 };
        let ruled = paper == 2;
        let rule = p.rule.unwrap_or(if ruled { 24.0 } else { 20.0 });
        let line = |i: usize| p.lines.get(i).copied().unwrap_or(-1.0);
        for v in [p.w, p.h, rule, p.top.unwrap_or(if ruled { 72.0 } else { 0.0 }), p.at.unwrap_or(-1.0), p.left.unwrap_or(0.0), p.right.unwrap_or(0.0), p.bottom.unwrap_or(if ruled { rule } else { 0.0 }), line(0), line(1)] {
            spec.extend_from_slice(&v.to_le_bytes());
        }
        // (colours: the top byte says one was chosen)
        let colour = |c: Option<u32>| c.map(|v| 0xff00_0000 | (v & 0x00ff_ffff)).unwrap_or(0);
        for v in [paper, p.source.unwrap_or(0), recs.len() as u32, above.len() as u32, colour(p.color), colour(p.line), u32::from(p.dark), colour(p.margin)] {
            spec.extend_from_slice(&v.to_le_bytes());
        }
        spec.extend_from_slice(&recs);
        spec.extend_from_slice(&above);
    }
    let src = source.unwrap_or("");
    // SAFETY: the pointers are to bytes that live through the call
    match unsafe { native::ilmi_ink_pdf(spec.as_ptr(), spec.len(), src.as_ptr(), src.len(), out.as_ptr(), out.len()) } {
        0 => Ok(()),
        1 => Err("no PencilKit on this system".to_string()),
        3 => Err("the pdf could not be read".to_string()),
        _ => Err("the pages could not be written".to_string()),
    }
}
#[cfg(not(any(target_os = "macos", target_os = "ios")))]
pub fn pages_pdf(_pages: &[PdfPage], _source: Option<&str>, _out: &str) -> Result<(), String> {
    Err("no PencilKit on this system".to_string())
}

/// How many pages the PDF at `path` has, and its first page's width and height in points.
#[cfg(any(target_os = "macos", target_os = "ios"))]
pub fn pdf_info(path: &str) -> Result<(u32, f64, f64), String> {
    // SAFETY: as in `split`
    let b = native::call(|out, len| unsafe { native::ilmi_pdf_info(path.as_ptr(), path.len(), out, len) }).map_err(|_| "not a pdf".to_string())?;
    if b.len() < 20 {
        return Err("not a pdf".to_string());
    }
    Ok((u32::from_le_bytes(b[0..4].try_into().unwrap()), f64::from_le_bytes(b[4..12].try_into().unwrap()), f64::from_le_bytes(b[12..20].try_into().unwrap())))
}
#[cfg(not(any(target_os = "macos", target_os = "ios")))]
pub fn pdf_info(_path: &str) -> Result<(u32, f64, f64), String> {
    Err("no PencilKit on this system".to_string())
}

/// A sheet's drawing, to or from its canvas.
#[derive(Deserialize, Serialize, Debug, Clone, Default)]
pub struct Taken {
    /// How many strokes it holds.
    pub strokes: u32,
    /// The drawing in base64, when it has changed since the last one given.
    pub drawing: Option<String>,
    /// The last telling of what the sheet holds, where the page draws it (89): what was taken is what that telling said.
    #[serde(default)]
    pub seq: u64,
}

/// The app's iCloud folder (milestone 65): none unless the app is signed with an iCloud container, so none anywhere yet.
#[cfg(any(target_os = "macos", target_os = "ios"))]
pub fn icloud_folder() -> Option<String> {
    // SAFETY: the callee fills `out` and `len` with bytes `call` copies and frees
    let bytes = native::call(|out, len| unsafe { native::ilmi_icloud_folder(out, len) }).ok()?;
    String::from_utf8(bytes).ok().filter(|s| !s.is_empty())
}
#[cfg(not(any(target_os = "macos", target_os = "ios")))]
pub fn icloud_folder() -> Option<String> {
    None
}

/// A file of that folder asked down and waited for; false if it did not come in `seconds`.
#[cfg(any(target_os = "macos", target_os = "ios"))]
pub fn icloud_down(path: &str, seconds: u32) -> bool {
    // SAFETY: the bytes are read during the call
    unsafe { native::ilmi_icloud_down(path.as_ptr(), path.len(), seconds) == 0 }
}
#[cfg(not(any(target_os = "macos", target_os = "ios")))]
pub fn icloud_down(_path: &str, _seconds: u32) -> bool {
    true
}

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_ink);

/// The canvases over the web view (milestone 69). On iOS they are there; anywhere else each call says they are not.
pub struct Ink<R: Runtime> {
    #[cfg(target_os = "ios")]
    handle: tauri::plugin::PluginHandle<R>,
    #[cfg(not(target_os = "ios"))]
    _none: std::marker::PhantomData<fn() -> R>,
}

#[derive(Serialize)]
struct Sheet<'a> {
    sheet: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    drawing: Option<&'a str>,
}

impl<R: Runtime> Ink<R> {
    /// Where the sheets lie now: `{ hosts, dark }`, as `InkPlugin.swift` reads it.
    /// Answers with the sheets it made anew, whose canvases hold nothing yet.
    pub async fn scene(&self, scene: serde_json::Value) -> Result<serde_json::Value, String> {
        self.call("scene", scene).await
    }
    /// What a sheet holds, from the store. Answers whether it took it: a sheet being written on keeps what it has.
    /// With `show` the canvas stays on the screen with it: the page shows no picture of that sheet (85).
    /// `names` are the store's names of the drawing's strokes, in its order (89): what the page knows them by.
    pub async fn fill(&self, sheet: &str, drawing: Option<&str>, show: bool, names: Option<Vec<String>>) -> Result<serde_json::Value, String> {
        self.call("fill", serde_json::json!({ "sheet": sheet, "drawing": drawing, "show": show, "names": names })).await
    }
    /// A sheet's drawing, when it has changed.
    pub async fn take(&self, sheet: &str) -> Result<Taken, String> {
        self.call("take", Sheet { sheet, drawing: None }).await
    }
    /// The page has drawn what a sheet said it holds, up to its telling `seq` (89): PencilKit's own copy of what was
    /// written can go from the glass.
    pub async fn shown(&self, sheet: &str, seq: u64) -> Result<(), String> {
        self.call::<_, serde_json::Value>("shown", serde_json::json!({ "sheet": sheet, "seq": seq })).await.map(|_| ())
    }
    /// The outlines of those of a sheet's strokes named, where the page draws the sheet (89): `{ shapes }`.
    pub async fn outlines(&self, sheet: &str, names: Vec<String>) -> Result<serde_json::Value, String> {
        self.call("outlines", serde_json::json!({ "sheet": sheet, "names": names })).await
    }
    /// A sheet's canvas hidden: the page is showing its picture.
    pub async fn rest(&self, sheet: &str) -> Result<(), String> {
        self.call::<_, serde_json::Value>("rest", Sheet { sheet, drawing: None }).await.map(|_| ())
    }
    /// The app kept awake in the background while the page sends what was written (`on`), or let go.
    /// What the system says: whether it is held, and the seconds left to it in the background (-1 in front).
    pub async fn hold(&self, on: bool) -> Result<serde_json::Value, String> {
        #[derive(Serialize)]
        struct Hold { on: bool }
        self.call("hold", Hold { on }).await
    }
    /// A tap under the finger (milestone 83), by name: `light`, `medium`, `soft`, `warning`, `success`, `tick`; any
    /// other name makes none. What it says: `{ can }`, whether the device has the hardware for one.
    pub async fn haptic(&self, kind: &str) -> Result<serde_json::Value, String> {
        self.call("haptic", serde_json::json!({ "kind": kind })).await
    }
    /// A dev run's: a finger stands in for the Pencil.
    pub async fn pen(&self, on: bool, once: bool, keep: Option<bool>) -> Result<(), String> {
        #[derive(Serialize)]
        struct Pen { on: bool, once: bool, keep: Option<bool> }
        self.call::<_, serde_json::Value>("pen", Pen { on, once, keep }).await.map(|_| ())
    }
    /// A dev run's: the canvases laid as they were before milestone 86, to measure against.
    pub async fn plain(&self, on: bool) -> Result<(), String> {
        #[derive(Serialize)]
        struct Pen { on: bool }
        self.call::<_, serde_json::Value>("plain", Pen { on }).await.map(|_| ())
    }
    /// The tool held (milestone 82): `{ kind, color, width }`, a pen, a highlighter, the eraser or the lasso. Every canvas takes it.
    pub async fn tool(&self, tool: serde_json::Value, seq: Option<u64>) -> Result<(), String> {
        self.call::<_, serde_json::Value>("tool", serde_json::json!({ "tool": tool, "seq": seq })).await.map(|_| ())
    }
    /// The last thing done on any sheet taken back. What can be undone and redone after: `{ undo, redo }`.
    pub async fn undo(&self) -> Result<serde_json::Value, String> {
        self.call("undo", serde_json::json!({})).await
    }
    /// And put back.
    pub async fn redo(&self) -> Result<serde_json::Value, String> {
        self.call("redo", serde_json::json!({})).await
    }
    /// A finger writes as the Pencil does and two scroll (`on`), or the Pencil writes and a finger scrolls.
    pub async fn finger(&self, on: bool) -> Result<(), String> {
        #[derive(Serialize)]
        struct Finger { on: bool }
        self.call::<_, serde_json::Value>("finger", Finger { on }).await.map(|_| ())
    }
    /// The system's colour wheel, showing `color`, from `at` on the page (`{ x, y, w, h }`). Answers when it closes: `{ color }`, null when none was chosen.
    pub async fn color(&self, color: &str, at: serde_json::Value) -> Result<serde_json::Value, String> {
        self.call("color", serde_json::json!({ "color": color, "at": at })).await
    }
    /// A dev run's: with the wheel up, as if `color` were chosen and the wheel closed.
    pub async fn wheel(&self, color: &str) -> Result<(), String> {
        self.call::<_, serde_json::Value>("wheel", serde_json::json!({ "color": color })).await.map(|_| ())
    }
    /// The inks this device's PencilKit has, each with the widths it takes, and whether a Pencil's squeeze is heard (85): `{ inks, squeeze }`.
    pub async fn caps(&self) -> Result<serde_json::Value, String> {
        self.call("caps", serde_json::json!({})).await
    }
    /// Two fingers pinch a host's pages: its sheets shown at `k * p + (dx, dy)`; with no `k`, as they lie.
    pub async fn pinch(&self, pinch: serde_json::Value) -> Result<(), String> {
        self.call::<_, serde_json::Value>("pinch", pinch).await.map(|_| ())
    }
    /// What the lasso holds cut, copied, duplicated, deleted (`op`), or given `color`: `{ selected, clip }` after.
    pub async fn selection(&self, op: &str, color: Option<&str>) -> Result<serde_json::Value, String> {
        self.call("selection", serde_json::json!({ "op": op, "color": color })).await
    }
    /// What was cut or copied put down on `sheet`, its middle at `x`, `y` of the host's content: `{ selected, clip }`.
    pub async fn paste(&self, sheet: &str, x: f64, y: f64) -> Result<serde_json::Value, String> {
        self.call("paste", serde_json::json!({ "sheet": sheet, "x": x, "y": y })).await
    }
    /// The system's share sheet for the file at `path`, from `at` on the page. Answers when it closes: `{ done }`.
    pub async fn share(&self, path: &str, at: serde_json::Value) -> Result<serde_json::Value, String> {
        self.call("share", serde_json::json!({ "path": path, "at": at })).await
    }
    /// A dev run's: the share sheet closed with nothing chosen.
    pub async fn unshare(&self) -> Result<(), String> {
        self.call::<_, serde_json::Value>("unshare", serde_json::json!({})).await.map(|_| ())
    }
    /// A dev run's: the Pencil tapped twice (`tap`) or squeezed (`squeeze`).
    pub async fn pencil(&self, what: &str) -> Result<(), String> {
        self.call::<_, serde_json::Value>("pencilDev", serde_json::json!({ "what": what })).await.map(|_| ())
    }
    /// A dev run's: a stroke of the ink held through `points` of a sheet's drawing, ended resting (`rest`) or not.
    pub async fn stroke(&self, sheet: &str, points: serde_json::Value, rest: bool) -> Result<(), String> {
        self.call::<_, serde_json::Value>("stroke", serde_json::json!({ "sheet": sheet, "points": points, "rest": rest })).await.map(|_| ())
    }
    /// A dev run's: a sheet's canvas emptied as an eraser would.
    pub async fn wipe(&self, sheet: &str) -> Result<(), String> {
        self.call::<_, serde_json::Value>("wipe", Sheet { sheet, drawing: None }).await.map(|_| ())
    }
    /// A dev run's: a sheet's drawing as PencilKit draws a picture of it at the screen's own pixels, where its canvas lies now, written as `<name>.png` in the app's Documents.
    pub async fn picture(&self, sheet: &str, name: &str) -> Result<serde_json::Value, String> {
        self.call("picture", serde_json::json!({ "sheet": sheet, "name": name })).await
    }
    /// A notebook's pages as a surface of the system's own (87): where it lies on the page and what it holds, as
    /// `Surface.swift` reads it; with no place, the surface goes.
    pub async fn surface(&self, surface: serde_json::Value) -> Result<(), String> {
        self.call::<_, serde_json::Value>("surface", surface).await.map(|_| ())
    }
    /// A surface asked to go to a place or a zoom: `{ id, op, place, zoom, animated }`.
    pub async fn surface_do(&self, ask: serde_json::Value) -> Result<serde_json::Value, String> {
        self.call("surfaceDo", ask).await
    }
    /// How the canvases stand, for the checks.
    pub async fn state(&self) -> Result<serde_json::Value, String> {
        self.call("state", serde_json::json!({})).await
    }

    #[cfg(target_os = "ios")]
    async fn call<A: Serialize, T: serde::de::DeserializeOwned>(&self, name: &str, args: A) -> Result<T, String> {
        self.handle.run_mobile_plugin_async(name, args).await.map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "ios"))]
    async fn call<A: Serialize, T: serde::de::DeserializeOwned>(&self, _name: &str, _args: A) -> Result<T, String> {
        Err("no canvas on this system".to_string())
    }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("ink")
        .setup(|app, _api| {
            #[cfg(target_os = "ios")]
            let ink = Ink { handle: _api.register_ios_plugin(init_plugin_ink)? };
            #[cfg(not(target_os = "ios"))]
            let ink: Ink<R> = Ink { _none: std::marker::PhantomData };
            tauri::Manager::manage(app, ink);
            Ok(())
        })
        .build()
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    fn refs(strokes: &[Stroke]) -> Vec<&[u8]> {
        strokes.iter().map(|s| s.data.as_slice()).collect()
    }

    #[test]
    fn a_strokes_name_outlives_a_save() {
        let drawing = sample(6, 10, 7).unwrap();
        let first = split(&drawing).unwrap();
        assert_eq!(first.len(), 60);
        let names: std::collections::HashSet<&str> = first.iter().map(|s| s.key.as_str()).collect();
        assert_eq!(names.len(), 60, "every stroke has a name of its own");
        // put together and taken apart again, twice: the bytes differ each time, the names and the order do not
        let again = join(&refs(&first)).unwrap();
        assert_ne!(again, drawing, "PencilKit does not write one drawing as the same bytes twice");
        let second = split(&again).unwrap();
        let third = split(&join(&refs(&second)).unwrap()).unwrap();
        let keys = |s: &[Stroke]| s.iter().map(|x| (x.key.clone(), x.at)).collect::<Vec<_>>();
        assert_eq!(keys(&first), keys(&second));
        assert_eq!(keys(&first), keys(&third));
    }

    #[test]
    fn a_stroke_in_hand_has_the_name_its_bytes_give() {
        // a stroke is named the moment it is written, before it has ever been bytes, and again by the store from
        // the drawing's bytes: one name. (PencilKit writes the even line as a pen: named by its ink as it was in
        // hand, an even line had two names, and the page drew it under one the store never kept)
        // SAFETY: as in `split`
        let json = native::call(|out, len| unsafe { native::ilmi_ink_names_twice(out, len) }).unwrap();
        let said: serde_json::Value = serde_json::from_slice(&json).unwrap();
        let list = said.as_array().unwrap();
        assert!(list.len() >= 3);
        let mut names = std::collections::HashSet::new();
        for s in list {
            assert_eq!(s["live"], s["kept"], "{}", s["ink"]);
            names.insert(s["live"].as_str().unwrap().to_string());
        }
        assert_eq!(names.len(), list.len(), "every stroke has a name of its own");
    }

    #[test]
    fn a_stroke_is_said_as_the_page_draws_it() {
        // (89) every stroke by the name `split` gives it, in order, each an outline the page fills: a path that
        // begins with a move, closes every piece, and holds nothing but what a path may
        let strokes = split(&sample(3, 4, 5).unwrap()).unwrap();
        let said: serde_json::Value = serde_json::from_str(&shapes(&refs(&strokes)).unwrap()).unwrap();
        let list = said.as_array().unwrap();
        assert_eq!(list.len(), strokes.len());
        for (shape, stroke) in list.iter().zip(&strokes) {
            assert_eq!(shape["n"].as_str().unwrap(), stroke.key);
            let kind = shape["k"].as_str().unwrap();
            assert!(kind == "p" || kind == "m" || kind == "i", "{kind}");
            if kind == "i" {
                assert!(shape["src"].as_str().unwrap().starts_with("data:image/png;base64,"));
                assert_eq!(shape["box"].as_array().unwrap().len(), 4);
                continue;
            }
            let d = shape["d"].as_str().unwrap();
            assert!(d.starts_with('M') && d.ends_with('z') && d.len() > 20, "{d}");
            assert!(d.chars().all(|c| c.is_ascii_digit() || "MLaCQz .-".contains(c)), "{d}");
            let c = shape["c"].as_str().unwrap();
            assert!(c.len() == 7 && c.starts_with('#'));
        }
        // the same strokes say the same thing twice
        assert_eq!(shapes(&refs(&strokes)).unwrap(), shapes(&refs(&strokes)).unwrap());
        assert_eq!(shapes(&[]).unwrap(), "[]");
    }

    #[test]
    fn strokes_from_two_drawings_make_one() {
        let a = split(&sample(2, 5, 1).unwrap()).unwrap();
        let b = split(&sample(3, 4, 2).unwrap()).unwrap();
        let mut all = a.clone();
        all.extend(b.clone());
        let both = split(&join(&refs(&all)).unwrap()).unwrap();
        assert_eq!(both.len(), 22);
        // one taken out is one fewer, and the rest are who they were
        all.remove(3);
        let fewer = split(&join(&refs(&all)).unwrap()).unwrap();
        assert_eq!(fewer.len(), 21);
        assert!(fewer.iter().all(|s| both.iter().any(|x| x.key == s.key)));
        assert!(!fewer.iter().any(|s| s.key == both[3].key));
    }

    #[test]
    fn a_page_s_writing_is_a_png_of_the_whole_page() {
        let strokes = split(&sample(4, 12, 3).unwrap()).unwrap();
        // a page of 612 by 792 points at 2×, whatever the strokes cover
        let png = page_picture(&refs(&strokes), 612.0, 792.0, 2.0).unwrap();
        assert_eq!(&png[..8], b"\x89PNG\r\n\x1a\n");
        let size = |p: &[u8]| (u32::from_be_bytes(p[16..20].try_into().unwrap()), u32::from_be_bytes(p[20..24].try_into().unwrap()));
        assert_eq!(size(&png), (1224, 1584));
        // with nothing on it, it is still the page: an empty one
        let none = page_picture(&[], 612.0, 792.0, 2.0).unwrap();
        assert_eq!(size(&none), (1224, 1584));
        assert!(none.len() < png.len(), "the strokes are in the one and not the other");
        assert!(page_picture(&refs(&strokes), 0.0, 792.0, 2.0).is_err());
    }

    #[test]
    fn a_drawing_says_what_it_covers() {
        let drawing = sample(2, 3, 5).unwrap();
        let [x, y, w, h] = bounds(&drawing).unwrap().unwrap();
        assert!(x > 20.0 && y > 30.0 && w > 40.0 && h > 40.0, "{x} {y} {w} {h}");
        assert_eq!(bounds(&join(&[]).unwrap()).unwrap(), None, "nothing drawn covers nothing");
        assert!(bounds(b"not a drawing").is_err());
    }

    #[test]
    fn a_picture_is_a_png_of_what_the_strokes_cover() {
        let strokes = split(&sample(4, 12, 3).unwrap()).unwrap();
        let png = picture(&refs(&strokes), 2.0).unwrap();
        assert_eq!(&png[..8], b"\x89PNG\r\n\x1a\n");
        let (w, h) = (u32::from_be_bytes(png[16..20].try_into().unwrap()), u32::from_be_bytes(png[20..24].try_into().unwrap()));
        assert!(w > 400 && h > 200 && w < 2000 && h < 1000, "{w}x{h}");
        assert!(picture(&[], 2.0).unwrap().is_empty(), "nothing drawn is no picture");
        assert!(split(b"not a drawing").is_err());
    }

    #[test]
    fn pages_and_their_writing_are_a_pdf() {
        let strokes: Vec<Vec<u8>> = split(&sample(4, 12, 3).unwrap()).unwrap().into_iter().map(|s| s.data).collect();
        let dir = std::env::temp_dir().join(format!("ilmi-ink-pdf-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let out = dir.join("notebook.pdf");
        let pages = vec![
            PdfPage { w: 612.0, h: 792.0, paper: Some("ruled".into()), strokes: strokes.clone(), left: Some(34.02), right: Some(34.02), bottom: Some(48.0), lines: vec![34.02, 577.98], margin: Some(0x00b5_d2f2), ..Default::default() },
            PdfPage { w: 612.0, h: 792.0, paper: Some("grid".into()), rule: Some(14.17), at: Some(792.0), left: Some(22.68), right: Some(22.68), top: Some(22.68), above: strokes.clone(), ..Default::default() },
            PdfPage { w: 595.0, h: 842.0, paper: Some("dotted".into()), left: Some(22.68), right: Some(22.68), top: Some(22.68), bottom: Some(22.68), ..Default::default() },
        ];
        pages_pdf(&pages, None, out.to_str().unwrap()).unwrap();
        assert_eq!(pdf_info(out.to_str().unwrap()).unwrap(), (3, 612.0, 792.0));
        let bytes = std::fs::read(&out).unwrap();
        assert_eq!(&bytes[..5], b"%PDF-");
        // the same pages with nothing written are a smaller file: the ink is in the one
        let bare = dir.join("bare.pdf");
        pages_pdf(&pages.iter().map(|p| PdfPage { strokes: vec![], above: vec![], ..p.clone() }).collect::<Vec<_>>(), None, bare.to_str().unwrap()).unwrap();
        assert!(std::fs::metadata(&bare).unwrap().len() < bytes.len() as u64);
        // a PDF's own pages under the ink: two of the three, in another order, each the size it is given
        let over = dir.join("annotated.pdf");
        let of = vec![
            PdfPage { w: 612.0, h: 792.0, source: Some(3), strokes: strokes.clone(), ..Default::default() },
            PdfPage { w: 612.0, h: 792.0, source: Some(1), ..Default::default() },
        ];
        pages_pdf(&of, Some(out.to_str().unwrap()), over.to_str().unwrap()).unwrap();
        assert_eq!(pdf_info(over.to_str().unwrap()).unwrap(), (2, 612.0, 792.0));
        assert!(pages_pdf(&of, Some(dir.join("none.pdf").to_str().unwrap()), over.to_str().unwrap()).is_err());
        assert!(pdf_info(dir.join("none.pdf").to_str().unwrap()).is_err());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    const CORPUS_PAGE: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../../src/format/__tests__/corpus/vault/fleeting/worked-example/ink-01");

    /// `npm run fixture:ink` writes the corpus's page of ink again: a drawing and the picture made of it.
    #[test]
    fn the_corpus_s_page_is_a_drawing_and_its_picture() {
        if std::env::var_os("ILMI_INK_FIXTURE").is_some() {
            let drawing = sample(3, 9, 58).unwrap();
            let strokes = split(&drawing).unwrap();
            std::fs::create_dir_all(std::path::Path::new(CORPUS_PAGE).parent().unwrap()).unwrap();
            std::fs::write(format!("{CORPUS_PAGE}.pkdrawing"), &drawing).unwrap();
            std::fs::write(format!("{CORPUS_PAGE}.png"), picture(&refs(&strokes), 2.0).unwrap()).unwrap();
        }
        // FORMAT.md §4: the `.pkdrawing` beside an ink picture is the `PKDrawing` it was made from
        let drawing = std::fs::read(format!("{CORPUS_PAGE}.pkdrawing")).unwrap();
        let kept = std::fs::read(format!("{CORPUS_PAGE}.png")).unwrap();
        let strokes = split(&drawing).unwrap();
        assert_eq!(strokes.len(), 27);
        let made = picture(&refs(&strokes), 2.0).unwrap();
        assert_eq!(made[16..24], kept[16..24], "the picture beside it is as wide and as tall as the one its strokes make");
        // and the drawing made of its strokes again is the same strokes, though not the same bytes
        let again = split(&join(&refs(&strokes)).unwrap()).unwrap();
        assert_eq!(again.iter().map(|s| &s.key).collect::<Vec<_>>(), strokes.iter().map(|s| &s.key).collect::<Vec<_>>());
    }

    /// Not signed with an iCloud container, as nothing here is: no folder, and a file that is no iCloud file is simply here.
    #[test]
    fn no_icloud_without_its_container() {
        assert_eq!(icloud_folder(), None);
        assert!(icloud_down("/tmp/no-such-file", 1));
    }

    /// `cargo test -p tauri-plugin-ink -- --ignored --nocapture a_page_weighed`: a page of working as strokes and as a PNG (PLAN.md, 58).
    #[test]
    #[ignore]
    fn a_page_weighed() {
        for (lines, per) in [(8, 14), (24, 28)] {
            let drawing = sample(lines, per, 11).unwrap();
            let strokes = split(&drawing).unwrap();
            let rows: usize = strokes.iter().map(|s| s.data.len()).sum();
            let t = std::time::Instant::now();
            let png = picture(&refs(&strokes), 2.0).unwrap();
            let drawn = t.elapsed();
            let (w, h) = (u32::from_be_bytes(png[16..20].try_into().unwrap()), u32::from_be_bytes(png[20..24].try_into().unwrap()));
            let t = std::time::Instant::now();
            let whole = join(&refs(&strokes)).unwrap();
            println!(
                "{} strokes: one drawing {} bytes, a row a stroke {} bytes ({} a stroke), PNG {}x{} {} bytes in {:?}, joined in {:?}",
                strokes.len(), whole.len(), rows, rows / strokes.len(), w, h, png.len(), drawn, t.elapsed()
            );
        }
    }

    /// A corpus file: `.ilmi/ink/<hash>/<page>.pkdrawing` comes out of an export with the strokes it went into an import with. PencilKit draws new ids on every save, so never the same bytes.
    #[test]
    fn corpus_drawing_keeps_its_strokes() {
        let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../src/format/__tests__/corpus/vault/.ilmi/ink/e62fd1f4eb0a178c36c48f6bd48151a80de36f4a29eb880195aa9e58a61e61d1/1.pkdrawing");
        let strokes = split(&std::fs::read(path).unwrap()).unwrap();
        assert_eq!(strokes.len(), 6);
        let again = split(&join(&refs(&strokes)).unwrap()).unwrap();
        assert_eq!(again.iter().map(|s| &s.key).collect::<Vec<_>>(), strokes.iter().map(|s| &s.key).collect::<Vec<_>>());
    }
}
