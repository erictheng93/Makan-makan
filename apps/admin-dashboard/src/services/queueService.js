import { apiClient } from "./api";
// 候位管理服務
export const queueService = {
  // 排隊管理
  async getQueue(restaurantId, params) {
    const response = await apiClient.get(`/api/v1/queue/${restaurantId}`, {
      params,
    });
    return response.data.data || response.data;
  },
  async joinQueue(data) {
    const response = await apiClient.post("/api/v1/queue/join", data);
    return response.data.data || response.data;
  },
  async getQueuePosition(queueId) {
    const response = await apiClient.get(`/api/v1/queue/${queueId}/position`);
    return response.data.data || response.data;
  },
  async updateQueueItem(queueId, data) {
    const response = await apiClient.put(`/api/v1/queue/${queueId}`, data);
    return response.data.data || response.data;
  },
  // 叫號管理
  async callNext(restaurantId, data) {
    const response = await apiClient.post(
      `/api/v1/queue/${restaurantId}/call-next`,
      data,
    );
    return response.data.data || response.data;
  },
  async callCustomer(queueId, data) {
    const response = await apiClient.post(
      `/api/v1/queue/${queueId}/call`,
      data,
    );
    return response.data.data || response.data;
  },
  async markNoShow(queueId, operatorId) {
    const response = await apiClient.post(`/api/v1/queue/${queueId}/no-show`, {
      operatorId,
    });
    return response.data.data || response.data;
  },
  // 座位安排
  async seatCustomer(queueId, data) {
    const response = await apiClient.post(
      `/api/v1/queue/${queueId}/seat`,
      data,
    );
    return response.data.data || response.data;
  },
  async getRecommendedTables(queueId) {
    const response = await apiClient.get(
      `/api/v1/queue/${queueId}/recommended-tables`,
    );
    return response.data.data || response.data;
  },
  // 取消和修改
  async cancelQueue(queueId, data) {
    const response = await apiClient.post(
      `/api/v1/queue/${queueId}/cancel`,
      data,
    );
    return response.data.data || response.data;
  },
  async rescheduleQueue(queueId, data) {
    const response = await apiClient.post(
      `/api/v1/queue/${queueId}/reschedule`,
      data,
    );
    return response.data.data || response.data;
  },
  // 通知管理
  async sendNotification(queueId, data) {
    const response = await apiClient.post(
      `/api/v1/queue/${queueId}/notify`,
      data,
    );
    return response.data.data || response.data;
  },
  async getNotifications(queueId) {
    const response = await apiClient.get(
      `/api/v1/queue/${queueId}/notifications`,
    );
    return response.data.data || response.data;
  },
  async sendBulkNotification(restaurantId, data) {
    const response = await apiClient.post(
      `/api/v1/queue/${restaurantId}/bulk-notify`,
      data,
    );
    return response.data.data || response.data;
  },
  // 設定管理
  async getSettings(restaurantId) {
    const response = await apiClient.get(
      `/api/v1/queue/${restaurantId}/settings`,
    );
    return response.data.data || response.data;
  },
  async updateSettings(restaurantId, data) {
    const response = await apiClient.put(
      `/api/v1/queue/${restaurantId}/settings`,
      data,
    );
    return response.data.data || response.data;
  },
  // 顯示管理
  async getDisplayData(restaurantId) {
    const response = await apiClient.get(
      `/api/v1/queue/${restaurantId}/display`,
    );
    return response.data.data || response.data;
  },
  async updateDisplay(restaurantId, data) {
    await apiClient.put(`/api/v1/queue/${restaurantId}/display`, data);
  },
  // 統計和分析
  async getDailyStats(restaurantId, date) {
    const response = await apiClient.get(
      `/api/v1/queue/${restaurantId}/stats/daily`,
      {
        params: { date },
      },
    );
    return response.data.data || response.data;
  },
  async getWeeklyStats(restaurantId, startDate) {
    const response = await apiClient.get(
      `/api/v1/queue/${restaurantId}/stats/weekly`,
      {
        params: { startDate },
      },
    );
    return response.data.data || response.data;
  },
  async getWaitTimeAnalysis(restaurantId, params) {
    const response = await apiClient.get(
      `/api/v1/queue/${restaurantId}/stats/wait-time`,
      { params },
    );
    return response.data.data || response.data;
  },
  // 即時狀態
  async getRealtimeStatus(restaurantId) {
    const response = await apiClient.get(
      `/api/v1/queue/${restaurantId}/status`,
    );
    return response.data.data || response.data;
  },
  // 匯出功能
  async exportQueue(restaurantId, params) {
    const response = await apiClient.get(
      `/api/v1/queue/${restaurantId}/export`,
      {
        params,
        responseType: "blob",
      },
    );
    return response.data.data || response.data;
  },
  // 預測和智能功能
  async getWaitTimeEstimate(restaurantId, partySize) {
    const response = await apiClient.get(
      `/api/v1/queue/${restaurantId}/estimate`,
      {
        params: { partySize },
      },
    );
    return response.data.data || response.data;
  },
  async getCapacityForecast(restaurantId, date) {
    const response = await apiClient.get(
      `/api/v1/queue/${restaurantId}/forecast`,
      {
        params: { date },
      },
    );
    return response.data.data || response.data;
  },
};
export default queueService;
