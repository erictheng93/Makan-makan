import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SERVICE_BOOKING_PAYMENT_METHOD,
  SERVICE_BOOKING_PAYMENT_REQUIREMENT,
  SERVICE_BOOKING_PAYMENT_STATUS,
  SERVICE_BOOKING_STATUS,
  SERVICE_BOOKING_WAITLIST_STATUS,
} from "@makanmakan/database";
import { CreditService } from "../../credits/services/CreditService";
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
  function createD1Mock(results: Array<{ changes?: number }> = []) {
    const calls: Array<{ sql: string; params: unknown[] }> = [];
    const d1 = {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn((...params: unknown[]) => ({
          run: vi.fn(async () => {
            calls.push({ sql, params });
            const result = results.shift() ?? { changes: 1 };
            return { meta: { changes: result.changes ?? 1 } };
          }),
        })),
      })),
    };
    return { d1, calls };
  }

  function createDbMock(input: {
    selectGet?: unknown[];
    selectAll?: unknown[][];
    insertReturning?: unknown[];
    updateReturning?: unknown[];
  }) {
    const selectGet = [...(input.selectGet ?? [])];
    const selectAll = [...(input.selectAll ?? [])];
    const insertReturning = [...(input.insertReturning ?? [])];
    const updateReturning = [...(input.updateReturning ?? [])];
    const insertValues: unknown[] = [];
    const updateSets: unknown[] = [];

    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            get: vi.fn(async () => selectGet.shift()),
            all: vi.fn(async () => selectAll.shift() ?? []),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn((values: unknown) => {
          insertValues.push(values);
          return {
            returning: vi.fn(async () => [insertReturning.shift() ?? values]),
          };
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn((patch: unknown) => {
          updateSets.push(patch);
          return {
            where: vi.fn(() => ({
              returning: vi.fn(async () => [updateReturning.shift() ?? patch]),
            })),
          };
        }),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    };

    return { db, insertValues, updateSets };
  }

  function createService(options?: { d1?: D1Database; db?: unknown }) {
    const service = new ServiceBookingService({
      DB: options?.d1 ?? ({} as D1Database),
    } as never);
    if (options?.db) {
      Object.defineProperty(service, "db", { value: options.db });
    }
    if (options?.d1) {
      Object.defineProperty(service, "d1", { value: options.d1 });
    }
    return service;
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

  it("maps slot availability from capped booking slots", async () => {
    const { db } = createDbMock({
      selectAll: [
        [
          {
            timeSlot: "10:00",
            maxCapacity: 3,
            currentBookings: 1,
            isAvailable: 1,
          },
          {
            timeSlot: "11:00",
            maxCapacity: 2,
            currentBookings: 2,
            isAvailable: 1,
          },
          {
            timeSlot: "12:00",
            maxCapacity: 2,
            currentBookings: 0,
            isAvailable: 0,
          },
        ],
      ],
    });
    const service = createService({ db });

    await expect(
      service.getAvailability({
        serviceItemId: 10,
        date: "2026-06-10",
      }),
    ).resolves.toEqual([
      { timeSlot: "10:00", remaining: 2, isAvailable: true },
      { timeSlot: "11:00", remaining: 0, isAvailable: false },
      { timeSlot: "12:00", remaining: 2, isAvailable: false },
    ]);
  });

  it("creates bookings with deposit terms and reminder scheduling", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const { d1, calls } = createD1Mock([{ changes: 0 }]);
    const insertedRow = { id: "booking-1" };
    const { db, insertValues } = createDbMock({
      selectGet: [
        {
          id: 10,
          restaurantId: "rest-1",
          name: "Spa Session",
          durationMinutes: 90,
          priceCents: 5000,
          availableHours: { start: "09:00", end: "18:00", days: [3] },
          requiresBooking: true,
          isActive: true,
          deletedAt: null,
        },
        undefined,
      ],
      insertReturning: [insertedRow],
    });
    const service = createService({ d1: d1 as never, db });

    await expect(
      service.createBooking({
        restaurantId: "rest-1",
        serviceItemId: 10,
        customerName: "Ada",
        customerPhone: "+886 900 000 000",
        customerEmail: "ada@example.test",
        bookingDate: "2026-06-10",
        bookingTime: "10:30",
        partySize: 2,
        paymentRequirement: SERVICE_BOOKING_PAYMENT_REQUIREMENT.DEPOSIT,
        depositAmountCents: 1200,
        reminderOptIn: true,
        reminderMinutesBefore: 30,
        specialRequests: "Window seat",
      }),
    ).resolves.toBe(insertedRow);

    expect(calls[0]).toMatchObject({
      params: [10, "2026-06-10", "10:30"],
    });
    expect(insertValues[0]).toMatchObject({
      restaurantId: "rest-1",
      serviceItemId: 10,
      serviceNameSnapshot: "Spa Session",
      priceCentsSnapshot: 5000,
      customerName: "Ada",
      customerEmail: "ada@example.test",
      bookingDate: "2026-06-10",
      bookingTime: "10:30",
      partySize: 2,
      status: SERVICE_BOOKING_STATUS.PENDING,
      voucherDiscountCents: 0,
      paymentRequirement: SERVICE_BOOKING_PAYMENT_REQUIREMENT.DEPOSIT,
      depositRequiredCents: 1200,
      balanceDueCents: 3800,
      amountDueCents: 1200,
      paymentStatus: SERVICE_BOOKING_PAYMENT_STATUS.UNPAID,
      paymentMethod: SERVICE_BOOKING_PAYMENT_METHOD.NONE,
      reminderOptIn: 1,
      reminderMinutesBefore: 30,
      specialRequests: "Window seat",
    });
    expect(
      (insertValues[0] as { reminderScheduledAt: Date }).reminderScheduledAt,
    ).toEqual(new Date("2026-06-10T02:00:00.000Z"));
  });

  it("rejects booking times outside configured service hours", async () => {
    const { db } = createDbMock({
      selectGet: [
        {
          id: 10,
          restaurantId: "rest-1",
          name: "Spa Session",
          durationMinutes: 60,
          priceCents: 1000,
          availableHours: { start: "09:00", end: "18:00", days: [3] },
          requiresBooking: true,
          isActive: true,
          deletedAt: null,
        },
      ],
    });
    const service = createService({ db });

    await expect(
      service.createBooking({
        restaurantId: "rest-1",
        serviceItemId: 10,
        customerName: "Ada",
        customerPhone: "+886900000000",
        bookingDate: "2026-06-11",
        bookingTime: "10:00",
      }),
    ).rejects.toThrow("The service is not available on this day");
  });

  it("rejects invalid services and unsupported booking terms", async () => {
    const book = {
      restaurantId: "rest-1",
      serviceItemId: 10,
      customerName: "Ada",
      customerPhone: "+886900000000",
      bookingDate: "2026-06-10",
      bookingTime: "10:00",
    };
    const baseService = {
      id: 10,
      restaurantId: "rest-1",
      name: "Spa Session",
      durationMinutes: 60,
      priceCents: 1000,
      availableHours: { start: "09:00", end: "18:00", days: [3] },
      requiresBooking: true,
      isActive: true,
      deletedAt: null,
    };

    await expect(
      createService({
        db: createDbMock({ selectGet: [undefined] }).db,
      }).createBooking(book),
    ).rejects.toThrow("Service not found");
    await expect(
      createService({
        db: createDbMock({
          selectGet: [{ ...baseService, restaurantId: "rest-2" }],
        }).db,
      }).createBooking(book),
    ).rejects.toThrow("Service does not belong to this restaurant");
    await expect(
      createService({
        db: createDbMock({
          selectGet: [{ ...baseService, requiresBooking: false }],
        }).db,
      }).createBooking(book),
    ).rejects.toThrow("This service does not accept bookings");
    await expect(
      createService({
        db: createDbMock({ selectGet: [baseService] }).db,
      }).createBooking({ ...book, bookingTime: "08:59" }),
    ).rejects.toThrow("The selected time is before the service opens");
    await expect(
      createService({
        db: createDbMock({ selectGet: [baseService] }).db,
      }).createBooking({ ...book, bookingTime: "18:01" }),
    ).rejects.toThrow("The selected time is after the service closes");
    await expect(
      createService({
        d1: createD1Mock([{ changes: 0 }]).d1 as never,
        db: createDbMock({ selectGet: [baseService, undefined] }).db,
      }).createBooking({
        ...book,
        paymentRequirement: SERVICE_BOOKING_PAYMENT_REQUIREMENT.DEPOSIT,
      }),
    ).rejects.toThrow("depositAmountCents is required");
    await expect(
      createService({
        d1: createD1Mock([{ changes: 0 }]).d1 as never,
        db: createDbMock({ selectGet: [baseService, undefined] }).db,
      }).createBooking({
        ...book,
        paymentRequirement: SERVICE_BOOKING_PAYMENT_REQUIREMENT.DEPOSIT,
        depositAmountCents: 2000,
      }),
    ).rejects.toThrow("depositAmountCents cannot exceed");
    await expect(
      createService({
        d1: createD1Mock([{ changes: 0 }]).d1 as never,
        db: createDbMock({ selectGet: [baseService, undefined] }).db,
      }).createBooking({
        ...book,
        reminderOptIn: true,
        reminderMinutesBefore: 4,
      }),
    ).rejects.toThrow("reminderMinutesBefore must be between");
  });

  it("creates bookings without immediate payment when payment is deferred", async () => {
    const { d1 } = createD1Mock([{ changes: 0 }]);
    const { db, insertValues } = createDbMock({
      selectGet: [
        {
          id: 10,
          restaurantId: "rest-1",
          name: "Spa Session",
          durationMinutes: 60,
          priceCents: 5000,
          availableHours: null,
          requiresBooking: true,
          isActive: true,
          deletedAt: null,
        },
        undefined,
      ],
      insertReturning: [{ id: "booking-1" }],
    });
    const service = createService({ d1: d1 as never, db });

    await service.createBooking({
      restaurantId: "rest-1",
      serviceItemId: 10,
      customerName: "Ada",
      customerPhone: "+886900000000",
      bookingDate: "2026-06-10",
      bookingTime: "10:00",
      paymentRequirement: SERVICE_BOOKING_PAYMENT_REQUIREMENT.NONE,
    });

    expect(insertValues[0]).toMatchObject({
      paymentRequirement: SERVICE_BOOKING_PAYMENT_REQUIREMENT.NONE,
      depositRequiredCents: 0,
      balanceDueCents: 5000,
      amountDueCents: 0,
      reminderOptIn: 0,
      reminderMinutesBefore: null,
      reminderScheduledAt: null,
    });
  });

  it("accepts employees only when availability covers the booking and no active booking overlaps", async () => {
    const { d1 } = createD1Mock([{ changes: 0 }]);
    const { db, insertValues } = createDbMock({
      selectGet: [
        {
          id: 10,
          restaurantId: "rest-1",
          name: "Spa Session",
          durationMinutes: 60,
          priceCents: 1000,
          availableHours: null,
          requiresBooking: true,
          isActive: true,
          deletedAt: null,
        },
        { id: 7, restaurantId: "rest-1", isActive: true, role: 2 },
        undefined,
      ],
      selectAll: [
        [
          {
            availabilityType: "recurring",
            dayOfWeek: 3,
            startTime: "09:00",
            endTime: "17:00",
            preferenceType: "available",
            priority: 1,
          },
        ],
        [],
      ],
      insertReturning: [{ id: "booking-1" }],
    });
    const service = createService({ d1: d1 as never, db });

    await service.createBooking({
      restaurantId: "rest-1",
      serviceItemId: 10,
      customerName: "Ada",
      customerPhone: "+886900000000",
      bookingDate: "2026-06-10",
      bookingTime: "10:00",
      employeeId: 7,
    });

    expect(insertValues[0]).toMatchObject({ employeeId: 7 });
  });

  it("rejects employee assignments without availability or with overlapping bookings", async () => {
    const serviceRow = {
      id: 10,
      restaurantId: "rest-1",
      name: "Spa Session",
      durationMinutes: 60,
      priceCents: 1000,
      availableHours: null,
      requiresBooking: true,
      isActive: true,
      deletedAt: null,
    };
    const book = {
      restaurantId: "rest-1",
      serviceItemId: 10,
      customerName: "Ada",
      customerPhone: "+886900000000",
      bookingDate: "2026-06-10",
      bookingTime: "10:00",
      employeeId: 7,
    };

    await expect(
      createService({
        db: createDbMock({
          selectGet: [
            serviceRow,
            { id: 7, restaurantId: "rest-1", isActive: false, role: 2 },
          ],
        }).db,
      }).createBooking(book),
    ).rejects.toThrow("The assigned employee is not available");

    await expect(
      createService({
        db: createDbMock({
          selectGet: [
            serviceRow,
            { id: 7, restaurantId: "rest-1", isActive: true, role: 2 },
          ],
          selectAll: [[]],
        }).db,
      }).createBooking(book),
    ).rejects.toThrow("The assigned employee is not available");

    await expect(
      createService({
        db: createDbMock({
          selectGet: [
            serviceRow,
            { id: 7, restaurantId: "rest-1", isActive: true, role: 2 },
          ],
          selectAll: [
            [
              {
                availabilityType: "specific_date",
                startDate: "2026-06-10",
                endDate: "2026-06-10",
                startTime: null,
                endTime: null,
                preferenceType: "available",
                priority: 2,
              },
            ],
            [{ bookingTime: "09:30", durationMinutesSnapshot: 60 }],
          ],
        }).db,
      }).createBooking(book),
    ).rejects.toThrow("The assigned employee is not available");
  });

  it("rolls back reserved capacity when booking insertion fails", async () => {
    const { d1, calls } = createD1Mock([{ changes: 1 }, { changes: 1 }]);
    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            get: vi.fn(async () => ({
              id: 10,
              restaurantId: "rest-1",
              name: "Spa Session",
              durationMinutes: 60,
              priceCents: 1000,
              availableHours: null,
              requiresBooking: true,
              isActive: true,
              deletedAt: null,
            })),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        values: vi.fn(() => ({
          returning: vi.fn(async () => {
            throw new Error("insert failed");
          }),
        })),
      })),
    };
    const service = createService({ d1: d1 as never, db });

    await expect(
      service.createBooking({
        restaurantId: "rest-1",
        serviceItemId: 10,
        customerName: "Ada",
        customerPhone: "+886900000000",
        bookingDate: "2026-06-10",
        bookingTime: "10:00",
      }),
    ).rejects.toThrow("insert failed");
    expect(calls).toHaveLength(2);
    expect(calls[1].sql).toContain("current_bookings - 1");
  });

  it("creates waitlist entries with default party and waiting status", async () => {
    const insertedRow = { id: "wait-1" };
    const { db, insertValues } = createDbMock({
      selectGet: [
        {
          id: 10,
          restaurantId: "rest-1",
          durationMinutes: 60,
          availableHours: null,
          requiresBooking: true,
          isActive: true,
          deletedAt: null,
        },
      ],
      insertReturning: [insertedRow],
    });
    const service = createService({ db });

    await expect(
      service.joinWaitlist({
        restaurantId: "rest-1",
        serviceItemId: 10,
        customerName: "Ada",
        customerPhone: "+886900000000",
        bookingDate: "2026-06-10",
        bookingTime: "10:00",
        notes: "Any staff is fine",
      }),
    ).resolves.toBe(insertedRow);
    expect(insertValues[0]).toMatchObject({
      restaurantId: "rest-1",
      serviceItemId: 10,
      customerName: "Ada",
      customerEmail: null,
      partySize: 1,
      status: SERVICE_BOOKING_WAITLIST_STATUS.WAITING,
      notes: "Any staff is fine",
    });
  });

  it("rejects waitlist entries for unavailable or non-bookable services", async () => {
    const waitlist = {
      restaurantId: "rest-1",
      serviceItemId: 10,
      customerName: "Ada",
      customerPhone: "+886900000000",
      bookingDate: "2026-06-10",
      bookingTime: "10:00",
    };

    await expect(
      createService({
        db: createDbMock({ selectGet: [undefined] }).db,
      }).joinWaitlist(waitlist),
    ).rejects.toThrow("Service not found");
    await expect(
      createService({
        db: createDbMock({
          selectGet: [
            {
              id: 10,
              restaurantId: "rest-2",
              availableHours: null,
              requiresBooking: true,
              isActive: true,
              deletedAt: null,
            },
          ],
        }).db,
      }).joinWaitlist(waitlist),
    ).rejects.toThrow("Service does not belong to this restaurant");
    await expect(
      createService({
        db: createDbMock({
          selectGet: [
            {
              id: 10,
              restaurantId: "rest-1",
              availableHours: null,
              requiresBooking: false,
              isActive: true,
              deletedAt: null,
            },
          ],
        }).db,
      }).joinWaitlist(waitlist),
    ).rejects.toThrow("This service does not accept waitlist entries");
  });

  it("lists slots, bookings, and due reminders with optional filters", async () => {
    const slots = [{ id: "slot-1" }];
    const bookings = [{ id: "booking-1" }];
    const reminders = [{ id: "reminder-1" }];
    const { db } = createDbMock({
      selectAll: [slots, bookings, reminders],
    });
    const service = createService({ db });

    await expect(
      service.listSlots({
        restaurantId: "rest-1",
        serviceItemId: 10,
        date: "2026-06-10",
      }),
    ).resolves.toBe(slots);
    await expect(
      service.listByRestaurant({
        restaurantId: "rest-1",
        date: "2026-06-10",
        status: SERVICE_BOOKING_STATUS.CONFIRMED,
      }),
    ).resolves.toBe(bookings);
    await expect(
      service.listDueReminders({
        before: new Date("2026-06-10T00:00:00.000Z"),
        restaurantId: "rest-1",
      }),
    ).resolves.toBe(reminders);
  });

  it("creates slots through upsert and reports missing slot reads", async () => {
    const { d1, calls } = createD1Mock([{ changes: 1 }]);
    const slot = {
      id: "slot-1",
      restaurantId: "rest-1",
      serviceItemId: 10,
      date: "2026-06-10",
      timeSlot: "10:00",
      maxCapacity: 2,
      currentBookings: 0,
      isAvailable: 0,
      blockReason: "Staff meeting",
    };
    const { db } = createDbMock({
      selectGet: [{ id: 10, restaurantId: "rest-1" }, slot],
    });
    const service = createService({ d1: d1 as never, db });

    await expect(
      service.createSlot({
        restaurantId: "rest-1",
        serviceItemId: 10,
        date: "2026-06-10",
        timeSlot: "10:00",
        maxCapacity: 2,
        isAvailable: false,
        blockReason: "Staff meeting",
      }),
    ).resolves.toBe(slot);
    expect(calls[0]).toMatchObject({
      params: [
        expect.any(String),
        "rest-1",
        10,
        "2026-06-10",
        "10:00",
        2,
        0,
        "Staff meeting",
      ],
    });

    await expect(
      createService({
        db: createDbMock({
          selectGet: [{ id: 10, restaurantId: "rest-2" }],
        }).db,
      }).createSlot({
        restaurantId: "rest-1",
        serviceItemId: 10,
        date: "2026-06-10",
        timeSlot: "10:00",
        maxCapacity: 2,
      }),
    ).rejects.toThrow("Service does not belong to this restaurant");
  });

  it("requires matching contact proof for confirmation-code lookups", async () => {
    const booking = {
      id: "booking-1",
      confirmationCode: "ABC123",
      customerPhone: "+886 900-000-000",
      customerEmail: "Ada@Example.Test",
    };
    const createLookupService = () => {
      const { db } = createDbMock({ selectGet: [booking] });
      return createService({ db });
    };

    await expect(
      createLookupService().getByConfirmationCode("abc123", {
        customerPhone: "+886900000000",
      }),
    ).resolves.toBe(booking);
    await expect(
      createLookupService().getByConfirmationCode("abc123", {
        customerEmail: "ada@example.test",
      }),
    ).resolves.toBe(booking);
    await expect(
      createLookupService().getByConfirmationCode("abc123"),
    ).rejects.toThrow("Booking phone or email is required");
    await expect(
      createLookupService().getByConfirmationCode("abc123", {
        customerPhone: "+886911111111",
      }),
    ).rejects.toThrow("Booking contact does not match");
  });

  it("cancels confirmed bookings by proof and releases slot and voucher use", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const booking = {
      id: "booking-1",
      serviceItemId: 10,
      bookingDate: "2026-06-10",
      bookingTime: "10:00",
      status: SERVICE_BOOKING_STATUS.CONFIRMED,
      couponId: 99,
      customerPhone: "+886900000000",
      customerEmail: null,
    };
    const cancelled = { ...booking, status: SERVICE_BOOKING_STATUS.CANCELLED };
    const { d1, calls } = createD1Mock([{ changes: 1 }, { changes: 1 }]);
    const { db, updateSets } = createDbMock({
      selectGet: [booking],
      updateReturning: [cancelled],
    });
    const service = createService({ d1: d1 as never, db });

    await expect(
      service.cancelByConfirmationCode("booking-code", {
        customerPhone: "+886900000000",
      }),
    ).resolves.toBe(cancelled);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({
      params: [10, "2026-06-10", "10:00"],
    });
    expect(calls[1]).toMatchObject({ params: [99] });
    expect(updateSets[0]).toMatchObject({
      status: SERVICE_BOOKING_STATUS.CANCELLED,
      cancelledAt: new Date("2026-06-07T00:00:00.000Z"),
      updatedAt: new Date("2026-06-07T00:00:00.000Z"),
    });
  });

  it("cancels pending bookings without decrementing voucher usage", async () => {
    const booking = {
      id: "booking-1",
      serviceItemId: 10,
      bookingDate: "2026-06-10",
      bookingTime: "10:00",
      status: SERVICE_BOOKING_STATUS.PENDING,
      couponId: 99,
    };
    const { d1, calls } = createD1Mock([{ changes: 1 }]);
    const { db } = createDbMock({
      selectGet: [booking],
      updateReturning: [
        { ...booking, status: SERVICE_BOOKING_STATUS.CANCELLED },
      ],
    });
    const service = createService({ d1: d1 as never, db });

    await service.cancelBooking("booking-1");

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      params: [10, "2026-06-10", "10:00"],
    });
  });

  it("marks reminders sent and transitions confirmed bookings", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const { db, updateSets } = createDbMock({
      selectGet: [
        { id: "booking-1", status: SERVICE_BOOKING_STATUS.CONFIRMED },
        { id: "booking-1", status: SERVICE_BOOKING_STATUS.CONFIRMED },
      ],
      updateReturning: [
        { id: "booking-1", reminderSentAt: new Date() },
        { id: "booking-1", status: SERVICE_BOOKING_STATUS.COMPLETED },
      ],
    });
    const service = createService({ db });

    await expect(service.markReminderSent("booking-1")).resolves.toMatchObject({
      id: "booking-1",
    });
    await expect(
      service.transition("booking-1", "completed"),
    ).resolves.toMatchObject({
      status: SERVICE_BOOKING_STATUS.COMPLETED,
    });
    expect(updateSets[0]).toMatchObject({
      reminderSentAt: new Date("2026-06-07T00:00:00.000Z"),
      updatedAt: new Date("2026-06-07T00:00:00.000Z"),
    });
    expect(updateSets[1]).toMatchObject({
      status: SERVICE_BOOKING_STATUS.COMPLETED,
      completedAt: new Date("2026-06-07T00:00:00.000Z"),
      updatedAt: new Date("2026-06-07T00:00:00.000Z"),
    });
  });

  it("marks no-shows and rejects transitions from non-confirmed bookings", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const { db, updateSets } = createDbMock({
      selectGet: [
        { id: "booking-1", status: SERVICE_BOOKING_STATUS.CONFIRMED },
        { id: "booking-2", status: SERVICE_BOOKING_STATUS.PENDING },
      ],
      updateReturning: [
        { id: "booking-1", status: SERVICE_BOOKING_STATUS.NO_SHOW },
      ],
    });
    const service = createService({ db });

    await expect(
      service.transition("booking-1", "no_show"),
    ).resolves.toMatchObject({ status: SERVICE_BOOKING_STATUS.NO_SHOW });
    expect(updateSets[0]).toMatchObject({
      status: SERVICE_BOOKING_STATUS.NO_SHOW,
      noShowAt: new Date("2026-06-07T00:00:00.000Z"),
    });
    await expect(service.transition("booking-2", "completed")).rejects.toThrow(
      "Only confirmed bookings can be completed or marked no-show",
    );
  });

  it("pays pending bookings with credits and claims voucher usage", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    vi.spyOn(CreditService.prototype, "getBalance").mockResolvedValue({
      balanceCents: 3000,
      currency: "TWD",
    } as never);
    const spend = vi
      .spyOn(CreditService.prototype, "spend")
      .mockResolvedValue({ ledgerEntryId: "ledger-1" } as never);
    const booking = {
      id: "booking-1",
      status: SERVICE_BOOKING_STATUS.PENDING,
      couponId: 99,
      paymentRequirement: SERVICE_BOOKING_PAYMENT_REQUIREMENT.PREPAY,
      amountDueCents: 2500,
    };
    const confirmed = {
      ...booking,
      status: SERVICE_BOOKING_STATUS.CONFIRMED,
      paymentStatus: SERVICE_BOOKING_PAYMENT_STATUS.PAID,
    };
    const { d1, calls } = createD1Mock([{ changes: 1 }]);
    const { db, updateSets } = createDbMock({
      selectGet: [booking],
      updateReturning: [confirmed],
    });
    const service = createService({ d1: d1 as never, db });

    await expect(
      service.payWithCredits({
        bookingId: "booking-1",
        creditCardPublicId: "card-public-1",
        pin: "1234",
      }),
    ).resolves.toBe(confirmed);

    expect(spend).toHaveBeenCalledWith({
      publicId: "card-public-1",
      amountCents: 2500,
      currency: "TWD",
      idempotencyKey: "service-booking:booking-1",
      sourceType: "service_booking",
      sourceId: "booking-1",
      pin: "1234",
    });
    expect(calls[0]).toMatchObject({ params: [99] });
    expect(updateSets[0]).toMatchObject({
      status: SERVICE_BOOKING_STATUS.CONFIRMED,
      paymentStatus: SERVICE_BOOKING_PAYMENT_STATUS.PAID,
      paymentMethod: SERVICE_BOOKING_PAYMENT_METHOD.CREDITS,
      amountPaidCents: 2500,
      paymentRef: "ledger-1",
    });
  });

  it("confirms zero-amount credit bookings without spending credits", async () => {
    const spend = vi.spyOn(CreditService.prototype, "spend");
    const booking = {
      id: "booking-1",
      status: SERVICE_BOOKING_STATUS.PENDING,
      couponId: null,
      paymentRequirement: SERVICE_BOOKING_PAYMENT_REQUIREMENT.PREPAY,
      amountDueCents: 0,
    };
    const { db, updateSets } = createDbMock({
      selectGet: [booking],
      updateReturning: [
        { ...booking, status: SERVICE_BOOKING_STATUS.CONFIRMED },
      ],
    });
    const service = createService({ db });

    await service.payWithCredits({
      bookingId: "booking-1",
      creditCardPublicId: "card-public-1",
    });

    expect(spend).not.toHaveBeenCalled();
    expect(updateSets[0]).toMatchObject({
      paymentMethod: SERVICE_BOOKING_PAYMENT_METHOD.CREDITS,
      amountPaidCents: 0,
      paymentRef: null,
    });
  });

  it("rejects payment for non-pending bookings", async () => {
    const { db } = createDbMock({
      selectGet: [
        { id: "booking-1", status: SERVICE_BOOKING_STATUS.CONFIRMED },
      ],
    });
    const service = createService({ db });

    await expect(
      service.payWithCredits({
        bookingId: "booking-1",
        creditCardPublicId: "card-public-1",
      }),
    ).rejects.toThrow("Booking is not awaiting payment");
  });

  it("rolls back earlier recurring bookings when a later booking fails", async () => {
    const { d1, calls } = createD1Mock([{ changes: 1 }]);
    const { db } = createDbMock({});
    const service = createService({ d1: d1 as never, db });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(service, "createBooking")
      .mockResolvedValueOnce({
        id: "booking-1",
        serviceItemId: 10,
        bookingDate: "2026-06-10",
        bookingTime: "10:00",
        status: SERVICE_BOOKING_STATUS.PENDING,
      } as never)
      .mockRejectedValueOnce(new Error("second booking failed"));

    await expect(
      service.createRecurringBookings({
        restaurantId: "rest-1",
        serviceItemId: 10,
        customerName: "Ada",
        customerPhone: "+886900000000",
        startDate: "2026-06-10",
        bookingTime: "10:00",
        count: 2,
      }),
    ).rejects.toThrow("second booking failed");

    expect(db.delete).toHaveBeenCalled();
    expect(calls[0]).toMatchObject({
      params: [10, "2026-06-10", "10:00"],
    });
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

  it("renders cancelled calendar invites by confirmation code", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    const service = createService();
    vi.spyOn(service, "getByConfirmationCode").mockResolvedValue({
      id: "booking-1",
      bookingDate: "2026-06-10",
      bookingTime: "10:30",
      durationMinutesSnapshot: null,
      serviceNameSnapshot: "Spa",
      confirmationCode: "ABC123",
      specialRequests: null,
      calendarUid: "uid-1@example.test",
      status: SERVICE_BOOKING_STATUS.CANCELLED,
    } as never);

    await expect(
      service.generateCalendarInviteByConfirmationCode("ABC123", {
        customerPhone: "+886900000000",
      }),
    ).resolves.toContain("STATUS:CANCELLED");

    vi.mocked(service.getByConfirmationCode).mockResolvedValueOnce(null);
    await expect(
      service.generateCalendarInviteByConfirmationCode("MISSING"),
    ).rejects.toThrow("Booking not found");
  });
});
