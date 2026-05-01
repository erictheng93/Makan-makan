/**
 * WaitingListService Unit Tests
 * 測試候位系統服務的核心功能
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { WaitingListService } from "../WaitingListService";
import type { WaitingStatus } from "@makanmakan/shared-types";
import { resetAllFactories } from "@makanmakan/testing-utils";

type WaitingListMockRow = Record<string, unknown> & {
  status: string;
  queue_number?: number;
  queue_letter?: string;
  restaurant_id?: string;
  customer_phone?: string;
};

type WaitingTableMockRow = Record<string, unknown> & {
  id: number;
  restaurant_id?: string;
  capacity: number;
  is_active: number;
  is_occupied?: number;
  waiting_list_id?: string | null;
};

describe("WaitingListService", () => {
  let service: WaitingListService;
  let mockDB: any;
  let mockEnv: any;

  beforeEach(() => {
    resetAllFactories();
    mockDB = createMockDB();
    mockEnv = createMockEnv(mockDB);
    service = new WaitingListService(mockDB, mockEnv);
    vi.clearAllMocks();
  });

  // ==========================================
  // 候位管理測試
  // ==========================================

  describe("joinWaitingList - 加入候位", () => {
    it("應該成功加入候位列表", async () => {
      const request = {
        restaurantId: "R-001",
        customerName: "張三",
        customerPhone: "0912345678",
        partySize: 4,
      };

      const result = await service.joinWaitingList(request);

      expect(result).toBeDefined();
      expect(result.customerName).toBe("張三");
      expect(result.partySize).toBe(4);
      expect(result.status).toBe("waiting");
      expect(result.queueNumber).toBeGreaterThan(0);
    });

    it("應該拒絕無效的電話號碼", async () => {
      const request = {
        restaurantId: "R-001",
        customerName: "張三",
        customerPhone: "123", // 無效
        partySize: 4,
      };

      await expect(service.joinWaitingList(request)).rejects.toThrow();
    });

    it("應該拒絕無效的用餐人數", async () => {
      const request = {
        restaurantId: "R-001",
        customerName: "張三",
        customerPhone: "0912345678",
        partySize: 25, // 超過上限
      };

      await expect(service.joinWaitingList(request)).rejects.toThrow();
    });

    it("G4: 重複登記時回傳現有票 + alreadyJoined=true（不再 throw）", async () => {
      const request = {
        restaurantId: "R-001",
        customerName: "張三",
        customerPhone: "0912345678",
        partySize: 4,
      };

      // 既有 active 票
      mockDB._mockData.waitingList.set("existing", {
        id: "existing",
        restaurant_id: "R-001",
        customer_phone: "0912345678",
        customer_name: "張三",
        party_size: 4,
        queue_number: 5,
        queue_letter: "B",
        status: "waiting",
        created_at: Date.now(),
        updated_at: Date.now(),
      });

      const result = await service.joinWaitingList(request);

      expect(result.alreadyJoined).toBe(true);
      expect(result.id).toBe("existing");
      expect(result.queueNumber).toBe(5);
      expect(result.queueLetter).toBe("B");
      expect(result.partiesAhead).toBeDefined();
    });

    it("應該生成正確的排隊號碼", async () => {
      const request1 = {
        restaurantId: "R-001",
        customerName: "張三",
        customerPhone: "0912345678",
        partySize: 2,
      };

      const request2 = {
        restaurantId: "R-001",
        customerName: "李四",
        customerPhone: "0923456789",
        partySize: 2,
      };

      const result1 = await service.joinWaitingList(request1);
      const result2 = await service.joinWaitingList(request2);

      expect(result2.queueNumber).toBeGreaterThan(result1.queueNumber);
      expect(result1.queueLetter).toBe("A"); // 2人桌
      expect(result2.queueLetter).toBe("A");
    });

    it("G4: 同手機已 cancelled → 視為新票（無 alreadyJoined）", async () => {
      mockDB._mockData.waitingList.set("old-cancelled", {
        id: "old-cancelled",
        restaurant_id: "R-001",
        customer_phone: "0912345678",
        status: "cancelled",
        queue_number: 3,
        queue_letter: "A",
      });

      const result = await service.joinWaitingList({
        restaurantId: "R-001",
        customerName: "張三",
        customerPhone: "0912345678",
        partySize: 2,
      });

      expect(result.alreadyJoined).toBeUndefined();
      expect(result.id).not.toBe("old-cancelled");
      expect(result.status).toBe("waiting");
    });

    it("G4: 同手機已 seated → 視為新票", async () => {
      mockDB._mockData.waitingList.set("old-seated", {
        id: "old-seated",
        restaurant_id: "R-001",
        customer_phone: "0912345678",
        status: "seated",
      });

      const result = await service.joinWaitingList({
        restaurantId: "R-001",
        customerName: "張三",
        customerPhone: "0912345678",
        partySize: 2,
      });

      expect(result.alreadyJoined).toBeUndefined();
      expect(result.id).not.toBe("old-seated");
    });

    it("G4: 同手機已 expired → 視為新票", async () => {
      mockDB._mockData.waitingList.set("old-expired", {
        id: "old-expired",
        restaurant_id: "R-001",
        customer_phone: "0912345678",
        status: "expired",
      });

      const result = await service.joinWaitingList({
        restaurantId: "R-001",
        customerName: "張三",
        customerPhone: "0912345678",
        partySize: 2,
      });

      expect(result.alreadyJoined).toBeUndefined();
      expect(result.id).not.toBe("old-expired");
    });

    it("G4: 不同餐廳同手機 → 各自獨立票（不冪等）", async () => {
      mockDB._mockData.waitingList.set("other-restaurant", {
        id: "other-restaurant",
        restaurant_id: "R-002",
        customer_phone: "0912345678",
        status: "waiting",
      });

      const result = await service.joinWaitingList({
        restaurantId: "R-001",
        customerName: "張三",
        customerPhone: "0912345678",
        partySize: 2,
      });

      expect(result.alreadyJoined).toBeUndefined();
      expect(result.id).not.toBe("other-restaurant");
      expect(result.restaurantId).toBe("R-001");
    });

    it("G4: race condition — dedup 查到但 full lookup 找不到時，視為新票", async () => {
      // 模擬：dedup 查詢 (db.get) 回傳 { id }，但 getWaitingListEntryById 回 null
      // 透過 mock 安排：waitingList map 沒有此 id，但 dedup query 能命中
      const originalGet = mockDB.get;
      let callCount = 0;
      mockDB.get = vi.fn(async (...args: unknown[]) => {
        callCount++;
        // 第一次呼叫（dedup query）回傳一個假 id
        if (callCount === 1) {
          return { id: "ghost-id" };
        }
        // 後續呼叫沿用既有 mock 行為
        return originalGet.apply(mockDB, args);
      });

      const result = await service.joinWaitingList({
        restaurantId: "R-001",
        customerName: "張三",
        customerPhone: "0912345678",
        partySize: 2,
      });

      // ghost-id 在 waitingList map 裡不存在 → getWaitingListEntryById 回 null
      // → 程式碼 fall through，建立新票
      expect(result.alreadyJoined).toBeUndefined();
      expect(result.id).not.toBe("ghost-id");
      expect(result.status).toBe("waiting");

      mockDB.get = originalGet;
    });
  });

  describe("callWaiting - 叫號", () => {
    it("應該成功叫號", async () => {
      const entryId = "wait-001";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "waiting",
        party_size: 4,
        restaurant_id: "R-001",
      });

      mockDB._mockData.tables.set(1, {
        id: 1,
        is_occupied: 0,
        is_active: 1,
        capacity: 6,
      });

      const result = await service.callWaiting(entryId, { tableId: 1 });

      expect(result.status).toBe("called");
      expect(result.tableId).toBe(1);
      expect(result.calledAt).toBeDefined();
      expect(result.timeoutAt).toBeDefined();
    });

    it("應該拒絕叫號非等待狀態的候位", async () => {
      const entryId = "wait-001";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "seated", // 已入座
        restaurant_id: "R-001",
      });

      await expect(
        service.callWaiting(entryId, { tableId: 1 }),
      ).rejects.toThrow();
    });

    it("應該驗證桌位可用性", async () => {
      const entryId = "wait-001";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "waiting",
        party_size: 4,
        restaurant_id: "R-001",
      });

      mockDB._mockData.tables.set(1, {
        id: 1,
        is_occupied: 1, // 已佔用
        is_active: 1,
        capacity: 6,
      });

      await expect(
        service.callWaiting(entryId, { tableId: 1 }),
      ).rejects.toThrow("桌位不可用");
    });

    it("應該驗證桌位容量", async () => {
      const entryId = "wait-001";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "waiting",
        party_size: 6,
        restaurant_id: "R-001",
      });

      mockDB._mockData.tables.set(1, {
        id: 1,
        is_occupied: 0,
        is_active: 1,
        capacity: 4, // 容量不足
      });

      await expect(
        service.callWaiting(entryId, { tableId: 1 }),
      ).rejects.toThrow("桌位容量不足");
    });

    it("應該拒絕使用其他餐廳的桌位叫號", async () => {
      const entryId = "wait-001";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "waiting",
        party_size: 4,
        restaurant_id: "R-001",
      });

      mockDB._mockData.tables.set(1, {
        id: 1,
        restaurant_id: "R-999",
        is_occupied: 0,
        is_active: 1,
        capacity: 6,
      });

      await expect(
        service.callWaiting(entryId, { tableId: 1 }),
      ).rejects.toThrow("桌位不可用");
    });
  });

  describe("confirmWaiting - 確認候位", () => {
    it("應該成功確認", async () => {
      const entryId = "wait-001";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "called",
        timeout_at: Date.now() + 300000, // 5分鐘後
        restaurant_id: "R-001",
      });

      const result = await service.confirmWaiting(entryId);

      expect(result.status).toBe("confirmed");
      expect(result.confirmedAt).toBeDefined();
    });

    it("應該拒絕確認未叫號的候位", async () => {
      const entryId = "wait-001";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "waiting",
        restaurant_id: "R-001",
      });

      await expect(service.confirmWaiting(entryId)).rejects.toThrow(
        /transition/i,
      );
    });

    it("應該檢查超時", async () => {
      const entryId = "wait-001";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "called",
        timeout_at: Date.now() - 1000, // 已超時
        restaurant_id: "R-001",
      });

      await expect(service.confirmWaiting(entryId)).rejects.toThrow("已超時");
    });
  });

  describe("markSeated - 標記入座", () => {
    it("應該成功標記入座", async () => {
      const entryId = "wait-001";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "confirmed",
        table_id: 1,
        restaurant_id: "R-001",
      });

      const result = await service.markSeated(entryId);

      expect(result.status).toBe("seated");
      expect(result.seatedAt).toBeDefined();
    });

    it("應該更新桌位狀態為佔用", async () => {
      const entryId = "wait-001";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "confirmed",
        table_id: 1,
        restaurant_id: "R-001",
      });

      await service.markSeated(entryId);

      // 驗證桌位狀態已更新（需要 mock 實現）
      expect(mockDB._updateCalled).toBe(true);
    });
  });

  describe("cancelWaiting - 取消候位", () => {
    it("應該成功取消候位", async () => {
      const entryId = "wait-001";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "waiting",
        restaurant_id: "R-001",
      });

      const result = await service.cancelWaiting(entryId);

      expect(result.status).toBe("cancelled");
      expect(result.cancelledAt).toBeDefined();
    });

    it("應該釋放已分配的桌位", async () => {
      const entryId = "wait-001";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "called",
        table_id: 1,
        restaurant_id: "R-001",
      });

      await service.cancelWaiting(entryId);

      expect(mockDB._updateCalled).toBe(true);
    });
  });

  // ==========================================
  // 等待時間預估測試
  // ==========================================

  describe("estimateWaitTime - 預估等待時間", () => {
    it("應該計算基本等待時間", async () => {
      const request = {
        restaurantId: "R-001",
        partySize: 4,
      };

      const result = await service.estimateWaitTime(request);

      expect(result.estimatedWaitMinutes).toBeGreaterThanOrEqual(0);
      expect(result.partiesAhead).toBeGreaterThanOrEqual(0);
      expect(result.availableTables).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("應該在沒有排隊時返回短等待時間", async () => {
      // 設置有空桌且無人排隊
      mockDB._mockData.tables.set(1, {
        id: 1,
        capacity: 4,
        is_occupied: 0,
        is_active: 1,
      });

      const result = await service.estimateWaitTime({
        restaurantId: "R-001",
        partySize: 4,
      });

      expect(result.estimatedWaitMinutes).toBeLessThan(10);
      expect(result.partiesAhead).toBe(0);
      expect(result.availableTables).toBeGreaterThan(0);
    });

    it("應該根據前方人數調整時間", async () => {
      // 設置多組人在排隊
      for (let i = 0; i < 5; i++) {
        mockDB._mockData.waitingList.set(`wait-${i}`, {
          id: `wait-${i}`,
          status: "waiting",
          party_size: 4,
          restaurant_id: "R-001",
        });
      }

      const result = await service.estimateWaitTime({
        restaurantId: "R-001",
        partySize: 4,
      });

      expect(result.partiesAhead).toBe(5);
      expect(result.estimatedWaitMinutes).toBeGreaterThan(10);
    });

    it("應該考慮尖峰時段調整", async () => {
      // Mock 當前時間為尖峰時段（晚上7點）
      vi.setSystemTime(new Date("2024-01-01T19:00:00"));

      const result = await service.estimateWaitTime({
        restaurantId: "R-001",
        partySize: 4,
      });

      // 尖峰時段應該有較長等待時間
      expect(result.estimatedWaitMinutes).toBeGreaterThan(0);

      vi.useRealTimers();
    });
  });

  describe("getQueueStatus - 隊列狀態", () => {
    it("應該返回完整的隊列狀態", async () => {
      const result = await service.getQueueStatus("R-001");

      expect(result.restaurantId).toBe("R-001");
      expect(result.totalWaiting).toBeGreaterThanOrEqual(0);
      expect(result.averageWaitMinutes).toBeGreaterThanOrEqual(0);
      expect(result.availableTables).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(result.byTableType)).toBe(true);
    });

    it("應該按桌型分類統計", async () => {
      const result = await service.getQueueStatus("R-001");

      expect(result.byTableType.length).toBeGreaterThan(0);
      result.byTableType.forEach((type) => {
        expect(type.type).toBeDefined();
        expect(type.waiting).toBeGreaterThanOrEqual(0);
        expect(type.averageWait).toBeGreaterThanOrEqual(0);
      });
    });
  });

  // ==========================================
  // 統計分析測試
  // ==========================================

  describe("getWaitingStats - 候位統計", () => {
    it("應該返回今日統計", async () => {
      const result = await service.getWaitingStats("R-001");

      expect(result.restaurantId).toBe("R-001");
      expect(result.totalWaiting).toBeGreaterThanOrEqual(0);
      expect(result.seatedCount).toBeGreaterThanOrEqual(0);
      expect(result.expiredCount).toBeGreaterThanOrEqual(0);
      expect(result.cancelledCount).toBeGreaterThanOrEqual(0);
      expect(result.avgWaitMinutes).toBeGreaterThanOrEqual(0);
      expect(result.expireRate).toBeGreaterThanOrEqual(0);
    });

    it("應該支持指定日期查詢", async () => {
      const result = await service.getWaitingStats("R-001", "2024-01-01");

      expect(result.date).toBe("2024-01-01");
    });
  });

  // ==========================================
  // 輔助方法測試
  // ==========================================

  describe("Helper Methods", () => {
    it("應該正確驗證候位資料", () => {
      const validData = {
        restaurantId: "R-001",
        customerName: "張三",
        customerPhone: "0912345678",
        partySize: 4,
      };

      expect(() => {
        service["validateWaitingListData"](validData);
      }).not.toThrow();
    });

    it("應該拒絕空白姓名", () => {
      const invalidData = {
        restaurantId: "R-001",
        customerName: "",
        customerPhone: "0912345678",
        partySize: 4,
      };

      expect(() => {
        service["validateWaitingListData"](invalidData);
      }).toThrow("顧客姓名為必填");
    });

    it("應該根據人數生成正確的隊列字母", async () => {
      const result2 = await service["generateQueueNumber"]("R-001", 2);
      expect(result2.letter).toBe("A"); // 2人桌

      const result4 = await service["generateQueueNumber"]("R-001", 4);
      expect(result4.letter).toBe("B"); // 4人桌

      const result6 = await service["generateQueueNumber"]("R-001", 6);
      expect(result6.letter).toBe("C"); // 6人+桌
    });

    it("應該計算前方組數", async () => {
      // 設置測試數據
      mockDB._mockData.waitingList.set("wait-1", {
        restaurant_id: "R-001",
        status: "waiting",
        queue_number: 1,
        party_size: 4,
      });
      mockDB._mockData.waitingList.set("wait-2", {
        restaurant_id: "R-001",
        status: "waiting",
        queue_number: 2,
        party_size: 4,
      });

      const count = await service["getPartiesAhead"]("R-001", 3, 4);

      expect(count).toBe(2);
    });
  });

  // ==========================================
  // 錯誤處理測試
  // ==========================================

  describe("Error Handling", () => {
    it("應該處理資料庫錯誤", async () => {
      const errorDB = {
        get: async () => {
          throw new Error("Database error");
        },
        all: async () => {
          throw new Error("Database error");
        },
        run: async () => {
          throw new Error("Database error");
        },
        transaction: async (cb: any) => cb(errorDB),
      };

      const errorEnv = {
        JWT_SECRET: "test-secret",
        NODE_ENV: "test",
        MOCK_DRIZZLE_DB: errorDB,
      };

      const errorService = new WaitingListService(
        errorDB,
        errorEnv as typeof mockEnv,
      );

      await expect(
        errorService.joinWaitingList({
          restaurantId: "R-001",
          customerName: "Test",
          customerPhone: "0912345678",
          partySize: 4,
        }),
      ).rejects.toThrow();
    });

    it("應該處理不存在的候位記錄", async () => {
      const result = await service.getWaitingListEntryById("non-existent");

      expect(result).toBeNull();
    });
  });

  // ==========================================
  // 狀態機完整性測試 (State Machine Completeness)
  // ==========================================

  describe("Invalid State Transitions - 非法狀態轉換", () => {
    it("seated → call 應該拒絕（已入座不能重新叫號）", async () => {
      const entryId = "wait-st-001";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "seated",
        party_size: 4,
        restaurant_id: "R-001",
      });

      mockDB._mockData.tables.set(2, {
        id: 2,
        is_occupied: 0,
        is_active: 1,
        capacity: 6,
      });

      await expect(
        service.callWaiting(entryId, { tableId: 2 }),
      ).rejects.toThrow(/transition/i);
    });

    it("cancelled → call 應該拒絕（已取消不能叫號）", async () => {
      const entryId = "wait-st-002";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "cancelled",
        party_size: 4,
        restaurant_id: "R-001",
      });

      mockDB._mockData.tables.set(2, {
        id: 2,
        is_occupied: 0,
        is_active: 1,
        capacity: 6,
      });

      await expect(
        service.callWaiting(entryId, { tableId: 2 }),
      ).rejects.toThrow(/transition/i);
    });

    it("expired → call 應該拒絕（已過期不能叫號）", async () => {
      const entryId = "wait-st-003";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "expired",
        party_size: 4,
        restaurant_id: "R-001",
      });

      mockDB._mockData.tables.set(2, {
        id: 2,
        is_occupied: 0,
        is_active: 1,
        capacity: 6,
      });

      await expect(
        service.callWaiting(entryId, { tableId: 2 }),
      ).rejects.toThrow(/transition/i);
    });

    it("seated → confirm 應該拒絕（已入座不能確認）", async () => {
      const entryId = "wait-st-004";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "seated",
        restaurant_id: "R-001",
      });

      await expect(service.confirmWaiting(entryId)).rejects.toThrow(
        /transition/i,
      );
    });

    it("cancelled → confirm 應該拒絕（已取消不能確認）", async () => {
      const entryId = "wait-st-005";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "cancelled",
        restaurant_id: "R-001",
      });

      await expect(service.confirmWaiting(entryId)).rejects.toThrow(
        /transition/i,
      );
    });

    it("expired → confirm 應該拒絕（已過期不能確認）", async () => {
      const entryId = "wait-st-006";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "expired",
        restaurant_id: "R-001",
      });

      await expect(service.confirmWaiting(entryId)).rejects.toThrow(
        /transition/i,
      );
    });

    it("waiting → seat 應該拒絕（必須先叫號才能入座）", async () => {
      const entryId = "wait-st-007";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "waiting",
        restaurant_id: "R-001",
      });

      await expect(service.markSeated(entryId)).rejects.toThrow(/transition/i);
    });

    it("expired → seat 應該拒絕（已過期不能入座）", async () => {
      const entryId = "wait-st-008";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "expired",
        restaurant_id: "R-001",
      });

      await expect(service.markSeated(entryId)).rejects.toThrow(/transition/i);
    });

    it("cancelled → seat 應該拒絕（已取消不能入座）", async () => {
      const entryId = "wait-st-009";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "cancelled",
        restaurant_id: "R-001",
      });

      await expect(service.markSeated(entryId)).rejects.toThrow(/transition/i);
    });

    it("seated → cancel 應該拒絕（已入座不能取消）", async () => {
      const entryId = "wait-st-011";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "seated",
        restaurant_id: "R-001",
      });

      await expect(service.cancelWaiting(entryId)).rejects.toThrow(
        /transition/i,
      );
    });

    it("expired → cancel 應該拒絕（已過期不能取消）", async () => {
      const entryId = "wait-st-012";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "expired",
        restaurant_id: "R-001",
      });

      await expect(service.cancelWaiting(entryId)).rejects.toThrow(
        /transition/i,
      );
    });

    it("cancelled → cancel 應該拒絕（不能重複取消）", async () => {
      const entryId = "wait-st-013";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "cancelled",
        restaurant_id: "R-001",
      });

      await expect(service.cancelWaiting(entryId)).rejects.toThrow(
        /transition/i,
      );
    });

    it("waiting → cancel 應該允許", async () => {
      const entryId = "wait-st-014";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "waiting",
        restaurant_id: "R-001",
      });

      const result = await service.cancelWaiting(entryId);
      expect(result.status).toBe("cancelled");
    });

    it("called → cancel 應該允許（叫號後可取消）", async () => {
      const entryId = "wait-st-015";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "called",
        table_id: 1,
        restaurant_id: "R-001",
      });

      const result = await service.cancelWaiting(entryId);
      expect(result.status).toBe("cancelled");
    });

    it("seated → expire 應該拒絕（已入座不能標記過期）", async () => {
      const entryId = "wait-st-016";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "seated",
        restaurant_id: "R-001",
      });

      await expect(service.expireWaiting(entryId)).rejects.toThrow(
        /transition/i,
      );
    });

    it("cancelled → expire 應該拒絕（已取消不能標記過期）", async () => {
      const entryId = "wait-st-017";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "cancelled",
        restaurant_id: "R-001",
      });

      await expect(service.expireWaiting(entryId)).rejects.toThrow(
        /transition/i,
      );
    });

    it("expired → expire 應該拒絕（不能重複標記過期）", async () => {
      const entryId = "wait-st-018";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "expired",
        restaurant_id: "R-001",
      });

      await expect(service.expireWaiting(entryId)).rejects.toThrow(
        /transition/i,
      );
    });

    it("called → seat 應該允許（叫號後可直接入座，不需確認）", async () => {
      const entryId = "wait-st-010";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "called",
        table_id: 1,
        restaurant_id: "R-001",
      });

      const result = await service.markSeated(entryId);

      expect(result.status).toBe("seated");
    });
  });

  // ==========================================
  // G6 — ApiError(409) INVALID_STATUS_TRANSITION 契約
  // 鎖定 illegal transition 統一以 ApiError 結構化錯誤呈現
  // (T2: 把 inline status 檢查改用 assertWaitingTransition)
  // ==========================================

  describe("G6 — INVALID_STATUS_TRANSITION ApiError contract", () => {
    it("seated 票被 callWaiting 時丟 ApiError(code=INVALID_STATUS_TRANSITION, status=409)", async () => {
      const entryId = "g6-seated-call";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "seated",
        party_size: 2,
        restaurant_id: "R-001",
      });
      mockDB._mockData.tables.set(1, {
        id: 1,
        is_occupied: 0,
        is_active: 1,
        capacity: 4,
      });

      await expect(
        service.callWaiting(entryId, { tableId: 1 }),
      ).rejects.toMatchObject({
        code: "INVALID_STATUS_TRANSITION",
        status: 409,
      });
    });

    it("cancelled 票被任何 mutation 時都丟 409", async () => {
      const entryId = "g6-cancelled";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "cancelled",
        party_size: 2,
        restaurant_id: "R-001",
      });
      mockDB._mockData.tables.set(1, {
        id: 1,
        is_occupied: 0,
        is_active: 1,
        capacity: 4,
      });

      const matcher = { code: "INVALID_STATUS_TRANSITION", status: 409 };
      await expect(
        service.callWaiting(entryId, { tableId: 1 }),
      ).rejects.toMatchObject(matcher);
      await expect(service.confirmWaiting(entryId)).rejects.toMatchObject(
        matcher,
      );
      await expect(service.markSeated(entryId)).rejects.toMatchObject(matcher);
      await expect(service.cancelWaiting(entryId)).rejects.toMatchObject(
        matcher,
      );
      await expect(service.expireWaiting(entryId)).rejects.toMatchObject(
        matcher,
      );
    });

    it("waiting 票直接 markSeated（跳過 call/confirm）時丟 409", async () => {
      const entryId = "g6-waiting-seat";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "waiting",
        party_size: 2,
        restaurant_id: "R-001",
      });

      await expect(service.markSeated(entryId)).rejects.toMatchObject({
        code: "INVALID_STATUS_TRANSITION",
        status: 409,
      });
    });

    it("錯誤 message 包含 from 與 to 狀態", async () => {
      const entryId = "g6-message";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "expired",
        party_size: 2,
        restaurant_id: "R-001",
      });

      try {
        await service.cancelWaiting(entryId);
        throw new Error("expected service.cancelWaiting to throw");
      } catch (err) {
        expect((err as { message: string }).message).toContain("expired");
        expect((err as { message: string }).message).toContain("cancelled");
      }
    });
  });

  // ==========================================
  // 超時邊界測試 (Timeout Boundary)
  // ==========================================

  describe("Timeout Boundary - 超時邊界條件", () => {
    it("剛好等於 timeoutAt 時應該允許確認（now === timeoutAt）", async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      const entryId = "wait-to-001";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "called",
        timeout_at: now, // 剛好等於當前時間
        restaurant_id: "R-001",
      });

      // now > timeoutAt 才算超時，now === timeoutAt 不應超時
      const result = await service.confirmWaiting(entryId);
      expect(result.status).toBe("confirmed");

      vi.useRealTimers();
    });

    it("超過 timeoutAt 1ms 時應該過期", async () => {
      const timeoutAt = Date.now();
      vi.setSystemTime(timeoutAt + 1);

      const entryId = "wait-to-002";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "called",
        timeout_at: timeoutAt,
        restaurant_id: "R-001",
      });

      await expect(service.confirmWaiting(entryId)).rejects.toThrow("已超時");

      vi.useRealTimers();
    });

    it("距超時還有 1ms 時應該允許確認", async () => {
      const timeoutAt = Date.now() + 1;
      vi.setSystemTime(timeoutAt - 1);

      const entryId = "wait-to-003";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "called",
        timeout_at: timeoutAt,
        restaurant_id: "R-001",
      });

      const result = await service.confirmWaiting(entryId);
      expect(result.status).toBe("confirmed");

      vi.useRealTimers();
    });

    it("timeoutAt 為 null 時不應檢查超時", async () => {
      const entryId = "wait-to-004";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "called",
        timeout_at: null,
        restaurant_id: "R-001",
      });

      const result = await service.confirmWaiting(entryId);
      expect(result.status).toBe("confirmed");
    });
  });

  // ==========================================
  // 並發安全測試 (Concurrency Safety)
  // ==========================================

  describe("Concurrency Safety - 並發安全", () => {
    // NOTE: 真正的並發鎖定需要在 DB 層用 transaction + SELECT FOR UPDATE 實現。
    // 這裡的測試驗證「狀態檢查邏輯」在順序執行下能正確阻擋重複操作。
    // 真正的並發競爭條件需要搭配真實 D1 的 integration test 來覆蓋。

    it("第一次叫號成功後，第二次叫號應被拒絕", async () => {
      const entryId = "wait-cc-001";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "waiting",
        party_size: 4,
        restaurant_id: "R-001",
      });

      mockDB._mockData.tables.set(10, {
        id: 10,
        is_occupied: 0,
        is_active: 1,
        capacity: 6,
      });

      mockDB._mockData.tables.set(11, {
        id: 11,
        is_occupied: 0,
        is_active: 1,
        capacity: 6,
      });

      // 第一次叫號：成功
      const result = await service.callWaiting(entryId, { tableId: 10 });
      expect(result.status).toBe("called");

      // 第二次叫號：狀態已不是 waiting，應被拒絕
      await expect(
        service.callWaiting(entryId, { tableId: 11 }),
      ).rejects.toThrow(/transition/i);
    });

    it("第一次確認成功後，第二次確認應被拒絕", async () => {
      const entryId = "wait-cc-002";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "called",
        timeout_at: Date.now() + 300000,
        restaurant_id: "R-001",
      });

      // 第一次確認：成功
      const result = await service.confirmWaiting(entryId);
      expect(result.status).toBe("confirmed");

      // 第二次確認：狀態已不是 called，應被拒絕
      await expect(service.confirmWaiting(entryId)).rejects.toThrow(
        /transition/i,
      );
    });

    it("入座後不能再取消", async () => {
      const entryId = "wait-cc-003";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "confirmed",
        table_id: 1,
        restaurant_id: "R-001",
      });

      // 先入座
      const seated = await service.markSeated(entryId);
      expect(seated.status).toBe("seated");

      // 入座後取消應被拒絕（已入座不可取消）
      await expect(service.cancelWaiting(entryId)).rejects.toThrow(
        /transition/i,
      );
    });

    it("取消後不能入座", async () => {
      const entryId = "wait-cc-004";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "confirmed",
        table_id: 1,
        restaurant_id: "R-001",
      });

      // 先取消
      const cancelled = await service.cancelWaiting(entryId);
      expect(cancelled.status).toBe("cancelled");

      // 取消後嘗試入座，應被拒絕
      await expect(service.markSeated(entryId)).rejects.toThrow(/transition/i);
    });
  });

  // ==========================================
  // 自動桌位分配測試 (Auto Table Assignment)
  // ==========================================

  describe("findAvailableTable - 自動桌位分配", () => {
    it("應該找到容量最接近的可用桌位 (best-fit)", async () => {
      mockDB._mockData.tables.set(1, {
        id: 1,
        table_number: "T1",
        capacity: 2,
        is_occupied: 0,
        is_active: 1,
        restaurant_id: "R-001",
      });
      mockDB._mockData.tables.set(2, {
        id: 2,
        table_number: "T2",
        capacity: 4,
        is_occupied: 0,
        is_active: 1,
        restaurant_id: "R-001",
      });
      mockDB._mockData.tables.set(3, {
        id: 3,
        table_number: "T3",
        capacity: 6,
        is_occupied: 0,
        is_active: 1,
        restaurant_id: "R-001",
      });

      const result = await service.findAvailableTable("R-001", 3);
      expect(result).not.toBeNull();
      expect(result!.tableId).toBe(2); // 4人桌是3人最佳匹配
      expect(result!.confidence).toBeGreaterThan(0.5);
    });

    it("沒有適合容量的桌位時應返回 null", async () => {
      mockDB._mockData.tables.set(1, {
        id: 1,
        capacity: 2,
        is_occupied: 0,
        is_active: 1,
        restaurant_id: "R-001",
      });
      const result = await service.findAvailableTable("R-001", 6);
      expect(result).toBeNull();
    });

    it("所有桌位佔用時應返回 null", async () => {
      mockDB._mockData.tables.set(1, {
        id: 1,
        capacity: 6,
        is_occupied: 1,
        is_active: 1,
        restaurant_id: "R-001",
      });
      const result = await service.findAvailableTable("R-001", 2);
      expect(result).toBeNull();
    });

    it("應排除已被候位預留的桌位 (waiting_list_id IS NOT NULL)", async () => {
      mockDB._mockData.tables.set(1, {
        id: 1,
        table_number: "T1",
        capacity: 4,
        is_occupied: 0,
        is_active: 1,
        waiting_list_id: "some-entry",
        restaurant_id: "R-001",
      });
      mockDB._mockData.tables.set(2, {
        id: 2,
        table_number: "T2",
        capacity: 6,
        is_occupied: 0,
        is_active: 1,
        restaurant_id: "R-001",
      });

      const result = await service.findAvailableTable("R-001", 3);
      expect(result).not.toBeNull();
      expect(result!.tableId).toBe(2); // T1 被排除，選 T2
    });

    it("應排除指定的桌位ID (excludeTableIds)", async () => {
      mockDB._mockData.tables.set(1, {
        id: 1,
        table_number: "T1",
        capacity: 4,
        is_occupied: 0,
        is_active: 1,
        restaurant_id: "R-001",
      });

      const result = await service.findAvailableTable("R-001", 2, [1]);
      expect(result).toBeNull(); // 唯一的桌子被排除
    });
  });

  describe("batchCallNext - 批次叫號", () => {
    it("應該自動分配桌位並叫號", async () => {
      mockDB._mockData.waitingList.set("w1", {
        id: "w1",
        status: "waiting",
        party_size: 2,
        queue_number: 1,
        queue_letter: "A",
        restaurant_id: "R-001",
        customer_name: "Alice",
        customer_phone: "0912345678",
      });
      mockDB._mockData.tables.set(1, {
        id: 1,
        table_number: "T1",
        capacity: 4,
        is_occupied: 0,
        is_active: 1,
        restaurant_id: "R-001",
      });

      const results = await service.batchCallNext("R-001", 1);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].tableId).toBe(1);
      expect(results[0].message).toContain("T1");
    });

    it("沒有可用桌位時應返回失敗", async () => {
      mockDB._mockData.waitingList.set("w1", {
        id: "w1",
        status: "waiting",
        party_size: 2,
        queue_number: 1,
        restaurant_id: "R-001",
        customer_name: "Alice",
        customer_phone: "0912345678",
      });
      // 沒有桌位

      const results = await service.batchCallNext("R-001", 1);
      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].message).toContain("無可用桌位");
    });

    it("沒有等待中的候位時應返回空結果", async () => {
      const results = await service.batchCallNext("R-001", 1);
      expect(results).toHaveLength(0);
    });
  });

  // ==========================================
  // 樂觀鎖測試 (Optimistic Locking - SQL Level)
  // ==========================================

  describe("Optimistic Locking - 樂觀鎖 (SQL WHERE 條件)", () => {
    // 這些測試直接驗證 mock 的 WHERE status 條件解析和 meta.changes 回傳

    it("WHERE status = 'waiting' 應阻止非 waiting 狀態的更新", async () => {
      const entryId = "wait-ol-001";
      // 直接設定為 called 狀態（模擬另一個請求先完成了叫號）
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "called",
        party_size: 4,
        restaurant_id: "R-001",
        table_id: 1,
      });

      mockDB._mockData.tables.set(5, {
        id: 5,
        is_occupied: 0,
        is_active: 1,
        capacity: 6,
      });

      // App-level guard fires first (status !== "waiting")
      await expect(
        service.callWaiting(entryId, { tableId: 5 }),
      ).rejects.toThrow(/transition/i);

      // Verify status was NOT changed by the update
      expect(mockDB._mockData.waitingList.get(entryId).status).toBe("called");
    });

    it("WHERE status IN (...) 應阻止不符合條件的更新", async () => {
      const entryId = "wait-ol-002";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "seated", // 不在 IN ('waiting', 'called', 'confirmed')
        restaurant_id: "R-001",
      });

      // App-level guard catches it
      await expect(service.cancelWaiting(entryId)).rejects.toThrow(
        /transition/i,
      );

      // Status unchanged
      expect(mockDB._mockData.waitingList.get(entryId).status).toBe("seated");
    });

    it("WHERE (status = 'called' OR status = 'confirmed') 應匹配正確狀態", async () => {
      const entryId = "wait-ol-003";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "called",
        table_id: 1,
        restaurant_id: "R-001",
      });

      // called → seated 應成功 (OR 條件匹配 'called')
      const result = await service.markSeated(entryId);
      expect(result.status).toBe("seated");
    });

    it("mock run() 應回傳 meta.changes = 0 當 WHERE 不匹配", async () => {
      // 直接測試 mock 的 run() 行為
      const { sql } = await import("drizzle-orm");
      const entryId = "wait-ol-004";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "seated", // 不是 'waiting'
        restaurant_id: "R-001",
      });

      const result = await mockDB.run(
        sql`UPDATE waiting_list SET status = 'called', updated_at = ${Date.now()} WHERE id = ${entryId} AND status = 'waiting'`,
      );

      expect(result.meta.changes).toBe(0);
      // Status should NOT have changed
      expect(mockDB._mockData.waitingList.get(entryId).status).toBe("seated");
    });

    it("mock run() 應回傳 meta.changes = 1 當 WHERE 匹配", async () => {
      const { sql } = await import("drizzle-orm");
      const entryId = "wait-ol-005";
      mockDB._mockData.waitingList.set(entryId, {
        id: entryId,
        status: "waiting",
        restaurant_id: "R-001",
      });

      const result = await mockDB.run(
        sql`UPDATE waiting_list SET status = 'called', updated_at = ${Date.now()} WHERE id = ${entryId} AND status = 'waiting'`,
      );

      expect(result.meta.changes).toBe(1);
      expect(mockDB._mockData.waitingList.get(entryId).status).toBe("called");
    });
  });
});

// ==========================================
// Mock Helpers
// ==========================================

/**
 * Extract query string and parameter values from a drizzle sql tagged template object.
 * The sql`...` tagged template produces an object with queryChunks array containing
 * alternating StringChunk (with .value array) and parameter values.
 * sql.raw() produces the same structure but with all text in a single StringChunk.
 */
