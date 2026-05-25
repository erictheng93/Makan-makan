# Realtime Phase 4 — Status Snapshot

**Snapshot date**: 2026-05-25
**Phase kickoff**: 2025-11-03 (see [REALTIME_PHASE4_KICKOFF.md](./REALTIME_PHASE4_KICKOFF.md))
**Original plan**: [REALTIME_PHASE4_PLAN.md](./REALTIME_PHASE4_PLAN.md) (4-week timeline, ended on paper 2025-12-01)

This document records **actual** progress against the original Phase 4 plan. The plan itself is preserved as the design contract; the kickoff is preserved as the historical artifact for the launch decision. This file is the live tracker.

## TL;DR

The original 4-week timeline is 6 months past its paper deadline, but substantial progress has shipped — just not in the order or scope the plan predicted. Roughly **half** of Phase 4 is done. The kickoff doc's "Phase 4 完成度: 5%" dashboard is stale and should not be quoted; use this file instead.

**2026-05-25 correction**: commit `b936600f chore(tests): remove mock-based test doubles` deleted the `tests/performance/`, `tests/e2e/smoke/`, and `tests/security/` inputs that `.github/workflows/test.yml` still referenced. Those CI inputs have now been restored in the current working tree, and the DB perf regression script is ESM-safe with a committed baseline at `tests/performance/baselines/db-baseline.json`.

| Pillar          | Status      | Notes                                                                 |
| --------------- | ----------- | --------------------------------------------------------------------- |
| Performance     | ✅ ~70%     | Artillery CI smoke + DB perf regression gate restored after `b936600f` deletion regression |
| Security        | ✅ ~75%     | Token blacklist, realtime upgrade rate limiting, and Zod message validation shipped |
| Observability   | ❌ ~10%     | Metrics scaffolding only; no Prometheus / structured logging / Sentry |
| Operations      | ⚠️ ~55%     | CI/CD live, staging provisioned; minimum rollback/backup/incident runbooks added |
| Reliability     | ❓ unknown  | No SLA measurements published yet (no metrics → no numbers)           |
| Production      | ❌ not done | Staging green; production cutover + 7-day stability still pending     |

## Task-level Status

### Week 1 — Performance Optimization

| Task                              | Original | 2026-05-25 Actual                                                                                                              |
| --------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Artillery performance framework   | ⏳       | ✅ Restored. `tests/performance/artillery-api-ci.yml`, `artillery-realtime-ci.yml`; these were deleted by `b936600f` and restored 2026-05-25 |
| Performance baseline tests        | ⏳       | ✅ Restored. CI runs Artillery + DB perf regression with `--fail-on-regression --warning-threshold 20 --failure-threshold 50`; baseline at `tests/performance/baselines/db-baseline.json` |
| Connection pool optimization      | ⏳       | ⚠️ Partial. KV usage parallelized + hardened (`bf128da5`); no dedicated WebSocket connection-pool refactor surfaced            |
| Batch message processing          | ⏳       | ❌ Not found in current realtime code                                                                                          |

### Week 2 — Security Hardening

| Task                       | Original | 2026-05-25 Actual                                                                                                                |
| -------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Token blacklist            | ⏳       | ✅ Done. `TOKEN_BLACKLIST` KV namespace + `verifyWebSocketToken(token, jwt, TOKEN_BLACKLIST)` in `RealtimeSession.ts:79-87` (`1c5b4b7b`) |
| Connection rate limiting   | ⏳       | ✅ Added. `/customer/:tableId`, `/admin/:restaurantId`, and `/kitchen/:restaurantId` websocket upgrades check `RATE_LIMIT_KV` before DO forwarding |
| WebSocket message validation | ⏳     | ✅ Added. `ping`/`subscribe`/`unsubscribe` and advanced group-order messages now pass Zod `safeParse()` before dispatch |
| Security audit log         | ⏳       | ❌ Not implemented for realtime (api-side audit log exists separately)                                                            |
| Admin WS session validation | not in plan | ✅ Added (`b4ff11b4 fix(realtime): validate admin websocket sessions`)                                                       |

### Week 3 — Observability

