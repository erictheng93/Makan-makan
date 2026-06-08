# Night Market & Marketplace Discovery — Design (Draft)

**Date**: 2026-05-25
**Status**: Approved for Phase 1 backend core
**Author**: Eric
**Phase 1 scope**: Markets entity, GPS-based search, customer-facing market maps, Discovery → takeaway order bridge
**Implementation update (2026-06-08)**: Customer market detail pages now use a two-layer map model: MapLibre GL JS for external market/shop positioning and the existing stall-layout map for in-market navigation.
**Future phases**: Operator portal, vendor contact via deep-link + FAQ (Phase 3), follow/broadcast (see §10)
**Companion spec**: [`2026-05-25-customer-identity-and-profile-design.md`](./2026-05-25-customer-identity-and-profile-design.md) — hard prerequisite for Phase 4

---

## 1. Overview

The current Discovery system (`apps/api/src/features/discovery/`) lets customers search dishes and browse restaurants across all tenants. It treats every shop as an island and uses `restaurants.district` as a free-text label. This design is sufficient for "find a 牛肉麵 in 北屯區" but cannot model a curated marketplace such as a night market (一中商圈, 逢甲夜市, 草悟道) where:

- A market itself is an entity with its own identity (banner, opening hours, address, story).
- A restaurant can belong to one or more markets (fixed stall, roaming truck, satellite shop).
- Customers want to enter via the market — "今晚去逢甲夜市，誰在開？什麼推薦？" — rather than via a flat restaurant list.
- Orders happen without QR scanning: customer browses the market → opens a vendor menu → places a takeaway order.

This spec promotes "market" to a first-class entity, activates the dormant `restaurants.latitude / longitude` columns, and extends Discovery to surface market-scoped flows. It also closes the loop from Discovery to checkout for takeaway-enabled vendors.

---

## 2. Goals & Non-goals

### Goals (Phase 1)

1. Persist markets as a first-class entity with stable IDs and curated metadata.
2. Allow restaurants to be members of zero, one, or many markets.
3. Capture restaurant GPS coordinates at onboarding and expose `nearby` discovery.
4. Add public endpoints to browse markets and list vendors within a market.
5. Let a customer place a **takeaway order** starting from Discovery without scanning a QR code.
6. Backwards compatible: existing `restaurants.district` free-text continues to work; market membership is additive.

### Non-goals (deferred to later phases)

- Customer ↔ vendor direct messaging (DM). See §10.
- Market operator role + dedicated portal. See §10.
- Vendor → follower broadcast / push promotions. See §10.
- Polygon / GeoJSON boundary editing for markets. Phase 1 can display imported `boundaryGeojson`, but operator/admin editing is deferred.
- Cross-market analytics dashboards.
- Multi-language market metadata (will ship zh-TW only, schema is i18n-ready).

---

## 3. User Stories

| # | Persona | Story |
|---|---------|-------|
| US-1 | Customer | "我在逢甲夜市門口，打開 app 想看哪些攤位現在開、推薦什麼菜。" |
| US-2 | Customer | "我在 Discovery 看到一個推薦菜，想直接點外帶不要走 QR。" |
| US-3 | Customer | "我看到一個夜市的介紹頁，知道營業時間、有幾個攤位、地址。" |
| US-4 | Shop Owner | "我加入了一中商圈，希望客人在搜這個商圈的時候看得到我。" |
| US-5 | Shop Owner | "我同時在逢甲夜市跟一中商圈擺攤，要能登記在兩個地方。" |
| US-6 | Platform Admin | "我要能新增 / 編輯夜市資料，把店家掛上去。" |

---

## 4. Data Model

### 4.1 New table: `markets`

A curated commercial district / night market / food court / event venue.

