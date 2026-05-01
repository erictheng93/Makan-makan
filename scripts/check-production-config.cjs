#!/usr/bin/env node
// Blocks production deploys while production Cloudflare resource placeholders
// are still present in Wrangler configuration.

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const APPS_DIR = path.join(ROOT, "apps");
const PLACEHOLDER = "REPLACE_ME__PRODUCTION__";

function walk(dir, hits) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, hits);
    } else if (entry.name === "wrangler.toml") {
      hits.push(fullPath);
    }
  }
}

const wranglerFiles = [];
walk(APPS_DIR, wranglerFiles);

const violations = [];
for (const file of wranglerFiles) {
  const lines = fs.readFileSync(file, "utf-8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (line.includes(PLACEHOLDER)) {
      violations.push({
        file: path.relative(ROOT, file).split(path.sep).join("/"),
        line: index + 1,
        text: line.trim(),
      });
    }
  });
}

if (violations.length > 0) {
  console.error("[check-production-config] Production deploy blocked.");
  console.error(
    "Replace all production Cloudflare resource placeholders before deploying.",
  );
  console.error("");

  for (const violation of violations) {
    console.error(
      `  ${violation.file}:${violation.line} ${violation.text}`,
    );
  }

  console.error("");
  console.error(
    "Create the production D1/KV/R2 resources, update apps/*/wrangler.toml,",
  );
  console.error("then rerun this check before deploy.");
  process.exit(1);
}

console.log(
  `[check-production-config] OK: checked ${wranglerFiles.length} wrangler.toml files.`,
);
