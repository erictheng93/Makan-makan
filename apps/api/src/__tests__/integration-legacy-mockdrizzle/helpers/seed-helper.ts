/**
 * Seed Helper — Factory-to-DB Bridge
 *
 * Converts factory-generated objects (camelCase, number timestamps)
 * and inserts them into the test SQLite DB via SharedDataStore.
 */

import type { TestDB } from "../../helpers/test-utils";
import {
  restaurantFactory,
  userFactory,
  categoryFactory,
  menuItemFactory,
  orderFactory,
  orderItemFactory,
  resetAllFactories,
  buildCompleteRestaurantData,
} from "@makanmasak/testing-utils";

// ─── Types ──────────────────────────────────────────────────────────────────

/** SharedDataStore is not exported from test-utils, so we use its shape via `any` */
export interface SeedContext {
  db: TestDB;
  dataStore: any; // SharedDataStore instance (from db.dataStore)
}

export interface SeededRestaurant {
  id: number;
  publicId: string;
  name: string;
}

export interface SeededUser {
  id: number;
  username: string;
  role: number;
}

export interface SeededCategory {
  id: number;
  name: string;
}

export interface SeededMenuItem {
  id: number;
  name: string;
  price: number;
  categoryId: number;
}

export interface SeededOrder {
  id: number;
  orderNumber: string;
  status: string;
  totalAmount: number;
}

// ─── Normalization ──────────────────────────────────────────────────────────

/**
 * Convert factory output to DB-ready format:
 * - Number timestamps (> 1e12) → ISO strings (SharedDataStore uses TEXT columns)
 * - Strip undefined values
 * - Keep everything else as-is (SharedDataStore.insert handles camelCase→snake_case,
 *   boolean→integer, object→JSON, Date→ISO)
 */
