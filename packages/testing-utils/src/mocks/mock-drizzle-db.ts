/**
 * Mock Drizzle DB Infrastructure
 *
 * 從 packages/database/src/services/__tests__/test-helpers.ts 提取的
 * Drizzle ORM 模擬基礎設施，供所有需要 Mock DB 操作的測試使用。
 *
 * 使用方式：import { createOptimizedMockDB, cleanupMockDB } from "@makanmasak/testing-utils/mocks/mock-drizzle-db"
 */

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
  [key: string]: Map<string, any>;
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

const hasQueryChunks = (value: unknown): value is { queryChunks: unknown } =>
  typeof value === "object" && value !== null && "queryChunks" in value;

/**
 * SQL column name → JS property name mapping for common columns.
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

// ==========================================
// Filter Extraction
// ==========================================

/**
 * Extract filter criteria from Drizzle WHERE conditions.
 */
export function extractFilters(
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
    const separator = chunks[2]?.value?.[0] || "=";
    let op = "eq";
    if (separator.includes("<")) op = "lt";
    else if (separator.includes(">")) op = "gt";
    filters.push({ column: chunks[1].name, value: chunks[3].value, op });
    return filters;
  }

  // inArray(): 5 chunks where chunks[2] contains ' in ' and chunks[3] is an Array
  if (
    chunks.length === 5 &&
    chunks[1]?.name &&
    chunks[2]?.value?.[0]?.includes?.(" in ") &&
    Array.isArray(chunks[3])
  ) {
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
 * Compare a record value against a filter value using the specified operator.
 */
function matchFilterOp(recordVal: any, filterVal: any, op: string): boolean {
  if (op === "eq") return recordVal === filterVal;
  if (op === "lt") {
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
    return Array.isArray(filterVal) ? filterVal.includes(recordVal) : false;
  }
  return recordVal === filterVal;
}

// ==========================================
// Field Analysis
// ==========================================

interface FieldMapping {
  type: "none" | "columns" | "tables" | "count";
  fields?: Record<string, any>;
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

  // Check for column references (has .name property)
  for (const key of keys) {
    const val = fields[key];
    if (val && typeof val === "object" && "name" in val) {
      return { type: "columns", fields };
    }
  }

  return { type: "none" };
}

function transformRecord(record: any, mapping: FieldMapping): any {
  if (mapping.type === "none") return record;

  if (mapping.type === "count") return record;

  if (mapping.type === "columns") {
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
    const result: Record<string, any> = {};
    for (const [alias] of Object.entries(mapping.fields!)) {
      if (alias === mapping.primaryTableKey) {
        result[alias] = record;
      } else {
        result[alias] = null;
      }
    }
    return result;
  }

  return record;
}

// ==========================================
// QueryBuilder Class
// ==========================================

/**
 * QueryBuilder 類 - 單例模式,避免每次創建新閉包
 * 支持基本的 WHERE 過濾、JOIN（no-op）和 ORDER BY（no-op）
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

  leftJoin(_table: any, _condition: any) {
    return this;
  }

  innerJoin(_table: any, _condition: any) {
    return this;
  }

  orderBy(..._fields: any[]) {
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
    const dataMap = this.db._mockData[this.currentTable];

    if (this.fieldMapping.type === "count") {
      if (!dataMap) return { count: 0 };
      let c = 0;
      for (const value of dataMap.values()) {
        if (this.matchesFilters(value)) c++;
      }
      return { count: c };
    }

    if (!dataMap || dataMap.size === 0) return null;

    if (this.filters.length > 0) {
      for (const value of dataMap.values()) {
        if (this.matchesFilters(value))
          return transformRecord(value, this.fieldMapping);
      }
      return null;
    }

    if (this.db._lastInserted?.table === this.currentTable) {
      const record = dataMap.get(this.db._lastInserted.id);
      if (record) return transformRecord(record, this.fieldMapping);
    }

    for (const value of dataMap.values()) {
      return transformRecord(value, this.fieldMapping);
    }
    return null;
  }

  async all() {
    const dataMap = this.db._mockData[this.currentTable];
    if (!dataMap) return [];

    if (this.filters.length > 0) {
      const results: any[] = [];
      for (const value of dataMap.values()) {
        if (this.matchesFilters(value))
          results.push(transformRecord(value, this.fieldMapping));
      }
      return results;
    }

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
 * 創建優化的 Mock DB — 無內存洩漏版本
 *
 * 支持 Drizzle ORM 的 insert/select/update/delete/transaction 操作。
 * 使用 Map-based 存儲和單例 QueryBuilder 以優化效能。
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
          const dataMap = mockData[tableName];
          if (dataMap) {
            dataMap.set(id, dataWithId);
          } else {
            mockData[tableName] = new Map([[id, dataWithId]]);
          }
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
              const dataMap = mockData[tableName];
              if (!dataMap) return { success: true, changes: 0 };

              const filters = extractFilters(condition);
              const resolvedData: Record<string, any> = {};
              for (const [key, val] of Object.entries(updateData)) {
                if (hasQueryChunks(val)) {
                  continue;
                }
                resolvedData[key] = val;
              }

              let changes = 0;
              for (const [id, record] of dataMap.entries()) {
                const matches =
                  filters.length === 0 ||
                  filters.every((f) => {
                    const jsKey = sqlToJs(f.column);
                    const recordVal =
                      record[jsKey] !== undefined
                        ? record[jsKey]
                        : record[f.column];
                    return matchFilterOp(recordVal, f.value, f.op);
                  });
                if (matches) {
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
        where: (_condition: any) => ({
          run: async () => {
            const dataMap = mockData[tableName];
            if (dataMap) {
              dataMap.clear();
            }
            return { success: true, changes: dataMap?.size || 0 };
          },
        }),
      };
    },

    transaction: async (callback: any) => callback(db),

    _mockData: mockData,
    _lastInserted: lastInserted,
    _cleanup: () => {
      for (const key of Object.keys(mockData)) {
        mockData[key]?.clear();
      }
      lastInserted = null;
    },
  };

  return db;
};

// ==========================================
// Test Setup Helpers
// ==========================================

/**
 * 設置 UUID Mock — 產生可預測的遞增 UUID
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
 * 設置 Math.random Mock (用於分享碼生成等)
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
