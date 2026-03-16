-- Tracks which migrations have been applied to each tenant's D1 database
CREATE TABLE IF NOT EXISTS tenant_migrations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id),
  migration_name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now')),
  success INTEGER NOT NULL DEFAULT 1,
  error_message TEXT,
  UNIQUE(tenant_id, migration_name)
);

CREATE INDEX IF NOT EXISTS idx_tenant_migrations_tenant ON tenant_migrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_migrations_name ON tenant_migrations(migration_name);
