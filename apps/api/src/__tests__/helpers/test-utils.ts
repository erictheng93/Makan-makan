/**
 * Test Utilities for API Integration Testing
 *
 * CRITICAL: This module provides a complete test application with all routes
 * to prevent 404 errors in integration tests.
 */

import { Hono } from 'hono'
import type { AuthUser } from '../../middleware/auth'
import type { Env } from '../../types/env'
import { vi } from 'vitest'
import { createMockD1Database } from '../setup'
import { sign } from 'jsonwebtoken'
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js'

// Import all feature routes
import restaurantsFeature from '../../features/restaurants'
import authFeature from '../../features/authentication'
import menuFeature from '../../features/menu'
import kitchenFeature from '../../features/kitchen'
import ordersFeature from '../../features/orders'
import groupOrdersFeature from '../../features/group-orders'
import posFeature from '../../features/pos'
import queueFeature from '../../features/queue'
import tablesFeature from '../../features/tables'
import usersFeature from '../../features/users'
import analyticsFeature from '../../features/analytics'
import qrCodesFeature from '../../features/qr-codes'
import couponsFeature from '../../features/coupons'

// ============================================
// Shared Data Store for Test Database
// ============================================

/**
 * Shared in-memory data store that both D1 mock and Drizzle mock can use
 * Uses sql.js for real SQLite implementation (pure JavaScript, no compilation needed)
 */
class SharedDataStore {
  private db: SqlJsDatabase

  private constructor(db: SqlJsDatabase) {
    this.db = db
  }

  /**
   * Factory method to create a new SharedDataStore instance
   */
  static async create(): Promise<SharedDataStore> {
    const SQL = await initSqlJs()
    const db = new SQL.Database()

    const store = new SharedDataStore(db)
    await store.createTables()

    console.log('[SharedDataStore] Initialized with sql.js')
    return store
  }

  private async createTables() {
    // 1. Restaurants Table (using camelCase to match test expectations)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS restaurants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
        businessHours TEXT,
        isAvailable INTEGER NOT NULL DEFAULT 1,
        isActive INTEGER NOT NULL DEFAULT 1,
        status INTEGER DEFAULT 1,
        logoUrl TEXT,
        bannerUrl TEXT,
        imageUrls TEXT,
        shopQrCode TEXT UNIQUE,
        shopQrCodeImageUrl TEXT,
        enableShopMode INTEGER NOT NULL DEFAULT 0,
        shopQrSettings TEXT,
        shopQrVersion INTEGER NOT NULL DEFAULT 1,
        settings TEXT,
        rating REAL DEFAULT 0,
        reviewCount INTEGER NOT NULL DEFAULT 0,
        totalOrders INTEGER NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    `)

    // 2. Users Table (using camelCase to match test expectations)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT,
        phone TEXT,
        fullName TEXT,
        password TEXT,
        passwordHash TEXT NOT NULL,
        role INTEGER NOT NULL DEFAULT 5,
        restaurantId TEXT,
        address TEXT,
        dateOfBirth TEXT,
        profileImageUrl TEXT,
        isActive INTEGER NOT NULL DEFAULT 1,
        isVerified INTEGER NOT NULL DEFAULT 0,
        preferences TEXT,
        totalOrders INTEGER NOT NULL DEFAULT 0,
        totalSpent INTEGER NOT NULL DEFAULT 0,
        lastLoginAt INTEGER,
        passwordChangedAt INTEGER,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    `)

