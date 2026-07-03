-- Harden payment idempotency and move backup time fields to millisecond
-- integer timestamps. Legacy TEXT time columns are retained for rollback and
-- historical compatibility; the Drizzle schema now reads/writes the *_ms
-- columns.

DROP INDEX IF EXISTS payment_transactions_idempotency_idx;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS payment_transactions_idempotency_unique_idx
  ON payment_transactions(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
--> statement-breakpoint

DROP INDEX IF EXISTS market_checkout_payments_idempotency_idx;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS market_checkout_payments_idempotency_unique_idx
  ON market_checkout_payments(idempotency_key)
  WHERE idempotency_key IS NOT NULL;
--> statement-breakpoint

DROP INDEX IF EXISTS idx_backup_records_started_at;
DROP INDEX IF EXISTS idx_backup_alerts_triggered_at;
DROP INDEX IF EXISTS idx_backup_audit_logs_timestamp;
--> statement-breakpoint

ALTER TABLE backup_records ADD COLUMN started_at_ms INTEGER;
ALTER TABLE backup_records ADD COLUMN completed_at_ms INTEGER;
ALTER TABLE backup_records ADD COLUMN updated_at_ms INTEGER;
--> statement-breakpoint
UPDATE backup_records
SET
  started_at_ms = CASE
    WHEN started_at IS NULL THEN NULL
    WHEN typeof(started_at) = 'integer' THEN started_at
    WHEN started_at GLOB '[0-9]*' THEN CAST(started_at AS INTEGER)
    ELSE CAST(strftime('%s', started_at) AS INTEGER) * 1000
  END,
  completed_at_ms = CASE
    WHEN completed_at IS NULL THEN NULL
    WHEN typeof(completed_at) = 'integer' THEN completed_at
    WHEN completed_at GLOB '[0-9]*' THEN CAST(completed_at AS INTEGER)
    ELSE CAST(strftime('%s', completed_at) AS INTEGER) * 1000
  END,
  updated_at_ms = CASE
    WHEN updated_at IS NULL THEN unixepoch('now') * 1000
    WHEN typeof(updated_at) = 'integer' THEN updated_at
    WHEN updated_at GLOB '[0-9]*' THEN CAST(updated_at AS INTEGER)
    ELSE CAST(strftime('%s', updated_at) AS INTEGER) * 1000
  END;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_backup_records_started_at
  ON backup_records(started_at_ms);
--> statement-breakpoint

ALTER TABLE backup_schedules ADD COLUMN last_run_at_ms INTEGER;
ALTER TABLE backup_schedules ADD COLUMN next_run_at_ms INTEGER;
ALTER TABLE backup_schedules ADD COLUMN created_at_ms INTEGER;
ALTER TABLE backup_schedules ADD COLUMN updated_at_ms INTEGER;
--> statement-breakpoint
UPDATE backup_schedules
SET
  last_run_at_ms = CASE
    WHEN last_run_at IS NULL THEN NULL
    WHEN typeof(last_run_at) = 'integer' THEN last_run_at
    WHEN last_run_at GLOB '[0-9]*' THEN CAST(last_run_at AS INTEGER)
    ELSE CAST(strftime('%s', last_run_at) AS INTEGER) * 1000
  END,
  next_run_at_ms = CASE
    WHEN next_run_at IS NULL THEN NULL
    WHEN typeof(next_run_at) = 'integer' THEN next_run_at
    WHEN next_run_at GLOB '[0-9]*' THEN CAST(next_run_at AS INTEGER)
    ELSE CAST(strftime('%s', next_run_at) AS INTEGER) * 1000
  END,
  created_at_ms = CASE
    WHEN created_at IS NULL THEN unixepoch('now') * 1000
    WHEN typeof(created_at) = 'integer' THEN created_at
    WHEN created_at GLOB '[0-9]*' THEN CAST(created_at AS INTEGER)
    ELSE CAST(strftime('%s', created_at) AS INTEGER) * 1000
  END,
  updated_at_ms = CASE
    WHEN updated_at IS NULL THEN unixepoch('now') * 1000
    WHEN typeof(updated_at) = 'integer' THEN updated_at
    WHEN updated_at GLOB '[0-9]*' THEN CAST(updated_at AS INTEGER)
    ELSE CAST(strftime('%s', updated_at) AS INTEGER) * 1000
  END;
--> statement-breakpoint

ALTER TABLE backup_configurations ADD COLUMN created_at_ms INTEGER;
ALTER TABLE backup_configurations ADD COLUMN updated_at_ms INTEGER;
--> statement-breakpoint
UPDATE backup_configurations
SET
  created_at_ms = CASE
    WHEN created_at IS NULL THEN unixepoch('now') * 1000
    WHEN typeof(created_at) = 'integer' THEN created_at
    WHEN created_at GLOB '[0-9]*' THEN CAST(created_at AS INTEGER)
    ELSE CAST(strftime('%s', created_at) AS INTEGER) * 1000
  END,
  updated_at_ms = CASE
    WHEN updated_at IS NULL THEN unixepoch('now') * 1000
    WHEN typeof(updated_at) = 'integer' THEN updated_at
    WHEN updated_at GLOB '[0-9]*' THEN CAST(updated_at AS INTEGER)
    ELSE CAST(strftime('%s', updated_at) AS INTEGER) * 1000
  END;
--> statement-breakpoint

ALTER TABLE backup_alerts ADD COLUMN triggered_at_ms INTEGER;
ALTER TABLE backup_alerts ADD COLUMN resolved_at_ms INTEGER;
--> statement-breakpoint
UPDATE backup_alerts
SET
  triggered_at_ms = CASE
    WHEN triggered_at IS NULL THEN NULL
    WHEN typeof(triggered_at) = 'integer' THEN triggered_at
    WHEN triggered_at GLOB '[0-9]*' THEN CAST(triggered_at AS INTEGER)
    ELSE CAST(strftime('%s', triggered_at) AS INTEGER) * 1000
  END,
  resolved_at_ms = CASE
    WHEN resolved_at IS NULL THEN NULL
    WHEN typeof(resolved_at) = 'integer' THEN resolved_at
    WHEN resolved_at GLOB '[0-9]*' THEN CAST(resolved_at AS INTEGER)
    ELSE CAST(strftime('%s', resolved_at) AS INTEGER) * 1000
  END;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_backup_alerts_triggered_at
  ON backup_alerts(triggered_at_ms);
--> statement-breakpoint

ALTER TABLE backup_audit_logs ADD COLUMN timestamp_ms INTEGER;
--> statement-breakpoint
UPDATE backup_audit_logs
SET timestamp_ms = CASE
  WHEN timestamp IS NULL THEN NULL
  WHEN typeof(timestamp) = 'integer' THEN timestamp
  WHEN timestamp GLOB '[0-9]*' THEN CAST(timestamp AS INTEGER)
  ELSE CAST(strftime('%s', timestamp) AS INTEGER) * 1000
END;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_backup_audit_logs_timestamp
  ON backup_audit_logs(timestamp_ms);
--> statement-breakpoint

ALTER TABLE restore_operations ADD COLUMN started_at_ms INTEGER;
ALTER TABLE restore_operations ADD COLUMN completed_at_ms INTEGER;
--> statement-breakpoint
UPDATE restore_operations
SET
  started_at_ms = CASE
    WHEN started_at IS NULL THEN NULL
    WHEN typeof(started_at) = 'integer' THEN started_at
    WHEN started_at GLOB '[0-9]*' THEN CAST(started_at AS INTEGER)
    ELSE CAST(strftime('%s', started_at) AS INTEGER) * 1000
  END,
  completed_at_ms = CASE
    WHEN completed_at IS NULL THEN NULL
    WHEN typeof(completed_at) = 'integer' THEN completed_at
    WHEN completed_at GLOB '[0-9]*' THEN CAST(completed_at AS INTEGER)
    ELSE CAST(strftime('%s', completed_at) AS INTEGER) * 1000
  END;
