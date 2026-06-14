import {
  eq,
  ne,
  and,
  asc,
  desc,
  count,
  sql,
  gte,
  lte,
  inArray,
} from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { BaseService } from "./base";
import {
  orders,
  orderItems,
  menuItems,
  restaurants,
  tables,
  waitingList,
  couponUsage,
  ORDER_STATUS,
} from "../schema";
import type { Order, SelectedCustomizations } from "@makanmakan/shared-types";
import { amountFromCents, fromCents, toRequiredCents } from "../utils/money";

const cancellableOrderStatuses: readonly string[] = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.CONFIRMED,
];

export interface CreateOrderData {
  restaurantId: string;
  tableId?: number;
  customerId?: string;
  customerInfo?: { name?: string; phone?: string; email?: string };
  waitingListId?: string;
  waitingListCustomerPhone?: string;
  orderType?: "shop" | "table" | "seat";
  items: Array<{
    menuItemId: number;
    quantity: number;
    customizations?: SelectedCustomizations;
    notes?: string;
  }>;
  notes?: string;
  couponCode?: string;
  couponUserId?: number;
  clientMutationId?: string;
  orderSource?:
    | "direct"
    | "market_checkout"
    | "uber_eats"
    | "foodpanda"
    | "grabfood";
  deliveryInfo?: {
    type: "dine_in" | "takeaway" | "delivery";
    address?: string;
    phone?: string;
    instructions?: string;
    deliveryFee?: number;
  };
}

export type AddOrderItemsData = CreateOrderData["items"];

export interface UpdateOrderStatusData {
  status: string;
  notes?: string;
  expectedVersion?: number;
}

