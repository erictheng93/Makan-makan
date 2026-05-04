# Forecast & Discovery System Design

**Date**: 2026-03-14
**Status**: Approved
**Features**: (1) Ingredient Forecast & Prep Alerts, (2) Dish Discovery & Restaurant Search

---

## Overview

Two new subsystems for MakanMasak:

1. **Forecast System** — Lets shop owners predict ingredient/dish demand based on historical orders, with optional AI-enhanced insights. MVP operates at item level; data model supports future ingredient-level expansion.
2. **Discovery System** — Lets customers search dishes across all restaurants with filters (keyword, open now, district, price, takeaway/delivery). Introduces a new exploration flow independent of QR code scanning.

Both systems stay within the Cloudflare-native architecture (D1 + KV + Workers).

---

## Feature 1: Ingredient Forecast & Prep Alerts

### Data Model

#### `ingredient_definitions` (future expansion, MVP optional)

| Column        | Type          | Description                   |
| ------------- | ------------- | ----------------------------- |
| id            | INTEGER PK    | Auto-increment                |
| restaurantId  | TEXT FK       | → restaurants.id              |
| name          | TEXT NOT NULL | e.g. "雞胸肉"                 |
| unit          | TEXT NOT NULL | e.g. "kg", "份", "ml"         |
| category      | TEXT          | e.g. "肉類", "蔬菜", "調味料" |
| costPerUnit   | REAL          | Unit cost                     |
| supplier      | TEXT          | Supplier name                 |
| minStockLevel | REAL          | Min stock alert threshold     |
| isActive      | INTEGER       | Default 1                     |
| createdAt_ms  | INTEGER       |                               |
| updatedAt_ms  | INTEGER       |                               |
| deletedAt_ms  | INTEGER       | Soft delete                   |

Indexes: `restaurantId + isActive`, `restaurantId + category`

#### `menu_item_ingredients` (future expansion, MVP optional)

| Column             | Type       | Description                 |
| ------------------ | ---------- | --------------------------- |
| id                 | INTEGER PK | Auto-increment              |
| menuItemId         | INTEGER FK | → menu_items.id             |
| ingredientId       | INTEGER FK | → ingredient_definitions.id |
| quantityPerServing | REAL       | Amount per serving          |
| unit               | TEXT       | Unit for this recipe link   |
| isOptional         | INTEGER    | Default 0, optional topping |
| createdAt_ms       | INTEGER    |                             |
| updatedAt_ms       | INTEGER    |                             |

Indexes: `menuItemId`, `ingredientId`

#### `forecast_cache`

| Column       | Type          | Description                                                                                                                                                                                                                                                                    |
| ------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| id           | INTEGER PK    | Auto-increment                                                                                                                                                                                                                                                                 |
| restaurantId | TEXT FK       | → restaurants.id                                                                                                                                                                                                                                                               |
| forecastDate | TEXT NOT NULL | Target date YYYY-MM-DD                                                                                                                                                                                                                                                         |
| forecastType | TEXT NOT NULL | 'item_level' or 'ingredient_level'                                                                                                                                                                                                                                             |
| data         | TEXT (JSON)   | `{ [menuItemId]: { predicted: number, confidence: number, trend: string } }` — JSON blob is acceptable here because forecast reads always load the full day's prediction for a restaurant (no per-item queries needed). Typical size: < 100 items × ~50 bytes = < 5KB per row. |
| metadata     | TEXT (JSON)   | `{ dataSourceDays, model, weights, generatedAt }`                                                                                                                                                                                                                              |
| generatedBy  | TEXT          | 'statistical' or 'ai_enhanced'                                                                                                                                                                                                                                                 |
| expiresAt_ms | INTEGER       | Expiry timestamp                                                                                                                                                                                                                                                               |
| createdAt_ms | INTEGER       |                                                                                                                                                                                                                                                                                |

Indexes: `restaurantId + forecastDate + forecastType` (unique), `expiresAt_ms`

### Prediction Algorithm

#### Statistical Model (Default)

Weighted moving average of same-weekday historical sales:

