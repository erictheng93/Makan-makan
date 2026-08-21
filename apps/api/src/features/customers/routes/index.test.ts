import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthCustomer } from "../../../middleware/auth";
import { ApiError } from "../../../shared/utils/api-error";

const mocks = vi.hoisted(() => {
  const customer: AuthCustomer = {
    id: "customer-1",
    displayName: "Asha Tan",
    primaryPhone: "+886900000001",
    primaryEmail: "asha@example.test",
    status: "active",
  };
  return {
    customer,
    ordersService: {
      getOrders: vi.fn(),
    },
    ordersServiceCtor: vi.fn(),
    // Captures the drizzle chain the market-checkout history route builds, so
    // the test can assert what it filtered and ordered on without a database.
    checkoutRows: [] as Array<Record<string, unknown>>,
    checkoutTotal: { total: 0 },
    checkoutQuery: {
      projection: undefined as unknown,
      where: undefined as unknown,
      orderBy: undefined as unknown,
      limit: undefined as number | undefined,
      offset: undefined as number | undefined,
    },
  };
});

vi.mock("../../../middleware/auth", () => ({
  canonicalCustomerAuthMiddleware: vi.fn(async (c, next) => {
    c.set("customer", mocks.customer);
    await next();
  }),
}));

vi.mock("@makanmasak/database", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@makanmasak/database")>()),
  createDatabase: vi.fn(() => ({
    select: vi.fn((projection?: unknown) => {
      const isCount =
        projection !== undefined && "total" in (projection as object);
      if (!isCount) {
        mocks.checkoutQuery.projection = projection;
      }
      const chain = {
        from: vi.fn(() => chain),
        where: vi.fn((clause: unknown) => {
          if (!isCount) mocks.checkoutQuery.where = clause;
          return chain;
        }),
        orderBy: vi.fn((clause: unknown) => {
          mocks.checkoutQuery.orderBy = clause;
          return chain;
        }),
        limit: vi.fn((value: number) => {
          mocks.checkoutQuery.limit = value;
          return chain;
        }),
        offset: vi.fn((value: number) => {
          mocks.checkoutQuery.offset = value;
          return chain;
        }),
        all: vi.fn(async () => mocks.checkoutRows),
        get: vi.fn(async () => mocks.checkoutTotal),
      };
      return chain;
    }),
  })),
}));

vi.mock("../../orders/services/OrdersService", () => ({
  OrdersService: vi.fn(function OrdersService(...args: unknown[]) {
    mocks.ordersServiceCtor(...args);
    return mocks.ordersService;
  }),
}));

import routes from "./index";

routes.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      },
      err.status as 400 | 401 | 403 | 404 | 409,
    );
  }

  return c.json({ success: false, error: { message: String(err) } }, 500);
});

function env() {
  return { DB: { binding: "db" } };
}

function request(path: string) {
  return routes.request(path, undefined, env() as never);
}

async function json(response: Response) {
  return (await response.json()) as {
    success: boolean;
    data?: unknown;
    pagination?: unknown;
    error?: { code?: string; message?: string; details?: unknown };
  };
}

