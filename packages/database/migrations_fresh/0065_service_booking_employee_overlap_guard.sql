CREATE TRIGGER IF NOT EXISTS service_bookings_employee_overlap_guard_bi
BEFORE INSERT ON service_bookings
WHEN NEW.employee_id IS NOT NULL
  AND NEW.status IN ('pending', 'confirmed')
  AND EXISTS (
    SELECT 1
      FROM service_bookings existing
     WHERE existing.employee_id = NEW.employee_id
       AND existing.booking_date = NEW.booking_date
       AND existing.status IN ('pending', 'confirmed')
       AND time(NEW.booking_time) < time(
             existing.booking_time,
             '+' || coalesce(existing.duration_minutes_snapshot, 0) || ' minutes'
           )
       AND time(existing.booking_time) < time(
             NEW.booking_time,
             '+' || coalesce(NEW.duration_minutes_snapshot, 0) || ' minutes'
           )
  )
BEGIN
  SELECT RAISE(ABORT, 'overlapping active employee service booking');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS service_bookings_employee_overlap_guard_bu
BEFORE UPDATE OF employee_id, booking_date, booking_time, duration_minutes_snapshot, status
ON service_bookings
WHEN NEW.employee_id IS NOT NULL
  AND NEW.status IN ('pending', 'confirmed')
  AND EXISTS (
    SELECT 1
      FROM service_bookings existing
     WHERE existing.id != NEW.id
       AND existing.employee_id = NEW.employee_id
       AND existing.booking_date = NEW.booking_date
       AND existing.status IN ('pending', 'confirmed')
       AND time(NEW.booking_time) < time(
             existing.booking_time,
             '+' || coalesce(existing.duration_minutes_snapshot, 0) || ' minutes'
           )
       AND time(existing.booking_time) < time(
             NEW.booking_time,
             '+' || coalesce(NEW.duration_minutes_snapshot, 0) || ' minutes'
           )
  )
BEGIN
  SELECT RAISE(ABORT, 'overlapping active employee service booking');
END;
