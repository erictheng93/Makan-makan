export interface RealtimeStats {
    pending_orders: number;
    preparing_orders: number;
    ready_orders: number;
    completed_today: number;
    cancelled_today: number;
    total_today: number;
    revenue_today: number;
}
export interface KPIMetrics {
    completion_rate: number;
    avg_preparation_time: number;
    orders_per_hour: number;
    revenue_per_order: number;
    efficiency_score: number;
}
export interface SystemLoad {
    active_orders: number;
    queue_length: number;
    kitchen_capacity: number;
    load_percentage: number;
}
export interface ActiveOrder {
    id: number;
    order_number: string;
    status: string;
    total: number;
    customer_name: string;
    table_id: number;
    order_type: string;
    created_at: string;
    estimated_ready_time?: string;
    elapsed_minutes: number;
}
export interface CategoryTime {
    category_name: string;
    item_count: number;
    avg_time_minutes: number;
}
export interface HourlyCompletionRate {
    hour: string;
    total_orders: number;
    completed_orders: number;
    completion_rate: number;
}
export interface PerformanceTrend {
    date: string;
    total_orders: number;
    completed_orders: number;
    avg_prep_time: number;
    completion_rate: number;
    revenue: number;
}
export interface StaffMetric {
    id: number;
    username: string;
    full_name: string;
    role: number;
    orders_handled: number;
    orders_completed: number;
    avg_handling_time: number;
    completion_rate: number;
}
export interface ItemAnalysis {
    id: number;
    item_name: string;
    category_name: string;
    order_count: number;
    avg_prep_time: number;
    successful_orders: number;
    success_rate: number;
    total_revenue: number;
}
export interface StatisticsDashboardData {
    realtime_stats: RealtimeStats;
    kpis: KPIMetrics;
    system_load: SystemLoad;
    active_orders: ActiveOrder[];
    avg_time_by_category: CategoryTime[];
    hourly_completion_rate: HourlyCompletionRate[];
    performance_trend: PerformanceTrend[];
}
export interface DetailedPerformanceData {
    summary: {
        total_orders: number;
        completed_orders: number;
        cancelled_orders: number;
        avg_completion_time: number;
        fastest_completion: number;
        slowest_completion: number;
        median_completion_time: number;
        total_revenue: number;
    };
    staff_metrics: StaffMetric[];
    item_analysis: ItemAnalysis[];
    trends: PerformanceTrend[];
    period: {
        from?: string;
        to?: string;
        groupBy: string;
    };
}
declare class StatisticsService {
    dashboardData: {
        realtime_stats: {
            pending_orders: number;
            preparing_orders: number;
            ready_orders: number;
            completed_today: number;
            cancelled_today: number;
            total_today: number;
            revenue_today: number;
        };
        kpis: {
            completion_rate: number;
            avg_preparation_time: number;
            orders_per_hour: number;
            revenue_per_order: number;
            efficiency_score: number;
        };
        system_load: {
            active_orders: number;
            queue_length: number;
            kitchen_capacity: number;
            load_percentage: number;
        };
        active_orders: {
            id: number;
            order_number: string;
            status: string;
            total: number;
            customer_name: string;
            table_id: number;
            order_type: string;
            created_at: string;
            estimated_ready_time?: string | undefined;
            elapsed_minutes: number;
        }[];
        avg_time_by_category: {
            category_name: string;
            item_count: number;
            avg_time_minutes: number;
        }[];
        hourly_completion_rate: {
            hour: string;
            total_orders: number;
            completed_orders: number;
            completion_rate: number;
        }[];
        performance_trend: {
            date: string;
            total_orders: number;
            completed_orders: number;
            avg_prep_time: number;
            completion_rate: number;
            revenue: number;
        }[];
    };
    detailedPerformance: {
        summary: {
            total_orders: number;
            completed_orders: number;
            cancelled_orders: number;
            avg_completion_time: number;
            fastest_completion: number;
            slowest_completion: number;
            median_completion_time: number;
            total_revenue: number;
        };
        staff_metrics: {
            id: number;
            username: string;
            full_name: string;
            role: number;
            orders_handled: number;
            orders_completed: number;
            avg_handling_time: number;
            completion_rate: number;
        }[];
        item_analysis: {
            id: number;
            item_name: string;
            category_name: string;
            order_count: number;
            avg_prep_time: number;
            successful_orders: number;
            success_rate: number;
            total_revenue: number;
        }[];
        trends: {
            date: string;
            total_orders: number;
            completed_orders: number;
            avg_prep_time: number;
            completion_rate: number;
            revenue: number;
        }[];
        period: {
            from?: string | undefined;
            to?: string | undefined;
            groupBy: string;
        };
    };
    isLoading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<string | null, string | null>;
    lastUpdated: import("vue").Ref<Date | null, Date | null>;
    autoRefresh: import("vue").Ref<boolean, boolean>;
    refreshInterval: import("vue").Ref<number, number>;
    private refreshTimer;
    constructor();
    fetchDashboardData(restaurantId?: number): Promise<void>;
    fetchDetailedPerformance(options?: {
        restaurantId?: number;
        dateFrom?: string;
        dateTo?: string;
        groupBy?: 'day' | 'week' | 'month' | 'year';
        limit?: number;
        includeStaffMetrics?: boolean;
        includeItemAnalysis?: boolean;
    }): Promise<void>;
    startAutoRefresh(): void;
    stopAutoRefresh(): void;
    setAutoRefresh(enabled: boolean): void;
    setRefreshInterval(interval: number): void;
    get totalActiveOrders(): number;
    get completionRateToday(): number;
    get averageOrderValue(): number;
    get kitchenEfficiency(): number;
    get isKitchenBusy(): boolean;
    get urgentOrders(): ActiveOrder[];
    get slowestCategories(): CategoryTime[];
    get peakHours(): HourlyCompletionRate[];
    get performanceTrendDirection(): 'up' | 'down' | 'stable';
    formatTime(minutes: number): string;
    formatCurrency(amount: number): string;
    getStatusColor(status: string): string;
    getEfficiencyColor(score: number): string;
    getLoadColor(percentage: number): string;
    exportDashboardData(): string;
    exportCSV(): string;
    cleanup(): void;
}
export declare const statisticsService: StatisticsService;
export default statisticsService;
