import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OfflineOrder } from "../offline-storage";

const { mockApiClient, mockOfflineStorage } = vi.hoisted(() => ({
  mockApiClient: {
    post: vi.fn(),
  },
  mockOfflineStorage: {
    getUnsyncedOrders: vi.fn(),
    markOrderAsSynced: vi.fn(),
  },
}));

vi.mock("@/services/api", () => ({
  apiClient: mockApiClient,
}));

vi.mock("../offline-storage", () => ({
  offlineStorage: mockOfflineStorage,
}));

import customerBackgroundSync from "../background-sync";

const offlineOrder: OfflineOrder = {
  id: "offline-1",
  restaurant_id: "rest-1",
  table_id: "table-1",
  items: [
    {
      menu_item_id: "menu-1",
      quantity: 2,
      customizations: { spicy: true },
      special_instructions: "Less salt",
    },
  ],
  customer_info: {
    name: "Lin",
    phone: "+886912345678",
    email: "lin@example.test",
  },
  total_amount: 1200,
  created_at: "2026-04-29T09:00:00.000Z",
  synced: false,
};

describe("customerBackgroundSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiClient.post.mockResolvedValue({ id: "order-1" });
    mockOfflineStorage.markOrderAsSynced.mockResolvedValue(undefined);
  });

  it("submits offline orders using the orders API contract", async () => {
    await (customerBackgroundSync as any).syncSingleOrder(offlineOrder);

    expect(mockApiClient.post).toHaveBeenCalledWith("/orders", {
      restaurantId: "rest-1",
      tableId: "table-1",
      customerName: "Lin",
      customerPhone: "+886912345678",
      customerEmail: "lin@example.test",
      customerInfo: offlineOrder.customer_info,
      items: [
        {
          menuItemId: "menu-1",
          quantity: 2,
          customizations: { spicy: true },
          notes: "Less salt",
        },
      ],
      notes: "Offline order offline-1",
    });
    expect(mockOfflineStorage.markOrderAsSynced).toHaveBeenCalledWith(
      "offline-1",
    );
  });
});
