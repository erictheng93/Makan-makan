# Discovery System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let customers search dishes across all restaurants with filters (keyword, open now, district, price, takeaway/delivery), via a new exploration page in the customer app.

**Architecture:** New `discovery` feature module in `apps/api/src/features/`, with schema migration (new `dish_search_index` table + `restaurants` column additions), DiscoveryService with prefix-match + tag-index dual search, KV query-result caching, and a new DiscoveryView in the customer app.

**Tech Stack:** Cloudflare Workers + D1 + KV, Drizzle ORM, Hono, Zod, Vue.js 3, Pinia, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-14-forecast-and-discovery-design.md` (Feature 2)

---

## File Structure

### Database (packages/database/)

```
packages/database/src/schema/
├── restaurants.ts               — (modify) add latitude, longitude, cuisineTags, priceRange, supportsTakeaway, supportsDelivery
├── discovery.ts                 — dish_search_index table
└── index.ts                     — (modify) add exports for discovery schema
```

### API (apps/api/src/features/discovery/)

```
apps/api/src/features/discovery/
├── index.ts                     — DiscoveryModule class
├── routes/index.ts              — 5 API endpoints
├── schemas/validation.ts        — Zod schemas
├── services/
│   ├── DiscoveryService.ts      — Search + browse logic
│   └── SearchIndexSyncService.ts — Index sync on menu/restaurant changes
├── utils/
│   └── isOpenNow.ts             — Business hours checker
├── types/index.ts               — TypeScript interfaces
└── __tests__/
    ├── DiscoveryService.test.ts — Service unit tests
    └── isOpenNow.test.ts        — Open now utility tests
