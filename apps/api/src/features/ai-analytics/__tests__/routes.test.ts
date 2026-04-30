// apps/api/src/features/ai-analytics/__tests__/routes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import routes from "../routes";
import { ApiError } from "../../../shared/utils/api-error";

type AIAnalyticsServiceMock = ReturnType<typeof vi.fn> & {
  getAvailableModels: ReturnType<typeof vi.fn>;
  getDefaultModel: ReturnType<typeof vi.fn>;
};

// Mock AIAnalyticsService — configurable per test
const mockServiceInstance = {
  getConfig: vi.fn().mockResolvedValue(null),
  saveConfig: vi.fn().mockResolvedValue(undefined),
  testProvider: vi.fn().mockResolvedValue({
    success: true,
    latencyMs: 250,
    model: "claude-3-haiku-20240307",
  }),
  generateReport: vi.fn().mockResolvedValue({
    summary: "Test summary",
    insights: ["Insight 1"],
    recommendations: ["Rec 1"],
    metadata: {
      generatedAt: "2026-03-14T00:00:00Z",
      processingTimeMs: 1500,
      tokensUsed: 500,
      model: "claude-3-haiku-20240307",
    },
  }),
  getTrafficDrivers: vi.fn().mockResolvedValue([]),
  getBestsellers: vi.fn().mockResolvedValue([]),
  getProfitLeaders: vi.fn().mockResolvedValue([]),
  analyzeProducts: vi.fn().mockResolvedValue([]),
  getUsageStats: vi.fn().mockResolvedValue([]),
};

vi.mock("../services/AIAnalyticsService", () => {
  const MockService = vi.fn().mockImplementation(function () {
    return mockServiceInstance;
  }) as AIAnalyticsServiceMock;
  MockService.getAvailableModels = vi
    .fn()
    .mockReturnValue(["claude-3-haiku-20240307", "claude-3-sonnet-20240229"]);
  MockService.getDefaultModel = vi
    .fn()
    .mockReturnValue("claude-3-haiku-20240307");
  return { AIAnalyticsService: MockService };
});

vi.mock("../../../middleware/moduleGate", () => ({
  moduleGate: vi.fn(() => async (_c: any, next: any) => await next()),
  invalidateSubscriptionCache: vi.fn().mockResolvedValue(undefined),
}));

const mockEnv = {
  DB: {},
  CACHE_KV: {},
  JWT_SECRET: "test-jwt-secret-key-for-testing-only",
  ENCRYPTION_KEY: "test-encryption-key-for-testing-only-32chars",
};

// Helper to create app with a preset userRole
function createApp(userRole: number) {
  const app = new Hono<{
    Bindings: typeof mockEnv;
    Variables: {
      user: {
        id: number;
        username: string;
        role: number;
        restaurantId: string;
      };
    };
  }>();

  // Inject variables middleware — routes read c.get("user").role
  app.use("*", async (c, next) => {
    c.set("user", {
      id: 123,
      username: "test-user",
      role: userRole,
      restaurantId: "restaurant-123",
    });
    await next();
  });

  app.route("/ai-analytics", routes);

  // Mirror production global error handler
  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        {
          success: false,
          error: { code: err.code, message: err.message },
        },
        err.status as never,
      );
    }
    return c.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: err instanceof Error ? err.message : "Internal server error",
        },
      },
      500,
    );
  });

  return app;
}

