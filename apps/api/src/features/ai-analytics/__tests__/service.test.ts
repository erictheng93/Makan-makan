// apps/api/src/features/ai-analytics/__tests__/service.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AIAnalyticsService } from "../services/AIAnalyticsService";

// Mock the external ai-analytics package
vi.mock("@makanmakan/ai-analytics", () => ({
  AIInsightsService: vi.fn(function () {
    return {
      generateReport: vi.fn().mockResolvedValue({
        summary: "Test summary",
        insights: ["Insight 1"],
        recommendations: ["Recommendation 1"],
        metadata: {
          generatedAt: "2026-03-14T00:00:00Z",
          processingTimeMs: 1500,
          tokensUsed: 500,
          model: "claude-3-haiku-20240307",
        },
      }),
    };
  }),
  ProductAnalysisService: vi.fn(function () {
    return {
      getTrafficDrivers: vi.fn().mockResolvedValue([]),
      getBestsellers: vi.fn().mockResolvedValue([]),
      getProfitLeaders: vi.fn().mockResolvedValue([]),
      analyzeProducts: vi.fn().mockResolvedValue([]),
    };
  }),
  testProvider: vi.fn().mockResolvedValue({
    success: true,
    latencyMs: 250,
    model: "claude-3-haiku-20240307",
  }),
  getDefaultModel: vi.fn().mockReturnValue("claude-3-haiku-20240307"),
  getAvailableModels: vi
    .fn()
    .mockReturnValue(["claude-3-haiku-20240307", "claude-3-sonnet-20240229"]),
}));

// ─── Mock Drizzle ────────────────────────────────────────────────────────

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => mockDb),
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn((...args: any[]) => args),
}));

