/**
 * Background Sync Service for Admin Dashboard
 * Handles offline administrative operations synchronization when network connectivity is restored
 */

import {
  adminOfflineStorage,
  type OfflineOrderUpdate,
  type OfflineMenuUpdate,
  type OfflineUserAction,
} from "./offline-storage";
import { apiClient } from "@/services/api";
import {
  buildAnalyticsSyncRequest,
  buildAuditActionSyncRequest,
  buildBackupSyncRequest,
  buildMenuUpdateSyncRequest,
  buildSettingsSyncRequest,
  type MenuSyncRequest,
} from "./background-sync-requests";

export interface AdminSyncEvent {
  id: string;
  type:
    | "order_update"
    | "menu_update"
    | "user_action"
    | "analytics_sync"
    | "backup_sync"
    | "settings_sync";
  data: unknown;
  timestamp: string;
  retryCount: number;
  maxRetries: number;
  priority: "low" | "normal" | "high" | "critical";
  restaurant_id: string;
}

class AdminBackgroundSyncService {
  private syncQueue: AdminSyncEvent[] = [];
  private isOnline = navigator.onLine;
  private syncInProgress = false;
  private retryDelays = [2000, 10000, 30000, 60000, 300000]; // Progressive delays in ms
  private syncInterval: number | null = null;

  constructor() {
    this.initializeEventListeners();
    this.loadSyncQueue();
    this.startPeriodicSync();
  }

