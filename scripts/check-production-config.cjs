#!/usr/bin/env node
// Blocks production deploys while production Cloudflare resources, runtime
// URLs, or required deployment secrets are missing or still point at local
// development targets.

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_ROOT = path.resolve(__dirname, "..");
const PLACEHOLDER = "REPLACE_ME__PRODUCTION__";
const BINDING_TABLES = new Map([
  ["d1_databases", "binding"],
  ["kv_namespaces", "binding"],
  ["r2_buckets", "binding"],
  ["analytics_engine_datasets", "binding"],
  ["durable_objects.bindings", "name"],
]);

const REQUIRED_PRODUCTION_RUNTIME_VARS = new Map([
  ["apps/api/wrangler.toml", ["API_BASE_URL", "CORS_ORIGIN"]],
  ["apps/management-portal/wrangler.toml", ["VITE_MANAGEMENT_API_URL"]],
  [
    "apps/onboarding-app/wrangler.toml",
    ["VITE_API_URL", "VITE_CUSTOMER_APP_URL"],
  ],
]);

const REQUIRED_DEPLOYMENT_SECRETS = new Map([
  ["apps/api/wrangler.toml", ["SLACK_WEBHOOK_URL"]],
]);

function checkProductionConfig(options = {}) {
  const root = path.resolve(options.root || DEFAULT_ROOT);
  const env = options.env || process.env;
  const requireDeploymentSecrets =
    options.requireDeploymentSecrets ??
    env.CHECK_PRODUCTION_CONFIG_REQUIRE_DEPLOYMENT_SECRETS !== "false";
  const appsDir = path.join(root, "apps");
  const wranglerFiles = [];
  walk(appsDir, wranglerFiles);

  const violations = [];
  for (const file of wranglerFiles) {
    const relativeFile = path.relative(root, file).split(path.sep).join("/");
    const lines = fs.readFileSync(file, "utf-8").split(/\r?\n/);

    lines.forEach((line, index) => {
      if (line.includes(PLACEHOLDER)) {
        violations.push({
          file: relativeFile,
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
          file: relativeFile,
          line: 1,
          text: `missing production binding: ${binding}`,
        });
      }
    }

    validateProductionRuntimeVars(relativeFile, lines, violations);
    if (requireDeploymentSecrets) {
      validateDeploymentSecrets(relativeFile, lines, env, violations);
    }
  }

  return { violations, checkedFiles: wranglerFiles.length };
}

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

function validateProductionRuntimeVars(relativeFile, lines, violations) {
  const requiredVars = REQUIRED_PRODUCTION_RUNTIME_VARS.get(relativeFile);
  if (!requiredVars) {
    return;
  }

  const productionVars = collectProductionVars(lines);
  for (const varName of requiredVars) {
    const value = productionVars.get(varName);
    if (!value) {
      violations.push({
        file: relativeFile,
        line: 1,
        text: `missing production runtime var: ${varName}`,
      });
      continue;
    }

    const invalidUrl = invalidPublicHttpsUrl(value);
    if (invalidUrl) {
      violations.push({
        file: relativeFile,
        line: 1,
        text: `invalid production runtime var ${varName}: ${invalidUrl}`,
      });
    }
  }
}

function validateDeploymentSecrets(relativeFile, lines, env, violations) {
  const requiredSecrets = REQUIRED_DEPLOYMENT_SECRETS.get(relativeFile);
  if (!requiredSecrets) {
    return;
  }

  const productionVars = collectProductionVars(lines);
  for (const secretName of requiredSecrets) {
    if (productionVars.has(secretName)) {
      violations.push({
        file: relativeFile,
        line: 1,
        text: `production secret must not be committed as a wrangler var: ${secretName}`,
      });
    }

    const value = env[secretName];
    if (!value) {
      violations.push({
        file: relativeFile,
        line: 1,
        text: `missing deployment secret: ${secretName}`,
      });
      continue;
    }

    const invalidUrl = invalidPublicHttpsUrl(value);
    if (invalidUrl) {
      violations.push({
        file: relativeFile,
        line: 1,
        text: `invalid deployment secret ${secretName}: ${invalidUrl}`,
      });
    }
  }
}

function invalidPublicHttpsUrl(value) {
  const urls = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (urls.length === 0) {
    return "empty value";
  }

  for (const url of urls) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return `${url} is not a valid URL`;
    }

    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== "https:") {
      return `${url} must use https`;
    }
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.endsWith(".local")
    ) {
      return `${url} is a local development URL`;
    }
  }

  return null;
}

function collectProductionVars(lines) {
  const vars = new Map();
  let section = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) {
      continue;
    }

    const arrayTable = line.match(/^\[\[([^\]]+)\]\]$/);
    if (arrayTable) {
      section = arrayTable[1];
      continue;
    }

    const table = line.match(/^\[([^\]]+)\]$/);
    if (table) {
      section = table[1];
      continue;
    }

    if (section === "env.production.vars") {
      const match = line.match(/^([A-Z0-9_]+)\s*=\s*"([^"]*)"/);
      if (match) {
        vars.set(match[1], match[2]);
      }
    }
  }

  return vars;
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

function printResult(result) {
  if (result.violations.length > 0) {
    console.error("[check-production-config] Production deploy blocked.");
    console.error(
      "Fix production Cloudflare resources, runtime URLs, and required secrets before deploying.",
    );
    console.error("");

    for (const violation of result.violations) {
      console.error(`  ${violation.file}:${violation.line} ${violation.text}`);
    }

    console.error("");
    console.error(
      "Create production resources, configure production vars/secrets, then rerun this check before deploy.",
    );
    return false;
  }

  console.log(
    `[check-production-config] OK: checked ${result.checkedFiles} wrangler.toml files.`,
  );
  return true;
}

function main() {
  const result = checkProductionConfig();
  if (!printResult(result)) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  checkProductionConfig,
  collectBindings,
  collectProductionVars,
};
