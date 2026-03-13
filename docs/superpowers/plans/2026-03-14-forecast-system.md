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
├── services/ForecastService.ts  — Core prediction logic + KV caching
├── types/index.ts               — TypeScript interfaces
└── __tests__/
    ├── ForecastService.test.ts  — Service unit tests
    └── routes.test.ts           — Route integration tests
```

### Main API entry (apps/api/src/)

```
apps/api/src/
└── index.ts                     — (modify) import + mount forecast feature
```

### Admin Dashboard (apps/admin-dashboard/src/)

```
apps/admin-dashboard/src/
├── views/forecast/
│   └── ForecastView.vue         — Main forecast page
├── components/forecast/
│   ├── ForecastTable.vue        — Item prediction table with confidence + trend
│   ├── ForecastAlerts.vue       — Alert badges panel
│   └── ForecastDatePicker.vue   — Date range selector (tomorrow/week/custom)
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
    const { startDate, endDate, type = "item_level" } = options;
    const dates = this.getDateRange(startDate, endDate);
    const results: ForecastResult[] = [];

    for (const date of dates) {
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

      const metadata: ForecastMetadata = {
        dataSourceDays: HISTORICAL_WEEKS * 7,
        model: "weighted_moving_average",
        weights: WEIGHTS,
        generatedAt: new Date().toISOString(),
      };

      const forecast: ForecastResult = {
        date,
        type,
        items,
        generatedBy: "statistical",
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
    }

    return results;
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

        accuracyItems.push({
          menuItemId,
          menuItemName: "", // Populated from join if needed
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

Run: `pnpm typecheck --filter=@makanmakan/api`
Expected: No TypeScript errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/features/forecast/index.ts apps/api/src/index.ts
git commit -m "feat(forecast): register forecast feature module in main API"
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

A date range selector with quick-pick buttons (tomorrow, this week, custom range).

- [ ] **Step 2: Write ForecastTable component**

A table showing menu item name, predicted quantity, confidence bar, trend arrow/percentage.

- [ ] **Step 3: Write ForecastAlerts component**

Alert badge panel showing high_demand, low_stock, unusual_spike alerts sorted by severity.

- [ ] **Step 4: Write ForecastView (main page)**

Compose the above components. Loads forecast data on mount, refreshes on date change, shows loading states.

- [ ] **Step 5: Commit**

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
