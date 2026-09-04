use rusqlite::{params_from_iter, types::Value};
use std::collections::HashSet;

use crate::{
    error::AppCommandError,
    model::{AutoStatus, SitePage, SiteQuery, SiteSortBy, SiteSummary, SortDirection},
};

use super::{catalog::CatalogRepository, sites::load_site};

impl CatalogRepository {
    pub async fn list_sites(&self, mut query: SiteQuery) -> Result<SitePage, AppCommandError> {
        query.keyword = query.keyword.trim().to_owned();
        query.limit = query.limit.clamp(1, 200);
        let mut seen_tags = HashSet::new();
        query.tag_ids.retain(|tag_id| seen_tags.insert(tag_id.clone()));
        self.database().read(move |connection| {
            let (conditions, values) = build_conditions(&query);
            let total = connection.query_row(
                &format!("SELECT COUNT(*) FROM sites s WHERE {conditions}"),
                params_from_iter(values.clone()),
                |row| row.get::<_, u32>(0),
            )?;
            let summary = connection.query_row(
                &format!("SELECT COUNT(*),COALESCE(SUM(CASE WHEN COALESCE(s.manual_status,s.auto_status)='available' THEN 1 ELSE 0 END),0),COALESCE(SUM(CASE WHEN s.manual_status IS NULL AND (s.auto_status!='available' OR s.failure_streak>0) THEN 1 ELSE 0 END),0) FROM sites s WHERE {conditions}"),
                params_from_iter(values.clone()),
                |row| Ok(SiteSummary { total: row.get(0)?, available: row.get(1)?, needs_attention: row.get(2)? }),
            )?;
            let order = order_clause(&query.sort_by, &query.sort_direction);
            let mut page_values = values;
            page_values.push(Value::Integer(i64::from(query.limit)));
            page_values.push(Value::Integer(i64::from(query.offset)));
            let sql = format!("SELECT s.id FROM sites s WHERE {conditions} ORDER BY s.is_pinned DESC,{order},s.id ASC LIMIT ? OFFSET ?");
            let mut statement = connection.prepare(&sql)?;
            let ids = statement.query_map(params_from_iter(page_values), |row| row.get::<_, String>(0))?.collect::<Result<Vec<_>, _>>()?;
            drop(statement);
            let mut items = Vec::with_capacity(ids.len());
            for id in ids {
                if let Some(site) = load_site(connection, &id)? { items.push(site); }
            }
            Ok(SitePage { items, total, summary })
        }).await
    }
}

fn build_conditions(query: &SiteQuery) -> (String, Vec<Value>) {
    let mut conditions = vec!["1=1".to_owned()];
    let mut values = Vec::new();
    if !query.keyword.is_empty() {
        let keyword = format!("%{}%", escape_like(&query.keyword));
        conditions.push("(s.name LIKE ? ESCAPE '\\' OR s.domain LIKE ? ESCAPE '\\' OR s.url LIKE ? ESCAPE '\\' OR s.normalized_url LIKE ? ESCAPE '\\' OR s.notes LIKE ? ESCAPE '\\' OR EXISTS (SELECT 1 FROM site_tags search_st JOIN tags search_t ON search_t.id=search_st.tag_id WHERE search_st.site_id=s.id AND (search_t.name LIKE ? ESCAPE '\\' OR search_t.name_key LIKE ? ESCAPE '\\')))".to_owned());
        for _ in 0..7 { values.push(Value::Text(keyword.clone())); }
    }
    if let Some(category_id) = &query.category_id {
        conditions.push("s.category_id=?".to_owned());
        values.push(Value::Text(category_id.clone()));
    }
    if let Some(status) = &query.status {
        conditions.push("COALESCE(s.manual_status,s.auto_status)=?".to_owned());
        values.push(Value::Text(status_value(status).to_owned()));
    }
    if !query.tag_ids.is_empty() {
        let placeholders = vec!["?"; query.tag_ids.len()].join(",");
        conditions.push(format!("s.id IN (SELECT site_id FROM site_tags WHERE tag_id IN ({placeholders}) GROUP BY site_id HAVING COUNT(DISTINCT tag_id)=?)"));
        values.extend(query.tag_ids.iter().cloned().map(Value::Text));
        values.push(Value::Integer(query.tag_ids.len() as i64));
    }
    (conditions.join(" AND "), values)
}

fn order_clause(sort_by: &SiteSortBy, direction: &SortDirection) -> &'static str {
    match (sort_by, direction) {
        (SiteSortBy::UpdatedAt, SortDirection::Desc) => "s.updated_at DESC",
        (SiteSortBy::UpdatedAt, SortDirection::Asc) => "s.updated_at ASC",
        (SiteSortBy::Name, SortDirection::Asc) => "s.name COLLATE NOCASE ASC",
        (SiteSortBy::Name, SortDirection::Desc) => "s.name COLLATE NOCASE DESC",
        (SiteSortBy::Domain, SortDirection::Asc) => "s.domain COLLATE NOCASE ASC",
        (SiteSortBy::Domain, SortDirection::Desc) => "s.domain COLLATE NOCASE DESC",
        (SiteSortBy::CreatedAt, SortDirection::Asc) => "s.created_at ASC",
        (SiteSortBy::CreatedAt, SortDirection::Desc) => "s.created_at DESC",
        (SiteSortBy::Status, SortDirection::Asc) => "CASE COALESCE(s.manual_status,s.auto_status) WHEN 'available' THEN 0 WHEN 'unchecked' THEN 1 ELSE 2 END ASC",
        (SiteSortBy::Status, SortDirection::Desc) => "CASE COALESCE(s.manual_status,s.auto_status) WHEN 'available' THEN 0 WHEN 'unchecked' THEN 1 ELSE 2 END DESC",
    }
}

fn escape_like(keyword: &str) -> String {
    keyword.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_")
}

fn status_value(status: &AutoStatus) -> &'static str {
    match status { AutoStatus::Unchecked => "unchecked", AutoStatus::Available => "available", AutoStatus::Unavailable => "unavailable" }
}
