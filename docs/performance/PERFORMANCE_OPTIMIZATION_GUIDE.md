# Performance Optimization Implementation Guide

**Quick Start Guide for MakanMakan Performance Improvements**

This guide provides step-by-step instructions to implement the performance optimizations identified in the analysis. Each optimization is designed to be implemented independently without breaking existing functionality.

---

## Prerequisites

Before starting, ensure you have:

- [x] Backup of production database
- [x] Access to staging environment
- [x] Performance baseline metrics recorded
- [x] Cloudflare Wrangler CLI installed
- [x] Node.js 20+ and pnpm installed

---

## Phase 1: Critical Database Optimizations (30 minutes)

### Step 1.1: Apply Performance Indexes

**Expected Impact**: 85-92% query performance improvement

```bash
# 1. Test on staging first
cd packages/database/migrations

# 2. Apply migration to staging
npx wrangler d1 migrations apply makanmakan-staging \
  --env staging \
  --file 20251001_performance_indexes.sql

# 3. Verify indexes were created
npx wrangler d1 execute makanmakan-staging --env staging \
  --command "SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY tbl_name;"

# 4. Test query performance on staging
npx wrangler d1 execute makanmakan-staging --env staging \
  --command "EXPLAIN QUERY PLAN SELECT * FROM menu_items WHERE restaurant_id = 1 AND is_available = true ORDER BY sort_order;"

# Expected output should show: "USING INDEX idx_menu_items_restaurant_available"
```

**Performance Verification**:

```bash
# Before optimization - should be slow (500-800ms)
time npx wrangler d1 execute makanmakan-staging --env staging \
  --command "SELECT * FROM menu_items WHERE restaurant_id = 1 AND is_available = true ORDER BY sort_order LIMIT 50;"

# After optimization - should be fast (20-40ms)
# Same command after indexes applied
```

**Deploy to Production** (during low-traffic hours):

```bash
# Production deployment
npx wrangler d1 migrations apply makanmakan-prod \
  --env production \
  --file 20251001_performance_indexes.sql

# Verify
npx wrangler d1 execute makanmakan-prod --env production \
  --command "SELECT COUNT(*) as index_count FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%';"
```

### Step 1.2: Optimize Database Statistics

```bash
# Analyze tables to update query planner statistics
npx wrangler d1 execute makanmakan-prod --env production \
  --command "ANALYZE menu_items;"

npx wrangler d1 execute makanmakan-prod --env production \
  --command "ANALYZE orders;"

npx wrangler d1 execute makanmakan-prod --env production \
  --command "ANALYZE order_items;"

npx wrangler d1 execute makanmakan-prod --env production \
  --command "ANALYZE categories;"
```

---

## Phase 2: Fix N+1 Query Pattern (1-2 hours)

### Step 2.1: Backup Current Order Service

```bash
# Create backup of current implementation
cp packages/database/src/services/order.ts \
   packages/database/src/services/order.backup.ts
```

### Step 2.2: Apply Optimized Order Service

**Option A: Gradual Migration (Recommended)**

```typescript
// packages/database/src/services/index.ts

// Export both versions during transition
export { OrderService } from "./order"; // Existing
export { OrderServiceOptimized } from "./order.optimized"; // New

// Feature flag for gradual rollout
const USE_OPTIMIZED_ORDER_SERVICE =
  process.env.USE_OPTIMIZED_ORDER_SERVICE === "true";

export function createOrderService(db: D1Database) {
  return USE_OPTIMIZED_ORDER_SERVICE
    ? new OrderServiceOptimized(db)
    : new OrderService(db);
}
```

**Option B: Direct Replacement**

```bash
# Replace order service with optimized version
mv packages/database/src/services/order.ts \
   packages/database/src/services/order.legacy.ts

mv packages/database/src/services/order.optimized.ts \
   packages/database/src/services/order.ts
```

### Step 2.3: Test Order Service

```bash
# Run unit tests
cd packages/database
pnpm test order.test.ts

# Run integration tests
cd ../../apps/api
pnpm test:integration -- --grep "Order"

# Test on staging
curl https://api-staging.makanmakan.app/api/v1/orders \
  -H "Authorization: Bearer $STAGING_TOKEN" \
  -w "\nTime: %{time_total}s\n"

# Expected: < 150ms (was 680ms)
```

