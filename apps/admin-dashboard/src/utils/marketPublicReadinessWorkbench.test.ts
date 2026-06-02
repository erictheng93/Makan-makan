import { describe, expect, it } from "vitest";
import {
  filterMarketsByReadiness,
  marketCatalogGapPriority,
  marketReadinessStats,
  sortMarketsByCatalogPriority,
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
    mapLayout: {
      title: "逢甲地圖",
      imageUrl: "https://example.com/map.png",
      width: 1200,
      height: 800,
    },
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
      vendorsMissingStallNumbers: 0,
      vendorsMissingMapPositions: 0,
      marketsMissingMapLayout: 0,
      vendorsMissingSearchEntrypoints: 0,
      marketsWithoutVendors: 0,
      marketsWithoutSearchableCatalog: 0,
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

  it("filters markets by stall number and search entrypoint gaps", () => {
    const markets = [
      market({
        id: "market-stalls",
        slug: "stalls-gap",
        catalogCoverage: {
          searchableProductCount: 10,
          publicServiceCount: 3,
          vendorsMissingSearchableProducts: 0,
          vendorsMissingPublicServices: 0,
          vendorsMissingStallNumbers: 2,
          vendorsMissingSearchEntrypoints: 0,
          missingProductVendors: [],
          missingServiceVendors: [],
          missingStallNumberVendors: [],
          missingSearchEntrypointVendors: [],
        },
      }),
      market({
        id: "market-entrypoints",
        slug: "entrypoints-gap",
        catalogCoverage: {
          searchableProductCount: 0,
          publicServiceCount: 0,
          vendorsMissingSearchableProducts: 3,
          vendorsMissingPublicServices: 3,
          vendorsMissingStallNumbers: 0,
          vendorsMissingSearchEntrypoints: 3,
          missingProductVendors: [],
          missingServiceVendors: [],
          missingStallNumberVendors: [],
          missingSearchEntrypointVendors: [],
        },
      }),
    ];

    expect(filterMarketsByReadiness(markets, "missingStalls")[0].slug).toBe(
      "stalls-gap",
    );
    expect(
      filterMarketsByReadiness(markets, "missingEntrypoints")[0].slug,
    ).toBe("entrypoints-gap");
  });

  it("tracks and filters markets that would render customer empty states", () => {
    const markets = [
      market({
        id: "empty-vendors",
        slug: "empty-vendors",
        vendorCount: 0,
        catalogCoverage: {
          searchableProductCount: 0,
          publicServiceCount: 0,
          vendorsMissingSearchableProducts: 0,
          vendorsMissingPublicServices: 0,
          missingProductVendors: [],
          missingServiceVendors: [],
        },
      }),
      market({
        id: "empty-catalog",
        slug: "empty-catalog",
        vendorCount: 3,
        catalogCoverage: {
          searchableProductCount: 0,
          publicServiceCount: 0,
          vendorsMissingSearchableProducts: 3,
          vendorsMissingPublicServices: 3,
          missingProductVendors: [],
          missingServiceVendors: [],
        },
      }),
      market({
        id: "ready",
        slug: "ready",
        vendorCount: 2,
        catalogCoverage: {
          searchableProductCount: 4,
          publicServiceCount: 1,
          vendorsMissingSearchableProducts: 0,
          vendorsMissingPublicServices: 0,
          missingProductVendors: [],
          missingServiceVendors: [],
        },
      }),
    ];

    expect(marketReadinessStats(markets)).toMatchObject({
      marketsWithoutVendors: 1,
      marketsWithoutSearchableCatalog: 2,
    });
    expect(filterMarketsByReadiness(markets, "emptyVendors")[0].slug).toBe(
      "empty-vendors",
    );
    expect(
      filterMarketsByReadiness(markets, "emptyCatalog").map(
        (entry) => entry.slug,
      ),
    ).toEqual(["empty-vendors", "empty-catalog"]);
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
      vendorsMissingStallNumbers: 0,
      vendorsMissingMapPositions: 0,
      marketsMissingMapLayout: 0,
      vendorsMissingSearchEntrypoints: 0,
      marketsWithoutVendors: 0,
      marketsWithoutSearchableCatalog: 0,
    });
  });

  it("tracks and filters markets missing map layout or vendor positions", () => {
    const markets = [
      market({
        id: "missing-layout",
        slug: "missing-layout",
        mapLayout: null,
        catalogCoverage: {
          searchableProductCount: 8,
          publicServiceCount: 2,
          vendorsMissingMapPositions: 0,
          missingMapPositionVendors: [],
        },
      }),
      market({
        id: "missing-positions",
        slug: "missing-positions",
        catalogCoverage: {
          searchableProductCount: 8,
          publicServiceCount: 2,
          vendorsMissingMapPositions: 3,
          missingMapPositionVendors: [],
        },
      }),
      market({
        id: "map-ready",
        slug: "map-ready",
        catalogCoverage: {
          searchableProductCount: 8,
          publicServiceCount: 2,
          vendorsMissingMapPositions: 0,
          missingMapPositionVendors: [],
        },
      }),
    ];

    expect(marketReadinessStats(markets)).toMatchObject({
      vendorsMissingMapPositions: 3,
      marketsMissingMapLayout: 1,
    });
    expect(
      filterMarketsByReadiness(markets, "missingMaps").map(
        (entry) => entry.slug,
      ),
    ).toEqual(["missing-layout", "missing-positions"]);
  });

  it("scores catalog completion priority from missing products, services, customer empties, and readiness", () => {
    expect(
      marketCatalogGapPriority(
        market({
          vendorCount: 0,
          catalogCoverage: {
            searchableProductCount: 0,
            publicServiceCount: 0,
            vendorsMissingSearchableProducts: 2,
            vendorsMissingPublicServices: 3,
            missingProductVendors: [],
            missingServiceVendors: [],
          },
          publicReadiness: {
            ready: false,
            score: 70,
            completedCount: 5,
            totalCount: 7,
            issues: [],
          },
        }),
      ),
    ).toBe(29);
  });

  it("sorts markets by catalog completion priority before name", () => {
    const sorted = sortMarketsByCatalogPriority([
      market({
        id: "low",
        slug: "low",
        name: "低缺口市場",
        catalogCoverage: {
          searchableProductCount: 10,
          publicServiceCount: 3,
          vendorsMissingSearchableProducts: 0,
          vendorsMissingPublicServices: 1,
          missingProductVendors: [],
          missingServiceVendors: [],
        },
        publicReadiness: {
          ready: true,
          score: 100,
          completedCount: 7,
          totalCount: 7,
          issues: [],
        },
      }),
      market({
        id: "high",
        slug: "high",
        name: "高缺口市場",
        catalogCoverage: {
          searchableProductCount: 0,
          publicServiceCount: 0,
          vendorsMissingSearchableProducts: 3,
          vendorsMissingPublicServices: 2,
          missingProductVendors: [],
          missingServiceVendors: [],
        },
        publicReadiness: {
          ready: false,
          score: 50,
          completedCount: 4,
          totalCount: 7,
          issues: [],
        },
      }),
    ]);

    expect(sorted.map((entry) => entry.slug)).toEqual(["high", "low"]);
  });
});
