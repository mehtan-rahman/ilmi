mod anki;
mod epub;
mod plugin;

use tauri::Manager;
use tauri_plugin_fs::FsExt;

#[cfg(target_os = "macos")]
use tauri::menu::{MenuBuilder, SubmenuBuilder};

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
        .invoke_handler(tauri::generate_handler![allow_vault, read_dropped, read_dropped_bytes, read_anki_package, read_epub, read_plugin_zip, dev_env])
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
            // The default macOS menu binds ⌘W to Close Window; the app uses
            // ⌘W to close a tab, so the menu is built without that item.
            #[cfg(target_os = "macos")]
            {
                let app_menu = SubmenuBuilder::new(app, "ilmi")
                    .about(None)
                    .separator()
                    .services()
                    .separator()
                    .hide()
                    .hide_others()
                    .show_all()
                    .separator()
                    .quit()
                    .build()?;
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
                let menu = MenuBuilder::new(app)
                    .items(&[&app_menu, &edit, &window])
                    .build()?;
                app.set_menu(menu)?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running ilmi");
}
