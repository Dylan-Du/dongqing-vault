use tempfile::tempdir;

use crate::model::{AutoStatus, CreateSiteInput, SiteQuery, SiteSortBy, SortDirection};
use super::{CatalogRepository, Database};

fn input(name: &str, url: &str, tags: Vec<String>) -> CreateSiteInput {
    CreateSiteInput { name: name.into(), domain: String::new(), url: url.into(), notes: String::new(), category_id: None, tag_ids: tags, is_pinned: false, manual_status: None }
}

#[tokio::test]
async fn parameterized_query_escapes_wildcards_requires_all_tags_and_pages_stably() {
    let directory = tempdir().unwrap();
    let repository = CatalogRepository::new(Database::open(directory.path().join("data.sqlite3")).await.unwrap());
    let a = repository.create_tag("100%", "#112233").await.unwrap();
    let b = repository.create_tag("under_score", "#223344").await.unwrap();
    repository.create_site(input("literal 100%", "percent.test", vec![a.id.clone(), b.id.clone()])).await.unwrap();
    repository.create_site(input("literal 100x", "other.test", vec![a.id.clone()])).await.unwrap();
    let page = repository.list_sites(SiteQuery { keyword: "%".into(), category_id: None, tag_ids: vec![a.id, b.id], status: None, sort_by: SiteSortBy::Name, sort_direction: SortDirection::Asc, offset: 0, limit: 1 }).await.unwrap();
    assert_eq!(page.total, 1);
    assert_eq!(page.items[0].name, "literal 100%");
    assert_eq!(page.summary.total, 1);
}

#[tokio::test]
async fn query_uses_manual_effective_status_pinned_partition_and_id_tie_break() {
    let directory = tempdir().unwrap();
    let repository = CatalogRepository::new(Database::open(directory.path().join("data.sqlite3")).await.unwrap());
    let mut first = repository.create_site(input("Same", "one.test", vec![])).await.unwrap();
    let mut second = repository.create_site(input("Same", "two.test", vec![])).await.unwrap();
    repository.database().write({ let id = first.id.clone(); move |connection| { connection.execute("UPDATE sites SET manual_status='available',is_pinned=1 WHERE id=?1", [&id])?; Ok(()) } }).await.unwrap();
    first = repository.get_site(&first.id).await.unwrap();
    second = repository.get_site(&second.id).await.unwrap();
    let page = repository.list_sites(SiteQuery { keyword: String::new(), category_id: None, tag_ids: vec![], status: Some(AutoStatus::Available), sort_by: SiteSortBy::Name, sort_direction: SortDirection::Desc, offset: 0, limit: 50 }).await.unwrap();
    assert_eq!(page.items.iter().map(|site| &site.id).collect::<Vec<_>>(), vec![&first.id]);
    assert!(first.is_pinned);
    assert!(!second.is_pinned);
}
