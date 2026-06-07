import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../shared/utils/api-error";

const serviceFns = vi.hoisted(() => ({
  handle: vi.fn(async () => undefined as unknown),
}));

vi.mock("../services/BillingWebhookService", () => ({
  BillingWebhookService: vi.fn(function BillingWebhookService(env: unknown) {
    return {
      env,
      handle: serviceFns.handle,
    };
  }),
}));

import router from "./index";

router.onError((error, c) => {
  if (error instanceof ApiError) {
    return c.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      },
      error.status as never,
    );
  }

  return c.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
      },
    },
    500,
  );
});

function request(provider: string, rawBody = '{"id":"evt_1"}') {
  return router.request(
    `/webhooks/${provider}`,
    {
      method: "POST",
      body: rawBody,
      headers: {
        "Content-Type": "application/json",
        "Stripe-Signature": "sig_123",
      },
    },
    {
      STRIPE_WEBHOOK_SECRET: "whsec_test",
    } as never,
  );
}

describe("billing webhook routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceFns.handle.mockImplementation(async () => undefined);
  });

  it("normalizes providers and forwards raw webhook data to the service", async () => {
    serviceFns.handle.mockImplementation(async () => ({
      provider: "stripe",
      eventId: "evt_1",
      processed: true,
    }));

    const response = await request("Stripe", '{"id":"evt_1"}');

    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        provider: "stripe",
        eventId: "evt_1",
        processed: true,
      },
    });
    expect(response.status).toBe(200);
    expect(serviceFns.handle).toHaveBeenCalledTimes(1);
    expect(serviceFns.handle).toHaveBeenCalledWith(
      "stripe",
      '{"id":"evt_1"}',
      expect.objectContaining({
        get: expect.any(Function),
      }),
    );
    const headers = serviceFns.handle.mock.calls[0][2] as Headers;
    expect(headers.get("stripe-signature")).toBe("sig_123");
  });

  it("maps invalid JSON from the webhook service to a 400 response", async () => {
    serviceFns.handle.mockImplementation(async () => {
      throw new SyntaxError("Unexpected token");
    });

    const response = await request("stripe", "not-json");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "WEBHOOK_INVALID_JSON",
        message: "Invalid webhook JSON",
      },
    });
  });

  it("maps signature and provider failures to a 401 response", async () => {
    serviceFns.handle.mockImplementation(async () => {
      throw new Error("signature mismatch");
    });

    const response = await request("stripe");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "WEBHOOK_SIGNATURE_INVALID",
        message: "signature mismatch",
      },
    });
  });

  it("uses a generic invalid signature message for non-error failures", async () => {
    serviceFns.handle.mockImplementation(async () => {
      throw "bad signature";
    });

    const response = await request("stripe");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: {
        code: "WEBHOOK_SIGNATURE_INVALID",
        message: "Invalid webhook signature",
      },
    });
  });
});
