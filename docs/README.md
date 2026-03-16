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

| Directory                                                    | Contents                                                |
| ------------------------------------------------------------ | ------------------------------------------------------- |
| [architecture/](./architecture/)                             | System architecture, technical specs                    |
| [architecture/database/](./architecture/database/)           | D1 database design and optimization                     |
| [architecture/system-design/](./architecture/system-design/) | Modular architecture, notification system, queue design |

### Feature Documentation

Active feature docs for in-progress or reference-worthy features:

| Directory                                                    | Contents                                                            |
| ------------------------------------------------------------ | ------------------------------------------------------------------- |
| [features/realtime-services/](./features/realtime-services/) | WebSocket/Durable Objects implementation (active — Phase 4 pending) |

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
| [migration/DATABASE_OPTIMIZATION_IMPLEMENTATION_GUIDE.md](./migration/DATABASE_OPTIMIZATION_IMPLEMENTATION_GUIDE.md) | DB optimization guide       |

### User Manuals

Role-based guides in 7 languages (zh-TW, en-US, ja-JP, vi-VN, id-ID, fil-PH):

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

**Last Updated**: 2026-03-16
