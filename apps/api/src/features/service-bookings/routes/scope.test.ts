/**
 * Route-level cross-tenant scope tests for service-bookings staff routes.
 *
 * The staff routes are role-gated (requireRole) AND restaurant-scoped
 * (loadBookingInScope): a non-admin may only touch their own restaurant's
 * bookings. role 0 (admin) is unscoped. The 9 real-D1 service tests call the
 * service directly and do NOT exercise this route guard — this file is the
 * merge-blocker coverage for the cross-tenant IDOR fix.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mutable current user injected by the mocked auth middleware.
const auth = vi.hoisted(() => ({
  user: { role: 1, restaurantId: "rest-A" } as {
    role: number;
    restaurantId: string | number | undefined;
  },
}));

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set("user", auth.user);
    await next();
  }),
  requireRole: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

vi.mock("../../../middleware/rateLimiter", () => ({
  rateLimitMiddleware: () => async (_c: unknown, next: () => Promise<void>) =>
    next(),
}));

// Service stub: getById returns a booking in restaurant "rest-B"; mutations are
// spies so we can assert they never run when scope denies access.
const getById = vi.hoisted(() => vi.fn());
const cancelBooking = vi.hoisted(() => vi.fn());
const confirmCash = vi.hoisted(() => vi.fn());

vi.mock("../services/ServiceBookingService", () => ({
  ServiceBookingService: class {
    getById = getById;
    cancelBooking = cancelBooking;
    confirmCash = confirmCash;
  },
}));

import app from "./index";
import { ApiError } from "../../../shared/utils/api-error";

// The feature app is mounted under the global onError in production; replicate
// the ApiError → status mapping here so thrown forbidden()/notFound() surface as
// their real HTTP status instead of an unhandled 500.
app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      { success: false, error: { code: err.code, message: err.message } },
      err.status as 400 | 401 | 403 | 404 | 409,
    );
  }
  return c.json({ success: false, error: { message: String(err) } }, 500);
});

const BOOKING_B = {
  id: "bk-1",
  restaurantId: "rest-B",
  status: "confirmed",
};

beforeEach(() => {
  vi.clearAllMocks();
  getById.mockResolvedValue(BOOKING_B);
  cancelBooking.mockResolvedValue({ ...BOOKING_B, status: "cancelled" });
  confirmCash.mockResolvedValue({ ...BOOKING_B, status: "confirmed" });
  auth.user = { role: 1, restaurantId: "rest-A" };
});

function req(path: string, method = "GET") {
  return app.request(path, { method }, {
    DB: {},
    CACHE_KV: {},
  } as unknown as Record<string, unknown>);
}

describe("service-bookings staff route scoping", () => {
  it("forbids a non-admin from reading another restaurant's booking", async () => {
    auth.user = { role: 1, restaurantId: "rest-A" };
    const res = await req("/bk-1");
    expect(res.status).toBe(403);
  });

  it("forbids a non-admin from cancelling another restaurant's booking", async () => {
    auth.user = { role: 1, restaurantId: "rest-A" };
    const res = await req("/bk-1", "DELETE");
    expect(res.status).toBe(403);
    expect(cancelBooking).not.toHaveBeenCalled();
  });

  it("forbids a non-admin from confirming another restaurant's booking", async () => {
    auth.user = { role: 4, restaurantId: "rest-A" };
    const res = await req("/bk-1/confirm-cash", "POST");
    expect(res.status).toBe(403);
    expect(confirmCash).not.toHaveBeenCalled();
  });

  it("allows a staff member to read their own restaurant's booking", async () => {
    auth.user = { role: 1, restaurantId: "rest-B" };
    const res = await req("/bk-1");
    expect(res.status).toBe(200);
  });

  it("allows an admin (role 0) to act across restaurants", async () => {
    auth.user = { role: 0, restaurantId: undefined };
    const res = await req("/bk-1", "DELETE");
    expect(res.status).toBe(200);
    expect(cancelBooking).toHaveBeenCalledWith("bk-1");
  });
});
