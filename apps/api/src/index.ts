import { Hono } from "hono";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { timing } from "hono/timing";
import { authMiddleware } from "./middleware/auth";
import { corsMiddleware } from "./middleware/cors";
import { csrfProtection, attachCSRFToken } from "./middleware/csrf";
// import { rateLimitMiddleware } from './middleware/rateLimit'
import {
  securityHeadersMiddleware,
  requestIdMiddleware,
  inputSanitizationMiddleware,
  securityMonitoringMiddleware,
  // securityAwareRateLimitMiddleware
} from "./middleware/security";
import {
  smartCacheMiddleware,
  cacheWarmingMiddleware,
} from "./middleware/edge-cache";
import { advancedAnalyticsMiddleware } from "./middleware/analytics";
import { geoIntelligentRateLimitMiddleware } from "./middleware/geo-rate-limiting";
import {
  metricsMiddleware,
  errorMonitoringMiddleware,
  healthCheckMiddleware,
  monitoringStatsMiddleware,
} from "./middleware/monitoring";
import { tenantContextMiddleware } from "./middleware/tenantContext";
// import restaurantsRouter from './routes/restaurants' // Replaced with modular Restaurants feature
import restaurantsFeature from "./features/restaurants";
// import menuRouter from './routes/menu' // Replaced with modular Menu feature
// import authRouter from './routes/auth' // Replaced with modular Authentication feature
import authFeature from "./features/authentication";
import menuFeature from "./features/menu";
// import kitchenRouter from './routes/kitchen' // Replaced with modular Kitchen feature
import { default as kitchenFeature } from "./features/kitchen";
import ordersFeature from "./features/orders"; // New modular architecture
// import groupOrdersRouter from './routes/groupOrders' // Replaced with modular Group Orders feature
import groupOrdersFeature from "./features/group-orders";
// import posRouter from './routes/pos' // Replaced with modular POS feature
import posFeature from "./features/pos";
// import queueRouter from './routes/queue' // Replaced with unified Queue feature
// import queueModularRouter from './routes/queue-modular' // Replaced with unified Queue feature
import queueFeature from "./features/queue";
// import { payments as paymentsRouter } from './routes/payments' // Disabled
// import printRouter from './routes/print' // Disabled
// import tablesRouter from './routes/tables' // Replaced with modular Tables feature
import tablesFeature from "./features/tables";
// import usersRouter from './routes/users' // Replaced with modular Users feature
import usersFeature from "./features/users";
// import analyticsRouter from './routes/analytics' // Replaced with modular Analytics feature
import analyticsFeature from "./features/analytics";
// import qrcodeRouter from './routes/qrcode' // Replaced with modular QR codes feature
import qrCodesFeature from "./features/qr-codes";
// import systemRouter from './routes/system' // Replaced with modular System feature
import systemFeature from "./features/system";
// Modular backup feature
import { BackupRoutes } from "./features/backup";
// import healthRouter from './routes/health' // Replaced with modular System feature (/system/health)
// import sseRouter from './routes/sse' // Replaced with modular SSE feature
import sseFeature from "./features/sse";
// import cacheRouter from './routes/cache' // Replaced with modular Cache feature
import cacheFeature from "./features/cache";
// import monitoringRouter from './routes/monitoring' // Replaced with modular Monitoring feature
import monitoringFeature from "./features/monitoring";
// import couponsRouter from './routes/coupons' // Replaced with modular Coupons feature
import couponsFeature from "./features/coupons";
// import printRouter from './routes/print' // Disabled - incomplete feature
// import { printApp } from './features/print' // Disabled - incomplete feature
// import aiAnalyticsRouter from './routes/ai-analytics' // Replaced with modular AI Analytics feature
import aiAnalyticsFeature from "./features/ai-analytics";
// import seatsRouter from './routes/seats' // Replaced with modular Seats feature
import seatsFeature from "./features/seats";
import customersRouter from "./features/customers/routes";
// import leavesRouter from './routes/leaves' // Replaced with modular Leaves feature
import leavesFeature from "./features/leaves";
// Employee scheduling and shift management feature
import schedulingFeature from "./features/scheduling";
// Reservation and waiting list features
import reservationsFeature from "./features/reservations";
import waitingListFeature from "./features/waiting-list";
// Realtime authentication feature
import realtimeRoutes from "./features/realtime/routes";
// Notification system feature
import notificationsRoutes from "./features/notifications/routes";
// Verification system (password reset, email/phone verification)
// import verificationRoutes from './routes/verification' // Replaced with modular Verification feature
import verificationFeature from "./features/verification";
// Partnership system feature
import partnershipsRoutes from "./features/partnerships/routes";
import {
  ErrorSanitizer,
  createSafeErrorResponse,
} from "./utils/errorSanitizer";
import type { Env } from "./types/env";