| Column | Type | Description |
|---|---|---|
| id | TEXT PK | UUID v7 |
| slug | TEXT UNIQUE NOT NULL | URL slug, e.g. `fengjia-night-market`. Used in deep links. |
| name | TEXT NOT NULL | 顯示名稱，e.g. `逢甲夜市` |
| type | TEXT NOT NULL | `night_market` / `commercial_district` / `food_court` / `event_venue` |
| description | TEXT | Long description, markdown allowed |
| city | TEXT NOT NULL | e.g. `台中市` |
| district | TEXT NOT NULL | e.g. `西屯區` (denormalized for filter perf) |
| address | TEXT NOT NULL | Human-readable address of centroid |
| latitude | REAL NOT NULL | Centroid GPS |
| longitude | REAL NOT NULL | Centroid GPS |
| boundaryGeojson | TEXT (JSON) | Optional Polygon/MultiPolygon footprint used by customer external maps; editing remains platform-admin/import driven in Phase 1. |
| openingHours | TEXT (JSON) | Same shape as `restaurants.business_hours`; nullable (some markets are 24/7 or per-vendor) |
| mapLayout | TEXT (JSON) | Optional stall-layout metadata for in-market navigation: `{ title?, description?, imageUrl?, width?, height? }`. This is separate from real GPS maps. |
| bannerUrl | TEXT | Hero image (R2 / Cloudflare Images) |
| logoUrl | TEXT | Optional emblem |
| imageUrls | TEXT (JSON) | Gallery, `string[]` |
| tags | TEXT (JSON) | Free-form discovery tags, e.g. `["夜市","小吃","學生族"]` |
| isActive | INTEGER NOT NULL DEFAULT 1 | Soft toggle (markets going dormant) |
| createdAt_ms | INTEGER NOT NULL | UUID v7 makes this redundant but kept for query convenience |
| updatedAt_ms | INTEGER NOT NULL | On-update |
| deletedAt_ms | INTEGER | Soft delete |

**Indexes**:
- `city + district + isActive` (browse by area)
- `slug` (already unique, doubles as a lookup index)
- `latitude, longitude` — composite index will not be used for distance queries directly; we instead bucket by a coarse grid (see §6.3). Index left out unless profiling shows a need.

**Why a separate table** (not just normalizing `restaurants.district`): markets have their own lifecycle, hours, branding, and may not map 1:1 with administrative district. A 夜市 spans street blocks and has identity that is independent of zip code.

### 4.2 New table: `restaurant_market_memberships`

Many-to-many join between restaurants and markets.

| Column | Type | Description |
|---|---|---|
| id | INTEGER PK AUTOINCREMENT | |
| restaurantId | TEXT FK NOT NULL | → `restaurants.id` |
| marketId | TEXT FK NOT NULL | → `markets.id` |
| stallNumber | TEXT | Optional stall / location label, e.g. `A-12` |
| isPrimary | INTEGER NOT NULL DEFAULT 0 | Highlights the "home" market when a vendor belongs to multiple |
| joinedAt_ms | INTEGER NOT NULL | |
| leftAt_ms | INTEGER | Soft-leave (vendor exits without deleting history) |

**Indexes**:
- `(restaurantId, marketId)` UNIQUE (one active row per pair; soft-leave handled by `leftAt_ms IS NOT NULL`)
- `marketId + leftAt_ms` (list vendors in a market, fast path)
- `restaurantId + leftAt_ms` (list markets a vendor is in)

**Decision (Q-1, 2026-05-25)**: use a database-level partial unique
index: `UNIQUE (restaurantId, marketId) WHERE leftAt_ms IS NULL`. This
allows historical soft-left rows while guaranteeing only one active membership
per restaurant/market pair. The repository already uses Drizzle partial unique
indexes and D1-compatible SQLite filtered indexes for this pattern, so this is
implemented at the migration/schema layer rather than as an app-only check.

### 4.3 Modified table: `restaurants`

Three columns already exist but are unused or under-used:

