//! ilmi's ink (milestone 58).
//!
//! Two things, both PencilKit's. On iOS a canvas over the web view, which is the plugin proper: a Swift
//! package (`ios/`) Tauri builds and links, reached through [`Ink`]. And, on the Mac as on iOS, what reads a
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
        pub fn ilmi_ink_sample(lines: u32, per: u32, seed: u32, out: *mut *mut u8, out_len: *mut usize) -> i32;
        pub fn ilmi_ink_free(p: *mut u8);
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
pub fn sample(_lines: u32, _per: u32, _seed: u32) -> Result<Vec<u8>, String> {
    Err("no PencilKit on this system".to_string())
}

/// What the canvas is opened with.
#[derive(Serialize, Debug, Clone, Default)]
pub struct Open {
    /// The drawing to go on with, in base64; none for a clean page.
    pub drawing: Option<String>,
    /// A finger draws too. For a check on a simulator, where there is no Pencil: left false, the canvas is the system's (the Pencil draws).
    pub finger: bool,
    /// A book's page to write on (milestone 67): its picture, in base64 (a PNG or a JPEG). With it the canvas is that page, `width` by `height` points, fitted to the screen's width, and a stroke is where it lies on the page.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub paper: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<f64>,
}

/// What the canvas holds: at its close, or while it is open (`peek`).
#[derive(Deserialize, Serialize, Debug, Clone, Default)]
pub struct Page {
    /// How many strokes it holds.
    pub strokes: u32,
    /// The drawing in base64. From `peek`, only when it has changed since the last one given and has been left alone for as long as was asked.
    pub drawing: Option<String>,
    /// Whether the canvas is open.
    #[serde(default)]
    pub open: bool,
    /// Over a book's page: how far the canvas is zoomed to fit it, and where the page's top left corner is on the screen, in points.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub zoom: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub left: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub top: Option<f64>,
}

#[cfg(target_os = "ios")]
tauri::ios_plugin_binding!(init_plugin_ink);

/// The canvas. On iOS it is there; anywhere else `open` says it is not.
pub struct Ink<R: Runtime> {
    #[cfg(target_os = "ios")]
    handle: tauri::plugin::PluginHandle<R>,
    #[cfg(not(target_os = "ios"))]
    _none: std::marker::PhantomData<fn() -> R>,
}

impl<R: Runtime> Ink<R> {
    /// The canvas over the web view until `done`: what it held then.
    #[cfg(target_os = "ios")]
    pub async fn open(&self, with: Open) -> Result<Page, String> {
        self.handle.run_mobile_plugin_async("open", with).await.map_err(|e| e.to_string())
    }
    /// The open canvas, looked at: its strokes, and its drawing once it has been quiet for `quiet_ms`.
    #[cfg(target_os = "ios")]
    pub async fn peek(&self, quiet_ms: u32) -> Result<Page, String> {
        #[derive(Serialize)]
        #[serde(rename_all = "camelCase")]
        struct Peek { quiet_ms: u32 }
        self.handle.run_mobile_plugin_async("peek", Peek { quiet_ms }).await.map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "ios"))]
    pub async fn open(&self, _with: Open) -> Result<Page, String> {
        Err("no canvas on this system".to_string())
    }
    #[cfg(not(target_os = "ios"))]
    pub async fn peek(&self, _quiet_ms: u32) -> Result<Page, String> {
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
    fn a_picture_is_a_png_of_what_the_strokes_cover() {
        let strokes = split(&sample(4, 12, 3).unwrap()).unwrap();
        let png = picture(&refs(&strokes), 2.0).unwrap();
        assert_eq!(&png[..8], b"\x89PNG\r\n\x1a\n");
        let (w, h) = (u32::from_be_bytes(png[16..20].try_into().unwrap()), u32::from_be_bytes(png[20..24].try_into().unwrap()));
        assert!(w > 400 && h > 200 && w < 2000 && h < 1000, "{w}x{h}");
        assert!(picture(&[], 2.0).unwrap().is_empty(), "nothing drawn is no picture");
        assert!(split(b"not a drawing").is_err());
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
}
