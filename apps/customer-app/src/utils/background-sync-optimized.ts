/**
 * 優化背景同步管理器
 * 實現智慧批次同步和優先級管理
 */

export interface SyncItem {
  id: string;
  type: string;
  data: any;
  priority: "critical" | "high" | "normal" | "low";
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export interface SyncBatch {
  id: string;
  type: string;
  items: SyncItem[];
  timestamp: number;
  status: "pending" | "processing" | "completed" | "failed";
}

export interface SyncConfig {
  batchSize: number;
  maxWaitTime: number;
  retryDelays: number[];
  priorityWeights: Record<string, number>;
}

export class OptimizedBackgroundSync {
  private syncQueue = new Map<string, SyncItem[]>();
  private processingBatches = new Map<string, SyncBatch>();
  private timers = new Map<string, NodeJS.Timeout>();

  private config: SyncConfig = {
    batchSize: 10,
    maxWaitTime: 30000, // 30秒
    retryDelays: [1000, 3000, 10000, 30000], // 指數退避
    priorityWeights: {
      critical: 4,
      high: 3,
      normal: 2,
      low: 1,
    },
  };

  private performanceMetrics = {
    totalSynced: 0,
    successRate: 0,
    averageBatchSize: 0,
    averageProcessingTime: 0,
    networkRequestsSaved: 0,
  };

  /**
   * 將項目加入同步隊列
   */
  async queueForSync(
    type: string,
    data: any,
    priority: SyncItem["priority"] = "normal",
  ): Promise<void> {
    const item: SyncItem = {
      id: this.generateId(),
      type,
      data,
      priority,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: this.config.retryDelays.length,
    };

    // 初始化隊列
    if (!this.syncQueue.has(type)) {
      this.syncQueue.set(type, []);
    }

    const queue = this.syncQueue.get(type)!;
    queue.push(item);

    // 按優先級排序
    this.sortQueueByPriority(queue);

    console.log(`📋 Added to sync queue: ${type} (${priority})`, {
      queueSize: queue.length,
      item: { id: item.id, priority },
    });

    // 觸發批次處理
    if (priority === "critical" || queue.length >= this.config.batchSize) {
      await this.processBatch(type);
    } else {
      this.scheduleBatchProcessing(type);
    }
  }

  /**
   * 按優先級排序隊列
   */
  private sortQueueByPriority(queue: SyncItem[]): void {
    queue.sort((a, b) => {
      const weightA = this.config.priorityWeights[a.priority];
      const weightB = this.config.priorityWeights[b.priority];

      if (weightA !== weightB) {
        return weightB - weightA; // 高優先級在前
      }

      return a.timestamp - b.timestamp; // 相同優先級按時間排序
    });
  }

  /**
   * 排程批次處理
   */
  private scheduleBatchProcessing(type: string): void {
    // 清除現有計時器
    if (this.timers.has(type)) {
      clearTimeout(this.timers.get(type)!);
    }

    // 設置新的計時器
    const timer = setTimeout(() => {
      this.processBatch(type);
      this.timers.delete(type);
    }, this.config.maxWaitTime);

    this.timers.set(type, timer);
  }

  /**
   * 處理批次
   */
  async processBatch(type: string): Promise<void> {
    const queue = this.syncQueue.get(type);
    if (!queue || queue.length === 0) {
      return;
    }

    // 清除計時器
    if (this.timers.has(type)) {
      clearTimeout(this.timers.get(type)!);
      this.timers.delete(type);
    }

    const batchItems = queue.splice(0, this.config.batchSize);
    const batch: SyncBatch = {
      id: this.generateId(),
      type,
      items: batchItems,
      timestamp: Date.now(),
      status: "pending",
    };

    this.processingBatches.set(batch.id, batch);

    console.log(`🔄 Processing batch: ${type}`, {
      batchId: batch.id,
      itemCount: batchItems.length,
      priorities: batchItems.map((item) => item.priority),
    });

    try {
      batch.status = "processing";
      const startTime = Date.now();

      await this.syncBatch(batch);

      batch.status = "completed";
      const processingTime = Date.now() - startTime;

      // 更新性能指標
      this.updatePerformanceMetrics(batch, processingTime, true);

      console.log(`✅ Batch completed: ${type}`, {
        batchId: batch.id,
        processingTime,
        itemCount: batchItems.length,
      });
    } catch (error) {
      batch.status = "failed";
      console.error(`❌ Batch failed: ${type}`, {
        batchId: batch.id,
        error: error instanceof Error ? error.message : error,
      });

      // 重新加入隊列並增加重試計數
      this.requeueFailedItems(batch);

      // 更新性能指標
      this.updatePerformanceMetrics(batch, 0, false);
    } finally {
      this.processingBatches.delete(batch.id);
    }
  }

