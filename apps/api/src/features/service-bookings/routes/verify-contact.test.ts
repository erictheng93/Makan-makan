import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../middleware/rateLimiter", () => ({
  rateLimitMiddleware: () => async (_c: unknown, next: () => Promise<void>) =>
    next(),
}));

const getByConfirmationCode = vi.hoisted(() => vi.fn());
const cancelByConfirmationCode = vi.hoisted(() => vi.fn());

vi.mock("../services/ServiceBookingService", () => ({
  ServiceBookingService: class {
    getByConfirmationCode = getByConfirmationCode;
    cancelByConfirmationCode = cancelByConfirmationCode;
  },
}));

import app from "./index";
import { ApiError } from "../../../shared/utils/api-error";

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      { success: false, error: { code: err.code, message: err.message } },
      err.status as 400 | 401 | 403 | 404 | 409,
    );
  }
  return c.json({ success: false, error: { message: String(err) } }, 500);
});

const BOOKING = {
  id: "booking-1",
  confirmationCode: "ABC123",
  status: "pending",
};

beforeEach(() => {
  vi.clearAllMocks();
  getByConfirmationCode.mockResolvedValue(BOOKING);
  cancelByConfirmationCode.mockResolvedValue({
    ...BOOKING,
    status: "cancelled",
  });
});

function req(path: string, method = "GET", body?: unknown) {
  return app.request(
    path,
    {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
    },
    {
      DB: {},
      CACHE_KV: {},
    } as unknown as Record<string, unknown>,
  );
}

describe("service booking public verify contact proof routes", () => {
  it("passes optional phone contact proof to code lookup", async () => {
    const res = await req(
      "/verify/ABC123?requireContact=true&phone=0911-222-333",
    );

    expect(res.status).toBe(200);
    expect(getByConfirmationCode).toHaveBeenCalledWith("ABC123", {
      requireContact: true,
      customerPhone: "0911-222-333",
      customerEmail: undefined,
    });
  });

  it("passes optional email contact proof to public cancel", async () => {
    const res = await req("/verify/ABC123/cancel", "POST", {
      requireContact: true,
      email: "guest@example.test",
    });

    expect(res.status).toBe(200);
    expect(cancelByConfirmationCode).toHaveBeenCalledWith("ABC123", {
      requireContact: true,
      customerPhone: undefined,
      customerEmail: "guest@example.test",
    });
  });

  it("rejects malformed contact proof before service lookup", async () => {
    const res = await req(
      "/verify/ABC123?requireContact=true&email=not-an-email",
    );

    expect(res.status).toBe(400);
    expect(getByConfirmationCode).not.toHaveBeenCalled();
  });
});
