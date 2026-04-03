import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlatformOrderService } from "../PlatformOrderService";
import type { ParsedPlatformOrder } from "@makanmakan/shared-types";

// ─── Mock drizzle-orm/d1 ───────────────────────────────────────────────────

const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();

const mockDb = {
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, val: unknown) => ({ _type: "eq", val })),
  and: vi.fn((...args: unknown[]) => ({ _type: "and", args })),
  desc: vi.fn((col: unknown) => ({ _type: "desc", col })),
}));

vi.mock("@makanmakan/database", () => ({
  platformOrders: {
    orderId: "orderId",
    restaurantId: "restaurantId",
    platform: "platform",
    platformStatus: "platformStatus",
    id: "id",
    createdAt: "createdAt",
  },
  platformMenuMappings: {
    restaurantId: "restaurantId",
    platform: "platform",
    platformItemId: "platformItemId",
    menuItemId: "menuItemId",
  },
  orders: { id: "id", restaurantId: "restaurantId", status: "status" },
  orderItems: { orderId: "orderId" },
}));

// ─── Mock adapter ─────────────────────────────────────────────────────────

const mockAdapter = {
  platform: "uber_eats" as const,
  syncMenu: vi.fn(),
  verifyWebhook: vi.fn(),
  refreshToken: vi.fn(),
  parseOrder: vi.fn(),
  acceptOrder: vi.fn(),
  denyOrder: vi.fn(),
  cancelOrder: vi.fn(),
};

vi.mock("../../adapters/PlatformAdapter", () => ({
  getAdapter: vi.fn(() => mockAdapter),
}));

// ─── Mock PlatformIntegrationService ──────────────────────────────────────

const mockGetIntegration = vi.fn();
const mockGetDecryptedCredentials = vi.fn();

vi.mock("../PlatformIntegrationService", () => {
  return {
    PlatformIntegrationService: class {
      getIntegration = mockGetIntegration;
      getDecryptedCredentials = mockGetDecryptedCredentials;
    },
  };
});

// ─── Test environment ─────────────────────────────────────────────────────

const mockEnv = {
  DB: {},
  CACHE_KV: {},
  JWT_SECRET: "test-jwt-secret-key-for-testing-only",
  ENCRYPTION_KEY: "test-encryption-key-for-testing-only-32chars",
} as any;

// ─── Chain helpers ────────────────────────────────────────────────────────

/** Terminal: .where() resolves */
function makeSelectTerminalWhere(returnValue: unknown) {
  const chain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(returnValue),
  };
  return chain;
}

/** Terminal: .limit() resolves */
function makeSelectTerminalLimit(returnValue: unknown) {
  const chain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(returnValue),
  };
  return chain;
}

/** Terminal: .offset() resolves (for paginated queries) */
function makeSelectTerminalOffset(returnValue: unknown) {
  const chain: any = {};
  chain.from = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.offset = vi.fn().mockResolvedValue(returnValue);
  return chain;
}

function makeUpdateChain() {
  const chain: any = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  };
  return chain;
}

function makeInsertChain(returning?: unknown) {
  const chain: any = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue(returning ?? []),
  };
  // If no .returning() call, .values() resolves directly
  chain.values.mockReturnValue(chain);
  return chain;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────

