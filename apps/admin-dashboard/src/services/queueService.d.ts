import type { ApiResponse } from "@/types";
export interface QueueItem {
    id: string;
    queueNumber: number;
    restaurantId: number;
    customerName: string | null;
    customerPhone?: string;
    customerEmail?: string;
    partySize: number;
    tablePreferences?: number[];
    specialRequests: string | null;
    priority: number;
    queueType: 'walkin' | 'online' | 'phone';
    status: "waiting" | "called" | "notified" | "seated" | "no_show" | "cancelled" | "expired";
    joinedAt: string;
    calledAt: string | null;
    notifiedAt?: string;
    seatedAt: string | null;
    estimatedWaitMinutes: number;
    actualWaitMinutes: number | null;
    assignedTableId: number | null;
    servedBy?: number;
    notes: string | null;
    notificationMethods?: string[];
    checkInCode?: string;
    metadata?: Record<string, any>;
}
export interface QueueNotification {
    id: string;
    queueId: string;
    type: "sms" | "call" | "app_push";
    message: string;
    sentAt: string;
    status: "sent" | "delivered" | "failed";
}
export interface QueueSettings {
    restaurantId: number;
    isEnabled: boolean;
    maxQueueSize: number;
    avgServiceTime: number;
    maxWaitTime: number;
    minAdvanceNotice: number;
    notificationMethods: string[];
    autoCallEnabled: boolean;
    autoCallInterval: number;
    noShowTimeout: number;
    queueNumberReset: 'daily' | 'weekly' | 'monthly' | 'never';
    priorityRules: Record<string, any>;
    tableAssignmentRules: Record<string, any>;
    notificationTemplates: Record<string, string>;
    businessHours: Record<string, any>;
    holidaySettings: Record<string, any>;
    displaySettings: Record<string, any>;
    integrationSettings: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export interface QueueStats {
    date: string;
    totalCustomers: number;
    averageWaitTime: number;
    maxWaitTime: number;
    noShowRate: number;
    peakHours: Array<{
        hour: number;
        count: number;
        avgWait: number;
    }>;
}
export declare const queueService: {
    getQueue(restaurantId: number, params?: {
        status?: QueueItem["status"];
        limit?: number;
    }): Promise<QueueItem[]>;
    getQueueStatus(restaurantId: number): Promise<{
        queue: any;
        activity: any;
        settings: QueueSettings;
    }>;
    joinQueue(data: {
        restaurantId: number;
        customerName: string;
        customerPhone?: string;
        customerEmail?: string;
        partySize: number;
        specialRequests?: string;
        queueType?: "walkin" | "online" | "phone";
        tablePreferences?: number[];
        notificationMethods?: string[];
    }): Promise<ApiResponse<{
        queueId: string;
        queueNumber: number;
        estimatedWaitMinutes: number;
        currentPosition: number;
        checkInCode: string;
    }>>;
    getQueuePosition(queueId: string): Promise<ApiResponse<{
        queueId: string;
        queueNumber: number;
        currentPosition: number;
        estimatedWaitMinutes: number;
        status: string;
        canCancel: boolean;
    }>>;
    cancelQueue(queueId: string, data: {
        reason?: string;
        checkInCode?: string;
    }): Promise<ApiResponse<{}>>;
    callNext(restaurantId: number, data: {
        tableId?: number;
        specificQueueId?: string;
    }): Promise<{
        success: boolean;
        data?: QueueItem;
        error?: string;
    }>;
    seatCustomer(queueId: string, data: {
        tableId: number;
    }): Promise<ApiResponse<{}>>;
    getSettings(restaurantId: number): Promise<ApiResponse<QueueSettings>>;
    updateSettings(restaurantId: number, data: Partial<QueueSettings>): Promise<ApiResponse<{}>>;
    getDailyStats(restaurantId: number, date?: string): Promise<QueueStats>;
    getRealtimeStatus(restaurantId: number): Promise<{
        queue: {
            total_waiting: number;
            avg_estimated_wait: number;
            min_wait: number;
            max_wait: number;
            online_count: number;
            walkin_count: number;
            priority_count: number;
        };
        activity: {
            seated_today: number;
            cancelled_today: number;
            no_show_today: number;
            avg_actual_wait: number;
        };
        settings: QueueSettings;
    }>;
    getWaitTimeEstimate(restaurantId: number, partySize: number): Promise<{
        estimatedWaitTime: number;
        confidence: number;
        factors: Array<{
            factor: string;
            impact: number;
            description: string;
        }>;
    }>;
    getCapacityForecast(_restaurantId: number, _date: string): Promise<{
        hourlyForecast: Array<{
            hour: number;
            expectedCustomers: number;
            suggestedStaffing: number;
            averageWaitTime: number;
        }>;
        peakHours: number[];
        recommendations: string[];
    }>;
    getPerformanceMetrics(): Promise<ApiResponse<{
        cacheStats: {
            totalEntries: number;
            validEntries: number;
            expiredEntries: number;
            hitRate: number;
            memoryUsage: number;
        };
        lastUpdated: string;
    }>>;
    optimizeQueue(restaurantId: number): Promise<ApiResponse<{
        message: string;
        timestamp: string;
    }>>;
};
export default queueService;
