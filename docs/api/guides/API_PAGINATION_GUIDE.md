# API Response Pagination Guide

## Overview

Standardized pagination implementation across all API endpoints for consistent data fetching, improved performance, and better user experience.

**Implementation Date**: 2025-10-02
**Phase**: Week 3 - Medium Priority (Performance & Scalability)

---

## Pagination Strategies

### 1. Offset-Based Pagination (Page Numbers)

**Best for**: Traditional pagination with page numbers, data tables, admin interfaces

**Pros**:

- Easy to implement
- User-friendly (jump to specific page)
- Good for static data

**Cons**:

- Performance degrades with high offsets
- Inconsistent with real-time data (items shift between pages)

**Use Cases**: Orders list, user management, reports

### 2. Cursor-Based Pagination

**Best for**: Real-time feeds, infinite scroll, mobile apps

**Pros**:

- Consistent results (no duplicates/missing items)
- Better performance at scale
- Works well with real-time data

**Cons**:

- Can't jump to specific page
- More complex to implement

**Use Cases**: Message feeds, activity logs, social media feeds

### 3. Infinite Scroll

**Best for**: Mobile apps, content discovery, continuous browsing

**Pros**:

- Seamless user experience
- Mobile-optimized
- Natural content discovery

**Cons**:

- Harder to find specific items
- Memory usage grows over time

**Use Cases**: Menu browsing, product catalogs, image galleries

---

## Implementation

### Backend (API Routes)

#### Example 1: Basic Pagination

```typescript
import { paginateQuery } from "@makanmasak/database/utils/pagination-helpers";

app.get("/orders", async (c) => {
  const db = c.env.DB;
  const restaurantId = c.get("restaurantId");

  const params = {
    page: Number(c.req.query("page")) || 1,
    pageSize: Number(c.req.query("pageSize")) || 20,
    sortBy: c.req.query("sortBy") || "createdAt",
    sortOrder: c.req.query("sortOrder") || "desc",
  };

  const response = await paginateQuery(
    db,
    db.select().from(orders),
    orders,
    params,
    eq(orders.restaurantId, restaurantId),
  );

  return c.json(response);
});
```

**Response Format**:

```json
{
  "data": [
    { "id": 1, "totalAmount": 50.0, "status": "completed" },
    { "id": 2, "totalAmount": 35.5, "status": "pending" }
  ],
  "pagination": {
    "currentPage": 1,
    "pageSize": 20,
    "totalItems": 156,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPreviousPage": false,
    "startIndex": 0,
    "endIndex": 19
  },
  "timestamp": "2025-10-02T12:00:00.000Z"
}
```

#### Example 2: Search with Pagination

```typescript
import { searchWithPagination } from "@makanmasak/database/utils/pagination-helpers";

app.get("/menu/search", async (c) => {
  const db = c.env.DB;
  const searchQuery = c.req.query("q") || "";

  const response = await searchWithPagination(
    db,
    menuItems,
    ["name", "description"], // Search fields
    searchQuery,
    { page: 1, pageSize: 10 },
    eq(menuItems.restaurantId, restaurantId),
  );

  return c.json(response);
});
```

#### Example 3: Cursor-Based Pagination

```typescript
import { paginateWithCursor } from "@makanmasak/database/utils/pagination-helpers";

app.get("/messages", async (c) => {
  const cursor = c.req.query("cursor");
  const limit = Number(c.req.query("limit")) || 20;

  const response = await paginateWithCursor(
    db,
    messages,
    { cursor, limit },
    "id", // Cursor field
    "createdAt", // Sort field
  );

  return c.json(response);
});
```

**Response Format**:

```json
{
  "data": [{ "id": 123, "text": "Hello", "createdAt": "2025-10-02T12:00:00Z" }],
  "pagination": {
    "count": 20,
    "nextCursor": "eyJpZCI6MTQzfQ==",
    "previousCursor": "eyJpZCI6MTAzfQ==",
    "hasMore": true
  }
}
```

### Frontend (Vue Composables)

#### Example 1: Standard Pagination (Admin Dashboard)

```vue
<script setup lang="ts">
import { usePagination } from "@/composables/usePagination";
import api from "@/services/api";

const {
  data: orders,
  pagination,
  isLoading,
  loadPage,
  nextPage,
  previousPage,
  changePageSize,
  search,
} = usePagination(
  (params) => api.get("/orders", { params }).then((r) => r.data),
  { pageSize: 20, sortBy: "createdAt", sortOrder: "desc" },
);

// Load first page on mount
onMounted(() => loadPage(1));
</script>

<template>
  <div>
    <!-- Search -->
    <input
      type="text"
      @input="search($event.target.value)"
      placeholder="Search orders..."
    />

    <!-- Data Table -->
    <table v-if="!isLoading && !isEmpty">
      <tr v-for="order in orders" :key="order.id">
        <td>{{ order.id }}</td>
        <td>{{ order.totalAmount }}</td>
        <td>{{ order.status }}</td>
      </tr>
    </table>

    <!-- Loading State -->
    <div v-if="isLoading">Loading...</div>

    <!-- Pagination Controls -->
    <div class="pagination">
      <button @click="previousPage" :disabled="isFirstPage">Previous</button>
      <span
        >Page {{ pagination.currentPage }} of {{ pagination.totalPages }}</span
      >
      <button @click="nextPage" :disabled="isLastPage">Next</button>
    </div>

    <!-- Page Size Selector -->
    <select @change="changePageSize($event.target.value)">
      <option value="10">10 per page</option>
      <option value="20" selected>20 per page</option>
      <option value="50">50 per page</option>
    </select>
  </div>
</template>
```

