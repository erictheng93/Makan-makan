# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MakanMakan is a modern, serverless restaurant management system built on Cloudflare's edge computing platform. The system provides online ordering, menu management, table management, and multi-role user access with real-time functionality. It supports multiple restaurants/shops with their own menus, tables, and staff, delivered through a scalable, cost-effective SaaS architecture.

## Architecture Status

**MIGRATION COMPLETED**

- **Legacy System**: PHP + MySQL (archived externally)
- **New System**: Cloudflare Workers + D1 + TypeScript (**Production Ready**)
- **TypeScript Status**: ✅ 0 errors (100% Compliance - All 20 packages passing)
- **ESLint Status**: ✅ 100% Compliance (0 errors, 0 warnings)
- **PWA Performance**: 95/100 Score
- **Current Phase**: Feature enhancement and optimization

## Technology Stack

- **Frontend**: Vue.js 3 + TypeScript (Cloudflare Pages)
- **Backend**: Cloudflare Workers + TypeScript
- **Database**: Cloudflare D1 (SQLite-compatible serverless SQL)
- **Cache**: Cloudflare KV Store
- **Real-time**: Durable Objects (WebSocket connections)
- **File Storage**: Cloudflare R2 + Images API
- **Build System**: Turborepo (parallel builds with caching)
- **Monitoring**: Workers Analytics + Custom metrics
- **Backup**: Cloudflare Workers Cron + R2
- **Print**: Local Node.js agent (Express + WebSocket)
- **Security**: Cloudflare WAF + Zero Trust

## Project Structure

```
makanmakan/
├── apps/
│   ├── customer-app/          # Consumer ordering app (Vue.js PWA)
│   ├── admin-dashboard/       # Restaurant management dashboard
│   ├── kitchen-display/       # Kitchen display system
│   ├── api/                   # API services (Cloudflare Workers)
│   ├── realtime/              # Real-time services (Durable Objects)
│   ├── onboarding-app/        # New customer onboarding (Vue.js SPA)
│   ├── management-portal/     # Multi-tenant management UI (Vue.js)
│   ├── management-api/        # Tenant management API (Workers)
│   ├── backup-scheduler/      # Scheduled D1 backup (Workers Cron)
│   ├── print-agent/           # Local receipt printing (Express + WS)
│   └── image-processor/       # Image optimization service (Workers)
├── packages/
│   ├── shared-types/          # TypeScript definitions
│   ├── database/              # D1 schema & migrations (Drizzle ORM)
│   ├── utils/                 # Shared utilities (UUID v7, helpers)
│   ├── queue-core/            # Queue system core
│   ├── queue-service/         # Queue service implementation
│   ├── ai-analytics/          # AI analytics package
│   ├── testing-utils/         # Test utilities and helpers
│   └── shared/                # Shared Vue components + i18n
└── docs/                      # Documentation
```

## Database (Cloudflare D1)

### Environments

- **Production**: `makanmakan-prod`
- **Staging**: `makanmakan-staging`
- **Local**: Local SQLite database

### Core Tables (21 schema files, 69 tables)

**Business**: users, restaurants, tables, seats, orders, order_items, menu_items, categories, customers
**QR & Media**: qr_codes, qr_templates, qr_batches, qr_downloads, images, image_views, image_processing_jobs
**System**: sessions, audit_logs, error_reports, system_alerts
**Employee Management**: shift_templates, employee_schedules, scheduling_rules, scheduling_conflicts, schedule_swap_requests, employee_availability, leave_types, leave_requests, leave_approval_rules, leave_calendar_events, employee_leave_balances
**Partnership System**: partnerships, partnership_plans, verified_members, partnership_usage_logs
**POS**: cash_registers, cash_shifts, cash_movements, receipts, refunds, shift_reports
**Group Orders**: group_orders, group_members, group_cart_items, split_bills, share_codes, group_activity_logs
**Coupons**: coupons, coupon_usage, coupon_distributions, coupon_templates
**Verification**: password_reset_tokens, email_verification_tokens, phone_verification_tokens, password_change_logs

### Database Migrations

**Source of Truth**: Drizzle schema files in `packages/database/src/schema/`

**Generated Migrations**: `packages/database/migrations_fresh/`