export interface OrderFilters {
  restaurantId?: string;
  tableId?: number;
  customerId?: string;
  status?: string | string[];
  dateRange?: [Date, Date];
  minAmount?: number;
  maxAmount?: number;
  sortBy?: "createdAt" | "totalAmount" | "status" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

const ORDER_SORT_COLUMNS = {
  createdAt: orders.createdAt,
  totalAmount: orders.totalAmountCents,
  status: orders.status,
  updatedAt: orders.updatedAt,
} as const;

type MenuItemRecord = typeof menuItems.$inferSelect;
type MenuItemOptions = NonNullable<MenuItemRecord["options"]>;
type MenuItemCustomizationGroup = NonNullable<
  MenuItemOptions["customizations"]
>[number];
type MenuItemCustomizationChoice =
  MenuItemCustomizationGroup["choices"][number];
type SelectedCustomizationOption = NonNullable<
  SelectedCustomizations["options"]
>[number];
type SelectedAddOn = NonNullable<SelectedCustomizations["addOns"]>[number];

type PreparedOrderItem = {
  menuItemId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unitPriceCents: number;
  totalPriceCents: number;
  customizations: SelectedCustomizations | undefined;
  notes: string | undefined;
  itemSnapshot: {
    name: string;
    description?: string;
    imageUrl?: string;
    category: string;
    price: number;
    unitPrice: number;
    customizations: SelectedCustomizations | undefined;
  };
};

function resolveMoneyCents(
  cents: number | string | null | undefined,
  label: string,
): number {
  if (cents != null) {
    const normalizedCents = typeof cents === "string" ? Number(cents) : cents;
    if (Number.isFinite(normalizedCents)) {
      return Math.round(normalizedCents);
    }
  }

  throw new Error(`${label} cents are required`);
}

function normalizeMoneyAmount(
  amount: number | null | undefined,
  label: string,
): number {
  if (amount == null) return 0;
  if (!Number.isFinite(amount)) {
    throw new Error(`${label} must be finite`);
  }
  return amount;
}

function findCatalogChoice(
  groups: MenuItemCustomizationGroup[],
  selected: SelectedCustomizationOption,
  menuItemId: number,
): {
  group: MenuItemCustomizationGroup;
  choice: MenuItemCustomizationChoice;
} {
  const selectedChoiceId = selected.choiceId || selected.id;
  const groupCandidates =
    selected.id && selected.id !== selectedChoiceId
      ? groups.filter((group) => group.id === selected.id)
      : groups;

  for (const group of groupCandidates) {
    const choice = group.choices.find(
      (choice) => choice.id === selectedChoiceId || choice.id === selected.id,
    );
    if (choice) return { group, choice };
  }

  throw new Error(
    `Unknown customization choice ${selectedChoiceId} for menu item ${menuItemId}`,
  );
}

function resolveCatalogCustomizations(
  menuItem: MenuItemRecord,
  selected: SelectedCustomizations | undefined,
): {
  customizations: SelectedCustomizations | undefined;
  additionalUnitPriceCents: number;
} {
  if (!selected) {
    return { customizations: undefined, additionalUnitPriceCents: 0 };
  }

  const catalogOptions = menuItem.options ?? {};
  const customizations: SelectedCustomizations = {};
  let additionalUnitPriceCents = 0;

  if (selected.size) {
    const size = catalogOptions.sizes?.find(
      (catalogSize) => catalogSize.id === selected.size?.id,
    );
    if (!size) {
      throw new Error(
        `Unknown size ${selected.size.id} for menu item ${menuItem.id}`,
      );
    }

    const priceAdjustment = normalizeMoneyAmount(
      size.priceAdjustment,
      `Size ${size.id} price adjustment`,
    );
    additionalUnitPriceCents += toRequiredCents(priceAdjustment);
    customizations.size = {
      id: size.id,
      name: size.name,
      priceAdjustment,
    };
  }

  if (selected.options?.length) {
    const groups = catalogOptions.customizations ?? [];
    const seenChoiceIds = new Set<string>();
    customizations.options = selected.options.map((selectedOption) => {
      const { group, choice } = findCatalogChoice(
        groups,
        selectedOption,
        menuItem.id,
      );
      if (seenChoiceIds.has(choice.id)) {
        throw new Error(
          `Duplicate customization choice ${choice.id} for menu item ${menuItem.id}`,
        );
      }
      seenChoiceIds.add(choice.id);

      const priceAdjustment = normalizeMoneyAmount(
        choice.priceAdjustment,
        `Customization choice ${choice.id} price adjustment`,
      );
      additionalUnitPriceCents += toRequiredCents(priceAdjustment);
      return {
        id: group.id,
        optionName: group.name,
        choiceId: choice.id,
        choiceName: choice.name,
        priceAdjustment,
      };
    });
  }

  if (selected.addOns?.length) {
    const catalogAddOns = catalogOptions.addOns ?? [];
    const seenAddOnIds = new Set<string>();
    customizations.addOns = selected.addOns.map(
      (selectedAddOn: SelectedAddOn) => {
        const addOn = catalogAddOns.find(
          (catalogAddOn) => catalogAddOn.id === selectedAddOn.id,
        );
        if (!addOn) {
          throw new Error(
            `Unknown add-on ${selectedAddOn.id} for menu item ${menuItem.id}`,
          );
        }
        if (seenAddOnIds.has(addOn.id)) {
          throw new Error(
            `Duplicate add-on ${addOn.id} for menu item ${menuItem.id}`,
          );
        }
        seenAddOnIds.add(addOn.id);

        const quantity = selectedAddOn.quantity || 1;
        if (!Number.isInteger(quantity) || quantity < 1) {
          throw new Error(
            `Invalid add-on quantity ${quantity} for menu item ${menuItem.id}`,
          );
        }
        if (addOn.maxQuantity != null && quantity > addOn.maxQuantity) {
          throw new Error(
            `Add-on ${addOn.id} quantity exceeds maximum for menu item ${menuItem.id}`,
          );
        }

        const unitPrice = normalizeMoneyAmount(
          addOn.price,
          `Add-on ${addOn.id} price`,
        );
        const unitPriceCents = toRequiredCents(unitPrice);
        const totalPrice = fromCents(unitPriceCents * quantity);
        additionalUnitPriceCents += unitPriceCents * quantity;
        return {
          id: addOn.id,
          name: addOn.name,
          unitPrice,
          quantity,
          totalPrice,
        };
      },
    );
  }

  if (selected.specialInstructions) {
    customizations.specialInstructions = selected.specialInstructions;
  }

  return {
    customizations:
      Object.keys(customizations).length > 0 ? customizations : undefined,
    additionalUnitPriceCents,
  };
}

// Drizzle's `timestamp_ms` mode returns `Date` objects. The wire contract for
// orders is Unix-ms integers, so convert before leaving the service boundary —
// otherwise `JSON.stringify` silently turns Dates into ISO strings and
// downstream arithmetic like `Date.now() - createdAt` coerces to NaN.
function toMillis(value: Date | number | null | undefined): number | null {
  if (value == null) return null;
  return value instanceof Date ? value.getTime() : value;
}

export class OrderService extends BaseService {
  // 獲取餐廳最低消費設定
  async getMinimumOrderAmount(
    restaurantId: string,
  ): Promise<{ minOrderAmount: number; enabled: boolean }> {
    try {
      const restaurant = await this.db.query.restaurants.findFirst({
        where: eq(restaurants.id, restaurantId),
        columns: {
          settings: true,
          isAvailable: true,
        },
      });

      if (!restaurant) {
        throw new Error("Restaurant not found");
      }

      const settings = restaurant.settings || {};
      const minOrderAmount = settings.minOrderAmount || 0;

      return {
        minOrderAmount,
        enabled: minOrderAmount > 0 && restaurant.isAvailable,
      };
    } catch (error) {
      this.handleError(error, "getMinimumOrderAmount");
    }
  }

  // 驗證訂單是否符合最低消費要求
  async validateMinimumOrder(
    restaurantId: string,
    orderAmount: number,
  ): Promise<{ valid: boolean; message?: string; shortfall?: number }> {
    try {
      const { minOrderAmount, enabled } =
        await this.getMinimumOrderAmount(restaurantId);

      if (!enabled) {
        return { valid: true };
      }

      if (orderAmount >= minOrderAmount) {
        return { valid: true };
      }

      const shortfall = minOrderAmount - orderAmount;
      return {
        valid: false,
        message: `訂單未達最低消費標準。最低消費：RM${minOrderAmount.toFixed(2)}，目前金額：RM${orderAmount.toFixed(2)}，還需：RM${shortfall.toFixed(2)}`,
        shortfall,
      };
    } catch (error) {
      this.handleError(error, "validateMinimumOrder");
    }
  }

