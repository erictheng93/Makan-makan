import { eq, sql, type SQL } from "drizzle-orm";
import { BaseService } from "./base";
import { reservations } from "../schema/reservations";
import type { NewReservation } from "../schema/reservations";
import { tables } from "../schema/tables";
import type {
  Reservation,
  ReservationStatus,
  CreateReservationRequest,
  UpdateReservationRequest,
  ReservationFilters,
  ReservationResponse,
  AvailabilityRequest,
  TimeSlotAvailability,
  AvailabilityResponse,
  ReservationSlot,
  CreateSlotRequest,
  UpdateSlotRequest,
  BatchCreateSlotsRequest,
  ReservationStats,
  TableAssignmentRequest,
  TableAssignmentResult,
} from "@makanmakan/shared-types";

interface ReservationDbRow {
  id: string;
  restaurant_id: string;
  customer_id?: number | null;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  duration_minutes: number;
  table_id?: number | null;
  special_requests?: string | null;
  status: ReservationStatus;
  confirmation_code?: string | null;
  notes?: string | null;
  created_at: number;
  confirmed_at?: number | null;
  reminded_at?: number | null;
  arrived_at?: number | null;
  seated_at?: number | null;
  completed_at?: number | null;
  cancelled_at?: number | null;
  no_show_at?: number | null;
  updated_at: number;
  table?: string | null;
  customer?: string | null;
}

const nullToUndefined = <T>(value: T | null | undefined): T | undefined =>
  value ?? undefined;

/**
 * 訂位系統服務
 * 負責訂位管理、時段容量管理、智能桌位分配
 */
export class ReservationService extends BaseService {
  // ==========================================
  // 訂位管理 (Reservation Management)
  // ==========================================

  /**
   * 建立新訂位
   */
  async createReservation(
    data: CreateReservationRequest,
  ): Promise<ReservationResponse> {
    try {
      const now = Date.now();

      // 1. 驗證輸入
      this.validateReservationData(data);

      // 2. 檢查時段容量
      const slotAvailable = await this.checkSlotAvailability(
        data.restaurantId,
        data.reservationDate,
        data.reservationTime,
        data.partySize,
      );

      if (!slotAvailable.available) {
        throw new Error(`該時段不可用: ${slotAvailable.reason}`);
      }

      // 3. 智能桌位分配
      const tableAssignment = await this.assignTable({
        restaurantId: data.restaurantId,
        partySize: data.partySize,
        reservationTime: data.reservationTime,
        specialRequests: data.specialRequests,
      });

      if (!tableAssignment) {
        throw new Error("無法分配合適的桌位");
      }

      // 4. 生成確認碼
      const confirmationCode = this.generateConfirmationCode();

      // 5. 建立訂位記錄
      const reservation: Partial<Reservation> = {
        id: this.generateUUID(),
        restaurantId: data.restaurantId,
        customerId: data.customerId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail,
        partySize: data.partySize,
        reservationDate: data.reservationDate,
        reservationTime: data.reservationTime,
        durationMinutes: data.durationMinutes || 90,
        tableId: tableAssignment.tableId,
        specialRequests: data.specialRequests,
        status: "pending" as ReservationStatus,
        confirmationCode,
        createdAt: now,
        updatedAt: now,
      };

      // 6. 寫入資料庫
      await this.db.run(sql`
        INSERT INTO reservations (
          id, restaurant_id, customer_id, customer_name, customer_phone, customer_email,
          party_size, reservation_date, reservation_time, duration_minutes,
          table_id, special_requests, status, confirmation_code, created_at, updated_at
        ) VALUES (
          ${reservation.id}, ${reservation.restaurantId}, ${reservation.customerId},
          ${reservation.customerName}, ${reservation.customerPhone}, ${reservation.customerEmail},
          ${reservation.partySize}, ${reservation.reservationDate}, ${reservation.reservationTime},
          ${reservation.durationMinutes}, ${reservation.tableId}, ${reservation.specialRequests},
          ${reservation.status}, ${reservation.confirmationCode}, ${reservation.createdAt},
          ${reservation.updatedAt}
        )
      `);

      // 7. 更新時段容量
      await this.incrementSlotUsage(
        data.restaurantId,
        data.reservationDate,
        data.reservationTime,
        data.partySize,
      );

      // 8. 更新桌位狀態
      await this.updateTableStatus(
        tableAssignment.tableId,
        "reserved",
        reservation.id,
      );

      // 9. 自動確認訂位
      await this.confirmReservation(reservation.id as string);

      // 10. 返回完整資料
      return this.getReservationById(
        reservation.id as string,
      ) as Promise<ReservationResponse>;
    } catch (error) {
      console.error("Error creating reservation:", error);
      throw error;
    }
  }

