import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  currentUser: { id: 10, role: 1, restaurantId: "restaurant-1" },
  getAvailability: vi.fn(),
  createBooking: vi.fn(),
  createRecurringBookings: vi.fn(),
  joinWaitlist: vi.fn(),
  payWithCredits: vi.fn(),
  generateCalendarInviteByConfirmationCode: vi.fn(),
  getByConfirmationCode: vi.fn(),
  cancelByConfirmationCode: vi.fn(),
  listSlots: vi.fn(),
  createSlot: vi.fn(),
  batchCreateSlots: vi.fn(),
  blockSlot: vi.fn(),
  listDueReminders: vi.fn(),
  getById: vi.fn(),
  markReminderSent: vi.fn(),
  generateCalendarInvite: vi.fn(),
  listByRestaurant: vi.fn(),
  cancelBooking: vi.fn(),
  confirmCash: vi.fn(),
  transition: vi.fn(),
}));

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c, next) => {
    c.set("user", mocks.currentUser);
    await next();
  }),
  requireRole: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  }),
}));

vi.mock("../../../middleware/rateLimiter", () => ({
  rateLimitMiddleware: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => {
      await next();
    },
  ),
}));

// This file exercises route/request-shaping behaviour, not subscription
// enforcement — the module gate itself is covered exhaustively in
// middleware/moduleGate.test.ts, and the service-bookings wiring (denied vs
// allowed tiers, public-route bypass) has dedicated coverage in
// module-gate.test.ts. Bypass it here, matching the sibling reservations/
// waiting-list/ai-analytics route test convention.
vi.mock("../../../middleware/moduleGate", () => ({
  moduleGate: vi.fn(() => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  }),
}));

vi.mock("../services/ServiceBookingService", () => ({
  MAX_BATCH_SLOT_CREATION_COUNT: 1000,
  ServiceBookingService: vi.fn(function ServiceBookingService() {
    return {
      getAvailability: mocks.getAvailability,
      createBooking: mocks.createBooking,
      createRecurringBookings: mocks.createRecurringBookings,
      joinWaitlist: mocks.joinWaitlist,
      payWithCredits: mocks.payWithCredits,
      generateCalendarInviteByConfirmationCode:
        mocks.generateCalendarInviteByConfirmationCode,
      getByConfirmationCode: mocks.getByConfirmationCode,
      cancelByConfirmationCode: mocks.cancelByConfirmationCode,
      listSlots: mocks.listSlots,
      createSlot: mocks.createSlot,
      batchCreateSlots: mocks.batchCreateSlots,
      blockSlot: mocks.blockSlot,
      listDueReminders: mocks.listDueReminders,
      getById: mocks.getById,
      markReminderSent: mocks.markReminderSent,
      generateCalendarInvite: mocks.generateCalendarInvite,
      listByRestaurant: mocks.listByRestaurant,
      cancelBooking: mocks.cancelBooking,
      confirmCash: mocks.confirmCash,
      transition: mocks.transition,
    };
  }),
}));

import app from "./index";
import { ApiError } from "../../../shared/utils/api-error";

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      { success: false, error: { code: err.code, message: err.message } },
      err.status as 400 | 401 | 403 | 404 | 409,
    );
  }
  return c.json({ success: false, error: { message: String(err) } }, 500);
});

function createEnv() {
  return {
    DB: {},
    CACHE_KV: {},
  };
}

function request(path: string, method = "GET", body?: unknown) {
  return app.request(
    path,
    {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
    },
    createEnv() as never,
  );
}

function createPayload(overrides: Record<string, unknown> = {}) {
  return {
    restaurantId: "restaurant-1",
    serviceItemId: 10,
    customerName: "Ada",
    customerPhone: "0912345678",
    bookingDate: "2026-06-10",
    bookingTime: "18:30",
    partySize: 2,
    ...overrides,
  };
}

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: "booking-1",
    restaurantId: "restaurant-1",
    serviceItemId: 10,
    status: "pending",
    confirmationCode: "ABC123",
    ...overrides,
  };
}

