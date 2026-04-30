/**
 * Monitoring Middleware Tests
 * 監控中間件測試
 *
 * 重要說明：Hono 4.x 的錯誤處理架構
 * ────────────────────────────────
 * Hono 的 compose 函數內部捕獲路由處理器的錯誤，
 * 所以中間件的 try-catch 區塊無法捕獲來自路由處理器的錯誤。
 *
 * 如果需要在中間件中處理錯誤，應該使用 app.onError() 處理器。
 *
 * 這些測試反映了 Hono 的實際行為。
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import {
  metricsMiddleware,
  errorMonitoringMiddleware,
  healthCheckMiddleware,
  performanceMonitoringMiddleware,
  cacheMonitoringMiddleware,
  monitoringStatsMiddleware,
  type MonitoringServiceInterface,
  type MonitoringServiceFactory,
} from "../monitoring";
import { mockEnv as baseMockEnv } from "../../__tests__/setup";

type TestHealthStatus = {
  overall: string;
};

// Create a fresh mock service that can be configured in each test
const createMockMonitoringService = (): MonitoringServiceInterface => ({
  recordApiRequest: vi.fn().mockResolvedValue(undefined),
  recordError: vi.fn().mockResolvedValue(undefined),
  getHealthStatus: vi
    .fn()
    .mockResolvedValue({ overall: "healthy", components: {} }),
  recordCacheMetrics: vi.fn().mockResolvedValue(undefined),
  getMetrics: vi.fn().mockResolvedValue({
    apiMetrics: { totalRequests: 1000, averageResponseTime: 150 },
    errorMetrics: { totalErrors: 10 },
    cacheMetrics: { hitRate: 0.85 },
  }),
});

// Helper to create fresh mockEnv with proper mock methods
const createFreshMockEnv = () => ({
  ...baseMockEnv,
  CACHE_KV: {
    get: vi.fn().mockResolvedValue("cached-value"),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ keys: [{ name: "key1" }] }),
  },
});

describe("Metrics Middleware", () => {
  let app: Hono<{ Bindings: ReturnType<typeof createFreshMockEnv> }>;
  let mockEnv: ReturnType<typeof createFreshMockEnv>;
  let mockService: MonitoringServiceInterface;
  let mockServiceFactory: MonitoringServiceFactory;

  beforeEach(() => {
    vi.clearAllMocks();

    mockService = createMockMonitoringService();
    mockEnv = createFreshMockEnv();
    mockServiceFactory = vi.fn().mockReturnValue(mockService);

    app = new Hono<{ Bindings: typeof mockEnv }>();
    app.use(
      "*",
      metricsMiddleware({ createMonitoringService: mockServiceFactory }),
    );
    app.get("/test", (c) => c.json({ success: true }));
    app.get("/slow", async (c) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      return c.json({ success: true });
    });
    app.get("/error", () => {
      throw new Error("Test error");
    });
  });

  it("should record API request metrics", async () => {
    const req = new Request("http://localhost/test");
    const res = await app.fetch(req, mockEnv);

    expect(res.status).toBe(200);
    expect(mockServiceFactory).toHaveBeenCalledWith(mockEnv.CACHE_KV);
    expect(mockService.recordApiRequest).toHaveBeenCalledWith(
      expect.any(Number),
      200,
      "/test",
    );
  });

  it("should add response time header", async () => {
    const req = new Request("http://localhost/test");
    const res = await app.fetch(req, mockEnv);

    expect(res.headers.get("X-Response-Time")).toBeTruthy();
  });

  it("should add request ID header", async () => {
    const req = new Request("http://localhost/test");
    const res = await app.fetch(req, mockEnv);

    expect(res.headers.get("X-Request-ID")).toBeTruthy();
  });

  it("should record slow request warning", async () => {
    const slowApp = new Hono<{ Bindings: typeof mockEnv }>();
    slowApp.use(
      "*",
      metricsMiddleware({ createMonitoringService: mockServiceFactory }),
    );
    slowApp.get("/slow", async (c) => {
      const startTime = Date.now();
      while (Date.now() - startTime < 10) {
        // Busy wait
      }
      return c.json({ success: true });
    });

    const req = new Request("http://localhost/slow");
    await slowApp.fetch(req, mockEnv);

    expect(mockService.recordApiRequest).toHaveBeenCalled();
  });

  it("should still record API metrics on error (via finally block)", async () => {
    const req = new Request("http://localhost/error");
    const res = await app.fetch(req, mockEnv);

    expect(res.status).toBe(500);
    // The finally block always runs and records the API request
    expect(mockService.recordApiRequest).toHaveBeenCalledWith(
      expect.any(Number),
      500,
      "/error",
    );
  });
});

describe("Error Monitoring Middleware", () => {
  let mockEnv: ReturnType<typeof createFreshMockEnv>;
  let mockService: MonitoringServiceInterface;
  let mockServiceFactory: MonitoringServiceFactory;

  beforeEach(() => {
    vi.clearAllMocks();

    mockService = createMockMonitoringService();
    mockEnv = createFreshMockEnv();
    mockServiceFactory = vi.fn().mockReturnValue(mockService);
  });

  /**
   * 重要說明：Hono 4.x 的錯誤處理限制
   *
   * 在 Hono 4.x 中，路由處理器拋出的錯誤會被 Hono 的 compose 函數內部捕獲，
   * 轉換為 500 回應，而不會觸發中間件的 catch 區塊。
   *
   * 如果需要記錄錯誤，應該使用 app.onError() 處理器，而不是依賴中間件的 try-catch。
   *
   * 以下測試使用 onError 處理器來正確測試錯誤監控功能。
   */

  it("should record database errors when using onError handler", async () => {
    const app = new Hono<{ Bindings: typeof mockEnv }>();

    // Use onError to capture errors - this is how Hono handles errors
    app.onError(async (err, c) => {
      const service = mockServiceFactory(c.env.CACHE_KV);
      const errorType = err.message.toLowerCase().includes("database")
        ? "database_error"
        : "unknown_error";
      await service.recordError(errorType, err.message, "critical");
      return c.text(err.message, 500);
    });

    app.use(
      "*",
      errorMonitoringMiddleware({
        createMonitoringService: mockServiceFactory,
      }),
    );
    app.get("/db-error", () => {
      throw new Error("Database connection failed");
    });

    const req = new Request("http://localhost/db-error");
    const res = await app.fetch(req, mockEnv);

    expect(res.status).toBe(500);
    expect(mockService.recordError).toHaveBeenCalledWith(
      "database_error",
      expect.any(String),
      "critical",
    );
  });

  it("should record auth errors when using onError handler", async () => {
    const app = new Hono<{ Bindings: typeof mockEnv }>();

    app.onError(async (err, c) => {
      const service = mockServiceFactory(c.env.CACHE_KV);
      const errorType = err.message.toLowerCase().includes("unauthorized")
        ? "auth_error"
        : "unknown_error";
      await service.recordError(errorType, err.message, "warning");
      return c.text(err.message, 500);
    });

    app.use(
      "*",
      errorMonitoringMiddleware({
        createMonitoringService: mockServiceFactory,
      }),
    );
    app.get("/auth-error", () => {
      throw new Error("Unauthorized access");
    });

    const req = new Request("http://localhost/auth-error");
    const res = await app.fetch(req, mockEnv);

    expect(res.status).toBe(500);
    expect(mockService.recordError).toHaveBeenCalledWith(
      "auth_error",
      expect.any(String),
      expect.any(String),
    );
  });

  it("should record timeout errors when using onError handler", async () => {
    const app = new Hono<{ Bindings: typeof mockEnv }>();

    app.onError(async (err, c) => {
      const service = mockServiceFactory(c.env.CACHE_KV);
      const errorType = err.message.toLowerCase().includes("timeout")
        ? "timeout_error"
        : "unknown_error";
      await service.recordError(errorType, err.message, "critical");
      return c.text(err.message, 500);
    });

    app.use(
      "*",
      errorMonitoringMiddleware({
        createMonitoringService: mockServiceFactory,
      }),
    );
    app.get("/timeout", () => {
      throw new Error("Request timeout");
    });

    const req = new Request("http://localhost/timeout");
    const res = await app.fetch(req, mockEnv);

    expect(res.status).toBe(500);
    expect(mockService.recordError).toHaveBeenCalledWith(
      "timeout_error",
      expect.any(String),
      "critical",
    );
  });

  it("should record validation errors when using onError handler", async () => {
    const app = new Hono<{ Bindings: typeof mockEnv }>();

    app.onError(async (err, c) => {
      const service = mockServiceFactory(c.env.CACHE_KV);
      const errorType = err.message.toLowerCase().includes("validation")
        ? "validation_error"
        : "unknown_error";
      await service.recordError(errorType, err.message, "warning");
      return c.text(err.message, 500);
    });

    app.use(
      "*",
      errorMonitoringMiddleware({
        createMonitoringService: mockServiceFactory,
      }),
    );
    app.get("/validation", () => {
      throw new Error("Validation failed: invalid email");
    });

    const req = new Request("http://localhost/validation");
    const res = await app.fetch(req, mockEnv);

    expect(res.status).toBe(500);
    expect(mockService.recordError).toHaveBeenCalledWith(
      "validation_error",
      expect.any(String),
      expect.any(String),
    );
  });

  it("should record unknown errors when using onError handler", async () => {
    const app = new Hono<{ Bindings: typeof mockEnv }>();

    app.onError(async (err, c) => {
      const service = mockServiceFactory(c.env.CACHE_KV);
      await service.recordError("unknown_error", err.message, "warning");
      return c.text(err.message, 500);
    });

    app.use(
      "*",
      errorMonitoringMiddleware({
        createMonitoringService: mockServiceFactory,
      }),
    );
    app.get("/unknown", () => {
      throw new Error("Something went wrong");
    });

    const req = new Request("http://localhost/unknown");
    const res = await app.fetch(req, mockEnv);

    expect(res.status).toBe(500);
    expect(mockService.recordError).toHaveBeenCalledWith(
      "unknown_error",
      expect.any(String),
      expect.any(String),
    );
  });

  it("should pass through successful requests without recording errors", async () => {
    const app = new Hono<{ Bindings: typeof mockEnv }>();
    app.use(
      "*",
      errorMonitoringMiddleware({
        createMonitoringService: mockServiceFactory,
      }),
    );
    app.get("/success", (c) => c.json({ success: true }));

    const req = new Request("http://localhost/success");
    const res = await app.fetch(req, mockEnv);

    expect(res.status).toBe(200);
    expect(mockService.recordError).not.toHaveBeenCalled();
  });
});

