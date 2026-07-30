#!/usr/bin/env npx tsx
/**
 * Inventory which table and seat QR codes still use the legacy v1 signing
 * format, for the #88 phase-2 rollout.
 *
 *   npx tsx scripts/audit-qr-format.ts              # local D1
 *   npx tsx scripts/audit-qr-format.ts production   # remote D1
 *   npx tsx scripts/audit-qr-format.ts production --json
 *
 * Read-only: it issues SELECTs and never writes.
 *
 * Format is decided by parseSignedQRUrl, not by looking for "f=2" in the
 * string. A substring test would misreport a URL whose signature or identifier
 * happens to contain that text, and it cannot tell an unparseable value from a
 * legacy one — which is the distinction that matters here, because an
 * unparseable QR cannot be verified by either format and needs a look rather
 * than a bulk regenerate.
 */

import { execFileSync } from "child_process";
import { parseSignedQRUrl } from "../packages/utils/src/qr-signing";

type Environment = "production" | "local";

const DATABASES: Record<Environment, { name: string; remote: boolean }> = {
  production: { name: "makanmakan-prod", remote: true },
  local: { name: "makanmakan-local", remote: false },
};

const colors = {
  red: (t: string) => `\x1b[31m${t}\x1b[0m`,
  green: (t: string) => `\x1b[32m${t}\x1b[0m`,
  yellow: (t: string) => `\x1b[33m${t}\x1b[0m`,
  dim: (t: string) => `\x1b[2m${t}\x1b[0m`,
};

interface QrRow {
  id: number | string;
  label: string;
  restaurant_id: string;
  qr_code: string | null;
}

// tables.qr_code and seats.qr_code are both NOT NULL, so there is no
// "missing" bucket to report — an empty value would be unparseable anyway.
type Bucket = "v1" | "v2" | "unparseable";

function query(env: Environment, sql: string): QrRow[] {
  const db = DATABASES[env];
  const args = [
    "wrangler",
    "d1",
    "execute",
    db.name,
    db.remote ? "--remote" : "--local",
    "--json",
    "--config=./apps/api/wrangler.toml",
    "--command",
    sql,
  ];
  if (!db.remote) args.splice(5, 0, "--persist-to=./.wrangler/shared-state");

  const raw = execFileSync("npx", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });

  // wrangler prints a banner before the JSON payload
  const start = raw.indexOf("[");
  if (start === -1) throw new Error(`no JSON in wrangler output:\n${raw}`);
  const parsed = JSON.parse(raw.slice(start)) as Array<{ results: QrRow[] }>;
  return parsed.flatMap((r) => r.results ?? []);
}

function classify(qrCode: string | null, expected: "table" | "seat"): Bucket {
  const payload = qrCode ? parseSignedQRUrl(qrCode) : null;
  if (!payload || payload.type !== expected) return "unparseable";
  return payload.formatVersion === 2 ? "v2" : "v1";
}

function report(
  kind: "table" | "seat",
  rows: QrRow[],
): Record<Bucket, QrRow[]> {
  const buckets: Record<Bucket, QrRow[]> = {
    v1: [],
    v2: [],
    unparseable: [],
  };
  for (const row of rows) buckets[classify(row.qr_code, kind)].push(row);
  return buckets;
}

function printBuckets(kind: string, buckets: Record<Bucket, QrRow[]>): void {
  const total = Object.values(buckets).reduce((n, b) => n + b.length, 0);
  console.log(`\n${kind} (${total} rows)`);
  console.log(`  ${colors.green("v2")}           ${buckets.v2.length}`);
  console.log(
    `  ${buckets.v1.length ? colors.yellow("v1 (legacy)") : "v1 (legacy)"}  ${buckets.v1.length}`,
  );
  console.log(
    `  ${buckets.unparseable.length ? colors.red("unparseable") : "unparseable"}  ${buckets.unparseable.length}`,
  );

  for (const bucket of ["v1", "unparseable"] as const) {
    if (!buckets[bucket].length) continue;
    const byRestaurant = new Map<string, string[]>();
    for (const row of buckets[bucket]) {
      const list = byRestaurant.get(row.restaurant_id) ?? [];
      list.push(row.label);
      byRestaurant.set(row.restaurant_id, list);
    }
    console.log(colors.dim(`\n  needs attention — ${bucket}:`));
    for (const [restaurantId, labels] of byRestaurant) {
      const shown = labels.slice(0, 12).join(", ");
      const more = labels.length > 12 ? ` … +${labels.length - 12} more` : "";
      console.log(
        colors.dim(`    ${restaurantId}  (${labels.length})  ${shown}${more}`),
      );
    }
  }
}

const env = (
  process.argv[2] === "production" ? "production" : "local"
) as Environment;
const asJson = process.argv.includes("--json");

const tableRows = query(
  env,
  "SELECT id, number AS label, restaurant_id, qr_code FROM tables WHERE deleted_at_ms IS NULL",
);
const seatRows = query(
  env,
  `SELECT s.id, s.seat_number AS label, t.restaurant_id, s.qr_code
     FROM seats s JOIN tables t ON t.id = s.table_id
    WHERE s.deleted_at_ms IS NULL AND t.deleted_at_ms IS NULL`,
);

const tables = report("table", tableRows);
const seats = report("seat", seatRows);

if (asJson) {
  console.log(
    JSON.stringify(
      {
        environment: env,
        tables: Object.fromEntries(
          Object.entries(tables).map(([k, v]) => [
            k,
            v.map((r) => ({
              id: r.id,
              label: r.label,
              restaurantId: r.restaurant_id,
            })),
          ]),
        ),
        seats: Object.fromEntries(
          Object.entries(seats).map(([k, v]) => [
            k,
            v.map((r) => ({
              id: r.id,
              label: r.label,
              restaurantId: r.restaurant_id,
            })),
          ]),
        ),
      },
      null,
      2,
    ),
  );
} else {
  console.log(`QR signing format audit — ${env} D1`);
  printBuckets("tables", tables);
  printBuckets("seats", seats);

  const pending =
    tables.v1.length +
    seats.v1.length +
    tables.unparseable.length +
    seats.unparseable.length;
  console.log(
    pending === 0
      ? `\n${colors.green("No legacy or unparseable QR codes. Phase 3 legacy cutoff is unblocked.")}`
      : `\n${colors.yellow(`${pending} row(s) still need regenerating before the phase 3 cutoff.`)}`,
  );
}

// Non-zero when anything still needs work, so this can gate the phase 3 change.
process.exit(
  tables.v1.length +
    seats.v1.length +
    tables.unparseable.length +
    seats.unparseable.length >
    0
    ? 1
    : 0,
);
