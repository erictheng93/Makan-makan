import { eq, and, asc, count, inArray, sql } from "drizzle-orm";
import { BaseService } from "./base";
import { seats, tables, restaurants } from "../schema";
import { buildSignedQRUrl } from "@makanmakan/utils";

export interface CreateSeatData {
  tableId: number;
  seatNumber: string;
  seatName?: string;
  position?: string;
}

export interface UpdateSeatData {
  seatNumber?: string;
  seatName?: string;
  position?: string;
  isActive?: boolean;
}

export interface SeatFilters {
  tableId?: number;
  isOccupied?: boolean;
  isActive?: boolean;
  seatNumbers?: string[];
  page?: number;
  limit?: number;
}

export interface SeatNumberingOptions {
  numberingStyle?: "numeric" | "alphabetic" | "custom";
  customNumbers?: string[];
  prefix?: string;
}

export interface SeatStats {
  totalSeats: number;
  occupiedSeats: number;
  availableSeats: number;
  inactiveSeats: number;
  averageOccupancyRate: number;
}

/**
 * 座位服務
 * 負責座位的創建、管理和操作
 */
export class SeatService extends BaseService {
  /**
   * 為桌子批量創建座位
   */
  async createSeatsForTable(
    tableId: number,
    seatCount: number,
    options: SeatNumberingOptions = {},
  ): Promise<any[]> {
    try {
      // 驗證桌子是否存在
      const table = await this.db
        .select({
          id: tables.id,
          restaurantId: tables.restaurantId,
          number: tables.number,
        })
        .from(tables)
        .where(eq(tables.id, tableId))
        .get();

      if (!table) {
        throw new Error("Table not found");
      }

      if (!Number.isInteger(seatCount) || seatCount <= 0) {
        throw new Error("Seat count must be a positive integer");
      }

      const existingSeat = await this.db
        .select({ id: seats.id })
        .from(seats)
        .where(eq(seats.tableId, tableId))
        .get();

      if (existingSeat) {
        throw new Error("Table already has seats");
      }

      // 生成座位編號
      const seatNumbers = this.generateSeatNumbers(seatCount, options);

      // 並行生成所有 QR codes
      const qrCodes = await Promise.all(
        seatNumbers.map((seatNumber) =>
          this.generateSeatQRCode(table.restaurantId, tableId, seatNumber),
        ),
      );

      // 批量插入所有座位
      const seatValues = seatNumbers.map((seatNumber, i) => ({
        tableId,
        seatNumber,
        qrCode: qrCodes[i],
        qrCodeVersion: 1,
        isOccupied: false,
        isActive: true,
        totalUsage: 0,
      }));

      const createdSeats = await this.db
        .insert(seats)
        .values(seatValues)
        .returning();

      return createdSeats;
    } catch (error) {
      this.handleError(error, "createSeatsForTable");
    }
  }

  /**
   * 獲取單個座位
   */
  async getSeatById(seatId: number): Promise<any> {
    try {
      const seat = await this.db
        .select({
          id: seats.id,
          tableId: seats.tableId,
          seatNumber: seats.seatNumber,
          seatName: seats.seatName,
          position: seats.position,
          qrCode: seats.qrCode,
          qrCodeImageUrl: seats.qrCodeImageUrl,
          qrCodeVersion: seats.qrCodeVersion,
          isOccupied: seats.isOccupied,
          isActive: seats.isActive,
          currentOrderId: seats.currentOrderId,
          occupiedAt: seats.occupiedAt,
          occupiedBy: seats.occupiedBy,
          totalUsage: seats.totalUsage,
          createdAt: seats.createdAt,
          updatedAt: seats.updatedAt,
          // 桌子資訊
          tableNumber: tables.number,
          restaurantId: tables.restaurantId,
          // 餐廳資訊
          restaurantName: restaurants.name,
        })
        .from(seats)
        .leftJoin(tables, eq(seats.tableId, tables.id))
        .leftJoin(restaurants, eq(tables.restaurantId, restaurants.id))
        .where(eq(seats.id, seatId))
        .get();

      return seat;
    } catch (error) {
      this.handleError(error, "getSeatById");
    }
  }

