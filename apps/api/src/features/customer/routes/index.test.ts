import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  customer: {
    id: "customer-1",
    displayName: "Customer One",
    primaryPhone: "+886912345678",
    primaryEmail: undefined,
    status: "active",
  },
}));

const jwt = vi.hoisted(() => ({
  decoded: undefined as unknown,
  sign: vi.fn(
    async (payload: any) =>
      `signed:${payload.type}:${payload.sub}:${payload.jti ?? "access"}`,
  ),
  verify: vi.fn(() => jwt.decoded),
}));

vi.mock("../../../middleware/auth", () => ({
  canonicalCustomerAuthMiddleware: vi.fn(async (c: any, next: any) => {
    c.set("customer", auth.customer);
    await next();
  }),
  verifyJwtToken: jwt.verify,
}));

vi.mock("hono/jwt", () => ({
  sign: jwt.sign,
  verify: jwt.verify,
}));

const bcryptMocks = vi.hoisted(() => ({
  hash: vi.fn(async (value: string) => `hash:${value}`),
  compare: vi.fn(async () => true),
}));

vi.mock("bcryptjs", () => ({
  default: bcryptMocks,
}));

const utilMocks = vi.hoisted(() => ({
  ApiError: class ApiError extends Error {
    constructor(
      public readonly code: string,
      message: string,
      public readonly status: number = 500,
      public readonly details?: unknown,
    ) {
      super(message);
      this.name = "ApiError";
    }
  },
  generateUUID: vi.fn(() => "uuid-1"),
  normalizeE164Phone: vi.fn((phone: string) =>
    phone.startsWith("+") ? phone : `+${phone}`,
  ),
}));

vi.mock("@makanmasak/utils", () => ({
  ...utilMocks,
  badRequest: vi.fn(
    (message = "Invalid request", code = "BAD_REQUEST", details?: unknown) =>
      new utilMocks.ApiError(code, message, 400, details),
  ),
  unauthorized: vi.fn(
    (message = "Unauthorized", code = "UNAUTHORIZED") =>
      new utilMocks.ApiError(code, message, 401),
  ),
  forbidden: vi.fn(
    (message = "Access denied", code = "FORBIDDEN") =>
      new utilMocks.ApiError(code, message, 403),
  ),
  conflict: vi.fn(
    (message = "Resource conflict", code = "CONFLICT") =>
      new utilMocks.ApiError(code, message, 409),
  ),
  notFound: vi.fn(
    (message = "Resource not found", code = "NOT_FOUND") =>
      new utilMocks.ApiError(code, message, 404),
  ),
}));

import routes, {
  generateOtp,
  pruneStaleCustomerPushSubscriptions,
} from "./index";
import { ApiError } from "../../../shared/utils/api-error";

routes.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      { success: false, error: { code: err.code, message: err.message } },
      err.status as 400 | 401 | 403 | 404 | 409 | 500,
    );
  }
  return c.json({ success: false, error: { message: String(err) } }, 500);
});

type DbQueues = {
  first: unknown[];
  all: unknown[];
  run: unknown[];
  statements: Array<{ sql: string; args: unknown[] }>;
};

function createDb(queues: Partial<DbQueues> = {}) {
  const state: DbQueues = {
    first: queues.first ?? [],
    all: queues.all ?? [],
    run: queues.run ?? [],
    statements: queues.statements ?? [],
  };
  const db = {
    state,
    prepare: vi.fn((sql: string) => {
      const statement = {
        bind: vi.fn((...args: unknown[]) => {
          state.statements.push({ sql, args });
          return statement;
        }),
        first: vi.fn(async () => state.first.shift() ?? null),
        all: vi.fn(async () => state.all.shift() ?? { results: [] }),
        run: vi.fn(async () => state.run.shift() ?? { meta: { changes: 1 } }),
      };
      return statement;
    }),
  };
  return db;
}

function createKv(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    put: vi.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    delete: vi.fn(async (key: string) => {
      values.delete(key);
    }),
  };
}

function customerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "customer-1",
    display_name: "Customer One",
    primary_phone: "+886912345678",
    primary_email: null,
    avatar_url: null,
    locale: "zh-TW",
    status: "active",
    last_seen_at_ms: 1_780_000_000_000,
    created_at_ms: 1_770_000_000_000,
    updated_at_ms: 1_780_000_000_000,
    ...overrides,
  };
}

