# TODOS

Organized by skill/component. Priority is stated per item, not by position — the
sections are grouped by area, so a P1 can sit below a P4.

**Last full verification: 2026-09-05.** Every item below was re-checked against
the working tree, the GitHub API, and `contract:check` on that date; each carries
its own verification note. Two entries were materially wrong and have been
corrected in place (money-schema migration paths, API-contract seats delta).

**Triaged the same day.** Eleven items were open; each is now in one of three
places, and this file says which:

| Disposition | Items |
| --- | --- |
| **Done** — shipped 2026-09-05 | safeTransaction removal (`1dd7a164`), coupons return type (`719e54f7`), contract-script header (`ac7043de`) |
| **Moved to issues** — needs design, touches billing, or is multi-week | [#333](https://github.com/erictheng93/Makan-Masak/issues/333) usage meter, [#334](https://github.com/erictheng93/Makan-Masak/issues/334) money cutover, [#335](https://github.com/erictheng93/Makan-Masak/issues/335) marketplace Phase 4, [#336](https://github.com/erictheng93/Makan-Masak/issues/336) contract types |
| **Stays here** — no actionable next step | RealtimeSession (blocked on Cloudflare), payment acquirer (product decision), marketplace Phase 5 (post-MVP), GroupOrders harness (cost exceeds benefit), production deploy (needs credentials only) |

Deliberately not filed as issues: the four "stays here" items have no action
anyone could pick up today. Adding them to a thirty-issue backlog dilutes it
rather than tracking anything.

## API contracts

### Record field types in the API contract snapshot

**Priority:** P2 **Status:** → **[#336](https://github.com/erictheng93/Makan-Masak/issues/336)** (filed 2026-09-05). The half that needed no design shipped in `ac7043de`: the script no longer claims to detect type changes, and `docs/testing/guides/TESTING_GUIDE.md` §2.5 carries the same caveat. The extractor work moved to the issue because changing the snapshot format invalidates the whole baseline. **Files:** `scripts/check-api-contracts.cjs`, `.api-contracts-snapshot.json`

**Context:** `contract:check` reports schema-field additions/removals, but its static extractor stores only field names. Consequently, a wire-contract change such as menu/category `createdAt` and `updatedAt` changing from ISO strings to Unix-millisecond numbers produces no contract warning. The script's header currently overstates this capability by saying type changes are detected.

**Scope:**

- Extend the extractor and snapshot to persist each field's Zod type, including optionality/nullability and nested response objects where practical.
- Diff type changes as breaking changes and update the script documentation.
- ~~Resolve the current `contract:check` baseline delta for `seats.SEAT_SENSITIVE_FIELDS` (`pendingQrCode`, `pendingQrCodeVersion`, and `pendingQrPreparedAt`)~~ — **resolved.** `pnpm contract:check` reports "No contract changes detected" as of 2026-09-05; the baseline was reconciled at some point after 2026-08-13.

**Re-verified 2026-09-05 — still open.** `.api-contracts-snapshot.json` still
stores each schema as a bare array of field names (e.g.
`authentication/TokenPairSchema = ["expiresAt", "refreshToken", "token"]`), with
no type information, and `scripts/check-api-contracts.cjs` still claims
otherwise in its header (lines 8 and 19: "or type changed", "Reports additions,
removals, and type changes"). Only the third scope item above has been cleared.

## database / money schema

### Retire legacy REAL money columns with D1 drop-column cutover

**Priority:** P3 → raised to P2 **Status:** → **[#334](https://github.com/erictheng93/Makan-Masak/issues/334)** (filed 2026-09-05). Detail below kept because the issue references it. **Corrected 2026-09-05 — the previous 2026-07-05 note, replaced here, was materially wrong:** The Drizzle schema end state is real: `packages/database/src/schema/` has **zero remaining legacy `REAL` money columns** — every `real()` column left is non-monetary (lat/lng, stock levels, ratings, `quantityPerServing`). But the executable cutover is no longer where the previous note said it was.

**What the 2026-07-05 note claimed, and what is actually true:**

| Claim | Reality on 2026-09-05 |
| --- | --- |
| `migrations_fresh/0070_money_cents_cutover.sql` and `0071_...` exist | **Deleted.** The fresh track was squashed into a single `0000_baseline_strict.sql`; neither file is on that track any more |
| The two are "paired" in `migration-dual-track.json` | **No.** That file's `pairs` array is `[]`, and `reviewedThrough.fresh` is just `0000_baseline_strict.sql` |
| The legacy track carries `0087`/`0088` | True — `packages/database/migrations/0087_money_cents_cutover.sql` and `0088_...` are still on disk |

**Why that matters more than a stale path.** Per root `CLAUDE.md`, every
`migrations_dir` in `apps/api`, `apps/management-api` and `apps/realtime` points
at `migrations_fresh` — verified again on 2026-09-05. The legacy
`packages/database/migrations/` track is referenced by **no** `wrangler.toml`,
so the only surviving copies of this cutover sit on a track nothing applies.
The guard logic (`CHECK (violation_count = 0)`, `PRAGMA defer_foreign_keys = ON`,
before/after row counts) still exists in those two files, but it is not
reachable by any `pnpm db:migrate:*` path.

**Still not verifiable from the repo:** whether the cutover was ever run against
production D1. That is an operational fact — and note that production was built
from the legacy lineage, so it is the one database where `0087`/`0088` could
plausibly have been applied by hand.

**Doc drift: resolved.** `docs/migration/MONEY_CENTS_FIELD_RETIREMENT.md` is now
"Last reviewed: 2026-08-21" and its Current State section already documents the
squash and its two consequences. No action needed there.

**Original scope — kept for reference.** The ✅ marks below mean "written in
`migrations/0087`/`0088`", which after the squash means *present on a track no
`wrangler.toml` reads*. Do not read them as "applied".

- Confirm production `money_cents_retirement` and `money_cents_retirement_rollout` audit rows have `violation_count = 0` — enforced automatically via the self-guarding assertion table in the migration itself
- Rehearse the destructive migration on a restored D1 drill database with backup/restore evidence captured — ⚠️ unverified, see above
- Use the dedicated D1/SQLite drop-column cutover migration that omits only the legacy `REAL` money columns listed in `docs/migration/MONEY_CENTS_FIELD_RETIREMENT.md` — ✅ written, as `migrations/0087_money_cents_cutover.sql` / `0088_market_checkout_child_order_cents_cutover.sql` (the `migrations_fresh/0070`/`0071` this line used to name were deleted by the squash)
- Preserve primary keys, FKs, unique constraints, defaults, generated columns, indexes, non-legacy triggers, timestamp columns, and soft-delete columns
- Start the cutover with `PRAGMA defer_foreign_keys = ON`, run `PRAGMA foreign_key_check`, and include row-count assertions — ✅ present in the migration files
- Remove obsolete cents sync triggers and legacy fallback reads only after the cutover migration is verified

## database / transaction integrity

### Migrate remaining safeTransaction callers to D1 batch

**Priority:** P4 **Status: ✅ DONE 2026-09-05** (`1dd7a164`). The stub is gone; a comment at the same spot records why there is deliberately no transaction helper, so reaching for one is now a compile error rather than a runtime throw. Kept here for one release as traceability. **Earlier note (verified 2026-07-05):** Caller migration is COMPLETE. Repo-wide search (`grep -rln "safeTransaction" --include="*.ts" .`) finds `safeTransaction` used ONLY in its own definition (`packages/database/src/services/base.ts:154`, now `:228`) and its dedicated test (`base.test.ts`) — zero remaining callers anywhere in `apps/` or `packages/`. `FeedbackService.ts`, `LeaveService.ts`, and `SchedulingService.ts` (the three listed below) are all fully on `db.batch()` now (verified via git log: `5c2be3be`, `1f16fe22`, `b2f40b7b` and others).

**Remaining scope (the only thing left):**

- Delete `safeTransaction` from `BaseService` (`packages/database/src/services/base.ts`) so interactive transaction usage cannot be reintroduced — nothing calls it anymore, this is now dead code, not a migration
- Remove/update `base.test.ts`'s coverage of `safeTransaction` accordingly

**Re-verified 2026-09-05 — still open, and still exactly this small.**
`safeTransaction` is at `packages/database/src/services/base.ts:228` (the
2026-07-05 note's `:154` has drifted) and `base.test.ts` still exercises it via
a local subclass. The only other hits are build output (`packages/database/dist`,
`packages/ai-analytics/dist`), which regenerate. Zero production callers.

## billing / metering cost

### Stop writing one D1 row per API request for the `api.requests` meter

**Priority:** P2 **Status:** → **[#333](https://github.com/erictheng93/Makan-Masak/issues/333)** (filed 2026-09-05, carrying the full design and the rejected alternatives below). **Files:** `apps/api/src/middleware/usageTracker.ts`, `apps/api/src/shared/utils/meter.ts`, `apps/api/src/workers/usage-aggregator.ts`

**Context:** `usageTracker` is mounted on `apiV1.use("*")` and emits `api.requests` through `meterEmit`, which does one `INSERT INTO usage_events` per request. `usage_events` carries two indexes that a fresh insert touches (`usage_events_restaurant_meter_time_idx`, and `usage_events_pending_idx`, which is partial on `aggregated_at_ms IS NULL` — exactly the state a new row is in), so each request costs roughly 3 D1 rows written, and the hourly aggregator's `UPDATE` of `aggregated_at_ms` adds more. D1 bills rows written at $1.00/M over 50M/month included. At the `pro` tier's own hard cap of 1,000,000 `api.requests` per cycle, 50 pro tenants is ~150M rows written/month.

**Do not move this meter to Analytics Engine.** It is not telemetry: `plan-quotas.ts` gives it soft/hard limits per plan tier, and `BillingCycleService.ts:66-75` computes billable overage as `total_quantity - hardLimit`. Analytics Engine samples at volume, so it cannot be the store of record for an invoiced quantity. (This corrects the first-pass recommendation from the 2026-08-21 cost review.)

**The real cost is index amplification, not the row itself.** One request's `usage_events` row is written three times over its life, and each write is amplified by the indexes covering it:

| Stage | Rows written |
| --- | --- |
| `INSERT` — table, `restaurant_meter_time_idx`, and `pending_idx` (partial on `IS NULL`, which a fresh row matches) | 3 |
| Hourly aggregator `UPDATE aggregated_at_ms` — table, row leaves `pending_idx`, row enters `ttl_idx` | 3 |
| TTL `DELETE` at 90 days — table plus both covering indexes | 3 |
| **Total per API request** | **~9** |

**Scope — collapse the per-request row into an hourly bucket, in D1:**

```sql
INSERT INTO usage_meter_buckets (restaurant_id, meter_key, bucket_start_ms, quantity)
VALUES (?, ?, ?, 1)
ON CONFLICT (restaurant_id, meter_key, bucket_start_ms)
DO UPDATE SET quantity = quantity + 1
```

The `UPDATE` touches only `quantity`, never a column in the conflict-target index, so it costs **one row written and zero index writes** — down from ~9. It stays exact: D1 serializes writes, so `quantity = quantity + 1` cannot lose an increment. The bucket row _is_ the aggregate, so the aggregator's `UPDATE` pass disappears, and the TTL sweep drops from tens of millions of rows to one per restaurant per hour.

Rejected alternatives, so they do not get re-proposed:

- **In-isolate coalescing.** An isolate evicted with a non-empty buffer loses those counts. Undercounting only ever bills the customer less, but the number stops being reproducible, which fails the accuracy-first requirement.
- **Per-restaurant counter Durable Object.** To stay exact it must persist every increment, because a DO hibernates after 10 seconds idle and discards in-memory state — so it pays the same $1.00/M row write _plus_ $0.15/M in DO requests, making it strictly more expensive than the D1 bucket. Its compute duration is genuinely negligible (a counter DO meets every hibernation condition, so it is billed only for JS execution — roughly 125 GB-s per million requests against 400,000 GB-s included), but that is not enough to close the gap. Revisit it only if D1 _write throughput_ becomes the constraint rather than cost: D1 serializes every write onto one primary, and a counter DO gives each restaurant its own serialization point.

**Note what is lost:** the per-request `metadata` (method, path, status) goes away. Nothing in billing reads it, but it is useful for debugging. That payload is genuine telemetry — sampling is fine — so Analytics Engine is the right home for it, kept separate from the billed count.

**Re-verified 2026-09-05 — unchanged.** No `usage_meter_buckets` table exists in
the schema or on either migration track, and `apps/api/src/shared/utils/meter.ts:36`
still issues a raw `INSERT INTO usage_events` per call, mounted on every
`apiV1` request via `usageTracker.ts:49`. (Side note for whoever picks this up:
that raw string SQL is a Layer 3 query, which root `CLAUDE.md` bans in new code —
the rewrite should land on Drizzle, not another template string.)

**Also worth deciding separately:** `USAGE_EVENTS_TTL_DAYS` is 90. Rows are aggregated into `usage_meters` within the hour and then exist only as dispute evidence. Dropping to ~35 days (one cycle plus a buffer) cuts the table's D1 storage by roughly 60% and is a business call, not a technical one. Bucketing largely subsumes this.

### RealtimeSession is stuck on the key-value Durable Object backend

**Priority:** P3 **Status:** Blocked on Cloudflare (identified 2026-08-23) **Files:** `apps/realtime/wrangler.toml`, `apps/realtime/src/durableObjects/RealtimeSession.ts`

**Context:** `RealtimeSession` was provisioned key-value backed by the 2026-07-22 production deploy, when the migration still read `new_classes`. The key-value backend bills storage in 4 KB request units — reads $0.20/M over 1M/month included, writes $1.00/M over 1M/month included — while the SQLite backend bills whole rows regardless of size, reads $0.001/M over 25B included and writes $1.00/M over **50M** included. `addToEventHistory` rewrites the entire ~100-event array through `storage.put` on every broadcast, which is roughly 5 write units per broadcast on key-value against exactly 1 row on SQLite.

**Do not flip the migration to `new_sqlite_classes`.** A deployed class's storage backend cannot be changed in place; Cloudflare rejects `new_sqlite_classes` on an existing key-value class and the `exports` reconciler reports `storage_type_mismatch`. Because `makanmasak-realtime-prod` is already past `tag = "v1"`, wrangler sends no migration for that entry at all, so editing it does not move the backend — it only makes the file disagree with production. Commit `af729cd3` did exactly that on the false premise that nothing had been deployed; reverted 2026-08-23.

**Two ways out, neither free:**

- Wait for Cloudflare's promised key-value → SQLite migration path (announced as future work in the 2026-07-09 changelog). Zero effort, unknown date.
- Delete and re-provision the namespace under a new class name. That discards every object's stored state. `RealtimeSession` keeps only an event-history ring buffer and hibernating WebSocket attachments, so the loss is bounded — but every live socket drops. Only worth doing inside a planned maintenance window.

**Done 2026-08-23 — the reachable half.** `addToEventHistory` used to rewrite the whole ~100-event array through one `storage.put` on every broadcast, costing `ceil(arrayBytes / 4 KB)` write request units. It now writes one key per event (`evt:` plus a zero-padded sequence, so `storage.list()`'s lexicographic order is insertion order) and deletes only what the caps evict: **1 write request unit + 1 delete request per broadcast, independent of history size**. Legacy `eventHistory` arrays are migrated to per-event keys on first load, so a client reconnecting across the deploy still gets its delta. Only the storage layout changed — retention rules, ordering and the `/history` cursor behave exactly as before.

**Re-verified 2026-09-05 — unchanged and still externally blocked.**
`apps/realtime/wrangler.toml:39-41` still declares `tag = "v1"` /
`new_classes = ["RealtimeSession"]`, and the per-event `evt:` key layout
(`RealtimeSession.ts:40`) is in place as described.

**Still blocked:** the remaining gap is the backend itself. Reads are unchanged (one `list()` per object lifetime, same bytes as the old single `get`), and the delete request is inherent — every event written must eventually be removed. On SQLite that same delete is a row written against a free tier 50x larger.

## payments / provider integrations

### Defer real payment acquirer integration

**Priority:** P2 **Status:** Deferred 2026-06-06 — product decision **Context:** This project is not connecting a live payment acquirer for the current scope. Stored-value 代幣, admin/cash top-up, pay-at-venue, and vouchers are the supported MVP money loop. The market-checkout provider split and online credit top-up code paths intentionally remain provider-agnostic and fail closed when no provider endpoint is configured.

**Deferred scope:**

- Select and contract a live acquirer such as ECPay, Stripe, LINE Pay, TapPay, or NewebPay
- Provide production credentials and endpoints for `MARKET_CHECKOUT_PROVIDER_SPLIT_URL`, `MARKET_CHECKOUT_PROVIDER_STATUS_URL`, `MARKET_CHECKOUT_PROVIDER_REFUND_URL`, and `CREDIT_TOPUP_PROVIDER_URL`
- Enable real card / wallet payment confirmation and provider-split market payments
- Enable customer-facing online self-serve 代幣 top-up backed by the selected acquirer

**Current supported behavior:** The provider contracts, webhook/reconciliation plumbing, admin readiness checks, and online top-up intent flow are implemented for future use. When no provider is configured, online top-up returns `CREDIT_TOPUP_NOT_CONFIGURED` and market checkout provider status reports missing provider configuration.

## i18n

### Consolidate 3 duplicate i18n runtimes into @makanmasak/i18n shared package

**Priority:** P2 **Status:** Completed 2026-05-25 **Noticed on branch:** `feat/i18n-coverage-all-apps` **Context:** v2.1.0 adds i18n to kitchen-display, onboarding-app, and management-portal. Each app had its own ~200-line copy of `src/i18n/index.ts` (identical except for a doc-comment line). The shared package `@makanmasak/i18n` at `packages/shared/src/i18n/` already exists and is used by customer-app. The completed work migrated all 4 apps (admin-dashboard, kitchen-display, onboarding-app, management-portal) to the shared package, resolving the API difference (custom composable vs vue-i18n).

**Resolution:** Added a shared `createI18n()` runtime factory, migrated duplicate app runtimes to wrappers around `@makanmasak/i18n`, standardized locale storage on `makanmakan_locale` with legacy `locale` migration, hardened message merging, and derived app `Messages` types from each app's `zh-TW.ts`.

**Scope:**

- Extract runtime (ref state, `t()`, `deepMerge`, `setLocale`, `loadLocaleMessages`, `initI18n`, `useI18n`) into `packages/shared/src/i18n` as a `createI18n(appMessages)` factory
- Each app owns only its `Messages` type and locale files
- Standardize on `makanmakan_locale` localStorage key (currently `locale` in 3 apps, `makanmakan_locale` in shared package)
- Standardize type safety: derive `Messages` type from zh-TW.ts instead of open recursive map

### Fill stub locale translations (zh-CN, vi-VN, ms-MY, id-ID)

**Priority:** P3 **Status:** Completed 2026-05-26 — AI-assisted localization accepted **Context:** 4 out of 6 locales per app were empty-object stubs that fell back to zh-TW. External translator approval was waived because of resource constraints; target copy is completed as maintainer-accepted machine localization.

**Approval model:** `docs/i18n/locale-approval-manifest.json` records the accepted handoff hash and documents that target copy was generated from the existing zh-TW/en-US sources with machine translation under maintainer acceptance.

**Scope:**

- Extract all unique keys from kitchen-display/zh-TW.ts, onboarding-app/zh-TW.ts, management-portal/zh-TW.ts — done in `scripts/i18n-locale-coverage.ts`
- Deliver locale copy in a structured review/import format — done in `docs/i18n/locale-translator-handoff.csv`; export preserves already-filled target cells on rerun
- Validate approved handoff and approval manifest before import — automated via `pnpm run i18n:check-handoff -- docs/i18n/locale-translator-handoff.csv`
- Import approved translations back into app locale files — automated via `pnpm run i18n:import-handoff -- docs/i18n/locale-translator-handoff.csv`
- Add CI check that warns when a non-zh-TW locale has fewer leaf keys than zh-TW — done via `pnpm run check:i18n-locales`; strict completion gate available via `pnpm run check:i18n-locales:strict`

### i18n performance: convert HistoryView status/type helpers to computed maps

**Priority:** P3 **Status:** Completed 2026-05-25 **File:** `apps/kitchen-display/src/views/HistoryView.vue` **Context:** `statusLabel()` and `typeLabel()` are plain functions called per row in a v-for. Each call rebuilds a Record of 8+ `t()` calls, so rendering N orders triggers ~10N `t()` invocations per render. Not a visible regression yet (history page is not a hot path) but worth cleaning up.

**Fix:** Convert to computed maps keyed on locale so Vue only rebuilds the map when the locale changes.

### i18n edge cases in displayTableName regex

**Priority:** P4 **Status:** ⚠️ Partially completed 2026-05-25 **File:** `apps/kitchen-display/src/components/orders/OrderCard.vue:314`. The regex was tightened to `^(Table|桌)[\s-]+/i` as planned, so the `桌子` case is fixed. The prefix list was never extended, and the condition for extending it has since been met: `vi-VN` and `ms-MY` locales were filled 2026-05-26, so `Bàn 4` and `Meja 4` now reach this code and are not stripped. **Context:** `displayTableName` stripped `^(Table|桌)[\s-]*` to prevent prefix duplication. Edge cases were not currently in production data:

- Vietnamese `Bàn 4` → would not be stripped (expected Vietnamese locale also translates `orders.table` → `Bàn`)
- Malay `Meja 4` → same
- Edge: table name starting with `桌子` (Chinese "table" noun) would lose `桌` — requires word boundary

**Fix:** Require a trailing separator in the regex: `^(Table|桌)[\s-]+`, with regression coverage for `Table 4`, `Table-4`, `桌 4`, `桌-4`, `桌子 4`, and `Tabletop 4`. Extend prefix list when Vietnamese/Malay translations land.

### Harden deepMerge against prototype pollution

**Priority:** P4 **Status:** Completed 2026-05-25 **File:** `apps/kitchen-display/src/i18n/index.ts` (+ onboarding-app, management-portal) **Context:** `setLocaleMessages` uses `deepMerge` which uses `instanceof Object` and `key in target`. Today only static imports flow through this path so it's safe. If future work loads locales from a remote source (A/B tests, CMS-driven translations), a malicious JSON payload with `__proto__` / `constructor.prototype` keys could pollute `Object.prototype`.

**Fix:** Replace `instanceof Object` with `Object.prototype.toString.call(v) === '[object Object]'`. Use `Object.prototype.hasOwnProperty.call(target, key)`. Explicitly skip `__proto__`, `constructor`, `prototype`. Or just drop `deepMerge` entirely since locale files are static — a straight assignment works.

### Standardize toLocaleTimeString/DateString to use active locale

**Priority:** P4 **Status:** ⚠️ Completed 2026-05-25 **for the 10 files listed below, but not fully** — a 2026-07-05 check found an eleventh that was never on the list, and it is still there today: `apps/kitchen-display/src/components/performance/PerformanceDashboard.vue:707` hardcodes `.toLocaleString("zh-TW")`. **Context:** 10 kitchen-display files still pass hardcoded `"zh-TW"` to `toLocaleTimeString`/`toLocaleDateString`. Most use 24-hour format which renders identically across locales, so the bug is invisible today. Should be cleaned up so future changes (e.g. adding seconds or switching to 12-hour) stay locale-aware.

**Files:** OrderCard.vue, OrderDetailsModal.vue, ConnectionStatus.vue, HistoryView.vue, SystemHealthDashboard.vue, ErrorReportsDashboard.vue, EnhancedShortcutsPanel.vue, InteractiveAudioPanel.vue, InteractiveStatsPanel.vue, kitchenStatisticsService.ts

## waiting-list (customer-side queue)

### Wire push notification end-to-end on call/about-to-expire

**Priority:** P2 **Status:** Completed 2026-05-25 for `waiting_called`; `waiting_about_to_expire` remains a future scheduler/alarm enhancement. **Spec:** `docs/specs/queue-and-waiting-list.md` **Context:** Phase 1 (commits `0ad8522f`, `309c3db6`, 2026-05-04) shipped the customer join/ticket/cancel/confirm UI. VAPID + Service Worker subscription already exist in `apps/customer-app/src/utils/push-notifications.ts`. Server-side `WaitingListService.callWaiting()` now dispatches customer web push for canonical customer-linked tickets and records `notified_at`.

**Resolution:** Customer-app requests push permission and subscribes after a successful join. The public waiting-list join route links tickets to the authenticated canonical customer when a valid customer JWT is present. The API dispatches `waiting_called` through `customer_push_subscriptions`, updates push delivery health, and the customer service worker deep-links notification clicks back to `/r/:restaurantId/wait-list/:ticketId`.

**Scope:**

- Customer-app: call `customerPushService.requestPermission()` + `subscribe()` on join success in `JoinWaitingListView.vue`; persist returned subscription against the ticket
- API: confirm or add an endpoint that accepts `{ subscription, ticketId }` (audit `apiClient.post("/push/subscribe", ...)` — route may already exist for orders)
- WaitingListService: dispatch web-push when ticket flips to `called`; consider also firing on `waiting_about_to_expire` (5-min timeout window — `NotificationType` enum already has the slot)
- Service Worker: handle `waiting_called` action click → deep-link back to `/r/:restaurantId/wait-list/:ticketId`

### Customer waiting-list history page

**Priority:** P3 **Status:** Completed 2026-05-25 **Context:** Phase 1 has no history view in customer-app. Useful for users to see prior visits without re-entering phone every time.

**Scope:** New API (`GET /waiting-list/history?phone=` or `?customerId=`) + view at `/wait-list/history`. Phone-based lookup must be rate-limited to avoid enumeration.

### Pre-order from menu while in waiting-list

**Priority:** P3 **Status:** Completed 2026-05-25 **Spec:** `docs/superpowers/specs/2026-05-25-waiting-list-preorder-design.md` **Context:** Customer is queued and could be browsing menu. Cross-system integration with existing menu/order flows so the order is bound to the ticket and fires to kitchen on `seated`.

**Resolution:** Orders now support `waiting_list_id` binding. Waiting-list pre-orders are held as `pending` until staff seats the ticket, then `markSeated()` assigns the table and promotes them to `confirmed` so kitchen active-order queries receive them.

### Phase 1 small debt

**Priority:** P4 **Status:** Completed 2026-05-25 **File:** `apps/customer-app/src/views/waiting-list/JoinWaitingListView.vue`, `apps/customer-app/src/locales/`

- `JoinWaitingListView.vue:292-298`: `watch(partySize)` calls `estimateWait().then()` with no `.catch` — silent stale value on failure
- `JoinWaitingListView.vue:300-303`: `restoreLastTicket()` and `loadQueueSnapshot()` race in parallel; if restore triggers `router.replace`, snapshot still completes (wasted request, no crash)
- i18n keys live in a parallel `src/locales/` dir alongside `src/i18n/` — should consolidate into the existing customer-messages source

## customer-identity

### Resolve customer/user identity fork (FK migration + 5 satellite tables)

**Priority:** P2 (done — kept here for traceability, see Status) **Spec:** `docs/superpowers/specs/2026-05-25-customer-identity-and-profile-design.md` **Context:** the FK migration and satellite tables described below have landed — `packages/database/src/schema/orders.ts:54`, `reservations.ts:36`, and `waiting-list.ts:36` all define `customerId` as `TEXT` FK to `customers.id`, and `customers.ts` defines the satellite tables (`customerPreferences`, `customerFavorites`, `customerPushSubscriptions`, `customerPhoneVerificationTokens`). The original claim that these were `INTEGER` FKs to `users.id` with `customers` "functionally orphaned" was stale and has been corrected.

**Status (verified 2026-07-05 — Phase 1 COMPLETE):** Full re-verification against the spec confirms every Phase 1 scope item has landed and is live in production code, not just planned:

- `customers` table rebuilt exactly per spec §5.1: `displayName`, `primaryPhone`, `primaryEmail`, `avatarUrl`, `locale`, `status`, `lastSeenAt`, `uuidv7()` ID generator (`packages/database/src/schema/customers.ts`).
- Dedicated `canonicalCustomerAuthMiddleware` (`apps/api/src/middleware/auth.ts:298`) validates `{ sub: customers.id, type: "customer" }` JWTs — separate from the legacy `customerAuthMiddleware = createAuthMiddleware(5)`, which is intentionally kept for legacy routes (matches the spec's locked decision to preserve `users.role = 5` rows, not an oversight).
- All 17 spec'd endpoints (`auth/request-otp`, `verify-otp`, `refresh`, `logout`, `me` GET/PATCH/DELETE, `preferences` GET/PATCH, `favorites` GET/POST/DELETE, `push-subscriptions` GET/POST/DELETE, `consents` GET/POST) are implemented in `apps/api/src/features/customer/routes/index.ts` and mounted live at `apiV1.route("/customer", customerRouter)` (`apps/api/src/app-factory.ts:674`). Access/refresh tokens are 15 min / 30 day exactly per spec §6.2; OTP hashed with bcrypt, rate-limited per phone+IP.
- Real-D1 integration coverage in `apps/api/src/__tests__/integration/customer-identity.real.integration.test.ts` (13 cases): OTP auth issuance, phone E.164 normalization, phone-number reclaim from deleted customers, refresh-token revocation on logout, staff-JWT rejection on canonical customer endpoints, push-subscription upsert + daily stale-pruning cron, idempotent favorites (incl. market favorites + recent-market-visit tracking), consent grant/revoke with shared-catalog version validation.
- customer-app: `LoginView.vue` (phone-OTP flow), `ProfileView.vue` (preferences, consent toggles, push enrollment via `customerPushService`), favorites wired into `MarketsView.vue`/`MarketDetailView.vue` via `marketEngagement.ts` + `customerIdentityApi.ts` (not a standalone "favorites" view — easy to miss on a filename-only search).
- Open, low-priority: `USER_ROLES.CUSTOMER = 5` has not been removed from `apps/api/src/shared/constants/index.ts` (intentional — legacy rows are preserved per the spec's locked decision) and no `customer_preferences` backfill script from legacy `users.preferences` JSON was found (unclear if any legacy rows actually needed it).

**Unblocks:** Marketplace Phase 4 (customer follow + broadcast push) below — its hard prerequisite (`customer_favorites`, `customer_push_subscriptions`, `customer_consents`) is satisfied.

**Scope (Phase 1, ~30 dev-days estimated in spec §15) — all items below are ✅ done, verified 2026-07-05:**

- Create 5 new tables: `customer_preferences`, `customer_favorites` (polymorphic), `customer_push_subscriptions`, `customer_consents` (append-only), `customer_phone_verification_tokens`
- Rebuild `customers` table: rename `full_name → display_name`, `phone → primary_phone`, `email → primary_email`; add `avatarUrl`, `locale`, `status`, `lastSeenAt_ms`; switch ID generator from `crypto.randomUUID().replace(/-/g, "")` to `uuidv7()`
- Table-rebuild FK migration on `orders` / `waiting_list` / `reservations` (`customer_id INTEGER → TEXT`, FK → `customers.id`)
- Customer auth service: phone-OTP flow + JWT (15 min access / 30 day refresh) with `type: "customer"` discriminator
- New `canonicalCustomerAuthMiddleware` in `apps/api/src/middleware/auth.ts`
- New feature folder `apps/api/src/features/customer/` with 17 endpoints (auth, me, preferences, favorites, push, consents)
- customer-app: login screen, favorites UI, push enrollment flow, settings/consent UI
- Not done (low-priority, see Status): backfill `customer_preferences` from legacy `users.preferences` JSON; full removal of `USER_ROLES.CUSTOMER = 5` (deferred by design)

**Hard prerequisite for:** marketplace Phase 4 (follow & broadcast) and waiting-list Phase 2 push (reuses `customer_push_subscriptions`).

## marketplace (night market / 商圈)

### Phase 1 — Markets entity + GPS discovery + takeaway bridge

**Priority:** P2 **Spec:** `docs/superpowers/specs/2026-05-25-night-market-discovery-design.md` **Context:** Today's Discovery system treats every shop as an island; `restaurants.district` is a free-text label and `latitude / longitude` columns are reserved-but-unused. To serve night markets and commercial districts, "market" needs to become a first-class entity, GPS search needs to be activated, and Discovery needs to bridge into checkout without a QR scan.

**Status:** Completed 2026-05-25. Backend core landed in commit `89147020`; customer-app market browse/detail routes and the Discovery → takeaway button bridge landed in commit `8ae7ce3a`; admin market CRUD and vendor membership management landed in commit `c5f814c9`; onboarding now captures mandatory restaurant GPS coordinates for future market discovery; admin-dashboard has read-only market memberships plus join-request submission; public market reads now use versioned KV cache keys invalidated by admin market/vendor mutations. Six locked decisions are captured in §11 (platform-owned in Phase 1, free pricing, no native DM, deep-link contact MVP, list-only without map, and DB-level partial unique active memberships).

**Scope (Phase 1, ~27 dev-days estimated in spec §14):**

- New tables: `markets`, `restaurant_market_memberships`
- Modify `dish_search_index`: add `primaryMarketId`, `marketIds` (JSON), `latitude`, `longitude`
- New `apps/api/src/features/markets/` with public + admin endpoints (`/markets`, `/markets/:slug`, `/markets/:slug/vendors`, `/markets/nearby`, admin CRUD in `apps/management-api`)
- Extend `DiscoveryService`: `marketId` and `lat/lng/radiusKm` filters; bounding-box + Haversine `findNearby`
- New `takeaway-eligibility` endpoint that returns existing `shopQrCode` as the entry token (bridges Discovery → existing shop-mode order flow)
- Extend `SearchIndexSyncService` to subscribe to membership and market changes
- KV cache: versioned `markets:v{version}:detail:{slug}`, `markets:v{version}:list:...`, `markets:v{version}:vendors:...`, and `markets:v{version}:nearby:...` keys with `markets:version` invalidation on admin market/vendor mutations
- customer-app: `/markets`, `/markets/:slug` routes; `MarketCard`, `MarketDetailHero`, `VendorListInMarket`; "立即外帶" button on `DishResultCard` / `RestaurantCard`
- management-portal: `MarketsView.vue` (admin CRUD, attach vendors)
- onboarding-app: mandatory "Pick location on map" step capturing `latitude / longitude`
- admin-dashboard: read-only "Markets I belong to" section + "request to join" form

### Phase 3 — Vendor contact via deep links + FAQ (no native DM)

**Priority:** P3 **Status:** Completed 2026-05-25. **Spec:** `docs/superpowers/specs/2026-05-25-night-market-discovery-design.md` §10 Phase 3 **Context:** Native customer↔vendor DM was rejected (decided 2026-05-25): small vendors won't staff a real-time inbox, and forcing them onto a platform DM creates ignored-message friction. Customer contact in MVP routes to wherever vendors already work (LINE / IG / WhatsApp / Telegram) and offers a per-restaurant FAQ auto-suggest for the common questions.

**Resolution:** Restaurants now have public `messagingChannels` deep links plus `restaurant_faqs`. Owners can manage contact channels and FAQs from admin-dashboard settings; customer-app market vendor cards expose "聯絡店家", searchable FAQ accordions, and native third-party deep-link buttons. Re-evaluate native DM only after ≥50 vendors actively use the deep-link path and survey data justifies the build.

**Scope:**

- Add `messagingChannels` JSON column to `restaurants`: `{ line?, whatsapp?, instagram?, telegram? }` (each entry a public deep-link URL)
- New table `restaurant_faqs`: `restaurantId`, `question`, `answer`, `keywords` (JSON), `displayOrder`, `isActive`
- Admin-dashboard: "Contact channels" + "FAQs" tabs on restaurant settings
- customer-app: "聯絡店家" button on vendor detail page → opens platform native app via `line.me` / `wa.me` / `ig.me`
- customer-app: "常見問題" accordion above the contact buttons; keyword search across FAQs

### Phase 4 — Customer follow + broadcast push (depends on customer-identity)

**Priority:** P3 **Spec:** `docs/superpowers/specs/2026-05-25-night-market-discovery-design.md` §10 Phase 4 **Context:** Customer can follow markets and vendors; vendors and market operators can broadcast push notifications to followers, gated by `customer_consents WHERE consentType='marketing'`. Reuses VAPID infra from waiting-list Phase 2.

**Why deferred:** Hard prerequisite — customer-identity work above must land first because "follow" rows live in `customer_favorites` and "broadcast targets" live in `customer_push_subscriptions`. Without those tables, this feature has nowhere to attach.

**Status:** → **[#335](https://github.com/erictheng93/Makan-Masak/issues/335)** (filed 2026-09-05, `needs-planning`). **Re-verified 2026-09-05 — still unblocked, still unbuilt:** No
market- or restaurant-scoped broadcast endpoint and no "Following" UI exist.
Note for future searches: `RealtimeBroadcastService` **does** exist and matches a
naive grep for "Broadcast", but it is the group-order/realtime fan-out in
`@makanmasak/database`, unrelated to marketing broadcast. This phase is the
largest genuinely-unbuilt item in this file.

**Scope:**

- "Follow" UI on `MarketDetailHero` / `RestaurantCard` → writes `customer_favorites(targetType='market' | 'restaurant')`
- New `BroadcastService` in `apps/api`: fans out push via `customer_push_subscriptions` filtered by `customer_consents`
- New admin endpoints: `POST /api/v1/markets/:id/broadcasts`, `POST /api/v1/restaurants/:id/broadcasts` (rate-limited, per-restaurant audit)
- customer-app: "Following" tab in profile view; opt-in / opt-out granular controls (overall marketing, favorites-only, quiet hours)

### Phase 5 — Operator role + portal

**Priority:** P4 **Spec:** `docs/superpowers/specs/2026-05-25-night-market-discovery-design.md` §10 Phase 2 **Context:** Promote `market_operator` to a first-class role (separate from existing 0–4 restaurant roles) with self-service market editing, vendor approval queue, and per-market analytics.

**Why deferred:** Phase 1 markets are platform-admin-owned, which is sufficient for MVP. Operator self-service is a scaling tool, not a launch requirement.

**Re-verified 2026-09-05 — unbuilt.** Zero occurrences of `market_operator` /
`MARKET_OPERATOR` anywhere in `apps/` or `packages/` source.

**Scope:**

- New role: `market_operator` in `USER_ROLES`
- New table or column linking operators to markets (operator can manage 1+ markets)
- Self-service market metadata editing (subset of admin endpoints)
- Vendor membership approval queue (vendor requests → operator approves/rejects)
- Per-market analytics dashboard in management-portal

## authentication

### Account security and auth statistics are stubs that report zeros

**Priority:** P2 **Status:** Open (absorbed 2026-09-05 from the archived 2026-05-02 debt scan, which had it corrected-to-open on 2026-07-05; re-verified against the tree today) **File:** `apps/api/src/features/authentication/services/AuthService.ts`

**Context:** The 2026-04-21 auth work landed password reset, email verification,
profile read/update and session termination on real database paths. Two
surfaces were reported as done in the same breath and are not:

- `getSecurityEvents()` unconditionally `return []` after logging
  `"getSecurityEvents not fully implemented"` (`:1019`).
- `checkAccountSecurity()` hardcodes `failedLoginAttempts: 0` (`:1036`) and
  `twoFactorAdoptionRate: 0` (`:1085`).

**Why it matters more than a normal stub:** these are not empty screens, they
are *reassuring* ones. An account-security panel that always reports zero
failed logins reads as "nothing suspicious has happened", which is the opposite
of unknown. 2FA is intentionally unsupported today, so a zero adoption rate is
technically true but says nothing.

**Scope:**

- Decide whether the surface should report real data or be removed until it
  can. Removing it is a legitimate answer and cheaper than half-filling it.
- If kept: source failed-login counts from a real store (there is no
  login-attempt table today — that is the actual work), and drop the 2FA metric
  entirely until 2FA exists rather than reporting 0.

## qr codes

### Requesting a PDF or JPEG QR silently returns an SVG

**Priority:** P3 **Status:** Open (absorbed 2026-09-05 from the archived 2026-05-02 debt scan; verified today) **File:** `apps/api/src/features/qr-codes/services/QrCodesService.ts:487`

**Context:** The 2026-04-22 fix replaced placeholder buffers with real QR
artifacts, which was the P1. What it left behind is narrower but is still a
response that does not match its request:

```ts
if (format === "svg" || format === "pdf" || format === "jpeg") {
  const svg = await QRCode.toString(content, { ...options, type: "svg" });
  return { data: ..., contentType: "image/svg+xml", extension: "svg" };
}
```

A caller asking for `pdf` gets an SVG, labelled `image/svg+xml`, named `.svg`.
No error, no warning. The old debt note framed this as "add true PDF/JPEG
renderers"; the cheaper half is that until they exist, an unsupported format
should 400 rather than substitute.

**Scope:** Either render the requested format, or reject unsupported formats
explicitly. Do not keep silently substituting.

## repository cleanup

### Twelve stale `.disabled` / `.old` / scratch files are still tracked

**Priority:** P3 **Status:** Open (absorbed 2026-09-05; count re-verified today — the original list of 18 is down to 12, and `WaitingListView.vue.old` has gone since the 2026-07-05 pass)

**Files:**

- `apps/api/src/examples/StripeIntegrationExample.ts.disabled`, `PaymentSystemUsage.ts.disabled`
- `packages/database/migrations/` — `0010_index_optimization.sql.disabled`, `0039_9_cleanup_new_tables.sql.disabled`, `0040_comprehensive_restaurant_id_migration.sql.disabled`, `0041_remaining_tables_structure.sql.disabled`, `0042_migrate_data_part1.sql.disabled`, `0043_migrate_data_part2.sql.disabled`, `0044_cleanup_and_rename.sql.old`
- `apps/admin-dashboard/src/views/ReservationView.vue.old`
- `apps/kitchen-display/priority3-final-status.txt`, `order-workflow-errors.txt`

**Note before deleting the migration ones:** they sit on
`packages/database/migrations/`, the legacy track that no `wrangler.toml`
reads — so they are inert twice over. That also means deleting them is safe in
a way it would not be on the fresh track.

**Scope:** decide keep/delete per file (git history preserves them either way),
then add a pre-commit or CI check that blocks new `.old` / `.disabled` /
scratch `.txt` outside approved directories, since this list regrew after the
last cleanup.

## admin-dashboard

### Seven unimplemented TODOs across scheduling, POS, queue and backup

**Priority:** P3 **Status:** Open (absorbed 2026-09-05; per-file counts verified today)

**Files and counts:** `components/scheduling/SchedulingConflicts.vue` (2),
`views/POSManagementView.vue` (2), `views/scheduling/SchedulingView.vue` (1),
`services/queueService.ts` (1), `components/backup/CreateBackupModal.vue` (1).
`components/backup/BackupListItem.vue` is now clean.

**Scope:** scheduling conflict ignore/details behaviour; schedule date
filtering / create modal; promotion edit dialog; shift report dialog; backup
component local types replaced with shared types; queue capacity forecast once
an API exists.

**Related:** several of these overlap issues already filed from the admin QA
runs (#307, #308, #320). Check those before starting — the panel may be dead
for a bigger reason than a missing handler.

## known stubs returning fixed values

### Four fields exist in responses but are hardcoded or never populated

**Priority:** P3 **Status:** Open (absorbed 2026-09-05; all four re-verified today)

Grouped because they share a failure mode: the field is in the response
contract, so a consumer can read it and believe it.

| Field | Location | Current value |
| --- | --- | --- |
| `repeatCustomerRate` | `packages/ai-analytics/src/services/AIInsightsService.ts:278` | `0`, with its own `// TODO: Calculate from user order history` |
| `served_by_name` | `packages/queue-service/src/services/QueueService.ts:546-548` | `undefined`; needs a cross-package user lookup |
| `PAYMENT_AUDIT_EVENT_TYPES.FAILURE` | payments / billing | defined but emitted nowhere — no failure path writes an audit row |
| device uptime / busy hours | `packages/queue-core/src/print/services/PrinterService.ts` | not tracked |

**Scope:** for each, either populate it or remove it from the response.
`FAILURE` is the one with real consequence: the payment audit log records
attempts and successes, so a reader cannot distinguish "no failures" from
"failures are not recorded".

## testing / fixture harnesses

### E2E skips and mock-heavy API tests

**Priority:** P2 **Status:** Open (absorbed 2026-09-05 from the archived 2026-05-02 debt scan; both counts re-measured today)

**E2E: 11 unconditional skips, unchanged since 2026-07-05.** Across
`tests/e2e/smoke/` (owner-overview, smoke, admin-realtime-websocket,
kitchen-display, owner-pos-usage-state, owner-order-management,
owner-menu-management, owner-backoffice-pages) and
`tests/e2e/integration/real-workflows.spec.ts`. A skipped journey is
indistinguishable from a passing one in the run summary.

**Mocks: 159 of 288 API test files call `vi.mock`** — up from the 132 of 213
recorded 2026-07-05. The ratio held at 55% while the suite grew, so the
mock-first habit is being reproduced, not worked off. 54 files are
`*.real.integration.test.ts`. This is the same shape as the tenancy-guard
finding: a hand-written auth mock silently swallows the middleware, so a test
can pass against a route that has no guard at all.

**Scope:**

- Replace unconditional skips with feature flags or fixtures, or delete the
  test if the journey does not exist. Each remaining skip needs a stated
  unblock condition.
- Add a CI check that fails when a new unconditional skip appears — without it
  this count only goes up.
- Pick the ten highest-risk mocked feature tests (start with anything
  tenant-scoped) and convert them to real-D1 suites. Keep unit mocks for pure
  business rules; require at least one real route test per exposed feature.

### Unify GroupOrdersService's file-local select harness with `createSelectFixtureDb`

**Priority:** P4 **Status:** Open (identified 2026-08-20, deferred from #213) **Files:** `apps/api/src/features/group-orders/services/GroupOrdersService.test.ts`, `packages/database/src/testing/select-fixtures.ts`

**Context:** #213 moved this file's write fixtures onto the shared `createMutationFixtureDb`. Its reads still use a file-local harness that already routes by table and throws on missing/exhausted fixtures — the same rules the shared one enforces — so this is de-duplication, not a bug.

**Why deferred:** The local harness has a `rawSqlSubquery` catch-all bucket for `.from()` arguments that are raw SQL subqueries rather than registered tables. `createSelectFixtureDb` has no catch-all: an unregistered `from()` argument throws there. Migrating means adding a routing escape hatch to a module 24 other test files depend on, for one caller.

**Scope:** Either give `createSelectFixtureDb` a declared fallback bucket, or rework the two subquery-backed reads in `GroupOrdersService` so every `from()` target is a real table.

**Re-verified 2026-09-05 — unchanged.** The `rawSqlSubquery` symbol and its
routing fallback are still in `GroupOrdersService.test.ts` (declared at :92,
routed at :139, one fixture at :3784); writes are already on the shared
`createMutationFixtureDb` (:211), exactly as #213 left it.

### Narrow `CouponsService.createCouponWithValidation`'s return type

**Priority:** P4 **Status: ✅ DONE 2026-09-05** (`719e54f7`). Narrowing it surfaced two wrong assumptions the `unknown` had been hiding: the test declared `id: string` against an `integer` column, and asserted `isActive === false || isActive === 0` — a hedge whose second branch can never run, since `is_active` is `integer({ mode: "boolean" })` read back through Drizzle `.returning()`. **Files:** `apps/api/src/features/coupons/services/CouponsService.ts`, `apps/api/src/__tests__/integration/coupons.real.integration.test.ts`

**Context:** `createCouponWithValidation` is declared `Promise<unknown>`, and `PaginatedCouponsResponse.coupons` inherits that looseness. Because of it the coupons integration suite has to state the coupon shape locally (`CouponResponse`) rather than derive it from the service the way the other suites do.

**Why deferred:** #207's scope was `no-explicit-any` in test code. Narrowing the return type is a production-signature change with its own callers to check, and the issue explicitly says such findings should be filed rather than forced through a cast in the test.

**Scope:** Give the method a concrete return type (the formatted coupon row), let `PaginatedCouponsResponse` follow, then replace the test's local `CouponResponse` with `ServiceData<CouponsService["createCouponWithValidation"]>`.

**Re-verified 2026-09-05 — unchanged.** Still
`async createCouponWithValidation(data: CreateCouponData): Promise<unknown>` at
`CouponsService.ts:214`, and the integration suite still carries its local
`CouponResponse` interface.

## deployment

### The production deploy workflow has never successfully run

**Priority:** P1 **Status:** Open (identified 2026-08-23) **Files:** `.github/workflows/deploy-production.yml`

**Context:** `deploy-production.yml` has been dispatched exactly once, on 2026-07-24 (run `30110053816`). It failed in the first package `pnpm -r run deploy:prod` reached, `apps/backup-scheduler`, with:

```
✘ [ERROR] In a non-interactive environment, it's necessary to set a
CLOUDFLARE_API_TOKEN environment variable for wrangler to work.
```

The step does pass `CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}`, so the repository (or `production` environment) secret is unset or empty. `pnpm -r` aborts on the first failure, so **nothing reached Cloudflare in that run** — no worker was uploaded, and no partial deploy needs unwinding. Every other run of this workflow was `workflow_run`-triggered and skipped by the confirmation gate.

**Consequence:** every production deploy to date has been run by hand from a workstation. There is no deployment record in the repository, no post-deploy smoke test, and no way to tell from here which commit any given worker is serving.

**Nothing is set.** `gh secret list` returns only `CLAUDE_CODE_OAUTH_TOKEN` and `CLOUDFLARE_ANALYTICS_READ_TOKEN` at the repository level, and `gh secret list --env production` is empty — while the workflow references five secrets. GitHub expands a missing secret to an empty string rather than failing, which is why the error surfaced inside wrangler instead of at the workflow level.

**Scope — set all five on the `production` environment**, not at repository level: the deploy job declares `environment: production`, so environment secrets resolve for it and for nothing else, whereas a repository secret is readable by every job in every workflow.

| Secret | Value | Actually secret? |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | account-owned token, see permissions below | yes |
| `SLACK_WEBHOOK_URL` | deploy notification webhook | yes |
| `CLOUDFLARE_ACCOUNT_ID` | `bdddc08c066a9abc285d75fe5947a468` | no — already committed in `apps/api/wrangler.toml` |
| `PRODUCTION_URL` | `https://api.makanmasak.com` — the **API** origin | no |
| `PRODUCTION_CUSTOMER_URL` | `https://makanmasak.com` | no |
| `PRODUCTION_KITCHEN_URL` | `https://kitchen.makanmasak.com` | no |

**The auto-deploy chain is a second, separate blocker** (absorbed 2026-09-05
from the archived 2026-05-02 debt scan). Even with the secrets set, the workflow only
ever runs by hand: the `workflow_run:` trigger at
`.github/workflows/deploy-production.yml:16` is still commented out, with a
note at line 12 saying it stays disabled until the repository has an
environment approval gate. So there are two things to finish, and setting the
secrets only clears the first:

1. Secrets, so a dispatch can actually reach Cloudflare — the wizard below.
2. Required reviewers plus a main-only branch restriction on the `production`
   environment, then uncomment the `workflow_run` trigger, then delete the
   stale comments that still cite fixed smoke-test and missing
   `tests/e2e/smoke/` blockers (both resolved).

**There is now a wizard for this: `scripts/setup-production-deploy.sh`.** It
checks the `production` environment exists, walks the Cloudflare token form
permission by permission, **verifies the token against the account before
storing it** (the check that would have caught the 2026-07-24 failure), and sets
all six values as environment secrets. It never writes the token to disk. The
one thing it cannot do for you is create the token — that needs the dashboard.

**Re-verified 2026-09-05 — nothing has changed, and this is the highest-priority
open item in the file.** `gh run list --workflow=deploy-production.yml` still
shows exactly one `workflow_dispatch` (run `30110053816`, 2026-07-24, failure)
with every other run `workflow_run`-triggered and skipped.
`gh secret list --env production` is still empty; repository level still holds
only `CLAUDE_CODE_OAUTH_TOKEN` and `CLOUDFLARE_ANALYTICS_READ_TOKEN`, neither of
which this workflow uses.

The account is `bdddc08c066a9abc285d75fe5947a468`, which is not the one a local `wrangler login` resolves to by default — see the account-split note.

**Token permissions**, derived from the bindings actually declared across the ten `wrangler.toml` files. Account: Workers Scripts Edit, Workers KV Storage Edit, Workers R2 Storage Edit, D1 Edit, Queues Edit, Vectorize Edit, Workers AI Edit, **Cloudflare Pages Edit**, Account Settings Read. Zone (`makanmasak.com`): Workers Routes Edit, DNS Edit for the four `custom_domain` entries. Pages Edit is the one most easily missed — the five frontends deploy with `wrangler pages deploy`, which Workers Scripts Edit does not cover, and `pnpm -r run deploy:prod` reaches them. Do not add a client-IP restriction: GitHub-hosted runner addresses are not stable.

## Completed

Completed work is **not** collected here — it stays inline under its own section
with a `Status: Completed <date>` marker, so the surrounding context and scope
stay attached to it. As of 2026-09-05 that covers thirteen items: the six
i18n entries, the four waiting-list entries, customer-identity Phase 1 (which
uses a `Status (verified ...)` marker rather than `Status: Completed`, so a
grep for the latter finds only twelve), and marketplace Phases 1 and 3.

One of the thirteen is only **partially** complete and should not be read as
shipped-in-full: "Wire push notification end-to-end" covers `waiting_called`
only — `waiting_about_to_expire` still needs a scheduler/alarm and has never
been built.

This heading is kept only so that the "_None yet._" placeholder that used to sit
here stops reading as "nothing in this file has shipped".
