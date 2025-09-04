import { describe, it, expect, beforeEach } from "vitest";
import { i18n, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "@/i18n";

describe("Basic i18n Configuration", () => {
  beforeEach(() => {
    // Reset to default state
    i18n.global.locale.value = DEFAULT_LANGUAGE;
  });

  it("should have correct default language", () => {
    expect(DEFAULT_LANGUAGE).toBe("zh-TW");
  });

  it("should support required languages", () => {
    const supportedCodes = SUPPORTED_LANGUAGES.map((lang) => lang.code);
    expect(supportedCodes).toContain("zh-TW");
    expect(supportedCodes).toContain("zh-CN");
    expect(supportedCodes).toContain("en");
    expect(supportedCodes).toContain("vi");
    expect(supportedCodes).toHaveLength(4);
  });

  it("should have language info with required properties", () => {
    const zhTW = SUPPORTED_LANGUAGES.find((lang) => lang.code === "zh-TW");
    const zhCN = SUPPORTED_LANGUAGES.find((lang) => lang.code === "zh-CN");
    const en = SUPPORTED_LANGUAGES.find((lang) => lang.code === "en");
    const vi = SUPPORTED_LANGUAGES.find((lang) => lang.code === "vi");

    expect(zhTW).toEqual({
      code: "zh-TW",
      name: "繁體中文",
      flag: "🇹🇼",
    });

    expect(zhCN).toEqual({
      code: "zh-CN",
      name: "简体中文",
      flag: "🇨🇳",
    });

    expect(en).toEqual({
      code: "en",
      name: "English",
      flag: "🇺🇸",
    });

    expect(vi).toEqual({
      code: "vi",
      name: "Tiếng Việt",
      flag: "🇻🇳",
    });
  });

  it("should provide translation for common keys in zh-TW", () => {
    i18n.global.locale.value = "zh-TW";

    expect(i18n.global.t("common.confirm")).toBe("確認");
    expect(i18n.global.t("common.cancel")).toBe("取消");
    expect(i18n.global.t("common.loading")).toBe("載入中...");
    expect(i18n.global.t("home.title")).toBe("歡迎來到 MakanMakan");
    expect(i18n.global.t("menu.title")).toBe("菜單");
    expect(i18n.global.t("cart.title")).toBe("購物車");
  });

  it("should provide translation for common keys in Simplified Chinese", () => {
    i18n.global.locale.value = "zh-CN";

    expect(i18n.global.t("common.confirm")).toBe("确认");
    expect(i18n.global.t("common.cancel")).toBe("取消");
    expect(i18n.global.t("common.loading")).toBe("加载中...");
    expect(i18n.global.t("home.title")).toBe("欢迎来到 MakanMakan");
    expect(i18n.global.t("menu.title")).toBe("菜单");
    expect(i18n.global.t("cart.title")).toBe("购物车");
  });

  it("should provide translation for common keys in English", () => {
    i18n.global.locale.value = "en";

    expect(i18n.global.t("common.confirm")).toBe("Confirm");
    expect(i18n.global.t("common.cancel")).toBe("Cancel");
    expect(i18n.global.t("common.loading")).toBe("Loading...");
    expect(i18n.global.t("home.title")).toBe("Welcome to MakanMakan");
    expect(i18n.global.t("menu.title")).toBe("Menu");
    expect(i18n.global.t("cart.title")).toBe("Shopping Cart");
  });

  it("should provide translation for common keys in Vietnamese", () => {
    i18n.global.locale.value = "vi";

    expect(i18n.global.t("common.confirm")).toBe("Xác nhận");
    expect(i18n.global.t("common.cancel")).toBe("Hủy");
    expect(i18n.global.t("common.loading")).toBe("Đang tải...");
    expect(i18n.global.t("home.title")).toBe("Chào mừng đến với MakanMakan");
    expect(i18n.global.t("menu.title")).toBe("Thực đơn");
    expect(i18n.global.t("cart.title")).toBe("Giỏ hàng");
  });

  it("should handle parameterized translations in all languages", () => {
    // Test in Traditional Chinese
    i18n.global.locale.value = "zh-TW";
    expect(i18n.global.t("validation.minLength", { min: 6 })).toBe(
      "至少需要 6 個字元",
    );

    // Test in Simplified Chinese
    i18n.global.locale.value = "zh-CN";
    expect(i18n.global.t("validation.minLength", { min: 6 })).toBe(
      "至少需要 6 个字符",
    );

    // Test in English
    i18n.global.locale.value = "en";
    expect(i18n.global.t("validation.minLength", { min: 6 })).toBe(
      "At least 6 characters required",
    );

    // Test in Vietnamese
    i18n.global.locale.value = "vi";
    expect(i18n.global.t("validation.minLength", { min: 6 })).toBe(
      "Ít nhất 6 ký tự là bắt buộc",
    );
  });

  it("should handle plural translations in all languages", () => {
    // Test in Traditional Chinese
    i18n.global.locale.value = "zh-TW";
    expect(i18n.global.t("cart.itemCount", { count: 3 })).toBe("3 項商品");

    // Test in Simplified Chinese
    i18n.global.locale.value = "zh-CN";
    expect(i18n.global.t("cart.itemCount", { count: 3 })).toBe("3 项商品");

    // Test in English
    i18n.global.locale.value = "en";
    expect(i18n.global.t("cart.itemCount", { count: 3 })).toBe("3 items");

    // Test in Vietnamese
    i18n.global.locale.value = "vi";
    expect(i18n.global.t("cart.itemCount", { count: 3 })).toBe("3 món ăn");
  });

  it("should change locale correctly for all languages", () => {
    expect(i18n.global.locale.value).toBe("zh-TW");

    i18n.global.locale.value = "zh-CN";
    expect(i18n.global.locale.value).toBe("zh-CN");

    i18n.global.locale.value = "en";
    expect(i18n.global.locale.value).toBe("en");

    i18n.global.locale.value = "vi";
    expect(i18n.global.locale.value).toBe("vi");

    i18n.global.locale.value = "zh-TW";
    expect(i18n.global.locale.value).toBe("zh-TW");
  });
});

describe("Translation Coverage", () => {
  const requiredKeys = [
    "common.confirm",
    "common.cancel",
    "common.save",
    "common.loading",
    "home.title",
    "home.subtitle",
    "menu.title",
    "menu.featured",
    "cart.title",
    "cart.empty",
    "order.title",
    "order.placeOrder",
  ];

  it("should have all required keys in Traditional Chinese (zh-TW)", () => {
    i18n.global.locale.value = "zh-TW";

    requiredKeys.forEach((key) => {
      const translation = i18n.global.t(key);
      expect(translation).not.toBe(key); // Should not return the key itself
      expect(translation).toBeTruthy(); // Should have actual translation
    });
  });

  it("should have all required keys in Simplified Chinese (zh-CN)", () => {
    i18n.global.locale.value = "zh-CN";

    requiredKeys.forEach((key) => {
      const translation = i18n.global.t(key);
      expect(translation).not.toBe(key); // Should not return the key itself
      expect(translation).toBeTruthy(); // Should have actual translation
    });
  });

  it("should have all required keys in English", () => {
    i18n.global.locale.value = "en";

    requiredKeys.forEach((key) => {
      const translation = i18n.global.t(key);
      expect(translation).not.toBe(key); // Should not return the key itself
      expect(translation).toBeTruthy(); // Should have actual translation
    });
  });

  it("should have all required keys in Vietnamese", () => {
    i18n.global.locale.value = "vi";

    requiredKeys.forEach((key) => {
      const translation = i18n.global.t(key);
      expect(translation).not.toBe(key); // Should not return the key itself
      expect(translation).toBeTruthy(); // Should have actual translation
    });
  });
});
