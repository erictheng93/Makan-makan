/**
 * Seats Routes
 * API endpoints for seat management
 */

import { Hono, type Context } from "hono";
import { SeatService, USER_ROLES } from "@makanmakan/database";
import {
  authMiddleware,
  requireRole,
  type AuthUser,
} from "../../../middleware/auth";
import { moduleGate } from "../../../middleware/moduleGate";
import {
  validateBody,
  validateQuery,
  validateParams,
  commonSchemas,
} from "../../../middleware/validation";
import type { Env } from "../../../types/env";
import {
  notFound,
  badRequest,
  forbidden,
} from "../../../shared/utils/api-error";
import {
  batchCreateSeatsSchema,
  updateSeatSchema,
  occupySeatSchema,
  seatFilterSchema,
  tableIdParamSchema,
  qrCodeParamSchema,
  tableIdQuerySchema,
  batchRegenerateQRSchema,
  type BatchCreateSeatsInput,
  type BatchRegenerateQRInput,
  type OccupySeatInput,
  type QrCodeParamInput,
  type SeatFilterInput,
  type TableIdParamInput,
  type TableIdQueryInput,
  type UpdateSeatInput,
} from "../schemas/validation";
import { TablesService } from "../../tables/services/TablesService";
import type { Table } from "../../tables/types";

const routes = new Hono<{ Bindings: Env }>();

type SeatsContext = Context<{
  Bindings: Env;
  Variables: {
    validatedBody?: unknown;
    validatedQuery?: unknown;
    validatedParams?: unknown;
    user: AuthUser;
  };
}>;

/** Create SeatService from Hono context */
function createSeatService(env: Env): SeatService {
  return new SeatService(env.DB, env);
}

function createTablesService(env: Env): TablesService {
  return new TablesService(env);
}

function seatsContext(c: Context): SeatsContext {
  return c as unknown as SeatsContext;
}

async function getTableWithAccessCheck(
  c: SeatsContext,
  tableId: number,
): Promise<Table> {
  const currentUser = c.get("user");
  const tablesService = createTablesService(c.env);
  const table = await tablesService.getTableById(tableId);

  if (!table) {
    throw notFound("Table not found");
  }

  if (currentUser.role === USER_ROLES.ADMIN) {
    return table;
  }

  const ownsRestaurant = tablesService.validateRestaurantAccess(
    table.restaurantId,
    String(currentUser.restaurantId ?? ""),
    false,
  );

  if (!ownsRestaurant) {
    throw forbidden("Access denied");
  }

  return table;
}

async function ensureTableAccess(
  c: SeatsContext,
  tableId: number,
): Promise<void> {
  await getTableWithAccessCheck(c, tableId);
}

async function getSeatWithAccessCheck(
  c: SeatsContext,
  seatId: number,
): Promise<Record<string, unknown>> {
  const currentUser = c.get("user");
  const seatService = createSeatService(c.env);
  const seat = await seatService.getSeatById(seatId);

  if (!seat) {
    throw notFound("Seat not found");
  }

  if (currentUser.role !== USER_ROLES.ADMIN) {
    const userRestaurantId = String(currentUser.restaurantId ?? "");
    if (String(seat.restaurantId) !== userRestaurantId) {
      throw forbidden("Access denied");
    }
  }

  return seat;
}

/**
 * GET /
 * Get all seats for a table
 */
routes.get(
  "/",
  authMiddleware,
  moduleGate("table_management"),
  requireRole([
    USER_ROLES.ADMIN,
    USER_ROLES.OWNER,
    USER_ROLES.CHEF,
    USER_ROLES.SERVICE,
    USER_ROLES.CASHIER,
  ]),
  validateQuery(seatFilterSchema),
  async (c) => {
    const filters = c.get("validatedQuery") as SeatFilterInput;
    const { tableId } = filters;
    await ensureTableAccess(seatsContext(c), tableId);

    const seatService = createSeatService(c.env);

    const { ...otherFilters } = filters;
    const result = await seatService.getSeatsByTableId(tableId, otherFilters);

    return c.json({
      success: true,
      data: result.seats,
      total: result.total,
      pagination: result.pagination,
    });
  },
);

/**
 * GET /stats
 * Get seat statistics for a table
 */
routes.get(
  "/stats",
  authMiddleware,
  moduleGate("table_management"),
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateQuery(tableIdQuerySchema),
  async (c) => {
    const { tableId } = c.get("validatedQuery") as TableIdQueryInput;
    await ensureTableAccess(seatsContext(c), tableId);

    const seatService = createSeatService(c.env);

    const stats = await seatService.getSeatStats(tableId);

    return c.json({
      success: true,
      data: stats,
    });
  },
);

/**
 * GET /qr/:qrCode
 * Get seat information by QR code (public endpoint)
 */
