import { and, eq, desc, count, sql } from "drizzle-orm";
import { BaseService } from "./base";
import { prefixedUuid } from "./id-generation";
import { businessDateNow, dateFromUnixMs } from "../utils/sql-time";
import { PLATFORM_BUSINESS_TIMEZONE_OFFSET_MINUTES } from "../utils/business-timezone";
import {
  qrCodes,
  qrTemplates,
  qrDownloads,
  qrBatches,
  auditLogs,
  type NewQRCode,
  type NewQRTemplate,
  type NewQRDownload,
  type NewQRBatch,
  type QRCode,
  type QRBatch,
  type QRTemplate,
} from "../schema";

export interface QRStyleData {
  backgroundColor?: string;
  foregroundColor?: string;
  size?: number;
  errorCorrection?: "L" | "M" | "Q" | "H";
  cornerStyle?: "square" | "rounded" | "circle";
  dotStyle?: "square" | "rounded" | "circle";
  gradientType?: "none" | "linear" | "radial";
  gradientColors?: {
    start: string;
    end: string;
    direction?: number;
  };
  logo?: {
    url: string;
    size: number;
    borderRadius: number;
    margin: number;
  };
  border?: {
    width: number;
    color: string;
    style: "solid" | "dashed" | "dotted";
  };
  shadow?: {
    enabled: boolean;
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
}

export interface CreateQRCodeData {
  content: string;
  format?: "png" | "svg" | "pdf" | "jpeg";
  restaurantId?: string | number | null;
  createdBy?: string | null;
  style?: QRStyleData;
  metadata?: unknown;
}

export interface CreateQRTemplateData {
  name: string;
  description?: string;
  style: QRStyleData;
  isDefault?: boolean;
  createdBy: string;
}

/**
 * 模板寫入的歸屬判定選項。
 *
 * `qr_templates` 沒有 `restaurant_id`（不像 `qr_codes`），唯一能表示歸屬的欄位
 * 只有 `created_by`，所以寫入一律以建立者為界；平台管理員（role 0）例外，
 * 讓他們仍能維護 `created_by` 為 NULL 的平台預設模板。
 */
export interface QRTemplateWriteOptions {
  isPlatformAdmin?: boolean;
}

export interface QRCodeStats {
  totalCodes: number;
  todayCodes: number;
  totalDownloads: number;
  popularTemplates: Array<{
    id: number;
    name: string;
    usageCount: number;
  }>;
}

export class QRCodeService extends BaseService {
  /**
   * 生成QR碼
   */
  async generateQRCode(data: CreateQRCodeData): Promise<QRCode> {
    const qrCodeData: NewQRCode = {
      content: data.content,
      format: data.format || "png",
      styleJson: data.style ? JSON.stringify(data.style) : null,
      metadataJson: data.metadata ? JSON.stringify(data.metadata) : null,
      restaurantId:
        data.restaurantId == null ? null : String(data.restaurantId),
      createdBy: data.createdBy ?? null,
      url: null, // Will be set after actual QR generation
    };

    const result = await this.db.insert(qrCodes).values(qrCodeData).returning();
    return result[0];
  }

  /**
   * 批量生成QR碼
   */
  async generateBulkQRCodes(
    restaurantId: string,
    tableIds: number[],
    userId: string,
  ): Promise<{ id: number; batchId: string; totalCodes: number }> {
    const batchId = prefixedUuid("batch");

    // 創建批次記錄
    const batchData: NewQRBatch = {
      batchId,
      restaurantId,
      totalCodes: tableIds.length,
      createdBy: userId,
      status: "processing",
    };

    const result = await this.db
      .insert(qrBatches)
      .values(batchData)
      .returning({ id: qrBatches.id });
    const batch = result[0];

    if (!batch?.id) {
      throw new Error("QR batch creation did not return an ID");
    }

    // 記錄審計日誌
    await this.createAuditLog({
      userId,
      action: "bulk_generate_qr_codes",
      resource: "qr_codes",
      description: JSON.stringify({
        batchId,
        restaurantId,
        tableCount: tableIds.length,
      }),
    });

    return { id: batch.id, batchId, totalCodes: tableIds.length };
  }

  /**
   * 獲取QR碼詳情
   */
  async getQRCode(id: string): Promise<QRCode | null> {
    const result = await this.db
      .select()
      .from(qrCodes)
      .where(eq(qrCodes.id, id))
      .limit(1);
    return result[0] || null;
  }

  /**
   * 記錄QR碼下載
   */
  async recordDownload(
    qrCodeId: string,
    format: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const downloadData: NewQRDownload = {
      qrCodeId,
      format,
      ipAddress,
      userAgent,
    };

    await this.db.insert(qrDownloads).values(downloadData);
  }

  /**
   * 創建QR碼模板
   */
  async createTemplate(data: CreateQRTemplateData): Promise<QRTemplate> {
    const templateData: NewQRTemplate = {
      name: data.name,
      description: data.description,
      styleJson: JSON.stringify(data.style),
      isDefault: data.isDefault || false,
      createdBy: data.createdBy,
    };

    const result = await this.db
      .insert(qrTemplates)
      .values(templateData)
      .returning();
    const template = result[0];

    // 記錄審計日誌
    await this.createAuditLog({
      userId: data.createdBy,
      action: "create_qr_template",
      resource: "qr_templates",
      description: JSON.stringify({ templateId: template.id, name: data.name }),
    });

    return template;
  }

