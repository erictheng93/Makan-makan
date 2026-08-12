import { apiClient, unwrapApiData } from "./api";
import type { ApiResponse } from "@/types";

// 新模組化類型定義 - 對應 @makanmasak/queue-core 類型
export interface QueueItem {
  id: string;
  queueNumber: number;
  restaurantId: string;
  customerName: string | null;
  customerPhone?: string; // 修改欄位名稱
  customerEmail?: string;
  partySize: number;
  tablePreferences?: number[]; // 修改為 number 陣列
  specialRequests: string | null;
  priority: number;
  queueType: "walkin" | "online" | "phone"; // 新增類型
  status:
    | "waiting"
    | "called"
    | "notified"
    | "seated"
    | "no_show"
    | "cancelled"
    | "expired";
  joinedAt: string;
  calledAt: string | null;
  notifiedAt?: string;
  seatedAt: string | null;
  estimatedWaitMinutes: number; // 修改欄位名稱
  actualWaitMinutes: number | null; // 修改欄位名稱
  assignedTableId: number | null; // 修改為 number 類型
  servedBy?: number;
  notes: string | null;
  notificationMethods?: string[];
  checkInCode?: string;
  metadata?: Record<string, unknown>;
}

export interface QueueNotification {
  id: string;
  queueId: string;
  type: "sms" | "call" | "app_push";
  message: string;
  sentAt: string;
  status: "sent" | "delivered" | "failed";
}

