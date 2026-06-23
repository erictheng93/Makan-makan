# Users UUID/Auth Phase D Bridge Plan

Last updated: 2026-06-23

## Objective

Phase D prepares staff identity for a later destructive `users.id` primary-key
rebuild. It adds a stable UUID-v7 public identifier and moves auth contracts
toward string principals while keeping legacy numeric JWTs valid during a
bounded compatibility window.

This phase is non-destructive. It must not rebuild `users` or any dependent FK
table.

## Current State

The staff identity stack still depends on integer `users.id`:

- `packages/database/src/schema/users.ts` defines `users.id` as an
  auto-increment integer primary key and has no `public_id` bridge column.
- `packages/database/src/services/auth.ts` signs staff access and refresh
  tokens with numeric `id` / `userId` claims, reloads users by `users.id`, and
  uses `token_version` for revocation.
- `apps/api/src/middleware/auth.ts` requires `payload.id` to be a positive
  integer before loading a staff user by `WHERE id = ?`.
- `apps/api/src/features/realtime/services/RealtimeAuthService.ts` requires
  session JWT `id` to be an integer, emits numeric `userId` in realtime tokens,
  and reloads staff users by `WHERE id = ?`.
- `apps/management-api/src/routes/auth.ts` exchanges API admin tokens into
  management JWTs with string `id`, while `apps/management-api/src/middleware`
  requires management JWT `id` to be a string. The exchanged source token still
  comes from the API staff auth shape.
- Many database domains still FK to `users.id`, including sessions,
  verification tokens, audit logs, POS approval fields, group orders,
  partnerships, scheduling, leave, feedback, and error reporting.

## Bridge Identity Contract

During Phase D, staff principals should have both identities:

- `legacyUserId`: existing integer `users.id`, internal only.
- `publicUserId`: new UUID-v7 `users.public_id`, suitable for JWT `sub`,
  external APIs, realtime payloads, logs, and future FK remapping.

New code should resolve staff principals through a shared resolver instead of
binding raw `users.id` directly at API boundaries.

## Implementation Slices

### D1: Schema Bridge

- Add nullable `users.public_id TEXT`.
- Backfill existing rows with UUID-v7-shaped values.
- Add a partial unique index on `users.public_id`.
- Add paired audit guard migrations that fail on missing, duplicate, or
  malformed `users.public_id` values.
- Keep the column nullable until raw user insert paths and test factories are
  audited.

Progress:

- 2026-06-23: Added the non-destructive `users.public_id` bridge to the Drizzle
  schema with a runtime UUID-v7 default and partial unique index.
- 2026-06-23: Added paired bridge migrations
  `packages/database/migrations_fresh/0074_users_public_id_bridge.sql` and
  `packages/database/migrations/0091_users_public_id_bridge.sql`.
- 2026-06-23: Added paired audit guard migrations
  `packages/database/migrations_fresh/0075_users_public_id_audit_guard.sql`
  and `packages/database/migrations/0092_users_public_id_audit_guard.sql`.
- 2026-06-23: Added
  `packages/database/src/schema/users-public-id-bridge.test.ts` to guard the
  schema column, partial unique index, paired migrations, audit guard checks,
  and dual-track registry entry.

Acceptance:

- Existing user creation paths still work.
- Backfilled rows have unique UUID-shaped `public_id` values.
- No FK table is rebuilt.

### D2: Staff Principal Resolver

- Add a shared resolver that accepts a numeric legacy id or UUID public id and
  returns one canonical staff user record.
- Scope resolver output to active users and preserve `token_version` checks.
- Return both `legacyUserId` and `publicUserId` to callers.

Progress:

- 2026-06-23: Added
  `apps/api/src/shared/services/staff-principal.ts`, a shared API resolver that
  accepts legacy numeric `users.id` or UUID-v7-shaped `users.public_id`, rejects
  malformed principal strings before querying, returns `legacyUserId` plus
  `publicUserId`, and preserves `tokenVersion`.
- 2026-06-23: Added focused resolver coverage in
  `apps/api/src/shared/services/staff-principal.test.ts` for numeric ids, UUID
  public ids, invalid inputs, inactive users, and misses.
- 2026-06-23: Rewired `apps/api/src/middleware/auth.ts` numeric staff user
  loading through the resolver with `requireActive: false`, preserving the
  existing middleware-level inactive-user and token-version behavior. Parsing
  UUID-principal JWT claims remains D3 work.

Acceptance:

- Numeric legacy JWTs still authenticate.
- UUID principal inputs authenticate after `users.public_id` exists.
- Missing, inactive, malformed, and duplicate-guard failure cases have focused
  tests.

### D3: API Auth Compatibility

- Update API staff auth payload parsing to accept either the current numeric
  `id` claim or a new string principal claim.
- Prefer `sub` or `publicUserId` for new tokens; keep numeric `id` as a legacy
  compatibility claim only during the window.
