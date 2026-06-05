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
  notFound,
} from "../../../shared/utils/api-error";
import { toCents } from "../../../shared/utils/money";
import { CreditService } from "../../credits/services/CreditService";

type ServiceBookingRow = typeof serviceBookings.$inferSelect;

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
  async cancelByConfirmationCode(code: string): Promise<ServiceBookingRow> {
    const booking = await this.getByConfirmationCode(code);
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

  async getByConfirmationCode(code: string): Promise<ServiceBookingRow | null> {
    const booking = await this.db
      .select()
      .from(serviceBookings)
      .where(eq(serviceBookings.confirmationCode, code.toUpperCase()))
      .get();
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

// 16 bytes = 128 bits of entropy. The code doubles as the anonymous ownership
// proof for verify/cancel, so it must resist enumeration (not just be unique).
function generateConfirmationCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}
