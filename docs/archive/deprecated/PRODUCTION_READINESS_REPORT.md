> ⚠️ **SUPERSEDED (2026-07-05)**：本文件引用的整個 `tests/e2e/` 目錄樹與 CI run 證據（`#24861758340` 等）已隨 commit `b936600f`（2026-05-25,「remove mock-based test doubles」）整批刪除並重建，「609 test files」清單與 P0/P1 gate 推進紀錄已不適用於現行測試基礎設施。現行測試結構請見 `docs/testing/CORE_WORKFLOW_TEST_MATRIX.md`。本文件僅保留供歷史脈絡參考。

# Production Readiness Report

- **Date**: 2026-04-24
- **Branch reviewed**: `main` @ 85968ae1
- **Sources cross-referenced**:
  - `docs/testing/personas.md` (85-row risk blueprint)
  - `docs/testing/PERSONA_TEST_CHECKLIST_AUDIT.md` (current audit)
  - `.github/workflows/*` (all 6 CI workflows)
  - `package.json` test scripts
  - GitHub Actions run history (last 10 runs across all workflows)
  - Repo-wide `*.test.ts` / `*.spec.ts` inventory (excluding `node_modules`, `dist`, `.turbo`, `.wrangler`)
  - `tests/.integration-allowlist.json`
- **Out of scope at audit time**: K6 (refund-after-close, order-state-machine fix) and A6 (backup-restore-drill, schema-drift fix) backend work was assessed as in-flight in a parallel session. **Update during writing**: both fixes have since landed and `nightly-integration.yml` run `#24861758340` (2026-04-23 22:20 UTC) is green with 25/25 P0 + P1 gates passing. This report has been updated to reflect that, but does not re-derive recommendations from the K6/A6 implementation details — see §6 for the post-landing status.

---

## Verdict

**Not ready for production.** With K6 + A6 now green (`#24861758340`, all 25 P0+P1 gates passing), the test-content side is materially closer to ready, but four delivery-infrastructure blockers and two coverage-quality blockers remain. Severity ordering:

1. CI/CD delivery chain is broken in three independent places — even with green tests today, no automation can actually ship the build (see §1.2).
2. CI green is not yet reproducible — the run history on 2026-04-23 alone shows failure → success → failure → success within hours. One green is not a baseline.
3. 19 P1 risk specs are intentionally `test.describe.fixme`'d. Several of them (K11 brute-force, S1 wrong-table, C14 combo validation) are real production failure modes that could bite real customers on day one.
4. Two production-critical UI suites (`restaurant-switching`, `coupon-checkout`) carry unconditional `test.skip()` blocks because their UI fixtures are missing — meaning the OWNER multi-store and CUSTOMER coupon happy paths are unverified at the UI level.

Cut-over criteria are listed in §5 below.

---

## 1. CI/CD Pipeline Health

### 1.1 Workflow trigger matrix (current state)

| Workflow | Trigger | Last 5 outcomes | Status |
| --- | --- | --- | --- |
| `test.yml` (main test pipeline) | `workflow_dispatch` only — auto-trigger commented out at line 4-9 with note `CI 暫時停用 auto-trigger（2026-04-16）` | 4 failure / 1 success (last success on a feature branch 2026-04-16; no main success in the last week) | DORMANT |
| `nightly-integration.yml` | `workflow_dispatch` only (audit notes auto-trigger disabled in solo-dev mode) | Latest: `24861758340` (2026-04-23 22:20): **SUCCESS** — 25/25 P0+P1 gates after K6/A6 fix landed. Six minutes earlier `24861566565` (22:14) failed at A6 (now resolved). Earlier same day: success → failure → cancelled → failure. | GREEN BUT UNSTABLE — no consecutive-green baseline yet |
| `deploy-production.yml` | `workflow_run` chained off `test.yml` | 5 of 5 most recent runs `skipped` since 2026-04-16 — chain never fires because parent doesn't auto-fire | DEAD CHAIN |
| `deploy-staging` (job inside `test.yml`) | Only on `develop` branch push | Has not fired in current history | UNUSED PATH |
| `factory-usage-check.yml` | Normal | Healthy | OK |
| CodeQL (separate workflow) | Push on main | Recent runs success | OK |

### 1.2 Three independent breakages in the deploy chain

