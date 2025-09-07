export interface QueueItem {
    id: string;
    queueNumber: number;
    restaurantId: string;
    customerName: string | null;
    phoneNumber: string;
    partySize: number;
    tablePreference: string | null;
    specialRequests: string | null;
    priority: number;
    status: "waiting" | "called" | "seated" | "no_show" | "cancelled";
    joinedAt: string;
    calledAt: string | null;
    seatedAt: string | null;
    estimatedWaitTime: number;
    actualWaitTime: number | null;
    tableId: string | null;
    notes: string | null;
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
    id: string;
    restaurantId: string;
    maxWaitTime: number;
    notificationIntervals: number[];
    autoCallNext: boolean;
    requirePhoneNumber: boolean;
    allowOnlineJoin: boolean;
    estimationAlgorithm: "simple" | "ml_based";
    operatingHours: {
        start: string;
        end: string;
        days: number[];
    };
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
    getQueue(restaurantId: string, params?: {
        status?: QueueItem["status"];
        date?: string;
    }): Promise<QueueItem[]>;
    joinQueue(data: {
        restaurantId: string;
        customerName?: string;
        phoneNumber: string;
        partySize: number;
        tablePreference?: string;
        specialRequests?: string;
    }): Promise<{
        success: boolean;
        queueItem: QueueItem;
        estimatedWaitTime: number;
    }>;
    getQueuePosition(queueId: string): Promise<{
        position: number;
        estimatedWaitTime: number;
        totalWaiting: number;
    }>;
    updateQueueItem(queueId: string, data: Partial<QueueItem>): Promise<QueueItem>;
    callNext(restaurantId: string, data: {
        operatorId: number;
        skipToNumber?: number;
    }): Promise<{
        success: boolean;
        calledCustomer: QueueItem | null;
        message: string;
    }>;
    callCustomer(queueId: string, data: {
        operatorId: number;
        notificationMethod?: "sms" | "call" | "app_push";
    }): Promise<QueueItem>;
    markNoShow(queueId: string, operatorId: number): Promise<QueueItem>;
    seatCustomer(queueId: string, data: {
        tableId: string;
        operatorId: number;
        notes?: string;
    }): Promise<{
        success: boolean;
        queueItem: QueueItem;
        tableAssignment: any;
    }>;
    getRecommendedTables(queueId: string): Promise<Array<{
        tableId: string;
        tableNumber: string;
        capacity: number;
        status: string;
        matchScore: number;
        reasons: string[];
    }>>;
    cancelQueue(queueId: string, data: {
        reason?: string;
        operatorId?: number;
    }): Promise<QueueItem>;
    rescheduleQueue(queueId: string, data: {
        newDateTime: string;
        reason?: string;
    }): Promise<QueueItem>;
    sendNotification(queueId: string, data: {
        type: "sms" | "call" | "app_push";
        message: string;
        operatorId: number;
    }): Promise<QueueNotification>;
    getNotifications(queueId: string): Promise<QueueNotification[]>;
    sendBulkNotification(restaurantId: string, data: {
        queueIds: string[];
        type: "sms" | "call" | "app_push";
        message: string;
        operatorId: number;
    }): Promise<{
        success: number;
        failed: number;
        results: QueueNotification[];
    }>;
    getSettings(restaurantId: string): Promise<QueueSettings>;
    updateSettings(restaurantId: string, data: Partial<QueueSettings>): Promise<QueueSettings>;
    getDisplayData(restaurantId: string): Promise<{
        currentNumber: number;
        calledNumbers: number[];
        waitingCount: number;
        averageWaitTime: number;
        announcements: Array<{
            message: string;
            type: "info" | "warning";
            priority: number;
        }>;
    }>;
    updateDisplay(restaurantId: string, data: {
        currentNumber?: number;
        announcements?: Array<{
            message: string;
            type: "info" | "warning";
            priority: number;
        }>;
    }): Promise<void>;
    getDailyStats(restaurantId: string, date?: string): Promise<QueueStats>;
    getWeeklyStats(restaurantId: string, startDate?: string): Promise<QueueStats[]>;
    getWaitTimeAnalysis(restaurantId: string, params?: {
        startDate?: string;
        endDate?: string;
    }): Promise<{
        averageWaitTime: number;
        medianWaitTime: number;
        peakWaitTime: number;
        waitTimeDistribution: Array<{
            range: string;
            count: number;
            percentage: number;
        }>;
    }>;
    getRealtimeStatus(restaurantId: string): Promise<{
        currentWaiting: number;
        totalServedToday: number;
        averageWaitTime: number;
        longestWait: number;
        recentActivity: Array<{
            type: "joined" | "called" | "seated" | "no_show";
            queueNumber: number;
            timestamp: string;
            customerName?: string;
        }>;
    }>;
    exportQueue(restaurantId: string, params: {
        startDate?: string;
        endDate?: string;
        status?: QueueItem["status"];
        format: "csv" | "excel";
    }): Promise<Blob>;
    getWaitTimeEstimate(restaurantId: string, partySize: number): Promise<{
        estimatedWaitTime: number;
        confidence: number;
        factors: Array<{
            factor: string;
            impact: number;
            description: string;
        }>;
    }>;
    getCapacityForecast(restaurantId: string, date: string): Promise<{
        hourlyForecast: Array<{
            hour: number;
            expectedCustomers: number;
            suggestedStaffing: number;
            averageWaitTime: number;
        }>;
        peakHours: number[];
        recommendations: string[];
    }>;
};
export default queueService;