describe("customers routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.customer = {
      id: "customer-1",
      displayName: "Asha Tan",
      primaryPhone: "+886900000001",
      primaryEmail: "asha@example.test",
      status: "active",
    };
    mocks.checkoutRows = [];
    mocks.checkoutTotal = { total: 0 };
    mocks.checkoutQuery = {
      projection: undefined,
      where: undefined,
      orderBy: undefined,
      limit: undefined,
      offset: undefined,
    };
    mocks.ordersService.getOrders.mockResolvedValue({
      orders: [
        {
          id: 101,
          orderNumber: "ORD-101",
          customerId: "customer-1",
          status: "pending",
        },
      ],
      pagination: {
        page: 2,
        limit: 5,
        total: 1,
        totalPages: 1,
      },
    });
  });

  it("returns the canonical customer profile using phone as username", async () => {
    const response = await request("/me");
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: {
        id: "customer-1",
        username: "+886900000001",
        fullName: "Asha Tan",
        email: "asha@example.test",
        phone: "+886900000001",
        role: 5,
      },
    });
  });

  it("falls back to email and id when customer contact fields are missing", async () => {
    mocks.customer = {
      id: "customer-2",
      displayName: "Guest",
      primaryPhone: undefined,
      primaryEmail: "guest@example.test",
      status: "active",
    };

    let response = await request("/me");
    let body = await json(response);

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      id: "customer-2",
      username: "guest@example.test",
      email: "guest@example.test",
      role: 5,
    });
    expect(body.data).not.toHaveProperty("phone");

    mocks.customer.primaryEmail = undefined;
    response = await request("/me");
    body = await json(response);

    expect(body.data).toMatchObject({
      id: "customer-2",
      username: "customer-2",
    });
    expect(body.data).not.toHaveProperty("email");
    expect(body.data).not.toHaveProperty("phone");
  });

  it("lists only the authenticated customer orders with parsed filters", async () => {
    const response = await request(
      "/me/orders?page=2&limit=5&status=pending&dateFrom=2026-06-01T00:00:00.000Z&dateTo=2026-06-07T23:59:59.000Z",
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.ordersServiceCtor).toHaveBeenCalledWith(env());
    expect(mocks.ordersService.getOrders).toHaveBeenCalledWith({
      customerId: "customer-1",
      page: 2,
      limit: 5,
      status: ["pending"],
      dateFrom: new Date("2026-06-01T00:00:00.000Z"),
      dateTo: new Date("2026-06-07T23:59:59.000Z"),
    });
    expect(body).toEqual({
      success: true,
      data: [
        {
          id: 101,
          orderNumber: "ORD-101",
          customerId: "customer-1",
          status: "pending",
        },
      ],
      pagination: {
        page: 2,
        limit: 5,
        total: 1,
        totalPages: 1,
      },
    });
  });

  it("defaults customer order pagination when filters are omitted", async () => {
    const response = await request("/me/orders");

    expect(response.status).toBe(200);
    expect(mocks.ordersService.getOrders).toHaveBeenCalledWith({
      customerId: "customer-1",
      page: 1,
      limit: 20,
    });
  });
  it("lists the signed-in customer's own market checkouts", async () => {
    mocks.checkoutRows = [
      {
        id: "checkout-1",
        marketId: "market-1",
        marketSlug: "fengjia",
        marketName: "\u9022\u7532\u591c\u5e02",
        status: "submitted",
        paymentStatus: "paid",
        subtotalCents: 24000,
        childOrderCount: 2,
        createdAt: new Date("2026-06-01T10:00:00.000Z"),
      },
    ];
    mocks.checkoutTotal = { total: 1 };

    const response = await request("/me/market-checkouts");
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: [
        {
          id: "checkout-1",
          market: { id: "market-1", slug: "fengjia" },
          paymentStatus: "paid",
          subtotal: 24000,
          childOrderCount: 2,
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(mocks.checkoutQuery.where).toBeDefined();
    expect(mocks.checkoutQuery.orderBy).toBeDefined();
    expect(mocks.checkoutQuery.limit).toBe(20);
    expect(mocks.checkoutQuery.offset).toBe(0);
  });

  it("never projects the recovery digits into the history list", async () => {
    // phone_last_digits is the credential POST /market-checkouts/:id/guest-token
    // compares against. An explicit projection is what keeps it out; a
    // select-all would ship it to the client.
    mocks.checkoutRows = [];
    mocks.checkoutTotal = { total: 0 };

    await request("/me/market-checkouts");

    const projection = mocks.checkoutQuery.projection as Record<
      string,
      unknown
    >;
    expect(projection).toBeDefined();
    expect(Object.keys(projection)).not.toContain("phoneLastDigits");
    expect(Object.keys(projection)).not.toContain("customerId");
  });

  it("pages the market checkout history", async () => {
    mocks.checkoutRows = [];
    mocks.checkoutTotal = { total: 25 };

    const response = await request("/me/market-checkouts?page=3&limit=5");
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.pagination).toMatchObject({
      page: 3,
      limit: 5,
      total: 25,
      totalPages: 5,
    });
    expect(mocks.checkoutQuery.limit).toBe(5);
    expect(mocks.checkoutQuery.offset).toBe(10);
  });
});
