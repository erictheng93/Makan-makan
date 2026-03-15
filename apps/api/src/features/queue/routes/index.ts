/**
 * Unified Queue Routes
 * Integrates legacy and modular queue endpoints with backward compatibility
 */

import { Hono } from "hono";
import { authMiddleware, optionalAuth } from "../../../middleware/auth";
import { UnifiedQueueService } from "../services/UnifiedQueueService";
import { createSuccessResponse } from "../../../shared/utils/response";
import type { Env } from "../../../types/env";
import { badRequest, forbidden } from "../../../shared/utils/api-error";

const app = new Hono<{ Bindings: Env }>();

/**
 * Join queue endpoint (public, no auth required)
 * POST /api/v1/queue/join
 *
 * Supports both legacy and modular formats
 */
app.post("/join", optionalAuth, async (c) => {
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
    throw badRequest(result.error || "Failed to join queue");
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
    throw badRequest("Failed to add to queue");
  }
  return c.json(
    createSuccessResponse({
      ...result.data,
      queueId: result.data.id,
    }),
  );
});

/**
 * Get queue status
 * GET /api/v1/queue/:restaurantId/status
 */
app.get("/:restaurantId/status", async (c) => {
  const restaurantId = c.req.param("restaurantId");

  if (!restaurantId) {
    throw badRequest("Invalid restaurant ID");
  }

  const queueService = new UnifiedQueueService(c.env, false);
  const result = await queueService.getQueueStatus(restaurantId);

  if (!result.success) {
    throw new Error(result.error || "Failed to get queue status");
  }

  return c.json(createSuccessResponse(result.data));
});

/**
 * Call next customer (protected)
 * POST /api/v1/queue/:restaurantId/call-next
 */
app.post("/:restaurantId/call-next", authMiddleware, async (c) => {
  const restaurantId = c.req.param("restaurantId");
  const user = c.get("user");

  // Check restaurant permission
  if (user.role !== 0 && user.restaurantId !== restaurantId) {
    throw forbidden("Access denied");
  }

  const requestData = await c.req.json();
  const queueService = new UnifiedQueueService(c.env, false);

  const result = await queueService.callNext(restaurantId, requestData);

  if (!result.success) {
    throw badRequest(result.error || "Failed to call next customer");
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
    throw badRequest("Failed to call next customer");
  }
  return c.json(
    createSuccessResponse({
      ...result.data,
      queueId: result.data.id,
    }),
  );
});

/**
 * Seat customer (protected)
 * POST /api/v1/queue/:queueId/seat
 */
app.post("/:queueId/seat", authMiddleware, async (c) => {
  const queueId = c.req.param("queueId");
  const user = c.get("user");
  const { tableId } = await c.req.json();

  if (!queueId || !tableId) {
    throw badRequest("Invalid queue ID or table ID");
  }

  const queueService = new UnifiedQueueService(c.env, false);
  const result = await queueService.seatCustomer(
    Number(queueId),
    tableId,
    Number(user.id),
  );

  if (!result.success) {
    throw badRequest(result.error || "Failed to seat customer");
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
      waiting: legacyQueue.filter((entry) => entry.status === "waiting").length,
    },
  });
});

/**
 * Migration endpoint (admin only)
 * POST /api/v1/queue/:restaurantId/migrate
 */
app.post("/:restaurantId/migrate", authMiddleware, async (c) => {
  const restaurantId = c.req.param("restaurantId");
  const user = c.get("user");

  // Only admins can migrate
  if (user.role !== 0) {
    throw forbidden("Admin access required");
  }

  const queueService = new UnifiedQueueService(c.env, false);
  await queueService.migrateLegacyToModular(restaurantId);

  return c.json(
    createSuccessResponse({
      message: "Queue migration completed successfully",
      restaurantId,
    }),
  );
});

/**
 * Health check endpoint
 * GET /api/v1/queue/health
 */
app.get("/health", async (c) => {
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
});

export const queueRoutes = app;
export default app;
