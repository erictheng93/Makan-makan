/**
 * KV Usage Service
 * KV 使用量追蹤服務 - 監控每餐廳的 KV 配額使用情況
 *
 * 功能：
 * - 追蹤每餐廳 KV 使用量 (key 數量、大小)
 * - 配額檢查 (警告閾值 80%、限制閾值 100%)
 * - 操作計數 (讀/寫/刪除)
 * - 使用趨勢分析
 */

import type { KVNamespace } from "@cloudflare/workers-types";

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * KV 命名空間類型
 */
export type KVNamespaceType =
  | "cache"
  | "ratelimit"
  | "backup"
  | "token_blacklist";

/**
 * KV 操作類型
 */
export type KVOperationType = "read" | "write" | "delete";

/**
 * 單一餐廳的 KV 使用量指標
 */
export interface KVUsageMetrics {
  restaurantId: string;
  namespace: KVNamespaceType;
  keyCount: number;
  totalSizeBytes: number;
  operationCount: {
    reads: number;
    writes: number;
    deletes: number;
  };
  lastUpdated: number;
}

/**
 * KV 配額設定
 */
export interface KVQuotaConfig {
  /** 每餐廳最大 key 數量 (預設: 10,000) */
  maxKeysPerRestaurant: number;
  /** 每餐廳最大儲存大小 (預設: 50MB) */
  maxSizeBytesPerRestaurant: number;
  /** 警告閾值 (預設: 80%) */
  warningThreshold: number;
  /** 嚴重警告閾值 (預設: 95%) */
  criticalThreshold: number;
}

/**
 * 配額檢查結果
 */
export interface QuotaCheckResult {
  withinQuota: boolean;
  keyUsagePercent: number;
  sizeUsagePercent: number;
  warnings: string[];
  status: "ok" | "warning" | "critical" | "exceeded";
}

/**
 * 系統總覽統計
 */
export interface SystemUsageOverview {
  totalRestaurants: number;
  totalKeys: number;
  totalSizeBytes: number;
  topConsumers: Array<{
    restaurantId: string;
    keyCount: number;
    sizeBytes: number;
  }>;
  quotaViolations: string[];
}

// ============================================================================
// Constants
// ============================================================================

const USAGE_PREFIX = "_kv_usage:";
const SYSTEM_OVERVIEW_KEY = "_kv_system_overview";

const DEFAULT_QUOTA_CONFIG: KVQuotaConfig = {
  maxKeysPerRestaurant: 10000,
  maxSizeBytesPerRestaurant: 50 * 1024 * 1024, // 50MB
  warningThreshold: 0.8,
  criticalThreshold: 0.95,
};

// ============================================================================
// KVUsageService Class
// ============================================================================

/**
 * KV 使用量追蹤服務
 */
export class KVUsageService {
  private kv: KVNamespace;
  private quotaConfig: KVQuotaConfig;

  constructor(kv: KVNamespace, quotaConfig?: Partial<KVQuotaConfig>) {
    this.kv = kv;
    this.quotaConfig = { ...DEFAULT_QUOTA_CONFIG, ...quotaConfig };
  }

  // --------------------------------------------------------------------------
  // 操作追蹤
  // --------------------------------------------------------------------------

  /**
   * 追蹤 KV 操作
   * @param restaurantId 餐廳 ID
   * @param namespace KV 命名空間類型
   * @param operation 操作類型
   * @param sizeBytes 資料大小 (可選，用於寫入操作)
   */
  async trackOperation(
    restaurantId: string,
    namespace: KVNamespaceType,
    operation: KVOperationType,
    sizeBytes?: number,
  ): Promise<void> {
    try {
      const usageKey = this.getUsageKey(restaurantId, namespace);
      const currentUsage = await this.getUsageMetrics(restaurantId, namespace);

      // 更新計數
      const updatedUsage: KVUsageMetrics = currentUsage || {
        restaurantId,
        namespace,
        keyCount: 0,
        totalSizeBytes: 0,
        operationCount: { reads: 0, writes: 0, deletes: 0 },
        lastUpdated: Date.now(),
      };

      // 更新操作計數
      switch (operation) {
        case "read":
          updatedUsage.operationCount.reads++;
          break;
        case "write":
          updatedUsage.operationCount.writes++;
          updatedUsage.keyCount++;
          if (sizeBytes) {
            updatedUsage.totalSizeBytes += sizeBytes;
          }
          break;
        case "delete":
          updatedUsage.operationCount.deletes++;
          updatedUsage.keyCount = Math.max(0, updatedUsage.keyCount - 1);
          if (sizeBytes) {
            updatedUsage.totalSizeBytes = Math.max(
              0,
              updatedUsage.totalSizeBytes - sizeBytes,
            );
          }
          break;
      }

      updatedUsage.lastUpdated = Date.now();

      // 儲存更新的使用量
      await this.kv.put(usageKey, JSON.stringify(updatedUsage), {
        expirationTtl: 86400 * 7, // 保留 7 天
      });
    } catch (error) {
      // 追蹤失敗不應影響主要操作
      console.error("Failed to track KV operation:", error);
    }
  }

