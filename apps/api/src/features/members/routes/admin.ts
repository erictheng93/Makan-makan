/**
 * Platform-side customer directory — spec §7.2, issue #299 stage A4.
 *
 * Mounted at `/api/v1/admin/customers`, under the `/admin/*` prefix that
 * already carries `authMiddleware`. Every route additionally declares
 * `requireRole([0])`, which also fails closed if this router is ever mounted
 * somewhere the prefix middleware does not reach: with no `user` on the
 * context it throws 401 rather than falling through.
 *
 * This is the only router in the product that speaks in `customers.id`. The
 * tenant routes in `./index.ts` deliberately cannot — see the class comment on
 * `PlatformCustomerDirectoryService`.
 */

import { PlatformCustomerDirectoryService } from "@makanmasak/database";
import { Hono } from "hono";
import { requireRole } from "../../../middleware/auth";
import {
  validateOptionalBody,
  validateParams,
  validateQuery,
} from "../../../middleware/validation";
import { forbidden, notFound } from "../../../shared/utils/api-error";
import type { Env } from "../../../types/env";
import {
  memberRevealContactBodySchema,
  platformCustomerListQuerySchema,
  platformCustomerParamSchema,
} from "../schemas/validation";
import { enforcePiiRevealThrottle } from "../services/pii-reveal-throttle";

const routes = new Hono<{ Bindings: Env }>();

const PLATFORM_ONLY = requireRole([0]);

function directory(env: Env) {
  return new PlatformCustomerDirectoryService(env.DB, env);
}

routes.get(
  "/",
  PLATFORM_ONLY,
  validateQuery(platformCustomerListQuerySchema),
  async (c) => {
    const filters = c.get("validatedQuery");
    const result = await directory(c.env).list(filters);
    return c.json({
      success: true,
      data: result.customers,
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
  "/:customerId",
  PLATFORM_ONLY,
  validateParams(platformCustomerParamSchema),
  async (c) => {
    const { customerId } = c.get("validatedParams");
    const customer = await directory(c.env).get(customerId);
    if (!customer) throw notFound("Customer not found", "CUSTOMER_NOT_FOUND");
    return c.json({ success: true, data: customer });
  },
);

/** Cross-tenant spend, the one view no tenant-scoped endpoint may produce. */
routes.get(
  "/:customerId/restaurants",
  PLATFORM_ONLY,
  validateParams(platformCustomerParamSchema),
  async (c) => {
    const { customerId } = c.get("validatedParams");
    const slices = await directory(c.env).listRestaurants(customerId);
    if (!slices) throw notFound("Customer not found", "CUSTOMER_NOT_FOUND");
    return c.json({ success: true, data: slices });
  },
);

/**
 * POST, audited, and throttled — the same three properties as the tenant
 * reveal and for the same reasons.
 *
 * The throttle key is `pii-reveal:actor:<userId>`, shared with the tenant
 * endpoint on purpose. The budget bounds how much customer contact data one
 * account can copy out per hour; splitting it by endpoint would hand a
 * platform admin twice the budget for no reason the security property cares
 * about.
 */
routes.post(
  "/:customerId/reveal-contact",
  PLATFORM_ONLY,
  validateParams(platformCustomerParamSchema),
  validateOptionalBody(memberRevealContactBodySchema),
  async (c) => {
    const { customerId } = c.get("validatedParams");
    const { reason } = c.get("validatedBody");
    const actor = c.get("user");

    await enforcePiiRevealThrottle(c, actor.id);

    const result = await directory(c.env).revealContact(
      customerId,
      {
        userId: actor.id,
        ipAddress: c.req.header("CF-Connecting-IP") ?? null,
        userAgent: c.req.header("User-Agent") ?? null,
      },
      reason,
    );

    if (result.outcome === "not-found") {
      throw notFound("Customer not found", "CUSTOMER_NOT_FOUND");
    }
    if (result.outcome === "deleted") {
      throw forbidden(
        "Contact details are not available for a deleted customer",
        "CUSTOMER_DELETED",
      );
    }

    return c.json({
      success: true,
      data: {
        customerId: result.contact.customerId,
        phone: result.contact.phone,
        email: result.contact.email,
        revealedAt: Date.now(),
      },
    });
  },
);

export default routes;
