# Customer Identity Consolidation & Profile Depth — Design (Draft)

**Date**: 2026-05-25
**Status**: Draft — awaiting review
**Author**: Eric
**Phase 1 scope**: Resolve identity fork, promote `customers` to authoritative customer table, ship 5 supporting tables (preferences, favorites, push, consents, phone verification)
**Companion spec**: [`2026-05-25-night-market-discovery-design.md`](./2026-05-25-night-market-discovery-design.md) — markets/discovery work depends on this landing first for follow / broadcast features

---

## 1. Overview

The codebase carries an **unfinished identity refactor**. `packages/database/src/schema/users.ts` declares `USER_ROLES.CUSTOMER = 5` with a comment "顧客（可選）" and a default-role comment that explicitly says *"顧客應使用 customers 表"* — yet the migration was never completed. Today:

- A `customers` table exists (`packages/database/src/schema/customers.ts`) with id as `TEXT` (UUID).
- But `orders.customerId`, `waiting_list.customerId`, and `reservations.customerId` are **all `INTEGER` references to `users.id`** (the staff table).
- Only `partnerships/verified_members.customerId` actually points at `customers.id`.
- Customer-side authentication, verification, and profile depth all live on the `users` table or don't exist at all.

This leaves us with two parallel concepts of "customer": (a) a row in `users` with no role / role=5, and (b) a row in `customers` that is functionally orphaned. Before any market-vision feature (follows, broadcasts, push, favorites) can ship, this fork must be resolved — otherwise every new feature has to pick a side and the inconsistency multiplies.

This spec finishes the half-done refactor: consolidate to `customers` as the authoritative customer entity, migrate the foreign keys, add the satellite tables that an actual consumer profile needs, and set the foundation for future OAuth and loyalty work.

---

## 2. Goals & Non-goals

### Goals (Phase 1)

1. Make `customers.id` (TEXT/UUID v7) the single canonical customer identity across the system.
2. Migrate `orders.customerId`, `waiting_list.customerId`, `reservations.customerId` to FK → `customers.id`.
3. Ship customer-side authentication via phone-OTP (no password) and a customer JWT, enabling first-class customer sessions.
4. Add five new tables that cover the profile depth needed for the night-market vision: preferences, favorites, push subscriptions, consents, phone verification.
5. Backwards compatible: existing orders / waiting-list / reservations keep working through the migration; staff (`users`) flow untouched.
6. Provide a PDPA-ready consent audit trail before any marketing broadcast feature ships.

### Non-goals (deferred to Phase 2+)

- OAuth (LINE, Apple, Google) sign-in — schema extension only, no implementation.
- Customer addresses (only relevant when delivery rolls out).
- Customer reviews / ratings — own spec.
- Loyalty points / referral codes — own spec.
- Saved payment methods — depends on payment gateway integration.
- Merging duplicate customers (data hygiene, separate cleanup project).
- Migrating `users.preferences` content into `customer_preferences` (one-way migration; old field becomes deprecated).

---

## 3. The Identity Fork — Concrete Inventory

Before designing the fix, here is everything currently bound to either side of the fork:

### Bound to `users.id` (INTEGER) — needs migration

| Table | Column | Cardinality |
|---|---|---|
| `orders` | `customer_id` (INTEGER, nullable) | 1:N — every customer order |
| `waiting_list` | `customer_id` (INTEGER, nullable) | 1:N — every queue ticket |
| `reservations` | `customer_id` (INTEGER, nullable) | 1:N — every reservation |
| `password_reset_tokens` | `user_id` (INTEGER) | 1:N — currently staff-only |
| `email_verification_tokens` | `user_id` (INTEGER) | 1:N — currently staff-only |
| `phone_verification_tokens` | `user_id` (INTEGER) | 1:N — currently staff-only |

### Bound to `customers.id` (TEXT) — already correct

| Table | Column |
|---|---|
| `verified_members` | `customer_id` (TEXT) |

### Hybrid / awkward

| Location | Issue |
|---|---|
| `users.preferences` JSON | Holds `dietary`, `notifications`, etc. — should move to `customer_preferences` for customer rows. Deprecate the JSON field for customers (keep for staff). |
| `users.role = 5` | Defined but the codebase already comments "顧客應使用 customers 表". Phase 1 outcome: no new `role=5` rows; existing ones get migrated. |
| Anonymous orders | Many orders have `customerId = NULL` (guest checkout). This stays valid post-migration — the new FK is also nullable. |

