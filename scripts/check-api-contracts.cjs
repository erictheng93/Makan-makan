#!/usr/bin/env node

/**
 * API Contract Breaking Change Detection
 *
 * This script extracts the FIELD NAMES of all response contract schemas and
 * compares them against a stored snapshot. A field added or removed is flagged
 * as a potential breaking change.
 *
 * What it does NOT detect: a field's type changing. The snapshot stores each
 * schema as a bare array of names, so `createdAt` switching from an ISO string
 * to a Unix-millisecond number is a real wire-contract break that passes this
 * check silently. A rename is only ever seen as one removal plus one addition,
 * never as a rename. Extending the extractor to persist Zod types is filed in
 * docs/TODOS.md § "API contracts".
 *
 * Usage:
 *   node scripts/check-api-contracts.cjs              # Check for changes (CI mode)
 *   node scripts/check-api-contracts.cjs --update      # Update the snapshot
 *   node scripts/check-api-contracts.cjs --report      # Print current schema shapes
 *
 * How it works:
 *   1. Finds all Zod schemas exported from apps/api/src/contracts/schemas/*.ts
 *   2. Extracts their field names using static analysis
 *   3. Compares against .api-contracts-snapshot.json
 *   4. Reports additions and removals
 *
 * Exit codes:
 *   0 — No breaking changes detected (or --update/--report mode)
 *   1 — Breaking changes detected
 */

const fs = require("fs");
const path = require("path");

const SNAPSHOT_FILE = path.resolve(
  __dirname,
  "..",
  ".api-contracts-snapshot.json",
);
const CONTRACTS_DIR = path.resolve(
  __dirname,
  "..",
  "apps",
  "api",
  "src",
  "contracts",
  "schemas",
);

// ---------------------------------------------------------------------------
// Schema Shape Extraction (static analysis — no runtime Zod needed)
// ---------------------------------------------------------------------------

/**
 * Extract field names from contract schema files using regex.
 * We parse the TypeScript source to find z.object({ ... }) declarations
 * and extract the field names from them.
 */
function extractSchemasFromFile(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const fileName = path.basename(filePath, ".ts");
  const schemas = {};

  // Match exported const declarations that have z.object
  const exportRegex =
    /export\s+(?:const\s+)?(\w+(?:Schema|Response|Error))\s*=\s*/g;
  let match;

  while ((match = exportRegex.exec(content)) !== null) {
    const schemaName = match[1];
    const startIdx = match.index + match[0].length;
    const endIdx = findInitializerEnd(content, startIdx);

    // Find the matching closing brace/paren for this schema
    const fields = extractFieldsFromPosition(content, startIdx, endIdx);
    if (fields.length > 0) {
      schemas[schemaName] = fields.sort();
    }
  }

  // Also match exported arrays like AUTH_SENSITIVE_FIELDS
  const arrayRegex =
    /export\s+const\s+(\w+_SENSITIVE_FIELDS)\s*=\s*\[([^\]]+)\]/g;
  while ((match = arrayRegex.exec(content)) !== null) {
    const name = match[1];
    const items = match[2]
      .split(",")
      .map((s) => s.trim().replace(/['"]/g, ""))
      .filter(Boolean);
    schemas[name] = items.sort();
  }

  return { module: fileName, schemas };
}

/**
 * Extract top-level field names from a z.object() definition.
 */
function extractFieldsFromPosition(content, startIdx, endIdx = content.length) {
  const fields = [];

  // Find the first z.object({ after startIdx
  const objectStart = content.indexOf("z.object({", startIdx);
  if (objectStart === -1 || objectStart >= endIdx) {
    // Might be a simpler schema or chained call
    return extractFieldsFromChained(content, startIdx, endIdx);
  }

  const fieldsStart = objectStart + "z.object({".length;
  let depth = 1;
  let pos = fieldsStart;
  let fieldName = "";
  let inString = false;
  let stringChar = "";

  while (pos < content.length && depth > 0) {
    const char = content[pos];

    if (inString) {
      if (char === stringChar && content[pos - 1] !== "\\") {
        inString = false;
      }
      pos++;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      inString = true;
      stringChar = char;
      pos++;
      continue;
    }

    if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
    } else if (depth === 1 && char === ":" && fieldName) {
      fields.push(fieldName.trim());
      fieldName = "";
      // Skip to next comma or closing brace at depth 1
      pos++;
      continue;
    } else if (depth === 1 && (char === "," || char === "\n")) {
      fieldName = "";
    } else if (depth === 1 && /[a-zA-Z_$]/.test(char)) {
      fieldName += char;
    } else if (depth === 1 && /[0-9]/.test(char) && fieldName) {
      fieldName += char;
    }

    pos++;
  }

  return fields;
}

/**
 * Extract fields from chained helper calls like successEnvelope(schema)
 */
function extractFieldsFromChained(content, startIdx, endIdx = content.length) {
  // Check if it starts with a known helper
  const helpers = {
    successEnvelope: ["success", "data"],
    successWithMessage: ["success", "data", "message"],
    paginatedEnvelope: ["success", "data", "pagination", "meta"],
    messageOnlyResponse: ["success", "message"],
    errorEnvelope: ["success", "error"],
  };

  const snippet = content.substring(startIdx, endIdx);
  for (const [helper, fields] of Object.entries(helpers)) {
    if (snippet.trimStart().startsWith(helper)) {
      return fields;
    }
  }

  return [];
}

/**
 * Find the end of the current exported const initializer.
 */
function findInitializerEnd(content, startIdx) {
  let pos = startIdx;
  let parenDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  let inString = false;
  let stringChar = "";
  let inLineComment = false;
  let inBlockComment = false;

  while (pos < content.length) {
    const char = content[pos];
    const next = content[pos + 1];

    if (inLineComment) {
      if (char === "\n") inLineComment = false;
      pos++;
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        pos += 2;
        continue;
      }
      pos++;
      continue;
    }

    if (inString) {
      if (char === stringChar && content[pos - 1] !== "\\") {
        inString = false;
      }
      pos++;
      continue;
    }

    if (char === "/" && next === "/") {
      inLineComment = true;
      pos += 2;
      continue;
    }

    if (char === "/" && next === "*") {
      inBlockComment = true;
      pos += 2;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      inString = true;
      stringChar = char;
      pos++;
      continue;
    }

    if (char === "(") parenDepth++;
    else if (char === ")") parenDepth--;
    else if (char === "{") braceDepth++;
    else if (char === "}") braceDepth--;
    else if (char === "[") bracketDepth++;
    else if (char === "]") bracketDepth--;
    else if (
      char === ";" &&
      parenDepth === 0 &&
      braceDepth === 0 &&
      bracketDepth === 0
    ) {
      return pos;
    }

    pos++;
  }

  return content.length;
}