```
weights = { week-1: 0.40, week-2: 0.30, week-3: 0.20, week-4: 0.10 }

For each menu_item:
  predicted = Σ(weight_i × sales_on_same_weekday_i_weeks_ago)

Trend coefficient:
  trend = (avg_recent_2_weeks - avg_older_2_weeks) / avg_older_2_weeks
  adjusted_predicted = predicted × (1 + trend × 0.5)

Confidence score:
  Based on coefficient of variation (CV) of historical data
  confidence = max(0, 1 - CV)  // 0.0 to 1.0
```

Data source: `orders` (status IN ('confirmed','preparing','ready','delivered','paid')) JOIN `order_items` (status != 'cancelled'), grouped by menuItemId and weekday.

**Query performance note**: Aggregating by weekday requires `strftime('%w', createdAt_ms/1000, 'unixepoch')` which cannot use indexes. To mitigate:

- Query is scoped to a single restaurant + last 8 weeks (bounded data set, typically < 10K orders)
- The existing index `orders_restaurant_status_idx(restaurantId, status, createdAt_ms)` narrows the scan
- Results are cached in KV (6h TTL), so the heavy query runs at most once per cache cycle
- For restaurants with very high volume, consider pre-aggregating daily sales counts via the cron warmup job

#### AI Enhanced Mode (Optional)

When `useAI=true`:

1. Run statistical model first
2. Package results + context (holidays, day-of-week patterns, recent trends) into prompt
3. Send to `AIInsightsService` via existing `ai-analytics` package
4. LLM returns adjusted predictions + text insights (e.g. "端午節建議粽子備料 +40%")
5. Merge AI adjustments with statistical baseline

### API Endpoints

Module: `apps/api/src/features/forecast/`

```
POST   /api/v1/forecast/:restaurantId/generate
       Body: { startDate: string, endDate: string, type?: 'item_level' | 'ingredient_level', useAI?: boolean }
       Auth: requireRole(1) (shop owner+)
       Response: { forecasts: ForecastResult[], generatedBy: string, metadata: object }

GET    /api/v1/forecast/:restaurantId
       Query: { date?, startDate?, endDate?, type? }
       Auth: requireRole(1)
       Response: { forecasts: ForecastResult[] }

GET    /api/v1/forecast/:restaurantId/accuracy
       Query: { startDate: string, endDate: string }
       Auth: requireRole(1)
       Response: { accuracy: { menuItemId, predicted, actual, deviation }[] }

GET    /api/v1/forecast/:restaurantId/alerts
       Auth: requireRole(1)
       Response: { alerts: { type: 'high_demand' | 'low_stock' | 'unusual_spike', menuItemId, message, severity }[] }
```

### Service Layer

```
ForecastService
├── generateForecast(restaurantId, dateRange, options)
│   ├── Query D1: historical orders + order_items (last 4-8 weeks, same weekdays)
│   ├── Aggregate by menuItemId per weekday
│   ├── Apply weighted moving average
│   ├── Calculate trend coefficients and confidence scores
│   ├── If useAI → call AIInsightsService for enhanced predictions
│   ├── Write to D1 forecast_cache
│   └── Write to KV (key: forecast:{restaurantId}:{date}:{type}, TTL: 6h)
├── getForecast(restaurantId, dateRange)
│   ├── Check KV cache → return if hit
│   ├── Check D1 forecast_cache → return if hit and not expired
│   └── Trigger generateForecast on miss
├── getAccuracy(restaurantId, dateRange)
│   ├── Read forecast_cache for date range
│   ├── Read actual order_items for same date range
│   └── Calculate per-item deviation
└── getAlerts(restaurantId)
    ├── Get tomorrow's forecast
    ├── Compare with menu_items.inventoryCount → low stock alerts
    │   (skip items where inventoryCount is null — null means unlimited stock)
    ├── Compare with historical average → unusual spike/drop alerts
    └── Return sorted by severity
```

### KV Cache Strategy

```
Key:     forecast:{restaurantId}:{YYYY-MM-DD}:{type}
Value:   JSON serialized ForecastResult[]
TTL:     6 hours
Warmup:  Add a new Cron trigger to the main API Worker (apps/api/wrangler.toml)
         at 02:00 daily. The handler iterates active restaurants and calls
         generateForecast for the next 3 days. This is separate from
         backup-scheduler to avoid coupling unrelated concerns.
Evict:   On manual generate; natural TTL expiry
```

### Admin Dashboard Integration