    // 3. Sessions Table (using camelCase)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        userId INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        refreshToken TEXT UNIQUE,
        userAgent TEXT,
        ipAddress TEXT,
        deviceInfo TEXT,
        location TEXT,
        isActive INTEGER NOT NULL DEFAULT 1,
        lastAccessedAt INTEGER NOT NULL,
        expiresAt INTEGER NOT NULL,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    `)

    // 4. Categories Table (using camelCase)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurantId TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        sortOrder INTEGER NOT NULL DEFAULT 0,
        isActive INTEGER NOT NULL DEFAULT 1,
        isVisible INTEGER NOT NULL DEFAULT 1,
        imageUrl TEXT,
        iconUrl TEXT,
        availableHours TEXT,
        itemCount INTEGER NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    `)

    // 5. Menu Items Table (using camelCase)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurantId TEXT NOT NULL,
        categoryId INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        ingredients TEXT,
        price REAL NOT NULL,
        originalPrice REAL,
        costPrice REAL,
        imageUrl TEXT,
        imageVariants TEXT,
        isAvailable INTEGER NOT NULL DEFAULT 1,
        isFeatured INTEGER NOT NULL DEFAULT 0,
        isPopular INTEGER NOT NULL DEFAULT 0,
        sortOrder INTEGER NOT NULL DEFAULT 0,
        inventoryCount INTEGER,
        minInventoryAlert INTEGER DEFAULT 5,
        spiceLevel INTEGER NOT NULL DEFAULT 0,
        preparationTime INTEGER DEFAULT 15,
        calories INTEGER,
        dietaryInfo TEXT,
        allergens TEXT,
        options TEXT,
        availableHours TEXT,
        orderCount INTEGER NOT NULL DEFAULT 0,
        rating REAL DEFAULT 0,
        reviewCount INTEGER NOT NULL DEFAULT 0,
        viewCount INTEGER NOT NULL DEFAULT 0,
        tags TEXT,
        keywords TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    `)

    // 6. Tables Table (using camelCase)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS tables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurantId TEXT NOT NULL,
        number TEXT NOT NULL,
        name TEXT,
        capacity INTEGER NOT NULL DEFAULT 4,
        location TEXT,
        floor INTEGER DEFAULT 1,
        section TEXT,
        qrCode TEXT NOT NULL UNIQUE,
        qrCodeImageUrl TEXT,
        qrCodeVersion INTEGER NOT NULL DEFAULT 1,
        qrMode TEXT DEFAULT 'table',
        seatCount INTEGER DEFAULT 0,
        seatLayout TEXT,
        seatNumberingStyle TEXT DEFAULT 'numeric',
        isOccupied INTEGER NOT NULL DEFAULT 0,
        isActive INTEGER NOT NULL DEFAULT 1,
        isReservable INTEGER NOT NULL DEFAULT 1,
        features TEXT,
        currentOrderId INTEGER,
        occupiedAt INTEGER,
        occupiedBy TEXT,
        estimatedFreeAt INTEGER,
        lastCleanedAt INTEGER,
        maintenanceNotes TEXT,
        totalUsage INTEGER NOT NULL DEFAULT 0,
        averageOccupancyMinutes INTEGER DEFAULT 0,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    `)

    // 7. Seats Table (using camelCase)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS seats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tableId INTEGER NOT NULL,
        seatNumber TEXT NOT NULL,
        seatName TEXT,
        position TEXT,
        qrCode TEXT NOT NULL UNIQUE,
        qrCodeImageUrl TEXT,
        qrCodeVersion INTEGER NOT NULL DEFAULT 1,
        isOccupied INTEGER NOT NULL DEFAULT 0,
        isActive INTEGER NOT NULL DEFAULT 1,
        currentOrderId INTEGER,
        occupiedAt INTEGER,
        occupiedBy TEXT,
        totalUsage INTEGER NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    `)

    // 8. Orders Table (using camelCase)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        restaurantId TEXT NOT NULL,
        tableId INTEGER NOT NULL,
        customerId INTEGER,
        orderNumber TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'pending',
        orderType TEXT DEFAULT 'table',
        subtotal REAL NOT NULL,
        taxAmount REAL NOT NULL DEFAULT 0,
        serviceCharge REAL NOT NULL DEFAULT 0,
        discountAmount REAL NOT NULL DEFAULT 0,
        totalAmount REAL NOT NULL,
        customerInfo TEXT,
        estimatedPrepTime INTEGER,
        actualPrepTime INTEGER,
        confirmedAt INTEGER,
        preparingAt INTEGER,
        readyAt INTEGER,
        deliveredAt INTEGER,
        paidAt INTEGER,
        cancelledAt INTEGER,
        paymentMethod TEXT,
        paymentStatus TEXT DEFAULT 'pending',
        paymentTransactionId TEXT,
        couponCode TEXT,
        promotionIds TEXT,
        rating INTEGER,
        reviewComment TEXT,
        reviewedAt INTEGER,
        notes TEXT,
        internalNotes TEXT,
        cancellationReason TEXT,
        refundAmount REAL,
        deliveryInfo TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    `)

    // 9. Order Items Table (using camelCase)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orderId INTEGER NOT NULL,
        menuItemId INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        unitPrice REAL NOT NULL,
        totalPrice REAL NOT NULL,
        itemSnapshot TEXT,
        customizations TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        preparedAt INTEGER,
        servedAt INTEGER,
        notes TEXT,
        kitchenNotes TEXT,
        cancelledAt INTEGER,
        cancellationReason TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    `)

    // 10. Audit Logs Table (using camelCase)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER,
        restaurantId TEXT,
        action TEXT NOT NULL,
        resource TEXT NOT NULL,
        resourceId TEXT,
        description TEXT NOT NULL,
        changes TEXT,
        ipAddress TEXT,
        userAgent TEXT,
        success INTEGER NOT NULL DEFAULT 1,
        errorMessage TEXT,
        executionTimeMs INTEGER,
        createdAt INTEGER NOT NULL
      )
    `)

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
    `)

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
    `)

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
    `)

    console.log('[SharedDataStore] Tables created successfully')
  }

  /**
   * Execute a raw SQL query and return results
   */
  query(sql: string, params: any[] = []): any[] {
    try {
      const stmt = this.db.prepare(sql)
      stmt.bind(params)
      const results: any[] = []
      while (stmt.step()) {
        results.push(stmt.getAsObject())
      }
      stmt.free()
      return results
    } catch (error) {
      console.error('[SharedDataStore] Query error:', error)
      return []
    }
  }

  /**
   * Execute a raw SQL query and return first result
   */
  queryOne(sql: string, params: any[] = []): any | null {
    try {
      const stmt = this.db.prepare(sql)
      stmt.bind(params)
      const hasRow = stmt.step()
      const result = hasRow ? stmt.getAsObject() : null
      stmt.free()
      return result
    } catch (error) {
      console.error('[SharedDataStore] QueryOne error:', error)
      return null
    }
  }

  /**
   * Execute a raw SQL command (INSERT, UPDATE, DELETE)
   */
  run(sql: string, params: any[] = []): { changes: number; lastInsertRowid: number } {
    try {
      const stmt = this.db.prepare(sql)
      stmt.bind(params)
      stmt.step()
      stmt.free()

      // Get last insert rowid and changes
      const changes = this.db.getRowsModified()
      const lastInsertRowid = this.db.exec('SELECT last_insert_rowid() as id')[0]?.values[0][0] as number || 0

      return { changes, lastInsertRowid }
    } catch (error) {
      console.error('[SharedDataStore] Run error:', error)
      throw error
    }
  }

  insert(tableName: string, data: any): any {
    // Add timestamps if not provided
    const now = new Date().toISOString()
    const enrichedData = { ...data }

    // Handle common timestamp fields
    if (!enrichedData.createdAt && !enrichedData.created_at) {
      enrichedData.createdAt = now
      enrichedData.created_at = now
    }
    if (!enrichedData.updatedAt && !enrichedData.updated_at) {
      enrichedData.updatedAt = now
      enrichedData.updated_at = now
    }
    // Handle joined_at for queue table
    if (tableName === 'waiting_queue' && !enrichedData.joined_at) {
      enrichedData.joined_at = now
    }

    const columns = Object.keys(enrichedData).filter(k => enrichedData[k] !== undefined)
    const values = columns.map(k => enrichedData[k])
    const placeholders = columns.map(() => '?').join(', ')

    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`

    try {
      const result = this.run(sql, values)
      console.log(`[SharedDataStore] Inserted into ${tableName}:`, result.lastInsertRowid)

      // Return the inserted data with the ID
      return {
        ...enrichedData,
        id: enrichedData.id || result.lastInsertRowid
      }
    } catch (error) {
      console.error(`[SharedDataStore] Insert error for ${tableName}:`, error)
      throw error
    }
  }

  select(tableName: string, where?: any): any[] {
    let sql = `SELECT * FROM ${tableName}`
    const params: any[] = []

    if (where && Object.keys(where).length > 0) {
      const conditions = Object.entries(where).map(([key, _]) => `${key} = ?`)
      sql += ` WHERE ${conditions.join(' AND ')}`
      params.push(...Object.values(where))
    }

    return this.query(sql, params)
  }

  selectOne(tableName: string, where?: any): any | null {
    const results = this.select(tableName, where)
    return results.length > 0 ? results[0] : null
  }

  update(tableName: string, id: number, data: any): boolean {
    const columns = Object.keys(data).filter(k => data[k] !== undefined)
    const setClause = columns.map(k => `${k} = ?`).join(', ')
    const values = columns.map(k => data[k])

    const sql = `UPDATE ${tableName} SET ${setClause} WHERE id = ?`

    try {
      const result = this.run(sql, [...values, id])
      console.log(`[SharedDataStore] Updated ${tableName} id=${id}, changes=${result.changes}`)
      return result.changes > 0
    } catch (error) {
      console.error(`[SharedDataStore] Update error for ${tableName}:`, error)
      return false
    }
  }

  delete(tableName: string, id: number): boolean {
    const sql = `DELETE FROM ${tableName} WHERE id = ?`

    try {
      const result = this.run(sql, [id])
      console.log(`[SharedDataStore] Deleted from ${tableName} id=${id}, changes=${result.changes}`)
      return result.changes > 0
    } catch (error) {
      console.error(`[SharedDataStore] Delete error for ${tableName}:`, error)
      return false
    }
  }

  clear(tableName?: string) {
    if (tableName) {
      this.run(`DELETE FROM ${tableName}`)
    } else {
      // Clear all tables
      const tables = this.query(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
      tables.forEach((table: any) => {
        this.run(`DELETE FROM ${table.name}`)
      })
    }
  }

  /**
   * Get the underlying SQLite database instance for direct access
   */
  getDB(): SqlJsDatabase {
    return this.db
  }

  /**
   * Close the database connection
   */
  close() {
    this.db.close()
  }
}