---

## 4. Decision: Consolidate to `customers` (TEXT/UUID v7)

Chosen path is **Option B (separate)** from the architecture discussion that produced this spec. Justification recap:

| Reason | Detail |
|---|---|
| **Scale shape** | Customers will outnumber staff 100–1000x. Stuffing them into `users` blows up the schema's hot path. |
| **PII boundary** | Staff PII (salary, schedules) and customer PII (consumption history, addresses) have different access patterns and regulatory exposures. Separate tables = easier RLS / role-based access. |
| **Future OAuth** | LINE Login / Apple Sign In / Google Sign In need a dedicated `customer_oauth_identities` 1:N table. Adding that to `users` (which already has password-based auth) creates conflicting auth strategies on one table. |
| **Original intent** | `users.ts` already comments that customers should use `customers`. We're finishing the work that was started, not introducing a new opinion. |
| **Migration cost** | Customer FK count is small (3 tables: orders, waiting_list, reservations). Refactoring `users` would touch dozens of FKs across staff features. The smaller migration wins. |

`users.role = 5` (CUSTOMER) is **deprecated** post-migration. The constant stays exported for one release for backwards-compat code paths, then is removed.

---

## 5. Data Model

### 5.1 Modified: `customers` (existing table, narrow core)

Today's columns: `id`, `fullName`, `email`, `phone`, `createdAt_ms`, `updatedAt_ms`. After this spec:

| Column | Type | Description |
|---|---|---|
| id | TEXT PK | UUID v7 (change from current `crypto.randomUUID().replace(/-/g, "")` to `uuidv7()` for time-sortability; matches restaurants/markets) |
| displayName | TEXT NOT NULL | Renamed from `full_name` for consistency with consumer-app vocabulary |
| primaryPhone | TEXT UNIQUE | Renamed from `phone`. **E.164 normalized** (`+886912345678`). Verified before becoming primary. |
| primaryEmail | TEXT UNIQUE | Renamed from `email`. Lower-cased before storage. Verified before becoming primary. |
| avatarUrl | TEXT | Cloudflare Images / R2 URL |
| locale | TEXT | BCP 47 (`zh-TW`, `en-US`, etc.) — matches existing app i18n |
| status | TEXT NOT NULL DEFAULT 'active' | `active` / `suspended` / `deleted` — soft delete via status, not nullable timestamp |
| lastSeenAt_ms | INTEGER | Updated on each authenticated request; used for inactive-cleanup, churn metrics |
| createdAt_ms | INTEGER NOT NULL | Existing |
| updatedAt_ms | INTEGER NOT NULL | Existing |
| deletedAt_ms | INTEGER | Soft-delete tombstone (kept for compatibility with future audit needs) |

**Indexes**:
- `primaryPhone` UNIQUE — phone is the primary login factor
- `primaryEmail` UNIQUE WHERE NOT NULL — partial unique
- `status + lastSeenAt_ms` — for "active customer" analytics

**Why narrow**: this row is hit on every authenticated request. Wider rows force more I/O. Push subscriptions, favorites, etc. live in satellites loaded on demand.

**Migration of legacy fields**: `full_name` → `display_name` is a column rename via SQLite table-rebuild (see §9). Existing values copy directly.

### 5.2 New: `customer_preferences` (1:1 sibling)

Settings and personalization. Loaded on `/me` or settings pages, not on every order.

| Column | Type | Description |
|---|---|---|
| customerId | TEXT PK FK | → `customers.id`, ON DELETE CASCADE. Doubles as PK to enforce 1:1. |
| dietaryTags | TEXT (JSON) | `["vegetarian","halal","gluten_free"]` — same vocabulary as `users.preferences.dietary` for parity |
| allergens | TEXT (JSON) | `["peanut","shellfish"]` |
| defaultPartySize | INTEGER | Quality-of-life default for waiting-list / reservations |
| marketingOptIn | INTEGER NOT NULL DEFAULT 0 | Master switch for promotional broadcasts |
| waitingListOptIn | INTEGER NOT NULL DEFAULT 1 | Transactional, default-on |
| promoFromFavoritesOptIn | INTEGER NOT NULL DEFAULT 0 | Granular: only followed shops can push |
| quietHoursStart | TEXT | "22:00" — do-not-disturb window for push |
| quietHoursEnd | TEXT | "08:00" |
| preferredPaymentMethodId | TEXT | Future FK to `customer_payment_methods` (Phase 2) |
| updatedAt_ms | INTEGER NOT NULL | |

