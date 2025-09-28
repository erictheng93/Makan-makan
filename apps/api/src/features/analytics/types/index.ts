/**
 * Analytics Types
 * TypeScript type definitions for the analytics feature
 */

// Base analytics interfaces
export interface AnalyticsFilters {
  restaurantId?: number
  dateFrom?: string
  dateTo?: string
  groupBy?: 'day' | 'week' | 'month' | 'year'
  limit?: number
  includeComparison?: boolean
  metric?: 'orders' | 'revenue' | 'avg_order_value' | 'customer_count'
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly'
  year?: string
  month?: string
  [key: string]: unknown
}

// Dashboard data interfaces
export interface DashboardMetrics {
  total_orders: number
  completed_orders: number
  cancelled_orders: number
  total_revenue: number
  avg_order_value: number
  unique_customers: number
}

export interface DashboardSummary {
  todayRevenue: number
  todayOrders: number
  monthRevenue: number
  monthOrders: number
  growthRates: {
    revenueGrowth: number
    orderGrowth: number
  }
}

export interface DashboardResponse {
  success: boolean
  data: {
    summary: DashboardSummary
    recentOrders: any[]
    topSellingItems: any[]
    tableStatus: {
      occupied: number
      available: number
      total: number
    }
  }
  timestamp: string
}

// Revenue analytics interfaces
export interface RevenueData {
  date: string
  revenue: number
  orderCount: number
  averageOrderValue: number
  comparison?: {
    previousRevenue: number
    growthRate: number
  }
}

export interface RevenueAnalyticsResponse {
  success: boolean
  data: RevenueData[]
}

// Product analytics interfaces
export interface ProductAnalytics {
  popularItems: Array<{
    itemId: number
    itemName: string
    categoryName: string
    quantity: number
    revenue: number
    growthRate?: number
  }>
  categoryPerformance: Array<{
    categoryId: number
    categoryName: string
    quantity: number
    revenue: number
    itemCount: number
  }>
  lowPerformingItems: Array<{
    itemId: number
    itemName: string
    quantity: number
    lastOrdered?: Date
  }>
}

export interface ProductAnalyticsResponse {
  success: boolean
  data: ProductAnalytics
}

// Customer analytics interfaces
export interface CustomerAnalytics {
  totalCustomers: number
  newCustomers: number
  returningCustomers: number
  averageOrdersPerCustomer: number
  customerLifetimeValue: number
  topCustomers: Array<{
    customerId: number
    customerName: string
    totalOrders: number
    totalSpent: number
  }>
}

export interface CustomerAnalyticsResponse {
  success: boolean
  data: CustomerAnalytics
}

// Performance analytics interfaces
export interface PerformanceAnalytics {
  totalOrders: number
  completedOrders: number
  cancelledOrders: number
  averageOrderValue: number
  totalRevenue: number
  conversionRate: number
  averagePreparationTime: number
  popularTimeSlots: Array<{ hour: number; orderCount: number }>
}

export interface PerformanceAnalyticsResponse {
  success: boolean
  data: PerformanceAnalytics
}

// Export interfaces
export interface ExportRequest {
  type: 'dashboard' | 'revenue' | 'products' | 'customers' | 'performance'
  format: 'json' | 'csv'
  restaurantId?: number
  dateFrom?: string
  dateTo?: string
  groupBy?: 'day' | 'week' | 'month' | 'year'
  limit?: number
  [key: string]: unknown
}

export interface ExportResponse {
  success: boolean
  message: string
  data: {
    type: string
    format: string
    period: {
      from?: string
      to?: string
    }
    download_url: string
    expires_at: string
  }
}

// Real-time analytics interfaces
export interface RealtimeAnalyticsData {
  timestamp: string
  summary: DashboardSummary
  activeOrders: number
  pendingOrders: number
  tableUtilization: number
}

export interface SSEAnalyticsEvent {
  id: string
  event: 'heartbeat' | 'statistics_update' | 'error'
  data: RealtimeAnalyticsData | { message: string; timestamp: string } | { error: string; timestamp: string }
}

// Financial report interfaces
export interface FinancialReportData {
  totalRevenue: number
  totalOrders: number
  averageOrderValue: number
  taxAmount: number
  netRevenue: number
  periodComparison?: {
    previousPeriodRevenue: number
    growthRate: number
  }
  breakdown: {
    daily?: Array<{ date: string; revenue: number; orders: number }>
    weekly?: Array<{ week: string; revenue: number; orders: number }>
    monthly?: Array<{ month: string; revenue: number; orders: number }>
    yearly?: Array<{ year: string; revenue: number; orders: number }>
  }
}

export interface FinancialReportResponse {
  success: boolean
  data: FinancialReportData
}

// Service interface
export interface IAnalyticsService {
  getDashboardData(restaurantId?: number, period?: string): Promise<DashboardSummary>
  getRevenueAnalytics(filters: AnalyticsFilters): Promise<RevenueData[]>
  getProductAnalytics(filters: AnalyticsFilters): Promise<ProductAnalytics>
  getCustomerAnalytics(filters: AnalyticsFilters): Promise<CustomerAnalytics>
  getPerformanceAnalytics(filters: AnalyticsFilters): Promise<PerformanceAnalytics>
  getRealtimeData(restaurantId?: number): Promise<RealtimeAnalyticsData>
  generateExport(request: ExportRequest): Promise<ExportResponse>
  getFinancialReport(filters: AnalyticsFilters): Promise<FinancialReportData>
}

// Error response interface
export interface AnalyticsErrorResponse {
  success: false
  error: {
    code: string
    message: string
  }
}