### Step 2.4: Monitor Performance

```bash
# Enable query logging temporarily
export DEBUG_QUERIES=true

# Check Cloudflare Workers logs
npx wrangler tail makanmakan-api-staging

# Look for: "Queries executed: 1" (should not be > 5)
```

---

## Phase 3: Bundle Size Optimization (2-3 hours)

### Step 3.1: Update Vite Configuration

```bash
# Backup current config
cp apps/customer-app/vite.config.ts \
   apps/customer-app/vite.config.backup.ts

# Use optimized config
cp apps/customer-app/vite.config.optimized.ts \
   apps/customer-app/vite.config.ts
```

### Step 3.2: Implement Lazy Loading for QR Scanner

```typescript
// apps/customer-app/src/router/index.ts

const routes = [
  // ... other routes

  {
    path: "/scan",
    name: "QRScan",
    // CRITICAL: Lazy load QR scanner (removes 381KB from initial bundle)
    component: () =>
      import(
        /* webpackChunkName: "qr-scanner" */
        /* webpackPrefetch: false */
        "../views/QRScanView.vue"
      ),
    meta: {
      title: "掃描 QR Code",
    },
  },

  {
    path: "/menu",
    name: "Menu",
    component: () =>
      import(
        /* webpackChunkName: "menu" */
        /* webpackPrefetch: true */
        "../views/MenuView.vue"
      ),
    meta: {
      requiresAuth: true,
    },
  },

  {
    path: "/cart",
    name: "Cart",
    component: () =>
      import(
        /* webpackChunkName: "cart" */
        /* webpackPrefetch: true */
        "../views/CartView.vue"
      ),
  },
];
```

### Step 3.3: Build and Analyze Bundle

```bash
cd apps/customer-app

# Clean previous build
rm -rf dist

# Build with analysis
ANALYZE=true pnpm build

# Check bundle sizes
ls -lh dist/assets/*.js | awk '{print $5, $9}'

# Expected results:
# - Initial bundle: ~380KB (was 825KB)
# - QR scanner chunk: ~381KB (loaded on demand)
# - vue-vendor: ~98KB
# - utils-vendor: ~42KB
```

### Step 3.4: Test Lazy Loading

```typescript
// Test in browser dev tools

// 1. Open Network tab
// 2. Load homepage
// 3. Verify QR scanner NOT loaded initially
// 4. Navigate to /scan
// 5. Verify QR scanner chunk loads on demand
// 6. Check total loaded JS < 500KB before /scan

// Performance metrics to check:
// - LCP should be < 1.5s (was 3.2s)
// - FCP should be < 1.0s (was 1.8s)
// - TTI should be < 2.5s (was 4.1s)
```

### Step 3.5: Enable Compression

```bash
# Install compression plugins
cd apps/customer-app
pnpm add -D vite-plugin-compression2 rollup-plugin-visualizer

# Already configured in vite.config.optimized.ts
# Verify compression after build:
ls -lh dist/assets/*.{br,gz}

# Expected: .br files should be 70-80% smaller than .js files
```

---

## Phase 4: Cache Strategy Enhancement (2 hours)

### Step 4.1: Update Cache Middleware

```typescript
// apps/api/src/middleware/cache.ts

export const CACHE_STRATEGIES = {
  MENU: {
    ttl: 1800, // 30 minutes (was 300)
    tags: ["menu"],
    priority: "high",
    invalidateOn: ["menu_update", "item_availability"],
    preload: true, // NEW: Enable predictive preloading
  },

  RESTAURANT: {
    ttl: 3600, // 1 hour (was 300)
    tags: ["restaurant"],
    priority: "high",
    invalidateOn: ["restaurant_update"],
    preload: true,
  },

  ANALYTICS: {
    ttl: (timeRange: string) => {
      switch (timeRange) {
        case "1h":
          return 60; // 1 min for real-time
        case "24h":
          return 300; // 5 min
        case "7d":
          return 1800; // 30 min
        case "30d":
          return 3600; // 1 hour
        default:
          return 300;
      }
    },
    tags: ["analytics"],
    priority: "normal",
    invalidateOn: ["order_completed"],
    preload: false,
  },
};

// Granular cache invalidation
export const invalidateMenuCache = (restaurantId?: number) =>
  cacheInvalidationMiddleware(
    restaurantId ? [`menu:${restaurantId}`] : ["menu"],
  );
```

