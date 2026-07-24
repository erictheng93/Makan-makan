# `apps/api` Identity & Tenant Feature Modules — Rust Rewrite Reference

Source-accurate reference for rewriting the following `apps/api` (Hono, Cloudflare
Workers) feature modules in Rust:

- `apps/api/src/features/authentication/`
- `apps/api/src/features/users/`
- `apps/api/src/features/customer/`
- `apps/api/src/features/customers/`
- `apps/api/src/features/me/`
- `apps/api/src/features/verification/`
- `apps/api/src/features/restaurants/`
- `apps/api/src/features/menu/`
- `apps/api/src/features/ingredients/`
- `apps/api/src/features/qr-codes/`
- `apps/api/src/features/admin-settings/`

All paths are repo-relative from `/Users/eric/Documents/Code/Makan-makan`. Full
HTTP paths below are `/api/v1` + the feature's mount prefix (from
`apps/api/src/app-factory.ts`), since every feature is mounted under a `apiV1`
sub-router which is itself mounted at `app.route("/api/v1", apiV1)`.

## 0. Mount prefixes (from `app-factory.ts`)

| Feature module | Mount prefix | Auth applied at mount (`apiV1.use`) |
| --- | --- | --- |
| `authentication` (`authFeature.routes`) | `/auth` | `attachCSRFToken()` on `/auth/*`; no blanket auth (per-route) |
| `verification` (`verificationFeature`) | `/auth` (same prefix, mounted **after** `authentication` — see §1 ambiguity) | none at mount; per-route |
| `users` (`usersFeature.routes`) | `/users` | `authMiddleware` on `/users/*` (route-level `requireRole` on top) |
| `customer` (`customerRouter`) | `/customer` | none at mount; per-route `canonicalCustomerAuthMiddleware` |
| `customers` (`customersRouter`) | `/customers` | none at mount; per-route `canonicalCustomerAuthMiddleware` |
| `me` (`meFeature.routes`) | `/me` | none at mount; router-level `staffOrUserCustomerAuthMiddleware` (applied inside the feature's own router via `router.use("*", ...)`) |
| `restaurants` (`restaurantsFeature.routes`) | `/restaurants` | `optionalAuth` on `/restaurants/*` (GET public, writes gated per-route) |
| `menu` (`menuFeature.routes`) | `/menu` | `optionalAuth` on `/menu/*` (GET public, writes gated per-route) |
| `ingredients` (`ingredientsFeature.routes`) | `/ingredients` | `authMiddleware` + `moduleGate("inventory")` on `/ingredients/*` (route-level `requireRole([0,1])` on top) |
| `qr-codes` (`qrCodesFeature.routes`) | `/qr` | none at mount (mounted in the **public routes** block); per-route auth except `/verify/*` |
| `admin-settings` (`adminSettingsRoutes`) | `/admin` | `authMiddleware` on `/admin/*` (route-level `authMiddleware` again, redundant) |

Global middleware that touches all of the above (see `app-factory.ts` for full
list/order): `requestIdMiddleware`, `geoIntelligentRateLimitMiddleware` (with
custom per-path limits for `/auth/login`, `/auth/register`, `/auth/me`,
`/auth/refresh`), `securityMonitoringMiddleware`, `corsMiddleware`,
`securityHeadersMiddleware`, `inputSanitizationMiddleware`,
`advancedAnalyticsMiddleware`, `smartCacheMiddleware` (GET-only, skips
`/auth/*`), `tenantContextMiddleware`, and finally `csrfProtection()` (applied
via `apiV1.use("*", csrfProtection({ excludePaths: [...] }))`) with explicit
exemptions for `/api/v1/auth/login`, `/api/v1/auth/register`,
`/api/v1/customer/auth`, `/api/v1/guest-orders`, `/api/v1/qr/scan` (note: no
such route exists under `/qr` — likely stale exclusion), and others. The
central `app.onError` handler formats all thrown `ApiError`s (and
auto-classified errors via `ErrorSanitizer`) into the unified
`{success:false,error:{code,message,details?}}` envelope — feature routes
generally throw (`notFound()`, `forbidden()`, `badRequest()`, `unauthorized()`,
`conflict()` from `apps/api/src/shared/utils/api-error.ts`) rather than
hand-building error JSON, though several older routes (authentication,
verification) still return manual `c.json({success:false,...}, status)`.

---

## 1. `authentication` (mount: `/auth`)

### Purpose

Staff/admin JWT authentication: login, staff-only registration, refresh,
logout, profile CRUD, password change, session listing/termination, and a
guest-token issuance endpoint used by the shop-QR customer flow. Customer
password registration/login is retired in favor of the `customer` feature's
phone-OTP flow — the `/register` and (indirectly) role-5 `/login` paths return
explicit "retired" errors. This module wraps `packages/database`'s
`AuthService`/`VerificationService` with caching, rate-limiting, and security
event logging; the actual bcrypt/JWT logic lives in
`packages/database/src/services/auth.ts`.

### Routes

| Method | Full path | Auth | Purpose | Request | Response |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/auth/login` | public | Staff login (role 0–4; role 5 rejected) | `{username,password}` | `{success,data:{token,expiresAt,user}}`; sets `__Host-mm_staff_refresh` cookie |
| POST | `/api/v1/auth/register` | public | **Retired** — always 410 Gone | `{username,...}` (validated but unused) | `{success:false,error:{code:"CUSTOMER_PASSWORD_REGISTRATION_RETIRED",...}}` |
| POST | `/api/v1/auth/register-staff` | role 0/1 | Create a staff user (owner limited to role ≥2) | `{username,fullName,email?,phone?,password,confirmPassword,role,restaurantId?}` — `confirmPassword` is required and `.refine`-checked equal to `password` (`validation.ts:120,130`)` | `{success,data:user}` (201) |
| POST | `/api/v1/auth/refresh` | public (refresh token via cookie or `X-Refresh-Token` header) | Rotate access+refresh token | none (token from cookie/header) | `{success,data:{token,expiresAt,user}}`; rotates refresh cookie |
| POST | `/api/v1/auth/logout` | authenticated | Blacklist current access token, invalidate session | none | `{success,message}`; clears refresh cookie |
| GET | `/api/v1/auth/me` | authenticated | Current user profile (sessions stripped) | — | `{success,data:user}` |
| GET | `/api/v1/auth/profile/:id` | authenticated (self or role 0) | Fetch a user profile incl. session list | — | `{success,data:UserProfile}` |
| PUT | `/api/v1/auth/profile/:id` | authenticated (self or role 0) | Update fullName/email/phone | `{fullName?,email?,phone?}` | `{success,data:AuthUser}` |
| POST | `/api/v1/auth/change-password` | authenticated | Change own password | `{currentPassword,newPassword}` | `{success,message}` |
| GET | `/api/v1/auth/sessions` | authenticated | List own active sessions | — | `{success,data:SessionSummary[]}` |
| DELETE | `/api/v1/auth/sessions/:sessionId` | authenticated | Terminate one session | — | `{success,message}` |
| DELETE | `/api/v1/auth/sessions` | authenticated | Terminate all sessions (= logout all) | — | `{success,message}` |
| POST | `/api/v1/auth/forgot-password` | public | Request reset (auto-detects email vs phone) | `{email?,username?}` | `{success,message}` — **collides with verification module, see ambiguity below** |
| POST | `/api/v1/auth/reset-password` | public | Reset password by token | `{token,newPassword}` | `{success,message}` — **collides with verification module** |
| POST | `/api/v1/auth/verify-email` | public | Verify email by token | `{token}` | `{success,message}` — **collides with verification module** |
| GET | `/api/v1/auth/stats` | role 0 | Auth usage statistics | `?timeRange=24h\|7d\|30d\|90d\|1y` | `{success,data:AuthStatistics}` |
| GET | `/api/v1/auth/security-events` | role 0 | Security event log (own or all if admin) | `?page=&limit=&severity=&type=&startDate=&endDate=` (schema accepts all six; handler currently uses only `limit`) | `{success,data:SecurityEvent[]}` (always `[]` — unimplemented, see below) |
| POST | `/api/v1/auth/guest-token` | public | Issue a KV-backed guest token for shop-QR ordering | `{restaurantId, phoneLastDigits}` (3–4 digits) | `{success,token,expiresIn:14400}` |
| GET | `/api/v1/auth/health` | public | Feature health check | — | health object (not the unified envelope) |

**Ambiguity (flag for Rust port):** `authentication/routes/index.ts` and
`verification/routes/index.ts` are BOTH mounted at `/auth` in
`app-factory.ts` (`authFeature` first, `verificationFeature` second), and both
define `POST /forgot-password`, `POST /reset-password`, and `POST
/verify-email` with **different validation schemas and different service call
shapes** (auth's `forgotPasswordSchema` = `{email?,username?}` vs
verification's `forgotPasswordSchema` = `{identifier,method}` requiring an
explicit `email`/`sms` choice). Hono's documented behavior for duplicate
method+path registrations is that the **first-registered handler wins**, and
`authFeature` is mounted before `verificationFeature`
(`app-factory.ts:540-541`) — so the `authentication` module's handlers
(labeled `(placeholder)` in comments but actually calling real
`AuthService.requestPasswordReset/resetPassword/verifyEmail` implementations,
`authentication/routes/index.ts:576-640`) shadow the `verification` module's
POST handlers. Verification's non-colliding routes (e.g. `GET
/auth/reset-password/verify`) remain reachable. Confirm once with `wrangler
dev` + curl before porting, then pick ONE implementation for Rust — the
shadowed verification-module flow (VerificationService, KV-stored OTPs) is
otherwise dead code on these three paths.

### Business logic

**Login (`AuthService.login` → `DatabaseAuthService.login`,
`packages/database/src/services/auth.ts:144`):**
1. Rate-limit check first via two independent layers, executed in this
   order (`AuthService.ts:97-117`): (a) the feature-level
   `AuthService.checkRateLimit` runs **first**, using three KV keys —
   `failed-login:{username}:{ip}`, `failed-login-ip:{ip}` (limit 10),
   `failed-login:{username}` (limit 5) — each with a 900s TTL; then (b) the
   KV counter `login_fail:{username}` inside `DatabaseAuthService.login`
   (locks at 5 failures / 15 min, returns a generic error). Both must pass.
2. Query `users` where `username = ? AND isActive = true`.
3. If `user.role === 5`, reject with "Customer password login is retired."
4. `bcrypt.compare(password, user.passwordHash)` — **bcryptjs**, cost factor
   not re-verified at compare time (bcrypt cost is embedded in the stored
   hash).
5. On success: clear failure counters, generate JWT access token
   (`sign({sub, username, role, restaurantId, tv: tokenVersion, jti}, JWT_SECRET, {expiresIn:"1h"})`,
   `HS256`) and refresh token
   (`sign({sub, type:"refresh", jti}, JWT_SECRET, {expiresIn:"7d"})`).
   `tokenVersion` defaults to `1` if the DB value isn't a positive integer.
6. **Session fixation guard**: calls `this.logout(user.id)` (no token filter)
   to invalidate *all* prior sessions for that user before creating the new
   one.
7. Insert a new `sessions` row (id = `crypto.randomUUID()`), update
   `users.lastLoginAt`.
8. Feature layer additionally: caches `user-session:{userId}:{accessToken}` in
   KV, logs a `SecurityEvent` (`LOGIN` or `LOGIN_FAILED`) into KV (not a DB
   table — see Data section), records `SimplePerformanceTracker` metrics.

**JWT claims** (`accessTokenPayload`, `packages/database/src/services/auth.ts:58`):
`{ sub: userId (UUID v7), username, role, restaurantId, tv: tokenVersion, jti: uuid }`,
signed `HS256`, 1h expiry (`ACCESS_TOKEN_TTL_HOURS = 1`). Refresh token:
`{ sub: userId, type: "refresh", jti }`, 7d expiry. `JWT_SECRET` must be ≥32
chars or the service throws before signing.

**Token validation** (`apps/api/src/middleware/auth.ts:167`, `createAuthMiddleware(maxRole)`):
- Extracts `Bearer` token, checks `TOKEN_BLACKLIST` KV (`token:{token}`), calls
  `verifyJwtToken` with `ignoreExpiration/ignoreNotBefore` deferred so the
  middleware can raise typed errors (`TOKEN_EXPIRED` vs `TOKEN_INVALID`)
  instead of a generic jsonwebtoken exception.
- Validates the decoded payload shape (`isAuthTokenPayload`): `sub` **must**
  match `UUID_V7_PATTERN` (`^[0-9a-f]{8}-...-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-...$`)
  — legacy non-UUID-v7 subjects are rejected outright.
  `decoded.exp <= now` ⇒ expired; `iat`/`nbf` more than 60s in the future ⇒
  rejected; `role` must be `0..=maxRole` (staff routes use `maxRole=4`,
  `customerAuthMiddleware`/`staffOrUserCustomerAuthMiddleware` use `maxRole=5`
  and still read from the `users` table, distinct from the canonical
  `customers` table JWTs — see `customer` module).
- Absolute token age ceiling: `MAX_ACCESS_TOKEN_AGE_SECONDS = 72h` from `iat`,
  independent of `exp`.
- Loads the live user row via `resolveStaffPrincipal` (see
  `apps/api/src/shared/services/staff-principal.ts` — not in scope here but
  referenced) and compares `tokenVersion`, `isActive`, `username`, `role`
  against the token claims; any mismatch ⇒ `TOKEN_INVALIDATED`/`TOKEN_INVALID`.
  `tokenVersion` is bumped on password change (`+1` in a `sql` update),
  invalidating all previously-issued access tokens for that user.
- If `timeUntilExpiry < 3600s`, sets `X-Token-Refresh-Recommended` +
  `X-Token-Expires-In` response headers (soft refresh hint, no enforcement).

**Refresh** (`refreshToken`): verifies the refresh JWT (`type === "refresh"`),
loads the active user, requires a matching **active** `sessions` row with that
exact `refreshToken` value, then issues a brand-new access+refresh token pair
and overwrites the same session row (`token`, `refreshToken`,
`lastAccessedAt`, `expiresAt` all updated) — refresh tokens are **single-use
and rotate**, but old ones are not blacklisted; they simply won't match any
session row afterward.

**Guest token** (`/guest-token`, no auth): generates an opaque token via
`generateGuestToken()` (`apps/api/src/middleware/guestAuth.ts`, not in scope)
and stores `{restaurantId, phoneLastDigits, createdAt}` in `CACHE_KV` under
`guest_token:{token}` with a 4h TTL (`14400s`). No DB row is created — this is
a lightweight KV-only session for shop-QR customers who haven't gone through
phone-OTP.

**`getSecurityEvents` is a stub** — always returns `[]` regardless of stored
events; `logSecurityEvent` writes events to KV
(`security-event:{timestamp}`, `CACHE_TTL.LONG`) but nothing ever reads them
back by key pattern, so the `/auth/security-events` and `/auth/stats`
(`recentSecurityEvents`) endpoints are effectively non-functional for history,
despite writes happening on every login/logout/password-change.

**Password reset / email verification** delegate to
`VerificationService` (`packages/database/src/services/VerificationService.ts`,
shared with the `verification` feature) — see §6 below for full detail
(applies identically here).

### Data

- **Reads/writes**: `users` (select by username/id, update `lastLoginAt`,
  `passwordHash`, `passwordChangedAt`, `tokenVersion`, `fullName`/`email`/`phone`),
  `sessions` (insert/update/delete by `userId`/`token`/`refreshToken`),
  `password_reset_tokens`, `email_verification_tokens` (via
  `VerificationService`, transactional).
- **KV (`CACHE_KV`)**: `guest_token:{token}` (4h TTL), `user-session:{userId}:{token}`,
  `user-profile:{userId}` (medium TTL), `token-validation:{token}` (short TTL,
  read in `AuthService.validateToken` — note the HTTP middleware path does
  **not** use this cache; only the service-layer `validateToken` method does,
  and no route currently calls it directly), `security-event:{timestamp}`,
  `failed-login*` rate-limit counters (900s TTL).
- **KV (`TOKEN_BLACKLIST`)**: `token:{accessToken}` on logout, checked by
  every authenticated middleware.
- **Cookies**: `__Host-mm_staff_refresh` (httpOnly, secure, `SameSite=Lax`,
  7-day maxAge) carries the staff refresh token.
- **Events**: none published to a queue/bus; "events" in `AuthEvent` (types
  file) are declared but never emitted/consumed anywhere in this module.

### Cross-module dependencies

- `packages/database`: `AuthService` (bcrypt+JWT core), `VerificationService`
  (password reset/email/phone), Drizzle `users`/`sessions` schema.
- `apps/api/src/shared/services/staff-principal.ts` (`resolveStaffPrincipal`)
  — used by the auth middleware to re-check live user state per request.
- `apps/api/src/middleware/guestAuth.ts` (`generateGuestToken`) — dynamically
  imported only inside the `/guest-token` handler.
- Consumed by essentially every other protected feature via
  `authMiddleware`/`requireRole`/`optionalAuth` (`apps/api/src/middleware/auth.ts`),
  which is a **shared dependency**, not owned by this feature but central to
  its contract.
- `apps/image-processor` verifies the *same* JWTs independently (its own
  `middleware/auth.ts` mirrors the `{sub: UUID v7, restaurantId}` shape and the
  72h max-age rule) — any change to JWT claim shape here must be mirrored
  there.

### Rust rewrite notes

- **bcrypt**: `bcryptjs` cost factor **10** throughout (`saltRounds = 10` in
  both `packages/database/src/services/auth.ts` and `user.ts`). Use `bcrypt`
  crate (or `rust-bcrypt`) with cost `10` for wire-compatible hash
  verification against existing stored hashes (bcryptjs is a JS reimplementation
  of standard bcrypt, fully compatible with the Rust `bcrypt` crate's `$2b$`/`$2a$`
  hashes).
- **JWT**: `jsonwebtoken` (npm) `HS256` only, with custom claims (`sub`,
  `username`, `role`, `restaurantId`, `tv`, `jti`, plus standard `iat`/`exp`).
  Rust `jsonwebtoken` crate maps directly; replicate the **deferred time-claim
  validation** pattern (verify signature ignoring `exp`/`nbf` first, then
  manually compare against `now` to produce distinct `TOKEN_EXPIRED` vs
  `TOKEN_INVALID` error codes) since the Rust crate's default validation will
  otherwise collapse these into one error type.
- **UUID v7**: `users.id`/`sessions.id` use `uuid` npm's `v7()`. Rust: `uuid`
  crate `Uuid::now_v7()`. The auth middleware **enforces** the v7 pattern via
  regex on the JWT `sub` claim — replicate this exact regex-level check
  (`^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`),
  not just "is this a valid UUID".
- **Timestamps**: `users`/`sessions` use `INTEGER` Unix-ms (`timestamp_ms`
  Drizzle mode) — straightforward `i64` millis in Rust/SQLite.
- **Two independent rate-limit layers** (DB-service-level KV lock +
  feature-service-level KV counters) should probably be **consolidated** in
  the Rust port rather than reimplemented twice — flag as tech debt, not a
  hard requirement to preserve exactly, but note both currently run on every
  login attempt.
- **Dead code to not port as-is**: `getSecurityEvents` stub returning `[]`;
  the whole 2FA method set (`setupTwoFactor` etc.) throws/returns
  "not yet implemented" — do not build a Rust 2FA implementation unless
  product explicitly asks; port these as explicit `501`-style stubs if the
  interface must be preserved.
- **Route collision** (see Routes table) must be resolved with a single
  canonical handler per path before/during the Rust rewrite — pick one
  schema (recommend verification's explicit `{identifier, method}` since it
  avoids ambiguous email/phone sniffing) and delete the duplicate.

---

## 2. `users` (mount: `/users`)

### Purpose

Staff-user administration (CRUD, password reset/change, activate/deactivate,
search, stats) restricted to admin (role 0) and shop owner (role 1), plus a
grab-bag of authenticated self-service endpoints (notification settings,
favorites/settings/preferences sync) that store arbitrary JSON blobs in KV
rather than a relational table. This module wraps
`packages/database`'s `UserService`/`AuthService` and adds
authorization rules (`canManageUser`/`canViewUser`/`canUpdateUser`) plus a
side-effect: creating an `OWNER` user as an `ADMIN` triggers tenant-owner
linkage in the management API.

### Routes

| Method | Full path | Auth | Purpose | Request | Response |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/users` | role 0/1 | List users (owner scoped to own restaurant) | `?restaurantId,role,isActive,isVerified,search,page,limit` | `{success,data:FormattedUser[],pagination}` |
| GET | `/api/v1/users/stats` | role 0/1 | User counts by role | `?restaurantId` | `{success,data:UserStats}` |
| GET | `/api/v1/users/search` | role 0/1 | Search users by name/username | `?query,restaurantId,limit` | `{success,data:FormattedUser[]}` |
| GET | `/api/v1/users/notification-settings` | authenticated | Read own notification prefs (KV) | — | `{success,data:{}|settings}` |
| PUT | `/api/v1/users/notification-settings` | authenticated | Write own notification prefs (KV) | arbitrary JSON | `{success,data:{settings,updatedAt}}` |
| POST | `/api/v1/users/favorites/sync` | authenticated | Store a favorites-sync payload (KV) | arbitrary JSON | `{success,data:{syncId,synced,syncType,syncedAt}}` |
| POST | `/api/v1/users/settings/sync` | authenticated | Store a settings-sync payload (KV) | arbitrary JSON | same shape |
| POST | `/api/v1/users/preferences/batch-sync` | authenticated | Store a preferences-batch-sync payload (KV) | arbitrary JSON | same shape |
| GET | `/api/v1/users/:id` | authenticated (self, admin, or same-restaurant owner) | Get one user | — | `{success,data:FormattedUser}` |
| POST | `/api/v1/users` | role 0/1 | Create a staff user | `CreateUserData` (role 0–4 only, strong password) | `{success,data:FormattedUser}` (201) |
| PUT | `/api/v1/users/:id` | authenticated (self, admin, or owner w/ manage rights) | Update profile fields | `UpdateUserData` | `{success,data:FormattedUser}` |
| POST | `/api/v1/users/:id/password` | authenticated (self or admin) | Change password (requires current password) | `{currentPassword,newPassword,confirmPassword}` | `{success,message}` |
| PATCH | `/api/v1/users/:id/status` | role 0/1 | Activate/deactivate (cannot self-deactivate) | `{isActive,reason?}` | `{success,message}` |
| PATCH | `/api/v1/users/:id/verify` | role 0/1 | Mark user verified | — | `{success,message}` |
| POST | `/api/v1/users/:id/reset-password` | role 0/1 | Admin-forced password reset (no current-password check) | `{newPassword,confirmPassword}` | `{success,message}` |

### Business logic

**Authorization matrix** (`UsersService`, all pure functions, no DB round-trip):
- `canManageUser(currentUser, targetRole, targetRestaurantId)`: admin → always
  true; owner → true only if `targetRole` is in `[CHEF(2)..CASHIER(4)]` **and**
  `targetRestaurantId === currentUser.restaurantId`; anyone else → false.
  Owners can never manage other owners or admins, and can't create/manage
  cross-restaurant staff.
- `canViewUser`: admin, self, or same-restaurant owner.
- `canUpdateUser`: admin, self, or owner passing `canManageUser` for the
  target's current role/restaurant.
- List/search/stats scope: if caller is `OWNER`, `restaurantId` filter is
  **forced** to the caller's own `restaurantId` regardless of query params
  (prevents owners from listing other restaurants' staff by query
  manipulation).

**Create user → management tenant linkage** (`createUser`): if the caller is
`ADMIN` and the newly created user has `role === OWNER` and a `restaurantId`,
the service calls `ManagementTenantClient.linkRestaurantOwner({restaurantId,
ownerUserId, ownerUsername})` (an internal HTTP call to
`apps/management-api`, see `apps/api/src/services/managementTenantClient.ts` —
out of scope but load-bearing). **On failure, the just-created user row is
soft-deactivated** (`isActive:false`) as compensation, and the original error
is re-thrown — this is a best-effort saga/rollback, not a transaction (the
user row physically still exists, just deactivated); if the deactivation
itself throws, that secondary error is only logged, not surfaced.

**Password change vs reset**: `changePassword` requires the caller to be
self or admin, and delegates to `AuthService.changePassword` (bcrypt-compares
`currentPassword` first — see §1). `resetPassword` requires `requireManagedUser`
(role 0/1 + `canManageUser` check) and calls `UserService.resetPassword`
directly with **no current-password check** — an admin/owner-only override
path.

**Self-deactivation guard**: `updateUserStatus` throws `badRequest` if
`currentUser.id === userId && !isActive` — you cannot deactivate your own
account through this endpoint.

**KV sync endpoints** (`favorites/sync`, `settings/sync`,
`preferences/batch-sync`, `notification-settings`): these accept a
`z.object({}).passthrough()` body (i.e., **unvalidated arbitrary JSON**) and
persist it verbatim under two KV keys — a timestamped/`sync_id`-keyed one and
a `:latest` one, both with a 30-day TTL. There is no schema enforcement, no
size cap beyond Workers KV's own limits, and no relation to any DB table —
purely a client-state mirror.

### Data

- **Reads/writes**: `users` table (all CRUD via `packages/database`'s
  `UserService`), no direct table access from this feature — always through
  the shared `UserService`/`AuthService`.
- **KV (`CACHE_KV`)**: `customer:notification-settings:{userId}`,
  `customer:{syncType}:{userId}:{syncId|"latest"}` — despite the `users`
  feature owning these routes, the KV key prefix is literally `customer:`
  (naming artifact from an earlier shared implementation; preserve as-is for
  compatibility unless a migration is planned).
- **Cross-service HTTP call**: `ManagementTenantClient.linkRestaurantOwner`
  (only on admin-created owner accounts).
- **Events**: none.

### Cross-module dependencies

- `packages/database`: `UserService`, `AuthService`, `USER_ROLES` constants.
- `apps/api/src/services/managementTenantClient.ts` → HTTP(S) call into
  `apps/management-api`'s internal routes (service binding or fetch,
  not verified in this pass — check that file directly before porting the
  owner-linkage side effect).
