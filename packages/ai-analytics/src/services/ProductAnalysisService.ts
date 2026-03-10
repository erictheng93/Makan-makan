/**
 * Product Analysis Service
 * Analyzes menu items to identify:
 * - 引流產品 (Traffic Drivers): Products that bring customers in
 * - 熱銷產品 (Bestsellers): Top-selling products by volume
 * - 利潤最大產品 (Profit Leaders): Most profitable products
 */

import type {
  ProductAnalysis,
  ProductCategory,
  TimeRangeParams,
} from "../types";

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T = unknown>(): Promise<{ results: T[]; success: boolean }>;
  first<T = unknown>(): Promise<T | null>;
}

interface RawProductMetrics {
  menu_item_id: string;
  menu_item_name: string;
  category: string;
  unit_price: number;
  unit_cost: number | null;
  total_orders: number;
  total_revenue: number;
  first_item_count: number;
  view_count: number;
  cart_addition_count: number;
}

interface DailyMetric {
  date: string;
  orders: number;
  revenue: number;
}

export class ProductAnalysisService {
  constructor(private db: D1Database) {}

  /**
   * Analyze all products for a restaurant within a time range
   */
  async analyzeProducts(
    restaurantId: string,
    timeRange: TimeRangeParams,
  ): Promise<ProductAnalysis[]> {
    const { startDate, endDate } = this.getDateRange(timeRange);

    // 1. Fetch raw metrics
    const rawMetrics = await this.fetchRawMetrics(
      restaurantId,
      startDate,
      endDate,
    );

    if (rawMetrics.length === 0) {
      return [];
    }

    // 2. Calculate derived metrics
    const productsWithMetrics = await Promise.all(
      rawMetrics.map(async (raw) => {
        const dailyData = await this.fetchDailyData(
          raw.menu_item_id,
          startDate,
          endDate,
        );
        const trendScore = this.calculateTrendScore(dailyData);
        const growthRate = this.calculateGrowthRate(dailyData);

        return {
          ...raw,
          dailyData,
          trendScore,
          growthRate,
        };
      }),
    );

    // 3. Calculate rankings
    const withRankings = this.calculateRankings(productsWithMetrics);

    // 4. Categorize products
    const categorized = withRankings.map((product) => ({
      ...product,
      categories: this.categorizeProduct(product),
    }));

    // 5. Convert to ProductAnalysis format
    return categorized.map(this.toProductAnalysis);
  }

  /**
   * Get top traffic drivers (引流產品)
   */
  async getTrafficDrivers(
    restaurantId: string,
    timeRange: TimeRangeParams,
    limit: number = 10,
  ): Promise<ProductAnalysis[]> {
    const allProducts = await this.analyzeProducts(restaurantId, timeRange);

    return allProducts
      .filter((p) => p.categories.includes("traffic-driver"))
      .sort((a, b) => b.firstItemInOrderCount - a.firstItemInOrderCount)
      .slice(0, limit);
  }

  /**
   * Get bestsellers (熱銷產品)
   */
  async getBestsellers(
    restaurantId: string,
    timeRange: TimeRangeParams,
    limit: number = 10,
  ): Promise<ProductAnalysis[]> {
    const allProducts = await this.analyzeProducts(restaurantId, timeRange);

    return allProducts
      .sort((a, b) => b.totalOrders - a.totalOrders)
      .slice(0, limit);
  }

  /**
   * Get profit leaders (利潤最大產品)
   */
  async getProfitLeaders(
    restaurantId: string,
    timeRange: TimeRangeParams,
    limit: number = 10,
  ): Promise<ProductAnalysis[]> {
    const allProducts = await this.analyzeProducts(restaurantId, timeRange);

    return allProducts
      .filter((p) => p.totalProfit !== undefined && p.totalProfit > 0)
      .sort((a, b) => (b.totalProfit || 0) - (a.totalProfit || 0))
      .slice(0, limit);
  }

  /**
   * Get underperforming products
   */
  async getUnderperformers(
    restaurantId: string,
    timeRange: TimeRangeParams,
    limit: number = 10,
  ): Promise<ProductAnalysis[]> {
    const allProducts = await this.analyzeProducts(restaurantId, timeRange);

    return allProducts
      .filter((p) => p.categories.includes("underperformer"))
      .sort((a, b) => a.trendScore - b.trendScore) // Most negative trend first
      .slice(0, limit);
  }

  // ============================================
  // Private Helper Methods
  // ============================================

