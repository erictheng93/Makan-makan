/**
 * Service Layer Mocking Utilities
 *
 * Provides Vitest-based mocking utilities for service layer methods in integration tests.
 * Bypasses MockDrizzle limitations by intercepting service calls at the test level.
 * NO production code modification required!
 */

import { vi } from "vitest";

/**
 * Mock Table Data Store
 * Simulates table records for testing without database dependency
 */
export class MockTableStore {
  private tables = new Map<number, any>();

  addTable(table: any) {
    this.tables.set(table.id, table);
  }

  getTable(id: number) {
    return this.tables.get(id) || null;
  }

  clear() {
    this.tables.clear();
  }

  getAllTables() {
    return Array.from(this.tables.values());
  }
}

/**
 * Mock Restaurant Data Store
 * Simulates restaurant records for testing without database dependency
 * Supports both string and number IDs for backward compatibility
 */
export class MockRestaurantStore {
  private restaurants = new Set<string>();

  addRestaurant(id: string | number) {
    this.restaurants.add(String(id));
  }

  hasRestaurant(id: string | number): boolean {
    return this.restaurants.has(String(id));
  }

  removeRestaurant(id: string | number) {
    this.restaurants.delete(String(id));
  }

  clear() {
    this.restaurants.clear();
  }
}

/**
 * Create a mock function for TableService.getTableById()
 * Uses the MockTableStore to return test data
 */
export function createTableServiceMock(store: MockTableStore) {
  return vi.fn(async (id: number) => {
    const table = store.getTable(id);
    if (!table) {
      return null;
    }
    return table;
  });
}

/**
 * Create a mock function for restaurant validation in UnifiedQueueService
 * Uses the MockRestaurantStore to validate restaurants
 * Supports both string and number IDs for backward compatibility
 */
export function createRestaurantValidationMock(store: MockRestaurantStore) {
  return vi.fn(async (restaurantId: string | number) => {
    if (!store.hasRestaurant(restaurantId)) {
      throw new Error("Restaurant not found");
    }
    return {
      id: restaurantId,
      name: "Test Restaurant",
      isActive: true,
    };
  });
}

/**
 * Enhance Mock Drizzle with custom query handlers
 * This patches the mockDrizzle instance to handle specific queries that MockDrizzle struggles with
 *
 * Usage in tests:
 * ```typescript
 * const tableStore = new MockTableStore()
 * tableStore.addTable({ id: 2, number: 'B2', ... })
 *
 * enhanceMockDrizzle(mockDrizzleInstance, { tableStore })
 * ```
 */
