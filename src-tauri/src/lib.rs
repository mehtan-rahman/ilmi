mod anki;
#[cfg(debug_assertions)]
mod devstore;
mod epub;
#[cfg(debug_assertions)]
mod nudge;
mod plugin;
mod storage;
mod store;
mod sync;

#[cfg(desktop)]
use tauri::menu::{MenuBuilder, MenuItemBuilder, MenuItemKind, SubmenuBuilder};
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_fs::FsExt;

// What is the desktop's alone is under `cfg(desktop)` (milestone 55): the
// single-instance plugin, the menu bar with its Paste and Match Style, the
// second window. iOS has one instance, no menu bar, and one window.

/// The ids of the File menu's items, as the renderer receives them on the
/// `menu` event (`src/app/menu.ts` dispatches on them). A recent vault's
/// item is `recent:<path>`.
#[cfg(desktop)]
const MENU_FILE: &str = "file";
#[cfg(desktop)]
const MENU_RECENT: &str = "recent";
#[cfg(desktop)]
const MENU_NEW: &str = "new";
#[cfg(desktop)]
const MENU_OPEN: &str = "open";
#[cfg(desktop)]
const MENU_CLOSE: &str = "close";
#[cfg(desktop)]
const MENU_IMPORT: &str = "import";
/// Edit › Paste and Match Style (⌘⇧V, macOS): the webview's own
/// `pasteAsPlainText:`, whose paste event carries only the clipboard's plain
/// text. Handled here, not in the renderer: a page cannot start a paste.
#[cfg(target_os = "macos")]
const MENU_PASTE_PLAIN: &str = "paste-plain";

/// Widen the fs scope to a folder on disk: one an import reads or an export
/// writes, the repository kept beside a collection (since milestone 59 the
/// collection itself is a database, `store.rs`, and is not reached through
/// the fs plugin). The dialog plugin does this for a picked directory; this
/// covers paths that arrive any other way. The
/// plugin's global scope matches with `require_literal_leading_dot` on unix
/// whatever the config says, so `vault/**` never reaches `.ilmi/`; that
/// directory is granted by name.
#[tauri::command]
fn allow_vault(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let scope = app.fs_scope();
    scope
        .allow_directory(&path, true)
        .map_err(|e| e.to_string())?;
    scope
        .allow_directory(std::path::Path::new(&path).join(".ilmi"), true)
        .map_err(|e| e.to_string())
}

/// A hidden entry (`.ilmi`, `.gitignore`) of a folder the scope already
/// reaches, let in by name: an import reads a vault's dot-entries and an
/// export writes them (`src/app/collections.ts`), and `dir/**` does not
/// match them. Refused when the entry's folder is not in the scope.
#[tauri::command]
fn allow_hidden(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    let hidden = p.file_name().map(|n| n.to_string_lossy().starts_with('.')).unwrap_or(false);
    if !hidden {
        return Ok(());
    }
    let scope = app.fs_scope();
    match p.parent() {
        Some(parent) if scope.is_allowed(parent) => {}
        _ => return Err(format!("{path}: outside what was opened")),
    }
    scope.allow_directory(p, true).map_err(|e| e.to_string())?;
    scope.allow_file(p).map_err(|e| e.to_string())
}

