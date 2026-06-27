# Production Readiness Security Review

Date: 2026-06-25

Remediation update: 2026-06-27

Scope: repository-level review of the current working tree, focused on pilot/limited production readiness. This is not a full penetration test and does not prove every route is vulnerability-free. The review prioritized deployment gates, authentication, authorization, multi-tenant isolation, browser security, payment flows, and test/security automation.

## Executive Summary

Verdict after remediation: the report findings R-001 through R-008 have been remediated in the working tree and the repository-level release gates run in this pass now pass: `rtk pnpm typecheck`, `rtk pnpm lint`, `rtk pnpm test`, and `rtk pnpm build`. Broad production still requires the deployment-environment gates that cannot be proven from this local workspace alone, including dependency/security scans, authenticated staging smoke, and any required ZAP/Snyk checks against the actual release candidate.

The codebase has several mature controls: Cloudflare Workers deployment separation, production resource checks, JWT secret length checks, token-version invalidation, CSRF middleware, security headers, strict production CORS origins, idempotency middleware for payment retries, and route-level restaurant scoping in major API modules. The material pilot gaps identified in this report have been addressed: staff login rate limiting now enforces per-IP and per-username limits, high-risk admin/management bearer tokens no longer persist in `localStorage`, customer access tokens moved to `sessionStorage`, admin payment redirects are validated before navigation, payment idempotency keys are mandatory, frontend CSP is served from Pages headers without `unsafe-eval`, E2E/coverage gates are blocking, and smoke/real workflow suites support strict mode that fails on missing staging credentials or fixtures.

The final pass also resolved schema/test drift that blocked a clean release signal: API auth/realtime/payment tests now use UUID-v7 staff principals and string order IDs, fresh migrations keep `orders.id` as text during the customer-identity rebuild, database policy inventory no longer tracks completed UUID primary-key migrations, and scheduling/POS/order fixtures now align with text user/order foreign keys.

## Remediation Summary

| ID | Status | Remediation evidence |
| --- | --- | --- |
| R-001 | Resolved for pilot | Slack deployment secret remains optional; runtime Slack alerts still send when configured. |
| R-002 | Resolved | `AuthService.login()` enforces per-IP and per-username failed-login limits before password verification, with regression coverage in `AuthService.test.ts`. |
| R-003 | Resolved for pilot | Admin access tokens use memory-only auth-client storage; management portal tokens use `sessionStorage`; customer access tokens use `sessionStorage`; refresh tokens are not persisted in browser storage. |
| R-004 | Resolved | Admin payment redirects pass through `safeExternalHref()` and reject non-HTTP(S) URLs before navigation. |
| R-005 | Resolved | Payment creation routes require `Idempotency-Key`; admin payment creation always sends a unique key. |
| R-006 | Resolved | Customer/admin frontend CSP moved out of HTML meta tags and into Pages headers with `frame-ancestors 'none'` and no `unsafe-eval`, covered by production-config tests. |
| R-007 | Resolved | CI coverage and E2E jobs are blocking; staging smoke runs in strict mode. |
| R-008 | Resolved | Smoke and real workflow suites now convert env/fixture skips into failures when `SMOKE_STRICT=1` or `WORKFLOW_STRICT=1`. |

## Critical / Blocker

### R-001: Slack Alerting Requirement Disabled for Pilot

Severity: Resolved for pilot deployment

Location: `scripts/check-production-config.cjs`; `tests/unit/check-production-config.test.ts`

Evidence: the production config gate no longer lists `SLACK_WEBHOOK_URL` as a required deployment secret. The focused unit test now asserts that missing Slack alerting does not block pilot production deploys.

Impact: pilot deployments are no longer blocked by Slack setup. Runtime Slack notifications remain optional: services still send Slack alerts when `SLACK_WEBHOOK_URL` is configured.

Follow-up: before broad production, decide whether Slack or another alert channel should become mandatory again.

### R-002: Staff Login Rate Limiting Is a Stub

Severity: Resolved

Location: `apps/api/src/features/authentication/services/AuthService.ts:74`, `apps/api/src/features/authentication/services/AuthService.ts:1049`

Evidence after remediation: `login()` checks rate limits before calling the database auth service. Failed attempts are counted for both `failed-login:{username}:{ip}` and `failed-login:{username}`, with thresholds for IP and username. Rate-limited attempts return an authentication failure without password verification and log an `ACCOUNT_LOCKED` security event.

