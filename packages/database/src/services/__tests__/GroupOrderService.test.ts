/**
 * GroupOrderService Test Suite
 *
 * 全面测试群组点餐服务的所有功能
 * 覆盖：群组订单管理、成员管理、购物车管理、帐单分摊、支付处理
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { GroupOrderService } from "../GroupOrderService";
import type { D1Database } from "@cloudflare/workers-types";
import { envFactory, resetAllFactories } from "@makanmasak/testing-utils";

// ==========================================
// Mock Database with basic filtering support
// ==========================================

interface MockData {
  groupOrders: Map<string, any>;
  groupMembers: Map<string, any>;
  groupCartItems: Map<string, any>;
  splitBills: Map<string, any>;
  shareCodes: Map<string, any>;
  groupActivityLogs: Map<string, any>;
  menuItems: Map<string, any>;
  users: Map<string, any>;
}

// Map SQL column names to JS property names used in our mock data
const sqlToJs: Record<string, string> = {
  id: "id",
  share_code: "shareCode",
  master_order_id: "masterOrderId",
  created_by: "createdBy",
  restaurant_id: "restaurantId",
  table_id: "tableId",
  status: "status",
  split_type: "splitType",
  total_amount: "totalAmount",
  tax_amount: "taxAmount",
  service_charge: "serviceCharge",
  final_amount: "finalAmount",
  expires_at_ms: "expiresAt",
  locked_at_ms: "lockedAt",
  completed_at_ms: "completedAt",
  settings: "settings",
  notes: "notes",
  created_at_ms: "createdAt",
  updated_at_ms: "updatedAt",
  group_order_id: "groupOrderId",
  user_id: "userId",
  session_id: "sessionId",
  name: "name",
  phone: "phone",
  email: "email",
  avatar_url: "avatarUrl",
  role: "role",
  permissions: "permissions",
  joined_at_ms: "joinedAt",
  last_active_at_ms: "lastActiveAt",
  is_active: "isActive",
  left_at_ms: "leftAt",
  member_id: "memberId",
  menu_item_id: "menuItemId",
  quantity: "quantity",
  unit_price: "unitPrice",
  total_price: "totalPrice",
  customizations: "customizations",
  special_instructions: "specialInstructions",
  added_at_ms: "addedAt",
  code: "code",
  type: "type",
  resource_id: "resourceId",
  is_available: "isAvailable",
  price: "price",
  usage_count: "usageCount",
  usage_limit: "usageLimit",
  metadata: "metadata",
  subtotal: "subtotal",
  discount_amount: "discountAmount",
  tip_amount: "tipAmount",
  items: "items",
  payment_status: "paymentStatus",
  payment_method: "paymentMethod",
  payment_reference: "paymentReference",
  paid_at_ms: "paidAt",
  action: "action",
  description: "description",
  full_name: "fullName",
};

const resolveFieldName = (field: string): string => {
  return sqlToJs[field] || field;
};

const getTableName = (table: any): string => {
  // Drizzle table objects have Symbol.for('drizzle:Name') or similar
  // Try common patterns
  if (table && typeof table === "object") {
    // Check for drizzle SQLiteTable: table[Symbol.for('drizzle:Name')]
    const drizzleName = table[Symbol.for("drizzle:Name")];
    if (drizzleName) {
      // Convert SQL table name to our mockData key
      const tableMap: Record<string, string> = {
        group_orders: "groupOrders",
        group_members: "groupMembers",
        group_cart_items: "groupCartItems",
        split_bills: "splitBills",
        share_codes: "shareCodes",
        group_activity_logs: "groupActivityLogs",
        menu_items: "menuItems",
        users: "users",
      };
      return tableMap[drizzleName] || drizzleName;
    }
  }

  if (table?._ && "name" in table._) {
    const n = table._.name;
    const tableMap: Record<string, string> = {
      group_orders: "groupOrders",
      group_members: "groupMembers",
      group_cart_items: "groupCartItems",
      split_bills: "splitBills",
      share_codes: "shareCodes",
      group_activity_logs: "groupActivityLogs",
      menu_items: "menuItems",
      users: "users",
    };
    return tableMap[n] || n;
  }

  const tableStr = String(table);
  if (tableStr.includes("groupOrders") || tableStr.includes("group_orders"))
    return "groupOrders";
  if (tableStr.includes("groupMembers") || tableStr.includes("group_members"))
    return "groupMembers";
  if (
    tableStr.includes("groupCartItems") ||
    tableStr.includes("group_cart_items")
  )
    return "groupCartItems";
  if (tableStr.includes("splitBills") || tableStr.includes("split_bills"))
    return "splitBills";
  if (tableStr.includes("shareCodes") || tableStr.includes("share_codes"))
    return "shareCodes";
  if (
    tableStr.includes("groupActivityLogs") ||
    tableStr.includes("group_activity_logs")
  )
    return "groupActivityLogs";
  if (tableStr.includes("menuItems") || tableStr.includes("menu_items"))
    return "menuItems";
  if (tableStr.includes("users")) return "users";
  return "groupOrders";
};

/**
 * Extract conditions from drizzle operator results.
 * Drizzle's eq/and/inArray return SQL chunks - we intercept via vi.mock.
 */
