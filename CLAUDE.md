# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MakanMakan is a modern, serverless restaurant management system built on Cloudflare's edge computing platform. The system provides online ordering, menu management, table management, and multi-role user access with real-time functionality. It supports multiple restaurants/shops with their own menus, tables, and staff, delivered through a scalable, cost-effective SaaS architecture.

## Technology Stack

- **Frontend**: Vue.js 3 + TypeScript (Cloudflare Pages)
- **Backend**: Cloudflare Workers + TypeScript
- **Database**: Cloudflare D1 (SQLite-compatible serverless SQL)
- **Cache**: Cloudflare KV Store
- **Real-time**: Durable Objects (WebSocket connections)
- **File Storage**: Cloudflare R2 + Images API
- **Build System**: Turborepo (parallel builds with caching)
- **Backup**: Cloudflare Workers Cron + R2
- **Print**: Local Node.js agent (Express + WebSocket)
- **Security**: Cloudflare WAF + Zero Trust

## Database (Cloudflare D1)

### Schema & Migrations

- **Source of Truth**: Drizzle schema files in `packages/database/src/schema/` (includes subdirectories)
- **Generated Migrations**: `packages/database/migrations_fresh/`
- **ID Strategy**: `TEXT` primary keys using UUID v7 (`packages/utils/src/uuid.ts`). Timestamps: `INTEGER` (Unix ms via `timestamp_ms` mode).

```bash
pnpm db:generate        # Generate migration from schema changes
pnpm db:migrate:local   # Apply migrations locally
pnpm db:reset:local     # Reset local database (clears all data)
pnpm db:seed:mock       # Seed mock data
```

**Adding New Tables**: Create schema in `packages/database/src/schema/`, export from `index.ts`, run `pnpm db:generate` then `pnpm db:migrate:local`.

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm 8+ (required — enforced via `package.json` engines and `.npmrc`)
- Cloudflare Account (paid plan for D1, R2, Images)

### Quick Start

```bash
pnpm install            # Must use pnpm (not npm/yarn)
pnpm wrangler login     # Authenticate with Cloudflare
pnpm db:migrate:local   # Run database migrations
pnpm dev                # Start all apps in parallel
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

## Development Commands

```bash
# Development
pnpm dev                # Start all apps in parallel
pnpm dev:api            # API only
pnpm dev:customer       # Customer app only
pnpm dev:admin          # Admin dashboard only
pnpm dev:kitchen        # Kitchen display only

# Testing
pnpm test               # All vitest tests (unit + feature)
pnpm test:unit          # Unit tests only
pnpm test:e2e           # End-to-end tests (Playwright)
pnpm test:e2e:ui        # E2E with Playwright UI
pnpm test:ci            # CI pipeline tests (unit + e2e)
pnpm test:coverage      # Tests with coverage report

# Type checking & linting
pnpm typecheck          # TypeScript check (all packages)
pnpm lint               # Lint all packages
pnpm lint:fix           # Auto-fix lint issues

