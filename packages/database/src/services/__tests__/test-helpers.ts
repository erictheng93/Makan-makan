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
 * 從表對象中提取表名
 */
export const getTableName = (table: any): string => {
  if (table?._ && "name" in table._) return table._.name;

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
 * QueryBuilder 類 - 單例模式,避免每次創建新閉包
 */
export class QueryBuilder {
  private db: any;
  private currentTable: string = "";
  private recordsCache: any[] | null = null;

  constructor(db: any) {
    this.db = db;
  }

  reset() {
    this.currentTable = "";
    this.recordsCache = null;
    return this;
  }

  from(table: any) {
    this.currentTable = getTableName(table);
    this.recordsCache = null;
    return this;
  }

  where(condition: any) {
    // 簡化實現 - 不做實際過濾
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

  async get() {
    const dataMap = this.db._mockData[this.currentTable as keyof MockData];
    if (!dataMap || dataMap.size === 0) return null;

    // 優先返回最後插入的記錄
    if (this.db._lastInserted?.table === this.currentTable) {
      const record = dataMap.get(this.db._lastInserted.id);
      if (record) return record;
    }

    // 返回第一條記錄 - 使用 iterator 避免 Array.from
    for (const value of dataMap.values()) {
      return value;
    }
    return null;
  }

  async all() {
    // 使用緩存避免重複轉換
    if (this.recordsCache) return this.recordsCache;

    const dataMap = this.db._mockData[this.currentTable as keyof MockData];
    if (!dataMap) return [];

    this.recordsCache = Array.from(dataMap.values());
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
      return queryBuilder;
    },
    update: (table: any) => {
      const tableName = getTableName(table);
      return {
        set: (data: any) => ({
          where: (condition: any) => ({
            run: async () => {
              const dataMap = mockData[tableName as keyof MockData];
              if (!dataMap) return { success: true, changes: 0 };

              // 只更新最後插入的記錄 - 避免全量更新
              if (lastInserted?.table === tableName && lastInserted?.id) {
                const existing = dataMap.get(lastInserted.id);
                if (existing) {
                  dataMap.set(lastInserted.id, { ...existing, ...data });
                  return { success: true, changes: 1 };
                }
              }

              return { success: true, changes: 0 };
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
