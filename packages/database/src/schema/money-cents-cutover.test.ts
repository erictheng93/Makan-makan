import { getTableConfig } from "drizzle-orm/sqlite-core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  cashMovements,
  cashShifts,
  couponUsage,
  coupons,
  dishSearchIndex,
  groupCartItems,
  groupOrders,
  ingredientDefinitions,
  menuItems,
  marketCheckoutChildOrders,
  orderItems,
  orders,
  partnershipPlans,
  partnershipUsageLogs,
  partnerships,
  refunds,
  splitBills,
  shiftTemplates,
  verifiedMembers,
} from "./index";

// Migration fixtures are addressed repo-root-relative. Anchor on this
// file's own location rather than process.cwd() so the suite passes whether
// vitest runs from the workspace root or from packages/database, which is
// what `turbo run test` does.
const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));

type Table = Parameters<typeof getTableConfig>[0];

interface CutoverSurface {
  tableName: string;
  table: Table;
  legacyColumns: string[];
  retainedColumns: string[];
}

const cutoverSurfaces: CutoverSurface[] = [
  {
    tableName: "orders",
    table: orders,
    legacyColumns: [
      "subtotal",
      "tax_amount",
      "service_charge",
      "discount_amount",
      "total_amount",
      "refund_amount",
    ],
    retainedColumns: [
      "subtotal_cents",
      "tax_amount_cents",
      "service_charge_cents",
      "discount_amount_cents",
      "total_amount_cents",
      "refund_amount_cents",
    ],
  },
  {
    tableName: "order_items",
    table: orderItems,
    legacyColumns: ["unit_price", "total_price"],
    retainedColumns: ["unit_price_cents", "total_price_cents"],
  },
  {
    tableName: "menu_items",
    table: menuItems,
    legacyColumns: ["price", "original_price", "cost_price"],
    retainedColumns: [
      "price_cents",
      "original_price_cents",
      "cost_price_cents",
    ],
  },
  {
    tableName: "coupons",
    table: coupons,
    legacyColumns: [
      "discount_value",
      "max_discount_amount",
      "min_order_amount",
    ],
    retainedColumns: [
      "discount_percentage_bps",
      "discount_value_cents",
      "max_discount_amount_cents",
      "min_order_amount_cents",
    ],
  },
  {
    tableName: "coupon_usage",
    table: couponUsage,
    legacyColumns: ["discount_amount", "original_amount", "final_amount"],
    retainedColumns: [
      "discount_amount_cents",
      "original_amount_cents",
      "final_amount_cents",
    ],
  },
  {
    tableName: "group_orders",
    table: groupOrders,
    legacyColumns: [
      "total_amount",
      "tax_amount",
      "service_charge",
      "final_amount",
    ],
    retainedColumns: [
      "total_amount_cents",
      "tax_amount_cents",
      "service_charge_cents",
      "final_amount_cents",
    ],
  },
  {
    tableName: "group_cart_items",
    table: groupCartItems,
    legacyColumns: ["unit_price", "total_price"],
    retainedColumns: ["unit_price_cents", "total_price_cents"],
  },
  {
    tableName: "split_bills",
    table: splitBills,
    legacyColumns: [
      "subtotal",
      "tax_amount",
      "service_charge",
      "discount_amount",
      "tip_amount",
      "total_amount",
    ],
    retainedColumns: [
      "subtotal_cents",
      "tax_amount_cents",
      "service_charge_cents",
      "discount_amount_cents",
      "tip_amount_cents",
      "total_amount_cents",
    ],
  },
  {
    tableName: "cash_shifts",
    table: cashShifts,
    legacyColumns: [
      "start_amount",
      "end_amount",
      "expected_amount",
      "actual_amount",
      "difference_amount",
      "total_sales",
      "total_refunds",
      "cash_sales",
      "card_sales",
      "digital_sales",
    ],
    retainedColumns: [
      "start_amount_cents",
      "end_amount_cents",
      "expected_amount_cents",
      "actual_amount_cents",
      "difference_amount_cents",
      "total_sales_cents",
      "total_refunds_cents",
      "cash_sales_cents",
      "card_sales_cents",
      "digital_sales_cents",
    ],
  },
  {
    tableName: "cash_movements",
    table: cashMovements,
    legacyColumns: ["amount"],
    retainedColumns: ["amount_cents"],
  },
  {
    tableName: "refunds",
    table: refunds,
    legacyColumns: ["original_amount", "refund_amount"],
    retainedColumns: ["original_amount_cents", "refund_amount_cents"],
  },
  {
    tableName: "dish_search_index",
    table: dishSearchIndex,
    legacyColumns: ["price"],
    retainedColumns: ["price_cents"],
  },
  {
    tableName: "market_checkout_child_orders",
    table: marketCheckoutChildOrders,
    legacyColumns: ["total_amount"],
    retainedColumns: ["total_amount_cents"],
  },
  {
    tableName: "ingredient_definitions",
    table: ingredientDefinitions,
    legacyColumns: ["cost_per_unit"],
    retainedColumns: ["cost_per_unit_cents"],
  },
  {
    tableName: "shift_templates",
    table: shiftTemplates,
    legacyColumns: ["hourly_rate"],
    retainedColumns: ["hourly_rate_cents"],
  },
  {
    tableName: "partnerships",
    table: partnerships,
    legacyColumns: [
      "default_discount_value",
      "total_discount_given",
      "total_revenue",
    ],
    retainedColumns: [
      "default_discount_percentage_bps",
      "default_discount_value_cents",
      "total_discount_given_cents",
      "total_revenue_cents",
    ],
  },
  {
    tableName: "partnership_plans",
    table: partnershipPlans,
    legacyColumns: [
      "discount_value",
      "max_discount_amount",
      "min_order_amount",
      "max_order_amount",
      "total_discount_given",
      "total_revenue",
    ],
    retainedColumns: [
      "discount_percentage_bps",
      "discount_value_cents",
      "max_discount_amount_cents",
      "min_order_amount_cents",
      "max_order_amount_cents",
      "total_discount_given_cents",
      "total_revenue_cents",
    ],
  },
  {
    tableName: "partnership_usage_logs",
    table: partnershipUsageLogs,
    legacyColumns: [
      "discount_value",
      "discount_amount",
      "original_amount",
      "final_amount",
    ],
    retainedColumns: [
      "discount_percentage_bps",
      "discount_value_cents",
      "discount_amount_cents",
      "original_amount_cents",
      "final_amount_cents",
    ],
  },
  {
    tableName: "verified_members",
    table: verifiedMembers,
    legacyColumns: ["total_discount_received", "total_spending"],
    retainedColumns: ["total_discount_received_cents", "total_spending_cents"],
  },
];

