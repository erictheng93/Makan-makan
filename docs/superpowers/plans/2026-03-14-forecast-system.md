# Forecast System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let shop owners predict dish demand based on historical orders, with statistical model + optional AI enhancement.

**Architecture:** New `forecast` feature module in `apps/api/src/features/`, with 3 new DB tables (Drizzle), ForecastService for weighted moving average predictions, KV caching for fast reads, and admin dashboard Vue.js UI. AI enhancement via existing `ai-analytics` package.

**Tech Stack:** Cloudflare Workers + D1 + KV, Drizzle ORM, Hono, Zod, Vue.js 3, Pinia, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-14-forecast-and-discovery-design.md` (Feature 1)

---

## File Structure

### Database (packages/database/)

```
packages/database/src/schema/
├── forecast.ts                  — forecast_cache, ingredient_definitions, menu_item_ingredients tables
└── index.ts                     — (modify) add exports for forecast schema
```

### API (apps/api/src/features/forecast/)

```
apps/api/src/features/forecast/
├── index.ts                     — ForecastModule class (FeatureModule pattern)
├── routes/index.ts              — 4 API endpoints (generate, get, accuracy, alerts)
├── schemas/validation.ts        — Zod schemas for request validation
├── services/ForecastService.ts  — Core prediction logic + KV caching + stale fallback
├── types/index.ts               — TypeScript interfaces
└── __tests__/
    ├── ForecastService.test.ts  — Service unit tests
    └── routes.test.ts           — Route integration tests
