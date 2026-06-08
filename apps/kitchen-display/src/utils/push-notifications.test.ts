import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/services/authApi";
import { KitchenPushNotificationService } from "./push-notifications";

vi.mock("@/services/authApi", () => ({
  apiClient: {
    post: vi.fn(),
    put: vi.fn(),
  },
}));

const originalServiceWorker = Object.getOwnPropertyDescriptor(
  navigator,
  "serviceWorker",
);

function installPushBrowserMocks(input?: {
  existingSubscription?: unknown;
  permission?: NotificationPermission;
}) {
  const getSubscription = vi.fn(
    async () => input?.existingSubscription ?? null,
  );
  const subscribe = vi.fn(async () => ({
    endpoint: "https://push.example.test/kitchen",
    getKey: vi.fn((key: string) =>
      key === "p256dh"
        ? new Uint8Array([1, 2, 3]).buffer
        : new Uint8Array([4, 5, 6]).buffer,
    ),
  }));

  const showNotification = vi.fn(async () => undefined);

  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      ready: Promise.resolve({
        pushManager: {
          getSubscription,
          subscribe,
        },
        showNotification,
      }),
    },
  });
  vi.stubGlobal("PushManager", function PushManager() {});
  vi.stubGlobal("Notification", {
    permission: input?.permission ?? "granted",
    requestPermission: vi.fn(async () => "granted"),
  });

  return { getSubscription, subscribe, showNotification };
}