Impact: staff, owner, and admin passwords can be brute-forced at application level unless an external Cloudflare rule is configured and verified. This is especially risky for a restaurant pilot where shared devices and weak operational passwords are common.

Verification: `rtk pnpm exec vitest run apps/api/src/features/authentication/services/AuthService.test.ts`.

## High Priority

### R-003: Browser Bearer Tokens Are Stored in `localStorage`

Severity: Resolved for pilot

Locations:

- `packages/auth-client/src/storage.ts:24`
- `apps/admin-dashboard/src/services/api.ts:31`
- `apps/customer-app/src/stores/auth.ts:54`
- `apps/management-portal/src/services/auth.ts:16`

Evidence after remediation: the shared auth client supports memory-only access token storage and the admin dashboard uses it. Management portal tokens are stored in `sessionStorage`, not `localStorage`. Customer access tokens also moved to `sessionStorage`. Refresh tokens continue to be handled by HttpOnly cookies / non-persistent token manager behavior.

Impact: any XSS in the same origin can exfiltrate admin/customer/session tokens. The current CSP also permits `unsafe-inline`/`unsafe-eval` in frontend HTML, reducing defense-in-depth.

Verification: `rtk pnpm exec vitest run packages/auth-client/src/storage.test.ts apps/admin-dashboard/src/stores/auth.test.ts apps/admin-dashboard/src/services/realtimeService.test.ts apps/admin-dashboard/src/services/websocketService.test.ts`; `rtk pnpm --filter @makanmakan/management-portal test -- src/services/auth.test.ts src/views/LoginView.test.ts`; customer auth/market tests.

### R-004: Admin Payment Redirect Uses Backend URL Without Client-Side URL Validation

Severity: Resolved

Location: `apps/admin-dashboard/src/components/payment/PaymentForm.vue:350`

Evidence after remediation: admin payment redirects now call `safeExternalHref()` before assigning `window.location.href`. Non-HTTP(S), malformed, and relative URLs are rejected and routed through the existing payment error flow.

Impact: a compromised or incorrectly validated backend/provider response could drive an open redirect or a `javascript:`/non-web scheme navigation. Payment flows are high-trust UX surfaces.

Verification: `rtk pnpm exec vitest run apps/admin-dashboard/src/utils/safeExternalHref.test.ts`.

### R-005: Payment Idempotency Key Is Optional

Severity: Resolved

Location: `apps/api/src/features/payments/routes/index.ts:190`

Evidence after remediation: both payment creation routes use `idempotencyMiddleware({ scope: "payment", requireKey: true, ... })`. The admin payment store sends a unique `Idempotency-Key` on every payment creation request.

Impact: retry, double-click, mobile reconnect, or Cloudflare retry scenarios can create duplicate payment attempts unless downstream provider idempotency fully compensates.

Verification: `rtk pnpm exec vitest run apps/api/src/features/payments/routes/index.test.ts apps/admin-dashboard/src/stores/payment.test.ts`.

## Medium Priority

### R-006: Frontend CSP Is Weaker Than the API CSP

Severity: Resolved

Locations:

- `apps/customer-app/index.html:11`
- `apps/admin-dashboard/index.html:10`

