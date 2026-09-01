pub mod commands;
pub mod desktop;
pub mod error;
pub mod model;
pub mod url_normalizer;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_log::Builder::default().build())
        .invoke_handler(tauri::generate_handler![commands::desktop::open_urls])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
