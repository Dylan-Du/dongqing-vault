use serde::Deserialize;
use tauri::State;

use crate::{
    db::CatalogRepository,
    error::AppCommandError,
    model::{Category, Tag, TaxonomySnapshot},
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaxonomyInput {
    pub name: String,
    pub color: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTaxonomyInput {
    pub id: String,
    pub name: String,
    pub color: String,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteTaxonomyResult {
    pub affected_sites: u32,
}

#[tauri::command]
pub async fn list_taxonomy(repository: State<'_, CatalogRepository>) -> Result<TaxonomySnapshot, AppCommandError> {
    repository.list_taxonomy().await
}

#[tauri::command]
pub async fn create_category(repository: State<'_, CatalogRepository>, input: TaxonomyInput) -> Result<Category, AppCommandError> {
    repository.create_category(&input.name, &input.color).await
}

#[tauri::command]
pub async fn update_category(repository: State<'_, CatalogRepository>, input: UpdateTaxonomyInput) -> Result<Category, AppCommandError> {
    repository.update_category(&input.id, &input.name, &input.color).await
}

#[tauri::command]
pub async fn delete_category(repository: State<'_, CatalogRepository>, id: String) -> Result<DeleteTaxonomyResult, AppCommandError> {
    Ok(DeleteTaxonomyResult { affected_sites: repository.delete_category(&id).await? })
}

#[tauri::command]
pub async fn create_tag(repository: State<'_, CatalogRepository>, input: TaxonomyInput) -> Result<Tag, AppCommandError> {
    repository.create_tag(&input.name, &input.color).await
}

#[tauri::command]
pub async fn update_tag(repository: State<'_, CatalogRepository>, input: UpdateTaxonomyInput) -> Result<Tag, AppCommandError> {
    repository.update_tag(&input.id, &input.name, &input.color).await
}

#[tauri::command]
pub async fn delete_tag(repository: State<'_, CatalogRepository>, id: String) -> Result<DeleteTaxonomyResult, AppCommandError> {
    Ok(DeleteTaxonomyResult { affected_sites: repository.delete_tag(&id).await? })
}
