import { beforeEach, describe, expect, it, vi } from "vitest";
import routes from "./index";
import { ApiError } from "../../../shared/utils/api-error";

// The routes throw ApiError and rely on the app-wide handler installed by
// app-factory to render it; mounted bare like this there is none, so Hono's
// default turns every guard into a 500. Mirrors the same harness in
// service-bookings/routes/index.test.ts.
routes.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      { success: false, error: { code: err.code, message: err.message } },
      err.status as 400 | 401 | 403 | 404 | 409 | 500,
    );
  }
  return c.json({ success: false, error: { message: String(err) } }, 500);
});

const serviceMethods = vi.hoisted(() => ({
  verifyResetToken: vi.fn(),
  sendEmailVerification: vi.fn(),
  verifyEmail: vi.fn(),
  sendPhoneVerification: vi.fn(),
  verifyPhone: vi.fn(),
}));
const verificationService = vi.hoisted(() =>
  vi.fn(function VerificationService() {
    return serviceMethods;
  }),
);
const testUser = { id: 42, email: "customer@example.test", role: 5 };

vi.mock("@makanmasak/database", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@makanmasak/database")>()),
  VerificationService: verificationService,
}));

vi.mock("../../../middleware/rateLimiter", () => ({
  rateLimitMiddleware: () => async (_c: unknown, next: () => Promise<void>) =>
    next(),
  RateLimitPresets: {
    passwordReset: {},
    emailVerification: {},
    smsOTP: {},
  },
}));

vi.mock("../../../middleware/auth", () => ({
  customerAuthMiddleware: async (
    c: {
      req: { header: (name: string) => string | undefined };
      set: (key: "user", value: typeof testUser) => void;
    },
    next: () => Promise<void>,
  ) => {
    if (c.req.header("x-test-user") !== "none") {
      c.set("user", testUser);
    }
    await next();
  },
}));

function createEnv() {
  return { DB: {}, CACHE_KV: {} };
}

const token = "123e4567-e89b-12d3-a456-426614174000";

