#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const {
  ARTIFACT_SCHEMA_VERSION,
  validateArtifact,
} = require("./validate-pk-rehearsal-artifact.cjs");

const MANIFEST_SCHEMA_VERSION = 1;
const READINESS_PHASE = "phase-c-orders-pk";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value) {
  return Number(value ?? 0);
}

function sortedStrings(value) {
  return asArray(value).map(String).sort();
}

function surfaceKey(dependency) {
  return `${dependency.table}.${dependency.column}`;
}

function schemaSignature(dependency) {
  return asArray(dependency.schemaObjects)
    .map((object) => {
      return JSON.stringify({
        type: object?.type ?? null,
        name: object?.name ?? null,
        sql: object?.sql ?? null,
      });
    })
    .sort();
}

function dependencyMap(label, artifact, failures) {
  const map = new Map();
  for (const dependency of asArray(artifact?.dependencies)) {
    const key = surfaceKey(dependency);
    if (map.has(key)) {
      failures.push(
        `dependency surface ${key} appears more than once in ${label} artifact`,
      );
    }
    map.set(key, dependency);
  }
  return map;
}

function validateManifestShape(manifest) {
  const failures = [];
  if (manifest?.manifestSchemaVersion !== MANIFEST_SCHEMA_VERSION) {
    failures.push(
      `manifest schema version ${manifest?.manifestSchemaVersion} is not supported`,
    );
  }
  if (manifest?.readinessPhase !== READINESS_PHASE) {
    failures.push(
      `readiness phase ${manifest?.readinessPhase} does not match ${READINESS_PHASE}`,
    );
  }
  if (manifest?.target?.artifactPhase !== "orders") {
    failures.push("target artifactPhase must be orders");
  }
  if (manifest?.target?.artifactSchemaVersion !== ARTIFACT_SCHEMA_VERSION) {
    failures.push(
      `target artifactSchemaVersion must be ${ARTIFACT_SCHEMA_VERSION}`,
    );
  }

  const representative = manifest?.artifacts?.representative;
  const rollbackFixture = manifest?.artifacts?.rollbackFixture;
  if (typeof representative?.path !== "string") {
    failures.push("representative artifact path is missing");
  }
  if (typeof rollbackFixture?.path !== "string") {
    failures.push("rollbackFixture artifact path is missing");
  }
  if (
    typeof representative?.path === "string" &&
    representative.path === rollbackFixture?.path
  ) {
    failures.push(
      "representative and rollbackFixture must reference different files",
    );
  }
  if (representative && representative.role !== "representative") {
    failures.push("representative artifact role must be representative");
  }
  if (rollbackFixture && rollbackFixture.role !== "fixture") {
    failures.push("rollbackFixture artifact role must be fixture");
  }
  if (
    representative &&
    !["staging", "restored-production"].includes(representative.source?.kind)
  ) {
    failures.push(
      "representative source kind must be staging or restored-production",
    );
  }
  if (rollbackFixture && rollbackFixture.source?.kind !== "local") {
    failures.push("rollbackFixture source kind must be local");
  }
  return failures;
}

function validateArtifacts(artifacts) {
  const failures = [];
  if (!artifacts.representative) {
    failures.push("representative artifact is missing");
  } else {
    const result = validateArtifact("orders", artifacts.representative, {
      role: "representative",
    });
    failures.push(
      ...result.failures.map(
        (failure) => `representative artifact failed validation: ${failure}`,
      ),
    );
  }

  if (!artifacts.rollbackFixture) {
    failures.push("rollbackFixture artifact is missing");
  } else {
    const result = validateArtifact("orders", artifacts.rollbackFixture, {
      role: "fixture",
    });
    failures.push(
      ...result.failures.map(
        (failure) => `rollbackFixture artifact failed validation: ${failure}`,
      ),
    );
  }
  return failures;
}

