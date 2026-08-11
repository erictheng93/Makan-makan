/**
 * Menu Feature Module
 * Complete menu management functionality including items, categories, and analytics
 */

import { Hono } from "hono";
import type { Env, FeatureModule } from "../../shared/types";
import { ConsoleLogger } from "../../core/monitoring";

// Import feature routes
import routes from "./routes";

// Import types for health check
// Note: Types available for future use when analytics are implemented

// Feature metadata
const FEATURE_NAME = "menu";
const FEATURE_VERSION = "1.0.0";

// Feature module implementation
class MenuModule implements FeatureModule {
  public readonly name = FEATURE_NAME;
  public readonly version = FEATURE_VERSION;
  public readonly routes: Hono<{ Bindings: Env }>;
  private logger: ConsoleLogger;

  constructor() {
    this.logger = new ConsoleLogger(FEATURE_NAME);
    this.routes = new Hono<{ Bindings: Env }>();
    this.setupRoutes();
    this.setupMiddleware();
    this.logger.info(`${FEATURE_NAME} module initialized`, {
      version: FEATURE_VERSION,
    });
  }

  private setupRoutes() {
    // Mount feature routes
    this.routes.route("/", routes);
  }

  private setupMiddleware() {
    // Feature-specific middleware for performance monitoring
    this.routes.use("*", async (c, next) => {
      const start = Date.now();
      const method = c.req.method;
      const path = c.req.path;

      this.logger.debug(`${method} ${path} - starting`);

      try {
        await next();
        const duration = Date.now() - start;
        const status = c.res.status;

        // Log slow requests (> 1 second)
        if (duration > 1000) {
          this.logger.warn(`Slow request detected`, {
            method,
            path,
            duration,
            status,
          });
        } else {
          this.logger.debug(`${method} ${path} - completed`, {
            duration,
            status,
          });
        }
      } catch (error) {
        const duration = Date.now() - start;
        this.logger.error(
          `${method} ${path} - error`,
          error instanceof Error ? error : undefined,
          {
            duration,
            method,
            path,
          },
        );
        throw error;
      }
    });

    // Cache headers for public endpoints
    this.routes.use("/*/featured", async (c, next) => {
      await next();
      if (c.res.status === 200) {
        c.res.headers.set("Cache-Control", "public, max-age=300"); // 5 minutes
      }
    });

    this.routes.use("/*/popular", async (c, next) => {
      await next();
      if (c.res.status === 200) {
        c.res.headers.set("Cache-Control", "public, max-age=600"); // 10 minutes
      }
    });

    // Public menu cache headers
    this.routes.use("/:restaurantId", async (c, next) => {
      await next();
      if (c.res.status === 200) {
        c.res.headers.set("Cache-Control", "public, max-age=1800"); // 30 minutes
      }
    });
  }

  // Health check endpoint with feature-specific status
  getHealthStatus() {
    return {
      name: this.name,
      version: this.version,
      status: "healthy",
      timestamp: new Date().toISOString(),
      features: {
        menuManagement: true,
        categoryManagement: true,
        searchAndFiltering: true,
        bulkOperations: true,
        analytics: true,
        popularityTracking: true,
        caching: true,
        imageSupport: true,
        dietaryInfo: true,
        customization: true,
        inventoryTracking: true,
        priceManagement: true,
        spiceLevelSupport: true,
        availabilityScheduling: true,
        performanceMonitoring: true,
      },
      endpoints: {
        public: [
          "GET /:restaurantId - Complete menu",
          "GET /:restaurantId/featured - Featured items",
          "GET /:restaurantId/popular - Popular items",
          "GET /:restaurantId/search - Search menu items",
          "GET /items/:id - Menu item details",
        ],
        protected: [
          "GET /:restaurantId/option-groups - List option groups",
          "POST /:restaurantId/option-groups - Create option group",
          "PUT /option-groups/:groupId - Update option group",
          "DELETE /option-groups/:groupId - Delete option group",
          "POST /option-groups/:groupId/choices - Create option choice",
          "PATCH /option-choices/:choiceId - Update option choice",
          "DELETE /option-choices/:choiceId - Delete option choice",
          "PUT /items/:id/option-groups - Replace item option groups",
          "POST /:restaurantId/items - Create menu item",
          "PUT /items/:id - Update menu item",
          "DELETE /items/:id - Delete menu item",
          "PATCH /:restaurantId/items/availability - Batch update availability",
          "PATCH /:restaurantId/items/prices - Batch update prices",
          "PATCH /:restaurantId/items/categories - Batch move categories",
          "POST /:restaurantId/categories - Create category",
          "PUT /categories/:id - Update category",
          "DELETE /categories/:id - Delete category",
          "GET /:restaurantId/analytics - Menu analytics",
          "GET /:restaurantId/popularity - Popularity metrics",
        ],
      },
      supportedFeatures: {
        menuItems: {
          creation: true,
          update: true,
          deletion: true,
          bulkOperations: true,
          imageSupport: true,
          customization: true,
          dietaryInfo: true,
          allergenTracking: true,
          spiceLevels: true,
          availabilityScheduling: true,
          inventoryManagement: true,
          priceManagement: true,
          tagging: true,
          seoOptimization: true,
        },
        categories: {
          creation: true,
          update: true,
          deletion: true,
          sorting: true,
          visibility: true,
          itemCounting: true,
        },
        search: {
          textSearch: true,
          categoryFilter: true,
          priceRangeFilter: true,
          spiceLevelFilter: true,
          dietaryPreferences: true,
          availabilityFilter: true,
          featuredFilter: true,
          pagination: true,
        },
        analytics: {
          basicStats: true,
          categoryDistribution: true,
          topPerforming: true,
          dietaryStats: true,
          spiceLevelDistribution: true,
          popularityMetrics: true,
          priceAnalysis: true,
        },
        caching: {
          menuCaching: true,
          searchCaching: false, // Dynamic content
          analyticsCaching: false, // Real-time data
          cacheInvalidation: true,
        },
      },
      performance: {
        cacheHitRatio: "varies", // Depends on usage patterns
        averageResponseTime: "< 200ms for cached, < 500ms for database",
        supportedLoad: "High (with proper caching)",
        scalability: "Horizontal via Cloudflare Workers",
      },
      dependencies: {
        database: "@makanmasak/database - MenuService",
        cache: "Cloudflare KV (optional)",
        monitoring: "ConsoleLogger",
        validation: "Zod schemas",
        authentication: "Shared middleware",
      },
    };
  }

