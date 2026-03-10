/**
 * Push Notifications Service for Kitchen Display
 * Handles push notification registration, management, and kitchen-specific notifications
 */

export interface NotificationSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface KitchenPushNotificationOptions {
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
  urgency?: "low" | "normal" | "high" | "urgent";
  sound?: string;
}

class KitchenPushNotificationService {
  private vapidPublicKey =
    "BNxvNnqyJgFWG6z6Fh5c8hGv-Z8O7s2r9Lm5JnG3p8Z7fK9A2c6H8n1B5dE3gT7qR9mP4yX8nL1oD6vR3zJ2hS9a";
  private subscription: PushSubscription | null = null;
  private isSupported = false;
  private audioContext: AudioContext | null = null;

  constructor() {
    this.checkSupport();
    this.initializeAudioContext();
  }

  private checkSupport(): void {
    this.isSupported = "serviceWorker" in navigator && "PushManager" in window;
  }

  private initializeAudioContext(): void {
    try {
      this.audioContext = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
    } catch (error) {
      console.warn("AudioContext not supported:", error);
    }
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
        console.log("Found existing kitchen push subscription");
        return true;
      }

      return false;
    } catch (error) {
      console.error("Failed to initialize kitchen push notifications:", error);
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
    console.log("Kitchen notification permission:", permission);
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

      console.log("Kitchen push subscription successful:", subscriptionData);
      return subscriptionData;
    } catch (error) {
      console.error(
        "Failed to subscribe to kitchen push notifications:",
        error,
      );
      return null;
    }
  }

  async sendSubscriptionToServer(
    subscription: NotificationSubscription,
  ): Promise<void> {
    try {
      const response = await fetch("/api/v1/push/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.getAuthToken()}`,
        },
        body: JSON.stringify({
          subscription,
          user_type: "kitchen",
          role: "chef",
          restaurant_id: this.getRestaurantId(),
          device_info: this.getDeviceInfo(),
        }),
      });

      if (!response.ok) {
        throw new Error(
          "Failed to register kitchen push subscription on server",
        );
      }

      console.log("Kitchen push subscription registered on server");
    } catch (error) {
      console.error("Failed to send kitchen subscription to server:", error);
      throw error;
    }
  }

  async showLocalNotification(
    options: KitchenPushNotificationOptions,
  ): Promise<void> {
    if (!this.isSupported || Notification.permission !== "granted") {
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;

      // Play sound if specified and enabled
      if (options.sound && !options.silent) {
        await this.playNotificationSound(options.sound);
      }

      const notificationOptions: NotificationOptions = {
        body: options.body,
        icon: options.icon || "/icons/kitchen-icon-192.png",
        badge: options.badge || "/icons/kitchen-badge-72.png",
        ...(options.image && { image: options.image }),
        tag: options.tag || "kitchen-notification",
        data: options.data,
        // vibrate: this.getVibrationPattern(options.urgency || 'normal'),
        silent: options.silent || false,
        requireInteraction:
          options.requireInteraction || options.urgency === "urgent",
        // actions: options.actions || []
      };

      await registration.showNotification(options.title, notificationOptions);
    } catch (error) {
      console.error("Failed to show kitchen local notification:", error);
    }
  }

  // Kitchen-specific notification methods
  async notifyNewOrder(
    orderId: string,
    tableNumber: string,
    itemCount: number,
    priority: "normal" | "high" | "urgent" = "normal",
  ): Promise<void> {
    const urgencyEmoji =
      priority === "urgent" ? "🚨" : priority === "high" ? "⚡" : "🍽️";

    await this.showLocalNotification({
      title: `${urgencyEmoji} New Order`,
      body: `Order #${orderId} - Table ${tableNumber} - ${itemCount} items`,
      tag: `new-order-${orderId}`,
      urgency:
        priority === "urgent"
          ? "urgent"
          : priority === "high"
            ? "high"
            : "normal",
      sound: priority === "urgent" ? "urgent-alert" : "new-order",
      data: {
        type: "new_order",
        order_id: orderId,
        table_number: tableNumber,
        item_count: itemCount,
        priority,
      },
      actions: [
        {
          action: "view_order",
          title: "View Order",
        },
        {
          action: "start_cooking",
          title: "Start Cooking",
        },
        {
          action: "acknowledge",
          title: "Acknowledge",
        },
      ],
      requireInteraction: true,
    });
  }

  async notifyTimerAlert(
    orderId: string,
    itemName: string,
    timerName: string,
    isOverdue: boolean = false,
  ): Promise<void> {
    const title = isOverdue ? "⏰ Timer Overdue!" : "⏰ Timer Alert";
    const bodyPrefix = isOverdue ? "OVERDUE: " : "";

    await this.showLocalNotification({
      title,
      body: `${bodyPrefix}${itemName} - ${timerName} (Order #${orderId})`,
      tag: `timer-${orderId}-${timerName}`,
      urgency: isOverdue ? "urgent" : "high",
      sound: isOverdue ? "urgent-alert" : "timer-end",
      data: {
        type: "timer_alert",
        order_id: orderId,
        item_name: itemName,
        timer_name: timerName,
        is_overdue: isOverdue,
      },
      actions: [
        {
          action: "view_timer",
          title: "View Timer",
        },
        {
          action: "mark_done",
          title: "Mark Done",
        },
        {
          action: "add_time",
          title: "Add Time",
        },
      ],
      requireInteraction: true,
    });
  }

  async notifyOrderModification(
    orderId: string,
    modificationType: "updated" | "cancelled" | "rushed",
    details: string,
  ): Promise<void> {
    const typeEmojis = {
      updated: "📝",
      cancelled: "❌",
      rushed: "🏃‍♂️",
    };

    const typeLabels = {
      updated: "Order Updated",
      cancelled: "Order Cancelled",
      rushed: "Rush Order",
    };

    await this.showLocalNotification({
      title: `${typeEmojis[modificationType]} ${typeLabels[modificationType]}`,
      body: `Order #${orderId}: ${details}`,
      tag: `order-mod-${orderId}`,
      urgency:
        modificationType === "rushed"
          ? "urgent"
          : modificationType === "cancelled"
            ? "high"
            : "normal",
      sound: modificationType === "rushed" ? "urgent-alert" : "order-ready",
      data: {
        type: "order_modification",
        order_id: orderId,
        modification_type: modificationType,
        details,
      },
      actions: [
        {
          action: "view_order",
          title: "View Order",
        },
        {
          action: "acknowledge",
          title: "Acknowledge",
        },
      ],
    });
  }

  async notifyKitchenAlert(
    alertType:
      | "equipment_failure"
      | "temperature_warning"
      | "inventory_low"
      | "staff_needed",
    message: string,
  ): Promise<void> {
    const alertEmojis = {
      equipment_failure: "⚠️",
      temperature_warning: "🌡️",
      inventory_low: "📦",
      staff_needed: "👥",
    };

    const alertTitles = {
      equipment_failure: "Equipment Alert",
      temperature_warning: "Temperature Warning",
      inventory_low: "Low Inventory",
      staff_needed: "Staff Needed",
    };

    await this.showLocalNotification({
      title: `${alertEmojis[alertType]} ${alertTitles[alertType]}`,
      body: message,
      tag: `kitchen-alert-${alertType}`,
      urgency: alertType === "equipment_failure" ? "urgent" : "high",
      sound: alertType === "equipment_failure" ? "urgent-alert" : "order-ready",
      data: {
        type: "kitchen_alert",
        alert_type: alertType,
        message,
      },
      actions: [
        {
          action: "view_details",
          title: "View Details",
        },
        {
          action: "acknowledge",
          title: "Acknowledge",
        },
      ],
      requireInteraction: true,
    });
  }

  async notifyOrderReady(
    orderId: string,
    tableNumber: string,
    waitTime: number,
  ): Promise<void> {
    await this.showLocalNotification({
      title: "✅ Order Ready",
      body: `Order #${orderId} for Table ${tableNumber} is ready! (${waitTime} min wait)`,
      tag: `order-ready-${orderId}`,
      urgency: "normal",
      sound: "order-ready",
      data: {
        type: "order_ready",
        order_id: orderId,
        table_number: tableNumber,
        wait_time: waitTime,
      },
      actions: [
        {
          action: "mark_served",
          title: "Mark Served",
        },
        {
          action: "call_service",
          title: "Call Service",
        },
      ],
    });
  }

  async notifyShiftUpdate(
    updateType: "shift_start" | "shift_end" | "break_time" | "staff_change",
    details: string,
  ): Promise<void> {
    const updateEmojis = {
      shift_start: "🌅",
      shift_end: "🌙",
      break_time: "☕",
      staff_change: "👥",
    };

    await this.showLocalNotification({
      title: `${updateEmojis[updateType]} Shift Update`,
      body: details,
      tag: `shift-${updateType}`,
      urgency: "low",
      sound: "new-order",
      data: {
        type: "shift_update",
        update_type: updateType,
        details,
      },
      silent: true,
    });
  }

  // Audio functionality
  async playNotificationSound(soundType: string): Promise<void> {
    if (!this.audioContext) {
      return;
    }

    try {
      const soundUrls = {
        "new-order": "/sounds/new-order.mp3",
        "urgent-alert": "/sounds/urgent-alert.mp3",
        "timer-end": "/sounds/timer-end.mp3",
        "order-ready": "/sounds/order-ready.mp3",
      };

      const soundUrl = soundUrls[soundType as keyof typeof soundUrls];
      if (!soundUrl) {
        return;
      }

      const response = await fetch(soundUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start();
    } catch (error) {
      console.warn("Failed to play notification sound:", error);
    }
  }

  // Utility methods
  private getVibrationPattern(
    urgency: "low" | "normal" | "high" | "urgent",
  ): number[] {
    switch (urgency) {
      case "urgent":
        return [500, 200, 500, 200, 500, 200, 500, 200, 500];
      case "high":
        return [300, 100, 300, 100, 300, 100, 300];
      case "normal":
        return [200, 100, 200, 100, 200];
      case "low":
        return [100, 50, 100];
      default:
        return [200, 100, 200];
    }
  }

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
      is_kitchen_device: true,
      audio_support: !!this.audioContext,
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
    timerAlerts: boolean;
    orderModifications: boolean;
    kitchenAlerts: boolean;
    shiftUpdates: boolean;
    sound: boolean;
    vibration: boolean;
    soundVolume: number;
    priorityAlerts: boolean;
    autoAcknowledge: boolean;
    displayDuration: number;
  }): Promise<void> {
    try {
      await fetch("/api/v1/kitchen/notification-settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.getAuthToken()}`,
        },
        body: JSON.stringify(settings),
      });

      // Store locally for offline access
      localStorage.setItem(
        "kitchen_notification_settings",
        JSON.stringify(settings),
      );
    } catch (error) {
      console.error("Failed to save kitchen notification settings:", error);
    }
  }

  getNotificationSettings(): any {
    const settings = localStorage.getItem("kitchen_notification_settings");
    return settings
      ? JSON.parse(settings)
      : {
          newOrders: true,
          timerAlerts: true,
          orderModifications: true,
          kitchenAlerts: true,
          shiftUpdates: false,
          sound: true,
          vibration: true,
          soundVolume: 0.8,
          priorityAlerts: true,
          autoAcknowledge: false,
          displayDuration: 10000,
        };
  }

  // Sound test functionality
  async testNotificationSound(soundType: string): Promise<void> {
    await this.playNotificationSound(soundType);
  }

  async testNotification(
    urgency: "low" | "normal" | "high" | "urgent" = "normal",
  ): Promise<void> {
    await this.showLocalNotification({
      title: "Test Notification",
      body: `This is a test notification with ${urgency} urgency level`,
      tag: "test-notification",
      urgency,
      sound: "new-order",
      data: {
        type: "test",
        urgency,
      },
      actions: [
        {
          action: "acknowledge",
          title: "Acknowledge",
        },
      ],
    });
  }
}

export const kitchenPushService = new KitchenPushNotificationService();

// Auto-initialize
kitchenPushService.initialize().catch((error) => {
  console.error(
    "Failed to initialize kitchen push notification service:",
    error,
  );
});

export default kitchenPushService;
