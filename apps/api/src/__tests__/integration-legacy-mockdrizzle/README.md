# Legacy Mock-Drizzle "Integration" Tests

**Do not add new files to this folder.**

These tests are unit tests with mocked service/DB boundaries, not real
integration tests. They use `MockDrizzle` (a `Proxy` fake) and `SharedDataStore`
(`sql.js` WASM) — Drizzle's SQL compiler is never exercised.

For real integration tests, see:

- Spec: `docs/superpowers/specs/2026-04-13-real-integration-test-foundation-design.md`
- New path: `apps/api/src/__tests__/integration/*.real.integration.test.ts`
- Foundation: `packages/database/src/testing/create-test-database.ts`

Files here are kept for:
1. Backward compatibility — they still verify route handler JS logic
2. Blame/history via `git log --follow`
3. Incident-driven migration only — do not mass-migrate

When a legacy test gives a false pass that production caught, migrate that
specific test to the new foundation as part of the incident fix.
