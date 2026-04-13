# Real Integration Test Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the double-layered fake in API "integration" tests with a real Drizzle + real D1 foundation, reclaim the `integration/` folder name, and lock frontend Phase 2 seam via handoff contract.

**Architecture:** Use miniflare's real `D1Database` binding with `drizzle-orm/d1` driver. Per-file DB lifecycle. Reuse production `createApp(env)` Hono factory. Legacy tests move to `integration-legacy-mockdrizzle/` via `git mv` to preserve history. Freeze enforced via allowlist JSON + Node CI check script.

**Tech Stack:** TypeScript, Drizzle ORM, `drizzle-orm/d1`, miniflare v3, Hono, `@hono/node-server`, Vitest, pnpm workspaces, Turborepo.

**Spec:** `docs/superpowers/specs/2026-04-13-real-integration-test-foundation-design.md`

---

## File Structure

### Created

| Path | Responsibility |
|---|---|
| `packages/database/src/testing/index.ts` | Barrel export for the testing subpath |
| `packages/database/src/testing/run-migrations.ts` | Reads `migrations_fresh/*.sql`, splits statements, executes in order; also exposes `listUserTables()` |
| `packages/database/src/testing/create-test-database.ts` | `createTestDatabase()` factory: spins up miniflare, returns `TestDatabase` with `db`, `bindings`, `drizzle`, `truncateAll`, `dispose` |
| `packages/database/src/testing/__tests__/create-test-database.test.ts` | Foundation tests |
| `packages/database/src/testing/__tests__/run-migrations.test.ts` | Foundation tests |
| `apps/api/src/__tests__/integration/helpers/issue-test-jwt.ts` | `issueTestJwt()` + `buildAuthHelper()` |
| `apps/api/src/__tests__/integration/helpers/real-test-app.ts` | `createRealIntegrationTestApp()` |
| `apps/api/src/__tests__/integration/helpers/durable-object-stub.ts` | `createDurableObjectStub()` helper |
| `apps/api/src/__tests__/integration/helpers/seed-helper.ts` | `buildSeedHelpers()` — thin factory-backed seeders |
| `apps/api/src/__tests__/integration/helpers/start-test-api-server.ts` | `startTestApiServer()` for Phase 2 frontend use |
| `apps/api/src/__tests__/integration/helpers/__tests__/issue-test-jwt.test.ts` | Helper unit tests |
| `apps/api/src/__tests__/integration/helpers/__tests__/real-test-app.test.ts` | Helper unit tests |
| `apps/api/src/__tests__/integration/helpers/__tests__/start-test-api-server.test.ts` | Helper unit tests |
| `apps/api/src/__tests__/integration/orders.real.integration.test.ts` | Step 3 smoke |
| `apps/api/src/__tests__/integration/menu.real.integration.test.ts` | Step 3 smoke |
| `apps/api/src/__tests__/integration/customer-orders.real.integration.test.ts` | Step 3 smoke |
| `apps/api/src/__tests__/integration/discovery.real.integration.test.ts` | Step 3 smoke |
| `apps/api/vitest.real-integration.config.ts` | Vitest config for the new real integration path |
| `apps/api/src/__tests__/integration-legacy-mockdrizzle/README.md` | Loud warning not to add files |
| `tests/.integration-allowlist.json` | Explicit debt ledger |
| `scripts/check-integration-allowlist.cjs` | CI enforcement |
| `scripts/__tests__/check-integration-allowlist.test.cjs` | Unit test for the check script |

### Modified

| Path | Change |
|---|---|
| `apps/api/src/index.ts` | Extract top-level Hono mounting into `createApp(env)` factory |
| `apps/api/vitest.integration.config.ts` | Update `include` to point at `integration-legacy-mockdrizzle/**` |
| `apps/api/package.json` | Add `@hono/node-server` devDep; add `test:real-integration` script |
| `packages/database/package.json` | Add `miniflare` + `@cloudflare/workers-types` devDeps; add `exports` field with `./testing` subpath |
| `packages/database/tsup.config.ts` (or equivalent) | Add second entrypoint for testing subpath |
| `apps/api/src/__tests__/helpers/test-utils.ts` | Path hoisted with the folder move (no code change) |
| `.github/workflows/*.yml` (CI) | Add `scripts/check-integration-allowlist.cjs` as required step |
| `turbo.json` | Add `test:real-integration` task (inputs/outputs) |

### Moved (via `git mv`)

| From | To |
|---|---|
| `apps/api/src/__tests__/integration/` | `apps/api/src/__tests__/integration-legacy-mockdrizzle/` |
| `apps/admin-dashboard/src/tests/integration/` | `apps/admin-dashboard/src/tests/component-flows/` |
| `apps/kitchen-display/tests/integration/` | `apps/kitchen-display/tests/component-flows/` |

### Annotated in place (header comment only)

API feature inline legacy files (classified in Task 21):
- `apps/api/src/features/customers/__tests__/integration.test.ts`
- `apps/api/src/features/partnerships/__tests__/integration.test.ts`
- `apps/api/src/features/waiting-list/__tests__/integration.test.ts`
- `apps/api/src/features/tables/__tests__/concurrency-integration.test.ts`
- `apps/api/src/features/orders/__tests__/realtime-integration.test.ts`
- `apps/api/src/services/__tests__/broadcast-integration.test.ts`
- `apps/admin-dashboard/src/__tests__/integration/dashboard-integration.test.ts`
- `apps/realtime/src/__tests__/websocket-integration.test.ts`
- `apps/customer-app/src/tests/i18n.integration.test.ts` (Template B)
- `apps/admin-dashboard/src/__tests__/virtual-scroll-integration.test.ts` (Template B)

---

## Task 1: Move legacy integration folders

**Files:**
- Move: `apps/api/src/__tests__/integration/` → `apps/api/src/__tests__/integration-legacy-mockdrizzle/`
- Move: `apps/admin-dashboard/src/tests/integration/` → `apps/admin-dashboard/src/tests/component-flows/`
- Move: `apps/kitchen-display/tests/integration/` → `apps/kitchen-display/tests/component-flows/`
- Modify: `apps/api/vitest.integration.config.ts`
- Create: `apps/api/src/__tests__/integration-legacy-mockdrizzle/README.md`
- Create: `apps/api/src/__tests__/integration/.gitkeep` (keep reclaimed folder)

- [ ] **Step 1: Move the three legacy folders**

```bash
git mv apps/api/src/__tests__/integration apps/api/src/__tests__/integration-legacy-mockdrizzle
git mv apps/admin-dashboard/src/tests/integration apps/admin-dashboard/src/tests/component-flows
git mv apps/kitchen-display/tests/integration apps/kitchen-display/tests/component-flows
```

- [ ] **Step 2: Reclaim the canonical `integration/` folder for the new real path**

```bash
mkdir -p apps/api/src/__tests__/integration
touch apps/api/src/__tests__/integration/.gitkeep
```

- [ ] **Step 3: Update `apps/api/vitest.integration.config.ts` include path**

Open `apps/api/vitest.integration.config.ts` and change the `include` array.

Before:
```ts
include: ["src/__tests__/integration/**/*.integration.test.ts"],
```

After:
```ts
include: ["src/__tests__/integration-legacy-mockdrizzle/**/*.integration.test.ts"],
```

- [ ] **Step 4: Write the legacy README warning**

Create `apps/api/src/__tests__/integration-legacy-mockdrizzle/README.md`:

