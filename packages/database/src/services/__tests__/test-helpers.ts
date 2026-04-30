/**
 * GroupOrderService Test Helpers
 *
 * 共享的測試工具和 Mock Database
 * 優化內存使用,避免內存洩漏
 */

import type { D1Database } from "@cloudflare/workers-types";
import { vi } from "vitest";

// ==========================================
// Mock Data Types
// ==========================================

export interface MockData {
  groupOrders: Map<string, any>;
  groupMembers: Map<string, any>;
  groupCartItems: Map<string, any>;
  splitBills: Map<string, any>;
  shareCodes: Map<string, any>;
  groupActivityLogs: Map<string, any>;
  menuItems: Map<string, any>;
  users: Map<string, any>;
}

// ==========================================
// Helper Functions
// ==========================================

/**
 * SQL table name → MockData key mapping
 * Drizzle table objects use Symbol('drizzle:Name') for SQL table names (snake_case).
 */
const sqlToMockKeyMap: Record<string, string> = {
  group_orders: "groupOrders",
  group_members: "groupMembers",
  group_cart_items: "groupCartItems",
  split_bills: "splitBills",
  share_codes: "shareCodes",
  group_activity_logs: "groupActivityLogs",
  menu_items: "menuItems",
  users: "users",
};

/**
 * 從表對象中提取表名 (MockData key)
 */
export const getTableName = (table: any): string => {
  // Try Drizzle Symbol-based name first
  if (table && typeof table === "object") {
    const symbols = Object.getOwnPropertySymbols(table);
    for (const sym of symbols) {
      if (sym.description === "drizzle:Name") {
        const sqlName = table[sym];
        return sqlToMockKeyMap[sqlName] || sqlName;
      }
    }
  }

  // Fallback: check _ property (older Drizzle versions)
  if (table?._ && "name" in table._) {
    const sqlName = table._.name;
    return sqlToMockKeyMap[sqlName] || sqlName;
  }

  // Fallback: string matching
  const tableStr = String(table);
  if (tableStr.includes("groupOrders")) return "groupOrders";
  if (tableStr.includes("groupMembers")) return "groupMembers";
  if (tableStr.includes("groupCartItems")) return "groupCartItems";
  if (tableStr.includes("splitBills")) return "splitBills";
  if (tableStr.includes("shareCodes")) return "shareCodes";
  if (tableStr.includes("groupActivityLogs")) return "groupActivityLogs";
  if (tableStr.includes("menuItems")) return "menuItems";
  if (tableStr.includes("users")) return "users";
  return "groupOrders";
};

// ==========================================
// QueryBuilder Class (Singleton Pattern)
// ==========================================

/**
 * Extract filter criteria from Drizzle WHERE conditions.
 * Drizzle eq() creates queryChunks: [StringChunk, Column, StringChunk(' = '), Param, StringChunk]
 * Drizzle lt() creates queryChunks: [StringChunk, Column, StringChunk(' < '), Param, StringChunk]
 * Drizzle and() wraps multiple conditions.
 * Drizzle inArray() creates: [StringChunk, Column, StringChunk(' in ('), ...Params, StringChunk(')')]
 */
function extractFilters(
  condition: any,
): Array<{ column: string; value: any; op: string }> {
  const filters: Array<{ column: string; value: any; op: string }> = [];
  if (!condition) return filters;

  const chunks = condition?.queryChunks;
  if (!chunks) return filters;

  // Single binary op (eq/lt/gt/lte/gte): 5 chunks with column and param
  if (
    chunks.length === 5 &&
    chunks[1]?.name &&
    chunks[3]?.value !== undefined
  ) {
    // Detect operator from the separator chunk (chunks[2])
    const separator = chunks[2]?.value?.[0] || "=";
    let op = "eq";
    if (separator.includes("<")) op = "lt";
    else if (separator.includes(">")) op = "gt";
    filters.push({ column: chunks[1].name, value: chunks[3].value, op });
    return filters;
  }

  // inArray(): 5 chunks where chunks[2] contains ' in ' and chunks[3] is an Array of Param objects
  if (
    chunks.length === 5 &&
    chunks[1]?.name &&
    chunks[2]?.value?.[0]?.includes?.(" in ") &&
    Array.isArray(chunks[3])
  ) {
    // Extract .value from each Param in the array
    const values = chunks[3].map((p: any) =>
      p?.value !== undefined ? p.value : p,
    );
    filters.push({ column: chunks[1].name, value: values, op: "in" });
    return filters;
  }

  // and(): recursively extract from nested conditions
  for (const chunk of chunks) {
    if (chunk?.queryChunks) {
      filters.push(...extractFilters(chunk));
    }
  }
  return filters;
}

