import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockApiClient } = vi.hoisted(() => ({
  mockApiClient: {
    post: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock("@/services/api", () => ({
  apiClient: mockApiClient,
}));

import customerPushService, {
  type NotificationSubscription,
} from "@/utils/push-notifications";

describe("customerPushService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window.localStorage.setItem as ReturnType<typeof vi.fn>).mockClear();
  });

  it("registers push subscriptions through the shared API client", async () => {
    mockApiClient.post.mockResolvedValueOnce({});
    const subscription: NotificationSubscription = {
      endpoint: "https://push.example.test/customer/abc",
      keys: {
        p256dh: "p256dh-key",
        auth: "auth-key",
      },
    };

    await customerPushService.sendSubscriptionToServer(subscription);

    expect(mockApiClient.post).toHaveBeenCalledWith("/push/subscribe", {
      subscription,
      user_type: "customer",
      device_info: expect.objectContaining({
        language: "zh-TW",
      }),
    });
  });

  it("removes push subscriptions through the shared API client", async () => {
    mockApiClient.post.mockResolvedValueOnce({});
    (customerPushService as any).subscription = {
      endpoint: "https://push.example.test/customer/abc",
    };

    await customerPushService.removeSubscriptionFromServer();

    expect(mockApiClient.post).toHaveBeenCalledWith("/push/unsubscribe", {
      endpoint: "https://push.example.test/customer/abc",
    });
  });

  it("saves notification settings through the shared API client", async () => {
    mockApiClient.put.mockResolvedValueOnce({});
    const settings = {
      orderUpdates: true,
      promotions: false,
      tableAlerts: true,
      messages: true,
      sound: true,
      vibration: false,
    };

    await customerPushService.saveNotificationSettings(settings);

    expect(mockApiClient.put).toHaveBeenCalledWith(
      "/users/notification-settings",
      settings,
    );
    expect(window.localStorage.setItem).toHaveBeenCalledWith(
      "notification_settings",
      JSON.stringify(settings),
    );
  });
});
