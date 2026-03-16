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
import { ApiError } from "@makanmakan/utils";

import type { ManagementEnv } from "./types";
import { managementAuthMiddleware } from "./middleware/auth";
import tenantsRouter from "./routes/tenants";
import deploymentsRouter from "./routes/deployments";
import licensesRouter from "./routes/licenses";
import healthRouter from "./routes/health";
import monitoringRouter from "./routes/monitoring";
import updatesRouter from "./routes/updates";
import onboardingRouter from "./routes/onboarding";

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
  if (err instanceof ApiError) {
    return c.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      },
      err.status as 400 | 401 | 403 | 404 | 409 | 500,
    );
  }

  console.error("[ManagementAPI] Error:", err);

  const isDev = c.env.NODE_ENV === "development";

  return c.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: isDev ? err.message : "Internal server error",
      },
    },
    500,
  );
});

app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Endpoint not found",
      },
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
      "Self-service onboarding",
    ],
    endpoints: {
      tenants: "/api/v1/tenants",
      deployments: "/api/v1/deployments",
      licenses: "/api/v1/licenses",
      health: "/api/v1/health",
      monitoring: "/api/v1/monitoring",
      updates: "/api/v1/updates",
      onboarding: "/api/v1/onboarding",
    },
  });
});

// Root redirect
app.get("/", (c) => c.redirect("/info"));

// ============================================================
// API Routes
// ============================================================

// Public routes (no auth required)
const publicApi = new Hono<{ Bindings: ManagementEnv }>();
publicApi.route("/onboarding", onboardingRouter);
publicApi.route("/health", healthRouter);

// Protected routes (auth required)
const protectedApi = new Hono<{ Bindings: ManagementEnv }>();
protectedApi.use("*", managementAuthMiddleware);
protectedApi.route("/tenants", tenantsRouter);
protectedApi.route("/deployments", deploymentsRouter);
protectedApi.route("/licenses", licensesRouter);
protectedApi.route("/monitoring", monitoringRouter);
protectedApi.route("/updates", updatesRouter);

// Mount API versions
app.route("/api/v1", publicApi);
app.route("/api/v1", protectedApi);

// ============================================================
// Export
// ============================================================

export default app;
