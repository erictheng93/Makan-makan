/**
 * Customers API OpenAPI Schemas
 * 客戶管理 API Schema 定義
 */

import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { errorResponses } from "../config";

// Define Customer schema first to avoid circular reference
const Customer = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  preferences: z
    .object({
      dietary: z.array(z.string()).optional(),
      allergies: z.array(z.string()).optional(),
      favoriteItems: z.array(z.string().uuid()).optional(),
    })
    .optional(),
  loyaltyPoints: z.number().int().min(0).default(0),
  totalOrders: z.number().int().min(0).default(0),
  totalSpent: z.number().min(0).default(0),
  lastVisit: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/**
 * Customers API Schemas
 */
export const CustomersSchemas = {
  // Customer
  Customer,

  // Customer Registration Request (Shop QR Mode)
  CustomerRegistrationRequest: z.object({
    name: z.string().min(1, "Name is required"),
    phone: z
      .string()
      .regex(/^\+?[\d\s-()]+$/, "Invalid phone format")
      .optional(),
    email: z.string().email("Invalid email format").optional(),
    preferences: z
      .object({
        dietary: z.array(z.string()).optional(),
        allergies: z.array(z.string()).optional(),
      })
      .optional(),
  }),

  // Get Customers Request
  GetCustomersRequest: z.object({
    restaurantId: z.string().uuid(),
    search: z.string().optional(),
    orderBy: z
      .enum(["name", "totalSpent", "totalOrders", "lastVisit"])
      .optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
    page: z.string().regex(/^\d+$/).transform(Number).default("1"),
    pageSize: z.string().regex(/^\d+$/).transform(Number).default("20"),
  }),

  // Get Customers Response
  GetCustomersResponse: z.object({
    success: z.boolean(),
    data: z.array(Customer),
    meta: z.object({
      total: z.number(),
      page: z.number(),
      pageSize: z.number(),
      totalPages: z.number(),
    }),
  }),

  // Update Customer Request
  UpdateCustomerRequest: z.object({
    name: z.string().min(1).optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    preferences: z
      .object({
        dietary: z.array(z.string()).optional(),
        allergies: z.array(z.string()).optional(),
        favoriteItems: z.array(z.string().uuid()).optional(),
      })
      .optional(),
  }),

  // Customer Order History Request
  GetCustomerOrdersRequest: z.object({
    customerId: z.string().uuid(),
    status: z
      .enum(["pending", "preparing", "ready", "completed", "cancelled"])
      .optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).default("1"),
    pageSize: z.string().regex(/^\d+$/).transform(Number).default("10"),
  }),

  // Loyalty Points Transaction
  LoyaltyPointsTransaction: z.object({
    id: z.string().uuid(),
    customerId: z.string().uuid(),
    points: z.number().int(),
    type: z.enum(["earn", "redeem", "expire", "adjust"]),
    reason: z.string(),
    orderId: z.string().uuid().optional(),
    createdAt: z.string().datetime(),
  }),

  // Add Loyalty Points Request
  AddLoyaltyPointsRequest: z.object({
    points: z.number().int().positive("Points must be positive"),
    reason: z.string().min(1, "Reason is required"),
    orderId: z.string().uuid().optional(),
  }),

  // Redeem Loyalty Points Request
  RedeemLoyaltyPointsRequest: z.object({
    points: z.number().int().positive("Points must be positive"),
    orderId: z.string().uuid().optional(),
  }),
};

/**
 * Customers API Routes
 */

// Register Customer (Shop QR Mode)
export const registerCustomerRoute = createRoute({
  method: "post",
  path: "/api/v1/customers/register",
  tags: ["customers"],
  summary: "客戶註冊",
  description: "在 Shop QR 模式下註冊新客戶（無需認證）",
  request: {
    body: {
      content: {
        "application/json": {
          schema: CustomersSchemas.CustomerRegistrationRequest,
        },
      },
    },
  },
  responses: {
    201: {
      description: "註冊成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: CustomersSchemas.Customer,
            token: z.string().optional(),
          }),
        },
      },
    },
    ...errorResponses(400),
  },
});

