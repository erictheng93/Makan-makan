/**
 * Push Notifications Service for Admin Dashboard
 * Handles push notification registration, management, and admin-specific notifications
 */
export interface NotificationSubscription {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}
export interface AdminPushNotificationOptions {
    title: string;
    body: string;
    icon?: string;
    badge?: string;
    image?: string;
    tag?: string;
    data?: any;
    actions?: Array<{
        action: string;
        title: string;
        icon?: string;
    }>;
    vibrate?: number[];
    silent?: boolean;
    requireInteraction?: boolean;
    priority?: 'low' | 'normal' | 'high' | 'critical';
}
declare class AdminPushNotificationService {
    private vapidPublicKey;
    private subscription;
    private isSupported;
    constructor();
    private checkSupport;
    initialize(): Promise<boolean>;
    requestPermission(): Promise<NotificationPermission>;
    subscribe(): Promise<NotificationSubscription | null>;
    sendSubscriptionToServer(subscription: NotificationSubscription): Promise<void>;
    showLocalNotification(options: AdminPushNotificationOptions): Promise<void>;
    notifyNewOrder(orderId: string, customerName: string, itemCount: number, totalAmount: number): Promise<void>;
    notifySystemAlert(title: string, message: string, alertType: 'info' | 'warning' | 'error' | 'critical'): Promise<void>;
    notifyBackupStatus(backupId: string, status: 'completed' | 'failed' | 'started', details?: string): Promise<void>;
    notifyPerformanceAlert(metric: string, currentValue: number, threshold: number, trend: 'increasing' | 'decreasing'): Promise<void>;
    notifyUserAction(userName: string, action: string, target: string): Promise<void>;
    notifyOrderUpdate(orderId: string, oldStatus: string, newStatus: string, updatedBy: string): Promise<void>;
    notifyInventoryAlert(itemName: string, currentStock: number, minThreshold: number): Promise<void>;
    notifyRevenueUpdate(period: string, revenue: number, growth: number): Promise<void>;
    private urlBase64ToUint8Array;
    private arrayBufferToBase64;
    private getAuthToken;
    private getUserRole;
    private getRestaurantId;
    private getDeviceInfo;
    get permissionStatus(): NotificationPermission;
    get isSubscribed(): boolean;
    get isNotificationSupported(): boolean;
    saveNotificationSettings(settings: {
        newOrders: boolean;
        systemAlerts: boolean;
        backupStatus: boolean;
        performanceAlerts: boolean;
        userActivity: boolean;
        inventoryAlerts: boolean;
        revenueUpdates: boolean;
        sound: boolean;
        vibration: boolean;
        quietHours: {
            enabled: boolean;
            start: string;
            end: string;
        };
    }): Promise<void>;
    getNotificationSettings(): any;
    isInQuietHours(): boolean;
}
export declare const adminPushService: AdminPushNotificationService;
export default adminPushService;
