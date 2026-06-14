import { getTableConfig } from "drizzle-orm/sqlite-core";
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

function columnNames(table: Table): string[] {
  return getTableConfig(table).columns.map((column) => column.name);
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
});
