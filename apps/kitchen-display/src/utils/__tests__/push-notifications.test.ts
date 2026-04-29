import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockApiClient } = vi.hoisted(() => ({
  mockApiClient: {
    post: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock("@/services/authApi", () => ({
  apiClient: mockApiClient,
}));

import kitchenPushService, {
  type NotificationSubscription,
} from "../push-notifications";

describe("kitchenPushService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("registers push subscriptions through the shared API client", async () => {
    mockApiClient.post.mockResolvedValueOnce({});
    localStorage.setItem("restaurant_id", "rest-1");
    const subscription: NotificationSubscription = {
      endpoint: "https://push.example.test/kitchen/abc",
      keys: {
        p256dh: "p256dh-key",
        auth: "auth-key",
      },
    };

    await kitchenPushService.sendSubscriptionToServer(subscription);

    expect(mockApiClient.post).toHaveBeenCalledWith("/push/subscribe", {
      subscription,
      user_type: "kitchen",
      role: "chef",
      restaurant_id: "rest-1",
      device_info: expect.objectContaining({
        is_kitchen_device: true,
      }),
    });
  });

  it("saves notification settings through the shared API client", async () => {
    mockApiClient.put.mockResolvedValueOnce({});
    const settings = {
      newOrders: true,
      timerAlerts: true,
      orderModifications: true,
      kitchenAlerts: true,
      shiftUpdates: false,
      sound: true,
      vibration: true,
      soundVolume: 80,
      priorityAlerts: true,
      autoAcknowledge: false,
      displayDuration: 5,
    };

    await kitchenPushService.saveNotificationSettings(settings);

    expect(mockApiClient.put).toHaveBeenCalledWith(
      "/kitchen/notification-settings",
      settings,
    );
    expect(localStorage.getItem("kitchen_notification_settings")).toBe(
      JSON.stringify(settings),
    );
  });
});
