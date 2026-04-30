# Real Integration Test Foundation — Design Spec

**Date:** 2026-04-13
**Author:** Tech Lead / Architect (AI)
**Status:** Approved
**Phase:** 1 of 2 (backend foundation; frontend spec locked behind handoff contract)

---

## Background

An audit of the codebase's integration test layer revealed a systemic lie: every file named `*integration*.test.ts` or placed under an `integration/` folder is, in fact, a unit test with mocked service/DB boundaries. No test in the entire workspace currently exercises the real Drizzle ORM against a real SQLite/D1 engine.

### Findings (verified 2026-04-13)

| Claim                                                                                            | Status      | Evidence                                                                            |
| ------------------------------------------------------------------------------------------------ | ----------- | ----------------------------------------------------------------------------------- |
| `apps/customer-app` has no real integration tests                                                | ✅ Confirmed | `package.json` has `test:unit` + `test:e2e` only; no `integration/` folder          |
| `apps/customer-app/src/tests/services/*.test.ts` all `vi.mock("@/services/api")`                 | ✅ Confirmed | 5 files, all top-of-file mock                                                       |
| `apps/admin-dashboard/src/tests/integration/` uses `vi.mock()` throughout                        | ✅ Confirmed | 15 mock calls across 4 files                                                        |
| `apps/kitchen-display/tests/integration/` mocks `PerformanceObserver`                            | ✅ Confirmed | `performance-integration.test.ts:15`                                                |
| `apps/api/src/__tests__/integration/*.integration.test.ts` use real Drizzle                      | ❌ False     | Uses `MockDrizzle` (Proxy fake) + `SharedDataStore` (`sql.js`)                      |
| `packages/database` services tests mock Drizzle                                                  | ✅ Confirmed | `packages/database/src/services/__tests__/setup.ts:9` `vi.mock("drizzle-orm/d1")`   |
| `better-sqlite3` is used in tests                                                                | ❌ False     | Present in root `devDependencies` but not imported by any test file                 |

### Double-layered fakery in API "integration" tests

```
Production path:  Hono → Route → Service → Drizzle → D1Database
Test path:        Hono → Route → Service → MockDrizzle (Proxy) → SharedDataStore (sql.js)
                                            └─ bypasses Drizzle entirely ─┘
```

1. `SharedDataStore` uses `sql.js` (WASM SQLite), patching `unixepoch` because it runs an older SQLite version than D1
2. `createInlineMockDrizzle` is a `Proxy` that intercepts `.select().from()`, `.insert().values()`, etc. and hand-rolls SQL strings to pass to `sql.js` — **Drizzle's own SQL compiler is never executed**
3. `apps/api/src/__tests__/helpers/drizzle-test-db.ts` is an even worse second fake: pure `Map<string, Map<number, any>>` with regex-based SQL "parsing" — zero SQL execution
4. Hand-written DDL in `extended-test-app.ts` duplicates schema. Every migration requires editing this file too. Schema drift is guaranteed.

### Why this matters

- Drizzle's SQL generation (joins, subqueries, `sql` template literals, `timestamp_ms` mode Date ⇄ integer conversion) has **zero test coverage**
- "Integration tests pass" ≠ "production will run" — the signal is broken
- Schema drift between `migrations_fresh/*.sql` and `extended-test-app.ts` DDL is structural, not a matter of discipline
- The original plan to "use `createIntegrationTestApp` as in-process backend for frontend tests" would **amplify** the false confidence rather than fix it

### Parity decision

Path chosen: **Build real Drizzle + real D1 test foundation in the backend, then layer frontend integration tests on it.** Phase 2 (frontend) is locked behind a handoff contract defined in §Handoff Contract of this document.

**Driver choice:** `drizzle-orm/d1` + miniflare `D1Database`. Rejected `drizzle-orm/better-sqlite3` because it validates SQL dialect parity but not Drizzle driver parity — production deploys `drizzle-orm/d1`, so that is the driver under test.

---

## Scope

### In scope (Phase 1 — this spec)

1. **Step 1** — `packages/database/src/testing/createTestDatabase.ts` using miniflare `D1Database` + real migrations
2. **Step 2** — `apps/api/src/__tests__/integration/helpers/real-test-app.ts` exposing `createRealIntegrationTestApp()`
3. **Step 3** — 4 reference smoke tests: `orders`, `menu`, `customer-orders`, `discovery`
4. **Step 4** — Legacy relabel (directory moves + header comments) + freeze enforcement (allowlist + CI check)
5. **Handoff Contract** — lock Phase 2 seam so the frontend spec can be written once Phase 1 is green

### Out of scope (explicit non-goals)

- ❌ Migrating any of the 13 existing legacy API integration tests to the new foundation (incident-driven only)
- ❌ Queue consumer, Durable Object state machine, or Analytics Engine testing
- ❌ Unifying `@makanmakan/testing-utils` factories with new seed helpers (seed helpers are thin wrappers over existing factories)
- ❌ Frontend integration tests in `customer-app`, `admin-dashboard`, `kitchen-display` (Phase 2 spec)
- ❌ E2E test changes (Playwright lives at a different layer)
- ❌ Migration guide for legacy tests (they coexist indefinitely)
- ❌ Switching the API app to `@cloudflare/vitest-pool-workers` (potential future; not required now)

---

## Architecture Decisions

