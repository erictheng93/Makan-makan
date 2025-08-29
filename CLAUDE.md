# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MakanMakan is a modern, serverless restaurant management system built on Cloudflare's edge computing platform. The system provides online ordering, menu management, table management, and multi-role user access with real-time functionality. It supports multiple restaurants/shops with their own menus, tables, and staff, delivered through a scalable, cost-effective SaaS architecture.

## Architecture Transition Status

**🚧 MIGRATION IN PROGRESS 🚧**
- **Legacy System**: PHP + MySQL (in `/legacy/` folder)
- **New System**: Cloudflare Workers + D1 + TypeScript (active development)
- **Migration Status**: Complete rewrite to serverless architecture

## New System Architecture (Cloudflare Ecosystem)

### Technology Stack
- **Frontend**: Vue.js 3 + TypeScript (Cloudflare Pages)
- **Backend**: Cloudflare Workers + TypeScript
- **Database**: Cloudflare D1 (SQLite-compatible serverless SQL)
- **Cache**: Cloudflare KV Store
- **Real-time**: Durable Objects (WebSocket connections)
- **File Storage**: Cloudflare R2 + Images API
- **Monitoring**: Workers Analytics + Custom metrics
- **Security**: Cloudflare WAF + Zero Trust

### Project Structure
```
makanmakan/
├── apps/
│   ├── customer-app/          # Consumer ordering app (Cloudflare Pages)
│   ├── admin-dashboard/       # Restaurant management dashboard
│   ├── api/                   # API services (Cloudflare Workers)
│   ├── realtime/              # Real-time services (Durable Objects)
│   └── image-processor/       # Image processing worker
├── packages/
│   ├── shared-types/          # Shared TypeScript definitions
│   ├── database/              # D1 database schema & migrations
│   └── utils/                 # Shared utilities
├── legacy/                    # Original PHP system (deprecated)
└── docs/                      # Documentation
    ├── requirements_optimized.md  # Product Requirements Document
    └── technical-documentation.md # Technical specifications
```

## Database Configuration (Cloudflare D1)

### Database Setup
- **Production**: `makanmakan-prod` (Cloudflare D1)
- **Staging**: `makanmakan-staging` (Cloudflare D1)
- **Local Development**: Local SQLite database

### Key Tables (New Schema)
- `users`: Multi-role user accounts (Admin, Owner, Chef, Service, Cashier)
- `restaurants`: Restaurant information and settings
- `tables`: Table management with QR code generation
- `orders`: Order records with status tracking
- `order_items`: Individual order items with customizations
- `menu_items`: Menu items with image variants
- `categories`: Menu categories
- `sessions`: User sessions (also cached in KV)
- `audit_logs`: System activity logging

### Database Operations
```bash
# Apply migrations to staging
npx wrangler d1 migrations apply makanmakan-staging --env staging

# Apply migrations to production  
npx wrangler d1 migrations apply makanmakan-prod --env production

# Execute SQL queries locally
npx wrangler d1 execute makanmakan-staging --local --command "SELECT * FROM users LIMIT 5"
```

## Development Workflow

### Prerequisites
- Node.js 20+
- Cloudflare Account with paid plan (for D1, R2, Images)
- Wrangler CLI: `npm install -g wrangler`

### Local Development Setup
```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env.local

# 3. Authenticate with Cloudflare
npx wrangler login

# 4. Create local D1 database
npx wrangler d1 create makanmakan-local --local

# 5. Run database migrations
npm run db:migrate:local

# 6. Start development servers
npm run dev  # Starts all apps in parallel
```

### Environment Configuration

#### Required Environment Variables
```env
# Cloudflare API Token (for deployments)
CLOUDFLARE_API_TOKEN=your_api_token

# JWT Secret for authentication
JWT_SECRET=your_jwt_secret

# Cloudflare Images API
CLOUDFLARE_IMAGES_KEY=your_images_key

# Slack webhook for error notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

#### Wrangler Configuration
Each app has its own `wrangler.toml` with environment-specific bindings:
- D1 databases
- KV namespaces  
- R2 buckets
- Durable Object bindings
- Queue producers

### Multi-Role Access System (Unchanged Logic)
The system maintains the same role-based permissions:
- **0: Admin** - Full system access
- **1: Shop Owner (店主)** - Restaurant management
- **2: Chef (廚師)** - Kitchen display system
- **3: Service Crew (送菜員)** - Order fulfillment
- **4: Cashier (收銀)** - Payment processing

### API Endpoints Structure
```
/api/v1/
├── auth/          # Authentication (login, register, refresh)
├── restaurants/   # Restaurant management
├── menu/          # Menu and categories
├── orders/        # Order management
├── tables/        # Table management and QR codes
├── users/         # User/employee management
├── analytics/     # Business analytics
└── health/        # System health checks
```

## Development Commands

### Database Management
```bash
# Create and apply migrations
npm run db:migrate:create <migration_name>
npm run db:migrate:staging
npm run db:migrate:prod

# Seed data for development
npm run db:seed:local
npm run db:seed:staging
```

### Testing
```bash
# Unit tests
npm run test

# Integration tests
npm run test:integration

# End-to-end tests
npm run test:e2e

# Test coverage
npm run test:coverage
```

### Deployment
```bash
# Deploy to staging (automatic on push to develop branch)
npm run deploy:staging

