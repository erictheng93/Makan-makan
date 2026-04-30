/**
 * Order Factory for Test Data Generation
 */

import {
  BaseFactory,
  type FactoryOptions,
  randomString,
  randomChoice,
  randomNumber,
  randomBoolean,
  currentTimestamp,
  pastTimestamp,
} from "./base.factory";

/**
 * 訂單測試數據
 */
export interface OrderTestData {
  id?: number;
  restaurantId: number;
  tableId: number | null;
  customerId: number | null;
  orderNumber: string;
  status: string;
  orderType: string;
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  discountAmount: number;
  totalAmount: number;
  customerInfo: Record<string, any>;
  estimatedPrepTime: number | null;
  actualPrepTime: number | null;
  confirmedAt: number | null;
  preparingAt: number | null;
  readyAt: number | null;
  deliveredAt: number | null;
  paidAt: number | null;
  cancelledAt: number | null;
  paymentMethod: string | null;
  paymentStatus: string;
  paymentTransactionId: string | null;
  couponCode: string | null;
  promotionIds: string | null;
  rating: number | null;
  reviewComment: string | null;
  reviewedAt: number | null;
  notes: string | null;
  internalNotes: string | null;
  cancellationReason: string | null;
  refundAmount: number | null;
  deliveryInfo: Record<string, any> | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * 訂單項目測試數據
 */
export interface OrderItemTestData {
  id?: number;
  orderId: number;
  menuItemId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  itemSnapshot: Record<string, any>;
  customizations: Record<string, any>;
  status: string;
  preparedAt: number | null;
  servedAt: number | null;
  notes: string | null;
  kitchenNotes: string | null;
  cancelledAt: number | null;
  cancellationReason: string | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * 訂單狀態
 */
export const OrderStatus = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PREPARING: "preparing",
  READY: "ready",
  DELIVERED: "delivered",
  PAID: "paid",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
} as const;

/**
 * 訂單類型
 */
export const OrderType = {
  TABLE: "table",
  TAKEAWAY: "takeaway",
  DELIVERY: "delivery",
  SHOP_QR: "shop_qr",
} as const;

/**
 * 付款方式
 */
export const PaymentMethods = {
  CASH: "cash",
  CREDIT_CARD: "credit_card",
  DEBIT_CARD: "debit_card",
  MOBILE_PAY: "mobile_pay",
  LINE_PAY: "line_pay",
  APPLE_PAY: "apple_pay",
} as const;

const confirmedTimestampStatuses: readonly string[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.DELIVERED,
  OrderStatus.PAID,
];

const preparingTimestampStatuses: readonly string[] = [
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.DELIVERED,
  OrderStatus.PAID,
];

const readyTimestampStatuses: readonly string[] = [
  OrderStatus.READY,
  OrderStatus.DELIVERED,
  OrderStatus.PAID,
];

const deliveredTimestampStatuses: readonly string[] = [
  OrderStatus.DELIVERED,
  OrderStatus.PAID,
];

/**
 * 訂單工廠
 */
export class OrderFactory extends BaseFactory<OrderTestData> {
  build(options?: FactoryOptions<OrderTestData>): OrderTestData {
    const sequence = options?.sequence ?? this.getNextSequence();
    const restaurantId = options?.relations?.restaurantId ?? 1;
    const tableId = options?.relations?.tableId ?? randomNumber(1, 20);
    const customerId = options?.relations?.customerId ?? randomNumber(1, 100);

    const subtotal = randomNumber(200, 2000);
    const taxAmount = Math.round(subtotal * 0.05);
    const serviceCharge = Math.round(subtotal * 0.1);
    const discountAmount = randomBoolean(0.3) ? randomNumber(20, 200) : 0;
    const totalAmount = subtotal + taxAmount + serviceCharge - discountAmount;

    const status =
      options?.overrides?.status ??
      randomChoice([
        OrderStatus.PENDING,
        OrderStatus.CONFIRMED,
        OrderStatus.PREPARING,
        OrderStatus.READY,
        OrderStatus.DELIVERED,
        OrderStatus.PAID,
      ]);

    const now = currentTimestamp();

    const baseData: OrderTestData = {
      id: sequence + 1,
      restaurantId,
      tableId,
      customerId,
      orderNumber: `ORD-${now}-${randomString(6).toUpperCase()}`,
      status,
      orderType: OrderType.TABLE,
      subtotal,
      taxAmount,
      serviceCharge,
      discountAmount,
      totalAmount,
      customerInfo: {
        name: `顧客 ${customerId}`,
        phone: `09${randomNumber(10000000, 99999999)}`,
        email: `customer${customerId}@test.com`,
      },
      estimatedPrepTime: randomNumber(15, 45),
      actualPrepTime: status === OrderStatus.PAID ? randomNumber(15, 60) : null,
      confirmedAt: confirmedTimestampStatuses.includes(status)
        ? pastTimestamp(0.02) // 30 minutes ago
        : null,
      preparingAt: preparingTimestampStatuses.includes(status)
        ? pastTimestamp(0.01) // 15 minutes ago
        : null,
      readyAt: readyTimestampStatuses.includes(status)
        ? pastTimestamp(0.005) // 7 minutes ago
        : null,
      deliveredAt: deliveredTimestampStatuses.includes(status)
        ? pastTimestamp(0.002) // 3 minutes ago
        : null,
      paidAt: status === OrderStatus.PAID ? now : null,
      cancelledAt: status === OrderStatus.CANCELLED ? now : null,
      paymentMethod:
        status === OrderStatus.PAID
          ? randomChoice([
              PaymentMethods.CASH,
              PaymentMethods.CREDIT_CARD,
              PaymentMethods.MOBILE_PAY,
            ])
          : null,
      paymentStatus: status === OrderStatus.PAID ? "paid" : "pending",
      paymentTransactionId:
        status === OrderStatus.PAID
          ? `TXN-${randomString(16).toUpperCase()}`
          : null,
      couponCode: randomBoolean(0.2) ? `DISCOUNT${randomNumber(10, 99)}` : null,
      promotionIds: null,
      rating:
        status === OrderStatus.PAID && randomBoolean(0.5)
          ? randomNumber(3, 5)
          : null,
      reviewComment: null,
      reviewedAt: null,
      notes: randomBoolean(0.3) ? "請少油少鹽" : null,
      internalNotes: randomBoolean(0.1) ? "常客,優先處理" : null,
      cancellationReason: status === OrderStatus.CANCELLED ? "客戶取消" : null,
      refundAmount: status === OrderStatus.CANCELLED ? totalAmount : null,
      deliveryInfo: null,
      createdAt: pastTimestamp(0.05), // 1 hour ago
      updatedAt: now,
    };

    return {
      ...baseData,
      ...options?.overrides,
    };
  }

