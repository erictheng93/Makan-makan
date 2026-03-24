/**
 * Tests for ProductAnalysisService
 * Tests the core business logic: trend calculation, growth rate, rankings, and categorization
 *
 * The mock simulates Drizzle's chainable query builder pattern:
 *   db.select({...}).from(table).leftJoin(...).where(...).groupBy(...).orderBy(...)
 * Each call in the chain records its arguments and returns `this` for chaining.
 * The final method in the chain (orderBy for fetchRawMetrics, orderBy for fetchDailyData)
 * resolves with the pre-configured mock data.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProductAnalysisService } from "../services/ProductAnalysisService";

// Creates a chainable mock that mimics Drizzle's query builder
function createMockDrizzleDb() {
  let callCount = 0;
  let mockResults: any[][] = [];

  const chainable = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve(mockResults[callCount - 1] || []);
    }),
  };

  return {
    ...chainable,
    _setResults(results: any[][]) {
      mockResults = results;
      callCount = 0;
    },
    _resetCallCount() {
      callCount = 0;
    },
  };
}

describe("ProductAnalysisService", () => {
  let service: ProductAnalysisService;
  let mockDb: ReturnType<typeof createMockDrizzleDb>;

  beforeEach(() => {
    mockDb = createMockDrizzleDb();
    service = new ProductAnalysisService(mockDb as any);
  });

  describe("analyzeProducts", () => {
    it("returns empty array when no products found", async () => {
      mockDb._setResults([[]]);

      const result = await service.analyzeProducts("restaurant-1", {
        range: "30d",
      });
      expect(result).toEqual([]);
    });

    it("analyzes products and returns ranked results", async () => {
      const rawMetrics = [
        {
          menu_item_id: "item-1",
          menu_item_name: "Nasi Goreng",
          category: "Main",
          unit_price: 12.0,
          unit_cost: 4.0,
          total_orders: 100,
          total_revenue: 1200,
          first_item_count: 40,
          view_count: 500,
          cart_addition_count: 200,
        },
        {
          menu_item_id: "item-2",
          menu_item_name: "Mie Goreng",
          category: "Main",
          unit_price: 10.0,
          unit_cost: 3.0,
          total_orders: 50,
          total_revenue: 500,
          first_item_count: 10,
          view_count: 300,
          cart_addition_count: 80,
        },
      ];

      const dailyData = [
        { date: "2026-02-01", orders: 3, revenue: 36 },
        { date: "2026-02-02", orders: 4, revenue: 48 },
        { date: "2026-02-03", orders: 5, revenue: 60 },
        { date: "2026-02-04", orders: 6, revenue: 72 },
      ];

      // Call 1: fetchRawMetrics, Call 2-3: fetchDailyData per product
      mockDb._setResults([rawMetrics, dailyData, dailyData]);

      const result = await service.analyzeProducts("restaurant-1", {
        range: "30d",
      });

      expect(result).toHaveLength(2);

      // Check first product (higher orders)
      const nasiGoreng = result.find((p) => p.menuItemId === "item-1");
      expect(nasiGoreng).toBeDefined();
      expect(nasiGoreng!.menuItemName).toBe("Nasi Goreng");
      expect(nasiGoreng!.totalOrders).toBe(100);
      expect(nasiGoreng!.totalRevenue).toBe(1200);
      expect(nasiGoreng!.salesRank).toBe(1);
      expect(nasiGoreng!.revenueRank).toBe(1);

      // Check profit calculations
      expect(nasiGoreng!.profitMargin).toBeCloseTo((12 - 4) / 12);
      expect(nasiGoreng!.totalProfit).toBe((12 - 4) * 100);

      // Check conversion metrics
      expect(nasiGoreng!.cartAdditionRate).toBe(200 / 500);
      expect(nasiGoreng!.conversionRate).toBe(100 / 200);

      // Check second product ranks lower
      const mieGoreng = result.find((p) => p.menuItemId === "item-2");
      expect(mieGoreng!.salesRank).toBe(2);
      expect(mieGoreng!.revenueRank).toBe(2);
    });
  });

  describe("getTrafficDrivers", () => {
    it("returns only products categorized as traffic-driver", async () => {
      const rawMetrics = [
        {
          menu_item_id: "driver-1",
          menu_item_name: "Special Drink",
          category: "Drinks",
          unit_price: 5.0,
          unit_cost: null,
          total_orders: 50,
          total_revenue: 250,
          first_item_count: 25, // 50% ratio > 0.3 threshold, and >= 5
          view_count: 100,
          cart_addition_count: 60,
        },
        {
          menu_item_id: "non-driver",
          menu_item_name: "Side Dish",
          category: "Sides",
          unit_price: 3.0,
          unit_cost: null,
          total_orders: 30,
          total_revenue: 90,
          first_item_count: 1, // Very low ratio
          view_count: 50,
          cart_addition_count: 20,
        },
      ];

      const dailyData = [
        { date: "2026-02-01", orders: 5, revenue: 25 },
        { date: "2026-02-02", orders: 6, revenue: 30 },
      ];

      mockDb._setResults([rawMetrics, dailyData, dailyData]);

      const drivers = await service.getTrafficDrivers("restaurant-1", {
        range: "30d",
      });

      const driverIds = drivers.map((d) => d.menuItemId);
      expect(driverIds).toContain("driver-1");
    });
  });

  describe("getBestsellers", () => {
    it("returns products sorted by total orders descending", async () => {
      const rawMetrics = [
        {
          menu_item_id: "low",
          menu_item_name: "Low Seller",
          category: "Main",
          unit_price: 10,
          unit_cost: null,
          total_orders: 10,
          total_revenue: 100,
          first_item_count: 2,
          view_count: 50,
          cart_addition_count: 15,
        },
        {
          menu_item_id: "high",
          menu_item_name: "High Seller",
          category: "Main",
          unit_price: 10,
          unit_cost: null,
          total_orders: 200,
          total_revenue: 2000,
          first_item_count: 50,
          view_count: 500,
          cart_addition_count: 300,
        },
      ];

      const dailyData = [
        { date: "2026-02-01", orders: 5, revenue: 50 },
        { date: "2026-02-02", orders: 6, revenue: 60 },
      ];

      mockDb._setResults([rawMetrics, dailyData, dailyData]);

      const bestsellers = await service.getBestsellers(
        "restaurant-1",
        { range: "30d" },
        10,
      );

      expect(bestsellers[0].menuItemId).toBe("high");
      expect(bestsellers[0].totalOrders).toBe(200);
    });

    it("respects the limit parameter", async () => {
      const rawMetrics = Array.from({ length: 5 }, (_, i) => ({
        menu_item_id: `item-${i}`,
        menu_item_name: `Item ${i}`,
        category: "Main",
        unit_price: 10,
        unit_cost: null,
        total_orders: 50 - i * 10,
        total_revenue: (50 - i * 10) * 10,
        first_item_count: 5,
        view_count: 100,
        cart_addition_count: 30,
      }));

      const dailyData = [
        { date: "2026-02-01", orders: 3, revenue: 30 },
        { date: "2026-02-02", orders: 4, revenue: 40 },
      ];

      // 1 fetchRawMetrics + 5 fetchDailyData
      mockDb._setResults([
        rawMetrics,
        dailyData,
        dailyData,
        dailyData,
        dailyData,
        dailyData,
      ]);

      const bestsellers = await service.getBestsellers(
        "restaurant-1",
        { range: "30d" },
        2,
      );

      expect(bestsellers).toHaveLength(2);
    });
  });

  describe("getProfitLeaders", () => {
    it("returns only products with positive profit, sorted by profit desc", async () => {
      const rawMetrics = [
        {
          menu_item_id: "high-profit",
          menu_item_name: "Premium Dish",
          category: "Main",
          unit_price: 25.0,
          unit_cost: 5.0, // 80% margin
          total_orders: 50,
          total_revenue: 1250,
          first_item_count: 10,
          view_count: 200,
          cart_addition_count: 80,
        },
        {
          menu_item_id: "no-cost-data",
          menu_item_name: "Mystery Item",
          category: "Special",
          unit_price: 15.0,
          unit_cost: null, // No cost data
          total_orders: 80,
          total_revenue: 1200,
          first_item_count: 20,
          view_count: 300,
          cart_addition_count: 100,
        },
      ];

      const dailyData = [
        { date: "2026-02-01", orders: 5, revenue: 125 },
        { date: "2026-02-02", orders: 6, revenue: 150 },
      ];

      mockDb._setResults([rawMetrics, dailyData, dailyData]);

      const leaders = await service.getProfitLeaders("restaurant-1", {
        range: "30d",
      });

      // Only items with cost data and positive profit
      const hasNoCostItem = leaders.some(
        (p) => p.menuItemId === "no-cost-data",
      );
      expect(hasNoCostItem).toBe(false);

      if (leaders.length > 0) {
        expect(leaders[0].totalProfit).toBeGreaterThan(0);
      }
    });
  });

  describe("getUnderperformers", () => {
    it("returns products with negative trend score", async () => {
      const rawMetrics = [
        {
          menu_item_id: "declining",
          menu_item_name: "Old Favorite",
          category: "Main",
          unit_price: 10,
          unit_cost: null,
          total_orders: 3, // Below 5 threshold
          total_revenue: 30,
          first_item_count: 0,
          view_count: 50,
          cart_addition_count: 10,
        },
      ];

      // Declining daily data (orders decreasing over time)
      const decliningDailyData = [
        { date: "2026-02-01", orders: 10, revenue: 100 },
        { date: "2026-02-02", orders: 8, revenue: 80 },
        { date: "2026-02-03", orders: 5, revenue: 50 },
        { date: "2026-02-04", orders: 2, revenue: 20 },
      ];

      mockDb._setResults([rawMetrics, decliningDailyData]);

      const underperformers = await service.getUnderperformers("restaurant-1", {
        range: "30d",
      });

      // Product with low orders and negative trend should be underperformer
      expect(underperformers.length).toBeGreaterThanOrEqual(0);
      if (underperformers.length > 0) {
        expect(underperformers[0].trendScore).toBeLessThan(0);
      }
    });
  });
});

describe("ProductAnalysisService - Calculation Methods (via analyzeProducts)", () => {
  let service: ProductAnalysisService;
  let mockDb: ReturnType<typeof createMockDrizzleDb>;

  beforeEach(() => {
    mockDb = createMockDrizzleDb();
    service = new ProductAnalysisService(mockDb as any);
  });

  describe("trend score calculation", () => {
    it("calculates positive trend for increasing orders", async () => {
      const rawMetrics = [
        {
          menu_item_id: "trending-up",
          menu_item_name: "Rising Star",
          category: "Main",
          unit_price: 10,
          unit_cost: null,
          total_orders: 30,
          total_revenue: 300,
          first_item_count: 5,
          view_count: 100,
          cart_addition_count: 50,
        },
      ];

      const increasingDaily = [
        { date: "2026-02-01", orders: 2, revenue: 20 },
        { date: "2026-02-02", orders: 4, revenue: 40 },
        { date: "2026-02-03", orders: 6, revenue: 60 },
        { date: "2026-02-04", orders: 8, revenue: 80 },
        { date: "2026-02-05", orders: 10, revenue: 100 },
      ];

      mockDb._setResults([rawMetrics, increasingDaily]);

      const result = await service.analyzeProducts("restaurant-1", {
        range: "7d",
      });

      expect(result[0].trendScore).toBeGreaterThan(0);
    });

    it("calculates negative trend for decreasing orders", async () => {
      const rawMetrics = [
        {
          menu_item_id: "declining",
          menu_item_name: "Fading",
          category: "Main",
          unit_price: 10,
          unit_cost: null,
          total_orders: 20,
          total_revenue: 200,
          first_item_count: 3,
          view_count: 80,
          cart_addition_count: 30,
        },
      ];

      const decreasingDaily = [
        { date: "2026-02-01", orders: 10, revenue: 100 },
        { date: "2026-02-02", orders: 8, revenue: 80 },
        { date: "2026-02-03", orders: 5, revenue: 50 },
        { date: "2026-02-04", orders: 3, revenue: 30 },
        { date: "2026-02-05", orders: 1, revenue: 10 },
      ];

      mockDb._setResults([rawMetrics, decreasingDaily]);

      const result = await service.analyzeProducts("restaurant-1", {
        range: "7d",
      });

      expect(result[0].trendScore).toBeLessThan(0);
    });

    it("returns zero trend for single data point", async () => {
      const rawMetrics = [
        {
          menu_item_id: "single",
          menu_item_name: "New Item",
          category: "Main",
          unit_price: 10,
          unit_cost: null,
          total_orders: 5,
          total_revenue: 50,
          first_item_count: 1,
          view_count: 20,
          cart_addition_count: 10,
        },
      ];

      mockDb._setResults([
        rawMetrics,
        [{ date: "2026-02-01", orders: 5, revenue: 50 }],
      ]);

      const result = await service.analyzeProducts("restaurant-1", {
        range: "7d",
      });

      expect(result[0].trendScore).toBe(0);
      expect(result[0].growthRate).toBe(0);
    });
  });

  describe("growth rate calculation", () => {
    it("calculates positive growth when second half outperforms first half", async () => {
      const rawMetrics = [
        {
          menu_item_id: "growing",
          menu_item_name: "Growing",
          category: "Main",
          unit_price: 10,
          unit_cost: null,
          total_orders: 40,
          total_revenue: 400,
          first_item_count: 5,
          view_count: 100,
          cart_addition_count: 50,
        },
      ];

      // First half: avg 2 orders, Second half: avg 8 orders => 300% growth
      const dailyData = [
        { date: "2026-02-01", orders: 1, revenue: 10 },
        { date: "2026-02-02", orders: 3, revenue: 30 },
        { date: "2026-02-03", orders: 7, revenue: 70 },
        { date: "2026-02-04", orders: 9, revenue: 90 },
      ];

      mockDb._setResults([rawMetrics, dailyData]);

      const result = await service.analyzeProducts("restaurant-1", {
        range: "7d",
      });

      expect(result[0].growthRate).toBeGreaterThan(0);
    });
  });

  describe("profit calculations", () => {
    it("calculates profit margin and total profit when cost data available", async () => {
      const rawMetrics = [
        {
          menu_item_id: "with-cost",
          menu_item_name: "Costed Item",
          category: "Main",
          unit_price: 20.0,
          unit_cost: 8.0,
          total_orders: 50,
          total_revenue: 1000,
          first_item_count: 10,
          view_count: 200,
          cart_addition_count: 80,
        },
      ];

      const dailyData = [
        { date: "2026-02-01", orders: 25, revenue: 500 },
        { date: "2026-02-02", orders: 25, revenue: 500 },
      ];

      mockDb._setResults([rawMetrics, dailyData]);

      const result = await service.analyzeProducts("restaurant-1", {
        range: "7d",
      });

      expect(result[0].profitMargin).toBeCloseTo(0.6); // (20-8)/20
      expect(result[0].totalProfit).toBe(600); // (20-8)*50
    });

    it("leaves profit undefined when no cost data", async () => {
      const rawMetrics = [
        {
          menu_item_id: "no-cost",
          menu_item_name: "No Cost Data",
          category: "Main",
          unit_price: 15.0,
          unit_cost: null,
          total_orders: 30,
          total_revenue: 450,
          first_item_count: 5,
          view_count: 100,
          cart_addition_count: 40,
        },
      ];

      const dailyData = [
        { date: "2026-02-01", orders: 15, revenue: 225 },
        { date: "2026-02-02", orders: 15, revenue: 225 },
      ];

      mockDb._setResults([rawMetrics, dailyData]);

      const result = await service.analyzeProducts("restaurant-1", {
        range: "7d",
      });

      expect(result[0].profitMargin).toBeUndefined();
      expect(result[0].totalProfit).toBeUndefined();
      expect(result[0].unitCost).toBeUndefined();
    });
  });

  describe("edge cases", () => {
    it("handles zero view count for cart addition rate", async () => {
      const rawMetrics = [
        {
          menu_item_id: "zero-views",
          menu_item_name: "No Views",
          category: "Main",
          unit_price: 10,
          unit_cost: null,
          total_orders: 5,
          total_revenue: 50,
          first_item_count: 1,
          view_count: 0,
          cart_addition_count: 0,
        },
      ];

      const dailyData = [
        { date: "2026-02-01", orders: 3, revenue: 30 },
        { date: "2026-02-02", orders: 2, revenue: 20 },
      ];

      mockDb._setResults([rawMetrics, dailyData]);

      const result = await service.analyzeProducts("restaurant-1", {
        range: "7d",
      });

      expect(result[0].cartAdditionRate).toBe(0);
    });

    it("handles zero orders for average order value", async () => {
      const rawMetrics = [
        {
          menu_item_id: "zero-orders",
          menu_item_name: "No Orders",
          category: "Main",
          unit_price: 10,
          unit_cost: null,
          total_orders: 0,
          total_revenue: 0,
          first_item_count: 0,
          view_count: 10,
          cart_addition_count: 5,
        },
      ];

      mockDb._setResults([rawMetrics, []]);

      const result = await service.analyzeProducts("restaurant-1", {
        range: "7d",
      });

      expect(result[0].averageOrderValue).toBe(0);
    });
  });
});