# Deploy to production (automatic on push to main branch)  
npm run deploy:prod

# Manual deployment
npm run build && npm run deploy
```

### Monitoring and Debugging
```bash
# View logs for specific worker
npx wrangler tail makanmakan-api-prod

# View D1 database
npx wrangler d1 execute makanmakan-prod --command "SELECT COUNT(*) FROM orders"

# Monitor KV usage
npx wrangler kv:key list --binding CACHE_KV
```

## Key Features (Updated)

### Core Functionality
- **Multi-restaurant SaaS platform** with tenant isolation
- **QR code-based ordering** with dynamic QR generation
- **Real-time order tracking** using WebSockets (Durable Objects)
- **Role-based access control** with specialized interfaces
- **Image optimization** using Cloudflare Images API
- **Global edge deployment** for low latency worldwide

### Advanced Features  
- **Smart caching** with multi-layer cache strategy
- **Business analytics** with custom metrics tracking
- **Automated monitoring** with health checks and alerting
- **Progressive Web App (PWA)** for offline functionality
- **Multi-language support** preparation for international expansion
- **API-first design** for future integrations

## Common Development Tasks

### Adding New Menu Items
- **API**: POST `/api/v1/menu/{restaurant_id}/items`
- **Frontend**: Admin dashboard → Menu Management → Add Item
- **Images**: Automatic processing with multiple variants (thumbnail, medium, large)

### Managing User Roles
- **API**: POST/PUT `/api/v1/users/{restaurant_id}`
- **Permission Matrix**: Defined in `packages/shared-types/permissions.ts`
- **Role Interfaces**: Specialized UI for each role in admin dashboard

### QR Code Generation
- **Bulk Generation**: POST `/api/v1/tables/{restaurant_id}/bulk-qr`
- **Individual**: GET `/api/v1/tables/{restaurant_id}/{id}/qr`
- **Customization**: Logo, colors, size variants supported

### Real-time Order Updates
- **WebSocket Connection**: Handled by Durable Objects
- **Event Broadcasting**: Order status changes trigger notifications
- **Role-based Filtering**: Different roles receive different notification types

### Analytics and Reporting
- **Dashboard Data**: GET `/api/v1/analytics/{restaurant_id}/dashboard`
- **Custom Reports**: Time-range filtering with caching
- **Export Options**: JSON, CSV, PDF formats

## Error Handling and Debugging

### Common Issues
1. **D1 Connection Errors**: Check wrangler.toml bindings
2. **KV Cache Misses**: Verify namespace configuration
3. **Image Upload Failures**: Check R2 bucket permissions
4. **WebSocket Disconnections**: Monitor Durable Objects health

### Debug Tools
- **Worker Logs**: `npx wrangler tail`
- **D1 Query**: Direct database access via wrangler
- **Health Endpoint**: `/api/v1/health` for system status
- **Error Tracking**: Automatic Slack notifications for critical errors

## Performance Optimization

### Caching Strategy
- **Static Assets**: Cloudflare CDN with long cache times
- **API Responses**: KV cache with smart invalidation
- **Database Queries**: Query result caching with TTL
- **Image Delivery**: Cloudflare Images with global distribution

### Monitoring Targets
- **API Response Time**: P99 < 300ms
- **Database Query Time**: P95 < 100ms  
- **Image Load Time**: P90 < 1s
- **WebSocket Latency**: < 50ms for real-time updates

## Security Considerations

### Data Protection
- **Encryption**: AES-256 for sensitive data at rest
- **JWT Tokens**: Secure token management with refresh logic
- **Input Validation**: Comprehensive validation on all inputs
- **CORS**: Strict origin validation

### Access Control  
- **WAF Rules**: Custom rules for API protection
- **Rate Limiting**: Per-IP and per-user rate limits
- **Geographic Restrictions**: Admin interface geo-blocking
- **Audit Logging**: Complete audit trail for all operations

## Migration from Legacy System

### Data Migration Process
1. **Export Legacy Data**: Custom PHP scripts in `/legacy/migration/`
2. **Transform Schema**: Map old structure to new D1 tables
3. **Import to D1**: Batch import with validation
4. **Verify Data Integrity**: Automated checks and reports
5. **Cutover Planning**: Blue-green deployment strategy

### Backward Compatibility
- **API Endpoints**: Legacy endpoints redirected during transition
- **File References**: Image URLs mapped to new R2/Images structure  
- **User Sessions**: Gradual migration of active sessions
- **QR Codes**: Legacy QR codes continue to work during transition

## Future Roadmap

### Planned Enhancements (Phase 2)
- **Advanced Analytics**: AI-powered insights and recommendations
- **Payment Integration**: Multi-payment gateway support
- **Inventory Management**: Smart inventory tracking with predictions
- **Marketing Automation**: Customer segment targeting
- **Mobile Apps**: Native iOS/Android applications
- **API Marketplace**: Third-party integrations and extensions

---

**Last Updated**: 2025-08-21  
**Architecture Version**: 2.0 (Cloudflare Serverless)  
**Legacy Version**: 1.0 (PHP/MySQL - Deprecated)

For detailed technical specifications, see `docs/technical-documentation.md`
For product requirements, see `docs/requirements_optimized.md`