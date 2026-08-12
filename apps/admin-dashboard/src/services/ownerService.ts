import type { ApiResponse } from "@/types";
import { api } from "./api";

interface OwnerDashboardData {
  today_overview: {
    total_orders: number;
    completed_orders: number;
    total_revenue: number;
    avg_order_value: number;
    unique_customers: number;
  };
  staff_status: {
    total_staff: number;
    online_staff: number;
    avg_chef_efficiency: number;
    avg_service_efficiency: number;
  };
  system_health: Array<{
    name: string;
    status: string;
    uptime: string;
  }>;
  emergency_alerts: Array<{
    id: number;
    title: string;
    description: string;
    severity: string;
    created_at: string;
  }>;
  popular_items: Array<{
    name: string;
    sales_count: number;
    revenue: number;
  }>;
}

interface FinancialReportData {
  period: string;
  revenue_summary: {
    total_orders: number;
    gross_revenue: number;
    total_tax: number;
    net_revenue: number;
    avg_order_value: number;
  };
  payment_methods: Array<{
    payment_method: string;
    order_count: number;
    total_amount: number;
  }>;
  refund_stats: {
    refund_count: number;
    total_refunded: number;
  };
}

interface RealtimeOrder {
  id: number;
  order_number: string;
  status: string;
  total: number;
  customer_name?: string;
  table_id?: number;
  order_type: string;
  created_at: string;
  elapsed_minutes: number;
}

interface StaffActivity {
  id: number;
  name: string;
  role: string;
  status: "online" | "busy" | "offline";
  performance: number;
}

class OwnerService {
  private buildParams(
    params: Record<string, string | undefined>,
  ): Record<string, string> | undefined {
    const entries = Object.entries(params).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    );
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }

  private unwrap<T>(result: ApiResponse<T>, fallbackMessage: string): T {
    if (!result.success) {
      throw new Error(result.error?.message || fallbackMessage);
    }

    return result.data!;
  }

  async getDashboardData(restaurantId?: string): Promise<OwnerDashboardData> {
    try {
      const response = await api.get<OwnerDashboardData>(
        "/analytics/owner-dashboard",
        this.buildParams({ restaurantId }),
      );
      return this.unwrap(response.data, "Failed to fetch dashboard data");
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      throw error;
    }
  }

  async getFinancialReport(
    options: {
      restaurantId?: string;
      period?: "daily" | "weekly" | "monthly" | "yearly";
      year?: string;
      month?: string;
    } = {},
  ): Promise<FinancialReportData> {
    try {
      const response = await api.get<FinancialReportData>(
        "/analytics/financial-report",
        this.buildParams({
          restaurantId: options.restaurantId,
          period: options.period,
          year: options.year,
          month: options.month,
        }),
      );
      return this.unwrap(response.data, "Failed to fetch financial report");
    } catch (error) {
      console.error("Error fetching financial report:", error);
      throw error;
    }
  }

  async getRealtimeOrders(restaurantId?: string): Promise<RealtimeOrder[]> {
    try {
      const response = await api.get<unknown>(
        "/analytics/realtime-dashboard",
        this.buildParams({ restaurantId }),
      );
      const data = this.unwrap(
        response.data,
        "Failed to fetch realtime orders",
      );
      return data?.active_orders || [];
    } catch (error) {
      console.error("Error fetching realtime orders:", error);
      throw error;
    }
  }

  async getStaffActivity(restaurantId?: string): Promise<StaffActivity[]> {
    try {
      const response = await api.get<unknown[]>(
        "/users",
        this.buildParams({ restaurantId, limit: "10" }),
      );
      const result = response.data;

      if (!result.success || !result.data) {
        return [];
      }

      return result.data.map((user) => ({
        id: user.id,
        name: user.fullName || user.username,
        role: user.roleName || "Staff",
        status: (user.status === "active" ? "online" : "offline") as
          | "online"
          | "busy"
          | "offline",
        performance: 0,
      }));
    } catch (error) {
      console.error("Error fetching staff activity:", error);
      return [];
    }
  }

  getQuickActionRoute(action: string): string | null {
    const routes: Record<string, string> = {
      "add-staff": "/dashboard/employees",
      "update-menu": "/dashboard/menu",
      "view-reports": "/dashboard/analytics",
      "system-settings": "/dashboard/settings",
    };
    return routes[action] ?? null;
  }

  async resolveEmergencyAlert(alertId: number): Promise<void> {
    try {
      await api.post(`/alerts/${alertId}/resolve`);
      console.log("Emergency alert resolved:", alertId);
    } catch (error) {
      console.error("Error resolving emergency alert:", error);
      throw error;
    }
  }

  async escalateEmergencyAlert(alertId: number): Promise<void> {
    try {
      await api.post(`/alerts/${alertId}/escalate`);
      console.log("Emergency alert escalated:", alertId);
    } catch (error) {
      console.error("Error escalating emergency alert:", error);
      throw error;
    }
  }

  // 緩存管理
  private cache = new Map<
    string,
    { data: unknown; timestamp: number; ttl: number }
  >();

  private getCachedData<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    return null;
  }

  private setCachedData<T>(key: string, data: T, ttl: number = 60000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  async getDashboardDataCached(
    restaurantId?: string,
  ): Promise<OwnerDashboardData> {
    const cacheKey = `dashboard-${restaurantId || "all"}`;
    const cached = this.getCachedData<OwnerDashboardData>(cacheKey);

    if (cached) {
      return cached;
    }

    const data = await this.getDashboardData(restaurantId);
    this.setCachedData(cacheKey, data, 30000); // 30秒緩存
    return data;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const ownerService = new OwnerService();
export default ownerService;
