# 🏗️ Modular Architecture Guide

## Overview

This document describes the new modular architecture implemented for the MakanMakan API, following Domain-Driven Design (DDD) principles. The architecture provides better organization, maintainability, and scalability for our growing feature set.

## 📁 Directory Structure

```
apps/api/src/
├── features/                 # Feature modules (Domain-Driven Design)
│   ├── qr-codes/            # QR code generation and management
│   ├── orders/              # Order processing and tracking
│   ├── analytics/           # Business analytics and reporting
│   ├── auth/                # Authentication and authorization
│   └── ...                  # Additional features
├── shared/                  # Shared utilities and components
│   ├── middleware/          # Common middleware functions
│   ├── utils/               # Utility functions
│   ├── types/               # Shared TypeScript types
│   ├── constants/           # Application constants
│   └── templates/           # Feature templates
├── core/                    # Core system functionality
│   ├── database/            # Database connection and operations
│   ├── cache/               # Caching services
│   └── monitoring/          # Logging and monitoring
└── routes/                  # Legacy routes (being migrated)
```

## 🎯 Feature Module Structure

Each feature module follows a consistent structure:

```
features/feature-name/
├── index.ts                 # Feature module entry point
├── routes/                  # HTTP route definitions
│   └── index.ts
├── services/                # Business logic services
│   └── FeatureService.ts
├── schemas/                 # Validation schemas
│   └── validation.ts
├── types/                   # Feature-specific types
│   └── index.ts
└── __tests__/              # Feature tests
    └── feature.test.ts
```

## 🚀 Creating New Features

### Option 1: Using the Feature Generator

```bash
# Create a new feature module
node scripts/migration/create-feature.js --name=my-feature --type=simple

# This will generate:
# - Complete feature structure
# - Template files with proper naming
# - Test files
# - Package.json scripts
```

### Option 2: Manual Creation

1. Copy the template from `shared/templates/feature-template/`
2. Replace all `{{FEATURE_NAME}}` placeholders
3. Implement your business logic
4. Add tests and documentation

## 📋 Migration Process

### Phase 1: Infrastructure ✅ (Completed)

- [x] Created modular directory structure
- [x] Built shared utilities and core modules
- [x] Created feature templates
- [x] Built migration tools

### Phase 2: Pilot Migration (QR Codes)

```bash
# 1. Create QR codes feature module
node scripts/migration/create-feature.js --name=qr-codes

# 2. Analyze existing routes
node scripts/migration/migrate-routes.js --source=routes/qrcode.ts --target=features/qr-codes/ --generate-stubs

# 3. Manual migration of business logic
# 4. Update imports
node scripts/migration/update-imports.js --from="routes/qrcode" --to="features/qr-codes" --dry-run

# 5. Test and validate
npm run test:qr-codes
```

### Phase 3: Core Features Migration

Priority order:

1. **orders** (544 lines) - Core business functionality
2. **analytics** (845 lines) - Complex but isolated
3. **tables** (748 lines) - Table and queue management
4. **users** (652 lines) - User management

### Phase 4: Remaining Features

- auth, menu, pos, monitoring, backup

## 🔧 Development Guidelines

### 1. Feature Independence

- Each feature should be self-contained
- Minimize cross-feature dependencies
- Use shared modules for common functionality

### 2. Consistent Structure

- Follow the established template structure
- Use consistent naming conventions
- Include comprehensive tests

### 3. Service Layer Pattern

```typescript
// Service handles business logic
export class OrderService {
  constructor(private env: Env) {
    this.db = getDatabaseConnection(env);
    this.cache = new KVCacheService(env.CACHE_KV);
    this.logger = new ConsoleLogger("orders");
  }

  async createOrder(data: CreateOrderData): Promise<Order> {
    // Business logic here
  }
}
```

### 4. Route Layer Pattern

```typescript
// Routes handle HTTP concerns only
app.post("/", authMiddleware, validateBody(orderSchemas.create), async (c) => {
  const service = new OrderService(c.env);
  const result = await service.createOrder(c.req.valid("json"));
  return c.json(createSuccessResponse(result));
});
```

## 🧪 Testing Strategy

### Unit Tests

- Test business logic in services
- Mock external dependencies
- Focus on edge cases and error handling

### Integration Tests

- Test HTTP endpoints
- Use real database connections
- Test feature interactions

### Performance Tests

- Monitor response times
- Test under load
- Validate caching effectiveness

## 📊 Monitoring and Observability

Each feature module includes:

- **Structured logging** with feature context
- **Performance tracking** for operations
- **Error reporting** with Slack integration
- **Custom metrics** collection

```typescript
// Built-in monitoring
const timer = this.performance.startTimer("orders.create");
try {
  const result = await this.businessLogic();
  this.performance.recordMetric("orders.create.success", 1);
  return result;
} catch (error) {
  this.logger.error("Order creation failed", error);
  throw error;
} finally {
  this.performance.endTimer(timer);
}
```

## 🔄 Migration Tools Reference

### create-feature.js

Creates new feature modules from templates

```bash
node scripts/migration/create-feature.js --name=my-feature [--type=simple|complex]
```

### migrate-routes.js

Analyzes existing routes and suggests migration strategy

```bash
node scripts/migration/migrate-routes.js --source=routes/file.ts --target=features/name/ [--generate-stubs]
```

### update-imports.js

Updates import paths after migration

```bash
node scripts/migration/update-imports.js --from="old/path" --to="new/path" [--dry-run] [--check-types]
```

## 🔐 Security Considerations

- Feature modules inherit shared security middleware
- Each feature can add specific authorization rules
- Audit logging built into core services
- Input validation using Zod schemas

## 🚀 Deployment Impact

### Zero-Downtime Migration

- New feature modules work alongside legacy routes
- Progressive migration with fallback support
- Environment-based feature flags for testing

### Performance Benefits

- Better code splitting and tree shaking
- Improved caching at feature level
- Reduced bundle sizes for specific deployments

## 📈 Future Roadmap

### Phase 2 Enhancements

- **Micro-frontend support** - Feature-specific UI components
- **Event-driven architecture** - Inter-feature communication
- **A/B testing framework** - Feature flag system

### Phase 3 - Microservices Ready

- **Service extraction** - Convert features to standalone services
- **API gateway** - Centralized routing and authentication
- **Distributed caching** - Cross-service cache coordination

## 🤝 Contributing

### Adding New Features

1. Use the feature generator or template
2. Follow established patterns
3. Include comprehensive tests
4. Update documentation
5. Submit PR with migration plan

### Migrating Existing Code

1. Analyze with migration tools
2. Create feature module structure
3. Extract business logic to services
4. Move routes to feature module
5. Update imports and test

### Best Practices

- Keep features small and focused
- Use shared modules for common functionality
- Include proper error handling and logging
- Write tests before refactoring
- Document breaking changes

---

**Last Updated**: 2025-09-25
**Architecture Version**: 2.0
**Migration Status**: Phase 1 Complete ✅
