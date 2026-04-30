/**
 * Background Sync Service for Customer App
 * Handles offline data synchronization when network connectivity is restored
 */

import { apiClient } from "@/services/api";
import { offlineStorage, type OfflineOrder } from "./offline-storage";

export interface SyncEvent {
  id: string;
  type:
    | "order_submission"
    | "favorite_sync"
    | "settings_sync"
    | "feedback_sync";
  data: any;
  timestamp: string;
  retryCount: number;
  maxRetries: number;
  priority: "low" | "normal" | "high";
}

class CustomerBackgroundSyncService {
  private syncQueue: SyncEvent[] = [];
  private isOnline = navigator.onLine;
  private syncInProgress = false;
  private retryDelays = [1000, 5000, 15000, 30000, 60000]; // Progressive delays in ms

  constructor() {
    this.initializeEventListeners();
    this.loadSyncQueue();
  }

  private initializeEventListeners(): void {
    // Network status listeners
    window.addEventListener("online", () => {
      console.log("[Background Sync] Network came online");
      this.isOnline = true;
      this.processSyncQueue();
    });

    window.addEventListener("offline", () => {
      console.log("[Background Sync] Network went offline");
      this.isOnline = false;
    });

    // Service Worker message listener
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data.type === "background-sync") {
          this.handleServiceWorkerSync(event.data.tag);
        }
      });
    }
  }

  private async loadSyncQueue(): Promise<void> {
    try {
      const saved = localStorage.getItem("customer_sync_queue");
      if (saved) {
        this.syncQueue = JSON.parse(saved);
      }
    } catch (error) {
      console.error("[Background Sync] Failed to load sync queue:", error);
      this.syncQueue = [];
    }
  }

  private saveSyncQueue(): void {
    try {
      localStorage.setItem(
        "customer_sync_queue",
        JSON.stringify(this.syncQueue),
      );
    } catch (error) {
      console.error("[Background Sync] Failed to save sync queue:", error);
    }
  }

  // Order synchronization
  async syncOfflineOrders(): Promise<void> {
    try {
      const offlineOrders = await offlineStorage.getUnsyncedOrders();

      for (const order of offlineOrders) {
        await this.syncSingleOrder(order);
      }
    } catch (error) {
      console.error("[Background Sync] Failed to sync offline orders:", error);
    }
  }

  private async syncSingleOrder(order: OfflineOrder): Promise<void> {
    try {
      console.log(`[Background Sync] Syncing order ${order.id}`);

      const result = await apiClient.post<{
        id?: string | number;
        orderId?: string | number;
        order_id?: string | number;
      }>("/orders", {
        restaurantId: order.restaurant_id,
        tableId: order.table_id,
        customerName: order.customer_info.name,
        customerPhone: order.customer_info.phone,
        customerEmail: order.customer_info.email,
        customerInfo: order.customer_info,
        items: order.items.map((item) => ({
          menuItemId: item.menu_item_id,
          quantity: item.quantity,
          customizations: item.customizations,
          notes: item.special_instructions,
        })),
        notes: `Offline order ${order.id}`,
      });
      const onlineOrderId = String(
        result?.orderId ?? result?.order_id ?? result?.id ?? order.id,
      );

      console.log(
        `[Background Sync] Order ${order.id} synced successfully as ${onlineOrderId}`,
      );

      // Mark as synced and optionally delete
      await offlineStorage.markOrderAsSynced(order.id);

      // Notify user of successful sync
      this.notifyOrderSynced(order.id, onlineOrderId);
    } catch (error) {
      console.error(
        `[Background Sync] Failed to sync order ${order.id}:`,
        error,
      );

      // Re-queue for retry if not at max attempts
      this.queueOrderSync(order, "retry");
    }
  }

  async queueOrderSync(
    order: OfflineOrder,
    reason: "new" | "retry" = "new",
  ): Promise<void> {
    const syncEvent: SyncEvent = {
      id: `order_${order.id}_${Date.now()}`,
      type: "order_submission",
      data: order,
      timestamp: new Date().toISOString(),
      retryCount:
        reason === "retry" ? this.getExistingRetryCount(order.id) + 1 : 0,
      maxRetries: 5,
      priority: "high",
    };

    // Remove any existing sync events for this order
    this.syncQueue = this.syncQueue.filter(
      (event) =>
        !(event.type === "order_submission" && event.data.id === order.id),
    );

    this.syncQueue.push(syncEvent);
    this.saveSyncQueue();

    // Try to register background sync with service worker
    await this.registerBackgroundSync("order-submission");

    // If online, process immediately
    if (this.isOnline) {
      this.processSyncQueue();
    }
  }

  // Favorites synchronization
  async syncFavorites(): Promise<void> {
    try {
      const favorites = await offlineStorage.getFavorites();

      if (favorites.length === 0) {
        return;
      }

      await apiClient.post("/users/favorites/sync", { favorites });

      console.log("[Background Sync] Favorites synced successfully");
      this.removeSyncEvent("favorite_sync");
    } catch (error) {
      console.error("[Background Sync] Failed to sync favorites:", error);
      this.queueFavoriteSync();
    }
  }

  async queueFavoriteSync(): Promise<void> {
    const syncEvent: SyncEvent = {
      id: `favorites_${Date.now()}`,
      type: "favorite_sync",
      data: {},
      timestamp: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      priority: "normal",
    };

    this.addOrUpdateSyncEvent(syncEvent);
    await this.registerBackgroundSync("favorite-sync");
  }

  // Settings synchronization
  async syncSettings(): Promise<void> {
    try {
      const settings = {
        notifications: await offlineStorage.getSetting("notifications"),
        preferences: await offlineStorage.getSetting("preferences"),
        theme: await offlineStorage.getSetting("theme"),
      };

      await apiClient.post("/users/settings/sync", { settings });

      console.log("[Background Sync] Settings synced successfully");
      this.removeSyncEvent("settings_sync");
    } catch (error) {
      console.error("[Background Sync] Failed to sync settings:", error);
      this.queueSettingsSync();
    }
  }

  async queueSettingsSync(): Promise<void> {
    const syncEvent: SyncEvent = {
      id: `settings_${Date.now()}`,
      type: "settings_sync",
      data: {},
      timestamp: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      priority: "low",
    };

    this.addOrUpdateSyncEvent(syncEvent);
    await this.registerBackgroundSync("settings-sync");
  }

  // Feedback synchronization
  async queueFeedbackSync(feedback: {
    order_id: string;
    restaurant_id: string;
    rating: number;
    comment: string;
    anonymous: boolean;
  }): Promise<void> {
    const syncEvent: SyncEvent = {
      id: `feedback_${feedback.order_id}_${Date.now()}`,
      type: "feedback_sync",
      data: feedback,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      priority: "normal",
    };

    this.addOrUpdateSyncEvent(syncEvent);
    await this.registerBackgroundSync("feedback-sync");

    if (this.isOnline) {
      this.processSyncQueue();
    }
  }

  private async syncFeedback(feedback: any): Promise<void> {
    try {
      await apiClient.post("/feedback/batch-sync", {
        feedback: [feedback],
      });

      console.log("[Background Sync] Feedback synced successfully");
    } catch (error) {
      console.error("[Background Sync] Failed to sync feedback:", error);
      throw error;
    }
  }

  // Main sync queue processor
  async processSyncQueue(): Promise<void> {
    if (this.syncInProgress || !this.isOnline) {
      return;
    }

    this.syncInProgress = true;

    try {
      // Sort by priority and timestamp
      const sortedQueue = [...this.syncQueue].sort((a, b) => {
        const priorityOrder = { high: 3, normal: 2, low: 1 };
        const priorityDiff =
          priorityOrder[b.priority] - priorityOrder[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return (
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      });

      for (const event of sortedQueue) {
        if (event.retryCount >= event.maxRetries) {
          console.warn(
            `[Background Sync] Max retries reached for event ${event.id}`,
          );
          this.removeSyncEvent(event.type, event.id);
          continue;
        }

        try {
          await this.processSyncEvent(event);
          this.removeSyncEvent(event.type, event.id);
        } catch (error) {
          console.error(
            `[Background Sync] Failed to process event ${event.id}:`,
            error,
          );

          // Increment retry count and schedule retry
          event.retryCount++;
          this.scheduleSyncRetry(event);
        }
      }
    } finally {
      this.syncInProgress = false;
      this.saveSyncQueue();
    }
  }

  private async processSyncEvent(event: SyncEvent): Promise<void> {
    switch (event.type) {
      case "order_submission":
        await this.syncSingleOrder(event.data);
        break;
      case "favorite_sync":
        await this.syncFavorites();
        break;
      case "settings_sync":
        await this.syncSettings();
        break;
      case "feedback_sync":
        await this.syncFeedback(event.data);
        break;
      default:
        console.warn(
          `[Background Sync] Unknown sync event type: ${event.type}`,
        );
    }
  }

  private async registerBackgroundSync(tag: string): Promise<void> {
    if ("serviceWorker" in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (!registration.sync) {
          return;
        }

        await registration.sync.register(tag);
        console.log(`[Background Sync] Registered background sync: ${tag}`);
      } catch (error) {
        console.error(
          `[Background Sync] Failed to register sync: ${tag}`,
          error,
        );
      }
    }
  }

  private async handleServiceWorkerSync(tag: string): Promise<void> {
    console.log(`[Background Sync] Handling service worker sync: ${tag}`);

    switch (tag) {
      case "order-submission":
        await this.syncOfflineOrders();
        break;
      case "favorite-sync":
        await this.syncFavorites();
        break;
      case "settings-sync":
        await this.syncSettings();
        break;
      case "feedback-sync": {
        // Process all feedback sync events
        const feedbackEvents = this.syncQueue.filter(
          (e) => e.type === "feedback_sync",
        );
        for (const event of feedbackEvents) {
          try {
            await this.syncFeedback(event.data);
            this.removeSyncEvent(event.type, event.id);
          } catch (error) {
            console.error("[Background Sync] Failed to sync feedback:", error);
          }
        }
        break;
      }
    }
  }

  private scheduleSyncRetry(event: SyncEvent): void {
    const delay =
      this.retryDelays[
        Math.min(event.retryCount - 1, this.retryDelays.length - 1)
      ];

    setTimeout(() => {
      if (this.isOnline) {
        this.processSyncQueue();
      }
    }, delay);
  }

  // Utility methods
  private addOrUpdateSyncEvent(event: SyncEvent): void {
    const dedupeKey = this.getSyncEventDedupeKey(event);
    const existingIndex = this.syncQueue.findIndex(
      (e) => this.getSyncEventDedupeKey(e) === dedupeKey,
    );
    if (existingIndex >= 0) {
      this.syncQueue[existingIndex] = event;
    } else {
      this.syncQueue.push(event);
    }
    this.saveSyncQueue();
  }

  private getSyncEventDedupeKey(event: SyncEvent): string {
    if (
      event.data === null ||
      typeof event.data !== "object" ||
      Array.isArray(event.data)
    ) {
      return event.type;
    }

    const data = event.data as Record<string, unknown>;
    const rawId =
      data.id ?? data.order_id ?? data.offline_order_id ?? data.sync_id;
    return rawId === undefined || rawId === null
      ? event.type
      : `${event.type}:${String(rawId)}`;
  }

  private removeSyncEvent(type: string, id?: string): void {
    if (id) {
      this.syncQueue = this.syncQueue.filter((e) => e.id !== id);
    } else {
      this.syncQueue = this.syncQueue.filter((e) => e.type !== type);
    }
    this.saveSyncQueue();
  }

  private getExistingRetryCount(orderId: string): number {
    const existing = this.syncQueue.find(
      (e) => e.type === "order_submission" && e.data.id === orderId,
    );
    return existing ? existing.retryCount : 0;
  }

  private notifyOrderSynced(
    offlineOrderId: string,
    onlineOrderId: string,
  ): void {
    // Create a success notification
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Order Submitted Successfully", {
        body: `Your order has been submitted and assigned ID: ${onlineOrderId}`,
        icon: "/icons/icon-192x192.png",
        tag: `order-synced-${onlineOrderId}`,
      });
    }

    // Dispatch custom event for UI updates
    window.dispatchEvent(
      new CustomEvent("order-synced", {
        detail: { offlineOrderId, onlineOrderId },
      }),
    );
  }

  // Public API
  get pendingSyncCount(): number {
    return this.syncQueue.length;
  }

  get isNetworkOnline(): boolean {
    return this.isOnline;
  }

  async forceSyncAll(): Promise<void> {
    if (!this.isOnline) {
      throw new Error("Cannot force sync while offline");
    }

    await this.processSyncQueue();
  }

  getSyncStatus(): {
    pending: number;
    online: boolean;
    lastSync: string | null;
  } {
    return {
      pending: this.syncQueue.length,
      online: this.isOnline,
      lastSync: localStorage.getItem("last_sync_timestamp"),
    };
  }

  clearSyncQueue(): void {
    this.syncQueue = [];
    this.saveSyncQueue();
  }
}

export const customerBackgroundSync = new CustomerBackgroundSyncService();
export default customerBackgroundSync;
