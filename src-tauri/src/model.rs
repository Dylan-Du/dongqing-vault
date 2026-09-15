use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AutoStatus {
    Unchecked,
    Available,
    Unavailable,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ManualStatus {
    Available,
    Unavailable,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LastCheckSource {
    Scheduled,
    Manual,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Site {
    pub id: String,
    pub name: String,
    pub domain: String,
    pub url: String,
    pub normalized_url: String,
    pub notes: String,
    pub category_id: Option<String>,
    pub tag_ids: Vec<String>,
    pub is_pinned: bool,
    pub auto_status: AutoStatus,
    pub manual_status: Option<ManualStatus>,
    pub failure_streak: u8,
    pub last_checked_at: Option<String>,
    pub last_success_at: Option<String>,
    pub last_check_source: Option<LastCheckSource>,
    pub last_http_status: Option<u16>,
    pub last_response_ms: Option<u32>,
    pub last_check_error: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub url_revision: u32,
    pub row_revision: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SiteQuery {
    pub keyword: String,
    pub category_id: Option<String>,
    pub tag_ids: Vec<String>,
    pub status: Option<AutoStatus>,
    pub sort_by: SiteSortBy,
    pub sort_direction: SortDirection,
    pub offset: u32,
    pub limit: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SiteSortBy {
    Name,
    Domain,
    CreatedAt,
    UpdatedAt,
    Status,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SortDirection {
    Asc,
    Desc,
}

pub type SiteListItem = Site;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Paged<T> {
    pub items: Vec<T>,
    pub total: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SiteSummary {
    pub total: u32,
    pub available: u32,
    pub needs_attention: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SitePage {
    pub items: Vec<SiteListItem>,
    pub total: u32,
    pub summary: SiteSummary,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub name: String,
    pub name_key: String,
    pub color: String,
    pub sort_index: i32,
    pub created_at: String,
    pub updated_at: String,
}

pub type Tag = Category;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryListItem {
    pub id: String,
    pub name: String,
    pub name_key: String,
    pub color: String,
    pub sort_index: i32,
    pub created_at: String,
    pub updated_at: String,
    pub site_count: u32,
}

pub type TagListItem = CategoryListItem;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaxonomySnapshot {
    pub categories: Vec<CategoryListItem>,
    pub tags: Vec<TagListItem>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSiteInput {
    pub name: String,
    pub domain: String,
    pub url: String,
    pub notes: String,
    pub category_id: Option<String>,
    pub tag_ids: Vec<String>,
    pub is_pinned: bool,
    pub manual_status: Option<ManualStatus>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSiteInput {
    pub id: String,
    pub expected_row_revision: u32,
    pub name: String,
    pub domain: String,
    pub url: String,
    pub notes: String,
    pub category_id: Option<String>,
    pub tag_ids: Vec<String>,
    pub is_pinned: bool,
    pub manual_status: Option<ManualStatus>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HealthCheckResultInput {
    pub id: String,
    pub expected_url_revision: u32,
    pub auto_status: AutoStatus,
    pub failure_streak: u8,
    pub checked_at: String,
    pub source: LastCheckSource,
    pub http_status: Option<u16>,
    pub response_ms: u32,
    pub error: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletedSiteSnapshot {
    pub site: Site,
}

#[cfg(test)]
pub mod tests {
    use super::*;

    #[test]
    fn site_serializes_contract_keys_as_camel_case() {
        let site = Site {
            id: "00000000-0000-4000-8000-000000000000".to_string(),
            name: "Example".to_string(),
            domain: "example.com".to_string(),
            url: "https://example.com".to_string(),
            normalized_url: "https://example.com".to_string(),
            notes: "".to_string(),
            category_id: None,
            tag_ids: vec!["tag-1".to_string()],
            is_pinned: false,
            auto_status: AutoStatus::Unchecked,
            manual_status: None,
            failure_streak: 0,
            last_checked_at: None,
            last_success_at: None,
            last_check_source: None,
            last_http_status: None,
            last_response_ms: None,
            last_check_error: None,
            created_at: "2026-01-01T00:00:00.000Z".to_string(),
            updated_at: "2026-01-01T00:00:00.000Z".to_string(),
            url_revision: 1,
            row_revision: 1,
        };

        let value = serde_json::to_value(site).expect("site serializes");
        let object = value.as_object().expect("serialized site is an object");

        assert!(object.contains_key("normalizedUrl"));
        assert!(object.contains_key("lastSuccessAt"));
        assert!(object.contains_key("urlRevision"));
        assert!(object.contains_key("rowRevision"));
    }
}
