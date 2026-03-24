# Proactive + Reactive Token Refresh (Plan B)

**Date**: 2026-03-22
**Status**: Approved
**Scope**: admin-dashboard, customer-app, kitchen-display

## Problem

JWT tokens expire and the frontend apps have no working mechanism to automatically refresh them. This causes all API requests to return 401, forcing users to manually re-login.

### Root Causes

1. **Admin Dashboard**: Login response includes `refreshToken` but the store never saves it. The 401 interceptor calls `/auth/refresh` without the required `X-Refresh-Token` header.
2. **Customer App**: Stores refresh token correctly, but sends it in the request body instead of the `X-Refresh-Token` header (which the API requires). Also has no API service with 401 interceptor — uses raw `fetch()`.
3. **Kitchen Display**: `refreshToken()` in `authApi.ts` calls `/auth/refresh` with no refresh token at all. Login doesn't store the refresh token. Store at `stores/auth.ts` also has a `refreshToken()` that calls the broken service method.
4. **SSE/WebSocket (all apps)**: Token is captured at connection time and never refreshed on reconnect. Expired token causes infinite failed reconnect loops. Kitchen display SSE reads token from localStorage but never passes it to the server URL.
5. **No proactive refresh**: None of the apps check token expiration before it happens. Users only discover the problem when API calls fail.
6. **No refresh queue**: Multiple concurrent 401 responses each independently trigger refresh, causing race conditions.

### API Contract (Backend — no changes needed)

**Login**: `POST /auth/login` → returns:

```json
{
  "success": true,
  "data": {
    "token": "<access_token>",
    "refreshToken": "<refresh_token>",
    "expiresAt": "<iso_string>",
    "user": { ... }
  }
}
```

**Refresh**: `POST /auth/refresh` with `X-Refresh-Token: <refreshToken>` header → returns same shape as login.

**Important**: The customer-app currently parses the login response as `data.data.tokens.accessToken` / `data.data.tokens.refreshToken` (lines 51-52 of customer auth store). The actual API returns `data.data.token` / `data.data.refreshToken`. This is an existing bug in the customer-app login that will be fixed as part of this work.

- Access token: JWT with `exp` claim
- Refresh token: opaque string, longer-lived

## Solution Overview

```
┌─────────────────────────────────────────────────────┐
│              Token Lifecycle (per app)               │
│                                                      │
│  Login → Store access + refresh token in localStorage│
│    ↓                                                 │
│  Proactive: decode JWT exp, schedule refresh at 80%  │
│    ↓                                                 │
│  Timer fires → call /auth/refresh with header        │
│    ↓ success: update tokens, reschedule timer        │
│    ↓ failure: degrade to reactive mode               │
│                                                      │
│  Reactive: 401 interceptor                           │
│    ↓ first 401 → start refresh, queue other requests │
│    ↓ refresh ok → retry all queued requests          │
│    ↓ refresh fail → redirect to /login               │
│                                                      │
│  SSE reconnect → getValidToken() before connect      │
│                                                      │
│  App init → checkAuth() attempts refresh if expired  │
└─────────────────────────────────────────────────────┘
```

## Detailed Design

### 1. Shared Token Utilities

**New file**: `packages/utils/src/token.ts`

Placed in `packages/utils/` which already has a build pipeline (tsconfig, package.json, exports). Pure functions with no Vue dependency:

```typescript
// Decode JWT payload without external library.
// Returns null if token is malformed (invalid base64, not valid JSON, missing segments).
function decodeJwtPayload(
  token: string,
): { exp: number; iat: number; [key: string]: unknown } | null;

// Check if token is expired (with optional buffer in seconds, default 0).
// Returns true if token is malformed or expired.
function isTokenExpired(token: string, bufferSeconds?: number): boolean;

// Get milliseconds until token should be refreshed (at 80% of lifetime).
// Returns null if token is malformed or already expired.
function getRefreshDelay(token: string): number | null;

// Get milliseconds until token expires.
// Returns null if token is malformed.
function getTimeUntilExpiry(token: string): number | null;
```

**Error behavior**: `decodeJwtPayload` returns `null` on any malformed input. All other functions treat `null` payload as "expired/invalid" — this is the safe default (triggers refresh or login redirect rather than silently using a bad token).

**Source of truth for timing**: We use the JWT `exp` claim (not the `expiresAt` response field) because the timer needs the exact server-issued expiry embedded in the token itself.