// Test database creation - using mock for testing

export interface TestDB {
  prepare: (sql: string) => any
  exec: (sql: string) => any
  close: () => Promise<void>
  dataStore?: SharedDataStore  // Add dataStore to share between createTestDB and createTestApp
  [key: string]: any
}

export async function createTestDB(): Promise<TestDB> {
  // Create shared data store
  const dataStore = await SharedDataStore.create()

  // Create D1-compatible mock that uses the shared store
  const db = createSharedMockDB(dataStore)

  // Attach dataStore for sharing with createTestApp
  db.dataStore = dataStore

  // Run migrations to create all necessary tables
  await runMigrations(db)

  return db
}

// Global test database instance (shared across all tests)
let globalTestDB: any = null
let globalDataStore: SharedDataStore | null = null

/**
 * Get or create the global test database
 */
export async function getGlobalTestDB() {
  if (!globalTestDB) {
    globalDataStore = await SharedDataStore.create()
    globalTestDB = createSharedMockDB(globalDataStore)
  }
  return globalTestDB
}

/**
 * Creates a complete test application with all routes registered
 * This ensures integration tests don't get 404 errors
 */
export async function createTestApp(customDB?: any) {
  const app = new Hono<{ Bindings: Env }>()

  // Reuse dataStore from customDB if available, otherwise create new one
  let dataStore: SharedDataStore
  let mockDB: any

  if (customDB && customDB.dataStore) {
    // Reuse the existing dataStore from customDB
    dataStore = customDB.dataStore
    mockDB = customDB
    console.log('[createTestApp] Reusing existing dataStore from customDB')
  } else {
    // Create new dataStore
    dataStore = await SharedDataStore.create()
    mockDB = createSharedMockDB(dataStore)
    console.log('[createTestApp] Created new dataStore')
  }

  console.log('[createTestApp] Using DB instance:', !!mockDB)
  console.log('[createTestApp] DB has prepare:', typeof mockDB?.prepare)

  // Create inline mock Drizzle instance with SAME data store
  const mockDrizzle = createInlineMockDrizzle(dataStore)
  console.log('[createTestApp] Created inline mock Drizzle with shared dataStore')

  // Create mock environment
  const mockEnv: Partial<Env> = {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-jwt-secret-for-testing-only',
    API_VERSION: 'v1',
    DB: customDB || mockDB,
    MOCK_DRIZZLE_DB: mockDrizzle, // Inject inline mock Drizzle
    CACHE_KV: {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined), // Alias for put (some services use set instead)
      delete: vi.fn().mockResolvedValue(true),
      list: vi.fn().mockResolvedValue({ keys: [] })
    } as any,
    ANALYTICS_ENGINE: {
      writeDataPoint: vi.fn()
    } as any,
    API_BASE_URL: 'http://localhost:8787'
  }

  // Set environment on context
  app.use('*', async (c, next) => {
    // Initialize c.env if it doesn't exist
    if (!c.env) {
      (c as any).env = {}
    }
    // Inject mock env
    Object.assign(c.env, mockEnv)

    // Mock ExecutionContext for Cloudflare Workers API
    // This allows c.executionCtx.waitUntil() to work in tests
    try {
      // Try to access executionCtx - if it doesn't exist, it will throw
      const _ = c.executionCtx
    } catch (e) {
      // ExecutionContext doesn't exist, so we need to mock it
      Object.defineProperty(c, 'executionCtx', {
        get() {
          return {
            waitUntil: vi.fn((promise: Promise<any>) => {
              // In tests, we don't actually wait for background tasks
              // Just capture the promise for potential verification
              promise.catch((err) => {
                console.warn('[Test ExecutionContext] Background task failed:', err.message)
              })
            }),
            passThroughOnException: vi.fn()
          }
        },
        configurable: true
      })
    }

    await next()
  })

  // No auth bypass middleware - tests must provide valid JWT tokens
  // This ensures we test the real authentication flow

  // Create API v1 router
  const apiV1 = new Hono<{ Bindings: Env }>()

  // Add request logging middleware to apiV1
  apiV1.use('*', async (c, next) => {
    console.log(`[API_V1] ${c.req.method} ${c.req.path}`)
    await next()
    console.log(`[API_V1] Response status: ${c.res.status}`)
  })

  // Register all feature routes (matching production structure)
  console.log('[createTestApp] Registering routes...')
  console.log('[createTestApp] - tablesFeature type:', typeof tablesFeature)
  console.log('[createTestApp] - tablesFeature keys:', Object.keys(tablesFeature))
  console.log('[createTestApp] - tablesFeature.routes type:', typeof tablesFeature.routes)
  console.log('[createTestApp] - tablesFeature.routes is Hono?:', tablesFeature.routes?.constructor?.name)
  console.log('[createTestApp] - usersFeature.routes type:', typeof usersFeature.routes)
  console.log('[createTestApp] - usersFeature.routes is Hono?:', usersFeature.routes?.constructor?.name)

  apiV1.route('/auth', authFeature.routes)
  apiV1.route('/restaurants', restaurantsFeature.routes)
  apiV1.route('/menu', menuFeature.routes)
  apiV1.route('/kitchen', kitchenFeature.routes)
  apiV1.route('/orders', ordersFeature.routes)
  apiV1.route('/orders/group', groupOrdersFeature.routes)
  apiV1.route('/pos', posFeature.routes)
  apiV1.route('/queue', queueFeature.routes)

  console.log('[createTestApp] Registering /tables route')
  apiV1.route('/tables', tablesFeature.routes)

  console.log('[createTestApp] Registering /users route')
  apiV1.route('/users', usersFeature.routes)

  apiV1.route('/analytics', analyticsFeature.routes)
  apiV1.route('/qr', qrCodesFeature.routes)
  apiV1.route('/coupons', couponsFeature.routes)

  console.log('[createTestApp] All routes registered')

  // Mount API v1 routes
  console.log('[createTestApp] Mounting /api/v1')
  app.route('/api/v1', apiV1)

  // Add 404 handler for debugging
  app.notFound((c) => {
    console.error(`[TEST] 404 Not Found: ${c.req.method} ${c.req.path}`)
    return c.json({
      success: false,
      error: 'Endpoint not found in test app',
      path: c.req.path,
      method: c.req.method
    }, 404)
  })

  return app
}