### A1 — miniflare package (not vitest-pool-workers, not better-sqlite3)

**Decision:** Use the `miniflare` package (v3+) to obtain a real `D1Database` binding for tests. The binding is retrieved via `mf.getBindings()` and passed into `drizzle(env.DB)` exactly as production does.

**Rationale:**

- `vitest-pool-workers` runs tests inside a workerd isolate. That sacrifices Node debugging ergonomics (standard debugger attach, familiar stack traces, `console.log`), and the parity gain over miniflare is marginal — both use the same workerd-native SQLite engine for D1
- `drizzle-orm/better-sqlite3` would validate SQL dialect parity but not driver parity. Production deploys `drizzle-orm/d1`, so that is the driver the tests must exercise
- miniflare's `D1Database` binding goes through the same workerd-native path that workerd itself uses — **identical SQLite engine, identical wire protocol**
- Keeping tests in a Node.js runtime allows wrapping the Hono app with `@hono/node-server` when the Phase 2 frontend layer needs an actual HTTP port
- If a specific test later demands workerd-level parity (e.g., DO state transitions), that one file can be migrated to `vitest-pool-workers` without touching the foundation

### A2 — Per-test-file DB lifecycle

**Decision:** Each `*.real.integration.test.ts` file creates one `TestDatabase` in `beforeAll`, runs `truncateAll()` in `beforeEach`, and calls `dispose()` in `afterAll`.

**Rationale:**

- **Per-run single shared DB** would force `pool: 'forks', singleFork: true`, sacrificing vitest parallelism. Unacceptable CI slowdown
- **Per-test fresh DB** would pay the migration cost (~100ms estimated) on every test — wasteful for files with 10+ tests
- **Per-file fresh DB** amortizes migration cost (one run per file × 13 files ≈ 1.3s extra total) while preserving isolation. Any test failure can only dirty its own file's state, and `beforeEach` truncate guarantees clean slate per test
- `truncateAll` issues `DELETE FROM <table>` + `DELETE FROM sqlite_sequence` (not drop/recreate) — O(rows) in in-memory SQLite, measured at <1ms for typical fixture sizes
- `dispose()` is mandatory to release miniflare's subprocess handle; skipping it causes handle leaks under long-running `vitest watch` sessions

### A3 — Reuse production `createApp(env)` factory (not hand-assembled test app)

**Decision:** `createRealIntegrationTestApp()` imports the production Hono factory from `apps/api/src/index.ts` and passes a test-built `Env`. If `apps/api/src/index.ts` is not currently factored as `createApp(env)`, the first sub-task of Step 2 is to refactor it to be one — used by both production entry and test entry.

**Rationale:**

- The legacy `extended-test-app.ts` hand-mounts 23 routes via individual `app.route(...)` calls. Every new feature route requires synchronized edits to this file. Forgotten edits produce silent test drift
- Using the production factory means the test app tracks production routes automatically, zero maintenance
- The refactor cost is small (extract top-level `new Hono()` + route mounting into a function) and the payoff is permanent
- If the refactor expands beyond ~200 lines or touches unrelated code, it is split into a prerequisite PR landing before Step 2

### A4 — Binding coverage strategy

**Decision:** Real miniflare implementations for `D1`, all `KV` namespaces, and all `R2` buckets. No-op stubs for `Queue`, `DurableObject` bindings, and `AnalyticsEngine`.

| Binding                                | Implementation           | Rationale                                                                         |
| -------------------------------------- | ------------------------ | --------------------------------------------------------------------------------- |
| `DB`                                   | miniflare real D1        | Core — the entire reason for this spec                                            |
| `CACHE_KV`, `TOKEN_BLACKLIST`, `RATE_LIMIT_KV` | miniflare real KV | Cheap to enable; exercises real rate-limit and JWT-blacklist middleware paths     |
| `IMAGES_BUCKET`, `BACKUP_STORAGE`      | miniflare real R2        | Cheap; prevents false-positive passes when routes read/write R2                   |
| `JOB_QUEUE`, `PRELOAD_QUEUE`, `REVALIDATION_QUEUE` | `{ send: async()=>{} }` no-op | Verifying queue consumers is E2E territory; producer fire-and-forget is enough here |
| `REALTIME_ORDERS`, `REALTIME_SESSION` (DO) | In-memory stub       | DO emulation is heavy; the 4 reference routes do not touch realtime paths         |
| `ANALYTICS_ENGINE`                     | `{ writeDataPoint: () => {} }` no-op | Pure telemetry, no business logic                                     |
| `MOCK_DRIZZLE_DB`                      | Explicitly `undefined`   | New code path must never silently fall back to the legacy mock                    |

**Rationale:** miniflare's single `new Miniflare({ d1Databases, kvNamespaces, r2Buckets })` call delivers D1 + KV + R2 with zero extra setup cost. Queue/DO/Analytics are stubbed because verifying them would recreate E2E and they are not exercised by the Phase 1 smoke routes. Future tests that require real queue/DO behavior can upgrade to `vitest-pool-workers` per-file.

### A5 — Backend tests use `app.fetch(Request)`; frontend tests get HTTP via `startTestApiServer()`

**Decision:** Backend integration tests invoke routes through Hono's WinterCG `fetch` interface directly (no port, no network). Frontend integration tests (Phase 2) wrap the same app in `@hono/node-server` via `startTestApiServer()` to obtain a real HTTP URL.