  // 創建訂單
  async createOrder(data: CreateOrderData): Promise<Order> {
    try {
      // 驗證餐廳和桌子
      // Convert restaurantId to string for UUID comparison
      const restaurantIdStr = String(data.restaurantId);
      const restaurant = await this.db.query.restaurants.findFirst({
        where: eq(restaurants.id, restaurantIdStr),
      });

      if (!restaurant || !restaurant.isAvailable) {
        throw new Error("Restaurant is not available");
      }

      // Only validate table for dine-in orders (tableId provided)
      if (data.tableId) {
        const table = await this.db.query.tables.findFirst({
          where: eq(tables.id, data.tableId),
        });

        if (!table || !table.isActive) {
          throw new Error("Table is not available");
        }
      }

      if (data.waitingListId) {
        await this.validateWaitingListPreOrder(
          data.waitingListId,
          data.restaurantId,
          data.waitingListCustomerPhone,
        );
      }

      const { subtotalCents, orderItemsData, menuItemMap } =
        await this.prepareOrderItems(data.items);

      const subtotal = fromCents(subtotalCents);

      // 優惠券驗證和折扣計算
      let discountAmount = 0;
      let validatedCoupon = null;
      let couponService: InstanceType<
        typeof import("./coupon").CouponService
      > | null = null;

      if (data.couponCode) {
        const { CouponService } = await import("./coupon");
        couponService = new CouponService(this.d1, this.env);

        const validationResult = await couponService.validateCoupon(
          data.couponCode,
          data.restaurantId.toString(),
          subtotal,
          data.couponUserId,
          data.items,
        );

        if (validationResult.valid) {
          discountAmount = validationResult.discountAmount || 0;
          validatedCoupon = validationResult.coupon;
        } else {
          throw new Error(`優惠券驗證失敗: ${validationResult.error}`);
        }
      }

      // 驗證最低消費（在折扣後但在計算稅金前）
      const settings = restaurant.settings || {};
      const minOrderAmount = settings.minOrderAmount || 0;
      const orderAmountAfterDiscount = subtotal - discountAmount;

      if (minOrderAmount > 0 && orderAmountAfterDiscount < minOrderAmount) {
        const shortfall = minOrderAmount - orderAmountAfterDiscount;
        throw new Error(
          `訂單未達最低消費標準。最低消費：RM${minOrderAmount.toFixed(2)}，目前金額：RM${orderAmountAfterDiscount.toFixed(2)}，還需：RM${shortfall.toFixed(2)}`,
        );
      }

      // 計算稅金和服務費（考慮折扣）
      const taxRate = settings.taxRate || 0;
      const serviceChargeRate = settings.serviceChargeRate || 0;
      const {
        taxAmountCents,
        serviceChargeCents,
        discountAmountCents,
        totalAmountCents,
      } = this.calculateOrderTotal(
        subtotal,
        taxRate,
        serviceChargeRate,
        discountAmount,
      );

      // 生成訂單號碼
      const orderNumber = this.generateOrderNumber(data.restaurantId);

      // ---- 原子寫入階段 ----
      // 生產環境 D1 不支援互動式 BEGIN（db.transaction 必定失敗），
      // 唯一的原子提交原語是 db.batch：整批語句在單一交易中循序執行，
      // 任一失敗即全部回滾 — 不會留下孤兒訂單、優惠券消耗或庫存漂移。
      // orders.id 是 autoincrement，order_items / coupon_usage 透過唯一的
      // order_number 子查詢在同一批次內回填外鍵。
      const orderIdRef = sql<number>`(select ${orders.id} from ${orders} where ${orders.orderNumber} = ${orderNumber})`;

      const writeStatements: BatchItem<"sqlite">[] = [
        this.db
          .insert(orders)
          .values({
            restaurantId: data.restaurantId,
            tableId: data.tableId,
            customerId: data.customerId,
            waitingListId: data.waitingListId,
            orderNumber,
            orderType: data.orderType,
            subtotalCents,
            taxAmountCents,
            serviceChargeCents,
            discountAmountCents,
            totalAmountCents,
            customerInfo: data.customerInfo,
            notes: data.notes,
            couponCode: data.couponCode,
            ...(data.clientMutationId
              ? { clientMutationId: data.clientMutationId }
              : {}),
            orderSource: data.orderSource || "direct",
            deliveryInfo: data.deliveryInfo,
            estimatedPrepTime: this.calculateEstimatedPrepTime(orderItemsData),
          })
          .returning(),
        this.db
          .insert(orderItems)
          .values(
            orderItemsData.map((item) => ({
              ...this.toOrderItemInsert(item),
              orderId: orderIdRef as unknown as number,
            })),
          )
          .returning(),
      ];

      // 優惠券：先以條件式 UPDATE 佔用名額（內含上限檢查），
      // 使用記錄則跟訂單同批寫入；批次失敗時於下方歸還名額。
      let claimedCouponId: number | null = null;
      const claimedInventory: Array<{
        menuItemId: number;
        quantity: number;
      }> = [];
      const releaseClaimedCoupon = async () => {
        if (claimedCouponId !== null && couponService) {
          try {
            await couponService.releaseUsageSlot(claimedCouponId);
          } catch (releaseError) {
            console.error("Coupon slot release failed:", releaseError);
          }
        }
      };
      const restoreClaimedInventory = async () => {
        for (const claim of [...claimedInventory].reverse()) {
          try {
            await this.db
              .update(menuItems)
              .set({
                inventoryCount: sql`CASE WHEN ${menuItems.inventoryCount} IS NULL THEN NULL ELSE ${menuItems.inventoryCount} + ${claim.quantity} END`,
              })
              .where(eq(menuItems.id, claim.menuItemId));
          } catch (restoreError) {
            console.error("Inventory claim restore failed:", restoreError);
          }
        }
      };
      if (validatedCoupon && discountAmount > 0 && couponService) {
        await couponService.claimUsageSlot(validatedCoupon.id);
        claimedCouponId = validatedCoupon.id;
        writeStatements.push(
          this.db.insert(couponUsage).values({
            couponId: validatedCoupon.id,
            orderId: orderIdRef as unknown as number,
            userId: data.couponUserId,
            discountAmountCents: toRequiredCents(discountAmount),
            originalAmountCents: toRequiredCents(subtotal),
            finalAmountCents: totalAmountCents,
            status: "active",
          }),
        );
      }

      // 更新菜品訂購次數/庫存與餐廳訂單數（與訂單同批原子提交）
      try {
        for (const { menuItemId, quantity } of data.items) {
          const menuItem = menuItemMap.get(menuItemId);
          const [claim] = await this.db
            .update(menuItems)
            .set({
              inventoryCount: sql`CASE WHEN ${menuItems.inventoryCount} IS NULL THEN NULL ELSE ${menuItems.inventoryCount} - ${quantity} END`,
            })
            .where(
              and(
                eq(menuItems.id, menuItemId),
                sql`(${menuItems.inventoryCount} IS NULL OR ${menuItems.inventoryCount} >= ${quantity})`,
              ),
            )
            .returning({
              id: menuItems.id,
              inventoryCount: menuItems.inventoryCount,
            });

          if (!claim) {
            throw new Error(
              `Insufficient inventory for ${menuItem?.name ?? menuItemId}`,
            );
          }

          if (claim.inventoryCount !== null) {
            claimedInventory.push({ menuItemId, quantity });
          }
        }
      } catch (error) {
        await restoreClaimedInventory();
        await releaseClaimedCoupon();
        throw error;
      }

      for (const { menuItemId, quantity } of data.items) {
        writeStatements.push(
          this.db
            .update(menuItems)
            .set({
              orderCount: sql`${menuItems.orderCount} + ${quantity}`,
            })
            .where(eq(menuItems.id, menuItemId)),
        );
      }
      writeStatements.push(
        this.db
          .update(restaurants)
          .set({
            totalOrders: sql`${restaurants.totalOrders} + 1`,
          })
          .where(eq(restaurants.id, data.restaurantId)),
      );

      let batchResults: unknown[];
      try {
        batchResults = await this.db.batch(
          writeStatements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]],
        );
      } catch (error) {
        await restoreClaimedInventory();
        await releaseClaimedCoupon();
        throw error;
      }

