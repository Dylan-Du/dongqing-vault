use chrono::{SecondsFormat, Utc};
use rusqlite::{params, Connection, OptionalExtension, Row, Transaction};
use uuid::Uuid;

use crate::{
    error::{AppCommandError, AppCommandErrorCode},
    model::{AutoStatus, CreateSiteInput, DeletedSiteSnapshot, LastCheckSource, ManualStatus, Site, UpdateSiteInput},
    url_normalizer::normalize_url,
};

use super::catalog::CatalogRepository;

enum Mutation<T> { Value(T), NotFound, Conflict, InvalidReference }

impl CatalogRepository {
    pub async fn create_site(&self, input: CreateSiteInput) -> Result<Site, AppCommandError> {
        let normalized = normalize_url(&input.url).map_err(map_url_error)?;
        let name = defaulted(input.name, &normalized.hostname);
        let domain = defaulted(input.domain, &normalized.hostname);
        let mut site = Site {
            id: Uuid::new_v4().to_string(), name, domain, url: normalized.url,
            normalized_url: normalized.normalized, notes: input.notes, category_id: input.category_id,
            tag_ids: deduplicate(input.tag_ids), is_pinned: input.is_pinned, auto_status: AutoStatus::Unchecked,
            manual_status: input.manual_status, failure_streak: 0, last_checked_at: None,
            last_success_at: None, last_check_source: None, last_http_status: None,
            last_response_ms: None, last_check_error: None, created_at: now(), updated_at: String::new(),
            url_revision: 1, row_revision: 1,
        };
        site.updated_at = site.created_at.clone();
        let outcome = self.database().write(move |connection| {
            let transaction = connection.transaction()?;
            if !references_exist(&transaction, site.category_id.as_deref(), &site.tag_ids)? {
                transaction.commit()?;
                return Ok(Mutation::InvalidReference);
            }
            insert_site(&transaction, &site)?;
            insert_site_tags(&transaction, &site.id, &site.tag_ids)?;
            transaction.commit()?;
            Ok(Mutation::Value(site))
        }).await?;
        mutation_result(outcome)
    }

    pub async fn get_site(&self, id: &str) -> Result<Site, AppCommandError> {
        let id = id.to_owned();
        let site = self.database().read(move |connection| load_site(connection, &id)).await?;
        site.ok_or_else(|| AppCommandError::new(AppCommandErrorCode::NotFound, "Site was not found."))
    }

    pub async fn update_site(&self, input: UpdateSiteInput) -> Result<Site, AppCommandError> {
        let normalized = normalize_url(&input.url).map_err(map_url_error)?;
        let outcome = self.database().write(move |connection| {
            let transaction = connection.transaction()?;
            let Some(mut current) = load_site(&transaction, &input.id)? else {
                transaction.commit()?;
                return Ok(Mutation::NotFound);
            };
            if current.row_revision != input.expected_row_revision {
                transaction.commit()?;
                return Ok(Mutation::Conflict);
            }
            let tag_ids = deduplicate(input.tag_ids);
            if !references_exist(&transaction, input.category_id.as_deref(), &tag_ids)? {
                transaction.commit()?;
                return Ok(Mutation::InvalidReference);
            }
            let changed_url = current.normalized_url != normalized.normalized;
            current.name = defaulted(input.name, &normalized.hostname);
            current.domain = defaulted(input.domain, &normalized.hostname);
            current.url = normalized.url;
            current.normalized_url = normalized.normalized;
            current.notes = input.notes;
            current.category_id = input.category_id;
            current.tag_ids = tag_ids;
            current.is_pinned = input.is_pinned;
            current.manual_status = input.manual_status;
            current.updated_at = now();
            current.row_revision += 1;
            if changed_url {
                current.url_revision += 1;
                current.auto_status = AutoStatus::Unchecked;
                current.manual_status = None;
                current.failure_streak = 0;
                current.last_checked_at = None;
                current.last_success_at = None;
                current.last_check_source = None;
                current.last_http_status = None;
                current.last_response_ms = None;
                current.last_check_error = None;
            }
            let changed = update_site_row(&transaction, &current, input.expected_row_revision)?;
            if changed == 0 {
                transaction.rollback()?;
                return Ok(Mutation::Conflict);
            }
            transaction.execute("DELETE FROM site_tags WHERE site_id=?1", [&current.id])?;
            insert_site_tags(&transaction, &current.id, &current.tag_ids)?;
            transaction.commit()?;
            Ok(Mutation::Value(current))
        }).await?;
        mutation_result(outcome)
    }

