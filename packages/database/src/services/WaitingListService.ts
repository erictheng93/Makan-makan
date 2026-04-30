import { sql, type SQL } from "drizzle-orm";
import { BaseService } from "./base";
import { tables as restaurantTables } from "../schema/tables";
import { waitingList } from "../schema/waiting-list";
import { WaitingStatus } from "@makanmakan/shared-types";
import type {
  WaitingListEntry,
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

/** Call timeout: 5 minutes */
const CALL_TIMEOUT_MS = 5 * 60 * 1000;
/** Default table occupancy estimate: 90 minutes */
const DEFAULT_OCCUPANCY_MS = 90 * 60 * 1000;
/** Default turnover estimate when no data: 45 minutes */
const DEFAULT_TURNOVER_MINUTES = 45;
/** Default wait estimate on error: 30 minutes */
const DEFAULT_WAIT_MINUTES = 30;

type TableStatusAction = "reserved" | "occupied" | "available";

interface WaitingListDbRow {
  id: string;
  restaurant_id: string;
  customer_id?: number | null;
  customer_name: string;
  customer_phone: string;
  party_size: number;
  preferred_table_type?: string | null;
  queue_number: number;
  queue_letter?: string | null;
  priority: number;
  estimated_wait_minutes?: number | null;
  table_id?: number | null;
  status: WaitingStatus;
  notes?: string | null;
  created_at: number;
  called_at?: number | null;
  notified_at?: number | null;
  confirmed_at?: number | null;
  seated_at?: number | null;
  cancelled_at?: number | null;
  expired_at?: number | null;
  timeout_at?: number | null;
  updated_at: number;
  table?: string | null;
}

interface AvailableTableRow {
  id: number;
  table_number?: string | null;
  capacity: number;
}

interface WaitingStatsRow {
  total_waiting?: number | null;
  seated_count?: number | null;
  expired_count?: number | null;
  cancelled_count?: number | null;
  avg_wait_minutes?: number | null;
  expire_rate?: number | null;
}

interface QueueNumberRow {
  max_number?: number | null;
}

interface CountRow {
  count?: number | null;
}

interface WaitingPartySizeRow {
  id: string;
  party_size: number;
}

const getMutationChanges = (result: unknown): number => {
  if (typeof result !== "object" || result === null || !("meta" in result)) {
    return 0;
  }

  const meta = (result as { meta?: { changes?: unknown } }).meta;
  return typeof meta?.changes === "number" ? meta.changes : 0;
};

export class WaitingListService extends BaseService {
  private reservationService: ReservationService;

  constructor(d1: any, env: any) {
    super(d1, env);
    this.reservationService = new ReservationService(d1, env);
  }

  /**
   * 非阻塞發送候位通知（失敗不影響主流程）
   */
  private async sendWaitingNotification(
    phone: string,
    category:
      | "waiting_list_confirmed"
      | "waiting_list_called"
      | "waiting_list_expired",
    data: Record<string, string>,
  ): Promise<void> {
    try {
      if (!this.env?.TWILIO_ACCOUNT_SID) return; // SMS not configured, skip

      const { TwilioSMSProvider, notificationTemplates } =
        await import("./NotificationService");
      const provider = new TwilioSMSProvider(
        this.env.TWILIO_ACCOUNT_SID as string,
        this.env.TWILIO_AUTH_TOKEN as string,
        this.env.TWILIO_PHONE_NUMBER as string,
      );
      const template = notificationTemplates[category];
      if (!template?.body) return;

      let body = template.body;
      for (const [key, value] of Object.entries(data)) {
        body = body.replaceAll(`{{${key}}}`, value);
      }

      await provider.sendSMS({ to: phone, body });
    } catch (error) {
      console.error(`Waiting list notification failed (${category}):`, error);
      // Intentionally swallowed — notification failure must not block operation
    }
  }

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
      const existingEntry = await this.db.get<{ id: string }>(sql`
        SELECT id FROM waiting_list
        WHERE restaurant_id = ${data.restaurantId}
          AND customer_phone = ${data.customerPhone}
          AND status IN ('waiting', 'called', 'confirmed')
          AND DATE(created_at / 1000, 'unixepoch', 'localtime') = DATE('now', 'localtime')
      `);

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

      // 發送候位確認通知（非阻塞）
      this.sendWaitingNotification(
        data.customerPhone,
        "waiting_list_confirmed",
        {
          customerName: data.customerName,
          queueNumber: `${entry.queueLetter}${entry.queueNumber}`,
          estimatedWait: String(
            entry.estimatedWaitMinutes || DEFAULT_WAIT_MINUTES,
          ),
        },
      );

      // Construct response from local data to avoid a redundant DB round-trip
      return {
        id: entry.id!,
        restaurantId: entry.restaurantId!,
        customerId: entry.customerId ?? undefined,
        customerName: entry.customerName!,
        customerPhone: entry.customerPhone!,
        partySize: entry.partySize!,
        preferredTableType: entry.preferredTableType ?? undefined,
        queueNumber: entry.queueNumber!,
        queueLetter: entry.queueLetter,
        queueDisplay: `${entry.queueLetter || ""}${String(entry.queueNumber).padStart(3, "0")}`,
        priority: entry.priority!,
        estimatedWaitMinutes: entry.estimatedWaitMinutes,
        status: entry.status!,
        notes: entry.notes ?? undefined,
        createdAt: entry.createdAt!,
        updatedAt: entry.updatedAt!,
        partiesAhead: waitEstimate.partiesAhead,
      } as WaitingListResponse;
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
      const result = await this.db.get<WaitingListDbRow>(sql`
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
      `);

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
      const conditions: SQL[] = [];

      if (filters.restaurantId) {
        conditions.push(
          sql`${waitingList.restaurantId} = ${filters.restaurantId}`,
        );
      }

      if (filters.status) {
        if (Array.isArray(filters.status)) {
          const statusList = sql.join(
            filters.status.map((status) => sql`${status}`),
            sql`, `,
          );
          conditions.push(sql`${waitingList.status} IN (${statusList})`);
        } else {
          conditions.push(sql`${waitingList.status} = ${filters.status}`);
        }
      }

      if (filters.customerPhone) {
        conditions.push(
          sql`${waitingList.customerPhone} = ${filters.customerPhone}`,
        );
      }

      if (filters.date) {
        conditions.push(
          sql`DATE(${waitingList.createdAt} / 1000, 'unixepoch', 'localtime') = ${filters.date}`,
        );
      } else {
        // 默認只顯示今天的
        conditions.push(
          sql`DATE(${waitingList.createdAt} / 1000, 'unixepoch', 'localtime') = DATE('now', 'localtime')`,
        );
      }

      // 分頁
      const page = filters.page || 1;
      const limit = filters.limit || 50;
      const offset = (page - 1) * limit;
      const whereExpr =
        conditions.length > 0 ? sql.join(conditions, sql` AND `) : sql`1 = 1`;

      const countResult = await this.db.get<{ total: number }>(sql`
        SELECT COUNT(*) as total
        FROM ${waitingList}
        WHERE ${whereExpr}
      `);

      const total = countResult?.total || 0;

      const results = await this.db.all<WaitingListDbRow>(sql`
        SELECT
          ${waitingList}.*,
          json_object(
            'id', ${restaurantTables.id},
            'number', ${restaurantTables.number},
            'capacity', ${restaurantTables.capacity}
          ) as "table"
        FROM ${waitingList}
        LEFT JOIN ${restaurantTables}
          ON ${waitingList.tableId} = ${restaurantTables.id}
        WHERE ${whereExpr}
        ORDER BY
          CASE ${waitingList.status}
            WHEN 'waiting' THEN 1
            WHEN 'called' THEN 2
            ELSE 3
          END,
          ${waitingList.queueNumber} ASC
        LIMIT ${limit} OFFSET ${offset}
      `);

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
      const table = await this.db.get<AvailableTableRow>(sql`
        SELECT * FROM tables
        WHERE id = ${request.tableId}
          AND restaurant_id = ${entry.restaurantId}
          AND is_occupied = 0
      `);

      if (!table) {
        throw new Error("桌位不可用");
      }

      if (table.capacity < entry.partySize) {
        throw new Error("桌位容量不足");
      }

      const timeoutAt = now + CALL_TIMEOUT_MS;

      // 更新候位記錄（樂觀鎖：WHERE 包含狀態條件防止並發衝突）
      const callResult = await this.db.run(sql`
        UPDATE waiting_list
        SET status = 'called',
            table_id = ${request.tableId},
            called_at = ${now},
            timeout_at = ${timeoutAt},
            updated_at = ${now}
        WHERE id = ${id} AND status = 'waiting'
      `);
      if (getMutationChanges(callResult) === 0) {
        throw new Error("叫號失敗：狀態已被其他操作更新，請刷新");
      }

      // 更新桌位狀態為預留
      await this.updateTableStatus(request.tableId, "reserved", null, id);

      // 發送叫號通知（非阻塞）
      if (entry.customerPhone) {
        this.sendWaitingNotification(
          entry.customerPhone,
          "waiting_list_called",
          {
            customerName: entry.customerName,
            tableNumber: table.table_number || `桌${request.tableId}`,
          },
        );
      }

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

      const confirmResult = await this.db.run(sql`
        UPDATE waiting_list
        SET status = 'confirmed',
            confirmed_at = ${now},
            updated_at = ${now}
        WHERE id = ${id} AND status = 'called'
      `);
      if (getMutationChanges(confirmResult) === 0) {
        throw new Error("確認失敗：狀態已被其他操作更新，請刷新");
      }

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

      const seatResult = await this.db.run(sql`
        UPDATE waiting_list
        SET status = 'seated',
            seated_at = ${now},
            updated_at = ${now}
        WHERE id = ${id} AND (status = 'called' OR status = 'confirmed')
      `);
      if (getMutationChanges(seatResult) === 0) {
        throw new Error("入座失敗：狀態已被其他操作更新，請刷新");
      }

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

      // 只允許從 waiting/called/confirmed 狀態取消
      if (!["waiting", "called", "confirmed"].includes(entry.status)) {
        throw new Error(`無法取消，當前狀態: ${entry.status}`);
      }

      const cancelResult = await this.db.run(sql`
        UPDATE waiting_list
        SET status = 'cancelled',
            cancelled_at = ${now},
            updated_at = ${now}
        WHERE id = ${id} AND status IN ('waiting', 'called', 'confirmed')
      `);
      if (getMutationChanges(cancelResult) === 0) {
        throw new Error("取消失敗：狀態已被其他操作更新，請刷新");
      }

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

      // 只允許從 waiting/called/confirmed 狀態標記過期
      if (!["waiting", "called", "confirmed"].includes(entry.status)) {
        throw new Error(`無法標記過期，當前狀態: ${entry.status}`);
      }

      const expireResult = await this.db.run(sql`
        UPDATE waiting_list
        SET status = 'expired',
            expired_at = ${now},
            updated_at = ${now}
        WHERE id = ${id} AND status IN ('waiting', 'called', 'confirmed')
      `);
      if (getMutationChanges(expireResult) === 0) {
        throw new Error("過期標記失敗：狀態已被其他操作更新，請刷新");
      }

      // 釋放預留的桌位
      if (entry.tableId) {
        await this.updateTableStatus(entry.tableId, "available");
      }

      // 發送過號通知（非阻塞）
      if (entry.customerPhone) {
        this.sendWaitingNotification(
          entry.customerPhone,
          "waiting_list_expired",
          {
            customerName: entry.customerName,
            queueNumber: entry.queueLetter
              ? `${entry.queueLetter}${entry.queueNumber}`
              : String(entry.queueNumber),
          },
        );
      }

      // 更新後續候位的等待時間
      await this.recalculateWaitTimes(entry.restaurantId);

      return this.getWaitingListEntryById(id) as Promise<WaitingListResponse>;
    } catch (error) {
      console.error("Error expiring waiting:", error);
      throw error;
    }
  }

  /**
   * 自動尋找最適合的可用桌位（best-fit: 容量最小且 >= partySize）
   * 排除已被候位預留的桌位（waiting_list_id IS NOT NULL）
   */
  async findAvailableTable(
    restaurantId: string,
    partySize: number,
    excludeTableIds: number[] = [],
  ): Promise<TableAssignmentResult | null> {
    const table = await this.db.get<AvailableTableRow>(sql`
      SELECT id, table_number, capacity
      FROM tables
      WHERE restaurant_id = ${restaurantId}
        AND is_active = 1
        AND is_occupied = 0
        AND waiting_list_id IS NULL
        AND capacity >= ${partySize}
      ORDER BY capacity ASC, id ASC
      LIMIT 1
    `);

    if (!table) return null;

    // 排除已在本次批次中分配的桌位
    if (excludeTableIds.includes(table.id)) return null;

    return {
      tableId: table.id,
      tableNumber: table.table_number || `T${table.id}`,
      confidence:
        table.capacity === partySize
          ? 1.0
          : Math.max(0.5, 1.0 - (table.capacity - partySize) * 0.1),
      reason: `自動分配：${table.capacity}人桌 (最佳匹配)`,
    };
  }

  /**
   * 批次叫號：自動為排隊中的客人分配桌位
   */
  async batchCallNext(
    restaurantId: string,
    count: number = 1,
  ): Promise<
    Array<{
      id: string;
      success: boolean;
      tableId?: number;
      message: string;
    }>
  > {
    const { data: waitingList } = await this.listWaitingList({
      restaurantId,
      status: WaitingStatus.WAITING,
      limit: count,
    });

    const results = [];
    const assignedTableIds: number[] = [];

    for (const entry of waitingList) {
      const table = await this.findAvailableTable(
        restaurantId,
        entry.partySize,
        assignedTableIds,
      );
      if (!table) {
        results.push({ id: entry.id, success: false, message: "無可用桌位" });
        continue;
      }

      try {
        await this.callWaiting(entry.id, { tableId: table.tableId });
        assignedTableIds.push(table.tableId);
        results.push({
          id: entry.id,
          success: true,
          tableId: table.tableId,
          message: `已叫號，分配桌位 ${table.tableNumber}`,
        });
      } catch (error) {
        results.push({
          id: entry.id,
          success: false,
          message: error instanceof Error ? error.message : "叫號失敗",
        });
      }
    }

    return results;
  }

  /**
   * 預估等待時間
   */
  async estimateWaitTime(
    request: WaitTimeEstimateRequest,
  ): Promise<WaitTimeEstimateResult> {
    try {
      const { restaurantId, partySize } = request;

      // Run all 4 independent queries in parallel
      const [
        avgTurnoverResult,
        suitableTablesResult,
        aheadResult,
        occupiedResult,
      ] = await Promise.all([
        this.db.get(sql`
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
          `) as Promise<any>,
        this.db.get(sql`
            SELECT COUNT(*) as count
            FROM tables
            WHERE restaurant_id = ${restaurantId}
              AND is_active = 1
              AND capacity >= ${partySize}
              AND capacity <= ${partySize + 2}
          `) as Promise<any>,
        this.db.get(sql`
            SELECT COUNT(*) as count
            FROM waiting_list
            WHERE restaurant_id = ${restaurantId}
              AND status = 'waiting'
              AND party_size <= ${partySize + 2}
              AND DATE(created_at / 1000, 'unixepoch', 'localtime') = DATE('now', 'localtime')
          `) as Promise<any>,
        this.db.get(sql`
            SELECT
              COUNT(*) as occupied_count,
              MIN(estimated_turnover_at) as earliest_available
            FROM tables
            WHERE restaurant_id = ${restaurantId}
              AND is_occupied = 1
              AND capacity >= ${partySize}
              AND capacity <= ${partySize + 2}
          `) as Promise<any>,
      ]);

      const avgTurnover =
        avgTurnoverResult?.avg_turnover_minutes || DEFAULT_TURNOVER_MINUTES;
      const suitableTables = suitableTablesResult?.count || 1;
      const partiesAhead = aheadResult?.count || 0;
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
        estimatedWaitMinutes: DEFAULT_WAIT_MINUTES,
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
      // Run counts + all estimates in parallel (was 21 sequential queries)
      const [
        totalWaitingResult,
        availableTablesResult,
        estimate,
        ...sizeEstimates
      ] = await Promise.all([
        this.db.get(sql`
            SELECT
              COUNT(*) as total,
              SUM(CASE WHEN party_size <= 2 THEN 1 ELSE 0 END) as wait_2,
              SUM(CASE WHEN party_size <= 4 THEN 1 ELSE 0 END) as wait_4,
              SUM(CASE WHEN party_size <= 6 THEN 1 ELSE 0 END) as wait_6
            FROM waiting_list
            WHERE restaurant_id = ${restaurantId}
              AND status = 'waiting'
              AND DATE(created_at / 1000, 'unixepoch', 'localtime') = DATE('now', 'localtime')
          `) as Promise<any>,
        this.db.get(sql`
            SELECT COUNT(*) as count
            FROM tables
            WHERE restaurant_id = ${restaurantId}
              AND is_active = 1
              AND is_occupied = 0
          `) as Promise<any>,
        this.estimateWaitTime({ restaurantId, partySize: 4 }),
        this.estimateWaitTime({ restaurantId, partySize: 2 }),
        this.estimateWaitTime({ restaurantId, partySize: 4 }),
        this.estimateWaitTime({ restaurantId, partySize: 6 }),
      ]);

      const totalWaiting = totalWaitingResult?.total || 0;
      const availableTables = availableTablesResult?.count || 0;

      const sizes = [2, 4, 6] as const;
      const waitCounts = [
        totalWaitingResult?.wait_2 || 0,
        totalWaitingResult?.wait_4 || 0,
        totalWaitingResult?.wait_6 || 0,
      ];
      const byTableType = sizes.map((size, i) => ({
        type: `${size}-person`,
        waiting: waitCounts[i],
        averageWait: sizeEstimates[i].estimatedWaitMinutes,
      }));

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

  /**
   * 取得候位統計
   */
  async getWaitingStats(
    restaurantId: string,
    date?: string,
  ): Promise<WaitingStats> {
    try {
      const conditions: SQL[] = [
        sql`${waitingList.restaurantId} = ${restaurantId}`,
      ];

      if (date) {
        conditions.push(
          sql`DATE(${waitingList.createdAt} / 1000, 'unixepoch', 'localtime') = ${date}`,
        );
      } else {
        conditions.push(
          sql`DATE(${waitingList.createdAt} / 1000, 'unixepoch', 'localtime') = DATE('now', 'localtime')`,
        );
      }

      const whereExpr = sql.join(conditions, sql` AND `);
      const result = await this.db.get<WaitingStatsRow>(sql`
        SELECT
          COUNT(*) as total_waiting,
          SUM(CASE WHEN ${waitingList.status} = 'seated' THEN 1 ELSE 0 END) as seated_count,
          SUM(CASE WHEN ${waitingList.status} = 'expired' THEN 1 ELSE 0 END) as expired_count,
          SUM(CASE WHEN ${waitingList.status} = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
          AVG(CASE
            WHEN ${waitingList.seatedAt} IS NOT NULL
              AND ${waitingList.createdAt} IS NOT NULL
            THEN (${waitingList.seatedAt} - ${waitingList.createdAt}) / 60000.0
            ELSE NULL
          END) as avg_wait_minutes,
          ROUND(CAST(SUM(CASE WHEN ${waitingList.status} = 'expired' THEN 1 ELSE 0 END) AS REAL) / NULLIF(COUNT(*), 0) * 100, 2) as expire_rate
        FROM ${waitingList}
        WHERE ${whereExpr}
      `);

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
      const result = await this.db.get<QueueNumberRow>(sql`
        SELECT MAX(queue_number) as max_number
        FROM waiting_list
        WHERE restaurant_id = ${restaurantId}
          AND queue_letter = ${letter}
          AND DATE(created_at / 1000, 'unixepoch', 'localtime') = DATE('now', 'localtime')
      `);

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
      const result = await this.db.get<CountRow>(sql`
        SELECT COUNT(*) as count
        FROM waiting_list
        WHERE restaurant_id = ${restaurantId}
          AND status = 'waiting'
          AND queue_number < ${queueNumber}
          AND party_size <= ${partySize + 2}
          AND DATE(created_at / 1000, 'unixepoch', 'localtime') = DATE('now', 'localtime')
      `);

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
      const waitingEntries = await this.db.all<WaitingPartySizeRow>(sql`
        SELECT id, party_size
        FROM waiting_list
        WHERE restaurant_id = ${restaurantId}
          AND status = 'waiting'
          AND DATE(created_at / 1000, 'unixepoch', 'localtime') = DATE('now', 'localtime')
        ORDER BY queue_number ASC
      `);

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
    status: TableStatusAction,
    reservationId?: string | null,
    waitingListId?: string,
  ): Promise<void> {
    try {
      const now = Date.now();

      if (status === "reserved") {
        if (waitingListId) {
          await this.db.run(sql`
            UPDATE tables
            SET is_occupied = 0,
                waiting_list_id = ${waitingListId},
                updated_at_ms = ${now}
            WHERE id = ${tableId}
          `);
        } else if (reservationId) {
          await this.db.run(sql`
            UPDATE tables
            SET is_occupied = 0,
                reservation_id = ${reservationId},
                updated_at_ms = ${now}
            WHERE id = ${tableId}
          `);
        }
      } else if (status === "occupied") {
        await this.db.run(sql`
          UPDATE tables
          SET is_occupied = 1,
              occupied_at_ms = ${now},
              estimated_free_at_ms = ${now + DEFAULT_OCCUPANCY_MS},
              updated_at_ms = ${now}
          WHERE id = ${tableId}
        `);
      } else if (status === "available") {
        await this.db.run(sql`
          UPDATE tables
          SET is_occupied = 0,
              reservation_id = NULL,
              waiting_list_id = NULL,
              occupied_at_ms = NULL,
              estimated_free_at_ms = NULL,
              updated_at_ms = ${now}
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