- Depended on by: `authentication` (staff registration reuses role logic
  conceptually but not code), admin dashboards for staff management.

### Rust rewrite notes

- **bcrypt**: same cost-10 bcryptjs hashes via shared `AuthService`/`UserService`
  in `packages/database` — no additional hashing logic in this feature layer.
- **Authorization matrix**: port `canManageUser`/`canViewUser`/`canUpdateUser`
  as plain functions operating on already-authenticated principal + target
  role/restaurant — no DB access needed, trivially portable, but the exact
  role-range check (`CHEF(2)..=CASHIER(4)`) must be preserved precisely since
  it's the only thing preventing owner-created admin/owner escalation.
- **Saga/compensation pattern**: the create-owner → link-tenant →
  deactivate-on-failure flow is **not transactional** (D1 has no cross-service
  distributed transaction with the management API's HTTP call) — in Rust,
  either keep it as best-effort compensation (matching current behavior,
  including its failure mode where the deactivation-failure error is
  swallowed/logged only) or upgrade to an outbox/retry pattern; document which
  choice was made since current behavior can strand deactivated-but-not-fully-
  rolled-back owner users if `ManagementTenantClient` fails intermittently.
- **JSON columns**: none in this feature's own writes (the KV sync blobs are
  opaque `serde_json::Value` equivalents — no schema to validate against in
  Rust either, by design).
