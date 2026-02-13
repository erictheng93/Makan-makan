/**
 * WaitingListService Unit Tests
 * 測試候位系統服務的核心功能
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { WaitingListService } from "../WaitingListService";
import type { WaitingStatus } from "@makanmakan/shared-types";

describe("WaitingListService", () => {
  let service: WaitingListService;
  let mockDB: any;
  let mockEnv: any;

  beforeEach(() => {
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

    it("應該防止重複排隊", async () => {
      const request = {
        restaurantId: "R-001",
        customerName: "張三",
        customerPhone: "0912345678",
        partySize: 4,
      };

      // 設置已存在的記錄
      mockDB._mockData.waitingList.set("existing", {
        restaurant_id: "R-001",
        customer_phone: "0912345678",
        status: "waiting",
      });

      await expect(service.joinWaitingList(request)).rejects.toThrow(
        "您已在候位列表中",
      );
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
        current_status: "available",
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
        current_status: "occupied", // 已佔用
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
        current_status: "available",
        capacity: 4, // 容量不足
      });

      await expect(
        service.callWaiting(entryId, { tableId: 1 }),
      ).rejects.toThrow("桌位容量不足");
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
        "此候位尚未叫號",
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
        current_status: "available",
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

      const errorService = new WaitingListService(errorDB, errorEnv as any);

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
    if (queryStr.includes("waiting_list")) return "waitingList";
    if (queryStr.includes("tables")) return "tables";
    if (queryStr.includes("orders")) return "orders";
    return "waitingList";
  }

  function handleSelect(queryStr: string, values: any[]): any[] {
    const tableName = extractTableName(queryStr);

    // COUNT queries for waiting_list
    if (queryStr.includes("COUNT") && tableName === "waitingList") {
      const entries = Array.from(mockData.waitingList.values()) as any[];

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
      const tables = Array.from(mockData.tables.values()) as any[];
      if (queryStr.includes("available")) {
        const available = tables.filter(
          (t: any) => t.current_status === "available",
        );
        return [{ count: available.length }];
      }
      if (queryStr.includes("capacity >=")) {
        if (queryStr.includes("occupied") || queryStr.includes("reserved")) {
          const occupied = tables.filter(
            (t: any) =>
              t.current_status === "occupied" ||
              t.current_status === "reserved",
          );
          return [
            { occupied_count: occupied.length, earliest_available: null },
          ];
        }
        return [{ count: tables.length }];
      }
      return [{ count: tables.length }];
    }

    // AVG queries (orders turnover)
    if (queryStr.includes("AVG") && tableName === "orders") {
      return [{ avg_turnover_minutes: 45 }];
    }

    // MAX queue_number query (generateQueueNumber)
    if (queryStr.includes("MAX(queue_number)")) {
      const entries = Array.from(mockData.waitingList.values()) as any[];
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
      const entries = Array.from(mockData.waitingList.values()) as any[];
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
      const entries = Array.from(mockData.waitingList.values()) as any[];
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

    // SELECT from tables WHERE id = ? (callWaiting table check)
    if (
      tableName === "tables" &&
      queryStr.includes("WHERE") &&
      queryStr.includes("id =")
    ) {
      const tableId = values[0];
      const table = mockData.tables.get(tableId);
      if (table && queryStr.includes("available")) {
        if (table.current_status === "available") {
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
      const entries = Array.from(mockData.waitingList.values()) as any[];
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
      //   priority, estimated_wait_minutes, status, notes, created_at, updated_at)
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
        priority: values[9],
        estimated_wait_minutes: values[10],
        status: values[11],
        notes: values[12],
        created_at: values[13],
        updated_at: values[14],
      };
      mockData.waitingList.set(entry.id, entry);
    }
  }

  function handleUpdate(queryStr: string, values: any[]): void {
    state.updateCalled = true;

    if (queryStr.includes("waiting_list")) {
      // The last value is always the id from the WHERE clause
      const id = values[values.length - 1];
      const entry = mockData.waitingList.get(id);
      if (!entry) return;

      // Status is a literal string in the SQL (e.g. status = 'called'), not a parameter.
      // Extract it from the query string.
      const statusMatch = queryStr.match(/status\s*=\s*'(\w+)'/);
      if (statusMatch) {
        entry.status = statusMatch[1];
      }

      // Identify the specific update by distinctive column names in SET clause
      // Note: status is literal in SQL, so values start from the first ? parameter
      if (queryStr.includes("called_at")) {
        // callWaiting: SET status='called', table_id=?, called_at=?, timeout_at=?, updated_at=? WHERE id=?
        // values: [tableId, calledAt, timeoutAt, updatedAt, id]
        entry.table_id = values[0];
        entry.called_at = values[1];
        entry.timeout_at = values[2];
        entry.updated_at = values[3];
      } else if (queryStr.includes("confirmed_at")) {
        // confirmWaiting: SET status='confirmed', confirmed_at=?, updated_at=? WHERE id=?
        // values: [confirmedAt, updatedAt, id]
        entry.confirmed_at = values[0];
        entry.updated_at = values[1];
      } else if (queryStr.includes("seated_at")) {
        // markSeated: SET status='seated', seated_at=?, updated_at=? WHERE id=?
        // values: [seatedAt, updatedAt, id]
        entry.seated_at = values[0];
        entry.updated_at = values[1];
      } else if (queryStr.includes("cancelled_at")) {
        // cancelWaiting: SET status='cancelled', cancelled_at=?, updated_at=? WHERE id=?
        // values: [cancelledAt, updatedAt, id]
        entry.cancelled_at = values[0];
        entry.updated_at = values[1];
      } else if (queryStr.includes("expired_at")) {
        // expireWaiting: SET status='expired', expired_at=?, updated_at=? WHERE id=?
        // values: [expiredAt, updatedAt, id]
        entry.expired_at = values[0];
        entry.updated_at = values[1];
      } else if (queryStr.includes("estimated_wait_minutes")) {
        // recalculateWaitTimes: SET estimated_wait_minutes=?, updated_at=? WHERE id=?
        // values: [minutes, updatedAt, id]
        entry.estimated_wait_minutes = values[0];
        entry.updated_at = values[1];
      }

      mockData.waitingList.set(id, entry);
    }

    // Table status updates are tracked via state.updateCalled
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
      } else if (upperStr.startsWith("UPDATE")) {
        handleUpdate(queryStr, values);
      }
      return { success: true };
    },
    transaction: async (callback: any) => callback(db),
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
