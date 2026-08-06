import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  createTestDatabase,
  type TestDatabase,
} from "@makanmakan/database/testing";
import {
  aiConfigurations,
  aiUsageLogs,
  restaurants,
} from "@makanmakan/database";
import { AIAnalyticsService } from "../../features/ai-analytics/services/AIAnalyticsService";

const analyticsMocks = vi.hoisted(() => ({
  testProvider: vi.fn(),
  getDefaultModel: vi.fn(),
  getAvailableModels: vi.fn(),
  insightsGenerateReport: vi.fn(),
  insightsCtor: vi.fn(),
  productCtor: vi.fn(),
  getTrafficDrivers: vi.fn(),
  getBestsellers: vi.fn(),
  getProfitLeaders: vi.fn(),
  analyzeProducts: vi.fn(),
}));

const cryptoMocks = vi.hoisted(() => ({
  encrypt: vi.fn(),
  decrypt: vi.fn(),
}));

vi.mock("@makanmakan/ai-analytics", () => ({
  AIInsightsService: vi.fn(function AIInsightsService(...args: unknown[]) {
    analyticsMocks.insightsCtor(...args);
    return {
      generateReport: analyticsMocks.insightsGenerateReport,
    };
  }),
  ProductAnalysisService: vi.fn(function ProductAnalysisService(
    ...args: unknown[]
  ) {
    analyticsMocks.productCtor(...args);
    return {
      getTrafficDrivers: analyticsMocks.getTrafficDrivers,
      getBestsellers: analyticsMocks.getBestsellers,
      getProfitLeaders: analyticsMocks.getProfitLeaders,
      analyzeProducts: analyticsMocks.analyzeProducts,
    };
  }),
  testProvider: analyticsMocks.testProvider,
  getDefaultModel: analyticsMocks.getDefaultModel,
  getAvailableModels: analyticsMocks.getAvailableModels,
}));

vi.mock("@makanmakan/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@makanmakan/utils")>();
  return {
    ...actual,
    encrypt: cryptoMocks.encrypt,
    decrypt: cryptoMocks.decrypt,
  };
});

let testDb: TestDatabase;
let service: AIAnalyticsService;

async function seedRestaurant(id = "restaurant-1") {
  await testDb.drizzle.insert(restaurants).values({
    id,
    name: "AI Analytics Test Restaurant",
    type: "street_food",
    category: "snack",
    address: "1 Test Rd",
    district: "West",
    phone: "0900000000",
  });
}

