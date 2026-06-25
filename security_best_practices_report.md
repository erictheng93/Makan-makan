# Production Readiness Security Review

Date: 2026-06-25

Scope: repository-level review of the current `C:\Code\Makan-makan` working tree, focused on pilot/limited production readiness. This is not a full penetration test and does not prove every route is vulnerability-free. The review prioritized deployment gates, authentication, authorization, multi-tenant isolation, browser security, payment flows, and test/security automation.

## Executive Summary

Verdict: not ready for broad production. For a controlled pilot with a few partner restaurants, it is close enough only if the high-priority items below are fixed or explicitly accepted with compensating operational controls.

The codebase has several mature controls: Cloudflare Workers deployment separation, production resource checks, JWT secret length checks, token-version invalidation, CSRF middleware, security headers, strict production CORS origins, idempotency middleware for payment retries, and route-level restaurant scoping in major API modules. However, several gaps remain material for even a pilot: the production config gate currently fails, staff login rate limiting is a stub, browser bearer tokens are stored in `localStorage`, admin payment redirects are not client-side validated, some security/test gates remain non-blocking, and many real workflow tests are skipped when staging credentials or fixtures are absent.

## Critical / Blocker

### R-001: Production Deploy Gate Currently Fails

Severity: Critical for production deployment

Location: `scripts/check-production-config.cjs`; `apps/api/wrangler.toml`

Evidence: `rtk pnpm run check:prod-config` failed with:

```text
[check-production-config] Production deploy blocked.
apps/api/wrangler.toml:1 missing deployment secret: SLACK_WEBHOOK_URL
```

Impact: the current repository-defined production gate will block deployment. If bypassed manually, the team loses a safety mechanism meant to verify production resources, runtime URLs, and required deployment secrets.

Fix: configure `SLACK_WEBHOOK_URL` as a deployment secret, or adjust `scripts/check-production-config.cjs` if Slack is intentionally optional for pilot deployments. Do not bypass the gate silently.

### R-002: Staff Login Rate Limiting Is a Stub

Severity: High, Critical if admin/staff login is internet-exposed without Cloudflare WAF/rate rules

Location: `apps/api/src/features/authentication/services/AuthService.ts:74`, `apps/api/src/features/authentication/services/AuthService.ts:1049`

Evidence: `login()` calls `checkRateLimit(...)`, but `checkRateLimit()` only logs:

```ts
private async checkRateLimit(
  identifier: string,
  operation: string,
): Promise<void> {
  // Implementation would check rate limits
  // For now, just log the check
  this.logger.debug("Rate limit check", { identifier, operation });
}
```

Failed attempts are stored in cache at `logFailedLoginAttempt()`, but no enforcement path was found in the reviewed code.

Impact: staff, owner, and admin passwords can be brute-forced at application level unless an external Cloudflare rule is configured and verified. This is especially risky for a restaurant pilot where shared devices and weak operational passwords are common.

Fix: enforce per-IP plus per-username throttling on `/api/v1/auth/login`, with escalating lockout or challenge. Add tests for lockout and reset behavior.

## High Priority

### R-003: Browser Bearer Tokens Are Stored in `localStorage`

Severity: High for admin/management tokens; Medium for short-lived guest/customer tokens

Locations:

- `packages/auth-client/src/storage.ts:24`
- `apps/admin-dashboard/src/services/api.ts:31`
- `apps/customer-app/src/stores/auth.ts:54`
- `apps/management-portal/src/services/auth.ts:16`

Evidence: the shared auth client persists bearer tokens via `localStorage`. The management portal also stores `management_token` in `localStorage`.

Impact: any XSS in the same origin can exfiltrate admin/customer/session tokens. The current CSP also permits `unsafe-inline`/`unsafe-eval` in frontend HTML, reducing defense-in-depth.

Fix: for staff/admin/management sessions, move toward HttpOnly session or refresh cookies with memory-only access tokens. For pilot, keep tokens short-lived, enforce CSP tightening, and isolate admin/management origins from public customer surfaces.

### R-004: Admin Payment Redirect Uses Backend URL Without Client-Side URL Validation

Severity: High if any attacker-influenced payment provider response can set `redirectUrl`

Location: `apps/admin-dashboard/src/components/payment/PaymentForm.vue:350`

Evidence:

```ts
} else if (result.redirectUrl) {
  window.location.href = result.redirectUrl;
}
```

The customer market checkout path uses `safeExternalHref()` before redirecting, but that helper only checks `http:`/`https:` protocol and the admin payment component does not use it.