  /**
   * 根據 ID 查詢訂位
   */
  async getReservationById(id: string): Promise<ReservationResponse | null> {
    try {
      const result = await this.db.get<ReservationDbRow>(sql`
        SELECT
          r.*,
          json_object(
            'id', t.id,
            'number', t.number,
            'capacity', t.capacity,
            'location', t.location
          ) as "table",
          json_object(
            'id', u.id,
            'fullName', u.full_name,
            'email', u.email,
            'phone', u.phone
          ) as "customer"
        FROM reservations r
        LEFT JOIN tables t ON r.table_id = t.id
        LEFT JOIN users u ON r.customer_id = u.id
        WHERE r.id = ${id}
      `);

      if (!result) return null;

      return this.formatReservationResponse(result);
    } catch (error) {
      console.error("Error getting reservation:", error);
      throw error;
    }
  }

  /**
   * 根據確認碼查詢訂位
   */
  async getReservationByCode(
    confirmationCode: string,
  ): Promise<ReservationResponse | null> {
    try {
      const result = await this.db.get<ReservationDbRow>(sql`
        SELECT
          r.*,
          json_object(
            'id', t.id,
            'number', t.number,
            'capacity', t.capacity
          ) as "table"
        FROM reservations r
        LEFT JOIN tables t ON r.table_id = t.id
        WHERE r.confirmation_code = ${confirmationCode}
      `);

      if (!result) return null;

      return this.formatReservationResponse(result);
    } catch (error) {
      console.error("Error getting reservation by code:", error);
      throw error;
    }
  }

