/**
 * Restaurants API OpenAPI Schemas
 * 餐廳管理 API Schema 定義
 */

import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { errorResponses } from "../config";

// Define schemas first to avoid circular reference
const OperatingHours = z.object({
  day: z.number().int().min(0).max(6), // 0 = Sunday, 6 = Saturday
  open: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/), // HH:MM format
  close: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  closed: z.boolean().default(false),
});

const RestaurantSettings = z.object({
  enableQROrdering: z.boolean().default(true),
  enableTableService: z.boolean().default(true),
  enableShopQR: z.boolean().default(false),
  autoAcceptOrders: z.boolean().default(false),
  orderTimeout: z.number().int().min(5).max(120).default(30), // minutes
  enableLoyaltyProgram: z.boolean().default(false),
  taxRate: z.number().min(0).max(1).default(0),
  serviceCharge: z.number().min(0).max(1).default(0),
  currency: z.string().default("TWD"),
  timezone: z.string().default("Asia/Taipei"),
});

/**
 * Restaurants API Schemas
 */
export const RestaurantsSchemas = {
  // Operating Hours
  OperatingHours,

  // Restaurant Settings
  RestaurantSettings,

  // Restaurant
  Restaurant: z.object({
    id: z.string().uuid(),
    name: z.string().min(1),
    description: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.email().optional(),
    logoUrl: z.url().optional(),
    coverImageUrl: z.url().optional(),
    operatingHours: z.array(OperatingHours).optional(),
    settings: RestaurantSettings,
    ownerId: z.string().uuid(),
    isActive: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  }),

  // Create Restaurant Request
  CreateRestaurantRequest: z.object({
    name: z.string().min(1, "Restaurant name is required"),
    description: z.string().optional(),
    address: z.string().optional(),
    phone: z
      .string()
      .regex(/^\+?[\d\s-()]+$/, "Invalid phone format")
      .optional(),
    email: z.email("Invalid email format").optional(),
    operatingHours: z.array(OperatingHours).optional(),
    settings: RestaurantSettings.optional(),
  }),

  // Update Restaurant Request
  UpdateRestaurantRequest: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: z.email().optional(),
    operatingHours: z.array(OperatingHours).optional(),
    settings: RestaurantSettings.optional(),
    isActive: z.boolean().optional(),
  }),

  // Restaurant Statistics
  RestaurantStatistics: z.object({
    restaurantId: z.string().uuid(),
    totalOrders: z.number().int().min(0),
    totalRevenue: z.number().min(0),
    averageOrderValue: z.number().min(0),
    totalCustomers: z.number().int().min(0),
    popularItems: z.array(
      z.object({
        itemId: z.string().uuid(),
        itemName: z.string(),
        orderCount: z.number().int(),
        revenue: z.number(),
      }),
    ),
    peakHours: z.array(
      z.object({
        hour: z.number().int().min(0).max(23),
        orderCount: z.number().int(),
      }),
    ),
    period: z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
    }),
  }),

  // Shop QR Code
  ShopQRCode: z.object({
    id: z.string().uuid(),
    restaurantId: z.string().uuid(),
    qrCodeUrl: z.url(),
    shortUrl: z.url().optional(),
    isActive: z.boolean(),
    expiresAt: z.string().datetime().optional(),
    createdAt: z.string().datetime(),
  }),

  // Generate Shop QR Request
  GenerateShopQRRequest: z.object({
    template: z.enum(["basic", "branded", "custom"]).default("basic"),
    size: z.number().int().min(100).max(1000).default(512),
    expiresIn: z.number().int().min(0).optional(), // seconds, 0 = never expires
  }),
};

/**
 * Restaurants API Routes
 */

// Get Restaurants
export const getRestaurantsRoute = createRoute({
  method: "get",
  path: "/api/v1/restaurants",
  tags: ["restaurants"],
  summary: "獲取餐廳列表",
  description: "獲取當前用戶有權限訪問的所有餐廳",
  security: [{ bearerAuth: [] }],
  request: {
    query: z.object({
      isActive: z
        .string()
        .transform((val) => val === "true")
        .optional(),
      search: z.string().optional(),
      page: z.string().regex(/^\d+$/).transform(Number).prefault("1"),
      pageSize: z.string().regex(/^\d+$/).transform(Number).prefault("20"),
    }),
  },
  responses: {
    200: {
      description: "成功獲取餐廳列表",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(RestaurantsSchemas.Restaurant),
            meta: z.object({
              total: z.number(),
              page: z.number(),
              pageSize: z.number(),
              totalPages: z.number(),
            }),
          }),
        },
      },
    },
    ...errorResponses(401),
  },
});

