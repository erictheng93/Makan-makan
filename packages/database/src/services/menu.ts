import { eq, and, desc, asc, count, sql, isNull, inArray } from "drizzle-orm";
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
const menuItemSelectColumns = {
  id: menuItems.id,
  restaurantId: menuItems.restaurantId,
  categoryId: menuItems.categoryId,
  catalogType: menuItems.catalogType,
  name: menuItems.name,
  description: menuItems.description,
  ingredients: menuItems.ingredients,
  priceCents: menuItems.priceCents,
  originalPriceCents: menuItems.originalPriceCents,
  imageUrl: menuItems.imageUrl,
  imageVariants: menuItems.imageVariants,
  imageId: menuItems.imageId,
  isAvailable: menuItems.isAvailable,
  isFeatured: menuItems.isFeatured,
  isPopular: menuItems.isPopular,
  sortOrder: menuItems.sortOrder,
  inventoryCount: menuItems.inventoryCount,
  spiceLevel: menuItems.spiceLevel,
  preparationTime: menuItems.preparationTime,
  calories: menuItems.calories,
  allergens: menuItems.allergens,
  orderCount: menuItems.orderCount,
  rating: menuItems.rating,
  createdAt: menuItems.createdAt,
  updatedAt: menuItems.updatedAt,
} as const;

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

const publicCategoryConditions = [
  eq(categories.isActive, true),
  eq(categories.isVisible, true),
  isNull(categories.deletedAt),
];

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
                where: and(...publicCategoryConditions),
                orderBy: asc(categories.sortOrder),
                with: {
                  menuItems: {
                    ...(includeAll
                      ? {}
                      : { where: eq(menuItems.isAvailable, true) }),
                    orderBy: [asc(menuItems.sortOrder), asc(menuItems.name)],
                  },
                },
              },
            },
          });

          if (!restaurant) {
            throw new Error("Restaurant not found");
          }

          // Item counts are maintained at mutation time (create/update/delete),
          // so we derive them from the loaded data rather than triggering writes here.
          return {
            categories: restaurant.categories.map((cat: any) => ({
              id: cat.id,
              restaurantId: cat.restaurantId,
              name: cat.name,
              description: cat.description,
              sortOrder: cat.sortOrder,
              status: cat.isActive ? 1 : 0, // Convert boolean to Status enum
              imageUrl: cat.imageUrl,
              itemCount: cat.menuItems.length,
              createdAt: cat.createdAt,
              updatedAt: cat.updatedAt,
            })),
            menuItems: restaurant.categories.flatMap((cat: any) =>
              cat.menuItems.map((item: any) => this.mapToMenuItem(item)),
            ),
          };
        },
        {
          ttl: 3600, // 1 hour cache
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

  // 創建菜單項目
  async createMenuItem(data: CreateMenuItemData): Promise<MenuItem> {
    try {
      const { price, originalPrice, ...insertData } = data;
      const [item] = await this.db
        .insert(menuItems)
        .values({
          ...insertData,
          priceCents: toRequiredCents(price),
          originalPriceCents: toCents(originalPrice),
          isAvailable: data.isAvailable !== undefined ? data.isAvailable : true, // Default: available
          isFeatured: data.isFeatured !== undefined ? data.isFeatured : false,
          isPopular: data.isPopular !== undefined ? data.isPopular : false,
        })
        .returning();

      // 更新分類商品數量
      await this.updateCategoryItemCount(data.categoryId);

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
          ),
        );

      return new Set(rows.map((row) => row.id));
    } catch (error) {
      this.handleError(error, "findOwnedMenuItemIds");
      return new Set();
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
        where: eq(menuItems.id, id),
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
      nameEn: string;
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
        where: eq(categories.id, id),
      });

      return category || null;
    } catch (error) {
      this.handleError(error, "getCategory");
    }
  }

  // 更新分類商品數量
  private async updateCategoryItemCount(categoryId: number): Promise<void> {
    const countResult = await this.db
      .select({ itemCount: count() })
      .from(menuItems)
      .where(
        and(
          eq(menuItems.categoryId, categoryId),
          eq(menuItems.isAvailable, true),
        ),
      );

    const itemCount = countResult?.[0]?.itemCount ?? 0;

    await this.db
      .update(categories)
      .set({
        itemCount,
        updatedAt: new Date(),
      })
      .where(eq(categories.id, categoryId));
  }

  // 更新所有分類商品數量
  private async updateCategoryItemCounts(restaurantId: string): Promise<void> {
    const restaurantCategories = await this.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.restaurantId, restaurantId));

    for (const category of restaurantCategories) {
      await this.updateCategoryItemCount(category.id);
    }
  }

  // 資料轉換
  private mapToMenuItem(item: any): MenuItem {
    return {
      id: item.id,
      restaurantId: item.restaurantId,
      categoryId: item.categoryId,
      catalogType: item.catalogType ?? "menu_item",
      name: item.name,
      description: item.description,
      ingredients: item.ingredients,
      price: amountFromCents(item.priceCents),
      originalPrice: amountFromCents(item.originalPriceCents),
      imageUrl: item.imageUrl,
      imageVariants: item.imageVariants,
      imageId: item.imageId,
      isAvailable: item.isAvailable,
      isFeatured: item.isFeatured,
      isPopular: item.isPopular,
      sortOrder: item.sortOrder,
      inventoryCount: item.inventoryCount,
      spiceLevel: item.spiceLevel,
      preparationTime: item.preparationTime,
      calories: item.calories,
      dietaryInfo: item.dietaryInfo,
      allergens: item.allergens,
      options: item.options,
      orderCount: item.orderCount,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    } as MenuItem;
  }
}
