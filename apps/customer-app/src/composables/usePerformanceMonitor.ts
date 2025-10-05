/**
 * Vue Composable for Performance Monitoring (PWA-Optimized)
 *
 * Includes offline queue support and network-aware reporting
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
    sampleRate: import.meta.env.PROD ? 0.05 : 1.0, // 5% sampling in production (mobile data awareness)
    debug: import.meta.env.DEV,
    onReport: async (report) => {
      // PWA: Queue reports when offline
      if (!navigator.onLine) {
        await queueReportForLater(report);
        return;
      }

      // Network-aware reporting
      if (!shouldSendReport()) {
        await queueReportForLater(report);
        return;
      }

      // Send to backend when online
      if (import.meta.env.PROD) {
        try {
          await fetch("/api/v1/system/performance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(report),
          });
        } catch (e) {
          console.error("[PerformanceMonitor] Failed to send report:", e);
          await queueReportForLater(report);
        }
      }
    },
  });

  const webVitals = ref<WebVitals>({});
  const metrics = ref(monitor.getMetrics());
  const resources = ref(monitor.getResourceTimings());
  const isOnline = ref(navigator.onLine);
  const connectionType = ref<string>("unknown");

  /**
   * Check if we should send performance reports based on network conditions
   */
  function shouldSendReport(): boolean {
    // Check data saver mode
    if ("connection" in navigator) {
      const conn = (navigator as any).connection;
      if (conn.saveData) return false;

      // Don't send on slow connections
      const slowConnections = ["slow-2g", "2g"];
      if (slowConnections.includes(conn.effectiveType)) {
        return false;
      }

      connectionType.value = conn.effectiveType;
    }

    return true;
  }

  /**
   * Helper to promisify IDB requests
   */
  function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Queue report for later transmission (offline/slow network support)
   */
  async function queueReportForLater(report: PerformanceReport): Promise<void> {
    try {
      if ("indexedDB" in window) {
        const db = await openPerformanceDB();
        const tx = db.transaction("reports", "readwrite");
        const store = tx.objectStore("reports");
        await store.add({
          ...report,
          queuedAt: Date.now(),
        });
      }
    } catch (e) {
      console.error("[PerformanceMonitor] Failed to queue report:", e);
    }
  }

  /**
   * Process queued reports when conditions are favorable
   */
  async function processQueuedReports(): Promise<void> {
    if (!navigator.onLine || !shouldSendReport()) return;

    try {
      if ("indexedDB" in window) {
        const db = await openPerformanceDB();
        const tx = db.transaction("reports", "readonly");
        const store = tx.objectStore("reports");
        const allReports = await idbRequest<any[]>(store.getAll());

        if (allReports.length === 0) return;

        // Send all queued reports (max 10 at a time)
        const reportsToSend = allReports.slice(0, 10);

        for (const report of reportsToSend) {
          try {
            await fetch("/api/v1/system/performance", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(report),
            });

            // Remove from queue after successful send
            const deleteTx = db.transaction("reports", "readwrite");
            const deleteStore = deleteTx.objectStore("reports");
            await idbRequest(deleteStore.delete(report.timestamp));
          } catch (e) {
            console.error(
              "[PerformanceMonitor] Failed to send queued report:",
              e,
            );
            break; // Stop processing if network fails
          }
        }
      }
    } catch (e) {
      console.error(
        "[PerformanceMonitor] Failed to process queued reports:",
        e,
      );
    }
  }

  /**
   * Open IndexedDB for report queue
   */
  function openPerformanceDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("PerformanceMonitorDB", 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("reports")) {
          db.createObjectStore("reports", { keyPath: "timestamp" });
        }
      };
    });
  }

  /**
   * Handle online/offline events
   */
  function handleOnline(): void {
    isOnline.value = true;
    processQueuedReports();
  }

  function handleOffline(): void {
    isOnline.value = false;
  }

  /**
   * Handle connection change
   */
  function handleConnectionChange(): void {
    if ("connection" in navigator) {
      const conn = (navigator as any).connection;
      connectionType.value = conn.effectiveType;

      // Try to process queue if connection improved
      if (["4g", "3g"].includes(conn.effectiveType)) {
        processQueuedReports();
      }
    }
  }

  // Update metrics periodically
  const updateInterval = window.setInterval(() => {
    webVitals.value = monitor.getWebVitals();
    metrics.value = monitor.getMetrics();
    resources.value = monitor.getResourceTimings();
  }, 5000);

  onMounted(() => {
    // Initial update
    webVitals.value = monitor.getWebVitals();
    metrics.value = monitor.getMetrics();
    resources.value = monitor.getResourceTimings();

    // Update connection type
    if ("connection" in navigator) {
      const conn = (navigator as any).connection;
      connectionType.value = conn.effectiveType;
    }

    // Listen for online/offline events
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Listen for connection changes
    if ("connection" in navigator) {
      const conn = (navigator as any).connection;
      conn.addEventListener("change", handleConnectionChange);
    }

    // Process any queued reports on mount (if conditions are good)
    if (navigator.onLine && shouldSendReport()) {
      processQueuedReports();
    }
  });

  onBeforeUnmount(() => {
    clearInterval(updateInterval);
    monitor.disconnect();
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);

    if ("connection" in navigator) {
      const conn = (navigator as any).connection;
      conn.removeEventListener("change", handleConnectionChange);
    }
  });

  /**
   * Track route change performance
   */
  function trackRouteChange(from: string, to: string): void {
    monitor.mark(`route-${to}-start`);

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
      connectionType: connectionType.value,
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
   * Get performance score (0-100) - Mobile-optimized thresholds
   */
  function getPerformanceScore(): number {
    const vitals = monitor.getWebVitals();
    let score = 100;

    // Mobile-friendly thresholds (more lenient than desktop)
    // LCP: Good < 3s, Poor > 5s (mobile)
    if (vitals.LCP) {
      if (vitals.LCP > 5000) score -= 30;
      else if (vitals.LCP > 3000) score -= 15;
    }

    // FID: Good < 200ms, Poor > 500ms (mobile)
    if (vitals.FID) {
      if (vitals.FID > 500) score -= 20;
      else if (vitals.FID > 200) score -= 10;
    }

    // CLS: Good < 0.1, Poor > 0.25
    if (vitals.CLS) {
      if (vitals.CLS > 0.25) score -= 20;
      else if (vitals.CLS > 0.1) score -= 10;
    }

    // FCP: Good < 2.5s, Poor > 4s (mobile)
    if (vitals.FCP) {
      if (vitals.FCP > 4000) score -= 15;
      else if (vitals.FCP > 2500) score -= 7;
    }

    // TTFB: Good < 1.2s, Poor > 2.5s (mobile)
    if (vitals.TTFB) {
      if (vitals.TTFB > 2500) score -= 15;
      else if (vitals.TTFB > 1200) score -= 7;
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
    isOnline,
    connectionType,
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
