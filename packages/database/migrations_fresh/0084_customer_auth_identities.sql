CREATE TABLE `customer_auth_identities` (
  `id` text PRIMARY KEY NOT NULL,
  `customer_id` text NOT NULL,
  `provider` text NOT NULL,
  `provider_uid` text NOT NULL,
  `secret_hash` text,
  `encrypted_payload` text,
  `verified_at_ms` integer,
  `last_used_at_ms` integer,
  `created_at_ms` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  `updated_at_ms` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_auth_identities_provider_uid_idx`
  ON `customer_auth_identities` (`provider`, `provider_uid`);
--> statement-breakpoint
CREATE INDEX `customer_auth_identities_customer_idx`
  ON `customer_auth_identities` (`customer_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_auth_identities_one_password_idx`
  ON `customer_auth_identities` (`customer_id`) WHERE `provider` = 'password';
--> statement-breakpoint

CREATE TABLE `customer_verification_tokens` (
  `id` text PRIMARY KEY NOT NULL,
  `customer_id` text,
  `purpose` text NOT NULL,
  `identifier` text NOT NULL,
  `token_hash` text NOT NULL,
  `expires_at_ms` integer NOT NULL,
  `used_at_ms` integer,
  `ip_address` text,
  `created_at_ms` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
  FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customer_verification_tokens_hash_idx`
  ON `customer_verification_tokens` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `customer_verification_tokens_lookup_idx`
  ON `customer_verification_tokens` (`identifier`, `purpose`, `created_at_ms`);
--> statement-breakpoint

-- Defensive no-op: as of 0084 no customer rows are expected to carry a
-- phone.
-- Kept because 0047 migrated role=5 users into `customers` with their phone,
-- so
-- any historical deployment may hold rows that would otherwise lose the
-- ability
-- to sign in once auth reads from customer_auth_identities.
-- OR IGNORE absorbs any (provider, provider_uid) collision without failing
-- the
-- migration. The generated id is not UUID v7 — D1 has no v7 primitive — but
-- it
-- is unique and only ever applies to pre-0084 rows.
INSERT OR IGNORE INTO `customer_auth_identities`
  (`id`, `customer_id`, `provider`, `provider_uid`, `verified_at_ms`,
`created_at_ms`, `updated_at_ms`)
SELECT lower(hex(randomblob(16))), `id`, 'phone', `primary_phone`,
`created_at_ms`, `created_at_ms`, `created_at_ms`
FROM `customers`
WHERE `primary_phone` IS NOT NULL AND `deleted_at_ms` IS NULL;
