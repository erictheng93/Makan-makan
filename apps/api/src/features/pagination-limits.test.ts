import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { commonSchemas } from "../middleware/validation";
import { productQuerySchema } from "./ai-analytics/schemas/validation";
import { analyticsQuerySchema } from "./analytics/schemas/validation";
import { listBackupsSchema } from "./backup/routes";
import { couponFiltersSchema } from "./coupons/schemas/validation";
import { myOrdersSchema } from "./customers/routes";
import {
  dishSearchQuerySchema,
  restaurantBrowseQuerySchema,
  serviceSearchQuerySchema,
} from "./discovery/schemas/validation";
import { feedbackFiltersSchema } from "./feedback/schemas/validation";
import { ingredientListQuerySchema } from "./ingredients/schemas/validation";
import { kitchenOrdersQuerySchema } from "./kitchen/schemas/validation";
import { leaveRequestFiltersSchema } from "./leaves/schemas/validation";
import { auditLogQuerySchema } from "./manager/schemas/validation";
import {
  marketListQuerySchema,
  marketVendorsQuerySchema,
} from "./markets/schemas/validation";
import { paginationSchema as monitoringPaginationSchema } from "./monitoring/schemas/validation";
import {
  kitchenOrderFilterSchema,
  orderFilterSchema,
  popularItemsQuerySchema as orderPopularItemsQuerySchema,
} from "./orders/schemas/validation";
import {
  memberFiltersSchema,
  paginationSchema as partnershipPaginationSchema,
  partnershipFiltersSchema,
  planFiltersSchema,
  usageLogFiltersSchema,
} from "./partnerships/schemas/validation";
import { receiptListQuerySchema } from "./pos/routes/receipts";
import { refundListQuerySchema } from "./pos/routes/refunds";
import { queryPaginationSchema } from "./pos/schemas/validation";
import {
  conflictFiltersSchema,
  scheduleFiltersSchema,
  swapRequestFiltersSchema,
} from "./scheduling/schemas/validation";
import { seatFilterSchema } from "./seats/schemas/validation";
import { tableFilterSchema } from "./tables/schemas/validation";
import { userFilterSchema, userSearchSchema } from "./users/schemas/validation";

type LimitCase = {
  name: string;
  schema: z.ZodType;
  base?: Record<string, unknown>;
  max?: number;
  hasPage?: boolean;
};

const cappedLimitCases: LimitCase[] = [
  {
    name: "common pagination",
    schema: commonSchemas.paginationQuery,
    hasPage: true,
  },
  { name: "analytics queries", schema: analyticsQuerySchema },
  { name: "AI analytics products", schema: productQuerySchema },
  {
    name: "backup list",
    schema: listBackupsSchema,
    base: { restaurant_id: "01940000-0000-7000-8000-000000000001" },
    hasPage: true,
  },
  { name: "coupon filters", schema: couponFiltersSchema, hasPage: true },
  { name: "customer order history", schema: myOrdersSchema, hasPage: true },
  {
    name: "discovery dish search",
    schema: dishSearchQuerySchema,
    base: { q: "rice" },
    max: 50,
    hasPage: true,
  },
  {
    name: "discovery restaurant browse",
    schema: restaurantBrowseQuerySchema,
    max: 50,
    hasPage: true,
  },
  {
    name: "discovery service search",
    schema: serviceSearchQuerySchema,
    base: { q: "delivery" },
    max: 50,
    hasPage: true,
  },
  { name: "feedback filters", schema: feedbackFiltersSchema, hasPage: true },
  { name: "ingredient list", schema: ingredientListQuerySchema, hasPage: true },
  {
    name: "kitchen display orders",
    schema: kitchenOrdersQuerySchema,
    max: 200,
  },
  {
    name: "leave request filters",
    schema: leaveRequestFiltersSchema,
    hasPage: true,
  },
  { name: "manager audit log", schema: auditLogQuerySchema },
  {
    name: "market list",
    schema: marketListQuerySchema,
    max: 50,
    hasPage: true,
  },
  {
    name: "market vendors",
    schema: marketVendorsQuerySchema,
    max: 50,
    hasPage: true,
  },
  {
    name: "monitoring pagination",
    schema: monitoringPaginationSchema,
    hasPage: true,
  },
  { name: "order filters", schema: orderFilterSchema, hasPage: true },
  {
    name: "orders popular items",
    schema: orderPopularItemsQuerySchema,
    base: { restaurantId: 1 },
  },
  {
    name: "kitchen order filters",
    schema: kitchenOrderFilterSchema,
    base: { restaurantId: 1 },
  },
  {
    name: "partnership filters",
    schema: partnershipFiltersSchema,
    hasPage: true,
  },
  {
    name: "partnership plan filters",
    schema: planFiltersSchema,
    hasPage: true,
  },
  {
    name: "partnership member filters",
    schema: memberFiltersSchema,
    hasPage: true,
  },
  {
    name: "partnership usage log filters",
    schema: usageLogFiltersSchema,
    hasPage: true,
  },
  {
    name: "partnership pagination",
    schema: partnershipPaginationSchema,
    hasPage: true,
  },
  {
    name: "POS query pagination",
    schema: queryPaginationSchema,
    hasPage: true,
  },
  { name: "POS receipt list", schema: receiptListQuerySchema, hasPage: true },
  { name: "POS refund list", schema: refundListQuerySchema, hasPage: true },
  { name: "schedule filters", schema: scheduleFiltersSchema, hasPage: true },
  { name: "conflict filters", schema: conflictFiltersSchema, hasPage: true },
  {
    name: "swap request filters",
    schema: swapRequestFiltersSchema,
    hasPage: true,
  },
  {
    name: "seat filters",
    schema: seatFilterSchema,
    base: { tableId: "1" },
    hasPage: true,
  },
  { name: "table filters", schema: tableFilterSchema, hasPage: true },
  { name: "user filters", schema: userFilterSchema, hasPage: true },
  { name: "user search", schema: userSearchSchema, base: { query: "amy" } },
];

describe("feature query pagination limits", () => {
  it.each(cappedLimitCases)(
    "$name accepts its documented limit boundary",
    ({ schema, base = {}, max = 100 }) => {
      expect(schema.parse({ ...base, limit: String(max) })).toMatchObject({
        limit: max,
      });
    },
  );

  it.each(cappedLimitCases)(
    "$name rejects over-limit queries",
    ({ schema, base = {}, max = 100 }) => {
      expect(() => schema.parse({ ...base, limit: String(max + 1) })).toThrow();
    },
  );

  it.each(cappedLimitCases.filter(({ hasPage }) => hasPage))(
    "$name rejects over-limit pages",
    ({ schema, base = {} }) => {
      expect(() => schema.parse({ ...base, page: "1001" })).toThrow();
    },
  );
});