**Why a 1:1 sibling, not columns on `customers`**: changes frequently (toggling notifications, adjusting allergens), but doesn't need to be in the auth/session hot path. Separating it lets us aggressively cache `customers` rows in KV without invalidating on preference toggles.

### 5.3 New: `customer_favorites` (1:N polymorphic)

Single table covering favorited markets, restaurants, and dishes.

| Column | Type | Description |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| customerId | TEXT FK NOT NULL | → `customers.id`, ON DELETE CASCADE |
| targetType | TEXT NOT NULL | ENUM `market` / `restaurant` / `dish` (CHECK constraint) |
| targetId | TEXT NOT NULL | UUID for market / restaurant; INTEGER cast to TEXT for dish — uniformity |
| createdAt_ms | INTEGER NOT NULL | |

**Indexes**:
- `(customerId, targetType, targetId)` UNIQUE — prevents duplicate favorites
- `(customerId, targetType, createdAt_ms DESC)` — "my favorites" list
- `(targetType, targetId)` — "who favorited me" / fanout for broadcast

**Polymorphic FK note**: SQLite cannot enforce a polymorphic FK. Integrity is enforced in the service layer (`FavoritesService.validateTarget`) and via a periodic data-integrity-audit job (table `data_integrity_audit` already exists, just add a check). This is an explicit, accepted trade-off — the alternative (three separate tables `customer_market_favorites`, `customer_restaurant_favorites`, `customer_dish_favorites`) triples query complexity for a "list my favorites" feed.

### 5.4 New: `customer_push_subscriptions` (1:N)

VAPID-based web push targets. Reused by waiting-list Phase 2, market broadcasts, future order status push, FAQ auto-reply notifications.

| Column | Type | Description |
|---|---|---|
| id | TEXT PK | UUID v7 |
| customerId | TEXT FK NOT NULL | → `customers.id`, ON DELETE CASCADE |
| endpoint | TEXT NOT NULL UNIQUE | VAPID endpoint URL (uniquely identifies a browser/device subscription) |
| p256dhKey | TEXT NOT NULL | Push subscription public key |
| authKey | TEXT NOT NULL | Push auth secret |
| userAgent | TEXT | For human-readable device label fallback |
| deviceLabel | TEXT | User-assigned ("我的 iPhone") |
| lastUsedAt_ms | INTEGER | Updated on successful send; row pruned if > 90 days idle |
| failureCount | INTEGER NOT NULL DEFAULT 0 | Bumped on 410 Gone / 404 from push gateway |
| createdAt_ms | INTEGER NOT NULL | |

**Indexes**:
- `customerId` — "list my devices"
- `endpoint` UNIQUE — push gateway-provided uniqueness
- `lastUsedAt_ms` — pruning job

**Failure handling**: when push gateway returns `410 Gone` or `404`, increment `failureCount`. At ≥3, soft-delete (we keep the row briefly for analytics, then a cron job purges).

### 5.5 New: `customer_consents` (append-only audit)

PDPA / GDPR-friendly consent ledger. Never UPDATE — always INSERT a new row for the new state.

| Column | Type | Description |
|---|---|---|
| id | TEXT PK | UUID v7 |
| customerId | TEXT FK NOT NULL | → `customers.id` |
| consentType | TEXT NOT NULL | `marketing` / `analytics` / `location` / `data_share` / `terms_of_service` / `privacy_policy` |
| version | TEXT NOT NULL | Policy version, e.g. `2026-05-25-v1` |
| granted | INTEGER NOT NULL | 0 or 1 — the action being recorded |
| grantedAt_ms | INTEGER NOT NULL | When this row was inserted |
| revokedAt_ms | INTEGER | Set when the user later revokes; allows finding "currently active" consents |
| ipAddress | TEXT | At time of action |
| userAgent | TEXT | At time of action |
| source | TEXT | `onboarding` / `settings` / `inline_prompt` |

