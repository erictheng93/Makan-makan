export declare enum ErrorType {
    NETWORK = "network",
    API = "api",
    SSE = "sse",
    VALIDATION = "validation",
    PERMISSION = "permission",
    UNKNOWN = "unknown"
}
export declare enum ErrorSeverity {
    LOW = "low",
    MEDIUM = "medium",
    HIGH = "high",
    CRITICAL = "critical"
}
export interface ErrorDetails {
    type: ErrorType;
    severity: ErrorSeverity;
    code?: string | number;
    message: string;
    originalError?: any;
    context?: Record<string, any>;
    timestamp: Date;
    userAgent?: string;
    url?: string;
    userId?: number | string;
    restaurantId?: number | string;
}
declare class OfflineManager {
    private isOnline;
    private callbacks;
    private pendingRequests;
    constructor();
    private setupEventListeners;
    private notifyCallbacks;
    private processPendingRequests;
    onStatusChange(callback: (isOnline: boolean) => void): void;
    addPendingRequest(request: () => Promise<any>): void;
    getStatus(): boolean;
}
export declare class ErrorHandler {
    private static instance;
    private offlineManager;
    private reportingService;
    private userNotificationEnabled;
    static getInstance(): ErrorHandler;
    handleError(error: any, context?: Record<string, any>): ErrorDetails;
    private parseError;
    private showUserNotification;
    setUserNotificationEnabled(enabled: boolean): void;
    getOfflineManager(): OfflineManager;
}
export declare class KitchenErrorHandler extends ErrorHandler {
    private sseReconnectAttempts;
    private maxReconnectAttempts;
    private reconnectDelay;
    private sseEventSource;
    static handleSSEError(error: Event, eventSource?: EventSource): void;
    static handleAPIError(error: any, context?: Record<string, any>): any;
    handleSSEConnectionError(error: Event, eventSource?: EventSource): void;
    private attemptSSEReconnect;
    resetSSEReconnectAttempts(): void;
    setSSEConnected(eventSource: EventSource): void;
    handleAPIRequest(error: any, context?: Record<string, any>): Promise<any>;
    private handleOfflineRequest;
    private handleTokenRefresh;
}
export declare const errorHandler: ErrorHandler;
export declare const kitchenErrorHandler: KitchenErrorHandler;
export declare function setupGlobalErrorHandler(): void;
export default ErrorHandler;
