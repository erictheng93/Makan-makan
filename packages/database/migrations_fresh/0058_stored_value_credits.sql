-- Stored-value credits (代幣) + voucher ownership (卷持有實例)
-- 代幣帳本：credit_accounts（負債本體 + 樂觀鎖）/ credit_cards（存取憑證）/
--           credit_ledger_entries（append-only 審計流水，idempotency_key 唯一防雙扣）
-- 卷：user_coupons（per-customer 持有實例，沿用既有 coupons / coupon_usage）
-- 全為新增表，不更動既有 schema。扣款一律走條件式 UPDATE + 樂觀鎖（見 service 層）。

CREATE TABLE IF NOT EXISTS credit_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  owner_customer_id TEXT,
  currency TEXT NOT NULL,
  balance_cents INTEGER NOT NULL DEFAULT 0,
  reserved_cents INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at_ms INTEGER,
  created_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  updated_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  FOREIGN KEY (owner_customer_id) REFERENCES customers(id) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_accounts_owner_currency
  ON credit_accounts(owner_customer_id, currency)
  WHERE owner_customer_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_credit_accounts_expiry_scan
  ON credit_accounts(status, expires_at_ms);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS credit_cards (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  public_id TEXT NOT NULL UNIQUE,
  secret_hash TEXT,
  pin_retry_count INTEGER NOT NULL DEFAULT 0,
  locked_until_ms INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  created_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  updated_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  FOREIGN KEY (account_id) REFERENCES credit_accounts(id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_credit_cards_account
  ON credit_cards(account_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_credit_cards_status
  ON credit_cards(status);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS credit_ledger_entries (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  entry_type TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  balance_after_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  market_checkout_payment_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  FOREIGN KEY (account_id) REFERENCES credit_accounts(id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_credit_ledger_account_created
  ON credit_ledger_entries(account_id, created_at_ms);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_credit_ledger_entry_type
  ON credit_ledger_entries(entry_type);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_credit_ledger_source
  ON credit_ledger_entries(source_type, source_id);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS user_coupons (
  id TEXT PRIMARY KEY NOT NULL,
  coupon_id INTEGER NOT NULL,
  owner_customer_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'issued',
  reserved_for_checkout_id TEXT,
  redeemed_usage_id INTEGER,
  expires_at_ms INTEGER,
  created_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  updated_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (redeemed_usage_id) REFERENCES coupon_usage(id) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_user_coupons_owner_state
  ON user_coupons(owner_customer_id, state);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_user_coupons_coupon
  ON user_coupons(coupon_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_user_coupons_reserved_checkout
  ON user_coupons(reserved_for_checkout_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_user_coupons_expiry_scan
  ON user_coupons(state, expires_at_ms);
