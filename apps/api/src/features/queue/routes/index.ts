/**
 * Unified Queue Routes
 * Integrates legacy and modular queue endpoints with backward compatibility
 */

import { Hono } from "hono";
import { authMiddleware, optionalAuth } from "../../../middleware/auth";
import { UnifiedQueueService } from "../services/UnifiedQueueService";
import {
  createSuccessResponse,
  createErrorResponse,
} from "../../../shared/utils/response";
import type { Env } from "../../../types/env";

const app = new Hono<{ Bindings: Env }>();

/**
 * Join queue endpoint (public, no auth required)
 * POST /api/v1/queue/join
 *
 * Supports both legacy and modular formats
 */
app.post("/join", optionalAuth, async (c) => {
  try {
    const requestData = await c.req.json();
    const queueService = new UnifiedQueueService(c.env, false); // Use legacy implementation

    // Auto-detect request format and convert if needed
    let joinRequest;
    if ("customerName" in requestData) {
      // New modular format
      joinRequest = requestData;
    } else {
      // Legacy format conversion
      joinRequest = {
        restaurantId: requestData.restaurant_id || requestData.restaurantId,
        customerName: requestData.customer_name || requestData.customerName,
        customerPhone: requestData.customer_phone || requestData.customerPhone,
        partySize: requestData.party_size || requestData.partySize || 1,
        specialRequests:
          requestData.special_requests || requestData.specialRequests,
      };
    }

    const result = await queueService.joinQueue(joinRequest);

    if (!result.success) {
      return c.json(
        createErrorResponse(result.error || "Failed to join queue"),
        400,
      );
    }

    // Trigger real-time update
    try {
      if (result.data && c.env.API_BASE_URL) {
        await fetch(`${c.env.API_BASE_URL}/api/v1/sse/broadcast/queue-update`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "queue_joined",
            queueEntry: result.data,
            restaurantId: result.data.restaurantId,
          }),
        });
      }
    } catch (broadcastError) {
      console.warn("Failed to broadcast queue update:", broadcastError);
      // Don't fail the request if broadcast fails
    }

    // Add queueId alias for backward compatibility
    if (!result.data) {
      return c.json(createErrorResponse("Failed to add to queue"), 500);
    }
    return c.json(
      createSuccessResponse({
        ...result.data,
        queueId: result.data.id,
      }),
    );
  } catch (error) {
    console.error("Queue join error:", error);

    // Determine if this is a client error (400) or server error (500)
    const isClientError =
      error instanceof Error &&
      (error.message.includes("not available") ||
        error.message.includes("not found") ||
        error.message.includes("not exist") ||
        error.message.includes("Invalid") ||
        error.message.includes("already exists") ||
        error.message.includes("required"));

    return c.json(
      createErrorResponse(
        error instanceof Error ? error.message : "Failed to join queue",
      ),
      isClientError ? 400 : 500,
    );
  }
});

/**
 * Get queue status
 * GET /api/v1/queue/:restaurantId/status
 */
app.get("/:restaurantId/status", async (c) => {
  try {
    const restaurantId = c.req.param("restaurantId");

    if (!restaurantId) {
      return c.json(createErrorResponse("Invalid restaurant ID"), 400);
    }

    const queueService = new UnifiedQueueService(c.env, false);
    const result = await queueService.getQueueStatus(restaurantId);

    if (!result.success) {
      return c.json(
        createErrorResponse(result.error || "Failed to get queue status"),
        500,
      );
    }

    return c.json(createSuccessResponse(result.data));
  } catch (error) {
    console.error("Queue status error:", error);
    return c.json(createErrorResponse("Failed to get queue status"), 500);
  }
});

/**
 * Call next customer (protected)
 * POST /api/v1/queue/:restaurantId/call-next
 */
app.post("/:restaurantId/call-next", authMiddleware, async (c) => {
  try {
    const restaurantId = c.req.param("restaurantId");
    const user = c.get("user");

    // Check restaurant permission
    if (user.role !== 0 && user.restaurantId !== restaurantId) {
      return c.json(createErrorResponse("Access denied"), 403);
    }

    const requestData = await c.req.json();
    const queueService = new UnifiedQueueService(c.env, false);

    const result = await queueService.callNext(restaurantId, requestData);

    if (!result.success) {
      return c.json(
        createErrorResponse(result.error || "Failed to call next customer"),
        400,
      );
    }

    // Trigger real-time update
    try {
      if (c.env.API_BASE_URL) {
        await fetch(`${c.env.API_BASE_URL}/api/v1/sse/broadcast/queue-update`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "customer_called",
            queueEntry: result.data,
            restaurantId,
          }),
        });
      }
    } catch (broadcastError) {
      console.warn("Failed to broadcast queue update:", broadcastError);
    }

    // Add queueId alias for backward compatibility
    if (!result.data) {
      return c.json(createErrorResponse("Failed to call next customer"), 500);
    }
    return c.json(
      createSuccessResponse({
        ...result.data,
        queueId: result.data.id,
      }),
    );
  } catch (error) {
    console.error("Call next error:", error);
    return c.json(createErrorResponse("Failed to call next customer"), 500);
  }
});

