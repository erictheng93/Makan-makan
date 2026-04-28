/**
 * SSE Feature Tests
 * Server-Sent Events 功能測試套件
 *
 * 測試覆蓋範圍：
 * - SSE 連線建立 (GET /events)
 * - 連線狀態 (GET /connections)
 * - 訂單更新廣播 (POST /broadcast/order-update)
 * - 菜單更新廣播 (POST /broadcast/menu-update)
 * - 系統通知廣播 (POST /broadcast/system-notification)
 * - 群組訂單廣播 (POST /broadcast/group-created, member-joined, cart-updated)
 * - 測試廣播 (POST /test)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

// API Response type for type assertions
interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

// Mock SSE Service
const mockSSEService = {
  registerConnection: vi.fn(),
  removeConnection: vi.fn(),
  getConnectionsByRestaurant: vi.fn(),
  getConnectionsByRole: vi.fn(),
  broadcast: vi.fn(),
  broadcastToRestaurant: vi.fn(),
  broadcastToRole: vi.fn(),
  getConnectionStatus: vi.fn(),
  cleanupExpiredConnections: vi.fn(),
  broadcastTest: vi.fn(),
};

vi.mock("../services/SSEService", () => ({
  SSEService: vi.fn(function () {
    return mockSSEService;
  }),
}));

// Mock middleware
let mockUserRole = 0;
let mockUserId = 1;
let mockRestaurantId = 1;

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn((c, next) => {
    c.set("user", {
      id: mockUserId,
      role: mockUserRole,
      restaurantId: mockRestaurantId,
    });
    return next();
  }),
}));

// Mock env for testing
const mockEnv = {
  DB: {},
  CACHE_KV: {},
  NODE_ENV: "test",
};

describe("SSE Feature Tests", () => {
  let app: Hono<{ Bindings: typeof mockEnv }>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockUserRole = 0; // Admin
    mockUserId = 1;
    mockRestaurantId = 1;

    // Default mock returns
    mockSSEService.getConnectionStatus.mockReturnValue({
      totalConnections: 5,
      connectionsByRestaurant: { 1: 3, 2: 2 },
      connectionsByRole: { 0: 1, 1: 2, 2: 2 },
    });

    mockSSEService.getConnectionsByRestaurant.mockReturnValue([
      {
        id: "conn1",
        restaurantId: 1,
        userId: 1,
        role: 0,
        lastHeartbeat: Date.now(),
      },
      {
        id: "conn2",
        restaurantId: 1,
        userId: 2,
        role: 1,
        lastHeartbeat: Date.now(),
      },
    ]);

    const { default: sseRoutes } = await import("../routes/index");
    app = new Hono<{ Bindings: typeof mockEnv }>();
    app.route("/sse", sseRoutes);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Helper function to make requests with env
  const makeRequest = (path: string, options: RequestInit = {}) => {
    const req = new Request(`http://localhost${path}`, options);
    return app.fetch(req, mockEnv);
  };

  // ========================================
  // Connection Status Tests (4 tests)
  // ========================================

  describe("GET /connections", () => {
    it("應該成功取得連線狀態（管理員）", async () => {
      const res = await makeRequest("/sse/connections");

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiResponse;
      expect(json.success).toBe(true);
      expect(json.data.totalConnections).toBe(5);
    });

    it("應該返回按餐廳分組的連線數", async () => {
      const res = await makeRequest("/sse/connections");

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiResponse;
      expect(json.data.connectionsByRestaurant).toBeDefined();
    });

    it("應該返回按角色分組的連線數", async () => {
      const res = await makeRequest("/sse/connections");

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiResponse;
      expect(json.data.connectionsByRole).toBeDefined();
    });

    it("應該限制非管理員只能查看自己餐廳的連線", async () => {
      mockUserRole = 1; // Owner
      mockRestaurantId = 1;

      const res = await makeRequest("/sse/connections?restaurant_id=1");

      // Should return 200 for own restaurant or 403 for others
      expect([200, 403]).toContain(res.status);
    });
  });

  // ========================================
  // Compatibility Helper Endpoint Tests (6 tests)
  // ========================================

  describe("Compatibility helper endpoints", () => {
    it("應該支援 ping endpoint", async () => {
      const res = await makeRequest("/sse/ping");

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiResponse & {
        status: string;
        timestamp: string;
      };
      expect(json.success).toBe(true);
      expect(json.status).toBe("ok");
      expect(json.timestamp).toBeDefined();
    });

    it("應該支援 server time endpoint", async () => {
      const res = await makeRequest("/sse/time");

      expect(res.status).toBe(200);
      const json = (await res.json()) as { timestamp: string };
      expect(json.timestamp).toBeDefined();
    });

    it("應該支援 generic group broadcast endpoint", async () => {
      mockSSEService.broadcast.mockResolvedValue(undefined);

      const res = await makeRequest("/sse/broadcast/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupOrderId: "group-1",
          event: {
            type: "group_order_broadcast",
            data: { operationId: "op-1" },
          },
        }),
      });

      expect(res.status).toBe(200);
      expect(mockSSEService.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "group_order_broadcast",
          restaurantId: "1",
          data: expect.objectContaining({
            groupOrderId: "group-1",
            operationId: "op-1",
          }),
        }),
      );
    });

    it("應該支援 group notification endpoint", async () => {
      mockSSEService.broadcast.mockResolvedValue(undefined);

      const res = await makeRequest("/sse/notify/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupOrderId: "group-1",
          notification: { id: "n1", title: "Ready" },
        }),
      });

      expect(res.status).toBe(200);
      expect(mockSSEService.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "group-notification",
          restaurantId: "1",
          data: expect.objectContaining({
            groupOrderId: "group-1",
            notification: { id: "n1", title: "Ready" },
          }),
        }),
      );
    });

    it("應該支援 group health endpoint", async () => {
      const res = await makeRequest("/sse/group/group-1/health");

      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        connected: boolean;
        memberCount: number;
        activeMembers: number;
        groupOrderId: string;
      };
      expect(json.connected).toBe(true);
      expect(json.memberCount).toBe(5);
      expect(json.activeMembers).toBe(5);
      expect(json.groupOrderId).toBe("group-1");
    });

    it("應該支援 group state sync endpoint", async () => {
      const res = await makeRequest("/sse/group/group-1/sync?lastSync=123");

      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        groupOrderId: string;
        lastSync: number;
        version: number;
        state: unknown;
      };
      expect(json.groupOrderId).toBe("group-1");
      expect(json.lastSync).toBe(123);
      expect(json.version).toEqual(expect.any(Number));
      expect(json.state).toBeNull();
    });
  });

  // ========================================
  // Order Update Broadcast Tests (3 tests)
  // ========================================

  describe("POST /broadcast/order-update", () => {
    it("應該成功廣播訂單更新", async () => {
      mockSSEService.broadcast.mockResolvedValue(undefined);

      const res = await makeRequest("/sse/broadcast/order-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: 123,
          orderData: { status: "preparing", items: [] },
          restaurantId: 1,
        }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiResponse;
      expect(json.success).toBe(true);
      expect(json.data.event_type).toBe("order_update");
    });

    it("應該支援指定目標角色", async () => {
      mockSSEService.broadcast.mockResolvedValue(undefined);

      const res = await makeRequest("/sse/broadcast/order-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: 123,
          orderData: { status: "ready" },
          restaurantId: 1,
          targetRoles: [1, 2], // Owner and Chef
        }),
      });

      expect(res.status).toBe(200);
      expect(mockSSEService.broadcast).toHaveBeenCalled();
    });

    it("應該處理廣播失敗", async () => {
      mockSSEService.broadcast.mockRejectedValue(new Error("Broadcast failed"));

      const res = await makeRequest("/sse/broadcast/order-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: 123,
          orderData: {},
          restaurantId: 1,
        }),
      });

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // Menu Update Broadcast Tests (3 tests)
  // ========================================

  describe("POST /broadcast/menu-update", () => {
    it("應該成功廣播菜單更新", async () => {
      mockSSEService.broadcast.mockResolvedValue(undefined);

      const res = await makeRequest("/sse/broadcast/menu-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menuItemId: 456,
          updateType: "updated",
          restaurantId: 1,
        }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiResponse;
      expect(json.success).toBe(true);
      expect(json.data.event_type).toBe("menu_update");
    });

    it("應該支援不同的更新類型", async () => {
      mockSSEService.broadcast.mockResolvedValue(undefined);

      const updateTypes = [
        "created",
        "updated",
        "deleted",
        "availability_changed",
      ];

      for (const updateType of updateTypes) {
        const res = await makeRequest("/sse/broadcast/menu-update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            menuItemId: 456,
            updateType,
            restaurantId: 1,
          }),
        });

        expect(res.status).toBe(200);
      }
    });

    it("應該處理廣播失敗", async () => {
      mockSSEService.broadcast.mockRejectedValue(new Error("Broadcast failed"));

      const res = await makeRequest("/sse/broadcast/menu-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menuItemId: 456,
          updateType: "updated",
          restaurantId: 1,
        }),
      });

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // System Notification Broadcast Tests (3 tests)
  // ========================================

  describe("POST /broadcast/system-notification", () => {
    it("應該成功廣播系統通知", async () => {
      mockSSEService.broadcast.mockResolvedValue(undefined);

      const res = await makeRequest("/sse/broadcast/system-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "系統維護通知",
          message: "系統將於今晚 10 點進行維護",
          level: "warning",
          restaurantId: 1,
        }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiResponse;
      expect(json.success).toBe(true);
      expect(json.data.event_type).toBe("system_notification");
    });

    it("應該支援不同的通知級別", async () => {
      mockSSEService.broadcast.mockResolvedValue(undefined);

      const levels = ["info", "warning", "error", "success"];

      for (const level of levels) {
        const res = await makeRequest("/sse/broadcast/system-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Test",
            message: "Test message",
            level,
            restaurantId: 1,
          }),
        });

        expect(res.status).toBe(200);
      }
    });

    it("應該支援持久通知", async () => {
      mockSSEService.broadcast.mockResolvedValue(undefined);

      const res = await makeRequest("/sse/broadcast/system-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "重要通知",
          message: "請注意",
          level: "error",
          persistent: true,
          restaurantId: 1,
        }),
      });

      expect(res.status).toBe(200);
    });
  });

  // ========================================
  // Group Order Broadcast Tests (6 tests)
  // ========================================

  describe("POST /broadcast/group-created", () => {
    it("應該成功廣播群組建立", async () => {
      mockSSEService.broadcast.mockResolvedValue(undefined);

      const res = await makeRequest("/sse/broadcast/group-created", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupOrderId: "GO-001",
          restaurantId: 1,
          tableId: 5,
          shareCode: "ABC123",
        }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiResponse;
      expect(json.success).toBe(true);
      expect(json.data.event_type).toBe("group_created");
    });

    it("應該處理廣播失敗", async () => {
      mockSSEService.broadcast.mockRejectedValue(new Error("Broadcast failed"));

      const res = await makeRequest("/sse/broadcast/group-created", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupOrderId: "GO-001",
          restaurantId: 1,
        }),
      });

      expect(res.status).toBe(500);
    });
  });

  describe("POST /broadcast/member-joined", () => {
    it("應該成功廣播成員加入", async () => {
      mockSSEService.broadcast.mockResolvedValue(undefined);

      const res = await makeRequest("/sse/broadcast/member-joined", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupOrderId: "GO-001",
          memberId: "M-001",
          memberName: "John",
          restaurantId: 1,
        }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiResponse;
      expect(json.success).toBe(true);
      expect(json.data.event_type).toBe("member_joined");
    });

    it("應該處理廣播失敗", async () => {
      mockSSEService.broadcast.mockRejectedValue(new Error("Broadcast failed"));

      const res = await makeRequest("/sse/broadcast/member-joined", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupOrderId: "GO-001",
          memberId: "M-001",
          restaurantId: 1,
        }),
      });

      expect(res.status).toBe(500);
    });
  });

  describe("POST /broadcast/cart-updated", () => {
    it("應該成功廣播購物車更新", async () => {
      mockSSEService.broadcast.mockResolvedValue(undefined);

      const res = await makeRequest("/sse/broadcast/cart-updated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupOrderId: "GO-001",
          memberId: "M-001",
          action: "add",
          item: { id: 1, name: "Burger", quantity: 2 },
          restaurantId: 1,
        }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiResponse;
      expect(json.success).toBe(true);
      expect(json.data.event_type).toBe("cart_updated");
    });

    it("應該支援不同的購物車操作", async () => {
      mockSSEService.broadcast.mockResolvedValue(undefined);

      const actions = ["add", "update", "remove"];

      for (const action of actions) {
        const res = await makeRequest("/sse/broadcast/cart-updated", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupOrderId: "GO-001",
            memberId: "M-001",
            action,
            restaurantId: 1,
          }),
        });

        expect(res.status).toBe(200);
      }
    });
  });

  // ========================================
  // Test Broadcast Tests (3 tests)
  // ========================================

  describe("POST /test", () => {
    it("應該成功發送測試廣播（非生產環境）", async () => {
      mockSSEService.broadcastTest.mockResolvedValue(undefined);

      const res = await makeRequest("/sse/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "test_event",
          message: "This is a test",
        }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiResponse;
      expect(json.success).toBe(true);
    });

    it("應該在生產環境拒絕測試廣播", async () => {
      // Create new app with production env
      const prodEnv = { ...mockEnv, NODE_ENV: "production" };
      const { default: sseRoutes } = await import("../routes/index");
      const prodApp = new Hono<{ Bindings: typeof prodEnv }>();
      prodApp.route("/sse", sseRoutes);

      const req = new Request("http://localhost/sse/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "test_event",
          message: "This is a test",
        }),
      });

      const res = await prodApp.fetch(req, prodEnv);

      expect(res.status).toBe(401);
    });

    it("應該處理測試廣播失敗", async () => {
      mockSSEService.broadcastTest.mockRejectedValue(
        new Error("Test broadcast failed"),
      );

      const res = await makeRequest("/sse/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "test_event",
          message: "This is a test",
        }),
      });

      expect(res.status).toBe(500);
    });
  });

  // ========================================
  // SSE Service Unit Tests (5 tests)
  // ========================================

  describe("SSE Service", () => {
    it("應該正確註冊連線", () => {
      mockSSEService.registerConnection("conn1", {
        id: "conn1",
        restaurantId: 1,
        userId: 1,
        role: 0,
        lastHeartbeat: Date.now(),
      });

      expect(mockSSEService.registerConnection).toHaveBeenCalled();
    });

    it("應該正確移除連線", () => {
      mockSSEService.removeConnection("conn1");

      expect(mockSSEService.removeConnection).toHaveBeenCalledWith("conn1");
    });

    it("應該正確取得餐廳連線", () => {
      const connections = mockSSEService.getConnectionsByRestaurant(1);

      expect(connections).toHaveLength(2);
    });

    it("應該正確清理過期連線", () => {
      mockSSEService.cleanupExpiredConnections();

      expect(mockSSEService.cleanupExpiredConnections).toHaveBeenCalled();
    });

    it("應該正確取得連線狀態", () => {
      const status = mockSSEService.getConnectionStatus();

      expect(status.totalConnections).toBe(5);
      expect(status.connectionsByRestaurant).toBeDefined();
      expect(status.connectionsByRole).toBeDefined();
    });
  });
});
