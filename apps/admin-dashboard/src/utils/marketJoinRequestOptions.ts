export interface MarketJoinRequestOptionMarket {
  id: string;
  slug: string;
  name: string;
  city: string;
  district: string;
  tags?: string[] | null;
}

export interface MarketJoinRequestMembership {
  marketId: string;
}

export interface MarketJoinRequestRecord {
  marketId: string;
  status: "pending" | "approved" | "rejected";
}

export function filterMarketJoinRequestOptions(
  markets: MarketJoinRequestOptionMarket[],
  memberships: MarketJoinRequestMembership[],
  requests: MarketJoinRequestRecord[],
  query: string,
): MarketJoinRequestOptionMarket[] {
  const joinedMarketIds = new Set(
    memberships.map((membership) => membership.marketId),
  );
  const unavailableRequestMarketIds = new Set(
    requests
      .filter((request) => request.status !== "rejected")
      .map((request) => request.marketId),
  );
  const normalizedQuery = query.trim().toLowerCase();

  return markets.filter((market) => {
    if (joinedMarketIds.has(market.id)) return false;
    if (unavailableRequestMarketIds.has(market.id)) return false;
    if (!normalizedQuery) return true;

    const haystack = [
      market.name,
      market.slug,
      market.city,
      market.district,
      ...(market.tags ?? []),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}
