/**
 * Background Sync Service for Admin Dashboard
 * Handles offline administrative operations synchronization when network connectivity is restored
 */
import { adminOfflineStorage } from './offline-storage';
class AdminBackgroundSyncService {
    constructor() {
        Object.defineProperty(this, "syncQueue", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: []
        });
        Object.defineProperty(this, "isOnline", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: navigator.onLine
        });
        Object.defineProperty(this, "syncInProgress", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: false
        });
        Object.defineProperty(this, "retryDelays", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: [2000, 10000, 30000, 60000, 300000]
        }); // Progressive delays in ms
        Object.defineProperty(this, "syncInterval", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        this.initializeEventListeners();
        this.loadSyncQueue();
        this.startPeriodicSync();
    }
    initializeEventListeners() {
        // Network status listeners
        window.addEventListener('online', () => {
            console.log('[Admin Background Sync] Network came online');
            this.isOnline = true;
            this.processSyncQueue();
        });
        window.addEventListener('offline', () => {
            console.log('[Admin Background Sync] Network went offline');
            this.isOnline = false;
        });
        // Service Worker message listener
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', (event) => {
                if (event.data.type === 'admin-background-sync') {
                    this.handleServiceWorkerSync(event.data.tag);
                }
            });
        }
        // Before unload - try to sync critical data
        window.addEventListener('beforeunload', () => {
            this.syncCriticalData();
        });
    }
    async loadSyncQueue() {
        try {
            const saved = localStorage.getItem('admin_sync_queue');
            if (saved) {
                this.syncQueue = JSON.parse(saved);
            }
        }
        catch (error) {
            console.error('[Admin Background Sync] Failed to load sync queue:', error);
            this.syncQueue = [];
        }
    }
    saveSyncQueue() {
        try {
            localStorage.setItem('admin_sync_queue', JSON.stringify(this.syncQueue));
        }
        catch (error) {
            console.error('[Admin Background Sync] Failed to save sync queue:', error);
        }
    }
    startPeriodicSync() {
        // Sync every 5 minutes when online
        this.syncInterval = window.setInterval(() => {
            if (this.isOnline && this.syncQueue.length > 0) {
                this.processSyncQueue();
            }
        }, 5 * 60 * 1000);
    }
    // Order update synchronization
    async syncOrderUpdates() {
        try {
            const orderUpdates = await adminOfflineStorage.getUnsyncedOrderUpdates();
            for (const update of orderUpdates) {
                await this.syncSingleOrderUpdate(update);
            }
        }
        catch (error) {
            console.error('[Admin Background Sync] Failed to sync order updates:', error);
        }
    }
    async syncSingleOrderUpdate(update) {
        try {
            console.log(`[Admin Background Sync] Syncing order update ${update.id}`);
            const response = await fetch(`/api/v1/orders/${update.order_id}/status`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                },
                body: JSON.stringify({
                    status: update.status,
                    notes: update.notes,
                    updated_by: update.updated_by,
                    timestamp: update.timestamp
                })
            });
            if (response.ok) {
                console.log(`[Admin Background Sync] Order update ${update.id} synced successfully`);
                await adminOfflineStorage.markOrderUpdateAsSynced(update.id);
                this.notifyAdminSync('order_update', update.order_id);
            }
            else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }
        catch (error) {
            console.error(`[Admin Background Sync] Failed to sync order update ${update.id}:`, error);
            this.queueOrderUpdateSync(update, 'retry');
        }
    }
    async queueOrderUpdateSync(update, reason = 'new') {
        const syncEvent = {
            id: `order_update_${update.id}_${Date.now()}`,
            type: 'order_update',
            data: update,
            timestamp: new Date().toISOString(),
            retryCount: reason === 'retry' ? (this.getExistingRetryCount('order_update', update.id) + 1) : 0,
            maxRetries: 5,
            priority: 'high',
            restaurant_id: update.restaurant_id
        };
        this.addOrUpdateSyncEvent(syncEvent);
        await this.registerBackgroundSync('admin-order-update');
        if (this.isOnline) {
            this.processSyncQueue();
        }
    }
    // Menu update synchronization
    async syncMenuUpdates() {
        try {
            const menuUpdates = await adminOfflineStorage.getUnsyncedMenuUpdates();
            for (const update of menuUpdates) {
                await this.syncSingleMenuUpdate(update);
            }
        }
        catch (error) {
            console.error('[Admin Background Sync] Failed to sync menu updates:', error);
        }
    }
    async syncSingleMenuUpdate(update) {
        try {
            console.log(`[Admin Background Sync] Syncing menu update ${update.id}`);
            let endpoint = `/api/v1/menu/${update.restaurant_id}/items`;
            let method = 'POST';
            if (update.action === 'update' && update.menu_item_id) {
                endpoint = `/api/v1/menu/${update.restaurant_id}/items/${update.menu_item_id}`;
                method = 'PUT';
            }
            else if (update.action === 'delete' && update.menu_item_id) {
                endpoint = `/api/v1/menu/${update.restaurant_id}/items/${update.menu_item_id}`;
                method = 'DELETE';
            }
            const response = await fetch(endpoint, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                },
                body: update.action !== 'delete' ? JSON.stringify(update.data) : undefined
            });
            if (response.ok) {
                console.log(`[Admin Background Sync] Menu update ${update.id} synced successfully`);
                await adminOfflineStorage.markMenuUpdateAsSynced(update.id);
                this.notifyAdminSync('menu_update', update.menu_item_id || 'new');
            }
            else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }
        catch (error) {
            console.error(`[Admin Background Sync] Failed to sync menu update ${update.id}:`, error);
            this.queueMenuUpdateSync(update, 'retry');
        }
    }
    async queueMenuUpdateSync(update, reason = 'new') {
        const syncEvent = {
            id: `menu_update_${update.id}_${Date.now()}`,
            type: 'menu_update',
            data: update,
            timestamp: new Date().toISOString(),
            retryCount: reason === 'retry' ? (this.getExistingRetryCount('menu_update', update.id) + 1) : 0,
            maxRetries: 3,
            priority: 'normal',
            restaurant_id: update.restaurant_id
        };
        this.addOrUpdateSyncEvent(syncEvent);
        await this.registerBackgroundSync('admin-menu-update');
        if (this.isOnline) {
            this.processSyncQueue();
        }
    }
    // User action synchronization
    async syncUserActions() {
        try {
            const userActions = await adminOfflineStorage.getUnsyncedUserActions();
            for (const action of userActions) {
                await this.syncSingleUserAction(action);
            }
        }
        catch (error) {
            console.error('[Admin Background Sync] Failed to sync user actions:', error);
        }
    }
    async syncSingleUserAction(action) {
        try {
            const response = await fetch('/api/v1/audit/actions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                },
                body: JSON.stringify({
                    action_type: action.action_type,
                    target_id: action.target_id,
                    data: action.data,
                    user_id: action.user_id,
                    restaurant_id: action.restaurant_id,
                    timestamp: action.timestamp
                })
            });
            if (response.ok) {
                console.log(`[Admin Background Sync] User action ${action.id} synced successfully`);
                // Mark as synced in offline storage
            }
            else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }
        catch (error) {
            console.error(`[Admin Background Sync] Failed to sync user action ${action.id}:`, error);
            throw error;
        }
    }
    async queueUserActionSync(action) {
        const syncEvent = {
            id: `user_action_${action.id}_${Date.now()}`,
            type: 'user_action',
            data: action,
            timestamp: new Date().toISOString(),
            retryCount: 0,
            maxRetries: 3,
            priority: 'low',
            restaurant_id: action.restaurant_id
        };
        this.addOrUpdateSyncEvent(syncEvent);
        await this.registerBackgroundSync('admin-user-action');
    }
    // Analytics data synchronization
    async queueAnalyticsSync(restaurantId, analyticsData) {
        const syncEvent = {
            id: `analytics_${restaurantId}_${Date.now()}`,
            type: 'analytics_sync',
            data: analyticsData,
            timestamp: new Date().toISOString(),
            retryCount: 0,
            maxRetries: 2,
            priority: 'low',
            restaurant_id: restaurantId
        };
        this.addOrUpdateSyncEvent(syncEvent);
        await this.registerBackgroundSync('admin-analytics-sync');
    }
    async syncAnalyticsData(data, restaurantId) {
        try {
            const response = await fetch(`/api/v1/analytics/${restaurantId}/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                },
                body: JSON.stringify(data)
            });
            if (response.ok) {
                console.log('[Admin Background Sync] Analytics data synced successfully');
            }
            else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }
        catch (error) {
            console.error('[Admin Background Sync] Failed to sync analytics data:', error);
            throw error;
        }
    }
    // Backup synchronization
    async queueBackupSync(backupData) {
        const syncEvent = {
            id: `backup_${Date.now()}`,
            type: 'backup_sync',
            data: backupData,
            timestamp: new Date().toISOString(),
            retryCount: 0,
            maxRetries: 3,
            priority: 'critical',
            restaurant_id: backupData.restaurant_id
        };
        this.addOrUpdateSyncEvent(syncEvent);
        await this.registerBackgroundSync('admin-backup-sync');
        if (this.isOnline) {
            this.processSyncQueue();
        }
    }
    async syncBackupData(data) {
        try {
            const response = await fetch('/api/v1/backup/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                },
                body: JSON.stringify(data)
            });
            if (response.ok) {
                console.log('[Admin Background Sync] Backup data synced successfully');
                this.notifyAdminSync('backup_sync', data.backup_id);
            }
            else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }
        catch (error) {
            console.error('[Admin Background Sync] Failed to sync backup data:', error);
            throw error;
        }
    }
    // Settings synchronization
    async queueSettingsSync(settings) {
        const syncEvent = {
            id: `settings_${Date.now()}`,
            type: 'settings_sync',
            data: settings,
            timestamp: new Date().toISOString(),
            retryCount: 0,
            maxRetries: 2,
            priority: 'low',
            restaurant_id: settings.restaurant_id || ''
        };
        this.addOrUpdateSyncEvent(syncEvent);
        await this.registerBackgroundSync('admin-settings-sync');
    }
    async syncSettings(settings) {
        try {
            const response = await fetch('/api/v1/admin/settings/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.getAuthToken()}`
                },
                body: JSON.stringify(settings)
            });
            if (response.ok) {
                console.log('[Admin Background Sync] Settings synced successfully');
            }
            else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        }
        catch (error) {
            console.error('[Admin Background Sync] Failed to sync settings:', error);
            throw error;
        }
    }
    // Main sync queue processor
    async processSyncQueue() {
        if (this.syncInProgress || !this.isOnline) {
            return;
        }
        this.syncInProgress = true;
        try {
            // Sort by priority and timestamp
            const sortedQueue = [...this.syncQueue].sort((a, b) => {
                const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 };
                const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
                if (priorityDiff !== 0)
                    return priorityDiff;
                return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
            });
            for (const event of sortedQueue) {
                if (event.retryCount >= event.maxRetries) {
                    console.warn(`[Admin Background Sync] Max retries reached for event ${event.id}`);
                    this.removeSyncEvent(event.id);
                    this.notifyAdminSyncFailure(event);
                    continue;
                }
                try {
                    await this.processSyncEvent(event);
                    this.removeSyncEvent(event.id);
                    localStorage.setItem('admin_last_sync_timestamp', new Date().toISOString());
                }
                catch (error) {
                    console.error(`[Admin Background Sync] Failed to process event ${event.id}:`, error);
                    // Increment retry count and schedule retry
                    event.retryCount++;
                    this.scheduleSyncRetry(event);
                }
            }
        }
        finally {
            this.syncInProgress = false;
            this.saveSyncQueue();
        }
    }
    async processSyncEvent(event) {
        switch (event.type) {
            case 'order_update':
                await this.syncSingleOrderUpdate(event.data);
                break;
            case 'menu_update':
                await this.syncSingleMenuUpdate(event.data);
                break;
            case 'user_action':
                await this.syncSingleUserAction(event.data);
                break;
            case 'analytics_sync':
                await this.syncAnalyticsData(event.data, event.restaurant_id);
                break;
            case 'backup_sync':
                await this.syncBackupData(event.data);
                break;
            case 'settings_sync':
                await this.syncSettings(event.data);
                break;
            default:
                console.warn(`[Admin Background Sync] Unknown sync event type: ${event.type}`);
        }
    }
    async registerBackgroundSync(tag) {
        if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
            try {
                const registration = await navigator.serviceWorker.ready;
                await registration.sync.register(tag);
                console.log(`[Admin Background Sync] Registered background sync: ${tag}`);
            }
            catch (error) {
                console.error(`[Admin Background Sync] Failed to register sync: ${tag}`, error);
            }
        }
    }
    async handleServiceWorkerSync(tag) {
        console.log(`[Admin Background Sync] Handling service worker sync: ${tag}`);
        switch (tag) {
            case 'admin-order-update':
                await this.syncOrderUpdates();
                break;
            case 'admin-menu-update':
                await this.syncMenuUpdates();
                break;
            case 'admin-user-action':
                await this.syncUserActions();
                break;
            case 'admin-analytics-sync':
            case 'admin-backup-sync':
            case 'admin-settings-sync':
                await this.processSyncQueue();
                break;
        }
    }
    scheduleSyncRetry(event) {
        const delay = this.retryDelays[Math.min(event.retryCount - 1, this.retryDelays.length - 1)];
        setTimeout(() => {
            if (this.isOnline) {
                this.processSyncQueue();
            }
        }, delay);
    }
    async syncCriticalData() {
        // Sync only critical priority items before page unload
        const criticalEvents = this.syncQueue.filter(e => e.priority === 'critical');
        for (const event of criticalEvents) {
            try {
                await this.processSyncEvent(event);
                this.removeSyncEvent(event.id);
            }
            catch (error) {
                console.error('[Admin Background Sync] Failed to sync critical data:', error);
            }
        }
    }
    // Utility methods
    addOrUpdateSyncEvent(event) {
        // Remove any existing event with the same type and data ID
        this.syncQueue = this.syncQueue.filter(e => !(e.type === event.type && e.data.id === event.data.id));
        this.syncQueue.push(event);
        this.saveSyncQueue();
    }
    removeSyncEvent(eventId) {
        this.syncQueue = this.syncQueue.filter(e => e.id !== eventId);
        this.saveSyncQueue();
    }
    getExistingRetryCount(type, dataId) {
        const existing = this.syncQueue.find(e => e.type === type && e.data.id === dataId);
        return existing ? existing.retryCount : 0;
    }
    getAuthToken() {
        return localStorage.getItem('auth_token') || '';
    }
    notifyAdminSync(type, targetId) {
        // Dispatch custom event for UI updates
        window.dispatchEvent(new CustomEvent('admin-sync-success', {
            detail: { type, targetId, timestamp: new Date().toISOString() }
        }));
    }
    notifyAdminSyncFailure(event) {
        // Dispatch custom event for UI updates
        window.dispatchEvent(new CustomEvent('admin-sync-failure', {
            detail: { event, timestamp: new Date().toISOString() }
        }));
        // Show admin notification if available
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Admin Sync Failed', {
                body: `Failed to sync ${event.type} after ${event.maxRetries} attempts`,
                icon: '/icons/admin-icon-192.png',
                tag: `admin-sync-failure-${event.type}`
            });
        }
    }
    // Public API
    get pendingSyncCount() {
        return this.syncQueue.length;
    }
    get criticalSyncCount() {
        return this.syncQueue.filter(e => e.priority === 'critical').length;
    }
    get isNetworkOnline() {
        return this.isOnline;
    }
    async forceSyncAll() {
        if (!this.isOnline) {
            throw new Error('Cannot force sync while offline');
        }
        await this.processSyncQueue();
    }
    getSyncStatus() {
        return {
            pending: this.syncQueue.length,
            critical: this.criticalSyncCount,
            online: this.isOnline,
            lastSync: localStorage.getItem('admin_last_sync_timestamp'),
            inProgress: this.syncInProgress
        };
    }
    clearSyncQueue() {
        this.syncQueue = [];
        this.saveSyncQueue();
    }
    destroy() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
    }
}
export const adminBackgroundSync = new AdminBackgroundSyncService();
export default adminBackgroundSync;
