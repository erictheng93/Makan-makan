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

type MarketCatalogGapType =
  | "products"
  | "services"
  | "stallNumbers"
  | "searchEntrypoints";
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
      ...gapRowsForMarket(
        market,
        "stallNumbers",
        market.catalogCoverage?.missingStallNumberVendors ?? [],
      ),
      ...gapRowsForMarket(
        market,
        "searchEntrypoints",
        market.catalogCoverage?.missingSearchEntrypointVendors ?? [],
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
    action: actionForGapType(gapType),
    restaurantId: vendor.restaurantId,
    vendorName: vendor.name,
    stallNumber: vendor.stallNumber ?? "",
  }));
}

function actionForGapType(gapType: MarketCatalogGapType) {
  if (gapType === "products") return "補商品";
  if (gapType === "services") return "補服務";
  if (gapType === "stallNumbers") return "補攤位號";
  return "補商品或服務";
}
