/**
 * Mock Drizzle Test Database Helper
 *
 * Pure JavaScript mock that doesn't require better-sqlite3
 * This allows tests to run on Windows without C++ build tools
 */

import { vi } from 'vitest'

/**
 * Create a mock test database that doesn't require better-sqlite3
 * This is a pure JavaScript implementation for environments without C++ compilers
 */
export function createDrizzleTestDB() {
  // Create in-memory data store
  const mockData: Record<string, any[]> = {}

  // Mock SQLite interface
  const mockSqlite = {
    prepare: (sql: string) => {
      const lowerSql = sql.toLowerCase().trim()

      return {
        run: (...params: any[]) => {
          console.log('[Mock SQLite] Running:', sql.substring(0, 80) + '...')

          // Handle INSERT
          if (lowerSql.startsWith('insert into')) {
            const match = sql.match(/insert into (\w+)/i)
            if (match) {
              const tableName = match[1]
              if (!mockData[tableName]) mockData[tableName] = []

              const newRow = { id: mockData[tableName].length + 1 }
              mockData[tableName].push(newRow)

              return {
                changes: 1,
                lastInsertRowid: newRow.id
              }
            }
          }

          return { changes: 0, lastInsertRowid: 0 }
        },
        get: (...params: any[]) => null,
        all: (...params: any[]) => [],
        raw: (mode: boolean) => ({
          all: (...params: any[]) => []
        })
      }
    },
    exec: (sql: string) => {
      console.log('[Mock SQLite] Executing:', sql.substring(0, 80) + '...')
      // No-op for schema creation in mock
    },
    close: () => {
      console.log('[Mock SQLite] Closed')
    }
  }

  return {
    db: null as any, // Drizzle instance not needed for basic tests
    sqlite: mockSqlite as any,
    close: () => mockSqlite.close()
  }
}

/**
 * Create a D1-compatible wrapper around mock database
 */
export function createD1CompatibleDB(sqlite: any) {
  return {
    prepare: (sql: string) => {
      const stmt = sqlite.prepare(sql)
      return {
        bind: (...params: any[]) => ({
          run: async () => {
            const info = stmt.run(...params)
            return {
              success: true,
              meta: {
                changes: info.changes || 0,
                last_row_id: info.lastInsertRowid || 0,
                duration: 0.1
              }
            }
          },
          first: async () => stmt.get(...params) || null,
          all: async () => {
            const results = stmt.all(...params)
            return {
              success: true,
              results,
              meta: { duration: 0.1 }
            }
          },
          raw: async () => {
            const raw = stmt.raw(true)
            return raw.all(...params)
          }
        }),
        run: async () => {
          const info = stmt.run()
          return {
            success: true,
            meta: {
              changes: info.changes || 0,
              last_row_id: info.lastInsertRowid || 0,
              duration: 0.1
            }
          }
        },
        first: async () => stmt.get() || null,
        all: async () => {
          const results = stmt.all()
          return {
            success: true,
            results,
            meta: { duration: 0.1 }
          }
        },
        raw: async () => {
          const raw = stmt.raw(true)
          return raw.all()
        }
      }
    },
    exec: async (sql: string) => {
      sqlite.exec(sql)
      return {
        count: 0,
        duration: 0.1,
        results: []
      }
    },
    batch: async (statements: any[]) => {
      const results = []
      for (const stmt of statements) {
        const info = sqlite.prepare(stmt.sql).run(...(stmt.params || []))
        results.push({
          success: true,
          results: [],
          meta: {
            changes: info.changes || 0,
            last_row_id: info.lastInsertRowid || 0,
            duration: 0.1
          }
        })
      }
      return results
    },
    dump: async () => new ArrayBuffer(0)
  }
}
