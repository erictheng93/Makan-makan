# `apps/image-processor` — Cloudflare Images Transform Worker

> Source of truth for this document: `apps/image-processor/src/**` (excluding
> `*.test.ts`/`__tests__/`), `apps/image-processor/wrangler.toml`,
> `apps/image-processor/package.json`, plus the calling code in
> `apps/admin-dashboard`. This documents the **current** code state (post
> UUID v7 auth alignment, idle R2 binding removal, cron trigger + production
> route addition) — not the commit history.

## 1. Purpose & responsibilities

`image-processor` is a standalone Cloudflare Worker (local port **8790**,
production route `images.makanmasak.com`) that owns the entire Cloudflare
Images integration for the platform: upload, variant generation, transform
delivery, metadata storage/query, bulk ops, analytics, and scheduled
cleanup/reporting.

It is **not** proxied through the main API. Per
`docs/Backend-Rust-refactor/api-features-identity-tenant.md` §8 ("menu"
module) and its "Image pipeline" section, the menu-image flow is entirely
**client-orchestrated**:

1. Admin UI (`apps/admin-dashboard`) uploads the file **directly** to
   `${VITE_IMAGE_API_URL}/images/upload?category=menu` — i.e. straight to
   this Worker, not through `apps/api` — using a bearer token obtained from
   `getAuthToken()` (`apps/admin-dashboard/src/utils/authTokenProvider`,
   consumed in
   `apps/admin-dashboard/src/composables/useImageUpload.ts:82-91`). The
   composable's own comment explains why: `getAuthToken()` reads the
   auth-client's live token storage directly because the Pinia store's
   cached ref can lag behind silent token refreshes.
2. This Worker validates that same staff JWT independently (see §4) and
   uploads to Cloudflare Images, returning `{id, variants:{...}}`.
3. The frontend picks `{thumbnail, small, medium, large}` out of the
   response (`pickSupportedVariants` in `useImageUpload.ts:37-47`) and calls
   the **main API's** `PUT /api/v1/menu/items/:id` with
   `{imageId, imageUrl: variants.medium, imageVariants}` to write the
   reference onto the menu item row. (The upload handler at
   `apps/admin-dashboard/src/views/MenuView.vue:880-887` only assigns the
   result onto local form state; the actual PUT happens in `saveMenuItem`,
   `apps/admin-dashboard/src/composables/useMenuManagement.ts:200`, invoked
   from `MenuView.vue:892`.) The main API
   treats these fields as an opaque pass-through — it never talks to this
   Worker or to Cloudflare Images itself.
4. If the item previously had a **different** `imageId`, the frontend
   issues a separate `DELETE ${VITE_IMAGE_API_URL}/images/{oldImageId}`
   against this Worker to clean up the orphaned upload
   (`MenuView.vue:919-942`, `deletePreviousImageIfChanged`). This cleanup is
   entirely client-side/best-effort — if the browser crashes/navigates away
   between steps 3 and 4, the old image is never deleted client-side (the
   Worker's own cron job is the only backstop, and it does **not** target
   this specific "orphaned by replacement" case — see §6).

Cross-reference: `docs/Backend-Rust-refactor/api-features-identity-tenant.md`
§8 documents the main API's side of this contract in full (menu-item
`imageId`/`imageUrl`/`imageVariants` Zod validation, no DB-level FK to
`images`, trust-boundary implications for a Rust rewrite).

## 2. Runtime & bindings

From `apps/image-processor/wrangler.toml`:

- **Worker name**: `makanmasak-image-processor` (dev), `makanmasak-image-processor-prod` (`env.production`)
- **Entry**: `src/index.ts`, `compatibility_date = "2024-09-23"`, `nodejs_compat` flag on
- **Dev server**: port 8790, `local_protocol = "http"`; `inspector_port` intentionally omitted (workerd Windows crash workaround — see root `CLAUDE.md`); `package.json`'s `dev` script pins `--inspector-port 9234` via CLI flag instead
- **Cron trigger**: `[triggers] crons = ["0 1 * * *"]` — 01:00 UTC daily (09:00 Taiwan time)
- **Production route**: `[[env.production.routes]] pattern = "images.makanmasak.com"`, `custom_domain = true`

