import { Hono } from "hono";
import { sign } from "hono/jwt";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../shared/utils/api-error";
import {
  authMiddleware,
  canonicalCustomerAuthMiddleware,
  customerAuthMiddleware,
  optionalCanonicalCustomerAuthMiddleware,
} from "./auth";

const JWT_SECRET = "test-jwt-secret-with-at-least-32-chars";

function apiErrorHandler(error: Error, c: never) {
  if (error instanceof ApiError) {
    return c.json(
      { success: false, error: { code: error.code, message: error.message } },
      error.status as never,
    );
  }
  throw error;
}

const staffUserId = "018f0000-0000-7000-8000-000000000777";

function createStaffDb(row: Record<string, unknown> | null) {
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => row),
      })),
    })),
  };
}

function createCustomerDb(row: Record<string, unknown> | null) {
  const run = vi.fn(async () => ({ meta: { changes: 1 } }));
  return {
    run,
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => (sql.includes("FROM customers") ? row : null)),
        run,
      })),
    })),
  };
}

async function staffToken(role: number) {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: staffUserId,
      username: `role-${role}`,
      role,
      restaurantId: "rest-1",
      tv: 1,
      iat: now,
      exp: now + 3600,
    },
    JWT_SECRET,
  );
}

async function adminTokenWithoutRestaurant() {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: staffUserId,
      username: "admin",
      role: 0,
      restaurantId: null,
      tv: 1,
      iat: now,
      exp: now + 3600,
    },
    JWT_SECRET,
  );
}

async function staffPublicIdToken(role: number) {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub: staffUserId,
      username: `role-${role}`,
      role,
      restaurantId: "rest-1",
      tv: 1,
      iat: now,
      exp: now + 3600,
    },
    JWT_SECRET,
  );
}

async function customerToken(sub = "customer-1") {
  const now = Math.floor(Date.now() / 1000);
  return sign(
    {
      sub,
      type: "customer",
      iat: now,
      exp: now + 3600,
    },
    JWT_SECRET,
  );
}

