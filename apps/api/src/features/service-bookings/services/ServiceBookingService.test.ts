import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SERVICE_BOOKING_PAYMENT_METHOD,
  SERVICE_BOOKING_STATUS,
} from "@makanmakan/database";
import { ServiceBookingService } from "./ServiceBookingService";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("ServiceBookingService.blockSlot", () => {
  it("does not overwrite existing slot capacity when a stale read races with slot creation", async () => {
    let upsertRan = false;
    const storedSlot = {
      id: "slot-1",
      restaurantId: "rest-1",
      serviceItemId: 10,
      date: "2026-06-10",
      timeSlot: "10:00",
      maxCapacity: 2,
      currentBookings: 0,
      isAvailable: 1,
      blockReason: null as string | null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const fakeD1 = {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn((...params: unknown[]) => ({
          run: vi.fn(async () => {
            upsertRan = true;
            storedSlot.isAvailable = 0;
            storedSlot.blockReason = String(params.at(-1));
            if (sql.includes("max_capacity = excluded.max_capacity")) {
              storedSlot.maxCapacity = Number(params[5]);
            }
            return { meta: { changes: 1 } };
          }),
        })),
      })),
    };
    const fakeDb = {
      select: vi.fn((selection?: unknown) => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            get: vi.fn(async () => {
              if (selection) {
                return { id: 10, restaurantId: "rest-1" };
              }
              return upsertRan ? storedSlot : undefined;
            }),
          })),
        })),
      })),
    };
    const service = new ServiceBookingService({ DB: fakeD1 } as never);
    Object.defineProperty(service, "db", { value: fakeDb });
    Object.defineProperty(service, "d1", { value: fakeD1 });

    const slot = await service.blockSlot({
      restaurantId: "rest-1",
      serviceItemId: 10,
      date: "2026-06-10",
      timeSlot: "10:00",
      blockReason: "Private event",
    });

    expect(slot).toMatchObject({
      maxCapacity: 2,
      isAvailable: 0,
      blockReason: "Private event",
    });
  });
});