/**
 * SQL column name → JS property name mapping for common columns.
 * Drizzle table columns use snake_case SQL names but camelCase TS properties.
 */
const sqlColToJsMap: Record<string, string> = {
  group_order_id: "groupOrderId",
  share_code: "shareCode",
  user_id: "userId",
  member_id: "memberId",
  menu_item_id: "menuItemId",
  restaurant_id: "restaurantId",
  table_id: "tableId",
  is_available: "isAvailable",
  is_active: "isActive",
  created_by: "createdBy",
  payment_status: "paymentStatus",
  payment_method: "paymentMethod",
  payment_reference: "paymentReference",
  paid_at: "paidAt",
  updated_at: "updatedAt",
  left_at: "leftAt",
  locked_at: "lockedAt",
  completed_at: "completedAt",
  expires_at: "expiresAt",
  expires_at_ms: "expiresAt",
  created_at_ms: "createdAt",
  updated_at_ms: "updatedAt",
  locked_at_ms: "lockedAt",
  completed_at_ms: "completedAt",
  paid_at_ms: "paidAt",
  left_at_ms: "leftAt",
  joined_at_ms: "joinedAt",
  last_active_at_ms: "lastActiveAt",
  added_at_ms: "addedAt",
};

function sqlToJs(sqlCol: string): string {
  return sqlColToJsMap[sqlCol] || sqlCol;
}

/**
 * Compare a record value against a filter value using the specified operator.
 */
function matchFilterOp(recordVal: any, filterVal: any, op: string): boolean {
  if (op === "eq") {
    return recordVal === filterVal;
  }
  if (op === "lt") {
    // Handle Date comparison
    const rv = recordVal instanceof Date ? recordVal.getTime() : recordVal;
    const fv = filterVal instanceof Date ? filterVal.getTime() : filterVal;
    return rv < fv;
  }
  if (op === "gt") {
    const rv = recordVal instanceof Date ? recordVal.getTime() : recordVal;
    const fv = filterVal instanceof Date ? filterVal.getTime() : filterVal;
    return rv > fv;
  }
  if (op === "in") {
    if (Array.isArray(filterVal)) {
      return filterVal.includes(recordVal);
    }
    return false;
  }
  // Default: equality
  return recordVal === filterVal;
}

/**
 * Detect the type of select fields being used.
 *
 * Drizzle select() patterns:
 *   - select()                    → no fields, return full record
 *   - select({count: count()})    → aggregate, has sql chunks
 *   - select({role: col, ...})    → column pick, each value has .name
 *   - select({groupOrder: table}) → table wrap, value is a table object with Symbol('drizzle:Name')
 */
interface FieldMapping {
  type: "none" | "columns" | "tables" | "count";
  fields?: Record<string, any>;
  /** For "tables" type: which key maps to the primary table */
  primaryTableKey?: string;
}

function analyzeFields(fields: any): FieldMapping {
  if (!fields || typeof fields !== "object") return { type: "none" };

  const keys = Object.keys(fields);
  if (keys.length === 0) return { type: "none" };

  // Check for count() — has queryChunks
  for (const key of keys) {
    const val = fields[key];
    if (val && typeof val === "object" && val.queryChunks) {
      return { type: "count", fields };
    }
  }

  // Check for table references (has Symbol('drizzle:Name'))
  for (const key of keys) {
    const val = fields[key];
    if (val && typeof val === "object") {
      const symbols = Object.getOwnPropertySymbols(val);
      for (const sym of symbols) {
        if (sym.description === "drizzle:Name") {
          return { type: "tables", fields, primaryTableKey: key };
        }
      }
    }
  }

  // Check for column references (has .name property — a Drizzle column)
  for (const key of keys) {
    const val = fields[key];
    if (val && typeof val === "object" && "name" in val) {
      return { type: "columns", fields };
    }
  }

  return { type: "none" };
}

/**
 * Transform a raw record based on the field mapping.
 */