// Get Restaurant by ID
export const getRestaurantRoute = createRoute({
  method: "get",
  path: "/api/v1/restaurants/:restaurantId",
  tags: ["restaurants"],
  summary: "獲取餐廳詳情",
  description: "獲取指定餐廳的詳細信息",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: "成功獲取餐廳詳情",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: RestaurantsSchemas.Restaurant,
          }),
        },
      },
    },
    ...errorResponses(401, 403, 404),
  },
});

// Create Restaurant
export const createRestaurantRoute = createRoute({
  method: "post",
  path: "/api/v1/restaurants",
  tags: ["restaurants"],
  summary: "創建新餐廳",
  description: "創建新的餐廳（需要 Admin 權限）",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: RestaurantsSchemas.CreateRestaurantRequest,
        },
      },
    },
  },
  responses: {
    201: {
      description: "餐廳創建成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: RestaurantsSchemas.Restaurant,
          }),
        },
      },
    },
    ...errorResponses(400, 401, 403),
  },
});

// Update Restaurant
export const updateRestaurantRoute = createRoute({
  method: "put",
  path: "/api/v1/restaurants/:restaurantId",
  tags: ["restaurants"],
  summary: "更新餐廳信息",
  description: "更新餐廳的基本信息和設置",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.string().uuid(),
    }),
    body: {
      content: {
        "application/json": {
          schema: RestaurantsSchemas.UpdateRestaurantRequest,
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
            data: RestaurantsSchemas.Restaurant,
          }),
        },
      },
    },
    ...errorResponses(400),
    ...errorResponses(401, 403, 404),
  },
});

// Get Restaurant Statistics
export const getRestaurantStatsRoute = createRoute({
  method: "get",
  path: "/api/v1/restaurants/:restaurantId/statistics",
  tags: ["restaurants"],
  summary: "獲取餐廳統計數據",
  description: "獲取餐廳的業務統計和分析數據",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.string().uuid(),
    }),
    query: z.object({
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
      includePopularItems: z
        .string()
        .transform((val) => val === "true")
        .prefault("true"),
      includePeakHours: z
        .string()
        .transform((val) => val === "true")
        .prefault("true"),
    }),
  },
  responses: {
    200: {
      description: "成功獲取統計數據",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: RestaurantsSchemas.RestaurantStatistics,
          }),
        },
      },
    },
    ...errorResponses(401, 403, 404),
  },
});

// Generate Shop QR Code
export const generateShopQRRoute = createRoute({
  method: "post",
  path: "/api/v1/restaurants/:restaurantId/qr/shop/generate",
  tags: ["restaurants"],
  summary: "生成 Shop QR Code",
  description: "為餐廳生成全店通用的 QR Code（無桌號模式）",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.string().uuid(),
    }),
    body: {
      content: {
        "application/json": {
          schema: RestaurantsSchemas.GenerateShopQRRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Shop QR Code 生成成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: RestaurantsSchemas.ShopQRCode,
          }),
        },
      },
    },
    ...errorResponses(400),
    ...errorResponses(401, 403, 404),
  },
});

// Get Shop QR Code
export const getShopQRRoute = createRoute({
  method: "get",
  path: "/api/v1/restaurants/:restaurantId/qr/shop",
  tags: ["restaurants"],
  summary: "獲取 Shop QR Code",
  description: "獲取餐廳的 Shop QR Code",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: "成功獲取 Shop QR Code",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: RestaurantsSchemas.ShopQRCode,
          }),
        },
      },
    },
    ...errorResponses(401, 403, 404),
  },
});

// Update Restaurant Settings
export const updateRestaurantSettingsRoute = createRoute({
  method: "patch",
  path: "/api/v1/restaurants/:restaurantId/settings",
  tags: ["restaurants"],
  summary: "更新餐廳設置",
  description: "更新餐廳的運營設置",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.string().uuid(),
    }),
    body: {
      content: {
        "application/json": {
          schema: RestaurantsSchemas.RestaurantSettings.partial(),
        },
      },
    },
  },
  responses: {
    200: {
      description: "設置更新成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: RestaurantsSchemas.RestaurantSettings,
          }),
        },
      },
    },
    ...errorResponses(400),
    ...errorResponses(401, 403, 404),
  },
});
