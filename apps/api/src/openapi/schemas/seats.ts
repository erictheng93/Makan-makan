/**
 * Seats API OpenAPI Schemas
 * 座位管理 API Schema 定義
 */

import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { errorResponses } from "../config";

// Define enums first to avoid circular reference
const NumberingStyle = z.enum(["numeric", "alphabetic", "custom"]);

/**
 * Seats API Schemas
 */
export const SeatsSchemas = {
  // Numbering Style
  NumberingStyle,

  // Seat
  Seat: z.object({
    id: z.number().int(),
    tableId: z.number().int(),
    restaurantId: z.string(),
    seatNumber: z.number().int().positive(),
    seatName: z.string().optional(),
    qrCode: z.string().optional(),
    isActive: z.boolean(),
    isOccupied: z.boolean(),
    capacity: z.number().int().positive().default(1),
    orderId: z.number().int().optional(),
    occupiedBy: z.string().optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  }),

  // Public Seat Info (returned for QR code scans)
  PublicSeatInfo: z.object({
    id: z.number().int(),
    tableId: z.number().int(),
    tableNumber: z.string().optional(),
    restaurantId: z.string(),
    restaurantName: z.string().optional(),
    seatNumber: z.number().int(),
    seatName: z.string().optional(),
    isActive: z.boolean(),
    isOccupied: z.boolean(),
    capacity: z.number().int(),
  }),

  // Batch Create Seats Request
  BatchCreateSeatsRequest: z.object({
    tableId: z.number().int(),
    seatCount: z.number().int().min(1).max(50),
    numberingStyle: NumberingStyle.default("numeric"),
    customNumbers: z.array(z.string()).optional(),
    prefix: z.string().optional(),
  }),

  // Update Seat Request
  UpdateSeatRequest: z.object({
    seatName: z.string().optional(),
    isActive: z.boolean().optional(),
    capacity: z.number().int().positive().optional(),
  }),

  // Occupy Seat Request
  OccupySeatRequest: z.object({
    orderId: z.number().int().optional(),
    occupiedBy: z.string().optional(),
  }),

  // Seat Filter
  SeatFilter: z.object({
    tableId: z.number().int(),
    isActive: z.boolean().optional(),
    isOccupied: z.boolean().optional(),
  }),

  // Batch Regenerate QR Request
  BatchRegenerateQRRequest: z.object({
    tableId: z.number().int(),
  }),

  // Seat Statistics
  SeatStatistics: z.object({
    tableId: z.number().int(),
    totalSeats: z.number().int(),
    activeSeats: z.number().int(),
    occupiedSeats: z.number().int(),
    availableSeats: z.number().int(),
    occupancyRate: z.number().min(0).max(1),
  }),

  // QR Code Result
  QRCodeResult: z.object({
    seatId: z.number().int(),
    qrCode: z.string(),
    qrCodeUrl: z.url().optional(),
  }),
};

/**
 * Seats API Routes
 */

// Get Seats
export const getSeatsRoute = createRoute({
  method: "get",
  path: "/api/v1/seats",
  tags: ["seats"],
  summary: "獲取座位列表",
  description: "獲取指定桌位的所有座位，支持按狀態過濾",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      tableId: z.string().regex(/^\d+$/).transform(Number),
      isActive: z
        .string()
        .transform((val) => val === "true")
        .optional(),
      isOccupied: z
        .string()
        .transform((val) => val === "true")
        .optional(),
    }),
  },
  responses: {
    200: {
      description: "成功獲取座位列表",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(SeatsSchemas.Seat),
            total: z.number().int(),
            pagination: z.object({
              page: z.number(),
              pageSize: z.number(),
              totalPages: z.number(),
            }),
          }),
        },
      },
    },
    ...errorResponses(401, 403),
  },
});

// Get Seat Statistics
export const getSeatStatsRoute = createRoute({
  method: "get",
  path: "/api/v1/seats/stats",
  tags: ["seats"],
  summary: "獲取座位統計",
  description: "獲取指定桌位的座位統計數據",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      tableId: z.string().regex(/^\d+$/).transform(Number),
    }),
  },
  responses: {
    200: {
      description: "成功獲取座位統計",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: SeatsSchemas.SeatStatistics,
          }),
        },
      },
    },
    ...errorResponses(401, 403),
  },
});

// Get Seat by QR Code (Public)
export const getSeatByQRCodeRoute = createRoute({
  method: "get",
  path: "/api/v1/seats/qr/:qrCode",
  tags: ["seats"],
  summary: "掃描座位 QR Code",
  description: "客戶掃描座位 QR Code 獲取座位信息（公開端點，無需認證）",
  request: {
    params: z.object({
      qrCode: z.string(),
    }),
  },
  responses: {
    200: {
      description: "成功獲取座位信息",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: SeatsSchemas.PublicSeatInfo,
          }),
        },
      },
    },
    ...errorResponses(404),
  },
});

