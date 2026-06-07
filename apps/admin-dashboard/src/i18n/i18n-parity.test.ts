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
import { mergeLocaleMessages } from "./merge-locale-messages";

type MessageTree = Record<string, unknown>;

const localeMessages = {
  "zh-TW": mergeLocaleMessages(zhTW, zhTW),
  "zh-CN": mergeLocaleMessages(zhTW, zhCN),
  "en-US": mergeLocaleMessages(zhTW, enUS),
  "ja-JP": mergeLocaleMessages(zhTW, jaJP),
  "vi-VN": mergeLocaleMessages(zhTW, viVN),
  "id-ID": mergeLocaleMessages(zhTW, idID),
};

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

describe("admin i18n locale parity", () => {
  it("keeps every supported locale on the same translation key set", () => {
    const keySets = Object.fromEntries(
      Object.entries(localeMessages).map(([locale, messages]) => [
        locale,
        new Set(flattenMessageKeys(messages)),
      ]),
    );
    const allKeys = new Set(
      Object.values(keySets).flatMap((keys) => [...keys]),
    );

    const missingByLocale = Object.fromEntries(
      Object.entries(keySets)
        .map(([locale, keys]) => [
          locale,
          [...allKeys].filter((key) => !keys.has(key)).sort(),
        ])
        .filter(([, missing]) => missing.length > 0),
    );

    expect(missingByLocale).toEqual({});
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
