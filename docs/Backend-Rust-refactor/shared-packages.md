# Shared Packages Reference (for Rust Backend Rewrite)

This document inventories `packages/*` in the MakanMakan monorepo as a reference for a
future Rust rewrite of the backend. All statements are sourced directly from the code
at the paths cited; anything not explicitly shown by code is flagged as unverified.

Repo root: `/Users/eric/Documents/Code/Makan-makan`

---

## 1. Package map

| Package | Purpose | Consumed by (apps, verified via `package.json` deps) |
|---|---|---|
| `@makanmakan/database` (`packages/database`) | Drizzle ORM schema + services over Cloudflare D1 (SQLite). Owns all table definitions, migrations, and most business-logic services (order, menu, auth, POS, scheduling, etc.). | `apps/api`, `apps/management-api`, `apps/image-processor`, `apps/print-agent` |
| `@makanmakan/shared-types` (`packages/shared-types`) | Pure TypeScript type/interface/enum definitions shared across frontend and backend (API contracts, domain types, D1 result shapes). No runtime logic. | `apps/admin-dashboard`, `apps/api`, `apps/customer-app`, `apps/management-api`, `apps/print-agent`, `apps/realtime`, `apps/image-processor` |
| `@makanmakan/utils` (`packages/utils`) | Framework-agnostic utilities: API error class, currency, encryption, QR signing, request dedup, timestamp helpers, JWT decode/expiry, UUID v7, Zod ID-validation schemas, phone normalization. | `apps/api`, `apps/customer-app`, `apps/management-api` |
| `@makanmakan/auth-client` (`packages/auth-client`) | Browser-side axios wrapper: prefixed-storage token manager, CSRF handling, 401→refresh→retry interceptor. Frontend-only (uses `document.cookie`, axios). | `apps/admin-dashboard`, `apps/kitchen-display` |
| `@makanmakan/queue-core` (`packages/queue-core`) | Domain types/interfaces/validators/errors for a **restaurant walk-in waiting-queue** system (not a message/task queue) **plus** a bundled ESC/POS receipt-printer driver subsystem (`src/print/*`). | `apps/api`, `apps/print-agent` |
| `@makanmakan/queue-service` (`packages/queue-service`) | Reference implementation (`QueueService`) of the `IQueueService` interface from `queue-core`, built against injected repository/notification/metrics interfaces. | **None** — not listed as a dependency in any `apps/*/package.json`; only referenced from the root `package.json` build/dev/typecheck scripts. Effectively unused/orphaned in the current app graph (see §5). |
| `@makanmakan/ai-analytics` (`packages/ai-analytics`) | LLM-provider abstraction (Anthropic/OpenAI/Google/DeepSeek) + product analytics/business-insights services that query `@makanmakan/database` via Drizzle. | `apps/api`, `apps/admin-dashboard` |
| `packages/shared` (no root `package.json`) | **Not a normal pnpm workspace package.** A loose, path-aliased folder of Vue components/composables/stores (`ModuleGate.vue`, `useModuleAccess.ts`, `moduleAccess.ts` store, `lazyLoadingService.ts`, SSE pooling, etc.) consumed via TS path-alias / Vite `resolve.alias`, not via `@makanmakan/shared` npm resolution. | `apps/admin-dashboard` (aliases `@makanmakan/shared` → `packages/shared`), `apps/customer-app` (aliases only the nested `src/i18n` subpath) |
| `packages/shared/src/i18n` (`@makanmakan/i18n`) | The one real workspace package living inside `packages/shared/`. `pnpm-workspace.yaml` explicitly lists `packages/shared/src/i18n` as a workspace root (separately from `packages/shared` itself, which is **not** listed). Ships vue-i18n locale JSON (zh-TW, en-US, zh-CN, ms-MY, vi-VN, id-ID) and a locale manager. | Declared as a normal `"@makanmakan/i18n": "workspace:*"` dependency in **5 apps**: `admin-dashboard` (package.json:25), `customer-app` (:23), `kitchen-display` (:23), `management-portal` (:21), `onboarding-app` (:21). |

The only app with **no** `@makanmakan/*` direct dependencies is `apps/backup-scheduler` (`management-portal` and `onboarding-app` both depend on `@makanmakan/i18n`). `apps/realtime` depends only on `shared-types`.

`packages/database/package.json` also declares `@makanmakan/queue-core` and `@makanmakan/shared-types` as **peerDependencies** (not regular deps) — worth noting for a Rust crate-boundary design since it signals a soft/optional coupling rather than a hard one.

---

## 2. packages/database

Drizzle ORM (`drizzle-orm@^0.45.2`, `drizzle-kit@^0.31.6`) targeting Cloudflare D1 via the `sqlite`/`d1-http` driver (`drizzle.config.ts`). Schema source of truth: `packages/database/src/schema/*.ts` (`export * from "./schema"` in `src/index.ts`). Entry point `packages/database/src/index.ts` also exports `createDatabase(d1, isDevelopment)` — a thin `drizzle(d1, { schema, logger })` wrapper — plus re-exports of `drizzle-orm` query primitives (`sql`, `eq`, `and`, `between`, `count`, `sum`, `avg`, `desc`, `asc`, `isNull`, `gte`, `lte`).

### 2.1 Migration dual-track system

- **Fresh baseline**: `packages/database/migrations_fresh/` (0000–0074 at time of audit) — the canonical Drizzle-generated migration set, referenced by `drizzle.config.ts`'s `out` path.
- **Wrangler deployment track**: `packages/database/migrations/` (0000–0091, plus an older abandoned `migrations_v2/` directory with hand-written multi-file SQL that appears unused by tooling).
- **Guard file**: `packages/database/migration-dual-track.json` records `reviewedThrough` checkpoints for both tracks (fresh: `0072_schema_hardening_payment_idempotency_backup_timestamps.sql`, legacy: `0089_...`), a `pairs[]` array explicitly mapping fresh↔legacy migrations added after that checkpoint (currently 9 pairs, e.g. `0073_images_uploaded_by_text.sql` ↔ `0090_images_uploaded_by_text.sql`), a `freshOnly[]` entry (`0065_service_booking_employee_overlap_guard.sql` — legacy track never got the `service_bookings` migration), and a `legacyOnly[]` entry (`20251001_performance_indexes.sql` — pre-dates the guard). Verified via `pnpm check:migration-dual-track` per CLAUDE.md.

### 2.2 Timestamp & ID conventions (verified in schema code)

- Timestamps: `integer("<name>_ms", { mode: "timestamp_ms" })`, e.g. `createdAt`, `updatedAt`, `deletedAt`, `confirmedAt`. Drizzle auto-converts JS `Date` ↔ integer-ms. Defaults are set either via `.$defaultFn(() => new Date())` / `.$onUpdate(() => new Date())`, or DB-side via `sql\`(unixepoch('now') * 1000)\`` (e.g. `order_items.createdAt`, `storage_counters.updatedAt`).
- Primary keys: newer/domain tables use `text("id").primaryKey().$defaultFn(() => uuidv7())` (uuid package `v7`), e.g. `restaurants`, `users`, `orders`, `customers`, `markets`, `service_bookings`, `credit_accounts`. (⚠️ not every TEXT PK is uuid7: the `partnerships` family uses dash-stripped v4, several tables get IDs at the service layer — v4 or ad-hoc schemes — see per-table notes below.) Older/simpler tables retain `integer("id").primaryKey({ autoIncrement: true })`, e.g. `menu_items`, `order_items`, `categories`, `tables`, `seats`, verification-token tables, most scheduling/leave tables, `coupons`, `qr_templates`. See full inventory below — this is a per-table decision, not a blanket rule (per CLAUDE.md memory).
- Money: stored as integer cents columns (`*_cents`), converted via `packages/database/src/utils/money.ts` (`toCents`/`fromCents`/`toPercentageBps`/`percentageFromBps`) and, for SQL aggregation, `packages/database/src/utils/money-sql.ts` (`sumMoneyAmount`, `avgMoneyAmount`, etc., all doing `/100.0` in-SQL). Percentage discounts are stored as basis points (`*_bps`) per the `0069_discount_percentage_bps.sql` migration.
- Business-day/timezone: `packages/database/src/utils/business-day.ts` and `sql-time.ts` hard-code a **+8 hours** offset (`DEFAULT_BUSINESS_TIMEZONE_OFFSET_MINUTES = 8 * 60`) for bucketing `DATE(...)`/`strftime(...)` in SQL, with a comment noting Workers/CI run in UTC so this must stay explicit rather than relying on SQLite's `'localtime'` modifier.