**ID Strategy** (UUID v7):

- Primary keys: `TEXT` (UUID v7 via `packages/utils/src/uuid.ts`)
- `restaurant_id`: `TEXT` referencing `restaurants.id` (UUID v7)
- UUID v7: Time-sortable, globally unique (timestamp in first 48 bits)
- Helpers: `generateUUID()`, `isValidUUID()`, `extractUUIDTimestamp()`
- Timestamps: `INTEGER` (Unix milliseconds via `timestamp_ms` mode)

**Commands**:

```bash
# Generate new migration from schema changes
pnpm db:generate

# Apply migrations locally
pnpm db:migrate:local

# Reset local database (clears all data)
pnpm db:reset:local

# Seed mock data
pnpm db:seed:mock
```

**Adding New Tables**:

1. Create schema file in `packages/database/src/schema/new-table.ts`
2. Export from `packages/database/src/schema/index.ts`
3. Run `pnpm db:generate` to create migration
4. Run `pnpm db:migrate:local` to apply

### Database Commands (Legacy)

```bash
# Apply migrations to remote environments
pnpm db:migrate:staging
pnpm db:migrate:prod

# Query database
npx wrangler d1 execute makanmakan-local --local --command "SELECT * FROM users LIMIT 5" --config=./apps/api/wrangler.toml
```

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm 8+ (required - this project uses pnpm workspaces)
- Cloudflare Account (paid plan for D1, R2, Images)
- Wrangler CLI: `pnpm add -g wrangler`

### Quick Start

```bash
# 1. Install dependencies (must use pnpm)
pnpm install

# 2. Authenticate with Cloudflare
pnpm wrangler login

# 3. Run database migrations
pnpm db:migrate:local

# 4. Start development servers
pnpm dev  # Starts all apps in parallel
```

### Package Manager (pnpm)

**重要**: 此專案使用 pnpm，請勿使用 npm 或 yarn。

**防護機制**:

- `package.json` 的 `engines` 和 `packageManager` 欄位強制使用 pnpm
- `.npmrc` 設定 `engine-strict=true` 會阻止錯誤的套件管理器

**Monorepo 結構**:

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
  - "packages/shared/src/i18n" # 特殊：嵌套的 i18n 套件
```

**維護注意事項** (2025-01-24 修復):

- 所有 scripts 必須使用 `pnpm run` 而非 `npm run`
- CI/CD workflows 必須使用 `pnpm` 命令
- 子目錄的 `node_modules` 是 pnpm 的符號連結，不是重複安裝

### Environment Variables

```env
CLOUDFLARE_API_TOKEN=your_api_token
JWT_SECRET=your_jwt_secret
CLOUDFLARE_IMAGES_KEY=your_images_key
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

## Multi-Role Access System

- **0: Admin** - Full system access
- **1: Shop Owner (店主)** - Restaurant management
- **2: Chef (廚師)** - Kitchen display system
- **3: Service Crew (送菜員)** - Order fulfillment
- **4: Cashier (收銀)** - Payment processing
- **Customer** - Customer registration and ordering (shop QR mode)

## API Endpoints Structure

