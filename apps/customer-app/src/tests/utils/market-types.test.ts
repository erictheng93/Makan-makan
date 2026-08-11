import { describe, expect, it } from "vitest";
import {
  isMarketType,
  MARKET_TYPE_OPTIONS,
  marketTypeLabelKey,
} from "@/utils/marketTypes";
import { i18n, SUPPORTED_LANGUAGES } from "@/i18n";

type I18nGlobal = {
  getLocaleMessage: (locale: string) => Record<string, unknown>;
};

const getNested = (messages: Record<string, unknown>, key: string): unknown =>
  key.split(".").reduce<unknown>((current, segment) => {
    if (current && typeof current === "object" && segment in current) {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, messages);

describe("marketTypes", () => {
  it("maps supported venue types to translation keys", () => {
    expect(MARKET_TYPE_OPTIONS).toEqual([
      { value: "night_market", labelKey: "markets.type.night_market" },
      {
        value: "commercial_district",
        labelKey: "markets.type.commercial_district",
      },
      { value: "food_court", labelKey: "markets.type.food_court" },
      { value: "event_venue", labelKey: "markets.type.event_venue" },
    ]);
    expect(marketTypeLabelKey("night_market")).toBe(
      "markets.type.night_market",
    );
    expect(marketTypeLabelKey("commercial_district")).toBe(
      "markets.type.commercial_district",
    );
    expect(marketTypeLabelKey("food_court")).toBe("markets.type.food_court");
    expect(marketTypeLabelKey("event_venue")).toBe("markets.type.event_venue");
  });

  it("falls back for unknown venue types", () => {
    expect(isMarketType("night_market")).toBe(true);
    expect(isMarketType("unknown_market_type")).toBe(false);
    expect(marketTypeLabelKey("unknown_market_type")).toBe(
      "markets.type.other",
    );
  });

  // A key with no translation renders as the raw key on a card, so the two
  // halves have to stay in step.
  it("every key it can return is translated in all 6 locales", () => {
    const testI18n = i18n.global as unknown as I18nGlobal;
    const keys = [
      ...MARKET_TYPE_OPTIONS.map((option) => option.labelKey),
      marketTypeLabelKey("unknown_market_type"),
    ];

    SUPPORTED_LANGUAGES.forEach(({ code }) => {
      const messages = testI18n.getLocaleMessage(code);
      keys.forEach((key) => {
        expect(
          getNested(messages, key),
          `${key} missing in ${code}`,
        ).toBeTruthy();
      });
    });
  });
});