### Step 4.2: Integrate Intelligent D1 Service

```typescript
// packages/database/src/services/menu.ts

import { IntelligentD1Service } from "./intelligent-d1";

export class MenuService extends BaseService {
  private intelligentDb?: IntelligentD1Service;

  constructor(d1: D1Database, cacheManager?: any) {
    super(d1);
    if (cacheManager) {
      this.intelligentDb = new IntelligentD1Service(d1, cacheManager);
    }
  }

  async getMenu(restaurantId: number): Promise<MenuStructure> {
    if (this.intelligentDb) {
      return this.intelligentDb.executeWithOptimization(
        this.getMenuQuery(),
        [restaurantId],
        {
          cacheKey: `menu:${restaurantId}`,
          cacheTtl: 1800,
          tags: [`menu`, `restaurant:${restaurantId}`],
          enablePreloading: true,
        },
      );
    }

    return this.standardGetMenu(restaurantId);
  }
}
```

### Step 4.3: Test Cache Performance

```bash
# Test cache hit rate
curl https://api-staging.makanmakan.app/api/v1/menu/1 \
  -H "Authorization: Bearer $TOKEN" \
  -I | grep "X-Cache"

# First request: X-Cache: MISS
# Second request: X-Cache: HIT

# Verify cache TTL
curl https://api-staging.makanmakan.app/api/v1/menu/1 \
  -H "Authorization: Bearer $TOKEN" \
  -I | grep -E "X-Cache|Age"

# Monitor cache hit rate
npx wrangler tail makanmakan-api-staging | grep "Cache"

# Target metrics:
# - Menu endpoints: > 90% hit rate
# - Restaurant data: > 85% hit rate
# - Analytics: > 75% hit rate
```

---

## Phase 5: Component Performance (3-4 hours)

### Step 5.1: Optimize MenuItemCard

```vue
<!-- apps/customer-app/src/components/MenuItemCard.vue -->

<script setup lang="ts">
import { computed } from "vue";

// Memoize expensive calculations
const imageUrl = computed(() => {
  const url = props.item.imageVariants?.medium || props.item.imageUrl;
  if (url?.startsWith("/")) {
    return `${import.meta.env.VITE_IMAGE_BASE_URL || ""}${url}`;
  }
  return url;
});

// Cache lazy loading config
const lazyConfig = computed(() => ({
  src: imageUrl.value,
  placeholder: "/placeholder-food.jpg",
  quality: 85,
  progressive: true,
}));

// Memoize dietary tags
const dietaryTags = computed(() => {
  const dietary = props.item.dietaryInfo;
  if (!dietary) return [];

  const tags = [];
  if (dietary.vegetarian) {
    tags.push({
      key: "vegetarian",
      label: "素食",
      class: "bg-green-100 text-green-800",
    });
  }
  // ... other tags

  return tags;
});
</script>

<template>
  <img v-lazy="lazyConfig" :alt="item.name" class="lazy-image" />
</template>
```

### Step 5.2: Optimize VirtualOrderGrid

```typescript
// apps/kitchen-display/src/components/VirtualOrderGrid.vue

import { useDebounceFn } from "@vueuse/core";

// Debounce scroll handler for 60fps
const handleScroll = useDebounceFn(async (event: Event) => {
  const target = event.target as HTMLElement;
  scrollTop.value = target.scrollTop;

  if (props.hasMore && !isLoadingMore.value) {
    const scrolledPercentage =
      (target.scrollTop + target.clientHeight) / target.scrollHeight;
    if (scrolledPercentage > 0.9) {
      await loadMoreItems();
    }
  }
}, 16); // 60fps = 16ms frame time

// Increase buffer for smoother scrolling
const bufferSize = ref(5); // was 3

// Use RAF for smooth updates
const updateVisibleItems = () => {
  requestAnimationFrame(() => {
    // Recalculate visible orders
  });
};
```

