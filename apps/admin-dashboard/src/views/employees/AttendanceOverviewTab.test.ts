// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import AttendanceOverviewTab from "./AttendanceOverviewTab.vue";

vi.mock("@/i18n", () => ({
  t: (key: string) => key,
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    restaurantId: "restaurant-1",
    user: { id: "user-2" },
  }),
}));

vi.mock("@/composables/useDateFormatter", () => ({
  useDateFormatter: () => ({ formatTime: (d: Date) => d.toISOString() }),
}));

const users = ref([
  { id: "user-1", username: "chef", fullName: "Demo Chef", isActive: true },
  { id: "user-2", username: "owner", fullName: "Demo Owner", isActive: true },
  { id: "user-3", username: "gone", fullName: "Retired", isActive: false },
]);
const fetchClockedIn = vi.fn();

vi.mock("@/composables/useEmployeeList", () => ({
  useEmployeeList: () => ({
    users,
    usersWithStatus: ref([]),
    stats: ref({ currentlyWorking: 0, onLeaveToday: 0 }),
    clockedInList: ref([]),
    clockedInLoading: ref(false),
    leaveLoading: ref(false),
    fetchClockedIn,
    fetchTodayLeaves: vi.fn(),
  }),
}));

// Stubbed so the assertions are about the mount and its wiring, not about the
// panel's own fetching, which ClockInOutPanel.test.ts covers.
const ClockInOutPanelStub = {
  name: "ClockInOutPanel",
  props: ["restaurantId", "employeeId"],
  emits: ["clockIn", "clockOut"],
  template: `<div data-testid="clock-panel-stub" :data-employee="String(employeeId)"
    @click="$emit('clockIn', {})"></div>`,
};

function mountTab() {
  return mount(AttendanceOverviewTab, {
    global: {
      stubs: {
        ClockInOutPanel: ClockInOutPanelStub,
        Clock: true,
        CalendarOff: true,
      },
    },
  });
}

describe("AttendanceOverviewTab clock-in mount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gives the attendance tab a clock-in entry point", async () => {
    const wrapper = mountTab();
    await flushPromises();

    // ClockInOutPanel had zero imports repo-wide, so nothing in the product
    // could reach clock-in at all — every downstream attendance number was
    // structurally stuck at zero (#308).
    expect(wrapper.find('[data-testid="clock-panel-stub"]').exists()).toBe(
      true,
    );
  });

  it("defaults the target to the signed-in user, not the first row", async () => {
    const wrapper = mountTab();
    await flushPromises();

    // Demo Chef is first in the roster; the signed-in user is Demo Owner.
    expect(
      wrapper
        .find('[data-testid="clock-panel-stub"]')
        .attributes("data-employee"),
    ).toBe("user-2");
  });

  it("lists only active staff as clock targets", async () => {
    const wrapper = mountTab();
    await flushPromises();

    const options = wrapper
      .find('[data-testid="clock-target-select"]')
      .findAll("option")
      .map((o) => o.text());

    expect(options).toEqual(["Demo Chef", "Demo Owner"]);
  });

  it("retargets the panel when a manager picks another employee", async () => {
    const wrapper = mountTab();
    await flushPromises();

    const select = wrapper.find('[data-testid="clock-target-select"]');
    await select.setValue("user-1");
    await flushPromises();

    expect(
      wrapper
        .find('[data-testid="clock-panel-stub"]')
        .attributes("data-employee"),
    ).toBe("user-1");
  });

  it("refetches the clocked-in list after a clock action", async () => {
    const wrapper = mountTab();
    await flushPromises();
    fetchClockedIn.mockClear();

    await wrapper.find('[data-testid="clock-panel-stub"]').trigger("click");
    await flushPromises();

    // Without this the stats directly above the panel keep showing the
    // pre-clock-in numbers until the tab is reloaded.
    expect(fetchClockedIn).toHaveBeenCalledOnce();
  });
});