**Indexes**:
- `(customerId, consentType, revokedAt_ms)` — "is consent active right now" query
- `(consentType, version)` — "who has accepted ToS v2"

**Why append-only**: regulatory auditors expect a trail. If a customer revokes marketing consent, we don't overwrite — we set `revokedAt_ms` on the existing row AND insert a new row showing the revocation event. This gives "they consented on X, revoked on Y" without loss.

### 5.6 New: `customer_phone_verification_tokens` (auth bootstrap)

Customer-side OTP flow. Mirrors `phone_verification_tokens` for staff but with `customer_id` instead of `user_id`. Separate table chosen because cardinality, lifetime, and security policies (lockout, rate-limit) differ.

| Column | Type | Description |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| customerId | TEXT FK | → `customers.id`. **Nullable** because OTP is issued *before* a customer row exists for first-time sign-up. Filled in on successful verification when a row is created. |
| phone | TEXT NOT NULL | E.164 normalized. The primary lookup column during verify step. |
| otpCode | TEXT NOT NULL | 6-digit. Stored as bcrypt hash, not plaintext. |
| expiresAt_ms | INTEGER NOT NULL | 5 minutes from issue |
| usedAt_ms | INTEGER | Set when verified |
| attempts | INTEGER NOT NULL DEFAULT 0 | Bumped on failed verify; lockout at 5 |
| ipAddress | TEXT | For rate limiting |
| createdAt_ms | INTEGER NOT NULL | |

**Indexes**:
- `(phone, expiresAt_ms)` — latest valid OTP for a number
- `customerId` — for cleanup on customer deletion

**Rate limiting**: enforced at the service layer using KV counters keyed by phone and IP. Schema only stores the OTP rows.

### 5.7 FK Migration of existing tables

The hot work: change `orders.customerId`, `waiting_list.customerId`, `reservations.customerId` from `INTEGER → users.id` to `TEXT → customers.id`.

SQLite does not support `ALTER COLUMN TYPE`. Migration pattern is table-rebuild:

```sql
-- For each of: orders, waiting_list, reservations
CREATE TABLE orders_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ...,
  customer_id TEXT REFERENCES customers(id),  -- changed from INTEGER → TEXT
  ...
);

INSERT INTO orders_new SELECT
  id,
  ...,
  customer_id_mapping.new_id,  -- lookup
  ...
FROM orders
LEFT JOIN customer_id_mapping ON orders.customer_id = customer_id_mapping.old_user_id;

DROP TABLE orders;
ALTER TABLE orders_new RENAME TO orders;

-- Recreate all indexes
```

The `customer_id_mapping` is built as a one-off migration step:

```sql
CREATE TEMP TABLE customer_id_mapping AS
SELECT
  u.id AS old_user_id,
  COALESCE(c.id, lower(hex(randomblob(16)))) AS new_id
FROM users u
LEFT JOIN customers c ON c.primary_phone = u.phone OR c.primary_email = u.email
WHERE u.role = 5 OR u.role IS NULL;

-- For users with no existing customers row, insert one
INSERT INTO customers (id, display_name, primary_phone, primary_email, created_at_ms, updated_at_ms)
SELECT m.new_id, u.full_name, u.phone, u.email, u.created_at_ms, u.updated_at_ms
FROM customer_id_mapping m
JOIN users u ON u.id = m.old_user_id
WHERE NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = m.new_id);
```

**Cardinality estimate**: in the current dataset, the affected row count is modest (development data). Production launch will start with empty `orders` so the migration is essentially a no-op at launch — but the migration code must still be correct because we'll seed test data and dev environments.

**Anonymous orders** (`customer_id IS NULL`) skip the mapping and stay NULL.

---

## 6. Authentication & Sessions

### 6.1 Auth Flow (Phase 1)

Phone-OTP, no password:

1. `POST /api/v1/customer/auth/request-otp` — body `{ phone }`. Service:
   - Normalize to E.164
   - Rate-limit check (3/hour per phone, 10/hour per IP)
   - Generate 6-digit OTP, hash, insert into `customer_phone_verification_tokens`
   - Dispatch via SMS provider (out of scope — provider abstraction already exists for staff OTP)
