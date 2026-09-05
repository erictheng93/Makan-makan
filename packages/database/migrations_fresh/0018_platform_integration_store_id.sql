-- Lift the platform-side store id out of the encrypted blob (#338).
--
-- `POST /api/v1/integrations/webhooks/uber-eats` is unauthenticated by design:
-- a delivery platform cannot hold a session. To find out which integration a
-- webhook belongs to, the route read every enabled uber_eats row and decrypted
-- each one, because the only copy of `storeId` lived inside the encrypted
-- `credentials` payload. Comparing the decrypted `storeId` was the whole point
-- of the fan-out, and the HMAC signature check ran only afterwards -- so any
-- stranger's POST decrypted every tenant's credentials before anything
-- authenticated them.
--
-- That was cheap while credentials used a bare SHA-256 as the AES key. #300
-- moved them onto PBKDF2 at 100,000 iterations, which made each row ~171x more
-- expensive and turned an O(all tenants) pre-auth fan-out into a real
-- unauthenticated CPU-amplification vector.
--
-- `store_id` is not a secret: it arrives in the untrusted webhook payload, it
-- is a URL path segment in the Uber Eats menu API, and it is none of the four
-- categories CLAUDE.md requires to be encrypted. The actual secrets --
-- clientId, clientSecret, webhookSecret -- stay inside `credentials`.
--
-- ADD COLUMN rather than a recreate: `platform_integrations` is already STRICT
-- in the baseline, and TEXT is a STRICT-legal column type, so this needs no
-- `__new_*` staging table and cannot silently drop the STRICT option.
--
-- No backfill. Production `platform_integrations` holds 0 rows (measured
-- 2026-09-05), which is the same "do it while the table is empty" window #300
-- used. A backfill would be impossible anyway: the value it would copy is
-- inside the ciphertext. Any pre-existing local row migrates by reconnecting
-- the platform, which is already the required path since #300 retired the old
-- credential format.
ALTER TABLE `platform_integrations` ADD COLUMN `store_id` TEXT;
--> statement-breakpoint
-- One platform store maps to at most one integration, so a webhook resolves to
-- a single row. Partial, so rows predating the column are not forced to
-- collide on NULL.
CREATE UNIQUE INDEX `platform_integrations_platform_store_idx`
  ON `platform_integrations` (`platform`, `store_id`)
  WHERE `store_id` IS NOT NULL;
