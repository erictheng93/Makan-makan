/**
 * Service Booking (預約服務) Service — MVP.
 *
 * Internal booking of a restaurant_service_items row. Availability = service
 * hours + optional per-slot capacity. Payment (day 1):
 *   - 卷 (voucher) = pricing-layer discount (reuses single-shop CouponService
 *     validation; coupons.used_count incremented at confirmation, NOT a
 *     coupon_usage row — a booking is not an order),
 *   - 代幣 (credits) = payment via CreditService.spend,
 *   - cash / none = pay at venue.
 *
 * See docs/superpowers/specs/2026-06-03-service-reservation-system.md.
 */

import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import {
  serviceBookings,
  serviceBookingSlots,
  restaurantServiceItems,
  SERVICE_BOOKING_STATUS,
  SERVICE_BOOKING_PAYMENT_METHOD,
  SERVICE_BOOKING_PAYMENT_STATUS,
  type ServiceBookingStatus,
} from "@makanmakan/database";
import { CouponService } from "@makanmakan/database";
import type { Env } from "../../../types/env";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
} from "../../../shared/utils/api-error";
import { toCents } from "../../../shared/utils/money";
import { CreditService } from "../../credits/services/CreditService";

type ServiceBookingRow = typeof serviceBookings.$inferSelect;
type ServiceBookingSlotRow = typeof serviceBookingSlots.$inferSelect;

export interface CreateServiceBookingInput {
  restaurantId: string;
  serviceItemId: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerId?: string;
  bookingDate: string; // YYYY-MM-DD
  bookingTime: string; // HH:MM
  partySize?: number;
  specialRequests?: string;
  /** 卷 code applied as a pricing-layer discount. */
  voucherCode?: string;
}

export interface AvailabilitySlot {
  timeSlot: string;
  remaining: number | null; // null = uncapped (no slot row)
  isAvailable: boolean;
}

export interface CreateServiceBookingSlotInput {
  restaurantId: string;
  serviceItemId: number;
  date: string;
  timeSlot: string;
  maxCapacity: number;
  isAvailable?: boolean;
  blockReason?: string | null;
}

export interface BatchCreateServiceBookingSlotsInput {
  restaurantId: string;
  serviceItemId: number;
  startDate: string;
  endDate: string;
  timeSlots: string[];
  maxCapacity: number;
  isAvailable?: boolean;
}

export interface ServiceBookingContactProof {
  requireContact?: boolean;
  customerPhone?: string;
  customerEmail?: string;
}

export class ServiceBookingService {
  private readonly db: ReturnType<typeof drizzle>;
  private readonly d1: D1Database;
  private readonly env: Env;

  constructor(env: Env) {
    this.db = drizzle(env.DB);
    this.d1 = env.DB;
    this.env = env;
  }

  /** Open slots for a service on a date. Slot rows cap capacity; absent rows
   *  fall back to the service's availableHours (uncapped). */
  async getAvailability(input: {
    serviceItemId: number;
    date: string;
  }): Promise<AvailabilitySlot[]> {
    const slots = await this.db
      .select()
      .from(serviceBookingSlots)
      .where(
        and(
          eq(serviceBookingSlots.serviceItemId, input.serviceItemId),
          eq(serviceBookingSlots.date, input.date),
        ),
      )
      .all();

    return slots.map((slot) => ({
      timeSlot: slot.timeSlot,
      remaining: Math.max(0, slot.maxCapacity - slot.currentBookings),
      isAvailable:
        slot.isAvailable === 1 && slot.currentBookings < slot.maxCapacity,
    }));
  }