  /**
   * 生成待處理訂單
   */
  buildPending(options?: FactoryOptions<OrderTestData>): OrderTestData {
    return this.build({
      ...options,
      overrides: {
        status: OrderStatus.PENDING,
        confirmedAt: null,
        preparingAt: null,
        readyAt: null,
        deliveredAt: null,
        paidAt: null,
        ...options?.overrides,
      },
    });
  }

  /**
   * 生成進行中訂單
   */
  buildInProgress(options?: FactoryOptions<OrderTestData>): OrderTestData {
    return this.build({
      ...options,
      overrides: {
        status: OrderStatus.PREPARING,
        confirmedAt: pastTimestamp(0.02),
        preparingAt: pastTimestamp(0.01),
        ...options?.overrides,
      },
    });
  }

  /**
   * 生成已付款訂單
   */
  buildPaid(options?: FactoryOptions<OrderTestData>): OrderTestData {
    return this.build({
      ...options,
      overrides: {
        status: OrderStatus.PAID,
        paymentStatus: "paid",
        paymentMethod: randomChoice([
          PaymentMethods.CASH,
          PaymentMethods.CREDIT_CARD,
          PaymentMethods.MOBILE_PAY,
        ]),
        ...options?.overrides,
      },
    });
  }

  /**
   * 生成外帶訂單
   */
  buildTakeaway(options?: FactoryOptions<OrderTestData>): OrderTestData {
    return this.build({
      ...options,
      overrides: {
        orderType: OrderType.TAKEAWAY,
        tableId: null,
        serviceCharge: 0,
        ...options?.overrides,
      },
    });
  }

