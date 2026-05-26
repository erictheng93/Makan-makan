import type {
  Category,
  MenuItem,
  RestaurantServiceItem,
} from "@makanmakan/shared-types";

export const SHOP_MENU_ITEM_QUERY_KEY = "itemId";
export const SHOP_MENU_CATEGORY_QUERY_KEY = "categoryName";
export const SHOP_MENU_SERVICE_QUERY_KEY = "serviceItemId";
export const SHOP_MENU_RETURN_PATH_QUERY_KEY = "returnPath";
export const SHOP_MENU_RETURN_LABEL_QUERY_KEY = "returnLabel";

export function shopMenuItemQuery(dish: {
  menuItemId: number;
  categoryName?: string | null;
}) {
  return {
    [SHOP_MENU_ITEM_QUERY_KEY]: String(dish.menuItemId),
    ...(dish.categoryName
      ? { [SHOP_MENU_CATEGORY_QUERY_KEY]: dish.categoryName }
      : {}),
  };
}

export function shopMenuServiceQuery(service: { serviceItemId: number }) {
  return {
    [SHOP_MENU_SERVICE_QUERY_KEY]: String(service.serviceItemId),
  };
}

export function shopMenuReturnQuery(source: { path: string; label: string }) {
  return {
    [SHOP_MENU_RETURN_PATH_QUERY_KEY]: source.path,
    [SHOP_MENU_RETURN_LABEL_QUERY_KEY]: source.label,
  };
}

export function menuItemElementId(itemId: number | string) {
  return `menu-item-${itemId}`;
}

export function menuCategoryElementId(categoryId: number | string) {
  return `category-${categoryId}`;
}

export function serviceItemElementId(serviceItemId: number | string) {
  return `service-item-${serviceItemId}`;
}

function queryValue(value: unknown) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function queryString(value: unknown) {
  const rawValue = queryValue(value);
  return typeof rawValue === "string" ? rawValue.trim() : "";
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

export function findMenuCategoryByQuery(
  categories: Category[],
  value: unknown,
): Category | null {
  const categoryName = queryString(value);
  if (!categoryName) return null;

  const normalizedName = categoryName.toLocaleLowerCase();
  return (
    categories.find(
      (category) => category.name.trim().toLocaleLowerCase() === normalizedName,
    ) ?? null
  );
}

export function findServiceItemByQuery(
  serviceItems: RestaurantServiceItem[],
  value: unknown,
): RestaurantServiceItem | null {
  const rawValue = queryValue(value);
  if (typeof rawValue !== "string" && typeof rawValue !== "number") {
    return null;
  }

  const serviceItemId = Number(rawValue);
  if (!Number.isInteger(serviceItemId) || serviceItemId <= 0) return null;

  return serviceItems.find((service) => service.id === serviceItemId) ?? null;
}
