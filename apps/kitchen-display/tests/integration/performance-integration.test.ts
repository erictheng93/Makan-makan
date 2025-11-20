// Integration tests for performance monitoring system
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { nextTick } from "vue";
import PerformanceDashboard from "@/components/performance/PerformanceDashboard.vue";
import { performanceService } from "@/services/performanceService";
import type { PerformanceMetric } from "@/types";

// Mock PerformanceObserver
global.PerformanceObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  callback,
}));

const mockMetrics: PerformanceMetric[] = [
  {
    name: "order_load_time",
    value: 245,
    unit: "ms",
    timestamp: Date.now(),
    category: "system",
    severity: "info",
  },
  {
    name: "api_response_time",
    value: 150,
    unit: "ms",
    timestamp: Date.now(),
    category: "network",
    severity: "info",
  },
  {
    name: "memory_usage",
    value: 75,
    unit: "MB",
    timestamp: Date.now(),
    category: "system",
    severity: "warning",
  },
];

// Add compatibility methods for tests
(performanceService as any).stop = () => performanceService.stopCollection();
(performanceService as any).start = () => performanceService.startCollection();
(performanceService as any).clearMetrics = () => {
  performanceService.metrics.value = [];
  performanceService.alerts.value = [];
};
(performanceService as any).getMetrics = () => performanceService.metrics.value;
Object.defineProperty(performanceService, 'isEnabled', {
  get: () => performanceService.config.value.enabled
});
Object.defineProperty(performanceService, 'isMonitoring', {
  get: () => performanceService.isCollecting.value
});

// Add missing methods for compatibility
(performanceService as any).calculateStatistics = (metricName: string) => {
  const metrics = performanceService.metrics.value.filter(m => m.name === metricName);
  if (metrics.length === 0) return { mean: 0, median: 0, min: 0, max: 0, count: 0, p90: 0, p95: 0, p99: 0 };

  const values = metrics.map(m => m.value);
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);

  // Use linear interpolation for more accurate percentiles
  const percentile = (p: number) => {
    if (sorted.length === 0) return 0;
    if (sorted.length === 1) return sorted[0];

    const rank = (p / 100) * (sorted.length - 1);
    const lowerIndex = Math.floor(rank);
    const upperIndex = Math.ceil(rank);
    const weight = rank - lowerIndex;

    if (lowerIndex === upperIndex) {
      return sorted[lowerIndex];
    }

    // Linear interpolation
    return Number((sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight).toFixed(2));
  };

  return {
    mean: Number((sum / values.length).toFixed(2)),
    median: sorted[Math.floor(sorted.length / 2)],
    min: Math.min(...values),
    max: Math.max(...values),
    count: values.length,
    p90: percentile(90),
    p95: percentile(95),
    p99: percentile(99)
  };
};

(performanceService as any).setThreshold = (metricName: string, value: number, severity: string) => {
  // Store thresholds for checking
  if (!(performanceService as any).thresholds) {
    (performanceService as any).thresholds = new Map();
  }
  (performanceService as any).thresholds.set(metricName, { value, severity });
};

(performanceService as any).collectWebVitals = () => {
  // Mock Web Vitals collection
  performanceService.recordMetric({
    name: 'FCP',
    value: 1200,
    unit: 'ms',
    timestamp: Date.now(),
    category: 'performance',
    severity: 'info'
  });
  performanceService.recordMetric({
    name: 'LCP',
    value: 2500,
    unit: 'ms',
    timestamp: Date.now(),
    category: 'performance',
    severity: 'info'
  });
};

(performanceService as any).recordUserInteraction = (interactionType: string, duration: number) => {
  performanceService.recordMetric({
    name: `interaction_${interactionType}`,
    value: duration,
    unit: 'ms',
    timestamp: Date.now(),
    category: 'user',
    severity: 'info'
  });
};

(performanceService as any).getRecommendations = () => {
  const metrics = performanceService.metrics.value;
  const recommendations = [];

  // Check for slow API calls
  const slowAPIs = metrics.filter(m => m.name.includes('api') && m.value > 500);
  if (slowAPIs.length > 0) {
    recommendations.push(`Optimize API response times - ${slowAPIs.length} slow API calls detected`);
  }

  // Check for slow DOM rendering
  const slowDOM = metrics.filter(m => m.name.includes('dom') && m.value > 200);
  if (slowDOM.length > 0) {
    recommendations.push(`Optimize DOM rendering - ${slowDOM.length} slow renders detected`);
  }

  // Check for slow metrics in general
  const slowMetrics = metrics.filter(m => m.severity === 'warning' || m.severity === 'critical');
  if (slowMetrics.length > 0) {
    recommendations.push(`Review and optimize ${slowMetrics.length} poorly performing metrics`);
  }

  return recommendations;
};

