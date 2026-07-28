/**
 * PWA Performance Optimizer for Customer App
 * 實施關鍵性能優化以提升用戶體驗
 */

import { apiClient } from "@/services/api";
import { optimizedOfflineStorage as _optimizedOfflineStorage } from "./offline-storage-optimized";
import { optimizedBackgroundSync } from "./background-sync-optimized";
import { performanceMonitor } from "./performance-monitor";

// Service Worker 性能優化模組
export class ServiceWorkerOptimizer {
  private performanceMetrics = new Map<string, any>();
  private cacheStrategies = new Map<string, string>();

  constructor() {
    this.initializeMetrics();
  }

  private initializeMetrics(): void {
    // 初始化性能指標追蹤
    this.startPerformanceMonitoring();
  }

  // 智慧快取策略選擇
  async selectOptimalCacheStrategy(request: Request): Promise<string> {
    const url = new URL(request.url);
    const path = url.pathname;

    // 獲取歷史性能數據
    const metrics = this.performanceMetrics.get(path);

    if (!metrics) {
      // 新路徑，使用預設策略
      return this.getDefaultStrategy(path);
    }

    // 基於性能數據動態選擇策略
    if (metrics.avgNetworkTime < 300 && metrics.networkSuccessRate > 0.95) {
      return "network-first";
    }

    if (metrics.cacheHitRate > 0.85) {
      return "cache-first";
    }

    if (metrics.dataFreshness === "not-critical") {
      return "stale-while-revalidate";
    }

    return "network-first";
  }

  private getDefaultStrategy(path: string): string {
    // API 請求
    if (path.includes("/api/")) {
      if (path.includes("/menu/") || path.includes("/restaurants/")) {
        return "stale-while-revalidate"; // 菜單可以稍微過時
      }
      return "network-first"; // 其他 API 需要新鮮數據
    }

    // 靜態資源
    if (path.match(/\.(js|css|png|jpg|jpeg|gif|woff|woff2|svg|ico)$/)) {
      return "cache-first";
    }

    // 頁面導航
    return "network-first";
  }

  // 記錄性能指標
  recordPerformance(
    request: Request,
    responseTime: number,
    fromCache: boolean,
    success: boolean,
  ): void {
    const path = new URL(request.url).pathname;
    const current = this.performanceMetrics.get(path) || {
      avgNetworkTime: 0,
      cacheHitRate: 0,
      networkSuccessRate: 0,
      totalRequests: 0,
      cacheHits: 0,
      networkSuccesses: 0,
      lastUpdated: Date.now(),
    };

    current.totalRequests++;

    if (fromCache) {
      current.cacheHits++;
    } else {
      current.avgNetworkTime =
        (current.avgNetworkTime * (current.totalRequests - 1) + responseTime) /
        current.totalRequests;
      if (success) {
        current.networkSuccesses++;
      }
    }

    current.cacheHitRate = current.cacheHits / current.totalRequests;
    current.networkSuccessRate =
      current.networkSuccesses / (current.totalRequests - current.cacheHits);
    current.lastUpdated = Date.now();

    this.performanceMetrics.set(path, current);
  }

  // 預載關鍵資源
  async preloadCriticalResources(): Promise<void> {
    const criticalResources = ["/assets/critical.css", "/assets/app-shell.js"];

    const preloadPromises = criticalResources.map(async (url) => {
      try {
        const start = performance.now();
        const response = await fetch(url);
        const end = performance.now();

        if (response.ok) {
          const cache = await caches.open("preload-cache-v1");
          await cache.put(url, response.clone());

          this.recordPerformance(new Request(url), end - start, false, true);
        }
      } catch (error) {
        console.warn(`Failed to preload ${url}:`, error);
      }
    });

    await Promise.allSettled(preloadPromises);
  }

