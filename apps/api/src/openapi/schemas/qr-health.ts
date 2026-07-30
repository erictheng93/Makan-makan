/**
 * QR Code & System Health API OpenAPI Schemas
 * QR 碼與系統健康 API Schema 定義
 */

import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { errorResponses } from "../config";

// Define enums first to avoid circular reference
const QRCodeType = z.enum(["table", "seat", "shop", "payment", "menu"]);
const QRCodeFormat = z.enum(["svg", "png", "pdf"]);
const HealthStatus = z.enum([
  "healthy",
  "degraded",
  "unhealthy",
  "maintenance",
]);

/**
 * QR Code & System Health API Schemas
 */
export const QRHealthSchemas = {
  // QR Code Type
  QRCodeType,

  // QR Code Format
  QRCodeFormat,

  // System Health Status
  HealthStatus,

  // QR Code Template
  QRTemplate: z.object({
    id: z.string().uuid(),
    restaurantId: z.string().uuid(),
    name: z.string(),
    type: QRCodeType,
    design: z.object({
      logo: z.string().url().optional(),
      primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i),
      secondaryColor: z
        .string()
        .regex(/^#[0-9A-F]{6}$/i)
        .optional(),
      backgroundColor: z
        .string()
        .regex(/^#[0-9A-F]{6}$/i)
        .default("#FFFFFF"),
      cornerStyle: z.enum(["square", "rounded", "dot"]).default("square"),
      errorCorrectionLevel: z.enum(["L", "M", "Q", "H"]).default("M"),
    }),
    isActive: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),

  // Create QR Template Request
  CreateQRTemplateRequest: z.object({
    restaurantId: z.string().uuid(),
    name: z.string().min(1, "Template name is required"),
    type: QRCodeType,
    design: z.object({
      logo: z.string().url().optional(),
      primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i, "Invalid hex color"),
      secondaryColor: z
        .string()
        .regex(/^#[0-9A-F]{6}$/i, "Invalid hex color")
        .optional(),
      backgroundColor: z
        .string()
        .regex(/^#[0-9A-F]{6}$/i, "Invalid hex color")
        .optional(),
      cornerStyle: z.enum(["square", "rounded", "dot"]).optional(),
      errorCorrectionLevel: z.enum(["L", "M", "Q", "H"]).optional(),
    }),
  }),

  // Generate QR Code Request
  GenerateQRCodeRequest: z.object({
    type: QRCodeType,
    targetId: z.string().uuid(), // tableId, seatId, restaurantId, etc.
    restaurantId: z.string().uuid(),
    templateId: z.string().uuid().optional(),
    format: QRCodeFormat.default("png"),
    size: z.number().int().min(128).max(2048).default(512),
    metadata: z.record(z.string(), z.string()).optional(),
  }),

  // Generate QR Code Response
  GenerateQRCodeResponse: z.object({
    success: z.boolean(),
    qrCode: z.object({
      id: z.string().uuid(),
      type: QRCodeType,
      url: z.string().url(),
      imageUrl: z.string().url(),
      metadata: z.record(z.string(), z.string()),
      createdAt: z.string().datetime(),
      expiresAt: z.string().datetime().optional(),
    }),
  }),

  // Bulk Generate QR Codes Request
  BulkGenerateQRCodesRequest: z.object({
    type: QRCodeType,
    targetIds: z
      .array(z.string().uuid())
      .min(1, "At least one target ID required")
      .max(100),
    restaurantId: z.string().uuid(),
    templateId: z.string().uuid().optional(),
    format: QRCodeFormat.default("png"),
    size: z.number().int().min(128).max(2048).default(512),
  }),

  // Bulk Generate QR Codes Response
  BulkGenerateQRCodesResponse: z.object({
    success: z.boolean(),
    qrCodes: z.array(
      z.object({
        id: z.string().uuid(),
        targetId: z.string().uuid(),
        type: QRCodeType,
        url: z.string().url(),
        imageUrl: z.string().url(),
      }),
    ),
    meta: z.object({
      totalGenerated: z.number().int(),
      totalFailed: z.number().int(),
      downloadUrl: z.string().url().optional(), // ZIP file for bulk download
    }),
  }),

  // System Health
  SystemHealth: z.object({
    status: HealthStatus,
    timestamp: z.string().datetime(),
    uptime: z.number().int(), // seconds
    version: z.string(),
    services: z.object({
      api: z.object({
        status: HealthStatus,
        responseTime: z.number(), // ms
        requestsPerMinute: z.number(),
      }),
      database: z.object({
        status: HealthStatus,
        connections: z.number().int(),
        queryTime: z.number(), // ms average
      }),
      cache: z.object({
        status: HealthStatus,
        hitRate: z.number().min(0).max(1),
        evictions: z.number().int(),
      }),
      websocket: z.object({
        status: HealthStatus,
        activeConnections: z.number().int(),
        messageRate: z.number(), // messages per second
      }),
      storage: z.object({
        status: HealthStatus,
        usedSpace: z.number(), // bytes
        totalSpace: z.number(), // bytes
      }),
    }),
    issues: z.array(
      z.object({
        service: z.string(),
        severity: z.enum(["low", "medium", "high", "critical"]),
        message: z.string(),
        timestamp: z.string().datetime(),
      }),
    ),
  }),

  // Performance Metrics
  PerformanceMetrics: z.object({
    period: z.object({
      startTime: z.string().datetime(),
      endTime: z.string().datetime(),
    }),
    requests: z.object({
      total: z.number().int(),
      successful: z.number().int(),
      failed: z.number().int(),
      errorRate: z.number().min(0).max(1),
      averageResponseTime: z.number(), // ms
      p50ResponseTime: z.number(), // ms
      p95ResponseTime: z.number(), // ms
      p99ResponseTime: z.number(), // ms
    }),
    database: z.object({
      queries: z.number().int(),
      averageQueryTime: z.number(), // ms
      slowQueries: z.number().int(),
      connectionPoolUsage: z.number().min(0).max(1),
    }),
    cache: z.object({
      hits: z.number().int(),
      misses: z.number().int(),
      hitRate: z.number().min(0).max(1),
      averageReadTime: z.number(), // ms
    }),
    websocket: z.object({
      totalConnections: z.number().int(),
      averageConnectionDuration: z.number(), // seconds
      messagesDelivered: z.number().int(),
      messageDeliveryRate: z.number().min(0).max(1),
    }),
    errors: z.array(
      z.object({
        type: z.string(),
        count: z.number().int(),
        percentage: z.number().min(0).max(1),
      }),
    ),
  }),
};

/**
 * QR Code & System Health API Routes
 */

// Generate Individual QR Code
export const generateQRCodeRoute = createRoute({
  method: "post",
  path: "/api/v1/qr/generate",
  tags: ["qr-codes"],
  summary: "生成 QR 碼",
  description: "生成單個 QR 碼（桌號、座位、店舖等）",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: QRHealthSchemas.GenerateQRCodeRequest,
        },
      },
    },
  },
  responses: {
    201: {
      description: "QR 碼生成成功",
      content: {
        "application/json": {
          schema: QRHealthSchemas.GenerateQRCodeResponse,
        },
      },
    },
    ...errorResponses(400, 401, 403),
  },
});

