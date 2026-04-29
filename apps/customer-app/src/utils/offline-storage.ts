/**
 * Offline Storage Utilities
 * IndexedDB-based offline data management for Customer App
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

class OfflineStorageManager {
  private dbName = "MakanMakanCustomer";
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

        // Orders store for offline order management
        if (!db.objectStoreNames.contains("offlineOrders")) {
          const ordersStore = db.createObjectStore("offlineOrders", {
            keyPath: "id",
          });
          ordersStore.createIndex("restaurant_id", "restaurant_id", {
            unique: false,
          });
          ordersStore.createIndex("created_at", "created_at", {
            unique: false,
          });
          ordersStore.createIndex("synced", "synced", { unique: false });
        }

        // Restaurants cache for offline browsing
        if (!db.objectStoreNames.contains("cachedRestaurants")) {
          const restaurantsStore = db.createObjectStore("cachedRestaurants", {
            keyPath: "id",
          });
          restaurantsStore.createIndex("cached_at", "cached_at", {
            unique: false,
          });
        }

        // Menu items cache
        if (!db.objectStoreNames.contains("cachedMenuItems")) {
          const menuStore = db.createObjectStore("cachedMenuItems", {
            keyPath: "id",
          });
          menuStore.createIndex("restaurant_id", "restaurant_id", {
            unique: false,
          });
          menuStore.createIndex("category_id", "category_id", {
            unique: false,
          });
          menuStore.createIndex("cached_at", "cached_at", { unique: false });
        }

        // App preferences and settings
        if (!db.objectStoreNames.contains("appSettings")) {
          db.createObjectStore("appSettings", { keyPath: "key" });
        }

        // User favorites cache
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

  // Offline Orders Management
  async saveOfflineOrder(order: OfflineOrder): Promise<void> {
    const store = this.getStore("offlineOrders", "readwrite");
    return new Promise((resolve, reject) => {
      const request = store.put(order);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getOfflineOrders(): Promise<OfflineOrder[]> {
    const store = this.getStore("offlineOrders");
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getUnsyncedOrders(): Promise<OfflineOrder[]> {
    const store = this.getStore("offlineOrders");
    const index = store.index("synced");
    return new Promise((resolve, reject) => {
      const request = index.getAll(false);
      request.onsuccess = () =>
        resolve(request.result.filter((order) => order.synced === false));
      request.onerror = () => reject(request.error);
    });
  }

  async markOrderAsSynced(orderId: string): Promise<void> {
    const store = this.getStore("offlineOrders", "readwrite");
    return new Promise((resolve, reject) => {
      const getRequest = store.get(orderId);
      getRequest.onsuccess = () => {
        const order = getRequest.result;
        if (order) {
          order.synced = true;
          const updateRequest = store.put(order);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          reject(new Error("Order not found"));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async deleteOfflineOrder(orderId: string): Promise<void> {
    const store = this.getStore("offlineOrders", "readwrite");
    return new Promise((resolve, reject) => {
      const request = store.delete(orderId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Restaurant Cache Management
  async cacheRestaurant(restaurant: CachedRestaurant): Promise<void> {
    const store = this.getStore("cachedRestaurants", "readwrite");
    restaurant.cached_at = new Date().toISOString();
    return new Promise((resolve, reject) => {
      const request = store.put(restaurant);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCachedRestaurant(
    restaurantId: string,
  ): Promise<CachedRestaurant | null> {
    const store = this.getStore("cachedRestaurants");
    return new Promise((resolve, reject) => {
      const request = store.get(restaurantId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllCachedRestaurants(): Promise<CachedRestaurant[]> {
    const store = this.getStore("cachedRestaurants");
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Menu Items Cache Management
  async cacheMenuItems(menuItems: CachedMenuItem[]): Promise<void> {
    const store = this.getStore("cachedMenuItems", "readwrite");
    const promises = menuItems.map((item) => {
      item.cached_at = new Date().toISOString();
      return new Promise<void>((resolve, reject) => {
        const request = store.put(item);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
    await Promise.all(promises);
  }

  async getCachedMenuItems(restaurantId: string): Promise<CachedMenuItem[]> {
    const store = this.getStore("cachedMenuItems");
    const index = store.index("restaurant_id");
    return new Promise((resolve, reject) => {
      const request = index.getAll(restaurantId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // App Settings Management
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

  // User Favorites Management
  async saveFavorite(favorite: {
    id: string;
    type: "restaurant" | "menu_item";
    data: any;
  }): Promise<void> {
    const store = this.getStore("userFavorites", "readwrite");
    const favoriteWithTimestamp = {
      ...favorite,
      created_at: new Date().toISOString(),
    };
    return new Promise((resolve, reject) => {
      const request = store.put(favoriteWithTimestamp);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getFavorites(type?: "restaurant" | "menu_item"): Promise<any[]> {
    const store = this.getStore("userFavorites");

    if (type) {
      const index = store.index("type");
      return new Promise((resolve, reject) => {
        const request = index.getAll(type);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } else {
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
  }

  async removeFavorite(favoriteId: string): Promise<void> {
    const store = this.getStore("userFavorites", "readwrite");
    return new Promise((resolve, reject) => {
      const request = store.delete(favoriteId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Cache Cleanup and Maintenance
  async cleanupExpiredCache(expirationHours: number = 24): Promise<void> {
    const cutoffTime = new Date(
      Date.now() - expirationHours * 60 * 60 * 1000,
    ).toISOString();

    // Cleanup expired restaurants
    const restaurantsStore = this.getStore("cachedRestaurants", "readwrite");
    const restaurantsIndex = restaurantsStore.index("cached_at");
    const restaurantsRange = IDBKeyRange.upperBound(cutoffTime);

    await new Promise<void>((resolve, reject) => {
      const request = restaurantsIndex.openCursor(restaurantsRange);
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

    // Cleanup expired menu items
    const menuStore = this.getStore("cachedMenuItems", "readwrite");
    const menuIndex = menuStore.index("cached_at");
    const menuRange = IDBKeyRange.upperBound(cutoffTime);

    await new Promise<void>((resolve, reject) => {
      const request = menuIndex.openCursor(menuRange);
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

  async clearAllCache(): Promise<void> {
    const storeNames = [
      "cachedRestaurants",
      "cachedMenuItems",
      "userFavorites",
    ];

    for (const storeName of storeNames) {
      const store = this.getStore(storeName, "readwrite");
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }

  async getStorageInfo(): Promise<{
    ordersCount: number;
    restaurantsCount: number;
    menuItemsCount: number;
    favoritesCount: number;
  }> {
    const counts = await Promise.all([
      this.getCount("offlineOrders"),
      this.getCount("cachedRestaurants"),
      this.getCount("cachedMenuItems"),
      this.getCount("userFavorites"),
    ]);

    return {
      ordersCount: counts[0],
      restaurantsCount: counts[1],
      menuItemsCount: counts[2],
      favoritesCount: counts[3],
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
}

export const offlineStorage = new OfflineStorageManager();

// Auto-initialize when imported
offlineStorage.initialize().catch((error) => {
  console.error("Failed to initialize offline storage:", error);
});

export default offlineStorage;
