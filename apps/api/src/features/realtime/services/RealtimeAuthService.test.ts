import { sign } from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const blacklist = {
    isTokenRevoked: vi.fn(),
    revokeToken: vi.fn(),
    revokeUserTokens: vi.fn(),
    getStats: vi.fn(),
  };
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };

  return { blacklist, logger };
});

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => ({
    select: vi.fn(),
  })),
}));

vi.mock("../../../core/monitoring", () => ({
  ConsoleLogger: vi.fn(function ConsoleLogger() {
    return mocks.logger;
  }),
}));

vi.mock("./TokenBlacklistService", () => ({
  TokenBlacklistService: vi.fn(function TokenBlacklistService() {
    return mocks.blacklist;
  }),
}));

import { RealtimeAuthService } from "./RealtimeAuthService";

const realtimeSecret = "realtime-secret-with-at-least-32-chars";
const jwtSecret = "session-secret-with-at-least-32-chars";

function createKV(values: Record<string, unknown> = {}) {
  return {
    get: vi.fn(async (key: string, type?: string) => {
      const value = values[key];
      if (value === undefined) return null;
      if (type === "json") return value;
      return typeof value === "string" ? value : JSON.stringify(value);
    }),
    put: vi.fn(),
    delete: vi.fn(),
  } as any;
}

function createService(env: Record<string, unknown> = {}) {
  return new RealtimeAuthService({
    DB: {} as D1Database,
    CACHE_KV: createKV(),
    JWT_SECRET: jwtSecret,
    REALTIME_JWT_SECRET: realtimeSecret,
    REALTIME_WS_URL: "wss://realtime.example.test",
    NODE_ENV: "test",
    ...env,
  } as any);
}

