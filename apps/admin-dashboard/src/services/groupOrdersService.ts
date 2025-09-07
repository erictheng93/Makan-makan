import { apiClient } from "./api";

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

export interface GroupCartItem {
  id: string;
  groupOrderId: string;
  memberId: string;
  menuItemId: string;
  menuItemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  customizations?: any;
}

export interface SplitBill {
  id: string;
  groupOrderId: string;
  memberId: string;
  amount: number;
  paymentStatus: "pending" | "paid";
  paymentMethod?: string;
  paidAt?: string;
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
    const response = await apiClient.get("/api/v1/orders/group", { params });
    return (response.data as any).data || response.data;
  },

  async createGroupOrder(data: {
    tableNumber?: string;
    hostName: string;
    expectedMembers: number;
    restaurantId: string;
    notes?: string;
  }): Promise<GroupOrder> {
    const response = await apiClient.post("/api/v1/orders/group/create", data);
    return (response.data as any).data || response.data;
  },

  async getGroupOrder(shareCode: string): Promise<GroupOrder> {
    const response = await apiClient.get(`/api/v1/orders/group/${shareCode}`);
    return (response.data as any).data || response.data;
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
      `/api/v1/orders/group/join/${shareCode}`,
      data,
    );
    return (response.data as any).data || response.data;
  },

  async updateGroupOrder(
    id: string,
    data: Partial<GroupOrder>,
  ): Promise<GroupOrder> {
    const response = await apiClient.put(`/api/v1/orders/group/${id}`, data);
    return (response.data as any).data || response.data;
  },

  async cancelGroupOrder(id: string, reason?: string): Promise<void> {
    await apiClient.post(`/api/v1/orders/group/${id}/cancel`, { reason });
  },

  // 購物車管理
  async addCartItem(
    groupOrderId: string,
    data: {
      memberId: string;
      menuItemId: string;
      quantity: number;
      customizations?: any;
    },
  ): Promise<GroupCartItem> {
    const response = await apiClient.post(
      `/api/v1/orders/group/${groupOrderId}/cart`,
      data,
    );
    return (response.data as any).data || response.data;
  },

  async updateCartItem(
    groupOrderId: string,
    itemId: string,
    data: {
      quantity: number;
      customizations?: any;
    },
  ): Promise<GroupCartItem> {
    const response = await apiClient.put(
      `/api/v1/orders/group/${groupOrderId}/cart/${itemId}`,
      data,
    );
    return (response.data as any).data || response.data;
  },

  async removeCartItem(groupOrderId: string, itemId: string): Promise<void> {
    await apiClient.delete(
      `/api/v1/orders/group/${groupOrderId}/cart/${itemId}`,
    );
  },

  async getCartItems(groupOrderId: string): Promise<GroupCartItem[]> {
    const response = await apiClient.get(
      `/api/v1/orders/group/${groupOrderId}/cart`,
    );
    return (response.data as any).data || response.data;
  },

  // 分帳管理
  async initiateSplit(
    groupOrderId: string,
    data: {
      splitType: "equal" | "by_item" | "custom";
      customSplits?: Array<{
        memberId: string;
        amount: number;
      }>;
    },
  ): Promise<SplitBill[]> {
    const response = await apiClient.post(
      `/api/v1/orders/group/${groupOrderId}/split`,
      data,
    );
    return (response.data as any).data || response.data;
  },

  async getSplitBills(groupOrderId: string): Promise<SplitBill[]> {
    const response = await apiClient.get(
      `/api/v1/orders/group/${groupOrderId}/split`,
    );
    return (response.data as any).data || response.data;
  },

  async processPayment(
    groupOrderId: string,
    data: {
      memberId: string;
      splitBillId: string;
      paymentMethod: string;
      amount: number;
    },
  ): Promise<{
    success: boolean;
    paymentId: string;
    receipt?: any;
  }> {
    const response = await apiClient.post(
      `/api/v1/orders/group/${groupOrderId}/payment`,
      data,
    );
    return (response.data as any).data || response.data;
  },

  // 分享功能
  async generateShareCode(restaurantId: string): Promise<{
    shareCode: string;
    shareUrl: string;
    expiresAt: string;
  }> {
    const response = await apiClient.post(
      "/api/v1/orders/group/generate-code",
      { restaurantId },
    );
    return (response.data as any).data || response.data;
  },

  async getShareInfo(shareCode: string): Promise<{
    shareCode: string;
    shareUrl: string;
    groupOrder?: GroupOrder;
    isValid: boolean;
    expiresAt: string;
  }> {
    const response = await apiClient.get(
      `/api/v1/orders/group/share/${shareCode}`,
    );
    return (response.data as any).data || response.data;
  },

  // 訂單轉換
  async convertToOrder(groupOrderId: string): Promise<{
    success: boolean;
    orderId: string;
    orderNumber: string;
  }> {
    const response = await apiClient.post(
      `/api/v1/orders/group/${groupOrderId}/convert`,
    );
    return (response.data as any).data || response.data;
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
    await apiClient.post(`/api/v1/orders/group/${groupOrderId}/notify`, data);
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
    totalRevenue: number;
    completionRate: number;
    popularTimes: Array<{
      hour: number;
      count: number;
    }>;
  }> {
    const response = await apiClient.get("/api/v1/orders/group/stats", {
      params,
    });
    return (response.data as any).data || response.data;
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
      `/api/v1/orders/group/${groupOrderId}/member-stats`,
    );
    return (response.data as any).data || response.data;
  },

  // 匯出功能
  async exportGroupOrders(params: {
    restaurantId?: string;
    startDate?: string;
    endDate?: string;
    status?: GroupOrder["status"];
    format: "csv" | "excel";
  }): Promise<Blob> {
    const response = await apiClient.get("/api/v1/orders/group/export", {
      params,
      responseType: "blob",
    });
    return (response.data as any).data || response.data;
  },

  // QR碼生成
  async generateQRCode(shareCode: string): Promise<{
    qrCodeUrl: string;
    shareUrl: string;
  }> {
    const response = await apiClient.post(
      `/api/v1/orders/group/qr/${shareCode}`,
    );
    return (response.data as any).data || response.data;
  },
};

export default groupOrdersService;