**Bindings** (production, `env.production`):

| Binding | Type | Purpose |
| --- | --- | --- |
| `IMAGE_CACHE` | KV namespace (id `1bdf850866984564b11d66ab5617744d`) | Metadata/job cache, rate-limit counters |
| `TOKEN_BLACKLIST` | KV namespace (id `30ba7daf1e4c41438233542de10dd02f`) | Revoked-token check in auth middleware |
| `DB` | D1 (`makanmasak-prod`, id `4e3c7ba8-5aa7-4652-bfea-a9c565b3a141`) | Shared platform database — `images`, `image_views`, `image_processing_jobs` tables |

Development-only (top-level, unused when `wrangler dev --local` is active): `IMAGE_CACHE` (`id = "local"`), `DB` (`makanmakan-local`, `id = "local"`).

There is **no R2 binding** — a prior idle R2 binding was dropped (per recent
commit history); all image bytes are stored in Cloudflare Images itself, not
in R2.

**Vars** (non-secret, committed in `wrangler.toml`, both `[vars]` and
`[env.production.vars]`):

- `IMAGE_API_BASE_URL` = `https://api.cloudflare.com/client/v4/accounts`
- `CLOUDFLARE_ACCOUNT_ID` = `bdddc08c066a9abc285d75fe5947a468`
- `CLOUDFLARE_IMAGES_ACCOUNT_HASH` — the **imagedelivery.net delivery hash**, distinct from the account ID; production value is currently the literal placeholder `REPLACE_ME__PRODUCTION__images_account_hash` in the committed file (must be filled from Dashboard → Images → Developer Resources before a real prod deploy — `scripts/check-production-config.cjs` blocks deploys on this: it rejects unfilled/malformed hashes and specifically rejects the account-ID value being pasted in by mistake)
- `MAX_IMAGE_SIZE_MB` = `10`
- `ALLOWED_MIME_TYPES` = `image/jpeg,image/png,image/webp,image/gif`
- `DEFAULT_VARIANTS` = `thumbnail,small,medium,large,original`
- `THUMBNAIL_SIZE`/`SMALL_SIZE`/`MEDIUM_SIZE`/`LARGE_SIZE` = `150x150`/`300x300`/`600x600`/`1200x1200`
- `MAX_UPLOADS_PER_MINUTE` = `20`, `MAX_TRANSFORMS_PER_MINUTE` = `100`
- Production-only: `NODE_ENV=production`, `API_VERSION=v1`, `CORS_ORIGIN=https://admin.makanmasak.com`

**Secrets** (names only — set via `wrangler secret put`, not in the committed
toml; declared in `src/types/env.ts`):

- `JWT_SECRET` — required, must be ≥32 chars or the auth middleware hard-fails with 500 ("Server configuration error"); this is the **same** secret the main API (`apps/api`) uses to sign staff JWTs (shared-secret HS256 verification, not an introspection call — see §4)
- `CLOUDFLARE_IMAGES_API_TOKEN` — Cloudflare Images API token used for all `fetch()` calls to `api.cloudflare.com`
- `API_KEY` (optional) — used only by the unused-in-routes `apiKeyAuth` middleware (see §4)
- `SLACK_WEBHOOK_URL` (optional) — error/daily-stats notifications

## 3. HTTP surface

Router mount points in `src/index.ts`: `app.route("/images", imagesRouter)`,
`app.route("/analytics", analyticsRouter)`. All responses use a bare
`{success, data|error}` shape defined ad hoc per-route in this Worker — it
does **not** use the main API's `ApiError`/ `notFound()`/etc. factory
convention from `apps/api/src/shared/utils/api-error.ts` (that convention is
specific to `apps/api`, not shared by this Worker).

