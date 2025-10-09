/**
 * Background Sync Service for Admin Dashboard
 * Handles offline administrative operations synchronization when network connectivity is restored
 */
import { type OfflineOrderUpdate, type OfflineMenuUpdate, type OfflineUserAction } from './offline-storage';
export interface AdminSyncEvent {
    id: string;
    type: 'order_update' | 'menu_update' | 'user_action' | 'analytics_sync' | 'backup_sync' | 'settings_sync';
    data: any;
    timestamp: string;
    retryCount: number;
    maxRetries: number;
    priority: 'low' | 'normal' | 'high' | 'critical';
    restaurant_id: string;
}
declare class AdminBackgroundSyncService {
    private syncQueue;
    private isOnline;
    private syncInProgress;
    private retryDelays;
    private syncInterval;
    constructor();
    private initializeEventListeners;
    private loadSyncQueue;
    private saveSyncQueue;
    private startPeriodicSync;
    syncOrderUpdates(): Promise<void>;
    private syncSingleOrderUpdate;
    queueOrderUpdateSync(update: OfflineOrderUpdate, reason?: 'new' | 'retry'): Promise<void>;
    syncMenuUpdates(): Promise<void>;
    private syncSingleMenuUpdate;
    queueMenuUpdateSync(update: OfflineMenuUpdate, reason?: 'new' | 'retry'): Promise<void>;
    syncUserActions(): Promise<void>;
    private syncSingleUserAction;
    queueUserActionSync(action: OfflineUserAction): Promise<void>;
    queueAnalyticsSync(restaurantId: string, analyticsData: any): Promise<void>;
    private syncAnalyticsData;
    queueBackupSync(backupData: any): Promise<void>;
    private syncBackupData;
    queueSettingsSync(settings: any): Promise<void>;
    private syncSettings;
    processSyncQueue(): Promise<void>;
    private processSyncEvent;
    private registerBackgroundSync;
    private handleServiceWorkerSync;
    private scheduleSyncRetry;
    private syncCriticalData;
    private addOrUpdateSyncEvent;
    private removeSyncEvent;
    private getExistingRetryCount;
    private getAuthToken;
    private notifyAdminSync;
    private notifyAdminSyncFailure;
    get pendingSyncCount(): number;
    get criticalSyncCount(): number;
    get isNetworkOnline(): boolean;
    forceSyncAll(): Promise<void>;
    getSyncStatus(): {
        pending: number;
        critical: number;
        online: boolean;
        lastSync: string | null;
        inProgress: boolean;
    };
    clearSyncQueue(): void;
    destroy(): void;
}
export declare const adminBackgroundSync: AdminBackgroundSyncService;
export default adminBackgroundSync;