### 2. Admin Dashboard Changes

#### 2a. `stores/auth.ts`

- **Login**: Save `refreshToken` to `localStorage('auth_refresh_token')` and reactive ref
- **refreshToken()**: Send `X-Refresh-Token` header; save new refresh token on success; reschedule proactive timer
- **checkAuth()**: On 401, attempt refresh before logging out
- **Proactive timer**: After login/refresh success, schedule next refresh using `getRefreshDelay()`
- **logout()**: Clear refresh token from localStorage, clear proactive timer

#### 2b. `services/api.ts`

- **Refresh queue**: Single `refreshPromise` variable. First 401 creates the promise; subsequent 401s await it.
- **401 interceptor**: Read refresh token from localStorage, send via `X-Refresh-Token` header
- **On refresh success**: Update localStorage (both tokens), update Authorization header, retry original request
- **On refresh failure**: Clear tokens, redirect to `/login`

```typescript
// Refresh queue pattern
private refreshPromise: Promise<string | null> | null = null;

private async handleTokenRefresh(): Promise<string | null> {
  if (this.refreshPromise) return this.refreshPromise;

  this.refreshPromise = this.doRefresh();
  try {
    return await this.refreshPromise;
  } finally {
    this.refreshPromise = null;
  }
}
```

#### 2c. `composables/useSSE.ts`

- **Before connect/reconnect**: Check token expiry via `isTokenExpired()`
- **If expired**: Call `authStore.refreshToken()` first, then connect with fresh token
- **On auth error (401 from SSE)**: Trigger refresh, then reconnect (not just retry with same token)

#### 2d. `router/index.ts`

- **beforeEach**: If token exists but is expired (within 30s buffer), attempt proactive refresh before navigation
- **If refresh fails**: Redirect to `/login`

### 3. Customer App Changes

#### 3a. `stores/auth.ts`

- **Login parsing fix**: Change `data.data.tokens.accessToken` → `data.data.token` and `data.data.tokens.refreshToken` → `data.data.refreshToken` to match actual API response
- **refresh()**: Change from sending refresh token in body to `X-Refresh-Token` header:

  ```typescript
  // Before (broken):
  body: JSON.stringify({ refreshToken: refreshToken.value })

  // After (fixed):
  headers: { 'X-Refresh-Token': refreshToken.value }
  ```

- **checkAuth()**: On failure, attempt refresh before logout
- **Proactive timer**: Schedule refresh after login/refresh success
- **Add 401 handling**: Wrap all `fetch()` calls through a helper that catches 401 and triggers refresh with queue pattern (since customer-app has no axios interceptor, implement a lightweight `fetchWithAuth()` wrapper)

#### 3b. WebSocket connections (out of scope for this fix)

The customer-app has WebSocket composables (`useWebSocket.ts`, `useOptimizedWebSocket.ts`, `useRealtimeNotifications.ts`). These use the Durable Objects WebSocket endpoint which has its own JWT auth via the realtime auth token endpoint (`POST /realtime/auth/token`). This is a separate auth flow from the main access token and is **out of scope** — the realtime auth token is short-lived (5 min) and re-requested on each connection via the main access token. Once the main access token refresh works, the realtime token generation will also work.

### 4. Kitchen Display Changes

#### 4a. `stores/auth.ts`

- **login()**: Save `refreshToken` from login response to `localStorage('kitchen_refresh_token')` and reactive ref
- **refreshToken()**: Delegate to fixed `authApi.refreshToken()`, save new refresh token
- **Proactive timer**: Schedule refresh after login/refresh success
- **logout()**: Clear refresh token, clear timer
- **checkAuth()**: Use `isTokenExpired()` to check before attempting refresh (currently it always calls refresh on every checkAuth which is wasteful)

#### 4b. `services/authApi.ts`

- **login()**: Return `refreshToken` from response so store can save it
- **refreshToken()**: Read refresh token from localStorage, send via `X-Refresh-Token` header
- **401 interceptor**: Use refresh queue pattern; send `X-Refresh-Token` header

#### 4c. `services/sseService.ts`

