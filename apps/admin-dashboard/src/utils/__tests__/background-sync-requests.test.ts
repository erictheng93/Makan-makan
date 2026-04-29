import { describe, expect, it } from "vitest";
import {
  buildAnalyticsSyncRequest,
  buildAuditActionSyncRequest,
  buildBackupSyncRequest,
  buildMenuUpdateSyncRequest,
  buildSettingsSyncRequest,
} from "../background-sync-requests";
import type { OfflineMenuUpdate, OfflineUserAction } from "../offline-storage";

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

  it("encodes dynamic menu path segments", () => {
    expect(
      buildMenuUpdateSyncRequest({
        ...baseUpdate,
        action: "delete",
        menu_item_id: "item/with/slash",
      }),
    ).toEqual({
      path: "/menu/items/item%2Fwith%2Fslash",
      method: "DELETE",
    });
  });

  it("rejects menu creates without a restaurant scope", () => {
    expect(() =>
      buildMenuUpdateSyncRequest({ ...baseUpdate, restaurant_id: "" }),
    ).toThrow("restaurant_id is required for menu create sync");
  });
});

describe("buildAuditActionSyncRequest", () => {
  const baseAction: OfflineUserAction = {
    id: "action-1",
    restaurant_id: "restaurant-1",
    action_type: "settings_update",
    target_id: "settings",
    data: { locale: "zh-TW" },
    user_id: "user-1",
    timestamp: "2026-01-01T00:00:00.000Z",
    synced: false,
  };

  it("builds audit action sync payloads", () => {
    expect(buildAuditActionSyncRequest(baseAction)).toEqual({
      path: "/audit/actions",
      body: {
        action_type: "settings_update",
        target_id: "settings",
        data: { locale: "zh-TW" },
        user_id: "user-1",
        restaurant_id: "restaurant-1",
        timestamp: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("omits empty restaurant scopes instead of sending empty strings", () => {
    expect(
      buildAuditActionSyncRequest({ ...baseAction, restaurant_id: "" }).body,
    ).not.toHaveProperty("restaurant_id");
  });
});

describe("buildAnalyticsSyncRequest", () => {
  it("uses scoped analytics sync when restaurant ID is present", () => {
    expect(
      buildAnalyticsSyncRequest({ sync_id: "sync-1" }, "restaurant/1"),
    ).toEqual({
      path: "/analytics/restaurant%2F1/sync",
      body: { sync_id: "sync-1", restaurant_id: "restaurant/1" },
    });
  });

  it("falls back to authenticated batch sync when restaurant ID is missing", () => {
    expect(
      buildAnalyticsSyncRequest({ sync_id: "sync-1", restaurant_id: "" }, ""),
    ).toEqual({
      path: "/analytics/batch-sync",
      body: { sync_id: "sync-1" },
    });
  });
});

describe("buildBackupSyncRequest", () => {
  it("keeps non-empty backup restaurant scopes", () => {
    expect(
      buildBackupSyncRequest({
        backup_id: "backup-1",
        restaurant_id: "restaurant-1",
      }),
    ).toEqual({
      path: "/backup/upload",
      body: { backup_id: "backup-1", restaurant_id: "restaurant-1" },
    });
  });

  it("omits empty backup restaurant scopes", () => {
    expect(
      buildBackupSyncRequest({ backup_id: "backup-1", restaurant_id: "" }),
    ).toEqual({
      path: "/backup/upload",
      body: { backup_id: "backup-1" },
    });
  });
});

describe("buildSettingsSyncRequest", () => {
  it("omits empty settings restaurant scopes", () => {
    expect(
      buildSettingsSyncRequest({
        sync_id: "settings-1",
        restaurant_id: "",
        settings: { locale: "zh-TW" },
      }),
    ).toEqual({
      path: "/admin/settings/sync",
      body: {
        sync_id: "settings-1",
        settings: { locale: "zh-TW" },
      },
    });
  });
});