```
/api/v1/
├── auth/            # Authentication
├── verification/    # Password reset, email/phone verification
├── restaurants/     # Restaurant management (includes shop QR)
├── menu/            # Menu and categories
├── orders/          # Order management
├── tables/          # Table management and QR codes
├── seats/           # Seat management (dual-mode QR)
├── users/           # User/employee management
├── customers/       # Customer registration and profiles
├── leaves/          # Leave management
├── scheduling/      # Employee scheduling
├── analytics/       # Business analytics
├── ai-analytics/    # AI-powered insights
├── forecast/        # Demand forecasting (WMA algorithm + ingredient-level)
├── discovery/       # Restaurant/dish search with full-text indexing
├── ingredients/     # Ingredient management
├── integrations/    # Platform integrations & webhooks
├── guest-orders/    # Guest ordering (no account required)
├── qr/              # QR code generation and templates
├── realtime/        # Realtime WebSocket authentication
├── partnerships/    # Partnership & merchant collaboration
├── pos/             # Point-of-sale system
│   ├── registers/       # Cash register management
│   ├── shifts/          # Cash shift open/close
│   ├── cash-movements/  # Cash in/out tracking
│   ├── receipts/        # Receipt generation
│   ├── refunds/         # Refund processing
│   └── reports/         # Shift reports
├── coupons/         # Coupon & promotion management
├── group-orders/    # Group ordering & split billing
├── reservations/    # Table reservations
├── waiting-list/    # Walk-in waiting list
├── sse/             # Server-Sent Events
├── kitchen/         # Kitchen display API
├── backup/          # Database backup operations
├── cache/           # Cache management
├── monitoring/      # System monitoring
├── notifications/   # Push/email notifications
├── queue/           # Job queue management
├── system/          # System configuration
└── health/          # System health monitoring

Management API (apps/management-api/):
├── /api/v1/tenants/       # Tenant provisioning & management
├── /api/v1/deployments/   # Deployment management
├── /api/v1/licenses/      # License management
├── /api/v1/onboarding/    # Onboarding workflow
├── /api/v1/monitoring/    # Multi-tenant monitoring
├── /api/v1/updates/       # Version sync & updates
└── /health                # Health check

WebSocket Endpoints (apps/realtime/):
├── /customer/:tableId      # Customer real-time updates
├── /admin/:restaurantId    # Admin dashboard updates
├── /kitchen/:restaurantId  # Kitchen display updates
├── /broadcast/:type/:id    # Broadcast events to room
└── /stats/:type/:id        # Connection statistics
```

## Development Commands

### Testing

```bash
pnpm test                    # Unit tests
pnpm typecheck              # TypeScript check
pnpm test:integration       # Integration tests
pnpm test:e2e              # End-to-end tests
```

### Deployment

```bash
pnpm deploy:staging        # Deploy to staging
pnpm deploy:prod          # Deploy to production (automatic on push to main)
```

### Monitoring

```bash
pnpm wrangler tail makanmakan-api-prod                    # View logs
pnpm wrangler d1 execute makanmakan-prod --command "..."  # Query database
```

## Current Development Status

### Production-Ready Features

- Core API infrastructure with 34 feature modules, 29+ endpoint groups
- JWT-based multi-role authentication with bcrypt password hashing
- **Unified Error Handling**: ApiError class + global handler, all routes migrated (2026-03)
- **Verification System**: Password reset, email/phone verification with token management
- QR code service (advanced generation with templates)
- **Shop QR System**: Full-stack shop-level ordering (table-free mode)
- **Seat Management**: Dual-mode QR (table-level or seat-level)
- **AI Analytics**: Complete backend + frontend UI (4 LLM providers)
- **Demand Forecasting**: WMA algorithm with ingredient-level forecasting + admin dashboard UI
- **Discovery System**: Restaurant/dish search with full-text indexing, customer app integration
- **Multi-language Support (i18n)**: 6-language system (zh-TW, zh-CN, en-US, ja-JP, vi-VN, id-ID)
- **Employee Scheduling System**: 100% complete (full-stack with testing)
- **Leave Management System**: 100% complete (full-stack with notification, export, analytics)
- **Realtime Services**: 90% complete (production-ready with frontend integration)
  - WebSocket infrastructure with Durable Objects
  - JWT authentication, role-based message routing
  - Offline reconnection with event history
  - Frontend integration: Customer app, Admin dashboard, Kitchen display
- **Partnership System**: 100% complete (full-stack with comprehensive testing)
- **POS System**: Cash registers, shifts, movements, receipts, refunds, shift reports
- **Coupon System**: Coupons, usage tracking, distributions, templates
- **Group Orders & Split Billing**: Group ordering with cart sharing, split bills, share codes, activity logs
- **Hybrid Deployment Architecture**: Multi-tenant management portal + API, tenant provisioning, license management
- **Onboarding System**: New customer onboarding workflow (dedicated app)
- **Backup & Recovery**: Automated D1 backup scheduler with R2 storage
- **Print Agent**: Local receipt printing via Express + WebSocket
- **Image Processing**: Dedicated image optimization worker
- **Drizzle ORM Migration (Stage 2)**: 19 services migrated from raw D1 SQL to Drizzle ORM
- Customer authentication and profile management
- Account management page (owner + admin tabs)
- PWA with 95/100 performance score
- Comprehensive error monitoring and logging
- Complete test coverage and CI/CD pipeline