routes.get("/qr/:qrCode", validateParams(qrCodeParamSchema), async (c) => {
  const { qrCode } = c.get("validatedParams") as QrCodeParamInput;
  const seatService = createSeatService(c.env);

  const seat = await seatService.getSeatByQRCode(decodeURIComponent(qrCode));

  if (!seat) {
    throw notFound("Invalid QR code or seat not found");
  }

  // Only return public information
  const publicSeatInfo = {
    id: seat.id,
    tableId: seat.tableId,
    tableNumber: seat.tableNumber,
    restaurantId: seat.restaurantId,
    restaurantName: seat.restaurantName,
    seatNumber: seat.seatNumber,
    seatName: seat.seatName,
    isActive: seat.isActive,
    isOccupied: seat.isOccupied,
    capacity: seat.capacity,
  };

  return c.json({
    success: true,
    data: publicSeatInfo,
  });
});

/**
 * GET /:id
 * Get single seat details
 */
routes.get(
  "/:id",
  authMiddleware,
  moduleGate("table_management"),
  requireRole([
    USER_ROLES.ADMIN,
    USER_ROLES.OWNER,
    USER_ROLES.CHEF,
    USER_ROLES.SERVICE,
    USER_ROLES.CASHIER,
  ]),
  validateParams(commonSchemas.idParam),
  async (c) => {
    const { id } = c.get("validatedParams") as { id: number };
    const seat = await getSeatWithAccessCheck(seatsContext(c), id);

    return c.json({
      success: true,
      data: seat,
    });
  },
);

/**
 * POST /batch-create
 * Batch create seats for a table
 */
routes.post(
  "/batch-create",
  authMiddleware,
  moduleGate("table_management"),
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateBody(batchCreateSeatsSchema),
  async (c) => {
    const data = c.get("validatedBody") as BatchCreateSeatsInput;
    const { tableId } = data;
    const table = await getTableWithAccessCheck(seatsContext(c), tableId);

    const seatService = createSeatService(c.env);

    const { seatCount, numberingStyle, customNumbers, prefix } = data;
    const existingSeats = await seatService.getSeatsByTableId(tableId, {
      limit: Math.max(table.capacity, 1),
    });

    if (existingSeats.total + seatCount > table.capacity) {
      throw badRequest(
        "Seat count must be positive and cannot exceed table capacity",
      );
    }

    const seats = await seatService.createSeatsForTable(tableId, seatCount, {
      numberingStyle,
      customNumbers,
      prefix,
    });

    return c.json(
      {
        success: true,
        data: seats,
        message: `Successfully created ${seats.length} seats`,
      },
      201,
    );
  },
);

/**
 * POST /batch-regenerate-qr
 * Batch regenerate QR codes for all seats of a table
 */
routes.post(
  "/batch-regenerate-qr",
  authMiddleware,
  moduleGate("table_management"),
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateBody(batchRegenerateQRSchema),
  async (c) => {
    const { tableId } = c.get("validatedBody") as BatchRegenerateQRInput;
    await ensureTableAccess(seatsContext(c), tableId);

    const seatService = createSeatService(c.env);

    const result = await seatService.batchGenerateSeatQRCodes(tableId);

    if (!result.success) {
      throw badRequest(result.error || "Failed to generate QR codes");
    }

    return c.json({
      success: true,
      data: result.qrCodes,
      message: `Successfully regenerated QR codes for ${result.qrCodes?.length || 0} seats`,
    });
  },
);

/**
 * POST /batch-prepare-qr
 * Prepare QR rotations for all seats of a table.
 */
routes.post(
  "/batch-prepare-qr",
  authMiddleware,
  moduleGate("table_management"),
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateBody(batchRegenerateQRSchema),
  async (c) => {
    const { tableId } = c.get("validatedBody") as BatchRegenerateQRInput;
    await ensureTableAccess(seatsContext(c), tableId);

    const seatService = createSeatService(c.env);
    const result = await seatService.batchPrepareSeatQRCodeRotations(tableId);

    if (!result.success) {
      throw badRequest(result.error || "Failed to prepare QR code rotation");
    }

    return c.json({
      success: true,
      data: result.qrCodes,
      message: `Successfully prepared QR rotations for ${result.qrCodes?.length || 0} seats`,
    });
  },
);

/**
 * PUT /:id
 * Update seat information
 */
routes.put(
  "/:id",
  authMiddleware,
  moduleGate("table_management"),
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(commonSchemas.idParam),
  validateBody(updateSeatSchema),
  async (c) => {
    const { id } = c.get("validatedParams") as { id: number };
    await getSeatWithAccessCheck(seatsContext(c), id);

    const data = c.get("validatedBody") as UpdateSeatInput;
    const seatService = createSeatService(c.env);
    const updatedSeat = await seatService.updateSeat(id, data);

    return c.json({
      success: true,
      data: updatedSeat,
      message: "Seat updated successfully",
    });
  },
);

/**
 * DELETE /:id
 * Delete a seat
 */
routes.delete(
  "/:id",
  authMiddleware,
  moduleGate("table_management"),
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(commonSchemas.idParam),
  async (c) => {
    const { id } = c.get("validatedParams") as { id: number };
    await getSeatWithAccessCheck(seatsContext(c), id);

    const seatService = createSeatService(c.env);

    const success = await seatService.deleteSeat(id);

    if (!success) {
      throw badRequest("Failed to delete seat");
    }

    return c.json({
      success: true,
      message: "Seat deleted successfully",
    });
  },
);

