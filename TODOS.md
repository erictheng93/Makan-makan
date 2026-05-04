# TODOS

Organized by skill/component, then priority (P0 top → P4 bottom, then Completed).

## i18n

### Consolidate 3 duplicate i18n runtimes into @makanmakan/i18n shared package

**Priority:** P2 **Noticed on branch:** `feat/i18n-coverage-all-apps` **Context:** v2.1.0 adds i18n to kitchen-display, onboarding-app, and management-portal. Each app has its own ~200-line copy of `src/i18n/index.ts` (identical except for a doc-comment line). The shared package `@makanmakan/i18n` at `packages/shared/src/i18n/` already exists and is used by customer-app. The deferred work is to migrate all 4 apps (admin-dashboard, kitchen-display, onboarding-app, management-portal) to the shared package, resolving the API difference (custom composable vs vue-i18n).

**Why deferred:** Browser-verified and test-verified functional behavior in v2.1.0 matches admin-dashboard's existing duplicate-per-app pattern. Consolidation is a follow-up architectural refactor, not a blocker.

**Scope:**

- Extract runtime (ref state, `t()`, `deepMerge`, `setLocale`, `loadLocaleMessages`, `initI18n`, `useI18n`) into `packages/shared/src/i18n` as a `createI18n(appMessages)` factory
- Each app owns only its `Messages` type and locale files
- Standardize on `makanmakan_locale` localStorage key (currently `locale` in 3 apps, `makanmakan_locale` in shared package)
- Standardize type safety: derive `Messages` type from zh-TW.ts instead of open recursive map

### Fill stub locale translations (zh-CN, vi-VN, ms-MY, id-ID)

**Priority:** P3 **Context:** 4 out of 6 locales per app are empty-object stubs that fall back to zh-TW. Users who select these locales currently see zh-TW text. Needs translator handoff.

**Scope:**

- Extract all unique keys from kitchen-display/zh-TW.ts, onboarding-app/zh-TW.ts, management-portal/zh-TW.ts
- Deliver to translator in a format they can fill in
- Import translations back into the respective locale files
- Add CI check that warns when a non-zh-TW locale has fewer leaf keys than zh-TW

### i18n performance: convert HistoryView status/type helpers to computed maps

**Priority:** P3 **File:** `apps/kitchen-display/src/views/HistoryView.vue` **Context:** `statusLabel()` and `typeLabel()` are plain functions called per row in a v-for. Each call rebuilds a Record of 8+ `t()` calls, so rendering N orders triggers ~10N `t()` invocations per render. Not a visible regression yet (history page is not a hot path) but worth cleaning up.

**Fix:** Convert to computed maps keyed on locale so Vue only rebuilds the map when the locale changes.

### i18n edge cases in displayTableName regex

**Priority:** P4 **File:** `apps/kitchen-display/src/components/orders/OrderCard.vue` **Context:** `displayTableName` strips `^(Table|桌)[\s-]*` to prevent prefix duplication. Edge cases not currently in production data:

- Vietnamese `Bàn 4` → would not be stripped (expected Vietnamese locale also translates `orders.table` → `Bàn`)
- Malay `Meja 4` → same
- Edge: table name starting with `桌子` (Chinese "table" noun) would lose `桌` — requires word boundary

**Fix:** Require a trailing separator in the regex: `^(Table|桌)[\s-]+`. Extend prefix list when Vietnamese/Malay translations land.

### Harden deepMerge against prototype pollution

**Priority:** P4 **File:** `apps/kitchen-display/src/i18n/index.ts` (+ onboarding-app, management-portal) **Context:** `setLocaleMessages` uses `deepMerge` which uses `instanceof Object` and `key in target`. Today only static imports flow through this path so it's safe. If future work loads locales from a remote source (A/B tests, CMS-driven translations), a malicious JSON payload with `__proto__` / `constructor.prototype` keys could pollute `Object.prototype`.

**Fix:** Replace `instanceof Object` with `Object.prototype.toString.call(v) === '[object Object]'`. Use `Object.prototype.hasOwnProperty.call(target, key)`. Explicitly skip `__proto__`, `constructor`, `prototype`. Or just drop `deepMerge` entirely since locale files are static — a straight assignment works.

### Standardize toLocaleTimeString/DateString to use active locale

**Priority:** P4 **Context:** 10 kitchen-display files still pass hardcoded `"zh-TW"` to `toLocaleTimeString`/`toLocaleDateString`. Most use 24-hour format which renders identically across locales, so the bug is invisible today. Should be cleaned up so future changes (e.g. adding seconds or switching to 12-hour) stay locale-aware.

**Files:** OrderCard.vue, OrderDetailsModal.vue, ConnectionStatus.vue, HistoryView.vue, SystemHealthDashboard.vue, ErrorReportsDashboard.vue, EnhancedShortcutsPanel.vue, InteractiveAudioPanel.vue, InteractiveStatsPanel.vue, kitchenStatisticsService.ts

## waiting-list (customer-side queue)

### Wire push notification end-to-end on call/about-to-expire

**Priority:** P2 **Spec:** `docs/specs/queue-and-waiting-list.md` **Context:** Phase 1 (commits `0ad8522f`, `309c3db6`, 2026-05-04) shipped the customer join/ticket/cancel/confirm UI. VAPID + Service Worker subscription already exist in `apps/customer-app/src/utils/push-notifications.ts`. The server-side trigger is not connected — `WaitingListService.callWaiting()` currently only broadcasts via SSE/WS to admin-dashboard, so customers don't get a phone notification when their turn nears.

**Why deferred:** Phase 1 was scoped tightly to keep the PR reviewable. Push wiring crosses customer-app + apps/api + service worker and warranted its own phase.

**Scope:**

- Customer-app: call `customerPushService.requestPermission()` + `subscribe()` on join success in `JoinWaitingListView.vue`; persist returned subscription against the ticket
- API: confirm or add an endpoint that accepts `{ subscription, ticketId }` (audit `apiClient.post("/push/subscribe", ...)` — route may already exist for orders)
- WaitingListService: dispatch web-push when ticket flips to `called`; consider also firing on `waiting_about_to_expire` (5-min timeout window — `NotificationType` enum already has the slot)
- Service Worker: handle `waiting_called` action click → deep-link back to `/r/:restaurantId/wait-list/:ticketId`

### Customer waiting-list history page

**Priority:** P3 **Context:** Phase 1 has no history view in customer-app. Useful for users to see prior visits without re-entering phone every time.

**Scope:** New API (`GET /waiting-list/history?phone=` or `?customerId=`) + view at `/wait-list/history`. Phone-based lookup must be rate-limited to avoid enumeration.

### Pre-order from menu while in waiting-list

**Priority:** P3 **Context:** Customer is queued and could be browsing menu. Cross-system integration with existing menu/order flows so the order is bound to the ticket and fires to kitchen on `seated`.

### Phase 1 small debt

**Priority:** P4 **File:** `apps/customer-app/src/views/waiting-list/JoinWaitingListView.vue`, `apps/customer-app/src/locales/`

- `JoinWaitingListView.vue:292-298`: `watch(partySize)` calls `estimateWait().then()` with no `.catch` — silent stale value on failure
- `JoinWaitingListView.vue:300-303`: `restoreLastTicket()` and `loadQueueSnapshot()` race in parallel; if restore triggers `router.replace`, snapshot still completes (wasted request, no crash)
- i18n keys live in a parallel `src/locales/` dir alongside `src/i18n/` — should consolidate into the existing customer-messages source

## Completed

_None yet._
