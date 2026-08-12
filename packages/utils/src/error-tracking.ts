/**
 * Enhanced Error Tracking System
 *
 * Comprehensive error tracking with context, breadcrumbs, and reporting
 */

// Browser-only paths, but packages that omit the DOM lib compile this file
// too, so the two globals it touches are declared structurally rather than
// pulled from lib.dom. Typed shapes, not `any`: reading a field the handler
// does not declare still fails the build.
type ErrorEventLike = {
  readonly error?: unknown;
  readonly message?: string;
  readonly filename?: string;
  readonly lineno?: number;
  readonly colno?: number;
};

type PromiseRejectionEventLike = {
  readonly reason?: unknown;
};

declare const window: {
  addEventListener(
    type: "error",
    listener: (event: ErrorEventLike) => void,
  ): void;
  addEventListener(
    type: "unhandledrejection",
    listener: (event: PromiseRejectionEventLike) => void,
  ): void;
};

export type ErrorSeverity = "low" | "medium" | "high" | "critical";
export type ErrorCategory =
  | "network"
  | "validation"
  | "database"
  | "authentication"
  | "business"
  | "system"
  | "unknown";

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
    body?: unknown;
    params?: Record<string, unknown>;
    query?: Record<string, unknown>;
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
  extra?: Record<string, unknown>;
}

export interface ErrorBreadcrumb {
  timestamp: number;
  category: string;
  message: string;
  level: "debug" | "info" | "warning" | "error";
  data?: Record<string, unknown>;
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

export class ErrorTracker {
  private options: Required<
    Omit<ErrorTrackingOptions, "beforeSend" | "onError">
  > &
    Pick<ErrorTrackingOptions, "beforeSend" | "onError">;
  private breadcrumbs: ErrorBreadcrumb[] = [];
  private errors: Map<string, TrackedError> = new Map();
  private context: ErrorContext = {};

  constructor(options: ErrorTrackingOptions = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      captureConsoleErrors: options.captureConsoleErrors ?? true,
      captureUnhandledRejections: options.captureUnhandledRejections ?? true,
      maxBreadcrumbs: options.maxBreadcrumbs ?? 50,
      sampleRate: options.sampleRate ?? 1.0,
      debug: options.debug ?? false,
      beforeSend: options.beforeSend,
      onError: options.onError,
    };

    if (this.options.enabled) {
      this.setupGlobalHandlers();
    }
  }

  /**
   * Set global context (persists across errors)
   */
  setContext(context: Partial<ErrorContext>): void {
    this.context = {
      ...this.context,
      ...context,
    };
  }

  /**
   * Set user context
   */
  setUser(user: ErrorContext["user"]): void {
    this.context.user = user;
  }

  /**
   * Add breadcrumb for debugging
   */
  addBreadcrumb(breadcrumb: Omit<ErrorBreadcrumb, "timestamp">): void {
    this.breadcrumbs.push({
      ...breadcrumb,
      timestamp: Date.now(),
    });

    // Keep only last N breadcrumbs
    if (this.breadcrumbs.length > this.options.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }

    if (this.options.debug) {
      console.log("[ErrorTracker] Breadcrumb:", breadcrumb);
    }
  }

