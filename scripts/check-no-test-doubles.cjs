#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const thisScript = path.relative(root, __filename);
const scanRoots = ["apps", "packages", "tests", "scripts", "package.json"];

const excludedDirs = new Set([
  ".git",
  ".turbo",
  ".wrangler",
  "coverage",
  "dist",
  "node_modules",
  "security-reports",
]);

const excludedFiles = new Set([thisScript, "pnpm-lock.yaml"]);

const scannedExtensions = new Set([
  ".cjs",
  ".js",
  ".jsx",
  ".mjs",
  ".ts",
  ".tsx",
  ".vue",
  ".json",
  ".md",
  ".sql",
  ".yml",
  ".yaml",
]);

const words = [
  "mock",
  "mocked",
  "mocking",
  "fake",
  "fixture",
  "stub",
  "in-memory",
  "in_memory",
  "memory store",
  "page.route",
  "vi.mock",
  "vi.fn",
  "mockAllAPIs",
  "MOCK_DRIZZLE_DB",
  "test-fixture-signature",
  "X-Payment-Gateway-Fixture",
  "X-Integration-Fixture",
  "sse/broadcast",
];

const patterns = words.map((word) => ({
  word,
  regex: new RegExp(escapeRegExp(word), "i"),
}));

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shouldScan(relativePath) {
  if (excludedFiles.has(relativePath)) return false;
  const parts = relativePath.split(path.sep);
  if (parts.some((part) => excludedDirs.has(part))) return false;
  return scannedExtensions.has(path.extname(relativePath));
}

function walk(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    const relative = path.relative(root, absolute);

    if (entry.isDirectory()) {
      if (!excludedDirs.has(entry.name)) walk(absolute, results);
      continue;
    }

    if (entry.isFile() && shouldScan(relative)) {
      results.push(relative);
    }
  }
  return results;
}

const violations = [];

const files = [];
for (const scanRoot of scanRoots) {
  const absolute = path.join(root, scanRoot);
  if (!fs.existsSync(absolute)) continue;
  const stat = fs.statSync(absolute);
  if (stat.isDirectory()) {
    walk(absolute, files);
  } else if (stat.isFile() && shouldScan(scanRoot)) {
    files.push(scanRoot);
  }
}

for (const file of files) {
  const content = fs.readFileSync(path.join(root, file), "utf8");
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const { word, regex } of patterns) {
      if (regex.test(line)) {
        violations.push({
          file,
          line: index + 1,
          word,
          text: line.trim(),
        });
      }
    }
  });
}

if (violations.length > 0) {
  console.error("[check-no-test-doubles] Violations found:");
  for (const violation of violations) {
    console.error(
      `${violation.file}:${violation.line} ${violation.word} ${violation.text}`,
    );
  }
  process.exit(1);
}

console.log(
  "[check-no-test-doubles] OK: no test doubles or API interception found.",
);
