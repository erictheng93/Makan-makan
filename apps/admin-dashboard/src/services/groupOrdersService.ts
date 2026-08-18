import { apiClient, unwrapApiData } from "./api";

// 型別定義
export interface GroupOrderMember {
  id: string;
  groupOrderId: string;
  name: string;
  itemCount: number;
  totalAmount: number;
  paymentStatus: "unpaid" | "pending" | "paid";
  joinedAt: string;
}

export interface GroupOrder {
  id: string;
  shareCode: string;
  masterOrderId: string | null;
  tableNumber: string | null;
  status: "active" | "ready_to_pay" | "completed" | "cancelled";
  hostName: string;
  memberCount: number;
  totalAmount: number;
  subtotal: number;
  serviceCharge: number;
  taxAmount: number;
  itemCount: number;
  members: GroupOrderMember[];
  createdAt: string;
  completedAt: string | null;
  expiresAt: string;
}

// 團體訂單服務
export const groupOrdersService = {
  // 團體訂單管理
  async getGroupOrders(params?: {
    status?: GroupOrder["status"];
    restaurantId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<GroupOrder[]> {
    const response = await apiClient.get("/orders/group", params);
    return unwrapApiData<GroupOrder[]>(response);
  },

  async createGroupOrder(data: {
    tableNumber?: string;
    hostName: string;
    expectedMembers: number;
    restaurantId: string;
    notes?: string;
  }): Promise<GroupOrder> {
    const response = await apiClient.post("/orders/group/create", data);
    return unwrapApiData<GroupOrder>(response);
  },

  async getGroupOrder(shareCode: string): Promise<GroupOrder> {
    const response = await apiClient.get(`/orders/group/${shareCode}`);
    return unwrapApiData<GroupOrder>(response);
  },

  async joinGroupOrder(
    shareCode: string,
    data: {
      memberName: string;
      phoneNumber?: string;
    },
  ): Promise<{
    success: boolean;
    memberId: string;
    groupOrder: GroupOrder;
  }> {
    const response = await apiClient.post(
      `/orders/group/join/${shareCode}`,
      data,
    );
    return unwrapApiData<{
      success: boolean;
      memberId: string;
      groupOrder: GroupOrder;
    }>(response);
  },

  async updateGroupOrder(
    id: string,
    data: Partial<GroupOrder>,
  ): Promise<GroupOrder> {
    const response = await apiClient.put(`/orders/group/${id}`, data);
    return unwrapApiData<GroupOrder>(response);
  },

  async cancelGroupOrder(id: string, reason?: string): Promise<void> {
    await apiClient.post(`/orders/group/${id}/cancel`, { reason });
  },

  // 分享功能
  async generateShareCode(restaurantId: string): Promise<{
    shareCode: string;
    shareUrl: string;
    expiresAt: string;
  }> {
    const response = await apiClient.post("/orders/group/generate-code", {
      restaurantId,
    });
    return unwrapApiData<{
      shareCode: string;
      shareUrl: string;
      expiresAt: string;
    }>(response);
  },

  async getShareInfo(shareCode: string): Promise<{
    shareCode: string;
    shareUrl: string;
    groupOrder?: GroupOrder;
    isValid: boolean;
    expiresAt: string;
  }> {
    const response = await apiClient.get(`/orders/group/share/${shareCode}`);
    return unwrapApiData<{
      shareCode: string;
      shareUrl: string;
      groupOrder?: GroupOrder;
      isValid: boolean;
      expiresAt: string;
    }>(response);
  },

  // 訂單轉換
  async convertToOrder(groupOrderId: string): Promise<{
    success: boolean;
    orderId: string;
    orderNumber: string;
  }> {
    const response = await apiClient.post(
      `/orders/group/${groupOrderId}/convert`,
    );
    return unwrapApiData<{
      success: boolean;
      orderId: string;
      orderNumber: string;
    }>(response);
  },

  // 通知功能
  async sendNotification(
    groupOrderId: string,
    data: {
      type: "join_reminder" | "payment_reminder" | "order_ready";
      memberIds?: string[];
      message?: string;
    },
  ): Promise<void> {
    await apiClient.post(`/orders/group/${groupOrderId}/notify`, data);
  },

  // 統計和報表
  async getGroupOrderStats(params?: {
    restaurantId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    totalGroupOrders: number;
    activeGroupOrders: number;
    averageGroupSize: number;
    averageOrderValue: number;
    conversionRate: number;
    popularTimeSlots: Array<Record<string, unknown>>;
    paymentMethodDistribution: Record<string, unknown>;
  }> {
    const response = await apiClient.get("/orders/group/statistics", params);
    return unwrapApiData<{
      totalGroupOrders: number;
      activeGroupOrders: number;
      averageGroupSize: number;
      averageOrderValue: number;
      conversionRate: number;
      popularTimeSlots: Array<Record<string, unknown>>;
      paymentMethodDistribution: Record<string, unknown>;
    }>(response);
  },

  async getMemberStats(groupOrderId: string): Promise<
    Array<{
      member: GroupOrderMember;
      orderValue: number;
      itemCount: number;
      paymentStatus: string;
    }>
  > {
    const response = await apiClient.get(
      `/orders/group/${groupOrderId}/member-stats`,
    );
    return unwrapApiData<
      Array<{
        member: GroupOrderMember;
        orderValue: number;
        itemCount: number;
        paymentStatus: string;
      }>
    >(response);
  },

  // 匯出功能
  async exportGroupOrders(params: {
    restaurantId?: string;
    startDate?: string;
    endDate?: string;
    status?: GroupOrder["status"];
    format: "csv" | "excel";
  }): Promise<Blob> {
    const response = await apiClient.instance.get<Blob>(
      "/orders/group/export",
      {
        params,
        responseType: "blob",
      },
    );
    return response.data;
  },

  // QR碼生成
  async generateQRCode(shareCode: string): Promise<{
    qrCodeUrl: string;
    shareUrl: string;
  }> {
    const response = await apiClient.post(`/orders/group/qr/${shareCode}`);
    return unwrapApiData<{
      qrCodeUrl: string;
      shareUrl: string;
    }>(response);
  },
};

export default groupOrdersService;
