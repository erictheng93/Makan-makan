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

function createDb(
  selectResults: unknown[] = [],
  updateResults: unknown[] = [],
) {
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
        where: vi.fn(() => builder),
        returning: vi.fn(async () => updateResults.shift() ?? []),
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

const secondMember = { ...hostMember, id: "member-2", role: "member" };
const thirdMember = { ...hostMember, id: "member-3", role: "member" };

const finalizedOrder = {
  id: "order-1",
  subtotal: 30,
  serviceCharge: 6,
  taxAmount: 3,
  totalAmount: 39,
  status: "pending",
  paymentStatus: "pending",
};

function cartItem(
  id: string,
  memberId: string,
  totalPriceCents: number,
  quantity = 1,
) {
  return {
    id,
    groupOrderId: "group-1",
    memberId,
    menuItemId: Number(id.replace(/\D/g, "")) || 10,
    quantity,
    unitPriceCents: Math.round(totalPriceCents / quantity),
    totalPriceCents,
    status: "active",
    customizations: {},
  };
}

function createSplitDb({
  members,
  items = [],
  existingBills = [],
}: {
  members: unknown[];
  items?: unknown[];
  existingBills?: unknown[][];
}) {
  return createDb([
    [baseGroupOrder],
    members,
    items,
    ...members.map((_, index) => existingBills[index] ?? []),
  ]);
}

function totalCents(result: { totalAmount: number }[]) {
  return result.reduce(
    (sum, bill) => sum + Math.round(bill.totalAmount * 100),
    0,
  );
}

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
        // A table that never pressed submit should not have an order placed
        // for it. Expiry cancels by default; the host opts in to the opposite.
        autoSubmitOnExpiry: false,
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

  /**
   * The toggle rewrites one key inside a JSON column. Everything else in
   * `settings` — the member cap, the permission flags, the delivery address —
   * has to survive, because losing any of it silently changes how the group
   * behaves in ways nobody asked for.
   */
  it("flips auto-submit without disturbing the rest of the settings", async () => {
    const service = createService();
    const db = createDb([
      [
        {
          id: "group-1",
          settings: {
            maxMembers: 8,
            fulfillmentType: "delivery",
            deliveryAddress: { line1: "1 Example Rd" },
            autoSubmitOnExpiry: false,
          },
        },
      ],
    ]);
    service.db = db;

    await expect(
      service.setAutoSubmitOnExpiry("group-1", true),
    ).resolves.toMatchObject({ success: true });

    expect(db.updates.at(-1)?.payload).toMatchObject({
      settings: {
        maxMembers: 8,
        fulfillmentType: "delivery",
        deliveryAddress: { line1: "1 Example Rd" },
        autoSubmitOnExpiry: true,
      },
    });
  });

  /**
   * Choosing how the bill will be split is a preference, not an action.
   * `splitBill` is the action — it sets status to `checkout` and stamps
   * `lockedAt`, ending ordering for the whole table. Setting the preference
   * must touch neither, or picking "split equally" would silently stop
   * everyone from adding food.
   */
  it("stores the split preference without locking the group", async () => {
    const service = createService();
    const db = createDb([[{ id: "group-1", status: "active" }]]);
    service.db = db;

    await expect(
      service.setSplitType("group-1", "equal"),
    ).resolves.toMatchObject({ success: true });

    const written = db.updates.at(-1)?.payload as Record<string, unknown>;
    expect(written).toMatchObject({ splitType: "equal" });
    expect(written).not.toHaveProperty("status");
    expect(written).not.toHaveProperty("lockedAt");
  });

  /**
   * The column stores `individual`; the client calls the same thing `by_item`.
   * `splitBill` already maps one to the other, so the preference has to be
   * written in the same vocabulary or finalize would split by a mode the host
   * never chose.
   */
  it("stores by_item using the value the column expects", async () => {
    const service = createService();
    const db = createDb([[{ id: "group-1", status: "active" }]]);
    service.db = db;

    await service.setSplitType("group-1", "by_item");

    expect(db.updates.at(-1)?.payload).toMatchObject({
      splitType: "individual",
    });
  });

  it("refuses to set a split preference on a group order that is gone", async () => {
    const service = createService();
    service.db = createDb([[]]);

    await expect(
      service.setSplitType("missing", "equal"),
    ).resolves.toMatchObject({ success: false });
  });

  /**
   * The stored preference has to reach the client, or the selector renders
   * whatever its fallback is and the host sees a mode they never picked. The
   * column speaks `individual`; the client speaks `by_item`.
   */
  it("carries the split preference out to the client as by_item", () => {
    const service = createService();

    expect(
      service.formatGroupOrder({
        ...baseGroupOrder,
        id: "group-1",
        splitType: "individual",
      }),
    ).toMatchObject({ splitType: "by_item" });
  });

  it("carries equal and proportional through unchanged", () => {
    const service = createService();

    expect(
      service.formatGroupOrder({ ...baseGroupOrder, splitType: "equal" }),
    ).toMatchObject({ splitType: "equal" });
    expect(
      service.formatGroupOrder({
        ...baseGroupOrder,
        splitType: "proportional",
      }),
    ).toMatchObject({ splitType: "proportional" });
  });

  it("refuses to flip auto-submit on a group order that is gone", async () => {
    const service = createService();
    service.db = createDb([[]]);

    await expect(
      service.setAutoSubmitOnExpiry("missing", true),
    ).resolves.toMatchObject({ success: false });
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

  it("narrows raw statuses returned by list and join preview endpoints", async () => {
    const service = createService();
    const logError = vi.fn();
    service.errorTracker = { ...service.errorTracker, logError };
    service.db = createDb([
      [{ ...baseGroupOrder, status: "ordering" }],
      [hostMember],
      [],
    ]);

    await expect(service.listGroupOrders("restaurant-1")).resolves.toEqual([
      expect.objectContaining({ id: "group-1", status: "active" }),
    ]);

    const previewService = createService();
    previewService.errorTracker = { ...previewService.errorTracker, logError };
    previewService.db = createDb([
      [{ ...baseGroupOrder, status: "ordering" }],
      [hostMember],
    ]);

    await expect(
      previewService.previewGroupByShareCode("ABC12345"),
    ).resolves.toEqual({
      found: true,
      data: expect.objectContaining({ status: "active" }),
    });
    expect(logError).toHaveBeenCalledWith(
      "formatGroupOrder",
      expect.any(Error),
      expect.objectContaining({ groupOrderId: "group-1", status: "ordering" }),
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
      error: "Cart item not found",
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

  /**
   * Members may clear each other's dishes off the shared cart, so the caller
   * and the item's owner are no longer the same person. Everything the
   * removal writes afterwards — the activity log, and the member total that
   * decides who owes what — has to follow the item, not whoever pressed the
   * button. Crediting the caller would quietly move a dish's cost onto them
   * and leave the real owner still charged for it.
   */
  it("credits a removal to the member whose item it was", async () => {
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
      service.removeCartItem("group-1", "item-1", "member-2"),
    ).resolves.toEqual({ success: true });

    expect(db.inserts.at(-1)?.payload).toMatchObject({
      action: "item_removed",
      memberId: "member-1",
    });
  });

  /**
   * `calculateOrderTotal` in the shared base service is what every ordinary
   * order goes through, so it defines what a rate means and what tax applies
   * to for this restaurant:
   *
   *   serviceCharge = subtotal * rate      (0.1 is 10%)
   *   tax           = subtotal * rate      (the subtotal, not subtotal + fee)
   *
   * splitBill used to read the same stored rate as a percentage and charge tax
   * on subtotal + service charge, so the identical cart cost more when ordered
   * as a group — and a restaurant that set serviceChargeRate to 0.1 for its
   * normal orders would have billed group members 0.1% instead of 10%.
   */
  /**
   * Who carries the service charge and tax is a separate question from how the
   * food is divided, and the host answers it when opening the group:
   *
   *   proportional — each member pays fees on what they ordered (the default,
   *                  and what every group order did before there was a choice)
   *   equal        — the fees are divided by headcount, so a light eater
   *                  subsidises a heavy one
   *   host         — the host picks up all of it and nobody else sees a fee
   *
   * Same cart in all three: member-1 (the host) ordered 10, member-2 ordered
   * 30, and a 10% service charge means 4 to place somewhere.
   */
  /**
   * The host can change their mind while the table is still ordering, the same
   * way they can change the split method. Like that one it records a choice —
   * it must not lock the group, and it must not lose the rest of `settings`.
   */
  it("changes the fee choice without locking the group or losing settings", async () => {
    const service = createService();
    const db = createDb([
      [
        {
          id: "group-1",
          settings: { maxMembers: 8, autoSubmitOnExpiry: true },
        },
      ],
    ]);
    service.db = db;

    await expect(service.setFeeMode("group-1", "equal")).resolves.toMatchObject(
      { success: true },
    );

    const written = db.updates.at(-1)?.payload as Record<string, unknown>;
    expect(written).toMatchObject({
      settings: {
        maxMembers: 8,
        autoSubmitOnExpiry: true,
        feeMode: "equal",
      },
    });
    expect(written).not.toHaveProperty("status");
    expect(written).not.toHaveProperty("lockedAt");
  });

  it("refuses to change the fee choice on a group order that is gone", async () => {
    const service = createService();
    service.db = createDb([[]]);

    await expect(service.setFeeMode("missing", "host")).resolves.toMatchObject({
      success: false,
    });
  });

  it("carries the fee choice out to the client", () => {
    const service = createService();

    expect(
      service.formatGroupOrder({
        ...baseGroupOrder,
        settings: { feeMode: "host" },
      }),
    ).toMatchObject({ feeMode: "host" });

    // Absence means the mode every older group was charged under.
    expect(service.formatGroupOrder(baseGroupOrder)).toMatchObject({
      feeMode: "proportional",
    });
  });

  it("keeps the host's fee choice from the moment the group is opened", async () => {
    const service = createService();
    const db = createDb([[{ ...hostMember, id: "uuid-3" }]]);
    service.db = db;

    await service.createGroupOrder(
      { restaurantId: "restaurant-1", feeMode: "host" },
      null,
    );

    expect(db.inserts[0].payload).toMatchObject({
      settings: expect.objectContaining({ feeMode: "host" }),
    });
  });

  it("defaults to charging each member on their own items", async () => {
    const service = createService();
    const db = createDb([[{ ...hostMember, id: "uuid-3" }]]);
    service.db = db;

    await service.createGroupOrder({ restaurantId: "restaurant-1" }, null);

    // Groups opened before the choice existed have no feeMode at all, and they
    // were all charged this way — so this is what absence has to mean.
    expect(db.inserts[0].payload).toMatchObject({
      settings: expect.objectContaining({ feeMode: "proportional" }),
    });
  });

  describe("who carries the service charge", () => {
    function feeSplitDb() {
      return createSplitDb({
        members: [hostMember, secondMember],
        items: [
          cartItem("cart-1", "member-1", 1000),
          cartItem("cart-2", "member-2", 3000),
        ],
      });
    }

    it("charges each member on their own items by default", async () => {
      const service = createService();
      service.db = feeSplitDb();

      await expect(
        service.splitBill("group-1", {
          splitType: "by_item",
          serviceChargeRate: 0.1,
        }),
      ).resolves.toMatchObject({
        success: true,
        data: [
          { memberId: "member-1", subtotal: 10, serviceCharge: 1 },
          { memberId: "member-2", subtotal: 30, serviceCharge: 3 },
        ],
      });
    });

    it("divides the fee by headcount when the host chose equal", async () => {
      const service = createService();
      service.db = feeSplitDb();

      await expect(
        service.splitBill("group-1", {
          splitType: "by_item",
          serviceChargeRate: 0.1,
          feeMode: "equal",
        }),
      ).resolves.toMatchObject({
        success: true,
        data: [
          { memberId: "member-1", subtotal: 10, serviceCharge: 2 },
          { memberId: "member-2", subtotal: 30, serviceCharge: 2 },
        ],
      });
    });

    it("puts the whole fee on the host when the host chose to absorb it", async () => {
      const service = createService();
      service.db = feeSplitDb();

      await expect(
        service.splitBill("group-1", {
          splitType: "by_item",
          serviceChargeRate: 0.1,
          feeMode: "host",
        }),
      ).resolves.toMatchObject({
        success: true,
        data: [
          { memberId: "member-1", subtotal: 10, serviceCharge: 4 },
          // Nothing beyond what they ate — this is the point of the mode.
          { memberId: "member-2", subtotal: 30, serviceCharge: 0 },
        ],
      });
    });

    /**
     * Finalize hands `splitBill` the real order's charges as absolute cents
     * rather than rates, so the same three answers have to come out of that
     * path too — otherwise the mode the host picked would apply right up until
     * the order was actually placed, and then quietly stop.
     */
    it("applies the same choice to the amounts finalize passes in", async () => {
      const service = createService();
      service.db = feeSplitDb();

      await expect(
        service.splitBill("group-1", {
          splitType: "by_item",
          feeMode: "host",
          sharedServiceChargeCents: 400,
          orderTotalCents: 4400,
        }),
      ).resolves.toMatchObject({
        success: true,
        data: [
          { memberId: "member-1", serviceCharge: 4 },
          { memberId: "member-2", serviceCharge: 0 },
        ],
      });
    });
  });

  it("reads rates and charges tax the way an ordinary order does", async () => {
    const service = createService();
    service.db = createSplitDb({
      members: [hostMember],
      items: [cartItem("cart-1", "member-1", 10000)],
    });

    await expect(
      service.splitBill("group-1", {
        splitType: "equal",
        serviceChargeRate: 0.1,
        taxRate: 0.05,
      }),
    ).resolves.toMatchObject({
      success: true,
      data: [
        {
          memberId: "member-1",
          subtotal: 100,
          serviceCharge: 10,
          // 5 — not 5.5, which is what taxing the service charge too gives.
          taxAmount: 5,
          totalAmount: 115,
        },
      ],
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
        serviceChargeRate: 0.1,
        taxRate: 0.05,
      }),
    ).resolves.toMatchObject({
      success: true,
      data: [
        {
          memberId: "member-1",
          subtotal: 20,
          serviceCharge: 2,
          taxAmount: 1,
          totalAmount: 23,
        },
        {
          memberId: "member-2",
          totalAmount: 23,
        },
      ],
    });
    expect(splitDb.inserts).toHaveLength(3);
    expect(splitDb.updates[0].payload).toMatchObject({
      status: "checkout",
      splitType: "equal",
      finalAmountCents: 4600,
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
          totalAmount: 23,
          totalAmountCents: 2300,
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
        amount: 23,
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
        serviceChargeRate: 0.1,
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

  it.each([
    {
      splitType: "individual",
      expected: [
        {
          memberId: "member-1",
          subtotal: 10,
          serviceCharge: 2,
          taxAmount: 1,
          totalAmount: 13,
        },
        {
          memberId: "member-2",
          subtotal: 20,
          serviceCharge: 4,
          taxAmount: 2,
          totalAmount: 26,
        },
      ],
    },
    {
      splitType: "proportional",
      expected: [
        {
          memberId: "member-1",
          subtotal: 10,
          serviceCharge: 2,
          taxAmount: 1,
          totalAmount: 13,
        },
        {
          memberId: "member-2",
          subtotal: 20,
          serviceCharge: 4,
          taxAmount: 2,
          totalAmount: 26,
        },
      ],
    },
    {
      splitType: "equal",
      expected: [
        {
          memberId: "member-1",
          subtotal: 15,
          serviceCharge: 3,
          taxAmount: 1.5,
          totalAmount: 19.5,
        },
        {
          memberId: "member-2",
          subtotal: 15,
          serviceCharge: 3,
          taxAmount: 1.5,
          totalAmount: 19.5,
        },
      ],
    },
  ])(
    "allocates non-zero shared fees for $splitType split",
    async ({ splitType, expected }) => {
      const service = createService();
      const db = createSplitDb({
        members: [hostMember, secondMember],
        items: [
          cartItem("cart-1", "member-1", 1000),
          cartItem("cart-2", "member-2", 2000),
        ],
      });
      service.db = db;

      await expect(
        service.splitBill("group-1", {
          splitType,
          sharedServiceChargeCents: 600,
          sharedTaxCents: 300,
          orderTotalCents: 3900,
        }),
      ).resolves.toMatchObject({
        success: true,
        data: expected,
      });
      expect(db.updates[0].payload).toMatchObject({
        finalAmountCents: 3900,
        serviceChargeCents: 600,
        taxAmountCents: 300,
      });
    },
  );

  it("allocates non-zero shared fees for custom split by custom amount ratio", async () => {
    const service = createService();
    const db = createSplitDb({
      members: [hostMember, secondMember],
      items: [
        cartItem("cart-1", "member-1", 1000),
        cartItem("cart-2", "member-2", 2000),
      ],
    });
    service.db = db;

    await expect(
      service.splitBill("group-1", {
        splitType: "custom",
        customAmounts: [
          { memberId: "member-1", amount: 5 },
          { memberId: "member-2", amount: 25 },
        ],
        sharedServiceChargeCents: 600,
        sharedTaxCents: 300,
        orderTotalCents: 3900,
      }),
    ).resolves.toMatchObject({
      success: true,
      data: [
        {
          memberId: "member-1",
          subtotal: 5,
          serviceCharge: 1,
          taxAmount: 0.5,
          totalAmount: 6.5,
        },
        {
          memberId: "member-2",
          subtotal: 25,
          serviceCharge: 5,
          taxAmount: 2.5,
          totalAmount: 32.5,
        },
      ],
    });
  });

  it("falls back to per-head shared fee allocation when ratio totals are zero", async () => {
    const emptyCartService = createService();
    emptyCartService.db = createSplitDb({
      members: [hostMember, secondMember],
    });

    await expect(
      emptyCartService.splitBill("group-1", {
        splitType: "proportional",
        sharedServiceChargeCents: 100,
        sharedTaxCents: 100,
        orderTotalCents: 200,
      }),
    ).resolves.toMatchObject({
      success: true,
      data: [
        {
          memberId: "member-1",
          subtotal: 0,
          serviceCharge: 0.5,
          taxAmount: 0.5,
          totalAmount: 1,
        },
        {
          memberId: "member-2",
          subtotal: 0,
          serviceCharge: 0.5,
          taxAmount: 0.5,
          totalAmount: 1,
        },
      ],
    });

    const zeroCustomService = createService();
    zeroCustomService.db = createSplitDb({
      members: [hostMember, secondMember],
    });

    await expect(
      zeroCustomService.splitBill("group-1", {
        splitType: "custom",
        customAmounts: [
          { memberId: "member-1", amount: 0 },
          { memberId: "member-2", amount: 0 },
        ],
        sharedServiceChargeCents: 100,
        sharedTaxCents: 100,
        orderTotalCents: 200,
      }),
    ).resolves.toMatchObject({
      success: true,
      data: [
        { memberId: "member-1", totalAmount: 1 },
        { memberId: "member-2", totalAmount: 1 },
      ],
    });
  });

  it("keeps proportional and individual equivalent while there are no fixed shared fees", async () => {
    const individualService = createService();
    individualService.db = createSplitDb({
      members: [hostMember, secondMember],
      items: [
        cartItem("cart-1", "member-1", 1000),
        cartItem("cart-2", "member-2", 2000),
      ],
    });
    const individual = await individualService.splitBill("group-1", {
      splitType: "individual",
      serviceChargeRate: 0.1,
      taxRate: 0.05,
    });

    const proportionalService = createService();
    proportionalService.db = createSplitDb({
      members: [hostMember, secondMember],
      items: [
        cartItem("cart-1", "member-1", 1000),
        cartItem("cart-2", "member-2", 2000),
      ],
    });
    const proportional = await proportionalService.splitBill("group-1", {
      splitType: "proportional",
      serviceChargeRate: 0.1,
      taxRate: 0.05,
    });

    // This equivalence only holds while every shared fee is proportional to
    // subtotal. A flat fee (delivery) would require the two to diverge.
    //
    // Read this as documentation, not as a tripwire: both split types now
    // route through the same branch in splitBill, so the assertion compares
    // one code path against itself and cannot fail. The warning that actually
    // has to be seen lives at that branch condition, next to the code someone
    // would be editing.
    expect(proportional.data).toEqual(individual.data);
  });

  it.each([
    {
      name: "three people evenly split $100",
      members: [hostMember, secondMember, thirdMember],
      items: [cartItem("cart-1", "member-1", 10000)],
      expectedTotalCents: 10000,
    },
    {
      name: "two people evenly split $0.01",
      members: [hostMember, secondMember],
      items: [cartItem("cart-1", "member-1", 1)],
      expectedTotalCents: 1,
    },
    {
      name: "member count greater than total cents",
      members: [hostMember, secondMember, thirdMember],
      items: [cartItem("cart-1", "member-1", 2)],
      expectedTotalCents: 2,
    },
  ])("reconciles rounding remainders for $name", async (scenario) => {
    const service = createService();
    const db = createSplitDb({
      members: scenario.members,
      items: scenario.items,
    });
    service.db = db;

    const result = await service.splitBill("group-1", {
      splitType: "equal",
    });

    expect(result.success).toBe(true);
    expect(totalCents(result.data)).toBe(scenario.expectedTotalCents);
    expect(
      db.inserts
        .filter((insert) => "totalAmountCents" in (insert.payload as object))
        .reduce(
          (sum, insert) =>
            sum +
            (insert.payload as { totalAmountCents: number }).totalAmountCents,
          0,
        ),
    ).toBe(scenario.expectedTotalCents);
  });

  it("applies positive and negative rounding remainders to the creator member", async () => {
    const positiveService = createService();
    positiveService.db = createSplitDb({
      members: [hostMember, secondMember, thirdMember],
    });
    const positive = await positiveService.splitBill("group-1", {
      splitType: "equal",
      sharedTaxCents: 10000,
      orderTotalCents: 10000,
    });
    expect(positive.data.find((bill) => bill.memberId === "member-1")).toEqual(
      expect.objectContaining({ totalAmount: 33.34 }),
    );

    const negativeService = createService();
    negativeService.db = createSplitDb({
      members: [hostMember, secondMember],
    });
    const negative = await negativeService.splitBill("group-1", {
      splitType: "equal",
      sharedTaxCents: 1,
      orderTotalCents: 1,
    });
    expect(negative.data.find((bill) => bill.memberId === "member-1")).toEqual(
      expect.objectContaining({ totalAmount: 0 }),
    );
  });

  it("keeps every split bill internally consistent after absorbing a remainder", async () => {
    const service = createService();
    service.db = createSplitDb({
      members: [hostMember, secondMember, thirdMember],
    });

    // $100 across three members does not divide evenly, so the creator absorbs
    // the leftover cent. split_bills stores subtotal, service charge and tax
    // as separate columns, so the adjustment has to reach a component too —
    // otherwise the creator receives a bill whose lines do not sum to what
    // they are charged.
    const result = await service.splitBill("group-1", {
      splitType: "equal",
      sharedTaxCents: 10000,
      orderTotalCents: 10000,
    });

    expect(result.success).toBe(true);
    for (const bill of result.data) {
      expect(
        Math.round((bill.subtotal + bill.serviceCharge + bill.taxAmount) * 100),
      ).toBe(Math.round(bill.totalAmount * 100));
    }
    expect(totalCents(result.data)).toBe(10000);
  });

  it("uses the external order total as the reconciliation baseline", async () => {
    const service = createService();
    const db = createSplitDb({
      members: [hostMember, secondMember],
      items: [
        cartItem("cart-1", "member-1", 1000),
        cartItem("cart-2", "member-2", 2000),
      ],
    });
    service.db = db;

    const result = await service.splitBill("group-1", {
      splitType: "proportional",
      sharedServiceChargeCents: 600,
      sharedTaxCents: 301,
      orderTotalCents: 3901,
    });

    expect(result.success).toBe(true);
    expect(totalCents(result.data)).toBe(3901);
    expect(db.updates[0].payload).toMatchObject({ finalAmountCents: 3901 });
  });

  it("rejects reconciliation mismatches beyond one cent per member", async () => {
    const service = createService();
    const logError = vi.fn();
    service.errorTracker = { ...service.errorTracker, logError };
    service.db = createSplitDb({
      members: [hostMember, secondMember],
      items: [
        cartItem("cart-1", "member-1", 1000),
        cartItem("cart-2", "member-2", 2000),
      ],
    });

    await expect(
      service.splitBill("group-1", {
        splitType: "proportional",
        orderTotalCents: 3900,
      }),
    ).resolves.toMatchObject({
      success: false,
      error: "Split total does not match order total",
      errorDetails: {
        code: "SPLIT_TOTAL_MISMATCH",
        expectedTotalCents: 3900,
        roundedTotalCents: 3000,
      },
    });
    expect(logError).toHaveBeenCalledWith(
      "splitBill",
      expect.any(Error),
      expect.objectContaining({
        code: "SPLIT_TOTAL_MISMATCH",
        expectedTotalCents: 3900,
      }),
    );
  });

  it("uses absolute shared cents instead of rates when both are provided", async () => {
    const service = createService();
    service.db = createSplitDb({
      members: [hostMember, secondMember],
      items: [
        cartItem("cart-1", "member-1", 1000),
        cartItem("cart-2", "member-2", 2000),
      ],
    });

    await expect(
      service.splitBill("group-1", {
        splitType: "individual",
        serviceChargeRate: 100,
        taxRate: 100,
        sharedServiceChargeCents: 600,
        sharedTaxCents: 300,
        orderTotalCents: 3900,
      }),
    ).resolves.toMatchObject({
      success: true,
      data: [
        { memberId: "member-1", serviceCharge: 2, taxAmount: 1 },
        { memberId: "member-2", serviceCharge: 4, taxAmount: 2 },
      ],
    });
  });

  describe("finalizeGroupOrder", () => {
    function createFinalizeService({
      groupOrder = baseGroupOrder,
      cartItems = [
        {
          ...cartItem("cart-10", "member-1", 1000, 2),
          specialInstructions: "No chili",
          customizations: { spice: "mild" },
        },
      ],
      claimRows = [{ id: "group-1" }],
      order = finalizedOrder,
      existingOrderRows = [],
    }: {
      groupOrder?: unknown;
      cartItems?: unknown[];
      claimRows?: unknown[];
      order?: Record<string, unknown>;
      existingOrderRows?: unknown[];
    } = {}) {
      const service = createService();
      const createOrder = vi.fn(async () => order);
      service.createOrderService = vi.fn(() => ({ createOrder }));
      service.splitBill = vi.fn(async () => ({ success: true, data: [] }));
      service.db = createDb(
        [[groupOrder], cartItems, existingOrderRows],
        [claimRows],
      );
      return { service, createOrder, db: service.db };
    }

    it("claims the finalizing mutex, creates a real order, records masterOrderId, and splits with real amounts", async () => {
      const { service, createOrder, db } = createFinalizeService({
        groupOrder: {
          ...baseGroupOrder,
          tableId: 5,
          splitType: "proportional",
          settings: { fulfillmentType: "dine_in", notes: "Table note" },
        },
      });

      await expect(service.finalizeGroupOrder("group-1")).resolves.toEqual({
        success: true,
        data: { masterOrderId: "order-1", status: "completed" },
      });

      expect(createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId: "restaurant-1",
          tableId: 5,
          orderType: "table",
          notes: "Table note",
          clientMutationId: "group-order:group-1",
          items: [
            {
              menuItemId: 10,
              quantity: 2,
              notes: "No chili",
            },
          ],
        }),
      );
      expect(createOrder.mock.calls[0][0].items[0]).not.toHaveProperty(
        "customizations",
      );
      expect(service.splitBill).toHaveBeenCalledWith("group-1", {
        splitType: "proportional",
        sharedServiceChargeCents: 600,
        sharedTaxCents: 300,
        orderTotalCents: 3900,
      });
      expect(db.updates.map((update) => update.payload)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ status: "finalizing" }),
          expect.objectContaining({
            masterOrderId: "order-1",
            status: "finalizing",
          }),
          expect.objectContaining({
            masterOrderId: "order-1",
            status: "completed",
          }),
        ]),
      );
    });

    it("is idempotent across sequential calls and duplicate client mutations", async () => {
      const { service, createOrder, db } = createFinalizeService({
        groupOrder: { ...baseGroupOrder, splitType: "individual" },
      });

      await expect(service.finalizeGroupOrder("group-1")).resolves.toEqual({
        success: true,
        data: { masterOrderId: "order-1", status: "completed" },
      });

      service.db = createDb([
        [{ ...baseGroupOrder, status: "completed", masterOrderId: "order-1" }],
      ]);

      await expect(service.finalizeGroupOrder("group-1")).resolves.toEqual({
        success: true,
        data: { masterOrderId: "order-1", status: "completed" },
      });
      expect(createOrder).toHaveBeenCalledTimes(1);
      expect(db.updates[0].payload).toEqual(
        expect.objectContaining({ status: "finalizing" }),
      );

      const duplicate = createFinalizeService({
        existingOrderRows: [
          {
            id: "order-1",
            serviceChargeCents: 600,
            taxAmountCents: 300,
            totalAmountCents: 3900,
          },
        ],
      });
      duplicate.createOrder.mockRejectedValueOnce(
        new Error("CLIENT_MUTATION_DUPLICATE"),
      );

      await expect(
        duplicate.service.finalizeGroupOrder("group-1"),
      ).resolves.toEqual({
        success: true,
        data: { masterOrderId: "order-1", status: "completed" },
      });
      expect(duplicate.service.splitBill).toHaveBeenCalledWith("group-1", {
        splitType: "individual",
        sharedServiceChargeCents: 600,
        sharedTaxCents: 300,
        orderTotalCents: 3900,
      });
    });

    it("prevents concurrent finalizers from creating a second real order", async () => {
      const service = createService();
      const createOrder = vi.fn(async () => finalizedOrder);
      service.createOrderService = vi.fn(() => ({ createOrder }));
      service.splitBill = vi.fn(async () => ({ success: true, data: [] }));
      service.db = createDb(
        [
          [baseGroupOrder],
          [baseGroupOrder],
          [cartItem("cart-1", "member-1", 1000)],
          [cartItem("cart-1", "member-1", 1000)],
          [{ ...baseGroupOrder, status: "finalizing" }],
        ],
        [[{ id: "group-1" }], []],
      );

      const [first, second] = await Promise.all([
        service.finalizeGroupOrder("group-1"),
        service.finalizeGroupOrder("group-1"),
      ]);

      expect(first).toEqual({
        success: true,
        data: { masterOrderId: "order-1", status: "completed" },
      });
      expect(second).toEqual({
        success: false,
        error: "Group order is already being finalized",
      });
      expect(createOrder).toHaveBeenCalledTimes(1);
    });

    it("defines finalize boundaries for empty, completed, and cancelled groups", async () => {
      const empty = createFinalizeService({ cartItems: [] });
      await expect(
        empty.service.finalizeGroupOrder("group-1"),
      ).resolves.toEqual({
        success: false,
        error: "Cannot finalize an empty group order",
      });
      expect(empty.createOrder).not.toHaveBeenCalled();

      const completed = createFinalizeService({
        groupOrder: {
          ...baseGroupOrder,
          status: "completed",
          masterOrderId: "order-1",
        },
      });
      await expect(
        completed.service.finalizeGroupOrder("group-1"),
      ).resolves.toEqual({
        success: true,
        data: { masterOrderId: "order-1", status: "completed" },
      });
      expect(completed.createOrder).not.toHaveBeenCalled();

      const cancelled = createFinalizeService({
        groupOrder: { ...baseGroupOrder, status: "cancelled" },
      });
      await expect(
        cancelled.service.finalizeGroupOrder("group-1"),
      ).resolves.toEqual({
        success: false,
        error: "Group order is cancelled, cannot finalize",
      });
      expect(cancelled.createOrder).not.toHaveBeenCalled();
    });

    it.each([
      {
        fulfillmentType: "pickup",
        expectedOrderType: "shop",
        expectedDeliveryType: "takeaway",
      },
      {
        fulfillmentType: "delivery",
        expectedOrderType: "shop",
        expectedDeliveryType: "delivery",
      },
    ])(
      "maps $fulfillmentType fulfillment when creating the real order",
      async ({ fulfillmentType, expectedOrderType, expectedDeliveryType }) => {
        const { service, createOrder } = createFinalizeService({
          groupOrder: {
            ...baseGroupOrder,
            tableId: null,
            settings: {
              fulfillmentType,
              pickupAt: "2026-06-07T12:30:00.000Z",
              deliveryAddress: {
                line1: "1 Main St",
                line2: "Unit 2",
                contactPhone: "+886912345678",
                notes: "Ring bell",
              },
            },
          },
        });

        await service.finalizeGroupOrder("group-1");

        expect(createOrder).toHaveBeenCalledWith(
          expect.objectContaining({
            orderType: expectedOrderType,
            deliveryInfo: expect.objectContaining({
              type: expectedDeliveryType,
              address: "1 Main St, Unit 2",
              phone: "+886912345678",
            }),
          }),
        );
      },
    );

    it("keeps the master order id and marks finalizing_failed when split billing fails after order creation", async () => {
      const { service, db } = createFinalizeService();
      service.splitBill = vi.fn(async () => ({
        success: false,
        error: "Split total does not match order total",
        errorDetails: {
          code: "SPLIT_TOTAL_MISMATCH",
          expectedTotalCents: 3900,
          roundedTotalCents: 3000,
        },
      }));

      await expect(service.finalizeGroupOrder("group-1")).resolves.toEqual({
        success: false,
        error: "Split total does not match order total",
      });

      expect(db.updates.map((update) => update.payload)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            masterOrderId: "order-1",
            status: "finalizing_failed",
            settings: expect.objectContaining({
              finalizeFailure: expect.objectContaining({
                masterOrderId: "order-1",
                orderTotalCents: 3900,
                expectedTotalCents: 3900,
                roundedTotalCents: 3000,
                splitError: "Split total does not match order total",
              }),
            }),
          }),
        ]),
      );
    });
  });

  describe("processPayment — Plan A manual settlement", () => {
    it("marks a member's split bill paid with paymentMethod cash and no real gateway involved", async () => {
      const service = createService();
      const db = createDb([
        [{ ...baseGroupOrder, status: "checkout" }],
        [hostMember],
        [
          {
            id: "split-1",
            groupOrderId: "group-1",
            memberId: "member-1",
            totalAmountCents: 3300,
            paymentStatus: "pending",
          },
        ],
        [{ count: 1 }],
      ]);
      service.db = db;

      await expect(
        service.processPayment("group-1", "member-1", {
          paymentMethod: "cash",
        }),
      ).resolves.toMatchObject({
        success: true,
        data: { paymentMethod: "cash", amount: 33 },
      });
      expect(db.updates[0].payload).toMatchObject({
        paymentStatus: "paid",
        paymentMethod: "cash",
      });
      expect(db.updates).toHaveLength(1);
    });

    it("flips the group order to completed once every member's split bill is paid", async () => {
      const service = createService();
      const db = createDb([
        [{ ...baseGroupOrder, status: "checkout" }],
        [hostMember],
        [
          {
            id: "split-1",
            groupOrderId: "group-1",
            memberId: "member-1",
            totalAmountCents: 3300,
            paymentStatus: "pending",
          },
        ],
        [{ count: 0 }],
      ]);
      service.db = db;

      await expect(
        service.processPayment("group-1", "member-1", {
          paymentMethod: "cash",
        }),
      ).resolves.toMatchObject({
        success: true,
        data: { groupOrderStatus: "completed" },
      });
      expect(db.updates[1].payload).toMatchObject({
        status: "completed",
      });
    });
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

  it("validates host sessions by creator member token and fails closed on lookup errors", async () => {
    const service = createService();
    service.db = createDb([[{ id: "member-1" }]]);

    await expect(
      service.isHostSession("group-1", "host-session"),
    ).resolves.toBe(true);

    const memberService = createService();
    memberService.db = createDb([[]]);
    await expect(
      memberService.isHostSession("group-1", "member-session"),
    ).resolves.toBe(false);

    const failingService = createService();
    failingService.db = {
      select: vi.fn(() => {
        throw new Error("db down");
      }),
    };
    await expect(
      failingService.isHostSession("group-1", "host-session"),
    ).resolves.toBe(false);
  });
});