  /**
   * 根據 QR Code 獲取座位
   */
  async getSeatByQRCode(qrCode: string): Promise<any> {
    try {
      const seat = await this.db
        .select({
          id: seats.id,
          tableId: seats.tableId,
          seatNumber: seats.seatNumber,
          seatName: seats.seatName,
          position: seats.position,
          qrCode: seats.qrCode,
          isOccupied: seats.isOccupied,
          isActive: seats.isActive,
          currentOrderId: seats.currentOrderId,
          // 桌子資訊
          tableNumber: tables.number,
          capacity: tables.capacity,
          restaurantId: tables.restaurantId,
          // 餐廳資訊
          restaurantName: restaurants.name,
        })
        .from(seats)
        .leftJoin(tables, eq(seats.tableId, tables.id))
        .leftJoin(restaurants, eq(tables.restaurantId, restaurants.id))
        .where(eq(seats.qrCode, qrCode))
        .get();

      return seat;
    } catch (error) {
      this.handleError(error, "getSeatByQRCode");
    }
  }

  /**
   * 獲取桌子的所有座位
   */
  async getSeatsByTableId(
    tableId: number,
    filters: Omit<SeatFilters, "tableId"> = {},
  ): Promise<{
    seats: any[];
    total: number;
    pagination?: { page: number; limit: number; totalPages: number };
  }> {
    try {
      const {
        page = 1,
        limit = 50,
        isOccupied,
        isActive,
        seatNumbers,
      } = filters;
      const { offset } = this.createPagination(page, limit);

      // 建構查詢條件
      const conditions = [eq(seats.tableId, tableId)];

      if (isOccupied !== undefined) {
        conditions.push(eq(seats.isOccupied, isOccupied));
      }

      if (isActive !== undefined) {
        conditions.push(eq(seats.isActive, isActive));
      }

      if (seatNumbers && seatNumbers.length > 0) {
        conditions.push(inArray(seats.seatNumber, seatNumbers));
      }

      // 查詢座位列表
      const seatsList = await this.db
        .select({
          id: seats.id,
          tableId: seats.tableId,
          seatNumber: seats.seatNumber,
          seatName: seats.seatName,
          position: seats.position,
          qrCode: seats.qrCode,
          qrCodeImageUrl: seats.qrCodeImageUrl,
          qrCodeVersion: seats.qrCodeVersion,
          isOccupied: seats.isOccupied,
          isActive: seats.isActive,
          currentOrderId: seats.currentOrderId,
          occupiedAt: seats.occupiedAt,
          occupiedBy: seats.occupiedBy,
          totalUsage: seats.totalUsage,
          createdAt: seats.createdAt,
        })
        .from(seats)
        .where(and(...conditions))
        .orderBy(asc(seats.seatNumber))
        .limit(limit)
        .offset(offset);

      // 計算總數
      const [{ total }] = await this.db
        .select({ total: count() })
        .from(seats)
        .where(and(...conditions));

      const totalPages = Math.ceil(total / limit);

      return {
        seats: seatsList,
        total,
        pagination: { page, limit, totalPages },
      };
    } catch (error) {
      this.handleError(error, "getSeatsByTableId");
    }
  }

