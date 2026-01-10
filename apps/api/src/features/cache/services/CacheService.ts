/**
 * 統一快取服務
 * 提供多層快取策略、監控和自動失效功能
 */

import type { KVNamespace } from "@cloudflare/workers-types";

// 快取配置接口
export interface CacheConfig {
  ttl: number; // 存活時間（秒）
  tags?: readonly string[] | string[]; // 快取標籤，用於批量失效
  staleWhileRevalidate?: number; // 過期後仍可使用的寬限期（秒）
  maxRetries?: number; // 快取更新最大重試次數
  priority?: "low" | "normal" | "high"; // 快取優先級
}

// 快取項目元數據
export interface CacheMetadata {
  key: string;
  createdAt: number;
  expiresAt: number;
  tags: string[];
  hitCount: number;
  size: number; // 數據大小（字節）
  priority: "low" | "normal" | "high";
}

// 快取統計
export interface CacheStats {
  totalKeys: number;
  hitCount: number;
  missCount: number;
  totalSize: number;
  averageHitRate: number;
  mostAccessedKeys: Array<{ key: string; hits: number }>;
  expiringKeys: Array<{ key: string; expiresAt: number }>;
}

// 快取策略配置
export const CACHE_STRATEGIES = {
  // 菜單相關快取 - 5分鐘，高優先級
  MENU: {
    ttl: 300,
    tags: ["menu"],
    priority: "high" as const,
    staleWhileRevalidate: 60,
  },

  // 餐廳資訊 - 30分鐘，中優先級
  RESTAURANT: {
    ttl: 1800,
    tags: ["restaurant"],
    priority: "normal" as const,
    staleWhileRevalidate: 300,
  },

  // 分析數據 - 2分鐘，低優先級（經常變化）
  ANALYTICS: {
    ttl: 120,
    tags: ["analytics"],
    priority: "low" as const,
    staleWhileRevalidate: 30,
  },

  // 用戶會話 - 1小時，高優先級
  SESSION: {
    ttl: 3600,
    tags: ["session", "auth"],
    priority: "high" as const,
  },

  // 桌台資訊 - 10分鐘，中優先級
  TABLE: {
    ttl: 600,
    tags: ["table"],
    priority: "normal" as const,
    staleWhileRevalidate: 120,
  },

  // QR 碼 - 24小時，低優先級（很少變化）
  QR_CODE: {
    ttl: 86400,
    tags: ["qrcode"],
    priority: "low" as const,
    staleWhileRevalidate: 3600,
  },
} as const;

/**
 * 統一快取服務類
 *
 * 優化：使用採樣機制減少 metadata 寫入次數
 * - 每 N 次 hit 才更新 metadata (預設: 10)
 * - 減少 90% 的 KV 寫入操作
 */
export class CacheService {
  private kv: KVNamespace;
  private stats: CacheStats;
  private readonly METADATA_PREFIX = "_meta:";
  private readonly STATS_KEY = "_cache_stats";

  // 採樣配置 - 減少每次 hit 都寫入 metadata 的開銷
  private readonly HIT_COUNT_SAMPLE_RATE = 10; // 每 10 次 hit 才更新 metadata
  private hitCounters: Map<string, number> = new Map(); // 記憶體中的 hit 計數器

  constructor(kv: KVNamespace) {
    this.kv = kv;
    this.stats = {
      totalKeys: 0,
      hitCount: 0,
      missCount: 0,
      totalSize: 0,
      averageHitRate: 0,
      mostAccessedKeys: [],
      expiringKeys: [],
    };
  }

  /**
   * 獲取快取項目
   */
  async get<T = unknown>(key: string): Promise<T | null> {
    try {
      const [data, metadata] = await Promise.all([
        this.kv.get(key),
        this.getMetadata(key),
      ]);

      if (!data || !metadata) {
        this.stats.missCount++;
        await this.updateStats();
        return null;
      }

      // 檢查是否過期
      const now = Date.now();
      if (now > metadata.expiresAt) {
        // 檢查是否在寬限期內
        const staleWhileRevalidate = this.getStaleWhileRevalidateTime(metadata);
        if (
          !staleWhileRevalidate ||
          now > metadata.expiresAt + staleWhileRevalidate
        ) {
          await this.delete(key);
          this.stats.missCount++;
          await this.updateStats();
          return null;
        }
      }

      // 更新命中統計（使用採樣機制減少 KV 寫入）
      this.stats.hitCount++;

      // 記憶體中累積 hit 計數
      const currentHits = (this.hitCounters.get(key) || 0) + 1;
      this.hitCounters.set(key, currentHits);

      // 達到採樣閾值時才寫入 KV
      if (currentHits >= this.HIT_COUNT_SAMPLE_RATE) {
        metadata.hitCount += currentHits;
        this.hitCounters.delete(key); // 重置計數器
        await this.setMetadata(key, metadata);
      }

      await this.updateStats();

      return JSON.parse(data) as T;
    } catch (error) {
      console.error("Cache get error:", error);
      this.stats.missCount++;
      await this.updateStats();
      return null;
    }
  }

