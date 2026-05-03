# Modular Billing

This document captures the Phase 1 billing gates implemented for the API and
admin dashboard.

## Plan Defaults

Module access starts with `PLAN_DEFAULT_MODULES` in
`packages/database/src/schema/subscriptions.ts`, then applies per-shop
`shop_subscriptions.module_overrides`.

- `basic`: menu, orders, tables, and coupons.
- `pro`: basic modules plus kitchen display, analytics, reservations, waiting
  list, integrations, online ordering, and POS.
- `enterprise`: all current modules, including AI analytics, inventory, and
  staff management.
- `trial`: all current modules until `trial_ends_at_ms`.

`shop_subscriptions.deployment_mode` records whether a shop is platform-managed
or BYOC-hosted. Phase 1 only stores and returns it; later license verification
uses it for BYOC enforcement.

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
