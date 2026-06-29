# Modular Billing

This document captures the modular billing gates, usage meters, and quota
controls implemented for the API and admin dashboard.

## Plan Defaults

Module access starts with `PLAN_DEFAULT_MODULES` in
`packages/database/src/schema/subscriptions.ts`, then applies per-shop
`shop_subscriptions.module_overrides`.

- `basic`: `menu_management`, `table_management`, `online_ordering` (the 3 core modules; no POS, kitchen display, coupons, analytics, reservations, etc.).
- `pro`: `basic` modules plus `pos`, `kitchen_display`, `receipt_printing`, `coupons`, `reservations`, `analytics`. Waiting-list shares the `reservations` module.
- `enterprise`: every module — `pro` plus `multi_branch`, `ai_analytics`, `platform_integration`, `loyalty`, `inventory`, `staff_management`.
- `trial`: all 15 modules until `trial_ends_at_ms`, after which `TrialReaperService` downgrades the subscription to `basic`.

Deployment mode is not stored on `shop_subscriptions`. The active product model
is platform-managed hosting, with deployment concerns handled by platform
configuration instead of per-shop subscription data.

## API Gates

Use `moduleGate("<module>")` after authentication and before route handlers.
The middleware reads `c.get("user").restaurantId`, loads the subscription from
KV or D1, and returns `403 MODULE_NOT_ENABLED`, `403 TRIAL_EXPIRED`, or
`403 SUBSCRIPTION_NOT_FOUND` when access is blocked.

Current protected prefixes live in `apps/api/src/app-factory.ts`, with coverage
in `apps/api/src/__tests__/module-gate-coverage.test.ts`.

## Frontend Gates

Use `packages/shared/components/ModuleGate.vue` around paid UI surfaces:

```vue
<ModuleGate module="analytics">
  <AnalyticsPanel />
  <template #fallback>
    <UpgradePrompt module="analytics" />
  </template>
  <template #loading>
    <div class="h-32 animate-pulse rounded-lg bg-gray-100" />
  </template>
</ModuleGate>
```

`ModuleGate` uses `useModuleAccess()`, backed by
`packages/shared/stores/moduleAccess.ts`. Apps should fetch module access after
auth is available; admin-dashboard does this during bootstrap and each gate can
render a loading slot while the store is empty.

## Usage Metering

Usage writes are append-only in `usage_events`, then the scheduled
`usage-aggregator` worker rolls them up into per-cycle `usage_meters` rows every
five minutes.

| Meter key | Source | Unit |
| --- | --- | --- |
| `orders.created` | order creation routes | count |
| `api.requests` | global API middleware | count |
| `print.jobs` | receipt generation route | count |
| `ai.requests` | AI analytics routes | count |
| `storage.bytes` | daily storage snapshot from `storage_counters` | bytes |

`storage_counters` tracks the current R2 byte total and image count per
restaurant. The daily `storage-snapshot` worker emits a `storage.bytes` usage
event for each non-empty counter row.

## Quotas

Plan quotas live in `packages/database/src/utils/plan-quotas.ts`. Undefined
means unlimited. `quotaGate()` applies only to request-scoped paid meters:
`orders.created`, `print.jobs`, and `ai.requests`. `api.requests` and
`storage.bytes` are visible in reporting but are not request-blocking gates.

`QUOTA_ENFORCEMENT_MODE` controls behavior:

- `disabled`: bypass quota checks.
- `warn`: return `X-Quota-Warning` after the soft limit.
- `enforce`: return `429 QUOTA_EXCEEDED` at the hard limit.

## Usage APIs

- `GET /api/v1/me/usage` returns the current restaurant cycle and meter
  progress for the authenticated staff user.
- `GET /api/v1/admin/subscriptions/:restaurantId/usage` returns current usage
  plus recent cycle aggregates.
- `GET /api/v1/admin/subscriptions/:restaurantId/usage/events` returns paged
  raw events for debugging and billing disputes.

The admin dashboard exposes this data from the Subscriptions page's Usage tab.