- **Timestamps**: standard `INTEGER` ms via shared `users` schema.

---

## 3. `customer` (mount: `/customer`)

### Purpose

Canonical **customer identity** (role-5-equivalent, but backed by a separate
`customers` table, not `users`) for phone-OTP authentication used by the
shop-QR ordering flow and the standalone customer app. Owns OTP
request/verify, refresh/logout, profile (`/me`), preferences, favorites,
recent markets, push subscriptions, and GDPR-style consent recording. This is
the **only** place customer JWTs (`{sub: customers.id, type:"customer"}`) are
minted; `canonicalCustomerAuthMiddleware` (in `apps/api/src/middleware/auth.ts`)
is the sole verifier.

### Routes

| Method | Full path | Auth | Purpose | Request | Response |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/customer/auth/request-otp` | public (rate-limited) | Send OTP to phone | `{phone}` (E.164, normalized) | `{success,data:{phone,expiresInSeconds,devOtp?}}` (`devOtp` only outside production) |
| POST | `/api/v1/customer/auth/verify-otp` | public | Verify OTP, find-or-create customer, issue tokens | `{phone,otp}` (6 digits) | `{success,data:{accessToken,expiresIn,customer}}`; sets `__Host-mm_customer_refresh` cookie |
| POST | `/api/v1/customer/auth/refresh` | public (refresh token via body or cookie) | Rotate customer tokens | `{refreshToken?}` | `{success,data:{accessToken,expiresIn}}`; rotates cookie |
| POST | `/api/v1/customer/auth/logout` | canonical customer | Blacklist access token + revoke refresh | `{refreshToken?}` | `{success,data:{loggedOut:true}}`; clears cookie |
| GET | `/api/v1/customer/me` | canonical customer | Profile + preferences | — | `{success,data:{customer,preferences}}` |
| PATCH | `/api/v1/customer/me` | canonical customer | Update displayName/avatarUrl/locale | partial | `{success,data:{customer}}` |
| DELETE | `/api/v1/customer/me` | canonical customer | Soft-delete (`status='deleted'`) | — | `{success,data:{deleted:true}}` |
| GET | `/api/v1/customer/preferences` | canonical customer | Read preferences | — | `{success,data:preferences}` |
| PATCH | `/api/v1/customer/preferences` | canonical customer | Merge-update preferences | partial | `{success,data:preferences}` |
| GET | `/api/v1/customer/favorites` | canonical customer | List favorites (optional `targetType` filter) | `?targetType=market\|restaurant\|dish` | `{success,data:Favorite[]}` |
| POST | `/api/v1/customer/favorites` | canonical customer | Add a favorite (idempotent) | `{targetType,targetId}` | `{success,data:Favorite}` (201, or 200 if already existed) |
| DELETE | `/api/v1/customer/favorites/:id` | canonical customer | Remove favorite | — | `{success,data:{deleted:true}}` |
| GET | `/api/v1/customer/recent-markets` | canonical customer | List recently visited markets | `?limit=1..20 (default 8)` | `{success,data:RecentMarket[]}` |
| POST | `/api/v1/customer/recent-markets` | canonical customer | Upsert a recent-market visit | `{marketId,visitedAtMs?}` | `{success,data:RecentMarket}` (201) |
| GET | `/api/v1/customer/push-subscriptions` | canonical customer | List web-push subscriptions | — | `{success,data:Subscription[]}` |
| POST | `/api/v1/customer/push-subscriptions` | canonical customer | Register/upsert a push subscription | `{endpoint,p256dh,auth,userAgent?,deviceLabel?}` | `{success,data}` (201) |
| DELETE | `/api/v1/customer/push-subscriptions/:id` | canonical customer | Remove a subscription | — | `{success,data:{deleted:true}}` |
| GET | `/api/v1/customer/consents` | canonical customer | List currently-granted consents | — | `{success,data:Consent[]}` |
| POST | `/api/v1/customer/consents` | canonical customer | Record/revoke a consent version | `{consentType,version,granted,source?}` | `{success,data:{id}}` — 201 for a new insert, 200 with the **existing** row's id when an identical consent (same customerId/consentType/version/granted) already exists (`customer/routes/index.ts:702-726`) |

### Business logic

**OTP request** (`/auth/request-otp`): rate-limited via
`enforceOtpRateLimit` — two `RATE_LIMIT_KV` counters,
`customer_otp_phone:{phone}` (max 3/hour) and `customer_otp_ip:{ip}` (max
10/hour), both 1h TTL, checked **before** generating the OTP. OTP is a 6-digit
code from `generateOtp()` — uses `crypto.getRandomValues` with **rejection
sampling** (`OTP_RANDOM_BOUNDARY = 4_294_000_000` out of the `Uint32` range,
discarding values ≥ that boundary) to avoid modulo bias, then
`value % 1_000_000` zero-padded to 6 digits. The OTP is **bcrypt-hashed**
(`bcrypt.hash(otp, 10)`) before being stored in
`customer_phone_verification_tokens.otp_code` — unusual for a 6-digit code but
matches the module's general "never store secrets in plaintext" posture. TTL
5 minutes (`OTP_TTL_MS`). In non-production, the raw OTP is echoed back in the
response as `devOtp` for local testing.

**OTP verify**: looks up the latest unused, unexpired token for that phone,
enforces `attempts < MAX_OTP_ATTEMPTS(5)`, `bcrypt.compare`s the submitted OTP
against the stored hash; on mismatch increments `attempts` and rejects
(generic "Invalid or expired OTP" — no distinct error for wrong-code vs
expired, to avoid oracle attacks). On success: `findOrCreateCustomerByPhone`
— looks for an **active** customer row with that `primary_phone`; if none, it
first defensively clears `primary_phone` on any **soft-deleted** customer row
that still holds that phone (to satisfy the partial-unique index on
`(primary_phone) WHERE status='active'`), then inserts a brand-new `customers`
row with `display_name = phone` (not a real name — customers must set one
later via `PATCH /me`). Marks the OTP token `used_at_ms` + `customer_id`.

**Token issuance** (`issueCustomerTokens`): uses `hono/jwt`'s `sign()` (not
the same `jsonwebtoken` library used by the `authentication` module — a
**different JWT library**, though both target `HS256` via `JWT_SECRET`).
Access token: `{sub: customerId, type:"customer", iat, exp}`, 15-minute TTL
(`ACCESS_TOKEN_SECONDS = 900`). Refresh token: `{sub, type:"customer_refresh",
jti, iat, exp}`, 30-day TTL. The refresh token's `jti` is also written to
`TOKEN_BLACKLIST` KV as `customer_refresh:{jti} → customerId` (**note: this KV
namespace is repurposed as a refresh-token *allow-list*, not a blacklist**, for
customer refresh tokens — one-time-use is enforced by deleting that KV entry
on each successful refresh/logout).

**Refresh**: verifies the refresh JWT, looks up `customer_refresh:{jti}` in KV
and requires the stored value to equal `decoded.sub` (defense against a
refresh token being replayed after the customer row's ID somehow changed),
**deletes** that KV entry immediately (single-use), reloads the live customer
row (must still be `status='active'`), and issues a fresh token pair (new
`jti`, new KV allow-list entry). There is no session table for customer
tokens — the KV entry **is** the session.

**Logout**: blacklists the access token in `TOKEN_BLACKLIST`
(`token:{accessToken}`) with a **fixed** `expirationTtl: ACCESS_TOKEN_SECONDS`
(900s constant, `customer/routes/index.ts:295-299`) — it never computes the
remaining lifetime, unlike the staff `blacklistToken` helper
(`middleware/auth.ts:665-684`, which does `ttl = expiryTime - now`) — same
namespace, dual-purpose (blacklist entries for access tokens vs allow-list
entries for refresh `jti`s coexist under different key prefixes in the same KV
namespace) — and deletes the refresh token's allow-list entry.

**`last_seen_at_ms` touch**: every request through
`canonicalCustomerAuthMiddleware` runs an `UPDATE customers SET
last_seen_at_ms=?, updated_at_ms=? WHERE id=?` — i.e., **every** authenticated
customer request writes to D1, not just login. This is a potential
write-amplification/perf concern worth reconsidering in the Rust port (e.g.
debounce or move to KV+periodic flush) but must be replicated (or explicitly
changed with product sign-off) rather than silently dropped.

**Favorite/recent-market target validation**: `validateFavoriteTarget` checks
existence in `restaurants` (`deleted_at_ms IS NULL`) for `restaurant`, in
`menu_items` (`deleted_at_ms IS NULL`, numeric ID) for `dish`, and defers to
`validateMarketTarget` (checks `sqlite_master` for a `markets` table's
existence first — defensive against environments where the markets migration
hasn't run yet — then checks the row) for `market`.

### Data

- **Reads/writes**: `customers`, `customer_preferences` (upsert via
  `ON CONFLICT(customer_id) DO UPDATE`), `customer_favorites` (unique on
  `customer_id,target_type,target_id`), `customer_recent_markets` (unique on
  `customer_id,market_id`, upsert), `customer_push_subscriptions` (unique on
  `endpoint`, upsert), `customer_consents` (append-only + revocation via
  `revoked_at_ms`), `customer_phone_verification_tokens`, and read-only checks
  against `restaurants`/`menu_items`/`markets`/`sqlite_master`.
- **KV (`RATE_LIMIT_KV`)**: `customer_otp_phone:{phone}`,
  `customer_otp_ip:{ip}` (1h TTL each).
- **KV (`TOKEN_BLACKLIST`)**: dual-purpose — `token:{accessToken}` (blacklist,
  on logout) and `customer_refresh:{jti}` (allow-list, one-time-use refresh
  tokens, 30-day TTL).
- **Cookies**: `__Host-mm_customer_refresh` (httpOnly, secure, `SameSite=Lax`,
  30-day maxAge).
- **Events**: none published; `pruneStaleCustomerPushSubscriptions` is an
  exported helper (deletes subscriptions unused >90 days with
  `failure_count>=3`) presumably invoked by a cron/scheduled job elsewhere —
  not called from any route in this file.

### Cross-module dependencies

- `@makanmakan/utils`: `generateUUID`, `normalizeE164Phone`.
- `@makanmakan/shared-types`: `CUSTOMER_CONSENT_TYPES`,
  `isCustomerConsentVersion` (consent-version whitelist check).
- `apps/api/src/middleware/auth.ts`: `canonicalCustomerAuthMiddleware`,
  `verifyJwtToken` (shared low-level JWT verify used for the refresh-token
  path — note this is `jsonwebtoken`'s verify, even though *signing* uses
  `hono/jwt`; both are `HS256`/`JWT_SECRET`-compatible but are two different
  library call sites to keep in sync).
- Depended on by: `customers` (order history for the authenticated customer),
  `me` (indirectly, via the same middleware family for module/usage checks),
  order-placement flows elsewhere in the app that accept `customer` context.

### Rust rewrite notes

- **bcrypt for OTPs**: cost 10, same as passwords — verify the Rust bcrypt
  crate handles very short inputs (6-digit strings) identically to bcryptjs
  (it will, bcrypt operates on the string bytes regardless of length, but
  confirm no truncation edge cases at implementation time).
- **Two JWT call sites, one secret**: `hono/jwt` for signing, `jsonwebtoken`
  (via `verifyJwtToken`) for verifying refresh tokens — in Rust, standardize
  on a single JWT crate (`jsonwebtoken`) for both sign and verify; just ensure
  claim shape (`sub`,`type`,`jti`,`iat`,`exp`) round-trips identically.
- **Rejection-sampling OTP generator**: reproduce the exact modulo-bias
  avoidance (reject `u32` values ≥ `4_294_000_000` before `% 1_000_000`) if
  cryptographic uniformity of the 6-digit code matters to the product; a
  naive `rand::random::<u32>() % 1_000_000` would reintroduce a slight bias
  that the original code deliberately avoided.
- **UUID v7**: `customers.id` and most child-table PKs — same `uuid` v7
  generation story as `users`.
- **Refresh-token-as-KV-session pattern**: this is materially different from
  the `sessions` DB table used by staff auth (§1) — a Rust rewrite should
  decide once whether *all* identity types (staff, customer) share one
  session mechanism or intentionally keep two; currently they are two
  independent designs (DB row for staff, KV allow-list for customers) and
  this doc does not recommend unifying them without a product decision, but
  flags it as a design inconsistency worth a conscious choice.
- **JSON columns**: `customer_preferences.dietary_tags`/`allergens` (stored as
  JSON text via Drizzle's `{mode:"json"}` on `text` columns) — in Rust/SQLite,
  either keep as JSON text columns (`serde_json` serialize/deserialize) or
  normalize into join tables; the existing merge-then-upsert semantics
  (`{...existing, ...body}`) must be preserved if kept as JSON.
- **Timestamps**: all `*_ms` `INTEGER` columns, consistent with project
  convention.
- **Per-request D1 write** on every authenticated request
  (`last_seen_at_ms`/`updated_at_ms` touch) — explicitly call out as a
  possible perf hotspot to address (batch/debounce) rather than silently
  drop, since it currently runs synchronously in the auth middleware itself.

---

## 4. `customers` (mount: `/customers`)

### Purpose

Thin, two-route module exposing the authenticated **canonical customer's**
own order history and a minimal profile echo, using `orders`/`order_items`
tables via the `orders` feature's `OrdersService` (not owned by this module).
Distinct from `customer` (singular) which owns identity/profile/preferences —
this module is purely order-facing.

### Routes

| Method | Full path | Auth | Purpose | Request | Response |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/customers/me/orders` | canonical customer | List own orders | `?page,limit,status,dateFrom,dateTo` | `{success,data:Order[],pagination}` |
| GET | `/api/v1/customers/me` | canonical customer | Minimal profile (role hard-coded to `5`) | — | `{success,data:{id,username,fullName,email?,phone?,role:5}}` |

