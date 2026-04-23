-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
-- DEV ONLY: DO NOT RUN IN PRODUCTION
-- Seeds the fixed UUIDs and platform-integration row that the Tier 1
-- P0 release gates in tests/e2e/integration/p0-release-gates.spec.ts
-- hardcode. Running this in production would:
--   * create a synthetic closed cash shift that can never be
--     reconciled against real sales, and
--   * expose a stub Uber Eats integration with a known test webhook
--     secret and storeId "p0-test-store".
-- This migration is kept outside migrations_fresh/ for that reason.
-- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
--
-- P0 Release-Gate Seed Data
-- Created: 2026-04-23
-- Related gates:
--   * K6 — refund after close uses adjustment path; requires an
--          existing register + closed shift referenced by
--          X-Register-Id / X-Shift-Id headers in the gate request.
--   * E2 — duplicate Uber Eats webhook only-once; requires an enabled
--          platform_integrations row whose credentials.storeId matches
--          the test payload's store.id ("p0-test-store").
--
-- K7 / E1 do not need dedicated seed data: they run against the
-- existing test restaurant (019469a0-0001-7000-8000-000000000001),
-- menu items and admin user seeded by scripts/seed-mock-data.sql.

-- =====================================================
-- K6 — Register + closed shift for refund-after-close
-- =====================================================

-- Register referenced by X-Register-Id in the K6 gate request.
INSERT OR IGNORE INTO cash_registers (
  id,
  name,
  restaurant_id,
  is_active,
  hardware_config,
  peripherals,
  settings,
  created_at_ms,
  updated_at_ms
)
VALUES (
  '00000000-0000-4000-8000-00000000cafe',
  'P0 K6 Test Register',
  '019469a0-0001-7000-8000-000000000001',
  1,
  '{}',
  '{}',
  '{}',
  strftime('%s','now') * 1000,
  strftime('%s','now') * 1000
);

-- Closed shift referenced by X-Shift-Id in the K6 gate request.
-- status='closed' triggers RefundService to branch to the
-- no-ledger-mutation / adjustment path.
INSERT OR IGNORE INTO cash_shifts (
  id,
  register_id,
  operator_id,
  start_amount,
  end_amount,
  expected_amount,
  actual_amount,
  difference_amount,
  total_sales,
  total_refunds,
  cash_sales,
  card_sales,
  digital_sales,
  total_transactions,
  started_at_ms,
  ended_at_ms,
  status,
  closing_notes
)
VALUES (
  '00000000-0000-4000-8000-00000000dead',
  '00000000-0000-4000-8000-00000000cafe',
  (SELECT id FROM users WHERE username = 'admin' LIMIT 1),
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  strftime('%s','now') * 1000 - 86400000,
  strftime('%s','now') * 1000 - 3600000,
  'closed',
  'P0 K6 seeded closed shift — do not reopen'
);

-- =====================================================
-- E2 — Uber Eats platform integration for webhook gate
-- =====================================================

-- The E2 gate POSTs a payment.succeeded webhook with
-- store.id = "p0-test-store" and X-Uber-Signature =
-- "test-fixture-signature". Credentials are stored as plaintext JSON
-- because the gate bypasses HMAC via ALLOW_TEST_SIGNATURE; the
-- webhook handler also skips credential decryption in that path.
INSERT OR IGNORE INTO platform_integrations (
  restaurant_id,
  platform,
  enabled,
  credentials,
  config,
  menu_sync_status,
  created_at_ms,
  updated_at_ms
)
VALUES (
  '019469a0-0001-7000-8000-000000000001',
  'uber_eats',
  1,
  '{"storeId":"p0-test-store"}',
  '{"webhookSecret":"p0-test-webhook-secret","autoAcceptOrders":false,"menuSyncEnabled":false}',
  'idle',
  strftime('%s','now') * 1000,
  strftime('%s','now') * 1000
);
