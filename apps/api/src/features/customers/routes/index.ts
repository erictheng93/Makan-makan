/**
 * Customers Routes
 * API endpoints for customer-specific operations
 */

import { Hono } from "hono";
import {
  requireRole,
  staffOrUserCustomerAuthMiddleware,
} from "../../../shared/middleware";
import { validateQuery } from "../../../shared/middleware";
import { OrdersService } from "../../orders/services/OrdersService";
import { ConsoleLogger } from "../../../core/monitoring";
import type { Env } from "../../../shared/types";
import type { AuthUser } from "../../../middleware/auth";
import { z } from "zod";
import type { UserRole } from "../../../shared/constants";
import type { OrderQueryFilters } from "../../orders/types";
import type { OrderStatus as DbOrderStatus } from "@makanmakan/database";

// Create router
const app = new Hono<{ Bindings: Env }>();
const logger = new ConsoleLogger("CustomersRoutes");

// Validation schema for order query
const myOrdersSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val) : 20)),
  status: z.union([z.string(), z.array(z.string())]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});
type MyOrdersQuery = z.infer<typeof myOrdersSchema>;

function toOrderStatuses(status: MyOrdersQuery["status"]): DbOrderStatus[] {
  return (typeof status === "string" ? [status] : status) as DbOrderStatus[];
}

/**
 * Get current customer's orders
 * GET /api/v1/customers/me/orders
 */
app.get(
  "/me/orders",
  staffOrUserCustomerAuthMiddleware,
  requireRole([5]), // Customers only
  validateQuery(myOrdersSchema),
  async (c) => {
    const query = c.get("validatedQuery");
    const user: AuthUser = c.get("user");
    const ordersService = new OrdersService(c.env);

    logger.debug("Getting customer orders", { customerId: user.id, query });

    // Build filters - always filter by current customer
    const filters: OrderQueryFilters = {
      customerId: String(user.id),
      page: query.page || 1,
      limit: query.limit || 20,
    };

    if (query.status) {
      filters.status = toOrderStatuses(query.status);
    }

    if (query.dateFrom) {
      filters.dateFrom = new Date(query.dateFrom);
    }

    if (query.dateTo) {
      filters.dateTo = new Date(query.dateTo);
    }

    const result = await ordersService.getOrders(
      filters,
      user.id,
      user.role as UserRole,
    );

    return c.json({
      success: true,
      data: result.orders,
      pagination: result.pagination,
    });
  },
);

/**
 * Get current customer's profile
 * GET /api/v1/customers/me
 */
app.get(
  "/me",
  staffOrUserCustomerAuthMiddleware,
  requireRole([5]), // Customers only
  async (c) => {
    const user: AuthUser = c.get("user");

    logger.debug("Getting customer profile", { customerId: user.id });

    // Return user profile
    return c.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email || undefined,
        phone: user.phone || undefined,
        role: user.role,
      },
    });
  },
);

export default app;
