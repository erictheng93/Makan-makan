/**
 * Performance Monitoring System
 *
 * Track and analyze application performance metrics
 */
export interface PerformanceMetric {
    name: string;
    value: number;
    unit: 'ms' | 'bytes' | 'count' | 'score';
    timestamp: number;
    tags?: Record<string, string>;
}
export interface WebVitals {
    /**
     * Largest Contentful Paint (ms)
     */
    LCP?: number;
    /**
     * First Input Delay (ms)
     */
    FID?: number;
    /**
     * Cumulative Layout Shift (score)
     */
    CLS?: number;
    /**
     * First Contentful Paint (ms)
     */
    FCP?: number;
    /**
     * Time to First Byte (ms)
     */
    TTFB?: number;
    /**
     * Time to Interactive (ms)
     */
    TTI?: number;
}
export interface ResourceTiming {
    name: string;
    duration: number;
    size?: number;
    type: 'script' | 'stylesheet' | 'image' | 'fetch' | 'xmlhttprequest' | 'other';
}
export interface PerformanceReport {
    webVitals: WebVitals;
    resources: ResourceTiming[];
    customMetrics: PerformanceMetric[];
    timestamp: number;
    url: string;
    userAgent: string;
}
export interface PerformanceMonitorOptions {
    /**
     * Enable performance monitoring
     * @default true
     */
    enabled?: boolean;
    /**
     * Track Web Vitals
     * @default true
     */
    trackWebVitals?: boolean;
    /**
     * Track resource timings
     * @default true
     */
    trackResources?: boolean;
    /**
     * Sample rate (0-1)
     * @default 1.0
     */
    sampleRate?: number;
    /**
     * Report callback
     */
    onReport?: (report: PerformanceReport) => void | Promise<void>;
    /**
     * Debug logging
     * @default false
     */
    debug?: boolean;
}
export declare class PerformanceMonitor {
    private options;
    private metrics;
    private webVitals;
    private observer;
    constructor(options?: PerformanceMonitorOptions);
    /**
     * Track custom metric
     */
    trackMetric(metric: Omit<PerformanceMetric, 'timestamp'>): void;
    /**
     * Measure function execution time
     */
    measure<T>(name: string, fn: () => T | Promise<T>, tags?: Record<string, string>): Promise<T>;
    /**
     * Mark a point in time
     */
    mark(name: string): void;
    /**
     * Measure between two marks
     */
    measureBetween(name: string, startMark: string, endMark: string): void;
    /**
     * Get Web Vitals
     */
    getWebVitals(): WebVitals;
    /**
     * Get all metrics
     */
    getMetrics(): PerformanceMetric[];
    /**
     * Get resource timings
     */
    getResourceTimings(): ResourceTiming[];
    /**
     * Generate performance report
     */
    generateReport(): PerformanceReport;
    /**
     * Send report
     */
    sendReport(): Promise<void>;
    /**
     * Clear all metrics
     */
    clear(): void;
    /**
     * Disconnect observer
     */
    disconnect(): void;
    /**
     * Setup performance monitoring
     */
    private setupMonitoring;
    /**
     * Track Web Vitals metrics
     */
    private trackWebVitalsMetrics;
    /**
     * Track resource metrics
     */
    private trackResourceMetrics;
    /**
     * Track Time to Interactive
     */
    private trackTimeToInteractive;
    /**
     * Categorize resource type
     */
    private categorizeResource;
}
export declare function getPerformanceMonitor(options?: PerformanceMonitorOptions): PerformanceMonitor;
export declare function resetPerformanceMonitor(): void;
