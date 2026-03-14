# Unified Error Response Design

**Date**: 2026-03-14
**Status**: Approved
**Scope**: API error response consolidation (Phase 1 of incremental architecture optimization)

## Problem

The API has 5 different error response formats across 34 route files, 3 competing error handler utilities (none universally adopted), and an `ApiErrorCode` enum that no route handler references. The frontend is forced into defensive parsing (`error?.message || fallback`) because the `error` field is sometimes a string, sometimes an object, and sometimes absent.

Additionally, middleware-produced errors (validation, auth) bypass any global error handler because they return directly via `c.json()` without throwing — these collectively produce the majority of 400/401/403 responses the frontend encounters.

## Decision

Merge all three error handling mechanisms into a single system:

- `FeatureErrorHandler` (0 users) — delete
- `createErrorResponse` from `response.ts` (11 users) — delete
- `createSafeErrorResponse` from `errorSanitizer.ts` (2 users) — internalize sanitization logic, remove public convenience function

Additionally, update middleware (validation, auth) to produce the same unified format.

## Unified Error Response Shape

All API errors will conform to this shape:

```typescript
// Success
{
  success: true,
  data: T
}

// Error
{
  success: false,
  error: {
    code: string,       // e.g. "FORECAST_GENERATE_FAILED", "NOT_FOUND"
    message: string,    // user-safe message (auto-sanitized)
    details?: unknown   // optional: field-level validation errors, additional context
  }
}
```

No more `error: "plain string"`, top-level `code`/`type`/`timestamp` in error bodies, or inconsistent nesting.

The shape is identical in development and production environments. No environment-specific fields — stack traces are logged server-side only, never returned in the response.

## Architecture

### 1. `ApiError` Class (`shared/utils/api-error.ts`)

A throwable typed error that carries `code`, `status`, and optional `details`:

```typescript
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 500,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

// Factory functions for common cases
export function notFound(message?: string, code?: string): ApiError;
export function badRequest(
  message?: string,
  code?: string,
  details?: unknown,
): ApiError;
export function unauthorized(message?: string, code?: string): ApiError;
export function forbidden(message?: string, code?: string): ApiError;
export function conflict(message?: string, code?: string): ApiError;
```

### 2. Global Error Handler (`index.ts` `app.onError`)

The single place that formats all error responses for thrown/uncaught errors:

```
throw / uncaught error
        │
        ▼
  app.onError(err, c)
        │
        ├─ err instanceof ApiError?
        │   → use err.code, sanitize(err.message), err.status, err.details
        │
        └─ other Error / unknown?
            → ErrorSanitizer.sanitizeError(err)
            → map sanitized.type to HTTP status (see mapping below)
            → use sanitized.code, sanitized.message
        │
        ▼
  c.json({ success: false, error: { code, message, details? } }, status)
```

#### Sanitized Type → HTTP Status Mapping

| `sanitized.type` | HTTP Status |
| ---------------- | ----------- |
| `validation`     | 400         |
| `authentication` | 401         |
| `authorization`  | 403         |
| `not_found`      | 404         |
| `rate_limit`     | 429         |
| `server_error`   | 500         |

### 3. ErrorSanitizer Internalization

`ErrorSanitizer.sanitizeError()` and `ErrorSanitizer.sanitizeMessage()` remain as internal utilities called by the global handler. The public convenience functions (`createSafeErrorResponse`, `logAndSanitizeError`) are removed — they are no longer needed because all errors flow through the global handler.

### 4. Middleware Alignment

#### Validation Middleware (`middleware/validation.ts`)

Currently returns `{ success: false, error: "Validation failed", details: [...] }` directly. Update to return the unified shape:

```typescript
// Before
return c.json(handleValidationError(error), 400);

// After
return c.json(
  {
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Validation failed",
      details: error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
        code: err.code,
      })),
    },
  },
  400,
);
```

This applies to `validateBody`, `validateQuery`, and `validateParams`. The non-Zod fallback errors (e.g., "Invalid JSON body") also get the unified shape.

#### Auth Middleware (`middleware/auth.ts`)

