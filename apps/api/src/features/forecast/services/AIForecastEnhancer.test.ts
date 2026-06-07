import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IngredientForecastItem } from "@makanmakan/shared-types";
import { AIForecastEnhancer } from "./AIForecastEnhancer";
import { createProvider } from "@makanmakan/ai-analytics";

const chat = vi.hoisted(() => vi.fn());

vi.mock("@makanmakan/ai-analytics", () => ({
  createProvider: vi.fn(() => ({ chat })),
}));

function createForecast(
  overrides: Partial<IngredientForecastItem> = {},
): IngredientForecastItem {
  return {
    ingredientId: 1,
    ingredientName: "Rice",
    unit: "kg",
    predictedQuantity: 10,
    confidence: 0.8,
    contributingItems: [],
    currentStock: 6,
    ...overrides,
  };
}

function createDb(config: unknown) {
  const first = vi.fn(async () => config);
  const bind = vi.fn(() => ({ first }));
  const prepare = vi.fn(() => ({ bind }));

  return {
    db: { prepare } as unknown as D1Database,
    prepare,
    bind,
    first,
  };
}

describe("AIForecastEnhancer", () => {
  beforeEach(() => {
    vi.mocked(createProvider).mockClear();
    chat.mockReset();
  });

  it("returns statistical forecasts unchanged when AI is not configured", async () => {
    const { db, prepare } = createDb(null);
    const service = new AIForecastEnhancer(db, "encryption-key");
    const forecasts = [createForecast()];

    await expect(
      service.enhancePredictions("restaurant-1", forecasts, {
        startDate: "2026-06-08",
        endDate: "2026-06-09",
      }),
    ).resolves.toEqual({
      enhancedForecasts: forecasts,
      recommendations: [],
      adjustmentReasons: {},
    });

    expect(prepare).toHaveBeenCalledWith(
      "SELECT provider, api_key_encrypted, model, custom_base_url FROM ai_configurations WHERE restaurant_id = ? AND enabled = 1 LIMIT 1",
    );
    expect(createProvider).not.toHaveBeenCalled();
  });

  it("decrypts legacy API keys and applies clamped LLM forecast adjustments", async () => {
    const { db, bind } = createDb({
      provider: "openai",
      api_key_encrypted: "c2stdGVzdA==",
      model: "gpt-test",
      custom_base_url: "https://llm.test",
    });
    chat.mockResolvedValue({
      content: `Here is the plan:
\`\`\`json
{
  "adjustments": [
    { "ingredientId": 1, "adjustmentFactor": 2.5, "reason": "event demand" },
    { "ingredientId": 2, "adjustmentFactor": 0.25, "reason": "rain slowdown" }
  ],
  "recommendations": ["r1", "r2", "r3", "r4", "r5", "r6"]
}
\`\`\``,
    });
    const service = new AIForecastEnhancer(db, "encryption-key");
    const forecasts = [
      createForecast({
        ingredientId: 1,
        predictedQuantity: 10,
        currentStock: 8,
      }),
      createForecast({
        ingredientId: 2,
        ingredientName: "Chicken",
        predictedQuantity: 10,
        currentStock: 12,
      }),
      createForecast({
        ingredientId: 3,
        ingredientName: "Tea",
        predictedQuantity: 5,
        currentStock: undefined,
      }),
    ];

    const result = await service.enhancePredictions("restaurant-1", forecasts, {
      startDate: "2026-06-13",
      endDate: "2026-06-14",
    });

    expect(bind).toHaveBeenCalledWith("restaurant-1");
    expect(createProvider).toHaveBeenCalledWith({
      provider: "openai",
      apiKey: "sk-test",
      model: "gpt-test",
      baseUrl: "https://llm.test",
    });
    expect(chat).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining("Rice"),
        systemPrompt: expect.any(String),
        maxTokens: 2000,
        temperature: 0.3,
        responseFormat: "json",
      }),
    );
    expect(result).toEqual({
      enhancedForecasts: [
        expect.objectContaining({
          ingredientId: 1,
          predictedQuantity: 20,
          gap: 12,
        }),
        expect.objectContaining({
          ingredientId: 2,
          predictedQuantity: 5,
          gap: undefined,
        }),
        forecasts[2],
      ],
      recommendations: ["r1", "r2", "r3", "r4", "r5"],
      adjustmentReasons: {
        1: "event demand",
        2: "rain slowdown",
      },
    });
  });

  it("treats malformed LLM output as no-op AI enhancement", async () => {
    const { db } = createDb({
      provider: "anthropic",
      api_key_encrypted: "YW50aHJvcGljLWtleQ==",
      model: null,
      custom_base_url: null,
    });
    chat.mockResolvedValue({ content: "no json here" });
    const forecasts = [createForecast({ predictedQuantity: 12 })];

    const result = await new AIForecastEnhancer(
      db,
      "encryption-key",
    ).enhancePredictions("restaurant-1", forecasts, {
      startDate: "2026-06-08",
      endDate: "2026-06-09",
    });

    expect(createProvider).toHaveBeenCalledWith({
      provider: "anthropic",
      apiKey: "anthropic-key",
      model: undefined,
      baseUrl: undefined,
    });
    expect(result).toEqual({
      enhancedForecasts: forecasts,
      recommendations: [],
      adjustmentReasons: {},
    });
  });

  it("gracefully returns original forecasts when provider calls fail", async () => {
    const { db } = createDb({
      provider: "openai",
      api_key_encrypted: "c2stdGVzdA==",
      model: "gpt-test",
      custom_base_url: null,
    });
    chat.mockRejectedValue(new Error("llm unavailable"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const forecasts = [createForecast({ predictedQuantity: 8 })];

    await expect(
      new AIForecastEnhancer(db, "encryption-key").enhancePredictions(
        "restaurant-1",
        forecasts,
        {
          startDate: "2026-06-08",
          endDate: "2026-06-09",
        },
      ),
    ).resolves.toEqual({
      enhancedForecasts: forecasts,
      recommendations: [],
      adjustmentReasons: {},
    });

    expect(consoleError).toHaveBeenCalledWith(
      "[AIForecastEnhancer] AI enhancement failed:",
      expect.any(Error),
    );
    consoleError.mockRestore();
  });

  it("builds prompts from only the top thirty forecasts", () => {
    const service = new AIForecastEnhancer({} as D1Database, "encryption-key");
    const forecasts = Array.from({ length: 31 }, (_, index) =>
      createForecast({
        ingredientId: index + 1,
        ingredientName: `Ingredient ${index + 1}`,
        predictedQuantity: index + 1,
        currentStock: index,
      }),
    );

    const prompt = service.buildPrompt(
      forecasts,
      { startDate: "2026-06-08", endDate: "2026-06-09" },
      ["holiday context"],
    );

    expect(prompt).toContain("2026-06-08");
    expect(prompt).toContain("2026-06-09");
    expect(prompt).toContain("Ingredient 1");
    expect(prompt).toContain("Ingredient 30");
    expect(prompt).not.toContain("Ingredient 31");
    expect(prompt).toContain("ID:30");
  });

  it("adds contextual markers for weekends, fixed holidays, lunar periods, and seasons", () => {
    const service = new AIForecastEnhancer({} as D1Database, "encryption-key");

    expect(service.getHolidayContext("2026-01-01")).toHaveLength(3);
    expect(service.getHolidayContext("2026-06-13")).toHaveLength(3);
    expect(service.getHolidayContext("2026-09-15")).toHaveLength(1);
    expect(service.getHolidayContext("2026-03-10")).toEqual([]);
  });
});
