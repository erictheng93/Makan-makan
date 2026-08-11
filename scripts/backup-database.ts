#!/usr/bin/env npx tsx
/**
 * MakanMasak Database Backup Script
 * Cross-platform TypeScript version
 *
 * Usage: npx tsx scripts/backup-database.ts [environment] [--output <dir>]
 * Example: npx tsx scripts/backup-database.ts production
 * Example: npx tsx scripts/backup-database.ts production --output ~/db-backups
 */

import { spawnSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync, statSync } from "fs";
import { basename, isAbsolute, join, relative, resolve } from "path";

// ANSI colors for terminal output
const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
};

// Configuration
//
// Dumps are plaintext database contents. The default directory is ignored by
// the repo's .gitignore; the guard in main() refuses to write anywhere inside
// the working tree that git would still track, so a dump can never be
// committed by accident. Pass `--output <dir>` to write outside the repo.
const DEFAULT_BACKUP_DIR = "backups";
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

type Environment = "production" | "local";

interface DatabaseConfig {
  name: string;
  isLocal: boolean;
}

function getDatabaseConfig(env: Environment): DatabaseConfig {
  const configs: Record<Environment, DatabaseConfig> = {
    production: { name: "makanmakan-prod", isLocal: false },
    local: { name: "makanmakan-local", isLocal: true },
  };
  return configs[env];
}

function runCommand(command: string, args: string[], silent = false): string {
  const result = spawnSync(command, args, {
    encoding: "utf-8",
    stdio: silent ? "pipe" : "inherit",
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !silent) {
    throw new Error(`Command failed with exit code ${result.status}`);
  }

  return result.stdout || "";
}

function runNpx(args: string[], silent = false): string {
  // Use npx to run wrangler commands
  const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
  return runCommand(npxCmd, args, silent);
}

function parseArgs(argv: string[]): {
  environment: string;
  backupDir: string;
} {
  let environment: string | undefined;
  let backupDir = DEFAULT_BACKUP_DIR;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--output" || arg === "-o") {
      const value = argv[i + 1];
      if (!value) {
        console.error(colors.red("--output requires a directory path"));
        process.exit(1);
      }
      backupDir = value;
      i++;
    } else if (arg.startsWith("--output=")) {
      backupDir = arg.slice("--output=".length);
    } else if (environment === undefined) {
      environment = arg;
    } else {
      console.error(colors.red(`Unexpected argument: ${arg}`));
      process.exit(1);
    }
  }

  return { environment: environment ?? "production", backupDir };
}

function isInsideGitWorkTree(dir: string): boolean {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    encoding: "utf-8",
    stdio: "pipe",
    shell: false,
  });
  if (result.status !== 0) {
    return false;
  }
  const relativeToRoot = relative(resolve(result.stdout.trim()), resolve(dir));
  return !relativeToRoot.startsWith("..") && !isAbsolute(relativeToRoot);
}

function isGitIgnored(dir: string): boolean {
  // The trailing slash tells git to match directory patterns (`backups/`) even
  // when the directory does not exist on disk yet.
  const target = dir.endsWith("/") ? dir : `${dir}/`;
  const result = spawnSync("git", ["check-ignore", "--quiet", target], {
    encoding: "utf-8",
    stdio: "pipe",
    shell: false,
  });
  return result.status === 0;
}

function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

