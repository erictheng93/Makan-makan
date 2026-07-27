import { Hono } from "hono";
import type { Context, Next } from "hono";
import { authMiddleware, requireRole } from "../../../middleware/auth";
import { moduleGate } from "../../../middleware/moduleGate";
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

/**
 * This feature spans two modules, so it is gated per route rather than with a
 * blanket gate in app-factory.
 *
 * Demand forecasting, accuracy and alerts are reporting — `analytics` (pro).
 * Ingredient forecasting and the procurement list read ingredient records and
 * sit alongside `/ingredients/*`, which is gated `inventory` (enterprise).
 * Gating the whole feature as `analytics` let a pro shop start an ingredient
 * forecast it could never finish: the procurement list calls `/ingredients`
 * and got a 403 there instead.
 */
type GenerateGateContext = Context<{
  Bindings: Env;
  Variables: { validatedBody?: { type?: string } };
}>;

const generateGate = async (c: GenerateGateContext, next: Next) => {
  const body = c.get("validatedBody");
  const module = body?.type === "ingredient_level" ? "inventory" : "analytics";
  return moduleGate(module)(c as never, next);
};

// POST /api/v1/forecast/:restaurantId/generate
routes.post(
  "/:restaurantId/generate",
  authMiddleware,
  requireRole([0, 1]),
  validateParams(restaurantIdParamSchema),
  validateBody(generateForecastSchema),
  // Must run after validateBody so the gate can read the requested type.
  generateGate,
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
  moduleGate("analytics"),
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
  moduleGate("analytics"),
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
  moduleGate("inventory"),
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
  moduleGate("analytics"),
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
