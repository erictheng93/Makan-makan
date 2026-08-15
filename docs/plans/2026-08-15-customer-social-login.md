# Customer Social Login — Remaining Work (P3)

**Created:** 2026-08-15
**Spec:** `docs/specs/customer-authentication.md` — read §4 and §7.1 before starting
**Status:** not started; phone OTP and password sign-in are already shipped

---

## Where things stand

Landed on `main` (see `git log --grep "customer auth\|password sign-in\|pluggable SMS"`):

| Piece | State |
| --- | --- |
| SMS vendor layer (`mitake` / `every8d` / `twilio` / `noop`) | shipped, `packages/database/src/services/sms.ts` |
| `request-otp` actually sends | shipped |
| `customer_auth_identities` + `customer_verification_tokens` | shipped, migration `0084` |
| `issueCustomerSession` / `revokeCustomerSession` / `issueBindingToken` | shipped, `apps/api/src/features/customer/services/CustomerSessionService.ts` |
| Password register / login / reset / verify | shipped |
| Password + OTP sign-in UI | shipped |
| **Social sign-in (Google / LINE / Facebook)** | **this document** |

`issueBindingToken` already exists and `canonicalCustomerAuthMiddleware` already
rejects `customer_bind` tokens. That guard went in before anything could issue
one; do not weaken it.

## Decisions already made — do not relitigate

**Redirect URI lives on the API domain**, not the customer app:

```
https://<api-domain>/api/v1/customer/auth/oauth/<provider>/callback
```

The browser lands on the API, which exchanges the code and then redirects to the
customer app with either a session or a binding handle. The app never sees the
provider's `code`.

**A verified phone number is the only account-merge key.** OAuth `email` claims
are not proof of control, so merging on email would let anyone who can create an
account at a provider take over a customer. First-time social sign-in therefore
returns a *binding token* (10 min, scope `bind_phone`), not a session. See spec §4.

**Provider order by value:** LINE first (highest reach in the target market, and
the link is reusable for Messaging API push later), Google second, Facebook last.
Build the core against Google because it is the plainest OIDC provider, then add
the other two.

---

## Prerequisite — human only

Before P3-7 can be verified end to end, someone with console access must:

1. Create an OAuth 2.0 Client (Web application) in Google Cloud Console
2. Register the redirect URI above for both production and any preview domain
3. Put the credentials in Worker secrets, never in `.env.development`:
   ```
   wrangler secret put GOOGLE_OAUTH_CLIENT_ID
   wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET
   ```

Implementation can proceed in parallel with fake credentials — the tests below
all stub the provider's HTTP endpoints.

---

## P3-7 — OAuth core + Google

Build the provider-agnostic machinery once, prove it with Google.

**Endpoints** (`/api/v1/customer/auth/`):

- `GET /oauth/:provider/start` → `{ authorizeUrl, state }`
- `GET /oauth/:provider/callback` → redirects to the customer app with a session
  or a binding handle

**Required, non-negotiable (spec §7.1):**

- **PKCE (S256) on every provider**, plus `state`. Store the verifier and state
  in KV keyed by `state`, TTL 10 min, **delete on first use** — a replayed
  `state` must fail.
- **Verify the `id_token` signature against the provider JWKS**, and check
  `iss`, `aud`, `exp`, `nonce`. Do not trust the userinfo endpoint alone.
- Redirect URIs come from a server-side allowlist. Never echo a client-supplied
  `redirect_uri` into the authorize URL.
- The provider's `sub` — not its email — is `provider_uid`.

**Identity handling:**

- Existing `(provider, provider_uid)` row → issue a normal session immediately.
- No such row → issue a binding token carrying `{ provider, providerUid }` and
  redirect to the app's phone-binding screen. Create no `customers` row yet.

**Acceptance:**

- Replaying a `state` fails
- A tampered `id_token` signature fails
- An `id_token` with the wrong `aud` fails
- A returning social user gets a session without touching the phone flow
- A first-time social user gets a binding token and **no** `customers` row
- The customer app never receives the provider `code`
- `pnpm typecheck`, `pnpm lint`, `npx vitest run apps/api/src/features/customer`,
  and the `real-integration` suite all pass

