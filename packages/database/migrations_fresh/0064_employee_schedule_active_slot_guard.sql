CREATE TRIGGER IF NOT EXISTS employee_schedules_active_slot_guard_bi
BEFORE INSERT ON employee_schedules
WHEN NEW.deleted_at_ms IS NULL
  AND NEW.status IN ('scheduled', 'confirmed')
  AND EXISTS (
    SELECT 1
      FROM employee_schedules existing
     WHERE existing.employee_id = NEW.employee_id
       AND existing.work_date = NEW.work_date
       AND existing.start_time = NEW.start_time
       AND existing.end_time = NEW.end_time
       AND existing.deleted_at_ms IS NULL
       AND existing.status IN ('scheduled', 'confirmed')
  )
BEGIN
  SELECT RAISE(ABORT, 'duplicate active employee schedule slot');
END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS employee_schedules_active_slot_guard_bu
BEFORE UPDATE OF employee_id, work_date, start_time, end_time, status, deleted_at_ms
ON employee_schedules
WHEN NEW.deleted_at_ms IS NULL
  AND NEW.status IN ('scheduled', 'confirmed')
  AND EXISTS (
    SELECT 1
      FROM employee_schedules existing
     WHERE existing.id != NEW.id
       AND existing.employee_id = NEW.employee_id
       AND existing.work_date = NEW.work_date
       AND existing.start_time = NEW.start_time
       AND existing.end_time = NEW.end_time
       AND existing.deleted_at_ms IS NULL
       AND existing.status IN ('scheduled', 'confirmed')
  )
BEGIN
  SELECT RAISE(ABORT, 'duplicate active employee schedule slot');
END;
