// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ServiceBookingSlotsManager from "./ServiceBookingSlotsManager.vue";
import { restaurantServiceItemsService } from "@/services/restaurantServiceItemsService";
import { serviceBookingsService } from "@/services/serviceBookingsService";

vi.mock("@/services/restaurantServiceItemsService", () => ({
  restaurantServiceItemsService: {
    list: vi.fn(),
  },
}));

vi.mock("@/services/serviceBookingsService", () => ({
  serviceBookingsService: {
    listSlots: vi.fn(),
    createSlot: vi.fn(),
    batchCreateSlots: vi.fn(),
    blockSlot: vi.fn(),
  },
}));

// BaseEntity declares createdAt/updatedAt as Unix milliseconds, not ISO strings.
const FIXTURE_TIMESTAMP_MS = 1_780_000_000_000;

describe("ServiceBookingSlotsManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(restaurantServiceItemsService.list).mockResolvedValue([
      {
        id: 10,
        restaurantId: "restaurant-1",
        name: "彩繪體驗",
        serviceType: "activity",
        requiresBooking: true,
        sortOrder: 0,
        isActive: true,
        isPublic: true,
        createdAt: FIXTURE_TIMESTAMP_MS,
        updatedAt: FIXTURE_TIMESTAMP_MS,
      },
    ]);
    vi.mocked(serviceBookingsService.listSlots).mockResolvedValue([
      {
        id: "slot-1",
        restaurantId: "restaurant-1",
        serviceItemId: 10,
        date: "2026-06-10",
        timeSlot: "10:00",
        maxCapacity: 2,
        currentBookings: 1,
        isAvailable: 1,
      },
    ]);
  });

  it("loads bookable services and slots", async () => {
    const wrapper = mount(ServiceBookingSlotsManager, {
      props: { restaurantId: "restaurant-1" },
    });

    await flushPromises();

    expect(restaurantServiceItemsService.list).toHaveBeenCalledWith(
      "restaurant-1",
    );
    expect(serviceBookingsService.listSlots).toHaveBeenCalledWith({
      restaurantId: "restaurant-1",
      date: expect.any(String),
    });
    expect(wrapper.text()).toContain("彩繪體驗");
    expect(wrapper.text()).toContain("2026-06-10");
    expect(wrapper.text()).toContain("10:00");
  });

  it("creates a single slot", async () => {
    vi.mocked(serviceBookingsService.createSlot).mockResolvedValue({
      id: "slot-2",
      restaurantId: "restaurant-1",
      serviceItemId: 10,
      date: "2026-06-11",
      timeSlot: "11:00",
      maxCapacity: 3,
      currentBookings: 0,
      isAvailable: 1,
    });

    const wrapper = mount(ServiceBookingSlotsManager, {
      props: { restaurantId: "restaurant-1" },
    });

    await flushPromises();
    await wrapper.get('[data-testid="slot-date-input"]').setValue("2026-06-11");
    await wrapper.get('[data-testid="slot-time-input"]').setValue("11:00");
    await wrapper.get('[data-testid="slot-capacity-input"]').setValue(3);
    await wrapper.get("form").trigger("submit.prevent");

    expect(serviceBookingsService.createSlot).toHaveBeenCalledWith({
      restaurantId: "restaurant-1",
      serviceItemId: 10,
      date: "2026-06-11",
      timeSlot: "11:00",
      maxCapacity: 3,
      isAvailable: true,
    });
  });

  it("batch creates slots and blocks an existing slot", async () => {
    vi.mocked(serviceBookingsService.batchCreateSlots).mockResolvedValue({
      created: 2,
      slots: [],
    });
    vi.mocked(serviceBookingsService.blockSlot).mockResolvedValue({
      id: "slot-1",
      restaurantId: "restaurant-1",
      serviceItemId: 10,
      date: "2026-06-10",
      timeSlot: "10:00",
      maxCapacity: 2,
      currentBookings: 1,
      isAvailable: 0,
    });

    const wrapper = mount(ServiceBookingSlotsManager, {
      props: { restaurantId: "restaurant-1" },
    });

    await flushPromises();
    await wrapper
      .get('[data-testid="slot-batch-start"]')
      .setValue("2026-06-10");
    await wrapper.get('[data-testid="slot-batch-end"]').setValue("2026-06-11");
    await wrapper
      .get('[data-testid="slot-batch-times"]')
      .setValue("10:00, 11:00");
    await wrapper.get('[data-testid="slot-batch-submit"]').trigger("click");
    await flushPromises();

    expect(serviceBookingsService.batchCreateSlots).toHaveBeenCalledWith({
      restaurantId: "restaurant-1",
      serviceItemId: 10,
      startDate: "2026-06-10",
      endDate: "2026-06-11",
      timeSlots: ["10:00", "11:00"],
      maxCapacity: 1,
      isAvailable: true,
    });

    await wrapper.get('[data-testid="slot-block-slot-1"]').trigger("click");
    await flushPromises();

    expect(serviceBookingsService.blockSlot).toHaveBeenCalledWith({
      restaurantId: "restaurant-1",
      serviceItemId: 10,
      date: "2026-06-10",
      timeSlot: "10:00",
      blockReason: "Admin blocked",
    });
  });
});