New section in admin dashboard: "備料預估" (Prep Forecast)

- Date range picker (tomorrow / this week / custom)
- Table view: menu item name, predicted quantity, confidence indicator, trend arrow
- Alert badges for unusual items
- Toggle for AI enhanced mode
- Accuracy report tab (predicted vs actual chart)

---

## Feature 2: Dish Discovery & Restaurant Search

### Data Model Changes

#### `restaurants` table — new columns

The existing `restaurants` table already has `type` (cuisine type, e.g. "中式"), `category` (sub-type, e.g. "火鍋"), and `settings` JSON with `enableTakeaway`/`enableDelivery`. We reuse `type` and `category` for cuisine filtering. We add **indexed boolean columns** for takeaway/delivery to enable D1 indexed queries (JSON fields inside `settings` cannot be indexed).

| Column           | Type        | Description                                                                                                                          |
| ---------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| latitude         | REAL        | GPS latitude (reserved, MVP null)                                                                                                    |
| longitude        | REAL        | GPS longitude (reserved, MVP null)                                                                                                   |
| cuisineTags      | TEXT (JSON) | Signature dishes, e.g. ["牛肉麵", "小籠包"]. Manually set by owner; supplements menu-item-level tags for restaurant-level discovery. |
| priceRange       | INTEGER     | 1=budget, 2=mid, 3=premium                                                                                                           |
| supportsTakeaway | INTEGER     | Default 0, indexed for filtering                                                                                                     |
| supportsDelivery | INTEGER     | Default 0, indexed for filtering                                                                                                     |

**Migration note**: `supportsTakeaway` / `supportsDelivery` are backfilled from `settings.enableTakeaway` / `settings.enableDelivery` during migration. Application code writes to BOTH the new columns and the settings JSON to maintain backwards compatibility until `settings` fields are deprecated in a future release.

**Reused existing columns**: `type` (cuisine type filtering), `category` (sub-type filtering), `district` + `city` (location filtering).

New indexes: `type + isActive`, `priceRange + isActive`, `district + isActive`, `supportsTakeaway + isActive`, `supportsDelivery + isActive`

#### `dish_search_index` (new table — materialized view for cross-restaurant search)

| Column             | Type          | Description                                                  |
| ------------------ | ------------- | ------------------------------------------------------------ |
| id                 | INTEGER PK    | Auto-increment                                               |
| menuItemId         | INTEGER FK    | → menu_items.id                                              |
| restaurantId       | TEXT FK       | → restaurants.id                                             |
| dishName           | TEXT NOT NULL | Redundant copy for fast query                                |
| dishNameNormalized | TEXT NOT NULL | Normalized (no punctuation, simplified Chinese)              |
| categoryName       | TEXT          | Redundant copy                                               |
| price              | REAL          | Redundant copy                                               |
| isAvailable        | INTEGER       | Redundant copy, 0 if menu item OR restaurant is soft-deleted |
| tags               | TEXT (JSON)   | Merged menu_items.tags + keywords                            |
| district           | TEXT          | Redundant copy from restaurants.district                     |
| restaurantType     | TEXT          | Redundant copy from restaurants.type                         |
| supportsTakeaway   | INTEGER       | Redundant copy                                               |
| supportsDelivery   | INTEGER       | Redundant copy                                               |
| updatedAt_ms       | INTEGER       |                                                              |

**Soft-delete handling**: When `menu_items.deletedAt_ms` or `restaurants.deletedAt_ms` is set, the corresponding rows in `dish_search_index` have `isAvailable` set to 0. The sync service filters out deleted items.

**Search strategy**: D1 (SQLite) does not support FTS5 reliably. Instead of `LIKE '%keyword%'` (which cannot use indexes), we use a **prefix-match strategy**:

- `dishNameNormalized` stores the normalized dish name
- Query uses `dishNameNormalized LIKE 'keyword%'` (prefix match, indexable) as the primary path
- For substring matches, we rely on the KV cache layer (see below)
- The `tags` JSON field provides additional keyword coverage — dishes are tagged with common search terms and aliases (e.g. a "紅燒牛肉麵" is tagged with ["牛肉麵", "牛肉", "麵"])

Indexes:

- `dishNameNormalized + isAvailable` (prefix search)
- `restaurantId + isAvailable`
- `price + isAvailable`
- `district + isAvailable`