### Step 5.3: Optimize Cart Store

```typescript
// apps/customer-app/src/stores/cart.ts

import { useDebounceFn } from "@vueuse/core";

// Debounced save to localStorage
const debouncedSave = useDebounceFn(() => {
  if (!restaurantId.value || !tableId.value) return;

  const cartData = {
    items: items.value,
    restaurantId: restaurantId.value,
    tableId: tableId.value,
    timestamp: Date.now(),
  };

  // Async write using requestIdleCallback
  requestIdleCallback(() => {
    try {
      localStorage.setItem(getCartStorageKey(), JSON.stringify(cartData));
    } catch (error) {
      console.warn("保存購物車失敗:", error);
    }
  });
}, 500); // Batch saves every 500ms

// Batch add items
const addItems = (itemsToAdd: CartItem[]) => {
  itemsToAdd.forEach((item) => {
    items.value.push(item);
  });
  debouncedSave(); // Single save after all additions
};
```

---

## Phase 6: Deployment & Monitoring

### Step 6.1: Deploy to Staging

```bash
# Build all apps
pnpm build

# Deploy API to staging
cd apps/api
npx wrangler deploy --env staging

# Deploy customer app to staging
cd ../customer-app
npx wrangler pages deploy dist --project-name makanmakan-customer-staging

# Deploy admin dashboard
cd ../admin-dashboard
npx wrangler pages deploy dist --project-name makanmakan-admin-staging
```

### Step 6.2: Performance Testing

```bash
# Load testing with autocannon
npx autocannon -c 100 -d 30 \
  https://api-staging.makanmakan.app/api/v1/menu/1

# Expected results:
# - Latency P95: < 200ms
# - Throughput: > 500 req/s
# - Error rate: < 0.1%

# Lighthouse performance test
npx lighthouse https://staging.makanmakan.app \
  --only-categories=performance \
  --chrome-flags="--headless"

# Expected scores:
# - Performance: > 90
# - LCP: < 1.5s
# - FCP: < 1.0s
# - TTI: < 2.5s
```

### Step 6.3: Monitor Production Metrics

```bash
# Setup monitoring endpoint
curl https://api.makanmakan.app/api/v1/monitoring/performance

# Expected response:
{
  "frontend": {
    "lcp": 1400,
    "fcp": 850,
    "tti": 2100
  },
  "backend": {
    "apiResponseP95": 150,
    "dbQueryP95": 45,
    "cacheHitRate": 0.85
  },
  "database": {
    "activeConnections": 12,
    "avgQueryTime": 38
  }
}
```

### Step 6.4: Cloudflare Analytics

```bash
# View Workers analytics
npx wrangler tail makanmakan-api-prod --format pretty

# Key metrics to monitor:
# - CPU time: < 50ms per request
# - Duration: < 200ms P95
# - Errors: < 0.1% rate
# - Requests: Steady increase post-optimization
```

---

## Rollback Procedures

### If Database Indexes Cause Issues:

```bash
# Remove indexes
npx wrangler d1 execute makanmakan-prod --env production \
  --file packages/database/migrations/rollback_indexes.sql

# Or selectively remove specific index:
npx wrangler d1 execute makanmakan-prod --env production \
  --command "DROP INDEX idx_menu_items_restaurant_available;"
```

### If Order Service Has Issues:

```bash
# Revert to original service
git checkout packages/database/src/services/order.ts

# Or use feature flag
export USE_OPTIMIZED_ORDER_SERVICE=false
npx wrangler deploy --env production
```

### If Bundle Optimization Breaks:

```bash
# Restore original config
git checkout apps/customer-app/vite.config.ts

# Rebuild and redeploy
pnpm build
npx wrangler pages deploy dist
```

---

## Performance Verification Checklist

After all optimizations are deployed, verify:

