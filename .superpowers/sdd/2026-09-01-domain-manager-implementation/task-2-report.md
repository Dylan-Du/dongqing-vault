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
