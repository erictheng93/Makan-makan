/**
 * 實時連接彈性和錯誤處理服務
 *
 * 提供強健的連接管理、自動重連、錯誤恢復、離線支持、
 * 數據同步和網絡狀況適配等功能
 */

import { ref } from "vue";
import { realtimeService } from "./realtimeService";
import { groupOrderBroadcastService } from "./groupOrderBroadcastService";
import { collaborativeOrderService } from "./collaborativeOrderService";

// 錯誤類型定義
export interface RealtimeError {
  id: string;
  type:
    | "connection"
    | "sync"
    | "permission"
    | "data"
    | "network"
    | "server"
    | "client";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  details?: any;
  timestamp: number;
  groupOrderId?: string;
  userId?: string;
  recovered: boolean;
  recoveryAttempts: number;
  lastRecoveryAttempt?: number;
}

export interface ConnectionState {
  status:
    | "connected"
    | "connecting"
    | "disconnected"
    | "reconnecting"
    | "failed"
    | "offline";
  quality: "excellent" | "good" | "fair" | "poor" | "critical";
  latency: number;
  lastConnected?: number;
  disconnectedAt?: number;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  nextReconnectDelay: number;
  stableConnectionTime: number;
}

export interface OfflineOperation {
  id: string;
  type: string;
  groupOrderId: string;
  operation: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  priority: "low" | "normal" | "high" | "critical";
}

export interface NetworkHealth {
  isOnline: boolean;
  effectiveType?: string; // '2g' | '3g' | '4g' | 'slow-2g' | undefined
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  lastChecked: number;
}

export interface RecoveryStrategy {
  name: string;
  condition: (error: RealtimeError, context: any) => boolean;
  action: (error: RealtimeError, context: any) => Promise<boolean>;
  priority: number;
  maxAttempts: number;
}

interface NetworkInformationLike extends EventTarget {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformationLike;
}

class RealtimeResilienceService {
  // 狀態管理
  private connectionState = ref<ConnectionState>({
    status: "disconnected",
    quality: "good",
    latency: 0,
    reconnectAttempts: 0,
    maxReconnectAttempts: 10,
    nextReconnectDelay: 1000,
    stableConnectionTime: 0,
  });

  private errors = ref<RealtimeError[]>([]);
  private offlineOperations = ref<OfflineOperation[]>([]);
  private networkHealth = ref<NetworkHealth>({
    isOnline: navigator.onLine,
    lastChecked: Date.now(),
  });

  // 恢復策略
  private recoveryStrategies = new Map<string, RecoveryStrategy>();

  // 配置
  private readonly ERROR_RETENTION_TIME = 24 * 60 * 60 * 1000; // 24小時
  private readonly OFFLINE_OPERATION_TTL = 7 * 24 * 60 * 60 * 1000; // 7天
  private readonly CONNECTION_HEALTH_CHECK_INTERVAL = 5000; // 5秒
  private readonly LATENCY_SAMPLES = 10;
  // 內部狀態
  private latencySamples: number[] = [];
  private healthCheckInterval?: number;
  private recoveryInProgress = new Set<string>();

  constructor() {
    this.initializeResilienceSystem();
    this.setupNetworkMonitoring();
    this.registerDefaultRecoveryStrategies();
  }