  // 清理過期快取
  async cleanupExpiredCaches(): Promise<void> {
    const cacheNames = await caches.keys();
    const currentCacheNames = [
      "makanmakan-customer-v1",
      "makanmakan-api-v1",
      "makanmakan-images-v1",
      "preload-cache-v1",
    ];

    const deletePromises = cacheNames
      .filter((name) => !currentCacheNames.includes(name))
      .map((name) => caches.delete(name));

    await Promise.all(deletePromises);
  }

  private startPerformanceMonitoring(): void {
    // 每 5 分鐘清理過期指標
    setInterval(
      () => {
        this.cleanupExpiredMetrics();
      },
      5 * 60 * 1000,
    );

    // 每 10 分鐘報告性能
    setInterval(
      () => {
        this.reportPerformance();
      },
      10 * 60 * 1000,
    );
  }

  private cleanupExpiredMetrics(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [key, metrics] of this.performanceMetrics.entries()) {
      if (metrics.lastUpdated < oneHourAgo) {
        this.performanceMetrics.delete(key);
      }
    }
  }

  private reportPerformance(): void {
    const summary = {
      totalPaths: this.performanceMetrics.size,
      averageCacheHitRate: 0,
      averageNetworkTime: 0,
      averageSuccessRate: 0,
    };

    let totalMetrics = 0;
    for (const metrics of this.performanceMetrics.values()) {
      summary.averageCacheHitRate += metrics.cacheHitRate;
      summary.averageNetworkTime += metrics.avgNetworkTime;
      summary.averageSuccessRate += metrics.networkSuccessRate;
      totalMetrics++;
    }

    if (totalMetrics > 0) {
      summary.averageCacheHitRate /= totalMetrics;
      summary.averageNetworkTime /= totalMetrics;
      summary.averageSuccessRate /= totalMetrics;
    }

    console.log("📊 PWA Performance Summary:", summary);

    // 發送到分析服務
    this.sendToAnalytics(summary);
  }

  private async sendToAnalytics(data: any): Promise<void> {
    try {
      await apiClient.post("/analytics/batch-sync", {
        events: [
          {
            type: "pwa_performance",
            timestamp: new Date().toISOString(),
            app: "customer",
            metrics: data,
          },
        ],
      });
    } catch (error) {
      console.warn("Failed to send performance metrics:", error);
    }
  }
}

// IndexedDB 性能優化
export class IndexedDBOptimizer {
  private db: IDBDatabase | null = null;
  private performanceLog: Array<{
    operation: string;
    duration: number;
    timestamp: number;
  }> = [];

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("MakanMasakCustomerOptimized", 2);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 優化的存儲結構
        if (!db.objectStoreNames.contains("optimizedOrders")) {
          const ordersStore = db.createObjectStore("optimizedOrders", {
            keyPath: "id",
            autoIncrement: true,
          });

          // 添加複合索引以提升查詢性能
          ordersStore.createIndex(
            "restaurant_date",
            ["restaurant_id", "created_at"],
            { unique: false },
          );
          ordersStore.createIndex("status_priority", ["status", "priority"], {
            unique: false,
          });
          ordersStore.createIndex("synced_timestamp", ["synced", "timestamp"], {
            unique: false,
          });
        }

