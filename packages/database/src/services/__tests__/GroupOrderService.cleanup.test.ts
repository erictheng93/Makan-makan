/**
 * GroupOrderService - 清理與錯誤處理測試
 *
 * 測試範圍: 過期群組清理、錯誤處理、併發處理
 * 測試數量: 6 個測試
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

describe("GroupOrderService - 清理與錯誤處理", () => {
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

  describe("清理過期群組", () => {
    it("應該清理過期的群組訂單", async () => {
      // 創建過期群組
      const expiredGroupId = crypto.randomUUID();
      const expiredGroup = {
        id: expiredGroupId,
        shareCode: "EXP001",
        status: "active",
        expiresAt: new Date(Date.now() - 1000), // 已過期
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
      expect(result.cleaned).toBeGreaterThan(0);
    });

    it("應該將過期群組狀態改為取消", async () => {
      // 創建過期群組
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
          restaurantId: "R-INVALID", // 無效
          maxMembers: 100, // 超過限制
        },
        1,
      );

      expect(result.success).toBe(false);
    });
  });

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

      // 模擬3個成員同時加入
      const promises = [
        service.joinGroup(shareCode, { memberName: "User1" }),
        service.joinGroup(shareCode, { memberName: "User2" }),
        service.joinGroup(shareCode, { memberName: "User3" }),
      ];

      const results = await Promise.all(promises);
      const successCount = results.filter((r) => r.success).length;

      // 至少應該有一些成功
      expect(successCount).toBeGreaterThan(0);
    });
  });
});
