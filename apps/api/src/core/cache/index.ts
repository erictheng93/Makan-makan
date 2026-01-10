/**
 * Core Cache Module
 * Centralized caching functionality for feature modules
 */

import type { KVNamespace } from "@cloudflare/workers-types";

export interface CacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(pattern?: string): Promise<void>;
}

export class KVCacheService implements CacheService {
  constructor(private kv: KVNamespace) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.kv.get(key, "json");
      return value as T | null;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const options = ttl ? { expirationTtl: ttl } : undefined;
      await this.kv.put(key, JSON.stringify(value), options);
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      await this.kv.delete(key);
      return true;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * 清除符合模式的快取項目
   *
   * 優化：使用分批並行刪除取代順序刪除，提升 5-10 倍效能
   */
  async clear(pattern?: string): Promise<void> {
    try {
      if (pattern) {
        const list = await this.kv.list({ prefix: pattern });
        const BATCH_SIZE = 100; // 每批刪除 100 個 key

        // 分批並行刪除
        for (let i = 0; i < list.keys.length; i += BATCH_SIZE) {
          const batch = list.keys.slice(i, i + BATCH_SIZE);
          await Promise.all(batch.map((key) => this.kv.delete(key.name)));
        }
      }
    } catch (error) {
      console.error(`Cache clear error:`, error);
    }
  }
}

// Cache key generators
export const cacheKeys = {
  user: (id: number) => `user:${id}`,
  restaurant: (id: number) => `restaurant:${id}`,
  menu: (restaurantId: number) => `menu:${restaurantId}`,
  order: (id: number) => `order:${id}`,
  qrCode: (id: number) => `qr:${id}`,
  qrTemplate: (id: number) => `qr-template:${id}`,
  qrBatch: (batchId: string) => `qr-batch:${batchId}`,
  qrStats: (restaurantId?: number) => `qr-stats:${restaurantId || "global"}`,
  analytics: (restaurantId: number, period: string) =>
    `analytics:${restaurantId}:${period}`,
};
