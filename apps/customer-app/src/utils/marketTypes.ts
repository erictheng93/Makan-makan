/**
 * Market types are picked in a `<select>` and printed on cards, so they need a
 * translation. This module has no Vue context to call `t()` from, so it deals
 * in keys and leaves resolving them to the component.
 */
export const MARKET_TYPE_OPTIONS = [
  { value: "night_market", labelKey: "markets.type.night_market" },
  {
    value: "commercial_district",
    labelKey: "markets.type.commercial_district",
  },
  { value: "food_court", labelKey: "markets.type.food_court" },
  { value: "event_venue", labelKey: "markets.type.event_venue" },
] as const;

export type MarketTypeValue = (typeof MARKET_TYPE_OPTIONS)[number]["value"];

const MARKET_TYPE_LABEL_KEYS: Record<MarketTypeValue, string> =
  Object.fromEntries(
    MARKET_TYPE_OPTIONS.map((option) => [option.value, option.labelKey]),
  ) as Record<MarketTypeValue, string>;

export function isMarketType(value: string): value is MarketTypeValue {
  return value in MARKET_TYPE_LABEL_KEYS;
}

export function marketTypeLabelKey(type: string) {
  return isMarketType(type)
    ? MARKET_TYPE_LABEL_KEYS[type]
    : "markets.type.other";
}
