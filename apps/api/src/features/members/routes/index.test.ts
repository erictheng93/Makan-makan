import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context, Next } from "hono";
import type { AuthUser } from "../../../middleware/auth";
import app from "./index";
import { ApiError } from "../../../shared/utils/api-error";

const RESTAURANT_ID = "01972f31-05a2-7b8c-a4f8-000000000001";
const MEMBER_ID = "01972f31-05a2-7b8c-a4f8-0000000000aa";

const mocks = vi.hoisted(() => ({
  currentUser: {
    id: "user-42",
    username: "owner",
    role: 1,
    restaurantId: "01972f31-05a2-7b8c-a4f8-000000000001",
  } as AuthUser,
  list: vi.fn(),
  stats: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  listOrders: vi.fn(),
  revealContact: vi.fn(),
  enforcePiiRevealThrottle: vi.fn(),
}));

// Only auth is stubbed. validation stays real on purpose: the request schemas
// are most of what these handlers do, and a mocked validator would test
// nothing. The tenancy guard being a no-op here means these tests say nothing
// about cross-tenant access -- that is what
// __tests__/integration/members-cross-tenant.real.integration.test.ts is for,
// and the distinction matters because a hand-written auth mock silently
// swallowing the middleware is exactly how a tenancy hole stays invisible.
vi.mock("../../../middleware/auth", async () => {
  const actual = await vi.importActual<
    typeof import("../../../middleware/auth")
  >("../../../middleware/auth");
  return {
    ...actual,
    authMiddleware: async (c: Context, next: Next) => {
      c.set("user", mocks.currentUser);
      await next();
    },
    requireRole: () => async (_c: Context, next: Next) => {
      await next();
    },
    requireRestaurantAccess: () => async (_c: Context, next: Next) => {
      await next();
    },
  };
});

vi.mock("@makanmasak/database", () => ({
  TenantMemberDirectoryService: vi.fn(function TenantMemberDirectoryService() {
    return {
      list: mocks.list,
      stats: mocks.stats,
      get: mocks.get,
      update: mocks.update,
      listOrders: mocks.listOrders,
      revealContact: mocks.revealContact,
    };
  }),
}));

vi.mock("../services/pii-reveal-throttle", () => ({
  enforcePiiRevealThrottle: mocks.enforcePiiRevealThrottle,
}));

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      { success: false, error: { code: err.code, message: err.message } },
      err.status as 400 | 401 | 403 | 404 | 409 | 429,
    );
  }
  return c.json({ success: false, error: { message: String(err) } }, 500);
});

function createEnv() {
  return { DB: {} };
}

function jsonRequest(url: string, method: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "CF-Connecting-IP": "203.0.113.7",
      "User-Agent": "vitest",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/**
 * `Response.json()` is typed `unknown`, and apps/api's test tsconfig is in the
 * typecheck gate, so every read of a response body needs a shape. These two
 * keep the assertions readable without scattering casts through the file.
 */
async function readError(response: Response) {
  return (await response.json()) as {
    success: false;
    error: { code: string; message: string };
  };
}

async function readData<T>(response: Response) {
  return (await response.json()) as { success: true; data: T };
}

const MEMBER = {
  memberId: MEMBER_ID,
  displayName: "A Customer",
  tags: ["vip"],
  note: null,
  isBlocked: false,
  blockedReason: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.currentUser.id = "user-42";
  mocks.currentUser.role = 1;
  mocks.enforcePiiRevealThrottle.mockResolvedValue(undefined);
});

