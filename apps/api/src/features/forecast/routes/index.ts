import { Hono } from "hono";
import { authMiddleware, requireRole } from "../../../middleware/auth";
import {
  validateBody,
  validateQuery,
  validateParams,
} from "../../../middleware/validation";
import { ForecastService } from "../services/ForecastService";
import { IngredientForecastService } from "../services/IngredientForecastService";
import {
  generateForecastSchema,
  getForecastQuerySchema,
  accuracyQuerySchema,
  ingredientForecastQuerySchema,
  restaurantIdParamSchema,
} from "../schemas/validation";
import type { Env } from "../../../shared/types";

const routes = new Hono<{ Bindings: Env }>();

// POST /api/v1/forecast/:restaurantId/generate
routes.post(
  "/:restaurantId/generate",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(restaurantIdParamSchema),
  validateBody(generateForecastSchema),
  async (c) => {
    try {
      const { restaurantId } = c.get("validatedParams");
      const body = c.get("validatedBody");
      const service = new ForecastService(c.env.DB, c.env.CACHE_KV);

      // Delegate to IngredientForecastService when type is ingredient_level
      if (body.type === "ingredient_level") {
        const ingredientService = new IngredientForecastService(
          c.env.DB,
          c.env.CACHE_KV,
          service,
          c.env.ENCRYPTION_KEY,
        );
        const forecasts = await ingredientService.generateIngredientForecast(
          restaurantId,
          body,
        );
        return c.json({
          success: true,
          data: { forecasts },
          timestamp: new Date().toISOString(),
        });
      }

      const forecasts = await service.generateForecast(restaurantId, body);

      return c.json({
        success: true,
        data: { forecasts },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Generate forecast error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "FORECAST_GENERATE_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to generate forecast",
          },
        },
        500,
      );
    }
  },
);

// GET /api/v1/forecast/:restaurantId
routes.get(
  "/:restaurantId",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(restaurantIdParamSchema),
  validateQuery(getForecastQuerySchema),
  async (c) => {
    try {
      const { restaurantId } = c.get("validatedParams");
      const query = c.get("validatedQuery");
      const service = new ForecastService(c.env.DB, c.env.CACHE_KV);

      const startDate = query.date || query.startDate!;
      const endDate = query.date || query.endDate!;

      const forecasts = await service.getForecast(
        restaurantId,
        startDate,
        endDate,
        query.type,
      );

      return c.json({ success: true, data: { forecasts } });
    } catch (error) {
      console.error("Get forecast error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "FORECAST_GET_FAILED",
            message:
              error instanceof Error ? error.message : "Failed to get forecast",
          },
        },
        500,
      );
    }
  },
);

// GET /api/v1/forecast/:restaurantId/accuracy
routes.get(
  "/:restaurantId/accuracy",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(restaurantIdParamSchema),
  validateQuery(accuracyQuerySchema),
  async (c) => {
    try {
      const { restaurantId } = c.get("validatedParams");
      const { startDate, endDate } = c.get("validatedQuery");
      const service = new ForecastService(c.env.DB, c.env.CACHE_KV);

      const accuracy = await service.getAccuracy(
        restaurantId,
        startDate,
        endDate,
      );

      return c.json({ success: true, data: { accuracy } });
    } catch (error) {
      console.error("Get accuracy error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "FORECAST_ACCURACY_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to get forecast accuracy",
          },
        },
        500,
      );
    }
  },
);

// GET /api/v1/forecast/:restaurantId/ingredient-forecast
routes.get(
  "/:restaurantId/ingredient-forecast",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(restaurantIdParamSchema),
  validateQuery(ingredientForecastQuerySchema),
  async (c) => {
    try {
      const { restaurantId } = c.get("validatedParams");
      const { startDate, endDate } = c.get("validatedQuery");
      const forecastService = new ForecastService(c.env.DB, c.env.CACHE_KV);
      const service = new IngredientForecastService(
        c.env.DB,
        c.env.CACHE_KV,
        forecastService,
        c.env.ENCRYPTION_KEY,
      );

      const forecasts = await service.getIngredientForecast(
        restaurantId,
        startDate,
        endDate,
      );

      return c.json({ success: true, data: { forecasts } });
    } catch (error) {
      console.error("Get ingredient forecast error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "INGREDIENT_FORECAST_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to get ingredient forecast",
          },
        },
        500,
      );
    }
  },
);

// GET /api/v1/forecast/:restaurantId/alerts
routes.get(
  "/:restaurantId/alerts",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(restaurantIdParamSchema),
  async (c) => {
    try {
      const { restaurantId } = c.get("validatedParams");
      const service = new ForecastService(c.env.DB, c.env.CACHE_KV);

      const alerts = await service.getAlerts(restaurantId);

      return c.json({ success: true, data: { alerts } });
    } catch (error) {
      console.error("Get alerts error:", error);
      return c.json(
        {
          success: false,
          error: {
            code: "FORECAST_ALERTS_FAILED",
            message:
              error instanceof Error
                ? error.message
                : "Failed to get forecast alerts",
          },
        },
        500,
      );
    }
  },
);

export default routes;
