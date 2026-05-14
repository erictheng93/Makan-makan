#!/usr/bin/env node
// Blocks production deploys while production Cloudflare resource placeholders
// are still present in Wrangler configuration.

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const APPS_DIR = path.join(ROOT, "apps");
const PLACEHOLDER = "REPLACE_ME__PRODUCTION__";
const BINDING_TABLES = new Map([
  ["d1_databases", "binding"],
  ["kv_namespaces", "binding"],
  ["r2_buckets", "binding"],
  ["analytics_engine_datasets", "binding"],
  ["durable_objects.bindings", "name"],
]);

function walk(dir, hits) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, hits);
    } else if (entry.name === "wrangler.toml") {
      hits.push(fullPath);
    }
  }
}

const wranglerFiles = [];
walk(APPS_DIR, wranglerFiles);

const violations = [];
for (const file of wranglerFiles) {
  const lines = fs.readFileSync(file, "utf-8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (line.includes(PLACEHOLDER)) {
      violations.push({
        file: path.relative(ROOT, file).split(path.sep).join("/"),
        line: index + 1,
        text: line.trim(),
      });
    }
  });

  const bindings = collectBindings(lines);
  const productionBindings = bindings.production ?? new Set();
  const expectedBindings = new Set();

  for (const [envName, envBindings] of Object.entries(bindings)) {
    if (envName === "production") {
      continue;
    }

    for (const binding of envBindings) {
      expectedBindings.add(binding);
    }
  }

  for (const binding of expectedBindings) {
    if (!productionBindings.has(binding)) {
      violations.push({
        file: path.relative(ROOT, file).split(path.sep).join("/"),
        line: 1,
        text: `missing production binding: ${binding}`,
      });
    }
  }
}

function collectBindings(lines) {
  const envBindings = {};
  let sectionEnv = "default";
  let currentBinding = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) {
      continue;
    }

    const arrayTable = line.match(/^\[\[([^\]]+)\]\]$/);
    if (arrayTable) {
      const parsed = parseSection(arrayTable[1]);
      sectionEnv = parsed.env;
      currentBinding = parsed.bindingType;
      ensureEnv(envBindings, sectionEnv);
      continue;
    }

    const table = line.match(/^\[([^\]]+)\]$/);
    if (table) {
      const parsed = parseSection(table[1]);
      sectionEnv = parsed.env;
      currentBinding = parsed.bindingType;
      ensureEnv(envBindings, sectionEnv);
      continue;
    }

    if (currentBinding && BINDING_TABLES.has(currentBinding)) {
      const key = BINDING_TABLES.get(currentBinding);
      const value = readStringAssignment(line, key);
      if (value) {
        envBindings[sectionEnv].add(`${currentBinding}:${value}`);
      }
    }

    collectInlineDurableObjectBindings(
      envBindings,
      sectionEnv,
      currentBinding,
      line,
    );
  }

  return envBindings;
}

function parseSection(section) {
  const parts = section.split(".");
  if (parts[0] === "env") {
    return {
      env: parts[1],
      bindingType: parts.slice(2).join("."),
    };
  }

  return {
    env: "default",
    bindingType: parts.join("."),
  };
}

function ensureEnv(envBindings, envName) {
  if (!envBindings[envName]) {
    envBindings[envName] = new Set();
  }
}

function readStringAssignment(line, key) {
  const match = line.match(new RegExp(`^${key}\\s*=\\s*"([^"]+)"`));
  return match?.[1];
}

function collectInlineDurableObjectBindings(
  envBindings,
  envName,
  bindingType,
  line,
) {
  if (bindingType !== "durable_objects") {
    return;
  }

  const assignment = line.match(/^bindings\s*=\s*\[(.*)\]\s*$/);
  if (!assignment) {
    return;
  }

  ensureEnv(envBindings, envName);
  const names = assignment[1].matchAll(/name\s*=\s*"([^"]+)"/g);
  for (const name of names) {
    envBindings[envName].add(`durable_objects.bindings:${name[1]}`);
  }
}

if (violations.length > 0) {
  console.error("[check-production-config] Production deploy blocked.");
  console.error(
    "Replace all production Cloudflare resource placeholders before deploying.",
  );
  console.error("");

  for (const violation of violations) {
    console.error(
      `  ${violation.file}:${violation.line} ${violation.text}`,
    );
  }

  console.error("");
  console.error(
    "Create the production D1/KV/R2 resources, update apps/*/wrangler.toml,",
  );
  console.error("then rerun this check before deploy.");
  process.exit(1);
}

console.log(
  `[check-production-config] OK: checked ${wranglerFiles.length} wrangler.toml files.`,
);