// Get Customers
export const getCustomersRoute = createRoute({
  method: "get",
  path: "/api/v1/customers/:restaurantId",
  tags: ["customers"],
  summary: "獲取客戶列表",
  description: "獲取餐廳的所有客戶，支持搜索和排序",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.string().uuid(),
    }),
    query: z.object({
      search: z.string().optional(),
      orderBy: z
        .enum(["name", "totalSpent", "totalOrders", "lastVisit"])
        .optional(),
      sortOrder: z.enum(["asc", "desc"]).default("desc"),
      page: z.string().regex(/^\d+$/).transform(Number).default("1"),
      pageSize: z.string().regex(/^\d+$/).transform(Number).default("20"),
    }),
  },
  responses: {
    200: {
      description: "成功獲取客戶列表",
      content: {
        "application/json": {
          schema: CustomersSchemas.GetCustomersResponse,
        },
      },
    },
    ...errorResponses(401, 403),
  },
});

// Get Customer by ID
export const getCustomerRoute = createRoute({
  method: "get",
  path: "/api/v1/customers/detail/:customerId",
  tags: ["customers"],
  summary: "獲取客戶詳情",
  description: "獲取指定客戶的詳細信息",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      customerId: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: "成功獲取客戶詳情",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: CustomersSchemas.Customer,
          }),
        },
      },
    },
    ...errorResponses(401, 404),
  },
});

// Update Customer
export const updateCustomerRoute = createRoute({
  method: "put",
  path: "/api/v1/customers/:customerId",
  tags: ["customers"],
  summary: "更新客戶信息",
  description: "更新客戶的個人資料和偏好設置",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      customerId: z.string().uuid(),
    }),
    body: {
      content: {
        "application/json": {
          schema: CustomersSchemas.UpdateCustomerRequest,
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
            data: CustomersSchemas.Customer,
          }),
        },
      },
    },
    ...errorResponses(400, 401, 404),
  },
});

// Get Customer Order History
export const getCustomerOrdersRoute = createRoute({
  method: "get",
  path: "/api/v1/customers/:customerId/orders",
  tags: ["customers"],
  summary: "獲取客戶訂單歷史",
  description: "獲取客戶的所有訂單記錄",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      customerId: z.string().uuid(),
    }),
    query: z.object({
      status: z
        .enum(["pending", "preparing", "ready", "completed", "cancelled"])
        .optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional(),
      page: z.string().regex(/^\d+$/).transform(Number).default("1"),
      pageSize: z.string().regex(/^\d+$/).transform(Number).default("10"),
    }),
  },
  responses: {
    200: {
      description: "成功獲取訂單歷史",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(z.any()), // Order schema
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
    ...errorResponses(401, 404),
  },
});

// Add Loyalty Points
export const addLoyaltyPointsRoute = createRoute({
  method: "post",
  path: "/api/v1/customers/:customerId/loyalty/add",
  tags: ["customers"],
  summary: "增加忠誠積分",
  description: "為客戶增加忠誠積分",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      customerId: z.string().uuid(),
    }),
    body: {
      content: {
        "application/json": {
          schema: CustomersSchemas.AddLoyaltyPointsRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "積分增加成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: CustomersSchemas.LoyaltyPointsTransaction,
          }),
        },
      },
    },
    ...errorResponses(400, 401, 404),
  },
});

// Redeem Loyalty Points
export const redeemLoyaltyPointsRoute = createRoute({
  method: "post",
  path: "/api/v1/customers/:customerId/loyalty/redeem",
  tags: ["customers"],
  summary: "兌換忠誠積分",
  description: "客戶使用積分進行兌換",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      customerId: z.string().uuid(),
    }),
    body: {
      content: {
        "application/json": {
          schema: CustomersSchemas.RedeemLoyaltyPointsRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "積分兌換成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: CustomersSchemas.LoyaltyPointsTransaction,
          }),
        },
      },
    },
    ...errorResponses(400, 401, 404),
  },
});

// Get Loyalty Points History
export const getLoyaltyPointsHistoryRoute = createRoute({
  method: "get",
  path: "/api/v1/customers/:customerId/loyalty/history",
  tags: ["customers"],
  summary: "獲取積分歷史",
  description: "獲取客戶的積分交易記錄",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      customerId: z.string().uuid(),
    }),
    query: z.object({
      type: z.enum(["earn", "redeem", "expire", "adjust"]).optional(),
      page: z.string().regex(/^\d+$/).transform(Number).default("1"),
      pageSize: z.string().regex(/^\d+$/).transform(Number).default("20"),
    }),
  },
  responses: {
    200: {
      description: "成功獲取積分歷史",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.array(CustomersSchemas.LoyaltyPointsTransaction),
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
    ...errorResponses(401, 404),
  },
});
