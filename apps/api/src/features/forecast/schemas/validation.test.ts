import { describe, expect, it } from "vitest";
import {
  MAX_FORECAST_RANGE_DAYS,
  accuracyQuerySchema,
  generateForecastSchema,
  getForecastQuerySchema,
  ingredientForecastQuerySchema,
} from "./validation";

describe("forecast date range validation", () => {
  const rangeSchemas = [
    generateForecastSchema,
    getForecastQuerySchema,
    accuracyQuerySchema,
    ingredientForecastQuerySchema,
  ];

  it("accepts the maximum inclusive forecast range", () => {
    expect(MAX_FORECAST_RANGE_DAYS).toBe(31);

    for (const schema of rangeSchemas) {
      expect(
        schema.safeParse({
          startDate: "2026-01-01",
          endDate: "2026-01-31",
        }).success,
      ).toBe(true);
    }
  });

  it("rejects forecast ranges longer than the maximum", () => {
    for (const schema of rangeSchemas) {
      const result = schema.safeParse({
        startDate: "2026-01-01",
        endDate: "2026-02-01",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              message: "Date range cannot exceed 31 days",
            }),
          ]),
        );
      }
    }
  });
});
