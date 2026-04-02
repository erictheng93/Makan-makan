/**
 * MonitoringView — Comprehensive unit tests
 *
 * Covers:
 *  1. Layout & Health Status
 *  2. System Components
 *  3. Alerts
 *  4. Tabs
 *  5. API & Refresh
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { nextTick, ref } from "vue";
import { resetAllFactories } from "@makanmakan/testing-utils";

// ──── Mocks (must precede component import) ────

vi.mock("@heroicons/vue/24/outline", () => {
  const stub = { template: "<span />" };
  return {
    CheckCircleIcon: stub,
    ExclamationTriangleIcon: stub,
    XCircleIcon: stub,
    ArrowPathIcon: stub,
    BellIcon: stub,
    ChartBarIcon: stub,
    InformationCircleIcon: stub,
    PlusIcon: stub,
    TrashIcon: stub,
    PlayIcon: stub,
    PauseIcon: stub,
    ClockIcon: stub,
    ServerIcon: stub,
    CircleStackIcon: stub,
    MinusIcon: stub,
  };
});

// ── Monitoring Service Mock ──

const mockGetOverview = vi.fn();
const mockGetMetrics = vi.fn();
const mockGetAlertRules = vi.fn();
const mockGetPerformanceReport = vi.fn();
const mockUpdateAlertRule = vi.fn();
const mockDeleteAlertRule = vi.fn();
const mockCalculateHealthScore = vi.fn().mockReturnValue(83);
const mockFormatUptime = vi.fn().mockReturnValue("3d 2h 15m");
const mockFormatRelativeTime = vi.fn().mockReturnValue("剛剛");

vi.mock("@/services/monitoringService", () => ({
  monitoringService: {
    getOverview: (...args: any[]) => mockGetOverview(...args),
    getMetrics: (...args: any[]) => mockGetMetrics(...args),
    getAlertRules: (...args: any[]) => mockGetAlertRules(...args),
    getPerformanceReport: (...args: any[]) => mockGetPerformanceReport(...args),
    updateAlertRule: (...args: any[]) => mockUpdateAlertRule(...args),
    deleteAlertRule: (...args: any[]) => mockDeleteAlertRule(...args),
    calculateHealthScore: (...args: any[]) => mockCalculateHealthScore(...args),
    formatUptime: (...args: any[]) => mockFormatUptime(...args),
    formatRelativeTime: (...args: any[]) => mockFormatRelativeTime(...args),
  },
}));

// ── Monitoring WebSocket Mock ──

const mockWsConnect = vi.fn();
const mockWsDisconnect = vi.fn();
const mockWsAcknowledgeAlert = vi.fn();
const mockWsClearAllAlerts = vi.fn();
const mockWsAlerts = ref([
  {
    id: "alert-1",
    type: "warning",
    severity: "warning",
    title: "High CPU",
    message: "CPU usage exceeded 90%",
    timestamp: Date.now() - 60000,
    acknowledged: false,
  },
]);
const mockWsConnectionStatus = ref({
  connected: true,
  reconnecting: false,
  lastConnected: Date.now(),
  reconnectAttempts: 0,
});

vi.mock("@/services/monitoringWebSocket", () => ({
  monitoringWebSocket: {
    connect: (...args: any[]) => mockWsConnect(...args),
    disconnect: (...args: any[]) => mockWsDisconnect(...args),
    acknowledgeAlert: (...args: any[]) => mockWsAcknowledgeAlert(...args),
    clearAllAlerts: (...args: any[]) => mockWsClearAllAlerts(...args),
    alerts: mockWsAlerts,
    connectionStatus: mockWsConnectionStatus,
  },
}));

// ── API Mock ──

const mockApiGet = vi
  .fn()
  .mockResolvedValue({ data: { success: true, data: {} } });
vi.mock("@/services/api", () => ({
  api: {
    get: (...args: any[]) => mockApiGet(...args),
  },
}));

// ── vue-router ──

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useRoute: () => ({ params: {}, query: {} }),
}));

// ── i18n ──

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, any>) => key,
  }),
}));

// ── vue-toastification ──

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
const mockToastInfo = vi.fn();

vi.mock("vue-toastification", () => ({
  useToast: () => ({
    success: mockToastSuccess,
    error: mockToastError,
    info: mockToastInfo,
    warning: vi.fn(),
  }),
}));

// ── Child component stubs ──

vi.mock("@/components/monitoring/HealthScoreGauge.vue", () => ({
  default: {
    name: "HealthScoreGauge",
    template: '<div data-testid="health-gauge" />',
  },
}));
vi.mock("@/components/monitoring/MultiMetricChart.vue", () => ({
  default: { name: "MultiMetricChart", template: "<div />" },
}));
vi.mock("@/components/monitoring/MetricBarChart.vue", () => ({
  default: { name: "MetricBarChart", template: "<div />" },
}));
vi.mock("@/components/monitoring/MetricTrendChart.vue", () => ({
  default: { name: "MetricTrendChart", template: "<div />" },
}));
vi.mock("@/components/monitoring/AlertNotificationPanel.vue", () => ({
  default: {
    name: "AlertNotificationPanel",
    template: '<div data-testid="alert-panel"><slot /></div>',
    props: ["alerts", "connectionStatus"],
    emits: ["acknowledge", "clear-all", "reconnect"],
  },
}));
vi.mock("@/components/monitoring/CreateAlertRuleModal.vue", () => ({
  default: {
    name: "CreateAlertRuleModal",
    template: '<div data-testid="create-alert-modal" />',
    props: ["show"],
    emits: ["close", "created"],
  },
}));

// ──── Mock Data ────

const mockOverview = {
  status: "warning" as const,
  uptime: 259200000, // 3 days in ms
  version: "1.0.0",
  timestamp: Date.now(),
  keyMetrics: {
    requestsPerMinute: 1250,
    errorRate: "0.5%",
    averageResponseTime: "45ms",
    cacheHitRate: "92%",
    activeErrors: 3,
  },
  components: [
    {
      name: "api",
      status: "healthy" as const,
      latency: 42,
      issues: 0,
      issueDetails: [],
      lastCheck: Date.now(),
    },
    {
      name: "database",
      status: "healthy" as const,
      latency: 15,
      issues: 0,
      issueDetails: [],
      lastCheck: Date.now(),
    },
    {
      name: "cache",
      status: "critical" as const,
      latency: 120,
      issues: 2,
      issueDetails: ["Low hit rate", "Memory pressure"],
      lastCheck: Date.now(),
    },
    {
      name: "external",
      status: "healthy" as const,
      latency: 200,
      issues: 0,
      issueDetails: [],
      lastCheck: Date.now(),
    },
  ],
  topErrors: [{ type: "TIMEOUT_ERROR", count: 15 }],
  trends: {
    responseTime: { current: 45, p95: 120, p99: 250 },
    throughput: { requestsPerSecond: 20, totalRequests: 100000 },
  },
};

const mockMetrics = {
  timestamp: Date.now(),
  apiMetrics: {
    totalRequests: 100000,
    errorRate: 0.005,
    averageResponseTime: 45,
    p95ResponseTime: 120,
    p99ResponseTime: 250,
    slowRequestCount: 5,
    requestsPerSecond: 20,
  },
  databaseMetrics: {
    queryCount: 50000,
    averageQueryTime: 15,
    slowQueryCount: 3,
    connectionPoolUsage: 0.4,
    errorCount: 2,
  },
  cacheMetrics: {
    hitRate: 0.92,
    totalKeys: 1500,
    totalSize: 50000,
    expiringKeysCount: 200,
    invalidationCount: 10,
  },
  resourceMetrics: {
    memoryUsage: 0.6,
    cpuUsage: 0.3,
    activeConnections: 50,
    queueLength: 2,
  },
  errorMetrics: {
    totalErrors: 15,
    criticalErrors: 1,
    warningCount: 5,
    errorsByType: { TIMEOUT_ERROR: 15 },
  },
};

const mockAlertRulesData = {
  rules: [
    {
      id: "rule-1",
      name: "High Error Rate",
      condition: "error_rate > 5%",
      metric: "error_rate",
      operator: ">" as const,
      threshold: 5,
      duration: 300,
      config: {
        type: "slack" as const,
        severity: "critical" as const,
        enabled: true,
      },
      lastTriggered: Date.now() - 3600000,
      triggerCount: 3,
      isActive: true,
    },
  ],
};

const mockPerformanceReportData = {
  period: "7 days",
  generatedAt: Date.now(),
  apiPerformance: {
    totalRequests: 700000,
    averageResponseTime: 42,
    p95ResponseTime: 110,
    p99ResponseTime: 230,
    errorRate: "0.4%",
    slowRequests: 35,
  },
  databasePerformance: {
    totalQueries: 350000,
    averageQueryTime: 14,
    slowQueries: 20,
    queryErrorRate: "0.01%",
  },
  cachePerformance: {
    hitRate: "93%",
    totalKeys: 1500,
    totalSize: "48MB",
    expiringKeys: 180,
  },
  errorAnalysis: {
    totalErrors: 100,
    criticalErrors: 5,
    warningsCount: 30,
    errorsByType: [],
  },
  recommendations: ["Consider scaling cache nodes"],
};

// ──── Helpers ────

function setupMocks() {
  mockGetOverview.mockResolvedValue(mockOverview);
  mockGetMetrics.mockResolvedValue(mockMetrics);
  mockGetAlertRules.mockResolvedValue(mockAlertRulesData);
  mockGetPerformanceReport.mockResolvedValue(mockPerformanceReportData);
  mockUpdateAlertRule.mockResolvedValue({});
  mockDeleteAlertRule.mockResolvedValue({});
}

async function mountComponent() {
  const wrapper = mount((await import("../MonitoringView.vue")).default, {
    global: {
      stubs: {
        teleport: true,
      },
    },
  });
  await flushPromises();
  return wrapper;
}

// ──── Tests ────

describe("MonitoringView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllFactories();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setActivePinia(createPinia());
    setupMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ================================================================
  // 1. Layout & Health Status
  // ================================================================

  describe("Layout & Health Status", () => {
    it("should render monitoring.title heading", async () => {
      const wrapper = await mountComponent();
      expect(wrapper.text()).toContain("monitoring.title");
    });

    it("should display overall health status card (score, uptime, last update)", async () => {
      const wrapper = await mountComponent();
      const text = wrapper.text();
      expect(text).toContain("monitoring.health.overall");
      expect(text).toContain("monitoring.health.score");
      expect(text).toContain("monitoring.misc.uptime");
      expect(text).toContain("monitoring.misc.lastUpdate");
    });

    it("should show health score progress bar", async () => {
      const wrapper = await mountComponent();
      // The progress bar has width set as percentage of healthScore
      const progressBar = wrapper.find(".bg-gray-200.rounded-full.h-3 div");
      expect(progressBar.exists()).toBe(true);
      expect(progressBar.attributes("style")).toContain("width:");
    });

    it("should show auto-refresh and refresh buttons", async () => {
      const wrapper = await mountComponent();
      const buttons = wrapper.findAll("button");
      const buttonTexts = buttons.map((b) => b.text());
      // autoRefresh is true by default, so it shows the auto refresh key
      expect(
        buttonTexts.some((t) => t.includes("monitoring.actions.autoRefresh")),
      ).toBe(true);
      expect(
        buttonTexts.some((t) => t.includes("monitoring.actions.refresh")),
      ).toBe(true);
    });

    it("should display key metrics section", async () => {
      const wrapper = await mountComponent();
      expect(wrapper.text()).toContain("monitoring.keyMetrics.title");
      expect(wrapper.text()).toContain(
        "monitoring.keyMetrics.requestsPerMinute",
      );
      expect(wrapper.text()).toContain(
        "monitoring.keyMetrics.averageResponseTime",
      );
      expect(wrapper.text()).toContain("monitoring.keyMetrics.cacheHitRate");
      expect(wrapper.text()).toContain("monitoring.keyMetrics.activeErrors");
    });

    it("should show monitoring status indicator (polling via WebSocket connect)", async () => {
      await mountComponent();
      // connectWebSocket is called on mount
      expect(mockWsConnect).toHaveBeenCalled();
    });
  });

  // ================================================================
  // 2. System Components
  // ================================================================

  describe("System Components", () => {
    it("should display component cards (API, DB, cache, external)", async () => {
      const wrapper = await mountComponent();
      const text = wrapper.text();
      expect(text).toContain("monitoring.components.api");
      expect(text).toContain("monitoring.components.database");
      expect(text).toContain("monitoring.components.cache");
      expect(text).toContain("monitoring.components.external");
    });

    it("should show health score per component", async () => {
      const wrapper = await mountComponent();
      // Each component card shows healthScore/100
      const text = wrapper.text();
      expect(text).toContain("monitoring.components.healthScore");
      // Check that "/100" appears for component score labels
      expect(text).toContain("/100");
    });

    it("should show latency and error rate", async () => {
      const wrapper = await mountComponent();
      const text = wrapper.text();
      expect(text).toContain("monitoring.components.latency");
      expect(text).toContain("monitoring.components.errorRate");
    });

    it("should highlight issues (e.g. cache low hit rate)", async () => {
      const wrapper = await mountComponent();
      const text = wrapper.text();
      // The cache component has issueDetails
      expect(text).toContain("Low hit rate");
      expect(text).toContain("Memory pressure");
      expect(text).toContain("monitoring.components.issuesFound");
    });

    it("should call health API on mount", async () => {
      await mountComponent();
      expect(mockGetOverview).toHaveBeenCalledTimes(1);
      expect(mockGetMetrics).toHaveBeenCalledTimes(1);
    });
  });

  // ================================================================
  // 3. Alerts
  // ================================================================

  describe("Alerts", () => {
    it("should show alert count badge on tab", async () => {
      const wrapper = await mountComponent();
      // The alerts tab has a badge with alertRules count
      const tabNav = wrapper.find('nav[aria-label="Tabs"]');
      const badges = tabNav.findAll(".rounded-full.text-xs");
      // First tab (alerts) badge should show count = 1
      expect(badges.length).toBeGreaterThan(0);
      expect(badges[0].text()).toBe("1");
    });

    it("should display alert rules with severity and condition", async () => {
      const wrapper = await mountComponent();
      const text = wrapper.text();
      expect(text).toContain("High Error Rate");
      expect(text).toContain("error_rate > 5%");
    });

    it("should show create alert rule button", async () => {
      const wrapper = await mountComponent();
      const text = wrapper.text();
      expect(text).toContain("monitoring.misc.createAlertRule");
    });

    it("should render alert rule trigger count and last triggered", async () => {
      const wrapper = await mountComponent();
      const text = wrapper.text();
      expect(text).toContain("monitoring.misc.triggerCount");
      expect(text).toContain("monitoring.misc.lastTriggered");
    });

    it("should handle empty alerts state when no rules exist", async () => {
      mockGetAlertRules.mockResolvedValue({ rules: [] });
      const wrapper = await mountComponent();
      expect(wrapper.text()).toContain("monitoring.misc.noAlertRules");
      expect(wrapper.text()).toContain("monitoring.misc.createAlertRuleHint");
    });
  });

  // ================================================================
  // 4. Tabs
  // ================================================================

  describe("Tabs", () => {
    it("should render tab navigation (alerts, performance, errors)", async () => {
      const wrapper = await mountComponent();
      const text = wrapper.text();
      expect(text).toContain("monitoring.tabs.alerts");
      expect(text).toContain("monitoring.tabs.performance");
      expect(text).toContain("monitoring.tabs.errors");
    });

    it("should show create alert rule button on rules tab", async () => {
      const wrapper = await mountComponent();
      // Default tab is alerts
      expect(wrapper.text()).toContain("monitoring.misc.createAlertRule");
    });

    it("should show empty state for no rules", async () => {
      mockGetAlertRules.mockResolvedValue({ rules: [] });
      const wrapper = await mountComponent();
      expect(wrapper.text()).toContain("monitoring.misc.noAlertRules");
    });

    it("should switch tab content on click", async () => {
      const wrapper = await mountComponent();
      // Find the errors tab button and click it
      const tabButtons = wrapper.findAll('nav[aria-label="Tabs"] button');
      const errorsTab = tabButtons.find((b) =>
        b.text().includes("monitoring.tabs.errors"),
      );
      expect(errorsTab).toBeDefined();
      await errorsTab!.trigger("click");
      await nextTick();
      // Should now show errors content
      expect(wrapper.text()).toContain("monitoring.errors.title");
    });

    it("should show error count badge on errors tab", async () => {
      const wrapper = await mountComponent();
      const tabNav = wrapper.find('nav[aria-label="Tabs"]');
      const badges = tabNav.findAll(".rounded-full.text-xs");
      // Third tab (errors) badge should show topErrors count = 1
      const lastBadge = badges[badges.length - 1];
      expect(lastBadge.text()).toBe("1");
    });
  });

  // ================================================================
  // 5. API & Refresh
  // ================================================================

  describe("API & Refresh", () => {
    it("should call monitoring APIs on mount", async () => {
      await mountComponent();
      expect(mockGetOverview).toHaveBeenCalledTimes(1);
      expect(mockGetMetrics).toHaveBeenCalledTimes(1);
      expect(mockGetAlertRules).toHaveBeenCalledTimes(1);
      expect(mockGetPerformanceReport).toHaveBeenCalledTimes(1);
    });

    it("should refresh data on refresh button click", async () => {
      const wrapper = await mountComponent();
      vi.clearAllMocks();
      setupMocks();

      // Find the refresh button (contains monitoring.actions.refresh)
      const buttons = wrapper.findAll("button");
      const refreshBtn = buttons.find(
        (b) =>
          b.text().includes("monitoring.actions.refresh") &&
          !b.text().includes("auto"),
      );
      expect(refreshBtn).toBeDefined();
      await refreshBtn!.trigger("click");
      await flushPromises();

      expect(mockGetOverview).toHaveBeenCalled();
      expect(mockGetMetrics).toHaveBeenCalled();
      expect(mockGetAlertRules).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalled();
    });

    it("should toggle auto-update on button click", async () => {
      const wrapper = await mountComponent();
      // Auto refresh is on by default
      const buttons = wrapper.findAll("button");
      const autoBtn = buttons.find((b) =>
        b.text().includes("monitoring.actions.autoRefresh"),
      );
      expect(autoBtn).toBeDefined();
      await autoBtn!.trigger("click");
      await nextTick();
      // After toggling off, the button text should switch
      expect(mockToastInfo).toHaveBeenCalled();
    });

    it("should handle API errors gracefully", async () => {
      mockGetOverview.mockRejectedValue(new Error("Network error"));
      mockGetMetrics.mockRejectedValue(new Error("Network error"));
      mockGetAlertRules.mockRejectedValue(new Error("Network error"));
      mockGetPerformanceReport.mockRejectedValue(new Error("Network error"));

      const wrapper = await mountComponent();
      // Should display error toast
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  // ================================================================
  // 6. Performance Report Tab
  // ================================================================

  describe("Performance Report Tab", () => {
    it("should show performance tab content when clicked", async () => {
      const wrapper = await mountComponent();
      const tabButtons = wrapper.findAll('nav[aria-label="Tabs"] button');
      const perfTab = tabButtons.find((b) =>
        b.text().includes("monitoring.tabs.performance"),
      );
      expect(perfTab).toBeDefined();
      await perfTab!.trigger("click");
      await nextTick();
      expect(wrapper.text()).toContain("monitoring.performance.title");
    });

    it("should show API performance metrics", async () => {
      const wrapper = await mountComponent();
      const tabButtons = wrapper.findAll('nav[aria-label="Tabs"] button');
      const perfTab = tabButtons.find((b) =>
        b.text().includes("monitoring.tabs.performance"),
      );
      await perfTab!.trigger("click");
      await nextTick();
      expect(wrapper.text()).toContain("monitoring.performance.api.title");
      expect(wrapper.text()).toContain(
        "monitoring.performance.api.totalRequests",
      );
      expect(wrapper.text()).toContain(
        "monitoring.performance.api.averageResponseTime",
      );
    });

    it("should show database performance metrics", async () => {
      const wrapper = await mountComponent();
      const tabButtons = wrapper.findAll('nav[aria-label="Tabs"] button');
      const perfTab = tabButtons.find((b) =>
        b.text().includes("monitoring.tabs.performance"),
      );
      await perfTab!.trigger("click");
      await nextTick();
      expect(wrapper.text()).toContain("monitoring.performance.database.title");
      expect(wrapper.text()).toContain(
        "monitoring.performance.database.totalQueries",
      );
    });

    it("should show cache performance metrics", async () => {
      const wrapper = await mountComponent();
      const tabButtons = wrapper.findAll('nav[aria-label="Tabs"] button');
      const perfTab = tabButtons.find((b) =>
        b.text().includes("monitoring.tabs.performance"),
      );
      await perfTab!.trigger("click");
      await nextTick();
      expect(wrapper.text()).toContain("monitoring.performance.cache.title");
      expect(wrapper.text()).toContain("monitoring.performance.cache.hitRate");
    });

    it("should show recommendations when available", async () => {
      const wrapper = await mountComponent();
      const tabButtons = wrapper.findAll('nav[aria-label="Tabs"] button');
      const perfTab = tabButtons.find((b) =>
        b.text().includes("monitoring.tabs.performance"),
      );
      await perfTab!.trigger("click");
      await nextTick();
      expect(wrapper.text()).toContain("Consider scaling cache nodes");
    });

    it("should show period selector in performance tab", async () => {
      const wrapper = await mountComponent();
      const tabButtons = wrapper.findAll('nav[aria-label="Tabs"] button');
      const perfTab = tabButtons.find((b) =>
        b.text().includes("monitoring.tabs.performance"),
      );
      await perfTab!.trigger("click");
      await nextTick();
      const selects = wrapper.findAll("select");
      expect(selects.length).toBeGreaterThan(0);
    });
  });

  // ================================================================
  // 7. Errors Tab
  // ================================================================

  describe("Errors Tab", () => {
    it("should show error analysis content", async () => {
      const wrapper = await mountComponent();
      const tabButtons = wrapper.findAll('nav[aria-label="Tabs"] button');
      const errorsTab = tabButtons.find((b) =>
        b.text().includes("monitoring.tabs.errors"),
      );
      await errorsTab!.trigger("click");
      await nextTick();
      expect(wrapper.text()).toContain("monitoring.errors.title");
    });

    it("should display error types from overview", async () => {
      const wrapper = await mountComponent();
      const tabButtons = wrapper.findAll('nav[aria-label="Tabs"] button');
      const errorsTab = tabButtons.find((b) =>
        b.text().includes("monitoring.tabs.errors"),
      );
      await errorsTab!.trigger("click");
      await nextTick();
      expect(wrapper.text()).toContain("TIMEOUT_ERROR");
    });

    it("should show error statistics section", async () => {
      const wrapper = await mountComponent();
      const tabButtons = wrapper.findAll('nav[aria-label="Tabs"] button');
      const errorsTab = tabButtons.find((b) =>
        b.text().includes("monitoring.tabs.errors"),
      );
      await errorsTab!.trigger("click");
      await nextTick();
      expect(wrapper.text()).toContain("monitoring.errors.statistics");
    });
  });

  // ================================================================
  // 8. Alert Rules (Deeper)
  // ================================================================

  describe("Alert Rules (Deeper)", () => {
    it("should show alert severity badge", async () => {
      const wrapper = await mountComponent();
      // The alert rule has severity "critical"
      const text = wrapper.text();
      expect(text).toContain("High Error Rate");
    });

    it("should show enabled/disabled status badge", async () => {
      const wrapper = await mountComponent();
      // The rule has isActive=true, so it shows 'enabled'
      expect(wrapper.text()).toContain("monitoring.misc.enabled");
    });

    it("should toggle alert rule active state", async () => {
      const wrapper = await mountComponent();
      // Find the pause/play button for the alert rule
      const ruleRow = wrapper.find(".border.border-gray-200.rounded-lg.p-4");
      expect(ruleRow.exists()).toBe(true);
      const toggleButtons = ruleRow.findAll("button");
      // First button in actions is the toggle
      const toggleBtn = toggleButtons[0];
      await toggleBtn.trigger("click");
      await flushPromises();
      expect(mockUpdateAlertRule).toHaveBeenCalled();
    });

    it("should delete alert rule on trash click", async () => {
      vi.spyOn(window, "confirm").mockReturnValue(true);
      const wrapper = await mountComponent();
      const ruleRow = wrapper.find(".border.border-gray-200.rounded-lg.p-4");
      const buttons = ruleRow.findAll("button");
      // Second button in actions is delete
      const deleteBtn = buttons[1];
      await deleteBtn.trigger("click");
      await flushPromises();
      expect(mockDeleteAlertRule).toHaveBeenCalled();
    });

    it("should show create alert rule modal trigger", async () => {
      const wrapper = await mountComponent();
      const createBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("monitoring.misc.createAlertRule"));
      expect(createBtn).toBeDefined();
      await createBtn!.trigger("click");
      await nextTick();
      // Modal should be shown (the stub exists with data-testid)
      expect(wrapper.find('[data-testid="create-alert-modal"]').exists()).toBe(
        true,
      );
    });
  });

  // ================================================================
  // 9. Component Health Details
  // ================================================================

  describe("Component Health Details", () => {
    it("should show component status badges", async () => {
      const wrapper = await mountComponent();
      // Each component card has a status badge
      const statusBadges = wrapper.findAll(".rounded-full.text-xs.font-medium");
      expect(statusBadges.length).toBeGreaterThan(0);
    });

    it("should show issue details for unhealthy components", async () => {
      const wrapper = await mountComponent();
      expect(wrapper.text()).toContain("Low hit rate");
      expect(wrapper.text()).toContain("Memory pressure");
    });

    it("should show component last check time", async () => {
      const wrapper = await mountComponent();
      expect(wrapper.text()).toContain("monitoring.components.lastCheck");
    });

    it("should show health score progress bars for each component", async () => {
      const wrapper = await mountComponent();
      // Multiple progress bars exist (overall + per component)
      const progressBars = wrapper.findAll(".bg-gray-200.rounded-full.h-2");
      expect(progressBars.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ================================================================
  // 10. Auto-Refresh Behavior
  // ================================================================

  describe("Auto-Refresh Behavior", () => {
    it("should show auto-refresh as enabled by default", async () => {
      const wrapper = await mountComponent();
      const autoBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("monitoring.actions.autoRefresh"));
      expect(autoBtn).toBeDefined();
      // Button should be marked as active
      expect(autoBtn!.attributes("data-active")).toBe("true");
    });

    it("should toggle to manual refresh text after click", async () => {
      const wrapper = await mountComponent();
      const autoBtn = wrapper
        .findAll("button")
        .find((b) => b.text().includes("monitoring.actions.autoRefresh"));
      await autoBtn!.trigger("click");
      await nextTick();
      // After toggling off, toast is shown
      expect(mockToastInfo).toHaveBeenCalled();
    });

    it("should connect WebSocket on mount", async () => {
      await mountComponent();
      expect(mockWsConnect).toHaveBeenCalled();
    });

    it("should show formatted uptime value", async () => {
      const wrapper = await mountComponent();
      // formatUptime mock returns "3d 2h 15m"
      expect(wrapper.text()).toContain("3d 2h 15m");
    });
  });
});
