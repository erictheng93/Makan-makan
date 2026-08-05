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
  recoveryCode: "recovery-1",
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

  it("lists group orders with cents-first totals", async () => {
    const service = createService();
    (service as any).db = createDb([
      [{ ...baseGroupOrder, totalAmount: 99, totalAmountCents: 12345 }],
      [hostMember],
      [],
    ]);

    await expect(service.listGroupOrders("restaurant-1")).resolves.toEqual([
      expect.objectContaining({
        id: "group-1",
        hostName: "Host",
        memberCount: 1,
        totalAmount: 123.45,
        subtotal: 123.45,
      }),
    ]);
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
          menuItemPrice: 999,
          menuItemPriceCents: 1250,
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
          totalAmountCents: 4500,
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

  it("returns empty lists when no rows exist or list queries fail", async () => {
    const service = createService();
    service.db = createDb([[]]);

    await expect(service.listGroupOrders("restaurant-1")).resolves.toEqual([]);

    service.db = {
      select: vi.fn(() => {
        throw new Error("db down");
      }),
    };
    await expect(
      service.listGroupOrders("restaurant-1", "active"),
    ).resolves.toEqual([]);
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
        recoveryCode: "uuid-2",
        host: { id: "uuid-2", memberName: "Host" },
      },
    });
    expect(db.inserts[0].payload).toMatchObject({
      id: "uuid-1",
      restaurantId: "restaurant-1",
      recoveryCode: "uuid-2",
      settings: {
        maxMembers: 6,
        tableNumber: "T1",
        permissions: { canModifyOthersCart: true },
        fulfillmentType: "dine_in",
        autoSubmitOnExpiry: true,
      },
    });
    expect(db.inserts[1].payload).toMatchObject({
      id: "uuid-3",
      name: "Ada",
      role: "creator",
    });
    expect(db.inserts[2].payload).toMatchObject({
      id: "uuid-5",
      action: "group_created",
    });
    const cached = JSON.parse(values.get("group_order:uuid-1") ?? "{}");
    expect(cached).toMatchObject({ shareCode: "AAAAAAAA" });
    expect(cached).not.toHaveProperty("memberToken");
    expect(cached).not.toHaveProperty("recoveryCode");
    expect(values.get("share_code:AAAAAAAA")).toBe('"uuid-1"');
    vi.mocked(Math.random).mockRestore();
  });

  it("creates guest-hosted group orders with nullable createdBy and fulfillment settings", async () => {
    const service = createService();
    const db = createDb([[{ ...hostMember, id: "uuid-3" }]]);
    service.db = db;

    const result = await service.createGroupOrder(
      {
        restaurantId: "restaurant-1",
        fulfillmentType: "delivery",
        deliveryAddress: { line1: "1 Example Rd" },
        autoSubmitOnExpiry: false,
      },
      null,
    );

    expect(result.success).toBe(true);
    expect(result.data?.recoveryCode).toBe("uuid-2");
    expect(db.inserts[0].payload).toMatchObject({
      createdBy: null,
      recoveryCode: "uuid-2",
      settings: expect.objectContaining({
        maxMembers: 30,
        fulfillmentType: "delivery",
        deliveryAddress: { line1: "1 Example Rd" },
        autoSubmitOnExpiry: false,
      }),
    });
  });

  it("defaults expiresAt to 45 minutes when no expiration is provided", async () => {
    const service = createService();
    service.db = createDb([[{ ...hostMember, id: "uuid-3" }]]);

    const result = await service.createGroupOrder(
      { restaurantId: "restaurant-1" },
      null,
    );

    expect(result.success).toBe(true);
    expect(result.data?.expiresAt.getTime()).toBe(
      new Date("2026-06-07T00:45:00.000Z").getTime(),
    );
  });

  it("previews a group order without write, cache, or activity side effects", async () => {
    const { kv } = createKV();
    const service = new GroupOrdersService({} as D1Database, kv) as any;
    const db = createDb([
      [
        {
          ...baseGroupOrder,
          settings: { fulfillmentType: "pickup" },
        },
      ],
      [hostMember, { ...hostMember, id: "member-2", role: "member" }],
    ]);
    service.db = db;

    await expect(service.previewGroupByShareCode("ABC12345")).resolves.toEqual({
      found: true,
      data: expect.objectContaining({
        groupOrderId: "group-1",
        hostName: "Host",
        memberCount: 2,
        fulfillmentType: "pickup",
      }),
    });

    expect(db.inserts).toEqual([]);
    expect(db.updates).toEqual([]);
    expect(kv.put).not.toHaveBeenCalled();
  });

  it("returns found false for missing join previews", async () => {
    const service = createService();
    service.db = createDb([[]]);

    await expect(service.previewGroupByShareCode("NOPE0000")).resolves.toEqual({
      found: false,
    });
  });

  it("surfaces database failures instead of reporting the group order as missing", async () => {
    const service = createService();
    const db = createDb();
    db.select = vi.fn(() => {
      throw new Error("D1_UNAVAILABLE");
    });
    service.db = db;
    const logError = vi.fn();
    service.errorTracker = { ...service.errorTracker, logError };

    // Resolving to { found: false } here would make the route answer 404
    // "not found or expired" during an outage — wrong for the member reading
    // it, and invisible to alerting.
    await expect(service.previewGroupByShareCode("ABC12345")).rejects.toThrow(
      "D1_UNAVAILABLE",
    );

    expect(logError).toHaveBeenCalledWith(
      "previewGroupByShareCode",
      expect.any(Error),
      expect.objectContaining({ shareCode: "ABC12345" }),
    );
  });

  it("narrows a known group order status straight through", () => {
    const service = createService();
    for (const status of ["active", "checkout", "completed", "cancelled"]) {
      expect(service.narrowStatus(status, "go-1")).toBe(status);
    }
  });

  it("falls back to active and reports a status the service never writes", () => {
    const service = createService();
    const logError = vi.fn();
    service.errorTracker = { ...service.errorTracker, logError };

    // "ordering" was a valid value under the legacy CHECK constraint. The
    // column is plain TEXT, so a bare `as GroupOrderStatus` would have let it
    // through wearing a type it does not satisfy.
    expect(service.narrowStatus("ordering", "go-1")).toBe("active");

    expect(logError).toHaveBeenCalledWith(
      "formatGroupOrder",
      expect.any(Error),
      expect.objectContaining({ groupOrderId: "go-1", status: "ordering" }),
    );
  });

  it("recovers the host session and replaces the previous member token", async () => {
    const service = createService();
    const db = createDb([
      [baseGroupOrder],
      [{ ...hostMember, id: "member-1" }],
    ]);
    service.db = db;

    await expect(
      service.recoverHost("group-1", "recovery-1"),
    ).resolves.toMatchObject({
      success: true,
      data: { memberToken: "uuid-1" },
    });

    expect(db.updates[0].payload).toMatchObject({ sessionId: "uuid-1" });
    expect(db.inserts[0].payload).toMatchObject({
      action: "member_joined",
      metadata: { recovered: true },
    });
  });

  it("uses the same recovery failure for wrong code, missing group, and missing creator", async () => {
    const service = createService();

    service.db = createDb([[]]);
    await expect(service.recoverHost("group-1", "wrong")).resolves.toEqual({
      success: false,
      error: "Invalid recovery code",
    });

    service.db = createDb([[]]);
    await expect(service.recoverHost("missing", "recovery-1")).resolves.toEqual(
      {
        success: false,
        error: "Invalid recovery code",
      },
    );

    service.db = createDb([[baseGroupOrder], []]);
    await expect(service.recoverHost("group-1", "recovery-1")).resolves.toEqual(
      {
        success: false,
        error: "Invalid recovery code",
      },
    );
  });

  it("does not recover inactive or expired group orders", async () => {
    const service = createService();
    service.db = createDb([[]]);

    await expect(
      service.recoverHost("completed-group", "recovery-1"),
    ).resolves.toEqual({
      success: false,
      error: "Invalid recovery code",
    });
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

  it("returns join errors for missing groups and database failures", async () => {
    const service = createService();
    service.db = createDb([[]]);

    await expect(
      service.joinGroup("MISSING", { memberName: "Lin" }),
    ).resolves.toEqual({
      success: false,
      error: "Group order not found or expired",
    });

    service.db = {
      select: vi.fn(() => {
        throw new Error("db down");
      }),
    };
    await expect(
      service.joinGroup("ABC12345", { memberName: "Lin" }),
    ).resolves.toEqual({
      success: false,
      error: "Failed to join group",
    });
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
      specialInstructions: "Extra soup",
    });
  });

  it("handles cart add validation, fallback response, and update errors", async () => {
    const missingGroupService = createService();
    missingGroupService.db = createDb([[]]);
    await expect(
      missingGroupService.addCartItem("group-1", {
        memberId: "member-1",
        menuItemId: 10,
        quantity: 1,
      }),
    ).resolves.toEqual({ success: false, error: "Group order not found" });

    const inactiveGroupService = createService();
    inactiveGroupService.db = createDb([
      [{ ...baseGroupOrder, status: "checkout" }],
    ]);
    await expect(
      inactiveGroupService.addCartItem("group-1", {
        memberId: "member-1",
        menuItemId: 10,
        quantity: 1,
      }),
    ).resolves.toEqual({
      success: false,
      error: "Group order is not active",
    });

    const expiredGroupService = createService();
    expiredGroupService.db = createDb([
      [{ ...baseGroupOrder, expiresAt: new Date("2026-06-06T00:00:00Z") }],
    ]);
    await expect(
      expiredGroupService.addCartItem("group-1", {
        memberId: "member-1",
        menuItemId: 10,
        quantity: 1,
      }),
    ).resolves.toEqual({
      success: false,
      error: "Group order has expired",
    });

    const missingMemberService = createService();
    missingMemberService.db = createDb([[baseGroupOrder], []]);
    await expect(
      missingMemberService.addCartItem("group-1", {
        memberId: "member-1",
        menuItemId: 10,
        quantity: 1,
      }),
    ).resolves.toEqual({
      success: false,
      error: "Member not found in group",
    });

    const missingMenuService = createService();
    missingMenuService.db = createDb([[baseGroupOrder], [hostMember], []]);
    await expect(
      missingMenuService.addCartItem("group-1", {
        memberId: "member-1",
        menuItemId: 10,
        quantity: 1,
      }),
    ).resolves.toEqual({ success: false, error: "Menu item not found" });

    const fallbackService = createService();
    const fallbackDb = createDb([
      [baseGroupOrder],
      [hostMember],
      [
        {
          id: 10,
          restaurantId: "restaurant-1",
          name: "Laksa",
          price: 999,
          priceCents: 900,
        },
      ],
      [{ total: 9 }],
      [],
      [{ total: 9 }],
      [],
    ]);
    fallbackService.db = fallbackDb;
    await expect(
      fallbackService.addCartItem("group-1", {
        memberId: "member-1",
        menuItemId: 10,
        quantity: 1,
      }),
    ).resolves.toMatchObject({
      success: true,
      data: { id: "uuid-1", totalPrice: 9 },
    });

    const updateMissingService = createService();
    updateMissingService.db = createDb([[]]);
    await expect(
      updateMissingService.updateCartItem("group-1", "item-1", {
        quantity: 2,
      }),
    ).resolves.toEqual({ success: false, error: "Cart item not found" });

    const updateFailureService = createService();
    updateFailureService.db = createDb([
      [
        {
          id: "item-1",
          groupOrderId: "group-1",
          memberId: "member-1",
          unitPrice: 9,
        },
      ],
      [{ total: 18 }],
      [],
      [{ total: 18 }],
      [],
    ]);
    await expect(
      updateFailureService.updateCartItem("group-1", "item-1", {
        quantity: 2,
        customizations: { spice: "mild" },
      }),
    ).resolves.toEqual({
      success: false,
      error: "Failed to update cart item",
    });
  });

  it("removes cart items and reports missing or failed removals", async () => {
    const missingService = createService();
    missingService.db = createDb([[]]);
    await expect(
      missingService.removeCartItem("group-1", "item-1", "member-1"),
    ).resolves.toEqual({
      success: false,
      error: "Cart item not found or not owned by member",
    });

    const service = createService();
    const db = createDb([
      [
        {
          id: "item-1",
          groupOrderId: "group-1",
          memberId: "member-1",
        },
      ],
      [{ total: 0 }],
      [],
      [{ total: 0 }],
    ]);
    service.db = db;
    await expect(
      service.removeCartItem("group-1", "item-1", "member-1"),
    ).resolves.toEqual({ success: true });
    expect(db.deletes).toHaveLength(1);
    expect(db.inserts.at(-1)?.payload).toMatchObject({
      action: "item_removed",
      metadata: { itemId: "item-1" },
    });

    const failingService = createService();
    failingService.db = {
      select: vi.fn(() => {
        throw new Error("db down");
      }),
    };
    await expect(
      failingService.removeCartItem("group-1", "item-1", "member-1"),
    ).resolves.toEqual({
      success: false,
      error: "Failed to remove cart item",
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

  it("splits bills by item or custom amounts and validates split inputs", async () => {
    const byItemService = createService();
    const byItemDb = createDb([
      [baseGroupOrder],
      [hostMember, { ...hostMember, id: "member-2", role: "member" }],
      [
        {
          id: "cart-1",
          groupOrderId: "group-1",
          memberId: "member-1",
          menuItemId: 10,
          quantity: 2,
          unitPrice: 999,
          unitPriceCents: 900,
          totalPrice: 999,
          totalPriceCents: 1800,
          status: "active",
        },
      ],
      [{ id: "split-1" }],
      [],
      [],
    ]);
    byItemService.db = byItemDb;
    await expect(
      byItemService.splitBill("group-1", {
        splitType: "by_item",
        serviceChargeRate: 10,
      }),
    ).resolves.toMatchObject({
      success: true,
      data: [
        {
          memberId: "member-1",
          subtotal: 18,
          serviceCharge: 1.8,
          items: [{ cartItemId: "cart-1", quantity: 2 }],
        },
        { memberId: "member-2", subtotal: 0 },
      ],
    });
    expect(byItemDb.updates[1].payload).toMatchObject({
      splitType: "individual",
    });
    expect(byItemDb.updates[1].payload.finalAmountCents).toBe(1980);

    const customService = createService();
    const customDb = createDb([[baseGroupOrder], [hostMember], [], []]);
    customService.db = customDb;
    await expect(
      customService.splitBill("group-1", {
        splitType: "custom",
        customAmounts: [{ memberId: "member-1", amount: 12.34 }],
      }),
    ).resolves.toMatchObject({
      success: true,
      data: [{ memberId: "member-1", totalAmount: 12.34 }],
    });

    const guards = [
      { db: createDb([[]]), error: "Group order not found" },
      {
        db: createDb([[{ ...baseGroupOrder, status: "completed" }]]),
        error: "Group order is already finalized",
      },
      {
        db: createDb([[baseGroupOrder], []]),
        error: "No active members found",
      },
      {
        db: createDb([[baseGroupOrder], [hostMember], []]),
        body: { splitType: "custom" },
        error: "Custom amounts are required for custom split type",
      },
      {
        db: createDb([[baseGroupOrder], [hostMember], []]),
        body: {
          splitType: "custom",
          customAmounts: [{ memberId: "missing", amount: 1 }],
        },
        error: "Member missing not found in group",
      },
      {
        db: createDb([[baseGroupOrder], [hostMember], []]),
        body: { splitType: "unsupported" },
        error: "Unsupported split type: unsupported",
      },
    ];

    for (const guard of guards) {
      const service = createService();
      service.db = guard.db;
      await expect(
        service.splitBill("group-1", guard.body ?? { splitType: "equal" }),
      ).resolves.toEqual({ success: false, error: guard.error });
    }
  });

  it("validates payment guards and leaves checkout open while others owe", async () => {
    const guards = [
      { db: createDb([[]]), error: "Group order not found" },
      {
        db: createDb([[baseGroupOrder], []]),
        error: "Member not found in group",
      },
      {
        db: createDb([[baseGroupOrder], [hostMember], []]),
        error: "Split bill not found for member. Please split the bill first.",
      },
      {
        db: createDb([
          [baseGroupOrder],
          [hostMember],
          [{ id: "split-1", paymentStatus: "paid" }],
        ]),
        error: "Payment already processed for this member",
      },
      {
        db: createDb([
          [baseGroupOrder],
          [hostMember],
          [
            {
              id: "split-1",
              totalAmount: 10,
              totalAmountCents: 1000,
              paymentStatus: "pending",
            },
          ],
        ]),
        amount: 9,
        error: "Payment amount (9) does not match split bill amount (10)",
      },
    ];

    for (const guard of guards) {
      const service = createService();
      service.db = guard.db;
      await expect(
        service.processPayment("group-1", "member-1", {
          paymentMethod: "cash",
          amount: guard.amount,
        }),
      ).resolves.toEqual({ success: false, error: guard.error });
    }

    const service = createService();
    const db = createDb([
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
      [{ count: 1 }],
    ]);
    service.db = db;

    await expect(
      service.processPayment("group-1", "member-1", {
        paymentMethod: "card",
        paymentDetails: { terminalId: "pos-1" },
      }),
    ).resolves.toMatchObject({
      success: true,
      data: {
        transactionId: "TXN-1780790400000-uuid-1",
        groupOrderStatus: "checkout",
      },
    });
    expect(db.updates).toHaveLength(1);
    expect(JSON.parse(db.updates[0].payload.paymentReference)).toMatchObject({
      transactionId: "TXN-1780790400000-uuid-1",
      method: "card",
      details: { terminalId: "pos-1" },
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

  it("allows members to leave active groups and validates leave edge cases", async () => {
    const missingGroupService = createService();
    missingGroupService.db = createDb([[]]);
    await expect(
      missingGroupService.leaveGroup("group-1", "member-1"),
    ).resolves.toEqual({
      success: false,
      error: "Group order not found",
    });

    const missingMemberService = createService();
    missingMemberService.db = createDb([[baseGroupOrder], []]);
    await expect(
      missingMemberService.leaveGroup("group-1", "member-1"),
    ).resolves.toEqual({
      success: false,
      error: "Member not found in group",
    });

    const hostBlockedService = createService();
    hostBlockedService.db = createDb([
      [baseGroupOrder],
      [hostMember],
      [hostMember, { ...hostMember, id: "member-2", role: "member" }],
    ]);
    await expect(
      hostBlockedService.leaveGroup("group-1", "member-1"),
    ).resolves.toEqual({
      success: false,
      error: "Host cannot leave while other members are still active",
    });

    const service = createService();
    const db = createDb([
      [baseGroupOrder],
      [{ ...hostMember, id: "member-2", role: "member", name: "Lin" }],
      [hostMember, { ...hostMember, id: "member-2", role: "member" }],
      [{ total: 0 }],
      [],
      [{ total: 0 }],
    ]);
    service.db = db;
    await expect(service.leaveGroup("group-1", "member-2")).resolves.toEqual({
      success: true,
    });
    expect(db.updates[0].payload).toMatchObject({
      isActive: false,
      leftAt: new Date("2026-06-07T00:00:00.000Z"),
    });
    expect(db.updates[1].payload).toMatchObject({ status: "removed" });
    expect(db.inserts[1].payload).toMatchObject({
      action: "member_left",
      description: "Lin left the group",
    });

    const failingService = createService();
    failingService.db = {
      select: vi.fn(() => {
        throw new Error("db down");
      }),
    };
    await expect(
      failingService.leaveGroup("group-1", "member-1"),
    ).resolves.toEqual({
      success: false,
      error: "Failed to leave group",
    });
  });

  it("reports cleanup item errors and top-level cleanup failures", async () => {
    const service = createService();
    const db = createDb([
      [
        { id: "group-1", shareCode: "ABC12345", expiresAt: new Date() },
        { id: "group-2", shareCode: "XYZ12345", expiresAt: new Date() },
      ],
    ]);
    const originalUpdate = db.update;
    let updateAttempts = 0;
    db.update = vi.fn((table: unknown) => {
      updateAttempts += 1;
      if (updateAttempts === 1) {
        return {
          set: vi.fn(() => ({
            where: vi.fn(async () => {
              throw new Error("update failed");
            }),
          })),
        };
      }
      return originalUpdate(table);
    }) as any;
    service.db = db;

    await expect(service.cleanupExpiredGroups()).resolves.toEqual({
      cleaned: 1,
      errors: ["group-1: update failed"],
    });

    const failingService = createService();
    failingService.db = {
      select: vi.fn(() => {
        throw new Error("select failed");
      }),
    };
    await expect(failingService.cleanupExpiredGroups()).resolves.toEqual({
      cleaned: 0,
      errors: ["select failed"],
    });
  });

  it("keeps statistics usable when independent aggregate queries reject", async () => {
    const service = createService();
    const rejectQuery = (message: string) => {
      const builder = {
        from: vi.fn(() => builder),
        where: vi.fn(() => builder),
        then: (
          resolve: (value: unknown) => void,
          reject?: (reason: unknown) => void,
        ) => Promise.reject(new Error(message)).then(resolve, reject),
      };
      return builder;
    };
    service.db = {
      select: vi
        .fn()
        .mockImplementationOnce(() => rejectQuery("counts failed"))
        .mockImplementationOnce(() => rejectQuery("active failed"))
        .mockImplementationOnce(() => rejectQuery("avg size failed"))
        .mockImplementationOnce(() => rejectQuery("avg value failed")),
    };

    await expect(service.getStatistics(undefined, "quarter")).resolves.toEqual({
      totalGroupOrders: 0,
      activeGroupOrders: 0,
      averageGroupSize: 0,
      averageOrderValue: 0,
      popularTimeSlots: [],
      conversionRate: 0,
      paymentMethodDistribution: {},
    });
  });
});
