#!/usr/bin/env node

/**
 * Keeps destructive wrangler commands out of automation.
 *
 * Every command listed below asks for confirmation, and every one of them
 * answers it itself when stdin is not a terminal:
 *
 *   ? Are you sure you want to delete makanmasak-backup-scheduler-prod?
 *   🤖 Using fallback value in non-interactive context: yes
 *
 * Observed directly: the D1 pair during the 2026-07-30 restore drill, and
 * `wrangler delete` while decommissioning the backup scheduler. There is no
 * flag to invert that default, so the prompt is not a safety mechanism
 * anywhere a human is not watching -- a CI job, a package script, a git hook
 * or an agent wrapper will drop a production database or Worker with no gate
 * at all.
 *
 * The only reliable control is to keep these commands out of the automation
 * surfaces entirely and run them from an interactive shell. This gate is what
 * makes that a rule rather than a sentence in a runbook.
 *
 * See docs/runbooks/backup-restore-runbook.md.
 */

const fs = require("node:fs");
const path = require("node:path");

const GUARDED_COMMANDS = [
  {
    label: "wrangler d1 time-travel restore",
    pattern: /d1\s+time-travel\s+restore/,
  },
  { label: "wrangler d1 delete", pattern: /d1\s+delete(?![-\w])/ },
  // Deletes a Worker. Needs the "wrangler" prefix to stay anchored: a bare
  // /delete/ would match every other subcommand, and "wrangler d1 delete" must
  // keep reporting as the D1 entry above rather than as this one.
  { label: "wrangler delete", pattern: /wrangler\s+delete(?![-\w])/ },
];

/**
 * Directories walked in full, plus the package.json files whose `scripts`
 * section is inspected. Docs are deliberately not scanned: the runbook has to
 * be able to show the command it is documenting.
 */
const SCAN_DIRS = [".github/workflows", "scripts", ".husky"];
const SKIP_DIR_NAMES = new Set(["node_modules", "_"]);

/**
 * This file necessarily contains the strings it looks for, so it would report
 * itself. Skipped by name rather than by a cleverly split literal, which would
 * be harder to read than it is worth.
 */
const SELF = "check-no-automated-destructive-wrangler.cjs";

function walk(dir, files) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (SKIP_DIR_NAMES.has(entry.name)) continue;

    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (entry.name !== SELF) {
      files.push(full);
    }
  }
}

function packageJsonScriptSources(root) {
  const sources = [];
  const candidates = [path.join(root, "package.json")];

  for (const group of ["apps", "packages"]) {
    let entries;
    try {
      entries = fs.readdirSync(path.join(root, group), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        candidates.push(path.join(root, group, entry.name, "package.json"));
      }
    }
  }

  for (const file of candidates) {
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      continue;
    }
    // Only the scripts section: a dependency that merely happens to contain
    // one of these substrings is not an execution path.
    for (const [name, command] of Object.entries(parsed.scripts ?? {})) {
      if (typeof command === "string") {
        sources.push({ file, location: `scripts.${name}`, text: command });
      }
    }
  }

  return sources;
}

const SCRIPT_EXTENSIONS = new Set([
  ".js",
  ".cjs",
  ".mjs",
  ".ts",
  ".cts",
  ".mts",
]);

/**
 * Whether a whole line is a comment.
 *
 * A comment naming one of these commands cannot run one, and explaining why
 * they are banned is exactly what a reader needs at the ban site -- a gate that
 * fires on its own rationale is a gate people switch off. Only full-line
 * comments are recognised: deciding whether a trailing `#` opens a comment or
 * sits inside a quoted string needs a real lexer, and guessing wrong would
 * silently drop executable text.
 */
function isCommentLine(file, line) {
  const trimmed = line.trim();
  if (!trimmed) return false;

  if (SCRIPT_EXTENSIONS.has(path.extname(file))) {
    // Includes the continuation and closing lines of a block comment.
    return /^(\/\/|\/\*|\*)/.test(trimmed);
  }

  // Shell, YAML and extensionless hooks.
  return trimmed.startsWith("#");
}

function fileSources(root) {
  const files = [];
  for (const dir of SCAN_DIRS) {
    walk(path.join(root, dir), files);
  }

  return files.flatMap((file) => {
    let content;
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      return [];
    }

    const sources = [];
    const executable = [];

    content.split("\n").forEach((text, index) => {
      if (isCommentLine(file, text)) return;
      executable.push(text);
      sources.push({ file, location: `line ${index + 1}`, text });
    });

    // A YAML block scalar can wrap a command across lines, which per-line
    // matching would miss, so the executable lines are checked again joined
    // with whitespace collapsed.
    sources.push({
      file,
      location: "whole file",
      text: executable.join(" ").replace(/\s+/g, " "),
    });

    return sources;
  });
}

function checkNoAutomatedDestructiveWrangler({ root = process.cwd() } = {}) {
  const sources = [...fileSources(root), ...packageJsonScriptSources(root)];
  const violations = [];
  const seen = new Set();

  for (const source of sources) {
    for (const command of GUARDED_COMMANDS) {
      if (!command.pattern.test(source.text)) continue;

      const relative = path
        .relative(root, source.file)
        .split(path.sep)
        .join("/");
      // The whole-file pass re-finds what the line pass already reported.
      const key = `${relative}::${command.label}`;
      if (seen.has(key)) continue;
      seen.add(key);

      violations.push({
        file: relative,
        location: source.location,
        command: command.label,
      });
    }
  }

  return { violations };
}

module.exports = { checkNoAutomatedDestructiveWrangler, GUARDED_COMMANDS };

if (require.main === module) {
  const { violations } = checkNoAutomatedDestructiveWrangler();

  if (violations.length > 0) {
    console.error(
      "[check-no-automated-destructive-wrangler] Destructive wrangler commands found in automation:",
    );
    for (const violation of violations) {
      console.error(
        `  ${violation.file} (${violation.location}): ${violation.command}`,
      );
    }
    console.error("");
    console.error(
      "These prompt for confirmation and answer themselves with 'yes' when",
    );
    console.error(
      "stdin is not a terminal, so automation runs them with no gate. Run them",
    );
    console.error(
      "from an interactive shell instead. See docs/runbooks/backup-restore-runbook.md.",
    );
    process.exit(1);
  }

  console.log(
    "[check-no-automated-destructive-wrangler] OK: no destructive wrangler commands in automation surfaces.",
  );
}