function transformRecord(record: any, mapping: FieldMapping): any {
  if (mapping.type === "none") return record;

  if (mapping.type === "count") {
    // Return a count result — the actual count is computed by the caller
    return record;
  }

  if (mapping.type === "columns") {
    // Pick specific columns from the record
    const result: Record<string, any> = {};
    for (const [alias, col] of Object.entries(mapping.fields!)) {
      if (col && typeof col === "object" && "name" in col) {
        const jsKey = sqlToJs(col.name);
        result[alias] =
          record[jsKey] !== undefined ? record[jsKey] : record[col.name];
      }
    }
    return result;
  }

  if (mapping.type === "tables") {
    // Wrap the record in the table key
    const result: Record<string, any> = {};
    for (const [alias, _val] of Object.entries(mapping.fields!)) {
      if (alias === mapping.primaryTableKey) {
        result[alias] = record;
      } else {
        // For joined table columns, set to null (mock doesn't resolve joins)
        result[alias] = null;
      }
    }
    return result;
  }

  return record;
}

/**
 * QueryBuilder 類 - 單例模式,避免每次創建新閉包
 * Supports basic WHERE filtering via Drizzle expression inspection.
 */
export class QueryBuilder {
  private db: any;
  private currentTable: string = "";
  private recordsCache: any[] | null = null;
  private filters: Array<{ column: string; value: any; op: string }> = [];
  private fieldMapping: FieldMapping = { type: "none" };

  constructor(db: any) {
    this.db = db;
  }

  reset() {
    this.currentTable = "";
    this.recordsCache = null;
    this.filters = [];
    this.fieldMapping = { type: "none" };
    return this;
  }

  setFieldMapping(fields: any) {
    this.fieldMapping = analyzeFields(fields);
    return this;
  }

  from(table: any) {
    this.currentTable = getTableName(table);
    this.recordsCache = null;
    return this;
  }

  where(condition: any) {
    this.filters = extractFilters(condition);
    return this;
  }

  leftJoin(table: any, condition: any) {
    return this;
  }

  innerJoin(table: any, condition: any) {
    return this;
  }

  orderBy(...fields: any[]) {
    return this;
  }

  private matchesFilters(record: any): boolean {
    if (this.filters.length === 0) return true;
    return this.filters.every((f) => {
      const jsKey = sqlToJs(f.column);
      const recordVal =
        record[jsKey] !== undefined ? record[jsKey] : record[f.column];
      return matchFilterOp(recordVal, f.value, f.op);
    });
  }

  async get() {
    const dataMap = this.db._mockData[this.currentTable as keyof MockData];

    // Handle count() queries
    if (this.fieldMapping.type === "count") {
      if (!dataMap) return { count: 0 };
      let c = 0;
      for (const value of dataMap.values()) {
        if (this.matchesFilters(value)) c++;
      }
      return { count: c };
    }

    if (!dataMap || dataMap.size === 0) return null;

    // If we have filters, find the first matching record
    if (this.filters.length > 0) {
      for (const value of dataMap.values()) {
        if (this.matchesFilters(value))
          return transformRecord(value, this.fieldMapping);
      }
      return null;
    }

    // 優先返回最後插入的記錄
    if (this.db._lastInserted?.table === this.currentTable) {
      const record = dataMap.get(this.db._lastInserted.id);
      if (record) return transformRecord(record, this.fieldMapping);
    }

    // 返回第一條記錄 - 使用 iterator 避免 Array.from
    for (const value of dataMap.values()) {
      return transformRecord(value, this.fieldMapping);
    }
    return null;
  }

  async all() {
    const dataMap = this.db._mockData[this.currentTable as keyof MockData];
    if (!dataMap) return [];

    // If we have filters, filter results
    if (this.filters.length > 0) {
      const results: any[] = [];
      for (const value of dataMap.values()) {
        if (this.matchesFilters(value))
          results.push(transformRecord(value, this.fieldMapping));
      }
      return results;
    }

    // 使用緩存避免重複轉換
    if (this.recordsCache) return this.recordsCache;
    this.recordsCache = Array.from(dataMap.values()).map((v) =>
      transformRecord(v, this.fieldMapping),
    );
    return this.recordsCache;
  }
}

// ==========================================
// Mock Database Factory
// ==========================================

/**
 * 創建優化的 Mock DB - 無內存洩漏版本
 *
 * 優化重點:
 * 1. 單例 QueryBuilder - 避免每次 select() 創建新閉包
 * 2. 避免不必要的數組複製 - 減少 Array.from 調用
 * 3. 正確的 update 邏輯 - 限制更新範圍
 * 4. 內存清理機制 - 測試後釋放資源
 * 5. 緩存優化 - 重用 queryBuilder 實例
 */
