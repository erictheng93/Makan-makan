# SQLite Constraint Rules - Quick Reference

**Purpose**: Prevent SQLite syntax errors in future migrations
**Last Updated**: 2025-10-09

---

## ❌ What SQLite Does NOT Allow

### 1. Expressions in UNIQUE Constraints

```sql
-- ❌ WRONG - Will cause error
CREATE TABLE users (
    email TEXT,
    UNIQUE(LOWER(email))  -- ERROR: Expression not allowed
);

CREATE TABLE queue (
    restaurant_id TEXT,
    queue_number INTEGER,
    joined_at DATETIME,
    UNIQUE(restaurant_id, queue_number, DATE(joined_at))  -- ERROR: DATE() not allowed
);

-- ✅ CORRECT - Use plain columns only
CREATE TABLE users (
    email TEXT,
    UNIQUE(email)  -- Enforce uniqueness in application or use COLLATE NOCASE
);

CREATE TABLE queue (
    restaurant_id TEXT,
    queue_number INTEGER,
    joined_at DATETIME,
    -- Enforce daily uniqueness in application code
    UNIQUE(restaurant_id, queue_number)
);
```

### 2. Expressions in PRIMARY KEY Constraints

```sql
-- ❌ WRONG - Will cause error
CREATE TABLE orders (
    order_id TEXT,
    created_at DATETIME,
    PRIMARY KEY(CAST(order_id AS INTEGER))  -- ERROR: Expression not allowed
);

-- ✅ CORRECT - Use plain column only
CREATE TABLE orders (
    order_id TEXT PRIMARY KEY
);
```

### 3. Function Expressions in Index Columns

```sql
-- ❌ WRONG - Will cause error
CREATE INDEX idx_orders_hour
  ON orders(strftime('%H', created_at));  -- ERROR: Function not allowed in column

CREATE INDEX idx_orders_date
  ON orders(DATE(created_at));  -- ERROR: Function not allowed

-- ✅ CORRECT - Index the base column, extract in query
CREATE INDEX idx_orders_created
  ON orders(created_at);

-- Then in queries:
SELECT strftime('%H', created_at) as hour, COUNT(*)
FROM orders
WHERE restaurant_id = 1
GROUP BY strftime('%H', created_at);
```

### 4. Non-Deterministic Functions in Partial Index WHERE Clauses

```sql
-- ❌ WRONG - Will cause error
CREATE INDEX idx_future_orders
  ON orders(order_id)
  WHERE created_at > datetime('now');  -- ERROR: Non-deterministic function

CREATE INDEX idx_cache_valid
  ON cache_entries(cache_key)
  WHERE expires_at > datetime('now');  -- ERROR: Non-deterministic

-- ✅ CORRECT - Use deterministic comparisons only
CREATE INDEX idx_pending_orders
  ON orders(order_id, created_at)
  WHERE status = 'pending';  -- OK: Deterministic comparison

-- Filter expired entries in application code or queries:
SELECT * FROM cache_entries
WHERE cache_key = ?
  AND expires_at > datetime('now')
  AND is_valid = true;
```

---

## ✅ What SQLite DOES Allow

### 1. Expressions in DEFAULT Values

```sql
-- ✅ CORRECT - Expressions allowed in DEFAULT
CREATE TABLE orders (
    id TEXT PRIMARY KEY DEFAULT (hex(randomblob(16))),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT (datetime('now', 'localtime')),
    order_number TEXT DEFAULT (strftime('%Y%m%d', 'now') || '-' || hex(randomblob(4)))
);
```

### 2. Expressions in CHECK Constraints

```sql
-- ✅ CORRECT - Expressions allowed in CHECK
CREATE TABLE coupons (
    valid_from DATETIME,
    valid_to DATETIME,
    discount_value REAL,

    CHECK (valid_to > valid_from),  -- OK
    CHECK (discount_value > 0 AND discount_value <= 100),  -- OK
    CHECK (length(code) >= 6)  -- OK
);
```

### 3. Expressions in Queries (SELECT, WHERE, GROUP BY)

```sql
-- ✅ CORRECT - Full expression support in queries
SELECT
    strftime('%Y-%m', created_at) as month,
    strftime('%H', created_at) as hour,
    COUNT(*) as order_count,
    SUM(total_amount) as revenue
FROM orders
WHERE DATE(created_at) = DATE('now')
  AND status IN ('paid', 'delivered')
GROUP BY strftime('%Y-%m', created_at), strftime('%H', created_at)
ORDER BY month, hour;
```

### 4. Deterministic Partial Indexes