  private getDateRange(timeRange: TimeRangeParams): {
    startDate: string;
    endDate: string;
  } {
    const now = new Date();
    let startDate: Date;

    if (
      timeRange.range === "custom" &&
      timeRange.startDate &&
      timeRange.endDate
    ) {
      return {
        startDate: timeRange.startDate,
        endDate: timeRange.endDate,
      };
    }

    switch (timeRange.range) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "14d":
        startDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "180d":
        startDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
        break;
      case "1y":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return {
      startDate: startDate.toISOString().split("T")[0],
      endDate: now.toISOString().split("T")[0],
    };
  }

  private async fetchRawMetrics(
    restaurantId: string,
    startDate: string,
    endDate: string,
  ): Promise<RawProductMetrics[]> {
    const query = `
      WITH order_stats AS (
        SELECT
          oi.menu_item_id,
          COUNT(DISTINCT o.id) AS total_orders,
          SUM(oi.subtotal) AS total_revenue,
          SUM(CASE WHEN oia.position_in_order = 1 THEN 1 ELSE 0 END) AS first_item_count
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN order_item_analytics oia ON oi.id = oia.order_id AND oi.menu_item_id = oia.menu_item_id
        WHERE o.restaurant_id = ?
          AND DATE(o.created_at) BETWEEN ? AND ?
          AND o.status = 'completed'
        GROUP BY oi.menu_item_id
      ),
      engagement_stats AS (
        SELECT
          menu_item_id,
          COUNT(*) AS view_count,
          SUM(CASE WHEN was_viewed_before_order = 1 THEN 1 ELSE 0 END) AS cart_addition_count
        FROM order_item_analytics
        WHERE created_at BETWEEN ? AND ?
        GROUP BY menu_item_id
      )
      SELECT
        mi.id AS menu_item_id,
        mi.name AS menu_item_name,
        mi.category,
        mi.price AS unit_price,
        mic.total_cost AS unit_cost,
        COALESCE(os.total_orders, 0) AS total_orders,
        COALESCE(os.total_revenue, 0) AS total_revenue,
        COALESCE(os.first_item_count, 0) AS first_item_count,
        COALESCE(es.view_count, 0) AS view_count,
        COALESCE(es.cart_addition_count, 0) AS cart_addition_count
      FROM menu_items mi
      LEFT JOIN order_stats os ON mi.id = os.menu_item_id
      LEFT JOIN engagement_stats es ON mi.id = es.menu_item_id
      LEFT JOIN menu_item_costs mic ON mi.id = mic.menu_item_id AND mic.effective_to IS NULL
      WHERE mi.restaurant_id = ?
        AND mi.available = 1
      ORDER BY total_orders DESC
    `;

    const result = await this.db
      .prepare(query)
      .bind(restaurantId, startDate, endDate, startDate, endDate, restaurantId)
      .all<RawProductMetrics>();

    return result.results || [];
  }

  private async fetchDailyData(
    menuItemId: string,
    startDate: string,
    endDate: string,
  ): Promise<DailyMetric[]> {
    const query = `
      SELECT
        DATE(o.created_at) AS date,
        COUNT(*) AS orders,
        SUM(oi.subtotal) AS revenue
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE oi.menu_item_id = ?
        AND DATE(o.created_at) BETWEEN ? AND ?
        AND o.status = 'completed'
      GROUP BY DATE(o.created_at)
      ORDER BY date ASC
    `;

    const result = await this.db
      .prepare(query)
      .bind(menuItemId, startDate, endDate)
      .all<DailyMetric>();

    return result.results || [];
  }

  private calculateTrendScore(dailyData: DailyMetric[]): number {
    if (dailyData.length < 2) return 0;

    // Simple linear regression to calculate trend
    const n = dailyData.length;
    const xValues = Array.from({ length: n }, (_, i) => i);
    const yValues = dailyData.map((d) => d.orders);

    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    // Normalize slope to -1 to 1 range
    const avgY = sumY / n;
    const normalizedSlope = avgY > 0 ? slope / avgY : 0;

    return Math.max(-1, Math.min(1, normalizedSlope));
  }

  private calculateGrowthRate(dailyData: DailyMetric[]): number {
    if (dailyData.length < 2) return 0;

    const halfPoint = Math.floor(dailyData.length / 2);
    const firstHalf = dailyData.slice(0, halfPoint);
    const secondHalf = dailyData.slice(halfPoint);

    const firstHalfAvg =
      firstHalf.reduce((sum, d) => sum + d.orders, 0) / firstHalf.length;
    const secondHalfAvg =
      secondHalf.reduce((sum, d) => sum + d.orders, 0) / secondHalf.length;

    if (firstHalfAvg === 0) return secondHalfAvg > 0 ? 100 : 0;

    return ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100;
  }

