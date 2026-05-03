/**
 * Test Utilities for API Integration Testing
 *
 * CRITICAL: This module provides a complete test application with all routes
 * to prevent 404 errors in integration tests.
 */

import { Hono } from "hono";
import type { Env } from "../../types/env";
import { vi } from "vitest";
import { sign } from "jsonwebtoken";
import initSqlJs, { type Database as SqlJsDatabase } from "sql.js";
import { ApiError } from "../../shared/utils/api-error";
import { ErrorSanitizer } from "../../utils/errorSanitizer";

// Import all feature routes
import restaurantsFeature from "../../features/restaurants";
import authFeature from "../../features/authentication";
import menuFeature from "../../features/menu";
import kitchenFeature from "../../features/kitchen";
import ordersFeature from "../../features/orders";
import groupOrdersFeature from "../../features/group-orders";
import posFeature from "../../features/pos";
import queueFeature from "../../features/queue";
import tablesFeature from "../../features/tables";
import usersFeature from "../../features/users";
import analyticsFeature from "../../features/analytics";
import qrCodesFeature from "../../features/qr-codes";
import couponsFeature from "../../features/coupons";

type SqlJsDatabaseWithFunctions = SqlJsDatabase & {
  create_function(name: string, fn: (arg: string | null) => number): void;
};

type SqlJsModuleWithDatabase = {
  Database: new () => SqlJsDatabaseWithFunctions;
};

type SqlExpressionLike = {
  queryChunks?: unknown;
  sql?: unknown;
};

// ============================================
// Shared Data Store for Test Database
// ============================================

/**
 * Shared in-memory data store that both D1 mock and Drizzle mock can use
 * Uses sql.js for real SQLite implementation (pure JavaScript, no compilation needed)
 */
class SharedDataStore {
  private db: SqlJsDatabase;

  private constructor(db: SqlJsDatabase) {
    this.db = db;
  }

  /**
   * Factory method to create a new SharedDataStore instance
   */
  static async create(): Promise<SharedDataStore> {
    const SQL = await initSqlJs();
    const sqlDb = new (SQL as unknown as SqlJsModuleWithDatabase).Database();

    // Register custom unixepoch function to emulate SQLite 3.38+ behavior
    // This is necessary because sql.js uses an older SQLite version
    sqlDb.create_function("unixepoch", (arg: string | null) => {
      if (arg === "now" || arg === null) {
        return Math.floor(Date.now() / 1000);
      }
      // Parse date string to Unix timestamp
      const date = new Date(arg);
      return Math.floor(date.getTime() / 1000);
    });

    const store = new SharedDataStore(sqlDb as SqlJsDatabase);
    await store.createTables();

    console.log("[SharedDataStore] Initialized with sql.js");
    return store;
  }

  private async createTables() {
    // 1. Restaurants Table (using snake_case to match Drizzle schema)
    // Note: Test SQL uses snake_case, MockDrizzle insert uses camelCase
    // We use snake_case here and handle conversion in insert()
    this.db.run(`
      CREATE TABLE IF NOT EXISTS restaurants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        public_id TEXT UNIQUE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        address TEXT NOT NULL,
        district TEXT NOT NULL,
        city TEXT NOT NULL DEFAULT '台中市',
        phone TEXT NOT NULL,
        email TEXT,
        website TEXT,
        business_hours TEXT,
        is_available INTEGER NOT NULL DEFAULT 1,
        is_active INTEGER NOT NULL DEFAULT 1,
        status INTEGER DEFAULT 1,
        logo_url TEXT,
        banner_url TEXT,
        image_urls TEXT,
        shop_qr_code TEXT UNIQUE,
        shop_qr_code_image_url TEXT,
        enable_shop_mode INTEGER NOT NULL DEFAULT 0,
        shop_qr_settings TEXT,
        shop_qr_version INTEGER NOT NULL DEFAULT 1,
        settings TEXT,
        rating REAL DEFAULT 0,
        review_count INTEGER NOT NULL DEFAULT 0,
        total_orders INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // 2. Users Table (using camelCase to match test expectations)
    // 2. Users Table (using snake_case to match Drizzle schema)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT,
        phone TEXT,
        full_name TEXT,
        password TEXT,
        password_hash TEXT NOT NULL,
        role INTEGER NOT NULL DEFAULT 5,
        restaurant_id TEXT,
        address TEXT,
        date_of_birth TEXT,
        profile_image_url TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        is_verified INTEGER NOT NULL DEFAULT 0,
        preferences TEXT,
        total_orders INTEGER NOT NULL DEFAULT 0,
        total_spent INTEGER NOT NULL DEFAULT 0,
        last_login_at INTEGER,
        password_changed_at INTEGER,
        -- Wave 1: JWT invalidation. Bumped on deactivate / role change /
        -- password change so old tokens fail authMiddleware's per-request
        -- version check.
        token_version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // 3. Sessions Table (using snake_case to match Drizzle schema)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        refresh_token TEXT UNIQUE,
        user_agent TEXT,
        ip_address TEXT,
        device_info TEXT,
        location TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        last_accessed_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // 4. Categories Table (using snake_case to match Drizzle schema)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        is_visible INTEGER NOT NULL DEFAULT 1,
        image_url TEXT,
        icon_url TEXT,
        available_hours TEXT,
        item_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // 5. Menu Items Table (using snake_case to match Drizzle schema)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_id TEXT NOT NULL,
        category_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        ingredients TEXT,
        price REAL NOT NULL,
        price_cents INTEGER,
        original_price REAL,
        cost_price REAL,
        image_url TEXT,
        image_variants TEXT,
        is_available INTEGER NOT NULL DEFAULT 1,
        is_featured INTEGER NOT NULL DEFAULT 0,
        is_popular INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        inventory_count INTEGER,
        min_inventory_alert INTEGER DEFAULT 5,
        spice_level INTEGER NOT NULL DEFAULT 0,
        preparation_time INTEGER DEFAULT 15,
        calories INTEGER,
        dietary_info TEXT,
        allergens TEXT,
        options TEXT,
        available_hours TEXT,
        order_count INTEGER NOT NULL DEFAULT 0,
        rating REAL DEFAULT 0,
        review_count INTEGER NOT NULL DEFAULT 0,
        view_count INTEGER NOT NULL DEFAULT 0,
        tags TEXT,
        keywords TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // 6. Tables Table (using snake_case to match Drizzle schema)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS tables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_id TEXT NOT NULL,
        number TEXT NOT NULL,
        name TEXT,
        capacity INTEGER NOT NULL DEFAULT 4,
        location TEXT,
        floor INTEGER DEFAULT 1,
        section TEXT,
        qr_code TEXT NOT NULL UNIQUE,
        qr_code_image_url TEXT,
        qr_code_version INTEGER NOT NULL DEFAULT 1,
        qr_mode TEXT DEFAULT 'table',
        seat_count INTEGER DEFAULT 0,
        seat_layout TEXT,
        seat_numbering_style TEXT DEFAULT 'numeric',
        is_occupied INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        is_reservable INTEGER NOT NULL DEFAULT 1,
        features TEXT,
        current_order_id INTEGER,
        occupied_at INTEGER,
        occupied_by TEXT,
        estimated_free_at INTEGER,
        last_cleaned_at INTEGER,
        maintenance_notes TEXT,
        total_usage INTEGER NOT NULL DEFAULT 0,
        average_occupancy_minutes INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // 7. Seats Table (using snake_case to match Drizzle schema)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS seats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_id INTEGER NOT NULL,
        seat_number TEXT NOT NULL,
        seat_name TEXT,
        position TEXT,
        qr_code TEXT NOT NULL UNIQUE,
        qr_code_image_url TEXT,
        qr_code_version INTEGER NOT NULL DEFAULT 1,
        is_occupied INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        current_order_id INTEGER,
        occupied_at INTEGER,
        occupied_by TEXT,
        total_usage INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // 8. Orders Table (using camelCase)
    // 8. Orders Table (using snake_case to match Drizzle schema)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurant_id TEXT NOT NULL,
        table_id INTEGER NOT NULL,
        customer_id INTEGER,
        order_number TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'pending',
        order_type TEXT DEFAULT 'table',
        order_source TEXT DEFAULT 'direct',
        subtotal REAL NOT NULL,
        tax_amount REAL NOT NULL DEFAULT 0,
        service_charge REAL NOT NULL DEFAULT 0,
        discount_amount REAL NOT NULL DEFAULT 0,
        total_amount REAL NOT NULL,
        customer_info TEXT,
        estimated_prep_time INTEGER,
        actual_prep_time INTEGER,
        confirmed_at INTEGER,
        preparing_at INTEGER,
        ready_at INTEGER,
        delivered_at INTEGER,
        paid_at INTEGER,
        cancelled_at INTEGER,
        payment_method TEXT,
        payment_status TEXT DEFAULT 'pending',
        payment_transaction_id TEXT,
        coupon_code TEXT,
        promotion_ids TEXT,
        rating INTEGER,
        review_comment TEXT,
        reviewed_at INTEGER,
        notes TEXT,
        internal_notes TEXT,
        cancellation_reason TEXT,
        refund_amount REAL,
        delivery_info TEXT,
        -- Batch C: optimistic-lock column. Every status update bumps this
        -- and compare-and-swap WHERE version = expected enforces H2 / X6 /
        -- X11 concurrent-actor conflict semantics.
        version INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // 9. Order Items Table (using snake_case to match Drizzle schema)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        menu_item_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL,
        item_snapshot TEXT,
        customizations TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        prepared_at INTEGER,
        served_at INTEGER,
        notes TEXT,
        kitchen_notes TEXT,
        cancelled_at INTEGER,
        cancellation_reason TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // 10. Audit Logs Table (using snake_case to match Drizzle schema)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        -- Wave 5 (M1): manager delegation actor/on-behalf-of split.
        on_behalf_of_user_id INTEGER,
        restaurant_id TEXT,
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        resource_id TEXT,
        description TEXT NOT NULL,
        changes TEXT,
        ip_address TEXT,
        user_agent TEXT,
        success INTEGER NOT NULL DEFAULT 1,
        error_message TEXT,
        execution_time_ms INTEGER,
        created_at TEXT NOT NULL
      )
    `);

    // 11. Waiting Queue Table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS waiting_queue (
        id TEXT PRIMARY KEY,
        restaurant_id INTEGER NOT NULL,
        queue_number INTEGER NOT NULL,
        customer_name TEXT NOT NULL,
        customer_phone TEXT,
        customer_email TEXT,
        party_size INTEGER NOT NULL,
        special_requests TEXT,
        priority INTEGER DEFAULT 0,
        queue_type TEXT DEFAULT 'walkin',
        estimated_wait_minutes INTEGER,
        actual_wait_minutes INTEGER,
        table_preferences TEXT,
        assigned_table_id INTEGER,
        status TEXT NOT NULL DEFAULT 'waiting',
        notification_methods TEXT,
        notification_sent INTEGER DEFAULT 0,
        notification_count INTEGER DEFAULT 0,
        check_in_code TEXT,
        joined_at TEXT NOT NULL,
        called_at TEXT,
        seated_at TEXT,
        cancelled_at TEXT,
        no_show_at TEXT,
        served_by INTEGER,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    // 12. Queue Settings Table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS queue_settings (
        restaurant_id INTEGER PRIMARY KEY,
        is_enabled INTEGER DEFAULT 1,
        max_queue_size INTEGER DEFAULT 50,
        avg_service_time INTEGER DEFAULT 45,
        max_wait_time INTEGER DEFAULT 120,
        min_advance_notice INTEGER DEFAULT 5,
        notification_methods TEXT DEFAULT '["sms"]',
        auto_call_enabled INTEGER DEFAULT 1,
        auto_call_interval INTEGER DEFAULT 10,
        no_show_timeout INTEGER DEFAULT 15,
        queue_number_reset TEXT DEFAULT 'daily',
        priority_rules TEXT DEFAULT '{}',
        table_assignment_rules TEXT DEFAULT '{}',
        notification_templates TEXT DEFAULT '{}',
        business_hours TEXT DEFAULT '{}',
        holiday_settings TEXT DEFAULT '{}',
        display_settings TEXT DEFAULT '{}',
        integration_settings TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 13. Queue Events Table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS queue_events (
        id TEXT PRIMARY KEY,
        restaurant_id INTEGER NOT NULL,
        queue_id TEXT,
        event_type TEXT NOT NULL,
        event_data TEXT DEFAULT '{}',
        triggered_by INTEGER,
        triggered_by_system INTEGER DEFAULT 0,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL
      )
    `);

    // 14. Shop Subscriptions Table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS shop_subscriptions (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL UNIQUE,
        plan_tier TEXT NOT NULL DEFAULT 'trial',
        module_overrides TEXT DEFAULT '{}',
        deployment_mode TEXT NOT NULL DEFAULT 'managed',
        is_active INTEGER NOT NULL DEFAULT 1,
        trial_ends_at_ms INTEGER,
        billing_cycle_start_at_ms INTEGER,
        billing_cycle_end_at_ms INTEGER,
        notes TEXT,
        created_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
        updated_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS usage_events (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        meter_key TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        metadata TEXT,
        aggregated_at_ms INTEGER,
        occurred_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS usage_meters (
        id TEXT PRIMARY KEY,
        restaurant_id TEXT NOT NULL,
        meter_key TEXT NOT NULL,
        cycle_start_at_ms INTEGER NOT NULL,
        cycle_end_at_ms INTEGER NOT NULL,
        total_quantity INTEGER NOT NULL DEFAULT 0,
        last_aggregated_at_ms INTEGER,
        created_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
        updated_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
        UNIQUE(restaurant_id, meter_key, cycle_start_at_ms)
      )
    `);