function extractQueryInfo(query: any): { queryStr: string; values: any[] } {
  const chunks = query?.queryChunks;
  if (!chunks) {
    return { queryStr: String(query), values: [] };
  }
  const strings: string[] = [];
  const values: any[] = [];
  for (const chunk of chunks) {
    if (chunk && typeof chunk === "object" && "value" in chunk) {
      strings.push(...chunk.value);
    } else {
      values.push(chunk);
    }
  }
  return { queryStr: strings.join(" ? "), values };
}

/**
 * Creates a mock that acts as a drizzle db instance (with get/all/run methods).
 * It is injected via env.MOCK_DRIZZLE_DB so BaseService uses it directly as this.db,
 * bypassing the real drizzle(d1) wrapper.
 *
 * The service code calls:
 *   this.db.get(sql`...`) -> returns single row or null
 *   this.db.all(sql`...`) -> returns array of rows
 *   this.db.run(sql`...`) -> executes mutation, returns { success: true }
 */
function createMockDB() {
  const mockData = {
    waitingList: new Map<string, any>(),
    tables: new Map<string | number, any>(),
    orders: new Map<string, any>(),
    restaurants: new Map<string, any>(),
  };

  const state = { updateCalled: false };

  function extractTableName(queryStr: string): string {
    // Use FROM clause to determine primary table (avoids column name collisions)
    const fromMatch = queryStr.match(/FROM\s+(waiting_list|tables|orders)/i);
    if (fromMatch) {
      const name = fromMatch[1].toLowerCase();
      if (name === "waiting_list") return "waitingList";
      return name;
    }
    // Fallback: UPDATE tablename SET ...
    const updateMatch = queryStr.match(
      /UPDATE\s+(waiting_list|tables|orders)/i,
    );
    if (updateMatch) {
      const name = updateMatch[1].toLowerCase();
      if (name === "waiting_list") return "waitingList";
      return name;
    }
    return "waitingList";
  }

  function handleSelect(queryStr: string, values: any[]): any[] {
    const tableName = extractTableName(queryStr);

    // COUNT queries for waiting_list
    if (queryStr.includes("COUNT") && tableName === "waitingList") {
      const entries = Array.from(
        mockData.waitingList.values(),
      ) as WaitingListMockRow[];

      if (queryStr.includes("queue_number <")) {
        // getPartiesAhead: values = [restaurantId, queueNumber, partySize+2]
        const queueNum = values[1];
        const filtered = entries.filter(
          (e: any) =>
            e.status === "waiting" && (e.queue_number || 0) < queueNum,
        );
        return [{ count: filtered.length }];
      }

      // Default: count all waiting entries
      const waiting = entries.filter((e: any) => e.status === "waiting");
      return [{ count: waiting.length }];
    }

    // COUNT queries for tables
    if (queryStr.includes("COUNT") && tableName === "tables") {
      const tables = Array.from(
        mockData.tables.values(),
      ) as WaitingTableMockRow[];
      // Occupied tables count (estimateWaitTime: occupied_count alias)
      if (queryStr.includes("occupied_count")) {
        const occupied = tables.filter((t: any) => t.is_occupied === 1);
        return [{ occupied_count: occupied.length, earliest_available: null }];
      }
      // Available tables count (getQueueStatus: is_occupied = 0)
      if (queryStr.includes("is_occupied = 0")) {
        const available = tables.filter(
          (t: any) => t.is_active === 1 && !t.is_occupied,
        );
        return [{ count: available.length }];
      }
      // Suitable tables count (estimateWaitTime: is_active = 1 AND capacity >= ?)
      if (queryStr.includes("capacity >=")) {
        const active = tables.filter((t: any) => t.is_active === 1);
        return [{ count: active.length }];
      }
      return [{ count: tables.length }];
    }

    // AVG queries (orders turnover)
    if (queryStr.includes("AVG") && tableName === "orders") {
      return [{ avg_turnover_minutes: 45 }];
    }

    // MAX queue_number query (generateQueueNumber)
    if (queryStr.includes("MAX(queue_number)")) {
      const entries = Array.from(
        mockData.waitingList.values(),
      ) as WaitingListMockRow[];
      const letter = values[1]; // [restaurantId, letter]
      const matching = entries.filter((e: any) => e.queue_letter === letter);
      const maxNum = matching.reduce(
        (max: number, e: any) => Math.max(max, e.queue_number || 0),
        0,
      );
      return [{ max_number: maxNum }];
    }

    // Stats query (getWaitingStats) - uses sql.raw so params are baked in
    if (
      queryStr.includes("total_waiting") &&
      queryStr.includes("seated_count")
    ) {
      const entries = Array.from(
        mockData.waitingList.values(),
      ) as WaitingListMockRow[];
      return [
        {
          total_waiting: entries.length,
          seated_count: entries.filter((e: any) => e.status === "seated")
            .length,
          expired_count: entries.filter((e: any) => e.status === "expired")
            .length,
          cancelled_count: entries.filter((e: any) => e.status === "cancelled")
            .length,
          avg_wait_minutes: 0,
          expire_rate: 0,
        },
      ];
    }

    // listWaitingList count query (sql.raw with total)
    if (
      queryStr.includes("COUNT(*)") &&
      queryStr.includes("as total") &&
      tableName === "waitingList"
    ) {
      const entries = Array.from(
        mockData.waitingList.values(),
      ) as WaitingListMockRow[];
      return [{ total: entries.length }];
    }

    // SELECT with WHERE w.id = ? (getWaitingListEntryById)
    if (tableName === "waitingList" && queryStr.includes("w.id")) {
      const id = values[0];
      const entry = mockData.waitingList.get(id);
      if (entry) {
        return [{ ...entry, table: null }];
      }
      return [];
    }

    // findAvailableTable: SELECT from tables WHERE restaurant_id=? AND capacity>=? (best-fit)
    if (
      tableName === "tables" &&
      queryStr.includes("capacity >=") &&
      queryStr.includes("is_occupied = 0") &&
      queryStr.includes("restaurant_id")
    ) {
      const restaurantId = values[0];
      const partySize = values[1];
      const tables = Array.from(
        mockData.tables.values(),
      ) as WaitingTableMockRow[];
      const suitable = tables
        .filter(
          (t: any) =>
            t.restaurant_id === restaurantId &&
            t.is_active === 1 &&
            !t.is_occupied &&
            !t.waiting_list_id &&
            t.capacity >= partySize,
        )
        .sort((a: any, b: any) => a.capacity - b.capacity || a.id - b.id);
      return suitable.length > 0 ? [suitable[0]] : [];
    }

    // SELECT from tables WHERE id = ? (callWaiting table check)
    if (
      tableName === "tables" &&
      queryStr.includes("WHERE") &&
      queryStr.includes("id =")
    ) {
      const tableId = values[0];
      const restaurantId = values[1];
      const table = mockData.tables.get(tableId);
      if (
        table &&
        queryStr.includes("restaurant_id") &&
        table.restaurant_id &&
        table.restaurant_id !== restaurantId
      ) {
        return [];
      }
      if (table && queryStr.includes("is_occupied = 0")) {
        if (!table.is_occupied) {
          return [table];
        }
        return [];
      }
      if (table) return [table];
      return [];
    }

    // SELECT from waiting_list with duplicate check (customer_phone)
    if (tableName === "waitingList" && queryStr.includes("customer_phone")) {
      const restaurantId = values[0];
      const phone = values[1];
      const entries = Array.from(
        mockData.waitingList.values(),
      ) as WaitingListMockRow[];
      const existing = entries.find(
        (e: any) =>
          e.restaurant_id === restaurantId &&
          e.customer_phone === phone &&
          ["waiting", "called", "confirmed"].includes(e.status),
      );
      return existing ? [existing] : [];
    }

    // Default: return all entries from the relevant table
    const data = mockData[tableName as keyof typeof mockData];
    if (data && data.size > 0) {
      return Array.from(data.values());
    }
    return [];
  }

  function handleInsert(queryStr: string, values: any[]): void {
    if (queryStr.includes("waiting_list")) {
      // INSERT INTO waiting_list (id, restaurant_id, customer_id, customer_name, customer_phone,
      //   party_size, preferred_table_type, queue_number, queue_letter,
      //   queue_date, priority, estimated_wait_minutes, status, notes, created_at, updated_at)
      const entry: any = {
        id: values[0],
        restaurant_id: values[1],
        customer_id: values[2],
        customer_name: values[3],
        customer_phone: values[4],
        party_size: values[5],
        preferred_table_type: values[6],
        queue_number: values[7],
        queue_letter: values[8],
        queue_date: new Date(values[9]).toISOString().slice(0, 10),
        priority: values[10],
        estimated_wait_minutes: values[11],
        status: values[12],
        notes: values[13],
        created_at: values[14],
        updated_at: values[15],
      };
      mockData.waitingList.set(entry.id, entry);
    }
  }

  function handleUpdate(queryStr: string, values: any[]): boolean {
    state.updateCalled = true;

    if (queryStr.includes("waiting_list")) {
      // The last value is always the id from the WHERE clause
      const id = values[values.length - 1];
      const entry = mockData.waitingList.get(id);
      if (!entry) return false;

      // --- Optimistic locking: check WHERE status conditions ---
      const whereIndex = queryStr.indexOf("WHERE");
      if (whereIndex >= 0) {
        const whereClause = queryStr.substring(whereIndex);
        // IN clause: AND status IN ('waiting', 'called', 'confirmed')
        const inMatch = whereClause.match(/status\s+IN\s*\(([^)]+)\)/i);
        // OR clause: AND (status = 'called' OR status = 'confirmed')
        const orMatch = whereClause.match(
          /\(status\s*=\s*'(\w+)'\s+OR\s+status\s*=\s*'(\w+)'\)/,
        );
        // Single status: AND status = 'waiting'
        const singleMatch = whereClause.match(/AND\s+status\s*=\s*'(\w+)'/);

        if (inMatch) {
          const allowed =
            inMatch[1].match(/'(\w+)'/g)?.map((s) => s.replace(/'/g, "")) || [];
          if (!allowed.includes(entry.status)) return false;
        } else if (orMatch) {
          if (entry.status !== orMatch[1] && entry.status !== orMatch[2])
            return false;
        } else if (singleMatch) {
          if (entry.status !== singleMatch[1]) return false;
        }
      }

      // --- Extract SET status (from before WHERE) ---
      const setClause =
        whereIndex >= 0 ? queryStr.substring(0, whereIndex) : queryStr;
      const setStatusMatch = setClause.match(/status\s*=\s*'(\w+)'/);
      if (setStatusMatch) {
        entry.status = setStatusMatch[1];
      }

      // Identify the specific update by distinctive column names in SET clause
      // Note: status is literal in SQL, so values start from the first ? parameter
      if (queryStr.includes("called_at")) {
        // callWaiting: SET status='called', table_id=?, called_at=?, timeout_at=?, updated_at=? WHERE id=? AND status='waiting'
        // values: [tableId, calledAt, timeoutAt, updatedAt, id]
        entry.table_id = values[0];
        entry.called_at = values[1];
        entry.timeout_at = values[2];
        entry.updated_at = values[3];
      } else if (queryStr.includes("confirmed_at")) {
        entry.confirmed_at = values[0];
        entry.updated_at = values[1];
      } else if (queryStr.includes("seated_at")) {
        entry.seated_at = values[0];
        entry.updated_at = values[1];
      } else if (queryStr.includes("cancelled_at")) {
        entry.cancelled_at = values[0];
        entry.updated_at = values[1];
      } else if (queryStr.includes("expired_at")) {
        entry.expired_at = values[0];
        entry.updated_at = values[1];
      } else if (queryStr.includes("estimated_wait_minutes")) {
        entry.estimated_wait_minutes = values[0];
        entry.updated_at = values[1];
      }

      mockData.waitingList.set(id, entry);
      return true;
    }

    // Table status updates are tracked via state.updateCalled
    return true;
  }

  const db: any = {
    get: async (query: any) => {
      const { queryStr, values } = extractQueryInfo(query);
      const upperStr = queryStr.trimStart().toUpperCase();
      if (upperStr.startsWith("INSERT")) {
        handleInsert(queryStr, values);
        return null;
      }
      const results = handleSelect(queryStr, values);
      return results[0] || null;
    },
    all: async (query: any) => {
      const { queryStr, values } = extractQueryInfo(query);
      return handleSelect(queryStr, values);
    },
    run: async (query: any) => {
      const { queryStr, values } = extractQueryInfo(query);
      const upperStr = queryStr.trimStart().toUpperCase();
      if (upperStr.startsWith("INSERT")) {
        handleInsert(queryStr, values);
        return { success: true, meta: { changes: 1 } };
      } else if (upperStr.startsWith("UPDATE")) {
        const applied = handleUpdate(queryStr, values);
        return { success: true, meta: { changes: applied ? 1 : 0 } };
      }
      return { success: true, meta: { changes: 0 } };
    },
    transaction: async (callback: any) => callback(db),
    // Raw D1 API support (used by getWaitingStats and listWaitingList)
    prepare: (sqlStr: string) => {
      const handler = {
        first: async () => {
          // Stats query (getWaitingStats)
          if (
            sqlStr.includes("total_waiting") &&
            sqlStr.includes("seated_count")
          ) {
            const entries = Array.from(
              mockData.waitingList.values(),
            ) as WaitingListMockRow[];
            return {
              total_waiting: entries.length,
              seated_count: entries.filter((e: any) => e.status === "seated")
                .length,
              expired_count: entries.filter((e: any) => e.status === "expired")
                .length,
              cancelled_count: entries.filter(
                (e: any) => e.status === "cancelled",
              ).length,
              avg_wait_minutes: 0,
              expire_rate: 0,
            };
          }
          // Count query (listWaitingList)
          if (sqlStr.includes("COUNT(*)") && sqlStr.includes("as total")) {
            const entries = Array.from(
              mockData.waitingList.values(),
            ) as WaitingListMockRow[];
            return { total: entries.length };
          }
          return null;
        },
        all: async () => {
          const entries = Array.from(
            mockData.waitingList.values(),
          ) as WaitingListMockRow[];
          return {
            results: entries.map((e: any) => ({ ...e, table: null })),
          };
        },
        bind: (..._args: any[]) => handler,
      };
      return handler;
    },
    _mockData: mockData,
    get _updateCalled() {
      return state.updateCalled;
    },
    _resetUpdateCalled() {
      state.updateCalled = false;
    },
  };

  return db;
}

function createMockEnv(mockDB?: any) {
  return {
    JWT_SECRET: "test-secret",
    NODE_ENV: "test",
    MOCK_DRIZZLE_DB: mockDB,
  };
}
