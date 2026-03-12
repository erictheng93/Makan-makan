/**
 * Tests for AI Analytics type definitions and type validation
 * Verifies runtime behavior of types used in the system
 */
import { describe, it, expect } from "vitest";
import type {
  LLMProvider,
  LLMConfig,
  LLMRequest,
  LLMResponse,
  TimeRange,
  TimeRangeParams,
  ProductCategory,
  ProductAnalysis,
  BusinessMetrics,
  AIInsight,
  AIAnalyticsReport,
  Result,
  GenerateAnalyticsRequest,
  ConfigureAIRequest,
  TestAIProviderRequest,
} from "../types";

describe("Type validation helpers", () => {
  describe("LLMProvider values", () => {
    it("accepts valid provider strings", () => {
      const providers: LLMProvider[] = [
        "anthropic",
        "openai",
        "google",
        "deepseek",
        "custom",
      ];
      expect(providers).toHaveLength(5);
      providers.forEach((p) => expect(typeof p).toBe("string"));
    });
  });

  describe("LLMConfig structure", () => {
    it("creates valid config with required fields", () => {
      const config: LLMConfig = {
        provider: "openai",
        apiKey: "sk-test-key",
      };
      expect(config.provider).toBe("openai");
      expect(config.apiKey).toBe("sk-test-key");
      expect(config.model).toBeUndefined();
      expect(config.baseUrl).toBeUndefined();
    });

    it("creates valid config with all optional fields", () => {
      const config: LLMConfig = {
        provider: "custom",
        apiKey: "key",
        model: "my-model",
        baseUrl: "https://api.example.com",
        maxTokens: 2048,
        temperature: 0.5,
      };
      expect(config.maxTokens).toBe(2048);
      expect(config.temperature).toBe(0.5);
    });
  });

  describe("LLMRequest structure", () => {
    it("creates request with only required prompt", () => {
      const request: LLMRequest = {
        prompt: "Analyze this data",
      };
      expect(request.prompt).toBe("Analyze this data");
      expect(request.systemPrompt).toBeUndefined();
    });

    it("creates request with all options", () => {
      const request: LLMRequest = {
        prompt: "Analyze this data",
        systemPrompt: "You are an analyst",
        maxTokens: 1024,
        temperature: 0.3,
        responseFormat: "json",
      };
      expect(request.responseFormat).toBe("json");
    });
  });

  describe("LLMResponse structure", () => {
    it("creates valid response with content", () => {
      const response: LLMResponse = {
        content: "Analysis result",
      };
      expect(response.content).toBe("Analysis result");
      expect(response.usage).toBeUndefined();
    });

    it("creates response with usage info", () => {
      const response: LLMResponse = {
        content: "Result",
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
        finishReason: "stop",
        metadata: { model: "gpt-4o", latencyMs: 500 },
      };
      expect(response.usage?.totalTokens).toBe(150);
      expect(response.metadata?.model).toBe("gpt-4o");
    });
  });

  describe("TimeRange values", () => {
    it("covers all supported time ranges", () => {
      const ranges: TimeRange[] = [
        "7d",
        "14d",
        "30d",
        "90d",
        "180d",
        "1y",
        "custom",
      ];
      expect(ranges).toHaveLength(7);
    });
  });

  describe("TimeRangeParams", () => {
    it("creates preset range params", () => {
      const params: TimeRangeParams = { range: "30d" };
      expect(params.range).toBe("30d");
      expect(params.startDate).toBeUndefined();
    });

    it("creates custom range params with dates", () => {
      const params: TimeRangeParams = {
        range: "custom",
        startDate: "2026-01-01",
        endDate: "2026-01-31",
      };
      expect(params.startDate).toBe("2026-01-01");
      expect(params.endDate).toBe("2026-01-31");
    });
  });

  describe("ProductCategory values", () => {
    it("covers all product categories", () => {
      const categories: ProductCategory[] = [
        "traffic-driver",
        "bestseller",
        "profit-leader",
        "underperformer",
      ];
      expect(categories).toHaveLength(4);
    });
  });

  describe("AIInsight structure", () => {
    it("creates valid insight with all fields", () => {
      const insight: AIInsight = {
        id: "insight-1",
        type: "recommendation",
        category: "sales",
        title: "Boost lunch specials",
        description: "Lunch sales are down 15% this week",
        impact: "high",
        confidence: 0.85,
        actionable: true,
        suggestedActions: ["Run a lunch promotion", "Add new lunch combo deal"],
        supportingData: { lunchRevenue: 5000, dinnerRevenue: 12000 },
      };
      expect(insight.type).toBe("recommendation");
      expect(insight.confidence).toBeGreaterThan(0);
      expect(insight.confidence).toBeLessThanOrEqual(1);
      expect(insight.suggestedActions).toHaveLength(2);
    });

    it("validates insight type options", () => {
      const types: AIInsight["type"][] = [
        "observation",
        "recommendation",
        "warning",
        "opportunity",
      ];
      expect(types).toHaveLength(4);
    });

    it("validates insight category options", () => {
      const categories: AIInsight["category"][] = [
        "sales",
        "profit",
        "customer",
        "operations",
        "product",
      ];
      expect(categories).toHaveLength(5);
    });

    it("validates impact levels", () => {
      const levels: AIInsight["impact"][] = ["high", "medium", "low"];
      expect(levels).toHaveLength(3);
    });
  });

  describe("Result type", () => {
    it("creates success result", () => {
      const result: Result<string> = {
        success: true,
        data: "some data",
      };
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("some data");
      }
    });

    it("creates error result", () => {
      const result: Result<string> = {
        success: false,
        error: new Error("Something went wrong"),
      };
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe("Something went wrong");
      }
    });

    it("creates error result with custom error type", () => {
      const result: Result<number, string> = {
        success: false,
        error: "Validation failed",
      };
      if (!result.success) {
        expect(result.error).toBe("Validation failed");
      }
    });
  });

  describe("API request/response types", () => {
    it("creates valid GenerateAnalyticsRequest", () => {
      const request: GenerateAnalyticsRequest = {
        restaurantId: "rest-123",
        timeRange: { range: "30d" },
        includeForecasting: true,
        refreshCache: false,
      };
      expect(request.restaurantId).toBe("rest-123");
    });

    it("creates valid ConfigureAIRequest", () => {
      const request: ConfigureAIRequest = {
        restaurantId: "rest-123",
        provider: "openai",
        apiKey: "sk-test",
        model: "gpt-4o",
      };
      expect(request.provider).toBe("openai");
    });

    it("creates valid TestAIProviderRequest", () => {
      const request: TestAIProviderRequest = {
        provider: "anthropic",
        apiKey: "sk-ant-test",
        model: "claude-3-5-sonnet-20241022",
      };
      expect(request.provider).toBe("anthropic");
    });
  });
});
