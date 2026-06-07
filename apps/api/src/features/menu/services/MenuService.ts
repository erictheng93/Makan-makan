/**
 * MenuService
 * Business logic and database operations for menu management
 */

import type { Env } from "../../../shared/types";
import { ConsoleLogger } from "../../../core/monitoring";
import { notFound, forbidden, conflict } from "../../../shared/utils/api-error";
import {
  MenuService as DatabaseMenuService,
  restaurants,
  categories as categoriesTable,
} from "@makanmakan/database";
import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Status } from "@makanmakan/shared-types";
import type {
  MenuItem as SharedMenuItem,
  Category as SharedCategory,
  MenuStructure as SharedMenuStructure,
} from "@makanmakan/shared-types";
import type {
  MenuItem,
  Category,
  MenuStructure,
  CreateMenuItemData,
  UpdateMenuItemData,
  CreateCategoryData,
  UpdateCategoryData,
  MenuFilters,
  MenuSearchParams,
  MenuSearchResult,
  BulkAvailabilityUpdate,
  BulkPriceUpdate,
  BulkCategoryMove,
  MenuAnalytics,
  PopularityMetrics,
  IMenuService,
} from "../types";

export class MenuService implements IMenuService {
  private readonly logger: ConsoleLogger;
  private readonly dbService: DatabaseMenuService;
  private readonly db;

  constructor(private readonly env: Env) {
    this.logger = new ConsoleLogger("MenuService");
    this.dbService = new DatabaseMenuService(env.DB, env);
    this.db = drizzle(env.DB);
  }

  async isPublicRestaurantAvailable(restaurantId: string): Promise<boolean> {
    const [restaurant] = await this.db
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(
        and(
          eq(restaurants.id, restaurantId),
          eq(restaurants.isActive, true),
          isNull(restaurants.deletedAt),
        ),
      )
      .limit(1);

    return Boolean(restaurant);
  }

  async getMenu(
    restaurantId: string,
    options?: { includeUnavailable?: boolean },
  ): Promise<MenuStructure | null> {
    try {
      this.logger.info("Fetching complete menu", { restaurantId });
      if (!options?.includeUnavailable) {
        const isPublic = await this.isPublicRestaurantAvailable(restaurantId);
        if (!isPublic) return null;
      }

      const menu = await this.dbService.getMenu(restaurantId, options);
      return menu ? this.transformMenuStructure(menu) : null;
    } catch (error) {
      this.logger.error(
        "Failed to fetch menu",
        error instanceof Error ? error : undefined,
        { restaurantId },
      );
      throw error;
    }
  }

  async getMenuItem(id: number): Promise<MenuItem | null> {
    try {
      this.logger.debug("Fetching menu item", { id });
      const item = await this.dbService.getMenuItem(id);
      if (!item) {
        this.logger.warn("Menu item not found", { id });
        return null;
      }
      return this.transformMenuItem(item);
    } catch (error) {
      this.logger.error(
        "Failed to fetch menu item",
        error instanceof Error ? error : undefined,
        { id },
      );
      throw error;
    }
  }

  async createMenuItem(data: CreateMenuItemData): Promise<MenuItem> {
    try {
      this.logger.info("Creating menu item", {
        data: { name: data.name, restaurantId: data.restaurantId },
      });
      await this.validateCategoryAccess(data.categoryId, data.restaurantId);
      const item = await this.dbService.createMenuItem({
        ...data,
        restaurantId: String(data.restaurantId),
      });
      this.logger.info("Menu item created successfully", { itemId: item.id });
      return this.transformMenuItem(item);
    } catch (error) {
      this.logger.error(
        "Failed to create menu item",
        error instanceof Error ? error : undefined,
        { data },
      );
      throw error;
    }
  }

