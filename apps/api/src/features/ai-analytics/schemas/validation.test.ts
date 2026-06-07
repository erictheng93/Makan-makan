import { describe, expect, it } from "vitest";
import {
  configureAISchema,
  generateAnalyticsSchema,
  productQuerySchema,
  testProviderSchema,
  timeRangeSchema,
} from "./validation";

describe("AI analytics validation schemas", () => {
  it("accepts custom time ranges and generation options", () => {
    const timeRange = timeRangeSchema.parse({
      range: "custom",
      startDate: "2026-06-01",
      endDate: "2026-06-07",
    });

    expect(
      generateAnalyticsSchema.parse({
        restaurantId: "restaurant-1",
        timeRange,
        includeForecasting: true,
      }),
    ).toMatchObject({
      restaurantId: "restaurant-1",
      includeForecasting: true,
    });
  });

  it("validates provider configuration and custom URLs", () => {
    expect(
      configureAISchema.parse({
        restaurantId: "restaurant-1",
        provider: "openai",
        apiKey: "sk-1234567890",
        customBaseUrl: "https://ai.example.test/v1",
      }),
    ).toMatchObject({
      provider: "openai",
      customBaseUrl: "https://ai.example.test/v1",
    });

    expect(() =>
      testProviderSchema.parse({
        provider: "unsupported",
        apiKey: "sk-1234567890",
      }),
    ).toThrow();
  });

  it("applies product query defaults and numeric transforms", () => {
    expect(productQuerySchema.parse({})).toEqual({
      timeRange: "30d",
      limit: 10,
    });
    expect(productQuerySchema.parse({ timeRange: "7d", limit: "5" })).toEqual({
      timeRange: "7d",
      limit: 5,
    });
  });

  it("rejects short API keys and invalid base URLs", () => {
    expect(() =>
      configureAISchema.parse({
        restaurantId: "restaurant-1",
        provider: "custom",
        apiKey: "short",
        customBaseUrl: "not-a-url",
      }),
    ).toThrow();
  });
});