interface Condition {
  field: string;
  op: string;
  value: any;
}

const extractConditions = (condition: any): Condition[] => {
  if (!condition) return [];
  if (condition._tag === "eq") {
    return [
      {
        field: resolveFieldName(condition._field),
        op: "eq",
        value: condition._value,
      },
    ];
  }
  if (condition._tag === "and") {
    const results: Condition[] = [];
    for (const c of condition._conditions) {
      results.push(...extractConditions(c));
    }
    return results;
  }
  if (condition._tag === "inArray") {
    return [
      {
        field: resolveFieldName(condition._field),
        op: "inArray",
        value: condition._values,
      },
    ];
  }
  if (condition._tag === "lt") {
    return [
      {
        field: resolveFieldName(condition._field),
        op: "lt",
        value: condition._value,
      },
    ];
  }
  return [];
};

const matchesConditions = (record: any, conditions: Condition[]): boolean => {
  for (const cond of conditions) {
    const val = record[cond.field];
    if (cond.op === "eq") {
      if (val !== cond.value) return false;
    } else if (cond.op === "inArray") {
      if (!cond.value.includes(val)) return false;
    } else if (cond.op === "lt") {
      // For dates, compare timestamps
      const recordVal = val instanceof Date ? val.getTime() : val;
      const condVal =
        cond.value instanceof Date ? cond.value.getTime() : cond.value;
      if (!(recordVal < condVal)) return false;
    }
  }
  return true;
};