async function main() {
  const { environment: environmentArg, backupDir } = parseArgs(
    process.argv.slice(2),
  );
  const environment = environmentArg as Environment;

  // Validate environment
  if (!["production", "local"].includes(environment)) {
    console.error(colors.red(`Invalid environment: ${environment}`));
    console.log(
      "Usage: npx tsx scripts/backup-database.ts [production|local] [--output <dir>]",
    );
    process.exit(1);
  }

  // A dump is plaintext database content. Never leave it somewhere git would
  // offer to commit.
  if (isInsideGitWorkTree(backupDir) && !isGitIgnored(backupDir)) {
    console.error(colors.red(`Refusing to write backups to: ${backupDir}`));
    console.error(
      "That path is inside the git working tree and not covered by .gitignore,",
    );
    console.error(
      "so a plaintext database dump could be committed. Add it to .gitignore,",
    );
    console.error("or pass --output <dir> pointing outside the repository.");
    process.exit(1);
  }

  const dbConfig = getDatabaseConfig(environment);
  const backupFile = join(backupDir, `${dbConfig.name}_${TIMESTAMP}.sql`);
  const metadataFile = join(
    backupDir,
    `${dbConfig.name}_${TIMESTAMP}_metadata.json`,
  );
  const archiveFile = `${backupFile}.tar.gz`;

  console.log(
    colors.blue(
      "============================================================================",
    ),
  );
  console.log(colors.blue("  MakanMasak Database Backup"));
  console.log(
    colors.blue(
      "============================================================================",
    ),
  );
  console.log();
  console.log(`${colors.yellow("Environment:")} ${environment}`);
  console.log(`${colors.yellow("Database:")} ${dbConfig.name}`);
  console.log(`${colors.yellow("Backup File:")} ${backupFile}`);
  console.log(`${colors.yellow("Timestamp:")} ${TIMESTAMP}`);
  console.log();

  // Create backup directory
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  // Step 1: Export database
  console.log(colors.blue("Step 1/5: Exporting database..."));
  try {
    if (dbConfig.isLocal) {
      // For local SQLite, use sqlite3 dump and write to file
      const dumpOutput = runCommand(
        "sqlite3",
        [".wrangler/state/d1/DB.sqlite3", ".dump"],
        true,
      );
      writeFileSync(backupFile, dumpOutput);
    } else {
      runNpx([
        "wrangler",
        "d1",
        "export",
        dbConfig.name,
        "--output",
        backupFile,
      ]);
    }
    console.log(colors.green("Database exported successfully"));
  } catch (error) {
    console.error(colors.red("Database export failed"));
    console.error(error);
    process.exit(1);
  }

  // Step 2: Get table list
  console.log();
  console.log(colors.blue("Step 2/5: Getting table list..."));
  let tables: string[] = [];
  try {
    let tablesOutput: string;
    if (dbConfig.isLocal) {
      tablesOutput = runCommand(
        "sqlite3",
        [".wrangler/state/d1/DB.sqlite3", ".tables"],
        true,
      );
    } else {
      tablesOutput = runNpx(
        ["wrangler", "d1", "execute", dbConfig.name, "--command", ".tables"],
        true,
      );
    }
    tables = tablesOutput.split(/\s+/).filter(Boolean);
    console.log(colors.green(`Found ${tables.length} tables`));
  } catch {
    console.log(colors.yellow("Could not retrieve table list"));
  }

  // Step 3: Get row counts and create metadata
  console.log();
  console.log(colors.blue("Step 3/5: Getting row counts..."));
  const metadata: Record<string, unknown> = {
    timestamp: TIMESTAMP,
    environment,
    database: dbConfig.name,
    backup_file: backupFile,
    tables: {} as Record<string, number>,
  };

  for (const table of tables) {
    try {
      let countOutput: string;
      const query = `SELECT COUNT(*) FROM ${table}`;
      if (dbConfig.isLocal) {
        countOutput = runCommand(
          "sqlite3",
          [".wrangler/state/d1/DB.sqlite3", query],
          true,
        );
      } else {
        countOutput = runNpx(
          [
            "wrangler",
            "d1",
            "execute",
            dbConfig.name,
            "--command",
            query,
            "--json",
          ],
          true,
        );
      }
      const count = parseInt(countOutput.match(/\d+/)?.[0] || "0", 10);
      (metadata.tables as Record<string, number>)[table] = count;
    } catch {
      (metadata.tables as Record<string, number>)[table] = -1;
    }
  }

  writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
  console.log(colors.green("Row counts saved to metadata"));

  // Step 4: Verify backup file
  console.log();
  console.log(colors.blue("Step 4/5: Verifying backup file..."));
  if (existsSync(backupFile)) {
    const stats = statSync(backupFile);
    console.log(
      colors.green(`Backup file exists: ${formatFileSize(stats.size)}`),
    );
  } else {
    console.error(colors.red("Backup file not found"));
    process.exit(1);
  }

  // Step 5: Create compressed archive
  console.log();
  console.log(colors.blue("Step 5/5: Creating compressed archive..."));
  try {
    // -C keeps the archive members relative to the backup directory, so an
    // absolute --output path does not end up baked into the archive.
    runCommand(
      "tar",
      [
        "-czf",
        archiveFile,
        "-C",
        backupDir,
        basename(backupFile),
        basename(metadataFile),
      ],
      true,
    );
    const archiveStats = statSync(archiveFile);
    console.log(
      colors.green(`Archive created: ${formatFileSize(archiveStats.size)}`),
    );
  } catch (error) {
    console.error(colors.red("Archive creation failed"));
    console.error(error);
    process.exit(1);
  }

  // Summary
  console.log();
  console.log(
    colors.blue(
      "============================================================================",
    ),
  );
  console.log(colors.green("Backup completed successfully!"));
  console.log(
    colors.blue(
      "============================================================================",
    ),
  );
  console.log();
  console.log(colors.yellow("Backup Details:"));
  console.log(`  Backup File: ${backupFile}`);
  console.log(`  Archive: ${archiveFile}`);
  console.log(`  Metadata: ${metadataFile}`);
  console.log();
  console.log(colors.yellow("Next Steps:"));
  console.log(`  1. Verify backup: tar -tzf ${archiveFile}`);
  console.log("  2. Store safely: Copy to backup storage");
  console.log();
  console.log(colors.green("Ready to proceed with refactoring!"));
}

main().catch((error) => {
  console.error(colors.red("Backup failed:"), error.message);
  process.exit(1);
});
