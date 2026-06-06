-- Service bookings (預約服務的預約實例) + optional capacity slots.
-- In-app booking of a restaurant_service_items row, parallel to reservations.
-- 卷 = pricing-layer discount recorded on the booking (coupon_id + cents);
-- 代幣 = payment (amount_due_cents spent via CreditService). New tables only.

CREATE TABLE IF NOT EXISTS service_bookings (
  id TEXT PRIMARY KEY NOT NULL,
  restaurant_id TEXT NOT NULL,
  service_item_id INTEGER NOT NULL,
  service_name_snapshot TEXT NOT NULL,
  duration_minutes_snapshot INTEGER,
  price_cents_snapshot INTEGER NOT NULL DEFAULT 0,
  customer_id TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  booking_date TEXT NOT NULL,
  booking_time TEXT NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 1,
  employee_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  confirmation_code TEXT NOT NULL,
  special_requests TEXT,
  notes TEXT,
  coupon_id INTEGER,
  voucher_discount_cents INTEGER NOT NULL DEFAULT 0,
  amount_due_cents INTEGER NOT NULL DEFAULT 0,
  amount_paid_cents INTEGER NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'none',
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  payment_ref TEXT,
  confirmed_at_ms INTEGER,
  completed_at_ms INTEGER,
  cancelled_at_ms INTEGER,
  no_show_at_ms INTEGER,
  created_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  updated_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE cascade,
  FOREIGN KEY (service_item_id) REFERENCES restaurant_service_items(id) ON DELETE cascade,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS service_bookings_restaurant_status_date_idx
  ON service_bookings(restaurant_id, status, booking_date);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS service_bookings_service_date_time_idx
  ON service_bookings(service_item_id, booking_date, booking_time);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS service_bookings_confirmation_code_idx
  ON service_bookings(confirmation_code);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS service_bookings_customer_phone_idx
  ON service_bookings(customer_phone);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS service_booking_slots (
  id TEXT PRIMARY KEY NOT NULL,
  restaurant_id TEXT NOT NULL,
  service_item_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  max_capacity INTEGER NOT NULL,
  current_bookings INTEGER NOT NULL DEFAULT 0,
  is_available INTEGER NOT NULL DEFAULT 1,
  block_reason TEXT,
  created_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  updated_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE cascade,
  FOREIGN KEY (service_item_id) REFERENCES restaurant_service_items(id) ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS service_booking_slots_unique_idx
  ON service_booking_slots(service_item_id, date, time_slot);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS service_booking_slots_restaurant_date_idx
  ON service_booking_slots(restaurant_id, date);
