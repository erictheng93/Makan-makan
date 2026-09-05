# Security Implementation Guide

> ⚠️ **Rewritten 2026-07-05.** The previous version of this document described
> a legacy PHP/MySQL deployment (`config.php`, `apps/api/src/routes/auth.ts`,
> `SQL/migrate_passwords_security.sql`) that does not exist anywhere in this
> repository — MakanMakan is Cloudflare Workers + D1 only. This version is a
> best-effort rewrite based on what the current code actually implements.
> It has not been reviewed against any formal security policy decisions that
> may exist outside the codebase — verify against actual team policy before
> treating this as authoritative for compliance purposes.

## 🔐 Current Security Implementation

### 1. Password & Secret Hashing

- **Staff/owner account passwords**: bcrypt, cost factor **10**
  (`packages/database/src/services/auth.ts`, `user.ts` — `saltRounds = 10`).
- **Customer phone-OTP codes**: bcrypt, cost factor 10
  (`apps/api/src/features/customer/routes/index.ts`).
- **Credit/wallet PINs**: bcrypt via `BCRYPT_COST`
  (`apps/api/src/features/credits/services/CreditService.ts`).
- **Email/phone verification tokens**: bcrypt-hashed
  (`packages/database/src/services/VerificationService.ts`).

### 2. Authentication — Two Separate JWT Flows

- **Staff/admin JWT** (`apps/api/src/middleware/auth.ts`): `authMiddleware`
  accepts role 0-4 tokens (`createAuthMiddleware(4)`); a legacy
  `customerAuthMiddleware = createAuthMiddleware(5)` still exists for
  routes that haven't migrated to the canonical customer flow.
- **Canonical customer JWT** (`canonicalCustomerAuthMiddleware`, same file):
  validates a dedicated `{ sub: customers.id, type: "customer" }` token
  shape, issued by `apps/api/src/features/customer/routes/index.ts`
  (phone-OTP → JWT, 15 min access / 30 day refresh, refresh tokens typed
  `type: "customer_refresh"`).
- **`JWT_SECRET` validation**: every JWT-verifying middleware checks
  `JWT_SECRET.length >= 32` and throws `SERVER_CONFIG_ERROR` (500) if unset
  or too short.
- **Token revocation**: `TOKEN_BLACKLIST` KV namespace (bound in
  `apps/api/wrangler.toml`) — logout writes a blacklist entry checked on
  every subsequent request.
- **Realtime WebSocket auth**: `apps/realtime` falls back to the shared
  `JWT_SECRET` for session auth (see `docs/archive/CHANGELOG.md`'s
  2026-05-25→2026-07-05 entry for recent hardening commits).

### 3. Rate Limiting