| Task                       | Original | 2026-05-25 Actual                                                                                          |
| -------------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| Prometheus / Analytics Engine metrics | ⏳ | ❌ Scaffolding only. `advanced-realtime-session.ts:949` has `collectAndSendMetrics()` with empty body |
| Grafana dashboard          | ⏳       | ❌ Not built                                                                                                |
| Structured logging         | ⏳       | ❌ Still uses ad-hoc `console.warn` / `console.error`                                                       |
| Cloudflare Logpush         | ⏳       | ❌ Not configured                                                                                           |
| Sentry / error tracking    | ⏳       | ❌ Not integrated in realtime worker                                                                        |

### Week 4 — Operations

| Task                         | Original | 2026-05-25 Actual                                                                                                       |
| ---------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| CI/CD Pipeline               | ⏳       | ✅ Done. `.github/workflows/test.yml` (lint → typecheck → test → perf → worker-gates → deploy) + `deploy-production.yml` |
| Auto rollback                | ⏳       | ⚠️ Partial. Worker gates can fail the deploy; no explicit auto-rollback mechanism documented                            |
| Disaster recovery plan       | ⏳       | ⚠️ Minimum runbooks added: rollback, backup/restore, incident triage; formal DR exercise still pending                  |
| Operations manuals (5 docs)  | ⏳       | ⚠️ Partial. `DEPLOYMENT_GUIDE`, `TROUBLESHOOTING`, and 3 runbooks exist; full `OPERATIONS_MANUAL.md`, `PERFORMANCE_TUNING.md`, and `SECURITY_OPERATIONS.md` still pending |
| Staging environment provision | ⏳      | ✅ Done. `65204ceb feat(deploy): provision staging Cloudflare resources + fill IDs`                                      |
| Staging validation           | ⏳       | ✅ Smoke probes via `/info` per `CLAUDE.md`; CI promotes to staging on green                                             |

### Week 5 — Production Deploy

| Task                          | Original | 2026-05-25 Actual                                                              |
| ----------------------------- | -------- | ------------------------------------------------------------------------------ |
| Production deploy             | ⏳       | ❌ Still manual-only per `docs/TECHNICAL_DEBT_TODO.md` 2026-05-01 follow-up    |
| 7-day stability observation   | ⏳       | ❌ Not yet — depends on production cutover + metrics being wired                |

### Work outside the original plan

These shipped but weren't in the original Phase 4 plan — worth recording so future Phase 5 / 6 planning sees them.

- **Durable Object state migration v1→v2** (`f000ab8c`) plus cleanup (`91d4bfb0`). Unified `OrderLifecycleState` across the DO and order-status enum.
- **Guest WebSocket token flow** (`a2d1c2ca`) — customer-app can now connect to realtime without a registered account.
- **Type tightening** — `f1b86d16`, `4eea96b8`, `e203b1db` cleared remaining `any` casts in `AdvancedRealtimeSession` and verifier paths.
- **Hono 4.12 + wrangler 4.85 bumps** with realtime contract snapshot refreshed (`179d6593`, `7af59a9e`).

## What's actually blocking "100% production ready"

In rough priority order for whoever picks this up:

1. **Prometheus / Analytics Engine metrics + structured logging.** Without these, the SLA/MTTR/uptime targets in the plan can't even be measured — every "未測量 → < Xms" row in the plan stays at "未測量".
2. **Realtime security audit log.** Token blacklist, rate limiting, and payload validation exist; security events still need durable audit records.
3. **Formal DR exercise + full ops manuals.** Minimum runbooks exist, but the backup/restore path still needs a timed staging drill and the remaining operations manuals.
4. **Production cutover + 7-day stability soak.** Final gate.

The original plan estimated 160 hours total. The remaining work is probably ~45-65 hours given the restored CI/perf gates, realtime rate limiting, Zod validation, and minimum runbooks.

## Next review

Refresh this file when any of:
- Prometheus / metrics get wired.
- Realtime security audit logging ships.
- Production cutover completes.
- The plan's success criteria checklist (`REALTIME_PHASE4_PLAN.md` § 成功標準) hits >80%.

---

**Status doc owner**: anyone touching realtime — keep this honest.
