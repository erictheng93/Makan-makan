import { describe, it, expect } from "vitest";
import { i18n, switchLanguage, SUPPORTED_LANGUAGES } from "@/i18n";
import type { SupportedLanguage } from "@/i18n";

type FlattenedMessage = {
  key: string;
  value: unknown;
};

const flattenMessages = (obj: any, prefix = ""): FlattenedMessage[] => {
  let messages: FlattenedMessage[] = [];
  Object.keys(obj).forEach((key) => {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === "object" && obj[key] !== null) {
      messages = messages.concat(flattenMessages(obj[key], newKey));
    } else {
      messages.push({ key: newKey, value: obj[key] });
    }
  });
  return messages;
};

const flattenKeys = (obj: any, prefix = ""): string[] => {
  return flattenMessages(obj, prefix).map(({ key }) => key);
};

type I18nGlobal = {
  t: (key: string) => string;
};

const testI18n = i18n.global as unknown as I18nGlobal;

describe("Locale Consistency", () => {
  it("should have all 6 locales loaded", () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(6);
    const codes = SUPPORTED_LANGUAGES.map((l) => l.code);
    expect(codes).toContain("zh-TW");
    expect(codes).toContain("zh-CN");
    expect(codes).toContain("en-US");
    expect(codes).toContain("vi-VN");
    expect(codes).toContain("ms-MY");
    expect(codes).toContain("id-ID");
  });

  it("should have identical key count across all 6 locales", () => {
    const keyCounts: Record<string, number> = {};
    SUPPORTED_LANGUAGES.forEach(({ code }) => {
      const messages = i18n.global.getLocaleMessage(code);
      keyCounts[code] = flattenKeys(messages).length;
    });
    const counts = Object.values(keyCounts);
    counts.forEach((count) => {
      expect(count, `Key counts: ${JSON.stringify(keyCounts)}`).toBe(counts[0]);
    });
  });

  it("should have identical key names across all 6 locales", () => {
    const keysByLocale: Record<string, string[]> = {};
    SUPPORTED_LANGUAGES.forEach(({ code }) => {
      const messages = i18n.global.getLocaleMessage(code);
      keysByLocale[code] = flattenKeys(messages).sort();
    });
    const referenceKeys = keysByLocale["zh-TW"];
    SUPPORTED_LANGUAGES.forEach(({ code }) => {
      if (code !== "zh-TW") {
        const missingInLocale = referenceKeys.filter(
          (k) => !keysByLocale[code].includes(k),
        );
        const extraInLocale = keysByLocale[code].filter(
          (k) => !referenceKeys.includes(k),
        );
        expect(missingInLocale, `Keys missing in ${code}`).toEqual([]);
        expect(extraInLocale, `Extra keys in ${code}`).toEqual([]);
      }
    });
  });

  it("should have no empty translation values in any locale", () => {
    SUPPORTED_LANGUAGES.forEach(({ code }) => {
      const messages = i18n.global.getLocaleMessage(code);
      const flattened = flattenMessages(messages);
      flattened.forEach(({ key, value }) => {
        expect(value, `Empty value for ${key} in ${code}`).toBeTruthy();
      });
    });
  });

  it("should have non-trivial translations (not just returning the key path)", () => {
    // Spot-check across all locales that translations resolve to real values
    const spotCheckKeys = [
      "common.confirm",
      "home.title",
      "menu.title",
      "cart.title",
      "order.title",
      "auth.login",
      "errors.general",
      "navigation.home",
    ];

    SUPPORTED_LANGUAGES.forEach(({ code }) => {
      switchLanguage(code as SupportedLanguage);
      spotCheckKeys.forEach((key) => {
        const val = testI18n.t(key);
        expect(val, `${key} returned key path in ${code}`).not.toBe(key);
      });
    });
  });

  it("should have each locale with at least 700 translation keys", () => {
    SUPPORTED_LANGUAGES.forEach(({ code }) => {
      const messages = i18n.global.getLocaleMessage(code);
      const keyCount = flattenKeys(messages).length;
      expect(
        keyCount,
        `${code} has too few keys: ${keyCount}`,
      ).toBeGreaterThanOrEqual(700);
    });
  });
});
