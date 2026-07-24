# `apps/kitchen-display` — Backend Contract Reference (for Rust Backend Rewrite)

Source reviewed: `apps/kitchen-display/src/services/*.ts`, `src/stores/*.ts`, `src/composables/*.ts`, `src/router/{index,guards}.ts`, `src/main.ts`, `src/views/*.vue` (for direct API calls not covered by a service file), `.env.development`/`.env.development.example`, `vite.config.ts`, `package.json`, plus the shared `packages/auth-client/src/**` (the axios wrapper every kitchen API call goes through) and `packages/shared-types/src/realtime-events.ts` (wire-format source of truth for the realtime event union). Excludes `*.test.ts`/`*.spec.ts`/`__tests__/`.

This document describes what the **Vue 3 client actually sends and actually reads** — the contract a Rust rewrite of `apps/api` / `apps/realtime` must preserve byte-for-byte to avoid silently breaking this app. It does not document UI components, styling, or Vue internals.

**Headline finding**: this app ships *three* separate realtime client implementations (an SSE service, a "legacy" WebSocket composable, and a "current" WebSocket service), but only **one** — the WebSocket-based `services/realtimeService.ts` — is ever imported by a router-reachable view. The SSE client (`services/sseService.ts` + `composables/useKitchenSSE.ts`) and `composables/useRealtimeKitchen.ts` are dead code (verified: zero non-self-referential imports anywhere in `src/`, including tests). This matters for the rewrite because the SSE endpoint they'd hit (`/api/v1/kitchen/:restaurantId/events`) is documented server-side as carrying **no order data at all** (`connected` + `heartbeat` only) — so even if this dead code were revived as-is, it would not do what its own event-type switch statement implies.

---

## 1. Purpose & connection topology

Kitchen-display talks to **two** backends:

| Backend | Base URL (dev) | Client construct | Purpose |
|---|---|---|---|
| `apps/api` (main REST API) | `/api/v1` (proxied) | `apiClient`/`api` (from `src/services/authApi.ts`, built via `@makanmakan/auth-client`) | Auth, kitchen order board reads, item-status writes, SSE token minting (unused path), error reporting, realtime WS auth-token minting |
| `apps/realtime` (Durable Objects WS) | absolute `wsUrl` returned by the server (no client-side base URL) | `services/realtimeService.ts` (`KitchenRealtimeService`) | Live `NEW_ORDER`/`ORDER_STATUS_UPDATE`/`ORDER_ITEM_STATUS_UPDATE`/`ORDER_CANCELLED` push to the kitchen board |

### Vite dev proxy (`apps/kitchen-display/vite.config.ts:26-33`)

```
/api → VITE_API_BASE_URL (minus /api/v1) or http://localhost:8787   (changeOrigin: true, no path rewrite)
```

Only `/api` is proxied. There is **no proxy entry for the realtime WebSocket** — `KitchenRealtimeService.connect()` opens `new WebSocket(auth.wsUrl)` directly against whatever absolute URL the `/realtime/auth/token` response contains, bypassing Vite entirely (dev or prod).

### `.env.development` (committed, no secrets) — `apps/kitchen-display/.env.development`

```
VITE_API_BASE_URL=/api/v1
VITE_WS_BASE_URL=ws://localhost:8787
VITE_APP_ENV=development
```

`VITE_WS_BASE_URL` is **not read anywhere in the wired-up code path** — grep confirms no `import.meta.env.VITE_WS_BASE_URL` reference in any active source file. (The dead `composables/useRealtimeKitchen.ts` reads a *different*, unset variable, `VITE_REALTIME_WS_URL` — see §4.) `getKitchenApiBaseUrl()` (`services/authApi.ts:4-14`) throws at build time in production if `VITE_API_BASE_URL` is unset; there is no equivalent guard for realtime because the live path derives its WS URL entirely from the server response, not from a client env var.

### Auth token storage

`createAuthenticatedApiClient({ storageKeyPrefix: "kitchen", csrf: true, ... })` (`services/authApi.ts:17-24`) → localStorage keys `kitchen_auth_token`, `kitchen_user` (via `packages/auth-client/src/storage.ts`; `kitchen_refresh_token` key exists in the pattern but is never actually written — refresh token is HttpOnly-cookie-only, see §3).

---

## 2. Endpoint inventory

All paths relative to `/api/v1` unless noted. Responses are read directly off `response.data.*` — **no** shared unwrap helper (unlike `admin-dashboard`); each service function hand-rolls its own `response.data.data` / `response.data.user` access.