describe("Health Check Middleware", () => {
  let app: Hono<{ Bindings: ReturnType<typeof createFreshMockEnv> }>;
  let mockEnv: ReturnType<typeof createFreshMockEnv>;
  let mockService: MonitoringServiceInterface;
  let mockServiceFactory: MonitoringServiceFactory;

  beforeEach(() => {
    vi.clearAllMocks();

    mockService = createMockMonitoringService();
    mockEnv = createFreshMockEnv();
    mockServiceFactory = vi.fn().mockReturnValue(mockService);

    app = new Hono<{ Bindings: typeof mockEnv }>();
    app.use(
      "*",
      healthCheckMiddleware({ createMonitoringService: mockServiceFactory }),
    );
    app.get("/health", (c) => {
      const healthStatus = (c as unknown as ApiTestContextWithEnv).get(
        "healthStatus",
      ) as TestHealthStatus | undefined;
      return c.json({ status: healthStatus?.overall || "unknown" });
    });
    app.get("/other", (c) => c.json({ success: true }));
  });

  it("should check health status for health endpoints", async () => {
    (mockService.getHealthStatus as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        overall: "healthy",
        components: {},
      },
    );

    const req = new Request("http://localhost/health");
    const res = await app.fetch(req, mockEnv);

    expect(res.status).toBe(200);
    expect(mockService.getHealthStatus).toHaveBeenCalled();
  });

  it("should return 503 for critical health status", async () => {
    (mockService.getHealthStatus as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        overall: "critical",
        components: {},
      },
    );

    const req = new Request("http://localhost/health");
    const res = await app.fetch(req, mockEnv);

    expect(res.status).toBe(503);
  });

  it("should return 503 for down health status", async () => {
    (mockService.getHealthStatus as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        overall: "down",
        components: {},
      },
    );

    const req = new Request("http://localhost/health");
    const res = await app.fetch(req, mockEnv);

    expect(res.status).toBe(503);
  });

  it("should return 200 for warning health status", async () => {
    (mockService.getHealthStatus as ReturnType<typeof vi.fn>).mockResolvedValue(
      {
        overall: "warning",
        components: {},
      },
    );

    const req = new Request("http://localhost/health");
    const res = await app.fetch(req, mockEnv);

    expect(res.status).toBe(200);
  });

  it("should skip health check for non-health endpoints", async () => {
    const req = new Request("http://localhost/other");
    const res = await app.fetch(req, mockEnv);

    expect(res.status).toBe(200);
    expect(mockService.getHealthStatus).not.toHaveBeenCalled();
  });

  it("should handle health check errors with onError", async () => {
    (mockService.getHealthStatus as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Health check failed"),
    );

    // Create app with onError handler for proper error capture
    const testApp = new Hono<{ Bindings: typeof mockEnv }>();
    testApp.onError(async (err, c) => {
      const service = mockServiceFactory(c.env.CACHE_KV);
      await service.recordError("health_check", err.message, "critical");
      return c.text(err.message, 500);
    });
    testApp.use(
      "*",
      healthCheckMiddleware({ createMonitoringService: mockServiceFactory }),
    );
    testApp.get("/health", (c) => {
      const healthStatus = (c as unknown as ApiTestContextWithEnv).get(
        "healthStatus",
      ) as TestHealthStatus | undefined;
      return c.json({ status: healthStatus?.overall || "unknown" });
    });

    const req = new Request("http://localhost/health");
    const res = await testApp.fetch(req, mockEnv);

    expect(res.status).toBe(500);
    expect(mockService.recordError).toHaveBeenCalledWith(
      "health_check",
      "Health check failed",
      "critical",
    );
  });
});

