import { sign } from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const dbState: {
    selectResults: unknown[][];
    selectError: Error | null;
  } = {
    selectResults: [],
    selectError: null,
  };
  const createQuery = () => ({
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: vi.fn((resolve, reject) => {
      if (dbState.selectError) {
        return Promise.reject(dbState.selectError).then(resolve, reject);
      }
      return Promise.resolve(dbState.selectResults.shift() ?? []).then(
        resolve,
        reject,
      );
    }),
  });
  const db = {
    select: vi.fn(() => createQuery()),
  };
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
  const utils = {
    parseSignedQRUrl: vi.fn(),
    verifyQRSignature: vi.fn(),
  };

  return { blacklist, db, dbState, logger, utils };
});

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mocks.db),
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

vi.mock("@makanmakan/utils", async () => {
  const actual =
    await vi.importActual<typeof import("@makanmakan/utils")>(
      "@makanmakan/utils",
    );
  return {
    ...actual,
    parseSignedQRUrl: mocks.utils.parseSignedQRUrl,
    verifyQRSignature: mocks.utils.verifyQRSignature,
  };
});

import { RealtimeAuthService } from "./RealtimeAuthService";

const realtimeSecret = "realtime-secret-with-at-least-32-chars";
const jwtSecret = "session-secret-with-at-least-32-chars";
const qrSigningKey = "qr-signing-key-with-at-least-32-chars";
const userId = "018f0000-0000-7000-8000-000000000007";
const ownerId = "018f0000-0000-7000-8000-000000000001";

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
    QR_SIGNING_KEY: qrSigningKey,
    REALTIME_WS_URL: "wss://realtime.example.test",
    NODE_ENV: "test",
    ...env,
  } as any);
}

function createSessionToken(
  payload: Record<string, unknown>,
  options: { expiresIn?: string | number; notBefore?: string | number } = {
    expiresIn: "1h",
  },
) {
  const signOptions = Object.fromEntries(
    Object.entries(options).filter(([, value]) => value !== undefined),
  );

  return sign(
    {
      sub: userId,
      username: "chef",
      role: 2,
      restaurantId: "restaurant-1",
      tv: 1,
      ...payload,
    },
    jwtSecret,
    signOptions,
  );
}

function createPreparedDb(
  row: unknown,
  options: { throwOnFirst?: boolean } = {},
) {
  const first = options.throwOnFirst
    ? vi.fn(async () => {
        throw new Error("database unavailable");
      })
    : vi.fn(async () => row);
  const bind = vi.fn(() => ({ first }));
  const prepare = vi.fn(() => ({ bind }));
  return { prepare, bind, first };
}

