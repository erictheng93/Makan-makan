/**
 * Analytics Routes
 * All analytics endpoints including dashboard, revenue, performance, and real-time data
 */

import { Hono } from "hono";
import { validateQuery } from "../../../middleware/validation";
import { authMiddleware, requireRole } from "../../../middleware/auth";
import { AnalyticsService } from "../services/AnalyticsService";
import {
  analyticsQuerySchema,
  dashboardQuerySchema,
  revenueQuerySchema,
  performanceQuerySchema,
  exportQuerySchema,
  realtimeDashboardQuerySchema,
  detailedPerformanceQuerySchema,
  ownerDashboardQuerySchema,
  financialReportQuerySchema,
  sseQuerySchema,
} from "../schemas/validation";
import type { Env } from "../../../shared/types";
import type { IAnalyticsService, SSEAnalyticsEvent } from "../types";

// Create feature router
const routes = new Hono<{ Bindings: Env }>();

/**
 * Dashboard analytics endpoint
 * GET /api/v1/analytics/dashboard
 */
routes.get(
  "/dashboard",
  authMiddleware,
  requireRole([0, 1]), // Admin and Owner only
  validateQuery(dashboardQuerySchema),
  async (c) => {
    try {
      const { restaurantId, period } = c.get("validatedQuery");
      const user = c.get("user");

      const analyticsService: IAnalyticsService = new AnalyticsService(
        c.env.DB,
        c.env,
        c.env.CACHE_KV,
      );

      // For owners, only show their restaurant data
      const targetRestaurantId =
        user.role === 1 ? user.restaurantId : restaurantId;

      const dashboardData = await analyticsService.getDashboardData(
        targetRestaurantId,
        period,
      );

      return c.json({
        success: true,
        data: dashboardData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Get dashboard analytics error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "DASHBOARD_ANALYTICS_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch dashboard analytics",
          },
        },
        500,
      );
    }
  },
);

/**
 * Revenue analytics endpoint
 * GET /api/v1/analytics/revenue
 */
routes.get(
  "/revenue",
  authMiddleware,
  requireRole([0, 1]),
  validateQuery(revenueQuerySchema),
  async (c) => {
    try {
      const query = c.get("validatedQuery");
      const user = c.get("user");

      const analyticsService: IAnalyticsService = new AnalyticsService(
        c.env.DB,
        c.env,
        c.env.CACHE_KV,
      );

      // For owners, only show their restaurant data
      const filters = {
        ...query,
        restaurantId: user.role === 1 ? user.restaurantId : query.restaurantId,
      };

      const revenueData = await analyticsService.getRevenueAnalytics(filters);

      return c.json({
        success: true,
        data: revenueData,
      });
    } catch (error) {
      console.error("Get revenue analytics error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "REVENUE_ANALYTICS_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch revenue analytics",
          },
        },
        500,
      );
    }
  },
);

/**
 * Product analytics endpoint
 * GET /api/v1/analytics/products
 */
routes.get(
  "/products",
  authMiddleware,
  requireRole([0, 1]),
  validateQuery(analyticsQuerySchema),
  async (c) => {
    try {
      const query = c.get("validatedQuery");
      const user = c.get("user");

      const analyticsService: IAnalyticsService = new AnalyticsService(
        c.env.DB,
        c.env,
        c.env.CACHE_KV,
      );

      // For owners, only show their restaurant data
      const filters = {
        ...query,
        restaurantId: user.role === 1 ? user.restaurantId : query.restaurantId,
      };

      const productData = await analyticsService.getProductAnalytics(filters);

      return c.json({
        success: true,
        data: productData,
      });
    } catch (error) {
      console.error("Get product analytics error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "PRODUCT_ANALYTICS_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch product analytics",
          },
        },
        500,
      );
    }
  },
);

/**
 * Customer analytics endpoint
 * GET /api/v1/analytics/customers
 */
routes.get(
  "/customers",
  authMiddleware,
  requireRole([0, 1]),
  validateQuery(analyticsQuerySchema),
  async (c) => {
    try {
      const query = c.get("validatedQuery");
      const user = c.get("user");

      const analyticsService: IAnalyticsService = new AnalyticsService(
        c.env.DB,
        c.env,
        c.env.CACHE_KV,
      );

      // For owners, only show their restaurant data
      const filters = {
        ...query,
        restaurantId: user.role === 1 ? user.restaurantId : query.restaurantId,
      };

      const customerData = await analyticsService.getCustomerAnalytics(filters);

      return c.json({
        success: true,
        data: customerData,
      });
    } catch (error) {
      console.error("Get customer analytics error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "CUSTOMER_ANALYTICS_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch customer analytics",
          },
        },
        500,
      );
    }
  },
);

/**
 * Performance analytics endpoint
 * GET /api/v1/analytics/performance
 */
