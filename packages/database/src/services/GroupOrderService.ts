import { z } from "zod";
import { eq, and, lt, inArray, desc, sql, count } from "drizzle-orm";
import { BaseService, CloudflareEnv } from "./base";
import {
  groupOrders,
  groupMembers,
  groupCartItems,
  splitBills,
  shareCodes,
  groupActivityLogs,
  menuItems,
  users,
} from "../schema";

// 類型定義
export interface GroupOrder {
  id: string;
  shareCode: string;
  masterOrderId?: number;
  createdBy: number;
  restaurantId: string;
  tableId?: number;
  status: "active" | "ordering" | "checkout" | "completed" | "cancelled";
  splitType: "equal" | "proportional" | "individual" | "custom";
  totalAmount: number;
  taxAmount: number;
  serviceCharge: number;
  finalAmount: number;
  expiresAt: Date;
  lockedAt?: Date;
  completedAt?: Date;
  settings: Record<string, any>;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupMember {
  id: string;
  groupOrderId: string;
  userId?: number;
  sessionId: string;
  name: string;
  phone?: string;
  email?: string;
  avatarUrl?: string;
  role: "creator" | "admin" | "member";
  permissions: Record<string, any>;
  joinedAt: Date;
  lastActiveAt: Date;
  isActive: boolean;
  leftAt?: Date;
}

export interface GroupCartItem {
  id: string;
  groupOrderId: string;
  memberId: string;
  menuItemId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  customizations: Record<string, any>;
  specialInstructions?: string;
  status: "active" | "removed" | "ordered";
  addedAt: Date;
  updatedAt: Date;
}

export interface SplitBill {
  id: string;
  groupOrderId: string;
  memberId: string;
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  discountAmount: number;
  tipAmount: number;
  totalAmount: number;
  items: any[];
  paymentStatus: "pending" | "processing" | "paid" | "failed" | "refunded";
  paymentMethod?: string;
  paymentReference?: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 請求/回應類型
export interface CreateGroupOrderRequest {
  restaurantId: string;
  tableId?: number;
  expirationHours?: number;
  maxMembers?: number;
  permissions?: Record<string, any>;
}

export interface CreateGroupOrderResponse {
  groupOrderId: string;
  shareCode: string;
  shareUrl: string;
  qrCodeUrl: string;
}

export interface JoinGroupRequest {
  memberName: string;
  phone?: string;
  email?: string;
}

export interface JoinGroupResponse {
  groupOrder: GroupOrder;
  memberId: string;
  sessionId: string;
  memberRole: string;
}

// 驗證 schemas
const createGroupOrderSchema = z.object({
  restaurantId: z.string(),
  tableId: z.number().int().positive().optional(),
  expirationHours: z.number().min(1).max(168).optional().default(24), // 最多7天
  maxMembers: z.number().min(2).max(20).optional().default(10),
  permissions: z.record(z.any()).optional().default({}),
});

const joinGroupSchema = z.object({
  memberName: z.string().min(1).max(50),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
});

const addCartItemSchema = z.object({
  memberId: z.string(),
  menuItemId: z.number().int().positive(),
  quantity: z.number().int().positive(),
  customizations: z.record(z.any()).optional().default({}),
  specialInstructions: z.string().max(200).optional(),
});

const splitBillSchema = z.object({
  splitType: z.enum(["equal", "proportional", "individual", "custom"]),
  customSplits: z
    .array(
      z.object({
        memberId: z.string(),
        amount: z.number().positive(),
        items: z.array(z.any()),
      }),
    )
    .optional(),
});

const getMutationChanges = (result: unknown): number => {
  if (typeof result !== "object" || result === null || !("changes" in result)) {
    return 0;
  }

  const changes = (result as { changes?: unknown }).changes;
  return typeof changes === "number" ? changes : 0;
};

export class GroupOrderService extends BaseService {
  constructor(db: any, env: CloudflareEnv) {
    super(db, env);
  }

