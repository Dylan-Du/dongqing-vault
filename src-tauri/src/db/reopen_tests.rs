use tempfile::tempdir;

use super::Database;

#[tokio::test]
async fn reopen_swaps_connection_and_increments_generation() {
    let directory = tempdir().expect("temporary database directory");
    let path = directory.path().join("catalog.sqlite3");
    let database = Database::open(&path).await.expect("open database");
    let before = database.generation();

    database.reopen(&path).await.expect("reopen database");

    assert_eq!(database.generation(), before + 1);
    let version = database
        .read(|connection| connection.query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0)))
        .await
        .expect("read reopened database");
    assert_eq!(version, 1);
}
