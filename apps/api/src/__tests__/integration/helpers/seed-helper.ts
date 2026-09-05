import type { TestDatabase } from "@makanmasak/database/testing";
import {
  restaurants,
  menuItems,
  orders,
  categories,
  users,
  coupons,
} from "@makanmasak/database";
import { eq } from "drizzle-orm";

type SeedRecord = Record<string, unknown>;

export interface SeedHelpers {
  restaurant(overrides?: SeedRecord): Promise<{ id: string }>;
  menuItem(
    restaurantId: string | number,
    overrides?: SeedRecord,
  ): Promise<{ id: number }>;
  order(
    restaurantId: string | number,
    overrides?: SeedRecord,
  ): Promise<{ id: string }>;
  user(overrides?: SeedRecord): Promise<{ id: string; username: string }>;
  coupon(
    restaurantId: string | number,
    overrides?: SeedRecord,
  ): Promise<{ id: number; code: string }>;
}

function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function daysFrom(base: Date, daysOffset: number): Date {
  return new Date(base.getTime() + daysOffset * 24 * 60 * 60 * 1000);
}

function maybeDate(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  return undefined;
}

function normalizeSeedUserId(value: unknown): string | undefined {
  if (typeof value === "number") {
    return `01900000-0000-7000-8000-${String(value).padStart(12, "0")}`;
  }
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

function isTransientD1Error(err: unknown): boolean {
  const error = err as { message?: string; cause?: { code?: string } };
  return (
    error.message?.includes("fetch failed") === true ||
    error.cause?.code === "ECONNRESET"
  );
}

export function buildSeedHelpers(testDb: TestDatabase): SeedHelpers {
  return {
    restaurant: async (overrides = {}) => {
      const suffix = uniqueSuffix();
      const now = new Date();
      const [row] = await testDb.drizzle
        .insert(restaurants)
        .values({
          name: `Test Restaurant ${suffix}`,
          type: "cafe",
          category: "food",
          description: "Real integration restaurant",
          address: "1 Integration Street",
          district: "Central",
          city: "Taipei",
          phone: "0200000000",
          email: `restaurant-${suffix}@example.com`,
          businessHours: {},
          settings: {
            allowOnlineOrdering: true,
            allowGuestOrders: true,
            currency: "TWD",
          },
          isAvailable: true,
          isActive: true,
          createdAt: now,
          updatedAt: now,
          ...overrides,
        } as never)
        .returning();
      return { id: row.id };
    },

    menuItem: async (restaurantId, overrides = {}) => {
      const now = new Date();
      const [category] = await testDb.drizzle
        .insert(categories)
        .values({
          restaurantId: String(restaurantId),
          name: `Category ${uniqueSuffix()}`,
          description: "Real integration category",
          sortOrder: 0,
          isActive: true,
          isVisible: true,
          createdAt: now,
          updatedAt: now,
        } as never)
        .returning();

      const [row] = await testDb.drizzle
        .insert(menuItems)
        .values({
          name: `Menu Item ${uniqueSuffix()}`,
          description: "Real integration menu item",
          ingredients: "salt",
          price: 120,
          priceCents: 12000,
          isAvailable: true,
          isFeatured: false,
          isPopular: false,
          sortOrder: 0,
          spiceLevel: 0,
          preparationTime: 15,
          dietaryInfo: {},
          allergens: [],
          tags: [],
          createdAt: now,
          updatedAt: now,
          restaurantId: String(restaurantId),
          categoryId: category.id,
          ...overrides,
        } as never)
        .returning();
      return { id: row.id as number };
    },

    user: async (overrides = {}) => {
      const suffix = uniqueSuffix();
      const now = new Date();
      const restaurantId =
        "restaurantId" in overrides ? overrides.restaurantId : null;
      const { id: overrideId, ...restOverrides } = overrides;
      const username =
        typeof restOverrides.username === "string"
          ? restOverrides.username
          : `user-${suffix}`;
      const values = {
        id: normalizeSeedUserId(overrideId),
        username,
        email: `user-${suffix}@example.com`,
        phone: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
        fullName: "Integration User",
        passwordHash:
          "$2a$10$wLQYkZtHPzOVvvEVdW/PGe0IzS5gYejVGKj.mJ/.SmdO1sAgG4Y/S",
        role: 4,
        isActive: true,
        isVerified: true,
        preferences: {},
        tokenVersion: 1,
        restaurantId,
        createdAt: maybeDate(overrides.createdAt) ?? now,
        updatedAt: maybeDate(overrides.updatedAt) ?? now,
        lastLoginAt: maybeDate(overrides.lastLoginAt),
        passwordChangedAt: maybeDate(overrides.passwordChangedAt),
        ...restOverrides,
      } as never;

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const [row] = await testDb.drizzle
            .insert(users)
            .values(values)
            .returning();
          return { id: row.id as string, username: row.username as string };
        } catch (err) {
          if (!isTransientD1Error(err) || attempt === 2) throw err;

          const existing = await testDb.drizzle
            .select()
            .from(users)
            .where(eq(users.username, username))
            .limit(1)
            .all();
          const row = existing[0];
          if (row) {
            return { id: row.id as string, username: row.username as string };
          }

          console.warn(
            `[seed.user] transient miniflare insert failed (attempt ${
              attempt + 1
            }/3), retrying...`,
          );
          await new Promise((resolve) =>
            setTimeout(resolve, 100 * (attempt + 1)),
          );
        }
      }

      throw new Error("seed.user retry loop exhausted");
    },

    coupon: async (restaurantId, overrides = {}) => {
      const now = new Date();
      const suffix = uniqueSuffix().toUpperCase();
      const [row] = await testDb.drizzle
        .insert(coupons)
        .values({
          code: `TEST-${suffix}`,
          name: "Test Coupon",
          description: null,
          discountType: "percentage",
          discountValue: 10,
          maxDiscountAmount: null,
          minOrderAmount: 0,
          applicableMenuItems: null,
          applicableCategories: null,
          usageLimit: null,
          usageLimitPerUser: null,
          usedCount: 0,
          validFrom: daysFrom(now, -1),
          validTo: daysFrom(now, 30),
          isActive: true,
          isVisible: true,
          createdBy: null,
          deletedAt: null,
          restaurantId: String(restaurantId),
          ...overrides,
        } as never)
        .returning();
      return { id: row.id as number, code: row.code as string };
    },

    order: async (restaurantId, overrides = {}) => {
      const now = new Date();
      const tableId = "tableId" in overrides ? overrides.tableId : null;
      const customerId =
        "customerId" in overrides ? overrides.customerId : null;
      const [row] = await testDb.drizzle
        .insert(orders)
        .values({
          orderNumber: `ORD-${uniqueSuffix().toUpperCase()}`,
          status: "pending",
          version: 0,
          orderType: "table",
          orderSource: "direct",
          subtotal: 120,
          taxAmount: 0,
          serviceCharge: 0,
          discountAmount: 0,
          totalAmount: 120,
          subtotalCents: 12000,
          taxAmountCents: 0,
          serviceChargeCents: 0,
          discountAmountCents: 0,
          totalAmountCents: 12000,
          customerInfo: {},
          paymentStatus: "pending",
          promotionIds: [],
          restaurantId: String(restaurantId),
          tableId,
          customerId,
          createdAt: maybeDate(overrides.createdAt) ?? now,
          updatedAt: maybeDate(overrides.updatedAt) ?? now,
          confirmedAt: maybeDate(overrides.confirmedAt),
          preparingAt: maybeDate(overrides.preparingAt),
          readyAt: maybeDate(overrides.readyAt),
          deliveredAt: maybeDate(overrides.deliveredAt),
          paidAt: maybeDate(overrides.paidAt),
          cancelledAt: maybeDate(overrides.cancelledAt),
          reviewedAt: maybeDate(overrides.reviewedAt),
          ...overrides,
        } as never)
        .returning();
      return { id: row.id };
    },
  };
}