### 2.3 Idempotency

- Standalone `idempotency_keys` table (`packages/database/src/schema/idempotency-keys.ts`): PK is `key` (TEXT, not `id`), columns `scope` (`"payment" | "webhook"`), `requestHash`, `responseStatus`, `responseBody`, `effectId`, `createdAt`/`expiresAt` (plain `integer`, **not** `timestamp_ms` mode here — check before assuming ms/Date parity with the rest of the schema).
- Nullable `idempotency_key` columns exist on `payment_transactions` and `market_checkout_payments`. Originally protected only by a plain (non-unique) index; migration `0072_schema_hardening_payment_idempotency_backup_timestamps.sql` replaced both with **partial unique indexes**:
  ```sql
  CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_idempotency_unique_idx
    ON payment_transactions(idempotency_key) WHERE idempotency_key IS NOT NULL;
  CREATE UNIQUE INDEX IF NOT EXISTS market_checkout_payments_idempotency_unique_idx
    ON market_checkout_payments(idempotency_key) WHERE idempotency_key IS NOT NULL;
  ```
- `credit_ledger_entries.idempotency_key` (stored-value credits ledger) is `TEXT NOT NULL UNIQUE` (non-nullable, plain unique — no partial index needed) per `migrations_fresh/0058_stored_value_credits.sql`.

### 2.4 FTS5 usage

Exactly one FTS5 usage found: `migrations_fresh/0061_dish_search_fts5.sql` creates `dish_search_fts` as an **external-content** virtual table (`content='dish_search_index', content_rowid='id'`) with the `trigram` tokenizer for CJK substring search over `dish_search_index` (backing Drizzle table `dishSearchIndex`, schema file `discovery.ts`). Kept in sync via `AFTER INSERT/UPDATE/DELETE` triggers on `dish_search_index` — the code comment notes `SearchIndexSyncService` needs no changes because it already does delete/insert on the base table. Caveat documented in the migration: trigram `MATCH` only works for queries ≥ 3 characters; `DiscoveryService` falls back to `LIKE` for 1–2 character queries. Migration 0068 (`dish_search_menu_item_unique.sql`) adds a unique index on `menu_item_id`.

### 2.5 Complete table inventory (grouped by domain)

All tables are `sqliteTable(...)` calls under `packages/database/src/schema/`. PK type column: **TEXT (uuid v7)** vs **INTEGER (autoincrement)**, verified per-table by grepping the `id:` column definition (or noting a non-`id` PK).