function validateCrossArtifactCompatibility(artifacts) {
  const failures = [];
  if (!artifacts.representative || !artifacts.rollbackFixture) {
    return failures;
  }

  const representativeMap = dependencyMap(
    "representative",
    artifacts.representative,
    failures,
  );
  const fixtureMap = dependencyMap(
    "rollbackFixture",
    artifacts.rollbackFixture,
    failures,
  );

  for (const key of representativeMap.keys()) {
    if (!fixtureMap.has(key)) {
      failures.push(
        `rollbackFixture is missing representative dependency surface ${key}`,
      );
    }
  }
  for (const key of fixtureMap.keys()) {
    if (!representativeMap.has(key)) {
      failures.push(
        `rollbackFixture has dependency surface ${key} not covered by representative`,
      );
    }
  }

  for (const [key, representative] of representativeMap.entries()) {
    const fixture = fixtureMap.get(key);
    if (!fixture) continue;
    for (const field of ["kind", "nullability", "onDelete"]) {
      if (representative[field] !== fixture[field]) {
        failures.push(
          `dependency surface ${key} has incompatible ${field}: representative ${representative[field]}, rollbackFixture ${fixture[field]}`,
        );
      }
    }
    if (
      JSON.stringify(sortedStrings(representative.writePaths)) !==
      JSON.stringify(sortedStrings(fixture.writePaths))
    ) {
      failures.push(`dependency surface ${key} has incompatible writePaths`);
    }
    if (
      JSON.stringify(schemaSignature(representative)) !==
      JSON.stringify(schemaSignature(fixture))
    ) {
      failures.push(`schema metadata mismatch for ${key}`);
    }
  }

  for (const [key, dependency] of fixtureMap.entries()) {
    if (numberValue(dependency.non_null_order_refs) === 0) {
      failures.push(
        `rollbackFixture dependency ${key} has no representative order references`,
      );
    }
  }

  return failures;
}

function verifyPhaseCReadinessManifest(manifest, artifacts) {
  const failures = [
    ...validateManifestShape(manifest),
    ...validateArtifacts(artifacts),
    ...validateCrossArtifactCompatibility(artifacts),
  ];
  return { exitCode: failures.length > 0 ? 1 : 0, failures };
}

function parseArgs(argv) {
  const args = {
    manifest: null,
    root: process.cwd(),
    json: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--manifest") args.manifest = argv[++index];
    else if (arg === "--root") args.root = argv[++index];
    else if (arg === "--json") args.json = true;
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/verify-phase-c-orders-pk-readiness-manifest.cjs --manifest /path/orders-readiness.json
  pnpm db:orders-pk-readiness:verify -- --manifest /path/orders-readiness.json

Options:
  --manifest <path>   Phase C readiness manifest JSON. Required.
  --root <path>       Repository root for resolving relative paths. Default: cwd.
  --json              Print machine-readable JSON result.
  --help              Show this help.
`;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resolveFromRoot(root, filePath) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(root, filePath);
}

function execute(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (!args.manifest) {
    throw new Error("--manifest is required");
  }

  const root = path.resolve(args.root);
  const manifestPath = resolveFromRoot(root, args.manifest);
  const manifest = readJson(manifestPath);
  const representativePath = manifest?.artifacts?.representative?.path;
  const rollbackFixturePath = manifest?.artifacts?.rollbackFixture?.path;
  const artifacts = {
    representative:
      typeof representativePath === "string"
        ? readJson(resolveFromRoot(root, representativePath))
        : undefined,
    rollbackFixture:
      typeof rollbackFixturePath === "string"
        ? readJson(resolveFromRoot(root, rollbackFixturePath))
        : undefined,
  };
  const result = verifyPhaseCReadinessManifest(manifest, artifacts);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.exitCode;
}

if (require.main === module) {
  try {
    process.exit(execute(process.argv.slice(2)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error(usage());
    process.exit(1);
  }
}

module.exports = {
  MANIFEST_SCHEMA_VERSION,
  READINESS_PHASE,
  execute,
  parseArgs,
  verifyPhaseCReadinessManifest,
};