Currently returns `{ success: false, error: "string" }` in ~8 places. Update all to the unified shape:

```typescript
// Before
return c.json({ success: false, error: "Token has expired" }, 401);

// After
return c.json(
  {
    success: false,
    error: { code: "TOKEN_EXPIRED", message: "Token has expired" },
  },
  401,
);
```

Auth middleware error codes: `MISSING_AUTH_HEADER`, `TOKEN_BLACKLISTED`, `TOKEN_INVALID`, `TOKEN_EXPIRED`, `TOKEN_FUTURE`, `INSUFFICIENT_ROLE`, `SERVER_CONFIG_ERROR`.

#### `zValidator` from `@hono/zod-validator` (4 feature files)

Used in: authentication, realtime, backup, ai-analytics routes. These produce their own non-conforming validation error format. Strategy: replace `zValidator` usages with the project's custom `validateBody`/`validateQuery`/`validateParams` middleware during migration. This eliminates the format inconsistency and reduces dependency surface.

### 5. Feature-Level `onError` Handlers

Two features have local `onError` handlers that override the global one:

- `features/orders/index.ts` (line 140)
- `features/authentication/index.ts` (line 90)

These must be removed or aligned to produce the unified shape. Since the global handler now covers all cases, feature-level handlers should be removed.

### 6. `notFound` Handler (`index.ts`)

The existing `app.notFound()` handler returns `{ error: "string", path: "..." }`. Update to:

```typescript
app.notFound((c) =>
  c.json(
    {
      success: false,
      error: {
        code: "ROUTE_NOT_FOUND",
        message: `API endpoint not found: ${c.req.path}`,
      },
    },
    404,
  ),
);
```

### 7. Route Handler Pattern

**Before** (5 variations of try-catch with manual formatting):

```typescript
app.get("/forecast/:id", async (c) => {
  try {
    const result = await service.getForecast(...);
    return c.json({ success: true, data: result });
  } catch (error) {
    console.error("Get forecast error:", error);
    return c.json({
      success: false,
      error: { code: "FORECAST_GET_FAILED", message: error instanceof Error ? error.message : "..." }
    }, 500);
  }
});
```

**After** (throw and let global handler format):

```typescript
// Uncaught errors are auto-handled
app.get("/forecast/:id", async (c) => {
  const result = await service.getForecast(...);
  return c.json({ success: true, data: result });
});

// Business logic errors use ApiError
app.get("/forecast/:id", async (c) => {
  const forecast = await service.getForecast(id);
  if (!forecast) throw notFound("Forecast not found", "FORECAST_NOT_FOUND");
  return c.json({ success: true, data: forecast });
});
```

### 8. `shared-types` Update

Update `ApiResponse<T>` in `packages/shared-types/src/common.ts` to enforce the unified shape:

```typescript
export interface ApiResponse<T = unknown> {
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

Remove `meta` and the loose `error?: string` variants. Keep `details` as optional for validation errors.

### 9. Frontend Alignment

`admin-dashboard/src/utils/errorHandler.ts` error parsing simplifies from defensive guessing to reliable access:

```typescript
// Before — guessing format
message = error.response.data?.error?.message || "服務器錯誤";

// After — guaranteed format
const apiError = error.response.data?.error;
message = apiError?.message || "服務器錯誤";
code = apiError?.code;
```

## Files to Create

| File                                     | Purpose                              |
| ---------------------------------------- | ------------------------------------ |
| `apps/api/src/shared/utils/api-error.ts` | `ApiError` class + factory functions |

## Files to Modify

| File                                             | Change                                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `apps/api/src/index.ts`                          | Rewrite `app.onError` and `app.notFound` to use unified format; remove `createSafeErrorResponse` import |
| `apps/api/src/middleware/validation.ts`          | Update `handleValidationError` and fallback errors to unified shape                                     |
| `apps/api/src/middleware/auth.ts`                | Update all `c.json` error returns to unified shape with specific error codes                            |
| `packages/shared-types/src/common.ts`            | Update `ApiResponse` type                                                                               |
| `apps/admin-dashboard/src/utils/errorHandler.ts` | Simplify error parsing                                                                                  |
| `apps/api/src/features/orders/index.ts`          | Remove feature-level `onError` handler                                                                  |
| `apps/api/src/features/authentication/index.ts`  | Remove feature-level `onError` handler                                                                  |

## Files to Delete

| File                                         | Reason                                                      |
| -------------------------------------------- | ----------------------------------------------------------- |
| `apps/api/src/shared/utils/error-handler.ts` | `FeatureErrorHandler` — 0 users, replaced by global handler |

## Files to Partially Clean Up

| File                                    | Change                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/api/src/shared/utils/response.ts` | Remove `createErrorResponse` and `ErrorResponse` interface (replaced by global handler). **Keep** `createSuccessResponse` and `createPaginatedResponse` — they are used by 11 features (menu, scheduling, leaves, kitchen, queue, sse, qr-codes, notifications, etc.). These success helpers are harmless and out of scope for this error-focused migration. |

