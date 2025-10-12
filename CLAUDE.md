# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MakanMakan is a modern, serverless restaurant management system built on Cloudflare's edge computing platform. The system provides online ordering, menu management, table management, and multi-role user access with real-time functionality. It supports multiple restaurants/shops with their own menus, tables, and staff, delivered through a scalable, cost-effective SaaS architecture.

## Architecture Status

**✅ MIGRATION COMPLETED**
- **Legacy System**: PHP + MySQL (archived externally)
- **New System**: Cloudflare Workers + D1 + TypeScript (**Production Ready**)
- **TypeScript Status**: ✅ 100% Error-Free (0 errors across all apps)
- **ESLint Status**: ✅ 100% Compliance (0 errors, 0 warnings)
- **PWA Performance**: ✅ 95/100 Score
- **Current Phase**: Feature enhancement and optimization

## Technology Stack

- **Frontend**: Vue.js 3 + TypeScript (Cloudflare Pages)
- **Backend**: Cloudflare Workers + TypeScript
- **Database**: Cloudflare D1 (SQLite-compatible serverless SQL)
- **Cache**: Cloudflare KV Store
- **Real-time**: Durable Objects (WebSocket connections)
- **File Storage**: Cloudflare R2 + Images API
- **Monitoring**: Workers Analytics + Custom metrics
- **Security**: Cloudflare WAF + Zero Trust

## Project Structure

```
makanmakan/
├── apps/
│   ├── customer-app/          # Consumer ordering app
│   ├── admin-dashboard/       # Restaurant management dashboard
│   ├── kitchen-display/       # Kitchen display system
│   ├── api/                   # API services (Cloudflare Workers)
│   └── realtime/              # Real-time services (Durable Objects)
├── packages/
│   ├── shared-types/          # TypeScript definitions
│   ├── database/              # D1 schema & migrations
│   ├── utils/                 # Shared utilities
│   ├── queue-core/            # Queue system core
│   └── shared/                # Shared Vue components
└── docs/                      # Documentation
```

## Database (Cloudflare D1)

### Environments
- **Production**: `makanmakan-prod`
- **Staging**: `makanmakan-staging`
- **Local**: Local SQLite database

### Core Tables
**Business**: users, restaurants, tables, seats, orders, order_items, menu_items, categories, customers
**QR & Media**: qr_codes, qr_templates, qr_batches, images, image_variants
**System**: sessions, audit_logs, error_reports
**AI Analytics**: ai_configurations, ai_insights_cache, product_analytics, ai_usage_logs
**Employee Management**: shift_templates, employee_schedules, leave_types, leave_requests, employee_leave_balances

### Database Commands
```bash
# Apply migrations
npx wrangler d1 migrations apply makanmakan-staging --env staging
npx wrangler d1 migrations apply makanmakan-prod --env production

# Query database
npx wrangler d1 execute makanmakan-staging --local --command "SELECT * FROM users LIMIT 5"
```

## Development Setup

### Prerequisites
- Node.js 20+
- Cloudflare Account (paid plan for D1, R2, Images)
- Wrangler CLI: `npm install -g wrangler`

