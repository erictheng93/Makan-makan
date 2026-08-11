# Unified Error Response Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate 5 different error response formats and 3 competing error handler utilities into one `ApiError` class + global error handler, so all API errors return `{ success: false, error: { code, message } }`.

**Architecture:** Create a throwable `ApiError` class with factory helpers. Rewrite the global `app.onError` to be the single formatter. Update middleware (auth, validation) to produce the unified shape directly. Delete/internalize unused utilities.

**Tech Stack:** Hono (Cloudflare Workers framework), Zod (validation), Vitest (testing), TypeScript

**Spec:** `docs/superpowers/specs/2026-03-14-unified-error-response-design.md`

**Scope Note:** This plan covers Phase 1 foundation: ApiError class, global handler, middleware alignment, utility cleanup, and 3 demo feature migrations (forecast, discovery, ingredients). The auth/realtime route migration (replacing `createSafeErrorResponse` and `zValidator`) is deferred to Phase 1.5 because it involves 27+ call sites across 800+ line route files — it is a separate plan-sized effort.

---

## File Structure

### New Files

- `apps/api/src/shared/utils/api-error.ts` — `ApiError` class + factory functions
- `apps/api/src/shared/utils/__tests__/api-error.test.ts` — Unit tests for ApiError
- `apps/api/src/middleware/__tests__/validation-error-format.test.ts` — Validation middleware error format tests
- `apps/api/src/middleware/__tests__/auth-error-format.test.ts` — Auth middleware error format tests

### Modified Files

- `apps/api/src/index.ts` — Global `onError` + `notFound` handlers
- `apps/api/src/middleware/validation.ts` — Unified error shape
- `apps/api/src/middleware/auth.ts` — Unified error shape with specific codes
- `apps/api/src/utils/errorSanitizer.ts` — Remove public convenience functions
- `apps/api/src/shared/utils/response.ts` — Remove error-related exports only
- `apps/api/src/features/orders/index.ts` — Remove feature-level `onError`
- `apps/api/src/features/authentication/index.ts` — Remove feature-level `onError`
- `apps/api/src/features/forecast/routes/index.ts` — Remove try-catch boilerplate
- `apps/api/src/features/discovery/routes/index.ts` — Remove try-catch boilerplate
- `apps/api/src/features/ingredients/routes/index.ts` — Remove try-catch boilerplate
- `packages/shared-types/src/common.ts` — Remove `meta` from `ApiResponse`
- `apps/admin-dashboard/src/utils/errorHandler.ts` — Simplify parsing

### Deleted Files

- `apps/api/src/shared/utils/error-handler.ts` — `FeatureErrorHandler` (0 users)

---

## Chunk 1: Foundation — ApiError Class + Global Handler

### Task 1: Create `ApiError` class with factory functions

**Files:**

