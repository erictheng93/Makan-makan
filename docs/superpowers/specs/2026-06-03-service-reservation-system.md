# Spec: Service Reservation (預約服務) System — Design

## Objective

Let a customer **book a bookable service** (a `restaurant_service_items` row —
e.g. a stall experience, a rental, a consultation, an activity) for a specific
date/time, in-app, instead of being bounced to an external `booking_url`. This
closes the largest gap to the night-market vision's "預約服務" half (the food
side — ordering — already works; dining-table booking already works; only
**service booking** is missing).

This is the design spec. Full implementation is a follow-up build, sliced like
the voucher feature (service → availability → routes → tests).

## Current state (ground truth)

- **`restaurant_service_items`** (catalog, integer PK): `serviceType`
  (general/booking/pickup/delivery/consultation/rental/activity), `priceCents`,
  `durationMinutes`, `requiresBooking` (bool), `availableHours`
  (`{start?, end?, days?: number[]}`), `bookingUrl` (external escape hatch),
  `isActive`/`isPublic`. **No booking-instance table.**
- **`employee_availability`** (staff schedules): recurring (dayOfWeek + start/end)
  or specific-date, `preferenceType` (preferred/available/unavailable),
  `employeeId → users.id`. **Exists but not linked to services.**
- **`reservations`** (dining-table booking): full lifecycle
  (pending→confirmed→arrived→seated→completed/cancelled/no_show),
  `confirmationCode`, `reservationSlots` (capacity per date+timeSlot). This is the
  **template** to mirror — but it is table/party-size shaped, not service shaped,
  so service booking gets its own table rather than overloading it.

## Locked decisions (surfaced assumptions — object now if wrong)

1. **New `service_bookings` table**, parallel to `reservations` (do not overload
   `reservations`, which is party-size/table shaped). PK = TEXT UUID v7 (consistent
   with markets/customers/reservations).
2. **Identity = reservations precedent.** `customerName` + `customerPhone`
   required, `customerId → customers.id` optional (guest or registered). No new
   login requirement. Consistent with how `reservations` and guest orders already
   work.
3. **Staff assignment is OPTIONAL for MVP.** Bookings are validated against the
   **service's** `availableHours` + a per-service slot capacity. `employeeId`
   (→ users.id) is a nullable column reserved for a later phase that consults
   `employee_availability`; MVP does not require or compute staff availability.
4. **Payment wired from day 1 (user decision 2026-06-03), no real acquirer.**
   A booking is created `pending`, then:
   - **卷 (voucher)** = pricing-layer discount on the booking price (reuses the
     single-shop `CouponService.validateCoupon`; `coupons.used_count` incremented
     at confirmation — NOT a `coupon_usage` row, since a booking is not an order).
   - **代幣 (credits)** = payment of the (discounted) `amountDueCents` via
     `CreditService.spend` (sourceType `service_booking`); success → `confirmed`.
   - **cash / none** = pay-at-venue; staff `confirmCash` → `confirmed`.
   No deposit/prepay, no mixed credits+cash (credits pay full or fail, per the
   credits design).
5. **Duration comes from the service** (`durationMinutes`); the booking stores a
   snapshot so later catalog edits don't move existing bookings.
6. **Availability = service hours + capacity**, not tables. A lightweight
   `service_booking_slots` (date + timeSlot + service) tracks `maxCapacity` /
   `currentBookings`, mirroring `reservationSlots`. If no slot rows exist for a
   service, availability falls back to the service's `availableHours` with a
   configurable default capacity.

## Data (new)

`service_bookings` (UUID v7 PK):

```
id, restaurantId (→restaurants.id), serviceItemId (→restaurant_service_items.id),
serviceNameSnapshot, durationMinutesSnapshot, priceCentsSnapshot,
customerId (→customers.id, nullable), customerName, customerPhone, customerEmail?,
bookingDate (YYYY-MM-DD), bookingTime (HH:MM),
partySize (default 1), employeeId (→users.id, nullable, reserved),
status (pending|confirmed|completed|cancelled|no_show),
confirmationCode, specialRequests?, notes?,
confirmedAt?/completedAt?/cancelledAt?/noShowAt?,
paymentMethod? (cash|credits|voucher|none), paymentRef?,
createdAt, updatedAt
```

