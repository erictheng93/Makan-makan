#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_CONFIG_PATH = "packages/database/migration-dual-track.json";

function migrationRank(filename) {
  const match = /^(\d+)[_-]/.exec(filename);
  return match ? Number(match[1]) : null;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listSqlFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

function requireExistingFile(errors, dir, filename, label) {
  if (!filename) {
    errors.push(`${label} is missing a filename`);
    return;
  }
  if (!fs.existsSync(path.join(dir, filename))) {
    errors.push(`${label} points at a missing file: ${filename}`);
  }
}

function requireReason(errors, entry, label) {
  if (!entry.reason || typeof entry.reason !== "string") {
    errors.push(`${label} must include a non-empty reason`);
  }
}

function trackEntry(set, filename) {
  if (filename) set.add(filename);
}

function checkMigrationDualTrack(options = {}) {
  const root = options.root ?? process.cwd();
  const configPath = path.resolve(
    root,
    options.configPath ?? DEFAULT_CONFIG_PATH,
  );
  const config = readJson(configPath);
  const freshDir = path.resolve(root, config.freshDir);
  const legacyDir = path.resolve(root, config.legacyDir);
  const freshFiles = listSqlFiles(freshDir);
  const legacyFiles = listSqlFiles(legacyDir);
  const freshTracked = new Set();
  const legacyTracked = new Set();
  const errors = [];

  const freshCheckpoint = config.reviewedThrough?.fresh;
  const legacyCheckpoint = config.reviewedThrough?.legacy;
  const freshCheckpointRank = migrationRank(freshCheckpoint ?? "");
  const legacyCheckpointRank = migrationRank(legacyCheckpoint ?? "");

  requireExistingFile(errors, freshDir, freshCheckpoint, "fresh checkpoint");
  requireExistingFile(errors, legacyDir, legacyCheckpoint, "legacy checkpoint");
  if (freshCheckpointRank == null) {
    errors.push(
      `fresh checkpoint is not a ranked migration: ${freshCheckpoint}`,
    );
  }
  if (legacyCheckpointRank == null) {
    errors.push(
      `legacy checkpoint is not a ranked migration: ${legacyCheckpoint}`,
    );
  }

  for (const [index, pair] of (config.pairs ?? []).entries()) {
    const label = `pairs[${index}]`;
    requireExistingFile(errors, freshDir, pair.fresh, `${label}.fresh`);
    requireExistingFile(errors, legacyDir, pair.legacy, `${label}.legacy`);
    requireReason(errors, pair, label);
    trackEntry(freshTracked, pair.fresh);
    trackEntry(legacyTracked, pair.legacy);
  }

  for (const [index, entry] of (config.freshOnly ?? []).entries()) {
    const label = `freshOnly[${index}]`;
    requireExistingFile(errors, freshDir, entry.fresh, `${label}.fresh`);
    requireReason(errors, entry, label);
    trackEntry(freshTracked, entry.fresh);
  }

  for (const [index, entry] of (config.legacyOnly ?? []).entries()) {
    const label = `legacyOnly[${index}]`;
    requireExistingFile(errors, legacyDir, entry.legacy, `${label}.legacy`);
    requireReason(errors, entry, label);
    trackEntry(legacyTracked, entry.legacy);
  }

  if (freshCheckpointRank != null) {
    for (const file of freshFiles) {
      const rank = migrationRank(file);
      if (
        rank != null &&
        rank > freshCheckpointRank &&
        !freshTracked.has(file)
      ) {
        errors.push(
          `${file} is after the fresh checkpoint and must be paired or marked freshOnly`,
        );
      }
    }
  }

  if (legacyCheckpointRank != null) {
    for (const file of legacyFiles) {
      const rank = migrationRank(file);
      if (
        rank != null &&
        rank > legacyCheckpointRank &&
        !legacyTracked.has(file)
      ) {
        errors.push(
          `${file} is after the legacy checkpoint and must be paired or marked legacyOnly`,
        );
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    checked: {
      freshDir,
      legacyDir,
      freshFiles: freshFiles.length,
      legacyFiles: legacyFiles.length,
    },
  };
}

if (require.main === module) {
  const result = checkMigrationDualTrack();
  if (!result.ok) {
    console.error("Migration dual-track guard failed:");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(
    `Migration dual-track guard passed (${result.checked.freshFiles} fresh, ${result.checked.legacyFiles} legacy migrations).`,
  );
}

module.exports = {
  checkMigrationDualTrack,
  migrationRank,
};
