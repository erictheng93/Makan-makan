import { eq, and, desc, asc, sql } from "drizzle-orm";
import { BaseService } from "./base";
import type {
  WaitingListEntry,
  WaitingStatus,
  JoinWaitingListRequest,
  WaitingListFilters,
  WaitingListResponse,
  CallWaitingRequest,
  QueueStatus,
  WaitingStats,
  WaitTimeEstimateRequest,
  WaitTimeEstimateResult,
  TableAssignmentRequest,
  TableAssignmentResult,
} from "@makanmakan/shared-types";
import { ReservationService } from "./ReservationService";

/**
 * 候位系統服務
 * 負責排隊管理、叫號、等待時間預估
 */
export class WaitingListService extends BaseService {
  private reservationService: ReservationService;

  constructor(d1: any, env: any) {
    super(d1, env);
    this.reservationService = new ReservationService(d1, env);
  }

  // ==========================================
  // 候位管理 (Waiting List Management)
  // ==========================================

  /**
   * 加入候位列表
   */
  async joinWaitingList(
    data: JoinWaitingListRequest,
  ): Promise<WaitingListResponse> {
    try {
      const now = Date.now();

      // 1. 驗證輸入
      this.validateWaitingListData(data);

      // 2. 檢查是否已在候位中（防止重複排隊）
      const existingEntry = (await this.db.get(sql`
        SELECT id FROM waiting_list
        WHERE restaurant_id = ${data.restaurantId}
          AND customer_phone = ${data.customerPhone}
          AND status IN ('waiting', 'called', 'confirmed')
          AND DATE(created_at / 1000, 'unixepoch', 'localtime') = DATE('now', 'localtime')
      `)) as any;

      if (existingEntry) {
        throw new Error("您已在候位列表中");
      }

      // 3. 生成排隊號碼
      const queueInfo = await this.generateQueueNumber(
        data.restaurantId,
        data.partySize,
      );

      // 4. 預估等待時間
      const waitEstimate = await this.estimateWaitTime({
        restaurantId: data.restaurantId,
        partySize: data.partySize,
      });

      // 5. 建立候位記錄
      const id = this.generateUUID();
      const entry: Partial<WaitingListEntry> = {
        id,
        restaurantId: data.restaurantId,
        customerId: data.customerId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        partySize: data.partySize,
        preferredTableType: data.preferredTableType,
        queueNumber: queueInfo.number,
        queueLetter: queueInfo.letter,
        priority: 0, // 默認優先級
        estimatedWaitMinutes: waitEstimate.estimatedWaitMinutes,
        status: "waiting" as WaitingStatus,
        notes: data.notes,
        createdAt: now,
        updatedAt: now,
      };

      await this.db.run(sql`
        INSERT INTO waiting_list (
          id, restaurant_id, customer_id, customer_name, customer_phone,
          party_size, preferred_table_type, queue_number, queue_letter,
          priority, estimated_wait_minutes, status, notes, created_at, updated_at
        ) VALUES (
          ${entry.id}, ${entry.restaurantId}, ${entry.customerId}, ${entry.customerName},
          ${entry.customerPhone}, ${entry.partySize}, ${entry.preferredTableType},
          ${entry.queueNumber}, ${entry.queueLetter}, ${entry.priority},
          ${entry.estimatedWaitMinutes}, ${entry.status}, ${entry.notes},
          ${entry.createdAt}, ${entry.updatedAt}
        )
      `);

      // TODO: 發送候位確認通知

      return this.getWaitingListEntryById(id) as Promise<WaitingListResponse>;
    } catch (error) {
      console.error("Error joining waiting list:", error);
      throw error;
    }
  }

  /**
   * 根據 ID 查詢候位記錄
   */
  async getWaitingListEntryById(
    id: string,
  ): Promise<WaitingListResponse | null> {
    try {
      const result = (await this.db.get(sql`
        SELECT
          w.*,
          json_object(
            'id', t.id,
            'number', t.number,
            'capacity', t.capacity
          ) as table
        FROM waiting_list w
        LEFT JOIN tables t ON w.table_id = t.id
        WHERE w.id = ${id}
      `)) as any;

      if (!result) return null;

      // 計算前方還有幾組
      const partiesAhead = await this.getPartiesAhead(
        result.restaurant_id,
        result.queue_number,
        result.party_size,
      );

      return this.formatWaitingListResponse(result, partiesAhead);
    } catch (error) {
      console.error("Error getting waiting list entry:", error);
      throw error;
    }
  }

