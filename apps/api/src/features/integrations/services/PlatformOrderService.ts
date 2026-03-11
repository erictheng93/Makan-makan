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
  ): Promise<number> {
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
    const now = new Date();

    const [insertedOrder] = await this.db
      .insert(orders)
      .values({
        restaurantId,
        orderNumber: `PL-${Date.now()}`,
        status: "pending",
        orderSource: platform,
        customerInfo: {
          name: parsedOrder.customerName,
          phone: parsedOrder.customerPhone,
        },
        deliveryInfo: {
          type: "delivery" as const,
          address: parsedOrder.deliveryAddress,
        },
        totalAmount: parsedOrder.totalAmount,
        subtotal: parsedOrder.subtotal,
        taxAmount: parsedOrder.taxAmount,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: orders.id });

    const orderId = insertedOrder.id;

    // Create order items
    for (const item of parsedOrder.items) {
      const menuItemId = platformToInternalMap.get(item.platformItemId);
      if (menuItemId == null) continue; // skip unmapped items — menuItemId is NOT NULL
      await this.db.insert(orderItems).values({
        orderId,
        menuItemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.unitPrice * item.quantity,
        itemSnapshot: { name: item.name },
        createdAt: now,
      });
    }

    // Create platform order mapping
    await this.db.insert(platformOrders).values({
      orderId,
      restaurantId,
      platform,
      platformOrderId: parsedOrder.platformOrderId,
      platformStoreId: parsedOrder.platformStoreId,
      platformStatus: "received",
      rawPayload: parsedOrder.rawPayload as Record<string, unknown>,
      createdAt: now,
      updatedAt: now,
    });

    // Auto-accept if configured
    const integration = await this.integrationService.getIntegration(
      restaurantId,
      platform,
    );
    if (integration?.config?.autoAcceptOrders) {
      try {
        const creds = await this.integrationService.getDecryptedCredentials(
          restaurantId,
          platform,
        );
        await adapter.acceptOrder(parsedOrder.platformOrderId, creds);

        await this.db
          .update(platformOrders)
          .set({ platformStatus: "accepted", updatedAt: new Date() })
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
    orderId: number,
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

    const currentStatus = platformOrder.platformStatus;

    if (currentStatus === "received" && newStatus === "confirmed") {
      await adapter.acceptOrder(platformOrder.platformOrderId, creds);
      await this.db
        .update(platformOrders)
        .set({ platformStatus: "accepted", updatedAt: new Date() })
        .where(eq(platformOrders.id, platformOrder.id));
    } else if (currentStatus === "received" && newStatus === "cancelled") {
      await adapter.denyOrder(
        platformOrder.platformOrderId,
        "Order denied by restaurant",
        creds,
      );
      await this.db
        .update(platformOrders)
        .set({ platformStatus: "denied", updatedAt: new Date() })
        .where(eq(platformOrders.id, platformOrder.id));
    } else if (newStatus === "cancelled") {
      await adapter.cancelOrder(
        platformOrder.platformOrderId,
        "Order cancelled by restaurant",
        creds,
      );
      await this.db
        .update(platformOrders)
        .set({ platformStatus: "cancelled", updatedAt: new Date() })
        .where(eq(platformOrders.id, platformOrder.id));
    } else if (newStatus === "ready") {
      // Log only for now — pickup notification handled by platform
      console.log(
        `Order ${platformOrder.platformOrderId} marked as ready on ${platformOrder.platform}`,
      );
      await this.db
        .update(platformOrders)
        .set({ platformStatus: "ready", updatedAt: new Date() })
        .where(eq(platformOrders.id, platformOrder.id));
    }
  }

  async getPlatformOrders(restaurantId: string, filters: PlatformOrdersFilter) {
    const conditions = [eq(platformOrders.restaurantId, restaurantId)];

    if (filters.platform) {
      conditions.push(eq(platformOrders.platform, filters.platform));
    }
    if (filters.platformStatus) {
      conditions.push(
        eq(platformOrders.platformStatus, filters.platformStatus),
      );
    }

    const limit = filters.limit ?? 50;
    const page = filters.page ?? 1;
    const offset = (page - 1) * limit;

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
