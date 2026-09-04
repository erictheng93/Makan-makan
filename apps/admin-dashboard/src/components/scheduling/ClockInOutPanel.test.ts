// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ClockInOutPanel from "./ClockInOutPanel.vue";
import { schedulingService } from "@/services/schedulingService";

vi.mock("@/i18n", () => ({
  t: (key: string) => key,
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/services/schedulingService", () => ({
  schedulingService: {
    getSchedules: vi.fn(),
    clockIn: vi.fn(),
    clockOut: vi.fn(),
  },
}));

/**
 * Shaped like a real row from GET /scheduling/:restaurantId/schedules, which
 * returns `result.items` verbatim — so the only clock fields present are
 * clock_in_time_ms / clock_out_time_ms. Adding an actualStartTime here would
 * make the test pass against code that reads a field the API never sends.
 */
const schedule = (overrides = {}) => ({
  id: 7,
  restaurantId: "restaurant-1",
  employeeId: "user-1",
  workDate: "2026-09-04",
  startTime: "09:00",
  endTime: "18:00",
  breakDurationMinutes: 60,
  scheduledHours: 8,
  clockInTime: null,
  clockOutTime: null,
  actualHours: null,
  overtimeHours: null,
  status: "scheduled",
  notes: null,
  managerNotes: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
  createdBy: "user-1",
  updatedBy: null,
  ...overrides,
});

function mountPanel() {
  return mount(ClockInOutPanel, {
    props: { restaurantId: "restaurant-1" },
  });
}

describe("ClockInOutPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(schedulingService.getSchedules).mockResolvedValue({
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    } as never);
  });

  it("offers clock-in when the shift has not started", async () => {
    vi.mocked(schedulingService.getSchedules).mockResolvedValueOnce({
      data: [schedule()],
      pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
    } as never);

    const wrapper = mountPanel();
    await flushPromises();

    expect(wrapper.find('[data-testid="clock-in-button"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="clock-out-button"]').exists()).toBe(
      false,
    );
  });

  it("advances to clock-out once clock_in_time_ms is set", async () => {
    vi.mocked(schedulingService.getSchedules).mockResolvedValueOnce({
      data: [schedule({ clockInTime: "2026-09-04T01:03:00.000Z" })],
      pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
    } as never);

    const wrapper = mountPanel();
    await flushPromises();

    // The panel used to read actualStartTime, which the API never sends, so it
    // kept offering clock-in to someone already clocked in — and the service
    // answered "Already clocked in" (#308).
    expect(wrapper.find('[data-testid="clock-in-button"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="clock-out-button"]').exists()).toBe(
      true,
    );
  });

  it("reports the shift complete once both stamps are set", async () => {
    vi.mocked(schedulingService.getSchedules).mockResolvedValueOnce({
      data: [
        schedule({
          clockInTime: "2026-09-04T01:03:00.000Z",
          clockOutTime: "2026-09-04T10:07:00.000Z",
          actualHours: 8,
        }),
      ],
      pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
    } as never);

    const wrapper = mountPanel();
    await flushPromises();

    expect(wrapper.find('[data-testid="shift-completed"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="clock-in-button"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="clock-out-button"]').exists()).toBe(
      false,
    );
  });

  it("renders the stamp as a wall-clock time, not the raw ISO string", async () => {
    // 2026-09-04T01:03:00Z is 09:03 in Asia/Taipei; the test pins TZ so the
    // expectation is about formatting, not about the machine's zone.
    vi.mocked(schedulingService.getSchedules).mockResolvedValueOnce({
      data: [schedule({ clockInTime: "2026-09-04T01:03:00.000Z" })],
      pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
    } as never);

    const wrapper = mountPanel();
    await flushPromises();

    const rendered = wrapper.find('[data-testid="clock-in-time"]').text();
    expect(rendered).toMatch(/^\d{2}:\d{2}$/);
    expect(rendered).not.toContain("T");
  });

  it("sends the selected employee id when clocking in on their behalf", async () => {
    vi.mocked(schedulingService.getSchedules).mockResolvedValueOnce({
      data: [schedule({ employeeId: "user-9" })],
      pagination: { page: 1, limit: 1, total: 1, totalPages: 1 },
    } as never);
    vi.mocked(schedulingService.clockIn).mockResolvedValue(
      schedule({ clockInTime: "2026-09-04T01:03:00.000Z" }) as never,
    );

    const wrapper = mount(ClockInOutPanel, {
      props: { restaurantId: "restaurant-1", employeeId: "user-9" as never },
    });
    await flushPromises();

    await wrapper.find('[data-testid="clock-in-button"]').trigger("click");
    await wrapper.find(".btn-confirm").trigger("click");
    await flushPromises();

    expect(schedulingService.clockIn).toHaveBeenCalledWith(
      7,
      expect.objectContaining({ scheduleId: 7, employeeId: "user-9" }),
    );
  });
});
