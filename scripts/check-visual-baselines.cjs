#!/usr/bin/env node
/**
 * check-visual-baselines.cjs
 *
 * Pre-commit guard for visual regression baselines.
 *
 * Rejects staged baseline screenshots that were generated on the wrong
 * platform. CI runs on Linux (ubuntu-latest inside the Playwright container),
 * so any *-darwin.png or *-win32.png baseline under tests/visual/ will
 * silently never match — leading back to the continue-on-error workaround
 * we just removed.
 *
 * If you need to regenerate baselines, run:
 *   ./scripts/update-visual-baselines.sh
 *
 * which produces *-linux.png inside a pinned Playwright Docker container.
 */

const { execFileSync } = require("node:child_process");

function getStagedFiles() {
  try {
    // execFileSync avoids shell interpretation; args are a fixed literal list.
    const out = execFileSync(
      "git",
      ["diff", "--cached", "--name-only", "--diff-filter=ACM"],
      { encoding: "utf8" },
    );
    return out.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

const WRONG_PLATFORM_RE = /^tests\/visual\/.*-(darwin|win32)\.png$/;

const offenders = getStagedFiles().filter((f) => WRONG_PLATFORM_RE.test(f));

if (offenders.length === 0) {
  process.exit(0);
}

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

console.error("");
console.error(red(bold("✗ Visual baseline platform check failed")));
console.error("");
console.error(
  `You are trying to commit ${offenders.length} baseline screenshot(s) generated on macOS or Windows:`,
);
console.error("");
for (const f of offenders) {
  console.error(`  ${yellow("•")} ${f}`);
}
console.error("");
console.error(
  "CI runs visual regression tests on Linux inside a pinned Playwright",
);
console.error(
  "Docker image. Non-Linux baselines will never match and will re-introduce",
);
console.error("the continue-on-error workaround.");
console.error("");
console.error(bold("Fix:"));
console.error(
  "  1. Unstage these files:  git restore --staged tests/visual/",
);
console.error(
  "  2. Delete them:          find tests/visual -name '*-darwin.png' -delete",
);
console.error(
  "  3. Regenerate on Linux:  ./scripts/update-visual-baselines.sh",
);
console.error("  4. Stage the *-linux.png baselines and commit again.");
console.error("");

process.exit(1);
