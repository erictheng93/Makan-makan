import { describe, expect, it } from "vitest";
import {
  getLocalizedMenuName,
  menuItemMatchesQuery,
} from "@/utils/localized-menu-content";

const CHICKEN_RICE = { name: "海南雞飯", nameEn: "Hainanese Chicken Rice" };

describe("getLocalizedMenuName", () => {
  it("uses the English override for the English locale", () => {
    expect(getLocalizedMenuName(CHICKEN_RICE, "en-US")).toBe(
      "Hainanese Chicken Rice",
    );

    // en-GB, not only en-US: LocaleManager normalises it today, so an exact
    // "en-US" comparison would pass here and still drop back to Chinese the
    // day SUPPORTED_LOCALES gains another English variant.
    expect(getLocalizedMenuName(CHICKEN_RICE, "en-GB")).toBe(
      "Hainanese Chicken Rice",
    );
  });

  it("falls back to the canonical name when English is missing or blank", () => {
    expect(getLocalizedMenuName({ name: "海南雞飯" }, "en-US")).toBe(
      "海南雞飯",
    );
    expect(
      getLocalizedMenuName({ name: "海南雞飯", nameEn: "  " }, "en-US"),
    ).toBe("海南雞飯");
    // null is what the API actually sends for an item with no English name —
    // a different shape from undefined, and the one that comes over the wire.
    expect(
      getLocalizedMenuName({ name: "海南雞飯", nameEn: null }, "en-US"),
    ).toBe("海南雞飯");
  });

  it("keeps the canonical name for Chinese locales", () => {
    expect(getLocalizedMenuName(CHICKEN_RICE, "zh-TW")).toBe("海南雞飯");
    expect(getLocalizedMenuName(CHICKEN_RICE, "zh-CN")).toBe("海南雞飯");
  });

  // ms-MY / id-ID / vi-VN read the Latin alphabet but nameEn is an English
  // name, not theirs. Showing both is the honest form: the half they can read,
  // plus the half they can point at when ordering.
  it("shows both names for the Latin-alphabet locales that have no override", () => {
    for (const locale of ["ms-MY", "id-ID", "vi-VN"]) {
      expect(getLocalizedMenuName(CHICKEN_RICE, locale)).toBe(
        "Hainanese Chicken Rice（海南雞飯）",
      );
    }
  });

  it("shows one name when there is only one to show", () => {
    // No English override: the bilingual form would just be "中文（中文）".
    expect(getLocalizedMenuName({ name: "滷肉飯" }, "ms-MY")).toBe("滷肉飯");
    expect(
      getLocalizedMenuName({ name: "滷肉飯", nameEn: null }, "vi-VN"),
    ).toBe("滷肉飯");
  });

  it("answers with the canonical name when the locale is unknown", () => {
    // Callers that have not resolved a locale yet must not get the widest
    // form by accident.
    expect(getLocalizedMenuName(CHICKEN_RICE, "")).toBe("海南雞飯");
    expect(
      getLocalizedMenuName(CHICKEN_RICE, undefined as unknown as string),
    ).toBe("海南雞飯");
  });
});

// The regression #112 introduced and this predicate exists to prevent: the
// views filtered on getLocalizedMenuName, which narrows the haystack to
// whichever name the current locale renders. Search must stay locale-blind.
describe("menuItemMatchesQuery", () => {
  it("finds an item by its canonical name and by its English name alike", () => {
    expect(menuItemMatchesQuery(CHICKEN_RICE, "雞飯")).toBe(true);
    expect(menuItemMatchesQuery(CHICKEN_RICE, "hainanese")).toBe(true);
  });

  it("does not depend on which locale is active", () => {
    // Neither call passes a locale, and that is the point: the same query has
    // to match whatever language the visitor is reading the menu in.
    for (const query of ["雞飯", "Chicken"]) {
      expect(menuItemMatchesQuery(CHICKEN_RICE, query)).toBe(true);
    }
  });

  it("matches the description too, and is case-insensitive", () => {
    expect(
      menuItemMatchesQuery(
        { ...CHICKEN_RICE, description: "Steamed with pandan" },
        "PANDAN",
      ),
    ).toBe(true);
  });

  it("tolerates an item with no English name or description", () => {
    expect(menuItemMatchesQuery({ name: "滷肉飯" }, "滷肉")).toBe(true);
    expect(menuItemMatchesQuery({ name: "滷肉飯", nameEn: null }, "pork")).toBe(
      false,
    );
  });

  it("keeps everything when the query is blank", () => {
    expect(menuItemMatchesQuery(CHICKEN_RICE, "   ")).toBe(true);
  });

  it("rejects a query that matches neither name nor description", () => {
    expect(menuItemMatchesQuery(CHICKEN_RICE, "laksa")).toBe(false);
  });
});