        // 壓縮數據存儲
        if (!db.objectStoreNames.contains("compressedCache")) {
          const cacheStore = db.createObjectStore("compressedCache", {
            keyPath: "key",
          });
          cacheStore.createIndex("expires_at", "expires_at", { unique: false });
          cacheStore.createIndex("size", "compressedSize", { unique: false });
        }
      };
    });
  }

  // 批量操作優化
  async batchWrite(storeName: string, data: any[]): Promise<void> {
    const start = performance.now();

    try {
      if (!this.db) throw new Error("Database not initialized");

      const transaction = this.db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);

      // 分批處理，避免阻塞 UI
      const batchSize = 50;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);

        await Promise.all(
          batch.map(
            (item) =>
              new Promise<void>((resolve, reject) => {
                const compressed = this.compressData(item);
                const request = store.put(compressed);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
              }),
          ),
        );

        // 讓出控制權給 UI
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      const end = performance.now();
      this.logPerformance("batch_write", end - start, data.length);
    } catch (error) {
      console.error("Batch write failed:", error);
      throw error;
    }
  }

  // 數據壓縮
  private compressData(data: any): any {
    return {
      ...data,
      _compressed: true,
      _originalSize: JSON.stringify(data).length,
      compressedSize: this.estimateCompressedSize(data),
    };
  }

  private estimateCompressedSize(data: any): number {
    // 簡單的壓縮大小估算
    const jsonString = JSON.stringify(data);
    return Math.floor(jsonString.length * 0.7); // 假設 30% 壓縮率
  }

  // 智慧查詢優化
  async optimizedQuery(
    storeName: string,
    indexName: string,
    range: IDBKeyRange,
  ): Promise<any[]> {
    const start = performance.now();

    try {
      if (!this.db) throw new Error("Database not initialized");

      const transaction = this.db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);

      const results = await new Promise<any[]>((resolve, reject) => {
        const request = index.getAll(range);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const end = performance.now();
      this.logPerformance("optimized_query", end - start, results.length);

      return results.map((item) => this.decompressData(item));
    } catch (error) {
      console.error("Optimized query failed:", error);
      throw error;
    }
  }

  private decompressData(data: any): any {
    if (data._compressed) {
      const {
        _compressed,
        _originalSize,
        compressedSize: _compressedSize,
        ...original
      } = data;
      return original;
    }
    return data;
  }

  // 自動清理過期數據
  async autoCleanup(): Promise<void> {
    const start = performance.now();

    try {
      if (!this.db) return;

      const transaction = this.db.transaction(["compressedCache"], "readwrite");
      const store = transaction.objectStore("compressedCache");
      const index = store.index("expires_at");

      const now = Date.now();
      const range = IDBKeyRange.upperBound(now);

      const request = index.openCursor(range);
      let deletedCount = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          const end = performance.now();
          this.logPerformance("auto_cleanup", end - start, deletedCount);
        }
      };
    } catch (error) {
      console.error("Auto cleanup failed:", error);
    }
  }

  private logPerformance(
    operation: string,
    duration: number,
    recordCount?: number,
  ): void {
    this.performanceLog.push({
      operation,
      duration,
      timestamp: Date.now(),
    });

    // 保持最近 100 條記錄
    if (this.performanceLog.length > 100) {
      this.performanceLog.shift();
    }

    console.log(
      `📊 IndexedDB ${operation}: ${duration.toFixed(2)}ms${recordCount ? ` (${recordCount} records)` : ""}`,
    );
  }

  getPerformanceReport(): any {
    const report = {
      totalOperations: this.performanceLog.length,
      averageDuration: 0,
      operationBreakdown: {} as Record<string, any>,
    };

    if (this.performanceLog.length === 0) return report;

    const operations = {} as Record<
      string,
      { count: number; totalDuration: number }
    >;

    for (const log of this.performanceLog) {
      if (!operations[log.operation]) {
        operations[log.operation] = { count: 0, totalDuration: 0 };
      }
      operations[log.operation].count++;
      operations[log.operation].totalDuration += log.duration;
      report.averageDuration += log.duration;
    }

    report.averageDuration /= this.performanceLog.length;

    for (const [operation, stats] of Object.entries(operations)) {
      report.operationBreakdown[operation] = {
        count: stats.count,
        averageDuration: stats.totalDuration / stats.count,
        totalDuration: stats.totalDuration,
      };
    }

    return report;
  }
}

// 背景同步優化
export class BackgroundSyncOptimizer {
  private batchQueue = new Map<string, any[]>();
  private batchTimers = new Map<string, number>();
  private readonly BATCH_SIZE = 10;
  private readonly BATCH_TIMEOUT = 5000; // 5 秒