  /**
   * 查詢候位列表
   */
  async listWaitingList(
    filters: WaitingListFilters,
  ): Promise<{ data: WaitingListResponse[]; total: number }> {
    try {
      let whereClause = "1=1";
      const params: any[] = [];

      if (filters.restaurantId) {
        whereClause += " AND w.restaurant_id = ?";
        params.push(filters.restaurantId);
      }

      if (filters.status) {
        if (Array.isArray(filters.status)) {
          whereClause += ` AND w.status IN (${filters.status.map(() => "?").join(",")})`;
          params.push(...filters.status);
        } else {
          whereClause += " AND w.status = ?";
          params.push(filters.status);
        }
      }

      if (filters.customerPhone) {
        whereClause += " AND w.customer_phone = ?";
        params.push(filters.customerPhone);
      }

      if (filters.date) {
        whereClause +=
          " AND DATE(w.created_at / 1000, 'unixepoch', 'localtime') = ?";
        params.push(filters.date);
      } else {
        // 默認只顯示今天的
        whereClause +=
          " AND DATE(w.created_at / 1000, 'unixepoch', 'localtime') = DATE('now', 'localtime')";
      }

      // 排序：waiting 和 called 優先，按號碼排序
      const orderClause = `
        ORDER BY
          CASE w.status
            WHEN 'waiting' THEN 1
            WHEN 'called' THEN 2
            ELSE 3
          END,
          w.queue_number ASC
      `;

      // 分頁
      const page = filters.page || 1;
      const limit = filters.limit || 50;
      const offset = (page - 1) * limit;

      // 替換參數占位符為實際值（安全轉義）
      const replaceParams = (sqlStr: string, paramArray: any[]): string => {
        let paramIndex = 0;
        return sqlStr.replace(/\?/g, () => {
          const param = paramArray[paramIndex++];
          if (param === null || param === undefined) return "NULL";
          if (typeof param === "number") return String(param);
          if (typeof param === "string")
            return `'${param.replace(/'/g, "''")}'`;
          return `'${String(param).replace(/'/g, "''")}'`;
        });
      };

      // 查詢總數
      const countResult = (await this.db.get(
        sql.raw(
          replaceParams(
            `
          SELECT COUNT(*) as total
          FROM waiting_list w
          WHERE ${whereClause}
        `,
            params,
          ),
        ),
      )) as any;

      const total = countResult?.total || 0;

      // 查詢資料
      const results = (await this.db.all(
        sql.raw(
          replaceParams(
            `
          SELECT
            w.*,
            json_object(
              'id', t.id,
              'number', t.number,
              'capacity', t.capacity
            ) as table
          FROM waiting_list w
          LEFT JOIN tables t ON w.table_id = t.id
          WHERE ${whereClause}
          ${orderClause}
          LIMIT ? OFFSET ?
        `,
            [...params, limit, offset],
          ),
        ),
      )) as any[];

      const data = await Promise.all(
        results.map(async (r) => {
          const partiesAhead = await this.getPartiesAhead(
            r.restaurant_id,
            r.queue_number,
            r.party_size,
          );
          return this.formatWaitingListResponse(r, partiesAhead);
        }),
      );

      return { data, total };
    } catch (error) {
      console.error("Error listing waiting list:", error);
      throw error;
    }
  }