- Create: `apps/api/src/shared/utils/api-error.ts`
- Create: `apps/api/src/shared/utils/__tests__/api-error.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/shared/utils/__tests__/api-error.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  ApiError,
  notFound,
  badRequest,
  unauthorized,
  forbidden,
  conflict,
} from "../api-error";

describe("ApiError", () => {
  it("should extend Error with code and status", () => {
    const err = new ApiError("TEST_CODE", "test message", 400);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("TEST_CODE");
    expect(err.message).toBe("test message");
    expect(err.status).toBe(400);
  });

  it("should default status to 500", () => {
    const err = new ApiError("CODE", "msg");
    expect(err.status).toBe(500);
  });

  it("should carry optional details", () => {
    const details = [{ field: "email", message: "required" }];
    const err = new ApiError("VALIDATION_ERROR", "Invalid", 400, details);
    expect(err.details).toEqual(details);
  });
});

describe("factory functions", () => {
  it("notFound defaults to 404", () => {
    const err = notFound();
    expect(err.status).toBe(404);
    expect(err.code).toBe("NOT_FOUND");
    expect(err.message).toBe("Resource not found");
  });

  it("notFound accepts custom message and code", () => {
    const err = notFound("Forecast not found", "FORECAST_NOT_FOUND");
    expect(err.code).toBe("FORECAST_NOT_FOUND");
    expect(err.message).toBe("Forecast not found");
  });

  it("badRequest defaults to 400", () => {
    const err = badRequest();
    expect(err.status).toBe(400);
    expect(err.code).toBe("BAD_REQUEST");
  });

  it("badRequest accepts details", () => {
    const err = badRequest("Invalid", "VALIDATION_ERROR", [{ field: "name" }]);
    expect(err.details).toEqual([{ field: "name" }]);
  });

  it("unauthorized defaults to 401", () => {
    const err = unauthorized();
    expect(err.status).toBe(401);
    expect(err.code).toBe("UNAUTHORIZED");
  });

  it("forbidden defaults to 403", () => {
    const err = forbidden();
    expect(err.status).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
  });

  it("conflict defaults to 409", () => {
    const err = conflict();
    expect(err.status).toBe(409);
    expect(err.code).toBe("CONFLICT");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/shared/utils/__tests__/api-error.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `apps/api/src/shared/utils/api-error.ts`:

```typescript
/**
 * Unified API Error class.
 * Throw this from route handlers or services — the global error handler
 * in index.ts formats it into { success: false, error: { code, message } }.
 */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function notFound(
  message = "Resource not found",
  code = "NOT_FOUND",
): ApiError {
  return new ApiError(code, message, 404);
}

export function badRequest(
  message = "Invalid request",
  code = "BAD_REQUEST",
  details?: unknown,
): ApiError {
  return new ApiError(code, message, 400, details);
}

export function unauthorized(
  message = "Unauthorized",
  code = "UNAUTHORIZED",
): ApiError {
  return new ApiError(code, message, 401);
}

export function forbidden(
  message = "Access denied",
  code = "FORBIDDEN",
): ApiError {
  return new ApiError(code, message, 403);
}

export function conflict(
  message = "Resource conflict",
  code = "CONFLICT",
): ApiError {
  return new ApiError(code, message, 409);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/shared/utils/__tests__/api-error.test.ts`
Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/shared/utils/api-error.ts apps/api/src/shared/utils/__tests__/api-error.test.ts
git commit -m "feat(api): add ApiError class with factory functions"
```

---

### Task 2: Rewrite global error handler and notFound handler

**Files:**

- Modify: `apps/api/src/index.ts` (lines 93-98 imports, lines 232-267 handlers)

- [ ] **Step 1: Update imports in index.ts**

At the top of `apps/api/src/index.ts`, add the `ApiError` import and remove the `createSafeErrorResponse` import:

Replace:

```typescript
import {
  ErrorSanitizer,
  createSafeErrorResponse,
} from "./utils/errorSanitizer";
```

With:

```typescript
import { ErrorSanitizer } from "./utils/errorSanitizer";
import { ApiError } from "./shared/utils/api-error";
```

- [ ] **Step 2: Rewrite `app.onError` handler**

Replace the existing `app.onError` block (lines 232-255) with:

```typescript
// Unified error handler — single formatter for ALL thrown errors
app.onError((err, c) => {
  // Log the original error server-side
  console.error(`[ERROR] ${c.req.method} ${c.req.path}:`, err);

  if (err instanceof ApiError) {
    return c.json(
      {
        success: false,
        error: {
          code: err.code,
          message: ErrorSanitizer.sanitizeMessage(err.message),
          ...(err.details !== undefined && { details: err.details }),
        },
      },
      err.status as StatusCode,
    );
  }

  // Non-ApiError: auto-classify via ErrorSanitizer
  const sanitized = ErrorSanitizer.sanitizeError(err);

  const STATUS_MAP: Record<string, number> = {
    validation: 400,
    authentication: 401,
    authorization: 403,
    not_found: 404,
    rate_limit: 429,
    server_error: 500,
  };
  const status = STATUS_MAP[sanitized.type] ?? 500;

  return c.json(
    {
      success: false,
      error: {
        code: sanitized.code ?? "INTERNAL_ERROR",
        message: sanitized.message,
      },
    },
    status as StatusCode,
  );
});
```

- [ ] **Step 3: Rewrite `app.notFound` handler**

Replace the existing `app.notFound` block (lines 257-267) with:

```typescript
app.notFound((c) =>
  c.json(
    {
      success: false,
      error: {
        code: "ROUTE_NOT_FOUND",
        message: `API endpoint not found: ${c.req.method} ${c.req.path}`,
      },
    },
    404,
  ),
);
```

- [ ] **Step 4: Run existing forecast tests to verify nothing broke**

Run: `cd apps/api && npx vitest run src/features/forecast`
Expected: All 72 tests PASS (forecast routes still work with their own try-catch)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "refactor(api): rewrite global error handler to unified format"
```

---

### Task 3: Update shared-types `ApiResponse`

**Files:**

- Modify: `packages/shared-types/src/common.ts`

- [ ] **Step 1: Remove `meta` field from ApiResponse**

In `packages/shared-types/src/common.ts`, replace:

```typescript
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}
```

With:

```typescript
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

