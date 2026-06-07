import { beforeEach, describe, expect, it, vi } from "vitest";

const uuidState = vi.hoisted(() => ({ next: 1 }));

vi.mock("crypto", () => ({
  randomUUID: vi.fn(() => `uuid-${uuidState.next++}`),
}));

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

function createQuery(result: unknown) {
  const builder = {
    from: vi.fn(() => builder),
    innerJoin: vi.fn(() => builder),
    where: vi.fn(() => builder),
    orderBy: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    set: vi.fn(() => builder),
    values: vi.fn(async (payload: unknown) => payload),
    then: (
      resolve: (value: unknown) => void,
      reject?: (reason: unknown) => void,
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

function createDb(selectResults: unknown[] = []) {
  const inserts: Array<{ table: unknown; payload: unknown }> = [];
  const updates: Array<{ table: unknown; payload: unknown }> = [];
  const deletes: unknown[] = [];

  const db = {
    inserts,
    updates,
    deletes,
    select: vi.fn(() => createQuery(selectResults.shift() ?? [])),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn(async (payload: unknown) => {
        inserts.push({ table, payload });
        return payload;
      }),
    })),
    update: vi.fn((table: unknown) => {
      const builder = {
        set: vi.fn((payload: unknown) => {
          updates.push({ table, payload });
          return builder;
        }),
        where: vi.fn(async () => undefined),
      };
      return builder;
    }),
    delete: vi.fn((table: unknown) => {
      const builder = {
        where: vi.fn(async () => {
          deletes.push(table);
        }),
      };
      return builder;
    }),
  };

  return db;
}

const baseGroupOrder = {
  id: "group-1",
  restaurantId: "restaurant-1",
  tableId: null,
  shareCode: "ABC12345",
  createdBy: 7,
  status: "active",
  expiresAt: new Date("2026-06-08T00:00:00.000Z"),
  lockedAt: null,
  completedAt: null,
  settings: { maxMembers: 4 },
  totalAmount: 0,
  totalAmountCents: 0,
  createdAt: new Date("2026-06-07T00:00:00.000Z"),
  updatedAt: new Date("2026-06-07T00:00:00.000Z"),
};

const hostMember = {
  id: "member-1",
  groupOrderId: "group-1",
  name: "Host",
  phone: null,
  email: null,
  role: "creator",
  joinedAt: new Date("2026-06-07T00:00:00.000Z"),
  lastActiveAt: new Date("2026-06-07T00:00:00.000Z"),
  leftAt: null,
};

