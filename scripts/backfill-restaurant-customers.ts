#!/usr/bin/env npx tsx
/**
 * One-off backfill of `restaurant_customers` from historical orders.
 * Issue #299 (Stage A1), spec §6.2.
 *
 * Why this is a script and not a migration: `migrations_fresh/0016` creates the
 * table empty, and `OrderService.recomputeMemberProjection` only fills a row
 * when that customer's next order moves. Without a backfill every customer who
 * already ordered stays invisible in the member directory until they come back
 * — which is precisely the question the feature exists to answer. But the row
 * count is unknown, so the work has to be batched, resumable and re-runnable,
 * and a migration is none of those: it runs once, unbatched, inside a deploy.
 *
 * Usage:
 *   npx tsx scripts/backfill-restaurant-customers.ts                 # local D1
 *   npx tsx scripts/backfill-restaurant-customers.ts --dry-run       # counts only
 *   npx tsx scripts/backfill-restaurant-customers.ts --remote        # production
 *   npx tsx scripts/backfill-restaurant-customers.ts --batch=1000
 *
 * Safe to interrupt and re-run: every batch skips pairs that already have a
 * projection row, so a second run resumes rather than duplicating, and a row the
 * runtime recomputed in the meantime is never overwritten.
 */

import { spawnSync } from "node:child_process";

/**
 * Loaded from source rather than from the built package: this runs under tsx
 * with no build step, and going through the source path is also what lets
 * `drizzle-orm` resolve out of packages/database's own node_modules (it is a
 * pnpm override at the root, not a root dependency). Only the pre-rendered
 * statement strings cross the boundary, so nothing here needs drizzle itself.
 *
 * A *dynamic* import on purpose. A static one resolves the same file but hands
 * back a namespace with only `default` under tsx's ESM/CJS interop, so every
 * named import comes back undefined at load time.
 */
async function loadStatements() {
  return import("../packages/database/src/services/restaurant-customer-backfill");
}

interface Options {
  remote: boolean;
  dryRun: boolean;
  batchSize: number;
  maxBatches: number;
}

function parseOptions(argv: string[]): Options {
  const numeric = (flag: string, fallback: number) => {
    const raw = argv.find((arg) => arg.startsWith(`${flag}=`));
    if (!raw) return fallback;
    const value = Number(raw.slice(flag.length + 1));
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${flag} must be a positive number`);
    }
    return Math.trunc(value);
  };
  return {
    remote: argv.includes("--remote"),
    dryRun: argv.includes("--dry-run"),
    batchSize: numeric("--batch", 500),
    maxBatches: numeric("--max-batches", 10_000),
  };
}

function wranglerArgs(options: Options): string[] {
  return options.remote
    ? [
        "d1",
        "execute",
        "makanmasak-prod",
        "--remote",
        "--env",
        "production",
        "--config=./apps/api/wrangler.toml",
      ]
    : [
        "d1",
        "execute",
        "makanmakan-local",
        "--local",
        "--persist-to",
        "./.wrangler/shared-state",
        "--config=./apps/api/wrangler.toml",
      ];
}

interface D1ExecuteResult {
  results?: Array<Record<string, unknown>>;
  meta?: { changes?: number; rows_written?: number };
}

function execute(options: Options, statement: string): D1ExecuteResult {
  const run = spawnSync(
    "npx",
    [
      "wrangler",
      ...wranglerArgs(options),
      "--json",
      "--command",
      statement,
      "-y",
    ],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  if (run.status !== 0) {
    throw new Error(
      `wrangler d1 execute failed (exit ${run.status}):\n${run.stderr || run.stdout}`,
    );
  }
  // wrangler prints a banner before the JSON on some versions; take the payload
  // from the first '[' or '{' rather than trusting the whole stream.
  const stdout = run.stdout ?? "";
  const start = stdout.search(/[[{]/);
  if (start === -1) throw new Error(`No JSON in wrangler output:\n${stdout}`);
  const parsed = JSON.parse(stdout.slice(start)) as
    | D1ExecuteResult
    | D1ExecuteResult[];
  return Array.isArray(parsed) ? (parsed[0] ?? {}) : parsed;
}

function scalar(result: D1ExecuteResult): number {
  const row = result.results?.[0];
  const value = row ? Object.values(row)[0] : 0;
  return Number(value ?? 0);
}

function rowsWritten(result: D1ExecuteResult): number {
  return Number(result.meta?.changes ?? result.meta?.rows_written ?? 0);
}

async function main(): Promise<void> {
  const {
    backfillCandidateOrderCountStatement,
    backfillPendingPairCountStatement,
    restaurantCustomerBackfillStatement,
  } = await loadStatements();
  const options = parseOptions(process.argv.slice(2));
  const target = options.remote ? "production (--remote)" : "local";
  console.log(`Backfilling restaurant_customers against ${target}`);

  // Spec §6.2: measure the history before touching it, so the batch size is a
  // decision rather than a guess.
  const candidateOrders = scalar(
    execute(options, backfillCandidateOrderCountStatement()),
  );
  const pendingPairs = scalar(
    execute(options, backfillPendingPairCountStatement()),
  );
  console.log(`  orders with a customer_id : ${candidateOrders}`);
  console.log(`  projections still missing : ${pendingPairs}`);

  if (options.dryRun) {
    console.log("\n--dry-run: nothing written. Statement that would run:\n");
    console.log(restaurantCustomerBackfillStatement(options.batchSize));
    return;
  }
  if (pendingPairs === 0) {
    console.log("Nothing to backfill.");
    return;
  }

  const statement = restaurantCustomerBackfillStatement(options.batchSize);
  let inserted = 0;
  for (let batch = 1; batch <= options.maxBatches; batch++) {
    const written = rowsWritten(execute(options, statement));
    inserted += written;
    console.log(`  batch ${batch}: +${written} (total ${inserted})`);
    // A batch that writes nothing means every remaining pair already has a
    // row; there is no cursor to advance past.
    if (written === 0) break;
  }

  const remaining = scalar(
    execute(options, backfillPendingPairCountStatement()),
  );
  console.log(
    `Done. Inserted ${inserted}; ${remaining} pair(s) still pending.`,
  );
  if (remaining > 0) {
    console.log("Re-run to continue (--max-batches was reached).");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
