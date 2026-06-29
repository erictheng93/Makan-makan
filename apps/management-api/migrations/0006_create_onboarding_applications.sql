-- Migration: Create onboarding_applications table
-- Description: Tracks self-service onboarding applications before they become tenants

CREATE TABLE IF NOT EXISTS onboarding_applications (
  id TEXT PRIMARY KEY,                              -- APP-YYYYMMDD-XXX format
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  plan_id TEXT NOT NULL DEFAULT 'standard',         -- standard, professional, enterprise

  -- Subdomain handling
  requested_subdomain TEXT,                         -- User's preferred subdomain
  assigned_subdomain TEXT UNIQUE,                   -- Final assigned subdomain

  -- Application status
  status TEXT NOT NULL DEFAULT 'submitted',         -- submitted, provisioning, completed, rejected

  -- Relationship to tenant (after completion)
  tenant_id TEXT REFERENCES tenants(id),

  -- Request metadata
  ip_address TEXT,
  user_agent TEXT,

  -- Timestamps
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  submitted_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_onboarding_status ON onboarding_applications(status);
CREATE INDEX IF NOT EXISTS idx_onboarding_email ON onboarding_applications(contact_email);
CREATE INDEX IF NOT EXISTS idx_onboarding_subdomain ON onboarding_applications(assigned_subdomain);
CREATE INDEX IF NOT EXISTS idx_onboarding_created_at ON onboarding_applications(created_at);