describe("GroupOrdersService formatting and cache behavior", () => {
  beforeEach(() => {
    uuidState.next = 1;
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

  it("lists group orders with batched member and item counts", async () => {
    const service = createService();
    const db = createDb([
      [
        {
          ...baseGroupOrder,
          tableId: 12,
          settings: { tableNumber: "A5" },
          totalAmount: 45,
        },
      ],
      [hostMember, { ...hostMember, id: "member-2", role: "member" }],
      [
        { id: "cart-1", groupOrderId: "group-1" },
        { id: "cart-2", groupOrderId: "group-1" },
      ],
    ]);
    service.db = db;

    await expect(
      service.listGroupOrders("restaurant-1", "active"),
    ).resolves.toMatchObject([
      {
        id: "group-1",
        tableNumber: "A5",
        hostName: "Host",
        memberCount: 2,
        itemCount: 2,
        totalAmount: 45,
      },
    ]);
    expect(db.select).toHaveBeenCalledTimes(3);
  });

  it("creates a group order with host member, activity log, and cache aliases", async () => {
    const { kv, values } = createKV();
    const service = new GroupOrdersService({} as D1Database, kv) as any;
    const db = createDb([[{ ...hostMember, id: "uuid-2" }]]);
    service.db = db;
    vi.spyOn(Math, "random").mockReturnValue(0);

    const result = await service.createGroupOrder(
      {
        restaurantId: "restaurant-1",
        hostName: "Ada",
        tableNumber: "T1",
        expectedMembers: 6,
        permissions: { canModifyOthersCart: true },
      },
      7,
    );

    expect(result).toMatchObject({
      success: true,
      data: {
        groupOrderId: "uuid-1",
        shareCode: "AAAAAAAA",
        host: { id: "uuid-2", memberName: "Host" },
      },
    });
    expect(db.inserts[0].payload).toMatchObject({
      id: "uuid-1",
      restaurantId: "restaurant-1",
      settings: {
        maxMembers: 6,
        tableNumber: "T1",
        permissions: { canModifyOthersCart: true },
      },
    });
    expect(db.inserts[1].payload).toMatchObject({
      id: "uuid-2",
      name: "Ada",
      role: "creator",
    });
    expect(db.inserts[2].payload).toMatchObject({
      id: "uuid-4",
      action: "group_created",
    });
    expect(JSON.parse(values.get("group_order:uuid-1") ?? "{}")).toMatchObject({
      shareCode: "AAAAAAAA",
    });
    expect(values.get("share_code:AAAAAAAA")).toBe('"uuid-1"');
    vi.mocked(Math.random).mockRestore();
  });

  it("joins active groups and rejects full or duplicate-member groups", async () => {
    const service = createService();
    const fullDb = createDb([[baseGroupOrder], [{ count: 4 }]]);
    service.db = fullDb;

    await expect(
      service.joinGroup("ABC12345", { memberName: "Lin" }),
    ).resolves.toEqual({
      success: false,
      error: "Group order is full",
    });

    const duplicateDb = createDb([
      [baseGroupOrder],
      [{ count: 1 }],
      [hostMember],
    ]);
    service.db = duplicateDb;
    await expect(
      service.joinGroup("ABC12345", { memberName: "Host" }),
    ).resolves.toEqual({
      success: false,
      error: "Member name already exists in this group",
    });

    const { kv, values } = createKV();
    values.set("group_order:group-1", JSON.stringify({ stale: true }));
    const joinService = new GroupOrdersService({} as D1Database, kv) as any;
    const joinDb = createDb([
      [baseGroupOrder],
      [{ count: 1 }],
      [],
      [{ ...hostMember, id: "uuid-1", name: "Lin", role: "member" }],
    ]);
    joinService.db = joinDb;

    await expect(
      joinService.joinGroup("ABC12345", {
        memberName: "Lin",
        phone: "0912",
        email: "lin@example.test",
      }),
    ).resolves.toMatchObject({
      success: true,
      data: {
        member: { id: "uuid-1", memberName: "Lin", isHost: false },
        groupOrder: { id: "group-1" },
      },
    });
    expect(joinDb.inserts[0].payload).toMatchObject({
      id: "uuid-1",
      name: "Lin",
      phone: "0912",
      email: "lin@example.test",
    });
    expect(values.has("group_order:group-1")).toBe(false);
  });

  it("adds and updates cart items while recalculating member and group totals", async () => {
    const { kv, values } = createKV();
    values.set("group_order_summary:group-1", JSON.stringify({ stale: true }));
    const service = new GroupOrdersService({} as D1Database, kv) as any;
    const cartItem = {
      id: "uuid-1",
      groupOrderId: "group-1",
      memberId: "member-1",
      menuItemId: 10,
      quantity: 2,
      unitPrice: 12.5,
      totalPrice: 25,
      unitPriceCents: 1250,
      totalPriceCents: 2500,
      customizations: { spice: "hot" },
      specialInstructions: "No peanuts",
      addedAt: new Date("2026-06-07T00:00:00.000Z"),
      updatedAt: new Date("2026-06-07T00:00:00.000Z"),
    };
    service.db = createDb([
      [baseGroupOrder],
      [hostMember],
      [
        {
          id: 10,
          restaurantId: "restaurant-1",
          name: "Laksa",
          price: 9,
          priceCents: 1250,
        },
      ],
      [{ total: 25 }],
      [],
      [{ total: 25 }],
      [cartItem],
    ]);

    await expect(
      service.addCartItem("group-1", {
        memberId: "member-1",
        menuItemId: 10,
        quantity: 2,
        customizations: { spice: "hot" },
        specialInstructions: "No peanuts",
      }),
    ).resolves.toMatchObject({
      success: true,
      data: { id: "uuid-1", totalPrice: 25 },
    });
    expect(values.has("group_order_summary:group-1")).toBe(false);

    const updateService = createService();
    const updateDb = createDb([
      [cartItem],
      [{ total: 37.5 }],
      [],
      [{ total: 37.5 }],
      [{ ...cartItem, quantity: 3, totalPriceCents: 3750 }],
    ]);
    updateService.db = updateDb;

    await expect(
      updateService.updateCartItem("group-1", "uuid-1", {
        quantity: 3,
        specialInstructions: "Extra soup",
      }),
    ).resolves.toMatchObject({
      success: true,
      data: { quantity: 3, totalPrice: 37.5 },
    });
    expect(updateDb.updates[0].payload).toMatchObject({
      quantity: 3,
      totalPriceCents: 3750,
      totalPrice: 37.5,
      specialInstructions: "Extra soup",
    });
  });

  it("splits bills equally and completes a member payment", async () => {
    const { kv, values } = createKV();
    values.set("group_order_summary:group-1", JSON.stringify({ stale: true }));
    const service = new GroupOrdersService({} as D1Database, kv) as any;
    const secondMember = { ...hostMember, id: "member-2", role: "member" };
    const splitDb = createDb([
      [baseGroupOrder],
      [hostMember, secondMember],
      [
        {
          id: "cart-1",
          groupOrderId: "group-1",
          memberId: "member-1",
          menuItemId: 10,
          quantity: 1,
          unitPriceCents: 1000,
          totalPriceCents: 1000,
          customizations: {},
        },
        {
          id: "cart-2",
          groupOrderId: "group-1",
          memberId: "member-2",
          menuItemId: 20,
          quantity: 1,
          unitPriceCents: 3000,
          totalPriceCents: 3000,
          customizations: {},
        },
      ],
      [],
      [],
    ]);
    service.db = splitDb;

    await expect(
      service.splitBill("group-1", {
        splitType: "equal",
        serviceChargeRate: 10,
        taxRate: 5,
      }),
    ).resolves.toMatchObject({
      success: true,
      data: [
        {
          memberId: "member-1",
          subtotal: 20,
          serviceCharge: 2,
          taxAmount: 1.1,
          totalAmount: 23.1,
        },
        {
          memberId: "member-2",
          totalAmount: 23.1,
        },
      ],
    });
    expect(splitDb.inserts).toHaveLength(3);
    expect(splitDb.updates[0].payload).toMatchObject({
      status: "checkout",
      splitType: "equal",
      finalAmountCents: 4620,
    });
    expect(values.has("group_order_summary:group-1")).toBe(false);

    const paymentService = createService();
    const paymentDb = createDb([
      [{ ...baseGroupOrder, status: "checkout" }],
      [hostMember],
      [
        {
          id: "split-1",
          groupOrderId: "group-1",
          memberId: "member-1",
          totalAmount: 23.1,
          totalAmountCents: 2310,
          paymentStatus: "pending",
        },
      ],
      [{ count: 0 }],
    ]);
    paymentService.db = paymentDb;

    await expect(
      paymentService.processPayment("group-1", "member-1", {
        paymentMethod: "cash",
        transactionId: "txn-1",
      }),
    ).resolves.toMatchObject({
      success: true,
      data: {
        memberId: "member-1",
        amount: 23.1,
        transactionId: "txn-1",
        groupOrderStatus: "completed",
      },
    });
    expect(paymentDb.updates[0].payload).toMatchObject({
      paymentStatus: "paid",
      paymentMethod: "cash",
    });
    expect(paymentDb.updates[1].payload).toMatchObject({
      status: "completed",
    });
  });

  it("handles leave guards, expired cleanup, activities, and statistics aggregation", async () => {
    const service = createService();
    service.db = createDb([[{ ...baseGroupOrder, status: "checkout" }]]);

    await expect(service.leaveGroup("group-1", "member-1")).resolves.toEqual({
      success: false,
      error: "Cannot leave a group order after checkout has started",
    });

    const cleanupService = createService();
    const cleanupDb = createDb([
      [
        { id: "group-1", shareCode: "ABC12345", expiresAt: new Date() },
        { id: "group-2", shareCode: "XYZ12345", expiresAt: new Date() },
      ],
    ]);
    cleanupService.db = cleanupDb;
    await expect(cleanupService.cleanupExpiredGroups()).resolves.toEqual({
      cleaned: 2,
      errors: [],
    });
    expect(cleanupDb.updates).toHaveLength(2);
    expect(cleanupDb.inserts).toHaveLength(2);

    const activityService = createService();
    activityService.db = createDb([
      [
        {
          id: "activity-1",
          groupOrderId: "group-1",
          memberId: null,
          action: "bill_split",
          description: "Split",
          metadata: { splitType: "equal" },
          createdAt: new Date("2026-06-07T00:00:00.000Z"),
        },
      ],
    ]);
    await expect(
      activityService.getActivities("group-1"),
    ).resolves.toMatchObject([{ id: "activity-1", type: "bill_split" }]);

    const statsService = createService();
    statsService.db = createDb([
      [{ total: 10 }],
      [{ active: 4 }],
      [{ avgSize: 2.25 }],
      [{ avgValue: 31.678 }],
    ]);
    await expect(
      statsService.getStatistics("restaurant-1", "week"),
    ).resolves.toEqual({
      totalGroupOrders: 10,
      activeGroupOrders: 4,
      averageGroupSize: 2.3,
      averageOrderValue: 31.68,
      popularTimeSlots: [],
      conversionRate: 60,
      paymentMethodDistribution: {},
    });
  });
});
