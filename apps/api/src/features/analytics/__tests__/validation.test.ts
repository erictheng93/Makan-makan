import { describe, expect, it } from "vitest";
import {
  dashboardQuerySchema,
  financialReportQuerySchema,
  revenueQuerySchema,
} from "../schemas/validation";

describe("analytics query validation", () => {
  it("accepts string restaurantId values", () => {
    const query = dashboardQuerySchema.parse({
      restaurantId: "019469a0-0001-7000-8000-000000000001",
      period: "week",
    });

    expect(query).toMatchObject({
      restaurantId: "019469a0-0001-7000-8000-000000000001",
      period: "week",
    });
  });

  it("normalizes legacy restaurant_id query aliases", () => {
    const query = financialReportQuerySchema.parse({
      restaurant_id: "rest-1",
      period: "monthly",
    });

    expect(query.restaurantId).toBe("rest-1");
  });

  it("keeps analytics defaults while normalizing restaurant scope", () => {
    const query = revenueQuerySchema.parse({
      restaurant_id: "rest-1",
      includeComparison: "true",
    });

    expect(query).toMatchObject({
      restaurantId: "rest-1",
      includeComparison: true,
      groupBy: "day",
      limit: 30,
    });
  });
});
