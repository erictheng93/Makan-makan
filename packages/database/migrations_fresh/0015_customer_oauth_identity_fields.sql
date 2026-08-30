-- OAuth (LINE / Google / Apple) support on the existing identity table.
--
-- The Phase 1 spec anticipated a separate `customer_oauth_identities` table,
-- but `customer_auth_identities` was already built for this: `provider` is free
-- text with no CHECK, `(provider, provider_uid)` is already UNIQUE, and the
-- one-password-per-customer constraint was deliberately scoped with
-- `WHERE provider = 'password'` — a clause with no reason to exist if the table
-- were only ever going to hold passwords. `encrypted_payload` has been present
-- and unwritten since the baseline.
--
-- Splitting federated identities into a second table would put the global
-- uniqueness of `(provider, provider_uid)` beyond the reach of any single index
-- and give the login path two lookups instead of one. Extending is also the
-- cheaper migration: ADD COLUMN preserves STRICT, so no table rebuild is needed.
--
-- Every column is nullable, so existing `'password'` rows are unaffected.

ALTER TABLE `customer_auth_identities` ADD COLUMN `provider_email` text;
ALTER TABLE `customer_auth_identities` ADD COLUMN `provider_email_verified` integer;
ALTER TABLE `customer_auth_identities` ADD COLUMN `provider_display_name` text;
ALTER TABLE `customer_auth_identities` ADD COLUMN `provider_avatar_url` text;
ALTER TABLE `customer_auth_identities` ADD COLUMN `scopes` text;
ALTER TABLE `customer_auth_identities` ADD COLUMN `token_expires_at_ms` integer;
ALTER TABLE `customer_auth_identities` ADD COLUMN `revoked_at_ms` integer;

-- One live link per provider per customer. Unlinking sets `revoked_at_ms`
-- rather than deleting the row, so the audit trail survives and the customer
-- can re-link the same provider later without colliding with their own history.
--
-- Existing rows all have `revoked_at_ms IS NULL`, so this index applies to them
-- immediately. That is safe: the only provider in the table today is
-- 'password', and `customer_auth_identities_one_password_idx` already enforces
-- at most one such row per customer.
CREATE UNIQUE INDEX `customer_auth_identities_customer_provider_live_idx`
  ON `customer_auth_identities` (`customer_id`, `provider`)
  WHERE `revoked_at_ms` IS NULL;

-- Login looks up a live identity by provider + subject on every OAuth callback.
-- The existing `customer_auth_identities_provider_uid_idx` covers the lookup,
-- but not the liveness filter, so partial-index it here rather than making the
-- callback read revoked rows and discard them.
CREATE INDEX `customer_auth_identities_live_provider_idx`
  ON `customer_auth_identities` (`provider`, `provider_uid`)
  WHERE `revoked_at_ms` IS NULL;
