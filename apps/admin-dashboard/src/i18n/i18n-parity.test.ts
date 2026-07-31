import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import enUS from "./locales/en-US";
import idID from "./locales/id-ID";
import jaJP from "./locales/ja-JP";
import viVN from "./locales/vi-VN";
import zhCN from "./locales/zh-CN";
import zhTW from "./locales/zh-TW";
import baseline from "./untranslated-baseline.json";

type MessageTree = Record<string, unknown>;

/**
 * Compared RAW, never merged over the source locale.
 *
 * This used to assert on `mergeLocaleMessages(zhTW, locale)` — the same
 * fallback the app renders with — so a key absent from a locale resolved to its
 * zh-TW value and the key sets matched by construction. The test passed while
 * four locales were missing the entire advanced-menu-item form (#113): it was
 * measuring the fallback, not the translations.
 */
const localeMessages: Record<string, unknown> = {
  "en-US": enUS,
  "zh-CN": zhCN,
  "ja-JP": jaJP,
  "vi-VN": viVN,
  "id-ID": idID,
};

const untranslated: Record<string, string[]> = baseline.untranslated;

function flattenMessageKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value as MessageTree).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return flattenMessageKeys(child, path);
  });
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return sourceFiles(fullPath);
    }

    return /\.(vue|ts)$/.test(entry.name) ? [fullPath] : [];
  });
}

const sourceKeys = flattenMessageKeys(zhTW);

function missingKeys(messages: unknown): string[] {
  const present = new Set(flattenMessageKeys(messages));
  return sourceKeys.filter((key) => !present.has(key)).sort();
}

describe("admin i18n locale parity", () => {
  it("adds no untranslated key that the baseline does not already record", () => {
    const newlyMissing = Object.fromEntries(
      Object.entries(localeMessages)
        .map(([locale, messages]) => {
          const known = new Set(untranslated[locale] ?? []);
          return [
            locale,
            missingKeys(messages).filter((key) => !known.has(key)),
          ] as const;
        })
        .filter(([, keys]) => keys.length > 0),
    );

    // Translate the key. Do not append it to untranslated-baseline.json —
    // that file records the debt that predates this guard, and adding to it
    // is how the gap this test exists to catch would come back.
    expect(newlyMissing).toEqual({});
  });

  it("keeps the baseline free of keys that have since been translated", () => {
    const stale = Object.fromEntries(
      Object.entries(localeMessages)
        .map(([locale, messages]) => {
          const stillMissing = new Set(missingKeys(messages));
          return [
            locale,
            (untranslated[locale] ?? []).filter(
              (key) => !stillMissing.has(key),
            ),
          ] as const;
        })
        .filter(([, keys]) => keys.length > 0),
    );

    // The baseline can only shrink: translating a key means deleting its
    // entry, so the file stays an accurate count of what is still owed.
    expect(stale).toEqual({});
  });

  it("defines no key that the source locale does not have", () => {
    const source = new Set(sourceKeys);
    const unknownByLocale = Object.fromEntries(
      Object.entries(localeMessages)
        .map(([locale, messages]) => [
          locale,
          flattenMessageKeys(messages)
            .filter((key) => !source.has(key))
            .sort(),
        ])
        .filter(([, keys]) => keys.length > 0),
    );

    // A key no locale falls back from is either a typo or a leftover: the app
    // renders zh-TW when a lookup misses, so it can never be reached.
    expect(unknownByLocale).toEqual({});
  });

  it("defines every static translation key used in admin-dashboard source", () => {
    const availableKeys = new Set(flattenMessageKeys(zhTW));
    const i18nDir = path.dirname(fileURLToPath(import.meta.url));
    const sourceRoot = path.resolve(i18nDir, "..");
    const translationPatterns = [
      /\bt\(\s*['"]([^'"`$]+)['"]/g,
      /\$t\(\s*['"]([^'"`$]+)['"]/g,
    ];
    const missingByKey = new Map<string, Set<string>>();

    for (const file of sourceFiles(sourceRoot)) {
      const source = fs.readFileSync(file, "utf8");
      for (const pattern of translationPatterns) {
        for (const match of source.matchAll(pattern)) {
          const key = match[1];
          if (!availableKeys.has(key)) {
            if (!missingByKey.has(key)) {
              missingByKey.set(key, new Set());
            }
            missingByKey.get(key)?.add(path.relative(sourceRoot, file));
          }
        }
      }
    }

    const missing = Object.fromEntries(
      [...missingByKey.entries()].map(([key, files]) => [
        key,
        [...files].sort(),
      ]),
    );

    expect(missing).toEqual({});
  }, 15_000);
});