### Business logic

`GET /me/orders` always injects `filters.customerId = customer.id` — callers
cannot query another customer's orders regardless of any client-supplied
filter (no `customerId` is accepted from the query string at all). Status
filter accepts either a single string or an array of strings
(`toOrderStatuses`) and is passed straight through to
`OrdersService.getOrders` as `DbOrderStatus[]` — **no validation that the
strings are valid enum values** happens in this module (relies on whatever
`OrdersService`/Drizzle does downstream). `GET /me` is a synthetic profile
view: it does not read any table itself — it just reshapes the
`c.get("customer")` object already populated by
`canonicalCustomerAuthMiddleware`, hard-coding `role: 5` to keep the shape
compatible with staff-user profile consumers that expect a numeric role.

### Data

- **Reads**: `orders`/`order_items` indirectly via `OrdersService` (feature
  outside this doc's scope — `apps/api/src/features/orders/services/OrdersService.ts`).
- **No writes, no KV, no events** originate in this module itself.

### Cross-module dependencies

- `apps/api/src/features/orders/services/OrdersService.ts` (`getOrders`) and
  its `OrderQueryFilters`/`OrderStatus` types — hard dependency; this module
  has no independent data-access layer.
- `apps/api/src/middleware/auth.ts` (`canonicalCustomerAuthMiddleware`) —
  same customer identity as the `customer` module.

### Rust rewrite notes

- No bcrypt/JWT logic of its own — purely a filtered read against the orders
  domain. In Rust, this becomes a thin handler that forces `customer_id` into
  an otherwise-shared order-listing query builder; do not let this module
  duplicate order-filtering logic — it should call into whatever the `orders`
  domain module exposes.
- **Validate order status strings** against the canonical status enum before
  passing to the query layer — the current TS code does not, and an invalid
  status silently either errors deep in Drizzle or (worse) is ignored
  depending on how `OrdersService` handles it; decide explicitly in Rust
  (reject with 400 on unknown status) rather than inherit the ambiguity.
- Timestamps/IDs: inherits whatever `orders`/`order_items` use (integer
  autoincrement order IDs per project convention for that table, `customers.id`
  UUID v7 for the filter value) — verify against the `orders` feature's own
  Rust-rewrite doc when it exists.

---

## 5. `me` (mount: `/me`)

### Purpose

Tiny module exposing the current principal's **effective subscription/module
access** and **current billing-cycle usage** — used by frontends to decide
which UI modules to render (feature-gating) without duplicating
`moduleGate` logic client-side. Accepts both staff and customer JWTs (role
0–5) via `staffOrUserCustomerAuthMiddleware`, but customers (role 5) and
users without a `restaurantId` always get an empty/inactive module map.

### Routes

| Method | Full path | Auth | Purpose | Request | Response |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/me/modules` | staff or customer JWT (role 0–5) | Effective module access for the caller's restaurant | — | `{success,data:{restaurantId,planTier,isActive,trialEndsAt,effectiveModules}}` |
| GET | `/api/v1/me/usage` | staff or customer JWT (role 0–5) | Current billing-cycle usage meters | — | `{success,data:{cycleStartAt,cycleEndAt,meters}}` |

### Business logic

`/modules`: role 5 (customer) or no `restaurantId` on the token ⇒ immediate
`emptyModuleAccess(null)` (all modules `false`, `planTier:null`). Otherwise:
tries `CACHE_KV.get("subscription:{restaurantId}", "json")` first (5-minute
TTL cache, same key/shape as `moduleGate` middleware's own cache — **this
route and `moduleGate` share the exact same KV cache key**, so a write-through
from one benefits the other). On cache miss, loads from
`SubscriptionService.getByRestaurantId`, computes `effectiveModules` via
`SubscriptionService.getEffectiveModules` (plan-tier defaults + per-restaurant
overrides + trial-expiry check — logic lives in the `subscriptions`
feature/service, not here), and **writes through** to the same KV cache key
before returning. If no subscription row exists at all, returns
`emptyModuleAccess(restaurantId)` (present restaurantId, but no plan).

`/usage`: role 5 or missing `restaurantId` ⇒ empty usage object (`meters:[]`).
Otherwise delegates entirely to `UsageService.getCurrentUsage(restaurantId)`
(billing feature) — no caching here.

### Data

- **Reads**: `shop_subscriptions` (via `SubscriptionService`, indirectly),
  billing usage tables (via `UsageService`, indirectly) — no direct table
  access in this module's own code.
- **KV (`CACHE_KV`)**: `subscription:{restaurantId}` (5-minute TTL,
  **shared** with `apps/api/src/middleware/moduleGate.ts`'s own cache of the
  identical key — any Rust port must keep these two cache writers/readers
  compatible, or consolidate into one).
- **Events**: none.

### Cross-module dependencies

- `apps/api/src/features/subscriptions/services/SubscriptionService.ts` —
  `getByRestaurantId`, `getEffectiveModules` (plan/module logic lives there,
  not in `me`).
- `apps/api/src/features/billing/services/UsageService.ts` — `getCurrentUsage`.
- `apps/api/src/middleware/moduleGate.ts` — **shares** the
  `subscription:{restaurantId}` KV cache key/shape (`CachedSubscription`
  interface duplicated in both files as of this reading — keep in sync or
  extract to one shared type in the Rust port).
- `apps/api/src/middleware/auth.ts` (`staffOrUserCustomerAuthMiddleware`, i.e.
  `customerAuthMiddleware`, maxRole 5).

### Rust rewrite notes

- No auth/crypto logic of its own; purely a read-through cache in front of
  the subscriptions domain. In Rust, ensure the cache key/shape used here is
  the **single source of truth** shared with whatever replaces `moduleGate`
  middleware — the current TS code has this duplicated as a copy-pasted
  `CachedSubscription` interface in two files, which is exactly the kind of
  drift a Rust port should eliminate (one struct, one cache-key constant,
  imported by both the middleware and this handler).
- **Timestamps**: `trialEndsAt` is returned as epoch millis
  (`sub.trialEndsAt.getTime()`), consistent with the project's `_ms` INTEGER
  convention.
- No JSON columns of its own; `moduleOverrides`/`effectiveModules` are
  `Record<ModuleKey, boolean>` maps defined by the `subscriptions`
  domain — treat as a small enum-keyed struct in Rust, not a free-form JSON
  blob, since `ModuleKey` is a closed set (`@makanmakan/database`).

---

## 6. `verification` (mount: `/auth`, shared with `authentication`)

### Purpose

Password reset, email verification, and phone verification for **staff
users** (`users` table) — despite living at `/auth`, this is entirely
separate machinery from the `customer` module's phone-OTP login (different
table, different token scheme: opaque UUID tokens looked up by exact-match in
dedicated token tables, not JWTs). All business logic lives in
`packages/database`'s shared `VerificationService`
(`packages/database/src/services/VerificationService.ts`), reused verbatim by
both `authentication`'s password-reset methods and this module's routes — see
the route-collision ambiguity flagged in §1.

### Routes

| Method | Full path | Auth | Purpose | Request | Response |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/auth/forgot-password` | public, rate-limited (`RateLimitPresets.passwordReset`) | Request password reset via email or SMS | `{identifier,method:"email"\|"sms"}` | `{success,message}` — **shadowed/shadows authentication's handler of the same path, see §1** |
| GET | `/api/v1/auth/reset-password/verify` | public | Check reset-token validity (does not consume it) | `?token=` (UUID) | `{valid,userId?,email?(masked),error?}` |
| POST | `/api/v1/auth/reset-password` | public | Consume token, set new password | `{token,newPassword,confirmPassword}` | `{success,message}` — **route collision, see §1** |
| POST | `/api/v1/auth/verify-email/send` | authenticated (staff) | Send email verification link | `{email}` (rate-limited: `RateLimitPresets.emailVerification`) | `{success,message}` |
| GET | `/api/v1/auth/verify-email` | public | Consume email verification token | `?token=` (UUID) | `{success,message}` — **route collision, see §1** |
| POST | `/api/v1/auth/verify-phone/send` | authenticated (staff), rate-limited (`RateLimitPresets.smsOTP`) | Send phone OTP | `{phone}` | `{success,message}` |
| POST | `/api/v1/auth/verify-phone` | authenticated (staff) | Verify phone via OTP | `{phone,otpCode}` (6 digits) | `{success,message,attemptsLeft?}` |

### Business logic

**Password reset request** (`VerificationService.requestPasswordReset`):
looks up `users` by `email` or `phone` (caller must pick `method` explicitly
— no auto-detection, unlike `authentication`'s duplicate handler). If no user
found, still returns `{success:true, message:"如果該帳號存在，重設連結已發送"}`
— deliberate user-enumeration prevention (identical response whether or not
the account exists). Generates a UUID v4 `token` (**not** v7 — inconsistent
with the rest of the codebase's UUID-v7 convention, worth flagging), plus (for
SMS) a separate 6-digit OTP via `Math.floor(100000 + Math.random()*900000)`
(**`Math.random()`, not a CSPRNG** — unlike the customer OTP generator in
`customer/routes/index.ts` which uses `crypto.getRandomValues` with
rejection sampling; this is a real inconsistency in randomness quality between
the two OTP generators in the same codebase). Token expiry: 15 minutes.
Sends via `NotificationService` (email link `{appBaseUrl}/reset-password?token=`
or SMS with the OTP) — `resolveVerificationAppBaseUrl` derives the frontend
base URL from `CLIENT_BASE_URL`/`CORS_ORIGIN` (first non-wildcard origin) and
**throws in production** if neither is configured (no silent fallback to
localhost outside dev).

**Token verify / reset**: `verifyResetToken` checks `usedAt`/`expiresAt`
without consuming; `resetPassword` re-verifies then runs a **DB transaction**
(`this.db.transaction`) that atomically: updates `users.passwordHash` +
`passwordChangedAt` + bumps `tokenVersion` (`+1`, invalidating all existing
staff access tokens — see §1), marks the reset token `usedAt`, and inserts a
`password_change_logs` row (`changeMethod` inferred from whether the token
string contains a dash — a fragile heuristic to distinguish "reset_email" vs
"reset_sms" tokens, since both are just UUIDs; this only works because SMS
resets currently reuse the same UUID token format and the check is really
just "always true" for standard UUIDs — **this appears to be dead/broken
logic** worth flagging rather than silently reimplementing).

**Email verification**: UUID v4 token, 24h expiry, transaction sets
`emailVerificationTokens.verifiedAt` + `users.isVerified=true` +
`emailVerifiedAt`. Idempotent — verifying an already-verified token returns
`{success:true, message:"Email 已驗證"}` rather than erroring.

**Phone verification**: OTP via the same `Math.random()` 6-digit generator
(not CSPRNG — see above), 5-minute expiry, max 3 attempts
(`attemptCount >= 3` locks it out, requiring a fresh send), transaction sets
`phoneVerificationTokens.verifiedAt` + `users.phoneVerifiedAt`. Unlike email
verification, there is **no** `isVerified` flip here — phone and email
verification are tracked as separate timestamp fields on `users`
(`emailVerifiedAt`, `phoneVerifiedAt`), and only email verification sets the
overall `isVerified` boolean.

**Cleanup**: `VerificationService.cleanupExpiredTokens()` deletes expired rows
from all three token tables inside one transaction — exported for a
cron/scheduled caller (not invoked from any route in this module; presumably
wired into `apps/backup-scheduler` or similar, not verified in this pass).

### Data

- **Reads/writes**: `users` (lookup by email/phone/id; update
  `passwordHash`/`passwordChangedAt`/`tokenVersion`/`isVerified`/`emailVerifiedAt`/`phoneVerifiedAt`),
  `password_reset_tokens`, `email_verification_tokens`,
  `phone_verification_tokens`, `password_change_logs` (audit trail, insert
  only).
- **KV**: none directly in `VerificationService`; rate limiting for these
  routes goes through `apps/api/src/middleware/rateLimiter.ts`
  (`RateLimitPresets.passwordReset`/`emailVerification`/`smsOTP` — out of
  scope file, uses its own KV/backing store).
- **Notifications**: `NotificationService.sendNotification` (email/SMS
  dispatch — out of scope, `packages/database/src/services/NotificationService.ts`).
- **Alerts**: `AlertService.passwordResetAttempt` fires (Slack, presumably)
  specifically when a forgot-password request fails because the user wasn't
  found (string-matches on the Chinese error text `"找不到用戶"` — a fragile
  coupling between error-message text and alerting logic).
- **Events**: none published to a queue.

### Cross-module dependencies

- `packages/database`'s `VerificationService` — the actual implementation,
  **shared verbatim** with `authentication`'s password-reset delegation (see
  §1's `resolvePasswordResetTarget`/`requestPasswordReset` calling into the
  same service).
- `apps/api/src/services/AlertService.ts` (`passwordResetAttempt`).
- `apps/api/src/middleware/rateLimiter.ts` (`rateLimitMiddleware`,
  `RateLimitPresets`).
- `apps/api/src/middleware/auth.ts` (`customerAuthMiddleware` — despite the
  name, used here for **staff** users since it accepts roles 0–5 via `users`
  table JWTs, not `customers` table JWTs; naming is misleading across the
  codebase — `customerAuthMiddleware` really means "any `users`-table JWT
  including legacy role 5", distinct from `canonicalCustomerAuthMiddleware`
  which is the real customer-identity checker).

### Rust rewrite notes

- **UUID version inconsistency**: reset/verification tokens are UUID **v4**
  (`crypto.randomUUID()` default), while the rest of the schema standardizes
  on v7 for primary keys. This is intentional-by-omission, not a bug (tokens
  aren't sorted/indexed by creation order the way PKs are) — keep as v4 in
  Rust (`Uuid::new_v4()`) unless product wants to standardize, but don't
  silently "fix" it to v7 since that changes nothing functionally and adds
  risk.
- **Non-CSPRNG OTP** (`Math.random()`-based 6-digit codes for password-reset
  SMS and phone verification): flag this explicitly as a **security gap**
  relative to the customer module's proper CSPRNG-with-rejection-sampling OTP
  generator. Recommend fixing in the Rust port (use `rand::rngs::OsRng` or
  equivalent) rather than porting the weaker generator as-is — this is worth
  raising with the product/security owner before porting, not silently
  carrying forward.
- **Fragile `changeMethod` heuristic** (dash-in-token string check) — do not
  port this logic; if audit-log method attribution matters, thread the actual
  method (`"email"`/`"sms"`) through the call chain explicitly instead of
  inferring it from token format.
- **Alert coupling to error-message string matching** (`"找不到用戶"`) — in
  Rust, use a typed result/error variant instead of matching on
  human-readable message text.
- **bcrypt**: password hashing on reset uses the same cost-10 pattern via a
  local `hashPassword` helper inside `VerificationService.ts` (imports
  `bcryptjs` dynamically) — keep cost 10 for compatibility.
- **Transactions**: reset-password, email-verify, and phone-verify all use
  Drizzle's `db.transaction()` for atomic multi-table writes — replicate with
  real SQL transactions in Rust (D1 supports `BEGIN`/`COMMIT` via the
  Workers binding; a native Rust rewrite would use whatever transaction
  primitive its D1/SQLite driver exposes).
- **Timestamps**: all `*_ms` INTEGER via `timestamp_ms` Drizzle mode,
  consistent with project convention.

---

## 7. `restaurants` (mount: `/restaurants`)

### Purpose

Restaurant CRUD, public discovery (list/popular/nearby/detail), contact
profile (messaging channels + FAQs), restaurant "service items" (bookable
add-on services, e.g. haircuts/spa slots), market-membership join requests,
and the **shop-level QR code** lifecycle (generate/regenerate/verify/upload
image/enable "shop mode") used by vendors without per-table seating (e.g. a
single chicken-rice stall). Creating a restaurant provisions a matching
**management-API tenant** and a **default subscription** as side effects —
this module is a significant cross-service orchestration point, not just a
CRUD wrapper.

### Routes

| Method | Full path | Auth | Purpose | Request | Response |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/restaurants` | public (`optionalAuth`) | List/filter restaurants | `?page,limit,type,district,isAvailable` | `{success,data:Restaurant[],pagination}` |
| GET | `/api/v1/restaurants/popular` | public | Top restaurants by orders/rating | `?limit` | `{success,data:Restaurant[]}` |
| GET | `/api/v1/restaurants/nearby/:district` | public | Restaurants in a district | `?limit` | `{success,data:Restaurant[]}` |
| POST | `/api/v1/restaurants` | role 0 | Create restaurant | `CreateRestaurantData` | `{success,data:Restaurant}` (201) |
| GET | `/api/v1/restaurants/:id/contact-profile` | public (`optionalAuth`; inactive FAQs visible to owner/admin) | Messaging channels + FAQs | — | `{success,data:ContactProfile}` |
| PUT | `/api/v1/restaurants/:id/contact-profile` | role 0/1 (owner scoped to own) | Replace messaging channels + FAQs | `{messagingChannels,faqs[]}` | `{success,data:ContactProfile}` |
| GET | `/api/v1/restaurants/:id/service-items` | public (`optionalAuth`; owner/admin sees inactive too) | List service items | — | `{success,data:ServiceItem[]}` |
| POST | `/api/v1/restaurants/:id/service-items` | role 0/1 | Create a service item | `RestaurantServiceItemInput` | `{success,data:ServiceItem}` (201) |
| PUT | `/api/v1/restaurants/:id/service-items/:serviceItemId` | role 0/1 | Update a service item | partial | `{success,data:ServiceItem}` |
| DELETE | `/api/v1/restaurants/:id/service-items/:serviceItemId` | role 0/1 | Soft-delete a service item | — | `{success,message}` |
| GET | `/api/v1/restaurants/:id` | public | Restaurant detail | — | `{success,data:Restaurant}` |
| GET | `/api/v1/restaurants/:id/markets` | role 0/1 | Market memberships | — | `{success,data}` |
| GET | `/api/v1/restaurants/:id/market-join-requests` | role 0/1 | Join-request history | — | `{success,data}` |
| POST | `/api/v1/restaurants/:id/market-join-requests` | role 0/1 | Request to join a market | `CreateMarketJoinRequest` | `{success,data:{request}}` (201) or 409 (`ALREADY_MARKET_MEMBER`/`MARKET_JOIN_REQUEST_PENDING`) |
| PUT | `/api/v1/restaurants/:id` | role 0/1 (owner scoped to own) | Update restaurant | `UpdateRestaurantData` | `{success,data:Restaurant}` |
| DELETE | `/api/v1/restaurants/:id` | role 0 | Deactivate (soft delete) | — | `{success,message}` |
| GET | `/api/v1/restaurants/:id/stats` | role 0/1 (owner scoped to own) | Restaurant stats | — | `{success,data:EnhancedRestaurantStats}` (mostly zeroed placeholders, see below) |
| POST | `/api/v1/restaurants/:id/qr/shop/generate` | role 0/1 (owner scoped to own) | Generate shop QR (idempotent if exists) | — | `{success,data:{qrCode,qrCodeImageUrl,version}}` (201) |
| POST | `/api/v1/restaurants/:id/qr/shop/regenerate` | role 0/1 (owner scoped to own) | Force-rotate shop QR (bumps version) | — | `{success,data,message}` |
| GET | `/api/v1/restaurants/:id/qr/shop` | role 0/1 (owner scoped to own) | Shop QR info | — | `{success,data:ShopQrCodeInfo}` |
| POST | `/api/v1/restaurants/:id/qr/shop/upload-image` | role 0/1 (owner scoped to own) | Attach a rendered QR image URL | `{imageUrl}` | `{success,message}` |
| PUT | `/api/v1/restaurants/:id/shop-mode` | role 0/1 (owner scoped to own) | Enable/disable shop mode | `{enabled,settings?}` | `{success,message}` |

Public verification of a shop QR code lives in the **`qr-codes`** feature
(`GET /api/v1/qr/verify/shop/:qrCode`), which dynamically imports
`RestaurantsService` — see §9.

### Business logic

**Restaurant creation** (`RestaurantsService.createRestaurant`): three
sequential side effects after the base insert, each a potential rollback
point:
1. `ManagementTenantClient.provisionRestaurantTenant(...)` — HTTP call to
   `apps/management-api`. On failure, the just-inserted restaurant is
   **deactivated** (`dbService.deactivateRestaurant`, best-effort — a
   secondary failure here is only logged) and the original error re-thrown.
   Same saga-without-transaction pattern as `users`' owner-linkage flow.
2. `attachNearestActiveMarketIfPresent` — if the restaurant has
   lat/lng, scans all active `markets`, computes point-in-boundary
   (`pointInGeoJsonBoundary`) or haversine distance
   (`distanceKm`, from `../../markets/services/geo.ts`) to each market's
   center, picks the nearest, and **auto-attaches** a
   `restaurant_market_memberships` row (`isPrimary` = true only if no
   existing primary membership) if within `AUTO_ATTACH_MARKET_RADIUS_KM = 2`
   km (or literally inside the market's GeoJSON boundary, distance 0).
   Failure here is logged only, non-fatal (restaurant creation still
   succeeds without a market attachment).
3. `SubscriptionService.provisionDefaultForRestaurant` — creates the default
   (trial) subscription row; not wrapped in try/catch at this call site, so a
   failure here **would** propagate and fail the whole create-restaurant
   request even though the restaurant + tenant were already provisioned
   upstream — an inconsistency worth flagging (steps 1–2 are defensively
   guarded, step 3 is not).

**Restaurant stats are mostly placeholders**: `getRestaurantStats` returns a
hard-coded zero/empty shape for `totalOrders`, `todayOrders`,
`totalRevenue`, `todayRevenue`, `averageOrderValue`, `occupiedTables`,
`popularItems`, `ordersByHour`, `customerRetention` — only
`activeMenuItems`/`totalTables` come from a real query
(`dbService.getRestaurantStats`, a `menuItems`/`tables`/`users` count join).
**Do not port the placeholder zeros as if they were real metrics** — this is
explicitly unimplemented in the current TS code and should either be properly
implemented in Rust (joining `orders`) or kept as an explicitly-marked stub.

**Shop QR lifecycle** (`packages/database/src/services/restaurant.ts:324`):
- `generateShopQrCode`: idempotent — if `shopQrCode` already set, returns it
  unchanged. Otherwise mints `SHOP-{restaurantId}-{unixSeconds}` and sets
  `shopQrVersion=1` with a default settings object
  (`displayName`,`instructions`,`requirePhone:true`).
- `regenerateShopQrCode`: **always** mints a new code (same format, new
  timestamp), increments `shopQrVersion`, and **clears**
  `shopQrCodeImageUrl` to `null` (the caller must re-upload a rendered image
  for the new code).
- `verifyShopQrCode`: format-gate (`qrCode.startsWith("SHOP-")`) then exact
  match against `restaurants.shopQrCode` + `isActive=true`. **Note the QR
  "format" is not actually validated beyond the prefix** — the embedded
  restaurantId/timestamp segments are never parsed or checked; the DB lookup
  is the real source of truth. A regex like `^SHOP-[A-Za-z0-9-]+$` is used
  only at the **qr-codes** feature's param-validation layer, not here.
- `updateShopMode(enabled=true)`: if enabling and no QR code exists yet,
  transparently calls `generateShopQrCode` first (auto-provision on enable).
- QR **image rendering** itself (turning the `SHOP-...` string into an actual
  PNG/SVG) is **not done by this module** — `upload-image` just stores a
  caller-supplied `imageUrl` (validated as a URL, nothing else) into
  `shopQrCodeImageUrl`. The actual rendering happens client-side or via the
  `qr-codes` feature's `/generate`/`/download` endpoints, which are generic
  QR renderers unaware of the "shop QR" concept specifically.

**Contact profile / service items**: both are pure CRUD scoped by
`restaurantId` + soft-delete (`deletedAt IS NULL`) with owner-vs-admin
authorization identical to the rest of this module
(`assertCanManageRestaurant`). `updateContactProfile` **replaces** all FAQs
(`DELETE` then bulk `INSERT`) rather than diffing — a full-replace write
pattern, not incremental.

**Market cache versioning**: any service-item or market-membership mutation
calls `bumpMarketPublicCacheVersion()`, incrementing a single global KV
counter `markets:version` — used elsewhere (markets feature, out of scope) as
a cache-busting signal for public market pages that aggregate data across
restaurants.

### Data

- **Reads/writes**: `restaurants`, `restaurant_faqs` (full-replace on
  contact-profile update), `restaurant_service_items` (soft-delete),
  `restaurant_market_memberships` (auto-attach on create), `markets`
  (read-only, for nearest-market lookup).
- **KV (`CACHE_KV`)**: `restaurant:{id}`, `restaurant:{id}:stats`,
  `restaurant:{id}:shop-qr`, `restaurants:list:*`, `restaurants:nearby:*`,
  `restaurants:popular:*` (all medium/short TTL per `CACHE_TTL` constants,
  invalidated on writes), plus the global `markets:version` counter.
- **Cross-service HTTP**: `ManagementTenantClient.provisionRestaurantTenant`
  (create) — into `apps/management-api`.
- **Events**: `emitEvent` is a **no-op logger only** (`RESTAURANT_CREATED`,
  `RESTAURANT_UPDATED`, `RESTAURANT_DEACTIVATED`) — nothing is actually
  published to any bus/queue despite the naming; do not assume downstream
  consumers exist for these "events" today.

### Cross-module dependencies

- `packages/database`: `RestaurantService` (`generateShopQrCode` et al.,
  base CRUD), Drizzle schema for `restaurants`/`restaurantFaqs`/
  `restaurantServiceItems`/`restaurantMarketMemberships`/`markets`.
- `apps/api/src/features/subscriptions/services/SubscriptionService.ts`
  (`provisionDefaultForRestaurant`) — called synchronously during restaurant
  creation.
- `apps/api/src/services/managementTenantClient.ts`
  (`provisionRestaurantTenant`) — same client used by `users`.
- `apps/api/src/features/markets/services/MarketsService.ts` +
  `apps/api/src/features/markets/services/geo.ts` (`distanceKm`,
  `pointInGeoJsonBoundary`) — market membership + geo math.
- `apps/api/src/features/markets/schemas/validation.ts`
  (`createMarketJoinRequestSchema`).
- `apps/api/src/features/discovery/services/SearchIndexSyncService.ts`
  (`onRestaurantChanged`) — invoked after every restaurant update from the
  route layer (not the service), to keep a search index current.
- Depended on by: `qr-codes` (shop-QR verification dynamically imports this
  module's `RestaurantsService`), `menu` (checks
  `isPublicRestaurantAvailable`).

### Rust rewrite notes

- **Best-effort saga steps** (tenant provisioning, market auto-attach) vs
  **unguarded step** (subscription provisioning) — decide explicitly in Rust
  whether restaurant creation should be a true multi-step saga with
  compensations for *all* three side effects, or accept the current
  inconsistency; do not silently "fix" by making all three equally
  best-effort or all three equally strict without a product decision, since
  that changes observable failure behavior (currently: subscription
  provisioning failure blocks restaurant creation entirely; the other two
  don't).
- **IDs**: `restaurants.id` is `TEXT` UUID v7 (per project convention);
  `restaurant_faqs.id`/`restaurant_service_items.id` are integer
  autoincrement (check `packages/database/src/schema/restaurants.ts` and the
  FAQ/service-item schema files directly for exact types before writing Rust
  structs — this doc did not re-verify every child table's PK type).
- **JSON columns**: `restaurants.messagingChannels`,
  `restaurants.businessHours`, `restaurants.shopQrSettings`,
  `restaurant_service_items.availableHours`/`tags` — all Drizzle `json` mode
  `text` columns; keep as JSON in Rust/SQLite unless normalizing, and
  preserve the "strip empty string values" behavior of
  `removeEmptyChannels()` for `messagingChannels` writes.
- **Shop QR code format**: `SHOP-{restaurantId}-{unixSeconds}` is
  **generated**, not cryptographically random — a Rust port could keep this
  exact format for backward compatibility with already-printed QR codes in
  the field, or note that the format itself carries no security properties
  (uniqueness relies on the DB unique constraint on `shopQrCode`, not on the
  string's unguessability) — flag this rather than silently strengthening it,
  since strengthening would invalidate all existing printed QR codes.
- **Timestamps**: standard `_ms` INTEGER via Drizzle throughout.
- **No real event bus**: `emitEvent` calls are inert — do not port them as if
  wiring into a real Rust event system is "restoring" prior behavior; this is
  new work if the product wants it.

---

## 8. `menu` (mount: `/menu`)

### Purpose

Menu-item and category CRUD, public menu retrieval (full menu / featured /
popular / search), batch operations (availability/price/category-move), and
analytics/popularity endpoints, scoped per-restaurant. Menu items are
**integer**-keyed (legacy autoincrement), unlike most newer domain tables.
Image handling for menu items is a **split responsibility**: this API module
only stores/returns `imageUrl`/`imageId`/`imageVariants` fields — the actual
image upload, transformation, and Cloudflare Images integration happens in
the separate `apps/image-processor` Worker, called directly by the
admin-dashboard frontend (not proxied through this module). See "Image
pipeline" below — this is the most important architectural note for this
module.

### Routes

| Method | Full path | Auth | Purpose | Request | Response |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/menu/:restaurantId` | public (`optionalAuth`; `?includeAll=true` for admin/owner shows unavailable items) | Full menu structure | `?includeAll` | `{success,data:MenuStructure}` |
| GET | `/api/v1/menu/:restaurantId/featured` | public | Featured items | `?limit` | `{success,data:MenuItem[]}` |
| GET | `/api/v1/menu/:restaurantId/popular` | public | Popular items | `?limit` | `{success,data:MenuItem[]}` |
| GET | `/api/v1/menu/:restaurantId/search` | public | Search/filter items | `?categoryId,minPrice,maxPrice,spiceLevel,dietaryPreferences,isFeatured,search,page,limit` | `{success,data:MenuItem[],pagination}` |
| GET | `/api/v1/menu/items/:id` | public (`optionalAuth`) | Item detail (async view-count increment) | — | `{success,data:MenuItem}` |
| POST | `/api/v1/menu/:restaurantId/items` | role 0/1/2 + `moduleGate("menu_management")` + restaurant-access | Create menu item | `CreateMenuItemData` (incl. `imageUrl?`,`imageId?`,`imageVariants?`) | `{success,data:MenuItem}` (201) |
| PUT | `/api/v1/menu/items/:id` | role 0/1/2 + `moduleGate("menu_management")` (owner scoped to own restaurant) | Update menu item | `UpdateMenuItemData` | `{success,data:MenuItem}` |
| DELETE | `/api/v1/menu/items/:id` | role 0/1 + `moduleGate("menu_management")` (owner scoped) | Soft-delete (sets `isAvailable=false,sortOrder=-1`) | — | `{success,message}` |
| PATCH | `/api/v1/menu/:restaurantId/items/availability` | role 0/1/2 + module gate + restaurant-access | Bulk availability toggle | `{updates:[{id,isAvailable}]}` | `{success,message}` |
| PATCH | `/api/v1/menu/:restaurantId/items/prices` | role 0/1 + module gate + restaurant-access | Bulk price update | `{updates:[{id,price,originalPrice?}]}` | `{success,message}` |
| PATCH | `/api/v1/menu/:restaurantId/items/categories` | role 0/1 + module gate + restaurant-access | Bulk category move | `{updates:[{id,categoryId}]}` | `{success,message}` |
| POST | `/api/v1/menu/:restaurantId/categories` | role 0/1 + module gate + restaurant-access | Create category | `CreateCategoryData` | `{success,data:Category}` (201) |
| PUT | `/api/v1/menu/categories/:id` | role 0/1 + module gate (owner scoped) | Update category | partial | `{success,data:Category}` |
| PATCH | `/api/v1/menu/:restaurantId/categories/reorder` | role 0/1 + module gate + restaurant-access | Bulk reorder | `{categories:[{id,sortOrder}]}` | `{success,message}` |
| DELETE | `/api/v1/menu/categories/:id` | role 0/1 + module gate (owner scoped) | Delete category (blocked if it has items) | — | `{success,message}` or 409 (`CATEGORY_HAS_MENU_ITEMS`) |
| GET | `/api/v1/menu/:restaurantId/analytics` | role 0/1 + module gate + restaurant-access | Menu analytics | — | `{success,data:MenuAnalytics}` |
| GET | `/api/v1/menu/:restaurantId/popularity` | role 0/1 + module gate + restaurant-access | Popularity metrics (most-ordered/viewed/rated/recent) | — | `{success,data:PopularityMetrics}` |

### Business logic

**Category ownership validation**: `createMenuItem`/`updateMenuItem` (on
category change) call `validateCategoryAccess(categoryId, restaurantId)` —
loads the category and throws `forbidden` (`CATEGORY_RESTAURANT_MISMATCH`) if
its `restaurantId` doesn't match, preventing cross-restaurant category
assignment even by an admin's request body manipulation (the check is
unconditional, not role-gated).

**Delete is soft**: `deleteMenuItem` never removes the row — it sets
`isAvailable=false, sortOrder=-1`. `deleteCategory` first checks for any
menu items still assigned to it (`searchMenuItems({categoryId}, limit:1)`) and
**refuses** (409) if any exist — categories can only be "deleted"
(`isActive=false`) once emptied.

**Search-index sync**: every mutating route (create/update/delete item,
batch ops, category create/update/delete/reorder) calls
`syncMenuItems`/`syncCategoryItems` (thin wrappers around
`createSearchIndexSync(env).onMenuItemChanged`/`onCategoryChanged`) —
fire-and-await (not `waitUntil`) after the mutation but before the response
is returned, so search-index failures would currently surface as a 500 on an
otherwise-successful mutation (worth flagging: no try/catch isolates this
side effect from the primary write's success response).

**View-count increment is async-fire-and-forget**: `GET /items/:id` calls
`c.executionCtx.waitUntil(service.incrementViewCount(id))` — explicitly
non-blocking, unlike the search-index sync above. In Rust (outside a Workers
`waitUntil` context), this needs an equivalent background-task mechanism
(e.g. spawn a detached task) if the "don't block the response on this write"
property is to be preserved.

**Public availability gate**: every public (non-`includeAll`) menu read first
calls `isPublicRestaurantAvailable(restaurantId)` (checks
`restaurants.isActive=true AND deletedAt IS NULL`) and 404s otherwise — this
guard is duplicated per-route rather than centralized in middleware.

**Money representation**: menu item prices are stored as `priceCents`/
`originalPriceCents`/`costPriceCents` (`INTEGER`) in the DB but the
feature/API layer works in **decimal currency units** (`price: number`, e.g.
`12.50`) — conversion happens inside `packages/database`'s `MenuService`
(`toCents`/`amountFromCents`, `packages/database/src/utils/money.ts`, not
itself in scope but load-bearing for every price field in this module's
request/response shapes).

### Image pipeline (Cloudflare Images / image-processor integration)

This module's own code (`MenuService`, routes) treats `imageUrl` (string
URL), `imageId` (UUID string, nullable — FK-like reference to the separate
`images` table, no DB-level foreign key constraint enforced per the schema
comment "供換圖刪舊", i.e. "for finding the old image to delete on
replacement"), and `imageVariants` (JSON: `{thumbnail,small,medium,large}`
URLs) as **opaque pass-through fields** — it validates their *shape* (Zod:
`imageUrl` must be an `https?://` URL, a leading-`/` path, or a ≤10MB
`data:image/{jpeg,png,webp,gif};base64,...` data URL; `imageId` must be a
UUID; `imageVariants` values must each be a URL or null/undefined) but never
calls Cloudflare Images, never talks to `apps/image-processor`, and never
deletes an old image when a new one replaces it.

The **actual** upload/replace/cleanup flow (verified in
`apps/admin-dashboard`, not part of this doc's target modules but essential
context for anyone rewriting this API's contract):
1. Admin UI uploads the file **directly** to
   `${VITE_IMAGE_API_URL}/images/upload?category=menu` (the separate
   `apps/image-processor` Worker), authenticated with a bearer token from
   `getAuthToken()` (a frontend utility reading the auth-client's live
   token — **not** the Pinia store's cached ref, because that can lag behind
   silent refreshes; this is a documented gotcha in
   `apps/admin-dashboard/src/composables/useImageUpload.ts`).
2. `image-processor` validates that same staff JWT independently (its own
   `middleware/auth.ts` requires `{sub: UUID v7, restaurantId}` — no legacy
   integer-ID tokens accepted) and returns `{id, variants:{thumbnail,small,
   medium,large,...}}` after uploading to Cloudflare Images.
3. The frontend picks exactly `{thumbnail,small,medium,large}` from the
   response (extra variant keys, if any, are dropped client-side, and would
   also be stripped server-side by this module's Zod schema regardless) and
   calls **this module's** `PUT /menu/items/:id` with
   `{imageId, imageUrl: variants.medium, imageVariants}` to write the
   reference back onto the menu item row.
4. If the item previously had a **different** `imageId`, the frontend issues
   a separate `DELETE {VITE_IMAGE_API_URL}/images/{oldImageId}` against
   `image-processor` to clean up the orphaned upload — **this cleanup is
   entirely client-orchestrated**; if the client crashes/navigates away
   between steps 3 and 4, the old image is never deleted (no server-side
   reconciliation job for this exists as of this reading).

**For the Rust rewrite**: the `menu` API surface itself needs no Cloudflare
Images SDK integration — it only needs to accept/store/return these three
fields with the same validation shape. The `image-processor` Worker (separate
app, out of scope for this doc) is where the actual Images API calls and
`getAuthToken`-compatible JWT verification live. If the Rust rewrite plan
intends to also move upload orchestration server-side (proxied through the
main API instead of direct-to-image-processor from the browser), that is a
**new** design, not a port of existing behavior — flag any such change
explicitly since it alters the trust boundary (currently the browser holds a
staff JWT and calls a second Worker directly).

### Data

- **Reads/writes**: `menu_items` (integer PK, `restaurant_id` TEXT FK-by-
  convention, `image_id` TEXT nullable, `image_variants` JSON, `price_cents`/
  `original_price_cents`/`cost_price_cents` INTEGER cents, `options`/
  `dietary_info`/`allergens`/`tags`/`available_hours` all JSON columns),
  `categories` (read-only from this module's own code path aside from the
  category CRUD methods), `restaurants` (read-only, availability gate).
- **KV**: none directly in the feature-layer `MenuService` shown here (the
  underlying `packages/database` `MenuService.getMenu` does use a
  `cachedQuery` wrapper with a cache key — verify that service's own caching
  behavior separately if porting cache semantics).
- **Cross-service**: `SearchIndexSyncService` (fire-and-await, not
  `waitUntil`, on every mutation).
- **Events**: none published to a bus.

### Cross-module dependencies

- `packages/database`: `MenuService` (money conversion, category/menu-item
  CRUD, `getMenu` structure assembly with `with: {categories: {with:
  {menuItems}}}` Drizzle relational query).
- `apps/api/src/features/discovery/services/SearchIndexSyncService.ts` —
  `onMenuItemChanged`, `onCategoryChanged`.
- `apps/image-processor` (separate Worker, **not** called server-side by this
  module — called directly by the frontend; see Image pipeline above).
- `apps/api/src/middleware/moduleGate.ts` (`menu_management` module key).
- Depended on by: `restaurants` module doesn't call into `menu`, but `menu`
  depends on `restaurants` for the public-availability gate; `ingredients`
  module's `RecipeService` reads `menu_items` directly (join for recipe
  validation) — a data-layer coupling, not a service-call coupling.

### Rust rewrite notes

- **Integer PKs for `menu_items`/`categories`**: unlike most newer tables,
  these remain `INTEGER AUTOINCREMENT` per the project's mixed-ID-strategy
  convention (CLAUDE.md: "existing integer-autoincrement tables are still
  valid until a scoped migration retires them") — do not "upgrade" these to
  UUID v7 as part of a Rust port unless a migration is explicitly planned;
  keep `i64`/`i32` IDs.
- **Money**: `priceCents` etc. as `i64` cents in Rust; the API-facing
  decimal↔cents conversion currently lives in the shared `packages/database`
  layer (`toCents`/`amountFromCents`) — replicate that conversion at
  whichever layer becomes the Rust equivalent of that boundary, and pin down
  rounding rules (verify `packages/database/src/utils/money.ts` directly
  before implementing, as this doc did not deep-dive that helper).
- **JSON columns**: `image_variants`, `options`, `dietary_info`, `allergens`,
  `tags`, `available_hours` — all Drizzle `{mode:"json"}` `text` columns.
  Preserve as JSON text (or normalize with a documented migration) — do not
  silently assume a fixed shape stricter than the current permissive Zod
  schemas (e.g. `imageVariants` fields are individually nullable/optional;
  `options.customizations[].choices[]` is a nested array of objects with
  optional fields).
- **`imageId` has no DB-level FK constraint** to an `images` table despite
  the "for delete-old-on-replace" comment — if the Rust schema adds a real FK,
  confirm the `images` table's lifecycle (created by `image-processor`, a
  separate Worker/database context) doesn't violate referential integrity
  across what may be two different D1 databases/bindings; do not assume
  same-database FK enforcement is safe without checking `image-processor`'s
  binding config.
- **Trust boundary**: the browser calls `image-processor` directly with a
  staff JWT; a Rust rewrite of the `menu` API does not need to broker this
  call, but must continue accepting whatever `imageId`/`imageVariants` shape
  the frontend sends after that direct upload — treat this API purely as a
  "write-back" endpoint for image metadata, not an upload endpoint itself.
- **Fire-and-await search-index sync in the request path**: consider making
  this genuinely async/fire-and-forget in the Rust port (matching the
  view-count increment's `waitUntil` pattern) rather than blocking the
  mutation response on search-index success — but this is a **behavior
  change** from the current TS code, so flag it explicitly as a deliberate
  improvement rather than an accidental deviation if adopted.
- **Timestamps**: `created_at_ms`/`updated_at_ms`/`deleted_at_ms` INTEGER,
  standard convention.

---

## 9. `ingredients` (mount: `/ingredients`)

### Purpose

Restaurant-scoped ingredient master data (name/unit/cost/stock/category) plus
per-menu-item "recipes" (bill-of-materials linking `menu_items` to
`ingredient_definitions` with a quantity-per-serving) for basic inventory
costing/validation. Gated behind the `inventory` subscription module and
restricted to admin/owner (role 0/1) for every route — no chef/service/
cashier access at all, unlike `menu` which allows chefs to manage items.

### Routes

| Method | Full path | Auth | Purpose | Request | Response |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/ingredients/:restaurantId` | role 0/1 + `moduleGate("inventory")` | List ingredients | `?page,limit,category,search,includeInactive` | `{success,data:{items,total}}` |
| POST | `/api/v1/ingredients/:restaurantId` | role 0/1 + module gate | Create ingredient | `CreateIngredientRequest` | `{success,data:{ingredient}}` (201) |
| POST | `/api/v1/ingredients/:restaurantId/bulk` | role 0/1 + module gate | Bulk import (max 500) | `{ingredients:[...]}` | `{success,data:{imported}}` (201) |
| GET | `/api/v1/ingredients/:restaurantId/categories` | role 0/1 + module gate | Distinct active categories | — | `{success,data:{categories:string[]}}` |
| GET | `/api/v1/ingredients/:restaurantId/recipes/missing` | role 0/1 + module gate | Menu items with no recipe defined | — | `{success,data:{menuItems}}` |
| GET | `/api/v1/ingredients/:restaurantId/:id` | role 0/1 + module gate | Get one ingredient | — | `{success,data:{ingredient}}` or 404 |
| PUT | `/api/v1/ingredients/:restaurantId/:id` | role 0/1 + module gate | Update ingredient | partial | `{success,data:{ingredient}}` or 404 |
| PATCH | `/api/v1/ingredients/:restaurantId/:id/stock` | role 0/1 + module gate | Set current stock level | `{quantity}` | `{success,data:{updated:true}}` |
| DELETE | `/api/v1/ingredients/:restaurantId/:id` | role 0/1 + module gate | Soft-delete (blocked if used in a recipe) | — | `{success,data:{deleted:true}}` or 409 (`INGREDIENT_IN_USE`) |
| GET | `/api/v1/ingredients/:restaurantId/recipes/:menuItemId` | role 0/1 + module gate | Get a menu item's recipe | — | `{success,data:{recipe}}` |
| PUT | `/api/v1/ingredients/:restaurantId/recipes/:menuItemId` | role 0/1 + module gate | Replace a menu item's recipe | `{ingredients:[{ingredientId,quantityPerServing,unit,isOptional?}]}` | `{success,data:{updated:true}}` |
| POST | `/api/v1/ingredients/:restaurantId/recipes/:menuItemId/validate` | role 0/1 + module gate | Validate recipe integrity | — | `{success,data:{valid,errors[]}}` |

Note: none of these routes use `requireRestaurantAccess("restaurantId")` —
authorization is purely `requireRole([0,1])`, meaning **an owner (role 1) for
one restaurant can read/write another restaurant's ingredients by supplying a
different `:restaurantId` in the path**, since the service layer filters
queries by the path param, not by the caller's own `restaurantId`. This is a
likely **authorization gap** relative to every other module in this doc
(`restaurants`, `menu`, `qr-codes` all explicitly check
`user.restaurantId !== id` for owners) — flag prominently; do not port this
gap silently into Rust without a product/security decision, since it's
inconsistent with the rest of the codebase's owner-scoping pattern.

### Business logic

**Ingredient CRUD**: straightforward per-restaurant scoped Drizzle
queries, soft-delete via `deletedAt`+`isActive=false`. Cost is stored as
`costPerUnitCents` (cents) and converted via `toCents`/`fromCents`
(`apps/api/src/shared/utils/money.ts` — a **different** money-utility module
path than the one used by `menu`'s DB-layer conversion; verify whether these
are the same conversion semantics or two independent implementations before
assuming interchangeability in Rust).

**Recipe replace is full-replace, not diff**: `setRecipe` runs inside a
`db.transaction`: deletes **all** existing `menu_item_ingredients` rows for
the menu item, then bulk-inserts the new set (skipped entirely if the new
array is empty, leaving the item with zero ingredients).

**Recipe validation** (`validateRecipe`): left-joins recipe entries against
`ingredient_definitions` and reports, per entry: "does not exist" (join
found no row), "has been deleted" (`deletedAt` set), or "is inactive"
(`isActive=false`) — plus an overall `valid: errors.length === 0`. An empty
recipe (`recipe.length === 0`) is itself reported as invalid with
`"No recipe entries found for this menu item"`.

**Delete-guard via usage check happens in the route, not the service**:
`DELETE /:restaurantId/:id` calls `RecipeService.getIngredientUsage(id)`
*before* calling `IngredientService.delete` — if any recipe references the
ingredient, it 409s with the list of affected menu item names joined by
comma, and never calls delete at all. This ordering (usage-check in the
route handler rather than inside a single service method) means any future
new caller of `IngredientService.delete` directly would **not** get this
protection automatically — worth centralizing in Rust.

**Missing-recipes query**: `getMenuItemsWithoutRecipes` uses a
`NOT IN (subquery)` pattern (`notInArray(menuItems.id, usedMenuItemIds)`
where `usedMenuItemIds` is a `selectDistinct` subquery over
`menu_item_ingredients`) restricted to `isAvailable=true, deletedAt IS NULL`
items for the given restaurant.

### Data

- **Reads/writes**: `ingredient_definitions` (soft-delete via `deletedAt`),
  `menu_item_ingredients` (full-replace per recipe), read-only joins against
  `menu_items` (for recipe validation/usage/missing-recipe queries).
- **KV**: none.
- **Events**: none.

### Cross-module dependencies

- `packages/database`: `ingredientDefinitions`, `menuItemIngredients`,
  `menuItems` Drizzle schema objects (Layer 1/2 query builder style, no raw
  SQL).
- `apps/api/src/shared/utils/money.ts` (`fromCents`/`toCents`) — confirm
  whether this is the same helper module as `packages/database/src/utils/money.ts`
  used elsewhere (this doc did not cross-check byte-for-byte).
- Data-layer coupling (not service call) with `menu`: reads `menu_items`
  directly for recipe-related queries rather than going through
  `MenuService`.

### Rust rewrite notes

- **Fix or explicitly preserve the missing `requireRestaurantAccess` check**
  — this is the single most important finding for this module. Decide with
  the product/security owner whether the Rust port should add
  owner-restaurant scoping (recommended) or intentionally preserve the
  current "any owner can touch any restaurant's ingredients by path param"
  behavior (not recommended, but must be a conscious choice either way, not
  an oversight).
- **IDs**: `ingredient_definitions.id`/`menu_item_ingredients` — verify exact
  PK types in `packages/database/src/schema/` before writing Rust structs
  (not fully re-verified in this pass; the service code treats ingredient IDs
  as `number`, suggesting integer autoincrement, consistent with
  `menu_items.id`).
- **Money**: cents-based storage (`costPerUnitCents`) — straightforward `i64`
  in Rust; confirm rounding/conversion parity with whichever money helper the
  Rust codebase standardizes on.
- **Transactional full-replace pattern** for recipes — replicate with a real
  transaction (delete-then-insert) in Rust; do not attempt to "improve" to a
  diff-based upsert without confirming callers don't rely on the current
  wholesale-replace semantics (e.g. removing an ingredient from the recipe by
  simply omitting it from the array is the existing UX contract).
- **Centralize the delete-usage-guard** inside the ingredient deletion logic
  itself (service layer) rather than leaving it as a route-handler-only
  check, closing the gap where a future direct service caller could bypass
  it.
- **Timestamps**: standard `_ms` INTEGER.

---

## 10. `qr-codes` (mount: `/qr`, public routes block)

### Purpose

Generic QR code generation (single + bulk), template management (visual style
presets), download rendering (PNG/SVG, on-demand — **not** pre-rendered/
stored), usage statistics, and the two **public QR-verification** endpoints
used by customer-facing scan flows: shop-level (`/qr/verify/shop/:qrCode`,
delegates to `restaurants`' `verifyShopQrCode`) and market-level
(`/qr/verify/market/:slug`, delegates to `markets`' `getMarketBySlug`). This
module owns the QR **rendering** primitives (via the `qrcode` npm package and
`fflate` for zip archives) but does **not** own the shop-QR *business*
lifecycle (generate/regenerate/enable) — that lives in `restaurants` (§7);
this module's `/generate` and `/bulk` endpoints are a separate, more generic
QR-image service (used for arbitrary content strings, historically table
QR codes) that happens to share the `qr_codes`/`qr_batches` DB tables.

### Routes

| Method | Full path | Auth | Purpose | Request | Response |
| --- | --- | --- | --- | --- | --- |
| POST | `/api/v1/qr/generate` | role 0/1/2/3/4 | Generate + persist a single QR code record | `{content,format?,style?,metadata?}` | `{success,data:QRCodeEntity}` (201) |
| POST | `/api/v1/qr/bulk` | role 0/1 | Create a QR **batch** record (table-QR provisioning) | `{tables:[{id,name,content,customStyle?}],format?,...}` | `{success,data:QRBatchEntity}` (201) |
| GET | `/api/v1/qr/:id/download` | role 0/1/2/3/4 (restaurant-scoped for non-admin) | Render + download one QR code | — | binary (PNG/SVG), `Content-Disposition: attachment` |
| GET | `/api/v1/qr/batch/:batchId/download` | role 0/1/2/3/4 (restaurant-scoped) | Render + download a zip of the batch's QR codes | — | `application/zip` binary |
| GET | `/api/v1/qr/stats` | role 0/1 | QR usage statistics (global for admin, restaurant-scoped otherwise) | `?restaurantId` (admin only) | `{success,data:QRStatistics}` |
| GET | `/api/v1/qr/templates` | authenticated (any role) | List active templates | `?category` | `{success,data:QRTemplate[]}` |
| GET | `/api/v1/qr/templates/:id` | authenticated | Get one template | — | `{success,data:QRTemplate}` or 404 |
| POST | `/api/v1/qr/templates` | role 0/1 | Create a style template | `{name,description,category,style}` | `{success,data:QRTemplate}` (201) |
| PUT | `/api/v1/qr/templates/:id` | role 0/1 | Update a template | partial | `{success,data:QRTemplate}` |
| DELETE | `/api/v1/qr/templates/:id` | role 0/1 | Soft-delete (`isActive=false`) | — | `{success,message}` |
| GET | `/api/v1/qr/verify/market/:slug` | **public** | Verify a market-entrance QR/slug | — | `{success,data:{valid,marketId,marketSlug,marketName,marketUrl,market}}` or 404 |
| GET | `/api/v1/qr/verify/shop/:qrCode` | **public** | Verify a shop QR code | — | `{success,data:{valid,restaurantId,restaurant}}` or 404 |

### Business logic

**Generation is metadata-only — no image is rendered or stored at generation
time.** `generateQR`/`generateBulkQR` insert a `qr_codes`/`qr_batches` row
(content string, style JSON, format, restaurant/user linkage) and return an
entity with `downloadUrl: undefined` — **actual PNG/SVG bytes are only
produced on-demand** inside `downloadQR`/`downloadBatch`, via
`renderQRCodeArtifact` (wraps the `qrcode` npm package: `errorCorrectionLevel`
from `style.errorCorrection` default `"M"`, `width` from `style.size` default
512, colors from `style.foregroundColor`/`backgroundColor`; `svg`/`pdf`/`jpeg`
format requests all currently render as **SVG** — there is no PDF or JPEG
encoder wired up despite those being accepted format values in the Zod
schema, a **stub/gap**: requesting `format:"pdf"` silently returns an SVG
file with an `image/svg+xml` content type, not a real PDF).

**Bulk-batch download does not use the original per-table `content` strings
at all.** `renderBatchArchive` regenerates QR content **synthetically** as
`makanmakan://restaurant/{restaurantId}/qr-batch/{batchId}/code/{index}`
(1-indexed) for `totalCodes` entries — the actual `content`/`customStyle`
per-table values submitted to `/bulk` are stored in the batch's originating
request but **never read back** for the zip download; the zip's QR payloads
are placeholder URIs, not the real per-table ordering URLs. This looks like
an incomplete feature (the batch-download zip is not actually usable for
real table QR provisioning as-is) — flag prominently rather than silently
reimplementing the synthetic-URI behavior as if it were intentional final
design; verify with product/whoever owns table-QR provisioning before the
Rust port decides whether to fix this (join back to `qr_codes` rows created
alongside the batch, if any exist) or intentionally preserve it.

**Restaurant-scoped download authorization** (`assertRestaurantAccess`):
admin (role 0) bypasses; everyone else must have
`caller.userRestaurantId === resource.restaurantId` (string-compared) or gets
`forbidden`. Applied to both single and batch downloads.

**Shop/market QR verification are pure delegations**: `qr-codes` itself has
no shop/market business logic — `/verify/shop/:qrCode` dynamically imports
`RestaurantsService.verifyShopQrCode` (§7) and `/verify/market/:slug`
dynamically imports `MarketsService.getMarketBySlug` (out of scope). These
dynamic `await import(...)` calls are explicitly commented as circular-
dependency avoidance — in Rust this becomes a normal module/crate dependency
edge with no special handling needed (no true circularity exists at the
domain level, just an artifact of the JS module graph).

**Template CRUD** always passes `"system"` as the acting `userId` for
update/delete audit logs (`packages/database`'s `QRCodeService.updateTemplate`/
`deleteTemplate` signatures accept a `userId` param that this feature layer
never threads the real caller into) — an audit-trail accuracy gap, not a
security issue, but worth fixing if audit logs matter for compliance.

### Data

- **Reads/writes**: `qr_codes` (TEXT UUID v7 PK), `qr_templates` (INTEGER PK),
  `qr_downloads` (INTEGER PK, append-only download log), `qr_batches`
  (INTEGER PK, `batch_id` TEXT unique — a separate human/URL-facing
  identifier from the row's own integer PK), `audit_logs` (via
  `QRCodeService.createAuditLog`, on generate/bulk-generate/template
  create/update/delete).
- **KV (`CACHE_KV`)**: `qr-stats:{restaurantId|"global"}` (medium TTL),
  `qr-templates:{category|"all"}` (long TTL), `qr-template:{id}` (long TTL) —
  all invalidated (`cache.delete`/`cache.clear`) on the corresponding
  template writes.
- **Events**: none published to a bus (only DB `audit_logs` rows).

### Cross-module dependencies

- `packages/database`: `QRCodeService` (persistence + audit log), Drizzle
  `qrCodes`/`qrTemplates`/`qrDownloads`/`qrBatches` schema.
- `qrcode` (npm) — QR rendering; `fflate` (npm) — zip archive creation for
  batch downloads.
- `apps/api/src/features/restaurants/services/RestaurantsService.ts` (dynamic
  import, shop-QR verification only).
- `apps/api/src/features/markets/services/MarketsService.ts` (dynamic
  import, market-QR verification only) and
  `apps/api/src/features/markets/schemas/validation.ts`
  (`marketSlugParamSchema`).
- Note: **seat-level** QR generation (`POST /api/v1/seats/batch-create`, per
  `CLAUDE.md`) lives in the separate `seats` feature module, **not** here —
  do not conflate "seat QR" with this module's `/generate`/`/bulk` when
  scoping the Rust port; they are different features with no code sharing
  beyond both ultimately rendering QR images via the same `qrcode` library
  convention (verify independently if/when `seats` is ported).

### Rust rewrite notes

- **On-demand rendering, not pre-rendered storage**: replicate the
  render-at-download-time architecture (no image bytes stored in D1/R2 for
  single QR codes) unless a caching layer is deliberately added — `qrcode`
  crate equivalents exist in Rust (e.g. `qrcode` crate for matrix generation
  + `image`/`resvg` for rasterization, or emit SVG directly like the current
  code effectively does for all non-PNG formats).
- **PDF/JPEG formats are not actually implemented** (silently served as SVG
  today) — the Rust port must either implement real PDF/JPEG encoders or
  keep returning SVG with an honest `format` value in the response/filename
  (currently the filename extension is derived from the *rendered* type, so
  it's already self-consistent — just know that accepting `format:"pdf"` in
  the request schema is misleading to API consumers).
- **Batch-archive content-string gap**: decide whether to fix (rejoin real
  per-table content from wherever it's stored) or preserve the synthetic
  `makanmakan://restaurant/.../code/{index}` placeholder scheme — this is
  the single most consequential product decision to make before porting this
  endpoint, since "preserve exactly" would mean shipping a Rust rewrite of a
  feature that doesn't actually do what its name implies.
- **IDs**: `qr_codes.id` TEXT UUID v7; `qr_templates`/`qr_downloads`/
  `qr_batches` INTEGER autoincrement; `qr_batches.batch_id` is a **separate**
  TEXT unique identifier (`prefixedUuid("batch")` — a `batch_{uuid}` string with an **underscore**
  separator: `${prefix}_${crypto.randomUUID()}`,
  `packages/database/src/services/id-generation.ts:1-3`) used in URLs instead of the integer PK — preserve this
  dual-identifier pattern (internal integer PK + external string ID) since
  routes key off `batch_id`, not the integer `id`.
- **Audit log userId "system" placeholder**: thread the real authenticated
  user through template update/delete calls in the Rust port instead of
  hardcoding a sentinel string, if audit accuracy is a goal.
- **Timestamps**: `created_at_ms`/`updated_at_ms`/`downloaded_at_ms`/
  `completed_at_ms`, all `INTEGER` via Drizzle `timestamp_ms`/raw
  `unixepoch('now')*1000` defaults — standard convention.

---

## 11. `admin-settings` (mount: `/admin`)

### Purpose

Smallest module in this set — pure KV-backed preference storage for
notification settings and a generic "settings sync" endpoint, scoped by
`restaurantId` (or global for platform admins with no restaurant). No DB
table access at all; no service class; a single flat routes file. Distinct
from `users`' own `/notification-settings`/`/*/sync` endpoints (different KV
key prefix: `admin:` here vs `customer:` there — see the `users` module's
Rust notes on that naming artifact) and from `me`'s module/usage endpoints
(this module has nothing to do with subscription gating).

### Routes

| Method | Full path | Auth | Purpose | Request | Response |
| --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/admin/notification-settings` | authenticated (mounted under `/admin/*` which already requires `authMiddleware` at `app-factory.ts`'s admin block, **plus** a redundant second `authMiddleware` inline in this route) | Read own notification settings, restaurant-scoped | — | `{success,data:NotificationSettings}` (defaults if none stored) |
| PUT | `/api/v1/admin/notification-settings` | authenticated | Write own notification settings | full `NotificationSettings` object (strict shape + `quietHours`) | `{success,data:{settings,updatedAt}}` |
| POST | `/api/v1/admin/settings/sync` | authenticated | Store an arbitrary settings blob, restaurant-scoped | `{sync_id?,restaurant_id?,...passthrough}` | `{success,data:{syncId,synced,restaurantId,syncedAt}}` or 403 (`SETTINGS_SYNC_FORBIDDEN`) |

Note the module comment in `app-factory.ts` says "Admin-only routes — auth +
role=0 enforced inside the feature module itself" for the `/admin` mount
generally, but **this specific file does not check `role === 0` anywhere** —
it only checks `authMiddleware` (any authenticated staff/customer role 0–5,
since `authMiddleware` here is the role-0-4 staff variant — actually re-check:
`apps/api/src/middleware/auth.ts`'s exported `authMiddleware` is
`createAuthMiddleware(4)`, i.e. roles 0–4, not customers) and, for `sync`,
`canWriteRestaurantScope` (any role can write to its **own**
`restaurantId`'s scope; only admin — `role===0` — or a request with no
target restaurant can bypass the match check). **This means any staff role
(chef/service/cashier, roles 2–4) can write "admin" notification settings
scoped to their own restaurant** — the route comment's claim of
admin/role-0-only enforcement does not match this file's actual code; other
sibling routes mounted under `/admin` (`adminSettingsRoutes`'s siblings —
`marketsFeature.adminRoutes`, `subscriptionsFeature.routes` — are out of
scope here but may have their own, stricter, internal role checks; this
finding is specific to `admin-settings`).

### Business logic

**Restaurant-scoped KV keys**: `createSettingsKey(user)` builds
`admin:notification-settings:{scope}:{userId}` where `scope` is
`encodeURIComponent(user.restaurantId)` or the literal string `"global"` if
the user has no `restaurantId` — so notification settings are effectively
per-(user, restaurant) pairs, not shared across a restaurant's staff.

**Settings sync authorization** (`canWriteRestaurantScope`): admin (`role===0`)
or a `null` target restaurant (global scope) always allowed; otherwise the
caller's own `restaurantId` (as a string) must exactly match the requested
`restaurant_id` (explicit body field, defaulting to the caller's own
`restaurantId` if omitted) — so a non-admin **cannot** sync settings scoped
to a different restaurant, but a non-admin without `restaurantId` on their
token also cannot write to any specific-restaurant scope (guarded by
`user.restaurantId === undefined || null ⇒ false`).

**Sync ID generation**: `createSyncId` uses the caller-supplied
`settings.sync_id` if present (URL-encoded), else falls back to
`Date.now()` as a string — collision-prone under concurrent syncs from the
same millisecond, though low-risk given this is a per-user write path, not a
shared counter.

**Dual KV write per sync**: every `settings/sync` call writes both a
timestamped/`sync_id`-keyed entry **and** overwrites a `:latest` entry — the
same double-write pattern seen in `users`' own sync endpoints, just under a
different key prefix (`admin:` vs `customer:`) and TTL (30 days, matching
`users`).

### Data

- **Reads/writes**: none (no D1 table access anywhere in this file).
- **KV (`CACHE_KV`)**: `admin:notification-settings:{scope}:{userId}` (no
  TTL — persists indefinitely unlike the sync entries),
  `admin:settings-sync:{scope}:{userId}:{syncId|"latest"}` (30-day TTL).
- **Events**: none.

### Cross-module dependencies

- None beyond the shared `authMiddleware`/`validateBody` middleware. This
  module is fully self-contained (no calls into `packages/database` or any
  other feature's service).

### Rust rewrite notes

- **Authorization gap vs the mount comment**: flag explicitly for
  product/security review — either tighten this route to genuinely require
  `role===0` (matching the `app-factory.ts` comment's stated intent) or
  update the comment/documentation to reflect that any staff role can write
  restaurant-scoped "admin" settings today. Do not silently pick one when
  porting to Rust; this is a decision point, not a bug to quietly fix or
  quietly preserve.
- **No DB access** — this is the simplest module in the set to port: a KV
  get/put wrapper with a Zod-equivalent (`serde`-validated) schema. No
  bcrypt, no JWT minting, no UUID generation of its own (relies entirely on
  the already-authenticated `user.id`/`user.restaurantId` from middleware).
- **Key-prefix inconsistency** (`admin:` here vs `customer:` in `users` for
  conceptually similar sync endpoints) — worth consolidating into one naming
  scheme in the Rust port, but note both must remain **readable** during any
  migration window if existing KV data needs to survive the cutover (KV data
  does not migrate automatically the way D1 rows do via migration files).
- **No TTL on `notification-settings` writes, 30-day TTL on `sync` writes** —
  preserve this asymmetry unless a product decision changes it; it's
  intentional (settings are meant to persist, syncs are meant to expire).

---

## Summary of cross-cutting ambiguities to resolve before/during the Rust port

1. **`authentication` vs `verification` route collision** at
   `/api/v1/auth/{forgot-password,reset-password,verify-email}` (§1) — must
   be tested against a running instance, not assumed from reading order.
2. **Two different OTP-randomness qualities** in the same codebase: CSPRNG +
   rejection sampling in `customer` (§3) vs `Math.random()` in `verification`
   (§6) — a real security inconsistency, not a style choice.
3. **`ingredients` is missing owner-restaurant scoping** (§9) that every
   sibling module enforces — likely an authorization gap, not a design
   choice.
4. **`admin-settings`'s actual code doesn't match its mount-point comment's
   claimed role-0 enforcement** (§11).
5. **`qr-codes` bulk-batch download uses synthetic placeholder content**,
   not the real per-table QR payloads submitted at batch-creation time (§10)
   — likely an incomplete feature, not intentional final design.
6. **Two independent "settings sync" KV mini-features** (`users` §2 and
   `admin-settings` §11) with near-identical shapes and different key
   prefixes — a consolidation candidate.
7. **Restaurant creation's saga is inconsistently guarded**: tenant
   provisioning and market auto-attach are best-effort/compensated;
   subscription provisioning is not (§7).
8. **UUID v4 (reset/verification tokens) vs v7 (everything else)** — appears
   intentional (non-PK tokens), not a defect, but confirm before assuming all
   UUIDs in the schema should be v7 in Rust structs.
