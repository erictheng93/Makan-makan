/**
 * Enhanced Error Tracking System
 *
 * Comprehensive error tracking with context, breadcrumbs, and reporting
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ErrorCategory = 'network' | 'validation' | 'database' | 'authentication' | 'business' | 'system' | 'unknown';
export interface ErrorContext {
    /**
     * User information
     */
    user?: {
        id?: string | number;
        role?: string;
        email?: string;
    };
    /**
     * Request context
     */
    request?: {
        url?: string;
        method?: string;
        headers?: Record<string, string>;
        body?: any;
        params?: Record<string, any>;
        query?: Record<string, any>;
    };
    /**
     * Application state
     */
    app?: {
        version?: string;
        environment?: string;
        userAgent?: string;
        referrer?: string;
    };
    /**
     * Additional custom context
     */
    extra?: Record<string, any>;
}
export interface ErrorBreadcrumb {
    timestamp: number;
    category: string;
    message: string;
    level: 'debug' | 'info' | 'warning' | 'error';
    data?: Record<string, any>;
}
export interface TrackedError {
    id: string;
    message: string;
    stack?: string;
    name: string;
    code?: string;
    severity: ErrorSeverity;
    category: ErrorCategory;
    context: ErrorContext;
    breadcrumbs: ErrorBreadcrumb[];
    timestamp: number;
    resolved: boolean;
    occurrenceCount: number;
    firstOccurrence: number;
    lastOccurrence: number;
}
export interface ErrorTrackingOptions {
    /**
     * Enable error tracking
     * @default true
     */
    enabled?: boolean;
    /**
     * Automatically capture console errors
     * @default true
     */
    captureConsoleErrors?: boolean;
    /**
     * Automatically capture unhandled rejections
     * @default true
     */
    captureUnhandledRejections?: boolean;
    /**
     * Maximum number of breadcrumbs to keep
     * @default 50
     */
    maxBreadcrumbs?: number;
    /**
     * Sample rate (0-1)
     * @default 1.0
     */
    sampleRate?: number;
    /**
     * Before send hook - can modify or filter errors
     */
    beforeSend?: (error: TrackedError) => TrackedError | null;
    /**
     * Error reporter function
     */
    onError?: (error: TrackedError) => void | Promise<void>;
    /**
     * Debug logging
     * @default false
     */
    debug?: boolean;
}
export declare class ErrorTracker {
    private options;
    private breadcrumbs;
    private errors;
    private context;
    constructor(options?: ErrorTrackingOptions);
    /**
     * Set global context (persists across errors)
     */
    setContext(context: Partial<ErrorContext>): void;
    /**
     * Set user context
     */
    setUser(user: ErrorContext['user']): void;
    /**
     * Add breadcrumb for debugging
     */
    addBreadcrumb(breadcrumb: Omit<ErrorBreadcrumb, 'timestamp'>): void;
    /**
     * Capture an error
     */
    captureError(error: Error | string, options?: {
        severity?: ErrorSeverity;
        category?: ErrorCategory;
        context?: Partial<ErrorContext>;
    }): string;
    /**
     * Capture exception with additional context
     */
    captureException(error: Error, context?: Partial<ErrorContext>): string;
    /**
     * Capture message (non-error)
     */
    captureMessage(message: string, severity?: ErrorSeverity, context?: Partial<ErrorContext>): string;
    /**
     * Get all tracked errors
     */
    getErrors(): TrackedError[];
    /**
     * Get error by ID
     */
    getError(id: string): TrackedError | undefined;
    /**
     * Mark error as resolved
     */
    resolveError(id: string): void;
    /**
     * Clear all errors
     */
    clearErrors(): void;
    /**
     * Clear breadcrumbs
     */
    clearBreadcrumbs(): void;
    /**
     * Get statistics
     */
    getStats(): {
        total: number;
        unresolved: number;
        bySeverity: {
            low: number;
            medium: number;
            high: number;
            critical: number;
        };
        byCategory: Record<ErrorCategory, number>;
        breadcrumbCount: number;
    };
    /**
     * Generate unique error ID
     */
    private generateErrorId;
    /**
     * Categorize error severity
     */
    private categorizeSeverity;
    /**
     * Categorize error type
     */
    private categorizeError;
    /**
     * Setup global error handlers
     */
    private setupGlobalHandlers;
}
export declare function getErrorTracker(options?: ErrorTrackingOptions): ErrorTracker;
export declare function resetErrorTracker(): void;
