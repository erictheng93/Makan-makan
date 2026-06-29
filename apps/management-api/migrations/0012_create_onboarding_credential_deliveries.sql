-- Migration: Create onboarding credential deliveries table
-- Description: Tracks owner setup-password credential handoff after approval.

CREATE TABLE IF NOT EXISTS onboarding_credential_deliveries (
  id TEXT PRIMARY KEY,
  application_id TEXT NOT NULL REFERENCES onboarding_applications(id),
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  restaurant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  username TEXT NOT NULL,
  setup_password_link TEXT NOT NULL,
  setup_password_expires_at TEXT NOT NULL,
  delivery_channel TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(application_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_credential_deliveries_application
  ON onboarding_credential_deliveries(application_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_credential_deliveries_status
  ON onboarding_credential_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_credential_deliveries_recipient
  ON onboarding_credential_deliveries(recipient_email);