      const [order] = batchResults[0] as (typeof orders.$inferSelect)[];
      const items = batchResults[1] as (typeof orderItems.$inferSelect)[];

      // Re-fetch with full relations (menuItem name/image) so callers
      // and downstream caches get complete data. The insert().returning()
      // above only returns columns from the order_items table itself.
      try {
        const fullOrder = await this.getOrder(order.id);
        if (fullOrder) return fullOrder;
      } catch {
        // Some legacy adapters do not expose query.orders;
        // fall back to the inserted rows instead of failing order creation.
      }

      // Fallback: should not happen, but safe to degrade gracefully
      return this.mapToOrder({ ...order, items });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Different SQLite / D1 surfaces quote the UNIQUE violation column
      // differently:
      //   - local miniflare:    "UNIQUE constraint failed: orders.restaurant_id, orders.client_mutation_id"
      //   - CI wrangler dev D1: "Failed query: insert into \"orders\" (..., \"client_mutation_id\", ...)"
      // Match on the column name alone so both formats map to the
      // same CLIENT_MUTATION_DUPLICATE path that the route translates
      // to 409.
      if (
        message.includes("UNIQUE constraint failed") &&
        message.includes("client_mutation_id")
      ) {
        throw new Error("CLIENT_MUTATION_DUPLICATE");
      }

      if (
        message.includes("UNIQUE constraint failed") &&
        message.includes("waiting_list_id")
      ) {
        throw new Error("WAITING_LIST_PREORDER_EXISTS");
      }

