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
  constructor(
    private db: D1Database,
    private kv: KVNamespace,
  ) {}

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

    const queryResult = await this.db
      .prepare(
        `SELECT dsi.menu_item_id, dsi.dish_name, dsi.price, dsi.category_name,
                dsi.restaurant_id, r.name as restaurant_name, dsi.district,
                r.business_hours, dsi.supports_takeaway, dsi.supports_delivery, dsi.tags
         FROM dish_search_index dsi
         JOIN restaurants r ON dsi.restaurant_id = r.id
         WHERE dsi.is_available = 1
         AND dsi.dish_name_normalized LIKE ?
         ${filters.district ? "AND dsi.district = ?" : ""}
         ${filters.priceMin !== undefined ? "AND dsi.price >= ?" : ""}
         ${filters.priceMax !== undefined ? "AND dsi.price <= ?" : ""}
         ${filters.takeaway ? "AND dsi.supports_takeaway = 1" : ""}
         ${filters.delivery ? "AND dsi.supports_delivery = 1" : ""}
         ORDER BY dsi.price ASC
         LIMIT ? OFFSET ?`,
      )
      .bind(...this.buildBindParams(normalized, filters, limit, offset))
      .all<{
        menu_item_id: number;
        dish_name: string;
        price: number;
        category_name: string | null;
        restaurant_id: string;
        restaurant_name: string;
        district: string | null;
        business_hours: string | null;
        supports_takeaway: number;
        supports_delivery: number;
        tags: string;
      }>();

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

    // Merge tag matches not already in prefix results
    const prefixIds = new Set(queryResult.results.map((r) => r.menu_item_id));
    if (tagMatches.length > 0) {
      const missingIds = tagMatches.filter((id) => !prefixIds.has(id));
      if (missingIds.length > 0) {
        const placeholders = missingIds.map(() => "?").join(",");
        const tagResults = await this.db
          .prepare(
            `SELECT dsi.menu_item_id, dsi.dish_name, dsi.price, dsi.category_name,
                    dsi.restaurant_id, r.name as restaurant_name, dsi.district,
                    r.business_hours, dsi.supports_takeaway, dsi.supports_delivery, dsi.tags
             FROM dish_search_index dsi
             JOIN restaurants r ON dsi.restaurant_id = r.id
             WHERE dsi.is_available = 1 AND dsi.menu_item_id IN (${placeholders})`,
          )
          .bind(...missingIds)
          .all<any>();
        queryResult.results.push(...tagResults.results);
      }
    }

    // 5. Map results + openNow filter
    let results: DishSearchResult[] = queryResult.results.map((row) => ({
      menuItemId: row.menu_item_id,
      dishName: row.dish_name,
      price: row.price,
      categoryName: row.category_name,
      restaurantId: row.restaurant_id,
      restaurantName: row.restaurant_name,
      district: row.district,
      isOpen: isOpenNow(
        row.business_hours ? JSON.parse(row.business_hours) : null,
      ),
      supportsTakeaway: !!row.supports_takeaway,
      supportsDelivery: !!row.supports_delivery,
      tags: row.tags ? JSON.parse(row.tags) : [],
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
        let restaurants: RestaurantListItem[] = JSON.parse(cached);
        if (filters.takeaway)
          restaurants = restaurants.filter((r) => r.supportsTakeaway);
        if (filters.delivery)
          restaurants = restaurants.filter((r) => r.supportsDelivery);
        if (filters.priceRange)
          restaurants = restaurants.filter(
            (r) => r.priceRange === filters.priceRange,
          );
        const start = (page - 1) * limit;
        return {
          results: restaurants.slice(start, start + limit),
          total: restaurants.length,
          page,
          limit,
        };
      }
    }

    const offset = (page - 1) * limit;

    const conditions: string[] = ["r.is_active = 1", "r.deleted_at_ms IS NULL"];
    const params: (string | number)[] = [];

    if (filters.district) {
      conditions.push("r.district = ?");
      params.push(filters.district);
    }
    if (filters.city) {
      conditions.push("r.city = ?");
      params.push(filters.city);
    }
    if (filters.cuisineType) {
      conditions.push("r.type = ?");
      params.push(filters.cuisineType);
    }
    if (filters.priceRange) {
      conditions.push("r.price_range = ?");
      params.push(filters.priceRange);
    }
    if (filters.takeaway) {
      conditions.push("r.supports_takeaway = 1");
    }
    if (filters.delivery) {
      conditions.push("r.supports_delivery = 1");
    }

    const orderBy =
      filters.sortBy === "rating" ? "r.rating DESC" : "r.total_orders DESC";

    const result = await this.db
      .prepare(
        `SELECT r.id, r.name, r.type, r.category, r.district, r.city,
                r.price_range, r.rating, r.business_hours,
                r.supports_takeaway, r.supports_delivery, r.logo_url
         FROM restaurants r
         WHERE ${conditions.join(" AND ")}
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`,
      )
      .bind(...params, limit, offset)
      .all<{
        id: string;
        name: string;
        type: string | null;
        category: string | null;
        district: string | null;
        city: string | null;
        price_range: number | null;
        rating: number | null;
        business_hours: string | null;
        supports_takeaway: number;
        supports_delivery: number;
        logo_url: string | null;
      }>();

    const restaurants: RestaurantListItem[] = result.results.map((row) => ({
      restaurantId: row.id,
      name: row.name,
      type: row.type,
      category: row.category,
      district: row.district,
      city: row.city,
      priceRange: row.price_range,
      rating: row.rating,
      isOpen: isOpenNow(
        row.business_hours ? JSON.parse(row.business_hours) : null,
      ),
      supportsTakeaway: !!row.supports_takeaway,
      supportsDelivery: !!row.supports_delivery,
      imageUrl: row.logo_url,
    }));

    // Cache district results in KV
    if (filters.district) {
      const kvKey = `search:restaurants:district:${filters.district}`;
      await this.kv.put(kvKey, JSON.stringify(restaurants), {
        expirationTtl: KV_RESTAURANT_TTL,
      });
    }

    let filtered = restaurants;
    if (filters.openNow) {
      filtered = restaurants.filter((r) => r.isOpen);
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
      .prepare(
        `SELECT dsi.menu_item_id, dsi.dish_name, dsi.price, dsi.category_name,
                dsi.restaurant_id, r.name as restaurant_name, dsi.district,
                r.business_hours, dsi.supports_takeaway, dsi.supports_delivery, dsi.tags,
                mi.order_count
         FROM dish_search_index dsi
         JOIN restaurants r ON dsi.restaurant_id = r.id
         JOIN menu_items mi ON dsi.menu_item_id = mi.id
         WHERE dsi.is_available = 1
         ORDER BY mi.order_count DESC
         LIMIT 10`,
      )
      .all<any>();

    const dishes: DishSearchResult[] = topDishes.results.map((row: any) => ({
      menuItemId: row.menu_item_id,
      dishName: row.dish_name,
      price: row.price,
      categoryName: row.category_name,
      restaurantId: row.restaurant_id,
      restaurantName: row.restaurant_name,
      district: row.district,
      isOpen: isOpenNow(
        row.business_hours ? JSON.parse(row.business_hours) : null,
      ),
      supportsTakeaway: !!row.supports_takeaway,
      supportsDelivery: !!row.supports_delivery,
      tags: row.tags ? JSON.parse(row.tags) : [],
    }));

    const topRestaurants = await this.browseRestaurants({
      sortBy: "popular",
      limit: 10,
    });

    return { keywords, dishes, restaurants: topRestaurants.results };
  }

  async reindex(): Promise<{
    dishes: number;
    restaurants: number;
    duration_ms: number;
  }> {
    const start = Date.now();

    const items = await this.db
      .prepare(
        `SELECT mi.id as menu_item_id, mi.name, mi.price, mi.is_available,
                mi.tags, mi.keywords, mi.deleted_at_ms,
                c.name as category_name,
                r.id as restaurant_id, r.district, r.type as restaurant_type,
                r.supports_takeaway, r.supports_delivery, r.deleted_at_ms as restaurant_deleted
         FROM menu_items mi
         LEFT JOIN categories c ON mi.category_id = c.id
         JOIN restaurants r ON mi.restaurant_id = r.id
         WHERE r.is_active = 1`,
      )
      .all<any>();

    let dishCount = 0;
    for (const item of items.results) {
      const isAvailable =
        item.is_available && !item.deleted_at_ms && !item.restaurant_deleted;
      const normalized = item.name.trim().toLowerCase().replace(/\s+/g, "");
      const tags = [
        ...(item.tags ? JSON.parse(item.tags) : []),
        ...(item.keywords ? JSON.parse(item.keywords) : []),
      ];

      await this.db
        .prepare(
          `INSERT OR REPLACE INTO dish_search_index
           (menu_item_id, restaurant_id, dish_name, dish_name_normalized, category_name, price, is_available, tags, district, restaurant_type, supports_takeaway, supports_delivery, updated_at_ms)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          item.menu_item_id,
          item.restaurant_id,
          item.name,
          normalized,
          item.category_name,
          item.price,
          isAvailable ? 1 : 0,
          JSON.stringify(tags),
          item.district,
          item.restaurant_type,
          item.supports_takeaway ? 1 : 0,
          item.supports_delivery ? 1 : 0,
          Date.now(),
        )
        .run();
      dishCount++;
    }

    await this.db
      .prepare(
        `DELETE FROM dish_search_index WHERE menu_item_id NOT IN (SELECT id FROM menu_items)`,
      )
      .run();

    // Rebuild KV tag index
    const allTags = await this.db
      .prepare(
        "SELECT menu_item_id, restaurant_id, dish_name, price, tags FROM dish_search_index WHERE is_available = 1",
      )
      .all<{
        menu_item_id: number;
        restaurant_id: string;
        dish_name: string;
        price: number;
        tags: string;
      }>();

    const tagIndex: Record<
      string,
      { menuItemId: number; restaurantId: string; dishName: string; price: number }[]
    > = {};
    for (const row of allTags.results) {
      const tags: string[] = row.tags ? JSON.parse(row.tags) : [];
      for (const tag of tags) {
        const normalizedTag = tag.trim().toLowerCase();
        if (!tagIndex[normalizedTag]) tagIndex[normalizedTag] = [];
        tagIndex[normalizedTag].push({
          menuItemId: row.menu_item_id,
          restaurantId: row.restaurant_id,
          dishName: row.dish_name,
          price: row.price,
        });
      }
    }
    await this.kv.put("search:tags:index", JSON.stringify(tagIndex), {
      expirationTtl: 30 * 60,
    });

    const duration_ms = Date.now() - start;
    return { dishes: dishCount, restaurants: items.results.length, duration_ms };
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
    return parts.join(":");
  }

  private buildBindParams(
    normalized: string,
    filters: SearchFilters,
    limit: number,
    offset: number,
  ): (string | number)[] {
    const params: (string | number)[] = [`${normalized}%`];
    if (filters.district) params.push(filters.district);
    if (filters.priceMin !== undefined) params.push(filters.priceMin);
    if (filters.priceMax !== undefined) params.push(filters.priceMax);
    params.push(limit, offset);
    return params;
  }
}