| Column | Status | Action |
|---|---|---|
| `latitude` REAL | Exists, nullable, "reserved for future" | **Promote to required for new tenants**; backfill existing rows during onboarding migration. Keep nullable in schema; enforce via service layer + onboarding form. |
| `longitude` REAL | Same as above | Same as above |
| `district` TEXT NOT NULL | Free-text, used by Discovery filters | **Keep as-is.** Continues to be the cheap free-text filter for Discovery. Market membership is *additional* information, not a replacement. |

No new restaurant columns are added in this phase. The `markets` and `restaurant_market_memberships` tables carry the new model.

### 4.4 Modified table: `dish_search_index`

Add denormalized market data so dish searches can scope to a market without a JOIN.

| Column | Type | Description |
|---|---|---|
| primaryMarketId | TEXT NULL | Denormalized from `restaurant_market_memberships` where `isPrimary = 1` |
| marketIds | TEXT (JSON) NULL | All non-left memberships, `string[]` for full scoping |
| latitude | REAL NULL | Copied from restaurant |
| longitude | REAL NULL | Copied from restaurant |

**Index additions**:
- `primaryMarketId + isAvailable`
- (Existing) `district + isAvailable` continues to be the cheap path for non-market searches.

`SearchIndexSyncService` (already exists at `apps/api/src/features/discovery/services/SearchIndexSyncService.ts`) needs to be extended to also subscribe to `restaurant_market_memberships` changes.

### 4.5 Schema file layout

- New file: `packages/database/src/schema/markets.ts` (both tables, with relations).
- Export from `packages/database/src/schema/index.ts` (alphabetical: between `leaves` and `menu-items`).
- Add to `packages/database/src/schema/discovery.ts`: the four new columns on `dishSearchIndex`.

---

## 5. API Endpoints

Module: `apps/api/src/features/markets/` (new feature folder). Discovery module extended.

### 5.1 Public — Markets

```
GET /api/v1/markets
    Query: { city?, district?, type?, page?, limit? }
    Auth: none
    Response: { markets: MarketListItem[], total: number, page: number }

GET /api/v1/markets/:slug
    Auth: none
    Response: { market: MarketDetail, vendorCount: number }

GET /api/v1/markets/:slug/vendors
    Query: { openNow?, takeaway?, delivery?, q?, sortBy?, page?, limit? }
    Auth: none
    Response: { vendors: RestaurantListItem[], total: number, page: number }

GET /api/v1/markets/nearby
    Query: { lat, lng, radiusKm? (default 2, max 10), limit? (default 20) }
    Auth: none
    Response: { markets: MarketWithDistance[] }
```

### 5.2 Public — Discovery (extensions)

Existing endpoints extended with two new optional filters:

```
GET /api/v1/discovery/search
    Add query params:
      marketId?: string         // scope to a single market
      lat?, lng?, radiusKm?     // proximity scope, mutually exclusive with marketId

GET /api/v1/discovery/restaurants
    Add query params: same as above
```

New endpoint:

```
GET /api/v1/discovery/restaurants/:id/takeaway-eligibility
    Auth: none
    Response: {
      eligible: boolean,
      reason?: 'restaurant_disabled' | 'takeaway_disabled' | 'closed_now',
      shopQrCode?: string  // present iff eligible; client redirects to /shop/:code
    }
```

This is the bridge endpoint (US-2): given a restaurant the customer found via Discovery, determine whether they can start a takeaway order *right now* and return the existing shop QR code as the entry token. The customer app then redirects into the existing shop-mode flow.

**Why reuse `shopQrCode` instead of inventing a new entry**: `shopQrCode` is already the canonical "no-table takeaway / self-pickup" entry across the codebase (orders, sessions, print formatters all key off it). Inventing a parallel "discovery-direct" entry would fragment the order flow. The QR code is just a token here; nothing about it requires actual scanning.

### 5.3 Admin — Market management

Mounted under existing admin auth (role 0).

```
POST   /api/v1/admin/markets                       Create market
PUT    /api/v1/admin/markets/:id                   Update
DELETE /api/v1/admin/markets/:id                   Soft delete
POST   /api/v1/admin/markets/:id/vendors           Body: { restaurantId, stallNumber?, isPrimary? }
DELETE /api/v1/admin/markets/:id/vendors/:rid      Soft-leave
```