Evidence after remediation: customer/admin HTML templates no longer ship CSP meta tags. CSP is served from Cloudflare Pages `_headers` with `script-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, and no `unsafe-eval`.

Impact: CSP will not strongly contain XSS. This compounds the `localStorage` token risk.

Verification: production-config tests for customer, admin, and kitchen apps.

### R-007: Security and E2E Gates Are Not Fully Blocking

Severity: Resolved

Locations:

- `.github/workflows/test.yml:188` to `.github/workflows/test.yml:196`
- `package.json:93`
- `.github/workflows/osv-scanner.yml:14`

Evidence after remediation: the main CI workflow no longer marks coverage or E2E as `continue-on-error`. The staging deploy job already requires staging secrets before deploy/smoke and now runs smoke with strict mode.

Impact: regressions in browser flows or dynamic security checks may not stop a production release.

Verification: `.github/workflows/test.yml` static inspection; OSV workflow remains configured for PR, merge queue, push, and schedule.

### R-008: Many Real Workflow Tests Skip Without Staging Credentials or Fixtures

Severity: Resolved

Location: `tests/e2e/smoke/*`, `tests/e2e/integration/real-workflows.spec.ts`

Evidence after remediation: `tests/e2e/smoke/smoke.spec.ts` and `tests/e2e/integration/real-workflows.spec.ts` now use strict-mode skip helpers. With `SMOKE_STRICT=1` or `WORKFLOW_STRICT=1`, missing credentials, URLs, or fixtures fail the suite instead of producing a green run with skipped coverage.

Impact: a local or CI green result may not mean key pilot flows were exercised. For pilot, the most important flows are guest QR order, kitchen receive/update, cashier payment close, owner order/menu management, and admin restaurant switching.

Verification: static inspection of strict-mode helpers and staging workflow env.

## Positive Findings

- Production API CORS is explicit: `apps/api/wrangler.toml:253` sets `CORS_ORIGIN = "https://makanmasak.com"`.
- API auth middleware checks `JWT_SECRET` length and rejects tokens for inactive users or token-version mismatches.
- Major routes reviewed for users, orders, tables, and seats include restaurant scoping checks for non-admin users.
- Payments have idempotency middleware in place; the remaining issue is making keys mandatory.
- Customer market checkout redirect uses `safeExternalHref()` before navigation.
- OSV dependency scanning is configured for PR, merge queue, push, and schedule.

## Pilot Go / No-Go

Recommended decision after remediation: report remediation is complete for the reviewed repository state. A pilot release can proceed once the release candidate also passes environment-specific deployment gates against staging:

- only onboard named restaurants with test-aware agreements;
- keep admin/owner account creation controlled by the team;
- keep Cloudflare WAF/rate rules enabled for auth endpoints as defense in depth;
- require two-factor or strong password policy for owner/admin accounts;
- run `check:prod-config`, build, real-integration, and pilot smoke tests before every deploy;
- monitor auth failures, payment retries, order creation errors, and WebSocket disconnects daily.

## Verification Performed

- `rtk pnpm exec vitest run apps/api/src/features/authentication/services/AuthService.test.ts apps/api/src/features/payments/routes/index.test.ts apps/admin-dashboard/src/stores/payment.test.ts apps/admin-dashboard/src/utils/safeExternalHref.test.ts apps/admin-dashboard/src/tests/production-config.test.ts apps/customer-app/src/tests/production-config.test.ts apps/kitchen-display/tests/production-config.test.ts packages/auth-client/src/storage.test.ts apps/admin-dashboard/src/stores/auth.test.ts apps/admin-dashboard/src/services/realtimeService.test.ts apps/admin-dashboard/src/services/websocketService.test.ts`
- `rtk pnpm --filter @makanmakan/management-portal test -- src/services/auth.test.ts src/views/LoginView.test.ts`
- `rtk pnpm exec vitest run apps/customer-app/src/tests/stores/auth.test.ts apps/customer-app/src/tests/utils/market-engagement.test.ts apps/customer-app/src/tests/views/markets-view.test.ts apps/customer-app/src/tests/views/market-detail-view.test.ts`
- `rtk pnpm exec vitest run tests/unit/database-primary-key-policy.test.ts apps/api/src/middleware/auth.test.ts apps/api/src/features/realtime/routes/index.test.ts apps/api/src/features/payments/schemas/validation.test.ts packages/database/src/customer-identity-preflight.test.ts packages/database/src/schema/markets.test.ts packages/database/src/services/POSService.test.ts packages/database/src/services/order.test.ts packages/database/src/services/__tests__/SchedulingService.real.test.ts apps/api/src/features/leaves/index.test.ts apps/api/src/features/scheduling/index.test.ts apps/api/src/features/system/index.test.ts apps/api/src/features/tables/index.test.ts`
- `rtk pnpm typecheck`
- `rtk pnpm lint`
- `rtk pnpm test` (342 files / 2284 tests passed)
- `rtk pnpm build`
- Static verification that the old report evidence no longer exists for payments `requireKey: false`, admin raw payment redirect, frontend CSP meta tags / `unsafe-eval`, CI `continue-on-error`, and admin/customer/management access-token `localStorage` reads/writes.

Not run in this remediation pass: Playwright smoke against a live staging deployment, Snyk, OSV, or ZAP. Those remain release-candidate gates before promoting a real deployment.
