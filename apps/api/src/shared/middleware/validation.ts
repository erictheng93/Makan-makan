/**
 * Validation Middleware
 * Zod-based validation middleware for request validation
 */

import { Context } from "hono";
import { z } from "zod";

export const validateBody = (schema: z.ZodSchema) => {
  return async (c: Context, next: () => Promise<void>) => {
    try {
      const body = await c.req.json();
      const validatedData = schema.parse(body);

      // Store validated data in context
      c.set("validatedBody", validatedData);

      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            success: false,
            error: "Validation failed",
            details: error.errors.map((err) => ({
              field: err.path.join("."),
              message: err.message,
            })),
          },
          400,
        );
      }

      return c.json(
        {
          success: false,
          error: "Invalid request body",
        },
        400,
      );
    }
  };
};

export const validateParams = (schema: z.ZodSchema) => {
  return async (c: Context, next: () => Promise<void>) => {
    try {
      const params = c.req.param();
      const validatedData = schema.parse(params);

      // Store validated data in context
      c.set("validatedParams", validatedData);

      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            success: false,
            error: "Invalid parameters",
            details: error.errors.map((err) => ({
              field: err.path.join("."),
              message: err.message,
            })),
          },
          400,
        );
      }

      return c.json(
        {
          success: false,
          error: "Invalid request parameters",
        },
        400,
      );
    }
  };
};

export const validateQuery = (schema: z.ZodSchema) => {
  return async (c: Context, next: () => Promise<void>) => {
    try {
      const query = c.req.query();
      const validatedData = schema.parse(query);

      // Store validated data in context
      c.set("validatedQuery", validatedData);

      await next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            success: false,
            error: "Invalid query parameters",
            details: error.errors.map((err) => ({
              field: err.path.join("."),
              message: err.message,
            })),
          },
          400,
        );
      }

      return c.json(
        {
          success: false,
          error: "Invalid query parameters",
        },
        400,
      );
    }
  };
};

// Extended context types for TypeScript
declare module "hono" {
  interface ContextVariableMap {
    validatedBody: any;
    validatedParams: any;
    validatedQuery: any;
  }
}
