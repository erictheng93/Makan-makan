/**
 * 🚀 Optimized Offline Storage Utilities
 * Enhanced IndexedDB management with performance optimization for Customer App
 */

export interface OfflineOrder {
  id: string;
  restaurant_id: string;
  table_id?: string;
  items: Array<{
    menu_item_id: string;
    quantity: number;
    customizations?: Record<string, any>;
    special_instructions?: string;
  }>;
  customer_info: {
    name?: string;
    phone?: string;
    email?: string;
  };
  total_amount: number;
  created_at: string;
  synced: boolean;
}

export interface CachedMenuItem {
  id: string;
  restaurant_id: string;
  name: string;
  description: string;
  price: number;
  category_id: string;
  image_url?: string;
  available: boolean;
  cached_at: string;
}

export interface CachedRestaurant {
  id: string;
  name: string;
  description: string;
  address: string;
  phone: string;
  image_url?: string;
  menu_items: CachedMenuItem[];
  cached_at: string;
}

interface PerformanceMetric {
  operation: string;
  duration: number;
  recordCount: number;
  timestamp: number;
}

class OptimizedOfflineStorageManager {
  private dbName = "MakanMakanCustomerOpt";
  private dbVersion = 2;
  private db: IDBDatabase | null = null;
  private performanceLog: PerformanceMetric[] = [];

  // 🚀 Performance configuration
  private readonly BATCH_SIZE = 50;
  private readonly MAX_PERFORMANCE_LOG = 100;
  private readonly COMPRESSION_THRESHOLD = 1000; // bytes

