import {
  eq,
  and,
  desc,
  asc,
  count,
  gt,
  sql,
  isNull,
  inArray,
} from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { BaseService } from "./base";
import { restaurants, categories, menuItems } from "../schema";
import type {
  MenuStructure,
  MenuItem,
  Category,
} from "@makanmakan/shared-types";
import { amountFromCents, toCents, toRequiredCents } from "../utils/money";

export interface CreateMenuItemData {
  restaurantId: string;
  categoryId: number;
  catalogType?: "menu_item" | "product";
  name: string;
  nameEn?: string | null;
  description?: string | null;
  ingredients?: string | null;
  price: number;
  originalPrice?: number | null;
  imageUrl?: string | null;
  imageVariants?: any;
  imageId?: string | null;
  isAvailable?: boolean;
  isFeatured?: boolean;
  isPopular?: boolean;
  sortOrder?: number;
  inventoryCount?: number;
  spiceLevel?: number;
  preparationTime?: number;
  calories?: number | null;
  dietaryInfo?: any;
  allergens?: string[];
  options?: any;
  availableHours?: any;
  tags?: string[];
  keywords?: string | null;
}

export interface UpdateMenuItemData extends Partial<CreateMenuItemData> {
  isAvailable?: boolean;
  isFeatured?: boolean;
  isPopular?: boolean;
  sortOrder?: number;
  inventoryCount?: number;
  rating?: number;
}

export interface MenuFilters {
  categoryId?: number;
  priceRange?: [number, number];
  spiceLevel?: number;
  dietaryPreferences?: string[];
  isAvailable?: boolean;
  isFeatured?: boolean;
  search?: string;
}

/** Shared select columns for menu item queries — avoids triplicating the 20-column list */
export const menuItemSelectColumns = {
  id: menuItems.id,
  restaurantId: menuItems.restaurantId,
  categoryId: menuItems.categoryId,
  catalogType: menuItems.catalogType,
  name: menuItems.name,
  nameEn: menuItems.nameEn,
  description: menuItems.description,
  ingredients: menuItems.ingredients,
  priceCents: menuItems.priceCents,
  originalPriceCents: menuItems.originalPriceCents,
  costPriceCents: menuItems.costPriceCents,
  imageUrl: menuItems.imageUrl,
  imageVariants: menuItems.imageVariants,
  imageId: menuItems.imageId,
  isAvailable: menuItems.isAvailable,
  isFeatured: menuItems.isFeatured,
  isPopular: menuItems.isPopular,
  sortOrder: menuItems.sortOrder,
  inventoryCount: menuItems.inventoryCount,
  minInventoryAlert: menuItems.minInventoryAlert,
  spiceLevel: menuItems.spiceLevel,
  preparationTime: menuItems.preparationTime,
  calories: menuItems.calories,
  dietaryInfo: menuItems.dietaryInfo,
  allergens: menuItems.allergens,
  options: menuItems.options,
  availableHours: menuItems.availableHours,
  tags: menuItems.tags,
  keywords: menuItems.keywords,
  orderCount: menuItems.orderCount,
  rating: menuItems.rating,
  // viewCount/reviewCount were never selected, so every consumer saw the
  // hardcoded 0 that transformMenuItem used to supply — which made
  // getMostViewedItems sort by a constant even though incrementViewCount
  // writes real values (#84).
  reviewCount: menuItems.reviewCount,
  viewCount: menuItems.viewCount,
  createdAt: menuItems.createdAt,
  updatedAt: menuItems.updatedAt,
} as const;

export function mapMenuCategoryRow(cat: any): Category {
  return {
    id: cat.id,
    restaurantId: cat.restaurantId,
    name: cat.name,
    nameEn: cat.nameEn ?? null,
    description: cat.description,
    sortOrder: cat.sortOrder,
    status: cat.isActive ? 1 : 0, // Convert boolean to Status enum
    // `status` alone collapses two independent flags, so a category hidden via
    // isVisible looked identical to a visible one and the admin UI had nothing
    // to render a "hidden" state from (#83).
    isActive: cat.isActive,
    isVisible: cat.isVisible,
    imageUrl: cat.imageUrl,
    itemCount:
      "itemCount" in cat
        ? cat.itemCount
        : Array.isArray(cat.menuItems)
          ? cat.menuItems.length
          : undefined,
    createdAt: cat.createdAt,
    updatedAt: cat.updatedAt,
  };
}

