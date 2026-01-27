import { apiClient } from "./api";
import type { ApiResponse } from "@/types";

// 新模組化類型定義 - 對應 @makanmakan/queue-core 類型
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
  queueType: 'walkin' | 'online' | 'phone'; // 新增類型
  status: "waiting" | "called" | "notified" | "seated" | "no_show" | "cancelled" | "expired";
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
  metadata?: Record<string, any>;
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
  queueNumberReset: 'daily' | 'weekly' | 'monthly' | 'never';
  priorityRules: Record<string, any>;
  tableAssignmentRules: Record<string, any>;
  notificationTemplates: Record<string, string>;
  businessHours: Record<string, any>;
  holidaySettings: Record<string, any>;
  displaySettings: Record<string, any>;
  integrationSettings: Record<string, any>;
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
    const response = await apiClient.get(`/api/v1/queue/${restaurantId}/current`, {
      params,
    });
    return (response.data as any)?.data?.queue || [];
  },

  async getQueueStatus(
    restaurantId: string
  ): Promise<{
    queue: any;
    activity: any;
    settings: QueueSettings;
  }> {
    const response = await apiClient.get(`/api/v1/queue/${restaurantId}/status`);
    const data = (response.data as any)?.data;
    return {
      queue: data?.queue || {},
      activity: data?.activity || {},
      settings: data?.settings || {} as QueueSettings
    };
  },

  async joinQueue(data: {
    restaurantId: string;
    customerName: string;
    customerPhone?: string;
    customerEmail?: string;
    partySize: number;
    specialRequests?: string;
    queueType?: 'walkin' | 'online' | 'phone';
    tablePreferences?: number[];
    notificationMethods?: string[];
  }): Promise<ApiResponse<{
    queueId: string;
    queueNumber: number;
    estimatedWaitMinutes: number;
    currentPosition: number;
    checkInCode: string;
  }>> {
    const response = await apiClient.post<{
      queueId: string;
      queueNumber: number;
      estimatedWaitMinutes: number;
      currentPosition: number;
      checkInCode: string;
    }>("/api/v1/queue/join", data);
    return response.data;
  },

  async getQueuePosition(queueId: string): Promise<ApiResponse<{
    queueId: string;
    queueNumber: number;
    currentPosition: number;
    estimatedWaitMinutes: number;
    status: string;
    canCancel: boolean;
  }>> {
    const response = await apiClient.get(`/api/v1/queue/${queueId}/position`);
    return response.data as any;
  },

  // 取消候位 - 新模組化實現
  async cancelQueue(
    queueId: string,
    data: {
      reason?: string;
      checkInCode?: string;
    },
  ): Promise<ApiResponse<{}>> {
    const response = await apiClient.post(`/api/v1/queue/${queueId}/cancel`, data);
    return response.data as any;
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
      "/api/v1/queue/call-next",
      {
        restaurantId,
        ...data
      }
    );
    return response.data as any;
  },

  // 客戶入座 - 新模組化實現
  async seatCustomer(
    queueId: string,
    data: {
      tableId: number;
    },
  ): Promise<ApiResponse<{}>> {
    const response = await apiClient.post(`/api/v1/queue/${queueId}/seat`, data);
    return response.data as any;
  },




  // 設定管理 - 使用新 API
  async getSettings(restaurantId: string): Promise<ApiResponse<QueueSettings>> {
    const response = await apiClient.get(
      `/api/v1/queue/${restaurantId}/settings`,
    );
    return response.data as any;
  },

  async updateSettings(
    restaurantId: string,
    data: Partial<QueueSettings>,
  ): Promise<ApiResponse<{}>> {
    const response = await apiClient.put(
      `/api/v1/queue/${restaurantId}/settings`,
      data,
    );
    return response.data as any;
  },


  // 統計和分析 - 暫時保留舊 API 直到新統計端點實現
  async getDailyStats(
    restaurantId: string,
    date?: string,
  ): Promise<QueueStats> {
    const response = await apiClient.get(
      `/api/v1/queue/${restaurantId}/stats`,
      {
        params: { dateFrom: date, dateTo: date },
      },
    );
    return (response.data as any).data || response.data;
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
    const response = await apiClient.get(
      `/api/v1/queue/${restaurantId}/status`,
    );
    const data = (response.data as any)?.data;
    return {
      queue: data?.queue || {
        total_waiting: 0,
        avg_estimated_wait: 0,
        min_wait: 0,
        max_wait: 0,
        online_count: 0,
        walkin_count: 0,
        priority_count: 0
      },
      activity: data?.activity || {
        seated_today: 0,
        cancelled_today: 0,
        no_show_today: 0,
        avg_actual_wait: 0
      },
      settings: data?.settings || {} as QueueSettings
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
          description: "目前排隊等候的客戶數量"
        },
        {
          factor: "聚餐人數",
          impact: partySize,
          description: "較大聚餐需要更長準備時間"
        }
      ]
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
    // 暫時返回模擬數據，等待新 API 實現
    return {
      hourlyForecast: [],
      peakHours: [12, 13, 18, 19, 20],
      recommendations: [
        "建議在用餐尖峰時段增加服務人員",
        "考慮實施預約制度以平衡客流"
      ]
    };
  },

  // Performance optimization methods
  async getPerformanceMetrics(): Promise<ApiResponse<{
    cacheStats: {
      totalEntries: number;
      validEntries: number;
      expiredEntries: number;
      hitRate: number;
      memoryUsage: number;
    };
    lastUpdated: string;
  }>> {
    const response = await apiClient.get('/api/v1/queue/performance');
    return response.data as any;
  },

  async optimizeQueue(restaurantId: string): Promise<ApiResponse<{
    message: string;
    timestamp: string;
  }>> {
    const response = await apiClient.post(`/api/v1/queue/${restaurantId}/optimize`);
    return response.data as any;
  },
};

export default queueService;
