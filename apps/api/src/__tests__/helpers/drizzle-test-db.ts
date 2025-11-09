/**
 * Drizzle Test Database Helper
 *
 * Provides a D1-compatible mock database that works with Drizzle ORM
 * This avoids native module compilation issues with better-sqlite3
 */

// In-memory data store for mock database
const tables = new Map<string, Map<number, any>>()
let autoIncrementCounters = new Map<string, number>()

/**
 * Reset all test data
 */
function resetTestData() {
  tables.clear()
  autoIncrementCounters.clear()

  // Initialize tables
  const tableNames = [
    'restaurants', 'categories', 'menu_items', 'tables', 'users',
    'orders', 'order_items', 'queue_settings', 'sessions', 'audit_logs',
    'waiting_queue', 'queue_events', 'queue_notifications'
  ]

  tableNames.forEach(name => {
    tables.set(name, new Map())
    autoIncrementCounters.set(name, 0)
  })
}

/**
 * Get next auto-increment ID for a table
 */
function getNextId(tableName: string): number {
  const current = autoIncrementCounters.get(tableName) || 0
  const next = current + 1
  autoIncrementCounters.set(tableName, next)
  return next
}

/**
 * Extract table name from SQL query
 */
function extractTableName(sql: string): string {
  // Match INSERT INTO "table_name" or INSERT INTO table_name
  const insertMatch = sql.match(/INSERT INTO ["'`]?(\w+)["'`]?/i)
  if (insertMatch) return insertMatch[1]

  // Match SELECT FROM "table_name" or SELECT FROM table_name
  const selectMatch = sql.match(/(?:FROM|JOIN)\s+["'`]?(\w+)["'`]?/i)
  if (selectMatch) return selectMatch[1]

  // Match UPDATE "table_name" or UPDATE table_name
  const updateMatch = sql.match(/UPDATE\s+["'`]?(\w+)["'`]?/i)
  if (updateMatch) return updateMatch[1]

  // Match DELETE FROM "table_name" or DELETE FROM table_name
  const deleteMatch = sql.match(/DELETE\s+FROM\s+["'`]?(\w+)["'`]?/i)
  if (deleteMatch) return deleteMatch[1]

  return 'unknown'
}

/**
 * Parse VALUES clause from INSERT statement
 */
function parseInsertValues(sql: string, params: any[]): any {
  const result: any = {}

  // Extract column names from SQL
  const columnsMatch = sql.match(/\(([\w,\s"'`]+)\)\s*VALUES/i)
  if (!columnsMatch) {
    console.log('[parseInsertValues] No columns match found in SQL')
    return result
  }

  const columns = columnsMatch[1]
    .split(',')
    .map(col => col.trim().replace(/["'`]/g, ''))

  console.log('[parseInsertValues] Parsed columns:', JSON.stringify(columns))
  console.log('[parseInsertValues] Params count:', params.length, 'values:', JSON.stringify(params))

  // Map params to columns, filtering out undefined values
  columns.forEach((col, index) => {
    if (index < params.length) {
      const value = params[index]
      // Convert undefined to null to avoid JSON parse errors
      result[col] = value === undefined ? null : value
    }
  })

  console.log('[parseInsertValues] Result keys:', Object.keys(result))
  return result
}

/**
 * Create a D1-compatible database that Drizzle can use
 */
export function createDrizzleTestDB() {
  resetTestData()

  return {
    prepare: (sql: string) => {
      console.log('[MockDB] Prepare SQL:', sql.substring(0, 200))
      const tableName = extractTableName(sql)
      const isInsert = /INSERT\s+INTO/i.test(sql)
      const isSelect = /SELECT/i.test(sql)
      const isUpdate = /UPDATE/i.test(sql)
      const isDelete = /DELETE/i.test(sql)
      const isReturning = /RETURNING/i.test(sql)
      console.log('[MockDB] Flags:', { tableName, isInsert, isReturning })

      return {
        bind: (...params: any[]) => {
          console.log('[MockDB] bind() called with', params.length, 'params')
          console.log('[MockDB] bind() call stack:', new Error().stack?.split('\n').slice(2, 5).join('\n'))
          const boundStatement = {
            run: async () => {
              console.log('[MockDB] bind().run() called for INSERT:', isInsert, 'RETURNING:', isReturning)
            let lastInsertedId = 0

            if (isInsert) {
              const values = parseInsertValues(sql, params)
              console.log('[MockDB] Parsed INSERT values:', JSON.stringify(values))

              // Generate ID if not provided
              if (!values.id) {
                values.id = getNextId(tableName)
              }
              lastInsertedId = values.id

              // Add timestamps if not provided
              const now = new Date().toISOString()
              if (!values.createdAt) values.createdAt = now
              if (!values.updatedAt) values.updatedAt = now

              // Store the record
              const tableData = tables.get(tableName)
              if (tableData) {
                tableData.set(values.id, { ...values })
                console.log('[MockDB] Inserted into', tableName, '- Total rows:', tableData.size)
              } else {
                console.log('[MockDB] ERROR: Table not found:', tableName)
              }

              // For INSERT...RETURNING, Drizzle expects results in the response
              if (isReturning) {
                console.log('[MockDB] Returning inserted row:', values)
                return {
                  success: true,
                  results: [{ ...values }],  // Return the inserted row
                  meta: {
                    changes: 1,
                    last_row_id: lastInsertedId,
                    duration: 0.1
                  }
                }
              }
            }

            return {
              success: true,
              meta: {
                changes: 1,
                last_row_id: lastInsertedId,
                duration: 0.1
              }
            }
          },

          first: async () => {
            const tableData = tables.get(tableName)
            if (!tableData || tableData.size === 0) return null

            const records = Array.from(tableData.values())
            return records[0] || null
          },

          all: async () => {
            console.log('[MockDB] bind().all() called for', { isInsert, isReturning, isSelect })
            // For RETURNING queries
            if (isInsert && isReturning) {
              const values = parseInsertValues(sql, params)

              if (!values.id) {
                values.id = getNextId(tableName)
              }

              const now = new Date().toISOString()
              if (!values.createdAt) values.createdAt = now
              if (!values.updatedAt) values.updatedAt = now

              const tableData = tables.get(tableName)
              if (tableData) {
                tableData.set(values.id, { ...values })
              }

              return {
                success: true,
                results: [{ ...values }],
                meta: { duration: 0.1 }
              }
            }

            // For SELECT queries with aggregates (COUNT, SUM, etc)
            if (isSelect && (sql.includes('count(') || sql.includes('sum('))) {
              const tableData = tables.get(tableName)

              // For COUNT queries, always return at least one row with count
              if (sql.includes('count(')) {
                const count = tableData ? tableData.size : 0
                console.log('[MockDB] Returning COUNT result:', count)
                return {
                  success: true,
                  results: [{ itemCount: count }],
                  meta: { duration: 0.1 }
                }
              }

              // For SUM queries, return 0 or null if no data
              if (sql.includes('sum(')) {
                if (!tableData || tableData.size === 0) {
                  return {
                    success: true,
                    results: [{ revenue: null, orderCount: 0 }],
                    meta: { duration: 0.1 }
                  }
                }
              }
            }

            // For regular SELECT queries
            const tableData = tables.get(tableName)
            if (!tableData) {
              return {
                success: true,
                results: [],
                meta: { duration: 0.1 }
              }
            }

            return {
              success: true,
              results: Array.from(tableData.values()),
              meta: { duration: 0.1 }
            }
          },

          raw: async () => {
            console.log('[MockDB] bind().raw() called for', { isInsert, isReturning, isSelect })

            // For INSERT...RETURNING queries
            if (isInsert && isReturning) {
              const values = parseInsertValues(sql, params)

              if (!values.id) {
                values.id = getNextId(tableName)
              }

              const now = new Date().toISOString()
              if (!values.createdAt) values.createdAt = now
              if (!values.updatedAt) values.updatedAt = now

              const tableData = tables.get(tableName)
              if (tableData) {
                tableData.set(values.id, { ...values })
              }

              console.log('[MockDB] raw() returning inserted row:', values)
              // raw() returns array of arrays (rows)
              return [[values]]
            }

            // For SELECT queries
            const tableData = tables.get(tableName)
            if (!tableData || tableData.size === 0) {
              // Return empty row for aggregate queries (SUM, COUNT, etc)
              // This prevents destructuring errors when no data exists
              if (isSelect && (sql.includes('sum(') || sql.includes('count('))) {
                console.log('[MockDB] Returning empty aggregate result')
                return [[{ revenue: null, orderCount: 0 }]]
              }
              return []
            }
            return Array.from(tableData.values()).map(row => Object.values(row))
          }
        }

        // Return a Proxy to catch any unexpected method calls
        return new Proxy(boundStatement, {
          get(target: any, prop: string) {
            console.log(`[MockDB] Accessing property on bound statement: ${String(prop)}`)
            if (prop in target) {
              return target[prop]
            }
            console.log(`[MockDB] WARNING: Unexpected property/method: ${String(prop)}`)
            return async () => {
              console.log(`[MockDB] Executing unexpected method: ${String(prop)}`)
              return { success: true, results: [], meta: { duration: 0.1 } }
            }
          }
        })
      },

        run: async () => {
          // Handle DELETE queries
          if (/DELETE\s+FROM/i.test(sql)) {
            const tableData = tables.get(tableName)
            if (tableData) {
              const rowCount = tableData.size
              tableData.clear()
              // Reset auto-increment counter for this table
              autoIncrementCounters.set(tableName, 0)
              return {
                success: true,
                meta: {
                  changes: rowCount,
                  last_row_id: 0,
                  duration: 0.1
                }
              }
            }
          }

          return {
            success: true,
            meta: {
              changes: 1,
              last_row_id: getNextId(tableName),
              duration: 0.1
            }
          }
        },

        first: async () => {
          const tableData = tables.get(tableName)
          if (!tableData || tableData.size === 0) return null
          return Array.from(tableData.values())[0] || null
        },

        all: async () => {
          const tableData = tables.get(tableName)
          if (!tableData) {
            return {
              success: true,
              results: [],
              meta: { duration: 0.1 }
            }
          }

          return {
            success: true,
            results: Array.from(tableData.values()),
            meta: { duration: 0.1 }
          }
        },

        raw: async () => {
          const tableData = tables.get(tableName)
          if (!tableData) return []
          return Array.from(tableData.values()).map(row => Object.values(row))
        }
      }
    },

    exec: async (sql: string) => {
      console.log('[MockDB] exec() called:', sql.substring(0, 100))
      // Handle CREATE TABLE, DELETE, etc.
      const tableName = extractTableName(sql)

      if (/DELETE\s+FROM/i.test(sql)) {
        const tableData = tables.get(tableName)
        if (tableData) {
          tableData.clear()
        }
      }

      return {
        count: 0,
        duration: 0.1,
        results: []
      }
    },

    batch: async (statements: any[]) => {
      console.log('[MockDB] batch() called with', statements.length, 'statements')
      return statements.map(() => ({
        success: true,
        results: [],
        meta: { changes: 1, last_row_id: 1, duration: 0.1 }
      }))
    },

    dump: async () => {
      console.log('[MockDB] dump() called')
      return new ArrayBuffer(0)
    }
  }
}

/**
 * Get all data from a table (for testing/debugging)
 */
export function getTableData(tableName: string) {
  const tableData = tables.get(tableName)
  return tableData ? Array.from(tableData.values()) : []
}

/**
 * Clear a specific table
 */
export function clearTable(tableName: string) {
  const tableData = tables.get(tableName)
  if (tableData) {
    tableData.clear()
    autoIncrementCounters.set(tableName, 0)
  }
}