export function mapDatabaseMenuItem(item: any): MenuItem {
  return {
    id: item.id,
    restaurantId: item.restaurantId,
    categoryId: item.categoryId,
    catalogType: item.catalogType ?? "menu_item",
    name: item.name,
    nameEn: item.nameEn ?? null,
    description: item.description,
    ingredients: item.ingredients,
    price: amountFromCents(item.priceCents),
    originalPrice: amountFromCents(item.originalPriceCents),
    costPrice: amountFromCents(item.costPriceCents),
    imageUrl: item.imageUrl,
    imageVariants: item.imageVariants,
    imageId: item.imageId,
    isAvailable: item.isAvailable,
    isFeatured: item.isFeatured,
    isPopular: item.isPopular,
    sortOrder: item.sortOrder,
    inventoryCount: item.inventoryCount,
    minInventoryAlert: item.minInventoryAlert,
    spiceLevel: item.spiceLevel,
    preparationTime: item.preparationTime,
    calories: item.calories,
    dietaryInfo: item.dietaryInfo,
    allergens: item.allergens,
    options: item.options,
    availableHours: item.availableHours,
    tags: item.tags,
    keywords: item.keywords,
    orderCount: item.orderCount,
    // rating/reviewCount/viewCount were dropped here, so every rating- and
    // view-based ranking upstream saw undefined/0 (#84).
    rating: item.rating ?? 0,
    reviewCount: item.reviewCount ?? 0,
    viewCount: item.viewCount ?? 0,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  } as MenuItem;
}

const DIETARY_PREFERENCE_KEYS = [
  "vegetarian",
  "vegan",
  "halal",
  "glutenFree",
  "dairyFree",
  "nutFree",
  "seafoodFree",
  "organic",
  "localSource",
] as const;

/**
 * A category that has not been soft-deleted — the single marker every read
 * agrees on, so the delete path has exactly one column to write
 * (softDeleteCategory).
 */
const notDeletedCategory = isNull(categories.deletedAt);

const publicCategoryConditions = [
  eq(categories.isActive, true),
  eq(categories.isVisible, true),
  notDeletedCategory,
];

/**
 * Category visibility for the admin/owner menu read.
 *
 * The owner has to be able to see what they hid, otherwise setting
 * isVisible:false on a category made it — and every item in it — vanish from
 * their own dashboard with no way back (#83). Soft-deleted rows stay excluded:
 * "deleted" is not a state the menu editor is meant to resurrect.
 */
const adminCategoryConditions = [notDeletedCategory];

/**
 * A menu item that has not been soft-deleted.
 *
 * Deletion used to be signalled by `sortOrder: -1` + `isAvailable: false` while
 * the real `deleted_at_ms` column sat unwritten and unqueried, so deleted items
 * still counted everywhere that didn't know the sortOrder convention — most
 * visibly deleteCategory's "category has items" check, which blocked emptied
 * categories from ever being deleted (#80). Every item read must carry this.
 */
const notDeletedItem = isNull(menuItems.deletedAt);

export class MenuService extends BaseService {
  // 獲取完整菜單結構
  async getMenu(
    restaurantId: string,
    options?: { includeUnavailable?: boolean },
  ): Promise<MenuStructure> {
    try {
      const includeAll = options?.includeUnavailable ?? false;
      // Use query cache with 1 hour TTL for menu data
      const cacheKey = this.buildCacheKey(
        "menu",
        restaurantId,
        includeAll ? "admin" : "full",
      );

      return await this.cachedQuery(
        cacheKey,
        async () => {
          const restaurant = await this.db.query.restaurants.findFirst({
            where: eq(restaurants.id, restaurantId),
            with: {
              categories: {
                // `includeAll` used to relax only item visibility, so hidden
                // categories were dropped even for the owner (#83). The cache
                // key above already discriminates "admin" from "full", so the
                // relaxed result cannot be served to a public reader.
                where: and(
                  ...(includeAll
                    ? adminCategoryConditions
                    : publicCategoryConditions),
                ),
                orderBy: asc(categories.sortOrder),
                with: {
                  menuItems: {
                    // Soft-deleted items are invisible to BOTH audiences —
                    // includeAll widens to unavailable items, never to deleted
                    // ones (#80).
                    where: includeAll
                      ? notDeletedItem
                      : and(eq(menuItems.isAvailable, true), notDeletedItem),
                    orderBy: [asc(menuItems.sortOrder), asc(menuItems.name)],
                  },
                },
              },
            },
          });

          if (!restaurant) {
            throw new Error("Restaurant not found");
          }

          // Item counts are derived live from the loaded rows. There is no
          // stored categories.item_count any more — it only ever tracked
          // creates, so deletes/toggles/moves left it stale (#84).
          return {
            categories: restaurant.categories.map((cat: any) =>
              mapMenuCategoryRow(cat),
            ),
            menuItems: restaurant.categories.flatMap((cat: any) =>
              cat.menuItems.map((item: any) => this.mapToMenuItem(item)),
            ),
          };
        },
        {
          // 5 minutes, not the old hour: tag invalidation is the primary
          // freshness mechanism, but when it misses (concurrent write races,
          // lost tag mappings) the TTL is the ceiling on how long a customer
          // sees a menu the owner already changed (#82).
          ttl: 300,
          tags: [`menu:${restaurantId}`, `restaurant:${restaurantId}`],
        },
      );
    } catch (error) {
      this.handleError(error, "getMenu");
    }
  }