export const createOptimizedMockDB = () => {
  const mockData: MockData = {
    groupOrders: new Map(),
    groupMembers: new Map(),
    groupCartItems: new Map(),
    splitBills: new Map(),
    shareCodes: new Map(),
    groupActivityLogs: new Map(),
    menuItems: new Map(),
    users: new Map(),
  };

  let lastInserted: { table: string; id: string } | null = null;

  // 創建單例 QueryBuilder
  const queryBuilder = new QueryBuilder({
    _mockData: mockData,
    get _lastInserted() {
      return lastInserted;
    },
  });

  const db: any = {
    insert: (table: any) => {
      const tableName = getTableName(table);
      return {
        values: async (data: any) => {
          const id = data.id || crypto.randomUUID();
          const dataWithId = { ...data, id };
          mockData[tableName as keyof MockData].set(id, dataWithId);
          lastInserted = { table: tableName, id };
          return { success: true };
        },
      };
    },
    select: (fields?: any) => {
      queryBuilder.reset();
      if (fields) {
        queryBuilder.setFieldMapping(fields);
      }
      return queryBuilder;
    },
    update: (table: any) => {
      const tableName = getTableName(table);
      return {
        set: (updateData: any) => ({
          where: (condition: any) => ({
            run: async () => {
              const dataMap = mockData[tableName as keyof MockData];
              if (!dataMap) return { success: true, changes: 0 };

              // Extract WHERE filters and update all matching records
              const filters = extractFilters(condition);

              // Resolve any SQL expression values in updateData to plain values
              const resolvedData: Record<string, any> = {};
              for (const [key, val] of Object.entries(updateData)) {
                // Skip SQL expressions (like sql`col + 1`) - they can't be resolved in mock
                if (val && typeof val === "object" && "queryChunks" in val) {
                  continue;
                }
                resolvedData[key] = val;
              }

              let changes = 0;
              const matchesRecord = (record: any): boolean => {
                if (filters.length === 0) return true;
                return filters.every((f) => {
                  const jsKey = sqlToJs(f.column);
                  const recordVal =
                    record[jsKey] !== undefined
                      ? record[jsKey]
                      : record[f.column];
                  return matchFilterOp(recordVal, f.value, f.op);
                });
              };

              for (const [id, record] of dataMap.entries()) {
                if (matchesRecord(record)) {
                  dataMap.set(id, { ...record, ...resolvedData });
                  changes++;
                }
              }

              return { success: true, changes };
            },
          }),
        }),
      };
    },
    delete: (table: any) => {
      const tableName = getTableName(table);
      return {
        where: (condition: any) => ({
          run: async () => {
            const dataMap = mockData[tableName as keyof MockData];
            if (dataMap) {
              dataMap.clear(); // 簡化實現 - 清空表
            }
            return { success: true, changes: dataMap?.size || 0 };
          },
        }),
      };
    },
    // Transaction support - passes the same mock db to callback
    transaction: async (callback: any) => callback(db),
    _mockData: mockData,
    _lastInserted: lastInserted,
    _cleanup: () => {
      // 清理所有數據
      for (const key of Object.keys(mockData)) {
        mockData[key as keyof MockData].clear();
      }
      lastInserted = null;
    },
  };

  return db;
};

// ==========================================
// Mock Environment Factory
// ==========================================

export const createMockEnv = () => ({
  DB: {} as D1Database,
  JWT_SECRET: "test-secret",
  CUSTOMER_APP_URL: "https://test.makanmakan.com",
});

// ==========================================
// Test Setup Helpers
// ==========================================

/**
 * 設置 UUID Mock
 */
export const setupUUIDMock = () => {
  let uuidCounter = 0;
  vi.stubGlobal("crypto", {
    randomUUID: () => {
      uuidCounter++;
      const hex = uuidCounter.toString(16).padStart(12, "0");
      return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-4000-8000-000000000000`;
    },
  });
};

/**
 * 設置 Math.random Mock (用於分享碼生成)
 */
export const setupRandomMock = () => {
  let randomCallCount = 0;
  vi.spyOn(Math, "random").mockImplementation(() => {
    randomCallCount++;
    return (randomCallCount * 0.1) % 1;
  });
};

/**
 * 清理 Mock 數據
 */
export const cleanupMockDB = (mockDB: any) => {
  if (mockDB && mockDB._cleanup) {
    mockDB._cleanup();
  }
};