    pub async fn delete_sites(&self, ids: Vec<String>) -> Result<Vec<DeletedSiteSnapshot>, AppCommandError> {
        self.database().write(move |connection| {
            let transaction = connection.transaction()?;
            let mut snapshots = Vec::new();
            for id in &ids {
                if let Some(site) = load_site(&transaction, id)? {
                    snapshots.push(DeletedSiteSnapshot { site });
                }
            }
            for id in &ids {
                transaction.execute("DELETE FROM sites WHERE id=?1", [id])?;
            }
            transaction.commit()?;
            Ok(snapshots)
        }).await
    }

    pub async fn restore_sites(&self, snapshots: Vec<DeletedSiteSnapshot>) -> Result<(), AppCommandError> {
        let outcome = self.database().write(move |connection| {
            let transaction = connection.transaction()?;
            for snapshot in &snapshots {
                if load_site(&transaction, &snapshot.site.id)?.is_some() {
                    transaction.rollback()?;
                    return Ok(Mutation::Conflict);
                }
                if !references_exist(&transaction, snapshot.site.category_id.as_deref(), &snapshot.site.tag_ids)? {
                    transaction.rollback()?;
                    return Ok(Mutation::InvalidReference);
                }
            }
            for snapshot in &snapshots {
                insert_site(&transaction, &snapshot.site)?;
                insert_site_tags(&transaction, &snapshot.site.id, &snapshot.site.tag_ids)?;
            }
            transaction.commit()?;
            Ok(Mutation::Value(()))
        }).await?;
        mutation_result(outcome)
    }
}

fn mutation_result<T>(outcome: Mutation<T>) -> Result<T, AppCommandError> {
    match outcome {
        Mutation::Value(value) => Ok(value),
        Mutation::NotFound => Err(AppCommandError::new(AppCommandErrorCode::NotFound, "Site was not found.")),
        Mutation::Conflict => Err(AppCommandError::new(AppCommandErrorCode::Conflict, "The site changed before this operation could be applied.")),
        Mutation::InvalidReference => Err(AppCommandError::new(AppCommandErrorCode::Validation, "A category or tag reference does not exist.")),
    }
}

fn map_url_error(error: crate::url_normalizer::AppError) -> AppCommandError {
    let code = match error.code {
        crate::url_normalizer::AppErrorCode::UnsafeUrl | crate::url_normalizer::AppErrorCode::CredentialsNotAllowed => AppCommandErrorCode::UnsafeUrl,
        _ => AppCommandErrorCode::Validation,
    };
    AppCommandError::new(code, error.message)
}

fn references_exist(transaction: &Transaction<'_>, category_id: Option<&str>, tag_ids: &[String]) -> rusqlite::Result<bool> {
    if let Some(category_id) = category_id {
        let exists: bool = transaction.query_row("SELECT EXISTS(SELECT 1 FROM categories WHERE id=?1)", [category_id], |row| row.get(0))?;
        if !exists { return Ok(false); }
    }
    for tag_id in tag_ids {
        let exists: bool = transaction.query_row("SELECT EXISTS(SELECT 1 FROM tags WHERE id=?1)", [tag_id], |row| row.get(0))?;
        if !exists { return Ok(false); }
    }
    Ok(true)
}

fn insert_site(transaction: &Transaction<'_>, site: &Site) -> rusqlite::Result<()> {
    transaction.execute(
        "INSERT INTO sites (id,name,domain,url,normalized_url,notes,category_id,is_pinned,auto_status,manual_status,failure_streak,last_checked_at,last_success_at,last_check_source,last_http_status,last_response_ms,last_check_error,created_at,updated_at,url_revision,row_revision) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21)",
        params![site.id,site.name,site.domain,site.url,site.normalized_url,site.notes,site.category_id,site.is_pinned,status(&site.auto_status),manual_status(&site.manual_status),site.failure_streak,site.last_checked_at,site.last_success_at,source(&site.last_check_source),site.last_http_status,site.last_response_ms,site.last_check_error,site.created_at,site.updated_at,site.url_revision,site.row_revision],
    )?;
    Ok(())
}