#### Example 2: Infinite Scroll (Mobile PWA)

```vue
<script setup lang="ts">
import { useInfiniteScroll } from "@/composables/usePagination";
import api from "@/services/api";

const {
  items: menuItems,
  isLoading,
  hasMore,
  loadMore,
  containerRef,
  sentinelRef,
} = useInfiniteScroll(
  (params) => api.get("/menu", { params }).then((r) => r.data),
  { pageSize: 10, autoLoad: true },
);
</script>

<template>
  <div ref="containerRef" class="menu-list">
    <!-- Menu Items -->
    <div v-for="item in menuItems" :key="item.id" class="menu-item">
      <h3>{{ item.name }}</h3>
      <p>{{ item.description }}</p>
      <span>${{ item.price }}</span>
    </div>

    <!-- Sentinel Element (triggers auto-load) -->
    <div ref="sentinelRef" v-if="hasMore" class="sentinel">
      <div v-if="isLoading" class="spinner">Loading more...</div>
    </div>

    <!-- End of List -->
    <div v-if="!hasMore && !isLoading" class="end-message">No more items</div>

    <!-- Manual Load More Button (if needed) -->
    <button
      v-if="hasMore && !isLoading"
      @click="loadMore"
      class="load-more-btn"
    >
      Load More
    </button>
  </div>
</template>
```

#### Example 3: Pull-to-Refresh (Mobile)

```vue
<script setup lang="ts">
import {
  useInfiniteScroll,
  usePullToRefresh,
} from "@/composables/usePagination";

const { items, refresh } = useInfiniteScroll(fetchData);

const {
  isRefreshing,
  pullDistance,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
} = usePullToRefresh(refresh);
</script>

<template>
  <div
    class="container"
    @touchstart="handleTouchStart"
    @touchmove="handleTouchMove"
    @touchend="handleTouchEnd"
  >
    <!-- Pull-to-Refresh Indicator -->
    <div
      v-if="pullDistance > 0"
      class="pull-indicator"
      :style="{ height: pullDistance + 'px' }"
    >
      <div v-if="isRefreshing" class="spinner">Refreshing...</div>
      <div v-else>Pull to refresh</div>
    </div>

    <!-- Content -->
    <div v-for="item in items" :key="item.id">
      {{ item.name }}
    </div>
  </div>
</template>
```

---

## Configuration

### Default Settings

```typescript
const DEFAULT_PAGINATION_CONFIG = {
  defaultPageSize: 20,
  maxPageSize: 100,
  minPageSize: 1,
  defaultSortOrder: "desc",
};
```

### Customization Per Endpoint

```typescript
// Small page size for mobile
const MOBILE_PAGE_SIZE = 10;

// Large page size for exports
const EXPORT_PAGE_SIZE = 1000;

// Real-time feed limit
const FEED_LIMIT = 50;
```

---

## Performance Optimizations

### 1. Database Indexes

Ensure indexes on commonly sorted/filtered columns:

```sql
-- Pagination indexes
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_orders_restaurant_status ON orders(restaurant_id, status, created_at);
CREATE INDEX idx_menu_items_name ON menu_items(name);
```

### 2. Query Optimization

```typescript
// BAD: N+1 query problem
const orders = await db.select().from(orders).limit(20);
for (const order of orders) {
  const items = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));
}

// GOOD: Use eager loading
const orders = await db.query.orders.findMany({
  limit: 20,
  with: {
    orderItems: true,
  },
});
```

### 3. Caching

```typescript
// Cache paginated responses
const cacheKey = `orders:page:${page}:${pageSize}`
const cached = await kv.get(cacheKey)
if (cached) return cached

const response = await paginateQuery(...)
await kv.put(cacheKey, response, { expirationTtl: 60 }) // 1 minute
```

### 4. Cursor Optimization

```typescript
// Use efficient cursor fields (indexed, unique, sequential)
// ✅ Good: id, createdAt (indexed)
// ❌ Bad: name, email (not sequential)

await paginateWithCursor(db, table, options, "id", "createdAt");
```

---

## Best Practices

### ✅ DO