// ---------------------------------------------------------------------------
// Snapshot Management
// ---------------------------------------------------------------------------

function loadSnapshot() {
  if (!fs.existsSync(SNAPSHOT_FILE)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(SNAPSHOT_FILE, "utf-8"));
}

function saveSnapshot(data) {
  fs.writeFileSync(SNAPSHOT_FILE, JSON.stringify(data, null, 2) + "\n");
}

function buildCurrentSnapshot() {
  const snapshot = {};
  const files = fs
    .readdirSync(CONTRACTS_DIR)
    .filter((f) => f.endsWith(".ts") && f !== "index.ts")
    .sort();

  for (const file of files) {
    const filePath = path.join(CONTRACTS_DIR, file);
    const { module, schemas } = extractSchemasFromFile(filePath);
    if (Object.keys(schemas).length > 0) {
      snapshot[module] = schemas;
    }
  }

  return snapshot;
}

// ---------------------------------------------------------------------------
// Diff & Report
// ---------------------------------------------------------------------------

function diffSnapshots(previous, current) {
  const changes = {
    addedModules: [],
    removedModules: [],
    addedSchemas: [],
    removedSchemas: [],
    changedSchemas: [],
  };

  const prevModules = new Set(Object.keys(previous));
  const currModules = new Set(Object.keys(current));

  // Module-level changes
  for (const mod of currModules) {
    if (!prevModules.has(mod)) {
      changes.addedModules.push(mod);
    }
  }
  for (const mod of prevModules) {
    if (!currModules.has(mod)) {
      changes.removedModules.push(mod);
    }
  }

  // Schema-level changes within shared modules
  for (const mod of currModules) {
    if (!prevModules.has(mod)) continue;

    const prevSchemas = previous[mod] || {};
    const currSchemas = current[mod] || {};
    const prevNames = new Set(Object.keys(prevSchemas));
    const currNames = new Set(Object.keys(currSchemas));

    for (const name of currNames) {
      if (!prevNames.has(name)) {
        changes.addedSchemas.push(`${mod}.${name}`);
      }
    }
    for (const name of prevNames) {
      if (!currNames.has(name)) {
        changes.removedSchemas.push(`${mod}.${name}`);
      }
    }

    // Field-level changes within shared schemas
    for (const name of currNames) {
      if (!prevNames.has(name)) continue;

      const prevFields = prevSchemas[name] || [];
      const currFields = currSchemas[name] || [];
      const prevSet = new Set(prevFields);
      const currSet = new Set(currFields);

      const added = currFields.filter((f) => !prevSet.has(f));
      const removed = prevFields.filter((f) => !currSet.has(f));

      if (added.length > 0 || removed.length > 0) {
        changes.changedSchemas.push({
          schema: `${mod}.${name}`,
          addedFields: added,
          removedFields: removed,
        });
      }
    }
  }

  return changes;
}

