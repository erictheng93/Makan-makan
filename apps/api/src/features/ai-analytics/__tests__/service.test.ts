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

// Mock database module
vi.mock("@makanmakan/database", () => ({
  getCurrentTimestamp: vi.fn().mockReturnValue(1741910400000),
}));

function createMockDb() {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
      }),
    }),
    batch: vi.fn().mockResolvedValue([]),
  };
}

const ENCRYPTION_KEY = "test-encryption-key-for-testing-only-32chars";
const TEST_API_KEY = "sk-test-api-key-1234567890";
const RESTAURANT_ID = "restaurant-test-123";

describe("AIAnalyticsService", () => {
  let service: AIAnalyticsService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new AIAnalyticsService(mockDb as any, ENCRYPTION_KEY);
  });

  // ─── Encryption / Decryption ────────────────────────────────────

  describe("encrypt/decrypt round-trip (via saveConfig + getLLMConfig)", () => {
    it("should encrypt API key when saving config", async () => {
      const bindMock = vi.fn().mockReturnValue({
        run: vi.fn().mockResolvedValue({ success: true }),
      });
      mockDb.prepare.mockReturnValue({ bind: bindMock });

      await service.saveConfig({
        restaurantId: RESTAURANT_ID,
        provider: "openai",
        apiKey: TEST_API_KEY,
      });

      // The bind was called — verify the encrypted key is not the plaintext
      const boundArgs = bindMock.mock.calls[0];
      const encryptedKey = boundArgs[2]; // index 2: api_key_encrypted
      expect(encryptedKey).not.toBe(TEST_API_KEY);
      expect(encryptedKey).toContain(":"); // AES-GCM format: iv:encrypted
    });

    it("should decrypt API key when retrieving LLM config", async () => {
      // First, encrypt a key by calling saveConfig
      let capturedEncryptedKey = "";
      const bindMock = vi.fn().mockImplementation((...args: any[]) => {
        capturedEncryptedKey = args[2]; // capture the encrypted key
        return { run: vi.fn().mockResolvedValue({ success: true }) };
      });
      mockDb.prepare.mockReturnValue({ bind: bindMock });

      await service.saveConfig({
        restaurantId: RESTAURANT_ID,
        provider: "openai",
        apiKey: TEST_API_KEY,
      });

      // Now set up getLLMConfig to return the captured encrypted key
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            provider: "openai",
            api_key_encrypted: capturedEncryptedKey,
            model: null,
            custom_base_url: null,
          }),
        }),
      });

      const llmConfig = await service.getLLMConfig(RESTAURANT_ID);
      expect(llmConfig).not.toBeNull();
      expect(llmConfig!.apiKey).toBe(TEST_API_KEY);
      expect(llmConfig!.provider).toBe("openai");
    });

    it("should handle legacy base64 format without colon separator", async () => {
      // Legacy format: just base64-encoded string (no colon)
      const legacyApiKey = "legacy-api-key-1234567890";
      const legacyEncoded = btoa(legacyApiKey);

      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            provider: "openai",
            api_key_encrypted: legacyEncoded,
            model: null,
            custom_base_url: null,
          }),
        }),
      });

      const llmConfig = await service.getLLMConfig(RESTAURANT_ID);
      expect(llmConfig).not.toBeNull();
      expect(llmConfig!.apiKey).toBe(legacyApiKey);
    });
  });

  // ─── getConfig ──────────────────────────────────────────────────

  describe("getConfig", () => {
    it("should return null when no config exists", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      });

      const config = await service.getConfig(RESTAURANT_ID);
      expect(config).toBeNull();
    });

    it("should return mapped AIConfiguration when config exists", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            id: 1,
            restaurant_id: RESTAURANT_ID,
            provider: "anthropic",
            api_key_encrypted: "iv:encrypted",
            model: "claude-3-haiku-20240307",
            custom_base_url: null,
            enabled: 1,
            created_at: "2026-03-01T00:00:00Z",
            updated_at: "2026-03-14T00:00:00Z",
          }),
        }),
      });

      const config = await service.getConfig(RESTAURANT_ID);
      expect(config).not.toBeNull();
      expect(config!.restaurantId).toBe(RESTAURANT_ID);
      expect(config!.provider).toBe("anthropic");
      expect(config!.enabled).toBe(true);
      expect(config!.model).toBe("claude-3-haiku-20240307");
    });

    it("should map enabled=0 to false", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            id: 1,
            restaurant_id: RESTAURANT_ID,
            provider: "openai",
            api_key_encrypted: "iv:encrypted",
            model: null,
            custom_base_url: null,
            enabled: 0,
            created_at: "2026-03-01T00:00:00Z",
            updated_at: "2026-03-14T00:00:00Z",
          }),
        }),
      });

      const config = await service.getConfig(RESTAURANT_ID);
      expect(config!.enabled).toBe(false);
    });
  });

  // ─── getLLMConfig ───────────────────────────────────────────────

  describe("getLLMConfig", () => {
    it("should return null when no enabled config exists", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      });

      const llmConfig = await service.getLLMConfig(RESTAURANT_ID);
      expect(llmConfig).toBeNull();
    });

    it("should include optional model and baseUrl when present", async () => {
      // We need a key in the new AES-GCM format, so we'll encrypt one first
      let encryptedKey = "";
      const bindCapture = vi.fn().mockImplementation((...args: any[]) => {
        encryptedKey = args[2];
        return { run: vi.fn().mockResolvedValue({ success: true }) };
      });
      mockDb.prepare.mockReturnValue({ bind: bindCapture });
      await service.saveConfig({
        restaurantId: RESTAURANT_ID,
        provider: "custom",
        apiKey: TEST_API_KEY,
        customBaseUrl: "https://custom-llm.example.com",
      });

      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            provider: "custom",
            api_key_encrypted: encryptedKey,
            model: "my-custom-model",
            custom_base_url: "https://custom-llm.example.com",
          }),
        }),
      });

      const llmConfig = await service.getLLMConfig(RESTAURANT_ID);
      expect(llmConfig!.model).toBe("my-custom-model");
      expect(llmConfig!.baseUrl).toBe("https://custom-llm.example.com");
    });
  });

  // ─── saveConfig ─────────────────────────────────────────────────

  describe("saveConfig", () => {
    it("should call testProvider before saving", async () => {
      const { testProvider } = await import("@makanmakan/ai-analytics");
      const runMock = vi.fn().mockResolvedValue({ success: true });
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({ run: runMock }),
      });

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

    it("should execute INSERT OR REPLACE query on successful save", async () => {
      const runMock = vi.fn().mockResolvedValue({ success: true });
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({ run: runMock }),
      });

      await service.saveConfig({
        restaurantId: RESTAURANT_ID,
        provider: "anthropic",
        apiKey: TEST_API_KEY,
      });

      const insertCall = mockDb.prepare.mock.calls.find((c: string[]) =>
        c[0]?.includes("INSERT INTO ai_configurations"),
      );
      expect(insertCall).toBeDefined();
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
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(null),
        }),
      });

      await expect(
        service.generateReport(RESTAURANT_ID, { range: "30d" }),
      ).rejects.toThrow(
        "AI provider not configured. Please configure an AI provider first.",
      );
    });

    it("should log usage to ai_usage_logs after successful report", async () => {
      let encryptedKey = "";
      const bindCapture = vi.fn().mockImplementation((...args: any[]) => {
        encryptedKey = args[2];
        return { run: vi.fn().mockResolvedValue({ success: true }) };
      });
      mockDb.prepare.mockReturnValue({ bind: bindCapture });
      await service.saveConfig({
        restaurantId: RESTAURANT_ID,
        provider: "anthropic",
        apiKey: TEST_API_KEY,
      });

      // Set up getLLMConfig to return a valid config
      let callCount = 0;
      mockDb.prepare.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                provider: "anthropic",
                api_key_encrypted: encryptedKey,
                model: "claude-3-haiku-20240307",
                custom_base_url: null,
              }),
            }),
          };
        }
        // Second call: INSERT INTO ai_usage_logs
        return {
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({ success: true }),
          }),
        };
      });

      await service.generateReport(RESTAURANT_ID, { range: "30d" });

      const usageLogInsert = mockDb.prepare.mock.calls.find((c: string[]) =>
        c[0]?.includes("INSERT INTO ai_usage_logs"),
      );
      expect(usageLogInsert).toBeDefined();
    });

    it("should pass timeRange and options to AIInsightsService", async () => {
      let encryptedKey = "";
      const bindCapture = vi.fn().mockImplementation((...args: any[]) => {
        encryptedKey = args[2];
        return { run: vi.fn().mockResolvedValue({ success: true }) };
      });
      mockDb.prepare.mockReturnValue({ bind: bindCapture });
      await service.saveConfig({
        restaurantId: RESTAURANT_ID,
        provider: "openai",
        apiKey: TEST_API_KEY,
      });

      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            provider: "openai",
            api_key_encrypted: encryptedKey,
            model: null,
            custom_base_url: null,
          }),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      });

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
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
        }),
      });

      const stats = await service.getUsageStats(RESTAURANT_ID);
      expect(stats).toEqual([]);
    });

    it("should return mapped usage stats", async () => {
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                provider: "anthropic",
                model: "claude-3-haiku-20240307",
                operation: "generate_report",
                request_count: 5,
                total_tokens: 2500,
                avg_latency_ms: 1200,
                successful_requests: 5,
              },
            ],
          }),
        }),
      });

      const stats = await service.getUsageStats(RESTAURANT_ID);
      expect(stats).toHaveLength(1);
      expect(stats[0].provider).toBe("anthropic");
      expect(stats[0].requestCount).toBe(5);
      expect(stats[0].totalTokens).toBe(2500);
      expect(stats[0].avgLatencyMs).toBe(1200);
      expect(stats[0].successfulRequests).toBe(5);
    });

    it("should include date filters in query when provided", async () => {
      const bindMock = vi.fn().mockReturnValue({
        all: vi.fn().mockResolvedValue({ results: [] }),
      });
      mockDb.prepare.mockReturnValue({ bind: bindMock });

      await service.getUsageStats(RESTAURANT_ID, "2026-01-01", "2026-03-14");

      const boundArgs = bindMock.mock.calls[0];
      expect(boundArgs).toContain("2026-01-01");
      expect(boundArgs).toContain("2026-03-14");
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
