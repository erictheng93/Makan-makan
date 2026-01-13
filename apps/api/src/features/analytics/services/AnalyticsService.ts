/**
 * AnalyticsService
 * Business logic for analytics operations within the feature module
 */

import { AnalyticsService as DatabaseAnalyticsService } from "@makanmakan/database";
import { KVCacheService, type CacheService } from "../../../core/cache";
import { ConsoleLogger } from "../../../core/monitoring";
import { CACHE_TTL } from "../../../shared/constants";
import type { Env } from "../../../shared/types";
import type {
  AnalyticsFilters,
  DashboardSummary,
  RevenueData,
  ProductAnalytics,
  CustomerAnalytics,
  PerformanceAnalytics,
  RealtimeAnalyticsData,
  ExportRequest,
  ExportResponse,
  FinancialReportData,
  IAnalyticsService,
} from "../types";

// Helper to convert filters for database service (number -> string for restaurantId)
function toDbFilters(filters: AnalyticsFilters): {
  restaurantId?: string;
  startDate?: string;
  endDate?: string;
} {
  return {
    ...filters,
    restaurantId: filters.restaurantId
      ? String(filters.restaurantId)
      : undefined,
  };
}

export class AnalyticsService implements IAnalyticsService {
  private databaseService: DatabaseAnalyticsService;
  private cache: CacheService;
  private logger: ConsoleLogger;
  private env: Env;

  constructor(db: Env["DB"], env: Env, kv?: Env["CACHE_KV"]) {
    this.databaseService = new DatabaseAnalyticsService(db, env);
    this.cache = kv ? new KVCacheService(kv) : new KVCacheService({} as any);
    this.logger = new ConsoleLogger("AnalyticsService");
    this.env = env;
  }

  /**
   * Get dashboard data with caching
   */
  async getDashboardData(
    restaurantId?: number,
    period: string = "today",
  ): Promise<DashboardSummary> {
    try {
      this.logger.debug("Getting dashboard data", { restaurantId, period });

      // Try cache first
      const cacheKey = `analytics:dashboard:${restaurantId || "all"}:${period}`;
      const cached = await this.cache.get<DashboardSummary>(cacheKey);
      if (cached) {
        this.logger.debug("Returning cached dashboard data");
        return cached;
      }

      // Get data from database service
      const dashboardData = await this.databaseService.getDashboardData(
        restaurantId ? String(restaurantId) : (undefined as any),
      );

      if (!dashboardData) {
        throw new Error("Failed to retrieve dashboard data");
      }

      // Extract summary from dashboard data
      const summary: DashboardSummary = dashboardData.summary;

      // Cache the result
      await this.cache.set(cacheKey, summary, CACHE_TTL.SHORT);

      this.logger.info("Dashboard data retrieved successfully", {
        restaurantId,
        period,
        todayRevenue: summary.todayRevenue,
        todayOrders: summary.todayOrders,
      });

      return summary;
    } catch (error) {
      this.logger.error("Failed to get dashboard data", error as Error, {
        restaurantId,
        period,
      });
      throw new Error("Failed to retrieve dashboard data");
    }
  }

  /**
   * Get revenue analytics with caching
   */
  async getRevenueAnalytics(filters: AnalyticsFilters): Promise<RevenueData[]> {
    try {
      this.logger.debug("Getting revenue analytics", filters);

      // Try cache first
      const cacheKey = `analytics:revenue:${JSON.stringify(filters)}`;
      const cached = await this.cache.get<RevenueData[]>(cacheKey);
      if (cached) {
        this.logger.debug("Returning cached revenue analytics");
        return cached;
      }

      // Get data from database service
      const revenueData = await this.databaseService.getRevenueAnalytics(
        toDbFilters(filters),
      );

      if (!revenueData) {
        return [];
      }

      // Cache the result
      await this.cache.set(cacheKey, revenueData, CACHE_TTL.MEDIUM);

      this.logger.info("Revenue analytics retrieved successfully", {
        restaurantId: filters.restaurantId,
        recordCount: revenueData.length,
      });

      return revenueData;
    } catch (error) {
      this.logger.error(
        "Failed to get revenue analytics",
        error as Error,
        filters,
      );
      throw new Error("Failed to retrieve revenue analytics");
    }
  }