/// A file dropped on the window, read as text. The fs scope covers only the
/// vault; a drop is a gesture on one file, so that file is read here by
/// path and nothing is added to the scope.
#[tauri::command]
fn read_dropped(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

/// The same for a PDF: its bytes, raw over the IPC, for pdf.js on the
/// renderer side to read its text and for the vault to copy beside the
/// document it becomes.
#[tauri::command]
fn read_dropped_bytes(path: String) -> Result<tauri::ipc::Response, String> {
    std::fs::read(&path)
        .map(tauri::ipc::Response::new)
        .map_err(|e| e.to_string())
}

/// A dropped or picked Anki package, read as plain data (`anki.rs`); the
/// renderer maps it to deck files. Read by path, as a drop, outside the scope.
#[tauri::command]
fn read_anki_package(path: String) -> Result<anki::AnkiPackage, String> {
    anki::read_package(std::path::Path::new(&path))
}

/// A dropped or picked book in EPUB, read as plain data (`epub.rs`): its
/// metadata and the spine's XHTML in reading order; the renderer maps it to
/// a folder of sources. Read by path, as a drop, outside the scope.
#[tauri::command]
fn read_epub(path: String) -> Result<epub::Epub, String> {
    epub::read_book(std::path::Path::new(&path))
}

/// A dropped or picked plugin package (`plugin.rs`): the files of a `.zip`
/// as text, for the renderer to check and land under `.ilmi/plugins/<id>/`.
/// Read by path, as a drop, outside the scope.
#[tauri::command]
fn read_plugin_zip(path: String) -> Result<plugin::PluginZip, String> {
    plugin::read_zip(std::path::Path::new(&path))
}

/// Where the app runs, for the renderer: `mobile` (iOS: the welcome is
/// `connect` and the collections, the layout one pane) and the app's
/// Documents there, which the Files app shows. On the
/// desktop both are off; a dev build takes `ILMI_MOBILE=1` and
/// `ILMI_DOCUMENTS=/path` to draw the iPad's side in the Mac's window.
#[derive(serde::Serialize)]
struct Platform {
    mobile: bool,
    documents: Option<String>,
}

#[tauri::command]
fn platform(app: tauri::AppHandle) -> Platform {
    let documents = documents_dir(&app).map(|p| p.to_string_lossy().into_owned());
    Platform { mobile: documents.is_some(), documents }
}

/// The app's Documents on iOS (the Files app shows it; a dev run's
/// `smoke.json` is read from it); `None` on the desktop (but for the dev
/// override). The collections themselves are under the app's data directory.
fn documents_dir(app: &tauri::AppHandle) -> Option<std::path::PathBuf> {
    #[cfg(mobile)]
    {
        app.path().document_dir().ok()
    }
    #[cfg(desktop)]
    {
        let _ = app;
        if cfg!(debug_assertions) && std::env::var("ILMI_MOBILE").map(|v| !v.is_empty()).unwrap_or(false) {
            std::env::var("ILMI_DOCUMENTS").ok().filter(|s| !s.is_empty()).map(std::path::PathBuf::from)
        } else {
            None
        }
    }
}

/// Dev only: an environment variable of the dev process, for
/// `ILMI_VAULT=/path npm run tauri dev` (open that vault at launch) and
/// `ILMI_SMOKE=…` (run a smoke script). An app on iOS has no environment
/// to set, so there the same names are read from `smoke.json` in its
/// Documents (`smoke_json`). Always `None` in release.
#[tauri::command]
fn dev_env(app: tauri::AppHandle, name: String) -> Option<String> {
    if cfg!(debug_assertions) && name.starts_with("ILMI_") {
        std::env::var(&name)
            .ok()
            .filter(|s| !s.is_empty())
            .or_else(|| documents_dir(&app).and_then(|dir| smoke_json(&dir, &name)))
    } else {
        None
    }
}

/// Dev only, macOS: the memory of this window's web content process, in
/// bytes, for `ILMI_SMOKE=size` (the page cannot weigh itself in WebKit):
/// what it holds now, and the most it has held. The process is the
/// `com.apple.WebKit.WebContent` whose responsible process is this one (or
/// the terminal this one answers to, for a `tauri dev` run), started after
/// it, the largest when there are several; what is read is its physical
/// footprint, the figure Activity Monitor shows. With `collect`, WebKit is
/// first told memory is low (`org.WebKit.lowMemory`, the notification its
/// own tests post: every WebKit process of the session drops its caches
/// and collects garbage), so the figure is what the page holds and not
/// what it has yet to let go. `None` when no such process is found, on
/// other systems, and in release.
#[tauri::command(async)]
fn dev_web_memory(collect: bool) -> Option<(u64, u64)> {
    #[cfg(all(debug_assertions, target_os = "macos"))]
    {
        use std::os::raw::{c_char, c_int, c_void};
        extern "C" {
            fn proc_listallpids(buffer: *mut c_void, buffersize: c_int) -> c_int;
            fn proc_name(pid: c_int, buffer: *mut c_void, buffersize: u32) -> c_int;
            fn proc_pid_rusage(pid: c_int, flavor: c_int, buffer: *mut c_void) -> c_int;
            fn responsibility_get_pid_responsible_for_pid(pid: c_int) -> c_int;
            fn notify_post(name: *const c_char) -> u32;
        }
        if collect {
            unsafe { notify_post(c"org.WebKit.lowMemory".as_ptr()) };
            std::thread::sleep(std::time::Duration::from_secs(6));
        }
        // rusage_info_v4: a 16-byte uuid, then 64-bit counters; the footprint is the eighth, the start time the
        // ninth, the footprint's lifetime peak the twenty-ninth
        const RUSAGE_INFO_V4: c_int = 4;
        let usage = |pid: c_int| -> Option<[u64; 48]> {
            let mut buf = [0u64; 48];
            (unsafe { proc_pid_rusage(pid, RUSAGE_INFO_V4, buf.as_mut_ptr().cast()) } == 0).then_some(buf)
        };
        let me = std::process::id() as c_int;
        let mine = [me, unsafe { responsibility_get_pid_responsible_for_pid(me) }];
        let started = usage(me)?[10];
        let mut pids = vec![0 as c_int; 8192];
        let n = unsafe { proc_listallpids(pids.as_mut_ptr().cast(), (pids.len() * std::mem::size_of::<c_int>()) as c_int) };
        let mut best: Option<(u64, u64)> = None;
        for &pid in pids.iter().take(n.max(0) as usize) {
            let mut name = [0u8; 256];
            let len = unsafe { proc_name(pid, name.as_mut_ptr().cast(), name.len() as u32) };
            if len <= 0 || !String::from_utf8_lossy(&name[..len as usize]).starts_with("com.apple.WebKit.WebContent") {
                continue;
            }
            if !mine.contains(&unsafe { responsibility_get_pid_responsible_for_pid(pid) }) {
                continue;
            }
            // one started before this app is another app's
            if let Some(u) = usage(pid).filter(|u| u[10] >= started) {
                if best.is_none_or(|b| u[9] > b.0) {
                    best = Some((u[9], u[30]));
                }
            }
        }
        best
    }
    #[cfg(not(all(debug_assertions, target_os = "macos")))]
    {
        let _ = collect;
        None
    }
}

/// `ILMI_<NAME>` as `Documents/smoke.json` gives it: `{"mode": "tour",
/// "vault": "double-major"}` is `ILMI_SMOKE=tour` over the vault of that
/// name in Documents (a path that is not absolute is taken from there); any
/// other key is the variable of its name in capitals (`"remote"` is
/// `ILMI_REMOTE`). A file that is missing or not an object gives nothing.
fn smoke_json(documents: &std::path::Path, name: &str) -> Option<String> {
    let text = std::fs::read_to_string(documents.join("smoke.json")).ok()?;
    let json: serde_json::Value = serde_json::from_str(&text).ok()?;
    let key = match name {
        "ILMI_SMOKE" => "mode".to_string(),
        other => other.strip_prefix("ILMI_")?.to_lowercase(),
    };
    let value = match json.get(&key)? {
        serde_json::Value::String(s) => s.clone(),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::Bool(true) => "1".to_string(),
        _ => return None,
    };
    if value.is_empty() {
        return None;
    }
    if key == "vault" && !std::path::Path::new(&value).is_absolute() {
        return Some(documents.join(&value).to_string_lossy().into_owned());
    }
    Some(value)
}

/// Dev only: the loopback ntfy-shaped server the nudge smoke publishes
/// and listens over (`nudge.rs`); its address. An error in release.
#[tauri::command]
fn dev_nudge_serve() -> Result<String, String> {
    #[cfg(debug_assertions)]
    {
        nudge::serve()
    }
    #[cfg(not(debug_assertions))]
    {
        Err("dev only".to_string())
    }
}

/// Dev only: every stream on that server closed, as a lost connection would; how many there were.
#[tauri::command]
fn dev_nudge_drop() -> Result<usize, String> {
    #[cfg(debug_assertions)]
    {
        Ok(nudge::drop_all())
    }
    #[cfg(not(debug_assertions))]
    {
        Err("dev only".to_string())
    }
}

/// Dev only: how many streams are open on `topic`.
#[tauri::command]
fn dev_nudge_listeners(topic: String) -> Result<usize, String> {
    #[cfg(debug_assertions)]
    {
        Ok(nudge::listeners(&topic))
    }
    #[cfg(not(debug_assertions))]
    {
        let _ = topic;
        Err("dev only".to_string())
    }
}

// ── the store (milestone 59) ─────────────────────────────────────
//
// A collection is a folder under the app's data directory holding one
// SQLite file and its blobs (`store.rs`). The renderer names a collection
// by that folder, and nothing outside `collections/` can be named. The
// commands run off the main thread; the stores sit behind one lock.

/// `collections/` under the app's data directory, made on first use.
fn collections_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?.join("collections");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn collection_dir(app: &tauri::AppHandle, root: &str) -> Result<std::path::PathBuf, String> {
    store::dir_in(&collections_dir(app)?, root)
}

/// Where the collections live, and the ones there, by name.
#[derive(serde::Serialize)]
struct Collections {
    home: String,
    names: Vec<String>,
}

#[tauri::command(async)]
fn store_list(app: tauri::AppHandle) -> Result<Collections, String> {
    let home = collections_dir(&app)?;
    Ok(Collections { names: store::list(&home)?, home: home.to_string_lossy().into_owned() })
}

/// A new, empty collection called `name`; its folder. `already there` when the name is taken.
#[tauri::command(async)]
fn store_create(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, name: String) -> Result<String, String> {
    let clean = store::clean_name(&name).ok_or_else(|| "not a name".to_string())?;
    let dir = collections_dir(&app)?.join(clean);
    if dir.exists() {
        return Err("already there".to_string());
    }
    stores.create(&dir)?;
    Ok(dir.to_string_lossy().into_owned())
}

/// A collection closed and deleted with everything in it: an import that failed half way, a dev run's last copy.
#[tauri::command(async)]
fn store_delete(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String) -> Result<(), String> {
    stores.delete(&collection_dir(&app, &root)?)
}

#[tauri::command(async)]
fn store_rows(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String) -> Result<Vec<store::Row>, String> {
    stores.rows(&collection_dir(&app, &root)?)
}

#[tauri::command(async)]
fn store_text(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String, id: String) -> Result<String, String> {
    stores.text(&collection_dir(&app, &root)?, &id)
}

#[tauri::command(async)]
fn store_put(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String, at: store::Place, content: Option<store::Content>, lift: Option<store::Lift>) -> Result<store::Row, String> {
    stores.put(&collection_dir(&app, &root)?, &at, content.as_ref(), lift.as_ref())
}

#[tauri::command(async)]
fn store_version(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String) -> Result<i64, String> {
    stores.version(&collection_dir(&app, &root)?)
}

#[tauri::command(async)]
fn store_set_version(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String, version: i64) -> Result<(), String> {
    stores.set_version(&collection_dir(&app, &root)?, version)
}

#[tauri::command(async)]
fn store_doc(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String, id: String) -> Result<store::DocContent, String> {
    stores.doc(&collection_dir(&app, &root)?, &id)
}

#[tauri::command(async)]
fn store_places(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String, set: Vec<(String, f64)>) -> Result<(), String> {
    stores.places(&collection_dir(&app, &root)?, &set)
}

/// A page of the index, as the JSON it is stored as: the response is that text, read once by the renderer.
#[tauri::command(async)]
fn store_digests(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String, after: Option<String>, limit: i64) -> Result<tauri::ipc::Response, String> {
    stores.digests(&collection_dir(&app, &root)?, after.as_deref(), limit).map(tauri::ipc::Response::new)
}

#[tauri::command(async)]
fn store_review_files(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String) -> Result<Vec<(String, i64)>, String> {
    stores.review_files(&collection_dir(&app, &root)?)
}

#[tauri::command(async)]
fn store_reviews(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String, file: Option<String>) -> Result<Vec<String>, String> {
    stores.reviews(&collection_dir(&app, &root)?, file.as_deref())
}

#[tauri::command(async)]
fn store_reviews_put(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String, file: String, rows: Vec<store::ReviewRow>, replace: bool) -> Result<(), String> {
    stores.reviews_put(&collection_dir(&app, &root)?, &file, &rows, replace)
}

#[tauri::command(async)]
fn store_same(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String) -> Result<Vec<String>, String> {
    stores.same(&collection_dir(&app, &root)?)
}

#[tauri::command(async)]
fn store_same_put(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String, pairs: Vec<String>) -> Result<(), String> {
    stores.same_put(&collection_dir(&app, &root)?, &pairs)
}

#[tauri::command(async)]
fn store_originals(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String) -> Result<Vec<(String, store::Original)>, String> {
    stores.originals(&collection_dir(&app, &root)?)
}

#[tauri::command(async)]
fn store_original_put(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String, key: String, original: Option<store::Original>) -> Result<(), String> {
    stores.original_put(&collection_dir(&app, &root)?, &key, original.as_ref())
}

/// Several writes as one transaction (milestone 61): a row with the engine's record of it, a merge whole.
#[tauri::command(async)]
fn store_batch(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String, ops: Vec<store::Op>) -> Result<Vec<store::Row>, String> {
    stores.batch(&collection_dir(&app, &root)?, &ops)
}

#[tauri::command(async)]
fn store_meta(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String) -> Result<Vec<(String, String)>, String> {
    stores.meta(&collection_dir(&app, &root)?)
}

#[tauri::command(async)]
fn store_regs(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String, keys: Vec<String>) -> Result<Vec<store::Reg>, String> {
    stores.regs(&collection_dir(&app, &root)?, &keys)
}

#[tauri::command(async)]
fn store_regs_under(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String, prefixes: Vec<String>) -> Result<Vec<store::Reg>, String> {
    stores.regs_under(&collection_dir(&app, &root)?, &prefixes)
}

#[tauri::command(async)]
fn store_crdt(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String, doc: String) -> Result<Option<String>, String> {
    stores.crdt(&collection_dir(&app, &root)?, &doc)
}

#[tauri::command(async)]
fn store_outbox(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String, after: i64, bytes: i64) -> Result<Vec<(i64, String)>, String> {
    stores.outbox(&collection_dir(&app, &root)?, after, bytes)
}

#[tauri::command(async)]
fn store_outbox_count(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String) -> Result<i64, String> {
    stores.outbox_count(&collection_dir(&app, &root)?)
}

#[tauri::command(async)]
fn store_blob_has(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String, hash: String) -> Result<bool, String> {
    stores.blob_has(&collection_dir(&app, &root)?, &hash)
}

#[tauri::command(async)]
fn store_remove(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String, ids: Vec<String>) -> Result<(), String> {
    stores.remove(&collection_dir(&app, &root)?, &ids)
}

/// A blob's bytes, raw as the request's body; its collection in the `root` header, percent-encoded (a header is ASCII).
#[tauri::command]
async fn store_blob_put(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, request: tauri::ipc::Request<'_>) -> Result<store::BlobInfo, String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("a blob is sent as bytes".to_string());
    };
    let header = request.headers().get("root").and_then(|v| v.to_str().ok()).ok_or_else(|| "no collection named".to_string())?;
    let root = percent_encoding::percent_decode_str(header).decode_utf8().map_err(|e| e.to_string())?;
    stores.blob_put(&collection_dir(&app, &root)?, bytes)
}