// Bulk Generate QR Codes
export const bulkGenerateQRCodesRoute = createRoute({
  method: "post",
  path: "/api/v1/qr/bulk",
  tags: ["qr-codes"],
  summary: "批次生成 QR 碼",
  description: "批次生成多個 QR 碼並提供 ZIP 下載",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: QRHealthSchemas.BulkGenerateQRCodesRequest,
        },
      },
    },
  },
  responses: {
    201: {
      description: "批次生成成功",
      content: {
        "application/json": {
          schema: QRHealthSchemas.BulkGenerateQRCodesResponse,
        },
      },
    },
    ...errorResponses(400, 401, 403),
  },
});

// Get QR Code Templates
export const getQRTemplatesRoute = createRoute({
  method: "get",
  path: "/api/v1/qr/templates/:restaurantId",
  tags: ["qr-codes"],
  summary: "獲取 QR 碼模板",
  description: "獲取餐廳的 QR 碼設計模板",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.string().uuid(),
    }),
    query: z.object({
      type: QRHealthSchemas.QRCodeType.optional(),
      isActive: z
        .string()
        .transform((val) => val === "true")
        .optional(),
    }),
  },
  responses: {
    200: {
      description: "成功獲取模板列表",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(QRHealthSchemas.QRTemplate),
          }),
        },
      },
    },
    ...errorResponses(401, 403),
  },
});

// Create QR Code Template
export const createQRTemplateRoute = createRoute({
  method: "post",
  path: "/api/v1/qr/templates",
  tags: ["qr-codes"],
  summary: "創建 QR 碼模板",
  description: "創建新的 QR 碼設計模板",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: QRHealthSchemas.CreateQRTemplateRequest,
        },
      },
    },
  },
  responses: {
    201: {
      description: "模板創建成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: QRHealthSchemas.QRTemplate,
          }),
        },
      },
    },
    ...errorResponses(400, 401, 403),
  },
});

// Get System Health
export const getSystemHealthRoute = createRoute({
  method: "get",
  path: "/api/v1/system/health",
  tags: ["system-health"],
  summary: "獲取系統健康狀態",
  description: "獲取系統各服務的健康狀態和運行指標",
  responses: {
    200: {
      description: "成功獲取健康狀態",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: QRHealthSchemas.SystemHealth,
          }),
        },
      },
    },
  },
});

// Get Performance Metrics
export const getPerformanceMetricsRoute = createRoute({
  method: "get",
  path: "/api/v1/metrics/performance",
  tags: ["system-health"],
  summary: "獲取性能指標",
  description: "獲取系統性能和使用統計",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      startTime: z.string().datetime(),
      endTime: z.string().datetime(),
      granularity: z.enum(["minute", "hour", "day"]).default("hour"),
    }),
  },
  responses: {
    200: {
      description: "成功獲取性能指標",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: QRHealthSchemas.PerformanceMetrics,
          }),
        },
      },
    },
    ...errorResponses(400, 401),
  },
});