export interface QueueSettings {
  restaurantId: string;
  isEnabled: boolean;
  maxQueueSize: number;
  avgServiceTime: number;
  maxWaitTime: number;
  minAdvanceNotice: number;
  notificationMethods: string[];
  autoCallEnabled: boolean;
  autoCallInterval: number;
  noShowTimeout: number;
  queueNumberReset: "daily" | "weekly" | "monthly" | "never";
  priorityRules: Record<string, unknown>;
  tableAssignmentRules: Record<string, unknown>;
  notificationTemplates: Record<string, string>;
  businessHours: Record<string, unknown>;
  holidaySettings: Record<string, unknown>;
  displaySettings: Record<string, unknown>;
  integrationSettings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface QueueStats {
  date: string;
  totalCustomers: number;
  averageWaitTime: number;
  maxWaitTime: number;
  noShowRate: number;
  peakHours: Array<{
    hour: number;
    count: number;
    avgWait: number;
  }>;
}

function toNullableIsoString(value: string | number | null | undefined) {
  if (value == null) return null;
  if (typeof value === "number") return new Date(value).toISOString();
  return value;
}

function mapQueueItem(entry: unknown): QueueItem {
  return {
    id: entry.id ?? entry.queueId,
    queueNumber: entry.queueNumber ?? 0,
    restaurantId: entry.restaurantId ?? "",
    customerName: entry.customerName ?? null,
    customerPhone: entry.customerPhone,
    customerEmail: entry.customerEmail,
    partySize: entry.partySize ?? 1,
    tablePreferences: entry.tablePreferences ?? [],
    specialRequests: entry.specialRequests ?? entry.notes ?? null,
    priority: entry.priority ?? 0,
    queueType: entry.queueType ?? "walkin",
    status: entry.status ?? "waiting",
    joinedAt:
      toNullableIsoString(entry.joinedAt ?? entry.createdAt) ??
      new Date(0).toISOString(),
    calledAt: toNullableIsoString(entry.calledAt),
    notifiedAt: toNullableIsoString(entry.notifiedAt) ?? undefined,
    seatedAt: toNullableIsoString(entry.seatedAt),
    estimatedWaitMinutes: entry.estimatedWaitMinutes ?? 0,
    actualWaitMinutes: entry.actualWaitMinutes ?? null,
    assignedTableId: entry.assignedTableId ?? entry.tableId ?? null,
    servedBy: entry.servedBy,
    notes: entry.notes ?? null,
    notificationMethods: entry.notificationMethods,
    checkInCode: entry.checkInCode,
    metadata: entry.metadata,
  };
}

function normalizeQueueStatus(data: unknown): {
  queue: unknown;
  activity: unknown;
  settings: QueueSettings;
} {
  return {
    queue: {
      total_waiting: data?.queue?.total_waiting ?? data?.totalWaiting ?? 0,
      avg_estimated_wait:
        data?.queue?.avg_estimated_wait ?? data?.averageWaitMinutes ?? 0,
      min_wait: data?.queue?.min_wait ?? 0,
      max_wait: data?.queue?.max_wait ?? 0,
      online_count: data?.queue?.online_count ?? 0,
      walkin_count: data?.queue?.walkin_count ?? 0,
      priority_count: data?.queue?.priority_count ?? 0,
      available_tables:
        data?.queue?.available_tables ?? data?.availableTables ?? 0,
      by_table_type: data?.queue?.by_table_type ?? data?.byTableType ?? [],
    },
    activity: data?.activity || {},
    settings: data?.settings || ({} as QueueSettings),
  };
}

// 新模組化候位管理服務
export const queueService = {
  // 排隊管理 - 使用新 API
  async getQueue(
    restaurantId: string,
    params?: {
      status?: QueueItem["status"];
      limit?: number;
    },
  ): Promise<QueueItem[]> {
    const response = await apiClient.get(`/queue/${restaurantId}/current`, {
      params,
    });
    const data = unwrapApiData<{ queue?: unknown[] }>(response);
    return (data?.queue || []).map(mapQueueItem);
  },

  async getQueueStatus(restaurantId: string): Promise<{
    queue: unknown;
    activity: unknown;
    settings: QueueSettings;
  }> {
    const response = await apiClient.get(`/queue/${restaurantId}/status`);
    return normalizeQueueStatus(unwrapApiData(response));
  },

  async joinQueue(data: {
    restaurantId: string;
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    partySize: number;
    specialRequests?: string;
    queueType?: "walkin" | "online" | "phone";
    tablePreferences?: number[];
    notificationMethods?: string[];
  }): Promise<
    ApiResponse<{
      queueId: string;
      queueNumber: number;
      estimatedWaitMinutes: number;
      currentPosition: number;
      checkInCode: string;
    }>
  > {
    const response = await apiClient.post<{
      queueId: string;
      queueNumber: number;
      estimatedWaitMinutes: number;
      currentPosition: number;
      checkInCode: string;
    }>("/queue/join", data);
    return response.data;
  },

  async getQueuePosition(queueId: string): Promise<
    ApiResponse<{
      queueId: string;
      queueNumber: number;
      currentPosition: number;
      estimatedWaitMinutes: number;
      status: string;
      canCancel: boolean;
    }>
  > {
    const response = await apiClient.get(`/queue/${queueId}/position`);
    return response.data as ApiResponse<{
      queueId: string;
      queueNumber: number;
      currentPosition: number;
      estimatedWaitMinutes: number;
      status: string;
      canCancel: boolean;
    }>;
  },

  // 取消候位 - 新模組化實現
  async cancelQueue(
    queueId: string,
    data: {
      reason?: string;
      checkInCode?: string;
    },
  ): Promise<ApiResponse<{}>> {
    const response = await apiClient.post(`/queue/${queueId}/cancel`, data);
    return response.data as ApiResponse<{}>;
  },

  // 叫號管理 - 使用新 API
  async callNext(
    restaurantId: string,
    data: {
      tableId?: number;
      specificQueueId?: string;
    },
  ): Promise<{
    success: boolean;
    data?: QueueItem;
    error?: string;
  }> {
    const response = await apiClient.post(
      `/queue/${restaurantId}/call-next`,
      data,
    );
    const payload = response.data as ApiResponse<unknown>;
    const error =
      typeof payload.error === "string"
        ? payload.error
        : payload.error?.message;

    return {
      success: payload.success,
      error,
      data: payload.data ? mapQueueItem(payload.data) : undefined,
    };
  },

  // 客戶入座 - 新模組化實現
  async seatCustomer(
    queueId: string,
    data: {
      tableId: number;
    },
  ): Promise<ApiResponse<{}>> {
    const response = await apiClient.post(`/queue/${queueId}/seat`, data);
    return response.data as ApiResponse<{}>;
  },

  // 設定管理 - 使用新 API
  async getSettings(restaurantId: string): Promise<ApiResponse<QueueSettings>> {
    const response = await apiClient.get(`/queue/${restaurantId}/settings`);
    return response.data as ApiResponse<QueueSettings>;
  },

  async updateSettings(
    restaurantId: string,
    data: Partial<QueueSettings>,
  ): Promise<ApiResponse<{}>> {
    const response = await apiClient.put(
      `/queue/${restaurantId}/settings`,
      data,
    );
    return response.data as ApiResponse<{}>;
  },

  // 統計和分析 - 暫時保留舊 API 直到新統計端點實現
  async getDailyStats(
    restaurantId: string,
    date?: string,
  ): Promise<QueueStats> {
    const response = await apiClient.get(`/queue/${restaurantId}/stats`, {
      params: { dateFrom: date, dateTo: date },
    });
    return unwrapApiData<QueueStats>(response);
  },

  // 即時狀態 - 使用新 API
  async getRealtimeStatus(restaurantId: string): Promise<{
    queue: {
      total_waiting: number;
      avg_estimated_wait: number;
      min_wait: number;
      max_wait: number;
      online_count: number;
      walkin_count: number;
      priority_count: number;
    };
    activity: {
      seated_today: number;
      cancelled_today: number;
      no_show_today: number;
      avg_actual_wait: number;
    };
    settings: QueueSettings;
  }> {
    const response = await apiClient.get(`/queue/${restaurantId}/status`);
    const data = normalizeQueueStatus(unwrapApiData(response));
    return {
      queue: data.queue || {
        total_waiting: 0,
        avg_estimated_wait: 0,
        min_wait: 0,
        max_wait: 0,
        online_count: 0,
        walkin_count: 0,
        priority_count: 0,
      },
      activity: data.activity || {
        seated_today: 0,
        cancelled_today: 0,
        no_show_today: 0,
        avg_actual_wait: 0,
      },
      settings: data.settings || ({} as QueueSettings),
    };
  },

  // 預測和智能功能 - 暫時保留舊端點，等待新實現
  async getWaitTimeEstimate(
    restaurantId: string,
    partySize: number,
  ): Promise<{
    estimatedWaitTime: number;
    confidence: number;
    factors: Array<{
      factor: string;
      impact: number;
      description: string;
    }>;
  }> {
    // 使用新的狀態端點獲取預估時間
    const status = await this.getRealtimeStatus(restaurantId);
    const avgWait = status.queue?.avg_estimated_wait || 30;

    // 簡化的預估邏輯，待後續增強
    const estimate = Math.max(avgWait * (partySize > 4 ? 1.2 : 1), 5);

    return {
      estimatedWaitTime: Math.round(estimate),
      confidence: 0.75,
      factors: [
        {
          factor: "當前候位人數",
          impact: status.queue?.total_waiting || 0,
          description: "目前排隊等候的客戶數量",
        },
        {
          factor: "聚餐人數",
          impact: partySize,
          description: "較大聚餐需要更長準備時間",
        },
      ],
    };
  },

  async getCapacityForecast(
    _restaurantId: string,
    _date: string,
  ): Promise<{
    hourlyForecast: Array<{
      hour: number;
      expectedCustomers: number;
      suggestedStaffing: number;
      averageWaitTime: number;
    }>;
    peakHours: number[];
    recommendations: string[];
  }> {
    // TODO: Implement when capacity forecast API is available
    return {
      hourlyForecast: [],
      peakHours: [],
      recommendations: [],
    };
  },

  // Performance optimization methods
  async getPerformanceMetrics(): Promise<
    ApiResponse<{
      cacheStats: {
        totalEntries: number;
        validEntries: number;
        expiredEntries: number;
        hitRate: number;
        memoryUsage: number;
      };
      lastUpdated: string;
    }>
  > {
    const response = await apiClient.get("/queue/performance");
    return response.data as ApiResponse<{
      cacheStats: {
        totalEntries: number;
        validEntries: number;
        expiredEntries: number;
        hitRate: number;
        memoryUsage: number;
      };
      lastUpdated: string;
    }>;
  },

  async optimizeQueue(restaurantId: string): Promise<
    ApiResponse<{
      message: string;
      timestamp: string;
    }>
  > {
    const response = await apiClient.post(`/queue/${restaurantId}/optimize`);
    return response.data as ApiResponse<{
      message: string;
      timestamp: string;
    }>;
  },
};

export default queueService;
