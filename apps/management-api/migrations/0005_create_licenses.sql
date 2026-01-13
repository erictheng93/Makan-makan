-- Migration: Create licenses table
-- Description: Track license generation and history

CREATE TABLE IF NOT EXISTS licenses (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  license_key TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL,  -- standard, professional, enterprise
  expires_at TEXT,
  revoked_at TEXT,
  revoke_reason TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_licenses_tenant_id ON licenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_licenses_license_key ON licenses(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_expires_at ON licenses(expires_at);
