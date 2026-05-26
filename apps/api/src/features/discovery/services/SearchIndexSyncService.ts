import { drizzle } from "drizzle-orm/d1";
import { and, eq, isNull, sql } from "drizzle-orm";
import {
  dishSearchIndex,
  menuItems,
  categories,
  restaurants,
  restaurantMarketMemberships,
} from "@makanmakan/database";
import { toCents } from "../../../shared/utils/money";
import { normalizeSearchTags } from "../utils/search-normalization";

const KV_SEARCH_VERSION_KEY = "search:query:version";
const MARKET_CACHE_VERSION_KEY = "markets:version";

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
        categoryActive: categories.isActive,
        categoryVisible: categories.isVisible,
        categoryDeleted: categories.deletedAt,
        district: restaurants.district,
        restaurantType: restaurants.type,
        supportsTakeaway: restaurants.supportsTakeaway,
        supportsDelivery: restaurants.supportsDelivery,
        restaurantActive: restaurants.isActive,
        restaurantDeleted: restaurants.deletedAt,
        latitude: restaurants.latitude,
        longitude: restaurants.longitude,
        marketIds: sql<string | null>`(
          SELECT json_group_array(rmm.market_id)
          FROM restaurant_market_memberships rmm
          INNER JOIN markets m ON m.id = rmm.market_id
          WHERE rmm.restaurant_id = restaurants.id
            AND rmm.left_at_ms IS NULL
            AND m.is_active = 1
            AND m.deleted_at_ms IS NULL
        )`,
        primaryMarketId: sql<string | null>`(
          SELECT rmm.market_id
          FROM restaurant_market_memberships rmm
          INNER JOIN markets m ON m.id = rmm.market_id
          WHERE rmm.restaurant_id = restaurants.id
            AND rmm.left_at_ms IS NULL
            AND rmm.is_primary = 1
            AND m.is_active = 1
            AND m.deleted_at_ms IS NULL
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
      await this.bumpSearchVersion();
      return;
    }

    const isAvailable =
      item.isAvailable &&
      !item.deletedAt &&
      item.categoryActive === true &&
      item.categoryVisible === true &&
      !item.categoryDeleted &&
      item.restaurantActive &&
      !item.restaurantDeleted;
    const normalized = item.name.trim().toLowerCase().replace(/\s+/g, "");
    const tags = normalizeSearchTags(item.tags, item.keywords);

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
    await this.bumpSearchVersion();
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
        isActive: restaurants.isActive,
        marketIds: sql<string | null>`(
          SELECT json_group_array(rmm.market_id)
          FROM restaurant_market_memberships rmm
          INNER JOIN markets m ON m.id = rmm.market_id
          WHERE rmm.restaurant_id = restaurants.id
            AND rmm.left_at_ms IS NULL
            AND m.is_active = 1
            AND m.deleted_at_ms IS NULL
        )`,
        primaryMarketId: sql<string | null>`(
          SELECT rmm.market_id
          FROM restaurant_market_memberships rmm
          INNER JOIN markets m ON m.id = rmm.market_id
          WHERE rmm.restaurant_id = restaurants.id
            AND rmm.left_at_ms IS NULL
            AND rmm.is_primary = 1
            AND m.is_active = 1
            AND m.deleted_at_ms IS NULL
          LIMIT 1
        )`,
        deletedAt: restaurants.deletedAt,
      })
      .from(restaurants)
      .where(eq(restaurants.id, restaurantId))
      .limit(1);

    if (!restaurant) return;

    if (!restaurant.isActive || restaurant.deletedAt) {
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
          isAvailable: sql<boolean>`EXISTS (
            SELECT 1
            FROM ${menuItems}
            INNER JOIN ${categories} ON ${categories.id} = ${menuItems.categoryId}
            WHERE ${menuItems.id} = ${dishSearchIndex.menuItemId}
              AND ${menuItems.isAvailable} = 1
              AND ${menuItems.deletedAt} IS NULL
              AND ${categories.isActive} = 1
              AND ${categories.isVisible} = 1
              AND ${categories.deletedAt} IS NULL
          )`,
          updatedAt: new Date(),
        })
        .where(eq(dishSearchIndex.restaurantId, restaurantId));
    }

    await this.kv.delete(`search:restaurants:district:${restaurant.district}`);
    await this.bumpSearchVersion();
  }

  async onMarketMembershipChanged(restaurantId: string): Promise<void> {
    await this.onRestaurantChanged(restaurantId);
  }

  async onMarketChanged(marketId: string): Promise<void> {
    const memberships = await this.db
      .select({ restaurantId: restaurantMarketMemberships.restaurantId })
      .from(restaurantMarketMemberships)
      .where(
        and(
          eq(restaurantMarketMemberships.marketId, marketId),
          isNull(restaurantMarketMemberships.leftAt),
        ),
      );

    await Promise.all(
      memberships.map(({ restaurantId }) =>
        this.onRestaurantChanged(restaurantId),
      ),
    );
  }

  private async bumpSearchVersion(): Promise<void> {
    await this.kv.put(KV_SEARCH_VERSION_KEY, String(Date.now()));
    await this.bumpMarketPublicCacheVersion();
  }

  private async bumpMarketPublicCacheVersion(): Promise<void> {
    const current = Number(await this.kv.get(MARKET_CACHE_VERSION_KEY));
    const next = Number.isFinite(current) ? current + 1 : Date.now();
    await this.kv.put(MARKET_CACHE_VERSION_KEY, String(next));
  }
}
