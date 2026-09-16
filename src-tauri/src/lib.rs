pub mod commands;
pub mod db;
pub mod desktop;
pub mod error;
pub mod model;
pub mod url_normalizer;

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .setup(|app| {
            let database_path = app.path().app_data_dir()?.join("data.sqlite3");
            let database = tauri::async_runtime::block_on(db::Database::open(database_path))?;
            app.manage(db::CatalogRepository::new(database));

            let show_item = MenuItemBuilder::with_id("show", "显示主窗口").build(app)?;
            let check_item = MenuItemBuilder::with_id("check", "立即检测全部").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "退出东青Vault").build(app)?;
            let tray_menu = MenuBuilder::new(app)
                .items(&[&show_item, &check_item, &quit_item])
                .build()?;

            TrayIconBuilder::new()
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => show_main_window(app),
                    "check" => {
                        let _ = app.emit("tray:check-all", ());
                        show_main_window(app);
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;
            Ok(())
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_log::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            commands::desktop::open_urls,
            commands::credentials::get_site_password,
            commands::credentials::set_site_password,
            commands::credentials::delete_site_password,
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
            commands::sites::record_health_checks,
            commands::sites::delete_sites,
            commands::sites::restore_sites,
            commands::query::list_sites,
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        });

    #[cfg(target_os = "macos")]
    let app = builder.build(tauri::generate_context!()).expect("error while building tauri application");

    #[cfg(target_os = "macos")]
    app.run(|app_handle, event| {
        if let tauri::RunEvent::Reopen { has_visible_windows, .. } = event {
            // macOS: clicking the Dock icon or re-launching must reveal the hidden window.
            if !has_visible_windows {
                show_main_window(app_handle);
            }
        }
    });

    #[cfg(not(target_os = "macos"))]
    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}
