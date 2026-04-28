/**
 * Push Notifications Service for Admin Dashboard
 * Handles push notification registration, management, and admin-specific notifications
 */

import { apiPath } from "@/services/api-url";

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
  priority?: "low" | "normal" | "high" | "critical";
}

class AdminPushNotificationService {
  private vapidPublicKey =
    "BNxvNnqyJgFWG6z6Fh5c8hGv-Z8O7s2r9Lm5JnG3p8Z7fK9A2c6H8n1B5dE3gT7qR9mP4yX8nL1oD6vR3zJ2hS9a";
  private subscription: PushSubscription | null = null;
  private isSupported = false;

  constructor() {
    this.checkSupport();
  }

  private checkSupport(): void {
    this.isSupported = "serviceWorker" in navigator && "PushManager" in window;
  }

  async initialize(): Promise<boolean> {
    if (!this.isSupported) {
      console.warn("Push notifications are not supported in this browser");
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      // Check if already subscribed
      const existingSubscription =
        await registration.pushManager.getSubscription();

      if (existingSubscription) {
        this.subscription = existingSubscription;
        console.log("Found existing admin push subscription");
        return true;
      }

      return false;
    } catch (error) {
      console.error("Failed to initialize admin push notifications:", error);
      return false;
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported) {
      return "denied";
    }

    if (Notification.permission === "granted") {
      return "granted";
    }

    if (Notification.permission === "denied") {
      return "denied";
    }

    const permission = await Notification.requestPermission();
    console.log("Admin notification permission:", permission);
    return permission;
  }

  async subscribe(): Promise<NotificationSubscription | null> {
    if (!this.isSupported || Notification.permission !== "granted") {
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(
          this.vapidPublicKey,
        ) as BufferSource as BufferSource,
      });

      this.subscription = subscription;

