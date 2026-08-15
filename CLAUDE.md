# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MakanMasak is a modern, serverless restaurant management system built on Cloudflare's edge computing platform. The system provides online ordering, menu management, table management, and multi-role user access with real-time functionality. It supports multiple restaurants/shops with their own menus, tables, and staff, delivered through a scalable, cost-effective SaaS architecture.

## Technology Stack

- **Frontend**: Vue.js 3 + TypeScript (Cloudflare Pages)
- **Backend**: Cloudflare Workers + TypeScript
- **Database**: Cloudflare D1 (SQLite-compatible serverless SQL)
- **Cache**: Cloudflare KV Store
- **Real-time**: Durable Objects (WebSocket connections)
- **File Storage**: Cloudflare R2
- **Build System**: Turborepo (parallel builds with caching)
- **Backup**: Cloudflare Workers Cron + R2
- **Print**: Local Node.js agent (Express + WebSocket)
- **Security**: Cloudflare WAF + Zero Trust

## Applications Overview

`pnpm dev` starts every app in this monorepo in parallel via turbo **except `apps/print-agent`**, which is excluded from the default filter (run `pnpm dev:print-agent` separately when you need the local print daemon). The full map:

| App | Type | Local port(s) | Notes |
| --- | --- | --- | --- |
| `apps/api` | Cloudflare Worker (wrangler) | 8787 | Main public/admin REST API (Hono) |
| `apps/management-api` | Cloudflare Worker (wrangler) | 8789 | Central management API (multi-tenant control plane) |
| `apps/realtime` | Cloudflare Worker + Durable Object | 8788 | WebSocket realtime sessions |
| `apps/image-processor` | Cloudflare Worker (wrangler) | 8790 | Cloudflare Images transforms |
| `apps/backup-scheduler` | Cloudflare Worker (cron) | — | Scheduled backup trigger |
| `apps/customer-app` | Vite (Vue) | 3000 | Customer-facing ordering UI |
| `apps/admin-dashboard` | Vite (Vue) | 3001 | Restaurant admin/staff UI |
| `apps/kitchen-display` | Vite (Vue) | 3002 | Kitchen display system |
| `apps/management-portal` | Vite (Vue) | 3010 | Platform management portal |
| `apps/onboarding-app` | Vite (Vue) | 3011 | Tenant onboarding flow |
| `apps/print-agent` | Local Node.js (tsx) | 3003 (HTTP), 3004 (WS) | ESC/POS print daemon |

`pnpm dev:api`, `pnpm dev:customer`, `pnpm dev:admin`, `pnpm dev:kitchen` are the most common per-app filters; see `package.json` for the full `dev:*` script list.

## Database (Cloudflare D1)

### Schema & Migrations

- **Source of Truth**: Drizzle schema files in `packages/database/src/schema/` (includes subdirectories)
- **Migration Tracks**: `packages/database/migrations_fresh/` is the fresh baseline; `packages/database/migrations/` is the Wrangler deployment track.
- **Migration Guard**: changes after the reviewed checkpoint must be paired or documented in `packages/database/migration-dual-track.json`, then verified with `pnpm check:migration-dual-track`.
- **ID Strategy**: mixed by design while legacy modules remain. New domain tables should prefer `TEXT` UUID v7 primary keys, but existing integer-autoincrement tables are still valid until a scoped migration retires them. Do not claim the whole database is UUID-only.
- **Timestamp Strategy**: use `INTEGER` Unix milliseconds via Drizzle `{ mode: "timestamp_ms" }`. Avoid new `TEXT` timestamp columns.
- **Idempotency Strategy**: nullable idempotency/event keys on payment, webhook, billing, or retryable write paths require a DB-level partial unique index such as `WHERE idempotency_key IS NOT NULL`.
- **Secret Storage**: OAuth credentials, access/refresh tokens, client secrets, and webhook secrets must be stored only in encrypted payload fields. JSON config columns are for non-secret flags and preferences.

```bash
pnpm db:generate        # Generate migration from schema changes
pnpm db:migrate:local   # Apply migrations locally
pnpm db:reset:local     # Reset local database (clears all data)
pnpm db:seed:local      # Seed local database (scripts/seed-local.sql)
```