function request(
  path: string,
  method = "GET",
  body?: unknown,
  envOverrides: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  const db = (envOverrides.DB as ReturnType<typeof createDb>) ?? createDb();
  const rateLimitKv =
    (envOverrides.RATE_LIMIT_KV as ReturnType<typeof createKv>) ?? createKv();
  const tokenKv =
    (envOverrides.TOKEN_BLACKLIST as ReturnType<typeof createKv>) ?? createKv();
  const env = {
    DB: db,
    RATE_LIMIT_KV: rateLimitKv,
    TOKEN_BLACKLIST: tokenKv,
    JWT_SECRET: "x".repeat(32),
    NODE_ENV: "test",
    ...envOverrides,
  };

  const response = routes.request(
    path,
    {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        Authorization: "Bearer access-token",
        "User-Agent": "vitest",
        "CF-Connecting-IP": "203.0.113.10",
        ...headers,
      },
    },
    env as never,
  );

  return { response, db, rateLimitKv, tokenKv };
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.customer = {
    id: "customer-1",
    displayName: "Customer One",
    primaryPhone: "+886912345678",
    primaryEmail: undefined,
    status: "active",
  };
  jwt.decoded = {
    sub: "customer-1",
    type: "customer_refresh",
    jti: "refresh-1",
  };
  bcryptMocks.compare.mockResolvedValue(true);
  utilMocks.generateUUID.mockReturnValue("uuid-1");
});

describe("generateOtp", () => {
  it("rejects random values outside the unbiased modulo range", () => {
    const randomValues = [4_294_000_000, 123_456];
    const getRandomValues = vi.fn((array: Uint32Array) => {
      array[0] = randomValues.shift() ?? 0;
      return array;
    });

    expect(generateOtp(getRandomValues)).toBe("123456");
    expect(getRandomValues).toHaveBeenCalledTimes(2);
  });

  it("returns zero-padded six digit codes", () => {
    const getRandomValues = vi.fn((array: Uint32Array) => {
      array[0] = 42;
      return array;
    });

    expect(generateOtp(getRandomValues)).toBe("000042");
  });
});