```

### Main API entry (apps/api/src/)

```
apps/api/src/
└── index.ts                     — (modify) import + mount discovery feature + rate limit config
```

### Customer App (apps/customer-app/src/)

```
apps/customer-app/src/
├── views/
│   └── DiscoveryView.vue        — Main exploration page
├── components/discovery/
│   ├── SearchBar.vue            — Search input + popular keyword chips
│   ├── FilterPanel.vue          — Collapsible filter panel
│   ├── DishResultCard.vue       — Dish search result card
│   └── RestaurantCard.vue       — Restaurant card for browse mode
├── services/
│   └── discoveryApi.ts          — API client for /api/v1/discovery/*
├── stores/
│   └── discovery.ts             — Pinia store for search state
└── router/index.ts              — (modify) add /discover route
```

---

## Chunk 1: Database Schema Changes + Migration

### Task 1: Add new columns to restaurants schema

**Files:**

- Modify: `packages/database/src/schema/restaurants.ts`

- [ ] **Step 1: Read current restaurants schema**

Read: `packages/database/src/schema/restaurants.ts`
Note the existing columns and index pattern.

- [ ] **Step 2: Add new columns and indexes**

Add these columns to the `restaurants` table definition (after existing fields, before the closing):

```typescript
// GPS (reserved for future)
latitude: real("latitude"),
longitude: real("longitude"),
// Discovery fields
cuisineTags: text("cuisine_tags", { mode: "json" }).$type<string[]>(),
priceRange: integer("price_range"), // 1=budget, 2=mid, 3=premium
supportsTakeaway: integer("supports_takeaway", { mode: "boolean" }).notNull().default(false),
supportsDelivery: integer("supports_delivery", { mode: "boolean" }).notNull().default(false),
```

Add indexes in the index function:

```typescript
typeActiveIdx: index("restaurants_type_active_idx").on(table.type, table.isActive),
priceRangeActiveIdx: index("restaurants_price_range_active_idx").on(table.priceRange, table.isActive),
districtActiveIdx: index("restaurants_district_active_idx").on(table.district, table.isActive),
takeawayActiveIdx: index("restaurants_takeaway_active_idx").on(table.supportsTakeaway, table.isActive),
deliveryActiveIdx: index("restaurants_delivery_active_idx").on(table.supportsDelivery, table.isActive),
```

- [ ] **Step 3: Create backfill migration script**

After generating the migration, add a backfill SQL step to populate `supports_takeaway` / `supports_delivery` from existing `settings` JSON:

```sql
-- backfill-discovery-columns.sql
UPDATE restaurants SET
  supports_takeaway = CASE
    WHEN json_extract(settings, '$.enableTakeaway') = true THEN 1 ELSE 0
  END,
  supports_delivery = CASE
    WHEN json_extract(settings, '$.enableDelivery') = true THEN 1 ELSE 0
  END
WHERE settings IS NOT NULL;
```

Run: `npx wrangler d1 execute makanmakan-local --local --file=./scripts/backfill-discovery-columns.sql --config=./apps/api/wrangler.toml`

- [ ] **Step 4: Commit schema change**

```bash
git add packages/database/src/schema/restaurants.ts scripts/backfill-discovery-columns.sql
git commit -m "feat(database): add discovery columns to restaurants schema with backfill"
```

### Task 2: Create dish_search_index schema

**Files:**

- Create: `packages/database/src/schema/discovery.ts`
- Modify: `packages/database/src/schema/index.ts`

- [ ] **Step 1: Write discovery schema file**

```typescript
// packages/database/src/schema/discovery.ts
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { restaurants } from "./restaurants";
import { menuItems } from "./menu-items";

export const dishSearchIndex = sqliteTable(
  "dish_search_index",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    menuItemId: integer("menu_item_id").notNull(),
    restaurantId: text("restaurant_id").notNull(),
    dishName: text("dish_name").notNull(),
    dishNameNormalized: text("dish_name_normalized").notNull(),
    categoryName: text("category_name"),
    price: real("price"),
    isAvailable: integer("is_available", { mode: "boolean" })
      .notNull()
      .default(true),
    tags: text("tags", { mode: "json" }).$type<string[]>(),
    district: text("district"),
    restaurantType: text("restaurant_type"),
    supportsTakeaway: integer("supports_takeaway", { mode: "boolean" })
      .notNull()
      .default(false),
    supportsDelivery: integer("supports_delivery", { mode: "boolean" })
      .notNull()
      .default(false),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    nameAvailableIdx: index("dish_search_name_available_idx").on(
      table.dishNameNormalized,
      table.isAvailable,
    ),
    restaurantAvailableIdx: index("dish_search_restaurant_available_idx").on(
      table.restaurantId,
      table.isAvailable,
    ),
    priceAvailableIdx: index("dish_search_price_available_idx").on(
      table.price,
      table.isAvailable,
    ),
    districtAvailableIdx: index("dish_search_district_available_idx").on(
      table.district,
      table.isAvailable,
    ),
  }),
);

export const dishSearchIndexRelations = relations(
  dishSearchIndex,
  ({ one }) => ({
    menuItem: one(menuItems, {
      fields: [dishSearchIndex.menuItemId],
      references: [menuItems.id],
    }),
    restaurant: one(restaurants, {
      fields: [dishSearchIndex.restaurantId],
      references: [restaurants.id],
    }),
  }),
);
```

- [ ] **Step 2: Export from schema index**

Add to `packages/database/src/schema/index.ts`:

```typescript
export * from "./discovery";
export { dishSearchIndexRelations } from "./discovery";
```

- [ ] **Step 3: Generate and apply migration**

Run: `pnpm db:generate && pnpm db:migrate:local`
Expected: Migration applied with new table + columns

- [ ] **Step 4: Verify**

Run: `npx wrangler d1 execute makanmakan-local --local --command "PRAGMA table_info(dish_search_index)" --config=./apps/api/wrangler.toml`
Expected: All columns listed

- [ ] **Step 5: Commit**

```bash
git add packages/database/src/schema/discovery.ts packages/database/src/schema/index.ts packages/database/migrations_fresh/
git commit -m "feat(database): add dish_search_index table for discovery"
```

---

## Chunk 2: Discovery Feature — Types + Utils + Service

### Task 3: Create types and isOpenNow utility

**Files:**

- Create: `apps/api/src/features/discovery/types/index.ts`
- Create: `apps/api/src/features/discovery/utils/isOpenNow.ts`
- Create: `apps/api/src/features/discovery/__tests__/isOpenNow.test.ts`

- [ ] **Step 1: Write types**

```typescript
// apps/api/src/features/discovery/types/index.ts

export interface DishSearchResult {
  menuItemId: number;
  dishName: string;
  price: number;
  categoryName: string | null;
  restaurantId: string;
  restaurantName: string;
  district: string | null;
  isOpen: boolean;
  supportsTakeaway: boolean;
  supportsDelivery: boolean;
  tags: string[];
}

export interface RestaurantListItem {
  restaurantId: string;
  name: string;
  type: string | null;
  category: string | null;
  district: string | null;
  city: string | null;
  priceRange: number | null;
  rating: number | null;
  isOpen: boolean;
  supportsTakeaway: boolean;
  supportsDelivery: boolean;
  imageUrl: string | null;
}

export interface SearchFilters {
  q?: string;
  district?: string;
  city?: string;
  priceMin?: number;
  priceMax?: number;
  openNow?: boolean;
  takeaway?: boolean;
  delivery?: boolean;
  cuisineType?: string;
  priceRange?: number;
  sortBy?: "rating" | "popular";
  page?: number;
  limit?: number;
}

export interface SearchResponse<T> {
  results: T[];
  total: number;
  page: number;
  limit: number;
}

export interface BusinessHours {
  [day: string]: {
    open: string;
    close: string;
    closed?: boolean;
  };
}
```

- [ ] **Step 2: Write isOpenNow utility**

```typescript
// apps/api/src/features/discovery/utils/isOpenNow.ts
import type { BusinessHours } from "../types";

const DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/**
 * Check if a restaurant is currently open.
 * Workers run in UTC, so we must convert to the restaurant's timezone.
 */
export function isOpenNow(
  businessHours: BusinessHours | null | undefined,
  timezone: string = "Asia/Taipei",
  now?: Date,
): boolean {
  if (!businessHours) return false;

  const currentTime = now || new Date();

  // Convert to restaurant timezone using Intl API (available in Workers runtime)
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(currentTime);
  const weekdayPart =
    parts.find((p) => p.type === "weekday")?.value?.toLowerCase() || "";
  const hourPart = parts.find((p) => p.type === "hour")?.value || "00";
  const minutePart = parts.find((p) => p.type === "minute")?.value || "00";

  const dayKey = weekdayPart; // 'monday', 'tuesday', etc.
  const todayHours = businessHours[dayKey];

  if (!todayHours || todayHours.closed) return false;

  const currentHHmm = `${hourPart}:${minutePart}`;
  return currentHHmm >= todayHours.open && currentHHmm < todayHours.close;
}
```

- [ ] **Step 3: Write isOpenNow tests**

```typescript
// apps/api/src/features/discovery/__tests__/isOpenNow.test.ts
import { describe, it, expect } from "vitest";
import { isOpenNow } from "../utils/isOpenNow";

