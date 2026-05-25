import { drizzle } from "drizzle-orm/d1";
import { eq, sql } from "drizzle-orm";
import {
  dishSearchIndex,
  menuItems,
  categories,
  restaurants,
} from "@makanmakan/database";
import { toCents } from "../../../shared/utils/money";

export class SearchIndexSyncService {
  private db;

  constructor(
    d1: D1Database,
    private kv: KVNamespace,
  ) {
    this.db = drizzle(d1);
  }

  async onMenuItemChanged(menuItemId: number): Promise<void> {
    const [item] = await this.db
      .select({
        id: menuItems.id,
        name: menuItems.name,
        price: menuItems.price,
        priceCents: menuItems.priceCents,
        isAvailable: menuItems.isAvailable,
        tags: menuItems.tags,
        keywords: menuItems.keywords,
        deletedAt: menuItems.deletedAt,
        restaurantId: menuItems.restaurantId,
        categoryName: categories.name,
        district: restaurants.district,
        restaurantType: restaurants.type,
        supportsTakeaway: restaurants.supportsTakeaway,
        supportsDelivery: restaurants.supportsDelivery,
        restaurantDeleted: restaurants.deletedAt,
        latitude: restaurants.latitude,
        longitude: restaurants.longitude,
        marketIds: sql<string | null>`(
          SELECT json_group_array(rmm.market_id)
          FROM restaurant_market_memberships rmm
          WHERE rmm.restaurant_id = ${restaurants.id}
            AND rmm.left_at_ms IS NULL
        )`,
        primaryMarketId: sql<string | null>`(
          SELECT rmm.market_id
          FROM restaurant_market_memberships rmm
          WHERE rmm.restaurant_id = ${restaurants.id}
            AND rmm.left_at_ms IS NULL
            AND rmm.is_primary = 1
          LIMIT 1
        )`,
      })
      .from(menuItems)
      .leftJoin(categories, eq(menuItems.categoryId, categories.id))
      .innerJoin(restaurants, eq(menuItems.restaurantId, restaurants.id))
      .where(eq(menuItems.id, menuItemId))
      .limit(1);

    if (!item) {
      await this.db
        .delete(dishSearchIndex)
        .where(eq(dishSearchIndex.menuItemId, menuItemId));
      return;
    }

    const isAvailable =
      item.isAvailable && !item.deletedAt && !item.restaurantDeleted;
    const normalized = item.name.trim().toLowerCase().replace(/\s+/g, "");
    const tags = [
      ...(item.tags ?? []),
      ...(item.keywords
        ? typeof item.keywords === "string"
          ? JSON.parse(item.keywords)
          : []
        : []),
    ];

    // Delete existing + insert (replaces INSERT OR REPLACE without needing unique constraint)
    await this.db
      .delete(dishSearchIndex)
      .where(eq(dishSearchIndex.menuItemId, menuItemId));

    await this.db.insert(dishSearchIndex).values({
      menuItemId: item.id,
      restaurantId: item.restaurantId,
      dishName: item.name,
      dishNameNormalized: normalized,
      categoryName: item.categoryName,
      price: item.price,
      priceCents: item.priceCents ?? toCents(item.price),
      isAvailable,
      tags,
      district: item.district,
      restaurantType: item.restaurantType,
      supportsTakeaway: item.supportsTakeaway,
      supportsDelivery: item.supportsDelivery,
      primaryMarketId: item.primaryMarketId,
      marketIds: item.marketIds ? JSON.parse(item.marketIds) : [],
      latitude: item.latitude,
      longitude: item.longitude,
      updatedAt: new Date(),
    });
  }

  async onRestaurantChanged(restaurantId: string): Promise<void> {
    const [restaurant] = await this.db
      .select({
        district: restaurants.district,
        type: restaurants.type,
        supportsTakeaway: restaurants.supportsTakeaway,
        supportsDelivery: restaurants.supportsDelivery,
        latitude: restaurants.latitude,
        longitude: restaurants.longitude,
        marketIds: sql<string | null>`(
          SELECT json_group_array(rmm.market_id)
          FROM restaurant_market_memberships rmm
          WHERE rmm.restaurant_id = ${restaurants.id}
            AND rmm.left_at_ms IS NULL
        )`,
        primaryMarketId: sql<string | null>`(
          SELECT rmm.market_id
          FROM restaurant_market_memberships rmm
          WHERE rmm.restaurant_id = ${restaurants.id}
            AND rmm.left_at_ms IS NULL
            AND rmm.is_primary = 1
          LIMIT 1
        )`,
        deletedAt: restaurants.deletedAt,
      })
      .from(restaurants)
      .where(eq(restaurants.id, restaurantId))
      .limit(1);

    if (!restaurant) return;

    if (restaurant.deletedAt) {
      await this.db
        .update(dishSearchIndex)
        .set({ isAvailable: false, updatedAt: new Date() })
        .where(eq(dishSearchIndex.restaurantId, restaurantId));
    } else {
      await this.db
        .update(dishSearchIndex)
        .set({
          district: restaurant.district,
          restaurantType: restaurant.type,
          supportsTakeaway: restaurant.supportsTakeaway,
          supportsDelivery: restaurant.supportsDelivery,
          primaryMarketId: restaurant.primaryMarketId,
          marketIds: restaurant.marketIds
            ? JSON.parse(restaurant.marketIds)
            : [],
          latitude: restaurant.latitude,
          longitude: restaurant.longitude,
          updatedAt: new Date(),
        })
        .where(eq(dishSearchIndex.restaurantId, restaurantId));
    }

    await this.kv.delete(`search:restaurants:district:${restaurant.district}`);
  }

  async onMarketMembershipChanged(restaurantId: string): Promise<void> {
    await this.onRestaurantChanged(restaurantId);
  }
}