describe("customer identity routes", () => {
  it("requests OTPs with rate limits and development OTP echo", async () => {
    const db = createDb();
    const rateLimitKv = createKv();

    const { response } = request(
      "/auth/request-otp",
      "POST",
      {
        phone: "+886912345678",
      },
      { DB: db, RATE_LIMIT_KV: rateLimitKv },
    );
    const body = await (await response).json();

    expect(body).toMatchObject({
      success: true,
      data: {
        phone: "+886912345678",
        expiresInSeconds: 300,
      },
    });
    expect(body.data.devOtp).toMatch(/^\d{6}$/);
    expect(bcryptMocks.hash).toHaveBeenCalledWith(body.data.devOtp, 10);
    expect(rateLimitKv.put).toHaveBeenCalledWith(
      "customer_otp_phone:+886912345678",
      "1",
      { expirationTtl: 60 * 60 },
    );
    expect(db.state.statements.at(-1)?.sql).toContain(
      "INSERT INTO customer_phone_verification_tokens",
    );
  });

  it("verifies OTPs, creates new customers, and issues tokens", async () => {
    utilMocks.generateUUID.mockReturnValueOnce("customer-new");
    const db = createDb({
      first: [
        { id: 10, otp_code: "hash:123456", attempts: 0 },
        null,
        customerRow({ id: "customer-new", display_name: "+886912345678" }),
      ],
    });
    const tokenKv = createKv();

    const { response } = request(
      "/auth/verify-otp",
      "POST",
      { phone: "+886912345678", otp: "123456" },
      { DB: db, TOKEN_BLACKLIST: tokenKv },
    );
    const rawResponse = await response;
    const body = await rawResponse.json();

    expect(body).toMatchObject({
      success: true,
      data: {
        accessToken: "signed:customer:customer-new:access",
        customer: { id: "customer-new" },
      },
    });
    expect(body.data).not.toHaveProperty("refreshToken");
    expect(
      decodeURIComponent(rawResponse.headers.get("set-cookie") ?? ""),
    ).toContain(
      "__Host-mm_customer_refresh=signed:customer_refresh:customer-new:",
    );
    expect(rawResponse.headers.get("set-cookie")).toContain("HttpOnly");
    expect(bcryptMocks.compare).toHaveBeenCalledWith("123456", "hash:123456");
    expect(tokenKv.put).toHaveBeenCalledWith(
      expect.stringMatching(/^customer_refresh:/),
      "customer-new",
      { expirationTtl: 30 * 24 * 60 * 60 },
    );
  });

  it("increments OTP attempts and rejects invalid verification codes", async () => {
    bcryptMocks.compare.mockResolvedValueOnce(false);
    const db = createDb({
      first: [{ id: 10, otp_code: "hash:123456", attempts: 0 }],
    });

    const response = await request(
      "/auth/verify-otp",
      "POST",
      { phone: "+886912345678", otp: "000000" },
      { DB: db },
    ).response;

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_OTP" },
    });
    expect(db.state.statements.at(-1)).toMatchObject({
      args: [10],
    });
  });

  it("refreshes and logs out customer sessions", async () => {
    const tokenKv = createKv({ "customer_refresh:refresh-1": "customer-1" });
    const db = createDb({ first: [customerRow()] });

    let response = await request(
      "/auth/refresh",
      "POST",
      undefined,
      { DB: db, TOKEN_BLACKLIST: tokenKv },
      { Cookie: "__Host-mm_customer_refresh=refresh-token-value-12345" },
    ).response;
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { accessToken: "signed:customer:customer-1:access" },
    });
    expect(tokenKv.delete).toHaveBeenCalledWith("customer_refresh:refresh-1");

    response = await request(
      "/auth/logout",
      "POST",
      undefined,
      { TOKEN_BLACKLIST: tokenKv },
      { Cookie: "__Host-mm_customer_refresh=refresh-token-value-12345" },
    ).response;
    expect(response.status).toBe(200);
    expect(tokenKv.put).toHaveBeenCalledWith(
      "token:access-token",
      "blacklisted",
      {
        expirationTtl: 15 * 60,
      },
    );
  });

  it("reads and updates customer profile and preferences", async () => {
    const db = createDb({
      first: [
        customerRow(),
        {
          dietary_tags: '["vegetarian"]',
          allergens: "not-json",
          default_party_size: 4,
          marketing_opt_in: 1,
          waiting_list_opt_in: 0,
          promo_from_favorites_opt_in: 1,
          quiet_hours_start: "22:00",
          quiet_hours_end: "08:00",
          updated_at_ms: 1,
        },
        customerRow({ display_name: "Updated" }),
        null,
        {
          dietary_tags: '["vegetarian"]',
          allergens: "[]",
          waiting_list_opt_in: 1,
        },
      ],
    });

    let response = await request("/me", "GET", undefined, { DB: db }).response;
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: {
        customer: { displayName: "Customer One" },
        preferences: {
          dietaryTags: ["vegetarian"],
          allergens: [],
          defaultPartySize: 4,
          marketingOptIn: true,
          waitingListOptIn: false,
        },
      },
    });

    response = await request(
      "/me",
      "PATCH",
      {
        displayName: "Updated",
        avatarUrl: null,
        locale: "en-US",
      },
      { DB: db },
    ).response;
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { customer: { displayName: "Updated" } },
    });

    response = await request(
      "/preferences",
      "PATCH",
      { dietaryTags: ["halal"], defaultPartySize: 2, waitingListOptIn: false },
      { DB: db },
    ).response;
    expect(response.status).toBe(200);
    expect(
      db.state.statements.find((statement) =>
        statement.sql.includes("INSERT INTO customer_preferences"),
      )?.args,
    ).toEqual([
      "customer-1",
      '["halal"]',
      "[]",
      2,
      0,
      0,
      0,
      null,
      null,
      expect.any(Number),
    ]);
  });

  it("manages favorites with target validation and duplicate reuse", async () => {
    const db = createDb({
      first: [
        { id: "restaurant-1" },
        null,
        { id: 7, target_type: "restaurant", target_id: "restaurant-1" },
        { id: 7, target_type: "restaurant", target_id: "restaurant-1" },
      ],
      all: [
        {
          results: [
            {
              id: 7,
              target_type: "restaurant",
              target_id: "restaurant-1",
              created_at_ms: 1,
            },
          ],
        },
      ],
    });

    let response = await request(
      "/favorites?targetType=restaurant",
      "GET",
      undefined,
      { DB: db },
    ).response;
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [{ id: 7, targetType: "restaurant" }],
    });

    response = await request(
      "/favorites",
      "POST",
      { targetType: "restaurant", targetId: "restaurant-1" },
      { DB: db },
    ).response;
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      data: { id: 7, targetType: "restaurant" },
    });

    response = await request("/favorites/7", "DELETE", undefined, { DB: db })
      .response;
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { deleted: true },
    });
  });

  it("tracks recent markets and rejects missing market support", async () => {
    const db = createDb({
      first: [
        { name: "markets" },
        { id: "market-1" },
        { market_id: "market-1", visited_at_ms: 123 },
      ],
      all: [{ results: [{ market_id: "market-1", visited_at_ms: 123 }] }],
    });

    let response = await request("/recent-markets?limit=3", "GET", undefined, {
      DB: db,
    }).response;
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [{ marketId: "market-1", visitedAtMs: 123 }],
    });

    response = await request(
      "/recent-markets",
      "POST",
      { marketId: "market-1", visitedAtMs: 123 },
      { DB: db },
    ).response;
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      data: { marketId: "market-1", visitedAtMs: 123 },
    });

    const missingMarketDb = createDb({ first: [null] });
    response = await request(
      "/recent-markets",
      "POST",
      { marketId: "market-2" },
      { DB: missingMarketDb },
    ).response;
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "TARGET_NOT_FOUND" },
    });
  });

  it("manages push subscriptions and prunes stale subscriptions", async () => {
    const db = createDb({
      all: [
        {
          results: [
            {
              id: "sub-1",
              endpoint: "https://push.example.test/1",
              device_label: "Phone",
            },
          ],
        },
      ],
      first: [
        {
          id: "uuid-1",
          endpoint: "https://push.example.test/1?x=1&amp;y=2",
          device_label: "Phone",
          created_at_ms: 1,
        },
      ],
      run: [
        { meta: { changes: 1 } },
        { meta: { changes: 1 } },
        { meta: { changes: 4 } },
      ],
    });

    let response = await request("/push-subscriptions", "GET", undefined, {
      DB: db,
    }).response;
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [{ id: "sub-1" }],
    });

    response = await request(
      "/push-subscriptions",
      "POST",
      {
        endpoint: "https://push.example.test/1?x=1&amp;y=2",
        p256dh: "key",
        auth: "auth",
        deviceLabel: "Phone",
      },
      { DB: db },
    ).response;
    expect(response.status).toBe(201);
    expect(db.state.statements.at(-1)?.args).toContain(
      "https://push.example.test/1?x=1&y=2",
    );

    response = await request("/push-subscriptions/sub-1", "DELETE", undefined, {
      DB: db,
    }).response;
    expect(response.status).toBe(200);

    await expect(
      pruneStaleCustomerPushSubscriptions({ DB: db } as never, 1_800_000),
    ).resolves.toEqual({ deleted: 4 });
  });

  it("lists, creates, reuses, and revokes customer consents", async () => {
    const db = createDb({
      all: [
        {
          results: [
            {
              id: "consent-1",
              consent_type: "marketing",
              version: "2026-05-25-v1",
              granted: 1,
            },
          ],
        },
      ],
      first: [null, { id: "consent-2" }],
    });

    let response = await request("/consents", "GET", undefined, { DB: db })
      .response;
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: [{ id: "consent-1", consent_type: "marketing" }],
    });

    response = await request(
      "/consents",
      "POST",
      {
        consentType: "marketing",
        version: "2026-05-25-v1",
        granted: true,
        source: "onboarding",
      },
      { DB: db },
    ).response;
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      data: { id: "uuid-1" },
    });

    response = await request(
      "/consents",
      "POST",
      {
        consentType: "marketing",
        version: "2026-05-25-v1",
        granted: false,
      },
      { DB: db },
    ).response;
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { id: "consent-2" },
    });
  });
});
