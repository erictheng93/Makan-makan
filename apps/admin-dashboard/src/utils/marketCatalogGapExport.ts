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
  | "searchEntrypoints"
  | "marketVendors"
  | "searchableCatalog";
type MarketCatalogGapCsvRow = Record<(typeof csvFields)[number], string>;

export function buildMarketCatalogGapCsv(markets: MarketListItem[]) {
  return Papa.unparse({
    fields: [...csvFields],
    data: markets.flatMap((market) => [
      ...marketLevelGapRows(market),
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

export function countMarketCatalogGapRows(markets: MarketListItem[]) {
  return markets.reduce(
    (total, market) =>
      total +
      marketLevelGapRows(market).length +
      (market.catalogCoverage?.missingProductVendors?.length ?? 0) +
      (market.catalogCoverage?.missingServiceVendors?.length ?? 0) +
      (market.catalogCoverage?.missingStallNumberVendors?.length ?? 0) +
      (market.catalogCoverage?.missingSearchEntrypointVendors?.length ?? 0),
    0,
  );
}

export function marketCatalogGapCsvFilename(date = new Date()) {
  return `market-catalog-gaps-${date.toISOString().slice(0, 10)}.csv`;
}

function marketLevelGapRows(market: MarketListItem): MarketCatalogGapCsvRow[] {
  const rows: MarketCatalogGapCsvRow[] = [];

  if ((market.vendorCount ?? 0) === 0) {
    rows.push(marketLevelGapRow(market, "marketVendors"));
  }

  if (
    market.catalogCoverage &&
    market.catalogCoverage.searchableProductCount === 0 &&
    market.catalogCoverage.publicServiceCount === 0
  ) {
    rows.push(marketLevelGapRow(market, "searchableCatalog"));
  }

  return rows;
}

function marketLevelGapRow(
  market: MarketListItem,
  gapType: Extract<MarketCatalogGapType, "marketVendors" | "searchableCatalog">,
): MarketCatalogGapCsvRow {
  return {
    marketId: market.id,
    marketSlug: market.slug,
    marketName: market.name,
    city: market.city,
    district: market.district,
    gapType,
    action: actionForGapType(gapType),
    restaurantId: "",
    vendorName: "",
    stallNumber: "",
  };
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
  if (gapType === "products") return "補商品或服務";
  if (gapType === "services") return "補服務";
  if (gapType === "stallNumbers") return "補攤位號";
  if (gapType === "marketVendors") return "匯入或加入店鋪";
  if (gapType === "searchableCatalog") return "補菜單/商品/服務或重建索引";
  return "補商品或服務";
}
