# `apps/backup-scheduler` — Standalone Backup Cron Worker

> Part of the Backend-Rust-refactor documentation set. See [README.md](README.md).

## Purpose & the unusual deployment shape

`apps/backup-scheduler` is a **separately deployed Cloudflare Worker with no
source tree of its own**. The app directory contains only `wrangler.toml`,
`package.json`, and `turbo.json`; its entry point is
`main = "../../apps/api/src/workers/backup-scheduler.ts"`
(`apps/backup-scheduler/wrangler.toml:5`) — a file physically inside
`apps/api`'s source tree. It runs cron-only work (no HTTP surface): backup
execution, health checks, cleanup, and weekly reports.

The worker code itself (`apps/api/src/workers/backup-scheduler.ts`, 786
lines) and the top-level `apps/api/src/services/BackupService.ts` it uses are
documented in [api-core.md](api-core.md) §6 (scheduled & queue workers) —
including the caveat that several `BackupService` methods there are
`console.log`-only stubs, distinct from the real backup implementation in
`features/backup/` (documented in
[api-features-platform-ops.md](api-features-platform-ops.md)).

## Runtime & bindings (`apps/backup-scheduler/wrangler.toml`)

| Binding | Type | Dev | Production |
| --- | --- | --- | --- |
| `DB` | D1 | `makanmakan-local` | `makanmasak-prod` (`4e3c7ba8-…`) |
| `BACKUP_KV` | KV | `makanmasak-backup-dev` | `0f091e2e…` |
| `BACKUP_STORAGE` | R2 | `makanmasak-backups-dev` | `makanmasak-backups-prod` |
| `ANALYTICS` | Analytics Engine | `makanmasak-backup-metrics-dev` | `makanmasak-backup-metrics-prod` |

Vars: `NODE_ENV`, `LOG_LEVEL` only. No HTTP routes. Production uses smart
placement with an `asia-southeast1` hint (`wrangler.toml:93-96`).

Worker names: `makanmasak-backup-scheduler[-dev|-prod]`.

## Cron triggers → handlers

Dispatch is a `switch` on the **literal cron string** (`event.cron`; the
switch block is `apps/api/src/workers/backup-scheduler.ts:195-216`) — the
case labels must
match `wrangler.toml` byte-for-byte (an in-code comment notes `"SUN"` vs
`"0"`):

| Cron | Handler | What it does |
| --- | --- | --- |
| `*/5 * * * *` | `handleHealthCheck` | Check running backups / system health, write a `backup_health_check` analytics data point; on critical/warning status also creates a System Alert (`createSystemAlert`, `backup-scheduler.ts:286`) throttled by a KV dedup key (`backup-health:last-system-alert:*`, 1 h TTL) so repeat alerts are suppressed |
| `0 */6 * * *` | `handleScheduledBackups` | Execute due scheduled backups via `BackupService` |
| `0 2 * * *` | `handleDailyMaintenance` | Cleanup and retention maintenance (expired-backup delete, audit-log and alert cleanup) **plus** daily metrics aggregation — `aggregateDailyMetrics` (`backup-scheduler.ts:456`) queries the previous day's `backup_records` and writes a `backup_daily_metrics` data point per restaurant |
| `0 0 * * SUN` | `handleWeeklyReports` | Weekly report generation and alerts |

Unknown triggers fall through to a log line. Errors are caught at the top
level and written to Analytics Engine (`backup_scheduler_error` data point);
a failure in one tick does not retry.

## Rust rewrite notes

- **Fold it into the main API crate.** The only thing this "app" adds is a
  second deployed Worker with its own cron strings and bindings; the code
  already lives in `apps/api`. A Rust workspace should either (a) make this a
  feature-gated binary of the API crate, or (b) merge the crons into the main
  API's scheduled handler — decide deliberately; today's split means the two
  workers can run **different code versions** between deploys of the two.
- The string-literal cron dispatch is fragile (silent no-op if wrangler.toml
  and code drift). In Rust, match on a shared enum/constant defined next to
  the trigger registration, or fail loudly on unknown triggers.
- Bindings duplicate `apps/api`'s backup bindings (`BACKUP_KV`,
  `BACKUP_STORAGE`) — same namespaces, so both workers mutate shared state;
  any locking/idempotency must assume the API worker's backup feature and
  this scheduler run concurrently.
- The stub methods in the top-level `BackupService` (`deleteBackup`,
  `saveBackupRecord` — log-only) mean parts of the maintenance path are
  currently no-ops; decide fix-or-drop before porting (README bug inventory
  item 20 covers the related unused encryption/compression flags).