/**
 * DELETE /table/:tableId
 * Delete all seats for a table (for mode switching)
 */
routes.delete(
  "/table/:tableId",
  authMiddleware,
  moduleGate("table_management"),
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(tableIdParamSchema),
  async (c) => {
    const { tableId } = c.get("validatedParams") as TableIdParamInput;
    await ensureTableAccess(seatsContext(c), tableId);

    const seatService = createSeatService(c.env);

    const success = await seatService.deleteSeatsForTable(tableId);

    if (!success) {
      throw badRequest("Failed to delete seats");
    }

    return c.json({
      success: true,
      message: "All seats for the table deleted successfully",
    });
  },
);

/**
 * POST /:id/occupy
 * Occupy a seat
 */
routes.post(
  "/:id/occupy",
  authMiddleware,
  moduleGate("table_management"),
  requireRole([
    USER_ROLES.ADMIN,
    USER_ROLES.OWNER,
    USER_ROLES.SERVICE,
    USER_ROLES.CASHIER,
  ]),
  validateParams(commonSchemas.idParam),
  validateBody(occupySeatSchema),
  async (c) => {
    const { id } = c.get("validatedParams") as { id: number };
    const { orderId, occupiedBy } = c.get("validatedBody") as OccupySeatInput;
    await getSeatWithAccessCheck(seatsContext(c), id);
    const seatService = createSeatService(c.env);

    const success = await seatService.occupySeat(id, orderId, occupiedBy);

    if (!success) {
      throw badRequest("Failed to occupy seat");
    }

    return c.json({
      success: true,
      message: "Seat occupied successfully",
    });
  },
);

/**
 * POST /:id/release
 * Release a seat
 */
routes.post(
  "/:id/release",
  authMiddleware,
  moduleGate("table_management"),
  requireRole([
    USER_ROLES.ADMIN,
    USER_ROLES.OWNER,
    USER_ROLES.SERVICE,
    USER_ROLES.CASHIER,
  ]),
  validateParams(commonSchemas.idParam),
  async (c) => {
    const { id } = c.get("validatedParams") as { id: number };
    await getSeatWithAccessCheck(seatsContext(c), id);

    const seatService = createSeatService(c.env);

    const success = await seatService.releaseSeat(id);

    if (!success) {
      throw badRequest("Failed to release seat");
    }

    return c.json({
      success: true,
      message: "Seat released successfully",
    });
  },
);

/**
 * POST /:id/regenerate-qr
 * Regenerate QR code for a seat
 */
routes.post(
  "/:id/regenerate-qr",
  authMiddleware,
  moduleGate("table_management"),
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(commonSchemas.idParam),
  async (c) => {
    const { id } = c.get("validatedParams") as { id: number };
    await getSeatWithAccessCheck(seatsContext(c), id);

    const seatService = createSeatService(c.env);

    const result = await seatService.regenerateSeatQRCode(id);

    if (!result.success) {
      throw badRequest(result.error || "Failed to regenerate QR code");
    }

    return c.json({
      success: true,
      data: {
        qrCode: result.qrCode,
      },
      message: "Seat QR code regenerated successfully",
    });
  },
);

async function runSeatQrRotation(
  c: SeatsContext,
  operation: "prepare" | "activate" | "discard",
) {
  const { id } = c.get("validatedParams") as { id: number };
  await getSeatWithAccessCheck(c, id);

  const seatService = createSeatService(c.env);
  const result =
    operation === "prepare"
      ? await seatService.prepareSeatQRCodeRotation(id)
      : operation === "activate"
        ? await seatService.activateSeatQRCodeRotation(id)
        : await seatService.discardSeatQRCodeRotation(id);

  if (!result.success) {
    throw badRequest(result.error || `Failed to ${operation} QR rotation`);
  }

  return c.json({
    success: true,
    data: "qrCode" in result ? { qrCode: result.qrCode } : undefined,
    message: `Seat QR code rotation ${operation} completed successfully`,
  });
}

/**
 * POST /:id/qr/prepare
 * Prepare a seat QR code rotation without invalidating the live code.
 */
routes.post(
  "/:id/qr/prepare",
  authMiddleware,
  moduleGate("table_management"),
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(commonSchemas.idParam),
  async (c) => runSeatQrRotation(seatsContext(c), "prepare"),
);

/**
 * POST /:id/qr/activate
 * Promote a prepared seat QR code.
 */
routes.post(
  "/:id/qr/activate",
  authMiddleware,
  moduleGate("table_management"),
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(commonSchemas.idParam),
  async (c) => runSeatQrRotation(seatsContext(c), "activate"),
);

/**
 * POST /:id/qr/discard
 * Discard a prepared seat QR code.
 */
routes.post(
  "/:id/qr/discard",
  authMiddleware,
  moduleGate("table_management"),
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(commonSchemas.idParam),
  async (c) => runSeatQrRotation(seatsContext(c), "discard"),
);

export default routes;
