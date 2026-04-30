/**
 * PWA 性能監控系統
 * 提供實時性能追蹤和自動優化建議
 */

import { apiClient } from "@/services/api";

export interface PerformanceMetrics {
  // Service Worker 性能
  cacheHitRate: number;
  averageResponseTime: number;
  networkRequestCount: number;
  cacheRequestCount: number;

  // IndexedDB 性能
  dbOperationTime: number;
  dbQueryCount: number;
  dbErrorRate: number;
  storageUsage: number;

  // 背景同步性能
  syncSuccessRate: number;
  syncBatchSize: number;
  syncLatency: number;
  queueSize: number;

  // 應用性能
  pageLoadTime: number;
  firstContentfulPaint: number;
  timeToInteractive: number;
  memoryUsage: number;

  // 網路性能
  connectionType: string;
  networkSpeed: number;
  offlineTime: number;
  onlineTime: number;
}

export interface PerformanceThresholds {
  cacheHitRate: { warning: number; critical: number };
  averageResponseTime: { warning: number; critical: number };
  dbOperationTime: { warning: number; critical: number };
  syncSuccessRate: { warning: number; critical: number };
  pageLoadTime: { warning: number; critical: number };
  memoryUsage: { warning: number; critical: number };
}

export interface PerformanceReport {
  timestamp: string;
  metrics: PerformanceMetrics;
  alerts: PerformanceAlert[];
  recommendations: string[];
  score: number;
}

export interface PerformanceAlert {
  type: "warning" | "critical";
  metric: string;
  currentValue: number;
  threshold: number;
  message: string;
}

export class PWAPerformanceMonitor {
  private metrics: PerformanceMetrics;
  private history: PerformanceReport[] = [];
  private observers: PerformanceObserver[] = [];
  private intervals: NodeJS.Timeout[] = [];

  private thresholds: PerformanceThresholds = {
    cacheHitRate: { warning: 0.7, critical: 0.5 },
    averageResponseTime: { warning: 1000, critical: 3000 },
    dbOperationTime: { warning: 100, critical: 500 },
    syncSuccessRate: { warning: 0.9, critical: 0.8 },
    pageLoadTime: { warning: 3000, critical: 5000 },
    memoryUsage: { warning: 50 * 1024 * 1024, critical: 100 * 1024 * 1024 },
  };

  constructor() {
    this.metrics = this.initializeMetrics();
    this.startMonitoring();
  }

  /**
   * 初始化性能指標
   */
  private initializeMetrics(): PerformanceMetrics {
    return {
      cacheHitRate: 0,
      averageResponseTime: 0,
      networkRequestCount: 0,
      cacheRequestCount: 0,
      dbOperationTime: 0,
      dbQueryCount: 0,
      dbErrorRate: 0,
      storageUsage: 0,
      syncSuccessRate: 0,
      syncBatchSize: 0,
      syncLatency: 0,
      queueSize: 0,
      pageLoadTime: 0,
      firstContentfulPaint: 0,
      timeToInteractive: 0,
      memoryUsage: 0,
      connectionType: "",
      networkSpeed: 0,
      offlineTime: 0,
      onlineTime: 0,
    };
  }

  /**
   * 開始性能監控
   */
  private startMonitoring(): void {
    // 監控 Web Vitals
    this.observeWebVitals();

    // 監控網路狀態
    this.observeNetworkStatus();

    // 監控記憶體使用
    this.observeMemoryUsage();

    // 監控 Service Worker 性能
    this.observeServiceWorkerPerformance();

    // 定期生成報告
    const reportInterval = setInterval(() => {
      this.generateReport();
    }, 60000); // 每分鐘

    this.intervals.push(reportInterval);

    // 定期清理歷史數據
    const cleanupInterval = setInterval(() => {
      this.cleanupHistory();
    }, 300000); // 每 5 分鐘

    this.intervals.push(cleanupInterval);

    console.log("📊 Performance monitoring started");
  }

