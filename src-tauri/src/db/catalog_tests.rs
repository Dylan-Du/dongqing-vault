use serde::Deserialize;
use tempfile::tempdir;

use crate::error::AppCommandErrorCode;

use super::{catalog::taxonomy_name_key, CatalogRepository, Database};

#[derive(Deserialize)]
struct NameKeyVector {
    input: String,
    key: String,
}

#[test]
fn taxonomy_name_key_matches_shared_vectors_and_rejects_empty() {
    let vectors: Vec<NameKeyVector> = serde_json::from_str(include_str!(
        "../../../tests/fixtures/taxonomy-name-keys.json"
    ))
    .unwrap();
    for vector in vectors {
        assert_eq!(taxonomy_name_key(&vector.input).unwrap(), vector.key);
    }
    assert_eq!(
        taxonomy_name_key(" \u{3000} ").unwrap_err().code,
        AppCommandErrorCode::Validation
    );
}

#[tokio::test]
async fn taxonomy_repository_create_list_conflict_counts_and_delete_semantics() {
    let directory = tempdir().unwrap();
    let database = Database::open(directory.path().join("data.sqlite3"))
        .await
        .unwrap();
    let repository = CatalogRepository::new(database.clone());
    let category = repository.create_category(" Ｆｉｇｍａ ", "#aabbcc").await.unwrap();
    let tag = repository.create_tag("Production", "#112233").await.unwrap();
    assert_eq!(category.name_key, "figma");
    assert_eq!(category.color, "#AABBCC");
    assert_eq!(category.sort_index, 0);
    assert_eq!(tag.sort_index, 0);
    assert_eq!(
        repository.create_category("figma", "#000000").await.unwrap_err().code,
        AppCommandErrorCode::Conflict
    );
    let snapshot = repository.list_taxonomy().await.unwrap();
    assert_eq!(snapshot.categories[0].site_count, 0);
    assert_eq!(snapshot.tags[0].site_count, 0);

    let renamed = repository
        .update_category(&category.id, "Design", "#abcdef")
        .await
        .unwrap();
    assert_eq!(renamed.sort_index, category.sort_index);
    assert_eq!(renamed.color, "#ABCDEF");
    assert_eq!(repository.delete_category(&renamed.id).await.unwrap(), 0);
    assert_eq!(repository.delete_tag(&tag.id).await.unwrap(), 0);
}
