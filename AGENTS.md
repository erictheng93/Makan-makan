# Repository Guidelines

## Project Structure & Module Organization

This repository is a `pnpm` workspace monorepo. Application code lives in `apps/`: the Vue front-ends `customer-app`, `admin-dashboard`, `kitchen-display`, `management-portal`, and `onboarding-app`; the Cloudflare Workers `api`, `management-api`, `realtime`, `image-processor`, and `backup-scheduler`; and the local Node daemon `print-agent`. Shared code lives in `packages/` (`shared`, `shared-types`, `database`, `utils`, `testing-utils`, `auth-client`, `ai-analytics`, `queue-core`, `queue-service`). Cross-project tests and fixtures live in `tests/` with `unit`, `integration`, `e2e`, `visual`, `performance`, and `security` subfolders. Longer design and operational docs belong in `docs/`.

## Build, Test, and Development Commands

Use `pnpm` only. Key commands:

- `rtk pnpm dev`: run the full Turbo dev graph.
- `rtk pnpm dev:customer` / `rtk pnpm dev:api`: run one app locally.
- `rtk pnpm build`: build all workspaces.
- `rtk pnpm lint` and `rtk pnpm typecheck`: required before opening a PR.
- `rtk pnpm test`, `rtk pnpm test:coverage`, `rtk pnpm test:e2e`: unit/integration, coverage, and Playwright suites.
- `rtk pnpm db:migrate:local`: apply local D1 migrations.

## Coding Style & Naming Conventions

The codebase is TypeScript-first with Vue 3 and Cloudflare Workers. Prettier enforces 2-space indentation, semicolons, double quotes, trailing commas, and 80-column wrapping. Run `rtk pnpm lint:fix` before submitting. Use `PascalCase` for Vue components and types, `camelCase` for variables/functions, `UPPER_SNAKE_CASE` for constants, and `kebab-case` for filenames such as `order-service.ts`.

## Testing Guidelines

Vitest is the primary test runner; Playwright covers end-to-end and visual flows. Name tests `*.test.ts` and keep them near the owning app/package or under `tests/`. Global coverage thresholds are 85%; `apps/api/src/features/**/*.ts` is held to 90%. Add or update tests with every behavior change, especially for API routes, realtime flows, and database logic.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commits, for example `feat(tests): ...`, `fix(kitchen): ...`, and `docs(testing): ...`. Use `<type>(<scope>): <subject>` with clear scopes like `api`, `customer`, `kitchen`, `database`, or `tests`. PRs should include a short problem/solution summary, linked issues, screenshots for UI changes, and the exact verification commands you ran.

Unless the user explicitly asks to create a new branch or open a pull request, make atomic commits for completed work and push them directly to `main`. Each commit should contain only the intended related changes.

## Agent-Specific Notes

Per local tooling rules, prefix shell commands with `rtk` when running repo commands (for example `rtk git status`, `rtk pnpm test`).

## RTK Command Preference

When invoking external CLI commands from Codex for this repository, prefer the `rtk` prefix for tools such as `git`, `pnpm`, `npm`, `node`, `php`, `composer`, `pytest`, `python`, `cargo`, `bash`, and `sh`.

Examples:

- `rtk git status`
- `rtk pnpm test`
- `rtk node scripts/check-production-config.cjs`

PowerShell builtins and simple read-only inspection commands do not need the `rtk` prefix.

## Multi-Role Access System

- **0: Admin (平台管理員)** - 全域管理（監控、系統設定、跨店操作）
- **1: Shop Owner / 店長** - 餐廳權限管理與營運操作（可作為單日 Manager 的授權載體）
- **2: Chef (廚師)** - 廚房接單與出餐
- **3: Service Crew (送菜員)** - 送餐與服務流程
- **4: Cashier (收銀)** - 收銀機、班次與交易處理
- **5: Customer (顧客)** - 客戶端點餐與客戶資源查詢（`/api/v1/customers/*`）