  // 獲取特色菜品
  async getFeaturedItems(
    restaurantId: string,
    limit: number = 10,
  ): Promise<MenuItem[]> {
    try {
      const items = await this.db
        .select(menuItemSelectColumns)
        .from(menuItems)
        .innerJoin(categories, eq(menuItems.categoryId, categories.id))
        .where(
          and(
            eq(menuItems.restaurantId, restaurantId),
            eq(menuItems.isFeatured, true),
            eq(menuItems.isAvailable, true),
            notDeletedItem,
            ...publicCategoryConditions,
          ),
        )
        .orderBy(desc(menuItems.orderCount), desc(menuItems.rating))
        .limit(limit);

      return items.map((item) => this.mapToMenuItem(item));
    } catch (error) {
      this.handleError(error, "getFeaturedItems");
    }
  }

  // 獲取熱門菜品
  async getPopularItems(
    restaurantId: string,
    limit: number = 10,
  ): Promise<MenuItem[]> {
    try {
      const items = await this.db
        .select(menuItemSelectColumns)
        .from(menuItems)
        .innerJoin(categories, eq(menuItems.categoryId, categories.id))
        .where(
          and(
            eq(menuItems.restaurantId, restaurantId),
            eq(menuItems.isAvailable, true),
            notDeletedItem,
            ...publicCategoryConditions,
          ),
        )
        .orderBy(desc(menuItems.orderCount), desc(menuItems.rating))
        .limit(limit);

      return items.map((item) => this.mapToMenuItem(item));
    } catch (error) {
      this.handleError(error, "getPopularItems");
    }
  }

  /**
   * Top-N by view count.
   *
   * The three Top-N lists below exist because the API layer used to fetch a
   * page of `limit` rows through searchMenuItems() — which applies its own
   * ordering (isFeatured, orderCount, sortOrder) — and then re-sorted those
   * rows in JS. On any menu larger than `limit` that produced a Top-N drawn
   * from the wrong candidate set (#84). ORDER BY / LIMIT must be in SQL.
   *
   * These are customer-facing popularity lists, so they keep the same
   * innerJoin(categories) + publicCategoryConditions gate as
   * getPopularItems/getFeaturedItems.
   */
  async getMostViewedItems(
    restaurantId: string,
    limit: number = 10,
  ): Promise<MenuItem[]> {
    try {
      const items = await this.db
        .select(menuItemSelectColumns)
        .from(menuItems)
        .innerJoin(categories, eq(menuItems.categoryId, categories.id))
        .where(
          and(
            eq(menuItems.restaurantId, restaurantId),
            eq(menuItems.isAvailable, true),
            notDeletedItem,
            ...publicCategoryConditions,
          ),
        )
        .orderBy(desc(menuItems.viewCount), desc(menuItems.orderCount))
        .limit(limit);

      return items.map((item) => this.mapToMenuItem(item));
    } catch (error) {
      this.handleError(error, "getMostViewedItems");
    }
  }

  /**
   * Top-N by rating. The `rating > 0` filter is applied in SQL so `limit` rows
   * are actually returned — filtering after the slice silently shrank the list.
   */
  async getHighestRatedItems(
    restaurantId: string,
    limit: number = 10,
  ): Promise<MenuItem[]> {
    try {
      const items = await this.db
        .select(menuItemSelectColumns)
        .from(menuItems)
        .innerJoin(categories, eq(menuItems.categoryId, categories.id))
        .where(
          and(
            eq(menuItems.restaurantId, restaurantId),
            eq(menuItems.isAvailable, true),
            notDeletedItem,
            gt(menuItems.rating, 0),
            ...publicCategoryConditions,
          ),
        )
        .orderBy(desc(menuItems.rating), desc(menuItems.reviewCount))
        .limit(limit);

      return items.map((item) => this.mapToMenuItem(item));
    } catch (error) {
      this.handleError(error, "getHighestRatedItems");
    }
  }