**Rationale:**

- `app.fetch(new Request(...))` is deterministic, has no port contention, avoids network latency, and runs the identical Hono pipeline
- The frontend layer genuinely needs HTTP because the customer-app ships a real `fetch()` client; testing requires a real origin URL
- Both transports share the exact same underlying Hono instance. Any divergence in behavior between them would be a bug in `@hono/node-server`, not in our code

### A6 — Legacy relabel via directory moves (not file renames)

**Decision:**

| Source                                                    | Target                                                  | Method           |
| --------------------------------------------------------- | ------------------------------------------------------- | ---------------- |
| `apps/api/src/__tests__/integration/`                     | `apps/api/src/__tests__/integration-legacy-mockdrizzle/` | `git mv` folder  |
| `apps/admin-dashboard/src/tests/integration/`             | `apps/admin-dashboard/src/tests/component-flows/`       | `git mv` folder  |
| `apps/kitchen-display/tests/integration/`                 | `apps/kitchen-display/tests/component-flows/`           | `git mv` folder  |
| Inline `*integration.test.ts` under `apps/api/src/features/**` | In place + mandatory header comment                | File edit        |
| `apps/customer-app/src/tests/i18n.integration.test.ts`    | In place + clarifying header comment (not fake)         | File edit        |
| `apps/admin-dashboard/src/__tests__/virtual-scroll-integration.test.ts` | In place + clarifying header (not fake)    | File edit        |
| `apps/admin-dashboard/src/__tests__/integration/dashboard-integration.test.ts` | In place + header comment (single file, not worth folder move) | File edit |
| `apps/realtime/src/__tests__/websocket-integration.test.ts` | In place + header after classification audit          | File edit        |

The original `apps/api/src/__tests__/integration/` name is freed up and **reclaimed by the new real-integration path** in Step 2.

**Rationale:**

- `git mv` preserves history; `git log --follow` continues to work. File-by-file rename breaks `git blame` for minimal gain
- A single PR with one directory-diff covers 20+ files, easier to review than 20 individual renames
- The new folder name `integration-legacy-mockdrizzle/` is self-documenting: a reader lands on it and instantly knows the contents cannot be trusted as integration evidence
- Reclaiming the canonical `integration/` name is important — the name should mean what it says. Putting real tests there restores trust in the folder convention

### A7 — Freeze enforcement: allowlist + CI check (not pre-commit, not ESLint)

**Decision:** Maintain `tests/.integration-allowlist.json` enumerating all legitimate `*integration*.test.ts` locations. A Node.js script `scripts/check-integration-allowlist.cjs` runs in CI as a required check. Any `*integration*.test.ts` file that is neither in the allowlist nor matching the canonical real-integration pattern (`*.real.integration.test.ts` under `apps/*/src/__tests__/integration/`) fails CI.

**Rationale:**

- Pre-commit hooks can be bypassed (`git commit --no-verify`), are not installed by default on forkers, and fire locally only — not a real gate
- ESLint custom rules for filename-level enforcement are high-maintenance (custom AST visitors, separate rule registration) for a check that fits in 10 lines of plain Node
- Allowlist is an **explicit debt ledger**: adding a legacy-style test requires the PR author to add their own file to `legacy_mockdrizzle` or `inline_legacy_annotated` — an uncomfortable self-incrimination that aligns incentives away from silent debt growth
- Adding a real integration test just requires placing it in the canonical path with the `*.real.integration.test.ts` suffix; no ledger edit required, friction aligned with desired behavior

**Allowlist shape:**

```json
{
  "real": ["apps/api/src/__tests__/integration/*.real.integration.test.ts"],
  "legacy_mockdrizzle": ["apps/api/src/__tests__/integration-legacy-mockdrizzle/**"],
  "module_integration": [
    "apps/customer-app/src/tests/i18n.integration.test.ts",
    "apps/admin-dashboard/src/__tests__/virtual-scroll-integration.test.ts"
  ],
  "inline_legacy_annotated": [
    "apps/api/src/features/customers/__tests__/integration.test.ts",
    "apps/api/src/features/partnerships/__tests__/integration.test.ts",
    "apps/api/src/features/waiting-list/__tests__/integration.test.ts",
    "apps/api/src/features/tables/__tests__/concurrency-integration.test.ts",
    "apps/api/src/features/orders/__tests__/realtime-integration.test.ts",
    "apps/api/src/services/__tests__/broadcast-integration.test.ts",
    "apps/admin-dashboard/src/__tests__/integration/dashboard-integration.test.ts",
    "apps/realtime/src/__tests__/websocket-integration.test.ts"
  ]
}
```

The exact list of `inline_legacy_annotated` entries is the output of Step 4's discovery phase and may differ slightly once each file is individually classified as mocked vs genuine module-integration.

---

## Components

### C1 — `packages/database/src/testing/create-test-database.ts`

