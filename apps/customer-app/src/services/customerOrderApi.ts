import { apiClient } from "./api";
import { customerIdentityApi } from "./customerIdentityApi";
import type { Order, OrderStatus } from "@makanmakan/shared-types";

export interface CustomerOrdersResponse {
  orders: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CustomerOrdersParams {
  page?: number;
  limit?: number;
  status?: OrderStatus | OrderStatus[];
  dateFrom?: string;
  dateTo?: string;
}

export const customerOrderApi = {
  /**
   * 獲取當前客戶的訂單歷史
   */
  async getMyOrders(
    params?: CustomerOrdersParams,
  ): Promise<CustomerOrdersResponse> {
    const queryParams = new URLSearchParams();

    if (params?.page) {
      queryParams.append("page", params.page.toString());
    }
    if (params?.limit) {
      queryParams.append("limit", params.limit.toString());
    }
    if (params?.status) {
      if (Array.isArray(params.status)) {
        params.status.forEach((s) => queryParams.append("status", String(s)));
      } else {
        queryParams.append("status", String(params.status));
      }
    }
    if (params?.dateFrom) {
      queryParams.append("dateFrom", params.dateFrom);
    }
    if (params?.dateTo) {
      queryParams.append("dateTo", params.dateTo);
    }

    const queryString = queryParams.toString();
    const url = `/customers/me/orders${queryString ? `?${queryString}` : ""}`;

    const response = await apiClient.get<CustomerOrdersResponse>(url);
    return response;
  },

  /**
   * 獲取訂單詳情
   */
  async getOrderDetail(orderId: string): Promise<Order> {
    const response = await apiClient.get<Order>(`/orders/${orderId}`);
    return response;
  },

  /**
   * 取消訂單
   */
  async cancelOrder(orderId: string, reason?: string): Promise<Order> {
    const url = `/orders/${orderId}${reason ? `?reason=${encodeURIComponent(reason)}` : ""}`;
    const response = await apiClient.delete<Order>(url);
    return response;
  },

  /**
   * 獲取訂單收據
   */
  async getOrderReceipt(orderId: string): Promise<{
    orderNumber: string;
    restaurantInfo: {
      id: number;
      name: string;
      address?: string;
      phone?: string;
      email?: string;
    };
    customerInfo: any;
    tableInfo?: {
      id: number;
      number: string;
      seats: number;
    };
    items: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      customizations?: string[];
      notes?: string;
    }>;
    summary: {
      subtotal: number;
      tax: number;
      serviceCharge: number;
      discount: number;
      total: number;
    };
    paymentInfo: {
      method: string;
      status: string;
      paidAt?: Date;
    };
    timestamps: {
      orderedAt: Date;
      confirmedAt?: Date;
      readyAt?: Date;
      deliveredAt?: Date;
    };
  }> {
    const response = await apiClient.get(`/orders/${orderId}/receipt`);
    return response;
  },

  /**
   * 獲取客戶個人資料
   */
  async getMyProfile(): Promise<{
    id: string;
    username: string;
    fullName: string;
    email?: string;
    phone?: string;
    role: number;
  }> {
    const response = await customerIdentityApi.getMe();
    return {
      id: response.customer.id,
      username:
        response.customer.primaryPhone ||
        response.customer.primaryEmail ||
        response.customer.id,
      fullName: response.customer.displayName,
      email: response.customer.primaryEmail || undefined,
      phone: response.customer.primaryPhone || undefined,
      role: 5,
    };
  },
};

export default customerOrderApi;