describe("AIAnalyticsService", () => {
  beforeAll(async () => {
    testDb = await createTestDatabase();
  });

  afterAll(async () => {
    await testDb?.dispose();
  });

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T12:00:00.000Z"));
    vi.clearAllMocks();
    await testDb.truncateAll();
    await seedRestaurant();
    service = new AIAnalyticsService(testDb.bindings.DB, "encryption-key");
    analyticsMocks.testProvider.mockResolvedValue({
      success: true,
      latencyMs: 42,
      model: "gpt-test",
    });
    analyticsMocks.getDefaultModel.mockReturnValue("default-model");
    analyticsMocks.getAvailableModels.mockReturnValue(["model-a", "model-b"]);
    cryptoMocks.encrypt.mockResolvedValue("encrypted-key");
    cryptoMocks.decrypt.mockResolvedValue("plain-key");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns stored AI configuration rows and null for missing restaurants", async () => {
    await testDb.drizzle.insert(aiConfigurations).values({
      restaurantId: "restaurant-1",
      provider: "openai",
      apiKeyEncrypted: "ciphertext",
      model: "gpt-test",
      customBaseUrl: "https://ai.example.test/v1",
      enabled: false,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-02T00:00:00.000Z",
    });

    await expect(service.getConfig("missing")).resolves.toBeNull();
    await expect(service.getConfig("restaurant-1")).resolves.toMatchObject({
      restaurantId: "restaurant-1",
      provider: "openai",
      apiKeyEncrypted: "ciphertext",
      model: "gpt-test",
      customBaseUrl: "https://ai.example.test/v1",
      enabled: false,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-02T00:00:00.000Z",
    });
  });

  it("decrypts enabled configuration into an LLM config", async () => {
    await testDb.drizzle.insert(aiConfigurations).values({
      restaurantId: "restaurant-1",
      provider: "custom",
      apiKeyEncrypted: "ciphertext",
      model: null,
      customBaseUrl: "https://custom.example.test/v1",
      enabled: true,
    });

    const llmConfig = await service.getLLMConfig("restaurant-1");

    expect(cryptoMocks.decrypt).toHaveBeenCalledWith(
      "ciphertext",
      "encryption-key",
      "makanmakan-api-key-encryption-salt",
    );
    expect(llmConfig).toEqual({
      provider: "custom",
      apiKey: "plain-key",
      model: undefined,
      baseUrl: "https://custom.example.test/v1",
    });
  });

  it("encrypts, validates, and upserts provider configuration", async () => {
    await service.saveConfig({
      restaurantId: "restaurant-1",
      provider: "openai",
      apiKey: "sk-test-key",
      model: "gpt-test",
      customBaseUrl: "https://openai.example.test/v1",
    });
    await service.saveConfig({
      restaurantId: "restaurant-1",
      provider: "anthropic",
      apiKey: "anthropic-key",
      model: undefined,
      customBaseUrl: undefined,
    });

    const rows = await testDb.drizzle.select().from(aiConfigurations);

    expect(cryptoMocks.encrypt).toHaveBeenCalledWith(
      "sk-test-key",
      "encryption-key",
      "makanmakan-api-key-encryption-salt",
    );
    expect(analyticsMocks.testProvider).toHaveBeenCalledWith({
      provider: "openai",
      apiKey: "sk-test-key",
      model: "gpt-test",
      baseUrl: "https://openai.example.test/v1",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      restaurantId: "restaurant-1",
      provider: "anthropic",
      apiKeyEncrypted: "encrypted-key",
      model: null,
      customBaseUrl: null,
      enabled: true,
    });
  });

  it("does not persist a provider configuration when validation fails", async () => {
    analyticsMocks.testProvider.mockResolvedValueOnce({
      success: false,
      error: "invalid key",
    });

    await expect(
      service.saveConfig({
        restaurantId: "restaurant-1",
        provider: "openai",
        apiKey: "sk-test-key",
      }),
    ).rejects.toThrow("Provider test failed: invalid key");

    await expect(
      testDb.drizzle.select().from(aiConfigurations),
    ).resolves.toHaveLength(0);
  });

  it("generates reports with configured LLM credentials and logs usage", async () => {
    await testDb.drizzle.insert(aiConfigurations).values({
      restaurantId: "restaurant-1",
      provider: "openai",
      apiKeyEncrypted: "ciphertext",
      model: null,
      enabled: true,
    });
    analyticsMocks.insightsGenerateReport.mockResolvedValue({
      id: "report-1",
      metadata: {
        tokensUsed: undefined,
        processingTimeMs: 321,
      },
    });

    const report = await service.generateReport(
      "restaurant-1",
      { range: "7d" },
      { includeForecasting: true, refreshCache: true },
    );
    const usageRows = await testDb.drizzle.select().from(aiUsageLogs);
    const [d1Arg, drizzleArg] = analyticsMocks.insightsCtor.mock.calls[0];

    expect(d1Arg).toBe(testDb.bindings.DB);
    expect(drizzleArg).toBeTruthy();
    expect(analyticsMocks.insightsGenerateReport).toHaveBeenCalledWith(
      "restaurant-1",
      {
        provider: "openai",
        apiKey: "plain-key",
        model: undefined,
        baseUrl: undefined,
      },
      { range: "7d" },
      { includeForecasting: true, refreshCache: true },
    );
    expect(analyticsMocks.getDefaultModel).toHaveBeenCalledWith("openai");
    expect(report).toMatchObject({ id: "report-1" });
    expect(usageRows).toEqual([
      expect.objectContaining({
        restaurantId: "restaurant-1",
        provider: "openai",
        model: "default-model",
        operation: "generate_report",
        tokensUsed: 0,
        latencyMs: 321,
        success: true,
      }),
    ]);
  });

  it("rejects report generation when no enabled provider is configured", async () => {
    await expect(
      service.generateReport("restaurant-1", { range: "30d" }),
    ).rejects.toMatchObject({
      code: "AI_PROVIDER_NOT_CONFIGURED",
      status: 400,
    });
    expect(analyticsMocks.insightsGenerateReport).not.toHaveBeenCalled();
  });

  it("delegates product analysis requests to ProductAnalysisService", async () => {
    analyticsMocks.getTrafficDrivers.mockResolvedValue([{ id: "traffic" }]);
    analyticsMocks.getBestsellers.mockResolvedValue([{ id: "best" }]);
    analyticsMocks.getProfitLeaders.mockResolvedValue([{ id: "profit" }]);
    analyticsMocks.analyzeProducts.mockResolvedValue([{ id: "analysis" }]);

    await expect(
      service.getTrafficDrivers("restaurant-1", { range: "7d" }, 3),
    ).resolves.toEqual([{ id: "traffic" }]);
    await expect(
      service.getBestsellers("restaurant-1", { range: "14d" }, 4),
    ).resolves.toEqual([{ id: "best" }]);
    await expect(
      service.getProfitLeaders("restaurant-1", { range: "90d" }, 5),
    ).resolves.toEqual([{ id: "profit" }]);
    await expect(
      service.analyzeProducts("restaurant-1", { range: "180d" }),
    ).resolves.toEqual([{ id: "analysis" }]);

    expect(analyticsMocks.productCtor).toHaveBeenCalledTimes(4);
    expect(analyticsMocks.getTrafficDrivers).toHaveBeenCalledWith(
      "restaurant-1",
      { range: "7d" },
      3,
    );
    expect(analyticsMocks.getBestsellers).toHaveBeenCalledWith(
      "restaurant-1",
      { range: "14d" },
      4,
    );
    expect(analyticsMocks.getProfitLeaders).toHaveBeenCalledWith(
      "restaurant-1",
      { range: "90d" },
      5,
    );
    expect(analyticsMocks.analyzeProducts).toHaveBeenCalledWith(
      "restaurant-1",
      { range: "180d" },
    );
  });

  it("aggregates usage statistics with optional date filters", async () => {
    await testDb.drizzle.insert(aiUsageLogs).values([
      {
        restaurantId: "restaurant-1",
        provider: "openai",
        model: "gpt-test",
        operation: "generate_report",
        tokensUsed: 100,
        latencyMs: 200,
        success: true,
        createdAt: "2026-06-01T08:00:00.000Z",
      },
      {
        restaurantId: "restaurant-1",
        provider: "openai",
        model: "gpt-test",
        operation: "generate_report",
        tokensUsed: 50,
        latencyMs: 400,
        success: false,
        createdAt: "2026-06-02T08:00:00.000Z",
      },
      {
        restaurantId: "restaurant-1",
        provider: "anthropic",
        model: "claude-test",
        operation: "analyze_products",
        tokensUsed: 25,
        latencyMs: 100,
        success: true,
        createdAt: "2026-05-01T08:00:00.000Z",
      },
    ]);

    const stats = await service.getUsageStats(
      "restaurant-1",
      "2026-06-01",
      "2026-06-30",
    );

    expect(stats).toEqual([
      {
        provider: "openai",
        model: "gpt-test",
        operation: "generate_report",
        requestCount: 2,
        totalTokens: 150,
        avgLatencyMs: 300,
        successfulRequests: 1,
      },
    ]);
  });

  it("exposes available and default model helpers", () => {
    expect(AIAnalyticsService.getAvailableModels("openai")).toEqual([
      "model-a",
      "model-b",
    ]);
    expect(AIAnalyticsService.getDefaultModel("openai")).toBe("default-model");
  });
});
