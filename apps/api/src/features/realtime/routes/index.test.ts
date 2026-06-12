import { beforeEach, describe, expect, it, vi } from "vitest";
import routes from "./index";

const serviceMethods = vi.hoisted(() => ({
  generateWebSocketToken: vi.fn(),
  generateGuestToken: vi.fn(),
  verifyWebSocketToken: vi.fn(),
  verifyChannelAccess: vi.fn(),
  revokeToken: vi.fn(),
  revokeUserTokens: vi.fn(),
  getBlacklistStats: vi.fn(),
}));

const realtimeAuthService = vi.hoisted(() =>
  vi.fn(function RealtimeAuthService() {
    return serviceMethods;
  }),
);

vi.mock("../services/RealtimeAuthService", () => ({
  RealtimeAuthService: realtimeAuthService,
}));

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
}

function createEnv(input?: {
  durableFetch?: (request: Request) => Response | Promise<Response>;
}) {
  const durableFetch = vi.fn(
    input?.durableFetch ?? (() => jsonResponse({ connectionCount: 0 })),
  );
  const durableObject = {
    fetch: durableFetch,
  };

  return {
    DB: {},
    JWT_SECRET: "x".repeat(32),
    REALTIME_JWT_SECRET: "y".repeat(32),
    REALTIME_SERVICE_URL: "https://realtime.test",
    REALTIME_SESSION: {
      idFromName: vi.fn((name: string) => ({ name })),
      get: vi.fn(() => durableObject),
    },
  };
}

