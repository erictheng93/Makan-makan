/**
 * Seats Routes
 * API endpoints for seat management
 */

import { Hono } from "hono";
import { SeatService, USER_ROLES } from "@makanmakan/database";
import { authMiddleware, requireRole } from "../../../middleware/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
  commonSchemas,
} from "../../../middleware/validation";
import type { Env } from "../../../types/env";
import {
  batchCreateSeatsSchema,
  updateSeatSchema,
  occupySeatSchema,
  seatFilterSchema,
  tableIdParamSchema,
  qrCodeParamSchema,
  tableIdQuerySchema,
  batchRegenerateQRSchema,
} from "../schemas/validation";

const routes = new Hono<{ Bindings: Env }>();

/**
 * GET /
 * Get all seats for a table
 */
routes.get(
  "/",
  authMiddleware,
  requireRole([
    USER_ROLES.ADMIN,
    USER_ROLES.OWNER,
    USER_ROLES.CHEF,
    USER_ROLES.SERVICE,
    USER_ROLES.CASHIER,
  ]),
  validateQuery(seatFilterSchema as any),
  async (c) => {
    try {
      const filters = c.get("validatedQuery");
      const seatService = new SeatService(c.env.DB as any, c.env);

      const { tableId, ...otherFilters } = filters;
      const result = await seatService.getSeatsByTableId(tableId, otherFilters);

      return c.json({
        success: true,
        data: result.seats,
        total: result.total,
        pagination: result.pagination,
      });
    } catch (error) {
      console.error("Get seats error:", error);
      return c.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to fetch seats",
        },
        500,
      );
    }
  },
);

/**
 * GET /stats
 * Get seat statistics for a table
 */
routes.get(
  "/stats",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateQuery(tableIdQuerySchema as any),
  async (c) => {
    try {
      const { tableId } = c.get("validatedQuery");
      const seatService = new SeatService(c.env.DB as any, c.env);

      const stats = await seatService.getSeatStats(tableId);

      return c.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error("Get seat stats error:", error);
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch seat statistics",
        },
        500,
      );
    }
  },
);

/**
 * GET /qr/:qrCode
 * Get seat information by QR code (public endpoint)
 */
routes.get(
  "/qr/:qrCode",
  validateParams(qrCodeParamSchema as any),
  async (c) => {
    try {
      const { qrCode } = c.get("validatedParams");
      const seatService = new SeatService(c.env.DB as any, c.env);

      const seat = await seatService.getSeatByQRCode(
        decodeURIComponent(qrCode),
      );

      if (!seat) {
        return c.json(
          {
            success: false,
            error: "Invalid QR code or seat not found",
          },
          404,
        );
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
    } catch (error) {
      console.error("Get seat by QR code error:", error);
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to fetch seat information",
        },
        500,
      );
    }
  },
);

/**
 * GET /:id
 * Get single seat details
 */
routes.get(
  "/:id",
  authMiddleware,
  requireRole([
    USER_ROLES.ADMIN,
    USER_ROLES.OWNER,
    USER_ROLES.CHEF,
    USER_ROLES.SERVICE,
    USER_ROLES.CASHIER,
  ]),
  validateParams(commonSchemas.idParam as any),
  async (c) => {
    try {
      const { id } = c.get("validatedParams");
      const seatService = new SeatService(c.env.DB as any, c.env);

      const seat = await seatService.getSeatById(parseInt(id));

      if (!seat) {
        return c.json(
          {
            success: false,
            error: "Seat not found",
          },
          404,
        );
      }

      return c.json({
        success: true,
        data: seat,
      });
    } catch (error) {
      console.error("Get seat error:", error);
      return c.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to fetch seat",
        },
        500,
      );
    }
  },
);

/**
 * POST /batch-create
 * Batch create seats for a table
 */
routes.post(
  "/batch-create",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateBody(batchCreateSeatsSchema as any),
  async (c) => {
    try {
      const data = c.get("validatedBody");
      const seatService = new SeatService(c.env.DB as any, c.env);

      const { tableId, seatCount, numberingStyle, customNumbers, prefix } =
        data;

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
    } catch (error) {
      console.error("Batch create seats error:", error);
      return c.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to create seats",
        },
        500,
      );
    }
  },
);

/**
 * POST /batch-regenerate-qr
 * Batch regenerate QR codes for all seats of a table
 */
routes.post(
  "/batch-regenerate-qr",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateBody(batchRegenerateQRSchema as any),
  async (c) => {
    try {
      const { tableId } = c.get("validatedBody");
      const seatService = new SeatService(c.env.DB as any, c.env);

      const result = await seatService.batchGenerateSeatQRCodes(tableId);

      if (!result.success) {
        return c.json(
          {
            success: false,
            error: result.error || "Failed to generate QR codes",
          },
          500,
        );
      }

      return c.json({
        success: true,
        data: result.qrCodes,
        message: `Successfully regenerated QR codes for ${result.qrCodes?.length || 0} seats`,
      });
    } catch (error) {
      console.error("Batch regenerate seat QR codes error:", error);
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to regenerate seat QR codes",
        },
        500,
      );
    }
  },
);

/**
 * PUT /:id
 * Update seat information
 */
routes.put(
  "/:id",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(commonSchemas.idParam as any),
  validateBody(updateSeatSchema as any),
  async (c) => {
    try {
      const { id } = c.get("validatedParams");
      const data = c.get("validatedBody");
      const seatService = new SeatService(c.env.DB as any, c.env);

      const existingSeat = await seatService.getSeatById(parseInt(id));

      if (!existingSeat) {
        return c.json(
          {
            success: false,
            error: "Seat not found",
          },
          404,
        );
      }

      const updatedSeat = await seatService.updateSeat(parseInt(id), data);

      return c.json({
        success: true,
        data: updatedSeat,
        message: "Seat updated successfully",
      });
    } catch (error) {
      console.error("Update seat error:", error);
      return c.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to update seat",
        },
        500,
      );
    }
  },
);