      const subscriptionData: NotificationSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: this.arrayBufferToBase64(subscription.getKey("p256dh")!),
          auth: this.arrayBufferToBase64(subscription.getKey("auth")!),
        },
      };

      // Send subscription to server
      await this.sendSubscriptionToServer(subscriptionData);

      console.log("Admin push subscription successful:", subscriptionData);
      return subscriptionData;
    } catch (error) {
      console.error("Failed to subscribe to admin push notifications:", error);
      return null;
    }
  }

  async sendSubscriptionToServer(
    subscription: NotificationSubscription,
  ): Promise<void> {
    try {
      const response = await fetch(apiPath("/push/subscribe"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.getAuthToken()}`,
        },
        body: JSON.stringify({
          subscription,
          user_type: "admin",
          role: this.getUserRole(),
          restaurant_id: this.getRestaurantId(),
          device_info: this.getDeviceInfo(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to register admin push subscription on server");
      }

      console.log("Admin push subscription registered on server");
    } catch (error) {
      console.error("Failed to send admin subscription to server:", error);
      throw error;
    }
  }

  async showLocalNotification(
    options: AdminPushNotificationOptions,
  ): Promise<void> {
    if (!this.isSupported || Notification.permission !== "granted") {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      const notificationOptions: NotificationOptions = {
        body: options.body,
        icon: options.icon || "/icons/admin-icon-192.png",
        badge: options.badge || "/icons/admin-badge-72.png",
        ...(options.image && { image: options.image }),
        tag: options.tag || "admin-notification",
        data: options.data,
        silent: options.silent || false,
        requireInteraction:
          options.requireInteraction || options.priority === "critical",
        // actions not supported in basic NotificationOptions
      };

      await registration.showNotification(options.title, notificationOptions);
    } catch (error) {
      console.error("Failed to show admin local notification:", error);
    }
  }

  // Admin-specific notification methods
  async notifyNewOrder(
    orderId: string,
    customerName: string,
    itemCount: number,
    totalAmount: number,
  ): Promise<void> {
    await this.showLocalNotification({
      title: "New Order Received",
      body: `Order #${orderId} from ${customerName} - ${itemCount} items ($${totalAmount.toFixed(2)})`,
      tag: `new-order-${orderId}`,
      priority: "high",
      data: {
        type: "new_order",
        order_id: orderId,
        customer_name: customerName,
        item_count: itemCount,
        total_amount: totalAmount,
      },
      actions: [
        {
          action: "view_order",
          title: "View Order",
        },
        {
          action: "accept",
          title: "Accept",
        },
        {
          action: "dismiss",
          title: "Later",
        },
      ],
      requireInteraction: true,
    });
  }

  async notifySystemAlert(
    title: string,
    message: string,
    alertType: "info" | "warning" | "error" | "critical",
  ): Promise<void> {
    const priority =
      alertType === "critical"
        ? "critical"
        : alertType === "error"
          ? "high"
          : "normal";

    await this.showLocalNotification({
      title: `System Alert: ${title}`,
      body: message,
      tag: `system-alert-${alertType}`,
      priority,
      data: {
        type: "system_alert",
        alert_type: alertType,
        alert_title: title,
      },
      actions: [
        {
          action: "view_dashboard",
          title: "View Dashboard",
        },
        {
          action: "acknowledge",
          title: "Acknowledge",
        },
      ],
    });
  }

  async notifyBackupStatus(
    backupId: string,
    status: "completed" | "failed" | "started",
    details?: string,
  ): Promise<void> {
    const statusMessages = {
      started: "Backup process has started",
      completed: "Backup completed successfully",
      failed: "Backup failed - immediate attention required",
    };

    const priority =
      status === "failed"
        ? "critical"
        : status === "completed"
          ? "normal"
          : "low";

    await this.showLocalNotification({
      title: `Backup ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      body: details || statusMessages[status],
      tag: `backup-${backupId}`,
      priority,
      data: {
        type: "backup_status",
        backup_id: backupId,
        status,
        details,
      },
      actions:
        status === "failed"
          ? [
              {
                action: "view_backup",
                title: "View Details",
              },
              {
                action: "retry_backup",
                title: "Retry",
              },
            ]
          : [
              {
                action: "view_backup",
                title: "View Backup",
              },
            ],
    });
  }

  async notifyPerformanceAlert(
    metric: string,
    currentValue: number,
    threshold: number,
    trend: "increasing" | "decreasing",
  ): Promise<void> {
    const trendEmoji = trend === "increasing" ? "📈" : "📉";

    await this.showLocalNotification({
      title: `Performance Alert ${trendEmoji}`,
      body: `${metric}: ${currentValue} (threshold: ${threshold})`,
      tag: `performance-${metric}`,
      priority: "high",
      data: {
        type: "performance_alert",
        metric,
        current_value: currentValue,
        threshold,
        trend,
      },
      actions: [
        {
          action: "view_analytics",
          title: "View Analytics",
        },
        {
          action: "dismiss",
          title: "Dismiss",
        },
      ],
    });
  }

  async notifyUserAction(
    userName: string,
    action: string,
    target: string,
  ): Promise<void> {
    await this.showLocalNotification({
      title: "User Activity",
      body: `${userName} ${action} ${target}`,
      tag: "user-activity",
      priority: "low",
      data: {
        type: "user_action",
        user_name: userName,
        action,
        target,
      },
      silent: true,
    });
  }

  async notifyOrderUpdate(
    orderId: string,
    oldStatus: string,
    newStatus: string,
    updatedBy: string,
  ): Promise<void> {
    await this.showLocalNotification({
      title: "Order Status Updated",
      body: `Order #${orderId}: ${oldStatus} → ${newStatus} (by ${updatedBy})`,
      tag: `order-update-${orderId}`,
      priority: "normal",
      data: {
        type: "order_update",
        order_id: orderId,
        old_status: oldStatus,
        new_status: newStatus,
        updated_by: updatedBy,
      },
      actions: [
        {
          action: "view_order",
          title: "View Order",
        },
      ],
    });
  }

  async notifyInventoryAlert(
    itemName: string,
    currentStock: number,
    minThreshold: number,
  ): Promise<void> {
    await this.showLocalNotification({
      title: "Low Inventory Alert",
      body: `${itemName}: ${currentStock} remaining (min: ${minThreshold})`,
      tag: `inventory-${itemName}`,
      priority: "high",
      data: {
        type: "inventory_alert",
        item_name: itemName,
        current_stock: currentStock,
        min_threshold: minThreshold,
      },
      actions: [
        {
          action: "update_inventory",
          title: "Update Stock",
        },
        {
          action: "view_inventory",
          title: "View Inventory",
        },
      ],
      requireInteraction: true,
    });
  }

  async notifyRevenueUpdate(
    period: string,
    revenue: number,
    growth: number,
  ): Promise<void> {
    const growthEmoji = growth > 0 ? "📈" : growth < 0 ? "📉" : "➡️";
    const growthText =
      growth > 0 ? `+${growth.toFixed(1)}%` : `${growth.toFixed(1)}%`;

    await this.showLocalNotification({
      title: `Revenue Update ${growthEmoji}`,
      body: `${period}: $${revenue.toFixed(2)} (${growthText})`,
      tag: `revenue-${period}`,
      priority: "normal",
      data: {
        type: "revenue_update",
        period,
        revenue,
        growth,
      },
      actions: [
        {
          action: "view_analytics",
          title: "View Report",
        },
      ],
    });
  }

  // Utility methods
  // getVibrationPattern method removed - not used due to TypeScript limitations

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private getAuthToken(): string {
    return localStorage.getItem("auth_token") || "";
  }

  private getUserRole(): string {
    return localStorage.getItem("user_role") || "admin";
  }

  private getRestaurantId(): string {
    return localStorage.getItem("restaurant_id") || "";
  }

  private getDeviceInfo(): Record<string, any> {
    return {
      user_agent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screen_resolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      is_admin_device: true,
    };
  }

  // Permission and subscription status
  get permissionStatus(): NotificationPermission {
    return Notification.permission;
  }

  get isSubscribed(): boolean {
    return this.subscription !== null;
  }

  get isNotificationSupported(): boolean {
    return this.isSupported;
  }

  // Settings management
  async saveNotificationSettings(settings: {
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
  }): Promise<void> {
    try {
      await fetch(apiPath("/admin/notification-settings"), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.getAuthToken()}`,
        },
        body: JSON.stringify(settings),
      });

      // Store locally for offline access
      localStorage.setItem(
        "admin_notification_settings",
        JSON.stringify(settings),
      );
    } catch (error) {
      console.error("Failed to save admin notification settings:", error);
    }
  }

  getNotificationSettings(): any {
    const settings = localStorage.getItem("admin_notification_settings");
    return settings
      ? JSON.parse(settings)
      : {
          newOrders: true,
          systemAlerts: true,
          backupStatus: true,
          performanceAlerts: true,
          userActivity: false,
          inventoryAlerts: true,
          revenueUpdates: true,
          sound: true,
          vibration: true,
          quietHours: {
            enabled: false,
            start: "22:00",
            end: "08:00",
          },
        };
  }

  isInQuietHours(): boolean {
    const settings = this.getNotificationSettings();
    if (!settings.quietHours.enabled) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const [startHour, startMin] = settings.quietHours.start
      .split(":")
      .map(Number);
    const [endHour, endMin] = settings.quietHours.end.split(":").map(Number);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime <= endTime) {
      return currentTime >= startTime && currentTime <= endTime;
    } else {
      return currentTime >= startTime || currentTime <= endTime;
    }
  }
}

export const adminPushService = new AdminPushNotificationService();

// Auto-initialize
adminPushService.initialize().catch((error) => {
  console.error("Failed to initialize admin push notification service:", error);
});

export default adminPushService;