    console.log("[SharedDataStore] Tables created successfully");
  }

  /**
   * Execute a raw SQL query and return results
   */
  query(sql: string, params: any[] = []): any[] {
    try {
      const stmt = this.db.prepare(sql);
      stmt.bind(params);
      const results: any[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    } catch (error) {
      console.error("[SharedDataStore] Query error:", error);
      return [];
    }
  }

  /**
   * Execute a raw SQL query and return first result
   */
  queryOne(sql: string, params: any[] = []): any | null {
    try {
      const stmt = this.db.prepare(sql);
      stmt.bind(params);
      const hasRow = stmt.step();
      const result = hasRow ? stmt.getAsObject() : null;
      stmt.free();
      return result;
    } catch (error) {
      console.error("[SharedDataStore] QueryOne error:", error);
      return null;
    }
  }

  /**
   * Execute a raw SQL command (INSERT, UPDATE, DELETE)
   */
  run(
    sql: string,
    params: any[] = [],
  ): { changes: number; lastInsertRowid: number } {
    try {
      const stmt = this.db.prepare(sql);
      stmt.bind(params);
      stmt.step();
      stmt.free();

      // Get last insert rowid and changes
      // Note: sql.js doesn't provide getRowsModified(), so we assume 1 for successful runs
      const changes = 1;
      const lastInsertRowid =
        (this.db.exec("SELECT last_insert_rowid() as id")[0]
          ?.values[0][0] as number) || 0;

      return { changes, lastInsertRowid };
    } catch (error) {
      console.error("[SharedDataStore] Run error:", error);
      throw error;
    }
  }

  insert(tableName: string, data: any): any {
    // Helper function to convert camelCase to snake_case
    const toSnakeCase = (str: string): string => {
      return str
        .replace(/([A-Z])/g, "_$1")
        .toLowerCase()
        .replace(/^_/, "");
    };

    // Add timestamps if not provided
    const now = new Date().toISOString();
    const enrichedData = { ...data };

    // Handle common timestamp fields
    if (!enrichedData.createdAt && !enrichedData.created_at) {
      enrichedData.createdAt = now;
      enrichedData.created_at = now;
    }
    if (!enrichedData.updatedAt && !enrichedData.updated_at) {
      enrichedData.updatedAt = now;
      enrichedData.updated_at = now;
    }
    // Handle joined_at for queue table
    if (tableName === "waiting_queue" && !enrichedData.joined_at) {
      enrichedData.joined_at = now;
    }

    // Convert camelCase keys to snake_case for database columns
    const snakeCaseData: any = {};
    for (const key of Object.keys(enrichedData)) {
      if (enrichedData[key] !== undefined) {
        const snakeKey = toSnakeCase(key);
        snakeCaseData[snakeKey] = enrichedData[key];
      }
    }

    const columns = Object.keys(snakeCaseData);
    const values = columns.map((k) => {
      const value = snakeCaseData[k];
      // Convert boolean to integer for SQLite
      if (typeof value === "boolean") {
        return value ? 1 : 0;
      }
      if (value instanceof Date && k.endsWith("_ms")) {
        return value.getTime();
      }
      // Convert Date to ISO string
      if (value instanceof Date) {
        return value.toISOString();
      }
      // Convert objects and arrays to JSON string
      if (value !== null && typeof value === "object") {
        return JSON.stringify(value);
      }
      return value === null ? null : value;
    });
    const placeholders = columns.map(() => "?").join(", ");

    const sql = `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`;

    try {
      console.log(`[SharedDataStore] INSERT SQL:`, sql);
      console.log(`[SharedDataStore] INSERT values:`, JSON.stringify(values));
      const result = this.run(sql, values);
      console.log(
        `[SharedDataStore] Inserted into ${tableName}:`,
        result.lastInsertRowid,
      );

      // Return the inserted data with the ID
      return {
        ...enrichedData,
        id: enrichedData.id || result.lastInsertRowid,
      };
    } catch (error) {
      console.error(`[SharedDataStore] Insert error for ${tableName}:`, error);
      console.error(`[SharedDataStore] Failed SQL:`, sql);
      console.error(`[SharedDataStore] Failed values:`, JSON.stringify(values));
      throw error;
    }
  }

  select(tableName: string, where?: any): any[] {
    let sql = `SELECT * FROM ${tableName}`;
    const params: any[] = [];

    if (where && Object.keys(where).length > 0) {
      const conditions = Object.entries(where).map(([key, _]) => `${key} = ?`);
      sql += ` WHERE ${conditions.join(" AND ")}`;
      params.push(...Object.values(where));
    }

    return this.query(sql, params);
  }

  selectOne(tableName: string, where?: any): any | null {
    const results = this.select(tableName, where);
    return results.length > 0 ? results[0] : null;
  }

  update(tableName: string, id: number, data: any): boolean {
    const columns = Object.keys(data).filter((k) => data[k] !== undefined);
    const setClause = columns.map((k) => `${k} = ?`).join(", ");
    const values = columns.map((k) => data[k]);

    const sql = `UPDATE ${tableName} SET ${setClause} WHERE id = ?`;

    try {
      const result = this.run(sql, [...values, id]);
      console.log(
        `[SharedDataStore] Updated ${tableName} id=${id}, changes=${result.changes}`,
      );
      return result.changes > 0;
    } catch (error) {
      console.error(`[SharedDataStore] Update error for ${tableName}:`, error);
      return false;
    }
  }

  delete(tableName: string, id: number): boolean {
    const sql = `DELETE FROM ${tableName} WHERE id = ?`;

    try {
      const result = this.run(sql, [id]);
      console.log(
        `[SharedDataStore] Deleted from ${tableName} id=${id}, changes=${result.changes}`,
      );
      return result.changes > 0;
    } catch (error) {
      console.error(`[SharedDataStore] Delete error for ${tableName}:`, error);
      return false;
    }
  }

  clear(tableName?: string) {
    if (tableName) {
      this.run(`DELETE FROM ${tableName}`);
    } else {
      // Clear all tables
      const tables = this.query(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`,
      );
      tables.forEach((table: any) => {
        this.run(`DELETE FROM ${table.name}`);
      });
    }
  }

  /**
   * Get the underlying SQLite database instance for direct access
   */
  getDB(): SqlJsDatabase {
    return this.db;
  }

  /**
   * Close the database connection
   */
  close() {
    this.db.close();
  }
}

// Test database creation - using mock for testing

export interface TestDB {
  prepare: (sql: string) => any;
  exec: (sql: string) => any;
  close: () => Promise<void>;
  dataStore?: SharedDataStore; // Add dataStore to share between createTestDB and createTestApp
  [key: string]: any;
}

export async function createTestDB(): Promise<TestDB> {
  // Create shared data store
  const dataStore = await SharedDataStore.create();

  // Create D1-compatible mock that uses the shared store
  const db = createSharedMockDB(dataStore) as ReturnType<
    typeof createSharedMockDB
  > & { dataStore: SharedDataStore };

  // Attach dataStore for sharing with createTestApp
  db.dataStore = dataStore;

  // Run migrations to create all necessary tables
  await runMigrations(db);

  return db;
}

// Global test database instance (shared across all tests)
let globalTestDB: any = null;
let globalDataStore: SharedDataStore | null = null;

/**
 * Get or create the global test database
 */
export async function getGlobalTestDB() {
  if (!globalTestDB) {
    globalDataStore = await SharedDataStore.create();
    globalTestDB = createSharedMockDB(globalDataStore);
  }
  return globalTestDB;
}

/**
 * Creates a complete test application with all routes registered
 * This ensures integration tests don't get 404 errors
 */
export async function createTestApp(customDB?: any) {
  const app = new Hono<{ Bindings: Env }>();

  // Add unified error handler matching production index.ts
  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        {
          success: false,
          error: {
            code: err.code,
            message: err.message,
            ...(err.details !== undefined && { details: err.details }),
          },
        },
        err.status as never,
      );
    }
    const sanitized = ErrorSanitizer.sanitizeError(err);
    const STATUS_MAP: Record<string, number> = {
      validation: 400,
      authentication: 401,
      authorization: 403,
      not_found: 404,
      rate_limit: 429,
      server_error: 500,
    };
    return c.json(
      {
        success: false,
        error: {
          code: sanitized.code ?? "INTERNAL_ERROR",
          message: sanitized.message,
        },
      },
      (STATUS_MAP[sanitized.type] ?? 500) as never,
    );
  });

  // Reuse dataStore from customDB if available, otherwise create new one
  let dataStore: SharedDataStore;
  let mockDB: any;

  if (customDB && customDB.dataStore) {
    // Reuse the existing dataStore from customDB
    dataStore = customDB.dataStore;
    mockDB = customDB;
    console.log("[createTestApp] Reusing existing dataStore from customDB");
  } else {
    // Create new dataStore
    dataStore = await SharedDataStore.create();
    mockDB = createSharedMockDB(dataStore);
    console.log("[createTestApp] Created new dataStore");
  }

  console.log("[createTestApp] Using DB instance:", !!mockDB);
  console.log("[createTestApp] DB has prepare:", typeof mockDB?.prepare);

  // Create inline mock Drizzle instance with SAME data store
  const mockDrizzle = createInlineMockDrizzle(dataStore);
  console.log(
    "[createTestApp] Created inline mock Drizzle with shared dataStore",
  );

  // Create mock environment
  const mockEnv: Partial<Env> = {
    NODE_ENV: "test",
    JWT_SECRET: "test-jwt-secret-for-testing-only",
    API_VERSION: "v1",
    DB: customDB || mockDB,
    MOCK_DRIZZLE_DB: mockDrizzle, // Inject inline mock Drizzle
    CACHE_KV: {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined), // Alias for put (some services use set instead)
      delete: vi.fn().mockResolvedValue(true),
      list: vi.fn().mockResolvedValue({ keys: [] }),
    } as never,
    ANALYTICS_ENGINE: {
      writeDataPoint: vi.fn(),
    } as never,
    API_BASE_URL: "http://localhost:8787",
  };

  // Set environment on context
  app.use("*", async (c, next) => {
    // Initialize c.env if it doesn't exist
    if (!c.env) {
      (c as unknown as ApiTestContextWithEnv).env = {} as unknown as ApiTestEnv;
    }
    // Inject mock env
    Object.assign(c.env, mockEnv);

    // Mock ExecutionContext for Cloudflare Workers API
    // This allows c.executionCtx.waitUntil() to work in tests
    try {
      // Try to access executionCtx - if it doesn't exist, it will throw
      const _ = c.executionCtx;
    } catch (e) {
      // ExecutionContext doesn't exist, so we need to mock it
      Object.defineProperty(c, "executionCtx", {
        get() {
          return {
            waitUntil: vi.fn((promise: Promise<any>) => {
              // In tests, we don't actually wait for background tasks
              // Just capture the promise for potential verification
              promise.catch((err) => {
                console.warn(
                  "[Test ExecutionContext] Background task failed:",
                  err.message,
                );
              });
            }),
            passThroughOnException: vi.fn(),
          };
        },
        configurable: true,
      });
    }

    await next();
  });

  // No auth bypass middleware - tests must provide valid JWT tokens
  // This ensures we test the real authentication flow

  // Create API v1 router
  const apiV1 = new Hono<{ Bindings: Env }>();

  // Add request logging middleware to apiV1
  apiV1.use("*", async (c, next) => {
    console.log(`[API_V1] ${c.req.method} ${c.req.path}`);
    await next();
    console.log(`[API_V1] Response status: ${c.res.status}`);
  });

  // Register all feature routes (matching production structure)
  console.log("[createTestApp] Registering routes...");
  console.log("[createTestApp] - tablesFeature type:", typeof tablesFeature);
  console.log(
    "[createTestApp] - tablesFeature keys:",
    Object.keys(tablesFeature),
  );
  console.log(
    "[createTestApp] - tablesFeature.routes type:",
    typeof tablesFeature.routes,
  );
  console.log(
    "[createTestApp] - tablesFeature.routes is Hono?:",
    tablesFeature.routes?.constructor?.name,
  );
  console.log(
    "[createTestApp] - usersFeature.routes type:",
    typeof usersFeature.routes,
  );
  console.log(
    "[createTestApp] - usersFeature.routes is Hono?:",
    usersFeature.routes?.constructor?.name,
  );

  apiV1.route("/auth", authFeature.routes);
  apiV1.route("/restaurants", restaurantsFeature.routes);
  apiV1.route("/menu", menuFeature.routes);
  apiV1.route("/kitchen", kitchenFeature.routes);
  apiV1.route("/orders", ordersFeature.routes);
  apiV1.route("/orders/group", groupOrdersFeature.routes);
  apiV1.route("/pos", posFeature.routes);
  apiV1.route("/queue", queueFeature.routes);

  console.log("[createTestApp] Registering /tables route");
  apiV1.route("/tables", tablesFeature.routes);

  console.log("[createTestApp] Registering /users route");
  apiV1.route("/users", usersFeature.routes);

  apiV1.route("/analytics", analyticsFeature.routes);
  apiV1.route("/qr", qrCodesFeature.routes);
  apiV1.route("/coupons", couponsFeature.routes);

  console.log("[createTestApp] All routes registered");

  // Mount API v1 routes
  console.log("[createTestApp] Mounting /api/v1");
  app.route("/api/v1", apiV1);

  // Add 404 handler for debugging
  app.notFound((c) => {
    console.error(`[TEST] 404 Not Found: ${c.req.method} ${c.req.path}`);
    return c.json(
      {
        success: false,
        error: "Endpoint not found in test app",
        path: c.req.path,
        method: c.req.method,
      },
      404,
    );
  });

  return app;
}

export async function cleanupTestDB(db: TestDB) {
  if (db && typeof db.close === "function") {
    await db.close();
  }
}

/**
 * Create a D1-compatible mock database that uses SharedDataStore with real SQLite
 */
function createSharedMockDB(dataStore: SharedDataStore) {
  return {
    prepare: (sql: string) => {
      let boundParams: any[] = [];

      return {
        bind: (...params: any[]) => {
          boundParams = params;
          return {
            run: async () => {
              try {
                const result = dataStore.run(sql, boundParams);
                console.log(`[SharedMockDB] RUN executed:`, {
                  sql: sql.substring(0, 100),
                  changes: result.changes,
                  lastInsertRowid: result.lastInsertRowid,
                });
                return {
                  success: true,
                  meta: {
                    changes: result.changes,
                    last_row_id: result.lastInsertRowid,
                  },
                };
              } catch (error) {
                console.error("[SharedMockDB] RUN error:", error);
                return {
                  success: false,
                  error:
                    error instanceof Error ? error.message : "Unknown error",
                };
              }
            },
            first: async () => {
              try {
                const result = dataStore.queryOne(sql, boundParams);
                console.log(`[SharedMockDB] FIRST executed:`, {
                  sql: sql.substring(0, 100),
                  hasResult: !!result,
                });
                return result;
              } catch (error) {
                console.error("[SharedMockDB] FIRST error:", error);
                return null;
              }
            },
            all: async () => {
              try {
                const results = dataStore.query(sql, boundParams);
                console.log(`[SharedMockDB] ALL executed:`, {
                  sql: sql.substring(0, 100),
                  count: results.length,
                });
                return {
                  results,
                  success: true,
                };
              } catch (error) {
                console.error("[SharedMockDB] ALL error:", error);
                return {
                  results: [],
                  success: false,
                  error:
                    error instanceof Error ? error.message : "Unknown error",
                };
              }
            },
            raw: async () => {
              try {
                const results = dataStore.query(sql, boundParams);
                // D1's raw() returns an array of arrays (each row is an array of column values)
                return results.map((row: any) => Object.values(row));
              } catch (error) {
                console.error("[SharedMockDB] RAW error:", error);
                return [];
              }
            },
          };
        },
        run: async () => {
          try {
            const result = dataStore.run(sql, []);
            return {
              success: true,
              meta: {
                changes: result.changes,
                last_row_id: result.lastInsertRowid,
              },
            };
          } catch (error) {
            console.error("[SharedMockDB] RUN (no bind) error:", error);
            return {
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            };
          }
        },
        first: async () => {
          try {
            return dataStore.queryOne(sql, []);
          } catch (error) {
            console.error("[SharedMockDB] FIRST (no bind) error:", error);
            return null;
          }
        },
        all: async () => {
          try {
            const results = dataStore.query(sql, []);
            return {
              results,
              success: true,
            };
          } catch (error) {
            console.error("[SharedMockDB] ALL (no bind) error:", error);
            return {
              results: [],
              success: false,
              error: error instanceof Error ? error.message : "Unknown error",
            };
          }
        },
      };
    },
    exec: async (sql: string) => {
      try {
        // For exec, we use the underlying SQLite's exec which can handle multiple statements
        const db = dataStore.getDB();
        db.exec(sql);
        console.log("[SharedMockDB] EXEC executed successfully");
        return { count: 0, duration: 0, results: [] };
      } catch (error) {
        console.error("[SharedMockDB] EXEC error:", error);
        throw error;
      }
    },
    close: async () => {
      try {
        dataStore.close();
        console.log("[SharedMockDB] Database closed");
      } catch (error) {
        console.error("[SharedMockDB] Close error:", error);
      }
    },
  };
}

async function runMigrations(db: TestDB) {
  // Create restaurants table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS restaurants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT,
      address TEXT NOT NULL,
      district TEXT NOT NULL,
      city TEXT DEFAULT '台中市',
      phone TEXT NOT NULL,
      email TEXT UNIQUE,
      website TEXT,
      businessHours TEXT DEFAULT '{}',
      isAvailable BOOLEAN DEFAULT 1,
      isActive BOOLEAN DEFAULT 1,
      logoUrl TEXT,
      bannerUrl TEXT,
      imageUrls TEXT DEFAULT '[]',
      settings TEXT DEFAULT '{}',
      rating REAL DEFAULT 0.0,
      reviewCount INTEGER DEFAULT 0,
      totalOrders INTEGER DEFAULT 0,
      status INTEGER DEFAULT 1,
      planType INTEGER DEFAULT 0,
      shopQrCode TEXT UNIQUE,
      shopQrCodeImageUrl TEXT,
      enableShopMode BOOLEAN DEFAULT 0,
      shopQrSettings TEXT DEFAULT '{}',
      shopQrVersion INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create categories table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurantId INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      parentId INTEGER,
      sortOrder INTEGER DEFAULT 0,
      status INTEGER DEFAULT 1,
      isActive BOOLEAN DEFAULT 1,
      isVisible BOOLEAN DEFAULT 1,
      imageUrl TEXT,
      itemCount INTEGER DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (restaurantId) REFERENCES restaurants(id) ON DELETE CASCADE
    );
  `);

  // Create menu_items table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurantId INTEGER NOT NULL,
      categoryId INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      ingredients TEXT,
      price REAL NOT NULL,
      originalPrice REAL,
      imageUrl TEXT,
      imageVariants TEXT DEFAULT '{}',
      isAvailable BOOLEAN DEFAULT 1,
      isFeatured BOOLEAN DEFAULT 0,
      isPopular BOOLEAN DEFAULT 0,
      sortOrder INTEGER DEFAULT 0,
      inventoryCount INTEGER DEFAULT -1,
      spiceLevel INTEGER DEFAULT 0,
      preparationTime INTEGER,
      calories INTEGER,
      dietaryInfo TEXT DEFAULT '{}',
      allergens TEXT DEFAULT '[]',
      options TEXT DEFAULT '[]',
      orderCount INTEGER DEFAULT 0,
      viewCount INTEGER DEFAULT 0,
      rating REAL DEFAULT 0.0,
      reviewCount INTEGER DEFAULT 0,
      availableHours TEXT DEFAULT '{}',
      tags TEXT DEFAULT '[]',
      keywords TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (restaurantId) REFERENCES restaurants(id) ON DELETE CASCADE,
      FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE
    );
  `);

  // Create orders and orderItems tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurantId INTEGER NOT NULL,
      tableId INTEGER,
      customerId INTEGER,
      orderNumber TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      subtotal REAL NOT NULL,
      taxAmount REAL DEFAULT 0,
      serviceCharge REAL DEFAULT 0,
      discountAmount REAL DEFAULT 0,
      totalAmount REAL NOT NULL,
      customerInfo TEXT DEFAULT '{}',
      notes TEXT,
      internalNotes TEXT,
      couponCode TEXT,
      orderSource TEXT DEFAULT 'direct',
      orderType TEXT DEFAULT 'table',
      estimatedPrepTime INTEGER,
      actualPrepTime INTEGER,
      confirmedAt DATETIME,
      preparingAt DATETIME,
      readyAt DATETIME,
      deliveredAt DATETIME,
      paidAt DATETIME,
      cancelledAt DATETIME,
      paymentMethod TEXT,
      paymentStatus TEXT DEFAULT 'pending',
      rating REAL,
      reviewComment TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (restaurantId) REFERENCES restaurants(id) ON DELETE CASCADE,
      FOREIGN KEY (tableId) REFERENCES tables(id) ON DELETE SET NULL,
      FOREIGN KEY (customerId) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId INTEGER NOT NULL,
      menuItemId INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unitPrice REAL NOT NULL,
      totalPrice REAL NOT NULL,
      customizations TEXT DEFAULT '{}',
      notes TEXT,
      status TEXT DEFAULT 'pending',
      itemSnapshot TEXT DEFAULT '{}',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (menuItemId) REFERENCES menuItems(id) ON DELETE RESTRICT
    );
  `);

  // Create users and tables tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      fullName TEXT,
      email TEXT UNIQUE,
      phone TEXT,
      role INTEGER DEFAULT 5,
      restaurantId INTEGER,
      isActive BOOLEAN DEFAULT 1,
      isVerified BOOLEAN DEFAULT 0,
      lastLogin DATETIME,
      preferences TEXT DEFAULT '{}',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (restaurantId) REFERENCES restaurants(id) ON DELETE SET NULL
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      restaurantId INTEGER NOT NULL,
      number TEXT NOT NULL,
      seats INTEGER NOT NULL,
      status TEXT DEFAULT 'available',
      isOccupied BOOLEAN DEFAULT 0,
      currentOrderId INTEGER,
      occupiedAt DATETIME,
      occupiedBy INTEGER,
      qrCode TEXT,
      isActive BOOLEAN DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (restaurantId) REFERENCES restaurants(id) ON DELETE CASCADE,
      FOREIGN KEY (currentOrderId) REFERENCES orders(id) ON DELETE SET NULL,
      FOREIGN KEY (occupiedBy) REFERENCES users(id) ON DELETE SET NULL
    );
  `);

  // Create queue-related tables for testing
  await db.exec(`
    CREATE TABLE IF NOT EXISTS waiting_queue (
      id TEXT PRIMARY KEY,
      restaurant_id INTEGER NOT NULL,
      queue_number INTEGER NOT NULL,
      customer_name TEXT,
      customer_phone TEXT,
      customer_email TEXT,
      party_size INTEGER NOT NULL,
      special_requests TEXT,
      priority INTEGER DEFAULT 0,
      queue_type TEXT DEFAULT 'online',
      estimated_wait_minutes INTEGER DEFAULT 0,
      actual_wait_minutes INTEGER,
      table_preferences TEXT DEFAULT '[]',
      status TEXT DEFAULT 'waiting',
      notification_methods TEXT DEFAULT '[]',
      notification_sent BOOLEAN DEFAULT 0,
      notification_count INTEGER DEFAULT 0,
      last_notification_at DATETIME,
      check_in_code TEXT,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      called_at DATETIME,
      notified_at DATETIME,
      seated_at DATETIME,
      cancelled_at DATETIME,
      assigned_table_id INTEGER,
      served_by INTEGER,
      notes TEXT,
      metadata TEXT DEFAULT '{}'
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS queue_settings (
      restaurant_id INTEGER PRIMARY KEY,
      is_enabled BOOLEAN DEFAULT 1,
      max_queue_size INTEGER DEFAULT 50,
      avg_service_time INTEGER DEFAULT 45,
      max_wait_time INTEGER DEFAULT 120,
      min_advance_notice INTEGER DEFAULT 5,
      notification_methods TEXT DEFAULT '["sms"]',
      auto_call_enabled BOOLEAN DEFAULT 1,
      auto_call_interval INTEGER DEFAULT 10,
      no_show_timeout INTEGER DEFAULT 15,
      queue_number_reset TEXT DEFAULT 'daily',
      priority_rules TEXT DEFAULT '{}',
      table_assignment_rules TEXT DEFAULT '{}',
      notification_templates TEXT DEFAULT '{}',
      business_hours TEXT DEFAULT '{}',
      holiday_settings TEXT DEFAULT '{}',
      display_settings TEXT DEFAULT '{}',
      integration_settings TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS queue_events (
      id TEXT PRIMARY KEY,
      restaurant_id INTEGER NOT NULL,
      queue_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_data TEXT,
      triggered_by INTEGER,
      triggered_by_system BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS queue_notifications (
      id TEXT PRIMARY KEY,
      queue_id TEXT NOT NULL,
      notification_type TEXT NOT NULL,
      recipient TEXT NOT NULL,
      message_template TEXT,
      message_content TEXT NOT NULL,
      delivery_status TEXT DEFAULT 'pending',
      delivery_provider TEXT,
      provider_response TEXT,
      delivery_attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 3,
      sent_at DATETIME,
      delivered_at DATETIME,
      failed_at DATETIME,
      error_message TEXT,
      cost REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_waiting_queue_restaurant_status
    ON waiting_queue(restaurant_id, status)
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_waiting_queue_joined_at
    ON waiting_queue(joined_at)
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_queue_events_restaurant_queue
    ON queue_events(restaurant_id, queue_id)
  `);

  // Create group orders tables (column names match Drizzle schema in packages/database/src/schema/group-orders.ts)
  await db.exec(`
    CREATE TABLE IF NOT EXISTS group_orders (
      id TEXT PRIMARY KEY,
      share_code TEXT UNIQUE NOT NULL,
      master_order_id INTEGER,
      created_by INTEGER NOT NULL,
      restaurant_id TEXT NOT NULL,
      table_id INTEGER,
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ordering', 'checkout', 'completed', 'cancelled')),
      split_type TEXT DEFAULT 'individual' CHECK (split_type IN ('equal', 'proportional', 'individual', 'custom')),
      total_amount REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      service_charge REAL DEFAULT 0,
      final_amount REAL DEFAULT 0,
      total_amount_cents INTEGER,
      tax_amount_cents INTEGER,
      service_charge_cents INTEGER,
      final_amount_cents INTEGER,
      expires_at_ms INTEGER NOT NULL,
      locked_at_ms INTEGER,
      completed_at_ms INTEGER,
      settings TEXT DEFAULT '{}',
      notes TEXT,
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL,

      FOREIGN KEY (master_order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE SET NULL
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS group_members (
      id TEXT PRIMARY KEY,
      group_order_id TEXT NOT NULL,
      user_id INTEGER,
      session_id TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      avatar_url TEXT,
      role TEXT DEFAULT 'member' CHECK (role IN ('creator', 'admin', 'member')),
      permissions TEXT DEFAULT '{}',
      joined_at_ms INTEGER NOT NULL,
      last_active_at_ms INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1,
      left_at_ms INTEGER,

      FOREIGN KEY (group_order_id) REFERENCES group_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      UNIQUE(group_order_id, session_id)
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS group_cart_items (
      id TEXT PRIMARY KEY,
      group_order_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      menu_item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price REAL NOT NULL,
      total_price REAL NOT NULL,
      unit_price_cents INTEGER,
      total_price_cents INTEGER,
      customizations TEXT DEFAULT '{}',
      special_instructions TEXT,
      status TEXT DEFAULT 'active' CHECK (status IN ('active', 'removed', 'ordered')),
      added_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL,

      FOREIGN KEY (group_order_id) REFERENCES group_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES group_members(id) ON DELETE CASCADE,
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS split_bills (
      id TEXT PRIMARY KEY,
      group_order_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      tax_amount REAL NOT NULL DEFAULT 0,
      service_charge REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      tip_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL,
      subtotal_cents INTEGER,
      tax_amount_cents INTEGER,
      service_charge_cents INTEGER,
      discount_amount_cents INTEGER,
      tip_amount_cents INTEGER,
      total_amount_cents INTEGER,
      items TEXT DEFAULT '[]',
      payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'paid', 'failed', 'refunded')),
      payment_method TEXT,
      payment_reference TEXT,
      paid_at_ms INTEGER,
      created_at_ms INTEGER NOT NULL,
      updated_at_ms INTEGER NOT NULL,

      FOREIGN KEY (group_order_id) REFERENCES group_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES group_members(id) ON DELETE CASCADE,
      UNIQUE(group_order_id, member_id)
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS share_codes (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('group_order', 'menu_share', 'table_share')),
      resource_id TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      usage_limit INTEGER DEFAULT -1,
      usage_count INTEGER DEFAULT 0,
      expires_at_ms INTEGER,
      is_active INTEGER DEFAULT 1,
      metadata TEXT DEFAULT '{}',
      created_at_ms INTEGER NOT NULL,

      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS group_activity_logs (
      id TEXT PRIMARY KEY,
      group_order_id TEXT NOT NULL,
      member_id TEXT,
      action TEXT NOT NULL,
      description TEXT,
      metadata TEXT DEFAULT '{}',
      created_at_ms INTEGER NOT NULL,

      FOREIGN KEY (group_order_id) REFERENCES group_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES group_members(id) ON DELETE SET NULL
    )
  `);

  // Create indexes for group orders tables
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_group_orders_share_code ON group_orders(share_code)
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_group_orders_restaurant_id ON group_orders(restaurant_id)
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_group_orders_status ON group_orders(status)
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_group_members_group_order_id ON group_members(group_order_id)
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_group_cart_items_group_order_id ON group_cart_items(group_order_id)
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_split_bills_group_order_id ON split_bills(group_order_id)
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_group_activity_logs_group_order_id ON group_activity_logs(group_order_id)
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS shop_subscriptions (
      id TEXT PRIMARY KEY,
      restaurant_id TEXT NOT NULL UNIQUE,
      plan_tier TEXT NOT NULL DEFAULT 'trial',
      module_overrides TEXT DEFAULT '{}',
      deployment_mode TEXT NOT NULL DEFAULT 'managed',
      is_active INTEGER NOT NULL DEFAULT 1,
      trial_ends_at_ms INTEGER,
      billing_cycle_start_at_ms INTEGER,
      billing_cycle_end_at_ms INTEGER,
      notes TEXT,
      created_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
      updated_at_ms INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    )
  `);
}

export function createMockQueueData() {
  return {
    validJoinRequest: {
      restaurantId: "S-20250124-001",
      customerName: "測試顧客",
      customerPhone: "012-3456789",
      customerEmail: "test@example.com",
      partySize: 4,
      specialRequests: "需要兒童座椅",
      queueType: "online" as const,
      tablePreferences: [1, 2],
      notificationMethods: ["sms"],
    },

    invalidJoinRequest: {
      restaurantId: "invalid",
      customerName: "",
      partySize: 0,
    },

    validCallRequest: {
      restaurantId: "S-20250124-001",
      tableId: 5,
    },

    invalidCallRequest: {
      restaurantId: "invalid",
    },

    sampleQueueItem: {
      id: "queue_001",
      restaurantId: "S-20250124-001",
      queueNumber: 1,
      customerName: "張先生",
      customerPhone: "012-3456789",
      customerEmail: "zhang@example.com",
      partySize: 4,
      specialRequests: "需要兒童座椅",
      priority: 1,
      queueType: "online",
      status: "waiting",
      joinedAt: new Date(Date.now() - 1800000).toISOString(),
      estimatedWaitMinutes: 20,
      tablePreferences: [1, 2],
      notificationMethods: ["sms"],
      checkInCode: "ABC123",
      metadata: {},
    },

    sampleSettings: {
      restaurantId: "S-20250124-001",
      isEnabled: true,
      maxQueueSize: 50,
      avgServiceTime: 45,
      maxWaitTime: 120,
      minAdvanceNotice: 5,
      notificationMethods: ["sms"],
      autoCallEnabled: true,
      autoCallInterval: 10,
      noShowTimeout: 15,
      queueNumberReset: "daily" as const,
      priorityRules: {},
      tableAssignmentRules: {},
      notificationTemplates: {},
      businessHours: {},
      holidaySettings: {},
      displaySettings: {},
      integrationSettings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };
}

export async function seedTestData(db: TestDB) {
  const mockData = createMockQueueData();

  // Insert test queue settings
  await db
    .prepare(
      `
    INSERT INTO queue_settings (
      restaurant_id, is_enabled, max_queue_size, avg_service_time,
      max_wait_time, min_advance_notice, notification_methods,
      auto_call_enabled, auto_call_interval, no_show_timeout,
      queue_number_reset, priority_rules, table_assignment_rules,
      notification_templates, business_hours, holiday_settings,
      display_settings, integration_settings
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .bind(
      mockData.sampleSettings.restaurantId,
      mockData.sampleSettings.isEnabled,
      mockData.sampleSettings.maxQueueSize,
      mockData.sampleSettings.avgServiceTime,
      mockData.sampleSettings.maxWaitTime,
      mockData.sampleSettings.minAdvanceNotice,
      JSON.stringify(mockData.sampleSettings.notificationMethods),
      mockData.sampleSettings.autoCallEnabled,
      mockData.sampleSettings.autoCallInterval,
      mockData.sampleSettings.noShowTimeout,
      mockData.sampleSettings.queueNumberReset,
      JSON.stringify(mockData.sampleSettings.priorityRules),
      JSON.stringify(mockData.sampleSettings.tableAssignmentRules),
      JSON.stringify(mockData.sampleSettings.notificationTemplates),
      JSON.stringify(mockData.sampleSettings.businessHours),
      JSON.stringify(mockData.sampleSettings.holidaySettings),
      JSON.stringify(mockData.sampleSettings.displaySettings),
      JSON.stringify(mockData.sampleSettings.integrationSettings),
    )
    .run();

  // Insert test queue item
  const queueItem = mockData.sampleQueueItem;
  await db
    .prepare(
      `
    INSERT INTO waiting_queue (
      id, restaurant_id, queue_number, customer_name, customer_phone,
      customer_email, party_size, special_requests, priority, queue_type,
      estimated_wait_minutes, table_preferences, status, notification_methods,
      check_in_code, joined_at, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .bind(
      queueItem.id,
      queueItem.restaurantId,
      queueItem.queueNumber,
      queueItem.customerName,
      queueItem.customerPhone,
      queueItem.customerEmail,
      queueItem.partySize,
      queueItem.specialRequests,
      queueItem.priority,
      queueItem.queueType,
      queueItem.estimatedWaitMinutes,
      JSON.stringify(queueItem.tablePreferences),
      queueItem.status,
      JSON.stringify(queueItem.notificationMethods),
      queueItem.checkInCode,
      queueItem.joinedAt,
      JSON.stringify(queueItem.metadata),
    )
    .run();
}

// Helper function to wait for async operations
export function waitFor(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Helper function to generate test IDs
export function generateTestId(prefix: string = "test") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create inline mock Drizzle instance
 * This mocks Drizzle ORM using the shared data store
 */
function createInlineMockDrizzle(dataStore: SharedDataStore) {
  const getTableName = (table: any): string => {
    if (table?.[Symbol.for("drizzle:Name")])
      return table[Symbol.for("drizzle:Name")];
    if (table?.shareCode && table?.splitType) return "group_orders";
    if (table?.groupOrderId && table?.sessionId) return "group_members";
    if (table?.groupOrderId && table?.menuItemId && table?.unitPrice)
      return "group_cart_items";
    if (table?.groupOrderId && table?.paymentStatus) return "split_bills";
    if (table?.groupOrderId && table?.action) return "group_activity_logs";
    if (table?.categoryId && table?.preparationTime) return "menu_items";
    if (table?.toString().includes("restaurants")) return "restaurants";
    if (table?.toString().includes("categories")) return "categories";
    if (table?.toString().includes("menu_items")) return "menu_items";
    if (table?.toString().includes("group_orders")) return "group_orders";
    if (table?.toString().includes("group_members")) return "group_members";
    if (table?.toString().includes("group_cart_items"))
      return "group_cart_items";
    if (table?.toString().includes("split_bills")) return "split_bills";
    if (table?.toString().includes("group_activity_logs"))
      return "group_activity_logs";
    if (table?.toString().includes("tables")) return "tables";
    if (table?.toString().includes("users")) return "users";
    if (table?.toString().includes("orders")) return "orders";
    return "unknown";
  };

  const toSnakeCase = (str: string): string =>
    str
      .replace(/([A-Z])/g, "_$1")
      .toLowerCase()
      .replace(/^_/, "");

  const toCamelCase = (str: string): string =>
    str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

  const convertKeysToCamelCase = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    if (Array.isArray(obj)) return obj.map(convertKeysToCamelCase);
    if (typeof obj !== "object") return obj;

    const result: any = {};
    for (const key of Object.keys(obj)) {
      result[toCamelCase(key)] = obj[key];
    }
    return result;
  };

  const extractEqualities = (
    condition: any,
  ): Array<{ column: string; value: any }> => {
    const chunks =
      condition?.queryChunks ??
      condition?.sql?.queryChunks ??
      condition?.decoder?.queryChunks;

    if (!Array.isArray(chunks)) return [];

    const equalities: Array<{ column: string; value: any }> = [];
    let pendingColumn: string | null = null;
    let sawEquals = false;

    for (const chunk of chunks) {
      if (!chunk || typeof chunk !== "object") continue;

      const chunkText = Array.isArray(chunk.value)
        ? chunk.value.join("")
        : undefined;
      if (chunkText?.includes("=")) {
        sawEquals = true;
        continue;
      }

      const columnName =
        typeof chunk.name === "string"
          ? chunk.name
          : typeof chunk.column?.name === "string"
            ? chunk.column.name
            : null;
      if (columnName) {
        pendingColumn = columnName;
        sawEquals = false;
        continue;
      }

      if (
        pendingColumn &&
        sawEquals &&
        chunk.value !== undefined &&
        !Array.isArray(chunk.value)
      ) {
        equalities.push({ column: pendingColumn, value: chunk.value });
        pendingColumn = null;
        sawEquals = false;
      }
    }

    return equalities;
  };

  const applyWhere = (rows: any[], condition: any): any[] => {
    const equalities = extractEqualities(condition);
    if (equalities.length === 0) return rows;

    return rows.filter((row) =>
      equalities.every(({ column, value }) => {
        const snakeColumn = toSnakeCase(column);
        const rowValue = row[snakeColumn] ?? row[column];
        return rowValue == value;
      }),
    );
  };

  return {
    insert: (table: any) => {
      const tableName = getTableName(table);
      console.log("[MockDrizzle] insert() for table:", tableName);

      return {
        values: (data: any) => {
          console.log("[MockDrizzle] values():", data);

          const executeInsert = async () => {
            console.log("[MockDrizzle] returning() called");

            const now = new Date().toISOString();

            // Handle array of records (bulk insert)
            if (Array.isArray(data)) {
              const results = data.map((item) => {
                if (!item.createdAt) item.createdAt = now;
                if (!item.updatedAt) item.updatedAt = now;
                const inserted = dataStore.insert(tableName, item);
                console.log("[MockDrizzle] Stored record ID:", inserted.id);
                return { ...inserted };
              });
              console.log("[MockDrizzle] Returning:", results);
              return results;
            }

            // Handle single record
            if (!data.createdAt) data.createdAt = now;
            if (!data.updatedAt) data.updatedAt = now;

            // Insert into shared data store
            const inserted = dataStore.insert(tableName, data);
            console.log("[MockDrizzle] Stored record ID:", inserted.id);

            const result = [{ ...inserted }];
            console.log("[MockDrizzle] Returning:", result);
            return result;
          };

          return {
            then: (resolve: any, reject: any) =>
              executeInsert().then(resolve, reject),
            returning: executeInsert,
          };
        },
      };
    },

    select: (fields?: any) => ({
      from: (table: any) => {
        const tableName = getTableName(table);

        // Check if this is an aggregate query (contains sum, count, avg, etc)
        // Drizzle aggregate functions have queryChunks property
        const isAggregateQuery =
          fields &&
          typeof fields === "object" &&
          Object.values(fields).some(
            (field: any) =>
              field &&
              typeof field === "object" &&
              (field.queryChunks ||
                field.sql ||
                field._sqlChunks ||
                field.name?.includes("sum") ||
                field.name?.includes("count")),
          );

        // Create a promise-like object that can be awaited directly or .execute() can be called
        const createAwaitableQuery = (getData: () => any[]) => {
          const query: any = {
            execute: async () => {
              const data = getData();

              // For aggregate queries, always return at least one row with default values
              if (isAggregateQuery && data.length === 0) {
                const defaultRow: any = {};
                if (fields && typeof fields === "object") {
                  Object.keys(fields).forEach((key) => {
                    // For count, default to 0; for sum/avg, default to null
                    defaultRow[key] = key.toLowerCase().includes("count")
                      ? 0
                      : null;
                  });
                }
                return [defaultRow];
              }

              return data;
            },
            then: (resolve: any, reject: any) => {
              // Make the query thenable so it can be directly awaited
              try {
                const data = getData();

                // For aggregate queries, always return at least one row with default values
                let result = data;
                if (isAggregateQuery && data.length === 0) {
                  const defaultRow: any = {};
                  if (fields && typeof fields === "object") {
                    Object.keys(fields).forEach((key) => {
                      defaultRow[key] = key.toLowerCase().includes("count")
                        ? 0
                        : null;
                    });
                  }
                  result = [defaultRow];
                }

                return Promise.resolve(result).then(resolve, reject);
              } catch (error) {
                return Promise.reject(error).then(resolve, reject);
              }
            },
          };
          return query;
        };

        // Create chainable query methods
        const createQueryChain = () => {
          const getData = () => {
            return dataStore.select(tableName).map(convertKeysToCamelCase);
          };

          return {
            where: (condition: any) => {
              const getFilteredData = () =>
                applyWhere(dataStore.select(tableName), condition).map(
                  convertKeysToCamelCase,
                );
              const query = createAwaitableQuery(getFilteredData);

              // Add .get() method for single record queries
              query.get = async () => {
                const allData = applyWhere(
                  dataStore.select(tableName),
                  condition,
                ).map(convertKeysToCamelCase);
                console.log(
                  "[MockDrizzle] where().get() - tableName:",
                  tableName,
                  "records:",
                  allData?.length || 0,
                );
                if (!allData || allData.length === 0) return null;

                // Implement WHERE filtering for eq() conditions
                // Drizzle's eq(column, value) creates an object with column and value properties
                if (condition && typeof condition === "object") {
                  console.log(
                    "[MockDrizzle] Condition type:",
                    condition.constructor?.name,
                  );
                  console.log(
                    "[MockDrizzle] Condition keys:",
                    Object.keys(condition),
                  );
                  // Don't stringify condition - it contains circular references
                  // console.log('[MockDrizzle] Condition structure:', JSON.stringify(condition, null, 2).substring(0, 500))

                  // Try to extract filter from Drizzle eq() condition
                  // eq() structure: { sql: {queryChunks: [column, ' = ', value]}, ...}
                  // OR: condition itself is SQL object with queryChunks
                  // For simple ID queries, try to detect the pattern

                  // Strategy 1a: Check if condition itself has queryChunks (newer Drizzle format)
                  let chunks = null;
                  if (
                    condition.queryChunks &&
                    Array.isArray(condition.queryChunks)
                  ) {
                    chunks = condition.queryChunks;
                    console.log(
                      "[MockDrizzle] Found queryChunks, length:",
                      chunks.length,
                    );
                  }
                  // Strategy 1b: Check if condition has sql.queryChunks (older Drizzle format)
                  else if (
                    condition.sql?.queryChunks &&
                    Array.isArray(condition.sql.queryChunks)
                  ) {
                    chunks = condition.sql.queryChunks;
                    console.log(
                      "[MockDrizzle] Found sql.queryChunks, length:",
                      chunks.length,
                    );
                  }

                  if (chunks) {
                    console.log(
                      "[MockDrizzle] Processing",
                      chunks.length,
                      "chunks",
                    );

                    // NEW APPROACH: Find the Param chunk (has numeric value)
                    // Pattern: [StringChunk, Column, StringChunk(" = "), Param(value), StringChunk]
                    let compareValue: any = null;
                    for (const chunk of chunks) {
                      // Param chunks have constructor name "Param" and numeric/string value
                      if (
                        chunk &&
                        typeof chunk === "object" &&
                        chunk.value !== undefined
                      ) {
                        // Check if this is a Param (not StringChunk with array value)
                        if (
                          typeof chunk.value === "number" ||
                          (typeof chunk.value === "string" &&
                            !Array.isArray(chunk.value))
                        ) {
                          compareValue = chunk.value;
                          break;
                        }
                      }
                    }

                    // If we found a value, search for matching record by ID
                    // (assuming most queries are by ID)
                    if (compareValue !== null && compareValue !== undefined) {
                      console.log(
                        `[MockDrizzle] Searching for record with id = ${compareValue}`,
                      );
                      const found = allData.find(
                        (item: any) => item.id === compareValue,
                      );
                      if (found) {
                        console.log(
                          "[MockDrizzle] Found matching record:",
                          found.id,
                        );
                        return found;
                      }
                      console.log(
                        "[MockDrizzle] No matching record found for id:",
                        compareValue,
                      );
                      return null;
                    }

                    // Legacy fallback for numeric ID queries
                    for (let i = 0; i < chunks.length; i++) {
                      if (
                        typeof chunks[i] === "string" &&
                        chunks[i].includes("=")
                      ) {
                        const value = chunks[i + 1];
                        if (typeof value === "number") {
                          const found = allData.find(
                            (item: any) => item.id === value,
                          );
                          if (found) return found;
                        }
                      }
                    }
                  }

                  // Strategy 2: Check if this is a wrapper with nested condition
                  if (condition.value !== undefined) {
                    // Direct value comparison for simple eq(column, value)
                    const value = condition.value;
                    if (typeof value === "number") {
                      const found = allData.find(
                        (item: any) => item.id === value,
                      );
                      if (found) return found;
                    }
                  }

                  // Fallback: return null instead of first record to avoid false positives
                  console.warn(
                    "[MockDrizzle] where().get() - Could not parse condition, returning null",
                  );
                  return null;
                }
                return null;
              };

              // Add chainable methods to where() result
              query.orderBy = (...args: any[]) => {
                return {
                  limit: (limitValue: number) =>
                    createAwaitableQuery(() => {
                      const allData = getData();
                      return allData.slice(0, limitValue);
                    }),
                  ...createAwaitableQuery(getData),
                };
              };

              query.limit = (limitValue: number) => {
                const limitedData = () => {
                  const allData = getData();
                  return allData.slice(0, limitValue);
                };
                return createAwaitableQuery(limitedData);
              };

              query.groupBy = (...args: any[]) => {
                // For aggregate queries with groupBy, return chainable query
                const groupByQuery = createAwaitableQuery(getData);

                // Add orderBy and limit after groupBy
                groupByQuery.orderBy = (...orderArgs: any[]) => {
                  return {
                    limit: (limitValue: number) =>
                      createAwaitableQuery(() => {
                        const allData = getData();
                        return allData.slice(0, limitValue);
                      }),
                    ...createAwaitableQuery(getData),
                  };
                };

                groupByQuery.limit = (limitValue: number) => {
                  const limitedData = () => {
                    const allData = getData();
                    return allData.slice(0, limitValue);
                  };
                  return createAwaitableQuery(limitedData);
                };

                return groupByQuery;
              };

              return query;
            },
            leftJoin: (joinTable: any, condition: any) => {
              // For mock, simply return chainable query without actually joining
              return createQueryChain();
            },
            innerJoin: (joinTable: any, condition: any) => {
              // For mock, simply return chainable query without actually joining
              return createQueryChain();
            },
            limit: (limitValue: number) => {
              const limitedData = () => {
                const allData = getData();
                return allData.slice(0, limitValue);
              };
              return createAwaitableQuery(limitedData);
            },
            orderBy: (...args: any[]) => {
              return {
                limit: (limitValue: number) =>
                  createAwaitableQuery(() => {
                    const allData = getData();
                    return allData.slice(0, limitValue);
                  }),
                ...createAwaitableQuery(getData),
              };
            },
            ...createAwaitableQuery(getData),
          };
        };

        return createQueryChain();
      },
    }),

    update: (table: any) => {
      const tableName = getTableName(table);
      console.log("[MockDrizzle] update() called for table:", tableName);

      return {
        set: (data: any) => {
          console.log(
            "[MockDrizzle] set() called with data:",
            Object.keys(data),
          );

          return {
            where: (condition: any) => {
              console.log("[MockDrizzle] where() called for UPDATE");

              // Create update executor function
              const executeUpdate = async () => {
                // Use dataStore to get records from the table
                const normalizedTableName = tableName
                  .replace(/([A-Z])/g, "_$1")
                  .toLowerCase()
                  .replace(/^_/, "");
                const allRecords = dataStore.query(
                  `SELECT * FROM ${normalizedTableName}`,
                );
                if (allRecords.length === 0) return [];

                const recordsToUpdate = applyWhere(allRecords, condition);

                console.log(
                  `[MockDrizzle] UPDATE ${normalizedTableName}, found ${recordsToUpdate.length} records`,
                );

                const updatedRecords: any[] = [];

                // Helper function to convert camelCase to snake_case
                const toSnakeCase = (str: string): string => {
                  return str
                    .replace(/([A-Z])/g, "_$1")
                    .toLowerCase()
                    .replace(/^_/, "");
                };

                for (const record of recordsToUpdate) {
                  // Process data to handle sql`` template literals for increments
                  const processedData: any = {
                    updated_at: new Date().toISOString(),
                  };

                  for (const [key, value] of Object.entries(data)) {
                    // Convert camelCase key to snake_case for database
                    const snakeKey = toSnakeCase(key);
                    // Check if value is an SQL increment expression (has queryChunks or sql property)
                    if (
                      value &&
                      typeof value === "object" &&
                      ((value as SqlExpressionLike).queryChunks ||
                        (value as SqlExpressionLike).sql)
                    ) {
                      // For increment operations like sql`${field} + 1`, just increment by 1
                      // This is a simplified mock - doesn't parse the actual SQL
                      const currentValue = record[snakeKey] || 0;
                      processedData[snakeKey] = currentValue + 1;
                    } else {
                      processedData[snakeKey] = value;
                    }
                  }

                  const updated = { ...record, ...processedData };
                  // Update the record in dataStore
                  // Filter out undefined values and convert Date objects to ISO strings for SQLite compatibility
                  const entries = Object.entries(processedData).filter(
                    ([_, v]) => v !== undefined,
                  );
                  const keys = entries.map(([k]) => k); // Already snake_case
                  const values = entries.map(([key, v]) =>
                    v instanceof Date && key.endsWith("_ms")
                      ? v.getTime()
                      : v instanceof Date
                        ? v.toISOString()
                        : v === null
                          ? null
                          : v,
                  );
                  if (keys.length > 0) {
                    dataStore.run(
                      `UPDATE ${normalizedTableName} SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`,
                      [...values, updated.id],
                    );
                  }
                  updatedRecords.push(updated);
                }

                return updatedRecords;
              };

              // Return object that supports direct await, .returning(), AND .run()
              const updateQuery: any = {
                then: (resolve: any, reject: any) => {
                  // Make the query thenable so it can be directly awaited
                  return executeUpdate().then(resolve, reject);
                },
                returning: async () => {
                  return executeUpdate();
                },
                run: async () => {
                  // .run() method for updates that don't return data
                  await executeUpdate();
                  return { changes: 1, lastInsertRowid: 0 };
                },
              };

              return updateQuery;
            },
          };
        },
      };
    },

    delete: (table: any) => {
      const tableName = getTableName(table);
      console.log("[MockDrizzle] delete() called for table:", tableName);

      return {
        where: async (condition: any) => {
          const rows = applyWhere(dataStore.select(tableName), condition);
          for (const row of rows) {
            dataStore.run(`DELETE FROM ${tableName} WHERE id = ?`, [row.id]);
          }
          return { changes: rows.length, lastInsertRowid: 0 };
        },
      };
    },

    query: new Proxy(
      {},
      {
        get: (target, tableName: string) => {
          // Normalize table name: convert camelCase to snake_case
          // menuItems -> menu_items, orderItems -> order_items
          const normalizedTableName = tableName
            .replace(/([A-Z])/g, "_$1")
            .toLowerCase()
            .replace(/^_/, "");
          console.log(
            "[MockDrizzle] Normalized table name:",
            tableName,
            "->",
            normalizedTableName,
          );

          // Helper function to convert camelCase to snake_case for column names
          const toSnakeCase = (str: string): string => {
            return str
              .replace(/([A-Z])/g, "_$1")
              .toLowerCase()
              .replace(/^_/, "");
          };

          // Helper function to convert snake_case to camelCase for returned data
          const toCamelCase = (str: string): string => {
            return str.replace(/_([a-z])/g, (_, letter) =>
              letter.toUpperCase(),
            );
          };

          // Helper function to convert all keys in an object from snake_case to camelCase
          const convertKeysToCamelCase = (obj: any): any => {
            if (obj === null || obj === undefined) return obj;
            if (Array.isArray(obj)) return obj.map(convertKeysToCamelCase);
            if (typeof obj !== "object") return obj;

            const result: any = {};
            for (const key of Object.keys(obj)) {
              const camelKey = toCamelCase(key);
              result[camelKey] = obj[key];
            }
            return result;
          };

          return {
            findFirst: async (options: any) => {
              console.log(
                "[MockDrizzle] query.findFirst() called for table:",
                tableName,
              );
              try {
                // Get all records first
                const allRecords = dataStore.query(
                  `SELECT * FROM ${normalizedTableName}`,
                );
                console.log(
                  "[MockDrizzle] Table",
                  tableName,
                  "has",
                  allRecords.length,
                  "total records",
                );

                // Apply WHERE filter in memory if provided
                let records = allRecords;
                if (options?.where && options.where.queryChunks) {
                  // Log the full structure to understand it
                  console.log(
                    "[MockDrizzle] queryChunks:",
                    JSON.stringify(
                      options.where.queryChunks.map((c: any, i: number) => ({
                        index: i,
                        type: c?.constructor?.name,
                        hasValue: c?.value !== undefined,
                        value: c?.value,
                        valueType: typeof c?.value,
                        name: c?.name,
                        columnName: c?.column?.name,
                        keys: c ? Object.keys(c) : [],
                      })),
                    ),
                  );

                  // Extract column name and filter value from queryChunks
                  // Structure: [StringChunk, SQLiteInteger(column), StringChunk(' = '), Param(value), StringChunk]
                  let columnName: string | null = null;
                  let filterValue: any = null;

                  options.where.queryChunks.forEach((chunk: any) => {
                    // Extract column name from SQLiteInteger or similar objects
                    // Try multiple possible locations for the column name
                    if (chunk && !columnName) {
                      if (chunk.name && typeof chunk.name === "string") {
                        columnName = chunk.name;
                      } else if (
                        chunk.column?.name &&
                        typeof chunk.column.name === "string"
                      ) {
                        columnName = chunk.column.name;
                      }
                    }
                    // Extract filter value ONLY from Param objects (check for numeric/string value, not array)
                    if (chunk && chunk.value !== undefined) {
                      // Skip StringChunk objects (their value is an array like [""] or [" = "])
                      if (!Array.isArray(chunk.value)) {
                        filterValue = chunk.value;
                      }
                    }
                  });

                  if (
                    columnName &&
                    filterValue !== null &&
                    filterValue !== undefined
                  ) {
                    // Convert camelCase column name to snake_case for SQLite lookup
                    const snakeCaseColName = toSnakeCase(columnName);
                    console.log(
                      "[MockDrizzle] Filtering by:",
                      columnName,
                      "(snake_case:",
                      snakeCaseColName,
                      ") =",
                      filterValue,
                    );

                    // Filter records in memory using both camelCase and snake_case column names
                    // Use loose equality (==) to handle numeric/string id comparisons
                    // (e.g., SQLite returns integer 1 but service queries with string "1")
                    records = allRecords.filter((record: any) => {
                      // Try camelCase first, then snake_case
                      return (
                        record[columnName!] == filterValue ||
                        record[snakeCaseColName] == filterValue
                      );
                    });
                  } else {
                    console.log(
                      "[MockDrizzle] Could not extract column name or value from WHERE clause",
                    );
                  }
                }

                console.log(
                  "[MockDrizzle] Found",
                  records.length,
                  "matching records",
                );
                if (records.length > 0) {
                  // Convert snake_case keys to camelCase for Drizzle ORM compatibility
                  const result = convertKeysToCamelCase(records[0]);
                  console.log(
                    "[MockDrizzle] First record (camelCase):",
                    JSON.stringify(result),
                  );
                  return result;
                }
                console.log("[MockDrizzle] No records found");
                return null;
              } catch (error) {
                console.error(
                  "[MockDrizzle] Error querying table:",
                  tableName,
                  error,
                );
                return null;
              }
            },
            findMany: async (options: any) => {
              console.log(
                "[MockDrizzle] query.findMany() called for table:",
                tableName,
              );
              try {
                let results = dataStore.query(
                  `SELECT * FROM ${normalizedTableName}`,
                );

                // Apply WHERE filter if provided
                if (options?.where && options.where.queryChunks) {
                  // Extract filter conditions from queryChunks
                  let columnName: string | null = null;
                  const filterValues: any[] = [];

                  options.where.queryChunks.forEach((chunk: any) => {
                    // Extract column name
                    if (
                      chunk &&
                      !columnName &&
                      chunk.name &&
                      typeof chunk.name === "string"
                    ) {
                      columnName = chunk.name;
                    }
                    // Extract filter values (handle both single value and array for inArray)
                    if (
                      chunk &&
                      chunk.value !== undefined &&
                      !Array.isArray(chunk.value)
                    ) {
                      filterValues.push(chunk.value);
                    }
                    // Handle inArray values (array of values)
                    if (chunk && chunk.values && Array.isArray(chunk.values)) {
                      filterValues.push(...chunk.values);
                    }
                  });

                  if (columnName && filterValues.length > 0) {
                    const snakeCaseColName = toSnakeCase(columnName);
                    console.log(
                      "[MockDrizzle] findMany filtering by:",
                      columnName,
                      "(snake_case:",
                      snakeCaseColName,
                      ") in",
                      filterValues,
                    );

                    results = results.filter((record: any) => {
                      const value =
                        record[columnName!] ?? record[snakeCaseColName];
                      return filterValues.includes(value);
                    });
                  }
                }

                // Convert snake_case keys to camelCase for Drizzle ORM compatibility
                const camelCaseResults = results.map(convertKeysToCamelCase);
                console.log(
                  "[MockDrizzle] findMany() returning",
                  camelCaseResults.length,
                  "records",
                );
                if (camelCaseResults.length > 0) {
                  console.log(
                    "[MockDrizzle] First record (camelCase):",
                    JSON.stringify(camelCaseResults[0]),
                  );
                }
                return camelCaseResults;
              } catch (error) {
                console.error(
                  "[MockDrizzle] Error querying table:",
                  tableName,
                  error,
                );
                return [];
              }
            },
          }; // Close return object
        }, // Close get trap
      },
    ),
  };
}

/**
 * Generate a valid JWT token for testing
 * Matches the payload format used in packages/database/src/services/auth.ts
 */
export function generateTestToken(payload?: {
  id?: number;
  username?: string;
  role?: number;
  restaurantId?: string | null;
}): string {
  const defaultPayload = {
    id: 1,
    username: "testuser",
    role: 0, // Admin role
    restaurantId: "S-20250124-001",
  };

  const tokenPayload = { ...defaultPayload, ...payload };

  // Use the same JWT_SECRET as in mockEnv
  const jwtSecret = "test-jwt-secret-for-testing-only";

  return sign(tokenPayload, jwtSecret, { expiresIn: "24h" });
}
