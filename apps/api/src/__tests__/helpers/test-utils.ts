/**
 * Test Utilities for Queue Module Testing
 */

import { Hono } from 'hono'
import type { AuthUser } from '../../middleware/auth'
// Test database creation - using mock for testing

export interface TestDB {
  prepare: (sql: string) => any
  exec: (sql: string) => any
  close: () => Promise<void>
  [key: string]: any
}

export async function createTestDB(): Promise<TestDB> {
  // Create in-memory mock database for testing
  const db = await createMockSQLiteDatabase(':memory:')

  // Run migrations to set up schema
  await runMigrations(db)

  return db
}

export function createTestApp() {
  const app = new Hono()

  // Mock middleware and routes for testing
  app.use('*', async (c, next) => {
    // Mock auth middleware with AuthUser type
    c.set('user', {
      id: 1,
      username: 'testuser',
      fullName: 'Test User',
      role: 1, // Owner
      restaurantId: 1,
      isActive: true,
      isVerified: true,
      twoFactorEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date()
    } as AuthUser)
    await next()
  })

  return app
}

export async function cleanupTestDB(db: TestDB) {
  if (db && typeof db.close === 'function') {
    await db.close()
  }
}

async function runMigrations(db: TestDB) {
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

// Mock createSQLiteDatabase function
async function createMockSQLiteDatabase(filename: string) {
  // Mock implementation for testing
  // In a real implementation, this would create an actual SQLite database
  return {
    prepare: (sql: string) => ({
      bind: (...params: any[]) => ({
        run: async () => ({ changes: 1, lastInsertRowid: 1 }),
        first: async () => ({}),
        all: async () => ({ results: [] })
      }),
      run: async () => ({ changes: 1, lastInsertRowid: 1 }),
      first: async () => ({}),
      all: async () => ({ results: [] })
    }),
    exec: async (sql: string) => {},
    close: async () => {}
  }
}