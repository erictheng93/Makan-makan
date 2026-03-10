/**
 * Direct Drizzle ORM Mock
 *
 * Mocks Drizzle ORM interface directly without going through D1
 * This avoids SQL parsing and native module compilation issues
 */

// In-memory data store
const tables = new Map<string, Map<number, any>>();
const autoIncrementCounters = new Map<string, number>();

/**
 * Reset all test data
 */
function resetTestData() {
  tables.clear();
  autoIncrementCounters.clear();

  const tableNames = [
    "restaurants",
    "categories",
    "menu_items",
    "tables",
    "users",
    "orders",
    "order_items",
    "queue_settings",
    "sessions",
    "audit_logs",
    "waiting_queue",
    "queue_events",
    "queue_notifications",
  ];

  tableNames.forEach((name) => {
    tables.set(name, new Map());
    autoIncrementCounters.set(name, 0);
  });
}

/**
 * Get next auto-increment ID
 */
function getNextId(tableName: string): number {
  const current = autoIncrementCounters.get(tableName) || 0;
  const next = current + 1;
  autoIncrementCounters.set(tableName, next);
  return next;
}

/**
 * Get table name from Drizzle table object
 */
function getTableName(table: any): string {
  // Try to get table name from Drizzle's internal symbol
  const symbolName = table[Symbol.for("drizzle:Name")];
  if (symbolName) return symbolName;

  // Fallback: extract from table config
  if (table?.[Symbol.for("drizzle:BaseName")]) {
    return table[Symbol.for("drizzle:BaseName")];
  }

  // Last resort: check common table names
  const tableNames = [
    "restaurants",
    "categories",
    "menu_items",
    "tables",
    "users",
    "orders",
    "order_items",
  ];
  for (const name of tableNames) {
    if (table?.toString().includes(name)) {
      return name;
    }
  }

  return "unknown";
}

/**
 * Create a mock Drizzle database instance
 */
export function createMockDrizzle() {
  resetTestData();

  const mock: any = {
    // INSERT operation
    insert: (table: any) => {
      const tableName = getTableName(table);
      console.log("[DrizzleMock] insert() called for table:", tableName);

      return {
        values: (data: any) => {
          console.log("[DrizzleMock] values() called with:", data);

          return {
            returning: () => {
              console.log("[DrizzleMock] returning() called");

              // Generate ID if not provided
              if (!data.id) {
                data.id = getNextId(tableName);
              }

              // Add timestamps
              const now = new Date().toISOString();
              if (!data.createdAt) data.createdAt = now;
              if (!data.updatedAt) data.updatedAt = now;

              // Store in memory
              const tableData = tables.get(tableName);
              if (tableData) {
                tableData.set(data.id, { ...data });
                console.log("[DrizzleMock] Stored record with ID:", data.id);
              } else {
                console.error("[DrizzleMock] Table not found:", tableName);
              }

              // Return as array (Drizzle expects array)
              const result = [{ ...data }];
              console.log("[DrizzleMock] Returning:", result);
              return Promise.resolve(result);
            },

            execute: async () => {
              if (!data.id) {
                data.id = getNextId(tableName);
              }

              const now = new Date().toISOString();
              if (!data.createdAt) data.createdAt = now;
              if (!data.updatedAt) data.updatedAt = now;

              const tableData = tables.get(tableName);
              if (tableData) {
                tableData.set(data.id, { ...data });
              }

              return { rowsAffected: 1 };
            },
          };
        },
      };
    },

    // SELECT operation
    select: (fields?: any) => ({
      from: (table: any) => {
        const tableName = getTableName(table);
        console.log("[DrizzleMock] select().from() called for:", tableName);

        return {
          where: (condition: any) => ({
            limit: (n: number) => ({
              execute: async () => {
                const tableData = tables.get(tableName);
                if (!tableData) return [];
                return Array.from(tableData.values()).slice(0, n);
              },
            }),
            execute: async () => {
              const tableData = tables.get(tableName);
              if (!tableData) return [];
              return Array.from(tableData.values());
            },
          }),
          limit: (n: number) => ({
            execute: async () => {
              const tableData = tables.get(tableName);
              if (!tableData) return [];
              return Array.from(tableData.values()).slice(0, n);
            },
          }),
          execute: async () => {
            const tableData = tables.get(tableName);
            if (!tableData) return [];
            return Array.from(tableData.values());
          },
        };
      },
    }),

    // UPDATE operation
    update: (table: any) => {
      const tableName = getTableName(table);
      console.log("[DrizzleMock] update() called for:", tableName);

      return {
        set: (data: any) => ({
          where: (condition: any) => ({
            returning: () => {
              const tableData = tables.get(tableName);
              if (!tableData) return Promise.resolve([]);

              const records = Array.from(tableData.values());
              if (records.length > 0) {
                const updated = {
                  ...records[0],
                  ...data,
                  updatedAt: new Date().toISOString(),
                };
                tableData.set(updated.id, updated);
                return Promise.resolve([updated]);
              }
              return Promise.resolve([]);
            },
          }),
        }),
      };
    },

    // DELETE operation
    delete: (table: any) => {
      const tableName = getTableName(table);
      console.log("[DrizzleMock] delete() called for:", tableName);

      return {
        where: (condition: any) => ({
          execute: async () => {
            const tableData = tables.get(tableName);
            if (tableData) {
              tableData.clear();
            }
            return { rowsAffected: 1 };
          },
        }),
      };
    },

    // Relational query API
    query: new Proxy(
      {},
      {
        get: (target, tableName: string) => {
          console.log("[DrizzleMock] query." + tableName + " accessed");

          return {
            findFirst: async (options: any) => {
              const tableData = tables.get(tableName);
              if (!tableData) return null;
              const records = Array.from(tableData.values());
              return records[0] || null;
            },
            findMany: async (options: any) => {
              const tableData = tables.get(tableName);
              if (!tableData) return [];
              return Array.from(tableData.values());
            },
          };
        },
      },
    ),
  };

  return mock;
}

/**
 * Get all data from a table (for testing/debugging)
 */
export function getTableData(tableName: string) {
  const tableData = tables.get(tableName);
  return tableData ? Array.from(tableData.values()) : [];
}

/**
 * Clear a specific table
 */
export function clearTable(tableName: string) {
  const tableData = tables.get(tableName);
  if (tableData) {
    tableData.clear();
    autoIncrementCounters.set(tableName, 0);
  }
}

/**
 * Clear all tables
 */
export function clearAllTables() {
  resetTestData();
}