```ts
import { Miniflare } from "miniflare";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import type { D1Database, KVNamespace, R2Bucket } from "@cloudflare/workers-types";
import * as schema from "../schema";
import { runMigrations, listUserTables } from "./run-migrations";

export interface TestDatabaseBindings {
  DB: D1Database;
  CACHE_KV: KVNamespace;
  TOKEN_BLACKLIST: KVNamespace;
  RATE_LIMIT_KV: KVNamespace;
  IMAGES_BUCKET: R2Bucket;
  BACKUP_STORAGE: R2Bucket;
}

export interface TestDatabase {
  db: D1Database;
  bindings: TestDatabaseBindings;
  drizzle: DrizzleD1Database<typeof schema>;
  truncateAll(): Promise<void>;
  dispose(): Promise<void>;
}

export async function createTestDatabase(): Promise<TestDatabase> {
  const mf = new Miniflare({
    modules: true,
    script: "export default {};", // no worker code; we only want bindings
    d1Databases: { DB: ":memory:" },
    kvNamespaces: ["CACHE_KV", "TOKEN_BLACKLIST", "RATE_LIMIT_KV"],
    r2Buckets: ["IMAGES_BUCKET", "BACKUP_STORAGE"],
  });
  const bindings = await mf.getBindings<TestDatabaseBindings>();
  await runMigrations(bindings.DB);

  const drizzleDb = drizzle(bindings.DB, { schema });

  return {
    db: bindings.DB,
    bindings,
    drizzle: drizzleDb,
    truncateAll: async () => {
      const tables = await listUserTables(bindings.DB);
      for (const t of tables) {
        await bindings.DB.prepare(`DELETE FROM "${t}"`).run();
      }
      await bindings.DB.prepare(`DELETE FROM sqlite_sequence`).run();
    },
    dispose: async () => {
      await mf.dispose();
    },
  };
}
```

Exported from `packages/database/src/testing/index.ts`. Not included in the default `@makanmakan/database` barrel export — consumers must `import { createTestDatabase } from "@makanmakan/database/testing"` to keep production bundles clean.

### C2 — `packages/database/src/testing/run-migrations.ts`

```ts
import fs from "node:fs";
import path from "node:path";
import type { D1Database } from "@cloudflare/workers-types";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../migrations_fresh");

export async function runMigrations(db: D1Database): Promise<void> {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const stmt of statements) {
      try {
        await db.prepare(stmt).run();
      } catch (err) {
        throw new Error(
          `[runMigrations] failed in ${file}: ${(err as Error).message}\nSQL: ${stmt.slice(0, 200)}`,
        );
      }
    }
  }
}

export async function listUserTables(db: D1Database): Promise<string[]> {
  const result = await db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'`,
    )
    .all<{ name: string }>();
  return (result.results ?? []).map((r) => r.name);
}
```

**Note on DDL via `prepare().run()`:** D1 supports both `.exec(bulkSql)` (multi-statement) and `.prepare(singleStmt).run()` (single-statement). Since we split on `statement-breakpoint` already, each statement is single, so `prepare().run()` is the correct and sufficient API. This also gives better error messages when a specific statement fails.

### C3 — `apps/api/src/__tests__/integration/helpers/real-test-app.ts`

```ts
import { createApp } from "../../../index"; // production factory
import { createTestDatabase, type TestDatabase } from "@makanmakan/database/testing";
import type { Env } from "../../../types/env";
import { buildAuthHelper, type AuthHelper } from "./issue-test-jwt";

export interface RealIntegrationTestApp {
  app: ReturnType<typeof createApp>;
  testDb: TestDatabase;
  env: Env;
  authHelper: AuthHelper;
  dispose(): Promise<void>;
}

export async function createRealIntegrationTestApp(): Promise<RealIntegrationTestApp> {
  const testDb = await createTestDatabase();
  const env = buildTestEnv(testDb);
  const app = createApp(env);
  const authHelper = buildAuthHelper();

  return {
    app,
    testDb,
    env,
    authHelper,
    dispose: async () => {
      await testDb.dispose();
    },
  };
}

function buildTestEnv(testDb: TestDatabase): Env {
  return {
    NODE_ENV: "test",
    JWT_SECRET: "test-jwt-secret-do-not-use-in-prod",
    API_VERSION: "v1",
    ENCRYPTION_KEY: "test-encryption-key-32-bytes-long!!",
    DB: testDb.bindings.DB,
    CACHE_KV: testDb.bindings.CACHE_KV,
    TOKEN_BLACKLIST: testDb.bindings.TOKEN_BLACKLIST,
    RATE_LIMIT_KV: testDb.bindings.RATE_LIMIT_KV,
    IMAGES_BUCKET: testDb.bindings.IMAGES_BUCKET,
    BACKUP_STORAGE: testDb.bindings.BACKUP_STORAGE,
    JOB_QUEUE: { send: async () => {} } as unknown as Env["JOB_QUEUE"],
    PRELOAD_QUEUE: { send: async () => {} } as unknown as Env["PRELOAD_QUEUE"],
    REVALIDATION_QUEUE: { send: async () => {} } as unknown as Env["REVALIDATION_QUEUE"],
    REALTIME_ORDERS: createDurableObjectStub(),
    REALTIME_SESSION: createDurableObjectStub(),
    ANALYTICS_ENGINE: { writeDataPoint: () => {} },
    // MOCK_DRIZZLE_DB deliberately omitted
  } as Env;
}

