use tauri::State;

use crate::{
    db::CatalogRepository,
    error::AppCommandError,
    model::{CreateSiteInput, DeletedSiteSnapshot, Site, UpdateSiteInput},
};

#[tauri::command]
pub async fn create_site(repository: State<'_, CatalogRepository>, input: CreateSiteInput) -> Result<Site, AppCommandError> {
    repository.create_site(input).await
}

#[tauri::command]
pub async fn get_site(repository: State<'_, CatalogRepository>, id: String) -> Result<Site, AppCommandError> {
    repository.get_site(&id).await
}

#[tauri::command]
pub async fn update_site(repository: State<'_, CatalogRepository>, input: UpdateSiteInput) -> Result<Site, AppCommandError> {
    repository.update_site(input).await
}

#[tauri::command]
pub async fn delete_sites(repository: State<'_, CatalogRepository>, ids: Vec<String>) -> Result<Vec<DeletedSiteSnapshot>, AppCommandError> {
    repository.delete_sites(ids).await
}

#[tauri::command]
pub async fn restore_sites(repository: State<'_, CatalogRepository>, snapshots: Vec<DeletedSiteSnapshot>) -> Result<(), AppCommandError> {
    repository.restore_sites(snapshots).await
}
