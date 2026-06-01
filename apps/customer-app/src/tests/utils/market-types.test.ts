import { describe, expect, it } from "vitest";
import {
  isMarketType,
  MARKET_TYPE_OPTIONS,
  marketTypeLabel,
} from "@/utils/marketTypes";

describe("marketTypes", () => {
  it("labels supported venue types consistently", () => {
    expect(MARKET_TYPE_OPTIONS).toEqual([
      { value: "night_market", label: "夜市" },
      { value: "commercial_district", label: "商圈" },
      { value: "food_court", label: "美食街" },
      { value: "event_venue", label: "活動場域" },
    ]);
    expect(marketTypeLabel("night_market")).toBe("夜市");
    expect(marketTypeLabel("commercial_district")).toBe("商圈");
    expect(marketTypeLabel("food_court")).toBe("美食街");
    expect(marketTypeLabel("event_venue")).toBe("活動場域");
  });

  it("falls back for unknown venue types", () => {
    expect(isMarketType("night_market")).toBe(true);
    expect(isMarketType("unknown_market_type")).toBe(false);
    expect(marketTypeLabel("unknown_market_type")).toBe("場域");
  });
});