describe("KitchenPushNotificationService", () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset();
    localStorage.setItem("restaurant_id", "restaurant-1");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    if (originalServiceWorker) {
      Object.defineProperty(navigator, "serviceWorker", originalServiceWorker);
    }
  });

  it("initializes with an existing push subscription", async () => {
    installPushBrowserMocks({
      existingSubscription: { endpoint: "https://push.example.test/existing" },
    });

    const service = new KitchenPushNotificationService();

    await expect(service.initialize()).resolves.toBe(true);
    expect(service.isSubscribed).toBe(true);
    expect(service.permissionStatus).toBe("granted");
  });

  it("subscribes and registers the kitchen device with restaurant scope", async () => {
    const { subscribe } = installPushBrowserMocks();
    const service = new KitchenPushNotificationService();

    const subscription = await service.subscribe();

    expect(subscription).toEqual({
      endpoint: "https://push.example.test/kitchen",
      keys: {
        p256dh: "AQID",
        auth: "BAUG",
      },
    });
    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: expect.any(Uint8Array),
    });
    expect(apiClient.post).toHaveBeenCalledWith("/push/subscribe", {
      subscription,
      user_type: "kitchen",
      role: "chef",
      restaurant_id: "restaurant-1",
      device_info: expect.objectContaining({
        is_kitchen_device: true,
      }),
    });
  });

  it("returns denied and no subscription when browser push is unsupported", async () => {
    const service = new KitchenPushNotificationService();

    await expect(service.initialize()).resolves.toBe(false);
    await expect(service.requestPermission()).resolves.toBe("denied");
    await expect(service.subscribe()).resolves.toBeNull();
    expect(service.isNotificationSupported).toBe(false);
  });

  it("requests permission when notification permission is still promptable", async () => {
    installPushBrowserMocks({ permission: "default" });
    const service = new KitchenPushNotificationService();

    await expect(service.requestPermission()).resolves.toBe("granted");

    expect(Notification.requestPermission).toHaveBeenCalledTimes(1);
  });

  it("shows local notifications with defaults and optional sound", async () => {
    const { showNotification } = installPushBrowserMocks();
    const service = new KitchenPushNotificationService();
    const playSound = vi
      .spyOn(service, "playNotificationSound")
      .mockResolvedValue(undefined);

    await service.showLocalNotification({
      title: "Kitchen Alert",
      body: "Check the grill",
      tag: "grill",
      urgency: "urgent",
      sound: "urgent-alert",
      data: { type: "kitchen_alert" },
    });

    expect(playSound).toHaveBeenCalledWith("urgent-alert");
    expect(showNotification).toHaveBeenCalledWith(
      "Kitchen Alert",
      expect.objectContaining({
        body: "Check the grill",
        icon: "/icons/kitchen-icon-192.png",
        badge: "/icons/kitchen-badge-72.png",
        tag: "grill",
        data: { type: "kitchen_alert" },
        silent: false,
        requireInteraction: true,
      }),
    );
  });

  it("maps kitchen notification helpers to local notification payloads", async () => {
    installPushBrowserMocks();
    const service = new KitchenPushNotificationService();
    const showLocalNotification = vi
      .spyOn(service, "showLocalNotification")
      .mockResolvedValue(undefined);

    await service.notifyNewOrder("A001", "4", 3, "urgent");
    await service.notifyTimerAlert("A001", "Noodles", "Boil", true);
    await service.notifyOrderModification("A001", "rushed", "VIP customer");
    await service.notifyKitchenAlert("equipment_failure", "Oven offline");
    await service.notifyOrderReady("A001", "4", 12);
    await service.notifyShiftUpdate("break_time", "Take a break");

    expect(showLocalNotification).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        title: "🚨 New Order",
        tag: "new-order-A001",
        urgency: "urgent",
        sound: "urgent-alert",
      }),
    );
    expect(showLocalNotification).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        title: "⏰ Timer Overdue!",
        urgency: "urgent",
      }),
    );
    expect(showLocalNotification).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        title: "🏃‍♂️ Rush Order",
        sound: "urgent-alert",
      }),
    );
    expect(showLocalNotification).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        title: "⚠️ Equipment Alert",
        requireInteraction: true,
      }),
    );
    expect(showLocalNotification).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({ title: "✅ Order Ready" }),
    );
    expect(showLocalNotification).toHaveBeenNthCalledWith(
      6,
      expect.objectContaining({
        title: "☕ Shift Update",
        silent: true,
      }),
    );
  });

  it("saves and reads notification settings with defaults", async () => {
    installPushBrowserMocks();
    const service = new KitchenPushNotificationService();
    const settings = {
      newOrders: false,
      timerAlerts: true,
      orderModifications: true,
      kitchenAlerts: true,
      shiftUpdates: true,
      sound: false,
      vibration: true,
      soundVolume: 0.4,
      priorityAlerts: true,
      autoAcknowledge: false,
      displayDuration: 5000,
    };

    await service.saveNotificationSettings(settings);

    expect(apiClient.put).toHaveBeenCalledWith(
      "/kitchen/notification-settings",
      settings,
    );
    expect(service.getNotificationSettings()).toEqual(settings);

    localStorage.removeItem("kitchen_notification_settings");
    expect(service.getNotificationSettings()).toMatchObject({
      newOrders: true,
      soundVolume: 0.8,
      displayDuration: 10000,
    });
  });

  it("plays notification sounds and handles unknown or failed sound loads", async () => {
    installPushBrowserMocks();
    const start = vi.fn();
    const connect = vi.fn();
    const source = { connect, start, buffer: undefined as unknown };
    const decodeAudioData = vi.fn(async () => ({}));
    vi.stubGlobal(
      "AudioContext",
      vi.fn(function AudioContextMock() {
        return {
          destination: {},
          decodeAudioData,
          createBufferSource: vi.fn(() => source),
        };
      }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      })),
    );
    const service = new KitchenPushNotificationService();

    await service.playNotificationSound("new-order");
    await service.playNotificationSound("not-real");

    expect(fetch).toHaveBeenCalledWith("/sounds/new-order.mp3");
    expect(decodeAudioData).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);

    vi.mocked(fetch).mockRejectedValueOnce(new Error("sound missing"));
    await expect(service.playNotificationSound("new-order")).resolves.toBe(
      undefined,
    );
  });

  it("exposes utility conversions used for push subscription payloads", () => {
    installPushBrowserMocks();
    const service = new KitchenPushNotificationService() as unknown as {
      getVibrationPattern: (urgency: string) => number[];
      urlBase64ToUint8Array: (input: string) => Uint8Array;
      arrayBufferToBase64: (input: ArrayBuffer) => string;
      getRestaurantId: () => string;
      getDeviceInfo: () => Record<string, unknown>;
    };

    expect(service.getVibrationPattern("urgent")).toHaveLength(9);
    expect(service.getVibrationPattern("high")).toHaveLength(7);
    expect(service.getVibrationPattern("normal")).toHaveLength(5);
    expect(service.getVibrationPattern("low")).toHaveLength(3);
    expect(service.getVibrationPattern("unknown")).toEqual([200, 100, 200]);
    expect(Array.from(service.urlBase64ToUint8Array("AQID"))).toEqual([
      1, 2, 3,
    ]);
    expect(service.arrayBufferToBase64(new Uint8Array([4, 5, 6]).buffer)).toBe(
      "BAUG",
    );
    expect(service.getRestaurantId()).toBe("restaurant-1");
    expect(service.getDeviceInfo()).toMatchObject({
      is_kitchen_device: true,
    });
  });

  it("handles settings save failures and test notification wrappers", async () => {
    installPushBrowserMocks();
    const service = new KitchenPushNotificationService();
    const showLocalNotification = vi
      .spyOn(service, "showLocalNotification")
      .mockResolvedValue(undefined);
    vi.mocked(apiClient.put).mockRejectedValueOnce(new Error("settings down"));

    await expect(
      service.saveNotificationSettings({
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
      }),
    ).resolves.toBeUndefined();
    await service.testNotificationSound("new-order");
    await service.testNotification("high");

    expect(showLocalNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Test Notification",
        urgency: "high",
      }),
    );
  });
});
