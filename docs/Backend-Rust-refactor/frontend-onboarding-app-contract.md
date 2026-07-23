# `apps/onboarding-app` — Backend Contract Reference (for Rust Backend Rewrite)

Source reviewed: `apps/onboarding-app/src/services/api.ts`, `src/stores/onboarding.ts`, `vite.config.ts`, `package.json`, `.env.production` (only committed env file — no `.env.development` ships with this app). Also read `src/views/ApplyView.vue` and `src/views/SuccessView.vue` to confirm which response/request fields are *actually consumed* versus merely typed (UI styling/markup itself is out of scope and not documented below). Excludes `src/stores/onboarding.test.ts`.

This document describes what the **Vue 3 client actually sends and actually reads** — the contract a Rust rewrite of `apps/management-api` must preserve to avoid silently breaking this app. It does not document UI components or styling.

**Headline finding**: this is by far the thinnest backend contract in the monorepo — a single service file (`src/services/api.ts`) with exactly **two** endpoint calls, both against `apps/management-api`'s public `/api/v1/onboarding/*` routes. One of the two (`GET /onboarding/applications/:id`) is fully implemented and typed but has **zero callers** anywhere in `src/` outside the service file itself — it is dead code in the current build. The flow is otherwise a single anonymous POST to create an application, after which everything the success screen displays comes from either the POST response or the client's own form state (session-persisted), never from a follow-up read.

---

## 1. Purpose & connection topology

Onboarding-app talks to exactly **one** backend:

| Backend | Base URL | Client construct | Purpose |
|---|---|---|---|
| `apps/management-api` | `/api/v1` (dev, proxied) / `VITE_API_URL` (prod, absolute) | `apiClient` (bare `axios.create`, `src/services/api.ts:24-30`) | Public, unauthenticated self-service onboarding: create an application, (unused) fetch application status |

### Base URL resolution (`src/services/api.ts:8-19`)

```ts
function resolveApiBase(): string {
  const apiBase = import.meta.env.VITE_API_URL;
  if (apiBase) return apiBase;
  if (import.meta.env.PROD) throw new Error("VITE_API_URL is required for production builds");
  return "/api/v1";
}
```

Same guarded-fallback pattern used elsewhere in the monorepo: production build fails fast if `VITE_API_URL` is unset; dev falls back to the relative `/api/v1` path so the Vite proxy handles it.

### Vite dev proxy (`vite.config.ts:15-20`)

```
/api → VITE_API_URL env var, else http://localhost:8789   (changeOrigin: true, no path rewrite)
```

Port `8789` is `apps/management-api`'s dev port, consistent with `CLAUDE.md`'s app table.

### Env files present

- `.env.production` (committed): `VITE_API_URL=https://manage-api.makanmasak.com/api/v1`, `VITE_CUSTOMER_APP_URL=https://makanmasak.com`
- **No `.env.development` or `.env.development.example`** ships with this app (confirmed via directory listing) — matches `CLAUDE.md`'s note that `onboarding-app` is one of the two Vite apps that doesn't ship a dev env file; local dev relies on the `resolveApiBase()`/Vite-proxy fallback above, or a gitignored `.env.development.local`.

### Non-API outbound link (not a backend call)

`src/views/HomeView.vue:14-29` builds a static demo hyperlink to the customer-facing ordering app: `${VITE_CUSTOMER_APP_URL}/restaurant/{DEMO_RESTAURANT_ID}/shop/order-type` with a hardcoded demo restaurant UUID (`019469a0-0099-7000-8000-000000000099`). This is a plain `<a>`/navigation target, not a fetch — no request/response contract to preserve, listed here only because it's the only other place a backend base-URL-shaped env var is read.

### Auth token storage

None. There is no login step anywhere in this app — see §3.

---

## 2. Endpoint inventory

All paths relative to `/api/v1`. Both endpoints are implemented in `src/services/api.ts` under the `onboardingApi` object and are the **only** two network calls this app makes.

| Method | Path | Called from | Request body/headers | Response fields the client actually reads |
|---|---|---|---|---|
| POST | `/onboarding/applications` | `onboardingApi.createApplication()` (`api.ts:169-192`), invoked by `useOnboardingStore().submitApplication()` (`stores/onboarding.ts:57-87`), invoked by `ApplyView.vue` submit handler | JSON body `{ businessName, contactName, contactEmail, contactPhone, planId, latitude, longitude }` — see `CreateApplicationData` (`api.ts:52-60`); no auth header | `data.applicationId`, `data.applicationSecret`, `data.assignedSubdomain` — all three are stored into Pinia state and session-persisted. **`data.status` is received (typed on `ApplicationResponse`) but is never assigned anywhere** — the store instead hardcodes the local `application.status` to the literal string `"submitted"` immediately after the call (`stores/onboarding.ts:69-72`), regardless of what the server returned. |
| GET | `/onboarding/applications/:id` | `onboardingApi.getApplication()` (`api.ts:197-222`) | Header `X-Onboarding-Secret: {applicationSecret}`; no body | Fully typed (`ApplicationDetails`: `id, businessName, contactName, contactEmail, latitude, longitude, planId, assignedSubdomain, status, tenantId?, createdAt, completedAt?`) but **dead code** — confirmed zero call sites for `onboardingApi.getApplication` anywhere in `src/` besides its own definition. No view, store action, or router guard calls it. |