  /**
   * 叫號
   */
  async callWaiting(
    id: string,
    request: CallWaitingRequest,
  ): Promise<WaitingListResponse> {
    try {
      const now = Date.now();
      const entry = await this.getWaitingListEntryById(id);

      if (!entry) {
        throw new Error("候位記錄不存在");
      }

      if (entry.status !== "waiting") {
        throw new Error(`無法叫號，當前狀態: ${entry.status}`);
      }

      // 驗證桌位
      const table = (await this.db.get(sql`
        SELECT * FROM tables
        WHERE id = ${request.tableId}
          AND current_status = 'available'
      `)) as any;

      if (!table) {
        throw new Error("桌位不可用");
      }

      if (table.capacity < entry.partySize) {
        throw new Error("桌位容量不足");
      }

      // 設定超時時間（5分鐘後）
      const timeoutAt = now + 5 * 60 * 1000;

      // 更新候位記錄
      await this.db.run(sql`
        UPDATE waiting_list
        SET status = 'called',
            table_id = ${request.tableId},
            called_at = ${now},
            timeout_at = ${timeoutAt},
            updated_at = ${now}
        WHERE id = ${id}
      `);

      // 更新桌位狀態為預留
      await this.updateTableStatus(request.tableId, "reserved", null, id);

      // TODO: 發送叫號通知（SMS + Push）

      return this.getWaitingListEntryById(id) as Promise<WaitingListResponse>;
    } catch (error) {
      console.error("Error calling waiting:", error);
      throw error;
    }
  }

  /**
   * 顧客確認（回應叫號）
   */
  async confirmWaiting(id: string): Promise<WaitingListResponse> {
    try {
      const now = Date.now();
      const entry = await this.getWaitingListEntryById(id);

      if (!entry) {
        throw new Error("候位記錄不存在");
      }

      if (entry.status !== "called") {
        throw new Error("此候位尚未叫號");
      }

      // 檢查是否超時
      if (entry.timeoutAt && now > entry.timeoutAt) {
        await this.expireWaiting(id);
        throw new Error("叫號已超時，請重新排隊");
      }

      await this.db.run(sql`
        UPDATE waiting_list
        SET status = 'confirmed',
            confirmed_at = ${now},
            updated_at = ${now}
        WHERE id = ${id}
      `);

      return this.getWaitingListEntryById(id) as Promise<WaitingListResponse>;
    } catch (error) {
      console.error("Error confirming waiting:", error);
      throw error;
    }
  }

  /**
   * 標記入座
   */
  async markSeated(id: string): Promise<WaitingListResponse> {
    try {
      const now = Date.now();
      const entry = await this.getWaitingListEntryById(id);

      if (!entry) {
        throw new Error("候位記錄不存在");
      }

      if (!["called", "confirmed"].includes(entry.status)) {
        throw new Error("無法入座，候位狀態不正確");
      }

      await this.db.run(sql`
        UPDATE waiting_list
        SET status = 'seated',
            seated_at = ${now},
            updated_at = ${now}
        WHERE id = ${id}
      `);

      // 更新桌位狀態為佔用
      if (entry.tableId) {
        await this.updateTableStatus(entry.tableId, "occupied");
      }

      // TODO: 自動建立訂單記錄

      // 更新後續候位的等待時間
      await this.recalculateWaitTimes(entry.restaurantId);

      return this.getWaitingListEntryById(id) as Promise<WaitingListResponse>;
    } catch (error) {
      console.error("Error marking seated:", error);
      throw error;
    }
  }

  /**
   * 取消候位
   */
  async cancelWaiting(id: string): Promise<WaitingListResponse> {
    try {
      const now = Date.now();
      const entry = await this.getWaitingListEntryById(id);

      if (!entry) {
        throw new Error("候位記錄不存在");
      }

      await this.db.run(sql`
        UPDATE waiting_list
        SET status = 'cancelled',
            cancelled_at = ${now},
            updated_at = ${now}
        WHERE id = ${id}
      `);

      // 如果已分配桌位，釋放桌位
      if (entry.tableId) {
        await this.updateTableStatus(entry.tableId, "available");
      }

      // 更新後續候位的等待時間
      await this.recalculateWaitTimes(entry.restaurantId);

      return this.getWaitingListEntryById(id) as Promise<WaitingListResponse>;
    } catch (error) {
      console.error("Error cancelling waiting:", error);
      throw error;
    }
  }