describe("isOpenNow", () => {
  const businessHours = {
    monday: { open: "09:00", close: "21:00" },
    tuesday: { open: "09:00", close: "21:00" },
    wednesday: { open: "09:00", close: "21:00", closed: true },
    thursday: { open: "09:00", close: "21:00" },
    friday: { open: "09:00", close: "22:00" },
    saturday: { open: "10:00", close: "22:00" },
    sunday: { open: "10:00", close: "20:00" },
  };

  it("should return true when within business hours", () => {
    // Monday 12:00 Asia/Taipei = Monday 04:00 UTC
    const monday = new Date("2026-03-16T04:00:00Z");
    expect(isOpenNow(businessHours, "Asia/Taipei", monday)).toBe(true);
  });

  it("should return false when outside business hours", () => {
    // Monday 22:00 Asia/Taipei = Monday 14:00 UTC
    const monday = new Date("2026-03-16T14:00:00Z");
    expect(isOpenNow(businessHours, "Asia/Taipei", monday)).toBe(false);
  });

  it("should return false on closed days", () => {
    // Wednesday 12:00 Asia/Taipei = Wednesday 04:00 UTC
    const wednesday = new Date("2026-03-18T04:00:00Z");
    expect(isOpenNow(businessHours, "Asia/Taipei", wednesday)).toBe(false);
  });

  it("should return false when businessHours is null", () => {
    expect(isOpenNow(null)).toBe(false);
  });

  it("should return false at exactly closing time", () => {
    // Monday 21:00 Asia/Taipei = Monday 13:00 UTC
    const monday = new Date("2026-03-16T13:00:00Z");
    expect(isOpenNow(businessHours, "Asia/Taipei", monday)).toBe(false);
  });

  it("should return true at exactly opening time", () => {
    // Monday 09:00 Asia/Taipei = Monday 01:00 UTC
    const monday = new Date("2026-03-16T01:00:00Z");
    expect(isOpenNow(businessHours, "Asia/Taipei", monday)).toBe(true);
  });
});
```

- [ ] **Step 4: Run isOpenNow tests**

Run: `pnpm test -- apps/api/src/features/discovery/__tests__/isOpenNow.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/features/discovery/types/ apps/api/src/features/discovery/utils/ apps/api/src/features/discovery/__tests__/isOpenNow.test.ts
git commit -m "feat(discovery): add types, isOpenNow utility with tests"
```

### Task 4: Create Zod validation schemas

**Files:**

- Create: `apps/api/src/features/discovery/schemas/validation.ts`

- [ ] **Step 1: Write validation schemas**

```typescript
// apps/api/src/features/discovery/schemas/validation.ts
import { z } from "zod";

export const dishSearchQuerySchema = z.object({
  q: z.string().min(1).max(100),
  district: z.string().optional(),
  city: z.string().optional(),
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),
  openNow: z.coerce.boolean().optional(),
  takeaway: z.coerce.boolean().optional(),
  delivery: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const restaurantBrowseQuerySchema = z.object({
  district: z.string().optional(),
  city: z.string().optional(),
  cuisineType: z.string().optional(),
  priceRange: z.coerce.number().int().min(1).max(3).optional(),
  openNow: z.coerce.boolean().optional(),
  takeaway: z.coerce.boolean().optional(),
  delivery: z.coerce.boolean().optional(),
  sortBy: z.enum(["rating", "popular"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const restaurantIdParamSchema = z.object({
  id: z.string().min(1),
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/features/discovery/schemas/validation.ts
git commit -m "feat(discovery): add Zod validation schemas"
```

### Task 5: Write DiscoveryService tests

**Files:**

- Create: `apps/api/src/features/discovery/__tests__/DiscoveryService.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// apps/api/src/features/discovery/__tests__/DiscoveryService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DiscoveryService } from "../services/DiscoveryService";

function createMockDb() {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue(null),
      }),
    }),
  };
}

function createMockKV() {
  const store = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => store.get(key) || null),
    put: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      store.delete(key);
    }),
  };
}

describe("DiscoveryService", () => {
  let service: DiscoveryService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockKV: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockKV = createMockKV();
    service = new DiscoveryService(mockDb as any, mockKV as any);
  });

  describe("searchDishes", () => {
    it("should return empty results when no dishes match", async () => {
      const result = await service.searchDishes({ q: "不存在的菜" });
      expect(result.results).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it("should return results from D1 prefix search", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                menu_item_id: 1,
                dish_name: "牛肉麵",
                price: 150,
                category_name: "麵類",
                restaurant_id: "r1",
                restaurant_name: "老王牛肉麵",
                district: "西屯區",
                business_hours: JSON.stringify({
                  monday: { open: "09:00", close: "21:00" },
                }),
                supports_takeaway: 1,
                supports_delivery: 0,
                tags: JSON.stringify(["牛肉", "麵"]),
              },
            ],
          }),
        }),
      });

      const result = await service.searchDishes({ q: "牛肉麵" });
      expect(result.results).toHaveLength(1);
      expect(result.results[0].dishName).toBe("牛肉麵");
      expect(result.results[0].restaurantName).toBe("老王牛肉麵");
    });

    it("should cache search results in KV", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      });

      await service.searchDishes({ q: "牛肉麵" });
      expect(mockKV.put).toHaveBeenCalled();
    });

    it("should return cached results on second call", async () => {
      const cachedResult = JSON.stringify({
        results: [{ menuItemId: 1, dishName: "牛肉麵", price: 150 }],
        total: 1,
        cachedAt: Date.now(),
      });
      mockKV.get.mockResolvedValue(cachedResult);

      const result = await service.searchDishes({ q: "牛肉麵" });
      expect(result.results).toHaveLength(1);
      expect(mockDb.prepare).not.toHaveBeenCalled();
    });

    it("should filter by openNow when specified", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                menu_item_id: 1,
                dish_name: "牛肉麵",
                price: 150,
                category_name: "麵類",
                restaurant_id: "r1",
                restaurant_name: "老王牛肉麵",
                district: "西屯區",
                business_hours: JSON.stringify({
                  monday: { open: "09:00", close: "10:00" }, // closed at test time
                  tuesday: { open: "09:00", close: "10:00" },
                  wednesday: { open: "09:00", close: "10:00" },
                  thursday: { open: "09:00", close: "10:00" },
                  friday: { open: "09:00", close: "10:00" },
                  saturday: { open: "09:00", close: "10:00" },
                  sunday: { open: "09:00", close: "10:00" },
                }),
                supports_takeaway: 1,
                supports_delivery: 0,
                tags: "[]",
              },
            ],
          }),
        }),
      });

      // Force "now" to be 15:00 on a Monday
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-03-16T15:00:00"));

      const result = await service.searchDishes({ q: "牛肉麵", openNow: true });
      expect(result.results).toHaveLength(0); // Closed at 15:00

      vi.useRealTimers();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- apps/api/src/features/discovery/__tests__/DiscoveryService.test.ts`
Expected: FAIL — DiscoveryService module not found

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/features/discovery/__tests__/
git commit -m "test(discovery): add DiscoveryService unit tests (red)"
```