2. `POST /api/v1/customer/auth/verify-otp` — body `{ phone, otp }`. Service:
   - Find latest unused row for that phone within expiry
   - bcrypt compare, increment `attempts` on failure
   - On success: find-or-create `customers` row with `primary_phone = phone`
   - Mark token `used_at_ms`
   - Issue customer JWT (15 min access + 30 day refresh, similar to staff JWT)
   - Return `{ accessToken, refreshToken, customer: CustomerSummary }`
3. `POST /api/v1/customer/auth/refresh` — refresh token rotation, same pattern as staff
4. `POST /api/v1/customer/auth/logout` — revokes refresh token

### 6.2 JWT shape

```ts
interface CustomerJwtPayload {
  sub: string;          // customers.id
  type: "customer";     // discriminator vs staff JWT
  iat: number;
  exp: number;
}
```

Middleware: new `customerAuthMiddleware` in `apps/api/src/middleware/auth.ts` that extracts the customer JWT and attaches `c.set("customer", { id })`. Existing `authMiddleware` for staff stays untouched.

### 6.3 Anonymous → authenticated upgrade

If a customer was placing orders anonymously (with `customer_id = NULL`) and later signs in, we do **not** retroactively claim those orders. Phase 1 ignores this; a "claim my past orders" flow lands later. This matches how most consumer apps behave and avoids a tricky idempotency / abuse vector.

---

## 7. API Endpoints

All under `apps/api/src/features/customer/` (new feature folder). Public auth endpoints unauthenticated; everything else uses `customerAuthMiddleware`.

```
POST   /api/v1/customer/auth/request-otp           Public; body { phone }
POST   /api/v1/customer/auth/verify-otp            Public; body { phone, otp }
POST   /api/v1/customer/auth/refresh               Public; body { refreshToken }
POST   /api/v1/customer/auth/logout                Authed

GET    /api/v1/customer/me                          Authed; returns Customer + Preferences
PATCH  /api/v1/customer/me                          Authed; update displayName, avatarUrl, locale
DELETE /api/v1/customer/me                          Authed; soft-delete (status = 'deleted')

GET    /api/v1/customer/preferences                 Authed
PATCH  /api/v1/customer/preferences                 Authed

GET    /api/v1/customer/favorites                   Authed; query targetType?
POST   /api/v1/customer/favorites                   Authed; body { targetType, targetId }
DELETE /api/v1/customer/favorites/:id               Authed

GET    /api/v1/customer/push-subscriptions          Authed
POST   /api/v1/customer/push-subscriptions          Authed; body { endpoint, p256dh, auth, ... }
DELETE /api/v1/customer/push-subscriptions/:id      Authed

GET    /api/v1/customer/consents                    Authed; returns active consents
POST   /api/v1/customer/consents                    Authed; body { consentType, version, granted }
                                                    Idempotent on (consentType, version, granted)
```

**Notes**:
- `POST /customer/favorites` uses `(customerId, targetType, targetId)` unique constraint → on conflict, return existing row (idempotent).
- `POST /customer/consents` always inserts; explicit revoke = `granted: 0` row, which the service interprets and also sets `revokedAt_ms` on the prior grant.

---

## 8. Service Layer

New services (each lives next to its feature in `apps/api/src/features/customer/services/`):

| Service | Responsibility |
|---|---|
| `CustomerAuthService` | OTP generation, verification, JWT issuance & refresh |
| `CustomerProfileService` | `customers` + `customer_preferences` CRUD |
| `FavoritesService` | Polymorphic favorites with target validation |
| `PushSubscriptionService` | Subscribe/unsubscribe + failure pruning |
| `ConsentsService` | Append-only consent recording, active-consent queries |

**Reused infrastructure**:
- bcrypt for OTP hashing — already used for staff passwords
- KV rate limiting — pattern already in use for API throttling
- JWT lib + refresh token storage — staff pattern in `apps/api/src/features/auth/`

**`SearchIndexSyncService` changes**: none. Favorites don't participate in dish search.

---

## 9. Migration Plan

Drizzle migrations land in `packages/database/migrations_fresh/`. Order matters:

### Step 1 — New tables (no risk to existing data)

1. `customer_preferences`
2. `customer_favorites`
3. `customer_push_subscriptions`
4. `customer_consents`
5. `customer_phone_verification_tokens`

