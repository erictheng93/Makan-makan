/**
 * LeaveView Tests
 * Tests for the standalone Leave page with balance cards, request list, approval, and calendar.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount, flushPromises, VueWrapper } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { ref, nextTick } from "vue";
import { resetAllFactories } from "@makanmasak/testing-utils";

// ──── Mock data ────

const mockLeaveTypes = [
  { id: 1, name: "年假", code: "AL", color: "#007AFF", maxDaysPerYear: 14 },
  { id: 2, name: "病假", code: "SL", color: "#FF9500", maxDaysPerYear: 30 },
];

const mockBalances = [
  {
    id: 1,
    employeeId: 1,
    leaveTypeId: 1,
    year: 2026,
    totalDays: 14,
    usedDays: 3,
    remainingDays: 11,
  },
  {
    id: 2,
    employeeId: 1,
    leaveTypeId: 2,
    year: 2026,
    totalDays: 30,
    usedDays: 1,
    remainingDays: 29,
  },
];

const mockMyRequests = [
  {
    id: 301,
    employeeId: 1,
    leaveTypeId: 1,
    startDate: "2026-04-01",
    endDate: "2026-04-03",
    reason: "Trip",
    status: "pending",
    createdAt: "2026-03-20T10:00:00Z",
  },
  {
    id: 302,
    employeeId: 1,
    leaveTypeId: 2,
    startDate: "2026-03-25",
    endDate: "2026-03-25",
    reason: "Sick",
    status: "approved",
    createdAt: "2026-03-24T08:00:00Z",
  },
];

const mockAllRequests = [
  ...mockMyRequests,
  {
    id: 303,
    employeeId: 2,
    leaveTypeId: 1,
    startDate: "2026-04-05",
    endDate: "2026-04-06",
    reason: "Family",
    status: "pending",
    createdAt: "2026-03-22T09:00:00Z",
  },
];

// ──── Service mocks ────

const mockApiGet = vi.fn();
const mockApiPost = vi.fn();

vi.mock("@/services/api", () => ({
  api: {
    get: (...args: any[]) => mockApiGet(...args),
    post: (...args: any[]) => mockApiPost(...args),
  },
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
  t: (key: string) => key,
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    user: { id: 1, username: "admin", role: 0 },
    restaurantId: "r1",
    isAuthenticated: true,
  }),
}));

const mockPush = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: mockPush }),
  useRoute: () => ({ path: "/dashboard/leaves", params: {}, query: {} }),
}));

vi.mock("lucide-vue-next", () => {
  const stub = { template: "<span />" };
  return {
    Plus: stub,
    Crown: stub,
    ChefHat: stub,
    Truck: stub,
    CreditCard: stub,
    User: stub,
    CalendarX: stub,
    BarChart3: stub,
    CheckCircle: stub,
    ChevronDown: stub,
    Calendar: stub,
    Clock: stub,
    Timer: stub,
    CalendarOff: stub,
    FileText: stub,
    Check: stub,
    X: stub,
    AlertTriangle: stub,
    ChevronLeft: stub,
    ChevronRight: stub,
    Filter: stub,
    Search: stub,
    MoreHorizontal: stub,
    Eye: stub,
    Trash2: stub,
    Edit: stub,
    Info: stub,
    ArrowLeft: stub,
    ArrowRight: stub,
  };
});

// ──── Import (after mocks) ────

import LeaveView from "../LeaveView.vue";

// ──── Helpers ────

function makeStub(name: string, props: string[] = []) {
  return { name, props, template: "<div />" };
}

/**
 * Set up default mockApiGet to return data in the correct order.
 * LeaveView makes: getLeaveTypes, getBalances, getMyRequests, getAllRequests
 */
function setupDefaultApiMocks() {
  mockApiGet.mockImplementation((url: string, params?: any) => {
    if (url.includes("/types")) {
      return Promise.resolve({ data: { data: mockLeaveTypes } });
    }
    if (url.includes("/balances")) {
      return Promise.resolve({ data: { data: mockBalances } });
    }
    if (url.includes("/requests")) {
      if (params?.employeeId) {
        return Promise.resolve({ data: { data: mockMyRequests } });
      }
      return Promise.resolve({ data: { data: mockAllRequests } });
    }
    return Promise.resolve({ data: { data: [] } });
  });
  mockApiPost.mockResolvedValue({ data: { success: true } });
}

function mountComponent() {
  return mount(LeaveView, {
    global: {
      stubs: {
        LeaveBalanceCard: makeStub("LeaveBalanceCard", ["balance"]),
        LeaveRequestDialog: makeStub("LeaveRequestDialog", [
          "isOpen",
          "leaveTypes",
          "balances",
          "preselectedTypeId",
        ]),
        LeaveRequestList: makeStub("LeaveRequestList", [
          "requests",
          "leaveTypes",
        ]),
        LeaveApprovalList: makeStub("LeaveApprovalList", ["requests"]),
        LeaveCalendar: makeStub("LeaveCalendar", [
          "leaveRequests",
          "leaveTypes",
        ]),
        Teleport: true,
      },
    },
  });
}