### Cross-check against `docs/Backend-Rust-refactor/management-api.md`

The documented server routes (`management-api.md:187-188`, confirmed directly against `apps/management-api/src/routes/onboarding.ts`) match the client's two calls path-for-path and, for the most part, field-for-field, with two discrepancies worth flagging for the rewrite:

1. **`planId` enum mismatch.** Server-side zod schema (`apps/management-api/src/routes/onboarding.ts:30-33`) accepts `"standard" | "professional" | "enterprise" | "trial"`, nullable/optional, and `OnboardingService.ts:157` defaults to `"trial"` when omitted. The client's `CreateApplicationData.planId` type (`api.ts:57`) and the form's default (`ApplyView.vue:21`, `"standard"`) only ever send `"standard" | "professional" | "enterprise"` — `"trial"` is never sent by this client and isn't even a valid TS value for the field. This is asymmetric, not a breaking bug today (client never triggers the `trial` default path since it always sends a `planId`), but a Rust rewrite that keeps `trial` as a valid enum member for *other* callers (e.g. seeded/test data, an internal admin tool) would produce a `planId` value this client's `getPlanLabel()` fallback (`SuccessView.vue`) doesn't have a label for and silently mislabels as "standard" — moot today because `getApplication` (the only path that would ever surface a server-assigned `trial` value back to this UI) is dead code, but would matter if that endpoint were ever wired up.
2. **Client-side validation is looser than the server's zod schema**, so certain requests that pass client validation can still bounce off server-side field constraints (see §4) — the client has no knowledge of the server's `min(2)/max(100)` string bounds or `min(8)/max(20)` phone bounds; it only checks non-empty/regex-shaped locally (`ApplyView.vue:36-73`).

No mismatches in the other direction were found — the client does not reference any onboarding field or endpoint absent from the documented server surface, and does not call any `/admin/onboarding/*` route (those are protected admin routes, out of scope for this anonymous-only app).

---

## 3. Auth & session

- **Fully anonymous.** No login, no bearer token, no cookies are set or read by this app. The `POST /onboarding/applications` call carries no credentials at all.
- **Application-secret carried client-side only for the (dead) GET path.** The server's contract requires `X-Onboarding-Secret` (a one-time secret returned exactly once, at creation, and only compared via constant-time hash match server-side — see `management-api.md:334-338`) to fetch application status later. The client dutifully stores `applicationSecret` in Pinia state, but:
  - `applicationSecret` is **explicitly excluded** from what gets written to `sessionStorage` (`stores/onboarding.ts:117-125` — the persisted `data` object lists `application`, `applicationId`, `assignedSubdomain`, `completionResult`, but not `applicationSecret`). So a page reload loses the secret from memory (Pinia state resets) and it was never in session storage to begin with.
  - Since `getApplication()` is never called, this loss has no observable effect today — but it does mean **if a future feature reintroduces a "check my application status" page, the secret will not survive a reload** unless persistence is added first.
- **Session-storage key**: `onboarding_application` (`stores/onboarding.ts:101, 124`). Persisted shape: `{ application, applicationId, assignedSubdomain, completionResult: null }`. `completionResult` is always written as `null` — the `completionResult` ref (`stores/onboarding.ts:34`) is typed `ref<null>(null)` and never set to anything else anywhere in the store; it is dead state.
- Multi-step wizard state (Apply → Success) is carried entirely through this one Pinia store + its sessionStorage mirror — there is no server-side session/draft concept the client talks to. The "wizard" is a single POST; there's no partial-save/resume-draft endpoint.

---

## 4. Error handling contract

`src/services/api.ts` defines a shared `ApiResponse<T>` envelope type and an `extractApiError()` helper (`api.ts:112-130`) that explicitly supports **two** shapes:

```ts
// current (nested) — what the server actually emits, confirmed against
// apps/management-api/src/index.ts:94-126 app.onError handler
{ success: false, error: { code, message, details? } }

// legacy (flat) — fallback only, for not-yet-updated deployments
{ success: false, error: string, code?, details? }
```

The code comment at `api.ts:104-111` is explicit that the flat-format branch is dead-deployment compat (`TODO(cleanup): drop the flat fallback once every deployed management-api is at or past commit 7151ca2c`) — **as of the current `apps/management-api` source, only the nested format is ever produced.** A Rust rewrite only needs to emit the nested `{success:false, error:{code,message,details}}` shape; the flat fallback exists purely for the client's own rollout-safety and can be dropped from the client (not the server) without server-side coordination.

