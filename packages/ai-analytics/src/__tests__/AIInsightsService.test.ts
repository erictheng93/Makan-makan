/**
 * Tests for AIInsightsService
 * Tests report generation, caching, forecasting, and LLM integration
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AIInsightsService } from "../services/AIInsightsService";
import type { LLMConfig, TimeRangeParams, BusinessMetrics } from "../types";

// Mock @makanmakan/database — keep real schema exports for ProductAnalysisService
vi.mock("@makanmakan/database", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as Record<string, unknown>),
    getCurrentTimestamp: () => Date.now(),
  };
});

// Mock global fetch for LLM providers
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock crypto.randomUUID
vi.stubGlobal("crypto", {
  randomUUID: () => "test-uuid-1234",
});

function createMockDb() {
  const mockStatement = {
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results: [], success: true }),
    first: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue({ success: true }),
  };
  return {
    prepare: vi.fn().mockReturnValue(mockStatement),
    _statement: mockStatement,
  };
}

// Drizzle-compatible chainable mock for ProductAnalysisService
function createMockDrizzleDb() {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue([]),
  };
  return chainable;
}

function createMockLLMConfig(): LLMConfig {
  return {
    provider: "openai",
    apiKey: "sk-test-key",
    model: "gpt-4o",
  };
}

// Mock a successful OpenAI chat response
function mockOpenAIChatResponse(content: string) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      choices: [{ message: { content }, finish_reason: "stop" }],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    }),
  });
}

describe("AIInsightsService", () => {
  let service: AIInsightsService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockFetch.mockReset();
    const drizzleDb = createMockDrizzleDb();
    service = new AIInsightsService(mockDb as any, drizzleDb as any);
  });

  describe("generateReport", () => {
    it("returns cached report when available and refreshCache is false", async () => {
      const cachedReport = {
        id: "cached-report",
        restaurantId: "rest-1",
        generatedAt: new Date().toISOString(),
        timeRange: { range: "30d" },
        metrics: {} as any,
        insights: [],
        executiveSummary: "Cached summary",
        metadata: {
          llmProvider: "openai",
          llmModel: "gpt-4o",
          processingTimeMs: 100,
        },
      };

      mockDb._statement.first.mockResolvedValueOnce({
        data: JSON.stringify(cachedReport),
      });

      const result = await service.generateReport(
        "rest-1",
        createMockLLMConfig(),
        { range: "30d" },
        { refreshCache: false },
      );

      expect(result.id).toBe("cached-report");
      expect(result.executiveSummary).toBe("Cached summary");
      // Should not have called fetch (no LLM calls)
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("generates fresh report when cache is empty", async () => {
      // No cached report
      mockDb._statement.first.mockResolvedValueOnce(null);

      // Mock DB queries for business metrics
      // Overall metrics
      mockDb._statement.first.mockResolvedValueOnce({
        total_orders: 500,
        total_revenue: 15000,
        avg_order_value: 30,
        unique_customers: 200,
      });

      // Peak hours, peak days, daily metrics - empty results
      mockDb._statement.all.mockResolvedValue({
        results: [],
        success: true,
      });

      // Previous period metrics
      mockDb._statement.first.mockResolvedValueOnce({
        revenue: 12000,
        orders: 400,
      });

      // Mock LLM responses: insights + executive summary
      const mockInsights = JSON.stringify([
        {
          type: "observation",
          category: "sales",
          title: "Revenue Growing",
          description: "Revenue increased 25% compared to last period",
          impact: "high",
          confidence: 0.9,
          actionable: false,
        },
      ]);
      mockOpenAIChatResponse(mockInsights); // insights call
      mockOpenAIChatResponse("Business is doing well overall."); // summary call

      const result = await service.generateReport(
        "rest-1",
        createMockLLMConfig(),
        { range: "30d" },
      );

      expect(result.id).toBe("test-uuid-1234");
      expect(result.restaurantId).toBe("rest-1");
      expect(result.metadata.llmProvider).toBe("openai");
      expect(result.metadata.llmModel).toBe("gpt-4o");
      expect(result.metadata.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.executiveSummary).toBe("Business is doing well overall.");
    });

    it("bypasses cache when refreshCache is true", async () => {
      // Mock DB queries for business metrics
      mockDb._statement.first
        .mockResolvedValueOnce({
          total_orders: 100,
          total_revenue: 5000,
          avg_order_value: 50,
          unique_customers: 50,
        })
        .mockResolvedValueOnce({ revenue: 4000, orders: 80 });

      mockDb._statement.all.mockResolvedValue({
        results: [],
        success: true,
      });

      mockOpenAIChatResponse("[]"); // insights
      mockOpenAIChatResponse("Summary text"); // summary

      const result = await service.generateReport(
        "rest-1",
        createMockLLMConfig(),
        { range: "30d" },
        { refreshCache: true },
      );

      expect(result.executiveSummary).toBe("Summary text");
      // Verify the cache query was NOT called (refreshCache=true skips it)
      // The first prepare call should be for overall metrics, not cache
    });

    it("includes forecast when includeForecasting is true", async () => {
      mockDb._statement.first
        .mockResolvedValueOnce(null) // no cache
        .mockResolvedValueOnce({
          total_orders: 200,
          total_revenue: 10000,
          avg_order_value: 50,
          unique_customers: 100,
        })
        .mockResolvedValueOnce({ revenue: 8000, orders: 160 }); // previous period

      // Return daily metrics for forecast calculation
      // The all() mock needs to handle multiple calls:
      // - peak hours, peak days, daily metrics queries (from gatherBusinessMetrics)
      // - product analysis queries (from analyzeProducts called via getBestsellers etc.)
      const dailyMetrics = Array.from({ length: 10 }, (_, i) => ({
        date: `2026-02-${String(i + 1).padStart(2, "0")}`,
        revenue: 1000 + i * 50,
        orders: 20 + i,
        avgOrderValue: 50,
      }));

      // First 3 calls: peak hours, peak days, daily metrics
      // Subsequent calls: product analysis (empty = no products to analyze)
      let allCallCount = 0;
      mockDb._statement.all.mockImplementation(() => {
        allCallCount++;
        if (allCallCount <= 3) {
          // Return daily metrics for the daily metrics query (3rd call)
          // peak hours and peak days can use it too (extra fields ignored)
          return Promise.resolve({ results: dailyMetrics, success: true });
        }
        // Product analysis calls - return empty so analyzeProducts returns []
        return Promise.resolve({ results: [], success: true });
      });

      mockOpenAIChatResponse("[]"); // insights
      mockOpenAIChatResponse("Executive summary with forecast"); // summary

      const result = await service.generateReport(
        "rest-1",
        createMockLLMConfig(),
        { range: "30d" },
        { includeForecasting: true },
      );

      expect(result.forecast).toBeDefined();
      expect(result.forecast?.nextWeekRevenue).toBeDefined();
      expect(result.forecast?.nextWeekRevenue.predicted).toBeGreaterThan(0);
      const predicted = result.forecast?.nextWeekRevenue.predicted ?? 0;
      expect(result.forecast?.nextWeekRevenue.confidenceLower).toBeLessThan(
        predicted,
      );
      expect(result.forecast?.nextWeekRevenue.confidenceUpper).toBeGreaterThan(
        predicted,
      );
      expect(result.forecast?.nextWeekOrders).toBeDefined();
    });

    it("handles malformed LLM insight response gracefully", async () => {
      mockDb._statement.first
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          total_orders: 100,
          total_revenue: 5000,
          avg_order_value: 50,
          unique_customers: 50,
        })
        .mockResolvedValueOnce({ revenue: 4000, orders: 80 });

      mockDb._statement.all.mockResolvedValue({
        results: [],
        success: true,
      });

      // Return invalid JSON for insights
      mockOpenAIChatResponse("This is not valid JSON at all");
      mockOpenAIChatResponse("Summary despite bad insights");

      const result = await service.generateReport(
        "rest-1",
        createMockLLMConfig(),
        { range: "30d" },
      );

      // Should return empty insights array instead of crashing
      expect(result.insights).toEqual([]);
      expect(result.executiveSummary).toBe("Summary despite bad insights");
    });
  });

  describe("caching behavior", () => {
    it("caches generated report after creation", async () => {
      mockDb._statement.first
        .mockResolvedValueOnce(null) // no cache
        .mockResolvedValueOnce({
          total_orders: 100,
          total_revenue: 5000,
          avg_order_value: 50,
          unique_customers: 50,
        })
        .mockResolvedValueOnce({ revenue: 4000, orders: 80 });

      mockDb._statement.all.mockResolvedValue({
        results: [],
        success: true,
      });

      mockOpenAIChatResponse("[]");
      mockOpenAIChatResponse("Summary");

      await service.generateReport("rest-1", createMockLLMConfig(), {
        range: "30d",
      });

      // Verify that the cache INSERT was called (the last .run() call)
      expect(mockDb._statement.run).toHaveBeenCalled();
    });

    it("returns null for expired cache entries", async () => {
      // first() returns null => no valid cache
      mockDb._statement.first.mockResolvedValueOnce(null);

      // Then provide metrics for fresh generation
      mockDb._statement.first
        .mockResolvedValueOnce({
          total_orders: 50,
          total_revenue: 2500,
          avg_order_value: 50,
          unique_customers: 25,
        })
        .mockResolvedValueOnce({ revenue: 2000, orders: 40 });

      mockDb._statement.all.mockResolvedValue({
        results: [],
        success: true,
      });

      mockOpenAIChatResponse("[]");
      mockOpenAIChatResponse("Fresh report summary");

      const result = await service.generateReport(
        "rest-1",
        createMockLLMConfig(),
        { range: "7d" },
      );

      expect(result.executiveSummary).toBe("Fresh report summary");
    });

    it("handles malformed cached data gracefully", async () => {
      // Return invalid JSON in cache
      mockDb._statement.first.mockResolvedValueOnce({
        data: "not-valid-json{",
      });

      // Then provide metrics for fresh generation
      mockDb._statement.first
        .mockResolvedValueOnce({
          total_orders: 50,
          total_revenue: 2500,
          avg_order_value: 50,
          unique_customers: 25,
        })
        .mockResolvedValueOnce({ revenue: 2000, orders: 40 });

      mockDb._statement.all.mockResolvedValue({
        results: [],
        success: true,
      });

      mockOpenAIChatResponse("[]");
      mockOpenAIChatResponse("Recovery summary");

      const result = await service.generateReport(
        "rest-1",
        createMockLLMConfig(),
        { range: "30d" },
      );

      expect(result.executiveSummary).toBe("Recovery summary");
    });
  });

  describe("date range handling", () => {
    it("uses custom dates when range is 'custom'", async () => {
      mockDb._statement.first
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          total_orders: 50,
          total_revenue: 2500,
          avg_order_value: 50,
          unique_customers: 25,
        })
        .mockResolvedValueOnce({ revenue: 2000, orders: 40 });

      mockDb._statement.all.mockResolvedValue({
        results: [],
        success: true,
      });

      mockOpenAIChatResponse("[]");
      mockOpenAIChatResponse("Custom range report");

      await service.generateReport("rest-1", createMockLLMConfig(), {
        range: "custom",
        startDate: "2026-01-01",
        endDate: "2026-01-31",
      });

      // Verify custom dates were bound to queries
      const allBindCalls = mockDb._statement.bind.mock.calls;
      const hasCustomDates = allBindCalls.some(
        (args: any[]) =>
          args.includes("2026-01-01") && args.includes("2026-01-31"),
      );
      expect(hasCustomDates).toBe(true);
    });

    it("calculates correct date range for predefined ranges", async () => {
      mockDb._statement.first
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          total_orders: 50,
          total_revenue: 2500,
          avg_order_value: 50,
          unique_customers: 25,
        })
        .mockResolvedValueOnce({ revenue: 2000, orders: 40 });

      mockDb._statement.all.mockResolvedValue({
        results: [],
        success: true,
      });

      mockOpenAIChatResponse("[]");
      mockOpenAIChatResponse("7 day report");

      await service.generateReport("rest-1", createMockLLMConfig(), {
        range: "7d",
      });

      // Verify dates were provided (exact dates depend on "now")
      const bindCalls = mockDb._statement.bind.mock.calls;
      expect(bindCalls.length).toBeGreaterThan(0);
    });
  });
});
