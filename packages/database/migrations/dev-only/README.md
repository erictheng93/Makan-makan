# DEV ONLY Migrations

> **WARNING: Files in this directory must NEVER be run in production.**

These migrations contain test accounts, seed data, and dev fixtures with **known passwords**.
Running them in production creates critical security vulnerabilities.

## Files

| File | Description | Risk |
|------|-------------|------|
| `0002_seed_data.sql` | Sample restaurants and menu items for local dev | Test data in prod |
| `0022_payment_system_seed_data.sql` | Payment system seed data | Test data in prod |
| `0022_payment_system_seed_data.sql.skip` | Same file, disabled | — |
| `0039_fix_test_user_passwords.sql` | Resets test user passwords to known values | Known passwords in prod |
| `0048_add_test_accounts.sql` | Creates 8 test accounts (admin/admin123, etc.) | **Admin account with public password** |
| `0049_p0_gate_seed.sql` | Seeds the fixed UUIDs + Uber Eats integration that Tier 1 P0 release gates hardcode (K6, E2). | Synthetic closed shift + known webhook secret in prod |

## How to use (local dev only)

```bash
# Apply to local dev DB only
wrangler d1 execute makanmasak-local --local \
  --file packages/database/migrations/dev-only/0048_add_test_accounts.sql
```

## Why is this directory separate?

Production uses `migrations_fresh/` (configured in `apps/api/wrangler.toml`).
This `dev-only/` subdirectory is intentionally outside that path so it can never
be accidentally applied via `pnpm db:migrate:prod`.