  /**
   * 更新座位
   */
  async updateSeat(seatId: number, data: UpdateSeatData): Promise<any> {
    try {
      const [updatedSeat] = await this.db
        .update(seats)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(seats.id, seatId))
        .returning();

      return updatedSeat;
    } catch (error) {
      this.handleError(error, "updateSeat");
    }
  }

  /**
   * 刪除座位（軟刪除）
   */
  async deleteSeat(seatId: number): Promise<boolean> {
    try {
      await this.db
        .update(seats)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(seats.id, seatId));

      return true;
    } catch (error) {
      this.handleError(error, "deleteSeat");
    }
  }

  /**
   * 批量刪除桌子的所有座位（硬刪除，用於模式切換）
   */
  async deleteSeatsForTable(tableId: number): Promise<boolean> {
    try {
      await this.db.delete(seats).where(eq(seats.tableId, tableId));

      return true;
    } catch (error) {
      this.handleError(error, "deleteSeatsForTable");
    }
  }

  /**
   * 佔用座位
   */
  async occupySeat(
    seatId: number,
    orderId: string,
    occupiedBy?: string,
  ): Promise<boolean> {
    try {
      await this.db
        .update(seats)
        .set({
          isOccupied: true,
          currentOrderId: orderId,
          occupiedAt: new Date(),
          occupiedBy,
          updatedAt: new Date(),
        })
        .where(eq(seats.id, seatId));

      return true;
    } catch (error) {
      this.handleError(error, "occupySeat");
    }
  }

  /**
   * 釋放座位
   */
  async releaseSeat(seatId: number): Promise<boolean> {
    try {
      const seat = await this.db
        .select({
          occupiedAt: seats.occupiedAt,
          totalUsage: seats.totalUsage,
        })
        .from(seats)
        .where(eq(seats.id, seatId))
        .get();

      await this.db
        .update(seats)
        .set({
          isOccupied: false,
          currentOrderId: null,
          occupiedAt: null,
          occupiedBy: null,
          totalUsage: (seat?.totalUsage || 0) + 1,
          updatedAt: new Date(),
        })
        .where(eq(seats.id, seatId));

      return true;
    } catch (error) {
      this.handleError(error, "releaseSeat");
    }
  }

  /**
   * 重新生成座位 QR Code
   */
  async regenerateSeatQRCode(
    seatId: number,
  ): Promise<{ success: boolean; qrCode?: string; error?: string }> {
    try {
      const seat = await this.db
        .select({
          tableId: seats.tableId,
          seatNumber: seats.seatNumber,
          qrCodeVersion: seats.qrCodeVersion,
        })
        .from(seats)
        .where(eq(seats.id, seatId))
        .get();

      if (!seat) {
        return { success: false, error: "Seat not found" };
      }

      const table = await this.db
        .select({ restaurantId: tables.restaurantId })
        .from(tables)
        .where(eq(tables.id, seat.tableId))
        .get();

      if (!table) {
        return { success: false, error: "Table not found" };
      }

      const newVersion = (seat.qrCodeVersion || 0) + 1;
      const newQRCode = await this.generateSeatQRCode(
        table.restaurantId,
        seat.tableId,
        seat.seatNumber,
        newVersion,
      );

      await this.db
        .update(seats)
        .set({
          qrCode: newQRCode,
          qrCodeVersion: newVersion,
          updatedAt: new Date(),
        })
        .where(eq(seats.id, seatId));

      return { success: true, qrCode: newQRCode };
    } catch (error) {
      return { success: false, error: "Failed to regenerate QR code" };
    }
  }

  /**
   * 批量生成座位 QR Codes
   */
  async batchGenerateSeatQRCodes(tableId: number): Promise<{
    success: boolean;
    qrCodes?: Array<{ seatId: number; qrCode: string; seatNumber: string }>;
    error?: string;
  }> {
    try {
      const table = await this.db
        .select({ restaurantId: tables.restaurantId })
        .from(tables)
        .where(eq(tables.id, tableId))
        .get();

      if (!table) {
        return { success: false, error: "Table not found" };
      }

      const seatsList = await this.db
        .select({
          id: seats.id,
          seatNumber: seats.seatNumber,
          qrCodeVersion: seats.qrCodeVersion,
        })
        .from(seats)
        .where(eq(seats.tableId, tableId));

      const qrCodes = [];

      for (const seat of seatsList) {
        const newVersion = (seat.qrCodeVersion || 0) + 1;
        const newQRCode = await this.generateSeatQRCode(
          table.restaurantId,
          tableId,
          seat.seatNumber,
          newVersion,
        );

        await this.db
          .update(seats)
          .set({
            qrCode: newQRCode,
            qrCodeVersion: newVersion,
            updatedAt: new Date(),
          })
          .where(eq(seats.id, seat.id));

        qrCodes.push({
          seatId: seat.id,
          seatNumber: seat.seatNumber,
          qrCode: newQRCode,
        });
      }

      return { success: true, qrCodes };
    } catch (error) {
      return { success: false, error: "Failed to generate QR codes" };
    }
  }

  /**
   * 獲取座位統計（單次查詢，透過條件聚合）
   */
  async getSeatStats(tableId: number): Promise<SeatStats> {
    try {
      const [stats] = await this.db
        .select({
          totalSeats: count(),
          occupiedSeats: sql<number>`SUM(CASE WHEN ${seats.isOccupied} = 1 AND ${seats.isActive} = 1 THEN 1 ELSE 0 END)`,
          availableSeats: sql<number>`SUM(CASE WHEN ${seats.isOccupied} = 0 AND ${seats.isActive} = 1 THEN 1 ELSE 0 END)`,
          inactiveSeats: sql<number>`SUM(CASE WHEN ${seats.isActive} = 0 THEN 1 ELSE 0 END)`,
        })
        .from(seats)
        .where(eq(seats.tableId, tableId));

      const totalSeats = stats.totalSeats ?? 0;
      const occupiedSeats = stats.occupiedSeats ?? 0;
      const availableSeats = stats.availableSeats ?? 0;
      const inactiveSeats = stats.inactiveSeats ?? 0;

      const averageOccupancyRate =
        totalSeats > 0 ? (occupiedSeats / totalSeats) * 100 : 0;

      return {
        totalSeats,
        occupiedSeats,
        availableSeats,
        inactiveSeats,
        averageOccupancyRate: Math.round(averageOccupancyRate * 100) / 100,
      };
    } catch (error) {
      this.handleError(error, "getSeatStats");
    }
  }

  // ============================================
  // 私有輔助方法
  // ============================================

  /**
   * 生成座位 QR Code 內容
   */
  private async generateSeatQRCode(
    restaurantId: string,
    tableId: number,
    seatNumber: string,
    version: number = 1,
  ): Promise<string> {
    const baseUrl = this.env.CLIENT_BASE_URL || "https://makanmakan.com";
    const signingKey = this.env.QR_SIGNING_KEY;
    if (!signingKey || signingKey.length < 32) {
      throw new Error("QR_SIGNING_KEY must be set and at least 32 characters");
    }

    return buildSignedQRUrl(
      baseUrl,
      {
        formatVersion: 2,
        type: "seat",
        restaurantId,
        tableId,
        identifier: seatNumber,
        version,
      },
      signingKey,
    );
  }

  /**
   * 生成座位編號
   */
  private generateSeatNumbers(
    count: number,
    options: SeatNumberingOptions = {},
  ): string[] {
    const { numberingStyle = "numeric", customNumbers, prefix = "" } = options;

    if (numberingStyle === "custom") {
      if (!customNumbers || customNumbers.length !== count) {
        throw new Error("Custom seat numbers must match seat count");
      }

      const normalizedNumbers = customNumbers.map((number) => number.trim());
      if (normalizedNumbers.some((number) => number.length === 0)) {
        throw new Error("Custom seat numbers cannot be empty");
      }
      if (new Set(normalizedNumbers).size !== normalizedNumbers.length) {
        throw new Error("Custom seat numbers must be unique");
      }

      return normalizedNumbers;
    }

    const numbers: string[] = [];

    if (numberingStyle === "numeric") {
      // 數字編號：01, 02, 03...
      for (let i = 1; i <= count; i++) {
        numbers.push(`${prefix}${String(i).padStart(2, "0")}`);
      }
    } else if (numberingStyle === "alphabetic") {
      // 字母編號：A, B, C...
      for (let i = 0; i < count; i++) {
        const letter = String.fromCharCode(65 + (i % 26)); // A-Z
        const repeat = Math.floor(i / 26) + 1;
        numbers.push(`${prefix}${letter.repeat(repeat)}`);
      }
    }

    return numbers;
  }

  /**
   * 更新座位使用統計
   */
  private async updateSeatUsageStats(seatId: number): Promise<void> {
    try {
      const seat = await this.db
        .select({ totalUsage: seats.totalUsage })
        .from(seats)
        .where(eq(seats.id, seatId))
        .get();

      await this.db
        .update(seats)
        .set({
          totalUsage: (seat?.totalUsage || 0) + 1,
          updatedAt: new Date(),
        })
        .where(eq(seats.id, seatId));
    } catch (error) {
      // Silent failure for usage stats update - non-critical operation
      // Error will be logged by the parent method's handleError
    }
  }
}