```markdown
# Legacy Mock-Drizzle "Integration" Tests

**Do not add new files to this folder.**

These tests are unit tests with mocked service/DB boundaries, not real
integration tests. They use `MockDrizzle` (a `Proxy` fake) and `SharedDataStore`
(`sql.js` WASM) — Drizzle's SQL compiler is never exercised.

For real integration tests, see:

- Spec: `docs/superpowers/specs/2026-04-13-real-integration-test-foundation-design.md`
- New path: `apps/api/src/__tests__/integration/*.real.integration.test.ts`
- Foundation: `packages/database/src/testing/create-test-database.ts`

Files here are kept for:
1. Backward compatibility — they still verify route handler JS logic
2. Blame/history via `git log --follow`
3. Incident-driven migration only — do not mass-migrate

When a legacy test gives a false pass that production caught, migrate that
specific test to the new foundation as part of the incident fix.
```

- [ ] **Step 5: Run typecheck to find broken imports**

Run: `pnpm typecheck`
Expected: may fail with path errors referencing the moved folders. Note each failure.

- [ ] **Step 6: Fix broken import paths (mechanical)**

For each typecheck failure, update the import path. Common patterns:
- `../integration/helpers/...` → `../integration-legacy-mockdrizzle/helpers/...`
- `../../tests/integration/...` → `../../tests/component-flows/...`

Re-run `pnpm typecheck` until clean.

- [ ] **Step 7: Run legacy integration tests to verify they still pass**

Run: `pnpm test:integration`
Expected: the same tests pass as before the move (same count, same names).

- [ ] **Step 8: Commit as a dedicated rename PR**

```bash
git add -A
git commit -m "refactor(tests): relabel legacy integration folders

Moves the fake 'integration' test folders to loud names that reflect their
true nature (mocked service tests, not real integration). Reclaims the
canonical integration/ folder name for the forthcoming real foundation.

- apps/api/src/__tests__/integration/ -> integration-legacy-mockdrizzle/
- apps/admin-dashboard/src/tests/integration/ -> component-flows/
- apps/kitchen-display/tests/integration/ -> component-flows/

Updates apps/api/vitest.integration.config.ts include path.
No test logic changes; verified via pnpm test:integration."
```

---

## Task 2: Add database-package devDeps + exports field

**Files:**
- Modify: `packages/database/package.json`
- Modify: `packages/database/tsup.config.ts` (or create if missing)

- [ ] **Step 1: Install miniflare and workers-types in the database package**

```bash
pnpm --filter @makanmakan/database add -D miniflare@^3.0.0 @cloudflare/workers-types@^4.20250826.0
```

Note: `@cloudflare/workers-types` is already in devDeps per `packages/database/package.json:36`; pnpm will no-op that one and add miniflare only.

- [ ] **Step 2: Verify miniflare was added**

Run: `grep miniflare packages/database/package.json`
Expected: `"miniflare": "^3.x.x"` appears in devDependencies.

- [ ] **Step 3: Add `exports` field to `packages/database/package.json`**

Open `packages/database/package.json`. Below the `"types"` field, add:

```json
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./testing": {
      "types": "./dist/testing/index.d.ts",
      "import": "./dist/testing/index.js",
      "require": "./dist/testing/index.cjs"
    }
  },
```

- [ ] **Step 4: Check the current tsup config**

Run: `cat packages/database/tsup.config.ts 2>/dev/null || echo "NOT_EXIST"`

If NOT_EXIST, skip to Step 5. If it exists, note its `entry` field and add the new `src/testing/index.ts` entry in Step 5.

- [ ] **Step 5: Update tsup config for the new entrypoint**

If `packages/database/tsup.config.ts` does not exist, create it:

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "testing/index": "src/testing/index.ts",
  },
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  sourcemap: true,
});
```

If it exists, modify the `entry` field to include both entrypoints as above.

- [ ] **Step 6: Create the testing folder placeholder**

```bash
mkdir -p packages/database/src/testing
```

Create `packages/database/src/testing/index.ts` with a placeholder:

```ts
// Placeholder — will be filled in Task 5
export {};
```

- [ ] **Step 7: Verify the build succeeds**

Run: `pnpm --filter @makanmakan/database build`
Expected: `dist/index.js`, `dist/index.d.ts`, `dist/testing/index.js`, `dist/testing/index.d.ts` all produced.

- [ ] **Step 8: Commit**

```bash
git add packages/database/package.json packages/database/tsup.config.ts packages/database/src/testing pnpm-lock.yaml
git commit -m "chore(database): add miniflare devDep + testing subpath export

Prepares @makanmakan/database for the real integration test foundation by
adding miniflare and exposing a ./testing subpath. No runtime code yet."
```

---

## Task 3: Implement `listUserTables` helper (TDD)

**Files:**
- Create: `packages/database/src/testing/run-migrations.ts`
- Create: `packages/database/src/testing/__tests__/run-migrations.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/database/src/testing/__tests__/run-migrations.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Miniflare } from "miniflare";
import type { D1Database } from "@cloudflare/workers-types";
import { listUserTables } from "../run-migrations";

describe("listUserTables", () => {
  let mf: Miniflare;
  let db: D1Database;

  beforeAll(async () => {
    mf = new Miniflare({
      modules: true,
      script: "export default {};",
      d1Databases: { DB: ":memory:" },
    });
    const bindings = await mf.getBindings<{ DB: D1Database }>();
    db = bindings.DB;
  });

  afterAll(async () => {
    await mf.dispose();
  });

  it("returns an empty array for a fresh database", async () => {
    const tables = await listUserTables(db);
    expect(tables).toEqual([]);
  });

  it("returns user table names, excluding sqlite_* and drizzle migrations metadata", async () => {
    await db.prepare(`CREATE TABLE foo (id INTEGER PRIMARY KEY)`).run();
    await db.prepare(`CREATE TABLE bar (id INTEGER PRIMARY KEY)`).run();
    await db.prepare(`CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY)`).run();

    const tables = await listUserTables(db);
    expect(tables.sort()).toEqual(["bar", "foo"]);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @makanmakan/database test run-migrations`
Expected: FAIL with `Cannot find module '../run-migrations'` or similar.

- [ ] **Step 3: Write minimal implementation**

Create `packages/database/src/testing/run-migrations.ts`:

```ts
import type { D1Database } from "@cloudflare/workers-types";

export async function listUserTables(db: D1Database): Promise<string[]> {
  const result = await db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'`,
    )
    .all<{ name: string }>();
  return (result.results ?? []).map((r) => r.name);
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter @makanmakan/database test run-migrations`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/testing/run-migrations.ts packages/database/src/testing/__tests__/run-migrations.test.ts
git commit -m "feat(database/testing): add listUserTables helper"
```

---

## Task 4: Implement `runMigrations` (TDD)

**Files:**
- Modify: `packages/database/src/testing/run-migrations.ts`
- Modify: `packages/database/src/testing/__tests__/run-migrations.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `packages/database/src/testing/__tests__/run-migrations.test.ts`:

```ts
import { runMigrations } from "../run-migrations";

describe("runMigrations", () => {
  let mf: Miniflare;
  let db: D1Database;

  beforeAll(async () => {
    mf = new Miniflare({
      modules: true,
      script: "export default {};",
      d1Databases: { DB: ":memory:" },
    });
    const bindings = await mf.getBindings<{ DB: D1Database }>();
    db = bindings.DB;
  });

  afterAll(async () => {
    await mf.dispose();
  });

  it("runs all migrations from migrations_fresh/ in order", async () => {
    await runMigrations(db);
    const tables = await listUserTables(db);
    // Spot-check a few expected tables from migrations_fresh
    expect(tables).toContain("restaurants");
    expect(tables).toContain("users");
    expect(tables).toContain("orders");
    expect(tables).toContain("menu_items");
    expect(tables.length).toBeGreaterThan(15);
  });

  it("throws a helpful error when a migration statement fails", async () => {
    // Inject a bad statement by mocking fs — skip if too fiddly; alternatively
    // call runMigrations twice (second call should fail on duplicate CREATE TABLE)
    await expect(runMigrations(db)).rejects.toThrow(/runMigrations/);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @makanmakan/database test run-migrations`
Expected: FAIL with `runMigrations is not a function` or missing export.

- [ ] **Step 3: Implement `runMigrations`**

Update `packages/database/src/testing/run-migrations.ts` — add at top:

```ts
import fs from "node:fs";
import path from "node:path";
```

Add the function below `listUserTables`:

```ts
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
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter @makanmakan/database test run-migrations`
Expected: PASS.

- [ ] **Step 5: Instrument timing for the migration run**

Add a one-line `console.time`/`console.timeEnd` pair inside `runMigrations` so CI output shows the duration. This is the fast-path for detecting the "migrations slower than projected" risk from the spec:

```ts
export async function runMigrations(db: D1Database): Promise<void> {
  const label = "[runMigrations]";
  console.time(label);
  try {
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
  } finally {
    console.timeEnd(label);
  }
}
```

- [ ] **Step 6: Re-run tests**

Run: `pnpm --filter @makanmakan/database test run-migrations`
Expected: PASS with a `[runMigrations]: 42.xx ms` line in output.

- [ ] **Step 7: Commit**

```bash
git add packages/database/src/testing/run-migrations.ts packages/database/src/testing/__tests__/run-migrations.test.ts
git commit -m "feat(database/testing): add runMigrations reading migrations_fresh/"
```

---

## Task 5: Implement `createTestDatabase` (TDD)

**Files:**
- Create: `packages/database/src/testing/create-test-database.ts`
- Modify: `packages/database/src/testing/index.ts` (barrel)
- Create: `packages/database/src/testing/__tests__/create-test-database.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/database/src/testing/__tests__/create-test-database.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { createTestDatabase, type TestDatabase } from "../create-test-database";

describe("createTestDatabase", () => {
  let testDb: TestDatabase | null = null;

  afterEach(async () => {
    if (testDb) {
      await testDb.dispose();
      testDb = null;
    }
  });

  it("returns a TestDatabase with db, bindings, drizzle, truncateAll, dispose", async () => {
    testDb = await createTestDatabase();
    expect(testDb.db).toBeDefined();
    expect(testDb.bindings.DB).toBe(testDb.db);
    expect(testDb.bindings.CACHE_KV).toBeDefined();
    expect(testDb.bindings.IMAGES_BUCKET).toBeDefined();
    expect(typeof testDb.drizzle.select).toBe("function");
    expect(typeof testDb.truncateAll).toBe("function");
    expect(typeof testDb.dispose).toBe("function");
  });

  it("has all migrations applied so schema tables exist", async () => {
    testDb = await createTestDatabase();
    const result = await testDb.db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = 'restaurants'`)
      .first();
    expect(result).toBeTruthy();
  });

  it("truncateAll empties user tables and resets sqlite_sequence", async () => {
    testDb = await createTestDatabase();
    await testDb.db.prepare(`INSERT INTO restaurants (name, type, category, address, district, phone, created_at, updated_at) VALUES ('Test', 'cafe', 'food', '1 St', 'KL', '000', '2026-01-01', '2026-01-01')`).run();
    const before = await testDb.db.prepare(`SELECT COUNT(*) as c FROM restaurants`).first<{ c: number }>();
    expect(before?.c).toBe(1);

    await testDb.truncateAll();

    const after = await testDb.db.prepare(`SELECT COUNT(*) as c FROM restaurants`).first<{ c: number }>();
    expect(after?.c).toBe(0);

    const seq = await testDb.db.prepare(`SELECT COUNT(*) as c FROM sqlite_sequence`).first<{ c: number }>();
    expect(seq?.c).toBe(0);
  });

  it("dispose releases the miniflare instance without throwing", async () => {
    testDb = await createTestDatabase();
    await expect(testDb.dispose()).resolves.not.toThrow();
    testDb = null; // prevent afterEach double-dispose
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter @makanmakan/database test create-test-database`
Expected: FAIL with `Cannot find module '../create-test-database'`.

- [ ] **Step 3: Implement `createTestDatabase`**

Create `packages/database/src/testing/create-test-database.ts`:

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
    script: "export default {};",
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

- [ ] **Step 4: Update the barrel export**

Replace contents of `packages/database/src/testing/index.ts`:

```ts
export {
  createTestDatabase,
  type TestDatabase,
  type TestDatabaseBindings,
} from "./create-test-database";
export { runMigrations, listUserTables } from "./run-migrations";
```

- [ ] **Step 5: Run the test and verify it passes**

Run: `pnpm --filter @makanmakan/database test create-test-database`
Expected: PASS (4 tests).

- [ ] **Step 6: Build the package to verify subpath export works**

Run: `pnpm --filter @makanmakan/database build`
Expected: no errors; `dist/testing/index.js` and `dist/testing/index.d.ts` exist.

- [ ] **Step 7: Commit**

```bash
git add packages/database/src/testing/create-test-database.ts packages/database/src/testing/index.ts packages/database/src/testing/__tests__/create-test-database.test.ts
git commit -m "feat(database/testing): createTestDatabase with miniflare D1

Spins up a miniflare instance, runs migrations_fresh/*.sql against a real
D1 binding, returns a TestDatabase with drizzle, truncateAll, and dispose.
This is the Phase 1 foundation for real Drizzle + D1 integration testing."
```

---

## Task 6: Extract `createApp(env)` factory from `apps/api/src/index.ts`

**Files:**
- Modify: `apps/api/src/index.ts`
- Create: `apps/api/src/app-factory.ts`

This is a **refactor without behavior change**. Every existing test must stay green.

- [ ] **Step 1: Read the full `apps/api/src/index.ts` to understand structure**

Run: `cat apps/api/src/index.ts`
Note:
- Lines 1–100: imports
- Line 102: `const app = new Hono<{ Bindings: Env }>();`
- Lines 105–258: middleware chain (`app.use("*", ...)`)
- Lines 259–315: `app.onError`, `app.notFound`, `app.get("/health")`, `app.get("/info")`
- Line 401: `const apiV1 = new Hono<{ Bindings: Env }>();` + mounting
- Line 502: `app.route("/api/v1", apiV1);`
- Line 510: `export default { fetch: app.fetch, ... }`

- [ ] **Step 2: Create `apps/api/src/app-factory.ts` with all middleware + routes inside a function**

The refactor splits `apps/api/src/index.ts` into two files. Everything Hono-related moves; the worker entry (`export default {}`) stays in `index.ts`.

Create `apps/api/src/app-factory.ts`. The content is produced mechanically by moving blocks from `index.ts`:

1. **Copy the import block** from `apps/api/src/index.ts` (lines 1–100, everything before `const app = new Hono`). All `Hono`, middleware, and feature imports go to `app-factory.ts`.
2. **Add** at the top: `import type { Env } from "./types/env";`
3. **Wrap** the Hono app construction in a function:

```ts
// apps/api/src/app-factory.ts
import { Hono } from "hono";
import type { Env } from "./types/env";
// [COPY ALL OTHER IMPORTS FROM index.ts HERE — middleware, features, routers]

export function createApp(_env?: Env): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();

  // [COPY: the entire middleware chain from index.ts lines 105–258 verbatim]
  // Includes: requestIdMiddleware, corsMiddleware, securityHeadersMiddleware,
  // smartCacheMiddleware, cacheWarmingMiddleware, logger, timing, prettyJSON,
  // metricsMiddleware, errorMonitoringMiddleware, monitoringStatsMiddleware,
  // tenantContextMiddleware — ALL app.use("*", ...) calls

  // [COPY: app.onError(...) block from lines 259–301 verbatim]

  // [COPY: app.notFound(...) block from lines 302–315 verbatim]

  // [COPY: app.get("/health"), app.get("/info") from lines 316–400 verbatim]

  // [COPY: const apiV1 = new Hono<...>() and all apiV1.route(...) mounts
  //        from lines 401–501 verbatim]

  // [COPY: app.route("/api/v1", apiV1) from line 502]

  // [COPY: app.get("/") root handler from lines 505–509]

  return app;
}
```

**Why `_env` is unused:** Hono reads per-request env via `c.env`, not module scope. The `_env` parameter exists as a future-proofing hook for tests or callers that want to pass an eagerly-built env (e.g., to configure middleware order based on DEPLOYMENT_MODE). If no current middleware reads it, leave the underscore-prefixed name as a contract placeholder.

- [ ] **Step 3: Replace the body of `apps/api/src/index.ts` with factory consumption**

Replace the file contents with:

```ts
import { createApp } from "./app-factory";
import type { Env } from "./types/env";

const app = createApp();

export default {
  fetch: app.fetch,
  // ... preserve any scheduled/queue handlers that were in the original default export
};
```

Keep any `scheduled`, `queue`, or `email` handlers from the original default export — those are worker runtime entry points, not Hono routes.

- [ ] **Step 4: Run typecheck**

Run: `pnpm --filter makanmakan-api typecheck`
Expected: zero errors. If errors, fix imports.

- [ ] **Step 5: Run the full test suite**

Run: `pnpm --filter makanmakan-api test`
Expected: all tests pass (same count as before refactor).

Run: `pnpm test:integration`
Expected: all legacy integration tests still pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/index.ts apps/api/src/app-factory.ts
git commit -m "refactor(api): extract createApp(env) factory

Moves the top-level Hono mounting from apps/api/src/index.ts into a
createApp(env) factory in app-factory.ts. apps/api/src/index.ts now just
instantiates and exports.

Behavior unchanged; enables reuse by the new real-integration test
foundation (createRealIntegrationTestApp), which needs to build an
identical app against a test-built Env."
```

---

## Task 7: Install `@hono/node-server` in apps/api

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Install the dep**

```bash
pnpm --filter makanmakan-api add -D @hono/node-server@^1.11.0
```

- [ ] **Step 2: Verify install**

Run: `grep "@hono/node-server" apps/api/package.json`
Expected: appears in `devDependencies`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "chore(api): add @hono/node-server devDep for test HTTP seam"
```

---

## Task 8: Implement `issueTestJwt` + `buildAuthHelper` (TDD)

**Files:**
- Create: `apps/api/src/__tests__/integration/helpers/issue-test-jwt.ts`
- Create: `apps/api/src/__tests__/integration/helpers/__tests__/issue-test-jwt.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/__tests__/integration/helpers/__tests__/issue-test-jwt.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { verify } from "hono/jwt";
import { issueTestJwt, buildAuthHelper } from "../issue-test-jwt";

const TEST_SECRET = "test-jwt-secret-do-not-use-in-prod";

describe("issueTestJwt", () => {
  it("issues a token with the expected role and default claims", async () => {
    const token = issueTestJwt(5, { userId: 42 });
    const decoded = (await verify(token, TEST_SECRET)) as any;
    expect(decoded.role).toBe(5);
    expect(decoded.id).toBe(42);
    expect(decoded.sub).toBe("42");
    expect(decoded.restaurantId).toBe("1");
    expect(decoded.exp - decoded.iat).toBe(3600);
  });

  it("honors custom restaurantId and expiry", async () => {
    const token = issueTestJwt(1, {
      userId: 7,
      restaurantId: "r-special",
      expiresInSeconds: 60,
    });
    const decoded = (await verify(token, TEST_SECRET)) as any;
    expect(decoded.restaurantId).toBe("r-special");
    expect(decoded.exp - decoded.iat).toBe(60);
  });
});

describe("buildAuthHelper", () => {
  const helper = buildAuthHelper();

  it("adminToken produces a role=0 token", async () => {
    const decoded = (await verify(helper.adminToken(), TEST_SECRET)) as any;
    expect(decoded.role).toBe(0);
  });

  it("ownerToken produces a role=1 token with userId and restaurantId", async () => {
    const decoded = (await verify(helper.ownerToken(9, "r-1"), TEST_SECRET)) as any;
    expect(decoded.role).toBe(1);
    expect(decoded.id).toBe(9);
    expect(decoded.restaurantId).toBe("r-1");
  });

  it("customerToken produces a role=5 token", async () => {
    const decoded = (await verify(helper.customerToken(100), TEST_SECRET)) as any;
    expect(decoded.role).toBe(5);
    expect(decoded.id).toBe(100);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter makanmakan-api test issue-test-jwt`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement `issue-test-jwt.ts`**

Create `apps/api/src/__tests__/integration/helpers/issue-test-jwt.ts`:

```ts
import { sign } from "hono/jwt";

const TEST_SECRET = "test-jwt-secret-do-not-use-in-prod";

export type UserRole = 0 | 1 | 2 | 3 | 4 | 5;

export interface IssueTestJwtClaims {
  userId?: number;
  restaurantId?: string;
  expiresInSeconds?: number;
}

// hono/jwt `sign` is async, so this function is async too.
export async function issueTestJwt(
  role: UserRole,
  claims?: IssueTestJwtClaims,
): Promise<string> {
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
  adminToken(restaurantId?: string): Promise<string>;
  ownerToken(userId: number, restaurantId: string): Promise<string>;
  staffToken(userId: number, role: UserRole, restaurantId: string): Promise<string>;
  customerToken(userId: number): Promise<string>;
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

Because `issueTestJwt` and every helper method return `Promise<string>`, the test in Step 1 must `await` each helper call. The test file already uses `await verify(...)` — update each call site so it reads `await verify(await helper.adminToken(), TEST_SECRET)`. Do the same for `ownerToken`, `staffToken`, `customerToken` calls in the test.

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter makanmakan-api test issue-test-jwt`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/__tests__/integration/helpers/issue-test-jwt.ts apps/api/src/__tests__/integration/helpers/__tests__/issue-test-jwt.test.ts
git commit -m "feat(api/tests): issueTestJwt + buildAuthHelper"
```

---

## Task 9: Implement `createDurableObjectStub` (TDD)

**Files:**
- Create: `apps/api/src/__tests__/integration/helpers/durable-object-stub.ts`
- Create: `apps/api/src/__tests__/integration/helpers/__tests__/durable-object-stub.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/__tests__/integration/helpers/__tests__/durable-object-stub.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createDurableObjectStub } from "../durable-object-stub";

describe("createDurableObjectStub", () => {
  it("exposes idFromName, idFromString, newUniqueId, and get", () => {
    const stub = createDurableObjectStub();
    expect(typeof stub.idFromName).toBe("function");
    expect(typeof stub.idFromString).toBe("function");
    expect(typeof stub.newUniqueId).toBe("function");
    expect(typeof stub.get).toBe("function");
  });

  it("returns a DO object whose fetch resolves to a 200 empty JSON response", async () => {
    const stub = createDurableObjectStub();
    const id = stub.idFromName("test");
    const obj = stub.get(id);
    const res = await obj.fetch(new Request("https://test/do"));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("{}");
  });

  it("newUniqueId returns distinct ids", () => {
    const stub = createDurableObjectStub();
    const a = stub.newUniqueId().toString();
    const b = stub.newUniqueId().toString();
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter makanmakan-api test durable-object-stub`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the stub**

Create `apps/api/src/__tests__/integration/helpers/durable-object-stub.ts`:

```ts
import type { DurableObjectNamespace } from "@cloudflare/workers-types";

/**
 * In-memory Durable Object stub for integration tests that don't exercise
 * DO state transitions. Returns an empty 200 response for every fetch.
 * Does NOT emulate alarms, storage, or transactions.
 */
