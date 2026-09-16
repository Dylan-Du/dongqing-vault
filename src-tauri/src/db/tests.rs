use std::{fs, sync::Arc};

use tempfile::tempdir;
use tokio::time::{timeout, Duration};

use crate::error::AppCommandErrorCode;

use super::{Database, MaintenanceGate};

#[tokio::test]
async fn migration_creates_v2_schema_and_foreign_keys() {
    let directory = tempdir().unwrap();
    let database = Database::open(directory.path().join("data.sqlite3"))
        .await
        .unwrap();

    database
        .read(|connection| {
            let mut statement = connection.prepare(
                "SELECT name FROM sqlite_master WHERE type IN ('table', 'index')",
            )?;
            let names = statement
                .query_map([], |row| row.get::<_, String>(0))?
                .collect::<Result<Vec<_>, _>>()?;
            for required in [
                "categories",
                "tags",
                "sites",
                "site_tags",
                "app_settings",
                "scheduler_state",
                "idx_sites_normalized_url",
                "idx_sites_category_id",
                "idx_sites_is_pinned",
                "idx_site_tags_tag_site",
            ] {
                assert!(names.iter().any(|name| name == required), "missing {required}");
            }
            assert_eq!(connection.query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))?, 2);
            assert_eq!(connection.query_row("PRAGMA foreign_keys", [], |row| row.get::<_, i64>(0))?, 1);

            let invalid_category = connection.execute(
                "INSERT INTO sites (id,name,domain,url,normalized_url,notes,category_id,is_pinned,auto_status,failure_streak,created_at,updated_at) VALUES (?1,'x','x.test','https://x.test/','https://x.test/','',?2,0,'unchecked',0,'now','now')",
                ("site-invalid-category", "missing-category"),
            );
            assert!(invalid_category.is_err());
            let invalid_tag = connection.execute(
                "INSERT INTO site_tags (site_id, tag_id) VALUES (?1, ?2)",
                ("missing-site", "missing-tag"),
            );
            assert!(invalid_tag.is_err());
            Ok(())
        })
        .await
        .unwrap();
}

#[tokio::test]
async fn migration_upgrades_existing_v1_sites_without_losing_data() {
    let directory = tempdir().unwrap();
    let path = directory.path().join("existing.sqlite3");
    {
        let connection = rusqlite::Connection::open(&path).unwrap();
        connection.execute_batch(include_str!("../../migrations/0001_initial.sql")).unwrap();
        connection.execute(
            "INSERT INTO sites (id,name,domain,url,normalized_url,notes,is_pinned,auto_status,failure_streak,created_at,updated_at) VALUES ('existing','Example','example.com','https://example.com','https://example.com','',0,'unchecked',0,'now','now')",
            [],
        ).unwrap();
        connection.pragma_update(None, "user_version", 1).unwrap();
    }
    let database = Database::open(&path).await.unwrap();
    database.read(|connection| {
        let (username, has_password): (String, bool) = connection.query_row(
            "SELECT username,has_password FROM sites WHERE id='existing'", [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;
        assert_eq!(username, "");
        assert!(!has_password);
        assert_eq!(connection.query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))?, 2);
        Ok(())
    }).await.unwrap();
}

#[tokio::test]
async fn draining_rejects_waiting_and_new_shared_requests() {
    let gate = Arc::new(MaintenanceGate::new());
    let holder = gate.acquire_shared().await.unwrap();
    gate.begin_draining();

    let waiting = {
        let gate = Arc::clone(&gate);
        tokio::spawn(async move { gate.acquire_shared().await })
    };
    assert_eq!(waiting.await.unwrap().unwrap_err().code, AppCommandErrorCode::Maintenance);
    assert_eq!(gate.acquire_shared().await.unwrap_err().code, AppCommandErrorCode::Maintenance);
    drop(holder);
}

#[tokio::test]
async fn exclusive_waits_for_existing_holder_without_deadlock() {
    let gate = Arc::new(MaintenanceGate::new());
    let holder = gate.acquire_shared().await.unwrap();
    gate.begin_draining();

    let exclusive = {
        let gate = Arc::clone(&gate);
        tokio::spawn(async move { gate.enter_exclusive().await })
    };
    tokio::task::yield_now().await;
    assert!(!exclusive.is_finished());
    drop(holder);
    let exclusive_guard = timeout(Duration::from_secs(1), exclusive)
        .await
        .expect("exclusive must not deadlock")
        .unwrap()
        .unwrap();
    gate.reopen(exclusive_guard);
    assert!(gate.acquire_shared().await.is_ok());
}

#[tokio::test]
async fn migration_is_idempotent_and_corrupt_file_is_preserved() {
    let directory = tempdir().unwrap();
    let path = directory.path().join("data.sqlite3");
    drop(Database::open(&path).await.unwrap());
    let database = Database::open(&path).await.unwrap();
    assert_eq!(database.generation(), 1);
    drop(database);

    let corrupt_path = directory.path().join("corrupt.sqlite3");
    let bytes = b"not a sqlite database";
    fs::write(&corrupt_path, bytes).unwrap();
    let error = Database::open(&corrupt_path).await.unwrap_err();
    assert_eq!(error.code, AppCommandErrorCode::Database);
    assert_eq!(fs::read(corrupt_path).unwrap(), bytes);
}

#[tokio::test]
async fn reopen_swaps_valid_connection_and_increments_generation() {
    let directory = tempdir().unwrap();
    let current_path = directory.path().join("current.sqlite3");
    let replacement_path = directory.path().join("replacement.sqlite3");
    let database = Database::open(&current_path).await.unwrap();
    database
        .write(|connection| {
            connection.execute(
                "INSERT INTO app_settings (key, value, updated_at) VALUES ('source', 'current', 'now')",
                [],
            )?;
            Ok(())
        })
        .await
        .unwrap();

    let replacement = Database::open(&replacement_path).await.unwrap();
    replacement
        .write(|connection| {
            connection.execute(
                "INSERT INTO app_settings (key, value, updated_at) VALUES ('source', 'replacement', 'now')",
                [],
            )?;
            Ok(())
        })
        .await
        .unwrap();
    drop(replacement);

    assert_eq!(database.generation(), 1);
    database.reopen(&replacement_path).await.unwrap();
    assert_eq!(database.generation(), 2);
    let source = database
        .read(|connection| {
            connection.query_row(
                "SELECT value FROM app_settings WHERE key = 'source'",
                [],
                |row| row.get::<_, String>(0),
            )
        })
        .await
        .unwrap();
    assert_eq!(source, "replacement");
}

#[tokio::test]
async fn reopen_rejects_invalid_connection_without_swapping_or_incrementing() {
    let directory = tempdir().unwrap();
    let current_path = directory.path().join("current.sqlite3");
    let invalid_path = directory.path().join("invalid.sqlite3");
    let database = Database::open(&current_path).await.unwrap();
    database
        .write(|connection| {
            connection.execute(
                "INSERT INTO app_settings (key, value, updated_at) VALUES ('source', 'current', 'now')",
                [],
            )?;
            Ok(())
        })
        .await
        .unwrap();
    fs::write(&invalid_path, b"not a sqlite database").unwrap();

    let error = database.reopen(&invalid_path).await.unwrap_err();
    assert_eq!(error.code, AppCommandErrorCode::Database);
    assert_eq!(database.generation(), 1);
    let source = database
        .read(|connection| {
            connection.query_row(
                "SELECT value FROM app_settings WHERE key = 'source'",
                [],
                |row| row.get::<_, String>(0),
            )
        })
        .await
        .unwrap();
    assert_eq!(source, "current");
}