  async createBooking(
    input: CreateServiceBookingInput,
  ): Promise<ServiceBookingRow> {
    const service = await this.db
      .select()
      .from(restaurantServiceItems)
      .where(eq(restaurantServiceItems.id, input.serviceItemId))
      .get();

    if (!service || service.deletedAt || !service.isActive) {
      throw notFound("Service not found", "SERVICE_NOT_FOUND");
    }
    if (service.restaurantId !== input.restaurantId) {
      throw badRequest(
        "Service does not belong to this restaurant",
        "SERVICE_RESTAURANT_MISMATCH",
      );
    }
    if (!service.requiresBooking) {
      throw badRequest(
        "This service does not accept bookings",
        "SERVICE_NOT_BOOKABLE",
      );
    }

    assertWithinServiceHours(
      service.availableHours,
      input.bookingDate,
      input.bookingTime,
    );

    // Reserve capacity if a slot row exists (operator-defined cap). A guarded
    // UPDATE makes the reservation atomic against concurrent bookings.
    await this.reserveSlotCapacity(
      input.serviceItemId,
      input.bookingDate,
      input.bookingTime,
    );

    const priceCents = service.priceCents ?? 0;
    let couponId: number | null = null;
    let voucherDiscountCents = 0;
    if (input.voucherCode) {
      const priced = await this.priceVoucher(
        input.voucherCode,
        input.restaurantId,
        priceCents,
      );
      couponId = priced.couponId;
      voucherDiscountCents = priced.discountCents;
    }
    const amountDueCents = Math.max(0, priceCents - voucherDiscountCents);

    const confirmationCode = generateConfirmationCode();
    const [row] = await this.db
      .insert(serviceBookings)
      .values({
        restaurantId: input.restaurantId,
        serviceItemId: input.serviceItemId,
        serviceNameSnapshot: service.name,
        durationMinutesSnapshot: service.durationMinutes ?? null,
        priceCentsSnapshot: priceCents,
        customerId: input.customerId ?? null,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail ?? null,
        bookingDate: input.bookingDate,
        bookingTime: input.bookingTime,
        partySize: input.partySize ?? 1,
        status: SERVICE_BOOKING_STATUS.PENDING,
        confirmationCode,
        specialRequests: input.specialRequests ?? null,
        couponId,
        voucherDiscountCents,
        amountDueCents,
        paymentStatus: SERVICE_BOOKING_PAYMENT_STATUS.UNPAID,
        paymentMethod: SERVICE_BOOKING_PAYMENT_METHOD.NONE,
      })
      .returning();

    return row;
  }

  async listSlots(filters: {
    restaurantId: string;
    serviceItemId?: number;
    date?: string;
  }): Promise<ServiceBookingSlotRow[]> {
    const conditions = [
      eq(serviceBookingSlots.restaurantId, filters.restaurantId),
    ];
    if (filters.serviceItemId) {
      conditions.push(
        eq(serviceBookingSlots.serviceItemId, filters.serviceItemId),
      );
    }
    if (filters.date) {
      conditions.push(eq(serviceBookingSlots.date, filters.date));
    }

    return this.db
      .select()
      .from(serviceBookingSlots)
      .where(and(...conditions))
      .all();
  }

  async createSlot(
    input: CreateServiceBookingSlotInput,
  ): Promise<ServiceBookingSlotRow> {
    await this.assertServiceBelongsToRestaurant(
      input.serviceItemId,
      input.restaurantId,
    );

    const id = crypto.randomUUID();
    const isAvailable = input.isAvailable === false ? 0 : 1;
    const blockReason = input.blockReason ?? null;

    await this.d1
      .prepare(
        `INSERT INTO service_booking_slots (
            id, restaurant_id, service_item_id, date, time_slot, max_capacity,
            current_bookings, is_available, block_reason, created_at_ms,
            updated_at_ms
          ) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, unixepoch('now') * 1000,
            unixepoch('now') * 1000)
          ON CONFLICT(service_item_id, date, time_slot) DO UPDATE SET
            restaurant_id = excluded.restaurant_id,
            max_capacity = excluded.max_capacity,
            is_available = excluded.is_available,
            block_reason = excluded.block_reason,
            updated_at_ms = unixepoch('now') * 1000`,
      )
      .bind(
        id,
        input.restaurantId,
        input.serviceItemId,
        input.date,
        input.timeSlot,
        input.maxCapacity,
        isAvailable,
        blockReason,
      )
      .run();

    return this.requireSlot(input.serviceItemId, input.date, input.timeSlot);
  }

