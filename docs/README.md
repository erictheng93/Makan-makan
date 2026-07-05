# MakanMakan Documentation Hub

> **New here?** Start with [CLAUDE.md](../CLAUDE.md) for a complete project overview and development guide.

---

## Documentation Map

### Core References

| Document                             | Description                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------- |
| [CLAUDE.md](../CLAUDE.md)            | **Primary reference** — architecture, API endpoints, coding conventions, project status |
| [requirements.md](./requirements.md) | Product requirements                                                                    |
| [CHANGELOG](./archive/CHANGELOG.md)  | Development history and milestones                                                      |

### Architecture & Technical

| Directory / Document                                                 | Contents                                                          |
| -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [architecture/](./architecture/)                                     | System architecture, technical specs                              |
| [architecture/database/](./architecture/database/)                   | D1 database design and optimization, incl. the users/orders UUID v7 primary-key migration phases (`GREENFIELD_UUID_PK_RESET_PLAN.md`, `USERS_UUID_PK_PHASE_E_DEPENDENCY_MAP.md`, `ORDERS_UUID_PK_PHASE_C_DEPENDENCY_MAP.md`, `USERS_UUID_AUTH_PHASE_D_PLAN.md`, `UUID_V7_PK_MIGRATION_DRILL.md`) |
| [architecture/system-design/](./architecture/system-design/)         | Modular architecture, notification system, queue design           |
| [architecture/modular-billing.md](./architecture/modular-billing.md) | Module gates, usage meters, quota controls (basic/pro/enterprise) |
| [night-market-vision-roadmap.md](./night-market-vision-roadmap.md)   | Night-market/商圈 platform vision, gap analysis, and roadmap (source of truth for how far the marketplace layer is from vision) |
| [night-market-scaling-execution.md](./night-market-scaling-execution.md) | Night-market discovery scaling execution record (D1 read replicas, queue fan-out, FTS5 trigram search) |

### Specifications

Authoritative product/system specs for shipped or in-flight features. These are the source of truth for feature behavior — separate from the dated design drafts in [superpowers/specs/](./superpowers/specs/).

| Document                                                                                       | Description                                                |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| [specs/queue-and-waiting-list.md](./specs/queue-and-waiting-list.md)                           | Queue + customer waiting-list system spec                  |
| [specs/modular-billing-and-usage-metering.md](./specs/modular-billing-and-usage-metering.md)   | Modular billing plans, metered usage, quota enforcement    |
| [specs/modular-billing-codex-briefing.md](./specs/modular-billing-codex-briefing.md)           | Codex implementation briefing for the billing rollout      |
| [specs/2026-07-04-rust-backend-refactor.md](./specs/2026-07-04-rust-backend-refactor.md)       | Rust backend refactor spec — staged TS Workers → Rust migration plan (planning stage, not yet implemented) |
| [superpowers/specs/2026-06-03-market-checkout-voucher-redemption.md](./superpowers/specs/2026-06-03-market-checkout-voucher-redemption.md) | Market checkout 卷 (voucher) redemption MVP — shipped              |
| [superpowers/specs/2026-06-03-service-reservation-system.md](./superpowers/specs/2026-06-03-service-reservation-system.md) | Service reservation (預約服務) system design                       |

### Runbooks

Operational playbooks for production incidents and migrations.

| Document                                                                       | Description                                            |
| ------------------------------------------------------------------------------ | ------------------------------------------------------ |
| [runbooks/billing-incident-response.md](./runbooks/billing-incident-response.md) | Billing webhook / quota / trial-reaper incident triage |
| [runbooks/orderstatus-migration-deploy.md](./runbooks/orderstatus-migration-deploy.md) | Order-status unification deploy steps                  |
| [runbooks/market-checkout-payment-readiness.md](./runbooks/market-checkout-payment-readiness.md) | Market checkout payment provider readiness checklist    |
| [runbooks/market-checkout-provider-adapter-handoff.md](./runbooks/market-checkout-provider-adapter-handoff.md) | Market checkout provider adapter implementation handoff |
| [runbooks/backup-restore-runbook.md](./runbooks/backup-restore-runbook.md)     | D1 backup/restore procedure                             |
| [runbooks/incident-triage-runbook.md](./runbooks/incident-triage-runbook.md)   | General incident triage steps                           |
| [runbooks/rollback-runbook.md](./runbooks/rollback-runbook.md)                 | Deployment rollback procedure                            |

### Feature Documentation

Active feature docs for in-progress or reference-worthy features:

| Directory                                                    | Contents                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------- |
| [features/realtime-services/](./features/realtime-services/) | WebSocket/Durable Objects implementation (Phase 4 ~50% — see [STATUS](./features/realtime-services/phases/REALTIME_PHASE4_STATUS.md)) |

> Customer waiting-list Phase 1 shipped 2026-05-04 (see [specs/queue-and-waiting-list.md](./specs/queue-and-waiting-list.md) for the canonical spec; Phase 2-4 backlog in root [`TODOS.md`](../TODOS.md)).
>
> Completed feature docs (employee management, partnership, AI analytics, shop QR, seat management, security) have been moved to [archive/completed-features/](./archive/completed-features/).

### Guides

| Document                                                                           | Description                                       |
| ---------------------------------------------------------------------------------- | ------------------------------------------------- |
| [guides/testing-guide.md](./guides/testing-guide.md)                               | Testing best practices                            |
| [guides/development/](./guides/development/)                                       | Development best practices, timestamp conventions |
| [guides/MONITORING_INTEGRATION_GUIDE.md](./guides/MONITORING_INTEGRATION_GUIDE.md) | Monitoring setup                                  |

