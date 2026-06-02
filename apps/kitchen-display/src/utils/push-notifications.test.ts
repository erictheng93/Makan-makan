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

function installPushBrowserMocks(input?: { existingSubscription?: unknown }) {
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

  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      ready: Promise.resolve({
        pushManager: {
          getSubscription,
          subscribe,
        },
      }),
    },
  });
  vi.stubGlobal("PushManager", function PushManager() {});
  vi.stubGlobal("Notification", {
    permission: "granted",
    requestPermission: vi.fn(async () => "granted"),
  });

  return { getSubscription, subscribe };
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
});
