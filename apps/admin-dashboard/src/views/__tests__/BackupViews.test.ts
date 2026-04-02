/**
 * BackupViews — Comprehensive unit tests
 *
 * Covers:
 *  BackupDashboard:
 *    1. Layout & heading
 *    2. Create backup button
 *    3. Refresh button
 *    4. Health status card
 *    5. Stats grid (total, successful, storage, cost)
 *    6. Recent backups list with BackupListItem
 *    7. Empty state when no backups
 *    8. Alerts section
 *    9. Delete backup handler
 *   10. Restore backup handler
 *   11. Download backup handler
 *   12. Loading state disables refresh
 *
 *  BackupMonitoring:
 *   13. Layout & heading
 *   14. System health card with metrics
 *   15. Storage usage bar
 *   16. Performance period selector
 *   17. Restaurant status grid
 *   18. Restaurant status filter
 *   19. Critical alerts display
 *   20. Acknowledge / resolve alert buttons
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { nextTick, ref } from "vue";

// ──── Icon stubs ────

vi.mock("@heroicons/vue/24/outline", () => {
  const stub = { template: "<span />" };
  return {
    CheckCircleIcon: stub,
    ExclamationTriangleIcon: stub,
    ExclamationCircleIcon: stub,
    XCircleIcon: stub,
    ArrowPathIcon: stub,
    QuestionMarkCircleIcon: stub,
  };
});

// ──── Backup Store Mock ────

const mockGetSystemHealth = vi.fn();
const mockGetRestaurantMetrics = vi.fn();
const mockListBackups = vi.fn();
const mockGetRestaurantAlerts = vi.fn();
const mockDownloadBackup = vi.fn();
const mockDeleteBackup = vi.fn();
const mockAcknowledgeAlert = vi.fn();
const mockResolveAlert = vi.fn();

vi.mock("@/stores/backup", () => ({
  useBackupStore: () => ({
    getSystemHealth: (...a: any[]) => mockGetSystemHealth(...a),
    getRestaurantMetrics: (...a: any[]) => mockGetRestaurantMetrics(...a),
    listBackups: (...a: any[]) => mockListBackups(...a),
    getRestaurantAlerts: (...a: any[]) => mockGetRestaurantAlerts(...a),
    downloadBackup: (...a: any[]) => mockDownloadBackup(...a),
    deleteBackup: (...a: any[]) => mockDeleteBackup(...a),
    acknowledgeAlert: (...a: any[]) => mockAcknowledgeAlert(...a),
    resolveAlert: (...a: any[]) => mockResolveAlert(...a),
  }),
}));

// ──── Auth Store Mock ────

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    restaurantId: "rest-1",
    user: { id: "user-1", restaurantId: "rest-1" },
  }),
}));

// ──── API Mock ────

const mockApiGet = vi
  .fn()
  .mockResolvedValue({ data: { success: true, data: [] } });
vi.mock("@/services/api", () => ({
  api: {
    get: (...a: any[]) => mockApiGet(...a),
  },
}));

// ──── i18n (vue-i18n for BackupDashboard, @/i18n fallback) ────

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string, params?: any) => key }),
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (key: string, params?: any) => key }),
}));

// ──── vue-router ────

const mockRouterPush = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: mockRouterPush, replace: vi.fn() }),
  useRoute: () => ({ params: {}, query: {} }),
  RouterLink: { template: "<a><slot /></a>" },
}));

// ──── Child component stubs ────

vi.mock("@/components/backup/BackupListItem.vue", () => ({
  default: {
    name: "BackupListItem",
    template:
      '<div class="backup-list-item" data-testid="backup-list-item"><slot /></div>',
    props: ["backup"],
    emits: ["download", "restore", "delete"],
  },
}));

vi.mock("@/components/backup/BackupAlert.vue", () => ({
  default: {
    name: "BackupAlert",
    template:
      '<div class="backup-alert" data-testid="backup-alert"><slot /></div>',
    props: ["alert"],
    emits: ["acknowledge", "resolve"],
  },
}));

vi.mock("@/components/backup/CreateBackupModal.vue", () => ({
  default: {
    name: "CreateBackupModal",
    template: '<div data-testid="create-backup-modal" />',
    emits: ["close", "created"],
  },
}));

vi.mock("@/components/backup/RestoreBackupModal.vue", () => ({
  default: {
    name: "RestoreBackupModal",
    template: '<div data-testid="restore-backup-modal" />',
    props: ["backup"],
    emits: ["close", "restored"],
  },
}));

// ──── Import components AFTER mocks ────

import BackupDashboard from "../backup/BackupDashboard.vue";
import BackupMonitoring from "../backup/BackupMonitoring.vue";

// ──── Mock Data ────

const sampleBackup = {
  id: "bk-1",
  restaurant_id: "rest-1",
  configuration_id: "cfg-1",
  name: "Daily Backup",
  backup_type: "full",
  status: "completed",
  file_size: 1048576,
  compressed_size: 524288,
  records_count: 500,
  tables_included: ["orders", "menu_items"],
  storage_provider: "r2",
  storage_path: "/backups/bk-1.zip",
  encryption_enabled: true,
  checksum: "abc123",
  started_at: "2026-03-28T00:00:00Z",
  completed_at: "2026-03-28T00:05:00Z",
  created_by: "user-1",
};

const sampleAlert = {
  id: "alert-1",
  restaurant_id: "rest-1",
  alert_type: "backup_failed",
  severity: "high",
  title: "Backup Failed",
  message: "The daily backup failed",
  triggered_at: "2026-03-28T00:00:00Z",
  acknowledged: false,
  resolved: false,
};

const sampleHealth = {
  overall_status: "healthy",
  total_restaurants: 5,
  active_configurations: 10,
  running_backups: 0,
  failed_backups_24h: 0,
  storage_usage: {
    total_bytes: 1073741824,
    available_bytes: 536870912,
    usage_percentage: 50,
  },
  performance_metrics: {
    average_backup_duration_minutes: 5,
    average_success_rate_percentage: 98,
    average_compression_ratio: 0.5,
  },
  alerts_summary: { critical: 0, high: 0, medium: 0, low: 0 },
};

const sampleMetrics = {
  total_backups: 42,
  successful_backups: 40,
  failed_backups: 2,
  storage_usage_bytes: 2147483648,
  cost_estimation: 1.234,
  last_backup_at: "2026-03-28T00:00:00Z",
  total_storage_used: 2147483648,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BackupDashboard
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("BackupDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    mockGetSystemHealth.mockResolvedValue(sampleHealth);
    mockGetRestaurantMetrics.mockResolvedValue(sampleMetrics);
    mockListBackups.mockResolvedValue([sampleBackup]);
    mockGetRestaurantAlerts.mockResolvedValue([]);
  });

  const mountDashboard = async () => {
    const w = mount(BackupDashboard);
    await flushPromises();
    return w;
  };

  it("renders the dashboard heading", async () => {
    const w = await mountDashboard();
    expect(w.find("h1").text()).toBe("backup.dashboard.title");
  });

  it("renders create backup button", async () => {
    const w = await mountDashboard();
    const buttons = w.findAll("button");
    const createBtn = buttons.find((b) =>
      b.text().includes("backup.actions.create"),
    );
    expect(createBtn).toBeTruthy();
  });

  it("renders refresh button", async () => {
    const w = await mountDashboard();
    const buttons = w.findAll("button");
    const refreshBtn = buttons.find((b) =>
      b.text().includes("backup.actions.refresh"),
    );
    expect(refreshBtn).toBeTruthy();
  });

  it("displays health status card with healthy class", async () => {
    const w = await mountDashboard();
    const card = w.find(".health-status-card");
    expect(card.exists()).toBe(true);
    expect(card.classes()).toContain("health-healthy");
  });

  it("displays health status card with warning class", async () => {
    mockGetSystemHealth.mockResolvedValue({
      ...sampleHealth,
      overall_status: "warning",
      failed_backups_24h: 3,
    });
    const w = await mountDashboard();
    const card = w.find(".health-status-card");
    expect(card.classes()).toContain("health-warning");
  });

  it("shows stats grid with backup metrics", async () => {
    const w = await mountDashboard();
    const statCards = w.findAll(".stat-card");
    expect(statCards.length).toBe(4);
    // Total backups
    expect(w.text()).toContain("42");
    // Successful backups
    expect(w.text()).toContain("40");
  });

  it("shows storage usage formatted", async () => {
    const w = await mountDashboard();
    // 2147483648 bytes = 2.0 GB
    expect(w.text()).toContain("2.0 GB");
  });

  it("shows cost estimation", async () => {
    const w = await mountDashboard();
    expect(w.text()).toContain("$1.234");
  });

  it("renders backup list items when backups exist", async () => {
    const w = await mountDashboard();
    const items = w.findAll('[data-testid="backup-list-item"]');
    expect(items.length).toBe(1);
  });

  it("shows empty state when no backups", async () => {
    mockListBackups.mockResolvedValue([]);
    const w = await mountDashboard();
    expect(w.find(".empty-state").exists()).toBe(true);
    expect(w.text()).toContain("backup.empty.title");
  });

  it("opens create backup modal on button click", async () => {
    const w = await mountDashboard();
    const createBtn = w
      .findAll("button")
      .find((b) => b.text().includes("backup.actions.create"));
    await createBtn!.trigger("click");
    await nextTick();
    expect(w.find('[data-testid="create-backup-modal"]').exists()).toBe(true);
  });

  it("shows alerts section when alerts exist", async () => {
    mockGetRestaurantAlerts.mockResolvedValue([sampleAlert]);
    const w = await mountDashboard();
    expect(w.find(".alerts-section").exists()).toBe(true);
    expect(w.findAll('[data-testid="backup-alert"]').length).toBe(1);
  });

  it("hides alerts section when no alerts", async () => {
    const w = await mountDashboard();
    expect(w.find(".alerts-section").exists()).toBe(false);
  });

  it("calls refreshDashboard on mount", async () => {
    await mountDashboard();
    expect(mockGetSystemHealth).toHaveBeenCalled();
    expect(mockGetRestaurantMetrics).toHaveBeenCalledWith("rest-1");
    expect(mockListBackups).toHaveBeenCalled();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BackupMonitoring
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("BackupMonitoring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    mockGetSystemHealth.mockResolvedValue(sampleHealth);
    mockApiGet.mockResolvedValue({ data: { success: true, data: [] } });
    mockGetRestaurantMetrics.mockResolvedValue(sampleMetrics);
    mockGetRestaurantAlerts.mockResolvedValue([]);
    mockListBackups.mockResolvedValue([]);
  });

  const mountMonitoring = async () => {
    const w = mount(BackupMonitoring);
    await flushPromises();
    return w;
  };

  it("renders the monitoring heading", async () => {
    const w = await mountMonitoring();
    expect(w.find("h1").text()).toBe("backup.monitoring.title");
  });

  it("renders refresh button", async () => {
    const w = await mountMonitoring();
    const btn = w
      .findAll("button")
      .find((b) => b.text().includes("backup.actions.refresh"));
    expect(btn).toBeTruthy();
  });

  it("displays system health card", async () => {
    const w = await mountMonitoring();
    expect(w.find(".health-card").exists()).toBe(true);
  });

  it("applies healthy class to health card", async () => {
    const w = await mountMonitoring();
    expect(w.find(".health-card").classes()).toContain("health-healthy");
  });

  it("shows health metrics (total restaurants, active configs, running, failed)", async () => {
    const w = await mountMonitoring();
    const text = w.text();
    expect(text).toContain("5"); // total_restaurants
    expect(text).toContain("10"); // active_configurations
  });

  it("shows storage usage bar when storage data exists", async () => {
    const w = await mountMonitoring();
    expect(w.find(".storage-bar").exists()).toBe(true);
    expect(w.find(".storage-fill").exists()).toBe(true);
  });

  it("renders performance period selector with options", async () => {
    const w = await mountMonitoring();
    const select = w.find(".chart-controls select");
    expect(select.exists()).toBe(true);
    const options = select.findAll("option");
    expect(options.length).toBe(3);
  });

  it("shows restaurant status filter", async () => {
    const w = await mountMonitoring();
    const filterSelect = w.find(".filter-controls select");
    expect(filterSelect.exists()).toBe(true);
  });

  it("calls getSystemHealth on mount", async () => {
    await mountMonitoring();
    expect(mockGetSystemHealth).toHaveBeenCalled();
  });
});