  // 生成唯一分享代碼
  private generateShareCode(): string {
    const chars = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789"; // 排除容易混淆的字符
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // 創建群組訂單
  async createGroupOrder(
    data: CreateGroupOrderRequest,
    createdBy: number,
  ): Promise<{
    success: boolean;
    data?: CreateGroupOrderResponse;
    error?: string;
  }> {
    try {
      // 驗證輸入
      const validatedData = createGroupOrderSchema.parse(data);

      const groupOrderId = crypto.randomUUID();
      const shareCode = this.generateShareCode();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + validatedData.expirationHours);

      const settings = {
        ...validatedData,
      };

      // 檢查分享代碼是否已存在
      const existingCode = await this.db
        .select()
        .from(groupOrders)
        .where(eq(groupOrders.shareCode, shareCode))
        .get();

      if (existingCode) {
        // 如果代碼已存在，遞歸重新生成
        return this.createGroupOrder(data, createdBy);
      }

      // 創建群組訂單
      const now = new Date();
      const creatorMemberId = crypto.randomUUID();
      const sessionId = crypto.randomUUID();

      await this.db.transaction(async (tx) => {
        const groupOrderData = {
          id: groupOrderId,
          shareCode: shareCode,
          createdBy: createdBy,
          restaurantId: validatedData.restaurantId,
          tableId: validatedData.tableId || null,
          expiresAt: new Date(expiresAt),
          settings: settings,
          status: "active" as const,
          splitType: "individual" as const,
          totalAmount: 0,
          taxAmount: 0,
          serviceCharge: 0,
          finalAmount: 0,
          createdAt: now,
          updatedAt: now,
        };

        await tx.insert(groupOrders).values(groupOrderData);

        // 創建創建者成員記錄
        const creatorMemberData = {
          id: creatorMemberId,
          groupOrderId: groupOrderId,
          userId: createdBy,
          sessionId: sessionId,
          name: "Creator", // 可以後續更新為實際用戶名
          role: "creator" as const,
          permissions: { canModifyOthers: true, canRemoveMembers: true },
          joinedAt: now,
          lastActiveAt: now,
          isActive: true,
        };

        await tx.insert(groupMembers).values(creatorMemberData);

        // 記錄分享代碼
        const shareCodeData = {
          id: crypto.randomUUID(),
          code: shareCode,
          type: "group_order" as const,
          resourceId: groupOrderId,
          createdBy: createdBy,
          expiresAt: new Date(expiresAt),
          isActive: true,
          usageCount: 0,
          metadata: { purpose: "group_order" },
          createdAt: now,
        };

        await tx.insert(shareCodes).values(shareCodeData);
      });

      const baseUrl =
        this.env.CUSTOMER_APP_URL || "https://order.makanmakan.com";
      const shareUrl = `${baseUrl}/group/${shareCode}`;
      const qrCodeUrl = `${baseUrl}/qr/group/${shareCode}`;

      return {
        success: true,
        data: {
          groupOrderId,
          shareCode,
          shareUrl,
          qrCodeUrl,
        },
      };
    } catch (error) {
      console.error("創建群組訂單失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "創建群組訂單失敗",
      };
    }
  }

  // 加入群組
  async joinGroup(
    shareCode: string,
    joinData: JoinGroupRequest,
  ): Promise<{ success: boolean; data?: JoinGroupResponse; error?: string }> {
    try {
      const validatedData = joinGroupSchema.parse(joinData);

      // 查找群組訂單
      const groupOrderResult = await this.db
        .select({
          groupOrder: groupOrders,
          shareCodeUsageCount: shareCodes.usageCount,
          shareCodeUsageLimit: shareCodes.usageLimit,
        })
        .from(groupOrders)
        .leftJoin(
          shareCodes,
          and(
            eq(shareCodes.code, shareCode),
            eq(shareCodes.type, "group_order"),
          ),
        )
        .where(
          and(
            eq(groupOrders.shareCode, shareCode),
            inArray(groupOrders.status, ["active", "ordering"]),
          ),
        )
        .get();

      if (!groupOrderResult) {
        return {
          success: false,
          error: "無效的分享代碼或群組已結束",
        };
      }

      const groupOrder = groupOrderResult.groupOrder;

      // 檢查是否已過期
      if (new Date(groupOrder.expiresAt) < new Date()) {
        return {
          success: false,
          error: "分享連結已過期",
        };
      }

      // 檢查成員數量限制
      const currentMemberCount = await this.db
        .select({ count: count() })
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupOrderId, groupOrder.id),
            eq(groupMembers.isActive, true),
          ),
        )
        .get();

