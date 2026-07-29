// @vitest-environment jsdom

import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import MonitoringView from "./MonitoringView.vue";
import { monitoringService } from "@/services/monitoringService";

vi.mock("vue-toastification", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key, locale: ref("zh-TW") }),
}));

vi.mock("@/composables/useConfirmModal", () => ({
  useConfirmModal: () => ({ confirm: vi.fn(async () => true) }),
}));

vi.mock("@/services/monitoringWebSocket", () => ({
  monitoringWebSocket: {
    alerts: ref([]),
    connectionStatus: ref({
      connected: true,
      reconnecting: false,
      lastConnected: null,
      reconnectAttempts: 0,
    }),
    connect: vi.fn(),
    disconnect: vi.fn(),
    acknowledgeAlert: vi.fn(),
    clearAllAlerts: vi.fn(),
  },
}));

vi.mock("@/services/monitoringService", () => ({
  monitoringService: {
    getOverview: vi.fn(),
    getMetrics: vi.fn(),
    getAlertRules: vi.fn(),
    getPerformanceReport: vi.fn(),
    updateAlertRule: vi.fn(),
    deleteAlertRule: vi.fn(),
    calculateHealthScore: vi.fn(() => 90),
    healthScoreBasis: vi.fn(() => ["api"]),
    formatUptime: vi.fn(() => "1d"),
    formatRelativeTime: vi.fn(() => "just now"),
  },
}));

const service = vi.mocked(monitoringService);

/** Mirrors AUTO_REFRESH_INTERVAL_MS in the view. */
const REFRESH_MS = 60_000;

// A component that outlives its test keeps re-rendering into the next one, and
// the resulting unhandled rejection breaks every later mount in the file.
enableAutoUnmount(afterEach);

function buildMetrics() {
  return {
    timestamp: Date.now(),
    measured: {
      api: true,
      database: false,
      cache: false,
      resources: false,
      errors: true,
    },
    apiMetrics: {
      totalRequests: 120,
      errorRate: 0.01,
      averageResponseTime: 150,
      p95ResponseTime: 300,
      p99ResponseTime: 500,
      slowRequestCount: 2,
      requestsPerSecond: 2,
    },
    databaseMetrics: {
      queryCount: 0,
      averageQueryTime: 0,
      slowQueryCount: 0,
      connectionPoolUsage: 0,
      errorCount: 0,
    },
    cacheMetrics: {
      hitRate: 0,
      totalKeys: 0,
      totalSize: 0,
      expiringKeysCount: 0,
      invalidationCount: 0,
    },
    resourceMetrics: {
      memoryUsage: 0,
      cpuUsage: 0,
      activeConnections: 0,
      queueLength: 0,
    },
    errorMetrics: {
      totalErrors: 1,
      criticalErrors: 0,
      warningCount: 1,
      errorsByType: { api_error: 1 },
    },
  };
}

function buildOverview() {
  return {
    status: "healthy" as const,
    uptime: 86_400_000,
    version: "2.0.0",
    timestamp: Date.now(),
    keyMetrics: {
      requestsPerMinute: 120,
      errorRate: "1.00%",
      averageResponseTime: "150ms",
      cacheHitRate: "0.0%",
      serverErrors: 0,
      clientErrors: 1,
    },
    components: [],
    topErrors: [],
    trends: {
      responseTime: { current: 150, p95: 300, p99: 500 },
      throughput: { requestsPerSecond: 2, totalRequests: 120 },
    },
    metrics: buildMetrics(),
  };
}

function buildPerformanceReport() {
  return {
    period: "7 days",
    generatedAt: Date.now(),
    apiPerformance: {
      totalRequests: 120,
      averageResponseTime: 150,
      p95ResponseTime: 300,
      p99ResponseTime: 500,
      errorRate: "1.00%",
      slowRequests: 2,
    },
    databasePerformance: {
      totalQueries: 0,
      averageQueryTime: 0,
      slowQueries: 0,
      queryErrorRate: "0.00%",
    },
    cachePerformance: {
      hitRate: "0.00%",
      totalKeys: 0,
      totalSize: "0.00 MB",
      expiringKeys: 0,
    },
    errorAnalysis: {
      totalErrors: 1,
      criticalErrors: 0,
      warningsCount: 1,
      errorsByType: [],
    },
    recommendations: [],
  };
}

/** document.hidden has no setter, so it has to be redefined. */
function setTabHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

async function mountView() {
  const wrapper = mount(MonitoringView, { shallow: true });
  await flushPromises();
  return wrapper;
}

describe("MonitoringView refresh cost", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-29T00:00:00.000Z"));
    vi.clearAllMocks();
    setTabHidden(false);
    service.getOverview.mockResolvedValue(buildOverview() as never);
    service.getMetrics.mockResolvedValue(buildMetrics() as never);
    service.getAlertRules.mockResolvedValue({ rules: [] } as never);
    service.getPerformanceReport.mockResolvedValue(
      buildPerformanceReport() as never,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // /overview already loads the metrics to derive keyMetrics and trends, so a
  // separate /metrics request re-fetched what the first response held.
  it("takes the metrics from the overview instead of a second request", async () => {
    await mountView();

    expect(service.getOverview).toHaveBeenCalledOnce();
    expect(service.getOverview).toHaveBeenCalledWith(
      expect.objectContaining({ includeMetrics: true }),
    );
    expect(service.getMetrics).not.toHaveBeenCalled();
  });

  // The API recomputes its Analytics Engine aggregate every 60s, so anything
  // faster spends a D1 probe and KV reads to redisplay identical numbers.
  it("refreshes no faster than the metrics aggregate is recomputed", async () => {
    await mountView();
    expect(service.getOverview).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(REFRESH_MS - 1000);
    expect(service.getOverview).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(service.getOverview).toHaveBeenCalledTimes(2);
  });

  it("skips the refresh while the tab is in the background", async () => {
    await mountView();
    expect(service.getOverview).toHaveBeenCalledTimes(1);

    setTabHidden(true);
    await vi.advanceTimersByTimeAsync(REFRESH_MS * 3);

    // Three intervals fired and every one of them cost nothing.
    expect(service.getOverview).toHaveBeenCalledTimes(1);
  });

  it("catches up once when a hidden tab comes back", async () => {
    await mountView();
    setTabHidden(true);
    await vi.advanceTimersByTimeAsync(REFRESH_MS * 3);
    expect(service.getOverview).toHaveBeenCalledTimes(1);

    setTabHidden(false);
    await flushPromises();

    // One catch-up, not one per interval that was skipped.
    expect(service.getOverview).toHaveBeenCalledTimes(2);
  });

  it("does not spend a refresh on a brief tab switch", async () => {
    await mountView();
    expect(service.getOverview).toHaveBeenCalledTimes(1);

    setTabHidden(true);
    await vi.advanceTimersByTimeAsync(5_000);
    setTabHidden(false);
    await flushPromises();

    // Nothing went stale in five seconds, so there is nothing to catch up on.
    expect(service.getOverview).toHaveBeenCalledTimes(1);
  });

  it("stops polling once the view is torn down", async () => {
    const wrapper = await mountView();
    wrapper.unmount();

    await vi.advanceTimersByTimeAsync(REFRESH_MS * 3);

    expect(service.getOverview).toHaveBeenCalledTimes(1);
  });
});