export function createDurableObjectStub(): DurableObjectNamespace {
  const state = new Map<string, Map<string, unknown>>();

  return {
    idFromName: (name: string) => ({ toString: () => name, name }) as any,
    idFromString: (id: string) => ({ toString: () => id }) as any,
    newUniqueId: () => ({ toString: () => crypto.randomUUID() }) as any,
    get: (id: any) => {
      const idStr = id.toString();
      if (!state.has(idStr)) state.set(idStr, new Map());
      return {
        fetch: async () => new Response("{}", { status: 200 }),
      } as any;
    },
  } as DurableObjectNamespace;
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter makanmakan-api test durable-object-stub`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/__tests__/integration/helpers/durable-object-stub.ts apps/api/src/__tests__/integration/helpers/__tests__/durable-object-stub.test.ts
git commit -m "feat(api/tests): in-memory Durable Object stub for integration tests"
```

---

## Task 10: Implement `createRealIntegrationTestApp` (TDD)

**Files:**
- Create: `apps/api/src/__tests__/integration/helpers/real-test-app.ts`
- Create: `apps/api/src/__tests__/integration/helpers/__tests__/real-test-app.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/__tests__/integration/helpers/__tests__/real-test-app.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { createRealIntegrationTestApp, type RealIntegrationTestApp } from "../real-test-app";

describe("createRealIntegrationTestApp", () => {
  let testApp: RealIntegrationTestApp | null = null;

  afterEach(async () => {
    if (testApp) {
      await testApp.dispose();
      testApp = null;
    }
  });

  it("boots a Hono app with a real miniflare D1 binding", async () => {
    testApp = await createRealIntegrationTestApp();
    expect(testApp.app).toBeDefined();
    expect(testApp.testDb).toBeDefined();
    expect(testApp.env.DB).toBe(testApp.testDb.db);
  });

  it("responds 200 on GET /health", async () => {
    testApp = await createRealIntegrationTestApp();
    const res = await testApp.app.fetch(new Request("https://test/health"));
    expect(res.status).toBe(200);
  });

  it("rejects unauthenticated requests to protected endpoints", async () => {
    testApp = await createRealIntegrationTestApp();
    const res = await testApp.app.fetch(new Request("https://test/api/v1/customers/me/orders"));
    expect(res.status).toBe(401);
  });

  it("dispose releases resources without error", async () => {
    testApp = await createRealIntegrationTestApp();
    await expect(testApp.dispose()).resolves.not.toThrow();
    testApp = null;
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter makanmakan-api test real-test-app`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement `real-test-app.ts`**

Create `apps/api/src/__tests__/integration/helpers/real-test-app.ts`:

```ts
import { createApp } from "../../../app-factory";
import {
  createTestDatabase,
  type TestDatabase,
} from "@makanmakan/database/testing";
import type { Env } from "../../../types/env";
import { buildAuthHelper, type AuthHelper } from "./issue-test-jwt";
import { createDurableObjectStub } from "./durable-object-stub";
import type { Hono } from "hono";

export interface RealIntegrationTestApp {
  app: Hono<{ Bindings: Env }>;
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
    JOB_QUEUE: { send: async () => {} } as any,
    PRELOAD_QUEUE: { send: async () => {} } as any,
    REVALIDATION_QUEUE: { send: async () => {} } as any,
    REALTIME_ORDERS: createDurableObjectStub(),
    REALTIME_SESSION: createDurableObjectStub(),
    ANALYTICS_ENGINE: { writeDataPoint: () => {} },
  } as Env;
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter makanmakan-api test real-test-app`
Expected: PASS (4 tests).

**If the `/health` test fails with 500,** inspect the error message. Likely cause: a middleware that reads a binding we didn't set. Fix: add the minimum required binding to `buildTestEnv`, or set the value to a safe default. Iterate until green.

**If the `GET /api/v1/customers/me/orders` test returns 500 instead of 401,** the auth middleware's dependency chain needs something we haven't provided. Check the middleware source; stub or provide the missing piece.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/__tests__/integration/helpers/real-test-app.ts apps/api/src/__tests__/integration/helpers/__tests__/real-test-app.test.ts
git commit -m "feat(api/tests): createRealIntegrationTestApp with real miniflare D1

Composes createApp() + createTestDatabase() + in-memory DO stubs into a
real integration test app. Boots the production Hono pipeline against a
real Drizzle + D1 binding for the first time in the codebase."
```

---

## Task 11: Implement `seed-helper.ts` (TDD)

**Files:**
- Create: `apps/api/src/__tests__/integration/helpers/seed-helper.ts`
- Create: `apps/api/src/__tests__/integration/helpers/__tests__/seed-helper.test.ts`

The seed helpers are thin wrappers that use `@makanmakan/testing-utils` factories to produce fixture rows, then insert them via the TestDatabase's Drizzle instance.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/__tests__/integration/helpers/__tests__/seed-helper.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestDatabase, type TestDatabase } from "@makanmakan/database/testing";
import { buildSeedHelpers } from "../seed-helper";

describe("buildSeedHelpers", () => {
  let testDb: TestDatabase;

  beforeAll(async () => {
    testDb = await createTestDatabase();
  });
  afterAll(async () => {
    await testDb.dispose();
  });
  beforeEach(async () => {
    await testDb.truncateAll();
  });

  it("seed.restaurant inserts a restaurant and returns its id", async () => {
    const seed = buildSeedHelpers(testDb);
    const restaurant = await seed.restaurant();
    expect(restaurant.id).toBeTruthy();

    const row = await testDb.db
      .prepare(`SELECT name FROM restaurants WHERE id = ?`)
      .bind(restaurant.id)
      .first();
    expect(row).toBeTruthy();
  });

  it("seed.menuItem requires an existing restaurantId", async () => {
    const seed = buildSeedHelpers(testDb);
    const r = await seed.restaurant();
    const item = await seed.menuItem(r.id);
    expect(item.id).toBeTruthy();

    const row = await testDb.db
      .prepare(`SELECT restaurant_id FROM menu_items WHERE id = ?`)
      .bind(item.id)
      .first<{ restaurant_id: string | number }>();
    expect(String(row?.restaurant_id)).toBe(String(r.id));
  });

  it("seed.order creates an order linked to a restaurant", async () => {
    const seed = buildSeedHelpers(testDb);
    const r = await seed.restaurant();
    const order = await seed.order(r.id);
    expect(order.id).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter makanmakan-api test seed-helper`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement `seed-helper.ts`**

Create `apps/api/src/__tests__/integration/helpers/seed-helper.ts`:

```ts
import type { TestDatabase } from "@makanmakan/database/testing";
import {
  restaurantFactory,
  menuItemFactory,
  orderFactory,
} from "@makanmakan/testing-utils";
import {
  restaurants,
  menuItems,
  orders,
} from "@makanmakan/database";

export interface SeedHelpers {
  restaurant(overrides?: Record<string, unknown>): Promise<{ id: string | number }>;
  menuItem(
    restaurantId: string | number,
    overrides?: Record<string, unknown>,
  ): Promise<{ id: number }>;
  order(
    restaurantId: string | number,
    overrides?: Record<string, unknown>,
  ): Promise<{ id: number }>;
}

export function buildSeedHelpers(testDb: TestDatabase): SeedHelpers {
  return {
    restaurant: async (overrides) => {
      const data = restaurantFactory.build({ overrides });
      const [row] = await testDb.drizzle
        .insert(restaurants)
        .values(data as any)
        .returning();
      return { id: row.id };
    },

    menuItem: async (restaurantId, overrides) => {
      const data = menuItemFactory.build({
        overrides: { restaurantId, ...overrides },
      });
      const [row] = await testDb.drizzle
        .insert(menuItems)
        .values(data as any)
        .returning();
      return { id: row.id as number };
    },

    order: async (restaurantId, overrides) => {
      const data = orderFactory.build({
        overrides: { restaurantId, ...overrides },
      });
      const [row] = await testDb.drizzle
        .insert(orders)
        .values(data as any)
        .returning();
      return { id: row.id as number };
    },
  };
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter makanmakan-api test seed-helper`
Expected: PASS (3 tests).

**If a factory's default values fail NOT NULL constraints,** inspect the failing field and either (a) override it in the test call, or (b) update the factory's defaults in `packages/testing-utils`. Prefer (a) for speed; only (b) if the failing field is a universal requirement.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/__tests__/integration/helpers/seed-helper.ts apps/api/src/__tests__/integration/helpers/__tests__/seed-helper.test.ts
git commit -m "feat(api/tests): buildSeedHelpers wraps factories into drizzle inserts"
```

---

## Task 12: Implement `startTestApiServer` (TDD)

**Files:**
- Create: `apps/api/src/__tests__/integration/helpers/start-test-api-server.ts`
- Create: `apps/api/src/__tests__/integration/helpers/__tests__/start-test-api-server.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/__tests__/integration/helpers/__tests__/start-test-api-server.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { startTestApiServer, type TestApiServerHandle } from "../start-test-api-server";

describe("startTestApiServer", () => {
  let handle: TestApiServerHandle | null = null;

  afterEach(async () => {
    if (handle) {
      await handle.stop();
      handle = null;
    }
  });

  it("listens on a random port and serves /health over real HTTP", async () => {
    handle = await startTestApiServer();
    expect(handle.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);

    const res = await fetch(`${handle.url}/health`);
    expect(res.status).toBe(200);
  });

  it("exposes seed.restaurant", async () => {
    handle = await startTestApiServer();
    const r = await handle.seed.restaurant();
    expect(r.id).toBeTruthy();
  });

  it("stop closes the server without hanging", async () => {
    handle = await startTestApiServer();
    await expect(handle.stop()).resolves.not.toThrow();
    handle = null;
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm --filter makanmakan-api test start-test-api-server`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement `start-test-api-server.ts`**

Create `apps/api/src/__tests__/integration/helpers/start-test-api-server.ts`:

```ts
import { serve } from "@hono/node-server";
import type { AddressInfo } from "node:net";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./real-test-app";
import { buildSeedHelpers, type SeedHelpers } from "./seed-helper";
import type { TestDatabase } from "@makanmakan/database/testing";

export interface TestApiServerHandle {
  url: string;
  testDb: TestDatabase;
  authHelper: RealIntegrationTestApp["authHelper"];
  seed: SeedHelpers;
  stop(): Promise<void>;
}

export async function startTestApiServer(
  options: { port?: number } = {},
): Promise<TestApiServerHandle> {
  const testApp = await createRealIntegrationTestApp();
  const server = serve({
    fetch: testApp.app.fetch,
    port: options.port ?? 0,
  });

  // @hono/node-server's serve returns a Node http.Server
  const address = (server as any).address() as AddressInfo;
  const url = `http://127.0.0.1:${address.port}`;

  return {
    url,
    testDb: testApp.testDb,
    authHelper: testApp.authHelper,
    seed: buildSeedHelpers(testApp.testDb),
    stop: async () => {
      await new Promise<void>((resolve, reject) => {
        (server as any).close((err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
      await testApp.dispose();
    },
  };
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `pnpm --filter makanmakan-api test start-test-api-server`
Expected: PASS (3 tests).

**If port binding fails on CI,** it's because `port: 0` isn't yielding a usable port. Fix: explicitly call `server.listen(0)` and read `server.address()` after the 'listening' event.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/__tests__/integration/helpers/start-test-api-server.ts apps/api/src/__tests__/integration/helpers/__tests__/start-test-api-server.test.ts
git commit -m "feat(api/tests): startTestApiServer for Phase 2 HTTP seam

Wraps createRealIntegrationTestApp in @hono/node-server, listens on a
random port, exposes url + seed + stop. Not used in Phase 1 smokes but
ships now so Phase 2 frontend spec has a stable surface to target."
```

---

## Task 13: Add `vitest.real-integration.config.ts` + `test:real-integration` script

**Files:**
- Create: `apps/api/vitest.real-integration.config.ts`
- Modify: `apps/api/package.json`
- Modify: root `package.json`
- Modify: `turbo.json`

- [ ] **Step 1: Create the vitest config**

Create `apps/api/vitest.real-integration.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    root: resolve(__dirname),
    include: ["src/__tests__/integration/**/*.real.integration.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
    reporters: ["verbose"],
    poolOptions: {
      threads: { maxThreads: 4 },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@makanmakan/shared-types": resolve(__dirname, "../../packages/shared-types/src"),
      "@makanmakan/database": resolve(__dirname, "../../packages/database/src"),
      "@makanmakan/database/testing": resolve(__dirname, "../../packages/database/src/testing"),
      "@makanmakan/testing-utils": resolve(__dirname, "../../packages/testing-utils/src"),
    },
  },
  define: {
    "process.env.NODE_ENV": '"test"',
  },
});
```

- [ ] **Step 2: Add the script to `apps/api/package.json`**

Open `apps/api/package.json`. Add to the `scripts` block:

```json
    "test:real-integration": "NODE_OPTIONS='--max-old-space-size=8192' vitest run --config vitest.real-integration.config.ts"
```

- [ ] **Step 3: Add root-level script**

Open root `package.json`. Add to `scripts`:

```json
    "test:real-integration": "turbo run test:real-integration --filter=makanmakan-api"
```

- [ ] **Step 4: Register the task in `turbo.json`**

Open `turbo.json`. Add under `tasks`:

```json
    "test:real-integration": {
      "dependsOn": ["^build"],
      "inputs": [
        "src/**",
        "migrations_fresh/**",
        "vitest.real-integration.config.ts",
        "package.json"
      ],
      "outputs": []
    }
```

- [ ] **Step 5: Verify the script runs (there are no smoke tests yet, so expect 0 tests)**

Run: `pnpm test:real-integration`
Expected: "No test files found" — this is OK. It means the config is valid and the glob ran.

- [ ] **Step 6: Commit**

```bash
git add apps/api/vitest.real-integration.config.ts apps/api/package.json package.json turbo.json
git commit -m "chore(api): add test:real-integration vitest config and script"
```

---

## Task 14: Smoke — `orders.real.integration.test.ts` (timestamp_ms round-trip)

**Files:**
- Create: `apps/api/src/__tests__/integration/orders.real.integration.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/__tests__/integration/orders.real.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";

describe("Orders API — real integration", () => {
  let testApp: RealIntegrationTestApp;
  let seed: ReturnType<typeof buildSeedHelpers>;

  beforeAll(async () => {
    testApp = await createRealIntegrationTestApp();
    seed = buildSeedHelpers(testApp.testDb);
  });
  afterAll(async () => {
    await testApp.dispose();
  });
  beforeEach(async () => {
    await testApp.testDb.truncateAll();
  });

  it("round-trips created_at_ms through POST /orders -> GET /orders/:id", async () => {
    const restaurant = await seed.restaurant();
    const menuItem = await seed.menuItem(restaurant.id, { price: 100 });

    const token = await testApp.authHelper.customerToken(42);
    const payload = {
      restaurantId: restaurant.id,
      items: [{ menuItemId: menuItem.id, quantity: 2, unitPrice: 100 }],
      totalAmount: 200,
    };

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
    const postJson: any = await postRes.json();
    expect(postJson.success).toBe(true);
    const created = postJson.data;

    const getRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/orders/${created.id}`, {
        headers: { authorization: `Bearer ${token}` },
      }),
    );
    expect(getRes.status).toBe(200);
    const getJson: any = await getRes.json();
    const fetched = getJson.data;

    expect(fetched.id).toBe(created.id);
    expect(fetched.createdAt).toEqual(created.createdAt);
    expect(typeof fetched.createdAt).toBe("number");
    expect(Math.abs(fetched.createdAt - Date.now())).toBeLessThan(5000);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm --filter makanmakan-api test:real-integration`
Expected: the test runs and either passes or surfaces real Drizzle/route errors.

- [ ] **Step 3: Iterate until green**

Common fixes:
- Payload shape mismatch → check `apps/api/src/features/orders/` for the expected schema and update the test payload
- Auth middleware rejecting the JWT → verify `JWT_SECRET` in `buildTestEnv` matches the secret in `issue-test-jwt.ts`
- Menu item NOT NULL violations → pass additional overrides in `seed.menuItem`

Do NOT modify production code to make the test pass. If production has a bug the test surfaces, that's a separate PR.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/__tests__/integration/orders.real.integration.test.ts
git commit -m "test(api): orders.real.integration — timestamp_ms round-trip smoke"
```

---

## Task 15: Smoke — `menu.real.integration.test.ts` (JOINs)

**Files:**
- Create: `apps/api/src/__tests__/integration/menu.real.integration.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/__tests__/integration/menu.real.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";
import { categories } from "@makanmakan/database";

describe("Menu API — real integration", () => {
  let testApp: RealIntegrationTestApp;
  let seed: ReturnType<typeof buildSeedHelpers>;

  beforeAll(async () => {
    testApp = await createRealIntegrationTestApp();
    seed = buildSeedHelpers(testApp.testDb);
  });
  afterAll(async () => {
    await testApp.dispose();
  });
  beforeEach(async () => {
    await testApp.testDb.truncateAll();
  });

  it("returns menu with categories and featured items joined", async () => {
    const restaurant = await seed.restaurant();

    const [cat] = await testApp.testDb.drizzle
      .insert(categories)
      .values({
        restaurantId: restaurant.id,
        name: "Mains",
        sortOrder: 1,
      } as any)
      .returning();

    await seed.menuItem(restaurant.id, {
      name: "Nasi Lemak",
      categoryId: cat.id,
      isFeatured: true,
      price: 150,
    });

    const res = await testApp.app.fetch(
      new Request(`https://test/api/v1/menu/${restaurant.id}`),
    );
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.success).toBe(true);

    const data = json.data;
    expect(data.restaurant.id).toBe(restaurant.id);
    expect(data.categories).toHaveLength(1);
    expect(data.categories[0].name).toBe("Mains");
    expect(data.menuItems.length).toBeGreaterThanOrEqual(1);
    expect(data.menuItems[0].categoryId).toBe(cat.id);
    expect(data.featuredItems.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run the test and iterate until green**

Run: `pnpm --filter makanmakan-api test:real-integration menu`

Fix: adjust payload/response shape to match the actual `GET /api/v1/menu/:restaurantId` contract. Check `apps/api/src/features/menu/` for the service response shape.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/__tests__/integration/menu.real.integration.test.ts
git commit -m "test(api): menu.real.integration — JOIN smoke"
```

---

## Task 16: Smoke — `customer-orders.real.integration.test.ts` (Auth + RBAC + scope)

**Files:**
- Create: `apps/api/src/__tests__/integration/customer-orders.real.integration.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/__tests__/integration/customer-orders.real.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";

describe("Customer Orders API — real integration", () => {
  let testApp: RealIntegrationTestApp;
  let seed: ReturnType<typeof buildSeedHelpers>;

  beforeAll(async () => {
    testApp = await createRealIntegrationTestApp();
    seed = buildSeedHelpers(testApp.testDb);
  });
  afterAll(async () => {
    await testApp.dispose();
  });
  beforeEach(async () => {
    await testApp.testDb.truncateAll();
  });

  it("returns only the authenticated customer's orders", async () => {
    const restaurant = await seed.restaurant();
    const order1 = await seed.order(restaurant.id, { customerId: 100 });
    const order2 = await seed.order(restaurant.id, { customerId: 200 });

    const token100 = await testApp.authHelper.customerToken(100);
    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/customers/me/orders", {
        headers: { authorization: `Bearer ${token100}` },
      }),
    );
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.success).toBe(true);

    const orderIds = json.data.orders.map((o: any) => o.id);
    expect(orderIds).toContain(order1.id);
    expect(orderIds).not.toContain(order2.id);
  });

  it("rejects requests without a valid JWT", async () => {
    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/customers/me/orders"),
    );
    expect(res.status).toBe(401);
    const json: any = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBeDefined();
  });

  it("rejects tokens with mismatched scope", async () => {
    const staffToken = await testApp.authHelper.staffToken(300, 3, "other-restaurant");
    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/customers/me/orders", {
        headers: { authorization: `Bearer ${staffToken}` },
      }),
    );
    // Expected: 403 or empty orders list — depends on route design
    expect([200, 403]).toContain(res.status);
  });
});
```

- [ ] **Step 2: Run and iterate until green**

Run: `pnpm --filter makanmakan-api test:real-integration customer-orders`

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/__tests__/integration/customer-orders.real.integration.test.ts
git commit -m "test(api): customer-orders.real.integration — auth/RBAC/scope smoke"
```

---

## Task 17: Smoke — `discovery.real.integration.test.ts` (aggregate SQL)

**Files:**
- Create: `apps/api/src/__tests__/integration/discovery.real.integration.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/__tests__/integration/discovery.real.integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";

describe("Discovery API — real integration", () => {
  let testApp: RealIntegrationTestApp;
  let seed: ReturnType<typeof buildSeedHelpers>;

  beforeAll(async () => {
    testApp = await createRealIntegrationTestApp();
    seed = buildSeedHelpers(testApp.testDb);
  });
  afterAll(async () => {
    await testApp.dispose();
  });
  beforeEach(async () => {
    await testApp.testDb.truncateAll();
  });

  it("returns correct aggregate counts and paginates", async () => {
    const restaurant = await seed.restaurant();
    for (let i = 0; i < 25; i++) {
      await seed.menuItem(restaurant.id, { name: `Nasi Lemak ${i}` });
    }

    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/discovery/search?q=Nasi&page=1&limit=10"),
    );
    expect(res.status).toBe(200);
    const json: any = await res.json();
    expect(json.success).toBe(true);

    expect(json.data.total).toBe(25);
    expect(json.data.results).toHaveLength(10);
    expect(json.data.page ?? 1).toBe(1);
  });
});
```

- [ ] **Step 2: Run and iterate until green**

Run: `pnpm --filter makanmakan-api test:real-integration discovery`

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/__tests__/integration/discovery.real.integration.test.ts
git commit -m "test(api): discovery.real.integration — aggregate SQL smoke"
```

---

## Task 18: Run full smoke suite + 20× flake check

**Files:** (none — verification only)

- [ ] **Step 1: Run the full smoke suite once**

Run: `pnpm test:real-integration`
Expected: 4 test files, all green.

- [ ] **Step 2: Run 20× consecutive to check for flakes**

```bash
for i in {1..20}; do
  echo "=== Run $i ==="
  pnpm test:real-integration || { echo "FLAKE on run $i"; exit 1; }
done
echo "All 20 runs green"
```

Expected: "All 20 runs green" at the end.

- [ ] **Step 3: If any run fails, investigate and fix**

Common flake causes:
- Time-dependent assertions (`Date.now()` without tolerance) → add tolerance
- Random test order dependency → ensure `beforeEach` truncates fully
- Port conflicts in `startTestApiServer` → use `port: 0`
- miniflare subprocess leak → check `dispose()` is called in every `afterAll`

Fix root cause, re-run 20×.

- [ ] **Step 4: No commit**

This task produces no artifact; it's a verification gate. Proceed to Task 19 only after 20 consecutive green runs.

---

## Task 19: Classify + annotate inline legacy integration tests

**Files:**
- Modify: each file in the "Annotated in place" list from the File Structure section above

- [ ] **Step 1: Find all `*integration*.test.ts` files NOT in a moved folder**

Run:

```bash
find apps -name "*integration*.test.ts" -type f \
  | grep -v "integration-legacy-mockdrizzle" \
  | grep -v "component-flows" \
  | grep -v "/integration/.*\.real\.integration\.test\.ts$"
```

Expected: a list of inline files like `apps/api/src/features/customers/__tests__/integration.test.ts`.

- [ ] **Step 2: Classify each file (A or B)**

For each file in the output of Step 1, open it and check:
- **Template A (mocked services, fake integration):** if the file has `vi.mock(...)` calls on service/DB boundaries
- **Template B (genuine module integration, no HTTP/DB):** if the file wires multiple in-process modules together without HTTP/DB but also without `vi.mock`

Record your classification as a comment on each file.

- [ ] **Step 3: Add Template A header to mocked files**

For each Template A file, prepend this comment to the very top of the file (before imports):

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

- [ ] **Step 4: Add Template B header to genuine module-integration files**

For each Template B file, prepend:

```ts
/**
 * Module integration test: exercises interaction between X and Y without HTTP/DB.
 * This is NOT an end-to-end API integration test — it does not hit routes or D1.
 */
```

Replace `X and Y` with the actual modules (e.g. "i18n loader and locale consistency checker").

- [ ] **Step 5: Run tests to verify the headers didn't break anything**

Run: `pnpm test`
Expected: all previously-passing tests still pass. Headers are comments, no code changes.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs(tests): annotate legacy 'integration' test files

Adds Template A header to files that use vi.mock on service/DB boundaries
(they verify route JS logic but do not verify Drizzle SQL or D1 parity).
Adds Template B header to genuine module-integration tests (they wire
multiple modules but do not hit HTTP/DB).

Part of the real integration test foundation Phase 1 (spec:
docs/superpowers/specs/2026-04-13-real-integration-test-foundation-design.md)."
```

---

## Task 20: Create `tests/.integration-allowlist.json`

**Files:**
- Create: `tests/.integration-allowlist.json`

- [ ] **Step 1: Re-scan all current integration test files**

Run:

```bash
find apps -name "*integration*.test.ts" -type f | sort
```

Expected: prints every file the allowlist must cover. Copy the output.

- [ ] **Step 2: Write the allowlist**

Create `tests/.integration-allowlist.json`. Populate based on your Step 1 output. Example shape:

```json
{
  "$schema": "./allowlist.schema.json",
  "description": "Enumerates every legitimate integration-named test file. Files matching *.real.integration.test.ts under apps/*/src/__tests__/integration/ are auto-allowed and do not need an entry here.",
  "real_auto_allowed_pattern": "apps/*/src/__tests__/integration/*.real.integration.test.ts",
  "legacy_mockdrizzle": [
    "apps/api/src/__tests__/integration-legacy-mockdrizzle/**/*.test.ts"
  ],
  "component_flows": [
    "apps/admin-dashboard/src/tests/component-flows/**/*.test.ts",
    "apps/kitchen-display/tests/component-flows/**/*.test.ts"
  ],
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

Cross-check each path from your Step 1 output against one of the fields. Every file must appear in exactly one category (or auto-match the `real_auto_allowed_pattern`).

- [ ] **Step 3: Commit**

```bash
git add tests/.integration-allowlist.json
git commit -m "chore(tests): add integration-allowlist.json debt ledger"
```

---

## Task 21: Implement `check-integration-allowlist.cjs` (TDD)

**Files:**
- Create: `scripts/check-integration-allowlist.cjs`
- Create: `scripts/__tests__/check-integration-allowlist.test.cjs`

- [ ] **Step 1: Write the failing test**

Create `scripts/__tests__/check-integration-allowlist.test.cjs`:

```js
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const SCRIPT = path.resolve(__dirname, "../check-integration-allowlist.cjs");

function runInTempRepo(files, allowlist) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "allowlist-test-"));
  fs.mkdirSync(path.join(tmpDir, "tests"), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, "tests/.integration-allowlist.json"),
    JSON.stringify(allowlist, null, 2),
  );
  for (const f of files) {
    const full = path.join(tmpDir, f);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, "// dummy test");
  }
  try {
    execFileSync("node", [SCRIPT], { cwd: tmpDir });
    return { status: 0 };
  } catch (err) {
    return {
      status: err.status,
      stderr: err.stderr?.toString() ?? "",
      stdout: err.stdout?.toString() ?? "",
    };
  }
}

test("passes when all files are in the allowlist", () => {
  const result = runInTempRepo(
    ["apps/api/src/features/foo/__tests__/integration.test.ts"],
    {
      real_auto_allowed_pattern: "apps/*/src/__tests__/integration/*.real.integration.test.ts",
      inline_legacy_annotated: [
        "apps/api/src/features/foo/__tests__/integration.test.ts",
      ],
      legacy_mockdrizzle: [],
      component_flows: [],
      module_integration: [],
    },
  );
  assert.strictEqual(result.status, 0);
});

test("passes when file matches the real auto-allowed pattern", () => {
  const result = runInTempRepo(
    ["apps/api/src/__tests__/integration/orders.real.integration.test.ts"],
    {
      real_auto_allowed_pattern: "apps/*/src/__tests__/integration/*.real.integration.test.ts",
      inline_legacy_annotated: [],
      legacy_mockdrizzle: [],
      component_flows: [],
      module_integration: [],
    },
  );
  assert.strictEqual(result.status, 0);
});

test("fails when an unknown file is added", () => {
  const result = runInTempRepo(
    ["apps/new-app/src/__tests__/rogue-integration.test.ts"],
    {
      real_auto_allowed_pattern: "apps/*/src/__tests__/integration/*.real.integration.test.ts",
      inline_legacy_annotated: [],
      legacy_mockdrizzle: [],
      component_flows: [],
      module_integration: [],
    },
  );
  assert.notStrictEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /rogue-integration\.test\.ts/);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `node --test scripts/__tests__/check-integration-allowlist.test.cjs`
Expected: FAIL (script doesn't exist yet).

- [ ] **Step 3: Implement the script**

Create `scripts/check-integration-allowlist.cjs`:

```js
#!/usr/bin/env node
// Checks that every *integration*.test.ts file is either in the allowlist
// or matches the auto-allowed real-integration pattern.

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const ALLOWLIST_PATH = path.join(ROOT, "tests/.integration-allowlist.json");

if (!fs.existsSync(ALLOWLIST_PATH)) {
  console.error(`[check-integration-allowlist] Allowlist not found at ${ALLOWLIST_PATH}`);
  process.exit(2);
}

const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, "utf-8"));

function walk(dir, hits) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, hits);
    } else if (/integration.*\.test\.tsx?$/.test(entry.name)) {
      hits.push(path.relative(ROOT, full));
    }
  }
}

const found = [];
for (const topDir of ["apps", "packages"]) {
  walk(path.join(ROOT, topDir), found);
}

// Simple glob matcher: turns "apps/*/src/..." into a regex.
function globToRegex(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function matchesAny(file, patterns) {
  if (!patterns) return false;
  return patterns.some((p) => globToRegex(p).test(file));
}

const autoPattern = allowlist.real_auto_allowed_pattern;
const categories = [
  allowlist.legacy_mockdrizzle,
  allowlist.component_flows,
  allowlist.module_integration,
  allowlist.inline_legacy_annotated,
];

const violations = [];
for (const file of found) {
  const normalized = file.split(path.sep).join("/");
  if (autoPattern && globToRegex(autoPattern).test(normalized)) continue;
  if (categories.some((c) => matchesAny(normalized, c))) continue;
  violations.push(normalized);
}

if (violations.length > 0) {
  console.error("[check-integration-allowlist] Violations found:");
  for (const v of violations) console.error(`  ${v}`);
  console.error("");
  console.error("Options to fix:");
  console.error("  1. If this is a real integration test, rename it to match");
  console.error("     apps/<app>/src/__tests__/integration/<name>.real.integration.test.ts");
  console.error("     (auto-allowed by the canonical pattern).");
  console.error("  2. If this is a legacy test with mocked services, add the exact path");
  console.error("     to tests/.integration-allowlist.json under 'inline_legacy_annotated'");
  console.error("     or the most specific category, and include a PR description explaining");
  console.error("     why a new mocked test is necessary.");
  process.exit(1);
}

console.log(`[check-integration-allowlist] OK: ${found.length} files all accounted for.`);
```

Make it executable:

```bash
chmod +x scripts/check-integration-allowlist.cjs
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `node --test scripts/__tests__/check-integration-allowlist.test.cjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the script against the real repo**

Run: `node scripts/check-integration-allowlist.cjs`
Expected: `OK: N files all accounted for.` If it fails, update `tests/.integration-allowlist.json` until every real file is covered.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-integration-allowlist.cjs scripts/__tests__/check-integration-allowlist.test.cjs
git commit -m "chore(tests): CI script to enforce integration test allowlist"
```

---

## Task 22: Wire allowlist check into CI

**Files:**
- Modify: relevant `.github/workflows/*.yml` (the main CI workflow)

- [ ] **Step 1: Find the CI workflow that runs lint/typecheck**

Run: `grep -l "pnpm.*typecheck\|pnpm.*lint" .github/workflows/*.yml`
Expected: one or more workflow files. Pick the main one (usually `ci.yml` or `test.yml`).

- [ ] **Step 2: Add the check step**

Open the chosen workflow file. Find the job that runs `pnpm typecheck` or `pnpm lint`. Add a new step immediately after:

```yaml
      - name: Check integration test allowlist
        run: node scripts/check-integration-allowlist.cjs
```

Place this as a required step in the same job so PRs fail CI on violation.

- [ ] **Step 3: Verify locally that adding a violation triggers failure**

```bash
# Create a dummy rogue file
touch apps/api/src/rogue-integration.test.ts
node scripts/check-integration-allowlist.cjs
echo "Exit: $?"
# Expected: exit 1 with the rogue file listed

# Clean up
rm apps/api/src/rogue-integration.test.ts
```

- [ ] **Step 4: Verify a canonical path name passes**

```bash
# Create a canonical-pattern file
mkdir -p apps/api/src/__tests__/integration
touch apps/api/src/__tests__/integration/dummy.real.integration.test.ts
node scripts/check-integration-allowlist.cjs
echo "Exit: $?"
# Expected: exit 0

# Clean up
rm apps/api/src/__tests__/integration/dummy.real.integration.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/
git commit -m "ci: enforce integration test allowlist on every PR"
```

---

## Task 23: Final verification

**Files:** (none — verification only)

- [ ] **Step 1: Clean build from scratch**

```bash
pnpm clean 2>/dev/null || true
pnpm install
pnpm build
```

Expected: clean build, no errors.

- [ ] **Step 2: Run every test suite once**

```bash
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:real-integration
node scripts/check-integration-allowlist.cjs
```

Expected: every command exits 0.

- [ ] **Step 3: Run 20× `test:real-integration` on a cold cache**

```bash
for i in {1..20}; do
  echo "=== Run $i ==="
  pnpm test:real-integration || { echo "FLAKE on run $i"; exit 1; }
done
echo "All 20 runs green"
```

Expected: "All 20 runs green"

- [ ] **Step 4: Paste the 20× run output into the Phase 2 kickoff tracking issue**

(Manual step — create or find the tracking issue and comment the log.)

- [ ] **Step 5: Phase 1 complete — commit a summary note if any final touches**

If Steps 1–4 produced any tweaks (e.g. bumped timeout, added missing binding), commit them now:

```bash
git add -A
git commit -m "chore(tests): final Phase 1 verification tweaks"
```

---

## Phase 2 Trigger Gate (reference, not a task)

Per the spec §Handoff Contract, Phase 2 (frontend integration tests) begins **only** when all of these are true:

1. ✅ `pnpm --filter @makanmakan/database test` green on `main`
2. ✅ `pnpm --filter makanmakan-api test:real-integration` green on `main`
3. ✅ 20× consecutive `test:real-integration` green on CI
4. ✅ `scripts/check-integration-allowlist.cjs` is a required CI check
5. ✅ Dogfood gate: a 5th real smoke test is added by an engineer who did NOT author `createRealIntegrationTestApp`

If criterion 5 cannot be met within two weeks of Phase 1 merge, write a usage guide for `createRealIntegrationTestApp` before starting Phase 2.