**Breakage A — `test.yml` auto-trigger disabled.**
File: `.github/workflows/test.yml:4-10`
```yaml
on:
  # CI 暫時停用 auto-trigger（2026-04-16）— 只保留手動觸發。
  # 要恢復：把 push/pull_request 區塊取消註解。
  # push:
  #   branches: [main, develop]
  # pull_request:
  #   branches: [main, develop]
  workflow_dispatch:
```

Effect: PRs and main pushes do not run unit + workers + real-integration + e2e + perf + security + visual. The repo has no continuous safety net.

**Breakage B — production smoke test calls a non-existent endpoint.**
File: `.github/workflows/deploy-production.yml:81-89`
```bash
curl --fail --retry 3 --retry-delay 5 \
  "$PRODUCTION_URL/api/v1/health" \
  -o /dev/null -w "API health: HTTP %{http_code} in %{time_total}s\n"
```

`CLAUDE.md` explicitly states: "there is **no** unauthenticated `/api/v1/health` route anymore". The public liveness route is `/info`. If `deploy-production` ever fired, this smoke test would fail-stop the deploy.

**Breakage C — staging smoke target directory does not exist.**
File: `package.json` (test:smoke:staging script)
```
"test:smoke:staging": "playwright test tests/e2e/smoke --config=playwright.staging.config.ts"
```

Verified: `tests/e2e/smoke/` does not exist on disk. `tests/e2e/` contains `admin/`, `helpers/`, `integration/`, `journeys/`, `specs/`, `support/` only.

### 1.3 E2E is non-blocking by design

`.github/workflows/test.yml:228-231`
```yaml
e2e-tests:
  name: 🎭 E2E 測試
  # Non-blocking: E2E is not yet in required status checks.
  continue-on-error: true
```

Combined with the `test.yml` auto-trigger being off, E2E currently has no enforcement role at all.

### 1.4 Snyk security scan is also non-blocking

`.github/workflows/test.yml:671-680` runs Snyk with `continue-on-error: true`. Auth failures and CVE detections both pass. CodeQL is the only hard SAST gate, but it lives in a separate workflow.

---

## 2. Test Coverage Reality vs Audit Claims

The audit document's per-persona tables are themselves accurate (see PERSONA_TEST_CHECKLIST_AUDIT.md after the 2026-04-24 corrections). The risk is that the audit's "Covered" column is built from a **single CI run** plus **local laptop runs**, not from a stable green CI baseline.

### 2.1 The "Covered" promotion is built on one green CI run plus local laptop proofs

Of the 25 rows currently marked `Covered` in the audit (post-K6/A6 update):
- 11 P0 gates: proven by `nightly-integration.yml` run `#24861758340` (2026-04-23 22:20 UTC); K6 and A6 just landed in this run
- 12 P1 Strengthen Partial gates: proven by **local laptop runs** of `tests/e2e/integration/p1-current-quarter-gates.spec.ts` (per audit Batch A/B/C results), then promoted to `Covered`. The same nightly run (`#24861758340`) also exercised these as part of the integration project, so they now have one CI proof point as well.
- 2 cross-persona rows (X1, X2): X1 from older test files, X2 shares the H3 P0 gate

The reproducibility concern persists: the run history for 2026-04-23 alone shows failure / cancelled / failure / success / failure / success across six attempts in a single day. A single green run is not a baseline — promotion to `Covered` should require two consecutive green runs (see §5).

### 2.2 19 P1 risks are skeleton-only

`tests/e2e/integration/p1-new-missing-gates.spec.ts` is `test.describe.fixme(...)` — the spec exists on disk, but Playwright skips the entire suite. Affected risks:

C13, C14, H7, H8, H9, S1, S2, S5, K11, A3, A5, A7, E3, M2, M3, M4, X7, X8, X11

Of these, the production-critical fraud/UX failure modes are:
- **K11**: same-IP card brute-force / risk throttling (no rate-limit proof)
- **S1**: wrong-table delivery + correction audit (real operational fault)
- **C14**: combo / add-on required-choice validation (silent order corruption)
- **E3**: external menu sync failure (UberEats / Foodpanda integration)
- **A5**: GDPR retention / right-to-be-forgotten
- **M2 / M3 / M4**: manager delegation expiry, cross-store boundary, cash variance approval

### 2.3 Unconditional skips in shipping suites

