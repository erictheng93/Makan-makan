# 🛡️ Security Deployment Checklist

> ⚠️ **Rewritten 2026-07-05.** The previous version described a one-time
> plaintext→bcrypt password migration against a PHP/MySQL stack
> (`config.php`, `SQL/migrate_passwords_security.sql`,
> `002_password_security_migration.sql`) — none of that exists in this repo.
> That migration is long complete; current password handling is bcrypt-only
> (see `docs/security/SECURITY.md`). This version reflects the current
> Cloudflare Workers + D1 deployment instead. Verify against actual team
> policy before treating this as authoritative for compliance purposes.

## Pre-Deployment Security Verification

### ✅ Critical Security Tasks (MUST COMPLETE)

#### 1. Environment Variables & Secrets

- [ ] **`JWT_SECRET` is set and secure (minimum 32 characters), identical
      across every worker that needs to interoperate** (`apps/api`,
      `apps/management-api`, `apps/realtime` all validate/verify JWTs
      against the same secret)

  ```bash
  # Generate a new secret for each environment
  openssl rand -base64 48

  # Set via Wrangler (NOT in wrangler.toml), per app
  wrangler secret put JWT_SECRET --env production
  ```

- [ ] **No secrets in committed files**
  - [ ] `.env.development` (committed, for the 3 apps that ship one) only
        contains localhost URLs and feature flags — nothing matching
        `SECRET|TOKEN|KEY|PASSWORD`
  - [ ] Anything sensitive lives in `.env.development.local` (gitignored)
        or Cloudflare's secret store

