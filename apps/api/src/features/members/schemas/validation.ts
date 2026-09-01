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

export const memberListQuerySchema = z.object({
  page: boundedPageQuery(),
  limit: boundedLimitQuery("100"),
  search: z.string().trim().max(200).optional(),
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
