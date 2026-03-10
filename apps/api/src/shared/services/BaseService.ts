/**
 * 基礎服務類
 * 提供通用的數據庫操作功能
 */

import { getCurrentTimestamp } from "@makanmakan/database";

export abstract class BaseService {
  protected d1: any;

  constructor(db: any) {
    this.d1 = db;
  }

  /**
   * 執行事務操作
   */
  protected async transaction<T>(operations: () => Promise<T>): Promise<T> {
    // 簡化的事務實現
    // 實際應用中需要更完整的事務管理
    return await operations();
  }

  /**
   * 分頁查詢輔助方法
   */
  protected buildPaginationQuery(
    baseQuery: string,
    params: any[],
    page: number = 1,
    limit: number = 20,
  ): { query: string; params: any[] } {
    const offset = (page - 1) * limit;
    return {
      query: `${baseQuery} LIMIT ? OFFSET ?`,
      params: [...params, limit, offset],
    };
  }

  /**
   * 日期範圍過濾輔助方法
   */
  protected buildDateRangeFilter(
    dateField: string,
    startDate?: string,
    endDate?: string,
  ): { filter: string; params: any[] } {
    const filters: string[] = [];
    const params: any[] = [];

    if (startDate) {
      filters.push(`DATE(${dateField}) >= ?`);
      params.push(startDate);
    }

    if (endDate) {
      filters.push(`DATE(${dateField}) <= ?`);
      params.push(endDate);
    }

    return {
      filter: filters.length > 0 ? ` AND ${filters.join(" AND ")}` : "",
      params,
    };
  }

  /**
   * 生成UUID
   */
  protected generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * 標準化API響應格式
   */
  protected createResponse<T>(
    success: boolean,
    data?: T,
    error?: string,
  ): { success: boolean; data?: T; error?: string } {
    if (success) {
      return { success: true, data };
    } else {
      return { success: false, error };
    }
  }

  /**
   * 解析JSON字段
   */
  protected parseJsonField(jsonString: string, defaultValue: any = {}): any {
    try {
      return JSON.parse(jsonString || "{}");
    } catch {
      return defaultValue;
    }
  }

  /**
   * 格式化數字
   */
  protected formatNumber(value: any, defaultValue: number = 0): number {
    const num = parseFloat(value);
    return isNaN(num) ? defaultValue : num;
  }

  /**
   * 創建審計日誌
   */
  protected async createAuditLog(data: {
    action: string;
    entityType: string;
    entityId: string;
    userId: number;
    description?: string;
    oldData?: any;
    newData?: any;
  }): Promise<void> {
    try {
      const auditId = this.generateId();
      const now = getCurrentTimestamp();

      await this.d1
        .prepare(
          `
        INSERT INTO audit_logs (
          id, action, entity_type, entity_id, user_id,
          description, old_data, new_data, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
        )
        .bind(
          auditId,
          data.action,
          data.entityType,
          data.entityId,
          data.userId,
          data.description || null,
          data.oldData ? JSON.stringify(data.oldData) : null,
          data.newData ? JSON.stringify(data.newData) : null,
          now,
        )
        .run();
    } catch (error) {
      console.error("創建審計日誌失敗:", error);
      // 不拋出錯誤，避免影響主要業務邏輯
    }
  }
}
