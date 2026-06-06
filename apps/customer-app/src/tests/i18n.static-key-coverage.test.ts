import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { i18n } from "@/i18n";

type MessageTree = Record<string, unknown>;

function flattenMessageKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value as MessageTree).flatMap(([key, child]) =>
    flattenMessageKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return sourceFiles(fullPath);
    }

    return /\.(vue|ts)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)
      ? [fullPath]
      : [];
  });
}

describe("customer i18n static key coverage", () => {
  it("defines every static translation key used in customer-app source", () => {
    const availableKeys = new Set(
      flattenMessageKeys(i18n.global.getLocaleMessage("zh-TW")),
    );
    const testsDir = path.dirname(fileURLToPath(import.meta.url));
    const sourceRoot = path.resolve(testsDir, "..");
    const translationPatterns = [
      /\b(?:t|safeT|tWithParams|tPlural)\(\s*['"]([^'"`$]+)['"]/g,
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
  });
});