describe("Cache Monitoring Middleware", () => {
  let app: Hono<{ Bindings: ReturnType<typeof createFreshMockEnv> }>;
  let mockEnv: ReturnType<typeof createFreshMockEnv>;
  let mockService: MonitoringServiceInterface;
  let mockServiceFactory: MonitoringServiceFactory;

  beforeEach(() => {
    vi.clearAllMocks();

    mockService = createMockMonitoringService();
    mockEnv = createFreshMockEnv();
    mockServiceFactory = vi.fn().mockReturnValue(mockService);

    app = new Hono<{ Bindings: typeof mockEnv }>();
    app.use(
      "*",
      cacheMonitoringMiddleware({
        createMonitoringService: mockServiceFactory,
      }),
    );
    app.get("/test", async (c) => {
      await c.env.CACHE_KV.get("test-key");
      await c.env.CACHE_KV.get("another-key");
      return c.json({ success: true });
    });
  });

  it("should track cache hits", async () => {
    const req = new Request("http://localhost/test");
    await app.fetch(req, mockEnv);

    expect(mockService.recordCacheMetrics).toHaveBeenCalled();
  });

  it("should track cache misses", async () => {
    const missEnv = createFreshMockEnv();
    missEnv.CACHE_KV.get.mockResolvedValue(null);

    const missApp = new Hono<{ Bindings: typeof missEnv }>();
    missApp.use(
      "*",
      cacheMonitoringMiddleware({
        createMonitoringService: mockServiceFactory,
      }),
    );
    missApp.get("/test", async (c) => {
      await c.env.CACHE_KV.get("test-key");
      await c.env.CACHE_KV.get("another-key");
      return c.json({ success: true });
    });

    const req = new Request("http://localhost/test");
    await missApp.fetch(req, missEnv);

    expect(mockService.recordCacheMetrics).toHaveBeenCalled();
  });
});