// In-memory Durable Object stub. Stores per-id state in a Map.
// Does NOT emulate transitions, storage API, or alarms — tests that need
// real DO behavior should not use this stub.
function createDurableObjectStub(): DurableObjectNamespace {
  const state = new Map<string, Map<string, unknown>>();
  return {
    idFromName: (name: string) =>
      ({ toString: () => name, name }) as unknown as ReturnType<
        DurableObjectNamespace["idFromName"]
      >,
    idFromString: (id: string) =>
      ({ toString: () => id }) as unknown as ReturnType<
        DurableObjectNamespace["idFromString"]
      >,
    newUniqueId: () =>
      ({ toString: () => crypto.randomUUID() }) as unknown as ReturnType<
        DurableObjectNamespace["newUniqueId"]
      >,
    get: (id: any) => {
      const idStr = id.toString();
      if (!state.has(idStr)) state.set(idStr, new Map());
      return {
        fetch: async () => new Response("{}", { status: 200 }),
      } as unknown as ReturnType<DurableObjectNamespace["get"]>;
    },
  } as DurableObjectNamespace;
}
```

### C4 — `apps/api/src/__tests__/integration/helpers/issue-test-jwt.ts`

```ts
import { sign } from "hono/jwt"; // or the project's existing JWT helper

const TEST_SECRET = "test-jwt-secret-do-not-use-in-prod";

export type UserRole = 0 | 1 | 2 | 3 | 4 | 5;

export function issueTestJwt(
  role: UserRole,
  claims?: {
    userId?: number;
    restaurantId?: string;
    expiresInSeconds?: number;
  },
): string {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: String(claims?.userId ?? 1),
      id: claims?.userId ?? 1,
      role,
      restaurantId: claims?.restaurantId ?? "1",
      iat: now,
      exp: now + (claims?.expiresInSeconds ?? 3600),
    },
    TEST_SECRET,
  );
}

export interface AuthHelper {
  adminToken(restaurantId?: string): string;
  ownerToken(userId: number, restaurantId: string): string;
  staffToken(userId: number, role: UserRole, restaurantId: string): string;
  customerToken(userId: number): string;
}

export function buildAuthHelper(): AuthHelper {
  return {
    adminToken: (restaurantId = "1") => issueTestJwt(0, { restaurantId }),
    ownerToken: (userId, restaurantId) => issueTestJwt(1, { userId, restaurantId }),
    staffToken: (userId, role, restaurantId) => issueTestJwt(role, { userId, restaurantId }),
    customerToken: (userId) => issueTestJwt(5, { userId }),
  };
}
```

Shape matches the legacy `AuthHelper` deliberately, so migrating a test file from legacy to real is a drop-in.

### C5 — `apps/api/src/__tests__/integration/helpers/start-test-api-server.ts`

```ts
import { serve } from "@hono/node-server";
import { createRealIntegrationTestApp, type RealIntegrationTestApp } from "./real-test-app";
import { buildSeedHelpers } from "./seed-helper";
import type { TestDatabase } from "@makanmakan/database/testing";

export interface TestApiServerHandle {
  url: string;
  testDb: TestDatabase;
  authHelper: RealIntegrationTestApp["authHelper"];
  seed: {
    restaurant(overrides?: any): Promise<{ id: string | number }>;
    menuItem(restaurantId: string | number, overrides?: any): Promise<{ id: number }>;
    order(restaurantId: string | number, overrides?: any): Promise<{ id: number }>;
  };
  stop(): Promise<void>;
}

export async function startTestApiServer(
  options: { port?: number } = {},
): Promise<TestApiServerHandle> {
  const testApp = await createRealIntegrationTestApp();
  const server = serve({ fetch: testApp.app.fetch, port: options.port ?? 0 });
  const address = (
    server as unknown as { address(): { port: number } }
  ).address();
  const url = `http://127.0.0.1:${address.port}`;

  return {
    url,
    testDb: testApp.testDb,
    authHelper: testApp.authHelper,
    seed: buildSeedHelpers(testApp.testDb),
    stop: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await testApp.dispose();
    },
  };
}
```

**Not used in Phase 1.** This component is implemented and exported now so the Phase 2 frontend spec has a stable surface to target. Phase 1 smoke tests use `testApp.app.fetch(req)` directly (no HTTP overhead).

### C6 — Reference smoke tests (Step 3)

Four files, all following the skeleton below. Each file exercises a different Drizzle hazard area.

**`orders.real.integration.test.ts`** — verifies `timestamp_ms` round-trip:

```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { createRealIntegrationTestApp, type RealIntegrationTestApp } from "./helpers/real-test-app";
import { restaurantFactory, orderFactory } from "@makanmakan/testing-utils";