  /**
   * Get product analytics with caching
   */
  async getProductAnalytics(
    filters: AnalyticsFilters,
  ): Promise<ProductAnalytics> {
    try {
      this.logger.debug("Getting product analytics", filters);

      // Try cache first
      const cacheKey = `analytics:products:${JSON.stringify(filters)}`;
      const cached = await this.cache.get<ProductAnalytics>(cacheKey);
      if (cached) {
        this.logger.debug("Returning cached product analytics");
        return cached;
      }

      // Get data from database service
      const productData = await this.databaseService.getMenuAnalytics(
        toDbFilters(filters),
      );

      if (!productData) {
        throw new Error("Failed to retrieve product analytics");
      }

      // Cache the result
      await this.cache.set(cacheKey, productData, CACHE_TTL.MEDIUM);

      this.logger.info("Product analytics retrieved successfully", {
        restaurantId: filters.restaurantId,
        popularItemsCount: productData.popularItems.length,
        categoriesCount: productData.categoryPerformance.length,
      });

      return productData;
    } catch (error) {
      this.logger.error(
        "Failed to get product analytics",
        error as Error,
        filters,
      );
      throw new Error("Failed to retrieve product analytics");
    }
  }

  /**
   * Get customer analytics with caching
   */
  async getCustomerAnalytics(
    filters: AnalyticsFilters,
  ): Promise<CustomerAnalytics> {
    try {
      this.logger.debug("Getting customer analytics", filters);

      // Try cache first
      const cacheKey = `analytics:customers:${JSON.stringify(filters)}`;
      const cached = await this.cache.get<CustomerAnalytics>(cacheKey);
      if (cached) {
        this.logger.debug("Returning cached customer analytics");
        return cached;
      }

      // Get data from database service
      const customerData = await this.databaseService.getCustomerAnalytics(
        toDbFilters(filters),
      );

      if (!customerData) {
        throw new Error("Failed to retrieve customer analytics");
      }

      // Cache the result
      await this.cache.set(cacheKey, customerData, CACHE_TTL.MEDIUM);

      this.logger.info("Customer analytics retrieved successfully", {
        restaurantId: filters.restaurantId,
        totalCustomers: customerData.totalCustomers,
        newCustomers: customerData.newCustomers,
      });

      return customerData;
    } catch (error) {
      this.logger.error(
        "Failed to get customer analytics",
        error as Error,
        filters,
      );
      throw new Error("Failed to retrieve customer analytics");
    }
  }

  /**
   * Get performance analytics with caching
   */
  async getPerformanceAnalytics(
    filters: AnalyticsFilters,
  ): Promise<PerformanceAnalytics> {
    try {
      this.logger.debug("Getting performance analytics", filters);

      // Try cache first
      const cacheKey = `analytics:performance:${JSON.stringify(filters)}`;
      const cached = await this.cache.get<PerformanceAnalytics>(cacheKey);
      if (cached) {
        this.logger.debug("Returning cached performance analytics");
        return cached;
      }

      // Get data from database service
      const performanceData = await this.databaseService.getOrderAnalytics(
        toDbFilters(filters),
      );

      if (!performanceData) {
        throw new Error("Failed to retrieve performance analytics");
      }

      // Cache the result
      await this.cache.set(cacheKey, performanceData, CACHE_TTL.MEDIUM);

      this.logger.info("Performance analytics retrieved successfully", {
        restaurantId: filters.restaurantId,
        totalOrders: performanceData.totalOrders,
        completedOrders: performanceData.completedOrders,
      });

      return performanceData;
    } catch (error) {
      this.logger.error(
        "Failed to get performance analytics",
        error as Error,
        filters,
      );
      throw new Error("Failed to retrieve performance analytics");
    }
  }

  /**
   * Get real-time analytics data
   */
  async getRealtimeData(restaurantId?: number): Promise<RealtimeAnalyticsData> {
    try {
      this.logger.debug("Getting real-time analytics data", { restaurantId });

      // Get fresh data directly from database service (no caching for real-time)
      // Use databaseService.getDashboardData() to get full DashboardData including tableStatus
      const fullDashboardData = await this.databaseService.getDashboardData(
        restaurantId ? String(restaurantId) : (undefined as any),
      );
      const dashboardSummary = fullDashboardData.summary;

      // Get realtime metrics from database service
      let activeOrders = 0;
      let pendingOrders = 0;
      let tableUtilization = 0;

      if (restaurantId) {
        const realtimeDashboard =
          await this.databaseService.getRealtimeDashboard(String(restaurantId));
        activeOrders = realtimeDashboard.activeOrders || 0;
        pendingOrders = realtimeDashboard.kitchenQueue || 0; // Kitchen queue = orders in preparing status

        // Calculate table utilization from full dashboard data (includes tableStatus)
        const totalTables = fullDashboardData.tableStatus?.total || 0;
        const occupiedTables = realtimeDashboard.occupiedTables || 0;
        tableUtilization =
          totalTables > 0
            ? Math.round((occupiedTables / totalTables) * 100)
            : 0;
      }

      const realtimeData: RealtimeAnalyticsData = {
        timestamp: new Date().toISOString(),
        summary: dashboardSummary,
        activeOrders,
        pendingOrders,
        tableUtilization,
      };

      this.logger.info("Real-time analytics data retrieved successfully", {
        restaurantId,
        timestamp: realtimeData.timestamp,
        activeOrders,
        pendingOrders,
        tableUtilization,
      });

      return realtimeData;
    } catch (error) {
      this.logger.error(
        "Failed to get real-time analytics data",
        error as Error,
        { restaurantId },
      );
      throw new Error("Failed to retrieve real-time analytics data");
    }
  }

