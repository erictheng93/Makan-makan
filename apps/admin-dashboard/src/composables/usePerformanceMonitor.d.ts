/**
 * Vue Composable for Performance Monitoring
 */
import { type PerformanceReport, type WebVitals } from '@makanmakan/utils';
export declare function usePerformanceMonitor(): {
    monitor: import("@makanmakan/utils").PerformanceMonitor;
    webVitals: import("vue").Ref<{
        LCP?: number | undefined;
        FID?: number | undefined;
        CLS?: number | undefined;
        FCP?: number | undefined;
        TTFB?: number | undefined;
        TTI?: number | undefined;
    }, WebVitals | {
        LCP?: number | undefined;
        FID?: number | undefined;
        CLS?: number | undefined;
        FCP?: number | undefined;
        TTFB?: number | undefined;
        TTI?: number | undefined;
    }>;
    metrics: import("vue").Ref<{
        name: string;
        value: number;
        unit: "ms" | "bytes" | "count" | "score";
        timestamp: number;
        tags?: Record<string, string> | undefined;
    }[], import("@makanmakan/utils").PerformanceMetric[] | {
        name: string;
        value: number;
        unit: "ms" | "bytes" | "count" | "score";
        timestamp: number;
        tags?: Record<string, string> | undefined;
    }[]>;
    resources: import("vue").Ref<{
        name: string;
        duration: number;
        size?: number | undefined;
        type: "script" | "stylesheet" | "image" | "fetch" | "xmlhttprequest" | "other";
    }[], import("@makanmakan/utils").ResourceTiming[] | {
        name: string;
        duration: number;
        size?: number | undefined;
        type: "script" | "stylesheet" | "image" | "fetch" | "xmlhttprequest" | "other";
    }[]>;
    trackRouteChange: (from: string, to: string) => void;
    trackApiRequest: <T>(endpoint: string, requestFn: () => Promise<T>) => Promise<T>;
    trackComponentRender: <T>(componentName: string, renderFn: () => T | Promise<T>) => Promise<T>;
    getPerformanceScore: () => number;
    getPerformanceGrade: () => string;
    generateReport: () => PerformanceReport;
    clear: () => void;
    trackMetric: (metric: Omit<import("@makanmakan/utils").PerformanceMetric, "timestamp">) => void;
    measure: <T>(name: string, fn: () => T | Promise<T>, tags?: Record<string, string>) => Promise<T>;
    mark: (name: string) => void;
};