describe("Orders API — real integration", () => {
  let testApp: RealIntegrationTestApp;

  beforeAll(async () => {
    testApp = await createRealIntegrationTestApp();
  });
  afterAll(async () => {
    await testApp.dispose();
  });
  beforeEach(async () => {
    await testApp.testDb.truncateAll();
  });

  it("round-trips created_at_ms through POST /orders -> GET /orders/:id", async () => {
    const restaurant = restaurantFactory.build();
    await seedRestaurant(testApp.testDb, restaurant);

    const token = testApp.authHelper.customerToken(42);
    const payload = orderFactory.build({ restaurantId: restaurant.id }).toPayload();

    const postRes = await testApp.app.fetch(
      new Request("https://test/api/v1/orders", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      }),
    );
    expect(postRes.status).toBe(201);
    const { data: created } = await postRes.json();

    const getRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/orders/${created.id}`, {
        headers: { authorization: `Bearer ${token}` },
      }),
    );
    const { data: fetched } = await getRes.json();

    expect(fetched.id).toBe(created.id);
    expect(fetched.createdAt).toEqual(created.createdAt);
    expect(typeof fetched.createdAt).toBe("number");
    expect(Math.abs(fetched.createdAt - Date.now())).toBeLessThan(5000);
  });
});
```

**`menu.real.integration.test.ts`** — verifies JOINs across `categories`, `menuItems`, `featuredItems`:

```ts
it("returns menu with categories and featured items joined correctly", async () => {
  const restaurant = await seedRestaurant(testApp.testDb, ...);
  await seedCategory(testApp.testDb, { restaurantId: restaurant.id, name: "Mains" });
  await seedMenuItem(testApp.testDb, { restaurantId: restaurant.id, categoryId: cat.id, isFeatured: true });

  const res = await testApp.app.fetch(
    new Request(`https://test/api/v1/menu/${restaurant.id}`),
  );
  const { data } = await res.json();

  expect(data.restaurant.id).toBe(restaurant.id);
  expect(data.categories).toHaveLength(1);
  expect(data.menuItems[0].categoryId).toBe(cat.id);
  expect(data.featuredItems).toHaveLength(1);
});
```

**`customer-orders.real.integration.test.ts`** — verifies JWT + RBAC + `restaurantId` scope:

```ts
it("returns only the authenticated customer's orders", async () => {
  const r = await seedRestaurant(...);
  const order1 = await seedOrder(testApp.testDb, { restaurantId: r.id, customerId: 100 });
  const order2 = await seedOrder(testApp.testDb, { restaurantId: r.id, customerId: 200 });

  const tokenCustomer100 = testApp.authHelper.customerToken(100);
  const res = await testApp.app.fetch(
    new Request("https://test/api/v1/customers/me/orders", {
      headers: { authorization: `Bearer ${tokenCustomer100}` },
    }),
  );
  const { data } = await res.json();

  expect(data.orders).toHaveLength(1);
  expect(data.orders[0].id).toBe(order1.id);
});