#[tauri::command(async)]
fn store_blob_get(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String, hash: String) -> Result<tauri::ipc::Response, String> {
    stores.blob_get(&collection_dir(&app, &root)?, &hash).map(tauri::ipc::Response::new)
}

/// A page of ink's strokes (milestone 58), in the order they were drawn.
#[tauri::command(async)]
fn store_ink(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String, page: String) -> Result<Vec<store::InkStroke>, String> {
    stores.ink(&collection_dir(&app, &root)?, &page)
}

/// A page of ink as a file, made from its strokes: `drawing` (what PencilKit opens) or `picture` (a PNG).
#[tauri::command(async)]
fn store_ink_file(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String, page: String, what: String) -> Result<tauri::ipc::Response, String> {
    stores.ink_file(&collection_dir(&app, &root)?, &page, &what).map(tauri::ipc::Response::new)
}

/// A PencilKit drawing (base64) as its strokes, each with the name it keeps across saves.
#[tauri::command(async)]
fn ink_split(drawing: String) -> Result<Vec<store::InkStroke>, String> {
    use base64::Engine as _;
    let b64 = base64::engine::general_purpose::STANDARD;
    let bytes = b64.decode(drawing).map_err(|e| e.to_string())?;
    Ok(tauri_plugin_ink::split(&bytes)?.into_iter().map(|s| store::InkStroke { stroke: s.key, at: s.at, data: b64.encode(s.data) }).collect())
}

