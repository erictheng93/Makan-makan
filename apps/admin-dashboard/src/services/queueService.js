import { apiClient } from "./api";
// 新模組化候位管理服務
export const queueService = {
    // 排隊管理 - 使用新 API
    async getQueue(restaurantId, params) {
        const response = await apiClient.get(`/api/v1/queue-modular/${restaurantId}/current`, {
            params,
        });
        return response.data?.data?.queue || [];
    },
    async getQueueStatus(restaurantId) {
        const response = await apiClient.get(`/api/v1/queue-modular/${restaurantId}/status`);
        const data = response.data?.data;
        return {
            queue: data?.queue || {},
            activity: data?.activity || {},
            settings: data?.settings || {}
        };
    },
    async joinQueue(data) {
        const response = await apiClient.post("/api/v1/queue-modular/join", data);
        return response.data;
    },
    async getQueuePosition(queueId) {
        const response = await apiClient.get(`/api/v1/queue-modular/${queueId}/position`);
        return response.data;
    },
    // 取消候位 - 新模組化實現
    async cancelQueue(queueId, data) {
        const response = await apiClient.post(`/api/v1/queue-modular/${queueId}/cancel`, data);
        return response.data;
    },
    // 叫號管理 - 使用新 API
    async callNext(restaurantId, data) {
        const response = await apiClient.post("/api/v1/queue-modular/call-next", {
            restaurantId,
            ...data
        });
        return response.data;
    },
    // 客戶入座 - 新模組化實現
    async seatCustomer(queueId, data) {
        const response = await apiClient.post(`/api/v1/queue-modular/${queueId}/seat`, data);
        return response.data;
    },
    // 設定管理 - 使用新 API
    async getSettings(restaurantId) {
        const response = await apiClient.get(`/api/v1/queue-modular/${restaurantId}/settings`);
        return response.data;
    },
    async updateSettings(restaurantId, data) {
        const response = await apiClient.put(`/api/v1/queue-modular/${restaurantId}/settings`, data);
        return response.data;
    },
    // 統計和分析 - 暫時保留舊 API 直到新統計端點實現
    async getDailyStats(restaurantId, date) {
        const response = await apiClient.get(`/api/v1/queue/${restaurantId}/stats`, {
            params: { dateFrom: date, dateTo: date },
        });
        return response.data.data || response.data;
    },
    // 即時狀態 - 使用新 API
    async getRealtimeStatus(restaurantId) {
        const response = await apiClient.get(`/api/v1/queue-modular/${restaurantId}/status`);
        const data = response.data?.data;
        return {
            queue: data?.queue || {
                total_waiting: 0,
                avg_estimated_wait: 0,
                min_wait: 0,
                max_wait: 0,
                online_count: 0,
                walkin_count: 0,
                priority_count: 0
            },
            activity: data?.activity || {
                seated_today: 0,
                cancelled_today: 0,
                no_show_today: 0,
                avg_actual_wait: 0
            },
            settings: data?.settings || {}
        };
    },
    // 預測和智能功能 - 暫時保留舊端點，等待新實現
    async getWaitTimeEstimate(restaurantId, partySize) {
        // 使用新的狀態端點獲取預估時間
        const status = await this.getRealtimeStatus(restaurantId);
        const avgWait = status.queue?.avg_estimated_wait || 30;
        // 簡化的預估邏輯，待後續增強
        const estimate = Math.max(avgWait * (partySize > 4 ? 1.2 : 1), 5);
        return {
            estimatedWaitTime: Math.round(estimate),
            confidence: 0.75,
            factors: [
                {
                    factor: "當前候位人數",
                    impact: status.queue?.total_waiting || 0,
                    description: "目前排隊等候的客戶數量"
                },
                {
                    factor: "聚餐人數",
                    impact: partySize,
                    description: "較大聚餐需要更長準備時間"
                }
            ]
        };
    },
    async getCapacityForecast(_restaurantId, _date) {
        // 暫時返回模擬數據，等待新 API 實現
        return {
            hourlyForecast: [],
            peakHours: [12, 13, 18, 19, 20],
            recommendations: [
                "建議在用餐尖峰時段增加服務人員",
                "考慮實施預約制度以平衡客流"
            ]
        };
    },
    // Performance optimization methods
    async getPerformanceMetrics() {
        const response = await apiClient.get('/api/v1/queue-modular/performance');
        return response.data;
    },
    async optimizeQueue(restaurantId) {
        const response = await apiClient.post(`/api/v1/queue-modular/${restaurantId}/optimize`);
        return response.data;
    },
};
export default queueService;