function buildParsedOrder(
  overrides: Partial<ParsedPlatformOrder> = {},
): ParsedPlatformOrder {
  return {
    platformOrderId: "plat-order-001",
    platformStoreId: "plat-store-001",
    customerName: "Alice",
    customerPhone: "+60123456789",
    deliveryAddress: "123 Jalan Test",
    items: [
      {
        platformItemId: "plat-item-10",
        name: "Nasi Lemak",
        quantity: 2,
        unitPrice: 1200,
        totalPrice: 2400,
      },
      {
        platformItemId: "plat-item-20",
        name: "Teh Tarik",
        quantity: 1,
        unitPrice: 500,
        totalPrice: 500,
      },
    ],
    subtotal: 2900,
    taxAmount: 174,
    totalAmount: 3074,
    platformStatus: "new",
    rawPayload: { raw: true },
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe("PlatformOrderService", () => {
  let service: PlatformOrderService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PlatformOrderService(mockEnv);
  });

  // ═══════════════════════════════════════════════════════════════════════
  // processWebhook
  // ═══════════════════════════════════════════════════════════════════════

  describe("processWebhook", () => {
    it("should create an internal order from a platform webhook payload", async () => {
      const restaurantId = "rest-001";
      const platform = "uber_eats" as const;
      const parsed = buildParsedOrder();
      const orderId = 42;

      mockAdapter.parseOrder.mockResolvedValue(parsed);

      // select: menu mappings (terminal .where)
      const mappings = [
        { platformItemId: "plat-item-10", menuItemId: 10 },
        { platformItemId: "plat-item-20", menuItemId: 20 },
      ];
      const selectChainMappings = makeSelectTerminalWhere(mappings);
      mockSelect.mockReturnValue(selectChainMappings);

      // insert: order (returning id), orderItems x2, platformOrders
      const insertOrderChain = makeInsertChain([{ id: orderId }]);
      const insertItemChain1 = makeInsertChain();
      insertItemChain1.values.mockResolvedValue(undefined);
      const insertItemChain2 = makeInsertChain();
      insertItemChain2.values.mockResolvedValue(undefined);
      const insertPlatformOrderChain = makeInsertChain();
      insertPlatformOrderChain.values.mockResolvedValue(undefined);

      const insertCalls = [
        insertOrderChain,
        insertItemChain1,
        insertItemChain2,
        insertPlatformOrderChain,
      ];
      let insertIdx = 0;
      mockInsert.mockImplementation(() => insertCalls[insertIdx++]);

      // Integration: no auto-accept
      mockGetIntegration.mockResolvedValue({
        config: { autoAcceptOrders: false },
      });

      const result = await service.processWebhook(
        platform,
        { somePayload: true },
        restaurantId,
      );

      expect(result).toBe(orderId);
      expect(mockAdapter.parseOrder).toHaveBeenCalledOnce();
      expect(mockAdapter.parseOrder).toHaveBeenCalledWith({ somePayload: true });

      // Order insert should include restaurant and platform info
      expect(insertOrderChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId,
          orderSource: platform,
          status: "pending",
          totalAmount: parsed.totalAmount,
        }),
      );

      // Platform order mapping insert
      expect(insertPlatformOrderChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId,
          restaurantId,
          platform,
          platformOrderId: "plat-order-001",
          platformStatus: "received",
        }),
      );

      // Auto-accept should NOT be called
      expect(mockAdapter.acceptOrder).not.toHaveBeenCalled();
    });

    it("should auto-accept when integration config has autoAcceptOrders", async () => {
      const restaurantId = "rest-002";
      const platform = "uber_eats" as const;
      const parsed = buildParsedOrder();
      const orderId = 99;

      mockAdapter.parseOrder.mockResolvedValue(parsed);

      // select: mappings (terminal .where)
      const selectChain = makeSelectTerminalWhere([
        { platformItemId: "plat-item-10", menuItemId: 10 },
        { platformItemId: "plat-item-20", menuItemId: 20 },
      ]);
      mockSelect.mockReturnValue(selectChain);

      // inserts
      const insertOrderChain = makeInsertChain([{ id: orderId }]);
      const insertItemChain1 = makeInsertChain();
      insertItemChain1.values.mockResolvedValue(undefined);
      const insertItemChain2 = makeInsertChain();
      insertItemChain2.values.mockResolvedValue(undefined);
      const insertPlatformOrderChain = makeInsertChain();
      insertPlatformOrderChain.values.mockResolvedValue(undefined);

      const insertCalls = [
        insertOrderChain,
        insertItemChain1,
        insertItemChain2,
        insertPlatformOrderChain,
      ];
      let insertIdx = 0;
      mockInsert.mockImplementation(() => insertCalls[insertIdx++]);

      // Integration: auto-accept enabled
      mockGetIntegration.mockResolvedValue({
        config: { autoAcceptOrders: true },
      });
      const mockCreds = { clientId: "c1", clientSecret: "s1" };
      mockGetDecryptedCredentials.mockResolvedValue(mockCreds);
      mockAdapter.acceptOrder.mockResolvedValue(undefined);

      // update calls for auto-accept: platformOrders status, orders status
      const updateChain1 = makeUpdateChain();
      const updateChain2 = makeUpdateChain();
      let updateIdx = 0;
      mockUpdate.mockImplementation(() => [updateChain1, updateChain2][updateIdx++]);

      const result = await service.processWebhook(
        platform,
        {},
        restaurantId,
      );

      expect(result).toBe(orderId);
      expect(mockAdapter.acceptOrder).toHaveBeenCalledOnce();
      expect(mockAdapter.acceptOrder).toHaveBeenCalledWith(
        parsed.platformOrderId,
        mockCreds,
      );

      // Verify status updates were made
      expect(updateChain1.set).toHaveBeenCalledWith(
        expect.objectContaining({ platformStatus: "accepted" }),
      );
      expect(updateChain2.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: "confirmed" }),
      );
    });

    it("should skip unmapped items gracefully", async () => {
      const restaurantId = "rest-003";
      const platform = "uber_eats" as const;
      const parsed = buildParsedOrder({
        items: [
          {
            platformItemId: "unknown-item",
            name: "Unknown",
            quantity: 1,
            unitPrice: 100,
            totalPrice: 100,
          },
        ],
      });
      const orderId = 50;

      mockAdapter.parseOrder.mockResolvedValue(parsed);

      // No mappings found (terminal .where)
      const selectChain = makeSelectTerminalWhere([]);
      mockSelect.mockReturnValue(selectChain);

      // insert: order, platformOrders (no orderItems since unmapped)
      const insertOrderChain = makeInsertChain([{ id: orderId }]);
      const insertPlatformOrderChain = makeInsertChain();
      insertPlatformOrderChain.values.mockResolvedValue(undefined);

      const insertCalls = [insertOrderChain, insertPlatformOrderChain];
      let insertIdx = 0;
      mockInsert.mockImplementation(() => insertCalls[insertIdx++]);

      mockGetIntegration.mockResolvedValue({ config: {} });

      const result = await service.processWebhook(platform, {}, restaurantId);

      expect(result).toBe(orderId);
      // Only 2 inserts: order + platformOrders, no orderItems
      expect(mockInsert).toHaveBeenCalledTimes(2);
    });

    it("should not throw when auto-accept fails (logs error only)", async () => {
      const restaurantId = "rest-004";
      const platform = "uber_eats" as const;
      const parsed = buildParsedOrder({ items: [] });
      const orderId = 77;

      mockAdapter.parseOrder.mockResolvedValue(parsed);

      const selectChain = makeSelectTerminalWhere([]);
      mockSelect.mockReturnValue(selectChain);

      const insertOrderChain = makeInsertChain([{ id: orderId }]);
      const insertPlatformOrderChain = makeInsertChain();
      insertPlatformOrderChain.values.mockResolvedValue(undefined);
      let insertIdx = 0;
      mockInsert.mockImplementation(
        () => [insertOrderChain, insertPlatformOrderChain][insertIdx++],
      );

      mockGetIntegration.mockResolvedValue({
        config: { autoAcceptOrders: true },
      });
      mockGetDecryptedCredentials.mockResolvedValue({ clientId: "c1" });
      mockAdapter.acceptOrder.mockRejectedValue(new Error("Platform down"));

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Should not throw despite auto-accept failure
      const result = await service.processWebhook(platform, {}, restaurantId);
      expect(result).toBe(orderId);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to auto-accept"),
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // syncStatusToPlatform
  // ═══════════════════════════════════════════════════════════════════════

  describe("syncStatusToPlatform", () => {
    const platformOrderRecord = {
      id: 1,
      orderId: 42,
      platform: "uber_eats",
      platformOrderId: "plat-order-001",
      restaurantId: "rest-001",
      platformStatus: "received",
    };

    it("should accept order when status changes from received to confirmed", async () => {
      const selectChain = makeSelectTerminalLimit([platformOrderRecord]);
      mockSelect.mockReturnValue(selectChain);

      const mockCreds = { clientId: "c1" };
      mockGetDecryptedCredentials.mockResolvedValue(mockCreds);
      mockAdapter.acceptOrder.mockResolvedValue(undefined);

      const updateChain = makeUpdateChain();
      mockUpdate.mockReturnValue(updateChain);

      await service.syncStatusToPlatform(42, "confirmed");

      expect(mockAdapter.acceptOrder).toHaveBeenCalledOnce();
      expect(mockAdapter.acceptOrder).toHaveBeenCalledWith(
        "plat-order-001",
        mockCreds,
      );
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ platformStatus: "accepted" }),
      );
    });

    it("should deny order when status is received and new status is cancelled", async () => {
      const selectChain = makeSelectTerminalLimit([platformOrderRecord]);
      mockSelect.mockReturnValue(selectChain);

      const mockCreds = { clientId: "c1" };
      mockGetDecryptedCredentials.mockResolvedValue(mockCreds);
      mockAdapter.denyOrder.mockResolvedValue(undefined);

      const updateChain = makeUpdateChain();
      mockUpdate.mockReturnValue(updateChain);

      await service.syncStatusToPlatform(42, "cancelled");

      expect(mockAdapter.denyOrder).toHaveBeenCalledOnce();
      expect(mockAdapter.denyOrder).toHaveBeenCalledWith(
        "plat-order-001",
        "Order denied by restaurant",
        mockCreds,
      );
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ platformStatus: "denied" }),
      );
    });

    it("should cancel order when already accepted and new status is cancelled", async () => {
      const acceptedRecord = { ...platformOrderRecord, platformStatus: "accepted" };
      const selectChain = makeSelectTerminalLimit([acceptedRecord]);
      mockSelect.mockReturnValue(selectChain);

      const mockCreds = { clientId: "c1" };
      mockGetDecryptedCredentials.mockResolvedValue(mockCreds);
      mockAdapter.cancelOrder.mockResolvedValue(undefined);

      const updateChain = makeUpdateChain();
      mockUpdate.mockReturnValue(updateChain);

      await service.syncStatusToPlatform(42, "cancelled");

      expect(mockAdapter.cancelOrder).toHaveBeenCalledOnce();
      expect(mockAdapter.cancelOrder).toHaveBeenCalledWith(
        "plat-order-001",
        "Order cancelled by restaurant",
        mockCreds,
      );
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ platformStatus: "cancelled" }),
      );
    });

    it("should mark as ready and log when new status is ready", async () => {
      const acceptedRecord = { ...platformOrderRecord, platformStatus: "accepted" };
      const selectChain = makeSelectTerminalLimit([acceptedRecord]);
      mockSelect.mockReturnValue(selectChain);

      const mockCreds = { clientId: "c1" };
      mockGetDecryptedCredentials.mockResolvedValue(mockCreds);

      const updateChain = makeUpdateChain();
      mockUpdate.mockReturnValue(updateChain);

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await service.syncStatusToPlatform(42, "ready");

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("marked as ready"),
      );
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ platformStatus: "ready" }),
      );

      consoleSpy.mockRestore();
    });

    it("should do nothing if no platform order record found", async () => {
      const selectChain = makeSelectTerminalLimit([]);
      mockSelect.mockReturnValue(selectChain);

      await service.syncStatusToPlatform(999, "confirmed");

      expect(mockAdapter.acceptOrder).not.toHaveBeenCalled();
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // getPlatformOrders
  // ═══════════════════════════════════════════════════════════════════════

  describe("getPlatformOrders", () => {
    it("should return filtered and paginated platform orders", async () => {
      const orders = [
        { id: 1, orderId: 10, platform: "uber_eats", platformStatus: "received" },
        { id: 2, orderId: 20, platform: "uber_eats", platformStatus: "accepted" },
      ];

      const selectChain = makeSelectTerminalOffset(orders);
      mockSelect.mockReturnValue(selectChain);

      const result = await service.getPlatformOrders("rest-001", {
        platform: "uber_eats",
        platformStatus: "received",
        page: 2,
        limit: 10,
      });

      expect(result).toEqual(orders);
      expect(mockSelect).toHaveBeenCalledOnce();
    });

    it("should use default pagination when not provided", async () => {
      const selectChain = makeSelectTerminalOffset([]);
      mockSelect.mockReturnValue(selectChain);

      const result = await service.getPlatformOrders("rest-001", {});

      expect(result).toEqual([]);
      expect(mockSelect).toHaveBeenCalledOnce();
    });
  });
});