```

### Main API entry (apps/api/src/)

```
apps/api/src/
├── index.ts                     — (modify) import + mount forecast feature
└── scheduled.ts                 — (modify) add forecast cron warmup handler
```

### Wrangler config

```
apps/api/wrangler.toml           — (modify) add cron trigger for daily forecast warmup
```

### Admin Dashboard (apps/admin-dashboard/src/)

```
apps/admin-dashboard/src/
├── views/forecast/
│   └── ForecastView.vue         — Main forecast page (tabs: forecast, accuracy)
├── components/forecast/
│   ├── ForecastTable.vue        — Item prediction table with confidence + trend
│   ├── ForecastAlerts.vue       — Alert badges panel (high_demand, low_stock, unusual_spike)
│   ├── ForecastDatePicker.vue   — Date range selector (tomorrow/week/custom)
│   └── ForecastAccuracyTab.vue  — Accuracy report (predicted vs actual table)
├── services/
│   └── forecastApi.ts           — API client for /api/v1/forecast/*
└── router/index.ts              — (modify) add forecast route
```

---

## Chunk 1: Database Schema + Migration

### Task 1: Create forecast Drizzle schema

**Files:**

- Create: `packages/database/src/schema/forecast.ts`
- Modify: `packages/database/src/schema/index.ts`

- [ ] **Step 1: Write the forecast schema file**

```typescript
// packages/database/src/schema/forecast.ts
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { restaurants } from "./restaurants";
import { menuItems } from "./menu-items";

// --- Forecast Cache ---
export const forecastCache = sqliteTable(
  "forecast_cache",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    restaurantId: text("restaurant_id").notNull(),
    forecastDate: text("forecast_date").notNull(), // YYYY-MM-DD
    forecastType: text("forecast_type").notNull(), // 'item_level' | 'ingredient_level'
    data: text("data", { mode: "json" }).$type<
      Record<string, { predicted: number; confidence: number; trend: string }>
    >(),
    metadata: text("metadata", { mode: "json" }).$type<{
      dataSourceDays: number;
      model: string;
      weights: Record<string, number>;
      generatedAt: string;
    }>(),
    generatedBy: text("generated_by").notNull(), // 'statistical' | 'ai_enhanced'
    expiresAt: integer("expires_at_ms", { mode: "timestamp_ms" }),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    restaurantDateTypeIdx: uniqueIndex(
      "forecast_cache_restaurant_date_type_idx",
    ).on(table.restaurantId, table.forecastDate, table.forecastType),
    expiresAtIdx: index("forecast_cache_expires_at_idx").on(table.expiresAt),
  }),
);

export const forecastCacheRelations = relations(forecastCache, ({ one }) => ({
  restaurant: one(restaurants, {
    fields: [forecastCache.restaurantId],
    references: [restaurants.id],
  }),
}));

// --- Ingredient Definitions (future expansion, MVP optional) ---
export const ingredientDefinitions = sqliteTable(
  "ingredient_definitions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    restaurantId: text("restaurant_id").notNull(),
    name: text("name").notNull(),
    unit: text("unit").notNull(), // 'kg', '份', 'ml', etc.
    category: text("category"), // '肉類', '蔬菜', '調味料'
    costPerUnit: real("cost_per_unit"),
    supplier: text("supplier"),
    minStockLevel: real("min_stock_level"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: integer("deleted_at_ms", { mode: "timestamp_ms" }),
  },
  (table) => ({
    restaurantActiveIdx: index("ingredient_defs_restaurant_active_idx").on(
      table.restaurantId,
      table.isActive,
    ),
    restaurantCategoryIdx: index("ingredient_defs_restaurant_category_idx").on(
      table.restaurantId,
      table.category,
    ),
  }),
);

export const ingredientDefinitionsRelations = relations(
  ingredientDefinitions,
  ({ one }) => ({
    restaurant: one(restaurants, {
      fields: [ingredientDefinitions.restaurantId],
      references: [restaurants.id],
    }),
  }),
);

// --- Menu Item Ingredients (future expansion, MVP optional) ---
export const menuItemIngredients = sqliteTable(
  "menu_item_ingredients",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    menuItemId: integer("menu_item_id").notNull(),
    ingredientId: integer("ingredient_id").notNull(),
    quantityPerServing: real("quantity_per_serving").notNull(),
    unit: text("unit").notNull(),
    isOptional: integer("is_optional", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at_ms", { mode: "timestamp_ms" })
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    menuItemIdx: index("menu_item_ingredients_menu_item_idx").on(
      table.menuItemId,
    ),
    ingredientIdx: index("menu_item_ingredients_ingredient_idx").on(
      table.ingredientId,
    ),
  }),
);

export const menuItemIngredientsRelations = relations(
  menuItemIngredients,
  ({ one }) => ({
    menuItem: one(menuItems, {
      fields: [menuItemIngredients.menuItemId],
      references: [menuItems.id],
    }),
    ingredient: one(ingredientDefinitions, {
      fields: [menuItemIngredients.ingredientId],
      references: [ingredientDefinitions.id],
    }),
  }),
);
```

- [ ] **Step 2: Export from schema index**

Add to `packages/database/src/schema/index.ts`:

```typescript
// After existing exports:
export * from "./forecast";
export {
  forecastCacheRelations,
  ingredientDefinitionsRelations,
  menuItemIngredientsRelations,
} from "./forecast";
```

- [ ] **Step 3: Generate migration**

Run: `cd packages/database && pnpm run db:generate`
Expected: New migration file created in `packages/database/migrations_fresh/`

- [ ] **Step 4: Apply migration locally**

Run: `pnpm db:migrate:local`
Expected: Migration applied successfully

- [ ] **Step 5: Verify tables exist**

Run: `npx wrangler d1 execute makanmakan-local --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'forecast%' OR name LIKE 'ingredient%' OR name LIKE 'menu_item_ing%'" --config=./apps/api/wrangler.toml`
Expected: `forecast_cache`, `ingredient_definitions`, `menu_item_ingredients`

- [ ] **Step 6: Commit**

```bash
git add packages/database/src/schema/forecast.ts packages/database/src/schema/index.ts packages/database/migrations_fresh/
git commit -m "feat(database): add forecast schema (forecast_cache, ingredient_definitions, menu_item_ingredients)"
```

---

## Chunk 2: Forecast Feature — Types + Validation + Service

### Task 2: Create TypeScript types

**Files:**

- Create: `apps/api/src/features/forecast/types/index.ts`

- [ ] **Step 1: Write types file**

```typescript
// apps/api/src/features/forecast/types/index.ts

export interface ForecastItemResult {
  menuItemId: number;
  menuItemName: string;
  predicted: number;
  confidence: number; // 0.0 to 1.0
  trend: "up" | "down" | "stable";
  trendPercent: number;
  historicalAvg: number;
}

export interface ForecastResult {
  date: string; // YYYY-MM-DD
  type: "item_level" | "ingredient_level";
  items: ForecastItemResult[];
  generatedBy: "statistical" | "ai_enhanced";
  metadata: ForecastMetadata;
  stale?: boolean;
}

export interface ForecastMetadata {
  dataSourceDays: number;
  model: string;
  weights: Record<string, number>;
  generatedAt: string;
}

export interface ForecastAccuracyItem {
  menuItemId: number;
  menuItemName: string;
  predicted: number;
  actual: number;
  deviation: number; // percentage
}

export interface ForecastAlert {
  type: "high_demand" | "low_stock" | "unusual_spike";
  menuItemId: number;
  menuItemName: string;
  message: string;
  severity: "info" | "warning" | "critical";
  data?: Record<string, unknown>;
}

export interface GenerateForecastOptions {
  startDate: string;
  endDate: string;
  type?: "item_level" | "ingredient_level";
  useAI?: boolean;
}

export interface IForecastService {
  generateForecast(
    restaurantId: string,
    options: GenerateForecastOptions,
  ): Promise<ForecastResult[]>;
  getForecast(
    restaurantId: string,
    startDate: string,
    endDate: string,
    type?: string,
  ): Promise<ForecastResult[]>;
  getAccuracy(
    restaurantId: string,
    startDate: string,
    endDate: string,
  ): Promise<ForecastAccuracyItem[]>;
  getAlerts(restaurantId: string): Promise<ForecastAlert[]>;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/features/forecast/types/index.ts
git commit -m "feat(forecast): add TypeScript type definitions"
```

### Task 3: Create Zod validation schemas

**Files:**

- Create: `apps/api/src/features/forecast/schemas/validation.ts`

- [ ] **Step 1: Write validation schemas**

```typescript
// apps/api/src/features/forecast/schemas/validation.ts
import { z } from "zod";

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format");

export const generateForecastSchema = z
  .object({
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    type: z.enum(["item_level", "ingredient_level"]).default("item_level"),
    useAI: z.boolean().default(false),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "startDate must be before or equal to endDate",
  });

export const getForecastQuerySchema = z
  .object({
    date: dateStringSchema.optional(),
    startDate: dateStringSchema.optional(),
    endDate: dateStringSchema.optional(),
    type: z.enum(["item_level", "ingredient_level"]).optional(),
  })
  .refine((data) => data.date || (data.startDate && data.endDate), {
    message: "Either 'date' or both 'startDate' and 'endDate' are required",
  });

export const accuracyQuerySchema = z
  .object({
    startDate: dateStringSchema,
    endDate: dateStringSchema,
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "startDate must be before or equal to endDate",
  });

export const restaurantIdParamSchema = z.object({
  restaurantId: z.string().min(1, "restaurantId is required"),
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/features/forecast/schemas/validation.ts
git commit -m "feat(forecast): add Zod validation schemas"
```

### Task 4: Write ForecastService tests

**Files:**

- Create: `apps/api/src/features/forecast/__tests__/ForecastService.test.ts`

- [ ] **Step 1: Write failing tests for statistical forecast**

```typescript
// apps/api/src/features/forecast/__tests__/ForecastService.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForecastService } from "../services/ForecastService";

// Mock D1 database
function createMockDb() {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
    }),
    batch: vi.fn().mockResolvedValue([]),
  };
}

// Mock KV store
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

describe("ForecastService", () => {
  let service: ForecastService;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockKV: ReturnType<typeof createMockKV>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockKV = createMockKV();
    service = new ForecastService(mockDb as any, mockKV as any);
  });

  describe("generateForecast", () => {
    it("should return empty forecast when no historical data exists", async () => {
      const results = await service.generateForecast("restaurant-1", {
        startDate: "2026-03-15",
        endDate: "2026-03-15",
        type: "item_level",
      });

      expect(results).toHaveLength(1);
      expect(results[0].items).toHaveLength(0);
      expect(results[0].generatedBy).toBe("statistical");
    });

    it("should calculate weighted moving average from historical orders", async () => {
      // Mock historical order data: 4 weeks of Saturdays
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                menu_item_id: 1,
                item_name: "雞排",
                quantity_sum: 50,
                order_date: "2026-03-08",
              },
              {
                menu_item_id: 1,
                item_name: "雞排",
                quantity_sum: 40,
                order_date: "2026-03-01",
              },
              {
                menu_item_id: 1,
                item_name: "雞排",
                quantity_sum: 45,
                order_date: "2026-02-22",
              },
              {
                menu_item_id: 1,
                item_name: "雞排",
                quantity_sum: 35,
                order_date: "2026-02-15",
              },
            ],
          }),
        }),
      });

      const results = await service.generateForecast("restaurant-1", {
        startDate: "2026-03-15",
        endDate: "2026-03-15",
        type: "item_level",
      });

      expect(results).toHaveLength(1);
      expect(results[0].items).toHaveLength(1);
      const item = results[0].items[0];
      expect(item.menuItemId).toBe(1);
      // Weighted: 50*0.4 + 40*0.3 + 45*0.2 + 35*0.1 = 20 + 12 + 9 + 3.5 = 44.5
      expect(item.predicted).toBeCloseTo(44.5, 0);
      expect(item.confidence).toBeGreaterThan(0);
      expect(item.confidence).toBeLessThanOrEqual(1);
    });

    it("should write forecast to KV cache", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      });

      await service.generateForecast("restaurant-1", {
        startDate: "2026-03-15",
        endDate: "2026-03-15",
      });

      expect(mockKV.put).toHaveBeenCalled();
      const kvKey = mockKV.put.mock.calls[0][0];
      expect(kvKey).toContain("forecast:restaurant-1:2026-03-15");
    });
  });

  describe("getForecast", () => {
    it("should return KV cached result when available", async () => {
      const cachedData = JSON.stringify([
        {
          date: "2026-03-15",
          type: "item_level",
          items: [
            {
              menuItemId: 1,
              menuItemName: "雞排",
              predicted: 45,
              confidence: 0.8,
              trend: "up",
              trendPercent: 5,
              historicalAvg: 42,
            },
          ],
          generatedBy: "statistical",
          metadata: {
            dataSourceDays: 28,
            model: "wma",
            weights: {},
            generatedAt: "2026-03-14T02:00:00Z",
          },
        },
      ]);
      mockKV.get.mockResolvedValue(cachedData);

      const results = await service.getForecast(
        "restaurant-1",
        "2026-03-15",
        "2026-03-15",
      );

      expect(results).toHaveLength(1);
      expect(results[0].items[0].menuItemName).toBe("雞排");
      expect(mockDb.prepare).not.toHaveBeenCalled(); // Should not hit DB
    });
  });

  describe("getAlerts", () => {
    it("should skip low_stock alert when inventoryCount is null", async () => {
      // Mock forecast with predictions but null inventory
      mockKV.get.mockResolvedValue(
        JSON.stringify([
          {
            date: "2026-03-15",
            type: "item_level",
            items: [
              {
                menuItemId: 1,
                menuItemName: "雞排",
                predicted: 100,
                confidence: 0.9,
                trend: "stable",
                trendPercent: 0,
                historicalAvg: 50,
              },
            ],
            generatedBy: "statistical",
            metadata: {
              dataSourceDays: 28,
              model: "wma",
              weights: {},
              generatedAt: "2026-03-14T02:00:00Z",
            },
          },
        ]),
      );

      // Menu item with null inventoryCount (unlimited stock)
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [{ id: 1, name: "雞排", inventory_count: null }],
          }),
        }),
      });

      const alerts = await service.getAlerts("restaurant-1");

      // Should have unusual_spike (100 vs avg 50) but NOT low_stock
      const lowStockAlerts = alerts.filter((a) => a.type === "low_stock");
      expect(lowStockAlerts).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test -- apps/api/src/features/forecast/__tests__/ForecastService.test.ts`
Expected: FAIL — ForecastService module not found

- [ ] **Step 3: Commit failing tests**

```bash
git add apps/api/src/features/forecast/__tests__/ForecastService.test.ts
git commit -m "test(forecast): add ForecastService unit tests (red)"
```

### Task 5: Implement ForecastService

**Files:**

- Create: `apps/api/src/features/forecast/services/ForecastService.ts`

- [ ] **Step 1: Write ForecastService implementation**

```typescript
// apps/api/src/features/forecast/services/ForecastService.ts
import type {
  ForecastResult,
  ForecastItemResult,
  ForecastAccuracyItem,
  ForecastAlert,
  ForecastMetadata,
  GenerateForecastOptions,
  IForecastService,
} from "../types";

const WEIGHTS = { 1: 0.4, 2: 0.3, 3: 0.2, 4: 0.1 };
const KV_TTL_SECONDS = 6 * 60 * 60; // 6 hours
const HISTORICAL_WEEKS = 4;

export class ForecastService implements IForecastService {
  constructor(
    private db: D1Database,
    private kv: KVNamespace,
  ) {}

  async generateForecast(
    restaurantId: string,
    options: GenerateForecastOptions,
  ): Promise<ForecastResult[]> {
    const { startDate, endDate, type = "item_level", useAI = false } = options;
    const dates = this.getDateRange(startDate, endDate);
    const results: ForecastResult[] = [];

    for (const date of dates) {
      try {
        const weekday = new Date(date).getDay(); // 0=Sunday
        const historicalData = await this.getHistoricalSales(
          restaurantId,
          date,
          weekday,
        );

        const items: ForecastItemResult[] = [];
        for (const [menuItemId, weeklyData] of Object.entries(historicalData)) {
          const item = this.calculatePrediction(Number(menuItemId), weeklyData);
          if (item) items.push(item);
        }

        // AI enhancement stub (Phase 2)
        // When useAI is true and ai-analytics package is integrated,
        // pass items through AIInsightsService.enhanceForecast() here.
        // For now, statistical results are returned as-is.
        const generatedBy = useAI ? "statistical" : "statistical"; // Phase 2: 'ai_enhanced'

        const metadata: ForecastMetadata = {
          dataSourceDays: HISTORICAL_WEEKS * 7,
          model: useAI ? "wma+ai" : "weighted_moving_average",
          weights: WEIGHTS,
          generatedAt: new Date().toISOString(),
        };

        const forecast: ForecastResult = {
          date,
          type,
          items,
          generatedBy,
          metadata,
        };

        results.push(forecast);

        // Cache in D1
        await this.saveForecastToDb(restaurantId, forecast);

        // Cache in KV
        const kvKey = `forecast:${restaurantId}:${date}:${type}`;
        await this.kv.put(kvKey, JSON.stringify([forecast]), {
          expirationTtl: KV_TTL_SECONDS,
        });
      } catch (error) {
        // Stale cache fallback: return expired cache with stale flag
        const kvKey = `forecast:${restaurantId}:${date}:${type}`;
        const staleResult = await this.getStaleCache(restaurantId, date, type);
        if (staleResult) {
          staleResult.stale = true;
          results.push(staleResult);
        } else {
          throw error; // No stale cache available, propagate
        }
      }
    }

    return results;
  }

  private async getStaleCache(
    restaurantId: string,
    date: string,
    type: string,
  ): Promise<ForecastResult | null> {
    const dbResult = await this.db
      .prepare(
        "SELECT data, metadata, generated_by FROM forecast_cache WHERE restaurant_id = ? AND forecast_date = ? AND forecast_type = ? LIMIT 1",
      )
      .bind(restaurantId, date, type)
      .first<{ data: string; metadata: string; generated_by: string }>();

    if (!dbResult) return null;

    return {
      date,
      type: type as "item_level" | "ingredient_level",
      items: JSON.parse(dbResult.data) || [],
      generatedBy: dbResult.generated_by as "statistical" | "ai_enhanced",
      metadata: JSON.parse(dbResult.metadata),
      stale: true,
    };
  }

  async getForecast(
    restaurantId: string,
    startDate: string,
    endDate: string,
    type: string = "item_level",
  ): Promise<ForecastResult[]> {
    const dates = this.getDateRange(startDate, endDate);
    const results: ForecastResult[] = [];

    for (const date of dates) {
      // 1. Check KV cache
      const kvKey = `forecast:${restaurantId}:${date}:${type}`;
      const cached = await this.kv.get(kvKey);
      if (cached) {
        const parsed = JSON.parse(cached) as ForecastResult[];
        results.push(...parsed);
        continue;
      }

      // 2. Check D1
      const dbResult = await this.db
        .prepare(
          "SELECT data, metadata, generated_by, expires_at_ms FROM forecast_cache WHERE restaurant_id = ? AND forecast_date = ? AND forecast_type = ? LIMIT 1",
        )
        .bind(restaurantId, date, type)
        .first<{
          data: string;
          metadata: string;
          generated_by: string;
          expires_at_ms: number;
        }>();

      if (
        dbResult &&
        (!dbResult.expires_at_ms || dbResult.expires_at_ms > Date.now())
      ) {
        const forecast: ForecastResult = {
          date,
          type: type as "item_level" | "ingredient_level",
          items: JSON.parse(dbResult.data) || [],
          generatedBy: dbResult.generated_by as "statistical" | "ai_enhanced",
          metadata: JSON.parse(dbResult.metadata),
        };
        results.push(forecast);
        // Re-populate KV
        await this.kv.put(kvKey, JSON.stringify([forecast]), {
          expirationTtl: KV_TTL_SECONDS,
        });
        continue;
      }

      // 3. Generate on miss
      const generated = await this.generateForecast(restaurantId, {
        startDate: date,
        endDate: date,
        type: type as "item_level" | "ingredient_level",
      });
      results.push(...generated);
    }

    return results;
  }

  async getAccuracy(
    restaurantId: string,
    startDate: string,
    endDate: string,
  ): Promise<ForecastAccuracyItem[]> {
    // Get forecasts for date range
    const forecasts = await this.db
      .prepare(
        "SELECT forecast_date, data FROM forecast_cache WHERE restaurant_id = ? AND forecast_date >= ? AND forecast_date <= ? AND forecast_type = 'item_level'",
      )
      .bind(restaurantId, startDate, endDate)
      .all<{ forecast_date: string; data: string }>();

    if (!forecasts.results.length) return [];

    // Build menu item name lookup
    const menuItemIds = new Set<number>();
    for (const f of forecasts.results) {
      const data = JSON.parse(f.data) || {};
      for (const id of Object.keys(data)) menuItemIds.add(Number(id));
    }
    const nameMap = new Map<number, string>();
    if (menuItemIds.size > 0) {
      const placeholders = [...menuItemIds].map(() => "?").join(",");
      const names = await this.db
        .prepare(
          `SELECT id, name FROM menu_items WHERE id IN (${placeholders})`,
        )
        .bind(...menuItemIds)
        .all<{ id: number; name: string }>();
      for (const row of names.results) nameMap.set(row.id, row.name);
    }

    // Get actual sales for same date range
    const actuals = await this.db
      .prepare(
        `SELECT oi.menu_item_id, mi.name as item_name, SUM(oi.quantity) as actual_quantity,
                DATE(o.created_at_ms / 1000, 'unixepoch') as order_date
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         JOIN menu_items mi ON oi.menu_item_id = mi.id
         WHERE o.restaurant_id = ? AND o.status IN ('confirmed','preparing','ready','delivered','paid')
         AND oi.status != 'cancelled'
         AND DATE(o.created_at_ms / 1000, 'unixepoch') >= ? AND DATE(o.created_at_ms / 1000, 'unixepoch') <= ?
         GROUP BY oi.menu_item_id, order_date`,
      )
      .bind(restaurantId, startDate, endDate)
      .all<{
        menu_item_id: number;
        item_name: string;
        actual_quantity: number;
        order_date: string;
      }>();

    // Build actual map: { date -> { menuItemId -> quantity } }
    const actualMap = new Map<string, Map<number, number>>();
    for (const row of actuals.results) {
      if (!actualMap.has(row.order_date))
        actualMap.set(row.order_date, new Map());
      actualMap.get(row.order_date)!.set(row.menu_item_id, row.actual_quantity);
    }

    // Compare predictions vs actuals
    const accuracyItems: ForecastAccuracyItem[] = [];
    for (const forecast of forecasts.results) {
      const predictions: Record<string, { predicted: number }> =
        JSON.parse(forecast.data) || {};
      const dateActuals = actualMap.get(forecast.forecast_date) || new Map();

      for (const [menuItemIdStr, pred] of Object.entries(predictions)) {
        const menuItemId = Number(menuItemIdStr);
        const actual = dateActuals.get(menuItemId) || 0;
        const deviation =
          pred.predicted > 0
            ? (Math.abs(actual - pred.predicted) / pred.predicted) * 100
            : 0;

        // Get menu item name from actuals data or lookup
        const menuItemName = nameMap.get(menuItemId) || `Item #${menuItemId}`;

        accuracyItems.push({
          menuItemId,
          menuItemName,
          predicted: pred.predicted,
          actual,
          deviation: Math.round(deviation * 10) / 10,
        });
      }
    }

    return accuracyItems;
  }

  async getAlerts(restaurantId: string): Promise<ForecastAlert[]> {
    const alerts: ForecastAlert[] = [];
    const tomorrow = this.formatDate(new Date(Date.now() + 86400000));

    // Get tomorrow's forecast
    const forecasts = await this.getForecast(restaurantId, tomorrow, tomorrow);
    if (!forecasts.length || !forecasts[0].items.length) return [];

    // Get menu items with inventory
    const menuItems = await this.db
      .prepare(
        "SELECT id, name, inventory_count FROM menu_items WHERE restaurant_id = ? AND is_available = 1 AND deleted_at_ms IS NULL",
      )
      .bind(restaurantId)
      .all<{ id: number; name: string; inventory_count: number | null }>();

    const inventoryMap = new Map(menuItems.results.map((m) => [m.id, m]));

    for (const item of forecasts[0].items) {
      const menuItem = inventoryMap.get(item.menuItemId);
      if (!menuItem) continue;

      // High demand alert (predicted > threshold, e.g., top 20% by volume)
      if (item.predicted > 30 && item.confidence >= 0.7) {
        alerts.push({
          type: "high_demand",
          menuItemId: item.menuItemId,
          menuItemName: item.menuItemName,
          message: `明日預估高需求：${Math.ceil(item.predicted)} 份，請提前備料`,
          severity: item.predicted > 50 ? "warning" : "info",
          data: { predicted: item.predicted, confidence: item.confidence },
        });
      }

      // Low stock alert (skip if inventoryCount is null = unlimited)
      if (
        menuItem.inventory_count !== null &&
        item.predicted > menuItem.inventory_count
      ) {
        alerts.push({
          type: "low_stock",
          menuItemId: item.menuItemId,
          menuItemName: item.menuItemName,
          message: `預估需要 ${Math.ceil(item.predicted)} 份，但庫存只有 ${menuItem.inventory_count} 份`,
          severity:
            item.predicted > menuItem.inventory_count * 2
              ? "critical"
              : "warning",
        });
      }

      // Unusual spike alert (predicted > 1.5x historical average)
      if (item.historicalAvg > 0 && item.predicted > item.historicalAvg * 1.5) {
        alerts.push({
          type: "unusual_spike",
          menuItemId: item.menuItemId,
          menuItemName: item.menuItemName,
          message: `預估量 ${Math.ceil(item.predicted)} 份，比平均 ${Math.round(item.historicalAvg)} 份高出 ${Math.round(item.trendPercent)}%`,
          severity:
            item.predicted > item.historicalAvg * 2 ? "warning" : "info",
        });
      }
    }

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  // --- Private helpers ---

  private async getHistoricalSales(
    restaurantId: string,
    targetDate: string,
    weekday: number,
  ): Promise<Record<string, { name: string; weeklySales: number[] }>> {
    const result = await this.db
      .prepare(
        `SELECT oi.menu_item_id, mi.name as item_name, SUM(oi.quantity) as quantity_sum,
                DATE(o.created_at_ms / 1000, 'unixepoch') as order_date
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         JOIN menu_items mi ON oi.menu_item_id = mi.id
         WHERE o.restaurant_id = ?
         AND o.status IN ('confirmed','preparing','ready','delivered','paid')
         AND oi.status != 'cancelled'
         AND CAST(strftime('%w', o.created_at_ms / 1000, 'unixepoch') AS INTEGER) = ?
         AND DATE(o.created_at_ms / 1000, 'unixepoch') >= DATE(?, '-' || ? || ' days')
         AND DATE(o.created_at_ms / 1000, 'unixepoch') < ?
         GROUP BY oi.menu_item_id, order_date
         ORDER BY order_date DESC`,
      )
      .bind(restaurantId, weekday, targetDate, HISTORICAL_WEEKS * 7, targetDate)
      .all<{
        menu_item_id: number;
        item_name: string;
        quantity_sum: number;
        order_date: string;
      }>();

    // Group by menu item, ordered by recency (week 1 = most recent)
    const grouped: Record<string, { name: string; weeklySales: number[] }> = {};
    for (const row of result.results) {
      if (!grouped[row.menu_item_id]) {
        grouped[row.menu_item_id] = { name: row.item_name, weeklySales: [] };
      }
      grouped[row.menu_item_id].weeklySales.push(row.quantity_sum);
    }

    return grouped;
  }

  private calculatePrediction(
    menuItemId: number,
    data: { name: string; weeklySales: number[] },
  ): ForecastItemResult | null {
    const { name, weeklySales } = data;
    if (weeklySales.length === 0) return null;

    // Weighted moving average
    const weightKeys = Object.keys(WEIGHTS).map(Number);
    let weightedSum = 0;
    let weightTotal = 0;
    for (let i = 0; i < weeklySales.length && i < weightKeys.length; i++) {
      const weight = WEIGHTS[(i + 1) as keyof typeof WEIGHTS];
      weightedSum += weeklySales[i] * weight;
      weightTotal += weight;
    }
    const predicted = weightTotal > 0 ? weightedSum / weightTotal : 0;

    // Trend
    const historicalAvg =
      weeklySales.reduce((a, b) => a + b, 0) / weeklySales.length;
    const recentAvg =
      weeklySales.slice(0, 2).reduce((a, b) => a + b, 0) /
      Math.min(weeklySales.length, 2);
    const olderAvg =
      weeklySales.slice(2).length > 0
        ? weeklySales.slice(2).reduce((a, b) => a + b, 0) /
          weeklySales.slice(2).length
        : recentAvg;
    const trendPercent =
      olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

    // Apply trend adjustment
    const adjustedPredicted = predicted * (1 + (trendPercent / 100) * 0.5);

    // Confidence (based on coefficient of variation)
    const variance =
      weeklySales.reduce((sum, v) => sum + Math.pow(v - historicalAvg, 2), 0) /
      weeklySales.length;
    const stdDev = Math.sqrt(variance);
    const cv = historicalAvg > 0 ? stdDev / historicalAvg : 1;
    const confidence = Math.max(0, Math.min(1, 1 - cv));

    return {
      menuItemId,
      menuItemName: name,
      predicted: Math.round(adjustedPredicted * 10) / 10,
      confidence: Math.round(confidence * 100) / 100,
      trend: trendPercent > 5 ? "up" : trendPercent < -5 ? "down" : "stable",
      trendPercent: Math.round(trendPercent * 10) / 10,
      historicalAvg: Math.round(historicalAvg * 10) / 10,
    };
  }

  private async saveForecastToDb(
    restaurantId: string,
    forecast: ForecastResult,
  ): Promise<void> {
    const dataJson: Record<
      string,
      { predicted: number; confidence: number; trend: string }
    > = {};
    for (const item of forecast.items) {
      dataJson[item.menuItemId] = {
        predicted: item.predicted,
        confidence: item.confidence,
        trend: item.trend,
      };
    }

    await this.db
      .prepare(
        `INSERT OR REPLACE INTO forecast_cache (restaurant_id, forecast_date, forecast_type, data, metadata, generated_by, expires_at_ms, created_at_ms)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        restaurantId,
        forecast.date,
        forecast.type,
        JSON.stringify(dataJson),
        JSON.stringify(forecast.metadata),
        forecast.generatedBy,
        Date.now() + KV_TTL_SECONDS * 1000,
        Date.now(),
      )
      .run();
  }

  private getDateRange(start: string, end: string): string[] {
    const dates: string[] = [];
    const current = new Date(start);
    const endDate = new Date(end);
    while (current <= endDate) {
      dates.push(this.formatDate(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  private formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
  }
}
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pnpm test -- apps/api/src/features/forecast/__tests__/ForecastService.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/features/forecast/services/ForecastService.ts
git commit -m "feat(forecast): implement ForecastService with weighted moving average"
```

---

## Chunk 3: API Routes + Feature Module + Registration

### Task 6: Create API routes

**Files:**

- Create: `apps/api/src/features/forecast/routes/index.ts`

- [ ] **Step 1: Write routes**

```typescript
// apps/api/src/features/forecast/routes/index.ts
import { Hono } from "hono";
import { authMiddleware, requireRole } from "../../../middleware/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "../../../middleware/validation";
import { ForecastService } from "../services/ForecastService";
import {
  generateForecastSchema,
  getForecastQuerySchema,
  accuracyQuerySchema,
  restaurantIdParamSchema,
} from "../schemas/validation";
import type { Env } from "../../../shared/types";

const routes = new Hono<{ Bindings: Env }>();

// POST /api/v1/forecast/:restaurantId/generate
routes.post(
  "/:restaurantId/generate",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(restaurantIdParamSchema),
  validateBody(generateForecastSchema),
  async (c) => {
    try {
      const { restaurantId } = c.get("validatedParams");
      const body = c.get("validatedBody");
      const service = new ForecastService(c.env.DB, c.env.CACHE_KV);

      const forecasts = await service.generateForecast(restaurantId, body);

      return c.json({
        success: true,
        data: { forecasts },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Generate forecast error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "FORECAST_GENERATE_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to generate forecast",
          },
        },
        500,
      );
    }
  },
);

// GET /api/v1/forecast/:restaurantId
routes.get(
  "/:restaurantId",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(restaurantIdParamSchema),
  validateQuery(getForecastQuerySchema),
  async (c) => {
    try {
      const { restaurantId } = c.get("validatedParams");
      const query = c.get("validatedQuery");
      const service = new ForecastService(c.env.DB, c.env.CACHE_KV);

      const startDate = query.date || query.startDate!;
      const endDate = query.date || query.endDate!;

      const forecasts = await service.getForecast(
        restaurantId,
        startDate,
        endDate,
        query.type,
      );

      return c.json({ success: true, data: { forecasts } });
    } catch (error) {
      console.error("Get forecast error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "FORECAST_GET_FAILED",
            message:
              error instanceof Error ? error.message : "Failed to get forecast",
          },
        },
        500,
      );
    }
  },
);

// GET /api/v1/forecast/:restaurantId/accuracy
routes.get(
  "/:restaurantId/accuracy",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(restaurantIdParamSchema),
  validateQuery(accuracyQuerySchema),
  async (c) => {
    try {
      const { restaurantId } = c.get("validatedParams");
      const { startDate, endDate } = c.get("validatedQuery");
      const service = new ForecastService(c.env.DB, c.env.CACHE_KV);

      const accuracy = await service.getAccuracy(
        restaurantId,
        startDate,
        endDate,
      );

      return c.json({ success: true, data: { accuracy } });
    } catch (error) {
      console.error("Get accuracy error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "FORECAST_ACCURACY_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to get forecast accuracy",
          },
        },
        500,
      );
    }
  },
);

// GET /api/v1/forecast/:restaurantId/alerts
routes.get(
  "/:restaurantId/alerts",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(restaurantIdParamSchema),
  async (c) => {
    try {
      const { restaurantId } = c.get("validatedParams");
      const service = new ForecastService(c.env.DB, c.env.CACHE_KV);

      const alerts = await service.getAlerts(restaurantId);

      return c.json({ success: true, data: { alerts } });
    } catch (error) {
      console.error("Get alerts error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "FORECAST_ALERTS_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to get forecast alerts",
          },
        },
        500,
      );
    }
  },
);

export default routes;
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/features/forecast/routes/index.ts
git commit -m "feat(forecast): add API route handlers"
```

### Task 6b: Write route integration tests

**Files:**

- Create: `apps/api/src/features/forecast/__tests__/routes.test.ts`

- [ ] **Step 1: Write route integration tests**

```typescript
// apps/api/src/features/forecast/__tests__/routes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import routes from "../routes";

// Mock auth middleware to pass through
vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn((c: any, next: any) => next()),
  requireRole: () => vi.fn((c: any, next: any) => next()),
}));

vi.mock("../../../middleware/validation", () => ({
  validateBody: () =>
    vi.fn((c: any, next: any) => {
      c.set("validatedBody", {
        startDate: "2026-03-15",
        endDate: "2026-03-15",
        type: "item_level",
        useAI: false,
      });
      return next();
    }),
  validateQuery: () =>
    vi.fn((c: any, next: any) => {
      c.set("validatedQuery", { date: "2026-03-15" });
      return next();
    }),
  validateParams: () =>
    vi.fn((c: any, next: any) => {
      c.set("validatedParams", { restaurantId: "test-restaurant" });
      return next();
    }),
}));

// Mock ForecastService
vi.mock("../services/ForecastService", () => ({
  ForecastService: vi.fn().mockImplementation(() => ({
    generateForecast: vi
      .fn()
      .mockResolvedValue([
        {
          date: "2026-03-15",
          type: "item_level",
          items: [],
          generatedBy: "statistical",
          metadata: {},
        },
      ]),
    getForecast: vi
      .fn()
      .mockResolvedValue([
        {
          date: "2026-03-15",
          type: "item_level",
          items: [],
          generatedBy: "statistical",
          metadata: {},
        },
      ]),
    getAccuracy: vi.fn().mockResolvedValue([]),
    getAlerts: vi.fn().mockResolvedValue([]),
  })),
}));

describe("Forecast Routes", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route("/forecast", routes);
  });

  it("POST /:restaurantId/generate returns 200", async () => {
    const res = await app.request("/forecast/test-restaurant/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: "2026-03-15", endDate: "2026-03-15" }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("GET /:restaurantId returns 200", async () => {
    const res = await app.request("/forecast/test-restaurant?date=2026-03-15");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("GET /:restaurantId/accuracy returns 200", async () => {
    const res = await app.request(
      "/forecast/test-restaurant/accuracy?startDate=2026-03-01&endDate=2026-03-14",
    );
    expect(res.status).toBe(200);
  });

  it("GET /:restaurantId/alerts returns 200", async () => {
    const res = await app.request("/forecast/test-restaurant/alerts");
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm test -- apps/api/src/features/forecast/__tests__/routes.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/features/forecast/__tests__/routes.test.ts
git commit -m "test(forecast): add route integration tests"
```

### Task 7: Create ForecastModule + register in main app

**Files:**

- Create: `apps/api/src/features/forecast/index.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Write ForecastModule**

```typescript
// apps/api/src/features/forecast/index.ts
import { Hono } from "hono";
import type { Env, FeatureModule } from "../../shared/types";
import { ConsoleLogger } from "../../core/monitoring";
import routes from "./routes";

const FEATURE_NAME = "forecast";
const FEATURE_VERSION = "1.0.0";

class ForecastModule implements FeatureModule {
  public readonly name = FEATURE_NAME;
  public readonly version = FEATURE_VERSION;
  public readonly routes: Hono<{ Bindings: Env }>;
  private logger: ConsoleLogger;

  constructor() {
    this.logger = new ConsoleLogger(FEATURE_NAME);
    this.routes = new Hono<{ Bindings: Env }>();
    this.setupRoutes();
    this.logger.info(`${FEATURE_NAME} module initialized`, {
      version: FEATURE_VERSION,
    });
  }

  private setupRoutes() {
    this.routes.route("/", routes);
  }

  getHealthStatus() {
    return {
      name: this.name,
      version: this.version,
      status: "healthy",
      timestamp: new Date().toISOString(),
      features: {
        statisticalForecast: true,
        aiEnhanced: false, // Phase 2
        prepAlerts: true,
        accuracyTracking: true,
      },
    };
  }
}

export { ForecastModule };

let instance: ForecastModule | null = null;
export function createForecastModule(): ForecastModule {
  if (!instance) instance = new ForecastModule();
  return instance;
}

export default {
  get routes() {
    return createForecastModule().routes;
  },
  getHealthStatus: () => createForecastModule().getHealthStatus(),
};
```

- [ ] **Step 2: Register in main app**

Add to `apps/api/src/index.ts`:

After the existing feature imports (around line 92):

```typescript
import forecastFeature from "./features/forecast";
```

In the route mounting section (after `apiV1.route("/scheduling", ...)` around line 437):

```typescript
apiV1.route("/forecast", forecastFeature.routes);
```

- [ ] **Step 3: Run typecheck**

Run: `pnpm --filter @makanmakan/api typecheck`
Expected: No TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/features/forecast/index.ts apps/api/src/index.ts
git commit -m "feat(forecast): register forecast feature module in main API"
```

### Task 7b: Add cron warmup for daily forecast generation

**Files:**

- Modify: `apps/api/wrangler.toml`
- Modify: `apps/api/src/index.ts` (scheduled handler)

- [ ] **Step 1: Add cron trigger to wrangler.toml**

In `apps/api/wrangler.toml`, add a new cron entry for forecast warmup at 02:30 AM UTC (after token cleanup at 02:00):

```toml
crons = [
  "0 2 * * *",   # Daily token cleanup
  "0 3 * * 0",   # Weekly log cleanup
  "30 2 * * *"   # Daily forecast warmup
]
```

- [ ] **Step 2: Add forecast warmup handler to scheduled event**

In `apps/api/src/index.ts`, inside the `scheduled` handler, add after the existing cron blocks:

```typescript
// Daily forecast warmup at 2:30 AM UTC
if (event.cron === "30 2 * * *") {
  console.log("[Cron] Running daily forecast warmup...");
  const { ForecastService } =
    await import("./features/forecast/services/ForecastService");
  const forecastService = new ForecastService(env.DB, env.CACHE_KV);

  // Get active restaurants
  const restaurants = await env.DB.prepare(
    "SELECT id FROM restaurants WHERE is_active = 1 AND deleted_at_ms IS NULL",
  ).all<{ id: string }>();

  const tomorrow = new Date(Date.now() + 86400000);
  const dayAfter = new Date(Date.now() + 2 * 86400000);
  const day3 = new Date(Date.now() + 3 * 86400000);
  const formatDate = (d: Date) => d.toISOString().split("T")[0];

  let successCount = 0;
  for (const restaurant of restaurants.results) {
    try {
      await forecastService.generateForecast(restaurant.id, {
        startDate: formatDate(tomorrow),
        endDate: formatDate(day3),
      });
      successCount++;
    } catch (error) {
      console.error(
        `[Cron] Forecast warmup failed for restaurant ${restaurant.id}:`,
        error,
      );
    }
  }
  console.log(
    `[Cron] Forecast warmup complete: ${successCount}/${restaurants.results.length} restaurants`,
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/wrangler.toml apps/api/src/index.ts
git commit -m "feat(forecast): add daily cron warmup for forecast generation"
```

---

## Chunk 4: Admin Dashboard UI

### Task 8: Create forecast API client

**Files:**

- Create: `apps/admin-dashboard/src/services/forecastApi.ts`

- [ ] **Step 1: Write API client**

```typescript
// apps/admin-dashboard/src/services/forecastApi.ts
import api from "./api";
import type {
  ForecastResult,
  ForecastAccuracyItem,
  ForecastAlert,
} from "./types/forecast";

export interface ForecastResponse<T> {
  success: boolean;
  data: T;
}

export const forecastApi = {
  async generate(
    restaurantId: string,
    params: {
      startDate: string;
      endDate: string;
      type?: string;
      useAI?: boolean;
    },
  ): Promise<ForecastResult[]> {
    const res = await api.post(`/forecast/${restaurantId}/generate`, params);
    return res.data.data.forecasts;
  },

  async getForecast(
    restaurantId: string,
    params: {
      date?: string;
      startDate?: string;
      endDate?: string;
      type?: string;
    },
  ): Promise<ForecastResult[]> {
    const res = await api.get(`/forecast/${restaurantId}`, { params });
    return res.data.data.forecasts;
  },

  async getAccuracy(
    restaurantId: string,
    params: {
      startDate: string;
      endDate: string;
    },
  ): Promise<ForecastAccuracyItem[]> {
    const res = await api.get(`/forecast/${restaurantId}/accuracy`, { params });
    return res.data.data.accuracy;
  },

  async getAlerts(restaurantId: string): Promise<ForecastAlert[]> {
    const res = await api.get(`/forecast/${restaurantId}/alerts`);
    return res.data.data.alerts;
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add apps/admin-dashboard/src/services/forecastApi.ts
git commit -m "feat(admin): add forecast API client"
```

### Task 9: Create ForecastView + components

**Files:**

- Create: `apps/admin-dashboard/src/views/forecast/ForecastView.vue`
- Create: `apps/admin-dashboard/src/components/forecast/ForecastTable.vue`
- Create: `apps/admin-dashboard/src/components/forecast/ForecastAlerts.vue`
- Create: `apps/admin-dashboard/src/components/forecast/ForecastDatePicker.vue`

- [ ] **Step 1: Write ForecastDatePicker component**

```vue
<!-- apps/admin-dashboard/src/components/forecast/ForecastDatePicker.vue -->
<template>
  <div class="flex items-center gap-3">
    <div class="flex rounded-lg border border-gray-300 overflow-hidden">
      <button
        v-for="preset in presets"
        :key="preset.key"
        class="px-4 py-2 text-sm font-medium transition-colors"
        :class="
          selectedPreset === preset.key
            ? 'bg-blue-600 text-white'
            : 'bg-white text-gray-700 hover:bg-gray-50'
        "
        @click="selectPreset(preset.key)"
      >
        {{ preset.label }}
      </button>
    </div>
    <div v-if="selectedPreset === 'custom'" class="flex items-center gap-2">
      <input
        type="date"
        :value="startDate"
        class="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        @input="
          $emit('update:startDate', ($event.target as HTMLInputElement).value)
        "
      />
      <span class="text-gray-500">~</span>
      <input
        type="date"
        :value="endDate"
        class="px-3 py-2 border border-gray-300 rounded-lg text-sm"
        @input="
          $emit('update:endDate', ($event.target as HTMLInputElement).value)
        "
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  startDate: string;
  endDate: string;
}>();

const emit = defineEmits<{
  "update:startDate": [value: string];
  "update:endDate": [value: string];
}>();

const selectedPreset = ref("tomorrow");

const presets = [
  { key: "tomorrow", label: "明日" },
  { key: "week", label: "本週" },
  { key: "custom", label: "自訂" },
];

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function selectPreset(key: string) {
  selectedPreset.value = key;
  const today = new Date();
  if (key === "tomorrow") {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    emit("update:startDate", formatDate(tomorrow));
    emit("update:endDate", formatDate(tomorrow));
  } else if (key === "week") {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
    emit("update:startDate", formatDate(tomorrow));
    emit("update:endDate", formatDate(endOfWeek));
  }
}
</script>
```

- [ ] **Step 2: Write ForecastTable component**

```vue
<!-- apps/admin-dashboard/src/components/forecast/ForecastTable.vue -->
<template>
  <div class="bg-white rounded-lg shadow overflow-hidden">
    <table class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
          >
            {{ t("forecast.menuItem") }}
          </th>
          <th
            class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"
          >
            {{ t("forecast.predicted") }}
          </th>
          <th
            class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase"
          >
            {{ t("forecast.confidence") }}
          </th>
          <th
            class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase"
          >
            {{ t("forecast.trend") }}
          </th>
          <th
            class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"
          >
            {{ t("forecast.historicalAvg") }}
          </th>
        </tr>
      </thead>
      <tbody class="bg-white divide-y divide-gray-200">
        <tr
          v-for="item in items"
          :key="item.menuItemId"
          class="hover:bg-gray-50"
        >
          <td
            class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
          >
            {{ item.menuItemName }}
          </td>
          <td
            class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-semibold"
          >
            {{ Math.ceil(item.predicted) }}
          </td>
          <td class="px-6 py-4 whitespace-nowrap">
            <div class="flex items-center justify-center gap-2">
              <div class="w-20 bg-gray-200 rounded-full h-2">
                <div
                  class="h-2 rounded-full transition-all"
                  :class="confidenceColor(item.confidence)"
                  :style="{ width: `${item.confidence * 100}%` }"
                ></div>
              </div>
              <span class="text-xs text-gray-500"
                >{{ Math.round(item.confidence * 100) }}%</span
              >
            </div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-center">
            <span
              class="inline-flex items-center gap-1 text-sm font-medium"
              :class="{
                'text-green-600': item.trend === 'up',
                'text-red-600': item.trend === 'down',
                'text-gray-500': item.trend === 'stable',
              }"
            >
              <span v-if="item.trend === 'up'">↑</span>
              <span v-else-if="item.trend === 'down'">↓</span>
              <span v-else>→</span>
              {{ Math.abs(item.trendPercent).toFixed(1) }}%
            </span>
          </td>
          <td
            class="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500"
          >
            {{ item.historicalAvg.toFixed(1) }}
          </td>
        </tr>
        <tr v-if="items.length === 0">
          <td colspan="5" class="px-6 py-8 text-center text-gray-500">
            {{ t("forecast.noData") }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { ForecastItemResult } from "@/services/types/forecast";

const { t } = useI18n();

defineProps<{
  items: ForecastItemResult[];
}>();

function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return "bg-green-500";
  if (confidence >= 0.5) return "bg-yellow-500";
  return "bg-red-500";
}
</script>
```

- [ ] **Step 3: Write ForecastAlerts component**

```vue
<!-- apps/admin-dashboard/src/components/forecast/ForecastAlerts.vue -->
<template>
  <div v-if="alerts.length > 0" class="space-y-3">
    <div
      v-for="(alert, index) in alerts"
      :key="index"
      class="flex items-start gap-3 p-4 rounded-lg border"
      :class="alertStyles[alert.severity]"
    >
      <div class="flex-shrink-0 mt-0.5">
        <ExclamationTriangleIcon
          v-if="alert.severity === 'critical'"
          class="h-5 w-5 text-red-600"
        />
        <ExclamationCircleIcon
          v-else-if="alert.severity === 'warning'"
          class="h-5 w-5 text-yellow-600"
        />
        <InformationCircleIcon v-else class="h-5 w-5 text-blue-600" />
      </div>
      <div class="flex-1">
        <div class="flex items-center gap-2">
          <span
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
            :class="typeStyles[alert.type]"
          >
            {{ typeLabels[alert.type] }}
          </span>
          <span class="text-sm font-medium text-gray-900">
            {{ alert.menuItemName }}
          </span>
        </div>
        <p class="mt-1 text-sm text-gray-600">{{ alert.message }}</p>
      </div>
    </div>
  </div>
  <div v-else class="text-center py-6 text-gray-500 text-sm">
    {{ t("forecast.noAlerts") }}
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import {
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  InformationCircleIcon,
} from "@heroicons/vue/24/outline";
import type { ForecastAlert } from "@/services/types/forecast";

const { t } = useI18n();

defineProps<{
  alerts: ForecastAlert[];
}>();

const alertStyles: Record<string, string> = {
  critical: "bg-red-50 border-red-200",
  warning: "bg-yellow-50 border-yellow-200",
  info: "bg-blue-50 border-blue-200",
};

const typeStyles: Record<string, string> = {
  high_demand: "bg-orange-100 text-orange-800",
  low_stock: "bg-red-100 text-red-800",
  unusual_spike: "bg-purple-100 text-purple-800",
};

const typeLabels: Record<string, string> = {
  high_demand: "高需求",
  low_stock: "庫存不足",
  unusual_spike: "異常波動",
};
</script>
```

- [ ] **Step 4: Write ForecastAccuracyTab component**

```vue
<!-- apps/admin-dashboard/src/components/forecast/ForecastAccuracyTab.vue -->
<template>
  <div class="bg-white rounded-lg shadow overflow-hidden">
    <div class="px-6 py-4 border-b border-gray-200">
      <h3 class="text-lg font-medium text-gray-900">
        {{ t("forecast.accuracyReport") }}
      </h3>
      <p class="text-sm text-gray-500">
        {{ t("forecast.accuracyDescription") }}
      </p>
    </div>
    <div v-if="loading" class="flex justify-center py-12">
      <div
        class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"
      ></div>
    </div>
    <table v-else class="min-w-full divide-y divide-gray-200">
      <thead class="bg-gray-50">
        <tr>
          <th
            class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase"
          >
            菜品
          </th>
          <th
            class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"
          >
            預測量
          </th>
          <th
            class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"
          >
            實際量
          </th>
          <th
            class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase"
          >
            偏差 %
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-200">
        <tr
          v-for="item in items"
          :key="item.menuItemId"
          class="hover:bg-gray-50"
        >
          <td class="px-6 py-4 text-sm font-medium text-gray-900">
            {{ item.menuItemName }}
          </td>
          <td class="px-6 py-4 text-sm text-right text-gray-700">
            {{ item.predicted }}
          </td>
          <td class="px-6 py-4 text-sm text-right text-gray-700">
            {{ item.actual }}
          </td>
          <td
            class="px-6 py-4 text-sm text-right font-medium"
            :class="deviationColor(item.deviation)"
          >
            {{ item.deviation.toFixed(1) }}%
          </td>
        </tr>
        <tr v-if="items.length === 0">
          <td colspan="4" class="px-6 py-8 text-center text-gray-500">
            {{ t("forecast.noAccuracyData") }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import type { ForecastAccuracyItem } from "@/services/types/forecast";

const { t } = useI18n();

defineProps<{
  items: ForecastAccuracyItem[];
  loading: boolean;
}>();

function deviationColor(deviation: number): string {
  if (deviation <= 10) return "text-green-600";
  if (deviation <= 25) return "text-yellow-600";
  return "text-red-600";
}
</script>
```

- [ ] **Step 5: Write ForecastView (main page)**

```vue
<!-- apps/admin-dashboard/src/views/forecast/ForecastView.vue -->
<template>
  <div class="forecast-view">
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">
          {{ t("forecast.title") }}
        </h1>
        <p class="text-gray-600">{{ t("forecast.subtitle") }}</p>
      </div>
      <div class="flex items-center gap-3">
        <button
          class="flex items-center px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          :disabled="loading"
          @click="loadForecast"
        >
          <ArrowPathIcon class="h-4 w-4 mr-2" />
          {{ t("common.refresh") }}
        </button>
        <button
          class="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          :disabled="generating"
          @click="generateForecast"
        >
          <span v-if="generating" class="animate-spin mr-2">⏳</span>
          {{ t("forecast.generate") }}
        </button>
      </div>
    </div>

    <!-- Stale data warning -->
    <div
      v-if="isStale"
      class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800"
    >
      ⚠️ {{ t("forecast.staleWarning") }}
    </div>

    <!-- Date Picker -->
    <div class="mb-6">
      <ForecastDatePicker
        :start-date="startDate"
        :end-date="endDate"
        @update:start-date="startDate = $event"
        @update:end-date="endDate = $event"
      />
    </div>

    <!-- Tabs -->
    <div class="border-b border-gray-200 mb-6">
      <nav class="flex gap-6">
        <button
          class="pb-3 text-sm font-medium border-b-2 transition-colors"
          :class="
            activeTab === 'forecast'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          "
          @click="activeTab = 'forecast'"
        >
          {{ t("forecast.forecastTab") }}
        </button>
        <button
          class="pb-3 text-sm font-medium border-b-2 transition-colors"
          :class="
            activeTab === 'accuracy'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          "
          @click="
            activeTab = 'accuracy';
            loadAccuracy();
          "
        >
          {{ t("forecast.accuracyTab") }}
        </button>
      </nav>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center py-16">
      <div
        class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"
      ></div>
    </div>

    <!-- Forecast Tab -->
    <template v-else-if="activeTab === 'forecast'">
      <ForecastAlerts :alerts="alerts" class="mb-6" />
      <ForecastTable :items="forecastItems" />
    </template>

    <!-- Accuracy Tab -->
    <template v-else-if="activeTab === 'accuracy'">
      <ForecastAccuracyTab :items="accuracyItems" :loading="accuracyLoading" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ArrowPathIcon } from "@heroicons/vue/24/outline";
import { forecastApi } from "@/services/forecastApi";
import { useAuthStore } from "@/stores/auth";
import ForecastDatePicker from "@/components/forecast/ForecastDatePicker.vue";
import ForecastTable from "@/components/forecast/ForecastTable.vue";
import ForecastAlerts from "@/components/forecast/ForecastAlerts.vue";
import ForecastAccuracyTab from "@/components/forecast/ForecastAccuracyTab.vue";
import type {
  ForecastItemResult,
  ForecastAccuracyItem,
  ForecastAlert,
} from "@/services/types/forecast";

const { t } = useI18n();
const authStore = useAuthStore();

const loading = ref(false);
const generating = ref(false);
const accuracyLoading = ref(false);
const isStale = ref(false);
const activeTab = ref<"forecast" | "accuracy">("forecast");

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const startDate = ref(tomorrow.toISOString().split("T")[0]);
const endDate = ref(tomorrow.toISOString().split("T")[0]);

const forecastItems = ref<ForecastItemResult[]>([]);
const alerts = ref<ForecastAlert[]>([]);
const accuracyItems = ref<ForecastAccuracyItem[]>([]);

const restaurantId = computed(() => authStore.currentRestaurantId || "");

async function loadForecast() {
  if (!restaurantId.value) return;
  loading.value = true;
  try {
    const forecasts = await forecastApi.getForecast(restaurantId.value, {
      startDate: startDate.value,
      endDate: endDate.value,
    });
    forecastItems.value = forecasts.flatMap((f) => f.items);
    isStale.value = forecasts.some((f) => f.stale);

    const alertsData = await forecastApi.getAlerts(restaurantId.value);
    alerts.value = alertsData;
  } catch (error) {
    console.error("Failed to load forecast:", error);
  } finally {
    loading.value = false;
  }
}

async function generateForecast() {
  if (!restaurantId.value) return;
  generating.value = true;
  try {
    await forecastApi.generate(restaurantId.value, {
      startDate: startDate.value,
      endDate: endDate.value,
    });
    await loadForecast();
  } catch (error) {
    console.error("Failed to generate forecast:", error);
  } finally {
    generating.value = false;
  }
}

async function loadAccuracy() {
  if (!restaurantId.value) return;
  accuracyLoading.value = true;
  try {
    // Load accuracy for past 7 days
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 7);
    accuracyItems.value = await forecastApi.getAccuracy(restaurantId.value, {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    });
  } catch (error) {
    console.error("Failed to load accuracy:", error);
  } finally {
    accuracyLoading.value = false;
  }
}

watch([startDate, endDate], () => {
  if (activeTab.value === "forecast") loadForecast();
});

onMounted(() => loadForecast());
</script>
```

- [ ] **Step 6: Commit**

```bash
git add apps/admin-dashboard/src/views/forecast/ apps/admin-dashboard/src/components/forecast/
git commit -m "feat(admin): add forecast dashboard view and components"
```

### Task 10: Add forecast route to admin dashboard

**Files:**

- Modify: `apps/admin-dashboard/src/router/index.ts`

- [ ] **Step 1: Add forecast route**

Add as a child of the dashboard route (following existing pattern):

```typescript
{
  path: "forecast",
  name: "Forecast",
  component: () => import("@/views/forecast/ForecastView.vue"),
  meta: {
    titleKey: "pages.forecast",
    roles: [UserRole.ADMIN, UserRole.OWNER],
  },
},
```

- [ ] **Step 2: Verify the route loads**

Run: `pnpm dev:admin` and navigate to `http://localhost:3001/dashboard/forecast`
Expected: Forecast page loads without errors

- [ ] **Step 3: Commit**

```bash
git add apps/admin-dashboard/src/router/index.ts
git commit -m "feat(admin): add forecast route to admin dashboard"
```

---

## Chunk 5: Integration Testing + Final Verification

### Task 11: End-to-end verification

- [ ] **Step 1: Start dev servers**

Run: `pnpm dev:core`

- [ ] **Step 2: Apply DB migration**

Run: `pnpm db:migrate:local`

- [ ] **Step 3: Seed mock data (if not already seeded)**

Run: `pnpm db:seed:local`

- [ ] **Step 4: Test forecast generate API**

Run: `curl -X POST http://localhost:8787/api/v1/forecast/{restaurantId}/generate -H "Authorization: Bearer {token}" -H "Content-Type: application/json" -d '{"startDate":"2026-03-15","endDate":"2026-03-16"}'`
Expected: 200 response with forecast data

- [ ] **Step 5: Test forecast get API**

Run: `curl http://localhost:8787/api/v1/forecast/{restaurantId}?date=2026-03-15 -H "Authorization: Bearer {token}"`
Expected: 200 response with cached forecast

- [ ] **Step 6: Test alerts API**

Run: `curl http://localhost:8787/api/v1/forecast/{restaurantId}/alerts -H "Authorization: Bearer {token}"`
Expected: 200 response with alerts array

- [ ] **Step 7: Run full test suite**

Run: `pnpm test -- apps/api/src/features/forecast/`
Expected: All tests pass

- [ ] **Step 8: Run typecheck**

Run: `pnpm typecheck`
Expected: 0 TypeScript errors

- [ ] **Step 9: Final commit**

```bash
git add -A
git commit -m "feat(forecast): complete forecast system Phase 1"
```
