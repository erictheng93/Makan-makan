-- Service booking production extensions:
-- deposit/prepayment semantics, reminder scheduling, recurrence metadata,
-- calendar export UID, and a non-capacity-consuming waitlist.

ALTER TABLE service_bookings ADD COLUMN payment_requirement TEXT NOT NULL DEFAULT 'prepay';
--> statement-breakpoint
ALTER TABLE service_bookings ADD COLUMN deposit_required_cents INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE service_bookings ADD COLUMN balance_due_cents INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE service_bookings ADD COLUMN reminder_opt_in INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE service_bookings ADD COLUMN reminder_minutes_before INTEGER;
--> statement-breakpoint
ALTER TABLE service_bookings ADD COLUMN reminder_scheduled_at_ms INTEGER;
--> statement-breakpoint
ALTER TABLE service_bookings ADD COLUMN reminder_sent_at_ms INTEGER;
--> statement-breakpoint
ALTER TABLE service_bookings ADD COLUMN calendar_uid TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE service_bookings ADD COLUMN recurrence_group_id TEXT;
--> statement-breakpoint
ALTER TABLE service_bookings ADD COLUMN recurrence_index INTEGER;
--> statement-breakpoint
ALTER TABLE service_bookings ADD COLUMN recurrence_count INTEGER;
--> statement-breakpoint

UPDATE service_bookings
SET calendar_uid = id || '@makanmakan.service-bookings'
WHERE calendar_uid = '';
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS service_bookings_reminder_due_idx
  ON service_bookings(reminder_scheduled_at_ms, reminder_sent_at_ms, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS service_bookings_recurrence_group_idx
  ON service_bookings(recurrence_group_id);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS service_booking_waitlist (
  id TEXT PRIMARY KEY NOT NULL,
  restaurant_id TEXT NOT NULL,
  service_item_id INTEGER NOT NULL,
  customer_id TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  booking_date TEXT NOT NULL,
  booking_time TEXT NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 1,
  employee_id INTEGER,
  status TEXT NOT NULL DEFAULT 'waiting',
  special_requests TEXT,
  notes TEXT,
  notified_at_ms INTEGER,
  converted_booking_id TEXT,
  created_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  updated_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE cascade,
  FOREIGN KEY (service_item_id) REFERENCES restaurant_service_items(id) ON DELETE cascade,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (converted_booking_id) REFERENCES service_bookings(id) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS service_booking_waitlist_service_time_idx
  ON service_booking_waitlist(service_item_id, booking_date, booking_time, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS service_booking_waitlist_restaurant_status_idx
  ON service_booking_waitlist(restaurant_id, status, created_at_ms);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS service_booking_waitlist_customer_phone_idx
  ON service_booking_waitlist(customer_phone);