Hosted in `apps/management-api` (control plane) rather than `apps/api` — markets are platform-level data, like tenants. Phase 1 has no operator self-service; only platform admin can edit. The frontend lives in `apps/management-portal` (a new "Markets" page).

---

## 6. Service Layer

### 6.1 New: `MarketsService` (`apps/api/src/features/markets/services/MarketsService.ts`)

Methods:
- `listMarkets(filters)` — Drizzle Layer 1 query
- `getMarketBySlug(slug)` — single-row lookup + vendor count
- `listVendors(marketId, filters)` — JOIN with `restaurants`, reuses `isOpenNow` util
- `findNearby(lat, lng, radiusKm)` — see §6.3

For admin: `createMarket`, `updateMarket`, `softDelete`, `addVendor`, `removeVendor`. These mirror existing tenant CRUD patterns in `RestaurantsService`.

### 6.2 Extended: `DiscoveryService`

- `searchDishes` and `browseRestaurants` accept new `marketId` and `lat/lng/radiusKm` filters.
- `marketId` filter: `WHERE primaryMarketId = ? OR marketIds LIKE '%"' || ? || '"%'` — the LIKE on JSON is acceptable here because `marketIds` is a small array per row. If profiling shows it's slow, we add a junction lookup table.
- `lat/lng` filter: see §6.3.

### 6.3 Geo-search strategy (no PostGIS, just SQLite)

D1 has no spatial extension. We use a **bounding-box + Haversine refinement** approach:

1. Convert `(lat, lng, radiusKm)` to a bounding box (north/south/east/west lat-lng).
2. Filter rows by `latitude BETWEEN s AND n AND longitude BETWEEN w AND e` — uses btree indexes on each column independently (SQLite picks the more selective one).
3. Apply Haversine distance in the SELECT to remove rows in the box but outside the circle, and to sort.
4. Cap radius at 10 km in MVP (covers all of Taichung downtown clusters). Larger radius would benefit from grid bucketing but isn't needed yet.

```typescript
// pseudocode for nearby query
const { northLat, southLat, eastLng, westLng } = bboxFromCircle(lat, lng, radiusKm);
const rows = await db.select({
  ...marketColumns,
  distanceKm: sql<number>`
    6371 * acos(
      cos(radians(${lat})) * cos(radians(${markets.latitude})) *
      cos(radians(${markets.longitude}) - radians(${lng})) +
      sin(radians(${lat})) * sin(radians(${markets.latitude}))
    )
  `,
}).from(markets).where(and(
  between(markets.latitude, southLat, northLat),
  between(markets.longitude, westLng, eastLng),
  eq(markets.isActive, true),
  isNull(markets.deletedAt),
)).orderBy(asc(sql`distanceKm`)).limit(limit);
return rows.filter(r => r.distanceKm <= radiusKm);
```

**Trade-off**: Haversine inside D1 SQL works but is slow for large fanouts. With <500 markets in MVP this is fine. If we cross ~5k markets, migrate to a coarse grid index (precomputed `geohash5` column).

### 6.4 `SearchIndexSyncService` extensions

Add three new triggers:
- On `markets` insert/update/delete → re-sync all dishes for all member restaurants of that market.
- On `restaurant_market_memberships` insert → update affected dish_search_index rows' `primaryMarketId` / `marketIds`.
- On membership soft-leave → same.

Existing triggers (menu_items, restaurants) need to populate the new lat/lng columns.

---

## 7. KV Cache Strategy

Following the existing pattern (`KV_SEARCH_TTL = 15 min`, `KV_RESTAURANT_TTL = 30 min`):