it("rejects requests without a valid JWT", async () => {
  const res = await testApp.app.fetch(
    new Request("https://test/api/v1/customers/me/orders"),
  );
  expect(res.status).toBe(401);
});
```

**`discovery.real.integration.test.ts`** — verifies aggregate SQL:

```ts
it("returns correct aggregate counts and paginates", async () => {
  for (let i = 0; i < 25; i++) {
    await seedMenuItem(testApp.testDb, { name: `Nasi Lemak ${i}` });
  }

  const res = await testApp.app.fetch(
    new Request("https://test/api/v1/discovery/search?q=Nasi&page=1&limit=10"),
  );
  const { data } = await res.json();

  expect(data.total).toBe(25);
  expect(data.results).toHaveLength(10);
  expect(data.page).toBe(1);
});
```

---

## Data Flow

```
Test file (*.real.integration.test.ts)
  │
  ├─ beforeAll: createRealIntegrationTestApp()
  │    ├─ createTestDatabase()
  │    │    ├─ new Miniflare({ d1Databases, kvNamespaces, r2Buckets })
  │    │    ├─ mf.getBindings() → { DB, CACHE_KV, ..., IMAGES_BUCKET, ... }
  │    │    └─ runMigrations(bindings.DB) → reads migrations_fresh/*.sql
  │    ├─ buildTestEnv(testDb) → full Env object with real + stub bindings
  │    └─ createApp(env) → production Hono factory
  │
  ├─ beforeEach: testDb.truncateAll() → DELETE FROM each table + reset sequences
  │
  ├─ test body:
  │    ├─ seed fixtures via factory (testDb.drizzle.insert(...).values(...))
  │    ├─ testApp.app.fetch(new Request(...)) → full Hono pipeline
  │    │    ├─ middleware (CORS, auth, rate-limit)  ── real KV used
  │    │    ├─ route handler → service → drizzle(env.DB) → real D1
  │    │    └─ response shaped by real error handler
  │    └─ assert response + DB state
  │
  └─ afterAll: testApp.dispose() → mf.dispose()
```

No `vi.mock()` at any layer. Every call crosses a real boundary.

---

## Testing Strategy (for the test foundation itself)

The foundation components are themselves testable:

| Component                      | Test                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| `createTestDatabase`           | `createTestDatabase.test.ts`: asserts migrations run, listUserTables returns expected set |
| `runMigrations`                | Covered by `createTestDatabase.test.ts` transitively                                        |
| `truncateAll`                  | Insert row → truncateAll → assert empty + sequence reset to 0                              |
| `createRealIntegrationTestApp` | Smoke: boot app, hit `/health`, expect 200; dispose                                        |
| `startTestApiServer`           | Boot server, make real HTTP `fetch(url + /health)`, expect 200; stop                       |
| `issueTestJwt`                 | Token decodes with expected claims; role values round-trip                                 |
| `check-integration-allowlist.cjs` | Unit-test with temp fixtures: known-good file passes, unknown file fails                |

These foundation tests live alongside the components and run as part of `pnpm test`. They are not themselves integration tests.

---

## Handoff Contract (Phase 2 seam lock)

This section is load-bearing — it is the interface between this spec (Phase 1) and the forthcoming Frontend Integration Test Foundation spec (Phase 2). **Any change to the shape or semantics below requires a revision to both specs.**

### Exported API surface (the only things Phase 2 may depend on)

1. **`createTestDatabase()`** from `@makanmakan/database/testing` — shape defined in §C1
2. **`createRealIntegrationTestApp()`** from `apps/api/src/__tests__/integration/helpers/real-test-app.ts` — shape defined in §C3
3. **`startTestApiServer(options?)`** from `apps/api/src/__tests__/integration/helpers/start-test-api-server.ts` — shape defined in §C5. This is the **only** way frontend tests obtain an HTTP origin URL
4. **`issueTestJwt(role, claims?)`** + **`buildAuthHelper()`** from `apps/api/src/__tests__/integration/helpers/issue-test-jwt.ts` — shape defined in §C4

Nothing else from Phase 1 is part of the public contract. Internal helpers (`runMigrations`, `buildTestEnv`, DO stubs) may evolve freely without breaking Phase 2.

### Canonical file naming convention

- **Backend** real integration tests: `apps/api/src/__tests__/integration/*.real.integration.test.ts`
- **Frontend** real integration tests (when Phase 2 lands): `apps/<frontend-app>/src/__tests__/integration/*.real.integration.test.ts`

The `*.real.integration.test.ts` infix is the **canonical marker** and is hard-coded into `scripts/check-integration-allowlist.cjs` as the auto-allowed pattern.

### Trigger criteria for Phase 2 (hard gate)

Phase 2 spec authorship begins only when **all** of the following are true:

1. ✅ `pnpm --filter @makanmakan/database test` is green on `main`
2. ✅ `pnpm --filter makanmakan-api test:real-integration` is green on `main` (4 reference smokes all pass)
3. ✅ Smoke tests pass 20 consecutive runs without flake:
   ```bash
   for i in {1..20}; do pnpm --filter makanmakan-api test:real-integration || { echo "FLAKE on run $i"; exit 1; }; done
   ```
   This MUST be run on CI, not only locally. The result is pasted as a comment on the Phase 2 kickoff issue.
4. ✅ `scripts/check-integration-allowlist.cjs` is a required CI check on `main`
5. ✅ **Dogfood gate**: a fifth real integration smoke test has been added by an engineer who is **not** the author of `createRealIntegrationTestApp`. This proves the API is usable without implicit context from the original author.

If criterion 5 cannot be met within two weeks of Phase 1 merge, the foundation is treated as having discoverability debt and a usage guide is written before Phase 2 begins.

### Non-contract expectations (documented, not enforced)

- Phase 2 is encouraged to use MSW **only** for non-integration tests (unit/component). Integration tests in Phase 2 call `startTestApiServer()`, not MSW.
- Phase 2 may add new seed helpers to `startTestApiServer().seed`, but must not reshape the existing three (`restaurant`, `menuItem`, `order`) without bumping the contract version in this document.

---

## Risks and Escape Hatches

| Risk                                                                             | Likelihood | Mitigation                                                                                                                    |
| -------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/index.ts` is not currently a factory; refactor blast radius unknown | Medium     | Step 2 sub-task 1 is the refactor, reviewed independently; if diff > 200 lines, split into prerequisite PR                    |
| Miniflare D1 diverges from production D1 in unexpected ways                       | Low        | Out of scope for this spec; backend smokes against staging D1 are the owning team's responsibility                            |
| 15 migrations run slower than projected (>500ms per file)                         | Low        | Instrument with `console.time("migrations")`; if breach, implement snapshot copy (dump-and-restore) as Step 1-alt             |
| Vitest parallel workers × per-file miniflare instances exhaust memory             | Medium     | Set `poolOptions.threads.maxThreads: 4` in new vitest config; `dispose()` in `afterAll` releases workerd subprocess handles   |
| Legacy test imports break after `git mv`                                          | High       | Run `pnpm typecheck` immediately after directory moves; all breakages are mechanical path fixes                               |
| Allowlist CI check false-positives legitimate new integration tests               | Medium     | CI failure message includes actionable instructions: "If this is a real integration test, rename to `*.real.integration.test.ts`; if legacy, add to allowlist JSON with justification in PR description" |
| `createApp(env)` factory cannot be extracted without touching middleware order   | Medium     | Document the middleware order assumption inside the factory; add a one-line comment in the extraction PR                      |
| miniflare subprocess cleanup fails on test timeout, leaving zombie handles        | Medium     | `afterAll` wraps `dispose()` in try/catch with hard process termination fallback only in CI; local watch mode tolerates leaks           |

---

## Implementation Checklist

**Ordering note:** The logical numbering (Step 1 → 4) in §Scope reflects what's being built. The physical execution order differs because Step 4's directory moves must happen **before** Step 2 writes into the reclaimed `apps/api/src/__tests__/integration/` path. Follow this checklist in listed order.

### Phase 1a: Legacy move (prerequisite for Step 2's path)

- [ ] `git mv apps/api/src/__tests__/integration apps/api/src/__tests__/integration-legacy-mockdrizzle`
- [ ] `git mv apps/admin-dashboard/src/tests/integration apps/admin-dashboard/src/tests/component-flows`
- [ ] `git mv apps/kitchen-display/tests/integration apps/kitchen-display/tests/component-flows`
- [ ] Run `pnpm typecheck`; fix all broken import paths (mechanical)
- [ ] Run `pnpm test:integration` (which targets the old `apps/api/vitest.integration.config.ts`); update the config's `include` path to point at `integration-legacy-mockdrizzle/**` so legacy tests keep running
- [ ] Verify all pre-existing test commands (`pnpm test`, `pnpm test:integration`) remain green after the moves
- [ ] Commit as a dedicated PR (no new code, pure rename) for clean review

### Step 1: `packages/database/src/testing/createTestDatabase.ts`

- [ ] Install `miniflare` as devDep in `packages/database`
- [ ] Create `packages/database/src/testing/` directory
- [ ] Write `run-migrations.ts` (C2)
- [ ] Write `create-test-database.ts` (C1)
- [ ] Write `packages/database/src/testing/index.ts` barrel
- [ ] Write `create-test-database.test.ts` foundation tests
- [ ] Update `packages/database/package.json` `exports` field to include `./testing`
- [ ] `pnpm --filter @makanmakan/database test` green

### Step 2: `createRealIntegrationTestApp`

- [ ] Audit `apps/api/src/index.ts`; if not already a `createApp(env)` factory, extract it (separate PR if > 200 lines)
- [ ] Install `@hono/node-server` as devDep in `apps/api`
- [ ] Create `apps/api/src/__tests__/integration/helpers/` directory (new canonical path; legacy already moved in Step 4)
- [ ] Write `issue-test-jwt.ts` (C4)
- [ ] Write `real-test-app.ts` (C3)
- [ ] Write `start-test-api-server.ts` (C5) — implemented now, validated in Phase 2
- [ ] Write `seed-helper.ts` — thin wrapper over `@makanmakan/testing-utils` factories
- [ ] Add `apps/api/vitest.real-integration.config.ts` with `include: ["src/__tests__/integration/**/*.real.integration.test.ts"]`
- [ ] Add `test:real-integration` script to `apps/api/package.json`
- [ ] Add root-level `test:real-integration` turbo task

