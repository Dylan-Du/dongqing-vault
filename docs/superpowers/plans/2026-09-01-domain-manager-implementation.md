# DOMAIN. Desktop Domain Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready macOS and Windows desktop application for local website/domain collection management, including CRUD, taxonomy, search, batch operations, health checks, tray scheduling, JSON/CSV exchange, backup/restore, and a non-blocking vgpu ambient layer.

**Architecture:** A React/TypeScript SPA runs inside Tauri 2. TypeScript owns view state, pure input/query models, and bridge contracts; Rust owns SQLite, filesystem access, HTTP probing, scheduling, backup/recovery, tray integration, and all trust-boundary validation. All privileged operations cross one typed `NativeBridge`, while browser tests replace it with `MockNativeBridge`.

**Tech Stack:** Tauri 2, Rust stable, React 19, TypeScript, Vite 6+, pnpm, rusqlite, Tokio, reqwest/rustls, Vitest, Testing Library, Playwright, vgpu, plain CSS modules/tokens.

**Spec:** `docs/superpowers/specs/2026-09-01-domain-manager-design.md`

## Global Constraints

- Read the complete spec before Task 1 and re-read the cited section before each task.
- Target macOS and Windows only; never add Linux-only behavior to the acceptance path.
- Use Node.js 22 or newer, Corepack-managed pnpm, Rust stable, Tauri major version 2, and commit both `pnpm-lock.yaml` and `src-tauri/Cargo.lock`.
- Keep all application data local. Add no account, cloud sync, analytics, telemetry, remote favicon fetch, or embedded browser.
- Keep the v1 SQLite database, JSON/CSV files, and `.domain-backup` archives unencrypted; document that users must protect exported files themselves.
- Run scheduled checks only while the application process is alive, including while its main window is hidden in the system tray; install no OS background service or login daemon.
- Accept external URLs only when parsed scheme is exactly `http` or `https`; reject credentials in stored URLs.
- Store timestamps as millisecond UTC RFC 3339 strings and identifiers as UUID strings.
- Use SQLite parameter binding for every user value; never interpolate user data into SQL or filesystem paths.
- Keep vgpu decorative and independently fallible; every core feature must work with WebGPU unavailable.
- Use test-first cycles for every behavior: failing focused test, observed failure, minimal implementation, focused pass, broader regression pass, then commit.
- Do not weaken or delete an existing assertion to make a new implementation pass.
- Keep files focused. Split a file before it exceeds roughly 300 lines unless it is declarative SQL, a schema, or a generated lockfile.
- Use `apply_patch` for hand-authored file edits. Scaffolding, package installation, formatting, and generated lockfiles may use their native commands.
- Do not start the next task while the current task has uncommitted changes or failing required checks.
- Code-signing credentials and store publication are outside scope; unsigned local bundles and CI build artifacts are in scope.

## Fixed File/Module Map

### Root and toolchain

