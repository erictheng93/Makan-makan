# TODOS

Organized by skill/component, then priority (P0 top → P4 bottom, then Completed).

## API contracts

### Record field types in the API contract snapshot

**Priority:** P2 **Status:** Open (identified 2026-08-13) **Files:** `scripts/check-api-contracts.cjs`, `.api-contracts-snapshot.json`

**Context:** `contract:check` reports schema-field additions/removals, but its static extractor stores only field names. Consequently, a wire-contract change such as menu/category `createdAt` and `updatedAt` changing from ISO strings to Unix-millisecond numbers produces no contract warning. The script's header currently overstates this capability by saying type changes are detected.

**Scope:**

- Extend the extractor and snapshot to persist each field's Zod type, including optionality/nullability and nested response objects where practical.
- Diff type changes as breaking changes and update the script documentation.
- Resolve the current `contract:check` baseline delta for `seats.SEAT_SENSITIVE_FIELDS` (`pendingQrCode`, `pendingQrCodeVersion`, and `pendingQrPreparedAt`) by reviewing the seats change and intentionally running `contract:update` if accepted.

## database / money schema

### Retire legacy REAL money columns with D1 drop-column cutover

**Priority:** P3 (was P2 — the migration itself is written; only deployment verification is unconfirmed) **Status (updated 2026-07-05):** The destructive cutover migration this item describes as future work has **already been written and paired**, not just guarded: `packages/database/migrations_fresh/0070_money_cents_cutover.sql` and `0071_market_checkout_child_order_cents_cutover.sql` (paired with the legacy/Wrangler track's `0087`/`0088` in `packages/database/migration-dual-track.json`, `reviewedThrough` already covers both). Both migrations self-guard with a `CHECK (violation_count = 0)` table before dropping any column, use `PRAGMA defer_foreign_keys = ON`, and capture before/after row counts — matching every item in the scope below almost verbatim. Current Drizzle schema (`packages/database/src/schema/orders.ts` etc.) has **zero remaining legacy `REAL` money columns** — only `*_cents` columns exist.

**Not verifiable from the repo:** whether these migrations have actually been run against production D1 (vs. only written and merged). That's an operational fact, not a code fact — check deployment logs or run `pnpm wrangler d1 execute` against the target DB to confirm.

**Doc drift to fix separately:** `docs/migration/MONEY_CENTS_FIELD_RETIREMENT.md` ("Last reviewed: 2026-06-12") still describes the cutover as "intentionally incomplete" future work, even though it names these exact migration files as the plan — the doc's "Current State" section needs updating to reflect that the plan was executed.

**Original scope (all items below now exist in the migration files — kept for reference):**

- Confirm production `money_cents_retirement` and `money_cents_retirement_rollout` audit rows have `violation_count = 0` — enforced automatically via the self-guarding assertion table in the migration itself
- Rehearse the destructive migration on a restored D1 drill database with backup/restore evidence captured — ⚠️ unverified, see above
- Use the dedicated D1/SQLite drop-column cutover migration that omits only the legacy `REAL` money columns listed in `docs/migration/MONEY_CENTS_FIELD_RETIREMENT.md` — ✅ `0070_money_cents_cutover.sql` / `0071_market_checkout_child_order_cents_cutover.sql`
- Preserve primary keys, FKs, unique constraints, defaults, generated columns, indexes, non-legacy triggers, timestamp columns, and soft-delete columns
- Start the cutover with `PRAGMA defer_foreign_keys = ON`, run `PRAGMA foreign_key_check`, and include row-count assertions — ✅ present in the migration files
- Remove obsolete cents sync triggers and legacy fallback reads only after the cutover migration is verified

## database / transaction integrity

### Migrate remaining safeTransaction callers to D1 batch

**Priority:** P4 (was P1 — caller migration is done, only cleanup remains) **Status (verified 2026-07-05):** Caller migration is COMPLETE. Repo-wide search (`grep -rln "safeTransaction" --include="*.ts" .`) finds `safeTransaction` used ONLY in its own definition (`packages/database/src/services/base.ts:154`) and its dedicated test (`base.test.ts`) — zero remaining callers anywhere in `apps/` or `packages/`. `FeedbackService.ts`, `LeaveService.ts`, and `SchedulingService.ts` (the three listed below) are all fully on `db.batch()` now (verified via git log: `5c2be3be`, `1f16fe22`, `b2f40b7b` and others).

**Remaining scope (the only thing left):**

- Delete `safeTransaction` from `BaseService` (`packages/database/src/services/base.ts`) so interactive transaction usage cannot be reintroduced — nothing calls it anymore, this is now dead code, not a migration
- Remove/update `base.test.ts`'s coverage of `safeTransaction` accordingly

## billing / metering cost

### Stop writing one D1 row per API request for the `api.requests` meter

**Priority:** P2 **Status:** Open (identified 2026-08-21) **Files:** `apps/api/src/middleware/usageTracker.ts`, `apps/api/src/shared/utils/meter.ts`, `apps/api/src/workers/usage-aggregator.ts`

**Context:** `usageTracker` is mounted on `apiV1.use("*")` and emits `api.requests` through `meterEmit`, which does one `INSERT INTO usage_events` per request. `usage_events` carries two indexes that a fresh insert touches (`usage_events_restaurant_meter_time_idx`, and `usage_events_pending_idx`, which is partial on `aggregated_at_ms IS NULL` — exactly the state a new row is in), so each request costs roughly 3 D1 rows written, and the hourly aggregator's `UPDATE` of `aggregated_at_ms` adds more. D1 bills rows written at $1.00/M over 50M/month included. At the `pro` tier's own hard cap of 1,000,000 `api.requests` per cycle, 50 pro tenants is ~150M rows written/month.

**Do not move this meter to Analytics Engine.** It is not telemetry: `plan-quotas.ts` gives it soft/hard limits per plan tier, and `BillingCycleService.ts:66-75` computes billable overage as `total_quantity - hardLimit`. Analytics Engine samples at volume, so it cannot be the store of record for an invoiced quantity. (This corrects the first-pass recommendation from the 2026-08-21 cost review.)

**Scope — pick one, both are real design changes:**

- **In-isolate coalescing.** Buffer counts per `(restaurantId, meterKey)` in module scope and flush an aggregated row via `waitUntil` on a size or age threshold. Cuts rows written by roughly the batch factor. Cost: an isolate evicted with a non-empty buffer loses those counts. Undercounting only ever bills the customer less, which is the safe direction for an overage charge, but it makes the number non-reproducible — decide whether that is acceptable before building it.
- **Per-restaurant counter Durable Object.** Exact, because the object is a single serialization point: increment in memory for free, persist on an alarm (~1/min). Turns 1M writes into ~1,440. Cost: one DO request per API request ($0.15/M over 1M/month free) plus DO compute, and a second DO class to declare — which must use `new_sqlite_classes` (see `apps/realtime/wrangler.toml` for why).

**Also worth deciding separately:** `USAGE_EVENTS_TTL_DAYS` is 90. Rows are aggregated into `usage_meters` within the hour and then exist only as dispute evidence. Dropping to ~35 days (one cycle plus a buffer) cuts the table's D1 storage by roughly 60% and is a business call, not a technical one.

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

**Priority:** P4 **Status:** Completed 2026-05-25 **File:** `apps/kitchen-display/src/components/orders/OrderCard.vue` **Context:** `displayTableName` stripped `^(Table|桌)[\s-]*` to prevent prefix duplication. Edge cases were not currently in production data:

- Vietnamese `Bàn 4` → would not be stripped (expected Vietnamese locale also translates `orders.table` → `Bàn`)
- Malay `Meja 4` → same
- Edge: table name starting with `桌子` (Chinese "table" noun) would lose `桌` — requires word boundary

**Fix:** Require a trailing separator in the regex: `^(Table|桌)[\s-]+`, with regression coverage for `Table 4`, `Table-4`, `桌 4`, `桌-4`, `桌子 4`, and `Tabletop 4`. Extend prefix list when Vietnamese/Malay translations land.

### Harden deepMerge against prototype pollution

**Priority:** P4 **Status:** Completed 2026-05-25 **File:** `apps/kitchen-display/src/i18n/index.ts` (+ onboarding-app, management-portal) **Context:** `setLocaleMessages` uses `deepMerge` which uses `instanceof Object` and `key in target`. Today only static imports flow through this path so it's safe. If future work loads locales from a remote source (A/B tests, CMS-driven translations), a malicious JSON payload with `__proto__` / `constructor.prototype` keys could pollute `Object.prototype`.

**Fix:** Replace `instanceof Object` with `Object.prototype.toString.call(v) === '[object Object]'`. Use `Object.prototype.hasOwnProperty.call(target, key)`. Explicitly skip `__proto__`, `constructor`, `prototype`. Or just drop `deepMerge` entirely since locale files are static — a straight assignment works.

### Standardize toLocaleTimeString/DateString to use active locale

**Priority:** P4 **Status:** Completed 2026-05-25 **Context:** 10 kitchen-display files still pass hardcoded `"zh-TW"` to `toLocaleTimeString`/`toLocaleDateString`. Most use 24-hour format which renders identically across locales, so the bug is invisible today. Should be cleaned up so future changes (e.g. adding seconds or switching to 12-hour) stay locale-aware.

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

**Status (2026-07-05):** Prerequisite satisfied — customer-identity Phase 1 above is verified complete, so this phase is now unblocked. Phase 4 itself has not been built: no `BroadcastService` for markets/restaurants and no "Following" UI were found in `apps/api` or `apps/customer-app` as of this check.

**Scope:**

- "Follow" UI on `MarketDetailHero` / `RestaurantCard` → writes `customer_favorites(targetType='market' | 'restaurant')`
- New `BroadcastService` in `apps/api`: fans out push via `customer_push_subscriptions` filtered by `customer_consents`
- New admin endpoints: `POST /api/v1/markets/:id/broadcasts`, `POST /api/v1/restaurants/:id/broadcasts` (rate-limited, per-restaurant audit)
- customer-app: "Following" tab in profile view; opt-in / opt-out granular controls (overall marketing, favorites-only, quiet hours)

### Phase 5 — Operator role + portal

**Priority:** P4 **Spec:** `docs/superpowers/specs/2026-05-25-night-market-discovery-design.md` §10 Phase 2 **Context:** Promote `market_operator` to a first-class role (separate from existing 0–4 restaurant roles) with self-service market editing, vendor approval queue, and per-market analytics.

**Why deferred:** Phase 1 markets are platform-admin-owned, which is sufficient for MVP. Operator self-service is a scaling tool, not a launch requirement.

**Scope:**

- New role: `market_operator` in `USER_ROLES`
- New table or column linking operators to markets (operator can manage 1+ markets)
- Self-service market metadata editing (subset of admin endpoints)
- Vendor membership approval queue (vendor requests → operator approves/rejects)
- Per-market analytics dashboard in management-portal

## testing / fixture harnesses

### Unify GroupOrdersService's file-local select harness with `createSelectFixtureDb`

**Priority:** P4 **Status:** Open (identified 2026-08-20, deferred from #213) **Files:** `apps/api/src/features/group-orders/services/GroupOrdersService.test.ts`, `packages/database/src/testing/select-fixtures.ts`

**Context:** #213 moved this file's write fixtures onto the shared `createMutationFixtureDb`. Its reads still use a file-local harness that already routes by table and throws on missing/exhausted fixtures — the same rules the shared one enforces — so this is de-duplication, not a bug.

**Why deferred:** The local harness has a `rawSqlSubquery` catch-all bucket for `.from()` arguments that are raw SQL subqueries rather than registered tables. `createSelectFixtureDb` has no catch-all: an unregistered `from()` argument throws there. Migrating means adding a routing escape hatch to a module 24 other test files depend on, for one caller.

**Scope:** Either give `createSelectFixtureDb` a declared fallback bucket, or rework the two subquery-backed reads in `GroupOrdersService` so every `from()` target is a real table.

### Narrow `CouponsService.createCouponWithValidation`'s return type

**Priority:** P4 **Status:** Open (identified 2026-08-20, deferred from #207) **Files:** `apps/api/src/features/coupons/services/CouponsService.ts`, `apps/api/src/__tests__/integration/coupons.real.integration.test.ts`

**Context:** `createCouponWithValidation` is declared `Promise<unknown>`, and `PaginatedCouponsResponse.coupons` inherits that looseness. Because of it the coupons integration suite has to state the coupon shape locally (`CouponResponse`) rather than derive it from the service the way the other suites do.

**Why deferred:** #207's scope was `no-explicit-any` in test code. Narrowing the return type is a production-signature change with its own callers to check, and the issue explicitly says such findings should be filed rather than forced through a cast in the test.

**Scope:** Give the method a concrete return type (the formatted coupon row), let `PaginatedCouponsResponse` follow, then replace the test's local `CouponResponse` with `ServiceData<CouponsService["createCouponWithValidation"]>`.

## Completed

_None yet._