describe("authMiddleware", () => {
  it("accepts active staff tokens and attaches the user", async () => {
    const app = new Hono();
    app.onError(apiErrorHandler);
    app.use("/protected", authMiddleware);
    app.get("/protected", (c) => c.json({ user: c.get("user") }));

    const response = await app.fetch(
      new Request("https://api.test/protected", {
        headers: { Authorization: `Bearer ${await staffToken(1)}` },
      }),
      {
        JWT_SECRET,
        DB: createStaffDb({
          id: staffUserId,
          username: "role-1",
          role: 1,
          restaurant_id: "rest-db",
          is_active: 1,
          token_version: 1,
        }),
      } as never,
    );

    await expect(response.json()).resolves.toMatchObject({
      user: {
        id: staffUserId,
        publicId: staffUserId,
        role: 1,
        restaurantId: "rest-db",
      },
    });
    expect(response.status).toBe(200);
  });

  it("accepts UUID-principal staff tokens and attaches the legacy user id", async () => {
    const app = new Hono();
    app.onError(apiErrorHandler);
    app.use("/protected", authMiddleware);
    app.get("/protected", (c) => c.json({ user: c.get("user") }));

    const response = await app.fetch(
      new Request("https://api.test/protected", {
        headers: { Authorization: `Bearer ${await staffPublicIdToken(1)}` },
      }),
      {
        JWT_SECRET,
        DB: createStaffDb({
          id: staffUserId,
          username: "role-1",
          role: 1,
          restaurant_id: "rest-db",
          is_active: 1,
          token_version: 1,
        }),
      } as never,
    );

    await expect(response.json()).resolves.toMatchObject({
      user: {
        id: staffUserId,
        publicId: staffUserId,
        role: 1,
        restaurantId: "rest-db",
      },
    });
    expect(response.status).toBe(200);
  });

  it("accepts platform admin tokens without a restaurant", async () => {
    const app = new Hono();
    app.onError(apiErrorHandler);
    app.use("/protected", authMiddleware);
    app.get("/protected", (c) => c.json({ user: c.get("user") }));

    const response = await app.fetch(
      new Request("https://api.test/protected", {
        headers: {
          Authorization: `Bearer ${await adminTokenWithoutRestaurant()}`,
        },
      }),
      {
        JWT_SECRET,
        DB: createStaffDb({
          id: staffUserId,
          username: "admin",
          role: 0,
          restaurant_id: null,
          is_active: 1,
          token_version: 1,
        }),
      } as never,
    );

    const body = await response.json();

    expect(body).toMatchObject({
      user: {
        id: staffUserId,
        publicId: staffUserId,
        role: 0,
      },
    });
    expect(body.user).not.toHaveProperty("restaurantId");
    expect(response.status).toBe(200);
  });

  it("rejects legacy role 5 customer tokens on staff routes", async () => {
    const app = new Hono();
    app.onError(apiErrorHandler);
    app.use("/protected", authMiddleware);
    app.get("/protected", (c) => c.json({ ok: true }));

    const response = await app.fetch(
      new Request("https://api.test/protected", {
        headers: { Authorization: `Bearer ${await staffToken(5)}` },
      }),
      { JWT_SECRET, DB: createStaffDb(null) } as never,
    );

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "TOKEN_INVALID" },
    });
    expect(response.status).toBe(401);
  });

  it("allows legacy role 5 tokens through customerAuthMiddleware", async () => {
    const app = new Hono();
    app.onError(apiErrorHandler);
    app.use("/customer", customerAuthMiddleware);
    app.get("/customer", (c) => c.json({ user: c.get("user") }));

    const response = await app.fetch(
      new Request("https://api.test/customer", {
        headers: { Authorization: `Bearer ${await staffToken(5)}` },
      }),
      {
        JWT_SECRET,
        DB: createStaffDb({
          id: staffUserId,
          username: "role-5",
          role: 5,
          restaurant_id: null,
          is_active: 1,
          token_version: 1,
        }),
      } as never,
    );

    await expect(response.json()).resolves.toMatchObject({
      user: { id: staffUserId, publicId: staffUserId, role: 5 },
    });
    expect(response.status).toBe(200);
  });
});

describe("canonicalCustomerAuthMiddleware", () => {
  it("accepts canonical customer tokens and refreshes last_seen", async () => {
    const db = createCustomerDb({
      id: "customer-1",
      display_name: "Ada",
      primary_phone: "0912345678",
      primary_email: null,
      status: "active",
    });
    const app = new Hono();
    app.onError(apiErrorHandler);
    app.use("/me", canonicalCustomerAuthMiddleware);
    app.get("/me", (c) => c.json({ customer: c.get("customer") }));

    const response = await app.fetch(
      new Request("https://api.test/me", {
        headers: { Authorization: `Bearer ${await customerToken()}` },
      }),
      { JWT_SECRET, DB: db } as never,
    );

    await expect(response.json()).resolves.toMatchObject({
      customer: { id: "customer-1", displayName: "Ada" },
    });
    expect(db.run).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
  });
});

describe("optionalCanonicalCustomerAuthMiddleware", () => {
  it("continues anonymously when the bearer token is not canonical customer JWT", async () => {
    const app = new Hono();
    app.use("/public", optionalCanonicalCustomerAuthMiddleware);
    app.get("/public", (c) =>
      c.json({ hasCustomer: Boolean(c.get("customer")) }),
    );

    const response = await app.fetch(
      new Request("https://api.test/public", {
        headers: { Authorization: `Bearer ${await staffToken(1)}` },
      }),
      { JWT_SECRET, DB: createCustomerDb(null) } as never,
    );

    await expect(response.json()).resolves.toEqual({ hasCustomer: false });
    expect(response.status).toBe(200);
  });
});