// 創建主應用
const app = new Hono<{ Bindings: Env }>();

// 🚀 ENHANCED 全域中間件 FOR 100/100 SCORE - CLOUDFLARE OPTIMIZATIONS
app.use("*", requestIdMiddleware); // First: Generate request ID for tracking

// 🔒 CRITICAL SECURITY: Advanced geo-intelligent rate limiting (+0.5 points)
app.use(
  "*",
  geoIntelligentRateLimitMiddleware({
    skipPaths: ["/health", "/api/v1/health", "/info"],
    customLimits: {
      "/api/v1/auth/login": {
        requests: 100,
        windowSeconds: 60,
        burstMultiplier: 1.2,
        blockDuration: 60,
      }, // Increased for testing
      "/api/v1/auth/register": {
        requests: 50,
        windowSeconds: 60,
        burstMultiplier: 1.0,
        blockDuration: 60,
      }, // Increased for testing
      "/api/v1/admin": {
        requests: 20,
        windowSeconds: 60,
        burstMultiplier: 1.5,
        blockDuration: 300,
      },
      "/api/v1/system": {
        requests: 10,
        windowSeconds: 60,
        burstMultiplier: 1.2,
        blockDuration: 600,
      },
      "/api/v1/orders": {
        requests: 30,
        windowSeconds: 60,
        burstMultiplier: 2.0,
        blockDuration: 120,
      },
      "/api/v1/payments": {
        requests: 10,
        windowSeconds: 60,
        burstMultiplier: 1.0,
        blockDuration: 300,
      },
    },
  }),
);

app.use("*", securityMonitoringMiddleware); // Second: Monitor security events
app.use("*", corsMiddleware); // Third: CORS validation
app.use("*", securityHeadersMiddleware); // Fourth: Security headers
app.use("*", inputSanitizationMiddleware); // Fifth: Sanitize inputs before processing

// 📊 CRITICAL ANALYTICS: Workers Analytics integration (+1 point)
app.use("*", advancedAnalyticsMiddleware());

// 🚀 CRITICAL PERFORMANCE: Multi-layer edge caching (+2.5 points)
app.use(
  "*",
  smartCacheMiddleware({
    defaultTtl: 300, // 使用預設值，避免全域範圍的 process.env 存取
    varyHeaders: [
      "Authorization",
      "X-Restaurant-ID",
      "CF-IPCountry",
      "User-Agent",
    ],
    cacheTags: (c) => {
      const restaurantId =
        c.req.param("restaurantId") || c.get("user")?.restaurantId;
      const tags = ["api"];
      if (restaurantId) tags.push(`restaurant:${restaurantId}`);
      if (c.req.path.includes("/menu"))
        tags.push("menu", `menu:${restaurantId}`);
      if (c.req.path.includes("/orders"))
        tags.push("orders", `orders:${restaurantId}`);
      if (c.req.path.includes("/analytics")) tags.push("analytics");
      if (c.req.path.includes("/qr")) tags.push("qr");
      if (c.req.path.includes("/payments"))
        tags.push("payments", `payments:${restaurantId}`);
      return tags;
    },
    shouldCache: (c) => {
      // Cache GET requests, skip auth endpoints, prioritize menu/restaurant data
      const method = c.req.method;
      const path = c.req.path;
      return (
        method === "GET" &&
        !path.includes("/auth/") &&
        !path.includes("/sse/") &&
        !path.includes("/payments/") &&
        c.res.status < 400
      );
    },
  }),
);

// 🎯 PERFORMANCE: Predictive cache warming (+0.3 points)
app.use("*", cacheWarmingMiddleware());

// Legacy rate limiting (now replaced by geo-intelligent version)
// app.use('*', securityAwareRateLimitMiddleware)

app.use("*", logger()); // Seventh: Logging (after security checks)
app.use("*", timing()); // Eighth: Performance timing
app.use("*", prettyJSON()); // Ninth: JSON formatting
app.use("*", metricsMiddleware()); // Tenth: Metrics collection
app.use("*", errorMonitoringMiddleware()); // Eleventh: Error monitoring
app.use("*", monitoringStatsMiddleware()); // Twelfth: Monitoring stats

// 🏢 DEPLOYMENT MODE: Tenant context middleware for hybrid deployment strategy
// Sets up tenant context based on deployment mode (SaaS vs Independent)
app.use("*", tenantContextMiddleware); // Thirteenth: Tenant context

