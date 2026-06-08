import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/services/authApi";
import { offlineService } from "./offlineService";

vi.mock("@/services/authApi", () => ({
  apiClient: {
    put: vi.fn(),
    post: vi.fn(),
  },
}));

describe("offlineService kitchen action replay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    offlineService.clearOfflineData();
    offlineService.isOnline.value = false;
  });

  it("replays queued kitchen item actions through the real update endpoint", async () => {
    vi.mocked(apiClient.put).mockResolvedValue({
      data: { success: true },
    } as never);

    offlineService.queueAction(
      "start_cooking",
      1001,
      { restaurantId: "restaurant-1", status: "preparing" },
      501,
    );

    offlineService.isOnline.value = true;
    await offlineService.syncPendingActions();

    expect(apiClient.put).toHaveBeenCalledWith(
      "/kitchen/restaurant-1/orders/1001/items/501",
      { status: "preparing" },
      { validateStatus: expect.any(Function) },
    );
    expect(offlineService.pendingActions.value).toHaveLength(0);
  });

  it("keeps queued actions when replay fails", async () => {
    vi.mocked(apiClient.put).mockResolvedValue({
      data: { success: false, error: "server unavailable" },
    } as never);

    offlineService.queueAction(
      "mark_ready",
      1001,
      { restaurantId: "restaurant-1", status: "ready" },
      501,
    );

    offlineService.isOnline.value = true;
    await offlineService.syncPendingActions();

    expect(apiClient.put).toHaveBeenCalledWith(
      "/kitchen/restaurant-1/orders/1001/items/501",
      { status: "ready" },
      { validateStatus: expect.any(Function) },
    );
    expect(offlineService.pendingActions.value).toHaveLength(1);
    expect(offlineService.pendingActions.value[0]).toMatchObject({
      type: "mark_ready",
      orderId: 1001,
      itemId: 501,
      retryCount: 1,
      error: "server unavailable",
    });
  });
});