vi.mock("@makanmakan/database", () => ({
  aiConfigurations: {
    restaurantId: "restaurantId",
    provider: "provider",
    apiKeyEncrypted: "apiKeyEncrypted",
    model: "model",
    customBaseUrl: "customBaseUrl",
    enabled: "enabled",
  },
  aiUsageLogs: {
    restaurantId: "restaurantId",
    provider: "provider",
    model: "model",
    operation: "operation",
    tokensUsed: "tokensUsed",
    latencyMs: "latencyMs",
    success: "success",
    createdAt: "createdAt",
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────

function makeSelectChain(returnValue: unknown) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(returnValue),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(returnValue),
  };
}

function makeInsertChain() {
  return {
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
  };
}

function makeSimpleInsertChain() {
  return {
    values: vi.fn().mockResolvedValue(undefined),
  };
}

// ─── Constants ────────────────────────────────────────────────────────────

const ENCRYPTION_KEY = "test-encryption-key-for-testing-only-32chars";
const TEST_API_KEY = "sk-test-api-key-1234567890";
const RESTAURANT_ID = "restaurant-test-123";

describe("AIAnalyticsService", () => {
  let service: AIAnalyticsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AIAnalyticsService({} as any, ENCRYPTION_KEY);
  });

  // ─── Encryption / Decryption ────────────────────────────────────

  describe("encrypt/decrypt round-trip (via saveConfig + getLLMConfig)", () => {
    it("should encrypt API key when saving config", async () => {
      const insertChain = makeInsertChain();
      mockDb.insert.mockReturnValue(insertChain);

      await service.saveConfig({
        restaurantId: RESTAURANT_ID,
        provider: "openai",
        apiKey: TEST_API_KEY,
      });

      expect(mockDb.insert).toHaveBeenCalled();
      // The values should contain an encrypted key (not plaintext)
      const valuesArg = insertChain.values.mock.calls[0][0];
      expect(valuesArg.apiKeyEncrypted).not.toBe(TEST_API_KEY);
      expect(valuesArg.apiKeyEncrypted).toContain(":"); // AES-GCM format
    });

    it("should decrypt API key when retrieving LLM config", async () => {
      // First encrypt a key
      const insertChain = makeInsertChain();
      mockDb.insert.mockReturnValue(insertChain);

      await service.saveConfig({
        restaurantId: RESTAURANT_ID,
        provider: "openai",
        apiKey: TEST_API_KEY,
      });

      const encryptedKey = insertChain.values.mock.calls[0][0].apiKeyEncrypted;

      // Now set up getLLMConfig to return the captured encrypted key
      mockDb.select.mockReturnValue(
        makeSelectChain([
          {
            provider: "openai",
            apiKeyEncrypted: encryptedKey,
            model: null,
            customBaseUrl: null,
          },
        ]),
      );

      const llmConfig = await service.getLLMConfig(RESTAURANT_ID);
      expect(llmConfig).not.toBeNull();
      expect(llmConfig!.apiKey).toBe(TEST_API_KEY);
      expect(llmConfig!.provider).toBe("openai");
    });

    it("should handle legacy base64 format without colon separator", async () => {
      const legacyApiKey = "legacy-api-key-1234567890";
      const legacyEncoded = btoa(legacyApiKey);

      mockDb.select.mockReturnValue(
        makeSelectChain([
          {
            provider: "openai",
            apiKeyEncrypted: legacyEncoded,
            model: null,
            customBaseUrl: null,
          },
        ]),
      );

      const llmConfig = await service.getLLMConfig(RESTAURANT_ID);
      expect(llmConfig).not.toBeNull();
      expect(llmConfig!.apiKey).toBe(legacyApiKey);
    });
  });

  // ─── getConfig ──────────────────────────────────────────────────

  describe("getConfig", () => {
    it("should return null when no config exists", async () => {
      mockDb.select.mockReturnValue(makeSelectChain([]));

      const config = await service.getConfig(RESTAURANT_ID);
      expect(config).toBeNull();
    });

    it("should return mapped AIConfiguration when config exists", async () => {
      mockDb.select.mockReturnValue(
        makeSelectChain([
          {
            id: 1,
            restaurantId: RESTAURANT_ID,
            provider: "anthropic",
            apiKeyEncrypted: "iv:encrypted",
            model: "claude-3-haiku-20240307",
            customBaseUrl: null,
            enabled: true,
            createdAt: "2026-03-01T00:00:00Z",
            updatedAt: "2026-03-14T00:00:00Z",
          },
        ]),
      );

      const config = await service.getConfig(RESTAURANT_ID);
      expect(config).not.toBeNull();
      expect(config!.restaurantId).toBe(RESTAURANT_ID);
      expect(config!.provider).toBe("anthropic");
      expect(config!.enabled).toBe(true);
      expect(config!.model).toBe("claude-3-haiku-20240307");
    });

    it("should map enabled=false correctly", async () => {
      mockDb.select.mockReturnValue(
        makeSelectChain([
          {
            id: 1,
            restaurantId: RESTAURANT_ID,
            provider: "openai",
            apiKeyEncrypted: "iv:encrypted",
            model: null,
            customBaseUrl: null,
            enabled: false,
            createdAt: "2026-03-01T00:00:00Z",
            updatedAt: "2026-03-14T00:00:00Z",
          },
        ]),
      );

      const config = await service.getConfig(RESTAURANT_ID);
      expect(config!.enabled).toBe(false);
    });
  });

  // ─── getLLMConfig ───────────────────────────────────────────────

  describe("getLLMConfig", () => {
    it("should return null when no enabled config exists", async () => {
      mockDb.select.mockReturnValue(makeSelectChain([]));

      const llmConfig = await service.getLLMConfig(RESTAURANT_ID);
      expect(llmConfig).toBeNull();
    });

    it("should include optional model and baseUrl when present", async () => {
      // First encrypt a key
      const insertChain = makeInsertChain();
      mockDb.insert.mockReturnValue(insertChain);
      await service.saveConfig({
        restaurantId: RESTAURANT_ID,
        provider: "custom",
        apiKey: TEST_API_KEY,
        customBaseUrl: "https://custom-llm.example.com",
      });

      const encryptedKey = insertChain.values.mock.calls[0][0].apiKeyEncrypted;

      mockDb.select.mockReturnValue(
        makeSelectChain([
          {
            provider: "custom",
            apiKeyEncrypted: encryptedKey,
            model: "my-custom-model",
            customBaseUrl: "https://custom-llm.example.com",
          },
        ]),
      );

      const llmConfig = await service.getLLMConfig(RESTAURANT_ID);
      expect(llmConfig!.model).toBe("my-custom-model");
      expect(llmConfig!.baseUrl).toBe("https://custom-llm.example.com");
    });
  });

  // ─── saveConfig ─────────────────────────────────────────────────

  describe("saveConfig", () => {
    it("should call testProvider before saving", async () => {
      const { testProvider } = await import("@makanmakan/ai-analytics");
      mockDb.insert.mockReturnValue(makeInsertChain());

      await service.saveConfig({
        restaurantId: RESTAURANT_ID,
        provider: "openai",
        apiKey: TEST_API_KEY,
      });

      expect(testProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "openai",
          apiKey: TEST_API_KEY,
        }),
      );
    });

    it("should throw when testProvider returns failure", async () => {
      const { testProvider } = await import("@makanmakan/ai-analytics");
      vi.mocked(testProvider).mockResolvedValueOnce({
        success: false,
        provider: "openai",
        error: "Invalid API key",
      });

      await expect(
        service.saveConfig({
          restaurantId: RESTAURANT_ID,
          provider: "openai",
          apiKey: TEST_API_KEY,
        }),
      ).rejects.toThrow("Provider test failed: Invalid API key");
    });

    it("should execute upsert via Drizzle insert with onConflictDoUpdate", async () => {
      const insertChain = makeInsertChain();
      mockDb.insert.mockReturnValue(insertChain);

      await service.saveConfig({
        restaurantId: RESTAURANT_ID,
        provider: "anthropic",
        apiKey: TEST_API_KEY,
      });

      expect(mockDb.insert).toHaveBeenCalled();
      expect(insertChain.values).toHaveBeenCalled();
      expect(insertChain.onConflictDoUpdate).toHaveBeenCalled();
    });
  });

  // ─── testProvider ───────────────────────────────────────────────

  describe("testProvider", () => {
    it("should return success result from external testProvider", async () => {
      const result = await service.testProvider({
        provider: "openai",
        apiKey: TEST_API_KEY,
      });

      expect(result.success).toBe(true);
      expect(result.latencyMs).toBeDefined();
    });

    it("should return failure result when external provider throws", async () => {
      const { testProvider } = await import("@makanmakan/ai-analytics");
      vi.mocked(testProvider).mockRejectedValueOnce(
        new Error("Connection refused"),
      );

      const result = await service.testProvider({
        provider: "openai",
        apiKey: TEST_API_KEY,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection refused");
    });

    it("should handle non-Error exception as generic message", async () => {
      const { testProvider } = await import("@makanmakan/ai-analytics");
      vi.mocked(testProvider).mockRejectedValueOnce("string error");

      const result = await service.testProvider({
        provider: "anthropic",
        apiKey: TEST_API_KEY,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Test failed");
    });
  });

  // ─── generateReport ─────────────────────────────────────────────

  describe("generateReport", () => {
    it("should throw when no LLM config is available", async () => {
      mockDb.select.mockReturnValue(makeSelectChain([]));

      await expect(
        service.generateReport(RESTAURANT_ID, { range: "30d" }),
      ).rejects.toThrow(
        "AI provider not configured. Please configure an AI provider first.",
      );
    });

    it("should log usage to ai_usage_logs after successful report", async () => {
      // First encrypt a key
      const saveInsertChain = makeInsertChain();
      mockDb.insert.mockReturnValue(saveInsertChain);
      await service.saveConfig({
        restaurantId: RESTAURANT_ID,
        provider: "anthropic",
        apiKey: TEST_API_KEY,
      });

      const encryptedKey =
        saveInsertChain.values.mock.calls[0][0].apiKeyEncrypted;

      // Set up getLLMConfig
      mockDb.select.mockReturnValue(
        makeSelectChain([
          {
            provider: "anthropic",
            apiKeyEncrypted: encryptedKey,
            model: "claude-3-haiku-20240307",
            customBaseUrl: null,
          },
        ]),
      );

      // Set up insert for usage log
      const usageInsertChain = makeSimpleInsertChain();
      mockDb.insert.mockReturnValue(usageInsertChain);

      await service.generateReport(RESTAURANT_ID, { range: "30d" });

      // Verify usage log was inserted
      expect(mockDb.insert).toHaveBeenCalled();
      const valuesArg = usageInsertChain.values.mock.calls[0][0];
      expect(valuesArg.operation).toBe("generate_report");
      expect(valuesArg.provider).toBe("anthropic");
    });

    it("should pass timeRange and options to AIInsightsService", async () => {
      // First encrypt a key
      const saveInsertChain = makeInsertChain();
      mockDb.insert.mockReturnValue(saveInsertChain);
      await service.saveConfig({
        restaurantId: RESTAURANT_ID,
        provider: "openai",
        apiKey: TEST_API_KEY,
      });

      const encryptedKey =
        saveInsertChain.values.mock.calls[0][0].apiKeyEncrypted;

      mockDb.select.mockReturnValue(
        makeSelectChain([
          {
            provider: "openai",
            apiKeyEncrypted: encryptedKey,
            model: null,
            customBaseUrl: null,
          },
        ]),
      );
      mockDb.insert.mockReturnValue(makeSimpleInsertChain());

      const { AIInsightsService } = await import("@makanmakan/ai-analytics");
      const generateReportMock = vi.fn().mockResolvedValue({
        summary: "Test",
        insights: [],
        recommendations: [],
        metadata: {
          generatedAt: "2026-03-14T00:00:00Z",
          processingTimeMs: 100,
          tokensUsed: 50,
          model: "gpt-4",
        },
      });
      vi.mocked(AIInsightsService).mockImplementationOnce(function () {
        return { generateReport: generateReportMock } as any;
      });

      await service.generateReport(
        RESTAURANT_ID,
        { range: "7d" },
        {
          includeForecasting: true,
          refreshCache: false,
        },
      );

      expect(generateReportMock).toHaveBeenCalledWith(
        RESTAURANT_ID,
        expect.any(Object),
        { range: "7d" },
        { includeForecasting: true, refreshCache: false },
      );
    });
  });

  // ─── Product Analysis ───────────────────────────────────────────

  describe("getTrafficDrivers / getBestsellers / getProfitLeaders / analyzeProducts", () => {
    it("should call ProductAnalysisService.getTrafficDrivers", async () => {
      const { ProductAnalysisService } =
        await import("@makanmakan/ai-analytics");
      const getTrafficDriversMock = vi.fn().mockResolvedValue([]);
      vi.mocked(ProductAnalysisService).mockImplementationOnce(function () {
        return { getTrafficDrivers: getTrafficDriversMock } as any;
      });

      await service.getTrafficDrivers(RESTAURANT_ID, { range: "30d" }, 5);

      expect(getTrafficDriversMock).toHaveBeenCalledWith(
        RESTAURANT_ID,
        { range: "30d" },
        5,
      );
    });

    it("should call ProductAnalysisService.getBestsellers", async () => {
      const { ProductAnalysisService } =
        await import("@makanmakan/ai-analytics");
      const getBestsellersMock = vi.fn().mockResolvedValue([]);
      vi.mocked(ProductAnalysisService).mockImplementationOnce(function () {
        return { getBestsellers: getBestsellersMock } as any;
      });

      await service.getBestsellers(RESTAURANT_ID, { range: "14d" }, 15);

      expect(getBestsellersMock).toHaveBeenCalledWith(
        RESTAURANT_ID,
        { range: "14d" },
        15,
      );
    });

    it("should call ProductAnalysisService.getProfitLeaders", async () => {
      const { ProductAnalysisService } =
        await import("@makanmakan/ai-analytics");
      const getProfitLeadersMock = vi.fn().mockResolvedValue([]);
      vi.mocked(ProductAnalysisService).mockImplementationOnce(function () {
        return { getProfitLeaders: getProfitLeadersMock } as any;
      });

      await service.getProfitLeaders(RESTAURANT_ID, { range: "90d" });

      expect(getProfitLeadersMock).toHaveBeenCalledWith(
        RESTAURANT_ID,
        { range: "90d" },
        10, // default limit
      );
    });

    it("should call ProductAnalysisService.analyzeProducts", async () => {
      const { ProductAnalysisService } =
        await import("@makanmakan/ai-analytics");
      const analyzeProductsMock = vi.fn().mockResolvedValue([]);
      vi.mocked(ProductAnalysisService).mockImplementationOnce(function () {
        return { analyzeProducts: analyzeProductsMock } as any;
      });

      await service.analyzeProducts(RESTAURANT_ID, { range: "180d" });

      expect(analyzeProductsMock).toHaveBeenCalledWith(RESTAURANT_ID, {
        range: "180d",
      });
    });
  });

  // ─── getUsageStats ──────────────────────────────────────────────

  describe("getUsageStats", () => {
    it("should return empty array when no usage logs exist", async () => {
      const chain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };
      mockDb.select.mockReturnValue(chain);

      const stats = await service.getUsageStats(RESTAURANT_ID);
      expect(stats).toEqual([]);
    });

    it("should return mapped usage stats", async () => {
      const chain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([
          {
            provider: "anthropic",
            model: "claude-3-haiku-20240307",
            operation: "generate_report",
            requestCount: 5,
            totalTokens: 2500,
            avgLatencyMs: 1200,
            successfulRequests: 5,
          },
        ]),
      };
      mockDb.select.mockReturnValue(chain);

      const stats = await service.getUsageStats(RESTAURANT_ID);
      expect(stats).toHaveLength(1);
      expect(stats[0].provider).toBe("anthropic");
      expect(stats[0].requestCount).toBe(5);
      expect(stats[0].totalTokens).toBe(2500);
      expect(stats[0].avgLatencyMs).toBe(1200);
      expect(stats[0].successfulRequests).toBe(5);
    });

    it("should include date filters when provided", async () => {
      const chain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };
      mockDb.select.mockReturnValue(chain);

      await service.getUsageStats(RESTAURANT_ID, "2026-01-01", "2026-03-14");

      // Verify select was called (date filtering happens in the where clause)
      expect(mockDb.select).toHaveBeenCalled();
      expect(chain.where).toHaveBeenCalled();
    });
  });

  // ─── Static Helpers ─────────────────────────────────────────────

  describe("static helpers", () => {
    it("getAvailableModels should return models array from ai-analytics package", () => {
      const models = AIAnalyticsService.getAvailableModels("anthropic");
      expect(Array.isArray(models)).toBe(true);
    });

    it("getDefaultModel should return a string model name", () => {
      const defaultModel = AIAnalyticsService.getDefaultModel("openai");
      expect(typeof defaultModel).toBe("string");
      expect(defaultModel.length).toBeGreaterThan(0);
    });
  });
});