  private initializeEventListeners(): void {
    // Network status listeners
    window.addEventListener("online", () => {
      console.log("[Admin Background Sync] Network came online");
      this.isOnline = true;
      this.processSyncQueue();
    });

    window.addEventListener("offline", () => {
      console.log("[Admin Background Sync] Network went offline");
      this.isOnline = false;
    });

    // Service Worker message listener
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data.type === "admin-background-sync") {
          this.handleServiceWorkerSync(event.data.tag);
        }
      });
    }

    // Before unload - try to sync critical data
    window.addEventListener("beforeunload", () => {
      this.syncCriticalData();
    });
  }

  private async loadSyncQueue(): Promise<void> {
    try {
      const saved = localStorage.getItem("admin_sync_queue");
      if (saved) {
        this.syncQueue = JSON.parse(saved);
      }
    } catch (error) {
      console.error(
        "[Admin Background Sync] Failed to load sync queue:",
        error,
      );
      this.syncQueue = [];
    }
  }

  private saveSyncQueue(): void {
    try {
      localStorage.setItem("admin_sync_queue", JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error(
        "[Admin Background Sync] Failed to save sync queue:",
        error,
      );
    }
  }

  private startPeriodicSync(): void {
    // Sync every 5 minutes when online
    this.syncInterval = window.setInterval(
      () => {
        if (this.isOnline && this.syncQueue.length > 0) {
          this.processSyncQueue();
        }
      },
      5 * 60 * 1000,
    );
  }

  // Order update synchronization
  async syncOrderUpdates(): Promise<void> {
    try {
      const orderUpdates = await adminOfflineStorage.getUnsyncedOrderUpdates();

      for (const update of orderUpdates) {
        await this.syncSingleOrderUpdate(update);
      }
    } catch (error) {
      console.error(
        "[Admin Background Sync] Failed to sync order updates:",
        error,
      );
    }
  }

  private async syncSingleOrderUpdate(
    update: OfflineOrderUpdate,
  ): Promise<void> {
    try {
      console.log(`[Admin Background Sync] Syncing order update ${update.id}`);

      await apiClient.put(`/orders/${update.order_id}/status`, {
        status: update.status,
        notes: update.notes,
        updated_by: update.updated_by,
        timestamp: update.timestamp,
      });

      console.log(
        `[Admin Background Sync] Order update ${update.id} synced successfully`,
      );
      await adminOfflineStorage.markOrderUpdateAsSynced(update.id);
      this.notifyAdminSync("order_update", update.order_id);
    } catch (error) {
      console.error(
        `[Admin Background Sync] Failed to sync order update ${update.id}:`,
        error,
      );
      this.queueOrderUpdateSync(update, "retry");
    }
  }

  async queueOrderUpdateSync(
    update: OfflineOrderUpdate,
    reason: "new" | "retry" = "new",
  ): Promise<void> {
    const syncEvent: AdminSyncEvent = {
      id: `order_update_${update.id}_${Date.now()}`,
      type: "order_update",
      data: update,
      timestamp: new Date().toISOString(),
      retryCount:
        reason === "retry"
          ? this.getExistingRetryCount("order_update", update.id) + 1
          : 0,
      maxRetries: 5,
      priority: "high",
      restaurant_id: update.restaurant_id,
    };

    this.addOrUpdateSyncEvent(syncEvent);
    await this.registerBackgroundSync("admin-order-update");

    if (this.isOnline) {
      this.processSyncQueue();
    }
  }

  // Menu update synchronization
  async syncMenuUpdates(): Promise<void> {
    try {
      const menuUpdates = await adminOfflineStorage.getUnsyncedMenuUpdates();

      for (const update of menuUpdates) {
        await this.syncSingleMenuUpdate(update);
      }
    } catch (error) {
      console.error(
        "[Admin Background Sync] Failed to sync menu updates:",
        error,
      );
    }
  }

  private async syncSingleMenuUpdate(update: OfflineMenuUpdate): Promise<void> {
    try {
      console.log(`[Admin Background Sync] Syncing menu update ${update.id}`);

      const request = buildMenuUpdateSyncRequest(update);
      await this.sendMenuSyncRequest(request);

      console.log(
        `[Admin Background Sync] Menu update ${update.id} synced successfully`,
      );
      await adminOfflineStorage.markMenuUpdateAsSynced(update.id);
      this.notifyAdminSync("menu_update", update.menu_item_id || "new");
    } catch (error) {
      console.error(
        `[Admin Background Sync] Failed to sync menu update ${update.id}:`,
        error,
      );
      this.queueMenuUpdateSync(update, "retry");
    }
  }

  async queueMenuUpdateSync(
    update: OfflineMenuUpdate,
    reason: "new" | "retry" = "new",
  ): Promise<void> {
    const syncEvent: AdminSyncEvent = {
      id: `menu_update_${update.id}_${Date.now()}`,
      type: "menu_update",
      data: update,
      timestamp: new Date().toISOString(),
      retryCount:
        reason === "retry"
          ? this.getExistingRetryCount("menu_update", update.id) + 1
          : 0,
      maxRetries: 3,
      priority: "normal",
      restaurant_id: update.restaurant_id,
    };

    this.addOrUpdateSyncEvent(syncEvent);
    await this.registerBackgroundSync("admin-menu-update");

    if (this.isOnline) {
      this.processSyncQueue();
    }
  }

  // User action synchronization
  async syncUserActions(): Promise<void> {
    try {
      const userActions = await adminOfflineStorage.getUnsyncedUserActions();

      for (const action of userActions) {
        await this.syncSingleUserAction(action);
      }
    } catch (error) {
      console.error(
        "[Admin Background Sync] Failed to sync user actions:",
        error,
      );
    }
  }

  private async syncSingleUserAction(action: OfflineUserAction): Promise<void> {
    try {
      const request = buildAuditActionSyncRequest(action);
      await apiClient.post(request.path, request.body);

      console.log(
        `[Admin Background Sync] User action ${action.id} synced successfully`,
      );
      await adminOfflineStorage.markUserActionAsSynced(action.id);
    } catch (error) {
      console.error(
        `[Admin Background Sync] Failed to sync user action ${action.id}:`,
        error,
      );
      throw error;
    }
  }

  async queueUserActionSync(action: OfflineUserAction): Promise<void> {
    const syncEvent: AdminSyncEvent = {
      id: `user_action_${action.id}_${Date.now()}`,
      type: "user_action",
      data: action,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      priority: "low",
      restaurant_id: action.restaurant_id,
    };

    this.addOrUpdateSyncEvent(syncEvent);
    await this.registerBackgroundSync("admin-user-action");
  }

  // Analytics data synchronization
  async queueAnalyticsSync(
    restaurantId: string,
    analyticsData: unknown,
  ): Promise<void> {
    const syncEvent: AdminSyncEvent = {
      id: `analytics_${restaurantId}_${Date.now()}`,
      type: "analytics_sync",
      data: analyticsData,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 2,
      priority: "low",
      restaurant_id: restaurantId,
    };

    this.addOrUpdateSyncEvent(syncEvent);
    await this.registerBackgroundSync("admin-analytics-sync");
  }

  private async syncAnalyticsData(
    data: unknown,
    restaurantId: string,
  ): Promise<void> {
    try {
      const request = buildAnalyticsSyncRequest(data, restaurantId);
      await apiClient.post(request.path, request.body);
      console.log("[Admin Background Sync] Analytics data synced successfully");
    } catch (error) {
      console.error(
        "[Admin Background Sync] Failed to sync analytics data:",
        error,
      );
      throw error;
    }
  }

  // Backup synchronization
  async queueBackupSync(backupData: unknown): Promise<void> {
    const syncEvent: AdminSyncEvent = {
      id: `backup_${Date.now()}`,
      type: "backup_sync",
      data: backupData,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 3,
      priority: "critical",
      restaurant_id: backupData.restaurant_id,
    };

    this.addOrUpdateSyncEvent(syncEvent);
    await this.registerBackgroundSync("admin-backup-sync");

    if (this.isOnline) {
      this.processSyncQueue();
    }
  }

  private async syncBackupData(data: unknown): Promise<void> {
    try {
      const request = buildBackupSyncRequest(data);
      await apiClient.post(request.path, request.body);
      console.log("[Admin Background Sync] Backup data synced successfully");
      this.notifyAdminSync("backup_sync", data.backup_id);
    } catch (error) {
      console.error(
        "[Admin Background Sync] Failed to sync backup data:",
        error,
      );
      throw error;
    }
  }

  // Settings synchronization
  async queueSettingsSync(settings: unknown): Promise<void> {
    const syncEvent: AdminSyncEvent = {
      id: `settings_${Date.now()}`,
      type: "settings_sync",
      data: settings,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      maxRetries: 2,
      priority: "low",
      restaurant_id: settings.restaurant_id || "",
    };

    this.addOrUpdateSyncEvent(syncEvent);
    await this.registerBackgroundSync("admin-settings-sync");
  }

  private async syncSettings(settings: unknown): Promise<void> {
    try {
      const request = buildSettingsSyncRequest(settings);
      await apiClient.post(request.path, request.body);
      console.log("[Admin Background Sync] Settings synced successfully");
    } catch (error) {
      console.error("[Admin Background Sync] Failed to sync settings:", error);
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
        const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 };
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
            `[Admin Background Sync] Max retries reached for event ${event.id}`,
          );
          this.removeSyncEvent(event.id);
          this.notifyAdminSyncFailure(event);
          continue;
        }

        try {
          await this.processSyncEvent(event);
          this.removeSyncEvent(event.id);
          localStorage.setItem(
            "admin_last_sync_timestamp",
            new Date().toISOString(),
          );
        } catch (error) {
          console.error(
            `[Admin Background Sync] Failed to process event ${event.id}:`,
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

  private async processSyncEvent(event: AdminSyncEvent): Promise<void> {
    switch (event.type) {
      case "order_update":
        await this.syncSingleOrderUpdate(event.data);
        break;
      case "menu_update":
        await this.syncSingleMenuUpdate(event.data);
        break;
      case "user_action":
        await this.syncSingleUserAction(event.data);
        break;
      case "analytics_sync":
        await this.syncAnalyticsData(event.data, event.restaurant_id);
        break;
      case "backup_sync":
        await this.syncBackupData(event.data);
        break;
      case "settings_sync":
        await this.syncSettings(event.data);
        break;
      default:
        console.warn(
          `[Admin Background Sync] Unknown sync event type: ${event.type}`,
        );
    }
  }

  private async registerBackgroundSync(tag: string): Promise<void> {
    const supportsBackgroundSync =
      "serviceWorker" in navigator &&
      "ServiceWorkerRegistration" in window &&
      "sync" in ServiceWorkerRegistration.prototype;

    if (supportsBackgroundSync) {
      try {
        const registration = (await navigator.serviceWorker
          .ready) as ServiceWorkerRegistration & {
          sync?: { register: (syncTag: string) => Promise<void> };
        };
        await registration.sync?.register(tag);
        console.log(
          `[Admin Background Sync] Registered background sync: ${tag}`,
        );
      } catch (error) {
        console.error(
          `[Admin Background Sync] Failed to register sync: ${tag}`,
          error,
        );
      }
    }
  }

  private async handleServiceWorkerSync(tag: string): Promise<void> {
    console.log(`[Admin Background Sync] Handling service worker sync: ${tag}`);

    switch (tag) {
      case "admin-order-update":
        await this.syncOrderUpdates();
        break;
      case "admin-menu-update":
        await this.syncMenuUpdates();
        break;
      case "admin-user-action":
        await this.syncUserActions();
        break;
      case "admin-analytics-sync":
      case "admin-backup-sync":
      case "admin-settings-sync":
        await this.processSyncQueue();
        break;
    }
  }

  private scheduleSyncRetry(event: AdminSyncEvent): void {
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

  private async syncCriticalData(): Promise<void> {
    // Sync only critical priority items before page unload
    const criticalEvents = this.syncQueue.filter(
      (e) => e.priority === "critical",
    );

    for (const event of criticalEvents) {
      try {
        await this.processSyncEvent(event);
        this.removeSyncEvent(event.id);
      } catch (error) {
        console.error(
          "[Admin Background Sync] Failed to sync critical data:",
          error,
        );
      }
    }
  }

  // Utility methods
  private addOrUpdateSyncEvent(event: AdminSyncEvent): void {
    const eventDataId = this.getSyncEventDataId(event);

    // Remove any existing event with the same stable data ID. Events without
    // one are all kept, otherwise offline backup/settings payloads can be lost.
    this.syncQueue = this.syncQueue.filter(
      (e) =>
        !(
          e.type === event.type &&
          eventDataId !== null &&
          this.getSyncEventDataId(e) === eventDataId
        ),
    );

    this.syncQueue.push(event);
    this.saveSyncQueue();
  }

  private getSyncEventDataId(event: AdminSyncEvent): string | null {
    if (
      event.data === null ||
      typeof event.data !== "object" ||
      Array.isArray(event.data)
    ) {
      return null;
    }

    const data = event.data as Record<string, unknown>;
    const rawId =
      data.id ?? data.backup_id ?? data.sync_id ?? data.restaurant_id;
    return rawId === undefined || rawId === null ? null : String(rawId);
  }

  private removeSyncEvent(eventId: string): void {
    this.syncQueue = this.syncQueue.filter((e) => e.id !== eventId);
    this.saveSyncQueue();
  }

  private getExistingRetryCount(type: string, dataId: string): number {
    const existing = this.syncQueue.find(
      (e) => e.type === type && e.data.id === dataId,
    );
    return existing ? existing.retryCount : 0;
  }

  private async sendMenuSyncRequest(request: MenuSyncRequest): Promise<void> {
    switch (request.method) {
      case "POST":
        await apiClient.post(request.path, request.body);
        break;
      case "PUT":
        await apiClient.put(request.path, request.body);
        break;
      case "DELETE":
        await apiClient.delete(request.path);
        break;
    }
  }

  private notifyAdminSync(type: string, targetId: string): void {
    // Dispatch custom event for UI updates
    window.dispatchEvent(
      new CustomEvent("admin-sync-success", {
        detail: { type, targetId, timestamp: new Date().toISOString() },
      }),
    );
  }

  private notifyAdminSyncFailure(event: AdminSyncEvent): void {
    // Dispatch custom event for UI updates
    window.dispatchEvent(
      new CustomEvent("admin-sync-failure", {
        detail: { event, timestamp: new Date().toISOString() },
      }),
    );

    // Show admin notification if available
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Admin Sync Failed", {
        body: `Failed to sync ${event.type} after ${event.maxRetries} attempts`,
        icon: "/icons/admin-icon-192.png",
        tag: `admin-sync-failure-${event.type}`,
      });
    }
  }

  // Public API
  get pendingSyncCount(): number {
    return this.syncQueue.length;
  }

  get criticalSyncCount(): number {
    return this.syncQueue.filter((e) => e.priority === "critical").length;
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
    critical: number;
    online: boolean;
    lastSync: string | null;
    inProgress: boolean;
  } {
    return {
      pending: this.syncQueue.length,
      critical: this.criticalSyncCount,
      online: this.isOnline,
      lastSync: localStorage.getItem("admin_last_sync_timestamp"),
      inProgress: this.syncInProgress,
    };
  }

  clearSyncQueue(): void {
    this.syncQueue = [];
    this.saveSyncQueue();
  }

  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}

export const adminBackgroundSync = new AdminBackgroundSyncService();
export default adminBackgroundSync;
