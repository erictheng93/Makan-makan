/**
 * Group Order System Schema
 *
 * Tables:
 * - group_orders: 群組訂單管理
 * - group_members: 群組成員管理
 * - group_cart_items: 群組購物車項目
 * - split_bills: 分帳管理
 * - share_codes: 分享代碼管理
 * - group_activity_logs: 群組活動日誌
 */

import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { restaurants } from "./restaurants";
import { users } from "./users";
import { tables } from "./tables";
import { menuItems } from "./menu-items";
import type {
  GroupOrderSettings,
  GroupMemberPermissions,
  CartItemCustomizations,
  SplitBillItem,
  ShareCodeMetadata,
  GroupActivityMetadata,
} from "@makanmakan/shared-types";

// ==========================================
// 群組訂單表 (Group Orders)
// ==========================================

export const groupOrders = sqliteTable(
  "group_orders",
  {
    id: text("id").primaryKey(), // UUID
    shareCode: text("share_code").notNull().unique(),
    masterOrderId: integer("master_order_id"), // 關聯到主訂單（最終下單時創建）
    createdBy: integer("created_by")
      .notNull()
      .references(() => users.id),
    restaurantId: text("restaurant_id").notNull(), // 引用 restaurants.public_id (TEXT)
    tableId: integer("table_id").references(() => tables.id),

    // 訂單狀態
    status: text("status").notNull().default("active"), // active, ordering, checkout, completed, cancelled
    splitType: text("split_type").notNull().default("individual"), // equal, proportional, individual, custom

    // 金額資訊
    totalAmount: real("total_amount").notNull().default(0),
    taxAmount: real("tax_amount").notNull().default(0),
    serviceCharge: real("service_charge").notNull().default(0),
    finalAmount: real("final_amount").notNull().default(0),

    // 時間資訊
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    lockedAt: integer("locked_at", { mode: "timestamp" }),
    completedAt: integer("completed_at", { mode: "timestamp" }),

    // 設定與備註
    settings: text("settings", { mode: "json" })
      .$type<GroupOrderSettings>()
      .notNull()
      .default({}),
    notes: text("notes"),

    // 時間戳
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    restaurantStatusIdx: index("idx_group_orders_restaurant_status").on(
      table.restaurantId,
      table.status,
    ),
    statusCreatedIdx: index("idx_group_orders_status_created").on(
      table.status,
      table.createdAt,
    ),
    tableIdx: index("idx_group_orders_table").on(table.tableId),
    expiresIdx: index("idx_group_orders_expires").on(table.expiresAt),
  }),
);

// ==========================================
// 群組成員表 (Group Members)
// ==========================================

export const groupMembers = sqliteTable(
  "group_members",
  {
    id: text("id").primaryKey(), // UUID
    groupOrderId: text("group_order_id")
      .notNull()
      .references(() => groupOrders.id),
    userId: integer("user_id").references(() => users.id), // 關聯到註冊用戶（可選）
    sessionId: text("session_id").notNull(), // 用於匿名用戶識別

    // 成員資訊
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    avatarUrl: text("avatar_url"),

    // 角色與權限
    role: text("role").notNull().default("member"), // creator, admin, member
    permissions: text("permissions", { mode: "json" })
      .$type<GroupMemberPermissions>()
      .notNull()
      .default({}),

    // 狀態與時間
    joinedAt: integer("joined_at", { mode: "timestamp" }).notNull(),
    lastActiveAt: integer("last_active_at", { mode: "timestamp" }).notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    leftAt: integer("left_at", { mode: "timestamp" }),
  },
  (table) => ({
    groupOrderIdx: index("idx_group_members_group_order").on(
      table.groupOrderId,
    ),
    sessionIdx: index("idx_group_members_session").on(table.sessionId),
    userIdx: index("idx_group_members_user").on(table.userId),
    activeIdx: index("idx_group_members_active").on(
      table.groupOrderId,
      table.isActive,
    ),
  }),
);

// ==========================================
// 群組購物車項目表 (Group Cart Items)
// ==========================================

export const groupCartItems = sqliteTable(
  "group_cart_items",
  {
    id: text("id").primaryKey(), // UUID
    groupOrderId: text("group_order_id")
      .notNull()
      .references(() => groupOrders.id),
    memberId: text("member_id")
      .notNull()
      .references(() => groupMembers.id),
    menuItemId: integer("menu_item_id")
      .notNull()
      .references(() => menuItems.id),

    // 數量與價格
    quantity: integer("quantity").notNull(),
    unitPrice: real("unit_price").notNull(),
    totalPrice: real("total_price").notNull(),

    // 客製化
    customizations: text("customizations", { mode: "json" })
      .$type<CartItemCustomizations>()
      .notNull()
      .default({}),
    specialInstructions: text("special_instructions"),

    // 狀態
    status: text("status").notNull().default("active"), // active, removed, ordered

    // 時間戳
    addedAt: integer("added_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    groupOrderIdx: index("idx_group_cart_items_group_order").on(
      table.groupOrderId,
    ),
    memberIdx: index("idx_group_cart_items_member").on(table.memberId),
    statusIdx: index("idx_group_cart_items_status").on(
      table.groupOrderId,
      table.status,
    ),
  }),
);

// ==========================================
// 分帳表 (Split Bills)
// ==========================================