/// The canvas over the web view (iOS), until `done`: the drawing it held. `finger` lets a finger draw, for a check on a simulator.
#[tauri::command]
async fn ink_open(ink: tauri::State<'_, tauri_plugin_ink::Ink<tauri::Wry>>, drawing: Option<String>, finger: Option<bool>) -> Result<tauri_plugin_ink::Page, String> {
    ink.open(tauri_plugin_ink::Open { drawing, finger: finger.unwrap_or(false) }).await
}

/// The open canvas: how many strokes it holds, and its drawing once it has changed and been left alone for `quiet_ms`.
#[tauri::command]
async fn ink_peek(ink: tauri::State<'_, tauri_plugin_ink::Ink<tauri::Wry>>, quiet_ms: u32) -> Result<tauri_plugin_ink::Page, String> {
    ink.peek(quiet_ms).await
}

#[tauri::command(async)]
fn store_regs_page(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String, after: Option<String>, limit: i64) -> Result<Vec<store::Reg>, String> {
    stores.regs_page(&collection_dir(&app, &root)?, after.as_deref(), limit)
}

/// The blobs rows name whose bytes are not here (milestone 63), each with its size.
#[tauri::command(async)]
fn store_blobs_away(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String) -> Result<Vec<(String, i64)>, String> {
    stores.blobs_away(&collection_dir(&app, &root)?)
}

