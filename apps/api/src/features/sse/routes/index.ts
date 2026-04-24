/**
 * SSE Routes
 * Real-time event streaming endpoints
 */

import { Hono } from "hono";
import type { Context, Next } from "hono";
import { verify } from "hono/jwt";
import { authMiddleware } from "../../../middleware/auth";
import type { AuthUser } from "../../../middleware/auth";
import { ApiError, unauthorized } from "../../../shared/utils/api-error";
import { SSEController } from "../controllers/SSEController";
import type { Env } from "../../../types/env";

const app = new Hono<{ Bindings: Env }>();

type SseJwtPayload = {
  id: number;
  username: string;
  role: number;
  restaurantId?: string;
  fullName?: string;
  email?: string;
  phone?: string;
};

// Create controller instance for each request
function createController(c: Context<{ Bindings: Env }>) {
  return new SSEController(c.env);
}

/**
 * SSE auth middleware — accepts JWT from Authorization header OR ?token= query param.
 * Browser's EventSource API cannot send custom headers, so SSE clients
 * must pass the token via query parameter.
 */
const sseAuthMiddleware = async (c: Context<{ Bindings: Env }>, next: Next) => {
  // Try Authorization header first, then query param
  const authHeader = c.req.header("Authorization");
  let token: string | undefined;

  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.substring(7);
  } else {
    token = c.req.query("token");
  }

  if (!token) {
    throw unauthorized("Missing authentication token", "MISSING_AUTH_TOKEN");
  }

  if (!c.env.JWT_SECRET || c.env.JWT_SECRET.length < 32) {
    throw new ApiError(
      "SERVER_CONFIG_ERROR",
      "Server configuration error",
      500,
    );
  }

  if (c.env.TOKEN_BLACKLIST) {
    const blacklisted = await c.env.TOKEN_BLACKLIST.get(`token:${token}`);
    if (blacklisted) {
      throw unauthorized("Token has been invalidated", "TOKEN_BLACKLISTED");
    }
  }

  const decoded = (await verify(
    token,
    c.env.JWT_SECRET,
    "HS256",
  )) as SseJwtPayload;

  const user: AuthUser = {
    id: decoded.id,
    username: decoded.username,
    role: decoded.role,
    restaurantId: decoded.restaurantId,
    fullName: decoded.fullName,
    email: decoded.email,
    phone: decoded.phone,
  };

  c.set("user", user);
  await next();
};

/**
 * SSE connection endpoint - Restaurant event stream
 * GET /api/v1/sse/events
 */
app.get("/events", sseAuthMiddleware, async (c) => {
  const controller = createController(c);
  return await controller.connect(c);
});

/**
 * Test broadcast endpoint
 * POST /api/v1/sse/test
 */
app.post("/test", authMiddleware, async (c) => {
  const controller = createController(c);
  return await controller.broadcastTest(c);
});

/**
 * Connection status endpoint
 * GET /api/v1/sse/connections
 */
app.get("/connections", authMiddleware, async (c) => {
  const controller = createController(c);
  return await controller.getConnections(c);
});

/**
 * Broadcast order update event
 * POST /api/v1/sse/broadcast/order-update
 */
app.post("/broadcast/order-update", authMiddleware, async (c) => {
  const controller = createController(c);
  return await controller.broadcastOrderUpdate(c);
});

/**
 * Broadcast menu update event
 * POST /api/v1/sse/broadcast/menu-update
 */
app.post("/broadcast/menu-update", authMiddleware, async (c) => {
  const controller = createController(c);
  return await controller.broadcastMenuUpdate(c);
});

/**
 * Broadcast system notification
 * POST /api/v1/sse/broadcast/system-notification
 */
app.post("/broadcast/system-notification", authMiddleware, async (c) => {
  const controller = createController(c);
  return await controller.broadcastSystemNotification(c);
});

/**
 * GROUP ORDERS - Broadcast group order created
 * POST /api/v1/sse/broadcast/group-created
 */
app.post("/broadcast/group-created", async (c) => {
  const controller = createController(c);
  return await controller.broadcastGroupCreated(c);
});

/**
 * GROUP ORDERS - Broadcast member joined
 * POST /api/v1/sse/broadcast/member-joined
 */
app.post("/broadcast/member-joined", async (c) => {
  const controller = createController(c);
  return await controller.broadcastMemberJoined(c);
});

/**
 * GROUP ORDERS - Broadcast cart updated
 * POST /api/v1/sse/broadcast/cart-updated
 */
app.post("/broadcast/cart-updated", async (c) => {
  const controller = createController(c);
  return await controller.broadcastCartUpdated(c);
});

export const sseRoutes = app;
export default app;