```sql
-- ✅ CORRECT - Deterministic WHERE clauses
CREATE INDEX idx_active_users
  ON users(username, email)
  WHERE status = 'active';

CREATE INDEX idx_available_items
  ON menu_items(restaurant_id, category_id, price)
  WHERE is_available = true AND status = 'active';

CREATE INDEX idx_completed_orders
  ON orders(restaurant_id, created_at DESC, total_amount)
  WHERE status IN ('paid', 'delivered');
```

---

## Common Patterns and Solutions

### Pattern 1: Case-Insensitive Unique Email

```sql
-- ❌ WRONG
UNIQUE(LOWER(email))

-- ✅ SOLUTION 1: Use COLLATE NOCASE
email TEXT UNIQUE COLLATE NOCASE

-- ✅ SOLUTION 2: Normalize in application
-- Store email as lowercase in application code before INSERT/UPDATE
```

### Pattern 2: Daily Unique Queue Numbers

```sql
-- ❌ WRONG
UNIQUE(restaurant_id, queue_number, DATE(joined_at))

-- ✅ SOLUTION: Enforce in application code
async function assignQueueNumber(restaurantId) {
  const today = new Date().toISOString().split('T')[0];

  // Find highest queue number for today
  const maxQueue = await db
    .select({ max: sql`MAX(queue_number)` })
    .from(waiting_queue)
    .where(sql`restaurant_id = ${restaurantId} AND DATE(joined_at) = ${today}`)
    .limit(1);

  return (maxQueue[0]?.max || 0) + 1;
}
```

### Pattern 3: Time-Based Analytics Indexes

```sql
-- ❌ WRONG
CREATE INDEX idx_hourly_orders
  ON orders(restaurant_id, strftime('%H', created_at));

-- ✅ SOLUTION: Index base column, extract in query
CREATE INDEX idx_orders_time_analytics
  ON orders(restaurant_id, created_at, status)
  WHERE status IN ('paid', 'delivered');

-- Query extracts time components:
SELECT
    strftime('%H', created_at) as hour,
    COUNT(*) as orders
FROM orders
WHERE restaurant_id = 1
  AND status IN ('paid', 'delivered')
GROUP BY strftime('%H', created_at);
```

### Pattern 4: Active/Valid Records with Expiry

```sql
-- ❌ WRONG
CREATE INDEX idx_active_sessions
  ON sessions(user_id, token)
  WHERE is_active = true AND expires_at > datetime('now');

-- ✅ SOLUTION: Index without datetime('now')
CREATE INDEX idx_sessions_lookup
  ON sessions(user_id, token, is_active, expires_at)
  WHERE is_active = true;

-- Filter in query:
SELECT * FROM sessions
WHERE user_id = ?
  AND token = ?
  AND is_active = true
  AND expires_at > datetime('now');
```

---

## Migration Checklist

Before creating a new migration, verify:

- [ ] No expressions in UNIQUE constraints (only column names)
- [ ] No expressions in PRIMARY KEY constraints (only column names)
- [ ] No function calls in index column definitions
- [ ] No `datetime('now')` or similar non-deterministic functions in partial index WHERE clauses
- [ ] Expressions are only in: DEFAULT values, CHECK constraints, SELECT/WHERE/GROUP BY
- [ ] Complex uniqueness rules are documented for application-level enforcement

---

## Testing Your Migration

```bash
# 1. Test syntax locally
sqlite3 test.db < your_migration.sql

# 2. Check for error messages
# Look for: "expressions prohibited in PRIMARY KEY and UNIQUE constraints"
# Look for: "non-deterministic functions prohibited in index WHERE clauses"

# 3. Verify indexes created
sqlite3 test.db "SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index';"

# 4. Test with Cloudflare D1 local
npx wrangler d1 migrations apply makanmakan-local --local

# 5. Clean up test
rm test.db
```

---

## Need Help?

If you encounter:

- **"expressions prohibited in PRIMARY KEY and UNIQUE constraints"**
  → Remove expressions from constraint, enforce in application code

- **"non-deterministic functions prohibited in index"**
  → Remove datetime('now') from WHERE clause, filter in query instead

- **Unique constraint needs expression**
  → Use COLLATE NOCASE for case-insensitive, or enforce in application

- **Need time-based indexes**
  → Index the datetime column directly, extract time components in queries

---

## References

- SQLite Constraint Documentation: https://www.sqlite.org/lang_createtable.html
- SQLite Index Documentation: https://www.sqlite.org/lang_createindex.html
- Cloudflare D1 Documentation: https://developers.cloudflare.com/d1/

---

_Keep this file handy when writing new migrations!_
