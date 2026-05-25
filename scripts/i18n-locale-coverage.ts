import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Messages } from "../apps/kitchen-display/src/i18n/types";

type Locale = "zh-TW" | "en-US" | "zh-CN" | "vi-VN" | "ms-MY" | "id-ID";

interface AppLocaleConfig {
  name: string;
  localeDir: string;
}

interface LeafEntry {
  key: string;
  value: string;
}

const APPS: AppLocaleConfig[] = [
  {
    name: "kitchen-display",
    localeDir: "apps/kitchen-display/src/i18n/locales",
  },
  {
    name: "onboarding-app",
    localeDir: "apps/onboarding-app/src/i18n/locales",
  },
  {
    name: "management-portal",
    localeDir: "apps/management-portal/src/i18n/locales",
  },
];

const SOURCE_LOCALE: Locale = "zh-TW";
const SECONDARY_SOURCE_LOCALE: Locale = "en-US";
const TARGET_LOCALES: Locale[] = ["zh-CN", "vi-VN", "ms-MY", "id-ID"];

const shouldExportHandoff = process.argv.includes("--export-handoff");
const shouldFailOnMissing = process.argv.includes("--fail-on-missing");

function flattenMessages(
  messages: Messages,
  prefix = "",
  entries: LeafEntry[] = [],
): LeafEntry[] {
  for (const [key, value] of Object.entries(messages)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "string") {
      entries.push({ key: fullKey, value });
    } else {
      flattenMessages(value, fullKey, entries);
    }
  }

  return entries;
}

function toEntryMap(entries: LeafEntry[]): Map<string, string> {
  return new Map(entries.map((entry) => [entry.key, entry.value]));
}

async function loadMessages(app: AppLocaleConfig, locale: Locale) {
  const localeUrl = new URL(
    `../${app.localeDir}/${locale}.ts`,
    import.meta.url,
  );
  const module = (await import(localeUrl.href)) as { default: Messages };
  return module.default;
}

function csvCell(value: string | number): string {
  const text = String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function warning(message: string): void {
  if (process.env.GITHUB_ACTIONS) {
    console.warn(`::warning::${message}`);
    return;
  }

  console.warn(`Warning: ${message}`);
}

async function main(): Promise<void> {
  const handoffRows = [
    [
      "app",
      "key",
      "zh-TW source",
      "en-US source",
      "zh-CN",
      "vi-VN",
      "ms-MY",
      "id-ID",
    ],
  ];
  let hasMissingKeys = false;

  for (const app of APPS) {
    const sourceMessages = await loadMessages(app, SOURCE_LOCALE);
    const englishMessages = await loadMessages(app, SECONDARY_SOURCE_LOCALE);
    const sourceEntries = flattenMessages(sourceMessages).sort((a, b) =>
      a.key.localeCompare(b.key),
    );
    const sourceMap = toEntryMap(sourceEntries);
    const englishMap = toEntryMap(flattenMessages(englishMessages));

    for (const entry of sourceEntries) {
      handoffRows.push([
        app.name,
        entry.key,
        entry.value,
        englishMap.get(entry.key) ?? "",
        "",
        "",
        "",
        "",
      ]);
    }

    console.log(
      `${app.name}: ${SOURCE_LOCALE} has ${sourceEntries.length} leaf keys`,
    );

    for (const locale of TARGET_LOCALES) {
      const targetMessages = await loadMessages(app, locale);
      const targetEntries = flattenMessages(targetMessages);
      const targetKeys = new Set(targetEntries.map((entry) => entry.key));
      const missingKeys = [...sourceMap.keys()].filter(
        (key) => !targetKeys.has(key),
      );

      if (missingKeys.length > 0) {
        hasMissingKeys = true;
        warning(
          `${app.name}/${locale} is missing ${missingKeys.length} of ` +
            `${sourceEntries.length} ${SOURCE_LOCALE} leaf keys`,
        );
      } else {
        console.log(`${app.name}/${locale}: complete`);
      }
    }
  }

  if (shouldExportHandoff) {
    const outputDir = path.resolve("docs/i18n");
    const outputPath = path.join(outputDir, "locale-translator-handoff.csv");
    const csv = handoffRows
      .map((row) => row.map((cell) => csvCell(cell)).join(","))
      .join("\n");

    await mkdir(outputDir, { recursive: true });
    await writeFile(outputPath, `${csv}\n`, "utf8");
    console.log(`Wrote ${outputPath}`);
  }

  if (hasMissingKeys && shouldFailOnMissing) {
    process.exitCode = 1;
  }
}

await main();
