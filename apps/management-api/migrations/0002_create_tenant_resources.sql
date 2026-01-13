-- Migration: Create tenant_resources table
-- Description: Track Cloudflare resources provisioned for each tenant

CREATE TABLE IF NOT EXISTS tenant_resources (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,  -- d1, kv, r2, worker, page
  resource_name TEXT NOT NULL,
  resource_id TEXT,  -- Cloudflare resource ID
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, creating, ready, error, deleted
  error_message TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenant_resources_tenant_id ON tenant_resources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_resources_type ON tenant_resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_tenant_resources_status ON tenant_resources(status);