  /**
   * 初始化彈性系統
   */
  private initializeResilienceSystem(): void {
    // 監聽連接狀態變化
    this.monitorConnectionState();

    // 開始健康檢查
    this.startHealthCheck();

    // 處理頁面可見性變化
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.handlePageVisible();
      } else {
        this.handlePageHidden();
      }
    });

    // 處理瀏覽器離線/在線事件
    window.addEventListener("online", () => {
      this.handleNetworkOnline();
    });

    window.addEventListener("offline", () => {
      this.handleNetworkOffline();
    });
  }

  /**
   * 設置網絡監控
   */
  private setupNetworkMonitoring(): void {
    // 監控網絡質量
    const connection = (navigator as NavigatorWithConnection).connection;
    if (connection) {
      const updateNetworkInfo = () => {
        this.networkHealth.value = {
          isOnline: navigator.onLine,
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          saveData: connection.saveData,
          lastChecked: Date.now(),
        };

        this.assessConnectionQuality();
      };

      connection.addEventListener("change", updateNetworkInfo);
      updateNetworkInfo();
    }
  }

  /**
   * 評估連接質量
   */
  private assessConnectionQuality(): void {
    const network = this.networkHealth.value;
    const state = this.connectionState.value;

    let quality: ConnectionState["quality"] = "good";

    if (!network.isOnline) {
      quality = "critical";
    } else if (
      network.effectiveType === "slow-2g" ||
      (network.rtt && network.rtt > 2000)
    ) {
      quality = "poor";
    } else if (
      network.effectiveType === "2g" ||
      (network.rtt && network.rtt > 1000)
    ) {
      quality = "fair";
    } else if (state.latency > 500) {
      quality = "fair";
    } else if (state.latency < 100) {
      quality = "excellent";
    }

    if (state.quality !== quality) {
      state.quality = quality;
      this.adaptToNetworkConditions(quality);
    }
  }

  /**
   * 根據網絡狀況調整策略
   */
  private adaptToNetworkConditions(quality: ConnectionState["quality"]): void {
    switch (quality) {
      case "critical":
        // 離線模式，緩存所有操作
        console.log("Network critical: Switching to offline mode");
        break;

      case "poor":
        // 減少廣播頻率，增加批處理
        console.log("Poor network: Optimizing for low bandwidth");
        break;

      case "fair":
        // 適中策略
        console.log("Fair network: Using balanced approach");
        break;

      case "good":
      case "excellent":
        // 最佳性能模式
        console.log("Good network: Using full features");
        break;
    }
  }

  /**
   * 監控連接狀態
   */
  private monitorConnectionState(): void {
    // 這裡會監聽底層實時服務的狀態變化
    // 實際實現會與 realtimeService 整合
    setInterval(() => {
      this.updateConnectionState();
    }, 1000);
  }

  /**
   * 更新連接狀態
   */
  private updateConnectionState(): void {
    const realtimeStatus = realtimeService.getConnectionStatus();
    const state = this.connectionState.value;

    // 更新狀態
    if (realtimeStatus.value !== state.status) {
      const previousStatus = state.status;
      state.status =
        realtimeStatus.value === "error" ? "failed" : realtimeStatus.value;

      // 處理狀態變化
      this.handleConnectionStateChange(previousStatus, state.status);
    }

    // 更新穩定連接時間
    if (state.status === "connected") {
      if (state.lastConnected) {
        state.stableConnectionTime = Date.now() - state.lastConnected;
      }
    } else {
      state.stableConnectionTime = 0;
    }
  }

  /**
   * 處理連接狀態變化
   */
  private handleConnectionStateChange(
    previous: ConnectionState["status"],
    current: ConnectionState["status"],
  ): void {
    const state = this.connectionState.value;

    switch (current) {
      case "connected":
        state.lastConnected = Date.now();
        state.reconnectAttempts = 0;
        state.nextReconnectDelay = 1000;

        // 處理離線操作
        this.processOfflineOperations();
        break;

      case "disconnected":
        state.disconnectedAt = Date.now();

        // 開始重連
        this.initiateReconnection();
        break;

      case "failed":
        this.recordError({
          type: "connection",
          severity: "high",
          message: "Connection failed permanently",
          details: { previousState: previous },
        });
        break;
    }

    console.log(`Connection state changed: ${previous} -> ${current}`);
  }

  /**
   * 開始重連
   */
  private async initiateReconnection(): Promise<void> {
    const state = this.connectionState.value;

    if (state.reconnectAttempts >= state.maxReconnectAttempts) {
      state.status = "failed";
      return;
    }

    state.status = "reconnecting";
    state.reconnectAttempts++;

    // 指數退避
    const delay = Math.min(
      state.nextReconnectDelay * Math.pow(2, state.reconnectAttempts - 1),
      30000, // 最大30秒
    );

    console.log(
      `Reconnecting in ${delay}ms (attempt ${state.reconnectAttempts})`,
    );

    setTimeout(async () => {
      try {
        state.status = "connecting";
        await realtimeService.reconnect();

        // 連接成功由狀態監控器處理
      } catch (error) {
        console.error("Reconnection failed:", error);

        this.recordError({
          type: "connection",
          severity: "medium",
          message: "Reconnection attempt failed",
          details: { attempt: state.reconnectAttempts, error },
        });

        // 繼續重試
        this.initiateReconnection();
      }
    }, delay);
  }

  /**
   * 開始健康檢查
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = window.setInterval(() => {
      this.performHealthCheck();
    }, this.CONNECTION_HEALTH_CHECK_INTERVAL);
  }

  /**
   * 執行健康檢查
   */
  private async performHealthCheck(): Promise<void> {
    if (this.connectionState.value.status !== "connected") {
      return;
    }

    try {
      const startTime = Date.now();
      const success = await realtimeService.ping();
      const latency = Date.now() - startTime;

      if (success) {
        this.updateLatency(latency);
      } else {
        this.recordError({
          type: "network",
          severity: "medium",
          message: "Health check ping failed",
        });
      }
    } catch (error) {
      this.recordError({
        type: "network",
        severity: "medium",
        message: "Health check error",
        details: error,
      });
    }
  }

  /**
   * 更新延遲統計
   */
  private updateLatency(latency: number): void {
    this.latencySamples.push(latency);

    if (this.latencySamples.length > this.LATENCY_SAMPLES) {
      this.latencySamples.shift();
    }

    // 計算平均延遲
    const avgLatency =
      this.latencySamples.reduce((a, b) => a + b, 0) /
      this.latencySamples.length;
    this.connectionState.value.latency = Math.round(avgLatency);

    // 評估連接質量
    this.assessConnectionQuality();
  }

  /**
   * 記錄錯誤
   */
  recordError(
    error: Omit<
      RealtimeError,
      "id" | "timestamp" | "recovered" | "recoveryAttempts"
    >,
  ): void {
    const fullError: RealtimeError = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      recovered: false,
      recoveryAttempts: 0,
      ...error,
    };

    this.errors.value.unshift(fullError);

    // 限制錯誤記錄數量
    if (this.errors.value.length > 1000) {
      this.errors.value = this.errors.value.slice(0, 1000);
    }

    // 嘗試恢復
    this.attemptErrorRecovery(fullError);

    console.error("Realtime error recorded:", fullError);
  }

  /**
   * 嘗試錯誤恢復
   */
  private async attemptErrorRecovery(error: RealtimeError): Promise<void> {
    if (this.recoveryInProgress.has(error.id)) {
      return;
    }

    this.recoveryInProgress.add(error.id);

    try {
      // 找到適用的恢復策略
      const strategies = Array.from(this.recoveryStrategies.values())
        .filter((strategy) => strategy.condition(error, {}))
        .sort((a, b) => b.priority - a.priority);

      for (const strategy of strategies) {
        if (error.recoveryAttempts >= strategy.maxAttempts) {
          continue;
        }

        console.log(`Attempting recovery with strategy: ${strategy.name}`);

        error.recoveryAttempts++;
        error.lastRecoveryAttempt = Date.now();

        try {
          const success = await strategy.action(error, {});

          if (success) {
            error.recovered = true;
            console.log(`Error recovered using strategy: ${strategy.name}`);
            break;
          }
        } catch (recoveryError) {
          console.error(
            `Recovery strategy ${strategy.name} failed:`,
            recoveryError,
          );
        }
      }
    } finally {
      this.recoveryInProgress.delete(error.id);
    }
  }

  /**
   * 註冊默認恢復策略
   */
  private registerDefaultRecoveryStrategies(): void {
    // 連接重試策略
    this.recoveryStrategies.set("connection-retry", {
      name: "Connection Retry",
      condition: (error) =>
        error.type === "connection" && error.severity !== "critical",
      action: async () => {
        await realtimeService.reconnect();
        return this.connectionState.value.status === "connected";
      },
      priority: 10,
      maxAttempts: 5,
    });

    // 狀態重新同步策略
    this.recoveryStrategies.set("state-resync", {
      name: "State Resync",
      condition: (error) => error.type === "sync" || error.type === "data",
      action: async (error) => {
        if (error.groupOrderId) {
          await groupOrderBroadcastService.triggerResync(error.groupOrderId);
          return true;
        }
        return false;
      },
      priority: 8,
      maxAttempts: 3,
    });

    // 權限重新驗證策略
    this.recoveryStrategies.set("permission-reauth", {
      name: "Permission Reauth",
      condition: (error) => error.type === "permission",
      action: async () => {
        // 重新獲取權限或刷新令牌
        const token = localStorage.getItem("auth_token");
        if (token) {
          // 驗證令牌有效性
          return true;
        }
        return false;
      },
      priority: 6,
      maxAttempts: 2,
    });

    // 緩存清理策略
    this.recoveryStrategies.set("cache-clear", {
      name: "Cache Clear",
      condition: (error) => error.type === "data" && error.severity === "high",
      action: async () => {
        // 清理本地緩存並重新加載
        localStorage.removeItem("realtime_cache");
        location.reload();
        return true;
      },
      priority: 2,
      maxAttempts: 1,
    });
  }

  /**
   * 添加離線操作
   */
  addOfflineOperation(
    operation: Omit<OfflineOperation, "id" | "timestamp" | "retryCount">,
  ): void {
    const offlineOp: OfflineOperation = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retryCount: 0,
      ...operation,
    };

    this.offlineOperations.value.push(offlineOp);

    console.log("Added offline operation:", offlineOp.type);
  }

  /**
   * 處理離線操作
   */
  private async processOfflineOperations(): Promise<void> {
    const operations = [...this.offlineOperations.value];
    const now = Date.now();

    console.log(`Processing ${operations.length} offline operations`);

    for (const operation of operations) {
      // 檢查是否過期
      if (now - operation.timestamp > this.OFFLINE_OPERATION_TTL) {
        this.removeOfflineOperation(operation.id);
        continue;
      }

      // 檢查是否超過重試次數
      if (operation.retryCount >= operation.maxRetries) {
        this.removeOfflineOperation(operation.id);
        continue;
      }

      try {
        operation.retryCount++;

        // 重新執行操作
        await this.executeOfflineOperation(operation);

        // 成功後移除
        this.removeOfflineOperation(operation.id);

        console.log(`Offline operation executed: ${operation.type}`);
      } catch (error) {
        console.error(
          `Failed to execute offline operation ${operation.id}:`,
          error,
        );

        this.recordError({
          type: "sync",
          severity: "medium",
          message: "Failed to execute offline operation",
          details: { operation, error },
          groupOrderId: operation.groupOrderId,
        });
      }
    }
  }

  /**
   * 執行離線操作
   */
  private async executeOfflineOperation(
    operation: OfflineOperation,
  ): Promise<void> {
    switch (operation.type) {
      case "broadcast_operation":
        await groupOrderBroadcastService.broadcastOperation(
          operation.groupOrderId,
          operation.operation,
        );
        break;

      case "collaborative_action":
        await collaborativeOrderService.handleRealtimeEdit(
          operation.groupOrderId,
          operation.operation.entityType,
          operation.operation.entityId,
          operation.operation.userId,
          operation.operation.changes,
        );
        break;

      default:
        throw new Error(`Unknown offline operation type: ${operation.type}`);
    }
  }

  /**
   * 移除離線操作
   */
  private removeOfflineOperation(operationId: string): void {
    const index = this.offlineOperations.value.findIndex(
      (op) => op.id === operationId,
    );
    if (index !== -1) {
      this.offlineOperations.value.splice(index, 1);
    }
  }

  /**
   * 處理頁面可見
   */
  private handlePageVisible(): void {
    console.log("Page became visible, checking connection");

    // 如果離線時間超過閾值，觸發完整同步
    const state = this.connectionState.value;
    if (state.disconnectedAt && Date.now() - state.disconnectedAt > 60000) {
      this.triggerFullSync();
    }
  }

  /**
   * 處理頁面隱藏
   */
  private handlePageHidden(): void {
    console.log("Page became hidden");
    // 可以在這裡暫停一些非必要的活動
  }

  /**
   * 處理網絡上線
   */
  private handleNetworkOnline(): void {
    console.log("Network came online");
    this.networkHealth.value.isOnline = true;
    this.networkHealth.value.lastChecked = Date.now();

    // 嘗試重連
    if (this.connectionState.value.status === "disconnected") {
      this.initiateReconnection();
    }
  }

  /**
   * 處理網絡離線
   */
  private handleNetworkOffline(): void {
    console.log("Network went offline");
    this.networkHealth.value.isOnline = false;
    this.networkHealth.value.lastChecked = Date.now();
    this.connectionState.value.status = "offline";
  }

  /**
   * 觸發完整同步
   */
  private async triggerFullSync(): Promise<void> {
    console.log("Triggering full synchronization");

    // 這裡會觸發所有活躍群組訂單的重新同步
    // 實際實現需要與群組訂單服務整合
  }

  /**
   * 清理過期數據
   */
  private cleanup(): void {
    const now = Date.now();

    // 清理過期錯誤
    this.errors.value = this.errors.value.filter(
      (error) => now - error.timestamp < this.ERROR_RETENTION_TIME,
    );

    // 清理過期離線操作
    this.offlineOperations.value = this.offlineOperations.value.filter(
      (operation) => now - operation.timestamp < this.OFFLINE_OPERATION_TTL,
    );
  }

  /**
   * 公共 API
   */

  // 獲取連接狀態
  getConnectionState(): Readonly<ConnectionState> {
    return { ...this.connectionState.value };
  }

  // 獲取網絡健康狀況
  getNetworkHealth(): Readonly<NetworkHealth> {
    return { ...this.networkHealth.value };
  }

  // 獲取錯誤列表
  getErrors(severity?: RealtimeError["severity"]): RealtimeError[] {
    if (severity) {
      return this.errors.value.filter((error) => error.severity === severity);
    }
    return [...this.errors.value];
  }

  // 獲取未恢復的錯誤
  getUnrecoveredErrors(): RealtimeError[] {
    return this.errors.value.filter((error) => !error.recovered);
  }

  // 獲取離線操作
  getOfflineOperations(): OfflineOperation[] {
    return [...this.offlineOperations.value];
  }

  // 手動觸發恢復
  async forceRecovery(): Promise<void> {
    console.log("Forcing recovery for all unrecovered errors");

    const unrecoveredErrors = this.getUnrecoveredErrors();
    for (const error of unrecoveredErrors) {
      await this.attemptErrorRecovery(error);
    }
  }

  // 清除錯誤
  clearErrors(errorIds?: string[]): void {
    if (errorIds) {
      this.errors.value = this.errors.value.filter(
        (error) => !errorIds.includes(error.id),
      );
    } else {
      this.errors.value = [];
    }
  }

  // 註冊自定義恢復策略
  registerRecoveryStrategy(strategy: RecoveryStrategy): void {
    this.recoveryStrategies.set(strategy.name, strategy);
  }

  // 停止服務
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.cleanup();
  }
}

// 單例實例
export const realtimeResilienceService = new RealtimeResilienceService();
export default realtimeResilienceService;