      this.handleError(error, "createOrder");
    }
  }

  private async validateWaitingListPreOrder(
    waitingListId: string,
    restaurantId: string,
    customerPhone?: string,
  ): Promise<void> {
    const entry = await this.db.query.waitingList.findFirst({
      where: eq(waitingList.id, waitingListId),
    });

    if (!entry || entry.restaurantId !== restaurantId) {
      throw new Error("WAITING_LIST_TICKET_NOT_FOUND");
    }

    if (!["waiting", "called", "confirmed"].includes(entry.status)) {
      throw new Error("WAITING_LIST_TICKET_NOT_ACTIVE");
    }

    if (!customerPhone || entry.customerPhone !== customerPhone) {
      throw new Error("WAITING_LIST_PHONE_MISMATCH");
    }
  }

  async confirmWaitingListPreOrders(
    waitingListId: string,
    tableId: number,
  ): Promise<Order[]> {
    const now = new Date();
    await this.db
      .update(orders)
      .set({
        tableId,
        status: ORDER_STATUS.CONFIRMED,
        confirmedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(orders.waitingListId, waitingListId),
          eq(orders.status, ORDER_STATUS.PENDING),
        ),
      );

    const confirmedOrders = await this.db.query.orders.findMany({
      where: and(
        eq(orders.waitingListId, waitingListId),
        eq(orders.status, ORDER_STATUS.CONFIRMED),
      ),
      with: {
        restaurant: {
          columns: { id: true, name: true },
        },
        table: {
          columns: { id: true, number: true },
        },
        items: {
          with: {
            menuItem: {
              columns: { id: true, name: true, imageUrl: true },
            },
          },
        },
      },
    });

    return confirmedOrders.map((order) => this.mapToOrder(order));
  }

  async cancelWaitingListPreOrders(waitingListId: string): Promise<void> {
    const now = new Date();
    await this.db
      .update(orders)
      .set({
        status: ORDER_STATUS.CANCELLED,
        cancelledAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(orders.waitingListId, waitingListId),
          eq(orders.status, ORDER_STATUS.PENDING),
        ),
      );
  }

  // 獲取訂單詳情
  async getOrder(id: number): Promise<Order | null> {
    try {
      const order = await this.db.query.orders.findFirst({
        where: eq(orders.id, id),
        with: {
          restaurant: {
            columns: {
              id: true,
              name: true,
              phone: true,
            },
          },
          table: {
            columns: {
              id: true,
              number: true,
            },
          },
          customer: {
            columns: {
              id: true,
              displayName: true,
              primaryPhone: true,
            },
          },
          items: {
            with: {
              menuItem: {
                columns: {
                  id: true,
                  name: true,
                  imageUrl: true,
                },
              },
            },
          },
        },
      });

      return order ? this.mapToOrder(order) : null;
    } catch (error) {
      this.handleError(error, "getOrder");
    }
  }

  async addItemsToOrder(id: number, items: AddOrderItemsData): Promise<Order> {
    try {
      if (!items.length) {
        throw new Error("Order must contain at least one item");
      }

      const existingOrder = await this.db.query.orders.findFirst({
        where: eq(orders.id, id),
      });
      if (!existingOrder) {
        throw new Error("Order not found");
      }
      const canAddItems = [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED].some(
        (status) => status === existingOrder.status,
      );
      if (!canAddItems) {
        throw new Error(
          `Cannot add items to an order with status: ${existingOrder.status}`,
        );
      }

      const { subtotalCents: addedSubtotalCents, orderItemsData } =
        await this.prepareOrderItems(items);

      const currentSubtotalCents = resolveMoneyCents(
        existingOrder.subtotalCents,
        "Order subtotal",
      );
      const currentTaxCents = resolveMoneyCents(
        existingOrder.taxAmountCents,
        "Order tax amount",
      );
      const currentServiceChargeCents = resolveMoneyCents(
        existingOrder.serviceChargeCents,
        "Order service charge",
      );
      const currentDiscountCents = resolveMoneyCents(
        existingOrder.discountAmountCents,
        "Order discount amount",
      );
      const taxRate =
        currentSubtotalCents > 0 ? currentTaxCents / currentSubtotalCents : 0;
      const serviceChargeRate =
        currentSubtotalCents > 0
          ? currentServiceChargeCents / currentSubtotalCents
          : 0;
      const nextSubtotal = fromCents(currentSubtotalCents + addedSubtotalCents);
      const {
        subtotalCents,
        taxAmountCents,
        serviceChargeCents,
        totalAmountCents,
      } = this.calculateOrderTotal(
        nextSubtotal,
        taxRate,
        serviceChargeRate,
        fromCents(currentDiscountCents),
      );

      const claimedInventory: Array<{
        menuItemId: number;
        quantity: number;
      }> = [];
      const restoreClaimedInventory = async () => {
        for (const claim of [...claimedInventory].reverse()) {
          try {
            await this.db
              .update(menuItems)
              .set({
                inventoryCount: sql`CASE WHEN ${menuItems.inventoryCount} IS NULL THEN NULL ELSE ${menuItems.inventoryCount} + ${claim.quantity} END`,
              })
              .where(eq(menuItems.id, claim.menuItemId));
          } catch (restoreError) {
            console.error("Inventory claim restore failed:", restoreError);
          }
        }
      };

      try {
        for (const { menuItemId, quantity } of items) {
          const [claim] = await this.db
            .update(menuItems)
            .set({
              inventoryCount: sql`CASE WHEN ${menuItems.inventoryCount} IS NULL THEN NULL ELSE ${menuItems.inventoryCount} - ${quantity} END`,
            })
            .where(
              and(
                eq(menuItems.id, menuItemId),
                sql`(${menuItems.inventoryCount} IS NULL OR ${menuItems.inventoryCount} >= ${quantity})`,
              ),
            )
            .returning({
              id: menuItems.id,
              inventoryCount: menuItems.inventoryCount,
            });

          if (!claim) {
            throw new Error(`Insufficient inventory for ${menuItemId}`);
          }

          if (claim.inventoryCount !== null) {
            claimedInventory.push({ menuItemId, quantity });
          }
        }
      } catch (error) {
        await restoreClaimedInventory();
        throw error;
      }

      const writeStatements: BatchItem<"sqlite">[] = [
        this.db
          .insert(orderItems)
          .values(
            orderItemsData.map((item) => ({
              ...this.toOrderItemInsert(item),
              orderId: id,
            })),
          )
          .returning(),
        this.db
          .update(orders)
          .set({
            subtotalCents,
            taxAmountCents,
            serviceChargeCents,
            totalAmountCents,
            version: sql`${orders.version} + 1`,
            estimatedPrepTime: Math.max(
              existingOrder.estimatedPrepTime ?? 0,
              this.calculateEstimatedPrepTime(orderItemsData),
            ),
            updatedAt: new Date(),
          })
          .where(eq(orders.id, id)),
      ];

      for (const { menuItemId, quantity } of items) {
        writeStatements.push(
          this.db
            .update(menuItems)
            .set({
              orderCount: sql`${menuItems.orderCount} + ${quantity}`,
            })
            .where(eq(menuItems.id, menuItemId)),
        );
      }

      try {
        await this.db.batch(
          writeStatements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]],
        );
      } catch (error) {
        await restoreClaimedInventory();
        throw error;
      }

      const updatedOrder = await this.getOrder(id);
      if (!updatedOrder) {
        throw new Error("Order not found");
      }
      return updatedOrder;
    } catch (error) {
      this.handleError(error, "addItemsToOrder");
    }
  }

  // 根據訂單號獲取訂單
  async getOrderByNumber(orderNumber: string): Promise<Order | null> {
    try {
      const order = await this.db.query.orders.findFirst({
        where: eq(orders.orderNumber, orderNumber),
        with: {
          restaurant: true,
          table: true,
          customer: true,
          items: {
            with: {
              menuItem: true,
            },
          },
        },
      });

      return order ? this.mapToOrder(order) : null;
    } catch (error) {
      this.handleError(error, "getOrderByNumber");
    }
  }

  // 獲取訂單列表
  async getOrders(
    filters: OrderFilters = {},
    page: number = 1,
    limit: number = 20,
  ) {
    try {
      const { offset } = this.createPagination(page, limit);
      const conditions = [];

      if (filters.restaurantId) {
        conditions.push(eq(orders.restaurantId, filters.restaurantId));
      }

      if (filters.tableId) {
        conditions.push(eq(orders.tableId, filters.tableId));
      }

      if (filters.customerId) {
        conditions.push(eq(orders.customerId, filters.customerId));
      }

      if (filters.status !== undefined && filters.status !== null) {
        if (Array.isArray(filters.status)) {
          // Handle status array with inArray
          conditions.push(inArray(orders.status, filters.status));
        } else {
          // Handle single status with eq
          conditions.push(eq(orders.status, filters.status));
        }
      }

      if (filters.dateRange) {
        const [startDate, endDate] = filters.dateRange;
        conditions.push(
          and(gte(orders.createdAt, startDate), lte(orders.createdAt, endDate)),
        );
      }

      if (filters.minAmount) {
        conditions.push(
          gte(orders.totalAmountCents, toRequiredCents(filters.minAmount)),
        );
      }

      if (filters.maxAmount) {
        conditions.push(
          lte(orders.totalAmountCents, toRequiredCents(filters.maxAmount)),
        );
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const sortDirection = filters.sortOrder === "asc" ? asc : desc;
      const sortColumn =
        ORDER_SORT_COLUMNS[filters.sortBy ?? "createdAt"] ?? orders.createdAt;

      const orderList = await this.db.query.orders.findMany({
        where: whereClause,
        with: {
          restaurant: {
            columns: { id: true, name: true },
          },
          table: {
            columns: { id: true, number: true },
          },
          items: {
            with: {
              menuItem: {
                columns: { id: true, name: true, imageUrl: true },
              },
            },
          },
        },
        orderBy: sortDirection(sortColumn),
        limit,
        offset,
      });

      const countResult = await this.db
        .select({ totalCount: count() })
        .from(orders)
        .where(whereClause);

      const totalCount = countResult?.[0]?.totalCount ?? 0;

      return {
        orders: orderList.map((order) => this.mapToOrder(order)),
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error) {
      this.handleError(error, "getOrders");
    }
  }

  // 更新訂單狀態
  async updateOrderStatus(
    id: number,
    data: UpdateOrderStatusData,
  ): Promise<Order> {
    try {
      const statusField = `${data.status}At`;
      const updateData: Record<string, unknown> = {
        status: data.status,
        version: sql`${orders.version} + 1`,
        updatedAt: new Date(),
      };

      // 設置狀態時間戳
      if (
        [
          "confirmed",
          "preparing",
          "ready",
          "delivered",
          "paid",
          "cancelled",
        ].includes(data.status)
      ) {
        updateData[statusField] = new Date();
      }

      // 添加備註
      if (data.notes) {
        updateData.internalNotes = data.notes;
      }

      const [order] = await this.db
        .update(orders)
        .set(updateData)
        .where(
          data.expectedVersion == null
            ? eq(orders.id, id)
            : and(eq(orders.id, id), eq(orders.version, data.expectedVersion)),
        )
        .returning();

      if (!order) {
        if (data.expectedVersion != null) {
          throw new Error("Order version conflict");
        }
        throw new Error("Order not found");
      }

      // 如果訂單完成，釋放桌子（僅限有桌號的訂單）
      if (
        (data.status === ORDER_STATUS.PAID ||
          data.status === ORDER_STATUS.DELIVERED) &&
        order.tableId
      ) {
        await this.db
          .update(tables)
          .set({
            isOccupied: false,
            currentOrderId: null,
            occupiedAt: null,
            occupiedBy: null,
          })
          .where(eq(tables.id, order.tableId));
      }

      return this.mapToOrder(order);
    } catch (error) {
      this.handleError(error, "updateOrderStatus");
    }
  }

  // 取消訂單
  async cancelOrder(id: number, reason?: string): Promise<Order> {
    try {
      const order = await this.getOrder(id);
      if (!order) {
        throw new Error("Order not found");
      }

      if (!cancellableOrderStatuses.includes(order.status)) {
        throw new Error("Order cannot be cancelled");
      }

      const now = new Date();
      const writeStatements: BatchItem<"sqlite">[] = (order.items || []).map(
        (item) =>
          this.db
            .update(menuItems)
            .set({
              inventoryCount: sql`CASE WHEN ${menuItems.inventoryCount} IS NULL THEN NULL ELSE ${menuItems.inventoryCount} + ${item.quantity} END`,
            })
            .where(
              and(
                eq(menuItems.id, item.menuItemId),
                sql`EXISTS (
                  SELECT 1 FROM ${orders}
                  WHERE ${orders.id} = ${id}
                    AND ${orders.status} IN (${sql.join(
                      cancellableOrderStatuses.map((status) => sql`${status}`),
                      sql`, `,
                    )})
                )`,
              ),
            ),
      );

      writeStatements.push(
        this.db
          .update(orders)
          .set({
            status: ORDER_STATUS.CANCELLED,
            notes: reason,
            updatedAt: now,
            version: sql`${orders.version} + 1`,
          })
          .where(
            and(
              eq(orders.id, id),
              inArray(orders.status, [...cancellableOrderStatuses]),
            ),
          )
          .returning({ id: orders.id }),
      );

      const batchResults = await this.db.batch(
        writeStatements as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]],
      );
      const cancelledRows = batchResults.at(-1) as Array<{ id: number }>;
      if (cancelledRows.length === 0) {
        throw new Error("Order cannot be cancelled");
      }

      const cancelledOrder = await this.getOrder(id);
      if (!cancelledOrder) {
        throw new Error("Order not found");
      }
      return cancelledOrder;
    } catch (error) {
      this.handleError(error, "cancelOrder");
    }
  }

  // 獲取餐廳當日訂單統計
  async getDailyOrderStats(restaurantId: string, date: Date = new Date()) {
    try {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const stats = await this.db
        .select({
          totalOrders: count(),
          totalRevenue: sql<number>`SUM(COALESCE(${orders.totalAmountCents}, 0)) / 100.0`,
          avgOrderValue: sql<number>`AVG(COALESCE(${orders.totalAmountCents}, 0)) / 100.0`,
          pendingOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'pending' THEN 1 ELSE 0 END)`,
          confirmedOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'confirmed' THEN 1 ELSE 0 END)`,
          completedOrders: sql<number>`SUM(CASE WHEN ${orders.status} IN ('delivered', 'paid') THEN 1 ELSE 0 END)`,
          cancelledOrders: sql<number>`SUM(CASE WHEN ${orders.status} = 'cancelled' THEN 1 ELSE 0 END)`,
        })
        .from(orders)
        .where(
          and(
            eq(orders.restaurantId, restaurantId),
            gte(orders.createdAt, startOfDay),
            lte(orders.createdAt, endOfDay),
          ),
        );

      return (
        stats[0] || {
          totalOrders: 0,
          totalRevenue: 0,
          avgOrderValue: 0,
          pendingOrders: 0,
          confirmedOrders: 0,
          completedOrders: 0,
          cancelledOrders: 0,
        }
      );
    } catch (error) {
      this.handleError(error, "getDailyOrderStats");
    }
  }

  // 更新訂單項目狀態 — Drizzle-based CAS: matches row only when the
  // current status differs from the target, preventing two chefs from
  // completing the same item in parallel (H2 release gate).
  async updateOrderItemStatus(
    itemId: number,
    status: string,
    notes?: string,
  ): Promise<void> {
    try {
      const now = new Date();
      const updateData: Partial<typeof orderItems.$inferInsert> = {
        status,
        updatedAt: now,
      };
      if (notes) {
        updateData.kitchenNotes = notes;
      }
      if (status === "ready" || status === "completed") {
        updateData.preparedAt = now;
      }
      if (status === "served") {
        updateData.servedAt = now;
      }
      if (status === "cancelled") {
        updateData.cancelledAt = now;
      }

      const updated = await this.db
        .update(orderItems)
        .set(updateData)
        .where(and(eq(orderItems.id, itemId), ne(orderItems.status, status)))
        .returning({ id: orderItems.id });

      if (updated.length === 0) {
        throw new Error("Order item status conflict");
      }
    } catch (error) {
      this.handleError(error, "updateOrderItemStatus");
    }
  }

  private async prepareOrderItems(items: CreateOrderData["items"]): Promise<{
    subtotalCents: number;
    orderItemsData: PreparedOrderItem[];
    menuItemMap: Map<number, MenuItemRecord>;
  }> {
    let subtotalCents = 0;
    const orderItemsData: PreparedOrderItem[] = [];

    const menuItemIds = items.map((item) => item.menuItemId);
    const fetchedMenuItems = await this.db.query.menuItems.findMany({
      where: inArray(menuItems.id, menuItemIds),
    });
    const menuItemMap = new Map(
      fetchedMenuItems.map((item) => [item.id, item]),
    );
    const requestedQuantities = new Map<number, number>();

    for (const item of items) {
      const menuItem = menuItemMap.get(item.menuItemId);

      if (!menuItem || !menuItem.isAvailable) {
        throw new Error(`Menu item ${item.menuItemId} is not available`);
      }

      const requestedTotal =
        (requestedQuantities.get(item.menuItemId) ?? 0) + item.quantity;
      requestedQuantities.set(item.menuItemId, requestedTotal);
      if (
        menuItem.inventoryCount !== null &&
        menuItem.inventoryCount < requestedTotal
      ) {
        throw new Error(`Insufficient inventory for ${menuItem.name}`);
      }

      let unitPriceCents = resolveMoneyCents(
        menuItem.priceCents,
        `Menu item ${menuItem.id} price`,
      );
      const { customizations, additionalUnitPriceCents } =
        resolveCatalogCustomizations(menuItem, item.customizations);
      unitPriceCents += additionalUnitPriceCents;

      const totalPriceCents = unitPriceCents * item.quantity;
      const unitPrice = fromCents(unitPriceCents);
      const totalPrice = fromCents(totalPriceCents);
      subtotalCents += totalPriceCents;

      orderItemsData.push({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
        unitPriceCents,
        totalPriceCents,
        customizations,
        notes: item.notes,
        itemSnapshot: {
          name: menuItem.name,
          description: menuItem.description || undefined,
          imageUrl: menuItem.imageUrl || undefined,
          category: String(menuItem.categoryId),
          price: amountFromCents(menuItem.priceCents) ?? 0,
          unitPrice,
          customizations,
        },
      });
    }

    return { subtotalCents, orderItemsData, menuItemMap };
  }

  // 計算預估準備時間
  private calculateEstimatedPrepTime(orderItems: any[]): number {
    let maxPrepTime = 0;
    let totalComplexity = 0;

    for (const item of orderItems) {
      // 基礎準備時間（預設 15 分鐘）
      const basePrepTime = 15;

      // 根據客製化增加時間
      let itemComplexity = 1;
      if (item.customizations?.options?.length > 0) {
        itemComplexity += item.customizations.options.length * 0.2;
      }
      if (item.customizations?.addOns?.length > 0) {
        itemComplexity += item.customizations.addOns.length * 0.1;
      }

      const itemPrepTime = basePrepTime * itemComplexity * item.quantity;
      maxPrepTime = Math.max(maxPrepTime, itemPrepTime);
      totalComplexity += itemComplexity;
    }

    // 綜合計算：取最長時間和平均複雜度的平衡
    return Math.ceil(Math.max(maxPrepTime, totalComplexity * 10));
  }

  private toOrderItemInsert(item: PreparedOrderItem) {
    const { unitPrice, totalPrice, ...insertItem } = item;
    void unitPrice;
    void totalPrice;
    return insertItem;
  }

  // 資料轉換
  private mapToOrder(order: any): Order {
    const mapOrderItem = (item: any) => {
      const snapshot = item.itemSnapshot;
      const snapshotMenuItem = snapshot
        ? {
            ...(item.menuItem || {}),
            name: snapshot.name,
            description: snapshot.description,
            imageUrl: snapshot.imageUrl,
            price: snapshot.price ?? amountFromCents(item.unitPriceCents),
          }
        : item.menuItem;

      return {
        id: item.id,
        orderId: item.orderId,
        menuItemId: item.menuItemId,
        name: snapshot?.name ?? item.menuItem?.name,
        description: snapshot?.description ?? item.menuItem?.description,
        imageUrl: snapshot?.imageUrl ?? item.menuItem?.imageUrl,
        quantity: item.quantity,
        unitPrice: amountFromCents(item.unitPriceCents),
        totalPrice: amountFromCents(item.totalPriceCents),
        customizations: item.customizations,
        itemSnapshot: snapshot,
        notes: item.notes,
        status: item.status,
        menuItem: snapshotMenuItem,
        createdAt: toMillis(item.createdAt),
        updatedAt: toMillis(item.updatedAt),
      };
    };

    return {
      id: order.id,
      restaurantId: order.restaurantId,
      tableId: order.tableId,
      customerId: order.customerId,
      waitingListId: order.waitingListId,
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      status: order.status,
      version: order.version,
      orderSource: order.orderSource,
      subtotal: amountFromCents(order.subtotalCents),
      taxAmount: amountFromCents(order.taxAmountCents),
      serviceCharge: amountFromCents(order.serviceChargeCents),
      discountAmount: amountFromCents(order.discountAmountCents),
      totalAmount: amountFromCents(order.totalAmountCents),
      customerInfo: order.customerInfo,
      estimatedPrepTime: order.estimatedPrepTime,
      actualPrepTime: order.actualPrepTime,
      confirmedAt: toMillis(order.confirmedAt),
      preparingAt: toMillis(order.preparingAt),
      readyAt: toMillis(order.readyAt),
      deliveredAt: toMillis(order.deliveredAt),
      paidAt: toMillis(order.paidAt),
      cancelledAt: toMillis(order.cancelledAt),
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      rating: order.rating,
      reviewComment: order.reviewComment,
      notes: order.notes,
      internalNotes: order.internalNotes,
      deliveryInfo: order.deliveryInfo,
      items: order.items?.map(mapOrderItem) || [],
      restaurant: order.restaurant,
      table: order.table,
      customer: order.customer,
      createdAt: toMillis(order.createdAt)!,
      updatedAt: toMillis(order.updatedAt)!,
    } as Order;
  }
}
