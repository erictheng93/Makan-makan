/**
 * Real-D1 tests for ServiceBookingService (預約服務).
 *
 * Proves the booking core against real SQLite: availability window, atomic slot
 * capacity, voucher discount + used_count, credits payment + confirmation,
 * cancellation restoring capacity, lifecycle transitions.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  createTestDatabase,
  type TestDatabase,
} from "@makanmakan/database/testing";
import {
  restaurants,
  restaurantServiceItems,
  serviceBookingSlots,
  coupons,
  employeeAvailability,
  users,
} from "@makanmakan/database";
import { eq } from "drizzle-orm";
import type { Env } from "../../types/env";
import { ServiceBookingService } from "../../features/service-bookings/services/ServiceBookingService";
import { CreditService } from "../../features/credits/services/CreditService";

let testDb: TestDatabase;
const RESTAURANT_ID = "r-svc";

function env(): Env {
  return {
    DB: testDb.bindings.DB,
    CACHE_KV: testDb.bindings.CACHE_KV,
  } as Env;
}

function service(): ServiceBookingService {
  return new ServiceBookingService(env());
}

async function seedRestaurant(id: string = RESTAURANT_ID): Promise<void> {
  await testDb.drizzle.insert(restaurants).values({
    id,
    name: "Test Stall",
    type: "street_food",
    category: "activity",
    address: "1 Night Market Rd",
    district: "West",
    phone: "0900000000",
  });
}

async function seedService(options: {
  priceCents?: number;
  requiresBooking?: boolean;
  durationMinutes?: number;
  availableHours?: { start?: string; end?: string; days?: number[] } | null;
  restaurantId?: string;
}): Promise<number> {
  const [row] = await testDb.drizzle
    .insert(restaurantServiceItems)
    .values({
      restaurantId: options.restaurantId ?? RESTAURANT_ID,
      name: "Lantern Painting",
      serviceType: "activity",
      requiresBooking: options.requiresBooking ?? true,
      priceCents: options.priceCents ?? 15000,
      durationMinutes: options.durationMinutes ?? 60,
      availableHours: options.availableHours ?? null,
    })
    .returning({ id: restaurantServiceItems.id });
  return row.id;
}

async function seedSlot(
  serviceItemId: number,
  date: string,
  timeSlot: string,
  maxCapacity: number,
): Promise<void> {
  await testDb.drizzle.insert(serviceBookingSlots).values({
    restaurantId: RESTAURANT_ID,
    serviceItemId,
    date,
    timeSlot,
    maxCapacity,
  });
}

async function seedPlatformCoupon(
  code: string,
  discountPercent: number,
): Promise<number> {
  // Dollar columns only — the `_cents` columns are derived by DB triggers.
  const [row] = await testDb.drizzle
    .insert(coupons)
    .values({
      code,
      name: code,
      restaurantId: null,
      discountType: "percentage",
      discountValue: discountPercent,
      validFrom: "2020-01-01",
      validTo: "2099-12-31",
      isActive: true,
      isVisible: true,
    })
    .returning({ id: coupons.id });
  return row.id;
}

async function seedEmployee(
  overrides: Partial<typeof users.$inferInsert> = {},
): Promise<number> {
  const [row] = await testDb.drizzle
    .insert(users)
    .values({
      username: `booking-employee-${crypto.randomUUID()}`,
      email: null,
      phone: null,
      fullName: "Booking Employee",
      passwordHash: "test",
      role: 3,
      restaurantId: RESTAURANT_ID,
      isActive: true,
      ...overrides,
    })
    .returning({ id: users.id });
  return row.id;
}

async function seedEmployeeAvailability(
  input: Partial<typeof employeeAvailability.$inferInsert> & {
    employeeId: number;
  },
): Promise<void> {
  await testDb.drizzle.insert(employeeAvailability).values({
    restaurantId: RESTAURANT_ID,
    availabilityType: "recurring",
    dayOfWeek: 5,
    startTime: "09:00",
    endTime: "17:00",
    preferenceType: "available",
    priority: 0,
    isActive: true,
    ...input,
  });
}

async function usedCount(couponId: number): Promise<number> {
  const [row] = await testDb.drizzle
    .select({ usedCount: coupons.usedCount })
    .from(coupons)
    .where(eq(coupons.id, couponId))
    .all();
  return row?.usedCount ?? 0;
}

async function slotBookings(serviceItemId: number): Promise<number> {
  const [row] = await testDb.drizzle
    .select({ currentBookings: serviceBookingSlots.currentBookings })
    .from(serviceBookingSlots)
    .where(eq(serviceBookingSlots.serviceItemId, serviceItemId))
    .all();
  return row?.currentBookings ?? 0;
}

beforeAll(async () => {
  testDb = await createTestDatabase();
});
afterAll(async () => {
  await testDb.dispose();
});
beforeEach(async () => {
  await testDb.truncateAll();
  await seedRestaurant();
});

describe("ServiceBookingService — create", () => {
  it("creates a pending booking at full price", async () => {
    const serviceId = await seedService({ priceCents: 15000 });
    const booking = await service().createBooking({
      restaurantId: RESTAURANT_ID,
      serviceItemId: serviceId,
      customerName: "Guest",
      customerPhone: "0911222333",
      bookingDate: "2026-06-05",
      bookingTime: "14:00",
    });

    expect(booking).toMatchObject({
      status: "pending",
      paymentStatus: "unpaid",
      priceCentsSnapshot: 15000,
      amountDueCents: 15000,
      serviceNameSnapshot: "Lantern Painting",
    });
    expect(booking.confirmationCode).toMatch(/^[0-9A-F]{32}$/);
  });

  it("rejects a non-bookable service", async () => {
    const serviceId = await seedService({ requiresBooking: false });
    await expect(
      service().createBooking({
        restaurantId: RESTAURANT_ID,
        serviceItemId: serviceId,
        customerName: "Guest",
        customerPhone: "0911222333",
        bookingDate: "2026-06-05",
        bookingTime: "14:00",
      }),
    ).rejects.toMatchObject({ code: "SERVICE_NOT_BOOKABLE" });
  });

  it("enforces the service available days", async () => {
    const serviceId = await seedService({
      availableHours: { start: "10:00", end: "18:00", days: [1, 2, 3, 4, 5] },
    });
    // 2026-06-07 is a Sunday (day 0) — outside Mon–Fri.
    await expect(
      service().createBooking({
        restaurantId: RESTAURANT_ID,
        serviceItemId: serviceId,
        customerName: "Guest",
        customerPhone: "0911222333",
        bookingDate: "2026-06-07",
        bookingTime: "14:00",
      }),
    ).rejects.toMatchObject({ code: "SERVICE_DAY_UNAVAILABLE" });
  });

  it("rejects a time before the service opens", async () => {
    const serviceId = await seedService({
      availableHours: { start: "10:00", end: "18:00" },
    });
    await expect(
      service().createBooking({
        restaurantId: RESTAURANT_ID,
        serviceItemId: serviceId,
        customerName: "Guest",
        customerPhone: "0911222333",
        bookingDate: "2026-06-05",
        bookingTime: "09:00",
      }),
    ).rejects.toMatchObject({ code: "SERVICE_TIME_UNAVAILABLE" });
  });

  it("applies a platform voucher as a discount", async () => {
    const serviceId = await seedService({ priceCents: 15000 });
    await seedPlatformCoupon("SVC10", 10);
    const booking = await service().createBooking({
      restaurantId: RESTAURANT_ID,
      serviceItemId: serviceId,
      customerName: "Guest",
      customerPhone: "0911222333",
      bookingDate: "2026-06-05",
      bookingTime: "14:00",
      voucherCode: "SVC10",
    });
    expect(booking.voucherDiscountCents).toBe(1500);
    expect(booking.amountDueCents).toBe(13500);
    expect(booking.couponId).not.toBeNull();
  });
});

describe("ServiceBookingService — capacity", () => {
  it("creates operator-managed slots that drive availability and blocking", async () => {
    const serviceId = await seedService({});
    const slot = await service().createSlot({
      restaurantId: RESTAURANT_ID,
      serviceItemId: serviceId,
      date: "2026-06-05",
      timeSlot: "14:00",
      maxCapacity: 2,
    });

    expect(slot).toMatchObject({
      restaurantId: RESTAURANT_ID,
      serviceItemId: serviceId,
      date: "2026-06-05",
      timeSlot: "14:00",
      maxCapacity: 2,
      currentBookings: 0,
      isAvailable: 1,
    });
    expect(
      await service().getAvailability({
        serviceItemId: serviceId,
        date: "2026-06-05",
      }),
    ).toEqual([
      {
        timeSlot: "14:00",
        remaining: 2,
        isAvailable: true,
      },
    ]);

    await service().createBooking({
      restaurantId: RESTAURANT_ID,
      serviceItemId: serviceId,
      customerName: "First",
      customerPhone: "0911000001",
      bookingDate: "2026-06-05",
      bookingTime: "14:00",
    });
    expect(
      await service().getAvailability({
        serviceItemId: serviceId,
        date: "2026-06-05",
      }),
    ).toEqual([
      {
        timeSlot: "14:00",
        remaining: 1,
        isAvailable: true,
      },
    ]);

    await service().blockSlot({
      restaurantId: RESTAURANT_ID,
      serviceItemId: serviceId,
      date: "2026-06-05",
      timeSlot: "14:00",
      blockReason: "Private event",
    });
    expect(
      await service().getAvailability({
        serviceItemId: serviceId,
        date: "2026-06-05",
      }),
    ).toEqual([
      {
        timeSlot: "14:00",
        remaining: 1,
        isAvailable: false,
      },
    ]);

    await expect(
      service().createBooking({
        restaurantId: RESTAURANT_ID,
        serviceItemId: serviceId,
        customerName: "Second",
        customerPhone: "0911000002",
        bookingDate: "2026-06-05",
        bookingTime: "14:00",
      }),
    ).rejects.toMatchObject({ code: "SERVICE_SLOT_FULL" });
  });

  it("reserves slot capacity and rejects an overbooked slot", async () => {
    const serviceId = await seedService({});
    await seedSlot(serviceId, "2026-06-05", "14:00", 1);

    await service().createBooking({
      restaurantId: RESTAURANT_ID,
      serviceItemId: serviceId,
      customerName: "First",
      customerPhone: "0911000001",
      bookingDate: "2026-06-05",
      bookingTime: "14:00",
    });
    expect(await slotBookings(serviceId)).toBe(1);

    await expect(
      service().createBooking({
        restaurantId: RESTAURANT_ID,
        serviceItemId: serviceId,
        customerName: "Second",
        customerPhone: "0911000002",
        bookingDate: "2026-06-05",
        bookingTime: "14:00",
      }),
    ).rejects.toMatchObject({ code: "SERVICE_SLOT_FULL" });
  });
});

describe("ServiceBookingService — payment & lifecycle", () => {
  async function issueCard(balanceCents: number): Promise<string> {
    const card = await new CreditService(env()).issueCard({
      currency: "TWD",
      initialBalanceCents: balanceCents,
    });
    return card.publicId;
  }

  it("pays with credits, confirms, and counts the voucher", async () => {
    const serviceId = await seedService({ priceCents: 15000 });
    const couponId = await seedPlatformCoupon("SVC10", 10);
    const publicId = await issueCard(100000);

    const booking = await service().createBooking({
      restaurantId: RESTAURANT_ID,
      serviceItemId: serviceId,
      customerName: "Guest",
      customerPhone: "0911222333",
      bookingDate: "2026-06-05",
      bookingTime: "14:00",
      voucherCode: "SVC10",
    });

    const paid = await service().payWithCredits({
      bookingId: booking.id,
      creditCardPublicId: publicId,
    });

    expect(paid).toMatchObject({
      status: "confirmed",
      paymentStatus: "paid",
      paymentMethod: "credits",
      amountPaidCents: 13500,
    });
    expect(paid.paymentRef).toBeTruthy();
    expect(await usedCount(couponId)).toBe(1);

    const balance = await new CreditService(env()).getBalance(publicId);
    expect(balance.balanceCents).toBe(100000 - 13500);
  });

  it("cancels a confirmed booking, restoring capacity and voucher count", async () => {
    const serviceId = await seedService({ priceCents: 15000 });
    const couponId = await seedPlatformCoupon("SVC10", 10);
    await seedSlot(serviceId, "2026-06-05", "14:00", 2);
    const publicId = await issueCard(100000);

    const booking = await service().createBooking({
      restaurantId: RESTAURANT_ID,
      serviceItemId: serviceId,
      customerName: "Guest",
      customerPhone: "0911222333",
      bookingDate: "2026-06-05",
      bookingTime: "14:00",
      voucherCode: "SVC10",
    });
    await service().payWithCredits({
      bookingId: booking.id,
      creditCardPublicId: publicId,
    });
    expect(await slotBookings(serviceId)).toBe(1);
    expect(await usedCount(couponId)).toBe(1);

    const cancelled = await service().cancelBooking(booking.id);
    expect(cancelled.status).toBe("cancelled");
    expect(await slotBookings(serviceId)).toBe(0);
    expect(await usedCount(couponId)).toBe(0);
  });

  it("completes a confirmed booking", async () => {
    const serviceId = await seedService({ priceCents: 0 });
    const booking = await service().createBooking({
      restaurantId: RESTAURANT_ID,
      serviceItemId: serviceId,
      customerName: "Guest",
      customerPhone: "0911222333",
      bookingDate: "2026-06-05",
      bookingTime: "14:00",
    });
    // price 0 -> nothing to charge; confirm as cash (pay at venue path).
    await service().confirmCash(booking.id);
    const done = await service().transition(booking.id, "completed");
    expect(done.status).toBe("completed");
  });
});

describe("ServiceBookingService — confirmation contact proof", () => {
  it("keeps code-only lookup compatible and enforces required phone/email proof", async () => {
    const serviceId = await seedService({ priceCents: 0 });
    const booking = await service().createBooking({
      restaurantId: RESTAURANT_ID,
      serviceItemId: serviceId,
      customerName: "Guest",
      customerPhone: "0911222333",
      customerEmail: "Guest@Example.test",
      bookingDate: "2026-06-05",
      bookingTime: "14:00",
    });

    await expect(
      service().getByConfirmationCode(booking.confirmationCode),
    ).resolves.toMatchObject({ id: booking.id });

    await expect(
      service().getByConfirmationCode(booking.confirmationCode, {
        requireContact: true,
      }),
    ).rejects.toMatchObject({ code: "SERVICE_BOOKING_CONTACT_REQUIRED" });

    await expect(
      service().getByConfirmationCode(booking.confirmationCode, {
        requireContact: true,
        customerPhone: "0900000000",
      }),
    ).rejects.toMatchObject({ code: "SERVICE_BOOKING_CONTACT_MISMATCH" });

    await expect(
      service().getByConfirmationCode(booking.confirmationCode, {
        requireContact: true,
        customerPhone: "0911-222-333",
      }),
    ).resolves.toMatchObject({ id: booking.id });

    await expect(
      service().getByConfirmationCode(booking.confirmationCode, {
        requireContact: true,
        customerEmail: "guest@example.test",
      }),
    ).resolves.toMatchObject({ id: booking.id });
  });

  it("does not cancel when the supplied second factor is wrong", async () => {
    const serviceId = await seedService({ priceCents: 0 });
    const booking = await service().createBooking({
      restaurantId: RESTAURANT_ID,
      serviceItemId: serviceId,
      customerName: "Guest",
      customerPhone: "0911222333",
      customerEmail: "guest@example.test",
      bookingDate: "2026-06-05",
      bookingTime: "14:00",
    });

    await expect(
      service().cancelByConfirmationCode(booking.confirmationCode, {
        requireContact: true,
        customerEmail: "other@example.test",
      }),
    ).rejects.toMatchObject({ code: "SERVICE_BOOKING_CONTACT_MISMATCH" });

    await expect(service().getById(booking.id)).resolves.toMatchObject({
      status: "pending",
    });

    await expect(
      service().cancelByConfirmationCode(booking.confirmationCode, {
        requireContact: true,
        customerEmail: "GUEST@example.test",
      }),
    ).resolves.toMatchObject({ status: "cancelled" });
  });
});

describe("ServiceBookingService — employee assignment availability", () => {
  it("stores an assigned employee when the employee is available for the service duration", async () => {
    const serviceId = await seedService({ durationMinutes: 60 });
    const employeeId = await seedEmployee();
    await seedEmployeeAvailability({
      employeeId,
      dayOfWeek: 5, // 2026-06-05 is Friday
      startTime: "13:00",
      endTime: "15:00",
      preferenceType: "preferred",
    });

    const booking = await service().createBooking({
      restaurantId: RESTAURANT_ID,
      serviceItemId: serviceId,
      customerName: "Guest",
      customerPhone: "0911222333",
      bookingDate: "2026-06-05",
      bookingTime: "14:00",
      employeeId,
    });

    expect(booking.employeeId).toBe(employeeId);
  });

  it("rejects an assigned employee with no matching availability", async () => {
    const serviceId = await seedService({ durationMinutes: 60 });
    const employeeId = await seedEmployee();

    await expect(
      service().createBooking({
        restaurantId: RESTAURANT_ID,
        serviceItemId: serviceId,
        customerName: "Guest",
        customerPhone: "0911222333",
        bookingDate: "2026-06-05",
        bookingTime: "14:00",
        employeeId,
      }),
    ).rejects.toMatchObject({ code: "SERVICE_EMPLOYEE_UNAVAILABLE" });
  });

  it("lets a specific-date unavailable override block recurring availability", async () => {
    const serviceId = await seedService({ durationMinutes: 60 });
    const employeeId = await seedEmployee();
    await seedEmployeeAvailability({
      employeeId,
      dayOfWeek: 5,
      startTime: "09:00",
      endTime: "17:00",
      preferenceType: "available",
      priority: 0,
    });
    await seedEmployeeAvailability({
      employeeId,
      availabilityType: "specific_date",
      dayOfWeek: null,
      startTime: null,
      endTime: null,
      startDate: "2026-06-05",
      endDate: "2026-06-05",
      preferenceType: "unavailable",
      priority: 10,
    });

    await expect(
      service().createBooking({
        restaurantId: RESTAURANT_ID,
        serviceItemId: serviceId,
        customerName: "Guest",
        customerPhone: "0911222333",
        bookingDate: "2026-06-05",
        bookingTime: "14:00",
        employeeId,
      }),
    ).rejects.toMatchObject({ code: "SERVICE_EMPLOYEE_UNAVAILABLE" });
  });
});