- **Validation-error details are parsed but never rendered.** `ApiError.details` (`api.ts:88-101`) is typed as `Array<{path: string[], message: string}>` and is captured on thrown errors, but grep across `src/**/*.vue` confirms **only `store.apiError` (a plain string, the top-level `message`) is ever displayed** — via a toast (`ApplyView.vue:98`) and an inline banner (`ApplyView.vue:154-157`). There is **no field-level error UI**: a 422/`VALIDATION_ERROR` response's `details` array (real shape: Zod `ZodIssue[]`, richer than the client's simplified `{path, message}` type — includes `code`, `expected`, `received`, etc., though sanitized server-side via `sanitizeApiErrorDetails`) is silently discarded after being parsed into the `ApiError` instance.
- **Practical consequence**: because client-side validation (`ApplyView.vue:36-73`) is looser than the server's zod schema (e.g., client only requires non-empty `businessName`/`contactName`, server requires `min(2).max(100)`; client requires non-empty phone, server requires `min(8).max(20)`), a request that passes client validation can still get a `400 VALIDATION_ERROR` from the server — and when it does, the user only ever sees the single top-level `message` string ("Validation failed") via toast/banner, with no per-field highlighting, even though the server's `details` array would in principle allow it.
- **Network-level errors** (`handleApiError()`, `api.ts:132-159`): axios timeout (30s, `api.ts:29`) → `ApiError("Request timed out", "TIMEOUT")`; no response at all → `ApiError("Network error - please check your connection", "NETWORK_ERROR")`; anything else unexpected → `ApiError("An unexpected error occurred", "UNKNOWN_ERROR")`. These synthetic codes are entirely client-invented and never come from the server.
- Both endpoint wrappers additionally guard on `!response.data.success || !response.data.data` even on a `2xx` HTTP status, throwing a client-side `ApiError` (`"Failed to create application"`/`"CREATE_FAILED"` or `"Application not found"`/`"NOT_FOUND"`) if the envelope's `success` flag is false or `data` is missing — so a Rust rewrite must keep `success: true` and a non-null `data` on all successful responses, not rely on HTTP status alone.

---

## 5. Rust rewrite compatibility notes

Concrete field/shape sensitivities a Rust rewrite of the onboarding routes must preserve exactly, ranked by what would silently break vs. loudly break:

1. **`POST /onboarding/applications` response must include `applicationId`, `applicationSecret`, `assignedSubdomain` as top-level strings inside `data`.** These three are the *only* response fields this client actually consumes today. Renaming, nesting, or omitting any of the three breaks the success screen and/or (for `applicationSecret`) makes any future re-enablement of the status-check flow impossible.
2. **`data.status` can change shape/values freely without breaking this client** — it's read into a typed field but never assigned to any reactive state; the UI always displays a hardcoded "submitted"/"pending review" string regardless. Low risk, but worth knowing this is the one field in the response the client doesn't actually behaviorally depend on.
3. **The envelope must stay `{success: bool, data: {...}}` on success and `{success: false, error: {code, message, details?}}` on failure** (nested, not flat) — the client's `!response.data.success || !response.data.data` guard and its `extractApiError()` nested-shape branch both depend on this. HTTP status codes alone are not sufficient signal to this client; `success`/`data` presence is checked explicitly.
4. **No file uploads anywhere in this flow.** The only payload is the small JSON `CreateApplicationData` object (7 scalar fields: 4 strings, 1 constrained-enum string, 2 numbers). No multipart, no binary body, nothing to preserve on that front.
5. **`planId` enum surface**: server must keep accepting `"standard" | "professional" | "enterprise"` at minimum (the only values this client ever sends); whether `"trial"` continues to exist server-side is irrelevant to this client's request path, only relevant if a status-read UI is ever built on top of the currently-dead `getApplication()` call (see §2 item 1).
6. **`X-Onboarding-Secret` header name and semantics must be preserved exactly** if/when `getApplication()` is ever wired up — it's the only auth mechanism this app knows about for that route, and it's currently the single point where this "anonymous" app carries any credential at all. Note again that the client does not currently persist this secret across a reload (§3), so today this is a latent, not active, integration point.
7. **Multi-step state is entirely client-owned.** There is no server-side "draft" or "resume this onboarding session" concept for a Rust rewrite to replicate — the wizard is exactly one POST, and Success-page state comes from (a) the POST response's three fields and (b) the form data the client already had before the call, mirrored into `sessionStorage` under key `onboarding_application`. A rewrite does not need to support partial/resumable submissions to remain compatible with this client.
8. **Validation error `details` shape can be relaxed or changed** without breaking this client at runtime (it's parsed into a typed field but never rendered) — but changing it is a missed opportunity, not a compatibility requirement, since the current client already ignores it. If the rewrite intends to eventually support field-level error display, that would require *client* changes too, not just server changes.