  async updateMenuItem(
    id: number,
    data: UpdateMenuItemData,
    prefetchedItem?: MenuItem,
  ): Promise<MenuItem> {
    try {
      this.logger.info("Updating menu item", { id, data });
      const existingItem = prefetchedItem ?? (await this.getMenuItem(id));
      if (!existingItem) {
        throw notFound("Menu item not found", "MENU_ITEM_NOT_FOUND");
      }
      if (data.categoryId && data.categoryId !== existingItem.categoryId) {
        await this.validateCategoryAccess(
          data.categoryId,
          existingItem.restaurantId,
        );
      }
      const item = await this.dbService.updateMenuItem(id, {
        ...data,
        restaurantId: data.restaurantId ? String(data.restaurantId) : undefined,
      });
      this.logger.info("Menu item updated successfully", { itemId: id });
      return this.transformMenuItem(item);
    } catch (error) {
      this.logger.error(
        "Failed to update menu item",
        error instanceof Error ? error : undefined,
        { id, data },
      );
      throw error;
    }
  }

  async deleteMenuItem(
    id: number,
    prefetchedItem?: MenuItem,
  ): Promise<boolean> {
    try {
      this.logger.info("Deleting menu item", { id });
      const existingItem = prefetchedItem ?? (await this.getMenuItem(id));
      if (!existingItem) {
        return false;
      }
      await this.dbService.updateMenuItem(id, {
        isAvailable: false,
        sortOrder: -1,
      });
      this.logger.info("Menu item deleted successfully", { itemId: id });
      return true;
    } catch (error) {
      this.logger.error(
        "Failed to delete menu item",
        error instanceof Error ? error : undefined,
        { id },
      );
      throw error;
    }
  }

  async createCategory(data: CreateCategoryData): Promise<Category> {
    try {
      this.logger.info("Creating category", { data });
      const category = await this.dbService.createCategory({
        ...data,
        restaurantId: String(data.restaurantId),
      });
      this.logger.info("Category created successfully", {
        categoryId: category.id,
      });
      return this.transformCategory(category);
    } catch (error) {
      this.logger.error(
        "Failed to create category",
        error instanceof Error ? error : undefined,
        { data },
      );
      throw error;
    }
  }

  async updateCategory(
    id: number,
    data: UpdateCategoryData,
  ): Promise<Category> {
    try {
      this.logger.info("Updating category", { id, data });
      const updated = await this.dbService.updateCategory(id, data);
      this.logger.info("Category updated successfully", { categoryId: id });
      return this.transformCategory(updated);
    } catch (error) {
      this.logger.error(
        "Failed to update category",
        error instanceof Error ? error : undefined,
        { id, data },
      );
      throw error;
    }
  }

  async deleteCategory(id: number): Promise<boolean> {
    try {
      this.logger.info("Deleting category", { id });
      const existingCategory = await this.getCategory(id);
      if (!existingCategory) {
        return false;
      }
      const menuItems = await this.dbService.searchMenuItems(
        String(existingCategory.restaurantId),
        { categoryId: id },
        1,
        1,
      );
      if (menuItems.items.length > 0) {
        throw conflict(
          "Cannot delete category that contains menu items",
          "CATEGORY_HAS_MENU_ITEMS",
        );
      }
      await this.updateCategory(id, { isActive: false });
      this.logger.info("Category deleted successfully", { categoryId: id });
      return true;
    } catch (error) {
      this.logger.error(
        "Failed to delete category",
        error instanceof Error ? error : undefined,
        { id },
      );
      throw error;
    }
  }

  async reorderCategories(
    restaurantId: string,
    updates: Array<{ id: number; sortOrder: number }>,
  ): Promise<void> {
    try {
      this.logger.info("Reordering categories", {
        restaurantId,
        count: updates.length,
      });
      await this.dbService.reorderCategories(restaurantId, updates);
      this.logger.info("Categories reordered successfully", { restaurantId });
    } catch (error) {
      this.logger.error(
        "Failed to reorder categories",
        error instanceof Error ? error : undefined,
        { restaurantId },
      );
      throw error;
    }
  }

  async searchMenuItems(
    restaurantId: string,
    params: MenuSearchParams,
  ): Promise<MenuSearchResult> {
    try {
      this.logger.debug("Searching menu items", { restaurantId, params });
      const filters: MenuFilters = {
        categoryId: params.categoryId,
        priceRange: params.priceRange,
        spiceLevel: params.spiceLevel,
        dietaryPreferences: params.dietaryPreferences,
        isAvailable: params.isAvailable,
        isFeatured: params.isFeatured,
        search: params.search,
      };
      const result = await this.dbService.searchMenuItems(
        restaurantId,
        filters,
        params.page || 1,
        params.limit || 20,
      );
      return {
        items: result.items.map((item) => this.transformMenuItem(item)),
        pagination: result.pagination,
      };
    } catch (error) {
      this.logger.error(
        "Failed to search menu items",
        error instanceof Error ? error : undefined,
        { restaurantId, params },
      );
      throw error;
    }
  }