  /**
   * 生成外送訂單
   */
  buildDelivery(options?: FactoryOptions<OrderTestData>): OrderTestData {
    const subtotal = randomNumber(300, 2000);
    const deliveryFee = 50;
    const totalAmount = subtotal + deliveryFee;

    return this.build({
      ...options,
      overrides: {
        orderType: OrderType.DELIVERY,
        tableId: null,
        deliveryInfo: {
          address: "台中市西區測試路123號",
          phone: `09${randomNumber(10000000, 99999999)}`,
          deliveryFee,
          estimatedDeliveryTime: 40,
          driverName: `司機 ${randomNumber(1, 20)}`,
          driverPhone: `09${randomNumber(10000000, 99999999)}`,
        },
        totalAmount,
        ...options?.overrides,
      },
    });
  }
}

/**
 * 訂單項目工廠
 */
export class OrderItemFactory extends BaseFactory<OrderItemTestData> {
  build(options?: FactoryOptions<OrderItemTestData>): OrderItemTestData {
    const sequence = options?.sequence ?? this.getNextSequence();
    const orderId = options?.relations?.orderId ?? 1;
    const menuItemId = options?.relations?.menuItemId ?? randomNumber(1, 50);
    const quantity = randomNumber(1, 5);
    const unitPrice = randomNumber(50, 300);
    const totalPrice = unitPrice * quantity;

    const baseData: OrderItemTestData = {
      id: sequence + 1,
      orderId,
      menuItemId,
      quantity,
      unitPrice,
      totalPrice,
      itemSnapshot: {
        name: `菜品 ${menuItemId}`,
        description: "美味佳餚",
        price: unitPrice,
      },
      customizations: randomBoolean(0.3)
        ? {
            spiceLevel: randomChoice(["不辣", "微辣", "中辣", "大辣"]),
            extras: randomChoice([[], ["加蛋"], ["加起司"], ["加肉"]]),
          }
        : {},
      status: "pending",
      preparedAt: null,
      servedAt: null,
      notes: randomBoolean(0.2) ? "請少油" : null,
      kitchenNotes: null,
      cancelledAt: null,
      cancellationReason: null,
      createdAt: currentTimestamp(),
      updatedAt: currentTimestamp(),
    };

    return {
      ...baseData,
      ...options?.overrides,
    };
  }

  /**
   * 為訂單生成多個項目
   */
  buildForOrder(orderId: number, count: number = 3): OrderItemTestData[] {
    return this.buildList(count, {
      relations: { orderId },
      overrides: {
        menuItemId: this.getNextSequence() + 1,
      },
    });
  }

  /**
   * 生成已準備好的項目
   */
  buildPrepared(
    options?: FactoryOptions<OrderItemTestData>,
  ): OrderItemTestData {
    return this.build({
      ...options,
      overrides: {
        status: "prepared",
        preparedAt: currentTimestamp(),
        ...options?.overrides,
      },
    });
  }

  /**
   * 生成已上菜的項目
   */
  buildServed(options?: FactoryOptions<OrderItemTestData>): OrderItemTestData {
    const preparedAt = pastTimestamp(0.005);
    return this.build({
      ...options,
      overrides: {
        status: "served",
        preparedAt,
        servedAt: preparedAt + 60000, // 1 minute after prepared
        ...options?.overrides,
      },
    });
  }
}

// 導出單例實例
export const orderFactory = new OrderFactory();
export const orderItemFactory = new OrderItemFactory();
