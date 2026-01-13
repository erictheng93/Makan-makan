-- Migration: Create deployment_logs table
-- Description: Track deployment history for each tenant

CREATE TABLE IF NOT EXISTS deployment_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  deployment_type TEXT NOT NULL,  -- initial, update, rollback
  from_version TEXT,
  to_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, in_progress, completed, failed, rolled_back
  logs TEXT,  -- JSON array of log entries

  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,

  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_deployment_logs_tenant_id ON deployment_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_status ON deployment_logs(status);
CREATE INDEX IF NOT EXISTS idx_deployment_logs_started_at ON deployment_logs(started_at);
