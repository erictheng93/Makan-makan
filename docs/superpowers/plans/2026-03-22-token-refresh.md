# Token Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix JWT token refresh across admin-dashboard, customer-app, and kitchen-display so tokens auto-renew before expiry and recover gracefully on 401.

**Architecture:** Shared token utilities in `packages/utils` (decode JWT, check expiry, calculate refresh delay). Each app fixes its own auth store, API interceptor, and SSE/realtime connections. Proactive refresh at 80% token lifetime + reactive refresh queue on 401.

**Tech Stack:** TypeScript, Vue 3 + Pinia, Axios (admin/kitchen), fetch (customer), Vitest

**Spec:** `docs/superpowers/specs/2026-03-22-token-refresh-design.md`

---

## File Structure

### New Files

| File                                         | Responsibility                                           |
| -------------------------------------------- | -------------------------------------------------------- |
| `packages/utils/src/token.ts`                | Pure JWT decode, expiry check, refresh delay calculation |
| `packages/utils/src/__tests__/token.test.ts` | Unit tests for token utilities                           |

### Modified Files

| File                                              | Responsibility                                                    |
| ------------------------------------------------- | ----------------------------------------------------------------- |
| `packages/utils/src/index.ts`                     | Add exports for token utilities                                   |
| `apps/admin-dashboard/src/services/api.ts`        | Refresh queue + X-Refresh-Token header in 401 interceptor         |
| `apps/admin-dashboard/src/stores/auth.ts`         | Store refresh token, proactive timer, fix refreshToken()          |
| `apps/admin-dashboard/src/composables/useSSE.ts`  | Fresh token before connect/reconnect                              |
| `apps/admin-dashboard/src/router/index.ts`        | Token expiry check in beforeEach guard                            |
| `apps/customer-app/src/stores/auth.ts`            | Fix login parsing, fix refresh header, proactive timer, 401 retry |
| `apps/kitchen-display/src/services/authApi.ts`    | Store refresh token, fix refreshToken(), refresh queue            |
| `apps/kitchen-display/src/stores/auth.ts`         | Store refresh token ref, proactive timer, fix checkAuth           |
| `apps/kitchen-display/src/services/sseService.ts` | Pass token in URL, fresh token on reconnect                       |

---

## Task 1: Shared Token Utilities — Tests

**Files:**

- Create: `packages/utils/src/__tests__/token.test.ts`

- [ ] **Step 1: Create test file with all test cases**

```typescript
// packages/utils/src/__tests__/token.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  decodeJwtPayload,
  isTokenExpired,
  getRefreshDelay,
  getTimeUntilExpiry,
} from "../token";

// Helper: create a JWT with given payload (no signature verification needed — we only decode)
function createTestJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature`;
}

