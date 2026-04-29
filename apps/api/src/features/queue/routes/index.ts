/**
 * Queue Routes
 *
 * Thin HTTP layer over UnifiedQueueService, which delegates to the
 * production WaitingListService. The previous "legacy" and "modular"
 * dual-mode routes (which served hardcoded mock data) have been removed.
 */

import { Hono } from "hono";
import { authMiddleware, optionalAuth } from "../../../middleware/auth";
import { UnifiedQueueService } from "../services/UnifiedQueueService";
import { createSuccessResponse } from "../../../shared/utils/response";
import type { Env } from "../../../types/env";
import { badRequest, forbidden } from "../../../shared/utils/api-error";

const app = new Hono<{ Bindings: Env }>();

interface JoinPayload {
  restaurantId?: string;
  restaurant_id?: string;
  customerName?: string;
  customer_name?: string;
  customerPhone?: string;
  customer_phone?: string;
  partySize?: number;
  party_size?: number;
  specialRequests?: string;
  special_requests?: string;
}

function canAccessRestaurant(
  user: { role: number; restaurantId?: string | number },
  restaurantId: string,
): boolean {
  return user.role === 0 || String(user.restaurantId ?? "") === restaurantId;
}

/**
 * Broadcast a queue update event over the SSE channel. Failures are logged
 * but never break the originating mutation — clients reconcile on reload.
 */
