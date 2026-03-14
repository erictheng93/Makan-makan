// apps/api/src/features/ai-analytics/__tests__/validation.test.ts
import { describe, it, expect } from "vitest";
import {
  timeRangeSchema,
  aiProviderSchema,
  configureAISchema,
  testProviderSchema,
  generateAnalyticsSchema,
  productQuerySchema,
  usageQuerySchema,
} from "../schemas/validation";

describe("AI Analytics Validation Schemas", () => {
  // ─── timeRangeSchema ────────────────────────────────────────────

  describe("timeRangeSchema", () => {
    it("should accept all valid range enum values", () => {
      const validRanges = ["7d", "14d", "30d", "90d", "180d", "1y", "custom"];
      for (const range of validRanges) {
        const result = timeRangeSchema.safeParse({ range });
        expect(result.success).toBe(true);
      }
    });

    it("should reject invalid range value", () => {
      const result = timeRangeSchema.safeParse({ range: "60d" });
      expect(result.success).toBe(false);
    });

    it("should accept optional startDate and endDate with custom range", () => {
      const result = timeRangeSchema.safeParse({
        range: "custom",
        startDate: "2026-01-01",
        endDate: "2026-03-14",
      });
      expect(result.success).toBe(true);
    });

    it("should accept missing optional startDate and endDate", () => {
      const result = timeRangeSchema.safeParse({ range: "30d" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startDate).toBeUndefined();
        expect(result.data.endDate).toBeUndefined();
      }
    });

    it("should reject missing range field", () => {
      const result = timeRangeSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  // ─── aiProviderSchema ───────────────────────────────────────────

  describe("aiProviderSchema", () => {
    it("should accept all valid provider enum values", () => {
      const validProviders = [
        "anthropic",
        "openai",
        "google",
        "deepseek",
        "custom",
      ];
      for (const provider of validProviders) {
        const result = aiProviderSchema.safeParse(provider);
        expect(result.success).toBe(true);
      }
    });

    it("should reject invalid provider", () => {
      const result = aiProviderSchema.safeParse("gpt4");
      expect(result.success).toBe(false);
    });

    it("should reject empty string as provider", () => {
      const result = aiProviderSchema.safeParse("");
      expect(result.success).toBe(false);
    });
  });

  // ─── configureAISchema ──────────────────────────────────────────

  describe("configureAISchema", () => {
    it("should accept valid input with required fields", () => {
      const result = configureAISchema.safeParse({
        restaurantId: "restaurant-123",
        provider: "openai",
        apiKey: "sk-validApiKeyHere",
      });
      expect(result.success).toBe(true);
    });

    it("should reject apiKey shorter than 10 characters", () => {
      const result = configureAISchema.safeParse({
        restaurantId: "restaurant-123",
        provider: "openai",
        apiKey: "short",
      });
      expect(result.success).toBe(false);
    });

    it("should accept apiKey exactly 10 characters", () => {
      const result = configureAISchema.safeParse({
        restaurantId: "restaurant-123",
        provider: "openai",
        apiKey: "1234567890",
      });
      expect(result.success).toBe(true);
    });

    it("should accept optional model field", () => {
      const result = configureAISchema.safeParse({
        restaurantId: "restaurant-123",
        provider: "anthropic",
        apiKey: "sk-ant-validkey123",
        model: "claude-3-opus-20240229",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.model).toBe("claude-3-opus-20240229");
      }
    });

    it("should accept optional valid customBaseUrl", () => {
      const result = configureAISchema.safeParse({
        restaurantId: "restaurant-123",
        provider: "custom",
        apiKey: "custom-api-key-here",
        customBaseUrl: "https://my-llm.example.com/api",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid customBaseUrl (not a URL)", () => {
      const result = configureAISchema.safeParse({
        restaurantId: "restaurant-123",
        provider: "custom",
        apiKey: "custom-api-key-here",
        customBaseUrl: "not-a-url",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid provider enum", () => {
      const result = configureAISchema.safeParse({
        restaurantId: "restaurant-123",
        provider: "invalid-provider",
        apiKey: "validapikey123",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing restaurantId", () => {
      const result = configureAISchema.safeParse({
        provider: "openai",
        apiKey: "validapikey123",
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── testProviderSchema ─────────────────────────────────────────

  describe("testProviderSchema", () => {
    it("should accept valid input with required fields", () => {
      const result = testProviderSchema.safeParse({
        provider: "openai",
        apiKey: "sk-validApiKeyHere",
      });
      expect(result.success).toBe(true);
    });

    it("should reject apiKey shorter than 10 characters", () => {
      const result = testProviderSchema.safeParse({
        provider: "openai",
        apiKey: "tooshort",
      });
      expect(result.success).toBe(false);
    });

    it("should accept optional model and baseUrl", () => {
      const result = testProviderSchema.safeParse({
        provider: "anthropic",
        apiKey: "sk-ant-longerkeyhere",
        model: "claude-3-haiku-20240307",
        baseUrl: "https://api.anthropic.com",
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid baseUrl format", () => {
      const result = testProviderSchema.safeParse({
        provider: "custom",
        apiKey: "custom-api-key-here",
        baseUrl: "not-a-valid-url",
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing provider", () => {
      const result = testProviderSchema.safeParse({
        apiKey: "validapikey123",
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── generateAnalyticsSchema ────────────────────────────────────

  describe("generateAnalyticsSchema", () => {
    it("should accept valid input with required fields", () => {
      const result = generateAnalyticsSchema.safeParse({
        restaurantId: "restaurant-123",
        timeRange: { range: "30d" },
      });
      expect(result.success).toBe(true);
    });

    it("should accept optional includeForecasting and refreshCache", () => {
      const result = generateAnalyticsSchema.safeParse({
        restaurantId: "restaurant-123",
        timeRange: { range: "7d" },
        includeForecasting: true,
        refreshCache: false,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeForecasting).toBe(true);
        expect(result.data.refreshCache).toBe(false);
      }
    });

    it("should reject missing restaurantId", () => {
      const result = generateAnalyticsSchema.safeParse({
        timeRange: { range: "30d" },
      });
      expect(result.success).toBe(false);
    });

    it("should reject missing timeRange", () => {
      const result = generateAnalyticsSchema.safeParse({
        restaurantId: "restaurant-123",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid timeRange range value", () => {
      const result = generateAnalyticsSchema.safeParse({
        restaurantId: "restaurant-123",
        timeRange: { range: "invalid" },
      });
      expect(result.success).toBe(false);
    });
  });

  // ─── productQuerySchema ─────────────────────────────────────────

  describe("productQuerySchema", () => {
    it("should apply default timeRange of 30d", () => {
      const result = productQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeRange).toBe("30d");
      }
    });

    it("should apply default limit of 10", () => {
      const result = productQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(10);
      }
    });

    it("should accept custom timeRange and limit as strings", () => {
      const result = productQuerySchema.safeParse({
        timeRange: "7d",
        limit: "20",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeRange).toBe("7d");
        expect(result.data.limit).toBe(20);
      }
    });

    it("should transform limit string to number", () => {
      const result = productQuerySchema.safeParse({ limit: "5" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(typeof result.data.limit).toBe("number");
        expect(result.data.limit).toBe(5);
      }
    });
  });

  // ─── usageQuerySchema ───────────────────────────────────────────

  describe("usageQuerySchema", () => {
    it("should accept empty object (all fields optional)", () => {
      const result = usageQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should accept optional startDate and endDate", () => {
      const result = usageQuerySchema.safeParse({
        startDate: "2026-01-01",
        endDate: "2026-03-14",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startDate).toBe("2026-01-01");
        expect(result.data.endDate).toBe("2026-03-14");
      }
    });

    it("should accept only startDate without endDate", () => {
      const result = usageQuerySchema.safeParse({ startDate: "2026-01-01" });
      expect(result.success).toBe(true);
    });

    it("should accept only endDate without startDate", () => {
      const result = usageQuerySchema.safeParse({ endDate: "2026-03-14" });
      expect(result.success).toBe(true);
    });
  });
});