  /**
   * 獲取QR碼模板
   */
  async getTemplate(id: number): Promise<QRTemplate | null> {
    const result = await this.db
      .select()
      .from(qrTemplates)
      .where(eq(qrTemplates.id, id))
      .limit(1);
    return result[0] || null;
  }

  /**
   * 更新QR碼模板
   */
  async updateTemplate(
    id: number,
    data: Partial<CreateQRTemplateData>,
    userId: string,
    options: QRTemplateWriteOptions = {},
  ): Promise<QRTemplate | null> {
    // 先確認歸屬：查不到或不屬於呼叫者一律回 null，讓上層回 404，
    // 不區分「不存在」與「別人的」以免被拿來列舉其他店家的模板。
    const owned = await this.getOwnedTemplate(id, userId, options);
    if (!owned) {
      return null;
    }

    const updateData: Partial<NewQRTemplate> = {
      updatedAt: new Date(),
    };

    if (data.name) updateData.name = data.name;
    if (data.description !== undefined)
      updateData.description = data.description;
    if (data.style) updateData.styleJson = JSON.stringify(data.style);
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;

    // where 也帶上歸屬條件，避免讀取與寫入之間被換掉 created_by。
    await this.db
      .update(qrTemplates)
      .set(updateData)
      .where(this.templateOwnershipFilter(id, userId, options));

    const template = await this.getTemplate(id);
    if (!template) {
      throw new Error("Template not found after update");
    }

    // 記錄審計日誌
    await this.createAuditLog({
      userId,
      action: "update_qr_template",
      resource: "qr_templates",
      description: JSON.stringify({
        templateId: id,
        changes: Object.keys(updateData),
      }),
    });

    return template;
  }

  /**
   * 軟刪除QR碼模板
   */
  async deleteTemplate(
    id: number,
    userId: string,
    options: QRTemplateWriteOptions = {},
  ): Promise<boolean> {
    const owned = await this.getOwnedTemplate(id, userId, options);
    if (!owned) {
      return false;
    }

    await this.db
      .update(qrTemplates)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(this.templateOwnershipFilter(id, userId, options));

    // 記錄審計日誌
    await this.createAuditLog({
      userId,
      action: "delete_qr_template",
      resource: "qr_templates",
      description: JSON.stringify({ templateId: id }),
    });

    return true;
  }

  /**
   * 模板寫入的歸屬條件；平台管理員不加 created_by 限制。
   */
  private templateOwnershipFilter(
    id: number,
    userId: string,
    options: QRTemplateWriteOptions,
  ) {
    return options.isPlatformAdmin
      ? eq(qrTemplates.id, id)
      : and(eq(qrTemplates.id, id), eq(qrTemplates.createdBy, userId));
  }

  private async getOwnedTemplate(
    id: number,
    userId: string,
    options: QRTemplateWriteOptions,
  ): Promise<QRTemplate | null> {
    const result = await this.db
      .select()
      .from(qrTemplates)
      .where(this.templateOwnershipFilter(id, userId, options))
      .limit(1);
    return result[0] || null;
  }

  /**
   * 獲取所有活躍模板
   */
  async getActiveTemplates(): Promise<QRTemplate[]> {
    return this.db
      .select()
      .from(qrTemplates)
      .where(eq(qrTemplates.isActive, true))
      .orderBy(desc(qrTemplates.createdAt));
  }

  /**
   * 獲取批次狀態
   */
  async getBatchStatus(batchId: string): Promise<QRBatch | null> {
    const result = await this.db
      .select()
      .from(qrBatches)
      .where(eq(qrBatches.batchId, batchId))
      .limit(1);
    return result[0] || null;
  }

  /**
   * 獲取QR碼統計
   */
  async getQRCodeStats(): Promise<QRCodeStats> {
    // 總QR碼數
    const totalCodesResult = await this.db
      .select({ count: count() })
      .from(qrCodes);
    const totalCodes = totalCodesResult[0]?.count || 0;

    // 今日QR碼數。這是全平台計數，不屬於任何一家店的營業日，所以用平台偏移量
    // 而不是某家店的午夜 (#329)。
    const todayCodesResult = await this.db
      .select({ count: count() })
      .from(qrCodes)
      .where(
        sql`${dateFromUnixMs(qrCodes.createdAt, PLATFORM_BUSINESS_TIMEZONE_OFFSET_MINUTES)} = ${businessDateNow(PLATFORM_BUSINESS_TIMEZONE_OFFSET_MINUTES)}`,
      );
    const todayCodes = todayCodesResult[0]?.count || 0;

    // 總下載數
    const totalDownloadsResult = await this.db
      .select({ count: count() })
      .from(qrDownloads);
    const totalDownloads = totalDownloadsResult[0]?.count || 0;

    // 熱門模板 (這需要複雜查詢，暫時返回空數組)
    const popularTemplates: Array<{
      id: number;
      name: string;
      usageCount: number;
    }> = [];

    return {
      totalCodes,
      todayCodes,
      totalDownloads,
      popularTemplates,
    };
  }

  /**
   * 創建審計日誌
   */
  async createAuditLog(data: {
    userId: string;
    action: string;
    resource: string;
    description: string;
  }): Promise<void> {
    await this.db.insert(auditLogs).values({
      userId: data.userId,
      action: data.action,
      resource: data.resource,
      description: data.description,
    });
  }
}

// 導出類型定義
export type { QRCode, QRTemplate, NewQRCode, NewQRTemplate };
