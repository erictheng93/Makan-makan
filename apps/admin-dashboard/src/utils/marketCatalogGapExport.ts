import Papa from "papaparse";
import type {
  MarketCatalogGapVendor,
  MarketListItem,
} from "@/services/marketsService";

const csvFields = [
  "marketId",
  "marketSlug",
  "marketName",
  "city",
  "district",
  "gapType",
  "action",
  "restaurantId",
  "vendorName",
  "stallNumber",
] as const;

type MarketCatalogGapType = "products" | "services";
type MarketCatalogGapCsvRow = Record<(typeof csvFields)[number], string>;

export function buildMarketCatalogGapCsv(markets: MarketListItem[]) {
  return Papa.unparse({
    fields: [...csvFields],
    data: markets.flatMap((market) => [
      ...gapRowsForMarket(
        market,
        "products",
        market.catalogCoverage?.missingProductVendors ?? [],
      ),
      ...gapRowsForMarket(
        market,
        "services",
        market.catalogCoverage?.missingServiceVendors ?? [],
      ),
    ]),
  }).replace(/\r?\n$/, "");
}

export function marketCatalogGapCsvFilename(date = new Date()) {
  return `market-catalog-gaps-${date.toISOString().slice(0, 10)}.csv`;
}

function gapRowsForMarket(
  market: MarketListItem,
  gapType: MarketCatalogGapType,
  vendors: MarketCatalogGapVendor[],
): MarketCatalogGapCsvRow[] {
  return vendors.map((vendor) => ({
    marketId: market.id,
    marketSlug: market.slug,
    marketName: market.name,
    city: market.city,
    district: market.district,
    gapType,
    action: gapType === "products" ? "補商品" : "補服務",
    restaurantId: vendor.restaurantId,
    vendorName: vendor.name,
    stallNumber: vendor.stallNumber ?? "",
  }));
}
