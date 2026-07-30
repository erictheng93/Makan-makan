import { createMiddleware } from "hono/factory";
import { z } from "zod";
import { badRequest } from "../shared/utils/api-error";

const formatZodDetails = (error: z.ZodError) =>
  error.issues.map((err) => ({
    field: err.path.join("."),
    message: err.message,
    code: err.code,
  }));

// Generic validators contribute their inferred output type to the route's
// Variables, so c.get("validatedBody"|"validatedQuery"|"validatedParams")
// returns z.infer<typeof schema> in handlers chained after the middleware.

export const validateBody = <T extends z.ZodTypeAny>(schema: T) =>
  createMiddleware<{ Variables: { validatedBody: z.infer<T> } }>(
    async (c, next) => {
      try {
        const body = await c.req.json();
        const validated = schema.parse(body);
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
    },
  );

export const validateQuery = <T extends z.ZodTypeAny>(schema: T) =>
  createMiddleware<{ Variables: { validatedQuery: z.infer<T> } }>(
    async (c, next) => {
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
    },
  );

export const validateParams = <T extends z.ZodTypeAny>(schema: T) =>
  createMiddleware<{ Variables: { validatedParams: z.infer<T> } }>(
    async (c, next) => {
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
    },
  );

export const commonSchemas = {
  idParam: z.object({
    id: z.string().regex(/^\d+$/).transform(Number),
  }),

  restaurantIdParam: z.object({
    restaurantId: z.string().regex(/^\d+$/).transform(Number),
  }),

  paginationQuery: z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().prefault("1"),
    limit: z
      .string()
      .regex(/^\d+$/)
      .transform(Number)
      .optional()
      .prefault("20"),
    search: z.string().optional(),
  }),

  dateRangeQuery: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  }),
};