const createMockDB = () => {
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

  /**
   * Detect if select fields contain table references (for wrapping results).
   * e.g., select({groupOrder: groupOrders, shareCodeUsageCount: shareCodes.usageCount})
   * In this case, we need to wrap the result as { groupOrder: <record>, shareCodeUsageCount: null, ... }
   */
  const detectFieldMapping = (fields: any): Record<string, string> | null => {
    if (!fields || typeof fields !== "object") return null;

    const mapping: Record<string, string> = {};
    let hasTableRef = false;

    for (const [key, value] of Object.entries(fields)) {
      if (value && typeof value === "object") {
        // Check if it's a drizzle table reference (has Symbol.for('drizzle:Name'))
        const field = value as {
          [key: symbol]: string | undefined;
          name?: string;
        };
        const drizzleName = field[Symbol.for("drizzle:Name")];
        if (drizzleName) {
          const tableMap: Record<string, string> = {
            group_orders: "groupOrders",
            group_members: "groupMembers",
            group_cart_items: "groupCartItems",
            split_bills: "splitBills",
            share_codes: "shareCodes",
            group_activity_logs: "groupActivityLogs",
            menu_items: "menuItems",
            users: "users",
          };
          mapping[key] = tableMap[drizzleName] || drizzleName;
          hasTableRef = true;
        } else if (field.name) {
          // It's a column reference like shareCodes.usageCount - map to null
          mapping[key] = "__column__";
        }
      }
    }

    return hasTableRef ? mapping : null;
  };

  const wrapResult = (
    record: any,
    fieldMapping: Record<string, string> | null,
  ): any => {
    if (!fieldMapping) return record;

    const result: any = {};
    for (const [key, tableOrColumn] of Object.entries(fieldMapping)) {
      if (tableOrColumn === "__column__") {
        result[key] = null; // Column references from joined tables default to null
      } else {
        result[key] = record; // Table reference wraps the full record
      }
    }
    return result;
  };

  const createQueryChain = (
    tableName: string,
    fieldMapping: Record<string, string> | null = null,
  ) => {
    let _conditions: Condition[] = [];

    const chain: any = {
      from: (table: any) => {
        tableName = getTableName(table);
        return chain;
      },
      leftJoin: (_table: any, _condition: any) => chain,
      innerJoin: (_table: any, _condition: any) => chain,
      where: (condition: any) => {
        _conditions = extractConditions(condition);
        return chain;
      },
      orderBy: (..._fields: any[]) => chain,
      get: async () => {
        const dataMap = mockData[tableName as keyof MockData];
        if (!dataMap || dataMap.size === 0) return null;

        if (_conditions.length > 0) {
          for (const record of dataMap.values()) {
            if (matchesConditions(record, _conditions)) {
              return wrapResult(record, fieldMapping);
            }
          }
          return null;
        }

        // No conditions - return first record
        for (const value of dataMap.values()) {
          return wrapResult(value, fieldMapping);
        }
        return null;
      },
      all: async () => {
        const dataMap = mockData[tableName as keyof MockData];
        if (!dataMap) return [];

        if (_conditions.length > 0) {
          const results: any[] = [];
          for (const record of dataMap.values()) {
            if (matchesConditions(record, _conditions)) {
              results.push(wrapResult(record, fieldMapping));
            }
          }
          return results;
        }

        return Array.from(dataMap.values()).map((r) =>
          wrapResult(r, fieldMapping),
        );
      },
    };

    return chain;
  };

  const createUpdateChain = (tableName: string) => {
    return {
      set: (data: any) => ({
        where: (condition: any) => ({
          run: async () => {
            const dataMap = mockData[tableName as keyof MockData];
            if (!dataMap) return { success: true, changes: 0 };

            const conditions = extractConditions(condition);
            let changes = 0;

            // Resolve data keys too (in case the service passes SQL-style keys through drizzle)
            // But actually the service uses .set({status: "checkout"}) with JS keys, so no mapping needed
            for (const [key, record] of dataMap.entries()) {
              if (
                conditions.length === 0 ||
                matchesConditions(record, conditions)
              ) {
                dataMap.set(key, { ...record, ...data });
                changes++;
              }
            }

            return { success: true, changes };
          },
        }),
      }),
    };
  };

  const db: any = {
    insert: (table: any) => {
      const tableName = getTableName(table);
      return {
        values: async (data: any) => {
          const id = data.id || crypto.randomUUID();
          const dataWithId = { ...data, id };
          mockData[tableName as keyof MockData].set(id, dataWithId);
          return { success: true };
        },
      };
    },
    select: (_fields?: any) =>
      createQueryChain("", detectFieldMapping(_fields)),
    update: (table: any) => createUpdateChain(getTableName(table)),
    delete: (table: any) => {
      const tableName = getTableName(table);
      return {
        where: (condition: any) => ({
          run: async () => {
            const dataMap = mockData[tableName as keyof MockData];
            if (dataMap) {
              const size = dataMap.size;
              dataMap.clear();
              return { success: true, changes: size };
            }
            return { success: true, changes: 0 };
          },
        }),
      };
    },
    transaction: async (callback: any) => callback(db),
    _mockData: mockData,
    _cleanup: () => {
      for (const key of Object.keys(mockData)) {
        mockData[key as keyof MockData].clear();
      }
    },
  };

  return db;
};

const createMockEnv = () =>
  envFactory.buildMinimal({
    CUSTOMER_APP_URL: "https://test.makanmasak.com",
  });

// ==========================================
// Mock drizzle-orm operators to return tagged objects
// ==========================================
vi.mock("drizzle-orm", async () => {
  const actual = (await vi.importActual("drizzle-orm")) as Record<
    string,
    unknown
  >;

  const getFieldName = (field: any): string => {
    // Drizzle column objects have a .name property (SQL column name)
    if (field && typeof field === "object" && "name" in field)
      return field.name;
    return String(field);
  };

  return {
    ...actual,
    eq: (field: any, value: any) => ({
      _tag: "eq",
      _field: getFieldName(field),
      _value: value,
    }),
    and: (...conditions: any[]) => ({
      _tag: "and",
      _conditions: conditions.filter(Boolean),
    }),
    inArray: (field: any, values: any[]) => ({
      _tag: "inArray",
      _field: getFieldName(field),
      _values: values,
    }),
    lt: (field: any, value: any) => ({
      _tag: "lt",
      _field: getFieldName(field),
      _value: value,
    }),
    desc: (field: any) => ({ _tag: "desc", _field: field }),
    asc: (field: any) => ({ _tag: "asc", _field: field }),
    sql: Object.assign(
      (strings: TemplateStringsArray, ..._values: any[]) => strings.join("?"),
      { raw: (s: string) => s },
    ),
    count: () => ({ _tag: "count" }),
  };
});

// ==========================================
// Test Suites
// ==========================================

