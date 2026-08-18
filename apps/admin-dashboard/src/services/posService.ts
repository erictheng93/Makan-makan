import { apiClient, unwrapApiData } from "./api";

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
  items: Array<Record<string, unknown>>;
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

export type MarketCheckoutPosPaymentMethod = "cash" | "card" | "digital_wallet";

export interface MarketCheckoutPosPaymentResult {
  checkout: {
    id: string;
    paymentStatus?: string;
  };
  payment: {
    status: string;
    method: string;
    totalAmountCents: number;
    paidAmountCents?: number;
  };
}

// 現金櫃管理
export const posService = {
  // 現金櫃
  async getRegisters(): Promise<CashRegister[]> {
    const response = await apiClient.get("/pos/registers");
    return unwrapApiData<CashRegister[]>(response);
  },

  async createRegister(
    data: Omit<CashRegister, "id" | "createdAt" | "updatedAt">,
  ): Promise<CashRegister> {
    const response = await apiClient.post("/pos/registers", data);
    return unwrapApiData<CashRegister>(response);
  },

  async updateRegister(
    id: string,
    data: Partial<CashRegister>,
  ): Promise<CashRegister> {
    const response = await apiClient.put(`/pos/registers/${id}`, data);
    return unwrapApiData<CashRegister>(response);
  },

  async activateRegister(id: string): Promise<void> {
    await apiClient.post(`/pos/registers/${id}/activate`);
  },

  async deactivateRegister(id: string): Promise<void> {
    await apiClient.post(`/pos/registers/${id}/deactivate`);
  },

  // 班次管理
  async startShift(data: {
    registerId: string;
    startingCash: number;
    operatorId: number;
  }): Promise<CashShift> {
    const response = await apiClient.post("/pos/shifts/start", data);
    return unwrapApiData<CashShift>(response);
  },

  async endShift(
    shiftId: string,
    data: {
      endingCash: number;
      notes?: string;
    },
  ): Promise<CashShift> {
    const response = await apiClient.post(`/pos/shifts/${shiftId}/end`, data);
    return unwrapApiData<CashShift>(response);
  },

  async getCurrentShift(registerId: string): Promise<CashShift | null> {
    try {
      const response = await apiClient.get(
        `/pos/registers/${registerId}/current-shift`,
      );
      return unwrapApiData<CashShift | null>(response);
    } catch {
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
    const response = await apiClient.post("/pos/cash-movements", data);
    return unwrapApiData<CashMovement>(response);
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
      `/pos/registers/${registerId}/cash-movements`,
      { params },
    );
    return unwrapApiData<CashMovement[]>(response);
  },

  // 收據管理
  async printReceipt(data: {
    orderId: string;
    registerId: string;
    items: Array<Record<string, unknown>>;
    totalAmount: number;
    paymentMethod: string;
  }): Promise<Receipt> {
    const response = await apiClient.post("/pos/receipts/print", data);
    return unwrapApiData<Receipt>(response);
  },

  async getReceipts(
    registerId: string,
    params?: {
      startDate?: string;
      endDate?: string;
    },
  ): Promise<Receipt[]> {
    const response = await apiClient.get(
      `/pos/registers/${registerId}/receipts`,
      { params },
    );
    return unwrapApiData<Receipt[]>(response);
  },

  // 退款處理
  async processRefund(data: {
    orderId: string;
    registerId: string;
    amount: number;
    reason: string;
    operatorId: number;
    notes?: string;
  }): Promise<unknown> {
    const response = await apiClient.post("/pos/refunds/create", data);
    return unwrapApiData<unknown>(response);
  },

  // 促銷管理
  async getPromotions(): Promise<Promotion[]> {
    const response = await apiClient.get("/pos/promotions");
    return unwrapApiData<Promotion[]>(response);
  },

  async createPromotion(data: Omit<Promotion, "id">): Promise<Promotion> {
    const response = await apiClient.post("/pos/promotions", data);
    return unwrapApiData<Promotion>(response);
  },

  async updatePromotion(
    id: string,
    data: Partial<Promotion>,
  ): Promise<Promotion> {
    const response = await apiClient.put(`/pos/promotions/${id}`, data);
    return unwrapApiData<Promotion>(response);
  },

  async deletePromotion(id: string): Promise<void> {
    await apiClient.delete(`/pos/promotions/${id}`);
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
      `/pos/registers/${registerId}/stats/daily`,
      {
        params: { date },
      },
    );
    return unwrapApiData<{
      totalSales: number;
      totalOrders: number;
      totalRefunds: number;
      cashBalance: number;
      avgOrderValue: number;
    }>(response);
  },

  async getShiftReport(shiftId: string): Promise<{
    shift: CashShift;
    sales: number;
    orders: number;
    refunds: number;
    cashMovements: CashMovement[];
    receipts: Receipt[];
  }> {
    const response = await apiClient.get(`/pos/shifts/${shiftId}/report`);
    return unwrapApiData<{
      shift: CashShift;
      sales: number;
      orders: number;
      refunds: number;
      cashMovements: CashMovement[];
      receipts: Receipt[];
    }>(response);
  },

  // 快速收銀
  async processQuickPayment(data: {
    orderId: string;
    registerId: string;
    amount: number;
    paymentMethod: string;
    operatorId: number;
  }): Promise<unknown> {
    const response = await apiClient.post("/pos/quick-payment", data);
    return unwrapApiData<unknown>(response);
  },

  async payMarketCheckout(data: {
    checkoutId: string;
    registerId: string;
    shiftId?: string;
    paymentMethod: MarketCheckoutPosPaymentMethod;
  }): Promise<MarketCheckoutPosPaymentResult> {
    const { checkoutId, ...body } = data;
    const response = await apiClient.post(
      `/pos/market-checkouts/${checkoutId}/pay`,
      body,
    );
    return unwrapApiData<MarketCheckoutPosPaymentResult>(response);
  },
};

export default posService;