      const settings = groupOrder.settings || {};
      if (
        settings.maxMembers &&
        currentMemberCount &&
        currentMemberCount.count >= settings.maxMembers
      ) {
        return {
          success: false,
          error: "群組成員已滿",
        };
      }

      // 檢查是否已加入（通過姓名和電話）
      let existingMember = null;
      if (validatedData.phone) {
        existingMember = await this.db
          .select()
          .from(groupMembers)
          .where(
            and(
              eq(groupMembers.groupOrderId, groupOrder.id),
              eq(groupMembers.phone, validatedData.phone),
              eq(groupMembers.isActive, true),
            ),
          )
          .get();
      }

      if (existingMember) {
        return {
          success: false,
          error: "該電話號碼已加入此群組",
        };
      }

      // 創建新成員
      const memberId = crypto.randomUUID();
      const sessionId = crypto.randomUUID();
      const joinedTime = new Date();

      await this.db.transaction(async (tx) => {
        const newMemberData = {
          id: memberId,
          groupOrderId: groupOrder.id,
          sessionId: sessionId,
          name: validatedData.memberName,
          phone: validatedData.phone || null,
          email: validatedData.email || null,
          role: "member" as const,
          permissions: { canAddItems: true, canRemoveItems: true },
          joinedAt: joinedTime,
          lastActiveAt: joinedTime,
          isActive: true,
        };

        await tx.insert(groupMembers).values(newMemberData);

        // 更新分享代碼使用次數
        await tx
          .update(shareCodes)
          .set({ usageCount: sql`${shareCodes.usageCount} + 1` })
          .where(
            and(
              eq(shareCodes.code, shareCode),
              eq(shareCodes.type, "group_order"),
            ),
          )
          .run();

        // 記錄活動日誌
        const joinActivityLogData = {
          id: crypto.randomUUID(),
          groupOrderId: groupOrder.id,
          memberId: memberId,
          action: "joined" as const,
          description: `${validatedData.memberName} 加入了群組`,
          metadata: { reason: "joined via share code" },
          createdAt: new Date(joinedTime),
        };

        await tx.insert(groupActivityLogs).values(joinActivityLogData);
      });

