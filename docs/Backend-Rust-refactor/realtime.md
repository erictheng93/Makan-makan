# `apps/realtime` — Realtime WebSocket Service

Source reviewed: `apps/realtime/src/**/*.ts` (excluding `*.test.ts`), `apps/realtime/wrangler.toml`, `apps/realtime/package.json`, plus the shared type contract (`packages/shared-types/src/realtime-events.ts`) and the two producers that push events into this worker (`packages/database/src/services/RealtimeBroadcastService.ts`, `apps/api/src/features/realtime/services/RealtimeAuthService.ts`).

## 1. Purpose & responsibilities

`apps/realtime` is a small Cloudflare Worker (Hono app) whose only real job is to accept WebSocket upgrades and hand them off to a per-room **Durable Object** (`RealtimeSession`). The DO:

- Verifies a short-lived JWT passed as a query param before accepting the WebSocket (there is no separate handshake message — auth happens during the HTTP upgrade).
- Holds all currently-connected sockets for one "room" (e.g. one restaurant's kitchen display, one restaurant's admin dashboard, one table's customer session) in Durable Object hibernatable WebSocket state (`state.acceptWebSocket` / `state.getWebSockets()`), not in a JS `Map` — Durable Object hibernation reconstructs connection metadata from `serializeAttachment`/`deserializeAttachment` on wake.
- Answers heartbeat pings using the Cloudflare **WebSocket auto-response** API (`setWebSocketAutoResponse`) so the DO does not need to wake from hibernation just to answer a `ping`.
- Persists a rolling event history (max 100 events / 24h) in DO storage (`state.storage`) to support offline-reconnect replay via an internal `/history` endpoint.
- Exposes two other internal (non-WS) HTTP endpoints on the same DO: `/broadcast` (push an event to every currently-connected socket that should receive it) and `/stats` (introspection). These are reachable **only** by another Worker holding a DO stub and calling `stub.fetch(...)` directly — the public Hono router in `index.ts` deliberately does not expose them (see §3 and §7 for an important consequence of this).
- Runs a DO `alarm()` that sweeps connections idle >30 minutes and prunes event history older than 24h.

The service itself contains **no business logic** about orders/menus/tables — it is a pure fan-out/session-holder. All domain logic (deciding *when* to broadcast a `new_order` event, etc.) lives in `apps/api` and calls into this worker's Durable Object via `RealtimeBroadcastService` (`packages/database/src/services/RealtimeBroadcastService.ts`).

## 2. Runtime & bindings (`apps/realtime/wrangler.toml`)

| Setting | Dev (top-level) | `env.production` |
|---|---|---|
| Worker name | `makanmasak-realtime` | `makanmasak-realtime-prod` |
| `main` | `src/index.ts` | (inherited) |
| `compatibility_date` | `2024-09-23` | (inherited) |
| `compatibility_flags` | `["nodejs_compat"]` | (inherited) |
| Dev port | `8788` (`[dev] port = 8788`, `local_protocol = "http"`) | n/a |
| `inspector_port` | intentionally omitted (toml comment: pinning it crashes workerd on Windows/wrangler 4.84.1) | — |
| Route | none (dev uses local port) | `realtime.makanmasak.com` via `[[env.production.routes]]` with `custom_domain = true` (wrangler auto-provisions DNS/SSL) |
| Placement | — | `[env.production.placement] mode = "smart", strategy = "closest", hints = ["asia-southeast1"]` |

**Durable Objects** — single class, single binding, one migration:

```toml
[durable_objects]
bindings = [{ name = "REALTIME_SESSION", class_name = "RealtimeSession" }]

[[migrations]]
tag = "v1"
new_classes = ["RealtimeSession"]
```

Same binding name/class repeated verbatim under `[env.production.durable_objects]`. There is only ever one migration tag (`v1`) — the DO class has never been renamed/re-migrated.

**D1**: binding `DB` — dev points at `makanmakan-local` (`migrations_dir = "../../packages/database/migrations_fresh"`); production points at `makanmasak-prod` with a `database_id` that carries a `TODO: Replace with actual D1 database ID` comment (`wrangler.toml:79-81`) even though a concrete UUID is already filled in — worth confirming this is in fact live before treating it as authoritative. The DO uses `this.env.DB` directly with raw `.prepare()/.bind()` (not Drizzle) for two lookups: `users` (restaurant/role check) and `tables`/`seats` (table/seat ownership check) — see §4.

**KV namespaces** (dev has both `id` and `preview_id`; prod has only `id`):
- `CACHE_KV` — generic cache, shared with the API worker's namespace (prod id `5850dad46b684f2d8b69b3344d146a1d`).
- `TOKEN_BLACKLIST` — dedicated revocation namespace (prod id `30ba7daf1e4c41438233542de10dd02f`), consulted on every WS-token verification.
- `RATE_LIMIT_KV` — WS connection-attempt rate limiting (prod id `e442a551aa3f484db44fcdfa1084ff81`).

**Vars**:
- `ENVIRONMENT` (`development` / `production`)
- `API_VERSION = "v1"`
- `CORS_ORIGIN` — comma-separated allow-list; dev lists 9 localhost origins/ports, prod lists 4 `makanmasak.com` subdomains.
- `RATE_LIMIT_ENABLED` — `"false"` in dev, `"true"` in prod.

**Secrets** (not in `wrangler.toml`, referenced only via `Env` type): `JWT_SECRET`, `REALTIME_JWT_SECRET` (optional override — see §5), `SLACK_WEBHOOK_URL` (declared in the type, unused anywhere in the code I read).

**Two conflicting `Env` type definitions exist in this app**:
- `apps/realtime/src/types/env.ts` — this is the one actually imported everywhere (`index.ts`, `RealtimeSession.ts`, `rateLimiter.ts`). It declares `CACHE_KV`, `TOKEN_BLACKLIST`, `RATE_LIMIT_KV` as **required** (non-optional) `KVNamespace`.
- `apps/realtime/src/types.ts` — a second, unused `Env` (plus `RealtimeMessage`/`ConnectionState` interfaces) with different optionality (`TOKEN_BLACKLIST?`, `RATE_LIMIT_KV?`, no `CACHE_KV` at all, an extra `ANALYTICS_ENGINE?: AnalyticsEngineDataset`). Nothing in the non-test source imports from `./types` (confirmed via grep) — treat `src/types.ts` as **dead/legacy code**, not authoritative for a Rust port.

**`package.json`** (`apps/realtime/package.json`): dependencies are `hono@^4.12.24`, `jsonwebtoken@^9.0.2`, `zod@^3.25.76`, `@makanmakan/shared-types` (workspace). Dev script pins `wrangler dev --inspector-port 9233` (matching the CLAUDE.md guidance to pass inspector port via CLI, not toml). `build`/`build:prod` run `tsc && wrangler deploy --dry-run`. No runtime dependency on `ws` — `@types/ws` is dev-only (likely test tooling).

## 3. HTTP/WS surface (`apps/realtime/src/index.ts`)

Public Hono router (`app.fetch`), CORS-wrapped (`origin` allow-listed against `CORS_ORIGIN`, `credentials: true`, methods `GET/POST/OPTIONS`, and it explicitly allows the `Upgrade`/`Connection`/`Sec-WebSocket-Key`/`Sec-WebSocket-Version` headers so the WS handshake survives the CORS middleware):

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | none | Liveness check; returns `{status, service: "makanmakan-realtime", version: "1.0.0", timestamp, environment}` (`index.ts:65-73`). Not the same shape as the API worker's unified envelope — this worker predates/ignores that convention. |
| GET | `/customer/:tableId` | JWT in query string, checked **inside the DO**, not here | Customer-facing WS upgrade. Rate-limited (subject `{roomType: "customer", roomId: tableId}`), then forwarded verbatim to DO `idFromName(\`customer:${tableId}\`)`. |
| GET | `/admin/:restaurantId` | same pattern | Admin-dashboard WS upgrade. DO id `admin:${restaurantId}`. |
| GET | `/kitchen/:restaurantId` | same pattern | Kitchen-display WS upgrade. DO id `kitchen:${restaurantId}`. |
| * | anything else | — | `app.notFound` returns 404 with an `availableEndpoints` hint listing only the 3 room routes + `/health` (`index.ts:139-154`). |

`app.onError` logs and returns a generic 500, echoing `error.message` only when `ENVIRONMENT === "development"`.

**Note — no `/restaurant/:restaurantId` route exists**, even though: (a) `RealtimeSession.validateRoleRoomAccess` explicitly allows `admin` role to hit `roomType === "restaurant"` (`RealtimeSession.ts:685-689`), and (b) `apps/api`'s `RealtimeAuthService` can mint tokens with `roomType: "restaurant"` and builds a `wsUrl` of the form `${base}/restaurant/${roomId}?token=...` (`RealtimeAuthService.ts:131`, `:478`, `:655-663`). There is no client code path found that actually requests a `restaurant`-room token, so this may be inert, but a client hitting that generated URL against the real worker would 404. Flagging rather than guessing at intent.

**End-to-end WS upgrade flow**:

1. Client opens `wss://.../customer/T1?token=<jwt>` (or `/admin/:id`, `/kitchen/:id`).
2. `index.ts` route handler pulls the path param, and — **only if** the `Upgrade` header is present and lowercases to `"websocket"` — calls `checkRealtimeRateLimit` (§6). A rate-limit failure returns `429` with `Retry-After` **before** ever touching the Durable Object. A KV error returns `503 REALTIME_RATE_LIMIT_UNAVAILABLE` (fail-closed on infra error, fail-open on limiter itself disabled).
3. If allowed, `index.ts` does `env.REALTIME_SESSION.idFromName(\`${roomType}:${roomId}\`)` then `durableObject.fetch(c.req.raw)` — the **raw** incoming `Request` (including its `Upgrade` header and query string) is forwarded unchanged into the DO's own `fetch()`.
4. Inside `RealtimeSession.fetch()` (`RealtimeSession.ts:55-75`): if `Upgrade === "websocket"`, delegates to `handleWebSocketUpgrade`, which does **all** authentication/authorization (§4/§5) — the outer Worker performs zero JWT validation itself, only the rate limit.
5. On success, `handleWebSocketUpgrade` creates a `WebSocketPair`, calls `server.serializeAttachment(connectionInfo)` then `state.acceptWebSocket(server, [roomType, roomId])` — the array argument is the DO hibernatable-WS "tags" (usable for `getWebSockets(tag)` filtering, though this code never actually filters by tag — it always calls `getWebSockets()` with no argument and filters in JS by re-reading the attachment).
6. Server immediately pushes one `connection_ack` event to the new socket (not to the room), then returns `new Response(null, {status: 101, webSocket: client})`.
7. Steady state: `webSocketMessage`/`webSocketClose`/`webSocketError` are the DO's hibernatable-WS lifecycle callbacks (Cloudflare invokes them on wake, they are not tied to a live `fetch()` call) — see §4 for message protocol.

## 4. Durable Object: `RealtimeSession` (`apps/realtime/src/durableObjects/RealtimeSession.ts`)

### Keying / addressing

One DO instance == one "room". Room identity is `${roomType}:${roomId}` fed to `idFromName`. Two families of callers construct this key, and **they do not always agree**, which is the single most important behavioral fact to carry into a Rust port:

| Caller | Key it builds | roomType values used |
|---|---|---|
| `apps/realtime/src/index.ts` (public WS routes) | `customer:${tableId}`, `admin:${restaurantId}`, `kitchen:${restaurantId}` | `customer`, `admin`, `kitchen` only |
| `packages/database/src/services/RealtimeBroadcastService.ts` (server→room push, called from `apps/api`) | `restaurant:${restaurantId}`, `kitchen:${restaurantId}`, `admin:${restaurantId}` (waiting-list only), `group_order:${groupOrderId}` | `restaurant`, `kitchen`, `admin`, `group_order` |
| `apps/customer-app/src/composables/useGroupOrder.ts:233` (client connect) | connects to `/customer/${groupOrderId}` → DO key `customer:${groupOrderId}` | — |

Consequences (verified by reading both sides, not assumed):
- **Order/kitchen broadcasts never reach the admin dashboard's actual connection.** `OrdersService`/`order-finalization.ts`/`KitchenService` all broadcast `NEW_ORDER` / `ORDER_STATUS_UPDATE` / `ORDER_ITEM_STATUS_UPDATE` / `ORDER_CANCELLED` / `KITCHEN_ITEM_STATUS` via `RealtimeBroadcastService.broadcastRestaurantAndKitchen`, which fans out to DO keys `restaurant:${id}` and `kitchen:${id}` (`RealtimeBroadcastService.ts:155-181`). The admin dashboard, however, connects via `/admin/:restaurantId`, i.e. DO key `admin:${id}` (`index.ts:112`). `restaurant:${id}` and `admin:${id}` are **different Durable Object instances** with independent connection sets — nothing is ever listening on `restaurant:${id}`, so those broadcasts silently reach 0 sockets there (kitchen-display, which does key on `kitchen:${id}`, does receive them). `MENU_AVAILABILITY_UPDATE` (`RealtimeBroadcastService.ts:145-149`, targets `restaurant` only) has the same gap. Waiting-list events are the one broadcast path that targets `admin` directly (`WaitingListService.ts:202`, `packages/database/src/services/WaitingListService.ts`) and do reach the admin dashboard correctly.
- **Group-order broadcasts never reach the group-order WS client either**, for the mirror-image reason: `broadcastGroupOrderEvent` in `apps/api/src/features/group-orders/routes/index.ts:35-57` calls `broadcaster.broadcastEvent("group_order", groupOrderId, event)` → DO key `group_order:${groupOrderId}`, while the customer-app client that's supposed to receive these connects at `/customer/${groupOrderId}` → DO key `customer:${groupOrderId}` (`apps/customer-app/src/composables/useGroupOrder.ts:233`). Even if the keys matched, `shouldSendEventToConnection` (below) has no case for any `GROUP_ORDER_*`/`GROUP_MEMBER_*`/`GROUP_CART_*` event type, so it would fall through to the `default` branch which only delivers to `role === "admin"` connections — and the group-order client connects with `role: "customer"`. This is two independent bugs stacked on the same feature; flagging both rather than silently "fixing" the behavior in a port.
- The public router (`index.ts`) has **no route at all** for `roomType: "group_order"` or `roomType: "restaurant"` — those DO instances are unreachable by any real browser client, only reachable by another Worker holding a DO stub (server-to-server).

### Connection accept (`handleWebSocketUpgrade`, `RealtimeSession.ts:77-251`)

Path is parsed as `/${roomType}/${roomId}` from the forwarded request's URL (note: this reads the DO-internal path, which is the same path the outer Worker was invoked with — `index.ts` forwards `c.req.raw` unmodified, so the DO sees e.g. `/customer/T1`, not some internal-only path).

Validation order (each step returns immediately on failure with a specific HTTP status — no partial state is created):
1. `roomType`/`roomId` present → else `400`.
2. Token extracted from `?token=` query param (`extractTokenFromUrl`) → missing → `401`.
3. JWT secret resolved as `env.REALTIME_JWT_SECRET || env.JWT_SECRET` → if neither configured, `500`.
4. `verifyWebSocketToken` (§5) → invalid/expired/revoked → `401` with the specific verifier error message appended.
5. **Room-ID match**: for guest tokens, either `authPayload.roomId === roomId` or (legacy, no `scope`) `authPayload.roomId === \`customer:${roomId}\``; for non-guest, exact match. Mismatch → `403`.
6. **Room-type match**: `authPayload.roomType !== roomType` → `403`.
7. **Role↔roomType match** via `validateRoleRoomAccess` (§ below) → `403`.
8. **Guest-token room lock**: guest tokens are rejected unless `roomType === "customer" && role === "customer"` → `403`.
9. **Restaurant membership** (non-customer roles only): `validateRestaurantAccess` queries `SELECT restaurant_id, role FROM users WHERE id = ? AND is_active = 1` via raw D1 `.prepare()`; platform admins (`role === 0` in DB, or `authPayload.appRole === 0`) bypass the restaurant match; otherwise `result.restaurant_id !== authPayload.restaurantId` → `403`. DB error → `403` (fails closed).
10. **Table/seat ownership** (customer room only): `validateTableAccess` (`RealtimeSession.ts:761-826`) — if no `tableId` on the token, treated as shop-mode order and allowed. Otherwise runs **two separate D1 `.prepare()` queries** (one against `tables`, one against `seats`) and compares `seat.table_id !== table.id` in JS (`:810`) — there is no SQL JOIN — to confirm the seat belongs to that table and both are active. DB error → `403`.

On full success: `ensureRoomInfo(roomType, roomId)` lazily persists `{type, id}` to DO storage (`ROOM_INFO_STORAGE_KEY`) the first time the room is ever touched (used only for `/stats` introspection). A `WebSocketPair` is created, `connectionInfo` (id, type, roomId, `connectedAt`, `lastActivity`, `auth: authPayload`) is written via `server.serializeAttachment(...)`, then `state.acceptWebSocket(server, [roomType, roomId])`. A `connection_ack` event is sent to just that socket, and the upgrade `Response` returns `status: 101` with the `client` end of the pair.

### Role↔roomType matrix (`validateRoleRoomAccess`, `RealtimeSession.ts:680-700`)

```
customer -> [customer]
staff    -> [kitchen]
admin    -> [admin, kitchen, restaurant]
```
Note `staff` cannot access `admin` rooms at all in this matrix (even though `RealtimeAuthService.determineRole` can assign `"staff"` for kitchen tokens) — only `customer`/`staff`/`admin` are legal `role` values on the payload; anything else yields an empty allow-list (reject).

### Hibernation API usage

- `state.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"))` is registered once in the constructor — Cloudflare answers a literal `"ping"` text frame with `"pong"` **without waking the DO** at all. This is why `webSocketMessage` also has a manual branch for `data === HEARTBEAT_REQUEST` (`"ping"`) that responds with a structured `heartbeat` JSON event — that branch only fires if the DO is *already* awake for some other reason when a raw `"ping"` arrives (auto-response short-circuits it otherwise), so it's effectively a fallback path, not the primary heartbeat mechanism.
- `state.acceptWebSocket(socket, tags)` is the hibernatable-accept call — sockets survive DO eviction; `webSocketMessage`/`webSocketClose`/`webSocketError` are re-invoked on wake by the runtime, matched back to their `ConnectionInfo` via `deserializeAttachment()`.
- `webSocketClose`/`webSocketError` both set `serializeAttachment(null)` to mark the socket dead in place (they do **not** call `socket.close()` again in the close handler, only in the error handler) — connection lists are always recomputed live by filtering `getWebSockets()` for `readyState === OPEN && attachment !== null`, there is no separate in-memory registry to fall out of sync.

### Message protocol

Client → server frames are validated by `validateBasicClientMessage` (Zod, `messageValidation.ts:22-46`, discriminated on `type`, `.strict()` — unknown extra keys are rejected):
- `{"type": "ping", timestamp?: number, data?: object}` → server replies with a `heartbeat` event (see below). This is the manual/fallback path since raw `"ping"` text is normally intercepted by the auto-responder before reaching JS.
- `{"type": "subscribe", timestamp?: number, channel?: string, data?: object}` → accepted and validated but **no-op** (comment: "未來擴展" / "for future expansion") — no subscription state is stored anywhere.
- `{"type": "unsubscribe", ...}` → same shape, also a no-op.

Any other shape (or invalid JSON) → server sends an `error` event with `code: "INVALID_MESSAGE"` (Zod validation failure, message built by `formatValidationError`) or `code: "MESSAGE_PARSE_ERROR"` (JSON parse / unexpected exception in `handleMessage`'s catch block).

There is also a **second, richer schema** (`validateAdvancedClientMessage` / `AdvancedClientMessage`, `messageValidation.ts:52-186`) covering `order_state_change`, `broadcast`, `heartbeat`, `request_state_sync`, `join_group_order`, `leave_group_order`, `add_cart_item`, `update_cart_item`, `remove_cart_item`, `initiate_split_bill`, `process_payment` — but **`RealtimeSession.handleMessage` never calls `validateAdvancedClientMessage`**; only `validateBasicClientMessage` is used in the live message-handling path (`RealtimeSession.ts:301`). The advanced schema is exported and type-checked but appears to be dead/aspirational code from the client's perspective — any client sending e.g. `add_cart_item` over this DO's socket gets rejected by the basic schema's `.strict()` discriminated union (unrecognized `type` literal). Flagging as a real gap rather than assuming intended behavior.

Server → client events are all variants of `RealtimeEvent` (`packages/shared-types/src/realtime-events.ts`), a `BaseRealtimeEvent { type: RealtimeEventType; eventId: string; timestamp: number; restaurantId: string }` plus a `data` payload that varies per `type`. The DO directly constructs and sends only three of these itself: `connection_ack` (on upgrade), `heartbeat` (on `ping`), `error` (on bad input) — every other event type (`new_order`, `order_status_update`, `kitchen_item_status`, `table_call_service`, `waiting_list_*`, `group_order_*`, etc.) only ever originates from an external `/broadcast` POST (i.e. from `apps/api` via `RealtimeBroadcastService`), never from client-originated messages. See `packages/shared-types/src/realtime-events.ts:119-161` for the full `RealtimeEventType` enum and `:184-605` for every event's exact `data` shape (not reproduced in full here to avoid drift from the source of truth — treat that file as canonical for wire-format field names).

### Broadcast / routing semantics (`handleBroadcast`, `routeEvent`, `shouldSendEventToConnection`)

`POST /broadcast` (DO-internal only) parses one `RealtimeEvent` from the JSON body, validates presence of `type`/`eventId`/`timestamp`/`restaurantId` (400 if missing), appends it to event history (§ state), then calls `routeEvent(event)` which iterates **every currently-open socket in this DO instance** (not filtered by tag) and calls `shouldSendEventToConnection` per socket:

1. Hard filter: `event.restaurantId !== connectionInfo.auth.restaurantId` → never sent (cross-tenant isolation at the connection level, independent of which DO the event landed in).
2. Then a `switch (eventType)` matrix by `role` (`connectionInfo.auth.role`, one of `customer`/`staff`/`admin`):
   - `new_order`, `order_cancelled`, `table_status_update`, `table_call_service`, `menu_availability_update`, `menu_item_update`, `system_notification`, `restaurant_status_update` → always sent to everyone in the room (subject to the restaurantId filter above).
   - `order_status_update`, `order_item_status_update` → sent to `customer` unconditionally (comment: "之後可以優化" — a TODO to scope to the customer's own table/seat that was never implemented) and to `staff`/`admin`.
   - `kitchen_item_status`, `kitchen_queue_update` → `staff`/`admin` only.
   - `connection_ack`, `heartbeat`, `error` → never routed via broadcast (`return false`) — these are always sent directly to one socket, never fanned out.
   - anything not listed (`waiting_list_*`, all `group_order_*`/`group_member_*`/`group_cart_*` variants) → `default: return role === "admin"` only.
3. On send, `connectionInfo.lastEventId = event.eventId` is updated and re-serialized onto the socket attachment (this is the only use of `lastEventId`/`missedEvents` fields on `ConnectionInfo` — no other code path reads `missedEvents` at all; it's declared but never populated).

Response: `{success: true, message: "Event broadcast", eventId, recipientCount: sentCount}`.

### Room/topic model

A "room" is exactly one DO instance, addressed by `${roomType}:${roomId}` as described above. There is no sub-topic/channel concept beyond that — the `subscribe`/`unsubscribe` client messages are accepted but inert (see message protocol above), and the optional `channel` field on the local `subscribe`/`unsubscribe` Zod schemas (`apps/realtime/src/utils/messageValidation.ts:32-44`) is unused by the DO. (The exported shared-types `ClientMessage` interface, `realtime-events.ts:775-782`, has no `channel` field at all — only `type`/`timestamp`/`data`.)

### State stored in DO storage (`state.storage`, durable KV per-DO)

| Key | Type | Contents |
|---|---|---|
| `eventHistory` | `RealtimeEvent[]` | Append-only-ish log, trimmed to last `MAX_EVENT_HISTORY = 100` entries and any entry older than `MAX_EVENT_AGE_MS = 24h`; cached in the `this.eventHistory` instance field between wake cycles (lazy-loaded via `loadEventHistory`). |
| `roomInfo` | `{type: string, id: string}` | Set once on first connection to the room; used only for `/stats` output. |

Connection state itself (`ConnectionInfo`) is **not** in `state.storage` — it lives entirely in the WebSocket hibernation attachment (`serializeAttachment`/`deserializeAttachment`), which Cloudflare persists per-socket across hibernation automatically. A Rust port must replicate this distinction: durable KV-style storage for history/room-metadata vs. per-connection attachment data that rides along with the socket itself.

### `/stats` (`handleStats`) and `/history` (`handleHistoryRequest`)

- `/stats`: returns `roomInfo`, live `connectionCount`, a per-connection summary (id, type, role, ISO `connectedAt`/`lastActivity`, `lastEventId`), `eventHistorySize`, and `uptime` computed as `Date.now() - min(connectedAt across current sockets)` (falls back to `Date.now()` — i.e. `uptime: 0` — when there are no connections; this is instance-uptime-since-first-still-open-socket, not true DO-instance age).
- `/history?since=<eventId>`: returns all events after the given `eventId` in history order; if `since` omitted, returns everything; if the `eventId` isn't found, returns everything with a `note` field explaining why (no error). Nothing in the reviewed source code (client or server) actually calls `/history` — it's reachable only via direct DO-stub `fetch()`, and no such caller was found in `apps/api` or the frontend apps searched. Likely intended for a reconnect-and-catch-up flow that hasn't been wired up client-side yet.

### Cleanup / alarms

`alarm()` → `cleanupConnections()`:
- Closes (`socket.close()`) and detaches (`serializeAttachment(null)`) any connection whose `lastActivity` is >30 minutes old (hardcoded `timeout = 30 * 60 * 1000`).
- Re-filters `eventHistory` to entries within `MAX_EVENT_AGE_MS` (24h) and persists it.

**No code in this file ever calls `state.storage.setAlarm(...)`** — `alarm()` is defined but nothing schedules it. Unless something outside the reviewed source sets an alarm (none found), this cleanup path is dead: idle connections are never proactively closed by an alarm, and event-history time-based pruning only actually happens as a side effect of `addToEventHistory` being called on every new broadcast (`RealtimeSession.ts:612-627` does its own trim/filter inline on every append, so history pruning does happen in practice — just not via the alarm). Flagging the missing `setAlarm` call as a likely gap for a Rust port to either replicate faithfully (no periodic connection reaper) or fix deliberately.

## 5. Auth (`apps/realtime/src/utils/jwtVerifier.ts`)

- **Format**: HMAC-signed JWT (`jsonwebtoken` npm package, Node-compat via `nodejs_compat` flag), algorithm restricted to `HS256` explicitly in `verify(token, secret, {algorithms: ["HS256"]})` (`jwtVerifier.ts:107-109`).
- **Secret resolution**: `env.REALTIME_JWT_SECRET || env.JWT_SECRET`, and it must be ≥32 chars or verification immediately fails with `"Server configuration error"` (checked both here and independently in `apps/api`'s `RealtimeAuthService`).
- **Claims validated** (`RealtimeAuthPayload`, `packages/shared-types/src/realtime-events.ts:40-66`): `roomType`, `roomId`, `restaurantId` required (missing any → `"Invalid token payload: missing required fields"`); `exp`/`iat` standard JWT claims, `exp` re-checked manually against `Date.now()` even though `jsonwebtoken`'s own `verify` already enforces expiry ("再加一層保險" / extra safety margin — effectively redundant unless clock skew matters). Optional: `role` (`customer`/`staff`/`admin`), `appRole` (numeric legacy role, 0=admin per CLAUDE.md's role table), `scope` (`"guest-realtime"` literal), `guestFlag`, `tableId`, `orderId`, `seatId`, `userId`, `publicUserId`.
- **Guest-token shape enforcement**: if `guestFlag` is true, payload must be either `scope === "guest-realtime" && orderId && roomId === "order:${orderId}"` (new, scoped-to-order guest flow) or the legacy shape (`!scope && tableId && roomId === "customer:${tableId}"`) — anything else is `"Invalid guest token payload"`. Both `roomType` **and** `role` must equal `"customer"` at this layer (`jwtVerifier.ts:129-133`) — on top of the separate guest-token room lock re-check inside `RealtimeSession.ts:162-168`.
- **Blacklist check** (`isTokenRevoked`): runs **before** signature verification. Computes `sha256:${base64url(SHA-256(token))}` and looks up `TOKEN_BLACKLIST:token:revoked:${hash}` in KV. No KV binding → treated as not revoked (fail-open only when infra is absent, e.g. local dev without KV). A KV **read error** is treated as revoked (fail-closed on infra failure) — note this differs from the room-access DB error paths in `RealtimeSession` which also fail closed (403), so the pattern is consistent app-wide: infra errors during auth/authorization always deny.
- **Error paths surfaced to the client** (all as WS-upgrade HTTP status + message, never as a WS frame since the socket doesn't exist yet): missing token → 401 `"Unauthorized: Token required"` (same `Unauthorized:` prefix template as the rest, `RealtimeSession.ts:89`); revoked → 401 `"Unauthorized: Token has been revoked"`; expired (`TokenExpiredError`) → 401 `"...Token has expired"`; malformed (`JsonWebTokenError`) → 401 `"...Invalid token format"`; not-yet-valid (`NotBeforeError`) → 401 `"...Token not yet valid"`; any other verification exception → 401 `"...Token verification failed"`. **Secret problems split into two different statuses**: a *fully missing* secret returns **500** `"Server configuration error"` directly (`RealtimeSession.ts:93-97`), but a *present-yet-shorter-than-32-chars* secret fails inside `verifyWebSocketToken` (`jwtVerifier.ts:85`) and surfaces through the generic invalid-token branch as **401** `"Unauthorized: Server configuration error"` (`RealtimeSession.ts:105-113`) — a Rust port must preserve this 500-vs-401 split for parity.
- Token is extracted purely from `?token=` query string (`extractTokenFromUrl`) — never from an `Authorization` header for the WS path (browsers can't set custom headers on the WS handshake, so query-string is the only option here; this is a real constraint to preserve, not an oversight).

## 6. Rate limiting (`apps/realtime/src/utils/rateLimiter.ts`)

Fixed-window counter per `(roomType, roomId, client IP, 60s window)`, backed by KV, gating **only WebSocket upgrade attempts** (checked in `index.ts` before the request ever reaches the DO):

- Window: `WINDOW_SECONDS = 60`, `windowId = floor(now / 60000)` — a hard-aligned wall-clock minute bucket (not sliding).
- Limits per room type: `customer: 30`, `admin: 60`, `kitchen: 60` per window, per client per room.
- Client identity: `CF-Connecting-IP` header, falling back to first entry of `X-Forwarded-For`, falling back to the literal string `"unknown"` (so all unidentifiable clients share one bucket — a potential shared-fate limitation worth flagging for a rewrite).
- Key: `ws-rate:${roomType}:${roomId}:${clientAddress}:${windowId}`.
- Disabled entirely unless **both** `RATE_LIMIT_ENABLED === "true"` **and** `RATE_LIMIT_KV` is bound (`isEnabled`) — dev has it `"false"`, prod `"true"`.
- On each attempt: read current count, increment, and if `count > limit` reject with `429` + computed `Retry-After` (seconds remaining in the current window) **without** writing back the incremented count (so a rejected request doesn't itself count against the next window's baseline — it re-reads from KV next time). If allowed, writes the new count back with `expirationTtl: max(60, retryAfterSeconds)`.
- Note: the increment-then-check is **not atomic** (a KV `get` then a separate `put`) — under concurrent connection bursts from the same room+IP within the same second, this can under-count (race condition), which is a fine tradeoff for a soft limiter but should be called out explicitly if a Rust port is tempted to "fix" it with a differently-tunable algorithm — the current behavior is a best-effort approximate limiter, not exact.
- A KV lookup failure returns `503 REALTIME_RATE_LIMIT_UNAVAILABLE` from `index.ts` (fail-closed on infra failure, consistent with the rest of the app's error posture).

## 7. Cross-service interactions

**Who connects, and how (verified against actual client code, not just the shared-types comments):**

| App | Connects to | Room key it lands in |
|---|---|---|
| `apps/customer-app` | `/customer/:tableId` (regular table sessions) and `/customer/:groupOrderId` for group orders (`apps/customer-app/src/composables/useGroupOrder.ts:233`) | `customer:${tableId}` or `customer:${groupOrderId}` |
| `apps/admin-dashboard` | `/admin/:restaurantId` for the live WS connection (`websocketService.ts`/`realtimeService.ts`); **also** directly POSTs to `${realtimeHttpBase}/broadcast/:roomType/:roomId` and GETs `${realtimeHttpBase}/stats/:roomType/:roomId` (`apps/admin-dashboard/src/services/realtimeService.ts:296-330`), where `realtimeHttpBase` comes from `VITE_REALTIME_HTTP_URL` first, then `VITE_REALTIME_URL`, and only third `VITE_REALTIME_WS_URL` with `ws→http`/`wss→https` rewrite (`resolveRealtimeHttpBase`, `realtimeService.ts:66-80`) | `admin:${restaurantId}` for the socket. **The `/broadcast/...` and `/stats/...` HTTP calls will 404 against the real deployed worker** — `apps/realtime/src/index.ts` has no such routes, and this is explicitly asserted by a passing test (`apps/realtime/src/index.test.ts:191-206`, "does not expose public broadcast or stats Durable Object helpers"). This looks like dead/broken client code (or code written against an earlier version of this worker) rather than intended behavior — flagging rather than silently reconciling. |
| `apps/kitchen-display` | `/kitchen/:restaurantId` (`services/realtimeService.ts` — the app's only live realtime client; `useRealtimeKitchen.ts` and the SSE clients are dead code, see frontend-kitchen-display-contract.md) | `kitchen:${restaurantId}` |
| `apps/api` (server-to-server, never a browser) | Never opens a WebSocket. Pushes events by holding a `REALTIME_SESSION` DO-namespace binding (must be configured as a binding in `apps/api`'s own `wrangler.toml` — not reviewed here) and calling `stub.fetch("https://realtime-internal/broadcast", {method: "POST", body: JSON.stringify(event)})` via `RealtimeBroadcastService` (`packages/database/src/services/RealtimeBroadcastService.ts`). Broadcast is treated as **best-effort**: if `REALTIME_SESSION` isn't bound, or the DO call throws, `apps/api` logs a warning and returns `success: true` anyway (`RealtimeBroadcastService.ts:47-60`) — realtime push failures never fail the originating order/kitchen mutation. |

**Token issuance**: `apps/api`'s `RealtimeAuthService.generateWebSocketToken` / `.generateGuestToken` (`apps/api/src/features/realtime/services/RealtimeAuthService.ts`) mint the JWTs this worker verifies — they share `REALTIME_JWT_SECRET`/`JWT_SECRET` as the signing key (same fallback order on both sides). `apps/api` independently re-validates most of the same claim shapes before minting (table/seat existence in D1, session-token/role checks against `users` table) — i.e. there are two layers of validation (mint-time in `apps/api`, verify-time in this worker) that must be kept in sync claim-for-claim in any rewrite.

## 8. Rust rewrite notes

- **Durable Objects are Cloudflare-proprietary.** `workers-rs` (the official Rust SDK for Workers) does support authoring Durable Object classes in Rust, including the hibernatable-WebSocket API (`acceptWebSocket`/`getWebSockets`/`serializeAttachment`/`setWebSocketAutoResponse` all have `workers-rs` equivalents as of recent releases) — if the target is "stay on Cloudflare, rewrite the Worker code in Rust," this is a near-direct port: same DO semantics, same hibernation model, same `idFromName` addressing, just Rust instead of TS. Confirm the exact `workers-rs` version's WS-hibernation API coverage before committing to this path, since it has evolved across releases.
- **Alternative — leave Cloudflare's DO model:** a standalone stateful Tokio service (e.g. `axum` + `tokio-tungstenite`) can replicate "one process holds all sockets for a room" only if you also solve what Durable Objects give for free: (a) automatic global routing to a single canonical instance per room name (you'd need your own sharding/routing layer, e.g. consistent hashing behind a load balancer, or a single-writer-per-shard pattern), (b) hibernation-cheap idle connections (Tokio tasks are cheaper than DO wake cycles but there's no free serverless scale-to-zero-per-room primitive off Cloudflare), and (c) DO storage's automatic per-object durability (you'd need your own KV/Postgres-backed room-state store). This is a bigger architectural decision than a language port and should be scoped separately from "translate this file to Rust."
- **Hibernation semantics to preserve or deliberately drop**: this worker currently keeps zero per-connection state outside the hibernation attachment (`ConnectionInfo` lives entirely in `serializeAttachment`) — a rewrite must decide whether it wants the same "wakes from cold with full connection metadata reconstructed from the attachment" behavior (matches DOs) or a persistently-running process where this distinction doesn't exist (matches a Tokio service). The `setWebSocketAutoResponse("ping"→"pong")` behavior (answering heartbeats without waking the object) has no equivalent outside DOs — a Tokio service would just handle it in the normal event loop since it's never actually "asleep."
- **JSON message compatibility is the hard requirement, not the transport.** Every wire message (`RealtimeEvent` variants in `packages/shared-types/src/realtime-events.ts`, and the client-message shapes in `messageValidation.ts`) is consumed by four other TypeScript apps (`customer-app`, `admin-dashboard`, `kitchen-display`, and indirectly `apps/api`'s token/event producers). A Rust rewrite must serialize/deserialize byte-for-byte-compatible JSON (same field names, same enum string values like `"new_order"`/`"order_status_update"`, same optional-vs-required fields) — `serde` with `#[serde(rename_all = ...)]`/explicit `rename` per field, and hand-written enum string mappings (not derive defaults) will be needed to match the existing camelCase/snake_case mix exactly (e.g. `eventId`, `restaurantId` are camelCase; `type` values like `order_status_update` are snake_case strings). Any drift here breaks 4 other apps simultaneously, not just this one.
- **Timing/Date usage**: all timestamps are `Date.now()` (JS epoch-ms, matching the repo-wide `_ms` Unix-millisecond convention per project memory) — `eventId`/`connectionId` generation embeds `Date.now()` plus `Math.random().toString(36)` for uniqueness (`generateEventId`, `RealtimeSession.ts:673-675`; note this is **duplicated** almost verbatim in `RealtimeBroadcastService.generateEventId`, `packages/database/src/services/RealtimeBroadcastService.ts:151-153` — a Rust port should pick one canonical ID-generation scheme, e.g. UUID v7 per the project's stated ID strategy, rather than porting the `Math.random()`-based scheme, which has no collision guarantees and isn't cryptographically meaningful — though changing the format would be a wire-compatibility-breaking, cross-app decision, not one this rewrite can make unilaterally). The 30-minute idle timeout and 24h event-history retention are plain millisecond constants (`30 * 60 * 1000`, `24 * 60 * 60 * 1000`) with no timezone/business-date logic involved (unlike other parts of this codebase that use `business_date`/timezone-offset helpers) — nothing here depends on wall-clock calendar semantics.
- **JS event-loop ordering dependencies**: `routeEvent`/`shouldSendEventToConnection` iterate `getWebSockets()` synchronously and send to each matching socket in a plain `for...of` loop with no `await` inside the send (`sendEvent` is fire-and-forget, synchronous `socket.send()`), so message ordering to a given client is whatever order sockets appear in `getWebSockets()` combined with call order — nothing here does out-of-order concurrent `Promise.all` sends that a Rust async rewrite might accidentally reorder. However, one real subtlety: `connectionInfo.lastEventId` is mutated and re-serialized (`socket.serializeAttachment(connectionInfo)`) inside the same loop iteration as the send — a Rust rewrite using genuinely concurrent per-socket tasks (rather than this JS-single-threaded-per-DO-instance model) would need a lock or actor-per-connection pattern to keep that read-modify-write safe, since Cloudflare's DO model guarantees single-threaded execution per instance and this code silently relies on that guarantee (no explicit locking anywhere in the file).
- **Known behavioral gaps to explicitly decide on rather than silently port or silently fix** (all cited above with file:line): (1) `restaurant`/`admin` DO-key mismatch means most order/kitchen/menu broadcasts never reach the admin dashboard; (2) `group_order` vs `customer` DO-key mismatch plus a missing switch-case means group-order broadcasts never reach group-order clients even if key mismatch were fixed; (3) `validateAdvancedClientMessage`/`AdvancedClientMessage` schema is fully implemented but never invoked — client-originated `add_cart_item`/`process_payment`/etc. messages are currently impossible over this socket; (4) `alarm()` cleanup logic exists but nothing calls `state.storage.setAlarm(...)`, so it likely never runs in production; (5) `/history` endpoint has no caller anywhere in the reviewed codebase. A faithful "translate the bugs too" port and a "fix while translating" port are both legitimate strategies — this document intentionally does not pick one, since that's a product decision, not a discovery one.

## Appendix: files read

- `apps/realtime/src/index.ts`, `apps/realtime/src/index.test.ts` (read for its assertions about route non-existence, not as a source of behavior)
- `apps/realtime/src/durableObjects/RealtimeSession.ts`
- `apps/realtime/src/types.ts`, `apps/realtime/src/types/env.ts`
- `apps/realtime/src/utils/jwtVerifier.ts`, `apps/realtime/src/utils/messageValidation.ts`, `apps/realtime/src/utils/rateLimiter.ts`
- `apps/realtime/wrangler.toml`, `apps/realtime/package.json`
- `packages/shared-types/src/realtime-events.ts` (wire-format source of truth)
- `packages/database/src/services/RealtimeBroadcastService.ts` (server→DO push path)
- `apps/api/src/features/realtime/services/RealtimeAuthService.ts` (token mint path)
- `apps/api/src/features/orders/services/OrdersService.ts`, `apps/api/src/features/orders/services/order-finalization.ts`, `apps/api/src/features/kitchen/services/KitchenService.ts`, `apps/api/src/features/group-orders/routes/index.ts`, `packages/database/src/services/WaitingListService.ts` (broadcast callers, to confirm which `roomType` each one actually uses)
- `apps/admin-dashboard/src/services/realtimeService.ts`, `apps/customer-app/src/composables/useGroupOrder.ts` (client-side connection targets, to confirm actual DO keys used by the four frontend apps)
