/**
 * useRealtimeOrders Composable Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const mockSubscribe = vi.hoisted(() => vi.fn(() => "sub_123"));
const mockUnsubscribe = vi.hoisted(() => vi.fn());
const mockConnect = vi.hoisted(() => vi.fn());
const mockConnectionStatus = vi.hoisted(() => ({ value: "disconnected" }));

vi.mock("@/services/realtimeService", () => ({
  useRealtime: () => ({
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
    connect: mockConnect,
    connectionStatus: mockConnectionStatus,
  }),
  REALTIME_EVENTS: {
    ORDER_CREATED: "order_created",
    ORDER_UPDATED: "order_updated",
    ORDER_STATUS_CHANGED: "order_status_changed",
    GROUP_ORDER_CREATED: "group_order_created",
    GROUP_ORDER_UPDATED: "group_order_updated",
    GROUP_MEMBER_JOINED: "group_member_joined",
    GROUP_MEMBER_LEFT: "group_member_left",
    GROUP_PAYMENT_COMPLETED: "group_payment_completed",
  },
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    user: { id: 1, restaurantId: "r1" },
  }),
}));

// Mock lifecycle hooks to execute immediately
vi.mock("vue", async () => {
  const actual = await vi.importActual("vue");
  return {
    ...actual,
    onMounted: vi.fn((fn: any) => fn()),
    onUnmounted: vi.fn(),
  };
});

import { useRealtimeOrders } from "../useRealtimeOrders";

describe("useRealtimeOrders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnectionStatus.value = "connected";
  });

  it("should return expected reactive state", () => {
    const result = useRealtimeOrders();

    expect(result.isConnected).toBeDefined();
    expect(result.orderUpdates).toBeDefined();
    expect(result.groupOrderUpdates).toBeDefined();
    expect(result.connectionStatus).toBeDefined();
  });

  it("should subscribe to order events on mount", () => {
    useRealtimeOrders();

    // Should subscribe to order events and group order events (2 calls)
    expect(mockSubscribe).toHaveBeenCalledTimes(2);

    // First call: order events
    expect(mockSubscribe).toHaveBeenCalledWith(
      expect.arrayContaining([
        "order_created",
        "order_updated",
        "order_status_changed",
      ]),
      expect.any(Function),
      "r1",
    );

    // Second call: group order events
    expect(mockSubscribe).toHaveBeenCalledWith(
      expect.arrayContaining(["group_order_created", "group_order_updated"]),
      expect.any(Function),
      "r1",
    );
  });

  it("should connect if not already connected", () => {
    mockConnectionStatus.value = "disconnected";
    useRealtimeOrders();

    expect(mockConnect).toHaveBeenCalledWith("r1");
  });

  it("should not connect if already connected", () => {
    mockConnectionStatus.value = "connected";
    useRealtimeOrders();

    expect(mockConnect).not.toHaveBeenCalled();
  });

  describe("stopListening", () => {
    it("should unsubscribe all subscription ids", () => {
      const { stopListening } = useRealtimeOrders();

      stopListening();

      // Should unsubscribe both order and group order subscriptions
      expect(mockUnsubscribe).toHaveBeenCalledTimes(2);
    });
  });

  describe("clearUpdates", () => {
    it("should clear both order and group order updates", () => {
      const { clearUpdates, orderUpdates, groupOrderUpdates } =
        useRealtimeOrders();

      // Manually add some updates
      orderUpdates.value.push({
        orderId: "o1",
        orderNumber: "001",
        status: "pending",
        totalAmount: 100,
        timestamp: new Date().toISOString(),
        type: "created",
      });

      groupOrderUpdates.value.push({
        groupOrderId: "g1",
        shareCode: "ABC",
        status: "active",
        memberCount: 3,
        totalAmount: 300,
        timestamp: new Date().toISOString(),
        type: "created",
      });

      clearUpdates();

      expect(orderUpdates.value).toEqual([]);
      expect(groupOrderUpdates.value).toEqual([]);
    });
  });

  describe("getRecentOrderUpdates", () => {
    it("should return limited number of updates", () => {
      const { getRecentOrderUpdates, orderUpdates } = useRealtimeOrders();

      for (let i = 0; i < 15; i++) {
        orderUpdates.value.push({
          orderId: `o${i}`,
          orderNumber: `${i}`,
          status: "pending",
          totalAmount: 100,
          timestamp: new Date().toISOString(),
          type: "created",
        });
      }

      const recent = getRecentOrderUpdates(5);
      expect(recent).toHaveLength(5);
    });
  });

  describe("hasOrderUpdate", () => {
    it("should return true when order has updates", () => {
      const { hasOrderUpdate, orderUpdates } = useRealtimeOrders();

      orderUpdates.value.push({
        orderId: "o1",
        orderNumber: "001",
        status: "pending",
        totalAmount: 100,
        timestamp: new Date().toISOString(),
        type: "created",
      });

      expect(hasOrderUpdate("o1")).toBe(true);
      expect(hasOrderUpdate("o999")).toBe(false);
    });

    it("should filter by since date", () => {
      const { hasOrderUpdate, orderUpdates } = useRealtimeOrders();

      const oldDate = new Date("2026-01-01");
      orderUpdates.value.push({
        orderId: "o1",
        orderNumber: "001",
        status: "pending",
        totalAmount: 100,
        timestamp: new Date("2026-03-01").toISOString(),
        type: "created",
      });

      expect(hasOrderUpdate("o1", oldDate)).toBe(true);
      expect(hasOrderUpdate("o1", new Date("2026-04-01"))).toBe(false);
    });
  });

  describe("hasGroupOrderUpdate", () => {
    it("should return true when group order has updates", () => {
      const { hasGroupOrderUpdate, groupOrderUpdates } = useRealtimeOrders();

      groupOrderUpdates.value.push({
        groupOrderId: "g1",
        shareCode: "ABC",
        status: "active",
        memberCount: 3,
        totalAmount: 300,
        timestamp: new Date().toISOString(),
        type: "created",
      });

      expect(hasGroupOrderUpdate("g1")).toBe(true);
      expect(hasGroupOrderUpdate("g999")).toBe(false);
    });
  });
});
