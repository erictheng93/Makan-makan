import { beforeEach, describe, expect, it, vi } from "vitest";

const loggerFns = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

const serviceState = vi.hoisted(() => ({
  stats: {
    totalUsers: 10,
    activeSessions: 3,
    failedLoginsToday: 2,
  },
  shouldThrow: false,
  instances: [] as unknown[],
}));

vi.mock("../../core/monitoring", () => ({
  ConsoleLogger: vi.fn(function ConsoleLogger() {
    return loggerFns;
  }),
}));

vi.mock("./routes", async () => {
  const { Hono } = await import("hono");
  const routes = new Hono();
  routes.get("/ping", (c) => c.json({ ok: true }));
  routes.post("/login", (c) => c.json({ authenticated: true }));
  return { default: routes };
});

vi.mock("./services/AuthService", () => ({
  AuthService: vi.fn(function AuthService(this: { env: unknown }, env) {
    if (serviceState.shouldThrow) {
      throw new Error("auth stats unavailable");
    }
    this.env = env;
    serviceState.instances.push(this);
    return {
      getAuthStatistics: vi.fn(async () => serviceState.stats),
    };
  }),
}));

import authenticationFeature, {
  AuthenticationModule,
  AuthService,
  createAuthenticationModule,
} from "./index";

function createEnv(overrides: Record<string, unknown> = {}) {
  return {
    DB: {},
    CACHE_KV: {},
    TOKEN_BLACKLIST: {},
    JWT_SECRET: "a".repeat(32),
    ...overrides,
  };
}

describe("authentication feature module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceState.shouldThrow = false;
    serviceState.instances.length = 0;
    serviceState.stats = {
      totalUsers: 10,
      activeSessions: 3,
      failedLoginsToday: 2,
    };
  });

  it("creates a singleton module with metadata and mounted routes", async () => {
    const first = createAuthenticationModule();
    const second = createAuthenticationModule();

    expect(first).toBe(second);
    expect(first).toBeInstanceOf(AuthenticationModule);
    expect(first.name).toBe("authentication");
    expect(first.version).toBe("1.0.0");
    expect(loggerFns.info).toHaveBeenCalledWith(
      "authentication module initialized",
      { version: "1.0.0" },
    );

    const response = await first.routes.request("/ping");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("adds security and rate-limit headers through feature middleware", async () => {
    const module = new AuthenticationModule();

    const response = await module.routes.request("/health", undefined, {
      DB: {},
      CACHE_KV: {},
      JWT_SECRET: "b".repeat(32),
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(response.headers.get("X-XSS-Protection")).toBe("1; mode=block");
    expect(response.headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(loggerFns.debug).toHaveBeenCalledWith(
      "Authentication request",
      expect.objectContaining({ method: "GET", path: "/health" }),
    );
    expect(loggerFns.debug).toHaveBeenCalledWith(
      "Authentication response",
      expect.objectContaining({ method: "GET", path: "/health", status: 200 }),
    );

    const loginResponse = await module.routes.request("/login", {
      method: "POST",
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.headers.get("X-RateLimit-Limit")).toBeNull();
    expect(loginResponse.headers.get("X-RateLimit-Remaining")).toBeNull();
    expect(loginResponse.headers.get("X-RateLimit-Reset")).toBeNull();
  });

  it("reports health with dependency state", () => {
    const module = new AuthenticationModule();

    expect(module.getHealthStatus()).toMatchObject({
      name: "authentication",
      version: "1.0.0",
      status: "healthy",
      features: {
        userAuthentication: true,
        tokenManagement: true,
        securityLogging: true,
      },
      dependencies: {
        database: "unknown",
        cache: "unknown",
        jwt: "available",
      },
    });

    expect(module.getHealthStatus(createEnv() as never)).toMatchObject({
      status: "healthy",
      dependencies: {
        database: "available",
        cache: "available",
        jwt: "configured",
      },
    });

    expect(
      module.getHealthStatus(createEnv({ JWT_SECRET: "short" }) as never),
    ).toMatchObject({
      status: "healthy",
      dependencies: {
        jwt: "available",
      },
    });
  });

  it("returns declared feature capabilities", () => {
    expect(new AuthenticationModule().getCapabilities()).toMatchObject({
      authentication: {
        login: true,
        logout: true,
        tokenRefresh: true,
      },
      security: {
        passwordHashing: true,
        jwtTokens: true,
        auditLogging: true,
      },
      future: {
        twoFactorAuth: "planned",
        socialLogin: "planned",
      },
    });
  });

  it("returns authentication statistics and handles unavailable service state", async () => {
    const module = new AuthenticationModule();

    await expect(module.getStatistics()).resolves.toEqual({
      error: "Environment not available for statistics",
    });

    await expect(module.getStatistics(createEnv() as never)).resolves.toEqual({
      totalUsers: 10,
      activeSessions: 3,
      failedLoginsToday: 2,
      featureInfo: expect.objectContaining({
        name: "authentication",
        version: "1.0.0",
        uptime: expect.any(Number),
      }),
    });
    expect(AuthService).toHaveBeenCalledWith(createEnv());

    serviceState.shouldThrow = true;

    await expect(module.getStatistics(createEnv() as never)).resolves.toEqual({
      error: "Statistics not available",
    });
    expect(loggerFns.error).toHaveBeenCalledWith(
      "Failed to get authentication statistics",
      expect.any(Error),
      {},
    );
  });

  it("validates required configuration and warns about optional blacklist KV", () => {
    const module = new AuthenticationModule();

    expect(
      module.validateConfiguration(
        createEnv({
          DB: undefined,
          CACHE_KV: undefined,
          JWT_SECRET: "short",
          TOKEN_BLACKLIST: undefined,
        }) as never,
      ),
    ).toEqual({
      valid: false,
      errors: [
        "JWT_SECRET must be at least 32 characters for security",
        "Database connection (DB) is required",
        "Cache connection (CACHE_KV) is required",
      ],
    });
    expect(loggerFns.warn).toHaveBeenCalledWith(
      "TOKEN_BLACKLIST KV namespace not configured - token blacklisting will be disabled",
    );

    expect(module.validateConfiguration(createEnv() as never)).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("default export proxies singleton module operations", async () => {
    const env = createEnv();

    expect(authenticationFeature.routes).toBe(
      createAuthenticationModule().routes,
    );
    expect(authenticationFeature.getHealthStatus()).toMatchObject({
      name: "authentication",
      status: "healthy",
    });
    expect(authenticationFeature.validateConfiguration(env as never)).toEqual({
      valid: true,
      errors: [],
    });
    await expect(authenticationFeature.getStatistics()).resolves.toEqual({
      error: "Environment not available for statistics",
    });
  });
});
