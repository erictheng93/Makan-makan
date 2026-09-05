import {
  TenantMemberDirectoryService,
  type TenantMemberListItem,
} from "@makanmasak/database";
import { Hono } from "hono";
import {
  authMiddleware,
  requireRestaurantAccess,
  requireRole,
} from "../../../middleware/auth";
import {
  validateBody,
  validateOptionalBody,
  validateParams,
  validateQuery,
} from "../../../middleware/validation";
import { forbidden, notFound } from "../../../shared/utils/api-error";
import type { Env } from "../../../types/env";
import { toCsv } from "../../../shared/utils/csv";
import {
  memberExportBodySchema,
  memberListQuerySchema,
  memberOrdersQuerySchema,
  memberParamSchema,
  memberPatchBodySchema,
  memberRevealContactBodySchema,
  restaurantIdParamSchema,
} from "../schemas/validation";
import { enforcePiiRevealThrottle } from "../services/pii-reveal-throttle";

const routes = new Hono<{ Bindings: Env }>();

function directory(env: Env) {
  return new TenantMemberDirectoryService(env.DB, env);
}

// The first user-controlled id is path-bound by requireRestaurantAccess. The
// member id is then resolved under that same scope in every handler below.
routes.get(
  "/:restaurantId/members",
  authMiddleware,
  requireRole([0, 1]),
  requireRestaurantAccess("restaurantId"),
  validateParams(restaurantIdParamSchema),
  validateQuery(memberListQuerySchema),
  async (c) => {
    const { restaurantId } = c.get("validatedParams");
    const filters = c.get("validatedQuery");
    const result = await directory(c.env).list({ restaurantId }, filters);
    return c.json({
      success: true,
      data: result.members,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: result.pages,
      },
    });
  },
);

routes.get(
  "/:restaurantId/members/stats",
  authMiddleware,
  requireRole([0, 1]),
  requireRestaurantAccess("restaurantId"),
  validateParams(restaurantIdParamSchema),
  async (c) => {
    const { restaurantId } = c.get("validatedParams");
    return c.json({
      success: true,
      data: await directory(c.env).stats({ restaurantId }),
    });
  },
);

routes.get(
  "/:restaurantId/members/:memberId",
  authMiddleware,
  requireRole([0, 1]),
  requireRestaurantAccess("restaurantId"),
  validateParams(memberParamSchema),
  async (c) => {
    const { restaurantId, memberId } = c.get("validatedParams");
    const member = await directory(c.env).get({ restaurantId }, memberId);
    if (!member) throw notFound("Member not found", "MEMBER_NOT_FOUND");
    return c.json({ success: true, data: member });
  },
);

// Tags / note / block marker (issue #299 A3). Tenant-local fields only —
// `isBlocked` is a marker, not enforcement; see the comment on
// TenantMemberDirectoryService.update() for why a guest order still walks
// straight through a blocked member and why that is not "finished" here.
routes.patch(
  "/:restaurantId/members/:memberId",
  authMiddleware,
  requireRole([0, 1]),
  requireRestaurantAccess("restaurantId"),
  validateParams(memberParamSchema),
  validateBody(memberPatchBodySchema),
  async (c) => {
    const { restaurantId, memberId } = c.get("validatedParams");
    const patch = c.get("validatedBody");
    const actor = c.get("user");

    const result = await directory(c.env).update(
      { restaurantId },
      memberId,
      patch,
      {
        userId: actor.id,
        ipAddress: c.req.header("CF-Connecting-IP") ?? null,
        userAgent: c.req.header("User-Agent") ?? null,
      },
    );

    // Same 404 as the GET, for the same reason: another tenant's member must
    // not be distinguishable from one that does not exist.
    if (result.outcome === "not-found") {
      throw notFound("Member not found", "MEMBER_NOT_FOUND");
    }

    return c.json({ success: true, data: result.member });
  },
);

routes.get(
  "/:restaurantId/members/:memberId/orders",
  authMiddleware,
  requireRole([0, 1]),
  requireRestaurantAccess("restaurantId"),
  validateParams(memberParamSchema),
  validateQuery(memberOrdersQuerySchema),
  async (c) => {
    const { restaurantId, memberId } = c.get("validatedParams");
    const { page, limit } = c.get("validatedQuery");
    const result = await directory(c.env).listOrders(
      { restaurantId },
      memberId,
      page,
      limit,
    );
    if (!result) throw notFound("Member not found", "MEMBER_NOT_FOUND");
    return c.json({
      success: true,
      data: result.orders,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        pages: result.pages,
      },
    });
  },
);