/**
 * Seat customer (protected)
 * POST /api/v1/queue/:queueId/seat
 */
app.post("/:queueId/seat", authMiddleware, async (c) => {
  try {
    const queueId = c.req.param("queueId");
    const user = c.get("user");
    const { tableId } = await c.req.json();

    if (!queueId || !tableId) {
      return c.json(createErrorResponse("Invalid queue ID or table ID"), 400);
    }

    const queueService = new UnifiedQueueService(c.env, false);
    const result = await queueService.seatCustomer(
      Number(queueId),
      tableId,
      Number(user.id),
    );

    if (!result.success) {
      return c.json(
        createErrorResponse(result.error || "Failed to seat customer"),
        400,
      );
    }

    // Trigger real-time update
    try {
      if (c.env.API_BASE_URL) {
        await fetch(`${c.env.API_BASE_URL}/api/v1/sse/broadcast/queue-update`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            type: "customer_seated",
            queueId,
            tableId,
          }),
        });
      }
    } catch (broadcastError) {
      console.warn("Failed to broadcast queue update:", broadcastError);
    }

    return c.json(
      createSuccessResponse({ message: "Customer seated successfully" }),
    );
  } catch (error) {
    console.error("Seat customer error:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      queueId: c.req.param("queueId"),
      hasUser: !!c.get("user"),
      userId: c.get("user")?.id,
    });
    return c.json(createErrorResponse("Failed to seat customer"), 500);
  }
});

/**
 * Legacy compatibility endpoints
 * These maintain backward compatibility with the old queue system
 */

/**
 * Legacy get queue (backward compatibility)
 * GET /api/v1/queue/restaurant/:restaurantId
 */
app.get("/restaurant/:restaurantId", async (c) => {
  try {
    const restaurantId = c.req.param("restaurantId");

    if (!restaurantId) {
      return c.json({ success: false, error: "Invalid restaurant ID" }, 400);
    }

    const queueService = new UnifiedQueueService(c.env, false); // Use legacy mode
    const legacyQueue = await queueService.getQueueLegacy(restaurantId);

    return c.json({
      success: true,
      data: {
        queue: legacyQueue,
        total: legacyQueue.length,
        waiting: legacyQueue.filter((entry) => entry.status === "waiting")
          .length,
      },
    });
  } catch (error) {
    console.error("Legacy queue get error:", error);
    return c.json(
      {
        success: false,
        error: "Failed to get queue",
      },
      500,
    );
  }
});

/**
 * Migration endpoint (admin only)
 * POST /api/v1/queue/:restaurantId/migrate
 */
app.post("/:restaurantId/migrate", authMiddleware, async (c) => {
  try {
    const restaurantId = c.req.param("restaurantId");
    const user = c.get("user");

    // Only admins can migrate
    if (user.role !== 0) {
      return c.json(createErrorResponse("Admin access required"), 403);
    }

    const queueService = new UnifiedQueueService(c.env, false);
    await queueService.migrateLegacyToModular(restaurantId);

    return c.json(
      createSuccessResponse({
        message: "Queue migration completed successfully",
        restaurantId,
      }),
    );
  } catch (error) {
    console.error("Queue migration error:", error);
    return c.json(createErrorResponse("Failed to migrate queue"), 500);
  }
});

/**
 * Health check endpoint
 * GET /api/v1/queue/health
 */
app.get("/health", async (c) => {
  try {
    // Test both legacy and modular systems
    const _queueService = new UnifiedQueueService(c.env, false);

    return c.json(
      createSuccessResponse({
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: "2.0.0",
        systems: {
          modular: "available",
          legacy: "available",
        },
      }),
    );
  } catch (error) {
    console.error("Queue health check error:", error);
    return c.json(
      {
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      500,
    );
  }
});

export const queueRoutes = app;
export default app;