| Method | Path | Auth | Purpose | Request | Response |
| --- | --- | --- | --- | --- | --- |
| GET | `/` | none | Service info/feature list | — | `{name, version, ..., limits}` |
| GET | `/health` | none | DB + KV health probe (writes/reads/deletes a KV test key, runs `SELECT 1` via Drizzle) | — | `{success, status, services:{database,cache}, performance}`, 503 if any dependency unhealthy |
| GET | `/info` | none | Liveness/capability probe — the endpoint hit by the production deploy-verification workflow (`.github/workflows/deploy-production.yml`) | — | `{service, version, capabilities, supportedFormats, variants, rateLimits}` |
| POST | `/images/upload` | JWT (staff) | Upload image, generate variants, save metadata | `multipart/form-data`: `file` field; query: `variants?, category?, altText?, caption?, tags?` (CSV), `restaurantId?` (admin-only override) | `201 {success, data:{id, filename, originalFilename, size, variants, uploadedAt}}` |
| GET | `/images/:imageId` | optional (public images allowed) | Get image metadata | — | `{success, data: ImageMetadata}` |
| PUT | `/images/:imageId` | JWT, role ∈ {0,1,2} | Update metadata (alt text, caption, category, tags, variants) | JSON body per `imageSchemas.updateBody` | `{success, message}` |
| DELETE | `/images/:imageId` | JWT, role ∈ {0,1,2} | Delete from Cloudflare Images + DB metadata | — | `{success, message}` |
| GET | `/images` | JWT | List images (paginated, filtered) | query: `restaurantId?, category?, uploadedBy?, tags?, page, limit, sortBy, sortOrder` | `{success, data:{images, pagination}}` |
| GET | `/images/:imageId/view` | optional | Redirect (302) to the best-format/variant delivery URL | query: `variant?, width?, height?, fit?, format?, quality?` | `302` redirect to `imagedelivery.net/...` |
| POST | `/images/:imageId/process` | JWT, role ∈ {0,1,2} | Queue async transformation/variant-regeneration job | JSON body per `imageSchemas.processParams` (`transformations[], variants[], format?, quality?`) | `202 {success, data:{jobId, status:"pending"}}` |
| GET | `/images/jobs/:jobId` | JWT | Poll processing job status | — | `{success, data: ImageProcessingJob}` |
| POST | `/images/bulk` | JWT, role ∈ {0,1} | Bulk delete/update_category/update_tags/generate_variants across up to 100 images | JSON `{imageIds[1..100], operation, data?}` | `{success, data:{operation, processed, successful, failed, results[]}}` |
| GET | `/analytics/dashboard` | JWT, role ∈ {0,1} | Aggregated image analytics | query: `restaurantId?, dateFrom?, dateTo?` | `{success, data: ImageAnalytics}` |
| GET | `/analytics/storage` | JWT, role ∈ {0,1} | Storage usage breakdown (delegates to `@makanmakan/database`'s `ImageService.getStorageAnalytics`) | same query | `{success, data}` |
| GET | `/analytics/usage` | JWT, role ∈ {0,1} | Usage/view analytics (delegates to `getUsageAnalytics`) | same query | `{success, data}` |
| GET | `/analytics/performance` | JWT, role ∈ {0,1} | Processing-job performance (delegates to `getPerformanceAnalytics`) | same query | `{success, data}` |
| GET | `/analytics/export` | JWT, role ∈ {0,1} | **Stub only** — does not generate a file; returns a fabricated `download_url` pointing at `api.makanmakan.com` (a domain that does not match this Worker's own routes) | query: `+type, format` | `{success, data:{type, format, message:"...would generate...", download_url, expires_at}}` |

**Upload pipeline detail** (`POST /images/upload`, `src/routes/images.ts:37-179`):

- Middleware chain: `authMiddleware` → `uploadRateLimit` (KV-backed, 20/min default) → `checkFileSize` (`Content-Length` header check against `MAX_IMAGE_SIZE_MB`, fails **only if the header is present** — a missing/spoofed `Content-Length` bypasses this check) → `validateFileType` (parses the `multipart/form-data`, checks the `file` field's declared MIME type against `ALLOWED_MIME_TYPES`) → `securityScan` (magic-number check: JPEG `FFD8FF`, PNG `89504E47`, GIF `474946 38`, WebP `52494646` RIFF header, plus extension/MIME cross-check) → `validateQuery`.
- Restaurant scoping: non-admin (`role !== 0`) uploads are always attributed to the caller's own `user.restaurantId` from the JWT; only role 0 (admin) may pass a different `restaurantId` in the query string. If neither is present, 403.
- On DB metadata-save failure **after** a successful Cloudflare Images upload, the handler compensates by calling `cloudflareImages.deleteImage(...)` to avoid an orphaned upload (`images.ts:136-147`) — this is the only place such compensation happens; there is no equivalent for a crash between the two steps.
- Analytics: `imageService.recordImageView(id, "upload")` fired via `c.executionCtx.waitUntil` (non-blocking).

**Validation limits** (`src/middleware/validation.ts`):

- `imageSchemas.bulkOperationBody`: 1–100 image IDs per call.
- `imageSchemas.processParams` transformation bounds: `width/height` ≤ 2048px, `angle` ∈ [-360,360], `radius` ∈ [0,50], `sigma` ∈ [0,10], `amount` ∈ [0,100], `background` must be a `#RRGGBB` hex string.
- `validateImageDimensions` middleware exists but is **not wired into any route** and its body is a no-op placeholder (`console.log("...feature needs implementation")`, `validation.ts:278-320`) — dead code as of this reading.

## 4. Auth

`src/middleware/auth.ts` implements a **shared-secret HS256 JWT verification**
— there is no introspection call back to the main API; this Worker decodes
and verifies the token independently using `hono/jwt`'s `verify()` against
its own `JWT_SECRET` binding, which must be provisioned with the **same**
value as `apps/api`'s `JWT_SECRET` secret for tokens to validate.

`authMiddleware` (used on all mutating/listing routes):

1. Requires `Authorization: Bearer <token>`; missing/malformed → 401.
2. Requires `JWT_SECRET` configured and ≥32 chars, else 500 ("Server configuration error").
3. Checks `TOKEN_BLACKLIST` KV for `token:{token}` — if present, 401 ("Token has been invalidated"); this check is skipped only if the KV binding itself is absent, not skippable by request.
4. Verifies signature via `hono/jwt` `verify(token, JWT_SECRET, "HS256")`.
5. Manual claim checks beyond signature, in this exact order (`auth.ts:129-165`): `exp` required and not expired (129-131); `iat` rejected if >60s in the future (clock-skew allowance, 134-137); `nbf` rejected if >60s in the future (140-143); then the **UUID v7 payload check** (step 6, 146-149); then `role` must be an integer in `[0,4]` (152-154); then **token age** `now - iat` ≤ 72h (158-165; `MAX_ACCESS_TOKEN_AGE_SECONDS` mirror of `apps/api/src/middleware/auth.ts` — comment explicitly notes this must stay in sync). A Rust port aiming for error-message parity must preserve this order — role is rejected before token-age, and the UUID check runs before both.
6. **UUID v7 requirement** (runs between the `nbf` and `role` checks, see step 5): `toJwtAuthPayload` (`auth.ts:29-56`) rejects any payload whose `sub` claim does not match `UUID_V7_PATTERN` (`^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`) — i.e. version nibble `7` and RFC-4122 variant nibble. Legacy integer-ID tokens are **not** accepted at all. `username` must be a non-empty string; `restaurantId` (if present) must be string/number and is coerced to `String(...)`.
7. On success, sets `c.set("user", {id, username, role, restaurantId})` from the JWT's `sub`/`username`/`role`/`restaurantId` claims (note: `id` comes from `sub`, not a `payload.id` field).
8. If `exp - now < 3600s`, sets response headers `X-Token-Refresh-Recommended: true` and `X-Token-Expires-In` — advisory only, does not block the request.

Error paths: expired token → `{success:false, error:"Token has expired"}` 401 (both the explicit `exp` check and the caught `JwtTokenExpired` error name from `hono/jwt`); malformed/invalid signature → `JwtTokenInvalid` caught → `{error:"Invalid token format"}` 401; any other exception → generic `{error:"Authentication failed"}` 401 (no stack/detail leaked).

Other auth-related middleware in the same file:

- `optionalAuth` — same verification, but swallows all failures and calls `next()` regardless (used for public/optional-auth routes like `GET /images/:imageId` and `.../view`).
- `requireRole(allowedRoles)` — 401 if no `user` in context, 403 if `role` not in the allowed set.
- `apiKeyAuth` — validates `X-API-Key` header against the `API_KEY` secret (constant-time-unsafe `!==` comparison); **defined but not mounted on any route** in `src/routes/*.ts` — dead code as of this reading, intended for service-to-service calls that don't currently exist.
- `checkImageAccess` — role-0 bypass; otherwise loads the image row (`images.restaurantId`, `images.uploadedBy` via Drizzle) and allows access if the caller uploaded it, shares its `restaurantId`, or the image has `restaurantId === null` (public); unauthenticated callers may only reach `restaurantId === null` images.
- `rateLimiter(max, windowMs)` — fixed-window counter in `IMAGE_CACHE` keyed by `rate_limit:{CF-Connecting-IP}:{windowBucket}`; **fails open** on any KV error (comment: "如果速率限制檢查失敗，允許請求繼續"). `uploadRateLimit`/`transformRateLimit` are convenience wrappers reading `MAX_UPLOADS_PER_MINUTE`/`MAX_TRANSFORMS_PER_MINUTE`.
- `corsMiddleware` — allow-list from `CORS_ORIGIN` (comma-split) in production, or a hardcoded localhost list (ports 3000/3001/3002/3010/3011) in `NODE_ENV=development`; otherwise empty (no wildcard fallback). Handles `OPTIONS` preflight directly with 204.
- `checkFileSize(maxSizeMB)` — `Content-Length`-header-based only (see upload pipeline caveat above).

## 5. Cloudflare Images integration

All Cloudflare Images API calls live in `src/utils/cloudflare-images.ts`
(`CloudflareImagesAPI` class). Base URL is built as
`${IMAGE_API_BASE_URL}/${CLOUDFLARE_ACCOUNT_ID}/images/v1`
(`https://api.cloudflare.com/client/v4/accounts/{account_id}/images/v1`),
authenticated with `Authorization: Bearer ${CLOUDFLARE_IMAGES_API_TOKEN}` on
every call. **No retry logic** is implemented anywhere in this class — every
method is a single `fetch()` wrapped in try/catch that surfaces
`{success:false, error}` on any failure or non-`success` API response body.

- **Upload** (`uploadImage`): `POST {baseURL}` with `multipart/form-data`
  (`file`, optional `id` = desired filename, `requireSignedURLs`,
  `metadata[key]=value` per entry — note Cloudflare Images metadata is
  flattened into individual `metadata[...]` form fields, not a single JSON
  blob). Does **not** set `Content-Type` manually (left to the browser/runtime
  to add the multipart boundary).
- **Get details** (`getImageDetails`): `GET {baseURL}/{imageId}`.
- **List** (`listImages`): `GET {baseURL}?page=&per_page=` — defined but not
  called from any route (routes use the D1-backed `ImageService.listImages`
  instead, which queries this Worker's own `images` table, not Cloudflare's
  live image list).
- **Delete** (`deleteImage`): `DELETE {baseURL}/{imageId}`.
- **Update metadata** (`updateImageMetadata`): `PATCH {baseURL}/{imageId}`
  with `metadata[key]=value` form fields — defined but **not called from any
  route**; the route-level "update metadata" (`PUT /images/:imageId`) only
  updates this Worker's own D1 `images` row via `ImageService`, it never
  calls Cloudflare's PATCH endpoint. Cloudflare-side metadata and D1-side
  metadata can therefore drift.
- **Variant/transform URLs** are constructed **client-side as string
  templates**, not via any Cloudflare Images "variants" API call:
  `generateImageVariants(imageId, accountHash)` builds
  `https://imagedelivery.net/{accountHash}/{imageId}/{variantName}` for
  `original|thumbnail|small|medium|large` plus a few hardcoded custom
  transforms (`square_thumbnail`, `webp_medium`, `mobile_optimized`,
  `retina`) using Cloudflare's URL-based flexible variants syntax (e.g.
  `w=150,h=150,fit=crop,gravity=auto`) — this assumes those named variants
  (`thumbnail`/`small`/`medium`/`large`) are pre-configured in the Cloudflare
  dashboard; the Worker does not create/configure variants via API.
  `buildTransformationURL` builds ad hoc transform paths from the
  `ImageTransformation[]` request shape (resize/crop/rotate/blur/brighten/
  sharpen → comma-joined query-like segment in the URL path, Cloudflare's
  "flexible variants" syntax, not query-string parameters).
- **Signed URLs**: `generateSignedURL` is a stub — it returns the plain
  `/original` delivery URL and does not implement Cloudflare's JWT-based
  signed-URL scheme at all (comment: "would require implementing JWT signing
  ... For now, return the direct URL").
- **EXIF/dimension extraction**: `extractImageMetadata` only returns
  `{size, format}` from the `File` object — no real width/height/EXIF
  parsing (comment: "placeholder for basic metadata"); `width`/`height` are
  therefore always `undefined` on freshly uploaded images unless populated
  by some other path.
- A separate, **unused-in-routing** `ImageCompressionService`
  (`src/services/ImageCompressionService.ts`) duplicates a chunk of this
  same logic (its own `uploadAndCompress`/`deleteImage`/variant-URL builder
  against a `CloudflareImagesConfig{accountId, apiToken, deliveryUrl}` it
  takes directly rather than from `Env`) — it is exercised only by its own
  test file and is not imported by `index.ts` or either router. Treat as
  dead/parallel code, not the live upload path.

Account-hash safety: `scripts/check-production-config.cjs` specifically
guards against `CLOUDFLARE_IMAGES_ACCOUNT_HASH` being left as the placeholder
or accidentally set to `CLOUDFLARE_ACCOUNT_ID`'s value, because that produces
uploads that succeed (they hit `api.cloudflare.com` with the *account ID*)
but return delivery URLs (built from the *hash*) that 404 — the two values
are visually similar-looking hex/alphanumeric strings.

## 6. Scheduled work

`export default.scheduled` in `src/index.ts:278-315`, triggered by the single
cron `0 1 * * *` (01:00 UTC / 09:00 Taiwan). Every run does, unconditionally,
in sequence (each step wrapped individually in try/catch so a query failure
in one step does not prevent the next from attempting):

1. **`cleanupExpiredJobs`** — `DELETE FROM image_processing_jobs WHERE created_at_ms < now - 7d` via Drizzle (`imageProcessingJobs`, `createdAt` column). Retention: 7 days.
2. **`cleanupOldViews`** — `DELETE FROM image_views WHERE viewed_at_ms < now - 30d` via Drizzle (`imageViews`, `viewedAt` column). Retention: 30 days.
3. **`cleanupExpiredCache`** — lists `IMAGE_CACHE` keys with prefix `health-` and deletes them; this is mopping up leftover keys from the `/health` endpoint's own KV-put/delete round trip (`health-{timestamp}`), not general image-cache expiry (KV TTLs already auto-expire everything else).
4. **Daily stats report** — only if `event.cron === "0 1 * * *"` (i.e. always true given there's only one cron expression configured): queries yesterday's `images` uploads/total size/distinct restaurants and `image_processing_jobs` completed/failed counts (both via Drizzle `sql` templates over schema refs — Layer 2 style), then POSTs a Slack message (`sendSlackMessage`) if `SLACK_WEBHOOK_URL` is set. No-op silently if the webhook is unset.

**Idempotency**: none of the three cleanup steps are gated by a run marker —
they are naturally idempotent because they're pure time-window deletes
(re-running the same day is a harmless no-op on already-deleted rows). The
daily-stats Slack post has **no de-duplication** — if the Worker were
triggered twice for the same cron tick (Cloudflare doesn't normally do this,
but a manual `wrangler dev`/local trigger could), the same day's report would
be posted to Slack twice.

**Not covered by this cron**: there is no job that finds/deletes Cloudflare
Images uploads whose `imageId` was orphaned by a client crash between
"upload succeeded" and "menu item write-back" (see §1 step 3–4) — the
scheduled task only cleans up this Worker's own job/view log tables, never
calls Cloudflare's Images API to reconcile orphaned uploads against the
`images` D1 table or against actual menu-item references.

On any uncaught error in the scheduled handler, `sendErrorNotification` posts
to Slack (if configured) with the error message and a truncated (500-char)
stack trace.

## 7. Cross-service interactions

**Callers (inbound)**:

- `apps/admin-dashboard` — the only known caller, and it calls this Worker
  **directly from the browser**, not through `apps/api`:
  - `useImageUpload.ts:82` → `POST {VITE_IMAGE_API_URL}/images/upload?category=menu`
  - `MenuView.vue:934` → `DELETE {VITE_IMAGE_API_URL}/images/{oldImageId}`
  - `VITE_IMAGE_API_URL` = `http://localhost:8790` in dev
    (`apps/admin-dashboard/.env.development`), `https://images.makanmasak.com`
    in prod (`.env.production`).
- No server-side caller was found in this repo (`apps/api`, `apps/management-api`, etc. do not `fetch()` this Worker's routes). The main API's `menu` module only stores the `imageId`/`imageUrl`/`imageVariants` fields the frontend already resolved — it never calls `image-processor` itself (confirmed in `api-features-identity-tenant.md` §8).
- `apps/customer-app` reads `VITE_IMAGE_BASE_URL=https://images.makanmasak.com` (`.env.example`) presumably for displaying delivered images, but no direct API-calling code to this Worker was found under `apps/customer-app/src` in this pass — treat as read-only image-URL consumption (via the `imageUrl`/`imageVariants` values already stored on menu items), not an API caller.
- Post-deploy smoke test: `.github/workflows/deploy-production.yml` curls `https://images.makanmasak.com/info` (public, unauthenticated) after `pnpm run deploy:prod`.

**Outbound (this Worker calls)**:

- Cloudflare Images REST API (`api.cloudflare.com/client/v4/accounts/{id}/images/v1/...`) — see §5.
- `imagedelivery.net/{accountHash}/...` — not called by the Worker itself, but URLs pointing there are constructed and returned/redirected to clients.
- Slack incoming webhook (`SLACK_WEBHOOK_URL`) — error notifications (global `onError` handler and scheduled-task catch block) and the daily stats report.
- Shared `@makanmakan/database` package — `createDatabase(env.DB)` (Drizzle) for direct schema access in `index.ts`, and the package's own `ImageService` class (`services/image-service.ts` wraps/re-exports it) for CRUD/analytics against `images`, `image_views`, `image_processing_jobs`.

## 8. Rust rewrite notes

- **Multipart handling**: the upload route depends on Hono's `c.req.formData()` (backed by the Workers runtime's native `FormData`/`Request.formData()`), consumed in **two separate places** in the middleware chain (`validateFileType` in `validation.ts` calls `c.req.formData()` and stashes both the `FormData` and extracted `File` on context; `securityScan` re-reads `file.arrayBuffer()` and reconstructs a new `File` because the buffer is single-read). A Rust port on `workers-rs` needs an equivalent single-parse-then-share pattern (workers-rs also wraps the native `Request.formData()`/`Blob` primitives) — replicate the "parse once, pass forward" structure rather than re-parsing per middleware, since re-parsing a consumed body will fail in Rust the same way it would need explicit buffering here.
- **Magic-number security scan**: the JPEG/PNG/GIF/WebP header-byte checks in `securityScan` (`validation.ts:359-391`) are pure byte comparisons — trivial to port with `bytes[0..4]` slicing in Rust; no external crate needed.
- **JWT verification**: HS256 shared-secret verification via `hono/jwt` — in Rust, any standard JWT crate (`jsonwebtoken`) with HS256 support reproduces this. The **exact validation order and error messages matter for parity**: expired → invalid signature/format → generic failure, plus the manual `iat`/`nbf`/token-age/role-range checks layered on top of signature verification (these are hand-rolled here, not part of `hono/jwt`'s own validation). The UUID v7 regex gate on `sub` must be ported verbatim (`^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`) — **`JWT_SECRET` must stay byte-identical to `apps/api`'s secret**, this is a shared-secret trust relationship, not something the Rust rewrite can change unilaterally without coordinating both Workers' secrets.
- **Cloudflare Images REST API from Rust**: plain HTTPS calls (`reqwest` or workers-rs's `Fetch`) to `api.cloudflare.com/client/v4/accounts/{id}/images/v1` — no official Rust SDK is used today (the TS code hand-rolls `fetch()` + JSON parsing), so a Rust port has no existing wrapper to match beyond replicating the same endpoints/multipart-body shape (`file`, `id`, `requireSignedURLs`, `metadata[key]`). No retries exist today — decide explicitly whether the Rust rewrite adds retry/backoff (a behavior change) or preserves the current single-attempt-then-fail behavior.
- **Secrets needed**: `JWT_SECRET` (shared with `apps/api`), `CLOUDFLARE_IMAGES_API_TOKEN`, optionally `API_KEY` (currently dead — decide whether to port `apiKeyAuth` at all since it's unused) and `SLACK_WEBHOOK_URL`.
- **Dead code to explicitly decide on, not silently port**: `apiKeyAuth` middleware (unmounted), `validateImageDimensions` middleware (no-op body, unmounted on any route beyond being defined), `CloudflareImagesAPI.listImages`/`.updateImageMetadata`/`.generateSignedURL` (defined, never called from a route), the entire `ImageCompressionService` class (parallel/duplicate upload logic, only exercised by its own test file), and `GET /analytics/export` (stub that returns a fabricated URL on a domain — `api.makanmakan.com` — that isn't even this Worker's own route). Porting these as-is would just carry forward dead code; flag each for a product decision (implement for real, or drop) rather than mechanically translating.
- **KV-backed rate limiting**: fixed-window counters keyed by `CF-Connecting-IP` + minute bucket, **fail-open** on KV errors. In Rust/workers-rs this is straightforward with the KV binding, but preserve the fail-open behavior explicitly if that's still the intended posture (a stricter Rust rewrite might reflexively fail-closed, which would be a behavior change).
- **No R2 involvement**: confirm the Rust rewrite doesn't reintroduce an R2 binding unless there's a new requirement — image bytes live entirely in Cloudflare Images, not in this platform's own storage.
- **Cron job**: three independent Drizzle deletes + one Slack report, no distributed lock/idempotency key — safe to port as-is given the cleanups are pure time-window deletes, but note the "orphaned upload from client-side crash" gap (§6) is a **known product gap**, not something to silently fix by inventing a new reconciliation job unless explicitly asked to add one.
- **Response envelope mismatch**: this Worker's `{success, error: string}` shape is **not** the same as `apps/api`'s `{success, error:{code, message, details}}` `ApiError` convention mandated by root `CLAUDE.md` — if the Rust rewrite is meant to unify error shapes across services, that's a deliberate contract change to call out, not an oversight to "fix" quietly. Note the flat `error: string` is currently **not** read by the only client — `useImageUpload.ts`'s `UploadResponse` type (`useImageUpload.ts:15-21`) declares only `success?`/`data?` and the composable throws its own generic messages on failure without surfacing the Worker's `error` string — so changing the error shape would break nothing in today's admin-dashboard, but any future consumer written against the Worker's actual responses would see the flat shape.