### 2.1 Auth (`services/authApi.ts`, `stores/auth.ts`)

| Method | Path | Called from | Request payload | Response fields actually read |
|---|---|---|---|---|
| POST | `/auth/login` | `authApi.ts:48` | `{username, password, system: "kitchen"}` | `data.user` (full `User`: `id`,`username`,`name`,`role`,`restaurantId`,`permissions[]`,`lastLogin?`), `data.token` (string), `data.refreshToken?` (received but never persisted — see §3), `data.expiresIn` (typed on `LoginResponse` but not read by any caller) |
| POST | `/auth/logout` | `authApi.ts:74` | none | none — failure is swallowed and treated as local-success (`authApi.ts:80-88`) |
| POST | `/auth/refresh` | `authApi.ts:94-100` (store-level) **and** `create-api-client.ts:69-73` (axios 401-interceptor level — two independent call sites) | none, `withCredentials: true` (refresh token is an HttpOnly cookie) | `data.token`, `data.user` |
| GET | `/auth/validate` | `authApi.ts:126` | — | `response.data.user` (**note: not `.data.data`** — different envelope depth than every other call in this file; would silently break if server ever wraps this route like the others) — **dead code: `authApi.validateToken()` has zero callers anywhere in `src/`** |
| GET | `/auth/me` | `authApi.ts:149` | — | `response.data.user` (same non-standard envelope depth) — **dead code: zero callers** |

Role gate: client-side, `userData.role !== 2` throws `"此帳號沒有廚房系統存取權限"` immediately after a successful login response (`stores/auth.ts:31-33`), before persisting anything — i.e. the server is trusted to return the true role in the login payload, and the client enforces role=2 (chef) purely as a UX gate, not a security boundary.

### 2.2 Kitchen orders (`services/kitchenApi.ts`, wrapped by `stores/orders.ts`)

| Method | Path | Called from | Request payload | Response fields actually read |
|---|---|---|---|---|
| GET | `/kitchen/:restaurantId/orders` | `kitchenApi.ts:17`, called by `stores/orders.ts:181` (`fetchOrders`) and `views/HistoryView.vue:179` (reused, client-filtered by date tab) | — (no query params ever sent — server supports `limit`, unused by this client) | `response.data.data` cast to `KitchenOrdersResponse`: `{pending: KitchenOrder[], preparing: KitchenOrder[], ready: KitchenOrder[], stats: KitchenStats}`. Client concatenates the three arrays into one flat `orders` list and separately keeps `stats` verbatim. |
| PUT | `/kitchen/:restaurantId/orders/:orderId/items/:itemId` | `kitchenApi.ts:47` (`updateItemStatus`), via `startCooking`/`markItemReady`/`batchUpdateItemStatus` | `{status: ItemStatus, notes?: string}` — `ItemStatus` = `"pending"\|"preparing"\|"ready"\|"completed"` | `response.data.data` (accepted but not destructured further — only `response.data.success`-equivalent truthiness gates optimistic local mutation) |

`batchUpdateItemStatus` (`kitchenApi.ts:73-115`) is **client-side fan-out**, not a real batch API call — it fires `N` parallel `updateItemStatus` PUT requests via `Promise.all` and aggregates failures. There is no single batch HTTP endpoint on the wire despite the name.

### 2.3 Realtime auth token (`services/realtimeService.ts`)

| Method | Path | Called from | Request payload | Response fields actually read |
|---|---|---|---|---|
| POST | `/realtime/auth/token` | `realtimeService.ts:113` (`getWebSocketToken`) | `{roomType: "kitchen", roomId: restaurantId, restaurantId, sessionId}` where `sessionId` = the current kitchen bearer token (`apiClient.tokens.getToken()`) | `response.data.data` cast to `RealtimeAuthTokenResponse`: **must** contain `.token` and `.wsUrl` (non-null-checked; throws `"Realtime auth response missing token or wsUrl"` otherwise). `.expiresIn` is on the shared type but not read by this client. |

### 2.4 SSE token — minted but never connected-to (`services/sseService.ts`)

| Method | Path | Called from | Request payload | Response fields actually read |
|---|---|---|---|---|
| POST | `/kitchen/:restaurantId/events/token` | `sseService.ts:65` (inside dead-code `KitchenSSEService.connect()`) | none, `Authorization: Bearer <token>` header, `withCredentials: true` | `response.data?.data?.sseToken` |
| GET | `/kitchen/:restaurantId/events?sseToken=...` | `sseService.ts:78-85` (same dead path) | — (EventSource, query-param token) | Would parse SSE `message`/`connected`/`heartbeat`/`order-update`/`test-event` frames — **but per server-side docs (`docs/Backend-Rust-refactor/api-features-ordering.md:233,246`), this endpoint only ever emits `connected` once and `heartbeat` every 30s; it "carries no order data."** So even if this client code were wired up, `order-update`/`test-event` listeners would never fire in production. |

