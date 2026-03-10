/**
 * Performance Monitoring System
 *
 * Track and analyze application performance metrics
 */

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: "ms" | "bytes" | "count" | "score";
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
  type:
    | "script"
    | "stylesheet"
    | "image"
    | "fetch"
    | "xmlhttprequest"
    | "other";
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

export class PerformanceMonitor {
  private options: Required<Omit<PerformanceMonitorOptions, "onReport">> &
    Pick<PerformanceMonitorOptions, "onReport">;
  private metrics: PerformanceMetric[] = [];
  private webVitals: WebVitals = {};
  private observer: PerformanceObserver | null = null;

  constructor(options: PerformanceMonitorOptions = {}) {
    this.options = {
      enabled: options.enabled ?? true,
      trackWebVitals: options.trackWebVitals ?? true,
      trackResources: options.trackResources ?? true,
      sampleRate: options.sampleRate ?? 1.0,
      debug: options.debug ?? false,
      onReport: options.onReport,
    };

    if (this.options.enabled && typeof window !== "undefined") {
      this.setupMonitoring();
    }
  }

  /**
   * Track custom metric
   */
  trackMetric(metric: Omit<PerformanceMetric, "timestamp">): void {
    if (!this.options.enabled) return;

    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: Date.now(),
    };

    this.metrics.push(fullMetric);