```
Key: market:detail:{slug}
Value: MarketDetail
TTL: 60 minutes
Invalidate: on admin update of that market

Key: market:list:{city}:{district?}:{type?}:{page}
Value: { markets: MarketListItem[], total }
TTL: 30 minutes
Invalidate: bump versioned prefix `market:list:v{n}:...` on any market mutation

Key: market:vendors:{marketId}:{filterHash}
Value: { vendors: RestaurantListItem[], total }
TTL: 15 minutes
Invalidate: on membership change

Key: market:nearby:{geohash5}:{radiusKm}
Value: MarketWithDistance[]
TTL: 30 minutes
Note: geohash5 (~5km cell) gives ~95% cache hit on repeated queries from the
      same neighborhood without pre-computing every coordinate.
```

`takeaway-eligibility` is **not cached** — it depends on `openNow`, which changes per minute. Lookup is a single indexed read, cheap enough to skip cache.

---

## 8. Frontend Changes

### 8.1 `apps/customer-app`

New routes:
- `/markets` — list / nearby markets (uses geolocation API with explicit permission prompt)
- `/markets/:slug` — market detail + vendor list
- `/markets/:slug/vendors/:vendorId` — vendor detail (reuses `DiscoveryView` vendor card)

New components:
- `components/markets/MarketCard.vue`
- `components/markets/MarketDetailHero.vue`
- `components/markets/VendorListInMarket.vue` (filters: openNow, takeaway, search)
- `components/markets/MarketLocationMap.vue` — implemented customer-facing external location map. It lazy-loads MapLibre GL JS and PMTiles runtime, centers on `MarketDetail.latitude/longitude`, renders optional `boundaryGeojson`, plots vendors that have `latitude/longitude`, and exposes a Google Maps navigation link.
- `components/markets/StallMapInMarket.vue` — implemented in-market stall-layout map. It keeps using `mapLayout.imageUrl` plus `mapPosition: { x, y }` percentage coordinates so night-market/floor-plan navigation can remain independent from GPS accuracy.
- `components/markets/NearbyMarketMap.vue` (optional, Phase 1.5; market list MVP can ship list-only with distance label)

Map architecture decision (2026-06-08):
- Use a two-layer map model instead of replacing stall maps with a geospatial map.
- **External market/shop positioning**: `MarketLocationMap` uses MapLibre GL JS. It supports `VITE_MAP_PM_TILES_URL` for Protomaps/PMTiles hosted on Cloudflare R2 and `VITE_MAP_STYLE_URL` for a full style override. When neither is set, it falls back to MapLibre's demo style so local development still renders.
- **Internal stall navigation**: `StallMapInMarket` remains the source of truth for curated stall positions, because night-market stalls often lack reliable GPS and need human-readable lane/stall labels.
- Production deployments should provide either `VITE_MAP_PM_TILES_URL` or `VITE_MAP_STYLE_URL`; otherwise the map still works in development mode but depends on the public demo style.

Extended:
- `DiscoveryView.vue` adds an optional "Filter by market" pill row above existing filters.
- `services/discoveryApi.ts` adds market params.
- New `services/marketsApi.ts`.
- New `stores/markets.ts` (Pinia).

Order-flow bridge (US-2):
- `DishResultCard` and `RestaurantCard` add a "立即外帶" button shown when `supportsTakeaway && openNow`. Click → call `takeaway-eligibility` → on success, route to `/shop/:shopQrCode`.

### 8.2 `apps/management-portal`

New `MarketsView.vue` — list / create / edit markets, attach vendors. Reuses existing form components.

### 8.3 `apps/onboarding-app`

Add a mandatory "Pick location on map" step that captures `latitude` / `longitude`. Optional "join a market" step (skippable; can be done later from admin-dashboard).

### 8.4 `apps/admin-dashboard`

Add a "Markets" section to settings: shows markets this restaurant belongs to, with leave/join request flow. Phase 1 = read-only display + "request to join" form that creates a platform admin ticket. Self-service join lands in Phase 2.

---

## 9. Migration Plan

Drizzle-generated migrations land in `packages/database/migrations_fresh/`.