Both rows in §2.4 are unreachable from any router-mounted view — flagging as **dead code**, not part of the live contract, but included because a Rust port that removes the server-side SSE endpoint entirely (since no real client uses it for data) is a legitimate simplification to consider.

### 2.5 Error reporting (`services/errorReportingService.ts`)

| Method | Path | Called from | Request payload | Response fields actually read |
|---|---|---|---|---|
| POST | `/system/errors` | `errorReportingService.ts:112,348` (single-report), `:356` (batch) | Single: full `ErrorReport` object (`id`,`timestamp`,`error:{name,message,stack?}`,`context:{component?,action?,user?,url,userAgent}`,`systemInfo:{appVersion,networkStatus,memoryUsage?,storageAvailable}`,`severity`,`resolved`,`tags[]`). Batch: `{errors: ErrorReport[]}` | none — fire-and-forget, only `try/catch` logs failure |
| POST | `/push/subscribe` | `push-notifications.ts:157` (`sendSubscriptionToServer`), reached live via `SettingsView.vue:540` → `kitchenPushService.subscribe()` | `{subscription: PushSubscription JSON, user_type: "kitchen", role: "chef", restaurant_id?, device_info}` | none read on success (fire-and-forget; failure logged) |
| GET | `/info` | `systemHealthService.ts:816` — raw `fetch`, bypasses `apiClient` (`cache:"no-store"`, `credentials:"omit"`) | — | HTTP status only (liveness probe) |

Reachable in production: `App.vue` calls `useGlobalErrorHandler().setupGlobalHandlers()` on mount (`App.vue:135`, inside `onMounted`), which routes through this service. Batches flush at 10 reports or every 30s (`errorReportingService.ts:67-68,315-320`).

### 2.6 Offline-queue replay endpoints — declared but only 2 of 4 action types are ever queued (`services/offlineService.ts`)

`stores/orders.ts` only ever calls `offlineService.queueAction()` with type `"start_cooking"` or `"mark_ready"` (4 call sites, `orders.ts:479,516,562,607`) when offline. `offlineService.getActionEndpoint()` (`offlineService.ts:360-379`) additionally declares endpoints for `"update_status"`, `"priority_change"`, `"batch_operation"` — **these three are dead branches, never triggered by any caller in the app**, and their declared paths (`/kitchen/:orderId/status`, `/kitchen/:orderId/priority`, `/kitchen/:orderId/batch` — note: **no `restaurantId` segment**, unlike every real kitchen route) do not match any documented server route. Do not port these as real endpoints; they are unreachable client-side dead code with an inconsistent path shape.

| Method | Path (as replayed) | Payload |
|---|---|---|
| PUT | `/kitchen/:restaurantId/orders/:orderId/items/:itemId` | `{status}` (matches the real §2.2 route — this is the only offline-queue path that is both reachable and correctly shaped) |

---

## 3. Auth & session