describe("RealtimeAuthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    mocks.blacklist.isTokenRevoked.mockResolvedValue(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("requires a strong realtime JWT secret", () => {
    expect(
      () =>
        new RealtimeAuthService({
          DB: {} as D1Database,
          CACHE_KV: createKV(),
          REALTIME_JWT_SECRET: "short",
          JWT_SECRET: jwtSecret,
        } as any),
    ).toThrow("REALTIME_JWT_SECRET must be set and at least 32 characters");
  });

  it("generates and verifies customer websocket tokens", async () => {
    const service = createService();

    const response = await service.generateWebSocketToken({
      roomType: "customer",
      roomId: "customer:table-1",
      restaurantId: "restaurant-1",
    });

    expect(response).toMatchObject({
      expiresIn: 300,
      wsUrl: expect.stringMatching(
        /^wss:\/\/realtime\.example\.test\/customer\/customer:table-1\?token=/,
      ),
    });
    const verification = await service.verifyWebSocketToken(
      "token" in response ? response.token : "",
    );
    expect(verification).toMatchObject({
      valid: true,
      payload: {
        roomType: "customer",
        roomId: "customer:table-1",
        restaurantId: "restaurant-1",
        role: "customer",
        exp: 1780790700,
        iat: 1780790400,
      },
    });
  });

  it("rejects invalid staff room requests before issuing tokens", async () => {
    const service = createService();

    await expect(
      service.generateWebSocketToken({
        roomType: "kitchen",
        roomId: "restaurant-1",
        restaurantId: "restaurant-1",
      }),
    ).resolves.toEqual({ error: "Session ID required for this room type" });
    await expect(
      service.generateWebSocketToken({
        roomType: "admin",
        roomId: "other-restaurant",
        restaurantId: "restaurant-1",
        sessionId: "session",
      }),
    ).resolves.toEqual({ error: "Room ID must match restaurant ID" });
  });

  it("generates staff tokens from valid session JWTs in token-only test mode", async () => {
    const service = createService({ DB: {} });
    const sessionId = sign(
      {
        id: 7,
        username: "chef",
        role: 2,
        restaurantId: "restaurant-1",
        tv: 1,
      },
      jwtSecret,
      { expiresIn: "1h" },
    );

    const response = await service.generateWebSocketToken({
      roomType: "kitchen",
      roomId: "restaurant-1",
      restaurantId: "restaurant-1",
      sessionId,
    });

    expect(response).toMatchObject({
      expiresIn: 300,
      wsUrl: expect.stringContaining("/kitchen/restaurant-1?token="),
    });
    await expect(
      service.verifyWebSocketToken("token" in response ? response.token : ""),
    ).resolves.toMatchObject({
      valid: true,
      payload: {
        roomType: "kitchen",
        roomId: "restaurant-1",
        restaurantId: "restaurant-1",
        role: "staff",
        userId: 7,
        appRole: 2,
      },
    });
  });

  it("generates scoped guest realtime tokens from cached guest order tokens", async () => {
    const cache = createKV({
      "guest_token:guest-1": {
        restaurantId: "restaurant-1",
        orderId: "42",
      },
    });
    const service = createService({ CACHE_KV: cache });

    const response = await service.generateGuestToken({
      restaurantId: "restaurant-1",
      orderId: "42",
      guestToken: "guest-1",
    });

    expect(response).toMatchObject({
      expiresAt: "2026-06-07T00:15:00.000Z",
      wsUrl: expect.stringMatching(
        /^wss:\/\/realtime\.example\.test\/customer\/order:42\?token=/,
      ),
    });
    await expect(
      service.verifyWebSocketToken("token" in response ? response.token : ""),
    ).resolves.toMatchObject({
      valid: true,
      payload: {
        roomType: "customer",
        roomId: "order:42",
        restaurantId: "restaurant-1",
        role: "customer",
        guestFlag: true,
        scope: "guest-realtime",
        orderId: "42",
      },
    });
    expect(cache.get).toHaveBeenCalledWith("guest_token:guest-1", "json");
  });

  it("enforces guest realtime channel scope", () => {
    const service = createService();

    expect(
      service.verifyChannelAccess(
        {
          roomType: "customer",
          roomId: "order:42",
          restaurantId: "restaurant-1",
          role: "customer",
          scope: "guest-realtime",
          orderId: "42",
          exp: 1,
          iat: 1,
        },
        "order:42",
      ),
    ).toEqual({ allowed: true });
    expect(
      service.verifyChannelAccess(
        {
          roomType: "customer",
          roomId: "order:42",
          restaurantId: "restaurant-1",
          role: "customer",
          scope: "guest-realtime",
          orderId: "42",
          exp: 1,
          iat: 1,
        },
        "order:99",
      ),
    ).toEqual({
      allowed: false,
      error: "Token is not scoped to this channel",
    });
    expect(
      service.verifyChannelAccess(
        {
          roomType: "restaurant",
          roomId: "restaurant-1",
          restaurantId: "restaurant-1",
          role: "admin",
          exp: 1,
          iat: 1,
        },
        "anything",
      ),
    ).toEqual({ allowed: true });
  });

  it("reports revoked tokens and delegates blacklist operations", async () => {
    mocks.blacklist.isTokenRevoked.mockResolvedValueOnce(true);
    mocks.blacklist.revokeToken.mockResolvedValue({ success: true });
    mocks.blacklist.revokeUserTokens.mockResolvedValue({
      success: true,
      count: 3,
    });
    mocks.blacklist.getStats.mockResolvedValue({
      estimatedCount: 3,
      sampleRecords: [{ tokenId: "token-1" }],
    });
    const service = createService();

    await expect(
      service.verifyWebSocketToken("revoked-token"),
    ).resolves.toEqual({
      valid: false,
      error: "Token has been revoked",
      revoked: true,
    });
    await expect(
      service.revokeToken("token-1", "logout", "admin"),
    ).resolves.toEqual({ success: true });
    await expect(
      service.revokeUserTokens("7", "permission_change", "admin"),
    ).resolves.toEqual({ success: true, count: 3 });
    await expect(service.isTokenRevoked("token-2")).resolves.toBe(false);
    await expect(service.getBlacklistStats()).resolves.toEqual({
      available: true,
      estimatedCount: 3,
      sampleRecords: [{ tokenId: "token-1" }],
    });

    expect(mocks.blacklist.revokeToken).toHaveBeenCalledWith(
      "token-1",
      "logout",
      {
        revokedBy: "admin",
      },
    );
    expect(mocks.blacklist.revokeUserTokens).toHaveBeenCalledWith(
      "7",
      "permission_change",
      "admin",
    );
  });
});