- **connect()**: Pass token in URL query param (currently reads token but doesn't use it in the URL)
- **scheduleReconnect()**: Read fresh token from localStorage on each reconnect; if expired, trigger refresh first
- Fix: `const url = \`/api/v1/kitchen/${restaurantId}/events?token=${encodeURIComponent(token)}\``

### 5. Proactive Refresh Timer (all apps)

Implemented in each app's auth store (not shared, since each app has different store structure):

```typescript
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleProactiveRefresh(accessToken: string) {
  if (refreshTimer) clearTimeout(refreshTimer);

  const delay = getRefreshDelay(accessToken);
  if (!delay || delay <= 0) return;

  refreshTimer = setTimeout(async () => {
    const success = await refreshToken();
    if (!success) {
      // Degrade to reactive mode — interceptor will handle 401
      console.warn("Proactive refresh failed, falling back to reactive mode");
    }
  }, delay);
}

function clearRefreshTimer() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}
```

Called after: login success, refresh success.
Cleared on: logout, auth failure.

### 6. Tab Visibility (known limitation)

If a tab is hidden for a long time and the proactive timer fires during inactivity, `setTimeout` may be delayed by the browser. When the tab becomes visible again, the timer will fire immediately (catching up). If the token has already expired during hidden state, the proactive refresh will fail and degrade to reactive mode — the next API call will trigger the 401 interceptor which will attempt refresh. This is acceptable behavior for Plan B.

### 7. Concurrent Tabs (known limitation)

Multiple open tabs will independently schedule proactive refreshes. Since refresh tokens are not single-use (no rotation in Plan B), this is safe — each tab will get a new access token. The refresh token remains valid. This becomes a concern in Plan C when refresh token rotation is added.

## Files Changed

### New Files

| File                                         | Purpose                                      |
| -------------------------------------------- | -------------------------------------------- |
| `packages/utils/src/token.ts`                | JWT decode, expiry check, refresh delay calc |
| `packages/utils/src/__tests__/token.test.ts` | Unit tests for token utilities               |

### Modified Files

| File                                              | Changes                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| `packages/utils/src/index.ts`                     | Export new token utilities                                               |
| `apps/admin-dashboard/src/stores/auth.ts`         | Store refresh token, proactive timer, fix refreshToken()                 |
| `apps/admin-dashboard/src/services/api.ts`        | Refresh queue, X-Refresh-Token header                                    |
| `apps/admin-dashboard/src/composables/useSSE.ts`  | Get fresh token before reconnect                                         |
| `apps/admin-dashboard/src/router/index.ts`        | Token expiry check in beforeEach                                         |
| `apps/customer-app/src/stores/auth.ts`            | Fix login parsing, fix refresh header, add 401 handling, proactive timer |
| `apps/kitchen-display/src/stores/auth.ts`         | Store refresh token, proactive timer, fix checkAuth                      |
| `apps/kitchen-display/src/services/authApi.ts`    | Store refresh token, fix refreshToken(), refresh queue                   |
| `apps/kitchen-display/src/services/sseService.ts` | Pass token in URL, fresh token on reconnect                              |

### Not Changed

- **API backend** — no changes needed, existing contract is correct
- **Onboarding app** — uses phone verification flow, not JWT session
- **Customer app WebSocket composables** — use separate realtime auth token flow (see Section 3b)
- **Kitchen display router** — has no `beforeEach` guard; auth is checked at component mount via `checkAuth()` in `stores/auth.ts` which is already called. Adding a router guard is out of scope for this fix.

## Testing Strategy

- **Unit tests**: `packages/utils/src/__tests__/token.test.ts` — decode valid/invalid/malformed JWT, expiry check with buffer, refresh delay calculation, edge cases (missing exp, expired tokens)
- **Manual verification**:
  1. Login → wait for proactive refresh → confirm no 401s in Network tab
  2. Delete `auth_token` from localStorage → next API call triggers reactive refresh → confirm auto-recovery
  3. SSE disconnect → confirm reconnect uses fresh token
  4. Close tab overnight → reopen → confirm auto-refresh or redirect to login (not stuck on 401 loop)

## Out of Scope

- httpOnly cookie storage (Plan C — for payment integration phase)
- Refresh token rotation (Plan C)
- CSRF changes (Plan C)
- Analytics SSE auth fix (separate issue — EventSource cannot send custom headers; needs different auth pattern)
- Customer app WebSocket auth (uses separate realtime auth token flow)
- Kitchen display router guard (auth checked at component mount)
- Tab visibility listener (`visibilitychange`) — acceptable degradation to reactive mode
- Cross-tab coordination (`BroadcastChannel`) — not needed until refresh token rotation in Plan C
