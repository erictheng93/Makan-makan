-- Credit top-up intents (代幣線上儲值意圖) — Phase 2 online funding.
-- Balance is credited only when a verified provider webhook confirms payment.

CREATE TABLE IF NOT EXISTS credit_topup_intents (
  id TEXT PRIMARY KEY NOT NULL,
  account_id TEXT NOT NULL,
  public_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  provider_transaction_id TEXT,
  provider_payload TEXT,
  ledger_entry_id TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  updated_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
  paid_at_ms INTEGER,
  failed_at_ms INTEGER,
  expires_at_ms INTEGER,
  FOREIGN KEY (account_id) REFERENCES credit_accounts(id) ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_credit_topup_intents_account
  ON credit_topup_intents(account_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_credit_topup_intents_status
  ON credit_topup_intents(status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_credit_topup_intents_provider_txn
  ON credit_topup_intents(provider_transaction_id);
