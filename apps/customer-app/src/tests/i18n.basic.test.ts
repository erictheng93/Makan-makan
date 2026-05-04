import { describe, it, expect, beforeEach } from "vitest";
import { i18n, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from "@/i18n";

// Helper to avoid vue-i18n's excessively deep type instantiation in tests

type I18nGlobal = {
  t: (key: string, params?: Record<string, unknown>) => string;
};

const testI18n = i18n.global as unknown as I18nGlobal;

const tGlobal = (key: string, params?: Record<string, unknown>): string =>
  params ? testI18n.t(key, params) : testI18n.t(key);

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
    expect(supportedCodes).toContain("en-US");
    expect(supportedCodes).toContain("vi-VN");
    expect(supportedCodes).toContain("ms-MY");
    expect(supportedCodes).toContain("id-ID");
    expect(supportedCodes).toHaveLength(6);
  });

  it("should have language info with required properties", () => {
    const zhTW = SUPPORTED_LANGUAGES.find((lang) => lang.code === "zh-TW");
    const zhCN = SUPPORTED_LANGUAGES.find((lang) => lang.code === "zh-CN");
    const enUS = SUPPORTED_LANGUAGES.find((lang) => lang.code === "en-US");
    const viVN = SUPPORTED_LANGUAGES.find((lang) => lang.code === "vi-VN");

    expect(zhTW?.code).toBe("zh-TW");
    expect(zhTW?.flag).toBe("🇹🇼");

    expect(zhCN?.code).toBe("zh-CN");
    expect(zhCN?.flag).toBe("🇨🇳");

    expect(enUS?.code).toBe("en-US");
    expect(enUS?.flag).toBe("🇺🇸");

    expect(viVN?.code).toBe("vi-VN");
    expect(viVN?.flag).toBe("🇻🇳");
  });

  it("should provide translation for common keys in zh-TW", () => {
    i18n.global.locale.value = "zh-TW";

    expect(tGlobal("common.confirm")).toBe("確認");
    expect(tGlobal("common.cancel")).toBe("取消");
    expect(tGlobal("common.loading")).toBe("載入中...");
    expect(tGlobal("home.title")).toBe("歡迎來到 MakanMasak");
    expect(tGlobal("menu.title")).toBe("菜單");
    expect(tGlobal("cart.title")).toBe("購物車");
  });

  it("should provide translation for common keys in Simplified Chinese", () => {
    i18n.global.locale.value = "zh-CN";

    expect(tGlobal("common.confirm")).toBe("确认");
    expect(tGlobal("common.cancel")).toBe("取消");
    expect(tGlobal("common.loading")).toBe("加载中...");
    expect(tGlobal("home.title")).toBe("欢迎来到 MakanMasak");
    expect(tGlobal("menu.title")).toBe("菜单");
    expect(tGlobal("cart.title")).toBe("购物车");
  });

  it("should provide translation for common keys in English", () => {
    i18n.global.locale.value = "en-US";

    expect(tGlobal("common.confirm")).toBe("Confirm");
    expect(tGlobal("common.cancel")).toBe("Cancel");
    expect(tGlobal("common.loading")).toBe("Loading...");
    expect(tGlobal("home.title")).toBe("Welcome to MakanMasak");
    expect(tGlobal("menu.title")).toBe("Menu");
    expect(tGlobal("cart.title")).toBe("Shopping Cart");
  });

  it("should provide translation for common keys in Vietnamese", () => {
    i18n.global.locale.value = "vi-VN";

    expect(tGlobal("common.confirm")).toBe("Xác nhận");
    expect(tGlobal("common.cancel")).toBe("Hủy");
    expect(tGlobal("common.loading")).toBe("Đang tải...");
    expect(tGlobal("home.title")).toBe("Chào mừng đến với MakanMasak");
    expect(tGlobal("menu.title")).toBe("Thực đơn");
    expect(tGlobal("cart.title")).toBe("Giỏ hàng");
  });

  it("should handle parameterized translations in all languages", () => {
    // Test in Traditional Chinese
    i18n.global.locale.value = "zh-TW";
    expect(tGlobal("validation.minLength", { min: 6 })).toBe(
      "至少需要 6 個字元",
    );

    // Test in Simplified Chinese
    i18n.global.locale.value = "zh-CN";
    expect(tGlobal("validation.minLength", { min: 6 })).toBe(
      "至少需要 6 个字符",
    );

    // Test in English
    i18n.global.locale.value = "en-US";
    expect(tGlobal("validation.minLength", { min: 6 })).toBe(
      "Minimum 6 characters required",
    );

    // Test in Vietnamese
    i18n.global.locale.value = "vi-VN";
    expect(tGlobal("validation.minLength", { min: 6 })).toBe(
      "Ít nhất 6 ký tự là bắt buộc",
    );
  });

  it("should handle plural translations in all languages", () => {
    // Test in Traditional Chinese
    i18n.global.locale.value = "zh-TW";
    expect(tGlobal("cart.itemCount", { count: 3 })).toBe("3 項商品");

    // Test in Simplified Chinese
    i18n.global.locale.value = "zh-CN";
    expect(tGlobal("cart.itemCount", { count: 3 })).toBe("3 项商品");

    // Test in English
    i18n.global.locale.value = "en-US";
    expect(tGlobal("cart.itemCount", { count: 3 })).toBe("3 item(s)");

    // Test in Vietnamese
    i18n.global.locale.value = "vi-VN";
    expect(tGlobal("cart.itemCount", { count: 3 })).toBe("3 món ăn");
  });

  it("should change locale correctly for all languages", () => {
    expect(i18n.global.locale.value).toBe("zh-TW");

    i18n.global.locale.value = "zh-CN";
    expect(i18n.global.locale.value).toBe("zh-CN");

    i18n.global.locale.value = "en-US";
    expect(i18n.global.locale.value).toBe("en-US");

    i18n.global.locale.value = "vi-VN";
    expect(i18n.global.locale.value).toBe("vi-VN");

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
      const translation = tGlobal(key);
      expect(translation).not.toBe(key); // Should not return the key itself
      expect(translation).toBeTruthy(); // Should have actual translation
    });
  });

  it("should have all required keys in Simplified Chinese (zh-CN)", () => {
    i18n.global.locale.value = "zh-CN";

    requiredKeys.forEach((key) => {
      const translation = tGlobal(key);
      expect(translation).not.toBe(key); // Should not return the key itself
      expect(translation).toBeTruthy(); // Should have actual translation
    });
  });

  it("should have all required keys in English", () => {
    i18n.global.locale.value = "en-US";

    requiredKeys.forEach((key) => {
      const translation = tGlobal(key);
      expect(translation).not.toBe(key); // Should not return the key itself
      expect(translation).toBeTruthy(); // Should have actual translation
    });
  });

  it("should have all required keys in Vietnamese", () => {
    i18n.global.locale.value = "vi-VN";

    requiredKeys.forEach((key) => {
      const translation = tGlobal(key);
      expect(translation).not.toBe(key); // Should not return the key itself
      expect(translation).toBeTruthy(); // Should have actual translation
    });
  });
});