- **Login**: `POST /auth/login` with `system: "kitchen"` marker field in the body (server-side significance not verified from this client alone). Client enforces `role === 2` (chef) post-login; any other role throws and the login is treated as failed even though the HTTP call succeeded.
- **Storage**: bearer token in `localStorage["kitchen_auth_token"]`, user object (JSON) in `localStorage["kitchen_user"]`. No refresh token is ever persisted to storage — `create-token-manager.ts`'s `setTokens`/`setUser` flow always calls `storage.removeRefreshToken()` right after setting the access token (`create-token-manager.ts:68-71`), and `packages/auth-client/src/storage.ts`'s `getRefreshToken()` is hardcoded to return `null`. **Refresh is entirely cookie-driven**: `POST /auth/refresh` is called with `withCredentials: true` and no body: the browser sends whatever HttpOnly refresh cookie the server previously set.
- **Headers**: `Authorization: Bearer <token>` attached by the shared axios request interceptor (`create-api-client.ts:93-99`) on every request when a token is present. CSRF: `csrf: true` configured → `X-CSRF-Token` header sent on `POST/PUT/DELETE/PATCH`, sourced from cookie `__Host-mm_csrf` or a cached value from a prior response header (`create-api-client.ts:15-24,101-110,126-131`).
- **401 handling**: axios response interceptor retries exactly once per request — on `401`, calls `tokenManager.refreshToken()` (deduplicated: concurrent 401s share one in-flight refresh promise), re-attaches the new bearer token, and replays the original request. If refresh fails, `storage.clearAll()` runs and `onAuthFailure` fires, which in this app is `() => window.location.href = "/login"` (`services/authApi.ts:21-23`) — a hard navigation, not a Vue Router push.
- **Proactive refresh**: `apiClient.tokens.scheduleProactiveRefresh(token)` is called after login and on `checkAuth()` rehydration (`stores/auth.ts:41,84,116`); the actual delay computation (`getRefreshDelay`, presumably 80% of token lifetime per the package's own doc comment in `create-token-manager.ts:8`) lives in `@makanmakan/utils`, not reviewed here.
- **Rehydration on load**: `main.ts:72-76` calls `authStore.initialize()` (→ `checkAuth()`) **before** mounting the app and gates both i18n init and mount on it (`main.ts:86-93`) — without this, a hard refresh on any protected view would bounce to `/login` because Pinia state doesn't survive a reload on its own.
- **Route guards** (`router/guards.ts`): `requiresAuth` → redirect to `/login?redirect=<path>` if not authenticated; `requiredRole` (only `Kitchen` route sets `requiredRole: 2`) → `/unauthorized` on mismatch; `restaurantId` route param must string-match `authStore.restaurantId` → `/unauthorized` otherwise. Guards await the in-flight `authReady` promise before evaluating, so first navigation is correctly gated on rehydration completing.
- **SSE query-param token** (dead code, §2.4): a **separate**, narrower JWT (`sseToken`, minted by `POST /kitchen/:restaurantId/events/token`) is used in the EventSource URL's query string — never the main bearer token — because `EventSource` cannot set an `Authorization` header. This path is unreachable in the live app but the pattern (short-lived scoped token in query string, not the session token) is worth preserving in the server if the SSE route is kept for any other purpose.

---

## 4. Realtime usage

**Live path: WebSocket via `services/realtimeService.ts` (`KitchenRealtimeService`), consumed only by `views/EnhancedKitchenDashboard.vue`.**

1. On mount (`EnhancedKitchenDashboard.vue:446-457`), the view subscribes to four event types — `NEW_ORDER`, `ORDER_STATUS_UPDATE`, `ORDER_ITEM_STATUS_UPDATE`, `ORDER_CANCELLED` (all from the shared `RealtimeEventType` enum, string values `new_order`/`order_status_update`/`order_item_status_update`/`order_cancelled`) — then calls `kitchenRealtime.connect(restaurantId)`.
2. `connect()` (`realtimeService.ts:39-76`):
   - POSTs `/realtime/auth/token` with `{roomType:"kitchen", roomId: restaurantId, restaurantId, sessionId: <bearer token>}` (§2.3).
   - Opens `new WebSocket(auth.wsUrl)` — the **entire URL, including any token query param, comes from the server response**; the client never constructs a WS URL itself.
   - `onopen` → status `connected`, resets reconnect counter.
   - `onmessage` → `JSON.parse(message.data)` as a `RealtimeEvent`; parse failures are caught and logged, not thrown.
   - `onclose` → status `disconnected`; **auto-reconnects unless close code is `1000` (normal) or `1001` (going away)** — i.e. any abnormal closure (including server-side auth rejection closes, if those use another code) triggers reconnect.
   - `onerror` → status `error` (no reconnect scheduled directly from here; `onclose` fires afterward and drives reconnection).
3. **Reconnect backoff**: linear, not exponential — `3000ms * attemptNumber`, capped at `30000ms`, giving up (`status = "error"`, no further retries) after 5 attempts (`realtimeService.ts:143-155`). Contrast with the dead SSE client (§below), which uses exponential backoff (`3000 * 2^n`, same 30s cap, same 5-attempt limit).
4. **Message routing**: `handleMessage` (`realtimeService.ts:127-141`) filters out `HEARTBEAT`/`CONNECTION_ACK`/`ERROR` event types silently (never forwarded to subscribers), then dispatches to any subscription whose `eventTypes` array includes the incoming `event.type`.
5. **Event → store mapping**: the view's `toKitchenSSEEvent()` adapter (`EnhancedKitchenDashboard.vue:415-421`) repackages the shared `RealtimeEvent` shape into the kitchen app's legacy `KitchenSSEEvent` shape (`{type, eventId, timestamp, restaurantId, data}`) before handing it to `ordersStore.handleSSEEvent()` — **field name note: the adapter reads `event.data` and writes it straight through as `KitchenSSEEvent.data`; the store's own event handlers additionally check a `payload` field first (`isRecord(event.payload) ? event.payload : isRecord(event.data) ? event.data : null` — guarded, falling back to `null` not `{}`; `stores/orders.ts:130-135` and `useAudioNotifications.ts:128`) that the WS path never populates — so in the live path, `payload` is always undefined and `data` is the only field that ever carries content.**
6. **Store-side event handling** (`stores/orders.ts`):
   - `NEW_ORDER` / `new_order`: builds a `KitchenOrder` from `event.data` if it isn't already order-shaped (`buildKitchenOrderFromRealtimeData`, `orders.ts:47-103`) — reads `data.orderId` (coerced via `Number()`), `data.orderNumber`, `data.tableId`, `data.tableName`, `data.orderSource`, `data.items[]` (`orderItemId ?? id ?? menuItemId`, `menuItemName ?? name`, `quantity`, `notes`, `price`), `data.customer.name`, `data.notes`, `data.totalAmount`. Missing/unparseable `orderId` (`NaN` or `<= 0`) silently drops the event (`buildKitchenOrderFromRealtimeData` returns `null`, logged as `"Invalid order data"`). New orders are unshifted to the front of the local list; existing IDs are replaced in place.
   - `ORDER_STATUS_UPDATE` / `ORDER_ITEM_STATUS_UPDATE`: reads `event.orderId ?? Number(payload.orderId)`, then from the payload: `status`, `updatedAt`, `notes`, `itemId ?? orderItemId`. If an `itemId` is present and matches an existing item, updates that item's `status` and sets `startedAt`/`completedAt` (as the **raw `updatedAt` value coerced with `String()`**, not re-formatted) the first time the item enters `preparing`/`ready`. Recomputes the parent order's aggregate status client-side (`updateOrderStatusFromOrder`: all items `ready`/`completed` → order `ready`; any `preparing` → order `preparing`; else → order `confirmed`).
   - `ORDER_CANCELLED`: reads `event.orderId ?? Number(payload.orderId)`, splices the matching order out of the local list entirely (no soft-cancel state).
   - `PRIORITY_UPDATE`: reads `event.orderId` and `event.payload.priority` directly (note: **this branch reads `event.payload`, not `event.data`** — inconsistent with the other branches' `eventData()` helper, and since the live WS path never populates `payload`, this branch is effectively dead in production even though it's still in the `switch`).
   - After every branch, `updateStats()` recomputes `pendingCount`/`preparingCount`/`readyCount`/`urgentOrders` client-side from the current in-memory `orders` array — **the server-pushed event never carries updated aggregate stats; those are always locally derived.**
7. **Audio side-effect**: `EnhancedKitchenDashboard.vue:177-180` also forwards every realtime event to `audioNotifications.handleSSEEvent()`, which reads `event.payload ?? event.data ?? {}.priority`/`.status` to choose a sound (new-order chime, urgent-alert, order-ready, etc.) — same `payload`-first read pattern, same practical consequence that only `.data`-derived fields ever actually drive behavior over the live WS transport.
8. **No client→server messages are ever sent over this socket** beyond the initial HTTP auth-token POST — `KitchenRealtimeService` has no `send()` method; it is receive-only from the client's perspective.
9. **Manual reconnect UI**: `ConnectionStatus.vue`'s `@reconnect` handler (`reconnectRealtime`, `EnhancedKitchenDashboard.vue:368-371`) calls `disconnect()` then `connect()` — a full auth-token re-fetch + new socket, not a raw reconnect.
10. **Cleanup**: `onUnmounted` unsubscribes and disconnects (close code defaults to `1000`, so no auto-reconnect fires from that closure).

**Dead code, for completeness (not part of the live contract):**

- `composables/useKitchenSSE.ts` + `services/sseService.ts`: EventSource-based client targeting `GET /kitchen/:restaurantId/events?sseToken=...` (§2.4). Exponential backoff (`3000 * 2^attempt`, 30s cap, 5 attempts), 90-second heartbeat-timeout watchdog (checks every 30s whether `>90000ms` has elapsed since last heartbeat, forces reconnect if so). Listens for named SSE event types `connected`/`heartbeat`/`order-update`/`test-event` plus a generic unnamed `message` handler that special-cases `type === "HEARTBEAT"` as a no-op. None of this is imported anywhere.
- `composables/useRealtimeKitchen.ts`: a second, independent WebSocket implementation, reading `import.meta.env.VITE_REALTIME_WS_URL` (a variable **not defined** in this app's `.env.development` — would be `undefined` at runtime, logged as a config error and connection aborted) and connecting to `${realtimeWsUrl}/kitchen/${restaurantId}` directly (bypassing the `/realtime/auth/token` mint entirely — no auth token in the URL at all). It *does* have a `send()` path (`updateOrderStatus` sends `{type:"status_update", orderId, status}` over the socket) that the live implementation lacks — but since nothing imports this composable, that send-path is never exercised. Not imported anywhere.

---

## 5. Error handling contract

- **No shared envelope-unwrap helper** (unlike `admin-dashboard`'s `unwrapApiPayload`). Every service function in this app repeats the same manual pattern:
  ```ts
  try {
    const response = await api.get(/put/post(...));
    return { success: true, data: response.data.data, timestamp: response.data.timestamp };
  } catch (error: any) {
    const message = error.response?.data?.message || error.message || "<zh-TW fallback>";
    return { success: false, error: message, timestamp: new Date().toISOString() };
  }
  ```
  i.e. the client reads `error.response.data.message` (a flat string), **not** the project's documented unified envelope `{success:false, error:{code, message, details?}}` (per root `CLAUDE.md`). If the server returns the nested `error.message` shape instead of a top-level `message` string, this client's error branch falls through to the raw `error.message` (axios's own message, e.g. `"Request failed with status code 500"`) instead of the server's actual message — **a real shape mismatch to be aware of when porting**, since `apps/api`'s own documented contract nests the message one level deeper than this specific client reads.
- **`response.data.timestamp`** is read and propagated into every `ApiResponse` regardless of whether the server actually sends one — if absent, it's simply `undefined` on success paths (no fallback), vs. a freshly-generated ISO string on the catch-path.
- **Retry logic**: only the axios-level 401→refresh→retry-once described in §3. No app-level retry/backoff for non-401 errors in `kitchenApi.ts`/`authApi.ts` — a single failed GET/PUT surfaces immediately as `success:false`, and callers (stores, views) show a toast.
- **Status codes branched on**: only `401` is specifically branched on (interceptor). No other status code (403, 404, 409, 429, 500) receives distinct client-side handling anywhere in this app's services — all non-401 errors flow through the generic `catch` blocks above as a flat string message.
- **Offline fallback**: `stores/orders.ts:202-210` — on any `fetchOrders` failure, if the device is offline (`!navigator.onLine` or `offlineService.isOnline.value === false`) **and** a non-empty local cache exists, the error is swallowed and cached orders are shown instead (`error.value` reset to `null`). If online but the request still failed, the error is surfaced normally.
- **Item-status writes while offline**: queued locally (`offlineService.queueAction`) and applied optimistically (`applyLocalItemStatus`) rather than attempted over the network; replayed via `sendActionToServer` when connectivity returns, with `validateStatus: () => true` (so even 4xx/5xx responses are treated as normal axios responses, not thrown errors) and up to 5 retries per action before giving up silently (no dead-letter surfaced to the UI beyond the in-memory `error` field on the queued action).

---

## 6. Rust rewrite compatibility notes

1. **`KitchenOrder.id` and `KitchenOrderItem.id` are client-side `number`, not string/UUID.** `isKitchenOrder` (`stores/orders.ts:16-22`) explicitly requires `typeof value.id === "number"` and `> 0`; `buildKitchenOrderFromRealtimeData` does `Number(data.orderId)` and drops the event if the result is `NaN` or `<= 0`. **A Rust backend that emits UUID-string order/item IDs over this WS channel or in the `GET /kitchen/:restaurantId/orders` response would silently break every downstream lookup** (`orders.value.findIndex(o => o.id === orderId)` comparisons, `Number()` coercions that turn a UUID string into `NaN`). This is a hard compatibility boundary independent of what `packages/database`'s actual PK type is server-side (per project memory, `menu_items`/`order_items`/`tables` PKs are integer-autoincrement — but *order* PKs are UUID text per the same memory note; this client's `KitchenOrder.id` assumption of numeric IDs for orders specifically should be reconciled against that before porting, since it may already be a latent bug independent of any Rust rewrite).
2. **`ItemStatus` wire values are the literal strings `"pending"|"preparing"|"ready"|"completed"`** (`types/index.ts:6`) sent verbatim in the `PUT .../items/:itemId` body's `status` field. Per the cross-checked server doc, the item-level vocabulary is intentionally distinct from the order-level state machine (which uses `"delivered"`, not `"completed"`) — **do not normalize/merge these two enums in the Rust port**; this client only ever speaks the item-level one on this route.
3. **`KitchenOrdersResponse` bucketing is trusted verbatim.** The client does zero client-side status-based re-bucketing of the *fetched* response — it directly spreads `data.pending`/`data.preparing`/`data.ready` into one flat array and separately trusts `data.stats` as-is. If the Rust server's bucket semantics ever drift from "pending bucket == order-status `confirmed`" (as documented server-side), this client will silently display orders in the wrong Kanban column with no client-side validation to catch it.
4. **`KitchenStats` fields (`pendingCount`,`preparingCount`,`readyCount`,`completedToday`,`averageCookingTime`,`averageWaitingTime`,`efficiency`,`urgentOrders`) are read once from the initial fetch, then only `completedToday` and `efficiency` are ever preserved from the server on every subsequent local recompute** (`stores/orders.ts:379-390`, `updateStats()`) — `pendingCount`/`preparingCount`/`readyCount`/`averageCookingTime`/`averageWaitingTime`/`urgentOrders` are **entirely locally recomputed** after the first load and after every realtime event, using client-side wall-clock math (`elapsedTime`, `startedAt`/`completedAt` diff in minutes). A Rust backend does not need to keep pushing updated stats over the WS channel for these fields — they're discarded/recomputed either way — but `completedToday`/`efficiency` **are** carried through from whatever the last full `GET .../orders` response contained, with no live-update mechanism, meaning these two numbers go stale until the next full refetch (auto-refresh interval, default 30s, or manual).
5. **Timestamp formats are inconsistent and worth flagging explicitly**:
   - `KitchenOrder.createdAt`/`item.startedAt`/`item.completedAt` are typed and consumed as **ISO-8601 strings** (`new Date(order.createdAt).getTime()`, `stores/orderManagement.ts:calculateElapsedTime`).
   - The realtime `RealtimeEvent.timestamp` field is a **Unix-epoch number** (per `BaseRealtimeEvent` in `packages/shared-types/src/realtime-events.ts:171-172`, doc-comment「Unix timestamp」on :171, field on :172), and `timestampToIso()` (`stores/orders.ts:39-45`) explicitly branches on `typeof timestamp === "number"` vs. string to normalize it — so the realtime channel and the REST channel use **different native representations for conceptually the same field**, and this client already defensively handles both. A Rust rewrite must keep the realtime `timestamp` field numeric (ms-or-s? — not disambiguated in the reviewed client code beyond `new Date(timestamp)`, which in JS assumes **milliseconds**) and the REST `createdAt`/`startedAt`/`completedAt` fields as parseable ISO strings, or this client's date math silently produces `Invalid Date` → `NaN` elapsed-time displays.
   - `handleOrderStatusUpdate` sets `item.startedAt`/`completedAt` to **`String(updatedAt)`** verbatim from the event payload with no `Date` re-parsing/re-validation at write time — if the server ever sends a numeric `updatedAt` here, it gets stringified as e.g. `"1737700000000"` rather than an ISO string, and every *later* read of that field via `new Date(item.startedAt)` (in `calculateAverageCookingTime`) would still parse correctly (JS `Date` accepts numeric-string epoch ms), but only by accident, not by contract. Prefer the server always sending ISO-8601 strings on this specific field to avoid relying on that coincidence.
6. **SSE framing/heartbeat expectations (dead code, but documented for completeness in case the SSE endpoint is kept for some other purpose)**: the unused `sseService.ts` expects named SSE events (`event: connected`, `event: heartbeat`, `event: order-update`, `event: test-event`) each with a JSON `data:` payload, plus tolerates the generic unnamed `message` event carrying `{type: "HEARTBEAT", ...}` as an alternate heartbeat signal. It expects at least one heartbeat/connected frame within 90 seconds of the last one, checked every 30s, or it force-reconnects. None of this is exercised by the live app today, so a Rust port is free to change or drop this endpoint's framing without breaking `kitchen-display` in practice — but should NOT assume it's safe to drop without checking other consumers (this doc only covers `kitchen-display`).
7. **`RealtimeAuthTokenResponse` must contain both `token` and `wsUrl` as non-empty strings** — the live client throws synchronously if either is missing, aborting the connect attempt (counted toward the 5-attempt reconnect budget). `expiresIn` is accepted but unused by this client (no client-side proactive WS-token refresh — a token that expires mid-session would only be caught by a subsequent `onclose`→reconnect cycle re-minting a fresh token from scratch, not a graceful in-place refresh).
8. **`RealtimeEvent.restaurantId` is typed as `string`** in `packages/shared-types` (`BaseRealtimeEvent.restaurantId: string`) but this client's own `KitchenSSEEvent.restaurantId` is typed as `number | string` (`types/index.ts:89`) and `User.restaurantId`/`authStore.restaurantId` flow as whatever type the login response provides — the route param (`props.restaurantId`, from Vue Router) is always a `string`, and the equality check gating dashboard access (`String(authStore.restaurantId) !== restaurantIdNum.value`, `EnhancedKitchenDashboard.vue:432`) explicitly stringifies before comparing, suggesting the client already defends against a numeric/string mismatch here. Keep `restaurantId` as a string end-to-end in the Rust port's WS/REST payloads to avoid reintroducing a type-coercion bug this code has already worked around once.
9. **Field-name split between `payload` and `data` on the same `KitchenSSEEvent` type is a real footgun for a Rust port**: the type itself (`types/index.ts:72-92`) declares both `payload?: any` and `data?: any` as valid carriers of the event body, and three different consumers (`stores/orders.ts`'s `eventData()` helper, `useAudioNotifications.ts:128`, and the one `PRIORITY_UPDATE` branch in `stores/orders.ts:344-355`) each pick `payload` over `data` with slightly different fallback logic. Since the **only reachable production path** (`services/realtimeService.ts` → `toKitchenSSEEvent()` adapter) only ever populates `.data` (never `.payload`), a Rust backend does not need to emit a `payload` field at all for this client to function correctly today — but should not assume `payload` is safe to omit from the shared `RealtimeEvent` type if other frontends (customer-app, admin-dashboard) still rely on it.

---

## Cross-check against documented server surface

Consulted `docs/Backend-Rust-refactor/api-features-ordering.md` (§4, Kitchen) and `docs/Backend-Rust-refactor/realtime.md`. Findings:

- **Matches server doc exactly**: `GET /kitchen/:restaurantId/orders`, `PUT /kitchen/:restaurantId/orders/:orderId/items/:itemId`, `POST /kitchen/:restaurantId/events/token`, `GET /kitchen/:restaurantId/events` (SSE — confirmed server-side as heartbeat-only, matching this doc's dead-code flag in §2.4), `POST /realtime/auth/token` semantics (`roomType`/`roomId`/`restaurantId`/`sessionId` request shape, `{token, wsUrl, expiresIn}` response shape), and the `kitchen:${restaurantId}` DO room key used by the WebSocket path.
- **Server doc explicitly flags, and this client's code confirms**: real order-event fan-out (`NEW_ORDER`/`ORDER_STATUS_UPDATE`/etc.) never flows through the kitchen SSE endpoint — it flows through the `REALTIME_SESSION` Durable Object via WebSocket only. This client's actual wiring (WS-only, SSE unused) is consistent with that server-side reality, even though the client also ships unused SSE code that implies otherwise.
- **Deprecated legacy routes** (`POST /kitchen/:orderId/items/:itemId/start`, `.../ready`, stated removal date 2026-07-01 per server doc) are **not called by this client at all** — `kitchen-display` only ever uses the canonical `PUT .../orders/:orderId/items/:itemId` route. Safe to retire from the client's perspective.
- `PUT /kitchen/notification-settings`: `push-notifications.ts:562` (`saveNotificationSettings()`) does implement this call, but nothing invokes that method — dead for now. **However the same `utils/push-notifications.ts` service IS live for push subscription**: `SettingsView.vue:540` → `kitchenPushService.subscribe()` → `sendSubscriptionToServer()` → `apiClient.post("/push/subscribe", {subscription, user_type:"kitchen", role:"chef", restaurant_id?, device_info})` (`push-notifications.ts:157`) — a real, reachable production call that a Rust rewrite must serve. See the endpoint inventory row added below.
- `GET /info`: `systemHealthService.ts:816` issues a raw `fetch("/info", {cache:"no-store", credentials:"omit"})` liveness probe, deliberately bypassing `apiClient`.
- **Cross-check with realtime.md**: `realtime.md`'s caller table already records that `services/realtimeService.ts` is this app's only live realtime client and that `useRealtimeKitchen.ts`/the SSE clients are dead code (zero imports, confirmed by exhaustive grep including tests) — the two docs agree.
