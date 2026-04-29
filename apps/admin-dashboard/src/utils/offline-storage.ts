/**
 * Offline Storage Utilities for Admin Dashboard
 * IndexedDB-based offline data management for administrative operations
 */

export interface OfflineOrderUpdate {
  id: string;
  order_id: string;
  restaurant_id: string;
  status: string;
  notes?: string;
  updated_by: string;
  timestamp: string;
  synced: boolean;
}

export interface CachedAnalyticsData {
  id: string;
  restaurant_id: string;
  period: string;
  data: Record<string, any>;
  cached_at: string;
}

export interface OfflineMenuUpdate {
  id: string;
  restaurant_id: string;
  action: "create" | "update" | "delete";
  menu_item_id?: string;
  data: Record<string, any>;
  timestamp: string;
  synced: boolean;
}

export interface CachedBackupData {
  id: string;
  restaurant_id: string;
  backup_type: string;
  data: any;
  cached_at: string;
  expires_at: string;
}

export interface OfflineUserAction {
  id: string;
  restaurant_id: string;
  action_type: string;
  target_id: string;
  data: Record<string, any>;
  user_id: string;
  timestamp: string;
  synced: boolean;
}

class AdminOfflineStorageManager {
  private dbName = "MakanMakanAdmin";
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Order updates for offline management
        if (!db.objectStoreNames.contains("offlineOrderUpdates")) {
          const ordersStore = db.createObjectStore("offlineOrderUpdates", {
            keyPath: "id",
          });
          ordersStore.createIndex("order_id", "order_id", { unique: false });
          ordersStore.createIndex("restaurant_id", "restaurant_id", {
            unique: false,
          });
          ordersStore.createIndex("synced", "synced", { unique: false });
          ordersStore.createIndex("timestamp", "timestamp", { unique: false });
        }

        // Analytics data cache
        if (!db.objectStoreNames.contains("cachedAnalytics")) {
          const analyticsStore = db.createObjectStore("cachedAnalytics", {
            keyPath: "id",
          });
          analyticsStore.createIndex("restaurant_id", "restaurant_id", {
            unique: false,
          });
          analyticsStore.createIndex("period", "period", { unique: false });
          analyticsStore.createIndex("cached_at", "cached_at", {
            unique: false,
          });
        }

        // Menu updates for offline editing
        if (!db.objectStoreNames.contains("offlineMenuUpdates")) {
          const menuStore = db.createObjectStore("offlineMenuUpdates", {
            keyPath: "id",
          });
          menuStore.createIndex("restaurant_id", "restaurant_id", {
            unique: false,
          });
          menuStore.createIndex("action", "action", { unique: false });
          menuStore.createIndex("synced", "synced", { unique: false });
          menuStore.createIndex("timestamp", "timestamp", { unique: false });
        }

        // Backup data cache
        if (!db.objectStoreNames.contains("cachedBackups")) {
          const backupStore = db.createObjectStore("cachedBackups", {
            keyPath: "id",
          });
          backupStore.createIndex("restaurant_id", "restaurant_id", {
            unique: false,
          });
          backupStore.createIndex("backup_type", "backup_type", {
            unique: false,
          });
          backupStore.createIndex("cached_at", "cached_at", { unique: false });
          backupStore.createIndex("expires_at", "expires_at", {
            unique: false,
          });
        }

        // User actions for audit trail
        if (!db.objectStoreNames.contains("offlineUserActions")) {
          const actionsStore = db.createObjectStore("offlineUserActions", {
            keyPath: "id",
          });
          actionsStore.createIndex("restaurant_id", "restaurant_id", {
            unique: false,
          });
          actionsStore.createIndex("action_type", "action_type", {
            unique: false,
          });
          actionsStore.createIndex("user_id", "user_id", { unique: false });
          actionsStore.createIndex("synced", "synced", { unique: false });
          actionsStore.createIndex("timestamp", "timestamp", { unique: false });
        }

        // Admin settings and preferences
        if (!db.objectStoreNames.contains("adminSettings")) {
          db.createObjectStore("adminSettings", { keyPath: "key" });
        }