  /**
   * 查詢訂位列表（支援篩選）
   */
  async listReservations(
    filters: ReservationFilters,
  ): Promise<{ data: ReservationResponse[]; total: number }> {
    try {
      const conditions: SQL[] = [];

      if (filters.restaurantId)
        conditions.push(
          sql`${reservations.restaurantId} = ${filters.restaurantId}`,
        );
      if (filters.customerId)
        conditions.push(
          sql`${reservations.customerId} = ${filters.customerId}`,
        );
      if (filters.customerPhone)
        conditions.push(
          sql`${reservations.customerPhone} = ${filters.customerPhone}`,
        );
      if (filters.status) {
        if (Array.isArray(filters.status)) {
          const list = sql.join(
            filters.status.map((s) => sql`${s}`),
            sql`, `,
          );
          conditions.push(sql`${reservations.status} IN (${list})`);
        } else {
          conditions.push(sql`${reservations.status} = ${filters.status}`);
        }
      }
      if (filters.reservationDate)
        conditions.push(
          sql`${reservations.reservationDate} = ${filters.reservationDate}`,
        );
      if (filters.startDate && filters.endDate)
        conditions.push(
          sql`${reservations.reservationDate} BETWEEN ${filters.startDate} AND ${filters.endDate}`,
        );
      if (filters.tableId)
        conditions.push(sql`${reservations.tableId} = ${filters.tableId}`);
      if (filters.confirmationCode)
        conditions.push(
          sql`${reservations.confirmationCode} = ${filters.confirmationCode}`,
        );

      const whereExpr =
        conditions.length > 0 ? sql.join(conditions, sql` AND `) : sql`1 = 1`;

      // Allowlist: maps the public sortBy keys (and the historical snake_case
      // default that older callers pass) to schema columns. Anything outside
      // this map silently falls back to created_at — never interpolated.
      const sortColMap = {
        createdAt: reservations.createdAt,
        created_at: reservations.createdAt,
        reservationDate: reservations.reservationDate,
        reservation_date: reservations.reservationDate,
        reservationTime: reservations.reservationTime,
        reservation_time: reservations.reservationTime,
      } as const;
      const sortKey = (filters.sortBy ??
        "createdAt") as keyof typeof sortColMap;
      const sortCol = sortColMap[sortKey] ?? reservations.createdAt;
      const sortDir = filters.sortOrder === "asc" ? sql`ASC` : sql`DESC`;

      const page = filters.page || 1;
      const limit = filters.limit || 20;
      const offset = (page - 1) * limit;

      const countRow = await this.db.get<{ total: number }>(sql`
        SELECT COUNT(*) as total FROM ${reservations} WHERE ${whereExpr}
      `);
      const total = countRow?.total ?? 0;

      const rows = await this.db.all<ReservationDbRow>(sql`
        SELECT
          ${reservations}.*,
          json_object(
            'id', ${tables}.id,
            'number', ${tables}.number,
            'capacity', ${tables}.capacity
          ) as "table"
        FROM ${reservations}
        LEFT JOIN ${tables} ON ${reservations.tableId} = ${tables.id}
        WHERE ${whereExpr}
        ORDER BY ${sortCol} ${sortDir}
        LIMIT ${limit} OFFSET ${offset}
      `);

      const data = rows.map((r) => this.formatReservationResponse(r));

      return { data, total };
    } catch (error) {
      console.error("Error listing reservations:", error);
      throw error;
    }
  }

  /**
   * 更新訂位
   */
  async updateReservation(
    id: string,
    data: UpdateReservationRequest,
  ): Promise<ReservationResponse> {
    try {
      const existing = await this.getReservationById(id);
      if (!existing) {
        throw new Error("訂位不存在");
      }

      const updateSet: Partial<NewReservation> = {
        updatedAt: Date.now(),
      };

      if (data.customerName) updateSet.customerName = data.customerName;
      if (data.customerPhone) updateSet.customerPhone = data.customerPhone;
      if (data.customerEmail !== undefined)
        updateSet.customerEmail = data.customerEmail;
      if (data.partySize) updateSet.partySize = data.partySize;
      if (data.reservationDate)
        updateSet.reservationDate = data.reservationDate;
      if (data.reservationTime)
        updateSet.reservationTime = data.reservationTime;
      if (data.durationMinutes)
        updateSet.durationMinutes = data.durationMinutes;
      if (data.tableId !== undefined) updateSet.tableId = data.tableId;
      if (data.specialRequests !== undefined)
        updateSet.specialRequests = data.specialRequests;
      if (data.notes !== undefined) updateSet.notes = data.notes;

      await this.db
        .update(reservations)
        .set(updateSet)
        .where(eq(reservations.id, id));

      return this.getReservationById(id) as Promise<ReservationResponse>;
    } catch (error) {
      console.error("Error updating reservation:", error);
      throw error;
    }
  }

  /**
   * 確認訂位
   */
  async confirmReservation(id: string): Promise<ReservationResponse> {
    try {
      const now = Date.now();
      await this.db.run(sql`
        UPDATE reservations
        SET status = 'confirmed',
            confirmed_at = ${now},
            updated_at = ${now}
        WHERE id = ${id}
      `);

      // TODO: 發送確認通知

      return this.getReservationById(id) as Promise<ReservationResponse>;
    } catch (error) {
      console.error("Error confirming reservation:", error);
      throw error;
    }
  }

