use tauri_plugin_fs::FsExt;

/// Widen the fs scope to a vault directory. The dialog plugin does this for a
/// picked directory; this covers paths that arrive any other way.
#[tauri::command]
fn allow_vault(app: tauri::AppHandle, path: String) -> Result<(), String> {
    app.fs_scope()
        .allow_directory(&path, true)
        .map_err(|e| e.to_string())
}

/// Dev only: `ILMI_VAULT=/path npm run tauri dev` opens that vault at launch.
#[tauri::command]
fn initial_vault() -> Option<String> {
    if cfg!(debug_assertions) {
        std::env::var("ILMI_VAULT").ok().filter(|s| !s.is_empty())
    } else {
        None
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![allow_vault, initial_vault])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running ilmi");
}