/// A file on disk taken in as a blob without its bytes crossing to the renderer: copied and named by its hash here.
#[tauri::command(async)]
fn store_blob_take(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String, path: String) -> Result<store::BlobInfo, String> {
    stores.take(&collection_dir(&app, &root)?, std::path::Path::new(&path))
}

/// A piece of a blob, for a reader that takes a big file as it needs it (the PDF lens).
#[tauri::command(async)]
fn store_blob_range(app: tauri::AppHandle, stores: tauri::State<'_, store::Stores>, root: String, hash: String, begin: u64, end: u64) -> Result<tauri::ipc::Response, String> {
    stores.blob_range(&collection_dir(&app, &root)?, &hash, begin, end).map(tauri::ipc::Response::new)
}

// ── the storages (milestone 63) ──────────────────────────────────
//
// `storage.rs` reaches a bucket or a WebDAV folder (and a folder on disk,
// for a blob). The renderer's engine reads and writes the small files
// through the four verbs; a blob goes between the collection's `blobs/`
// and the storage here, a piece at a time, the window told how far it is.

#[tauri::command]
async fn storage_list(config: storage::Config, prefix: String) -> Result<Vec<String>, String> {
    storage::list(&config, &prefix).await
}

/// A file's bytes, raw; `null` when the storage does not hold it.
#[tauri::command]
async fn storage_read(config: storage::Config, path: String) -> Result<tauri::ipc::Response, String> {
    Ok(match storage::read(&config, &path).await? {
        Some(bytes) => tauri::ipc::Response::new(bytes),
        None => tauri::ipc::Response::new("null".to_string()),
    })
}

/// The bytes raw as the request's body; the storage and the path in headers, percent-encoded (a header is ASCII).
#[tauri::command]
async fn storage_write(request: tauri::ipc::Request<'_>) -> Result<(), String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("a file is sent as bytes".to_string());
    };
    let header = |name: &str| -> Result<String, String> {
        let v = request.headers().get(name).and_then(|v| v.to_str().ok()).ok_or_else(|| format!("no {name}"))?;
        Ok(percent_encoding::percent_decode_str(v).decode_utf8().map_err(|e| e.to_string())?.into_owned())
    };
    let config: storage::Config = serde_json::from_str(&header("config")?).map_err(|e| e.to_string())?;
    storage::write(&config, &header("path")?, bytes.clone()).await
}

#[tauri::command]
async fn storage_remove(config: storage::Config, path: String) -> Result<(), String> {
    storage::remove(&config, &path).await
}

/// How far a blob is on its way, for the strip: sent to the window that asked, at most a hundred times a file.
#[derive(serde::Serialize, Clone)]
struct BlobProgress {
    hash: String,
    done: u64,
    total: u64,
    up: bool,
}

fn progress_to(window: &tauri::WebviewWindow, hash: &str, total: u64, up: bool) -> impl Fn(u64, Option<u64>) + Send + Sync + 'static {
    let app = window.app_handle().clone();
    let label = window.label().to_string();
    let hash = hash.to_string();
    let last = std::sync::atomic::AtomicU64::new(0);
    move |done, whole| {
        let total = whole.unwrap_or(total).max(1);
        let was = last.load(std::sync::atomic::Ordering::Relaxed);
        if done < total && done.saturating_sub(was) < (total / 100).max(1 << 18) {
            return;
        }
        last.store(done, std::sync::atomic::Ordering::Relaxed);
        let _ = app.emit_to(label.as_str(), "blob-progress", BlobProgress { hash: hash.clone(), done, total, up });
    }
}

