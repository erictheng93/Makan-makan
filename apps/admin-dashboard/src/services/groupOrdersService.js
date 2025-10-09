import { apiClient } from "./api";
// 團體訂單服務
export const groupOrdersService = {
    // 團體訂單管理
    async getGroupOrders(params) {
        const response = await apiClient.get("/api/v1/orders/group", { params });
        return response.data.data || response.data;
    },
    async createGroupOrder(data) {
        const response = await apiClient.post("/api/v1/orders/group/create", data);
        return response.data.data || response.data;
    },
    async getGroupOrder(shareCode) {
        const response = await apiClient.get(`/api/v1/orders/group/${shareCode}`);
        return response.data.data || response.data;
    },
    async joinGroupOrder(shareCode, data) {
        const response = await apiClient.post(`/api/v1/orders/group/join/${shareCode}`, data);
        return response.data.data || response.data;
    },
    async updateGroupOrder(id, data) {
        const response = await apiClient.put(`/api/v1/orders/group/${id}`, data);
        return response.data.data || response.data;
    },
    async cancelGroupOrder(id, reason) {
        await apiClient.post(`/api/v1/orders/group/${id}/cancel`, { reason });
    },
    // 購物車管理
    async addCartItem(groupOrderId, data) {
        const response = await apiClient.post(`/api/v1/orders/group/${groupOrderId}/cart`, data);
        return response.data.data || response.data;
    },
    async updateCartItem(groupOrderId, itemId, data) {
        const response = await apiClient.put(`/api/v1/orders/group/${groupOrderId}/cart/${itemId}`, data);
        return response.data.data || response.data;
    },
    async removeCartItem(groupOrderId, itemId) {
        await apiClient.delete(`/api/v1/orders/group/${groupOrderId}/cart/${itemId}`);
    },
    async getCartItems(groupOrderId) {
        const response = await apiClient.get(`/api/v1/orders/group/${groupOrderId}/cart`);
        return response.data.data || response.data;
    },
    // 分帳管理
    async initiateSplit(groupOrderId, data) {
        const response = await apiClient.post(`/api/v1/orders/group/${groupOrderId}/split`, data);
        return response.data.data || response.data;
    },
    async getSplitBills(groupOrderId) {
        const response = await apiClient.get(`/api/v1/orders/group/${groupOrderId}/split`);
        return response.data.data || response.data;
    },
    async processPayment(groupOrderId, data) {
        const response = await apiClient.post(`/api/v1/orders/group/${groupOrderId}/payment`, data);
        return response.data.data || response.data;
    },
    // 分享功能
    async generateShareCode(restaurantId) {
        const response = await apiClient.post("/api/v1/orders/group/generate-code", { restaurantId });
        return response.data.data || response.data;
    },
    async getShareInfo(shareCode) {
        const response = await apiClient.get(`/api/v1/orders/group/share/${shareCode}`);
        return response.data.data || response.data;
    },
    // 訂單轉換
    async convertToOrder(groupOrderId) {
        const response = await apiClient.post(`/api/v1/orders/group/${groupOrderId}/convert`);
        return response.data.data || response.data;
    },
    // 通知功能
    async sendNotification(groupOrderId, data) {
        await apiClient.post(`/api/v1/orders/group/${groupOrderId}/notify`, data);
    },
    // 統計和報表
    async getGroupOrderStats(params) {
        const response = await apiClient.get("/api/v1/orders/group/stats", {
            params,
        });
        return response.data.data || response.data;
    },
    async getMemberStats(groupOrderId) {
        const response = await apiClient.get(`/api/v1/orders/group/${groupOrderId}/member-stats`);
        return response.data.data || response.data;
    },
    // 匯出功能
    async exportGroupOrders(params) {
        const response = await apiClient.get("/api/v1/orders/group/export", {
            params,
            responseType: "blob",
        });
        return response.data.data || response.data;
    },
    // QR碼生成
    async generateQRCode(shareCode) {
        const response = await apiClient.post(`/api/v1/orders/group/qr/${shareCode}`);
        return response.data.data || response.data;
    },
};
export default groupOrdersService;
