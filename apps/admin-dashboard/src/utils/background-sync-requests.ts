import type { OfflineMenuUpdate } from "./offline-storage";

type MenuSyncMethod = "POST" | "PUT" | "DELETE";

export interface MenuSyncRequest {
  path: string;
  method: MenuSyncMethod;
  body?: Record<string, any>;
}

export function buildMenuUpdateSyncRequest(
  update: OfflineMenuUpdate,
): MenuSyncRequest {
  if (update.action === "update" && update.menu_item_id) {
    return {
      path: `/menu/items/${update.menu_item_id}`,
      method: "PUT",
      body: update.data,
    };
  }

  if (update.action === "delete" && update.menu_item_id) {
    return {
      path: `/menu/items/${update.menu_item_id}`,
      method: "DELETE",
    };
  }

  return {
    path: `/menu/${update.restaurant_id}/items`,
    method: "POST",
    body: update.data,
  };
}
