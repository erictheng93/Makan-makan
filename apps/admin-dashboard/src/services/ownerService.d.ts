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
    status: 'online' | 'busy' | 'offline';
    performance: number;
}
declare class OwnerService {
    private baseURL;
    getDashboardData(restaurantId?: number): Promise<OwnerDashboardData>;
    getFinancialReport(options?: {
        restaurantId?: number;
        period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
        year?: string;
        month?: string;
    }): Promise<FinancialReportData>;
    getRealtimeOrders(restaurantId?: number): Promise<RealtimeOrder[]>;
    getStaffActivity(_restaurantId?: number): Promise<StaffActivity[]>;
    handleQuickAction(action: string): Promise<void>;
    private showNotificationDialog;
    private handleEmergency;
    resolveEmergencyAlert(alertId: number): Promise<void>;
    escalateEmergencyAlert(alertId: number): Promise<void>;
    private cache;
    private getCachedData;
    private setCachedData;
    getDashboardDataCached(restaurantId?: number): Promise<OwnerDashboardData>;
    clearCache(): void;
}
export declare const ownerService: OwnerService;
export default ownerService;
