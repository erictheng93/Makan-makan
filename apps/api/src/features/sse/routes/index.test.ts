import { beforeEach, describe, expect, it, vi } from "vitest";
import { sign } from "hono/jwt";
import routes from "./index";

const authMiddleware = vi.hoisted(() =>
  vi.fn(async (c: { set: (key: string, value: unknown) => void }, next) => {
    c.set("user", {
      id: 42,
      username: "owner",
      role: 1,
      restaurantId: "restaurant-1",
    });
    await next();
  }),
);

vi.mock("../../../middleware/auth", () => ({
  authMiddleware,
}));

const jwtSecret = "x".repeat(32);

function createEnv(overrides: Record<string, unknown> = {}) {
  return {
    JWT_SECRET: jwtSecret,
    REALTIME_WS_URL: "wss://realtime.test",
    ...overrides,
  };
}

async function createToken() {
  return sign(
    {
      id: 42,
      username: "owner",
      role: 1,
      restaurantId: "restaurant-1",
    },
    jwtSecret,
    "HS256",
  );
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

describe("legacy SSE compatibility routes", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    authMiddleware.mockClear();
  });

  it("returns retired realtime guidance for authenticated SSE event clients", async () => {
    const token = await createToken();

    const response = await routes.fetch(
      new Request(`https://api.test/events?token=${token}`),
      createEnv() as never,
    );

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      data: { realtimeWsUrl: "wss://realtime.test" },
    });
  });

  it("accepts bearer tokens and checks the token blacklist for SSE events", async () => {
    const token = await createToken();
    const blacklist = { get: vi.fn().mockResolvedValue(null) };

    const response = await routes.fetch(
      new Request("https://api.test/events", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      createEnv({ TOKEN_BLACKLIST: blacklist }) as never,
    );

    expect(response.status).toBe(410);
    expect(blacklist.get).toHaveBeenCalledWith(`token:${token}`);
  });

  it("rejects SSE event requests without usable authentication", async () => {
    const missingToken = await withSilencedRouteError(() =>
      routes.fetch(
        new Request("https://api.test/events"),
        createEnv() as never,
      ),
    );
    expect(missingToken.status).toBe(500);

    const missingSecret = await withSilencedRouteError(async () =>
      routes.fetch(
        new Request(`https://api.test/events?token=${await createToken()}`),
        createEnv({ JWT_SECRET: "short" }) as never,
      ),
    );
    expect(missingSecret.status).toBe(500);

    const blacklisted = await withSilencedRouteError(async () =>
      routes.fetch(
        new Request(`https://api.test/events?token=${await createToken()}`),
        createEnv({
          TOKEN_BLACKLIST: { get: vi.fn().mockResolvedValue("revoked") },
        }) as never,
      ),
    );
    expect(blacklisted.status).toBe(500);
  });

  it("returns retired guidance for authenticated legacy management routes", async () => {
    for (const request of [
      new Request("https://api.test/connections"),
      new Request("https://api.test/test", { method: "POST" }),
      new Request("https://api.test/broadcast/orders", { method: "POST" }),
      new Request("https://api.test/notify/group", { method: "POST" }),
      new Request("https://api.test/group/group-1/health"),
      new Request("https://api.test/group/group-1/sync"),
    ]) {
      const response = await routes.fetch(request, createEnv() as never);
      expect(response.status).toBe(410);
      await expect(response.json()).resolves.toMatchObject({
        success: false,
        data: { realtimeWsUrl: "wss://realtime.test" },
      });
    }

    expect(authMiddleware).toHaveBeenCalledTimes(6);
  });

  it("keeps ping and time probes available behind auth middleware", async () => {
    const ping = await routes.fetch(
      new Request("https://api.test/ping"),
      createEnv() as never,
    );
    expect(ping.status).toBe(200);
    await expect(ping.json()).resolves.toMatchObject({
      success: true,
      data: { pong: true, realtime: "websocket" },
    });

    const time = await routes.fetch(
      new Request("https://api.test/time"),
      createEnv() as never,
    );
    expect(time.status).toBe(200);
    await expect(time.json()).resolves.toMatchObject({
      success: true,
      data: { timestamp: expect.any(Number), iso: expect.any(String) },
    });
  });
});
