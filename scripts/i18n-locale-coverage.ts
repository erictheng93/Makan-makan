import { mkdir, readFile, writeFile } from "node:fs/promises";
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
const importHandoffArgIndex = process.argv.findIndex(
  (arg) => arg === "--import-handoff",
);
const checkHandoffArgIndex = process.argv.findIndex(
  (arg) => arg === "--check-handoff",
);
const importHandoffPath =
  importHandoffArgIndex >= 0
    ? (process.argv
        .slice(importHandoffArgIndex + 1)
        .find((arg) => arg !== "--") ?? "")
    : "";
const checkHandoffPath =
  checkHandoffArgIndex >= 0
    ? (process.argv
        .slice(checkHandoffArgIndex + 1)
        .find((arg) => arg !== "--") ?? "")
    : "";
const shouldFailOnMissing = process.argv.includes("--fail-on-missing");
const handoffPath = path.resolve("docs/i18n/locale-translator-handoff.csv");

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

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell);
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

async function loadExistingHandoff(): Promise<Map<string, string[]>> {
  try {
    const existingCsv = await readFile(handoffPath, "utf8");
    const rows = parseCsv(existingCsv);
    const [header, ...body] = rows;
    const localeStartIndex = header.indexOf(TARGET_LOCALES[0]);

    if (localeStartIndex < 0) {
      return new Map();
    }

    return new Map(
      body.map((row) => [
        `${row[0]}.${row[1]}`,
        TARGET_LOCALES.map((_, index) => row[localeStartIndex + index] ?? ""),
      ]),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return new Map();
    }

    throw error;
  }
}

async function loadMessages(app: AppLocaleConfig, locale: Locale) {
  const localeUrl = new URL(
    `../${app.localeDir}/${locale}.ts`,
    import.meta.url,
  );
  const module = (await import(localeUrl.href)) as { default: Messages };
  return module.default;
}

function setNestedValue(
  messages: Record<string, unknown>,
  dottedKey: string,
  value: string,
): void {
  const parts = dottedKey.split(".");
  let current = messages;

  for (const part of parts.slice(0, -1)) {
    const next = current[part];

    if (!next || typeof next !== "object" || Array.isArray(next)) {
      current[part] = {};
    }

    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

interface HandoffLocaleOutput {
  localeFile: string;
  constantName: string;
  messages: Record<string, unknown>;
}

interface HandoffValidationResult {
  missingTranslations: string[];
  localeOutputs: HandoffLocaleOutput[];
}

async function validateApprovedHandoff(
  csvPath: string,
): Promise<HandoffValidationResult> {
  if (!csvPath) {
    throw new Error("--check-handoff/--import-handoff requires a CSV path");
  }

  const rows = parseCsv(await readFile(path.resolve(csvPath), "utf8"));
  const [header, ...body] = rows;
  const appIndex = header.indexOf("app");
  const keyIndex = header.indexOf("key");
  const localeIndexes = TARGET_LOCALES.map((locale) => header.indexOf(locale));

  if (
    appIndex < 0 ||
    keyIndex < 0 ||
    localeIndexes.some((index) => index < 0)
  ) {
    throw new Error(
      "Handoff CSV must include app, key, zh-CN, vi-VN, ms-MY, and id-ID columns",
    );
  }

  const localeOutputs: HandoffLocaleOutput[] = [];
  const missingTranslations: string[] = [];

  for (const app of APPS) {
    const sourceEntries = flattenMessages(
      await loadMessages(app, SOURCE_LOCALE),
    );
    const expectedKeys = new Set(sourceEntries.map((entry) => entry.key));
    const appRows = body.filter((row) => row[appIndex] === app.name);

    for (const key of expectedKeys) {
      const row = appRows.find((candidate) => candidate[keyIndex] === key);

      if (!row) {
        warning(`${app.name}/${key} is missing from the handoff CSV`);
        for (const locale of TARGET_LOCALES) {
          missingTranslations.push(`${app.name}/${locale}/${key}`);
        }
        continue;
      }

      for (const [index, locale] of TARGET_LOCALES.entries()) {
        if (!row[localeIndexes[index]]?.trim()) {
          missingTranslations.push(`${app.name}/${locale}/${key}`);
        }
      }
    }

    for (const [index, locale] of TARGET_LOCALES.entries()) {
      const messages: Record<string, unknown> = {};

      for (const row of appRows) {
        const key = row[keyIndex];
        const translation = row[localeIndexes[index]]?.trim();

        if (expectedKeys.has(key) && translation) {
          setNestedValue(messages, key, translation);
        }
      }

      const localeFile = path.join(app.localeDir, `${locale}.ts`);
      const constantName = locale
        .replace("-", "")
        .replace(/^([a-z])/, (match) => match.toLowerCase());
      localeOutputs.push({ localeFile, constantName, messages });
    }
  }

  return { missingTranslations, localeOutputs };
}

function assertNoMissingTranslations(missingTranslations: string[]): void {
  if (missingTranslations.length > 0) {
    for (const missingTranslation of missingTranslations.slice(0, 20)) {
      warning(`${missingTranslation} has no approved translation`);
    }

    if (missingTranslations.length > 20) {
      warning(
        `${missingTranslations.length - 20} additional approved translations ` +
          "are missing",
      );
    }

    throw new Error("Handoff CSV has missing approved translations");
  }
}

async function checkApprovedHandoff(csvPath: string): Promise<void> {
  const { missingTranslations } = await validateApprovedHandoff(csvPath);
  assertNoMissingTranslations(missingTranslations);

  console.log(`${csvPath} has complete approved translations`);
}

async function importApprovedHandoff(csvPath: string): Promise<void> {
  const { missingTranslations, localeOutputs } =
    await validateApprovedHandoff(csvPath);
  assertNoMissingTranslations(missingTranslations);

  for (const { localeFile, constantName, messages } of localeOutputs) {
    const file = [
      'import type { Messages } from "../types";',
      "",
      `const ${constantName}: Messages = ${JSON.stringify(messages, null, 2)};`,
      "",
      `export default ${constantName};`,
      "",
    ].join("\n");

    await writeFile(localeFile, file, "utf8");
  }
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
  if (checkHandoffArgIndex >= 0) {
    await checkApprovedHandoff(checkHandoffPath);
    return;
  }

  if (importHandoffArgIndex >= 0) {
    await importApprovedHandoff(importHandoffPath);
    return;
  }

  const existingHandoff = await loadExistingHandoff();
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
      const existingTargets = existingHandoff.get(
        `${app.name}.${entry.key}`,
      ) ?? ["", "", "", ""];

      handoffRows.push([
        app.name,
        entry.key,
        entry.value,
        englishMap.get(entry.key) ?? "",
        ...existingTargets,
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
    const csv = handoffRows
      .map((row) => row.map((cell) => csvCell(cell)).join(","))
      .join("\n");

    await mkdir(outputDir, { recursive: true });
    await writeFile(handoffPath, `${csv}\n`, "utf8");
    console.log(`Wrote ${handoffPath}`);
  }

  if (hasMissingKeys && shouldFailOnMissing) {
    process.exitCode = 1;
  }
}

await main();