    if (this.options.debug) {
      console.log("[PerformanceMonitor] Metric:", fullMetric);
    }
  }

  /**
   * Measure function execution time
   */
  async measure<T>(
    name: string,
    fn: () => T | Promise<T>,
    tags?: Record<string, string>,
  ): Promise<T> {
    const start = performance.now();

    try {
      const result = await fn();
      const duration = performance.now() - start;

      this.trackMetric({
        name,
        value: duration,
        unit: "ms",
        tags,
      });

      return result;
    } catch (error) {
      const duration = performance.now() - start;

      this.trackMetric({
        name: `${name}_error`,
        value: duration,
        unit: "ms",
        tags,
      });

      throw error;
    }
  }

  /**
   * Mark a point in time
   */
  mark(name: string): void {
    if (!this.options.enabled) return;
    performance.mark(name);
  }

  /**
   * Measure between two marks
   */
  measureBetween(name: string, startMark: string, endMark: string): void {
    if (!this.options.enabled) return;

    try {
      performance.measure(name, startMark, endMark);
      const measure = performance.getEntriesByName(name, "measure")[0];

      if (measure) {
        this.trackMetric({
          name,
          value: measure.duration,
          unit: "ms",
        });
      }
    } catch (error) {
      console.warn("[PerformanceMonitor] Failed to measure:", error);
    }
  }

  /**
   * Get Web Vitals
   */
  getWebVitals(): WebVitals {
    return { ...this.webVitals };
  }

  /**
   * Get all metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Get resource timings
   */
  getResourceTimings(): ResourceTiming[] {
    if (!this.options.trackResources) return [];

    const resources = performance.getEntriesByType(
      "resource",
    ) as PerformanceResourceTiming[];

    return resources.map((resource) => ({
      name: resource.name,
      duration: resource.duration,
      size: resource.transferSize,
      type: this.categorizeResource(resource),
    }));
  }

  /**
   * Generate performance report
   */
  generateReport(): PerformanceReport {
    return {
      webVitals: this.getWebVitals(),
      resources: this.getResourceTimings(),
      customMetrics: this.getMetrics(),
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };
  }

  /**
   * Send report
   */
  async sendReport(): Promise<void> {
    if (!this.options.onReport) return;

    // Sample rate check
    if (Math.random() > this.options.sampleRate) return;

    const report = this.generateReport();

    try {
      await this.options.onReport(report);
    } catch (error) {
      console.error("[PerformanceMonitor] Failed to send report:", error);
    }
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
    this.webVitals = {};
    performance.clearMarks();
    performance.clearMeasures();
  }

  /**
   * Disconnect observer
   */
  disconnect(): void {
    this.observer?.disconnect();
  }

  /**
   * Setup performance monitoring
   */
  private setupMonitoring(): void {
    if (this.options.trackWebVitals) {
      this.trackWebVitalsMetrics();
    }

    if (this.options.trackResources) {
      this.trackResourceMetrics();
    }

    // Send report on page unload
    window.addEventListener("beforeunload", () => {
      this.sendReport();
    });

    // Send report periodically (every 30 seconds)
    setInterval(() => {
      this.sendReport();
    }, 30000);
  }

  /**
   * Track Web Vitals metrics
   */
  private trackWebVitalsMetrics(): void {
    // Use PerformanceObserver for Web Vitals
    if ("PerformanceObserver" in window) {
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === "largest-contentful-paint") {
            this.webVitals.LCP = entry.startTime;
            this.trackMetric({
              name: "LCP",
              value: entry.startTime,
              unit: "ms",
            });
          }

          if (entry.entryType === "first-input") {
            const fidEntry = entry as PerformanceEventTiming;
            this.webVitals.FID = fidEntry.processingStart - fidEntry.startTime;
            this.trackMetric({
              name: "FID",
              value: this.webVitals.FID,
              unit: "ms",
            });
          }

          if (
            entry.entryType === "layout-shift" &&
            !(entry as any).hadRecentInput
          ) {
            const currentCLS = (this.webVitals.CLS || 0) + (entry as any).value;
            this.webVitals.CLS = currentCLS;
            this.trackMetric({ name: "CLS", value: currentCLS, unit: "score" });
          }

          if (
            entry.entryType === "paint" &&
            entry.name === "first-contentful-paint"
          ) {
            this.webVitals.FCP = entry.startTime;
            this.trackMetric({
              name: "FCP",
              value: entry.startTime,
              unit: "ms",
            });
          }
        }
      });

      try {
        this.observer.observe({
          entryTypes: [
            "largest-contentful-paint",
            "first-input",
            "layout-shift",
            "paint",
          ],
        });
      } catch (e) {
        console.warn("[PerformanceMonitor] Failed to observe:", e);
      }
    }

    // Track TTFB from Navigation Timing
    if (performance.timing) {
      const ttfb =
        performance.timing.responseStart - performance.timing.requestStart;
      this.webVitals.TTFB = ttfb;
      this.trackMetric({ name: "TTFB", value: ttfb, unit: "ms" });
    }

    // Track TTI (Time to Interactive)
    if ("PerformanceLongTaskTiming" in window) {
      this.trackTimeToInteractive();
    }
  }

  /**
   * Track resource metrics
   */
  private trackResourceMetrics(): void {
    // Track resource load times
    window.addEventListener("load", () => {
      const resources = this.getResourceTimings();

      // Track slow resources
      resources.forEach((resource) => {
        if (resource.duration > 1000) {
          this.trackMetric({
            name: "slow_resource",
            value: resource.duration,
            unit: "ms",
            tags: {
              resource: resource.name,
              type: resource.type,
            },
          });
        }
      });

      // Track total bundle size
      const totalSize = resources.reduce((sum, r) => sum + (r.size || 0), 0);
      this.trackMetric({
        name: "total_bundle_size",
        value: totalSize,
        unit: "bytes",
      });
    });
  }

  /**
   * Track Time to Interactive
   */
  private trackTimeToInteractive(): void {
    // Simple TTI heuristic: when there's a 5-second window of no long tasks
    let lastLongTaskEnd = 0;
    const longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        lastLongTaskEnd = entry.startTime + entry.duration;
      }
    });

    try {
      longTaskObserver.observe({ entryTypes: ["longtask"] });
    } catch (e) {
      // Long tasks not supported
    }

    // Check TTI after 10 seconds
    setTimeout(() => {
      const now = performance.now();
      if (now - lastLongTaskEnd >= 5000) {
        this.webVitals.TTI = lastLongTaskEnd;
        this.trackMetric({ name: "TTI", value: lastLongTaskEnd, unit: "ms" });
      }
      longTaskObserver.disconnect();
    }, 10000);
  }

  /**
   * Categorize resource type
   */
  private categorizeResource(
    resource: PerformanceResourceTiming,
  ): ResourceTiming["type"] {
    const name = resource.name.toLowerCase();
    const initiatorType = resource.initiatorType;

    if (initiatorType === "script" || name.endsWith(".js")) return "script";
    if (initiatorType === "link" || name.endsWith(".css")) return "stylesheet";
    if (initiatorType === "img" || /\.(jpg|jpeg|png|gif|webp|svg)/.test(name))
      return "image";
    if (initiatorType === "fetch") return "fetch";
    if (initiatorType === "xmlhttprequest") return "xmlhttprequest";

    return "other";
  }
}

/**
 * Global performance monitor instance
 */
let globalMonitor: PerformanceMonitor | null = null;

export function getPerformanceMonitor(
  options?: PerformanceMonitorOptions,
): PerformanceMonitor {
  if (!globalMonitor) {
    globalMonitor = new PerformanceMonitor(options);
  }
  return globalMonitor;
}

export function resetPerformanceMonitor(): void {
  globalMonitor?.disconnect();
  globalMonitor = null;
}