Impact: a compromised or incorrectly validated backend/provider response could drive an open redirect or a `javascript:`/non-web scheme navigation. Payment flows are high-trust UX surfaces.

Fix: centralize redirect validation. At minimum reject non-HTTP(S) URLs on client and server; preferably allowlist known payment provider hosts.

### R-005: Payment Idempotency Key Is Optional

Severity: High for payment reliability and double-charge prevention

Location: `apps/api/src/features/payments/routes/index.ts:190`

Evidence: both payment creation routes use `idempotencyMiddleware(... requireKey: false ...)`; the code comment says the admin frontend does not always send a key yet.

Impact: retry, double-click, mobile reconnect, or Cloudflare retry scenarios can create duplicate payment attempts unless downstream provider idempotency fully compensates.

Fix: update clients to always send an `Idempotency-Key`, then flip payment routes to `requireKey: true`.

## Medium Priority

### R-006: Frontend CSP Is Weaker Than the API CSP

Severity: Medium, High if user-generated content or rich HTML grows

Locations:

- `apps/customer-app/index.html:11`
- `apps/admin-dashboard/index.html:10`

Evidence: frontend meta CSP includes `script-src 'self' 'unsafe-inline' 'unsafe-eval' ...`. Meta CSP also cannot enforce all directives that headers can, such as `frame-ancestors`.

Impact: CSP will not strongly contain XSS. This compounds the `localStorage` token risk.

Fix: move CSP to Cloudflare Pages response headers where possible, remove `unsafe-eval`, reduce inline script reliance, and add `frame-ancestors 'none'` at the edge.

### R-007: Security and E2E Gates Are Not Fully Blocking

Severity: Medium

Locations:

- `.github/workflows/test.yml:188` to `.github/workflows/test.yml:196`
- `package.json:93`
- `.github/workflows/osv-scanner.yml:14`

Evidence: main CI has E2E configured as non-blocking. OSV scanning exists for PR/push/schedule, and ZAP/Snyk scripts exist, but the reviewed outputs do not show a fully blocking dynamic security gate in normal production deploy flow.

Impact: regressions in browser flows or dynamic security checks may not stop a production release.

Fix: make the pilot deployment checklist require a green smoke suite, OSV scan, and at least authenticated ZAP baseline against staging.

### R-008: Many Real Workflow Tests Skip Without Staging Credentials or Fixtures

Severity: Medium

Location: `tests/e2e/smoke/*`, `tests/e2e/integration/real-workflows.spec.ts`

Evidence: repo scan found multiple `test.skip(...)` calls in smoke and real workflow suites, commonly gated by missing credentials, URLs, or data fixtures.

Impact: a local or CI green result may not mean key pilot flows were exercised. For pilot, the most important flows are guest QR order, kitchen receive/update, cashier payment close, owner order/menu management, and admin restaurant switching.

Fix: define one required pilot smoke profile with real staging credentials and fail if those env vars are missing.

## Positive Findings

- Production API CORS is explicit: `apps/api/wrangler.toml:253` sets `CORS_ORIGIN = "https://makanmasak.com"`.
- API auth middleware checks `JWT_SECRET` length and rejects tokens for inactive users or token-version mismatches.
- Major routes reviewed for users, orders, tables, and seats include restaurant scoping checks for non-admin users.
- Payments have idempotency middleware in place; the remaining issue is making keys mandatory.
- Customer market checkout redirect uses `safeExternalHref()` before navigation.
- OSV dependency scanning is configured for PR, merge queue, push, and schedule.

## Pilot Go / No-Go

Recommended decision: conditional no-go until R-001, R-002, and R-005 are fixed or explicitly mitigated. After that, a limited pilot can proceed with operational constraints:

- only onboard named restaurants with test-aware agreements;
- keep admin/owner account creation controlled by the team;
- enable Cloudflare WAF/rate rules for auth endpoints;
- require two-factor or strong password policy for owner/admin accounts;
- run `check:prod-config`, build, real-integration, and pilot smoke tests before every deploy;
- monitor auth failures, payment retries, order creation errors, and WebSocket disconnects daily.

## Verification Performed

- Read framework/security guidance for Vue/frontend TypeScript.
- Inspected API app factory, auth middleware, CSRF, CORS, security headers, rate limit code, payment routes, frontend auth storage, management API CORS/auth, production wrangler files, and CI/security workflow configuration.
- Ran `rtk pnpm run check:prod-config`; it failed on missing `SLACK_WEBHOOK_URL`.

Not run: full `pnpm build`, `pnpm test`, real integration suite, Playwright smoke suite, Snyk, OSV, or ZAP. Those are required before an actual pilot release decision.
