/**
 * Realtime Service Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockApiClient } = vi.hoisted(() => ({
  mockApiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("../api", () => ({
  apiClient: mockApiClient,
  unwrapApiData: vi.fn((response: { data: unknown }) => {
    const payload = response.data;
    return typeof payload === "object" && payload !== null && "data" in payload
      ? payload.data
      : payload;
  }),
}));

// We test the class + useRealtime composable + REALTIME_EVENTS constants
// The singleton uses EventSource which is mocked globally in setup.ts

describe("RealtimeService", () => {
  let RealtimeServiceClass: any;
  let REALTIME_EVENTS: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Dynamic import to get fresh module for each test
    vi.resetModules();

    const mod = await import("../realtimeService");
    RealtimeServiceClass = mod.default; // The singleton, but we test its methods
    REALTIME_EVENTS = mod.REALTIME_EVENTS;
  });

  describe("REALTIME_EVENTS", () => {
    it("should have order event constants", () => {
      expect(REALTIME_EVENTS.ORDER_CREATED).toBe("order_created");
      expect(REALTIME_EVENTS.ORDER_UPDATED).toBe("order_updated");
      expect(REALTIME_EVENTS.ORDER_STATUS_CHANGED).toBe("order_status_changed");
    });

    it("should have group order event constants", () => {
      expect(REALTIME_EVENTS.GROUP_ORDER_CREATED).toBe("group_order_created");
      expect(REALTIME_EVENTS.GROUP_MEMBER_JOINED).toBe("group_member_joined");
    });

    it("should have POS event constants", () => {
      expect(REALTIME_EVENTS.POS_TRANSACTION).toBe("pos_transaction");
      expect(REALTIME_EVENTS.CASH_MOVEMENT).toBe("cash_movement");
      expect(REALTIME_EVENTS.SHIFT_STARTED).toBe("shift_started");
      expect(REALTIME_EVENTS.SHIFT_ENDED).toBe("shift_ended");
    });

    it("should have ALL wildcard", () => {
      expect(REALTIME_EVENTS.ALL).toBe("*");
    });
  });

  describe("realtimeService singleton", () => {
    it("should expose subscribe/unsubscribe methods", () => {
      const service = RealtimeServiceClass;
      expect(typeof service.subscribe).toBe("function");
      expect(typeof service.unsubscribe).toBe("function");
    });

    it("should subscribe and return subscription id", () => {
      const service = RealtimeServiceClass;
      const callback = vi.fn();
      const subId = service.subscribe("order_created", callback);

      expect(subId).toEqual(expect.stringContaining("sub_"));
    });

    it("should unsubscribe by id", () => {
      const service = RealtimeServiceClass;
      const callback = vi.fn();
      const subId = service.subscribe("order_created", callback);

      const result = service.unsubscribe(subId);
      expect(result).toBe(true);

      // Unsubscribing again should return false
      const result2 = service.unsubscribe(subId);
      expect(result2).toBe(false);
    });

    it("should return disconnected status initially", () => {
      const service = RealtimeServiceClass;
      const status = service.getConnectionStatus();
      expect(status.value).toBe("disconnected");
    });

    it("should return empty message buffer initially", () => {
      const service = RealtimeServiceClass;
      const buffer = service.getMessageBuffer();
      expect(buffer).toEqual([]);
    });

    it("should return connection stats", () => {
      const service = RealtimeServiceClass;
      const stats = service.getConnectionStats();

      expect(stats).toEqual(
        expect.objectContaining({
          status: expect.any(String),
          totalMessages: expect.any(Number),
          subscriptions: expect.any(Number),
        }),
      );
    });

    it("should disconnect cleanly", () => {
      const service = RealtimeServiceClass;
      service.disconnect();
      expect(service.getConnectionStatus().value).toBe("disconnected");
    });
  });

  describe("ping", () => {
    it("should return true on successful ping", async () => {
      mockApiClient.get.mockResolvedValue({ data: { success: true } });

      const service = RealtimeServiceClass;
      const result = await service.ping();

      expect(result).toBe(true);
      expect(mockApiClient.get).toHaveBeenCalledWith("/sse/ping");
    });

    it("should return false on failed ping", async () => {
      mockApiClient.get.mockRejectedValue(new Error("Network error"));

      const service = RealtimeServiceClass;
      const result = await service.ping();

      expect(result).toBe(false);
    });
  });

  describe("getServerTime", () => {
    it("should parse server timestamp from the shared API client", async () => {
      mockApiClient.get.mockResolvedValue({
        data: { timestamp: "2026-01-01T00:00:00.000Z" },
      });

      const service = RealtimeServiceClass;
      const result = await service.getServerTime();

      expect(mockApiClient.get).toHaveBeenCalledWith("/sse/time");
      expect(result.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    });
  });

  describe("broadcastToGroup", () => {
    it("should POST broadcast event", async () => {
      mockApiClient.post.mockResolvedValue({ data: { success: true } });

      const service = RealtimeServiceClass;
      const event = {
        type: "cart_update",
        data: { item: "pizza" },
      };
      const result = await service.broadcastToGroup("g1", {
        ...event,
      });

      expect(result).toBe(true);
      expect(mockApiClient.post).toHaveBeenCalledWith("/sse/broadcast/group", {
        groupOrderId: "g1",
        event,
      });
    });

    it("should return false on error", async () => {
      mockApiClient.post.mockRejectedValue(new Error("fail"));

      const service = RealtimeServiceClass;
      const result = await service.broadcastToGroup("g1", {
        type: "test",
        data: {},
      });

      expect(result).toBe(false);
    });
  });

  describe("sendGroupNotification", () => {
    it("should POST group notifications through the shared API client", async () => {
      mockApiClient.post.mockResolvedValue({ data: { success: true } });

      const service = RealtimeServiceClass;
      const result = await service.sendGroupNotification("g1", {
        type: "reminder",
        title: "Payment reminder",
        message: "Please complete payment",
        priority: "normal",
      });

      expect(result).toBe(true);
      expect(mockApiClient.post).toHaveBeenCalledWith(
        "/sse/notify/group",
        expect.objectContaining({
          groupOrderId: "g1",
          notification: expect.objectContaining({
            type: "reminder",
            title: "Payment reminder",
            message: "Please complete payment",
            priority: "normal",
            id: expect.any(String),
            timestamp: expect.any(Number),
          }),
        }),
      );
    });
  });

  describe("checkGroupConnectionHealth", () => {
    it("should return health data on success", async () => {
      const healthData = {
        connected: true,
        memberCount: 5,
        activeMembers: 3,
        lastActivity: Date.now(),
      };
      mockApiClient.get.mockResolvedValue({ data: healthData });

      const service = RealtimeServiceClass;
      const result = await service.checkGroupConnectionHealth("g1");

      expect(result).toEqual(healthData);
      expect(mockApiClient.get).toHaveBeenCalledWith("/sse/group/g1/health");
    });

    it("should return defaults on error", async () => {
      mockApiClient.get.mockRejectedValue(new Error("fail"));

      const service = RealtimeServiceClass;
      const result = await service.checkGroupConnectionHealth("g1");

      expect(result.connected).toBe(false);
      expect(result.memberCount).toBe(0);
    });
  });

  describe("syncGroupState", () => {
    it("should GET group state sync with the last sync query", async () => {
      const syncData = {
        groupOrderId: "g1",
        lastSync: 123,
        version: 456,
        state: null,
      };
      mockApiClient.get.mockResolvedValue({ data: syncData });

      const service = RealtimeServiceClass;
      const result = await service.syncGroupState("g1", 123);

      expect(result).toEqual(syncData);
      expect(mockApiClient.get).toHaveBeenCalledWith(
        "/sse/group/g1/sync?lastSync=123",
      );
    });
  });
});