routes.get(
  "/performance",
  authMiddleware,
  requireRole([0, 1, 2]), // Admin, Owner, Chef
  validateQuery(performanceQuerySchema),
  async (c) => {
    try {
      const query = c.get("validatedQuery");
      const user = c.get("user");

      const analyticsService: IAnalyticsService = new AnalyticsService(
        c.env.DB,
        c.env,
        c.env.CACHE_KV,
      );

      // For non-admin users, only show their restaurant data
      const filters = {
        ...query,
        restaurantId: user.role >= 1 ? user.restaurantId : query.restaurantId,
      };

      const performanceData =
        await analyticsService.getPerformanceAnalytics(filters);

      return c.json({
        success: true,
        data: performanceData,
      });
    } catch (error) {
      console.error("Get performance analytics error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "PERFORMANCE_ANALYTICS_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch performance analytics",
          },
        },
        500,
      );
    }
  },
);

/**
 * Export analytics endpoint
 * GET /api/v1/analytics/export
 */
routes.get(
  "/export",
  authMiddleware,
  requireRole([0, 1]),
  validateQuery(exportQuerySchema),
  async (c) => {
    try {
      const query = c.get("validatedQuery");
      const user = c.get("user");

      const analyticsService: IAnalyticsService = new AnalyticsService(
        c.env.DB,
        c.env,
        c.env.CACHE_KV,
      );

      // For owners, only allow their restaurant data
      const exportRequest = {
        ...query,
        restaurantId: user.role === 1 ? user.restaurantId : query.restaurantId,
      };

      const exportResult = await analyticsService.generateExport(exportRequest);

      return c.json(exportResult);
    } catch (error) {
      console.error("Export analytics error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "EXPORT_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to export analytics",
          },
        },
        500,
      );
    }
  },
);

/**
 * Real-time dashboard endpoint
 * GET /api/v1/analytics/realtime-dashboard
 */
routes.get(
  "/realtime-dashboard",
  authMiddleware,
  requireRole([0, 1, 2]), // Admin, Owner, Chef
  validateQuery(realtimeDashboardQuerySchema),
  async (c) => {
    try {
      const { restaurantId } = c.get("validatedQuery");
      const user = c.get("user");

      const analyticsService: IAnalyticsService = new AnalyticsService(
        c.env.DB,
        c.env,
        c.env.CACHE_KV,
      );

      // For non-admin users, only show their restaurant data
      const targetRestaurantId =
        user.role >= 1 ? user.restaurantId : restaurantId;

      const realtimeData =
        await analyticsService.getRealtimeData(targetRestaurantId);

      return c.json({
        success: true,
        data: realtimeData,
        timestamp: realtimeData.timestamp,
      });
    } catch (error) {
      console.error("Get realtime dashboard error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "REALTIME_DASHBOARD_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch realtime dashboard data",
          },
        },
        500,
      );
    }
  },
);

/**
 * Detailed performance analytics endpoint
 * GET /api/v1/analytics/detailed-performance
 */
routes.get(
  "/detailed-performance",
  authMiddleware,
  requireRole([0, 1, 2]), // Admin, Owner, Chef
  validateQuery(detailedPerformanceQuerySchema),
  async (c) => {
    try {
      const query = c.get("validatedQuery");
      const user = c.get("user");

      const analyticsService: IAnalyticsService = new AnalyticsService(
        c.env.DB,
        c.env,
        c.env.CACHE_KV,
      );

      // For non-admin users, only show their restaurant data
      const filters = {
        ...query,
        restaurantId: user.role >= 1 ? user.restaurantId : query.restaurantId,
      };

      const detailedPerformanceData =
        await analyticsService.getPerformanceAnalytics(filters);

      return c.json({
        success: true,
        data: detailedPerformanceData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Get detailed performance error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "DETAILED_PERFORMANCE_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch detailed performance data",
          },
        },
        500,
      );
    }
  },
);

/**
 * Owner dashboard endpoint
 * GET /api/v1/analytics/owner-dashboard
 */
routes.get(
  "/owner-dashboard",
  authMiddleware,
  requireRole([0, 1]), // Admin, Owner
  validateQuery(ownerDashboardQuerySchema),
  async (c) => {
    try {
      const { restaurantId } = c.get("validatedQuery");
      const user = c.get("user");

      const analyticsService: IAnalyticsService = new AnalyticsService(
        c.env.DB,
        c.env,
        c.env.CACHE_KV,
      );

      // For owners, only show their restaurant data
      const targetRestaurantId =
        user.role === 1 ? user.restaurantId : restaurantId;

      const ownerDashboardData =
        await analyticsService.getDashboardData(targetRestaurantId);

      return c.json({
        success: true,
        data: ownerDashboardData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Get owner dashboard error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "OWNER_DASHBOARD_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch owner dashboard data",
          },
        },
        500,
      );
    }
  },
);

/**
 * Financial report endpoint
 * GET /api/v1/analytics/financial-report
 */
