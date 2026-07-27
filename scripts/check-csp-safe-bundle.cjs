#!/usr/bin/env node
// Fails a production build whose JS bundle can still reach a runtime
// string-to-code compiler.
//
// The Cloudflare Pages CSP for the customer app and the admin dashboard ships
// `script-src 'self'` with no `unsafe-eval`. Anything that survives bundling as
// `new Function(...)` or `eval(...)` therefore throws at runtime, and because
// Vue Router swallows guard errors that surfaces as a blank page rather than as
// a crash (#60).
//
// Config-level assertions cannot catch this: the bundler flag that removes the
// Vue I18n eval path only takes effect in the emitted chunks, so the emitted
// chunks are what gets checked.
//
// Usage: node scripts/check-csp-safe-bundle.cjs <dist-dir> [<dist-dir> ...]

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_ROOT = path.resolve(__dirname, "..");

const DEFAULT_DIST_DIRS = [
  "apps/customer-app/dist",
  "apps/admin-dashboard/dist",
];

const FORBIDDEN_PATTERNS = [
  {
    name: "new Function(...)",
    // `new Function` and `new (Function)`, with or without whitespace.
    pattern: /new\s+Function\s*\(/g,
  },
  {
    name: "eval(...)",
    // Bare `eval(` only. Member calls like `safeEval(` or `.eval(` are not the
    // CSP-blocked direct eval.
    pattern: /(^|[^.\w$])eval\s*\(/g,
  },
];

function collectJsFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectJsFiles(full, files);
    } else if (entry.isFile() && full.endsWith(".js")) {
      files.push(full);
    }
  }
  return files;
}

function describeHit(source, index) {
  const line = source.slice(0, index).split("\n").length;
  const start = Math.max(0, index - 60);
  const excerpt = source
    .slice(start, index + 60)
    .replace(/\s+/g, " ")
    .trim();
  return { line, excerpt };
}

function checkDist(distDir, root = DEFAULT_ROOT) {
  const absolute = path.resolve(root, distDir);
  const violations = [];

  if (!fs.existsSync(absolute)) {
    return {
      distDir,
      missing: true,
      checkedFiles: 0,
      violations: [],
    };
  }

  const files = collectJsFiles(absolute);

  for (const file of files) {
    const source = fs.readFileSync(file, "utf-8");

    for (const { name, pattern } of FORBIDDEN_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(source)) !== null) {
        const { line, excerpt } = describeHit(source, match.index);
        violations.push({
          file: path.relative(root, file),
          line,
          pattern: name,
          excerpt,
        });
      }
    }
  }

  return { distDir, missing: false, checkedFiles: files.length, violations };
}

function printResult(results) {
  let ok = true;

  for (const result of results) {
    if (result.missing) {
      console.error(
        `[check-csp-safe-bundle] ${result.distDir} does not exist — build the app before running this check.`,
      );
      ok = false;
      continue;
    }

    if (result.checkedFiles === 0) {
      console.error(
        `[check-csp-safe-bundle] ${result.distDir} contains no .js files — the build did not emit a bundle.`,
      );
      ok = false;
      continue;
    }

    if (result.violations.length > 0) {
      console.error(
        `[check-csp-safe-bundle] ${result.distDir} still reaches a runtime code compiler, which the production CSP blocks.`,
      );
      console.error("");
      for (const violation of result.violations) {
        console.error(
          `  ${violation.file}:${violation.line} ${violation.pattern}`,
        );
        console.error(`    …${violation.excerpt}…`);
      }
      console.error("");
      console.error(
        "  If this is Vue I18n, set __INTLIFY_JIT_COMPILATION__: true in the app's vite define block.",
      );
      ok = false;
      continue;
    }

    console.log(
      `[check-csp-safe-bundle] OK: ${result.distDir} (${result.checkedFiles} files, no eval path).`,
    );
  }

  return ok;
}

function main() {
  const targets = process.argv.slice(2);
  // Explicit paths come from an app's own build script, so they are relative to
  // that app. The defaults are repo-relative.
  const root = targets.length > 0 ? process.cwd() : DEFAULT_ROOT;
  const distDirs = targets.length > 0 ? targets : DEFAULT_DIST_DIRS;
  const results = distDirs.map((dir) => checkDist(dir, root));

  if (!printResult(results)) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { checkDist, collectJsFiles, FORBIDDEN_PATTERNS };