These can ship in one PR; nothing depends on them yet.

### Step 2 — `customers` rebuild (column rename + new columns)

SQLite table-rebuild pattern. Single migration that:
1. Creates `customers_new` with the new column set
2. Copies all rows (mapping `full_name` → `display_name`, `phone` → `primary_phone`, `email` → `primary_email`)
3. Drops `customers`, renames `customers_new` to `customers`
4. Recreates indexes and relations
5. Recreates `verified_members` FK reference

### Step 3 — FK migration of `orders`, `waiting_list`, `reservations`

The riskiest step. Sub-plan:

1. Build temp `customer_id_mapping` table from `users` rows with `role = 5 OR role IS NULL`
2. Insert `customers` rows for any unmapped users (data backfill)
3. Table-rebuild each of `orders` / `waiting_list` / `reservations`:
   - New table with `customer_id TEXT REFERENCES customers(id)`
   - `INSERT ... SELECT` with mapping lookup; NULLs stay NULL
   - Drop old, rename new, recreate every index
4. Drop the temp mapping table

**Why all three in one migration**: they share the mapping. Splitting risks staleness if customers are created/edited between migrations.

**Production rollout**:
- Stage 1: Deploy migration to **staging only**, run full E2E + integration test suite
- Stage 2: Backup production D1 (`pnpm wrangler d1 export ...`)
- Stage 3: Deploy to production during maintenance window (estimate <30s for current data volume)
- Stage 4: Verify with smoke test (`GET /api/v1/orders?limit=5` and confirm `customerId` returns expected TEXT shape)
- Rollback plan: restore from backup. The migration is **not reversible in place** — table-rebuild loses the prior column type. Rollback = restore.

### Step 4 — Deprecate `USER_ROLES.CUSTOMER` (role 5)

- Mark constant as `@deprecated` in `users.ts`
- Add ESLint rule (custom) that errors on new `role: 5` writes
- After one release cycle, remove the constant; any remaining `users.role = 5` rows get migrated by a cleanup job

### Step 5 — Deprecate `users.preferences` for customer rows

- Phase 1 ships the new `customer_preferences` table empty
- A one-time backfill script copies `users.preferences` JSON into `customer_preferences` rows for migrated customers
- The `users.preferences` field stays for staff use (existing schema, no change)

---

## 10. Cross-spec Coordination

This spec is a **hard prerequisite** for the markets/discovery spec's Phase 4 features:

- "Follow market / restaurant" → `customer_favorites` (this spec)
- "Market broadcast push" → `customer_push_subscriptions` + `customer_consents WHERE consentType='marketing'` (this spec)
- "Vendor follower promo push" → same machinery

Recommended sequence:

```
1. This spec lands in full (5–6 weeks)
2. Waiting-list Phase 2 push notifications can be implemented mid-flight (it reuses
   customer_push_subscriptions; pending TODOS.md P2)
3. Markets/discovery Phase 1 spec lands
4. Markets Phase 4 (follow + broadcast) becomes trivially implementable
```

A note on `users.preferences`: since the new `customer_preferences` table covers the same vocabulary (dietary, notifications), **the markets spec should not introduce additional preference columns** — it should rely on this table.

---

## 11. Future Work (Phase 2+)

| Feature | Tables touched | Trigger |
|---|---|---|
| OAuth (LINE / Apple / Google) | New: `customer_oauth_identities` (1:N) | When LINE Login product agreement signed |
| Delivery addresses | New: `customer_addresses` (1:N) | When delivery (not takeaway) feature ships |
| Saved payment methods | New: `customer_payment_methods` (1:N) | When payment gateway is integrated |
| Reviews & ratings | New: `customer_reviews`, `customer_review_photos` | Own spec; needs moderation flow design |
| Loyalty points & referrals | New: `customer_loyalty_balances`, `customer_referrals` | Tied to partnership/marketplace billing |
| Order claiming (anonymous → authed) | Modifies orders / waiting_list | When customer feedback shows need |
| Duplicate customer merging | Internal tooling + audit log | When data hygiene becomes painful |

---

## 12. Open Questions