### Task 6: Implement DiscoveryService

**Files:**

- Create: `apps/api/src/features/discovery/services/DiscoveryService.ts`

- [ ] **Step 1: Write DiscoveryService**

```typescript
// apps/api/src/features/discovery/services/DiscoveryService.ts
import type {
  DishSearchResult,
  RestaurantListItem,
  SearchFilters,
  SearchResponse,
} from "../types";
import { isOpenNow } from "../utils/isOpenNow";

const KV_SEARCH_TTL = 15 * 60; // 15 minutes
const KV_RESTAURANT_TTL = 30 * 60; // 30 minutes

export class DiscoveryService {
  constructor(
    private db: D1Database,
    private kv: KVNamespace,
  ) {}

  async searchDishes(
    filters: SearchFilters,
  ): Promise<SearchResponse<DishSearchResult>> {
    const { q, page = 1, limit = 20 } = filters;
    if (!q) return { results: [], total: 0, page, limit };

    // 1. Check KV cache
    const cacheKey = this.buildCacheKey("search:query", filters);
    const cached = await this.kv.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      return { results: parsed.results, total: parsed.total, page, limit };
    }

    // 2. Normalize query
    const normalized = this.normalizeQuery(q);

    // 3. Dual search: D1 prefix match + KV tag index
    const offset = (page - 1) * limit;

    // Path 1: D1 prefix search (indexable)
    const queryResult = await this.db
      .prepare(
        `SELECT dsi.menu_item_id, dsi.dish_name, dsi.price, dsi.category_name,
                dsi.restaurant_id, r.name as restaurant_name, dsi.district,
                r.business_hours, dsi.supports_takeaway, dsi.supports_delivery, dsi.tags
         FROM dish_search_index dsi
         JOIN restaurants r ON dsi.restaurant_id = r.id
         WHERE dsi.is_available = 1
         AND dsi.dish_name_normalized LIKE ?
         ${filters.district ? "AND dsi.district = ?" : ""}
         ${filters.priceMin !== undefined ? "AND dsi.price >= ?" : ""}
         ${filters.priceMax !== undefined ? "AND dsi.price <= ?" : ""}
         ${filters.takeaway ? "AND dsi.supports_takeaway = 1" : ""}
         ${filters.delivery ? "AND dsi.supports_delivery = 1" : ""}
         ORDER BY dsi.price ASC
         LIMIT ? OFFSET ?`,
      )
      .bind(...this.buildBindParams(normalized, filters, limit, offset))
      .all<{
        menu_item_id: number;
        dish_name: string;
        price: number;
        category_name: string | null;
        restaurant_id: string;
        restaurant_name: string;
        district: string | null;
        business_hours: string | null;
        supports_takeaway: number;
        supports_delivery: number;
        tags: string;
      }>();

    // Path 2: KV tag index lookup (substring coverage)
    const tagIndex = await this.kv.get("search:tags:index");
    let tagMatches: number[] = [];
    if (tagIndex) {
      const index: Record<string, { menuItemId: number }[]> =
        JSON.parse(tagIndex);
      if (index[normalized] || index[q]) {
        tagMatches = (index[normalized] || index[q] || []).map(
          (t) => t.menuItemId,
        );
      }
    }

    // Merge tag matches that aren't already in prefix results
    const prefixIds = new Set(queryResult.results.map((r) => r.menu_item_id));
    if (tagMatches.length > 0) {
      const missingIds = tagMatches.filter((id) => !prefixIds.has(id));
      if (missingIds.length > 0) {
        const placeholders = missingIds.map(() => "?").join(",");
        const tagResults = await this.db
          .prepare(
            `SELECT dsi.menu_item_id, dsi.dish_name, dsi.price, dsi.category_name,
                    dsi.restaurant_id, r.name as restaurant_name, dsi.district,
                    r.business_hours, dsi.supports_takeaway, dsi.supports_delivery, dsi.tags
             FROM dish_search_index dsi
             JOIN restaurants r ON dsi.restaurant_id = r.id
             WHERE dsi.is_available = 1 AND dsi.menu_item_id IN (${placeholders})`,
          )
          .bind(...missingIds)
          .all<any>();
        queryResult.results.push(...tagResults.results);
      }
    }

    // 4. Map results + openNow filter
    let results: DishSearchResult[] = queryResult.results.map((row) => ({
      menuItemId: row.menu_item_id,
      dishName: row.dish_name,
      price: row.price,
      categoryName: row.category_name,
      restaurantId: row.restaurant_id,
      restaurantName: row.restaurant_name,
      district: row.district,
      isOpen: isOpenNow(
        row.business_hours ? JSON.parse(row.business_hours) : null,
      ),
      supportsTakeaway: !!row.supports_takeaway,
      supportsDelivery: !!row.supports_delivery,
      tags: row.tags ? JSON.parse(row.tags) : [],
    }));

    if (filters.openNow) {
      results = results.filter((r) => r.isOpen);
    }

    // 5. Cache and return
    const response = { results, total: results.length, page, limit };
    await this.kv.put(
      cacheKey,
      JSON.stringify({ results, total: results.length, cachedAt: Date.now() }),
      {
        expirationTtl: KV_SEARCH_TTL,
      },
    );

    return response;
  }

  async browseRestaurants(
    filters: SearchFilters,
  ): Promise<SearchResponse<RestaurantListItem>> {
    const { page = 1, limit = 20 } = filters;

    // Check KV cache for district-based browse
    if (filters.district && !filters.openNow) {
      const kvKey = `search:restaurants:district:${filters.district}`;
      const cached = await this.kv.get(kvKey);
      if (cached) {
        let restaurants: RestaurantListItem[] = JSON.parse(cached);
        // Apply remaining filters in-Worker
        if (filters.takeaway)
          restaurants = restaurants.filter((r) => r.supportsTakeaway);
        if (filters.delivery)
          restaurants = restaurants.filter((r) => r.supportsDelivery);
        if (filters.priceRange)
          restaurants = restaurants.filter(
            (r) => r.priceRange === filters.priceRange,
          );
        const start = (page - 1) * limit;
        return {
          results: restaurants.slice(start, start + limit),
          total: restaurants.length,
          page,
          limit,
        };
      }
    }

    const offset = (page - 1) * limit;

    const conditions: string[] = ["r.is_active = 1", "r.deleted_at_ms IS NULL"];
    const params: (string | number)[] = [];

    if (filters.district) {
      conditions.push("r.district = ?");
      params.push(filters.district);
    }
    if (filters.city) {
      conditions.push("r.city = ?");
      params.push(filters.city);
    }
    if (filters.cuisineType) {
      conditions.push("r.type = ?");
      params.push(filters.cuisineType);
    }
    if (filters.priceRange) {
      conditions.push("r.price_range = ?");
      params.push(filters.priceRange);
    }
    if (filters.takeaway) {
      conditions.push("r.supports_takeaway = 1");
    }
    if (filters.delivery) {
      conditions.push("r.supports_delivery = 1");
    }

    const orderBy =
      filters.sortBy === "rating" ? "r.rating DESC" : "r.total_orders DESC";

    const result = await this.db
      .prepare(
        `SELECT r.id, r.name, r.type, r.category, r.district, r.city,
                r.price_range, r.rating, r.business_hours,
                r.supports_takeaway, r.supports_delivery, r.logo_url
         FROM restaurants r
         WHERE ${conditions.join(" AND ")}
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`,
      )
      .bind(...params, limit, offset)
      .all<{
        id: string;
        name: string;
        type: string | null;
        category: string | null;
        district: string | null;
        city: string | null;
        price_range: number | null;
        rating: number | null;
        business_hours: string | null;
        supports_takeaway: number;
        supports_delivery: number;
        logo_url: string | null;
      }>();

    const restaurants: RestaurantListItem[] = result.results.map((row) => ({
      restaurantId: row.id,
      name: row.name,
      type: row.type,
      category: row.category,
      district: row.district,
      city: row.city,
      priceRange: row.price_range,
      rating: row.rating,
      isOpen: isOpenNow(
        row.business_hours ? JSON.parse(row.business_hours) : null,
      ),
      supportsTakeaway: !!row.supports_takeaway,
      supportsDelivery: !!row.supports_delivery,
      imageUrl: row.logo_url,
    }));

    // Cache district results in KV
    if (filters.district) {
      const kvKey = `search:restaurants:district:${filters.district}`;
      await this.kv.put(kvKey, JSON.stringify(restaurants), {
        expirationTtl: KV_RESTAURANT_TTL,
      });
    }

    let filtered = restaurants;
    if (filters.openNow) {
      filtered = restaurants.filter((r) => r.isOpen);
    }

    return { results: filtered, total: filtered.length, page, limit };
  }

  async getPopular(): Promise<{
    keywords: string[];
    dishes: DishSearchResult[];
    restaurants: RestaurantListItem[];
  }> {
    // Popular keywords from KV
    const keywordsJson = await this.kv.get("search:meta:popular-keywords");
    const keywords: string[] = keywordsJson ? JSON.parse(keywordsJson) : [];

    // Top dishes by order count
    const topDishes = await this.db
      .prepare(
        `SELECT dsi.menu_item_id, dsi.dish_name, dsi.price, dsi.category_name,
                dsi.restaurant_id, r.name as restaurant_name, dsi.district,
                r.business_hours, dsi.supports_takeaway, dsi.supports_delivery, dsi.tags,
                mi.order_count
         FROM dish_search_index dsi
         JOIN restaurants r ON dsi.restaurant_id = r.id
         JOIN menu_items mi ON dsi.menu_item_id = mi.id
         WHERE dsi.is_available = 1
         ORDER BY mi.order_count DESC
         LIMIT 10`,
      )
      .all<any>();

    const dishes: DishSearchResult[] = topDishes.results.map((row: any) => ({
      menuItemId: row.menu_item_id,
      dishName: row.dish_name,
      price: row.price,
      categoryName: row.category_name,
      restaurantId: row.restaurant_id,
      restaurantName: row.restaurant_name,
      district: row.district,
      isOpen: isOpenNow(
        row.business_hours ? JSON.parse(row.business_hours) : null,
      ),
      supportsTakeaway: !!row.supports_takeaway,
      supportsDelivery: !!row.supports_delivery,
      tags: row.tags ? JSON.parse(row.tags) : [],
    }));

    // Top restaurants
    const topRestaurants = await this.browseRestaurants({
      sortBy: "popular",
      limit: 10,
    });

    return { keywords, dishes, restaurants: topRestaurants.results };
  }

  async reindex(): Promise<{
    dishes: number;
    restaurants: number;
    duration_ms: number;
  }> {
    const start = Date.now();

    // Incremental rebuild: upsert all active items
    const items = await this.db
      .prepare(
        `SELECT mi.id as menu_item_id, mi.name, mi.price, mi.is_available,
                mi.tags, mi.keywords, mi.deleted_at_ms,
                c.name as category_name,
                r.id as restaurant_id, r.district, r.type as restaurant_type,
                r.supports_takeaway, r.supports_delivery, r.deleted_at_ms as restaurant_deleted
         FROM menu_items mi
         LEFT JOIN categories c ON mi.category_id = c.id
         JOIN restaurants r ON mi.restaurant_id = r.id
         WHERE r.is_active = 1`,
      )
      .all<any>();

    let dishCount = 0;
    for (const item of items.results) {
      const isAvailable =
        item.is_available && !item.deleted_at_ms && !item.restaurant_deleted;
      const normalized = this.normalizeQuery(item.name);
      const tags = [
        ...(item.tags ? JSON.parse(item.tags) : []),
        ...(item.keywords ? JSON.parse(item.keywords) : []),
      ];

      await this.db
        .prepare(
          `INSERT OR REPLACE INTO dish_search_index
           (menu_item_id, restaurant_id, dish_name, dish_name_normalized, category_name, price, is_available, tags, district, restaurant_type, supports_takeaway, supports_delivery, updated_at_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          item.menu_item_id,
          item.restaurant_id,
          item.name,
          normalized,
          item.category_name,
          item.price,
          isAvailable ? 1 : 0,
          JSON.stringify(tags),
          item.district,
          item.restaurant_type,
          item.supports_takeaway ? 1 : 0,
          item.supports_delivery ? 1 : 0,
          Date.now(),
        )
        .run();
      dishCount++;
    }

    // Delete stale rows (items no longer in menu_items)
    await this.db
      .prepare(
        `DELETE FROM dish_search_index WHERE menu_item_id NOT IN (SELECT id FROM menu_items)`,
      )
      .run();

    // Rebuild KV tag index: { tag -> [{ menuItemId, restaurantId, dishName, price }] }
    const allTags = await this.db
      .prepare(
        "SELECT menu_item_id, restaurant_id, dish_name, price, tags FROM dish_search_index WHERE is_available = 1",
      )
      .all<{
        menu_item_id: number;
        restaurant_id: string;
        dish_name: string;
        price: number;
        tags: string;
      }>();

    const tagIndex: Record<
      string,
      {
        menuItemId: number;
        restaurantId: string;
        dishName: string;
        price: number;
      }[]
    > = {};
    for (const row of allTags.results) {
      const tags: string[] = row.tags ? JSON.parse(row.tags) : [];
      for (const tag of tags) {
        const normalizedTag = tag.trim().toLowerCase();
        if (!tagIndex[normalizedTag]) tagIndex[normalizedTag] = [];
        tagIndex[normalizedTag].push({
          menuItemId: row.menu_item_id,
          restaurantId: row.restaurant_id,
          dishName: row.dish_name,
          price: row.price,
        });
      }
    }
    await this.kv.put("search:tags:index", JSON.stringify(tagIndex), {
      expirationTtl: 30 * 60,
    });

    const duration_ms = Date.now() - start;
    return {
      dishes: dishCount,
      restaurants: items.results.length,
      duration_ms,
    };
  }

  // --- Private helpers ---

  private normalizeQuery(query: string): string {
    return query.trim().toLowerCase().replace(/\s+/g, "");
  }

  private buildCacheKey(prefix: string, filters: SearchFilters): string {
    const parts = [prefix];
    if (filters.q) parts.push(this.normalizeQuery(filters.q));
    if (filters.district) parts.push(`d:${filters.district}`);
    if (filters.priceMin) parts.push(`pmin:${filters.priceMin}`);
    if (filters.priceMax) parts.push(`pmax:${filters.priceMax}`);
    if (filters.openNow) parts.push("open");
    if (filters.takeaway) parts.push("ta");
    if (filters.delivery) parts.push("dl");
    parts.push(`p:${filters.page || 1}`);
    return parts.join(":");
  }

  private buildBindParams(
    normalized: string,
    filters: SearchFilters,
    limit: number,
    offset: number,
  ): (string | number)[] {
    const params: (string | number)[] = [
      `${normalized}%`, // prefix match (indexable)
    ];
    if (filters.district) params.push(filters.district);
    if (filters.priceMin !== undefined) params.push(filters.priceMin);
    if (filters.priceMax !== undefined) params.push(filters.priceMax);
    params.push(limit, offset);
    return params;
  }
}
```

- [ ] **Step 2: Run tests**

Run: `pnpm test -- apps/api/src/features/discovery/__tests__/DiscoveryService.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/features/discovery/services/DiscoveryService.ts
git commit -m "feat(discovery): implement DiscoveryService with prefix search + KV caching"
```

### Task 7: Implement SearchIndexSyncService

**Files:**

- Create: `apps/api/src/features/discovery/services/SearchIndexSyncService.ts`

- [ ] **Step 1: Write SearchIndexSyncService**

This service is called when menu items or restaurants change, to keep the search index in sync.

```typescript
// apps/api/src/features/discovery/services/SearchIndexSyncService.ts