  private calculateRankings<
    T extends {
      menu_item_id: string;
      total_orders: number;
      total_revenue: number;
      unit_cost: number | null;
      unit_price: number;
    },
  >(
    products: T[],
  ): (T & { salesRank: number; revenueRank: number; profitRank?: number })[] {
    // Sort by orders
    const byOrders = [...products].sort(
      (a, b) => b.total_orders - a.total_orders,
    );
    const orderRankMap = new Map(
      byOrders.map((p, i) => [p.menu_item_id, i + 1]),
    );

    // Sort by revenue
    const byRevenue = [...products].sort(
      (a, b) => b.total_revenue - a.total_revenue,
    );
    const revenueRankMap = new Map(
      byRevenue.map((p, i) => [p.menu_item_id, i + 1]),
    );

    // Sort by profit (if cost data available)
    const productsWithCost = products.filter((p) => p.unit_cost !== null);
    const byProfit = productsWithCost
      .map((p) => ({
        ...p,
        totalProfit: (p.unit_price - (p.unit_cost || 0)) * p.total_orders,
      }))
      .sort((a, b) => b.totalProfit - a.totalProfit);
    const profitRankMap = new Map(
      byProfit.map((p, i) => [p.menu_item_id, i + 1]),
    );

    return products.map((p) => ({
      ...p,
      salesRank: orderRankMap.get(p.menu_item_id) || 0,
      revenueRank: revenueRankMap.get(p.menu_item_id) || 0,
      profitRank: profitRankMap.get(p.menu_item_id),
    }));
  }

  private categorizeProduct(product: {
    total_orders: number;
    first_item_count: number;
    cart_addition_count: number;
    view_count: number;
    trendScore: number;
    salesRank: number;
    unit_cost: number | null;
    unit_price: number;
  }): ProductCategory[] {
    const categories: ProductCategory[] = [];

    // Traffic driver: High first-item count and good conversion
    const trafficDriverScore =
      product.first_item_count / Math.max(product.total_orders, 1);
    if (trafficDriverScore > 0.3 && product.first_item_count >= 5) {
      categories.push("traffic-driver");
    }

    // Bestseller: Top 20% in sales rank
    if (product.salesRank <= Math.ceil(product.salesRank * 0.2)) {
      categories.push("bestseller");
    }

    // Profit leader: High profit margin and significant volume
    if (product.unit_cost !== null) {
      const profitMargin =
        (product.unit_price - product.unit_cost) / product.unit_price;
      if (profitMargin > 0.5 && product.total_orders >= 10) {
        categories.push("profit-leader");
      }
    }

    // Underperformer: Negative trend and low sales
    if (
      product.trendScore < -0.3 ||
      (product.total_orders < 5 && product.trendScore < 0)
    ) {
      categories.push("underperformer");
    }

    return categories;
  }

  private toProductAnalysis = (product: any): ProductAnalysis => {
    const profitMargin =
      product.unit_cost !== null
        ? (product.unit_price - product.unit_cost) / product.unit_price
        : undefined;

    const totalProfit =
      product.unit_cost !== null
        ? (product.unit_price - product.unit_cost) * product.total_orders
        : undefined;

    const conversionRate =
      product.cart_addition_count > 0
        ? product.total_orders / product.cart_addition_count
        : 0;

    const cartAdditionRate =
      product.view_count > 0
        ? product.cart_addition_count / product.view_count
        : 0;

    return {
      menuItemId: product.menu_item_id,
      menuItemName: product.menu_item_name,
      category: product.category,
      totalOrders: product.total_orders,
      totalRevenue: product.total_revenue,
      averageOrderValue:
        product.total_orders > 0
          ? product.total_revenue / product.total_orders
          : 0,
      unitCost: product.unit_cost ?? undefined,
      unitPrice: product.unit_price,
      profitMargin,
      totalProfit,
      firstItemInOrderCount: product.first_item_count,
      cartAdditionRate,
      conversionRate,
      trendScore: product.trendScore,
      growthRate: product.growthRate,
      salesRank: product.salesRank,
      revenueRank: product.revenueRank,
      profitRank: product.profitRank,
      categories: product.categories,
      dailyData: product.dailyData,
    };
  };
}
