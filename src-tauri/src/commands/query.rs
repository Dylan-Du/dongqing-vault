use tauri::State;

use crate::{db::CatalogRepository, error::AppCommandError, model::{SitePage, SiteQuery}};

#[tauri::command]
pub async fn list_sites(repository: State<'_, CatalogRepository>, input: SiteQuery) -> Result<SitePage, AppCommandError> {
    repository.list_sites(input).await
}
