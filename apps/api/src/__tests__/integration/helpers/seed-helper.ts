import type { TestDatabase } from "@makanmakan/database/testing";
import {
  restaurantFactory,
  menuItemFactory,
  orderFactory,
  categoryFactory,
  userFactory,
} from "@makanmakan/testing-utils";
import {
  restaurants,
  menuItems,
  orders,
  categories,
  users,
} from "@makanmakan/database";

export interface SeedHelpers {
  restaurant(
    overrides?: Record<string, unknown>,
  ): Promise<{ id: string | number }>;
  menuItem(
    restaurantId: string | number,
    overrides?: Record<string, unknown>,
  ): Promise<{ id: number }>;
  order(
    restaurantId: string | number,
    overrides?: Record<string, unknown>,
  ): Promise<{ id: number }>;
  user(
    overrides?: Record<string, unknown>,
  ): Promise<{ id: number; username: string }>;
}

/**
 * Convert a Unix-ms timestamp number to a Date, or return as-is if already a Date.
 * Required because factory produces number timestamps but Drizzle's timestamp_ms
 * mode expects Date objects.
 */
function toDate(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  return undefined;
}

export function buildSeedHelpers(testDb: TestDatabase): SeedHelpers {
  return {
    restaurant: async (overrides) => {
      const data = restaurantFactory.build({ overrides: overrides as any });

      // Strip fields not present in the schema and convert timestamps.
      // The factory includes `id` (integer) and `status` which are not schema columns.
      const {
        id: _id,
        status: _status,
        createdAt,
        updatedAt,
        ...rest
      } = data as any;

      const [row] = await testDb.drizzle
        .insert(restaurants)
        .values({
          ...rest,
          createdAt: toDate(createdAt),
          updatedAt: toDate(updatedAt),
        } as any)
        .returning();
      return { id: row.id };
    },

    menuItem: async (restaurantId, overrides) => {
      // menuItems.categoryId has a real FK to categories.id.
      // Seed a throwaway category for this restaurant first.
      // categoryFactory's type expects `restaurantId: number`, but the real
      // schema uses TEXT UUID. Cast to `any` to bypass the stale factory type.
      const catData = categoryFactory.build({
        overrides: { restaurantId: String(restaurantId) } as any,
      });
      const {
        id: _catId,
        createdAt: catCa,
        updatedAt: catUa,
        ...catRest
      } = catData as any;

      const [catRow] = await testDb.drizzle
        .insert(categories)
        .values({
          ...catRest,
          restaurantId: String(restaurantId),
          createdAt: toDate(catCa),
          updatedAt: toDate(catUa),
        } as any)
        .returning();

      const data = menuItemFactory.build({
        overrides: {
          restaurantId: String(restaurantId),
          categoryId: catRow.id,
          ...overrides,
        } as any,
      });

      const { id: _id, createdAt, updatedAt, ...rest } = data as any;

      const [row] = await testDb.drizzle
        .insert(menuItems)
        .values({
          ...rest,
          restaurantId: String(restaurantId),
          categoryId: catRow.id,
          createdAt: toDate(createdAt),
          updatedAt: toDate(updatedAt),
        } as any)
        .returning();
      return { id: row.id as number };
    },

    user: async (overrides) => {
      const data = userFactory.build({ overrides: overrides as any });

      // Factory produces camelCase; strip fields not in schema and convert timestamps.
      const {
        id: rawId,
        createdAt,
        updatedAt,
        status: _status, // not a schema column on users
        ...rest
      } = data as any;

      const [row] = await testDb.drizzle
        .insert(users)
        .values({
          ...rest,
          // Preserve explicit id if caller asked for one (e.g. match JWT claim)
          ...(overrides?.id !== undefined ? { id: overrides.id } : {}),
          createdAt: toDate(createdAt),
          updatedAt: toDate(updatedAt),
          // Factory may emit ms for these optional timestamps too
          lastLoginAt: rest.lastLoginAt ? toDate(rest.lastLoginAt) : null,
          passwordChangedAt: rest.passwordChangedAt
            ? toDate(rest.passwordChangedAt)
            : null,
        } as any)
        .returning();
      return { id: row.id as number, username: row.username as string };
    },

    order: async (restaurantId, overrides) => {
      const data = orderFactory.build({
        overrides: {
          restaurantId: String(restaurantId),
          // tableId and customerId default to random integers in the factory
          // which would violate FK constraints — override to null (both are nullable).
          tableId: null,
          customerId: null,
          ...overrides,
        } as any,
      });

      const { id: _id, createdAt, updatedAt, ...rest } = data as any;

      const [row] = await testDb.drizzle
        .insert(orders)
        .values({
          ...rest,
          restaurantId: String(restaurantId),
          tableId: null,
          customerId: null,
          createdAt: toDate(createdAt),
          updatedAt: toDate(updatedAt),
          // Status timestamps also need Date conversion
          confirmedAt: rest.confirmedAt ? toDate(rest.confirmedAt) : null,
          preparingAt: rest.preparingAt ? toDate(rest.preparingAt) : null,
          readyAt: rest.readyAt ? toDate(rest.readyAt) : null,
          deliveredAt: rest.deliveredAt ? toDate(rest.deliveredAt) : null,
          paidAt: rest.paidAt ? toDate(rest.paidAt) : null,
          cancelledAt: rest.cancelledAt ? toDate(rest.cancelledAt) : null,
          reviewedAt: rest.reviewedAt ? toDate(rest.reviewedAt) : null,
        } as any)
        .returning();
      return { id: row.id as number };
    },
  };
}