  /** Top-N most recently created items. */
  async getRecentlyAddedItems(
    restaurantId: string,
    limit: number = 10,
  ): Promise<MenuItem[]> {
    try {
      const items = await this.db
        .select(menuItemSelectColumns)
        .from(menuItems)
        .innerJoin(categories, eq(menuItems.categoryId, categories.id))
        .where(
          and(
            eq(menuItems.restaurantId, restaurantId),
            eq(menuItems.isAvailable, true),
            notDeletedItem,
            ...publicCategoryConditions,
          ),
        )
        .orderBy(desc(menuItems.createdAt), desc(menuItems.id))
        .limit(limit);

      return items.map((item) => this.mapToMenuItem(item));
    } catch (error) {
      this.handleError(error, "getRecentlyAddedItems");
    }
  }

  // 搜尋菜品
  async searchMenuItems(
    restaurantId: string,
    filters: MenuFilters,
    page: number = 1,
    limit: number = 20,
  ) {
    try {
      const { offset } = this.createPagination(page, limit);
      const conditions = [
        eq(menuItems.restaurantId, restaurantId),
        notDeletedItem,
        ...publicCategoryConditions,
      ];

      // 建構查詢條件
      if (filters.categoryId) {
        conditions.push(eq(menuItems.categoryId, filters.categoryId));
      }

      if (filters.priceRange) {
        const [minPrice, maxPrice] = filters.priceRange;
        conditions.push(
          and(
            sql`${menuItems.priceCents} >= ${toRequiredCents(minPrice)}`,
            sql`${menuItems.priceCents} <= ${toRequiredCents(maxPrice)}`,
          )!,
        );
      }

      if (filters.spiceLevel !== undefined) {
        conditions.push(eq(menuItems.spiceLevel, filters.spiceLevel));
      }

      if (filters.isAvailable !== undefined) {
        conditions.push(eq(menuItems.isAvailable, filters.isAvailable));
      }

      if (filters.isFeatured !== undefined) {
        conditions.push(eq(menuItems.isFeatured, filters.isFeatured));
      }

      if (filters.search) {
        conditions.push(
          sql`(${menuItems.name} LIKE ${`%${filters.search}%`} OR ${menuItems.description} LIKE ${`%${filters.search}%`} OR ${menuItems.keywords} LIKE ${`%${filters.search}%`})`,
        );
      }

      // 飲食偏好篩選
      if (filters.dietaryPreferences?.length) {
        const dietaryConditions = filters.dietaryPreferences
          .filter((pref) =>
            (DIETARY_PREFERENCE_KEYS as readonly string[]).includes(pref),
          )
          .map(
            (pref) =>
              sql`json_extract(${menuItems.dietaryInfo}, ${`$.${pref}`}) = true`,
          );
        if (dietaryConditions.length > 0) {
          conditions.push(sql`(${sql.join(dietaryConditions, sql` OR `)})`);
        }
      }

      // 查詢結果
      const items = await this.db
        .select(menuItemSelectColumns)
        .from(menuItems)
        .innerJoin(categories, eq(menuItems.categoryId, categories.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(
          desc(menuItems.isFeatured),
          desc(menuItems.orderCount),
          asc(menuItems.sortOrder),
        )
        .limit(limit)
        .offset(offset);

      // 查詢總數 (使用安全解構避免 undefined 錯誤)
      const countResult = await this.db
        .select({ totalCount: count() })
        .from(menuItems)
        .innerJoin(categories, eq(menuItems.categoryId, categories.id))
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const totalCount = countResult?.[0]?.totalCount ?? 0;

      return {
        items: items.map((item) => this.mapToMenuItem(item)),
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      this.handleError(error, "searchMenuItems");
    }
  }

  /** Row shape for an insert, with the money columns and flag defaults applied. */
  private toMenuItemInsertValues(data: CreateMenuItemData) {
    const { price, originalPrice, ...insertData } = data;
    return {
      ...insertData,
      priceCents: toRequiredCents(price),
      originalPriceCents: toCents(originalPrice),
      isAvailable: data.isAvailable !== undefined ? data.isAvailable : true, // Default: available
      isFeatured: data.isFeatured !== undefined ? data.isFeatured : false,
      isPopular: data.isPopular !== undefined ? data.isPopular : false,
    };
  }

  /**
   * Create many items in one implicit transaction.
   *
   * The CSV import used to POST one item at a time from the browser, so a batch
   * that failed on row 7 left rows 1-6 committed, told the owner only that
   * "something failed", and duplicated everything on retry because the menu has
   * no name uniqueness (#85). db.batch() is the atomic primitive available here
   * — D1 exposes no db.transaction() — so the whole array lands or none of it
   * does and a retry is safe.
   *
   * One statement per row rather than a single multi-row INSERT on purpose: D1
   * caps bound parameters per query at 100, and 100 rows x ~25 columns would
   * blow straight through it.
   */
  async bulkCreateMenuItems(items: CreateMenuItemData[]): Promise<MenuItem[]> {
    if (items.length === 0) return [];

    try {
      const statements = items.map(
        (item) =>
          this.db
            .insert(menuItems)
            .values(this.toMenuItemInsertValues(item))
            .returning() as BatchItem<"sqlite">,
      ) as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]];

      // Each statement's result is its own RETURNING row set; the tuple type is
      // erased by the cast above, so validate before treating it as data.
      const results = this.assertBulkCreateBatchResult(
        await this.db.batch(statements),
        items.length,
      );

      const restaurantIds = new Set(items.map((item) => item.restaurantId));
      await Promise.all(
        [...restaurantIds].map((restaurantId) =>
          this.invalidateCache(
            [`menu:${restaurantId}`, `restaurant:${restaurantId}`],
            "tag",
          ),
        ),
      );

      return results.flatMap((rows) =>
        rows.map((row) => this.mapToMenuItem(row)),
      );
    } catch (error) {
      this.handleError(error, "bulkCreateMenuItems");
    }
  }

  private assertBulkCreateBatchResult(
    result: unknown,
    expectedStatementCount: number,
  ): Array<Array<typeof menuItems.$inferSelect>> {
    const message =
      "Unexpected db.batch returning shape for bulkCreateMenuItems";

    if (!Array.isArray(result) || result.length !== expectedStatementCount) {
      throw new Error(message);
    }

    for (const rows of result) {
      if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error(message);
      }

      for (const row of rows) {
        if (
          row === null ||
          typeof row !== "object" ||
          typeof (row as { id?: unknown }).id !== "number" ||
          typeof (row as { restaurantId?: unknown }).restaurantId !==
            "string" ||
          typeof (row as { categoryId?: unknown }).categoryId !== "number" ||
          typeof (row as { priceCents?: unknown }).priceCents !== "number"
        ) {
          throw new Error(message);
        }
      }
    }

    return result as Array<Array<typeof menuItems.$inferSelect>>;
  }

