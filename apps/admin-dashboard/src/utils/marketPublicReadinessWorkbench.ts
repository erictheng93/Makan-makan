import type { MarketListItem } from "@/services/marketsService";

export type MarketReadinessFilter =
  | "all"
  | "ready"
  | "blocked"
  | "unknown"
  | "missingProducts"
  | "missingServices"
  | "missingStalls"
  | "missingMaps"
  | "missingEntrypoints"
  | "emptyVendors"
  | "emptyCatalog";

export function marketHasNoVendors(market: MarketListItem) {
  return market.vendorCount === 0;
}

export function marketHasNoSearchableCatalog(market: MarketListItem) {
  if (!market.catalogCoverage) return false;

  return (
    market.catalogCoverage.searchableProductCount === 0 &&
    market.catalogCoverage.publicServiceCount === 0
  );
}

export function marketReadinessStats(markets: MarketListItem[]) {
  const ready = markets.filter(
    (market) => market.publicReadiness?.ready,
  ).length;
  const blocked = markets.filter(
    (market) => market.publicReadiness?.ready === false,
  ).length;
  const unknown = markets.filter((market) => !market.publicReadiness).length;
  const scoredMarkets = markets.filter((market) => market.publicReadiness);
  const averageScore =
    scoredMarkets.length === 0
      ? 0
      : Math.round(
          scoredMarkets.reduce(
            (total, market) => total + (market.publicReadiness?.score ?? 0),
            0,
          ) / scoredMarkets.length,
        );
  const vendorsMissingProducts = markets.reduce(
    (total, market) =>
      total + (market.catalogCoverage?.vendorsMissingSearchableProducts ?? 0),
    0,
  );
  const vendorsMissingServices = markets.reduce(
    (total, market) =>
      total + (market.catalogCoverage?.vendorsMissingPublicServices ?? 0),
    0,
  );
  const vendorsMissingStallNumbers = markets.reduce(
    (total, market) =>
      total + (market.catalogCoverage?.vendorsMissingStallNumbers ?? 0),
    0,
  );
  const vendorsMissingMapPositions = markets.reduce(
    (total, market) =>
      total + (market.catalogCoverage?.vendorsMissingMapPositions ?? 0),
    0,
  );
  const marketsMissingMapLayout = markets.filter(hasMapLayoutGap).length;
  const vendorsMissingSearchEntrypoints = markets.reduce(
    (total, market) =>
      total + (market.catalogCoverage?.vendorsMissingSearchEntrypoints ?? 0),
    0,
  );
  const marketsWithoutVendors = markets.filter(marketHasNoVendors).length;
  const marketsWithoutSearchableCatalog = markets.filter(
    marketHasNoSearchableCatalog,
  ).length;

  return {
    total: markets.length,
    ready,
    blocked,
    unknown,
    averageScore,
    vendorsMissingProducts,
    vendorsMissingServices,
    vendorsMissingStallNumbers,
    vendorsMissingMapPositions,
    marketsMissingMapLayout,
    vendorsMissingSearchEntrypoints,
    marketsWithoutVendors,
    marketsWithoutSearchableCatalog,
  };
}

export function filterMarketsByReadiness(
  markets: MarketListItem[],
  filter: MarketReadinessFilter,
  query = "",
) {
  const normalizedQuery = query.trim().toLowerCase();

  return markets.filter((market) => {
    const readinessMatches =
      filter === "all" ||
      (filter === "ready" && market.publicReadiness?.ready === true) ||
      (filter === "blocked" && market.publicReadiness?.ready === false) ||
      (filter === "unknown" && !market.publicReadiness) ||
      (filter === "missingProducts" &&
        (market.catalogCoverage?.vendorsMissingSearchableProducts ?? 0) > 0) ||
      (filter === "missingServices" &&
        (market.catalogCoverage?.vendorsMissingPublicServices ?? 0) > 0) ||
      (filter === "missingStalls" &&
        (market.catalogCoverage?.vendorsMissingStallNumbers ?? 0) > 0) ||
      (filter === "missingMaps" && hasMapOperationsGap(market)) ||
      (filter === "missingEntrypoints" &&
        (market.catalogCoverage?.vendorsMissingSearchEntrypoints ?? 0) > 0) ||
      (filter === "emptyVendors" && marketHasNoVendors(market)) ||
      (filter === "emptyCatalog" && marketHasNoSearchableCatalog(market));

    if (!readinessMatches) return false;
    if (!normalizedQuery) return true;

    return [market.name, market.slug, market.type, market.city, market.district]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedQuery));
  });
}

export function marketCatalogGapPriority(market: MarketListItem) {
  const missingProducts =
    market.catalogCoverage?.vendorsMissingSearchableProducts ?? 0;
  const missingServices =
    market.catalogCoverage?.vendorsMissingPublicServices ?? 0;
  const missingStallNumbers =
    market.catalogCoverage?.vendorsMissingStallNumbers ?? 0;
  const missingMapPositions =
    market.catalogCoverage?.vendorsMissingMapPositions ?? 0;
  const missingSearchEntrypoints =
    market.catalogCoverage?.vendorsMissingSearchEntrypoints ?? 0;
  const emptyVendors = marketHasNoVendors(market) ? 8 : 0;
  const emptyCatalog = marketHasNoSearchableCatalog(market) ? 6 : 0;
  const readinessGap = Math.ceil(
    Math.max(0, 100 - (market.publicReadiness?.score ?? 0)) / 10,
  );

  return (
    emptyVendors +
    emptyCatalog +
    missingProducts * 3 +
    missingServices * 2 +
    missingStallNumbers +
    missingMapPositions +
    (hasMapLayoutGap(market) ? 2 : 0) +
    missingSearchEntrypoints * 4 +
    readinessGap
  );
}

export function hasMapLayoutGap(market: MarketListItem) {
  const layout = market.mapLayout;
  if (!layout) return true;
  return ![layout.title, layout.description, layout.imageUrl].some(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
}

export function hasMapOperationsGap(market: MarketListItem) {
  return (
    hasMapLayoutGap(market) ||
    (market.catalogCoverage?.vendorsMissingMapPositions ?? 0) > 0
  );
}

export function sortMarketsByCatalogPriority(markets: MarketListItem[]) {
  return [...markets].sort((left, right) => {
    const priorityDelta =
      marketCatalogGapPriority(right) - marketCatalogGapPriority(left);
    if (priorityDelta !== 0) return priorityDelta;

    return left.name.localeCompare(right.name, "zh-Hant");
  });
}
