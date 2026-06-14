import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlatformOrderService } from "./PlatformOrderService";
import type { Env } from "../../../types/env";

const mocks = vi.hoisted(() => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
    update: vi.fn(),
  },
  adapter: {
    acceptOrder: vi.fn(),
    cancelOrder: vi.fn(),
    denyOrder: vi.fn(),
    parseOrder: vi.fn(),
  },
  integrationService: {
    getDecryptedCredentials: vi.fn(),
    getIntegration: vi.fn(),
  },
}));

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mocks.db),
}));

vi.mock("../adapters/PlatformAdapter", () => ({
  getAdapter: vi.fn(() => mocks.adapter),
}));

vi.mock("./PlatformIntegrationService", () => ({
  PlatformIntegrationService: vi.fn(function PlatformIntegrationService() {
    return mocks.integrationService;
  }),
}));

function createQuery(result: unknown) {
  const builder = {
    from: vi.fn(() => builder),
    where: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    offset: vi.fn(() => builder),
    then: (
      resolve: (value: unknown) => void,
      reject?: (reason: unknown) => void,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function mockSelectResults(results: unknown[]) {
  mocks.db.select.mockImplementation(() => createQuery(results.shift() ?? []));
}

function mockMutations() {
  const inserted: unknown[] = [];
  const updated: unknown[] = [];

  mocks.db.insert.mockImplementation(() => {
    const builder = {
      values: vi.fn((payload: unknown) => {
        inserted.push(payload);
        return builder;
      }),
      returning: vi.fn((projection?: unknown) =>
        createQuery(projection ? [{ id: 101 }] : []),
      ),
      then: (
        resolve: (value: unknown) => void,
        reject?: (reason: unknown) => void,
      ) => Promise.resolve(undefined).then(resolve, reject),
    };
    return builder;
  });

  mocks.db.update.mockImplementation(() => {
    const builder = {
      set: vi.fn((payload: unknown) => {
        updated.push(payload);
        return builder;
      }),
      where: vi.fn(() => builder),
      then: (
        resolve: (value: unknown) => void,
        reject?: (reason: unknown) => void,
      ) => Promise.resolve(undefined).then(resolve, reject),
    };
    return builder;
  });

  return { inserted, updated };
}

function createService() {
  return new PlatformOrderService({ DB: { binding: "db" } } as unknown as Env);
}

function parsedOrder() {
  return {
    platformOrderId: "uber-order-1",
    platformStoreId: "store-1",
    customerName: "Ari",
    customerPhone: "0912345678",
    deliveryAddress: "1 Main Street",
    subtotal: 12.5,
    taxAmount: 0.75,
    totalAmount: 13.25,
    platformStatus: "received" as const,
    rawPayload: { id: "uber-order-1" },
    items: [
      {
        platformItemId: "platform-item-1",
        name: "Laksa",
        quantity: 2,
        unitPrice: 5.5,
        totalPrice: 11,
        customizations: [],
      },
      {
        platformItemId: "unmapped-item",
        name: "Unknown",
        quantity: 1,
        unitPrice: 2,
        totalPrice: 2,
        customizations: [],
      },
    ],
  };
}

describe("PlatformOrderService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(1710000000000);
    mocks.adapter.parseOrder.mockResolvedValue(parsedOrder());
    mocks.adapter.acceptOrder.mockResolvedValue(undefined);
    mocks.adapter.denyOrder.mockResolvedValue(undefined);
    mocks.adapter.cancelOrder.mockResolvedValue(undefined);
    mocks.integrationService.getIntegration.mockResolvedValue({
      config: { autoAcceptOrders: false },
    });
    mocks.integrationService.getDecryptedCredentials.mockResolvedValue({
      accessToken: "token",
    });
  });

  it("creates internal platform orders and skips unmapped items", async () => {
    const mutations = mockMutations();
    mockSelectResults([
      [{ platformItemId: "platform-item-1", menuItemId: 501 }],
    ]);

    await expect(
      createService().processWebhook(
        "uber_eats",
        { id: "uber-order-1" },
        "restaurant-1",
      ),
    ).resolves.toBe(101);

    expect(mocks.adapter.parseOrder).toHaveBeenCalledWith({
      id: "uber-order-1",
    });
    expect(mutations.inserted).toHaveLength(3);
    expect(mutations.inserted[0]).toMatchObject({
      restaurantId: "restaurant-1",
      orderNumber: "PL-1710000000000",
      status: "pending",
      orderSource: "uber_eats",
      customerInfo: { name: "Ari", phone: "0912345678" },
      deliveryInfo: { type: "delivery", address: "1 Main Street" },
      subtotalCents: 1250,
      taxAmountCents: 75,
      totalAmountCents: 1325,
      serviceChargeCents: 0,
      discountAmountCents: 0,
    });
    expect(mutations.inserted[1]).toMatchObject({
      orderId: 101,
      menuItemId: 501,
      quantity: 2,
      unitPriceCents: 550,
      totalPriceCents: 1100,
      itemSnapshot: { name: "Laksa" },
    });
    expect(mutations.inserted[2]).toMatchObject({
      orderId: 101,
      restaurantId: "restaurant-1",
      platform: "uber_eats",
      platformOrderId: "uber-order-1",
      platformStoreId: "store-1",
      platformStatus: "received",
      rawPayload: { id: "uber-order-1" },
    });
  });

  it("auto-accepts configured platform orders and confirms the internal order", async () => {
    const mutations = mockMutations();
    mockSelectResults([
      [{ platformItemId: "platform-item-1", menuItemId: 501 }],
    ]);
    mocks.integrationService.getIntegration.mockResolvedValueOnce({
      config: { autoAcceptOrders: true },
    });

    await createService().processWebhook(
      "uber_eats",
      { id: "uber-order-1" },
      "restaurant-1",
    );

    expect(
      mocks.integrationService.getDecryptedCredentials,
    ).toHaveBeenCalledWith("restaurant-1", "uber_eats");
    expect(mocks.adapter.acceptOrder).toHaveBeenCalledWith("uber-order-1", {
      accessToken: "token",
    });
    expect(mutations.updated).toEqual([
      expect.objectContaining({ platformStatus: "accepted" }),
      expect.objectContaining({ status: "confirmed" }),
    ]);
  });

  it("does not fail webhook processing when auto-accept fails", async () => {
    const mutations = mockMutations();
    mockSelectResults([
      [{ platformItemId: "platform-item-1", menuItemId: 501 }],
    ]);
    mocks.integrationService.getIntegration.mockResolvedValueOnce({
      config: { autoAcceptOrders: true },
    });
    mocks.adapter.acceptOrder.mockRejectedValueOnce(new Error("platform down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      createService().processWebhook(
        "uber_eats",
        { id: "uber-order-1" },
        "restaurant-1",
      ),
    ).resolves.toBe(101);

    expect(mutations.updated).toHaveLength(0);
    expect(console.error).toHaveBeenCalledWith(
      "Failed to auto-accept order uber-order-1:",
      expect.any(Error),
    );
  });

  it("syncs platform status transitions for accepted, denied, cancelled, and ready orders", async () => {
    const mutations = mockMutations();
    mockSelectResults([
      [
        {
          id: "platform-row-1",
          orderId: 101,
          restaurantId: "restaurant-1",
          platform: "uber_eats",
          platformOrderId: "uber-order-1",
          platformStatus: "received",
        },
      ],
      [
        {
          id: "platform-row-2",
          orderId: 102,
          restaurantId: "restaurant-1",
          platform: "uber_eats",
          platformOrderId: "uber-order-2",
          platformStatus: "received",
        },
      ],
      [
        {
          id: "platform-row-3",
          orderId: 103,
          restaurantId: "restaurant-1",
          platform: "uber_eats",
          platformOrderId: "uber-order-3",
          platformStatus: "accepted",
        },
      ],
      [
        {
          id: "platform-row-4",
          orderId: 104,
          restaurantId: "restaurant-1",
          platform: "uber_eats",
          platformOrderId: "uber-order-4",
          platformStatus: "accepted",
        },
      ],
    ]);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await createService().syncStatusToPlatform(101, "confirmed");
    await createService().syncStatusToPlatform(102, "cancelled");
    await createService().syncStatusToPlatform(103, "cancelled");
    await createService().syncStatusToPlatform(104, "ready");

    expect(mocks.adapter.acceptOrder).toHaveBeenCalledWith("uber-order-1", {
      accessToken: "token",
    });
    expect(mocks.adapter.denyOrder).toHaveBeenCalledWith(
      "uber-order-2",
      "Order denied by restaurant",
      { accessToken: "token" },
    );
    expect(mocks.adapter.cancelOrder).toHaveBeenCalledWith(
      "uber-order-3",
      "Order cancelled by restaurant",
      { accessToken: "token" },
    );
    expect(mutations.updated).toEqual([
      expect.objectContaining({ platformStatus: "accepted" }),
      expect.objectContaining({ platformStatus: "denied" }),
      expect.objectContaining({ platformStatus: "cancelled" }),
      expect.objectContaining({ platformStatus: "ready" }),
    ]);
  });

  it("ignores status sync when no platform order exists and lists filtered platform orders", async () => {
    const mutations = mockMutations();
    mockSelectResults([[], [{ id: "platform-row-1", platform: "uber_eats" }]]);

    await createService().syncStatusToPlatform(404, "confirmed");
    const results = await createService().getPlatformOrders("restaurant-1", {
      platform: "uber_eats",
      platformStatus: "received",
      page: 2,
      limit: 10,
    });

    expect(mocks.adapter.acceptOrder).not.toHaveBeenCalled();
    expect(mutations.updated).toHaveLength(0);
    expect(results).toEqual([{ id: "platform-row-1", platform: "uber_eats" }]);
  });
});