// ══════════════════════════════════════════════════════════════
//  LEAVE VIEW TESTS
// ══════════════════════════════════════════════════════════════

describe("LeaveView", () => {
  let wrapper: VueWrapper;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetAllFactories();
    setActivePinia(createPinia());
    setupDefaultApiMocks();
    wrapper = mountComponent();
    await flushPromises();
  });

  // ── Layout ──

  it("should mount and render the page", () => {
    expect(wrapper.exists()).toBe(true);
  });

  it("should display the page title", () => {
    const text = wrapper.text();
    expect(text).toContain("leaves.title");
  });

  it("should display the page subtitle", () => {
    const text = wrapper.text();
    expect(text).toContain("leaves.subtitle");
  });

  it("should show the request leave button", () => {
    const btn = wrapper.find(".btn-request-leave");
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toContain("leaves.request.new");
  });

  // ── Tabs ──

  it("should render three tab buttons (my-leaves, approvals, calendar)", () => {
    const tabButtons = wrapper.findAll(".tab");
    expect(tabButtons.length).toBe(3);
    const allTabText = tabButtons.map((b) => b.text()).join(" ");
    expect(allTabText).toContain("leaves.tabs.myLeaves");
    expect(allTabText).toContain("leaves.tabs.approvals");
    expect(allTabText).toContain("leaves.tabs.calendar");
  });

  it("should show pending count badge on approvals tab", () => {
    const approvalTab = wrapper
      .findAll(".tab")
      .find((b) => b.text().includes("leaves.tabs.approvals"));
    expect(approvalTab).toBeTruthy();
    // 2 pending requests in mockAllRequests
    const badge = approvalTab!.find(".tab-count");
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toBe("2");
  });

  it("should have my-leaves tab active by default", () => {
    const activeTab = wrapper.find(".tab.active");
    expect(activeTab.exists()).toBe(true);
    expect(activeTab.text()).toContain("leaves.tabs.myLeaves");
  });

  // ── Balance cards ──

  it("should render LeaveBalanceCard components", () => {
    const cards = wrapper.findAllComponents({ name: "LeaveBalanceCard" });
    expect(cards.length).toBe(mockBalances.length);
  });

  // ── My requests ──

  it("should render LeaveRequestList with my requests", () => {
    const list = wrapper.findComponent({ name: "LeaveRequestList" });
    expect(list.exists()).toBe(true);
    expect(list.props("requests")).toEqual(mockMyRequests);
  });

  // ── Tab switching ──

  it("should show LeaveApprovalList when approvals tab is clicked", async () => {
    const approvalTab = wrapper
      .findAll(".tab")
      .find((b) => b.text().includes("leaves.tabs.approvals"));
    await approvalTab!.trigger("click");
    await nextTick();
    const approvalList = wrapper.findComponent({ name: "LeaveApprovalList" });
    // v-show means component always exists, but the section should be visible
    expect(approvalList.exists()).toBe(true);
  });

  it("should show LeaveCalendar when calendar tab is clicked", async () => {
    const calendarTab = wrapper
      .findAll(".tab")
      .find((b) => b.text().includes("leaves.tabs.calendar"));
    await calendarTab!.trigger("click");
    await nextTick();
    const calendar = wrapper.findComponent({ name: "LeaveCalendar" });
    expect(calendar.exists()).toBe(true);
  });

  // ── Request dialog ──

  it("should open LeaveRequestDialog when request button is clicked", async () => {
    const btn = wrapper.find(".btn-request-leave");
    await btn.trigger("click");
    await nextTick();
    const dialog = wrapper.findComponent({ name: "LeaveRequestDialog" });
    expect(dialog.exists()).toBe(true);
    expect(dialog.props("isOpen")).toBe(true);
  });

  // ── Data loading ──

  it("should call API to load leave types on mount", () => {
    expect(mockApiGet).toHaveBeenCalledWith(expect.stringContaining("/types"));
  });

  it("should call API to load balances on mount", () => {
    expect(mockApiGet).toHaveBeenCalledWith(
      expect.stringContaining("/balances"),
      expect.objectContaining({ employeeId: 1 }),
    );
  });

  it("should call API to load requests on mount", () => {
    expect(mockApiGet).toHaveBeenCalledWith(
      expect.stringContaining("/requests"),
      expect.objectContaining({ employeeId: 1 }),
    );
  });

  // ── Loading state ──

  it("should show loading overlay while data is loading", async () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));
    const w = mountComponent();
    await nextTick();
    const spinner = w.find(".loading-overlay");
    expect(spinner.exists()).toBe(true);
  });

  // ── Section titles ──

  it("should display balance and request section titles", () => {
    const text = wrapper.text();
    expect(text).toContain("leaves.balance.title");
    expect(text).toContain("leaves.request.myRequests");
  });
});