async function broadcastQueueUpdate(
  env: Env,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!env.API_BASE_URL) return;
  try {
    await fetch(`${env.API_BASE_URL}/api/v1/sse/broadcast/queue-update`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (broadcastError) {
    console.warn("Failed to broadcast queue update:", broadcastError);
  }
}

/**
 * POST /api/v1/queue/join
 * Public — customer joins the queue.
 */
app.post("/join", optionalAuth, async (c) => {
  const requestData = (await c.req.json()) as JoinPayload;
  const queueService = new UnifiedQueueService(c.env);

  const joinRequest = {
    restaurantId: requestData.restaurantId ?? requestData.restaurant_id ?? "",
    customerName: requestData.customerName ?? requestData.customer_name ?? "",
    customerPhone: requestData.customerPhone ?? requestData.customer_phone,
    partySize: requestData.partySize ?? requestData.party_size ?? 1,
    specialRequests:
      requestData.specialRequests ?? requestData.special_requests,
  };

  if (
    !joinRequest.restaurantId ||
    !joinRequest.customerName ||
    !joinRequest.customerPhone
  ) {
    throw badRequest(
      "restaurantId, customerName, and customerPhone are required",
    );
  }

  const result = await queueService.joinQueue(joinRequest);

  if (!result.success || !result.data) {
    throw badRequest(result.error || "Failed to join queue");
  }

  await broadcastQueueUpdate(c.env, {
    type: "queue_joined",
    queueEntry: result.data,
    restaurantId: joinRequest.restaurantId,
  });

  return c.json(createSuccessResponse(result.data));
});

/**
 * GET /api/v1/queue/:restaurantId/status
 * Public — restaurant queue summary.
 */
app.get("/:restaurantId/status", async (c) => {
  const restaurantId = c.req.param("restaurantId");
  if (!restaurantId) throw badRequest("Invalid restaurant ID");

  const queueService = new UnifiedQueueService(c.env);
  const result = await queueService.getQueueStatus(restaurantId);

  if (!result.success || !result.data) {
    throw badRequest(result.error || "Failed to get queue status");
  }

  return c.json(createSuccessResponse(result.data));
});

/**
 * GET /api/v1/queue/:restaurantId/current
 * Protected — current waiting list (staff dashboard).
 */
app.get("/:restaurantId/current", authMiddleware, async (c) => {
  const restaurantId = c.req.param("restaurantId");
  if (!restaurantId) throw badRequest("Invalid restaurant ID");
  const user = c.get("user");

  if (!canAccessRestaurant(user, restaurantId)) {
    throw forbidden("Access denied");
  }

  const limitRaw = c.req.query("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;

  const queueService = new UnifiedQueueService(c.env);
  const result = await queueService.getCurrentQueue(
    restaurantId,
    Number.isFinite(limit) ? (limit as number) : undefined,
  );

  if (!result.success) {
    throw badRequest(result.error || "Failed to load queue");
  }

  return c.json(
    createSuccessResponse({
      queue: result.data ?? [],
      total: result.data?.length ?? 0,
    }),
  );
});

/**
 * GET /api/v1/queue/:queueId/position
 * Public — let a customer poll their position.
 */
app.get("/:queueId/position", async (c) => {
  const queueId = c.req.param("queueId");
  if (!queueId) throw badRequest("Invalid queue ID");

  const queueService = new UnifiedQueueService(c.env);
  const result = await queueService.getQueueEntry(queueId);

  if (!result.success || !result.data) {
    throw badRequest(result.error || "Queue entry not found");
  }

  const entry = result.data;
  return c.json(
    createSuccessResponse({
      queueId: entry.id,
      queueNumber: entry.queueNumber,
      queueDisplay: entry.queueDisplay,
      currentPosition: entry.partiesAhead + 1,
      partiesAhead: entry.partiesAhead,
      estimatedWaitMinutes: entry.estimatedWaitMinutes ?? 0,
      status: entry.status,
      canCancel: entry.status === "waiting" || entry.status === "called",
    }),
  );
});

/**
 * POST /api/v1/queue/:restaurantId/call-next
 * Protected — staff calls next customer (auto or specific).
 */
app.post("/:restaurantId/call-next", authMiddleware, async (c) => {
  const restaurantId = c.req.param("restaurantId");
  if (!restaurantId)
    throw badRequest("Missing restaurantId parameter", "MISSING_PARAM");
  const user = c.get("user");

  if (!canAccessRestaurant(user, restaurantId)) {
    throw forbidden("Access denied");
  }

  const requestData = (await c.req.json().catch(() => ({}))) as {
    tableId?: number;
    specificQueueId?: string;
  };

  const queueService = new UnifiedQueueService(c.env);
  const result = await queueService.callNext(restaurantId, {
    restaurantId,
    tableId: requestData.tableId,
    specificQueueId: requestData.specificQueueId,
  });

  if (!result.success || !result.data) {
    throw badRequest(result.error || "Failed to call next customer");
  }

  await broadcastQueueUpdate(c.env, {
    type: "customer_called",
    queueEntry: result.data,
    restaurantId,
  });

  return c.json(createSuccessResponse(result.data));
});

/**
 * POST /api/v1/queue/:queueId/seat
 * Protected — staff marks a called customer as seated.
 */
app.post("/:queueId/seat", authMiddleware, async (c) => {
  const queueId = c.req.param("queueId");
  if (!queueId) throw badRequest("Invalid queue ID");

  const queueService = new UnifiedQueueService(c.env);
  const result = await queueService.seatCustomer(queueId);

  if (!result.success) {
    throw badRequest(result.error || "Failed to seat customer");
  }

  await broadcastQueueUpdate(c.env, {
    type: "customer_seated",
    queueId,
  });

  return c.json(
    createSuccessResponse({ message: "Customer seated successfully" }),
  );
});

/**
 * POST /api/v1/queue/:queueId/cancel
 * Public — customer cancels their own entry.
 */
app.post("/:queueId/cancel", async (c) => {
  const queueId = c.req.param("queueId");
  if (!queueId) throw badRequest("Invalid queue ID");

  const queueService = new UnifiedQueueService(c.env);
  const result = await queueService.cancelQueue(queueId);

  if (!result.success) {
    throw badRequest(result.error || "Failed to cancel queue");
  }

  await broadcastQueueUpdate(c.env, {
    type: "queue_cancelled",
    queueId,
  });

  return c.json(createSuccessResponse({ message: "Queue entry cancelled" }));
});

/**
 * GET /api/v1/queue/health
 */
app.get("/health", async (c) => {
  return c.json(
    createSuccessResponse({
      status: "healthy",
      timestamp: new Date().toISOString(),
      backend: "WaitingListService",
    }),
  );
});

export const queueRoutes = app;
export default app;
