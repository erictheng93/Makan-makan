# API Feature Modules — Platform / Ops Domain

Scope: `apps/api/src/features/{backup,monitoring,system,cache,analytics,ai-analytics,forecast,audit,integrations,partnerships}`.
`billing/` is intentionally excluded (covered elsewhere).

All full paths below assume the mount chain from `apps/api/src/app-factory.ts`:
`app.route("/api/v1", apiV1)` and then `apiV1.route("<prefix>", <feature>.routes)`. Feature-internal
route trees are read from each module's `routes/index.ts` and prefixed accordingly.

Global middleware relevant to this domain (all in `app-factory.ts`, order matters — Hono composes
matched entries in registration order and a route mounted **before** a later `.use()` for the same
path will not be wrapped by it):

- `apiV1.use("/backup/*", authMiddleware)` — registered before `apiV1.route("/backup", BackupRoutes)`.
- `apiV1.use("/analytics/*", authMiddleware)` / `/ai-analytics/*` / `/forecast/*` (+ `moduleGate("analytics")` on forecast) — all before their respective `.route()` mounts.
- `apiV1.use("/cache/*", authMiddleware)` — before `.route("/cache", ...)`.
- `apiV1.use("/monitoring/*", ...)` — conditional: exact path `/api/v1/monitoring/health` skips auth, every other `/monitoring/*` path (including sub-paths) goes through `authMiddleware`.
- `apiV1.use("/system/*", ...)` — conditional: exact path `/api/v1/system/health` skips auth, every other `/system/*` path requires `authMiddleware`. **This includes `/system/health/live`, `/health/ready`, `/health/uptime`, `/health/detailed`, `/health/metrics`** — see System module ambiguity note below.
- `apiV1.use("/partnerships/*", authMiddleware)` is registered in the protected-routes block, but `apiV1.route("/partnerships", partnershipsRoutes)` is mounted earlier in the **public** block. Given Hono's registration-order dispatch, the partnerships sub-router's own per-route `authMiddleware`/`requireRole`/`moduleGate` calls (present on every route except `POST /members/verify` and `POST /plans/validate`) are what actually gate access; the later global `.use()` is effectively redundant. A Rust rewrite should gate at the route level, not rely on mount order.
- `apiV1.route("/integrations", integrationsFeature.routes)` is mounted in the public block with **no** matching global `authMiddleware` — auth is entirely self-contained inside the feature (webhooks are HMAC-verified and public; `/routes/admin.ts` applies `authMiddleware` + `requireRole([0,1])` + `moduleGate("platform_integration")` itself).
- `apiV1.route("/audit", auditRoutes)` has no global middleware either; the single route (`POST /actions`) applies `authMiddleware` inline.
- Unified error envelope (`app.onError`): `{ success:false, error:{ code, message, details? } }`. Note several handlers in this domain **return their own ad hoc error shape** instead of throwing `ApiError` (see per-module notes) — these bypass the global sanitizer.

---

## 1. Backup (`apps/api/src/features/backup/`)

### Purpose

Per-restaurant database backup/restore system: snapshots configured tables into JSON, stores the
payload in R2 (or KV for small payloads), tracks backup/restore/audit rows in D1, exposes a
system-health/metrics view for admins, and manages restaurant-scoped alerts (e.g. failed backups).
It also accepts pre-serialized "offline" backup blobs produced by the admin dashboard's background
sync (`POST /upload`), storing them straight to R2 without going through the backup/restore pipeline.

### Routes

Mount: `apiV1.route("/backup", BackupRoutes)`, all under global `authMiddleware` (`apps/api/src/features/backup/routes/index.ts`).