describe("AI Analytics Routes", () => {
  let adminApp: ReturnType<typeof createApp>;
  let ownerApp: ReturnType<typeof createApp>;
  let staffApp: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset service mocks to defaults
    mockServiceInstance.getConfig.mockResolvedValue(null);
    mockServiceInstance.saveConfig.mockResolvedValue(undefined);
    mockServiceInstance.testProvider.mockResolvedValue({
      success: true,
      latencyMs: 250,
      model: "claude-3-haiku-20240307",
    });
    mockServiceInstance.generateReport.mockResolvedValue({
      summary: "Test summary",
      insights: [],
      recommendations: [],
      metadata: {
        generatedAt: "2026-03-14T00:00:00Z",
        processingTimeMs: 1500,
        tokensUsed: 500,
        model: "claude-3-haiku-20240307",
      },
    });
    mockServiceInstance.getTrafficDrivers.mockResolvedValue([]);
    mockServiceInstance.getBestsellers.mockResolvedValue([]);
    mockServiceInstance.getProfitLeaders.mockResolvedValue([]);
    mockServiceInstance.analyzeProducts.mockResolvedValue([]);
    mockServiceInstance.getUsageStats.mockResolvedValue([]);

    adminApp = createApp(0);
    ownerApp = createApp(1);
    staffApp = createApp(2);
  });

  // ─── GET /config/:restaurantId ─────────────────────────────────

  describe("GET /config/:restaurantId", () => {
    it("should return 200 with null config when none exists (role 0)", async () => {
      const req = new Request(
        "http://localhost/ai-analytics/config/restaurant-123",
      );
      const res = await adminApp.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; config: null };
      expect(json.success).toBe(true);
      expect(json.config).toBeNull();

      expect(mockServiceInstance.getConfig).toHaveBeenCalledOnce();
    });

    it("should return availableProviders list when config is null", async () => {
      const req = new Request(
        "http://localhost/ai-analytics/config/restaurant-123",
      );
      const res = await adminApp.fetch(req, mockEnv);
      const json = (await res.json()) as {
        availableProviders: string[];
        config: null;
      };
      expect(Array.isArray(json.availableProviders)).toBe(true);
      expect(json.availableProviders).toContain("anthropic");
      expect(json.availableProviders).toContain("openai");
    });

    it("should mask apiKeyEncrypted as *** in response (role 0)", async () => {
      mockServiceInstance.getConfig.mockResolvedValue({
        id: 1,
        restaurantId: "restaurant-123",
        provider: "anthropic",
        apiKeyEncrypted: "iv:encrypted-key-data",
        model: "claude-3-haiku-20240307",
        customBaseUrl: null,
        enabled: true,
        createdAt: "2026-03-01T00:00:00Z",
        updatedAt: "2026-03-14T00:00:00Z",
      });

      const req = new Request(
        "http://localhost/ai-analytics/config/restaurant-123",
      );
      const res = await adminApp.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        config: { apiKeyEncrypted: string };
      };
      expect(json.config.apiKeyEncrypted).toBe("***");

      expect(mockServiceInstance.getConfig).toHaveBeenCalledOnce();
    });

    it("should allow role 1 (owner) to access config", async () => {
      const req = new Request(
        "http://localhost/ai-analytics/config/restaurant-123",
      );
      const res = await ownerApp.fetch(req, mockEnv);
      expect(res.status).toBe(200);
    });

    it("should return 403 for role 2 (staff)", async () => {
      const req = new Request(
        "http://localhost/ai-analytics/config/restaurant-123",
      );
      const res = await staffApp.fetch(req, mockEnv);
      expect(res.status).toBe(403);
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string; message: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.message).toBe("Unauthorized");
    });

    it("should return 403 for role 3", async () => {
      const app = createApp(3);
      const req = new Request(
        "http://localhost/ai-analytics/config/restaurant-123",
      );
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(403);
    });
  });

  // ─── POST /config ───────────────────────────────────────────────

  describe("POST /config", () => {
    const validPayload = {
      restaurantId: "restaurant-123",
      provider: "openai",
      apiKey: "sk-valid-api-key-1234",
    };

    it("should return 200 on successful config save (role 0)", async () => {
      const req = new Request("http://localhost/ai-analytics/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });
      const res = await adminApp.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; message: string };
      expect(json.success).toBe(true);
      expect(json.message).toContain("saved successfully");

      expect(mockServiceInstance.testProvider).toHaveBeenCalledOnce();
      expect(mockServiceInstance.saveConfig).toHaveBeenCalledOnce();
    });

    it("should return 400 when testProvider returns failure", async () => {
      mockServiceInstance.testProvider.mockResolvedValueOnce({
        success: false,
        error: "Invalid API key",
      });

      const req = new Request("http://localhost/ai-analytics/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });
      const res = await adminApp.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string; message: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.message).toContain("Provider test failed");

      expect(mockServiceInstance.testProvider).toHaveBeenCalledOnce();
      expect(mockServiceInstance.saveConfig).not.toHaveBeenCalled();
    });

    it("should return 500 when saveConfig throws", async () => {
      mockServiceInstance.saveConfig.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const req = new Request("http://localhost/ai-analytics/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });
      const res = await adminApp.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string; message: string };
      };
      expect(json.success).toBe(false);
    });

    it("should return 403 for role 2 (RBAC)", async () => {
      const req = new Request("http://localhost/ai-analytics/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });
      const res = await staffApp.fetch(req, mockEnv);
      expect(res.status).toBe(403);
    });

    it("should return 400 for invalid JSON body (zValidator)", async () => {
      const req = new Request("http://localhost/ai-analytics/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "openai",
          // missing required restaurantId and apiKey
        }),
      });
      const res = await adminApp.fetch(req, mockEnv);
      expect(res.status).toBe(400);
    });

    it("should include testResult latency and model in response", async () => {
      const req = new Request("http://localhost/ai-analytics/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });
      const res = await adminApp.fetch(req, mockEnv);
      const json = (await res.json()) as {
        testResult: { latency: number; model: string };
      };
      expect(json.testResult).toBeDefined();
      expect(json.testResult.latency).toBe(250);
      expect(json.testResult.model).toBe("claude-3-haiku-20240307");
    });
  });

  // ─── POST /test-provider ────────────────────────────────────────

  describe("POST /test-provider", () => {
    const validPayload = {
      provider: "anthropic",
      apiKey: "sk-ant-valid-key-1234",
    };

    it("should return test result when provider responds", async () => {
      const req = new Request("http://localhost/ai-analytics/test-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });
      const res = await adminApp.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(true);

      expect(mockServiceInstance.testProvider).toHaveBeenCalledOnce();
    });

    it("should return 500 when service throws", async () => {
      mockServiceInstance.testProvider.mockRejectedValueOnce(
        new Error("Network error"),
      );

      const req = new Request("http://localhost/ai-analytics/test-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });
      const res = await adminApp.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as {
        success: boolean;
        error: { message: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.message).toContain("Network error");
    });

    it("should return 400 for invalid body (missing apiKey)", async () => {
      const req = new Request("http://localhost/ai-analytics/test-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "openai" }),
      });
      const res = await adminApp.fetch(req, mockEnv);
      expect(res.status).toBe(400);
    });

    it("should be accessible without RBAC restriction", async () => {
      const req = new Request("http://localhost/ai-analytics/test-provider", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });
      const res = await staffApp.fetch(req, mockEnv);
      expect(res.status).toBe(200); // No role check on this endpoint
    });
  });

  // ─── GET /models/:provider ──────────────────────────────────────

  describe("GET /models/:provider", () => {
    it("should return models list for a valid provider", async () => {
      const req = new Request("http://localhost/ai-analytics/models/anthropic");
      const res = await adminApp.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        provider: string;
        models: string[];
        defaultModel: string;
      };
      expect(json.success).toBe(true);
      expect(json.provider).toBe("anthropic");
      expect(Array.isArray(json.models)).toBe(true);
      expect(json.defaultModel).toBeDefined();
    });

    it("should be accessible to any role (no RBAC)", async () => {
      const req = new Request("http://localhost/ai-analytics/models/openai");
      const res = await staffApp.fetch(req, mockEnv);
      expect(res.status).toBe(200);
    });

    it("should return provider in response matching path param", async () => {
      const req = new Request("http://localhost/ai-analytics/models/deepseek");
      const res = await adminApp.fetch(req, mockEnv);
      const json = (await res.json()) as { provider: string };
      expect(json.provider).toBe("deepseek");
    });
  });

  // ─── POST /generate ─────────────────────────────────────────────

  describe("POST /generate", () => {
    const validPayload = {
      restaurantId: "restaurant-123",
      timeRange: { range: "30d" },
    };

    it("should return 200 with report (role 0)", async () => {
      const req = new Request("http://localhost/ai-analytics/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });
      const res = await adminApp.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        report: object;
        cached: boolean;
      };
      expect(json.success).toBe(true);
      expect(json.report).toBeDefined();
      expect(json.cached).toBe(false);

      expect(mockServiceInstance.generateReport).toHaveBeenCalledOnce();
    });

    it("should return 200 with report (role 1)", async () => {
      const req = new Request("http://localhost/ai-analytics/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });
      const res = await ownerApp.fetch(req, mockEnv);
      expect(res.status).toBe(200);
    });

    it("should return 403 for role 2 (RBAC)", async () => {
      const req = new Request("http://localhost/ai-analytics/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });
      const res = await staffApp.fetch(req, mockEnv);
      expect(res.status).toBe(403);
    });

    it("should return 500 when generateReport throws", async () => {
      mockServiceInstance.generateReport.mockRejectedValueOnce(
        new Error("AI provider not configured"),
      );

      const req = new Request("http://localhost/ai-analytics/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validPayload),
      });
      const res = await adminApp.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string; message: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.message).toContain("AI provider not configured");
    });

    it("should return 400 for invalid body (zValidator)", async () => {
      const req = new Request("http://localhost/ai-analytics/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: "restaurant-123" }), // missing timeRange
      });
      const res = await adminApp.fetch(req, mockEnv);
      expect(res.status).toBe(400);
    });
  });

  // ─── GET /products/traffic-drivers/:restaurantId ─────────────────

  describe("GET /products/traffic-drivers/:restaurantId", () => {
    it("should return 200 with empty products array", async () => {
      const req = new Request(
        "http://localhost/ai-analytics/products/traffic-drivers/restaurant-123",
      );
      const res = await adminApp.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        products: unknown[];
      };
      expect(json.success).toBe(true);
      expect(Array.isArray(json.products)).toBe(true);

      expect(mockServiceInstance.getTrafficDrivers).toHaveBeenCalledOnce();
    });

    it("should return 500 when service throws", async () => {
      mockServiceInstance.getTrafficDrivers.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const req = new Request(
        "http://localhost/ai-analytics/products/traffic-drivers/restaurant-123",
      );
      const res = await adminApp.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as {
        success: boolean;
        error: { message: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.message).toContain("DB error");

      expect(mockServiceInstance.getTrafficDrivers).toHaveBeenCalledOnce();
    });
  });

  // ─── GET /products/bestsellers/:restaurantId ────────────────────

  describe("GET /products/bestsellers/:restaurantId", () => {
    it("should return 200 with products array", async () => {
      const req = new Request(
        "http://localhost/ai-analytics/products/bestsellers/restaurant-123",
      );
      const res = await adminApp.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        products: unknown[];
      };
      expect(json.success).toBe(true);

      expect(mockServiceInstance.getBestsellers).toHaveBeenCalledOnce();
    });

    it("should return 500 when service throws", async () => {
      mockServiceInstance.getBestsellers.mockRejectedValueOnce(
        new Error("Query failed"),
      );

      const req = new Request(
        "http://localhost/ai-analytics/products/bestsellers/restaurant-123",
      );
      const res = await adminApp.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);

      expect(mockServiceInstance.getBestsellers).toHaveBeenCalledOnce();
    });
  });

  // ─── GET /products/profit-leaders/:restaurantId ──────────────────

  describe("GET /products/profit-leaders/:restaurantId", () => {
    it("should return 200 with products array", async () => {
      const req = new Request(
        "http://localhost/ai-analytics/products/profit-leaders/restaurant-123",
      );
      const res = await adminApp.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        products: unknown[];
      };
      expect(json.success).toBe(true);

      expect(mockServiceInstance.getProfitLeaders).toHaveBeenCalledOnce();
    });

    it("should return 500 when service throws", async () => {
      mockServiceInstance.getProfitLeaders.mockRejectedValueOnce(
        new Error("Query failed"),
      );

      const req = new Request(
        "http://localhost/ai-analytics/products/profit-leaders/restaurant-123",
      );
      const res = await adminApp.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);

      expect(mockServiceInstance.getProfitLeaders).toHaveBeenCalledOnce();
    });
  });

  // ─── GET /products/analysis/:restaurantId ───────────────────────

  describe("GET /products/analysis/:restaurantId", () => {
    it("should return 200 with products array", async () => {
      const req = new Request(
        "http://localhost/ai-analytics/products/analysis/restaurant-123",
      );
      const res = await adminApp.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        products: unknown[];
      };
      expect(json.success).toBe(true);

      expect(mockServiceInstance.analyzeProducts).toHaveBeenCalledOnce();
    });

    it("should return 500 when service throws", async () => {
      mockServiceInstance.analyzeProducts.mockRejectedValueOnce(
        new Error("Analysis failed"),
      );

      const req = new Request(
        "http://localhost/ai-analytics/products/analysis/restaurant-123",
      );
      const res = await adminApp.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);

      expect(mockServiceInstance.analyzeProducts).toHaveBeenCalledOnce();
    });
  });

  // ─── GET /usage/:restaurantId ────────────────────────────────────

  describe("GET /usage/:restaurantId", () => {
    it("should return 200 with empty usage array", async () => {
      const req = new Request(
        "http://localhost/ai-analytics/usage/restaurant-123",
      );
      const res = await adminApp.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        usage: unknown[];
      };
      expect(json.success).toBe(true);
      expect(Array.isArray(json.usage)).toBe(true);

      expect(mockServiceInstance.getUsageStats).toHaveBeenCalledOnce();
    });

    it("should accept optional startDate and endDate query params", async () => {
      const req = new Request(
        "http://localhost/ai-analytics/usage/restaurant-123?startDate=2026-01-01&endDate=2026-03-14",
      );
      const res = await adminApp.fetch(req, mockEnv);
      expect(res.status).toBe(200);
    });

    it("should return 500 when service throws", async () => {
      mockServiceInstance.getUsageStats.mockRejectedValueOnce(
        new Error("DB error"),
      );

      const req = new Request(
        "http://localhost/ai-analytics/usage/restaurant-123",
      );
      const res = await adminApp.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as {
        success: boolean;
        error: { message: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.message).toContain("DB error");
    });
  });
});
