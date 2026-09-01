use chrono::{SecondsFormat, Utc};
use rusqlite::{params, OptionalExtension, Row};
use unicode_normalization::UnicodeNormalization;
use uuid::Uuid;

use crate::{
    error::{AppCommandError, AppCommandErrorCode},
    model::{Category, CategoryListItem, Tag, TaxonomySnapshot},
};

use super::Database;

#[derive(Clone, Debug)]
pub struct CatalogRepository {
    database: Database,
}

impl CatalogRepository {
    pub fn new(database: Database) -> Self {
        Self { database }
    }

    pub fn database(&self) -> &Database {
        &self.database
    }

    pub async fn list_taxonomy(&self) -> Result<TaxonomySnapshot, AppCommandError> {
        self.database
            .read(|connection| {
                let mut categories_statement = connection.prepare(
                    "SELECT c.id,c.name,c.name_key,c.color,c.sort_index,c.created_at,c.updated_at,COUNT(s.id) AS site_count FROM categories c LEFT JOIN sites s ON s.category_id=c.id GROUP BY c.id,c.name,c.name_key,c.color,c.sort_index,c.created_at,c.updated_at ORDER BY c.sort_index ASC,c.id ASC",
                )?;
                let categories = categories_statement
                    .query_map([], category_list_item_from_row)?
                    .collect::<Result<Vec<_>, _>>()?;
                let mut tags_statement = connection.prepare(
                    "SELECT t.id,t.name,t.name_key,t.color,t.sort_index,t.created_at,t.updated_at,COUNT(st.site_id) AS site_count FROM tags t LEFT JOIN site_tags st ON st.tag_id=t.id GROUP BY t.id,t.name,t.name_key,t.color,t.sort_index,t.created_at,t.updated_at ORDER BY t.sort_index ASC,t.id ASC",
                )?;
                let tags = tags_statement
                    .query_map([], category_list_item_from_row)?
                    .collect::<Result<Vec<_>, _>>()?;
                Ok(TaxonomySnapshot { categories, tags })
            })
            .await
    }

    pub async fn create_category(
        &self,
        name: &str,
        color: &str,
    ) -> Result<Category, AppCommandError> {
        self.create_taxonomy("categories", name, color).await
    }

    pub async fn create_tag(&self, name: &str, color: &str) -> Result<Tag, AppCommandError> {
        self.create_taxonomy("tags", name, color).await
    }

    async fn create_taxonomy(
        &self,
        table: &'static str,
        name: &str,
        color: &str,
    ) -> Result<Category, AppCommandError> {
        let display_name = normalize_display_name(name)?;
        let key = taxonomy_name_key(name)?;
        let color = normalize_color(color)?;
        let id = Uuid::new_v4().to_string();
        let timestamp = now();
        let sql = format!(
            "INSERT INTO {table} (id,name,name_key,color,sort_index,created_at,updated_at) VALUES (?1,?2,?3,?4,(SELECT COALESCE(MAX(sort_index)+1,0) FROM {table}),?5,?5)"
        );
        let item = Category {
            id,
            name: display_name,
            name_key: key,
            color,
            sort_index: 0,
            created_at: timestamp,
            updated_at: String::new(),
        };
        self.database
            .write(move |connection| {
                let transaction = connection.transaction()?;
                transaction.execute(
                    &sql,
                    params![item.id, item.name, item.name_key, item.color, item.created_at],
                )?;
                let row = transaction.query_row(
                    &format!("SELECT id,name,name_key,color,sort_index,created_at,updated_at FROM {table} WHERE id=?1"),
                    [&item.id],
                    category_from_row,
                )?;
                transaction.commit()?;
                Ok(row)
            })
            .await
    }

    pub async fn update_category(
        &self,
        id: &str,
        name: &str,
        color: &str,
    ) -> Result<Category, AppCommandError> {
        self.update_taxonomy("categories", id, name, color).await
    }

    pub async fn update_tag(
        &self,
        id: &str,
        name: &str,
        color: &str,
    ) -> Result<Tag, AppCommandError> {
        self.update_taxonomy("tags", id, name, color).await
    }

