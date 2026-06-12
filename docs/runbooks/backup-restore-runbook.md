# Backup and Restore Runbook

Use this for D1 corruption, accidental destructive migration, missing critical
rows, or a DR exercise.

## Uptime Monitoring

Configure external uptime monitoring against these production targets:

| Target | URL | Cadence | Expected |
| --- | --- | --- | --- |
| Liveness | `https://api.makanmasak.com/api/v1/system/health/live` | 60s | HTTP 200 |
| Readiness | `https://api.makanmasak.com/api/v1/system/health/ready` | 60s | HTTP 200 |
| Uptime evidence | `https://api.makanmasak.com/api/v1/system/health/uptime` | 300s | HTTP 200 and `status: "operational"` |

The API writes the latest uptime evidence to `CACHE_KV` key
`system:uptime:last-check` with a 7-day TTL whenever `/health` or
`/health/uptime` runs. Pull the latest production evidence with:

```bash
rtk pnpm exec wrangler kv key get "system:uptime:last-check" --binding=CACHE_KV --env production --config apps/api/wrangler.toml
```

If an internal monitor calls `MonitoringService.recordUptimeCheck`, it stores
`_uptime_probe:<probe-name>` for 30 days and emits a recent alert with type
`uptime_check_failed` on non-2xx probe results.

## Backup

1. Export the affected database before touching it:

```bash
rtk pnpm exec wrangler d1 export makanmasak-prod --remote --env production --config apps/api/wrangler.toml --output backup-$(date +%Y%m%d-%H%M%S).sql
```

2. Store the export in R2:

```bash
rtk pnpm exec wrangler r2 object put makanmasak-backups-prod/manual/backup-$(date +%Y%m%d-%H%M%S).sql --file <backup-file>.sql
```

3. Record file name, size, timestamp, environment, reason, and operator.

## Restore Drill

Run this on staging or a temporary restore database first. The scheduler helper
in `apps/api/src/workers/backup-scheduler.ts` provides a dry-run command plan
that is covered by `apps/api/src/workers/backup-scheduler.test.ts`.

Dry-run the command plan:

```powershell
rtk pnpm exec tsx -e "import { buildRestoreDrillPlan } from './apps/api/src/workers/backup-scheduler.ts'; console.log(JSON.stringify(buildRestoreDrillPlan({ environment: 'staging', backupFile: 'artifacts/restore-drill.sql', restoreDatabase: 'makanmasak-restore-drill-YYYYMMDD' }), null, 2));"
```

Execute the staging drill:

```bash
rtk pnpm exec wrangler d1 export makanmasak-staging --remote --env staging --config apps/api/wrangler.toml --output artifacts/restore-drill-YYYYMMDD.sql
rtk pnpm exec wrangler d1 create makanmasak-restore-drill-YYYYMMDD
rtk pnpm exec wrangler d1 execute makanmasak-restore-drill-YYYYMMDD --remote --file artifacts/restore-drill-YYYYMMDD.sql
rtk pnpm exec wrangler d1 execute makanmasak-restore-drill-YYYYMMDD --remote --command "SELECT COUNT(*) AS count FROM restaurants;"
rtk pnpm exec wrangler d1 execute makanmasak-restore-drill-YYYYMMDD --remote --command "SELECT COUNT(*) AS count FROM users;"
rtk pnpm exec wrangler d1 execute makanmasak-restore-drill-YYYYMMDD --remote --command "SELECT COUNT(*) AS count FROM menu_items;"
rtk pnpm exec wrangler d1 execute makanmasak-restore-drill-YYYYMMDD --remote --command "SELECT COUNT(*) AS count FROM orders;"
```

Then validate:

- Restaurant count is non-zero.
- Users required for smoke tests exist.
- Menu and order tables query successfully.
- The evidence key is `restore-drills/staging/makanmasak-restore-drill-YYYYMMDD`.
- The API can be pointed at the restored DB in a controlled test environment.

The helper refuses production drill execution unless the caller passes
`productionApproval: "RESTORE DRILL APPROVED"`. Production restore still
requires the approval process below.

## Production Restore

Production restore requires explicit operator approval.

1. Freeze writes if possible.
2. Export the current broken database for forensics.
3. Restore into a new D1 database first.
4. Run the validation queries from the restore drill.
5. Update the Worker D1 binding only after restore validation passes.
6. Deploy the binding change.
7. Run smoke tests and key order lifecycle checks.

## RTO/RPO Targets

- Current target RTO: 4 hours.
- Current target RPO: 24 hours until backup frequency and restore drills prove a tighter value.

## Evidence To Keep

- Uptime monitor configuration and latest `system:uptime:last-check` payload.
- Backup object path.
- Restore database ID.
- Restore drill evidence key.
- Validation query output.
- Deploy SHA that switched bindings.
- Smoke test output after restore.