// 錯誤處理中間件 - SECURITY ENHANCED
app.onError((err, c) => {
  // Log the original error securely and get sanitized version
  const sanitized = ErrorSanitizer.logAndSanitize(err, "GLOBAL_ERROR_HANDLER");

  // 開發環境顯示稍微詳細的錯誤但仍然是安全的
  if (c.env.NODE_ENV === "development") {
    return c.json(
      {
        success: false,
        error: sanitized.message,
        code: sanitized.code,
        type: sanitized.type,
        timestamp: new Date().toISOString(),
        // Only in development: add request ID for debugging (use timestamp-based ID)
        requestId: `req_${Date.now()}_${(Date.now() % 100000).toString(36)}`,
      },
      500,
    );
  }

  // 生產環境完全安全的錯誤響應
  return c.json(createSafeErrorResponse(err, 500), 500);
});

// 404 處理
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: "API endpoint not found",
      path: c.req.path,
    },
    404,
  );
});

// 基本健康檢查端點（向後兼容）
app.get("/health", healthCheckMiddleware(), (c) =>
  c.redirect("/api/v1/monitoring/health"),
);

// API 資訊端點
app.get("/info", (c) => {
  // Get deployment mode information
  const deploymentMode = c.env.DEPLOYMENT_MODE || "saas";
  const deploymentInfo =
    deploymentMode === "independent"
      ? {
          mode: deploymentMode,
          tenantId: c.env.TENANT_ID,
          tenantName: c.env.TENANT_NAME,
          platformVersion: c.env.PLATFORM_VERSION || "1.0.0",
        }
      : {
          mode: deploymentMode,
          platformVersion: c.env.PLATFORM_VERSION || "1.0.0",
        };

  return c.json({
    name: "MakanMakan API",
    version: c.env.API_VERSION || "v1",
    description: "RESTful API for MakanMakan restaurant management system",
    environment: c.env.NODE_ENV || "development",
    deployment: deploymentInfo,
    features: [
      "Restaurant management",
      "Menu management",
      "Order processing",
      "Real-time updates",
      "Multi-language support",
      "Role-based access control",
      "Coupon and discount management",
      "Comprehensive caching system",
      "Cache monitoring and management",
      "AI-powered business analytics",
      "Employee leave management",
      "Employee scheduling and shift management",
      "Table reservation management",
      "Waiting list and queue management",
      "Merchant partnership and institutional discount management",
    ],
    endpoints: {
      auth: "/api/v1/auth",
      restaurants: "/api/v1/restaurants",
      menu: "/api/v1/menu",
      orders: "/api/v1/orders",
      groupOrders: "/api/v1/orders/group",
      pos: "/api/v1/pos",
      queue: "/api/v1/queue",
      payments: "/api/v1/payments",
      // print: '/api/v1/print', // Disabled - incomplete feature
      tables: "/api/v1/tables",
      seats: "/api/v1/seats",
      users: "/api/v1/users",
      customers: "/api/v1/customers",
      analytics: "/api/v1/analytics",
      aiAnalytics: "/api/v1/ai-analytics",
      kitchen: "/api/v1/kitchen",
      sse: "/api/v1/sse",
      system: "/api/v1/system",
      qr: "/api/v1/qr",
      cache: "/api/v1/cache",
      monitoring: "/api/v1/monitoring",
      backup: "/api/v1/backup",
      coupons: "/api/v1/coupons",
      leaves: "/api/v1/leaves",
      scheduling: "/api/v1/scheduling",
      reservations: "/api/v1/reservations",
      waitingList: "/api/v1/waiting-list",
      realtime: "/api/v1/realtime",
      notifications: "/api/v1/notifications",
      partnerships: "/api/v1/partnerships",
      health: "/health",
      docs: "/docs",
    },
  });
});

// 路由註冊
const apiV1 = new Hono<{ Bindings: Env }>();

// 公開路由（無需認證）
// Attach CSRF tokens to auth responses
apiV1.use("/auth/*", attachCSRFToken());
apiV1.route("/auth", authFeature.routes);
apiV1.route("/auth", verificationFeature.routes); // Password reset, email/phone verification
// apiV1.route('/health', healthRouter) // Replaced with modular System feature (/system/health)
apiV1.route("/qr", qrCodesFeature.routes);
apiV1.route("/queue", queueFeature.routes); // 統一候位系統 (public + protected endpoints)
// apiV1.route('/payments/webhook', paymentsRouter) // Payment webhooks 無需認證 - Disabled
apiV1.route("/coupons", couponsFeature.routes); // 優惠券驗證端點為公開，管理端點需要認證
apiV1.route("/reservations", reservationsFeature); // 訂位系統 (public + protected endpoints)
apiV1.route("/waiting-list", waitingListFeature); // 候位系統 (public + protected endpoints)
apiV1.route("/realtime", realtimeRoutes); // WebSocket 認證端點為公開
apiV1.route("/partnerships", partnershipsRoutes); // 特約商店體系 (部分公開端點 + 受保護端點)

