import type { MenuItem } from "@makanmakan/shared-types";

export const SHOP_MENU_ITEM_QUERY_KEY = "itemId";

export function shopMenuItemQuery(dish: { menuItemId: number }) {
  return { [SHOP_MENU_ITEM_QUERY_KEY]: String(dish.menuItemId) };
}

export function menuItemElementId(itemId: number | string) {
  return `menu-item-${itemId}`;
}

function queryValue(value: unknown) {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function findMenuItemByQuery(
  menuItems: MenuItem[],
  value: unknown,
): MenuItem | null {
  const rawValue = queryValue(value);
  if (typeof rawValue !== "string" && typeof rawValue !== "number") {
    return null;
  }

  const itemId = Number(rawValue);
  if (!Number.isInteger(itemId) || itemId <= 0) return null;

  return menuItems.find((item) => item.id === itemId) ?? null;
}
