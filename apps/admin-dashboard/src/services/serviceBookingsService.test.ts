import { describe, expect, it, vi, beforeEach } from "vitest";
import { api } from "@/services/api";
import { serviceBookingsService } from "./serviceBookingsService";

vi.mock("@/services/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
  unwrapApiPayload: vi.fn((payload) => payload.data ?? payload),
}));

describe("serviceBookingsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists and creates service booking slots", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { data: { slots: [{ id: "slot-1" }] } },
    } as never);
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { data: { slot: { id: "slot-2" } } },
    } as never);

    await expect(
      serviceBookingsService.listSlots({
        restaurantId: "restaurant-1",
        serviceItemId: 10,
        date: "2026-06-10",
      }),
    ).resolves.toEqual([{ id: "slot-1" }]);
    expect(api.get).toHaveBeenCalledWith("/service-bookings/slots", {
      restaurantId: "restaurant-1",
      serviceItemId: 10,
      date: "2026-06-10",
    });

    await expect(
      serviceBookingsService.createSlot({
        restaurantId: "restaurant-1",
        serviceItemId: 10,
        date: "2026-06-10",
        timeSlot: "10:00",
        maxCapacity: 2,
      }),
    ).resolves.toEqual({ id: "slot-2" });
    expect(api.post).toHaveBeenCalledWith("/service-bookings/slots", {
      restaurantId: "restaurant-1",
      serviceItemId: 10,
      date: "2026-06-10",
      timeSlot: "10:00",
      maxCapacity: 2,
    });
  });

  it("batch creates and blocks slots", async () => {
    vi.mocked(api.post)
      .mockResolvedValueOnce({
        data: { data: { created: 2, slots: [] } },
      } as never)
      .mockResolvedValueOnce({
        data: { data: { slot: { id: "slot-1", isAvailable: 0 } } },
      } as never);

    await expect(
      serviceBookingsService.batchCreateSlots({
        restaurantId: "restaurant-1",
        serviceItemId: 10,
        startDate: "2026-06-10",
        endDate: "2026-06-11",
        timeSlots: ["10:00"],
        maxCapacity: 2,
      }),
    ).resolves.toEqual({ created: 2, slots: [] });
    expect(api.post).toHaveBeenCalledWith("/service-bookings/slots/batch", {
      restaurantId: "restaurant-1",
      serviceItemId: 10,
      startDate: "2026-06-10",
      endDate: "2026-06-11",
      timeSlots: ["10:00"],
      maxCapacity: 2,
    });

    await expect(
      serviceBookingsService.blockSlot({
        restaurantId: "restaurant-1",
        serviceItemId: 10,
        date: "2026-06-10",
        timeSlot: "10:00",
        blockReason: "Private event",
      }),
    ).resolves.toEqual({ id: "slot-1", isAvailable: 0 });
    expect(api.post).toHaveBeenCalledWith("/service-bookings/slots/block", {
      restaurantId: "restaurant-1",
      serviceItemId: 10,
      date: "2026-06-10",
      timeSlot: "10:00",
      blockReason: "Private event",
    });
  });
});
