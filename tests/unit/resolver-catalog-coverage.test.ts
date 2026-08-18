import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ERROR_PRESENTATION_KEYS } from "../../packages/shared/utils/user-facing-error";

/**
 * `resolveUserFacingError` returns `translate(key)` and nothing else, so a key
 * the app cannot translate is rendered verbatim -- a chef reads
 * "errorPresentation.permissionDenied". The runtime's `t` returns the key on a
 * miss (packages/shared/src/i18n/src/index.ts), which is the right default and
 * also why this fails silently.
 *
 * The unit tests cannot see it: they mock `t` as `key => key` and assert on
 * keys, so a missing catalog entry and a present one look identical. This test
 * reads the real catalogs instead.
 *
 * kitchen-display shipped exactly this way. It supplies its own `loadMessages`,
 * so it never receives packages/shared's common.json, and the shared test that
 * checks common.json for these keys says nothing about it.
 */
const repoRoot = join(__dirname, "../..");

const catalogs = [
  {
    app: "kitchen-display",
    locales: ["zh-TW", "zh-CN", "en-US", "ms-MY", "id-ID", "vi-VN"],
    path: (locale: string) =>
      `apps/kitchen-display/src/i18n/locales/${locale}.ts`,
  },
  {
    app: "admin-dashboard",
    locales: ["zh-TW", "zh-CN", "en-US", "ja-JP", "id-ID", "vi-VN"],
    path: (locale: string) =>
      `apps/admin-dashboard/src/i18n/locales/${locale}.ts`,
  },
  {
    app: "customer-app",
    locales: ["zh-TW", "zh-CN", "en-US", "ms-MY", "id-ID", "vi-VN"],
    path: (locale: string) =>
      `packages/shared/src/i18n/src/locales/${locale}/common.json`,
  },
];

/**
 * Read as text rather than imported. The .ts catalogs pull in app-local aliases
 * that only resolve inside their own vitest project, and the question here is
 * whether a literal is present, which the source answers directly.
 */
function definedLeafKeys(source: string, section: string): Set<string> {
  const jsonStart = source.indexOf(`"${section}"`);
  const tsStart = source.indexOf(`\n  ${section}: {`);
  const start = jsonStart >= 0 ? jsonStart : tsStart;
  if (start < 0) return new Set();

  const open = source.indexOf("{", start);
  let depth = 0;
  let end = open;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  const block = source.slice(open, end);
  const keys = new Set<string>();
  for (const match of block.matchAll(/(?:^|\n)\s*"?(\w+)"?\s*:\s*"/g)) {
    keys.add(match[1]);
  }
  return keys;
}

describe("resolver catalog coverage", () => {
  for (const catalog of catalogs) {
    it(`gives ${catalog.app} a translation for every key the resolver can return`, () => {
      const missing: string[] = [];

      for (const locale of catalog.locales) {
        const source = readFileSync(
          join(repoRoot, catalog.path(locale)),
          "utf8",
        );
        const defined = definedLeafKeys(source, "errorPresentation");

        for (const key of ERROR_PRESENTATION_KEYS) {
          const leaf = key.slice("errorPresentation.".length);
          if (!defined.has(leaf)) missing.push(`${locale}.${key}`);
        }
      }

      expect(missing).toEqual([]);
    });
  }
});