routes.get(
  "/financial-report",
  authMiddleware,
  requireRole([0, 1]),
  validateQuery(financialReportQuerySchema),
  async (c) => {
    try {
      const query = c.get("validatedQuery");
      const user = c.get("user");

      const analyticsService: IAnalyticsService = new AnalyticsService(
        c.env.DB,
        c.env,
        c.env.CACHE_KV,
      );

      // For owners, only show their restaurant data
      const filters = {
        ...query,
        restaurantId: user.role === 1 ? user.restaurantId : query.restaurantId,
      };

      const financialReportData =
        await analyticsService.getFinancialReport(filters);

      return c.json({
        success: true,
        data: financialReportData,
      });
    } catch (error) {
      console.error("Get financial report error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "FINANCIAL_REPORT_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to fetch financial report",
          },
        },
        500,
      );
    }
  },
);

/**
 * Server-Sent Events (SSE) endpoint for real-time analytics
 * GET /api/v1/analytics/sse
 */
routes.get(
  "/sse",
  authMiddleware,
  requireRole([0, 1, 2]), // Admin, Owner, Chef
  validateQuery(sseQuerySchema),
  async (c) => {
    try {
      const user = c.get("user");
      const { lastEventId: _lastEventId } = c.get("validatedQuery");

      // Set SSE headers
      c.header("Content-Type", "text/event-stream");
      c.header("Cache-Control", "no-cache");
      c.header("Connection", "keep-alive");
      c.header("Access-Control-Allow-Origin", "*");
      c.header("Access-Control-Allow-Headers", "Cache-Control");

      // Create ReadableStream for SSE
      const stream = new ReadableStream({
        start(controller) {
          const analyticsService = new AnalyticsService(
            c.env.DB,
            c.env,
            c.env.CACHE_KV,
          );

          // Send initial connection confirmation
          const welcomeEvent: SSEAnalyticsEvent = {
            id: Date.now().toString(),
            event: "heartbeat",
            data: {
              message: "SSE connected",
              timestamp: new Date().toISOString(),
            },
          };
          const welcomeData = `id: ${welcomeEvent.id}\nevent: ${welcomeEvent.event}\ndata: ${JSON.stringify(welcomeEvent.data)}\n\n`;
          controller.enqueue(new TextEncoder().encode(welcomeData));

          // Set up heartbeat interval
          const heartbeatInterval = setInterval(() => {
            try {
              const heartbeatEvent: SSEAnalyticsEvent = {
                id: Date.now().toString(),
                event: "heartbeat",
                data: {
                  message: "heartbeat",
                  timestamp: new Date().toISOString(),
                },
              };
              const heartbeatData = `id: ${heartbeatEvent.id}\nevent: ${heartbeatEvent.event}\ndata: ${JSON.stringify(heartbeatEvent.data)}\n\n`;
              controller.enqueue(new TextEncoder().encode(heartbeatData));
            } catch (error) {
              console.error("SSE heartbeat error:", error);
              clearInterval(heartbeatInterval);
            }
          }, 30000); // Every 30 seconds

          // Set up statistics push interval
          const statsInterval = setInterval(async () => {
            try {
              // Get target restaurant ID based on user role
              const targetRestaurantId =
                user.role >= 1 ? user.restaurantId : undefined;

              // Get real-time analytics data
              const realtimeData =
                await analyticsService.getRealtimeData(targetRestaurantId);

              const statisticsEvent: SSEAnalyticsEvent = {
                id: Date.now().toString(),
                event: "statistics_update",
                data: realtimeData,
              };
              const eventData = `id: ${statisticsEvent.id}\nevent: ${statisticsEvent.event}\ndata: ${JSON.stringify(statisticsEvent.data)}\n\n`;
              controller.enqueue(new TextEncoder().encode(eventData));
            } catch (error) {
              console.error("SSE statistics update error:", error);
              const errorEvent: SSEAnalyticsEvent = {
                id: Date.now().toString(),
                event: "error",
                data: {
                  error: "Failed to fetch statistics",
                  timestamp: new Date().toISOString(),
                },
              };
              const errorData = `id: ${errorEvent.id}\nevent: ${errorEvent.event}\ndata: ${JSON.stringify(errorEvent.data)}\n\n`;
              controller.enqueue(new TextEncoder().encode(errorData));
            }
          }, 10000); // Every 10 seconds

          // Cleanup function
          const cleanup = () => {
            clearInterval(heartbeatInterval);
            clearInterval(statsInterval);
            try {
              controller.close();
            } catch (error) {
              console.error("SSE cleanup error:", error);
            }
          };

          // Listen for abort signal
          c.req.raw.signal?.addEventListener("abort", cleanup);

          // Set timeout cleanup (prevent connection leaks)
          setTimeout(cleanup, 3600000); // 1 hour
        },

        cancel() {
          console.log("SSE stream cancelled");
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Cache-Control",
        },
      });
    } catch (error) {
      console.error("SSE endpoint error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "SSE_CONNECTION_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to establish SSE connection",
          },
        },
        500,
      );
    }
  },
);

export default routes;