  /**
   * 同步批次數據
   */
  private async syncBatch(batch: SyncBatch): Promise<void> {
    const { type, items } = batch;

    switch (type) {
      case "orders":
        await this.syncOrders(items);
        break;
      case "preferences":
        await this.syncPreferences(items);
        break;
      case "feedback":
        await this.syncFeedback(items);
        break;
      case "analytics":
        await this.syncAnalytics(items);
        break;
      default:
        await this.syncGeneric(type, items);
    }
  }

  /**
   * 同步訂單數據
   */
  private async syncOrders(items: SyncItem[]): Promise<void> {
    const orderData = items.map((item) => item.data);

    const response = await fetch("/api/v1/orders/batch-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.getAuthToken()}`,
      },
      body: JSON.stringify({ orders: orderData }),
    });

    if (!response.ok) {
      throw new Error(`Orders sync failed: ${response.status}`);
    }

    console.log(`📦 Synced ${items.length} orders`);
  }

  /**
   * 同步用戶偏好
   */
  private async syncPreferences(items: SyncItem[]): Promise<void> {
    const preferencesData = items.map((item) => item.data);

    const response = await fetch("/api/v1/users/preferences/batch-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.getAuthToken()}`,
      },
      body: JSON.stringify({ preferences: preferencesData }),
    });

    if (!response.ok) {
      throw new Error(`Preferences sync failed: ${response.status}`);
    }

    console.log(`⚙️ Synced ${items.length} preferences`);
  }

  /**
   * 同步反饋數據
   */
  private async syncFeedback(items: SyncItem[]): Promise<void> {
    const feedbackData = items.map((item) => item.data);

    const response = await fetch("/api/v1/feedback/batch-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.getAuthToken()}`,
      },
      body: JSON.stringify({ feedback: feedbackData }),
    });

    if (!response.ok) {
      throw new Error(`Feedback sync failed: ${response.status}`);
    }

    console.log(`💬 Synced ${items.length} feedback items`);
  }

  /**
   * 同步分析數據
   */
  private async syncAnalytics(items: SyncItem[]): Promise<void> {
    const analyticsData = items.map((item) => item.data);

    const response = await fetch("/api/v1/analytics/batch-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.getAuthToken()}`,
      },
      body: JSON.stringify({ events: analyticsData }),
    });

    if (!response.ok) {
      throw new Error(`Analytics sync failed: ${response.status}`);
    }

    console.log(`📊 Synced ${items.length} analytics events`);
  }

  /**
   * 通用同步處理
   */
  private async syncGeneric(type: string, items: SyncItem[]): Promise<void> {
    const data = items.map((item) => item.data);

    const response = await fetch(`/api/v1/${type}/batch-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.getAuthToken()}`,
      },
      body: JSON.stringify({ data }),
    });

    if (!response.ok) {
      throw new Error(`${type} sync failed: ${response.status}`);
    }

    console.log(`🔄 Synced ${items.length} ${type} items`);
  }

  /**
   * 重新加入失敗的項目到隊列
   */
  private requeueFailedItems(batch: SyncBatch): void {
    const queue = this.syncQueue.get(batch.type) || [];

    for (const item of batch.items) {
      item.retryCount++;

      if (item.retryCount < item.maxRetries) {
        // 設置重試延遲
        const delay =
          this.config.retryDelays[
            Math.min(item.retryCount - 1, this.config.retryDelays.length - 1)
          ];

        setTimeout(() => {
          queue.unshift(item); // 加入隊列前端以保持優先級
          this.sortQueueByPriority(queue);
        }, delay);

        console.log(
          `🔄 Requeued item ${item.id} (retry ${item.retryCount}/${item.maxRetries})`,
        );
      } else {
        console.error(`❌ Item ${item.id} exceeded max retries, dropping`);
      }
    }

    this.syncQueue.set(batch.type, queue);
  }

  /**
   * 更新性能指標
   */
  private updatePerformanceMetrics(
    batch: SyncBatch,
    processingTime: number,
    success: boolean,
  ): void {
    const itemCount = batch.items.length;

    this.performanceMetrics.totalSynced += itemCount;

    // 更新成功率
    const oldSuccessRate = this.performanceMetrics.successRate;
    const totalBatches =
      this.performanceMetrics.totalSynced /
        this.performanceMetrics.averageBatchSize || 1;
    this.performanceMetrics.successRate =
      (oldSuccessRate * (totalBatches - 1) + (success ? 1 : 0)) / totalBatches;

    // 更新平均批次大小
    this.performanceMetrics.averageBatchSize =
      (this.performanceMetrics.averageBatchSize * (totalBatches - 1) +
        itemCount) /
      totalBatches;

    // 更新平均處理時間
    if (success && processingTime > 0) {
      this.performanceMetrics.averageProcessingTime =
        (this.performanceMetrics.averageProcessingTime * (totalBatches - 1) +
          processingTime) /
        totalBatches;
    }

    // 計算節省的網路請求數 (批次處理節省)
    this.performanceMetrics.networkRequestsSaved += Math.max(0, itemCount - 1);
  }

  /**
   * 獲取認證令牌
   */
  private getAuthToken(): string {
    return localStorage.getItem("auth_token") || "";
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 獲取隊列狀態
   */
  getQueueStatus(): Record<string, any> {
    const status: Record<string, any> = {};

    for (const [type, queue] of this.syncQueue.entries()) {
      status[type] = {
        queueSize: queue.length,
        priorities: queue.reduce((acc: Record<string, number>, item) => {
          acc[item.priority] = (acc[item.priority] || 0) + 1;
          return acc;
        }, {}),
        oldestItem:
          queue.length > 0 ? Date.now() - queue[queue.length - 1].timestamp : 0,
      };
    }

    return status;
  }

  /**
   * 獲取批次處理狀態
   */
  getBatchStatus(): Record<string, any> {
    const batches: Record<string, any> = {};

    for (const [id, batch] of this.processingBatches.entries()) {
      batches[id] = {
        type: batch.type,
        status: batch.status,
        itemCount: batch.items.length,
        duration: Date.now() - batch.timestamp,
      };
    }

    return batches;
  }

  /**
   * 獲取性能報告
   */
  getPerformanceReport(): typeof this.performanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * 強制處理所有隊列
   */
  async forceProcessAllQueues(): Promise<void> {
    const promises: Promise<void>[] = [];

    for (const type of this.syncQueue.keys()) {
      promises.push(this.processBatch(type));
    }

    await Promise.all(promises);
    console.log("🚀 All queues force processed");
  }

  /**
   * 清理隊列 (清除低優先級的舊項目)
   */
  cleanupQueues(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    let removedCount = 0;

    for (const [type, queue] of this.syncQueue.entries()) {
      const originalLength = queue.length;

      // 保留高優先級和新的項目
      const filteredQueue = queue.filter(
        (item) =>
          item.priority === "critical" ||
          item.priority === "high" ||
          now - item.timestamp < maxAge,
      );

      this.syncQueue.set(type, filteredQueue);
      removedCount += originalLength - filteredQueue.length;
    }

    if (removedCount > 0) {
      console.log(`🧹 Cleanup completed: removed ${removedCount} old items`);
    }
  }
}

// 導出單例實例
export const optimizedBackgroundSync = new OptimizedBackgroundSync();