const mainMoneyCutoverSurfaces = cutoverSurfaces.filter(
  (surface) => surface.tableName !== "market_checkout_child_orders",
);

const marketCheckoutChildOrderSurface = cutoverSurfaces.find(
  (surface) => surface.tableName === "market_checkout_child_orders",
);

function columnNames(table: Table): string[] {
  return getTableConfig(table).columns.map((column) => column.name);
}

// The fresh track was squashed into a single baseline, so there is no cutover
// migration left to read there: the baseline simply never creates the legacy
// columns. That is the stronger target -- a migration only shows the shape at
// the point it was written, the baseline is the shape that ships.
const FRESH_BASELINE =
  "packages/database/migrations_fresh/0000_baseline_strict.sql";

// Quoting and case are not stable across the baseline: SQLite rewrites a
// table's stored DDL when ALTER TABLE touches it, so `orders` becomes
// "orders". Match the structure, not the punctuation.
function baselineTableBlock(sql: string, tableName: string): string {
  const opening = new RegExp(
    String.raw`CREATE TABLE ["\`]?${tableName}["\`]?\s*\(`,
    "i",
  ).exec(sql);

  expect(opening, `${tableName} is created in the baseline`).not.toBeNull();

  const end = sql.indexOf(") STRICT;", opening!.index);
  expect(end, `${tableName} is a STRICT table`).toBeGreaterThan(-1);

  return sql.slice(opening!.index, end);
}

// `subtotal` must not match `subtotal_cents`, so anchor on the declaration:
// the column name, an optional closing quote, then its storage class.
function declaresColumn(block: string, column: string): boolean {
  return new RegExp(
    String.raw`["\`]?\b${column}\b["\`]?\s+(text|integer|real|blob|numeric)`,
    "i",
  ).test(block);
}

describe("money cents cutover schema", () => {
  it.each(cutoverSurfaces)(
    "omits legacy money columns from $tableName while retaining cents/bps columns",
    ({ table, legacyColumns, retainedColumns }) => {
      const columns = columnNames(table);

      expect(columns).toEqual(expect.arrayContaining(retainedColumns));
      for (const legacyColumn of legacyColumns) {
        expect(columns).not.toContain(legacyColumn);
      }
    },
  );

  it.each(cutoverSurfaces)(
    "ships $tableName in the fresh baseline with cents columns and no legacy money columns",
    ({ tableName, legacyColumns, retainedColumns }) => {
      const block = baselineTableBlock(
        readFileSync(resolve(REPO_ROOT, FRESH_BASELINE), "utf8"),
        tableName,
      );

      for (const retained of retainedColumns) {
        expect(declaresColumn(block, retained), `${retained} is kept`).toBe(
          true,
        );
      }
      for (const legacy of legacyColumns) {
        expect(declaresColumn(block, legacy), `${legacy} is dropped`).toBe(
          false,
        );
      }
    },
  );

  it.each(["packages/database/migrations/0087_money_cents_cutover.sql"])(
    "covers every schema cutover surface in %s",
    (migrationPath) => {
      const sql = readFileSync(resolve(REPO_ROOT, migrationPath), "utf8");

      for (const surface of mainMoneyCutoverSurfaces) {
        expect(sql).toContain(
          `('${surface.tableName}', (SELECT count(*) FROM \`${surface.tableName}\`))`,
        );
        expect(sql).toContain(
          `WHEN '${surface.tableName}' THEN (SELECT count(*) FROM \`${surface.tableName}\`)`,
        );

        for (const legacyColumn of surface.legacyColumns) {
          expect(sql).toContain(
            `ALTER TABLE \`${surface.tableName}\` DROP COLUMN \`${legacyColumn}\`;`,
          );
        }
      }
    },
  );

  it.each([
    "packages/database/migrations/0088_market_checkout_child_order_cents_cutover.sql",
  ])("covers market checkout child order cutover in %s", (migrationPath) => {
    const sql = readFileSync(resolve(REPO_ROOT, migrationPath), "utf8");
    expect(marketCheckoutChildOrderSurface).toBeDefined();

    expect(sql).toContain(
      "('market_checkout_child_orders', (SELECT count(*) FROM `market_checkout_child_orders`))",
    );
    expect(sql).toContain(
      "WHEN 'market_checkout_child_orders' THEN (SELECT count(*) FROM `market_checkout_child_orders`)",
    );

    for (const legacyColumn of marketCheckoutChildOrderSurface!.legacyColumns) {
      expect(sql).toContain(
        `ALTER TABLE \`market_checkout_child_orders\` DROP COLUMN \`${legacyColumn}\`;`,
      );
    }
  });
});