### KV Search Index

KV caching uses a **query-result caching** strategy instead of per-keyword pre-computation. This avoids the problem where partial queries ("牛肉") never match pre-computed keys ("牛肉麵").

```
Key: search:query:{hash(normalizedQuery + filters)}
Value: { results: DishSearchResult[], total: number, cachedAt: number }
TTL: 15 minutes
Note: Caches the FULL query result (query + all filters combined).
      Hash is SHA-256 of the normalized query string + sorted filter params.
      Short TTL because results depend on openNow which changes over time.

Key: search:restaurants:district:{district}
Value: [{ restaurantId, name, type, priceRange, businessHours, supportsTakeaway, supportsDelivery }]
TTL: 30 minutes

Key: search:meta:popular-keywords
Value: Top 50 searched keywords with counts
TTL: 1 hour

Key: search:tags:index
Value: { [tag]: [{ menuItemId, restaurantId, dishName, price }] }
Note: Pre-computed tag-to-dish mapping. Rebuilt on reindex.
      Used as a secondary search path: if prefix match on D1 returns few results,
      also check tag index for the query term.
TTL: 30 minutes
```

### Open Now Calculation

Computed at query time in the Worker, not stored:

```typescript
function isOpenNow(
  businessHours: BusinessHours,
  timezone: string = "Asia/Taipei",
): boolean {
  const now = new Date();
  const dayKey = getDayKey(now, timezone); // 'monday' | ... | 'sunday'
  const todayHours = businessHours[dayKey];
  if (!todayHours || todayHours.closed) return false;
  const currentTime = formatHHmm(now, timezone); // "14:30"
  return currentTime >= todayHours.open && currentTime < todayHours.close;
}
```

### API Endpoints

Module: `apps/api/src/features/discovery/`

```
GET    /api/v1/discovery/search
       Query: { q: string, district?, city?, priceMin?: number, priceMax?: number,
                openNow?: boolean, takeaway?: boolean, delivery?: boolean,
                page?: number, limit?: number }
       Auth: none (public)
       Response: { results: DishSearchResult[], total: number, page: number }

GET    /api/v1/discovery/restaurants
       Query: { district?, city?, cuisineType?, priceRange?: number,
                openNow?: boolean, takeaway?: boolean, delivery?: boolean,
                sortBy?: 'rating' | 'popular', page?, limit? }
                // Note: 'distance' sort reserved for future when lat/lng is available
       Auth: none (public)
       Response: { restaurants: RestaurantListItem[], total: number, page: number }

GET    /api/v1/discovery/restaurants/:id/menu
       Auth: none (public)
       Response: { restaurant: RestaurantDetail, menu: CategoryWithItems[] }

GET    /api/v1/discovery/popular
       Auth: none (public)
       Response: { keywords: string[], dishes: DishSearchResult[], restaurants: RestaurantListItem[] }

POST   /api/v1/discovery/reindex
       Auth: requireRole(0) (admin only)
       Response: { indexed: { dishes: number, restaurants: number }, duration_ms: number }
```

### Service Layer

```
DiscoveryService
├── searchDishes(query, filters, pagination)
│   ├── Normalize query (trim, simplify Chinese, lowercase)
│   ├── Compute cache key hash(normalizedQuery + filters)
│   ├── Check KV search:query:{hash} → return if hit
│   ├── Miss → two-path D1 search:
│   │   ├── Path 1: dish_search_index WHERE dishNameNormalized LIKE 'query%' (prefix, indexed)
│   │   ├── Path 2: KV search:tags:index lookup for query term (substring coverage)
│   │   └── Merge and deduplicate results
│   ├── Apply remaining filters (district, price, takeaway, delivery) via WHERE clauses
│   ├── If openNow=true → post-filter via isOpenNow() in Worker
│   ├── Cache full result in KV search:query:{hash} (TTL 15min)
│   └── Return paginated results
├── browseRestaurants(filters, pagination)
│   ├── Query D1 restaurants with WHERE clauses for each filter
│   ├── openNow → post-filter in Worker
│   └── Return paginated results with isOpen flag
├── getRestaurantMenu(restaurantId)
│   └── Delegate to existing MenuService.getMenu()
├── getPopular()
│   └── Read KV search:meta:popular-keywords + top dishes/restaurants
└── reindex()
    ├── Rebuild dish_search_index incrementally (upsert all, then delete stale rows)
    │   instead of truncate — avoids zero-downtime issues during rebuild
    ├── Rebuild KV indexes
    └── Return stats

SearchIndexSyncService
├── onMenuItemChanged(menuItemId)
│   ├── Upsert dish_search_index row
│   └── Invalidate related KV keys
├── onRestaurantChanged(restaurantId)
│   └── Invalidate KV search:restaurants:district:{district}
└── fullReindex(restaurantId?)
    └── Rebuild for specific restaurant or all
```

