/**
 * SchedulingViews — Comprehensive unit tests
 *
 * SchedulingView:
 *  1. Layout & heading
 *  2. Create schedule button
 *  3. Add template button
 *  4. Refresh button
 *  5. Quick stats cards
 *  6. Currently working employees section
 *  7. Tab navigation (calendar, list, templates, conflicts, swaps)
 *  8. Calendar tab default active
 *  9. Error banner display
 * 10. Fetches schedules on mount
 *
 * SchedulingAnalyticsView:
 * 11. Layout & heading
 * 12. Refresh data button
 * 13. Export report button
 * 14. Quick stats cards (4 stats)
 * 15. Chart components rendered
 * 16. Data insights panel
 * 17. Fetches analytics on mount
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { nextTick } from "vue";

// ──── Icon stubs ────

vi.mock("@heroicons/vue/24/outline", () => {
  const stub = { template: "<span />" };
  return {
    CalendarIcon: stub,
    PlusIcon: stub,
    ArrowPathIcon: stub,
    ExclamationTriangleIcon: stub,
    ExclamationCircleIcon: stub,
    XMarkIcon: stub,
    ListBulletIcon: stub,
  };
});

// ──── Auth Store Mock ────

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    restaurantId: "rest-1",
    user: { id: "user-1", restaurantId: "rest-1" },
  }),
}));

// ──── Scheduling Service Mock ────

const mockGetSchedules = vi.fn();
const mockGetShiftTemplates = vi.fn();
const mockGetConflicts = vi.fn();
const mockGetSwapRequests = vi.fn();
const mockGetClockedInEmployees = vi.fn();
const mockGetDailyStats = vi.fn();
const mockGetWeeklySummary = vi.fn();
const mockDeleteSchedule = vi.fn();
const mockCreateSchedule = vi.fn();
const mockUpdateSchedule = vi.fn();
const mockCreateShiftTemplate = vi.fn();
const mockUpdateShiftTemplate = vi.fn();
const mockDeleteShiftTemplate = vi.fn();
const mockResolveConflict = vi.fn();
const mockApproveSwapRequest = vi.fn();
const mockRejectSwapRequest = vi.fn();

vi.mock("@/services/schedulingService", () => ({
  schedulingService: {
    getSchedules: (...a: any[]) => mockGetSchedules(...a),
    getShiftTemplates: (...a: any[]) => mockGetShiftTemplates(...a),
    getConflicts: (...a: any[]) => mockGetConflicts(...a),
    getSwapRequests: (...a: any[]) => mockGetSwapRequests(...a),
    getClockedInEmployees: (...a: any[]) => mockGetClockedInEmployees(...a),
    getDailyStats: (...a: any[]) => mockGetDailyStats(...a),
    getWeeklySummary: (...a: any[]) => mockGetWeeklySummary(...a),
    deleteSchedule: (...a: any[]) => mockDeleteSchedule(...a),
    createSchedule: (...a: any[]) => mockCreateSchedule(...a),
    updateSchedule: (...a: any[]) => mockUpdateSchedule(...a),
    createShiftTemplate: (...a: any[]) => mockCreateShiftTemplate(...a),
    updateShiftTemplate: (...a: any[]) => mockUpdateShiftTemplate(...a),
    deleteShiftTemplate: (...a: any[]) => mockDeleteShiftTemplate(...a),
    resolveConflict: (...a: any[]) => mockResolveConflict(...a),
    approveSwapRequest: (...a: any[]) => mockApproveSwapRequest(...a),
    rejectSwapRequest: (...a: any[]) => mockRejectSwapRequest(...a),
  },
}));

// ──── i18n ────

vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (key: string, params?: any) => key }),
}));

// ──── vue-router ────

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ params: {}, query: {} }),
}));

// ──── Child component stubs (SchedulingView) ────

vi.mock("@/components/scheduling/SchedulingCalendar.vue", () => ({
  default: {
    name: "SchedulingCalendar",
    template: '<div data-testid="scheduling-calendar" />',
    props: ["schedules", "loading"],
    emits: ["date-select", "schedule-click"],
  },
}));

vi.mock("@/components/scheduling/SchedulingList.vue", () => ({
  default: {
    name: "SchedulingList",
    template: '<div data-testid="scheduling-list" />',
    props: ["schedules", "loading"],
    emits: ["edit", "delete"],
  },
}));

vi.mock("@/components/scheduling/ShiftTemplatesList.vue", () => ({
  default: {
    name: "ShiftTemplatesList",
    template: '<div data-testid="shift-templates-list" />',
    props: ["templates", "loading"],
    emits: ["edit", "delete"],
  },
}));

vi.mock("@/components/scheduling/SchedulingConflicts.vue", () => ({
  default: {
    name: "SchedulingConflicts",
    template: '<div data-testid="scheduling-conflicts" />',
    props: ["conflicts", "loading"],
    emits: ["resolve"],
  },
}));

vi.mock("@/components/scheduling/SwapRequests.vue", () => ({
  default: {
    name: "SwapRequests",
    template: '<div data-testid="swap-requests" />',
    props: ["requests", "loading"],
    emits: ["approve", "reject"],
  },
}));

vi.mock("@/components/scheduling/ScheduleFormModal.vue", () => ({
  default: {
    name: "ScheduleFormModal",
    template: '<div data-testid="schedule-form-modal" />',
    props: ["schedule", "shiftTemplates"],
    emits: ["save", "close"],
  },
}));

vi.mock("@/components/scheduling/ShiftTemplateFormModal.vue", () => ({
  default: {
    name: "ShiftTemplateFormModal",
    template: '<div data-testid="shift-template-form-modal" />',
    props: ["modelValue", "template", "restaurantId"],
    emits: ["update:modelValue", "save"],
  },
}));

// ──── Child component stubs (SchedulingAnalyticsView) ────

vi.mock("@/components/charts/WorkHoursChart.vue", () => ({
  default: {
    name: "WorkHoursChart",
    template: '<div data-testid="work-hours-chart" />',
    props: ["autoFetch"],
  },
}));

vi.mock("@/components/charts/ShiftDistributionChart.vue", () => ({
  default: {
    name: "ShiftDistributionChart",
    template: '<div data-testid="shift-distribution-chart" />',
    props: ["autoFetch"],
  },
}));

vi.mock("@/components/charts/TrendChart.vue", () => ({
  default: {
    name: "TrendChart",
    template: '<div data-testid="trend-chart" />',
    props: ["autoFetch"],
  },
}));

// ──── Import components AFTER mocks ────

import SchedulingView from "../scheduling/SchedulingView.vue";
import SchedulingAnalyticsView from "../scheduling/SchedulingAnalyticsView.vue";

// ──── Mock data ────

const sampleSchedule = {
  id: "sch-1",
  employeeId: "emp-1",
  employeeName: "Alice",
  restaurantId: "rest-1",
  date: "2026-03-28",
  shiftStart: "09:00",
  shiftEnd: "17:00",
  status: "scheduled",
};

const sampleTemplate = {
  id: "tpl-1",
  name: "Morning Shift",
  startTime: "09:00",
  endTime: "17:00",
  restaurantId: "rest-1",
};

const sampleDailyStats = {
  totalEmployees: 12,
  totalHours: 96,
  currentlyWorking: 5,
  statusBreakdown: { noShow: 0, cancelled: 0 },
  totalOvertimeHours: 0,
};

const sampleWeeklySummary = {
  totalSchedules: 42,
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SchedulingView
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("SchedulingView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    mockGetSchedules.mockResolvedValue([sampleSchedule]);
    mockGetShiftTemplates.mockResolvedValue([sampleTemplate]);
    mockGetConflicts.mockResolvedValue([]);
    mockGetSwapRequests.mockResolvedValue([]);
    mockGetClockedInEmployees.mockResolvedValue([]);
  });

  const mountView = async () => {
    const w = mount(SchedulingView);
    await flushPromises();
    return w;
  };

  it("renders heading and subtitle", async () => {
    const w = await mountView();
    expect(w.find("h1").text()).toBe("scheduling.managementTitle");
    expect(w.text()).toContain("scheduling.managementSubtitle");
  });

  it("renders create schedule button", async () => {
    const w = await mountView();
    const btn = w
      .findAll("button")
      .find((b) => b.text().includes("scheduling.createSchedule"));
    expect(btn).toBeTruthy();
  });

  it("renders add template button", async () => {
    const w = await mountView();
    const btn = w
      .findAll("button")
      .find((b) => b.text().includes("scheduling.addTemplate"));
    expect(btn).toBeTruthy();
  });

  it("renders refresh button", async () => {
    const w = await mountView();
    const btn = w
      .findAll("button")
      .find((b) => b.text().includes("common.refresh"));
    expect(btn).toBeTruthy();
  });

  it("shows quick stats cards", async () => {
    const w = await mountView();
    // Monthly schedules and shift templates
    expect(w.text()).toContain("scheduling.monthlySchedules");
    expect(w.text()).toContain("shiftTemplates.title");
  });

  it("shows currently working section", async () => {
    const w = await mountView();
    expect(w.text()).toContain("scheduling.currentlyWorking");
  });

  it("shows no employees working message when none clocked in", async () => {
    const w = await mountView();
    expect(w.text()).toContain("scheduling.noEmployeesWorking");
  });

  it("shows clocked-in employees when they exist", async () => {
    mockGetClockedInEmployees.mockResolvedValue([
      {
        id: "ci-1",
        employeeId: "emp-1",
        employeeName: "Bob",
        clockInTime: "2026-03-28T09:00:00Z",
      },
    ]);
    const w = await mountView();
    expect(w.text()).toContain("Bob");
  });

  it("defaults to calendar tab", async () => {
    const w = await mountView();
    expect(w.find('[data-testid="scheduling-calendar"]').exists()).toBe(true);
  });

  it("shows tab navigation with calendar, list, templates, conflicts, swaps", async () => {
    const w = await mountView();
    expect(w.text()).toContain("scheduling.calendar");
    expect(w.text()).toContain("scheduling.list");
    expect(w.text()).toContain("scheduling.conflictWarnings");
    expect(w.text()).toContain("swapRequests.title");
  });

  it("does not show error banner initially", async () => {
    const w = await mountView();
    // No error text
    const errorBanner = w.findAll(".bg-red-50");
    expect(errorBanner.length).toBe(0);
  });

  it("fetches schedules on mount", async () => {
    await mountView();
    expect(mockGetSchedules).toHaveBeenCalled();
  });

  it("fetches shift templates on mount", async () => {
    await mountView();
    expect(mockGetShiftTemplates).toHaveBeenCalled();
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SchedulingAnalyticsView
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

describe("SchedulingAnalyticsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setActivePinia(createPinia());
    mockGetDailyStats.mockResolvedValue(sampleDailyStats);
    mockGetWeeklySummary.mockResolvedValue(sampleWeeklySummary);
  });

  const mountView = async () => {
    const w = mount(SchedulingAnalyticsView);
    await flushPromises();
    return w;
  };

  it("renders heading and subtitle", async () => {
    const w = await mountView();
    expect(w.find(".page-title").text()).toContain("schedulingAnalytics.title");
    expect(w.text()).toContain("schedulingAnalytics.subtitle");
  });

  it("renders refresh data button", async () => {
    const w = await mountView();
    const btn = w
      .findAll("button")
      .find((b) => b.text().includes("schedulingAnalytics.refreshData"));
    expect(btn).toBeTruthy();
  });

  it("renders export report button", async () => {
    const w = await mountView();
    const btn = w
      .findAll("button")
      .find((b) => b.text().includes("schedulingAnalytics.exportReport"));
    expect(btn).toBeTruthy();
  });

  it("shows 4 quick stat cards", async () => {
    const w = await mountView();
    const statCards = w.findAll(".stat-card");
    expect(statCards.length).toBe(4);
  });

  it("displays analytics values from API", async () => {
    const w = await mountView();
    const text = w.text();
    // totalEmployees=12
    expect(text).toContain("12");
    // totalHours=96 -> "96h"
    expect(text).toContain("96h");
    // weeklySchedules=42
    expect(text).toContain("42");
  });

  it("renders chart components", async () => {
    const w = await mountView();
    expect(w.find('[data-testid="work-hours-chart"]').exists()).toBe(true);
    expect(w.find('[data-testid="shift-distribution-chart"]').exists()).toBe(
      true,
    );
    expect(w.find('[data-testid="trend-chart"]').exists()).toBe(true);
  });

  it("renders data insights panel", async () => {
    const w = await mountView();
    expect(w.find(".analysis-panel").exists()).toBe(true);
    expect(w.text()).toContain("schedulingAnalytics.dataInsights");
  });

  it("shows all-good insight when no issues", async () => {
    const w = await mountView();
    expect(w.text()).toContain("schedulingAnalytics.insightAllGoodTitle");
  });

  it("shows absence insight when noShow > 0", async () => {
    mockGetDailyStats.mockResolvedValue({
      ...sampleDailyStats,
      statusBreakdown: { noShow: 3, cancelled: 0 },
    });
    const w = await mountView();
    expect(w.text()).toContain("schedulingAnalytics.insightAbsenceTitle");
  });

  it("calls getDailyStats and getWeeklySummary on mount", async () => {
    await mountView();
    expect(mockGetDailyStats).toHaveBeenCalled();
    expect(mockGetWeeklySummary).toHaveBeenCalled();
  });
});