/// A blob of the collection sent to its storage as `blobs/<hash>`, from its file, a piece at a time.
#[tauri::command]
async fn storage_blob_up(window: tauri::WebviewWindow, stores: tauri::State<'_, store::Stores>, root: String, config: storage::Config, hash: String) -> Result<(), String> {
    let dir = collection_dir(window.app_handle(), &root)?;
    let file = stores.blob_file(&dir, &hash)?.ok_or_else(|| format!("{hash}: not here"))?;
    let total = std::fs::metadata(&file).map(|m| m.len()).unwrap_or(0);
    let tell = progress_to(&window, &hash, total, true);
    storage::upload(&config, &format!("blobs/{hash}"), &file, &hash, move |n| tell(n, None)).await
}

/// A blob fetched from the storage into the collection, written to a file as it arrives and kept only when its
/// bytes hash to its name. False when the storage does not hold it (yet).
#[tauri::command]
async fn storage_blob_down(window: tauri::WebviewWindow, stores: tauri::State<'_, store::Stores>, root: String, config: storage::Config, hash: String, size: Option<u64>) -> Result<bool, String> {
    if !store::is_hash(&hash) {
        return Err(format!("{hash}: not a hash"));
    }
    let dir = collection_dir(window.app_handle(), &root)?;
    if stores.blob_has(&dir, &hash)? {
        return Ok(true);
    }
    let tmp = stores.blob_tmp(&dir)?;
    let got = storage::download(&config, &format!("blobs/{hash}"), &tmp, progress_to(&window, &hash, size.unwrap_or(0), false)).await;
    match got {
        Ok(Some((sha, len))) if sha == hash => stores.blob_land(&dir, &hash, &tmp, len as i64).map(|_| true),
        Ok(Some(_)) => {
            let _ = std::fs::remove_file(&tmp);
            Err("the file in the storage is not what its name says".to_string())
        }
        Ok(None) => {
            let _ = std::fs::remove_file(&tmp);
            Ok(false)
        }
        Err(e) => {
            let _ = std::fs::remove_file(&tmp);
            Err(e)
        }
    }
}

/// Dev only: the loopback servers shaped like an S3 bucket and a WebDAV folder (`devstore.rs`), over
/// `ILMI_STORAGE_DIR` or a folder of the system's temporary ones; the settings that reach each. An error in release.
#[tauri::command]
fn dev_storage_serve() -> Result<serde_json::Value, String> {
    #[cfg(debug_assertions)]
    {
        let root = std::env::var("ILMI_STORAGE_DIR")
            .ok()
            .filter(|s| !s.is_empty())
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| std::env::temp_dir().join(format!("ilmi-devstore-{}", std::process::id())));
        devstore::serve(&root).map(|url| devstore::settings(&url))
    }
    #[cfg(not(debug_assertions))]
    {
        Err("dev only".to_string())
    }
}

/// `export collection` as a zip: the folder the renderer wrote (`dir`), zipped under `top` at `dest`; how many files.
#[tauri::command(async)]
fn zip_folder(dir: String, top: String, dest: String) -> Result<usize, String> {
    let top = store::clean_name(&top).ok_or_else(|| "not a name".to_string())?;
    store::zip_dir(std::path::Path::new(&dir), top, std::path::Path::new(&dest))
}

/// One vault the renderer remembers, for the Open Recent submenu.
#[derive(serde::Deserialize)]
#[cfg_attr(mobile, allow(dead_code))]
struct RecentVault {
    path: String,
    name: String,
}

/// Rebuild File → Open Recent from the renderer's recents (newest first): the
/// submenu's items are replaced, one per vault with its name as the text and
/// `recent:<path>` as the id, and the submenu is disabled when there are
/// none. Tauri runs every menu mutation on the main thread.
#[tauri::command]
fn set_recent_vaults(app: tauri::AppHandle, items: Vec<RecentVault>) -> Result<(), String> {
    // no menu bar on iOS: the welcome's rows are the list
    #[cfg(mobile)]
    {
        let _ = (app, items);
        Ok(())
    }
    #[cfg(desktop)]
    set_recent_menu(app, items)
}

#[cfg(desktop)]
fn set_recent_menu(app: tauri::AppHandle, items: Vec<RecentVault>) -> Result<(), String> {
    let Some(menu) = app.menu() else { return Ok(()) };
    let Some(MenuItemKind::Submenu(file)) = menu.get(MENU_FILE) else { return Ok(()) };
    let Some(MenuItemKind::Submenu(recent)) = file.get(MENU_RECENT) else { return Ok(()) };
    for old in recent.items().map_err(|e| e.to_string())? {
        recent.remove(&old).map_err(|e| e.to_string())?;
    }
    for r in &items {
        let item = MenuItemBuilder::with_id(format!("{MENU_RECENT}:{}", r.path), &r.name)
            .build(&app)
            .map_err(|e| e.to_string())?;
        recent.append(&item).map_err(|e| e.to_string())?;
    }
    recent.set_enabled(!items.is_empty()).map_err(|e| e.to_string())
}

/// ⌘⇧V: the main webview pastes the clipboard as plain text, as Safari's
/// Paste and Match Style does (WebKit fires a `paste` event holding only
/// `text/plain`, which the reader lands as Markdown).
#[cfg(target_os = "macos")]
fn paste_plain(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.with_webview(|wv| {
            let view = wv.inner() as *mut objc2::runtime::AnyObject;
            if view.is_null() {
                return;
            }
            // SAFETY: `inner()` is the window's live WKWebView, messaged on the main thread;
            // the action is sent only when the view answers to it, and its sender may be nil.
            unsafe {
                let sel = objc2::sel!(pasteAsPlainText:);
                let answers: bool = objc2::msg_send![view, respondsToSelector: sel];
                if answers {
                    let _: () = objc2::msg_send![view, pasteAsPlainText: std::ptr::null_mut::<objc2::runtime::AnyObject>()];
                }
            }
        });
    }
}

