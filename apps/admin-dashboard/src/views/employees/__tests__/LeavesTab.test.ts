/**
 * LeavesTab Tests
 * Tests for the top-level leaves management tab (approval queue, history, balance).
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { mount, flushPromises, VueWrapper } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { ref, nextTick } from "vue";
import { userFactory, resetAllFactories } from "@makanmasak/testing-utils";

// ──── Mock data ────

const mockLeaveTypes = [
  {
    id: 1,
    name: "年假",
    description: "Annual leave",
    maxDaysPerYear: 14,
    requiresApproval: true,
    color: "#007AFF",
  },
  {
    id: 2,
    name: "病假",
    description: "Sick leave",
    maxDaysPerYear: 30,
    requiresApproval: true,
    color: "#FF9500",
  },
];

const mockLeaveRequests = [
  {
    id: 201,
    employeeId: 1,
    employeeName: "Alice",
    leaveTypeId: 1,
    leaveTypeName: "年假",
    startDate: "2026-04-01",
    endDate: "2026-04-03",
    period: "full" as const,
    days: 3,
    reason: "Vacation",
    status: "pending" as const,
    createdAt: "2026-03-20T10:00:00Z",
  },
  {
    id: 202,
    employeeId: 2,
    employeeName: "Bob",
    leaveTypeId: 2,
    leaveTypeName: "病假",
    startDate: "2026-03-25",
    endDate: "2026-03-25",
    period: "full" as const,
    days: 1,
    reason: "Sick",
    status: "approved" as const,
    approvedBy: 10,
    createdAt: "2026-03-24T08:00:00Z",
  },
  {
    id: 203,
    employeeId: 3,
    employeeName: "Charlie",
    leaveTypeId: 1,
    leaveTypeName: "年假",
    startDate: "2026-04-10",
    endDate: "2026-04-11",
    period: "full" as const,
    days: 2,
    reason: "Personal",
    status: "rejected" as const,
    rejectionReason: "Not enough staff",
    createdAt: "2026-03-22T09:00:00Z",
  },
];

const mockBalances = [
  {
    id: 1,
    employeeId: 1,
    leaveTypeId: 1,
    leaveTypeName: "年假",
    totalDays: 14,
    usedDays: 3,
    pendingDays: 3,
    remainingDays: 8,
    year: 2026,
  },
  {
    id: 2,
    employeeId: 2,
    leaveTypeId: 2,
    leaveTypeName: "病假",
    totalDays: 30,
    usedDays: 1,
    pendingDays: 0,
    remainingDays: 29,
    year: 2026,
  },
];

const mockUsers = [
  {
    ...userFactory.buildChef(1, {
      overrides: { id: 1, username: "alice", fullName: "Alice" },
    }),
  },
  {
    ...userFactory.buildServiceCrew(1, {
      overrides: { id: 2, username: "bob", fullName: "Bob" },
    }),
  },
  {
    ...userFactory.buildServiceCrew(1, {
      overrides: { id: 3, username: "charlie", fullName: "Charlie" },
    }),
  },
];

// ──── Service mocks ────

const mockGetLeaveTypes = vi.fn().mockResolvedValue(mockLeaveTypes);
const mockGetRequests = vi.fn().mockResolvedValue(mockLeaveRequests);
const mockGetRestaurantBalances = vi.fn().mockResolvedValue(mockBalances);
const mockApproveRequest = vi.fn().mockResolvedValue(undefined);
const mockRejectRequest = vi.fn().mockResolvedValue(undefined);
const mockCreateRequest = vi.fn().mockResolvedValue({ id: 204 });

vi.mock("@/services/leavesService", () => ({
  leavesService: {
    getLeaveTypes: (...args: any[]) => mockGetLeaveTypes(...args),
    getRequests: (...args: any[]) => mockGetRequests(...args),
    getRestaurantBalances: (...args: any[]) =>
      mockGetRestaurantBalances(...args),
    approveRequest: (...args: any[]) => mockApproveRequest(...args),
    rejectRequest: (...args: any[]) => mockRejectRequest(...args),
    createRequest: (...args: any[]) => mockCreateRequest(...args),
  },
}));

vi.mock("@/services/api", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ data: { success: true, data: [] } }),
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
    put: vi.fn().mockResolvedValue({ data: { success: true } }),
    patch: vi.fn().mockResolvedValue({ data: { success: true } }),
    delete: vi.fn().mockResolvedValue({ data: { success: true } }),
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

const mockFetchUsers = vi.fn().mockResolvedValue(undefined);

vi.mock("@/composables/useEmployeeList", () => ({
  useEmployeeList: () => ({
    users: ref(mockUsers),
    fetchUsers: mockFetchUsers,
    usersWithStatus: ref(mockUsers),
    isLoading: ref(false),
    stats: ref({
      owner: 0,
      chef: 1,
      service: 2,
      cashier: 0,
      total: 3,
      currentlyWorking: 1,
      onLeaveToday: 0,
    }),
    fetchAll: vi.fn().mockResolvedValue(undefined),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    resetPassword: vi.fn(),
    toggleUserStatus: vi.fn(),
  }),
}));

vi.mock("lucide-vue-next", () => {
  const stub = { template: "<span />" };
  return { Plus: stub };
});

// ──── Import (after mocks) ────

import LeavesTab from "../LeavesTab.vue";

// ──── Helpers ────

function makeStub(name: string, props: string[] = []) {
  return { name, props, template: "<div />" };
}

function mountComponent() {
  return mount(LeavesTab, {
    global: {
      stubs: {
        LeaveApprovalQueue: makeStub("LeaveApprovalQueue", [
          "requests",
          "balances",
          "teamLeaves",
          "staffingThreshold",
        ]),
        LeaveHistoryList: makeStub("LeaveHistoryList", [
          "requests",
          "leaveTypes",
        ]),
        LeaveBalanceOverview: makeStub("LeaveBalanceOverview", [
          "balances",
          "employees",
        ]),
        LeaveRequestDialog: makeStub("LeaveRequestDialog", [
          "isOpen",
          "leaveTypes",
          "balances",
        ]),
        Teleport: true,
      },
    },
  });
}

// ══════════════════════════════════════════════════════════════
//  LEAVES TAB TESTS
// ══════════════════════════════════════════════════════════════

describe("LeavesTab", () => {
  let wrapper: VueWrapper;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetAllFactories();
    setActivePinia(createPinia());
    mockGetLeaveTypes.mockResolvedValue(mockLeaveTypes);
    mockGetRequests.mockResolvedValue(mockLeaveRequests);
    mockGetRestaurantBalances.mockResolvedValue(mockBalances);
    wrapper = mountComponent();
    await flushPromises();
  });

  // ── Rendering ──

  it("should mount and render the component", () => {
    expect(wrapper.exists()).toBe(true);
  });

  it("should display three sub-tab buttons (queue, history, balance)", () => {
    const tabButtons = wrapper.findAll("button").filter((btn) => {
      const text = btn.text();
      return (
        text.includes("待我處理") ||
        text.includes("全部請假") ||
        text.includes("假期餘額")
      );
    });
    expect(tabButtons.length).toBe(3);
  });

  it("should show the request leave button", () => {
    const btn = wrapper.findAll("button").find((b) => {
      return b.text().includes("申請請假");
    });
    expect(btn).toBeTruthy();
  });

  it("should display pending badge count on queue tab", () => {
    const badge = wrapper.find(
      "span.min-w-\\[18px\\].h-\\[18px\\].text-xs.font-bold.rounded-full",
    );
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toBe("1");
  });

  // ── Default tab (approval queue) ──

  it("should show LeaveApprovalQueue by default", () => {
    const queue = wrapper.findComponent({ name: "LeaveApprovalQueue" });
    expect(queue.exists()).toBe(true);
  });

  it("should pass only pending requests to LeaveApprovalQueue", () => {
    const queue = wrapper.findComponent({ name: "LeaveApprovalQueue" });
    const pendingOnly = mockLeaveRequests.filter((r) => r.status === "pending");
    expect(queue.props("requests")).toEqual(pendingOnly);
  });

  // ── Data loading ──

  it("should call leavesService.getLeaveTypes on mount", () => {
    expect(mockGetLeaveTypes).toHaveBeenCalledWith("r1");
  });

  it("should call leavesService.getRequests on mount", () => {
    expect(mockGetRequests).toHaveBeenCalledWith("r1");
  });

  it("should call leavesService.getRestaurantBalances on mount", () => {
    expect(mockGetRestaurantBalances).toHaveBeenCalledWith("r1");
  });

  it("should call fetchUsers on mount", () => {
    expect(mockFetchUsers).toHaveBeenCalled();
  });

  // ── Tab switching ──

  it("should show LeaveHistoryList when history tab is clicked", async () => {
    const historyBtn = wrapper.findAll("button").find((b) => {
      return b.text().includes("全部請假");
    });
    await historyBtn!.trigger("click");
    await nextTick();
    const history = wrapper.findComponent({ name: "LeaveHistoryList" });
    expect(history.exists()).toBe(true);
  });

  it("should show LeaveBalanceOverview when balance tab is clicked", async () => {
    const balanceBtn = wrapper.findAll("button").find((b) => {
      return b.text().includes("假期餘額");
    });
    await balanceBtn!.trigger("click");
    await nextTick();
    const overview = wrapper.findComponent({ name: "LeaveBalanceOverview" });
    expect(overview.exists()).toBe(true);
  });

  // ── Approve / Reject ──

  it("should call leavesService.approveRequest when approve is emitted", async () => {
    mockApproveRequest.mockResolvedValueOnce(undefined);
    const queue = wrapper.findComponent({ name: "LeaveApprovalQueue" });
    await queue.vm.$emit("approve", 201);
    await flushPromises();
    expect(mockApproveRequest).toHaveBeenCalledWith(201);
  });

  it("should call leavesService.rejectRequest when reject is emitted", async () => {
    mockRejectRequest.mockResolvedValueOnce(undefined);
    const queue = wrapper.findComponent({ name: "LeaveApprovalQueue" });
    await queue.vm.$emit("reject", 201, "Staffing issue");
    await flushPromises();
    expect(mockRejectRequest).toHaveBeenCalledWith(201, "Staffing issue");
  });

  it("should optimistically update request status to approved", async () => {
    mockApproveRequest.mockResolvedValueOnce(undefined);
    const queue = wrapper.findComponent({ name: "LeaveApprovalQueue" });
    await queue.vm.$emit("approve", 201);
    await flushPromises();
    // Badge should disappear (0 pending)
    const badge = wrapper.find(
      "span.min-w-\\[18px\\].h-\\[18px\\].text-xs.font-bold.rounded-full",
    );
    expect(badge.exists()).toBe(false);
  });

  it("should optimistically update request status to rejected", async () => {
    mockRejectRequest.mockResolvedValueOnce(undefined);
    const queue = wrapper.findComponent({ name: "LeaveApprovalQueue" });
    await queue.vm.$emit("reject", 201, "No coverage");
    await flushPromises();
    const badge = wrapper.find(
      "span.min-w-\\[18px\\].h-\\[18px\\].text-xs.font-bold.rounded-full",
    );
    expect(badge.exists()).toBe(false);
  });

  // ── Empty state ──

  it("should handle empty leave requests gracefully", async () => {
    mockGetRequests.mockResolvedValueOnce([]);
    mockGetLeaveTypes.mockResolvedValueOnce(mockLeaveTypes);
    mockGetRestaurantBalances.mockResolvedValueOnce(mockBalances);
    const w = mountComponent();
    await flushPromises();
    expect(w.exists()).toBe(true);
    const queue = w.findComponent({ name: "LeaveApprovalQueue" });
    expect(queue.props("requests")).toEqual([]);
  });

  // ── Loading state ──

  it("should show loading spinner while data is loading", async () => {
    mockGetLeaveTypes.mockReturnValue(new Promise(() => {}));
    mockGetRequests.mockReturnValue(new Promise(() => {}));
    mockGetRestaurantBalances.mockReturnValue(new Promise(() => {}));
    const w = mountComponent();
    await nextTick();
    expect(w.find(".animate-spin").exists()).toBe(true);
  });

  // ── Error state ──

  it("should show error message when data loading fails", async () => {
    mockGetLeaveTypes.mockRejectedValueOnce(new Error("Network failure"));
    mockGetRequests.mockRejectedValueOnce(new Error("Network failure"));
    mockGetRestaurantBalances.mockRejectedValueOnce(
      new Error("Network failure"),
    );
    const w = mountComponent();
    await flushPromises();
    const text = w.text();
    // Error message fallback is "載入請假資料失敗"
    expect(
      text.includes("Network failure") || text.includes("載入請假資料失敗"),
    ).toBe(true);
  });

  it("should show retry button on error", async () => {
    mockGetLeaveTypes.mockRejectedValueOnce(new Error("Fail"));
    mockGetRequests.mockRejectedValueOnce(new Error("Fail"));
    mockGetRestaurantBalances.mockRejectedValueOnce(new Error("Fail"));
    const w = mountComponent();
    await flushPromises();
    const retryBtn = w.findAll("button").find((b) => {
      return b.text().includes("重試");
    });
    expect(retryBtn).toBeTruthy();
  });

  // ── Leave request dialog ──

  it("should open LeaveRequestDialog when request button is clicked", async () => {
    const btn = wrapper.findAll("button").find((b) => {
      return b.text().includes("申請請假");
    });
    await btn!.trigger("click");
    await nextTick();
    const dialog = wrapper.findComponent({ name: "LeaveRequestDialog" });
    expect(dialog.exists()).toBe(true);
    expect(dialog.props("isOpen")).toBe(true);
  });

  // ── Filter: queue only shows pending ──

  it("should filter leave requests: queue shows only pending", () => {
    const queue = wrapper.findComponent({ name: "LeaveApprovalQueue" });
    const pendingRequests = queue.props("requests") as Array<
      Record<string, unknown>
    >;
    expect(pendingRequests.every((r: any) => r.status === "pending")).toBe(
      true,
    );
  });
});
