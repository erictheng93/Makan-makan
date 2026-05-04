# Database Timestamp Best Practices

## Overview

This document outlines the best practices for handling timestamps in the MakanMasak codebase, especially for database operations.

## Background

### The Problem

When using `CURRENT_TIMESTAMP` in SQL queries:

- **Production (Cloudflare D1)**: Works correctly with real SQLite
- **Testing (sql.js)**: May return `NULL` due to limited SQLite function support

This causes `NOT NULL constraint failed` errors in test environments.

###Example Error

```
Error: NOT NULL constraint failed: waiting_queue.created_at
    at QueueServiceModular.joinQueue (QueueServiceModular.ts:128:9)
```

---

## ✅ Best Practice: Use JavaScript Timestamps

### The Solution

Generate timestamps in the application layer using the provided utility functions:

```typescript
import { getCurrentTimestamp } from "@makanmasak/database";

const now = getCurrentTimestamp();
await db
  .prepare(
    `
  INSERT INTO users (username, created_at, updated_at)
  VALUES (?, ?, ?)
`,
  )
  .bind("john", now, now)
  .run();
```

---

## ❌ DON'T: Use CURRENT_TIMESTAMP in SQL

```typescript
// ❌ BAD - Will fail in test environments
await db
  .prepare(
    `
  INSERT INTO users (username, created_at)
  VALUES (?, CURRENT_TIMESTAMP)
`,
  )
  .bind("john")
  .run();
```

---

## ✅ DO: Use getCurrentTimestamp()

```typescript
// ✅ GOOD - Works in all environments
import { getCurrentTimestamp } from "@makanmasak/database";

const now = getCurrentTimestamp();
await db
  .prepare(
    `
  INSERT INTO users (username, created_at)
  VALUES (?, ?)
`,
  )
  .bind("john", now)
  .run();
```

---

## Available Utility Functions

### Core Functions

```typescript
import {
  getCurrentTimestamp, // Get current ISO timestamp
  getUnixTimestamp, // Get Unix timestamp (seconds)
  getUnixTimestampMs, // Get Unix timestamp (milliseconds)
  getTimestampOffset, // Get past/future timestamp
  formatTimestamp, // Format for display
  TIME_OFFSET, // Time constants (ms)
  TIME_OFFSET_SECONDS, // Time constants (seconds)
} from "@makanmasak/database";
```

### Usage Examples

#### 1. Basic INSERT

```typescript
const now = getCurrentTimestamp();

await db
  .prepare(
    `
  INSERT INTO restaurants (name, created_at, updated_at)
  VALUES (?, ?, ?)
`,
  )
  .bind("Restaurant Name", now, now)
  .run();
```

#### 2. UPDATE with Timestamp

```typescript
const now = getCurrentTimestamp();

await db
  .prepare(
    `
  UPDATE orders
  SET status = ?, updated_at = ?
  WHERE id = ?
`,
  )
  .bind("completed", now, orderId)
  .run();
```

#### 3. Multiple Timestamps

```typescript
const now = getCurrentTimestamp();
const expiresAt = getTimestampOffset(24 * 60 * 60 * 1000); // 24 hours

await db
  .prepare(
    `
  INSERT INTO sessions (user_id, created_at, expires_at)
  VALUES (?, ?, ?)
`,
  )
  .bind(userId, now, expiresAt)
  .run();
```

#### 4. Historical Timestamp

```typescript
const oneHourAgo = getTimestampOffset(-TIME_OFFSET.ONE_HOUR);

const recentOrders = await db
  .prepare(
    `
  SELECT * FROM orders
  WHERE created_at >= ?
`,
  )
  .bind(oneHourAgo)
  .all();
```

---

## Common Patterns

### Pattern 1: created_at and updated_at

```typescript
// ✅ Single timestamp for both fields
const now = getCurrentTimestamp();

await db.insert(table).values({
  ...data,
  created_at: now,
  updated_at: now,
});
```

### Pattern 2: UPDATE with updated_at

