pub mod commands;
pub mod db;
pub mod desktop;
pub mod error;
pub mod model;
pub mod url_normalizer;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let database_path = app.path().app_data_dir()?.join("data.sqlite3");
            let database = tauri::async_runtime::block_on(db::Database::open(database_path))?;
            app.manage(db::CatalogRepository::new(database));
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_log::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            commands::desktop::open_urls,
            commands::taxonomy::list_taxonomy,
            commands::taxonomy::create_category,
            commands::taxonomy::update_category,
            commands::taxonomy::delete_category,
            commands::taxonomy::create_tag,
            commands::taxonomy::update_tag,
            commands::taxonomy::delete_tag,
            commands::sites::create_site,
            commands::sites::get_site,
            commands::sites::update_site,
            commands::sites::delete_sites,
            commands::sites::restore_sites,
            commands::query::list_sites,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
