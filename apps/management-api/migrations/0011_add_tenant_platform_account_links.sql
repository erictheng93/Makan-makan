-- Migration: Link management tenants to platform restaurant and owner records
-- Description: Stores the account provisioned in the platform API database
-- during onboarding approval.

ALTER TABLE tenants ADD COLUMN platform_restaurant_id TEXT;
ALTER TABLE tenants ADD COLUMN owner_user_id TEXT;
ALTER TABLE tenants ADD COLUMN owner_username TEXT;

CREATE INDEX IF NOT EXISTS idx_tenants_platform_restaurant_id
  ON tenants(platform_restaurant_id);
CREATE INDEX IF NOT EXISTS idx_tenants_owner_user_id
  ON tenants(owner_user_id);
