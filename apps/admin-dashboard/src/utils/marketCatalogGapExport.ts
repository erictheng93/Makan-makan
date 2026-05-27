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
  "actionTarget",
  "returnMarketSlug",
  "restaurantId",
  "vendorName",
  "stallNumber",
] as const;
const vendorImportWorklistFields = [
  "marketId",
  "marketSlug",
  "marketName",
  "restaurantId",
  "name",
  "type",
  "category",
  "description",
  "address",
  "district",
  "city",
  "latitude",
  "longitude",
  "phone",
  "email",
  "website",
  "stallNumber",
  "isPrimary",
] as const;

type MarketCatalogGapType =
  | "products"
  | "services"
  | "stallNumbers"
  | "searchEntrypoints"
  | "marketVendors"
  | "searchableCatalog";
type MarketCatalogGapCsvRow = Record<(typeof csvFields)[number], string>;
type MarketVendorImportWorklistRow = Record<
  (typeof vendorImportWorklistFields)[number],
  string
>;

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

export function buildMarketVendorImportWorklistCsv(markets: MarketListItem[]) {
  return Papa.unparse({
    fields: [...vendorImportWorklistFields],
    data: markets.flatMap(vendorImportWorklistRows),
  }).replace(/\r?\n$/, "");
}

export function countMarketVendorImportWorklistRows(markets: MarketListItem[]) {
  return markets.reduce(
    (total, market) => total + vendorImportWorklistRows(market).length,
    0,
  );
}

export function marketCatalogGapCsvFilename(date = new Date()) {
  return `market-catalog-gaps-${date.toISOString().slice(0, 10)}.csv`;
}

export function marketVendorImportWorklistCsvFilename(date = new Date()) {
  return `market-vendor-import-worklist-${date.toISOString().slice(0, 10)}.csv`;
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
    actionTarget: actionTargetForGapType(gapType),
    returnMarketSlug: market.slug,
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
    actionTarget: actionTargetForGapType(gapType),
    returnMarketSlug: market.slug,
    restaurantId: vendor.restaurantId,
    vendorName: vendor.name,
    stallNumber: vendor.stallNumber ?? "",
  }));
}

function vendorImportWorklistRows(
  market: MarketListItem,
): MarketVendorImportWorklistRow[] {
  const rows: MarketVendorImportWorklistRow[] = [];

  if ((market.vendorCount ?? 0) === 0) {
    rows.push({
      marketId: market.id,
      marketSlug: market.slug,
      marketName: market.name,
      restaurantId: "",
      name: "新店鋪",
      type: "market_stall",
      category: "",
      description: "",
      address: "請填入店鋪地址",
      district: market.district,
      city: market.city,
      latitude: "",
      longitude: "",
      phone: "",
      email: "",
      website: "",
      stallNumber: "",
      isPrimary: "false",
    });
  }

  for (const vendor of market.catalogCoverage?.missingStallNumberVendors ??
    []) {
    rows.push({
      marketId: market.id,
      marketSlug: market.slug,
      marketName: market.name,
      restaurantId: vendor.restaurantId,
      name: vendor.name,
      type: "",
      category: "",
      description: "",
      address: "",
      district: market.district,
      city: market.city,
      latitude: "",
      longitude: "",
      phone: "",
      email: "",
      website: "",
      stallNumber: "",
      isPrimary: "true",
    });
  }

  return rows;
}

function actionForGapType(gapType: MarketCatalogGapType) {
  if (gapType === "products") return "補商品";
  if (gapType === "services") return "補服務";
  if (gapType === "stallNumbers") return "補攤位號";
  if (gapType === "marketVendors") return "匯入或加入店鋪";
  if (gapType === "searchableCatalog") return "補菜單/商品/服務或重建索引";
  return "補商品或補服務";
}

function actionTargetForGapType(gapType: MarketCatalogGapType) {
  if (gapType === "products") return "menu";
  if (gapType === "services") return "services";
  if (gapType === "stallNumbers") return "market_vendor";
  if (gapType === "marketVendors") return "market_vendors";
  return "menu_or_services";
}