  async getFeaturedItems(
    restaurantId: string,
    limit: number = 10,
  ): Promise<MenuItem[]> {
    try {
      this.logger.debug("Fetching featured items", { restaurantId, limit });
      const items = await this.dbService.getFeaturedItems(restaurantId, limit);
      return items.map((item) => this.transformMenuItem(item));
    } catch (error) {
      this.logger.error(
        "Failed to fetch featured items",
        error instanceof Error ? error : undefined,
        { restaurantId },
      );
      throw error;
    }
  }

  async getPopularItems(
    restaurantId: string,
    limit: number = 10,
  ): Promise<MenuItem[]> {
    try {
      this.logger.debug("Fetching popular items", { restaurantId, limit });
      const items = await this.dbService.getPopularItems(restaurantId, limit);
      return items.map((item) => this.transformMenuItem(item));
    } catch (error) {
      this.logger.error(
        "Failed to fetch popular items",
        error instanceof Error ? error : undefined,
        { restaurantId },
      );
      throw error;
    }
  }

  async batchUpdateAvailability(
    restaurantId: string,
    updates: BulkAvailabilityUpdate[],
  ): Promise<void> {
    try {
      this.logger.info("Batch updating availability", {
        restaurantId,
        count: updates.length,
      });
      await this.dbService.batchUpdateAvailability(restaurantId, updates);
      this.logger.info("Batch availability update completed", { restaurantId });
    } catch (error) {
      this.logger.error(
        "Failed to batch update availability",
        error instanceof Error ? error : undefined,
        { restaurantId },
      );
      throw error;
    }
  }

  async batchUpdatePrices(
    restaurantId: string,
    updates: BulkPriceUpdate[],
  ): Promise<void> {
    try {
      this.logger.info("Batch updating prices", {
        restaurantId,
        count: updates.length,
      });
      for (const update of updates) {
        await this.dbService.updateMenuItem(update.id, {
          price: update.price,
          originalPrice: update.originalPrice,
        });
      }
      this.logger.info("Batch price update completed", { restaurantId });
    } catch (error) {
      this.logger.error(
        "Failed to batch update prices",
        error instanceof Error ? error : undefined,
        { restaurantId },
      );
      throw error;
    }
  }

  async batchMoveItems(
    restaurantId: string,
    moves: BulkCategoryMove[],
  ): Promise<void> {
    try {
      this.logger.info("Batch moving items to categories", {
        restaurantId,
        count: moves.length,
      });
      for (const move of moves) {
        await this.validateCategoryAccess(move.categoryId, restaurantId);
      }
      for (const move of moves) {
        await this.dbService.updateMenuItem(move.id, {
          categoryId: move.categoryId,
        });
      }
      this.logger.info("Batch category move completed", { restaurantId });
    } catch (error) {
      this.logger.error(
        "Failed to batch move items",
        error instanceof Error ? error : undefined,
        { restaurantId },
      );
      throw error;
    }
  }

