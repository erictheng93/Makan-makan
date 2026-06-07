import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const dbAuthService = {
    login: vi.fn(),
    register: vi.fn(),
    refreshToken: vi.fn(),
    logout: vi.fn(),
    validateToken: vi.fn(),
    changePassword: vi.fn(),
    getUserSessions: vi.fn(),
  };
  const verificationService = {
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
    sendEmailVerification: vi.fn(),
    verifyEmail: vi.fn(),
  };
  const cache = {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
  };
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const performance = {
    startTimer: vi.fn(() => "timer"),
    endTimer: vi.fn(() => 25),
    recordMetric: vi.fn(),
  };
  const db = {
    select: vi.fn(),
    update: vi.fn(),
  };

  return { dbAuthService, verificationService, cache, logger, performance, db };
});

vi.mock("../../../core/database", () => ({
  getDatabaseConnection: vi.fn(() => mocks.db),
}));

vi.mock("../../../core/cache", () => ({
  KVCacheService: vi.fn(function KVCacheService() {
    return mocks.cache;
  }),
}));

vi.mock("../../../core/monitoring", () => ({
  ConsoleLogger: vi.fn(function ConsoleLogger() {
    return mocks.logger;
  }),
  SimplePerformanceTracker: vi.fn(function SimplePerformanceTracker() {
    return mocks.performance;
  }),
}));

vi.mock("@makanmakan/database", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return {
    ...actual,
    AuthService: vi.fn(function AuthService() {
      return mocks.dbAuthService;
    }),
    VerificationService: vi.fn(function VerificationService() {
      return mocks.verificationService;
    }),
  };
});

import { AuthService } from "./AuthService";

function createService() {
  return new AuthService({
    DB: {} as D1Database,
    CACHE_KV: {} as KVNamespace,
  } as any);
}

function mockSelectGet(value: unknown) {
  mocks.db.select.mockReturnValueOnce({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        get: vi.fn(async () => value),
      })),
    })),
  });
}

