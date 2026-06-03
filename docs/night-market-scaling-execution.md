# Night-Market Discovery — Scaling Execution (P0–P3)

Execution record + forward plan for scaling the cross-market discovery/search
feature on D1. Companion to the architecture decision (stay on D1; add a search
layer; do NOT migrate to Postgres+Hyperdrive).

Roadmap tiers and their gates:

| Tier | What | Status | Gate |
| --- | --- | --- | --- |
| **P0a** | Public browse reads via D1 read replicas (Sessions API) | ✅ Shipped (code) | Needs dashboard toggle to take effect |
| **P0b** | Fan-out search-index sync via Queue | ✅ Shipped (code+tests) | Needs queues created before deploy |
| **P1** | Split discovery index into its own `CATALOG_DB` | ⏳ Seam done; rest gated | Browse reads threaten operational D1 |
| **P2** | CJK search: LIKE → FTS5 trigram (hybrid) | ✅ Shipped (code+migration+tests) | Core to launch |
| **P3** | Shard transactional data by `market_id` | 📋 Planned | Single transactional D1 write-saturated |

---

## ✅ P0a — Read replicas (shipped, inert until dashboard toggle)

- `DiscoveryService` constructor takes an optional `sessionConstraint`; when set,
  read queries run through `env.DB.withSession(...)` so they can be served by
  regional read replicas. Only `this.db` (reads) uses the session; `this.d1`
  (reindex writes) stays on primary.
- `createDiscoveryRead(env)` (uses `"first-unconstrained"`) is applied to the 10
  **public** discovery read routes. `/index-status` and `/reindex` (admin/write)
  stay on primary.
- Public catalog browsing needs no cross-request bookmark (clients don't write
  the catalog), so no cookie/header plumbing was added.

**ACTION REQUIRED (you):** enable Read Replication on the prod (and staging) D1 in
the Cloudflare dashboard: D1 → database → Settings → Enable Read Replication.
Until then the Sessions API is correct but routes everything to primary (no-op).

## ✅ P0b — Queue-based fan-out sync (shipped)

- `SearchIndexSyncService` takes an optional `Queue`. `onMarketChanged` /
  `onCategoryChanged` now enqueue one message per restaurant/item instead of an
  inline `Promise.all` (which could blow past D1's 1000-subrequest/invocation
  limit and time out the triggering admin request). Single-entity handlers stay
  inline (bounded). Falls back to inline when no queue is bound (tests).
- Queue consumer added to the worker entry (`apps/api/src/index.ts`).
- `SEARCH_SYNC_QUEUE` producer+consumer wired in `wrangler.toml` for default /
  development / staging / production, each with a dead-letter queue.

**ACTION REQUIRED (you):** create the queues before deploying (per env), e.g.:
```
wrangler queues create makanmasak-search-sync-prod
wrangler queues create makanmasak-search-sync-dlq-prod
```
(and the `-staging` / `-dev` pairs). Deploy order: queues first, then the worker.

## ✅ P2 — FTS5 trigram hybrid search (shipped)

- Migration `0061_dish_search_fts5.sql`: external-content FTS5 table
  `dish_search_fts` (`tokenize='trigram'`) over `dish_search_index`, kept in sync
  by AFTER INSERT/DELETE/UPDATE triggers — so `SearchIndexSyncService` needs **no**
  changes (its existing delete/insert maintains the FTS index for free).
- `DiscoveryService.searchDishes` adds an **additive** FTS `MATCH` clause to the
  existing `or(...)`: for queries ≥3 chars it also matches mid-string CJK
  substrings (e.g. `牛肉麵` → `蕃茄牛肉麵`) the prefix-LIKE misses. It only widens
  recall — existing LIKE behavior, pagination, sorting, caching are untouched.
- **Trigram constraint (verified by spike):** MATCH needs ≥3 characters; 1–2 char
  queries fall through to LIKE only. This is intentional and documented in code.
- Test-harness fix: `listUserTables` now excludes FTS5 shadow tables
  (`*_data/_idx/_docsize/_config`) so real-integration cleanup doesn't try to
  `DELETE FROM` them (FTS5 forbids it). All 66 discovery real-integration tests pass.

**Follow-up (optional):** `searchServices` (reservation/service search) uses the
same prefix-LIKE pattern and would benefit from the same additive FTS clause.

---

## 📋 P1 — Split discovery index into a dedicated `CATALOG_DB`

**Gate:** public browse/search read volume starts contending with the operational
D1's single-writer throughput, or you want to scale/replicate the public catalog
independently. **Not before.**

**Already done (the seam):** all discovery-layer DB access is centralized in
`createSearchIndexSync(env)` and `createDiscoveryRead(env)`. Pointing the index at
a different binding is a one-place change in each.

**Remaining work:**
1. Add a second D1 binding `CATALOG_DB` (wrangler config per env + `Env` type).
2. Move `dish_search_index` + `dish_search_fts` (+ triggers) to `CATALOG_DB`.
3. **Cross-DB JOIN problem (the hard part):** D1 has no cross-database JOINs.
   - `SearchIndexSyncService` currently JOINs the index against live source tables
     (`menuItems`/`categories`/`restaurants`/`restaurant_market_memberships`) in the
     same DB. Refactor sync to: read source rows from `DB`, write index rows to
     `CATALOG_DB` (two connections; no cross-DB transaction — accept eventual
     consistency, the queue already makes sync async).
   - `DiscoveryService.searchDishes` innerJoins `restaurants`/`menuItems`. To read
     purely from `CATALOG_DB`, finish denormalizing the few still-joined restaurant
     fields (`name`, `city`, `isActive`, `deletedAt`, `businessHours`) into
     `dish_search_index`. Most fields are already denormalized.
4. Queue consumer writes to `CATALOG_DB`.
5. Backfill `CATALOG_DB` from current index, then cut over reads.

**Effort:** medium-large. Mostly denormalization completeness + dual-connection sync.

---

## 📋 P3 — Shard transactional data by `market_id`

**Gate:** sustained write contention on the single transactional D1 — watch D1
write metrics / `overloaded` errors during peak market hours. **Not before;** this
is a multi-week migration for a problem you don't yet have.

**Approach:**
1. Keep catalog/identity (restaurants, menus, markets, users) in the shared DB.
2. Shard high-write transactional tables (`orders`, `order_items`, `payments`,
   `market_checkout_*`, `sessions`, `reservations`) by `market_id`.
3. Routing: a `market_id → shard binding` map; the worker resolves the shard from
   market context per request. `market_checkout_*` is already market-scoped.
4. Hard problems to design for:
   - Restaurant in multiple markets → shard orders by the restaurant's **primary**
     market for a stable home shard.
   - Cross-market admin analytics → fan-out + aggregate (or a separate rollup).
   - Migrations run per shard; no transactions across shards (single-market
     checkout stays within one shard, which the current design already enforces).
5. Cloudflare supports up to 50,000 D1 databases per account, so per-market (or
   per-region-of-markets) databases are viable.

**Effort:** large. Defer until metrics justify.

---

## Verification evidence (this round)

- `pnpm --filter @makanmakan/api typecheck` — clean.
- Discovery unit tests — 13/13 pass (incl. new `SearchIndexSyncService.test.ts`).
- `discovery.real.integration` (real D1, migrations incl. 0061) — **66/66 pass**.
- FTS5 trigram behavior confirmed by local D1 spike (mid-string CJK match; ≥3-char
  constraint).