1. **Migration N**: create `markets` table.
2. **Migration N+1**: create `restaurant_market_memberships` table.
3. **Migration N+2**: add `primaryMarketId`, `marketIds`, `latitude`, `longitude` to `dish_search_index`.
4. **Data backfill** (one-off Worker script, not a SQL migration):
   - For each existing restaurant with non-null `district`, no auto market assignment is made. Markets are explicitly seeded by platform admin.
   - For existing restaurants with `latitude/longitude` null, prompt owner on next admin-dashboard login to set GPS (non-blocking banner). Backfill is not retroactive.
5. **Reindex**: trigger `POST /api/v1/discovery/reindex` (already exists, admin-only) to repopulate `dish_search_index` with the new columns.

**Rollout order**: tables → backfill empty → reindex → enable new endpoints → enable customer-app routes behind a feature flag → flip flag.

**No breaking changes**: every new field is nullable or has a default. Existing API consumers see no diff.

---

## 10. Future Work

Tracked here so reviewers can confirm scope, not for Phase 1 implementation:

### Phase 2: Market Operator role & portal
- New role: `market_operator` (a new top-level role, not under a single restaurant).
- Self-service market editing for verified operators.
- Per-market analytics dashboard.

### Phase 3: Customer contact MVP — deep links + FAQ auto-reply (decided)

Native DM is **not** built in Phase 3. Instead:

- Add `messagingChannels` JSON column to `restaurants`: `{ line?: string, whatsapp?: string, instagram?: string, telegram?: string }`. Each entry is a public profile URL or `https://line.me/ti/p/~xxx` style deep link.
- Customer-app shows a "聯絡店家" button on vendor detail page → opens the platform's native app (LINE, WhatsApp, IG, Telegram) via `wa.me` / `line.me` / `ig.me` URL conventions. No data leaves our system; the conversation happens entirely on the third-party platform.
- FAQ auto-reply: per-restaurant Q&A schema (`restaurant_faqs` table — `question`, `answer`, `keywords`, `displayOrder`). Customer-app shows a "常見問題" accordion above the deep-link buttons.
- Re-evaluate native DM only after we have ≥50 vendors actively using the deep-link path and survey data confirms the friction.

Decision rationale: small vendors won't staff a real-time inbox. Forcing them onto our platform's DM creates a bad customer experience (ignored messages) more than it adds value. LINE/IG already where they work.

### Phase 4: Follow & broadcast (depends on Customer Identity spec)
- Customer can follow markets and vendors → stored in `customer_favorites` (see [`2026-05-25-customer-identity-and-profile-design.md`](./2026-05-25-customer-identity-and-profile-design.md)).
- Vendor → followers promotional push (reuses `customer_push_subscriptions` from the customer identity spec, gated by `customer_consents WHERE consentType='marketing'`).
- Market → all vendors announcement broadcast.
- **Prerequisite**: Customer Identity spec must land first so that "follow" and "push to followers" have a real customer entity to attach to.

### Phase 5: Map editing and tile operations
- Operator/admin UI for editing optional GeoJSON market footprints instead of importing them manually.
- Optional in-app editor for stall-layout background images and `mapPosition` percentages.
- Production PMTiles operations: generate Taiwan/city-bounded PMTiles archives, upload them to Cloudflare R2, configure CORS for browser Range requests, and wire `VITE_MAP_PM_TILES_URL` per environment.

---

## 11. Open Questions