### Step 3: 4 reference smoke tests

- [ ] `orders.real.integration.test.ts` — verifies `timestamp_ms` round-trip
- [ ] `menu.real.integration.test.ts` — verifies JOINs
- [ ] `customer-orders.real.integration.test.ts` — verifies auth + RBAC + scope
- [ ] `discovery.real.integration.test.ts` — verifies aggregate SQL + pagination
- [ ] All four green on `pnpm --filter makanmakan-api test:real-integration`
- [ ] Run 20× flake check locally before merging

### Step 4: Annotate legacy + freeze enforcement

Note: directory moves already done in Phase 1a. This step adds header comments and the allowlist CI check.

- [ ] Classify each inline `*integration*.test.ts` as "mocked legacy" (Template A) or "genuine module integration" (Template B)
- [ ] Add Template A header comment to each inline legacy file (expected 7 API feature files + 1 admin dashboard integration file + 1 realtime file after classification; final list derived in Phase 1a audit)
- [ ] Add Template B header comment to each genuine module-integration file (expected: customer-app i18n, admin virtual-scroll)
- [ ] Create `tests/.integration-allowlist.json`
- [ ] Create `scripts/check-integration-allowlist.cjs`
- [ ] Add the check script as a required CI step
- [ ] Verify: adding a dummy `foo-integration.test.ts` outside allowlist fails CI
- [ ] Verify: adding `bar.real.integration.test.ts` under canonical path passes CI

### Verification before marking Phase 1 complete

- [ ] All Step 1–4 items checked
- [ ] `pnpm test` green on `main`
- [ ] `pnpm test:real-integration` green on `main`
- [ ] 20× consecutive `test:real-integration` runs green on CI
- [ ] Allowlist CI check is a required check on `main`
- [ ] Dogfood gate: 5th real smoke test added by a second engineer

---

## Header Comment Templates

**Template A — Mocked services, legacy "integration" (the fake kind):**

```ts
/**
 * LEGACY: Unit test with mocked services, NOT a real integration test.
 *
 * This file uses vi.mock() on service/DB boundaries. It verifies component/
 * route JS logic but does NOT verify Drizzle SQL, D1 parity, or auth middleware
 * end-to-end. A real pass here does not guarantee a real pass in production.
 *
 * For real integration testing, see:
 *   docs/superpowers/specs/2026-04-13-real-integration-test-foundation-design.md
 *   apps/api/src/__tests__/integration/*.real.integration.test.ts
 */
```

**Template B — Genuine module-integration (multiple modules wired, no HTTP/DB):**

```ts
/**
 * Module integration test: exercises interaction between X and Y without HTTP/DB.
 * This is NOT an end-to-end API integration test — it does not hit routes or D1.
 */
```

---

## Open Questions

None. All decisions locked per §Architecture Decisions.

---

## References

- `apps/api/src/__tests__/helpers/test-utils.ts` — existing `SharedDataStore` + `MockDrizzle` (to be kept under `integration-legacy-mockdrizzle/helpers/`)
- `apps/api/src/__tests__/integration/helpers/extended-test-app.ts` — existing hand-mounted route registry (to be kept as legacy reference)
- `packages/database/migrations_fresh/` — source of truth for real test migrations
- Drizzle D1 driver: https://orm.drizzle.team/docs/get-started-sqlite#cloudflare-d1
- Miniflare bindings: https://miniflare.dev/storage/d1
- CLAUDE.md §Testing Standards — factory usage conventions still apply in new tests
- Memory: `MEMORY.md` → `ci_tooling_gotchas.md` (pnpm 10 native modules, D1 vs better-sqlite3 adapter note)