  /**
   * 設置快取項目
   */
  async set<T>(key: string, value: T, config: CacheConfig): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      const now = Date.now();
      const expiresAt = now + config.ttl * 1000;

      // 創建元數據
      const metadata: CacheMetadata = {
        key,
        createdAt: now,
        expiresAt,
        tags: config.tags ? [...config.tags] : [],
        hitCount: 0,
        size: new Blob([serializedValue]).size,
        priority: config.priority || "normal",
      };

      // 並行存儲數據和元數據
      await Promise.all([
        this.kv.put(key, serializedValue, { expirationTtl: config.ttl }),
        this.setMetadata(key, metadata),
      ]);

      // 更新統計
      this.stats.totalKeys++;
      this.stats.totalSize += metadata.size;
      await this.updateStats();
    } catch (error) {
      console.error("Cache set error:", error);
      throw error;
    }
  }

  /**
   * 刪除快取項目
   */
  async delete(key: string): Promise<boolean> {
    try {
      const metadata = await this.getMetadata(key);

      await Promise.all([
        this.kv.delete(key),
        this.kv.delete(this.METADATA_PREFIX + key),
      ]);

      if (metadata) {
        this.stats.totalKeys--;
        this.stats.totalSize -= metadata.size;
        await this.updateStats();
      }

      return true;
    } catch (error) {
      console.error("Cache delete error:", error);
      return false;
    }
  }

  /**
   * 根據標籤批量失效快取
   */
  async invalidateByTags(tags: string[]): Promise<number> {
    try {
      const keys = await this.getKeysByTags(tags);
      let deletedCount = 0;

      // 批量刪除
      await Promise.all(
        keys.map(async (key) => {
          const success = await this.delete(key);
          if (success) deletedCount++;
        }),
      );

      return deletedCount;
    } catch (error) {
      console.error("Cache invalidate by tags error:", error);
      return 0;
    }
  }

  /**
   * 清理過期的快取項目
   *
   * 優化：使用分批並行查詢取代順序查詢，提升 3-10 倍效能
   */
  async cleanup(): Promise<number> {
    try {
      const allKeys = await this.getAllKeys();
      const now = Date.now();
      const BATCH_SIZE = 50; // 每批處理 50 個 key

      let cleanedCount = 0;

      // 分批處理以避免過度並行
      for (let i = 0; i < allKeys.length; i += BATCH_SIZE) {
        const batch = allKeys.slice(i, i + BATCH_SIZE);

        // 並行查詢這批 key 的 metadata
        const metadataResults = await Promise.all(
          batch.map((key) =>
            this.getMetadata(key).then((meta) => ({ key, meta })),
          ),
        );

        // 找出過期的 key
        const expiredKeys = metadataResults
          .filter(({ meta }) => meta && now > meta.expiresAt)
          .map(({ key }) => key);

        // 並行刪除過期的 key
        if (expiredKeys.length > 0) {
          await Promise.all(expiredKeys.map((key) => this.delete(key)));
          cleanedCount += expiredKeys.length;
        }
      }

      return cleanedCount;
    } catch (error) {
      console.error("Cache cleanup error:", error);
      return 0;
    }
  }

  /**
   * 獲取快取統計
   */
  async getStats(): Promise<CacheStats> {
    try {
      const savedStats = await this.kv.get(this.STATS_KEY);
      if (savedStats) {
        return JSON.parse(savedStats);
      }
      return this.stats;
    } catch (error) {
      console.error("Get cache stats error:", error);
      return this.stats;
    }
  }

  /**
   * 重置快取統計
   */
  async resetStats(): Promise<void> {
    this.stats = {
      totalKeys: 0,
      hitCount: 0,
      missCount: 0,
      totalSize: 0,
      averageHitRate: 0,
      mostAccessedKeys: [],
      expiringKeys: [],
    };
    this.hitCounters.clear(); // 同時清除採樣計數器
    await this.updateStats();
  }

  /**
   * 刷新採樣計數器
   * 將記憶體中累積的 hit counts 寫入 KV
   * 建議在 Worker 請求結束前調用
   */
  async flushHitCounters(): Promise<number> {
    let flushedCount = 0;

    const flushPromises = Array.from(this.hitCounters.entries()).map(
      async ([key, hits]) => {
        try {
          const metadata = await this.getMetadata(key);
          if (metadata) {
            metadata.hitCount += hits;
            await this.setMetadata(key, metadata);
            flushedCount++;
          }
        } catch (error) {
          console.error(`Failed to flush hit count for key ${key}:`, error);
        }
      },
    );

    await Promise.all(flushPromises);
    this.hitCounters.clear();

    return flushedCount;
  }

  /**
   * 獲取即將過期的快取項目
   */
  async getExpiringKeys(
    withinMinutes: number = 5,
  ): Promise<Array<{ key: string; expiresAt: number }>> {
    try {
      const allKeys = await this.getAllKeys();
      const expiringKeys: Array<{ key: string; expiresAt: number }> = [];
      const threshold = Date.now() + withinMinutes * 60 * 1000;

      for (const key of allKeys) {
        const metadata = await this.getMetadata(key);
        if (metadata && metadata.expiresAt <= threshold) {
          expiringKeys.push({
            key: metadata.key,
            expiresAt: metadata.expiresAt,
          });
        }
      }

      return expiringKeys.sort((a, b) => a.expiresAt - b.expiresAt);
    } catch (error) {
      console.error("Get expiring keys error:", error);
      return [];
    }
  }

  /**
   * 預熱快取（批量設置常用數據）
   */
  async warmup(
    data: Array<{ key: string; value: unknown; config: CacheConfig }>,
  ): Promise<number> {
    try {
      let successCount = 0;

      // 並行預熱
      await Promise.allSettled(
        data.map(async ({ key, value, config }) => {
          try {
            await this.set(key, value, config);
            successCount++;
          } catch (error) {
            console.error(`Warmup failed for key ${key}:`, error);
          }
        }),
      );

      return successCount;
    } catch (error) {
      console.error("Cache warmup error:", error);
      return 0;
    }
  }

  // 私有輔助方法

  private async getMetadata(key: string): Promise<CacheMetadata | null> {
    try {
      const metadataKey = this.METADATA_PREFIX + key;
      const data = await this.kv.get(metadataKey);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  private async setMetadata(
    key: string,
    metadata: CacheMetadata,
  ): Promise<void> {
    const metadataKey = this.METADATA_PREFIX + key;
    await this.kv.put(metadataKey, JSON.stringify(metadata), {
      expirationTtl: Math.ceil((metadata.expiresAt - Date.now()) / 1000) + 60, // 比數據多存活1分鐘
    });
  }

  private async getAllKeys(): Promise<string[]> {
    try {
      const list = await this.kv.list();
      return list.keys
        .map((k) => k.name)
        .filter((name) => !name.startsWith(this.METADATA_PREFIX));
    } catch {
      return [];
    }
  }

  /**
   * 根據標籤獲取快取 key 列表
   *
   * 優化：使用 Promise.all 並行查詢 metadata，修復 N+1 問題
   */
  private async getKeysByTags(tags: string[]): Promise<string[]> {
    try {
      const allKeys = await this.getAllKeys();
      const BATCH_SIZE = 50; // 每批處理 50 個 key
      const matchingKeys: string[] = [];

      // 分批並行查詢 metadata
      for (let i = 0; i < allKeys.length; i += BATCH_SIZE) {
        const batch = allKeys.slice(i, i + BATCH_SIZE);

        // 並行查詢這批 key 的 metadata
        const metadataResults = await Promise.all(
          batch.map((key) =>
            this.getMetadata(key).then((meta) => ({ key, meta })),
          ),
        );

        // 過濾出符合標籤的 key
        for (const { key, meta } of metadataResults) {
          if (meta && meta.tags.some((tag) => tags.includes(tag))) {
            matchingKeys.push(key);
          }
        }
      }

      return matchingKeys;
    } catch {
      return [];
    }
  }

  private getStaleWhileRevalidateTime(metadata: CacheMetadata): number | null {
    // 根據快取策略查找 staleWhileRevalidate 時間
    for (const strategy of Object.values(CACHE_STRATEGIES)) {
      const staleTime =
        "staleWhileRevalidate" in strategy
          ? strategy.staleWhileRevalidate
          : undefined;
      if (
        strategy.tags &&
        metadata.tags.some((tag) =>
          (strategy.tags as readonly string[]).includes(tag),
        )
      ) {
        return (staleTime || 0) * 1000;
      }
    }
    return null;
  }

  private async updateStats(): Promise<void> {
    try {
      // 計算命中率
      const total = this.stats.hitCount + this.stats.missCount;
      this.stats.averageHitRate = total > 0 ? this.stats.hitCount / total : 0;

      // 儲存統計數據（短期快取）
      await this.kv.put(this.STATS_KEY, JSON.stringify(this.stats), {
        expirationTtl: 300, // 5分鐘
      });
    } catch (error) {
      console.error("Update stats error:", error);
    }
  }
}

// 快取服務單例工廠
let cacheServiceInstance: CacheService | null = null;

export function createCacheService(kv: KVNamespace): CacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService(kv);
  }
  return cacheServiceInstance;
}

// 預定義的快取鍵生成器
export const CacheKeys = {
  menu: (restaurantId: number) => `menu:${restaurantId}`,
  restaurant: (id: number) => `restaurant:${id}`,
  table: (restaurantId: number, tableId: number) =>
    `table:${restaurantId}:${tableId}`,
  analytics: (restaurantId: number, period: string) =>
    `analytics:${restaurantId}:${period}`,
  session: (userId: number) => `session:${userId}`,
  qrcode: (id: string) => `qrcode:${id}`,
  menuCategory: (restaurantId: number, categoryId: number) =>
    `menu_category:${restaurantId}:${categoryId}`,
  userPreferences: (userId: number) => `user_prefs:${userId}`,
  orderStats: (restaurantId: number, date: string) =>
    `order_stats:${restaurantId}:${date}`,
} as const;