**Adding New Tables**: Create schema in `packages/database/src/schema/`, export from `index.ts`, run `pnpm db:generate`, add/validate the paired migration-track entry when applicable, then run `pnpm db:migrate:local`.

## Development Setup

### Prerequisites

- Node.js 22+ (`package.json` engines requires `>=22.13.0`)
- pnpm 10+ (required — repo pins `pnpm@10.24.0` via `packageManager`; engines floor is `>=8.0.0`, enforced via `.npmrc`)
- Cloudflare Account (paid plan for D1, R2, Images)

### Quick Start

```bash
pnpm install            # Must use pnpm (not npm/yarn)
pnpm wrangler login     # Authenticate with Cloudflare
pnpm db:migrate:local   # Run database migrations
pnpm dev                # Start all apps in parallel
```

### Environment Variables

**Secrets (never commit):**

```env
CLOUDFLARE_API_TOKEN=your_api_token
JWT_SECRET=your_jwt_secret
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

Put these in `.env.local` or the Cloudflare secret store — never in any committed file.

**Frontend dev defaults (committed):**

There are **5 Vite apps** in `apps/`. Three of them ship a team-shared `.env.development` checked into the repo so that `pnpm dev` works out of the box with no `cp` step:

- `apps/customer-app/.env.development` (port 3000)
- `apps/admin-dashboard/.env.development` (port 3001)
- `apps/kitchen-display/.env.development` (port 3002)

The remaining two Vite apps do **not** currently ship a `.env.development` — they either rely on Vite defaults or read from `.env.development.local` only:

- `apps/management-portal` (port 3010)
- `apps/onboarding-app` (port 3011)

These committed `.env.development` files only contain localhost URLs (API proxy path, local WS ports) and feature flags — zero secrets.

To override for your personal setup (port collision, remote API, etc.), create `.env.development.local` in the same directory — it's gitignored and takes precedence over `.env.development`. Each app with a committed `.env.development` also has a `.env.development.example` you can copy as a starting point.

**Rule:** anything matching `SECRET|TOKEN|KEY|PASSWORD` belongs in `.env.local` only. `.env.development` is for localhost URLs and flags, nothing else.

## Multi-Role Access System

- **0: Admin** - Full system access
- **1: Shop Owner (店主)** - Restaurant management
- **2: Chef (廚師)** - Kitchen display system
- **3: Service Crew (送菜員)** - Order fulfillment
- **4: Cashier (收銀)** - Payment processing
- **5: Customer** - Customer registration and ordering (shop QR mode)

## Development Commands

```bash
# Development
pnpm dev                # Start all apps in parallel
pnpm dev:api            # API only
pnpm dev:customer       # Customer app only
pnpm dev:admin          # Admin dashboard only
pnpm dev:kitchen        # Kitchen display only

# Verification (see "Two verification tiers" below — use these, not the raw commands)
pnpm verify             # Inner loop: typecheck + lint + test, affected packages only
pnpm verify:push        # Pre-push gate: the full CI-equivalent gate, once

# Testing
pnpm test               # All vitest tests (unit + feature)
pnpm test:unit          # Unit tests only
pnpm test:e2e           # End-to-end tests (Playwright)
pnpm test:e2e:ui        # E2E with Playwright UI
pnpm test:ci            # CI pipeline tests (unit + e2e)
pnpm test:coverage      # Tests with coverage report
pnpm test:visual        # Visual regression tests (Playwright screenshots)
pnpm test:visual:update # Update screenshot baselines

# Type checking & linting
pnpm typecheck          # TypeScript check (all packages)
pnpm lint               # Lint all packages
pnpm lint:fix           # Auto-fix lint issues

