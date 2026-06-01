export const MARKET_TYPE_OPTIONS = [
  { value: "night_market", label: "夜市" },
  { value: "commercial_district", label: "商圈" },
  { value: "food_court", label: "美食街" },
  { value: "event_venue", label: "活動場域" },
] as const;

export type MarketTypeValue = (typeof MARKET_TYPE_OPTIONS)[number]["value"];

const MARKET_TYPE_LABELS: Record<MarketTypeValue, string> = Object.fromEntries(
  MARKET_TYPE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<MarketTypeValue, string>;

export function isMarketType(value: string): value is MarketTypeValue {
  return value in MARKET_TYPE_LABELS;
}

export function marketTypeLabel(type: string) {
  return isMarketType(type) ? MARKET_TYPE_LABELS[type] : "場域";
}
