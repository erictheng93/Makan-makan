# Backup and Restore Runbook

Use this for D1 corruption, accidental destructive migration, missing critical rows, or a DR exercise.

## Backup

1. Export the affected database before touching it:

```bash
wrangler d1 export makanmasak-prod --remote --output backup-$(date +%Y%m%d-%H%M%S).sql
```

2. Store the export in R2:

```bash
wrangler r2 object put makanmasak-backups-prod/manual/backup-$(date +%Y%m%d-%H%M%S).sql --file <backup-file>.sql
```

3. Record file name, size, timestamp, environment, and reason.

## Restore Drill

Run this on staging or a temporary restore database first.

```bash
wrangler d1 create makanmasak-restore
wrangler d1 execute makanmasak-restore --remote --file <backup-file>.sql
```

Then validate:

- Restaurant count is non-zero.
- Users required for smoke tests exist.
- Menu and order tables query successfully.
- API can be pointed at the restored DB in a controlled test environment.

## Production Restore

Production restore requires explicit operator approval.

1. Freeze writes if possible.
2. Export the current broken database for forensics.
3. Restore into a new D1 database first.
4. Update the Worker D1 binding only after restore validation passes.
5. Deploy the binding change.
6. Run smoke tests and key order lifecycle checks.

## RTO/RPO Targets

- Current target RTO: 4 hours.
- Current target RPO: 24 hours until backup frequency and restore drills prove a tighter value.

## Evidence To Keep

- Backup object path.
- Restore database ID.
- Validation query output.
- Deploy SHA that switched bindings.
- Smoke test output after restore.