`service_booking_slots` (optional capacity control, mirrors `reservationSlots`):

```
id, restaurantId, serviceItemId, date, timeSlot,
maxCapacity, currentBookings (default 0), isAvailable (default 1), blockReason?,
createdAt, updatedAt
```

Migration: hand-written sequential SQL in `migrations_fresh` per
[[db_migration_workflow]] (next free number). Additive only. No FK/type drift.

## API (mirror `features/reservations/routes`)

Public (customer):
- `GET  /api/v1/service-bookings/availability?serviceItemId&date` — open slots for
  a service on a date (capacity-aware; falls back to `availableHours`).
- `POST /api/v1/service-bookings` — create a `pending` booking (validates the
  service is active/public + `requiresBooking`, the date/time is within
  `availableHours`, and slot capacity remains). Returns `confirmationCode`.
- `POST /api/v1/service-bookings/:id/pay` — pay the discounted amount with 代幣
  (credits); success confirms the booking.
- `GET  /api/v1/service-bookings/verify/:code` — look up by confirmation code
  (rate-limited).
- `POST /api/v1/service-bookings/verify/:code/cancel` — customer cancel
  (rate-limited). **The confirmation code is the ownership proof — cancel by id
  is NOT a public route (would be an IDOR).**

Staff/admin (`authMiddleware` + `requireRole`):
- `GET  /api/v1/service-bookings` (list/filter by restaurant/date/status),
  `GET /:id`, `DELETE /:id` (cancel), `POST /:id/confirm-cash|complete|no-show`.
  (`/slots` capacity management is a follow-up.)

Roles reuse the reservations matrix (owner/admin/cashier manage; service crew can
confirm/complete).

**Security (from automated review, 2026-06-03):** the confirmation code is a
128-bit (16-byte) random token — it doubles as the anonymous ownership credential
for verify/cancel, so it must resist enumeration, not merely be unique. Verify and
cancel are rate-limited. A second factor (booking phone/email) on verify is a
documented future hardening.

## Discovery integration

`restaurant_service_items` is already indexed by the discovery search
(`/discovery/services`). Add a `bookable` signal (derived from
`requiresBooking && !bookingUrl`) so search results can deep-link to the in-app
booking flow instead of the external URL.

## Verification

- Unit: availability computation (hours window, capacity exhaustion, slot vs
  fallback), confirmation-code generation, status transitions.
- Real-D1 integration: create booking → capacity decrement → double-book past
  capacity rejected; cancel restores capacity; verify-by-code; lifecycle
  transitions; guest vs registered identity.
- Gates: `pnpm --filter @makanmasak/api typecheck`, lint, new service/route tests.

## Boundaries

- Never: require login to book (guest identity must work).
- Never: touch the `reservations` (dining) tables — service booking is separate.
- Ask first: staff-assignment scheduling (links `employee_availability`),
  deposits/prepay, recurring bookings, waitlists.
- Ask first: any real payment acquirer (out of scope while MVP is token/voucher).

## Out of scope (MVP)

- Staff availability matching + assignment (column reserved, logic deferred).
- Deposits, prepayment, cancellation fees.
- Recurring/multi-session bookings, waitlists, reminders.
- Calendar sync / ICS.

## Resolved (2026-06-03)

- Payment **wired from day 1** (代幣 + 卷), per user decision — see decision #4.
- A booking stays `pending` on creation and becomes `confirmed` on **payment**
  (credits) or staff `confirmCash` (pay-at-venue). No separate auto-confirm.
- **Staff selection deferred** (decision #3): MVP uses service-level capacity;
  `employeeId` column is reserved for the later staff-availability phase.

## Still open

1. Should service crew (role 3) be able to create/confirm bookings, or only
   owner/cashier? (Routes will default to the reservations role matrix.)
