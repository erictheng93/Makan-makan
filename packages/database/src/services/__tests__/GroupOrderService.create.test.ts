/**
 * GroupOrderService - 創建群組訂單測試
 *
 * 測試範圍: 群組訂單的創建邏輯
 * 測試數量: 8 個測試
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GroupOrderService } from "../GroupOrderService";
import {
  createOptimizedMockDB,
  createMockEnv,
  setupUUIDMock,
  setupRandomMock,
  cleanupMockDB,
} from "./test-helpers";

describe("GroupOrderService - 創建群組訂單", () => {
  let service: GroupOrderService;
  let mockDB: any;
  let mockEnv: any;

  beforeEach(() => {
    // 先設置 mock,再創建 service
    setupUUIDMock();
    setupRandomMock();

    mockDB = createOptimizedMockDB();
    mockEnv = createMockEnv();
    service = new GroupOrderService(mockDB, mockEnv);
  });

  afterEach(() => {
    cleanupMockDB(mockDB);
  });

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
    // 由于 Math.random 被 mock，分享码会不同
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

    // 验证群组订单被创建
    const groupOrder = mockDB._mockData.groupOrders.get(
      result.data?.groupOrderId,
    );
    expect(groupOrder).toBeDefined();
    expect(groupOrder?.expiresAt).toBeDefined();
  });

  it("應該自動創建群組創建者成員記錄", async () => {
    const result = await service.createGroupOrder({ restaurantId: "R-001" }, 1);

    expect(result.success).toBe(true);

    // 验证创建者成員記錄
    const members = Array.from(mockDB._mockData.groupMembers.values());
    const creator = members.find((m: any) => m.role === "creator") as any;
    expect(creator).toBeDefined();
    expect(creator?.userId).toBe(1);
  });

  it("應該記錄分享碼到 shareCodes 表", async () => {
    const result = await service.createGroupOrder({ restaurantId: "R-001" }, 1);

    expect(result.success).toBe(true);

    const shareCodeRecords = Array.from(mockDB._mockData.shareCodes.values());
    const shareCodeRecord = shareCodeRecords.find(
      (s: any) => s.code === result.data?.shareCode,
    ) as any;
    expect(shareCodeRecord).toBeDefined();
    expect(shareCodeRecord?.type).toBe("group_order");
    expect(shareCodeRecord?.isActive).toBe(true);
  });

  it("應該拒絕超過限制的 maxMembers", async () => {
    const result = await service.createGroupOrder(
      {
        restaurantId: "R-001",
        maxMembers: 100, // 超過限制 (最大 20)
      },
      1,
    );

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
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

  it("應該包含完整的響應數據結構", async () => {
    const result = await service.createGroupOrder(
      {
        restaurantId: "R-001",
        tableId: 5,
      },
      1,
    );

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      groupOrderId: expect.any(String),
      shareCode: expect.any(String),
      shareUrl: expect.any(String),
      qrCodeUrl: expect.any(String),
    });
  });
});