function hasBreakingChanges(changes) {
  return (
    changes.removedModules.length > 0 ||
    changes.removedSchemas.length > 0 ||
    changes.changedSchemas.some((c) => c.removedFields.length > 0)
  );
}

function printReport(current) {
  console.log("\n API Contract Schema Report");
  console.log("=".repeat(60));

  let totalSchemas = 0;
  let totalFields = 0;

  for (const [mod, schemas] of Object.entries(current)) {
    const count = Object.keys(schemas).length;
    totalSchemas += count;
    console.log(`\n  ${mod} (${count} schemas)`);

    for (const [name, fields] of Object.entries(schemas)) {
      totalFields += fields.length;
      console.log(`  -- ${name}: [${fields.join(", ")}]`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(
    `Total: ${Object.keys(current).length} modules, ${totalSchemas} schemas, ${totalFields} fields`,
  );
}

function printDiff(changes) {
  const breaking = hasBreakingChanges(changes);
  const label = breaking ? "BREAKING CHANGES DETECTED" : "No breaking changes";

  console.log(`\n${label}`);
  console.log("=".repeat(60));

  if (changes.addedModules.length > 0) {
    console.log("\n[NEW] New modules:");
    changes.addedModules.forEach((m) => console.log(`  + ${m}`));
  }

  if (changes.removedModules.length > 0) {
    console.log("\n[BREAKING] REMOVED modules:");
    changes.removedModules.forEach((m) => console.log(`  - ${m}`));
  }

  if (changes.addedSchemas.length > 0) {
    console.log("\n[NEW] New schemas:");
    changes.addedSchemas.forEach((s) => console.log(`  + ${s}`));
  }

  if (changes.removedSchemas.length > 0) {
    console.log("\n[BREAKING] REMOVED schemas:");
    changes.removedSchemas.forEach((s) => console.log(`  - ${s}`));
  }

  if (changes.changedSchemas.length > 0) {
    console.log("\n[CHANGED] Changed schemas:");
    for (const c of changes.changedSchemas) {
      const isBreaking = c.removedFields.length > 0;
      const label = isBreaking ? "[BREAKING]" : "[NEW]";
      console.log(`  ${label} ${c.schema}`);
      c.addedFields.forEach((f) => console.log(`    + ${f} (new field)`));
      c.removedFields.forEach((f) =>
        console.log(`    - ${f} (REMOVED — BREAKING)`),
      );
    }
  }

  const noChanges =
    [
      ...changes.addedModules,
      ...changes.removedModules,
      ...changes.addedSchemas,
      ...changes.removedSchemas,
      ...changes.changedSchemas,
    ].length === 0;

  if (noChanges) {
    console.log("\nNo contract changes detected.");
  }

  console.log("");

  return breaking;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const mode = args.includes("--update")
  ? "update"
  : args.includes("--report")
    ? "report"
    : "check";

const current = buildCurrentSnapshot();

if (mode === "update") {
  saveSnapshot(current);
  console.log(`Snapshot updated: ${SNAPSHOT_FILE}`);
  printReport(current);
  process.exit(0);
}

if (mode === "report") {
  printReport(current);
  process.exit(0);
}

// Check mode
const previous = loadSnapshot();

if (!previous) {
  console.log("No snapshot found. Creating initial snapshot...");
  saveSnapshot(current);
  printReport(current);
  console.log(`\nInitial snapshot created: ${SNAPSHOT_FILE}`);
  console.log("   Future runs will detect changes against this baseline.");
  process.exit(0);
}

const changes = diffSnapshots(previous, current);
const breaking = printDiff(changes);

if (breaking) {
  console.log("Breaking changes detected! Review carefully before merging.");
  console.log(
    "   If intentional, run: node scripts/check-api-contracts.cjs --update",
  );
  process.exit(1);
}

process.exit(0);