        // Dashboard layout and customizations
        if (!db.objectStoreNames.contains("dashboardLayouts")) {
          const layoutStore = db.createObjectStore("dashboardLayouts", {
            keyPath: "id",
          });
          layoutStore.createIndex("user_id", "user_id", { unique: false });
          layoutStore.createIndex("restaurant_id", "restaurant_id", {
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

  // Order Updates Management
  async saveOfflineOrderUpdate(update: OfflineOrderUpdate): Promise<void> {
    const store = this.getStore("offlineOrderUpdates", "readwrite");
    return new Promise((resolve, reject) => {
      const request = store.put(update);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getUnsyncedOrderUpdates(): Promise<OfflineOrderUpdate[]> {
    const updates = await this.getAllFromIndex<OfflineOrderUpdate>(
      "offlineOrderUpdates",
      "synced",
      false,
    );
    return updates.filter((update) => update.synced === false);
  }

  async markOrderUpdateAsSynced(updateId: string): Promise<void> {
    const store = this.getStore("offlineOrderUpdates", "readwrite");
    return new Promise((resolve, reject) => {
      const getRequest = store.get(updateId);
      getRequest.onsuccess = () => {
        const update = getRequest.result;
        if (update) {
          update.synced = true;
          const updateRequest = store.put(update);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          reject(new Error("Order update not found"));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Analytics Cache Management
  async cacheAnalyticsData(data: CachedAnalyticsData): Promise<void> {
    const store = this.getStore("cachedAnalytics", "readwrite");
    data.cached_at = new Date().toISOString();
    return new Promise((resolve, reject) => {
      const request = store.put(data);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCachedAnalytics(
    restaurantId: string,
    period: string,
  ): Promise<CachedAnalyticsData | null> {
    const store = this.getStore("cachedAnalytics");
    const index = store.index("restaurant_id");
    return new Promise((resolve, reject) => {
      const request = index.getAll(restaurantId);
      request.onsuccess = () => {
        const results = request.result.filter((item) => item.period === period);
        resolve(results.length > 0 ? results[0] : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Menu Updates Management
  async saveOfflineMenuUpdate(update: OfflineMenuUpdate): Promise<void> {
    const store = this.getStore("offlineMenuUpdates", "readwrite");
    return new Promise((resolve, reject) => {
      const request = store.put(update);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getUnsyncedMenuUpdates(): Promise<OfflineMenuUpdate[]> {
    const updates = await this.getAllFromIndex<OfflineMenuUpdate>(
      "offlineMenuUpdates",
      "synced",
      false,
    );
    return updates.filter((update) => update.synced === false);
  }

  async markMenuUpdateAsSynced(updateId: string): Promise<void> {
    const store = this.getStore("offlineMenuUpdates", "readwrite");
    return new Promise((resolve, reject) => {
      const getRequest = store.get(updateId);
      getRequest.onsuccess = () => {
        const update = getRequest.result;
        if (update) {
          update.synced = true;
          const updateRequest = store.put(update);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          reject(new Error("Menu update not found"));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Backup Data Cache Management
  async cacheBackupData(backup: CachedBackupData): Promise<void> {
    const store = this.getStore("cachedBackups", "readwrite");
    backup.cached_at = new Date().toISOString();
    return new Promise((resolve, reject) => {
      const request = store.put(backup);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCachedBackups(restaurantId: string): Promise<CachedBackupData[]> {
    const store = this.getStore("cachedBackups");
    const index = store.index("restaurant_id");
    return new Promise((resolve, reject) => {
      const request = index.getAll(restaurantId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // User Actions Management
  async saveOfflineUserAction(action: OfflineUserAction): Promise<void> {
    const store = this.getStore("offlineUserActions", "readwrite");
    return new Promise((resolve, reject) => {
      const request = store.put(action);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getUnsyncedUserActions(): Promise<OfflineUserAction[]> {
    const actions = await this.getAllFromIndex<OfflineUserAction>(
      "offlineUserActions",
      "synced",
      false,
    );
    return actions.filter((action) => action.synced === false);
  }

  async markUserActionAsSynced(actionId: string): Promise<void> {
    const store = this.getStore("offlineUserActions", "readwrite");
    return new Promise((resolve, reject) => {
      const getRequest = store.get(actionId);
      getRequest.onsuccess = () => {
        const action = getRequest.result;
        if (action) {
          action.synced = true;
          const updateRequest = store.put(action);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  // Settings Management
  async saveSetting(key: string, value: any): Promise<void> {
    const store = this.getStore("adminSettings", "readwrite");
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
    const store = this.getStore("adminSettings");
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value || null);
      request.onerror = () => reject(request.error);
    });
  }

  // Dashboard Layout Management
  async saveDashboardLayout(layout: {
    id: string;
    user_id: string;
    restaurant_id: string;
    layout_data: any;
  }): Promise<void> {
    const store = this.getStore("dashboardLayouts", "readwrite");
    const layoutWithTimestamp = {
      ...layout,
      updated_at: new Date().toISOString(),
    };
    return new Promise((resolve, reject) => {
      const request = store.put(layoutWithTimestamp);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getDashboardLayout(userId: string, restaurantId: string): Promise<any> {
    const store = this.getStore("dashboardLayouts");
    const index = store.index("user_id");
    return new Promise((resolve, reject) => {
      const request = index.getAll(userId);
      request.onsuccess = () => {
        const results = request.result.filter(
          (item) => item.restaurant_id === restaurantId,
        );
        resolve(results.length > 0 ? results[0] : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Cache Cleanup and Maintenance
  async cleanupExpiredCache(expirationHours: number = 12): Promise<void> {
    const cutoffTime = new Date(
      Date.now() - expirationHours * 60 * 60 * 1000,
    ).toISOString();

    // Cleanup expired analytics data
    const analyticsStore = this.getStore("cachedAnalytics", "readwrite");
    const analyticsIndex = analyticsStore.index("cached_at");
    const analyticsRange = IDBKeyRange.upperBound(cutoffTime);

    await new Promise<void>((resolve, reject) => {
      const request = analyticsIndex.openCursor(analyticsRange);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });

    // Cleanup expired backups
    const backupStore = this.getStore("cachedBackups", "readwrite");
    const backupIndex = backupStore.index("expires_at");
    const backupRange = IDBKeyRange.upperBound(new Date().toISOString());

    await new Promise<void>((resolve, reject) => {
      const request = backupIndex.openCursor(backupRange);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getStorageInfo(): Promise<{
    orderUpdatesCount: number;
    analyticsCount: number;
    menuUpdatesCount: number;
    backupsCount: number;
    userActionsCount: number;
  }> {
    const counts = await Promise.all([
      this.getCount("offlineOrderUpdates"),
      this.getCount("cachedAnalytics"),
      this.getCount("offlineMenuUpdates"),
      this.getCount("cachedBackups"),
      this.getCount("offlineUserActions"),
    ]);

    return {
      orderUpdatesCount: counts[0],
      analyticsCount: counts[1],
      menuUpdatesCount: counts[2],
      backupsCount: counts[3],
      userActionsCount: counts[4],
    };
  }

  private async getCount(storeName: string): Promise<number> {
    const store = this.getStore(storeName);
    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private async getAllFromIndex<T>(
    storeName: string,
    indexName: string,
    query?: IDBValidKey | IDBKeyRange,
  ): Promise<T[]> {
    const store = this.getStore(storeName);
    const index = store.index(indexName);
    return new Promise((resolve, reject) => {
      const request =
        query === undefined ? index.getAll() : index.getAll(query);
      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllCache(): Promise<void> {
    const storeNames = ["cachedAnalytics", "cachedBackups", "dashboardLayouts"];

    for (const storeName of storeNames) {
      const store = this.getStore(storeName, "readwrite");
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }
}

export const adminOfflineStorage = new AdminOfflineStorageManager();

// Auto-initialize when imported
adminOfflineStorage.initialize().catch((error) => {
  console.error("Failed to initialize admin offline storage:", error);
});

export default adminOfflineStorage;
