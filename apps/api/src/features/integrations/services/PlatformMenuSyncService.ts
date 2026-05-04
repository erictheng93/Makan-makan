import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import {
  platformIntegrations,
  platformMenuMappings,
  menuItems,
  categories,
} from "@makanmasak/database";
import type { PlatformType, MenuSyncPayload } from "@makanmasak/shared-types";
import type { Env } from "../../../types/env";
import { getAdapter } from "../adapters/PlatformAdapter";
import { PlatformIntegrationService } from "./PlatformIntegrationService";
export class PlatformMenuSyncService {
  private db;
  private env: Env;
  private integrationService: PlatformIntegrationService;

  constructor(env: Env) {
    this.db = drizzle(env.DB);
    this.env = env;
    this.integrationService = new PlatformIntegrationService(env);
  }

  async syncMenu(restaurantId: string, platform: PlatformType): Promise<void> {
    // Mark as syncing
    await this.db
      .update(platformIntegrations)
      .set({
        menuSyncStatus: "syncing",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(platformIntegrations.restaurantId, restaurantId),
          eq(platformIntegrations.platform, platform),
        ),
      );

    try {
      // Read all active menu items and categories
      const allCategories = await this.db
        .select()
        .from(categories)
        .where(eq(categories.restaurantId, restaurantId));

      const allMenuItems = await this.db
        .select()
        .from(menuItems)
        .where(
          and(
            eq(menuItems.restaurantId, restaurantId),
            eq(menuItems.isAvailable, true),
          ),
        );

      // Build MenuSyncPayload
      const menuData: MenuSyncPayload = {
        restaurantId,
        categories: allCategories.map((cat) => ({
          id: cat.id,
          name: cat.name,
          items: allMenuItems
            .filter((item) => item.categoryId === cat.id)
            .map((item) => ({
              id: item.id,
              name: item.name,
              description: item.description ?? "",
              price: item.price,
              imageUrl: item.imageUrl ?? undefined,
              available: item.isAvailable ?? true,
            })),
        })),
      };

      // Get adapter and credentials
      const adapter = getAdapter(platform);
      const creds = await this.integrationService.getDecryptedCredentials(
        restaurantId,
        platform,
      );

      // Sync menu to platform
      const result = await adapter.syncMenu(menuData, creds);

      // Update platform_menu_mappings with returned platformItemIds
      if (result.platformItemIds) {
        for (const [internalIdStr, platformItemId] of Object.entries(
          result.platformItemIds,
        )) {
          const menuItemId = Number(internalIdStr);
          const existing = await this.db
            .select()
            .from(platformMenuMappings)
            .where(
              and(
                eq(platformMenuMappings.restaurantId, restaurantId),
                eq(platformMenuMappings.platform, platform),
                eq(platformMenuMappings.menuItemId, menuItemId),
              ),
            )
            .limit(1);

          if (existing[0]) {
            await this.db
              .update(platformMenuMappings)
              .set({
                platformItemId,
                updatedAt: new Date(),
              })
              .where(eq(platformMenuMappings.id, existing[0].id));
          } else {
            await this.db.insert(platformMenuMappings).values({
              restaurantId,
              platform,
              menuItemId,
              platformItemId,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }
      }

      // Mark sync as success
      await this.db
        .update(platformIntegrations)
        .set({
          menuSyncStatus: "success",
          lastMenuSyncAt: new Date(),
          menuSyncError: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(platformIntegrations.restaurantId, restaurantId),
            eq(platformIntegrations.platform, platform),
          ),
        );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await this.db
        .update(platformIntegrations)
        .set({
          menuSyncStatus: "error",
          menuSyncError: errorMessage,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(platformIntegrations.restaurantId, restaurantId),
            eq(platformIntegrations.platform, platform),
          ),
        );

      throw error;
    }
  }
}