  async batchCreateSlots(
    input: BatchCreateServiceBookingSlotsInput,
  ): Promise<{ created: number; slots: ServiceBookingSlotRow[] }> {
    const dates = enumerateDates(input.startDate, input.endDate);
    const slots: ServiceBookingSlotRow[] = [];

    for (const date of dates) {
      for (const timeSlot of input.timeSlots) {
        slots.push(
          await this.createSlot({
            restaurantId: input.restaurantId,
            serviceItemId: input.serviceItemId,
            date,
            timeSlot,
            maxCapacity: input.maxCapacity,
            isAvailable: input.isAvailable,
          }),
        );
      }
    }

    return { created: slots.length, slots };
  }

  async blockSlot(input: {
    restaurantId: string;
    serviceItemId: number;
    date: string;
    timeSlot: string;
    blockReason?: string | null;
  }): Promise<ServiceBookingSlotRow> {
    await this.assertServiceBelongsToRestaurant(
      input.serviceItemId,
      input.restaurantId,
    );

    const existing = await this.db
      .select()
      .from(serviceBookingSlots)
      .where(
        and(
          eq(serviceBookingSlots.serviceItemId, input.serviceItemId),
          eq(serviceBookingSlots.date, input.date),
          eq(serviceBookingSlots.timeSlot, input.timeSlot),
        ),
      )
      .get();

    return this.createSlot({
      restaurantId: input.restaurantId,
      serviceItemId: input.serviceItemId,
      date: input.date,
      timeSlot: input.timeSlot,
      maxCapacity: existing?.maxCapacity ?? 0,
      isAvailable: false,
      blockReason: input.blockReason ?? "Blocked",
    });
  }

  /** Pay the (voucher-discounted) amount with 代幣 and confirm the booking. */
  async payWithCredits(input: {
    bookingId: string;
    creditCardPublicId: string;
    pin?: string;
  }): Promise<ServiceBookingRow> {
    const booking = await this.loadPayableBooking(input.bookingId);

    let paymentRef: string | null = null;
    if (booking.amountDueCents > 0) {
      const balance = await new CreditService(this.env).getBalance(
        input.creditCardPublicId,
      );
      const result = await new CreditService(this.env).spend({
        publicId: input.creditCardPublicId,
        amountCents: booking.amountDueCents,
        currency: balance.currency,
        idempotencyKey: `service-booking:${booking.id}`,
        sourceType: "service_booking",
        sourceId: booking.id,
        pin: input.pin,
      });
      paymentRef = result.ledgerEntryId;
    }

    return this.markConfirmed(booking, {
      method: SERVICE_BOOKING_PAYMENT_METHOD.CREDITS,
      amountPaidCents: booking.amountDueCents,
      paymentRef,
    });
  }

  /** Staff confirm for a pay-at-venue (cash) booking. */
  async confirmCash(bookingId: string): Promise<ServiceBookingRow> {
    const booking = await this.loadPayableBooking(bookingId);
    return this.markConfirmed(booking, {
      method: SERVICE_BOOKING_PAYMENT_METHOD.CASH,
      amountPaidCents: 0, // collected at venue
      paymentRef: null,
    });
  }

  /** Public cancel — the confirmation code is the anonymous ownership proof. */
  async cancelByConfirmationCode(
    code: string,
    contactProof?: ServiceBookingContactProof,
  ): Promise<ServiceBookingRow> {
    const booking = await this.getByConfirmationCode(code, contactProof);
    if (!booking) throw notFound("Booking not found", "BOOKING_NOT_FOUND");
    return this.cancelBookingRow(booking);
  }

  /** Staff cancel by id (authenticated). */
  async cancelBooking(bookingId: string): Promise<ServiceBookingRow> {
    const booking = await this.requireBooking(bookingId);
    return this.cancelBookingRow(booking);
  }

