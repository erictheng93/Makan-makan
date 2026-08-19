#!/usr/bin/env node

/**
 * STRICT table guard.
 *
 * D1 runs SQLite with flexible typing by default, so `INSERT INTO t (n)
 * VALUES ('not-a-number')` succeeds against an `INTEGER NOT NULL` column and
 * stores TEXT. `CREATE TABLE ... ) STRICT` turns that into SQLITE_CONSTRAINT.
 *
 * Two failure modes this guards against:
 *
 * 1. A new migration creates a table without STRICT.
 * 2. drizzle-kit silently *downgrades* an existing STRICT table. drizzle has
 *    no STRICT support, so its recreate-table strategy emits
 *
 *        CREATE TABLE `__new_orders` (...);        -- no STRICT
 *        INSERT INTO `__new_orders` SELECT ... FROM `orders`;
 *        DROP TABLE `orders`;
 *        ALTER TABLE `__new_orders` RENAME TO `orders`;
 *
 *    which drops the constraint with no diff that says so. That is why this
 *    guard tracks CREATE/DROP/RENAME as a state machine over the whole
 *    migration history rather than pattern-matching one statement at a time.
 *
 * Rule 1 only applies from a per-track checkpoint onwards (`enforceFrom` in
 * strict-table-policy.json) so the pre-existing history stays green. Rule 2
 * applies to every file, always — a downgrade is never intentional.
 */

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_CONFIG_PATH = "packages/database/strict-table-policy.json";

const CLOSING_QUOTE = { '"': '"', "`": "`", "'": "'", "[": "]" };

function migrationRank(filename) {
  const match = /^(\d+)[_-]/.exec(filename);
  return match ? Number(match[1]) : null;
}

function normalizeName(raw) {
  return raw.replace(/^["`[]|["`\]]$/g, "").toLowerCase();
}

/**
 * Return the index just past the `)` that closes the `(` at `openIndex`,
 * skipping over quoted identifiers and string literals. Returns -1 when the
 * parentheses are unbalanced.
 */
function findMatchingParen(sql, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < sql.length; i++) {
    const ch = sql[i];
    const closer = CLOSING_QUOTE[ch];
    if (closer) {
      const end = sql.indexOf(closer, i + 1);
      if (end === -1) return -1;
      i = end;
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")" && --depth === 0) return i + 1;
  }
  return -1;
}

const STATEMENT_RE =
  /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?("[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z0-9_]+)|\bALTER\s+TABLE\s+("[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z0-9_]+)\s+RENAME\s+TO\s+("[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z0-9_]+)|\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?("[^"]+"|`[^`]+`|\[[^\]]+\]|[A-Za-z0-9_]+)/gi;

/** Parse one migration file into ordered table events. */
function parseTableEvents(sql) {
  const events = [];
  STATEMENT_RE.lastIndex = 0;
  let match;
  while ((match = STATEMENT_RE.exec(sql)) !== null) {
    const [, created, renameFrom, renameTo, dropped] = match;
    if (created) {
      const open = sql.indexOf("(", match.index + match[0].length - 1);
      const close = open === -1 ? -1 : findMatchingParen(sql, open);
      // `CREATE TABLE x AS SELECT ...` has no column list and cannot be
      // STRICT; treat it as a non-STRICT create so rule 2 still fires.
      const tail =
        close === -1 ? "" : sql.slice(close, close + 80).split(";")[0];
      events.push({
        kind: "create",
        table: normalizeName(created),
        strict: /\bSTRICT\b/i.test(tail),
      });
    } else if (renameTo) {
      events.push({
        kind: "rename",
        table: normalizeName(renameFrom),
        to: normalizeName(renameTo),
      });
    } else if (dropped) {
      events.push({ kind: "drop", table: normalizeName(dropped) });
    }
  }
  return events;
}

function listSqlFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

function checkStrictTables(options = {}) {
  const root = options.root ?? process.cwd();
  const configPath = path.resolve(
    root,
    options.configPath ?? DEFAULT_CONFIG_PATH,
  );
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const exempt = new Set((config.exemptTables ?? []).map(normalizeName));
  const errors = [];
  let filesScanned = 0;
  let strictTables = 0;

  for (const track of config.tracks) {
    const dir = path.resolve(root, track.dir);
    // Table name -> whether it is currently declared STRICT.
    const state = new Map();
    // Names that have ever been STRICT. Deliberately survives DROP TABLE:
    // drizzle's recreate dance drops the original *before* renaming the
    // staging table over it, so current state alone cannot see the downgrade.
    const everStrict = new Set();

    for (const file of listSqlFiles(dir)) {
      filesScanned++;
      const rank = migrationRank(file);
      const enforced = rank !== null && rank >= track.enforceFrom;
      const sql = fs.readFileSync(path.join(dir, file), "utf8");

      for (const event of parseTableEvents(sql)) {
        const where = `${track.dir}/${file}`;
        if (event.kind === "drop") {
          state.delete(event.table);
          continue;
        }
        if (event.kind === "rename") {
          const strict = everStrict.has(event.table);
          if (everStrict.has(event.to) && !strict) {
            errors.push(
              `${where}: renaming ${event.table} to ${event.to} downgrades a STRICT table — ` +
                `add \`) STRICT\` to the CREATE TABLE for ${event.table}`,
            );
          }
          state.delete(event.table);
          state.set(event.to, strict);
          if (strict) everStrict.add(event.to);
          continue;
        }
        // create
        if (everStrict.has(event.table) && !event.strict) {
          errors.push(
            `${where}: ${event.table} was STRICT and is re-created without STRICT`,
          );
        }
        if (
          enforced &&
          !event.strict &&
          !exempt.has(event.table) &&
          !everStrict.has(event.table)
        ) {
          errors.push(
            `${where}: ${event.table} must be created with \`) STRICT\` ` +
              `(track checkpoint ${track.enforceFrom}); add it to exemptTables in ` +
              `${config.exemptTables ? DEFAULT_CONFIG_PATH : "the policy file"} with a reason if it genuinely cannot be`,
          );
        }
        state.set(event.table, event.strict);
        if (event.strict) everStrict.add(event.table);
      }
    }

    for (const strict of state.values()) if (strict) strictTables++;
  }

  return { ok: errors.length === 0, errors, filesScanned, strictTables };
}

if (require.main === module) {
  const result = checkStrictTables();
  if (!result.ok) {
    console.error("STRICT table guard failed:");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(
    `STRICT table guard passed (${result.filesScanned} migrations, ${result.strictTables} STRICT tables).`,
  );
}

module.exports = { checkStrictTables, parseTableEvents, migrationRank };
