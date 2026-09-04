use tauri_plugin_opener::OpenerExt;

use crate::{
    desktop::opener::{open_urls_with, UrlOpener},
    url_normalizer::{AppError, AppErrorCode},
};

struct TauriUrlOpener<'a> {
    app: &'a tauri::AppHandle,
}

impl UrlOpener for TauriUrlOpener<'_> {
    fn open_url(&self, url: &str) -> Result<(), AppError> {
        self.app
            .opener()
            .open_url(url, None::<&str>)
            .map_err(|error| {
                AppError::new(
                    AppErrorCode::Io,
                    format!("Failed to open URL in the system browser: {error}"),
                )
            })
    }
}

#[tauri::command]
pub fn open_urls(app: tauri::AppHandle, urls: Vec<String>) -> Result<(), AppError> {
    open_urls_with(&TauriUrlOpener { app: &app }, urls)
}
