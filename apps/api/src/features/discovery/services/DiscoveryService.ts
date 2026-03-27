import { drizzle } from "drizzle-orm/d1";
import {
  eq,
  and,
  like,
  gte,
  lte,
  inArray,
  isNull,
  desc,
  asc,
  sql,
} from "drizzle-orm";
import {
  dishSearchIndex,
  restaurants,
  menuItems,
  categories,
} from "@makanmakan/database";
import type {
  DishSearchResult,
  RestaurantListItem,
  SearchFilters,
  SearchResponse,
} from "../types";
import { isOpenNow } from "../utils/isOpenNow";

const KV_SEARCH_TTL = 15 * 60; // 15 minutes
const KV_RESTAURANT_TTL = 30 * 60; // 30 minutes

export class DiscoveryService {
  private db;
  private d1: D1Database;

  constructor(
    d1: D1Database,
    private kv: KVNamespace,
  ) {
    this.db = drizzle(d1);
    this.d1 = d1;
  }

  async searchDishes(
    filters: SearchFilters,
  ): Promise<SearchResponse<DishSearchResult>> {
    const { q, page = 1, limit = 20 } = filters;
    if (!q) return { results: [], total: 0, page, limit };

    // 1. Check KV cache
    const cacheKey = this.buildCacheKey("search:query", filters);
    const cached = await this.kv.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      return { results: parsed.results, total: parsed.total, page, limit };
    }

    // 2. Normalize query
    const normalized = this.normalizeQuery(q);

    // 3. D1 prefix search
    const offset = (page - 1) * limit;

    const conditions = [
      eq(dishSearchIndex.isAvailable, true),
      like(dishSearchIndex.dishNameNormalized, `${normalized}%`),
    ];

    if (filters.district) {
      conditions.push(eq(dishSearchIndex.district, filters.district));
    }
    if (filters.priceMin !== undefined) {
      conditions.push(gte(dishSearchIndex.price, filters.priceMin));
    }
    if (filters.priceMax !== undefined) {
      conditions.push(lte(dishSearchIndex.price, filters.priceMax));
    }
    if (filters.takeaway) {
      conditions.push(eq(dishSearchIndex.supportsTakeaway, true));
    }
    if (filters.delivery) {
      conditions.push(eq(dishSearchIndex.supportsDelivery, true));
    }

    const queryResult = await this.db
      .select({
        menuItemId: dishSearchIndex.menuItemId,
        dishName: dishSearchIndex.dishName,
        price: dishSearchIndex.price,
        categoryName: dishSearchIndex.categoryName,
        restaurantId: dishSearchIndex.restaurantId,
        restaurantName: restaurants.name,
        district: dishSearchIndex.district,
        businessHours: restaurants.businessHours,
        supportsTakeaway: dishSearchIndex.supportsTakeaway,
        supportsDelivery: dishSearchIndex.supportsDelivery,
        tags: dishSearchIndex.tags,
      })
      .from(dishSearchIndex)
      .innerJoin(restaurants, eq(dishSearchIndex.restaurantId, restaurants.id))
      .where(and(...conditions))
      .orderBy(asc(dishSearchIndex.price))
      .limit(limit)
      .offset(offset);

    // 4. KV tag index lookup
    const tagIndex = await this.kv.get("search:tags:index");
    let tagMatches: number[] = [];
    if (tagIndex) {
      const index: Record<string, { menuItemId: number }[]> =
        JSON.parse(tagIndex);
      if (index[normalized] || index[q]) {
        tagMatches = (index[normalized] || index[q] || []).map(
          (t) => t.menuItemId,
        );
      }
    }

    // Merge tag matches not already in prefix results (cap at 50 to stay within D1's 100-param limit)
    const prefixIds = new Set(queryResult.map((r) => r.menuItemId));
    const allRows = [...queryResult];
    if (tagMatches.length > 0) {
      const missingIds = tagMatches
        .filter((id) => !prefixIds.has(id))
        .slice(0, 50);
      if (missingIds.length > 0) {
        const tagResults = await this.db
          .select({
            menuItemId: dishSearchIndex.menuItemId,
            dishName: dishSearchIndex.dishName,
            price: dishSearchIndex.price,
            categoryName: dishSearchIndex.categoryName,
            restaurantId: dishSearchIndex.restaurantId,
            restaurantName: restaurants.name,
            district: dishSearchIndex.district,
            businessHours: restaurants.businessHours,
            supportsTakeaway: dishSearchIndex.supportsTakeaway,
            supportsDelivery: dishSearchIndex.supportsDelivery,
            tags: dishSearchIndex.tags,
          })
          .from(dishSearchIndex)
          .innerJoin(
            restaurants,
            eq(dishSearchIndex.restaurantId, restaurants.id),
          )
          .where(
            and(
              eq(dishSearchIndex.isAvailable, true),
              inArray(dishSearchIndex.menuItemId, missingIds),
            ),
          )
          .limit(50);
        allRows.push(...tagResults);
      }
    }

