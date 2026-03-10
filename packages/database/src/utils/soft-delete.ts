/**
 * 軟刪除工具類
 *
 * 提供統一的軟刪除操作方法，支援：
 * - 軟刪除（設置 deletedAt）
 * - 恢復（清除 deletedAt）
 * - 過濾未刪除記錄
 * - 清理過期記錄
 *
 * @module soft-delete
 * @since 2025-12-06
 */

import { sql, isNull, lte, and, eq, type SQL } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import type { DrizzleD1Database } from "drizzle-orm/d1";

/**
 * 軟刪除配置選項
 */
export interface SoftDeleteOptions {
  /** 記錄保留天數（過期後可清理） */
  retentionDays?: number;
}

/**
 * 軟刪除過濾條件
 * 用於查詢時過濾已刪除的記錄
 *
 * @example
 * ```typescript
 * const activeUsers = await db
 *   .select()
 *   .from(users)
 *   .where(notDeleted(users.deletedAt))
 * ```
 */
export function notDeleted(deletedAtColumn: SQLiteColumn): SQL {
  return isNull(deletedAtColumn);
}

/**
 * 已刪除過濾條件
 * 用於查詢已被軟刪除的記錄
 *
 * @example
 * ```typescript
 * const deletedUsers = await db
 *   .select()
 *   .from(users)
 *   .where(isDeleted(users.deletedAt))
 * ```
 */
export function isDeleted(deletedAtColumn: SQLiteColumn): SQL {
  return sql`${deletedAtColumn} IS NOT NULL`;
}

/**
 * 軟刪除服務類
 * 提供軟刪除相關的 CRUD 操作
 */
export class SoftDeleteService {
  private db: DrizzleD1Database;
  private defaultRetentionDays: number;

  constructor(db: DrizzleD1Database, options: SoftDeleteOptions = {}) {
    this.db = db;
    this.defaultRetentionDays = options.retentionDays ?? 90;
  }

  /**
   * 執行軟刪除
   * 將 deletedAt 設置為當前時間戳
   *
   * @param table - 要操作的表
   * @param condition - 過濾條件
   * @returns 更新結果
   *
   * @example
   * ```typescript
   * await softDeleteService.softDelete(users, eq(users.id, userId))
   * ```
   */
  async softDelete(table: SQLiteTable, condition: SQL) {
    const now = Math.floor(Date.now() / 1000);
    return this.db
      .update(table)
      .set({ deletedAt: now } as Record<string, unknown>)
      .where(condition);
  }

  /**
   * 恢復軟刪除的記錄
   * 將 deletedAt 設置為 null
   *
   * @param table - 要操作的表
   * @param condition - 過濾條件
   * @returns 更新結果
   *
   * @example
   * ```typescript
   * await softDeleteService.restore(users, eq(users.id, userId))
   * ```
   */
  async restore(table: SQLiteTable, condition: SQL) {
    return this.db
      .update(table)
      .set({ deletedAt: null } as Record<string, unknown>)
      .where(condition);
  }

  /**
   * 永久刪除過期的軟刪除記錄
   * 刪除超過保留期限的記錄
   *
   * @param table - 要操作的表
   * @param deletedAtColumn - deletedAt 欄位
   * @param retentionDays - 保留天數（可選，默認使用構造函數設置）
   * @returns 刪除結果
   *
   * @example
   * ```typescript
   * // 清理 90 天前軟刪除的記錄
   * await softDeleteService.purgeExpired(users, users.deletedAt)
   *
   * // 清理 30 天前軟刪除的記錄
   * await softDeleteService.purgeExpired(users, users.deletedAt, 30)
   * ```
   */
  async purgeExpired(
    table: SQLiteTable,
    deletedAtColumn: SQLiteColumn,
    retentionDays?: number,
  ) {
    const days = retentionDays ?? this.defaultRetentionDays;
    const cutoffTime = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;

    return this.db
      .delete(table)
      .where(
        and(
          sql`${deletedAtColumn} IS NOT NULL`,
          lte(deletedAtColumn, cutoffTime),
        ),
      );
  }

  /**
   * 計算已軟刪除的記錄數
   *
   * @param table - 要查詢的表
   * @param deletedAtColumn - deletedAt 欄位
   * @returns 軟刪除記錄數
   */
  async countDeleted(table: SQLiteTable, deletedAtColumn: SQLiteColumn) {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(table)
      .where(sql`${deletedAtColumn} IS NOT NULL`);

    return result[0]?.count ?? 0;
  }

  /**
   * 計算待清理的過期記錄數
   *
   * @param table - 要查詢的表
   * @param deletedAtColumn - deletedAt 欄位
   * @param retentionDays - 保留天數
   * @returns 過期記錄數
   */
  async countExpired(
    table: SQLiteTable,
    deletedAtColumn: SQLiteColumn,
    retentionDays?: number,
  ) {
    const days = retentionDays ?? this.defaultRetentionDays;
    const cutoffTime = Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;

    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(table)
      .where(
        and(
          sql`${deletedAtColumn} IS NOT NULL`,
          lte(deletedAtColumn, cutoffTime),
        ),
      );

    return result[0]?.count ?? 0;
  }
}

/**
 * 創建軟刪除服務實例
 *
 * @param db - Drizzle D1 數據庫實例
 * @param options - 配置選項
 * @returns SoftDeleteService 實例
 *
 * @example
 * ```typescript
 * const softDelete = createSoftDeleteService(db, { retentionDays: 90 })
 *
 * // 軟刪除用戶
 * await softDelete.softDelete(users, eq(users.id, userId))
 *
 * // 恢復用戶
 * await softDelete.restore(users, eq(users.id, userId))
 *
 * // 清理過期記錄
 * await softDelete.purgeExpired(users, users.deletedAt)
 * ```
 */
export function createSoftDeleteService(
  db: DrizzleD1Database,
  options?: SoftDeleteOptions,
) {
  return new SoftDeleteService(db, options);
}

/**
 * 軟刪除查詢輔助函數
 * 用於構建包含軟刪除過濾的查詢
 *
 * @example
 * ```typescript
 * // 查詢所有未刪除的用戶
 * const activeUsers = await db
 *   .select()
 *   .from(users)
 *   .where(withSoftDelete(users.deletedAt).active())
 *
 * // 查詢所有已刪除的用戶
 * const deletedUsers = await db
 *   .select()
 *   .from(users)
 *   .where(withSoftDelete(users.deletedAt).deleted())
 * ```
 */
export function withSoftDelete(deletedAtColumn: SQLiteColumn) {
  return {
    /** 過濾條件：只包含未刪除的記錄 */
    active: (): SQL => isNull(deletedAtColumn),
    /** 過濾條件：只包含已刪除的記錄 */
    deleted: (): SQL => sql`${deletedAtColumn} IS NOT NULL`,
    /** 過濾條件：包含所有記錄（不過濾） */
    all: (): SQL => sql`1=1`,
  };
}
