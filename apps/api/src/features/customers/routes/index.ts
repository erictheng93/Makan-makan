/**
 * Customers Routes
 * API endpoints for customer-specific operations
 */

import { Hono } from "hono";
import { authMiddleware, requireRole } from "../../../shared/middleware";
import { validateQuery } from "../../../shared/middleware";
import { OrdersService } from "../../orders/services/OrdersService";
import { ConsoleLogger } from "../../../core/monitoring";
import type { Env } from "../../../shared/types";
import type { AuthUser } from "../../../middleware/auth";
import { z } from "zod";

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

/**
 * Get current customer's orders
 * GET /api/v1/customers/me/orders
 */
app.get(
  "/me/orders",
  authMiddleware,
  requireRole([5]), // Customers only
  validateQuery(myOrdersSchema),
  async (c) => {
    try {
      const query = c.get("validatedQuery");
      const user: AuthUser = c.get("user");
      const ordersService = new OrdersService(c.env);

      logger.debug("Getting customer orders", { customerId: user.id, query });

      // Build filters - always filter by current customer
      const filters: any = {
        customerId: user.id,
        page: query.page || 1,
        limit: query.limit || 20,
      };

      if (query.status) {
        filters.status = query.status;
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
        user.role as any,
      );

      return c.json({
        success: true,
        data: result.orders,
        pagination: result.pagination,
      });
    } catch (error) {
      logger.error(
        "Get customer orders error",
        error instanceof Error ? error : undefined,
        {},
      );
      return c.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to fetch orders",
        },
        500,
      );
    }
  },
);

/**
 * Get current customer's profile
 * GET /api/v1/customers/me
 */
app.get(
  "/me",
  authMiddleware,
  requireRole([5]), // Customers only
  async (c) => {
    try {
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
    } catch (error) {
      logger.error(
        "Get customer profile error",
        error instanceof Error ? error : undefined,
        {},
      );
      return c.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to fetch profile",
        },
        500,
      );
    }
  },
);

export default app;