describe("RealtimeAuthService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.dbState.selectResults = [];
    mocks.dbState.selectError = null;
    mocks.utils.parseSignedQRUrl.mockReturnValue(null);
    mocks.utils.verifyQRSignature.mockResolvedValue(false);
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

  it("validates customer table and seat access before issuing tokens", async () => {
    mocks.dbState.selectResults = [[{ id: 10 }], [{ id: 21 }], [], []];
    const service = createService();

    const response = await service.generateWebSocketToken({
      roomType: "customer",
      roomId: "customer:10",
      restaurantId: "restaurant-1",
      tableId: "10",
      seatId: "seat-1",
    });

    expect(response).toMatchObject({ expiresIn: 300 });
    await expect(
      service.generateWebSocketToken({
        roomType: "customer",
        roomId: "customer:missing-table",
        restaurantId: "restaurant-1",
        tableId: "missing-table",
      }),
    ).resolves.toEqual({ error: "Invalid table ID" });
    await expect(
      service.generateWebSocketToken({
        roomType: "customer",
        roomId: "customer:missing-seat",
        restaurantId: "restaurant-1",
        seatId: "missing-seat",
      }),
    ).resolves.toEqual({ error: "Invalid seat ID" });
    expect(mocks.db.select).toHaveBeenCalledTimes(4);
  });

  it("rejects invalid room types and wraps token generation failures", async () => {
    const service = createService();

    await expect(
      service.generateWebSocketToken({
        roomType: "unknown" as any,
        roomId: "room-1",
        restaurantId: "restaurant-1",
      }),
    ).resolves.toEqual({ error: "Invalid room type" });

    mocks.dbState.selectError = new Error("table lookup failed");
    await expect(
      service.generateWebSocketToken({
        roomType: "customer",
        roomId: "customer:1",
        restaurantId: "restaurant-1",
        tableId: "1",
      }),
    ).resolves.toEqual({ error: "Invalid table ID" });
  });

  it("generates staff tokens from valid session JWTs in token-only test mode", async () => {
    const service = createService({ DB: {} });
    const sessionId = sign(
      {
        sub: userId,
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
        userId,
        appRole: 2,
      },
    });
  });

  it("loads active session users from DB and derives admin staff roles", async () => {
    const prepared = createPreparedDb({
      id: ownerId,
      username: "owner",
      role: 1,
      restaurant_id: "restaurant-1",
      is_active: 1,
      token_version: 2,
    });
    const service = createService({ DB: { prepare: prepared.prepare } });
    const sessionId = createSessionToken({
      sub: ownerId,
      username: "owner",
      role: 1,
      restaurantId: "restaurant-1",
      tv: 2,
    });

    const response = await service.generateWebSocketToken({
      roomType: "kitchen",
      roomId: "restaurant-1",
      restaurantId: "restaurant-1",
      sessionId,
    });

    expect(response).toMatchObject({ expiresIn: 300 });
    await expect(
      service.verifyWebSocketToken("token" in response ? response.token : ""),
    ).resolves.toMatchObject({
      valid: true,
      payload: {
        role: "admin",
        appRole: 1,
        userId: ownerId,
      },
    });
    expect(prepared.prepare).toHaveBeenCalled();
    expect(prepared.bind).toHaveBeenCalledWith(ownerId);
  });

  it("loads UUID-principal session users from DB and emits public user ids", async () => {
    const publicUserId = ownerId;
    const prepared = createPreparedDb({
      id: publicUserId,
      username: "owner",
      role: 1,
      restaurant_id: "restaurant-1",
      is_active: 1,
      token_version: 2,
    });
    const service = createService({ DB: { prepare: prepared.prepare } });
    const sessionId = createSessionToken({
      sub: publicUserId,
      username: "owner",
      role: 1,
      restaurantId: "restaurant-1",
      tv: 2,
    });

    const response = await service.generateWebSocketToken({
      roomType: "kitchen",
      roomId: "restaurant-1",
      restaurantId: "restaurant-1",
      sessionId,
    });

    expect(response).toMatchObject({ expiresIn: 300 });
    await expect(
      service.verifyWebSocketToken("token" in response ? response.token : ""),
    ).resolves.toMatchObject({
      valid: true,
      payload: {
        role: "admin",
        appRole: 1,
        userId: publicUserId,
        publicUserId,
      },
    });
    expect(prepared.prepare).toHaveBeenCalledWith(
      expect.stringContaining("WHERE id = ?"),
    );
    expect(prepared.bind).toHaveBeenCalledWith(publicUserId);
  });

  it("allows platform admins to access any restaurant room", async () => {
    const prepared = createPreparedDb({
      id: ownerId,
      username: "admin",
      role: 0,
      restaurant_id: null,
      is_active: true,
      token_version: 1,
    });
    const service = createService({ DB: { prepare: prepared.prepare } });
    const sessionId = createSessionToken({
      sub: ownerId,
      username: "admin",
      role: 0,
      restaurantId: "hq",
    });

    const response = await service.generateWebSocketToken({
      roomType: "restaurant",
      roomId: "restaurant-2",
      restaurantId: "restaurant-2",
      sessionId,
    });

    expect(response).toMatchObject({ expiresIn: 300 });
  });

  it("returns precise session validation errors", async () => {
    const service = createService({
      TOKEN_BLACKLIST: createKV({ "token:blacklisted": "1" }),
    });

    await expect(
      service.generateWebSocketToken({
        roomType: "admin",
        roomId: "restaurant-1",
        restaurantId: "restaurant-1",
        sessionId: "blacklisted",
      }),
    ).resolves.toEqual({ error: "Session token has been invalidated" });
    await expect(
      createService({ JWT_SECRET: "short-secret" }).generateWebSocketToken({
        roomType: "admin",
        roomId: "restaurant-1",
        restaurantId: "restaurant-1",
        sessionId: "session",
      }),
    ).resolves.toEqual({ error: "JWT_SECRET is not configured" });
    await expect(
      createService().generateWebSocketToken({
        roomType: "admin",
        roomId: "restaurant-1",
        restaurantId: "restaurant-1",
        sessionId: "not-a-jwt",
      }),
    ).resolves.toEqual({ error: "Invalid session token" });
    await expect(
      createService().generateWebSocketToken({
        roomType: "admin",
        roomId: "restaurant-1",
        restaurantId: "restaurant-1",
        sessionId: createSessionToken({ exp: 1 }, { expiresIn: undefined }),
      }),
    ).resolves.toEqual({ error: "Session token expired" });
    await expect(
      createService().generateWebSocketToken({
        roomType: "admin",
        roomId: "restaurant-1",
        restaurantId: "restaurant-1",
        sessionId: createSessionToken({}, { notBefore: "1h" }),
      }),
    ).resolves.toEqual({ error: "Session token not yet valid" });
  });

  it("rejects malformed or unauthorized session claims", async () => {
    const service = createService();

    await expect(
      service.generateWebSocketToken({
        roomType: "admin",
        roomId: "restaurant-1",
        restaurantId: "restaurant-1",
        sessionId: sign(
          { sub: "not-a-uuid", username: "chef", role: 2 },
          jwtSecret,
          {
            expiresIn: "1h",
          },
        ),
      }),
    ).resolves.toEqual({ error: "Invalid session token claims" });
    await expect(
      service.generateWebSocketToken({
        roomType: "admin",
        roomId: "restaurant-1",
        restaurantId: "restaurant-1",
        sessionId: createSessionToken({ iat: 1780790465 }),
      }),
    ).resolves.toEqual({ error: "Session token issued in future" });
    await expect(
      service.generateWebSocketToken({
        roomType: "admin",
        roomId: "restaurant-1",
        restaurantId: "restaurant-1",
        sessionId: createSessionToken({ nbf: 1780790465 }),
      }),
    ).resolves.toEqual({ error: "Session token not yet valid" });
    await expect(
      service.generateWebSocketToken({
        roomType: "admin",
        roomId: "restaurant-1",
        restaurantId: "restaurant-1",
        sessionId: createSessionToken({ role: 5 }),
      }),
    ).resolves.toEqual({
      error: "Session role is not allowed for realtime rooms",
    });
    await expect(
      service.generateWebSocketToken({
        roomType: "restaurant",
        roomId: "restaurant-1",
        restaurantId: "restaurant-1",
        sessionId: createSessionToken({ role: 2 }),
      }),
    ).resolves.toEqual({
      error: "Session role cannot access this realtime room",
    });
  });

  it("rejects inactive, stale, mismatched, and cross-restaurant DB users", async () => {
    const cases = [
      {
        row: {
          id: userId,
          username: "chef",
          role: 2,
          restaurant_id: "restaurant-1",
          is_active: 0,
          token_version: 1,
        },
        error: "User not found or inactive",
      },
      {
        row: {
          id: userId,
          username: "chef",
          role: 2,
          restaurant_id: "restaurant-1",
          is_active: 1,
          token_version: 2,
        },
        error: "Session token has been invalidated",
      },
      {
        row: {
          id: userId,
          username: "other",
          role: 2,
          restaurant_id: "restaurant-1",
          is_active: 1,
          token_version: 1,
        },
        error: "Invalid session token claims",
      },
      {
        row: {
          id: userId,
          username: "chef",
          role: 2,
          restaurant_id: "restaurant-2",
          is_active: 1,
          token_version: 1,
        },
        error: "User does not have access to this restaurant",
      },
    ];

    for (const { row, error } of cases) {
      const prepared = createPreparedDb(row);
      await expect(
        createService({
          DB: { prepare: prepared.prepare },
        }).generateWebSocketToken({
          roomType: "kitchen",
          roomId: "restaurant-1",
          restaurantId: "restaurant-1",
          sessionId: createSessionToken({}),
        }),
      ).resolves.toEqual({ error });
    }
  });

  it("handles user lookup absence and database failures by environment", async () => {
    await expect(
      createService({ NODE_ENV: "production", DB: {} }).generateWebSocketToken({
        roomType: "kitchen",
        roomId: "restaurant-1",
        restaurantId: "restaurant-1",
        sessionId: createSessionToken({}),
      }),
    ).resolves.toEqual({ error: "User lookup unavailable" });

    const throwingDb = createPreparedDb(null, { throwOnFirst: true });
    await expect(
      createService({
        NODE_ENV: "production",
        DB: { prepare: throwingDb.prepare },
      }).generateWebSocketToken({
        roomType: "kitchen",
        roomId: "restaurant-1",
        restaurantId: "restaurant-1",
        sessionId: createSessionToken({}),
      }),
    ).resolves.toEqual({ error: "Failed to validate session user" });

    const testThrowingDb = createPreparedDb(null, { throwOnFirst: true });
    await expect(
      createService({
        DB: { prepare: testThrowingDb.prepare },
      }).generateWebSocketToken({
        roomType: "kitchen",
        roomId: "restaurant-1",
        restaurantId: "restaurant-1",
        sessionId: createSessionToken({}),
      }),
    ).resolves.toMatchObject({ expiresIn: 300 });
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

  it("generates guest table tokens from signed QR codes", async () => {
    mocks.utils.parseSignedQRUrl.mockReturnValue({
      type: "table",
      restaurantId: "restaurant-1",
      identifier: "T1",
      version: 1,
      signature: "signature",
    });
    mocks.utils.verifyQRSignature.mockResolvedValue(true);
    mocks.dbState.selectResults = [
      [
        {
          id: "restaurant-1",
          settings: { allowGuestOrders: true },
          isActive: true,
          isAvailable: true,
        },
      ],
      [
        {
          id: 10,
          restaurantId: "restaurant-1",
          number: "T1",
          isActive: true,
        },
      ],
    ];
    const service = createService();

    const response = await service.generateGuestToken({
      restaurantId: "restaurant-1",
      tableId: "10",
      qrCode: "signed-qr",
    });

    expect(response).toMatchObject({
      expiresAt: "2026-06-07T00:15:00.000Z",
      wsUrl: expect.stringContaining("/customer/customer:10?token="),
    });
    await expect(
      service.verifyWebSocketToken("token" in response ? response.token : ""),
    ).resolves.toMatchObject({
      valid: true,
      payload: {
        guestFlag: true,
        tableId: "10",
        roomId: "customer:10",
      },
    });
    expect(mocks.utils.verifyQRSignature).toHaveBeenCalledWith(
      {
        type: "table",
        restaurantId: "restaurant-1",
        identifier: "T1",
        version: 1,
      },
      "signature",
      qrSigningKey,
    );
  });

  it("validates signed QR guest order ownership", async () => {
    const publicId = "018f0000-0000-7000-8000-000000000042";
    mocks.utils.parseSignedQRUrl.mockReturnValue({
      type: "table",
      restaurantId: "restaurant-1",
      identifier: "T1",
      version: 1,
      signature: "signature",
    });
    mocks.utils.verifyQRSignature.mockResolvedValue(true);
    mocks.dbState.selectResults = [
      [
        {
          id: "restaurant-1",
          settings: { allowGuestOrders: true },
          isActive: true,
          isAvailable: true,
        },
      ],
      [
        {
          id: 10,
          restaurantId: "restaurant-1",
          number: "T1",
          isActive: true,
        },
      ],
      [{ id: 42, publicId, restaurantId: "restaurant-1", tableId: 10 }],
      [
        {
          id: "restaurant-1",
          settings: { allowGuestOrders: true },
          isActive: true,
          isAvailable: true,
        },
      ],
      [
        {
          id: 10,
          restaurantId: "restaurant-1",
          number: "T1",
          isActive: true,
        },
      ],
      [{ id: 42, publicId, restaurantId: "restaurant-1", tableId: 10 }],
      [
        {
          id: "restaurant-1",
          settings: { allowGuestOrders: true },
          isActive: true,
          isAvailable: true,
        },
      ],
      [
        {
          id: 10,
          restaurantId: "restaurant-1",
          number: "T1",
          isActive: true,
        },
      ],
      [{ id: 43, restaurantId: "restaurant-2", tableId: 10 }],
    ];
    const service = createService();

    await expect(
      service.generateGuestToken({
        restaurantId: "restaurant-1",
        tableId: "10",
        orderId: "42",
        qrCode: "signed-qr",
      }),
    ).resolves.toMatchObject({
      expiresAt: "2026-06-07T00:15:00.000Z",
      wsUrl: expect.stringContaining("/customer/order:42?token="),
    });
    await expect(
      service.generateGuestToken({
        restaurantId: "restaurant-1",
        tableId: "10",
        orderId: publicId,
        qrCode: "signed-qr",
      }),
    ).resolves.toMatchObject({
      expiresAt: "2026-06-07T00:15:00.000Z",
      wsUrl: expect.stringContaining(`/customer/order:${publicId}?token=`),
    });
    await expect(
      service.generateGuestToken({
        restaurantId: "restaurant-1",
        tableId: "10",
        orderId: "43",
        qrCode: "signed-qr",
      }),
    ).resolves.toEqual({ error: "Order does not belong to this table" });
  });

  it("returns guest token validation errors", async () => {
    const service = createService({
      CACHE_KV: createKV({
        "guest_token:wrong": {
          restaurantId: "restaurant-2",
          orderId: "99",
        },
      }),
    });

    await expect(
      service.generateGuestToken({
        restaurantId: "restaurant-1",
        orderId: "42",
        guestToken: "missing",
      }),
    ).resolves.toEqual({ error: "Guest token expired or invalid" });
    await expect(
      service.generateGuestToken({
        restaurantId: "restaurant-1",
        orderId: "42",
        guestToken: "wrong",
      }),
    ).resolves.toEqual({ error: "Guest token does not match this order" });
    await expect(
      service.generateGuestToken({
        restaurantId: "restaurant-1",
      }),
    ).resolves.toEqual({
      error: "A guest token or signed table QR code is required",
    });
    await expect(
      service.generateGuestToken({
        restaurantId: "restaurant-1",
        tableId: "10",
        qrCode: "bad-qr",
      }),
    ).resolves.toEqual({
      error: "A valid signed table QR code is required",
    });

    mocks.utils.parseSignedQRUrl.mockReturnValue({
      type: "table",
      restaurantId: "restaurant-1",
      identifier: "T1",
      version: 1,
      signature: "signature",
    });
    await expect(
      service.generateGuestToken({
        restaurantId: "restaurant-1",
        tableId: "10",
        qrCode: "signed-qr",
      }),
    ).resolves.toEqual({ error: "Invalid QR signature" });

    mocks.utils.verifyQRSignature.mockResolvedValue(true);
    mocks.utils.parseSignedQRUrl.mockReturnValue({
      type: "table",
      restaurantId: "restaurant-2",
      identifier: "T1",
      version: 1,
      signature: "signature",
    });
    await expect(
      service.generateGuestToken({
        restaurantId: "restaurant-1",
        tableId: "10",
        qrCode: "signed-qr",
      }),
    ).resolves.toEqual({ error: "QR code does not match restaurant" });
  });

  it("returns guest restaurant and table validation errors", async () => {
    mocks.utils.parseSignedQRUrl.mockReturnValue({
      type: "table",
      restaurantId: "restaurant-1",
      identifier: "T1",
      version: 1,
      signature: "signature",
    });
    mocks.utils.verifyQRSignature.mockResolvedValue(true);
    const service = createService();

    mocks.dbState.selectResults = [[]];
    await expect(
      service.generateGuestToken({
        restaurantId: "restaurant-1",
        tableId: "10",
        qrCode: "signed-qr",
      }),
    ).resolves.toEqual({ error: "Restaurant not found" });

    mocks.dbState.selectResults = [
      [
        {
          id: "restaurant-1",
          settings: { allowGuestOrders: false },
          isActive: true,
          isAvailable: true,
        },
      ],
    ];
    await expect(
      service.generateGuestToken({
        restaurantId: "restaurant-1",
        tableId: "10",
        qrCode: "signed-qr",
      }),
    ).resolves.toEqual({
      error: "Guest realtime is not enabled for this restaurant",
    });

    mocks.dbState.selectResults = [
      [
        {
          id: "restaurant-1",
          settings: { allowGuestOrders: true },
          isActive: true,
          isAvailable: true,
        },
      ],
      [],
    ];
    await expect(
      service.generateGuestToken({
        restaurantId: "restaurant-1",
        tableId: "10",
        qrCode: "signed-qr",
      }),
    ).resolves.toEqual({ error: "Table not found or inactive" });

    mocks.dbState.selectResults = [
      [
        {
          id: "restaurant-1",
          settings: { allowGuestOrders: true },
          isActive: true,
          isAvailable: true,
        },
      ],
      [
        {
          id: 10,
          restaurantId: "restaurant-1",
          number: "T2",
          isActive: true,
        },
      ],
    ];
    await expect(
      service.generateGuestToken({
        restaurantId: "restaurant-1",
        tableId: "10",
        qrCode: "signed-qr",
      }),
    ).resolves.toEqual({ error: "QR code does not match table" });
  });

  it("wraps unexpected guest token validation failures", async () => {
    const service = createService({
      CACHE_KV: {
        get: vi.fn(async () => {
          throw new Error("kv unavailable");
        }),
      },
    });

    await expect(
      service.generateGuestToken({
        restaurantId: "restaurant-1",
        orderId: "42",
        guestToken: "guest-1",
      }),
    ).resolves.toEqual({ error: "Failed to generate guest realtime token" });
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
    expect(
      service.verifyChannelAccess(
        {
          roomType: "customer",
          roomId: "order:42",
          restaurantId: "restaurant-1",
          role: "customer",
          scope: "guest-realtime",
          exp: 1,
          iat: 1,
        },
        "order:42",
      ),
    ).toEqual({
      allowed: false,
      error: "Invalid guest token payload",
    });
  });

  it("rejects invalid, expired, and malformed websocket tokens", async () => {
    const service = createService();
    const invalidPayloadToken = sign(
      {
        roomType: "customer",
        roomId: "customer:1",
      },
      realtimeSecret,
    );
    const badGuestToken = sign(
      {
        roomType: "customer",
        roomId: "customer:1",
        restaurantId: "restaurant-1",
        role: "customer",
        guestFlag: true,
        orderId: "42",
        exp: 1780790700,
      },
      realtimeSecret,
    );
    const manuallyExpiredToken = sign(
      {
        roomType: "customer",
        roomId: "customer:1",
        restaurantId: "restaurant-1",
        role: "customer",
        exp: 1780790399,
      },
      realtimeSecret,
      { noTimestamp: true },
    );
    const jwtExpiredToken = sign(
      {
        roomType: "customer",
        roomId: "customer:1",
        restaurantId: "restaurant-1",
        role: "customer",
      },
      realtimeSecret,
      { expiresIn: -1 },
    );

    await expect(
      service.verifyWebSocketToken(invalidPayloadToken),
    ).resolves.toEqual({ valid: false, error: "Invalid token payload" });
    await expect(service.verifyWebSocketToken(badGuestToken)).resolves.toEqual({
      valid: false,
      error: "Invalid guest token payload",
    });
    await expect(
      service.verifyWebSocketToken(manuallyExpiredToken),
    ).resolves.toEqual({ valid: false, error: "Token expired" });
    await expect(
      service.verifyWebSocketToken(jwtExpiredToken),
    ).resolves.toEqual({ valid: false, error: "Token expired" });
    await expect(service.verifyWebSocketToken("not-a-token")).resolves.toEqual({
      valid: false,
      error: "Invalid token",
    });
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

  it("reports unavailable blacklist services and operation failures", async () => {
    await expect(
      createService({
        TOKEN_BLACKLIST: undefined,
        CACHE_KV: undefined,
      }).revokeToken("token-1", "logout"),
    ).resolves.toEqual({
      success: false,
      error: "Token blacklist service not available",
    });
    await expect(
      createService({
        TOKEN_BLACKLIST: undefined,
        CACHE_KV: undefined,
      }).revokeUserTokens("7", "manual"),
    ).resolves.toEqual({
      success: false,
      error: "Token blacklist service not available",
    });
    await expect(
      createService({
        TOKEN_BLACKLIST: undefined,
        CACHE_KV: undefined,
      }).isTokenRevoked("token-1"),
    ).resolves.toBe(false);
    await expect(
      createService({
        TOKEN_BLACKLIST: undefined,
        CACHE_KV: undefined,
      }).getBlacklistStats(),
    ).resolves.toEqual({ available: false });

    mocks.blacklist.revokeToken.mockRejectedValueOnce(new Error("kv failed"));
    mocks.blacklist.revokeUserTokens.mockRejectedValueOnce(
      new Error("kv failed"),
    );
    const service = createService();

    await expect(service.revokeToken("token-1", "logout")).resolves.toEqual({
      success: false,
      error: "Failed to revoke token",
    });
    await expect(service.revokeUserTokens("7", "manual")).resolves.toEqual({
      success: false,
      error: "Failed to revoke user tokens",
    });
  });
});
