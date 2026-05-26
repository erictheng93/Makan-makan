import Papa from "papaparse";
import type { MarketAreaReadinessSummary } from "@/services/marketsService";

const csvFields = [
  "city",
  "district",
  "marketCount",
  "vendorCount",
  "searchableProductCount",
  "publicServiceCount",
  "vendorsMissingSearchableProducts",
  "vendorsMissingPublicServices",
  "marketsWithoutVendors",
  "marketsWithoutSearchableCatalog",
  "totalCatalogGapVendors",
  "averageReadinessScore",
] as const;

type MarketAreaReadinessCsvRow = Record<(typeof csvFields)[number], string>;

export function buildMarketAreaReadinessCsv(
  areas: MarketAreaReadinessSummary[],
) {
  return Papa.unparse({
    fields: [...csvFields],
    data: areas.map(areaReadinessCsvRow),
  }).replace(/\r?\n$/, "");
}

export function marketAreaReadinessCsvFilename(date = new Date()) {
  return `market-area-readiness-${date.toISOString().slice(0, 10)}.csv`;
}

function areaReadinessCsvRow(
  area: MarketAreaReadinessSummary,
): MarketAreaReadinessCsvRow {
  return {
    city: area.city,
    district: area.district,
    marketCount: String(area.marketCount),
    vendorCount: String(area.vendorCount),
    searchableProductCount: String(area.searchableProductCount),
    publicServiceCount: String(area.publicServiceCount),
    vendorsMissingSearchableProducts: String(
      area.vendorsMissingSearchableProducts,
    ),
    vendorsMissingPublicServices: String(area.vendorsMissingPublicServices),
    marketsWithoutVendors: String(area.marketsWithoutVendors),
    marketsWithoutSearchableCatalog: String(
      area.marketsWithoutSearchableCatalog,
    ),
    totalCatalogGapVendors: String(area.totalCatalogGapVendors),
    averageReadinessScore: String(area.averageReadinessScore),
  };
}
