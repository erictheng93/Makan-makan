import { describe, expect, it } from "vitest";
import {
  buildMarketAreaReadinessCsv,
  marketAreaReadinessCsvFilename,
} from "./marketAreaReadinessExport";
import type { MarketAreaReadinessSummary } from "@/services/marketsService";

function area(
  overrides: Partial<MarketAreaReadinessSummary> = {},
): MarketAreaReadinessSummary {
  return {
    city: "台中市",
    district: "西屯區",
    marketCount: 2,
    vendorCount: 8,
    searchableProductCount: 20,
    publicServiceCount: 4,
    vendorsMissingSearchableProducts: 3,
    vendorsMissingPublicServices: 4,
    totalCatalogGapVendors: 7,
    averageReadinessScore: 72,
    ...overrides,
  };
}

describe("market area readiness export", () => {
  it("exports area-level catalog readiness summaries as spreadsheet CSV", () => {
    expect(
      buildMarketAreaReadinessCsv([
        area(),
        area({
          city: "台中市",
          district: "北區,一中",
          marketCount: 1,
          vendorCount: 3,
          searchableProductCount: 8,
          publicServiceCount: 1,
          vendorsMissingSearchableProducts: 1,
          vendorsMissingPublicServices: 1,
          totalCatalogGapVendors: 2,
          averageReadinessScore: 91,
        }),
      ]),
    ).toBe(
      [
        "city,district,marketCount,vendorCount,searchableProductCount,publicServiceCount,vendorsMissingSearchableProducts,vendorsMissingPublicServices,totalCatalogGapVendors,averageReadinessScore",
        "台中市,西屯區,2,8,20,4,3,4,7,72",
        '台中市,"北區,一中",1,3,8,1,1,1,2,91',
      ].join("\r\n"),
    );
  });

  it("builds a dated filename", () => {
    expect(marketAreaReadinessCsvFilename(new Date("2026-05-26"))).toBe(
      "market-area-readiness-2026-05-26.csv",
    );
  });
});
