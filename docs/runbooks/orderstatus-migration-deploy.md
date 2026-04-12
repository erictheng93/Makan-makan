# OrderStatus Migration Deploy Runbook

**Related:** Issue #9, `docs/superpowers/plans/2026-04-09-orderstatus-unification.md`

## Overview

This runbook covers the one-time deployment of the OrderStatus unification
(numeric enum → string union). The migration changes the wire format of
`order.status` from numeric values (0-6) to string values
("pending"/"confirmed"/.../"refunded") across all services.

## Pre-deploy Checklist

- [ ] PR merged to `main` — all Phase 0-5 commits landed
- [ ] `pnpm typecheck` passes (21/21)
- [ ] `pnpm test` passes — regression test `status-filter-regression.test.ts` is green (11/11)
- [ ] No `OrderLifecycleState` references remain in source
- [ ] No numeric `order.status === N` comparisons remain in production source

## Deploy Strategy: Option C (Natural Reload)

**Decision rationale** (documented in conversation): The transition-period failure
mode (old bundle gets string status → lookup falls through to default UI) is
identical to a pre-existing production bug that has been live for months without
user-visible impact. Engineering a forced-reload mechanism (Option A) requires
a 2-release rollout for a cosmetic, self-healing, bounded-window issue — not
worth the cost for a B2B SaaS with a known staff user base.

## Deploy Sequence

Deploy in this order to minimize the transition window:

```
1. pnpm deploy:staging          # Smoke-test staging first
2. pnpm deploy:prod             # API (Cloudflare Workers) — deploys first
                                 # because frontends depend on API responses
3. Frontend apps deploy automatically via Cloudflare Pages on merge to main
```

### Expected Behavior During Transition (~2-5 min window)

| App | Old Bundle Behavior | Self-Healing Mechanism |
|-----|---------------------|----------------------|
| customer-app | Status icons/colors may show defaults | PWA `autoUpdate` pulls new bundle in background; activates on next navigation |
| kitchen-display | localStorage cache rejected on first load | `offlineService` validator (`typeof === "string"`) triggers one-time API refetch |
| admin-dashboard | Status badges may show raw string | Staff refresh at shift change; no PWA to manage |

## Post-deploy Actions

### Immediate (within 30 minutes)

- [ ] Verify API health: `GET /api/v1/health`
- [ ] Verify an order status update works: create a test order, transition pending → confirmed → preparing
- [ ] Check kitchen-display cache rebuild: verify a kitchen-display tab loads correctly after refresh
- [ ] **Notify restaurant staff** to refresh kitchen-display tabs (one-time)

### Monitoring (24 hours)

- [ ] API 5xx rate stays below 0.5%
- [ ] No Slack alert from error reporting
- [ ] Kitchen-display `orderstate_legacy_migration_total` metric (DO migration counter) — should be low and decreasing
- [ ] Customer support ticket volume — no spike related to "order status not showing"

### 60-day Cleanup

After 60 days post-deploy, the DO lazy migration code in
`apps/realtime/src/advanced-realtime-session.ts` (`migrateDOState` method)
can be deleted. The safety condition is:

- `orderstate_legacy_migration_total` metric has reached zero (no more v1 → v2 coercions happening)
- OR 60 days have elapsed with no incidents

Create a cleanup PR that:
1. Deletes `migrateDOState()` and the `LEGACY_VALUE_MAP` / `PersistedSessionHeader` helper
2. Removes the version check from `loadPersistedState()`
3. Keeps `CURRENT_DO_STATE_VERSION` and `session_version` storage key (future migrations may use them)

## Rollback

If something goes wrong:

1. **API rollback:** `wrangler rollback` — reverts to the previous Worker version. The old Worker still handles string status from the DB correctly (the DB has always stored strings).
2. **Frontend rollback:** Cloudflare Pages supports instant rollback to a previous deployment via the dashboard.
3. **DO state:** The lazy migration is idempotent — rolling back the Worker doesn't corrupt DO state. Already-migrated states (`serving` → `ready`, `completed` → `delivered`) are valid canonical values that the old code also handles.

## Non-Issues (Confirmed Safe)

- **Contract tests:** `.api-contracts-snapshot.json` tracks field names only, not enum values — the migration does not trip contract tests.
- **IndexedDB (customer-app):** `OfflineOrder` does not contain a `status` field — no migration needed.
- **Print agent:** Zero OrderStatus references — unaffected.
- **Backup scheduler / image processor:** Zero OrderStatus references — unaffected.