**Core catalog / restaurant**
| Table | PK | Notes |
|---|---|---|
| `restaurants` | TEXT uuid7 | `restaurants.ts`. name/type/category/address/district/city/phone/email, JSON `messagingChannels`, JSON `businessHours` (per-weekday open/close/closed). |
| `restaurant_faqs` | INTEGER | FK → `restaurants.id` cascade; question/answer/keywords(json)/displayOrder/isActive. |
| `categories` | INTEGER | `categories.ts`. |
| `menu_items` | INTEGER | `menu-items.ts`; has `priceCents`, `costPriceCents`, `viewCount`, `imageId` (added in #56), `categoryId`. |
| `restaurant_service_items` | INTEGER | Non-food sellable service items. |
| `tables` | INTEGER | `tables.ts`. |
| `seats` | INTEGER | `seats.ts`. |

**Users / auth / verification**
| Table | PK | Notes |
|---|---|---|
| `users` | TEXT uuid7 | `users.ts`. `role` integer (`USER_ROLES`: ADMIN=0, OWNER=1, CHEF=2, SERVICE=3, CASHIER=4, CUSTOMER=5 *deprecated*), `restaurantId` (references `restaurants.public_id` per comment), `tokenVersion`, JSON `preferences`, soft-delete `deletedAt`. |
| `sessions` | TEXT | `sessions.ts`. |
| `password_reset_tokens` | INTEGER | `verification.ts`. |
| `email_verification_tokens` | INTEGER | `verification.ts`. |
| `phone_verification_tokens` | INTEGER | `verification.ts`. |
| `password_change_logs` | INTEGER | `verification.ts`. |

**Customers**
| Table | PK | Notes |
|---|---|---|
| `customers` | TEXT uuid7 | `customers.ts`. |
| `customer_preferences` | INTEGER | uses bare-string table-name call form `sqliteTable("customer_preferences", {...})`. |
| `customer_favorites` | INTEGER | |
| `customer_recent_markets` | TEXT | |
| `customer_push_subscriptions` | TEXT | Web push. |
| `customer_consents` | TEXT | Consent tracking. |
| `customer_phone_verification_tokens` | INTEGER | |

**Orders / group ordering**
| Table | PK | Notes |
|---|---|---|
| `orders` | TEXT uuid7 | `orders.ts`. `status` TEXT (`ORDER_STATUS`: pending/confirmed/preparing/ready/delivered/paid/cancelled/refunded — **string union, not numeric**). `paymentStatus` TEXT default `"pending"` (comment: pending/completed/failed/refunded). `orderSource` (direct/market_checkout/uber_eats/foodpanda/grabfood). Money as `*Cents` integers. `version` integer for optimistic concurrency. Partial-unique indexes: `orders_waiting_list_unique` (excludes cancelled/refunded), `orders_payment_transaction_unique` (`WHERE payment_transaction_id IS NOT NULL`). FKs → `tables`, `customers` (`set null`), `waiting_list` (`set null`). |
| `order_items` | INTEGER | `order-items.ts`. `status` TEXT default `"pending"` (comment: pending/preparing/ready/served/cancelled — **5-value string union**). JSON `itemSnapshot` (menu snapshot at order time) and `customizations`. FK → `orders.id` cascade, `menu_items.id` restrict. |
| `group_orders` | TEXT | `group-orders.ts`. |
| `group_members` | TEXT | |
| `group_cart_items` | TEXT | |
| `split_bills` | TEXT | |
| `share_codes` | TEXT | |
| `group_activity_logs` | TEXT | |

**Reservations / waiting / service bookings**
| Table | PK | Notes |
|---|---|---|
| `reservations` | TEXT (service-layer `rsv_{base36}` — **not a UUID**) | `reservations.ts:34` plain PK; ID from `ReservationService.ts:1115-1119`: `"rsv_" + Date.now().toString(36) + Math.random().toString(36).substr(2,9)` — non-cryptographic home-grown scheme. |
| `reservation_slots` | TEXT | |
| `waiting_list` | TEXT (service-layer `wait_{uuid-v4}`) | `waiting-list.ts:34` plain PK; ID from `WaitingListService.ts:1500` `` `wait_${crypto.randomUUID()}` ``. Referenced by `orders.waitingListId`. |
| `service_bookings` | TEXT uuid7 | `service-bookings.ts`. |
| `service_booking_slots` | TEXT | |
| `service_booking_waitlist` | TEXT | |

**Payments / POS**
| Table | PK | Notes |
|---|---|---|
| `payment_transactions` | INTEGER | `payments.ts`. Has `idempotency_key` (partial-unique, see §2.3). |
| `refund_transactions` | INTEGER | |
| `payment_audit_log` | TEXT uuid7 | `payment-audit-log.ts:32-34` — schema-level `$defaultFn(() => uuidv7())`. |
| `cash_registers` | TEXT (service-layer uuid v4) | `pos.ts:26` — plain `text("id").primaryKey()`, no default; ID assigned by `POSService.ts:271` `crypto.randomUUID()`. |
| `cash_shifts` | TEXT | |
| `cash_movements` | TEXT | |
| `receipts` | TEXT | |
| `refunds` | TEXT | |
| `shift_reports` | TEXT | |

**Coupons / stored-value credits**
| Table | PK | Notes |
|---|---|---|
| `coupons` | INTEGER | `coupons.ts`. `DISCOUNT_TYPE` (percentage/fixed), `DISTRIBUTION_TYPE` (manual/auto/bulk/promotion), `TARGET_TYPE` (all/user/group/new_user/vip), `USAGE_STATUS` (active/refunded/cancelled) — all string-literal const objects, not DB enums. |
| `coupon_usage` | INTEGER | Has a "refund release marker" per migration `0066`/`0084`. |
| `coupon_distributions` | INTEGER | |
| `coupon_templates` | INTEGER | |
| `user_coupons` | TEXT uuid7 | `user-coupons.ts:41-43` — schema-level `$defaultFn(() => uuidv7())`. |
| `credit_accounts` | TEXT uuid7 | `credits.ts` — 代幣 (stored-value token) ledger design. Optimistic-lock `version` column; balance mutated only via conditional `UPDATE ... WHERE balance_cents >= :amount AND version = :expectedVersion` per the file's design comment (no read-modify-write). `CREDIT_ACCOUNT_STATUS`: active/frozen/closed. |
| `credit_cards` | TEXT uuid7 | Access credential pointing at an account; `CREDIT_CARD_STATUS`: active/frozen/lost/replaced. |
| `credit_ledger_entries` | TEXT uuid7 | Append-only audit trail; `CREDIT_ENTRY_TYPE`: topup/spend/refund/expire/adjust. `idempotency_key TEXT NOT NULL UNIQUE` (double-spend guard). |
| `credit_topup_intents` | TEXT uuid7 | `credit-topup-intents.ts`. |

**Markets (multi-vendor discovery / checkout)**
| Table | PK | Notes |
|---|---|---|
| `markets` | TEXT uuid7 | `markets.ts`. |
| `restaurant_market_memberships` | INTEGER | |
| `market_join_requests` | INTEGER | |
| `market_checkout_sessions` | TEXT (caller-supplied uuid v4) | `markets.ts:157` plain PK; ID from `market-checkouts/routes/index.ts:417` `crypto.randomUUID()`. |
| `market_checkout_child_orders` | INTEGER | Cents-only after migration `0071` cutover. |
| `market_checkout_payments` | INTEGER | Has partial-unique `idempotency_key` index (see §2.3). |
| `dish_search_index` | INTEGER (autoincrement) | `discovery.ts`. Backs the `dish_search_fts` FTS5 virtual table (rowid = `id`). Unique index on `menu_item_id`. JSON `tags`, `marketIds`. |

**Scheduling / HR**
| Table | PK | Notes |
|---|---|---|
| `shift_templates` | INTEGER | `scheduling/shift-templates.ts`. |
| `employee_schedules` | INTEGER | `scheduling/employee-schedules.ts`. |
| `scheduling_rules` | INTEGER | |
| `scheduling_conflicts` | INTEGER | |
| `schedule_swap_requests` | INTEGER | |
| `employee_availability` | INTEGER | |
| `leave_types` | INTEGER | `leaves/leave-types.ts`. |
| `employee_leave_balances` | INTEGER | |
| `leave_requests` | INTEGER | |
| `leave_approval_rules` | INTEGER | |
| `leave_calendar_events` | INTEGER | |

**Partnerships / platform integrations**
| Table | PK | Notes |
|---|---|---|
| `partnerships` | TEXT uuid-v4-no-dashes | `partnerships/partnerships.ts:60-62` — `$defaultFn(() => crypto.randomUUID().replace(/-/g, ""))`; **not** uuid7. |
| `partnership_plans` | TEXT uuid-v4-no-dashes | `partnerships/plans.ts:38-40` — same `crypto.randomUUID().replace(/-/g,"")` pattern; **not** uuid7. |
| `partnership_usage_logs` | TEXT uuid-v4-no-dashes | `partnerships/usage-logs.ts:49-51`; **not** uuid7. |
| `verified_members` | TEXT uuid-v4-no-dashes | `partnerships/members.ts:49-51`; **not** uuid7. |
| `platform_integrations` | INTEGER | Uber Eats/Foodpanda/Grabfood credentials, per `platform-integrations.ts`. |
| `platform_orders` | TEXT uuid7 | `platform-orders.ts`. |
| `platform_menu_mappings` | INTEGER | |
| `platform_webhook_logs` | INTEGER | |

**QR & images**
| Table | PK | Notes |
|---|---|---|
| `qr_codes` | TEXT uuid7 | `qr-codes.ts:6-8` — schema-level `$defaultFn(() => uuidv7())`. |
| `qr_templates` | INTEGER | |
| `qr_downloads` | INTEGER | |
| `qr_batches` | INTEGER | |
| `images` | TEXT uuid7 | `images.ts:6-8` — schema-level `$defaultFn(() => uuidv7())`. `uploaded_by` moved INTEGER→TEXT in migration 0073/0090 for UUID v7 user IDs (issue #56). |
| `image_views` | INTEGER | |
| `image_processing_jobs` | INTEGER | |

**Subscriptions / usage / billing**
| Table | PK | Notes |
|---|---|---|
| `shop_subscriptions` | TEXT uuid7 | `subscriptions.ts`. Defines `MODULES` (feature-flag keys: menu_management, table_management, online_ordering, pos, kitchen_display, receipt_printing, coupons, reservations, analytics, multi_branch, ai_analytics, platform_integration, loyalty, inventory, staff_management) and `PLAN_TIERS` (trial/basic/pro/enterprise) with `PLAN_DEFAULT_MODULES` per tier. |
| `usage_events` | TEXT uuid7 | `usage-events.ts`; defines `MeterKey` type (e.g. `orders.created`, `api.requests`, `print.jobs`, `ai.requests`, `storage.bytes` — used by `plan-quotas.ts`). |
| `usage_meters` | TEXT uuid7 | |
| `storage_counters` | **restaurantId (TEXT, PK)** | `storage-counters.ts`. **No `id` column** — PK is `restaurantId` itself, FK → `restaurants.id`. `r2Bytes`, `imagesCount`. |
| `cycle_snapshots` | TEXT uuid7 | `cycle-snapshots.ts`. |

**Backup system**
| Table | PK | Notes |
|---|---|---|
| `backup_records` | TEXT | `backup.ts`. |
| `backup_schedules` | TEXT | |
| `backup_configurations` | TEXT | |
| `backup_alerts` | TEXT | |
| `backup_audit_logs` | TEXT | |
| `restore_operations` | TEXT | |

**AI / analytics / forecast**
| Table | PK | Notes |
|---|---|---|
| `ai_configurations` | INTEGER | `ai-analytics.ts` (schema file; distinct from the `@makanmakan/ai-analytics` package). |
| `ai_usage_logs` | INTEGER | |
| `forecast_cache` | INTEGER | `forecast.ts`. |
| `ingredient_definitions` | INTEGER | |
| `menu_item_ingredients` | INTEGER | |

**Feedback**
| Table | PK | Notes |
|---|---|---|
| `shop_feedback` | INTEGER | `feedback.ts`. |
| `feedback_responses` | INTEGER | |

**System / audit / integrity**
| Table | PK | Notes |
|---|---|---|
| `audit_logs` | INTEGER | `audit-logs.ts`. |
| `error_reports` | INTEGER | `error-reports.ts`. |
| `system_alerts` | INTEGER | |
| `data_integrity_audit` | INTEGER | `data-integrity-audit.ts`. |
| `idempotency_keys` | **key (TEXT, PK)** | See §2.3. |
| `notification_dispatch_log` | TEXT uuid7 | `notification-dispatch-log.ts`. |

Total: **109 tables** (excluding the `dish_search_fts` virtual table, which has no Drizzle definition and is managed purely via raw SQL migration + triggers).

### 2.6 Exported query/service helpers (`src/index.ts`, `src/services/index.ts`, `src/utils/*`)

- **Drizzle factory**: `createDatabase(d1: D1Database, isDevelopment?: boolean)`.
- **Query primitive re-exports**: `sql, count, eq, gte, and, lte, desc, asc, sum, avg, between, isNull` from `drizzle-orm`, plus `drizzle` from `drizzle-orm/d1`.
- **Money**: `toCents`, `toRequiredCents`, `fromCents`, `amountFromCents`, `toPercentageBps`, `toRequiredPercentageBps`, `percentageFromBps` (`utils/money.ts`); `moneyCentsExpression`, `moneyAmountExpression`, `sumMoneyAmount`, `avgMoneyAmount`, `avgAbsMoneyAmount` (`utils/money-sql.ts`, SQL-template helpers for Layer-2 queries).
- **Time**: `utils/timestamp.ts` (`getCurrentTimestamp` (ISO string!), `getUnixTimestamp`, `getUnixTimestampMs`, `isoToUnix`, `unixToIso`, `getTimestampOffset`, `isExpired`, `formatTimestamp`, `getTimeDifference`, `TIME_OFFSET`/`TIME_OFFSET_SECONDS` constants) — **note**: despite the project-wide "integer ms" convention, several of these helpers are ISO-string-based; `getCurrentTimestamp()` returns an ISO string, not ms. Grep call sites before assuming ms everywhere.
- **Business day**: `utils/business-day.ts` (`getBusinessDate`, `businessDateSql`, `businessDateFromUnixMsSql`) and `utils/sql-time.ts` (`dateFromUnixMs`, `strftimeFromUnixMs`, `businessDateNow`, `juliandayFromUnixMs`, `unixMsDiffMinutes`, `unixMsDiffSeconds`) — both hard-code the +8h business-timezone offset.
- **Soft delete**: `utils/soft-delete.ts` — `notDeleted`, `isDeleted`, `withSoftDelete` (Drizzle predicate helpers) and class `SoftDeleteService` (`softDelete`, `restore`, `purgeExpired`, `countDeleted`, `countExpired`). **Flag**: `SoftDeleteService.softDelete()` sets `deletedAt` to `Math.floor(Date.now()/1000)` (Unix **seconds**) and `purgeExpired`/`countExpired` compute `cutoffTime` in seconds too, while the actual `deletedAt` schema columns are declared `{ mode: "timestamp_ms" }` (milliseconds) on tables like `users`. This looks like a unit mismatch between this generic service and the ms-based schema convention — verify actual call sites before porting this logic as-is to Rust.
- **Plan/quota mapping**: `utils/plan-mapping.ts` (`PLAN_ID_TO_TIER`, `planIdToTier`, `TRIAL_DURATION_MS`, `DEFAULT_BILLING_CYCLE_MS`) and `utils/plan-quotas.ts` (`PLAN_QUOTAS: Record<PlanTier, Partial<Record<MeterKey, {soft,hard}>>>` — concrete numeric quotas per tier for `orders.created`, `api.requests`, `print.jobs`, `ai.requests`, `storage.bytes`).
- **ID generation**: `services/id-generation.ts` — `prefixedUuid(prefix)` (`${prefix}_${crypto.randomUUID()}`, **not** v7) and `businessNumber(prefix, now?)` (human-facing order/business numbers).
- **Customer-identity preflight**: `customer-identity-preflight.ts` — `runCustomerIdentityPreflight(db: D1Database)` runs raw SQL (not Drizzle) to detect duplicate phone/email across legacy `users` (role 5) and `customers`, using `normalizeE164Phone` from `@makanmakan/utils`.
- **Domain services** (all exported from `src/services/index.ts`, each a class taking a Drizzle db instance): `BaseService`, `RestaurantService`, `MenuService`, `OrderService`, `AuthService`, `UserService`, `SessionService`, `TableService`, `SeatService`, `AnalyticsService`, `ErrorReportingService`, `QRCodeService`, `POSService`, `ImageService`, `CouponService`, `LeaveService`, `SchedulingService`, `ReservationService`, `WaitingListService`, `CustomerWebPushService`, `NotificationService`, `ExportService`, `LeaveAnalyticsService`, `PartnershipService`, `VerificationService`, `FeedbackService`, `RealtimeBroadcastService` (bridge to the `apps/realtime` Durable Object), plus `ticket-primitives` (`WAITING_TRANSITIONS`, `isValidWaitingTransition`, `assertWaitingTransition` — shared state-machine utilities for waiting-list/queue ticket flows).

---

## 3. packages/shared, packages/shared-types & packages/utils

### 3.1 packages/shared-types (`@makanmakan/shared-types`)

Pure `.ts` type package (`tsc` build only, zero runtime deps). `src/index.ts` re-exports 26 modules: `database`, `api`, `user`, `restaurant`, `menu`, `service`, `order`, `table`, `seat`, `websocket`, `common`, `payment`, `stripe`, `printer`, `backup`, `pagination`, `scheduling`, `leaves`, `realtime-events`, `reservation`, `schema-json-types`, `platform`, `forecast`, `ingredient`, `coupon`, `consents`.

Key exports:
- **`common.ts`**: `ApiResponse<T>` (`{ success, data?, error?: {code, message, details?}, pagination? }` — matches CLAUDE.md's mandated error envelope), `BaseEntity` (`{id: number, createdAt: string, updatedAt: string}`), `UUIDEntity` (`{id: string, ...}` for UUID tables), `enum Status { INACTIVE=0, ACTIVE=1 }`, **`enum UserRole { ADMIN=0, OWNER=1, CHEF=2, SERVICE=3, CASHIER=4, CUSTOMER=5 }`** (matches CLAUDE.md's role table and the DB's `USER_ROLES` const in `users.ts`), `enum SpiceLevel`, `DietaryInfo`, `BusinessHours`, `ImageVariants`.
- **`database.ts`**: `D1Result<T>`, `D1SingleResult<T>`, `D1BatchResult`, `DatabaseConfig`, `QueryOptions`, `MigrationStatus`, `DatabaseStats` — these describe the raw Cloudflare D1 HTTP/binding response shape (`{results, success, meta: {served_by, duration, changes, last_row_id, rows_read, rows_written, size_after}}`), directly relevant to a Rust D1 HTTP client's response types.
- **`order.ts`**: `PlatformSource`, `DeliveryInfo`, `CustomerInfo`, `TableInfo`, `RestaurantInfo`, `CustomerProfile`, `Order` (overrides `BaseEntity`'s `id`/`createdAt`/`updatedAt` to `string`/`number`(ms)/`number`(ms) — the file has an explicit comment pointing at `packages/database/src/services/order.ts`'s `toMillis` and an integration test as the enforcement point for this wire contract). `ORDER_STATUSES` const array + `OrderStatus` string-union type explicitly documented as "matches the DB schema in `orders.ts` exactly... do not reintroduce a numeric variant" (with links to an internal investigation doc and migration plan). **However**, in the same file, `enum OrderPaymentStatus { PENDING=0, PAID=1, FAILED=2 }` and `enum OrderItemStatus { PENDING=0, PREPARING=1, READY=2, DELIVERED=3 }` remain **numeric enums**, while the actual DB columns (`orders.payment_status`, `order_items.status`) are plain `text(...)` columns with string values (`"pending"|"completed"|"failed"|"refunded"` per the schema comment, and `"pending"|"preparing"|"ready"|"served"|"cancelled"` respectively) — i.e. **these two enums do not match the DB's actual string values or cardinality**. This is a real, verified inconsistency (not merely hypothetical) — a Rust port should model `payment_status`/order-item `status` as string enums matching the DB, not reuse `OrderPaymentStatus`/`OrderItemStatus` as numeric.
- **`payment.ts`, `stripe.ts`, `printer.ts`, `backup.ts`, `scheduling.ts`, `leaves.ts`, `reservation.ts`, `platform.ts`, `forecast.ts`, `ingredient.ts`, `coupon.ts`, `consents.ts`, `pagination.ts`, `websocket.ts`, `realtime-events.ts`, `schema-json-types.ts`, `table.ts`, `seat.ts`, `menu.ts`, `restaurant.ts`, `service.ts`, `user.ts`**: present but not exhaustively enumerated in this pass — recommend a follow-up read if the Rust port needs their exact field lists (each maps 1:1 in spirit to a `packages/database/src/schema/*.ts` file or an API request/response contract).

### 3.2 packages/utils (`@makanmakan/utils`)

Runtime-agnostic (no Node-only APIs beyond what bundlers polyfill; used in both Workers and browser code). `src/index.ts` exports:
- **Request dedup**: `RequestDeduplicator`, `getDeduplicator`, `resetDeduplicator`, `deduplicate`, `withDeduplication`, `batchDedupe` (`request-deduplication.ts`) + an axios interceptor wrapper (`axios-deduplication-interceptor.ts`: `installAxiosDeduplication`, `skipDedup`, `withDedupTTL`, `combineConfigs`).
- **Error tracking**: `ErrorTracker` class + `ErrorSeverity`/`ErrorCategory`/`ErrorContext`/`ErrorBreadcrumb`/`TrackedError` types (`error-tracking.ts`) — client-side error/breadcrumb collector, separate from the DB's `error_reports` table.
- **Performance monitoring**: `PerformanceMonitor`, `WebVitals`, `ResourceTiming`, `PerformanceReport` (`performance-monitor.ts`) — browser Web Vitals collector.
- **UUID**: `generateUUID` (uuid v7 via the `uuid` package), `isValidUUID` (regex — accepts v1–v5 shape too, doesn't strictly validate v7), `extractUUIDTimestamp` (decodes the first 48 bits as a Unix-ms timestamp — **only valid for actual v7 UUIDs**; will produce garbage for v4).
- **Phone**: `normalizeE164Phone` (`phone.ts`) — used by the customer-identity preflight and elsewhere.
- **Validation** (`src/validation/id-schemas.ts`, exported as `./validation` from `index.ts` — note: this is a **subdirectory**, easy to miss on a shallow `find -maxdepth`): `uuidSchema`, `restaurantIdSchema` (both `z.string().uuid()`), `numericIdSchema` (`z.number().int().positive()`), `numericIdParamSchema` (string→number transform, `/^\d+$/` regex), `restaurantIdParamSchema`, `optionalRestaurantIdSchema`, `optionalNumericIdSchema`. These are the canonical Zod validators for the TEXT-uuid-vs-INTEGER-id split described in §2.5.
- **Timestamp**: `ensureMilliseconds`, `ensureSeconds`, `nowMs`, `nowSeconds`, `toMs`, `toSeconds`, `fromMs`, `fromSeconds`, `isMilliseconds`, `isSeconds` (`timestamp.ts` — distinct file from `packages/database/src/utils/timestamp.ts`; the two packages have separately-maintained, differently-shaped timestamp helper sets — worth consolidating into one Rust module rather than porting both separately).
- **Encryption**: `encrypt`, `decrypt` (`encryption.ts` — AES-256 per CLAUDE.md's security section; verify exact mode/IV handling in the source before porting).
- **QR signing**: `signQRPayload`, `verifyQRSignature`, `buildSignedQRUrl`, `parseSignedQRUrl` (`qr-signing.ts`).
- **API errors**: `ApiError` class (`code`, `message`, `status`, `details`), factory functions `notFound`, `badRequest`, `unauthorized`, `forbidden`, `conflict` (all match the CLAUDE.md-mandated envelope), and `sanitizeApiErrorDetails` — a recursive redactor that strips any object key matching `/password|passcode|token|secret|authorization|cookie|api[-_]?key|key/i`, caps array length at 50 and recursion depth at 5, and handles circular refs. This is the concrete implementation backing CLAUDE.md's "Error Response Format" rule.
- **Currency**: `formatCurrency`, `getCurrencySymbol`, `getCurrencyConfig`, `CURRENCY_CONFIGS`, `DEFAULT_CURRENCY` (`currency.ts`).
- **Token**: `decodeJwtPayload` (manual base64url JWT payload decode, no signature verification — client-side only), `isTokenExpired`, `getRefreshDelay` (schedules proactive refresh at **80% of token lifetime**, used by `auth-client`), `getTimeUntilExpiry` (`token.ts`).

---

## 4. packages/auth-client

Browser-only axios wrapper (`type: "module"`, deps: `axios`, `@makanmakan/utils`). Three files:

- **`storage.ts`**: `createPrefixedStorage(prefix, overrides?, mode?)` → `PrefixedStorage` (localStorage/sessionStorage/in-memory, keyed as `{prefix}_auth_token` by convention, overridable per key — e.g. admin-dashboard uses bare `auth_token`).
- **`create-token-manager.ts`**: `createTokenManager(config)` → `TokenManager`. Handles: read/write tokens through the storage adapter; **proactive refresh** scheduled via `setTimeout` at the delay returned by `getRefreshDelay` (utils' 80%-of-lifetime JWT heuristic); **concurrent-refresh deduplication** — a shared in-flight `Promise<boolean>` so parallel 401s trigger only one refresh call; `clearAll()` also clears the timer.
- **`create-api-client.ts`**: `createAuthenticatedApiClient(config)` → `ApiClient` wrapping an axios instance:
  - Default `baseURL: "/api/v1"`, `timeout: 10000`, `withCredentials: true`.
  - Request interceptor attaches `Authorization: Bearer <token>` from storage, plus an optional CSRF header (default header `X-CSRF-Token`, cookie `__Host-mm_csrf`, protected methods `POST/PUT/DELETE/PATCH`) read from a cached value or `document.cookie`.
  - Response interceptor: on `401` (and not already retried), calls `tokenManager.refreshToken()`; if `retryOn401` (default `true`) it retries the original request with the new token, else it clears storage and invokes `onAuthFailure`. Non-401 errors go through an optional `errorHandler`.
  - `tokenStorage` mode can be forced to `"memory"` for staff/admin surfaces that rely on HttpOnly refresh cookies and must not persist bearer tokens in browser storage (explicit config comment).
  - Exposes `get/post/put/patch/delete/upload/setAuthToken/destroy`.

No server-side/Workers code in this package — a Rust rewrite of the *backend* doesn't need to port this package at all; it's purely a frontend HTTP-client concern. Included here for completeness since it defines the wire contract (`Authorization: Bearer`, CSRF header/cookie names, refresh endpoint `POST /auth/refresh` expecting `{data: {token, refreshToken?, user?}}`) that the Rust API must keep serving.

---

## 5. packages/queue-core & packages/queue-service

**Important scope correction**: despite the "queue" naming, this is **not** a Cloudflare Queues / message-broker package. It models an in-restaurant **walk-in waiting queue** (the "take a number, wait for a table" flow) as a plain domain layer with dependency-injected repository interfaces — there is no producer/consumer, no broker, and no retry/backoff policy visible in this package. (Cloudflare Queues, if used at all in this repo, would need to be located elsewhere — not found under these two packages.)

### 5.1 queue-core (`packages/queue-core/src`)

- **`types/queue.ts`**: `QueueStatus` enum (`waiting|called|notified|seated|cancelled|no_show|expired`), `QueueType` (`walkin|online|phone|reservation`), `NotificationType` (`sms|push|email|call|display`), `NotificationStatus` (`pending|sending|sent|delivered|failed|expired`). Core entity `WaitingQueue` (all `readonly` fields — restaurantId/userId typed as `number` here, **not** the TEXT-uuid convention used elsewhere in the DB layer — this package predates or diverges from the DB's UUID migration and should not be taken as authoritative for current ID types; cross-check against the live `waiting_list` Drizzle table before porting). Also `QueuePosition`, `QueueNotification`, `QueueSettings`, `QueueStatistics`, `HourlyQueueBreakdown`, `QueueEvent`, `TableStatusHistory`.
- **`errors/queue-errors.ts`**: `QueueError` base class (`code`, `statusCode`, `details`) plus ~14 specific subclasses (`QueueValidationError` 400, `QueueNotFoundError` 404, `QueueFullError` 400, `QueueDisabledError` 400, `QueueOutsideBusinessHoursError` 400, `InvalidQueueStatusError` 400, `QueueAlreadyProcessedError` 400, `QueueUnauthorizedError` 403, `InvalidCheckInCodeError` 401, `TableNotAvailableError`/`TableNotFoundError` 400/404, `NotificationFailedError`/`NotificationProviderError` 500, `QueueDatabaseError` 500, `QueueConfigurationError` 500, `QueueRateLimitError` 429). Helper: `isQueueError`, `getErrorCode`, `getErrorStatusCode`, `formatErrorResponse` (→ `{success:false, error, code, details?}`, matching the shared API-error envelope shape).
- **`interfaces/`**: `IQueueService`, `IQueueRepository`, `IQueueSettingsRepository`, `IQueueNotificationService`, `IQueueMetricsService`, `IQueueEventService` — pure contracts; no concrete DB implementation shipped in this package (repositories are injected by the consuming app).
- **`validators/`**: Zod schemas `joinQueueSchema`, `callNextSchema`, plus `validateJoinQueue`, `validateCallNext`, `validateSeatCustomer`, `validateCancelQueue`, `validateUpdateQueueSettings`, `apiResponseSchema`.
- **`performance/queue-cache.ts`**: an in-memory cache layer (present, not detailed in this pass).
- **`print/*`** — a fully separate ESC/POS thermal-printer subsystem bundled in the same package:
  - `drivers/`: `PrinterDriver` (abstract), `EpsonDriver`, `StarDriver`, `CitizenDriver`, `PrinterDriverFactory` (singleton factory with per-brand auto-detection).
  - `commands/`: `ESCPOSCommands`, `CommandBuilder`.
  - `formatters/`: `ReceiptFormattingService`, `ReceiptFormatterFactory`, region-specific formatters (`TWRegionFormatter`, `MYRegionFormatter`, `VNRegionFormatter`) via `RegionFormatterFactory`.
  - `services/`: `PrinterService`, `PrintJobManager`, `RegionManager`.
  - `config/`: `defaults.ts` (`DEFAULT_PRINT_CONFIG` — queue `maxConcurrentJobs: 3`, `maxRetries: 3`, `retryDelay: 5000ms`, `jobTimeout: 30000ms`, `maxQueueSize: 100`; driver `connectionTimeout: 10000ms`, `commandTimeout: 5000ms`, `heartbeatInterval: 30000ms`, `retryAttempts: 3`; default region `"TW"`), `brands.ts` (`PRINTER_BRANDS`), `regions.ts` (`REGION_CONFIGS`).
  - `errors/PrintErrors.ts`: `PrintError`, `PrinterConnectionError`, `PrintJobError`, `PrintFormattingError`.
  - `utils/`: `PrintContentValidator`, `PrinterHealthMonitor`, `PrintStatisticsCollector`.
  - This is what `apps/print-agent` actually imports (confirmed via grep: `apps/print-agent/src/LocalPrintService.ts`, `apps/print-agent/src/services/PrintAgentService.ts`) — the print subsystem, not the waiting-queue domain types, is queue-core's real production consumer alongside `apps/api`.

### 5.2 queue-service (`packages/queue-service/src`)

- **`services/QueueService.ts`**: the only file. Implements `IQueueService` by constructor-injecting `IQueueRepository`, `IQueueSettingsRepository`, `IQueueNotificationService`, `IQueueMetricsService`, `IQueueEventService`. Methods: `joinQueue`, `getQueueStatus`, `getQueuePosition`, `callNext`, `seatCustomer`, `cancelQueue`, `getCurrentQueue`, `getQueueHistory`, `getQueueStatistics`, `getQueueSettings`, `updateQueueSettings`, `cleanupExpiredQueues`. All methods catch internally and return `ApiResponse<T>` (`{success, data?, error?}`) rather than throwing — errors are logged via `console.error` and converted to a string `error` field, discarding the structured `QueueError` subtype/code/details in the process (only the `.message` survives to the caller).
- Business rules embedded here (verified in code, worth preserving in a Rust port if this logic is ever revived): queue-full check against `settings.maxQueueSize`; a simplified always-open-unless-configured business-hours check (`currentHour >= 10 && currentHour < 22` when `businessHours` has any keys, else always open); check-in code generation via `Math.random().toString(36)` (6 chars, not cryptographically strong); default settings factory (`maxQueueSize: 50`, `avgServiceTime: 45`, `maxWaitTime: 120`, `noShowTimeout: 15`, `autoCallInterval: 10`, `queueNumberReset: "daily"`); `cleanupExpiredQueues` marks no-shows after 15 minutes and hard-deletes records older than 30 days.
- **As established in §1, no `apps/*` currently depends on `@makanmakan/queue-service`.** Before porting this to Rust, confirm with the team whether it's dead code, a planned-but-unwired feature, or superseded by `packages/database/src/services/WaitingListService.ts` (which does have live DB-backed usage) — this doc cannot determine intent from static analysis alone.

---

## 6. packages/ai-analytics

`@makanmakan/ai-analytics` depends on `@makanmakan/shared-types` and `@makanmakan/database` (Layer-2 Drizzle `sql`-template queries — this package is explicitly named as one of the two reference implementations for CLAUDE.md's "Database Query Strategy" Layer 2 pattern).

### 6.1 LLM provider abstraction (`src/providers/`)

- `BaseLLMProvider` abstract class: `chat(request): Promise<LLMResponse>`, `test(): Promise<{success, latencyMs?, error?}>`, `getModel()` (falls back to `getDefaultModel()`), `validateApiKey()`.
- Concrete providers: `AnthropicProvider`, `OpenAIProvider`, `GoogleProvider`, `DeepSeekProvider` (files exist per package listing; internals not read in this pass).
- `createProvider(config: LLMConfig)`: factory switching on `config.provider` (`anthropic|openai|google|deepseek|custom`); `"custom"` requires `baseUrl` and is implemented as an OpenAI-compatible provider.
- `testProvider(config)`: wraps `createProvider(...).test()`, returns `{success, provider, model?, latencyMs?, error?}`.
- `getDefaultModel(providerType)` / `getAvailableModels(providerType)`: curated model-ID lists per provider (e.g. anthropic: `claude-sonnet-4-6`, `claude-opus-4-6`, `claude-haiku-4-5-20251001`) — these are UI suggestion lists, not enforced allow-lists (comment: "users can also enter any model ID manually").

### 6.2 ProductAnalysisService (`src/services/ProductAnalysisService.ts`)

Computes three named business categories over a restaurant's menu items within a time range, reading `menuItems`, `orderItems`, `orders`, `categories` from `@makanmakan/database` via Drizzle Layer-2 `sql` templates (joins + `COUNT(DISTINCT orders.id)`, `SUM(orderItems.totalPriceCents)/100.0`, grouped by `menuItems.id`):
- **引流產品 / Traffic drivers** (`getTrafficDrivers`): filtered by a `traffic-driver` category tag, ranked by `firstItemInOrderCount` (currently always `0` in the raw query — `first_item_count`/`cart_addition_count` are hard-coded `sql<number>\`0\`` placeholders, i.e. **not actually computed yet** — flag this as an incomplete feature, not a bug in your Rust port).
- **熱銷產品 / Bestsellers** (`getBestsellers`): ranked by `total_orders` descending.
- **利潤最大產品 / Profit leaders** (`getProfitLeaders`): filtered to `totalProfit > 0`, ranked descending; profit requires `menuItems.costPriceCents` to be non-null (many rows won't have cost data).
- **Underperformers** (`getUnderperformers`): negative-trend filter.
- `analyzeProducts()` orchestrates: fetch raw metrics → per-item daily time series (`fetchDailyData`, bucketed via `DATE(orders.created_at / 1000, 'unixepoch')` — **note: no +8h business-day offset here**, unlike `sql-time.ts`'s helpers) → `calculateTrendScore` (simple linear-regression slope, normalized by mean, clamped to [-1,1]) → `calculateGrowthRate` (% change between first/second half of the date range) → `calculateRankings` (sales/revenue/profit rank maps) → `categorizeProduct` (rule thresholds: traffic-driver needs `first_item_count/total_orders > 0.3` AND `first_item_count >= 5` — unreachable given the `0` placeholder above; bestseller = top 20% by sales rank; profit-leader needs margin > 0.5 AND `total_orders >= 10`; underperformer = `trendScore < -0.3` OR (`total_orders < 5` AND `trendScore < 0`)).
- Only queries `orders` with `status = "completed"` — **note this string doesn't appear in the `ORDER_STATUS` const in `orders.ts`** (which has `paid`/`delivered`/etc. but no `"completed"` value) — worth confirming against real data before porting this filter verbatim; it may be intentionally lenient/legacy or may be a latent bug.

### 6.3 AIInsightsService (`src/services/AIInsightsService.ts`)

Constructed with a raw D1 database handle (`prepare/bind/all/first/run` shape, matching Workers' native `D1Database`) and an optional separate Drizzle instance (defaults to reusing the raw handle if not given) — wraps `ProductAnalysisService` for metrics. `generateReport(restaurantId, llmConfig, timeRange, options)`: checks a cache (`getCachedReport`) unless `refreshCache`, gathers `BusinessMetrics`, calls the configured LLM provider to generate `AIInsight[]` and an executive summary, optionally generates a forecast, and returns an `AIAnalyticsReport` (`id` via `crypto.randomUUID()` — **note: v4, not v7**, `generatedAt` ISO string, `metadata.processingTimeMs`).

### 6.4 Types (`src/types/index.ts`, ~370 lines)

Defines (not exhaustively read): `LLMProvider`, `LLMConfig`, `LLMRequest`, `LLMResponse`, `TimeRange`/`TimeRangeParams`, `ProductCategory`, `ProductAnalysis`, `BusinessMetrics`, `AIInsight`, `AIAnalyticsReport`, `AIConfiguration`, `AIInsightsCache`, `ProductAnalyticsCache`, `GenerateAnalyticsRequest/Response`, `ConfigureAIRequest/Response`. Recommend a direct read of this file before finalizing Rust struct definitions for the AI-analytics API surface, since only headers were sampled here.

---

## 7. Rust rewrite notes

### 7.1 Drizzle schema → Rust data-access mapping

- **D1 access strategy**: Cloudflare D1 in a Rust Worker (via `workers-rs`) exposes a `D1Database` binding whose query surface is closer to a raw prepared-statement API (`prepare(sql).bind(..).all()/.first()/.run()`) than an ORM. There is no mature `sea-orm`/`diesel` driver for D1's HTTP/binding protocol at present (verify current ecosystem state before committing) — the pragmatic default is **hand-written parameterized SQL via the `workers-rs` D1 binding**, mirroring the existing "Layer 1 / Layer 2" split from CLAUDE.md rather than introducing a full ORM:
  - Layer 1 (CRUD) → thin repository structs with `sqlx`-style query building or a small internal query-builder, one per domain (mirroring `packages/database/src/services/*.ts`).
  - Layer 2 (analytics) → hand-written SQL strings with `format!`/parameter binding, unit-tested against the exact column names in the schema tables below (since Rust loses Drizzle's compile-time column-reference safety — consider a `sqlx::query!` macro against a real D1-compatible SQLite file for compile-time column checking, since `sqlx` supports plain SQLite locally even though D1 itself is remote).
  - If a synchronous/local SQLite mirror is acceptable for dev/test (D1 is SQLite-compatible), `sqlx` with the `sqlite` feature could restore compile-time query checking during development, with a thin adapter swapping to D1 HTTP calls in production Workers.
- **Schema translation**: every table in §2.5 needs a matching Rust struct with `serde(rename_all = "camelCase")` (matching Drizzle's JS-side camelCase property names against snake_case SQL columns) or explicit `#[serde(rename = "...")]` per field, since the DB columns are snake_case (`restaurant_id`) but the TS/JS layer (and any future Rust struct meant to serialize to matching JSON) uses camelCase (`restaurantId`).
- **PK types**: model TEXT-uuid7 tables' `id` as a `Uuid` (via the `uuid` crate, which supports v7) wrapped in a newtype per table (`RestaurantId(Uuid)`, `OrderId(Uuid)`, etc.) to prevent cross-table ID mixups at compile time — something TS's structural typing does **not** give you today (a `string` typed as a restaurant ID and one typed as a user ID are interchangeable in TS; Rust newtypes would be a strict improvement here). INTEGER-autoincrement tables' `id` map to `i64` (D1/SQLite `INTEGER` is 64-bit).
- **Timestamps**: every `_ms` column → `i64` unix-milliseconds in Rust, converted at the API boundary to/from `chrono::DateTime<Utc>` (or `time::OffsetDateTime`) only where human-readable display or date arithmetic is needed; keep the wire/DB representation as `i64` ms to match the JS side exactly (JS `Date` serializes to ms epoch numbers here, not ISO strings, in the DB layer — see §2.2). **Caution**: some helper functions (`packages/database/src/utils/timestamp.ts`'s `getCurrentTimestamp()`, and several `shared-types` fields) use ISO-8601 **strings**, not ms integers — audit each API response shape individually; do not assume a single global convention holds for every field (`Order.createdAt` is ms `number`, but other generic `BaseEntity` timestamps in `shared-types/common.ts` are typed `string`).
- **Money**: keep integer cents (`i64` or `i32` depending on max order value) as the canonical Rust representation, matching the DB; provide `Cents(i64)` newtype with `to_decimal()`/`from_decimal()` conversions mirroring `money.ts`. Percentage discounts as basis points (`i32`, matching `*_bps` columns).
- **JSON columns**: many tables store structured data in `text(..., {mode:"json"})` columns (e.g. `restaurants.business_hours`, `orders.customer_info`, `order_items.item_snapshot`/`customizations`, `users.preferences`, `dish_search_index.tags`/`market_ids`). In Rust, these map to `serde_json::Value` or (preferably) typed structs serialized via `serde_json::to_string`/`from_str` at the repository boundary, matching the TS `.$type<...>()` annotations exactly (those annotations are the closest thing to a schema for these JSON blobs — copy their shapes verbatim into Rust structs).
- **Optional vs. null vs. missing**: Drizzle/TS conflates "column is nullable" with "field is optional" in places (e.g. `Order.tableId?: number` in `shared-types` vs. `tableId: integer(...).references(...)` — nullable, no `.notNull()` — in the DB schema) but the two are **not always the same thing** at the DB level. When porting to Rust, always check the actual DDL nullability (`.notNull()` present or absent in the Drizzle column def) rather than trusting a `shared-types` interface's `?` marker, since the two layers were shown above to already drift (§3.1's `OrderPaymentStatus`/`OrderItemStatus` case, and the general BaseEntity `id: number` vs actual TEXT ids for `Order`).
- **Partial unique indexes**: SQLite (and thus D1) supports `CREATE UNIQUE INDEX ... WHERE <cond>`; this is directly portable to Rust migration SQL as-is — no schema-level abstraction is needed, since this isn't a Drizzle-level feature (it was hand-written raw SQL in the migration, per §2.3) and there is nothing ORM-specific to reverse-engineer.
- **FTS5**: also directly portable as raw SQL (virtual table + triggers, §2.4) — no Rust-specific concern beyond issuing the same DDL and keeping the trigger-based sync logic (or replicating it in application code if triggers are dropped in favor of explicit writes).

### 7.2 Where a shared Rust crate would replace each TS package

| TS package | Rust equivalent |
|---|---|
| `@makanmakan/database` | A `makanmakan-db` crate: table structs + repository/service structs (Layer 1) + hand-written analytics queries (Layer 2) + migration runner. Keep the fresh/legacy dual-track discipline (§2.1) if migrations continue to be maintained by hand; otherwise consolidate to one track during the rewrite (a natural point to retire migration debt, but explicitly out of scope unless the team asks for it). |
| `@makanmakan/shared-types` | A `makanmakan-types` crate of `serde`-derived structs/enums, generated from (or kept in lockstep with) the Rust DB-layer structs — ideally the *same* crate as `@makanmakan/database`'s Rust port to avoid the drift documented in §3.1, rather than a second hand-maintained copy. |
| `@makanmakan/utils` | A `makanmakan-util` crate: `ApiError` type + `thiserror`/`axum`-style error response, currency formatting, cents/bps conversions, UUID v7 helpers (`uuid` crate), timestamp helpers, encryption (verify against Rust `aes-gcm`/`ring` equivalents of whatever `encryption.ts` actually does), QR signing (HMAC — verify exact algorithm in `qr-signing.ts` before porting). |
| `@makanmakan/auth-client` | **Not portable to backend Rust** — this is frontend-only. The backend Rust port only needs to keep serving the wire contract it depends on (`POST /auth/refresh`, `Authorization: Bearer`, CSRF header/cookie names) — no source logic to carry over. |
| `@makanmakan/queue-core` (domain types portion) | Fold into `makanmakan-types`/`makanmakan-db` if the waiting-queue feature is kept — but first confirm with the team whether this pre-UUID, `number`-typed domain model (§5.1) is still the intended contract, since it appears to predate the current `waiting_list` Drizzle table's UUID-based design. |
| `@makanmakan/queue-core` (print subsystem portion) | A separate `makanmakan-print` crate (ESC/POS command builder + driver abstraction) — this has real production usage (`apps/print-agent`) independent of the waiting-queue domain types, and should not be conflated with them during the split. |
| `@makanmakan/queue-service` | Do not port until usage is confirmed (§5.2) — currently orphaned. |
| `@makanmakan/ai-analytics` | A `makanmakan-analytics` crate: LLM provider trait (mirroring `BaseLLMProvider`) with per-provider structs, plus the analytics SQL queries folded into the main DB crate (Layer 2) or kept separate if the team wants analytics as an optional/feature-gated module. Resolve the `"completed"` vs. `ORDER_STATUS` mismatch (§6.2) and the hard-coded-zero placeholder fields (§6.2) as part of the port, not blindly copied forward. |
| `packages/shared` (Vue components/composables) | Not backend-relevant — frontend-only, and not even a real npm package today (§1). |

### 7.3 Summary of TS-specific behaviors needing explicit care in Rust

1. **Structural typing masks drift**: TS's structural typing let `shared-types`' `OrderPaymentStatus`/`OrderItemStatus` numeric enums silently diverge from the DB's actual string columns (§3.1) with no compiler error anywhere in the stack. Rust's nominal typing + exhaustive `match` on enums will catch this class of bug by construction — but only if the Rust enum variants are derived from the **DB schema**, not copied from `shared-types`.
2. **Optional (`?`) vs. nullable vs. required** are three distinct concepts conflated across layers (see §7.1) — always verify against the actual `sqliteTable` column definition (`.notNull()` present/absent), not the TS interface.
3. **Timestamp representation is not uniform**: ms-integer (DB `_ms` columns, most of `Order`), ISO string (`packages/database/src/utils/timestamp.ts`'s `getCurrentTimestamp()`, `shared-types/common.ts`'s generic `BaseEntity`), and Unix-seconds (`idempotency_keys.createdAt`/`expiresAt`, `SoftDeleteService`'s seconds-based `deletedAt` writes against ms-mode columns — a likely latent bug, §2.6) all coexist. Do not pick one global timestamp type for the whole Rust port; type each field to match its actual source.
4. **PK type is per-table, not global**: do not assume "new tables are UUID, old tables are integer" as a hard rule — it's a design guideline (per CLAUDE.md and confirmed by the mixed inventory in §2.5), and several genuinely-new-looking tables (e.g. `platform_integrations`, `qr_templates`, `dish_search_index`) are still INTEGER-autoincrement. Always check the actual `id:` column definition.
5. **JSON-typed columns have no DB-level schema** — SQLite stores them as plain `TEXT`; the only structure guarantee is the Drizzle `.$type<...>()` TS annotation (unenforced at runtime) or, in a couple of places, application-level validation before insert. Rust structs for these fields are only as reliable as the TS annotations they're copied from — spot-check against real row data if precision matters (e.g. before a migration/backfill).
6. **`packages/queue-service` and possibly parts of `packages/queue-core`'s domain-model half are dead/unwired code** (§1, §5) — do not spend Rust-port effort on them without confirming intent with the team first; porting unused code 1:1 risks carrying forward a design that was already abandoned in TS.
