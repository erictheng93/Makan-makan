import { drizzle } from "drizzle-orm/d1";
import {
  eq,
  and,
  like,
  inArray,
  isNull,
  desc,
  asc,
  sql,
  or,
  gte,
  lte,
} from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  dishSearchIndex,
  restaurants,
  menuItems,
  categories,
} from "@makanmakan/database";
import { boundingBoxFromCircle, distanceKm } from "../../markets/services/geo";
import type {
  DishSearchResult,
  RestaurantListItem,
  SearchFilters,
  SearchResponse,
} from "../types";
import { isOpenNow } from "../utils/isOpenNow";
import {
  fromCents,
  toCents,
  toRequiredCents,
} from "../../../shared/utils/money";

const KV_SEARCH_TTL = 15 * 60; // 15 minutes
const KV_RESTAURANT_TTL = 30 * 60; // 30 minutes
const KV_SEARCH_VERSION_KEY = "search:query:version";

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

    // 1. Check KV cache
    const searchVersion = await this.getSearchVersion();
    const cacheKey = this.buildCacheKey("search:query", filters, searchVersion);
    const cached = await this.kv.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      return { results: parsed.results, total: parsed.total, page, limit };
    }

    // 2. Normalize query
    const normalized = q ? this.normalizeQuery(q) : null;

    // 3. D1 prefix search
    const offset = (page - 1) * limit;
    const effectivePrice = sql<number>`COALESCE(${dishSearchIndex.priceCents}, CAST(round(${dishSearchIndex.price} * 100) AS integer))`;

    const baseConditions: SQL[] = [eq(dishSearchIndex.isAvailable, true)];

    if (filters.district) {
      baseConditions.push(eq(dishSearchIndex.district, filters.district));
    }
    if (filters.city) {
      baseConditions.push(eq(restaurants.city, filters.city));
    }
    if (filters.categoryName) {
      baseConditions.push(
        eq(dishSearchIndex.categoryName, filters.categoryName),
      );
    }
    if (filters.priceMin !== undefined) {
      baseConditions.push(
        sql`COALESCE(${dishSearchIndex.priceCents}, CAST(round(${dishSearchIndex.price} * 100) AS integer)) >= ${toRequiredCents(filters.priceMin)}`,
      );
    }
    if (filters.priceMax !== undefined) {
      baseConditions.push(
        sql`COALESCE(${dishSearchIndex.priceCents}, CAST(round(${dishSearchIndex.price} * 100) AS integer)) <= ${toRequiredCents(filters.priceMax)}`,
      );
    }
    if (filters.takeaway) {
      baseConditions.push(eq(dishSearchIndex.supportsTakeaway, true));
    }
    if (filters.delivery) {
      baseConditions.push(eq(dishSearchIndex.supportsDelivery, true));
    }
    if (filters.marketId) {
      baseConditions.push(
        or(
          eq(dishSearchIndex.primaryMarketId, filters.marketId),
          like(dishSearchIndex.marketIds, `%"${filters.marketId}"%`),
        )!,
      );
    }
    const geoFilter = this.getGeoFilter(filters);
    if (geoFilter) {
      baseConditions.push(
        gte(dishSearchIndex.latitude, geoFilter.box.southLat),
        lte(dishSearchIndex.latitude, geoFilter.box.northLat),
        gte(dishSearchIndex.longitude, geoFilter.box.westLng),
        lte(dishSearchIndex.longitude, geoFilter.box.eastLng),
      );
    }

    const prefixConditions: SQL[] = [...baseConditions];
    if (normalized) {
      prefixConditions.push(
        like(dishSearchIndex.dishNameNormalized, `${normalized}%`),
      );
    }
    const whereClause = and(...prefixConditions);
    const [queryResult, countRows] = await Promise.all([
      this.db
        .select({
          menuItemId: dishSearchIndex.menuItemId,
          dishName: dishSearchIndex.dishName,
          price: dishSearchIndex.price,
          priceCents: dishSearchIndex.priceCents,
          categoryName: dishSearchIndex.categoryName,
          restaurantId: dishSearchIndex.restaurantId,
          restaurantName: restaurants.name,
          district: dishSearchIndex.district,
          businessHours: restaurants.businessHours,
          supportsTakeaway: dishSearchIndex.supportsTakeaway,
          supportsDelivery: dishSearchIndex.supportsDelivery,
          tags: dishSearchIndex.tags,
          latitude: dishSearchIndex.latitude,
          longitude: dishSearchIndex.longitude,
        })
        .from(dishSearchIndex)
        .innerJoin(
          restaurants,
          eq(dishSearchIndex.restaurantId, restaurants.id),
        )
        .innerJoin(menuItems, eq(dishSearchIndex.menuItemId, menuItems.id))
        .where(whereClause)
        .orderBy(...this.getDishSearchOrderBy(filters, effectivePrice))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(dishSearchIndex)
        .innerJoin(
          restaurants,
          eq(dishSearchIndex.restaurantId, restaurants.id),
        )
        .where(whereClause),
    ]);
    const rawTotal = Number(countRows[0]?.count);
    let total =
      Number.isFinite(rawTotal) && rawTotal >= 0
        ? rawTotal
        : queryResult.length;

    // 4. KV tag index lookup
    let tagMatches: number[] = [];
    const tagIndex = normalized ? await this.kv.get("search:tags:index") : null;
    if (tagIndex && normalized) {
      const index: Record<string, { menuItemId: number }[]> =
        JSON.parse(tagIndex);
      if (index[normalized] || (q && index[q])) {
        tagMatches = (
          index[normalized] ||
          (q ? index[q] : undefined) ||
          []
        ).map((t) => t.menuItemId);
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
            priceCents: dishSearchIndex.priceCents,
            categoryName: dishSearchIndex.categoryName,
            restaurantId: dishSearchIndex.restaurantId,
            restaurantName: restaurants.name,
            district: dishSearchIndex.district,
            businessHours: restaurants.businessHours,
            supportsTakeaway: dishSearchIndex.supportsTakeaway,
            supportsDelivery: dishSearchIndex.supportsDelivery,
            tags: dishSearchIndex.tags,
            latitude: dishSearchIndex.latitude,
            longitude: dishSearchIndex.longitude,
          })
          .from(dishSearchIndex)
          .innerJoin(
            restaurants,
            eq(dishSearchIndex.restaurantId, restaurants.id),
          )
          .innerJoin(menuItems, eq(dishSearchIndex.menuItemId, menuItems.id))
          .where(
            and(
              ...baseConditions,
              inArray(dishSearchIndex.menuItemId, missingIds),
            ),
          )
          .orderBy(...this.getDishSearchOrderBy(filters, effectivePrice))
          .limit(50);
        allRows.push(...tagResults);
      }
    }

    // 5. Map results + openNow filter
    let results: DishSearchResult[] = allRows.map((row) => ({
      menuItemId: row.menuItemId,
      dishName: row.dishName,
      price:
        row.priceCents != null ? fromCents(row.priceCents) : (row.price ?? 0),
      categoryName: row.categoryName,
      restaurantId: row.restaurantId,
      restaurantName: row.restaurantName,
      district: row.district,
      isOpen: isOpenNow(row.businessHours ?? null),
      supportsTakeaway: row.supportsTakeaway,
      supportsDelivery: row.supportsDelivery,
      tags: row.tags ?? [],
    }));

    if (geoFilter) {
      results = results.filter((result) => {
        const row = allRows.find((r) => r.menuItemId === result.menuItemId);
        if (row?.latitude == null || row.longitude == null) return false;
        return (
          distanceKm(
            { lat: geoFilter.lat, lng: geoFilter.lng },
            { lat: row.latitude, lng: row.longitude },
          ) <= geoFilter.radiusKm
        );
      });
    }

    if (filters.openNow) {
      results = results.filter((r) => r.isOpen);
    }

    // 6. Cache and return
    if (tagMatches.length > 0 && total < results.length) {
      total = results.length;
    }
    const response = { results, total, page, limit };
    await this.kv.put(
      cacheKey,
      JSON.stringify({ results, total, cachedAt: Date.now() }),
      { expirationTtl: KV_SEARCH_TTL },
    );

    return response;
  }

  async listDishCategories(
    filters: SearchFilters,
  ): Promise<{ categories: string[] }> {
    const searchVersion = await this.getSearchVersion();
    const cacheKey = this.buildCacheKey(
      "search:categories",
      filters,
      searchVersion,
    );
    const cached = await this.kv.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const conditions: SQL[] = [
      eq(dishSearchIndex.isAvailable, true),
      sql`${dishSearchIndex.categoryName} IS NOT NULL`,
      sql`${dishSearchIndex.categoryName} != ''`,
    ];
    if (filters.district) {
      conditions.push(eq(dishSearchIndex.district, filters.district));
    }
    if (filters.city) {
      conditions.push(eq(restaurants.city, filters.city));
    }
    if (filters.takeaway) {
      conditions.push(eq(dishSearchIndex.supportsTakeaway, true));
    }
    if (filters.delivery) {
      conditions.push(eq(dishSearchIndex.supportsDelivery, true));
    }
    if (filters.marketId) {
      conditions.push(
        or(
          eq(dishSearchIndex.primaryMarketId, filters.marketId),
          like(dishSearchIndex.marketIds, `%"${filters.marketId}"%`),
        )!,
      );
    }

    const rows = await this.db
      .select({ categoryName: dishSearchIndex.categoryName })
      .from(dishSearchIndex)
      .innerJoin(restaurants, eq(dishSearchIndex.restaurantId, restaurants.id))
      .where(and(...conditions))
      .groupBy(dishSearchIndex.categoryName)
      .orderBy(asc(dishSearchIndex.categoryName));

    const data = {
      categories: rows
        .map((row) => row.categoryName)
        .filter((category): category is string => Boolean(category)),
    };
    await this.kv.put(cacheKey, JSON.stringify(data), {
      expirationTtl: KV_SEARCH_TTL,
    });
    return data;
  }

  async browseRestaurants(
    filters: SearchFilters,
  ): Promise<SearchResponse<RestaurantListItem>> {
    const { page = 1, limit = 20 } = filters;

    // Check KV cache for district-based browse
    if (filters.district && !filters.city && !filters.openNow) {
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

    const conditions: SQL[] = [
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
    if (filters.marketId) {
      conditions.push(sql`EXISTS (
        SELECT 1
        FROM restaurant_market_memberships rmm
        WHERE rmm.restaurant_id = ${restaurants.id}
          AND rmm.market_id = ${filters.marketId}
          AND rmm.left_at_ms IS NULL
      )`);
    }
    const geoFilter = this.getGeoFilter(filters);
    if (geoFilter) {
      conditions.push(
        gte(restaurants.latitude, geoFilter.box.southLat),
        lte(restaurants.latitude, geoFilter.box.northLat),
        gte(restaurants.longitude, geoFilter.box.westLng),
        lte(restaurants.longitude, geoFilter.box.eastLng),
      );
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
        latitude: restaurants.latitude,
        longitude: restaurants.longitude,
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
    if (geoFilter) {
      filtered = result
        .filter(
          (row) =>
            row.latitude != null &&
            row.longitude != null &&
            distanceKm(
              { lat: geoFilter.lat, lng: geoFilter.lng },
              { lat: row.latitude, lng: row.longitude },
            ) <= geoFilter.radiusKm,
        )
        .map((row) => restaurantList.find((r) => r.restaurantId === row.id)!)
        .filter(Boolean);
    }
    if (filters.openNow) {
      filtered = filtered.filter((r) => r.isOpen);
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
        priceCents: dishSearchIndex.priceCents,
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
      price:
        row.priceCents != null ? fromCents(row.priceCents) : (row.price ?? 0),
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
        price: sql<number>`COALESCE(${menuItems.priceCents}, CAST(round(${menuItems.price} * 100) AS integer)) / 100.0`,
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

  async getTakeawayEligibility(restaurantId: string): Promise<
    | { eligible: true; shopQrCode: string }
    | {
        eligible: false;
        reason: "restaurant_disabled" | "takeaway_disabled" | "closed_now";
      }
  > {
    const [restaurant] = await this.db
      .select({
        isActive: restaurants.isActive,
        deletedAt: restaurants.deletedAt,
        supportsTakeaway: restaurants.supportsTakeaway,
        enableShopMode: restaurants.enableShopMode,
        shopQrCode: restaurants.shopQrCode,
        businessHours: restaurants.businessHours,
      })
      .from(restaurants)
      .where(eq(restaurants.id, restaurantId))
      .limit(1);

    if (!restaurant || !restaurant.isActive || restaurant.deletedAt) {
      return { eligible: false, reason: "restaurant_disabled" };
    }
    if (
      !restaurant.supportsTakeaway ||
      !restaurant.enableShopMode ||
      !restaurant.shopQrCode
    ) {
      return { eligible: false, reason: "takeaway_disabled" };
    }
    if (!isOpenNow(restaurant.businessHours ?? null)) {
      return { eligible: false, reason: "closed_now" };
    }
    return { eligible: true, shopQrCode: restaurant.shopQrCode };
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
        priceCents: menuItems.priceCents,
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
             (menu_item_id, restaurant_id, dish_name, dish_name_normalized, category_name, price, price_cents, is_available, tags, district, restaurant_type, supports_takeaway, supports_delivery, primary_market_id, market_ids, latitude, longitude, updated_at_ms)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            item.menuItemId,
            item.restaurantId,
            item.name,
            normalized,
            item.categoryName,
            item.price,
            item.priceCents ?? toCents(item.price),
            isAvailable ? 1 : 0,
            JSON.stringify(itemTags),
            item.district,
            item.restaurantType,
            item.supportsTakeaway ? 1 : 0,
            item.supportsDelivery ? 1 : 0,
            item.primaryMarketId,
            item.marketIds ?? "[]",
            item.latitude,
            item.longitude,
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
        priceCents: dishSearchIndex.priceCents,
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
          price:
            row.priceCents != null
              ? fromCents(row.priceCents)
              : (row.price ?? 0),
        });
      }
    }
    await this.kv.put("search:tags:index", JSON.stringify(tagIndexMap), {
      expirationTtl: 30 * 60,
    });
    await this.bumpSearchVersion();

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

  private buildCacheKey(
    prefix: string,
    filters: SearchFilters,
    version = "0",
  ): string {
    const parts = [prefix];
    parts.push(`v:${version}`);
    if (filters.q) parts.push(this.normalizeQuery(filters.q));
    if (filters.city) parts.push(`c:${filters.city}`);
    if (filters.district) parts.push(`d:${filters.district}`);
    if (filters.categoryName) parts.push(`cat:${filters.categoryName}`);
    if (filters.sortBy) parts.push(`s:${filters.sortBy}`);
    if (filters.priceMin) parts.push(`pmin:${filters.priceMin}`);
    if (filters.priceMax) parts.push(`pmax:${filters.priceMax}`);
    if (filters.openNow) parts.push("open");
    if (filters.takeaway) parts.push("ta");
    if (filters.delivery) parts.push("dl");
    if (filters.marketId) parts.push(`m:${filters.marketId}`);
    if (filters.lat != null && filters.lng != null) {
      parts.push(`geo:${filters.lat},${filters.lng},${filters.radiusKm ?? 2}`);
    }
    parts.push(`p:${filters.page || 1}`);
    parts.push(`l:${filters.limit || 20}`);
    return parts.join(":");
  }

  private async getSearchVersion(): Promise<string> {
    return (await this.kv.get(KV_SEARCH_VERSION_KEY)) ?? "0";
  }

  private async bumpSearchVersion(): Promise<void> {
    await this.kv.put(KV_SEARCH_VERSION_KEY, String(Date.now()));
  }

  private getGeoFilter(filters: SearchFilters) {
    if (filters.lat == null || filters.lng == null) return null;
    const radiusKm = Math.min(Math.max(filters.radiusKm ?? 2, 0.1), 10);
    return {
      lat: filters.lat,
      lng: filters.lng,
      radiusKm,
      box: boundingBoxFromCircle(filters.lat, filters.lng, radiusKm),
    };
  }

  private getDishSearchOrderBy(
    filters: SearchFilters,
    effectivePrice: SQL<number>,
  ) {
    if (filters.sortBy === "popular") {
      return [desc(menuItems.orderCount), asc(effectivePrice)];
    }
    if (filters.sortBy === "price_desc") {
      return [desc(effectivePrice)];
    }
    return [asc(effectivePrice)];
  }
}