# Deployment
pnpm deploy:staging     # Deploy to staging
pnpm deploy:prod        # Deploy to production
```

## Common Tasks

### QR Code Generation

- Individual QR: `POST /api/v1/qr/generate`
- Bulk generation: `POST /api/v1/qr/bulk`
- Shop QR: `POST /api/v1/restaurants/:id/qr/shop/generate`
- Seat QR: `POST /api/v1/seats/batch-create`

### User Role Management

- API: `POST/PUT /api/v1/users/{restaurant_id}`
- Role definitions: `apps/api/src/shared/constants/index.ts`

### Menu Items

- API: `POST /api/v1/menu/{restaurant_id}/items`
- Frontend: Admin dashboard → Menu Management

## Performance Targets

- **API Response Time**: P99 < 300ms
- **Database Query Time**: P95 < 100ms
- **Image Load Time**: P90 < 1s
- **WebSocket Latency**: < 50ms

## Security

- AES-256 encryption for sensitive data
- Bcrypt password hashing (cost factor 10)
- JWT tokens with secure refresh logic
- WAF rules, rate limiting (per-IP and per-user)
- Complete audit trail, role-based access control (RBAC)

## Coding Conventions

### UI/UX Design System (Enforced)

All frontend UI design and implementation MUST follow the **Apple-Native Soft Minimalism** design system defined in `docs/UIUX-design-system.md`.

**Key rules:**

- Page background: `#F2F2F7` (iOS system gray)
- Cards: white + `rounded-2xl` ~ `rounded-3xl` + soft shadow (`opacity ≤ 8%`)
- No hard borders — use shadow + background color difference for separation
- Buttons/tags: pill-shaped (`rounded-full`)
- Text: never pure black, use `#1C1C1E`; strong title/body contrast
- Colors: `#007AFF` (primary), `#34C759` (success), `#FF9500` (warning), `#FF3B30` (error)
- Icons: SF Symbols / Lucide Icons, outline/filled toggle
- Animations: 200-350ms, ease-out, iOS-native feel
- Output: Vue + Tailwind CSS with `ios-*` color tokens (see Section 14.2 of design doc)
- **Always check the Section 15 Design Checklist before outputting UI**

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
- Use factory functions: `notFound()`, `badRequest()`, `unauthorized()`, `forbidden()`, `conflict()` from `apps/api/src/shared/utils/api-error.ts`
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

### Database Query Strategy (Two Layers — Enforced)

All database queries MUST use one of the two approved layers. Raw string SQL (Layer 3) is **banned** in new code.

| Layer                                    | When to use                           | Column safety   |
| ---------------------------------------- | ------------------------------------- | --------------- |
| **Layer 1: Drizzle Query Builder**       | CRUD, simple JOINs, filters           | ✅ Compile-time |
| **Layer 2: Drizzle `sql` + Schema Refs** | Complex analytics, CTEs, aggregations | ✅ Compile-time |

**Why:** Raw SQL string column names silently drift when schema migrates. Both Layer 1 and Layer 2 reference Drizzle schema objects, so column renames cause **compile-time errors** instead of runtime 500s.

**Layer 1 — Drizzle Query Builder** (CRUD, simple queries):

```typescript
import { eq, and } from "drizzle-orm";
import { menuItems } from "@makanmakan/database";

const results = await db
  .select()
  .from(menuItems)
  .where(eq(menuItems.restaurantId, id));
```

**Layer 2 — Drizzle `sql` template + Schema References** (complex analytics):

```typescript
import {
  sql,
  eq,
  and,
  between,
  menuItems,
  orders,
  orderItems,
} from "@makanmakan/database";

const result = await db
  .select({
    itemName: menuItems.name,
    totalOrders: sql<number>`COUNT(DISTINCT ${orders.id})`,
    totalRevenue: sql<number>`SUM(${orderItems.totalPrice})`,
  })
  .from(menuItems)
  .leftJoin(orderItems, eq(menuItems.id, orderItems.menuItemId))
  .leftJoin(orders, eq(orderItems.orderId, orders.id))
  .where(
    and(
      eq(orders.restaurantId, restaurantId),
      between(orders.createdAt, new Date(startMs), new Date(endMs)),
    ),
  )
  .groupBy(menuItems.id);
```

**Reference implementations:**

- Layer 1: `apps/api/src/features/integrations/services/PlatformIntegrationService.ts`
- Layer 2: `packages/ai-analytics/src/services/ProductAnalysisService.ts`

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

## Documentation

See `docs/README.md` for full documentation navigation, and `docs/archive/CHANGELOG.md` for detailed changelog.

Key reference: `docs/UIUX-design-system.md` — mandatory for all UI work.

---

- Always use context7 when I need code generation, setup or configuration steps, or
  library/API documentation. This means you should automatically use the Context7 MCP
  tools to resolve library id and get library docs without me having to explicitly ask.

## gstack

- Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.
- Available skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`.
- If gstack skills aren't working, run `cd .claude/skills/gstack && ./setup` to build the binary and register skills.