### Quick Start
```bash
# 1. Install dependencies
npm install

# 2. Authenticate with Cloudflare
npx wrangler login

# 3. Run database migrations
npm run db:migrate:local

# 4. Start development servers
npm run dev  # Starts all apps in parallel
```

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
├── auth/          # Authentication
├── restaurants/   # Restaurant management (includes shop QR)
├── menu/          # Menu and categories
├── orders/        # Order management
├── tables/        # Table management and QR codes
├── seats/         # Seat management (dual-mode QR)
├── users/         # User/employee management
├── customers/     # Customer registration and profiles
├── leaves/        # Leave management (designed, pending implementation)
├── scheduling/    # Employee scheduling (43% complete)
├── analytics/     # Business analytics
├── ai-analytics/  # AI-powered insights (backend complete)
├── qr/            # QR code generation and templates
└── health/        # System health monitoring
```

## Development Commands

### Testing
```bash
npm run test                    # Unit tests
npm run typecheck              # TypeScript check (✅ 0 errors)
npm run test:integration       # Integration tests
npm run test:e2e              # End-to-end tests
```

### Deployment
```bash
npm run deploy:staging        # Deploy to staging
npm run deploy:prod          # Deploy to production (automatic on push to main)
```

### Monitoring
```bash
npx wrangler tail makanmakan-api-prod                    # View logs
npx wrangler d1 execute makanmakan-prod --command "..."  # Query database
```

## Current Development Status

### ✅ Production-Ready Features
- Core API infrastructure (0 TypeScript errors)
- JWT-based multi-role authentication with bcrypt password hashing
- QR code service (advanced generation with templates)
- **Shop QR System**: Full-stack shop-level ordering (table-free mode)
- **Seat Management**: Dual-mode QR (table-level or seat-level)
- Customer authentication and profile management
- PWA with 95/100 performance score
- Comprehensive error monitoring and logging
- Complete test coverage and CI/CD pipeline

### 🔨 In Development
- **Employee Scheduling System**: 43% complete (schema ✅, service/API pending)
- Real-time features (WebSocket/SSE)
- **AI Analytics Frontend**: Backend complete, UI pending
- **Leave Management Frontend**: Design complete, implementation pending

### 📋 Next Phase
- Employee Management UI (scheduling + leave systems)
- Multi-language support (i18n framework)
- Payment Integration (deferred to Phase 2)
- Native mobile apps

## Key Features

### Core Functionality
- Multi-restaurant SaaS with tenant isolation
- QR code-based ordering (table, seat, or shop modes)
- Real-time order tracking (Durable Objects)
- Role-based access control with specialized interfaces
- Global edge deployment for low latency

### Advanced Features
- Smart multi-layer caching strategy
- Business analytics with custom metrics
- AI-powered product analysis and insights (4 LLM providers)
- Progressive Web App for offline functionality
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

## Error Handling

### Common Issues
1. **D1 Connection Errors**: Check wrangler.toml bindings
2. **KV Cache Misses**: Verify namespace configuration
3. **Image Upload Failures**: Check R2 bucket permissions
4. **WebSocket Disconnections**: Monitor Durable Objects health

### Debug Tools
- Worker logs: `npx wrangler tail`
- Health endpoint: `/api/v1/health`
- Error tracking: Automatic Slack notifications

## Recent Major Achievements

📋 **For detailed changelog, see: `docs/archive/CHANGELOG.md`**

### Latest (2025-10-11)
- 🔄 **Employee Scheduling System**: Schema complete, service layer in progress (43%)

### Recent (2025-10-10)
- ✅ **Shop-Level QR System**: Full-stack implementation (2,860 lines, 3 phases)
- ✅ **Leave Management System**: Complete design ready for implementation
- ✅ **Password Security**: Migrated to bcrypt hashing

### Previous Milestones (2025-09/10)
- ✅ **Seat Management**: Dual-mode QR (table/seat level)
- ✅ **AI Analytics**: Multi-LLM support (4 providers, backend complete)
- ✅ **PWA Optimization**: 95/100 performance score
- ✅ **TypeScript Compliance**: 100% error-free across all apps
- ✅ **ESLint Compliance**: 0 errors, 0 warnings
- ✅ **Payment System Removal**: Simplified architecture (14 tables removed)

## Documentation

### Architecture & Technical
- `docs/architecture/technical-documentation.md` - Technical specifications
- `docs/requirements.md` - Product requirements

### Implementation Guides
- `docs/EMPLOYEE_SCHEDULING_IMPLEMENTATION.md` - Scheduling system (2,100+ lines)
- `docs/LEAVE_MANAGEMENT_IMPLEMENTATION.md` - Leave management (1,865 lines)
- `docs/AI_ANALYTICS_IMPLEMENTATION.md` - AI analytics (750+ lines)

### Additional Resources
- Feature docs: `docs/features/`
- Performance guides: `docs/performance/`
- Migration guides: `docs/migration/`
- Deployment guides: `docs/deployment/`
- API guides: `docs/api/`
- Changelog: `docs/archive/CHANGELOG.md`

---

**Last Updated**: 2025-10-11
**Architecture**: 2.0 (Cloudflare Serverless)
**Status**: Production Ready | 0 TypeScript Errors | 0 ESLint Errors | 95/100 PWA Score
- Always use context7 when I need code generation, setup or configuration steps, or
library/API documentation. This means you should automatically use the Context7 MCP
tools to resolve library id and get library docs without me having to explicitly ask.