export class SearchIndexSyncService {
  constructor(
    private db: D1Database,
    private kv: KVNamespace,
  ) {}

  async onMenuItemChanged(menuItemId: number): Promise<void> {
    const item = await this.db
      .prepare(
        `SELECT mi.id, mi.name, mi.price, mi.is_available, mi.tags, mi.keywords,
                mi.deleted_at_ms, mi.restaurant_id, mi.category_id,
                c.name as category_name,
                r.district, r.type as restaurant_type,
                r.supports_takeaway, r.supports_delivery, r.deleted_at_ms as restaurant_deleted
         FROM menu_items mi
         LEFT JOIN categories c ON mi.category_id = c.id
         JOIN restaurants r ON mi.restaurant_id = r.id
         WHERE mi.id = ?`,
      )
      .bind(menuItemId)
      .first<any>();

    if (!item) {
      // Menu item deleted entirely — remove from index
      await this.db
        .prepare("DELETE FROM dish_search_index WHERE menu_item_id = ?")
        .bind(menuItemId)
        .run();
      return;
    }

    const isAvailable =
      item.is_available && !item.deleted_at_ms && !item.restaurant_deleted;
    const normalized = item.name.trim().toLowerCase().replace(/\s+/g, "");
    const tags = [
      ...(item.tags ? JSON.parse(item.tags) : []),
      ...(item.keywords ? JSON.parse(item.keywords) : []),
    ];

    await this.db
      .prepare(
        `INSERT OR REPLACE INTO dish_search_index
         (menu_item_id, restaurant_id, dish_name, dish_name_normalized, category_name, price, is_available, tags, district, restaurant_type, supports_takeaway, supports_delivery, updated_at_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        item.id,
        item.restaurant_id,
        item.name,
        normalized,
        item.category_name,
        item.price,
        isAvailable ? 1 : 0,
        JSON.stringify(tags),
        item.district,
        item.restaurant_type,
        item.supports_takeaway ? 1 : 0,
        item.supports_delivery ? 1 : 0,
        Date.now(),
      )
      .run();
  }

  async onRestaurantChanged(restaurantId: string): Promise<void> {
    // Update all dish_search_index rows for this restaurant
    const restaurant = await this.db
      .prepare(
        "SELECT district, type, supports_takeaway, supports_delivery, deleted_at_ms FROM restaurants WHERE id = ?",
      )
      .bind(restaurantId)
      .first<any>();

    if (!restaurant) return;

    if (restaurant.deleted_at_ms) {
      // Restaurant soft-deleted — mark all dishes unavailable
      await this.db
        .prepare(
          "UPDATE dish_search_index SET is_available = 0, updated_at_ms = ? WHERE restaurant_id = ?",
        )
        .bind(Date.now(), restaurantId)
        .run();
    } else {
      // Update denormalized fields
      await this.db
        .prepare(
          `UPDATE dish_search_index SET district = ?, restaurant_type = ?,
           supports_takeaway = ?, supports_delivery = ?, updated_at_ms = ?
           WHERE restaurant_id = ?`,
        )
        .bind(
          restaurant.district,
          restaurant.type,
          restaurant.supports_takeaway ? 1 : 0,
          restaurant.supports_delivery ? 1 : 0,
          Date.now(),
          restaurantId,
        )
        .run();
    }

    // Invalidate KV restaurant indexes
    await this.kv.delete(`search:restaurants:district:${restaurant.district}`);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/features/discovery/services/SearchIndexSyncService.ts
git commit -m "feat(discovery): add SearchIndexSyncService for index maintenance"
```

---

## Chunk 3: API Routes + Feature Module + Registration

### Task 8: Create API routes

**Files:**

- Create: `apps/api/src/features/discovery/routes/index.ts`

- [ ] **Step 1: Write routes** (5 endpoints: search, restaurants, restaurants/:id/menu, popular, reindex)

Follow the pattern from `apps/api/src/features/analytics/routes/index.ts`. Public endpoints (no auth) for search/browse, admin-only for reindex.

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/features/discovery/routes/index.ts
git commit -m "feat(discovery): add API route handlers"
```

### Task 9: Create DiscoveryModule + register in main app

**Files:**

- Create: `apps/api/src/features/discovery/index.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Write DiscoveryModule** (follow AnalyticsModule pattern)

- [ ] **Step 2: Register in main app**

Add to imports in `apps/api/src/index.ts`:

```typescript
import discoveryFeature from "./features/discovery";
```

Add route mount (in the public routes section, before the auth-protected routes):

```typescript
apiV1.route("/discovery", discoveryFeature.routes);
```

Add rate limit configs (differentiated per endpoint group):

```typescript
"/api/v1/discovery/search": {
  requests: 30,
  windowSeconds: 60,
  burstMultiplier: 1.5,
  blockDuration: 120,
},
"/api/v1/discovery/restaurants": {
  requests: 60,
  windowSeconds: 60,
  burstMultiplier: 1.5,
  blockDuration: 120,
},
"/api/v1/discovery/popular": {
  requests: 60,
  windowSeconds: 60,
  burstMultiplier: 1.5,
  blockDuration: 120,
},
"/api/v1/discovery/reindex": {
  requests: 1,
  windowSeconds: 60,
  burstMultiplier: 1.0,
  blockDuration: 300,
},
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm typecheck --filter=@makanmakan/api`
Expected: No TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/features/discovery/index.ts apps/api/src/index.ts
git commit -m "feat(discovery): register discovery feature module in main API"
```

---

## Chunk 4: Customer App Frontend

### Task 10: Create discovery API client

**Files:**

- Create: `apps/customer-app/src/services/discoveryApi.ts`

- [ ] **Step 1: Write API client**

```typescript
// apps/customer-app/src/services/discoveryApi.ts
import api from "./api";

export interface DishSearchResult {
  menuItemId: number;
  dishName: string;
  price: number;
  categoryName: string | null;
  restaurantId: string;
  restaurantName: string;
  district: string | null;
  isOpen: boolean;
  supportsTakeaway: boolean;
  supportsDelivery: boolean;
  tags: string[];
}

export interface RestaurantListItem {
  restaurantId: string;
  name: string;
  type: string | null;
  district: string | null;
  priceRange: number | null;
  rating: number | null;
  isOpen: boolean;
  supportsTakeaway: boolean;
  supportsDelivery: boolean;
  imageUrl: string | null;
}

export interface SearchFilters {
  q?: string;
  district?: string;
  priceMin?: number;
  priceMax?: number;
  openNow?: boolean;
  takeaway?: boolean;
  delivery?: boolean;
  page?: number;
  limit?: number;
}

export const discoveryApi = {
  async searchDishes(filters: SearchFilters) {
    const res = await api.get("/discovery/search", { params: filters });
    return res.data.data as { results: DishSearchResult[]; total: number };
  },

  async browseRestaurants(filters: SearchFilters) {
    const res = await api.get("/discovery/restaurants", { params: filters });
    return res.data.data as { results: RestaurantListItem[]; total: number };
  },

  async getRestaurantMenu(restaurantId: string) {
    const res = await api.get(`/discovery/restaurants/${restaurantId}/menu`);
    return res.data.data;
  },

  async getPopular() {
    const res = await api.get("/discovery/popular");
    return res.data.data as {
      keywords: string[];
      dishes: DishSearchResult[];
      restaurants: RestaurantListItem[];
    };
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/customer-app/src/services/discoveryApi.ts
git commit -m "feat(customer): add discovery API client"
```

### Task 11: Create Pinia discovery store

**Files:**

- Create: `apps/customer-app/src/stores/discovery.ts`

- [ ] **Step 1: Write Pinia store** for managing search state, filters, results, loading state

- [ ] **Step 2: Commit**

```bash
git add apps/customer-app/src/stores/discovery.ts
git commit -m "feat(customer): add discovery Pinia store"
```

### Task 12: Create discovery UI components

**Files:**

- Create: `apps/customer-app/src/components/discovery/SearchBar.vue`
- Create: `apps/customer-app/src/components/discovery/FilterPanel.vue`
- Create: `apps/customer-app/src/components/discovery/DishResultCard.vue`
- Create: `apps/customer-app/src/components/discovery/RestaurantCard.vue`

- [ ] **Step 1: Write SearchBar** — text input with debounce, popular keyword chips below
- [ ] **Step 2: Write FilterPanel** — collapsible panel with district select, price range slider, takeaway/delivery toggles
- [ ] **Step 3: Write DishResultCard** — card showing dish name, restaurant, price, open/closed badge
- [ ] **Step 4: Write RestaurantCard** — card showing restaurant info, can reuse/extend existing patterns
- [ ] **Step 5: Commit**

```bash
git add apps/customer-app/src/components/discovery/
git commit -m "feat(customer): add discovery UI components"
```

### Task 13: Create DiscoveryView + route

**Files:**

- Create: `apps/customer-app/src/views/DiscoveryView.vue`
- Modify: `apps/customer-app/src/router/index.ts`

- [ ] **Step 1: Write DiscoveryView** — compose SearchBar, FilterPanel, result list (DishResultCard or RestaurantCard), loading/empty states

- [ ] **Step 2: Add route to customer app router**

Add before the catch-all route in `apps/customer-app/src/router/index.ts`:

```typescript
{
  path: "/discover",
  name: "Discover",
  component: () => import("@/views/DiscoveryView.vue"),
  meta: {
    titleKey: "navigation.discover",
  },
},
```

- [ ] **Step 3: Add navigation link in HomeView**

Add an "探索美食" button/link in `apps/customer-app/src/views/HomeView.vue` that navigates to `/discover`.

- [ ] **Step 4: Commit**

```bash
git add apps/customer-app/src/views/DiscoveryView.vue apps/customer-app/src/router/index.ts apps/customer-app/src/views/HomeView.vue
git commit -m "feat(customer): add DiscoveryView and route"
```

---

## Chunk 5: Integration Testing + Final Verification

### Task 14: Build initial search index

- [ ] **Step 1: Start dev servers**

Run: `pnpm dev:core`

- [ ] **Step 2: Apply DB migration**

Run: `pnpm db:migrate:local`

- [ ] **Step 3: Seed data + build index**

Run: `pnpm db:seed:local` (if needed)
Then: `curl -X POST http://localhost:8787/api/v1/discovery/reindex -H "Authorization: Bearer {admin_token}"`
Expected: 200 response with `{ dishes: N, restaurants: N, duration_ms: ... }`

- [ ] **Step 4: Test search API**

Run: `curl "http://localhost:8787/api/v1/discovery/search?q=雞排"`
Expected: 200 response with dish results

- [ ] **Step 5: Test restaurants browse API**

Run: `curl "http://localhost:8787/api/v1/discovery/restaurants?openNow=true"`
Expected: 200 response with restaurant list

- [ ] **Step 6: Test customer app UI**

Navigate to `http://localhost:3000/discover`
Expected: Discovery page loads, search works, results display

- [ ] **Step 7: Run all tests**

Run: `pnpm test -- apps/api/src/features/discovery/`
Expected: All tests pass

- [ ] **Step 8: Run typecheck**

Run: `pnpm typecheck`
Expected: 0 TypeScript errors

- [ ] **Step 9: Final commit**

```bash
git add -A
git commit -m "feat(discovery): complete discovery system Phase 1"
```