  /**
   * 標記過號
   */
  async expireWaiting(id: string): Promise<WaitingListResponse> {
    try {
      const now = Date.now();
      const entry = await this.getWaitingListEntryById(id);

      if (!entry) {
        throw new Error("候位記錄不存在");
      }

      await this.db.run(sql`
        UPDATE waiting_list
        SET status = 'expired',
            expired_at = ${now},
            updated_at = ${now}
        WHERE id = ${id}
      `);

      // 釋放預留的桌位
      if (entry.tableId) {
        await this.updateTableStatus(entry.tableId, "available");
      }

      // TODO: 發送過號通知

      // 更新後續候位的等待時間
      await this.recalculateWaitTimes(entry.restaurantId);

      return this.getWaitingListEntryById(id) as Promise<WaitingListResponse>;
    } catch (error) {
      console.error("Error expiring waiting:", error);
      throw error;
    }
  }

  // ==========================================
  // 等待時間預估演算法 (Wait Time Estimation)
  // ==========================================

  /**
   * 預估等待時間
   */
  async estimateWaitTime(
    request: WaitTimeEstimateRequest,
  ): Promise<WaitTimeEstimateResult> {
    try {
      const { restaurantId, partySize } = request;

      // 1. 計算平均翻桌時間（過去2小時）
      const avgTurnoverResult = (await this.db.get(sql`
        SELECT AVG(
          CASE
            WHEN o.completed_at IS NOT NULL AND o.created_at IS NOT NULL
            THEN (o.completed_at - o.created_at) / 60000.0
            ELSE NULL
          END
        ) as avg_turnover_minutes
        FROM orders o
        WHERE o.restaurant_id = ${restaurantId}
          AND o.completed_at > ${Date.now() - 2 * 60 * 60 * 1000}
          AND o.status = 'completed'
      `)) as any;

      const avgTurnover = avgTurnoverResult?.avg_turnover_minutes || 45; // 默認45分鐘

      // 2. 統計適合的桌位數量
      const suitableTablesResult = (await this.db.get(sql`
        SELECT COUNT(*) as count
        FROM tables
        WHERE restaurant_id = ${restaurantId}
          AND is_active = 1
          AND capacity >= ${partySize}
          AND capacity <= ${partySize + 2}
      `)) as any;

      const suitableTables = suitableTablesResult?.count || 1;

      // 3. 計算前方排隊人數
      const aheadResult = (await this.db.get(sql`
        SELECT COUNT(*) as count
        FROM waiting_list
        WHERE restaurant_id = ${restaurantId}
          AND status = 'waiting'
          AND party_size <= ${partySize + 2}
          AND DATE(created_at / 1000, 'unixepoch', 'localtime') = DATE('now', 'localtime')
      `)) as any;

      const partiesAhead = aheadResult?.count || 0;

      // 4. 檢查當前桌位佔用情況
      const occupiedResult = (await this.db.get(sql`
        SELECT
          COUNT(*) as occupied_count,
          MIN(estimated_turnover_at) as earliest_available
        FROM tables
        WHERE restaurant_id = ${restaurantId}
          AND current_status IN ('occupied', 'reserved')
          AND capacity >= ${partySize}
          AND capacity <= ${partySize + 2}
      `)) as any;

      const occupiedTables = occupiedResult?.occupied_count || 0;
      const availableTables = Math.max(0, suitableTables - occupiedTables);

      // 5. 綜合計算
      let estimatedWaitMinutes = 0;

      if (availableTables > 0 && partiesAhead === 0) {
        // 有空桌且沒人排隊 -> 立即可用
        estimatedWaitMinutes = 5;
      } else {
        // 基礎等待時間 = (前方人數 × 平均翻桌時間) / 適合桌位數
        estimatedWaitMinutes =
          (partiesAhead * avgTurnover) / Math.max(suitableTables, 1);

        // 時段調整因子
        const currentHour = new Date().getHours();
        if (currentHour >= 18 && currentHour <= 20) {
          // 尖峰時段 +20%
          estimatedWaitMinutes *= 1.2;
        } else if (currentHour >= 14 && currentHour <= 17) {
          // 離峰時段 -10%
          estimatedWaitMinutes *= 0.9;
        }

        // 如果有桌位即將釋放，減少5分鐘
        if (occupiedResult?.earliest_available) {
          const timeUntilAvailable =
            (occupiedResult.earliest_available - Date.now()) / 60000;
          if (
            timeUntilAvailable > 0 &&
            timeUntilAvailable < estimatedWaitMinutes
          ) {
            estimatedWaitMinutes = Math.max(estimatedWaitMinutes - 5, 10);
          }
        }

        // 確保最少10分鐘
        estimatedWaitMinutes = Math.max(estimatedWaitMinutes, 10);
      }

      // 四捨五入到5的倍數
      estimatedWaitMinutes = Math.round(estimatedWaitMinutes / 5) * 5;

      // 6. 計算信心度
      const confidence = this.calculateConfidence(
        partiesAhead,
        availableTables,
        avgTurnover,
      );

      return {
        estimatedWaitMinutes: Math.round(estimatedWaitMinutes),
        partiesAhead,
        availableTables,
        confidence,
      };
    } catch (error) {
      console.error("Error estimating wait time:", error);
      return {
        estimatedWaitMinutes: 30, // 默認30分鐘
        partiesAhead: 0,
        availableTables: 0,
        confidence: 0.5,
      };
    }
  }

