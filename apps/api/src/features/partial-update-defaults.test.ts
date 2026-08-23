import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";

import { authSchemas } from "./authentication/schemas/validation";
import { groupOrderSchemas } from "./group-orders/schemas/validation";
import { leaveSchemas } from "./leaves/schemas/validation";
import { menuSchemas } from "./menu/schemas/validation";
import { orderSchemas } from "./orders/schemas/validation";
import { paymentSchemas } from "./payments/schemas/validation";
import {
  updatePartnershipSchema,
  updatePlanSchema,
} from "./partnerships/schemas/validation";
import { qrCodeSchemas } from "./qr-codes/schemas/validation";
import { realtimeSchemas } from "./realtime/schemas/validation";
import { restaurantSchemas } from "./restaurants/schemas/validation";
import { schedulingSchemas } from "./scheduling/schemas/validation";
import { tableSchemas } from "./tables/schemas/validation";

/**
 * Guards the zod 4 hazard behind the data loss fixed alongside this test.
 *
 * `.partial()` does NOT strip `.default()`, so an update schema built as
 * `createSchema.partial()` materialises every defaulted field even for keys the
 * caller never sent. The update services write whatever keys are present, so
 * that silently overwrites columns — renaming a menu category reset its
 * sortOrder, editing one leave-type field reset its pay rules.
 *
 * Keep creation defaults on the create schema and let update schemas partial() a
 * base without them. This test walks every registered `update*` schema so a new
 * one cannot reintroduce the problem unnoticed.
 */
const REGISTRIES: Array<[string, Record<string, unknown>]> = [
  ["auth", authSchemas],
  ["groupOrders", groupOrderSchemas],
  ["leaves", leaveSchemas],
  ["menu", menuSchemas],
  ["orders", orderSchemas],
  ["payments", paymentSchemas],
  [
    "partnerships",
    {
      updatePartnershipSchema,
      updatePlanSchema,
    },
  ],
  ["qrCodes", qrCodeSchemas],
  ["realtime", realtimeSchemas],
  ["restaurants", restaurantSchemas],
  ["scheduling", schedulingSchemas],
  ["tables", tableSchemas],
];

function isZodSchema(value: unknown): value is ZodType {
  return (
    typeof value === "object" &&
    value !== null &&
    "safeParse" in value &&
    typeof (value as { safeParse: unknown }).safeParse === "function"
  );
}

/**
 * Full-replace endpoints, where materialising every field is the contract
 * rather than a bug. These are plain objects carrying defaults — never
 * `.partial()` — so they behave identically under zod 3 and zod 4.
 */
const REPLACE_SEMANTICS = new Set([
  // Service signature takes messagingChannels and faqs as required: the caller
  // submits the whole contact profile and it is written wholesale.
  "restaurants.updateContactProfile",
]);

const updateSchemas = REGISTRIES.flatMap(([feature, registry]) =>
  Object.entries(registry)
    .filter(([key]) => /^update/i.test(key))
    .filter(([, schema]) => isZodSchema(schema))
    .map(([key, schema]) => [`${feature}.${key}`, schema as ZodType] as const)
    .filter(([name]) => !REPLACE_SEMANTICS.has(name)),
);

describe("update schemas do not inject creation defaults", () => {
  it("finds update schemas to check", () => {
    // Guards the guard: an import or naming change must not silently empty this.
    expect(updateSchemas.length).toBeGreaterThan(5);
  });

  for (const [name, schema] of updateSchemas) {
    it(name, () => {
      const result = schema.safeParse({});

      // Rejecting an empty body outright is fine — nothing can be written.
      if (!result.success) return;

      expect(
        Object.keys(result.data as Record<string, unknown>),
        `${name} materialised keys for an empty body; a partial update would ` +
          `write these over the existing row. Move the defaults onto the ` +
          `create schema and partial() a base without them.`,
      ).toEqual([]);
    });
  }
});