  /**
   * Capture an error
   */
  captureError(
    error: Error | string,
    options: {
      severity?: ErrorSeverity;
      category?: ErrorCategory;
      context?: Partial<ErrorContext>;
    } = {},
  ): string {
    if (!this.options.enabled) {
      return "";
    }

    // Sample rate check
    if (Math.random() > this.options.sampleRate) {
      return "";
    }

    const errorObj = typeof error === "string" ? new Error(error) : error;

    const errorId = this.generateErrorId(errorObj);
    const now = Date.now();

    // Check if error already exists
    const existing = this.errors.get(errorId);

    let trackedError: TrackedError;

    if (existing) {
      // Update existing error
      trackedError = {
        ...existing,
        occurrenceCount: existing.occurrenceCount + 1,
        lastOccurrence: now,
        breadcrumbs: [...this.breadcrumbs],
      };
    } else {
      // Create new error
      const errorWithCode = errorObj as Error & {
        code?: string | number;
      };
      const rawCode = errorWithCode.code;

      trackedError = {
        id: errorId,
        message: errorObj.message,
        stack: errorObj.stack,
        name: errorObj.name,
        code: typeof rawCode === "number" ? String(rawCode) : rawCode,
        severity: options.severity ?? this.categorizeSeverity(errorObj),
        category: options.category ?? this.categorizeError(errorObj),
        context: {
          ...this.context,
          ...options.context,
        },
        breadcrumbs: [...this.breadcrumbs],
        timestamp: now,
        resolved: false,
        occurrenceCount: 1,
        firstOccurrence: now,
        lastOccurrence: now,
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
      Promise.resolve(this.options.onError(trackedError)).catch((err) => {
        console.error("[ErrorTracker] Failed to report error:", err);
      });
    }

    if (this.options.debug) {
      console.log("[ErrorTracker] Captured error:", trackedError);
    }

    return errorId;
  }

  /**
   * Capture exception with additional context
   */
  captureException(error: Error, context?: Partial<ErrorContext>): string {
    return this.captureError(error, {
      severity: "high",
      category: "system",
      context,
    });
  }

  /**
   * Capture message (non-error)
   */
  captureMessage(
    message: string,
    severity: ErrorSeverity = "low",
    context?: Partial<ErrorContext>,
  ): string {
    return this.captureError(new Error(message), {
      severity,
      category: "unknown",
      context,
    });
  }

  /**
   * Get all tracked errors
   */
  getErrors(): TrackedError[] {
    return Array.from(this.errors.values());
  }

  /**
   * Get error by ID
   */
  getError(id: string): TrackedError | undefined {
    return this.errors.get(id);
  }

  /**
   * Mark error as resolved
   */
  resolveError(id: string): void {
    const error = this.errors.get(id);
    if (error) {
      error.resolved = true;
      this.errors.set(id, error);
    }
  }

  /**
   * Clear all errors
   */
  clearErrors(): void {
    this.errors.clear();
  }

  /**
   * Clear breadcrumbs
   */
  clearBreadcrumbs(): void {
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
      critical: 0,
    };
    const byCategory: Record<ErrorCategory, number> = {
      network: 0,
      validation: 0,
      database: 0,
      authentication: 0,
      business: 0,
      system: 0,
      unknown: 0,
    };

    errors.forEach((error) => {
      bySeverity[error.severity]++;
      byCategory[error.category]++;
    });

    return {
      total: errors.length,
      unresolved: errors.filter((e) => !e.resolved).length,
      bySeverity,
      byCategory,
      breadcrumbCount: this.breadcrumbs.length,
    };
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(error: Error): string {
    const stack = error.stack || "";
    const firstLine = stack.split("\n")[1] || error.message;
    return `${error.name}:${error.message}:${firstLine}`
      .replace(/\s+/g, "_")
      .slice(0, 100);
  }

  /**
   * Categorize error severity
   */
  private categorizeSeverity(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase();

    if (message.includes("critical") || message.includes("fatal")) {
      return "critical";
    }
    if (message.includes("network") || message.includes("timeout")) {
      return "medium";
    }
    if (message.includes("validation") || message.includes("invalid")) {
      return "low";
    }

    return "medium";
  }

  /**
   * Categorize error type
   */
  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    if (
      message.includes("network") ||
      message.includes("fetch") ||
      name.includes("networkerror")
    ) {
      return "network";
    }
    if (
      message.includes("validation") ||
      message.includes("invalid") ||
      name.includes("validationerror")
    ) {
      return "validation";
    }
    if (
      message.includes("database") ||
      message.includes("sql") ||
      name.includes("databaseerror")
    ) {
      return "database";
    }
    if (
      message.includes("auth") ||
      message.includes("unauthorized") ||
      name.includes("autherror")
    ) {
      return "authentication";
    }

    return "unknown";
  }

  /**
   * Setup global error handlers
   */
  private setupGlobalHandlers(): void {
    if (typeof window === "undefined") {
      return;
    }

    // Capture unhandled errors
    if (this.options.captureConsoleErrors) {
      window.addEventListener("error", (event: ErrorEventLike) => {
        // An ErrorEvent may carry neither an Error nor a message; `any`
        // previously let that undefined through to captureError.
        const thrown =
          event.error instanceof Error
            ? event.error
            : (event.message ?? "Unknown window error");

        this.captureError(thrown, {
          severity: "high",
          category: "system",
          context: {
            extra: {
              filename: event.filename,
              lineno: event.lineno,
              colno: event.colno,
            },
          },
        });
      });
    }

    // Capture unhandled promise rejections
    if (this.options.captureUnhandledRejections) {
      window.addEventListener(
        "unhandledrejection",
        (event: PromiseRejectionEventLike) => {
          const error =
            event.reason instanceof Error
              ? event.reason
              : new Error(String(event.reason));

          this.captureError(error, {
            severity: "high",
            category: "system",
          });
        },
      );
    }
  }
}

/**
 * Global error tracker instance
 */
let globalTracker: ErrorTracker | null = null;

export function getErrorTracker(options?: ErrorTrackingOptions): ErrorTracker {
  if (!globalTracker) {
    globalTracker = new ErrorTracker(options);
  }
  return globalTracker;
}

export function resetErrorTracker(): void {
  globalTracker = null;
}