  /**
   * 取得排隊狀態
   */
  async getQueueStatus(restaurantId: string): Promise<QueueStatus> {
    try {
      // 統計等待中的候位
      const totalWaitingResult = (await this.db.get(sql`
        SELECT COUNT(*) as count
        FROM waiting_list
        WHERE restaurant_id = ${restaurantId}
          AND status = 'waiting'
          AND DATE(created_at / 1000, 'unixepoch', 'localtime') = DATE('now', 'localtime')
      `)) as any;

      const totalWaiting = totalWaitingResult?.count || 0;

      // 計算平均等待時間
      const estimate = await this.estimateWaitTime({
        restaurantId,
        partySize: 4,
      });

      // 查詢可用桌位
      const availableTablesResult = (await this.db.get(sql`
        SELECT COUNT(*) as count
        FROM tables
        WHERE restaurant_id = ${restaurantId}
          AND is_active = 1
          AND current_status = 'available'
      `)) as any;

      const availableTables = availableTablesResult?.count || 0;

      // 按桌型統計
      const byTableType: any[] = [];

      for (const size of [2, 4, 6]) {
        const waitingResult = (await this.db.get(sql`
          SELECT COUNT(*) as count
          FROM waiting_list
          WHERE restaurant_id = ${restaurantId}
            AND status = 'waiting'
            AND party_size <= ${size}
            AND DATE(created_at / 1000, 'unixepoch', 'localtime') = DATE('now', 'localtime')
        `)) as any;

        const waiting = waitingResult?.count || 0;

        const sizeEstimate = await this.estimateWaitTime({
          restaurantId,
          partySize: size,
        });

        byTableType.push({
          type: `${size}-person`,
          waiting,
          averageWait: sizeEstimate.estimatedWaitMinutes,
        });
      }

      return {
        restaurantId,
        totalWaiting,
        averageWaitMinutes: estimate.estimatedWaitMinutes,
        availableTables,
        byTableType,
      };
    } catch (error) {
      console.error("Error getting queue status:", error);
      throw error;
    }
  }

  // ==========================================
  // 統計分析 (Statistics)
  // ==========================================

  /**
   * 取得候位統計
   */
  async getWaitingStats(
    restaurantId: string,
    date?: string,
  ): Promise<WaitingStats> {
    try {
      let whereClause = "restaurant_id = ?";
      const params = [restaurantId];

      if (date) {
        whereClause +=
          " AND DATE(created_at / 1000, 'unixepoch', 'localtime') = ?";
        params.push(date);
      } else {
        whereClause +=
          " AND DATE(created_at / 1000, 'unixepoch', 'localtime') = DATE('now', 'localtime')";
      }

      // 替換參數占位符
      const replaceParams = (sqlStr: string, paramArray: any[]): string => {
        let paramIndex = 0;
        return sqlStr.replace(/\?/g, () => {
          const param = paramArray[paramIndex++];
          if (param === null || param === undefined) return "NULL";
          if (typeof param === "number") return String(param);
          if (typeof param === "string")
            return `'${param.replace(/'/g, "''")}'`;
          return `'${String(param).replace(/'/g, "''")}'`;
        });
      };

      const result = (await this.db.get(
        sql.raw(
          replaceParams(
            `
          SELECT
            COUNT(*) as total_waiting,
            SUM(CASE WHEN status = 'seated' THEN 1 ELSE 0 END) as seated_count,
            SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired_count,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
            AVG(CASE
              WHEN seated_at IS NOT NULL AND created_at IS NOT NULL
              THEN (seated_at - created_at) / 60000.0
              ELSE NULL
            END) as avg_wait_minutes,
            ROUND(CAST(SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) AS REAL) / COUNT(*) * 100, 2) as expire_rate
          FROM waiting_list
          WHERE ${whereClause}
        `,
            params,
          ),
        ),
      )) as any;

      return {
        restaurantId,
        date,
        totalWaiting: result?.total_waiting || 0,
        seatedCount: result?.seated_count || 0,
        expiredCount: result?.expired_count || 0,
        cancelledCount: result?.cancelled_count || 0,
        avgWaitMinutes: Math.round(result?.avg_wait_minutes || 0),
        expireRate: result?.expire_rate || 0,
      };
    } catch (error) {
      console.error("Error getting waiting stats:", error);
      throw error;
    }
  }