### In Development

- **Realtime Services - Final 10%**: Performance testing, monitoring dashboard, staging deployment
- **POS Frontend**: Admin dashboard integration for POS features
- **Reservation System**: Completion of reservations and waiting-list frontend

### Next Phase

- Payment integration (payment gateway)
- Native mobile apps
- Advanced analytics dashboards

## Key Features

### Core Functionality

- Multi-restaurant SaaS with tenant isolation
- QR code-based ordering (table, seat, or shop modes)
- Real-time order tracking (Durable Objects)
- Role-based access control with specialized interfaces
- POS system with cash register, shift, and receipt management
- Coupon and promotion management system
- Group ordering with split billing
- Global edge deployment for low latency

### Advanced Features

- Hybrid multi-tenant deployment (management portal + API)
- Smart multi-layer caching strategy
- Business analytics with custom metrics
- AI-powered product analysis and insights (4 LLM providers)
- Progressive Web App for offline functionality
- Automated backup and disaster recovery (D1 → R2)
- Local print agent for receipt printing
- Automated monitoring with health checks and alerting

## Common Tasks

### QR Code Generation

- Individual QR: `POST /api/v1/qr/generate`
- Bulk generation: `POST /api/v1/qr/bulk`
- Shop QR: `POST /api/v1/restaurants/:id/qr/shop/generate`
- Seat QR: `POST /api/v1/seats/batch-create`

### User Role Management

- API: `POST/PUT /api/v1/users/{restaurant_id}`
- Permission matrix: `packages/shared-types/permissions.ts`

### Menu Items

- API: `POST /api/v1/menu/{restaurant_id}/items`
- Frontend: Admin dashboard → Menu Management
- Images: Auto-processed with multiple variants

## Performance Targets

- **API Response Time**: P99 < 300ms
- **Database Query Time**: P95 < 100ms
- **Image Load Time**: P90 < 1s
- **WebSocket Latency**: < 50ms

## Security

### Data Protection

- AES-256 encryption for sensitive data
- Bcrypt password hashing (cost factor 10)
- JWT tokens with secure refresh logic
- Comprehensive input validation

### Access Control

- WAF rules for API protection
- Rate limiting (per-IP and per-user)
- Complete audit trail for all operations
- Role-based access control (RBAC)

## Coding Conventions

### Error Response Format (Enforced)

All API error responses MUST use the unified format:

```typescript
{
  success: false,
  error: {
    code: string,       // e.g. "NOT_FOUND", "VALIDATION_ERROR"
    message: string,    // user-safe message (auto-sanitized)
    details?: unknown   // optional: field-level validation errors
  }
}
```

**How to use:**

- Throw `ApiError` from route handlers/services — the global `app.onError` handler formats it automatically
- Use factory functions: `notFound()`, `badRequest()`, `unauthorized()`, `forbidden()`, `conflict()` from `shared/utils/api-error.ts`
- Do NOT write try-catch in route handlers for error formatting — let errors propagate to the global handler
- Validation middleware and auth middleware already produce this format

**Example:**

```typescript
import { notFound } from "../../../shared/utils/api-error";

app.get("/:id", async (c) => {
  const item = await service.getById(id);
  if (!item) throw notFound("Item not found", "ITEM_NOT_FOUND");
  return c.json({ success: true, data: item });
});
```

### Database Query Pattern (New Features)

New feature services MUST use **Drizzle ORM** for all database queries. Do NOT use raw D1 `db.prepare()` SQL in new code.

**Why:** The codebase has 4 legacy query patterns (raw SQL, BaseService, DB delegation, Drizzle). Drizzle provides type-safe queries derived from the schema — column renames/type changes are caught at compile time. Raw SQL requires manual type assertions that can silently drift.

**How to use:**

```typescript
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { myTable } from "@makanmakan/database";

const db = drizzle(env.DB);
const results = await db
  .select()
  .from(myTable)
  .where(eq(myTable.restaurantId, id));
```

**Reference implementation:** `apps/api/src/features/integrations/services/PlatformIntegrationService.ts`

