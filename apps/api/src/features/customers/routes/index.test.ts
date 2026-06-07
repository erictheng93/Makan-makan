import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../shared/utils/api-error";

const mocks = vi.hoisted(() => ({
  customer: {
    id: "customer-1",
    displayName: "Asha Tan",
    primaryPhone: "+886900000001",
    primaryEmail: "asha@example.test",
    status: "active",
  },
  ordersService: {
    getOrders: vi.fn(),
  },
  ordersServiceCtor: vi.fn(),
}));

vi.mock("../../../middleware/auth", () => ({
  canonicalCustomerAuthMiddleware: vi.fn(async (c, next) => {
    c.set("customer", mocks.customer);
    await next();
  }),
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
});