// ── sync (milestone 53) ──────────────────────────────────────────
//
// Each command runs its git work off the main thread (`spawn_blocking`): a
// fetch or a push waits on the network, and a merge reads every changed
// blob. The renderer's `src/app/sync.ts` drives them; `sync.rs` says what
// each does.

async fn blocking<T: Send + 'static>(f: impl FnOnce() -> Result<T, String> + Send + 'static) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(f).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn sync_status(root: String) -> Result<sync::Status, String> {
    blocking(move || sync::status(&root)).await
}

#[tauri::command]
async fn sync_init(root: String, remote: Option<String>) -> Result<(), String> {
    blocking(move || sync::init(&root, remote.as_deref())).await
}

#[tauri::command]
async fn sync_init_bare(path: String) -> Result<(), String> {
    blocking(move || sync::init_bare(&path)).await
}

#[tauri::command]
async fn sync_set_remote(root: String, url: String) -> Result<(), String> {
    blocking(move || sync::set_remote(&root, &url)).await
}

#[tauri::command]
async fn sync_clone(url: String, token: Option<String>, dest: String) -> Result<(), String> {
    blocking(move || sync::clone(&url, token, &dest)).await
}

#[tauri::command]
async fn sync_changes(root: String) -> Result<Vec<sync::Change>, String> {
    blocking(move || sync::changes(&root)).await
}

#[tauri::command]
async fn sync_commit(root: String, message: String) -> Result<Option<String>, String> {
    blocking(move || sync::commit(&root, &message)).await
}

#[tauri::command]
async fn sync_fetch(root: String, token: Option<String>) -> Result<sync::Status, String> {
    blocking(move || sync::fetch(&root, token)).await
}

#[tauri::command]
async fn sync_merge(root: String) -> Result<sync::Merge, String> {
    blocking(move || sync::merge(&root)).await
}

#[tauri::command]
async fn sync_resolve(root: String, theirs: String, message: String, files: Vec<sync::Resolved>) -> Result<String, String> {
    blocking(move || sync::resolve(&root, &theirs, &message, files)).await
}