  // Get feature statistics (for monitoring and debugging)
  getStatistics() {
    return {
      name: this.name,
      version: this.version,
      uptime: process.uptime ? `${Math.floor(process.uptime())}s` : "unknown",
      routes: {
        total: 24,
        public: 5,
        protected: 19,
      },
      supportedOperations: {
        crud: ["create", "read", "update", "delete"],
        bulk: ["availability", "prices", "categories"],
        analytics: ["basic", "popularity", "performance"],
        search: ["text", "filters", "pagination"],
      },
    };
  }

  // Feature-specific configuration
  getConfiguration() {
    return {
      name: this.name,
      version: this.version,
      settings: {
        caching: {
          menuTtl: 1800, // 30 minutes
          featuredTtl: 300, // 5 minutes
          popularTtl: 600, // 10 minutes
          analyticsTtl: 0, // No caching for analytics
        },
        limits: {
          maxBulkOperations: 100,
          maxSearchResults: 100,
          maxAnalyticsTimeRange: "1 year",
        },
        validation: {
          maxNameLength: 100,
          maxDescriptionLength: 500,
          maxIngredientsLength: 200,
          maxSpiceLevel: 5,
          maxPreparationTime: 180, // 3 hours
          supportedImageFormats: ["jpg", "jpeg", "png", "webp"],
        },
        features: {
          enableInventoryTracking: true,
          enableAvailabilityScheduling: true,
          enableCustomizations: true,
          enableBulkOperations: true,
          enableAnalytics: true,
          enableCaching: true,
          enableImageSupport: true,
          enableDietaryInfo: true,
          enableAllergenTracking: true,
        },
      },
    };
  }

  // Cleanup method for graceful shutdown
  async cleanup() {
    this.logger.info(`${FEATURE_NAME} module cleaning up`);
    // Add any cleanup logic here (close connections, flush caches, etc.)
  }
}

// Export the feature module class
export { MenuModule };

// Factory function for lazy initialization
let menuModuleInstance: MenuModule | null = null;
export function createMenuModule(): MenuModule {
  if (!menuModuleInstance) {
    menuModuleInstance = new MenuModule();
  }
  return menuModuleInstance;
}

// Default export — shorthand for `import x from "..."` consumers
export default {
  get routes() {
    return createMenuModule().routes;
  },
  getHealthStatus: () => createMenuModule().getHealthStatus(),
  getStatistics: () => createMenuModule().getStatistics(),
  getConfiguration: () => createMenuModule().getConfiguration(),
  cleanup: () => createMenuModule().cleanup(),
};

// Re-export types for external use
export type {
  MenuItem,
  Category,
  MenuStructure,
  CreateMenuItemData,
  UpdateMenuItemData,
  CreateCategoryData,
  UpdateCategoryData,
  MenuFilters,
  MenuSearchParams,
  MenuSearchResult,
  MenuAnalytics,
  PopularityMetrics,
  BulkAvailabilityUpdate,
  BulkPriceUpdate,
  BulkCategoryMove,
  IMenuService,
} from "./types";

// Re-export service for direct use
export { MenuService } from "./services/MenuService";

// Re-export schemas for external validation
export { menuSchemas } from "./schemas/validation";
