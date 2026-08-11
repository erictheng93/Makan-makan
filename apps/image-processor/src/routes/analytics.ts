import { Hono } from "hono";
import { z } from "zod";
import { ImageService } from "../services/image-service";
import { ImageService as DatabaseImageService } from "@makanmasak/database";
import { authMiddleware, requireRole } from "../middleware/auth";
import {
  validateQuery,
  imageSchemas,
  type ImageAnalyticsQuery,
} from "../middleware/validation";
import type { Env } from "../types/env";

const app = new Hono<{ Bindings: Env }>();

/**
 * Get image analytics dashboard
 * GET /analytics/dashboard
 */
app.get(
  "/dashboard",
  authMiddleware,
  requireRole([0, 1]), // Admin, Owner
  validateQuery(imageSchemas.analyticsQuery),
  async (c) => {
    try {
      const user = c.get("user");
      const query = c.get("validatedQuery") as ImageAnalyticsQuery;
      const imageService = new ImageService(c.env);

      // Apply access control
      const options = { ...query };
      if (user.role !== 0) {
        if (user.restaurantId === undefined) {
          return c.json(
            {
              success: false,
              error: "Restaurant access required",
            },
            403,
          );
        }
        options.restaurantId = user.restaurantId;
      }

      const result = await imageService.getImageAnalytics(options);

      if (!result.success) {
        return c.json(
          {
            success: false,
            error: result.error || "Failed to get analytics",
          },
          500,
        );
      }

      return c.json({
        success: true,
        data: result.analytics,
      });
    } catch (error) {
      console.error("Analytics dashboard error:", error);
      return c.json(
        {
          success: false,
          error: "Failed to get analytics dashboard",
        },
        500,
      );
    }
  },
);

/**
 * Get storage usage analytics
 * GET /analytics/storage
 */
app.get(
  "/storage",
  authMiddleware,
  requireRole([0, 1]), // Admin, Owner
  validateQuery(imageSchemas.analyticsQuery),
  async (c) => {
    try {
      const user = c.get("user");
      const query = c.get("validatedQuery") as ImageAnalyticsQuery;
      const dbImageService = new DatabaseImageService(c.env.DB, c.env);

      // Apply access control
      const options = {
        ...query,
        restaurantId: query.restaurantId?.toString(),
      };
      if (user.role !== 0) {
        if (user.restaurantId === undefined) {
          return c.json(
            {
              success: false,
              error: "Restaurant access required",
            },
            403,
          );
        }
        options.restaurantId = user.restaurantId.toString();
      }

      const data = await dbImageService.getStorageAnalytics(options);

      return c.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error("Storage analytics error:", error);
      return c.json(
        {
          success: false,
          error: "Failed to get storage analytics",
        },
        500,
      );
    }
  },
);

/**
 * Get image usage analytics
 * GET /analytics/usage
 */
app.get(
  "/usage",
  authMiddleware,
  requireRole([0, 1]), // Admin, Owner
  validateQuery(imageSchemas.analyticsQuery),
  async (c) => {
    try {
      const user = c.get("user");
      const query = c.get("validatedQuery") as ImageAnalyticsQuery;
      const dbImageService = new DatabaseImageService(c.env.DB, c.env);

      // Apply access control
      const options = {
        ...query,
        restaurantId: query.restaurantId?.toString(),
      };
      if (user.role !== 0) {
        if (user.restaurantId === undefined) {
          return c.json(
            {
              success: false,
              error: "Restaurant access required",
            },
            403,
          );
        }
        options.restaurantId = user.restaurantId.toString();
      }

      const data = await dbImageService.getUsageAnalytics(options);

      return c.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error("Usage analytics error:", error);
      return c.json(
        {
          success: false,
          error: "Failed to get usage analytics",
        },
        500,
      );
    }
  },
);

/**
 * Get processing performance analytics
 * GET /analytics/performance
 */
app.get(
  "/performance",
  authMiddleware,
  requireRole([0, 1]), // Admin, Owner
  validateQuery(imageSchemas.analyticsQuery),
  async (c) => {
    try {
      const user = c.get("user");
      const query = c.get("validatedQuery") as ImageAnalyticsQuery;
      const dbImageService = new DatabaseImageService(c.env.DB, c.env);

      // Apply access control
      const options = {
        ...query,
        restaurantId: query.restaurantId?.toString(),
      };
      if (user.role !== 0) {
        if (user.restaurantId === undefined) {
          return c.json(
            {
              success: false,
              error: "Restaurant access required",
            },
            403,
          );
        }
        options.restaurantId = user.restaurantId.toString();
      }

      const data = await dbImageService.getPerformanceAnalytics(options);

      return c.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error("Performance analytics error:", error);
      return c.json(
        {
          success: false,
          error: "Failed to get performance analytics",
        },
        500,
      );
    }
  },
);

/**
 * Export analytics data
 * GET /analytics/export
 */
app.get(
  "/export",
  authMiddleware,
  requireRole([0, 1]), // Admin, Owner
  validateQuery(
    imageSchemas.analyticsQuery.extend({
      type: z
        .enum(["summary", "storage", "usage", "performance"])
        .default("summary"),
      format: z.enum(["json", "csv"]).default("json"),
    }),
  ),
  async (c) => {
    // Analytics export is not implemented. Previously this returned a fabricated
    // `download_url` pointing at a domain this worker does not serve, which would
    // 404 for any caller. Respond honestly with 501 until real file generation
    // (e.g. R2-backed export) is built.
    return c.json(
      {
        success: false,
        error:
          "Analytics export is not implemented. This endpoint does not yet generate downloadable files.",
      },
      501,
    );
  },
);

export default app;