- [ ] **Database Performance**
  - [ ] Menu queries: < 50ms P95
  - [ ] Order listing: < 100ms P95
  - [ ] Analytics: < 200ms P95

- [ ] **API Performance**
  - [ ] Response time P95: < 200ms
  - [ ] Cache hit rate: > 80%
  - [ ] Error rate: < 0.1%

- [ ] **Frontend Performance**
  - [ ] Initial bundle: < 400KB
  - [ ] LCP: < 1.5s
  - [ ] FCP: < 1.0s
  - [ ] TTI: < 2.5s
  - [ ] Lighthouse score: > 90

- [ ] **Business Metrics**
  - [ ] Bounce rate decreased
  - [ ] Order completion rate increased
  - [ ] User session duration increased
  - [ ] Infrastructure costs reduced

---

## Monitoring Dashboard Setup

```typescript
// Create performance monitoring dashboard

// 1. Add monitoring route
app.get("/api/v1/monitoring/dashboard", async (c) => {
  const metrics = {
    frontend: {
      lcp: await getMetric("lcp"),
      fcp: await getMetric("fcp"),
      tti: await getMetric("tti"),
      bundleSize: await getMetric("bundleSize"),
    },
    backend: {
      apiResponseP95: await getMetric("apiResponseP95"),
      dbQueryP95: await getMetric("dbQueryP95"),
      cacheHitRate: await getMetric("cacheHitRate"),
    },
    business: {
      conversionRate: await getMetric("conversionRate"),
      avgOrderValue: await getMetric("avgOrderValue"),
      orderCompletionRate: await getMetric("orderCompletionRate"),
    },
  };

  return c.json({ success: true, data: metrics });
});

// 2. Setup alerts
const performanceAlerts = {
  lcp: { threshold: 2500, severity: "warning" },
  apiResponseP95: { threshold: 300, severity: "critical" },
  cacheHitRate: { threshold: 0.7, severity: "warning" },
};

// 3. Automated reports
setInterval(async () => {
  const report = await generatePerformanceReport();
  await sendToSlack(report);
}, 3600000); // Hourly reports
```

---

## Expected Results Summary

After implementing all optimizations:

```
┌────────────────────────┬──────────┬──────────┬──────────────┐
│ Metric                 │ Before   │ After    │ Improvement  │
├────────────────────────┼──────────┼──────────┼──────────────┤
│ Initial Load Time      │ 3.2s     │ 1.2s     │ 62% faster   │
│ LCP                    │ 3.2s     │ 1.4s     │ 56% faster   │
│ FCP                    │ 1.8s     │ 0.9s     │ 50% faster   │
│ TTI                    │ 4.1s     │ 2.0s     │ 51% faster   │
│ Bundle Size            │ 825KB    │ 380KB    │ 54% smaller  │
│ API Response P95       │ 450ms    │ 120ms    │ 73% faster   │
│ Menu Query             │ 520ms    │ 40ms     │ 92% faster   │
│ Order Listing          │ 680ms    │ 80ms     │ 88% faster   │
│ Cache Hit Rate         │ 45%      │ 85%      │ +40pp        │
│ Infrastructure Cost    │ $X       │ $0.6X    │ 40% savings  │
└────────────────────────┴──────────┴──────────┴──────────────┘
```

---

## Support & Troubleshooting

### Common Issues

**Issue: Indexes not improving performance**

```bash
# Solution: Analyze tables
npx wrangler d1 execute makanmakan-prod --env production \
  --command "ANALYZE;"
```

**Issue: Cache hit rate still low**

```bash
# Solution: Check cache configuration
curl -I https://api.makanmakan.app/api/v1/menu/1 | grep Cache

# Verify invalidation isn't too aggressive
```

**Issue: Bundle still large**

```bash
# Solution: Analyze bundle composition
ANALYZE=true pnpm build
# Check dist/stats.html for large dependencies
```

### Getting Help

- Performance issues: Check `PERFORMANCE_ANALYSIS_REPORT.md`
- Database issues: See `packages/database/README.md`
- Build issues: Check Vite documentation

---

**Last Updated**: 2025-10-01
**Next Review**: After Phase 6 deployment
