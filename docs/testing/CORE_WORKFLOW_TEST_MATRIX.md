# Core Workflow Test Matrix

Last reviewed: 2026-06-08

This matrix documents the minimum regression coverage expected for the apps
that carry customer, shop, kitchen, platform-management, and onboarding
workflows. E2E tests are necessary for browser/runtime issues, but they are not
sufficient by themselves. API contracts, auth boundaries, CORS, persistence, and
response envelope drift must also be locked by faster integration or unit tests.
The real browser workflow suite is run through `test:e2e:integration`.

## Current Coverage

| Module | Smoke | Unit / Component | Real Integration | Real Browser Workflow | Current Risk |
| --- | --- | --- | --- | --- | --- |
| `customer-app` | `tests/e2e/smoke/smoke.spec.ts` | stores, API clients, views, i18n | `apps/customer-app/src/__tests__/integration/customer-app.real.integration.test.ts` | `tests/e2e/integration/real-workflows.spec.ts` covers menu load, UI cart/checkout submission, and guest order tracking against a real API | Medium-low: market checkout and service booking still need real browser workflows |
| `admin-dashboard` | owner smoke specs under `tests/e2e/smoke` | services, stores, owner/menu/POS/settings views | `apps/admin-dashboard/src/__tests__/integration/admin-dashboard.real.integration.test.ts` | `tests/e2e/integration/real-workflows.spec.ts` includes owner order-list visibility and browser-triggered order status update for a real API-created order when `WORKFLOW_ADMIN_URL` and owner credentials are set | Medium: menu item/category mutation still needs real browser + real API workflow coverage |
| `kitchen-display` | indirect smoke through admin/kitchen API checks | order stores, order card, settings, service-worker helpers | `apps/kitchen-display/src/__tests__/integration/kitchen-display.real.integration.test.ts` | `tests/e2e/integration/real-workflows.spec.ts` includes confirmed-order queue visibility and browser-triggered item transition to preparing when `WORKFLOW_KITCHEN_URL` and chef credentials are set | High: SSE/realtime binding, offline recovery, and audio notifications still need browser-level workflow coverage |
| `management-portal` | none dedicated | health, tenants, markets, i18n, router | Management API tests are partial; portal service uses `/tenants`, `/deployments`, `/health`, `/licenses`, `/markets` | `tests/e2e/integration/real-workflows.spec.ts` includes management health and tenants page API loading when `WORKFLOW_MANAGEMENT_PORTAL_URL` and `WORKFLOW_MANAGEMENT_TOKEN` are set | Medium: tenant detail, deployments, licenses, and market workflows still need real browser coverage |
| `onboarding-app` | none dedicated | API location, onboarding store, i18n | `apps/management-api/src/__tests__/onboarding-workflow.real.integration.test.ts` covers onboarding public API flow | `tests/e2e/integration/real-workflows.spec.ts` includes the application form submission path when `WORKFLOW_ONBOARDING_URL` and `WORKFLOW_MANAGEMENT_API_URL` are set | Medium-low: Cloudflare verification and completion still need controlled integration coverage |

## What Was Added From The E2E Finding

- `tests/e2e/integration/real-workflows.spec.ts`: true customer browser
  workflow against a real API, including menu rendering and guest order
  tracking. The suite now also includes customer UI cart/checkout,
  admin-dashboard order list/status update, kitchen-display confirmed queue
  visibility/item transition, management-portal health and tenant list loading,
  and onboarding-app application form submission.
- `apps/api/src/middleware/cors.test.ts`: locks the custom request headers
  used by the customer frontend during browser preflight.
- `apps/api/src/middleware/analytics.test.ts`: prevents local workflow runs
  from failing or logging noisy Analytics Engine binding errors.
- `apps/management-api/src/__tests__/onboarding-workflow.real.integration.test.ts`:
  locks the onboarding-app to management-api public contract for subdomain
  checks, application creation, application retrieval, and validation errors.

## Required Next Workflow Tests

1. Admin owner workflow:
   menu item/category mutation against the real API.
2. Kitchen workflow:
   SSE/realtime binding, offline recovery, and audio notification browser paths.
3. Management portal workflow:
   authenticated portal loads tenant detail, deployments, licenses, and markets
   from management-api without mocked responses.
4. Onboarding browser workflow:
   Cloudflare verification and completion need controlled integration coverage;
   the application form submission path is now covered.
5. Realtime integration:
   run API plus realtime worker bindings together so order broadcasts do not
   degrade to local binding warnings during full workflow tests.

## Test Placement Rule

- Use unit tests for pure transformation, validation, stores, and rendering
  branches.
- Use real integration tests for API route contracts, auth/role boundaries,
  database persistence, CORS, and response envelopes.
- Use real browser workflow tests only for critical user journeys and runtime
  behavior that unit/integration tests cannot prove: routing, browser CORS,
  local/session storage, service workers, realtime/SSE, and visible UI state.
