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

import adminPushService, {
  type NotificationSubscription,
} from "@/utils/push-notifications";

const subscription: NotificationSubscription = {
  endpoint: "https://push.example.test/admin/abc",
  keys: {
    p256dh: "p256dh-key",
    auth: "auth-key",
  },
};

describe("adminPushService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it("uses the authenticated owner restaurant when registering", async () => {
    mockApiClient.post.mockResolvedValueOnce({});
    localStorage.setItem(
      "auth_user",
      JSON.stringify({ role: 1, restaurantId: "rest-1" }),
    );

    await adminPushService.sendSubscriptionToServer(subscription);

    expect(mockApiClient.post).toHaveBeenCalledWith("/push/subscribe", {
      subscription,
      user_type: "admin",
      role: "1",
      restaurant_id: "rest-1",
      device_info: expect.objectContaining({
        is_admin_device: true,
      }),
    });
  });

  it("prefers the selected admin restaurant over the user restaurant", async () => {
    mockApiClient.post.mockResolvedValueOnce({});
    localStorage.setItem(
      "auth_user",
      JSON.stringify({ role: 0, restaurantId: "rest-original" }),
    );
    sessionStorage.setItem("admin_selected_restaurant_id", "rest-selected");

    await adminPushService.sendSubscriptionToServer(subscription);

    expect(mockApiClient.post).toHaveBeenCalledWith(
      "/push/subscribe",
      expect.objectContaining({
        restaurant_id: "rest-selected",
      }),
    );
  });

  it("omits restaurant_id instead of sending an empty string", async () => {
    mockApiClient.post.mockResolvedValueOnce({});
    localStorage.setItem("auth_user", JSON.stringify({ role: 0 }));

    await adminPushService.sendSubscriptionToServer(subscription);

    expect(mockApiClient.post).toHaveBeenCalledWith(
      "/push/subscribe",
      expect.not.objectContaining({
        restaurant_id: "",
      }),
    );
  });
});
