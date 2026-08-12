import { describe, expect, it } from "vitest";
import {
  analyticsQuerySchema,
  dateRangeSchema,
  exportQuerySchema,
  financialReportQuerySchema,
  revenueQuerySchema,
} from "./validation";

describe("analytics validation schemas", () => {
  it("normalizes restaurant_id aliases and applies query defaults", () => {
    const parsed = analyticsQuerySchema.parse({
      restaurant_id: " restaurant-1 ",
    });

    expect(parsed).toEqual({
      restaurantId: "restaurant-1",
      groupBy: "day",
      limit: 30,
    });
  });

  it("transforms the revenue comparison flag", () => {
    expect(
      revenueQuerySchema.parse({ includeComparison: "true" }).includeComparison,
    ).toBe(true);
  });

  it("validates export and financial report query enums", () => {
    expect(
      exportQuerySchema.parse({ type: "revenue", format: "csv" }),
    ).toMatchObject({
      type: "revenue",
      format: "csv",
    });

    expect(() =>
      financialReportQuerySchema.parse({
        period: "monthly",
        year: "26",
      }),
    ).toThrow();
  });

  it("rejects reversed date ranges", () => {
    expect(() =>
      dateRangeSchema.parse({
        dateFrom: "2026-06-08T00:00:00.000Z",
        dateTo: "2026-06-07T00:00:00.000Z",
      }),
    ).toThrow("dateFrom must be before or equal to dateTo");
  });
});
