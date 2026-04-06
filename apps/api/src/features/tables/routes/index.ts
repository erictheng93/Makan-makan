/**
 * Tables Routes
 *
 * HTTP route definitions for table management
 */

import { Hono } from "hono";
import { authMiddleware, requireRole } from "../../../middleware/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "../../../middleware/validation";
import { USER_ROLES } from "@makanmakan/database";
import type { Env } from "../../../types/env";
import {
  notFound,
  forbidden,
  badRequest,
} from "../../../shared/utils/api-error";

import { TablesService } from "../services/TablesService";
import { tableSchemas } from "../schemas/validation";

const app = new Hono<{ Bindings: Env }>();

/**
 * Get restaurant tables
 * GET /tables
 */
app.get(
  "/",
  authMiddleware,
  requireRole([
    USER_ROLES.ADMIN,
    USER_ROLES.OWNER,
    USER_ROLES.CHEF,
    USER_ROLES.SERVICE,
    USER_ROLES.CASHIER,
  ]),
  validateQuery(tableSchemas.filters as any),
  async (c) => {
    const filters = c.get("validatedQuery");
    const currentUser = c.get("user");
    const tablesService = new TablesService(c.env);

    // Permission check: non-admins can only view their own restaurant's tables
    let restaurantId = filters.restaurantId;
    if (currentUser.role !== USER_ROLES.ADMIN) {
      restaurantId = currentUser.restaurantId || "";
    }

    if (!restaurantId) {
      throw badRequest("Restaurant ID is required");
    }

    const result = await tablesService.getRestaurantTables(restaurantId, {
      ...filters,
      restaurantId: undefined, // Remove from filters since it's used as parameter
    });

    return c.json({
      success: true,
      data: result.tables,
      pagination: result.pagination,
    });
  },
);

/**
 * Get single table details
 * GET /tables/:id
 */
app.get(
  "/:id",
  authMiddleware,
  requireRole([
    USER_ROLES.ADMIN,
    USER_ROLES.OWNER,
    USER_ROLES.CHEF,
    USER_ROLES.SERVICE,
    USER_ROLES.CASHIER,
  ]),
  validateParams(tableSchemas.idParam as any),
  async (c) => {
    const { id } = c.get("validatedParams") as { id: number };
    const currentUser = c.get("user");
    const tablesService = new TablesService(c.env);

    const table = await tablesService.getTableById(id);

    if (!table) {
      throw notFound("Table not found");
    }

    // Permission check: non-admins can only view their own restaurant's tables
    if (
      !tablesService.validateTableAccess(
        table,
        currentUser.restaurantId || "",
        currentUser.role === USER_ROLES.ADMIN,
      )
    ) {
      throw forbidden("Access denied");
    }

    return c.json({
      success: true,
      data: table,
    });
  },
);

// Handler function for creating tables
const createTableHandler = async (c: any) => {
  const data = c.get("validatedBody") as any;
  const currentUser = c.get("user");
  const tablesService = new TablesService(c.env);

  // Permission check: non-admins can only create tables for their own restaurant
  if (
    !tablesService.validateRestaurantAccess(
      data.restaurantId,
      currentUser.restaurantId || "",
      currentUser.role === USER_ROLES.ADMIN,
    )
  ) {
    throw forbidden("Can only create tables for your own restaurant");
  }

  const newTable = await tablesService.createTable(data);

  return c.json(
    {
      success: true,
      data: newTable,
    },
    201,
  );
};

/**
 * Create new table
 * POST /tables
 */
app.post(
  "/",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateBody(tableSchemas.create),
  createTableHandler,
);

/**
 * Update table information
 * PUT /tables/:id
 */
app.put(
  "/:id",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(tableSchemas.idParam as any),
  validateBody(tableSchemas.update),
  async (c) => {
    const { id } = c.get("validatedParams") as { id: number };
    const data = c.get("validatedBody") as any;
    const currentUser = c.get("user");
    const tablesService = new TablesService(c.env);

    const existingTable = await tablesService.getTableById(id);

    if (!existingTable) {
      throw notFound("Table not found");
    }

    // Permission check: non-admins can only update their own restaurant's tables
    if (
      !tablesService.validateTableAccess(
        existingTable,
        currentUser.restaurantId || "",
        currentUser.role === USER_ROLES.ADMIN,
      )
    ) {
      throw forbidden("Access denied");
    }

    const updatedTable = await tablesService.updateTable(id, data);

    return c.json({
      success: true,
      data: updatedTable,
    });
  },
);