| File | Skip count | Nature |
| --- | --- | --- |
| `tests/e2e/admin/restaurant-switching.spec.ts` | 7 | Unconditional `test.skip()` — covers OWNER multi-store P0 (O1, O7) at the UI level. UI cases are effectively untested. |
| `tests/e2e/admin/bulk-qr-progress.spec.ts` | 4 | Unconditional `test.skip()` |
| `tests/e2e/admin/coupon-management.spec.ts` | 4 | Unconditional `test.skip()` |
| `tests/e2e/journeys/customer/coupon-checkout.spec.ts` | 6 | Conditional `test.skip(true, "Coupon input not present in cart")` — UI fixture missing, all happy-path coupon flows skipped |
| `tests/e2e/admin/menu-management.spec.ts` | 1 | Conditional skip on missing file input |
| `tests/e2e/integration/qr-generation.spec.ts` | 1 | Conditional on seat fixture |
| `tests/e2e/journeys/customer/coupon-checkout.spec.ts` (additional) | — | Various conditional skips |

The coupon flow is on the payment path. Six unconditional skips there mean the K10 atomic-redemption Covered status is at the API level only; the UI happy path is unverified.

### 2.4 Test inventory (verified)

| Category | Count |
| --- | --- |
| Total `*.test.ts` / `*.spec.ts` (excluding `node_modules`, `dist`, `.turbo`, `.wrangler`) | 609 |
| Inside `apps/` | 395 |
| Inside `packages/` | 65 |
| Inside `apps/api/` specifically | 177 |
| `tests/e2e/` total | 59 |
| `tests/e2e/integration/` (real-API) | 15 |
| `tests/unit/` | 5 |
| `tests/security/` | 0 spec files (only `run-zap-scan.sh` + `zap-config.yml`) |
| `tests/performance/` | Artillery YAMLs + DB benchmark suite (complete) |

Note: the audit document line 8 cites `530 files`. The current accurate count is 609 — the audit is slightly stale on the upper-bound number, but the directional interpretation (large repo, small fraction is real-API release-gate) holds.

### 2.5 Real-integration coverage is layered

`tests/.integration-allowlist.json` defines two layers:

- **Auto-allowed real-integration**: `apps/*/src/__tests__/integration/*.real.integration.test.ts` (via `apps/api/vitest.real-integration.config.ts`, miniflare D1 + real drizzle, serial execution)
- **Legacy mockdrizzle (deprecated, still in CI)**: 10 files under `apps/api/src/__tests__/integration-legacy-mockdrizzle/` covering db-analytics, db-migrations, menu, orders, partnerships, pos, tables, waiting-list, webhooks, db-seed-integrity

Both layers run inside the `test.yml` real-integration job. Since `test.yml` does not auto-fire, neither layer has a recent CI proof point.

---

## 3. Coverage by Test Type

### 3.1 Real-API integration (user directly hits live API)

- **What exists**: 15 specs in `tests/e2e/integration/`, including `p0-release-gates.spec.ts`, `p1-current-quarter-gates.spec.ts`, `p1-new-missing-gates.spec.ts` (fixme), `auth-api.spec.ts`, `kitchen-api.spec.ts`, `coupon-api.spec.ts`, `guest-order-api.spec.ts`, `admin-order-management.real.spec.ts`, `kitchen-display.real.spec.ts`, etc.
- **What works**: All 11 P0 + 14 P1 gates verified to pass against real wrangler dev + D1 in CI run `#24861758340` (post-K6/A6 fix). Schemas seeded from `migrations/dev-only/0048_add_test_accounts.sql` + `0049_p0_gate_seed.sql`. Backup schema now lives at `migrations_fresh/0021_backup_system.sql` + `migrations/0058_backup_system.sql`.
- **What is missing**:
  - 19 P1 fixme rows — see §2.2
  - C5, G4 still Partial (dual-device guest submit, guest WS auth scoping)
  - No reproducible baseline yet — `#24861758340` is one green sample; the same day saw multiple flaps including a transient `createGuestOrder` 409 MENU_ITEM_UNAVAILABLE caused by a `menu_items.is_available` race between seed and first fetch (per audit line 36)

### 3.2 Unit tests

- **What exists**: 177 in `apps/api`, 65 in packages, plus admin-dashboard / customer-app / kitchen-display component tests
- **What works**: When run locally via `pnpm test`, the suite is operational
- **What is missing**:
  - No CI auto-trigger means no continuous green baseline
  - `test.yml` `unit-tests` job's coverage upload is `continue-on-error: true` and Codecov threshold is advisory; no enforced floor
  - Pre-commit hook `scripts/check-factory-usage.cjs` covers test-quality conventions but is not a coverage gate