  /**
   * 監控 Web Vitals
   */
  private observeWebVitals(): void {
    if ("PerformanceObserver" in window) {
      // 監控 LCP (Largest Contentful Paint)
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries.at(-1);
        if (lastEntry) {
          this.metrics.firstContentfulPaint = lastEntry.startTime;
        }
      });
      lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });
      this.observers.push(lcpObserver);

      // 監控 FID (First Input Delay)
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.metrics.timeToInteractive =
            entry.processingStart - entry.startTime;
        });
      });
      fidObserver.observe({ entryTypes: ["first-input"] });
      this.observers.push(fidObserver);

      // 監控導航性能
      const navObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.metrics.pageLoadTime = entry.loadEventEnd - entry.loadEventStart;
        });
      });
      navObserver.observe({ entryTypes: ["navigation"] });
      this.observers.push(navObserver);
    }
  }

  /**
   * 監控網路狀態
   */
  private observeNetworkStatus(): void {
    const connection = navigator.connection;
    if (connection) {
      this.metrics.connectionType = connection.effectiveType || "unknown";
      this.metrics.networkSpeed = connection.downlink || 0;

      connection.addEventListener("change", () => {
        this.metrics.connectionType = connection.effectiveType || "unknown";
        this.metrics.networkSpeed = connection.downlink || 0;
      });
    }

    // 監控在線/離線時間
    let onlineStart = navigator.onLine ? Date.now() : 0;
    let offlineStart = !navigator.onLine ? Date.now() : 0;

    window.addEventListener("online", () => {
      if (offlineStart > 0) {
        this.metrics.offlineTime += Date.now() - offlineStart;
        offlineStart = 0;
      }
      onlineStart = Date.now();
    });

    window.addEventListener("offline", () => {
      if (onlineStart > 0) {
        this.metrics.onlineTime += Date.now() - onlineStart;
        onlineStart = 0;
      }
      offlineStart = Date.now();
    });
  }

  /**
   * 監控記憶體使用
   */
  private observeMemoryUsage(): void {
    if (performance.memory) {
      const updateMemoryUsage = () => {
        const memory = performance.memory;
        if (memory) {
          this.metrics.memoryUsage = memory.usedJSHeapSize;
        }
      };

      updateMemoryUsage();
      const interval = setInterval(updateMemoryUsage, 30000); // 每 30 秒
      this.intervals.push(interval);
    }
  }

  /**
   * 監控 Service Worker 性能
   */
  private observeServiceWorkerPerformance(): void {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      // 監聽來自 Service Worker 的性能數據
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.type === "PERFORMANCE_UPDATE") {
          const data = event.data.metrics;
          this.updateServiceWorkerMetrics(data);
        }
      });

      // 請求 Service Worker 性能數據
      const requestMetrics = () => {
        navigator.serviceWorker.controller?.postMessage({
          type: "GET_PERFORMANCE_METRICS",
        });
      };

      requestMetrics();
      const interval = setInterval(requestMetrics, 30000); // 每 30 秒
      this.intervals.push(interval);
    }
  }

  /**
   * 更新 Service Worker 性能指標
   */
  private updateServiceWorkerMetrics(data: any): void {
    if (data.cacheHitRate !== undefined) {
      this.metrics.cacheHitRate = data.cacheHitRate;
    }
    if (data.averageResponseTime !== undefined) {
      this.metrics.averageResponseTime = data.averageResponseTime;
    }
    if (data.networkRequestCount !== undefined) {
      this.metrics.networkRequestCount = data.networkRequestCount;
    }
    if (data.cacheRequestCount !== undefined) {
      this.metrics.cacheRequestCount = data.cacheRequestCount;
    }
  }

  /**
   * 記錄數據庫操作性能
   */
  recordDatabaseOperation(
    operationType: string,
    duration: number,
    success: boolean,
  ): void {
    this.metrics.dbQueryCount++;

    // 更新平均操作時間
    this.metrics.dbOperationTime =
      (this.metrics.dbOperationTime * (this.metrics.dbQueryCount - 1) +
        duration) /
      this.metrics.dbQueryCount;

    // 更新錯誤率
    if (!success) {
      const errorCount =
        this.metrics.dbErrorRate * (this.metrics.dbQueryCount - 1) + 1;
      this.metrics.dbErrorRate = errorCount / this.metrics.dbQueryCount;
    } else {
      this.metrics.dbErrorRate =
        (this.metrics.dbErrorRate * (this.metrics.dbQueryCount - 1)) /
        this.metrics.dbQueryCount;
    }

    console.log(
      `💾 DB Operation: ${operationType} (${duration}ms, ${success ? "success" : "error"})`,
    );
  }

  /**
   * 記錄同步操作性能
   */
  recordSyncOperation(
    batchSize: number,
    duration: number,
    success: boolean,
  ): void {
    // 更新批次大小
    this.metrics.syncBatchSize = batchSize;

    // 更新同步延遲
    this.metrics.syncLatency = duration;

    // 更新成功率
    const previousCount = this.metrics.syncSuccessRate * 100; // 估計之前的操作數
    const newCount = previousCount + 1;
    const successCount =
      this.metrics.syncSuccessRate * previousCount + (success ? 1 : 0);
    this.metrics.syncSuccessRate = successCount / newCount;

    console.log(
      `🔄 Sync Operation: ${batchSize} items (${duration}ms, ${success ? "success" : "error"})`,
    );
  }

  /**
   * 更新存儲使用量
   */
  async updateStorageUsage(): Promise<void> {
    if ("storage" in navigator && "estimate" in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        this.metrics.storageUsage = estimate.usage || 0;
      } catch (error) {
        console.warn("無法獲取存儲使用量:", error);
      }
    }
  }

  /**
   * 生成性能報告
   */
  async generateReport(): Promise<PerformanceReport> {
    await this.updateStorageUsage();

    const alerts = this.analyzeMetrics();
    const recommendations = this.generateRecommendations(alerts);
    const score = this.calculatePerformanceScore();

    const report: PerformanceReport = {
      timestamp: new Date().toISOString(),
      metrics: { ...this.metrics },
      alerts,
      recommendations,
      score,
    };

    this.history.push(report);

    // 發送報告到分析服務
    this.sendReportToAnalytics(report);

    console.log("📊 Performance report generated", {
      score,
      alertCount: alerts.length,
      recommendationCount: recommendations.length,
    });

    return report;
  }

  /**
   * 分析性能指標並生成警報
   */
  private analyzeMetrics(): PerformanceAlert[] {
    const alerts: PerformanceAlert[] = [];

    // 檢查快取命中率
    if (this.metrics.cacheHitRate < this.thresholds.cacheHitRate.critical) {
      alerts.push({
        type: "critical",
        metric: "cacheHitRate",
        currentValue: this.metrics.cacheHitRate,
        threshold: this.thresholds.cacheHitRate.critical,
        message: `快取命中率過低 (${(this.metrics.cacheHitRate * 100).toFixed(1)}%)`,
      });
    } else if (
      this.metrics.cacheHitRate < this.thresholds.cacheHitRate.warning
    ) {
      alerts.push({
        type: "warning",
        metric: "cacheHitRate",
        currentValue: this.metrics.cacheHitRate,
        threshold: this.thresholds.cacheHitRate.warning,
        message: `快取命中率需要改善 (${(this.metrics.cacheHitRate * 100).toFixed(1)}%)`,
      });
    }

    // 檢查響應時間
    if (
      this.metrics.averageResponseTime >
      this.thresholds.averageResponseTime.critical
    ) {
      alerts.push({
        type: "critical",
        metric: "averageResponseTime",
        currentValue: this.metrics.averageResponseTime,
        threshold: this.thresholds.averageResponseTime.critical,
        message: `平均響應時間過長 (${this.metrics.averageResponseTime}ms)`,
      });
    } else if (
      this.metrics.averageResponseTime >
      this.thresholds.averageResponseTime.warning
    ) {
      alerts.push({
        type: "warning",
        metric: "averageResponseTime",
        currentValue: this.metrics.averageResponseTime,
        threshold: this.thresholds.averageResponseTime.warning,
        message: `平均響應時間偏高 (${this.metrics.averageResponseTime}ms)`,
      });
    }

    // 檢查數據庫性能
    if (
      this.metrics.dbOperationTime > this.thresholds.dbOperationTime.critical
    ) {
      alerts.push({
        type: "critical",
        metric: "dbOperationTime",
        currentValue: this.metrics.dbOperationTime,
        threshold: this.thresholds.dbOperationTime.critical,
        message: `數據庫操作時間過長 (${this.metrics.dbOperationTime.toFixed(1)}ms)`,
      });
    }

    // 檢查同步成功率
    if (
      this.metrics.syncSuccessRate < this.thresholds.syncSuccessRate.critical
    ) {
      alerts.push({
        type: "critical",
        metric: "syncSuccessRate",
        currentValue: this.metrics.syncSuccessRate,
        threshold: this.thresholds.syncSuccessRate.critical,
        message: `同步成功率過低 (${(this.metrics.syncSuccessRate * 100).toFixed(1)}%)`,
      });
    }

    // 檢查記憶體使用
    if (this.metrics.memoryUsage > this.thresholds.memoryUsage.critical) {
      alerts.push({
        type: "critical",
        metric: "memoryUsage",
        currentValue: this.metrics.memoryUsage,
        threshold: this.thresholds.memoryUsage.critical,
        message: `記憶體使用量過高 (${(this.metrics.memoryUsage / 1024 / 1024).toFixed(1)}MB)`,
      });
    }

    return alerts;
  }

  /**
   * 生成優化建議
   */
  private generateRecommendations(alerts: PerformanceAlert[]): string[] {
    const recommendations: string[] = [];

    for (const alert of alerts) {
      switch (alert.metric) {
        case "cacheHitRate":
          recommendations.push("考慮調整快取策略，增加常用資源的快取時間");
          recommendations.push("實施智慧預載機制，提前載入關鍵資源");
          break;

        case "averageResponseTime":
          recommendations.push("檢查網路連接品質，考慮實施請求優化");
          recommendations.push("增加響應超時設定，改善用戶體驗");
          break;

        case "dbOperationTime":
          recommendations.push("優化數據庫查詢，考慮添加適當的索引");
          recommendations.push("實施數據庫連接池，減少連接開銷");
          break;

        case "syncSuccessRate":
          recommendations.push("檢查網路連接穩定性和 API 端點可用性");
          recommendations.push("增加重試機制和錯誤處理邏輯");
          break;

        case "memoryUsage":
          recommendations.push("檢查記憶體洩漏，清理未使用的資源");
          recommendations.push("實施垃圾回收策略，定期清理快取");
          break;
      }
    }

    // 一般性建議
    if (
      this.metrics.connectionType === "slow-2g" ||
      this.metrics.connectionType === "2g"
    ) {
      recommendations.push("檢測到慢速網路，建議啟用更積極的快取策略");
    }

    if (this.metrics.offlineTime > 0) {
      recommendations.push("檢測到離線時間，確保離線功能正常工作");
    }

    return [...new Set(recommendations)]; // 去重
  }

  /**
   * 計算性能評分
   */
  private calculatePerformanceScore(): number {
    let score = 100;

    // 快取性能 (30%)
    if (this.metrics.cacheHitRate < 0.5) {
      score -= 30;
    } else if (this.metrics.cacheHitRate < 0.7) {
      score -= 15;
    }

    // 響應時間 (25%)
    if (this.metrics.averageResponseTime > 3000) {
      score -= 25;
    } else if (this.metrics.averageResponseTime > 1000) {
      score -= 12;
    }

    // 數據庫性能 (20%)
    if (this.metrics.dbOperationTime > 500) {
      score -= 20;
    } else if (this.metrics.dbOperationTime > 100) {
      score -= 10;
    }

    // 同步性能 (15%)
    if (this.metrics.syncSuccessRate < 0.8) {
      score -= 15;
    } else if (this.metrics.syncSuccessRate < 0.9) {
      score -= 7;
    }

    // 記憶體使用 (10%)
    if (this.metrics.memoryUsage > 100 * 1024 * 1024) {
      score -= 10;
    } else if (this.metrics.memoryUsage > 50 * 1024 * 1024) {
      score -= 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 發送報告到分析服務
   */
  private sendReportToAnalytics(report: PerformanceReport): void {
    // 只發送關鍵指標，避免發送過多數據
    const analyticsData = {
      timestamp: report.timestamp,
      score: report.score,
      alertCount: report.alerts.length,
      criticalAlerts: report.alerts.filter((a) => a.type === "critical").length,
      cacheHitRate: report.metrics.cacheHitRate,
      averageResponseTime: report.metrics.averageResponseTime,
      syncSuccessRate: report.metrics.syncSuccessRate,
    };

    // 發送到後端或第三方分析服務。 /analytics/* 全域套用 authMiddleware，
    // 未登入的訪客呼叫會 401 污染 log；這個遙測不是業務關鍵，未登入就跳過。
    const authToken =
      typeof localStorage !== "undefined"
        ? localStorage.getItem("customer_auth_token")
        : null;
    if (!authToken) {
      return;
    }
    void apiClient
      .post("/analytics/batch-sync", {
        events: [
          {
            type: "performance",
            ...analyticsData,
          },
        ],
      })
      .catch((error) => {
        console.warn("Failed to send performance analytics:", error);
      });
  }

  /**
   * 清理歷史數據
   */
  private cleanupHistory(): void {
    const maxHistorySize = 100;
    if (this.history.length > maxHistorySize) {
      this.history = this.history.slice(-maxHistorySize);
    }
  }

  /**
   * 獲取最新報告
   */
  getLatestReport(): PerformanceReport | null {
    return this.history.length > 0
      ? this.history[this.history.length - 1]
      : null;
  }

  /**
   * 獲取歷史報告
   */
  getHistory(count: number = 10): PerformanceReport[] {
    return this.history.slice(-count);
  }

  /**
   * 獲取當前指標
   */
  getCurrentMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * 停止監控
   */
  stopMonitoring(): void {
    // 停止所有觀察器
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];

    // 清除所有定時器
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals = [];

    console.log("📊 Performance monitoring stopped");
  }
}

// 導出單例實例
export const performanceMonitor = new PWAPerformanceMonitor();