/**
 * Delete table
 * DELETE /tables/:id
 */
app.delete(
  "/:id",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(tableSchemas.idParam as any),
  async (c) => {
    const { id } = c.get("validatedParams") as { id: number };
    const currentUser = c.get("user");
    const tablesService = new TablesService(c.env);

    const existingTable = await tablesService.getTableById(id);

    if (!existingTable) {
      throw notFound("Table not found");
    }

    // Permission check: non-admins can only delete their own restaurant's tables
    if (
      !tablesService.validateTableAccess(
        existingTable,
        currentUser.restaurantId || "",
        currentUser.role === USER_ROLES.ADMIN,
      )
    ) {
      throw forbidden("Access denied");
    }

    const success = await tablesService.deleteTable(id);

    if (!success) {
      throw badRequest("Failed to delete table");
    }

    return c.json({
      success: true,
      message: "Table deleted successfully",
    });
  },
);

/**
 * Occupy table
 * POST /tables/:id/occupy
 */
app.post(
  "/:id/occupy",
  authMiddleware,
  requireRole([
    USER_ROLES.ADMIN,
    USER_ROLES.OWNER,
    USER_ROLES.SERVICE,
    USER_ROLES.CASHIER,
  ]),
  validateParams(tableSchemas.idParam as any),
  validateBody(tableSchemas.occupy),
  async (c) => {
    const { id } = c.get("validatedParams") as { id: number };
    const { orderId, occupiedBy, estimatedMinutes } = c.get("validatedBody");
    const currentUser = c.get("user");
    const tablesService = new TablesService(c.env);

    const table = await tablesService.getTableById(id);

    if (!table) {
      throw notFound("Table not found");
    }

    // Permission check: non-admins can only operate their own restaurant's tables
    if (
      !tablesService.validateTableAccess(
        table,
        currentUser.restaurantId || "",
        currentUser.role === USER_ROLES.ADMIN,
      )
    ) {
      throw forbidden("Access denied");
    }

    if (table.isOccupied) {
      throw badRequest("Table is already occupied");
    }

    const success = await tablesService.occupyTable(
      id,
      orderId,
      occupiedBy,
      estimatedMinutes,
    );

    if (!success) {
      throw badRequest("Failed to occupy table");
    }

    return c.json({
      success: true,
      message: "Table occupied successfully",
    });
  },
);

/**
 * Release table
 * POST /tables/:id/release
 */
app.post(
  "/:id/release",
  authMiddleware,
  requireRole([
    USER_ROLES.ADMIN,
    USER_ROLES.OWNER,
    USER_ROLES.SERVICE,
    USER_ROLES.CASHIER,
  ]),
  validateParams(tableSchemas.idParam as any),
  async (c) => {
    const { id } = c.get("validatedParams") as { id: number };
    const currentUser = c.get("user");
    const tablesService = new TablesService(c.env);

    const table = await tablesService.getTableById(id);

    if (!table) {
      throw notFound("Table not found");
    }

    // Permission check: non-admins can only operate their own restaurant's tables
    if (
      !tablesService.validateTableAccess(
        table,
        currentUser.restaurantId || "",
        currentUser.role === USER_ROLES.ADMIN,
      )
    ) {
      throw forbidden("Access denied");
    }

    const success = await tablesService.releaseTable(id);

    if (!success) {
      throw badRequest("Failed to release table");
    }

    return c.json({
      success: true,
      message: "Table released successfully",
    });
  },
);

/**
 * Mark table as cleaned
 * POST /tables/:id/clean
 */
app.post(
  "/:id/clean",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER, USER_ROLES.SERVICE]),
  validateParams(tableSchemas.idParam as any),
  validateBody(tableSchemas.clean),
  async (c) => {
    const { id } = c.get("validatedParams") as { id: number };
    const { notes } = c.get("validatedBody");
    const currentUser = c.get("user");
    const tablesService = new TablesService(c.env);

    const table = await tablesService.getTableById(id);

    if (!table) {
      throw notFound("Table not found");
    }

    // Permission check: non-admins can only operate their own restaurant's tables
    if (
      !tablesService.validateTableAccess(
        table,
        currentUser.restaurantId || "",
        currentUser.role === USER_ROLES.ADMIN,
      )
    ) {
      throw forbidden("Access denied");
    }

    const success = await tablesService.markTableCleaned(id, notes);

    if (!success) {
      throw badRequest("Failed to mark table as cleaned");
    }

    return c.json({
      success: true,
      message: "Table marked as cleaned successfully",
    });
  },
);

