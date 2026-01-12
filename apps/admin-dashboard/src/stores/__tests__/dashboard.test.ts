/**
 * Dashboard Store Tests
 * 測試 Dashboard store 的狀態管理和數據獲取
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useDashboardStore } from "../dashboard";
import { useAuthStore } from "../auth";
import type { DashboardStats } from "@/types";

// Mock API
vi.mock("@/services/api", () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from "@/services/api";

const mockDashboardStats: DashboardStats = {
  todayOrders: 45,
  todayRevenue: 12500,
  averageOrderValue: 278,
  completionRate: 92,
  topMenuItems: [
    { name: "宮保雞丁", count: 15, revenue: 3000 },
    { name: "麻婆豆腐", count: 12, revenue: 2400 },
  ],
  revenueChart: [
    { label: "週一", value: 8000 },
    { label: "週二", value: 9500 },
  ],
  ordersChart: [
    { label: "週一", value: 32 },
    { label: "週二", value: 38 },
  ],
};

// Helper: 設置 authStore 的 restaurantId (因為是 computed 屬性)
function setAuthRestaurantId(
  authStore: ReturnType<typeof useAuthStore>,
  id: number | null,
) {
  Object.defineProperty(authStore, "restaurantId", {
    value: id,
    writable: true,
    configurable: true,
  });
}

// Helper: 設置 store 的只讀狀態
function setStoreState<T>(store: any, key: string, value: T) {
  Object.defineProperty(store, key, {
    value,
    writable: true,
    configurable: true,
  });
}

describe("Dashboard Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  describe("Initial State", () => {
    it("should have null stats initially", () => {
      const store = useDashboardStore();

      expect(store.stats).toBeNull();
    });

    it("should not be loading initially", () => {
      const store = useDashboardStore();

      expect(store.isLoading).toBe(false);
    });

    it("should have no error initially", () => {
      const store = useDashboardStore();

      expect(store.error).toBeNull();
    });

    it("should have no last updated time initially", () => {
      const store = useDashboardStore();

      expect(store.lastUpdated).toBeNull();
    });
  });

  describe("Computed Properties", () => {
    it("should return 0 for todayOrders when stats is null", () => {
      const store = useDashboardStore();

      expect(store.todayOrders).toBe(0);
    });

    it("should return todayOrders from stats", async () => {
      const store = useDashboardStore();
      const authStore = useAuthStore();
      setAuthRestaurantId(authStore, 1);

      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: mockDashboardStats },
      });
      await store.fetchDashboardStats();

      expect(store.todayOrders).toBe(45);
    });

    it("should return 0 for todayRevenue when stats is null", () => {
      const store = useDashboardStore();

      expect(store.todayRevenue).toBe(0);
    });

    it("should return todayRevenue from stats", async () => {
      const store = useDashboardStore();
      const authStore = useAuthStore();
      setAuthRestaurantId(authStore, 1);

      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: mockDashboardStats },
      });
      await store.fetchDashboardStats();

      expect(store.todayRevenue).toBe(12500);
    });

    it("should return averageOrderValue from stats", async () => {
      const store = useDashboardStore();
      const authStore = useAuthStore();
      setAuthRestaurantId(authStore, 1);

      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: mockDashboardStats },
      });
      await store.fetchDashboardStats();

      expect(store.averageOrderValue).toBe(278);
    });

    it("should return completionRate from stats", async () => {
      const store = useDashboardStore();
      const authStore = useAuthStore();
      setAuthRestaurantId(authStore, 1);

      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: mockDashboardStats },
      });
      await store.fetchDashboardStats();

      expect(store.completionRate).toBe(92);
    });

    it("should return topMenuItems from stats", async () => {
      const store = useDashboardStore();
      const authStore = useAuthStore();
      setAuthRestaurantId(authStore, 1);

      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: mockDashboardStats },
      });
      await store.fetchDashboardStats();

      expect(store.topMenuItems).toHaveLength(2);
      expect(store.topMenuItems[0].name).toBe("宮保雞丁");
    });

    it("should return empty arrays when stats is null", () => {
      const store = useDashboardStore();

      expect(store.topMenuItems).toEqual([]);
      expect(store.revenueChart).toEqual([]);
      expect(store.ordersChart).toEqual([]);
    });
  });

  describe("fetchDashboardStats", () => {
    it("should fetch dashboard stats successfully", async () => {
      const store = useDashboardStore();
      const authStore = useAuthStore();
      setAuthRestaurantId(authStore, 1);

      vi.mocked(api.get).mockResolvedValue({
        data: {
          success: true,
          data: mockDashboardStats,
        },
      });

      await store.fetchDashboardStats();

      expect(store.stats).toEqual(mockDashboardStats);
      expect(store.lastUpdated).toBeInstanceOf(Date);
      expect(store.error).toBeNull();
    });

    it("should set loading state during fetch", async () => {
      const store = useDashboardStore();
      const authStore = useAuthStore();
      setAuthRestaurantId(authStore, 1);

      vi.mocked(api.get).mockImplementation(() => {
        expect(store.isLoading).toBe(true);
        return Promise.resolve({
          data: { success: true, data: mockDashboardStats },
        });
      });

      await store.fetchDashboardStats();

      expect(store.isLoading).toBe(false);
    });

    it("should handle error when restaurant ID is missing", async () => {
      const store = useDashboardStore();
      const authStore = useAuthStore();
      setAuthRestaurantId(authStore, null);

      await store.fetchDashboardStats();

      expect(store.error).toBe("餐廳 ID 不存在");
    });

    it("should handle API error response", async () => {
      const store = useDashboardStore();
      const authStore = useAuthStore();
      setAuthRestaurantId(authStore, 1);

      vi.mocked(api.get).mockResolvedValue({
        data: {
          success: false,
          error: { message: "API Error" },
        },
      });

      await store.fetchDashboardStats();

      expect(store.error).toBe("API Error");
      expect(store.stats).toBeNull();
    });

    it("should handle network error", async () => {
      const store = useDashboardStore();
      const authStore = useAuthStore();
      setAuthRestaurantId(authStore, 1);

      vi.mocked(api.get).mockRejectedValue(new Error("Network Error"));

      await store.fetchDashboardStats();

      expect(store.error).toBeTruthy();
      expect(store.isLoading).toBe(false);
    });

    it("should include date range in request params", async () => {
      const store = useDashboardStore();
      const authStore = useAuthStore();
      setAuthRestaurantId(authStore, 1);

      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: mockDashboardStats },
      });

      await store.fetchDashboardStats({
        from: "2025-11-01",
        to: "2025-11-15",
      });

      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining("from=2025-11-01"),
      );
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining("to=2025-11-15"),
      );
    });
  });

  describe("fetchRevenueAnalytics", () => {
    it("should fetch revenue analytics successfully", async () => {
      const store = useDashboardStore();
      const authStore = useAuthStore();
      setAuthRestaurantId(authStore, 1);

      const mockData = [
        { label: "Day 1", value: 1000 },
        { label: "Day 2", value: 1500 },
      ];

      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: mockData },
      });

      const result = await store.fetchRevenueAnalytics("daily");

      expect(result).toEqual(mockData);
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining("period=daily"),
      );
    });

    it("should return empty array when restaurant ID is missing", async () => {
      const store = useDashboardStore();
      const authStore = useAuthStore();
      setAuthRestaurantId(authStore, null);

      const result = await store.fetchRevenueAnalytics("weekly");

      expect(result).toEqual([]);
    });

    it("should return empty array on error", async () => {
      const store = useDashboardStore();
      const authStore = useAuthStore();
      setAuthRestaurantId(authStore, 1);

      vi.mocked(api.get).mockRejectedValue(new Error("Error"));

      const result = await store.fetchRevenueAnalytics("monthly");

      expect(result).toEqual([]);
    });

    it("should handle different time periods", async () => {
      const store = useDashboardStore();
      const authStore = useAuthStore();
      setAuthRestaurantId(authStore, 1);

      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: [] },
      });

      await store.fetchRevenueAnalytics("daily");
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining("period=daily"),
      );

      await store.fetchRevenueAnalytics("weekly");
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining("period=weekly"),
      );

      await store.fetchRevenueAnalytics("monthly");
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining("period=monthly"),
      );
    });
  });

  describe("fetchOrderAnalytics", () => {
    it("should fetch order analytics successfully", async () => {
      const store = useDashboardStore();
      const authStore = useAuthStore();
      setAuthRestaurantId(authStore, 1);

      const mockData = [
        { label: "Day 1", value: 30 },
        { label: "Day 2", value: 45 },
      ];

      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: mockData },
      });

      const result = await store.fetchOrderAnalytics("daily");

      expect(result).toEqual(mockData);
    });

    it("should return empty array when restaurant ID is missing", async () => {
      const store = useDashboardStore();
      const authStore = useAuthStore();
      setAuthRestaurantId(authStore, null);

      const result = await store.fetchOrderAnalytics("daily");

      expect(result).toEqual([]);
    });

    it("should return empty array on error", async () => {
      const store = useDashboardStore();
      const authStore = useAuthStore();
      setAuthRestaurantId(authStore, 1);

      vi.mocked(api.get).mockRejectedValue(new Error("Error"));

      const result = await store.fetchOrderAnalytics("weekly");

      expect(result).toEqual([]);
    });
  });

  describe("Error Handling", () => {
    it("should clear previous error on new fetch", async () => {
      const store = useDashboardStore();
      const authStore = useAuthStore();
      setAuthRestaurantId(authStore, 1);

      // First fetch with error
      vi.mocked(api.get).mockRejectedValue(new Error("Error"));
      await store.fetchDashboardStats();
      expect(store.error).toBeTruthy();

      // Second fetch successful
      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: mockDashboardStats },
      });
      await store.fetchDashboardStats();

      expect(store.error).toBeNull();
    });

    it("should handle error with response data", async () => {
      const store = useDashboardStore();
      const authStore = useAuthStore();
      setAuthRestaurantId(authStore, 1);

      vi.mocked(api.get).mockRejectedValue({
        response: {
          data: {
            error: { message: "Detailed error message" },
          },
        },
      });

      await store.fetchDashboardStats();

      expect(store.error).toBe("Detailed error message");
    });
  });

  describe("Edge Cases", () => {
    it("should handle partial stats data", async () => {
      const store = useDashboardStore();
      const authStore = useAuthStore();
      setAuthRestaurantId(authStore, 1);

      const partialStats = {
        todayOrders: 10,
        todayRevenue: 5000,
        // Missing other fields
      };

      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: partialStats },
      });

      await store.fetchDashboardStats();

      expect(store.todayOrders).toBe(10);
      expect(store.todayRevenue).toBe(5000);
      expect(store.averageOrderValue).toBe(0);
    });

    it("should handle zero values correctly", async () => {
      const store = useDashboardStore();
      const authStore = useAuthStore();
      setAuthRestaurantId(authStore, 1);

      const zeroStats = {
        ...mockDashboardStats,
        todayOrders: 0,
        todayRevenue: 0,
      };

      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: zeroStats },
      });

      await store.fetchDashboardStats();

      expect(store.todayOrders).toBe(0);
      expect(store.todayRevenue).toBe(0);
    });

    it("should handle concurrent fetch requests", async () => {
      const store = useDashboardStore();
      const authStore = useAuthStore();
      setAuthRestaurantId(authStore, 1);

      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: mockDashboardStats },
      });

      const promise1 = store.fetchDashboardStats();
      const promise2 = store.fetchDashboardStats();

      await Promise.all([promise1, promise2]);

      expect(store.stats).toEqual(mockDashboardStats);
    });
  });
});