  // ==========================================
  // 輔助方法 (Helper Methods)
  // ==========================================

  /**
   * 驗證候位資料
   */
  private validateWaitingListData(data: JoinWaitingListRequest): void {
    if (!data.customerName || data.customerName.trim().length === 0) {
      throw new Error("顧客姓名為必填");
    }

    if (
      !data.customerPhone ||
      !/^09\d{8}$/.test(data.customerPhone.replace(/[-\s]/g, ""))
    ) {
      throw new Error("請提供有效的手機號碼");
    }

    if (data.partySize < 1 || data.partySize > 20) {
      throw new Error("用餐人數必須在 1-20 人之間");
    }
  }

  /**
   * 生成排隊號碼
   */
  private async generateQueueNumber(
    restaurantId: string,
    partySize: number,
  ): Promise<{ number: number; letter: string }> {
    try {
      // 根據人數決定前綴
      let letter = "A"; // 2人桌
      if (partySize >= 6) {
        letter = "C"; // 6人+桌
      } else if (partySize >= 4) {
        letter = "B"; // 4人桌
      }

      // 查詢今日該類型最大號碼
      const result = (await this.db.get(sql`
        SELECT MAX(queue_number) as max_number
        FROM waiting_list
        WHERE restaurant_id = ${restaurantId}
          AND queue_letter = ${letter}
          AND DATE(created_at / 1000, 'unixepoch', 'localtime') = DATE('now', 'localtime')
      `)) as any;

      const maxNumber = result?.max_number || 0;
      const nextNumber = maxNumber + 1;

      return { number: nextNumber, letter };
    } catch (error) {
      console.error("Error generating queue number:", error);
      return { number: 1, letter: "A" };
    }
  }

  /**
   * 計算前方還有幾組
   */
  private async getPartiesAhead(
    restaurantId: string,
    queueNumber: number,
    partySize: number,
  ): Promise<number> {
    try {
      const result = (await this.db.get(sql`
        SELECT COUNT(*) as count
        FROM waiting_list
        WHERE restaurant_id = ${restaurantId}
          AND status = 'waiting'
          AND queue_number < ${queueNumber}
          AND party_size <= ${partySize + 2}
          AND DATE(created_at / 1000, 'unixepoch', 'localtime') = DATE('now', 'localtime')
      `)) as any;

      return result?.count || 0;
    } catch (error) {
      console.error("Error getting parties ahead:", error);
      return 0;
    }
  }

  /**
   * 重新計算等待時間（當有人入座或取消時）
   */
  private async recalculateWaitTimes(restaurantId: string): Promise<void> {
    try {
      // 取得所有等待中的候位
      const waitingEntries = (await this.db.all(sql`
        SELECT id, party_size
        FROM waiting_list
        WHERE restaurant_id = ${restaurantId}
          AND status = 'waiting'
          AND DATE(created_at / 1000, 'unixepoch', 'localtime') = DATE('now', 'localtime')
        ORDER BY queue_number ASC
      `)) as any[];

      // 更新每個候位的預估時間
      for (const entry of waitingEntries) {
        const estimate = await this.estimateWaitTime({
          restaurantId,
          partySize: entry.party_size,
        });

        await this.db.run(sql`
          UPDATE waiting_list
          SET estimated_wait_minutes = ${estimate.estimatedWaitMinutes},
              updated_at = ${Date.now()}
          WHERE id = ${entry.id}
        `);
      }
    } catch (error) {
      console.error("Error recalculating wait times:", error);
    }
  }

