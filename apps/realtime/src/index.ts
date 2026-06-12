import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types/env";
import {
  checkRealtimeRateLimit,
  rateLimitResponse,
  type RealtimeRateLimitSubject,
} from "./utils/rateLimiter";

// Import Durable Objects
export { RealtimeSession } from "./durableObjects/RealtimeSession";

const app = new Hono<{ Bindings: Env }>();

async function enforceWebSocketRateLimit(
  c: Context<{ Bindings: Env }>,
  subject: RealtimeRateLimitSubject,
): Promise<Response | null> {
  if (c.req.header("Upgrade")?.toLowerCase() !== "websocket") {
    return null;
  }

  try {
    const decision = await checkRealtimeRateLimit(c.req.raw, c.env, subject);
    return decision.allowed ? null : rateLimitResponse(decision);
  } catch (error) {
    console.error("Realtime rate limit check failed:", error);
    return c.json(
      {
        error: "Realtime rate limit unavailable",
        code: "REALTIME_RATE_LIMIT_UNAVAILABLE",
      },
      503,
    );
  }
}

// CORS configuration
app.use(
  "*",
  cors({
    origin: [
      "https://makanmasak.com",
      "https://customer.makanmasak.com",
      "https://admin.makanmasak.com",
      "https://kitchen.makanmasak.com",
      "https://staging.makanmasak.com",
      "https://admin-staging.makanmasak.com",
      "https://kitchen-staging.makanmasak.com",
    ],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "Upgrade",
      "Connection",
      "Sec-WebSocket-Key",
      "Sec-WebSocket-Version",
    ],
    credentials: true,
  }),
);

// Health check endpoint
app.get("/health", (c: Context<{ Bindings: Env }>) => {
  return c.json({
    status: "healthy",
    service: "makanmakan-realtime",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    environment: c.env.ENVIRONMENT || "development",
  });
});

// WebSocket connection endpoint for customers
app.get("/customer/:tableId", async (c: Context<{ Bindings: Env }>) => {
  const tableId = c.req.param("tableId");

  if (!tableId) {
    return c.json({ error: "Table ID is required" }, 400);
  }

  const rateLimit = await enforceWebSocketRateLimit(c, {
    roomType: "customer",
    roomId: tableId,
  });
  if (rateLimit) return rateLimit;

  // Get Durable Object instance
  const id = c.env.REALTIME_SESSION.idFromName(`customer:${tableId}`);
  const durableObject = c.env.REALTIME_SESSION.get(id);

  // Forward the request to the Durable Object
  return durableObject.fetch(c.req.raw);
});

// WebSocket connection endpoint for admin dashboard
app.get("/admin/:restaurantId", async (c: Context<{ Bindings: Env }>) => {
  const restaurantId = c.req.param("restaurantId");

  if (!restaurantId) {
    return c.json({ error: "Restaurant ID is required" }, 400);
  }

  const rateLimit = await enforceWebSocketRateLimit(c, {
    roomType: "admin",
    roomId: restaurantId,
  });
  if (rateLimit) return rateLimit;

  // Get Durable Object instance
  const id = c.env.REALTIME_SESSION.idFromName(`admin:${restaurantId}`);
  const durableObject = c.env.REALTIME_SESSION.get(id);

  return durableObject.fetch(c.req.raw);
});

// WebSocket connection endpoint for kitchen display
app.get("/kitchen/:restaurantId", async (c: Context<{ Bindings: Env }>) => {
  const restaurantId = c.req.param("restaurantId");

  if (!restaurantId) {
    return c.json({ error: "Restaurant ID is required" }, 400);
  }

  const rateLimit = await enforceWebSocketRateLimit(c, {
    roomType: "kitchen",
    roomId: restaurantId,
  });
  if (rateLimit) return rateLimit;

  // Get Durable Object instance
  const id = c.env.REALTIME_SESSION.idFromName(`kitchen:${restaurantId}`);
  const durableObject = c.env.REALTIME_SESSION.get(id);

  return durableObject.fetch(c.req.raw);
});

// 404 handler
app.notFound((c: Context<{ Bindings: Env }>) => {
  return c.json(
    {
      error: "Realtime endpoint not found",
      path: c.req.path,
      availableEndpoints: [
        "/customer/:tableId",
        "/admin/:restaurantId",
        "/kitchen/:restaurantId",
        "/health",
      ],
    },
    404,
  );
});

// Error handler
app.onError((error: Error, c: Context<{ Bindings: Env }>) => {
  console.error("Realtime service error:", error);
  return c.json(
    {
      error: "Internal server error",
      message:
        c.env.ENVIRONMENT === "development"
          ? error.message
          : "Something went wrong",
    },
    500,
  );
});

export default {
  fetch: app.fetch,
};