  // 智慧批次處理
  async queueForBatchSync(
    type: string,
    data: any,
    priority: "low" | "normal" | "high" | "critical" = "normal",
  ): Promise<void> {
    if (!this.batchQueue.has(type)) {
      this.batchQueue.set(type, []);
    }

    const queue = this.batchQueue.get(type)!;
    queue.push({ data, priority, timestamp: Date.now() });

    // 按優先級排序
    queue.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 };
      return (
        priorityOrder[b.priority as keyof typeof priorityOrder] -
        priorityOrder[a.priority as keyof typeof priorityOrder]
      );
    });

    // 關鍵項目立即處理
    if (priority === "critical") {
      await this.processBatch(type);
      return;
    }

    // 批次大小觸發
    if (queue.length >= this.BATCH_SIZE) {
      await this.processBatch(type);
      return;
    }

    // 設定定時器
    this.scheduleBatchProcess(type);
  }

  private scheduleBatchProcess(type: string): void {
    if (this.batchTimers.has(type)) {
      return; // 已經排程
    }

    const timer = window.setTimeout(async () => {
      await this.processBatch(type);
      this.batchTimers.delete(type);
    }, this.BATCH_TIMEOUT);

    this.batchTimers.set(type, timer);
  }

  private async processBatch(type: string): Promise<void> {
    const queue = this.batchQueue.get(type);
    if (!queue || queue.length === 0) return;

    // 清除定時器
    const timer = this.batchTimers.get(type);
    if (timer) {
      clearTimeout(timer);
      this.batchTimers.delete(type);
    }

    // 提取批次
    const batch = queue.splice(0, this.BATCH_SIZE);

    try {
      await this.syncBatch(type, batch);
      console.log(`✅ 成功同步 ${type} 批次: ${batch.length} 項目`);
    } catch (error) {
      console.error(`❌ 批次同步失敗 ${type}:`, error);

      // 重新加入隊列，但增加重試計數
      batch.forEach((item) => {
        item.retryCount = (item.retryCount || 0) + 1;
        if (item.retryCount < 3) {
          queue.unshift(item);
        } else {
          console.warn(`丟棄項目，重試次數過多:`, item);
        }
      });
    }
  }

  private async syncBatch(type: string, batch: any[]): Promise<void> {
    await apiClient.post(
      this.getEndpointForType(type),
      this.getPayloadForType(
        type,
        batch.map((item) => item.data),
      ),
    );
  }

  private getEndpointForType(type: string): string {
    const endpoints = {
      order_submission: "/orders/batch-sync",
      favorite_sync: "/users/favorites/sync",
      settings_sync: "/users/settings/sync",
      feedback_sync: "/feedback/batch-sync",
    };
    return endpoints[type as keyof typeof endpoints] || `/${type}/batch-sync`;
  }

  private getPayloadForType(type: string, data: any[]): Record<string, any> {
    const timestamp = new Date().toISOString();

    switch (type) {
      case "order_submission":
        return { orders: data, timestamp };
      case "favorite_sync":
        return { favorites: data, timestamp };
      case "settings_sync":
        return { settings: data, timestamp };
      case "feedback_sync":
        return { feedback: data, timestamp };
      default:
        return { type, data, timestamp };
    }
  }

  // 獲取批次狀態
  getBatchStatus(): Record<string, any> {
    const status: Record<string, any> = {};

    for (const [type, queue] of this.batchQueue.entries()) {
      status[type] = {
        pending: queue.length,
        hasTimer: this.batchTimers.has(type),
        oldestItem:
          queue.length > 0 ? Date.now() - queue[queue.length - 1].timestamp : 0,
      };
    }

    return status;
  }
}

// 主要優化管理器
export class PWAPerformanceManager {
  private swOptimizer: ServiceWorkerOptimizer;
  private dbOptimizer: IndexedDBOptimizer;
  private syncOptimizer: BackgroundSyncOptimizer;
  private optimizedStorage: any;
  private isInitialized = false;