### 3.3 Integration tests

- **What exists**: real-integration via miniflare D1 + 10 legacy mockdrizzle suites
- **What works**: `pnpm test:real-integration` and `pnpm test:integration` are both runnable locally
- **What is missing**: Same — no recent CI proof for either layer

### 3.4 E2E tests

- **What exists**: 59 specs across customer journeys, admin operations, and kitchen flows
- **What works**: The 15 real-API integration specs are the high-value subset; mock-route specs are useful regression checks
- **What is missing**:
  - `continue-on-error: true` (`test.yml:231`) — even when run, failures don't block
  - Mock-route specs intentionally excluded from release-gate coverage per audit policy
  - 24 test.skip occurrences across 7 files (mix of unconditional and conditional)

### 3.5 Performance + Security

- **Performance**: Complete Artillery suite (api / websocket / lunch-peak / soak / stress) + DB benchmark with regression detection (warning 20%, failure 50%) + Lighthouse CI on main. Has not run in over a week.
- **Security**: ZAP shell wrapper + Snyk + CodeQL. Snyk is non-blocking; CodeQL alone is the live gate.

---

## 4. Findings by Severity

### 4.1 Hard blockers (must fix before any production traffic)

| # | Finding | File / Evidence | Owner |
| --- | --- | --- | --- |
| HB-1 | `test.yml` auto-trigger disabled — no continuous safety net | `.github/workflows/test.yml:4-10` | CI / DevOps |
| HB-2 | `deploy-production.yml` smoke test calls non-existent `/api/v1/health` endpoint | `.github/workflows/deploy-production.yml:83`; CLAUDE.md "Debug Tools" section | Backend / DevOps |
| HB-3 | `test:smoke:staging` script targets non-existent `tests/e2e/smoke/` directory | `package.json` `test:smoke:staging`; verified directory missing | Test eng |
| HB-4 | No consecutive-green CI baseline yet | Run `24861758340` is one green sample; same day showed multiple failures + one transient `createGuestOrder` MENU_ITEM_UNAVAILABLE race that retried green (audit line 36). P0/P1 `Covered` promotion rests on a single CI run. | Test eng |
| ~~HB-5~~ | ~~K6 + A6 P0 gates red in CI~~ — **CLOSED 2026-04-23**: K6 unblocked via `ROLE_STATUS_PERMISSIONS[4]` extension; A6 unblocked via new `migrations_fresh/0021_backup_system.sql` + `migrations/0058_backup_system.sql`. Verified green in run `#24861758340`. | — | (closed) |

### 4.2 Strong recommendations (should fix before production)

| # | Finding | File / Evidence |
| --- | --- | --- |
| SR-1 | E2E `continue-on-error: true` removes blocking semantics | `.github/workflows/test.yml:231` |
| SR-2 | 19 P1 risks are `describe.fixme` skeletons — at minimum K11, S1, C14, E3 should ship before live customer load | `tests/e2e/integration/p1-new-missing-gates.spec.ts` |
| SR-3 | `restaurant-switching.spec.ts` has 7 unconditional `test.skip()` — OWNER multi-store P0 UI is untested | `tests/e2e/admin/restaurant-switching.spec.ts:121,139,160,204,224,254,275` |
| SR-4 | `coupon-checkout.spec.ts` has 6 conditional skips because UI fixture is missing — coupon happy path is unverified at UI level | `tests/e2e/journeys/customer/coupon-checkout.spec.ts:125,197,266,385,407,430` |
| SR-5 | No GitHub branch protection required-status-checks list documented | (verify with `gh api repos/...branches/main/protection`) |
| SR-6 | Snyk runs `continue-on-error: true` and `--severity-threshold=high` — CVEs at high severity do not block | `.github/workflows/test.yml:671-689` |
| SR-7 | C5 (concurrent guest submit) and G4 (guest WS auth scoping) still Partial | `tests/e2e/integration/p1-current-quarter-gates.spec.ts` |

### 4.3 Nice to have