- [ ] **Cloudflare bindings configured** (see `apps/api/wrangler.toml` for
      the full list)
  - [ ] D1 database bound (`DB`)
  - [ ] KV namespaces created and bound: `CACHE_KV`, `RATE_LIMIT_KV`,
        `BACKUP_KV`, `TOKEN_BLACKLIST`
  - [ ] R2 bucket bound (`BACKUP_STORAGE`)
  - [ ] All environment-specific resource IDs are real (not
        `REPLACE_ME__PRODUCTION` placeholders — confirmed none remain
        as of 2026-07-05, but re-check if you're touching new bindings)

#### 2. Password & OTP Security

- [ ] **Staff/owner passwords are bcrypt-hashed** (cost factor 10,
      `packages/database/src/services/auth.ts`/`user.ts`) — this is already
      the only code path; there is no legacy plaintext fallback to migrate
      away from
- [ ] **Customer phone-OTP flow works end-to-end**
      (`apps/api/src/features/customer/routes/index.ts`):
  request-otp → verify-otp → canonical customer JWT issued
- [ ] **Password reset functionality works**: `authentication` feature's
      reset-password routes, using database-backed tokens (not the
      placeholder implementation described in older docs)

#### 3. Authentication & Authorization

- [ ] **JWT configuration verified**
  - [ ] Token blacklisting works: logging out actually invalidates the
        token (`TOKEN_BLACKLIST` KV entry checked on every request)
  - [ ] Expired/invalid token error handling returns `401` with a clear
        error code, not a 500
  - [ ] Staff JWTs are rejected on canonical customer-only endpoints and
        vice versa (`canonicalCustomerAuthMiddleware` validates
        `type: "customer"`; staff middleware validates role 0-4)

- [ ] **Role-based access control tested**
  - [ ] Admin (role 0) can access all restaurants
  - [ ] Shop Owner (role 1) restricted to their own restaurant(s)
  - [ ] Staff roles (2-4) properly limited to their function
  - [ ] Cross-restaurant access blocked (403, not silently scoped)

#### 4. CORS & Security Headers

- [ ] **CORS configuration verified for the target environment**

  ```bash
  # Should be blocked
  curl -H "Origin: https://malicious-site.com" https://<api-host>/info

  # Should be allowed (use your actual configured CORS_ORIGIN)
  curl -H "Origin: https://admin.yourdomain.com" https://<api-host>/info
  ```

- [ ] **Security headers present** (`X-Content-Type-Options: nosniff`,
      `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
      `Content-Security-Policy`, `Strict-Transport-Security`)

### 🔧 Deployment Commands

#### Development Setup

```bash
pnpm install
pnpm wrangler login
pnpm db:migrate:local
pnpm dev
```

#### Production Deployment

```bash
wrangler secret put JWT_SECRET --env production
wrangler secret put SLACK_WEBHOOK_URL --env production

pnpm deploy:prod
```

### 🧪 Security Testing Checklist

#### Authentication Testing

- [ ] Login with bcrypt-hashed password works
- [ ] JWT token validation working (staff and canonical customer paths)
- [ ] Token blacklisting on logout functional
- [ ] Expired token properly rejected

#### Authorization Testing

- [ ] Admin can access all restaurants
- [ ] Shop owner limited to their restaurant
- [ ] Staff cannot access admin-only modules (`/auth/stats`,
      `/monitoring/metrics`, `/system/health/detailed`, `/feedback/stats`)
- [ ] Cross-restaurant access blocked

#### Security Headers Testing

```bash
curl -I https://<api-host>/info
# Should include: X-Content-Type-Options, X-Frame-Options,
# Referrer-Policy, Content-Security-Policy, Strict-Transport-Security
```

#### CORS Testing

```bash
curl -H "Origin: https://unauthorized-site.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS https://<api-host>/api/v1/auth/login
# Should be rejected

curl -H "Origin: https://admin.yourdomain.com" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS https://<api-host>/api/v1/auth/login
# Should be allowed
```

### 📊 Post-Deployment Monitoring

#### Immediate Monitoring (First 24 Hours)

- [ ] API response times normal
- [ ] Authentication working across all apps (staff and customer paths)
- [ ] Error rates within acceptable limits
- [ ] No security-related errors in logs

#### Weekly Monitoring

- [ ] Review domain-specific audit tables for suspicious activity (e.g.
      `payment_audit_log` — there is no single unified `audit_logs` table,
      check `packages/database/src/schema/` for the relevant one)
- [ ] Check failed authentication attempts (note: `AuthService`'s built-in
      account-security stats are currently hardcoded stubs, not real data —
      see `docs/TODOS.md`)
- [ ] Monitor `TOKEN_BLACKLIST` KV size

#### Monthly Security Review

- [ ] Rotate JWT secrets (coordinated across workers)
- [ ] Update dependencies with security patches
- [ ] Review user account status
- [ ] Test backup and recovery procedures (see `docs/runbooks/backup-restore-runbook.md`)

### 🚨 Emergency Procedures

#### Security Incident Response

1. **If `JWT_SECRET` is compromised:**

   ```bash
   NEW_SECRET=$(openssl rand -base64 48)
   wrangler secret put JWT_SECRET --env production
   ```

   Rotating the secret invalidates every outstanding token immediately
   (they fail signature verification) — this is the correct emergency
   response, not `TOKEN_BLACKLIST` (which only covers tokens explicitly
   logged out).

2. **If malicious activity is detected:**
   - Check domain-specific audit tables and error logs
   - Review CORS/rate-limit logs for the offending IP/pattern
   - Consider tightening `customLimits` in `apps/api/src/app-factory.ts`
     for the affected endpoint

### 📋 Final Verification

#### Before Going Live

- [ ] All secrets properly configured, per app, per environment
- [ ] All security tests passing
- [ ] Monitoring and alerting configured
- [ ] Team briefed on incident response steps above

### 🔄 Rollback Plan

```bash
# Emergency rollback for a Worker
wrangler rollback --name <worker-name> --env production
```

Database rollback: see `docs/runbooks/rollback-runbook.md` and
`docs/runbooks/backup-restore-runbook.md`.

---

**Security Officer Sign-off**: **\*\*\*\***\_**\*\*\*\*** Date: \***\*\_\*\***

**Technical Lead Sign-off**: **\*\*\*\***\_**\*\*\*\*** Date: \***\*\_\*\***

**Deployment Date**: **\*\***\_**\*\***

**Next Security Review**: **\*\***\_**\*\***