### Deployment & Security

| Document                                                                                   | Description                     |
| ------------------------------------------------------------------------------------------ | ------------------------------- |
| [deployment/DEPLOYMENT_GUIDE.md](./deployment/DEPLOYMENT_GUIDE.md)                         | Deployment procedures           |
| [deployment/DEPLOYMENT_SETUP.md](./deployment/DEPLOYMENT_SETUP.md)                         | Environment setup               |
| [deployment/ENVIRONMENT_CHECKLIST.md](./deployment/ENVIRONMENT_CHECKLIST.md)               | Environment variables checklist |
| [deployment/STAGING_DEPLOYMENT_CHECKLIST.md](./deployment/STAGING_DEPLOYMENT_CHECKLIST.md) | Staging checklist               |
| [deployment/TROUBLESHOOTING.md](./deployment/TROUBLESHOOTING.md)                           | Common issues                   |
| [security/SECURITY.md](./security/SECURITY.md)                                             | Security policies               |
| [security/DEPLOYMENT_SECURITY_CHECKLIST.md](./security/DEPLOYMENT_SECURITY_CHECKLIST.md)   | Security checklist              |

### API Documentation

| Document                                                                   | Description      |
| -------------------------------------------------------------------------- | ---------------- |
| [api/README.md](./api/README.md)                                           | API overview     |
| [api/guides/API_PAGINATION_GUIDE.md](./api/guides/API_PAGINATION_GUIDE.md) | Pagination guide |

### Performance

| Document                                                                                         | Description              |
| ------------------------------------------------------------------------------------------------ | ------------------------ |
| [performance/PERFORMANCE_OPTIMIZATION_GUIDE.md](./performance/PERFORMANCE_OPTIMIZATION_GUIDE.md) | Optimization guide       |
| [performance/BUNDLE_OPTIMIZATION_GUIDE.md](./performance/BUNDLE_OPTIMIZATION_GUIDE.md)           | Bundle size optimization |
| [performance/REQUEST_DEDUPLICATION_GUIDE.md](./performance/REQUEST_DEDUPLICATION_GUIDE.md)       | Request deduplication    |
| [performance/PWA-TESTING-REPORT.md](./performance/PWA-TESTING-REPORT.md)                         | PWA performance report   |

### Testing

| Document                                                             | Description                 |
| -------------------------------------------------------------------- | --------------------------- |
| [testing/guides/TESTING_GUIDE.md](./testing/guides/TESTING_GUIDE.md) | Comprehensive testing guide |
| [testing/factory-pattern/](./testing/factory-pattern/)               | Test data factory pattern   |
| [testing/reports/](./testing/reports/)                               | Test coverage reports       |

### Database & Migration

| Document                                                                                                             | Description                 |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| [migration/SQLITE_CONSTRAINT_RULES.md](./migration/SQLITE_CONSTRAINT_RULES.md)                                       | SQLite constraint reference |
| [migration/DATABASE_MIGRATION_TRIGGER_ALERT_SPEC.md](./migration/DATABASE_MIGRATION_TRIGGER_ALERT_SPEC.md)          | Migration trigger/alert threshold spec |
| [architecture/database/](./architecture/database/)                                                                   | UUID v7 PK migration phases, index/optimization plans |

### User Manuals

Role-based guides in 6 languages (zh-TW, en-US, ja-JP, vi-VN, id-ID, fil-PH):

| Manual                                                                                 | Description                                                              |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| [user-manuals/SCHEDULING_MANUAL.md](./user-manuals/SCHEDULING_MANUAL.md)               | Employee scheduling                                                      |
| [user-manuals/LEAVE_MANAGEMENT_MANUAL.md](./user-manuals/LEAVE_MANAGEMENT_MANUAL.md)   | Leave management                                                         |
| [user-manuals/AI_ANALYTICS_USER_MANUAL.md](./user-manuals/AI_ANALYTICS_USER_MANUAL.md) | AI analytics                                                             |
| [user-manuals/{locale}/](./user-manuals/)                                              | Role-specific guides (shop-owner, chef, cashier, service-crew, customer) |

### Active Plans

| Document                                   | Description                  |
| ------------------------------------------ | ---------------------------- |
| [superpowers/plans/](./superpowers/plans/) | Current implementation plans |
| [superpowers/specs/](./superpowers/specs/) | Design specifications        |
| [plans/](./plans/)                         | Database optimization plans  |

### Archive

| Directory                                                    | Contents                       |
| ------------------------------------------------------------ | ------------------------------ |
| [archive/CHANGELOG.md](./archive/CHANGELOG.md)               | Full development history       |
| [archive/completed-features/](./archive/completed-features/) | Docs for completed features    |
| [archive/historical-reports/](./archive/historical-reports/) | Progress reports and summaries |
| [archive/reports/](./archive/reports/)                       | Legacy completion reports      |
| [archive/bug-fixes/](./archive/bug-fixes/)                   | Historical bug fix records     |

---

## Quick Navigation

**I want to...**

- **Start developing** → Read [CLAUDE.md](../CLAUDE.md)
- **Understand the API** → See [api/](./api/)
- **Write tests** → See [testing/guides/TESTING_GUIDE.md](./testing/guides/TESTING_GUIDE.md)
- **Deploy** → See [deployment/DEPLOYMENT_GUIDE.md](./deployment/DEPLOYMENT_GUIDE.md)
- **Check project status** → See [CLAUDE.md § Development Status](../CLAUDE.md)
- **Find completed feature docs** → See [archive/completed-features/](./archive/completed-features/)

---

**Last Updated**: 2026-07-05