**Migration status:** Stage 2 completed (2026-03) — 19 services migrated to Drizzle ORM. Remaining raw SQL in a few legacy services is acceptable until those services are individually modified.

## Error Handling

### Common Issues

1. **D1 Connection Errors**: Check wrangler.toml bindings
2. **KV Cache Misses**: Verify namespace configuration
3. **Image Upload Failures**: Check R2 bucket permissions
4. **WebSocket Disconnections**: Monitor Durable Objects health

### Debug Tools

- Worker logs: `pnpm wrangler tail`
- Health endpoint: `/api/v1/health`
- Error tracking: Automatic Slack notifications

## Recent Major Achievements

**For detailed changelog, see: `docs/archive/CHANGELOG.md`**

### Latest (2026-03-16)

- **Unified Error Response System**: ApiError class with factory functions, global error handler rewrite, all routes migrated to unified format, zValidator replaced with custom middleware
- **Drizzle ORM Migration Stage 2**: 19 services migrated from raw D1 SQL to Drizzle ORM
- **Management API Security**: AES encryption, auth middleware, real deployment configuration
- **Documentation Restructuring**: Completed feature docs moved to archive, simplified navigation

### Previous (2026-03-14)

- **Discovery System**: Full-stack restaurant/dish search with full-text indexing, customer app UI
- **Forecast System**: Demand forecasting with WMA algorithm, ingredient-level forecasting, admin dashboard
- **Ingredient Management**: Ingredient definitions, menu item ingredients linking
- **Test Coverage Expansion**: ~400+ new tests across seats, forecast, ai-analytics, waiting-list, integrations, verification

### Previous (2026-02-13)

- **CLAUDE.md Sync with Reality**: Comprehensive documentation update
  - Updated project structure (11 apps, 8 packages + i18n)
  - Documented UUID v7 migration, 69 database tables across 21 schema files

### Previous (2026-02-06)

- **Testing Infrastructure Phase 2 Complete**: 48/45 test files (107% of target)
- **API Documentation Phase 3 Complete**: 16/16 endpoint groups documented (120+ OpenAPI routes)

## Documentation

See `docs/README.md` for full documentation navigation.

### Key References

- `docs/architecture/technical-documentation.md` - Technical specifications
- `docs/requirements.md` - Product requirements
- `docs/archive/CHANGELOG.md` - Development changelog

### Active Feature Docs

- `docs/features/realtime-services/` - Realtime services (Phase 4 pending)
- `docs/superpowers/plans/` - Current implementation plans

### User Manuals

- `docs/user-manuals/SCHEDULING_MANUAL.md` - Employee scheduling (bilingual)
- `docs/user-manuals/LEAVE_MANAGEMENT_MANUAL.md` - Leave management (bilingual)
- `docs/user-manuals/AI_ANALYTICS_USER_MANUAL.md` - AI analytics
- `docs/user-manuals/{locale}/` - Role-specific guides (7 languages)

### Completed Feature Docs (Archived)

- `docs/archive/completed-features/employee-management/` - Scheduling & leave implementation
- `docs/archive/completed-features/ai-analytics/` - AI analytics implementation
- `docs/archive/completed-features/partnership-system/` - Partnership implementation
- `docs/archive/completed-features/shop-qr/` - Shop QR implementation
- `docs/archive/completed-features/seat-management/` - Seat management guide
- `docs/archive/completed-features/realtime-services/` - Realtime Phase 1-3 docs

---

**Last Updated**: 2026-03-16
**Architecture**: 2.0 (Cloudflare Serverless + Hybrid Deployment)
**Status**: Production Ready | ✅ 0 TypeScript Errors | ✅ 0 ESLint Errors | 95/100 PWA Score
**Systems**: 11 apps, 8 packages, 21 schema files (69+ tables), 34 feature modules, UUID v7
**Complete**: Employee Management | Partnership | POS | Coupons | Group Orders | Verification | Forecast | Discovery | Testing Phase 1-3 | Unified Error Handling | Drizzle ORM Stage 2
**In Progress**: Realtime Services (90%) | POS Frontend | Reservations

- Always use context7 when I need code generation, setup or configuration steps, or
  library/API documentation. This means you should automatically use the Context7 MCP
  tools to resolve library id and get library docs without me having to explicitly ask.
