import { Context, Next } from "hono";
import { z } from "zod";
import type { Env } from "../types/env";
import { badRequest } from "../shared/utils/api-error";

// Format Zod errors into details array for ApiError
const formatZodDetails = (error: z.ZodError) =>
  error.errors.map((err) => ({
    field: err.path.join("."),
    message: err.message,
    code: err.code,
  }));

// 請求體驗證中間件
export const validateBody = (schema: z.ZodSchema) => {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    try {
      const body = await c.req.json();
      const validated = schema.parse(body);

      // 將驗證後的資料存儲到 context
      c.set("validatedBody", validated);
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw badRequest(
          "Validation failed",
          "VALIDATION_ERROR",
          formatZodDetails(error),
        );
      }

      throw badRequest("Invalid JSON body", "INVALID_JSON");
    }
  };
};

// 查詢參數驗證中間件
export const validateQuery = <T = unknown>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
) => {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    try {
      const query = c.req.query();
      const validated = schema.parse(query);

      c.set("validatedQuery", validated);
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw badRequest(
          "Validation failed",
          "VALIDATION_ERROR",
          formatZodDetails(error),
        );
      }

      throw badRequest("Invalid query parameters", "INVALID_QUERY");
    }
  };
};

// 路徑參數驗證中間件
export const validateParams = <T = unknown>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
) => {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    try {
      const params = c.req.param();
      const validated = schema.parse(params);

      c.set("validatedParams", validated);
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw badRequest(
          "Validation failed",
          "VALIDATION_ERROR",
          formatZodDetails(error),
        );
      }

      throw badRequest("Invalid path parameters", "INVALID_PARAMS");
    }
  };
};

// 常用的驗證 schemas
export const commonSchemas = {
  // ID 參數
  idParam: z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
  }),

  // 餐廳 ID 參數
  restaurantIdParam: z.object({
    restaurantId: z.string().regex(/^\d+$/).transform(Number),
  }),

  // 分頁查詢
  paginationQuery: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default("1"),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default("20"),
    search: z.string().optional(),
  }),

  // 日期範圍
  dateRangeQuery: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
};

// 擴展 Context 類型以包含驗證後的資料
declare module "hono" {
  interface ContextVariableMap {
    validatedBody: any;
    validatedQuery: any;
    validatedParams: any;
  }
}
