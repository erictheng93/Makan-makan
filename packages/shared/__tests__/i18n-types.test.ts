/**
 * Tests for i18n types and SUPPORTED_LOCALES configuration
 */
import { describe, it, expect } from "vitest";
import {
  SUPPORTED_LOCALES,
  type SupportedLocale,
  type LocaleInfo,
} from "../src/i18n/src/types";

describe("SUPPORTED_LOCALES", () => {
  it("contains exactly 6 locales", () => {
    expect(SUPPORTED_LOCALES).toHaveLength(6);
  });

  it("contains all expected locale codes", () => {
    const codes = SUPPORTED_LOCALES.map((l) => l.code);
    expect(codes).toContain("en-US");
    expect(codes).toContain("zh-TW");
    expect(codes).toContain("zh-CN");
    expect(codes).toContain("ms-MY");
    expect(codes).toContain("id-ID");
    expect(codes).toContain("vi-VN");
  });

  it("each locale has all required fields", () => {
    SUPPORTED_LOCALES.forEach((locale) => {
      expect(locale.code).toBeTruthy();
      expect(locale.name).toBeTruthy();
      expect(locale.nativeName).toBeTruthy();
      expect(locale.flag).toBeTruthy();
      expect(locale.direction).toBeTruthy();
      expect(locale.dateFormat).toBeTruthy();
      expect(locale.currencyCode).toBeTruthy();
      expect(locale.currencySymbol).toBeTruthy();
    });
  });

  it("all locales use ltr direction", () => {
    SUPPORTED_LOCALES.forEach((locale) => {
      expect(locale.direction).toBe("ltr");
    });
  });

  it("each locale has a unique code", () => {
    const codes = SUPPORTED_LOCALES.map((l) => l.code);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });

  it("each locale has a unique currency code", () => {
    const currencies = SUPPORTED_LOCALES.map((l) => l.currencyCode);
    const uniqueCurrencies = new Set(currencies);
    expect(uniqueCurrencies.size).toBe(currencies.length);
  });

  describe("specific locale configurations", () => {
    it("en-US has correct configuration", () => {
      const enUS = SUPPORTED_LOCALES.find((l) => l.code === "en-US");
      expect(enUS).toBeDefined();
      expect(enUS!.name).toBe("English");
      expect(enUS!.currencyCode).toBe("USD");
      expect(enUS!.currencySymbol).toBe("$");
      expect(enUS!.dateFormat).toBe("MM/dd/yyyy");
    });

    it("zh-TW has correct configuration", () => {
      const zhTW = SUPPORTED_LOCALES.find((l) => l.code === "zh-TW");
      expect(zhTW).toBeDefined();
      expect(zhTW!.nativeName).toBe("繁體中文");
      expect(zhTW!.currencyCode).toBe("TWD");
      expect(zhTW!.currencySymbol).toBe("NT$");
    });

    it("zh-CN has correct configuration", () => {
      const zhCN = SUPPORTED_LOCALES.find((l) => l.code === "zh-CN");
      expect(zhCN).toBeDefined();
      expect(zhCN!.nativeName).toBe("简体中文");
      expect(zhCN!.currencyCode).toBe("CNY");
      expect(zhCN!.currencySymbol).toBe("¥");
    });

    it("ms-MY has correct configuration", () => {
      const msMY = SUPPORTED_LOCALES.find((l) => l.code === "ms-MY");
      expect(msMY).toBeDefined();
      expect(msMY!.nativeName).toBe("Bahasa Malaysia");
      expect(msMY!.currencyCode).toBe("MYR");
      expect(msMY!.currencySymbol).toBe("RM");
    });

    it("id-ID has correct configuration", () => {
      const idID = SUPPORTED_LOCALES.find((l) => l.code === "id-ID");
      expect(idID).toBeDefined();
      expect(idID!.nativeName).toBe("Bahasa Indonesia");
      expect(idID!.currencyCode).toBe("IDR");
    });

    it("vi-VN has correct configuration", () => {
      const viVN = SUPPORTED_LOCALES.find((l) => l.code === "vi-VN");
      expect(viVN).toBeDefined();
      expect(viVN!.nativeName).toBe("Tiếng Việt");
      expect(viVN!.currencyCode).toBe("VND");
    });
  });
});

describe("SupportedLocale type validation", () => {
  it("valid locale strings match the type", () => {
    const validLocales: SupportedLocale[] = [
      "en-US",
      "zh-TW",
      "zh-CN",
      "ms-MY",
      "id-ID",
      "vi-VN",
    ];
    expect(validLocales).toHaveLength(6);
  });
});
