// apps/api/src/features/forecast/__tests__/AIForecastEnhancer.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AIForecastEnhancer } from "../services/AIForecastEnhancer";
import type { IngredientForecastItem } from "@makanmakan/shared-types";

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

function buildSampleForecasts(): IngredientForecastItem[] {
  return [
    {
      ingredientId: 100,
      ingredientName: "Chicken",
      unit: "kg",
      predictedQuantity: 19,
      confidence: 0.85,
      contributingItems: [
        { menuItemId: 1, menuItemName: "Chicken Rice", quantity: 10 },
        { menuItemId: 2, menuItemName: "Chicken Soup", quantity: 9 },
      ],
      currentStock: 5,
      gap: 14,
    },
    {
      ingredientId: 101,
      ingredientName: "Rice",
      unit: "kg",
      predictedQuantity: 7.5,
      confidence: 0.9,
      contributingItems: [
        { menuItemId: 1, menuItemName: "Chicken Rice", quantity: 7.5 },
      ],
      currentStock: 20,
    },
  ];
}

describe("AIForecastEnhancer", () => {
  let enhancer: AIForecastEnhancer;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    mockDb = createMockDb();
    enhancer = new AIForecastEnhancer(mockDb as any, "test-encryption-key");
  });

  describe("buildPrompt", () => {
    it("builds correct prompt with forecast data and holiday context", () => {
      const forecasts = buildSampleForecasts();
      const dateRange = { startDate: "2026-03-15", endDate: "2026-03-15" };
      const holidayContext = ["週末", "農曆新年期間（可能）"];

      const prompt = enhancer.buildPrompt(forecasts, dateRange, holidayContext);

      // Contains date range
      expect(prompt).toContain("2026-03-15");
      // Contains ingredient names with predicted quantities
      expect(prompt).toContain("Chicken");
      expect(prompt).toContain("19 kg");
      expect(prompt).toContain("Rice");
      expect(prompt).toContain("7.5 kg");
      // Contains confidence as percentage
      expect(prompt).toContain("85%");
      expect(prompt).toContain("90%");
      // Contains stock information
      expect(prompt).toContain("庫存 5 kg");
      // Contains holiday context
      expect(prompt).toContain("週末");
      expect(prompt).toContain("農曆新年期間（可能）");
    });

    it("builds prompt without holiday context when none provided", () => {
      const forecasts = buildSampleForecasts();
      const dateRange = { startDate: "2026-06-10", endDate: "2026-06-10" };

      const prompt = enhancer.buildPrompt(forecasts, dateRange, []);

      expect(prompt).toContain("2026-06-10");
      expect(prompt).toContain("Chicken");
      // No holiday info line (the dynamic "日期脈絡：..." line should not appear)
      expect(prompt).not.toContain("日期脈絡：");
    });
  });

  describe("getHolidayContext", () => {
    it("returns weekend context for Saturday", () => {
      // 2026-03-14 is a Saturday
      const context = enhancer.getHolidayContext("2026-03-14");
      expect(context).toContain("週末");
    });

    it("returns weekend context for Sunday", () => {
      // 2026-03-15 is a Sunday
      const context = enhancer.getHolidayContext("2026-03-15");
      expect(context).toContain("週末");
    });

    it("does not include weekend for weekdays", () => {
      // 2026-03-16 is a Monday
      const context = enhancer.getHolidayContext("2026-03-16");
      expect(context).not.toContain("週末");
    });

    it("returns correct context for fixed holidays", () => {
      // New Year
      const newYear = enhancer.getHolidayContext("2026-01-01");
      expect(newYear).toContain("元旦");
      expect(newYear).toContain("冬季（火鍋/熱湯需求增加）");

      // National Day (10-10)
      const nationalDay = enhancer.getHolidayContext("2026-10-10");
      expect(nationalDay).toContain("國慶日");

      // Peace Memorial Day (2-28)
      const peaceDay = enhancer.getHolidayContext("2026-02-28");
      expect(peaceDay).toContain("和平紀念日");
    });

    it("returns seasonal context", () => {
      // Summer: June-August
      const summer = enhancer.getHolidayContext("2026-07-15");
      expect(summer).toContain("夏季（冷飲/冰品需求增加）");

      // Winter: December-February
      const winter = enhancer.getHolidayContext("2026-12-15");
      expect(winter).toContain("冬季（火鍋/熱湯需求增加）");
    });

    it("returns lunar holiday context by month", () => {
      // January/February: possible Lunar New Year
      const jan = enhancer.getHolidayContext("2026-01-20");
      expect(jan).toContain("農曆新年期間（可能）");

      // September: possible Mid-Autumn
      const sep = enhancer.getHolidayContext("2026-09-15");
      expect(sep).toContain("中秋節期間（可能）");

      // June: possible Dragon Boat
      const jun = enhancer.getHolidayContext("2026-06-10");
      expect(jun).toContain("端午節期間（可能）");
    });
  });

  describe("enhancePredictions", () => {
    it("returns original forecasts when no AI config exists (graceful fallback)", async () => {
      // Default mock DB returns null for .first() — no AI configuration
      const forecasts = buildSampleForecasts();

      const result = await enhancer.enhancePredictions("rest-1", forecasts, {
        startDate: "2026-03-15",
        endDate: "2026-03-15",
      });

      expect(result.enhancedForecasts).toEqual(forecasts);
      expect(result.recommendations).toEqual([]);
      expect(result.adjustmentReasons).toEqual({});

      // Verify DB was queried for AI config
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it("clamps adjustment factors to [0.5, 2.0] range", () => {
      // Access private method via casting to test clamping logic
      const forecasts: IngredientForecastItem[] = [
        {
          ingredientId: 100,
          ingredientName: "Chicken",
          unit: "kg",
          predictedQuantity: 10,
          confidence: 0.85,
          contributingItems: [],
          currentStock: 5,
          gap: 5,
        },
        {
          ingredientId: 101,
          ingredientName: "Rice",
          unit: "kg",
          predictedQuantity: 20,
          confidence: 0.9,
          contributingItems: [],
          currentStock: 10,
          gap: 10,
        },
      ];

      const adjustments = [
        { ingredientId: 100, adjustmentFactor: 0.1, reason: "Way too low" }, // Should clamp to 0.5
        { ingredientId: 101, adjustmentFactor: 5.0, reason: "Way too high" }, // Should clamp to 2.0
      ];

      // Access private method for testing
      const applyAdjustments = (enhancer as any).applyAdjustments.bind(
        enhancer,
      );
      const adjusted = applyAdjustments(
        forecasts,
        adjustments,
      ) as IngredientForecastItem[];

      // Chicken: 10 * 0.5 (clamped from 0.1) = 5
      expect(adjusted[0].predictedQuantity).toBe(5);
      // Rice: 20 * 2.0 (clamped from 5.0) = 40
      expect(adjusted[1].predictedQuantity).toBe(40);
    });

    it("returns original forecasts gracefully when provider throws an error", async () => {
      // Mock DB to return a valid AI config (base64-encoded API key)
      mockDb.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            provider: "openai",
            api_key_encrypted: btoa("sk-test-key"),
            model: "gpt-4",
            custom_base_url: null,
          }),
        }),
      });

      // Mock createProvider to return a provider that throws
      vi.mock("@makanmakan/ai-analytics", () => ({
        createProvider: vi.fn(() => ({
          chat: vi.fn().mockRejectedValue(new Error("Provider timeout")),
        })),
      }));

      const forecasts = buildSampleForecasts();
      const result = await enhancer.enhancePredictions("rest-1", forecasts, {
        startDate: "2026-03-15",
        endDate: "2026-03-15",
      });

      // Should gracefully fall back to original forecasts
      expect(result.enhancedForecasts).toEqual(forecasts);
      expect(result.recommendations).toEqual([]);
      expect(result.adjustmentReasons).toEqual({});

      // Verify DB was queried for AI config
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    it("applies adjustment factor correctly when factor is within valid range", () => {
      const forecasts: IngredientForecastItem[] = [
        {
          ingredientId: 100,
          ingredientName: "Chicken",
          unit: "kg",
          predictedQuantity: 10,
          confidence: 0.85,
          contributingItems: [],
          currentStock: 5,
          gap: 5,
        },
      ];

      const adjustments = [
        { ingredientId: 100, adjustmentFactor: 1.2, reason: "Weekend boost" },
      ];

      const applyAdjustments = (enhancer as any).applyAdjustments.bind(
        enhancer,
      );
      const adjusted = applyAdjustments(
        forecasts,
        adjustments,
      ) as IngredientForecastItem[];

      // 10 * 1.2 = 12
      expect(adjusted[0].predictedQuantity).toBe(12);
      // gap = adjustedQuantity - currentStock = 12 - 5 = 7
      expect(adjusted[0].gap).toBe(7);
    });

    it("clears gap when adjustedQuantity does not exceed currentStock", () => {
      const forecasts: IngredientForecastItem[] = [
        {
          ingredientId: 100,
          ingredientName: "Chicken",
          unit: "kg",
          predictedQuantity: 10,
          confidence: 0.85,
          contributingItems: [],
          currentStock: 20,
          gap: 5,
        },
      ];

      const adjustments = [
        { ingredientId: 100, adjustmentFactor: 0.5, reason: "Low demand" },
      ];

      const applyAdjustments = (enhancer as any).applyAdjustments.bind(
        enhancer,
      );
      const adjusted = applyAdjustments(
        forecasts,
        adjustments,
      ) as IngredientForecastItem[];

      // 10 * 0.5 = 5, currentStock = 20, gap = 5 - 20 = -15 → undefined (no gap)
      expect(adjusted[0].predictedQuantity).toBe(5);
      expect(adjusted[0].gap).toBeUndefined();
    });
  });

  describe("parseResponse", () => {
    it("returns empty adjustments and recommendations for plain text without JSON", () => {
      const parseResponse = (enhancer as any).parseResponse.bind(enhancer);
      const result = parseResponse("Sorry, I cannot process this request.");
      expect(result.adjustments).toEqual([]);
      expect(result.recommendations).toEqual([]);
    });

    it("returns empty adjustments for malformed JSON (invalid JSON block)", () => {
      const parseResponse = (enhancer as any).parseResponse.bind(enhancer);
      const result = parseResponse("{invalid json here}");
      expect(result.adjustments).toEqual([]);
      expect(result.recommendations).toEqual([]);
    });

    it("handles JSON wrapped in markdown code block", () => {
      const parseResponse = (enhancer as any).parseResponse.bind(enhancer);
      const content = `Here is the analysis:
\`\`\`json
{"adjustments": [{"ingredientId": 1, "adjustmentFactor": 1.1, "reason": "Weekend"}], "recommendations": ["Buy more"]}
\`\`\``;
      const result = parseResponse(content);
      expect(result.adjustments).toHaveLength(1);
      expect(result.adjustments[0].ingredientId).toBe(1);
      expect(result.recommendations).toHaveLength(1);
    });

    it("caps recommendations at 5 items", () => {
      const parseResponse = (enhancer as any).parseResponse.bind(enhancer);
      const content = JSON.stringify({
        adjustments: [],
        recommendations: ["A", "B", "C", "D", "E", "F", "G"],
      });
      const result = parseResponse(content);
      expect(result.recommendations).toHaveLength(5);
    });

    it("handles response where adjustments is not an array", () => {
      const parseResponse = (enhancer as any).parseResponse.bind(enhancer);
      const content = JSON.stringify({
        adjustments: "not-an-array",
        recommendations: [],
      });
      const result = parseResponse(content);
      expect(result.adjustments).toEqual([]);
    });
  });
});
