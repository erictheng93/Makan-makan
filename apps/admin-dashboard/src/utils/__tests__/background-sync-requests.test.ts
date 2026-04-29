import { describe, expect, it } from "vitest";
import { buildMenuUpdateSyncRequest } from "../background-sync-requests";
import type { OfflineMenuUpdate } from "../offline-storage";

const baseUpdate: OfflineMenuUpdate = {
  id: "sync-1",
  restaurant_id: "restaurant-1",
  action: "create",
  data: { name: "Nasi Lemak" },
  timestamp: "2026-01-01T00:00:00.000Z",
  synced: false,
};

describe("buildMenuUpdateSyncRequest", () => {
  it("keeps menu creates on the restaurant-scoped collection endpoint", () => {
    expect(buildMenuUpdateSyncRequest(baseUpdate)).toEqual({
      path: "/menu/restaurant-1/items",
      method: "POST",
      body: { name: "Nasi Lemak" },
    });
  });

  it("uses the item endpoint for menu updates", () => {
    expect(
      buildMenuUpdateSyncRequest({
        ...baseUpdate,
        action: "update",
        menu_item_id: "item-1",
        data: { price: 12 },
      }),
    ).toEqual({
      path: "/menu/items/item-1",
      method: "PUT",
      body: { price: 12 },
    });
  });

  it("uses the item endpoint without a body for menu deletes", () => {
    expect(
      buildMenuUpdateSyncRequest({
        ...baseUpdate,
        action: "delete",
        menu_item_id: "item-1",
      }),
    ).toEqual({
      path: "/menu/items/item-1",
      method: "DELETE",
    });
  });
});
