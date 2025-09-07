import { apiClient } from "./api";

// 型別定義
export interface QueueItem {
  id: string;
  queueNumber: number;
  restaurantId: string;
  customerName: string | null;
  phoneNumber: string;
  partySize: number;
  tablePreference: string | null;
  specialRequests: string | null;
  priority: number;
  status: "waiting" | "called" | "seated" | "no_show" | "cancelled";
  joinedAt: string;
  calledAt: string | null;
  seatedAt: string | null;
  estimatedWaitTime: number;
  actualWaitTime: number | null;
  tableId: string | null;
  notes: string | null;
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
  id: string;
  restaurantId: string;
  maxWaitTime: number;
  notificationIntervals: number[];
  autoCallNext: boolean;
  requirePhoneNumber: boolean;
  allowOnlineJoin: boolean;
  estimationAlgorithm: "simple" | "ml_based";
  operatingHours: {
    start: string;
    end: string;
    days: number[];
  };
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

// 候位管理服務
export const queueService = {
  // 排隊管理
  async getQueue(
    restaurantId: string,
    params?: {
      status?: QueueItem["status"];
      date?: string;
    },
  ): Promise<QueueItem[]> {
    const response = await apiClient.get(`/api/v1/queue/${restaurantId}`, {
      params,
    });
    return (response.data as any).data || response.data;
  },

  async joinQueue(data: {
    restaurantId: string;
    customerName?: string;
    phoneNumber: string;
    partySize: number;
    tablePreference?: string;
    specialRequests?: string;
  }): Promise<{
    success: boolean;
    queueItem: QueueItem;
    estimatedWaitTime: number;
  }> {
    const response = await apiClient.post("/api/v1/queue/join", data);
    return (response.data as any).data || response.data;
  },

  async getQueuePosition(queueId: string): Promise<{
    position: number;
    estimatedWaitTime: number;
    totalWaiting: number;
  }> {
    const response = await apiClient.get(`/api/v1/queue/${queueId}/position`);
    return (response.data as any).data || response.data;
  },

  async updateQueueItem(
    queueId: string,
    data: Partial<QueueItem>,
  ): Promise<QueueItem> {
    const response = await apiClient.put(`/api/v1/queue/${queueId}`, data);
    return (response.data as any).data || response.data;
  },

  // 叫號管理
  async callNext(
    restaurantId: string,
    data: {
      operatorId: number;
      skipToNumber?: number;
    },
  ): Promise<{
    success: boolean;
    calledCustomer: QueueItem | null;
    message: string;
  }> {
    const response = await apiClient.post(
      `/api/v1/queue/${restaurantId}/call-next`,
      data,
    );
    return (response.data as any).data || response.data;
  },

  async callCustomer(
    queueId: string,
    data: {
      operatorId: number;
      notificationMethod?: "sms" | "call" | "app_push";
    },
  ): Promise<QueueItem> {
    const response = await apiClient.post(
      `/api/v1/queue/${queueId}/call`,
      data,
    );
    return (response.data as any).data || response.data;
  },

  async markNoShow(queueId: string, operatorId: number): Promise<QueueItem> {
    const response = await apiClient.post(`/api/v1/queue/${queueId}/no-show`, {
      operatorId,
    });
    return (response.data as any).data || response.data;
  },

  // 座位安排
  async seatCustomer(
    queueId: string,
    data: {
      tableId: string;
      operatorId: number;
      notes?: string;
    },
  ): Promise<{
    success: boolean;
    queueItem: QueueItem;
    tableAssignment: any;
  }> {
    const response = await apiClient.post(
      `/api/v1/queue/${queueId}/seat`,
      data,
    );
    return (response.data as any).data || response.data;
  },

  async getRecommendedTables(queueId: string): Promise<
    Array<{
      tableId: string;
      tableNumber: string;
      capacity: number;
      status: string;
      matchScore: number;
      reasons: string[];
    }>
  > {
    const response = await apiClient.get(
      `/api/v1/queue/${queueId}/recommended-tables`,
    );
    return (response.data as any).data || response.data;
  },

  // 取消和修改
  async cancelQueue(
    queueId: string,
    data: {
      reason?: string;
      operatorId?: number;
    },
  ): Promise<QueueItem> {
    const response = await apiClient.post(
      `/api/v1/queue/${queueId}/cancel`,
      data,
    );
    return (response.data as any).data || response.data;
  },

  async rescheduleQueue(
    queueId: string,
    data: {
      newDateTime: string;
      reason?: string;
    },
  ): Promise<QueueItem> {
    const response = await apiClient.post(
      `/api/v1/queue/${queueId}/reschedule`,
      data,
    );
    return (response.data as any).data || response.data;
  },

  // 通知管理
  async sendNotification(
    queueId: string,
    data: {
      type: "sms" | "call" | "app_push";
      message: string;
      operatorId: number;
    },
  ): Promise<QueueNotification> {
    const response = await apiClient.post(
      `/api/v1/queue/${queueId}/notify`,
      data,
    );
    return (response.data as any).data || response.data;
  },

  async getNotifications(queueId: string): Promise<QueueNotification[]> {
    const response = await apiClient.get(
      `/api/v1/queue/${queueId}/notifications`,
    );
    return (response.data as any).data || response.data;
  },

  async sendBulkNotification(
    restaurantId: string,
    data: {
      queueIds: string[];
      type: "sms" | "call" | "app_push";
      message: string;
      operatorId: number;
    },
  ): Promise<{
    success: number;
    failed: number;
    results: QueueNotification[];
  }> {
    const response = await apiClient.post(
      `/api/v1/queue/${restaurantId}/bulk-notify`,
      data,
    );
    return (response.data as any).data || response.data;
  },

  // 設定管理
  async getSettings(restaurantId: string): Promise<QueueSettings> {
    const response = await apiClient.get(
      `/api/v1/queue/${restaurantId}/settings`,
    );
    return (response.data as any).data || response.data;
  },

  async updateSettings(
    restaurantId: string,
    data: Partial<QueueSettings>,
  ): Promise<QueueSettings> {
    const response = await apiClient.put(
      `/api/v1/queue/${restaurantId}/settings`,
      data,
    );
    return (response.data as any).data || response.data;
  },

  // 顯示管理
  async getDisplayData(restaurantId: string): Promise<{
    currentNumber: number;
    calledNumbers: number[];
    waitingCount: number;
    averageWaitTime: number;
    announcements: Array<{
      message: string;
      type: "info" | "warning";
      priority: number;
    }>;
  }> {
    const response = await apiClient.get(
      `/api/v1/queue/${restaurantId}/display`,
    );
    return (response.data as any).data || response.data;
  },

  async updateDisplay(
    restaurantId: string,
    data: {
      currentNumber?: number;
      announcements?: Array<{
        message: string;
        type: "info" | "warning";
        priority: number;
      }>;
    },
  ): Promise<void> {
    await apiClient.put(`/api/v1/queue/${restaurantId}/display`, data);
  },

  // 統計和分析
  async getDailyStats(
    restaurantId: string,
    date?: string,
  ): Promise<QueueStats> {
    const response = await apiClient.get(
      `/api/v1/queue/${restaurantId}/stats/daily`,
      {
        params: { date },
      },
    );
    return (response.data as any).data || response.data;
  },

  async getWeeklyStats(
    restaurantId: string,
    startDate?: string,
  ): Promise<QueueStats[]> {
    const response = await apiClient.get(
      `/api/v1/queue/${restaurantId}/stats/weekly`,
      {
        params: { startDate },
      },
    );
    return (response.data as any).data || response.data;
  },

  async getWaitTimeAnalysis(
    restaurantId: string,
    params?: {
      startDate?: string;
      endDate?: string;
    },
  ): Promise<{
    averageWaitTime: number;
    medianWaitTime: number;
    peakWaitTime: number;
    waitTimeDistribution: Array<{
      range: string;
      count: number;
      percentage: number;
    }>;
  }> {
    const response = await apiClient.get(
      `/api/v1/queue/${restaurantId}/stats/wait-time`,
      { params },
    );
    return (response.data as any).data || response.data;
  },

  // 即時狀態
  async getRealtimeStatus(restaurantId: string): Promise<{
    currentWaiting: number;
    totalServedToday: number;
    averageWaitTime: number;
    longestWait: number;
    recentActivity: Array<{
      type: "joined" | "called" | "seated" | "no_show";
      queueNumber: number;
      timestamp: string;
      customerName?: string;
    }>;
  }> {
    const response = await apiClient.get(
      `/api/v1/queue/${restaurantId}/status`,
    );
    return (response.data as any).data || response.data;
  },

  // 匯出功能
  async exportQueue(
    restaurantId: string,
    params: {
      startDate?: string;
      endDate?: string;
      status?: QueueItem["status"];
      format: "csv" | "excel";
    },
  ): Promise<Blob> {
    const response = await apiClient.get(
      `/api/v1/queue/${restaurantId}/export`,
      {
        params,
        responseType: "blob",
      },
    );
    return (response.data as any).data || response.data;
  },

  // 預測和智能功能
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
    const response = await apiClient.get(
      `/api/v1/queue/${restaurantId}/estimate`,
      {
        params: { partySize },
      },
    );
    return (response.data as any).data || response.data;
  },

  async getCapacityForecast(
    restaurantId: string,
    date: string,
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
    const response = await apiClient.get(
      `/api/v1/queue/${restaurantId}/forecast`,
      {
        params: { date },
      },
    );
    return (response.data as any).data || response.data;
  },
};

export default queueService;
