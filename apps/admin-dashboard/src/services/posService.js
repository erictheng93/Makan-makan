import { apiClient } from "./api";
// 現金櫃管理
export const posService = {
  // 現金櫃
  async getRegisters() {
    const response = await apiClient.get("/api/v1/pos/registers");
    return response.data.data || response.data;
  },
  async createRegister(data) {
    const response = await apiClient.post("/api/v1/pos/registers", data);
    return response.data.data || response.data;
  },
  async updateRegister(id, data) {
    const response = await apiClient.put(`/api/v1/pos/registers/${id}`, data);
    return response.data.data || response.data;
  },
  async activateRegister(id) {
    await apiClient.post(`/api/v1/pos/registers/${id}/activate`);
  },
  async deactivateRegister(id) {
    await apiClient.post(`/api/v1/pos/registers/${id}/deactivate`);
  },
  // 班次管理
  async startShift(data) {
    const response = await apiClient.post("/api/v1/pos/shifts/start", data);
    return response.data.data || response.data;
  },
  async endShift(shiftId, data) {
    const response = await apiClient.post(
      `/api/v1/pos/shifts/${shiftId}/end`,
      data,
    );
    return response.data.data || response.data;
  },
  async getCurrentShift(registerId) {
    try {
      const response = await apiClient.get(
        `/api/v1/pos/registers/${registerId}/current-shift`,
      );
      return response.data.data || response.data;
    } catch (error) {
      return null;
    }
  },
  // 現金異動
  async createCashMovement(data) {
    const response = await apiClient.post("/api/v1/pos/cash-movements", data);
    return response.data.data || response.data;
  },
  async getCashMovements(registerId, params) {
    const response = await apiClient.get(
      `/api/v1/pos/registers/${registerId}/cash-movements`,
      { params },
    );
    return response.data.data || response.data;
  },
  // 收據管理
  async printReceipt(data) {
    const response = await apiClient.post("/api/v1/pos/receipts/print", data);
    return response.data.data || response.data;
  },
  async getReceipts(registerId, params) {
    const response = await apiClient.get(
      `/api/v1/pos/registers/${registerId}/receipts`,
      { params },
    );
    return response.data.data || response.data;
  },
  // 退款處理
  async processRefund(data) {
    const response = await apiClient.post("/api/v1/pos/refunds/create", data);
    return response.data.data || response.data;
  },
  // 促銷管理
  async getPromotions() {
    const response = await apiClient.get("/api/v1/pos/promotions");
    return response.data.data || response.data;
  },
  async createPromotion(data) {
    const response = await apiClient.post("/api/v1/pos/promotions", data);
    return response.data.data || response.data;
  },
  async updatePromotion(id, data) {
    const response = await apiClient.put(`/api/v1/pos/promotions/${id}`, data);
    return response.data.data || response.data;
  },
  async deletePromotion(id) {
    await apiClient.delete(`/api/v1/pos/promotions/${id}`);
  },
  // 統計和報表
  async getDailyStats(registerId, date) {
    const response = await apiClient.get(
      `/api/v1/pos/registers/${registerId}/stats/daily`,
      {
        params: { date },
      },
    );
    return response.data.data || response.data;
  },
  async getShiftReport(shiftId) {
    const response = await apiClient.get(
      `/api/v1/pos/shifts/${shiftId}/report`,
    );
    return response.data.data || response.data;
  },
  // 快速收銀
  async processQuickPayment(data) {
    const response = await apiClient.post("/api/v1/pos/quick-payment", data);
    return response.data.data || response.data;
  },
};
export default posService;