| ID | Question | Notes |
|----|----------|-------|
| Q-1 | `(restaurantId, marketId)` UNIQUE — partial index with `leftAt_ms IS NULL` or app-layer constraint? | **Decided (2026-05-25)**: use DB-level partial unique index `WHERE leftAt_ms IS NULL`; soft-left rows preserve history and re-join creates a new active row. |
| Q-2 | Should `markets` be platform-owned or tenant-owned in the data model? | **Decided (2026-05-25)**: Phase 1 = platform admin only. Market operator role promoted to Phase 2. |
| Q-3 | How do we handle "店家在夜市內，但夜市未上架平台"? | MVP: shop just doesn't have a market membership, falls back to free-text district. No degraded UX. |
| Q-4 | DM Phase 3 — native vs. deep-link MVP? | **Decided (2026-05-25)**: Deep-link only. `restaurants.messagingChannels` JSON column + FAQ table. Native DM revisited only after ≥50 vendors use the deep-link path and survey data justifies the build. |
| Q-5 | Geolocation permission UX — soft-fail to "Taichung center" or hard-block discovery? | Soft-fail. Always show markets sorted by popularity if no GPS. |
| Q-6 | Pricing — is "join a market" a paid feature? | **Decided (2026-05-25)**: Free service in Phase 1. Reserved as a potential paid module in the future; track in `docs/specs/modular-billing-and-usage-metering.md` for when monetization is needed. |
| Q-7 | "Currently open" calculation for markets — use market hours, vendor hours, or both? | Recommendation: a market is "open" if its `openingHours` says so OR (when null) if ≥1 vendor is open. |
| Q-8 | Slug collision — auto-suffix or reject? | Reject in admin form, autosuffix only on programmatic import. |

---

## 12. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `dish_search_index` reindex during migration causes lag | Medium | Medium | Reindex is incremental; run during low-traffic window. Existing endpoint stays available throughout. |
| Customers grant GPS but expect map view, MVP ships list-only | Medium | Low | Show distance ("離你 1.2 km") in list. Mention map view in Phase 1.5 changelog. |
| Vendors abuse multi-market membership (sign up to every market for visibility) | Low | Medium | Phase 1: platform admin controls all memberships, so no abuse vector. Phase 2 needs an anti-spam rule. |
| Haversine in SQL slows down once `markets` > 5k rows | Low | Medium | Migrate to geohash bucketing (already noted in §6.3). |
| Existing free-text `district` data drifts from real markets | High | Low | Accept the drift. `district` is a separate filter; market membership is the authoritative link. |

---

## 13. Out of Scope (Explicit)

To prevent scope creep during review:

- No changes to order placement, payment, kitchen routing, or print agent.
- No changes to existing QR-mode flows.
- No new languages — zh-TW only for market metadata in Phase 1.
- No SEO / public-web microsite for markets (still a PWA route).
- No revenue share / commission tracking between platform, market, and vendor.

---

## 14. Estimated Effort

Rough engineering estimate for Phase 1 (markets + GPS + takeaway bridge):

| Workstream | Effort |
|---|---|
| Schema + migrations + backfill | 3 days |
| `MarketsService` + admin endpoints | 3 days |
| Discovery extensions + KV cache | 2 days |
| `takeaway-eligibility` + customer-app bridge | 2 days |
| customer-app market routes + components | 5 days |
| management-portal markets page | 3 days |
| onboarding-app GPS step | 2 days |
| admin-dashboard "my markets" read-only | 2 days |
| Tests (unit + integration + E2E happy path) | 4 days |
| Docs + changelog + design system audit | 1 day |
| **Total** | **~27 dev-days** |

Roughly **5–6 weeks** for one engineer, or **3 weeks** with two engineers splitting backend / frontend.

---

## 15. Review Checklist

Before approving this spec, confirm:

- [x] Markets are platform-owned in Phase 1 (no operator role yet) — **decided 2026-05-25**
- [ ] `district` free-text stays, market membership is additive — agreed?
- [ ] Phase 1 ships list-only (no map), distance label is enough — agreed?
- [ ] Discovery → takeaway uses existing `shopQrCode` as the entry token — agreed?
- [x] Phase 3 contact = deep-link to LINE/IG/WhatsApp + FAQ table, **not** native DM — **decided 2026-05-25**
- [x] Pricing — free in Phase 1, paid module reserved for future — **decided 2026-05-25**
- [x] Open question Q-1 (`(restaurantId, marketId)` UNIQUE strategy) decided: partial unique index on active rows only.
