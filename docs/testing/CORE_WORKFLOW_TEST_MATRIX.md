# Core Workflow Test Matrix

Last reviewed: 2026-06-08

This matrix documents the minimum regression coverage expected for the apps
that carry customer, shop, kitchen, platform-management, and onboarding
workflows. E2E tests are necessary for browser/runtime issues, but they are not
sufficient by themselves. API contracts, auth boundaries, CORS, persistence, and
response envelope drift must also be locked by faster integration or unit tests.

## Current Coverage

| Module | Smoke | Unit / Component | Real Integration | Real Browser Workflow | Current Risk |
| --- | --- | --- | --- | --- | --- |
| `customer-app` | `tests/e2e/smoke/smoke.spec.ts` | stores, API clients, views, i18n | `apps/customer-app/src/__tests__/integration/customer-app.real.integration.test.ts` | `tests/e2e/integration/real-workflows.spec.ts` covers menu load and guest order tracking against a real API | Medium: cart/checkout UI path is still lighter than direct guest-order API workflow |
| `admin-dashboard` | owner smoke specs under `tests/e2e/smoke` | services, stores, owner/menu/POS/settings views | `apps/admin-dashboard/src/__tests__/integration/admin-dashboard.real.integration.test.ts` | Not yet in `test:e2e:integration` | Medium-high: owner order status and menu mutation need real browser + real API workflow coverage |
| `kitchen-display` | indirect smoke through admin/kitchen API checks | order stores, order card, settings, service-worker helpers | `apps/kitchen-display/src/__tests__/integration/kitchen-display.real.integration.test.ts` | Not yet in `test:e2e:integration` | High: kitchen queue, SSE/realtime, offline recovery, and audio notifications need browser-level workflow coverage |
| `management-portal` | none dedicated | health, tenants, markets, i18n, router | Management API tests are partial; portal service uses `/tenants`, `/deployments`, `/health`, `/licenses`, `/markets` | Not yet in `test:e2e:integration` | High: portal-to-management-api workflows are mostly not exercised end to end |
| `onboarding-app` | none dedicated | API location, onboarding store, i18n | `apps/management-api/src/__tests__/onboarding-workflow.real.integration.test.ts` covers onboarding public API flow | Not yet in `test:e2e:integration` | Medium: public application flow now has API integration coverage, but the actual form journey still needs browser workflow coverage |

## What Was Added From The E2E Finding

- `tests/e2e/integration/real-workflows.spec.ts`: true customer browser
  workflow against a real API, including menu rendering and guest order
  tracking.
- `apps/api/src/middleware/cors.test.ts`: locks the custom request headers
  used by the customer frontend during browser preflight.
- `apps/api/src/middleware/analytics.test.ts`: prevents local workflow runs
  from failing or logging noisy Analytics Engine binding errors.
- `apps/management-api/src/__tests__/onboarding-workflow.real.integration.test.ts`:
  locks the onboarding-app to management-api public contract for subdomain
  checks, application creation, application retrieval, and validation errors.

## Required Next Workflow Tests

1. Admin owner workflow:
   owner login, menu item/category mutation, order list refresh, and order
   status transition against the real API.
2. Kitchen workflow:
   create/confirm an order through the real API, open kitchen-display as a chef,
   see the order enter the queue, transition item status, and verify the API
   state changes.
3. Management portal workflow:
   authenticated portal loads tenants, tenant detail, deployments, health, and
   licenses from management-api without mocked responses.
4. Onboarding browser workflow:
   fill the application form, check subdomain availability, submit, persist the
   application ID, and render the success/next-step state using management-api.
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
