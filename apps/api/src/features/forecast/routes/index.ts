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
      });
    }

    const forecasts = await service.generateForecast(restaurantId, body);

    return c.json({
      success: true,
      data: { forecasts },
    });
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
    const { restaurantId } = c.get("validatedParams");
    const { startDate, endDate } = c.get("validatedQuery");
    const service = new ForecastService(c.env.DB, c.env.CACHE_KV);

    const accuracy = await service.getAccuracy(
      restaurantId,
      startDate,
      endDate,
    );

    return c.json({ success: true, data: { accuracy } });
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
  },
);

// GET /api/v1/forecast/:restaurantId/alerts
routes.get(
  "/:restaurantId/alerts",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(restaurantIdParamSchema),
  async (c) => {
    const { restaurantId } = c.get("validatedParams");
    const service = new ForecastService(c.env.DB, c.env.CACHE_KV);

    const alerts = await service.getAlerts(restaurantId);

    return c.json({ success: true, data: { alerts } });
  },
);

export default routes;
