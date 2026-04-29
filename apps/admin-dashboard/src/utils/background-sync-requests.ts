import type { OfflineMenuUpdate, OfflineUserAction } from "./offline-storage";

type MenuSyncMethod = "POST" | "PUT" | "DELETE";
type PostSyncRequest = {
  path: string;
  body: Record<string, any>;
};

export interface MenuSyncRequest {
  path: string;
  method: MenuSyncMethod;
  body?: Record<string, any>;
}

function normalizeRestaurantId(
  restaurantId: string | number | null | undefined,
): string | undefined {
  const normalized = String(restaurantId ?? "").trim();
  return normalized.length > 0 ? normalized : undefined;
}

function scopedPayload<T extends Record<string, any>>(
  payload: T,
  restaurantId?: string | number | null,
): T {
  const normalizedRestaurantId = normalizeRestaurantId(restaurantId);
  const nextPayload = { ...payload };

  if (normalizedRestaurantId) {
    nextPayload.restaurant_id = normalizedRestaurantId;
  } else {
    delete nextPayload.restaurant_id;
  }

  return nextPayload;
}

export function buildMenuUpdateSyncRequest(
  update: OfflineMenuUpdate,
): MenuSyncRequest {
  const restaurantId = normalizeRestaurantId(update.restaurant_id);

  if (update.action === "update" && update.menu_item_id) {
    return {
      path: `/menu/items/${encodeURIComponent(update.menu_item_id)}`,
      method: "PUT",
      body: update.data,
    };
  }

  if (update.action === "delete" && update.menu_item_id) {
    return {
      path: `/menu/items/${encodeURIComponent(update.menu_item_id)}`,
      method: "DELETE",
    };
  }

  if (!restaurantId) {
    throw new Error("restaurant_id is required for menu create sync");
  }

  return {
    path: `/menu/${encodeURIComponent(restaurantId)}/items`,
    method: "POST",
    body: update.data,
  };
}

export function buildAuditActionSyncRequest(
  action: OfflineUserAction,
): PostSyncRequest {
  return {
    path: "/audit/actions",
    body: scopedPayload(
      {
        action_type: action.action_type,
        target_id: action.target_id,
        data: action.data,
        user_id: action.user_id,
        timestamp: action.timestamp,
      },
      action.restaurant_id,
    ),
  };
}

export function buildAnalyticsSyncRequest(
  data: Record<string, any>,
  restaurantId: string | number | null | undefined,
): PostSyncRequest {
  const normalizedRestaurantId = normalizeRestaurantId(restaurantId);

  if (!normalizedRestaurantId) {
    return {
      path: "/analytics/batch-sync",
      body: scopedPayload(data),
    };
  }

  return {
    path: `/analytics/${encodeURIComponent(normalizedRestaurantId)}/sync`,
    body: scopedPayload(data, normalizedRestaurantId),
  };
}

export function buildBackupSyncRequest(
  data: Record<string, any>,
): PostSyncRequest {
  return {
    path: "/backup/upload",
    body: scopedPayload(data, data.restaurant_id),
  };
}

export function buildSettingsSyncRequest(
  settings: Record<string, any>,
): PostSyncRequest {
  return {
    path: "/admin/settings/sync",
    body: scopedPayload(settings, settings.restaurant_id),
  };
}