  // 創建菜單項目
  async createMenuItem(data: CreateMenuItemData): Promise<MenuItem> {
    try {
      const [item] = await this.db
        .insert(menuItems)
        .values(this.toMenuItemInsertValues(data))
        .returning();

      // No stored category item count to maintain — getMenu derives it live.
      // The old updateCategoryItemCount() call here was the only writer, which
      // is exactly why the stored column drifted on every other mutation (#84).

      // Invalidate menu cache for this restaurant
      await this.invalidateCache(
        [`menu:${data.restaurantId}`, `restaurant:${data.restaurantId}`],
        "tag",
      );

      return this.mapToMenuItem(item);
    } catch (error) {
      this.handleError(error, "createMenuItem");
    }
  }

  // 更新菜單項目
  async updateMenuItem(
    id: number,
    data: UpdateMenuItemData,
  ): Promise<MenuItem> {
    try {
      const { price, originalPrice, ...updateData } = data;
      const [item] = await this.db
        .update(menuItems)
        .set({
          ...updateData,
          ...(price !== undefined
            ? { priceCents: toRequiredCents(price) }
            : {}),
          ...(originalPrice !== undefined
            ? { originalPriceCents: toCents(originalPrice) }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(menuItems.id, id))
        .returning();

      if (!item) {
        throw new Error("Menu item not found");
      }

      // Invalidate menu cache for this restaurant
      await this.invalidateCache(
        [`menu:${item.restaurantId}`, `restaurant:${item.restaurantId}`],
        "tag",
      );

      return this.mapToMenuItem(item);
    } catch (error) {
      this.handleError(error, "updateMenuItem");
    }
  }

  /**
   * Soft-delete: write the column that exists for this (#80).
   *
   * The old marker was `sortOrder: -1` + `isAvailable: false`, which only the
   * admin item list knew to filter, which any sort-order write could silently
   * undo, and which the update schema (sortOrder min 0) could never set back —
   * while `deleted_at_ms` sat unwritten. isAvailable is still flipped so any
   * reader that predates the deletedAt filters keeps hiding the row.
   *
   * Idempotent: deleting an already-deleted row keeps the original timestamp.
   */
  async softDeleteMenuItem(id: number): Promise<boolean> {
    try {
      const [item] = await this.db
        .update(menuItems)
        .set({
          deletedAt: new Date(),
          isAvailable: false,
          updatedAt: new Date(),
        })
        .where(and(eq(menuItems.id, id), notDeletedItem))
        .returning({
          id: menuItems.id,
          restaurantId: menuItems.restaurantId,
        });

      if (!item) {
        return false;
      }

      await this.invalidateCache(
        [`menu:${item.restaurantId}`, `restaurant:${item.restaurantId}`],
        "tag",
      );

      return true;
    } catch (error) {
      this.handleError(error, "softDeleteMenuItem");
    }
  }

  // 批量更新菜品可用性
  async batchUpdateAvailability(
    restaurantId: string,
    updates: { id: number; isAvailable: boolean }[],
  ): Promise<void> {
    try {
      for (const update of updates) {
        await this.db
          .update(menuItems)
          .set({
            isAvailable: update.isAvailable,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(menuItems.id, update.id),
              eq(menuItems.restaurantId, restaurantId),
            ),
          );
      }

      // Invalidate menu cache after batch update
      await this.invalidateCache(
        [`menu:${restaurantId}`, `restaurant:${restaurantId}`],
        "tag",
      );
    } catch (error) {
      this.handleError(error, "batchUpdateAvailability");
    }
  }

  /**
   * Which of `ids` actually belong to `restaurantId`.
   *
   * Callers use this to reject a whole batch before touching anything, rather
   * than relying on a scoped WHERE to silently skip foreign rows — a skip looks
   * identical to success from the outside, and the caller would report that it
   * had updated items it never touched.
   */
  async findOwnedMenuItemIds(
    restaurantId: string,
    ids: number[],
  ): Promise<Set<number>> {
    if (ids.length === 0) return new Set();

    try {
      const rows = await this.db
        .select({ id: menuItems.id })
        .from(menuItems)
        .where(
          and(
            eq(menuItems.restaurantId, restaurantId),
            inArray(menuItems.id, ids),
            // Deleted items are not batch-updatable — a bulk price or
            // availability write must not touch them (#80).
            notDeletedItem,
          ),
        );

      return new Set(rows.map((row) => row.id));
    } catch (error) {
      this.handleError(error, "findOwnedMenuItemIds");
      return new Set();
    }
  }

  /**
   * Current price + originalPrice for a set of items, in one query.
   *
   * Exists for the batch price endpoint's negative-discount check (#81): an
   * update that sends only `price` has to be compared against the STORED
   * originalPrice, which the request schema cannot see.
   */
  async getMenuItemPrices(
    restaurantId: string,
    ids: number[],
  ): Promise<Map<number, { price: number; originalPrice: number | null }>> {
    if (ids.length === 0) return new Map();

    try {
      const rows = await this.db
        .select({
          id: menuItems.id,
          priceCents: menuItems.priceCents,
          originalPriceCents: menuItems.originalPriceCents,
        })
        .from(menuItems)
        .where(
          and(
            eq(menuItems.restaurantId, restaurantId),
            inArray(menuItems.id, ids),
            notDeletedItem,
          ),
        );

      return new Map(
        rows.map((row) => [
          row.id,
          {
            price: amountFromCents(row.priceCents) ?? 0,
            originalPrice: amountFromCents(row.originalPriceCents),
          },
        ]),
      );
    } catch (error) {
      this.handleError(error, "getMenuItemPrices");
    }
  }

  /**
   * Which of `ids` are categories of `restaurantId` — the category counterpart
   * of findOwnedMenuItemIds, in one query rather than one per id.
   *
   * Soft-deleted categories are excluded: an item must not be filed under a
   * category the owner has removed.
   */
  async findOwnedCategoryIds(
    restaurantId: string,
    ids: number[],
  ): Promise<Set<number>> {
    if (ids.length === 0) return new Set();

    try {
      const rows = await this.db
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.restaurantId, restaurantId),
            inArray(categories.id, ids),
            notDeletedCategory,
          ),
        );

      return new Set(rows.map((row) => row.id));
    } catch (error) {
      this.handleError(error, "findOwnedCategoryIds");
    }
  }

  /**
   * Batch price update, scoped to one restaurant and applied atomically.
   *
   * Both the scoping and the atomicity matter. The service layer used to call
   * updateMenuItem() in a loop, whose WHERE was `eq(menuItems.id, id)` with no
   * restaurant condition, so any owner could rewrite another restaurant's
   * prices by putting foreign item ids in the request body (#77). And because
   * each iteration awaited separately with no transaction, a failure midway
   * left some prices changed and others not.
   */
  async batchUpdatePricesScoped(
    restaurantId: string,
    updates: { id: number; price: number; originalPrice?: number | null }[],
  ): Promise<void> {
    if (updates.length === 0) return;

    try {
      const now = new Date();
      const statements = updates.map(
        (update) =>
          this.db
            .update(menuItems)
            .set({
              priceCents: toRequiredCents(update.price),
              ...(update.originalPrice !== undefined
                ? { originalPriceCents: toCents(update.originalPrice) }
                : {}),
              updatedAt: now,
            })
            .where(
              and(
                eq(menuItems.id, update.id),
                eq(menuItems.restaurantId, restaurantId),
              ),
            ) as BatchItem<"sqlite">,
      ) as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]];

      await this.db.batch(statements);

      await this.invalidateCache(
        [`menu:${restaurantId}`, `restaurant:${restaurantId}`],
        "tag",
      );
    } catch (error) {
      this.handleError(error, "batchUpdatePricesScoped");
    }
  }

  /**
   * Batch category move, scoped and atomic for the same reasons as
   * batchUpdatePricesScoped.
   *
   * getMenu() resolves items through restaurant -> categories -> menuItems and
   * never reads menuItems.restaurantId, so an unscoped move was enough to make
   * another restaurant's item appear on your public menu and disappear from
   * theirs, with no way for them to see or undo it (#77).
   */
  async batchMoveItemsScoped(
    restaurantId: string,
    moves: { id: number; categoryId: number }[],
  ): Promise<void> {
    if (moves.length === 0) return;

    try {
      const now = new Date();
      const statements = moves.map(
        (move) =>
          this.db
            .update(menuItems)
            .set({ categoryId: move.categoryId, updatedAt: now })
            .where(
              and(
                eq(menuItems.id, move.id),
                eq(menuItems.restaurantId, restaurantId),
              ),
            ) as BatchItem<"sqlite">,
      ) as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]];

      await this.db.batch(statements);

      await this.invalidateCache(
        [`menu:${restaurantId}`, `restaurant:${restaurantId}`],
        "tag",
      );
    } catch (error) {
      this.handleError(error, "batchMoveItemsScoped");
    }
  }

  // 更新菜品點餐次數
  async incrementOrderCount(
    menuItemId: number,
    increment: number = 1,
  ): Promise<void> {
    try {
      await this.db
        .update(menuItems)
        .set({
          orderCount: sql`${menuItems.orderCount} + ${increment}`,
          updatedAt: new Date(),
        })
        .where(eq(menuItems.id, menuItemId));
    } catch (error) {
      this.handleError(error, "incrementOrderCount");
    }
  }

  // 更新菜品瀏覽次數
  async incrementViewCount(menuItemId: number): Promise<void> {
    try {
      await this.db
        .update(menuItems)
        .set({
          viewCount: sql`${menuItems.viewCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(menuItems.id, menuItemId));
    } catch (error) {
      this.handleError(error, "incrementViewCount");
    }
  }

  // 獲取菜品詳情
  async getMenuItem(id: number): Promise<MenuItem | null> {
    try {
      const item = await this.db.query.menuItems.findFirst({
        // A deleted item reads as absent — otherwise the update path could
        // load it and resurrect it (#80).
        where: and(eq(menuItems.id, id), notDeletedItem),
        with: {
          category: true,
          restaurant: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });

      return item ? this.mapToMenuItem(item) : null;
    } catch (error) {
      this.handleError(error, "getMenuItem");
    }
  }

  // 創建或更新分類
  async createCategory(data: {
    restaurantId: string;
    name: string;
    nameEn?: string | null;
    description?: string | null;
    sortOrder?: number;
    imageUrl?: string | null;
  }) {
    try {
      const [category] = await this.db
        .insert(categories)
        .values(data)
        .returning();

      // Invalidate menu cache for this restaurant
      await this.invalidateCache(
        [`menu:${data.restaurantId}`, `restaurant:${data.restaurantId}`],
        "tag",
      );

      return category;
    } catch (error) {
      this.handleError(error, "createCategory");
    }
  }

  async reorderCategories(
    restaurantId: string,
    updates: Array<{ id: number; sortOrder: number }>,
  ): Promise<void> {
    try {
      for (const { id, sortOrder } of updates) {
        await this.db
          .update(categories)
          .set({ sortOrder, updatedAt: new Date() })
          .where(
            and(
              eq(categories.id, id),
              eq(categories.restaurantId, restaurantId),
            ),
          );
      }

      await this.invalidateCache(
        [`menu:${restaurantId}`, `restaurant:${restaurantId}`],
        "tag",
      );
    } catch (error) {
      this.handleError(error, "reorderCategories");
    }
  }

  // 更新分類
  async updateCategory(
    id: number,
    data: Partial<{
      name: string;
      nameEn: string | null;
      description: string;
      sortOrder: number;
      isActive: boolean;
      isVisible: boolean;
      imageUrl: string;
    }>,
  ) {
    try {
      const [updated] = await this.db
        .update(categories)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(categories.id, id))
        .returning();

      if (!updated) {
        throw new Error("Category not found");
      }

      // Invalidate menu cache for this restaurant
      await this.invalidateCache(
        [`menu:${updated.restaurantId}`, `restaurant:${updated.restaurantId}`],
        "tag",
      );

      return updated;
    } catch (error) {
      this.handleError(error, "updateCategory");
    }
  }

  // 獲取分類詳情
  async getCategory(id: number) {
    try {
      const category = await this.db.query.categories.findFirst({
        // A soft-deleted category reads as absent, exactly as getMenuItem
        // treats a deleted item. Every caller wants that: the edit and delete
        // routes should 404 rather than let an owner keep editing something
        // they removed, and validateCategoryAccess must not let a new item be
        // filed under it (findOwnedCategoryIds already refuses).
        where: and(eq(categories.id, id), notDeletedCategory),
      });

      return category || null;
    } catch (error) {
      this.handleError(error, "getCategory");
    }
  }

  /**
   * Soft-delete a category by writing the column the read paths filter on.
   *
   * deleteCategory used to mark removal with `isActive: false` while the
   * admin menu read filters categories on `deleted_at_ms` alone
   * (adminCategoryConditions, added for #83). The two never agreed, so a
   * deleted category came straight back on the next fetch — badged "hidden",
   * indistinguishable from one the owner had merely hidden, and impossible to
   * remove because every repeat delete answered 200 and changed nothing.
   *
   * This is the same defect #80 fixed one level down: the delete path has to
   * write the marker the read path filters on. isActive is still cleared so
   * publicCategoryConditions keeps hiding the row for any reader that predates
   * the deletedAt filter.
   *
   * Idempotent: deleting an already-deleted category matches nothing and
   * returns false, which the route turns into a 404.
   */
  async softDeleteCategory(id: number): Promise<boolean> {
    try {
      const [category] = await this.db
        .update(categories)
        .set({
          deletedAt: new Date(),
          isActive: false,
          updatedAt: new Date(),
        })
        .where(and(eq(categories.id, id), notDeletedCategory))
        .returning({
          id: categories.id,
          restaurantId: categories.restaurantId,
        });

      if (!category) {
        return false;
      }

      await this.invalidateCache(
        [
          `menu:${category.restaurantId}`,
          `restaurant:${category.restaurantId}`,
        ],
        "tag",
      );

      return true;
    } catch (error) {
      this.handleError(error, "softDeleteCategory");
    }
  }

  /**
   * How many live items sit in one category.
   *
   * Exists because deleteCategory's "is this category empty?" guard used to ask
   * searchMenuItems(), which carries publicCategoryConditions — conditions on
   * the CATEGORY, not the items. A category with isVisible:false (a supported
   * state since #83) therefore counted zero items no matter what it held, and
   * the guard waved through the deletion of a category full of on-sale dishes.
   *
   * Counts by category id only: the question is "does this category hold
   * anything", so no visibility or availability condition belongs here, and a
   * paused item still has to block the delete.
   */
  async countItemsInCategory(categoryId: number): Promise<number> {
    try {
      const [row] = await this.db
        .select({ itemCount: count() })
        .from(menuItems)
        .where(and(eq(menuItems.categoryId, categoryId), notDeletedItem));

      return row?.itemCount ?? 0;
    } catch (error) {
      this.handleError(error, "countItemsInCategory");
      return 0;
    }
  }

  /**
   * Live item count per category, keyed by category id.
   *
   * Replaces the stored categories.item_count column (dropped in
   * migrations_fresh/0077 + migrations/0094). Callers that need a count outside
   * getMenu() can ask for one here instead of trusting a denormalised value
   * that only ever tracked creates (#84).
   */
  async countItemsByCategory(
    restaurantId: string,
    options?: { availableOnly?: boolean },
  ): Promise<Map<number, number>> {
    try {
      const conditions = [
        eq(menuItems.restaurantId, restaurantId),
        // Deleted items never count — the phantom "itemCount: 2, list: empty"
        // contradiction in #80 came from counting them.
        notDeletedItem,
      ];
      if (options?.availableOnly) {
        conditions.push(eq(menuItems.isAvailable, true));
      }

      const rows = await this.db
        .select({
          categoryId: menuItems.categoryId,
          itemCount: count(),
        })
        .from(menuItems)
        .where(and(...conditions))
        .groupBy(menuItems.categoryId);

      return new Map(rows.map((row) => [row.categoryId, row.itemCount]));
    } catch (error) {
      this.handleError(error, "countItemsByCategory");
    }
  }

  // 資料轉換
  private mapToMenuItem(item: any): MenuItem {
    return mapDatabaseMenuItem(item);
  }
}
