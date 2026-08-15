#!/usr/bin/env node
/**
 * Keeps `turbo run test` executable and cacheable per package.
 *
 * Four ways a package falls out of the per-package test run, all of which have
 * actually happened in this repo:
 *
 *  1. `"test": "vitest"` is watch mode. Under turbo it never exits, so the
 *     whole run hangs. Six packages shipped this way.
 *  2. A package with tests but no `vitest.config.*` of its own makes vitest
 *     walk up to the ROOT config, which then resolves its `projects` entries
 *     relative to the package. packages/database died with "Projects
 *     definition references a non-existing file or a directory:
 *     packages/database/apps/admin-dashboard".
 *  3. A package with test files but no `test` script is simply never run by
 *     turbo, so its suite rots unnoticed.
 *  4. A package with no test files yet exits 1 on "No test files found" under
 *     plain `vitest run`, reddening the whole run (packages/queue-service).
 *
 * Run standalone: node scripts/check-package-test-scripts.cjs
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// Mirrors pnpm-workspace.yaml.
const WORKSPACE_GLOBS = ["apps", "packages"];
const EXTRA_PACKAGES = ["packages/shared/src/i18n"];

const TEST_FILE_RE = /\.(test|spec)\.(c|m)?[jt]sx?$/;
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".turbo",
  ".wrangler",
  "coverage",
  "legacy",
  "Backup",
  "e2e",
]);

function listPackages() {
  const dirs = [];
  for (const glob of WORKSPACE_GLOBS) {
    const base = path.join(ROOT, glob);
    if (!fs.existsSync(base)) continue;
    for (const name of fs.readdirSync(base)) {
      const dir = path.join(base, name);
      if (fs.existsSync(path.join(dir, "package.json"))) dirs.push(dir);
    }
  }
  for (const rel of EXTRA_PACKAGES) {
    const dir = path.join(ROOT, rel);
    if (fs.existsSync(path.join(dir, "package.json"))) dirs.push(dir);
  }
  return dirs;
}

// Nested workspace packages own their own files; don't attribute them to the
// parent (packages/shared/src/i18n would otherwise count as packages/shared).
function hasTestFiles(dir, nested) {
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        if (nested.some((n) => n === full)) continue;
        stack.push(full);
      } else if (TEST_FILE_RE.test(entry.name)) {
        return true;
      }
    }
  }
  return false;
}

const hasOwnVitestConfig = (dir) =>
  fs.readdirSync(dir).some((f) => /^vitest\.config\.(c|m)?[jt]s$/.test(f));

// A single-shot invocation. `vitest run`, `vitest --run` and an explicit
// `--watch=false` all terminate; a bare `vitest` does not.
const isSingleShot = (script) =>
  /(^|\s)run(\s|$)/.test(script) ||
  /--run(\s|$|=)/.test(script) ||
  /--watch[= ]false/.test(script);

const invokesVitest = (script) => /(^|\s|\/)vitest(\s|$)/.test(script);

const problems = [];
const packages = listPackages();
const nested = EXTRA_PACKAGES.map((rel) => path.join(ROOT, rel));

for (const dir of packages) {
  const rel = path.relative(ROOT, dir);
  const pkg = JSON.parse(
    fs.readFileSync(path.join(dir, "package.json"), "utf8"),
  );
  const script = (pkg.scripts || {}).test;
  const tests = hasTestFiles(dir, nested);

  if (!script) {
    if (tests) {
      problems.push(
        `${rel}: has test files but no "test" script, so \`turbo run test\` never runs them.\n` +
          `    Add:  "test": "vitest run"`,
      );
    }
    continue;
  }

  if (!isSingleShot(script)) {
    problems.push(
      `${rel}: "test" is watch mode (${script}) and will hang \`turbo run test\`.\n` +
        `    Use:  "test": "vitest run"   (keep watch mode under "test:watch")`,
    );
  }

  // An explicit --config/--root means the package has deliberately pointed
  // vitest somewhere; only implicit resolution hits the root-config trap.
  const pointsElsewhere = /--config(\s|=)|--root(\s|=)/.test(script);
  if (
    invokesVitest(script) &&
    !pointsElsewhere &&
    !hasOwnVitestConfig(dir) &&
    tests
  ) {
    problems.push(
      `${rel}: has tests and runs vitest, but owns no vitest.config.*\n` +
        `    vitest will walk up to the root config and resolve its \`projects\`\n` +
        `    entries relative to ${rel}, failing with "Projects definition\n` +
        `    references a non-existing file or a directory". Add a local config.`,
    );
  }

  if (invokesVitest(script) && !tests && !/--passWithNoTests/.test(script)) {
    problems.push(
      `${rel}: has no test files, and plain \`vitest run\` exits 1 on\n` +
        `    "No test files found", reddening the whole run.\n` +
        `    Use:  "test": "vitest run --passWithNoTests"`,
    );
  }
}

if (problems.length === 0) {
  console.log(
    `✅ package test scripts OK (${packages.length} workspace packages checked)`,
  );
  process.exit(0);
}

console.error(`❌ ${problems.length} package test script problem(s):\n`);
for (const p of problems) console.error(`  - ${p}\n`);
process.exit(1);