## Files to Internalize (Remove Public API)

| File                                   | Change                                                                                                                                                                |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/api/src/utils/errorSanitizer.ts` | Remove `createSafeErrorResponse` and `logAndSanitizeError` exports. Keep `ErrorSanitizer` class with `sanitizeError()` and `sanitizeMessage()` as internal utilities. |

## Migration Strategy

### Phase 1 (This PR): Foundation + Critical Paths

1. Create `ApiError` class + factory functions (including `unauthorized`)
2. Rewrite global `app.onError` handler with type-to-status mapping
3. Rewrite `app.notFound` handler
4. Update validation middleware (`validateBody`, `validateQuery`, `validateParams`)
5. Update auth middleware (all `c.json` error returns)
6. Remove feature-level `onError` handlers (orders, authentication)
7. Update `shared-types` `ApiResponse`
8. Delete unused utilities (`error-handler.ts`, `response.ts`)
9. Internalize ErrorSanitizer public API
10. Migrate demo features: **forecast**, **discovery**, **ingredients** (remove try-catch, use throw)
11. Update auth and realtime routes (replace `createSafeErrorResponse` with throw pattern; replace `zValidator` with custom validation middleware)
12. Update frontend error parser
13. Audit and update imports across the codebase for deleted files

### Phase 2 (Gradual): Remaining Features

Remaining route files migrate opportunistically — whenever a developer touches a route file for any reason, they remove the manual try-catch and switch to the throw pattern. The global handler catches thrown errors; un-migrated routes that still catch and return manually will continue to work but produce old format until migrated.

**Important**: Phase 2 backward compatibility is limited to routes that catch their own errors. The global handler only catches thrown errors, not manually-returned error responses. Phase 1 covers the most visible error paths (auth, validation, and demo features).

## Error Code Convention

Feature-specific codes follow `FEATURE_ACTION_FAILED` naming:

- `FORECAST_GENERATE_FAILED`
- `DISCOVERY_SEARCH_FAILED`
- `INGREDIENT_CREATE_FAILED`

Generic codes from `ApiErrorCode` enum remain for cross-cutting concerns:

- `NOT_FOUND`, `BAD_REQUEST`, `FORBIDDEN`, `UNAUTHORIZED`, `CONFLICT`

Middleware-specific codes:

- Validation: `VALIDATION_ERROR`
- Auth: `MISSING_AUTH_HEADER`, `TOKEN_BLACKLISTED`, `TOKEN_INVALID`, `TOKEN_EXPIRED`, `TOKEN_FUTURE`, `INSUFFICIENT_ROLE`, `SERVER_CONFIG_ERROR`
- Route: `ROUTE_NOT_FOUND`

## Testing

- Unit test for `ApiError` class and factory functions
- Unit test for updated global error handler (ApiError path + generic error path + type-to-status mapping)
- Unit test for validation middleware producing unified format (Zod error path + non-Zod fallback)
- Unit test for auth middleware producing unified format
- Verify migrated route handlers work without try-catch
- Verify feature-level `onError` removal doesn't break error handling
- Verify frontend error parser handles the unified format
- Integration test: API returns `{ error: { code, message } }` for auth failure, validation failure, and 500 error
