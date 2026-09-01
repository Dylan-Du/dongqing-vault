# Task 3 Report: Safe URL normalization and external opening

## Summary

- Added 17 shared URL-normalization vectors covering canonical HTTP/HTTPS serialization, default ports, Unicode host/path encoding, root and non-root slash behavior, query-order preservation, credentials, unsafe schemes, malformed hosts, and empty input.
- Added TypeScript and Rust normalizers that conditionally add `https://`, canonicalize with the platform URL implementation, preserve non-root path/query/fragment data, and return the canonical URL plus hostname.
- Added stable URL error codes for empty, unsafe, credential-bearing, and invalid-host input in the Task 3 normalization boundary.
- Added a pure `UrlOpener` boundary that validates every input before opening any, deduplicates canonical strings while preserving order, and opens sequentially.
- Added the Tauri opener adapter and registered the `open_urls` command.
- Added the Rust `url` dependency and lockfile update.

## TDD Evidence

- Rust vector RED: `cargo test --manifest-path src-tauri/Cargo.toml url_normalizer::tests` failed with exit 101 because `AppError` and `normalize_url` did not exist.
- Rust vector GREEN: the same command passed 2 tests.
- Opener RED: `cargo test --manifest-path src-tauri/Cargo.toml desktop::opener` failed with exit 101 because `UrlOpener` and `open_urls_with` did not exist.
- Opener GREEN: the same command passed 4 tests, covering ordered safe opens, all-before-any validation for `file:` and credential URLs, and canonical deduplication.

## Final Verification

- `cargo test --manifest-path src-tauri/Cargo.toml` passed: 7 tests passed, 0 failed.
- `cargo check --manifest-path src-tauri/Cargo.toml` passed with exit 0.
- `CI=true pnpm typecheck` completed with exit 0 and no diagnostics.
- A Node 24 strip-types harness executed `src/domain/url-normalizer.ts` against all 17 shared JSON vectors and passed, including explicit HTTP/HTTPS and non-root slash distinction assertions.
- `CI=true pnpm vitest run src/domain/url-normalizer.test.ts` emitted no output for 60 seconds and was interrupted with exit 130. This is the same Vitest startup hang recorded in Task 2; no assertion failure was emitted.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` could not run because the active Rust toolchain does not have the `rustfmt` component installed. Rust sources were formatted manually and compile without warnings.

## Notes / Residual Risk

- The TypeScript assertions are covered by the committed Vitest suite and the successful direct 17-vector harness, but the Vitest runner itself remains unverified in this environment because of the existing silent startup hang.
- Task 3 keeps its fine-grained serializable `AppError` at the URL-normalization boundary instead of changing Task 2's shared bridge error contract outside this task's file scope.
