mod anki;
mod epub;
mod plugin;

use tauri::menu::{MenuBuilder, MenuItemBuilder, MenuItemKind, SubmenuBuilder};
use tauri::{Emitter, Manager};
use tauri_plugin_fs::FsExt;

/// The ids of the File menu's items, as the renderer receives them on the
/// `menu` event (`src/app/menu.ts` dispatches on them). A recent vault's
/// item is `recent:<path>`.
const MENU_FILE: &str = "file";
const MENU_RECENT: &str = "recent";
const MENU_NEW: &str = "new";
const MENU_OPEN: &str = "open";
const MENU_CLOSE: &str = "close";

/// Widen the fs scope to a vault directory. The dialog plugin does this for a
/// picked directory; this covers paths that arrive any other way. The
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

/// Dev only: an environment variable of the dev process, for
/// `ILMI_VAULT=/path npm run tauri dev` (open that vault at launch) and
/// `ILMI_SMOKE=…` (run a smoke script). Always `None` in release.
#[tauri::command]
fn dev_env(name: String) -> Option<String> {
    if cfg!(debug_assertions) && name.starts_with("ILMI_") {
        std::env::var(name).ok().filter(|s| !s.is_empty())
    } else {
        None
    }
}

/// One vault the renderer remembers, for the Open Recent submenu.
#[derive(serde::Deserialize)]
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // First, so a second launch (the OS opening an `ilmi://` link on
        // Windows or Linux, where a link is an argument to a new process)
        // hands its arguments to the running one and exits. The plugin's
        // `deep-link` feature forwards the link to the deep-link plugin's
        // event; this closure only brings the window to the front.
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        // `ilmi://`, the scheme in `tauri.conf.json`; the renderer listens
        // for `deep-link://new-url` and `clipper.ts` does what the link asks.
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![allow_vault, read_dropped, read_dropped_bytes, read_anki_package, read_epub, read_plugin_zip, dev_env, set_recent_vaults])
        // Every item of the File menu reaches the renderer as one `menu`
        // event carrying the item's id; `src/app/menu.ts` does the rest.
        .on_menu_event(|app, event| {
            let _ = app.emit("menu", event.id().0.clone());
        })
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
            }
            // The menu bar. The default macOS menu binds ⌘W to Close Window;
            // the app uses ⌘W to close a tab, so the menu is built here
            // without that item. File holds the collection commands; its
            // Open Recent submenu is filled by `set_recent_vaults` from the
            // renderer's recents and rebuilt when they change. The app menu
            // is macOS only; Windows and Linux get File, Edit, and Window
            // with Quit at the end of File.
            {
                let new_item = MenuItemBuilder::with_id(MENU_NEW, "New Collection…")
                    .accelerator("CmdOrCtrl+Shift+N")
                    .build(app)?;
                let open_item = MenuItemBuilder::with_id(MENU_OPEN, "Open Collection…")
                    .accelerator("CmdOrCtrl+O")
                    .build(app)?;
                let recent = SubmenuBuilder::with_id(app, MENU_RECENT, "Open Recent")
                    .enabled(false)
                    .build()?;
                let close_item = MenuItemBuilder::with_id(MENU_CLOSE, "Close Collection")
                    .accelerator("CmdOrCtrl+Shift+W")
                    .build(app)?;
                let file = SubmenuBuilder::with_id(app, MENU_FILE, "File")
                    .item(&new_item)
                    .item(&open_item)
                    .item(&recent)
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
                    .paste()
                    .select_all()
                    .build()?;
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
