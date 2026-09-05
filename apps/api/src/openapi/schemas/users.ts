/**
 * Users API OpenAPI Schemas
 * 用戶管理 API Schema 定義
 */

import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { errorResponses } from "../config";

// Define schemas first to avoid circular reference
const UserRole = z
  .enum(["admin", "shop_owner", "chef", "service_crew", "cashier"])
  .describe("0: Admin, 1: Shop Owner, 2: Chef, 3: Service Crew, 4: Cashier");
const User = z.object({
  id: z.uuid(),
  email: z.email(),
  name: z.string(),
  role: z.number().int().min(0).max(4),
  restaurantId: z.uuid().optional(),
  phone: z.string().optional(),
  avatar: z.url().optional(),
  isActive: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

/**
 * Users API Schemas
 */
export const UsersSchemas = {
  // User Role Enum
  UserRole,

  // User
  User,

  // Get Users Request
  GetUsersRequest: z.object({
    restaurantId: z.uuid(),
    role: z.number().int().min(0).max(4).optional(),
    isActive: z.boolean().optional(),
    search: z.string().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).prefault("1"),
    pageSize: z.string().regex(/^\d+$/).transform(Number).prefault("20"),
  }),

  // Get Users Response
  GetUsersResponse: z.object({
    success: z.boolean(),
    data: z.array(User),
    meta: z.object({
      total: z.number(),
      page: z.number(),
      pageSize: z.number(),
      totalPages: z.number(),
    }),
  }),

  // Create User Request
  CreateUserRequest: z.object({
    email: z.email("Invalid email format"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    name: z.string().min(1, "Name is required"),
    role: z.number().int().min(0).max(4),
    restaurantId: z.uuid().optional(),
    phone: z.string().optional(),
  }),

  // Update User Request
  UpdateUserRequest: z.object({
    name: z.string().min(1).optional(),
    role: z.number().int().min(0).max(4).optional(),
    phone: z.string().optional(),
    avatar: z.url().optional(),
    isActive: z.boolean().optional(),
  }),

  // Change Password Request
  ChangePasswordRequest: z.object({
    currentPassword: z.string().min(8),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters"),
  }),
};

/**
 * Users API Routes
 */

// Get Users
export const getUsersRoute = createRoute({
  method: "get",
  path: "/api/v1/users/:restaurantId",
  tags: ["users"],
  summary: "獲取用戶列表",
  description: "獲取指定餐廳的所有員工用戶，支持按角色、狀態過濾和搜索",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      restaurantId: z.uuid(),
    }),
    query: z.object({
      role: z
        .string()
        .regex(/^[0-4]$/)
        .transform(Number)
        .optional(),
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
      description: "成功獲取用戶列表",
      content: {
        "application/json": {
          schema: UsersSchemas.GetUsersResponse,
        },
      },
    },
    ...errorResponses(401, 403),
  },
});

// Create User
export const createUserRoute = createRoute({
  method: "post",
  path: "/api/v1/users",
  tags: ["users"],
  summary: "創建新用戶",
  description: "創建新的員工用戶帳號",
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: UsersSchemas.CreateUserRequest,
        },
      },
    },
  },
  responses: {
    201: {
      description: "用戶創建成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: UsersSchemas.User,
          }),
        },
      },
    },
    ...errorResponses(400, 401, 403),
  },
});

// Update User
export const updateUserRoute = createRoute({
  method: "put",
  path: "/api/v1/users/:userId",
  tags: ["users"],
  summary: "更新用戶信息",
  description: "更新指定用戶的個人信息和角色",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      userId: z.uuid(),
    }),
    body: {
      content: {
        "application/json": {
          schema: UsersSchemas.UpdateUserRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "用戶信息更新成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: UsersSchemas.User,
          }),
        },
      },
    },
    ...errorResponses(400),
    ...errorResponses(401, 403, 404),
  },
});

// Change Password
export const changePasswordRoute = createRoute({
  method: "post",
  path: "/api/v1/users/:userId/password",
  tags: ["users"],
  summary: "修改用戶密碼",
  description: "修改指定用戶的登入密碼",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      userId: z.uuid(),
    }),
    body: {
      content: {
        "application/json": {
          schema: UsersSchemas.ChangePasswordRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "密碼修改成功",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
        },
      },
    },
    ...errorResponses(400, 401, 403),
  },
});

// Delete User
export const deleteUserRoute = createRoute({
  method: "delete",
  path: "/api/v1/users/:userId",
  tags: ["users"],
  summary: "移除員工",
  description:
    "將員工移出在職名單（封存）。不是刪除資料列 —— 過往排班與報表仍需解析姓名，" +
    "且稽核與金流表的外鍵不允許刪除。可用 restore 復原。",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      userId: z.uuid(),
    }),
  },
  responses: {
    200: {
      description: "用戶刪除成功",
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

export const restoreUserRoute = createRoute({
  method: "post",
  path: "/api/v1/users/:userId/restore",
  tags: ["users"],
  summary: "復原已離職員工",
  description: "將已封存的員工放回在職名單，使其可重新登入。",
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      userId: z.uuid(),
    }),
  },
  responses: {
    200: {
      description: "員工復原成功",
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
