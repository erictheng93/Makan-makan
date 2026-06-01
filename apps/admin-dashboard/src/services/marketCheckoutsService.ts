import { api, unwrapApiPayload } from "@/services/api";

export type MarketCheckoutPaymentStatus =
  | "pending"
  | "partial_paid"
  | "paid"
  | "failed"
  | "refunded"
  | "partial_refunded";

export interface MarketCheckoutListItem {
  id: string;
  market: {
    id: string;
    slug: string;
    name: string;
  };
  status: "submitted";
  paymentStatus: MarketCheckoutPaymentStatus;
  subtotal: number;
  childOrderCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MarketCheckoutChildOrder {
  restaurantId: string;
  restaurantName: string;
  orderId: number;
  orderNumber: string;
  totalAmount: number;
  totalAmountCents?: number | null;
  tokenExpiresAt: string;
  status?: string;
  paymentStatus?: string;
  updatedAt?: number;
}

export interface MarketCheckoutDetail extends MarketCheckoutListItem {
  childOrders: MarketCheckoutChildOrder[];
  payment?: {
    status: MarketCheckoutPaymentStatus;
    method: string;
    currency: "TWD" | "MYR" | "VND";
    country: "TW" | "MY" | "VN";
    totalAmount: number;
    totalAmountCents: number;
    paidAmount: number;
    paidAmountCents: number;
    refundedAmount?: number;
    refundedAmountCents?: number;
    paidAt?: string;
    failedAt?: string;
    refundedAt?: string;
    childPayments: Array<{
      restaurantId: string;
      restaurantName: string;
      orderId: number;
      orderNumber: string;
      paymentId?: string;
      refundId?: string;
      status: "paid" | "failed" | "refunded";
      amount: number;
      amountCents: number;
      errorMessage?: string;
    }>;
  };
}

export interface MarketCheckoutListResult {
  checkouts: MarketCheckoutListItem[];
  total: number;
  page: number;
  limit: number;
}

export const marketCheckoutsService = {
  async list(
    input: {
      page?: number;
      limit?: number;
      marketSlug?: string;
      paymentStatus?: MarketCheckoutPaymentStatus | "";
    } = {},
  ): Promise<MarketCheckoutListResult> {
    const response = await api.get<MarketCheckoutListResult>(
      "/market-checkouts/admin",
      {
        page: input.page ?? 1,
        limit: input.limit ?? 20,
        marketSlug: input.marketSlug || undefined,
        paymentStatus: input.paymentStatus || undefined,
      },
    );
    return unwrapApiPayload<MarketCheckoutListResult>(response.data);
  },

  async get(id: string): Promise<MarketCheckoutDetail> {
    const response = await api.get<{ checkout: MarketCheckoutDetail }>(
      `/market-checkouts/admin/${id}`,
    );
    return unwrapApiPayload<{ checkout: MarketCheckoutDetail }>(response.data)
      .checkout;
  },

  async refund(id: string, reason?: string): Promise<MarketCheckoutDetail> {
    const response = await api.post<{ checkout: MarketCheckoutDetail }>(
      `/market-checkouts/${id}/refund`,
      { reason },
    );
    return unwrapApiPayload<{ checkout: MarketCheckoutDetail }>(response.data)
      .checkout;
  },
};