describe("service-bookings routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T00:00:00.000Z"));
    mocks.currentUser = { id: 10, role: 1, restaurantId: "restaurant-1" };
    mocks.getAvailability.mockResolvedValue([
      { date: "2026-06-10", timeSlot: "18:30", availableCapacity: 3 },
    ]);
    mocks.createBooking.mockResolvedValue(booking());
    mocks.createRecurringBookings.mockResolvedValue([
      booking({ id: "booking-1" }),
      booking({ id: "booking-2" }),
    ]);
    mocks.joinWaitlist.mockResolvedValue({ id: "wait-1", position: 1 });
    mocks.payWithCredits.mockResolvedValue(booking({ paymentStatus: "paid" }));
    mocks.generateCalendarInviteByConfirmationCode.mockResolvedValue(
      "BEGIN:VCALENDAR\r\nEND:VCALENDAR",
    );
    mocks.getByConfirmationCode.mockResolvedValue(booking());
    mocks.cancelByConfirmationCode.mockResolvedValue(
      booking({ status: "cancelled" }),
    );
    mocks.listSlots.mockResolvedValue([{ id: "slot-1", timeSlot: "18:30" }]);
    mocks.createSlot.mockResolvedValue({ id: "slot-1" });
    mocks.batchCreateSlots.mockResolvedValue({ created: 2, slots: [] });
    mocks.blockSlot.mockResolvedValue({ id: "slot-1", isAvailable: false });
    mocks.listDueReminders.mockResolvedValue([booking()]);
    mocks.getById.mockResolvedValue(booking());
    mocks.markReminderSent.mockResolvedValue(
      booking({ reminderSentAt: "2026-06-07T00:00:00.000Z" }),
    );
    mocks.generateCalendarInvite.mockResolvedValue(
      "BEGIN:VCALENDAR\r\nEND:VCALENDAR",
    );
    mocks.listByRestaurant.mockResolvedValue([booking()]);
    mocks.cancelBooking.mockResolvedValue(booking({ status: "cancelled" }));
    mocks.confirmCash.mockResolvedValue(booking({ status: "confirmed" }));
    mocks.transition.mockResolvedValue(booking({ status: "completed" }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns availability and validates required public query parameters", async () => {
    const response = await request(
      "/availability?serviceItemId=10&date=2026-06-10",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { slots: [{ timeSlot: "18:30" }] },
    });
    expect(mocks.getAvailability).toHaveBeenCalledWith({
      serviceItemId: 10,
      date: "2026-06-10",
    });

    const missingServiceItem = await request("/availability?date=2026-06-10");
    expect(missingServiceItem.status).toBe(400);

    const invalidDate = await request("/availability?serviceItemId=10");
    expect(invalidDate.status).toBe(400);
  });

  it("creates recurring bookings and validates recurrence limits", async () => {
    const response = await request(
      "/recurring",
      "POST",
      createPayload({
        startDate: "2026-06-10",
        count: 2,
        intervalWeeks: 2,
        bookingDate: undefined,
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { bookings: [{ id: "booking-1" }, { id: "booking-2" }] },
    });
    expect(mocks.createRecurringBookings).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: "2026-06-10",
        count: 2,
        intervalWeeks: 2,
      }),
    );

    const invalid = await request(
      "/recurring",
      "POST",
      createPayload({
        startDate: "2026-06-10",
        count: 13,
        bookingDate: undefined,
      }),
    );
    expect(invalid.status).toBe(400);
    expect(mocks.createRecurringBookings).toHaveBeenCalledTimes(1);
  });

  it("creates waitlist entries and submits credit payments", async () => {
    const waitlistResponse = await request(
      "/waitlist",
      "POST",
      createPayload({ notes: "first available", bookingDate: "2026-06-11" }),
    );
    expect(waitlistResponse.status).toBe(201);
    await expect(waitlistResponse.json()).resolves.toMatchObject({
      data: { waitlistEntry: { id: "wait-1", position: 1 } },
    });
    expect(mocks.joinWaitlist).toHaveBeenCalledWith(
      expect.objectContaining({ notes: "first available" }),
    );

    const payResponse = await request("/booking-1/pay", "POST", {
      creditCardPublicId: "card_pub_1",
      pin: "1234",
    });
    expect(payResponse.status).toBe(200);
    expect(mocks.payWithCredits).toHaveBeenCalledWith({
      bookingId: "booking-1",
      creditCardPublicId: "card_pub_1",
      pin: "1234",
    });

    const invalidPay = await request("/booking-1/pay", "POST", {});
    expect(invalidPay.status).toBe(400);
  });

  it("verifies and cancels by code using query or body contact proof", async () => {
    const verifyResponse = await request(
      "/verify/ABC123?requireContact=yes&customerPhone=0912345678",
    );
    expect(verifyResponse.status).toBe(200);
    expect(mocks.getByConfirmationCode).toHaveBeenCalledWith("ABC123", {
      requireContact: true,
      customerPhone: "0912345678",
      customerEmail: undefined,
    });

    mocks.getByConfirmationCode.mockResolvedValueOnce(null);
    const missingResponse = await request("/verify/MISSING");
    expect(missingResponse.status).toBe(404);

    const cancelResponse = await request(
      "/verify/ABC123/cancel?requireContact=false",
      "POST",
      { phone: "0912345678" },
    );
    expect(cancelResponse.status).toBe(200);
    expect(mocks.cancelByConfirmationCode).toHaveBeenCalledWith("ABC123", {
      requireContact: false,
      customerPhone: "0912345678",
      customerEmail: undefined,
    });
  });

  it("returns public and staff calendar invite responses", async () => {
    const publicResponse = await request(
      "/verify/ABC123/ics?email=guest@example.test",
    );
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.headers.get("content-type")).toContain(
      "text/calendar",
    );
    await expect(publicResponse.text()).resolves.toContain("BEGIN:VCALENDAR");
    expect(mocks.generateCalendarInviteByConfirmationCode).toHaveBeenCalledWith(
      "ABC123",
      {
        requireContact: false,
        customerPhone: undefined,
        customerEmail: "guest@example.test",
      },
    );

    const staffResponse = await request("/booking-1/ics");
    expect(staffResponse.status).toBe(200);
    expect(staffResponse.headers.get("content-disposition")).toBe(
      'attachment; filename="service-booking.ics"',
    );
    expect(mocks.generateCalendarInvite).toHaveBeenCalledWith("booking-1");
  });

  it("lists and manages slots for staff restaurant scope", async () => {
    const listResponse = await request(
      "/slots?serviceItemId=10&date=2026-06-10",
    );
    expect(listResponse.status).toBe(200);
    expect(mocks.listSlots).toHaveBeenCalledWith({
      restaurantId: "restaurant-1",
      serviceItemId: 10,
      date: "2026-06-10",
    });

    const createResponse = await request("/slots", "POST", {
      restaurantId: "restaurant-1",
      serviceItemId: 10,
      date: "2026-06-10",
      timeSlot: "18:30",
      maxCapacity: 6,
      blockReason: "private",
    });
    expect(createResponse.status).toBe(201);
    expect(mocks.createSlot).toHaveBeenCalledWith({
      restaurantId: "restaurant-1",
      serviceItemId: 10,
      date: "2026-06-10",
      timeSlot: "18:30",
      maxCapacity: 6,
      isAvailable: true,
      blockReason: "private",
    });

    const batchResponse = await request("/slots/batch", "POST", {
      restaurantId: "restaurant-1",
      serviceItemId: 10,
      startDate: "2026-06-10",
      endDate: "2026-06-11",
      timeSlots: ["18:30"],
      maxCapacity: 6,
    });
    expect(batchResponse.status).toBe(201);

    const blockResponse = await request("/slots/block", "POST", {
      restaurantId: "restaurant-1",
      serviceItemId: 10,
      date: "2026-06-10",
      timeSlot: "18:30",
      blockReason: "maintenance",
    });
    expect(blockResponse.status).toBe(200);
    expect(mocks.blockSlot).toHaveBeenCalledWith(
      expect.objectContaining({ blockReason: "maintenance" }),
    );
  });

  it("returns slot query validation and missing admin restaurant scope errors", async () => {
    const invalidSlot = await request("/slots?serviceItemId=bad");
    expect(invalidSlot.status).toBe(400);

    mocks.currentUser = { id: 1, role: 0, restaurantId: undefined };
    const missingRestaurant = await request("/slots");
    expect(missingRestaurant.status).toBe(400);
  });

  it("lists bookings and reminder workflows using scoped restaurant access", async () => {
    const listResponse = await request(
      "/?restaurantId=restaurant-1&date=2026-06-10&status=confirmed",
    );
    expect(listResponse.status).toBe(200);
    expect(mocks.listByRestaurant).toHaveBeenCalledWith({
      restaurantId: "restaurant-1",
      date: "2026-06-10",
      status: "confirmed",
    });

    const dueResponse = await request(
      "/reminders/due?before=2026-06-07T01:00:00.000Z",
    );
    expect(dueResponse.status).toBe(200);
    expect(mocks.listDueReminders).toHaveBeenCalledWith({
      before: new Date("2026-06-07T01:00:00.000Z"),
      restaurantId: "restaurant-1",
    });

    const sentResponse = await request("/booking-1/reminder-sent", "POST");
    expect(sentResponse.status).toBe(200);
    expect(mocks.markReminderSent).toHaveBeenCalledWith("booking-1");
  });

  it("runs staff booking detail and status transition routes", async () => {
    const detailResponse = await request("/booking-1");
    expect(detailResponse.status).toBe(200);

    const cancelResponse = await request("/booking-1", "DELETE");
    const cashResponse = await request("/booking-1/confirm-cash", "POST");
    const completeResponse = await request("/booking-1/complete", "POST");
    const noShowResponse = await request("/booking-1/no-show", "POST");

    expect(cancelResponse.status).toBe(200);
    expect(cashResponse.status).toBe(200);
    expect(completeResponse.status).toBe(200);
    expect(noShowResponse.status).toBe(200);
    expect(mocks.cancelBooking).toHaveBeenCalledWith("booking-1");
    expect(mocks.confirmCash).toHaveBeenCalledWith("booking-1");
    expect(mocks.transition).toHaveBeenCalledWith("booking-1", "completed");
    expect(mocks.transition).toHaveBeenCalledWith("booking-1", "no_show");
  });
});
