/**
 * Vue Composable for Performance Monitoring
 */

import { ref, onMounted, onBeforeUnmount } from "vue";
import {
  getPerformanceMonitor,
  type PerformanceReport,
  type WebVitals,
} from "@makanmakan/utils";

export function usePerformanceMonitor() {
  const monitor = getPerformanceMonitor({
    enabled: true,
    trackWebVitals: true,
    trackResources: true,
    sampleRate: import.meta.env.PROD ? 0.1 : 1.0, // 10% sampling in production
    debug: import.meta.env.DEV,
    onReport: async (report: PerformanceReport) => {
      // Send to backend
      if (import.meta.env.PROD) {
        try {
          await fetch("/api/v1/system/performance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(report),
          });
        } catch (e) {
          console.error("[PerformanceMonitor] Failed to send report:", e);
        }
      }
    },
  });

  const webVitals = ref<WebVitals>({});
  const metrics = ref(monitor.getMetrics());
  const resources = ref(monitor.getResourceTimings());

  // Update metrics periodically
  const updateInterval: number = window.setInterval(() => {
    webVitals.value = monitor.getWebVitals();
    metrics.value = monitor.getMetrics();
    resources.value = monitor.getResourceTimings();
  }, 5000);

  onMounted(() => {
    // Initial update
    webVitals.value = monitor.getWebVitals();
    metrics.value = monitor.getMetrics();
    resources.value = monitor.getResourceTimings();
  });

  onBeforeUnmount(() => {
    clearInterval(updateInterval);
    monitor.disconnect();
  });

  /**
   * Track route change performance
   */
  function trackRouteChange(from: string, to: string): void {
    monitor.mark(`route-${to}-start`);

    // Track on next tick (after route rendered)
    requestAnimationFrame(() => {
      monitor.mark(`route-${to}-end`);
      monitor.measureBetween(
        `route-change-${from}-to-${to}`,
        `route-${to}-start`,
        `route-${to}-end`,
      );
    });
  }

  /**
   * Track API request performance
   */
  async function trackApiRequest<T>(
    endpoint: string,
    requestFn: () => Promise<T>,
  ): Promise<T> {
    return monitor.measure(`api-${endpoint}`, requestFn, {
      type: "api",
      endpoint,
    });
  }

  /**
   * Track component render performance
   */
  async function trackComponentRender<T>(
    componentName: string,
    renderFn: () => T | Promise<T>,
  ): Promise<T> {
    return monitor.measure(`component-${componentName}`, renderFn, {
      type: "component",
      component: componentName,
    });
  }

  /**
   * Get performance score (0-100)
   */
  function getPerformanceScore(): number {
    const vitals = monitor.getWebVitals();
    let score = 100;

    // LCP: Good < 2.5s, Poor > 4s
    if (vitals.LCP) {
      if (vitals.LCP > 4000) score -= 30;
      else if (vitals.LCP > 2500) score -= 15;
    }

    // FID: Good < 100ms, Poor > 300ms
    if (vitals.FID) {
      if (vitals.FID > 300) score -= 20;
      else if (vitals.FID > 100) score -= 10;
    }

    // CLS: Good < 0.1, Poor > 0.25
    if (vitals.CLS) {
      if (vitals.CLS > 0.25) score -= 20;
      else if (vitals.CLS > 0.1) score -= 10;
    }

    // FCP: Good < 1.8s, Poor > 3s
    if (vitals.FCP) {
      if (vitals.FCP > 3000) score -= 15;
      else if (vitals.FCP > 1800) score -= 7;
    }

    // TTFB: Good < 800ms, Poor > 1800ms
    if (vitals.TTFB) {
      if (vitals.TTFB > 1800) score -= 15;
      else if (vitals.TTFB > 800) score -= 7;
    }

    return Math.max(0, score);
  }

  /**
   * Get performance grade (A-F)
   */
  function getPerformanceGrade(): string {
    const score = getPerformanceScore();
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
  }

  /**
   * Generate full performance report
   */
  function generateReport(): PerformanceReport {
    return monitor.generateReport();
  }

  /**
   * Clear all metrics
   */
  function clear(): void {
    monitor.clear();
    webVitals.value = {};
    metrics.value = [];
    resources.value = [];
  }

  return {
    monitor,
    webVitals,
    metrics,
    resources,
    trackRouteChange,
    trackApiRequest,
    trackComponentRender,
    getPerformanceScore,
    getPerformanceGrade,
    generateReport,
    clear,
    trackMetric: monitor.trackMetric.bind(monitor),
    measure: monitor.measure.bind(monitor),
    mark: monitor.mark.bind(monitor),
  };
}