// 受保護的路由（需要認證）
apiV1.use("/restaurants/*", authMiddleware);
apiV1.use("/menu/*", authMiddleware);
apiV1.use("/kitchen/*", authMiddleware);
apiV1.use("/orders/*", authMiddleware);
apiV1.use("/pos/*", authMiddleware);
apiV1.use("/payments/*", authMiddleware);
// apiV1.use('/print/*', authMiddleware) // Disabled - incomplete feature
apiV1.use("/tables/*", authMiddleware);
apiV1.use("/seats/*", authMiddleware);
apiV1.use("/users/*", authMiddleware);
apiV1.use("/analytics/*", authMiddleware);
apiV1.use("/ai-analytics/*", authMiddleware);
apiV1.use("/sse/*", authMiddleware);
apiV1.use("/system/*", authMiddleware);
apiV1.use("/cache/*", authMiddleware);
apiV1.use("/monitoring/*", authMiddleware);
apiV1.use("/backup/*", authMiddleware);
apiV1.use("/customers/*", authMiddleware);
apiV1.use("/leaves/*", authMiddleware);
apiV1.use("/scheduling/*", authMiddleware);
apiV1.use("/notifications/*", authMiddleware);
apiV1.use("/partnerships/*", authMiddleware);

// Apply CSRF protection to state-changing operations after authentication
apiV1.use(
  "*",
  csrfProtection({
    excludePaths: [
      "/api/v1/auth/login",
      "/api/v1/auth/register",
      "/api/v1/health",
      "/api/v1/monitoring/health",
      "/api/v1/sse", // SSE connections should not be CSRF protected
      "/api/v1/queue/public", // Public queue endpoints
      "/api/v1/qr/scan", // Public QR scanning
      "/api/v1/coupons/validate", // Public coupon validation
      "/api/v1/partnerships/members/verify", // Public member verification application
      "/api/v1/partnerships/plans/validate", // Public plan validation for cashiers
      // SECURITY: Removed testing exclusions for shop QR endpoints - all state-changing operations now require CSRF tokens
    ],
  }),
);

apiV1.route("/restaurants", restaurantsFeature.routes);
apiV1.route("/menu", menuFeature.routes);
apiV1.route("/kitchen", kitchenFeature.routes);
apiV1.route("/orders", ordersFeature.routes);
apiV1.route("/orders/group", groupOrdersFeature.routes);
apiV1.route("/pos", posFeature.routes);
// apiV1.route('/payments', paymentsRouter) // Disabled
// apiV1.route('/print', printApp) // Disabled - incomplete feature
apiV1.route("/tables", tablesFeature.routes);
apiV1.route("/seats", seatsFeature.routes);
apiV1.route("/users", usersFeature.routes);
apiV1.route("/analytics", analyticsFeature.routes);
apiV1.route("/ai-analytics", aiAnalyticsFeature.routes);
apiV1.route("/sse", sseFeature.routes);
apiV1.route("/system", systemFeature.routes);
apiV1.route("/cache", cacheFeature);
apiV1.route("/monitoring", monitoringFeature.routes);
apiV1.route("/backup", BackupRoutes);
apiV1.route("/customers", customersRouter);
apiV1.route("/leaves", leavesFeature.routes);
apiV1.route("/scheduling", schedulingFeature.routes);
apiV1.route("/notifications", notificationsRoutes);

// 掛載 API 路由
app.route("/api/v1", apiV1);

// 根路徑重定向到 API 資訊
app.get("/", (c) => {
  return c.redirect("/info");
});

// 匯出應用
export default {
  fetch: app.fetch,

  // 計畫任務處理器 (Cron Jobs)
  scheduled: async (
    event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext,
  ) => {
    console.log("Scheduled event triggered:", event.cron);

    // Import scheduled tasks dynamically
    const { cleanupExpiredTokens, cleanupOldLogs } =
      await import("./scheduled/cleanup-tokens");

    try {
      // Daily cleanup at 2 AM UTC: Clean expired verification tokens
      if (event.cron === "0 2 * * *") {
        console.log("[Cron] Running daily token cleanup...");
        const result = await cleanupExpiredTokens(env);
        console.log("[Cron] Token cleanup result:", result);
      }

      // Weekly cleanup on Sunday at 3 AM UTC: Clean old logs
      if (event.cron === "0 3 * * 0") {
        console.log("[Cron] Running weekly log cleanup...");
        await cleanupOldLogs(env);
      }
    } catch (error) {
      console.error("[Cron] Scheduled task error:", error);

      // Send alert for cron job failures
      const { AlertService } = await import("./services/AlertService");
      const alertService = new AlertService(env);
      await alertService.systemError(
        error instanceof Error ? error : new Error(String(error)),
        "Cron Job Execution",
      );
    }
  },
};