export function enhanceMockDrizzle(
  mockDrizzle: any,
  options: {
    tableStore?: MockTableStore;
    restaurantStore?: MockRestaurantStore;
  },
) {
  const { tableStore, restaurantStore } = options;

  // Store original query method
  const originalQuery = mockDrizzle.query;

  // Enhance query.tables.findFirst to use TableStore
  if (tableStore && originalQuery?.tables?.findFirst) {
    const originalFindFirst = originalQuery.tables.findFirst;
    originalQuery.tables.findFirst = vi.fn(async (options: any) => {
      console.log(
        "[EnhancedMockDrizzle] tables.findFirst() called with:",
        options,
      );

      // Try to extract table ID from where condition
      // This handles: where(eq(tables.id, tableId))
      if (options?.where) {
        // MockDrizzle can't parse complex conditions, so we'll extract the ID manually
        const whereStr = String(options.where);
        const idMatch = whereStr.match(/id[=\s]+(\d+)/);

        if (idMatch) {
          const tableId = parseInt(idMatch[1], 10);
          console.log("[EnhancedMockDrizzle] Extracted table ID:", tableId);
          const table = tableStore.getTable(tableId);
          console.log("[EnhancedMockDrizzle] Found table:", !!table);
          return table;
        }
      }

      // Fallback to original implementation
      return originalFindFirst.call(originalQuery.tables, options);
    });
  }

  // Enhance query.restaurants.findFirst to use RestaurantStore
  if (restaurantStore && originalQuery?.restaurants?.findFirst) {
    const originalFindFirst = originalQuery.restaurants.findFirst;
    originalQuery.restaurants.findFirst = vi.fn(async (options: any) => {
      console.log(
        "[EnhancedMockDrizzle] restaurants.findFirst() called with:",
        options,
      );

      // Try to extract restaurant ID from where condition
      // This handles: where(eq(restaurants.id, restaurantId))
      if (options?.where) {
        const whereStr = String(options.where);
        const idMatch = whereStr.match(/id[=\s]+(\d+)/);

        if (idMatch) {
          const restaurantId = parseInt(idMatch[1], 10);
          console.log(
            "[EnhancedMockDrizzle] Extracted restaurant ID:",
            restaurantId,
          );

          if (!restaurantStore.hasRestaurant(restaurantId)) {
            console.log(
              "[EnhancedMockDrizzle] Restaurant not found, returning null",
            );
            return null;
          }

          return {
            id: restaurantId,
            name: "Test Restaurant",
            isActive: true,
            isAvailable: true,
          };
        }
      }

      // Fallback to original implementation
      return originalFindFirst.call(originalQuery.restaurants, options);
    });
  }

  // Enhance select() method to use TableStore for table queries
  // This handles TableService.getTableById which uses select().from(tables).where()
  if (tableStore && mockDrizzle.select) {
    const originalSelect = mockDrizzle.select;
    mockDrizzle.select = vi.fn((fields: any) => {
      const fromChain = originalSelect.call(mockDrizzle, fields);
      const originalFrom = fromChain.from;

      fromChain.from = vi.fn((table: any) => {
        const tableName = String(table);
        const whereChain = originalFrom.call(fromChain, table);
        const originalWhere = whereChain.where;

        // Intercept where() for tables
        whereChain.where = vi.fn((condition: any) => {
          const getChain = originalWhere.call(whereChain, condition);
          const originalGet = getChain.get;

          // Intercept get() to return data from store for tables
          getChain.get = vi.fn(async () => {
            if (tableName.includes("tables")) {
              const whereStr = String(condition);
              const idMatch = whereStr.match(/id[=\s]+(\d+)/);

              if (idMatch) {
                const tableId = parseInt(idMatch[1], 10);
                console.log(
                  "[EnhancedMockDrizzle] select().where().get() for table ID:",
                  tableId,
                );
                const table = tableStore.getTable(tableId);
                if (table) {
                  console.log(
                    "[EnhancedMockDrizzle] Returning table from store:",
                    !!table,
                  );
                  return table;
                }
              }
            }

            // Fallback to original implementation
            return originalGet.call(getChain);
          });

          return getChain;
        });

        return whereChain;
      });

      return fromChain;
    });
  }

  // Enhance update() method to properly filter by WHERE clause
  // MockDrizzle's update ignores WHERE conditions, updating ALL records
  // This enhancement adds proper WHERE filtering for table updates
  if (tableStore && mockDrizzle.update) {
    const originalUpdate = mockDrizzle.update;
    mockDrizzle.update = vi.fn((table: any) => {
      const tableName = String(table);
      console.log(
        "[EnhancedMockDrizzle] update() called for table:",
        tableName,
      );

      const setChain = originalUpdate.call(mockDrizzle, table);
      const originalSet = setChain.set;

      // Intercept set() to track update data
      setChain.set = (data: any) => {
        console.log("[EnhancedMockDrizzle] set() called with data:", data);

        const whereChain = originalSet.call(setChain, data);
        const originalWhere = whereChain.where;

        // Intercept where() to apply filtering BEFORE update
        whereChain.where = (condition: any) => {
          console.log(
            "[EnhancedMockDrizzle] where() called with condition:",
            String(condition),
          );

          // Extract table ID from where condition for tables
          if (tableName.includes("tables")) {
            const whereStr = String(condition);
            const idMatch = whereStr.match(/id[=\s]+(\d+)/);

            if (idMatch) {
              const tableId = parseInt(idMatch[1], 10);
              console.log(
                "[EnhancedMockDrizzle] Extracted table ID for update:",
                tableId,
              );

              // Update the table in the store so subsequent reads get updated data
              const existingTable = tableStore.getTable(tableId);
              if (existingTable) {
                const updatedTable = { ...existingTable, ...data };
                tableStore.addTable(updatedTable);
                console.log(
                  "[EnhancedMockDrizzle] Updated table in store:",
                  tableId,
                );
              }
            }
          }

          // Call original where() to let MockDrizzle handle the database update
          return originalWhere.call(whereChain, condition);
        };

        return whereChain;
      };

      return setChain;
    });
  }

  return mockDrizzle;
}