      return {
        success: true,
        data: {
          groupOrder: groupOrder as GroupOrder,
          memberId,
          sessionId,
          memberRole: "member",
        },
      };
    } catch (error) {
      console.error("加入群組失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "加入群組失敗",
      };
    }
  }

  // 獲取群組資訊
  async getGroupOrder(groupOrderId: string): Promise<{
    success: boolean;
    data?: {
      groupOrder: GroupOrder;
      members: GroupMember[];
      cartItems: GroupCartItem[];
      totalAmount: number;
    };
    error?: string;
  }> {
    try {
      // 獲取群組訂單
      const groupOrder = await this.db
        .select()
        .from(groupOrders)
        .where(eq(groupOrders.id, groupOrderId))
        .get();

      if (!groupOrder) {
        return {
          success: false,
          error: "找不到群組訂單",
        };
      }

      // 獲取成員列表
      const membersResult = await this.db
        .select({
          member: groupMembers,
          userFullName: users.fullName,
        })
        .from(groupMembers)
        .leftJoin(users, eq(groupMembers.userId, users.id))
        .where(
          and(
            eq(groupMembers.groupOrderId, groupOrderId),
            eq(groupMembers.isActive, true),
          ),
        )
        .orderBy(
          sql`CASE ${groupMembers.role}
            WHEN 'creator' THEN 1
            WHEN 'admin' THEN 2
            ELSE 3
          END`,
          groupMembers.joinedAt,
        )
        .all();

      const members = membersResult.map((item: any) => ({
        ...item.member,
      })) as GroupMember[];

      // 獲取購物車項目
      const cartItemsResult = await this.db
        .select({
          cartItem: groupCartItems,
          menuItemName: menuItems.name,
          originalPrice: menuItems.price,
        })
        .from(groupCartItems)
        .innerJoin(menuItems, eq(groupCartItems.menuItemId, menuItems.id))
        .where(
          and(
            eq(groupCartItems.groupOrderId, groupOrderId),
            eq(groupCartItems.status, "active"),
          ),
        )
        .orderBy(desc(groupCartItems.addedAt))
        .all();

      const cartItems = cartItemsResult.map((item: any) => ({
        ...item.cartItem,
        menuItemName: item.menuItemName,
        originalPrice: item.originalPrice,
      })) as GroupCartItem[];

      // 計算總金額
      const totalAmount = cartItems.reduce(
        (sum, item) => sum + item.totalPrice,
        0,
      );

      return {
        success: true,
        data: {
          groupOrder: groupOrder as GroupOrder,
          members,
          cartItems,
          totalAmount,
        },
      };
    } catch (error) {
      console.error("獲取群組資訊失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "獲取群組資訊失敗",
      };
    }
  }

  // 添加購物車項目
  async addCartItem(
    groupOrderId: string,
    itemData: any,
  ): Promise<{ success: boolean; data?: GroupCartItem; error?: string }> {
    try {
      const validatedData = addCartItemSchema.parse(itemData);

      // 檢查群組狀態
      const groupOrder = await this.db
        .select({ status: groupOrders.status })
        .from(groupOrders)
        .where(eq(groupOrders.id, groupOrderId))
        .get();

      if (!groupOrder || groupOrder.status !== "active") {
        return {
          success: false,
          error: "群組訂單狀態不允許添加項目",
        };
      }

      // 檢查成員權限
      const member = await this.db
        .select()
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.id, validatedData.memberId),
            eq(groupMembers.groupOrderId, groupOrderId),
            eq(groupMembers.isActive, true),
          ),
        )
        .get();

      if (!member) {
        return {
          success: false,
          error: "無效的成員ID",
        };
      }

      // 獲取菜品資訊
      const menuItem = await this.db
        .select()
        .from(menuItems)
        .where(
          and(
            eq(menuItems.id, validatedData.menuItemId),
            eq(menuItems.isAvailable, true),
          ),
        )
        .get();

      if (!menuItem) {
        return {
          success: false,
          error: "菜品不存在或不可用",
        };
      }

      // 計算價格（基礎邏輯，實際應包含客製化價格計算）
      const unitPrice = parseFloat(String(menuItem.price));
      const totalPrice = unitPrice * validatedData.quantity;

      // 添加購物車項目
      const cartItemId = crypto.randomUUID();
      const addedTime = new Date();

      await this.db.transaction(async (tx) => {
        const cartItemData = {
          id: cartItemId,
          groupOrderId: groupOrderId,
          memberId: validatedData.memberId,
          menuItemId: validatedData.menuItemId,
          quantity: validatedData.quantity,
          unitPrice: unitPrice,
          totalPrice: totalPrice,
          customizations: validatedData.customizations || {},
          specialInstructions: validatedData.specialInstructions || null,
          status: "active" as const,
          addedAt: addedTime,
          updatedAt: addedTime,
        };

        await tx.insert(groupCartItems).values(cartItemData);

        // 記錄活動日誌
        const addItemActivityLogData = {
          id: crypto.randomUUID(),
          groupOrderId: groupOrderId,
          memberId: validatedData.memberId,
          action: "added_item" as const,
          description: `添加了 ${validatedData.quantity}x ${menuItem.name}`,
          metadata: {
            itemId: validatedData.menuItemId.toString(),
            itemName: menuItem.name,
            quantity: validatedData.quantity,
            amount: totalPrice,
          },
          createdAt: new Date(addedTime),
        };

        await tx.insert(groupActivityLogs).values(addItemActivityLogData);
      });

      const cartItem: GroupCartItem = {
        id: cartItemId,
        groupOrderId,
        memberId: validatedData.memberId,
        menuItemId: validatedData.menuItemId,
        quantity: validatedData.quantity,
        unitPrice,
        totalPrice,
        customizations: validatedData.customizations,
        specialInstructions: validatedData.specialInstructions,
        status: "active",
        addedAt: new Date(),
        updatedAt: new Date(),
      };

      return {
        success: true,
        data: cartItem,
      };
    } catch (error) {
      console.error("添加購物車項目失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "添加購物車項目失敗",
      };
    }
  }

  // 初始化分帳
  async initiateSplit(
    groupOrderId: string,
    splitData: any,
    initiatedBy: string,
  ): Promise<{ success: boolean; data?: SplitBill[]; error?: string }> {
    try {
      const validatedData = splitBillSchema.parse(splitData);

      // 檢查權限
      const member = await this.db
        .select({
          role: groupMembers.role,
          permissions: groupMembers.permissions,
        })
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.id, initiatedBy),
            eq(groupMembers.groupOrderId, groupOrderId),
            eq(groupMembers.isActive, true),
          ),
        )
        .get();

      if (!member || (member.role !== "creator" && member.role !== "admin")) {
        return {
          success: false,
          error: "沒有權限執行分帳操作",
        };
      }

      // 獲取所有購物車項目和成員 (reads outside transaction)
      const cartItemsResult = await this.db
        .select()
        .from(groupCartItems)
        .where(
          and(
            eq(groupCartItems.groupOrderId, groupOrderId),
            eq(groupCartItems.status, "active"),
          ),
        )
        .all();

      const membersResult = await this.db
        .select()
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.groupOrderId, groupOrderId),
            eq(groupMembers.isActive, true),
          ),
        )
        .all();

      // 根據分帳類型計算每個人的帳單
      const splitBillsData: SplitBill[] = [];

      if (validatedData.splitType === "equal") {
        // 平均分帳
        const totalAmount = cartItemsResult.reduce(
          (sum, item) => sum + item.totalPrice,
          0,
        );
        const perPersonAmount = totalAmount / membersResult.length;

        for (const member of membersResult) {
          const splitBill: SplitBill = {
            id: crypto.randomUUID(),
            groupOrderId,
            memberId: member.id,
            subtotal: perPersonAmount,
            taxAmount: 0,
            serviceCharge: 0,
            discountAmount: 0,
            tipAmount: 0,
            totalAmount: perPersonAmount,
            items: cartItemsResult,
            paymentStatus: "pending",
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          splitBillsData.push(splitBill);
        }
      } else if (validatedData.splitType === "individual") {
        // 個人點餐項目分帳
        for (const member of membersResult) {
          const memberItems = cartItemsResult.filter(
            (item) => item.memberId === member.id,
          );
          const subtotal = memberItems.reduce(
            (sum, item) => sum + item.totalPrice,
            0,
          );

          if (subtotal > 0) {
            const splitBill: SplitBill = {
              id: crypto.randomUUID(),
              groupOrderId,
              memberId: member.id,
              subtotal,
              taxAmount: 0,
              serviceCharge: 0,
              discountAmount: 0,
              tipAmount: 0,
              totalAmount: subtotal,
              items: memberItems,
              paymentStatus: "pending",
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            splitBillsData.push(splitBill);
          }
        }
      }
      // 其他分帳類型的邏輯...

      // 鎖定群組訂單 and 保存分帳記錄 atomically
      const lockedTime = new Date();
      const billCreatedTime = new Date();

      await this.db.transaction(async (tx) => {
        await tx
          .update(groupOrders)
          .set({
            status: "checkout" as const,
            lockedAt: lockedTime,
          })
          .where(eq(groupOrders.id, groupOrderId))
          .run();

        for (const bill of splitBillsData) {
          const splitBillData = {
            id: bill.id,
            groupOrderId: bill.groupOrderId,
            memberId: bill.memberId,
            subtotal: bill.subtotal,
            taxAmount: bill.taxAmount,
            serviceCharge: bill.serviceCharge,
            discountAmount: bill.discountAmount,
            tipAmount: bill.tipAmount,
            totalAmount: bill.totalAmount,
            items: bill.items,
            paymentStatus: "pending" as const,
            createdAt: billCreatedTime,
            updatedAt: billCreatedTime,
          };

          await tx.insert(splitBills).values(splitBillData);
        }
      });

      return {
        success: true,
        data: splitBillsData,
      };
    } catch (error) {
      console.error("初始化分帳失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "初始化分帳失敗",
      };
    }
  }

  // 處理個別支付
  async processPayment(
    groupOrderId: string,
    memberId: string,
    paymentData: any,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 獲取分帳記錄
      const splitBill = await this.db
        .select()
        .from(splitBills)
        .where(
          and(
            eq(splitBills.groupOrderId, groupOrderId),
            eq(splitBills.memberId, memberId),
            eq(splitBills.paymentStatus, "pending"),
          ),
        )
        .get();

      if (!splitBill) {
        return {
          success: false,
          error: "找不到待支付的分帳記錄",
        };
      }

      // 更新支付狀態（實際應整合支付閘道）
      const paidTime = new Date();

      await this.db.transaction(async (tx) => {
        await tx
          .update(splitBills)
          .set({
            paymentStatus: "paid" as const,
            paymentMethod: paymentData.paymentMethod,
            paymentReference: paymentData.transactionId || crypto.randomUUID(),
            paidAt: paidTime,
            updatedAt: paidTime,
          })
          .where(eq(splitBills.id, splitBill.id))
          .run();

        // 檢查是否所有人都已付款
        const unpaidCount = await tx
          .select({ count: count() })
          .from(splitBills)
          .where(
            and(
              eq(splitBills.groupOrderId, groupOrderId),
              sql`${splitBills.paymentStatus} != 'paid'`,
            ),
          )
          .get();

        if (unpaidCount && unpaidCount.count === 0) {
          // 所有人都已付款，完成群組訂單
          const completedTime = new Date();

          await tx
            .update(groupOrders)
            .set({
              status: "completed" as const,
              completedAt: completedTime,
            })
            .where(eq(groupOrders.id, groupOrderId))
            .run();
        }
      });

      return { success: true };
    } catch (error) {
      console.error("處理支付失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "處理支付失敗",
      };
    }
  }

  // 離開群組
  async leaveGroup(
    groupOrderId: string,
    memberId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // 檢查是否為創建者
      const member = await this.db
        .select({ role: groupMembers.role })
        .from(groupMembers)
        .where(
          and(
            eq(groupMembers.id, memberId),
            eq(groupMembers.groupOrderId, groupOrderId),
          ),
        )
        .get();

      if (!member) {
        return {
          success: false,
          error: "找不到成員記錄",
        };
      }

      if (member.role === "creator") {
        return {
          success: false,
          error: "群組創建者無法離開群組",
        };
      }

      // 將成員標記為非活躍 and 移除購物車項目 atomically
      const leftTime = new Date();

      await this.db.transaction(async (tx) => {
        await tx
          .update(groupMembers)
          .set({
            isActive: false,
            leftAt: leftTime,
          })
          .where(eq(groupMembers.id, memberId))
          .run();

        // 移除該成員的購物車項目
        await tx
          .update(groupCartItems)
          .set({ status: "removed" as const })
          .where(
            and(
              eq(groupCartItems.groupOrderId, groupOrderId),
              eq(groupCartItems.memberId, memberId),
            ),
          )
          .run();
      });

      return { success: true };
    } catch (error) {
      console.error("離開群組失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "離開群組失敗",
      };
    }
  }

  // 清理過期群組訂單
  async cleanupExpiredGroups(): Promise<{
    success: boolean;
    cleaned?: number;
    error?: string;
  }> {
    try {
      const now = new Date();

      const result = await this.db
        .update(groupOrders)
        .set({ status: "cancelled" as const })
        .where(
          and(
            lt(groupOrders.expiresAt, now),
            inArray(groupOrders.status, ["active", "ordering"]),
          ),
        )
        .run();

      return {
        success: true,
        cleaned: getMutationChanges(result),
      };
    } catch (error) {
      console.error("清理過期群組失敗:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "清理過期群組失敗",
      };
    }
  }
}
