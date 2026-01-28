#!/usr/bin/env npx tsx
/**
 * MakanMakan i18n Audit Script
 *
 * Compares translation files across languages and identifies missing keys.
 * Uses zh-TW as the reference (source of truth) for all translations.
 *
 * Usage: npx tsx scripts/i18n-audit.ts [app]
 * Example: npx tsx scripts/i18n-audit.ts admin-dashboard
 *          npx tsx scripts/i18n-audit.ts customer-app
 *          npx tsx scripts/i18n-audit.ts (audits all apps)
 */

import { readdirSync, existsSync } from "fs";
import { join, basename } from "path";

// ANSI colors for terminal output
const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  gray: (text: string) => `\x1b[90m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
};

interface AuditResult {
  app: string;
  referenceLocale: string;
  referenceKeyCount: number;
  locales: LocaleAudit[];
}

interface LocaleAudit {
  locale: string;
  keyCount: number;
  missingKeys: string[];
  extraKeys: string[];
}

/**
 * Flattens a nested object into dot-notation keys
 */
function flattenKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  let keys: string[] = [];

  for (const key of Object.keys(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];

    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      keys = keys.concat(flattenKeys(value as Record<string, unknown>, newKey));
    } else {
      keys.push(newKey);
    }
  }

  return keys;
}

/**
 * Dynamically imports a locale file and extracts its default export
 */
async function loadLocaleFile(
  filePath: string,
): Promise<Record<string, unknown>> {
  try {
    const module = await import(filePath);
    return module.default || module;
  } catch (error) {
    console.error(colors.red(`Error loading ${filePath}: ${error}`));
    return {};
  }
}

/**
 * Audits a single app's i18n directory
 */
async function auditApp(appPath: string): Promise<AuditResult | null> {
  const appName = basename(appPath);
  const localesPath = join(appPath, "src", "i18n", "locales");

  if (!existsSync(localesPath)) {
    console.log(
      colors.gray(`  Skipping ${appName}: No locales directory found`),
    );
    return null;
  }

  const localeFiles = readdirSync(localesPath).filter(
    (f) => f.endsWith(".ts") && !f.startsWith("index"),
  );

  if (localeFiles.length === 0) {
    console.log(colors.gray(`  Skipping ${appName}: No locale files found`));
    return null;
  }

  console.log(colors.bold(`\n📁 ${appName}`));
  console.log(colors.gray(`   Path: ${localesPath}`));
  console.log(colors.gray(`   Locales: ${localeFiles.join(", ")}`));

  // Load all locale files
  const localeData: Map<string, Record<string, unknown>> = new Map();
  for (const file of localeFiles) {
    const localeName = file.replace(".ts", "");
    const data = await loadLocaleFile(join(localesPath, file));
    localeData.set(localeName, data);
  }

  // Use zh-TW as reference, or first available locale
  const referenceLocale = localeData.has("zh-TW")
    ? "zh-TW"
    : localeFiles[0].replace(".ts", "");
  const referenceData = localeData.get(referenceLocale)!;
  const referenceKeys = new Set(flattenKeys(referenceData));

  console.log(
    colors.cyan(
      `   Reference: ${referenceLocale} (${referenceKeys.size} keys)`,
    ),
  );

  const localeAudits: LocaleAudit[] = [];

  for (const [locale, data] of localeData) {
    const localeKeys = new Set(flattenKeys(data));
    const missingKeys: string[] = [];
    const extraKeys: string[] = [];

    // Find missing keys (in reference but not in this locale)
    for (const key of referenceKeys) {
      if (!localeKeys.has(key)) {
        missingKeys.push(key);
      }
    }

    // Find extra keys (in this locale but not in reference)
    for (const key of localeKeys) {
      if (!referenceKeys.has(key)) {
        extraKeys.push(key);
      }
    }

    localeAudits.push({
      locale,
      keyCount: localeKeys.size,
      missingKeys,
      extraKeys,
    });
  }

  return {
    app: appName,
    referenceLocale,
    referenceKeyCount: referenceKeys.size,
    locales: localeAudits,
  };
}

/**
 * Prints the audit report
 */
function printReport(results: AuditResult[]): void {
  console.log(colors.bold("\n" + "═".repeat(60)));
  console.log(colors.bold("📊 i18n Audit Report"));
  console.log("═".repeat(60));

  let totalIssues = 0;

  for (const result of results) {
    console.log(colors.bold(`\n🏠 ${result.app}`));
    console.log(
      colors.gray(
        `   Reference: ${result.referenceLocale} (${result.referenceKeyCount} keys)`,
      ),
    );

    const tableData: string[][] = [];
    tableData.push(["Locale", "Keys", "Missing", "Extra", "Status"]);

    for (const locale of result.locales) {
      const status =
        locale.missingKeys.length === 0 && locale.extraKeys.length === 0
          ? colors.green("✓ Complete")
          : colors.red(`✗ ${locale.missingKeys.length} missing`);

      tableData.push([
        locale.locale,
        locale.keyCount.toString(),
        locale.missingKeys.length.toString(),
        locale.extraKeys.length.toString(),
        status,
      ]);

      if (locale.missingKeys.length > 0) {
        totalIssues += locale.missingKeys.length;
      }
    }

    // Print simple table
    console.log("\n   " + "-".repeat(70));
    for (let i = 0; i < tableData.length; i++) {
      const row = tableData[i];
      const formatted = `   ${row[0].padEnd(12)} ${row[1].padStart(6)} ${row[2].padStart(8)} ${row[3].padStart(6)}  ${row[4]}`;
      console.log(formatted);
      if (i === 0) {
        console.log("   " + "-".repeat(70));
      }
    }

    // Print missing keys details
    for (const locale of result.locales) {
      if (locale.missingKeys.length > 0) {
        console.log(
          colors.yellow(`\n   ⚠️  Missing keys in ${locale.locale}:`),
        );
        // Group by section for readability
        const sections = new Map<string, string[]>();
        for (const key of locale.missingKeys) {
          const section = key.split(".").slice(0, 2).join(".");
          if (!sections.has(section)) {
            sections.set(section, []);
          }
          sections.get(section)!.push(key);
        }

        for (const [section, keys] of sections) {
          console.log(colors.gray(`      ${section}:`));
          for (const key of keys.slice(0, 5)) {
            console.log(colors.gray(`        - ${key}`));
          }
          if (keys.length > 5) {
            console.log(colors.gray(`        ... and ${keys.length - 5} more`));
          }
        }
      }

      if (locale.extraKeys.length > 0) {
        console.log(
          colors.blue(
            `\n   ℹ️  Extra keys in ${locale.locale} (not in reference):`,
          ),
        );
        for (const key of locale.extraKeys.slice(0, 10)) {
          console.log(colors.gray(`      - ${key}`));
        }
        if (locale.extraKeys.length > 10) {
          console.log(
            colors.gray(`      ... and ${locale.extraKeys.length - 10} more`),
          );
        }
      }
    }
  }

  console.log(colors.bold("\n" + "═".repeat(60)));
  if (totalIssues === 0) {
    console.log(colors.green("✅ All translations are complete!"));
  } else {
    console.log(
      colors.yellow(
        `⚠️  Total issues found: ${totalIssues} missing translation keys`,
      ),
    );
  }
  console.log("═".repeat(60) + "\n");
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  console.log(colors.bold("🌐 MakanMakan i18n Audit Tool"));
  console.log(colors.gray("Comparing translation files across languages...\n"));

  const args = process.argv.slice(2);
  const targetApp = args[0];

  const appsDir = join(process.cwd(), "apps");
  const appDirs = readdirSync(appsDir).filter((dir) => {
    if (targetApp && dir !== targetApp) return false;
    return existsSync(join(appsDir, dir, "src", "i18n"));
  });

  if (appDirs.length === 0) {
    console.log(colors.yellow("No apps with i18n directories found."));
    process.exit(1);
  }

  const results: AuditResult[] = [];

  for (const appDir of appDirs) {
    const result = await auditApp(join(appsDir, appDir));
    if (result) {
      results.push(result);
    }
  }

  if (results.length > 0) {
    printReport(results);
  }
}

main().catch((error) => {
  console.error(colors.red(`Fatal error: ${error}`));
  process.exit(1);
});