  /**
   * Generate analytics export
   */
  async generateExport(request: ExportRequest): Promise<ExportResponse> {
    try {
      this.logger.debug("Generating analytics export", request);

      // Create unique filename
      const timestamp = Date.now();
      const filename = `${request.type}_${timestamp}.${request.format}`;
      const downloadUrl = `https://api.example.com/exports/${filename}`;
      const expiresAt = new Date(
        Date.now() + 24 * 60 * 60 * 1000,
      ).toISOString();

      // TODO: Implement actual export generation and storage
      // This would typically involve:
      // 1. Generating the requested data
      // 2. Converting to the requested format (CSV/JSON)
      // 3. Storing in R2 or similar storage
      // 4. Returning download URL

      const response: ExportResponse = {
        success: true,
        message: `${request.type} export generated successfully`,
        data: {
          type: request.type,
          format: request.format,
          period: {
            from: request.dateFrom,
            to: request.dateTo,
          },
          download_url: downloadUrl,
          expires_at: expiresAt,
        },
      };

      this.logger.info("Analytics export generated successfully", {
        type: request.type,
        format: request.format,
        downloadUrl,
      });

      return response;
    } catch (error) {
      this.logger.error(
        "Failed to generate analytics export",
        error as Error,
        request,
      );
      throw new Error("Failed to generate export");
    }
  }

  /**
   * Get financial report data
   */
  async getFinancialReport(
    filters: AnalyticsFilters,
  ): Promise<FinancialReportData> {
    try {
      this.logger.debug("Getting financial report", filters);

      // Try cache first
      const cacheKey = `analytics:financial:${JSON.stringify(filters)}`;
      const cached = await this.cache.get<FinancialReportData>(cacheKey);
      if (cached) {
        this.logger.debug("Returning cached financial report");
        return cached;
      }

      // Get data from database service - convert restaurantId to string
      const dbFilters = {
        ...filters,
        restaurantId: filters.restaurantId
          ? String(filters.restaurantId)
          : undefined,
      };
      const rawFinancialData =
        await this.databaseService.getFinancialReport(dbFilters);

      if (!rawFinancialData) {
        throw new Error("Failed to retrieve financial report");
      }

      // Transform the raw data to match our interface
      const financialData: FinancialReportData = {
        totalRevenue: rawFinancialData.summary?.totalRevenue || 0,
        totalOrders: rawFinancialData.summary?.totalOrders || 0,
        averageOrderValue: rawFinancialData.summary?.averageOrderValue || 0,
        taxAmount: rawFinancialData.summary?.taxAmount || 0,
        netRevenue: rawFinancialData.summary?.netRevenue || 0,
        breakdown: rawFinancialData.revenueBreakdown || {},
      };

      // Cache the result
      await this.cache.set(cacheKey, financialData, CACHE_TTL.LONG);

      this.logger.info("Financial report retrieved successfully", {
        restaurantId: filters.restaurantId,
        period: filters.period,
        totalRevenue: financialData.totalRevenue,
      });

      return financialData;
    } catch (error) {
      this.logger.error(
        "Failed to get financial report",
        error as Error,
        filters,
      );
      throw new Error("Failed to retrieve financial report");
    }
  }

  /**
   * Clear analytics cache
   */
  async clearCache(restaurantId?: number): Promise<void> {
    try {
      this.logger.debug("Clearing analytics cache", { restaurantId });

      const pattern = restaurantId
        ? `analytics:*:${restaurantId}:*`
        : "analytics:*";

      await this.cache.clear(pattern);

      this.logger.info("Analytics cache cleared successfully", {
        restaurantId,
      });
    } catch (error) {
      this.logger.error("Failed to clear analytics cache", error as Error, {
        restaurantId,
      });
      // Don't throw here as cache clearing failure shouldn't break the main flow
    }
  }
}
