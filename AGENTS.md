# Repository Guidelines

## Project Structure & Module Organization

This repository is a `pnpm` workspace monorepo. Application code lives in `apps/`: the Vue front-ends `customer-app`, `admin-dashboard`, `kitchen-display`, `management-portal`, and `onboarding-app`; the Cloudflare Workers `api`, `management-api`, `realtime`, `image-processor`, and `backup-scheduler`; and the local Node daemon `print-agent`. Shared code lives in `packages/` (`shared`, `shared-types`, `database`, `utils`, `testing-utils`, `auth-client`, `ai-analytics`, `queue-core`, `queue-service`). Cross-project tests and fixtures live in `tests/` with `unit`, `integration`, `e2e`, `visual`, `performance`, and `security` subfolders. Longer design and operational docs belong in `docs/`.

## Build, Test, and Development Commands

Use `pnpm` only. Key commands:

- `pnpm dev`: run the full Turbo dev graph.
- `pnpm dev:customer` / `pnpm dev:api`: run one app locally.
- `pnpm build`: build all workspaces.
- `pnpm lint` and `pnpm typecheck`: required before opening a PR.
- `pnpm test`, `pnpm test:coverage`, `pnpm test:e2e`: unit/integration, coverage, and Playwright suites.
- `pnpm db:migrate:local`: apply local D1 migrations.

## Coding Style & Naming Conventions

The codebase is TypeScript-first with Vue 3 and Cloudflare Workers. Prettier enforces 2-space indentation, semicolons, double quotes, trailing commas, and 80-column wrapping. Run `pnpm lint:fix` before submitting. Use `PascalCase` for Vue components and types, `camelCase` for variables/functions, `UPPER_SNAKE_CASE` for constants, and `kebab-case` for filenames such as `order-service.ts`.

## Testing Guidelines

Vitest is the primary test runner; Playwright covers end-to-end and visual flows. Name tests `*.test.ts` and keep them near the owning app/package or under `tests/`. Global coverage thresholds are 85%; `apps/api/src/features/**/*.ts` is held to 90%. Add or update tests with every behavior change, especially for API routes, realtime flows, and database logic.

## Database Schema & Migration Guidelines

Drizzle schema files in `packages/database/src/schema/` are the source of truth. When schema changes require SQL, keep both migration tracks current: `packages/database/migrations_fresh/` for the generated/fresh baseline and `packages/database/migrations/` for the Wrangler deployment track. Any migration after the reviewed checkpoint must be paired or explicitly marked in `packages/database/migration-dual-track.json`; verify with `pnpm run check:migration-dual-track`.

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
