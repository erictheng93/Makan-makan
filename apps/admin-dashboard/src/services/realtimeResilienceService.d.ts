/**
 * 實時連接彈性和錯誤處理服務
 *
 * 提供強健的連接管理、自動重連、錯誤恢復、離線支持、
 * 數據同步和網絡狀況適配等功能
 */
export interface RealtimeError {
    id: string;
    type: "connection" | "sync" | "permission" | "data" | "network" | "server" | "client";
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
    status: "connected" | "connecting" | "disconnected" | "reconnecting" | "failed" | "offline";
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
    effectiveType?: string;
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
declare class RealtimeResilienceService {
    private connectionState;
    private errors;
    private offlineOperations;
    private networkHealth;
    private recoveryStrategies;
    private readonly ERROR_RETENTION_TIME;
    private readonly OFFLINE_OPERATION_TTL;
    private readonly CONNECTION_HEALTH_CHECK_INTERVAL;
    private readonly LATENCY_SAMPLES;
    private latencySamples;
    private healthCheckInterval?;
    private recoveryInProgress;
    constructor();
    /**
     * 初始化彈性系統
     */
    private initializeResilienceSystem;
    /**
     * 設置網絡監控
     */
    private setupNetworkMonitoring;
    /**
     * 評估連接質量
     */
    private assessConnectionQuality;
    /**
     * 根據網絡狀況調整策略
     */
    private adaptToNetworkConditions;
    /**
     * 監控連接狀態
     */
    private monitorConnectionState;
    /**
     * 更新連接狀態
     */
    private updateConnectionState;
    /**
     * 處理連接狀態變化
     */
    private handleConnectionStateChange;
    /**
     * 開始重連
     */
    private initiateReconnection;
    /**
     * 開始健康檢查
     */
    private startHealthCheck;
    /**
     * 執行健康檢查
     */
    private performHealthCheck;
    /**
     * 更新延遲統計
     */
    private updateLatency;
    /**
     * 記錄錯誤
     */
    recordError(error: Omit<RealtimeError, "id" | "timestamp" | "recovered" | "recoveryAttempts">): void;
    /**
     * 嘗試錯誤恢復
     */
    private attemptErrorRecovery;
    /**
     * 註冊默認恢復策略
     */
    private registerDefaultRecoveryStrategies;
    /**
     * 添加離線操作
     */
    addOfflineOperation(operation: Omit<OfflineOperation, "id" | "timestamp" | "retryCount">): void;
    /**
     * 處理離線操作
     */
    private processOfflineOperations;
    /**
     * 執行離線操作
     */
    private executeOfflineOperation;
    /**
     * 移除離線操作
     */
    private removeOfflineOperation;
    /**
     * 處理頁面可見
     */
    private handlePageVisible;
    /**
     * 處理頁面隱藏
     */
    private handlePageHidden;
    /**
     * 處理網絡上線
     */
    private handleNetworkOnline;
    /**
     * 處理網絡離線
     */
    private handleNetworkOffline;
    /**
     * 觸發完整同步
     */
    private triggerFullSync;
    /**
     * 清理過期數據
     */
    private cleanup;
    /**
     * 公共 API
     */
    getConnectionState(): Readonly<ConnectionState>;
    getNetworkHealth(): Readonly<NetworkHealth>;
    getErrors(severity?: RealtimeError["severity"]): RealtimeError[];
    getUnrecoveredErrors(): RealtimeError[];
    getOfflineOperations(): OfflineOperation[];
    forceRecovery(): Promise<void>;
    clearErrors(errorIds?: string[]): void;
    registerRecoveryStrategy(strategy: RecoveryStrategy): void;
    stop(): void;
}
export declare const realtimeResilienceService: RealtimeResilienceService;
export default realtimeResilienceService;
