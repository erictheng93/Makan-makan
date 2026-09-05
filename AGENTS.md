# Repository Guidelines

## Project Structure & Module Organization

This repository is a `pnpm` workspace monorepo (Node >=22.13 and pnpm 10). Application code lives in `apps/`: the Vue front-ends `customer-app`, `admin-dashboard`, `kitchen-display`, `management-portal`, and `onboarding-app`; the Cloudflare Workers `api`, `management-api`, `realtime`, `image-processor`, and `backup-scheduler`; and the local Node daemon `print-agent`. Shared code lives in `packages/` (`shared`, `shared-types`, `database`, `utils`, `auth-client`, `ai-analytics`, `queue-core`, `queue-service`); `packages/shared/src/i18n` is also a workspace package. Cross-project tests and fixtures live in `tests/` with `unit`, `integration`, `e2e`, `visual`, `performance`, and `security` subfolders. Longer design and operational docs belong in `docs/`.

## Codebase Memory MCP Notes

Treat `get_architecture().packages[].fan_in` and `fan_out` as unreliable in this repo. The values have been observed as all zero even while `get_architecture().boundaries` reports real cross-app/package calls. Do not interpret zero package fan-in or fan-out as "no dependencies"; it is a false negative risk in the current MCP output.

Also do not use `get_architecture().packages[]` as the complete workspace package inventory. It appears to be a truncated/high-node-count summary and can omit important low-node-count packages such as `shared-types`, `backup-scheduler`, and `onboarding-app`. For cross-package dependency questions, prefer `get_architecture().boundaries`, targeted graph queries over `IMPORTS`, and the workspace metadata in `pnpm-workspace.yaml`, `package.json`, and `tsconfig*.json`.

## Build, Test, and Development Commands

Use `pnpm` only. Key commands:

- `pnpm dev`: run the full Turbo dev graph.
- `pnpm dev:customer` / `pnpm dev:api`: run one app locally.
- `pnpm build`: build all workspaces.
- `pnpm test`, `pnpm test:coverage`, `pnpm test:e2e`: Vitest workspace, coverage, and Playwright suites. `pnpm test:real-integration` runs the real-service integration set.
- `pnpm verify`: run the affected-package inner-loop gate; `pnpm verify:push`: run the complete local pre-push gate (lint, typecheck, formatting, guard scripts, package/root tests, and real integration tests).
- `pnpm db:migrate:local`: apply local D1 migrations.

## Coding Style & Naming Conventions

The codebase is TypeScript-first with Vue 3 and Cloudflare Workers. Prettier enforces 2-space indentation, semicolons, double quotes, trailing commas, and 80-column wrapping. Run `pnpm lint:fix` before submitting. Use `PascalCase` for Vue components and types, `camelCase` for variables/functions, `UPPER_SNAKE_CASE` for constants, and `kebab-case` for filenames such as `order-service.ts`.

For user-facing work, follow `DESIGN.md` and use the shared palette tokens in `design-tokens.js`; `pnpm run check:design-palette` enforces this across the Vue apps.

## Testing Guidelines

Vitest is the primary test runner; Playwright covers end-to-end and visual flows. Name tests `*.test.ts` and keep them near the owning app/package or under `tests/`. Global coverage thresholds are 85%; `apps/api/src/features/**/*.ts` requires 90% functions, lines, and statements, with an interim 78% branch threshold. Add or update tests with every behavior change, especially for API routes, realtime flows, and database logic.

## Database Schema & Migration Guidelines

Drizzle schema files in `packages/database/src/schema/` are the source of truth for tables and columns, but triggers, partial indexes, and CHECK constraints can exist only in migration SQL. The platform D1 migration track is `packages/database/migrations_fresh/`, squashed into `0000_baseline_strict.sql`; regenerate it with `node scripts/generate-strict-baseline.cjs`. It is used by the API and realtime workers and by the management API's `PLATFORM_DB` binding. The management API's separate `MANAGEMENT_DB` uses `apps/management-api/migrations/`. `packages/database/migrations/` is a legacy track referenced by no `wrangler.toml`; `migrations_v2/` is likewise not a Wrangler migration directory. For changes after the reviewed checkpoint, record a pair or explicit exception in `packages/database/migration-dual-track.json` and run `pnpm run check:migration-dual-track`.

Use `INTEGER` Unix milliseconds with Drizzle `{ mode: "timestamp_ms" }` for new or migrated timestamp columns. Avoid new `TEXT` timestamp columns unless there is a documented interoperability reason.

For nullable idempotency keys or external event IDs, enforce DB-level deduplication with a partial unique index, for example `WHERE idempotency_key IS NOT NULL`. A plain non-unique index is not sufficient for payment, webhook, or billing write paths.

Do not store OAuth tokens, client secrets, webhook secrets, or provider credentials as plaintext JSON. Persist secrets only in encrypted payload fields; configuration JSON may contain non-secret flags and preferences.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commits, for example `feat(tests): ...`, `fix(kitchen): ...`, and `docs(testing): ...`. Use `<type>(<scope>): <subject>` with clear scopes like `api`, `customer`, `kitchen`, `database`, or `tests`. PRs should include a short problem/solution summary, linked issues, screenshots for UI changes, and the exact verification commands you ran.

Unless the user explicitly asks to create a new branch or open a pull request, make atomic commits for completed work but do not push to the remote. Wait for the user to audit the committed result, and push only when the user explicitly asks. Each commit should contain only the intended related changes.

## Multi-Role Access System

- **0: Admin (平台管理員)** - 全域管理（監控、系統設定、跨店操作）
- **1: Shop Owner / 店長** - 餐廳權限管理與營運操作（可作為單日 Manager 的授權載體）
- **2: Chef (廚師)** - 廚房接單與出餐
- **3: Service Crew (送菜員)** - 送餐與服務流程
- **4: Cashier (收銀)** - 收銀機、班次與交易處理
- **5: Customer (顧客)** - 客戶端點餐與客戶資源查詢（`/api/v1/customers/*`）