- `package.json` — frontend scripts and locked JavaScript dependency declarations.
- `pnpm-lock.yaml` — exact JavaScript dependency resolution.
- `vite.config.ts` — Vite, React, WGSL handling, and test-safe asset behavior.
- `vitest.config.ts` — jsdom unit/component test configuration.
- `playwright.config.ts` — browser-flow and performance project configuration.
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json` — strict TypeScript boundaries.
- `index.html` — single SPA mount point.
- `schemas/export-v1.schema.json` — exact JSON exchange schema.
- `schemas/backup-manifest-v1.schema.json` — exact backup manifest schema.
- `.github/workflows/ci.yml` — frontend, Rust, macOS bundle, and Windows bundle jobs.

### Frontend

- `src/main.tsx` — React root, query client, and bridge provider.
- `src/app/App.tsx` — top-level route-free desktop shell.
- `src/app/AppProviders.tsx` — bridge, query cache, dialogs, and toast providers.
- `src/app/styles/tokens.css` — color, typography, spacing, radius, and shadow tokens.
- `src/app/styles/global.css` — reset, focus, reduced-motion, and platform-neutral base styles.
- `src/domain/site.ts` — site/status/query value types and pure effective-status helpers.
- `src/domain/taxonomy.ts` — category/tag types and Unicode name-key rules.
- `src/domain/url-normalizer.ts` — browser-side URL normalization and validation.
- `src/domain/import.ts` — typed mapping, conflict decisions, and preview view models.
- `src/infrastructure/bridge/NativeBridge.ts` — complete privileged-operation interface.
- `src/infrastructure/bridge/TauriNativeBridge.ts` — `invoke`/event implementation.
- `src/infrastructure/bridge/MockNativeBridge.ts` — deterministic in-memory browser-test implementation.
- `src/infrastructure/bridge/BridgeContext.tsx` — bridge injection hook/provider.
- `src/features/workspace/Workspace.tsx` — search/filter/list orchestration.
- `src/features/workspace/SiteTable.tsx` — virtualized high-density table.
- `src/features/workspace/FilterBar.tsx` — keyword/status/tag/sort controls.
- `src/features/workspace/Sidebar.tsx` — smart lists, categories, tools, and counts.
- `src/features/sites/SiteEditorDrawer.tsx` — create/edit form and dirty-close protection.
- `src/features/sites/site-form.ts` — Zod schema and form-to-command mapping.
- `src/features/sites/BatchToolbar.tsx` — multi-select operations and confirmations.
- `src/features/taxonomy/TaxonomyDialog.tsx` — category/tag CRUD.
- `src/features/health/HealthProgress.tsx` — run progress, cancellation, and stale-result messaging.
- `src/features/health/StatusOverride.tsx` — manual override controls.
- `src/features/transfer/ImportWizard.tsx` — file, mapping, preview, conflicts, and commit flow.
- `src/features/transfer/ExportDialog.tsx` — all/filtered/selected JSON/CSV export.
- `src/features/backup/BackupRestore.tsx` — manual backup, snapshots, restore, and maintenance state.
- `src/features/settings/SettingsDialog.tsx` — schedule/network/retention/visual preferences.
- `src/visual/AmbientCanvas.tsx` — vgpu lifecycle and CSS fallback boundary.
- `src/visual/ambient.wgsl` — low-contrast noise/gradient shader.
- `src/test/setup.ts` — jest-dom cleanup and browser API stubs.
- `src/test/fixtures.ts` — deterministic sites, taxonomies, and bridge factories.

### Rust/Tauri

- `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` — Rust dependencies and exact resolution.
- `src-tauri/tauri.conf.json` — app identifier, window, bundle, and build settings.
- `src-tauri/capabilities/default.json` — minimal dialog/opener/log permissions.
- `src-tauri/migrations/0001_initial.sql` — complete v1 SQLite schema and indexes.
- `src-tauri/src/lib.rs` — plugin registration, shared state, commands, tray, and run loop.
- `src-tauri/src/error.rs` — stable `AppErrorCode` and serializable command error.
- `src-tauri/src/model.rs` — serde DTOs mirrored by TypeScript contracts.
- `src-tauri/src/db/mod.rs` — connection, pragmas, migration runner, generation, and blocking executor.
- `src-tauri/src/db/gate.rs` — open/draining/exclusive maintenance gate.
- `src-tauri/src/db/catalog.rs` — site/category/tag CRUD and row/url revision CAS.
- `src-tauri/src/db/query.rs` — parameterized search, filters, stable sort, and paging.
- `src-tauri/src/url_normalizer.rs` — canonical URL implementation shared by commands.
- `src-tauri/src/health/state.rs` — pure health transition reducer.
- `src-tauri/src/health/probe.rs` — manual redirects, HEAD/GET fallback, timeout, and retry.
- `src-tauri/src/health/coordinator.rs` — one-run arbitration, cancellation, progress events, and site CAS.
- `src-tauri/src/health/scheduler.rs` — persisted due times, defer/retry, pause, and wake reconciliation.
- `src-tauri/src/transfer/schema.rs` — JSON Schema loading and invariant validation.
- `src-tauri/src/transfer/csv.rs` — streaming CSV parse/export and tag escaping.
- `src-tauri/src/transfer/session.rs` — bounded import sessions, paged preview, immutable staging plans.
- `src-tauri/src/transfer/commit.rs` — duplicate/taxonomy/row CAS and atomic import commit.
- `src-tauri/src/backup/archive.rs` — ZIP manifest, SHA-256, size/path constraints.
- `src-tauri/src/backup/snapshot.rs` — SQLite consistent snapshot and rolling retention.
- `src-tauri/src/backup/restore.rs` — drain/exclusive/generation/rollback recovery flow.
- `src-tauri/src/desktop/tray.rs` — tray creation, menu events, and safe exit.
- `src-tauri/src/desktop/opener.rs` — validated system-browser opening.
- `src-tauri/src/diagnostics.rs` — redacted structured events, rolling-log retention, and diagnostic status.
- `src-tauri/src/commands/*.rs` — thin Tauri command adapters grouped by feature.

### Cross-layer tests and fixtures

- `tests/fixtures/url-normalization.json` — one canonical vector set consumed by TS and Rust.
- `tests/fixtures/export-v1/{valid,minimal,invalid-*.json}` — schema and invariant fixtures.
- `tests/fixtures/backup-v1/{manifest-valid,manifest-invalid-*.json}` — manifest fixtures.
- `tests/e2e/*.spec.ts` — browser flows against `MockNativeBridge`.
- `tests/perf/workspace.spec.ts` — 10k-query and virtual-scroll measurements.

---

## Phase A — Foundation and Trust Boundaries

### Task 1: Scaffold the Tauri/React project and verification harness

**Files:**
- Create: `package.json`, `pnpm-lock.yaml`, `index.html`, `vite.config.ts`, `vitest.config.ts`
- Create: `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`
- Create: `src/main.tsx`, `src/vite-env.d.ts`, `src/app/App.tsx`, `src/app/AppProviders.tsx`
- Create: `src/app/App.test.tsx`, `src/test/setup.ts`
- Create: `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/tauri.conf.json`
- Create: `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/default.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: the approved design spec only.
- Produces: `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm tauri dev`, and `cargo test --manifest-path src-tauri/Cargo.toml` entry points.

- [ ] **Step 1: Create the package/toolchain manifests and install dependencies**

Use `package.json` scripts exactly:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "typecheck": "tsc -b --pretty false",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "tauri": "tauri"
  }
}
```

Install runtime dependencies with:

```bash
pnpm add react react-dom @tauri-apps/api @tauri-apps/plugin-dialog @tauri-apps/plugin-opener @tanstack/react-query @tanstack/react-virtual react-hook-form @hookform/resolvers zod lucide-react clsx vgpu
pnpm add -D typescript vite @vitejs/plugin-react @types/react @types/react-dom vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom @playwright/test @axe-core/playwright @tauri-apps/cli @webgpu/types @vgpu/wgsl
```

Set `packageManager` to the exact installed pnpm version after `pnpm --version`. Commit the generated lockfile; do not hand-edit it.

`@vgpu/cli` is not published to the configured npm registry and must not be fabricated or added to the lockfile. The installed public `vgpu` package provides `pnpm exec vgpu`; keep `@vgpu/wgsl` installed for `vgpu check`.

- [ ] **Step 2: Configure the Rust crate and minimal Tauri shell**

Set package name `domain-manager`, app identifier `com.dongqing.domainmanager`, product name `DOMAIN.`, frontend dev URL `http://localhost:5173`, `beforeDevCommand: pnpm dev`, and `beforeBuildCommand: pnpm build`. Add `tauri = { version = "2", features = ["tray-icon"] }`, `tauri-build = "2"`, and the dialog/opener/log plugins at major version 2. Keep `capabilities/default.json` limited to core window defaults and the three named plugins.

- [ ] **Step 3: Write the failing shell test**

```tsx
// src/app/App.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("renders the local collection shell", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "网站收藏库" })).toBeVisible();
  });
});
```

- [ ] **Step 4: Run the focused test and observe the intended failure**

Run: `pnpm vitest run src/app/App.test.tsx`

Expected: FAIL because `App` or the heading is absent.

- [ ] **Step 5: Implement the minimal shell and providers**

```tsx
// src/app/App.tsx
export function App() {
  return (
    <main>
      <h1>网站收藏库</h1>
    </main>
  );
}
```

Mount it through `StrictMode` in `src/main.tsx`; `AppProviders` initially only renders `children` and is expanded in Task 2.

- [ ] **Step 6: Run the complete foundation checks**

Run:

```bash
pnpm test
pnpm typecheck
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: all commands exit 0; Vitest reports one passing test; Vite creates `dist/`; Cargo compiles the empty command shell.

- [ ] **Step 7: Commit the foundation**

```bash
git add package.json pnpm-lock.yaml index.html vite.config.ts vitest.config.ts tsconfig*.json src src-tauri .gitignore
git commit -m "chore: scaffold domain manager desktop app"
```

### Task 2: Freeze cross-layer DTOs and injectable bridge

**Files:**
- Create: `src/domain/site.ts`, `src/domain/taxonomy.ts`, `src/domain/import.ts`
- Create: `src/infrastructure/bridge/NativeBridge.ts`
- Create: `src/infrastructure/bridge/TauriNativeBridge.ts`
- Create: `src/infrastructure/bridge/MockNativeBridge.ts`
- Create: `src/infrastructure/bridge/BridgeContext.tsx`
- Create: `src/infrastructure/bridge/MockNativeBridge.test.ts`, `src/test/fixtures.ts`
- Create: `src-tauri/src/model.rs`, `src-tauri/src/error.rs`
- Modify: `src/app/AppProviders.tsx`, `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: Tauri `invoke` and events.
- Produces: `NativeBridge`, `Site`, `SiteListItem`, `SitePage`, `SiteQuery`, `Category`, `Tag`, `AppCommandError`; Rust DTOs use matching camelCase JSON field names.

- [ ] **Step 1: Define the shared TypeScript contracts**

Create these declarations exactly so list rows, detail rows, paging, and summary counts use one consistent contract:

```ts
export type AutoStatus = "unchecked" | "available" | "unavailable";
export type ManualStatus = "available" | "unavailable" | null;
export type EffectiveStatus = AutoStatus;

export interface Site {
  id: string;
  name: string;
  domain: string;
  url: string;
  normalizedUrl: string;
  notes: string;
  categoryId: string | null;
  tagIds: string[];
  isPinned: boolean;
  autoStatus: AutoStatus;
  manualStatus: ManualStatus;
  failureStreak: 0 | 1 | 2;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastCheckSource: "scheduled" | "manual" | null;
  lastHttpStatus: number | null;
  lastResponseMs: number | null;
  lastCheckError: string | null;
  createdAt: string;
  updatedAt: string;
  urlRevision: number;
  rowRevision: number;
}

export interface SiteQuery {
  keyword: string;
  categoryId: string | null;
  tagIds: string[];
  status: EffectiveStatus | null;
  sortBy: "name" | "domain" | "createdAt" | "updatedAt" | "status";
  sortDirection: "asc" | "desc";
  offset: number;
  limit: number;
}

export interface Paged<T> { items: T[]; total: number; }
export type SiteListItem = Site;

export interface SiteSummary {
  total: number;
  available: number;
  needsAttention: number;
}

export interface SitePage extends Paged<SiteListItem> {
  summary: SiteSummary;
}

export interface Category {
  id: string;
  name: string;
  nameKey: string;
  color: string;
  sortIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface Tag extends Category {}

export interface CategoryListItem extends Category { siteCount: number; }
export interface TagListItem extends Tag { siteCount: number; }

export interface TaxonomySnapshot {
  categories: CategoryListItem[];
  tags: TagListItem[];
}

export interface CreateSiteInput {
  name: string;
  domain: string;
  url: string;
  notes: string;
  categoryId: string | null;
  tagIds: string[];
  isPinned: boolean;
  manualStatus: ManualStatus;
}

export interface UpdateSiteInput extends CreateSiteInput {
  id: string;
  expectedRowRevision: number;
}

export interface DeletedSiteSnapshot {
  site: Site;
}
```

`effectiveStatus(site)` must return `site.manualStatus ?? site.autoStatus`. `needsAttention(site)` must implement spec §8.2 exactly.

- [ ] **Step 2: Define the bridge surface before implementing it**

```ts
export interface NativeBridge {
  listSites(query: SiteQuery): Promise<SitePage>;
  getSite(id: string): Promise<Site>;
  createSite(input: CreateSiteInput): Promise<Site>;
  updateSite(input: UpdateSiteInput): Promise<Site>;
  deleteSites(ids: string[]): Promise<DeletedSiteSnapshot[]>;
  restoreSites(snapshots: DeletedSiteSnapshot[]): Promise<void>;
  listTaxonomy(): Promise<TaxonomySnapshot>;
  openUrls(urls: string[]): Promise<void>;
}
```

Add only the typed feature methods named in their owning tasks; never return untyped maps. Every method rejects `AppCommandError { code, message, details? }`. `src/test/fixtures.ts` exports `siteFixture(overrides?: Partial<Site>): Site` and `defaultSiteQuery(overrides?: Partial<SiteQuery>): SiteQuery` with fixed UUIDs and timestamps.

- [ ] **Step 3: Write a failing deterministic mock test**

```ts
it("filters mock sites through the bridge contract", async () => {
  const bridge = new MockNativeBridge({ sites: [siteFixture({ name: "Vercel" })] });
  const page = await bridge.listSites(defaultSiteQuery({ keyword: "ver" }));
  expect(page.items.map((site) => site.name)).toEqual(["Vercel"]);
});
```

- [ ] **Step 4: Run it and confirm the contract is missing**

Run: `pnpm vitest run src/infrastructure/bridge/MockNativeBridge.test.ts`

Expected: FAIL because the mock, fixtures, or methods do not exist.

- [ ] **Step 5: Implement mock, Tauri adapter, and provider**

`TauriNativeBridge` calls `invoke<Return>("snake_case_command", { input })`; `MockNativeBridge` owns cloned arrays and applies the same pure filter/sort helpers. `BridgeContext` throws a descriptive error when used without a provider. `AppProviders` creates one `QueryClient` and injects `TauriNativeBridge` by default, while tests pass a mock.

- [ ] **Step 6: Mirror DTOs in Rust and verify serialization names**

Use `#[serde(rename_all = "camelCase")]` on every DTO and a Rust test that serializes one `Site` and asserts keys `normalizedUrl`, `lastSuccessAt`, `urlRevision`, and `rowRevision`. Define stable error codes including `validation`, `not_found`, `conflict`, `preview_stale`, `maintenance`, `busy`, `unsafe_url`, `io`, `database`, and `internal`.

- [ ] **Step 7: Run bridge and serialization checks**

Run:

```bash
pnpm vitest run src/infrastructure/bridge/MockNativeBridge.test.ts
pnpm typecheck
cargo test --manifest-path src-tauri/Cargo.toml model::tests
```

Expected: all pass; no `any` appears in bridge public signatures.

- [ ] **Step 8: Commit the contracts**

```bash
git add src/domain src/infrastructure src/app/AppProviders.tsx src-tauri/src/model.rs src-tauri/src/error.rs src-tauri/src/lib.rs
git commit -m "feat: define typed native bridge contracts"
```

### Task 3: Implement URL normalization parity and external-open safety

**Files:**
- Create: `tests/fixtures/url-normalization.json`
- Create: `src/domain/url-normalizer.ts`, `src/domain/url-normalizer.test.ts`
- Create: `src-tauri/src/url_normalizer.rs`
- Create: `src-tauri/src/desktop/mod.rs`, `src-tauri/src/desktop/opener.rs`
- Create: `src-tauri/src/commands/desktop.rs`
- Modify: `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml`

**Interfaces:**
- Consumes: raw user URL text.
- Produces: TS `normalizeUrl(raw): NormalizedUrl`; Rust `normalize_url(raw: &str) -> Result<NormalizedUrl, AppError>`; command `open_urls(urls: Vec<String>) -> Result<(), AppError>`.

- [ ] **Step 1: Create canonical vectors**

Include at least these cases:

```json
[
  { "input": "example.com", "url": "https://example.com/", "normalized": "https://example.com/", "hostname": "example.com" },
  { "input": "HTTP://Example.COM:80", "url": "http://example.com/", "normalized": "http://example.com/", "hostname": "example.com" },
  { "input": "https://example.com/a/", "url": "https://example.com/a/", "normalized": "https://example.com/a/", "hostname": "example.com" },
  { "input": "https://例子.测试/路径?q=1#片段", "url": "https://xn--fsqu00a.xn--0zwm56d/%E8%B7%AF%E5%BE%84?q=1#%E7%89%87%E6%AE%B5", "normalized": "https://xn--fsqu00a.xn--0zwm56d/%E8%B7%AF%E5%BE%84?q=1#%E7%89%87%E6%AE%B5", "hostname": "xn--fsqu00a.xn--0zwm56d" },
  { "input": "javascript:alert(1)", "error": "unsafe_url" },
  { "input": "https://user:pass@example.com", "error": "credentials_not_allowed" }
]
```

Add vectors proving HTTP/HTTPS remain distinct, root slash equivalence, non-root trailing slash distinction, query-order preservation, and rejection of `file:`, `data:`, malformed hostnames, and empty input.

- [ ] **Step 2: Write failing TS and Rust vector tests**

Both test suites load the same JSON file. Each successful case compares canonical URL, normalized URL, and hostname; each failure compares stable error code.

- [ ] **Step 3: Run both suites and observe failure**

Run:

```bash
pnpm vitest run src/domain/url-normalizer.test.ts
cargo test --manifest-path src-tauri/Cargo.toml url_normalizer::tests
```

Expected: FAIL because normalizers do not exist.

- [ ] **Step 4: Implement both normalizers**

TS uses the platform `URL` constructor after conditional `https://` prefixing. Rust uses the `url` crate. Both lowercase scheme/host, remove default ports, preserve non-root path/query/fragment serialization, reject credentials, and return hostname separately. Never derive behavior from the editable display `domain` field.

- [ ] **Step 5: Implement validated system opening**

`open_urls` reparses every item first; if any item is unsafe, return one error and open none. Only after all pass, call the Tauri opener plugin sequentially. Deduplicate exact canonical URL strings while preserving input order.

- [ ] **Step 6: Add opener tests**

Inject an `UrlOpener` trait. Assert two safe URLs call the fake in order; one `file:` or credential URL produces zero calls; duplicate URLs produce one call. Keep the Tauri plugin adapter outside the pure test.

- [ ] **Step 7: Run checks and commit**

Run:

```bash
pnpm vitest run src/domain/url-normalizer.test.ts
cargo test --manifest-path src-tauri/Cargo.toml url_normalizer desktop::opener
pnpm typecheck
```

Then:

```bash
git add tests/fixtures/url-normalization.json src/domain/url-normalizer* src-tauri
git commit -m "feat: normalize and safely open website urls"
```

### Task 4: Create SQLite schema, migrations, database executor, and maintenance gate

**Files:**
- Create: `src-tauri/migrations/0001_initial.sql`
- Create: `src-tauri/src/db/mod.rs`, `src-tauri/src/db/gate.rs`
- Create: `src-tauri/src/db/tests.rs`
- Modify: `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: application data directory path.
- Produces: `Database::open(path)`, `Database::read`, `Database::write`, `Database::generation`, `MaintenanceGate::acquire_shared`, `begin_draining`, `enter_exclusive`, `reopen`.

The production database path is exactly `<Tauri app_data_dir>/data.sqlite3`; tests always pass an explicit temporary path. Startup creates the application-owned directory but never replaces a preexisting invalid database file.

- [ ] **Step 1: Write failing migration and gate tests**

Write these three named tests with explicit setup and assertions:

- `migration_creates_v1_schema_and_foreign_keys`: open a temporary database, query `sqlite_master` for all six required tables and required indexes, assert `PRAGMA user_version = 1`, assert `PRAGMA foreign_keys = 1`, then attempt invalid category and tag references and assert SQLite rejects them.
- `draining_rejects_waiting_and_new_shared_requests`: hold one shared permit, start a second acquisition behind a deterministic test barrier, call `begin_draining`, and assert both the waiting acquisition and a new acquisition return `AppErrorCode::Maintenance` without waiting for the first holder to finish.
- `exclusive_waits_for_existing_holder_without_deadlock`: hold one issued shared permit, begin draining, start `enter_exclusive`, assert it remains pending, release the holder, assert exclusive completes within a one-second Tokio timeout, install a valid reopened connection, and assert a new shared acquisition succeeds.

- [ ] **Step 2: Run tests and observe missing modules**

Run: `cargo test --manifest-path src-tauri/Cargo.toml db::tests`

Expected: FAIL because migration runner and gate are absent.

- [ ] **Step 3: Add exact v1 SQL schema**

Create tables `categories`, `tags`, `sites`, `site_tags`, `app_settings`, and one-row `scheduler_state`. Use `CHECK` constraints for statuses, source, booleans, and failure range; foreign keys use `ON DELETE SET NULL` for category and `ON DELETE CASCADE` for join rows. Include `url_revision INTEGER NOT NULL DEFAULT 1 CHECK(url_revision >= 1)` and the same rule for `row_revision`. Add indexes for normalized URL, category, pin, status fields, timestamps, and both join directions.

The migration runner executes this file in one transaction, records schema version 1 with `PRAGMA user_version`, and configures each connection with:

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
```

- [ ] **Step 4: Implement the blocking database executor**

Use a single `rusqlite::Connection` protected by `parking_lot::Mutex`; wrap database closures in `tokio::task::spawn_blocking`. A shared maintenance permit is acquired before entering the blocking closure and held until it returns. Map join panic, SQLite busy, constraint, and I/O errors to stable `AppErrorCode` values.

- [ ] **Step 5: Implement the non-waiting draining gate**

Represent state as `Open | Draining | Exclusive`. Shared acquisition uses an atomic state check plus non-waiting owned read acquisition and a second state check. `begin_draining` flips state before cancellation so queued/new requests fail with `maintenance`; `enter_exclusive` waits only for already-issued guards. `reopen` wakes callers only after a valid connection is installed.

- [ ] **Step 6: Add migration idempotence and corruption tests**

Open the same database twice and assert version remains 1. Create a file containing non-SQLite bytes and assert `Database::open` returns `database` without replacing or truncating it.

- [ ] **Step 7: Run checks and commit**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml db::tests
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

Then:

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/migrations src-tauri/src/db src-tauri/src/lib.rs
git commit -m "feat: add sqlite schema and maintenance gate"
```

## Phase B — Catalog Domain and Main Workspace

### Task 5: Implement category/tag normalization and repositories

**Files:**
- Create: `tests/fixtures/taxonomy-name-keys.json`
- Create: `src-tauri/src/db/catalog.rs`, `src-tauri/src/db/catalog_tests.rs`
- Create: `src-tauri/src/commands/mod.rs`, `src-tauri/src/commands/taxonomy.rs`
- Create: `src/domain/taxonomy.test.ts`
- Modify: `src/domain/taxonomy.ts`, `src/infrastructure/bridge/NativeBridge.ts`
- Modify: `src/infrastructure/bridge/TauriNativeBridge.ts`, `src/infrastructure/bridge/MockNativeBridge.ts`
- Modify: `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml`

**Interfaces:**
- Consumes: `Database`, taxonomy DTOs, Unicode names.
- Produces: `taxonomyNameKey(name)`, `CatalogRepository::{list_taxonomy,create_category,update_category,delete_category,create_tag,update_tag,delete_tag}` and matching bridge methods.

- [ ] **Step 1: Write failing name-key tests in both languages**

Use cases: surrounding whitespace removed, Unicode NFKC applied, case folded, empty-after-normalization rejected, `Ｆｉｇｍａ` collides with `figma`, and Chinese display text remains readable. TS and Rust must use the same JSON vector array stored in `tests/fixtures/taxonomy-name-keys.json`.

- [ ] **Step 2: Run focused tests and confirm failure**

Run:

```bash
pnpm vitest run src/domain/taxonomy.test.ts
cargo test --manifest-path src-tauri/Cargo.toml taxonomy_name_key
```

Expected: both fail because the normalization functions are absent.

- [ ] **Step 3: Implement deterministic name keys**

Trim, normalize NFKC, then apply Unicode lowercase/case folding consistently. Store display `name` separately from `name_key`. Reject an empty key and colors outside `^#[0-9A-Fa-f]{6}$`; canonicalize stored color to uppercase.

- [ ] **Step 4: Write failing repository transaction tests**

Cover create/list stable `sort_index`, derived `siteCount` for both category and tag list items, same-key conflict, rename conflict, delete category setting `sites.category_id` to NULL, delete tag removing only join rows, and color/order retention when an imported name reuses an existing key.

- [ ] **Step 5: Implement repository and commands**

Every mutation runs in one transaction and returns the committed row. Category/tag delete commands return affected-site counts for confirmation UI. Use explicit column lists; never use `SELECT *`. Commands validate again even when the frontend already validated.

- [ ] **Step 6: Extend bridge and mock contract**

Add:

```ts
createCategory(input: { name: string; color: string }): Promise<Category>;
updateCategory(input: { id: string; name: string; color: string }): Promise<Category>;
deleteCategory(id: string): Promise<{ affectedSites: number }>;
createTag(input: { name: string; color: string }): Promise<Tag>;
updateTag(input: { id: string; name: string; color: string }): Promise<Tag>;
deleteTag(id: string): Promise<{ affectedSites: number }>;
```

- [ ] **Step 7: Run repository and parity tests**

Run:

```bash
pnpm vitest run src/domain/taxonomy.test.ts src/infrastructure/bridge/MockNativeBridge.test.ts
cargo test --manifest-path src-tauri/Cargo.toml catalog taxonomy
pnpm typecheck
```

- [ ] **Step 8: Commit taxonomy support**

```bash
git add tests/fixtures/taxonomy-name-keys.json src/domain/taxonomy* src/infrastructure/bridge src-tauri
git commit -m "feat: add category and tag repositories"
```

### Task 6: Implement site CRUD, optimistic revisions, delete undo, and commands

**Files:**
- Modify: `src-tauri/src/db/catalog.rs`, `src-tauri/src/db/catalog_tests.rs`
- Create: `src-tauri/src/commands/sites.rs`
- Create: `src/domain/site.test.ts`
- Modify: `src/domain/site.ts`
- Modify: `src/infrastructure/bridge/{NativeBridge,TauriNativeBridge,MockNativeBridge}.ts`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: URL normalizer, taxonomy IDs, `Database` shared permit.
- Produces: `create_site`, `get_site`, `update_site`, `delete_sites`, `restore_sites`; bridge `CreateSiteInput` and revisioned `UpdateSiteInput`.

- [ ] **Step 1: Define mutation inputs with expected revision**

```ts
export interface CreateSiteInput {
  name: string;
  domain: string;
  url: string;
  notes: string;
  categoryId: string | null;
  tagIds: string[];
  isPinned: boolean;
  manualStatus: ManualStatus;
}

export interface UpdateSiteInput extends CreateSiteInput {
  id: string;
  expectedRowRevision: number;
}
```

Rust mirrors these fields. `normalized_url`, UUID, timestamps, revisions, and automatic health fields are server-owned.

- [ ] **Step 2: Write failing CRUD tests**

Assert create derives canonical URL/domain defaults, initializes both revisions to 1, validates category/tag existence, and rejects unsafe URL. Assert ordinary edit increments `row_revision`; setting or clearing manual override changes business `updated_at` but preserves all automatic/last-check fields; equivalent URL serialization preserves health and `url_revision`; changed normalized URL increments `url_revision` and clears all automatic/manual health fields. The command returns the committed `Site`; the frontend's pure form model computes `willResetStatus` before submit.

- [ ] **Step 3: Run focused Rust tests and observe failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml db::catalog_tests::site_`

Expected: FAIL because site repository methods are absent.

- [ ] **Step 4: Implement create/get/update CAS**

`update_site` uses `WHERE id = ? AND row_revision = ?`; zero affected rows returns `conflict`. It validates all tag IDs before deleting/reinserting joins. Business edits set `updated_at`; health-only fields are untouched unless URL reset is required. Return the complete joined site after commit.

- [ ] **Step 5: Implement delete snapshots and transactional undo**

`delete_sites(ids)` loads full sites plus tag IDs in caller order, deletes in one transaction, and returns `DeletedSiteSnapshot[]`. `restore_sites` rejects ID collisions or category/tag references that no longer exist and restores sites plus relations in one transaction; a duplicate `normalized_url` remains allowed by design. The UI keeps snapshots only for the visible undo interval.

- [ ] **Step 6: Write stale revision, URL reset, and undo tests**

Use two copies of one row: update copy A, then assert copy B returns `conflict`. Start from an available manually overridden site, change URL, and assert every field listed in spec §7.1 is reset. Delete two sites, restore snapshots, and compare all portable fields and tag relations.

- [ ] **Step 7: Extend bridge/mock and pure status tests**

Test `effectiveStatus`, `needsAttention`, manual override marker, and fixture serialization. The mock must enforce expected revision and URL reset behavior rather than simply merging objects.

- [ ] **Step 8: Run complete CRUD checks and commit**

Run:

```bash
pnpm vitest run src/domain/site.test.ts src/infrastructure/bridge/MockNativeBridge.test.ts
cargo test --manifest-path src-tauri/Cargo.toml catalog commands::sites
pnpm typecheck
```

Then:

```bash
git add src/domain/site* src/infrastructure/bridge src-tauri
git commit -m "feat: implement revisioned site crud"
```

### Task 7: Implement parameterized search, AND-tag filters, stable sorting, and paging

**Files:**
- Create: `src-tauri/src/db/query.rs`, `src-tauri/src/db/query_tests.rs`
- Create: `src-tauri/src/commands/query.rs`
- Create: `src/domain/site-query.ts`, `src/domain/site-query.test.ts`
- Modify: `src/infrastructure/bridge/{NativeBridge,TauriNativeBridge,MockNativeBridge}.ts`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: `SiteQuery` from Task 2.
- Produces: `CatalogRepository::list_sites(query) -> SitePage` and pure `normalizeSiteQuery`; `SitePage.summary` is calculated from the same normalized filter set before limit/offset are applied.

- [ ] **Step 1: Write failing query-model tests**

Assert keyword trim, duplicate tag removal, maximum `limit = 200`, nonnegative offset, default `updatedAt desc`, and preservation of explicit name/domain/time/status sorts. Invalid enum values must be rejected at the Rust boundary rather than interpolated.

- [ ] **Step 2: Write failing SQLite query tests**

Seed sites whose keyword appears separately in name, URL, domain, notes, and tag. Assert case-insensitive Latin substring and Chinese substring matching; literal `%`, `_`, and backslash do not act as wildcards; category/status filters combine with AND; two selected tags require both; manual status drives effective-status filtering; pinned partition is first; ties finish with `id ASC`; count matches items across pages.

- [ ] **Step 3: Run focused tests and observe failure**

Run:

```bash
pnpm vitest run src/domain/site-query.test.ts
cargo test --manifest-path src-tauri/Cargo.toml db::query_tests
```

- [ ] **Step 4: Implement a parameterized query builder**

Keep sort SQL in a closed Rust match:

```rust
let order = match (query.sort_by, query.sort_direction) {
    (SortBy::UpdatedAt, Direction::Desc) => "s.updated_at DESC",
    (SortBy::UpdatedAt, Direction::Asc) => "s.updated_at ASC",
    (SortBy::Name, Direction::Asc) => "s.name COLLATE NOCASE ASC",
    (SortBy::Name, Direction::Desc) => "s.name COLLATE NOCASE DESC",
    (SortBy::Domain, Direction::Asc) => "s.domain COLLATE NOCASE ASC",
    (SortBy::Domain, Direction::Desc) => "s.domain COLLATE NOCASE DESC",
    (SortBy::CreatedAt, Direction::Asc) => "s.created_at ASC",
    (SortBy::CreatedAt, Direction::Desc) => "s.created_at DESC",
    (SortBy::Status, Direction::Asc) => "CASE COALESCE(s.manual_status, s.auto_status) WHEN 'available' THEN 0 WHEN 'unchecked' THEN 1 ELSE 2 END ASC",
    (SortBy::Status, Direction::Desc) => "CASE COALESCE(s.manual_status, s.auto_status) WHEN 'available' THEN 0 WHEN 'unchecked' THEN 1 ELSE 2 END DESC",
};
```

All values use `rusqlite::params_from_iter`. Escape keyword backslash first, then `%` and `_`, and bind `%<escaped>%` to every `LIKE ? ESCAPE '\\'` predicate. Search tag names through a correlated `EXISTS` subquery so joins cannot duplicate site rows. Tag AND filtering uses `s.id IN (SELECT site_id FROM site_tags WHERE tag_id IN (...) GROUP BY site_id HAVING COUNT(DISTINCT tag_id) = ?)`. Run total, summary, and page select against the same condition builder.

- [ ] **Step 5: Add deterministic 10k query fixture generator**

Create a seeded Rust helper generating 10,000 sites, 20 categories, and 50 tags. A non-timing integration test asserts representative result IDs; the measured threshold remains in Task 22 to avoid flaky unit suites.

- [ ] **Step 6: Extend bridge and mock query semantics**

The mock applies the exact same status, pin partition, tag-AND, and stable-ID rules. Add one parity fixture whose expected ordered IDs are asserted in both Rust and TypeScript tests.

- [ ] **Step 7: Run checks and commit**

Run:

```bash
pnpm vitest run src/domain/site-query.test.ts src/infrastructure/bridge/MockNativeBridge.test.ts
cargo test --manifest-path src-tauri/Cargo.toml db::query_tests
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

Then commit:

```bash
git add src/domain/site-query* src/infrastructure/bridge src-tauri
git commit -m "feat: add catalog search filtering and sorting"
```

### Task 8: Build the visual shell, tokens, sidebar, and taxonomy dialog

**Files:**
- Create: `src/app/styles/tokens.css`, `src/app/styles/global.css`
- Create: `src/features/workspace/Sidebar.tsx`, `src/features/workspace/Sidebar.module.css`
- Create: `src/features/taxonomy/TaxonomyDialog.tsx`, `src/features/taxonomy/TaxonomyDialog.test.tsx`
- Create: `src/features/taxonomy/TaxonomyDialog.module.css`
- Modify: `src/app/App.tsx`, `src/main.tsx`, `src/app/AppProviders.tsx`

**Interfaces:**
- Consumes: bridge taxonomy methods and React Query.
- Produces: persistent left navigation, selected smart-list/category state, accessible taxonomy CRUD dialog, base visual tokens used by all later UI.

- [ ] **Step 1: Write failing shell and taxonomy tests**

Render with `MockNativeBridge`. Assert sidebar labels “全部网站 / 收藏置顶 / 待检测 / 已失效”, category counts, “新建分类”, dialog focus trap, Escape close, same-key validation, delete affected-site confirmation, and cache refresh after a successful mutation. In a media-query stub, assert system dark preference switches token values without changing semantic status text.

- [ ] **Step 2: Run tests and observe missing components**

Run: `pnpm vitest run src/features/taxonomy/TaxonomyDialog.test.tsx src/app/App.test.tsx`

- [ ] **Step 3: Define the A-direction design tokens**

Use CSS custom properties for neutral canvas, white surface, blue-gray accent, green/amber/red status, 4/8/12/16/24 spacing, 7/10/16 radii, system font stack, visible `:focus-visible`, and reduced-motion overrides. Add a `prefers-color-scheme: dark` token override for canvas, panels, borders, text, focus, and all three status colors; the confirmed light palette remains the baseline. Keep core contrast at WCAG AA. Do not place interactive DOM under the future Canvas.

- [ ] **Step 4: Implement shell and React Query taxonomy hooks**

`AppProviders` owns one `QueryClient`. Create query keys `['taxonomy']` and mutation invalidation. `App` lays out native-titlebar-safe content with sidebar and main region; there is no router in v1.

- [ ] **Step 5: Implement taxonomy dialog behavior**

Use controlled name/color form, bridge errors by stable code, explicit affected-site delete text, keyboard focus return to trigger, and no optimistic deletion. Category and tag sections remain separate while sharing small form primitives.

- [ ] **Step 6: Verify interaction and accessibility**

Run:

```bash
pnpm vitest run src/features/taxonomy/TaxonomyDialog.test.tsx src/app/App.test.tsx
pnpm typecheck
pnpm build
```

Use Testing Library `getByRole` for all controls; tests must not rely on CSS class names.

- [ ] **Step 7: Commit shell and taxonomy UI**

```bash
git add src/app src/features/workspace/Sidebar* src/features/taxonomy src/main.tsx
git commit -m "feat: add desktop shell and taxonomy ui"
```

### Task 9: Build workspace query controls and virtualized site table

**Files:**
- Create: `src/features/workspace/Workspace.tsx`, `Workspace.test.tsx`, `Workspace.module.css`
- Create: `src/features/workspace/FilterBar.tsx`, `FilterBar.test.tsx`
- Create: `src/features/workspace/SiteTable.tsx`, `SiteTable.test.tsx`, `SiteTable.module.css`
- Create: `src/features/workspace/useSiteQuery.ts`
- Modify: `src/app/App.tsx`

**Interfaces:**
- Consumes: `NativeBridge.listSites`, sidebar selection, taxonomy query.
- Produces: debounced, cancellable list query; virtual rows; stable selection by site ID; callbacks `onEdit`, `onOpen`, `onSelectionChange`.

- [ ] **Step 1: Write failing filter and table tests**

Assert 120 ms keyword debounce, removable filter chips, tag-AND query shape, status and sort controls, stale request results ignored, pinned marker, manual-override badge, checkbox selection, single click selection without opening, double click invoking `onOpen`, and keyboard Space selection. Assert `Cmd/Ctrl+K` focuses search, `Cmd/Ctrl+N` calls `onCreate`, `Cmd/Ctrl+Enter` opens the current row, and Escape clears selection only when no modal or editor owns the key.

- [ ] **Step 2: Run focused tests and observe failure**

Run: `pnpm vitest run src/features/workspace`

- [ ] **Step 3: Implement query state and cache keys**

Store query state in `Workspace`; derive React Query key from every normalized field. Use an incrementing request token in `MockNativeBridge` tests to prove a slow older request cannot replace a newer query. Fetch pages of 200 and append when the virtualizer approaches the end.

Register one workspace-level keyboard handler that ignores editable targets, composes with drawer/dialog handlers, calls `preventDefault` only for a handled shortcut, and removes itself on unmount.

- [ ] **Step 4: Implement the virtual table**

Use `useVirtualizer` with a fixed 44 px row estimate, overscan 8, semantic grid/table labels, and an absolutely positioned row container. Keep selected IDs outside row components so unmounted virtual rows remain selected. Render local letter icons only.

- [ ] **Step 5: Implement filter and summary UI**

Search covers all spec fields; sidebar smart lists map exactly to spec §8.2; summary cards render `SitePage.summary.total`, `.available`, and `.needsAttention` from the first page. Sorting exposes direction toggle and defaults to updated descending.

- [ ] **Step 6: Run tests, typecheck, and build**

Run:

```bash
pnpm vitest run src/features/workspace
pnpm typecheck
pnpm build
```

- [ ] **Step 7: Commit workspace listing**

```bash
git add src/features/workspace src/app/App.tsx
git commit -m "feat: add searchable virtualized website workspace"
```

### Task 10: Add the site editor drawer and manual override controls

**Files:**
- Create: `src/features/sites/site-form.ts`, `site-form.test.ts`
- Create: `src/features/sites/SiteEditorDrawer.tsx`, `SiteEditorDrawer.test.tsx`
- Create: `src/features/sites/SiteEditorDrawer.module.css`
- Create: `src/features/health/StatusOverride.tsx`, `StatusOverride.test.tsx`
- Modify: `src/features/workspace/Workspace.tsx`

**Interfaces:**
- Consumes: create/get/update bridge methods, taxonomy, selected site.
- Produces: validated create/edit flow; `onSaved(site)`; dirty-close guard; URL-change reset acknowledgment; manual override field.

- [ ] **Step 1: Write failing form-model tests**

Assert protocol completion, required name/domain defaults from normalized hostname, credential and unsafe-scheme rejection, trimmed notes, unique tag IDs, and mapping of `rowRevision` into `expectedRowRevision`. A URL whose normalized value changes must set `willResetStatus = true`.

- [ ] **Step 2: Write failing drawer interaction tests**

Test create success, duplicate URL warning that allows explicit continuation, stale-revision conflict reload prompt, URL-reset confirmation, manual available/unavailable/clear controls, `Cmd/Ctrl+S`, Escape with dirty confirmation, and focus restoration after close.

- [ ] **Step 3: Run focused tests and observe failure**

Run: `pnpm vitest run src/features/sites src/features/health/StatusOverride.test.tsx`

- [ ] **Step 4: Implement the Zod form and drawer**

Use `react-hook-form` with Zod. Normalize on blur and before submit. The URL reset confirmation is only shown when editing and normalized values differ. Duplicate warning is a two-step submit state; server validation remains authoritative.

- [ ] **Step 5: Connect mutations and cache updates**

On success, update the site detail cache, invalidate list/taxonomy/count queries, clear dirty state, then close. On `conflict`, keep user input and offer “重新载入最新数据”; never overwrite without a fresh revision.

- [ ] **Step 6: Run complete UI checks and commit**

Run:

```bash
pnpm vitest run src/features/sites src/features/health/StatusOverride.test.tsx src/features/workspace
pnpm typecheck
```

Then:

```bash
git add src/features/sites src/features/health/StatusOverride* src/features/workspace/Workspace.tsx
git commit -m "feat: add website editor and status override"
```

### Task 11: Add pinning, batch actions, delete confirmation, undo, and safe multi-open

**Files:**
- Create: `src/features/sites/BatchToolbar.tsx`, `BatchToolbar.test.tsx`
- Create: `src/features/sites/DeleteSitesDialog.tsx`, `DeleteSitesDialog.test.tsx`
- Create: `src/features/sites/useDeleteUndo.ts`, `useDeleteUndo.test.tsx`
- Modify: `src/features/workspace/Workspace.tsx`, `SiteTable.tsx`
- Modify: `src-tauri/src/db/catalog.rs`, `src-tauri/src/commands/sites.rs`
- Modify: bridge implementations and DTOs

**Interfaces:**
- Consumes: selected IDs and Task 6 mutations.
- Produces: `set_sites_pinned`, `set_sites_category`, `add_sites_tags`, `remove_sites_tags`; batch open/delete/export/detect entry callbacks; 8-second undo window.

- [ ] **Step 1: Write failing Rust batch transaction tests**

For each command, assert all IDs are validated before mutation, one invalid ID rolls back the whole batch, every affected site increments `row_revision`, business `updated_at` changes, tag addition is idempotent, and category/tag foreign keys are checked.

- [ ] **Step 2: Run Rust tests and observe failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml batch_`

- [ ] **Step 3: Implement repository and command methods**

Use one transaction per batch. Return `{ affected: number }` plus refreshed rows only when the UI needs them. Keep delete snapshot size bounded to selected rows and relations.

- [ ] **Step 4: Write failing toolbar and undo tests**

Assert toolbar appears only with selection, selected count is correct across virtual unmounts, opening 1–5 URLs proceeds, opening 6 requires confirmation and cancellation calls none, deletion text includes count, undo restores snapshots once, and expiration removes the action.

- [ ] **Step 5: Implement UI behavior**

Use one accessible dialog at a time. After a batch mutation, clear selection only after success and invalidate affected queries. The undo toast holds snapshots in memory; a second click is disabled while restore runs.

- [ ] **Step 6: Run checks and commit**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml batch_ catalog
pnpm vitest run src/features/sites src/features/workspace
pnpm typecheck
```

Then:

```bash
git add src/features/sites src/features/workspace src/infrastructure/bridge src-tauri
git commit -m "feat: add transactional batch website actions"
```

## Phase C — Health Checking, Scheduling, and Tray Runtime

### Task 12: Implement the pure health state machine

**Files:**
- Create: `src-tauri/src/health/mod.rs`, `src-tauri/src/health/state.rs`, `src-tauri/src/health/state_tests.rs`
- Modify: `src-tauri/src/model.rs`, `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: current health snapshot plus `ProbeOutcome`, timestamp, and source.
- Produces: `apply_probe(current, outcome, checked_at, source) -> HealthPatch` with no database or network dependency.

- [ ] **Step 1: Encode the spec table as failing data-driven tests**

Create cases for success from every state, final GET 404/410, first transient failure from unchecked/available/unavailable, second transient failure, success clearing errors, `last_success_at` preservation on failure, and failure streak cap 2. Assert manual status is never included in `HealthPatch`.

- [ ] **Step 2: Run focused tests and observe failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml health::state_tests`

- [ ] **Step 3: Define outcomes and implement the reducer**

```rust
pub enum ProbeOutcome {
    Reachable { status: u16, elapsed_ms: u64 },
    PermanentMissing { status: u16, elapsed_ms: u64 },
    Failed { code: ProbeErrorCode, elapsed_ms: u64 },
}

pub fn apply_probe(
    current: &HealthSnapshot,
    outcome: &ProbeOutcome,
    checked_at: DateTime<Utc>,
    source: CheckSource,
) -> HealthPatch;
```

Use exhaustive matches. No branch reads manual status. Clamp elapsed time to SQLite integer range and serialize error codes, not messages.

- [ ] **Step 4: Add invariant/property tests**

For all generated sequences up to length 6, assert streak is 0–2, success ends available/streak 0/error NULL, 404/410 ends unavailable/streak 0, and timestamps never move backward when inputs are ordered.

- [ ] **Step 5: Run and commit**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml health::state_tests
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

Then:

```bash
git add src-tauri/src/health src-tauri/src/model.rs src-tauri/src/lib.rs
git commit -m "feat: add deterministic health state transitions"
```

### Task 13: Implement HTTP probing with redirects, fallback, timeout, and retry

**Files:**
- Create: `src-tauri/src/health/probe.rs`, `src-tauri/src/health/probe_tests.rs`
- Modify: `src-tauri/Cargo.toml`, `src-tauri/src/health/mod.rs`

**Interfaces:**
- Consumes: canonical HTTP(S) URL and `ProbeOptions { timeout, max_redirects: 5 }`.
- Produces: `HttpProbe::check(url, options, cancellation) -> ProbeOutcome`.

- [ ] **Step 1: Write failing local-server tests**

Use `wiremock` or a small local Hyper server. Cover HEAD 200, HEAD 404 then Range GET 200, final GET 404, 401/403/429 reachable, 304 reachable, 302 without Location reachable, valid redirect chain, sixth redirect failure, `file:` Location failure, 500 then 200 retry, timeout retry then failure, TLS/4xx no retry, and cancellation.

- [ ] **Step 2: Run tests and observe failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml health::probe_tests`

- [ ] **Step 3: Build a locked-down reqwest client**

Disable automatic redirects and do not enable cookie storage, default authorization headers, or response decompression that is unnecessary for header-only checks. Use rustls. Set a stable app User-Agent without unique device data. Validate each Location using `url_normalizer` before sending.

- [ ] **Step 4: Implement explicit request algorithm**

Run HEAD; on 400/403/404/405 issue GET with `Range: bytes=0-0`; never consume body bytes. Follow valid HTTP(S) Location up to five hops. Retry once only for timeout, temporary DNS, connection reset/refused, or 5xx; no retry for parse, TLS, unsafe redirect, or 4xx.

- [ ] **Step 5: Verify body non-consumption and cancellation**

The local server advertises a large streaming body and records disconnected clients. Assert probe returns after headers without buffering the stream. Cancel a delayed request and assert bounded completion before the configured timeout.

- [ ] **Step 6: Run checks and commit**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml health::probe_tests
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

Then:

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/health
git commit -m "feat: add safe asynchronous website probing"
```

### Task 14: Implement one-run coordination, disconnection gate, CAS writes, and persisted scheduler

**Files:**
- Create: `src-tauri/src/health/coordinator.rs`, `coordinator_tests.rs`
- Create: `src-tauri/src/health/scheduler.rs`, `scheduler_tests.rs`
- Create: `src-tauri/src/commands/health.rs`
- Modify: `src-tauri/src/db/catalog.rs`, `src-tauri/src/model.rs`, `src-tauri/src/lib.rs`
- Modify: bridge interfaces and implementations

**Interfaces:**
- Consumes: `HttpProbe`, `Database`, `MaintenanceGate`, scheduler row.
- Produces: `HealthCoordinator::{start,cancel,current}`, `Scheduler::{reconcile,set_interval,set_paused}`, events `health://progress` and `health://finished`.

- [ ] **Step 1: Write failing coordinator arbitration tests**

Assert one active run globally, second manual request returns `busy`, scheduled due while busy records `deferred_busy` and next due +15 minutes, each site appears once, cancellation stops unsent work, and the slot releases on success/error/cancel.

- [ ] **Step 2: Write failing disconnection gate tests**

Seed six recently successful distinct hostnames. Assert an injected offline network-interface state aborts before any sample request; otherwise the first five samples are held in memory, five transport failures abort and commit nothing, one HTTP response passes the gate and commits all five outcomes, fewer than five eligible sites bypasses only the global gate, and editable display-domain duplication does not affect hostname distinctness.

- [ ] **Step 3: Write failing revision CAS tests**

Start a delayed probe, then separately change URL, notes, tags, manual override, and imported health state. Each variation increments `row_revision` or `url_revision`; the old result must affect zero rows and emit `staleTarget: 1`. A result with unchanged captured revisions updates health and increments `row_revision` once.

- [ ] **Step 4: Implement the coordinator**

Use `tokio::sync::Semaphore` for configured per-run concurrency and `CancellationToken` for run cancellation. Capture `{ site_id, canonical_url, url_revision, row_revision }` before requests. Apply `HealthPatch` with an `UPDATE ... WHERE id=? AND normalized_url=? AND url_revision=? AND row_revision=?`; never retry a stale result.

- [ ] **Step 5: Write failing scheduler clock tests**

Inject `Clock`. Cover initial due time, one catch-up after restart, sleep across multiple intervals, normal completion and user cancellation recording `startedAt` while computing the next due time from completion, interval change, pause/resume from current time without immediate catch-up, manual run not changing due state, offline retry after `min(15m, interval)` without changing `lastScheduledRunAt`, busy defer, system clock backward/forward, and one-run maximum.

- [ ] **Step 6: Implement scheduler persistence and commands**

Store every scheduler transition in the one-row table. Use UTC persisted timestamps and a monotonic in-process wait; re-read after wake/time-change notification. Commands expose run all/selected/one, cancel, current progress, interval, and pause.

- [ ] **Step 7: Extend bridge events and mock clock**

Add typed `HealthRun`, `HealthProgress`, `SchedulerSettings`, and unsubscribe-returning event methods. The mock uses an injected clock and deterministic probe outcomes; tests never call public internet.

- [ ] **Step 8: Run all health checks and commit**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml health
pnpm vitest run src/infrastructure/bridge/MockNativeBridge.test.ts
pnpm typecheck
```

Then:

```bash
git add src-tauri/src/health src-tauri/src/commands/health.rs src-tauri/src/db/catalog.rs src-tauri/src/model.rs src-tauri/src/lib.rs src/infrastructure/bridge
git commit -m "feat: coordinate and schedule health checks"
```

### Task 15: Add health progress UI, settings, tray lifecycle, and safe exit

**Files:**
- Create: `src/features/health/HealthProgress.tsx`, `HealthProgress.test.tsx`
- Create: `src/features/settings/SettingsDialog.tsx`, `SettingsDialog.test.tsx`
- Create: `src-tauri/src/desktop/tray.rs`, `tray_tests.rs`
- Create: `src-tauri/src/db/settings.rs`, `settings_tests.rs`
- Create: `src-tauri/src/diagnostics.rs`, `diagnostics_tests.rs`
- Create: `src-tauri/src/commands/settings.rs`, `src-tauri/src/commands/diagnostics.rs`
- Modify: `src/features/workspace/Workspace.tsx`, `src/features/sites/BatchToolbar.tsx`
- Modify: `src-tauri/src/desktop/mod.rs`, `src-tauri/src/lib.rs`, `src-tauri/tauri.conf.json`
- Modify: bridge interfaces and implementations

**Interfaces:**
- Consumes: health commands/events, scheduler settings, main window handle.
- Produces: top progress bar, cancel behavior, settings dialog, validated settings persistence, tray menu `show/check/pause/quit`, close-to-tray behavior, bounded safe exit, and an open-log-directory diagnostic action.

```ts
export interface AppSettings {
  version: 1;
  checkIntervalHours: 1 | 3 | 6 | 12 | 24;
  requestTimeoutSeconds: number;
  maxConcurrency: number;
  defaultSortBy: SiteQuery["sortBy"];
  defaultSortDirection: SiteQuery["sortDirection"];
  closeBehavior: "hideToTray" | "quit";
  visualEffectsEnabled: boolean;
  reduceMotion: boolean;
  automaticSnapshotsEnabled: boolean;
  snapshotRetention: number;
}
```

The canonical defaults are interval 6 hours, timeout 10 seconds, concurrency 5, sort `updatedAt desc`, close `hideToTray`, visual effects on, app-level reduced motion off, automatic snapshots on, and retention 7.

- [ ] **Step 1: Write failing health progress tests**

Assert manual run start, busy state focusing existing run, progress counts, cancel stopping only remaining work, stale-target summary, offline “未更新结果” banner, and list query invalidation after finished results.

- [ ] **Step 2: Write failing settings tests**

Validate allowed intervals 1/3/6/12/24 hours, timeout 3–60 seconds, concurrency 1–20, retention 1–30, pause, default sort, close behavior, automatic-snapshot enablement, visual-effects enablement, reduced motion, and successful persistence/reload. Invalid values never invoke the bridge. Rust tests load defaults from an empty table, round-trip versioned JSON, reject an unknown settings version, and reject invalid values even when the frontend is bypassed.

- [ ] **Step 3: Implement frontend health/settings flow**

Subscribe once in an effect and always unsubscribe. Disable all start buttons during an active run. Persist settings only through one validated command returning the canonical saved object. On initial load, initialize a workspace that has no user-chosen sort from the saved default; do not overwrite an active query when settings are edited. `hideToTray` intercepts window close and `quit` invokes the same bounded `ShutdownCoordinator` as the tray quit item. Render manual override separately from automatic status and last result.

- [ ] **Step 4: Write failing tray lifecycle tests around a tray controller trait**

With `closeBehavior = hideToTray`, assert window close prevents process exit and hides once, first close presents one explanatory native dialog before hiding and persists its acknowledgement, later closes hide without prompting, and a hidden/minimized window pauses only visual rendering while the scheduler remains active. With `closeBehavior = quit`, assert the same bounded shutdown path runs. Also assert show focuses the existing window, pause toggles scheduler, check-all respects busy coordinator, and tray quit cancels scheduler/network tasks before database close.

- [ ] **Step 5: Implement tray and shutdown ordering**

Create one tray icon with menu labels “显示 DOMAIN.”, “检测全部”, “暂停/恢复定时检测”, separator, and “退出”. A `ShutdownCoordinator` performs: mark shutting down, stop scheduler, cancel health run, await tasks, enter database draining/exclusive, checkpoint WAL, close connection, remove tray, exit process. Repeated quit is idempotent.

- [ ] **Step 6: Write failing diagnostics tests, then implement redacted logs and log-folder access**

First add tests that serialize every event variant and assert fixture secrets, URL credentials, notes, CSV cells, and HTTP bodies are absent; run `cargo test --manifest-path src-tauri/Cargo.toml diagnostics` and observe failure because the diagnostic boundary is missing. Then define a closed `DiagnosticEvent` enum whose payloads accept only stable error codes, operation names, counts, elapsed milliseconds, run/session IDs, and booleans. Do not provide any free-form payload field that could receive notes, imported cell contents, response bodies, credentials, full URLs, or low-level network stacks. Configure the Tauri log sink under the platform app-log directory with a 2 MiB rotation threshold; on startup retain the active file plus the five newest recognized rotated files and ignore unrelated files.

Expose `get_diagnostics_status()` with `logDirectory`, `webGpuState`, and the last stable visual error code, plus `open_log_directory()` that resolves the application-owned log directory in Rust and opens only that directory through the system opener. The settings page shows diagnostics without exposing file contents and offers “打开日志目录”.

- [ ] **Step 7: Run frontend/Rust checks and a local Tauri smoke**

Run:

```bash
pnpm vitest run src/features/health src/features/settings
cargo test --manifest-path src-tauri/Cargo.toml desktop::tray health db::settings diagnostics
pnpm typecheck
pnpm tauri dev
```

In the smoke, verify close hides to tray, show restores, and explicit quit terminates. Do not claim Windows behavior from this macOS smoke; Windows is Task 23.

- [ ] **Step 8: Commit tray runtime**

```bash
git add src/features/health src/features/settings src/features/workspace/Workspace.tsx src/features/sites/BatchToolbar.tsx src/infrastructure/bridge src-tauri
git commit -m "feat: add health ui settings and tray runtime"
```

## Phase D — Import, Export, and Data Portability

### Task 16: Freeze JSON exchange and backup-manifest schemas

**Files:**
- Create: `schemas/export-v1.schema.json`, `schemas/backup-manifest-v1.schema.json`
- Create: `tests/fixtures/export-v1/valid.json`, `minimal.json`
- Create: `tests/fixtures/export-v1/invalid-kind.json`, `future-version.json`, `unsupported-old-version.json`
- Create: `tests/fixtures/export-v1/invalid-uuid.json`, `invalid-time.json`, `invalid-color.json`, `invalid-extra-property.json`
- Create: `tests/fixtures/export-v1/invalid-dangling-category.json`, `invalid-dangling-tag.json`, `invalid-available-without-success.json`, `invalid-failure-streak.json`, `invalid-concurrency-field.json`
- Create: `tests/fixtures/backup-v1/manifest-valid.json`, `manifest-invalid-kind.json`, `manifest-future-version.json`, `manifest-unsupported-old-version.json`
- Create: `tests/fixtures/backup-v1/manifest-invalid-hash.json`, `manifest-invalid-database-file.json`, `manifest-extra-property.json`
- Create: `src-tauri/src/transfer/mod.rs`, `src-tauri/src/transfer/schema.rs`, `schema_tests.rs`
- Modify: `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: spec §§12.1 and 13.1.
- Produces: exact v1 JSON Schemas; `validate_export_json(value) -> ValidatedExport`; `validate_manifest(value) -> BackupManifest`.

- [ ] **Step 1: Write the fixture set before the validator**

The valid full fixture contains one used category, one unused category under `scope=all`, one tag, two sites, every nullable combination, and millisecond-Z timestamps. The minimal fixture matches the spec example. Invalid export fixtures isolate one failure each: wrong kind, future version, unsupported version 0, malformed UUID, non-Z time, dangling category, dangling tag, `available` without `last_success_at`, failure streak 3, invalid color, unexpected property, and forbidden concurrency field. Invalid manifest fixtures isolate wrong kind, future/old version, wrong SHA-256, non-fixed `database_file`, and unexpected property.

- [ ] **Step 2: Write failing schema tests**

Iterate `export-v1/valid.json`, `minimal.json`, and `backup-v1/manifest-valid.json` expecting success. Iterate every other explicitly listed fixture expecting `validation` plus a JSON pointer and a stable reason code. Verify both snake-case exported concurrency fields `url_revision` and `row_revision` are rejected as additional properties.

- [ ] **Step 3: Run and observe failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml transfer::schema_tests`

- [ ] **Step 4: Author exact schemas and semantic validation**

Use JSON Schema draft 2020-12, `additionalProperties: false`, explicit required arrays/fields, enum values, UUID/time/color patterns, numeric bounds, and conditional rules. Schema validation handles shape; Rust semantic validation recomputes URL/name keys, emits preview warnings (not errors) when imported derived keys differ, rejects relation gaps, and enforces `last_checked_at`/`last_success_at` state invariants. All later matching uses the recomputed values.

- [ ] **Step 5: Add a schema drift test against Rust DTO serialization**

Serialize a fully populated Rust export DTO and validate it. Deserialize it back and assert equality of all portable fields. This test prevents a renamed Rust field from silently escaping the schema.

- [ ] **Step 6: Run checks and commit**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml transfer::schema_tests
git diff --check
```

Then:

```bash
git add schemas tests/fixtures/export-v1 tests/fixtures/backup-v1 src-tauri
git commit -m "feat: define versioned data exchange schemas"
```

### Task 17: Implement streaming JSON/CSV parsing and field mapping sessions

**Files:**
- Create: `src-tauri/src/transfer/csv.rs`, `csv_tests.rs`
- Create: `src-tauri/src/transfer/session.rs`, `session_tests.rs`
- Create: `src/domain/import.ts`, `src/domain/import.test.ts`
- Create: `src-tauri/src/commands/transfer.rs`
- Modify: bridge interfaces and implementations

**Interfaces:**
- Consumes: user-selected file path, kind, CSV mapping.
- Produces: `open_import_session`, `set_import_mapping`, `get_import_preview_page`, `close_import_session`; opaque UUID session; 100 MiB/100k-row limits.

- [ ] **Step 1: Write failing CSV codec tests**

Cover UTF-8 BOM, quoted comma/newline, Chinese headers, English aliases, tags `a;b`, escaped semicolon `a\;b`, escaped backslash `a\\b`, malformed escape, missing/blank URL, invalid time/status, ignored `effective_status`, explicit empty mapped cells, and row/file limit errors. Export tests assert formula protection prefixes exactly one apostrophe for cells beginning with `=`, `+`, `-`, `@`, tab, or carriage return; re-import retains that apostrophe as text and never executes or strips it.

- [ ] **Step 2: Run CSV tests and observe failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml transfer::csv_tests`

- [ ] **Step 3: Implement streaming CSV codec**

Use the Rust `csv` crate with BOM handling. Parse tags with one explicit state machine: backslash escapes only backslash or semicolon; a trailing backslash is invalid. Never load the raw 100 MiB file into a single string. Record row number and stable validation code.

- [ ] **Step 4: Write failing session tests**

Assert native dialog path flows into one session ID, only metadata/page summaries cross IPC, sessions expire after 30 idle minutes, close releases memory/temp files, mapping changes recompute preview, and file size/row limits stop parsing without database mutation.

- [ ] **Step 5: Implement bounded import sessions**

The Rust service owns parsed rows and paged preview state in a mutexed map keyed by UUID. JSON is schema-validated on open. CSV open returns detected headers; mapping is validated against known fields. Session content stores normalized staged records, row issues, and internal duplicate groups, never the untrusted imported `normalized_url` as the matching key.

- [ ] **Step 6: Implement TS mapping model and bridge methods**

Define exact `ImportField`, `CsvMapping`, `ImportIssue`, `DuplicateGroup`, `ImportPreviewPage`, and decision union types. Pure tests assert duplicate destination mapping is rejected, URL is mandatory, unmapped fields preserve/default correctly, and empty mapped fields create explicit clears.

- [ ] **Step 7: Run cross-layer checks and commit**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml transfer::csv_tests transfer::session_tests
pnpm vitest run src/domain/import.test.ts src/infrastructure/bridge/MockNativeBridge.test.ts
pnpm typecheck
```

Then:

```bash
git add src-tauri/src/transfer src-tauri/src/commands/transfer.rs src/domain/import* src/infrastructure/bridge
git commit -m "feat: add bounded import parsing sessions"
```

### Task 18: Implement immutable import plans, CAS commit, JSON/CSV export, and transfer UI

**Files:**
- Create: `src-tauri/src/transfer/commit.rs`, `commit_tests.rs`
- Create: `src-tauri/src/transfer/export.rs`, `export_tests.rs`
- Create: `src/features/transfer/ImportWizard.tsx`, `ImportWizard.test.tsx`, `ImportWizard.module.css`
- Create: `src/features/transfer/ExportDialog.tsx`, `ExportDialog.test.tsx`
- Modify: `src/features/workspace/Sidebar.tsx`, `src/features/sites/BatchToolbar.tsx`
- Modify: bridge interfaces and implementations

**Interfaces:**
- Consumes: import session, mapping, per-group decisions, current database snapshot.
- Produces: immutable `StagingPlan`, `commit_import(plan_id) -> ImportSummary`, `export_data(request) -> path`, complete import/export UI.

- [ ] **Step 1: Write failing staging tests**

Cover zero/one/multiple preexisting matches, same-file duplicate grouping independent of row order, keep-one, skip, clone, selected source/target update, category/tag reuse by name key, `scope=all` unused taxonomies, subset relationship closure, and ID collision remapping.

- [ ] **Step 2: Write failing stale-preview tests**

After preview, mutate separately: target row revision, URL revision, matching-ID set, taxonomy mapping, and imported health state. Every commit must return `preview_stale`, insert/update zero rows, and leave taxonomies unchanged. A plan with no changes commits all rows in one transaction.

- [ ] **Step 3: Implement immutable plan generation and CAS commit**

Persist plans inside the import session, not in the main database. Each target records `{ id, normalized_url, url_revision, row_revision }`, each URL records the match-ID set, and taxonomy mappings record name key/target ID. At commit, acquire shared maintenance permit, begin one SQLite transaction, revalidate every precondition, then execute. Any affected-row count other than 1 aborts the whole transaction.

- [ ] **Step 4: Implement exact health-field matrix**

JSON new/update/clone and CSV new/update/clone follow spec §12.4. New/clone initializes concurrency revisions to 1; update preserves URL revision and increments row revision; different normalized URL cannot use update. Validate final health invariants after CSV mapped-field overlay.

- [ ] **Step 5: Implement lossless JSON and safe CSV export**

JSON uses relationship closure and schema validation before file write. CSV emits UTF-8 BOM, standard column order, tag escaping, and formula protection. Write to a temp sibling path, flush/sync, then atomic rename. Export all/filtered/selected reuses the workspace condition/order builder but streams every matching row without the UI's 200-row page limit; selected export validates every requested ID and preserves the stable query order.

- [ ] **Step 6: Write failing wizard/dialog tests**

Test file selection, CSV mapping, paged errors, duplicate decisions, stale-preview return to preview, transaction summary counts, cancel closing session, JSON/CSV scope choices, selected export from batch toolbar, and permission/path failure preserving UI state.

- [ ] **Step 7: Implement accessible transfer UI**

Use a five-step wizard: file, mapping, preview, conflicts, commit. Prevent advancing while required decisions are missing. Show row numbers and stable issues; do not render 100k rows at once. Export dialog defaults to current scope and displays destination only after successful atomic write.

- [ ] **Step 8: Run complete transfer checks and commit**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml transfer
pnpm vitest run src/features/transfer src/domain/import.test.ts
pnpm typecheck
```

Then:

```bash
git add src-tauri/src/transfer src/features/transfer src/features/workspace/Sidebar.tsx src/features/sites/BatchToolbar.tsx src/infrastructure/bridge
git commit -m "feat: add transactional import and export workflows"
```

## Phase E — Backup, Recovery, and Visual Resilience

### Task 19: Implement verified backup archives, manual snapshots, and rolling automatic snapshots

**Files:**
- Create: `src-tauri/src/backup/mod.rs`, `archive.rs`, `archive_tests.rs`
- Create: `src-tauri/src/backup/snapshot.rs`, `snapshot_tests.rs`
- Create: `src-tauri/src/commands/backup.rs`
- Create: `src/features/backup/BackupRestore.tsx`, `BackupRestore.test.tsx`, `BackupRestore.module.css`
- Modify: `src-tauri/src/db/catalog.rs`, `src-tauri/src/db/settings.rs`
- Modify: `src-tauri/src/health/coordinator.rs`, `src-tauri/src/health/scheduler.rs`
- Modify: `src-tauri/src/transfer/commit.rs`
- Modify: `src/features/workspace/Sidebar.tsx`, `src/features/settings/SettingsDialog.tsx`
- Modify: bridge interfaces and implementations

**Interfaces:**
- Consumes: database connection, maintenance shared permit, backup manifest schema, app data directory.
- Produces: `create_backup(destination)`, `list_auto_snapshots`, `create_auto_snapshot_if_due`, `delete_snapshot`; `.domain-backup` with exactly `manifest.json` and `data.sqlite3`.

- [ ] **Step 1: Write failing archive security tests**

Cover valid archive, wrong kind/version, extra entry, nested path, `../`, absolute path, symlink entry, duplicate allowed filename, wrong declared size, wrong SHA-256, malformed lowercase hash, compressed file over 512 MiB declaration, streamed bytes exceeding 512 MiB, and damaged SQLite integrity.

- [ ] **Step 2: Run archive tests and observe failure**

Run: `cargo test --manifest-path src-tauri/Cargo.toml backup::archive_tests`

- [ ] **Step 3: Implement strict archive writer/reader**

Write `data.sqlite3` first into a temp archive, compute SHA-256 and exact byte count while streaming, then write schema-valid manifest. Reader allows exactly two root regular files and checks central-directory metadata before extraction; extract only into a fresh `tempfile::TempDir`; compare actual count/hash before opening SQLite.

- [ ] **Step 4: Write failing snapshot consistency tests**

Start with WAL writes, create snapshot through SQLite backup API, then assert `PRAGMA integrity_check = ok`, expected rows/relations/settings are present, and the live connection remains usable. Simulate disk full/write error and assert no final destination file appears.

- [ ] **Step 5: Implement consistent snapshots and atomic publish**

Acquire a maintenance shared permit, execute `PRAGMA wal_checkpoint(PASSIVE)`, use `rusqlite::backup` into a sibling temporary SQLite file, validate it, package it, call `sync_all` on the completed archive and its parent directory where the platform supports directory syncing, then atomically rename. Never copy the live database with a raw filesystem copy.

- [ ] **Step 6: Write failing automatic-snapshot state and retention tests**

With an injected local-date clock, assert each site/taxonomy/health/settings/scheduler/import mutation increments `changeSerial`, snapshot bookkeeping does not, unchanged data produces no automatic archive, multiple changes on one date produce at most one archive, a post-snapshot change is captured on the next date, restart preserves due state, and retention deletes only recognized oldest archives. Add a race test where data changes after the SQLite copy but before archive publication; assert `lastSnapshottedChangeSerial` records the captured serial rather than the newer current serial.

- [ ] **Step 7: Implement automatic retention**

Persist versioned snapshot state in `app_settings` as `{ changeSerial, lastSnapshottedChangeSerial, lastSnapshotLocalDate }`. Every committed mutation of sites, taxonomies, health, user-editable settings, scheduler state, or import data increments `changeSerial` in the same transaction; updating the snapshot bookkeeping fields themselves does not. On startup and after mutation commit, request one coalesced snapshot job; it runs only when the serial differs and no automatic snapshot has already been published for the current local calendar date. After atomic publication, copy the captured serial into `lastSnapshottedChangeSerial` and update the date in one bookkeeping-only transaction. Store files under `<Tauri app_data_dir>/snapshots/` with the exact recognized name pattern `auto-YYYYMMDDTHHMMSSmmmZ.domain-backup`, honor enabled/retention 1–30, sort by manifest creation time, and delete only matching files beyond retention.

- [ ] **Step 8: Write and implement backup UI tests**

Assert manual destination selection, successful file path, cancel no-op, automatic snapshot list, disabled setting, retention update, open-folder action, and I/O failure message. The UI must not label a cache copy as a backup.

- [ ] **Step 9: Run checks and commit**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml backup::archive_tests backup::snapshot_tests
pnpm vitest run src/features/backup src/features/settings
pnpm typecheck
```

Then:

```bash
git add src-tauri/src/backup src-tauri/src/commands/backup.rs src-tauri/src/db src-tauri/src/health src-tauri/src/transfer/commit.rs src/features/backup src/features/settings src/features/workspace/Sidebar.tsx src/infrastructure/bridge
git commit -m "feat: add verified local backup snapshots"
```

### Task 20: Implement deadlock-free exclusive restore with rollback and maintenance UI

**Files:**
- Create: `src-tauri/src/backup/restore.rs`, `restore_tests.rs`
- Modify: `src-tauri/src/db/gate.rs`, `src-tauri/src/db/tests.rs`
- Modify: `src-tauri/src/commands/backup.rs`, `src-tauri/src/health/coordinator.rs`, `src-tauri/src/health/scheduler.rs`
- Modify: `src/features/backup/BackupRestore.tsx`, `BackupRestore.test.tsx`
- Modify: bridge interfaces and implementations

**Interfaces:**
- Consumes: validated extracted archive, `MaintenanceGate`, database generation, health cancellation, scheduler.
- Produces: `restore_backup(path) -> RestoreSummary`; frontend maintenance event; guaranteed original/safety database recovery.

- [ ] **Step 1: Write failing maintenance-state tests**

Exercise `Open -> Draining -> Exclusive -> Open`. Hold one shared transaction, queue a health result acquisition, start restore, and assert queued/new acquisitions fail immediately with `maintenance`, existing holder may finish, health task exits, and exclusive acquisition completes without deadlock.

- [ ] **Step 2: Write failing concurrent restore tests**

Run restore while each of these is active: CRUD transaction, import transaction, export read, auto snapshot, HTTP request before result permit, and result write already holding a permit. Assert drain order, no lost committed write before safety snapshot, no write to replacement DB from old generation, and one active restore maximum.

- [ ] **Step 3: Write failing rollback tests**

Inject failure before replacement, after original rename, after replacement install, during migration, and during reopen. Before replacement, original path/content stays untouched. After replacement, the safety snapshot restores the exact pre-restore state. Gate returns Open only with a usable connection. On both success and completed rollback, assert the operation-owned safety database, extracted archive directory, and guarded replacement temp path are removed.

- [ ] **Step 4: Implement the restore sequence exactly**

Perform: archive/schema/integrity validation; reject newer schema; set gate Draining; cancel queued permits and health/scheduler; await network/result and existing shared holders; enter Exclusive; increment generation; create and validate an operation-owned safety database inside a fresh `TempDir`; close connection; rename original to a same-directory guarded temp; install restored DB; run forward migrations; reopen; reload scheduler/UI state; return Open. On any failure, use the branch-specific rollback tested above. After verified success or completed rollback, remove all operation-owned temporary artifacts; the safety copy is not presented as a user backup.

- [ ] **Step 5: Add stale-generation guards to every async writer**

Health results, import commit, and automatic snapshot completion carry the generation captured before asynchronous work. Before final write/publish, compare current generation. A mismatch returns `maintenance`/stale outcome and removes temp output.

- [ ] **Step 6: Implement maintenance UI behavior**

Restore requires file choice, manifest summary, destructive confirmation, and notice that a temporary safety copy protects the operation but is cleaned after verified completion. During maintenance, disable CRUD/detect/import/export/backup, preserve the visible list, show one modal progress state, and reload all caches only after success. Failure text states whether original data was restored.

- [ ] **Step 7: Run recovery checks and commit**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml backup::restore_tests db::tests health::coordinator_tests
pnpm vitest run src/features/backup
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

Then:

```bash
git add src-tauri/src/backup/restore.rs src-tauri/src/backup/restore_tests.rs src-tauri/src/db src-tauri/src/commands/backup.rs src-tauri/src/health src/features/backup src/infrastructure/bridge
git commit -m "feat: add atomic backup recovery"
```

### Task 21: Add the vgpu ambient layer with pause, device-loss, and CSS fallback

**Files:**
- Create: `src/visual/ambient.wgsl`
- Create: `src/visual/AmbientCanvas.tsx`, `AmbientCanvas.test.tsx`
- Create: `src/visual/AmbientCanvas.module.css`
- Create: `src/visual/gpu-driver.ts`, `fake-gpu-driver.ts`
- Modify: `src/app/App.tsx`, `src/app/styles/global.css`, `vite.config.ts`
- Modify: `src/features/settings/SettingsDialog.tsx`
- Modify: `src/infrastructure/bridge/{NativeBridge,TauriNativeBridge,MockNativeBridge}.ts`
- Modify: `src-tauri/src/diagnostics.rs`, `src-tauri/src/commands/diagnostics.rs`

**Interfaces:**
- Consumes: `visualEffectsEnabled`, `prefers-reduced-motion`, document/window visibility.
- Produces: decorative `aria-hidden` Canvas; `GpuDriver.start(canvas) -> Promise<GpuSession>`; CSS fallback class; no business dependency.

```ts
export interface GpuSession {
  setPaused(paused: boolean): void;
  dispose(): void;
}

export interface GpuDriver {
  start(canvas: HTMLCanvasElement): Promise<GpuSession>;
}
```

- [ ] **Step 1: Read the installed vgpu docs and confirm the CLI surface**

Run after dependencies are installed:

```bash
pnpm exec vgpu docs cat getting-started.md
pnpm exec vgpu --help
```

Record no copied example assets; the implementation uses only the installed public API and the project-owned shader.

- [ ] **Step 2: Write failing lifecycle tests against a fake driver**

Assert start only when enabled, Canvas is `aria-hidden` and pointer-events none, reduced motion prevents start, hidden/minimized state pauses, visible resumes, unmount disposes, initialization failure adds CSS fallback, and device-loss falls back once without toast spam.

- [ ] **Step 3: Run focused test and observe failure**

Run: `pnpm vitest run src/visual/AmbientCanvas.test.tsx`

- [ ] **Step 4: Implement the driver boundary and shader**

Import `ambient.wgsl?raw` through Vite and pass the resulting string to vgpu. The real driver uses vgpu `init`, `surface`, `effect`, `clock`, and `frameLoop` behind the interface above. Clamp DPR to `[1, 2]`. The WGSL fragment combines two low-amplitude blue-gray gradients and deterministic grain; output alpha remains low enough that surfaces/text retain spec contrast. Keep mutable time as the only per-frame uniform. The adapter owns all vgpu handles created by `start`; `dispose` is idempotent and releases or detaches each owned handle exactly once.

- [ ] **Step 5: Implement pause/fallback integration**

Listen to `visibilitychange`, reduced-motion media changes, and the Tauri window focus/visibility event exposed through the bridge. `setPaused(true)` makes the frame callback return before updating uniforms or drawing; `setPaused(false)` resumes the same session. If the installed vgpu version exposes a cancellable frame-loop handle, `dispose` cancels it; otherwise the callback observes an internal `disposed` flag and returns without GPU work. Catch initialization or device-loss errors at the visual boundary, dispose once, apply the static CSS background, and call `recordVisualDiagnostic(code)` exactly once with `webgpu_unavailable`, `webgpu_init_failed`, or `webgpu_device_lost`. The Rust command accepts only that closed enum, updates diagnostics state, and writes the corresponding redacted event.

- [ ] **Step 6: Run shader, UI, and no-WebGPU checks**

Run:

```bash
pnpm exec vgpu check src/visual/ambient.wgsl
pnpm vitest run src/visual/AmbientCanvas.test.tsx src/app/App.test.tsx
pnpm typecheck
pnpm build
```

Also launch once with `navigator.gpu` stubbed unavailable in the browser test; workspace CRUD controls must render.

- [ ] **Step 7: Commit visual enhancement**

```bash
git add src/visual src/app src/features/settings/SettingsDialog.tsx src/infrastructure/bridge src-tauri/src/diagnostics.rs src-tauri/src/commands/diagnostics.rs vite.config.ts
git commit -m "feat: add resilient vgpu ambient visuals"
```

## Phase F — Whole-Product Verification and Distribution

### Task 22: Add browser end-to-end flows and deterministic performance gates

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/catalog.spec.ts`, `health.spec.ts`, `transfer.spec.ts`, `recovery.spec.ts`, `accessibility.spec.ts`
- Create: `tests/e2e/fixtures.ts`
- Create: `tests/perf/workspace.spec.ts`, `tests/perf/data.ts`
- Create: `src-tauri/tests/query_performance.rs`
- Modify: `src/main.tsx`, `src/infrastructure/bridge/MockNativeBridge.ts`, `package.json`

**Interfaces:**
- Consumes: complete frontend against mock bridge.
- Produces: reproducible browser acceptance suite, a release-mode SQLite query gate, and 10k performance report artifacts.

- [ ] **Step 1: Add explicit mock-app bootstrap**

Only when Vite receives `VITE_NATIVE_BRIDGE=mock` in development/test builds, inject `MockNativeBridge` seeded from a deterministic URL parameter. Production builds must tree-shake or reject this path. Add a build test asserting the production bundle does not contain fixture site names.

- [ ] **Step 2: Write catalog E2E flow**

Create site, edit URL with reset confirmation, classify/tag, search, select multiple tags, sort, pin, batch tag, multi-open confirmation, delete, undo, and reload. Assert visible state and mock bridge call log at each boundary.

- [ ] **Step 3: Write health E2E flow**

Start all, see progress, receive mixed states, set/clear manual override, cancel remaining, test busy run, offline abort preserving old state, tray-mode simulated visibility pause, and settings persistence.

- [ ] **Step 4: Write transfer/recovery E2E flow**

CSV mapping with invalid rows, same-file duplicate decisions, stale preview, successful atomic summary, selected JSON export, backup list, restore maintenance disablement, successful reload, and rollback error text.

- [ ] **Step 5: Write accessibility flow**

Keyboard-only create/edit/filter/delete/restore navigation; visible focus; dialog focus trap/return; status text independent of color; reduced-motion disabling vgpu. Run `AxeBuilder` on workspace, editor, taxonomy, transfer, backup, and settings states; assert no serious or critical violations and add no rule exclusions.

- [ ] **Step 6: Add 10k performance measurement**

Generate the same fixed-seed 10,000-site dataset in Rust and TypeScript. In `query_performance.rs`, create a temporary production-schema SQLite database, run 5 warmups then 50 release-mode keyword+category+two-tag+status queries through `CatalogRepository`, sort raw elapsed samples, and assert p95 is below 100 ms. Emit one JSON report containing seed, CPU, memory, OS, Rust version, database version, all 50 samples, and p95. In Playwright, drive 5 seconds of table scrolling, collect frame intervals, assert 95% are at or below 20 ms, assert rendered row DOM count stays below 100, and emit the same environment metadata plus WebView/browser version and raw frame samples.

- [ ] **Step 7: Run all browser gates**

Run:

```bash
pnpm exec playwright install chromium
pnpm test:e2e
pnpm exec playwright test tests/perf/workspace.spec.ts --project=chromium
cargo test --release --manifest-path src-tauri/Cargo.toml --test query_performance -- --ignored --nocapture
```

Expected: all functional specs pass; performance report records hardware/OS/browser and raw samples.

- [ ] **Step 8: Commit E2E and performance suites**

```bash
git add playwright.config.ts tests/e2e tests/perf src-tauri/tests/query_performance.rs src/main.tsx src/infrastructure/bridge/MockNativeBridge.ts package.json pnpm-lock.yaml
git commit -m "test: add end-to-end and performance coverage"
```

### Task 23: Add CI, unsigned platform bundles, documentation, and final acceptance evidence

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `README.md`, `docs/development.md`, `docs/testing/manual-smoke.md`
- Create: `docs/testing/release-evidence.md`
- Create: `assets/app-icon.svg`, `src-tauri/icons/`
- Modify: `src-tauri/tauri.conf.json`, `package.json`, `.gitignore`

**Interfaces:**
- Consumes: all application code and tests.
- Produces: macOS and Windows CI artifacts, repeatable developer setup, explicit manual platform results, final clean verification command set.

- [ ] **Step 1: Write the CI matrix before claiming portability**

Use separate `ubuntu-24.04` quality, `macos-14` bundle/performance, and `windows-2022` bundle/performance jobs. Pin action major versions, enable pnpm/Cargo caches, install locked dependencies, and upload unsigned bundles plus raw performance JSON. Quality runs schemas, frontend tests/build/typecheck, Rust fmt/clippy/tests, and Playwright Chromium functional tests. Both platform jobs run the release SQLite performance test and Playwright scroll measurement before packaging.

- [ ] **Step 2: Configure platform bundles**

Set macOS bundle targets `app,dmg` and Windows target `nsis`. Create one simple project-owned `assets/app-icon.svg` using the `D.` monogram and confirmed blue-gray palette, then generate and commit the required `.icns`, `.ico`, and PNG sizes with `pnpm tauri icon assets/app-icon.svg`. Do not invent signing identities or disable OS security checks.

The macOS job runs `pnpm tauri build --bundles app,dmg`; the Windows job runs `pnpm tauri build --bundles nsis`. Each job fails if its expected bundle path is absent before artifact upload.

- [ ] **Step 3: Write developer and data-location documentation**

Document prerequisites, `corepack enable`, `pnpm install --frozen-lockfile`, Rust stable, dev/test/build commands, local data/log/snapshot locations by platform, backup extension, WebView2 requirement on Windows, no-cloud privacy boundary, and unsigned-build warning.

- [ ] **Step 4: Create the manual smoke checklist**

The checklist has one macOS and one Windows column for: install, first launch, CRUD, Chinese path import/export, system browser, tray hide/show, minimized schedule, pause/resume, explicit quit, no-WebGPU fallback, backup, restore, rollback, and uninstall preserving/removing data behavior. Each row records date, OS version, WebView version, result, and evidence path.

- [ ] **Step 5: Run the full local verification suite**

Run fresh:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm exec playwright test tests/perf/workspace.spec.ts --project=chromium
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
cargo test --release --manifest-path src-tauri/Cargo.toml --test query_performance -- --ignored --nocapture
pnpm tauri build --bundles app,dmg
git diff --check
git status --short
```

Expected: every verification command exits 0. Before the Task 23 commit, `git status --short` contains only the Task 23 documentation, workflow, configuration, and icon files listed above; after Step 8 and the Final Execution Gate it is empty.

- [ ] **Step 6: Run/collect Windows CI and both manual smokes**

Do not mark cross-platform acceptance complete until the Windows build job passes and `docs/testing/manual-smoke.md` contains completed evidence for both operating systems. If Windows hardware is unavailable, report that exact remaining gate instead of substituting a macOS result.

- [ ] **Step 7: Record final requirement mapping**

In `docs/testing/release-evidence.md`, map each of spec §18’s 12 acceptance items to test command, test name, CI run/artifact, or manual-smoke row. Include performance machine details and known unsigned-distribution limitation.

- [ ] **Step 8: Commit delivery infrastructure**

```bash
git add .github README.md docs/development.md docs/testing src-tauri/tauri.conf.json src-tauri/icons package.json .gitignore
git commit -m "chore: add cross-platform delivery verification"
```

## Specification Coverage Matrix

This table is the implementation-time coverage check. A row is complete only when the named task tests and its final Task 23 evidence both exist.

| Spec requirement | Owning tasks | Required evidence |
| --- | --- | --- |
| §18.1 website/category/tag CRUD | 4–6, 8, 10–11 | Rust repository transactions, bridge parity tests, editor/taxonomy UI tests, catalog E2E |
| §18.2 combined query/sort/pin behavior | 7, 9, 11, 22 | deterministic SQLite query tests, query-model tests, workspace E2E, 10k query measurements |
| §18.3 batch detect/taxonomy/export/delete | 11, 14–15, 18, 22 | rollback tests, toolbar tests, health arbitration tests, batch E2E |
| §18.4 HTTP(S)-only system-browser opening | 3, 11, 22–23 | shared URL vectors, Rust opener tests, multi-open E2E, macOS/Windows manual smoke |
| §18.5 manual/scheduled health semantics | 6, 10, 12–15, 22 | state-table tests, local-server probe tests, disconnect/CAS/scheduler tests, health E2E |
| §18.6 tray lifetime and explicit exit | 14–15, 23 | tray-controller tests plus macOS and Windows close/show/scheduled-run/quit smoke rows |
| §18.7 preview-only and atomic import | 16–18, 22 | schema fixtures, session tests, staging/CAS rollback tests, transfer E2E |
| §18.8 schemas/examples/version fixtures | 16, 18, 23 | both committed schemas, valid/minimal/isolated-invalid fixtures, CI schema-validation output |
| §18.9 safe backup/restore/rollback | 19–20, 22–23 | archive attack fixtures, snapshot integrity tests, failure-injection restore tests, platform smoke |
| §18.10 10,000-record targets | 7, 9, 22–23 | 50-run query p95 report and bounded-DOM/5-second scroll frame report on both platforms |
| §18.11 no-WebGPU core-function fallback | 8, 21–23 | fake-driver lifecycle tests, no-`navigator.gpu` E2E, both platform smoke rows |
| §18.12 macOS and Windows acceptance | 23 | DMG and NSIS artifacts plus completed, dated manual-smoke evidence for both systems |
| §14 error handling and local observability | 2, 15, 21 | stable bridge error-code tests, diagnostic redaction tests, rolling-log retention test, settings log-folder action |
| §15 privacy and trust boundaries | 1, 3–4, 13, 16–20 | minimal capabilities, bound-SQL tests, HTTP body non-consumption, archive defenses, no telemetry |

## Final Execution Gate

After Task 23, run the complete Task 23 Step 5 suite again from a clean checkout or isolated worktree and inspect every exit code. Compare the implementation against every spec §18 item. Do not call the product complete while the Windows bundle/manual-smoke gate or any recorded acceptance item remains unresolved.
