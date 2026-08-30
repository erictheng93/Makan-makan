import { eq, and, desc, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import {
  createDatabase,
  IngredientConsumptionService,
  menuItems,
  platformOrders,
  platformMenuMappings,
  orders,
  orderItems,
  restaurants,
} from "@makanmasak/database";
import { generateUUID } from "@makanmasak/utils";
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
    this.db = createDatabase(env.DB);
    this.env = env;
    this.integrationService = new PlatformIntegrationService(env);
  }

  /**
   * Turns one platform order notification into an internal order, at most once
   * per (platform, platformOrderId).
   *
   * The uniqueness of that pair is owned by `platform_orders_platform_order_idx`,
   * and it used to be consulted only by the last write of the sequence — so a
   * second notification for an order we already had wrote `orders` and
   * `order_items`, hit the index, and left both behind with no mapping row and
   * nothing to reclaim them (issue #237). Two mechanisms replace that:
   *
   *  1. The read below answers the ordinary case — the platform order is
   *     already mapped, so return the internal order it maps to and write
   *     nothing at all.
   *  2. Two concurrent first deliveries both pass that read. Every write is
   *     therefore issued as one `db.batch`, which D1 executes as a SQL
   *     transaction: the index rejects the loser's mapping row and the whole
   *     batch rolls back, so its `orders` and `order_items` never commit. The
   *     loser then re-reads and returns the winner's order.
   *
   * D1 has no `db.transaction`; `batch` is its only atomic multi-statement
   * primitive, which is why the writes are collected rather than awaited one
   * by one.
   */
  async processWebhook(
    platform: PlatformType,
    payload: unknown,
    restaurantId: string,
  ): Promise<string> {
    const adapter = getAdapter(platform);
    const parsedOrder = await adapter.parseOrder(payload);

    const mappedOrder = await this.findMappedOrder(
      platform,
      parsedOrder.platformOrderId,
    );
    if (mappedOrder) {
      await this.resumePostCreateProcessing(
        mappedOrder.orderId,
        mappedOrder.platformStatus,
        restaurantId,
        platform,
        parsedOrder.platformOrderId,
        adapter,
      );
      return mappedOrder.orderId;
    }

    // Map platform item IDs to internal menu item IDs
    const mappings = await this.db
      .select({
        platformItemId: platformMenuMappings.platformItemId,
        menuItemId: platformMenuMappings.menuItemId,
      })
      .from(platformMenuMappings)
      .innerJoin(
        menuItems,
        and(
          eq(platformMenuMappings.menuItemId, menuItems.id),
          eq(menuItems.restaurantId, restaurantId),
        ),
      )
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

    const orderId = generateUUID();
    const consumedItems = parsedOrder.items.flatMap((item) => {
      const menuItemId = platformToInternalMap.get(item.platformItemId);
      return menuItemId == null ? [] : [{ item, menuItemId }];
    });
    const writes: BatchItem<"sqlite">[] = [
      this.db.insert(orders).values({
        id: orderId,
        restaurantId,
        orderNumber: `PL-${orderId}`,
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
      }),
    ];

    // Create order items
    for (const { item, menuItemId } of consumedItems) {
      const unitPriceCents = toRequiredCents(item.unitPrice);
      const totalPriceCents = unitPriceCents * item.quantity;

      writes.push(
        this.db.insert(orderItems).values({
          orderId,
          menuItemId,
          quantity: item.quantity,
          unitPriceCents,
          totalPriceCents,
          itemSnapshot: { name: item.name },
          createdAt: now,
        }),
      );
    }

    // A platform order is already paid for, so stock is a record of the sale
    // rather than an availability gate: tracked stock may become negative.
    // Every statement stays in the same D1 batch as the order and its ledger.
    for (const { menuItemId, item } of consumedItems) {
      writes.push(
        this.db
          .update(menuItems)
          .set({
            inventoryCount: sql`CASE WHEN ${menuItems.inventoryCount} IS NULL THEN NULL ELSE ${menuItems.inventoryCount} - ${item.quantity} END`,
          })
          .where(
            and(
              eq(menuItems.id, menuItemId),
              eq(menuItems.restaurantId, restaurantId),
            ),
          ),
      );
    }

    const ingredientConsumption = new IngredientConsumptionService(this.db);
    writes.push(
      ...(await ingredientConsumption.buildConsumptionWrites(
        restaurantId,
        consumedItems.map(({ menuItemId, item }) => ({
          menuItemId,
          quantity: item.quantity,
        })),
        { orderId },
      )),
    );

    for (const { menuItemId, item } of consumedItems) {
      writes.push(
        this.db
          .update(menuItems)
          .set({ orderCount: sql`${menuItems.orderCount} + ${item.quantity}` })
          .where(
            and(
              eq(menuItems.id, menuItemId),
              eq(menuItems.restaurantId, restaurantId),
            ),
          ),
      );
    }
    writes.push(
      this.db
        .update(restaurants)
        .set({ totalOrders: sql`${restaurants.totalOrders} + 1` })
        .where(eq(restaurants.id, restaurantId)),
    );

    // Create platform order mapping. Kept last so the unique index sees a
    // complete order, but it is now inside the same transaction as the rows
    // above, so a rejection takes all of them with it.
    writes.push(
      this.db.insert(platformOrders).values({
        orderId,
        restaurantId,
        platform,
        platformOrderId: parsedOrder.platformOrderId,
        platformStoreId: parsedOrder.platformStoreId,
        platformStatus: "received",
        rawPayload: parsedOrder.rawPayload as Record<string, unknown>,
        createdAt: now,
        updatedAt: now,
      }),
    );

    try {
      await this.db.batch(
        writes as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]],
      );
    } catch (error) {
      // The batch rolled back, so this attempt left nothing behind. If a
      // concurrent delivery won the race, its mapping is committed and this
      // call is a duplicate; anything else is a real failure to report.
      const racedOrder = await this.findMappedOrder(
        platform,
        parsedOrder.platformOrderId,
      );
      if (racedOrder) {
        await this.resumePostCreateProcessing(
          racedOrder.orderId,
          racedOrder.platformStatus,
          restaurantId,
          platform,
          parsedOrder.platformOrderId,
          adapter,
        );
        return racedOrder.orderId;
      }
      throw error;
    }

    await this.resumePostCreateProcessing(
      orderId,
      "received",
      restaurantId,
      platform,
      parsedOrder.platformOrderId,
      adapter,
    );

    return orderId;
  }

  private async resumePostCreateProcessing(
    orderId: string,
    platformStatus: string | null | undefined,
    restaurantId: string,
    platform: PlatformType,
    platformOrderId: string,
    adapter: ReturnType<typeof getAdapter>,
  ): Promise<void> {
    const integration = await this.integrationService.getIntegration(
      restaurantId,
      platform,
    );
    if (integration?.config?.autoAcceptOrders) {
      try {
        if (platformStatus !== "accepted") {
          const creds = await this.integrationService.getDecryptedCredentials(
            restaurantId,
            platform,
          );
          await adapter.acceptOrder(platformOrderId, creds);

          await this.db
            .update(platformOrders)
            .set({ platformStatus: "accepted", updatedAt: new Date() })
            .where(eq(platformOrders.orderId, orderId));
        }

        await this.db
          .update(orders)
          .set({ status: "confirmed", updatedAt: new Date() })
          .where(eq(orders.id, orderId));

        await this.emitKitchenTicket(orderId);
      } catch (error) {
        console.error(`Failed to auto-accept order ${platformOrderId}:`, error);
      }
    }
  }

  /**
   * The existing platform mapping and its acceptance progress, or null when
   * this is the first time we have seen the platform order.
   */
  private async findMappedOrder(
    platform: PlatformType,
    platformOrderId: string,
  ): Promise<{ orderId: string; platformStatus: string | null } | null> {
    const [existing] = await this.db
      .select({
        orderId: platformOrders.orderId,
        platformStatus: platformOrders.platformStatus,
      })
      .from(platformOrders)
      .where(
        and(
          eq(platformOrders.platform, platform),
          eq(platformOrders.platformOrderId, platformOrderId),
        ),
      )
      .limit(1);

    return existing ?? null;
  }

  /**
   * Auto-accept writes the orders row straight to "confirmed" instead of going
   * through OrdersService.updateOrderStatus, so the kitchen ticket has to be
   * queued here too — otherwise a delivery-platform order never reaches the
   * shop's print agent.
   *
   * Failures are swallowed on purpose: the status is already committed, so
   * failing the webhook here would only buy a redelivery that re-runs work
   * already done. A ticket that never printed is observable (the receipt row
   * stays pending). Duplicate calls are harmless twice over —
   * createKitchenTicket refuses to open a second ticket for the same order,
   * and a redelivery no longer re-creates the order it belongs to.
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