  // --------------------------------------------------------------------------
  // 使用量查詢
  // --------------------------------------------------------------------------

  /**
   * 獲取單一餐廳的使用量指標
   */
  async getUsageMetrics(
    restaurantId: string,
    namespace: KVNamespaceType,
  ): Promise<KVUsageMetrics | null> {
    try {
      const usageKey = this.getUsageKey(restaurantId, namespace);
      const data = await this.kv.get(usageKey);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  /**
   * 獲取餐廳在所有命名空間的使用量
   */
  async getAllUsageForRestaurant(
    restaurantId: string,
  ): Promise<KVUsageMetrics[]> {
    const namespaces: KVNamespaceType[] = [
      "cache",
      "ratelimit",
      "backup",
      "token_blacklist",
    ];
    const results: KVUsageMetrics[] = [];

    const metricsPromises = namespaces.map((ns) =>
      this.getUsageMetrics(restaurantId, ns),
    );
    const allMetrics = await Promise.all(metricsPromises);

    for (const metrics of allMetrics) {
      if (metrics) {
        results.push(metrics);
      }
    }

    return results;
  }

  // --------------------------------------------------------------------------
  // 配額檢查
  // --------------------------------------------------------------------------

  /**
   * 檢查餐廳的配額使用狀況
   */
  async checkQuota(restaurantId: string): Promise<QuotaCheckResult> {
    const allUsage = await this.getAllUsageForRestaurant(restaurantId);

    // 計算總使用量
    let totalKeys = 0;
    let totalSize = 0;
    for (const usage of allUsage) {
      totalKeys += usage.keyCount;
      totalSize += usage.totalSizeBytes;
    }

    const keyUsagePercent = totalKeys / this.quotaConfig.maxKeysPerRestaurant;
    const sizeUsagePercent =
      totalSize / this.quotaConfig.maxSizeBytesPerRestaurant;

    const warnings: string[] = [];
    let status: QuotaCheckResult["status"] = "ok";

    // 檢查 key 數量
    if (keyUsagePercent >= 1) {
      warnings.push(
        `Key 數量已超過配額 (${totalKeys}/${this.quotaConfig.maxKeysPerRestaurant})`,
      );
      status = "exceeded";
    } else if (keyUsagePercent >= this.quotaConfig.criticalThreshold) {
      warnings.push(
        `Key 數量接近配額上限 (${(keyUsagePercent * 100).toFixed(1)}%)`,
      );
      status = "critical";
    } else if (keyUsagePercent >= this.quotaConfig.warningThreshold) {
      warnings.push(
        `Key 數量使用較高 (${(keyUsagePercent * 100).toFixed(1)}%)`,
      );
      status = status === "ok" ? "warning" : status;
    }

    // 檢查儲存大小
    if (sizeUsagePercent >= 1) {
      warnings.push(
        `儲存大小已超過配額 (${this.formatBytes(totalSize)}/${this.formatBytes(this.quotaConfig.maxSizeBytesPerRestaurant)})`,
      );
      status = "exceeded";
    } else if (sizeUsagePercent >= this.quotaConfig.criticalThreshold) {
      warnings.push(
        `儲存大小接近配額上限 (${(sizeUsagePercent * 100).toFixed(1)}%)`,
      );
      status = status === "exceeded" ? "exceeded" : "critical";
    } else if (sizeUsagePercent >= this.quotaConfig.warningThreshold) {
      warnings.push(
        `儲存大小使用較高 (${(sizeUsagePercent * 100).toFixed(1)}%)`,
      );
      status = status === "ok" ? "warning" : status;
    }

    return {
      withinQuota: status !== "exceeded",
      keyUsagePercent: keyUsagePercent * 100,
      sizeUsagePercent: sizeUsagePercent * 100,
      warnings,
      status,
    };
  }

  // --------------------------------------------------------------------------
  // 系統總覽
  // --------------------------------------------------------------------------

  /**
   * 獲取系統使用量總覽
   */
  async getSystemOverview(): Promise<SystemUsageOverview> {
    try {
      // 列出所有使用量記錄
      const list = await this.kv.list({ prefix: USAGE_PREFIX });
      const restaurantUsage = new Map<string, { keys: number; size: number }>();
      const quotaViolations: string[] = [];

      // 並行讀取所有使用量數據
      const usagePromises = list.keys.map(async (key) => {
        const data = await this.kv.get(key.name);
        if (data) {
          return JSON.parse(data) as KVUsageMetrics;
        }
        return null;
      });

      const allUsage = await Promise.all(usagePromises);

      // 彙總數據
      for (const usage of allUsage) {
        if (!usage) continue;

        const current = restaurantUsage.get(usage.restaurantId) || {
          keys: 0,
          size: 0,
        };
        current.keys += usage.keyCount;
        current.size += usage.totalSizeBytes;
        restaurantUsage.set(usage.restaurantId, current);
      }

      // 計算總覽
      let totalKeys = 0;
      let totalSize = 0;
      const consumers: Array<{
        restaurantId: string;
        keyCount: number;
        sizeBytes: number;
      }> = [];

      for (const [restaurantId, usage] of restaurantUsage.entries()) {
        totalKeys += usage.keys;
        totalSize += usage.size;
        consumers.push({
          restaurantId,
          keyCount: usage.keys,
          sizeBytes: usage.size,
        });

        // 檢查配額違規
        if (usage.keys > this.quotaConfig.maxKeysPerRestaurant) {
          quotaViolations.push(`餐廳 ${restaurantId}: key 數量超標`);
        }
        if (usage.size > this.quotaConfig.maxSizeBytesPerRestaurant) {
          quotaViolations.push(`餐廳 ${restaurantId}: 儲存大小超標`);
        }
      }

      // 排序取前 10 名消費者
      consumers.sort((a, b) => b.sizeBytes - a.sizeBytes);
      const topConsumers = consumers.slice(0, 10);

      return {
        totalRestaurants: restaurantUsage.size,
        totalKeys,
        totalSizeBytes: totalSize,
        topConsumers,
        quotaViolations,
      };
    } catch (error) {
      console.error("Failed to get system overview:", error);
      return {
        totalRestaurants: 0,
        totalKeys: 0,
        totalSizeBytes: 0,
        topConsumers: [],
        quotaViolations: [],
      };
    }
  }

  // --------------------------------------------------------------------------
  // 重置與清理
  // --------------------------------------------------------------------------

  /**
   * 重置餐廳的使用量統計
   */
  async resetUsage(
    restaurantId: string,
    namespace?: KVNamespaceType,
  ): Promise<void> {
    if (namespace) {
      const usageKey = this.getUsageKey(restaurantId, namespace);
      await this.kv.delete(usageKey);
    } else {
      // 重置所有命名空間
      const namespaces: KVNamespaceType[] = [
        "cache",
        "ratelimit",
        "backup",
        "token_blacklist",
      ];
      await Promise.all(
        namespaces.map((ns) =>
          this.kv.delete(this.getUsageKey(restaurantId, ns)),
        ),
      );
    }
  }

  // --------------------------------------------------------------------------
  // 輔助方法
  // --------------------------------------------------------------------------

  private getUsageKey(
    restaurantId: string,
    namespace: KVNamespaceType,
  ): string {
    return `${USAGE_PREFIX}${restaurantId}:${namespace}`;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
}

// ============================================================================
// Factory Function
// ============================================================================

let kvUsageServiceInstance: KVUsageService | null = null;

export function createKVUsageService(
  kv: KVNamespace,
  quotaConfig?: Partial<KVQuotaConfig>,
): KVUsageService {
  if (!kvUsageServiceInstance) {
    kvUsageServiceInstance = new KVUsageService(kv, quotaConfig);
  }
  return kvUsageServiceInstance;
}
