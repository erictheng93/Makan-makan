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
    action: 'create' | 'update' | 'delete';
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
declare class AdminOfflineStorageManager {
    private dbName;
    private dbVersion;
    private db;
    initialize(): Promise<void>;
    private getStore;
    saveOfflineOrderUpdate(update: OfflineOrderUpdate): Promise<void>;
    getUnsyncedOrderUpdates(): Promise<OfflineOrderUpdate[]>;
    markOrderUpdateAsSynced(updateId: string): Promise<void>;
    cacheAnalyticsData(data: CachedAnalyticsData): Promise<void>;
    getCachedAnalytics(restaurantId: string, period: string): Promise<CachedAnalyticsData | null>;
    saveOfflineMenuUpdate(update: OfflineMenuUpdate): Promise<void>;
    getUnsyncedMenuUpdates(): Promise<OfflineMenuUpdate[]>;
    markMenuUpdateAsSynced(updateId: string): Promise<void>;
    cacheBackupData(backup: CachedBackupData): Promise<void>;
    getCachedBackups(restaurantId: string): Promise<CachedBackupData[]>;
    saveOfflineUserAction(action: OfflineUserAction): Promise<void>;
    getUnsyncedUserActions(): Promise<OfflineUserAction[]>;
    saveSetting(key: string, value: any): Promise<void>;
    getSetting(key: string): Promise<any>;
    saveDashboardLayout(layout: {
        id: string;
        user_id: string;
        restaurant_id: string;
        layout_data: any;
    }): Promise<void>;
    getDashboardLayout(userId: string, restaurantId: string): Promise<any>;
    cleanupExpiredCache(expirationHours?: number): Promise<void>;
    getStorageInfo(): Promise<{
        orderUpdatesCount: number;
        analyticsCount: number;
        menuUpdatesCount: number;
        backupsCount: number;
        userActionsCount: number;
    }>;
    private getCount;
    clearAllCache(): Promise<void>;
}
export declare const adminOfflineStorage: AdminOfflineStorageManager;
export default adminOfflineStorage;
