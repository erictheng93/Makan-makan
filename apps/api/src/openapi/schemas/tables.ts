/**
 * Tables API OpenAPI Schemas
 * 桌位管理 API Schema 定義
 */

import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { errorResponses } from "../config";

// Define enums first to avoid circular reference
const TableStatus = z.enum(["available", "occupied", "reserved", "cleaning"]);
const Table = z.object({
  id: z.string().uuid(),
  restaurantId: z.string().uuid(),
  name: z.string().min(1),
  capacity: z.number().int().positive(),
  status: TableStatus,
  floor: z.string().optional(),
  section: z.string().optional(),
  qrCodeUrl: z.string().url().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Tables API Schemas
 */
export const TablesSchemas = {
  // Table Status Enum
  TableStatus,

  // Table
  Table,

  // Get Tables Request
  GetTablesRequest: z.object({
    restaurantId: z.string().uuid(),
    status: TableStatus.optional(),
    floor: z.string().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).prefault("1"),
    pageSize: z.string().regex(/^\d+$/).transform(Number).prefault("20"),
  }),

  // Get Tables Response
  GetTablesResponse: z.object({
    success: z.boolean(),
    data: z.array(Table),
    meta: z.object({
      total: z.number(),
      page: z.number(),
      pageSize: z.number(),
      totalPages: z.number(),
    }),
  }),

  // Create Table Request
  CreateTableRequest: z.object({
    restaurantId: z.string().uuid(),
    name: z.string().min(1, "Table name is required"),
    capacity: z.number().int().positive("Capacity must be positive"),
    floor: z.string().optional(),
    section: z.string().optional(),
  }),

  // Update Table Request
  UpdateTableRequest: z.object({
    name: z.string().min(1).optional(),
    capacity: z.number().int().positive().optional(),
    status: TableStatus.optional(),
    floor: z.string().optional(),
    section: z.string().optional(),
  }),

  // Update Table Status Request
  UpdateTableStatusRequest: z.object({
    status: TableStatus,
  }),

  // Generate QR Code Request
  GenerateQRCodeRequest: z.object({
    template: z.enum(["basic", "branded", "custom"]).optional(),
    size: z.number().int().min(100).max(1000).optional(),
  }),
};

/**
 * Tables API Routes
 */

// Get Tables
export const getTablesRoute = createRoute({
  method: "get",
  path: "/api/v1/tables/:restaurantId",
  tags: ["tables"],
  summary: "獲取桌位列表",
  description: "獲取指定餐廳的所有桌位，支持按狀態、樓層過濾",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.string().uuid(),
    }),
    query: z.object({
      status: TablesSchemas.TableStatus.optional(),
      floor: z.string().optional(),
      page: z.string().regex(/^\d+$/).transform(Number).prefault("1"),
      pageSize: z.string().regex(/^\d+$/).transform(Number).prefault("20"),
    }),
  },
  responses: {
    200: {
      description: "成功獲取桌位列表",
      content: {
        "application/json": {
          schema: TablesSchemas.GetTablesResponse,
        },
      },
    },
    ...errorResponses(401, 404),
  },
});

// Create Table
export const createTableRoute = createRoute({
  method: "post",
  path: "/api/v1/tables",
  tags: ["tables"],
  summary: "創建新桌位",
  description: "在餐廳中創建新的桌位",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: TablesSchemas.CreateTableRequest,
        },
      },
    },
  },
  responses: {
    201: {
      description: "桌位創建成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: TablesSchemas.Table,
          }),
        },
      },
    },
    ...errorResponses(400, 401),
  },
});

// Update Table Status
export const updateTableStatusRoute = createRoute({
  method: "patch",
  path: "/api/v1/tables/:tableId/status",
  tags: ["tables"],
  summary: "更新桌位狀態",
  description: "更新桌位的使用狀態（可用、佔用、預訂、清理中）",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      tableId: z.string().uuid(),
    }),
    body: {
      content: {
        "application/json": {
          schema: TablesSchemas.UpdateTableStatusRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "狀態更新成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: TablesSchemas.Table,
          }),
        },
      },
    },
    ...errorResponses(400, 401, 404),
  },
});

// Generate QR Code
export const generateQRCodeRoute = createRoute({
  method: "post",
  path: "/api/v1/tables/:tableId/qr",
  tags: ["tables"],
  summary: "生成桌位 QR Code",
  description: "為指定桌位生成 QR Code，客戶掃描後可直接點餐",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      tableId: z.string().uuid(),
    }),
    body: {
      content: {
        "application/json": {
          schema: TablesSchemas.GenerateQRCodeRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "QR Code 生成成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              qrCodeUrl: z.string().url(),
              tableId: z.string().uuid(),
              expiresAt: z.string().datetime().optional(),
            }),
          }),
        },
      },
    },
    ...errorResponses(400, 401, 404),
  },
});