| Method | Full path | Auth | Purpose | Request summary | Response summary |
|---|---|---|---|---|---|
| POST | `/api/v1/backup/create` | bearer + restaurant-access check | Create (and optionally immediately run) a backup | `{restaurant_id(uuid), configuration_id?, name, description?, backup_type, include_tables?, exclude_tables?, force_immediate}` | `{success,data:{backup_id, status, manifest, checksum?, message}}` (201) |
| POST | `/api/v1/backup/upload` | bearer; restaurant-scope self-check via `canWriteRestaurantScope` | Persist an offline-sync backup blob to R2 + KV pointer | passthrough body incl. optional `backup_id`, `restaurant_id` | `{success,data:{backup_id, uploaded, restaurant_id, storage_key, uploaded_at}}` |
| GET | `/api/v1/backup/list` | bearer + restaurant-access | List backups, filter/paginate/sort | query: `restaurant_id(uuid)`, `status?`, `backup_type?`, `date_from?`, `date_to?`, `page`, `limit`, `sort_by`, `sort_order` | `{success,data:{backups:BackupRecord[], total}}` |
| GET | `/api/v1/backup/:id` | bearer + restaurant-access | Get one backup record | — | `{success,data:BackupRecord}` |
| GET | `/api/v1/backup/:id/download` | bearer + restaurant-access; 400 if not `completed` | Download raw backup JSON | — | raw `Response` with `Content-Disposition: attachment` (not the JSON envelope) |
| POST | `/api/v1/backup/:id/restore` | bearer + restaurant-access | Restore from backup (full or selective) | `{restaurant_id, backup_id, restore_type, target_tables?, overwrite_existing, safety_confirmation:{backup_integrity_verified,data_loss_risk_acknowledged,confirmation_phrase="I understand the risks"}}` | `{success,data:{restore_id, checksum?, rowCounts?, message}}` (201) |
| DELETE | `/api/v1/backup/:id` | bearer + restaurant-access | Delete a backup (DB row + storage object) | — | `{success,message}` |
| GET | `/api/v1/backup/configurations/:restaurant_id` | bearer + restaurant-access | List backup configurations | — | `{success,data:BackupConfiguration[]}` |
| POST | `/api/v1/backup/configurations` | bearer + restaurant-access | Create/update (upsert by presence of `id`) a configuration | `{restaurant_id, name, backup_type, schedule_enabled, schedule_cron?, retention_days, include_tables?, exclude_tables?, compression_enabled, encryption_enabled, max_parallel_backups, notifications_enabled, notification_channels}` | `{success,data:BackupConfiguration}` (201) |
| GET | `/api/v1/backup/system/health` | bearer; **role 0 enforced inline in controller** (not `requireRole` middleware) | Aggregate backup system health across all restaurants | — | `{success,data:BackupSystemHealth}` |
| GET | `/api/v1/backup/restaurants/:restaurant_id/metrics` | bearer + restaurant-access | Per-restaurant backup metrics (hour/day/week/month) | query: `period?` | `{success,data:{total_backups,successful_backups,failed_backups,avg_backup_size,total_storage_used}}` |
| GET | `/api/v1/backup/alerts/:restaurant_id` | bearer + restaurant-access | List alerts | query: `unresolved_only?` | `{success,data:BackupAlert[]}` |
| PATCH | `/api/v1/backup/alerts/:id/acknowledge` | bearer + restaurant-access (looked up via alert's restaurant_id) | Acknowledge alert | — | `{success,data:BackupAlert,message}` |
| PATCH | `/api/v1/backup/alerts/:id/resolve` | bearer + restaurant-access | Resolve alert | — | `{success,data:BackupAlert,message}` |

Note: `BackupController` catches errors itself and returns `{success:false, error:<string>}` (flat string, not the `{code,message}` object shape) — this deviates from the unified error envelope used elsewhere.

### Business logic

- **Create → execute pipeline** (`BackupService.createBackup` → `executeBackup`, `apps/api/src/features/backup/services/BackupService.ts:93-407`):
  1. Validate request + enforce limits: max 3 concurrent (`pending`/`in_progress`) backups per restaurant, max 10 attempts/hour, 10 GB storage quota per restaurant (`BackupValidationService`).
  2. Resolve a `BackupConfiguration` (explicit `configuration_id` or the restaurant's "Default Configuration", auto-created on first use with tables `orders, order_items, menu_items, categories, tables`).
  3. Resolve table list (`include_tables` minus `exclude_tables`, default set: `orders, order_items, menu_items, categories, tables, users`), validate names against an allow-list (`orders, menus, order_items, menu_items, categories, tables, users, restaurants, audit_logs, sessions, qr_codes, images`).
  4. Insert a `pending` `backupRecords` row with a manifest (`{rowCounts, tables, createdAt}`) computed via `SELECT COUNT(*)` per table.
  5. If `force_immediate`, synchronously run `executeBackup`: for each table, resolve the physical table name (`menus` → `menu_items`), determine the restaurant-scope WHERE clause dynamically via `PRAGMA table_info` (uses `restaurant_id` column if present, else falls back to `id`/`public_id` for the `restaurants` table itself), then `SELECT * FROM "<table>" WHERE <scope>` via **raw prepared statements against the D1 binding directly** (not Drizzle) — this is the one place in the module doing dynamic, non-Drizzle SQL, gated by `assertSafeIdentifier` (`^[A-Za-z_][A-Za-z0-9_]*$`) to block injection through table/column names.
  6. Serialize the extracted rows to JSON, optionally gzip via `CompressionStream` purely to compute `compression_ratio`/`compressedSize` metrics (the stored payload is **not** actually compressed — `storageService.storeBackup` receives the raw JSON string).
  7. Store to R2 (path `backups/<restaurantId>/<yyyy-mm-dd>/<backupId>.json`) or KV (key `backup:<backupId>`), with a SHA-256 checksum of the plaintext.
  8. Update the `backupRecords` row to `completed` with `fileSize`, `checksum`, `storagePath`, and a `metadata` JSON blob (`manifest`, `tables_info`, `performance_metrics`, `database_snapshot`).
  9. Write a `backupAuditLogs` row (`backup_created`).
- **Restore** (`restoreFromBackup` → `executeRestore`): verifies backup is `completed` and exists in storage; if `overwrite_existing`, first runs a full **pre-restore safety backup** (recursive call into `createBackup`+`executeBackup` for the target tables) before proceeding. Retrieves stored JSON, verifies SHA-256 checksum against the stored `checksum`. For `selective` + non-overwrite restores it only validates schema compatibility (column diff against `PRAGMA table_info`) and returns synchronously with row counts (no data mutation — a "dry" verification path). For full/overwrite restores it actually `DELETE FROM "<table>" WHERE restaurant_id = ?` then re-`INSERT`s every row via **raw D1 prepared statements**, one `INSERT` per row (no batching), with a `restoreOperations` row tracking progress; runs in the background (`.catch` swallow) unless it's the synchronous selective-verify path.
- **Encryption/compression toolkit exists but is not wired into the create/restore path**: `BackupStorageService` has full AES-256-GCM (PBKDF2, salt `"makanmakan-backup-salt-v1"`, 100k iterations) `encryptData`/`decryptData` and gzip `compressData`/`decompressData` methods (`processDataForStorage`/`processDataFromStorage`), but `BackupService.executeBackup` never calls them — `encryption_enabled`/`compression_enabled` flags are persisted as metadata only. **This is a real gap between the config schema (which advertises encryption) and actual storage behavior** — worth flagging before porting.
- **Scheduler** (`BackupSchedulerService`) — ⚠️ **dead code, zero production callers**: `grep -rl BackupSchedulerService apps/api/src` finds only its own file, its test, and a never-instantiated re-export in `features/backup/index.ts`. The separate `apps/backup-scheduler` Worker's cron does **NOT** invoke it — that worker's `main` is `apps/api/src/workers/backup-scheduler.ts`, which instantiates a third, legacy `BackupService` (`apps/api/src/services/BackupService.ts:80-86`) and uses its own cruder due-check `shouldRunBackup` (`workers/backup-scheduler.ts:560-589`, recognizes only the literal `"0 2 * * *"` shape via `hour==="2"&&minute==="0"` plus a 23h-since-last-run gate). See backup-scheduler.md and api-core.md for the live path. What follows describes the dead `BackupSchedulerService` for completeness — do not port it as "the scheduler": loads configurations joined to a `backup_schedules` table (`schedule_enabled=1 AND enabled=1`), evaluates a hand-rolled 5-field cron matcher (`*`, ranges, steps, lists) plus a 30-minute minimum re-run interval, and skips a schedule after 5 consecutive failures. `calculateNextRun` only understands two literal cron strings (`"0 2 * * *"`, `"0 * * * *"`) — anything else returns `null` and the schedule stops being able to compute a next run (still executes based on the matcher, just without a persisted "next run" hint).
- **Alerts**: simple KV-independent D1 rows (`backupAlerts`), acknowledge/resolve mutate `acknowledged`/`resolved` flags + write an audit log; alert-triggering logic itself is not present in this file set (no code path inserts new alerts — likely produced by the scheduler or an external job not in scope).

### Data

- **D1 tables** (`packages/database/src/schema/backup.ts`): `backupRecords`, `backupSchedules`, `backupConfigurations`, `backupAlerts`, `backupAuditLogs`, `restoreOperations`. All money/JSON detail lives in `metadata`/`data` JSON columns; `metadata.performance_metrics`, `metadata.database_snapshot`.
- **R2**: bucket bound as `BACKUP_STORAGE`; key layout `backups/<restaurantId>/<date>/<backupId>.json`; offline uploads under `offline-uploads/<restaurantId>/<backupId>.json`.
- **KV**: `BACKUP_KV` — alternate small-payload storage (`backup:<id>`) and offline-upload pointer records (`backup:offline-upload:<id>`, 90-day TTL).
- **External calls**: none directly (no Slack in this module; scheduler emits Analytics Engine data points `scheduled_backup_created`/`scheduled_backup_failed` when an `AnalyticsEngineDataset` binding is supplied).

### Cross-module dependencies

- Consumes `@makanmasak/shared-types` backup DTOs and `@makanmasak/database` schema tables directly.
- Restaurant-access check (`BackupValidationService.verifyRestaurantAccess`) does a **raw `sql` query** against `restaurant_users` (not a Drizzle query-builder call) — the one Layer-3-style query in this module, kept because it's a simple existence check.
- No dependency on the Monitoring/System modules despite overlapping "health" naming — this is an independent health surface (`GET /backup/system/health`) scoped to backup subsystem only.

### Rust rewrite notes

- The raw-SQL table introspection (`PRAGMA table_info`) + dynamic `SELECT/INSERT/DELETE` string building is the trickiest part to port safely — a Rust implementation needs an equivalent "is this identifier a known-safe column/table name" allow-list check, or better, a static per-table backup/restore mapping generated from the schema instead of introspecting at runtime.
- Backup/restore currently loads **entire table result sets into memory** as JS objects before serializing (`extractTableData`, one `SELECT *` per table) — for large restaurants this is an unbounded-memory operation; a Rust port should stream rows to the R2 multipart upload instead of buffering the whole JSON string.
- Restore re-insertion is row-by-row with no transaction/batching — for D1/SQLite this is already slow; Rust port should batch inserts (D1 batch API) and wrap in an explicit transaction per table.
- Decide during the port whether to actually wire up the existing AES-GCM encrypt/compress code path (currently dead) or drop the `encryption_enabled`/`compression_enabled` config fields entirely — do not silently port "enabled" flags that don't do anything.
- Timestamps: `startedAt`/`completedAt`/`createdAt` etc. are `Date` objects via Drizzle `timestamp_ms` mode; the manifest/metadata JSON blobs store ISO strings picked ad hoc (`toIsoString`/`toOptionalIsoString` helpers convert both `Date` and legacy numeric/string inputs) — a Rust port should pick one canonical representation (Unix ms, per repo convention) end-to-end rather than keeping the dual ISO/ms shuffle.
- `backup_schedules` cron matching is hand-rolled and only computes "next run" for two hard-coded expressions — either bring in a real cron crate or keep the "match now, don't project next run" semantics explicit rather than silently porting the fake `calculateNextRun`.

---

## 2. Monitoring (`apps/api/src/features/monitoring/`)

### Purpose

In-memory-plus-KV metrics/alerting service for API/DB/cache health, with a public health probe, an
admin/owner metrics+overview dashboard, and a simple alert-rule CRUD that can fire Slack or generic
webhook notifications. State (`SystemMetrics`, alert rules, recent alerts) is **held in a
module-level singleton object inside the Worker isolate** and persisted to KV as a write-behind
cache — it is not a source of truth across isolates.

### Routes

Mount: `apiV1.route("/monitoring", monitoringFeature.routes)`. Global gate: all `/monitoring/*` requires bearer auth except the exact path `/api/v1/monitoring/health`.

| Method | Full path | Auth | Purpose | Request summary | Response summary |
|---|---|---|---|---|---|
| GET | `/api/v1/monitoring/health` | **public** (explicit skip in app-factory) | Aggregated health view; this is also where `GET /health` redirects | — | **Not the unified envelope** — returns `HealthStatus` directly: `{overall, components:{api,database,cache,external}, uptime, version, timestamp}`, HTTP 503 if `overall` is `critical`/`down`, else 200 |
| GET | `/api/v1/monitoring/metrics` | bearer, role `[0,1]` | Full metrics snapshot + derived summary | query: `period, granularity` (validated but only echoed, not used to slice data — metrics object has no history) | `{success,data:{...SystemMetrics, query, summary}}` |
| DELETE | `/api/v1/monitoring/metrics` | bearer, role `[0]` | Reset in-memory + KV metrics | — | `{success,message,timestamp}` |
| POST | `/api/v1/monitoring/errors` | bearer, role `[0]` | Manually record an error event | `{type,message,severity,metadata?}` | `{success,data:{...,timestamp}}` (201) |
| GET | `/api/v1/monitoring/alerts/rules` | bearer, role `[0,1]` | Paginated alert rule list | query: `page,limit` | `{success,data:{rules,pagination}}` |
| POST | `/api/v1/monitoring/alerts/rules` | bearer, role `[0,1]` | Create alert rule | `{name,condition,metric,operator,threshold,duration,config:{type,severity,enabled,interval?,recipients?,webhookUrl?,template?}}` | `{success,data:{id,...,created}}` (201) |
| PUT | `/api/v1/monitoring/alerts/rules/:id` | bearer, role `[0,1]` | Update alert rule | partial rule fields | `{success,data:{id,updated}}` or 404 `{success:false,error:string}` |
| DELETE | `/api/v1/monitoring/alerts/rules/:id` | bearer, role `[0,1]` | Delete alert rule | — | `{success,message}` or 404 |
| GET | `/api/v1/monitoring/alerts/recent` | bearer, role `[0,1]` | Poll recent alerts (max 50, 24h retention) | query: `since?` (ms epoch) | `{success,data:{alerts,timestamp}}` |
| GET | `/api/v1/monitoring/alerts/defaults` | bearer, role `[0,1]` | List built-in default alert-rule templates | — | `{success,data:{rules,count,description}}` |
| POST | `/api/v1/monitoring/alerts/test` | bearer, role `[0,1]` | Fire a manufactured test alert through the real alert pipeline | `{type,severity,webhookUrl?}` | `{success,data:{message,type,severity,timestamp}}` |
| GET | `/api/v1/monitoring/overview` | bearer, role `[0,1]` | Combined health+metrics dashboard payload | — | `{success,data:MonitoringOverview}` |
| GET | `/api/v1/monitoring/reports/performance` | bearer, role `[0,1]` | Static-recommendation performance report | query: `days` | `{success,data:PerformanceReport}` (includes rule-based text `recommendations`) |

### Business logic

- **Metrics accumulation** (`MonitoringService`, `apps/api/src/features/monitoring/services/MonitoringService.ts`): every call to `recordApiRequest`/`recordUptimeCheck`/`recordDatabaseQuery`/`recordCacheMetrics`/`recordError` mutates the in-process `SystemMetrics` object (keeps up to 1000 recent response times in an in-memory array for average/p95/p99), then persists the whole object to KV (`_system_metrics`, 24h TTL) on every write — i.e. **every metrics update is a full KV `put`**, not an increment.
- **Alert engine**: on every `recordError` call, `checkAlertRules()` iterates all in-memory (then KV-refreshed) `AlertRule`s, skips ones in cooldown (`config.interval` minutes since `lastTriggered`), evaluates a simple `metric` dot-path lookup against `threshold`/`operator`, and calls `sendAlert()` which (a) always appends to a capped 50-entry/24h `_recent_alerts` KV list for polling clients, and (b) fires an actual Slack (`chat.postMessage`-style webhook payload with severity-colored attachment) or generic webhook POST if `config.type`/`webhookUrl` are set. Any `critical`/`fatal` `recordError` call **also independently sends a Slack alert directly**, bypassing rule matching (hard-coded `sendAlert({type:"slack",severity,enabled:true}, ...)`).
- **Health classification**: component-level thresholds are fixed constants (`PERFORMANCE_THRESHOLDS`) — response-time warning/critical at 500/1000 ms, DB query 100/500 ms, error rate 5%/10%, cache hit-rate 60%/30% floors. `overall` health is the worst of the four component statuses (`down > critical > warning > healthy`). Comment in code explicitly notes API "critical" is now reserved for genuinely high error rates (not latency) to avoid dev-mode cold-start false alarms mapping to a 503.
- **Uptime**: `getStartTime()` returns the isolate's own boot time (`this.startTime` set in the constructor) — this is explicitly *not* a persistent server uptime; it resets whenever the isolate is recycled. Comment in code flags this directly.
- **Singleton caveat**: `createMonitoringService(kv)` is a process-level singleton (`monitoringServiceInstance`) — combined with KV being the only cross-isolate persistence, metrics/alert-rule state is fundamentally eventually-consistent across concurrent Worker instances.

### Data

- **KV** (bound as `CACHE_KV`): keys `_system_metrics`, `_system_health` (5 min TTL, written but never read back by this module — `getHealthStatus()` always recomputes), `_alert_rules`, `_recent_alerts`, `_uptime_probe:<sanitizedName>` (30-day TTL, written by `recordUptimeCheck` but no route in this module reads it back — likely consumed by an external prober or the System module's uptime evidence key, which is a *different* KV key).
- **No D1 tables** are touched by this module at all — it is entirely KV-backed.
- **External calls**: Slack incoming webhook (`env.SLACK_WEBHOOK_URL` as default target for `/alerts/test` if no explicit `webhookUrl` given) and arbitrary user-configured webhook URLs (SSRF surface — no allow-list on `webhookUrl`).

### Cross-module dependencies

- Shares the "health" concept with System and Backup modules but each keeps **independent** state/thresholds — there is no shared health aggregator. A future Rust rewrite should decide whether to unify these three health surfaces or keep them deliberately separate (current behavior: keep separate, they answer different questions — platform-wide API/DB/cache health here, kube-probe liveness/readiness in System, backup-subsystem health in Backup).
- `advancedAnalyticsMiddleware`/`metricsMiddleware` (global Hono middleware, not in this feature dir) are presumably what feeds `recordApiRequest` in production, though the call site wasn't in this module's own files (out of scope to trace further here).

### Rust rewrite notes

- The "full KV put on every metric write" pattern will not scale as a 1:1 port — a Rust rewrite should batch/debounce writes (e.g. periodic flush) or move to Durable Objects / Analytics Engine for counters, matching the pattern already used elsewhere in the repo (Analytics Engine for backup scheduler events).
- Alert rule storage as a single JSON blob in one KV key means concurrent rule edits can race (read-modify-write with no CAS) — `updateAlertRule`/`deleteAlertRule`/`createAlertRule` all do get-full-list → mutate → put-full-list. Port with an actual per-rule KV key or a D1 table plus optimistic concurrency.
- `webhookUrl` for both alert rules and the `/alerts/test` endpoint is user-supplied with no destination allow-list — flag as a pre-existing SSRF-shaped design; decide whether to harden this in the port.
- Uptime numbers are isolate-lifetime only; if genuine uptime tracking is wanted in the Rust service, this needs a different mechanism (external prober + KV/D1 evidence, which is what the *System* module's `/health/uptime` already half-does).

---

## 3. System (`apps/api/src/features/system/`)

### Purpose

Catch-all for basic/Kubernetes-style health probes, client-side error/performance telemetry ingestion, and system error statistics/cleanup. Distinct from Monitoring: System owns the actual DB/KV
liveness checks and the k8s-style `/health/live` `/health/ready` probes that infra points at; it
also stores raw client telemetry blobs to KV for later inspection.

### Routes

Mount: `apiV1.route("/system", systemFeature.routes)`. Global gate: all `/system/*` requires bearer auth **except the exact path `/api/v1/system/health`**.

| Method | Full path | Auth (actual, per global gate) | Purpose | Request summary | Response summary |
|---|---|---|---|---|---|
| POST | `/api/v1/system/error-report` | bearer | Strict-schema error report ingestion | `{errors: ErrorReportItem[]}` (canonical shape) | `ErrorReportResponse` `{success,message,data:{total_errors,significant_errors,report_id}}` |
| POST | `/api/v1/system/errors` | bearer | Loose client-tracker error ingestion; normalizes arbitrary shapes into the strict one | single error object or `{errors:[...]}`, tolerant field names (`category`/`type`, `name` fallback, numeric or ISO timestamp) | same `ErrorReportResponse` shape |
| POST | `/api/v1/system/performance` | bearer | Store raw client performance telemetry (no processing) | arbitrary JSON body | `{success,data:{reportId,stored,restaurantId,receivedAt}}` |
| GET | `/api/v1/system/health` | **public** (only exact-path exemption) | Basic DB+KV liveness check (also target of `GET /health` redirect) | — | **Not the unified envelope**: `{success, status, timestamp, uptime, version, environment, services:[dbCheck,kvCheck], checks:{database,cache}}`, HTTP 200/503 |
| GET | `/api/v1/system/health/uptime` | bearer (see ambiguity below) | Public-monitor-config + evidence writer | — | `{success,status:"operational"/"degraded"/"down",version,environment,checked_at,response_time_ms,evidence:{kv_key,stored,error?,retention_seconds},targets:[...],services,checks}` |
| GET | `/api/v1/system/error-stats` | bearer, role `[0,1]` (owners scoped to their own restaurant) | Error statistics (24h totals, type breakdown, weekly trend, top common errors) | query: `restaurantId?` (ignored for role 1, forced to own) | `{success,data:ErrorStats}` |
| DELETE | `/api/v1/system/error-reports/cleanup` | bearer, role `[0]` | Purge error reports older than N days | query: `daysOld` | `CleanupResponse` `{success,message,data:{deleted_count}}` |
| GET | `/api/v1/system/health/detailed` | bearer, role `[0]` | Deep health: DB perf, recent error-like audit logs, business load stats, 3 live endpoint pings, computed 0-100 health score | — | `{success,overview,performance,system_load,recent_errors,health_score,recommendations,timestamp,total_check_time}` |
| GET | `/api/v1/system/health/metrics` | bearer, role `[0]` | Business metrics (orders volume) as JSON or Prometheus text | query: `format` (`json`\|`prometheus`) | JSON: `{success,timestamp,business_metrics,alert_thresholds}`; Prometheus: `text/plain` exposition format |
| GET | `/api/v1/system/health/ready` | bearer | Kubernetes readiness probe (DB `SELECT 1 FROM users LIMIT 1` + `probeCache` sentinel read — read-only, no KV write) | — | `{success,status:"ready",timestamp}` 200; `{success,status:"not_ready",checks:{database,cache},error?,timestamp}` 503 |
| GET | `/api/v1/system/health/live` | bearer | Kubernetes liveness probe | — | `{success,status:"alive",timestamp,uptime}` (uptime from `process.uptime()`, which is `0` on Workers — no Node `process` global) |

**Ambiguity flagged**: the route-level doc-comment for `/health/uptime` calls it a "Public uptime monitor configuration and evidence hook", and `/health/ready`/`/health/live` are documented in `CLAUDE.md` as "require bearer token" — but the app-factory conditional only exempts the *exact* string `/api/v1/system/health`. That means `/health/uptime`, `/health/ready`, `/health/live`, `/health/detailed`, and `/health/metrics` **all currently require a bearer token** despite `/health/uptime`'s own comment suggesting it's meant for external monitors to poll unauthenticated. This is either a latent bug (external uptime monitors can't actually hit `/health/uptime` without a token) or the comment is stale — flag for the Rust port rather than silently replicating one behavior over the other.

### Business logic

- **Error report normalization** (`normalizeClientError`, `routes/index.ts:96-125`): maps loose client payload fields (`category`→`type` with `authentication`→`permission` remap, `name` as message fallback, numeric/ISO timestamp coercion) into the strict `ErrorReportItem` shape before delegating to the same `SystemService.createErrorReport` used by the strict endpoint.
- **`SystemService.createErrorReport`** (`services/SystemService.ts:48-136`): bulk-inserts via `ErrorReportingService.createBulkErrorReports` (in `@makanmasak/database`, not read in this pass), filters `high`/`critical` severities as "significant", and if any exist, sends a Slack notification (`sendCriticalErrorNotification`) with a fixed Traditional-Chinese formatted attachment (`使用者/餐廳/錯誤數量/時間/錯誤詳情`). Notification failures are swallowed (logged only) so they never fail the main report-creation response. `emitEvent` is a stub — logs only, no real event bus.
- **`getSystemHealth`** (cached 1x in `CACHE_KV` under `system:health` for `CACHE_TTL.SHORT`): runs a Drizzle Layer-2 `SELECT 1` against D1 and a KV read as parallel `Promise.allSettled` checks; `degraded` if either fails, no distinct "unhealthy" branch reachable in the happy path (only the outer `catch` produces `unhealthy`).
- **`runBasicHealthCheck`** (route-local, used by `/health`, `/health/uptime`, `/health/detailed`): does a *live* `SELECT 1` via `createDatabase` + a KV round-trip `put`/`get`/`delete` on a throwaway key, with real per-check latency and error capture (more thorough than `SystemService.getSystemHealth`, and **not the same code path** — the module has two independent implementations of "check DB+KV" living in the route file vs. the service).
- **Uptime evidence**: every call to `/health`, `/health/uptime`, and `/health/detailed` writes the latest check result to a single KV key `system:uptime:last-check` (7-day TTL) via `storeUptimeEvidence` — this is a rolling single-slot "last known health" pointer, not a time series.
- **`/health/detailed`**: computes a 0-100 `health_score` by static deductions (−20 degraded/−50 unhealthy base status, −10 if DB perf >1s, −10 per unhealthy synthetic endpoint probe out of 3 hard-coded targets: `restaurants?limit=1`, `menu/1`, `orders?limit=1`) — the endpoint probes are **live outbound `fetch()` calls back into the same Worker** using the caller's own `Authorization` header, which is unusual (self-referential HTTP call rather than an in-process function call) and adds real network latency + a second layer of rate-limiting exposure per health check.
- **`/health/metrics`**: computes 7-day/24h/1h order counts via Drizzle Layer 2 `sql` templates directly on the `orders` table; supports Prometheus text output for scraping.

### Data

- **D1 tables**: `orders`, `users`, `restaurants`, `auditLogs` (read-only, via `@makanmasak/database` re-exports — `count`, `gte`, `sql`, `avgMoneyAmount`); error reports themselves live in whatever table `ErrorReportingService` (in `packages/database`) manages (not opened in this pass — out of the read set for this document, but referenced by name).
- **KV** (`CACHE_KV`): `system:health` (short TTL cache of `SystemService.getSystemHealth`), `system:uptime:last-check` (7d TTL, rolling evidence), `system:performance:<scope>:<userId>:<reportId|latest>` (30d TTL, raw client telemetry dumps, two keys written per report: dated + "latest" pointer), health-check scratch keys (`health-check-<ts>`, `ready-test`).
- **External calls**: Slack webhook (`env.SLACK_WEBHOOK_URL`) for critical error notifications; the `/health/detailed` endpoint calls back into its own API over HTTP for 3 synthetic probes.

### Cross-module dependencies

- Shares `SLACK_WEBHOOK_URL` usage pattern with Monitoring (independent implementations, not shared code).
- `/health/detailed`'s self-fetch touches `restaurants`, `menu`, `orders` features indirectly (as black-box HTTP, not direct imports).
- No dependency on the Monitoring module's `MonitoringService` — genuinely separate metrics/health stacks.

### Rust rewrite notes

- Decide the intended auth posture for `/health/uptime`/`/health/live`/`/health/ready` before porting — CLAUDE.md says probes "require bearer token" (matches current code), but `/health/uptime`'s self-description implies it should be public for external monitors. Resolve before writing the Rust route table rather than guessing.
- Two independent "check DB+KV" implementations (`SystemService.getSystemHealth` vs. route-local `runBasicHealthCheck`) should be consolidated into one in the Rust port — there is no functional reason for both to exist.
- The self-referential `fetch()` health probes in `/health/detailed` are expensive and somewhat fragile (depends on request `Authorization` header still being valid, and on the Worker being able to reach its own public URL) — consider replacing with direct in-process handler calls in the Rust service.
- `process.uptime()` on `/health/live` is meaningless on Workers (always 0) — don't port this as if it were real; either drop the field or compute isolate age like `MonitoringService.startTime` does.
- Telemetry KV keys have no cleanup path in this module (`system:performance:*` accumulates for 30 days per report with no bulk-delete route) — decide whether the Rust port needs a retention job.

---

## 4. Cache (`apps/api/src/features/cache/`)

### Purpose

Admin-only introspection/management surface over a hand-rolled KV-backed cache layer (`CacheService`)
used elsewhere in the API for menu/restaurant/analytics/session/table/QR data. Exposes stats, health
scoring, tag-based invalidation, expiry cleanup, cache warmup, and a self-test endpoint. A separate
`KVUsageService` (per-restaurant KV quota tracking) exists in the same feature directory but **is not
wired into any route or the `CacheService`/`CacheKeys` exports** — dead code as of this reading.

### Routes

Mount: `apiV1.route("/cache", cacheFeature)` (feature exports the router directly as default, not `{routes}`). Global gate: `apiV1.use("/cache/*", authMiddleware)`; every route additionally applies `requireRole([0])` inline (admin-only, doubly enforced).

| Method | Full path | Auth | Purpose | Request summary | Response summary |
|---|---|---|---|---|---|
| GET | `/api/v1/cache/stats` | bearer, role `[0]` | Cache stats + top 10 keys expiring within 30 min | — | `{success,data:{...CacheStats,expiringIn30Min,expiringKeys,hitRatePercentage,totalSizeMB,strategies,timestamp}}` |
| GET | `/api/v1/cache/health` | bearer, role `[0]` | Heuristic health scoring from hit-rate/expiring-keys/size | — | `{success,data:{status,issues,recommendations,metrics}}` |
| POST | `/api/v1/cache/invalidate` | bearer, role `[0]` | Invalidate all keys matching given tags | `{tags:string[], reason?}` | `{success,data:{invalidatedCount,tags,reason,timestamp}}` |
| POST | `/api/v1/cache/cleanup` | bearer, role `[0]` | Remove expired keys (or dry-run preview) | `{maxAge, dryRun}` | dry-run: `{success,data:{dryRun:true,wouldCleanCount,previewKeys,maxAge,timestamp}}`; real: `{success,data:{cleanedCount,maxAge,timestamp}}` |
| POST | `/api/v1/cache/warmup` | bearer, role `[0]` | Pre-populate keys with placeholder values (not real data) | `{keys:[{key,strategy}]}` | `{success,data:{requestedCount,successCount,failedCount,timestamp}}` |
| DELETE | `/api/v1/cache/stats` | bearer, role `[0]` | Reset cache stats counters | — | `{success,data:{message,timestamp}}` |
| GET | `/api/v1/cache/config` | bearer, role `[0]` | List configured cache strategies (TTL/tags/priority) | — | `{success,data:{strategies,totalStrategies,timestamp}}` |
| POST | `/api/v1/cache/test` | bearer, role `[0]` | Round-trip set/get/delete self-test | — | `{success,data:{setSuccess,getSuccess,dataIntegrity,deleteSuccess,testKey,timestamp}}` |

### Business logic

- **`CacheService`** (`services/CacheService.ts`) is a hand-rolled KV cache with: TTL + tag metadata stored in a **parallel `_meta:<key>` KV entry** per cached item, stale-while-revalidate grace windows looked up by matching a cached item's tags against `CACHE_STRATEGIES` (menu/restaurant/analytics/session/table/qrcode presets with distinct TTL/priority/SWR values), and **sampled hit-count writes** (only flush accumulated in-memory hit counts to KV metadata every 10th hit, `HIT_COUNT_SAMPLE_RATE`) to cut KV write volume — with an explicit `flushHitCounters()` meant to be called before a Worker instance recycles (not obviously wired to any lifecycle hook in the files read).
- **Tag-based invalidation and expiring-key discovery** both require a full `kv.list()` enumeration of all keys, then a **batched-parallel (`Promise.all`, 50-key chunks) metadata read per key** to filter by tag/expiry — this is an O(n) full-namespace scan on every invalidate-by-tag or health/stats call, not indexed lookups.
- **Warmup** does not fetch real data — it writes a placeholder `{prewarmed:true, timestamp}` payload per requested key, with the caller expected to already know the target key/strategy; there's no actual "recompute and cache this specific menu" logic here.
- **Health scoring** (`routes/index.ts`): thresholds are hard-coded (`<30%` hit-rate → critical, `<60%` → warning, `>100` expiring-in-5-min keys → warning, `>500MB` total size → warning) with no persistence of the score itself, recomputed on each call from live `getStats()`/`getExpiringKeys()`.
- **`CacheService` is a process-level singleton** (`createCacheService`), same caveat as Monitoring — state only durable via KV, not the in-memory object.

### Data

- **KV** (`CACHE_KV`): the cached values themselves (arbitrary keys via `CacheKeys.*` generators — `menu:<id>`, `restaurant:<id>`, `table:<rid>:<tid>`, `analytics:<rid>:<period>`, `session:<uid>`, `qrcode:<id>`, `menu_category:<rid>:<cid>`, `user_prefs:<uid>`, `order_stats:<rid>:<date>`), each with a paired `_meta:<key>` metadata entry, plus a single `_cache_stats` aggregate-stats key (5 min TTL).
- No D1 tables. No external calls.
- `KVUsageService` (dead code, `services/KVUsageService.ts`): if it were wired in, it would track per-restaurant key-count/byte-size/read-write-delete counters under `_kv_usage:<restaurantId>:<namespace>` with configurable quota thresholds (10,000 keys / 50 MB per restaurant, 80%/95% warn/critical) — worth deciding whether to port this at all given it's currently unreachable, or finish wiring it as part of the rewrite.

### Cross-module dependencies

- `CACHE_STRATEGIES`/`CacheKeys` are presumably consumed by other feature modules when they cache menu/restaurant/analytics data (not verified in this pass — out of scope), so the Rust port needs to preserve the **key naming scheme** even if the storage engine changes, or every other module that reads these keys breaks.
- Overlaps conceptually with Monitoring's `cacheMetrics` (hit rate, total keys/size) — the two are never wired together; Monitoring's cache numbers come from whatever calls `recordCacheMetrics()` (not in this module), not from `CacheService.getStats()`.

### Rust rewrite notes

- The `kv.list()` + N-key metadata fan-out pattern for tag invalidation and expiry scans does not scale past a few thousand keys and will be markedly slower/costlier against a real KV-equivalent store in Rust — consider a secondary index (e.g. a D1 table of `key → tags/expiresAt`) instead of scanning.
- Metadata-per-key doubles KV operation count for every cache read/write; if porting 1:1, budget for it, or consider embedding a small metadata envelope in the same KV value instead of a parallel key.
- `flushHitCounters()` has no confirmed caller — if hit-count accuracy matters, the Rust port needs an explicit decision on when this flush runs (e.g. `waitUntil` on every request, or accept eventual/lossy hit counts).
- Decide fate of `KVUsageService` before porting — don't carry over unused code without a decision either to finish integrating it (quota enforcement wired into `CacheService.set`) or drop it.

---

## 5. Analytics (`apps/api/src/features/analytics/`)

### Purpose

Restaurant-scoped business analytics: dashboards, revenue/product/customer/performance breakdowns,
CSV/JSON export, and a heartbeat-style SSE stream for near-real-time stats. All heavy lifting is
delegated to `AnalyticsService` in `packages/database` (the Layer-2 reference implementation named
in `CLAUDE.md`); the feature-module `AnalyticsService` in `apps/api` is a thin caching/shaping
wrapper plus CSV export logic.

### Routes

Mount: `apiV1.route("/analytics", analyticsFeature.routes)`. Global gate: `apiV1.use("/analytics/*", authMiddleware)`; the router itself additionally applies `routes.use("*", authMiddleware, moduleGate("analytics"))` (redundant auth, but real module-gate enforcement).

| Method | Full path | Auth | Purpose | Request summary | Response summary |
|---|---|---|---|---|---|
| POST | `/api/v1/analytics/batch-sync` | bearer (module gate `analytics`) | Store an offline-sync analytics event batch to KV; clears analytics cache for the user's restaurant | arbitrary JSON, optionally `{events:[...]}` | `{success,data:{syncId,synced,itemCount,restaurantId,syncedAt}}` |
| POST | `/api/v1/analytics/:restaurantId/sync` | bearer, self-or-admin restaurant check | Same as batch-sync but restaurant-scoped by path param | arbitrary JSON | `{success,data:{syncId,synced,restaurantId,syncedAt}}` |
| GET | `/api/v1/analytics/dashboard` | bearer, role `[0,1]` (owners forced to own restaurant) | Dashboard summary | query: `restaurantId?, period` | `{success,data:DashboardSummary,timestamp}` |
| GET | `/api/v1/analytics/revenue` | bearer, role `[0,1]` | Revenue time series | query: filters incl. `groupBy,dateFrom,dateTo,includeComparison,limit` | `{success,data:RevenueData[]}` |
| GET | `/api/v1/analytics/products` | bearer, role `[0,1]` | Menu/product analytics (popular/category/low-performing) | query filters | `{success,data:ProductAnalytics}` |
| GET | `/api/v1/analytics/customers` | bearer, role `[0,1]` | Customer analytics (new/returning/LTV/top customers) | query filters | `{success,data:CustomerAnalytics}` |
| GET | `/api/v1/analytics/performance` | bearer, role `[0,1,2]` (chef included) | Order/kitchen performance analytics | query filters | `{success,data:PerformanceAnalytics}` |
| GET | `/api/v1/analytics/export` | bearer, role `[0,1]` | Generate a JSON or CSV export as a `data:` URI | query: `type,format,dateFrom,dateTo,groupBy,limit` | `ExportResponse` `{success,message,data:{type,format,filename,content_type,size_bytes,period,download_url,expires_at}}` |
| GET | `/api/v1/analytics/realtime-dashboard` | bearer, role `[0,1,2]` | Uncached live dashboard snapshot | query: `restaurantId?` | `{success,data:RealtimeAnalyticsData,timestamp}` |
| GET | `/api/v1/analytics/detailed-performance` | bearer, role `[0,1,2]` | Same data source as `/performance`, different route/response wrapper | query filters | `{success,data:...,timestamp}` |
| GET | `/api/v1/analytics/owner-dashboard` | bearer, role `[0,1]` | Alias of `/dashboard` under a different name | query: `restaurantId?` | `{success,data:DashboardSummary,timestamp}` |
| GET | `/api/v1/analytics/financial-report` | bearer, role `[0,1]` | Financial summary/breakdown/projection | query filters | `{success,data:FinancialReportData}` |
| GET | `/api/v1/analytics/sse` | bearer, role `[0,1,2]` | Server-Sent Events stream: heartbeat every 30s, live stats every 10s, 1h hard timeout | query: `lastEventId?` (accepted, unused) | `text/event-stream`, not the JSON envelope |

### Business logic

- **Caching wrapper** (`apps/api/src/features/analytics/services/AnalyticsService.ts`): every read method (`getDashboardData`, `getRevenueAnalytics`, `getProductAnalytics`, `getCustomerAnalytics`, `getPerformanceAnalytics`, `getFinancialReport`) does cache-key-by-`JSON.stringify(filters)` lookups against `KVCacheService` with tiered TTLs (`CACHE_TTL.SHORT` for dashboard, `MEDIUM` for most breakdowns, `LONG` for financial report). `getRealtimeData` deliberately **bypasses cache** for freshness. `clearCache(restaurantId)` does a KV pattern clear (`analytics:*:<restaurantId>:*` or `analytics:*`), called after sync endpoints write new data.
- **Export**: builds the requested dataset via the same cached getters, then either JSON-stringifies with metadata wrapper or flattens to CSV via a hand-rolled `flattenForCsv`/`normalizeCsvRows`/`toCsv` (dot-notation flattening of nested objects, section-aware for object-of-arrays payloads). The "download" is a `data:` URI embedding the full payload inline in the JSON response (`downloadUrl`) — **not an actual file/object storage upload**, so `size_bytes`/`expires_at` are informational only; nothing is actually deleted after `expires_at`.
- **Sync endpoints** are dead-end write paths: they persist the raw client payload to KV (`analytics:batch-sync:...` / `analytics:sync:<restaurantId>:...`, 30-day TTL, both a dated key and a `latest` pointer) and invalidate cache, but do **not** feed the payload into any aggregate computation — the actual dashboard/revenue numbers always come from live D1 queries in `packages/database`'s `AnalyticsService`, not from synced client events. This looks like a client-offline-queue drain endpoint whose payload is presently unused server-side beyond archival.
- **Real analytics engine — `packages/database/src/services/analytics.ts`** (Drizzle Layer 2, `sql` + schema refs per `CLAUDE.md`):
  - Revenue/date-grouping uses raw SQLite `strftime`/`DATE()` over `orders.createdAt` **divided by 1000** (because `createdAt` is Unix-ms `timestamp_ms` mode but `strftime` expects seconds) — every date-bucketing query repeats this `/1000` conversion inline.
  - A documented, intentional-looking convention: `FULFILLED_ORDER_STATUSES = ["paid","delivered","served"]` is used for revenue/fulfillment metrics because `orders.status` **never contains the literal `"completed"`** — a code comment explicitly warns that older `eq(status,"completed")` queries silently matched zero rows. `getDashboardData` separately computes "orders count" (excludes only `cancelled`) vs. "revenue" (`inArray` on the fulfilled set) — these are two different row-sets for two different metrics in the same dashboard payload.
  - `getCustomerAnalytics` computes average-orders-per-customer and customer-lifetime-value via **inline raw subquery `sql` blocks** (`FROM (SELECT customer_id, COUNT(*) ... ) as customer_order_counts`) rather than Drizzle-composed joins — still Layer 2 (schema-typed outer query) but the inner subquery is a hand-written string.
  - `getFinancialReport`'s period-over-period growth rate builds a same-length "prior window" immediately preceding the requested range and re-runs `getRevenueAnalytics` against it — a second full query pass, not a single windowed SQL query.
  - `expenseAnalysis`/`profitability` are explicitly zeroed placeholders (no cost/expense schema yet) — code comments flag this as intentional rather than a bug (avoids implying a fake 100% margin).
  - `buildRevenueProjections` is a simple 7-day forward moving-average forecast (not the dedicated Forecast module's algorithm) bolted onto the financial report.

### Data

- **D1 tables**: `orders`, `orderItems`, `menuItems`, `customers`, `tables`, `categories` (all via Drizzle Layer 1/2 in `packages/database/src/services/analytics.ts`).
- **KV** (`CACHE_KV`): cached analytics payloads (`analytics:dashboard:...`, `analytics:revenue:...`, etc.), plus the sync-archive keys above.
- **No external calls** in this module (Slack/webhook not used here).

### Cross-module dependencies

- `moduleGate("analytics")` ties this feature to the Billing/subscription module-gating system (`shopSubscriptions`, `PLAN_DEFAULT_MODULES`) — a restaurant without the `analytics` module entitlement gets a 403 before any handler runs.
- Shares `AnalyticsFilters`/money-cents helpers (`sumMoneyAmount`, `avgMoneyAmount`, `moneyAmountExpression` from `packages/database/src/utils/money-sql.ts`) with the AI Analytics module's underlying data model (menu/order schema), though the two analytics engines (`packages/database` classic vs. `packages/ai-analytics`) do not call into each other.
- `AIAnalyticsService.getFinancialReport`/dashboard-adjacent flows are entirely separate — no shared caching layer with this module despite similar KV usage patterns.

### Rust rewrite notes

- The `/1000` Unix-ms-to-seconds conversion for every `strftime`/`DATE()` call is a repeated, easy-to-miss detail — a Rust SQL layer should centralize this as a single date-bucketing helper rather than re-deriving it per query, matching the `unixMsDiffMinutes`/money-sql helper pattern already used in `packages/database/src/utils`.
- The `FULFILLED_ORDER_STATUSES` vs. "non-cancelled" distinction is load-bearing and easy to regress — port the constant and the comment verbatim; do not "simplify" to `status = 'completed'` (that status value does not exist in the schema).
- Export "download URLs" are inline `data:` URIs today — decide whether the Rust port should switch to genuine R2-backed signed URLs (more scalable for large exports) as part of the rewrite, since the current approach embeds the entire payload twice (once in `data`, once in `download_url`).
- The batch-sync/restaurant-sync endpoints archive-but-don't-aggregate client payloads — confirm with product whether this is intentional (audit-only) before deciding how much of that code path is worth porting versus dropping.
- SSE handler uses `setInterval` + manual `ReadableStream` controller management with a 1-hour hard cutoff and abort-signal cleanup — port the same lifecycle discipline (heartbeat + timeout + abort listener) if SSE survives into the Rust service; don't drop the cleanup path or the stream leaks.

---

## 6. AI Analytics (`apps/api/src/features/ai-analytics/`)

### Purpose

Per-restaurant configuration and invocation of third-party LLM providers (Anthropic/OpenAI/Google/DeepSeek/custom) to generate narrative business-insight reports, plus a set of "product analysis"
read endpoints (traffic drivers / bestsellers / profit leaders) that are pure Drizzle-Layer-2 SQL and
don't require an LLM at all. Usage is metered (`quotaGate("ai.requests")`) and gated (`moduleGate("ai_analytics")`) per the platform's billing/module system.

### Routes

Mount: `apiV1.route("/ai-analytics", aiAnalyticsFeature.routes)`. Global gate: `apiV1.use("/ai-analytics/*", authMiddleware)`. Every route additionally applies `moduleGate("ai_analytics")` + `quotaGate("ai.requests")` inline, and most emit a `meterEmit(c, "ai.requests", ...)` usage event.

| Method | Full path | Auth | Purpose | Request summary | Response summary |
|---|---|---|---|---|---|
| GET | `/api/v1/ai-analytics/config/:restaurantId` | bearer, role `[0,1]` + restaurant-scope | Get AI provider config (key redacted) | — | `{success,config:{...,apiKeyEncrypted:"***"}\|null,availableProviders?}` |
| POST | `/api/v1/ai-analytics/config` | bearer, role `[0,1]` + restaurant-scope | Test then save an AI provider config | `{restaurantId,provider,apiKey,model?,customBaseUrl?}` | `{success,message,testResult:{latency,model}}` |
| POST | `/api/v1/ai-analytics/test-provider` | bearer (no explicit role check on this route itself) | Ad hoc test of arbitrary provider credentials without saving | `{provider,apiKey,model?,baseUrl?}` | `{success,latencyMs?,model?,error?}` (whatever `testProvider()` returns, spread at top level — not wrapped in `data`) |
| GET | `/api/v1/ai-analytics/models/:provider` | bearer (module-gate applied at router-use level, per-route no explicit role check) | List available/default models for a provider | — | `{success,provider,models,defaultModel}` |
| POST | `/api/v1/ai-analytics/generate` | bearer, role `[0,1]` + restaurant-scope | Generate a full AI insights report (cached 6h unless `refreshCache`) | `{restaurantId,timeRange,includeForecasting?,refreshCache?}` | `{success,report:AIAnalyticsReport,cached:false}` |
| GET | `/api/v1/ai-analytics/products/traffic-drivers/:restaurantId` | bearer + restaurant-scope | Top "traffic driver" products (no LLM call) | query: `timeRange,limit` | `{success,products:ProductAnalysis[]}` |
| GET | `/api/v1/ai-analytics/products/bestsellers/:restaurantId` | bearer + restaurant-scope | Top sellers by volume (no LLM call) | query: `timeRange,limit` | `{success,products}` |
| GET | `/api/v1/ai-analytics/products/profit-leaders/:restaurantId` | bearer + restaurant-scope | Top profit products (no LLM call) | query: `timeRange,limit` | `{success,products}` |
| GET | `/api/v1/ai-analytics/products/analysis/:restaurantId` | bearer + restaurant-scope | Full categorized product analysis (no LLM call) | query: `timeRange` | `{success,products}` |
| GET | `/api/v1/ai-analytics/usage/:restaurantId` | bearer + restaurant-scope | Aggregated AI usage log stats | query: `startDate?,endDate?` | `{success,usage:AIUsageStats[]}` |

Note: `report`/`products`/`usage`/`config` are placed at the **top level** of the JSON body, not nested under `data` — this module consistently deviates from the `{success,data}` envelope convention used elsewhere.

### Business logic

- **Config storage & secrets** (`apps/api/src/features/ai-analytics/services/AIAnalyticsService.ts`): API keys are AES-256-GCM encrypted via `@makanmasak/utils`'s `encrypt`/`decrypt` (PBKDF2, 100k iterations, salt **`"makanmakan-api-key-encryption-salt"`**, distinct from that package's own `DEFAULT_SALT`) before being written to the `aiConfigurations.apiKeyEncrypted` column — matches the `CLAUDE.md` rule that secrets live only in encrypted payload fields. `saveConfig` **always re-tests the provider** (`testProvider`) before persisting, so a broken key never gets saved. Upsert is keyed on `restaurantId` via `onConflictDoUpdate` with `excluded.*` references (one AI config per restaurant, single-provider).
- **Report generation** delegates to `@makanmasak/ai-analytics`'s `AIInsightsService.generateReport`, which:
  1. Checks a `ai_insights_cache` D1 table for a non-expired cached report (6h expiry) unless `refreshCache`.
  2. Gathers `BusinessMetrics` via **raw SQL strings** (`this.db.prepare(...)`, not Drizzle) against `orders` — **this is Layer-3 raw SQL, which `CLAUDE.md` bans for new code**, and it references columns (`total_amount`, `user_id`, `created_at`, `status = 'completed'`) that **do not match the actual `orders` schema** (real columns are `total_amount_cents`, `customer_id`, and `created_at_ms` (the column name itself changed, not just the unit) as Unix-ms, and `status` never equals the literal `'completed'` — see the Analytics module note on `FULFILLED_ORDER_STATUSES`). At minimum the `status = 'completed'` predicate looks like it always matches zero rows in production, and `total_amount`/`user_id`/date-string comparisons against a ms-epoch integer column would either error or silently return no rows depending on the D1/SQLite coercion. **This looks like dead/broken code inherited from an earlier schema and needs verification against production behavior before porting as-is.**
  3. Layers in `ProductAnalysisService` (the actual Layer-2 Drizzle implementation, correct and schema-typed) for top products/traffic-drivers/profit-leaders/underperformers.
  4. Computes period-over-period growth via a second raw-SQL query against the same suspect columns.
  5. Calls the configured LLM provider twice — once for a JSON array of 5-8 structured insights (system prompt in Traditional Chinese demanding a strict JSON schema), once for a prose executive summary — and optionally a third time-boxed simple moving-average "forecast" (not the dedicated Forecast module).
  6. Caches the full report (including metrics + insights + summary) back into `ai_insights_cache` keyed by `(restaurantId, insight_type='full_report', time_range)` with an `ON CONFLICT` upsert.
- **`ProductAnalysisService`** (`packages/ai-analytics/src/services/ProductAnalysisService.ts`, correctly Layer 2): computes per-menu-item metrics (orders, revenue, view/cart counts — though `first_item_count` and `cart_addition_count` are **hard-coded to `0`** in the current query (`ProductAnalysisService.ts:247,249`), while `view_count` (`:248`) reads the real `COALESCE(menu_items.view_count, 0)` column, which IS written by menu/restaurant services — so conversion-rate scoring is starved of cart signal but view-based signal can be live) via a single grouped join across `menuItems`/`orderItems`/`orders`/`categories`, then in application code: linear-regression trend score, first/second-half growth rate, sales/revenue/profit rank maps, and categorization heuristics (`traffic-driver`, `bestseller`, `profit-leader`, `underperformer` — thresholds like `profitMargin > 0.5 && totalOrders >= 10`). **This query also filters `eq(orders.status, "completed")`** — same status-literal mismatch flagged in Analytics; worth confirming whether `analyzeProducts`/`getBestsellers`/etc. actually return any rows in production, or if this and the AIInsightsService raw SQL are both silently starved by the same root cause.
- **`AIForecastEnhancer`** (used by the Forecast module, not this route table, but implemented alongside `AIAnalyticsService`'s encryption pattern) duplicates the exact PBKDF2/AES-GCM key-derivation code (same salt string) instead of importing `@makanmasak/utils`'s `encrypt`/`decrypt` — a second independent copy of the same crypto.

### Data

- **D1 tables**: `aiConfigurations` (one row per restaurant, encrypted API key), `aiUsageLogs` (per-call provider/model/operation/tokens/latency/success), `ai_insights_cache` (raw-SQL-managed cache table, not a Drizzle schema import in `AIInsightsService` — accessed only via `db.prepare`), plus read access to `menuItems`/`orderItems`/`orders`/`categories` via `ProductAnalysisService`.
- **External calls**: outbound HTTPS to the configured LLM provider's API (Anthropic/OpenAI/Google/DeepSeek/custom base URL) — actual HTTP client code lives in `packages/ai-analytics/src/providers/*` (not opened in this pass).
- **Secrets**: `env.ENCRYPTION_KEY` is the shared key-derivation input for both `AIAnalyticsService` and `AIForecastEnhancer`'s independent crypto implementations.

### Cross-module dependencies

- Shares `@makanmasak/ai-analytics`'s `ProductAnalysisService` with the Forecast module is **not** the case — Forecast has its own separate statistical forecasting (`ForecastService`) and only reuses the LLM-provider abstraction (`createProvider`) and the same encryption pattern, not `ProductAnalysisService` itself.
- `moduleGate("ai_analytics")` + `quotaGate("ai.requests")` + `meterEmit` tie this module into the Billing feature's plan-tier/quota system (`PLAN_QUOTAS`, `MeterKey`).
- `AIForecastEnhancer` (Forecast module) independently re-derives the identical AES key from `env.ENCRYPTION_KEY` with the identical salt string — a shared secret-derivation constant duplicated across two files instead of one.

### Rust rewrite notes

- **Do not port the raw-SQL `BusinessMetrics` query in `AIInsightsService.gatherBusinessMetrics` as-is** — verify against the live schema first; it appears to reference non-existent/renamed columns (`total_amount`, `user_id`, `created_at` as a date string) and a `status = 'completed'` value that the schema comment elsewhere says never occurs. This is exactly the "Layer 3 raw SQL silently drifts" failure mode `CLAUDE.md` warns about — the Rust port should rebuild this query using the real schema (Layer 2 equivalent, matching `ProductAnalysisService`'s correct pattern) rather than transliterating the existing SQL strings.
- `first_item_count`/`cart_addition_count` are hard-coded to 0 in `ProductAnalysisService.fetchRawMetrics` (`view_count` reads the live `menu_items.view_count` column — keep that column read in the port) — confirm with product whether traffic-driver/conversion scoring is supposed to be live (needs a real view/cart-tracking source) before porting the categorization logic as if it produces meaningful signal today.
- Consolidate the duplicated PBKDF2/AES-GCM key-derivation code (`AIAnalyticsService` inline, `AIForecastEnhancer` inline, `packages/utils/src/encryption.ts`) into one shared crypto module in the Rust port — currently three near-identical implementations exist with different salts/formats (see Integrations module note for a fourth, incompatible variant).
- LLM provider calls are synchronous request/response in the route handler (no streaming) with fixed `maxTokens`/`temperature` — acceptable to port 1:1, but note the two-LLM-calls-per-report pattern (insights JSON + prose summary) doubles latency/cost per report generation; consider parallelizing the two calls in the Rust port since they're independent given the same `metrics` input.
- `ai_insights_cache` is accessed via raw D1 `prepare()` in the TS code (no Drizzle schema object) — the Rust port should define a proper schema/model for this table rather than hand-writing SQL strings, both for the cache table and (per the note above) for `BusinessMetrics`.

---

## 7. Forecast (`apps/api/src/features/forecast/`)

### Purpose

Statistical (weighted moving average) demand forecasting per menu item, explodable into per-ingredient forecasts via a Bill-of-Materials (BOM) join, with an optional LLM-based adjustment pass
and a rule-based alerting layer (high-demand, low-stock, unusual-spike, procurement-needed,
excess-stock). All forecast/actual comparison ("accuracy") is also computed here.

### Routes

Mount: `apiV1.route("/forecast", forecastFeature.routes)`. Global gate: `apiV1.use("/forecast/*", authMiddleware)` + `apiV1.use("/forecast/*", moduleGate("analytics"))`.

| Method | Full path | Auth | Purpose | Request summary | Response summary |
|---|---|---|---|---|---|
| POST | `/api/v1/forecast/:restaurantId/generate` | bearer, role `[0,1]` | Generate item-level or ingredient-level forecasts for a date range | `{startDate,endDate,type:"item_level"\|"ingredient_level",useAI?}` | `{success,data:{forecasts:ForecastResult[]\|IngredientForecastResult[]}}` |
| GET | `/api/v1/forecast/:restaurantId` | bearer, role `[0,1]` | Read cached/generated forecasts for a date or range | query: `date` or `startDate+endDate`, `type?` | `{success,data:{forecasts:ForecastResult[]}}` |
| GET | `/api/v1/forecast/:restaurantId/accuracy` | bearer, role `[0,1]` | Compare past forecasts vs. actual order quantities | query: `startDate,endDate` | `{success,data:{accuracy:ForecastAccuracyItem[]}}` |
| GET | `/api/v1/forecast/:restaurantId/ingredient-forecast` | bearer, role `[0,1]` | Read cached/generated ingredient-level forecasts | query: `startDate,endDate` | `{success,data:{forecasts:IngredientForecastResult[]}}` |
| GET | `/api/v1/forecast/:restaurantId/alerts` | bearer, role `[0,1]` | Tomorrow's demand/stock alerts (item + ingredient level) | — | `{success,data:{alerts:ForecastAlert[]}}` |

### Business logic

- **Item-level statistical forecast** (`ForecastService.generateForecast`, `apps/api/src/features/forecast/services/ForecastService.ts`): for each target date, pulls up to 4 prior weeks of same-weekday sales (`getHistoricalSales` — Drizzle Layer 2, joins `orderItems`↔`orders`↔`menuItems`, filters non-cancelled fulfilled-ish statuses `confirmed/preparing/ready/delivered/paid` and `orders.createdAt/1000` weekday match via `strftime('%w', ...)`), then computes a **weighted moving average** with fixed weights `{week1:0.4, week2:0.3, week3:0.2, week4:0.1}` (`WEIGHTS`), applies a trend adjustment (`recentAvg` of newest 2 weeks vs. `olderAvg` of the rest, half-weighted into the prediction), and derives a `confidence` score from coefficient-of-variation (`1 - stdDev/mean`, clamped to `[0,1]`).
- **Persistence**: every generated forecast is written to both **KV** (`forecast:<restaurantId>:<date>:<type>`, 6h TTL) and **D1** (`forecastCache` table, upserted on `(restaurantId, forecastDate, forecastType)`) — KV is the fast path for `getForecast`, D1 is the fallback/audit trail and also what `getAccuracy` reads back from. On any error mid-generation, `generateForecast` falls back to returning a **stale** cached D1 row (marked `stale:true`) rather than failing the whole date-range request.
- **Ingredient explosion** (`IngredientForecastService.generateIngredientForecast`): runs the item-level forecast first, loads the restaurant's BOM (`menuItemIngredients` ⋈ `ingredientDefinitions`, active/non-deleted only), then for each forecasted menu item multiplies `predicted × quantityPerServing` per linked ingredient and accumulates across menu items sharing an ingredient — including a **contribution-weighted confidence** (`Σ(confidence×quantity) / Σ(quantity)`) and a per-ingredient list of contributing menu items. Items with no BOM entry are silently skipped (not an error).
- **Optional AI enhancement** (`AIForecastEnhancer`): only runs if `useAI` is set and a per-restaurant AI config exists (looked up via raw `db.prepare` against `ai_configurations`, decrypting the key with its own inline PBKDF2/AES-GCM copy — see cross-module note). Builds a Traditional-Chinese prompt listing the top 30 statistical forecasts plus a **rule-based holiday/season context generator** (fixed Taiwan public holidays by month/day, weekend flag, coarse lunar-holiday month ranges, seasonal hot/cold-drink hints), asks the LLM for `{adjustments:[{ingredientId,adjustmentFactor,reason}], recommendations:[...]}`, and applies adjustment factors **clamped to `[0.5, 2.0]`** to the statistical predictions. Any parse/LLM failure gracefully degrades back to the unmodified statistical forecast (never throws out of `enhancePredictions`).
- **Accuracy**: for every cached forecast row in range, joins actual quantities from `orderItems`/`orders` grouped by item+date (same fulfilled-status filter as the historical-sales query) and computes `%deviation = |actual - predicted| / predicted × 100` per item/day; menu item names are resolved in **90-id chunks** to respect D1's ~100-bound-parameter limit.
- **Alerts** (`getAlerts`): pulls tomorrow's item-level forecast, cross-references live `menuItems.inventoryCount`, and raises: `high_demand` (predicted > 30 & confidence ≥ 0.7), `low_stock` (predicted exceeds current inventory), `unusual_spike` (predicted > 1.5× historical average) — plus, from the *ingredient*-level forecast cache (separately fetched, wrapped in its own try/catch so a failure here doesn't kill item-level alerts): `procurement_needed` (predicted > current stock) and `excess_stock` (current stock > 3× predicted). Alerts are sorted `critical → warning → info`; nothing here is persisted (computed fresh on every call, not written to any alerts table — unlike the Backup module's alerts which are D1-backed).

### Data

- **D1 tables**: `forecastCache` (JSON `data`/`metadata` blobs, one row per `(restaurantId, forecastDate, forecastType)`, both item- and ingredient-level share the same table distinguished by `forecastType`), `menuItems` (inventory/read), `orders`/`orderItems` (historical sales/actuals), `menuItemIngredients`/`ingredientDefinitions` (BOM), and (via `AIForecastEnhancer`) raw reads of `ai_configurations`.
- **KV**: `forecast:<restaurantId>:<date>:<type>` (item-level, 6h TTL) and `forecast:ingredient:<restaurantId>:<date>` (ingredient-level, 6h TTL) — two different key schemes for the two forecast kinds despite sharing one D1 table.
- **External calls**: LLM provider API (only when `useAI` is requested and configured), via the same `@makanmasak/ai-analytics` provider abstraction as the AI Analytics module.

### Cross-module dependencies

- Reuses `@makanmasak/ai-analytics`'s `createProvider`/`LLMConfig` (provider abstraction only, not `ProductAnalysisService`).
- Independently re-implements AES-GCM/PBKDF2 decryption of `ai_configurations.api_key_encrypted` (`AIForecastEnhancer`) rather than calling `AIAnalyticsService.getLLMConfig` from the AI Analytics module — two code paths read/decrypt the same config row with duplicated crypto code.
- `moduleGate("analytics")` (not a distinct `"forecast"` module key) gates the entire feature — forecasting is bundled under the same billing entitlement as the Analytics module.
- Ingredients feature (`apps/api/src/features/ingredients`, out of this document's scope) owns `ingredientDefinitions`/`menuItemIngredients` — Forecast only reads them.

### Rust rewrite notes

- The weighted-moving-average + trend-adjustment + CV-based confidence algorithm is straightforward numeric code — safe to port near-verbatim, but pin down the exact weight constants (`0.4/0.3/0.2/0.1`) and the "half-weighted trend" formula (`predicted × (1 + trendPercent/100 × 0.5)`) since they're not derived from any named model, just hand-tuned constants.
- Two independent AES-GCM/PBKDF2 implementations decrypting the same `ai_configurations` table (here and in AI Analytics) should collapse into one shared crypto/config-loading function in the Rust port.
- `forecastCache.data` is a JSON column keyed by menu-item-ID-as-object-key (`Record<string, CachedItemData>`) for item-level, but a **plain array** for ingredient-level (`result.ingredients` is `IngredientForecastItem[]`) — same column, two different JSON shapes distinguished only by `forecastType`. A Rust port with a typed schema needs either two separate tables/columns or a tagged-union deserialization keyed on `forecastType`.
- Alerts are always computed fresh (no persistence) — decide whether the Rust port should keep this "compute on read" model or persist alerts like the Backup module does, especially if alert history/acknowledgment is ever needed for forecasting.
- The 100-id D1 bind-parameter limit workaround (90-id chunking in `getAccuracy`) is D1-specific; if the Rust port uses a different binding limit (or none, e.g. building a single `IN (...)` string safely), this chunking constant should be revisited rather than copied blindly.
- Holiday-context logic (`AIForecastEnhancer.getHolidayContext`) hard-codes Taiwan-specific fixed and coarse lunar holiday windows — treat as a stand-in heuristic (comment says "可能"/"maybe" for lunar dates) rather than an authoritative calendar; flag if a proper holiday-calendar source is wanted for the Rust port.

---

## 8. Audit (`apps/api/src/features/audit/`)

### Purpose

Single-endpoint offline-action sync: lets an admin client (e.g. admin dashboard's background sync
queue) replay locally-queued admin actions into the server-side `audit_logs` table after connectivity
returns. This is distinct from the Manager feature's own `/audit-logs` read endpoint (`apps/api/src/features/manager`, out of scope) — this module is **write-only**.

### Routes

Mount: `apiV1.route("/audit", auditRoutes)`. No global middleware for this prefix — auth is entirely inline in the single route.

| Method | Full path | Auth | Purpose | Request summary | Response summary |
|---|---|---|---|---|---|
| POST | `/api/v1/audit/actions` | bearer (inline `authMiddleware`) + restaurant-scope self-check | Insert one offline-queued admin action as an audit log row | `{action_type, target_id?, data?, user_id?, restaurant_id?, timestamp?}` (passthrough — extra fields kept) | `{success,data:{auditLogId,synced,action,resource,resourceId,restaurantId}}` (201) |

### Business logic

- **Resource inference**: `inferResource(action_type)` does substring matching on the action-type string (`order`→`orders`, `menu`→`menu_items`, `user`→`users`, `setting`→`settings`, `backup`→`backups`, `analytics`→`analytics`, else `admin_action`) — a coarse heuristic, not a real enum lookup.
- **Restaurant scoping**: `canWriteRestaurantScope` allows role-0 (admin) to write for any restaurant or `null`, otherwise requires the caller's own `restaurantId` to match the body's `restaurant_id` (as strings) — same pattern as the Backup module's `/upload` endpoint.
- **Insert**: a single **raw D1 `prepare()` INSERT** (not Drizzle) directly into `audit_logs`, with `changes` stored as a JSON string containing `{metadata:{offline:true, payload:body.data, requestedUserId, requestedTimestamp}}` — i.e. the actual client-provided `data` payload is nested inside a `changes.metadata.payload` JSON blob rather than being column-mapped. `created_at_ms` is derived from the client-supplied `timestamp` (parsed via `Date.parse`, falling back to `Date.now()` on parse failure or absence) — this is one of the few places in the read set that **trusts a client-supplied timestamp** for a historical record's created-at.
- `description` is synthesized (`"Offline <action> on <resource>[#<resourceId>]"`) rather than being client-supplied — a fixed, English-only template regardless of the actual action semantics.

### Data

- **D1 table**: `audit_logs` — written via raw SQL insert (columns: `user_id, restaurant_id, action, resource, resource_id, description, changes, ip_address, user_agent, success, created_at_ms`). No Drizzle schema import used here (Layer 3 raw SQL, against `CLAUDE.md`'s stated policy for new code, though this may predate the policy or be judged low-risk given it's a single simple insert with no dynamic identifiers).
- No KV, no R2, no external calls.

### Cross-module dependencies

- Writes to the same `audit_logs` table that the Manager feature's `/audit-logs` read endpoint (out of scope) presumably serves from, and that System's `/health/detailed` scans for recent "error"/"fail" actions (`LIKE '%error%' OR LIKE '%fail%'`) — so this module's writes are visible cross-feature even though the module itself has no reads.

### Rust rewrite notes

- Client-supplied `timestamp` becoming `created_at_ms` on an audit row is a trust boundary worth flagging explicitly for the port — decide whether the Rust service should instead always stamp server-received time and keep the client timestamp only in the JSON payload (currently it's stored in *both* places: `created_at_ms` from the client value, and `requestedTimestamp` inside the JSON `changes` blob for reference).
- This is a good candidate to rewrite using the project's standard Drizzle/schema-typed insert rather than porting the raw `prepare()` string, since it's a simple one-table insert with no dynamic identifiers — no reason to keep it as Layer-3 SQL in the new implementation.
- `inferResource`'s substring heuristic should be replaced with an explicit enum/mapping table if the Rust port wants stronger typing on `resource`.

---

## 9. Integrations (`apps/api/src/features/integrations/`)

### Purpose

Third-party delivery-platform connectivity (currently Uber Eats fully implemented, Foodpanda stubbed
to 501-everywhere): OAuth-style credential storage, webhook ingestion + order creation, menu push
sync, and order-status sync back to the platform. This is the module `CLAUDE.md`'s OAuth-secret rule
targets directly.

### Routes

Mount: `apiV1.route("/integrations", integrationsFeature.routes)`, composed of `routes.route("/webhooks", webhookRoutes)` + `routes.route("/", adminRoutes)`. Mounted in the **public** block of `app-factory.ts` with no matching global `authMiddleware` — auth is fully self-contained per sub-router.

| Method | Full path | Auth | Purpose | Request summary | Response summary |
|---|---|---|---|---|---|
| POST | `/api/v1/integrations/webhooks/uber-eats` | **public**, HMAC-verified (`X-Uber-Signature`) + idempotency middleware | Receive Uber Eats order/payment webhook, create internal order | Uber Eats order-webhook JSON | `{success,orderId}` (order events) or `{success,data:{acknowledged,eventType}}` (payment events) or `{error}` (400/401/404/500) — **not the unified envelope on the error paths** |
| POST | `/api/v1/integrations/webhooks/foodpanda` | public | Stub | — | `{error:"Foodpanda integration not yet implemented"}` (501) |
| GET | `/api/v1/integrations/:restaurantId` | bearer, role `[0,1]` + `moduleGate("platform_integration")` + restaurant-scope | List all platform integrations for a restaurant | — | `{data:integration[]}` (no `success` key) |
| GET | `/api/v1/integrations/:restaurantId/webhook-logs` | bearer, role `[0,1]` + restaurant-scope | List webhook receipt logs | query: `platform?,limit?,offset?` | `{data:log[]}` |
| GET | `/api/v1/integrations/:restaurantId/:platform` | bearer, role `[0,1]` + restaurant-scope | Get one integration's config/status | — | `{data:integration}` or 404 `{error}` |
| POST | `/api/v1/integrations/:restaurantId/:platform/connect` | bearer, role `[0,1]` + restaurant-scope | Store encrypted credentials, enable integration | `{clientId,clientSecret,storeId,autoAcceptOrders?,menuSyncEnabled?}` | `{data:integration}` (201) or 501 if platform unsupported |
| PUT | `/api/v1/integrations/:restaurantId/:platform` | bearer, role `[0,1]` + restaurant-scope | Update non-secret config, optionally rotate `webhookSecret` | `UpdatePlatformConfigRequest` (partial config + optional `webhookSecret`) | `{data:integration}` |
| DELETE | `/api/v1/integrations/:restaurantId/:platform` | bearer, role `[0,1]` + restaurant-scope | Disconnect (hard-deletes the integration row) | — | `{success:true}` |
| POST | `/api/v1/integrations/:restaurantId/:platform/menu-sync` | bearer, role `[0,1]` + restaurant-scope | Push full menu to the platform | — | `{success:true,message}` or 501 |
| GET | `/api/v1/integrations/:restaurantId/:platform/orders` | bearer, role `[0,1]` + restaurant-scope | List platform-order mapping rows | query: `status?,limit?,page?` | `{data:order[]}` |

Note: essentially every admin-route response in this module uses `{data:...}` or `{error:...}` **without** the `success` field at all — a consistent, module-wide deviation from the unified envelope. Same for the webhook route's error branches.

### Business logic

- **Credential storage / OAuth secret rule** (`PlatformIntegrationService`, `apps/api/src/features/integrations/services/PlatformIntegrationService.ts`): `connect`/`updateConfig` always route the credential object (`clientId, clientSecret, storeId`, plus optionally `webhookSecret`, `accessToken`, `tokenExpiresAt`) through `encryptCredentials` before writing to `platformIntegrations.credentials` — this satisfies `CLAUDE.md`'s "OAuth credentials... must be stored only in encrypted payload fields" rule. Non-secret config (`autoAcceptOrders`, `menuSyncEnabled`) is stored **unencrypted** in the separate `config` JSON column, and `updateConfig` explicitly destructures `webhookSecret` out of the config-update payload so it can never accidentally land in the plaintext `config` column (it also strips any legacy `webhookSecret` key it finds already sitting in `config` on read, migrating it into the encrypted blob going forward).
- **Encryption implementation is a *fourth*, incompatible variant** compared to the other three in this document (Backup's PBKDF2+salt, `packages/utils/encryption.ts`'s PBKDF2+salt+colon-separated output, AI Analytics/Forecast's PBKDF2+fixed-salt): this module derives the AES-256-GCM key via a **plain SHA-256 digest of the raw key string** (no PBKDF2, no salt parameter) and serializes as `base64(iv || ciphertext)` with **no separator** between IV and ciphertext (12-byte IV prefix, positionally decoded) — functionally secure (AES-GCM is still AEAD) but **not interoperable** with any of the other three encrypt/decrypt implementations in the codebase. `readStoredCredentials` is defensively polymorphic: it accepts a stored value that's already a plain object, a JSON-stringified plain object, a JSON-stringified *encrypted string*, or a bare encrypted string — handling multiple historical storage shapes in one function.
- **Webhook processing** (`routes/webhook.ts`): looks up the matching integration by **decrypting every enabled `uber_eats` integration's credentials and comparing `storeId`** (`Promise.all` fan-out, no indexed lookup by store ID — O(n) over all enabled Uber Eats integrations platform-wide per webhook), verifies an HMAC-SHA256 signature over the raw body using the resolved `webhookSecret` (falling back to `clientSecret` if no dedicated webhook secret is configured), logs the raw payload to `platformWebhookLogs` before processing, and short-circuits `payment.*` event types as "acknowledged, not order-processed" (a comment notes payment reconciliation happens through the payments idempotency layer, not here). Order-type events are parsed by the adapter (`UberEatsAdapter.parseOrder`) and handed to `PlatformOrderService.processWebhook`; failures update the webhook-log row's status to `failed` with the error message but still return HTTP 500 to the platform (which will presumably retry).
- **Order creation from webhook** (`PlatformOrderService.processWebhook`): resolves platform item IDs to internal `menuItemId`s via `platformMenuMappings` (unmapped items are **silently dropped**, not erroring — comment notes `menuItemId` is `NOT NULL` so an unmapped item literally cannot be inserted), creates the internal `orders`/`orderItems` rows with `orderSource: platform`, records the platform-order linkage (`platformOrders`), and if the integration has `autoAcceptOrders` enabled, immediately calls the adapter's `acceptOrder` (with credentials, refreshing the OAuth token first if near expiry) and flips both the platform-order status and internal order status to `confirmed` — swallowing (logging only) any accept failure so the webhook itself still succeeds.
- **Menu sync** (`PlatformMenuSyncService`): flips `menuSyncStatus` to `syncing` → builds a full `MenuSyncPayload` from all active categories/items (cents→dollars conversion inline) → calls the adapter's `syncMenu` → persists any returned `platformItemIds` back into `platformMenuMappings` (upsert per item) → flips status to `success`/`error` (storing the error message on failure) — a straightforward one-shot sync with no retry/backoff logic and no partial-failure handling (an error anywhere throws and the whole sync is marked `error`, even if the platform accepted some items).
- **Uber Eats adapter specifics** (`UberEatsAdapter`): OAuth2 client-credentials flow (`login.uber.com/oauth/v2/token`) with in-memory token freshness check (`tokenExpiresAt > now + 60s`) before every order-mutation call, real Uber Eats v2 REST endpoints for accept/deny/cancel/menu-sync, and HMAC-SHA256 webhook verification against the `X-Uber-Signature` header.

### Data

- **D1 tables**: `platformIntegrations` (credentials + config + sync status per restaurant/platform), `platformWebhookLogs` (raw payload archive + processing status), `platformOrders` (internal-order↔platform-order linkage + raw payload + status), `platformMenuMappings` (internal menu item ↔ platform item ID), plus writes into `orders`/`orderItems` on webhook order creation.
- **External calls**: Uber Eats OAuth token endpoint + REST API (`api.uber.com/v2/eats/...`) for accept/deny/cancel/menu-sync; inbound webhook calls originate from Uber Eats, not outbound from this service.
- **Secrets**: `env.ENCRYPTION_KEY` (credentials-at-rest key, SHA-256-derived here rather than PBKDF2), plus the per-integration `clientSecret`/`webhookSecret` themselves, stored only inside the encrypted `credentials` blob.

### Cross-module dependencies

- Webhook route uses the shared `idempotencyMiddleware` (`apps/api/src/middleware/idempotency.ts`, out of this document's scope) keyed by `Idempotency-Key` header or the payload's `event_id`/`eventId`, with an `effectId` resolver that extracts the created `orderId` — ties this module into the shared idempotency infrastructure also used by payments/billing webhooks per `CLAUDE.md`'s idempotency-key rule.
- `moduleGate("platform_integration")` ties admin routes to the billing/subscription module system, same pattern as Analytics/Forecast/AI Analytics.
- Order creation writes directly into the core `orders`/`orderItems` tables owned by the Orders feature (out of scope) — this module is a producer into that schema, not just a reader.

### Rust rewrite notes

- **Unify the encryption scheme.** This module's SHA-256-digest-as-AES-key (no PBKDF2, no salt, no separator) is the fourth distinct crypto implementation found across this document's modules (Backup, `packages/utils`, AI Analytics/Forecast, this module) — before porting to Rust, pick **one** AEAD scheme (recommend `packages/utils/encryption.ts`'s PBKDF2 + salt + `iv:ciphertext` format, since it's the most clearly documented) and write a migration path for existing encrypted `platformIntegrations.credentials` rows, rather than porting four incompatible formats into four Rust modules.
- The webhook route resolves the matching integration by decrypting-and-comparing every enabled Uber Eats integration row on every webhook call — this is an O(n) scan across *all* restaurants' Uber Eats integrations per webhook and will not scale; the Rust port should add an indexed lookup (e.g. an unencrypted, hashed/HMAC'd `storeId` column suitable for equality lookup, keeping the rest of the credentials encrypted) instead of brute-force decrypting every row.
- `readStoredCredentials`'s four-shape polymorphism (object / JSON-string-object / JSON-string-encrypted-string / bare-encrypted-string) suggests historical format migrations happened in place — the Rust port should pick one canonical stored shape and write a one-time backfill rather than keeping runtime polymorphic parsing indefinitely.
- Menu sync has no partial-failure/retry handling — decide whether the Rust port should chunk/retry per-item rather than all-or-nothing per full-menu PUT, especially since Uber Eats' own API can partially accept large payloads.
- Only Uber Eats is implemented; Foodpanda is 100% stubbed (`throw`/501 everywhere) — treat `PlatformAdapter` as an interface contract to fill in during the port, not evidence that Foodpanda is production-ready anywhere in the current system.
- Response envelope inconsistency (`{data}`/`{error}` with no `success` key) throughout this module's admin routes is worth deciding on explicitly — either the Rust port normalizes to the unified `{success,data}`/`{success,error}` shape used elsewhere (breaking existing client expectations unless the admin dashboard is updated in lockstep) or the port deliberately preserves the current shape for this module. Don't let this be an accidental omission.

---

## 10. Partnerships (`apps/api/src/features/partnerships/`)

### Purpose

"特約商店體系" — institutional/organizational discount partnerships (e.g. university or company
agreements): manage partner organizations, per-restaurant discount plans tied to a partnership,
verified-member enrollment (student/employee ID verification workflow), and point-of-sale usage
logging (validate a plan + apply discount, then log/cancel/refund the usage).

### Routes

Mount: `apiV1.route("/partnerships", partnershipsRoutes)`, mounted in the **public** block of `app-factory.ts` (comment: "部分公開端點 + 受保護端點"). A later `apiV1.use("/partnerships/*", authMiddleware)` exists in the protected block, but per Hono's registration-order dispatch this only matters if it executes before the already-mounted routes' own terminal handlers — in practice, every route below carries its **own** inline `authMiddleware`/`requireRole`/`moduleGate("loyalty")` except the two explicitly public ones. Treat the per-route middleware as authoritative.

| Method | Full path | Auth | Purpose | Request summary | Response summary |
|---|---|---|---|---|---|
| POST | `/api/v1/partnerships` | bearer, role `[0,1]`, `moduleGate("loyalty")` | Create a partnership | `{...,contractStartDate,contractEndDate}` | `{success,data:Partnership}` |
| GET | `/api/v1/partnerships` | bearer, role `[0,1]`, `moduleGate("loyalty")` | List partnerships (filtered/paginated) | query filters | `{success,data:Partnership[],pagination}` (spread, not nested under `data.data`) |
| GET | `/api/v1/partnerships/:id` | bearer, role `[0,1]`, `moduleGate("loyalty")` | Partnership detail | — | `{success,data:Partnership}` or `notFound` |
| GET | `/api/v1/partnerships/:id/statistics` | bearer, role `[0,1]`, `moduleGate("loyalty")` | Usage statistics (count/discount/revenue/unique members) | — | `{success,data:UsageStatistics}` |
| PUT | `/api/v1/partnerships/:id` | bearer, role `[0,1]`, `moduleGate("loyalty")` | Update partnership | partial fields incl. dates | `{success,data:Partnership}` |
| DELETE | `/api/v1/partnerships/:id` | bearer, role `[0]` (admin only), `moduleGate("loyalty")` | Delete partnership | — | `{success,message}` |
| POST | `/api/v1/partnerships/plans` | bearer, role `[0,1]`, `moduleGate("loyalty")` | Create a discount plan under a partnership | `{...,validFrom,validTo}` | `{success,data:PartnershipPlan}` |
| GET | `/api/v1/partnerships/plans` | bearer (any role) | List plans | query filters | `{success,data,pagination}` |
| GET | `/api/v1/partnerships/plans/:planId` | bearer (any role) | Plan detail | — | `{success,data:PartnershipPlan}` or `notFound` |
| POST | `/api/v1/partnerships/plans/validate` | **public** (CSRF-excluded per app-factory comment "Public plan validation for cashiers") | Validate a plan + member + order amount, compute discount | `{planId,memberId,orderAmount,menuItems?,categories?}` | `{success,data:PlanValidationResult}` |
| PUT | `/api/v1/partnerships/plans/:planId` | bearer, role `[0,1]`, `moduleGate("loyalty")` | Update plan | partial fields incl. dates | `{success,data:PartnershipPlan}` |
| DELETE | `/api/v1/partnerships/plans/:planId` | bearer, role `[0,1]`, `moduleGate("loyalty")` | Delete plan | — | `{success,message}` |
| POST | `/api/v1/partnerships/members/verify` | **public** (self-service applicant submission, CSRF-excluded) | Submit member verification application | `MemberVerificationRequest` | `{success,data:VerifiedMember,message}` |
| GET | `/api/v1/partnerships/members` | bearer, role `[0,1]`, `moduleGate("loyalty")` | List members | query filters | `{success,data,pagination}` |
| GET | `/api/v1/partnerships/members/:memberId` | bearer, role `[0,1]`, `moduleGate("loyalty")` | Member detail | — | `{success,data:VerifiedMember}` or `notFound` |
| POST | `/api/v1/partnerships/members/:memberId/approve` | bearer, role `[0,1]`, `moduleGate("loyalty")` | Approve member verification | `{verificationExpiry?}` | `{success,data:VerifiedMember,message}` |
| POST | `/api/v1/partnerships/members/:memberId/reject` | bearer, role `[0,1]`, `moduleGate("loyalty")` | Reject member verification | `{rejectionReason}` | `{success,data:VerifiedMember,message}` |
| PUT | `/api/v1/partnerships/members/:memberId` | bearer, role `[0,1]`, `moduleGate("loyalty")` | Update member record | partial fields | `{success,data:VerifiedMember}` |
| POST | `/api/v1/partnerships/usage` | bearer, role `[0,1,4]` (cashier included), `moduleGate("loyalty")` | Log a usage event (POS-side, after `plans/validate`) | `LogUsageInput` | `{success,data:PartnershipUsageLog,message}` |
| GET | `/api/v1/partnerships/usage` | bearer, role `[0,1]`, `moduleGate("loyalty")` | List usage logs | query filters incl. `startDate/endDate` | `{success,data,pagination}` |
| POST | `/api/v1/partnerships/usage/:id/cancel` | bearer, role `[0,1]`, `moduleGate("loyalty")` | Cancel a usage log | `{reason}` | `{success,data:PartnershipUsageLog,message}` |
| POST | `/api/v1/partnerships/usage/:id/refund` | bearer, role `[0,1]`, `moduleGate("loyalty")` | Refund a usage log | — | `{success,data:PartnershipUsageLog,message}` |

### Business logic

All business logic lives in `packages/database/src/services/PartnershipService.ts` (Layer 1/2 Drizzle, the API route handlers are thin pass-throughs):

- **Money representation duality**: every entity (`partnerships`, `partnershipPlans`, `verifiedMembers`, `partnershipUsageLogs`) is persisted with `*Cents`/`*PercentageBps` integer columns, but the service's public methods also accept legacy float `discountValue`/`totalDiscountGiven`/`totalRevenue`/`maxDiscountAmount`/`minOrderAmount`/`maxOrderAmount`/`totalSpending`/`totalDiscountReceived` fields and convert them via `toCents`/`toRequiredCents`/`toPercentageBps`/`fromCents`/`percentageFromBps` (`packages/database/src/utils/money.ts`) — the `to*Insert` helper methods strip the float fields back out before the Drizzle insert/update so only the cents/bps columns are ever actually written. **Route-level validation schemas** (`createPartnershipSchema` etc., not fully read in this pass) presumably decide which shape callers actually send.
- **`validatePlan`** (the core discount-computation function, used by both the public `POST /plans/validate` and internally before `POST /usage`): sequential rule checks — plan `isActive`, `validFrom/validTo` window, member exists and `status === "verified"`, per-day usage cap (`usageLimitPerDay` vs. `dailyUsageCount`), per-member usage cap (`usageLimitPerMember`, counted live via a `partnershipUsageLogs` count query scoped to `status="completed"`), min/max order-amount bounds, day-of-week (`applicableDays`) and time-of-day (`applicableTimeSlots`, string `"HH:MM"` comparison) restrictions — then computes the discount by `discountType`: `percentage` (bps-based, capped by `maxDiscountAmountCents` if set), `fixed` (flat cents value), or `special_price` (order amount minus a target price, floored at 0). Discount is always clamped to not exceed the order amount; returns `{valid,plan,discountAmount,finalAmount,canCombineWithOthers:{coupons,promotions}}`. All failure paths return `{valid:false,error:<zh-TW string>}` rather than throwing — the route handler always responds 200 with `success:true` even when `data.valid === false` (validation failure is a business-logic result, not an HTTP error).
- **Member lifecycle**: `submitMemberVerification` inserts `status:"pending"`; `approveMember`/`rejectMember` are direct status flips (no re-validation of the underlying documents — verification-method/document review is presumably manual/out-of-band); `isMemberVerificationExpired` is a pure helper (not wired into `validatePlan` itself — an expired-but-still-`"verified"`-status member would currently still pass validation, since `validatePlan` only checks `status === "verified"`, not the expiry date. **Worth flagging**: this looks like a real logic gap, not an intentional design choice, given the dedicated helper exists but isn't called from the one place that would need it.)
- **Usage logging**: `logUsage` stores the already-computed discount/original/final amounts (converted to cents) plus `verifiedByUserId` (the cashier); `cancelUsageLog`/`refundUsageLog` are simple status+timestamp updates, no reversal of `dailyUsageCount`/aggregate totals on the plan or member row (i.e. cancelling a usage does not appear to decrement `partnershipPlans.dailyUsageCount` or `verifiedMembers.totalSpendingCents`, which the underlying schema tracks — **not verified further in this pass**, since the increment side of those aggregate columns wasn't found in this service file either; likely maintained by DB triggers, matching the "coupons table has `_cents` triggers" pattern noted elsewhere in this codebase's memory).
- **Pagination**: `listUsageLogs` supports both offset pagination (default) and cursor pagination (`paginateWithCursor` helper, `packages/database/src/utils/pagination-helpers.ts`) when a `cursor` filter is supplied — the two pagination styles coexist in one method rather than being separate endpoints.
- **`resetDailyUsageCounts`**: a maintenance method (`UPDATE ... SET dailyUsageCount = 0 WHERE 1=1`, i.e. all rows) intended to run as a scheduled job — **not called from any route in this feature module**, so whatever triggers the daily reset lives outside this read set (cron Worker, out of scope).

### Data

- **D1 tables** (`packages/database/src/schema/partnerships/partnerships.ts`): `partnerships`, `partnershipPlans`, `verifiedMembers`, `partnershipUsageLogs` — all money columns are `*Cents`/`*PercentageBps` integers per the repo's money-cents convention; relations (`with: {partnership, restaurant}` etc.) are Drizzle relational queries, not manual joins.
- No KV, no R2. No external calls (no Slack/webhook in this module).

### Cross-module dependencies

- `moduleGate("loyalty")` ties every write/admin route to the billing/subscription module-gating system, same mechanism as Analytics/Forecast/AI Analytics/Integrations.
- Shares the `packages/database/src/utils/money.ts` cents/bps conversion helpers and `paginateWithCursor` helper with (at least) the Market Checkout / coupon features referenced in project memory (`market_checkout_voucher.md`) — not verified further here, out of scope.
- `POST /usage` is meant to be called by POS/cashier flows (role 4 included) immediately after `POST /plans/validate` succeeds — the two-step validate-then-log pattern mirrors the coupon-validation flow elsewhere in the API (per `app-factory.ts`'s CSRF-exclusion comments grouping `coupons/validate` and `partnerships/plans/validate` together).

### Rust rewrite notes

- **The member-verification-expiry gap is worth fixing, not just porting**: `validatePlan` should check `isMemberVerificationExpired`-equivalent logic (`verificationExpiry < now`) alongside `status === "verified"` — confirm intended behavior with product before deciding whether the Rust port keeps the current (arguably buggy) behavior or closes the gap.
- Money duality (float fields on the public API surface, cents/bps internally) is well-isolated behind small conversion helpers (`toCents`/`fromCents`/`toPercentageBps`/`percentageFromBps`) — port these as a single shared money module rather than re-deriving per field, and confirm which of the two representations the actual request schemas send today (this pass didn't open `schemas/validation.ts` to confirm) before deciding whether the Rust API even needs to accept both shapes.
- `resetDailyUsageCounts()` has no caller in this feature — locate the actual cron/scheduled invocation (likely `apps/backup-scheduler` or a management-api cron) before porting, so the Rust service doesn't silently drop daily-counter resets.
- Cancel/refund of a usage log doesn't visibly reverse aggregate counters in this service file — verify whether DB triggers handle it (as the codebase does elsewhere for coupons) before assuming the Rust port needs to replicate reversal logic in application code versus relying on equivalent database triggers/constraints.
- The `POST /plans/validate` "always 200, `valid:false` in the payload for business-rule failures" pattern should be preserved deliberately in the Rust port (don't "fix" it into an HTTP 4xx, since cashier UIs likely branch on `data.valid` rather than HTTP status).
- Route-level auth for this module currently works because every route declares its own middleware chain — when porting to Rust, gate at the route/handler level explicitly rather than relying on any global "mount order" trick, since that behavior is a Hono implementation detail (see the shared note at the top of this document) that a Rust framework will not necessarily replicate.

---

## Cross-cutting observations (all 10 modules)

- **Four incompatible encryption implementations** exist across this domain alone: Backup (`BackupStorageService`, PBKDF2+salt `"makanmakan-backup-salt-v1"`, unused in practice), `packages/utils/encryption.ts` (PBKDF2+configurable salt, `iv:ciphertext` colon format — used directly by AI Analytics' `AIAnalyticsService.ts:16` `import { encrypt, decrypt } from "@makanmasak/utils"` with a caller-supplied salt; also the most "official" one), AI Analytics/Forecast (PBKDF2+fixed salt `"makanmakan-api-key-encryption-salt"`, colon format, real production use for LLM API keys), and Integrations (SHA-256-digest key, no salt, no separator, real production use for platform OAuth secrets). A Rust rewrite should consolidate to one AEAD scheme with an explicit migration plan for existing encrypted columns, not port all four verbatim.
- **Response envelope drift**: Backup/Monitoring's `/health` endpoints, Integrations' entire admin surface, and the AI Analytics module's top-level `report`/`products`/`usage` fields all deviate from the unified `{success,data}`/`{success,error:{code,message}}` shape mandated in `CLAUDE.md`. Decide per-module whether the Rust port normalizes these (breaking existing client parsing unless coordinated) or preserves them intentionally.
- **`orders.status` literal `"completed"` does not exist** in the schema (confirmed by an explicit code comment in `packages/database/src/services/analytics.ts`) yet is used as a filter literal in `packages/ai-analytics/src/services/AIInsightsService.ts` (raw SQL) and `ProductAnalysisService.ts` (Drizzle `eq`) — both likely return zero/incorrect rows in production today. Verify actual behavior against a real database before porting either of those two files' queries as reference implementations.
- **Layer-3 raw SQL** (banned for new code per `CLAUDE.md`) still exists in this domain: Backup's dynamic table extraction (justified — dynamic table names can't be Layer-1/2), Audit's single insert (no dynamic identifiers — should be Drizzle in a port), AI Analytics' `AIInsightsService.gatherBusinessMetrics` (unjustified — appears to be stale/broken and should be rebuilt as Layer 2), and Forecast's `AIForecastEnhancer` credential lookup (should reuse `AIAnalyticsService.getLLMConfig` instead of a parallel raw query).
- **Several process-level singletons** (`MonitoringService`, `CacheService`, `PlatformIntegrationService` — no, that one is constructed per-request; specifically `MonitoringService`/`CacheService`) hold in-memory state that is only durable via KV — fine for a single Worker isolate's request lifetime, but any Rust rewrite targeting a similar edge-isolate model needs the same "KV/DB is truth, in-memory is a cache" discipline; if the Rust target is a longer-lived process (not per-request isolates), the concurrency model changes materially and these singletons' assumptions need re-examination.
