#!/usr/bin/env node
// Checks that every *integration*.test.ts file is either in the allowlist
// or matches the auto-allowed real-integration pattern.

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const ALLOWLIST_PATH = path.join(ROOT, "tests/.integration-allowlist.json");

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
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, hits);
    } else if (/integration.*\.test\.tsx?$/.test(entry.name)) {
      hits.push(path.relative(ROOT, full));
    }
  }
}

const found = [];
for (const topDir of ["apps", "packages"]) {
  walk(path.join(ROOT, topDir), found);
}

// Simple glob matcher: turns "apps/*/src/..." into a regex.
function globToRegex(glob) {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function matchesAny(file, patterns) {
  if (!patterns) return false;
  return patterns.some((p) => globToRegex(p).test(file));
}

const autoPattern = allowlist.real_auto_allowed_pattern;
const categories = [
  allowlist.legacy_mockdrizzle,
  allowlist.component_flows,
  allowlist.module_integration,
  allowlist.inline_legacy_annotated,
];

const violations = [];
for (const file of found) {
  const normalized = file.split(path.sep).join("/");
  if (autoPattern && globToRegex(autoPattern).test(normalized)) continue;
  if (categories.some((c) => matchesAny(normalized, c))) continue;
  violations.push(normalized);
}

if (violations.length > 0) {
  console.error("[check-integration-allowlist] Violations found:");
  for (const v of violations) console.error(`  ${v}`);
  console.error("");
  console.error("Options to fix:");
  console.error(
    "  1. If this is a real integration test, rename it to match",
  );
  console.error(
    "     apps/<app>/src/__tests__/integration/<name>.real.integration.test.ts",
  );
  console.error("     (auto-allowed by the canonical pattern).");
  console.error(
    "  2. If this is a legacy test with mocked services, add the exact path",
  );
  console.error(
    "     to tests/.integration-allowlist.json under 'inline_legacy_annotated'",
  );
  console.error(
    "     or the most specific category, and include a PR description explaining",
  );
  console.error("     why a new mocked test is necessary.");
  process.exit(1);
}

console.log(
  `[check-integration-allowlist] OK: ${found.length} files all accounted for.`,
);