  constructor() {
    this.swOptimizer = new ServiceWorkerOptimizer();
    this.dbOptimizer = new IndexedDBOptimizer();
    this.syncOptimizer = new BackgroundSyncOptimizer();
    this.optimizedStorage = _optimizedOfflineStorage;
  }

  async initializeOptimizations(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log("🚀 初始化 PWA 性能優化器...");

    try {
      // 初始化所有優化器
      await Promise.all([
        this.dbOptimizer.initialize(),
        this.optimizedStorage.initialize(),
      ]);

      // 預載關鍵資源
      await this.swOptimizer.preloadCriticalResources();

      // 清理過期快取
      await this.swOptimizer.cleanupExpiredCaches();

      // 啟動性能監控
      // Performance monitoring starts automatically on import

      // 啟動自動優化
      this.startAutomaticOptimization();

      this.isInitialized = true;
      console.log("✅ PWA 性能優化器初始化完成");
    } catch (error) {
      console.error("❌ PWA 性能優化器初始化失敗:", error);
      throw error;
    }
  }

  async initialize(): Promise<void> {
    return this.initializeOptimizations();
  }

  private startAutomaticOptimization(): void {
    // 每 30 分鐘進行自動優化
    setInterval(
      async () => {
        await this.runOptimizationCycle();
      },
      30 * 60 * 1000,
    );

    // 每 2 小時清理數據庫
    setInterval(
      async () => {
        await this.dbOptimizer.autoCleanup();
      },
      2 * 60 * 60 * 1000,
    );
  }

  private async runOptimizationCycle(): Promise<void> {
    console.log("🔄 運行優化週期...");

    try {
      // 清理過期快取
      await this.swOptimizer.cleanupExpiredCaches();

      // 清理數據庫
      await this.dbOptimizer.autoCleanup();

      // 生成性能報告
      const dbReport = this.dbOptimizer.getPerformanceReport();
      const syncStatus = this.syncOptimizer.getBatchStatus();

      console.log("📊 性能報告:", { database: dbReport, sync: syncStatus });
    } catch (error) {
      console.error("優化週期失敗:", error);
    }
  }

  // 獲取性能報告
  async getComprehensivePerformanceReport(): Promise<any> {
    const dbReport = this.dbOptimizer.getPerformanceReport();
    const syncStatus = this.syncOptimizer.getBatchStatus();
    const queueStatus = optimizedBackgroundSync.getQueueStatus();
    const performanceReport = performanceMonitor.getLatestReport();

    return {
      timestamp: new Date().toISOString(),
      database: dbReport,
      backgroundSync: {
        legacyBatches: syncStatus,
        optimizedQueues: queueStatus,
        performanceMetrics: optimizedBackgroundSync.getPerformanceReport(),
      },
      performance: performanceReport,
      systemStatus: {
        initialized: this.isInitialized,
        monitoringActive: true,
      },
    };
  }

  // 強制執行優化週期
  async forceOptimizationCycle(): Promise<void> {
    await this.runOptimizationCycle();
  }

  // 公開 API
  get serviceWorkerOptimizer(): ServiceWorkerOptimizer {
    return this.swOptimizer;
  }

  get databaseOptimizer(): IndexedDBOptimizer {
    return this.dbOptimizer;
  }

  get syncOptimizerInstance(): BackgroundSyncOptimizer {
    return this.syncOptimizer;
  }

  get optimizedStorageManager(): any {
    return this.optimizedStorage;
  }

  get performanceMonitor() {
    return performanceMonitor;
  }

  get optimizedBackgroundSync() {
    return optimizedBackgroundSync;
  }
}

// 匯出全局實例
export const pwaPerformanceManager = new PWAPerformanceManager();

// 自動初始化
if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    pwaPerformanceManager.initialize().catch(console.error);
  });
}
