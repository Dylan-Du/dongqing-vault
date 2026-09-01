pub mod gate;
pub mod catalog;
mod sites;
mod query;

use std::{
    fs,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
};

use parking_lot::Mutex;
use rusqlite::{Connection, Error as SqliteError, ErrorCode};

use crate::error::{AppCommandError, AppCommandErrorCode};

pub use gate::MaintenanceGate;
pub use catalog::CatalogRepository;

#[derive(Clone)]
pub struct Database {
    connection: Arc<Mutex<Connection>>,
    gate: Arc<MaintenanceGate>,
    generation: Arc<AtomicU64>,
}

impl std::fmt::Debug for Database {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter
            .debug_struct("Database")
            .field("generation", &self.generation())
            .finish_non_exhaustive()
    }
}

impl Database {
    pub async fn open(path: impl AsRef<Path>) -> Result<Self, AppCommandError> {
        let path = path.as_ref().to_path_buf();
        let connection = tokio::task::spawn_blocking(move || open_connection(&path))
            .await
            .map_err(join_error)??;
        Ok(Self {
            connection: Arc::new(Mutex::new(connection)),
            gate: Arc::new(MaintenanceGate::new()),
            generation: Arc::new(AtomicU64::new(1)),
        })
    }

    pub async fn read<T, F>(&self, operation: F) -> Result<T, AppCommandError>
    where
        T: Send + 'static,
        F: FnOnce(&Connection) -> rusqlite::Result<T> + Send + 'static,
    {
        let permit = self.gate.acquire_shared().await?;
        let connection = Arc::clone(&self.connection);
        tokio::task::spawn_blocking(move || {
            let _permit = permit;
            let connection = connection.lock();
            operation(&connection).map_err(map_sqlite_error)
        })
        .await
        .map_err(join_error)?
    }

    pub async fn write<T, F>(&self, operation: F) -> Result<T, AppCommandError>
    where
        T: Send + 'static,
        F: FnOnce(&mut Connection) -> rusqlite::Result<T> + Send + 'static,
    {
        let permit = self.gate.acquire_shared().await?;
        let connection = Arc::clone(&self.connection);
        tokio::task::spawn_blocking(move || {
            let _permit = permit;
            let mut connection = connection.lock();
            operation(&mut connection).map_err(map_sqlite_error)
        })
        .await
        .map_err(join_error)?
    }

    pub fn generation(&self) -> u64 {
        self.generation.load(Ordering::Acquire)
    }

    /// Replaces the live connection while the maintenance gate is exclusive.
    /// The new connection is fully opened and migrated before the old handle is
    /// swapped, so readers never observe a partially initialized database.
    pub async fn reopen(&self, path: impl AsRef<Path>) -> Result<(), AppCommandError> {
        self.gate.begin_draining();
        let permit = self.gate.enter_exclusive().await?;
        let path = path.as_ref().to_path_buf();
        let opened = tokio::task::spawn_blocking(move || open_connection(&path))
            .await
            .map_err(join_error)?;

        match opened {
            Ok(connection) => {
                *self.connection.lock() = connection;
                self.generation.fetch_add(1, Ordering::AcqRel);
                self.gate.reopen(permit);
                Ok(())
            }
            Err(error) => {
                self.gate.reopen(permit);
                Err(error)
            }
        }
    }

    pub fn gate(&self) -> Arc<MaintenanceGate> {
        Arc::clone(&self.gate)
    }
}

fn open_connection(path: &PathBuf) -> Result<Connection, AppCommandError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            AppCommandError::with_details(
                AppCommandErrorCode::Io,
                "Failed to create the application data directory.",
                error.to_string(),
            )
        })?;
    }
    let mut connection = Connection::open(path).map_err(map_sqlite_error)?;
    connection
        .execute_batch(
            "PRAGMA foreign_keys = ON;\nPRAGMA journal_mode = WAL;\nPRAGMA synchronous = NORMAL;\nPRAGMA busy_timeout = 5000;",
        )
        .map_err(map_sqlite_error)?;
    let version = connection
        .query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
        .map_err(map_sqlite_error)?;
    if version == 0 {
        let transaction = connection.transaction().map_err(map_sqlite_error)?;
        transaction
            .execute_batch(include_str!("../../migrations/0001_initial.sql"))
            .map_err(map_sqlite_error)?;
        transaction
            .pragma_update(None, "user_version", 1)
            .map_err(map_sqlite_error)?;
        transaction.commit().map_err(map_sqlite_error)?;
    } else if version != 1 {
        return Err(AppCommandError::new(
            AppCommandErrorCode::Database,
            format!("Unsupported database schema version {version}."),
        ));
    }
    Ok(connection)
}

pub(crate) fn map_sqlite_error(error: SqliteError) -> AppCommandError {
    let code = match &error {
        SqliteError::SqliteFailure(native, _) => match native.code {
            ErrorCode::DatabaseBusy | ErrorCode::DatabaseLocked => AppCommandErrorCode::Busy,
            ErrorCode::ConstraintViolation => AppCommandErrorCode::Conflict,
            ErrorCode::SystemIoFailure => AppCommandErrorCode::Io,
            _ => AppCommandErrorCode::Database,
        },
        _ => AppCommandErrorCode::Database,
    };
    AppCommandError::with_details(code, "Database operation failed.", error.to_string())
}

fn join_error(error: tokio::task::JoinError) -> AppCommandError {
    AppCommandError::with_details(
        AppCommandErrorCode::Internal,
        "A database worker stopped unexpectedly.",
        error.to_string(),
    )
}

#[cfg(test)]
mod tests;
#[cfg(test)]
mod catalog_tests;
#[cfg(test)]
mod query_tests;
#[cfg(test)]
mod reopen_tests;