/**
 * Regenerate table QR code
 * POST /tables/:id/regenerate-qr
 */
app.post(
  "/:id/regenerate-qr",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(tableSchemas.idParam as any),
  validateBody(tableSchemas.regenerateQR),
  async (c) => {
    const { id } = c.get("validatedParams") as { id: number };
    const { customData } = c.get("validatedBody");
    const currentUser = c.get("user");
    const tablesService = new TablesService(c.env);

    const table = await tablesService.getTableById(id);

    if (!table) {
      throw notFound("Table not found");
    }

    // Permission check: non-admins can only operate their own restaurant's tables
    if (
      !tablesService.validateTableAccess(
        table,
        currentUser.restaurantId || "",
        currentUser.role === USER_ROLES.ADMIN,
      )
    ) {
      throw forbidden("Access denied");
    }

    const result = await tablesService.regenerateQRCode(id, customData);

    if (!result.success) {
      throw badRequest(result.error || "Failed to regenerate QR code");
    }

    return c.json({
      success: true,
      data: {
        qrCode: result.qrCode,
      },
      message: "QR code regenerated successfully",
    });
  },
);

/**
 * Bulk generate QR codes
 * POST /tables/bulk-qr
 */
app.post(
  "/bulk-qr",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateBody(tableSchemas.bulkQR),
  async (c) => {
    const {
      restaurantId,
      tableIds,
      options = {},
    } = c.get("validatedBody") as any;
    const currentUser = c.get("user");
    const tablesService = new TablesService(c.env);

    // Permission check: non-admins can only operate their own restaurant's tables
    if (
      !tablesService.validateRestaurantAccess(
        restaurantId,
        currentUser.restaurantId || "",
        currentUser.role === USER_ROLES.ADMIN,
      )
    ) {
      throw forbidden("Access denied");
    }

    const result = await tablesService.generateBulkQRCodes(
      restaurantId,
      tableIds,
      options,
    );

    if (!result.success) {
      throw badRequest(result.error || "Failed to generate QR codes");
    }

    return c.json({
      success: true,
      data: result.qrCodes,
      message: "QR codes generated successfully",
    });
  },
);

/**
 * Get available tables
 * GET /tables/available
 */
app.get(
  "/available",
  authMiddleware,
  requireRole([
    USER_ROLES.ADMIN,
    USER_ROLES.OWNER,
    USER_ROLES.SERVICE,
    USER_ROLES.CASHIER,
  ]),
  validateQuery(tableSchemas.availableTables as any),
  async (c) => {
    const { restaurantId, capacity } = c.get("validatedQuery") as any;
    const currentUser = c.get("user");
    const tablesService = new TablesService(c.env);

    // Permission check: non-admins can only view their own restaurant's tables
    if (
      !tablesService.validateRestaurantAccess(
        restaurantId,
        currentUser.restaurantId || "",
        currentUser.role === USER_ROLES.ADMIN,
      )
    ) {
      throw forbidden("Access denied");
    }

    const availableTables = await tablesService.getAvailableTables(
      restaurantId,
      capacity,
    );

    return c.json({
      success: true,
      data: availableTables,
    });
  },
);

/**
 * Get table statistics
 * GET /tables/stats
 */
app.get(
  "/stats",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateQuery(tableSchemas.stats as any),
  async (c) => {
    const { restaurantId } = c.get("validatedQuery") as any;
    const currentUser = c.get("user");
    const tablesService = new TablesService(c.env);

    // Permission check: non-admins can only view their own restaurant's statistics
    if (
      !tablesService.validateRestaurantAccess(
        restaurantId,
        currentUser.restaurantId || "",
        currentUser.role === USER_ROLES.ADMIN,
      )
    ) {
      throw forbidden("Access denied");
    }

    const stats = await tablesService.getTableStats(restaurantId);

    return c.json({
      success: true,
      data: stats,
    });
  },
);

/**
 * Get table information by QR code
 * GET /tables/qr/:qrCode
 */
app.get(
  "/qr/:qrCode",
  validateParams(tableSchemas.qrCodeParam as any),
  async (c) => {
    const { qrCode } = c.get("validatedParams") as any;
    const tablesService = new TablesService(c.env);

    const table = await tablesService.getTableByQRCode(
      decodeURIComponent(qrCode),
    );

    if (!table) {
      throw notFound("Invalid QR code or table not found");
    }

    // Return only public information
    const publicTableInfo = tablesService.getPublicTableInfo(table);

    return c.json({
      success: true,
      data: publicTableInfo,
    });
  },
);

export default app;