- Update `AuthUser` so route code can access the UUID principal without losing
  the legacy integer id needed by current FK-backed services.
- Keep role and `token_version` semantics unchanged.

Acceptance:

- `apps/api/src/middleware/auth.test.ts` covers legacy numeric tokens and new
  UUID-principal tokens.
- Staff routes continue to receive a numeric legacy id until downstream service
  FKs are migrated.

Progress:

- 2026-06-23: Updated `apps/api/src/middleware/auth.ts` so staff tokens may
  carry either legacy numeric `id` or UUID-v7-shaped `sub`. UUID-principal
  tokens resolve through `users.public_id`, then attach the legacy numeric
  `AuthUser.id` plus `AuthUser.publicId` for compatibility.
- 2026-06-23: Preserved legacy numeric JWT behavior and added
  `apps/api/src/middleware/auth.test.ts` coverage for UUID-principal staff
  tokens. UUID tokens must resolve to a DB user because existing route code
  still needs the legacy numeric id during the FK compatibility window.
- Token issuance and refresh still emit the legacy numeric shape; moving login
  and refresh to UUID principal claims remains D4 work.

### D4: Token Issuance and Refresh

- Update `packages/database/src/services/auth.ts` login and refresh flows to
  issue new tokens with a string principal identity.
- Keep refresh-token lookup compatible with legacy numeric `userId` claims.
- Preserve token blacklist and `token_version` invalidation behavior.

Acceptance:

- Login returns tokens carrying UUID principal identity.
- Refresh accepts legacy refresh tokens and emits the new token shape.
- Logout and password/change verification still invalidate old sessions.

Progress:

- 2026-06-23: Updated `packages/database/src/services/auth.ts` login and
  refresh-token rotation to emit UUID-principal access and refresh tokens when
  `users.public_id` is present. New access tokens carry `sub` instead of
  numeric `id`; new refresh tokens carry `sub` instead of numeric `userId`.
- 2026-06-23: Kept compatibility for legacy numeric refresh tokens by resolving
  either `userId` or `sub`, then querying the existing integer `sessions.user_id`
  during the FK compatibility window.
- 2026-06-23: Updated `validateToken` to accept UUID-principal access tokens by
  validating the session row first, then checking the token `sub` against the
  loaded `users.public_id`.
- 2026-06-23: Added focused coverage in
  `packages/database/src/services/auth.test.ts` for UUID token issuance on
  login, UUID token issuance after legacy refresh-token rotation, replay
  rejection, and UUID access-token validation.

### D5: Realtime and Management API Compatibility

- Update `RealtimeAuthService` session validation to resolve numeric or UUID
  staff principals.
- Emit `publicUserId` beside legacy numeric `userId` in realtime auth payloads
  during the compatibility window.
- Confirm management API exchange accepts the new API admin token shape and
  continues to issue management JWTs with string `id`.

Acceptance:

- Realtime tests cover numeric session JWTs and UUID-principal session JWTs.
- Management API auth route tests cover exchange from the new API admin token
  shape.

Progress:

- 2026-06-23: Updated
  `apps/api/src/features/realtime/services/RealtimeAuthService.ts` to accept
  session JWTs with either legacy numeric `id` or UUID-v7-shaped `sub`.
  UUID-principal sessions resolve through `users.public_id`, then emit both
  legacy numeric `userId` and `publicUserId` in realtime websocket tokens.
- 2026-06-23: Updated `RealtimeAuthPayload` in shared-types to include optional
  `publicUserId`.
- 2026-06-23: Added focused
  `RealtimeAuthService.test.ts` coverage for UUID-principal session JWTs,
  `public_id` DB lookup, and `publicUserId` emission.
- 2026-06-23: Updated `apps/management-api/src/routes/auth.ts` so the
  management token exchange accepts API admin tokens with either legacy `id` or
  UUID-v7-shaped `sub`. Added route coverage for exchanging the new
  UUID-principal API admin token shape and verified the emitted management JWT
  is still accepted by `managementAuthMiddleware`.

## Destructive Migration Gate

Do not begin Phase E users primary-key rebuild until all are true:

- `users.public_id` audit guard has passed on staging or restored production
  data.
- API auth, realtime auth, management auth, login, refresh, logout, and
  verification-token tests pass for both legacy and UUID-compatible token
  shapes.
- New tokens no longer require numeric `users.id` at API boundaries.
- A dependency map exists for every FK or actor pointer to `users.id`, including
  row counts, indexes, triggers, and write paths.
- A users PK dry-run script exists that creates shadow tables, copies through
  `users.public_id`, checks row-count parity, runs `PRAGMA foreign_key_check`,
  and rolls back.

## Out of Scope

- Rebuilding `users` or dependent tables.
- Removing legacy numeric JWT compatibility.
- Migrating customer identity unless a staff-auth audit shows a shared route is
  incorrectly relying on `users.role = 5`.
- Changing authorization roles or token-version semantics.