#[tauri::command]
async fn sync_push(root: String, token: Option<String>) -> Result<sync::Status, String> {
    blocking(move || sync::push(&root, token)).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    // First, so a second launch (the OS opening an `ilmi://` link on
    // Windows or Linux, where a link is an argument to a new process)
    // hands its arguments to the running one and exits. The plugin's
    // `deep-link` feature forwards the link to the deep-link plugin's
    // event; this closure only brings the window to the front.
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.unminimize();
            let _ = w.set_focus();
        }
    }));
    // Every item of the File menu reaches the renderer as one `menu`
    // event carrying the item's id; `src/app/menu.ts` does the rest.
    #[cfg(desktop)]
    let builder = builder.on_menu_event(|app, event| {
        #[cfg(target_os = "macos")]
        if event.id().0 == MENU_PASTE_PLAIN {
            paste_plain(app);
            return;
        }
        let _ = app.emit("menu", event.id().0.clone());
    });
    builder
        // `ilmi://`, the scheme in `tauri.conf.json`; the renderer listens
        // for `deep-link://new-url` and `clipper.ts` does what the link asks.
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_ink::init())
        .manage(store::Stores::default())
        .invoke_handler(tauri::generate_handler![allow_vault, allow_hidden, read_dropped, read_dropped_bytes, read_anki_package, read_epub, read_plugin_zip, platform, dev_env, dev_web_memory, dev_nudge_serve, dev_nudge_drop, dev_nudge_listeners, set_recent_vaults, store_list, store_create, store_delete, store_rows, store_text, store_put, store_remove, store_version, store_set_version, store_doc, store_places, store_digests, store_review_files, store_reviews, store_reviews_put, store_same, store_same_put, store_originals, store_original_put, store_blob_put, store_blob_get, store_batch, store_meta, store_regs, store_regs_under, store_crdt, store_outbox, store_outbox_count, store_blob_has, store_regs_page, store_blobs_away, store_blob_take, store_blob_range, store_ink, store_ink_file, ink_split, ink_open, ink_peek, storage_list, storage_read, storage_write, storage_remove, storage_blob_up, storage_blob_down, dev_storage_serve, zip_folder, sync_status, sync_init, sync_init_bare, sync_set_remote, sync_clone, sync_changes, sync_commit, sync_fetch, sync_merge, sync_resolve, sync_push])
        .setup(|app| {
            // Windows and Linux learn the scheme at run time; macOS reads it
            // from the bundle's Info.plist, which Tauri writes from the
            // config, so a dev binary there may not own it.
            #[cfg(any(windows, target_os = "linux"))]
            {
                use tauri_plugin_deep_link::DeepLinkExt;
                app.deep_link().register_all()?;
            }
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
                // Dev only: `ILMI_VAULT2=/path` opens a second window over
                // that vault beside the first (the sync smoke's other
                // device). The renderer tells the windows apart by label.
                #[cfg(desktop)]
                if std::env::var("ILMI_VAULT2").map(|v| !v.is_empty()).unwrap_or(false) {
                    tauri::WebviewWindowBuilder::new(app, "second", tauri::WebviewUrl::default())
                        .title("ilmi · second")
                        .inner_size(1280.0, 820.0)
                        .min_inner_size(720.0, 480.0)
                        .position(80.0, 80.0)
                        .build()?;
                }
            }
            // The menu bar. The default macOS menu binds ⌘W to Close Window;
            // the app uses ⌘W to close a tab, so the menu is built here
            // without that item. File holds the collection commands (a new
            // one named on the welcome, or a folder imported as one) and
            // Import… (the picker; the files land as a drop does); its
            // Open Recent submenu is filled by `set_recent_vaults` from the
            // renderer's recents and rebuilt when they change. The app menu
            // is macOS only; Windows and Linux get File, Edit, and Window
            // with Quit at the end of File. iOS has no menu bar.
            #[cfg(desktop)]
            {
                let new_item = MenuItemBuilder::with_id(MENU_NEW, "New Collection…")
                    .accelerator("CmdOrCtrl+Shift+N")
                    .build(app)?;
                let open_item = MenuItemBuilder::with_id(MENU_OPEN, "New Collection from Folder…")
                    .accelerator("CmdOrCtrl+O")
                    .build(app)?;
                let recent = SubmenuBuilder::with_id(app, MENU_RECENT, "Open Recent")
                    .enabled(false)
                    .build()?;
                let import_item = MenuItemBuilder::with_id(MENU_IMPORT, "Import…")
                    .accelerator("CmdOrCtrl+Shift+O")
                    .build(app)?;
                let close_item = MenuItemBuilder::with_id(MENU_CLOSE, "Close Collection")
                    .accelerator("CmdOrCtrl+Shift+W")
                    .build(app)?;
                let file = SubmenuBuilder::with_id(app, MENU_FILE, "File")
                    .item(&new_item)
                    .item(&open_item)
                    .item(&recent)
                    .separator()
                    .item(&import_item)
                    .separator()
                    .item(&close_item);
                #[cfg(not(target_os = "macos"))]
                let file = file.separator().quit();
                let file = file.build()?;
                let edit = SubmenuBuilder::new(app, "Edit")
                    .undo()
                    .redo()
                    .separator()
                    .cut()
                    .copy()
                    .paste();
                #[cfg(target_os = "macos")]
                let edit = edit.item(
                    &MenuItemBuilder::with_id(MENU_PASTE_PLAIN, "Paste and Match Style")
                        .accelerator("CmdOrCtrl+Shift+V")
                        .build(app)?,
                );
                let edit = edit.select_all().build()?;
                let window = SubmenuBuilder::new(app, "Window")
                    .minimize()
                    .maximize()
                    .fullscreen()
                    .build()?;
                let bar = MenuBuilder::new(app);
                #[cfg(target_os = "macos")]
                let bar = bar.item(
                    &SubmenuBuilder::new(app, "ilmi")
                        .about(None)
                        .separator()
                        .services()
                        .separator()
                        .hide()
                        .hide_others()
                        .show_all()
                        .separator()
                        .quit()
                        .build()?,
                );
                let menu = bar.items(&[&file, &edit, &window]).build()?;
                app.set_menu(menu)?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running ilmi");
}

#[cfg(test)]
mod tests {
    use super::smoke_json;

    #[test]
    fn smoke_json_stands_in_for_the_environment() {
        let dir = std::env::temp_dir().join(format!("ilmi-smoke-json-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        // no file: nothing
        assert_eq!(smoke_json(&dir, "ILMI_SMOKE"), None);
        std::fs::write(
            dir.join("smoke.json"),
            r#"{"mode": "tour", "vault": "double-major", "remote": "/tmp/bare.git", "empty": "", "list": [1]}"#,
        )
        .unwrap();
        assert_eq!(smoke_json(&dir, "ILMI_SMOKE").as_deref(), Some("tour"));
        // a vault by name is the one in Documents
        assert_eq!(
            smoke_json(&dir, "ILMI_VAULT"),
            Some(dir.join("double-major").to_string_lossy().into_owned())
        );
        assert_eq!(smoke_json(&dir, "ILMI_REMOTE").as_deref(), Some("/tmp/bare.git"));
        assert_eq!(smoke_json(&dir, "ILMI_EMPTY"), None);
        assert_eq!(smoke_json(&dir, "ILMI_LIST"), None);
        assert_eq!(smoke_json(&dir, "ILMI_VAULT2"), None);
        assert_eq!(smoke_json(&dir, "HOME"), None);
        // an absolute vault is taken as it is
        std::fs::write(dir.join("smoke.json"), r#"{"mode": "queue", "vault": "/elsewhere/v"}"#).unwrap();
        assert_eq!(smoke_json(&dir, "ILMI_VAULT").as_deref(), Some("/elsewhere/v"));
        // not an object, not JSON: nothing
        std::fs::write(dir.join("smoke.json"), "[]").unwrap();
        assert_eq!(smoke_json(&dir, "ILMI_SMOKE"), None);
        std::fs::write(dir.join("smoke.json"), "mode: tour").unwrap();
        assert_eq!(smoke_json(&dir, "ILMI_SMOKE"), None);
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
