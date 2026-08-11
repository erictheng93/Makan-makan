# Customer Authentication — Specification

**Status:** Draft for implementation
**Date:** 2026-08-11
**Scope:** `apps/customer-app`, `apps/api` (`features/customer`), `packages/database`

---

## 1. Goal

Give customers three ways to register and sign in, all landing on a single
`customers` row:

1. **Social** — Google, LINE, Facebook
2. **Phone OTP** — SMS one-time code (already exists; delivery channel shipped separately)
3. **Password** — email *or* phone number as the identifier, plus a password

Today only phone OTP exists, and it is a customer-only surface: `customers` is a
separate table from `users` (staff). Everything in this spec stays on the
customer side of that line.

## 2. Current state (verified 2026-08-11)

| Area | State |
| --- | --- |
| Login UI | `LoginView.vue` — phone OTP only, plus a guest-browse link |
| Auth store | `stores/auth.ts` — `requestOtp` / `verifyOtp`; `login()` is a wrapper; `register()` returns an error |
| Routes | `/register` redirects to `/login`; `/forgot-password`, `/reset-password`, `/verify-email` are reachable but unlinked |
| API | `POST /api/v1/customer/auth/{request-otp,verify-otp,refresh,logout}` + `/customer/me` |
| Identity storage | `customers` table only: `primary_phone`, `primary_email`, both with partial unique indexes. **No password hash, no provider identity table.** |
| SMS delivery | Vendor-agnostic provider layer + `request-otp` wiring — **shipped**, see §9 |

### 2.1 Known defect this spec must fix first

`ForgotPasswordView.vue`, `ResetPasswordView.vue` and `VerifyEmailView.vue` post
to `/api/v1/auth/forgot-password`, `/reset-password` and `/verify-email`. Those
endpoints are **live** (`apps/api/src/features/authentication/routes/index.ts:631,655,679`)
and resolve against the **`users` (staff)** table via
`VerificationService.requestPasswordReset` (`packages/database/src/services/VerificationService.ts:145`).

A customer-app page therefore drives the staff password-reset flow. That allows
staff-account probing and unsolicited staff reset mail originating from the
public customer surface. These three views and their routes must be deleted
before any customer password feature is built — the replacements in §6 are
customer-scoped and share no table or endpoint with staff auth.

## 3. Identity model

### 3.1 New table: `customer_auth_identities`

One row per (provider, identifier) pair. A customer may hold several.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT PK | UUID v7 |
| `customer_id` | TEXT NOT NULL | FK → `customers.id` ON DELETE CASCADE |
| `provider` | TEXT NOT NULL | `phone` \| `password` \| `google` \| `line` \| `facebook` |
| `provider_uid` | TEXT NOT NULL | phone → E.164; password → normalized email or E.164; OAuth → provider `sub`/`userId` |
| `secret_hash` | TEXT NULL | bcrypt hash. `password` provider only; NULL for every other provider |
| `encrypted_payload` | TEXT NULL | Reserved for provider tokens (see §3.4). NULL in MVP |
| `verified_at_ms` | INTEGER NULL | Set when the identifier is proven (OTP passed / email link clicked / OAuth callback verified) |
| `last_used_at_ms` | INTEGER NULL | |
| `created_at_ms` | INTEGER NOT NULL | `(unixepoch('now') * 1000)` |
| `updated_at_ms` | INTEGER NOT NULL | |

Indexes:

- `UNIQUE (provider, provider_uid)` — one identity cannot point at two customers
- `INDEX (customer_id)`
- `UNIQUE (customer_id) WHERE provider = 'password'` — at most one password per customer

`customers.primary_phone` / `primary_email` stay as the display/contact fields.
They are **derived** from identities, never the authority for login.

### 3.2 Backfill

Every existing `customers` row with a non-null `primary_phone` gets a
`provider='phone'` identity with `provider_uid = primary_phone` and
`verified_at_ms = created_at_ms`. Existing OTP sign-in must keep working with
zero customer-visible change.

### 3.3 New table: `customer_verification_tokens`

Customer-scoped replacement for the staff `password_reset_tokens`. Used by both
password reset and email verification.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT PK | UUID v7 |
| `customer_id` | TEXT NULL | NULL for pre-registration email verification |
| `purpose` | TEXT NOT NULL | `password_reset` \| `email_verify` |
| `identifier` | TEXT NOT NULL | email or E.164 the token was issued against |
| `token_hash` | TEXT NOT NULL | SHA-256 of the token. **Never store the raw token** |
| `expires_at_ms` | INTEGER NOT NULL | 15 min for reset, 24 h for email verify |
| `used_at_ms` | INTEGER NULL | Single use |
| `ip_address` | TEXT NULL | |
| `created_at_ms` | INTEGER NOT NULL | |