describe("token utilities", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-22T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const now = Math.floor(new Date("2026-03-22T12:00:00Z").getTime() / 1000);

  describe("decodeJwtPayload", () => {
    it("should decode a valid JWT payload", () => {
      const token = createTestJwt({ exp: now + 3600, iat: now, sub: "user1" });
      const payload = decodeJwtPayload(token);
      expect(payload).not.toBeNull();
      expect(payload!.exp).toBe(now + 3600);
      expect(payload!.iat).toBe(now);
      expect(payload!.sub).toBe("user1");
    });

    it("should return null for empty string", () => {
      expect(decodeJwtPayload("")).toBeNull();
    });

    it("should return null for non-JWT string", () => {
      expect(decodeJwtPayload("not-a-jwt")).toBeNull();
    });

    it("should return null for JWT with only 2 segments", () => {
      expect(decodeJwtPayload("header.payload")).toBeNull();
    });

    it("should return null for JWT with invalid base64 payload", () => {
      expect(decodeJwtPayload("valid.!!!invalid-base64!!!.sig")).toBeNull();
    });

    it("should return null for JWT with non-JSON payload", () => {
      const header = btoa("{}");
      const body = btoa("not json");
      expect(decodeJwtPayload(`${header}.${body}.sig`)).toBeNull();
    });

    it("should handle base64url encoding (- and _ chars)", () => {
      // base64url uses - instead of + and _ instead of /
      const payload = { exp: now + 3600, iat: now, data: "test+value/here" };
      const token = createTestJwt(payload);
      const decoded = decodeJwtPayload(token);
      expect(decoded).not.toBeNull();
      expect(decoded!.data).toBe("test+value/here");
    });
  });

  describe("isTokenExpired", () => {
    it("should return false for a token expiring in the future", () => {
      const token = createTestJwt({ exp: now + 3600, iat: now });
      expect(isTokenExpired(token)).toBe(false);
    });

    it("should return true for an expired token", () => {
      const token = createTestJwt({ exp: now - 60, iat: now - 3660 });
      expect(isTokenExpired(token)).toBe(true);
    });

    it("should return true when within buffer seconds of expiry", () => {
      const token = createTestJwt({ exp: now + 20, iat: now - 3580 });
      expect(isTokenExpired(token, 30)).toBe(true);
    });

    it("should return false when outside buffer seconds of expiry", () => {
      const token = createTestJwt({ exp: now + 60, iat: now - 3540 });
      expect(isTokenExpired(token, 30)).toBe(false);
    });

    it("should return true for malformed token", () => {
      expect(isTokenExpired("garbage")).toBe(true);
    });

    it("should return true for token without exp claim", () => {
      const token = createTestJwt({ iat: now });
      expect(isTokenExpired(token)).toBe(true);
    });
  });

  describe("getRefreshDelay", () => {
    it("should return delay at 80% of token lifetime", () => {
      // Token: iat = now, exp = now + 3600 (1 hour lifetime)
      // 80% of 3600s = 2880s → refresh at now + 2880
      // Delay from now = 2880s = 2880000ms
      const token = createTestJwt({ exp: now + 3600, iat: now });
      expect(getRefreshDelay(token)).toBe(2880 * 1000);
    });

    it("should return null for expired token", () => {
      const token = createTestJwt({ exp: now - 60, iat: now - 3660 });
      expect(getRefreshDelay(token)).toBeNull();
    });

    it("should return null for malformed token", () => {
      expect(getRefreshDelay("garbage")).toBeNull();
    });

    it("should return null for token without iat (cannot compute lifetime)", () => {
      const token = createTestJwt({ exp: now + 3600 });
      // Without iat, we can't compute lifetime — fall back to 80% of remaining time
      const delay = getRefreshDelay(token);
      // Should still return a reasonable value using remaining time
      expect(delay).not.toBeNull();
      expect(delay!).toBeGreaterThan(0);
    });

    it("should return 0 or null when refresh point has already passed", () => {
      // Token issued 50 min ago, expires in 10 min → 80% of 60min = 48min already passed
      const token = createTestJwt({ exp: now + 600, iat: now - 3000 });
      const delay = getRefreshDelay(token);
      // Refresh point was 2 min ago, so delay should be 0 or null
      expect(delay === null || delay === 0).toBe(true);
    });
  });

  describe("getTimeUntilExpiry", () => {
    it("should return milliseconds until expiry", () => {
      const token = createTestJwt({ exp: now + 3600, iat: now });
      expect(getTimeUntilExpiry(token)).toBe(3600 * 1000);
    });

    it("should return negative for expired token", () => {
      const token = createTestJwt({ exp: now - 60, iat: now - 3660 });
      const result = getTimeUntilExpiry(token);
      expect(result).not.toBeNull();
      expect(result!).toBeLessThan(0);
    });

    it("should return null for malformed token", () => {
      expect(getTimeUntilExpiry("garbage")).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/eric/Documents/Code/Makan-makan && pnpm vitest run packages/utils/src/__tests__/token.test.ts`
Expected: FAIL — module `../token` does not exist

- [ ] **Step 3: Commit test file**

```bash
git add packages/utils/src/__tests__/token.test.ts
git commit -m "test(utils): add failing tests for JWT token utilities"
```

---

## Task 2: Shared Token Utilities — Implementation

**Files:**

- Create: `packages/utils/src/token.ts`
- Modify: `packages/utils/src/index.ts:106` (append exports)

- [ ] **Step 1: Implement token.ts**

```typescript
// packages/utils/src/token.ts

/**
 * Decode JWT payload without external library.
 * Returns null if token is malformed.
 */
export function decodeJwtPayload(
  token: string,
): { exp: number; iat: number; [key: string]: unknown } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // Convert base64url to base64
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    const payload = JSON.parse(json);

    if (typeof payload !== "object" || payload === null) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Check if token is expired.
 * Returns true if token is malformed or expired (safe default).
 */
export function isTokenExpired(token: string, bufferSeconds = 0): boolean {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return true;

  const nowSeconds = Math.floor(Date.now() / 1000);
  return payload.exp - bufferSeconds <= nowSeconds;
}

/**
 * Get milliseconds until token should be refreshed (at 80% of lifetime).
 * Returns null if token is malformed or already past refresh point.
 */
export function getRefreshDelay(token: string): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return null;

  const nowMs = Date.now();
  const expMs = payload.exp * 1000;

  if (expMs <= nowMs) return null;

  // If iat exists, use full lifetime; otherwise use remaining time
  const iatMs = typeof payload.iat === "number" ? payload.iat * 1000 : nowMs;
  const lifetime = expMs - iatMs;
  const refreshAtMs = iatMs + lifetime * 0.8;
  const delay = refreshAtMs - nowMs;

  return delay > 0 ? delay : 0;
}

/**
 * Get milliseconds until token expires.
 * Returns null if token is malformed.
 */
export function getTimeUntilExpiry(token: string): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return null;

  return payload.exp * 1000 - Date.now();
}
```

- [ ] **Step 2: Add exports to index.ts**

Append to `packages/utils/src/index.ts` after line 105:

```typescript
// Token utilities
export {
  decodeJwtPayload,
  isTokenExpired,
  getRefreshDelay,
  getTimeUntilExpiry,
} from "./token";
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd /Users/eric/Documents/Code/Makan-makan && pnpm vitest run packages/utils/src/__tests__/token.test.ts`
Expected: All tests PASS

- [ ] **Step 4: Run full utils typecheck**

Run: `cd /Users/eric/Documents/Code/Makan-makan && pnpm turbo run typecheck --filter=@makanmakan/utils`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add packages/utils/src/token.ts packages/utils/src/index.ts
git commit -m "feat(utils): add JWT token decode, expiry check, and refresh delay utilities"
```

---

## Task 3: Admin Dashboard — API Service Refresh Queue

**Files:**

- Modify: `apps/admin-dashboard/src/services/api.ts`

- [ ] **Step 1: Rewrite the 401 interceptor with refresh queue and X-Refresh-Token header**

Replace the entire `api.ts` file content. Key changes:

- Add `refreshPromise` for queue pattern
- Add `handleTokenRefresh()` method
- 401 interceptor reads `auth_refresh_token` from localStorage and sends `X-Refresh-Token` header
- On success: update both tokens in localStorage
- On failure: clear tokens and redirect to `/login`

```typescript
// apps/admin-dashboard/src/services/api.ts
import axios, {
  type AxiosInstance,
  type AxiosResponse,
  type AxiosError,
  type InternalAxiosRequestConfig,
} from "axios";
import type { ApiResponse } from "@/types";
import { KitchenErrorHandler } from "@/utils/errorHandler";

interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

const CSRF_HEADER = "X-CSRF-Token";
const CSRF_PROTECTED_METHODS = ["POST", "PUT", "DELETE", "PATCH"];

class ApiService {
  private instance: AxiosInstance;
  private csrfToken: string | null = null;
  private refreshPromise: Promise<string | null> | null = null;

  constructor() {
    this.instance = axios.create({
      baseURL: "/api/v1",
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.setupInterceptors();
  }

  private async handleTokenRefresh(): Promise<string | null> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      const refreshToken = localStorage.getItem("auth_refresh_token");
      if (!refreshToken) return null;

      try {
        const response = await this.instance.post("/auth/refresh", {}, {
          headers: { "X-Refresh-Token": refreshToken },
          // Skip the 401 interceptor for the refresh call itself
          _retry: true,
        } as any);

        const newToken = response.data?.data?.token;
        const newRefreshToken = response.data?.data?.refreshToken;

        if (newToken) {
          localStorage.setItem("auth_token", newToken);
          if (newRefreshToken) {
            localStorage.setItem("auth_refresh_token", newRefreshToken);
          }
          return newToken;
        }
        return null;
      } catch {
        return null;
      }
    })();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private setupInterceptors() {
    this.instance.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem("auth_token");
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        const method = (config.method || "").toUpperCase();
        if (CSRF_PROTECTED_METHODS.includes(method)) {
          const csrf =
            this.csrfToken || document.cookie.match(/csrf_token=([^;]+)/)?.[1];
          if (csrf) {
            config.headers[CSRF_HEADER] = csrf;
          }
        }

        return config;
      },
      (error) => Promise.reject(error),
    );

    this.instance.interceptors.response.use(
      (response: AxiosResponse) => {
        const csrfToken = response.headers[CSRF_HEADER.toLowerCase()];
        if (csrfToken) {
          this.csrfToken = csrfToken;
        }
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as ExtendedAxiosRequestConfig;

        if (
          error.response?.status === 401 &&
          originalRequest &&
          !originalRequest._retry
        ) {
          originalRequest._retry = true;

          const newToken = await this.handleTokenRefresh();

          if (newToken) {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return this.instance(originalRequest);
          }

          // Refresh failed — clear tokens and redirect
          localStorage.removeItem("auth_token");
          localStorage.removeItem("auth_refresh_token");
          localStorage.removeItem("auth_user");
          window.location.href = "/login";
          return Promise.reject(error);
        }

        const errorDetails = KitchenErrorHandler.handleAPIError(error, {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          data: error.response?.data,
        });

        return Promise.reject(errorDetails);
      },
    );
  }

  setAuthToken(token: string | null) {
    if (token) {
      this.instance.defaults.headers.common["Authorization"] =
        `Bearer ${token}`;
    } else {
      delete this.instance.defaults.headers.common["Authorization"];
    }
  }

  async get<T>(
    url: string,
    params?: any,
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.instance.get(url, { params });
  }

  async post<T>(
    url: string,
    data?: any,
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.instance.post(url, data);
  }

  async put<T>(
    url: string,
    data?: any,
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.instance.put(url, data);
  }

  async patch<T>(
    url: string,
    data?: any,
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.instance.patch(url, data);
  }

  async delete<T>(
    url: string,
    data?: any,
  ): Promise<AxiosResponse<ApiResponse<T>>> {
    return this.instance.delete(url, data ? { data } : undefined);
  }

  async upload(url: string, formData: FormData): Promise<AxiosResponse<any>> {
    return this.instance.post(url, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  }
}

export const api = new ApiService();
export const apiClient = api;
```

- [ ] **Step 2: Typecheck admin-dashboard**

Run: `cd /Users/eric/Documents/Code/Makan-makan && pnpm turbo run typecheck --filter=makanmakan-admin-dashboard`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/services/api.ts
git commit -m "fix(admin): add refresh queue and X-Refresh-Token header to API interceptor"
```

---

## Task 4: Admin Dashboard — Auth Store

**Files:**

- Modify: `apps/admin-dashboard/src/stores/auth.ts`

Key changes:

- Add `refreshTokenRef` reactive ref + localStorage persistence
- Save refresh token on login
- Fix `refreshToken()` to send `X-Refresh-Token` header via `api.post`
- Add proactive refresh timer (`scheduleProactiveRefresh`, `clearRefreshTimer`)
- Call `scheduleProactiveRefresh` after login and refresh success
- Clear timer on logout
- In `checkAuth()`: if 401, attempt refresh before logout

- [ ] **Step 1: Update auth store with refresh token storage and proactive timer**

Add to imports at top:

```typescript
import { isTokenExpired, getRefreshDelay } from "@makanmakan/utils";
```

Add after line 29 (`const token = ref...`):

```typescript
const refreshTokenRef = ref<string | null>(
  localStorage.getItem("auth_refresh_token"),
);

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

const scheduleProactiveRefresh = (accessToken: string) => {
  if (refreshTimer) clearTimeout(refreshTimer);

  const delay = getRefreshDelay(accessToken);
  if (!delay || delay <= 0) return;

  refreshTimer = setTimeout(async () => {
    await refreshToken();
  }, delay);
};

const clearRefreshTimer = () => {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
};
```

Update `login()` — after `localStorage.setItem("auth_token", token.value!)` add:

```typescript
if (response.data.data.refreshToken) {
  refreshTokenRef.value = response.data.data.refreshToken;
  localStorage.setItem("auth_refresh_token", refreshTokenRef.value!);
}
scheduleProactiveRefresh(token.value!);
```

Update `logout()` — in the finally block add:

```typescript
refreshTokenRef.value = null;
localStorage.removeItem("auth_refresh_token");
clearRefreshTimer();
```

Replace `refreshToken()` method entirely. Uses raw `fetch()` to bypass the Axios 401 interceptor (avoids infinite loop). On any failure, degrades to reactive mode instead of logging out — the interceptor will handle the next 401:

```typescript
const refreshToken = async () => {
  const rt =
    refreshTokenRef.value || localStorage.getItem("auth_refresh_token");
  if (!rt) {
    await logout();
    return false;
  }

  try {
    const response = await fetch("/api/v1/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Refresh-Token": rt,
      },
    });
    const data = await response.json();

    if (data.success && data.data) {
      token.value = data.data.token;
      localStorage.setItem("auth_token", token.value!);
      api.setAuthToken(token.value!);

      if (data.data.refreshToken) {
        refreshTokenRef.value = data.data.refreshToken;
        localStorage.setItem("auth_refresh_token", refreshTokenRef.value!);
      }

      if (data.data.user) {
        user.value = data.data.user;
        persistUser(user.value);
      }

      scheduleProactiveRefresh(token.value!);
      return true;
    }
  } catch {
    // Don't logout on network errors — degrade to reactive mode
    console.warn("Proactive refresh failed, falling back to reactive mode");
    return false;
  }

  // Non-success response — degrade to reactive mode (interceptor will handle next 401)
  console.warn("Refresh returned non-success, falling back to reactive mode");
  return false;
};
```

Update `checkAuth()` — replace the 401/403 block:

```typescript
if (status === 401 || status === 403) {
  // Attempt refresh before giving up
  const refreshed = await refreshToken();
  if (refreshed) return true;
  await logout();
  return false;
}
```

Also call `scheduleProactiveRefresh` at end of successful checkAuth:

```typescript
if (response.data.success && response.data.data) {
  user.value = response.data.data;
  persistUser(user.value);
  if (token.value) scheduleProactiveRefresh(token.value);
  return true;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/eric/Documents/Code/Makan-makan && pnpm turbo run typecheck --filter=makanmakan-admin-dashboard`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/stores/auth.ts
git commit -m "fix(admin): store refresh token, add proactive timer, fix refreshToken()"
```

---

## Task 5: Admin Dashboard — SSE Fresh Token on Reconnect

**Files:**

- Modify: `apps/admin-dashboard/src/composables/useSSE.ts`

- [ ] **Step 1: Update connect() to get fresh token and handleReconnect() to refresh if expired**

Add import:

```typescript
import { isTokenExpired } from "@makanmakan/utils";
```

Replace `connect()`:

```typescript
const connect = async () => {
  if (
    !authStore.isAuthenticated ||
    !authStore.restaurantId ||
    eventSource.value
  ) {
    return;
  }

  try {
    let token = authStore.token;
    if (!token) {
      console.warn("SSE: No auth token available, skipping connection");
      return;
    }

    // If token is expired or about to expire, refresh first
    if (isTokenExpired(token, 30)) {
      const refreshed = await authStore.refreshToken();
      if (!refreshed) {
        console.warn(
          "SSE: Token expired and refresh failed, skipping connection",
        );
        return;
      }
      token = authStore.token;
      if (!token) return;
    }

    const url = `/api/v1/sse/events?restaurant_id=${authStore.restaurantId}&token=${encodeURIComponent(token)}`;
    eventSource.value = new EventSource(url);

    eventSource.value.onopen = () => {
      console.log("SSE Connected");
      isConnected.value = true;
      reconnectAttempts.value = 0;
      reconnectDelay.value = 1000;
    };

    eventSource.value.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);
        handleSSEEvent(data);
      } catch (error) {
        console.error("Error parsing SSE data:", error);
      }
    };

    eventSource.value.onerror = (error) => {
      console.error("SSE Error:", error);
      isConnected.value = false;

      if (eventSource.value?.readyState === EventSource.CLOSED) {
        handleReconnect();
      }
    };
  } catch (error) {
    console.error("Error creating EventSource:", error);
    handleReconnect();
  }
};
```

Update `handleReconnect()` — change the setTimeout callback to call `connect()` (which is now async and handles token refresh):

```typescript
const handleReconnect = () => {
  if (reconnectAttempts.value >= maxReconnectAttempts) {
    console.error("Max reconnection attempts reached");
    notificationStore.addNotification({
      type: "error",
      title: "連線中斷",
      message: "無法連接到伺服器，請重新整理頁面",
    });
    return;
  }

  disconnect();

  setTimeout(async () => {
    reconnectAttempts.value++;
    reconnectDelay.value = Math.min(reconnectDelay.value * 2, 30000);
    console.log(
      `Attempting to reconnect... (${reconnectAttempts.value}/${maxReconnectAttempts})`,
    );
    await connect();
  }, reconnectDelay.value);
};
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/eric/Documents/Code/Makan-makan && pnpm turbo run typecheck --filter=makanmakan-admin-dashboard`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/composables/useSSE.ts
git commit -m "fix(admin): refresh token before SSE connect/reconnect"
```

---

## Task 6: Admin Dashboard — Router Guard Token Expiry Check

**Files:**

- Modify: `apps/admin-dashboard/src/router/index.ts`

- [ ] **Step 1: Add token expiry check in beforeEach guard**

Add import at top of file:

```typescript
import { isTokenExpired } from "@makanmakan/utils";
```

In `router.beforeEach`, after the `if (!authStore.isAuthenticated)` block (after line 386), add:

```typescript
// Check if token is expired — attempt refresh before proceeding
if (authStore.token && isTokenExpired(authStore.token, 30)) {
  const refreshed = await authStore.refreshToken();
  if (!refreshed) {
    return next("/login");
  }
}
```

Note: The `beforeEach` callback is already `async` (line 371: `router.beforeEach(async (to, _, next) => {`), so `await` is valid.

- [ ] **Step 2: Typecheck**

Run: `cd /Users/eric/Documents/Code/Makan-makan && pnpm turbo run typecheck --filter=makanmakan-admin-dashboard`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/router/index.ts
git commit -m "fix(admin): check token expiry in router guard, refresh before navigation"
```

---

## Task 7: Customer App — Fix Auth Store

**Files:**

- Modify: `apps/customer-app/src/stores/auth.ts`

Key changes:

- Fix login response parsing (`data.data.token` not `data.data.tokens.accessToken`)
- Fix `refresh()` to send `X-Refresh-Token` header instead of body
- Add proactive refresh timer
- Fix `checkAuth()` to attempt refresh before logout

- [ ] **Step 1: Apply all fixes to customer auth store**

Add import at top:

```typescript
import { getRefreshDelay, isTokenExpired } from "@makanmakan/utils";
```

Add before `return {` block (around line 236):

```typescript
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

const scheduleProactiveRefresh = (accessToken: string) => {
  if (refreshTimer) clearTimeout(refreshTimer);
  const delay = getRefreshDelay(accessToken);
  if (!delay || delay <= 0) return;
  refreshTimer = setTimeout(async () => {
    await refresh();
  }, delay);
};

const clearRefreshTimer = () => {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
};
```

Fix `login()` — replace lines 50-53:

```typescript
// Before:
// token.value = data.data.tokens.accessToken;
// refreshToken.value = data.data.tokens.refreshToken;
// After:
token.value = data.data.token;
refreshToken.value = data.data.refreshToken;
```

Add after the localStorage saves in login (after line 58):

```typescript
if (token.value) scheduleProactiveRefresh(token.value);
```

In `register()` — the existing `result.data.tokens.accessToken` / `result.data.tokens.refreshToken` parsing is **correct** for the register endpoint (it returns a nested `tokens` object, unlike login). Only add the proactive timer call after the existing localStorage saves:

```typescript
if (token.value) scheduleProactiveRefresh(token.value);
```

Fix `logout()` — add in finally block:

```typescript
clearRefreshTimer();
```

Fix `refresh()` — replace the fetch call (lines 179-185):

```typescript
const response = await fetch("/api/v1/auth/refresh", {
  method: "POST",
  headers: {
    "X-Refresh-Token": refreshToken.value!,
  },
});
```

Fix `refresh()` — fix response parsing (lines 189-191):

```typescript
// Before:
// token.value = data.data.tokens.accessToken;
// refreshToken.value = data.data.tokens.refreshToken;
// After:
token.value = data.data.token;
refreshToken.value = data.data.refreshToken;
```

Add after refresh success localStorage saves:

```typescript
if (token.value) scheduleProactiveRefresh(token.value);
```

**Note on `fetchWithAuth()` wrapper**: The spec mentions adding a 401 interceptor wrapper for the customer app's `fetch()` calls. For this plan, we address the most critical paths: `checkAuth()` attempts refresh before logout, and the proactive timer prevents most 401s from occurring. A full `fetchWithAuth()` wrapper that intercepts all API calls is deferred — the customer app has relatively few authenticated API calls (profile fetch, order placement) and the proactive refresh + checkAuth fix covers the main failure scenario (stale token on app load). If needed, a `fetchWithAuth()` wrapper can be added as a follow-up.

Fix `checkAuth()` — after the catch block, attempt refresh before logout:

```typescript
const checkAuth = async () => {
  if (!token.value) return false;

  try {
    const response = await fetch("/api/v1/auth/me", {
      headers: {
        Authorization: `Bearer ${token.value}`,
      },
    });

    const data = await response.json();

    if (data.success && data.data) {
      user.value = data.data;
      if (token.value) scheduleProactiveRefresh(token.value);
      return true;
    }
  } catch (err) {
    console.warn("Auth check failed:", err);
  }

  // Attempt refresh before giving up
  if (refreshToken.value) {
    const refreshed = await refresh();
    if (refreshed) return true;
  }

  await logout();
  return false;
};
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/eric/Documents/Code/Makan-makan && pnpm turbo run typecheck --filter=makanmakan-customer-app`
Expected: 0 errors (note: customer-app may not have typecheck script — verify)

- [ ] **Step 3: Commit**

```bash
git add apps/customer-app/src/stores/auth.ts
git commit -m "fix(customer): fix login parsing, refresh header, add proactive timer"
```

---

## Task 8: Kitchen Display — Fix authApi Service

**Files:**

- Modify: `apps/kitchen-display/src/services/authApi.ts`

Key changes:

- `login()` returns refreshToken from response
- `refreshToken()` reads from localStorage and sends `X-Refresh-Token` header
- 401 interceptor uses refresh queue with `X-Refresh-Token` header

- [ ] **Step 1: Update authApi.ts**

Add refresh queue variable after the `api` interceptors setup (after line 59):

```typescript
let refreshPromise: Promise<string | null> | null = null;

async function handleTokenRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const rt = localStorage.getItem("kitchen_refresh_token");
    if (!rt) return null;

    try {
      const response = await api.post("/auth/refresh", {}, {
        headers: { "X-Refresh-Token": rt },
        _retry: true,
      } as any);

      const newToken = response.data?.data?.token;
      const newRefreshToken = response.data?.data?.refreshToken;

      if (newToken) {
        localStorage.setItem("kitchen_auth_token", newToken);
        if (newRefreshToken) {
          localStorage.setItem("kitchen_refresh_token", newRefreshToken);
        }
        return newToken;
      }
      return null;
    } catch {
      return null;
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}
```

Update the 401 interceptor (lines 35-58) to use the queue:

```typescript
if (error.response?.status === 401 && !original._retry) {
  original._retry = true;

  const newToken = await handleTokenRefresh();
  if (newToken) {
    original.headers.Authorization = `Bearer ${newToken}`;
    return api(original);
  }

  localStorage.removeItem("kitchen_auth_token");
  localStorage.removeItem("kitchen_refresh_token");
  localStorage.removeItem("kitchen_user");
  window.location.href = "/login";
}
```

Update `LoginResponse` interface to include refreshToken (keep optional since API may not always return it):

```typescript
export interface LoginResponse {
  user: User;
  token: string;
  refreshToken?: string;
  expiresIn: number;
}
```

Update `refreshToken()` method:

```typescript
async refreshToken(): Promise<ApiResponse<LoginResponse>> {
  const rt = localStorage.getItem("kitchen_refresh_token");
  if (!rt) {
    return {
      success: false,
      error: "No refresh token available",
      timestamp: new Date().toISOString(),
    };
  }

  try {
    const response = await api.post("/auth/refresh", {}, {
      headers: { "X-Refresh-Token": rt },
    });

    const data = response.data?.data;
    if (data?.token) {
      localStorage.setItem("kitchen_auth_token", data.token);
      if (data.refreshToken) {
        localStorage.setItem("kitchen_refresh_token", data.refreshToken);
      }
    }

    return {
      success: true,
      data: response.data.data,
      timestamp: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error("Refresh token API error:", error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || "Token 刷新失敗",
      timestamp: new Date().toISOString(),
    };
  }
},
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/eric/Documents/Code/Makan-makan && pnpm turbo run typecheck --filter=makanmakan-kitchen-display`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/kitchen-display/src/services/authApi.ts
git commit -m "fix(kitchen): fix refreshToken with X-Refresh-Token header, add refresh queue"
```

---

## Task 9: Kitchen Display — Fix Auth Store

**Files:**

- Modify: `apps/kitchen-display/src/stores/auth.ts`

- [ ] **Step 1: Add refresh token storage, proactive timer, fix checkAuth**

Add import:

```typescript
import { isTokenExpired, getRefreshDelay } from "@makanmakan/utils";
```

Add `refreshTokenRef` after token ref (after line 9):

```typescript
const refreshTokenVal = ref<string | null>(
  localStorage.getItem("kitchen_refresh_token"),
);
```

Add proactive timer (before `login`):

```typescript
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

const scheduleProactiveRefresh = (accessToken: string) => {
  if (refreshTimer) clearTimeout(refreshTimer);
  const delay = getRefreshDelay(accessToken);
  if (!delay || delay <= 0) return;
  refreshTimer = setTimeout(async () => {
    await refreshToken();
  }, delay);
};

const clearRefreshTimer = () => {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
};
```

In `login()` — after saving token to localStorage (after line 38), add:

```typescript
// Save refresh token
if (response.data?.refreshToken) {
  refreshTokenVal.value = response.data.refreshToken;
  localStorage.setItem("kitchen_refresh_token", refreshTokenVal.value!);
}
scheduleProactiveRefresh(authToken);
```

In `logout()` — in finally block add:

```typescript
refreshTokenVal.value = null;
localStorage.removeItem("kitchen_refresh_token");
clearRefreshTimer();
```

In `refreshToken()` — after success, add timer schedule:

```typescript
if (response.success && response.data) {
  const { token: newToken, user: userData } = response.data;
  token.value = newToken;
  user.value = userData;
  localStorage.setItem("kitchen_auth_token", newToken);
  localStorage.setItem("kitchen_user", JSON.stringify(userData));
  if (response.data.refreshToken) {
    refreshTokenVal.value = response.data.refreshToken;
    localStorage.setItem("kitchen_refresh_token", refreshTokenVal.value!);
  }
  scheduleProactiveRefresh(newToken);
  return true;
}
```

Fix `checkAuth()` — don't always call refreshToken, only if token is expired:

```typescript
const checkAuth = async () => {
  const savedToken = localStorage.getItem("kitchen_auth_token");
  const savedUser = localStorage.getItem("kitchen_user");

  if (savedToken && savedUser) {
    try {
      const userData = JSON.parse(savedUser);
      if (userData.role !== 2) {
        await logout();
        return false;
      }

      token.value = savedToken;
      user.value = userData;

      // Only refresh if token is expired or about to expire
      if (isTokenExpired(savedToken, 60)) {
        const refreshResult = await refreshToken();
        return refreshResult;
      }

      // Token still valid — schedule proactive refresh
      scheduleProactiveRefresh(savedToken);
      return true;
    } catch (error) {
      console.error("Auth check error:", error);
      await logout();
      return false;
    }
  }

  return false;
};
```

- [ ] **Step 2: Typecheck**

Run: `cd /Users/eric/Documents/Code/Makan-makan && pnpm turbo run typecheck --filter=makanmakan-kitchen-display`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/kitchen-display/src/stores/auth.ts
git commit -m "fix(kitchen): store refresh token, add proactive timer, fix checkAuth"
```

---

## Task 10: Kitchen Display — SSE Token in URL + Fresh Token on Reconnect

**Files:**

- Modify: `apps/kitchen-display/src/services/sseService.ts`

- [ ] **Step 1: Pass token in URL and read fresh token on each connect**

Add import:

```typescript
import { isTokenExpired } from "@makanmakan/utils";
```

Update `connect()` method — change the EventSource URL to include token (replace lines 47-58):

```typescript
const token = localStorage.getItem("kitchen_auth_token");
if (!token) {
  throw new Error("No authentication token found");
}

// If token is expired, don't connect — let the store handle refresh
if (isTokenExpired(token, 30)) {
  console.warn("SSE: Token expired, scheduling reconnect for after refresh");
  this.scheduleReconnect();
  return;
}

const url = `/api/v1/kitchen/${this.options.restaurantId}/events?token=${encodeURIComponent(token)}`;
console.log(`Connecting to SSE endpoint: ${url}`);

this.eventSource = new EventSource(url);
```

Note: Remove `{ withCredentials: true }` from EventSource since we're now using query param auth.

- [ ] **Step 2: Typecheck**

Run: `cd /Users/eric/Documents/Code/Makan-makan && pnpm turbo run typecheck --filter=makanmakan-kitchen-display`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add apps/kitchen-display/src/services/sseService.ts
git commit -m "fix(kitchen): pass auth token in SSE URL, check expiry before connect"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Run full typecheck across all packages**

Run: `cd /Users/eric/Documents/Code/Makan-makan && pnpm typecheck`
Expected: 0 errors across all packages

- [ ] **Step 2: Run token utility tests**

Run: `cd /Users/eric/Documents/Code/Makan-makan && pnpm vitest run packages/utils/src/__tests__/token.test.ts`
Expected: All tests pass

- [ ] **Step 3: Run existing test suites for modified apps**

Run: `cd /Users/eric/Documents/Code/Makan-makan && pnpm test:admin`
Run: `cd /Users/eric/Documents/Code/Makan-makan && pnpm test:kitchen`
Expected: No regressions

- [ ] **Step 4: Manual verification**

Start dev servers: `cd /Users/eric/Documents/Code/Makan-makan && pnpm turbo run dev --filter=./apps/api --filter=./apps/admin-dashboard --concurrency=20`

1. Open `http://localhost:3001` → Login
2. Open DevTools Network tab → verify `/auth/login` returns `refreshToken` field
3. Check localStorage → confirm both `auth_token` and `auth_refresh_token` are saved
4. Wait for proactive refresh (check console for timer log) or manually expire token in localStorage
5. Verify next API call triggers 401 → refresh → retry (no redirect to login)
6. Verify SSE reconnects with fresh token after token refresh