/**
 * DELETE /:id
 * Delete a seat
 */
routes.delete(
  "/:id",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(commonSchemas.idParam as any),
  async (c) => {
    try {
      const { id } = c.get("validatedParams");
      const seatService = new SeatService(c.env.DB as any, c.env);

      const existingSeat = await seatService.getSeatById(parseInt(id));

      if (!existingSeat) {
        return c.json(
          {
            success: false,
            error: "Seat not found",
          },
          404,
        );
      }

      const success = await seatService.deleteSeat(parseInt(id));

      if (!success) {
        return c.json(
          {
            success: false,
            error: "Failed to delete seat",
          },
          500,
        );
      }

      return c.json({
        success: true,
        message: "Seat deleted successfully",
      });
    } catch (error) {
      console.error("Delete seat error:", error);
      return c.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to delete seat",
        },
        500,
      );
    }
  },
);

/**
 * DELETE /table/:tableId
 * Delete all seats for a table (for mode switching)
 */
routes.delete(
  "/table/:tableId",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(tableIdParamSchema as any),
  async (c) => {
    try {
      const { tableId } = c.get("validatedParams");
      const seatService = new SeatService(c.env.DB as any, c.env);

      const success = await seatService.deleteSeatsForTable(tableId);

      if (!success) {
        return c.json(
          {
            success: false,
            error: "Failed to delete seats",
          },
          500,
        );
      }

      return c.json({
        success: true,
        message: "All seats for the table deleted successfully",
      });
    } catch (error) {
      console.error("Delete seats for table error:", error);
      return c.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to delete seats",
        },
        500,
      );
    }
  },
);

/**
 * POST /:id/occupy
 * Occupy a seat
 */
routes.post(
  "/:id/occupy",
  authMiddleware,
  requireRole([
    USER_ROLES.ADMIN,
    USER_ROLES.OWNER,
    USER_ROLES.SERVICE,
    USER_ROLES.CASHIER,
  ]),
  validateParams(commonSchemas.idParam as any),
  validateBody(occupySeatSchema as any),
  async (c) => {
    try {
      const { id } = c.get("validatedParams");
      const { orderId, occupiedBy } = c.get("validatedBody");
      const seatService = new SeatService(c.env.DB as any, c.env);

      const seat = await seatService.getSeatById(parseInt(id));

      if (!seat) {
        return c.json(
          {
            success: false,
            error: "Seat not found",
          },
          404,
        );
      }

      if (seat.isOccupied) {
        return c.json(
          {
            success: false,
            error: "Seat is already occupied",
          },
          400,
        );
      }

      const success = await seatService.occupySeat(
        parseInt(id),
        orderId,
        occupiedBy,
      );

      if (!success) {
        return c.json(
          {
            success: false,
            error: "Failed to occupy seat",
          },
          500,
        );
      }

      return c.json({
        success: true,
        message: "Seat occupied successfully",
      });
    } catch (error) {
      console.error("Occupy seat error:", error);
      return c.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to occupy seat",
        },
        500,
      );
    }
  },
);

/**
 * POST /:id/release
 * Release a seat
 */
routes.post(
  "/:id/release",
  authMiddleware,
  requireRole([
    USER_ROLES.ADMIN,
    USER_ROLES.OWNER,
    USER_ROLES.SERVICE,
    USER_ROLES.CASHIER,
  ]),
  validateParams(commonSchemas.idParam as any),
  async (c) => {
    try {
      const { id } = c.get("validatedParams");
      const seatService = new SeatService(c.env.DB as any, c.env);

      const seat = await seatService.getSeatById(parseInt(id));

      if (!seat) {
        return c.json(
          {
            success: false,
            error: "Seat not found",
          },
          404,
        );
      }

      const success = await seatService.releaseSeat(parseInt(id));

      if (!success) {
        return c.json(
          {
            success: false,
            error: "Failed to release seat",
          },
          500,
        );
      }

      return c.json({
        success: true,
        message: "Seat released successfully",
      });
    } catch (error) {
      console.error("Release seat error:", error);
      return c.json(
        {
          success: false,
          error:
            error instanceof Error ? error.message : "Failed to release seat",
        },
        500,
      );
    }
  },
);

/**
 * POST /:id/regenerate-qr
 * Regenerate QR code for a seat
 */
routes.post(
  "/:id/regenerate-qr",
  authMiddleware,
  requireRole([USER_ROLES.ADMIN, USER_ROLES.OWNER]),
  validateParams(commonSchemas.idParam as any),
  async (c) => {
    try {
      const { id } = c.get("validatedParams");
      const seatService = new SeatService(c.env.DB as any, c.env);

      const seat = await seatService.getSeatById(parseInt(id));

      if (!seat) {
        return c.json(
          {
            success: false,
            error: "Seat not found",
          },
          404,
        );
      }

      const result = await seatService.regenerateSeatQRCode(parseInt(id));

      if (!result.success) {
        return c.json(
          {
            success: false,
            error: result.error || "Failed to regenerate QR code",
          },
          500,
        );
      }

      return c.json({
        success: true,
        data: {
          qrCode: result.qrCode,
        },
        message: "Seat QR code regenerated successfully",
      });
    } catch (error) {
      console.error("Regenerate seat QR code error:", error);
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to regenerate seat QR code",
        },
        500,
      );
    }
  },
);

export default routes;
