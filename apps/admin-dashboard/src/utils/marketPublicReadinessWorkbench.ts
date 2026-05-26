import type { MarketListItem } from "@/services/marketsService";

export type MarketReadinessFilter =
  | "all"
  | "ready"
  | "blocked"
  | "unknown"
  | "missingProducts"
  | "missingServices"
  | "missingStalls"
  | "missingEntrypoints";

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
  const vendorsMissingSearchEntrypoints = markets.reduce(
    (total, market) =>
      total + (market.catalogCoverage?.vendorsMissingSearchEntrypoints ?? 0),
    0,
  );

  return {
    total: markets.length,
    ready,
    blocked,
    unknown,
    averageScore,
    vendorsMissingProducts,
    vendorsMissingServices,
    vendorsMissingStallNumbers,
    vendorsMissingSearchEntrypoints,
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
      (filter === "missingEntrypoints" &&
        (market.catalogCoverage?.vendorsMissingSearchEntrypoints ?? 0) > 0);

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
  const missingSearchEntrypoints =
    market.catalogCoverage?.vendorsMissingSearchEntrypoints ?? 0;
  const readinessGap = Math.ceil(
    Math.max(0, 100 - (market.publicReadiness?.score ?? 0)) / 10,
  );

  return (
    missingProducts * 3 +
    missingServices * 2 +
    missingStallNumbers +
    missingSearchEntrypoints * 4 +
    readinessGap
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