  /**
   * 計算預估信心度
   */
  private calculateConfidence(
    partiesAhead: number,
    availableTables: number,
    avgTurnover: number,
  ): number {
    // 基礎信心度
    let confidence = 0.8;

    // 前方人數越多，信心度越低
    if (partiesAhead > 5) {
      confidence -= 0.1;
    }
    if (partiesAhead > 10) {
      confidence -= 0.1;
    }

    // 沒有可用桌位，信心度降低
    if (availableTables === 0) {
      confidence -= 0.2;
    }

    // 平均翻桌時間異常，信心度降低
    if (avgTurnover < 20 || avgTurnover > 90) {
      confidence -= 0.1;
    }

    return Math.max(0.3, Math.min(1.0, confidence));
  }

  /**
   * 更新桌位狀態
   */
  private async updateTableStatus(
    tableId: number,
    status: string,
    reservationId?: string | null,
    waitingListId?: string,
  ): Promise<void> {
    try {
      const now = Date.now();

      if (status === "reserved") {
        if (waitingListId) {
          await this.db.run(sql`
            UPDATE tables
            SET current_status = ${status},
                waiting_list_id = ${waitingListId},
                updated_at = ${now}
            WHERE id = ${tableId}
          `);
        } else if (reservationId) {
          await this.db.run(sql`
            UPDATE tables
            SET current_status = ${status},
                reservation_id = ${reservationId},
                updated_at = ${now}
            WHERE id = ${tableId}
          `);
        }
      } else if (status === "occupied") {
        await this.db.run(sql`
          UPDATE tables
          SET current_status = ${status},
              occupied_since = ${now},
              estimated_turnover_at = ${now + 90 * 60 * 1000},
              updated_at = ${now}
          WHERE id = ${tableId}
        `);
      } else if (status === "available") {
        await this.db.run(sql`
          UPDATE tables
          SET current_status = ${status},
              reservation_id = NULL,
              waiting_list_id = NULL,
              occupied_since = NULL,
              estimated_turnover_at = NULL,
              updated_at = ${now}
          WHERE id = ${tableId}
        `);
      } else {
        await this.db.run(sql`
          UPDATE tables
          SET current_status = ${status},
              updated_at = ${now}
          WHERE id = ${tableId}
        `);
      }
    } catch (error) {
      console.error("Error updating table status:", error);
    }
  }

  /**
   * 生成 UUID
   */
  private generateUUID(): string {
    return (
      "wait_" +
      Date.now().toString(36) +
      Math.random().toString(36).substr(2, 9)
    );
  }

  /**
   * 格式化候位回應
   */
  private formatWaitingListResponse(
    data: any,
    partiesAhead: number,
  ): WaitingListResponse {
    return {
      id: data.id,
      restaurantId: data.restaurant_id,
      customerId: data.customer_id,
      customerName: data.customer_name,
      customerPhone: data.customer_phone,
      partySize: data.party_size,
      preferredTableType: data.preferred_table_type,
      queueNumber: data.queue_number,
      queueLetter: data.queue_letter,
      queueDisplay: `${data.queue_letter || ""}${String(data.queue_number).padStart(3, "0")}`,
      priority: data.priority,
      estimatedWaitMinutes: data.estimated_wait_minutes,
      tableId: data.table_id,
      status: data.status,
      notes: data.notes,
      createdAt: data.created_at,
      calledAt: data.called_at,
      notifiedAt: data.notified_at,
      confirmedAt: data.confirmed_at,
      seatedAt: data.seated_at,
      cancelledAt: data.cancelled_at,
      expiredAt: data.expired_at,
      timeoutAt: data.timeout_at,
      updatedAt: data.updated_at,
      partiesAhead,
      table: data.table ? JSON.parse(data.table) : undefined,
    };
  }
}
