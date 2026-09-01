#!/usr/bin/env node
/**
 * Fails when a colour outside the design system reaches app source.
 *
 * The product had drifted to 3,717 Tailwind colour classes across five apps,
 * including 337 in hues the design system does not contain at all (purple,
 * indigo, violet, fuchsia, pink). Those are the recognisable signature of
 * generated UI, and DESIGN.md now says so explicitly. This guard is what keeps
 * them from coming back one component at a time.
 *
 * What it does NOT check: `bg-blue-500` and friends are fine, because
 * design-tokens.js re-points Tailwind's stock hues at the iOS ramps — the class
 * name is allowed precisely because it can no longer render an off-brand
 * colour. The guard only looks for the hues with no home in the system, and for
 * raw hex values that duplicate a token instead of using it.
 *
 * Run: node scripts/check-design-palette.cjs
 */

const { execFileSync } = require("node:child_process");
const path = require("node:path");

const ROOTS = [
  "apps/admin-dashboard/src",
  "apps/customer-app/src",
  "apps/kitchen-display/src",
  "apps/management-portal/src",
  "apps/onboarding-app/src",
];

/** Hues DESIGN.md does not contain. Not aliased — removed. */
const BANNED_HUES = ["indigo", "violet", "purple", "fuchsia", "pink", "rose"];

/**
 * Raw hex values that duplicate a token. Keyed by the offending value, valued
 * by what to use instead. Tailwind's stock hexes are the common case: someone
 * copies `#3b82f6` out of a snippet and the screen gains a second blue.
 */
const BANNED_HEX = {
  "#3b82f6": "#007AFF (ios-blue) or the blue-500 class",
  "#2563eb_ALLOWED": null, // documented customer-accent — not banned
  "#ef4444": "#FF3B30 (ios-red) or the red-500 class",
  "#10b981": "#34C759 (ios-green) or the green-500 class",
  "#22c55e": "#34C759 (ios-green) or the green-500 class",
  "#f59e0b": "#FF9500 (ios-orange) or the orange-500 class",
  "#8b5cf6": "a palette hue — there is no purple in this system",
  "#a855f7": "a palette hue — there is no purple in this system",
  "#ec4899": "a palette hue — there is no pink in this system",
  "#6366f1": "a palette hue — there is no indigo in this system",
  "#06b6d4": "#30B0C7 (ios-teal) or the teal-500 class",
};

/** Gradients belong to transient overlays, never operational layouts. */
const AI_GRADIENT = /linear-gradient\([^)]*#(667eea|764ba2|f093fb|f5576c)/i;

function grep(pattern) {
  try {
    return execFileSync("grep", ["-rniE", "--", pattern, ...ROOTS], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    })
      .split("\n")
      .filter(Boolean);
  } catch (error) {
    // grep exits 1 when there are no matches, which is the passing case.
    if (error.status === 1) return [];
    throw error;
  }
}

const failures = [];

// 1. Tailwind classes in a banned hue, including directional utilities
//    (border-l-purple-500) and arbitrary variants (hover:, dark:, focus:).
const hueClassPattern = `[a-z-]+-(${BANNED_HUES.join("|")})-[0-9]{2,3}`;
for (const line of grep(hueClassPattern)) {
  failures.push({
    line,
    why: "colour class in a hue the design system does not have",
  });
}

// 2. Raw hex duplicates of a token.
const bannedHexEntries = Object.entries(BANNED_HEX).filter(([, v]) => v);
for (const [hex, suggestion] of bannedHexEntries) {
  for (const line of grep(hex)) {
    failures.push({ line, why: `raw ${hex} — use ${suggestion}` });
  }
}

// 3. The specific gradient pair that shipped across five components.
for (const line of grep("linear-gradient")) {
  if (AI_GRADIENT.test(line)) {
    failures.push({
      line,
      why: "decorative gradient in an operational layout",
    });
  }
}

if (failures.length === 0) {
  console.log(
    "[check-design-palette] OK: no off-palette colours in app source.",
  );
  process.exit(0);
}

console.error(
  `\n[check-design-palette] ${failures.length} off-palette colour(s) found.\n`,
);
for (const { line, why } of failures.slice(0, 40)) {
  const [file, lineNo, ...rest] = line.split(":");
  const snippet = rest.join(":").trim().slice(0, 100);
  console.error(`  ${path.relative(process.cwd(), file)}:${lineNo}`);
  console.error(`    ${why}`);
  console.error(`    ${snippet}\n`);
}
if (failures.length > 40) {
  console.error(`  ...and ${failures.length - 40} more.\n`);
}
console.error(
  "The palette is the five iOS hues in DESIGN.md, defined once in\n" +
    "design-tokens.js. Tailwind's stock blue/green/orange/red/teal (and the\n" +
    "amber/emerald/sky/cyan/yellow aliases) already resolve to it, so\n" +
    "`bg-green-100` is correct and needs no change. For charts use\n" +
    "CHART_SERIES_COLORS from @makanmasak/shared/utils/chart-palette.\n",
);
process.exit(1);