Index: `UNIQUE (token_hash)`, `INDEX (identifier, purpose, created_at_ms)`.

### 3.4 Provider tokens

The MVP does **not** store OAuth access/refresh tokens — we only need identity
at sign-in, and the tokens are discarded after the callback. If LINE Messaging
push is added later, those tokens go in `encrypted_payload` (AES-256), never in
a JSON config column. This is the repo's standing rule (`CLAUDE.md` →
Secret Storage).

## 4. Account merge — the load-bearing rule

> **The only merge key is a verified phone number in E.164 form.**

Rationale: OAuth providers return an `email` claim that is not necessarily an
address the user controls (and Facebook may return none at all). Merging on
email lets anyone who can create an account at a provider with a victim's
address take over that customer. Phone requires possession of the SIM, which we
independently verify with our own OTP.

Consequences:

1. **Social sign-in never auto-creates a full session on first use.** It returns
   a short-lived *binding token* (scope: `bind_phone` only, TTL 10 min).
2. The client then runs the normal OTP flow with that binding token attached.
3. On successful OTP verification:
   - if a customer already owns that phone identity → attach the social identity
     to that existing `customer_id`
   - otherwise → create the customer, attach both identities
4. **Password registration with an email identifier** also requires a phone
   before the account can place orders — same binding flow. Password
   registration with a phone identifier verifies by OTP inline.
5. `customers.primary_email` is only ever set from an identifier we verified
   ourselves (email link or a password identity that passed verification), never
   straight from an OAuth claim.

Returning social sign-ins (identity row already exists) skip all of this and get
a normal session immediately.

## 5. Session issuing

All three methods converge on one internal helper:

```ts
issueCustomerSession(env, customerId, opts): Promise<CustomerSession>
```

It is the only place that mints the customer access JWT and the
`__Host-mm_customer_refresh` cookie. Today that logic is inline in
`verify-otp`; extract it before adding methods two and three, so token shape,
TTL and cookie flags cannot drift between them.

Binding tokens are a separate, non-refreshable JWT with `type:
"customer_bind"`, carrying the pending provider + provider_uid and nothing else.
They must be rejected by `canonicalCustomerAuthMiddleware`.

## 6. API surface