describe("GroupOrderService", () => {
  let service: GroupOrderService;
  let mockDB: any;
  let mockEnv: any;

  beforeEach(() => {
    resetAllFactories();
    mockDB = createMockDB();
    mockEnv = createMockEnv();
    service = new GroupOrderService(mockDB, mockEnv);

    // Mock crypto.randomUUID
    let uuidCounter = 0;
    vi.stubGlobal("crypto", {
      randomUUID: () => {
        uuidCounter++;
        const hex = uuidCounter.toString(16).padStart(12, "0");
        return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-4000-8000-000000000000`;
      },
    });

    // Mock Math.random for share code generation
    let randomCallCount = 0;
    vi.spyOn(Math, "random").mockImplementation(() => {
      randomCallCount++;
      return (randomCallCount * 0.1) % 1;
    });
  });

  afterEach(() => {
    if (mockDB && mockDB._cleanup) {
      mockDB._cleanup();
    }
    vi.restoreAllMocks();
  });

  // ==========================================
  // 1. 群組訂單創建測試
  // ==========================================

  describe("創建群組訂單", () => {
    it("應該成功創建群組訂單", async () => {
      const orderData = {
        restaurantId: "R-001",
        tableId: 10,
        expirationHours: 2,
        maxMembers: 8,
      };

      const result = await service.createGroupOrder(orderData, 1);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.groupOrderId).toBeDefined();
      expect(result.data?.shareCode).toBeDefined();
      expect(result.data?.shareCode.length).toBe(6);
      expect(result.data?.shareUrl).toContain(result.data?.shareCode || "");
      expect(result.data?.qrCodeUrl).toContain(result.data?.shareCode || "");
    });

    it("應該生成唯一的6位分享碼", async () => {
      const result1 = await service.createGroupOrder(
        { restaurantId: "R-001" },
        1,
      );
      const result2 = await service.createGroupOrder(
        { restaurantId: "R-001" },
        1,
      );

      expect(result1.data?.shareCode).toBeDefined();
      expect(result2.data?.shareCode).toBeDefined();
      expect(result1.data?.shareCode).not.toBe(result2.data?.shareCode);
    });

    it("應該設置正確的過期時間", async () => {
      const expirationHours = 3;
      const result = await service.createGroupOrder(
        {
          restaurantId: "R-001",
          expirationHours,
        },
        1,
      );

      expect(result.success).toBe(true);

      const groupOrder = mockDB._mockData.groupOrders.get(
        result.data?.groupOrderId,
      );
      expect(groupOrder).toBeDefined();
      expect(groupOrder?.expiresAt).toBeDefined();
    });

    it("應該自動創建群組創建者成員記錄", async () => {
      const result = await service.createGroupOrder(
        { restaurantId: "R-001" },
        1,
      );

      expect(result.success).toBe(true);

      const members = Array.from(mockDB._mockData.groupMembers.values());
      const creator = (
        members as Array<{ role?: string; userId?: number }>
      ).find((m) => m.role === "creator");
      expect(creator).toBeDefined();
      expect(creator?.userId).toBe(1);
    });

    it("應該記錄分享碼到 shareCodes 表", async () => {
      const result = await service.createGroupOrder(
        { restaurantId: "R-001" },
        1,
      );

      expect(result.success).toBe(true);

      const shareCodeRecords = Array.from(mockDB._mockData.shareCodes.values());
      const shareCodeRecord = (
        shareCodeRecords as Array<{
          code?: string;
          type?: string;
          isActive?: boolean;
        }>
      ).find((s) => s.code === result.data?.shareCode);
      expect(shareCodeRecord).toBeDefined();
      expect(shareCodeRecord?.type).toBe("group_order");
      expect(shareCodeRecord?.isActive).toBe(true);
    });

    it("應該使用默認過期時間（24小時）", async () => {
      const result = await service.createGroupOrder(
        {
          restaurantId: "R-001",
        },
        1,
      );

      expect(result.success).toBe(true);

      const groupOrder = mockDB._mockData.groupOrders.get(
        result.data?.groupOrderId,
      );
      expect(groupOrder?.settings).toBeDefined();
    });
  });

  // ==========================================
  // 2. 加入群組測試
  // ==========================================

  describe("加入群組", () => {
    let testShareCode: string;
    let testGroupOrderId: string;

    beforeEach(async () => {
      const createResult = await service.createGroupOrder(
        {
          restaurantId: "R-001",
          maxMembers: 5,
        },
        1,
      );
      testShareCode = createResult.data!.shareCode;
      testGroupOrderId = createResult.data!.groupOrderId;
    });

    it("應該成功加入群組", async () => {
      const joinData = {
        memberName: "Alice",
        phone: "+1234567890",
        email: "alice@test.com",
      };

      const result = await service.joinGroup(testShareCode, joinData);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.memberId).toBeDefined();
      expect(result.data?.sessionId).toBeDefined();
      expect(result.data?.memberRole).toBe("member");
      expect(result.data?.groupOrder).toBeDefined();
    });

    it("應該拒絕無效的分享碼", async () => {
      const result = await service.joinGroup("INVALID", {
        memberName: "Bob",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("無效的分享代碼");
    });

    it("應該拒絕加入已過期的群組", async () => {
      // Modify the group order to be expired
      const groupOrder = mockDB._mockData.groupOrders.get(testGroupOrderId);
      groupOrder.expiresAt = new Date(Date.now() - 1000);
      mockDB._mockData.groupOrders.set(testGroupOrderId, groupOrder);

      const result = await service.joinGroup(testShareCode, {
        memberName: "Charlie",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("已過期");
    });

    it("應該防止重複加入（相同電話）", async () => {
      const phone = "+1111111111";

      // First join
      await service.joinGroup(testShareCode, {
        memberName: "David",
        phone,
      });

      // Second join with same phone
      const result = await service.joinGroup(testShareCode, {
        memberName: "David2",
        phone,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("已加入");
    });

    it("應該更新分享碼使用次數", async () => {
      await service.joinGroup(testShareCode, {
        memberName: "Eve",
      });

      const shareCodeRecords = Array.from(mockDB._mockData.shareCodes.values());
      const shareCodeRecord = shareCodeRecords.find(
        (s: any) => s.code === testShareCode,
      );

      expect(shareCodeRecord).toBeDefined();
    });

    it("應該記錄加入活動日誌", async () => {
      await service.joinGroup(testShareCode, {
        memberName: "Frank",
      });

      const logs = Array.from(mockDB._mockData.groupActivityLogs.values());
      const joinLog = logs.find(
        (log: any) =>
          log.action === "joined" && log.description.includes("Frank"),
      );
      expect(joinLog).toBeDefined();
    });

    it("應該只接受 1-50 字符的成員名稱", async () => {
      // Too short
      const result1 = await service.joinGroup(testShareCode, {
        memberName: "",
      });
      expect(result1.success).toBe(false);

      // Too long
      const result2 = await service.joinGroup(testShareCode, {
        memberName: "A".repeat(51),
      });
      expect(result2.success).toBe(false);
    });
  });

  // ==========================================
  // 3. 獲取群組資訊測試
  // ==========================================

  describe("獲取群組資訊", () => {
    let testGroupOrderId: string;

    beforeEach(async () => {
      const createResult = await service.createGroupOrder(
        {
          restaurantId: "R-001",
        },
        1,
      );
      testGroupOrderId = createResult.data!.groupOrderId;

      // Add test menu item
      mockDB._mockData.menuItems.set(1, {
        id: 1,
        name: "Test Burger",
        price: 10.99,
        isAvailable: true,
        restaurantId: "R-001",
      });

      // Add second member
      const memberData = {
        id: crypto.randomUUID(),
        groupOrderId: testGroupOrderId,
        name: "Test Member",
        role: "member",
        permissions: JSON.stringify({}),
        joinedAt: new Date(),
        lastActiveAt: new Date(),
        isActive: true,
      };
      mockDB._mockData.groupMembers.set(memberData.id, memberData);
    });

    it("應該成功獲取群組資訊", async () => {
      const result = await service.getGroupOrder(testGroupOrderId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.groupOrder).toBeDefined();
      expect(result.data?.members).toBeDefined();
      expect(result.data?.cartItems).toBeDefined();
      expect(result.data?.totalAmount).toBeDefined();
    });

    it("應該返回所有活躍成員", async () => {
      const result = await service.getGroupOrder(testGroupOrderId);

      expect(result.success).toBe(true);
      expect(result.data?.members).toBeDefined();
    });

    it("應該返回購物車項目（如果有）", async () => {
      const result = await service.getGroupOrder(testGroupOrderId);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data?.cartItems)).toBe(true);
    });

    it("應該正確計算總金額", async () => {
      const result = await service.getGroupOrder(testGroupOrderId);

      expect(result.success).toBe(true);
      expect(typeof result.data?.totalAmount).toBe("number");
      expect(result.data?.totalAmount).toBeGreaterThanOrEqual(0);
    });

    it("應該拒絕不存在的群組ID", async () => {
      const result = await service.getGroupOrder("non-existent-id");

      expect(result.success).toBe(false);
      expect(result.error).toContain("找不到");
    });
  });

  // ==========================================
  // 4. 添加購物車項目測試
  // ==========================================

  describe("添加購物車項目", () => {
    let testGroupOrderId: string;
    let testMemberId: string;

    beforeEach(async () => {
      const createResult = await service.createGroupOrder(
        {
          restaurantId: "R-001",
        },
        1,
      );
      testGroupOrderId = createResult.data!.groupOrderId;

      const members = Array.from(mockDB._mockData.groupMembers.values());
      testMemberId = (members[0] as { id: string }).id;

      // Add test menu item
      mockDB._mockData.menuItems.set(1, {
        id: 1,
        name: "Test Pizza",
        price: 15.99,
        isAvailable: true,
        restaurantId: "R-001",
      });
    });

    it("應該成功添加購物車項目", async () => {
      const itemData = {
        memberId: testMemberId,
        menuItemId: 1,
        quantity: 2,
        customizations: { size: "large", extra_cheese: true },
        specialInstructions: "Extra crispy",
      };

      const result = await service.addCartItem(testGroupOrderId, itemData);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.menuItemId).toBe(1);
      expect(result.data?.quantity).toBe(2);
      expect(result.data?.unitPrice).toBeGreaterThan(0);
      expect(result.data?.totalPrice).toBeGreaterThan(0);
    });

    it("應該正確計算項目總價", async () => {
      const itemData = {
        memberId: testMemberId,
        menuItemId: 1,
        quantity: 3,
      };

      const result = await service.addCartItem(testGroupOrderId, itemData);

      expect(result.success).toBe(true);
      expect(result.data?.totalPrice).toBe(15.99 * 3);
    });

    it("應該拒絕無效的成員ID", async () => {
      const result = await service.addCartItem(testGroupOrderId, {
        memberId: "invalid-member-id",
        menuItemId: 1,
        quantity: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("無效的成員");
    });

    it("應該拒絕不可用的菜品", async () => {
      mockDB._mockData.menuItems.set(999, {
        id: 999,
        name: "Unavailable Item",
        price: 10,
        isAvailable: false,
        restaurantId: "R-001",
      });

      const result = await service.addCartItem(testGroupOrderId, {
        memberId: testMemberId,
        menuItemId: 999,
        quantity: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("不存在或不可用");
    });

    it("應該記錄添加項目的活動日誌", async () => {
      await service.addCartItem(testGroupOrderId, {
        memberId: testMemberId,
        menuItemId: 1,
        quantity: 1,
      });

      const logs = Array.from(mockDB._mockData.groupActivityLogs.values());
      const addLog = logs.find((log: any) => log.action === "added_item");
      expect(addLog).toBeDefined();
    });

    it("應該拒絕負數或零數量", async () => {
      const result = await service.addCartItem(testGroupOrderId, {
        memberId: testMemberId,
        menuItemId: 1,
        quantity: 0,
      });

      expect(result.success).toBe(false);
    });
  });

  // ==========================================
  // 5. 帳單分攤測試
  // ==========================================

  describe("初始化分帳", () => {
    let testGroupOrderId: string;
    let testCreatorId: string;

    beforeEach(async () => {
      const createResult = await service.createGroupOrder(
        {
          restaurantId: "R-001",
        },
        1,
      );
      testGroupOrderId = createResult.data!.groupOrderId;

      const members = Array.from(mockDB._mockData.groupMembers.values());
      testCreatorId = (members[0] as { id: string }).id;

      // Add test menu item
      mockDB._mockData.menuItems.set(1, {
        id: 1,
        name: "Test Item",
        price: 10,
        isAvailable: true,
      });

      // Add cart item
      const cartItem = {
        id: crypto.randomUUID(),
        groupOrderId: testGroupOrderId,
        memberId: testCreatorId,
        menuItemId: 1,
        quantity: 2,
        unitPrice: 10,
        totalPrice: 20,
        customizations: JSON.stringify({}),
        status: "active",
        addedAt: new Date(),
        updatedAt: new Date(),
      };
      mockDB._mockData.groupCartItems.set(cartItem.id, cartItem);
    });

    it("應該成功初始化平均分帳", async () => {
      const result = await service.initiateSplit(
        testGroupOrderId,
        { splitType: "equal" },
        testCreatorId,
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data!.length).toBeGreaterThan(0);
    });

    it("應該成功初始化個人項目分帳", async () => {
      const result = await service.initiateSplit(
        testGroupOrderId,
        { splitType: "individual" },
        testCreatorId,
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it("應該鎖定群組訂單狀態", async () => {
      await service.initiateSplit(
        testGroupOrderId,
        { splitType: "equal" },
        testCreatorId,
      );

      const groupOrder = mockDB._mockData.groupOrders.get(testGroupOrderId);
      expect(groupOrder?.status).toBe("checkout");
    });

    it("應該拒絕非創建者/管理員執行分帳", async () => {
      // Add a regular member
      const memberData = {
        id: crypto.randomUUID(),
        groupOrderId: testGroupOrderId,
        role: "member",
        isActive: true,
      };
      mockDB._mockData.groupMembers.set(memberData.id, memberData);

      const result = await service.initiateSplit(
        testGroupOrderId,
        { splitType: "equal" },
        memberData.id,
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("沒有權限");
    });

    it("平均分帳應該正確計算每人金額", async () => {
      const result = await service.initiateSplit(
        testGroupOrderId,
        { splitType: "equal" },
        testCreatorId,
      );

      expect(result.success).toBe(true);

      const totalAmount = 20; // From cart item
      const memberCount = mockDB._mockData.groupMembers.size;
      const perPersonAmount = totalAmount / memberCount;

      result.data?.forEach((bill) => {
        expect(bill.subtotal).toBeCloseTo(perPersonAmount, 2);
      });
    });
  });

  // ==========================================
  // 6. 支付處理測試
  // ==========================================

  describe("處理支付", () => {
    let testGroupOrderId: string;
    let testMemberId: string;
    let testSplitBillId: string;

    beforeEach(async () => {
      const createResult = await service.createGroupOrder(
        {
          restaurantId: "R-001",
        },
        1,
      );
      testGroupOrderId = createResult.data!.groupOrderId;

      const members = Array.from(mockDB._mockData.groupMembers.values());
      testMemberId = (members[0] as { id: string }).id;

      // Create pending split bill
      testSplitBillId = crypto.randomUUID();
      const splitBillData = {
        id: testSplitBillId,
        groupOrderId: testGroupOrderId,
        memberId: testMemberId,
        totalAmount: 50,
        paymentStatus: "pending",
        items: JSON.stringify([]),
        subtotal: 50,
        taxAmount: 0,
        serviceCharge: 0,
        discountAmount: 0,
        tipAmount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDB._mockData.splitBills.set(testSplitBillId, splitBillData);
    });

    it("應該成功處理支付", async () => {
      const paymentData = {
        paymentMethod: "credit_card",
        transactionId: "txn_12345",
      };

      const result = await service.processPayment(
        testGroupOrderId,
        testMemberId,
        paymentData,
      );

      expect(result.success).toBe(true);
    });

    it("應該更新支付狀態為已付款", async () => {
      await service.processPayment(testGroupOrderId, testMemberId, {
        paymentMethod: "cash",
      });

      const splitBill = mockDB._mockData.splitBills.get(testSplitBillId);
      expect(splitBill?.paymentStatus).toBe("paid");
    });

    it("應該記錄支付方法", async () => {
      const paymentMethod = "alipay";
      await service.processPayment(testGroupOrderId, testMemberId, {
        paymentMethod,
      });

      const splitBill = mockDB._mockData.splitBills.get(testSplitBillId);
      expect(splitBill?.paymentMethod).toBe(paymentMethod);
    });

    it("應該拒絕找不到的分帳記錄", async () => {
      const result = await service.processPayment(
        testGroupOrderId,
        "non-existent-member",
        { paymentMethod: "cash" },
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("找不到");
    });
  });

  // ==========================================
  // 7. 離開群組測試
  // ==========================================

  describe("離開群組", () => {
    let testGroupOrderId: string;
    let testMemberId: string;
    let testCreatorId: string;

    beforeEach(async () => {
      const createResult = await service.createGroupOrder(
        {
          restaurantId: "R-001",
        },
        1,
      );
      testGroupOrderId = createResult.data!.groupOrderId;

      const members = Array.from(mockDB._mockData.groupMembers.values());
      testCreatorId = (members[0] as { id: string }).id;

      // Add regular member
      const memberData = {
        id: crypto.randomUUID(),
        groupOrderId: testGroupOrderId,
        role: "member",
        isActive: true,
        name: "Test Member",
      };
      mockDB._mockData.groupMembers.set(memberData.id, memberData);
      testMemberId = memberData.id;
    });

    it("應該成功離開群組（普通成員）", async () => {
      const result = await service.leaveGroup(testGroupOrderId, testMemberId);

      expect(result.success).toBe(true);
    });

    it("應該拒絕創建者離開群組", async () => {
      const result = await service.leaveGroup(testGroupOrderId, testCreatorId);

      expect(result.success).toBe(false);
      expect(result.error).toContain("創建者無法離開");
    });

    it("應該將成員標記為非活躍", async () => {
      await service.leaveGroup(testGroupOrderId, testMemberId);

      const member = mockDB._mockData.groupMembers.get(testMemberId);
      expect(member?.isActive).toBe(false);
      expect(member?.leftAt).toBeDefined();
    });

    it("應該移除該成員的購物車項目", async () => {
      // Add cart item for this member
      const cartItem = {
        id: crypto.randomUUID(),
        groupOrderId: testGroupOrderId,
        memberId: testMemberId,
        menuItemId: 1,
        quantity: 1,
        totalPrice: 10,
        status: "active",
      };
      mockDB._mockData.groupCartItems.set(cartItem.id, cartItem);

      await service.leaveGroup(testGroupOrderId, testMemberId);

      const item = mockDB._mockData.groupCartItems.get(cartItem.id);
      expect(item?.status).toBe("removed");
    });
  });

  // ==========================================
  // 8. 清理過期群組測試
  // ==========================================

  describe("清理過期群組", () => {
    it("應該清理過期的群組訂單", async () => {
      const expiredGroupId = crypto.randomUUID();
      const expiredGroup = {
        id: expiredGroupId,
        shareCode: "EXP001",
        status: "active",
        expiresAt: new Date(Date.now() - 1000),
        createdBy: 1,
        restaurantId: "R-001",
        totalAmount: 0,
        taxAmount: 0,
        serviceCharge: 0,
        finalAmount: 0,
        splitType: "individual",
        settings: JSON.stringify({}),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockDB._mockData.groupOrders.set(expiredGroupId, expiredGroup);

      const result = await service.cleanupExpiredGroups();

      expect(result.success).toBe(true);
      expect(result.cleaned).toBeGreaterThanOrEqual(0);
    });

    it("應該將過期群組狀態改為取消", async () => {
      const expiredGroupId = crypto.randomUUID();
      const expiredGroup = {
        id: expiredGroupId,
        status: "active",
        expiresAt: new Date(Date.now() - 1000),
      };
      mockDB._mockData.groupOrders.set(expiredGroupId, expiredGroup);

      await service.cleanupExpiredGroups();

      const group = mockDB._mockData.groupOrders.get(expiredGroupId);
      expect(group?.status).toBe("cancelled");
    });

    it("應該返回清理的群組數量", async () => {
      const result = await service.cleanupExpiredGroups();

      expect(result.success).toBe(true);
      expect(typeof result.cleaned).toBe("number");
    });
  });

  // ==========================================
  // 9. 錯誤處理測試
  // ==========================================

  describe("錯誤處理", () => {
    it("應該處理數據庫錯誤", async () => {
      const errorDB = {
        insert: () => {
          throw new Error("Database connection failed");
        },
        select: () => ({
          from: () => ({
            where: () => ({
              get: async () => {
                throw new Error("Query failed");
              },
            }),
          }),
        }),
      };

      const errorService = new GroupOrderService(errorDB, mockEnv);
      const result = await errorService.createGroupOrder(
        {
          restaurantId: "R-001",
        },
        1,
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("應該處理無效的輸入數據", async () => {
      const result = await service.createGroupOrder(
        {
          restaurantId: "R-INVALID",
          maxMembers: 100, // Exceeds limit (max 20)
        },
        1,
      );

      expect(result.success).toBe(false);
    });
  });

  // ==========================================
  // 10. 併發處理測試
  // ==========================================

  describe("併發處理", () => {
    it("應該處理多個成員同時加入", async () => {
      const createResult = await service.createGroupOrder(
        {
          restaurantId: "R-001",
          maxMembers: 10,
        },
        1,
      );
      const shareCode = createResult.data!.shareCode;

      const promises = [
        service.joinGroup(shareCode, { memberName: "User1" }),
        service.joinGroup(shareCode, { memberName: "User2" }),
        service.joinGroup(shareCode, { memberName: "User3" }),
      ];

      const results = await Promise.all(promises);
      const successCount = results.filter((r) => r.success).length;

      expect(successCount).toBeGreaterThan(0);
    });
  });
});