fn update_site_row(transaction: &Transaction<'_>, site: &Site, expected_revision: u32) -> rusqlite::Result<usize> {
    transaction.execute(
        "UPDATE sites SET name=?1,domain=?2,url=?3,normalized_url=?4,notes=?5,category_id=?6,is_pinned=?7,auto_status=?8,manual_status=?9,failure_streak=?10,last_checked_at=?11,last_success_at=?12,last_check_source=?13,last_http_status=?14,last_response_ms=?15,last_check_error=?16,updated_at=?17,url_revision=?18,row_revision=?19 WHERE id=?20 AND row_revision=?21",
        params![site.name,site.domain,site.url,site.normalized_url,site.notes,site.category_id,site.is_pinned,status(&site.auto_status),manual_status(&site.manual_status),site.failure_streak,site.last_checked_at,site.last_success_at,source(&site.last_check_source),site.last_http_status,site.last_response_ms,site.last_check_error,site.updated_at,site.url_revision,site.row_revision,site.id,expected_revision],
    )
}

fn insert_site_tags(transaction: &Transaction<'_>, site_id: &str, tag_ids: &[String]) -> rusqlite::Result<()> {
    for tag_id in tag_ids { transaction.execute("INSERT INTO site_tags (site_id,tag_id) VALUES (?1,?2)", params![site_id, tag_id])?; }
    Ok(())
}

pub(crate) fn load_site(connection: &Connection, id: &str) -> rusqlite::Result<Option<Site>> {
    let mut site = connection.query_row(
        "SELECT id,name,domain,url,normalized_url,notes,category_id,is_pinned,auto_status,manual_status,failure_streak,last_checked_at,last_success_at,last_check_source,last_http_status,last_response_ms,last_check_error,created_at,updated_at,url_revision,row_revision FROM sites WHERE id=?1",
        [id], site_from_row,
    ).optional()?;
    if let Some(site) = site.as_mut() {
        let mut statement = connection.prepare("SELECT tag_id FROM site_tags WHERE site_id=?1 ORDER BY tag_id ASC")?;
        site.tag_ids = statement.query_map([id], |row| row.get(0))?.collect::<Result<Vec<_>, _>>()?;
    }
    Ok(site)
}

pub(crate) fn site_from_row(row: &Row<'_>) -> rusqlite::Result<Site> {
    Ok(Site {
        id: row.get(0)?, name: row.get(1)?, domain: row.get(2)?, url: row.get(3)?, normalized_url: row.get(4)?,
        notes: row.get(5)?, category_id: row.get(6)?, tag_ids: Vec::new(), is_pinned: row.get(7)?,
        auto_status: parse_auto(row.get::<_, String>(8)?), manual_status: row.get::<_, Option<String>>(9)?.map(parse_manual),
        failure_streak: row.get(10)?, last_checked_at: row.get(11)?, last_success_at: row.get(12)?,
        last_check_source: row.get::<_, Option<String>>(13)?.map(parse_source), last_http_status: row.get(14)?,
        last_response_ms: row.get(15)?, last_check_error: row.get(16)?, created_at: row.get(17)?, updated_at: row.get(18)?,
        url_revision: row.get(19)?, row_revision: row.get(20)?,
    })
}

pub(crate) fn status(value: &AutoStatus) -> &'static str { match value { AutoStatus::Unchecked => "unchecked", AutoStatus::Available => "available", AutoStatus::Unavailable => "unavailable" } }
fn manual_status(value: &Option<ManualStatus>) -> Option<&'static str> { value.as_ref().map(|value| match value { ManualStatus::Available => "available", ManualStatus::Unavailable => "unavailable" }) }
fn source(value: &Option<LastCheckSource>) -> Option<&'static str> { value.as_ref().map(|value| match value { LastCheckSource::Scheduled => "scheduled", LastCheckSource::Manual => "manual" }) }
fn parse_auto(value: String) -> AutoStatus { match value.as_str() { "available" => AutoStatus::Available, "unavailable" => AutoStatus::Unavailable, _ => AutoStatus::Unchecked } }
fn parse_manual(value: String) -> ManualStatus { if value == "available" { ManualStatus::Available } else { ManualStatus::Unavailable } }
fn parse_source(value: String) -> LastCheckSource { if value == "scheduled" { LastCheckSource::Scheduled } else { LastCheckSource::Manual } }
fn defaulted(value: String, fallback: &str) -> String { let trimmed = value.trim(); if trimmed.is_empty() { fallback.to_owned() } else { trimmed.to_owned() } }
fn deduplicate(values: Vec<String>) -> Vec<String> { let mut result = Vec::new(); for value in values { if !result.contains(&value) { result.push(value); } } result }
fn now() -> String { Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true) }