### Customer App — Frontend

#### New Files

```
apps/customer-app/src/
├── views/
│   └── DiscoveryView.vue          — Main exploration page
├── components/discovery/
│   ├── SearchBar.vue               — Search input + popular keyword chips
│   ├── FilterPanel.vue             — Collapsible filter panel (district, price, takeaway/delivery)
│   ├── DishResultCard.vue          — Dish result card (dish name, restaurant, price, open status)
│   └── RestaurantCard.vue          — Restaurant card (reuse/extend existing component)
├── services/
│   └── discoveryApi.ts             — API client for /api/v1/discovery/*
└── stores/
    └── discovery.ts                — Pinia store for search state, filters, results
```

#### Router

Add route `/discover` → `DiscoveryView.vue` (no auth required).
Add navigation entry in HomeView.vue (button/link to explore page).

#### User Flow

```
HomeView → tap "探索美食" → DiscoveryView
  → type "牛肉麵" in SearchBar
  → see DishResultCard list (dish name, restaurant name, price, "營業中"/"已休息" badge)
  → tap a result → navigate to /restaurant/:id/menu (existing MenuView or ShopMenuView)
  → add to cart → place order (existing flow)
```

---

## Cross-Cutting Concerns

### Index Synchronization

Both features rely on derived data (forecast_cache, dish_search_index, KV indexes). Sync triggers:

| Event                             | Forecast Impact                              | Discovery Impact                       |
| --------------------------------- | -------------------------------------------- | -------------------------------------- |
| Order completed                   | KV forecast cache naturally expires (6h TTL) | —                                      |
| Menu item created/updated/deleted | —                                            | Sync dish_search_index + invalidate KV |
| Restaurant updated                | —                                            | Invalidate KV restaurant indexes       |
| Daily cron (02:00)                | Pre-warm forecast for all active restaurants | Rebuild popular keywords               |
| Manual reindex                    | POST /forecast/:id/generate                  | POST /discovery/reindex                |

### Error Handling

- Forecast generation failure → return stale cache with `stale: true` flag
- KV miss → fallback to D1 query (slower but functional)
- AI enhancement failure → return statistical-only result with warning
- Search index out of sync → admin can trigger manual reindex

### Rate Limiting

All discovery endpoints are public (no auth). Apply existing `geoIntelligentRateLimitMiddleware` to all `/api/v1/discovery/*` routes. Suggested limits:

- Search endpoints: 30 requests/minute per IP
- Restaurant/menu endpoints: 60 requests/minute per IP
- Reindex: 1 request/minute (admin only)

### Performance Targets

| Endpoint                           | Target P99                     |
| ---------------------------------- | ------------------------------ |
| GET forecast (KV hit)              | < 50ms                         |
| GET forecast (D1 fallback)         | < 300ms                        |
| POST forecast/generate             | < 3s (statistical), < 10s (AI) |
| GET discovery/search (KV hit)      | < 50ms                         |
| GET discovery/search (D1 fallback) | < 300ms                        |
| POST discovery/reindex             | < 30s                          |

---

## Implementation Order

### Phase 1: Forecast System

1. Database schema (3 tables) + migration
2. ForecastService (statistical model)
3. API endpoints (4 routes)
4. KV cache integration
5. Admin dashboard UI
6. AI enhancement integration

### Phase 2: Discovery System

1. Database schema changes (restaurants columns + dish_search_index) + migration
2. SearchIndexSyncService + initial reindex
3. DiscoveryService
4. API endpoints (5 routes)
5. KV search index integration
6. Customer app DiscoveryView + components
7. Router + navigation integration
