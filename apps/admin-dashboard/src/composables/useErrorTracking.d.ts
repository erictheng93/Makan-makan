/**
 * Vue Composable for Error Tracking
 */
import { type TrackedError } from '@makanmakan/utils';
export declare function useErrorTracking(): {
    tracker: import("@makanmakan/utils").ErrorTracker;
    errors: import("vue").Ref<TrackedError[], TrackedError[]>;
    stats: import("vue").Ref<{
        total: number;
        unresolved: number;
        bySeverity: {
            low: number;
            medium: number;
            high: number;
            critical: number;
        };
        byCategory: {
            unknown: number;
            network: number;
            validation: number;
            database: number;
            authentication: number;
            business: number;
            system: number;
        };
        breadcrumbCount: number;
    }, {
        total: number;
        unresolved: number;
        bySeverity: {
            low: number;
            medium: number;
            high: number;
            critical: number;
        };
        byCategory: Record<import("@makanmakan/utils").ErrorCategory, number>;
        breadcrumbCount: number;
    } | {
        total: number;
        unresolved: number;
        bySeverity: {
            low: number;
            medium: number;
            high: number;
            critical: number;
        };
        byCategory: {
            unknown: number;
            network: number;
            validation: number;
            database: number;
            authentication: number;
            business: number;
            system: number;
        };
        breadcrumbCount: number;
    }>;
    captureError: (error: Error | string, options?: {
        severity?: import("@makanmakan/utils").ErrorSeverity;
        category?: import("@makanmakan/utils").ErrorCategory;
        context?: Partial<import("@makanmakan/utils").ErrorContext>;
    }) => string;
    captureException: (error: Error, context?: Partial<import("@makanmakan/utils").ErrorContext>) => string;
    captureMessage: (message: string, severity?: import("@makanmakan/utils").ErrorSeverity, context?: Partial<import("@makanmakan/utils").ErrorContext>) => string;
    addBreadcrumb: (breadcrumb: Omit<import("@makanmakan/utils").ErrorBreadcrumb, "timestamp">) => void;
    setUser: (user: import("@makanmakan/utils").ErrorContext["user"]) => void;
    cleanup: () => void;
};
