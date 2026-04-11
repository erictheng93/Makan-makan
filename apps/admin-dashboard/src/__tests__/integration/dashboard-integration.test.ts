/**
 * Dashboard Integration Tests
 * 測試 Dashboard 整合功能
 *
 * Note on Store Testing:
 * Auth store uses readonly() wrappers and computed properties, which cannot be
 * directly modified in tests. We mock the auth store at the module level to
 * provide controllable test values.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia, defineStore } from "pinia";
import { ref, computed, readonly } from "vue";
import type { User, DashboardStats, Order } from "@/types";
import { UserRole } from "@/types";
import {
  userFactory,
  orderFactory,
  resetAllFactories,
} from "@makanmakan/testing-utils";

// Mock API
vi.mock("@/services/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
  },
}));

// Create a testable auth store with mutable state
const createMockAuthStore = () => {
  const factoryUser = userFactory.buildShopOwner(1, {
    overrides: { username: "testuser", email: "test@example.com" },
  });
  return defineStore("auth", () => {
    const user = ref<User | null>({
      id: factoryUser.id!,
      username: factoryUser.username,
      email: factoryUser.email,
      role: UserRole.OWNER,
      restaurantId: factoryUser.restaurantId,
      createdAt: new Date(factoryUser.createdAt).toISOString(),
      updatedAt: new Date(factoryUser.updatedAt).toISOString(),
    });
    const token = ref<string | null>("test-token");
    const isLoading = ref(false);

    const isAuthenticated = computed(() => !!user.value && !!token.value);
    const userRole = computed(() => user.value?.role);
    const restaurantId = computed(() => user.value?.restaurantId);

    const hasPermission = (requiredRole: UserRole | UserRole[]) => {
      if (!user.value) return false;
      const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      return roles.includes(user.value.role);
    };

    const setUser = (newUser: User | null) => {
      user.value = newUser;
    };

    const setRestaurantId = (id: number | undefined) => {
      if (user.value) {
        user.value = { ...user.value, restaurantId: id };
      }
    };

    return {
      user: readonly(user),
      token: readonly(token),
      isLoading: readonly(isLoading),
      isAuthenticated,
      userRole,
      restaurantId,
      hasPermission,
      setUser,
      setRestaurantId,
    };
  });
};

// Mock auth store
vi.mock("@/stores/auth", () => ({
  useAuthStore: () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const mockAuthStore = createMockAuthStore();
    return mockAuthStore();
  },
}));

import { api } from "@/services/api";
import { useDashboardStore } from "@/stores/dashboard";
import { useOrderStore } from "@/stores/order";
import { useNotificationStore } from "@/stores/notification";

describe("Dashboard Integration Tests", () => {
  beforeEach(() => {
    resetAllFactories();
    const pinia = createPinia();
    setActivePinia(pinia);
    vi.clearAllMocks();
  });

  describe("Store Interoperability", () => {
    it("should work with multiple stores together", () => {
      const dashboardStore = useDashboardStore();
      const orderStore = useOrderStore();
      const notificationStore = useNotificationStore();

      expect(dashboardStore).toBeDefined();
      expect(orderStore).toBeDefined();
      expect(notificationStore).toBeDefined();
    });
  });

  describe("Dashboard Data Flow", () => {
    it("should fetch and display dashboard stats", async () => {
      const dashboardStore = useDashboardStore();

      const mockStats: DashboardStats = {
        todayOrders: 45,
        todayRevenue: 12500,
        averageOrderValue: 278,
        completionRate: 92,
        topMenuItems: [],
        revenueChart: [],
        ordersChart: [],
      };

      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: mockStats },
      });

      await dashboardStore.fetchDashboardStats();

      expect(dashboardStore.stats).toEqual(mockStats);
      expect(dashboardStore.todayOrders).toBe(45);
      expect(dashboardStore.todayRevenue).toBe(12500);
    });

    it("should fetch revenue analytics with different periods", async () => {
      const dashboardStore = useDashboardStore();

      const mockData = [
        { label: "Day 1", value: 1000 },
        { label: "Day 2", value: 1500 },
      ];

      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: mockData },
      });

      const dailyData = await dashboardStore.fetchRevenueAnalytics("daily");
      expect(dailyData).toEqual(mockData);

      const weeklyData = await dashboardStore.fetchRevenueAnalytics("weekly");
      expect(weeklyData).toEqual(mockData);
    });
  });

  describe("Order Management Flow", () => {
    /** Build a frontend Order from factory data */
    const buildMockOrder = (overrides: Partial<Order> = {}): Order => {
      const fo = orderFactory.buildPending({
        overrides: {
          id: overrides.id ?? 1,
          orderNumber: "ORD-001",
          tableId: 1,
          totalAmount: 1000,
        },
      });
      return {
        id: fo.id!,
        orderNumber: fo.orderNumber,
        tableId: fo.tableId!,
        tableName: "T1",
        status: "pending",
        totalAmount: fo.totalAmount,
        createdAt: new Date(fo.createdAt).toISOString(),
        updatedAt: new Date(fo.updatedAt).toISOString(),
        items: [],
        ...overrides,
      };
    };

    it("should fetch and update orders", async () => {
      const orderStore = useOrderStore();

      const mockOrders: Order[] = [buildMockOrder()];

      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: mockOrders },
      });

      await orderStore.fetchOrders();

      expect(orderStore.orders).toEqual(mockOrders);
      expect(orderStore.pendingOrdersCount).toBe(1);
    });

    it("should update order status and trigger notification", async () => {
      const orderStore = useOrderStore();
      const notificationStore = useNotificationStore();

      // First fetch orders to populate the store
      const mockOrders: Order[] = [buildMockOrder()];

      vi.mocked(api.get).mockResolvedValue({
        data: { success: true, data: mockOrders },
      });

      await orderStore.fetchOrders();

      // Now update the status
      vi.mocked(api.put).mockResolvedValue({
        data: { success: true },
      });

      await orderStore.updateOrderStatus(1, "confirmed");

      notificationStore.addNotification({
        type: "success",
        title: "Order Updated",
        message: "Order status changed to confirmed",
      });

      expect(orderStore.orders[0].status).toBe("confirmed");
      expect(notificationStore.notifications).toHaveLength(1);
    });
  });

  describe("Notification System", () => {
    it("should show notifications for order events", () => {
      const notificationStore = useNotificationStore();

      notificationStore.addNotification({
        type: "order_ready",
        title: "Order Ready",
        message: "Table 5 order is ready",
        data: {
          orderNumber: "ORD-001",
          tableNumber: 5,
        },
      });

      expect(notificationStore.notifications).toHaveLength(1);
      expect(notificationStore.unreadCount).toBe(1);
      expect(notificationStore.notifications[0].data?.tableNumber).toBe(5);
    });

    it("should manage notification lifecycle", () => {
      const notificationStore = useNotificationStore();

      const id = notificationStore.addNotification({
        type: "info",
        title: "Test",
        message: "Test notification",
        persistent: true,
      });

      expect(notificationStore.notifications).toHaveLength(1);

      notificationStore.markAsRead(id);
      expect(notificationStore.unreadCount).toBe(0);

      notificationStore.removeNotification(id);
      expect(notificationStore.notifications).toHaveLength(0);
    });
  });

  describe("Error Handling Across Stores", () => {
    it("should handle dashboard fetch error gracefully", async () => {
      const dashboardStore = useDashboardStore();

      vi.mocked(api.get).mockRejectedValue(new Error("Network error"));

      await dashboardStore.fetchDashboardStats();

      expect(dashboardStore.error).toBeTruthy();
      expect(dashboardStore.isLoading).toBe(false);
    });

    it("should handle order fetch error gracefully", async () => {
      const orderStore = useOrderStore();

      vi.mocked(api.get).mockRejectedValue(new Error("Network error"));

      await orderStore.fetchOrders();

      expect(orderStore.error).toBeTruthy();
      expect(orderStore.isLoading).toBe(false);
    });
  });

  describe("Complete User Workflows", () => {
    it("should complete dashboard loading workflow", async () => {
      const dashboardStore = useDashboardStore();

      vi.mocked(api.get).mockResolvedValue({
        data: {
          success: true,
          data: {
            todayOrders: 50,
            todayRevenue: 15000,
            averageOrderValue: 300,
            completionRate: 94,
            topMenuItems: [{ name: "Pizza", count: 20, revenue: 4000 }],
            revenueChart: [{ label: "Mon", value: 5000 }],
            ordersChart: [{ label: "Mon", value: 25 }],
          },
        },
      });

      await dashboardStore.fetchDashboardStats();

      expect(dashboardStore.error).toBeNull();
      expect(dashboardStore.stats).toBeDefined();
      expect(dashboardStore.todayOrders).toBe(50);
      expect(dashboardStore.lastUpdated).toBeInstanceOf(Date);
    });

    it("should complete order management workflow", async () => {
      const orderStore = useOrderStore();
      const notificationStore = useNotificationStore();

      // Fetch orders
      const workflowOrder = orderFactory.buildPending({
        overrides: {
          id: 1,
          orderNumber: "ORD-001",
          tableId: 1,
          totalAmount: 1000,
        },
      });
      vi.mocked(api.get).mockResolvedValue({
        data: {
          success: true,
          data: [
            {
              id: workflowOrder.id!,
              orderNumber: workflowOrder.orderNumber,
              tableId: workflowOrder.tableId!,
              tableName: "T1",
              status: "pending",
              totalAmount: workflowOrder.totalAmount,
              createdAt: new Date(workflowOrder.createdAt).toISOString(),
              updatedAt: new Date(workflowOrder.updatedAt).toISOString(),
              items: [],
            },
          ],
        },
      });

      await orderStore.fetchOrders();
      expect(orderStore.pendingOrdersCount).toBe(1);

      // Update status
      vi.mocked(api.put).mockResolvedValue({
        data: { success: true },
      });

      await orderStore.updateOrderStatus(1, "preparing");

      // Add notification
      notificationStore.addNotification({
        type: "success",
        title: "Order Updated",
        message: "Order is now being prepared",
      });

      expect(orderStore.orders[0].status).toBe("preparing");
      expect(orderStore.preparingOrders).toHaveLength(1);
      expect(notificationStore.unreadCount).toBe(1);
    });
  });
});