    async fn update_taxonomy(
        &self,
        table: &'static str,
        id: &str,
        name: &str,
        color: &str,
    ) -> Result<Category, AppCommandError> {
        let id = id.to_owned();
        let name = normalize_display_name(name)?;
        let key = taxonomy_name_key(&name)?;
        let color = normalize_color(color)?;
        let timestamp = now();
        let result = self
            .database
            .write(move |connection| {
                let transaction = connection.transaction()?;
                let changed = transaction.execute(
                    &format!("UPDATE {table} SET name=?1,name_key=?2,color=?3,updated_at=?4 WHERE id=?5"),
                    params![name, key, color, timestamp, id],
                )?;
                let row = if changed == 0 {
                    None
                } else {
                    transaction
                        .query_row(
                            &format!("SELECT id,name,name_key,color,sort_index,created_at,updated_at FROM {table} WHERE id=?1"),
                            [&id],
                            category_from_row,
                        )
                        .optional()?
                };
                transaction.commit()?;
                Ok(row)
            })
            .await?;
        result.ok_or_else(|| not_found(table))
    }

    pub async fn delete_category(&self, id: &str) -> Result<u32, AppCommandError> {
        self.delete_taxonomy("categories", id, "category_id").await
    }

    pub async fn delete_tag(&self, id: &str) -> Result<u32, AppCommandError> {
        self.delete_taxonomy("tags", id, "tag_id").await
    }

    async fn delete_taxonomy(
        &self,
        table: &'static str,
        id: &str,
        relation_column: &'static str,
    ) -> Result<u32, AppCommandError> {
        let id = id.to_owned();
        let result = self
            .database
            .write(move |connection| {
                let transaction = connection.transaction()?;
                let exists: bool = transaction.query_row(
                    &format!("SELECT EXISTS(SELECT 1 FROM {table} WHERE id=?1)"),
                    [&id],
                    |row| row.get(0),
                )?;
                if !exists {
                    transaction.commit()?;
                    return Ok(None);
                }
                let count_sql = if table == "categories" {
                    format!("SELECT COUNT(*) FROM sites WHERE {relation_column}=?1")
                } else {
                    format!("SELECT COUNT(*) FROM site_tags WHERE {relation_column}=?1")
                };
                let affected = transaction.query_row(&count_sql, [&id], |row| row.get::<_, u32>(0))?;
                transaction.execute(&format!("DELETE FROM {table} WHERE id=?1"), [&id])?;
                transaction.commit()?;
                Ok(Some(affected))
            })
            .await?;
        result.ok_or_else(|| not_found(table))
    }
}

pub fn taxonomy_name_key(name: &str) -> Result<String, AppCommandError> {
    let normalized = name.trim().nfkc().collect::<String>().to_lowercase();
    if normalized.is_empty() {
        return Err(AppCommandError::new(
            AppCommandErrorCode::Validation,
            "Taxonomy name cannot be empty.",
        ));
    }
    Ok(normalized)
}

fn normalize_display_name(name: &str) -> Result<String, AppCommandError> {
    let display = name.trim().nfkc().collect::<String>();
    if display.is_empty() {
        return Err(AppCommandError::new(
            AppCommandErrorCode::Validation,
            "Taxonomy name cannot be empty.",
        ));
    }
    Ok(display)
}

fn normalize_color(color: &str) -> Result<String, AppCommandError> {
    let valid = color.len() == 7
        && color.starts_with('#')
        && color.as_bytes()[1..].iter().all(u8::is_ascii_hexdigit);
    if !valid {
        return Err(AppCommandError::new(
            AppCommandErrorCode::Validation,
            "Color must be a six-digit hexadecimal value.",
        ));
    }
    Ok(color.to_ascii_uppercase())
}

fn category_from_row(row: &Row<'_>) -> rusqlite::Result<Category> {
    Ok(Category {
        id: row.get(0)?,
        name: row.get(1)?,
        name_key: row.get(2)?,
        color: row.get(3)?,
        sort_index: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

fn category_list_item_from_row(row: &Row<'_>) -> rusqlite::Result<CategoryListItem> {
    let category = category_from_row(row)?;
    Ok(CategoryListItem {
        id: category.id,
        name: category.name,
        name_key: category.name_key,
        color: category.color,
        sort_index: category.sort_index,
        created_at: category.created_at,
        updated_at: category.updated_at,
        site_count: row.get(7)?,
    })
}

fn now() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn not_found(table: &str) -> AppCommandError {
    AppCommandError::new(
        AppCommandErrorCode::NotFound,
        format!("The requested {} does not exist.", table.trim_end_matches('s')),
    )
}