  /**
   * 標記到店
   */
  async markArrived(id: string): Promise<ReservationResponse> {
    try {
      const now = Date.now();
      await this.db.run(sql`
        UPDATE reservations
        SET status = 'arrived',
            arrived_at = ${now},
            updated_at = ${now}
        WHERE id = ${id}
      `);

      return this.getReservationById(id) as Promise<ReservationResponse>;
    } catch (error) {
      console.error("Error marking arrived:", error);
      throw error;
    }
  }

  /**
   * 標記入座
   */
  async markSeated(id: string): Promise<ReservationResponse> {
    try {
      const now = Date.now();
      const reservation = await this.getReservationById(id);

      if (!reservation) {
        throw new Error("訂位不存在");
      }

      await this.db.run(sql`
        UPDATE reservations
        SET status = 'seated',
            seated_at = ${now},
            updated_at = ${now}
        WHERE id = ${id}
      `);

      // 更新桌位狀態為 occupied
      if (reservation.tableId) {
        await this.updateTableStatus(reservation.tableId, "occupied", id);
      }

      // TODO: 自動建立訂單記錄

      return this.getReservationById(id) as Promise<ReservationResponse>;
    } catch (error) {
      console.error("Error marking seated:", error);
      throw error;
    }
  }

  /**
   * 完成訂位
   */
  async completeReservation(id: string): Promise<ReservationResponse> {
    try {
      const now = Date.now();
      const reservation = await this.getReservationById(id);

      if (!reservation) {
        throw new Error("訂位不存在");
      }

      await this.db.run(sql`
        UPDATE reservations
        SET status = 'completed',
            completed_at = ${now},
            updated_at = ${now}
        WHERE id = ${id}
      `);

      // 釋放桌位
      if (reservation.tableId) {
        await this.updateTableStatus(reservation.tableId, "cleaning");
      }

      return this.getReservationById(id) as Promise<ReservationResponse>;
    } catch (error) {
      console.error("Error completing reservation:", error);
      throw error;
    }
  }

  /**
   * 取消訂位
   */
  async cancelReservation(
    id: string,
    reason?: string,
  ): Promise<ReservationResponse> {
    try {
      const now = Date.now();
      const reservation = await this.getReservationById(id);

      if (!reservation) {
        throw new Error("訂位不存在");
      }

      await this.db.run(sql`
        UPDATE reservations
        SET status = 'cancelled',
            cancelled_at = ${now},
            notes = COALESCE(notes || ' ', '') || ${`取消原因: ${reason || "顧客取消"}`},
            updated_at = ${now}
        WHERE id = ${id}
      `);

      // 釋放時段容量
      await this.decrementSlotUsage(
        reservation.restaurantId,
        reservation.reservationDate,
        reservation.reservationTime,
        reservation.partySize,
      );

      // 釋放桌位
      if (reservation.tableId) {
        await this.updateTableStatus(reservation.tableId, "available");
      }

      // TODO: 發送取消通知

      return this.getReservationById(id) as Promise<ReservationResponse>;
    } catch (error) {
      console.error("Error cancelling reservation:", error);
      throw error;
    }
  }

  /**
   * 標記 No Show
   */
  async markNoShow(id: string): Promise<ReservationResponse> {
    try {
      const now = Date.now();
      const reservation = await this.getReservationById(id);

      if (!reservation) {
        throw new Error("訂位不存在");
      }

      await this.db.run(sql`
        UPDATE reservations
        SET status = 'no_show',
            no_show_at = ${now},
            updated_at = ${now}
        WHERE id = ${id}
      `);

      // 釋放時段容量
      await this.decrementSlotUsage(
        reservation.restaurantId,
        reservation.reservationDate,
        reservation.reservationTime,
        reservation.partySize,
      );

      // 釋放桌位
      if (reservation.tableId) {
        await this.updateTableStatus(reservation.tableId, "available");
      }

      // TODO: 更新顧客 No Show 記錄

      return this.getReservationById(id) as Promise<ReservationResponse>;
    } catch (error) {
      console.error("Error marking no show:", error);
      throw error;
    }
  }

