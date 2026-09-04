// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LeavesTab from "./LeavesTab.vue";
import { leavesService } from "@/services/leavesService";

vi.mock("@/i18n", () => ({
  t: (key: string) => key,
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ restaurantId: "restaurant-1" }),
}));

vi.mock("@/composables/useEmployeeList", () => ({
  useEmployeeList: () => ({
    users: { value: [] },
    fetchUsers: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@/services/api", () => ({
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/services/leavesService", () => ({
  leavesService: {
    getLeaveTypes: vi.fn(),
    getRequests: vi.fn(),
    getRestaurantBalances: vi.fn(),
    createLeaveType: vi.fn(),
    deleteLeaveType: vi.fn(),
  },
}));

const leaveType = (overrides = {}) => ({
  id: 1,
  restaurantId: "restaurant-1",
  code: "ANNUAL",
  name: "特休",
  accrualType: "yearly" as const,
  accrualAmount: 14,
  requiresApproval: true,
  minNoticeDays: 0,
  requiresDocumentation: false,
  allowHalfDay: true,
  isActive: true,
  sortOrder: 0,
  ...overrides,
});

async function mountTab(types: ReturnType<typeof leaveType>[]) {
  vi.mocked(leavesService.getLeaveTypes).mockResolvedValue(types);
  vi.mocked(leavesService.getRequests).mockResolvedValue([]);
  vi.mocked(leavesService.getRestaurantBalances).mockResolvedValue([]);
  const wrapper = mount(LeavesTab);
  await flushPromises();
  return wrapper;
}

describe("LeavesTab leave types", () => {
  beforeEach(() => vi.clearAllMocks());

  // Every new tenant starts with zero leave types and nothing seeds them, so
  // the request dialog's type selector was empty, its submit button could
  // never enable, and the whole approval flow had no first step (#307).
  it("disables the request button while no leave type exists", async () => {
    const wrapper = await mountTab([]);

    expect(
      wrapper.get('[data-testid="leaves-apply"]').attributes("disabled"),
    ).toBeDefined();
    expect(
      wrapper.get('[data-testid="leaves-apply"]').attributes("title"),
    ).toBe("leaves.manage.noTypesHint");
  });

  it("enables it once one exists", async () => {
    const wrapper = await mountTab([leaveType()]);

    expect(
      wrapper.get('[data-testid="leaves-apply"]').attributes("disabled"),
    ).toBeUndefined();
  });

  it("creates a leave type through the route that already existed", async () => {
    vi.mocked(leavesService.createLeaveType).mockResolvedValue(leaveType());
    const wrapper = await mountTab([]);

    await wrapper.get('[data-testid="leaves-tab-types"]').trigger("click");
    await wrapper.get('[data-testid="leave-type-code"]').setValue("annual");
    await wrapper.get('[data-testid="leave-type-name"]').setValue("特休");
    await wrapper.get('[data-testid="leave-type-amount"]').setValue(14);
    await wrapper.get('[data-testid="leave-type-save"]').trigger("submit");
    await flushPromises();

    expect(leavesService.createLeaveType).toHaveBeenCalledWith(
      "restaurant-1",
      expect.objectContaining({
        // Normalised on the way out: the column accepts uppercase letters and
        // underscores only, and an owner typing "annual leave" should get a
        // leave type rather than a message quoting a regex.
        code: "ANNUAL",
        name: "特休",
        accrualType: "yearly",
        accrualAmount: 14,
      }),
    );
    // The list has to be re-read, or the new type is invisible until reload
    // and the request button stays disabled.
    expect(leavesService.getLeaveTypes).toHaveBeenCalledTimes(2);
  });

  it("turns a multi-word name into a legal code", async () => {
    vi.mocked(leavesService.createLeaveType).mockResolvedValue(leaveType());
    const wrapper = await mountTab([]);

    await wrapper.get('[data-testid="leaves-tab-types"]').trigger("click");
    await wrapper
      .get('[data-testid="leave-type-code"]')
      .setValue("  sick leave!! ");
    await wrapper.get('[data-testid="leave-type-name"]').setValue("病假");
    await wrapper.get('[data-testid="leave-type-save"]').trigger("submit");
    await flushPromises();

    expect(leavesService.createLeaveType).toHaveBeenCalledWith(
      "restaurant-1",
      expect.objectContaining({ code: "SICK_LEAVE" }),
    );
  });

  it("shows why the list is empty instead of an empty panel", async () => {
    const wrapper = await mountTab([]);
    await wrapper.get('[data-testid="leaves-tab-types"]').trigger("click");

    expect(wrapper.get('[data-testid="leaves-no-types"]').text()).toContain(
      "leaves.manage.noTypesHint",
    );
  });
});