  async getMenuAnalytics(restaurantId: string): Promise<MenuAnalytics> {
    try {
      this.logger.debug("Fetching menu analytics", { restaurantId });
      const menu = await this.getMenu(restaurantId);
      if (!menu) {
        throw notFound("Menu not found for restaurant", "MENU_NOT_FOUND");
      }
      const items = menu.menuItems;
      const totalItems = items.length;
      const availableItems = items.filter((item) => item.isAvailable).length;
      const featuredItems = items.filter((item) => item.isFeatured).length;
      const popularItems = items.filter((item) => item.isPopular).length;
      const prices = items.map((item) => item.price);
      const averagePrice =
        prices.length > 0
          ? prices.reduce((sum, price) => sum + price, 0) / prices.length
          : 0;
      const priceRange =
        prices.length > 0
          ? { min: Math.min(...prices), max: Math.max(...prices) }
          : { min: 0, max: 0 };
      const categoryMap = new Map<number, { name: string; count: number }>();
      for (const item of items) {
        const category = menu.categories.find(
          (cat) => cat.id === item.categoryId,
        );
        if (category) {
          const existing = categoryMap.get(category.id) || {
            name: category.name,
            count: 0,
          };
          categoryMap.set(category.id, {
            ...existing,
            count: existing.count + 1,
          });
        }
      }
      const categoryDistribution = Array.from(categoryMap.entries()).map(
        ([id, data]) => ({
          categoryId: id,
          categoryName: data.name,
          itemCount: data.count,
          percentage: totalItems > 0 ? (data.count / totalItems) * 100 : 0,
        }),
      );
      const topPerformingItems = items
        .sort((a, b) => b.orderCount - a.orderCount)
        .slice(0, 10)
        .map((item) => ({
          id: item.id,
          name: item.name,
          orderCount: item.orderCount,
          revenue: item.orderCount * item.price,
          rating: item.rating,
        }));
      const dietaryInfoStats = {
        vegetarian: items.filter((item) => item.dietaryInfo?.vegetarian).length,
        vegan: items.filter((item) => item.dietaryInfo?.vegan).length,
        glutenFree: items.filter((item) => item.dietaryInfo?.glutenFree).length,
        halal: items.filter((item) => item.dietaryInfo?.halal).length,
      };
      const spiceLevelDistribution = items.reduce(
        (acc, item) => {
          acc[item.spiceLevel] = (acc[item.spiceLevel] || 0) + 1;
          return acc;
        },
        {} as Record<number, number>,
      );
      return {
        totalItems,
        availableItems,
        featuredItems,
        popularItems,
        averagePrice,
        priceRange,
        categoryDistribution,
        topPerformingItems,
        dietaryInfoStats,
        spiceLevelDistribution,
      };
    } catch (error) {
      this.logger.error(
        "Failed to fetch menu analytics",
        error instanceof Error ? error : undefined,
        { restaurantId },
      );
      throw error;
    }
  }

  async getPopularityMetrics(restaurantId: string): Promise<PopularityMetrics> {
    try {
      this.logger.debug("Fetching popularity metrics", { restaurantId });
      const [mostOrdered, mostViewed, highestRated, recentlyAdded] =
        await Promise.all([
          this.getPopularItems(restaurantId, 10),
          this.getMostViewedItems(restaurantId, 10),
          this.getHighestRatedItems(restaurantId, 10),
          this.getRecentlyAddedItems(restaurantId, 10),
        ]);
      return { mostOrdered, mostViewed, highestRated, recentlyAdded };
    } catch (error) {
      this.logger.error(
        "Failed to fetch popularity metrics",
        error instanceof Error ? error : undefined,
        { restaurantId },
      );
      throw error;
    }
  }

  async incrementOrderCount(
    menuItemId: number,
    increment: number = 1,
  ): Promise<void> {
    try {
      await this.dbService.incrementOrderCount(menuItemId, increment);
    } catch (error) {
      this.logger.error(
        "Failed to increment order count",
        error instanceof Error ? error : undefined,
        { menuItemId },
      );
      throw error;
    }
  }

  async incrementViewCount(menuItemId: number): Promise<void> {
    try {
      await this.dbService.incrementViewCount(menuItemId);
    } catch (error) {
      this.logger.error(
        "Failed to increment view count",
        error instanceof Error ? error : undefined,
        { menuItemId },
      );
      throw error;
    }
  }

  async updateItemRating(menuItemId: number, rating: number): Promise<void> {
    try {
      this.logger.debug("Updating item rating", { menuItemId, rating });
      await this.dbService.updateMenuItem(menuItemId, { rating });
    } catch (error) {
      this.logger.error(
        "Failed to update item rating",
        error instanceof Error ? error : undefined,
        { menuItemId },
      );
      throw error;
    }
  }

  async getCategoryById(id: number): Promise<Category | null> {
    return this.getCategory(id);
  }

  private async validateCategoryAccess(
    categoryId: number,
    restaurantId: string,
  ): Promise<void> {
    const category = await this.getCategory(categoryId);
    if (!category) {
      throw notFound("Category not found", "CATEGORY_NOT_FOUND");
    }
    if (String(category.restaurantId) !== String(restaurantId)) {
      throw forbidden(
        "Category does not belong to the specified restaurant",
        "CATEGORY_RESTAURANT_MISMATCH",
      );
    }
  }

