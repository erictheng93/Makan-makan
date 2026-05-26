import { describe, expect, it } from "vitest";
import {
  filterMarketsByReadiness,
  marketReadinessStats,
} from "./marketPublicReadinessWorkbench";
import type { MarketListItem } from "@/services/marketsService";

function market(overrides: Partial<MarketListItem> = {}): MarketListItem {
  return {
    id: "market-1",
    slug: "fengjia",
    name: "逢甲夜市",
    type: "night_market",
    city: "台中市",
    district: "西屯區",
    vendorCount: 12,
    publicReadiness: {
      ready: true,
      score: 100,
      completedCount: 7,
      totalCount: 7,
      issues: [],
    },
    catalogCoverage: {
      searchableProductCount: 18,
      publicServiceCount: 4,
      vendorsWithSearchableProducts: 10,
      vendorsMissingSearchableProducts: 2,
      vendorsWithPublicServices: 6,
      vendorsMissingPublicServices: 6,
      missingProductVendors: [
        {
          restaurantId: "vendor-1",
          name: "缺商品攤位",
          stallNumber: "A-01",
        },
      ],
      missingServiceVendors: [],
    },
    ...overrides,
  };
}

describe("market public readiness workbench", () => {
  it("counts ready, blocked, and unknown markets", () => {
    expect(
      marketReadinessStats([
        market(),
        market({
          id: "market-2",
          publicReadiness: {
            ready: false,
            score: 43,
            completedCount: 3,
            totalCount: 7,
            issues: [{ key: "products", severity: "required" }],
          },
        }),
        market({ id: "market-3", publicReadiness: undefined }),
      ]),
    ).toEqual({
      total: 3,
      ready: 1,
      blocked: 1,
      unknown: 1,
      averageScore: 72,
      vendorsMissingProducts: 6,
      vendorsMissingServices: 18,
    });
  });

  it("filters markets by readiness state and text query", () => {
    const markets = [
      market(),
      market({
        id: "market-2",
        name: "一中商圈",
        slug: "yizhong",
        district: "北區",
        publicReadiness: {
          ready: false,
          score: 43,
          completedCount: 3,
          totalCount: 7,
          issues: [{ key: "products", severity: "required" }],
        },
      }),
    ];

    expect(filterMarketsByReadiness(markets, "blocked")).toHaveLength(1);
    expect(filterMarketsByReadiness(markets, "ready")[0].slug).toBe("fengjia");
    expect(filterMarketsByReadiness(markets, "all", "北區")[0].slug).toBe(
      "yizhong",
    );
  });

  it("filters markets by catalog gap type", () => {
    const markets = [
      market({
        id: "market-products",
        slug: "products-gap",
        catalogCoverage: {
          searchableProductCount: 0,
          publicServiceCount: 3,
          vendorsWithSearchableProducts: 0,
          vendorsMissingSearchableProducts: 4,
          vendorsWithPublicServices: 4,
          vendorsMissingPublicServices: 0,
          missingProductVendors: [],
          missingServiceVendors: [],
        },
      }),
      market({
        id: "market-services",
        slug: "services-gap",
        catalogCoverage: {
          searchableProductCount: 10,
          publicServiceCount: 0,
          vendorsWithSearchableProducts: 4,
          vendorsMissingSearchableProducts: 0,
          vendorsWithPublicServices: 0,
          vendorsMissingPublicServices: 4,
          missingProductVendors: [],
          missingServiceVendors: [],
        },
      }),
      market({
        id: "market-complete",
        slug: "complete",
        catalogCoverage: {
          searchableProductCount: 10,
          publicServiceCount: 3,
          vendorsWithSearchableProducts: 4,
          vendorsMissingSearchableProducts: 0,
          vendorsWithPublicServices: 4,
          vendorsMissingPublicServices: 0,
          missingProductVendors: [],
          missingServiceVendors: [],
        },
      }),
    ];

    expect(filterMarketsByReadiness(markets, "missingProducts")).toHaveLength(
      1,
    );
    expect(filterMarketsByReadiness(markets, "missingProducts")[0].slug).toBe(
      "products-gap",
    );
    expect(filterMarketsByReadiness(markets, "missingServices")[0].slug).toBe(
      "services-gap",
    );
  });

  it("summarizes vendor-level catalog readiness gaps", () => {
    const summary = marketReadinessStats([
      market(),
      market({
        id: "market-2",
        catalogCoverage: {
          searchableProductCount: 8,
          publicServiceCount: 1,
          vendorsWithSearchableProducts: 4,
          vendorsMissingSearchableProducts: 1,
          vendorsWithPublicServices: 1,
          vendorsMissingPublicServices: 4,
          missingProductVendors: [],
          missingServiceVendors: [],
        },
      }),
    ]);

    expect(summary).toMatchObject({
      vendorsMissingProducts: 3,
      vendorsMissingServices: 10,
    });
  });
});