## P3-8 — LINE

Same core. LINE is OIDC, so the `id_token` path from P3-7 applies; check the
`amr` claim if the account was created by phone.

Do **not** store the access/refresh tokens in this phase. If Messaging API push
is added later, they go in `customer_auth_identities.encrypted_payload`, AES-256,
never a JSON config column (CLAUDE.md → Secret Storage).

## P3-9 — Facebook

**Facebook is not OIDC** — there is no `id_token` to verify. After exchanging
the code you must call both:

- `/me?fields=id,name,email`
- `/debug_token` — to confirm the token was issued to **our own** app id

Skipping `debug_token` allows token substitution from another Facebook app.
That check is the acceptance criterion for this task.

## P3-10 — Phone binding and account merge

The step that makes §4 real.

- `POST /auth/bind-phone` accepts a binding token + phone, issues an OTP
- `POST /auth/verify-otp` accepts an optional binding token; on success:
  - phone identity already exists → attach the social identity to **that**
    `customer_id`
  - otherwise → create the customer, attach both identities
- `customers.primary_email` is only ever written from an identifier we verified
  ourselves, never straight from an OAuth claim

**Acceptance:**

- Google sign-in with an email matching an existing customer, where the phone
  does **not** match, does **not** grant access to that customer
- Binding the same phone as an existing OTP customer lands on one `customers`
  row, not two
- A binding token cannot be used as an access token (already guarded — keep the
  test)
- An expired binding token is refused

## P3-11 — Frontend

- Social buttons at the top of `LoginView.vue`, order LINE → Google → Facebook,
  using each provider's official mark and brand colour (their branding
  guidelines require it — this is the one place the iOS palette gives way)
- `BindPhoneView.vue` for the P3-10 flow
- Identity management in `ProfileView.vue`: list linked providers, link another,
  unlink — **unlinking the last remaining identity must be refused**
- Everything else follows `docs/UIUX-design-system.md`; check Section 15 before
  shipping
- Six locales must stay at an identical key set
- Lint the app from **inside** `apps/customer-app` (see follow-up 4 below)

---

## Open follow-ups found during the P0–P2 audits

Not blocking P3, but each is real.

1. **`auth.registerRetired` is a dead i18n key.** Nothing references it since the
   registration UI landed. It came from a parallel session's work, so it was left
   in place rather than deleted unilaterally.

2. **Refresh KV keys changed shape without a fallback.** Records moved from
   `customer_refresh:{jti}` to `customer_refresh:{customerId}:{jti}` and the read
   path has no fallback, so any refresh token issued before that deploy stops
   working and the customer must sign in again. Expected impact is nil — customer
   OTP was never deliverable in production before the SMS layer shipped — but if
   zero disruption is wanted, read the old key as a fallback for 30 days (the
   refresh TTL) and then delete the fallback.

3. **`retryTransientD1Error` only wraps `truncateAll`.** Miniflare's workerd IPC
   throws `fetch failed` / `ECONNRESET` at roughly a 5% rate; the baseline build
   is protected, but arbitrary queries inside real-integration tests are not.
   Observed as 3 of 6 failures in a full suite run. When CI starts going red at
   random, this is why.

4. **Linting from the repo root does not lint three of the apps.**
   `eslint.config.js` ignores `apps/customer-app/**`, `apps/admin-dashboard/**`
   and `apps/kitchen-display/**` ("Apps have their own eslint configs"), so
   `npx eslint apps/customer-app/...` from the root reports a vacuous pass. Run
   `pnpm lint` from inside the app.

5. **A vendor outage consumes the caller's OTP quota.** `enforceOtpRateLimit`
   increments before the send, so a failing SMS vendor can lock a customer out
   for an hour (3/hour/phone). Refunding the counter on send failure was left out
   deliberately; revisit if it bites.

6. **Verification email failures are only surfaced on `/register`.**
   `/forgot-password` and `/resend-verification` must stay silent about delivery
   to avoid becoming account-existence oracles, so a broken email provider is
   invisible on those two paths apart from a `console.error`. Worth an alert on
   that log line.
