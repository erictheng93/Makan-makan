# Rollback Runbook

Use this when a production or staging deploy causes elevated errors, broken login, failed ordering, failed realtime updates, or failed smoke tests.

## Decision Criteria

Rollback immediately when any of these hold for more than 5 minutes:

- API `/info` or customer app liveness fails.
- Order creation, payment, or kitchen display updates are unavailable.
- Realtime websocket upgrades fail broadly after deploy.
- Error rate or operator-reported impact is high and no fix is ready.

## Steps

1. Freeze further deploys.
2. Identify the affected surface: API Worker, realtime Worker, Pages app, D1 migration, or configuration/secrets.
3. Capture evidence: deploy SHA, workflow URL, Cloudflare deployment ID, first bad timestamp, and failing smoke output.
4. Roll back the affected Worker:

```bash
wrangler deployments list --name <worker-name>
wrangler rollback --name <worker-name> --message "Rollback <incident-id>"
```

5. Roll back affected Pages app from the Cloudflare Pages dashboard to the previous known-good deployment.
6. If a D1 migration is involved, do not manually reverse it in production until the backup/restore runbook has been reviewed for the incident.
7. Re-run smoke checks:

```bash
pnpm run test:smoke:staging
curl --fail "$PRODUCTION_URL/info"
```

8. Record outcome in the incident notes and create a follow-up issue for the forward fix.

## Verification

Rollback is complete only when:

- The previous deployment is active in Cloudflare.
- Public liveness checks pass.
- The originally failing user path is confirmed fixed or mitigated.
- The incident notes include the bad SHA and rollback target.
