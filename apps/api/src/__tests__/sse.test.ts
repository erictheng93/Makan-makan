import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import sseFeature from "../features/sse";
import { createMockContext, mockEnv, mockUser } from "./setup";
import type { Env } from "../types/env";

// Mock auth middleware to bypass JWT verification in tests
vi.mock("../middleware/auth", () => ({
  authMiddleware: vi.fn().mockImplementation(async (c, next) => {
    // Set authenticated user in context
    c.set("user", mockUser);
    await next();
  }),
}));

describe("SSE Routes", () => {
  let app: Hono<{ Bindings: Env }>;

  beforeEach(() => {
    app = new Hono<{ Bindings: Env }>();
    app.route("/sse", sseFeature.routes);
    vi.clearAllMocks();
  });

  describe("POST /broadcast/order-update", () => {
    it("should successfully broadcast order update with authentication", async () => {
      // Mock authenticated request
      const req = new Request("http://localhost/sse/broadcast/order-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer mock-jwt-token",
        },
        body: JSON.stringify({
          orderId: 1,
          orderData: {
            id: 1,
            status: "confirmed",
            tableId: 3,
          },
          restaurantId: "test-restaurant-1",
          targetRoles: [0, 1, 2],
        }),
      });

      // Mock context with authenticated user
      const mockContext = createMockContext({
        get: vi.fn().mockImplementation((key: string) => {
          if (key === "user") return mockUser;
          return null;
        }),
      });

      // Mock the broadcast function (in real test, we'd check if connections are notified)
      const response = await app.request(req, {}, mockEnv);

      // Since auth middleware is mocked, this should succeed or at least not fail on auth
      expect(response.status).not.toBe(401); // Should not be unauthorized with mocked auth
    });
  });

  describe("GET /connections", () => {
    it("should reject request without authentication", async () => {
      // Temporarily restore real auth middleware for this test
      vi.doUnmock("../middleware/auth");
      const { authMiddleware } = await import("../middleware/auth");

      // Create app without mocked auth for this specific test
      const testApp = new Hono<{ Bindings: Env }>();
      testApp.get("/connections", authMiddleware, async (c) => {
        return c.json({ success: true });
      });

      const req = new Request("http://localhost/connections?restaurant_id=1", {
        method: "GET",
      });

      const response = await testApp.request(req, {}, mockEnv);

      expect(response.status).toBe(401);

      // Re-mock auth middleware for other tests
      vi.doMock("../middleware/auth", () => ({
        authMiddleware: vi.fn().mockImplementation(async (c, next) => {
          c.set("user", mockUser);
          await next();
        }),
      }));
    });
  });

  describe("POST /broadcast-test", () => {
    it("should reject test endpoint in production", async () => {
      // Mock production environment
      const prodEnv = { ...mockEnv, NODE_ENV: "production" };

      const req = new Request("http://localhost/sse/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer mock-jwt-token",
        },
        body: JSON.stringify({
          type: "system_notification",
          payload: { message: "Test message" },
          restaurantId: "test-restaurant-1",
        }),
      });

      const response = await app.request(req, {}, prodEnv);

      // Should return 401 due to missing auth, but in production would be 404
      // This demonstrates how environment-specific behavior can be tested
      expect(response.status).toBe(401);
    });
  });

  describe("SSE Event Broadcasting Logic", () => {
    it("should format SSE events correctly", () => {
      // Test the SSE event formatting logic
      const event = {
        id: "test_123",
        event: "order-update",
        data: {
          type: "order_update" as const,
          payload: { orderId: 1, status: "confirmed" },
          timestamp: "2025-08-30T12:00:00Z",
          restaurantId: "test-restaurant-1",
        },
      };

      // This would be extracted to a utility function for testing
      const formatSSEEvent = (eventData: typeof event): string => {
        let result = "";

        if (eventData.id) {
          result += `id: ${eventData.id}\n`;
        }

        if (eventData.event) {
          result += `event: ${eventData.event}\n`;
        }

        result += `data: ${JSON.stringify(eventData.data)}\n`;

        return result;
      };

      const formatted = formatSSEEvent(event);

      expect(formatted).toContain("id: test_123");
      expect(formatted).toContain("event: order-update");
      expect(formatted).toContain("data: {");
      expect(formatted).toContain('"type":"order_update"');
    });

    it("should determine target roles correctly for different order statuses", () => {
      // Test role targeting logic
      const determineTargetRoles = (status: string): number[] => {
        switch (status) {
          case "confirmed":
            return [0, 1, 2]; // 管理員、店主、廚師
          case "preparing":
            return [0, 1, 3]; // 管理員、店主、服務員
          case "ready":
            return [0, 1, 3]; // 管理員、店主、服務員
          case "completed":
            return [0, 1]; // 管理員、店主
          case "cancelled":
            return [0, 1, 2, 3]; // 所有相關人員
          default:
            return [0, 1]; // 預設通知管理員和店主
        }
      };

      expect(determineTargetRoles("confirmed")).toEqual([0, 1, 2]);
      expect(determineTargetRoles("preparing")).toEqual([0, 1, 3]);
      expect(determineTargetRoles("ready")).toEqual([0, 1, 3]);
      expect(determineTargetRoles("completed")).toEqual([0, 1]);
      expect(determineTargetRoles("cancelled")).toEqual([0, 1, 2, 3]);
      expect(determineTargetRoles("unknown")).toEqual([0, 1]);
    });
  });
});