    // 5. Map results + openNow filter
    let results: DishSearchResult[] = allRows.map((row) => ({
      menuItemId: row.menuItemId,
      dishName: row.dishName,
      price: row.price ?? 0,
      categoryName: row.categoryName,
      restaurantId: row.restaurantId,
      restaurantName: row.restaurantName,
      district: row.district,
      isOpen: isOpenNow(row.businessHours ?? null),
      supportsTakeaway: row.supportsTakeaway,
      supportsDelivery: row.supportsDelivery,
      tags: row.tags ?? [],
    }));

    if (filters.openNow) {
      results = results.filter((r) => r.isOpen);
    }

    // 6. Cache and return
    const response = { results, total: results.length, page, limit };
    await this.kv.put(
      cacheKey,
      JSON.stringify({ results, total: results.length, cachedAt: Date.now() }),
      { expirationTtl: KV_SEARCH_TTL },
    );

    return response;
  }

  async browseRestaurants(
    filters: SearchFilters,
  ): Promise<SearchResponse<RestaurantListItem>> {
    const { page = 1, limit = 20 } = filters;

    // Check KV cache for district-based browse
    if (filters.district && !filters.openNow) {
      const kvKey = `search:restaurants:district:${filters.district}`;
      const cached = await this.kv.get(kvKey);
      if (cached) {
        let restaurantList: RestaurantListItem[] = JSON.parse(cached);
        if (filters.takeaway)
          restaurantList = restaurantList.filter((r) => r.supportsTakeaway);
        if (filters.delivery)
          restaurantList = restaurantList.filter((r) => r.supportsDelivery);
        if (filters.priceRange)
          restaurantList = restaurantList.filter(
            (r) => r.priceRange === filters.priceRange,
          );
        const start = (page - 1) * limit;
        return {
          results: restaurantList.slice(start, start + limit),
          total: restaurantList.length,
          page,
          limit,
        };
      }
    }

    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [
      eq(restaurants.isActive, true),
      isNull(restaurants.deletedAt),
    ];

    if (filters.q) {
      conditions.push(like(restaurants.name, `%${filters.q}%`));
    }
    if (filters.district) {
      conditions.push(eq(restaurants.district, filters.district));
    }
    if (filters.city) {
      conditions.push(eq(restaurants.city, filters.city));
    }
    if (filters.cuisineType) {
      conditions.push(eq(restaurants.type, filters.cuisineType));
    }
    if (filters.priceRange) {
      conditions.push(eq(restaurants.priceRange, filters.priceRange));
    }
    if (filters.takeaway) {
      conditions.push(eq(restaurants.supportsTakeaway, true));
    }
    if (filters.delivery) {
      conditions.push(eq(restaurants.supportsDelivery, true));
    }

    const orderByClause =
      filters.sortBy === "rating"
        ? desc(restaurants.rating)
        : desc(restaurants.totalOrders);

    const result = await this.db
      .select({
        id: restaurants.id,
        name: restaurants.name,
        type: restaurants.type,
        category: restaurants.category,
        district: restaurants.district,
        city: restaurants.city,
        priceRange: restaurants.priceRange,
        rating: restaurants.rating,
        businessHours: restaurants.businessHours,
        supportsTakeaway: restaurants.supportsTakeaway,
        supportsDelivery: restaurants.supportsDelivery,
        logoUrl: restaurants.logoUrl,
      })
      .from(restaurants)
      .where(and(...conditions))
      .orderBy(orderByClause)
      .limit(limit)
      .offset(offset);

    const restaurantList: RestaurantListItem[] = result.map((row) => ({
      restaurantId: row.id,
      name: row.name,
      type: row.type,
      category: row.category,
      district: row.district,
      city: row.city,
      priceRange: row.priceRange,
      rating: row.rating,
      isOpen: isOpenNow(row.businessHours ?? null),
      supportsTakeaway: row.supportsTakeaway,
      supportsDelivery: row.supportsDelivery,
      imageUrl: row.logoUrl,
    }));

    // Cache district results in KV (only when no secondary filters and page=1 to avoid partial cache)
    if (
      filters.district &&
      !filters.openNow &&
      !filters.takeaway &&
      !filters.delivery &&
      !filters.priceRange &&
      page === 1
    ) {
      const kvKey = `search:restaurants:district:${filters.district}`;
      await this.kv.put(kvKey, JSON.stringify(restaurantList), {
        expirationTtl: KV_RESTAURANT_TTL,
      });
    }

    let filtered = restaurantList;
    if (filters.openNow) {
      filtered = restaurantList.filter((r) => r.isOpen);
    }

    return { results: filtered, total: filtered.length, page, limit };
  }

  async getPopular(): Promise<{
    keywords: string[];
    dishes: DishSearchResult[];
    restaurants: RestaurantListItem[];
  }> {
    const keywordsJson = await this.kv.get("search:meta:popular-keywords");
    const keywords: string[] = keywordsJson ? JSON.parse(keywordsJson) : [];

    const topDishes = await this.db
      .select({
        menuItemId: dishSearchIndex.menuItemId,
        dishName: dishSearchIndex.dishName,
        price: dishSearchIndex.price,
        categoryName: dishSearchIndex.categoryName,
        restaurantId: dishSearchIndex.restaurantId,
        restaurantName: restaurants.name,
        district: dishSearchIndex.district,
        businessHours: restaurants.businessHours,
        supportsTakeaway: dishSearchIndex.supportsTakeaway,
        supportsDelivery: dishSearchIndex.supportsDelivery,
        tags: dishSearchIndex.tags,
        orderCount: menuItems.orderCount,
      })
      .from(dishSearchIndex)
      .innerJoin(restaurants, eq(dishSearchIndex.restaurantId, restaurants.id))
      .innerJoin(menuItems, eq(dishSearchIndex.menuItemId, menuItems.id))
      .where(eq(dishSearchIndex.isAvailable, true))
      .orderBy(desc(menuItems.orderCount))
      .limit(10);

    const dishes: DishSearchResult[] = topDishes.map((row) => ({
      menuItemId: row.menuItemId,
      dishName: row.dishName,
      price: row.price ?? 0,
      categoryName: row.categoryName,
      restaurantId: row.restaurantId,
      restaurantName: row.restaurantName,
      district: row.district,
      isOpen: isOpenNow(row.businessHours ?? null),
      supportsTakeaway: row.supportsTakeaway,
      supportsDelivery: row.supportsDelivery,
      tags: row.tags ?? [],
    }));

    const topRestaurants = await this.browseRestaurants({
      sortBy: "popular",
      limit: 10,
    });

    return { keywords, dishes, restaurants: topRestaurants.results };
  }

  async getRestaurantMenu(restaurantId: string) {
    return await this.db
      .select({
        id: menuItems.id,
        name: menuItems.name,
        description: menuItems.description,
        price: menuItems.price,
        is_available: menuItems.isAvailable,
        image_url: menuItems.imageUrl,
        category_name: categories.name,
      })
      .from(menuItems)
      .leftJoin(categories, eq(menuItems.categoryId, categories.id))
      .where(
        and(
          eq(menuItems.restaurantId, restaurantId),
          eq(menuItems.isAvailable, true),
          isNull(menuItems.deletedAt),
        ),
      )
      .orderBy(asc(categories.sortOrder), asc(menuItems.sortOrder));
  }

  async reindex(): Promise<{
    dishes: number;
    restaurants: number;
    duration_ms: number;
  }> {
    const start = Date.now();

    const items = await this.db
      .select({
        menuItemId: menuItems.id,
        name: menuItems.name,
        price: menuItems.price,
        isAvailable: menuItems.isAvailable,
        tags: menuItems.tags,
        keywords: menuItems.keywords,
        deletedAtMs: menuItems.deletedAt,
        categoryName: categories.name,
        restaurantId: restaurants.id,
        district: restaurants.district,
        restaurantType: restaurants.type,
        supportsTakeaway: restaurants.supportsTakeaway,
        supportsDelivery: restaurants.supportsDelivery,
        restaurantDeleted: restaurants.deletedAt,
      })
      .from(menuItems)
      .leftJoin(categories, eq(menuItems.categoryId, categories.id))
      .innerJoin(restaurants, eq(menuItems.restaurantId, restaurants.id))
      .where(eq(restaurants.isActive, true));

    // Build batch statements (D1 supports up to 100 per batch)
    // We keep the raw D1 reference for batch operations since Drizzle's batch API
    // doesn't support the same batching semantics as D1's native batch.
    const stmts: D1PreparedStatement[] = [];
    for (const item of items) {
      const isAvailable =
        item.isAvailable && !item.deletedAtMs && !item.restaurantDeleted;
      const normalized = item.name.trim().toLowerCase().replace(/\s+/g, "");
      const itemTags: string[] = [
        ...((item.tags as string[] | null) ?? []),
        ...(item.keywords ? JSON.parse(item.keywords) : []),
      ];

      stmts.push(
        this.d1
          .prepare(
            `INSERT OR REPLACE INTO dish_search_index
             (menu_item_id, restaurant_id, dish_name, dish_name_normalized, category_name, price, is_available, tags, district, restaurant_type, supports_takeaway, supports_delivery, updated_at_ms)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            item.menuItemId,
            item.restaurantId,
            item.name,
            normalized,
            item.categoryName,
            item.price,
            isAvailable ? 1 : 0,
            JSON.stringify(itemTags),
            item.district,
            item.restaurantType,
            item.supportsTakeaway ? 1 : 0,
            item.supportsDelivery ? 1 : 0,
            Date.now(),
          ),
      );
    }

    // Execute in batches of 100
    for (let i = 0; i < stmts.length; i += 100) {
      await this.d1.batch(stmts.slice(i, i + 100));
    }
    const dishCount = stmts.length;

    // Delete orphaned index entries
    await this.db
      .delete(dishSearchIndex)
      .where(
        sql`${dishSearchIndex.menuItemId} NOT IN (SELECT ${menuItems.id} FROM ${menuItems})`,
      );

    // Rebuild KV tag index
    const allTags = await this.db
      .select({
        menuItemId: dishSearchIndex.menuItemId,
        restaurantId: dishSearchIndex.restaurantId,
        dishName: dishSearchIndex.dishName,
        price: dishSearchIndex.price,
        tags: dishSearchIndex.tags,
      })
      .from(dishSearchIndex)
      .where(eq(dishSearchIndex.isAvailable, true));

    const tagIndexMap: Record<
      string,
      {
        menuItemId: number;
        restaurantId: string;
        dishName: string;
        price: number;
      }[]
    > = {};
    for (const row of allTags) {
      const rowTags: string[] = row.tags ?? [];
      for (const tag of rowTags) {
        const normalizedTag = tag.trim().toLowerCase();
        if (!tagIndexMap[normalizedTag]) tagIndexMap[normalizedTag] = [];
        tagIndexMap[normalizedTag].push({
          menuItemId: row.menuItemId,
          restaurantId: row.restaurantId,
          dishName: row.dishName,
          price: row.price ?? 0,
        });
      }
    }
    await this.kv.put("search:tags:index", JSON.stringify(tagIndexMap), {
      expirationTtl: 30 * 60,
    });

    const duration_ms = Date.now() - start;
    return {
      dishes: dishCount,
      restaurants: items.length,
      duration_ms,
    };
  }

  // --- Private helpers ---

  private normalizeQuery(query: string): string {
    return query.trim().toLowerCase().replace(/\s+/g, "");
  }

  private buildCacheKey(prefix: string, filters: SearchFilters): string {
    const parts = [prefix];
    if (filters.q) parts.push(this.normalizeQuery(filters.q));
    if (filters.district) parts.push(`d:${filters.district}`);
    if (filters.priceMin) parts.push(`pmin:${filters.priceMin}`);
    if (filters.priceMax) parts.push(`pmax:${filters.priceMax}`);
    if (filters.openNow) parts.push("open");
    if (filters.takeaway) parts.push("ta");
    if (filters.delivery) parts.push("dl");
    parts.push(`p:${filters.page || 1}`);
    parts.push(`l:${filters.limit || 20}`);
    return parts.join(":");
  }
}
