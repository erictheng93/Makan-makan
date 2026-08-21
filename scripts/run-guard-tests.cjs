#!/usr/bin/env node
/**
 * `pnpm test:ci-guards` -- runs the regression suite of every guard script
 * declared in scripts/guard-suites.txt.
 *
 * The suite list used to be spelled out a second time in package.json, next to
 * a separate list of the same scripts in classify-ci-changes.sh. Adding a guard
 * meant remembering both; four of them were only ever added to one, so their
 * suites sat out the PRs that changed them. Both consumers now read the file.
 *
 * A shell substitution in the package.json script would have avoided this file,
 * but pnpm runs scripts through cmd on Windows, where `$(...)` is not a thing.
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const MANIFEST = path.join(__dirname, "guard-suites.txt");

function guardSuites() {
  return fs
    .readFileSync(MANIFEST, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [script, suite] = line.split(/\s+/);
      return { script, suite };
    });
}

const suites = guardSuites();
const missing = suites.filter(
  (entry) => !entry.suite || !fs.existsSync(path.join(ROOT, entry.suite)),
);

if (missing.length > 0) {
  console.error("guard-suites.txt references suites that do not exist:\n");
  for (const entry of missing)
    console.error(`  - ${entry.script} -> ${entry.suite}`);
  process.exit(1);
}

const result = spawnSync(
  "pnpm",
  ["exec", "vitest", "run", ...suites.map((entry) => entry.suite)],
  { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" },
);

process.exit(result.status ?? 1);
