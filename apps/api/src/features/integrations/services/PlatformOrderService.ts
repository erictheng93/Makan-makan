import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc } from "drizzle-orm";
import {
  platformOrders,
  platformMenuMappings,
  orders,
  orderItems,
} from "@makanmakan/database";
import type {
  PlatformType,
  PlatformOrdersFilter,
} from "@makanmakan/shared-types";
import type { Env } from "../../../types/env";
import { getAdapter } from "../adapters/PlatformAdapter";
import { PlatformIntegrationService } from "./PlatformIntegrationService";
import { generateUUID } from "@makanmakan/utils";

export class PlatformOrderService {
  private db;
  private env: Env;
  private integrationService: PlatformIntegrationService;

  constructor(env: Env) {
    this.db = drizzle(env.DB);
    this.env = env;
    this.integrationService = new PlatformIntegrationService(env);
  }

  async processWebhook(
    platform: PlatformType,
    payload: unknown,
    restaurantId: string,
  ): Promise<string> {
    const adapter = getAdapter(platform);
    const parsedOrder = await adapter.parseOrder(payload);

    // Map platform item IDs to internal menu item IDs
    const mappings = await this.db
      .select()
      .from(platformMenuMappings)
      .where(
        and(
          eq(platformMenuMappings.restaurantId, restaurantId),
          eq(platformMenuMappings.platform, platform),
        ),
      );

    const platformToInternalMap = new Map(
      mappings.map((m) => [m.platformItemId, m.menuItemId]),
    );

    // Create internal order
    const orderId = generateUUID();
    const now = new Date();

    await this.db.insert(orders).values({
      id: orderId,
      restaurantId,
      status: "pending",
      orderSource: platform,
      customerName: parsedOrder.customerName,
      customerPhone: parsedOrder.customerPhone,
      deliveryAddress: parsedOrder.deliveryAddress,
      totalAmount: parsedOrder.totalAmount,
      subtotalAmount: parsedOrder.subtotalAmount,
      taxAmount: parsedOrder.taxAmount,
      createdAt: now,
      updatedAt: now,
    });

    // Create order items
    for (const item of parsedOrder.items) {
      const menuItemId = platformToInternalMap.get(item.platformItemId);
      await this.db.insert(orderItems).values({
        id: generateUUID(),
        orderId,
        menuItemId: menuItemId ?? null,
        name: item.title,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        modifiers: JSON.stringify(item.modifiers),
        createdAt: now,
      });
    }

    // Create platform order mapping
    await this.db.insert(platformOrders).values({
      id: generateUUID(),
      orderId,
      restaurantId,
      platform,
      platformOrderId: parsedOrder.platformOrderId,
      platformStoreId: parsedOrder.platformStoreId,
      status: "received",
      rawPayload: JSON.stringify(parsedOrder.rawPayload),
      createdAt: now,
      updatedAt: now,
    });

    // Auto-accept if configured
    const integration = await this.integrationService.getIntegration(
      restaurantId,
      platform,
    );
    if (integration?.autoAcceptOrders) {
      try {
        const creds = await this.integrationService.getDecryptedCredentials(
          restaurantId,
          platform,
        );
        await adapter.acceptOrder(parsedOrder.platformOrderId, creds);

        await this.db
          .update(platformOrders)
          .set({ status: "accepted", updatedAt: new Date() })
          .where(eq(platformOrders.orderId, orderId));

        await this.db
          .update(orders)
          .set({ status: "confirmed", updatedAt: new Date() })
          .where(eq(orders.id, orderId));
      } catch (error) {
        console.error(
          `Failed to auto-accept order ${parsedOrder.platformOrderId}:`,
          error,
        );
      }
    }

    return orderId;
  }

  async syncStatusToPlatform(
    orderId: string,
    newStatus: string,
  ): Promise<void> {
    const platformOrderRecords = await this.db
      .select()
      .from(platformOrders)
      .where(eq(platformOrders.orderId, orderId))
      .limit(1);

    const platformOrder = platformOrderRecords[0];
    if (!platformOrder) return;

    const adapter = getAdapter(platformOrder.platform as PlatformType);
    const creds = await this.integrationService.getDecryptedCredentials(
      platformOrder.restaurantId,
      platformOrder.platform as PlatformType,
    );

    const currentStatus = platformOrder.status;

    if (currentStatus === "received" && newStatus === "confirmed") {
      await adapter.acceptOrder(platformOrder.platformOrderId, creds);
      await this.db
        .update(platformOrders)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(eq(platformOrders.id, platformOrder.id));
    } else if (currentStatus === "received" && newStatus === "cancelled") {
      await adapter.denyOrder(
        platformOrder.platformOrderId,
        "Order denied by restaurant",
        creds,
      );
      await this.db
        .update(platformOrders)
        .set({ status: "denied", updatedAt: new Date() })
        .where(eq(platformOrders.id, platformOrder.id));
    } else if (newStatus === "cancelled") {
      await adapter.cancelOrder(
        platformOrder.platformOrderId,
        "Order cancelled by restaurant",
        creds,
      );
      await this.db
        .update(platformOrders)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(platformOrders.id, platformOrder.id));
    } else if (newStatus === "ready") {
      // Log only for now — pickup notification handled by platform
      console.log(
        `Order ${platformOrder.platformOrderId} marked as ready on ${platformOrder.platform}`,
      );
      await this.db
        .update(platformOrders)
        .set({ status: "ready", updatedAt: new Date() })
        .where(eq(platformOrders.id, platformOrder.id));
    }
  }

  async getPlatformOrders(restaurantId: string, filters: PlatformOrdersFilter) {
    const conditions = [eq(platformOrders.restaurantId, restaurantId)];

    if (filters.platform) {
      conditions.push(eq(platformOrders.platform, filters.platform));
    }
    if (filters.status) {
      conditions.push(eq(platformOrders.status, filters.status));
    }

    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const results = await this.db
      .select()
      .from(platformOrders)
      .where(and(...conditions))
      .orderBy(desc(platformOrders.createdAt))
      .limit(limit)
      .offset(offset);

    return results;
  }
}