  private async cancelBookingRow(
    booking: ServiceBookingRow,
  ): Promise<ServiceBookingRow> {
    if (
      booking.status === SERVICE_BOOKING_STATUS.CANCELLED ||
      booking.status === SERVICE_BOOKING_STATUS.COMPLETED ||
      booking.status === SERVICE_BOOKING_STATUS.NO_SHOW
    ) {
      throw conflict("Booking cannot be cancelled", "BOOKING_NOT_CANCELLABLE");
    }

    await this.releaseSlotCapacity(
      booking.serviceItemId,
      booking.bookingDate,
      booking.bookingTime,
    );
    // Release a redeemed voucher only if it was counted (confirmed bookings).
    if (
      booking.couponId &&
      booking.status === SERVICE_BOOKING_STATUS.CONFIRMED
    ) {
      await this.decrementCouponUse(booking.couponId);
    }

    const [row] = await this.db
      .update(serviceBookings)
      .set({
        status: SERVICE_BOOKING_STATUS.CANCELLED,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(serviceBookings.id, booking.id))
      .returning();
    return row;
  }

  /** Staff transition a confirmed booking to completed or no_show. */
  async transition(
    bookingId: string,
    to: "completed" | "no_show",
  ): Promise<ServiceBookingRow> {
    const booking = await this.requireBooking(bookingId);
    if (booking.status !== SERVICE_BOOKING_STATUS.CONFIRMED) {
      throw conflict(
        "Only confirmed bookings can be completed or marked no-show",
        "BOOKING_INVALID_TRANSITION",
      );
    }
    const now = new Date();
    const patch =
      to === "completed"
        ? {
            status: SERVICE_BOOKING_STATUS.COMPLETED as ServiceBookingStatus,
            completedAt: now,
          }
        : {
            status: SERVICE_BOOKING_STATUS.NO_SHOW as ServiceBookingStatus,
            noShowAt: now,
          };
    const [row] = await this.db
      .update(serviceBookings)
      .set({ ...patch, updatedAt: now })
      .where(eq(serviceBookings.id, bookingId))
      .returning();
    return row;
  }

  // ── reads ────────────────────────────────────────────

  async getById(id: string): Promise<ServiceBookingRow> {
    return this.requireBooking(id);
  }

  async getByConfirmationCode(
    code: string,
    contactProof?: ServiceBookingContactProof,
  ): Promise<ServiceBookingRow | null> {
    const booking = await this.db
      .select()
      .from(serviceBookings)
      .where(eq(serviceBookings.confirmationCode, code.toUpperCase()))
      .get();
    if (booking) {
      assertContactProof(booking, contactProof);
    }
    return booking ?? null;
  }

  async listByRestaurant(filters: {
    restaurantId: string;
    date?: string;
    status?: ServiceBookingStatus;
  }): Promise<ServiceBookingRow[]> {
    const conditions = [eq(serviceBookings.restaurantId, filters.restaurantId)];
    if (filters.date) {
      conditions.push(eq(serviceBookings.bookingDate, filters.date));
    }
    if (filters.status) {
      conditions.push(eq(serviceBookings.status, filters.status));
    }
    return this.db
      .select()
      .from(serviceBookings)
      .where(and(...conditions))
      .all();
  }

  // ── internals ────────────────────────────────────────

  private async requireBooking(id: string): Promise<ServiceBookingRow> {
    const booking = await this.db
      .select()
      .from(serviceBookings)
      .where(eq(serviceBookings.id, id))
      .get();
    if (!booking) throw notFound("Booking not found", "BOOKING_NOT_FOUND");
    return booking;
  }

  private async requireSlot(
    serviceItemId: number,
    date: string,
    timeSlot: string,
  ): Promise<ServiceBookingSlotRow> {
    const slot = await this.db
      .select()
      .from(serviceBookingSlots)
      .where(
        and(
          eq(serviceBookingSlots.serviceItemId, serviceItemId),
          eq(serviceBookingSlots.date, date),
          eq(serviceBookingSlots.timeSlot, timeSlot),
        ),
      )
      .get();
    if (!slot) throw notFound("Slot not found", "SERVICE_SLOT_NOT_FOUND");
    return slot;
  }

  private async assertServiceBelongsToRestaurant(
    serviceItemId: number,
    restaurantId: string,
  ): Promise<void> {
    const service = await this.db
      .select({
        id: restaurantServiceItems.id,
        restaurantId: restaurantServiceItems.restaurantId,
      })
      .from(restaurantServiceItems)
      .where(eq(restaurantServiceItems.id, serviceItemId))
      .get();

    if (!service) {
      throw notFound("Service not found", "SERVICE_NOT_FOUND");
    }
    if (service.restaurantId !== restaurantId) {
      throw badRequest(
        "Service does not belong to this restaurant",
        "SERVICE_RESTAURANT_MISMATCH",
      );
    }
  }

  private async loadPayableBooking(id: string): Promise<ServiceBookingRow> {
    const booking = await this.requireBooking(id);
    if (booking.status !== SERVICE_BOOKING_STATUS.PENDING) {
      throw conflict("Booking is not awaiting payment", "BOOKING_NOT_PAYABLE");
    }
    return booking;
  }

  private async markConfirmed(
    booking: ServiceBookingRow,
    payment: {
      method: (typeof SERVICE_BOOKING_PAYMENT_METHOD)[keyof typeof SERVICE_BOOKING_PAYMENT_METHOD];
      amountPaidCents: number;
      paymentRef: string | null;
    },
  ): Promise<ServiceBookingRow> {
    if (booking.couponId) {
      await this.claimCouponUse(booking.couponId);
    }
    const now = new Date();
    const [row] = await this.db
      .update(serviceBookings)
      .set({
        status: SERVICE_BOOKING_STATUS.CONFIRMED,
        paymentStatus: SERVICE_BOOKING_PAYMENT_STATUS.PAID,
        paymentMethod: payment.method,
        amountPaidCents: payment.amountPaidCents,
        paymentRef: payment.paymentRef,
        confirmedAt: now,
        updatedAt: now,
      })
      .where(eq(serviceBookings.id, booking.id))
      .returning();
    return row;
  }

  private async priceVoucher(
    code: string,
    restaurantId: string,
    priceCents: number,
  ): Promise<{ couponId: number; discountCents: number }> {
    const couponService = new CouponService(this.env.DB, this.env);
    const result = await couponService.validateCoupon(
      code,
      restaurantId,
      priceCents / 100,
    );
    if (!result.valid || !result.coupon) {
      throw badRequest(
        result.error ?? "This voucher does not apply",
        "VOUCHER_NOT_APPLICABLE",
      );
    }
    const discountCents = Math.min(
      toCents(result.discountAmount ?? 0) ?? 0,
      priceCents,
    );
    if (discountCents <= 0) {
      throw badRequest(
        "This voucher does not apply to this service",
        "VOUCHER_NOT_APPLICABLE",
      );
    }
    return { couponId: result.coupon.id, discountCents };
  }

  private async reserveSlotCapacity(
    serviceItemId: number,
    date: string,
    timeSlot: string,
  ): Promise<void> {
    const claim = await this.d1
      .prepare(
        `UPDATE service_booking_slots
            SET current_bookings = current_bookings + 1,
                updated_at_ms = unixepoch('now') * 1000
          WHERE service_item_id = ? AND date = ? AND time_slot = ?
            AND is_available = 1
            AND current_bookings < max_capacity`,
      )
      .bind(serviceItemId, date, timeSlot)
      .run();

    // 0 changes = either no slot row (uncapped — allow) or the slot is full.
    if ((claim.meta?.changes ?? 0) === 0) {
      const slot = await this.db
        .select({ id: serviceBookingSlots.id })
        .from(serviceBookingSlots)
        .where(
          and(
            eq(serviceBookingSlots.serviceItemId, serviceItemId),
            eq(serviceBookingSlots.date, date),
            eq(serviceBookingSlots.timeSlot, timeSlot),
          ),
        )
        .get();
      if (slot) {
        throw conflict("This time slot is fully booked", "SERVICE_SLOT_FULL");
      }
    }
  }

  private async releaseSlotCapacity(
    serviceItemId: number,
    date: string,
    timeSlot: string,
  ): Promise<void> {
    await this.d1
      .prepare(
        `UPDATE service_booking_slots
            SET current_bookings = CASE
                  WHEN current_bookings > 0 THEN current_bookings - 1 ELSE 0 END,
                updated_at_ms = unixepoch('now') * 1000
          WHERE service_item_id = ? AND date = ? AND time_slot = ?`,
      )
      .bind(serviceItemId, date, timeSlot)
      .run();
  }

  private async claimCouponUse(couponId: number): Promise<void> {
    await this.d1
      .prepare(
        `UPDATE coupons
            SET used_count = coalesce(used_count, 0) + 1,
                updated_at_ms = unixepoch('now') * 1000
          WHERE id = ?
            AND (usage_limit IS NULL OR coalesce(used_count, 0) < usage_limit)`,
      )
      .bind(couponId)
      .run();
  }

  private async decrementCouponUse(couponId: number): Promise<void> {
    await this.d1
      .prepare(
        `UPDATE coupons
            SET used_count = CASE
                  WHEN coalesce(used_count, 0) > 0
                  THEN coalesce(used_count, 0) - 1 ELSE 0 END,
                updated_at_ms = unixepoch('now') * 1000
          WHERE id = ?`,
      )
      .bind(couponId)
      .run();
  }
}

// ── helpers ────────────────────────────────────────────

type ServiceAvailableHours = {
  start?: string;
  end?: string;
  days?: number[];
} | null;

function assertWithinServiceHours(
  availableHours: ServiceAvailableHours,
  date: string,
  time: string,
): void {
  if (!availableHours) return; // no constraint configured
  const { start, end, days } = availableHours;
  if (days && days.length > 0) {
    const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (!days.includes(dow)) {
      throw badRequest(
        "The service is not available on this day",
        "SERVICE_DAY_UNAVAILABLE",
      );
    }
  }
  if (start && time < start) {
    throw badRequest(
      "The selected time is before the service opens",
      "SERVICE_TIME_UNAVAILABLE",
    );
  }
  if (end && time > end) {
    throw badRequest(
      "The selected time is after the service closes",
      "SERVICE_TIME_UNAVAILABLE",
    );
  }
}

function enumerateDates(start: string, end: string): string[] {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw badRequest("Invalid date range", "DATE_REQUIRED");
  }
  if (startDate > endDate) {
    throw badRequest("startDate must be before endDate", "DATE_RANGE_INVALID");
  }

