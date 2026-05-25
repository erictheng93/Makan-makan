/**
 * Push Notifications Service for Customer App
 * Handles push notification registration, management, and customer-specific notifications
 */

import { customerIdentityApi } from "@/services/customerIdentityApi";
import { CUSTOMER_CONSENT_VERSIONS } from "@makanmakan/shared-types";

export interface NotificationSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushNotificationOptions {
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
}

class CustomerPushNotificationService {
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
        console.log("Found existing push subscription");
        return true;
      }

      return false;
    } catch (error) {
      console.error("Failed to initialize push notifications:", error);
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
    console.log("Notification permission:", permission);
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
        ) as BufferSource,
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

      console.log("Push subscription successful:", subscriptionData);
      return subscriptionData;
    } catch (error) {
      console.error("Failed to subscribe to push notifications:", error);
      return null;
    }
  }

  async unsubscribe(): Promise<boolean> {
    if (!this.subscription) {
      return true;
    }

    try {
      const unsubscribed = await this.subscription.unsubscribe();

      if (unsubscribed) {
        // Notify server about unsubscription
        await this.removeSubscriptionFromServer();
        this.subscription = null;
        console.log("Successfully unsubscribed from push notifications");
      }

      return unsubscribed;
    } catch (error) {
      console.error("Failed to unsubscribe from push notifications:", error);
      return false;
    }
  }

  async sendSubscriptionToServer(
    subscription: NotificationSubscription,
  ): Promise<void> {
    try {
      await customerIdentityApi.addPushSubscription({
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent: navigator.userAgent,
        deviceLabel: this.getDeviceInfo().platform,
      });

      console.log("Push subscription registered on server");
    } catch (error) {
      console.error("Failed to send subscription to server:", error);
      throw error;
    }
  }

  async removeSubscriptionFromServer(): Promise<void> {
    try {
      const endpoint = this.subscription?.endpoint;
      if (!endpoint) return;
      const subscriptions = await customerIdentityApi.listPushSubscriptions();
      const match = subscriptions.find((item) => item.endpoint === endpoint);
      if (match) await customerIdentityApi.removePushSubscription(match.id);

      console.log("Push subscription removed from server");
    } catch (error) {
      console.error("Failed to remove subscription from server:", error);
    }
  }

  async showLocalNotification(options: PushNotificationOptions): Promise<void> {
    if (!this.isSupported || Notification.permission !== "granted") {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      const notificationOptions: NotificationOptions = {
        body: options.body,
        icon: options.icon || "/icons/icon-192x192.png",
        badge: options.badge || "/icons/badge-72x72.png",
        ...(options.image && { image: options.image }),
        tag: options.tag || "customer-notification",
        data: options.data,
        // vibrate: options.vibrate || [200, 100, 200],
        silent: options.silent || false,
        requireInteraction: options.requireInteraction || false,
        // actions: options.actions || []
      };

      await registration.showNotification(options.title, notificationOptions);
    } catch (error) {
      console.error("Failed to show local notification:", error);
    }
  }

  // Customer-specific notification methods
  async notifyOrderStatusUpdate(
    orderId: string,
    status: string,
    estimatedTime?: number,
  ): Promise<void> {
    const statusMessages = {
      confirmed: "Your order has been confirmed and is being prepared",
      preparing: "Your order is now being prepared in the kitchen",
      ready: "Your order is ready for pickup!",
      delivered: "Your order has been delivered. Enjoy!",
      paid: "Your order has been completed. Thank you!",
      cancelled: "Your order has been cancelled",
      refunded: "Your order has been refunded",
    };

    const message =
      statusMessages[status as keyof typeof statusMessages] ||
      `Order status updated to ${status}`;

    await this.showLocalNotification({
      title: `Order #${orderId}`,
      body: estimatedTime
        ? `${message}. Estimated time: ${estimatedTime} minutes`
        : message,
      tag: `order-${orderId}`,
      data: {
        type: "order_status",
        order_id: orderId,
        status,
        estimated_time: estimatedTime,
      },
      actions: [
        {
          action: "view_order",
          title: "View Order",
        },
        {
          action: "dismiss",
          title: "Dismiss",
        },
      ],
      requireInteraction: true,
    });
  }

  async notifyPromotionalOffer(
    title: string,
    message: string,
    restaurantId: string,
  ): Promise<void> {
    await this.showLocalNotification({
      title,
      body: message,
      tag: `promo-${restaurantId}`,
      data: {
        type: "promotional",
        restaurant_id: restaurantId,
      },
      actions: [
        {
          action: "view_menu",
          title: "View Menu",
        },
        {
          action: "dismiss",
          title: "Not Now",
        },
      ],
    });
  }

  async notifyTableReady(
    restaurantName: string,
    tableNumber: string,
  ): Promise<void> {
    await this.showLocalNotification({
      title: "Table Ready!",
      body: `Your table ${tableNumber} at ${restaurantName} is ready`,
      tag: `table-${tableNumber}`,
      data: {
        type: "table_ready",
        table_number: tableNumber,
        restaurant_name: restaurantName,
      },
      // vibrate: [300, 100, 300, 100, 300],
      requireInteraction: true,
      actions: [
        {
          action: "acknowledge",
          title: "On My Way",
        },
      ],
    });
  }

  async notifyNewMessage(from: string, message: string): Promise<void> {
    await this.showLocalNotification({
      title: `Message from ${from}`,
      body: message,
      tag: "customer-message",
      data: {
        type: "message",
        from,
      },
      actions: [
        {
          action: "reply",
          title: "Reply",
        },
        {
          action: "view",
          title: "View",
        },
      ],
    });
  }

  // Utility methods
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

  private getDeviceInfo(): Record<string, any> {
    return {
      user_agent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screen_resolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
    orderUpdates: boolean;
    promotions: boolean;
    tableAlerts: boolean;
    messages: boolean;
    sound: boolean;
    vibration: boolean;
  }): Promise<void> {
    try {
      await customerIdentityApi.updatePreferences({
        waitingListOptIn: settings.tableAlerts || settings.orderUpdates,
        marketingOptIn: settings.promotions,
        promoFromFavoritesOptIn: settings.promotions,
      });
      await customerIdentityApi.grantConsent({
        consentType: "marketing",
        version: CUSTOMER_CONSENT_VERSIONS.marketing,
        granted: settings.promotions,
        source: "settings",
      });

      // Store locally for offline access
      localStorage.setItem("notification_settings", JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save notification settings:", error);
    }
  }

  getNotificationSettings(): any {
    const settings = localStorage.getItem("notification_settings");
    return settings
      ? JSON.parse(settings)
      : {
          orderUpdates: true,
          promotions: true,
          tableAlerts: true,
          messages: true,
          sound: true,
          vibration: true,
        };
  }
}

export const customerPushService = new CustomerPushNotificationService();

// Auto-initialize
customerPushService.initialize().catch((error) => {
  console.error(
    "Failed to initialize customer push notification service:",
    error,
  );
});

export default customerPushService;