All under `/api/v1/customer/auth/`. Existing endpoints unchanged unless noted.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/request-otp` | *(exists)* send OTP |
| POST | `/verify-otp` | *(exists)* verify OTP → session. **Extended**: accepts an optional binding token to complete a social/email registration |
| POST | `/register` | password registration: `{ identifier, password, displayName }` |
| POST | `/login` | password login: `{ identifier, password }` |
| POST | `/forgot-password` | customer-scoped; always 200 regardless of account existence |
| POST | `/reset-password` | `{ token, newPassword }` |
| POST | `/verify-email` | `{ token }` |
| POST | `/resend-verification` | rate-limited |
| GET | `/oauth/:provider/start` | returns `{ authorizeUrl, state }`; provider ∈ google\|line\|facebook |
| GET | `/oauth/:provider/callback` | exchanges code → session **or** binding token |
| GET | `/me/identities` | list linked identities (no secrets) |
| POST | `/me/identities/:provider` | link an additional provider to the signed-in customer |
| DELETE | `/me/identities/:id` | unlink; **must refuse to remove the last remaining identity** |

Error responses use the repo's unified `ApiError` envelope. Throw from the
handler; do not format in-handler (`CLAUDE.md` → Error Response Format).

## 7. Security requirements

These are acceptance criteria, not suggestions.

### 7.1 OAuth

- **PKCE (S256) on every provider**, plus `state`. Both stored in
  `RATE_LIMIT_KV`-style KV keyed by state, TTL 10 min, **deleted on first use**
  (replay must fail).
- **OIDC `nonce`** for Google and LINE; verify the `id_token` signature against
  the provider JWKS, and check `iss`, `aud`, `exp`, `nonce`. Do not trust the
  userinfo endpoint alone.
- Facebook is not OIDC: exchange the code, then call `/me?fields=id,name,email`
  **and** `/debug_token` to confirm the token was issued to our own app id.
  Skipping `debug_token` allows token-substitution from another Facebook app.
- Redirect URIs come from an allowlist in config. Never echo a client-supplied
  `redirect_uri` back into the authorize URL.
- Client secrets via `wrangler secret put`. They must never appear in
  `.env.development` (that file is committed).

### 7.2 Password

- bcryptjs, cost 10 — matches staff auth. Note the known ~0.8 s Workers cost per
  verification; this is accepted, not a defect to fix here.
- Minimum length 10, no composition rules; reject the top-N common-password list.
- **Login errors must be identical** for "no such identifier" and "wrong
  password", and must take comparable time (hash a dummy when the identity is
  missing) — otherwise the endpoint is a customer-enumeration oracle.
- Rate limit per identifier **and** per IP, following `enforceOtpRateLimit`.
- `/forgot-password` returns 200 unconditionally.
- Reset tokens: 32 bytes from `crypto.getRandomValues`, stored as SHA-256,
  single use, 15 min TTL, invalidated when the password changes.
- Changing a password revokes all refresh tokens for that customer.

### 7.3 General

- Rate-limit key for guest/anonymous flows must not be IP-only. A shared night
  market NAT puts hundreds of customers behind one address; an IP-keyed lock
  blocks all of them at once. (Previously observed on the `guest_active` lock.)
- Every auth event (`login`, `register`, `link`, `unlink`, `reset`) writes an
  audit row with provider, IP and user agent.

## 8. Frontend

- `LoginView.vue` gains three sections in one screen: social buttons (top,
  highest-conversion first: LINE → Google → Facebook), OTP, then
  password-with-identifier. Guest-browse link stays.
- `RegisterView.vue` is re-enabled; the `/register` → `/login` redirect is removed.
- New `BindPhoneView.vue` for the §4 binding step.
- Delete `ForgotPasswordView.vue`, `ResetPasswordView.vue`, `VerifyEmailView.vue`
  and their routes, then re-create them against `/customer/auth/*`.
- `stores/auth.ts`: `register()` stops being a stub; add `loginWithPassword`,
  `startOAuth`, `completeOAuth`, `bindPhone`.
- All UI follows `docs/UIUX-design-system.md` (Apple-Native Soft Minimalism).
  Social buttons must use each provider's official mark and brand colour, which
  is a required condition of their branding guidelines.

## 9. SMS delivery channel — shipped

Implemented in `packages/database/src/services/sms.ts`:

- One `SmsProvider` interface; vendors `mitake` (三竹), `every8d`, `twilio`, `noop`.
- `SMS_PROVIDER` env picks the vendor. Unset/`auto` picks the first with
  complete credentials in cost order: mitake → every8d → twilio. An
  unrecognised value fails closed to `noop` so a config typo is visible.
- Wire formats taken from the vendors' own references: Mitake status codes from
  `mitaketw/sms-java` `StatusCode.java`; Every8d framing from `minchao/go-every8d`.
- `POST /customer/auth/request-otp` now sends, and:
  - returns **503 `SMS_CHANNEL_UNAVAILABLE`** in production when no vendor is
    configured (no token row is written)
  - returns **502 `SMS_SEND_FAILED`** when the vendor rejects the send; the
    vendor's message is logged server-side only
  - still echoes `devOtp` outside production, with no vendor required

Switching vendor after price comparison = set `SMS_PROVIDER` + two secrets.
No code change.

**Known follow-up:** a vendor outage consumes the caller's OTP rate-limit quota
(3/hour/phone), so an outage can lock a customer out for an hour. Refunding the
counter on send failure is deliberately out of scope here.

## 10. Out of scope

- LINE Messaging API push notifications (separate work; would reuse the LINE link)
- Two-factor authentication for customers
- Migrating staff (`users`) auth
- Passkeys / WebAuthn

## 11. Acceptance criteria

1. A customer can register and sign in by all three methods, and all three land
   on the same `customers` row when the verified phone matches.
2. Signing in with Google using an email that matches an existing customer, when
   the phone does **not** match, does **not** grant access to that customer.
3. Replaying an OAuth `state` fails.
4. `/login` returns an identical response for unknown identifier and wrong
   password.
5. Unlinking the only remaining identity is refused.
6. Deleting a customer cascades their identities and verification tokens.
7. No customer-app page calls any `/api/v1/auth/*` staff endpoint.
8. `pnpm typecheck`, `pnpm lint`, `pnpm test`, and the `real-integration` suite
   all pass.
