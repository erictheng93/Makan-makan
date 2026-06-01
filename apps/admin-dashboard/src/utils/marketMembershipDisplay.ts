export interface MarketMembershipLocationInput {
  stallNumber?: string | null;
  locationLabel?: string | null;
}

export function formatMarketMembershipLocation(
  membership: MarketMembershipLocationInput,
  emptyLabel = "-",
) {
  const parts = [membership.stallNumber, membership.locationLabel]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  return parts.length > 0 ? parts.join(" · ") : emptyLabel;
}
