# Task 2 Report: Freeze cross-layer DTOs and injectable bridge

## Summary

- Added shared TypeScript site, taxonomy, and import DTO contracts.
- Added `effectiveStatus(site)` and `needsAttention(site)` per spec §8.2.
- Added typed `NativeBridge`, `TauriNativeBridge`, `MockNativeBridge`, and `BridgeContext`.
- Updated `AppProviders` to create one `QueryClient` and inject `TauriNativeBridge` by default, while allowing tests to pass a mock bridge.
- Added deterministic fixtures and bridge tests for keyword filtering, taxonomy/status/sort/pagination, summaries, Tauri snake_case invocation, and missing-provider errors.
- Added Rust DTO mirrors with `#[serde(rename_all = "camelCase")]`, stable `AppCommandErrorCode`, and a serialization test for `normalizedUrl`, `lastSuccessAt`, `urlRevision`, and `rowRevision`.
- Added direct `serde` and `serde_json` dependencies in `src-tauri/Cargo.toml`; Tauri does not re-export them, and Rust DTO derives/tests cannot compile without direct dependencies.

## TDD / Verification

- Red test written first in `src/infrastructure/bridge/MockNativeBridge.test.ts`.
- Initial required red command `pnpm vitest run src/infrastructure/bridge/MockNativeBridge.test.ts` did not reach test loading; `pnpm` entered install and was interrupted after more than 60 seconds with exit 130.
- `CI=true node_modules/.bin/vitest run src/infrastructure/bridge/MockNativeBridge.test.ts` also produced no output within 30 seconds and was interrupted with exit 130.
- `CI=true pnpm vitest run src/infrastructure/bridge/MockNativeBridge.test.ts` produced no output within 60 seconds and was interrupted with exit 130.
- `CI=true node_modules/.bin/tsc -b --pretty false` passed with exit 0.
- `CI=true pnpm typecheck` passed with exit 0.
- `source /Users/dongqing/.cargo/env && cargo test --manifest-path src-tauri/Cargo.toml model::tests` passed: 1 test passed.
- `source /Users/dongqing/.cargo/env && cargo check --manifest-path src-tauri/Cargo.toml` passed with exit 0.
- `rg -n "\\bany\\b" src/infrastructure/bridge src/domain src/test src-tauri/src` found no matches.

## Notes / Residual Risk

- Vitest remains unverified at runtime because the test runner starts silently and does not complete in the short windows requested for this handoff.
- `src-tauri/Cargo.toml` was modified even though it was not in the original file list, because Rust serde derives and serde_json tests require direct dependencies.

## Fix Round 1

- Updated mock keyword search to include associated taxonomy tag `name` and `nameKey` values via `this.tags` and each site's `tagIds`, using the same trim/case-insensitive matching as other keyword fields.
- Updated mock sorting so pinned rows always stay first, field comparisons obey `sortDirection`, tie-breaks are always `id` ascending, and status uses the planned rank `available -> unchecked -> unavailable`.
- Added deterministic tests covering associated tag `name` and `nameKey` keyword search, pinned-first plus `id ASC` tie-breaks, and status asc/desc ordering with pinned rows still first.

### Fix Round 1 Verification

- `CI=true node_modules/.bin/vitest run src/infrastructure/bridge/MockNativeBridge.test.ts` ended after about 31 seconds with exit 127 because `node` was not on PATH (`node_modules/.bin/vitest: line 53: exec: node: not found`).
- With the bundled Node runtime on PATH, the same Vitest command produced no output for about 55 seconds and was interrupted with exit 130; no assertion result was emitted.
- With the bundled Node runtime on PATH, `CI=true node_modules/.bin/tsc -b --pretty false --force` completed in about 30 seconds with exit 0 and no diagnostics.