export async function cleanupTestDB(db: TestDB) {
  if (db && typeof db.close === 'function') {
    await db.close()
  }
}

/**
 * Create a D1-compatible mock database that uses SharedDataStore with real SQLite
 */
function createSharedMockDB(dataStore: SharedDataStore) {
  return {
    prepare: (sql: string) => {
      let boundParams: any[] = []

      return {
        bind: (...params: any[]) => {
          boundParams = params
          return {
            run: async () => {
              try {
                const result = dataStore.run(sql, boundParams)
                console.log(`[SharedMockDB] RUN executed:`, {
                  sql: sql.substring(0, 100),
                  changes: result.changes,
                  lastInsertRowid: result.lastInsertRowid
                })
                return {
                  success: true,
                  meta: {
                    changes: result.changes,
                    last_row_id: result.lastInsertRowid
                  }
                }
              } catch (error) {
                console.error('[SharedMockDB] RUN error:', error)
                return {
                  success: false,
                  error: error instanceof Error ? error.message : 'Unknown error'
                }
              }
            },
            first: async () => {
              try {
                const result = dataStore.queryOne(sql, boundParams)
                console.log(`[SharedMockDB] FIRST executed:`, {
                  sql: sql.substring(0, 100),
                  hasResult: !!result
                })
                return result
              } catch (error) {
                console.error('[SharedMockDB] FIRST error:', error)
                return null
              }
            },
            all: async () => {
              try {
                const results = dataStore.query(sql, boundParams)
                console.log(`[SharedMockDB] ALL executed:`, {
                  sql: sql.substring(0, 100),
                  count: results.length
                })
                return {
                  results,
                  success: true
                }
              } catch (error) {
                console.error('[SharedMockDB] ALL error:', error)
                return {
                  results: [],
                  success: false,
                  error: error instanceof Error ? error.message : 'Unknown error'
                }
              }
            }
          }
        },
        run: async () => {
          try {
            const result = dataStore.run(sql, [])
            return {
              success: true,
              meta: {
                changes: result.changes,
                last_row_id: result.lastInsertRowid
              }
            }
          } catch (error) {
            console.error('[SharedMockDB] RUN (no bind) error:', error)
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        },
        first: async () => {
          try {
            return dataStore.queryOne(sql, [])
          } catch (error) {
            console.error('[SharedMockDB] FIRST (no bind) error:', error)
            return null
          }
        },
        all: async () => {
          try {
            const results = dataStore.query(sql, [])
            return {
              results,
              success: true
            }
          } catch (error) {
            console.error('[SharedMockDB] ALL (no bind) error:', error)
            return {
              results: [],
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }
        }
      }
    },
    exec: async (sql: string) => {
      try {
        // For exec, we use the underlying SQLite's exec which can handle multiple statements
        const db = dataStore.getDB()
        db.exec(sql)
        console.log('[SharedMockDB] EXEC executed successfully')
        return { count: 0, duration: 0, results: [] }
      } catch (error) {
        console.error('[SharedMockDB] EXEC error:', error)
        throw error
      }
    },
    close: async () => {
      try {
        dataStore.close()
        console.log('[SharedMockDB] Database closed')
      } catch (error) {
        console.error('[SharedMockDB] Close error:', error)
      }
    }
  }
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
  `)

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
  `)

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
  `)

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
  `)

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
  `)

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
  `)

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
  `)

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
  `)

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
  `)

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
  `)

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
  `)

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_waiting_queue_restaurant_status
    ON waiting_queue(restaurant_id, status)
  `)

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_waiting_queue_joined_at
    ON waiting_queue(joined_at)
  `)

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_queue_events_restaurant_queue
    ON queue_events(restaurant_id, queue_id)
  `)
}