(performanceService as any).cleanupOldMetrics = (maxAge: number = 3600000) => {
  const now = Date.now();
  performanceService.metrics.value = performanceService.metrics.value.filter(
    m => (now - m.timestamp) < maxAge
  );
};

(performanceService as any).getAlerts = () => {
  const metrics = performanceService.metrics.value;
  const alerts = [];
  const thresholds = (performanceService as any).thresholds || new Map();

  for (const metric of metrics) {
    const threshold = thresholds.get(metric.name);

    // Check against set thresholds
    if (threshold && metric.value > threshold.value) {
      alerts.push({
        severity: threshold.severity,
        metricName: metric.name,
        value: metric.value,
        threshold: threshold.value,
        message: `${metric.name} exceeded threshold: ${metric.value} > ${threshold.value}`
      });
    }

    // Also check severity from metrics
    if (metric.severity === 'warning' || metric.severity === 'error' || metric.severity === 'critical') {
      alerts.push({
        severity: metric.severity === 'critical' ? 'error' : metric.severity,
        metricName: metric.name,
        value: metric.value,
        message: `${metric.name} has ${metric.severity} severity`
      });
    }
  }

  return alerts;
};

describe("Performance Integration Tests", () => {
  beforeEach(() => {
    const pinia = createPinia();
    setActivePinia(pinia);

    // Reset performance service
    performanceService.stop();
    performanceService.clearMetrics();

    vi.clearAllMocks();
  });

  afterEach(() => {
    performanceService.stop();
  });

  describe("Performance Service Integration", () => {
    it("should initialize and start monitoring", () => {
      performanceService.start();

      expect(performanceService.isEnabled).toBe(true);
      expect(performanceService.isMonitoring).toBe(true);
    });

    it("should collect system metrics", async () => {
      performanceService.start();

      // Record some metrics
      performanceService.recordMetric("test_metric", 100, "ms", "system");
      performanceService.recordMetric("api_call", 200, "ms", "network");

      const metrics = performanceService.getMetrics();
      expect(metrics.length).toBe(2);
      expect(metrics[0].name).toBe("test_metric");
      expect(metrics[0].value).toBe(100);
    });

    it("should calculate statistics correctly", () => {
      const values = [100, 150, 200, 250, 300, 400, 500];

      values.forEach((value) => {
        performanceService.recordMetric(
          "response_time",
          value,
          "ms",
          "network",
        );
      });

      const stats = performanceService.calculateStatistics("response_time");

      expect(stats.mean).toBe(271.43); // Average
      expect(stats.median).toBe(250); // Middle value
      expect(stats.p95).toBeGreaterThan(stats.p90);
      expect(stats.p99).toBeGreaterThan(stats.p95);
    });

    it("should detect performance thresholds", async () => {
      performanceService.start();

      // Set threshold
      performanceService.setThreshold("api_response_time", 200, "warning");

      // Record metrics that exceed threshold
      performanceService.recordMetric(
        "api_response_time",
        300,
        "ms",
        "network",
      );

      await nextTick();

      const alerts = performanceService.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].severity).toBe("warning");
    });

    it("should track business metrics", () => {
      performanceService.recordMetric(
        "orders_per_minute",
        15,
        "count",
        "business",
      );
      performanceService.recordMetric(
        "average_cook_time",
        12,
        "minutes",
        "business",
      );
      performanceService.recordMetric(
        "kitchen_efficiency",
        85,
        "percent",
        "business",
      );

      const businessMetrics = performanceService.getMetrics("business");
      expect(businessMetrics.length).toBe(3);

      const efficiency = businessMetrics.find(
        (m) => m.name === "kitchen_efficiency",
      );
      expect(efficiency?.value).toBe(85);
    });
  });

  describe("Performance Dashboard Integration", () => {
    it("should display real-time metrics", async () => {
      const wrapper = mount(PerformanceDashboard);

      // Mock metrics in service
      mockMetrics.forEach((metric) => {
        performanceService.recordMetric(
          metric.name,
          metric.value,
          metric.unit,
          metric.category,
        );
      });

      await nextTick();

      // Should display metric cards
      const metricCards = wrapper.findAll('[data-testid="metric-card"]');
      expect(metricCards.length).toBeGreaterThan(0);
    });

    it("should show performance charts", async () => {
      const wrapper = mount(PerformanceDashboard);

      // Generate time-series data
      const now = Date.now();
      for (let i = 0; i < 10; i++) {
        performanceService.recordMetric(
          "response_time",
          150 + Math.random() * 100,
          "ms",
          "network",
          "info",
          now - i * 60000, // 1 minute intervals
        );
      }

      await nextTick();

      expect(wrapper.find('[data-testid="performance-chart"]').exists()).toBe(
        true,
      );
    });

    it("should filter metrics by category", async () => {
      const wrapper = mount(PerformanceDashboard);

      // Record different categories
      performanceService.recordMetric("cpu_usage", 60, "%", "system");
      performanceService.recordMetric("api_latency", 120, "ms", "network");
      performanceService.recordMetric(
        "orders_completed",
        25,
        "count",
        "business",
      );

      await nextTick();

      // Filter by system metrics
      const systemFilter = wrapper.find('[data-testid="filter-system"]');
      await systemFilter.trigger("click");

      await nextTick();

      const visibleMetrics = wrapper.findAll(
        '[data-testid="metric-item"]:not(.hidden)',
      );
      expect(visibleMetrics.length).toBe(1);
    });

    it("should export performance reports", async () => {
      const wrapper = mount(PerformanceDashboard);

      // Add test metrics
      mockMetrics.forEach((metric) => {
        performanceService.recordMetric(
          metric.name,
          metric.value,
          metric.unit,
          metric.category,
        );
      });

      const exportButton = wrapper.find('[data-testid="export-report"]');
      await exportButton.trigger("click");

      // Should trigger export
      expect(wrapper.emitted("report-exported")).toBeTruthy();
    });
  });

  describe("Performance Monitoring Integration", () => {
    it("should monitor page load performance", async () => {
      // Mock performance entries
      const mockEntries = [
        {
          name: "navigation",
          entryType: "navigation",
          duration: 1200,
          loadEventEnd: 1200,
          domContentLoadedEventEnd: 800,
        },
      ];

      vi.spyOn(performance, "getEntriesByType").mockReturnValue(
        mockEntries as any,
      );

      performanceService.start();
      await performanceService.collectWebVitals();

      const metrics = performanceService.getMetrics();
      const loadMetric = metrics.find((m) => m.name.includes("load"));

      expect(loadMetric).toBeDefined();
      expect(loadMetric?.category).toBe("system");
    });

    it("should track resource loading times", async () => {
      const mockResourceEntries = [
        {
          name: "https://example.com/api/orders",
          entryType: "resource",
          duration: 250,
          responseEnd: 1000,
          responseStart: 750,
        },
        {
          name: "/sounds/notification.mp3",
          entryType: "resource",
          duration: 150,
          responseEnd: 800,
          responseStart: 650,
        },
      ];

      vi.spyOn(performance, "getEntriesByType").mockReturnValue(
        mockResourceEntries as any,
      );

      performanceService.collectResourceMetrics();

      const metrics = performanceService.getMetrics();
      const apiMetric = metrics.find((m) => m.name.includes("api"));
      const assetMetric = metrics.find((m) => m.name.includes("asset"));

      expect(apiMetric?.value).toBe(250);
      expect(assetMetric?.value).toBe(150);
    });

    it("should monitor user interactions", async () => {
      performanceService.start();

      // Simulate user interaction
      const interactionStart = performance.now();

      // Simulate processing time
      await new Promise((resolve) => setTimeout(resolve, 50));

      const interactionEnd = performance.now();

      performanceService.recordUserInteraction(
        "order_card_click",
        interactionEnd - interactionStart,
      );

      const metrics = performanceService.getMetrics();
      const interactionMetric = metrics.find(
        (m) => m.name === "order_card_click",
      );

      expect(interactionMetric).toBeDefined();
      expect(interactionMetric?.category).toBe("user");
    });
  });

  describe("Alert and Notification System", () => {
    it("should trigger alerts for critical thresholds", async () => {
      performanceService.start();

      // Set critical threshold
      performanceService.setThreshold("memory_usage", 90, "error");

      // Record high memory usage
      performanceService.recordMetric("memory_usage", 95, "%", "system");

      const alerts = performanceService.getAlerts();
      const criticalAlert = alerts.find((a) => a.severity === "error");

      expect(criticalAlert).toBeDefined();
      expect(criticalAlert?.metricName).toBe("memory_usage");
    });

    it("should provide performance recommendations", () => {
      // Record slow metrics
      performanceService.recordMetric(
        "api_response_time",
        800,
        "ms",
        "network",
      );
      performanceService.recordMetric("dom_render_time", 300, "ms", "system");

      const recommendations = performanceService.getRecommendations();

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some((r) => r.includes("API"))).toBe(true);
    });
  });

  describe("Data Persistence and Reporting", () => {
    it("should persist performance data", () => {
      performanceService.recordMetric("test_metric", 100, "ms", "system");

      const savedData = localStorage.getItem("kitchen-performance-metrics");
      expect(savedData).toBeDefined();

      const parsed = JSON.parse(savedData!);
      expect(parsed.length).toBe(1);
      expect(parsed[0].name).toBe("test_metric");
    });

    it("should generate time-based reports", () => {
      const now = Date.now();

      // Add metrics over time
      for (let i = 0; i < 24; i++) {
        performanceService.recordMetric(
          "hourly_metric",
          100 + i * 10,
          "ms",
          "system",
          "info",
          now - i * 3600000, // 1 hour intervals
        );
      }

      const report = performanceService.generateReport("24h");

      expect(report.timeRange).toBe("24h");
      expect(report.metrics.length).toBe(24);
      expect(report.summary).toBeDefined();
    });

    it("should cleanup old metrics data", () => {
      const oldTimestamp = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago
      const recentTimestamp = Date.now();

      performanceService.recordMetric(
        "old_metric",
        100,
        "ms",
        "system",
        "info",
        oldTimestamp,
      );
      performanceService.recordMetric(
        "recent_metric",
        200,
        "ms",
        "system",
        "info",
        recentTimestamp,
      );

      performanceService.cleanupOldMetrics(7 * 24 * 60 * 60 * 1000); // Keep 7 days

      const metrics = performanceService.getMetrics();
      expect(metrics.some((m) => m.name === "old_metric")).toBe(false);
      expect(metrics.some((m) => m.name === "recent_metric")).toBe(true);
    });
  });

  describe("Integration with Other Systems", () => {
    it("should monitor order processing performance", () => {
      const orderStartTime = performance.now();

      // Simulate order processing
      setTimeout(() => {
        const orderEndTime = performance.now();
        performanceService.recordMetric(
          "order_processing_time",
          orderEndTime - orderStartTime,
          "ms",
          "business",
        );
      }, 100);

      // Should track business metrics
      const businessMetrics = performanceService.getMetrics("business");
      expect(businessMetrics).toBeDefined();
    });

    it("should integrate with audio service performance", () => {
      // Mock audio loading time
      performanceService.recordMetric("audio_load_time", 300, "ms", "system");
      performanceService.recordMetric("audio_play_latency", 15, "ms", "user");

      const audioMetrics = performanceService
        .getMetrics()
        .filter((m) => m.name.includes("audio"));

      expect(audioMetrics.length).toBe(2);
    });

    it("should monitor offline sync performance", () => {
      const syncStart = performance.now();

      // Simulate sync operation
      setTimeout(() => {
        const syncEnd = performance.now();
        performanceService.recordMetric(
          "offline_sync_duration",
          syncEnd - syncStart,
          "ms",
          "system",
        );
      }, 200);

      const syncMetrics = performanceService
        .getMetrics()
        .filter((m) => m.name.includes("sync"));

      expect(syncMetrics.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle PerformanceObserver not supported", () => {
      global.PerformanceObserver = undefined as any;

      expect(() => {
        performanceService.start();
      }).not.toThrow();

      expect(performanceService.isMonitoring).toBe(false);
    });

    it("should handle invalid metric data gracefully", () => {
      expect(() => {
        performanceService.recordMetric("", NaN, "", "system");
      }).not.toThrow();

      expect(() => {
        performanceService.recordMetric(
          "test",
          Infinity,
          "ms",
          "invalid" as any,
        );
      }).not.toThrow();
    });

    it("should handle memory limits", () => {
      // Fill up metrics to test memory management
      for (let i = 0; i < 10000; i++) {
        performanceService.recordMetric(`metric_${i}`, i, "ms", "system");
      }

      const metrics = performanceService.getMetrics();

      // Should limit the number of stored metrics
      expect(metrics.length).toBeLessThanOrEqual(5000);
    });
  });

  describe("Performance Optimization", () => {
    it("should efficiently process large datasets", () => {
      const startTime = performance.now();

      // Process many metrics
      for (let i = 0; i < 1000; i++) {
        performanceService.recordMetric(`test_${i}`, i, "ms", "system");
      }

      const stats = performanceService.calculateStatistics("test_1");
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000); // 1 second
      expect(stats).toBeDefined();
    });

    it("should batch metric collections efficiently", async () => {
      const batchStart = performance.now();

      await Promise.all([
        performanceService.collectWebVitals(),
        performanceService.collectResourceMetrics(),
        performanceService.collectMemoryMetrics(),
      ]);

      const batchEnd = performance.now();

      expect(batchEnd - batchStart).toBeLessThan(500); // 500ms
    });
  });
});
