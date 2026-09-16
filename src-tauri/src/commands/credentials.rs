use tauri::State;

use crate::{
    db::CatalogRepository,
    error::{AppCommandError, AppCommandErrorCode},
    model::Site,
};

const KEYCHAIN_SERVICE: &str = "com.dongqing.vault.website-password";

fn entry(site_id: &str) -> Result<keyring::Entry, AppCommandError> {
    keyring::Entry::new(KEYCHAIN_SERVICE, site_id).map_err(keychain_error)
}

fn keychain_error(error: keyring::Error) -> AppCommandError {
    AppCommandError::with_details(
        AppCommandErrorCode::Internal,
        "无法访问 macOS 钥匙串。",
        error.to_string(),
    )
}

#[tauri::command]
pub async fn get_site_password(site_id: String) -> Result<String, AppCommandError> {
    tauri::async_runtime::spawn_blocking(move || entry(&site_id)?.get_password().map_err(keychain_error))
        .await
        .map_err(|error| AppCommandError::with_details(AppCommandErrorCode::Internal, "读取密码失败。", error.to_string()))?
}

#[tauri::command]
pub async fn set_site_password(
    repository: State<'_, CatalogRepository>,
    site_id: String,
    password: String,
) -> Result<Site, AppCommandError> {
    if password.is_empty() {
        return Err(AppCommandError::new(AppCommandErrorCode::Validation, "密码不能为空。"));
    }
    repository.get_site(&site_id).await?;
    let keychain_id = site_id.clone();
    tauri::async_runtime::spawn_blocking(move || entry(&keychain_id)?.set_password(&password).map_err(keychain_error))
        .await
        .map_err(|error| AppCommandError::with_details(AppCommandErrorCode::Internal, "保存密码失败。", error.to_string()))??;
    repository.set_has_password(&site_id, true).await
}

#[tauri::command]
pub async fn delete_site_password(
    repository: State<'_, CatalogRepository>,
    site_id: String,
) -> Result<Site, AppCommandError> {
    let keychain_id = site_id.clone();
    tauri::async_runtime::spawn_blocking(move || match entry(&keychain_id)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(keychain_error(error)),
    })
    .await
    .map_err(|error| AppCommandError::with_details(AppCommandErrorCode::Internal, "删除密码失败。", error.to_string()))??;
    repository.set_has_password(&site_id, false).await
}

pub async fn remove_deleted_passwords(site_ids: Vec<String>) {
    let _ = tauri::async_runtime::spawn_blocking(move || {
        for site_id in site_ids {
            if let Ok(entry) = entry(&site_id) {
                let _ = entry.delete_credential();
            }
        }
    })
    .await;
}
