-- Extend audit_logs with on-behalf-of tracking for manager delegation
-- (M1 release gate). The column is nullable so existing direct-action
-- rows remain valid.
ALTER TABLE audit_logs
  ADD COLUMN on_behalf_of_user_id TEXT REFERENCES users(id);

CREATE INDEX IF NOT EXISTS audit_logs_on_behalf_of_idx
  ON audit_logs(on_behalf_of_user_id, created_at_ms);