- [ ] **Step 2: Build shared-types to verify**

Run: `pnpm --filter @makanmasak/shared-types run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/src/common.ts
git commit -m "refactor(shared-types): remove meta field from ApiResponse, tighten error shape"
```

---

## Chunk 2: Middleware Alignment

### Task 4: Update validation middleware

**Files:**

- Modify: `apps/api/src/middleware/validation.ts`
- Create: `apps/api/src/middleware/__tests__/validation-error-format.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/middleware/__tests__/validation-error-format.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { z } from "zod";
import { validateBody, validateQuery, validateParams } from "../validation";

const testSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
});

function createApp() {
  const app = new Hono();
  app.post("/test", validateBody(testSchema), (c) =>
    c.json({ success: true, data: c.get("validatedBody") }),
  );
  return app;
}

describe("validation middleware error format", () => {
  it("should return unified error shape on validation failure", async () => {
    const app = createApp();
    const res = await app.request("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "", age: -1 }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toHaveProperty("code", "VALIDATION_ERROR");
    expect(body.error).toHaveProperty("message", "Validation failed");
    expect(body.error).toHaveProperty("details");
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details[0]).toHaveProperty("field");
    expect(body.error.details[0]).toHaveProperty("message");
  });

  it("should return unified shape on invalid JSON body", async () => {
    const app = createApp();
    const res = await app.request("/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toHaveProperty("code", "INVALID_JSON");
    expect(body.error).toHaveProperty("message");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/middleware/__tests__/validation-error-format.test.ts`
Expected: FAIL — `body.error` is a string, not an object

- [ ] **Step 3: Update validation middleware**

Make targeted edits to `apps/api/src/middleware/validation.ts`. The key changes are:

1. Rename `handleValidationError` to `formatValidationError` and change its return shape
2. Update the 3 fallback error returns to use the same shape

The full updated file should look like this (preserves existing `commonSchemas` and `ContextVariableMap` declaration unchanged):

