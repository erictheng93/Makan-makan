# TODOS

Organized by skill/component, then priority (P0 top → P4 bottom, then Completed).

## i18n

### Consolidate 3 duplicate i18n runtimes into @makanmakan/i18n shared package

**Priority:** P2 **Status:** Completed 2026-05-25 **Noticed on branch:** `feat/i18n-coverage-all-apps` **Context:** v2.1.0 adds i18n to kitchen-display, onboarding-app, and management-portal. Each app had its own ~200-line copy of `src/i18n/index.ts` (identical except for a doc-comment line). The shared package `@makanmakan/i18n` at `packages/shared/src/i18n/` already exists and is used by customer-app. The completed work migrated all 4 apps (admin-dashboard, kitchen-display, onboarding-app, management-portal) to the shared package, resolving the API difference (custom composable vs vue-i18n).

**Resolution:** Added a shared `createI18n()` runtime factory, migrated duplicate app runtimes to wrappers around `@makanmakan/i18n`, standardized locale storage on `makanmakan_locale` with legacy `locale` migration, hardened message merging, and derived app `Messages` types from each app's `zh-TW.ts`.

**Scope:**

- Extract runtime (ref state, `t()`, `deepMerge`, `setLocale`, `loadLocaleMessages`, `initI18n`, `useI18n`) into `packages/shared/src/i18n` as a `createI18n(appMessages)` factory
- Each app owns only its `Messages` type and locale files
- Standardize on `makanmakan_locale` localStorage key (currently `locale` in 3 apps, `makanmakan_locale` in shared package)
- Standardize type safety: derive `Messages` type from zh-TW.ts instead of open recursive map

### Fill stub locale translations (zh-CN, vi-VN, ms-MY, id-ID)

**Priority:** P3 **Status:** Blocked — handoff/import workflow prepared 2026-05-26 **Context:** 4 out of 6 locales per app are empty-object stubs that fall back to zh-TW. Users who select these locales currently see zh-TW text. Needs translator-approved target copy.

**Blocker:** Translator-approved copy is not available for kitchen-display, onboarding-app, and management-portal. The customer waiting-list keys added in this pass are filled in all 6 locales, but replacing full app locale stubs with machine-generated copy would create product-quality risk.

**Scope:**

- Extract all unique keys from kitchen-display/zh-TW.ts, onboarding-app/zh-TW.ts, management-portal/zh-TW.ts — done in `scripts/i18n-locale-coverage.ts`
- Deliver to translator in a format they can fill in — done in `docs/i18n/locale-translator-handoff.csv`; export preserves already-filled target cells on rerun
- Validate approved handoff before import — automated via `pnpm run i18n:check-handoff -- docs/i18n/locale-translator-handoff.csv`
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

**Priority:** P2 **Spec:** `docs/superpowers/specs/2026-05-25-customer-identity-and-profile-design.md` **Context:** `orders.customerId`, `waiting_list.customerId`, `reservations.customerId` are all `INTEGER` FK to `users.id` (the staff table), while a `customers` table (TEXT/UUID) exists but is functionally orphaned (only `verified_members` references it). `users.ts` even comments "顧客應使用 customers 表" — the refactor was started but never finished. Until this is resolved, every customer-facing feature has to pick a side and the inconsistency multiplies.

**Status:** Phase 1 implementation landed. Open Questions Q-1 through Q-8 were closed on 2026-05-25 in the spec: phone numbers are current bindings, Phase 1 uses SMS-only OTP, anonymous order claiming is deferred, legacy `users.role = 5` rows are preserved, consent versions are managed in a shared catalog, stale failed push subscriptions are pruned daily, and PDPA records of processing are a legal/application-logging follow-up that does not block Customer Identity or Marketplace Phase 4.

**Scope (Phase 1, ~30 dev-days estimated in spec §15):**

- Create 5 new tables: `customer_preferences`, `customer_favorites` (polymorphic), `customer_push_subscriptions`, `customer_consents` (append-only), `customer_phone_verification_tokens`
- Rebuild `customers` table: rename `full_name → display_name`, `phone → primary_phone`, `email → primary_email`; add `avatarUrl`, `locale`, `status`, `lastSeenAt_ms`; switch ID generator from `crypto.randomUUID().replace(/-/g, "")` to `uuidv7()`
- Table-rebuild FK migration on `orders` / `waiting_list` / `reservations` (`customer_id INTEGER → TEXT`, FK → `customers.id`); requires temp `customer_id_mapping` from `users WHERE role IS NULL OR role = 5`
- Customer auth service: phone-OTP flow + JWT (15 min access / 30 day refresh) with `type: "customer"` discriminator
- New `customerAuthMiddleware` in `apps/api/src/middleware/auth.ts`
- New feature folder `apps/api/src/features/customer/` with 17 endpoints (auth, me, preferences, favorites, push, consents)
- Backfill `customer_preferences` from `users.preferences` JSON for migrated rows; deprecate `USER_ROLES.CUSTOMER = 5`
- customer-app: login screen, favorites UI, push enrollment flow, settings/consent UI

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

## Completed

_None yet._