// Get Seat by ID
export const getSeatRoute = createRoute({
  method: "get",
  path: "/api/v1/seats/:id",
  tags: ["seats"],
  summary: "獲取座位詳情",
  description: "獲取指定座位的詳細信息",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().regex(/^\d+$/),
    }),
  },
  responses: {
    200: {
      description: "成功獲取座位詳情",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: SeatsSchemas.Seat,
          }),
        },
      },
    },
    ...errorResponses(401, 404),
  },
});

// Batch Create Seats
export const batchCreateSeatsRoute = createRoute({
  method: "post",
  path: "/api/v1/seats/batch-create",
  tags: ["seats"],
  summary: "批次創建座位",
  description:
    "為指定桌位批次創建座位，支持數字、字母、自定義三種編號方式，自動生成 QR Code",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: SeatsSchemas.BatchCreateSeatsRequest,
        },
      },
    },
  },
  responses: {
    201: {
      description: "座位創建成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(SeatsSchemas.Seat),
            message: z.string(),
          }),
        },
      },
    },
    ...errorResponses(400, 401, 403),
  },
});

// Batch Regenerate QR Codes
export const batchRegenerateQRRoute = createRoute({
  method: "post",
  path: "/api/v1/seats/batch-regenerate-qr",
  tags: ["seats"],
  summary: "批次重新生成 QR Code",
  description: "為指定桌位的所有座位重新生成 QR Code",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: SeatsSchemas.BatchRegenerateQRRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "QR Code 重新生成成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(SeatsSchemas.QRCodeResult),
            message: z.string(),
          }),
        },
      },
    },
    ...errorResponses(400, 401, 403),
  },
});

// Update Seat
export const updateSeatRoute = createRoute({
  method: "put",
  path: "/api/v1/seats/:id",
  tags: ["seats"],
  summary: "更新座位信息",
  description: "更新座位的名稱、啟用狀態和容量",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().regex(/^\d+$/),
    }),
    body: {
      content: {
        "application/json": {
          schema: SeatsSchemas.UpdateSeatRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "更新成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: SeatsSchemas.Seat,
            message: z.string(),
          }),
        },
      },
    },
    ...errorResponses(400, 401, 403, 404),
  },
});

// Delete Seat
export const deleteSeatRoute = createRoute({
  method: "delete",
  path: "/api/v1/seats/:id",
  tags: ["seats"],
  summary: "刪除座位",
  description: "刪除指定座位",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().regex(/^\d+$/),
    }),
  },
  responses: {
    200: {
      description: "刪除成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    ...errorResponses(401, 403, 404),
  },
});

// Delete All Seats for Table
export const deleteSeatsForTableRoute = createRoute({
  method: "delete",
  path: "/api/v1/seats/table/:tableId",
  tags: ["seats"],
  summary: "刪除桌位的所有座位",
  description: "刪除指定桌位的所有座位（用於 QR 模式切換）",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      tableId: z.string().regex(/^\d+$/),
    }),
  },
  responses: {
    200: {
      description: "刪除成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    ...errorResponses(401, 403),
  },
});

// Occupy Seat
export const occupySeatRoute = createRoute({
  method: "post",
  path: "/api/v1/seats/:id/occupy",
  tags: ["seats"],
  summary: "佔用座位",
  description: "將座位標記為已佔用，可選擇關聯訂單",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().regex(/^\d+$/),
    }),
    body: {
      content: {
        "application/json": {
          schema: SeatsSchemas.OccupySeatRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "座位已佔用",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    ...errorResponses(400, 401, 403, 404),
  },
});

// Release Seat
export const releaseSeatRoute = createRoute({
  method: "post",
  path: "/api/v1/seats/:id/release",
  tags: ["seats"],
  summary: "釋放座位",
  description: "將已佔用的座位釋放為可用狀態",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().regex(/^\d+$/),
    }),
  },
  responses: {
    200: {
      description: "座位已釋放",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    ...errorResponses(401, 403, 404),
  },
});

// Regenerate Seat QR Code
export const regenerateSeatQRRoute = createRoute({
  method: "post",
  path: "/api/v1/seats/:id/regenerate-qr",
  tags: ["seats"],
  summary: "重新生成座位 QR Code",
  description: "為指定座位重新生成 QR Code",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      id: z.string().regex(/^\d+$/),
    }),
  },
  responses: {
    200: {
      description: "QR Code 生成成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.object({
              qrCode: z.string(),
            }),
            message: z.string(),
          }),
        },
      },
    },
    ...errorResponses(401, 403, 404),
  },
});
