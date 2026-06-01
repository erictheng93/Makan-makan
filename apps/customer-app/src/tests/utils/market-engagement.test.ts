import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isFavoriteMarket,
  listFavoriteMarkets,
  listRecentMarkets,
  recordRecentMarket,
  toggleFavoriteMarket,
} from "@/utils/marketEngagement";
import type { MarketListItem } from "@/services/marketsApi";

function market(overrides: Partial<MarketListItem> = {}): MarketListItem {
  return {
    id: "market-1",
    slug: "fengjia",
    name: "逢甲夜市",
    type: "night_market",
    description: null,
    city: "台中市",
    district: "西屯區",
    address: "文華路",
    latitude: 24.1764,
    longitude: 120.6466,
    bannerUrl: null,
    logoUrl: null,
    tags: ["夜市"],
    vendorCount: 3,
    ...overrides,
  };
}

describe("marketEngagement", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));
  });

  it("toggles favorite markets idempotently", () => {
    expect(toggleFavoriteMarket(market())).toBe(true);
    expect(isFavoriteMarket("market-1")).toBe(true);
    expect(listFavoriteMarkets()[0]).toMatchObject({
      id: "market-1",
      slug: "fengjia",
      name: "逢甲夜市",
      updatedAt: Date.now(),
    });

    expect(toggleFavoriteMarket(market())).toBe(false);
    expect(isFavoriteMarket("market-1")).toBe(false);
    expect(listFavoriteMarkets()).toEqual([]);
  });

  it("records recent markets newest first and deduplicates visits", () => {
    recordRecentMarket(market({ id: "market-1", slug: "fengjia" }));
    recordRecentMarket(
      market({ id: "market-2", slug: "ximen", name: "西門町" }),
    );
    recordRecentMarket(market({ id: "market-1", slug: "fengjia" }));

    expect(listRecentMarkets().map((item) => item.slug)).toEqual([
      "fengjia",
      "ximen",
    ]);
  });
});
