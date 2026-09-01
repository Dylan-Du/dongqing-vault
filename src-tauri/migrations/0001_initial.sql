CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL,
    sort_index INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    name_key TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL,
    sort_index INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    url TEXT NOT NULL,
    normalized_url TEXT NOT NULL,
    notes TEXT NOT NULL,
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    is_pinned INTEGER NOT NULL DEFAULT 0 CHECK(is_pinned IN (0, 1)),
    auto_status TEXT NOT NULL DEFAULT 'unchecked' CHECK(auto_status IN ('unchecked', 'available', 'unavailable')),
    manual_status TEXT CHECK(manual_status IS NULL OR manual_status IN ('available', 'unavailable')),
    failure_streak INTEGER NOT NULL DEFAULT 0 CHECK(failure_streak BETWEEN 0 AND 2),
    last_checked_at TEXT,
    last_success_at TEXT,
    last_check_source TEXT CHECK(last_check_source IS NULL OR last_check_source IN ('scheduled', 'manual')),
    last_http_status INTEGER,
    last_response_ms INTEGER,
    last_check_error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    url_revision INTEGER NOT NULL DEFAULT 1 CHECK(url_revision >= 1),
    row_revision INTEGER NOT NULL DEFAULT 1 CHECK(row_revision >= 1)
);

CREATE TABLE IF NOT EXISTS site_tags (
    site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (site_id, tag_id)
);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduler_state (
    singleton INTEGER PRIMARY KEY NOT NULL DEFAULT 1 CHECK(singleton = 1),
    is_enabled INTEGER NOT NULL DEFAULT 0 CHECK(is_enabled IN (0, 1)),
    last_started_at TEXT,
    last_finished_at TEXT,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sites_normalized_url ON sites(normalized_url);
CREATE INDEX IF NOT EXISTS idx_sites_category_id ON sites(category_id);
CREATE INDEX IF NOT EXISTS idx_sites_is_pinned ON sites(is_pinned);
CREATE INDEX IF NOT EXISTS idx_sites_auto_status ON sites(auto_status);
CREATE INDEX IF NOT EXISTS idx_sites_manual_status ON sites(manual_status);
CREATE INDEX IF NOT EXISTS idx_sites_created_at ON sites(created_at);
CREATE INDEX IF NOT EXISTS idx_sites_updated_at ON sites(updated_at);
CREATE INDEX IF NOT EXISTS idx_site_tags_site_tag ON site_tags(site_id, tag_id);
CREATE INDEX IF NOT EXISTS idx_site_tags_tag_site ON site_tags(tag_id, site_id);
