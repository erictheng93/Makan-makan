/**
 * Validation Middleware
 * Zod-based validation middleware for request validation
 *
 * NOTE: This file is NOT actively used — shared/middleware/index.ts
 * re-exports from ../../middleware/validation.ts instead.
 * Kept in sync for consistency.
 */

import { Context } from "hono";
import { z } from "zod";
import { badRequest } from "../utils/api-error";

// Format Zod details for ApiError
const formatZodDetails = (error: z.ZodError) =>
  error.errors.map((err) => ({
    field: err.path.join("."),
    message: err.message,
  }));

export const validateBody = (schema: z.ZodSchema) => {
  return async (c: Context, next: () => Promise<void>) => {
    try {
      const body = await c.req.json();
      const validatedData = schema.parse(body);
      c.set("validatedBody", validatedData);
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw badRequest(
          "Validation failed",
          "VALIDATION_ERROR",
          formatZodDetails(error),
        );
      }
      throw badRequest("Invalid request body", "INVALID_JSON");
    }
  };
};

export const validateParams = (schema: z.ZodSchema) => {
  return async (c: Context, next: () => Promise<void>) => {
    try {
      const params = c.req.param();
      const validatedData = schema.parse(params);
      c.set("validatedParams", validatedData);
      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw badRequest(
          "Validation failed",
          "VALIDATION_ERROR",
          formatZodDetails(error),
        );
      }
      throw badRequest("Invalid request parameters", "INVALID_PARAMS");
    }
  };
};

export const validateQuery = (schema: z.ZodSchema) => {
  return async (c: Context, next: () => Promise<void>) => {
    try {
      const query = c.req.query();
      const validatedData = schema.parse(query);
      c.set("validatedQuery", validatedData);
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

// Extended context types for TypeScript
declare module "hono" {
  interface ContextVariableMap {
    validatedBody: unknown;
    validatedParams: unknown;
    validatedQuery: unknown;
  }
}
