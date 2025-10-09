/**
 * Enhanced Error Tracking System
 *
 * Comprehensive error tracking with context, breadcrumbs, and reporting
 */
export class ErrorTracker {
    constructor(options = {}) {
        Object.defineProperty(this, "options", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "breadcrumbs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "errors", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: new Map()
        });
        Object.defineProperty(this, "context", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: {}
        });
        this.options = {
            enabled: options.enabled ?? true,
            captureConsoleErrors: options.captureConsoleErrors ?? true,
            captureUnhandledRejections: options.captureUnhandledRejections ?? true,
            maxBreadcrumbs: options.maxBreadcrumbs ?? 50,
            sampleRate: options.sampleRate ?? 1.0,
            debug: options.debug ?? false,
            beforeSend: options.beforeSend,
            onError: options.onError
        };
        if (this.options.enabled) {
            this.setupGlobalHandlers();
        }
    }
    /**
     * Set global context (persists across errors)
     */
    setContext(context) {
        this.context = {
            ...this.context,
            ...context
        };
    }
    /**
     * Set user context
     */
    setUser(user) {
        this.context.user = user;
    }
    /**
     * Add breadcrumb for debugging
     */
    addBreadcrumb(breadcrumb) {
        this.breadcrumbs.push({
            ...breadcrumb,
            timestamp: Date.now()
        });
        // Keep only last N breadcrumbs
        if (this.breadcrumbs.length > this.options.maxBreadcrumbs) {
            this.breadcrumbs.shift();
        }
        if (this.options.debug) {
            console.log('[ErrorTracker] Breadcrumb:', breadcrumb);
        }
    }
    /**
     * Capture an error
     */
    captureError(error, options = {}) {
        if (!this.options.enabled) {
            return '';
        }
        // Sample rate check
        if (Math.random() > this.options.sampleRate) {
            return '';
        }
        const errorObj = typeof error === 'string' ? new Error(error) : error;
        const errorId = this.generateErrorId(errorObj);
        const now = Date.now();
        // Check if error already exists
        const existing = this.errors.get(errorId);
        let trackedError;
        if (existing) {
            // Update existing error
            trackedError = {
                ...existing,
                occurrenceCount: existing.occurrenceCount + 1,
                lastOccurrence: now,
                breadcrumbs: [...this.breadcrumbs]
            };
        }
        else {
            // Create new error
            trackedError = {
                id: errorId,
                message: errorObj.message,
                stack: errorObj.stack,
                name: errorObj.name,
                code: errorObj.code,
                severity: options.severity ?? this.categorizeSeverity(errorObj),
                category: options.category ?? this.categorizeError(errorObj),
                context: {
                    ...this.context,
                    ...options.context
                },
                breadcrumbs: [...this.breadcrumbs],
                timestamp: now,
                resolved: false,
                occurrenceCount: 1,
                firstOccurrence: now,
                lastOccurrence: now
            };
        }
        // Apply beforeSend hook
        if (this.options.beforeSend) {
            const modified = this.options.beforeSend(trackedError);
            if (!modified) {
                return errorId; // Error filtered out
            }
            trackedError = modified;
        }
        // Store error
        this.errors.set(errorId, trackedError);
        // Report error
        if (this.options.onError) {
            Promise.resolve(this.options.onError(trackedError)).catch(err => {
                console.error('[ErrorTracker] Failed to report error:', err);
            });
        }
        if (this.options.debug) {
            console.log('[ErrorTracker] Captured error:', trackedError);
        }
        return errorId;
    }
    /**
     * Capture exception with additional context
     */
    captureException(error, context) {
        return this.captureError(error, {
            severity: 'high',
            category: 'system',
            context
        });
    }
    /**
     * Capture message (non-error)
     */
    captureMessage(message, severity = 'low', context) {
        return this.captureError(new Error(message), {
            severity,
            category: 'unknown',
            context
        });
    }
    /**
     * Get all tracked errors
     */
    getErrors() {
        return Array.from(this.errors.values());
    }
    /**
     * Get error by ID
     */
    getError(id) {
        return this.errors.get(id);
    }
    /**
     * Mark error as resolved
     */
    resolveError(id) {
        const error = this.errors.get(id);
        if (error) {
            error.resolved = true;
            this.errors.set(id, error);
        }
    }
    /**
     * Clear all errors
     */
    clearErrors() {
        this.errors.clear();
    }
    /**
     * Clear breadcrumbs
     */
    clearBreadcrumbs() {
        this.breadcrumbs = [];
    }
    /**
     * Get statistics
     */
    getStats() {
        const errors = this.getErrors();
        const bySeverity = {
            low: 0,
            medium: 0,
            high: 0,
            critical: 0
        };
        const byCategory = {
            network: 0,
            validation: 0,
            database: 0,
            authentication: 0,
            business: 0,
            system: 0,
            unknown: 0
        };
        errors.forEach(error => {
            bySeverity[error.severity]++;
            byCategory[error.category]++;
        });
        return {
            total: errors.length,
            unresolved: errors.filter(e => !e.resolved).length,
            bySeverity,
            byCategory,
            breadcrumbCount: this.breadcrumbs.length
        };
    }
    /**
     * Generate unique error ID
     */
    generateErrorId(error) {
        const stack = error.stack || '';
        const firstLine = stack.split('\n')[1] || error.message;
        return `${error.name}:${error.message}:${firstLine}`.replace(/\s+/g, '_').slice(0, 100);
    }
    /**
     * Categorize error severity
     */
    categorizeSeverity(error) {
        const message = error.message.toLowerCase();
        if (message.includes('critical') || message.includes('fatal')) {
            return 'critical';
        }
        if (message.includes('network') || message.includes('timeout')) {
            return 'medium';
        }
        if (message.includes('validation') || message.includes('invalid')) {
            return 'low';
        }
        return 'medium';
    }
    /**
     * Categorize error type
     */
    categorizeError(error) {
        const message = error.message.toLowerCase();
        const name = error.name.toLowerCase();
        if (message.includes('network') || message.includes('fetch') || name.includes('networkerror')) {
            return 'network';
        }
        if (message.includes('validation') || message.includes('invalid') || name.includes('validationerror')) {
            return 'validation';
        }
        if (message.includes('database') || message.includes('sql') || name.includes('databaseerror')) {
            return 'database';
        }
        if (message.includes('auth') || message.includes('unauthorized') || name.includes('autherror')) {
            return 'authentication';
        }
        return 'unknown';
    }
    /**
     * Setup global error handlers
     */
    setupGlobalHandlers() {
        if (typeof window === 'undefined') {
            return;
        }
        // Capture unhandled errors
        if (this.options.captureConsoleErrors) {
            window.addEventListener('error', (event) => {
                this.captureError(event.error || event.message, {
                    severity: 'high',
                    category: 'system',
                    context: {
                        extra: {
                            filename: event.filename,
                            lineno: event.lineno,
                            colno: event.colno
                        }
                    }
                });
            });
        }
        // Capture unhandled promise rejections
        if (this.options.captureUnhandledRejections) {
            window.addEventListener('unhandledrejection', (event) => {
                const error = event.reason instanceof Error
                    ? event.reason
                    : new Error(String(event.reason));
                this.captureError(error, {
                    severity: 'high',
                    category: 'system'
                });
            });
        }
    }
}
/**
 * Global error tracker instance
 */
let globalTracker = null;
export function getErrorTracker(options) {
    if (!globalTracker) {
        globalTracker = new ErrorTracker(options);
    }
    return globalTracker;
}
export function resetErrorTracker() {
    globalTracker = null;
}