  async initialize(): Promise<void> {
    console.log("[Storage-OPT] 🚀 Initializing optimized offline storage...");

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        console.log("[Storage-OPT] ✅ Optimized database initialized");
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 🚀 Optimized orders store with compound indexes
        if (!db.objectStoreNames.contains("optimizedOrders")) {
          const ordersStore = db.createObjectStore("optimizedOrders", {
            keyPath: "id",
          });
          ordersStore.createIndex(
            "restaurant_date",
            ["restaurant_id", "created_at"],
            { unique: false },
          );
          ordersStore.createIndex(
            "synced_timestamp",
            ["synced", "created_at"],
            { unique: false },
          );
          ordersStore.createIndex(
            "status_priority",
            ["status", "total_amount"],
            { unique: false },
          );
        }

        // 🚀 Compressed restaurants cache
        if (!db.objectStoreNames.contains("compressedRestaurants")) {
          const restaurantsStore = db.createObjectStore(
            "compressedRestaurants",
            { keyPath: "id" },
          );
          restaurantsStore.createIndex("cached_at", "cached_at", {
            unique: false,
          });
          restaurantsStore.createIndex("size_index", "compressedSize", {
            unique: false,
          });
        }

        // 🚀 Optimized menu items with smart indexing
        if (!db.objectStoreNames.contains("optimizedMenuItems")) {
          const menuStore = db.createObjectStore("optimizedMenuItems", {
            keyPath: "id",
          });
          menuStore.createIndex(
            "restaurant_category",
            ["restaurant_id", "category_id"],
            { unique: false },
          );
          menuStore.createIndex("price_available", ["price", "available"], {
            unique: false,
          });
          menuStore.createIndex("cached_at", "cached_at", { unique: false });
        }

        // 🚀 Performance metrics store
        if (!db.objectStoreNames.contains("performanceMetrics")) {
          const perfStore = db.createObjectStore("performanceMetrics", {
            keyPath: "id",
            autoIncrement: true,
          });
          perfStore.createIndex("operation", "operation", { unique: false });
          perfStore.createIndex("timestamp", "timestamp", { unique: false });
        }

        // 🚀 Cache metadata for intelligent cleanup
        if (!db.objectStoreNames.contains("cacheMetadata")) {
          const metaStore = db.createObjectStore("cacheMetadata", {
            keyPath: "key",
          });
          metaStore.createIndex("lastAccessed", "lastAccessed", {
            unique: false,
          });
          metaStore.createIndex("accessCount", "accessCount", {
            unique: false,
          });
        }

        // App settings and preferences (existing)
        if (!db.objectStoreNames.contains("appSettings")) {
          db.createObjectStore("appSettings", { keyPath: "key" });
        }

        // User favorites (existing)
        if (!db.objectStoreNames.contains("userFavorites")) {
          const favoritesStore = db.createObjectStore("userFavorites", {
            keyPath: "id",
          });
          favoritesStore.createIndex("type", "type", { unique: false });
          favoritesStore.createIndex("created_at", "created_at", {
            unique: false,
          });
        }
      };
    });
  }

  private getStore(
    storeName: string,
    mode: IDBTransactionMode = "readonly",
  ): IDBObjectStore {
    if (!this.db) {
      throw new Error("Database not initialized");
    }
    const transaction = this.db.transaction([storeName], mode);
    return transaction.objectStore(storeName);
  }

  // 🚀 Optimized batch operations
  async batchSaveOrders(orders: OfflineOrder[]): Promise<void> {
    const start = performance.now();

    try {
      if (!this.db) throw new Error("Database not initialized");

      const transaction = this.db.transaction(["optimizedOrders"], "readwrite");
      const store = transaction.objectStore("optimizedOrders");

      // Process in batches to avoid blocking UI
      for (let i = 0; i < orders.length; i += this.BATCH_SIZE) {
        const batch = orders.slice(i, i + this.BATCH_SIZE);

        await Promise.all(
          batch.map(
            (order) =>
              new Promise<void>((resolve, reject) => {
                const compressed = this.compressIfNeeded(order);
                const request = store.put(compressed);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
              }),
          ),
        );

        // Yield control to prevent UI blocking
        await this.yieldControl();
      }

      const duration = performance.now() - start;
      this.logPerformance("batch_save_orders", duration, orders.length);

      console.log(
        `[Storage-OPT] ✅ Batch saved ${orders.length} orders in ${duration.toFixed(2)}ms`,
      );
    } catch (error) {
      console.error("[Storage-OPT] ❌ Batch save failed:", error);
      throw error;
    }
  }

  // 🚀 Smart order retrieval with caching
  async getOrdersOptimized(
    restaurantId: string,
    limit: number = 50,
  ): Promise<OfflineOrder[]> {
    const start = performance.now();

    try {
      const store = this.getStore("optimizedOrders");
      const index = store.index("restaurant_date");

      // Create range for specific restaurant
      const range = IDBKeyRange.bound(
        [restaurantId, ""],
        [restaurantId, "\uffff"],
      );

      const results = await new Promise<OfflineOrder[]>((resolve, reject) => {
        const orders: OfflineOrder[] = [];
        const request = index.openCursor(range, "prev"); // Most recent first

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor && orders.length < limit) {
            const decompressed = this.decompressIfNeeded(cursor.value);
            orders.push(decompressed);
            cursor.continue();
          } else {
            resolve(orders);
          }
        };

        request.onerror = () => reject(request.error);
      });

      const duration = performance.now() - start;
      this.logPerformance("get_orders_optimized", duration, results.length);

      // Update cache metadata
      await this.updateCacheMetadata(`orders_${restaurantId}`);

      return results;
    } catch (error) {
      console.error(
        "[Storage-OPT] ❌ Optimized order retrieval failed:",
        error,
      );
      throw error;
    }
  }

  // 🚀 Compressed restaurant caching
  async cacheRestaurantOptimized(restaurant: CachedRestaurant): Promise<void> {
    const start = performance.now();

    try {
      const store = this.getStore("compressedRestaurants", "readwrite");

      // Add compression metadata
      const restaurantWithMeta = {
        ...restaurant,
        cached_at: new Date().toISOString(),
        originalSize: JSON.stringify(restaurant).length,
        compressedSize: 0,
      };

      // Compress if needed
      const compressed = this.compressIfNeeded(restaurantWithMeta);
      restaurantWithMeta.compressedSize = JSON.stringify(compressed).length;

      await new Promise<void>((resolve, reject) => {
        const request = store.put(compressed);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      const duration = performance.now() - start;
      this.logPerformance("cache_restaurant_optimized", duration, 1);

      console.log(
        `[Storage-OPT] ✅ Cached restaurant ${restaurant.id} (${restaurantWithMeta.compressedSize} bytes)`,
      );
    } catch (error) {
      console.error("[Storage-OPT] ❌ Restaurant caching failed:", error);
      throw error;
    }
  }

  // 🚀 Smart menu items caching with deduplication
  async cacheMenuItemsOptimized(menuItems: CachedMenuItem[]): Promise<void> {
    const start = performance.now();

    try {
      const store = this.getStore("optimizedMenuItems", "readwrite");

      // Deduplicate and batch process
      const uniqueItems = this.deduplicateMenuItems(menuItems);

      for (let i = 0; i < uniqueItems.length; i += this.BATCH_SIZE) {
        const batch = uniqueItems.slice(i, i + this.BATCH_SIZE);

        await Promise.all(
          batch.map(
            (item) =>
              new Promise<void>((resolve, reject) => {
                const optimizedItem = {
                  ...item,
                  cached_at: new Date().toISOString(),
                };
                const compressed = this.compressIfNeeded(optimizedItem);
                const request = store.put(compressed);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
              }),
          ),
        );

        await this.yieldControl();
      }

      const duration = performance.now() - start;
      this.logPerformance(
        "cache_menu_items_optimized",
        duration,
        uniqueItems.length,
      );

      console.log(
        `[Storage-OPT] ✅ Cached ${uniqueItems.length} menu items (${menuItems.length - uniqueItems.length} duplicates removed)`,
      );
    } catch (error) {
      console.error("[Storage-OPT] ❌ Menu items caching failed:", error);
      throw error;
    }
  }

  // 🚀 Advanced query with performance optimization
  async queryMenuItemsOptimized(
    restaurantId: string,
    categoryId?: string,
    priceRange?: { min: number; max: number },
    availableOnly: boolean = true,
  ): Promise<CachedMenuItem[]> {
    const start = performance.now();

    try {
      const store = this.getStore("optimizedMenuItems");

      let results: CachedMenuItem[];

      if (categoryId) {
        // Use compound index for restaurant + category
        const index = store.index("restaurant_category");
        const range = IDBKeyRange.only([restaurantId, categoryId]);

        results = await new Promise<CachedMenuItem[]>((resolve, reject) => {
          const items: CachedMenuItem[] = [];
          const request = index.openCursor(range);

          request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor) {
              const item = this.decompressIfNeeded(cursor.value);

              // Apply filters
              if (
                (!availableOnly || item.available) &&
                (!priceRange ||
                  (item.price >= priceRange.min &&
                    item.price <= priceRange.max))
              ) {
                items.push(item);
              }

              cursor.continue();
            } else {
              resolve(items);
            }
          };

          request.onerror = () => reject(request.error);
        });
      } else {
        results = await this.getCachedMenuItemsFromStore(restaurantId);

        if (priceRange) {
          results = results.filter(
            (item) =>
              item.price >= priceRange.min && item.price <= priceRange.max,
          );
        }

        if (availableOnly) {
          results = results.filter((item) => item.available);
        }
      }

      const duration = performance.now() - start;
      this.logPerformance(
        "query_menu_items_optimized",
        duration,
        results.length,
      );

      // Update cache metadata
      await this.updateCacheMetadata(
        `menu_${restaurantId}_${categoryId || "all"}`,
      );

      return results;
    } catch (error) {
      console.error("[Storage-OPT] ❌ Optimized menu query failed:", error);
      throw error;
    }
  }

  // 🚀 Intelligent cache cleanup
  async smartCacheCleanup(): Promise<void> {
    console.log("[Storage-OPT] 🧹 Starting smart cache cleanup...");

    try {
      // Get cache metadata
      const metadataStore = this.getStore("cacheMetadata");
      const allMetadata = await new Promise<any[]>((resolve, reject) => {
        const request = metadataStore.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // Find least accessed items
      const sortedByAccess = allMetadata.sort(
        (a, b) => a.accessCount - b.accessCount,
      );
      const toCleanup = sortedByAccess.slice(
        0,
        Math.floor(sortedByAccess.length * 0.1),
      ); // Clean 10%

      let cleanedCount = 0;

      for (const meta of toCleanup) {
        const [type, id] = meta.key.split("_");

        try {
          switch (type) {
            case "restaurant":
              await this.deleteCachedRestaurant(id);
              break;
            case "menu":
              await this.cleanupOldMenuItems(id);
              break;
          }
          cleanedCount++;
        } catch (error) {
          console.warn(`[Storage-OPT] Failed to cleanup ${meta.key}:`, error);
        }
      }

      console.log(
        `[Storage-OPT] ✅ Smart cleanup completed: ${cleanedCount} items cleaned`,
      );
    } catch (error) {
      console.error("[Storage-OPT] ❌ Smart cleanup failed:", error);
    }
  }

  // 🚀 Performance monitoring and reporting
  getPerformanceReport(): any {
    if (this.performanceLog.length === 0) {
      return { message: "No performance data available" };
    }

    const report = {
      totalOperations: this.performanceLog.length,
      averageDuration: 0,
      operationBreakdown: {} as Record<string, any>,
      recommendations: [] as string[],
    };

    const operations = {} as Record<
      string,
      { count: number; totalDuration: number; totalRecords: number }
    >;

    // Analyze performance data
    for (const log of this.performanceLog) {
      if (!operations[log.operation]) {
        operations[log.operation] = {
          count: 0,
          totalDuration: 0,
          totalRecords: 0,
        };
      }
      operations[log.operation].count++;
      operations[log.operation].totalDuration += log.duration;
      operations[log.operation].totalRecords += log.recordCount;
      report.averageDuration += log.duration;
    }

    report.averageDuration /= this.performanceLog.length;

    // Generate operation breakdown and recommendations
    for (const [operation, stats] of Object.entries(operations)) {
      const avgDuration = stats.totalDuration / stats.count;
      const avgRecordsPerOp = stats.totalRecords / stats.count;

      report.operationBreakdown[operation] = {
        count: stats.count,
        averageDuration: avgDuration,
        totalDuration: stats.totalDuration,
        averageRecordsPerOperation: avgRecordsPerOp,
        throughput: avgRecordsPerOp / (avgDuration / 1000), // records per second
      };

      // Generate recommendations
      if (avgDuration > 100) {
        report.recommendations.push(
          `Consider optimizing ${operation} (avg: ${avgDuration.toFixed(2)}ms)`,
        );
      }
    }

    return report;
  }

  // 🚀 Data compression utilities
  private compressIfNeeded(data: any): any {
    const jsonString = JSON.stringify(data);

    if (jsonString.length > this.COMPRESSION_THRESHOLD) {
      return {
        ...data,
        _compressed: true,
        _originalSize: jsonString.length,
        // Simple compression simulation - in production, use actual compression
        _compressedData: this.simpleCompress(jsonString),
      };
    }

    return data;
  }

  private decompressIfNeeded(data: any): any {
    if (data._compressed) {
      const { _compressed, _originalSize, _compressedData, ...originalData } =
        data;
      // In production, decompress _compressedData
      return originalData;
    }
    return data;
  }

  private simpleCompress(data: string): string {
    // Placeholder for compression - in production, use actual compression library
    return data.slice(0, Math.floor(data.length * 0.7)) + "...[compressed]";
  }

  private deduplicateMenuItems(items: CachedMenuItem[]): CachedMenuItem[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = `${item.id}_${item.restaurant_id}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  private async yieldControl(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  private logPerformance(
    operation: string,
    duration: number,
    recordCount: number,
  ): void {
    this.performanceLog.push({
      operation,
      duration,
      recordCount,
      timestamp: Date.now(),
    });

    // Keep only recent entries
    if (this.performanceLog.length > this.MAX_PERFORMANCE_LOG) {
      this.performanceLog.shift();
    }

    console.log(
      `[Storage-OPT] 📊 ${operation}: ${duration.toFixed(2)}ms (${recordCount} records)`,
    );
  }

  private async updateCacheMetadata(key: string): Promise<void> {
    try {
      const store = this.getStore("cacheMetadata", "readwrite");

      const existing = await new Promise<any>((resolve, reject) => {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const metadata = {
        key,
        lastAccessed: Date.now(),
        accessCount: (existing?.accessCount || 0) + 1,
        firstAccessed: existing?.firstAccessed || Date.now(),
      };

      await new Promise<void>((resolve, reject) => {
        const request = store.put(metadata);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.warn("[Storage-OPT] Failed to update cache metadata:", error);
    }
  }

  // Legacy compatibility methods
  async saveOfflineOrder(order: OfflineOrder): Promise<void> {
    return this.batchSaveOrders([order]);
  }

  async getCachedMenuItems(restaurantId: string): Promise<CachedMenuItem[]> {
    return this.queryMenuItemsOptimized(restaurantId);
  }

  // Additional cleanup methods
  private async deleteCachedRestaurant(restaurantId: string): Promise<void> {
    const store = this.getStore("compressedRestaurants", "readwrite");
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(restaurantId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async cleanupOldMenuItems(restaurantId: string): Promise<void> {
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 24 hours ago
    const store = this.getStore("optimizedMenuItems", "readwrite");
    const index = store.index("cached_at");

    const range = IDBKeyRange.upperBound(cutoffTime);
    const request = index.openCursor(range);

    await new Promise<void>((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const item = cursor.value;
          if (item.restaurant_id === restaurantId) {
            cursor.delete();
          }
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async getCachedMenuItemsFromStore(
    restaurantId: string,
  ): Promise<CachedMenuItem[]> {
    const store = this.getStore("optimizedMenuItems");
    const index = store.index("restaurant_category");
    const range = IDBKeyRange.bound(
      [restaurantId, ""],
      [restaurantId, "\uffff"],
    );

    return new Promise((resolve, reject) => {
      const items: CachedMenuItem[] = [];
      const request = index.openCursor(range);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          items.push(this.decompressIfNeeded(cursor.value));
          cursor.continue();
        } else {
          resolve(items);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Existing interface compatibility
  async getOfflineOrders(): Promise<OfflineOrder[]> {
    // Implementation for backward compatibility
    const store = this.getStore("optimizedOrders");
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result.map((item) =>
          this.decompressIfNeeded(item),
        );
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getUnsyncedOrders(): Promise<OfflineOrder[]> {
    const store = this.getStore("optimizedOrders");
    const index = store.index("synced_timestamp");
    return new Promise((resolve, reject) => {
      const range = IDBKeyRange.bound([false, ""], [false, "\uffff"]);
      const request = index.getAll(range);
      request.onsuccess = () => {
        const results = request.result.map((item) =>
          this.decompressIfNeeded(item),
        );
        resolve(results.filter((order) => order.synced === false));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async markOrderAsSynced(orderId: string): Promise<void> {
    const store = this.getStore("optimizedOrders", "readwrite");
    return new Promise((resolve, reject) => {
      const getRequest = store.get(orderId);
      getRequest.onsuccess = () => {
        const order = getRequest.result;
        if (order) {
          const decompressed = this.decompressIfNeeded(order);
          decompressed.synced = true;
          const compressed = this.compressIfNeeded(decompressed);
          const updateRequest = store.put(compressed);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          reject(new Error("Order not found"));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Additional utility methods for settings and favorites (maintaining compatibility)
  async saveSetting(key: string, value: any): Promise<void> {
    const store = this.getStore("appSettings", "readwrite");
    return new Promise((resolve, reject) => {
      const request = store.put({
        key,
        value,
        updated_at: new Date().toISOString(),
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSetting(key: string): Promise<any> {
    const store = this.getStore("appSettings");
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => reject(request.error);
    });
  }
}

export { OptimizedOfflineStorageManager };
export const optimizedOfflineStorage = new OptimizedOfflineStorageManager();

// Auto-initialize when imported
optimizedOfflineStorage.initialize().catch((error) => {
  console.error(
    "[Storage-OPT] ❌ Failed to initialize optimized offline storage:",
    error,
  );
});

export default optimizedOfflineStorage;
