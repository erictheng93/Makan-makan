#!/usr/bin/env node
/**
 * Docs drift checker — keeps hardcoded numbers and the API surface in the docs
 * honest by deriving the source of truth from the codebase.
 *
 * Source of truth:
 *   - Feature modules:  apps/api/src/features/<dir> (a "module" = dir with index.ts)
 *   - API route groups: active `apiV1.route("/prefix", ...)` mounts in
 *                        apps/api/src/app-factory.ts
 *
 * It validates / regenerates three things:
 *   1. The feature-directory + module counts wrapped in <!-- gen:* --> markers
 *      in README.md and docs/architecture/README.md.
 *   2. A generated mount-index table in docs/api/README.md (between markers).
 *   3. That every `### Foo (`/prefix`)` section heading in docs/api/README.md
 *      maps to a real mount prefix, and every mount has a documented section.
 *
 * Usage:
 *   node scripts/check-docs-drift.cjs            # check only, exit 1 on drift
 *   node scripts/check-docs-drift.cjs --check    # same as default
 *   node scripts/check-docs-drift.cjs --write    # rewrite generated blocks
 *
 * NOTE: per-section route counts (e.g. "Authentication — 18 routes") are NOT
 * checked. Feature route files use heterogeneous registration patterns, so a
 * reliable count needs runtime Hono router introspection rather than a static
 * scan. Those numbers stay hand-maintained.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const FEATURES_DIR = path.join(ROOT, "apps/api/src/features");
const APP_FACTORY = path.join(ROOT, "apps/api/src/app-factory.ts");
const README = path.join(ROOT, "README.md");
const ARCH_README = path.join(ROOT, "docs/architecture/README.md");
const API_README = path.join(ROOT, "docs/api/README.md");

const WRITE = process.argv.includes("--write");

// ---------------------------------------------------------------------------
// Derive source-of-truth values
// ---------------------------------------------------------------------------

/** All feature subdirectories (excludes files like .gitkeep). */
function featureDirs() {
  return fs
    .readdirSync(FEATURES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

/** Feature dirs that follow the mountable module pattern (export via index.ts). */
function moduleDirs() {
  return featureDirs().filter((name) =>
    fs.existsSync(path.join(FEATURES_DIR, name, "index.ts")),
  );
}

/**
 * Active `apiV1.route("/prefix", router)` mounts in app-factory.ts.
 * Commented-out lines are ignored. Returns [{ prefix, router, note }].
 */
function routeMounts() {
  const src = fs.readFileSync(APP_FACTORY, "utf8");
  const mounts = [];
  for (const rawLine of src.split("\n")) {
    const line = rawLine.trim();
    if (line.startsWith("//")) continue;
    const m = line.match(
      /apiV1\.route\(\s*"([^"]+)"\s*,\s*([A-Za-z0-9_.]+)\s*\)/,
    );
    if (!m) continue;
    const noteMatch = rawLine.match(/\/\/\s*(.+)$/);
    mounts.push({
      prefix: m[1],
      router: m[2],
      note: noteMatch ? noteMatch[1].trim() : "",
    });
  }
  return mounts;
}

// ---------------------------------------------------------------------------
// Marker helpers
// ---------------------------------------------------------------------------

/** Replace inline `<!-- gen:KEY -->VALUE<!-- /gen -->` content. */
function replaceInlineMarker(text, key, value) {
  const re = new RegExp(
    `(<!--\\s*gen:${key}\\s*-->)([\\s\\S]*?)(<!--\\s*/gen\\s*-->)`,
    "g",
  );
  if (!re.test(text)) return { text, found: false, drift: false };
  let drift = false;
  const out = text.replace(re, (_full, open, current, close) => {
    if (current !== String(value)) drift = true;
    return `${open}${value}${close}`;
  });
  return { text: out, found: true, drift };
}

/** Replace a block between `<!-- BEGIN GENERATED:KEY ... -->` / `<!-- END GENERATED:KEY -->`. */
function replaceBlockMarker(text, key, blockBody) {
  const re = new RegExp(
    `(<!--\\s*BEGIN GENERATED:${key}[^>]*-->)([\\s\\S]*?)(<!--\\s*END GENERATED:${key}\\s*-->)`,
    "g",
  );
  if (!re.test(text)) return { text, found: false, drift: false };
  let drift = false;
  const desired = `\n${blockBody}\n`;
  const out = text.replace(re, (_full, open, current, close) => {
    if (current !== desired) drift = true;
    return `${open}${desired}${close}`;
  });
  return { text: out, found: true, drift };
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

function mountIndexTable(mounts) {
  const rows = mounts
    .map((m) => {
      const note = m.note ? m.note.replace(/\|/g, "\\|") : "";
      return `| \`${m.prefix}\` | \`${m.router}\` | ${note} |`;
    })
    .join("\n");
  return [
    "> 自動生成，請勿手動編輯。執行 `node scripts/check-docs-drift.cjs --write` 重新生成。",
    "> Source of truth: `apps/api/src/app-factory.ts` 的 `apiV1.route(...)` 掛載點。",
    "",
    `共 **${mounts.length}** 個掛載點（全部相對於 \`/api/v1\`）。`,
    "",
    "| Prefix | Router | 說明 |",
    "| ------ | ------ | ---- |",
    rows,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

const problems = [];
const writes = new Map(); // path -> new content

function loadForWrite(file) {
  return writes.has(file) ? writes.get(file) : fs.readFileSync(file, "utf8");
}

function applyInline(file, key, value, label) {
  const before = loadForWrite(file);
  const { text, found, drift } = replaceInlineMarker(before, key, value);
  if (!found) {
    problems.push(
      `${rel(file)}: missing <!-- gen:${key} --> marker (${label})`,
    );
    return;
  }
  if (drift) {
    if (WRITE) writes.set(file, text);
    else
      problems.push(`${rel(file)}: ${label} out of date (expected ${value})`);
  }
}

function applyBlock(file, key, body, label) {
  const before = loadForWrite(file);
  const { text, found, drift } = replaceBlockMarker(before, key, body);
  if (!found) {
    problems.push(
      `${rel(file)}: missing <!-- BEGIN GENERATED:${key} --> block (${label})`,
    );
    return;
  }
  if (drift) {
    if (WRITE) writes.set(file, text);
    else problems.push(`${rel(file)}: ${label} block out of date`);
  }
}

function rel(p) {
  return path.relative(ROOT, p);
}

function checkApiPrefixCoverage(mounts) {
  const api = fs.readFileSync(API_README, "utf8");
  const documented = new Set();
  const re = /^###\s+.*\(`(\/[^`]+)`\)/gm;
  let m;
  while ((m = re.exec(api)) !== null) documented.add(m[1]);

  const mounted = new Set(mounts.map((x) => x.prefix));

  for (const prefix of mounted) {
    if (!documented.has(prefix)) {
      problems.push(
        `${rel(API_README)}: mount "${prefix}" has no documented "### ... (\`${prefix}\`)" section`,
      );
    }
  }
  for (const prefix of documented) {
    if (!mounted.has(prefix)) {
      problems.push(
        `${rel(API_README)}: documented section "\`${prefix}\`" is not an active mount in app-factory.ts`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const dirs = featureDirs();
const mods = moduleDirs();
const mounts = routeMounts();

applyInline(README, "moduleCount", mods.length, "feature module count");
applyInline(README, "routeGroups", mounts.length, "route group count");
applyInline(ARCH_README, "featureDirs", dirs.length, "feature directory count");
applyInline(ARCH_README, "moduleCount", mods.length, "index.ts module count");
applyBlock(
  API_README,
  "api-surface",
  mountIndexTable(mounts),
  "API mount index",
);

checkApiPrefixCoverage(mounts);

if (WRITE) {
  for (const [file, content] of writes) {
    fs.writeFileSync(file, content);
    console.log(`updated ${rel(file)}`);
  }
  console.log(
    `\nderived: ${dirs.length} feature dirs, ${mods.length} modules (index.ts), ${mounts.length} route mounts`,
  );
  if (problems.length) {
    console.error("\nremaining problems that --write cannot fix:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  process.exit(0);
}

// check mode
console.log(
  `derived: ${dirs.length} feature dirs, ${mods.length} modules (index.ts), ${mounts.length} route mounts`,
);
if (problems.length) {
  console.error(`\ndocs drift detected (${problems.length}):`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error("\nrun: node scripts/check-docs-drift.cjs --write");
  process.exit(1);
}
console.log("docs in sync ✓");
process.exit(0);