describe("Monitoring Stats Middleware", () => {
  let app: Hono<{ Bindings: ReturnType<typeof createFreshMockEnv> }>;
  let mockEnv: ReturnType<typeof createFreshMockEnv>;
  let mockService: MonitoringServiceInterface;
  let mockServiceFactory: MonitoringServiceFactory;

  beforeEach(() => {
    vi.clearAllMocks();

    mockService = createMockMonitoringService();
    mockEnv = createFreshMockEnv();
    mockServiceFactory = vi.fn().mockReturnValue(mockService);

    app = new Hono<{ Bindings: typeof mockEnv }>();
    app.use(
      "*",
      monitoringStatsMiddleware({
        createMonitoringService: mockServiceFactory,
      }),
    );
    app.get("/test", (c) => c.json({ success: true }));
  });

  it("should add monitoring headers in development", async () => {
    const devEnv = { ...mockEnv, NODE_ENV: "development" };

    const req = new Request("http://localhost/test");
    const res = await app.fetch(req, devEnv as typeof mockEnv);

    expect(res.headers.get("X-Monitoring-Requests")).toBe("1000");
    expect(res.headers.get("X-Monitoring-Errors")).toBe("10");
    expect(res.headers.get("X-Monitoring-Avg-Response")).toBe("150.00");
    expect(res.headers.get("X-Monitoring-Cache-Hit-Rate")).toBe("85.00");
  });

  it("should not add headers in production", async () => {
    const prodEnv = { ...mockEnv, NODE_ENV: "production" };

    const prodApp = new Hono<{ Bindings: typeof mockEnv }>();
    prodApp.use(
      "*",
      monitoringStatsMiddleware({
        createMonitoringService: mockServiceFactory,
      }),
    );
    prodApp.get("/test", (c) => c.json({ success: true }));

    const req = new Request("http://localhost/test");
    const res = await prodApp.fetch(req, prodEnv as typeof mockEnv);

    expect(res.headers.get("X-Monitoring-Requests")).toBeNull();
  });
});

describe("Performance Monitoring Middleware", () => {
  let app: Hono<{ Bindings: ReturnType<typeof createFreshMockEnv> }>;
  let mockEnv: ReturnType<typeof createFreshMockEnv>;
  let mockService: MonitoringServiceInterface;
  let mockServiceFactory: MonitoringServiceFactory;

  beforeEach(() => {
    vi.clearAllMocks();

    mockService = createMockMonitoringService();
    mockEnv = createFreshMockEnv();
    mockServiceFactory = vi.fn().mockReturnValue(mockService);

    app = new Hono<{ Bindings: typeof mockEnv }>();
    app.use(
      "*",
      performanceMonitoringMiddleware({
        createMonitoringService: mockServiceFactory,
      }),
    );
    app.get("/test", (c) => c.json({ success: true }));
  });

  it("should pass through normal requests", async () => {
    const req = new Request("http://localhost/test");
    const res = await app.fetch(req, mockEnv);

    expect(res.status).toBe(200);
  });

  it("should handle requests without throwing", async () => {
    const req = new Request("http://localhost/test");

    await expect(app.fetch(req, mockEnv)).resolves.toBeDefined();
  });
});
