import { describe, expect, it } from "vitest";
import { getLocalizedMenuName } from "@/utils/localized-menu-content";

describe("getLocalizedMenuName", () => {
  it("uses the English override for the English locale", () => {
    expect(
      getLocalizedMenuName(
        { name: "海南雞飯", nameEn: "Hainanese Chicken Rice" },
        "en-US",
      ),
    ).toBe("Hainanese Chicken Rice");
  });

  it("falls back to the canonical name when English is missing or blank", () => {
    expect(getLocalizedMenuName({ name: "海南雞飯" }, "en-US")).toBe(
      "海南雞飯",
    );
    expect(
      getLocalizedMenuName({ name: "海南雞飯", nameEn: "  " }, "en-US"),
    ).toBe("海南雞飯");
  });

  it("keeps the canonical name for non-English locales", () => {
    expect(
      getLocalizedMenuName(
        { name: "海南雞飯", nameEn: "Hainanese Chicken Rice" },
        "zh-TW",
      ),
    ).toBe("海南雞飯");
  });
});