```typescript
// ✅ Always update timestamp on changes
const now = getCurrentTimestamp();

await db
  .update(table)
  .set({
    ...updates,
    updated_at: now,
  })
  .where(eq(table.id, id));
```

### Pattern 3: Conditional Timestamp

```typescript
// ✅ Set timestamp only if condition met
const statusChangedAt = status === "completed" ? getCurrentTimestamp() : null;

await db
  .update(orders)
  .set({
    status,
    completed_at: statusChangedAt,
  })
  .where(eq(orders.id, orderId));
```

### Pattern 4: Dynamic UPDATE Fields

```typescript
// ✅ Add updated_at to dynamic updates
const updates: string[] = [];
const params: any[] = [];

if (data.name) {
  updates.push("name = ?");
  params.push(data.name);
}

// Always add updated_at
const now = getCurrentTimestamp();
updates.push("updated_at = ?");
params.push(now);
params.push(id); // WHERE clause parameter

await db
  .prepare(
    `
  UPDATE table_name
  SET ${updates.join(", ")}
  WHERE id = ?
`,
  )
  .bind(...params)
  .run();
```

---

## Migration Guide

### Before (Using CURRENT_TIMESTAMP)

```typescript
await db
  .prepare(
    `
  INSERT INTO waiting_queue (
    id, restaurant_id, customer_name,
    created_at, updated_at
  ) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
`,
  )
  .bind(id, restaurantId, customerName)
  .run();
```

### After (Using getCurrentTimestamp)

```typescript
const now = getCurrentTimestamp();

await db
  .prepare(
    `
  INSERT INTO waiting_queue (
    id, restaurant_id, customer_name,
    created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?)
`,
  )
  .bind(id, restaurantId, customerName, now, now)
  .run();
```

---

## Testing Considerations

### Why This Matters for Tests

1. **Environment Consistency**: Tests use `sql.js`, which has limited SQLite function support
2. **Deterministic Testing**: Explicit timestamps allow for predictable test assertions
3. **Time Travel**: Can set specific timestamps for testing time-based logic

### Example Test

```typescript
test("should set correct timestamps", async () => {
  const beforeInsert = getCurrentTimestamp();

  await service.createUser({ username: "test" });

  const user = await service.getUser("test");

  expect(user.created_at).toBeDefined();
  expect(new Date(user.created_at).getTime()).toBeGreaterThanOrEqual(
    new Date(beforeInsert).getTime(),
  );
});
```

---

## ESLint Rule

To prevent accidental use of `CURRENT_TIMESTAMP`, add this ESLint rule:

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "Literal[value=/CURRENT_TIMESTAMP/]",
        message:
          "Use getCurrentTimestamp() from @makanmasak/database instead of CURRENT_TIMESTAMP in SQL",
      },
    ],
  },
};
```

---

## Quick Reference

| Task             | Function                 | Example                        |
| ---------------- | ------------------------ | ------------------------------ |
| Get current time | `getCurrentTimestamp()`  | `"2025-11-10T08:30:45.123Z"`   |
| Unix timestamp   | `getUnixTimestamp()`     | `1731225045`                   |
| Time offset      | `getTimestampOffset(ms)` | `getTimestampOffset(-3600000)` |
| Format display   | `formatTimestamp(iso)`   | `"11/10/2025, 8:30:45 AM"`     |
| Time constants   | `TIME_OFFSET.ONE_HOUR`   | `3600000` (ms)                 |

---

## Summary

1. ✅ **ALWAYS** use `getCurrentTimestamp()` for database timestamps
2. ❌ **NEVER** use `CURRENT_TIMESTAMP` in SQL queries
3. 📦 Import from `@makanmasak/database`
4. 🧪 Ensures compatibility across production and test environments
5. 🔒 Add ESLint rule to prevent regressions

---

**Last Updated**: 2025-11-10
**Status**: Production Standard
**See Also**:

- `packages/database/src/utils/timestamp.ts` - Implementation
- `docs/testing/DATABASE_TESTING.md` - Testing guide
- `CLAUDE.md` - Project overview