| ID | Question | Notes |
|----|----------|-------|
| Q-1 | Phone uniqueness across countries — what if a number is reused after years? | Recommendation: treat current `primary_phone` as "currently bound". On re-verification, soft-delete the prior `customers` row (status=`deleted`), claim the phone for the new row. Lose history per privacy norms. |
| Q-2 | Should `customer_preferences` row be created eagerly on customer creation, or lazily on first preference write? | Recommendation: lazy. Avoids empty rows for users who never adjust preferences. |
| Q-3 | OTP delivery provider — SMS only, or also email fallback? | Phase 1: SMS only. Email later. |
| Q-4 | `consent.version` — who manages the version catalog? | Recommendation: hardcode in a constants file (`packages/shared/src/consents/versions.ts`), bump per policy change. Auditors want version strings, not Git SHAs. |
| Q-5 | Anonymous order claiming — required for Phase 1, or deferred? | Recommendation: deferred. See §6.3. Open it as a Phase 2 ticket. |
| Q-6 | Should `users.role = 5` rows be **deleted** after migration, or just left untouched? | Recommendation: leave untouched in Phase 1 (data preservation), schedule cleanup in a follow-up PR after confirming nothing reads them. |
| Q-7 | Push subscription pruning cadence | Recommendation: cron job, daily. Drop `lastUsedAt_ms < now - 90d` AND `failureCount >= 3`. |
| Q-8 | PDPA: do we need DPA records of *processing*, not just *consent*? | Out of scope for schema; would be implemented at application logging layer. Flag for legal review. |

---

## 13. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| FK migration corrupts orders in production | Low | Critical | Full D1 backup before migration; staged rollout (staging → prod); rebuild migration is idempotent. |
| Phone uniqueness conflict during `INSERT INTO customers_new` | Medium | High | Pre-flight script that detects duplicate phones in `users WHERE role IS NULL`; manual reconciliation before migration window. |
| Customer JWT and staff JWT confused by middleware | Medium | High | JWT payload has explicit `type` discriminator; middleware checks; tests cover the cross-type path. |
| Push subscription rows balloon (cookies-style staleness) | Medium | Low | 90-day pruning + per-customer cap (50 subscriptions). |
| `customer_consents` append-only growth | Low | Low | Append-only ledgers grow predictably; partition by year if it ever crosses 10M rows (years away). |
| Locale string drift (`zh-TW` vs `zh_TW`) | Medium | Low | Enforce BCP 47 with hyphen in service layer validator; existing i18n already uses this. |

---

## 14. Out of Scope (Explicit)

- Anything in §11 Future Work.
- Changes to staff (`users`) auth, schema, or session handling.
- New language locales (i18n is parallel work).
- UI design for customer settings / favorites screens — that lands per-app in customer-app PRs referencing this spec.
- Migration of existing `partnerships/verified_members` (already uses `customers.id` correctly).

---

## 15. Estimated Effort

| Workstream | Effort |
|---|---|
| New tables + indexes (Step 1 migrations) | 1 day |
| `customers` rebuild migration (Step 2) | 2 days |
| FK migration of orders/waiting_list/reservations (Step 3) | 3 days |
| Customer auth service + OTP flow | 4 days |
| Customer JWT middleware + refresh rotation | 2 days |
| Profile / preferences / favorites / push / consents services + routes | 5 days |
| Customer-app integration (login screen, favorites UI, push enrollment) | 5 days |
| Tests (unit + integration + migration tests) | 5 days |
| Backfill scripts + deprecation marks | 2 days |
| Docs + changelog + memory updates | 1 day |
| **Total** | **~30 dev-days** |

Roughly **6 weeks for one engineer**, or **4 weeks for two engineers** (one on auth/migration, one on services/routes/frontend).

---

## 16. Review Checklist

- [ ] Consolidate to `customers` (Option B) — agreed?
- [ ] FK migration of orders/waiting_list/reservations is acceptable risk given current data volume — agreed?
- [ ] Phone-OTP auth only in Phase 1, OAuth deferred — agreed?
- [ ] `customer_phone_verification_tokens` is a separate table from staff `phone_verification_tokens` — agreed?
- [ ] `customer_consents` append-only model is the right shape for PDPA — agreed?
- [ ] Open questions Q-1, Q-3, Q-5, Q-6, Q-8 have decisions before implementation starts.
- [ ] This spec lands **before** Markets Phase 4 begins implementation.