- KV-backed (`RATE_LIMIT_KV`), applied globally via
  `geoIntelligentRateLimitMiddleware` in `apps/api/src/app-factory.ts`, with
  per-route `customLimits` overrides — e.g. `/api/v1/auth/login`: 100
  requests/60s with burst multiplier 1.2 and 60s block duration.
  `/health`, `/info`, and `/api/v1/sse/events` are exempted (health checks
  and long-lived SSE streams shouldn't be throttled).
- Customer OTP requests are additionally rate-limited per-phone and per-IP
  in `apps/api/src/features/customer/routes/index.ts`.

### 4. CORS & Security Headers

- `apps/api/src/middleware/cors.ts` builds an explicit allowed-origins list:
  production uses `CORS_ORIGIN` (comma-separated), development
  allows only `localhost`/`127.0.0.1` on known dev ports plus
  `DEV_CORS_ORIGINS`. No wildcard origins in production.
- Security headers set in `cors.ts` and `apps/api/src/middleware/security.ts`:
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Content-Security-Policy`, and `Strict-Transport-Security`.

### 5. Secret Storage

- OAuth credentials, access/refresh tokens, client secrets, and webhook
  secrets are stored only in **encrypted payload fields** — see
  `packages/utils/src/encryption.ts` (AES-256-GCM via Web Crypto API, PBKDF2
  key derivation). JSON config columns are reserved for non-secret
  flags/preferences (see root `CLAUDE.md`'s Secret Storage rule).
- Cloudflare Worker secrets (`JWT_SECRET`, `SLACK_WEBHOOK_URL`, etc.) are set
  via `wrangler secret put`, never committed to `wrangler.toml` or
  `.env.development` (which is checked into the repo for localhost-only
  dev defaults — see root `CLAUDE.md`'s Environment Variables section).

### 6. Platform-Level Controls

Per root `CLAUDE.md`: Cloudflare WAF + Zero Trust, rate limiting (per-IP and
per-user, described above), complete audit trail, and role-based access
control (RBAC) across the 6-role system (Admin/Owner/Chef/Service/Cashier/
Customer). Audit logging currently has dedicated tables per domain (e.g.
`payment_audit_log` in `packages/database/src/schema/payment-audit-log.ts`)
rather than a single unified `audit_logs` table — check
`apps/api/src/features/audit/` for the audit feature module before assuming
a specific table name.

## 🛡️ Security Configuration

### Environment Variables Setup

1. Copy the relevant app's `.env.development.example` to
   `.env.development.local` for local overrides (see root `CLAUDE.md`'s
   Environment Variables section) — never put secrets in `.env.development`,
   which is committed.
2. Generate a secure JWT secret:

   ```bash
   openssl rand -base64 48
   ```

3. Set secrets via Wrangler, per environment, per app:

   ```bash
   wrangler secret put JWT_SECRET --env production
   wrangler secret put SLACK_WEBHOOK_URL --env production
   ```

   Never use default/example values in production; use different secrets
   per environment.

### Cloudflare Bindings

Each app's `wrangler.toml` declares its own D1/KV/R2/Queue bindings — see
`apps/api/wrangler.toml` for the primary API's `DB`, `CACHE_KV`,
`RATE_LIMIT_KV`, `BACKUP_KV`, `TOKEN_BLACKLIST`, and `BACKUP_STORAGE`
bindings. Resource IDs are real (no `REPLACE_ME__PRODUCTION` placeholders
remain as of 2026-09-05) — see `docs/TODOS.md` § authentication.

## 🔍 Security Monitoring

### Audit Logging

- Domain-specific audit tables (payment, billing, etc.) rather than one
  unified table — check `packages/database/src/schema/` for the specific
  table backing any given feature before writing queries against it.
- Monitor for unusual login patterns via `apps/api/src/features/auth`'s
  auth statistics endpoints — note that `AuthService.checkAccountSecurity()`
  currently hardcodes `failedLoginAttempts: 0` and `getSecurityEvents()`
  returns `[]` (see `docs/TODOS.md` § authentication, formerly the Authentication Flows
  section) — these specific stats are **not yet real data**, don't rely on
  them for actual monitoring today.

### Error Monitoring

- Slack webhook integration for critical errors (`SLACK_WEBHOOK_URL` secret).
- `apps/api/src/features/system/` and `monitoring/` expose health/error
  endpoints — see root `CLAUDE.md`'s Debug Tools section for the current
  endpoint list (`/info` for public liveness; `/api/v1/monitoring/health`,
  `/api/v1/system/health*` for authenticated deep health checks — there is
  **no** unauthenticated `/api/v1/health` route).

### Regular Security Tasks

#### Weekly

- [ ] Review access logs for suspicious activity
- [ ] Check for failed authentication attempts (see caveat above about
      `checkAccountSecurity()` not yet being real data)
- [ ] Monitor error rates and patterns

#### Monthly

- [ ] Review user permissions and roles
- [ ] Update dependencies with security patches
- [ ] Audit `CORS_ORIGIN` allowed origins list per environment
- [ ] Check `TOKEN_BLACKLIST` KV size/growth

#### Quarterly

- [ ] Rotate JWT secrets (coordinate across `apps/api`, `apps/realtime`,
      `apps/management-api` — they must share `JWT_SECRET` for cross-worker
      auth to keep working, per `docs/onboarding` cross-worker JWT_SECRET
      alignment notes)
- [ ] Review and update security headers
- [ ] Audit user accounts and remove unused ones
- [ ] Security penetration testing

## 🚨 Incident Response

### If Credentials Are Compromised

1. Rotate the affected secret via `wrangler secret put --env <env>`
   immediately, for every worker that shares it.
2. `TOKEN_BLACKLIST`-based revocation only blacklists tokens that were
   explicitly logged out — a rotated `JWT_SECRET` invalidates all
   outstanding tokens at once (they fail signature verification), which is
   the correct emergency response for a suspected secret leak.
3. Check audit/error logs for unauthorized activity in the affected window.
4. Notify affected users if customer data was exposed.

### Security Contacts

- **System Administrator**: [Your contact]
- **Security Team**: [Your team contact]
- **Incident Response**: [Emergency contact]

## 📋 Security Checklist for New Deployments

### Pre-deployment

- [ ] All environment variables/secrets configured per app
      (`apps/api`, `apps/management-api`, `apps/realtime`, etc.)
- [ ] `JWT_SECRET` is identical across workers that need to interoperate,
      minimum 32 characters
- [ ] `CORS_ORIGIN` set for the target environment (no wildcard)
- [ ] Security headers verified (see section 4 above)
- [ ] Rate limiting `customLimits` reviewed for the deployment's expected
      traffic

### Post-deployment

- [ ] Test staff and customer authentication flows separately
- [ ] Verify CORS behavior against the real frontend origin
- [ ] Check security headers in browser devtools
- [ ] Test rate limiting on a login-like endpoint
- [ ] Monitor for errors in the first 24 hours

## 🔧 Development Security

1. Never commit secrets — `.env.development` (committed) is for
   localhost URLs and flags only; use `.env.development.local`
   (gitignored) for anything sensitive.
2. Keep dependencies updated.
3. Test authentication and authorization flows for both staff-role and
   canonical-customer JWT paths — they use different middleware.

### Testing Security Features

```bash
# Test JWT token validation
curl -H "Authorization: Bearer invalid-token" https://<api-host>/api/v1/auth/me

# Test CORS restrictions
curl -H "Origin: https://malicious-site.com" https://<api-host>/info

# Test rate limiting
for i in {1..150}; do curl https://<api-host>/info; done
```

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Cloudflare Security Center](https://developers.cloudflare.com/security/)
- [JWT Security Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)

---

**Last Updated**: 2026-07-05
**Next Security Review**: recommend quarterly (see Regular Security Tasks above)
