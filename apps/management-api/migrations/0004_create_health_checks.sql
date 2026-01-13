-- Migration: Create health_checks table
-- Description: Store health check results for tenant monitoring

CREATE TABLE IF NOT EXISTS health_checks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  status TEXT NOT NULL,  -- healthy, degraded, down
  response_time_ms INTEGER,
  details TEXT,  -- JSON object with component status

  checked_at TEXT NOT NULL DEFAULT (datetime('now')),

  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_health_checks_tenant_id ON health_checks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_health_checks_status ON health_checks(status);
CREATE INDEX IF NOT EXISTS idx_health_checks_checked_at ON health_checks(checked_at);

-- Composite index for recent checks by tenant
CREATE INDEX IF NOT EXISTS idx_health_checks_tenant_checked ON health_checks(tenant_id, checked_at DESC);