/**
 * The customer app renders a cart row from `menuItem.name`. `getGroupOrder`
 * supplies it, but `addCartItem` and `updateCartItem` did not — so an item
 * arriving over realtime, or the response to your own add, rendered as a price
 * with no dish beside it until the page was reloaded.
 *
 * Both methods already look the menu item up in order to price the row, so the
 * name is in hand; it was simply left out of the payload. These pin the shape
 * to the one `getGroupOrder` already returns, because two shapes for the same
 * row is how the mismatch started.
 */
describe("cart mutations return a renderable row", () => {
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

  const menuItemRow = {
    id: 10,
    restaurantId: "restaurant-1",
    name: "Laksa",
    price: 9,
    priceCents: 1250,
    imageUrl: "https://cdn.test/laksa.jpg",
  };

  const storedCartItem = {
    id: "uuid-1",
    groupOrderId: "group-1",
    memberId: "member-1",
    menuItemId: 10,
    quantity: 2,
    unitPriceCents: 1250,
    totalPriceCents: 2500,
    customizations: { spice: "hot" },
    specialInstructions: "No peanuts",
    addedAt: new Date("2026-06-07T00:00:00.000Z"),
    updatedAt: new Date("2026-06-07T00:00:00.000Z"),
  };

  it("names the dish when an item is added", async () => {
    const service = createService();
    service.db = createDb([
      [baseGroupOrder],
      [hostMember],
      [menuItemRow],
      [{ total: 25 }],
      [],
      [{ total: 25 }],
      [storedCartItem],
    ]);

    const result = await service.addCartItem("group-1", {
      memberId: "member-1",
      menuItemId: 10,
      quantity: 2,
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      menuItem: { id: 10, name: "Laksa", price: 12.5 },
    });
  });

  it("names the dish when an item is updated", async () => {
    const service = createService();
    service.db = createDb([
      [storedCartItem],
      [{ total: 37.5 }],
      [],
      [{ total: 37.5 }],
      [{ ...storedCartItem, quantity: 3, totalPriceCents: 3750 }],
      [menuItemRow],
    ]);

    const result = await service.updateCartItem("group-1", "uuid-1", {
      quantity: 3,
    });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ menuItem: { name: "Laksa" } });
  });

  it("keeps the same menu shape on the fallback path", async () => {
    // When the inserted row cannot be re-queried, addCartItem builds the item
    // by hand. That path copies the menuItem mapping rather than sharing it,
    // so it is one field away from drifting from every other caller.
    const service = createService();
    service.db = createDb([
      [baseGroupOrder],
      [hostMember],
      [menuItemRow],
      [{ total: 25 }],
      [],
      [{ total: 25 }],
      [], // re-query of the inserted row returns nothing
    ]);

    const result = await service.addCartItem("group-1", {
      memberId: "member-1",
      menuItemId: 10,
      quantity: 2,
    });

    expect(result.success).toBe(true);
    expect(Object.keys(result.data.menuItem).sort()).toEqual(
      ["id", "imageUrl", "name", "price"].sort(),
    );
    expect(result.data.menuItem).toMatchObject({ name: "Laksa", price: 12.5 });
  });

  it("uses the same row shape getGroupOrder already returns", async () => {
    const service = createService();
    service.db = createDb([
      [baseGroupOrder],
      [hostMember],
      [menuItemRow],
      [{ total: 25 }],
      [],
      [{ total: 25 }],
      [storedCartItem],
    ]);

    const added = await service.addCartItem("group-1", {
      memberId: "member-1",
      menuItemId: 10,
      quantity: 2,
    });

    // getGroupOrder builds { ...formatCartItem(row), menuItem: { id, name,
    // price, imageUrl } }. A second, thinner shape for the same row is what
    // let the missing name through in the first place.
    expect(Object.keys(added.data.menuItem).sort()).toEqual(
      ["id", "imageUrl", "name", "price"].sort(),
    );
  });
});