describe("members routes", () => {
  it("lists members and reshapes the service result into a pagination envelope", async () => {
    mocks.list.mockResolvedValue({
      members: [MEMBER],
      total: 1,
      page: 1,
      limit: 100,
      pages: 1,
    });

    const response = await app.fetch(
      new Request(`https://test/${RESTAURANT_ID}/members?page=1&limit=100`),
      createEnv() as never,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: [MEMBER],
      pagination: { total: 1, page: 1, limit: 100, pages: 1 },
    });
    expect(mocks.list).toHaveBeenCalledWith(
      { restaurantId: RESTAURANT_ID },
      expect.objectContaining({ page: 1, limit: 100 }),
    );
  });

  it("turns the blocked query string into a boolean rather than passing the string through", async () => {
    mocks.list.mockResolvedValue({
      members: [],
      total: 0,
      page: 1,
      limit: 100,
      pages: 0,
    });

    await app.fetch(
      new Request(`https://test/${RESTAURANT_ID}/members?blocked=true`),
      createEnv() as never,
    );
    expect(mocks.list).toHaveBeenCalledWith(
      { restaurantId: RESTAURANT_ID },
      expect.objectContaining({ blocked: true }),
    );

    await app.fetch(
      new Request(`https://test/${RESTAURANT_ID}/members?blocked=false`),
      createEnv() as never,
    );
    expect(mocks.list).toHaveBeenLastCalledWith(
      { restaurantId: RESTAURANT_ID },
      expect.objectContaining({ blocked: false }),
    );

    // Absent stays absent -- undefined, not `false`, or a filter the caller
    // never asked for would silently hide every blocked member.
    await app.fetch(
      new Request(`https://test/${RESTAURANT_ID}/members`),
      createEnv() as never,
    );
    expect(mocks.list.mock.lastCall?.[1].blocked).toBeUndefined();
  });

  it("rejects a blocked filter that is neither true nor false", async () => {
    const response = await app.fetch(
      new Request(`https://test/${RESTAURANT_ID}/members?blocked=maybe`),
      createEnv() as never,
    );
    expect(response.status).toBe(400);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("returns member stats", async () => {
    mocks.stats.mockResolvedValue({ total: 3, blocked: 1 });

    const response = await app.fetch(
      new Request(`https://test/${RESTAURANT_ID}/members/stats`),
      createEnv() as never,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      data: { total: 3, blocked: 1 },
    });
    expect(mocks.stats).toHaveBeenCalledWith({ restaurantId: RESTAURANT_ID });
  });

  it("reads one member, and 404s when the scoped lookup misses", async () => {
    mocks.get.mockResolvedValueOnce(MEMBER);
    const found = await app.fetch(
      new Request(`https://test/${RESTAURANT_ID}/members/${MEMBER_ID}`),
      createEnv() as never,
    );
    expect(found.status).toBe(200);

    mocks.get.mockResolvedValueOnce(null);
    const missing = await app.fetch(
      new Request(`https://test/${RESTAURANT_ID}/members/${MEMBER_ID}`),
      createEnv() as never,
    );
    expect(missing.status).toBe(404);
    expect((await readError(missing)).error.code).toBe("MEMBER_NOT_FOUND");
  });

  it("patches tenant-local fields and records who did it", async () => {
    mocks.update.mockResolvedValue({ outcome: "updated", member: MEMBER });

    const response = await app.fetch(
      jsonRequest(
        `https://test/${RESTAURANT_ID}/members/${MEMBER_ID}`,
        "PATCH",
        { tags: ["vip", "lapsed"], note: "called on Tuesday" },
      ),
      createEnv() as never,
    );

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      { restaurantId: RESTAURANT_ID },
      MEMBER_ID,
      { tags: ["vip", "lapsed"], note: "called on Tuesday" },
      // The audit context is taken from the session and the request, never
      // from the body -- a caller cannot attribute its own write to someone
      // else.
      {
        userId: "user-42",
        ipAddress: "203.0.113.7",
        userAgent: "vitest",
      },
    );
  });

  it("rejects a PATCH body carrying a field that is not tenant-local", async () => {
    // `.strict()` on memberPatchBodySchema is load-bearing: a client bug that
    // means to edit the customer's own profile must 400 rather than have the
    // unknown key stripped and write nothing while reporting success.
    const response = await app.fetch(
      jsonRequest(
        `https://test/${RESTAURANT_ID}/members/${MEMBER_ID}`,
        "PATCH",
        { note: "fine", primaryPhone: "0900000000" },
      ),
      createEnv() as never,
    );

    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects an empty PATCH body instead of answering 200 for a no-op", async () => {
    const response = await app.fetch(
      jsonRequest(
        `https://test/${RESTAURANT_ID}/members/${MEMBER_ID}`,
        "PATCH",
        {},
      ),
      createEnv() as never,
    );

    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects more tags than the cap and tags longer than the cap", async () => {
    const tooMany = await app.fetch(
      jsonRequest(
        `https://test/${RESTAURANT_ID}/members/${MEMBER_ID}`,
        "PATCH",
        { tags: Array.from({ length: 21 }, (_, i) => `tag-${i}`) },
      ),
      createEnv() as never,
    );
    expect(tooMany.status).toBe(400);

    const tooLong = await app.fetch(
      jsonRequest(
        `https://test/${RESTAURANT_ID}/members/${MEMBER_ID}`,
        "PATCH",
        { tags: ["x".repeat(41)] },
      ),
      createEnv() as never,
    );
    expect(tooLong.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("accepts null to clear tags, note and blockedReason", async () => {
    mocks.update.mockResolvedValue({ outcome: "updated", member: MEMBER });

    const response = await app.fetch(
      jsonRequest(
        `https://test/${RESTAURANT_ID}/members/${MEMBER_ID}`,
        "PATCH",
        { tags: null, note: null, blockedReason: null },
      ),
      createEnv() as never,
    );

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(
      { restaurantId: RESTAURANT_ID },
      MEMBER_ID,
      { tags: null, note: null, blockedReason: null },
      expect.anything(),
    );
  });

  it("404s a PATCH against a member the scope cannot see", async () => {
    mocks.update.mockResolvedValue({ outcome: "not-found" });

    const response = await app.fetch(
      jsonRequest(
        `https://test/${RESTAURANT_ID}/members/${MEMBER_ID}`,
        "PATCH",
        { isBlocked: true },
      ),
      createEnv() as never,
    );

    expect(response.status).toBe(404);
    expect((await readError(response)).error.code).toBe("MEMBER_NOT_FOUND");
  });

  it("lists a member's orders and 404s when the member is out of scope", async () => {
    mocks.listOrders.mockResolvedValueOnce({
      orders: [{ id: "order-1" }],
      total: 1,
      page: 1,
      limit: 100,
      pages: 1,
    });
    const ok = await app.fetch(
      new Request(`https://test/${RESTAURANT_ID}/members/${MEMBER_ID}/orders`),
      createEnv() as never,
    );
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({
      success: true,
      data: [{ id: "order-1" }],
      pagination: { total: 1, page: 1, limit: 100, pages: 1 },
    });

    mocks.listOrders.mockResolvedValueOnce(null);
    const missing = await app.fetch(
      new Request(`https://test/${RESTAURANT_ID}/members/${MEMBER_ID}/orders`),
      createEnv() as never,
    );
    expect(missing.status).toBe(404);
  });

  it("reveals contact details on a bodyless POST and spends the throttle budget first", async () => {
    mocks.revealContact.mockResolvedValue({
      outcome: "revealed",
      contact: {
        memberId: MEMBER_ID,
        phone: "0900000000",
        email: "a@example.com",
      },
    });

    // A bodyless POST is valid: the flow gates on a confirmation modal, not on
    // typed justification.
    const response = await app.fetch(
      new Request(
        `https://test/${RESTAURANT_ID}/members/${MEMBER_ID}/reveal-contact`,
        { method: "POST" },
      ),
      createEnv() as never,
    );

    expect(response.status).toBe(200);
    const body = await readData<{
      phone: string | null;
      email: string | null;
      revealedAt: number;
    }>(response);
    expect(body.data.phone).toBe("0900000000");
    expect(body.data.email).toBe("a@example.com");
    expect(typeof body.data.revealedAt).toBe("number");
    expect(mocks.enforcePiiRevealThrottle).toHaveBeenCalled();
  });

  it("passes a supplied reason through to the audit trail", async () => {
    mocks.revealContact.mockResolvedValue({
      outcome: "revealed",
      contact: { memberId: MEMBER_ID, phone: null, email: null },
    });

    await app.fetch(
      jsonRequest(
        `https://test/${RESTAURANT_ID}/members/${MEMBER_ID}/reveal-contact`,
        "POST",
        { reason: "refund follow-up" },
      ),
      createEnv() as never,
    );

    expect(mocks.revealContact).toHaveBeenCalledWith(
      { restaurantId: RESTAURANT_ID },
      MEMBER_ID,
      expect.objectContaining({ userId: "user-42" }),
      "refund follow-up",
    );
  });

  it("rejects a reason too short to be a justification", async () => {
    const response = await app.fetch(
      jsonRequest(
        `https://test/${RESTAURANT_ID}/members/${MEMBER_ID}/reveal-contact`,
        "POST",
        { reason: "x" },
      ),
      createEnv() as never,
    );
    expect(response.status).toBe(400);
    expect(mocks.revealContact).not.toHaveBeenCalled();
  });

  it("does not reveal contact details for a deleted customer", async () => {
    mocks.revealContact.mockResolvedValue({ outcome: "deleted" });

    const response = await app.fetch(
      new Request(
        `https://test/${RESTAURANT_ID}/members/${MEMBER_ID}/reveal-contact`,
        { method: "POST" },
      ),
      createEnv() as never,
    );

    expect(response.status).toBe(403);
    expect((await readError(response)).error.code).toBe("MEMBER_DELETED");
  });

  it("404s a reveal against a member the scope cannot see", async () => {
    mocks.revealContact.mockResolvedValue({ outcome: "not-found" });

    const response = await app.fetch(
      new Request(
        `https://test/${RESTAURANT_ID}/members/${MEMBER_ID}/reveal-contact`,
        { method: "POST" },
      ),
      createEnv() as never,
    );

    expect(response.status).toBe(404);
    expect((await readError(response)).error.code).toBe("MEMBER_NOT_FOUND");
  });

  it("never reaches the service when the throttle rejects", async () => {
    mocks.enforcePiiRevealThrottle.mockRejectedValue(
      new ApiError("RATE_LIMIT_EXCEEDED", "Too many reveals", 429),
    );

    const response = await app.fetch(
      new Request(
        `https://test/${RESTAURANT_ID}/members/${MEMBER_ID}/reveal-contact`,
        { method: "POST" },
      ),
      createEnv() as never,
    );

    expect(response.status).toBe(429);
    expect(mocks.revealContact).not.toHaveBeenCalled();
  });
});
