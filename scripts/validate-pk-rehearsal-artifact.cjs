#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value) {
  return Number(value ?? 0);
}

function sumDependencyRefs(dependencies, field) {
  return dependencies.reduce((total, dependency) => {
    return total + numberValue(dependency[field]);
  }, 0);
}

function validateCommonArtifact(artifact) {
  const failures = [];
  if (numberValue(artifact.assessment?.exitCode) !== 0) {
    failures.push("artifact assessment exitCode is not 0");
  }
  if (asArray(artifact.assessment?.failures).length > 0) {
    failures.push("artifact assessment failures is not empty");
  }
  if (artifact.rehearsalOptions?.requireRepresentativeData !== true) {
    failures.push("artifact was not run with --require-representative-data");
  }
  if (artifact.dataCoverage?.isRepresentative !== true) {
    failures.push("artifact dataCoverage is not representative");
  }
  return failures;
}

function validateOrdersArtifact(artifact) {
  const failures = validateCommonArtifact(artifact);
  const dependencies = asArray(artifact.dependencies);
  if (artifact.rehearsalOptions?.requireCompleteSurfaceCoverage !== true) {
    failures.push(
      "orders artifact was not run with --require-complete-surface-coverage",
    );
  }
  if (numberValue(artifact.ordersBridge?.order_rows) === 0) {
    failures.push("orders artifact has no order rows");
  }
  if (numberValue(artifact.ordersBridge?.missing_public_id) > 0) {
    failures.push("orders.public_id bridge has missing values");
  }
  if (numberValue(artifact.ordersBridge?.duplicate_public_id) > 0) {
    failures.push("orders.public_id bridge has duplicate values");
  }

  if (dependencies.length === 0) {
    failures.push("orders artifact has no dependency surfaces");
  }
  if (sumDependencyRefs(dependencies, "non_null_order_refs") === 0) {
    failures.push("orders artifact has no non-null dependency references");
  }

  for (const dependency of dependencies) {
    const surface = `${dependency.table}.${dependency.column}`;
    if (numberValue(dependency.unmapped_order_refs) > 0) {
      failures.push(`${surface} has unmapped order references`);
    }
    if (
      numberValue(dependency.mapped_order_refs) !==
      numberValue(dependency.non_null_order_refs)
    ) {
      failures.push(`${surface} failed shadow-copy row-count parity`);
    }
    if (!Array.isArray(dependency.schemaObjects)) {
      failures.push(`${surface} is missing schema object metadata`);
    }
  }

  if (numberValue(artifact.appCompatibility?.public_lookup_rows) === 0) {
    failures.push("orders appCompatibility public lookup has no coverage");
  }
  if (numberValue(artifact.appCompatibility?.shadow_public_id_rows) === 0) {
    failures.push("orders appCompatibility has no shadow public-id coverage");
  }
  if (numberValue(artifact.appCompatibility?.lookup_mismatches) > 0) {
    failures.push(
      "orders appCompatibility has legacy/public lookup mismatches",
    );
  }
  if (numberValue(artifact.appCompatibility?.shadow_public_id_missing) > 0) {
    failures.push("orders appCompatibility has missing shadow public ids");
  }
  if (numberValue(artifact.appCompatibility?.shadow_public_id_mismatches) > 0) {
    failures.push(
      "orders appCompatibility has shadow public-id resolution mismatches",
    );
  }
  if (asArray(artifact.foreignKeyCheck).length > 0) {
    failures.push("PRAGMA foreign_key_check returned rows");
  }

  return { exitCode: failures.length > 0 ? 1 : 0, failures };
}

function validateUsersArtifact(artifact) {
  const failures = validateCommonArtifact(artifact);
  const dependencies = asArray(artifact.dependencies);
  if (numberValue(artifact.usersBridge?.user_rows) === 0) {
    failures.push("users artifact has no user rows");
  }
  if (numberValue(artifact.usersBridge?.missing_public_id) > 0) {
    failures.push("users.public_id bridge has missing values");
  }
  if (numberValue(artifact.usersBridge?.duplicate_public_id) > 0) {
    failures.push("users.public_id bridge has duplicate values");
  }
  if (numberValue(artifact.usersBridge?.malformed_public_id) > 0) {
    failures.push("users.public_id bridge has malformed UUID-v7 values");
  }

  if (dependencies.length === 0) {
    failures.push("users artifact has no dependency surfaces");
  }
  if (sumDependencyRefs(dependencies, "non_null_user_refs") === 0) {
    failures.push("users artifact has no non-null dependency references");
  }

  for (const dependency of dependencies) {
    const surface = `${dependency.table}.${dependency.column}`;
    if (numberValue(dependency.unmapped_user_refs) > 0) {
      failures.push(`${surface} has unmapped user references`);
    }
    if (
      numberValue(dependency.mapped_user_refs) !==
      numberValue(dependency.non_null_user_refs)
    ) {
      failures.push(`${surface} failed shadow-copy row-count parity`);
    }
    if (!Array.isArray(dependency.schemaObjects)) {
      failures.push(`${surface} is missing schema object metadata`);
    }
  }

  if (asArray(artifact.uninventoriedUserForeignKeys).length > 0) {
    failures.push("users artifact has uninventoried users(id) foreign keys");
  }
  if (asArray(artifact.foreignKeyCheck).length > 0) {
    failures.push("PRAGMA foreign_key_check returned rows");
  }

  return { exitCode: failures.length > 0 ? 1 : 0, failures };
}

function validateArtifact(phase, artifact) {
  if (phase === "orders") return validateOrdersArtifact(artifact);
  if (phase === "users") return validateUsersArtifact(artifact);
  throw new Error(`Unsupported phase: ${phase}`);
}

function parseArgs(argv) {
  const args = { phase: null, artifact: null, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--phase") args.phase = argv[++index];
    else if (arg === "--artifact") args.artifact = argv[++index];
    else if (arg === "--help") args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function usage() {
  return `Usage:
  node scripts/validate-pk-rehearsal-artifact.cjs --phase orders --artifact /path/orders-pk.json
  node scripts/validate-pk-rehearsal-artifact.cjs --phase users --artifact /path/users-pk.json
`;
}

function execute(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (!args.phase || !args.artifact) {
    throw new Error("--phase and --artifact are required");
  }
  const artifactPath = path.resolve(args.artifact);
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const result = validateArtifact(args.phase, artifact);
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
  execute,
  parseArgs,
  validateArtifact,
  validateOrdersArtifact,
  validateUsersArtifact,
};
