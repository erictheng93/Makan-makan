/**
 * 測試模擬數據工具
 * 用於生成測試所需的群組訂單相關數據
 */

import type {
  GroupOrderState,
  GroupOrderMember,
  GroupOrderCartItem,
  GroupOrderSplitBill,
} from "@/composables/useRealtimeGroupOrders";

// 創建模擬群組訂單
export function createMockGroupOrder(
  id?: string,
  options: Partial<GroupOrderState> = {},
): GroupOrderState {
  const now = Date.now();

  return {
    id: id || `group-${Date.now()}`,
    shareCode:
      options.shareCode ||
      `PARTY-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
    status: options.status || "active",
    restaurantId: options.restaurantId || '1',
    members: options.members || [
      createMockMember("member-1", "群組創建者", "creator"),
      createMockMember("member-2", "成員A"),
      createMockMember("member-3", "成員B"),
    ],
    cart: options.cart || [
      createMockCartItem("item-1", "member-1"),
      createMockCartItem("item-2", "member-2"),
      createMockCartItem("item-3", "member-3"),
    ],
    splitBills: options.splitBills || [],
    host: options.host || createMockMember("member-1", "群組創建者", "creator"),
    settings: options.settings || {
      maxMembers: 10,
      allowEditOthers: false,
      splitType: "proportional",
    },
    totalAmount: options.totalAmount || 156.8,
    lastActivity: options.lastActivity || now,
    createdAt: options.createdAt || now - 3600000, // 1小時前
    expiresAt: options.expiresAt || now + 7200000, // 2小時後
    ...options,
  };
}

// 創建模擬群組成員
export function createMockMember(
  id?: string,
  name?: string,
  role: GroupOrderMember["role"] = "member",
  options: Partial<GroupOrderMember> = {},
): GroupOrderMember {
  const now = Date.now();

  return {
    id: id || `member-${Date.now()}`,
    sessionId:
      options.sessionId || `session-${Math.random().toString(36).substr(2, 8)}`,
    name: name || `測試用戶${Math.floor(Math.random() * 100)}`,
    phone:
      options.phone ||
      `09${Math.floor(Math.random() * 100000000)
        .toString()
        .padStart(8, "0")}`,
    role,
    joinedAt: options.joinedAt || now - Math.floor(Math.random() * 3600000),
    lastActiveAt: options.lastActiveAt || now,
    isOnline: options.isOnline !== undefined ? options.isOnline : true,
    totalAmount: options.totalAmount || Math.floor(Math.random() * 100) + 20,
    itemCount: options.itemCount || Math.floor(Math.random() * 5) + 1,
    paymentStatus: options.paymentStatus || "unpaid",
    ...options,
  };
}

// 創建模擬購物車項目
export function createMockCartItem(
  id?: string,
  memberId?: string,
  options: Partial<GroupOrderCartItem> = {},
): GroupOrderCartItem {
  const menuItems = [
    "招牌牛肉麵",
    "蒸餃",
    "炸醬麵",
    "酸辣湯",
    "宮保雞丁",
    "麻婆豆腐",
    "糖醋排骨",
    "回鍋肉",
    "青椒肉絲",
    "番茄炒蛋",
  ];

  const now = Date.now();
  const quantity = options.quantity || Math.floor(Math.random() * 3) + 1;
  const unitPrice = options.unitPrice || Math.floor(Math.random() * 50) + 15;

  return {
    id: id || `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    memberId: memberId || "member-1",
    menuItemId: options.menuItemId || Math.floor(Math.random() * 1000) + 1,
    menuItemName:
      options.menuItemName ||
      menuItems[Math.floor(Math.random() * menuItems.length)],
    quantity,
    unitPrice,
    totalPrice: options.totalPrice || quantity * unitPrice,
    customizations: options.customizations || {
      spicy: ["不辣", "微辣", "小辣", "中辣", "大辣"][
        Math.floor(Math.random() * 5)
      ],
      size: ["小份", "正常", "大份"][Math.floor(Math.random() * 3)],
    },
    specialInstructions:
      options.specialInstructions ||
      (Math.random() > 0.7 ? "請不要加蔥" : undefined),
    addedAt: options.addedAt || now - Math.floor(Math.random() * 1800000),
    updatedAt: options.updatedAt || now,
    version: options.version || 1,
    ...options,
  };
}

