#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const ALLOWLIST_PATH = path.join(ROOT, "tests/.integration-allowlist.json");
const SEARCH_ROOTS = ["apps", "packages"];

if (!fs.existsSync(ALLOWLIST_PATH)) {
  console.error(
    `[check-integration-allowlist] Allowlist not found at ${ALLOWLIST_PATH}`,
  );
  process.exit(2);
}

const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, "utf-8"));

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

    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, hits);
      continue;
    }

    if (/integration.*\.test\.[cm]?[jt]sx?$/.test(entry.name)) {
      hits.push(path.relative(ROOT, full).split(path.sep).join("/"));
    }
  }
}

function globToRegex(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function matchesAny(file, patterns = []) {
  return patterns.some((pattern) => globToRegex(pattern).test(file));
}

const found = [];
for (const searchRoot of SEARCH_ROOTS) {
  walk(path.join(ROOT, searchRoot), found);
}

const allowlistCategories = [
  allowlist.legacy_mockdrizzle,
  allowlist.component_flows,
  allowlist.module_integration,
  allowlist.inline_legacy_annotated,
];
const autoAllowedPattern = allowlist.real_auto_allowed_pattern;

const violations = found.sort().filter((file) => {
  if (autoAllowedPattern && globToRegex(autoAllowedPattern).test(file)) {
    return false;
  }

  return !allowlistCategories.some((category) => matchesAny(file, category));
});

if (violations.length > 0) {
  console.error("[check-integration-allowlist] Violations found:");
  for (const violation of violations) {
    console.error(`  ${violation}`);
  }
  console.error("");
  console.error("Options to fix:");
  console.error("  1. If this is a real integration test, rename it to match");
  console.error(
    "     apps/<app>/src/__tests__/integration/<name>.real.integration.test.ts",
  );
  console.error("     so it is auto-allowed by the canonical pattern.");
  console.error("  2. If this is a legacy mocked integration test, add it to");
  console.error(
    "     tests/.integration-allowlist.json with a clear category.",
  );
  process.exit(1);
}

console.log(
  `[check-integration-allowlist] OK: ${found.length} files all accounted for.`,
);