```typescript
import { Context, Next } from "hono";
import { z } from "zod";
import type { Env } from "../types/env";

// Format Zod errors into unified error shape
const formatValidationError = (error: z.ZodError) => ({
  success: false as const,
  error: {
    code: "VALIDATION_ERROR",
    message: "Validation failed",
    details: error.errors.map((err) => ({
      field: err.path.join("."),
      message: err.message,
      code: err.code,
    })),
  },
});

export const validateBody = <T = any>(schema: z.ZodType<T, any, any>) => {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    try {
      const body = await c.req.json();
      const validated = schema.parse(body);
      c.set("validatedBody", validated);
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(formatValidationError(error), 400);
      }
      return c.json(
        {
          success: false,
          error: { code: "INVALID_JSON", message: "Invalid JSON body" },
        },
        400,
      );
    }
  };
};

export const validateQuery = <T = any>(schema: z.ZodType<T, any, any>) => {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    try {
      const query = c.req.query();
      const validated = schema.parse(query);
      c.set("validatedQuery", validated);
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(formatValidationError(error), 400);
      }
      return c.json(
        {
          success: false,
          error: {
            code: "INVALID_QUERY",
            message: "Invalid query parameters",
          },
        },
        400,
      );
    }
  };
};

export const validateParams = <T = any>(schema: z.ZodType<T, any, any>) => {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    try {
      const params = c.req.param();
      const validated = schema.parse(params);
      c.set("validatedParams", validated);
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(formatValidationError(error), 400);
      }
      return c.json(
        {
          success: false,
          error: {
            code: "INVALID_PARAMS",
            message: "Invalid path parameters",
          },
        },
        400,
      );
    }
  };
};

// Common schemas (unchanged)
export const commonSchemas = {
  idParam: z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
  }),
  restaurantIdParam: z.object({
    restaurantId: z.string().regex(/^\d+$/).transform(Number),
  }),
  paginationQuery: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default("20"),
    search: z.string().optional(),
  }),
  dateRangeQuery: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
};

// Extend Context types
declare module "hono" {
  interface ContextVariableMap {
    validatedBody: any;
    validatedQuery: any;
    validatedParams: any;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/middleware/__tests__/validation-error-format.test.ts`
Expected: All 2 tests PASS

- [ ] **Step 5: Run forecast tests to verify nothing broke**

Run: `cd apps/api && npx vitest run src/features/forecast`
Expected: All tests PASS (forecast routes use `validateBody`/`validateQuery`/`validateParams`)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/middleware/validation.ts apps/api/src/middleware/__tests__/validation-error-format.test.ts
git commit -m "refactor(api): update validation middleware to unified error format"
```

---

### Task 5: Update auth middleware

**Files:**

- Modify: `apps/api/src/middleware/auth.ts`
- Create: `apps/api/src/middleware/__tests__/auth-error-format.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/middleware/__tests__/auth-error-format.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { Hono } from "hono";

// Mock hono/jwt before importing auth
vi.mock("hono/jwt", () => ({
  verify: vi.fn(),
}));

import { authMiddleware, requireRole } from "../auth";
import { verify } from "hono/jwt";

function createApp() {
  const app = new Hono();
  app.use("*", async (c, next) => {
    // Mock env bindings
    c.env = {
      JWT_SECRET: "a".repeat(32),
      TOKEN_BLACKLIST: null,
    } as unknown as Env;
    await next();
  });
  app.get("/protected", authMiddleware, (c) =>
    c.json({ success: true, data: "ok" }),
  );
  return app;
}

