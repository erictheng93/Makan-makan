import { drizzle } from "drizzle-orm/d1";
import { eq, and, desc } from "drizzle-orm";
import {
  platformOrders,
  platformMenuMappings,
  orders,
  orderItems,
} from "@makanmasak/database";
import type {
  PlatformType,
  PlatformOrdersFilter,
} from "@makanmasak/shared-types";
import type { Env } from "../../../types/env";
import { getAdapter } from "../adapters/PlatformAdapter";
import { PlatformIntegrationService } from "./PlatformIntegrationService";
import { ReceiptService } from "../../pos/services/ReceiptService";
import { toRequiredCents } from "../../../shared/utils/money";

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
    const now = new Date();
    const subtotalCents = toRequiredCents(parsedOrder.subtotal);
    const taxAmountCents = toRequiredCents(parsedOrder.taxAmount);
    const serviceChargeCents = 0;
    const discountAmountCents = 0;
    const totalAmountCents = toRequiredCents(parsedOrder.totalAmount);

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
        totalAmountCents,
        subtotalCents,
        taxAmountCents,
        serviceChargeCents,
        discountAmountCents,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: orders.id });

    const orderId = insertedOrder.id;

    // Create order items
    for (const item of parsedOrder.items) {
      const menuItemId = platformToInternalMap.get(item.platformItemId);
      if (menuItemId == null) continue; // skip unmapped items — menuItemId is NOT NULL
      const unitPriceCents = toRequiredCents(item.unitPrice);
      const totalPriceCents = unitPriceCents * item.quantity;

      await this.db.insert(orderItems).values({
        orderId,
        menuItemId,
        quantity: item.quantity,
        unitPriceCents,
        totalPriceCents,
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

        await this.emitKitchenTicket(orderId);
      } catch (error) {
        console.error(
          `Failed to auto-accept order ${parsedOrder.platformOrderId}:`,
          error,
        );
      }
    }

    return orderId;
  }

  /**
   * Auto-accept writes the orders row straight to "confirmed" instead of going
   * through OrdersService.updateOrderStatus, so the kitchen ticket has to be
   * queued here too — otherwise a delivery-platform order never reaches the
   * shop's print agent.
   *
   * Failures are swallowed on purpose: the status is already committed, and a
   * webhook that fails gets redelivered by the platform, which would duplicate
   * the whole order. A ticket that never printed is observable (the receipt row
   * stays pending); a redelivered order is not. Duplicate calls are harmless —
   * createKitchenTicket refuses to open a second ticket for the same order.
   */
  private async emitKitchenTicket(orderId: string): Promise<void> {
    try {
      const result = await new ReceiptService(this.env.DB).createKitchenTicket(
        orderId,
      );
      if (!result.success) {
        console.error(
          `Failed to queue kitchen ticket for order ${orderId}:`,
          result.error,
        );
      }
    } catch (error) {
      console.error(
        `Failed to queue kitchen ticket for order ${orderId}:`,
        error,
      );
    }
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