  private async getCategory(id: number): Promise<Category | null> {
    try {
      const category = await this.dbService.getCategory(id);
      if (!category) {
        return null;
      }
      return this.transformCategory(category);
    } catch (error) {
      this.logger.error(
        "Failed to fetch category",
        error instanceof Error ? error : undefined,
        { id },
      );
      return null;
    }
  }

  private async getMostViewedItems(
    restaurantId: string,
    limit: number,
  ): Promise<MenuItem[]> {
    const result = await this.dbService.searchMenuItems(
      restaurantId,
      { isAvailable: true },
      1,
      limit,
    );
    return result.items
      .map((item) => this.transformMenuItem(item))
      .sort((a, b) => b.viewCount - a.viewCount);
  }

  private async getHighestRatedItems(
    restaurantId: string,
    limit: number,
  ): Promise<MenuItem[]> {
    const result = await this.dbService.searchMenuItems(
      restaurantId,
      { isAvailable: true },
      1,
      limit,
    );
    return result.items
      .map((item) => this.transformMenuItem(item))
      .filter((item) => item.rating && item.rating > 0)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }

  private async getRecentlyAddedItems(
    restaurantId: string,
    limit: number,
  ): Promise<MenuItem[]> {
    const result = await this.dbService.searchMenuItems(
      restaurantId,
      { isAvailable: true },
      1,
      limit,
    );
    return result.items
      .map((item) => this.transformMenuItem(item))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  }

  /**
   * Promote a shared MenuItem (as returned by DatabaseMenuService) to the
   * feature MenuItem shape. The DB mapper (mapToMenuItem) does not populate
   * the feature-only fields (reviewCount/viewCount/rating/tags/keywords/
   * availableHours), so reviewCount/viewCount default here and the optional
   * extras are simply absent — matching the previous runtime behaviour, but
   * now type-checked instead of cast through `unknown`.
   */
  private transformMenuItem(item: SharedMenuItem): MenuItem {
    return {
      ...item,
      catalogType: item.catalogType ?? "menu_item",
      categoryId: Number(item.categoryId),
      restaurantId: String(item.restaurantId),
      isAvailable: item.isAvailable || false,
      isFeatured: item.isFeatured || false,
      isPopular: item.isPopular || false,
      sortOrder: item.sortOrder || 0,
      inventoryCount: item.inventoryCount || 0,
      orderCount: item.orderCount || 0,
      allergens: item.allergens || [],
      reviewCount: 0,
      viewCount: 0,
    };
  }

  /**
   * Normalise a category into the feature Category shape. This receives two
   * different runtime shapes: a shared Category (from getMenu, already carrying
   * `status` + string timestamps) and a raw Drizzle row (from create/update,
   * carrying `isActive` + Date timestamps and no `status`). We discriminate at
   * runtime via `in` checks. Deriving status from `isActive` also fixes a
   * latent bug: the previous `status || 1` cast made the create/update path
   * always report ACTIVE regardless of isActive.
   */
  private transformCategory(
    category: SharedCategory | typeof categoriesTable.$inferSelect,
  ): Category {
    const isActive = "isActive" in category ? category.isActive : undefined;
    const status: Status =
      "status" in category
        ? category.status
        : isActive === false
          ? Status.INACTIVE
          : Status.ACTIVE;
    const toIso = (value: string | Date): string =>
      value instanceof Date ? value.toISOString() : value;
    return {
      id: category.id,
      restaurantId: String(category.restaurantId),
      name: category.name,
      description: category.description ?? undefined,
      parentId: "parentId" in category ? category.parentId : undefined,
      sortOrder: category.sortOrder,
      status,
      createdAt: toIso(category.createdAt),
      updatedAt: toIso(category.updatedAt),
      isActive,
      isVisible: "isVisible" in category ? category.isVisible : undefined,
      itemCount: "itemCount" in category ? category.itemCount : undefined,
    };
  }

  private transformMenuStructure(menu: SharedMenuStructure): MenuStructure {
    return {
      categories:
        menu.categories?.map((cat) => this.transformCategory(cat)) || [],
      menuItems:
        menu.menuItems?.map((item) => this.transformMenuItem(item)) || [],
    };
  }
}