describe("verification routes", () => {
  beforeEach(() => {
    verificationService.mockClear();
    for (const method of Object.values(serviceMethods)) {
      method.mockReset();
    }
  });

  it("verifies reset tokens and handles invalid lookup results", async () => {
    const missingResponse = await routes.fetch(
      new Request("https://test/reset-password/verify"),
      createEnv() as never,
    );
    expect(missingResponse.status).toBe(400);
    await expect(missingResponse.json()).resolves.toEqual({
      valid: false,
      error: {
        code: "MISSING_PARAM",
        message: "缺少 Token 參數",
      },
    });

    const malformedResponse = await routes.fetch(
      new Request("https://test/reset-password/verify?token=not-a-uuid"),
      createEnv() as never,
    );
    expect(malformedResponse.status).toBe(400);
    await expect(malformedResponse.json()).resolves.toMatchObject({
      valid: false,
      error: {
        code: "VALIDATION_ERROR",
        message: expect.any(String),
      },
    });

    serviceMethods.verifyResetToken.mockResolvedValue({
      valid: true,
      email: "customer@example.test",
    });
    const validResponse = await routes.fetch(
      new Request(`https://test/reset-password/verify?token=${token}`, {
        headers: { "x-real-ip": "198.51.100.20" },
      }),
      createEnv() as never,
    );

    expect(validResponse.status).toBe(200);
    expect(serviceMethods.verifyResetToken).toHaveBeenCalledWith({
      token,
      ipAddress: "198.51.100.20",
    });

    serviceMethods.verifyResetToken.mockResolvedValue({
      valid: false,
      error: "expired",
      reason: "reset_token_expired",
    });
    const invalidLookupResponse = await routes.fetch(
      new Request(`https://test/reset-password/verify?token=${token}`),
      createEnv() as never,
    );

    expect(invalidLookupResponse.status).toBe(400);
    await expect(invalidLookupResponse.json()).resolves.toEqual({
      valid: false,
      error: {
        code: "RESET_TOKEN_EXPIRED",
        message: "expired",
      },
    });

    serviceMethods.verifyResetToken.mockResolvedValueOnce({
      valid: false,
      error: "invalid",
      reason: "reset_token_invalid",
    });
    const invalidTokenResponse = await routes.fetch(
      new Request(`https://test/reset-password/verify?token=${token}`),
      createEnv() as never,
    );
    expect(invalidTokenResponse.status).toBe(400);
    await expect(invalidTokenResponse.json()).resolves.toEqual({
      valid: false,
      error: {
        code: "RESET_TOKEN_INVALID",
        message: "invalid",
      },
    });

    serviceMethods.verifyResetToken.mockRejectedValueOnce(
      new Error("database unavailable"),
    );
    const failedResponse = await routes.fetch(
      new Request(`https://test/reset-password/verify?token=${token}`),
      createEnv() as never,
    );
    expect(failedResponse.status).toBe(500);
    await expect(failedResponse.json()).resolves.toEqual({
      valid: false,
      error: {
        code: "RESET_TOKEN_VERIFICATION_FAILED",
        message: "驗證 Token 時發生錯誤",
      },
    });
  });

  it("sends email verification only for authenticated users", async () => {
    const unauthenticatedResponse = await routes.fetch(
      new Request("https://test/verify-email/send", {
        method: "POST",
        headers: { "x-test-user": "none" },
        body: JSON.stringify({ email: "customer@example.test" }),
      }),
      createEnv() as never,
    );
    expect(unauthenticatedResponse.status).toBe(401);

    serviceMethods.sendEmailVerification.mockResolvedValue({
      success: true,
      message: "sent",
    });
    const response = await routes.fetch(
      new Request("https://test/verify-email/send", {
        method: "POST",
        headers: { "cf-connecting-ip": "203.0.113.11" },
        body: JSON.stringify({ email: "customer@example.test" }),
      }),
      createEnv() as never,
    );

    expect(response.status).toBe(200);
    expect(serviceMethods.sendEmailVerification).toHaveBeenCalledWith({
      userId: 42,
      email: "customer@example.test",
      ipAddress: "203.0.113.11",
    });
  });

  it("verifies email tokens and returns service failures as bad requests", async () => {
    const invalidResponse = await routes.fetch(
      new Request("https://test/verify-email?token=not-a-uuid"),
      createEnv() as never,
    );
    expect(invalidResponse.status).toBe(400);

    serviceMethods.verifyEmail.mockResolvedValue({
      success: false,
      error: "expired",
    });
    const response = await routes.fetch(
      new Request(`https://test/verify-email?token=${token}`),
      createEnv() as never,
    );

    expect(response.status).toBe(400);
    expect(serviceMethods.verifyEmail).toHaveBeenCalledWith({
      token,
      ipAddress: "unknown",
    });
  });

  it("sends phone verification codes for authenticated users", async () => {
    const invalidResponse = await routes.fetch(
      new Request("https://test/verify-phone/send", {
        method: "POST",
        body: JSON.stringify({ phone: "bad-phone" }),
      }),
      createEnv() as never,
    );
    expect(invalidResponse.status).toBe(400);

    serviceMethods.sendPhoneVerification.mockResolvedValue({
      success: true,
      message: "sent",
    });
    const response = await routes.fetch(
      new Request("https://test/verify-phone/send", {
        method: "POST",
        body: JSON.stringify({ phone: "+60123456789" }),
      }),
      createEnv() as never,
    );

    expect(response.status).toBe(200);
    expect(serviceMethods.sendPhoneVerification).toHaveBeenCalledWith({
      userId: 42,
      phone: "+60123456789",
      ipAddress: "unknown",
    });
  });

  it("verifies phone OTPs and handles unsuccessful verification", async () => {
    const unauthenticatedResponse = await routes.fetch(
      new Request("https://test/verify-phone", {
        method: "POST",
        headers: { "x-test-user": "none" },
        body: JSON.stringify({ phone: "+60123456789", otpCode: "123456" }),
      }),
      createEnv() as never,
    );
    expect(unauthenticatedResponse.status).toBe(401);

    const invalidResponse = await routes.fetch(
      new Request("https://test/verify-phone", {
        method: "POST",
        body: JSON.stringify({ phone: "+60123456789", otpCode: "12" }),
      }),
      createEnv() as never,
    );
    expect(invalidResponse.status).toBe(400);

    serviceMethods.verifyPhone.mockResolvedValue({
      success: false,
      error: "invalid otp",
    });
    const response = await routes.fetch(
      new Request("https://test/verify-phone", {
        method: "POST",
        headers: { "x-real-ip": "198.51.100.30" },
        body: JSON.stringify({ phone: "+60123456789", otpCode: "123456" }),
      }),
      createEnv() as never,
    );

    expect(response.status).toBe(400);
    expect(serviceMethods.verifyPhone).toHaveBeenCalledWith({
      userId: 42,
      phone: "+60123456789",
      otpCode: "123456",
      ipAddress: "198.51.100.30",
    });
  });
});
