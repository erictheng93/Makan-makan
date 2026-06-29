-- Migration: Create tenants table
-- Description: Main table for platform-managed tenant management

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  business_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,

  -- Deployment info
  subdomain TEXT UNIQUE NOT NULL,
  custom_domain TEXT,
  deployed_version TEXT,

  -- License info
  license_tier TEXT NOT NULL DEFAULT 'standard',  -- standard, professional, enterprise
  license_key TEXT NOT NULL,
  license_expires_at TEXT,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, provisioning, active, suspended, terminated

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  activated_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_license_tier ON tenants(license_tier);
CREATE INDEX IF NOT EXISTS idx_tenants_created_at ON tenants(created_at);
