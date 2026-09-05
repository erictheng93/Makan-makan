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
 * The arbitrary-colour rule (#4) is the one that makes the rest hold. The first
 * two rules are denylists: they can only catch a value someone thought to list.
 * `bg-[#0066D6]` — a blue mixed by hand for a hover state — is on no list, so
 * for months nothing stopped it, and issue #319 counted 1,297 such classes on
 * 2026-09-02 and 1,498 three days later. The syntax is the problem rather than
 * any particular value: Tailwind compiles `bg-[#007AFF]` straight into CSS
 * without consulting `theme.colors`, so design-tokens.js has no say over it.
 * Retune `ios-blue` and every `bg-blue-500` follows while every `bg-[#007AFF]`
 * silently stays behind. Banning the syntax outright is what leaves exactly one
 * source of truth.
 *
 * Run: node scripts/check-design-palette.cjs
 */

const fs = require("node:fs");
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

/**
 * Tailwind's arbitrary-value syntax for a colour: `text-[#1C1C1E]`,
 * `hover:bg-[#0066D6]`, `border-t-[#E5E5EA]`. Matched case-insensitively, so
 * the hex class needs no upper-case half. Arbitrary *lengths* are untouched —
 * `text-[13px]` and `w-[calc(100%-2rem)]` are not colours and stay legal.
 */
const ARBITRARY_COLOUR_CLASS =
  "(text|bg|border|ring|from|to|via|fill|stroke|decoration|outline|accent|caret|divide|placeholder|shadow)(-[a-z]+)?-\\[#[0-9a-f][0-9a-f][0-9a-f]+\\]";

/**
 * Scan every file under ROOTS for `pattern`, returning grep's `file:line:text`
 * shape so the reporting below is unchanged.
 *
 * This used to shell out to `grep -rniE`, and on Windows that never worked. The
 * grep on PATH under Git Bash is an MSYS binary that re-parses its own command
 * line, and `execFileSync` passes an argument through unquoted when it contains
 * no space — so MSYS got to it first, twice over:
 *
 *   [0-9]{2,3}   brace-expanded into two arguments, `[0-9]2` and `[0-9]3`; grep
 *                read the second as a filename, exited 2, and this function
 *                rethrew, because only status 1 means "no matches"
 *   -\[#         had its backslashes stripped as escapes, so grep compiled
 *                `-[#[0-9a-f]…` — a bracket expression, matching nothing this
 *                rule is looking for, and reporting a clean pass
 *
 * The first failed loudly and the second silently, which is the worse of the
 * two. Reading the files here removes the argument-quoting layer entirely, so
 * there is no longer a platform on which the pattern that gets compiled differs
 * from the pattern written above.
 */
const SKIP_DIRS = new Set(["node_modules", "dist", "coverage", ".turbo"]);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(path.join(dir, entry.name));
    } else {
      yield path.join(dir, entry.name);
    }
  }
}

function grep(pattern) {
  const re = new RegExp(pattern, "i");
  const hits = [];
  for (const root of ROOTS) {
    if (!fs.existsSync(root)) continue;
    for (const file of walk(root)) {
      const text = fs.readFileSync(file, "utf8");
      // Same rule grep uses to leave binaries alone.
      if (text.includes("\0")) continue;
      text.split(/\r?\n/).forEach((line, i) => {
        if (re.test(line)) hits.push(`${file}:${i + 1}:${line}`);
      });
    }
  }
  return hits;
}

const failures = [];

// 1. Tailwind classes in a banned hue, including directional utilities
//    (border-l-purple-500) and arbitrary variants (hover:, dark:, focus:).
const hueClassPattern = `[a-z-]+-(${BANNED_HUES.join("|")})-[0-9][0-9][0-9]?`;
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

// 4. Tailwind arbitrary-colour classes (`bg-[#007AFF]`). Unlike rules 1 and 2
//    this is an allowlist by construction: no hex at all, so no new hand-mixed
//    shade can slip past for want of being on a list.
for (const line of grep(ARBITRARY_COLOUR_CLASS)) {
  failures.push({
    line,
    why: "arbitrary colour class — the hex bypasses design-tokens.js",
  });
}

// 5. The soft/deep pairs must actually clear the contrast they promise.
//    design-tokens.js says "`soft`/`deep` pairs all clear 4.5:1" and then lists
//    a ratio per hue. Those numbers were written by hand and two of them were
//    wrong — orange measured 4.45:1 and teal 4.36:1 against a documented 5.2
//    and 5.0. Nothing caught it because a comment cannot be run. This can: the
//    pairs are what every badge and stat tile puts text on, so the promise is
//    load-bearing and now fails the build when it stops being true.
const AA_NORMAL = 4.5;

function relativeLuminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a, b) {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  );
  return (hi + 0.05) / (lo + 0.05);
}

// Parsed rather than imported: this file is CommonJS and design-tokens.js is an
// ES module, so `require` cannot read it and the guard must stay synchronous.
const tokenSource = fs.readFileSync("design-tokens.js", "utf8");
const pairPattern =
  /"(ios-[a-z]+)":\s*\{\s*soft:\s*"(#[0-9A-Fa-f]{6})",[^}]*deep:\s*"(#[0-9A-Fa-f]{6})"/g;
let pairCount = 0;
for (const [, hue, soft, deep] of tokenSource.matchAll(pairPattern)) {
  pairCount++;
  const ratio = contrast(deep, soft);
  if (ratio < AA_NORMAL) {
    failures.push({
      line: `design-tokens.js:0:${hue} soft ${soft} / deep ${deep}`,
      why:
        `${hue}-deep on ${hue}-soft is ${ratio.toFixed(2)}:1, below the ` +
        `${AA_NORMAL}:1 the file promises — darken the deep value`,
    });
  }
}
if (pairCount !== 5) {
  failures.push({
    line: `design-tokens.js:0:matched ${pairCount} soft/deep pairs, expected 5`,
    why: "the contrast check stopped seeing the tokens it is meant to check",
  });
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
    "CHART_SERIES_COLORS from @makanmasak/shared/utils/chart-palette.\n" +
    "\n" +
    "Replacing an arbitrary colour class — every value below is a token, so\n" +
    "this is a rename, not a redesign:\n" +
    "  surfaces   bg-ios-bg (#F2F2F7)  bg-ios-card (#FFFFFF)\n" +
    "  text       text-ios-text (#1C1C1E)  text-ios-secondary (#8E8E93)\n" +
    "             text-ios-tertiary (#AEAEB2)\n" +
    "             in between? text-ios-text/85, /70, /60 — not a new grey\n" +
    "  lines      border-ios-separator (#E5E5EA)\n" +
    "  hue fill   bg-ios-blue | -green | -orange | -red | -teal\n" +
    "  hue tint   bg-ios-blue-soft   (badge and stat-tile backgrounds)\n" +
    "  hue ink    text-ios-blue-deep (text sitting on that tint, AA-checked)\n" +
    "  hover      the next ramp step: bg-ios-blue -> hover:bg-blue-600\n" +
    "A colour genuinely outside all of that belongs in design-tokens.js and\n" +
    "DESIGN.md first, not in a class string.\n",
);
process.exit(1);
