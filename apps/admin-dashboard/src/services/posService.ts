import { apiClient } from "./api";

// 型別定義
export interface CashRegister {
  id: string;
  name: string;
  status: "active" | "inactive" | "maintenance";
  currentBalance: number;
  location: string;
  createdAt: string;
  updatedAt: string;
}

export interface CashShift {
  id: string;
  registerId: string;
  operatorId: number;
  startTime: string;
  endTime?: string;
  startingCash: number;
  endingCash?: number;
  totalSales: number;
  totalRefunds: number;
  status: "active" | "ended";
}

export interface CashMovement {
  id: string;
  registerId: string;
  type: "cash_in" | "cash_out" | "drawer_count" | "refund";
  amount: number;
  description: string;
  operatorId: number;
  createdAt: string;
}

export interface Receipt {
  id: string;
  orderId: string;
  registerId: string;
  receiptNumber: string;
  items: any[];
  totalAmount: number;
  paymentMethod: string;
  createdAt: string;
}

export interface Promotion {
  id: string;
  title: string;
  description: string;
  discountType: "percentage" | "fixed_amount";
  discountValue: number;
  minOrderAmount?: number;
  isActive: boolean;
  startDate: string;
  endDate: string;
}

// 現金櫃管理
export const posService = {
  // 現金櫃
  async getRegisters(): Promise<CashRegister[]> {
    const response = await apiClient.get("/api/v1/pos/registers");
    return (response.data as any).data || response.data;
  },

  async createRegister(
    data: Omit<CashRegister, "id" | "createdAt" | "updatedAt">,
  ): Promise<CashRegister> {
    const response = await apiClient.post("/api/v1/pos/registers", data);
    return (response.data as any).data || response.data;
  },

  async updateRegister(
    id: string,
    data: Partial<CashRegister>,
  ): Promise<CashRegister> {
    const response = await apiClient.put(`/api/v1/pos/registers/${id}`, data);
    return (response.data as any).data || response.data;
  },

  async activateRegister(id: string): Promise<void> {
    await apiClient.post(`/api/v1/pos/registers/${id}/activate`);
  },

  async deactivateRegister(id: string): Promise<void> {
    await apiClient.post(`/api/v1/pos/registers/${id}/deactivate`);
  },

  // 班次管理
  async startShift(data: {
    registerId: string;
    startingCash: number;
    operatorId: number;
  }): Promise<CashShift> {
    const response = await apiClient.post("/api/v1/pos/shifts/start", data);
    return (response.data as any).data || response.data;
  },

  async endShift(
    shiftId: string,
    data: {
      endingCash: number;
      notes?: string;
    },
  ): Promise<CashShift> {
    const response = await apiClient.post(
      `/api/v1/pos/shifts/${shiftId}/end`,
      data,
    );
    return (response.data as any).data || response.data;
  },

  async getCurrentShift(registerId: string): Promise<CashShift | null> {
    try {
      const response = await apiClient.get(
        `/api/v1/pos/registers/${registerId}/current-shift`,
      );
      return (response.data as any).data || response.data;
    } catch (error) {
      return null;
    }
  },

  // 現金異動
  async createCashMovement(data: {
    registerId: string;
    type: CashMovement["type"];
    amount: number;
    description: string;
    operatorId: number;
  }): Promise<CashMovement> {
    const response = await apiClient.post("/api/v1/pos/cash-movements", data);
    return (response.data as any).data || response.data;
  },

  async getCashMovements(
    registerId: string,
    params?: {
      startDate?: string;
      endDate?: string;
      type?: CashMovement["type"];
    },
  ): Promise<CashMovement[]> {
    const response = await apiClient.get(
      `/api/v1/pos/registers/${registerId}/cash-movements`,
      { params },
    );
    return (response.data as any).data || response.data;
  },

  // 收據管理
  async printReceipt(data: {
    orderId: string;
    registerId: string;
    items: any[];
    totalAmount: number;
    paymentMethod: string;
  }): Promise<Receipt> {
    const response = await apiClient.post("/api/v1/pos/receipts/print", data);
    return (response.data as any).data || response.data;
  },

  async getReceipts(
    registerId: string,
    params?: {
      startDate?: string;
      endDate?: string;
    },
  ): Promise<Receipt[]> {
    const response = await apiClient.get(
      `/api/v1/pos/registers/${registerId}/receipts`,
      { params },
    );
    return (response.data as any).data || response.data;
  },

  // 退款處理
  async processRefund(data: {
    orderId: string;
    registerId: string;
    amount: number;
    reason: string;
    operatorId: number;
    notes?: string;
  }): Promise<any> {
    const response = await apiClient.post("/api/v1/pos/refunds/create", data);
    return (response.data as any).data || response.data;
  },

  // 促銷管理
  async getPromotions(): Promise<Promotion[]> {
    const response = await apiClient.get("/api/v1/pos/promotions");
    return (response.data as any).data || response.data;
  },

  async createPromotion(data: Omit<Promotion, "id">): Promise<Promotion> {
    const response = await apiClient.post("/api/v1/pos/promotions", data);
    return (response.data as any).data || response.data;
  },

  async updatePromotion(
    id: string,
    data: Partial<Promotion>,
  ): Promise<Promotion> {
    const response = await apiClient.put(`/api/v1/pos/promotions/${id}`, data);
    return (response.data as any).data || response.data;
  },

  async deletePromotion(id: string): Promise<void> {
    await apiClient.delete(`/api/v1/pos/promotions/${id}`);
  },

  // 統計和報表
  async getDailyStats(
    registerId: string,
    date?: string,
  ): Promise<{
    totalSales: number;
    totalOrders: number;
    totalRefunds: number;
    cashBalance: number;
    avgOrderValue: number;
  }> {
    const response = await apiClient.get(
      `/api/v1/pos/registers/${registerId}/stats/daily`,
      {
        params: { date },
      },
    );
    return (response.data as any).data || response.data;
  },

  async getShiftReport(shiftId: string): Promise<{
    shift: CashShift;
    sales: number;
    orders: number;
    refunds: number;
    cashMovements: CashMovement[];
    receipts: Receipt[];
  }> {
    const response = await apiClient.get(
      `/api/v1/pos/shifts/${shiftId}/report`,
    );
    return (response.data as any).data || response.data;
  },

  // 快速收銀
  async processQuickPayment(data: {
    orderId: string;
    registerId: string;
    amount: number;
    paymentMethod: string;
    operatorId: number;
  }): Promise<any> {
    const response = await apiClient.post("/api/v1/pos/quick-payment", data);
    return (response.data as any).data || response.data;
  },
};

export default posService;