# Deployment
pnpm deploy:prod        # Deploy to production
```

### Two verification tiers

**Do not run the full suite after every edit.** `pnpm verify` after each
meaningful change; `pnpm verify:push` once, before pushing. Both live in
`scripts/verify.sh`.

| | `pnpm verify` | `pnpm verify:push` |
| --- | --- | --- |
| Scope | packages affected vs the merge-base with `main` | every package + the root `tests/` project |
| Contents | typecheck, lint, test | plus prettier, i18n coverage, and the five `check:*` guards — mirrors `.github/workflows/test.yml` |
| When | after each edit | once, before pushing |

Both tiers go through turbo, so unchanged packages are cache hits rather than
re-runs. That is what makes the full gate affordable: it still accounts for
every package, but only re-executes the ones whose inputs moved. Cache
correctness rests on `$TURBO_DEFAULT$` inputs plus `dependsOn: ["^build"]` —
a change in `packages/database` invalidates every dependent app's test task.

Never narrow a task's `inputs` in `turbo.json` to an explicit allow-list like
`src/**`. `packages/shared` keeps tests in `utils/`, and a missed input means a
stale cache HIT reported as a pass. Subtract from `$TURBO_DEFAULT$` instead.

**Every package that has tests needs its own `vitest.config.ts`.** Without one,
`vitest` walks up and finds the root config, then resolves its `projects`
entries relative to the package — `packages/database` failed for exactly this
reason with `Projects definition references a non-existing file or a directory:
packages/database/apps/admin-dashboard`. Two further rules follow from
per-package execution:

- A package's `test` script must be a single-shot `vitest run`. A bare `vitest`
  is watch mode and hangs turbo forever. Put watch mode in `test:watch`.
- A package with a `test` script but no test files yet needs
  `vitest run --passWithNoTests`. Plain `vitest run` exits 1 on "No test files
  found", which reddens the whole run (`packages/queue-service`).
- Tests must not build paths from `process.cwd()`. Anchor on
  `fileURLToPath(new URL("../../..", import.meta.url))` instead, or the test
  only passes when invoked from the repo root.

A standalone config does **not** inherit the root `resolve.alias` block, so
repeat the `@makanmasak/*` aliases in it. Dropping them silently switches
resolution from package source to built `dist/`, which is a different thing to
be testing.

### One worktree per session

`turbo --affected` and `vitest --changed` both derive scope from the git diff of
the tree they run in. Several sessions sharing one working tree means every
session's "affected" set contains every other session's work, and the
incremental scope collapses back toward a full run.

```bash
scripts/session-worktree.sh <branch>   # new worktree + shared cache + install
scripts/session-worktree.sh            # link an existing worktree to the shared cache
```

The turbo cache is deliberately **not** isolated — it is content-addressed, so a
package another session already checked at the same content hash is a free hit
here. The script symlinks each worktree's `.turbo/cache` to
`~/.cache/turbo/makanmasak` (override with `MAKAN_TURBO_CACHE_DIR`) and links
the gitignored `.env.local` and `.wrangler` local state from the primary
worktree.

## Common Tasks

### QR Code Generation

- Individual QR: `POST /api/v1/qr/generate`
- Bulk generation: `POST /api/v1/qr/bulk`
- Shop QR: `POST /api/v1/restaurants/:id/qr/shop/generate`
- Seat QR: `POST /api/v1/seats/batch-create`

### User Role Management

- API: `POST/PUT /api/v1/users/{restaurant_id}`
- Role definitions: `apps/api/src/shared/constants/index.ts`

### Menu Items

- API: `POST /api/v1/menu/{restaurant_id}/items`
- Frontend: Admin dashboard → Menu Management

## Performance Targets

- **API Response Time**: P99 < 300ms
- **Database Query Time**: P95 < 100ms
- **Image Load Time**: P90 < 1s
- **WebSocket Latency**: < 50ms

## Security

- AES-256 encryption for sensitive data
- Bcrypt password hashing (cost factor 10)
- JWT tokens with secure refresh logic
- WAF rules, rate limiting (per-IP and per-user)
- Complete audit trail, role-based access control (RBAC)

### Shop QR codes are public identifiers, not credentials

`shopQrCode` (`SHOP-{restaurantId}-{ts}`) is handed to anyone who asks, by
design — `GET /api/v1/restaurants/:id` returns it, and so does
`GET /api/v1/discovery/restaurants/:id/takeaway-eligibility`. That is what lets
a customer start a takeaway order from discovery or a market page without
physically scanning anything (`DiscoveryView.vue`, `MarketDetailView.vue`).

Consequences, in order of how often they get forgotten:

- **Never treat possession of the code as proof of presence.** "Verify the shop
  QR, then issue a short-lived capability that guest-orders checks" adds nothing:
  the attacker fetches the code from a public endpoint first. Replacing it with a
  high-entropy random token does not help either, because the same endpoints
  would hand out the new token.
- **What it legitimately does:** identify which restaurant a scan refers to, and
  tell the server whether the sticker in someone's hand is the current one.
  `assertShopQrCurrent` (`features/orders/services/shop-mode-gate.ts`) compares it
  only to retire superseded stickers after a regeneration — a revocation check,
  not authentication.
- **Abuse control must stand on its own.** Guest ordering is rate limited per
  (restaurant, IP) in `features/guest-orders/services/guest-order-throttle.ts`,
  layered under the global per-IP limiter. Do not re-key the global limiter by
  restaurant: that multiplies an attacker's budget by the number of restaurants
  instead of shrinking it.
- Table and seat QR codes are different — those carry an HMAC signature
  (`buildSignedQRUrl`) and are not public. Do not generalize this note to them.

## Coding Conventions

### UI/UX Design System (Enforced)

All frontend UI design and implementation MUST follow the **Apple-Native Soft Minimalism** design system defined in `docs/UIUX-design-system.md`.

**Key rules:**

- Page background: `#F2F2F7` (iOS system gray)
- Cards: white + `rounded-2xl` ~ `rounded-3xl` + soft shadow (`opacity ≤ 8%`)
- No hard borders — use shadow + background color difference for separation
- Buttons/tags: pill-shaped (`rounded-full`)
- Text: never pure black, use `#1C1C1E`; strong title/body contrast
- Colors: `#007AFF` (primary), `#34C759` (success), `#FF9500` (warning), `#FF3B30` (error)
- Icons: SF Symbols / Lucide Icons, outline/filled toggle
- Animations: 200-350ms, ease-out, iOS-native feel
- Output: Vue + Tailwind CSS with `ios-*` color tokens (see Section 14.2 of design doc)
- **Always check the Section 15 Design Checklist before outputting UI**

### Error Response Format (Enforced)

All API error responses MUST use the unified format:

```typescript
{
  success: false,
  error: {
    code: string,       // e.g. "NOT_FOUND", "VALIDATION_ERROR"
    message: string,    // user-safe message (auto-sanitized)
    details?: unknown   // optional: field-level validation errors
  }
}
```

**How to use:**

- Throw `ApiError` from route handlers/services — the global `app.onError` handler formats it automatically
- Use factory functions: `notFound()`, `badRequest()`, `unauthorized()`, `forbidden()`, `conflict()` from `apps/api/src/shared/utils/api-error.ts`
- Do NOT write try-catch in route handlers for error formatting — let errors propagate to the global handler
- Validation middleware and auth middleware already produce this format

**Example:**

```typescript
import { notFound } from "../../../shared/utils/api-error";

app.get("/:id", async (c) => {
  const item = await service.getById(id);
  if (!item) throw notFound("Item not found", "ITEM_NOT_FOUND");
  return c.json({ success: true, data: item });
});
```

### Database Query Strategy (Two Layers — Enforced)

All database queries MUST use one of the two approved layers. Raw string SQL (Layer 3) is **banned** in new code.

| Layer                                    | When to use                           | Column safety   |
| ---------------------------------------- | ------------------------------------- | --------------- |
| **Layer 1: Drizzle Query Builder**       | CRUD, simple JOINs, filters           | ✅ Compile-time |
| **Layer 2: Drizzle `sql` + Schema Refs** | Complex analytics, CTEs, aggregations | ✅ Compile-time |

**Why:** Raw SQL string column names silently drift when schema migrates. Both Layer 1 and Layer 2 reference Drizzle schema objects, so column renames cause **compile-time errors** instead of runtime 500s.

**Layer 1 — Drizzle Query Builder** (CRUD, simple queries):

```typescript
import { eq, and } from "drizzle-orm";
import { menuItems } from "@makanmasak/database";

const results = await db
  .select()
  .from(menuItems)
  .where(eq(menuItems.restaurantId, id));
```

**Layer 2 — Drizzle `sql` template + Schema References** (complex analytics):

```typescript
import {
  sql,
  eq,
  and,
  between,
  menuItems,
  orders,
  orderItems,
} from "@makanmasak/database";

const result = await db
  .select({
    itemName: menuItems.name,
    totalOrders: sql<number>`COUNT(DISTINCT ${orders.id})`,
    totalRevenue: sql<number>`SUM(${orderItems.totalPrice})`,
  })
  .from(menuItems)
  .leftJoin(orderItems, eq(menuItems.id, orderItems.menuItemId))
  .leftJoin(orders, eq(orderItems.orderId, orders.id))
  .where(
    and(
      eq(orders.restaurantId, restaurantId),
      between(orders.createdAt, new Date(startMs), new Date(endMs)),
    ),
  )
  .groupBy(menuItems.id);
```

**Reference implementations:**

- Layer 1: `apps/api/src/features/integrations/services/PlatformIntegrationService.ts`
- Layer 2: `packages/ai-analytics/src/services/ProductAnalysisService.ts`

### Testing Standards (Enforced)

All new tests MUST follow these conventions. Existing tests are being migrated progressively.

**1. Prefer local test builders/helpers when present:**

```typescript
function buildUser(overrides = {}) {
  return { id: 1, role: 1, restaurantId: "rest-1", ...overrides };
}
```

Keep builders close to the owning test file or shared in an existing local
test helper. Do not import `@makanmasak/testing-utils`; that workspace package
does not currently exist.

**2. Verify mock calls (not just return values):**

```typescript
// Every vi.fn() mock for external calls (DB, API, WebSocket, cache) must have verification
expect(mockService.createOrder).toHaveBeenCalledOnce();
expect(mockService.createOrder).toHaveBeenCalledWith(
  expect.objectContaining({ restaurantId: "1" }), // structural match, NOT exact
);
```

- Use `expect.objectContaining()` — never exact-match timestamps, UUIDs, or generated values
- Use `expect.any(String)`, `expect.any(Number)` for non-deterministic fields

**3. No CSS class assertions:**

```typescript
// BAD — breaks when Tailwind classes change
expect(wrapper.classes()).toContain("bg-green-500");

// GOOD — test behavior, not styling
expect(wrapper.find('[data-status="active"]').exists()).toBe(true);
expect(wrapper.text()).toContain("已完成");
expect(wrapper.vm.statusClass).toBe("active");
```

Use `data-testid`, `data-status`, `aria-*` attributes, text content, or Vue computed state instead.

**4. Pre-commit check:** lint-staged currently runs ESLint and Prettier only.
There is no `scripts/check-factory-usage.cjs` gate in this repository.

## Error Handling

### Common Issues

1. **D1 Connection Errors**: Check wrangler.toml bindings
2. **KV Cache Misses**: Verify namespace configuration
3. **Image Upload Failures**: Check R2 bucket permissions
4. **WebSocket Disconnections**: Monitor Durable Objects health
5. **Windows: `pnpm dev` fails with `*** std::terminate() called with no exception` followed by `MiniflareCoreError [ERR_RUNTIME_FAILURE]`**: This is a wrangler 4.84.x regression on Windows triggered by **any** `inspector_port = N` line inside the `[dev]` block of a `wrangler.toml`. It reproduces on every port value (9229/9230/9500, etc.), on both Node 22 and Node 24, and on every installed workerd binary — port availability is not the factor; the toml field itself crashes the InspectorProxyWorker. **All 4 Workers apps in this repo already have `inspector_port` commented out** in their `wrangler.toml` with an inline note — do not reintroduce it. If you need a pinned DevTools port, pass it via CLI flag (`wrangler dev --inspector-port N`) instead, which does not crash. Debug hint: first line to run if you see `std::terminate` in a future wrangler bump is `grep -rn "^inspector_port" apps/`.

### Debug Tools

- Worker logs: `pnpm wrangler tail`
- **Health endpoints** — three public ones, and they are not interchangeable:

  | Endpoint | Checks dependencies? | Use for |
  | --- | --- | --- |
  | `GET /info` | **No** — returns static metadata (version, deployment mode, endpoint list) | "Is the Worker running?" Smoke tests, LB liveness. Cheapest, no bindings touched |
  | `GET /api/v1/monitoring/health` | **Yes** — D1 `SELECT 1` + a KV read, plus API latency/error rate from Analytics Engine | "Are the dependencies healthy?" Dashboards, alerting, frequent polling |
  | `GET /api/v1/system/health` | **Yes** — same D1 probe, but its KV probe does put + get + delete | One-off deep checks. Prefer `monitoring/health` when polling — this one spends a KV **write** per call |

  `/health` redirects to `/api/v1/monitoring/health`. That response is a bare
  payload (`{overall, components}`), not the unified `{success, data}` envelope.

  `/api/v1/system/health/ready` and `/live` are kubernetes-style probes and
  **require a bearer token**.

- **Health must come from probes, not counters.** `MonitoringService` keeps
  per-isolate in-process counters; deriving health from them alone means an
  isolate that has served no traffic reports perfect health while D1 is down.
  `getHealthStatus()` therefore probes the dependency and consults the counters:
  a failed probe is `critical`, a passing one falls through to the
  counter-derived status so a reachable-but-slow dependency still reads as
  `warning`. Keep both signals if you touch this — they detect different things.
- Note: there is **no** unauthenticated `/api/v1/health` route anymore. The old router was replaced by the System/Monitoring features; public smoke checks should use `/info`.
- Error tracking: Automatic Slack notifications

### codebase-memory MCP: `get_architecture` gotchas

Two fields in `get_architecture` return misleading values. Both are upstream
bugs in the compiled MCP binary (`~/.local/bin/codebase-memory-mcp`, no local
source) — work around them, don't re-diagnose them.

1. **`packages[].fan_in` / `fan_out` are always `0`.** They are simply never
   computed. The `0` does **not** mean "no cross-package dependencies" — the
   underlying `IMPORTS` edges exist and workspace aliases *are* resolved
   (`@makanmasak/database` → `packages/database/src`). Do not conclude that
   tree-sitter failed on alias resolution, and do not fall back to reading
   `package.json` by hand.

   To answer "which app depends on which package", use either:
   - the **`boundaries`** field in the same `get_architecture` response
     (`api→utils` 197 calls, `api→database` 62, …), or
   - `query_graph` for the full import matrix:

   ```cypher
   MATCH (a)-[r:IMPORTS]->(b)
   WHERE b.file_path STARTS WITH 'packages/'
   RETURN a.file_path, b.file_path, count(r) AS n ORDER BY n DESC
   ```

2. **`packages[]` is not a package inventory.** It appears to be truncated to
   the top 15 by `node_count`, so type-only packages fall off. `shared-types`
   is missing despite being the most-imported package in the repo;
   `backup-scheduler` and `onboarding-app` are missing too. Use it as a rough
   "which packages are big" hint only — never as a completeness check.

Cypher note: `query_graph`'s WHERE clause only accepts a **literal** on the
right-hand side. Property-to-property comparison fails to parse regardless of
operator — `a.file_path = b.file_path`, `!=`, and `<>` all error with
`expected value at pos N` pointing just past the left operand. Filter against
literals (`STARTS WITH 'packages/'`, `IS NOT NULL`) and do any cross-property
comparison after the rows come back.

## Documentation

See `docs/README.md` for full documentation navigation, and `docs/archive/CHANGELOG.md` for detailed changelog.

Key reference: `docs/UIUX-design-system.md` — mandatory for all UI work.

---

- Always use context7 when I need code generation, setup or configuration steps, or
  library/API documentation. This means you should automatically use the Context7 MCP
  tools to resolve library id and get library docs without me having to explicitly ask.

## gstack

- Available skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`.
- If gstack skills aren't working, run `cd .claude/skills/gstack && ./setup` to build the binary and register skills.
- Use `/browse` for AI-driven QA testing; `mcp__chrome-devtools__*` and Playwright MCP tools are still permitted when explicitly requested.