  // ==========================================
  // 時段容量管理 (Slot Management)
  // ==========================================

  /**
   * 建立時段
   */
  async createSlot(data: CreateSlotRequest): Promise<ReservationSlot> {
    try {
      const id = this.generateUUID();
      const now = Date.now();

      await this.db.run(sql`
        INSERT INTO reservation_slots (
          id, restaurant_id, date, time_slot, max_capacity, max_tables,
          current_reservations, current_capacity, is_available, created_at, updated_at
        ) VALUES (
          ${id}, ${data.restaurantId}, ${data.date}, ${data.timeSlot},
          ${data.maxCapacity}, ${data.maxTables}, 0, 0,
          ${data.isAvailable !== false ? 1 : 0}, ${now}, ${now}
        )
      `);

      return this.getSlotById(id) as Promise<ReservationSlot>;
    } catch (error) {
      console.error("Error creating slot:", error);
      throw error;
    }
  }

  /**
   * 批次建立時段
   */
  async batchCreateSlots(data: BatchCreateSlotsRequest): Promise<number> {
    try {
      const startDate = new Date(data.startDate);
      const endDate = new Date(data.endDate);
      const days =
        Math.ceil(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
        ) + 1;

      let count = 0;

      for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split("T")[0];

        for (const timeSlot of data.timeSlots) {
          try {
            await this.createSlot({
              restaurantId: data.restaurantId,
              date: dateStr,
              timeSlot,
              maxCapacity: data.maxCapacity,
              maxTables: data.maxTables,
              isAvailable: true,
            });
            count++;
          } catch (error) {
            // 忽略重複錯誤
            console.warn(`Slot already exists: ${dateStr} ${timeSlot}`);
          }
        }
      }

      return count;
    } catch (error) {
      console.error("Error batch creating slots:", error);
      throw error;
    }
  }

  /**
   * 查詢可用時段
   */
  async getAvailableSlots(
    request: AvailabilityRequest,
  ): Promise<AvailabilityResponse> {
    try {
      const { restaurantId, date, partySize } = request;

      // 查詢該日所有時段
      const slots = (await this.db.all(sql`
        SELECT * FROM reservation_slots
        WHERE restaurant_id = ${restaurantId}
          AND date = ${date}
          AND is_available = 1
        ORDER BY time_slot ASC
      `)) as Array<{
        time_slot: string;
        max_capacity: number;
        current_capacity: number;
        max_tables: number;
        current_reservations: number;
      }>;

      const availability: TimeSlotAvailability[] = [];

      for (const slot of slots) {
        const remainingCapacity = slot.max_capacity - slot.current_capacity;
        const remainingTables = slot.max_tables - slot.current_reservations;
        const canAccommodate =
          remainingCapacity >= partySize && remainingTables > 0;

        availability.push({
          time: slot.time_slot,
          available: canAccommodate,
          remainingCapacity,
          remainingTables,
          occupancyRate: slot.current_capacity / slot.max_capacity,
          reason: canAccommodate
            ? undefined
            : remainingTables === 0
              ? "桌位已滿"
              : "容量不足",
        });
      }

      return {
        date,
        partySize,
        slots: availability,
      };
    } catch (error) {
      console.error("Error getting available slots:", error);
      throw error;
    }
  }

  // ==========================================
  // 智能桌位分配演算法 (Table Assignment Algorithm)
  // ==========================================

  /**
   * 智能桌位分配
   */
  async assignTable(
    request: TableAssignmentRequest,
  ): Promise<TableAssignmentResult | null> {
    try {
      const { restaurantId, partySize, specialRequests } = request;

      // 1. 查詢可用桌位
      const availableTables = (await this.db.all(sql`
        SELECT t.*,
          COALESCE(
            (SELECT COUNT(*) FROM orders o WHERE o.table_id = t.id AND DATE(o.created_at / 1000, 'unixepoch') = DATE('now')),
            0
          ) as turnover_count
        FROM tables t
        WHERE t.restaurant_id = ${restaurantId}
          AND t.is_active = 1
          AND t.capacity >= ${partySize}
          AND t.current_status = 'available'
      `)) as Array<{
        id: string;
        number: string;
        capacity: number;
        features?: string;
        turnover_count?: number;
        [key: string]: any;
      }>;

      if (availableTables.length === 0) {
        return null;
      }

      // 2. 計算每個桌位的評分
      const scoredTables = availableTables.map((table) => {
        let score = 0;

        // 容量匹配度 (40%)
        const capacityDiff = Math.abs(table.capacity - partySize);
        const capacityScore = Math.max(0, 100 - capacityDiff * 10);
        score += capacityScore * 0.4;

        // 空間利用率 (30%)
        const utilizationScore = (partySize / table.capacity) * 100;
        score += utilizationScore * 0.3;

        // 特殊需求匹配 (20%)
        let specialRequestScore = 0;
        if (specialRequests) {
          const features = table.features ? JSON.parse(table.features) : {};

          if (specialRequests.includes("靠窗") && features.hasView)
            specialRequestScore = 100;
          if (specialRequests.includes("無障礙") && features.isAccessible)
            specialRequestScore = 100;
          if (specialRequests.includes("安靜") && features.isQuietZone)
            specialRequestScore = 100;
        }
        score += specialRequestScore * 0.2;

        // 翻桌次數平衡 (10%)
        const turnoverScore = Math.max(
          0,
          100 - (table.turnover_count || 0) * 5,
        );
        score += turnoverScore * 0.1;

        return {
          table,
          score,
          reason: `容量匹配${capacityScore.toFixed(0)}% | 利用率${utilizationScore.toFixed(0)}% | 特殊需求${specialRequestScore}% | 翻桌平衡${turnoverScore.toFixed(0)}%`,
        };
      });

      // 3. 排序並選擇最佳桌位
      scoredTables.sort((a, b) => b.score - a.score);
      const best = scoredTables[0];

      return {
        tableId:
          typeof best.table.id === "string"
            ? parseInt(best.table.id)
            : best.table.id,
        tableNumber: best.table.number,
        confidence: best.score / 100,
        reason: best.reason,
      };
    } catch (error) {
      console.error("Error assigning table:", error);
      throw error;
    }
  }

  // ==========================================
  // 統計與分析 (Statistics)
  // ==========================================

  /**
   * 取得訂位統計
   */
  async getReservationStats(
    restaurantId: string,
    date?: string,
  ): Promise<ReservationStats> {
    try {
      const conditions: SQL[] = [
        sql`${reservations.restaurantId} = ${restaurantId}`,
      ];
      if (date) conditions.push(sql`${reservations.reservationDate} = ${date}`);
      const whereExpr = sql.join(conditions, sql` AND `);

      const result = await this.db.get<{
        total_reservations: number;
        confirmed_count: number;
        completed_count: number;
        no_show_count: number;
        cancelled_count: number;
        total_guests: number;
        no_show_rate: number;
        avg_party_size: number;
      }>(sql`
        SELECT
          COUNT(*) as total_reservations,
          SUM(CASE WHEN ${reservations.status} = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count,
          SUM(CASE WHEN ${reservations.status} = 'completed' THEN 1 ELSE 0 END) as completed_count,
          SUM(CASE WHEN ${reservations.status} = 'no_show' THEN 1 ELSE 0 END) as no_show_count,
          SUM(CASE WHEN ${reservations.status} = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
          SUM(${reservations.partySize}) as total_guests,
          ROUND(CAST(SUM(CASE WHEN ${reservations.status} = 'no_show' THEN 1 ELSE 0 END) AS REAL) / NULLIF(COUNT(*), 0) * 100, 2) as no_show_rate,
          ROUND(CAST(SUM(${reservations.partySize}) AS REAL) / NULLIF(COUNT(*), 0), 2) as avg_party_size
        FROM ${reservations}
        WHERE ${whereExpr}
      `);

      return {
        restaurantId,
        date,
        totalReservations: result?.total_reservations || 0,
        confirmedCount: result?.confirmed_count || 0,
        completedCount: result?.completed_count || 0,
        noShowCount: result?.no_show_count || 0,
        cancelledCount: result?.cancelled_count || 0,
        totalGuests: result?.total_guests || 0,
        noShowRate: result?.no_show_rate || 0,
        averagePartySize: result?.avg_party_size || 0,
      };
    } catch (error) {
      console.error("Error getting reservation stats:", error);
      throw error;
    }
  }

  // ==========================================
  // 輔助方法 (Helper Methods)
  // ==========================================

  /**
   * 驗證訂位資料
   */
  private validateReservationData(data: CreateReservationRequest): void {
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

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data.reservationDate)) {
      throw new Error("日期格式錯誤，應為 YYYY-MM-DD");
    }

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(data.reservationTime)) {
      throw new Error("時間格式錯誤，應為 HH:MM");
    }

    // 檢查是否訂位過去的時間
    const reservationDateTime = new Date(
      `${data.reservationDate}T${data.reservationTime}:00`,
    );
    if (reservationDateTime.getTime() < Date.now()) {
      throw new Error("無法訂位過去的時間");
    }
  }

  /**
   * 檢查時段可用性
   */
  private async checkSlotAvailability(
    restaurantId: string,
    date: string,
    timeSlot: string,
    partySize: number,
  ): Promise<{ available: boolean; reason?: string }> {
    try {
      const slot = (await this.db.get(sql`
        SELECT * FROM reservation_slots
        WHERE restaurant_id = ${restaurantId}
          AND date = ${date}
          AND time_slot = ${timeSlot}
      `)) as
        | {
            is_available: number;
            block_reason?: string | null;
            max_capacity: number;
            current_capacity: number;
            max_tables: number;
            current_reservations: number;
          }
        | undefined;

      if (!slot) {
        return { available: false, reason: "時段不存在" };
      }

      if (!slot.is_available) {
        return { available: false, reason: slot.block_reason || "時段已關閉" };
      }

      const remainingCapacity = slot.max_capacity - slot.current_capacity;
      const remainingTables = slot.max_tables - slot.current_reservations;

      if (remainingTables === 0) {
        return { available: false, reason: "桌位已滿" };
      }

      if (remainingCapacity < partySize) {
        return { available: false, reason: "容量不足" };
      }

      return { available: true };
    } catch (error) {
      console.error("Error checking slot availability:", error);
      return { available: false, reason: "查詢錯誤" };
    }
  }

  /**
   * 增加時段使用量
   */
  private async incrementSlotUsage(
    restaurantId: string,
    date: string,
    timeSlot: string,
    partySize: number,
  ): Promise<void> {
    try {
      await this.db.run(sql`
        UPDATE reservation_slots
        SET current_reservations = current_reservations + 1,
            current_capacity = current_capacity + ${partySize},
            updated_at = ${Date.now()}
        WHERE restaurant_id = ${restaurantId}
          AND date = ${date}
          AND time_slot = ${timeSlot}
      `);
    } catch (error) {
      console.error("Error incrementing slot usage:", error);
    }
  }

  /**
   * 減少時段使用量
   */
  private async decrementSlotUsage(
    restaurantId: string,
    date: string,
    timeSlot: string,
    partySize: number,
  ): Promise<void> {
    try {
      await this.db.run(sql`
        UPDATE reservation_slots
        SET current_reservations = MAX(0, current_reservations - 1),
            current_capacity = MAX(0, current_capacity - ${partySize}),
            updated_at = ${Date.now()}
        WHERE restaurant_id = ${restaurantId}
          AND date = ${date}
          AND time_slot = ${timeSlot}
      `);
    } catch (error) {
      console.error("Error decrementing slot usage:", error);
    }
  }

  /**
   * 更新桌位狀態
   */
  private async updateTableStatus(
    tableId: number,
    status: string,
    reservationId?: string,
  ): Promise<void> {
    try {
      const now = Date.now();

      if (status === "reserved" && reservationId) {
        await this.db.run(sql`
          UPDATE tables
          SET current_status = ${status},
              reservation_id = ${reservationId},
              updated_at = ${now}
          WHERE id = ${tableId}
        `);
      } else if (status === "occupied") {
        await this.db.run(sql`
          UPDATE tables
          SET current_status = ${status},
              occupied_since = ${now},
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
   * 生成確認碼（6位數字）
   */
  private generateConfirmationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * 生成 UUID
   */
  private generateUUID(): string {
    return (
      "rsv_" + Date.now().toString(36) + Math.random().toString(36).substr(2, 9)
    );
  }

  /**
   * 格式化訂位回應
   */
  private formatReservationResponse(
    data: ReservationDbRow,
  ): ReservationResponse {
    return {
      id: data.id,
      restaurantId: data.restaurant_id,
      customerId: nullToUndefined(data.customer_id),
      customerName: data.customer_name,
      customerPhone: data.customer_phone,
      customerEmail: nullToUndefined(data.customer_email),
      partySize: data.party_size,
      reservationDate: data.reservation_date,
      reservationTime: data.reservation_time,
      durationMinutes: data.duration_minutes,
      tableId: nullToUndefined(data.table_id),
      specialRequests: nullToUndefined(data.special_requests),
      status: data.status,
      confirmationCode: data.confirmation_code ?? "",
      notes: nullToUndefined(data.notes),
      createdAt: data.created_at,
      confirmedAt: nullToUndefined(data.confirmed_at),
      remindedAt: nullToUndefined(data.reminded_at),
      arrivedAt: nullToUndefined(data.arrived_at),
      seatedAt: nullToUndefined(data.seated_at),
      completedAt: nullToUndefined(data.completed_at),
      cancelledAt: nullToUndefined(data.cancelled_at),
      noShowAt: nullToUndefined(data.no_show_at),
      updatedAt: data.updated_at,
      table: data.table ? JSON.parse(data.table) : undefined,
      customer: data.customer ? JSON.parse(data.customer) : undefined,
    };
  }

  /**
   * 根據 ID 查詢時段
   */
  private async getSlotById(id: string): Promise<ReservationSlot | null> {
    try {
      const result = (await this.db.get(sql`
        SELECT * FROM reservation_slots WHERE id = ${id}
      `)) as
        | {
            id: string;
            restaurant_id: string;
            date: string;
            time_slot: string;
            max_capacity: number;
            max_tables: number;
            current_reservations: number;
            current_capacity: number;
            is_available: number;
            block_reason?: string | null;
            created_at: number;
            updated_at: number;
          }
        | undefined;

      if (!result) return null;

      return {
        id: result.id,
        restaurantId: result.restaurant_id,
        date: result.date,
        timeSlot: result.time_slot,
        maxCapacity: result.max_capacity,
        maxTables: result.max_tables,
        currentReservations: result.current_reservations,
        currentCapacity: result.current_capacity,
        isAvailable: result.is_available === 1,
        blockReason: result.block_reason ?? undefined,
        createdAt: result.created_at,
        updatedAt: result.updated_at,
      };
    } catch (error) {
      console.error("Error getting slot:", error);
      return null;
    }
  }
}