describe("ServiceBookingService orchestration helpers", () => {
  function createService() {
    return new ServiceBookingService({ DB: {} as D1Database } as never);
  }

  it("creates recurring bookings with weekly dates and recurrence metadata", async () => {
    const service = createService();
    const createBooking = vi
      .spyOn(service, "createBooking")
      .mockImplementation(async (input) => ({ id: input.bookingDate }) as any);

    await expect(
      service.createRecurringBookings({
        restaurantId: "rest-1",
        serviceItemId: 10,
        customerName: "Ada",
        customerPhone: "+886900000000",
        startDate: "2026-06-10",
        bookingTime: "10:00",
        count: 3,
        intervalWeeks: 2,
      }),
    ).resolves.toEqual([
      { id: "2026-06-10" },
      { id: "2026-06-24" },
      { id: "2026-07-08" },
    ]);
    expect(createBooking).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        bookingDate: "2026-06-10",
        recurrenceGroupId: expect.any(String),
        recurrenceIndex: 1,
        recurrenceCount: 3,
      }),
    );
    expect(createBooking).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        bookingDate: "2026-07-08",
        recurrenceGroupId: expect.any(String),
        recurrenceIndex: 3,
        recurrenceCount: 3,
      }),
    );
  });

  it("rejects unsupported recurring voucher and range inputs", async () => {
    const service = createService();
    const base = {
      restaurantId: "rest-1",
      serviceItemId: 10,
      customerName: "Ada",
      customerPhone: "+886900000000",
      startDate: "2026-06-10",
      bookingTime: "10:00",
      count: 1,
    };

    await expect(
      service.createRecurringBookings({ ...base, voucherCode: "SAVE" }),
    ).rejects.toThrow("Vouchers can only be applied to single bookings");
    await expect(
      service.createRecurringBookings({ ...base, count: 13 }),
    ).rejects.toThrow("count must be between 1 and 12");
    await expect(
      service.createRecurringBookings({ ...base, intervalWeeks: 0 }),
    ).rejects.toThrow("intervalWeeks must be between 1 and 52");
  });

  it("batch creates slots for each date/time and enforces the batch limit", async () => {
    const service = createService();
    const createSlot = vi
      .spyOn(service, "createSlot")
      .mockImplementation(async (input) => input as any);

    await expect(
      service.batchCreateSlots({
        restaurantId: "rest-1",
        serviceItemId: 10,
        startDate: "2026-06-10",
        endDate: "2026-06-11",
        timeSlots: ["10:00", "11:00"],
        maxCapacity: 2,
        isAvailable: false,
      }),
    ).resolves.toEqual({
      created: 4,
      slots: [
        expect.objectContaining({ date: "2026-06-10", timeSlot: "10:00" }),
        expect.objectContaining({ date: "2026-06-10", timeSlot: "11:00" }),
        expect.objectContaining({ date: "2026-06-11", timeSlot: "10:00" }),
        expect.objectContaining({ date: "2026-06-11", timeSlot: "11:00" }),
      ],
    });
    expect(createSlot).toHaveBeenCalledTimes(4);

    await expect(
      service.batchCreateSlots({
        restaurantId: "rest-1",
        serviceItemId: 10,
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        timeSlots: ["09:00", "10:00", "11:00"],
        maxCapacity: 1,
      }),
    ).rejects.toThrow("Cannot create more than 1000 slots at once");
  });

  it("confirms cash bookings through the shared confirmation path", async () => {
    const service = createService();
    const booking = {
      id: "booking-1",
      status: SERVICE_BOOKING_STATUS.PENDING,
      amountDueCents: 1200,
    };
    vi.spyOn(service as any, "loadPayableBooking").mockResolvedValue(booking);
    const markConfirmed = vi
      .spyOn(service as any, "markConfirmed")
      .mockResolvedValue({
        ...booking,
        status: SERVICE_BOOKING_STATUS.CONFIRMED,
      });

    await expect(service.confirmCash("booking-1")).resolves.toMatchObject({
      id: "booking-1",
      status: SERVICE_BOOKING_STATUS.CONFIRMED,
    });
    expect(markConfirmed).toHaveBeenCalledWith(booking, {
      method: SERVICE_BOOKING_PAYMENT_METHOD.CASH,
      amountPaidCents: 0,
      paymentRef: null,
    });
  });

  it("blocks cancellation for terminal booking statuses", async () => {
    const service = createService();
    vi.spyOn(service as any, "requireBooking").mockResolvedValue({
      id: "booking-1",
      status: SERVICE_BOOKING_STATUS.COMPLETED,
    });

    await expect(service.cancelBooking("booking-1")).rejects.toThrow(
      "Booking cannot be cancelled",
    );
  });

  it("renders calendar invites with escaped text and Taipei booking time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const service = createService();
    vi.spyOn(service as any, "requireBooking").mockResolvedValue({
      id: "booking-1",
      bookingDate: "2026-06-10",
      bookingTime: "10:30",
      durationMinutesSnapshot: 90,
      serviceNameSnapshot: "Massage, Spa; Deluxe",
      confirmationCode: "ABC123",
      specialRequests: "Quiet room\nNo perfume",
      calendarUid: "uid-1@example.test",
      status: SERVICE_BOOKING_STATUS.CONFIRMED,
    });

    await expect(
      service.generateCalendarInvite("booking-1"),
    ).resolves.toContain("DTSTART:20260610T023000Z\r\nDTEND:20260610T040000Z");
    const invite = await service.generateCalendarInvite("booking-1");
    expect(invite).toContain("SUMMARY:Massage\\, Spa\\; Deluxe");
    expect(invite).toContain("Confirmation: ABC123");
    expect(invite).toContain("Requests: Quiet room\\nNo perfume");
    expect(invite).toContain("STATUS:CONFIRMED");
  });
});