describe("AuthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("transforms successful login results and records session/security cache entries", async () => {
    mocks.dbAuthService.login.mockResolvedValue({
      success: true,
      user: {
        id: 7,
        username: "owner",
        fullName: "Shop Owner",
        role: 1,
        restaurantId: null,
        isActive: true,
      },
      tokens: {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresAt: new Date("2026-06-07T01:00:00.000Z"),
      },
    });

    const result = await createService().login({
      username: "owner",
      password: "secret",
      deviceInfo: {
        ipAddress: "203.0.113.10",
        userAgent: "Vitest",
      },
      location: { country: "TW", city: "Taipei" },
    });

    expect(result).toMatchObject({
      success: true,
      user: {
        id: 7,
        username: "owner",
        role: 1,
        restaurantId: undefined,
        isVerified: false,
        twoFactorEnabled: false,
      },
      tokens: {
        accessToken: "access-token",
        refreshToken: "refresh-token",
        expiresIn: 3600,
      },
    });
    expect(mocks.cache.set).toHaveBeenCalledWith(
      "user-session:7:access-token",
      { userId: 7, token: "access-token", cached: true },
      expect.any(Number),
    );
    expect(mocks.cache.set).toHaveBeenCalledWith(
      "security-event:1780790400000",
      expect.objectContaining({
        type: "LOGIN",
        userId: 7,
        username: "owner",
        ipAddress: "203.0.113.10",
        severity: "LOW",
      }),
      expect.any(Number),
    );
    expect(mocks.cache.clear).toHaveBeenCalledWith("failed-login:owner");
    expect(mocks.performance.recordMetric).toHaveBeenCalledWith(
      "auth.login.success",
      1,
    );
  });

  it("tracks failed login attempts without throwing", async () => {
    mocks.cache.get.mockResolvedValueOnce(2);
    mocks.dbAuthService.login.mockResolvedValue({
      success: false,
      error: "Invalid credentials",
    });

    await expect(
      createService().login({
        username: "owner",
        password: "wrong",
        deviceInfo: { ipAddress: "203.0.113.10" },
      }),
    ).resolves.toEqual({
      success: false,
      user: undefined,
      tokens: undefined,
      error: "Invalid credentials",
    });

    expect(mocks.cache.set).toHaveBeenCalledWith(
      "failed-login:owner:203.0.113.10",
      3,
      expect.any(Number),
    );
    expect(mocks.cache.set).toHaveBeenCalledWith(
      "security-event:1780790400000",
      expect.objectContaining({
        type: "LOGIN_FAILED",
        username: "owner",
        severity: "MEDIUM",
      }),
      expect.any(Number),
    );
    expect(mocks.performance.recordMetric).toHaveBeenCalledWith(
      "auth.login.failed",
      1,
    );
  });

  it("returns cached token validation and avoids database validation", async () => {
    const cached = {
      valid: true,
      user: { id: 7, username: "owner" },
    };
    mocks.cache.get.mockResolvedValueOnce(cached);

    await expect(createService().validateToken("access-token")).resolves.toBe(
      cached,
    );
    expect(mocks.cache.get).toHaveBeenCalledWith(
      "token-validation:access-token",
    );
    expect(mocks.dbAuthService.validateToken).not.toHaveBeenCalled();
  });

  it("falls back from cache errors and stores successful token validation", async () => {
    mocks.cache.get.mockRejectedValueOnce(new Error("kv unavailable"));
    mocks.dbAuthService.validateToken.mockResolvedValue({
      valid: true,
      user: {
        id: 7,
        username: "owner",
        fullName: "Shop Owner",
        role: 1,
        restaurantId: "restaurant-1",
        isActive: true,
      },
    });

    await expect(
      createService().validateToken("access-token"),
    ).resolves.toMatchObject({
      valid: true,
      user: {
        id: 7,
        username: "owner",
        fullName: "Shop Owner",
        role: 1,
        restaurantId: "restaurant-1",
        isVerified: false,
        twoFactorEnabled: false,
      },
    });
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      "Cache retrieval failed, falling back to database",
      { error: "kv unavailable" },
    );
    expect(mocks.cache.set).toHaveBeenCalledWith(
      "token-validation:access-token",
      expect.objectContaining({ valid: true }),
      expect.any(Number),
    );
  });

  it("parses database session summaries and ignores malformed JSON fields", async () => {
    mocks.dbAuthService.getUserSessions.mockResolvedValue([
      {
        id: 1,
        deviceInfo: JSON.stringify({ platform: "desktop" }),
        location: JSON.stringify({ country: "TW" }),
        lastAccessedAt: "2026-06-07T00:00:00.000Z",
        expiresAt: "2026-06-08T00:00:00.000Z",
        createdAt: "2026-06-06T00:00:00.000Z",
      },
      {
        id: 2,
        deviceInfo: "not json",
        location: null,
        expiresAt: 1780876800000,
        createdAt: 1780704000000,
      },
    ]);

    await expect(createService().getUserSessions(7)).resolves.toEqual([
      {
        id: "1",
        deviceInfo: { platform: "desktop" },
        location: { country: "TW" },
        lastAccessedAt: new Date("2026-06-07T00:00:00.000Z"),
        expiresAt: new Date("2026-06-08T00:00:00.000Z"),
        isCurrent: false,
        createdAt: new Date("2026-06-06T00:00:00.000Z"),
      },
      {
        id: "2",
        deviceInfo: undefined,
        location: undefined,
        lastAccessedAt: undefined,
        expiresAt: new Date(1780876800000),
        isCurrent: false,
        createdAt: new Date(1780704000000),
      },
    ]);
  });

  it("resolves password reset targets without exposing missing accounts", async () => {
    mocks.verificationService.requestPasswordReset.mockResolvedValue({
      success: true,
    });
    mockSelectGet({ email: "owner@example.test", phone: "+886900000000" });
    mockSelectGet(null);

    await expect(
      createService().requestPasswordReset("direct@example.test"),
    ).resolves.toEqual({ success: true, error: undefined });
    await expect(
      createService().requestPasswordReset("owner"),
    ).resolves.toEqual({ success: true, error: undefined });
    await expect(
      createService().requestPasswordReset("missing-user"),
    ).resolves.toEqual({ success: true });

    expect(
      mocks.verificationService.requestPasswordReset,
    ).toHaveBeenNthCalledWith(1, {
      identifier: "direct@example.test",
      method: "email",
    });
    expect(
      mocks.verificationService.requestPasswordReset,
    ).toHaveBeenNthCalledWith(2, {
      identifier: "owner@example.test",
      method: "email",
    });
  });

  it("exposes placeholder two-factor behavior consistently", async () => {
    const service = createService();

    await expect(service.setupTwoFactor(7, "secret")).rejects.toThrow(
      "Two-factor authentication not yet implemented",
    );
    await expect(service.verifyTwoFactor(7, "123456")).resolves.toEqual({
      success: false,
      error: "Two-factor authentication not yet implemented",
    });
    await expect(service.disableTwoFactor(7, "secret")).resolves.toEqual({
      success: false,
      error: "Two-factor authentication not yet implemented",
    });
    await expect(service.generateBackupCodes(7)).rejects.toThrow(
      "Two-factor authentication not yet implemented",
    );
  });
});