// PII disclosure. A POST rather than a GET on purpose: it is a state change —
// it writes an audit row and spends a rate-limit budget — and must never be
// cacheable, prefetchable, or reachable by following a link.
routes.post(
  "/:restaurantId/members/:memberId/reveal-contact",
  authMiddleware,
  requireRole([0, 1]),
  requireRestaurantAccess("restaurantId"),
  validateParams(memberParamSchema),
  validateOptionalBody(memberRevealContactBodySchema),
  async (c) => {
    const { restaurantId, memberId } = c.get("validatedParams");
    const { reason } = c.get("validatedBody");
    const actor = c.get("user");

    await enforcePiiRevealThrottle(c, actor.id);

    // The service writes the audit row and only then returns the values; an
    // audit failure propagates and this handler never reaches its response.
    const result = await directory(c.env).revealContact(
      { restaurantId },
      memberId,
      {
        userId: actor.id,
        ipAddress: c.req.header("CF-Connecting-IP") ?? null,
        userAgent: c.req.header("User-Agent") ?? null,
      },
      reason,
    );

    // Same 404 as the GET, for the same reason: another tenant's member must
    // not be distinguishable from one that does not exist.
    if (result.outcome === "not-found") {
      throw notFound("Member not found", "MEMBER_NOT_FOUND");
    }
    if (result.outcome === "deleted") {
      throw forbidden(
        "Contact details are not available for a deleted customer",
        "MEMBER_DELETED",
      );
    }

    return c.json({
      success: true,
      data: {
        memberId: result.contact.memberId,
        phone: result.contact.phone,
        email: result.contact.email,
        revealedAt: Date.now(),
      },
    });
  },
);

/**
 * Masked CSV of the directory (spec §7.1). POST rather than GET for the same
 * reason `reveal-contact` is: it writes an audit row, so it must not be
 * cacheable, prefetchable, or reachable by following a link. The body carries
 * the same filters as the list, so an operator exports exactly the rows they
 * are looking at.
 */
routes.post(
  "/:restaurantId/members/export",
  authMiddleware,
  requireRole([0, 1]),
  requireRestaurantAccess("restaurantId"),
  validateParams(restaurantIdParamSchema),
  validateOptionalBody(memberExportBodySchema),
  async (c) => {
    const { restaurantId } = c.get("validatedParams");
    const filters = c.get("validatedBody");
    const actor = c.get("user");

    // The service writes the audit row and only then returns the rows; an
    // audit failure propagates and this handler never reaches its response.
    const result = await directory(c.env).exportMembers(
      { restaurantId },
      filters,
      {
        userId: actor.id,
        ipAddress: c.req.header("CF-Connecting-IP") ?? null,
        userAgent: c.req.header("User-Agent") ?? null,
      },
    );

    const suffix = new Date().toISOString().slice(0, 10);
    return new Response(buildMemberCsv(result.members), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="members-${restaurantId}-${suffix}.csv"`,
        // The file is capped; say so in a header a client can surface rather
        // than letting an operator reconcile against a silently short export.
        "x-export-total": String(result.total),
        "x-export-truncated": String(result.truncated),
      },
    });
  },
);

/**
 * Manual rollup reconciliation (spec §7.1). `requireRole([0])` -- platform
 * staff only. The live path already recomputes on every order event, so this
 * exists for the case where one of those was lost, and it can delete a
 * membership row whose orders are all cancelled; that is not a button to hand
 * a tenant.
 */
routes.post(
  "/:restaurantId/members/recompute",
  authMiddleware,
  requireRole([0]),
  requireRestaurantAccess("restaurantId"),
  validateParams(restaurantIdParamSchema),
  async (c) => {
    const { restaurantId } = c.get("validatedParams");
    return c.json({
      success: true,
      data: await directory(c.env).recomputeAll({ restaurantId }),
    });
  },
);

/**
 * Stable snake_case headers, not localized ones: this file is read by
 * spreadsheets and scripts, and a header row that changed with the operator's
 * UI language would break every one of them.
 *
 * The leading BOM is a deliberate departure from the credit-ledger export,
 * which has none. That file is account codes and numbers; this one is customer
 * display names, which in this product are Chinese, Japanese or Vietnamese by
 * default -- and Excel on Windows reads a BOM-less UTF-8 file as the system
 * codepage and renders every one of them as mojibake.
 */
function buildMemberCsv(members: TenantMemberListItem[]): string {
  const headers = [
    "member_id",
    "display_name",
    "masked_phone",
    "masked_email",
    "locale",
    "order_count",
    "cancelled_order_count",
    "total_spent_cents",
    "avg_order_value_cents",
    "first_order_at_ms",
    "last_order_at_ms",
    "tags",
    "note",
    "is_blocked",
    "blocked_reason",
    "marketing_reachable",
    "status",
  ];
  const rows = members.map((member) => [
    member.memberId,
    member.displayName ?? "",
    member.maskedPhone ?? "",
    member.maskedEmail ?? "",
    member.locale ?? "",
    member.orderCount,
    member.cancelledOrderCount,
    member.totalSpentCents,
    member.avgOrderValueCents,
    member.firstOrderAt?.getTime() ?? "",
    member.lastOrderAt?.getTime() ?? "",
    // Pipe-separated, not space: a tag is free text up to 40 characters and
    // may well contain a space, which would make the cell unsplittable.
    (member.tags ?? []).join(" | "),
    member.note ?? "",
    member.isBlocked ? "true" : "false",
    member.blockedReason ?? "",
    member.marketingReachable ? "true" : "false",
    member.status,
  ]);
  return `\ufeff${toCsv([headers, ...rows])}`;
}

export default routes;
