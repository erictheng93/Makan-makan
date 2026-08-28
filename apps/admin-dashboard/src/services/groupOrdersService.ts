import { apiClient, unwrapApiData } from "./api";
import type { GroupOrderFinalizeFailure } from "@makanmasak/shared-types";

// 型別定義
export interface GroupOrderMember {
  id: string;
  groupOrderId: string;
  name: string;
  itemCount: number;
  totalAmount: number;
  paymentStatus:
    | "unpaid"
    | "pending"
    | "paid"
    | "processing"
    | "failed"
    | "refunded";
  paidAmount?: number;
  settledBy?: "self" | "staff" | "provider" | null;
  revenueRecognised?: boolean;
  joinedAt: string;
}

export type RecoveryErrorDetails = NonNullable<
  GroupOrderFinalizeFailure["recoveryErrorDetails"]
>[number];

export interface RecoverFinalizationResponse {
  masterOrderId: string;
  status: "checkout";
}

export interface RecoverFinalizationOptions {
  bearerMemberId?: string;
}

export interface GroupOrder {
  id: string;
  shareCode: string;
  masterOrderId: string | null;
  tableNumber: string | null;
  status:
    | "active"
    | "finalizing"
    | "finalizing_failed"
    | "checkout"
    | "completed"
    | "cancelled";
  finalizeFailure?: Pick<
    GroupOrderFinalizeFailure,
    | "code"
    | "splitError"
    | "failedAt"
    | "expectedTotalCents"
    | "roundedTotalCents"
    | "recoveryErrorDetails"
  >;
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

/**
 * What POST /orders/group/create actually answers. This was declared as
 * `GroupOrder`, which is a different shape entirely: the key is `groupOrderId`,
 * not `id`, and the two host credentials were absent from the type even though
 * the server returns them.
 *
 * `recoveryCode` is the only way to hand host control to a diner
 * (POST /orders/group/:groupOrderId/recover). A staff-created group whose
 * recovery code is discarded has no reachable host, so nobody can press submit
 * or choose what happens at expiry -- both are host-only decisions by design.
 */
export interface CreateGroupOrderResult {
  groupOrderId: string;
  shareCode: string;
  expiresAt: string;
  host: GroupOrderMember;
  memberToken: string;
  recoveryCode: string;
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
  }): Promise<CreateGroupOrderResult> {
    const response = await apiClient.post("/orders/group/create", data);
    return unwrapApiData<CreateGroupOrderResult>(response);
  },

  async getGroupOrder(shareCode: string): Promise<GroupOrder> {
    const response = await apiClient.get(`/orders/group/${shareCode}`);
    return unwrapApiData<GroupOrder>(response);
  },

  async recoverFinalization(
    groupOrderId: string,
    options: RecoverFinalizationOptions = {},
  ): Promise<RecoverFinalizationResponse> {
    const response = await apiClient.post(
      `/orders/group/${groupOrderId}/finalize/recover`,
      options,
    );
    return unwrapApiData<RecoverFinalizationResponse>(response);
  },

  async finalizeAsStaff(groupOrderId: string): Promise<{
    masterOrderId: string;
    status: "completed";
  }> {
    const response = await apiClient.post(
      `/orders/group/${groupOrderId}/finalize/staff`,
    );
    return unwrapApiData<{ masterOrderId: string; status: "completed" }>(
      response,
    );
  },

  // 分享功能
  async generateShareCode(restaurantId: string): Promise<{
    shareCode: string;
    shareUrl: string;
    expiresAt: string;
    recoveryCode: string;
  }> {
    const response = await apiClient.post("/orders/group/generate-code", {
      restaurantId,
    });
    return unwrapApiData<{
      shareCode: string;
      shareUrl: string;
      expiresAt: string;
      recoveryCode: string;
    }>(response);
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
};

export default groupOrdersService;
