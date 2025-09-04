// Comprehensive statistics dashboard service for real-time data management
import { ref, reactive } from "vue";
import { api } from "./api";
class StatisticsService {
  constructor() {
    // Reactive state
    Object.defineProperty(this, "dashboardData", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: reactive({
        realtime_stats: {
          pending_orders: 0,
          preparing_orders: 0,
          ready_orders: 0,
          completed_today: 0,
          cancelled_today: 0,
          total_today: 0,
          revenue_today: 0,
        },
        kpis: {
          completion_rate: 0,
          avg_preparation_time: 0,
          orders_per_hour: 0,
          revenue_per_order: 0,
          efficiency_score: 0,
        },
        system_load: {
          active_orders: 0,
          queue_length: 0,
          kitchen_capacity: 20,
          load_percentage: 0,
        },
        active_orders: [],
        avg_time_by_category: [],
        hourly_completion_rate: [],
        performance_trend: [],
      }),
    });
    Object.defineProperty(this, "detailedPerformance", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: reactive({
        summary: {
          total_orders: 0,
          completed_orders: 0,
          cancelled_orders: 0,
          avg_completion_time: 0,
          fastest_completion: 0,
          slowest_completion: 0,
          median_completion_time: 0,
          total_revenue: 0,
        },
        staff_metrics: [],
        item_analysis: [],
        trends: [],
        period: {
          groupBy: "day",
        },
      }),
    });
    Object.defineProperty(this, "isLoading", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: ref(false),
    });
    Object.defineProperty(this, "error", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: ref(null),
    });
    Object.defineProperty(this, "lastUpdated", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: ref(null),
    });
    Object.defineProperty(this, "autoRefresh", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: ref(true),
    });
    Object.defineProperty(this, "refreshInterval", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: ref(30000),
    }); // 30 seconds
    Object.defineProperty(this, "refreshTimer", {
      enumerable: true,
      configurable: true,
      writable: true,
      value: null,
    });
    this.startAutoRefresh();
  }
  // Main dashboard data fetching
  async fetchDashboardData(restaurantId) {
    if (this.isLoading.value) return;
    this.isLoading.value = true;
    this.error.value = null;
    try {
      const params = new URLSearchParams();
      if (restaurantId) {
        params.append("restaurantId", restaurantId.toString());
      }
      const response = await api.get(`/analytics/realtime-dashboard?${params}`);
      if (response.data.success) {
        Object.assign(this.dashboardData, response.data.data);
        this.lastUpdated.value = new Date();
      } else {
        const errorObj =
          response.data.error || "Failed to fetch dashboard data";
        throw new Error(
          typeof errorObj === "string" ? errorObj : JSON.stringify(errorObj),
        );
      }
    } catch (error) {
      this.error.value =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      this.isLoading.value = false;
    }
  }
  // Detailed performance data fetching
  async fetchDetailedPerformance(options = {}) {
    if (this.isLoading.value) return;
    this.isLoading.value = true;
    this.error.value = null;
    try {
      const params = new URLSearchParams({
        groupBy: options.groupBy || "day",
        limit: (options.limit || 30).toString(),
        includeStaffMetrics: (options.includeStaffMetrics || false).toString(),
        includeItemAnalysis: (options.includeItemAnalysis || false).toString(),
      });
      if (options.restaurantId)
        params.append("restaurantId", options.restaurantId.toString());
      if (options.dateFrom) params.append("dateFrom", options.dateFrom);
      if (options.dateTo) params.append("dateTo", options.dateTo);
      const response = await api.get(
        `/analytics/detailed-performance?${params}`,
      );
      if (response.data.success) {
        Object.assign(this.detailedPerformance, response.data.data);
        this.lastUpdated.value = new Date();
      } else {
        const errorObj =
          response.data.error || "Failed to fetch detailed performance data";
        throw new Error(
          typeof errorObj === "string" ? errorObj : JSON.stringify(errorObj),
        );
      }
    } catch (error) {
      this.error.value =
        error instanceof Error ? error.message : "Unknown error occurred";
      console.error("Failed to fetch detailed performance data:", error);
    } finally {
      this.isLoading.value = false;
    }
  }
  // Auto refresh functionality
  startAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    this.refreshTimer = setInterval(() => {
      if (this.autoRefresh.value) {
        this.fetchDashboardData();
      }
    }, this.refreshInterval.value);
  }
  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }
  setAutoRefresh(enabled) {
    this.autoRefresh.value = enabled;
    if (enabled) {
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
    }
  }
  setRefreshInterval(interval) {
    this.refreshInterval.value = interval;
    if (this.autoRefresh.value) {
      this.startAutoRefresh();
    }
  }
  // Computed properties for derived statistics
  get totalActiveOrders() {
    return (
      this.dashboardData.realtime_stats.pending_orders +
      this.dashboardData.realtime_stats.preparing_orders
    );
  }
  get completionRateToday() {
    const total = this.dashboardData.realtime_stats.total_today;
    const completed = this.dashboardData.realtime_stats.completed_today;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }
  get averageOrderValue() {
    const revenue = this.dashboardData.realtime_stats.revenue_today;
    const completed = this.dashboardData.realtime_stats.completed_today;
    return completed > 0 ? Math.round((revenue / completed) * 100) / 100 : 0;
  }
  get kitchenEfficiency() {
    return this.dashboardData.kpis.efficiency_score;
  }
  get isKitchenBusy() {
    return this.dashboardData.system_load.load_percentage >= 70;
  }
  get urgentOrders() {
    return this.dashboardData.active_orders
      .filter((order) => order.elapsed_minutes > 30)
      .sort((a, b) => b.elapsed_minutes - a.elapsed_minutes);
  }
  get slowestCategories() {
    return [...this.dashboardData.avg_time_by_category]
      .sort((a, b) => b.avg_time_minutes - a.avg_time_minutes)
      .slice(0, 5);
  }
  get peakHours() {
    return [...this.dashboardData.hourly_completion_rate]
      .sort((a, b) => b.total_orders - a.total_orders)
      .slice(0, 3);
  }
  get performanceTrendDirection() {
    const trends = this.dashboardData.performance_trend;
    if (trends.length < 2) return "stable";
    const recent = trends[0]?.completion_rate || 0;
    const previous = trends[1]?.completion_rate || 0;
    const difference = recent - previous;
    if (Math.abs(difference) < 2) return "stable";
    return difference > 0 ? "up" : "down";
  }
  // Utility methods
  formatTime(minutes) {
    if (minutes < 60) {
      return `${Math.round(minutes)}分鐘`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}小時${mins}分鐘`;
  }
  formatCurrency(amount) {
    return amount.toLocaleString("zh-MY", {
      style: "currency",
      currency: "MYR",
      minimumFractionDigits: 2,
    });
  }
  getStatusColor(status) {
    const colors = {
      pending: "text-yellow-600 bg-yellow-100",
      preparing: "text-blue-600 bg-blue-100",
      ready: "text-green-600 bg-green-100",
      completed: "text-gray-600 bg-gray-100",
      cancelled: "text-red-600 bg-red-100",
    };
    return colors[status] || "text-gray-600 bg-gray-100";
  }
  getEfficiencyColor(score) {
    if (score >= 85) return "text-green-600";
    if (score >= 70) return "text-yellow-600";
    return "text-red-600";
  }
  getLoadColor(percentage) {
    if (percentage >= 80) return "bg-red-500";
    if (percentage >= 60) return "bg-yellow-500";
    return "bg-green-500";
  }
  // Export functionality
  exportDashboardData() {
    return JSON.stringify(
      {
        dashboard_data: this.dashboardData,
        detailed_performance: this.detailedPerformance,
        exported_at: new Date().toISOString(),
      },
      null,
      2,
    );
  }
  exportCSV() {
    const csvData = [
      ["指標", "數值", "單位"],
      [
        "總訂單數",
        this.dashboardData.realtime_stats.total_today.toString(),
        "筆",
      ],
      [
        "已完成訂單",
        this.dashboardData.realtime_stats.completed_today.toString(),
        "筆",
      ],
      ["完成率", this.dashboardData.kpis.completion_rate.toString(), "%"],
      [
        "平均製作時間",
        this.dashboardData.kpis.avg_preparation_time.toString(),
        "分鐘",
      ],
      [
        "今日營收",
        this.dashboardData.realtime_stats.revenue_today.toString(),
        "RM",
      ],
      ["效率評分", this.dashboardData.kpis.efficiency_score.toString(), "分"],
      [
        "系統負載",
        this.dashboardData.system_load.load_percentage.toString(),
        "%",
      ],
      ["活躍訂單數", this.totalActiveOrders.toString(), "筆"],
    ];
    return csvData.map((row) => row.join(",")).join("\n");
  }
  // Cleanup
  cleanup() {
    this.stopAutoRefresh();
  }
}
// Create and export singleton instance
export const statisticsService = new StatisticsService();
export default statisticsService;