// 創建模擬分帳記錄
export function createMockSplitBill(
  id?: string,
  memberId?: string,
  options: Partial<GroupOrderSplitBill> = {},
): GroupOrderSplitBill {
  const subtotal = options.subtotal || Math.floor(Math.random() * 80) + 30;
  const taxRate = 0.06;
  const serviceChargeRate = 0.1;

  const taxAmount =
    options.taxAmount || Math.round(subtotal * taxRate * 100) / 100;
  const serviceCharge =
    options.serviceCharge ||
    Math.round(subtotal * serviceChargeRate * 100) / 100;
  const totalAmount =
    options.totalAmount ||
    Math.round((subtotal + taxAmount + serviceCharge) * 100) / 100;

  return {
    id: id || `split-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    memberId: memberId || "member-1",
    subtotal,
    taxAmount,
    serviceCharge,
    totalAmount,
    items: options.items || [`item-${Math.random().toString(36).substr(2, 4)}`],
    paymentStatus: options.paymentStatus || "pending",
    paymentMethod: options.paymentMethod,
    paidAt: options.paidAt,
    ...options,
  };
}

// 創建模擬訂單操作
export function createMockOperation(
  type: "add" | "update" | "remove" = "add",
  entity: "member" | "cart_item" | "split_bill" | "group_setting" = "cart_item",
  options: any = {},
) {
  const entityIds = {
    member: "member-1",
    cart_item: "item-1",
    split_bill: "split-1",
    group_setting: "settings",
  };

  return {
    id: crypto.randomUUID(),
    type,
    entity,
    entityId: options.entityId || entityIds[entity],
    data: options.data || getMockDataForEntity(entity, type),
    timestamp: Date.now(),
    userId: options.userId || "user-1",
    version: options.version || 1,
    checksum: "mock-checksum",
  };
}

// 根據實體類型生成模擬數據
function getMockDataForEntity(entity: string, operation: string) {
  switch (entity) {
    case "member":
      if (operation === "add") {
        return createMockMember();
      } else if (operation === "update") {
        return { name: "更新的用戶名", isOnline: false };
      }
      break;

    case "cart_item":
      if (operation === "add") {
        return createMockCartItem();
      } else if (operation === "update") {
        return { quantity: 3, customizations: { spicy: "hot" } };
      }
      break;

    case "split_bill":
      if (operation === "add") {
        return createMockSplitBill();
      } else if (operation === "update") {
        return { paymentStatus: "paid", paidAt: Date.now() };
      }
      break;

    case "group_setting":
      if (operation === "update") {
        return { maxMembers: 15, allowEditOthers: true };
      }
      break;
  }

  return {};
}

// 創建模擬協作動作
export function createMockCollaborativeAction(
  type: "typing" | "selecting" | "editing" | "viewing" | "idle" = "editing",
  entityType: string = "cart_item",
  options: any = {},
) {
  return {
    id: crypto.randomUUID(),
    type,
    entityType,
    entityId: options.entityId || "item-1",
    userId: options.userId || "user-1",
    userName: options.userName || "測試用戶",
    data: options.data || { changes: { quantity: 2 } },
    timestamp: Date.now(),
  };
}

// 創建模擬錯誤
export function createMockError(
  type:
    | "connection"
    | "sync"
    | "permission"
    | "data"
    | "network"
    | "server"
    | "client" = "connection",
  severity: "low" | "medium" | "high" | "critical" = "medium",
  options: any = {},
) {
  return {
    id: crypto.randomUUID(),
    type,
    severity,
    message: options.message || `Mock ${type} error`,
    details: options.details || { mockError: true },
    timestamp: Date.now(),
    groupOrderId: options.groupOrderId,
    userId: options.userId,
    recovered: false,
    recoveryAttempts: 0,
  };
}

// 創建模擬衝突警報
export function createMockConflictAlert(
  type:
    | "edit_conflict"
    | "permission_conflict"
    | "version_conflict" = "edit_conflict",
  options: any = {},
) {
  return {
    id: crypto.randomUUID(),
    type,
    message: options.message || `Mock ${type}`,
    entities: options.entities || ["cart_item:item-1"],
    users: options.users || ["user-1", "user-2"],
    suggestedActions: options.suggestedActions || [
      "Communicate with other editors",
      "Take turns editing",
    ],
    timestamp: Date.now(),
    severity: options.severity || "medium",
  };
}

// 創建批量測試數據
export function createBulkMockData(
  count: number,
  type: "members" | "cartItems" | "splitBills",
) {
  const results = [];

  for (let i = 0; i < count; i++) {
    switch (type) {
      case "members":
        results.push(createMockMember(`member-${i}`, `測試用戶${i}`));
        break;
      case "cartItems":
        results.push(createMockCartItem(`item-${i}`, `member-${i % 3}`));
        break;
      case "splitBills":
        results.push(createMockSplitBill(`split-${i}`, `member-${i}`));
        break;
    }
  }

  return results;
}

// 創建具有特定狀態的群組訂單
export function createMockGroupOrderWithStatus(
  status: GroupOrderState["status"],
) {
  const groupOrder = createMockGroupOrder();
  groupOrder.status = status;

  // 根據狀態調整數據
  switch (status) {
    case "checkout":
      // 添加分帳記錄
      groupOrder.splitBills = groupOrder.members.map((member) =>
        createMockSplitBill(undefined, member.id),
      );
      break;

    case "completed":
      // 所有成員已付款
      groupOrder.members.forEach((member) => {
        member.paymentStatus = "paid";
      });
      groupOrder.splitBills = groupOrder.members.map((member) =>
        createMockSplitBill(undefined, member.id, {
          paymentStatus: "paid",
          paidAt: Date.now(),
        }),
      );
      break;

    case "cancelled":
      // 清空購物車
      groupOrder.cart = [];
      groupOrder.totalAmount = 0;
      break;
  }

  return groupOrder;
}

// 預定義的測試場景數據
export const mockScenarios = {
  // 小型群組
  smallGroup: () =>
    createMockGroupOrder("small-group", {
      members: createBulkMockData(3, "members") as GroupOrderMember[],
      cart: createBulkMockData(5, "cartItems") as GroupOrderCartItem[],
    }),

  // 大型群組
  largeGroup: () =>
    createMockGroupOrder("large-group", {
      members: createBulkMockData(10, "members") as GroupOrderMember[],
      cart: createBulkMockData(25, "cartItems") as GroupOrderCartItem[],
    }),

  // 準備分帳的群組
  readyForSplit: () => createMockGroupOrderWithStatus("checkout"),

  // 已完成的群組
  completedGroup: () => createMockGroupOrderWithStatus("completed"),

  // 已取消的群組
  cancelledGroup: () => createMockGroupOrderWithStatus("cancelled"),
};

export default {
  createMockGroupOrder,
  createMockMember,
  createMockCartItem,
  createMockSplitBill,
  createMockOperation,
  createMockCollaborativeAction,
  createMockError,
  createMockConflictAlert,
  createBulkMockData,
  createMockGroupOrderWithStatus,
  mockScenarios,
};