export const splitBills = sqliteTable(
  "split_bills",
  {
    id: text("id").primaryKey(), // UUID
    groupOrderId: text("group_order_id")
      .notNull()
      .references(() => groupOrders.id),
    memberId: text("member_id")
      .notNull()
      .references(() => groupMembers.id),

    // 金額細分
    subtotal: real("subtotal").notNull(),
    taxAmount: real("tax_amount").notNull().default(0),
    serviceCharge: real("service_charge").notNull().default(0),
    discountAmount: real("discount_amount").notNull().default(0),
    tipAmount: real("tip_amount").notNull().default(0),
    totalAmount: real("total_amount").notNull(),

    // 項目清單
    items: text("items", { mode: "json" })
      .$type<SplitBillItem[]>()
      .notNull()
      .default([]),

    // 支付資訊
    paymentStatus: text("payment_status").notNull().default("pending"), // pending, processing, paid, failed, refunded
    paymentMethod: text("payment_method"),
    paymentReference: text("payment_reference"),
    paidAt: integer("paid_at", { mode: "timestamp" }),

    // 時間戳
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    groupOrderIdx: index("idx_split_bills_group_order").on(table.groupOrderId),
    memberIdx: index("idx_split_bills_member").on(table.memberId),
    paymentStatusIdx: index("idx_split_bills_payment_status").on(
      table.groupOrderId,
      table.paymentStatus,
    ),
  }),
);

// ==========================================
// 分享代碼表 (Share Codes)
// ==========================================

export const shareCodes = sqliteTable(
  "share_codes",
  {
    id: text("id").primaryKey(), // UUID
    code: text("code").notNull().unique(),
    type: text("type").notNull(), // group_order, table, event, etc.
    resourceId: text("resource_id").notNull(), // 關聯的資源ID

    // 創建者與過期時間
    createdBy: integer("created_by")
      .notNull()
      .references(() => users.id),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),

    // 使用統計
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    usageCount: integer("usage_count").notNull().default(0),
    usageLimit: integer("usage_limit"), // NULL = 無限制

    // 額外資訊
    metadata: text("metadata", { mode: "json" })
      .$type<ShareCodeMetadata>()
      .notNull()
      .default({}),

    // 時間戳
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    typeResourceIdx: index("idx_share_codes_type_resource").on(
      table.type,
      table.resourceId,
    ),
    activeExpiresIdx: index("idx_share_codes_active_expires").on(
      table.isActive,
      table.expiresAt,
    ),
  }),
);

// ==========================================
// 群組活動日誌表 (Group Activity Logs)
// ==========================================

export const groupActivityLogs = sqliteTable(
  "group_activity_logs",
  {
    id: text("id").primaryKey(), // UUID
    groupOrderId: text("group_order_id")
      .notNull()
      .references(() => groupOrders.id),
    memberId: text("member_id").references(() => groupMembers.id), // 可選：系統操作時為 NULL

    // 活動資訊
    action: text("action").notNull(), // joined, added_item, removed_item, split_initiated, payment_completed, etc.
    description: text("description").notNull(),
    metadata: text("metadata", { mode: "json" })
      .$type<GroupActivityMetadata>()
      .notNull()
      .default({}),

    // 時間戳
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    groupOrderIdx: index("idx_group_activity_logs_group_order").on(
      table.groupOrderId,
    ),
    actionIdx: index("idx_group_activity_logs_action").on(
      table.groupOrderId,
      table.action,
    ),
    createdAtIdx: index("idx_group_activity_logs_created").on(table.createdAt),
  }),
);

// ==========================================
// Relations 定義
// ==========================================

export const groupOrdersRelations = relations(groupOrders, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [groupOrders.restaurantId],
    references: [restaurants.id],
  }),
  table: one(tables, {
    fields: [groupOrders.tableId],
    references: [tables.id],
  }),
  creator: one(users, {
    fields: [groupOrders.createdBy],
    references: [users.id],
  }),
  members: many(groupMembers),
  cartItems: many(groupCartItems),
  splitBills: many(splitBills),
  activityLogs: many(groupActivityLogs),
}));

export const groupMembersRelations = relations(
  groupMembers,
  ({ one, many }) => ({
    groupOrder: one(groupOrders, {
      fields: [groupMembers.groupOrderId],
      references: [groupOrders.id],
    }),
    user: one(users, {
      fields: [groupMembers.userId],
      references: [users.id],
    }),
    cartItems: many(groupCartItems),
    splitBills: many(splitBills),
    activityLogs: many(groupActivityLogs),
  }),
);

export const groupCartItemsRelations = relations(groupCartItems, ({ one }) => ({
  groupOrder: one(groupOrders, {
    fields: [groupCartItems.groupOrderId],
    references: [groupOrders.id],
  }),
  member: one(groupMembers, {
    fields: [groupCartItems.memberId],
    references: [groupMembers.id],
  }),
  menuItem: one(menuItems, {
    fields: [groupCartItems.menuItemId],
    references: [menuItems.id],
  }),
}));

export const splitBillsRelations = relations(splitBills, ({ one }) => ({
  groupOrder: one(groupOrders, {
    fields: [splitBills.groupOrderId],
    references: [groupOrders.id],
  }),
  member: one(groupMembers, {
    fields: [splitBills.memberId],
    references: [groupMembers.id],
  }),
}));

export const shareCodesRelations = relations(shareCodes, ({ one }) => ({
  creator: one(users, {
    fields: [shareCodes.createdBy],
    references: [users.id],
  }),
}));

export const groupActivityLogsRelations = relations(
  groupActivityLogs,
  ({ one }) => ({
    groupOrder: one(groupOrders, {
      fields: [groupActivityLogs.groupOrderId],
      references: [groupOrders.id],
    }),
    member: one(groupMembers, {
      fields: [groupActivityLogs.memberId],
      references: [groupMembers.id],
    }),
  }),
);
