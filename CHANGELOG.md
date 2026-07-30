# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Completed maintainer-accepted AI-assisted locale copy for the previously stubbed `zh-CN`, `vi-VN`, `ms-MY`, and `id-ID` app locales in kitchen-display, onboarding-app, and management-portal. The approved handoff is recorded in `docs/i18n/locale-approval-manifest.json`, and `pnpm run check:i18n-locales:strict` now confirms all target locales match the `zh-TW` leaf-key coverage.

### Changed

- Seat-number uniqueness migrations `migrations_fresh/0075` and `migrations/0092` reconcile pre-existing duplicate `(table_id, seat_number)` rows by retaining the newest usable row and deleting the others before creating the unique index. Operators should audit or back up duplicate occupied seats before rollout: a discarded duplicate can carry a distinct `current_order_id`, and that seat-to-order pointer cannot be recovered from the migration itself.

### Fixed

- `rateLimitMiddleware` no longer returns 500 instead of 429. Its KV counter was written with an `expirationTtl` derived from the remaining window, which drops under Cloudflare's 60-second floor a moment into any one-minute window and made the write throw. Every route on a sub-90-second window was affected — signed QR verification, realtime guest tokens, and the credits endpoints — and the limit never engaged, because each rejected write also failed to persist the count. TTLs are now clamped to the KV floor (the counter's own `resetTime` still bounds the window, so this only affects garbage collection), and a limiter failure now fails open with a warning rather than turning a KV hiccup into an outage of the endpoint it protects.

## [2.1.1] - 2026-04-14

### Added

- **Real integration test foundation (Phase 1):** backend can now exercise the full Hono pipeline against a real miniflare `D1Database` binding with real Drizzle SQL, so tests catch schema drift and driver divergence that the previous `MockDrizzle` proxy silently hid.
- `@makanmakan/database/testing` subpath now exports `createTestDatabase()`, which spins up a miniflare instance, runs every migration in `packages/database/migrations_fresh/` via `db.batch()`, and returns a `TestDatabase` with real Drizzle, `truncateAll()`, and `dispose()`.
- `createRealIntegrationTestApp()` composes the production `createApp(env)` factory with the new test database, in-memory Durable Object stubs, and a deterministic `issueTestJwt()` helper so every smoke test runs through the real middleware stack.
- `startTestApiServer()` wraps the real test app with `@hono/node-server` and listens on a random port, giving the forthcoming frontend integration suite a stable HTTP seam to target without touching production deployment infrastructure.
- Four reference smoke tests under `apps/api/src/__tests__/integration/*.real.integration.test.ts` cover the four Drizzle hazard areas — `timestamp_ms` round-trip (orders), JOINs (menu), auth + RBAC + scope (customer-orders), and aggregate SQL + pagination (discovery).
- `tests/.integration-allowlist.json` + `scripts/check-integration-allowlist.cjs` enforce a freeze on legacy "integration" tests: any new `*integration*.test.ts` file must either live at the canonical `apps/*/src/__tests__/integration/*.real.integration.test.ts` path or be explicitly added to the allowlist ledger. Wired into CI via `.github/workflows/test.yml` as a required step.

### Changed

- `apps/api/src/index.ts` refactored into an `apps/api/src/app-factory.ts` that exports a `createApp(env)` Hono factory. Production entry shrinks to ~80 lines that just instantiate the factory and keep the `scheduled` worker runtime handler. Behavior unchanged; enables test reuse.
- Legacy `apps/api/src/__tests__/integration/` renamed via `git mv` to `apps/api/src/__tests__/integration-legacy-mockdrizzle/` with a README warning. The 12 files inside are unit tests with mocked service/DB boundaries, not real integration tests, and they are now labeled as such. Similar renames in `apps/admin-dashboard` and `apps/kitchen-display` (`integration/` → `component-flows/`).
- 10 inline legacy "integration" tests across the workspace now carry a header comment explicitly documenting that they use `vi.mock()` on service/DB boundaries and do not verify Drizzle SQL or D1 parity.

### Fixed

- `createTestDatabase` retries up to 3 times on transient miniflare `fetch failed` errors during migration. Observed at ~5% rate under serial file execution on macOS; the retry caught both flakes seen during the 20× flake check without polluting the test output.
- Vitest real-integration config runs files serially (`fileParallelism: false`, `maxWorkers: 1`) so parallel miniflare boots don't collide on workerd IPC.

### Production bugs surfaced (documented in smoke tests, not fixed)

Three real production bugs were found by the new smokes and are captured in the test assertions:

1. `GET /api/v1/orders/:id` serializes Drizzle's `Date` through `JSON.stringify`, producing an ISO-8601 string on the wire instead of the Unix-ms integer that `timestamp_ms` mode represents internally. Captured in `orders.real.integration.test.ts:111` with a type-tolerant assertion so a future fix won't regress the smoke.
2. `GET /api/v1/customers/me/orders` is permanently unreachable. `authMiddleware` rejects every token with `role > 4` at the global `apiV1.use("/customers/*", authMiddleware)` layer, and the per-route `requireRole([5])` rejects everything else. No valid role can call the endpoint. Captured in `customer-orders.real.integration.test.ts:48`.
3. `DiscoveryService.ts:176` returns `total: results.length` (the page slice size) instead of a SQL `COUNT(*)` over all matching rows. Clients cannot determine total page count. Captured in `discovery.real.integration.test.ts`.

## [2.1.0] - 2026-04-13

### Added

- Full multi-language support for three previously Chinese-only apps: kitchen-display, onboarding-app, and management-portal. All user-facing strings across 32 kitchen-display components, 5 onboarding-app views, and 9 management-portal views now render through the i18n system.
- Six languages available in every frontend app: Traditional Chinese (zh-TW, complete), English (en-US, complete), plus Simplified Chinese, Vietnamese, Malay, and Indonesian stubs that gracefully fall back to zh-TW until translations land.
- LanguageSwitcher UI in each app's header/sidebar so staff can switch languages without leaving the page. Selection persists in `localStorage` across reloads.
- Kitchen-display: three new regression tests covering the `displayTableName` computed property that prevents "Table Table 4" duplication in non-zh-TW locales.

### Changed

- Kitchen-display: Single Sign-On toast notifications (new order, order cancelled, priority updated, connection status) are now translated instead of hardcoded Chinese. Previously English-mode users saw mixed-language toasts during kitchen operation.
- Kitchen-display: Header clock and date now format according to the active locale rather than always using `zh-TW`.
- All three newly-integrated apps (`kitchen-display`, `onboarding-app`, `management-portal`) now `await initI18n()` before mounting so the first paint uses the user's saved locale. Previously, returning non-Chinese users would see a Chinese flash on load before the async plugin resolved.

### Fixed

- Kitchen-display: Order cards no longer show a duplicated "Table" prefix in English mode (e.g., "Table Table 4"). The `displayTableName` computed strips `^(Table|桌)[\s-]*` before prepending the localized label.
- Kitchen-display: Connection error and offline toasts were rendering in Chinese even when the UI was set to English. Both now use `t('kitchen.kitchenOffline')` / `t('kitchen.kitchenConnectionError')`.