export function createMockQueueData() {
  return {
    validJoinRequest: {
      restaurantId: 1,
      customerName: '測試顧客',
      customerPhone: '012-3456789',
      customerEmail: 'test@example.com',
      partySize: 4,
      specialRequests: '需要兒童座椅',
      queueType: 'online' as const,
      tablePreferences: [1, 2],
      notificationMethods: ['sms']
    },

    invalidJoinRequest: {
      restaurantId: 'invalid',
      customerName: '',
      partySize: 0
    },

    validCallRequest: {
      restaurantId: 1,
      tableId: 5
    },

    invalidCallRequest: {
      restaurantId: 'invalid'
    },

    sampleQueueItem: {
      id: 'queue_001',
      restaurantId: 1,
      queueNumber: 1,
      customerName: '張先生',
      customerPhone: '012-3456789',
      customerEmail: 'zhang@example.com',
      partySize: 4,
      specialRequests: '需要兒童座椅',
      priority: 1,
      queueType: 'online',
      status: 'waiting',
      joinedAt: new Date(Date.now() - 1800000).toISOString(),
      estimatedWaitMinutes: 20,
      tablePreferences: [1, 2],
      notificationMethods: ['sms'],
      checkInCode: 'ABC123',
      metadata: {}
    },

    sampleSettings: {
      restaurantId: 1,
      isEnabled: true,
      maxQueueSize: 50,
      avgServiceTime: 45,
      maxWaitTime: 120,
      minAdvanceNotice: 5,
      notificationMethods: ['sms'],
      autoCallEnabled: true,
      autoCallInterval: 10,
      noShowTimeout: 15,
      queueNumberReset: 'daily' as const,
      priorityRules: {},
      tableAssignmentRules: {},
      notificationTemplates: {},
      businessHours: {},
      holidaySettings: {},
      displaySettings: {},
      integrationSettings: {},
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }
}

export async function seedTestData(db: TestDB) {
  const mockData = createMockQueueData()

  // Insert test queue settings
  await db.prepare(`
    INSERT INTO queue_settings (
      restaurant_id, is_enabled, max_queue_size, avg_service_time,
      max_wait_time, min_advance_notice, notification_methods,
      auto_call_enabled, auto_call_interval, no_show_timeout,
      queue_number_reset, priority_rules, table_assignment_rules,
      notification_templates, business_hours, holiday_settings,
      display_settings, integration_settings
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
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
    JSON.stringify(mockData.sampleSettings.integrationSettings)
  ).run()

  // Insert test queue item
  const queueItem = mockData.sampleQueueItem
  await db.prepare(`
    INSERT INTO waiting_queue (
      id, restaurant_id, queue_number, customer_name, customer_phone,
      customer_email, party_size, special_requests, priority, queue_type,
      estimated_wait_minutes, table_preferences, status, notification_methods,
      check_in_code, joined_at, metadata
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
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
    JSON.stringify(queueItem.metadata)
  ).run()
}

// Helper function to wait for async operations
export function waitFor(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Helper function to generate test IDs
export function generateTestId(prefix: string = 'test') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Create inline mock Drizzle instance
 * This mocks Drizzle ORM using the shared data store
 */
function createInlineMockDrizzle(dataStore: SharedDataStore) {

  const getTableName = (table: any): string => {
    if (table?.[Symbol.for('drizzle:Name')]) return table[Symbol.for('drizzle:Name')]
    if (table?.toString().includes('restaurants')) return 'restaurants'
    if (table?.toString().includes('categories')) return 'categories'
    if (table?.toString().includes('menu_items')) return 'menu_items'
    if (table?.toString().includes('tables')) return 'tables'
    if (table?.toString().includes('users')) return 'users'
    if (table?.toString().includes('orders')) return 'orders'
    return 'unknown'
  }

  return {
    insert: (table: any) => {
      const tableName = getTableName(table)
      console.log('[MockDrizzle] insert() for table:', tableName)

      return {
        values: (data: any) => {
          console.log('[MockDrizzle] values():', data)

          return {
            returning: () => {
              console.log('[MockDrizzle] returning() called')

              const now = new Date().toISOString()
              if (!data.createdAt) data.createdAt = now
              if (!data.updatedAt) data.updatedAt = now

              // Insert into shared data store
              const inserted = dataStore.insert(tableName, data)
              console.log('[MockDrizzle] Stored record ID:', inserted.id)

              const result = [{ ...inserted }]
              console.log('[MockDrizzle] Returning:', result)
              return Promise.resolve(result)
            }
          }
        }
      }
    },

    select: (fields?: any) => ({
      from: (table: any) => {
        const tableName = getTableName(table)

        // Check if this is an aggregate query (contains sum, count, avg, etc)
        // Drizzle aggregate functions have queryChunks property
        const isAggregateQuery = fields && typeof fields === 'object' &&
          Object.values(fields).some((field: any) =>
            field && typeof field === 'object' &&
            (field.queryChunks || field.sql || field._sqlChunks || field.name?.includes('sum') || field.name?.includes('count'))
          )

        // Create a promise-like object that can be awaited directly or .execute() can be called
        const createAwaitableQuery = (getData: () => any[]) => {
          const query: any = {
            execute: async () => {
              const data = getData()

              // For aggregate queries, always return at least one row with default values
              if (isAggregateQuery && data.length === 0) {
                const defaultRow: any = {}
                if (fields && typeof fields === 'object') {
                  Object.keys(fields).forEach(key => {
                    // For count, default to 0; for sum/avg, default to null
                    defaultRow[key] = key.toLowerCase().includes('count') ? 0 : null
                  })
                }
                return [defaultRow]
              }

              return data
            },
            then: (resolve: any, reject: any) => {
              // Make the query thenable so it can be directly awaited
              try {
                const data = getData()

                // For aggregate queries, always return at least one row with default values
                let result = data
                if (isAggregateQuery && data.length === 0) {
                  const defaultRow: any = {}
                  if (fields && typeof fields === 'object') {
                    Object.keys(fields).forEach(key => {
                      defaultRow[key] = key.toLowerCase().includes('count') ? 0 : null
                    })
                  }
                  result = [defaultRow]
                }

                return Promise.resolve(result).then(resolve, reject)
              } catch (error) {
                return Promise.reject(error).then(resolve, reject)
              }
            }
          }
          return query
        }

        // Create chainable query methods
        const createQueryChain = () => {
          const getData = () => {
            return dataStore.select(tableName)
          }

          return {
            where: (condition: any) => {
              const query = createAwaitableQuery(getData)

              // Add .get() method for single record queries
              query.get = async () => {
                const allData = dataStore.select(tableName)
                console.log('[MockDrizzle] where().get() - tableName:', tableName, 'records:', allData?.length || 0)
                if (!allData || allData.length === 0) return null

                // Implement WHERE filtering for eq() conditions
                // Drizzle's eq(column, value) creates an object with column and value properties
                if (condition && typeof condition === 'object') {
                  console.log('[MockDrizzle] Condition type:', condition.constructor?.name)
                  console.log('[MockDrizzle] Condition keys:', Object.keys(condition))

                  // Try to extract filter from Drizzle eq() condition
                  // eq() structure: { sql: {queryChunks: [column, ' = ', value]}, ...}
                  // For simple ID queries, try to detect the pattern

                  // Strategy 1: Check if condition has sql.queryChunks (Drizzle format)
                  if (condition.sql?.queryChunks && Array.isArray(condition.sql.queryChunks)) {
                    const chunks = condition.sql.queryChunks
                    // Look for pattern: [column, ' = ', value]
                    for (let i = 0; i < chunks.length; i++) {
                      if (typeof chunks[i] === 'string' && chunks[i].includes('=')) {
                        // Found equals operator, value should be after it
                        const value = chunks[i + 1]
                        // Try to match by 'id' field (most common case)
                        if (typeof value === 'number') {
                          const found = allData.find((item: any) => item.id === value)
                          if (found) return found
                        }
                      }
                    }
                  }

                  // Strategy 2: Check if this is a wrapper with nested condition
                  if (condition.value !== undefined) {
                    // Direct value comparison for simple eq(column, value)
                    const value = condition.value
                    if (typeof value === 'number') {
                      const found = allData.find((item: any) => item.id === value)
                      if (found) return found
                    }
                  }

                  // Fallback: return first record
                  console.warn('[MockDrizzle] where().get() - Could not parse condition, returning first record')
                  return allData[0] || null
                }
                return null
              }

              // Add chainable methods to where() result
              query.orderBy = (...args: any[]) => {
                return {
                  limit: (limitValue: number) => createAwaitableQuery(() => {
                    const allData = getData()
                    return allData.slice(0, limitValue)
                  }),
                  ...createAwaitableQuery(getData)
                }
              }

              query.limit = (limitValue: number) => {
                const limitedData = () => {
                  const allData = getData()
                  return allData.slice(0, limitValue)
                }
                return createAwaitableQuery(limitedData)
              }

              query.groupBy = (...args: any[]) => {
                // For aggregate queries with groupBy, return chainable query
                const groupByQuery = createAwaitableQuery(getData)

                // Add orderBy and limit after groupBy
                groupByQuery.orderBy = (...orderArgs: any[]) => {
                  return {
                    limit: (limitValue: number) => createAwaitableQuery(() => {
                      const allData = getData()
                      return allData.slice(0, limitValue)
                    }),
                    ...createAwaitableQuery(getData)
                  }
                }

                groupByQuery.limit = (limitValue: number) => {
                  const limitedData = () => {
                    const allData = getData()
                    return allData.slice(0, limitValue)
                  }
                  return createAwaitableQuery(limitedData)
                }

                return groupByQuery
              }

              return query
            },
            leftJoin: (joinTable: any, condition: any) => {
              // For mock, simply return chainable query without actually joining
              return createQueryChain()
            },
            innerJoin: (joinTable: any, condition: any) => {
              // For mock, simply return chainable query without actually joining
              return createQueryChain()
            },
            limit: (limitValue: number) => {
              const limitedData = () => {
                const allData = getData()
                return allData.slice(0, limitValue)
              }
              return createAwaitableQuery(limitedData)
            },
            orderBy: (...args: any[]) => {
              return {
                limit: (limitValue: number) => createAwaitableQuery(() => {
                  const allData = getData()
                  return allData.slice(0, limitValue)
                }),
                ...createAwaitableQuery(getData)
              }
            },
            ...createAwaitableQuery(getData)
          }
        }

        return createQueryChain()
      }
    }),

    update: (table: any) => ({
      set: (data: any) => ({
        where: (condition: any) => {
          const tableName = getTableName(table)

          // Create update executor function
          const executeUpdate = async () => {
            const tableData = tables.get(tableName)
            if (!tableData) return []

            const records = Array.from(tableData.values())

            // For now, update all records (WHERE filtering not implemented)
            // TODO: Implement actual WHERE condition filtering
            const updatedRecords: any[] = []

            for (const record of records) {
              // Process data to handle sql`` template literals for increments
              const processedData: any = { updatedAt: new Date().toISOString() }

              for (const [key, value] of Object.entries(data)) {
                // Check if value is an SQL increment expression (has queryChunks or sql property)
                if (value && typeof value === 'object' && (value.queryChunks || value.sql)) {
                  // For increment operations like sql`${field} + 1`, just increment by 1
                  // This is a simplified mock - doesn't parse the actual SQL
                  const currentValue = record[key] || 0
                  processedData[key] = currentValue + 1
                } else {
                  processedData[key] = value
                }
              }

              const updated = { ...record, ...processedData }
              tableData.set(updated.id, updated)
              updatedRecords.push(updated)
            }

            return updatedRecords
          }

          // Return object that supports both direct await AND .returning()
          const updateQuery: any = {
            then: (resolve: any, reject: any) => {
              // Make the query thenable so it can be directly awaited
              return executeUpdate().then(resolve, reject)
            },
            returning: async () => {
              return executeUpdate()
            }
          }

          return updateQuery
        }
      })
    }),

    query: new Proxy({}, {
      get: (target, tableName: string) => {
        // Normalize table name: convert camelCase to snake_case
        // menuItems -> menu_items, orderItems -> order_items
        const normalizedTableName = tableName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
        console.log('[MockDrizzle] Normalized table name:', tableName, '->', normalizedTableName)

        return {
        findFirst: async (options: any) => {
          console.log('[MockDrizzle] query.findFirst() called for table:', tableName)
          try {
            // Use dataStore to query the table
            const records = dataStore.query(`SELECT * FROM ${normalizedTableName}`)
            console.log('[MockDrizzle] Table', tableName, 'has', records.length, 'records')
            if (records.length > 0) {
              console.log('[MockDrizzle] First record:', JSON.stringify(records[0]))
              return records[0]
            }
            console.log('[MockDrizzle] No records found in table:', tableName)
            return null
          } catch (error) {
            console.error('[MockDrizzle] Error querying table:', tableName, error)
            return null
          }
        },
        findMany: async (options: any) => {
          console.log('[MockDrizzle] query.findMany() called for table:', tableName)
          try {
            const results = dataStore.query(`SELECT * FROM ${normalizedTableName}`)
            console.log('[MockDrizzle] findMany() returning', results.length, 'records')
            if (results.length > 0) {
              console.log('[MockDrizzle] First record:', JSON.stringify(results[0]))
            }
            return results
          } catch (error) {
            console.error('[MockDrizzle] Error querying table:', tableName, error)
            return []
          }
        }
      }  // Close return object
      }  // Close get trap
    })
  }
}

/**
 * Generate a valid JWT token for testing
 * Matches the payload format used in packages/database/src/services/auth.ts
 */
export function generateTestToken(payload?: {
  id?: number
  username?: string
  role?: number
  restaurantId?: number | null
}): string {
  const defaultPayload = {
    id: 1,
    username: 'testuser',
    role: 0, // Admin role
    restaurantId: 1
  }

  const tokenPayload = { ...defaultPayload, ...payload }

  // Use the same JWT_SECRET as in mockEnv
  const jwtSecret = 'test-jwt-secret-for-testing-only'

  return sign(tokenPayload, jwtSecret, { expiresIn: '24h' })
}

// Create mock database using pure JavaScript mock (no better-sqlite3 required)
async function createMockSQLiteDatabase(filename: string) {
  // Use pure JavaScript mock to avoid better-sqlite3 compilation issues on Windows
  const { createDrizzleTestDB } = await import('./drizzle-test-db')

  // Create a D1-compatible mock database that Drizzle can use
  const d1Mock = createDrizzleTestDB()

  // Add close method (no-op for mock)
  return {
    ...d1Mock,
    close: async () => {}
  }
}