| # | Finding |
| --- | --- |
| NH-1 | Add Cloudflare canary / staged rollout (Workers supports percentage routing) |
| NH-2 | Add synthetic monitoring on production endpoints (Cloudflare Healthchecks or Better Stack) |
| NH-3 | Promote real-integration coverage to enforce coverage floors via Codecov gate |
| NH-4 | Consolidate 10 legacy-mockdrizzle integration suites onto the real-integration layer to remove the dual maintenance burden |
| NH-5 | Add automated deploy rollback on smoke-test failure (today the deploy proceeds and only logs a smoke failure) |

---

## 5. Production Cut-over Checklist

The following must be true before the next production deploy:

- [x] **K6 + A6 backend fixed and the corresponding P0 gates pass in CI** (closed 2026-04-23 in run `#24861758340`)
- [ ] **`nightly-integration.yml` runs green twice consecutively** on `main` with no scope reduction (fixme not added back, P0/P1 set unchanged) — currently 1/2
- [ ] **`test.yml` auto-trigger restored** OR explicit decision to retire it and chain `deploy-production.yml` off `nightly-integration.yml` directly
- [ ] **`deploy-production.yml:83` smoke endpoint changed** from `/api/v1/health` to `/info` (or another verified-public 200 route) and tested in a manual `workflow_dispatch` run
- [ ] **`tests/e2e/smoke/` populated** with at least: public liveness, customer login, guest QR scan + add-to-cart + submit happy path, kitchen receives order, cashier closes payment
- [ ] **K11 + S1 + C14 P1 gates promoted from `describe.fixme` to passing**
- [ ] **`restaurant-switching.spec.ts` 7 unconditional skips resolved** (either implemented or deleted with rationale)
- [ ] **GitHub branch protection on `main` lists `nightly-integration` as required check**
- [ ] **One full Artillery soak test run on staging** with P99 < 300ms and WS < 50ms verified against `CLAUDE.md` performance targets

After all boxes are checked, run a controlled canary: deploy to a single test restaurant and monitor for 48 hours before fleet-wide rollout.

---

## 6. Out of Scope for This Report (post-landing status)

The following were assessed as in-flight at the start of this audit and **landed during writing** (2026-04-23):

- **K6 (refund-after-close, cashier role state-machine fix)** — landed by extending `ROLE_STATUS_PERMISSIONS[4]` (cashier) to allow the `paid` transition, so the gate's `PUT /orders/:id/status` (`delivered → paid`) succeeds. Now plain `test` (no longer `test.fixme`) in `tests/e2e/integration/p0-release-gates.spec.ts`. CASHIER table row K6 in PERSONA_TEST_CHECKLIST_AUDIT.md is now `Covered`.
- **A6 (backup restore drill, schema drift)** — landed by relocating the backup schema to `migrations_fresh/0021_backup_system.sql` + `migrations/0058_backup_system.sql` (mirroring `packages/database/src/schema/backup.ts` byte-for-byte; the orphaned `005_backup_system.sql` had drifted column names and was never applied). ADMIN table row A6 is now `Covered`.

Outcome: Covered count moved 23 → 25, original HB-4 closed. The P0 set is now 11/11 green in CI run `#24861758340`. The remaining gap is reproducibility (now tracked as the new HB-4 in §4.1) and the items in §4.2 / §4.3 / §5, none of which depend on K6/A6 implementation details.

---

## 7. What Is Working Well

To balance the assessment:

- The **persona blueprint (`personas.md`)** is excellent — 85 risks across 17 functional modules, with explicit Test Oracle, severity, and persona attribution. It is ahead of implementation, which is the correct direction.
- The **audit document discipline** is strong — every "Covered" claim is tied to a named spec file, and mock-only evidence is correctly downgraded from Covered to Partial.
- The **Wave 1-4 backend work** (notesSchema sanitizer, tokenVersion, payments + idempotency middleware, refund closed-shift branch) shows mature defensive design with unit-test coverage for each layer.
- The **DB performance tooling** (Drizzle + better-sqlite3 in-memory, regression detection vs baseline with thresholds) is production-quality.
- The **integration allowlist mechanism** (`tests/.integration-allowlist.json` + `scripts/check-integration-allowlist.cjs`) prevents accidental misclassification of integration tests — a thoughtful safety guard.
- The **test factory + lint-staged enforcement** (`scripts/check-factory-usage.cjs`) keeps test quality from drifting on every commit.

The gap is delivery infrastructure, not test design. Once the CI chain is repaired and the in-flight K6/A6 work lands, this codebase will be much closer to production-ready than the surface-level "many tests are red or skipped" view suggests.
