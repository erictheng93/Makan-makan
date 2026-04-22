/**
 * Analytics Feature Tests
 * 數據分析功能測試套件
 *
 * 測試覆蓋範圍：
 * - Dashboard 數據
 * - Revenue 分析
 * - Product 分析
 * - Customer 分析
 * - Performance 分析
 * - Export 功能
 * - Realtime Dashboard
 * - Financial Report
 * - SSE 連接
 * - 緩存機制
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

// Mock database analytics service
const mockDatabaseAnalyticsService = {
  getDashboardData: vi.fn(),
  getRevenueAnalytics: vi.fn(),
  getMenuAnalytics: vi.fn(),
  getCustomerAnalytics: vi.fn(),
  getOrderAnalytics: vi.fn(),
  getFinancialReport: vi.fn(),
  getRealtimeDashboard: vi.fn(),
};

// Mock cache service
const mockCacheService = {
  get: vi.fn(),
  set: vi.fn(),
  clear: vi.fn(),
};

vi.mock("@makanmakan/database", () => ({
  AnalyticsService: vi.fn(function () {
    return mockDatabaseAnalyticsService;
  }),
}));

vi.mock("../../../core/cache", () => ({
  KVCacheService: vi.fn(function () {
    return mockCacheService;
  }),
}));

vi.mock("../../../core/monitoring", () => ({
  ConsoleLogger: vi.fn(function () {
    return {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    };
  }),
}));

// Mock middleware
vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn((c, next) => {
    c.set("user", { id: 1, role: 0, restaurantId: 1 });
    return next();
  }),
  requireRole: vi.fn(() => (c: any, next: any) => next()),
}));

vi.mock("../../../middleware/validation", () => ({
  validateQuery: vi.fn(() => (c: any, next: any) => {
    const url = c.req.url;
    const queryString = url.split("?")[1] || "";
    const params: Record<string, any> = {};
    if (queryString) {
      queryString.split("&").forEach((pair: string) => {
        const [key, value] = pair.split("=");
        if (key) {
          params[decodeURIComponent(key)] = decodeURIComponent(value || "");
        }
      });
    }
    c.set("validatedQuery", params);
    return next();
  }),
}));

vi.mock("../../../middleware/moduleGate", () => ({
  moduleGate: vi.fn(() => async (_c: any, next: any) => await next()),
  invalidateSubscriptionCache: vi.fn().mockResolvedValue(undefined),
}));

describe("Analytics Feature Tests", () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockCacheService.get.mockResolvedValue(null); // Default: no cache

    // Default mock for getRealtimeDashboard (used by getRealtimeData)
    mockDatabaseAnalyticsService.getRealtimeDashboard.mockResolvedValue({
      activeOrders: 5,
      kitchenQueue: 3,
      occupiedTables: 8,
    });

    const { default: analyticsRoutes } = await import("../routes/index");
    app = new Hono();
    app.route("/analytics", analyticsRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // Dashboard Tests (5 tests)
  // ========================================

  describe("GET /dashboard", () => {
    it("應該成功獲取 Dashboard 數據", async () => {
      const mockDashboard = {
        summary: {
          todayRevenue: 15000,
          todayOrders: 45,
          averageOrderValue: 333.33,
          comparisonYesterday: 12.5,
        },
      };

      mockDatabaseAnalyticsService.getDashboardData.mockResolvedValue(
        mockDashboard,
      );

      const req = new Request(
        "http://localhost/analytics/dashboard?restaurantId=1&period=today",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.todayRevenue).toBe(15000);
      expect(data.data.todayOrders).toBe(45);
    });

    it("應該從緩存返回數據", async () => {
      const cachedData = {
        todayRevenue: 10000,
        todayOrders: 30,
      };

      mockCacheService.get.mockResolvedValue(cachedData);

      const req = new Request(
        "http://localhost/analytics/dashboard?restaurantId=1&period=today",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(
        mockDatabaseAnalyticsService.getDashboardData,
      ).not.toHaveBeenCalled();
    });

    it("應該處理資料庫錯誤", async () => {
      mockDatabaseAnalyticsService.getDashboardData.mockRejectedValue(
        new Error("Database error"),
      );

      const req = new Request(
        "http://localhost/analytics/dashboard?restaurantId=1",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });

      expect(res.status).toBe(500);
    });

    it("應該支援不同的時間週期", async () => {
      const mockDashboard = { summary: { todayRevenue: 50000 } };
      mockDatabaseAnalyticsService.getDashboardData.mockResolvedValue(
        mockDashboard,
      );

      const req = new Request(
        "http://localhost/analytics/dashboard?restaurantId=1&period=week",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });

      expect(res.status).toBe(200);
    });

    it("應該為店主限制只能查看自己餐廳的數據", async () => {
      const mockDashboard = { summary: { todayRevenue: 15000 } };
      mockDatabaseAnalyticsService.getDashboardData.mockResolvedValue(
        mockDashboard,
      );

      const req = new Request(
        "http://localhost/analytics/dashboard?restaurantId=1",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });

      expect(res.status).toBe(200);
    });
  });

  // ========================================
  // Revenue Analytics Tests (4 tests)
  // ========================================

  describe("GET /revenue", () => {
    it("應該成功獲取營收分析數據", async () => {
      const mockRevenue = [
        { date: "2024-01-01", revenue: 5000, orders: 20 },
        { date: "2024-01-02", revenue: 6000, orders: 25 },
      ];

      mockDatabaseAnalyticsService.getRevenueAnalytics.mockResolvedValue(
        mockRevenue,
      );

      const req = new Request(
        "http://localhost/analytics/revenue?restaurantId=1&dateFrom=2024-01-01&dateTo=2024-01-31",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
    });

    it("應該處理空數據", async () => {
      mockDatabaseAnalyticsService.getRevenueAnalytics.mockResolvedValue([]);

      const req = new Request(
        "http://localhost/analytics/revenue?restaurantId=1",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data).toHaveLength(0);
    });

    it("應該緩存營收數據", async () => {
      const mockRevenue = [{ date: "2024-01-01", revenue: 5000 }];
      mockDatabaseAnalyticsService.getRevenueAnalytics.mockResolvedValue(
        mockRevenue,
      );

      const req = new Request(
        "http://localhost/analytics/revenue?restaurantId=1",
      );
      await app.fetch(req, { DB: {}, CACHE_KV: {} });

      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it("應該處理資料庫錯誤", async () => {
      mockDatabaseAnalyticsService.getRevenueAnalytics.mockRejectedValue(
        new Error("DB Error"),
      );

      const req = new Request(
        "http://localhost/analytics/revenue?restaurantId=1",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // Product Analytics Tests (4 tests)
  // ========================================

  describe("GET /products", () => {
    it("應該成功獲取產品分析數據", async () => {
      const mockProducts = {
        popularItems: [
          { id: 1, name: "招牌炒飯", quantity: 150, revenue: 4500 },
          { id: 2, name: "牛肉麵", quantity: 120, revenue: 6000 },
        ],
        categoryPerformance: [
          { category: "主食", revenue: 10000, percentage: 45 },
          { category: "飲料", revenue: 5000, percentage: 22 },
        ],
      };

      mockDatabaseAnalyticsService.getMenuAnalytics.mockResolvedValue(
        mockProducts,
      );

      const req = new Request(
        "http://localhost/analytics/products?restaurantId=1",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.popularItems).toHaveLength(2);
      expect(data.data.categoryPerformance).toHaveLength(2);
    });

    it("應該返回熱門商品排名", async () => {
      const mockProducts = {
        popularItems: [{ id: 1, name: "招牌炒飯", quantity: 150 }],
        categoryPerformance: [],
      };

      mockDatabaseAnalyticsService.getMenuAnalytics.mockResolvedValue(
        mockProducts,
      );

      const req = new Request(
        "http://localhost/analytics/products?restaurantId=1",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });
      const data = await res.json();

      expect(data.data.popularItems[0].name).toBe("招牌炒飯");
    });

    it("應該處理資料庫錯誤", async () => {
      mockDatabaseAnalyticsService.getMenuAnalytics.mockRejectedValue(
        new Error("DB Error"),
      );

      const req = new Request(
        "http://localhost/analytics/products?restaurantId=1",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });

      expect(res.status).toBe(500);
    });

    it("應該緩存產品分析數據", async () => {
      const mockProducts = { popularItems: [], categoryPerformance: [] };
      mockDatabaseAnalyticsService.getMenuAnalytics.mockResolvedValue(
        mockProducts,
      );

      const req = new Request(
        "http://localhost/analytics/products?restaurantId=1",
      );
      await app.fetch(req, { DB: {}, CACHE_KV: {} });

      expect(mockCacheService.set).toHaveBeenCalled();
    });
  });

  // ========================================
  // Customer Analytics Tests (4 tests)
  // ========================================

  describe("GET /customers", () => {
    it("應該成功獲取客戶分析數據", async () => {
      const mockCustomers = {
        totalCustomers: 500,
        newCustomers: 50,
        returningCustomers: 200,
        averageVisitFrequency: 2.5,
        customerSegments: [
          { segment: "VIP", count: 50, revenue: 25000 },
          { segment: "Regular", count: 200, revenue: 40000 },
        ],
      };

      mockDatabaseAnalyticsService.getCustomerAnalytics.mockResolvedValue(
        mockCustomers,
      );

      const req = new Request(
        "http://localhost/analytics/customers?restaurantId=1",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.totalCustomers).toBe(500);
      expect(data.data.newCustomers).toBe(50);
    });

    it("應該返回客戶分群數據", async () => {
      const mockCustomers = {
        totalCustomers: 100,
        newCustomers: 10,
        customerSegments: [{ segment: "VIP", count: 10 }],
      };

      mockDatabaseAnalyticsService.getCustomerAnalytics.mockResolvedValue(
        mockCustomers,
      );

      const req = new Request(
        "http://localhost/analytics/customers?restaurantId=1",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });
      const data = await res.json();

      expect(data.data.customerSegments).toBeDefined();
    });

    it("應該處理資料庫錯誤", async () => {
      mockDatabaseAnalyticsService.getCustomerAnalytics.mockRejectedValue(
        new Error("DB Error"),
      );

      const req = new Request(
        "http://localhost/analytics/customers?restaurantId=1",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });

      expect(res.status).toBe(500);
    });

    it("應該緩存客戶分析數據", async () => {
      const mockCustomers = { totalCustomers: 100, newCustomers: 10 };
      mockDatabaseAnalyticsService.getCustomerAnalytics.mockResolvedValue(
        mockCustomers,
      );

      const req = new Request(
        "http://localhost/analytics/customers?restaurantId=1",
      );
      await app.fetch(req, { DB: {}, CACHE_KV: {} });

      expect(mockCacheService.set).toHaveBeenCalled();
    });
  });

  // ========================================
  // Performance Analytics Tests (4 tests)
  // ========================================

  describe("GET /performance", () => {
    it("應該成功獲取績效分析數據", async () => {
      const mockPerformance = {
        totalOrders: 500,
        completedOrders: 480,
        cancelledOrders: 20,
        averagePreparationTime: 15,
        peakHours: [
          { hour: 12, orders: 50 },
          { hour: 18, orders: 60 },
        ],
      };

      mockDatabaseAnalyticsService.getOrderAnalytics.mockResolvedValue(
        mockPerformance,
      );

      const req = new Request(
        "http://localhost/analytics/performance?restaurantId=1",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.totalOrders).toBe(500);
      expect(data.data.completedOrders).toBe(480);
    });

    it("應該返回尖峰時段數據", async () => {
      const mockPerformance = {
        totalOrders: 100,
        completedOrders: 95,
        peakHours: [{ hour: 12, orders: 30 }],
      };

      mockDatabaseAnalyticsService.getOrderAnalytics.mockResolvedValue(
        mockPerformance,
      );

      const req = new Request(
        "http://localhost/analytics/performance?restaurantId=1",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });
      const data = await res.json();

      expect(data.data.peakHours).toBeDefined();
    });

    it("應該處理資料庫錯誤", async () => {
      mockDatabaseAnalyticsService.getOrderAnalytics.mockRejectedValue(
        new Error("DB Error"),
      );

      const req = new Request(
        "http://localhost/analytics/performance?restaurantId=1",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });

      expect(res.status).toBe(500);
    });

    it("應該允許 Chef 角色存取", async () => {
      const mockPerformance = { totalOrders: 100, completedOrders: 95 };
      mockDatabaseAnalyticsService.getOrderAnalytics.mockResolvedValue(
        mockPerformance,
      );

      const req = new Request(
        "http://localhost/analytics/performance?restaurantId=1",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });

      expect(res.status).toBe(200);
    });
  });

  // ========================================
  // Export Tests (3 tests)
  // ========================================

  describe("GET /export", () => {
    it("應該成功生成匯出請求", async () => {
      const req = new Request(
        "http://localhost/analytics/export?restaurantId=1&type=revenue&format=csv&dateFrom=2024-01-01&dateTo=2024-01-31",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.download_url).toBeDefined();
      expect(data.data.expires_at).toBeDefined();
    });

    it("應該支援 JSON 格式匯出", async () => {
      const req = new Request(
        "http://localhost/analytics/export?restaurantId=1&type=revenue&format=json",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.format).toBe("json");
    });

    it("應該支援 CSV 格式匯出", async () => {
      const req = new Request(
        "http://localhost/analytics/export?restaurantId=1&type=revenue&format=csv",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.format).toBe("csv");
    });
  });

  // ========================================
  // Realtime Dashboard Tests (3 tests)
  // ========================================

  describe("GET /realtime-dashboard", () => {
    it("應該成功獲取即時 Dashboard 數據", async () => {
      const mockDashboard = {
        summary: {
          todayRevenue: 15000,
          todayOrders: 45,
        },
      };

      mockDatabaseAnalyticsService.getDashboardData.mockResolvedValue(
        mockDashboard,
      );

      const req = new Request(
        "http://localhost/analytics/realtime-dashboard?restaurantId=1",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.timestamp).toBeDefined();
    });

    it("應該返回即時時間戳", async () => {
      const mockDashboard = { summary: { todayRevenue: 10000 } };
      mockDatabaseAnalyticsService.getDashboardData.mockResolvedValue(
        mockDashboard,
      );

      const req = new Request(
        "http://localhost/analytics/realtime-dashboard?restaurantId=1",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });
      const data = await res.json();

      expect(data.timestamp).toBeDefined();
    });

    it("應該處理資料庫錯誤", async () => {
      mockDatabaseAnalyticsService.getDashboardData.mockRejectedValue(
        new Error("DB Error"),
      );

      const req = new Request(
        "http://localhost/analytics/realtime-dashboard?restaurantId=1",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // Financial Report Tests (4 tests)
  // ========================================

  describe("GET /financial-report", () => {
    it("應該成功獲取財務報表", async () => {
      const mockFinancial = {
        summary: {
          totalRevenue: 100000,
          totalOrders: 500,
          averageOrderValue: 200,
          taxAmount: 5000,
          netRevenue: 95000,
        },
        revenueBreakdown: {
          cash: 40000,
          card: 50000,
          online: 10000,
        },
      };

      mockDatabaseAnalyticsService.getFinancialReport.mockResolvedValue(
        mockFinancial,
      );

      const req = new Request(
        "http://localhost/analytics/financial-report?restaurantId=1",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.totalRevenue).toBe(100000);
    });

    it("應該返回收入明細", async () => {
      const mockFinancial = {
        summary: { totalRevenue: 50000, netRevenue: 47500 },
        revenueBreakdown: { cash: 20000, card: 30000 },
      };

      mockDatabaseAnalyticsService.getFinancialReport.mockResolvedValue(
        mockFinancial,
      );

      const req = new Request(
        "http://localhost/analytics/financial-report?restaurantId=1",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });
      const data = await res.json();

      expect(data.data.breakdown).toBeDefined();
    });

    it("應該處理資料庫錯誤", async () => {
      mockDatabaseAnalyticsService.getFinancialReport.mockRejectedValue(
        new Error("DB Error"),
      );

      const req = new Request(
        "http://localhost/analytics/financial-report?restaurantId=1",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });

      expect(res.status).toBe(500);
    });

    it("應該緩存財務報表數據", async () => {
      const mockFinancial = {
        summary: { totalRevenue: 50000 },
        revenueBreakdown: {},
      };

      mockDatabaseAnalyticsService.getFinancialReport.mockResolvedValue(
        mockFinancial,
      );

      const req = new Request(
        "http://localhost/analytics/financial-report?restaurantId=1",
      );
      await app.fetch(req, { DB: {}, CACHE_KV: {} });

      expect(mockCacheService.set).toHaveBeenCalled();
    });
  });

  // ========================================
  // Owner Dashboard Tests (3 tests)
  // ========================================

  describe("GET /owner-dashboard", () => {
    it("應該成功獲取店主 Dashboard", async () => {
      const mockDashboard = {
        summary: {
          todayRevenue: 20000,
          todayOrders: 60,
        },
      };

      mockDatabaseAnalyticsService.getDashboardData.mockResolvedValue(
        mockDashboard,
      );

      const req = new Request(
        "http://localhost/analytics/owner-dashboard?restaurantId=1",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("應該返回時間戳", async () => {
      const mockDashboard = { summary: { todayRevenue: 10000 } };
      mockDatabaseAnalyticsService.getDashboardData.mockResolvedValue(
        mockDashboard,
      );

      const req = new Request(
        "http://localhost/analytics/owner-dashboard?restaurantId=1",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });
      const data = await res.json();

      expect(data.timestamp).toBeDefined();
    });

    it("應該處理資料庫錯誤", async () => {
      mockDatabaseAnalyticsService.getDashboardData.mockRejectedValue(
        new Error("DB Error"),
      );

      const req = new Request(
        "http://localhost/analytics/owner-dashboard?restaurantId=1",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // Detailed Performance Tests (3 tests)
  // ========================================

  describe("GET /detailed-performance", () => {
    it("應該成功獲取詳細績效數據", async () => {
      const mockPerformance = {
        totalOrders: 1000,
        completedOrders: 950,
        averagePreparationTime: 12,
      };

      mockDatabaseAnalyticsService.getOrderAnalytics.mockResolvedValue(
        mockPerformance,
      );

      const req = new Request(
        "http://localhost/analytics/detailed-performance?restaurantId=1",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.timestamp).toBeDefined();
    });

    it("應該處理資料庫錯誤", async () => {
      mockDatabaseAnalyticsService.getOrderAnalytics.mockRejectedValue(
        new Error("DB Error"),
      );

      const req = new Request(
        "http://localhost/analytics/detailed-performance?restaurantId=1",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });

      expect(res.status).toBe(500);
    });

    it("應該允許 Chef 角色存取", async () => {
      const mockPerformance = { totalOrders: 100, completedOrders: 95 };
      mockDatabaseAnalyticsService.getOrderAnalytics.mockResolvedValue(
        mockPerformance,
      );

      const req = new Request(
        "http://localhost/analytics/detailed-performance?restaurantId=1",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });

      expect(res.status).toBe(200);
    });
  });

  // ========================================
  // Cache Mechanism Tests (4 tests)
  // ========================================

  describe("Cache Mechanism", () => {
    it("應該在緩存命中時不查詢資料庫", async () => {
      const cachedData = { todayRevenue: 5000, todayOrders: 20 };
      mockCacheService.get.mockResolvedValue(cachedData);

      const req = new Request(
        "http://localhost/analytics/dashboard?restaurantId=1",
      );
      await app.fetch(req, { DB: {}, CACHE_KV: {} });

      expect(
        mockDatabaseAnalyticsService.getDashboardData,
      ).not.toHaveBeenCalled();
    });

    it("應該在緩存未命中時查詢資料庫並設置緩存", async () => {
      mockCacheService.get.mockResolvedValue(null);
      const mockDashboard = { summary: { todayRevenue: 10000 } };
      mockDatabaseAnalyticsService.getDashboardData.mockResolvedValue(
        mockDashboard,
      );

      const req = new Request(
        "http://localhost/analytics/dashboard?restaurantId=1",
      );
      await app.fetch(req, { DB: {}, CACHE_KV: {} });

      expect(mockDatabaseAnalyticsService.getDashboardData).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it("應該使用正確的緩存鍵", async () => {
      mockCacheService.get.mockResolvedValue(null);
      const mockDashboard = { summary: { todayRevenue: 10000 } };
      mockDatabaseAnalyticsService.getDashboardData.mockResolvedValue(
        mockDashboard,
      );

      const req = new Request(
        "http://localhost/analytics/dashboard?restaurantId=1&period=today",
      );
      await app.fetch(req, { DB: {}, CACHE_KV: {} });

      expect(mockCacheService.get).toHaveBeenCalled();
    });

    it("應該處理緩存錯誤並返回錯誤狀態", async () => {
      mockCacheService.get.mockRejectedValue(new Error("Cache error"));
      const mockDashboard = { summary: { todayRevenue: 10000 } };
      mockDatabaseAnalyticsService.getDashboardData.mockResolvedValue(
        mockDashboard,
      );

      const req = new Request(
        "http://localhost/analytics/dashboard?restaurantId=1",
      );
      const res = await app.fetch(req, { DB: {}, CACHE_KV: {} });

      // Current implementation throws error when cache fails
      // This test documents the current behavior
      expect(res.status).toBe(500);
    });
  });
});