export function normalizeForDB(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    // Convert millisecond timestamps to ISO strings
    if (
      typeof value === "number" &&
      value > 1e12 &&
      (key === "createdAt" ||
        key === "updatedAt" ||
        key.endsWith("At") ||
        key === "lastLoginAt" ||
        key === "lastAccessedAt")
    ) {
      result[key] = new Date(value).toISOString();
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ─── Seed Functions ─────────────────────────────────────────────────────────

export async function seedRestaurant(
  ctx: SeedContext,
  overrides?: Record<string, any>,
): Promise<SeededRestaurant> {
  const data = restaurantFactory.build({ overrides: overrides as never });
  const normalized = normalizeForDB(data);
  // Remove factory-generated `id` so DB auto-increments
  delete normalized.id;
  const result = ctx.dataStore.insert("restaurants", normalized);
  return {
    id: result.id,
    publicId: data.name, // Use name as publicId for simplicity
    name: data.name,
  };
}

export async function seedUser(
  ctx: SeedContext,
  restaurantId: number | string,
  overrides?: Record<string, any>,
): Promise<SeededUser> {
  const data = userFactory.build({
    overrides: { restaurantId, ...overrides } as never,
  });
  const normalized = normalizeForDB(data);
  delete normalized.id;
  const result = ctx.dataStore.insert("users", normalized);
  return {
    id: result.id,
    username: data.username,
    role: data.role,
  };
}

export async function seedAdmin(
  ctx: SeedContext,
  restaurantId: number | string,
  overrides?: Record<string, any>,
): Promise<SeededUser> {
  return seedUser(ctx, restaurantId, { role: 0, ...overrides });
}

export async function seedCategory(
  ctx: SeedContext,
  restaurantId: number,
  overrides?: Record<string, any>,
): Promise<SeededCategory> {
  const data = categoryFactory.build({
    relations: { restaurantId },
    overrides: overrides as never,
  });
  const normalized = normalizeForDB(data);
  delete normalized.id;
  const result = ctx.dataStore.insert("categories", normalized);
  return { id: result.id, name: data.name };
}

export async function seedMenuItem(
  ctx: SeedContext,
  restaurantId: number,
  categoryId: number,
  overrides?: Record<string, any>,
): Promise<SeededMenuItem> {
  const data = menuItemFactory.build({
    relations: { restaurantId, categoryId },
    overrides: overrides as never,
  });
  const normalized = normalizeForDB(data);
  delete normalized.id;
  const result = ctx.dataStore.insert("menu_items", normalized);
  return {
    id: result.id,
    name: data.name,
    price: data.price,
    categoryId,
  };
}

export async function seedTable(
  ctx: SeedContext,
  restaurantId: number,
  overrides?: Record<string, any>,
): Promise<{ id: number; number: number }> {
  const tableNum = overrides?.number ?? Math.floor(Math.random() * 100) + 1;
  const now = new Date().toISOString();
  const qrCode =
    overrides?.qrCode ?? `QR-${restaurantId}-T${tableNum}-${Date.now()}`;
  const data = {
    restaurantId,
    number: tableNum,
    name: `桌 ${tableNum}`,
    capacity: overrides?.capacity ?? 4,
    location: overrides?.location ?? "main",
    qrCode,
    qrCodeVersion: 1,
    isOccupied: false,
    isActive: true,
    isReservable: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  const result = ctx.dataStore.insert("tables", data);
  return { id: result.id, number: tableNum };
}

export async function seedOrder(
  ctx: SeedContext,
  restaurantId: number,
  overrides?: Record<string, any>,
): Promise<SeededOrder> {
  const data = orderFactory.build({
    relations: { restaurantId },
    overrides: overrides as never,
  });
  const normalized = normalizeForDB(data);
  delete normalized.id;
  const result = ctx.dataStore.insert("orders", normalized);
  return {
    id: result.id,
    orderNumber: data.orderNumber,
    status: data.status,
    totalAmount: data.totalAmount,
  };
}

export async function seedOrderItem(
  ctx: SeedContext,
  orderId: number,
  menuItemId: number,
  overrides?: Record<string, any>,
): Promise<{ id: number }> {
  const data = orderItemFactory.build({
    relations: { orderId, menuItemId },
    overrides: overrides as never,
  });
  const normalized = normalizeForDB(data);
  delete normalized.id;
  const result = ctx.dataStore.insert("order_items", normalized);
  return { id: result.id };
}

/**
 * Seed a complete order with items.
 * Creates order + N order_items linked to given menuItemIds.
 */
export async function seedOrderWithItems(
  ctx: SeedContext,
  restaurantId: number,
  menuItemIds: number[],
  orderOverrides?: Record<string, any>,
): Promise<SeededOrder & { itemIds: number[] }> {
  const order = await seedOrder(ctx, restaurantId, orderOverrides);
  const itemIds: number[] = [];
  for (const menuItemId of menuItemIds) {
    const item = await seedOrderItem(ctx, order.id, menuItemId, {
      quantity: 1 + Math.floor(Math.random() * 3),
    });
    itemIds.push(item.id);
  }
  return { ...order, itemIds };
}

/**
 * Seed a full restaurant with team, menu, and orders.
 * Uses buildCompleteRestaurantData() from testing-utils factories.
 */
export async function seedCompleteRestaurant(ctx: SeedContext) {
  resetAllFactories();
  const data = buildCompleteRestaurantData();

  // 1. Restaurant
  const normalizedRestaurant = normalizeForDB(data.restaurant);
  delete normalizedRestaurant.id;
  const restaurant = ctx.dataStore.insert("restaurants", normalizedRestaurant);

  // 2. All staff
  const seededUsers: SeededUser[] = [];
  for (const user of data.team.all) {
    const normalizedUser = normalizeForDB({
      ...user,
      restaurantId: restaurant.id,
    });
    delete normalizedUser.id;
    const result = ctx.dataStore.insert("users", normalizedUser);
    seededUsers.push({
      id: result.id,
      username: user.username,
      role: user.role,
    });
  }

  // 3. Categories
  const seededCategories: SeededCategory[] = [];
  for (const cat of data.categories) {
    const normalized = normalizeForDB({ ...cat, restaurantId: restaurant.id });
    delete normalized.id;
    const result = ctx.dataStore.insert("categories", normalized);
    seededCategories.push({ id: result.id, name: cat.name });
  }

  // 4. Menu items — map factory categoryId to seeded categoryId
  const categoryIdMap = new Map<number, number>();
  data.categories.forEach((cat, idx) => {
    categoryIdMap.set(cat.id!, seededCategories[idx].id);
  });

  const seededMenuItems: SeededMenuItem[] = [];
  for (const item of data.menuItems) {
    const mappedCategoryId =
      categoryIdMap.get(item.categoryId) ?? seededCategories[0].id;
    const normalized = normalizeForDB({
      ...item,
      restaurantId: restaurant.id,
      categoryId: mappedCategoryId,
    });
    delete normalized.id;
    const result = ctx.dataStore.insert("menu_items", normalized);
    seededMenuItems.push({
      id: result.id,
      name: item.name,
      price: item.price,
      categoryId: mappedCategoryId,
    });
  }

  // 5. Customers
  for (const customer of data.customers) {
    const normalized = normalizeForDB(customer);
    delete normalized.id;
    ctx.dataStore.insert("users", normalized);
  }

  return {
    restaurant: { id: restaurant.id, name: data.restaurant.name },
    users: seededUsers,
    categories: seededCategories,
    menuItems: seededMenuItems,
    summary: data.summary,
  };
}

/**
 * Clear all tables in the test database.
 */
export function clearAllTables(ctx: SeedContext) {
  ctx.dataStore.clear();
}