function jsonRequest(path: string, body: unknown): Request {
  return new Request(`https://api.test${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

async function withSilencedRouteError<T>(action: () => Promise<T>): Promise<T> {
  const consoleError = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);
  try {
    return await action();
  } finally {
    consoleError.mockRestore();
  }
}

describe("realtime routes", () => {
  beforeEach(() => {
    realtimeAuthService.mockClear();
    for (const method of Object.values(serviceMethods)) {
      method.mockReset();
    }
    vi.restoreAllMocks();
  });

  it("generates staff websocket tokens from validated request bodies", async () => {
    serviceMethods.generateWebSocketToken.mockResolvedValue({
      token: "ws-token",
      expiresIn: 300,
      wsUrl: "wss://realtime.test/kitchen/restaurant-1?token=ws-token",
    });
    const env = createEnv();

    const response = await routes.fetch(
      jsonRequest("/auth/token", {
        roomType: "kitchen",
        roomId: "restaurant-1",
        restaurantId: "restaurant-1",
        sessionId: "session-token",
      }),
      env as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { token: "ws-token", expiresIn: 300 },
    });
    expect(realtimeAuthService).toHaveBeenCalledWith(env);
    expect(serviceMethods.generateWebSocketToken).toHaveBeenCalledWith({
      roomType: "kitchen",
      roomId: "restaurant-1",
      restaurantId: "restaurant-1",
      sessionId: "session-token",
    });
  });

  it("maps websocket token service errors and validation failures to route errors", async () => {
    serviceMethods.generateWebSocketToken.mockResolvedValue({
      error: "Room ID must match restaurant ID",
    });

    const serviceErrorResponse = await withSilencedRouteError(() =>
      routes.fetch(
        jsonRequest("/auth/token", {
          roomType: "kitchen",
          roomId: "other",
          restaurantId: "restaurant-1",
          sessionId: "session-token",
        }),
        createEnv() as never,
      ),
    );
    expect(serviceErrorResponse.status).toBe(500);

    const validationResponse = await withSilencedRouteError(() =>
      routes.fetch(
        jsonRequest("/auth/token", {
          roomType: "kitchen",
          roomId: "",
          restaurantId: "restaurant-1",
        }),
        createEnv() as never,
      ),
    );
    expect(validationResponse.status).toBe(500);
    expect(serviceMethods.generateWebSocketToken).toHaveBeenCalledTimes(1);
  });

  it("generates guest tokens and skips rate limiting for test requests without an IP", async () => {
    serviceMethods.generateGuestToken.mockResolvedValue({
      token: "guest-ws-token",
      expiresAt: "2026-06-07T12:15:00.000Z",
      wsUrl: "wss://realtime.test/customer/order:100?token=guest-ws-token",
    });

    const response = await routes.fetch(
      jsonRequest("/auth/guest-token", {
        restaurantId: "restaurant-1",
        guestToken: `gt_${"a".repeat(64)}`,
        orderId: 100,
      }),
      createEnv() as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { token: "guest-ws-token" },
    });
    expect(serviceMethods.generateGuestToken).toHaveBeenCalledWith({
      restaurantId: "restaurant-1",
      guestToken: `gt_${"a".repeat(64)}`,
      orderId: "100",
    });
  });

  it("verifies websocket tokens and optional scoped channel access", async () => {
    const payload = {
      roomType: "customer",
      roomId: "order:100",
      restaurantId: "restaurant-1",
      role: "customer",
      scope: "guest-realtime",
      orderId: "100",
    };
    serviceMethods.verifyWebSocketToken.mockResolvedValue({
      valid: true,
      payload,
    });
    serviceMethods.verifyChannelAccess.mockReturnValue({ allowed: true });

    const response = await routes.fetch(
      jsonRequest("/auth/verify", {
        token: "token",
        channel: "order:100",
      }),
      createEnv() as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { valid: true, payload },
    });
    expect(serviceMethods.verifyWebSocketToken).toHaveBeenCalledWith("token");
    expect(serviceMethods.verifyChannelAccess).toHaveBeenCalledWith(
      payload,
      "order:100",
    );
  });

  it("rejects invalid tokens and denied channel access", async () => {
    serviceMethods.verifyWebSocketToken.mockResolvedValueOnce({
      valid: false,
      error: "Invalid token",
    });

    const invalidResponse = await withSilencedRouteError(() =>
      routes.fetch(
        jsonRequest("/auth/verify", { token: "bad", channel: "order:100" }),
        createEnv() as never,
      ),
    );
    expect(invalidResponse.status).toBe(500);

    serviceMethods.verifyWebSocketToken.mockResolvedValueOnce({
      valid: true,
      payload: { roomType: "customer", roomId: "order:100" },
    });
    serviceMethods.verifyChannelAccess.mockReturnValue({
      allowed: false,
      error: "Token is not scoped to this channel",
    });

    const deniedResponse = await withSilencedRouteError(() =>
      routes.fetch(
        jsonRequest("/auth/verify", {
          token: "token",
          channel: "order:200",
        }),
        createEnv() as never,
      ),
    );
    expect(deniedResponse.status).toBe(500);
  });

  it("revokes individual and user tokens and reports blacklist stats", async () => {
    serviceMethods.revokeToken.mockResolvedValue({ success: true });
    serviceMethods.revokeUserTokens.mockResolvedValue({
      success: true,
      count: 3,
    });
    serviceMethods.getBlacklistStats.mockResolvedValue({
      available: true,
      estimatedCount: 7,
    });

    const revokeResponse = await routes.fetch(
      jsonRequest("/auth/revoke", {
        token: "token",
        reason: "logout",
        revokedBy: "user-1",
      }),
      createEnv() as never,
    );
    const userResponse = await routes.fetch(
      jsonRequest("/auth/revoke-user", {
        userId: "user-1",
        reason: "admin_action",
        revokedBy: "admin-1",
      }),
      createEnv() as never,
    );
    const statsResponse = await routes.fetch(
      new Request("https://api.test/auth/blacklist/stats"),
      createEnv() as never,
    );

    expect(revokeResponse.status).toBe(200);
    expect(userResponse.status).toBe(200);
    expect(statsResponse.status).toBe(200);
    await expect(userResponse.json()).resolves.toMatchObject({
      success: true,
      data: { userId: "user-1", revokedCount: 3 },
    });
    await expect(statsResponse.json()).resolves.toMatchObject({
      success: true,
      data: { available: true, estimatedCount: 7 },
    });
    expect(serviceMethods.revokeToken).toHaveBeenCalledWith(
      "token",
      "logout",
      "user-1",
    );
  });

  it("returns route errors when revocation service operations fail", async () => {
    serviceMethods.revokeToken.mockResolvedValue({
      success: false,
      error: "blacklist unavailable",
    });
    const revokeResponse = await withSilencedRouteError(() =>
      routes.fetch(
        jsonRequest("/auth/revoke", { token: "token", reason: "manual" }),
        createEnv() as never,
      ),
    );
    expect(revokeResponse.status).toBe(500);

    serviceMethods.revokeUserTokens.mockResolvedValue({
      success: false,
      error: "blacklist unavailable",
    });
    const userResponse = await withSilencedRouteError(() =>
      routes.fetch(
        jsonRequest("/auth/revoke-user", { userId: "user-1" }),
        createEnv() as never,
      ),
    );
    expect(userResponse.status).toBe(500);
  });

  it("reads room stats through the realtime Durable Object binding", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const env = createEnv({
      durableFetch: async (request) => {
        expect(request.url).toBe("https://realtime-internal/stats");
        expect(request.method).toBe("GET");
        return jsonResponse({ connectionCount: 4 });
      },
    });

    const response = await routes.fetch(
      new Request("https://api.test/stats/kitchen/restaurant-1"),
      env as never,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { connectionCount: 4 },
    });
    expect(env.REALTIME_SESSION.idFromName).toHaveBeenCalledWith(
      "kitchen:restaurant-1",
    );
    expect(fetchMock).not.toHaveBeenCalled();

    const invalidResponse = await withSilencedRouteError(() =>
      routes.fetch(
        new Request("https://api.test/stats/unknown/restaurant-1"),
        createEnv() as never,
      ),
    );
    expect(invalidResponse.status).toBe(500);

    const failingEnv = createEnv({
      durableFetch: async () => new Response("down", { status: 503 }),
    });
    const failedResponse = await withSilencedRouteError(() =>
      routes.fetch(
        new Request("https://api.test/stats/admin/restaurant-1"),
        failingEnv as never,
      ),
    );
    expect(failedResponse.status).toBe(500);
  });

  it("aggregates overview stats across realtime room types", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const env = createEnv({
      durableFetch: vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ connectionCount: 2 }))
        .mockResolvedValueOnce(new Response("inactive", { status: 503 }))
        .mockRejectedValueOnce(new Error("network")),
    });

    const response = await routes.fetch(
      new Request("https://api.test/stats/overview?restaurantId=restaurant-1"),
      env as never,
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      data: {
        restaurantId: "restaurant-1",
        totalConnections: 2,
        health: { status: "healthy" },
      },
    });
    expect(body.data.roomStats).toEqual([
      { roomType: "kitchen", connectionCount: 2, status: "active" },
      { roomType: "admin", connectionCount: 0, status: "inactive" },
      { roomType: "customer", connectionCount: 0, status: "error" },
    ]);
    expect(env.REALTIME_SESSION.idFromName).toHaveBeenCalledWith(
      "kitchen:restaurant-1",
    );
    expect(env.REALTIME_SESSION.idFromName).toHaveBeenCalledWith(
      "admin:restaurant-1",
    );
    expect(env.REALTIME_SESSION.idFromName).toHaveBeenCalledWith(
      "customer:restaurant-1",
    );
    expect(fetchMock).not.toHaveBeenCalled();

    const missingResponse = await withSilencedRouteError(() =>
      routes.fetch(
        new Request("https://api.test/stats/overview"),
        createEnv() as never,
      ),
    );
    expect(missingResponse.status).toBe(500);
  });

  it("reports realtime health for up, down, and unreachable service states", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ version: "1.0.0" }), {
        status: 200,
      }),
    );
    const healthyResponse = await routes.fetch(
      new Request("https://api.test/health"),
      createEnv() as never,
    );
    expect(healthyResponse.status).toBe(200);
    await expect(healthyResponse.json()).resolves.toMatchObject({
      success: true,
      data: { status: "healthy", realtimeService: "up", version: "1.0.0" },
    });

    fetchMock.mockResolvedValueOnce(new Response("down", { status: 503 }));
    const downResponse = await routes.fetch(
      new Request("https://api.test/health"),
      createEnv() as never,
    );
    expect(downResponse.status).toBe(200);
    await expect(downResponse.json()).resolves.toMatchObject({
      success: false,
      data: { status: "unhealthy", realtimeService: "down" },
    });

    fetchMock.mockRejectedValueOnce(new Error("network"));
    const degradedResponse = await routes.fetch(
      new Request("https://api.test/health"),
      createEnv() as never,
    );
    expect(degradedResponse.status).toBe(200);
    await expect(degradedResponse.json()).resolves.toMatchObject({
      success: true,
      data: { status: "degraded", realtimeService: "unreachable" },
    });
  });
});
