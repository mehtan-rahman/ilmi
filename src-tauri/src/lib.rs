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
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![allow_vault, read_dropped, read_dropped_bytes, dev_env])
        .setup(|app| {
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