1. **Validate pagination params** - Prevent injection and out-of-bounds errors
2. **Set max page size** - Protect against memory exhaustion
3. **Use appropriate strategy** - Offset for static, cursor for real-time
4. **Add database indexes** - Essential for performance at scale
5. **Return metadata** - Help clients understand pagination state
6. **Document limits** - Clearly communicate max page sizes
7. **Handle empty results** - Return proper response structure

### ❌ DON'T

1. **Don't fetch all data** - Always paginate large datasets
2. **Don't use high offsets** - Performance degrades (use cursor instead)
3. **Don't forget total count** - Clients need this for UI
4. **Don't ignore sort order** - Can cause inconsistent results
5. **Don't skip validation** - Always validate input params
6. **Don't cache forever** - Set reasonable TTLs
7. **Don't ignore errors** - Handle edge cases gracefully

---

## Error Handling

### Common Errors

```typescript
// Invalid page number
if (page < 1) {
  return c.json({ error: 'Page number must be >= 1' }, 400)
}

// Page size too large
if (pageSize > MAX_PAGE_SIZE) {
  return c.json({ error: `Page size must be <= ${MAX_PAGE_SIZE}` }, 400)
}

// Invalid cursor
try {
  const decoded = decodeCursor(cursor)
} catch {
  return c.json({ error: 'Invalid cursor' }, 400)
}

// No results
if (data.length === 0) {
  return c.json({
    data: [],
    pagination: { ... },
    message: 'No results found'
  })
}
```

---

## Testing

### Unit Tests

```typescript
import { describe, it, expect } from "vitest";
import {
  calculatePaginationMeta,
  validatePaginationParams,
} from "@makanmasak/shared-types";

describe("Pagination", () => {
  it("should calculate correct pagination metadata", () => {
    const meta = calculatePaginationMeta(2, 20, 156);

    expect(meta.currentPage).toBe(2);
    expect(meta.totalPages).toBe(8);
    expect(meta.hasNextPage).toBe(true);
    expect(meta.hasPreviousPage).toBe(true);
    expect(meta.startIndex).toBe(20);
    expect(meta.endIndex).toBe(39);
  });

  it("should validate pagination params", () => {
    const { valid, errors } = validatePaginationParams({
      page: 0,
      pageSize: 1000,
    });

    expect(valid).toBe(false);
    expect(errors).toContain("Page number must be >= 1");
    expect(errors).toContain("Page size must be <= 100");
  });
});
```

### Integration Tests

```typescript
describe("GET /orders", () => {
  it("should return paginated orders", async () => {
    const response = await api.get("/orders?page=1&pageSize=10");

    expect(response.status).toBe(200);
    expect(response.data.data).toHaveLength(10);
    expect(response.data.pagination.currentPage).toBe(1);
    expect(response.data.pagination.pageSize).toBe(10);
    expect(response.data.pagination.totalItems).toBeGreaterThan(0);
  });

  it("should handle search with pagination", async () => {
    const response = await api.get("/menu/search?q=pizza&page=1");

    expect(response.status).toBe(200);
    expect(
      response.data.data.every((item) => item.name.includes("pizza")),
    ).toBe(true);
  });
});
```

---

## Migration Guide

### Migrating Existing Endpoints

**Before** (no pagination):

```typescript
app.get("/orders", async (c) => {
  const orders = await db.select().from(orders);
  return c.json(orders);
});
```

**After** (with pagination):

```typescript
app.get("/orders", async (c) => {
  const params = {
    page: Number(c.req.query("page")) || 1,
    pageSize: Number(c.req.query("pageSize")) || 20,
  };

  const response = await paginateQuery(
    db,
    db.select().from(orders),
    orders,
    params,
  );
  return c.json(response);
});
```

**Backward Compatibility**:

```typescript
// Support old clients that don't send pagination params
const page = c.req.query('page')
if (!page) {
  // Return all data (deprecated, log warning)
  console.warn('[DEPRECATED] Endpoint called without pagination')
  const data = await db.select().from(orders).limit(1000)
  return c.json({ data, deprecated: true })
}

// New clients with pagination
const response = await paginateQuery(...)
return c.json(response)
```

---

## Monitoring

### Metrics to Track

1. **Average page size requested**
2. **95th percentile query duration**
3. **Cache hit rate**
4. **Cursor decoding errors**
5. **Empty result rate**
6. **High offset warnings**

### Logging

```typescript
// Log slow pagination queries
const startTime = Date.now()
const response = await paginateQuery(...)
const duration = Date.now() - startTime

if (duration > 1000) {
  console.warn('[Pagination] Slow query:', {
    endpoint: c.req.url,
    duration,
    params
  })
}
```

---

## Related Guides

- `REQUEST_DEDUPLICATION_GUIDE.md` - Prevent duplicate requests
- `BUNDLE_OPTIMIZATION_GUIDE.md` - Code splitting strategies
- `PERFORMANCE_OPTIMIZATION_GUIDE.md` - Overall performance

---

**Last Updated**: 2025-10-02
**Maintained By**: MakanMakan Development Team
