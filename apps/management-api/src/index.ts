/**
 * MakanMakan Management API
 *
 * Central management platform for hybrid deployment strategy.
 * Handles tenant management, resource provisioning, and health monitoring.
 */

import { Hono } from "hono";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { cors } from "hono/cors";
import { timing } from "hono/timing";

import type { ManagementEnv } from "./types";
import tenantsRouter from "./routes/tenants";
import deploymentsRouter from "./routes/deployments";
import licensesRouter from "./routes/licenses";
import healthRouter from "./routes/health";
import monitoringRouter from "./routes/monitoring";
import updatesRouter from "./routes/updates";

// Create main application
const app = new Hono<{ Bindings: ManagementEnv }>();

// ============================================================
// Global Middleware
// ============================================================

// CORS configuration
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const allowedOrigin = c.env.CORS_ORIGIN;
      if (allowedOrigin === "*") return origin;
      if (origin && allowedOrigin.split(",").includes(origin)) return origin;
      return null;
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
    exposeHeaders: ["X-Request-ID", "X-Response-Time"],
    credentials: true,
    maxAge: 86400,
  }),
);

// Logging and timing
app.use("*", logger());
app.use("*", timing());
app.use("*", prettyJSON());

// Request ID middleware
app.use("*", async (c, next) => {
  const requestId = c.req.header("X-Request-ID") || crypto.randomUUID();
  c.header("X-Request-ID", requestId);
  await next();
});

// ============================================================
// Error Handling
// ============================================================

app.onError((err, c) => {
  console.error("[ManagementAPI] Error:", err);

  const isDev = c.env.NODE_ENV === "development";

  return c.json(
    {
      success: false,
      error: isDev ? err.message : "Internal server error",
      code: "INTERNAL_ERROR",
    },
    500,
  );
});

app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: "Endpoint not found",
      code: "NOT_FOUND",
      path: c.req.path,
    },
    404,
  );
});

// ============================================================
// Root Endpoints
// ============================================================

// Health check (public)
app.get("/health", (c) => {
  return c.json({
    success: true,
    data: {
      status: "healthy",
      service: "management-api",
      version: c.env.API_VERSION,
      timestamp: new Date().toISOString(),
    },
  });
});

// API info (public)
app.get("/info", (c) => {
  return c.json({
    name: "MakanMakan Management API",
    version: c.env.API_VERSION || "v1",
    description: "Central management platform for MakanMakan hybrid deployment",
    environment: c.env.NODE_ENV || "development",
    features: [
      "Tenant management",
      "Resource provisioning",
      "License management",
      "Health monitoring",
      "Deployment automation",
      "Batch version updates",
      "Alert system",
    ],
    endpoints: {
      tenants: "/api/v1/tenants",
      deployments: "/api/v1/deployments",
      licenses: "/api/v1/licenses",
      health: "/api/v1/health",
      monitoring: "/api/v1/monitoring",
      updates: "/api/v1/updates",
    },
  });
});

// Root redirect
app.get("/", (c) => c.redirect("/info"));

// ============================================================
// API Routes
// ============================================================

const apiV1 = new Hono<{ Bindings: ManagementEnv }>();

// Mount feature routes
apiV1.route("/tenants", tenantsRouter);
apiV1.route("/deployments", deploymentsRouter);
apiV1.route("/licenses", licensesRouter);
apiV1.route("/health", healthRouter);
apiV1.route("/monitoring", monitoringRouter);
apiV1.route("/updates", updatesRouter);

// Mount API version
app.route("/api/v1", apiV1);

// ============================================================
// Export
// ============================================================

export default app;