describe("auth middleware error format", () => {
  it("should return unified error shape for missing auth header", async () => {
    const app = createApp();
    const res = await app.request("/protected");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toHaveProperty("code", "MISSING_AUTH_HEADER");
    expect(body.error).toHaveProperty("message");
  });

  it("should return unified error shape for expired token", async () => {
    const app = createApp();
    vi.mocked(verify).mockResolvedValue({
      id: 1,
      username: "test",
      role: 1,
      iat: Math.floor(Date.now() / 1000) - 100,
      exp: Math.floor(Date.now() / 1000) - 10, // expired
    });

    const res = await app.request("/protected", {
      headers: { Authorization: "Bearer valid-token" },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toHaveProperty("code", "TOKEN_EXPIRED");
  });
});

describe("requireRole error format", () => {
  it("should return unified error shape for insufficient permissions", async () => {
    const app = new Hono();
    app.use("*", async (c, next) => {
      c.env = { JWT_SECRET: "a".repeat(32) } as unknown as Env;
      // Simulate authenticated user with role 2 (Chef)
      c.set("user", { id: 1, username: "test", role: 2 });
      await next();
    });
    app.get("/admin", requireRole([0, 1]), (c) => c.json({ success: true }));

    const res = await app.request("/admin");
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toHaveProperty("code", "INSUFFICIENT_ROLE");
    expect(body.error).toHaveProperty("message");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx vitest run src/middleware/__tests__/auth-error-format.test.ts`
Expected: FAIL — `body.error` is a string, not an object

- [ ] **Step 3: Update auth middleware**

In `apps/api/src/middleware/auth.ts`, replace every `c.json({ success: false, error: "..." }, status)` with the unified shape. Exact replacements:

**In `authMiddleware`:**

| Line    | Old `error` value                           | New `{ code, message }`                                                               |
| ------- | ------------------------------------------- | ------------------------------------------------------------------------------------- |
| 30-33   | `"Missing or invalid authorization header"` | `{ code: "MISSING_AUTH_HEADER", message: "Missing or invalid authorization header" }` |
| 43-46   | `"Server configuration error"`              | `{ code: "SERVER_CONFIG_ERROR", message: "Server configuration error" }`              |
| 53-56   | `"Token has been invalidated"`              | `{ code: "TOKEN_BLACKLISTED", message: "Token has been invalidated" }`                |
| 63      | `"Invalid token"`                           | `{ code: "TOKEN_INVALID", message: "Invalid token" }`                                 |
| 71      | `"Token has expired"`                       | `{ code: "TOKEN_EXPIRED", message: "Token has expired" }`                             |
| 77      | `"Token issued in future"`                  | `{ code: "TOKEN_FUTURE", message: "Token issued in future" }`                         |
| 83      | `"Token not yet valid"`                     | `{ code: "TOKEN_INVALID", message: "Token not yet valid" }`                           |
| 88      | `"Invalid token claims"`                    | `{ code: "TOKEN_INVALID", message: "Invalid token claims" }`                          |
| 93      | `"Invalid role in token"`                   | `{ code: "TOKEN_INVALID", message: "Invalid role in token" }`                         |
| 100-103 | `"Token too old, please refresh"`           | `{ code: "TOKEN_EXPIRED", message: "Token too old, please refresh" }`                 |
| 132     | `"Token has expired"`                       | `{ code: "TOKEN_EXPIRED", message: "Token has expired" }`                             |
| 140     | `"Invalid token format"`                    | `{ code: "TOKEN_INVALID", message: "Invalid token format" }`                          |
| 142     | `"Authentication failed"`                   | `{ code: "TOKEN_INVALID", message: "Authentication failed" }`                         |

**In `requireRole`:**

| Line | Old                          | New                                                                  |
| ---- | ---------------------------- | -------------------------------------------------------------------- |
| 152  | `"Authentication required"`  | `{ code: "UNAUTHORIZED", message: "Authentication required" }`       |
| 156  | `"Insufficient permissions"` | `{ code: "INSUFFICIENT_ROLE", message: "Insufficient permissions" }` |

**In `requireRestaurantAccess`:**

| Line    | Old                                  | New                                                                  |
| ------- | ------------------------------------ | -------------------------------------------------------------------- |
| 172     | `"Authentication required"`          | `{ code: "UNAUTHORIZED", message: "Authentication required" }`       |
| 183-186 | `"Access denied to this restaurant"` | `{ code: "FORBIDDEN", message: "Access denied to this restaurant" }` |

The pattern for each replacement: `{ success: false, error: "msg" }` → `{ success: false, error: { code: "CODE", message: "msg" } }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx vitest run src/middleware/__tests__/auth-error-format.test.ts`
Expected: All 3 tests PASS

- [ ] **Step 5: Run forecast tests to verify auth middleware still works**

Run: `cd apps/api && npx vitest run src/features/forecast`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/middleware/auth.ts apps/api/src/middleware/__tests__/auth-error-format.test.ts
git commit -m "refactor(api): update auth middleware to unified error format"
```

---

## Chunk 3: Cleanup + Demo Feature Migration

### Task 6: Delete unused utilities and internalize ErrorSanitizer

**Files:**

- Delete: `apps/api/src/shared/utils/error-handler.ts`
- Modify: `apps/api/src/shared/utils/response.ts` (remove error exports)
- Modify: `apps/api/src/utils/errorSanitizer.ts` (remove convenience functions)

- [ ] **Step 1: Delete FeatureErrorHandler**

Delete `apps/api/src/shared/utils/error-handler.ts` (0 users confirmed via grep).

- [ ] **Step 2: Clean up response.ts — remove error-related exports**

In `apps/api/src/shared/utils/response.ts`, remove:

- The `ApiResponse` interface (lines 6-21) — shadowed by shared-types version
- The `ErrorResponse` interface (lines 23-29)
- The `createErrorResponse` function (lines 45-57)

Keep:

- `createSuccessResponse` (used by 11 features)
- `createPaginatedResponse` (used by some features)

- [ ] **Step 3: Remove ErrorSanitizer convenience exports**

In `apps/api/src/utils/errorSanitizer.ts`, remove the last 3 convenience functions (lines 299-313):

- `sanitizeErrorMessage`
- `createSafeErrorResponse`
- `logAndSanitizeError`

Keep the `ErrorSanitizer` class itself — it's called by the global handler.

- [ ] **Step 4: Audit imports for removed exports**

Run grep to find any remaining imports of removed functions:

```bash
cd apps/api && grep -r "createSafeErrorResponse\|logAndSanitizeError\|createErrorResponse\|FeatureErrorHandler\|ErrorResponse" src/ --include="*.ts" -l
```

For `createSafeErrorResponse`: Used by auth and realtime routes (Phase 1.5 scope). These files will still import from `errorSanitizer.ts`, so do NOT remove `createSafeErrorResponse` export yet — defer its removal to Phase 1.5 when those routes are migrated.

For `createErrorResponse` from `response.ts`: Verify no feature imports it (the `createSuccessResponse` imports are fine to keep).

For `FeatureErrorHandler`: Confirm 0 imports before deletion.

- [ ] **Step 5: Verify no broken imports**

Run: `cd apps/api && npx vitest run src/features/forecast src/features/discovery`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git rm apps/api/src/shared/utils/error-handler.ts
git add apps/api/src/shared/utils/response.ts apps/api/src/utils/errorSanitizer.ts
git commit -m "refactor(api): delete unused error utilities, clean up response.ts"
```

---

### Task 7: Remove feature-level `onError` handlers

**Files:**

- Modify: `apps/api/src/features/orders/index.ts` (remove lines 139-165)
- Modify: `apps/api/src/features/authentication/index.ts` (remove lines 89-107)

- [ ] **Step 1: Remove orders feature `onError`**

In `apps/api/src/features/orders/index.ts`, delete the `this.routes.onError(...)` block (starts at line 140). The global handler now covers this.

- [ ] **Step 2: Remove authentication feature `onError`**

In `apps/api/src/features/authentication/index.ts`, delete the `this.routes.onError(...)` block (starts at line 90). The global handler now covers this.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/features/orders/index.ts apps/api/src/features/authentication/index.ts
git commit -m "refactor(api): remove feature-level onError handlers, rely on global handler"
```

---

### Task 8: Migrate forecast routes — remove try-catch boilerplate

**Files:**

- Modify: `apps/api/src/features/forecast/routes/index.ts`

- [ ] **Step 1: Remove all try-catch blocks from forecast routes**

Replace the entire `apps/api/src/features/forecast/routes/index.ts`. Each route handler becomes the happy path only — errors propagate to the global handler.

The 5 route handlers change from:

```typescript
async (c) => {
  try {
    // ... logic ...
    return c.json({ success: true, data: { ... } });
  } catch (error) {
    console.error("...", error);
    return c.json({ success: false, error: { code: "...", message: ... } }, 500);
  }
}
```

To:

```typescript
async (c) => {
  // ... logic ...
  return c.json({ success: true, data: { ... } });
}
```

Remove all 5 try-catch blocks. Keep the happy-path logic unchanged. Remove all `console.error` calls (the global handler logs errors).

- [ ] **Step 2: Run forecast tests**

Run: `cd apps/api && npx vitest run src/features/forecast`
Expected: All tests PASS. The route tests that verify 500 responses will now get the global handler's format instead of the route-level format — verify the error tests still check `success: false`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/features/forecast/routes/index.ts
git commit -m "refactor(forecast): remove try-catch boilerplate, delegate to global error handler"
```

---

### Task 9: Migrate discovery routes — remove try-catch boilerplate

**Files:**

- Modify: `apps/api/src/features/discovery/routes/index.ts`

- [ ] **Step 1: Remove all try-catch blocks from discovery routes**

Same pattern as Task 8. Remove all 5 try-catch blocks from discovery routes. Keep happy-path logic unchanged.

- [ ] **Step 2: Run discovery tests (if they exist)**

Run: `cd apps/api && npx vitest run src/features/discovery`
Expected: Tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/features/discovery/routes/index.ts
git commit -m "refactor(discovery): remove try-catch boilerplate, delegate to global error handler"
```

---

### Task 10: Migrate ingredients routes — remove try-catch boilerplate

**Files:**

- Modify: `apps/api/src/features/ingredients/routes/index.ts`

- [ ] **Step 1: Remove all 12 try-catch blocks from ingredients routes**

Same pattern as Tasks 8-9. Remove all try-catch blocks. Keep happy-path logic unchanged. The 12 `catch` blocks all follow the same `{ success: false, error: { code, message } }` pattern — their errors will now propagate to the global handler.

- [ ] **Step 2: Run ingredients tests (if they exist)**

Run: `cd apps/api && npx vitest run src/features/ingredients`
Expected: Tests PASS (or no test files found — ingredients is a new feature)

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/features/ingredients/routes/index.ts
git commit -m "refactor(ingredients): remove try-catch boilerplate, delegate to global error handler"
```

---

## Chunk 4: Frontend Alignment + Final Verification

### Task 11: Update frontend error parser

**Files:**

- Modify: `apps/admin-dashboard/src/utils/errorHandler.ts` (line ~210)

- [ ] **Step 1: Update parseError to use unified format**

In `apps/admin-dashboard/src/utils/errorHandler.ts`, find the API error parsing block (around line 206-218) and update:

Replace:

```typescript
} else if (error?.response) {
  // API 錯誤
  type = ErrorType.API;
  code = error.response.status;
  message = error.response.data?.error?.message || "服務器錯誤";
```

With:

```typescript
} else if (error?.response) {
  // API 錯誤
  type = ErrorType.API;
  code = error.response.status;
  const apiError = error.response.data?.error;
  if (typeof apiError === "object" && apiError !== null) {
    message = apiError.message || "服務器錯誤";
  } else if (typeof apiError === "string") {
    // Backward compatibility: some un-migrated routes may still return error as string
    message = apiError || "服務器錯誤";
  } else {
    message = "服務器錯誤";
  }
```

- [ ] **Step 2: Run admin-dashboard typecheck**

Run: `pnpm --filter makanmakan-admin-dashboard run typecheck`
Expected: PASS (0 errors)

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/utils/errorHandler.ts
git commit -m "refactor(admin): update error parser for unified API error format"
```

---

### Task 12: Final verification — run all affected test suites

**Files:** None (verification only)

- [ ] **Step 1: Run all API forecast tests**

Run: `cd apps/api && npx vitest run src/features/forecast`
Expected: All PASS

- [ ] **Step 2: Run all API discovery tests**

Run: `cd apps/api && npx vitest run src/features/discovery`
Expected: All PASS

- [ ] **Step 3: Run the new middleware tests**

Run: `cd apps/api && npx vitest run src/middleware/__tests__ src/shared/utils/__tests__/api-error.test.ts`
Expected: All PASS

- [ ] **Step 4: Run shared-types build**

Run: `pnpm --filter @makanmasak/shared-types run build`
Expected: Build succeeds

- [ ] **Step 5: Run admin-dashboard typecheck**

Run: `pnpm --filter makanmakan-admin-dashboard run typecheck`
Expected: 0 errors
