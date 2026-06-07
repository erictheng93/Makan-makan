import { beforeEach, describe, expect, it, vi } from "vitest";
import routes from "./index";

const serviceMethods = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  verifyResetToken: vi.fn(),
  resetPassword: vi.fn(),
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
const passwordResetAttempt = vi.hoisted(() => vi.fn());
const testUser = { id: 42, email: "customer@example.test", role: 5 };

vi.mock("@makanmakan/database", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@makanmakan/database")>()),
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

vi.mock("../../../services/AlertService", () => ({
  AlertService: function AlertService() {
    return { passwordResetAttempt };
  },
}));

function createEnv() {
  return { DB: {}, CACHE_KV: {} };
}

const token = "123e4567-e89b-12d3-a456-426614174000";

describe("verification routes", () => {
  beforeEach(() => {
    verificationService.mockClear();
    passwordResetAttempt.mockReset();
    for (const method of Object.values(serviceMethods)) {
      method.mockReset();
    }
  });

  it("requests password resets with client metadata", async () => {
    serviceMethods.requestPasswordReset.mockResolvedValue({
      success: true,
      message: "sent",
    });

    const response = await routes.fetch(
      new Request("https://test/forgot-password", {
        method: "POST",
        headers: {
          "cf-connecting-ip": "203.0.113.10",
          "user-agent": "Vitest",
        },
        body: JSON.stringify({
          identifier: "customer@example.test",
          method: "email",
        }),
      }),
      createEnv() as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      message: "sent",
    });
    expect(serviceMethods.requestPasswordReset).toHaveBeenCalledWith({
      identifier: "customer@example.test",
      method: "email",
      ipAddress: "203.0.113.10",
      userAgent: "Vitest",
    });
  });

  it("validates and wraps password reset request failures", async () => {
    const invalidResponse = await routes.fetch(
      new Request("https://test/forgot-password", {
        method: "POST",
        body: JSON.stringify({ identifier: "", method: "email" }),
      }),
      createEnv() as never,
    );

    expect(invalidResponse.status).toBe(400);
    expect(serviceMethods.requestPasswordReset).not.toHaveBeenCalled();

    serviceMethods.requestPasswordReset.mockRejectedValue(
      new Error("mailer unavailable"),
    );
    const errorResponse = await routes.fetch(
      new Request("https://test/forgot-password", {
        method: "POST",
        body: JSON.stringify({
          identifier: "customer@example.test",
          method: "email",
        }),
      }),
      createEnv() as never,
    );

    expect(errorResponse.status).toBe(500);
    await expect(errorResponse.json()).resolves.toMatchObject({
      success: false,
    });
  });

  it("verifies reset tokens and handles invalid lookup results", async () => {
    const missingResponse = await routes.fetch(
      new Request("https://test/reset-password/verify"),
      createEnv() as never,
    );
    expect(missingResponse.status).toBe(400);

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
    });
    const invalidLookupResponse = await routes.fetch(
      new Request(`https://test/reset-password/verify?token=${token}`),
      createEnv() as never,
    );

    expect(invalidLookupResponse.status).toBe(400);
  });

  it("resets passwords after token and confirmation validation", async () => {
    const mismatchResponse = await routes.fetch(
      new Request("https://test/reset-password", {
        method: "POST",
        body: JSON.stringify({
          token,
          newPassword: "secret1",
          confirmPassword: "secret2",
        }),
      }),
      createEnv() as never,
    );
    expect(mismatchResponse.status).toBe(400);

    serviceMethods.resetPassword.mockResolvedValue({
      success: true,
      message: "updated",
    });
    const response = await routes.fetch(
      new Request("https://test/reset-password", {
        method: "POST",
        headers: { "user-agent": "Vitest" },
        body: JSON.stringify({
          token,
          newPassword: "secret1",
          confirmPassword: "secret1",
        }),
      }),
      createEnv() as never,
    );

    expect(response.status).toBe(200);
    expect(serviceMethods.resetPassword).toHaveBeenCalledWith({
      token,
      newPassword: "secret1",
      ipAddress: "unknown",
      userAgent: "Vitest",
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
