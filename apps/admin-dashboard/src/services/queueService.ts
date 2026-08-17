import { apiClient, unwrapApiData } from "./api";
import type { ApiResponse } from "@/types";

type QueueRecord = Record<string, unknown>;
type QueueStatus = {
  queue: {
    total_waiting: number;
    avg_estimated_wait: number;
    min_wait: number;
    max_wait: number;
    online_count: number;
    walkin_count: number;
    priority_count: number;
    available_tables: number;
    by_table_type: unknown[];
  };
  activity: {
    seated_today: number;
    cancelled_today: number;
    no_show_today: number;
    avg_actual_wait: number;
  };
  settings: QueueSettings;
};

const isRecord = (value: unknown): value is QueueRecord =>
  typeof value === "object" && value !== null;
const asString = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;
const asNumber = (value: unknown, fallback = 0): number =>
  typeof value === "number" ? value : fallback;
const asOptionalNumber = (value: unknown): number | undefined =>
  typeof value === "number" ? value : undefined;
const asStringArray = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : undefined;
const asNumberArray = (value: unknown): number[] | undefined =>
  Array.isArray(value) && value.every((item) => typeof item === "number")
    ? value
    : undefined;

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

function toNullableIsoString(value: unknown) {
  if (value == null) return null;
  if (typeof value === "number") return new Date(value).toISOString();
  return typeof value === "string" ? value : null;
}

function mapQueueItem(entry: QueueRecord): QueueItem {
  return {
    id: asString(entry.id ?? entry.queueId),
    queueNumber: asNumber(entry.queueNumber),
    restaurantId: asString(entry.restaurantId),
    customerName:
      typeof entry.customerName === "string" ? entry.customerName : null,
    customerPhone: asString(entry.customerPhone) || undefined,
    customerEmail: asString(entry.customerEmail) || undefined,
    partySize: asNumber(entry.partySize, 1),
    tablePreferences: asNumberArray(entry.tablePreferences),
    specialRequests:
      typeof entry.specialRequests === "string"
        ? entry.specialRequests
        : typeof entry.notes === "string"
          ? entry.notes
          : null,
    priority: asNumber(entry.priority),
    queueType:
      entry.queueType === "online" || entry.queueType === "phone"
        ? entry.queueType
        : "walkin",
    status:
      entry.status === "called" ||
      entry.status === "notified" ||
      entry.status === "seated" ||
      entry.status === "no_show" ||
      entry.status === "cancelled" ||
      entry.status === "expired"
        ? entry.status
        : "waiting",
    joinedAt:
      toNullableIsoString(entry.joinedAt ?? entry.createdAt) ??
      new Date(0).toISOString(),
    calledAt: toNullableIsoString(entry.calledAt),
    notifiedAt: toNullableIsoString(entry.notifiedAt) ?? undefined,
    seatedAt: toNullableIsoString(entry.seatedAt),
    estimatedWaitMinutes: asNumber(entry.estimatedWaitMinutes),
    actualWaitMinutes: asOptionalNumber(entry.actualWaitMinutes) ?? null,
    assignedTableId:
      asOptionalNumber(entry.assignedTableId) ??
      asOptionalNumber(entry.tableId) ??
      null,
    servedBy: asOptionalNumber(entry.servedBy),
    notes: typeof entry.notes === "string" ? entry.notes : null,
    notificationMethods: asStringArray(entry.notificationMethods),
    checkInCode: asString(entry.checkInCode) || undefined,
    metadata: isRecord(entry.metadata) ? entry.metadata : undefined,
  };
}

function normalizeQueueStatus(data: unknown): QueueStatus {
  const payload = isRecord(data) ? data : {};
  const queue = isRecord(payload.queue) ? payload.queue : {};
  const activity = isRecord(payload.activity) ? payload.activity : {};
  return {
    queue: {
      total_waiting: asNumber(queue.total_waiting ?? payload.totalWaiting),
      avg_estimated_wait: asNumber(
        queue.avg_estimated_wait ?? payload.averageWaitMinutes,
      ),
      min_wait: asNumber(queue.min_wait),
      max_wait: asNumber(queue.max_wait),
      online_count: asNumber(queue.online_count),
      walkin_count: asNumber(queue.walkin_count),
      priority_count: asNumber(queue.priority_count),
      available_tables: asNumber(
        queue.available_tables ?? payload.availableTables,
      ),
      by_table_type: Array.isArray(queue.by_table_type)
        ? queue.by_table_type
        : Array.isArray(payload.byTableType)
          ? payload.byTableType
          : [],
    },
    activity: {
      seated_today: asNumber(activity.seated_today),
      cancelled_today: asNumber(activity.cancelled_today),
      no_show_today: asNumber(activity.no_show_today),
      avg_actual_wait: asNumber(activity.avg_actual_wait),
    },
    settings: (isRecord(payload.settings)
      ? payload.settings
      : {}) as unknown as QueueSettings,
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
    return (data?.queue || []).filter(isRecord).map(mapQueueItem);
  },

  async getQueueStatus(restaurantId: string): Promise<{
    queue: QueueStatus["queue"];
    activity: QueueStatus["activity"];
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
      data: isRecord(payload.data) ? mapQueueItem(payload.data) : undefined,
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
