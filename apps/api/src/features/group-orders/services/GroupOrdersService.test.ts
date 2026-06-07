import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => ({})),
}));

import { GroupOrdersService } from "./GroupOrdersService";

function createKV() {
  const values = new Map<string, string>();

  return {
    values,
    kv: {
      get: vi.fn(async (key: string, type?: "json") => {
        const value = values.get(key);
        if (value == null) return null;
        return type === "json" ? JSON.parse(value) : value;
      }),
      put: vi.fn(
        async (
          key: string,
          value: string,
          _options?: { expirationTtl?: number },
        ) => {
          values.set(key, value);
        },
      ),
      delete: vi.fn(async (key: string) => {
        values.delete(key);
      }),
    } as any,
  };
}

function createService() {
  const service = new GroupOrdersService({} as D1Database);
  return service as any;
}

describe("GroupOrdersService formatting and cache behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.mocked(console.log).mockRestore();
    vi.mocked(console.error).mockRestore();
    vi.useRealTimers();
  });

  it("formats group orders with defaults, cents-first money, and timestamp compatibility", () => {
    const service = createService();

    expect(
      service.formatGroupOrder({
        id: "group-1",
        restaurantId: "restaurant-1",
        tableId: 12,
        shareCode: "ABC123",
        createdBy: 7,
        status: "active",
        expiresAt: 1780876800,
        lockedAt: 1780880400,
        completedAt: null,
        settings: {
          permissions: { canModifyOthersCart: true },
        },
        totalAmount: 99,
        totalAmountCents: 12345,
        createdAt: 1780790400,
        updatedAt: 1780794000,
      }),
    ).toMatchObject({
      id: "group-1",
      groupOrderId: "group-1",
      restaurantId: "restaurant-1",
      tableId: 12,
      shareCode: "ABC123",
      maxMembers: 8,
      permissions: {
        canInviteMembers: true,
        canModifyOthersCart: true,
        canFinalizeOrder: true,
        canSplitBill: true,
        canProcessPayment: true,
      },
      totalAmount: 123.45,
      expiresAt: new Date(1780876800 * 1000),
      finalizedAt: new Date(1780880400 * 1000),
    });
  });

  it("formats members, cart items, and activities for API compatibility", () => {
    const service = createService();
    const now = new Date("2026-06-07T00:00:00.000Z");

    expect(
      service.formatMember({
        id: "member-1",
        groupOrderId: "group-1",
        name: "Host",
        phone: null,
        email: "host@example.test",
        role: "creator",
        joinedAt: now,
        lastActiveAt: now,
        leftAt: null,
      }),
    ).toMatchObject({
      id: "member-1",
      memberId: "member-1",
      memberName: "Host",
      email: "host@example.test",
      isHost: true,
      paymentStatus: "pending",
    });

    expect(
      service.formatCartItem({
        id: "item-1",
        groupOrderId: "group-1",
        memberId: "member-1",
        menuItemId: 10,
        quantity: 2,
        unitPrice: 9,
        totalPrice: 18,
        unitPriceCents: 1250,
        totalPriceCents: 2500,
        customizations: { spice: "mild" },
        specialInstructions: null,
        addedAt: 1780790400,
        updatedAt: 1780794000,
      }),
    ).toMatchObject({
      id: "item-1",
      unitPrice: 12.5,
      totalPrice: 25,
      customizations: { spice: "mild" },
      createdAt: new Date(1780790400 * 1000),
    });

    expect(
      service.formatActivity({
        id: "activity-1",
        groupOrderId: "group-1",
        memberId: "member-1",
        action: "item_added",
        description: "Added item",
        metadata: { menuItemId: 10 },
        createdAt: 1780790400,
      }),
    ).toMatchObject({
      id: "activity-1",
      activityId: "activity-1",
      type: "item_added",
      metadata: { menuItemId: 10 },
      timestamp: new Date(1780790400 * 1000),
    });
  });

  it("returns cached group order summaries before querying the database", async () => {
    const { kv, values } = createKV();
    const cached = {
      groupOrder: { id: "group-1" },
      members: [],
      cartItems: [],
      totalAmount: 0,
      activities: [],
    };
    values.set("group_order_summary:group-1", JSON.stringify(cached));
    const service = new GroupOrdersService({} as D1Database, kv);
    (service as any).db = {
      select: vi.fn(() => {
        throw new Error("db should not be queried");
      }),
    };

    await expect(service.getGroupOrder("group-1")).resolves.toEqual(cached);
  });

  it("assembles and caches group order summaries from query results", async () => {
    const { kv, values } = createKV();
    const service = new GroupOrdersService({} as D1Database, kv);
    const groupOrder = {
      id: "group-1",
      restaurantId: "restaurant-1",
      tableId: null,
      shareCode: "ABC123",
      createdBy: 7,
      status: "active",
      expiresAt: new Date("2026-06-08T00:00:00.000Z"),
      lockedAt: null,
      completedAt: null,
      settings: { maxMembers: 4 },
      totalAmount: 99,
      totalAmountCents: 12345,
      createdAt: new Date("2026-06-07T00:00:00.000Z"),
      updatedAt: new Date("2026-06-07T00:00:00.000Z"),
    };

    const queryResults = [
      [groupOrder],
      [
        {
          id: "member-1",
          groupOrderId: "group-1",
          name: "Host",
          phone: null,
          email: null,
          role: "creator",
          joinedAt: new Date("2026-06-07T00:00:00.000Z"),
          lastActiveAt: new Date("2026-06-07T00:00:00.000Z"),
          leftAt: null,
        },
      ],
      [
        {
          cartItem: {
            id: "item-1",
            groupOrderId: "group-1",
            memberId: "member-1",
            menuItemId: 10,
            quantity: 2,
            unitPrice: 9,
            totalPrice: 18,
            unitPriceCents: 1250,
            totalPriceCents: 2500,
            customizations: {},
            specialInstructions: "Less spicy",
            addedAt: new Date("2026-06-07T00:00:00.000Z"),
            updatedAt: new Date("2026-06-07T00:00:00.000Z"),
          },
          menuItemName: "Nasi Lemak",
          menuItemPrice: 12.5,
          menuItemImageUrl: null,
        },
      ],
      [
        {
          id: "activity-1",
          groupOrderId: "group-1",
          memberId: "member-1",
          action: "item_added",
          description: "Added item",
          metadata: {},
          createdAt: new Date("2026-06-07T00:00:00.000Z"),
        },
      ],
    ];
    const query = (result: unknown) => {
      const builder = {
        from: vi.fn(() => builder),
        innerJoin: vi.fn(() => builder),
        where: vi.fn(() => builder),
        orderBy: vi.fn(() => builder),
        limit: vi.fn(() => builder),
        then: (
          resolve: (value: unknown) => void,
          reject?: (reason: unknown) => void,
        ) => Promise.resolve(result).then(resolve, reject),
      };
      return builder;
    };
    (service as any).db = {
      select: vi.fn(() => query(queryResults.shift())),
    };

    const result = await service.getGroupOrder("group-1");

    expect(result).toMatchObject({
      groupOrder: {
        id: "group-1",
        totalAmount: 123.45,
      },
      members: [{ id: "member-1", isHost: true }],
      cartItems: [
        {
          id: "item-1",
          totalPrice: 25,
          menuItem: {
            id: 10,
            name: "Nasi Lemak",
            price: 12.5,
          },
        },
      ],
      totalAmount: 123.45,
      activities: [{ id: "activity-1", type: "item_added" }],
    });
    expect(
      JSON.parse(values.get("group_order_summary:group-1") ?? "{}"),
    ).toMatchObject({ totalAmount: 123.45 });
  });
});
