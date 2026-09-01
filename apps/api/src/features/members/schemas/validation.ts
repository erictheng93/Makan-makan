import { z } from "zod";
import {
  boundedLimitQuery,
  boundedPageQuery,
} from "../../../middleware/validation";

export const restaurantIdParamSchema = z.object({
  restaurantId: z.string().min(1),
});

export const memberParamSchema = restaurantIdParamSchema.extend({
  memberId: z.string().min(1),
});

/**
 * Size caps for the operator-supplied member fields below (spec §7.1 PATCH).
 * These strings land straight in restaurant_customers — a couple land in a
 * JSON column — so the caps exist to bound what one PATCH can write, not to
 * express a product opinion about how long a note "should" be.
 */
// A handful of genuinely distinct labels; past this it's not tagging anymore,
// it's a text field.
const MEMBER_MAX_TAGS = 20;
const MEMBER_TAG_MAX_LENGTH = 40; // a label like "vip-lapsed", not a sentence
const MEMBER_NOTE_MAX_LENGTH = 2000; // a few paragraphs of operator context, not a transcript
const MEMBER_BLOCKED_REASON_MAX_LENGTH = 500; // a justification, not a case file

export const memberListQuerySchema = z.object({
  page: boundedPageQuery(),
  limit: boundedLimitQuery("100"),
  search: z.string().trim().max(200).optional(),
  // Exact-match only (see TenantMemberDirectoryService.list): a JSON array
  // column compared with LIKE would let "vip" match "vip-lapsed".
  tag: z.string().trim().min(1).max(MEMBER_TAG_MAX_LENGTH).optional(),
  minOrders: z.coerce.number().int().min(0).optional(),
  minSpentCents: z.coerce.number().int().min(0).optional(),
  lastOrderFrom: z.coerce.date().optional(),
  lastOrderTo: z.coerce.date().optional(),
  blocked: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value == null ? undefined : value === "true")),
  sort: z.enum(["recent", "spent", "orders", "name"]).optional(),
});

export const memberOrdersQuerySchema = z.object({
  page: boundedPageQuery(),
  limit: boundedLimitQuery("100"),
});

/**
 * The reveal flow gates on a confirmation modal, not on typed justification,
 * so `reason` is optional and a bodyless POST is valid. When a client does send
 * one it is recorded in the audit metadata, which is why it is length-bounded
 * rather than free-form.
 */
export const memberRevealContactBodySchema = z.object({
  reason: z.string().trim().min(4).max(200).optional(),
});

/**
 * Tenant-local marker fields only (spec §7.1). `.strict()` is load-bearing:
 * any `customers` table column showing up in this body — `primaryPhone`,
 * `displayName`, anything — must 400 rather than be silently stripped, so a
 * client bug that means to edit a customer's own profile cannot end up
 * quietly writing nothing instead. `.refine` below rejects an empty body:
 * a PATCH with nothing to change is a caller bug, not a no-op 200.
 */
export const memberPatchBodySchema = z
  .object({
    // Replaces the whole list; there is no add/remove-one endpoint.
    tags: z
      .array(z.string().trim().min(1).max(MEMBER_TAG_MAX_LENGTH))
      .max(MEMBER_MAX_TAGS)
      .nullable()
      .optional(),
    note: z.string().trim().max(MEMBER_NOTE_MAX_LENGTH).nullable().optional(),
    isBlocked: z.boolean().optional(),
    blockedReason: z
      .string()
      .trim()
      .max(MEMBER_BLOCKED_REASON_MAX_LENGTH)
      .nullable()
      .optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided",
  });
