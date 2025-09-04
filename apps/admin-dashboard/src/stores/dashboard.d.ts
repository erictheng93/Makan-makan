import type { ChartData } from '@/types';
export declare const useDashboardStore: import("pinia").StoreDefinition<"dashboard", Pick<{
    stats: Readonly<import("vue").Ref<{
        readonly todayOrders: number;
        readonly todayRevenue: number;
        readonly averageOrderValue: number;
        readonly completionRate: number;
        readonly topMenuItems: readonly {
            readonly name: string;
            readonly quantity: number;
            readonly revenue: number;
        }[];
        readonly revenueChart: readonly {
            readonly label: string;
            readonly value: number;
            readonly date?: string | undefined;
        }[];
        readonly ordersChart: readonly {
            readonly label: string;
            readonly value: number;
            readonly date?: string | undefined;
        }[];
    } | null, {
        readonly todayOrders: number;
        readonly todayRevenue: number;
        readonly averageOrderValue: number;
        readonly completionRate: number;
        readonly topMenuItems: readonly {
            readonly name: string;
            readonly quantity: number;
            readonly revenue: number;
        }[];
        readonly revenueChart: readonly {
            readonly label: string;
            readonly value: number;
            readonly date?: string | undefined;
        }[];
        readonly ordersChart: readonly {
            readonly label: string;
            readonly value: number;
            readonly date?: string | undefined;
        }[];
    } | null>>;
    isLoading: Readonly<import("vue").Ref<boolean, boolean>>;
    error: Readonly<import("vue").Ref<string | null, string | null>>;
    lastUpdated: Readonly<import("vue").Ref<Date | null, Date | null>>;
    todayOrders: import("vue").ComputedRef<number>;
    todayRevenue: import("vue").ComputedRef<number>;
    averageOrderValue: import("vue").ComputedRef<number>;
    completionRate: import("vue").ComputedRef<number>;
    topMenuItems: import("vue").ComputedRef<{
        name: string;
        quantity: number;
        revenue: number;
    }[]>;
    revenueChart: import("vue").ComputedRef<{
        label: string;
        value: number;
        date?: string | undefined;
    }[]>;
    ordersChart: import("vue").ComputedRef<{
        label: string;
        value: number;
        date?: string | undefined;
    }[]>;
    fetchDashboardStats: (dateRange?: {
        from: string;
        to: string;
    }) => Promise<void>;
    fetchRevenueAnalytics: (period: "daily" | "weekly" | "monthly") => Promise<ChartData[]>;
    fetchOrderAnalytics: (period: "daily" | "weekly" | "monthly") => Promise<ChartData[]>;
    fetchTopMenuItems: (limit?: number, period?: "today" | "week" | "month") => Promise<unknown>;
    refreshStats: () => Promise<void>;
    clearStats: () => void;
    formatCurrency: (amount: number) => string;
    formatPercentage: (value: number) => string;
    getGrowthIndicator: (current: number, previous: number) => {
        value: number;
        isPositive: boolean;
    };
    startAutoRefresh: (intervalMs?: number) => void;
    stopAutoRefresh: () => void;
}, "error" | "isLoading" | "stats" | "lastUpdated">, Pick<{
    stats: Readonly<import("vue").Ref<{
        readonly todayOrders: number;
        readonly todayRevenue: number;
        readonly averageOrderValue: number;
        readonly completionRate: number;
        readonly topMenuItems: readonly {
            readonly name: string;
            readonly quantity: number;
            readonly revenue: number;
        }[];
        readonly revenueChart: readonly {
            readonly label: string;
            readonly value: number;
            readonly date?: string | undefined;
        }[];
        readonly ordersChart: readonly {
            readonly label: string;
            readonly value: number;
            readonly date?: string | undefined;
        }[];
    } | null, {
        readonly todayOrders: number;
        readonly todayRevenue: number;
        readonly averageOrderValue: number;
        readonly completionRate: number;
        readonly topMenuItems: readonly {
            readonly name: string;
            readonly quantity: number;
            readonly revenue: number;
        }[];
        readonly revenueChart: readonly {
            readonly label: string;
            readonly value: number;
            readonly date?: string | undefined;
        }[];
        readonly ordersChart: readonly {
            readonly label: string;
            readonly value: number;
            readonly date?: string | undefined;
        }[];
    } | null>>;
    isLoading: Readonly<import("vue").Ref<boolean, boolean>>;
    error: Readonly<import("vue").Ref<string | null, string | null>>;
    lastUpdated: Readonly<import("vue").Ref<Date | null, Date | null>>;
    todayOrders: import("vue").ComputedRef<number>;
    todayRevenue: import("vue").ComputedRef<number>;
    averageOrderValue: import("vue").ComputedRef<number>;
    completionRate: import("vue").ComputedRef<number>;
    topMenuItems: import("vue").ComputedRef<{
        name: string;
        quantity: number;
        revenue: number;
    }[]>;
    revenueChart: import("vue").ComputedRef<{
        label: string;
        value: number;
        date?: string | undefined;
    }[]>;
    ordersChart: import("vue").ComputedRef<{
        label: string;
        value: number;
        date?: string | undefined;
    }[]>;
    fetchDashboardStats: (dateRange?: {
        from: string;
        to: string;
    }) => Promise<void>;
    fetchRevenueAnalytics: (period: "daily" | "weekly" | "monthly") => Promise<ChartData[]>;
    fetchOrderAnalytics: (period: "daily" | "weekly" | "monthly") => Promise<ChartData[]>;
    fetchTopMenuItems: (limit?: number, period?: "today" | "week" | "month") => Promise<unknown>;
    refreshStats: () => Promise<void>;
    clearStats: () => void;
    formatCurrency: (amount: number) => string;
    formatPercentage: (value: number) => string;
    getGrowthIndicator: (current: number, previous: number) => {
        value: number;
        isPositive: boolean;
    };
    startAutoRefresh: (intervalMs?: number) => void;
    stopAutoRefresh: () => void;
}, "todayOrders" | "todayRevenue" | "averageOrderValue" | "completionRate" | "topMenuItems" | "revenueChart" | "ordersChart">, Pick<{
    stats: Readonly<import("vue").Ref<{
        readonly todayOrders: number;
        readonly todayRevenue: number;
        readonly averageOrderValue: number;
        readonly completionRate: number;
        readonly topMenuItems: readonly {
            readonly name: string;
            readonly quantity: number;
            readonly revenue: number;
        }[];
        readonly revenueChart: readonly {
            readonly label: string;
            readonly value: number;
            readonly date?: string | undefined;
        }[];
        readonly ordersChart: readonly {
            readonly label: string;
            readonly value: number;
            readonly date?: string | undefined;
        }[];
    } | null, {
        readonly todayOrders: number;
        readonly todayRevenue: number;
        readonly averageOrderValue: number;
        readonly completionRate: number;
        readonly topMenuItems: readonly {
            readonly name: string;
            readonly quantity: number;
            readonly revenue: number;
        }[];
        readonly revenueChart: readonly {
            readonly label: string;
            readonly value: number;
            readonly date?: string | undefined;
        }[];
        readonly ordersChart: readonly {
            readonly label: string;
            readonly value: number;
            readonly date?: string | undefined;
        }[];
    } | null>>;
    isLoading: Readonly<import("vue").Ref<boolean, boolean>>;
    error: Readonly<import("vue").Ref<string | null, string | null>>;
    lastUpdated: Readonly<import("vue").Ref<Date | null, Date | null>>;
    todayOrders: import("vue").ComputedRef<number>;
    todayRevenue: import("vue").ComputedRef<number>;
    averageOrderValue: import("vue").ComputedRef<number>;
    completionRate: import("vue").ComputedRef<number>;
    topMenuItems: import("vue").ComputedRef<{
        name: string;
        quantity: number;
        revenue: number;
    }[]>;
    revenueChart: import("vue").ComputedRef<{
        label: string;
        value: number;
        date?: string | undefined;
    }[]>;
    ordersChart: import("vue").ComputedRef<{
        label: string;
        value: number;
        date?: string | undefined;
    }[]>;
    fetchDashboardStats: (dateRange?: {
        from: string;
        to: string;
    }) => Promise<void>;
    fetchRevenueAnalytics: (period: "daily" | "weekly" | "monthly") => Promise<ChartData[]>;
    fetchOrderAnalytics: (period: "daily" | "weekly" | "monthly") => Promise<ChartData[]>;
    fetchTopMenuItems: (limit?: number, period?: "today" | "week" | "month") => Promise<unknown>;
    refreshStats: () => Promise<void>;
    clearStats: () => void;
    formatCurrency: (amount: number) => string;
    formatPercentage: (value: number) => string;
    getGrowthIndicator: (current: number, previous: number) => {
        value: number;
        isPositive: boolean;
    };
    startAutoRefresh: (intervalMs?: number) => void;
    stopAutoRefresh: () => void;
}, "fetchDashboardStats" | "fetchRevenueAnalytics" | "fetchOrderAnalytics" | "fetchTopMenuItems" | "refreshStats" | "clearStats" | "formatCurrency" | "formatPercentage" | "getGrowthIndicator" | "startAutoRefresh" | "stopAutoRefresh">>;