  const dates: string[] = [];
  for (
    const date = new Date(startDate);
    date <= endDate;
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    dates.push(date.toISOString().slice(0, 10));
  }
  return dates;
}

function assertContactProof(
  booking: ServiceBookingRow,
  contactProof: ServiceBookingContactProof | undefined,
): void {
  if (!contactProof) return;

  const phone = normalizePhone(contactProof.customerPhone);
  const email = normalizeEmail(contactProof.customerEmail);
  if (contactProof.requireContact && !phone && !email) {
    throw badRequest(
      "Booking phone or email is required",
      "SERVICE_BOOKING_CONTACT_REQUIRED",
    );
  }
  if (!phone && !email) return;

  const phoneMatches =
    phone !== "" && normalizePhone(booking.customerPhone) === phone;
  const emailMatches =
    email !== "" && normalizeEmail(booking.customerEmail) === email;
  if (!phoneMatches && !emailMatches) {
    throw forbidden(
      "Booking contact does not match",
      "SERVICE_BOOKING_CONTACT_MISMATCH",
    );
  }
}

function normalizePhone(value: string | null | undefined): string {
  return (value ?? "").replace(/[^\d+]/g, "");
}

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

// 16 bytes = 128 bits of entropy. The code doubles as the anonymous ownership
// proof for verify/cancel, so it must resist enumeration (not just be unique).
function generateConfirmationCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}
