use std::sync::{
    atomic::{AtomicU8, Ordering},
    Arc,
};

use tokio::sync::{OwnedRwLockReadGuard, OwnedRwLockWriteGuard, RwLock};

use crate::error::{AppCommandError, AppCommandErrorCode};

const OPEN: u8 = 0;
const DRAINING: u8 = 1;
const EXCLUSIVE: u8 = 2;

#[derive(Debug)]
pub struct SharedPermit {
    _guard: OwnedRwLockReadGuard<()>,
}

#[derive(Debug)]
pub struct ExclusivePermit {
    _guard: OwnedRwLockWriteGuard<()>,
}

#[derive(Debug)]
pub struct MaintenanceGate {
    state: AtomicU8,
    lock: Arc<RwLock<()>>,
}

impl Default for MaintenanceGate {
    fn default() -> Self {
        Self::new()
    }
}

impl MaintenanceGate {
    pub fn new() -> Self {
        Self {
            state: AtomicU8::new(OPEN),
            lock: Arc::new(RwLock::new(())),
        }
    }

    pub async fn acquire_shared(&self) -> Result<SharedPermit, AppCommandError> {
        if self.state.load(Ordering::Acquire) != OPEN {
            return Err(maintenance_error());
        }
        let guard = Arc::clone(&self.lock)
            .try_read_owned()
            .map_err(|_| maintenance_error())?;
        if self.state.load(Ordering::Acquire) != OPEN {
            drop(guard);
            return Err(maintenance_error());
        }
        Ok(SharedPermit { _guard: guard })
    }

    pub fn begin_draining(&self) {
        let _ = self
            .state
            .compare_exchange(OPEN, DRAINING, Ordering::AcqRel, Ordering::Acquire);
    }

    pub async fn enter_exclusive(&self) -> Result<ExclusivePermit, AppCommandError> {
        if self.state.load(Ordering::Acquire) != DRAINING {
            return Err(maintenance_error());
        }
        let guard = Arc::clone(&self.lock).write_owned().await;
        self.state.store(EXCLUSIVE, Ordering::Release);
        Ok(ExclusivePermit { _guard: guard })
    }

    pub fn reopen(&self, permit: ExclusivePermit) {
        self.state.store(OPEN, Ordering::Release);
        drop(permit);
    }
}

fn maintenance_error() -> AppCommandError {
    AppCommandError::new(
        AppCommandErrorCode::Maintenance,
        "The catalog is temporarily unavailable for maintenance.",
    )
}
