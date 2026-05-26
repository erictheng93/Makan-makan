import type { MarketListItem } from "@/services/marketsService";

export type MarketReadinessFilter =
  | "all"
  | "ready"
  | "blocked"
  | "unknown"
  | "missingProducts"
  | "missingServices";

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

  return {
    total: markets.length,
    ready,
    blocked,
    unknown,
    averageScore,
    vendorsMissingProducts,
    vendorsMissingServices,
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
        (market.catalogCoverage?.vendorsMissingPublicServices ?? 0) > 0);

    if (!readinessMatches) return false;
    if (!normalizedQuery) return true;

    return [market.name, market.slug, market.type, market.city, market.district]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedQuery));
  });
}
