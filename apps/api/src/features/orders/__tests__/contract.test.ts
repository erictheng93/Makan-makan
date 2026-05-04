/**
 * Contract Tests for Orders API Responses
 *
 * These tests verify that order endpoints return STABLE response shapes.
 * The customer app and admin dashboard depend on these shapes -- if
 * someone accidentally adds or removes fields, these tests will break.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetAllFactories } from "@makanmasak/testing-utils";
import {
  assertMatchesSchema,
  assertNoSensitiveFields,
} from "../../../contracts/helpers";
import {
  CreateOrderResponse,
  GetOrderResponse,
  ListOrdersResponse,
  UpdateOrderStatusResponse,
  CancelOrderResponse,
  OrderStatsResponse,
  OrderReceiptResponse,
  OrderSchema,
  OrderItemSchema,
  OrderStatusEnum,
  PaymentStatusEnum,
  OrderTypeEnum,
} from "../../../contracts/schemas/orders";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const now = new Date().toISOString();

const mockOrderItem = {
  id: 101,
  orderId: 1,
  menuItemId: "menu-001",
  name: "Nasi Lemak",
  quantity: 2,
  unitPrice: 12.5,
  totalPrice: 25.0,
  customizations: { spiceLevel: "medium" },
  notes: "Extra sambal",
  status: "pending",
  createdAt: now,
  updatedAt: now,
};

const mockOrder = {
  id: 1,
  restaurantId: "rest-001",
  tableId: 5,
  seatId: null,
  customerId: "cust-001",
  userId: null,
  orderNumber: "ORD-20260330-001",
  status: "pending",
  paymentStatus: "pending",
  orderType: "table",
  subtotal: 25.0,
  tax: 1.5,
  serviceCharge: 2.5,
  discount: 0,
  totalAmount: 29.0,
  notes: "Birthday celebration",
  items: [mockOrderItem],
  createdAt: now,
  updatedAt: now,
};

// =========================================================================
// Tests
// =========================================================================

describe("Orders API Response Contracts", () => {
  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
  });

  // =======================================================================
  // OrderItem Schema Contract
  // =======================================================================
  describe("OrderItem Schema Contract", () => {
    it("should match OrderItemSchema", () => {
      assertMatchesSchema(OrderItemSchema, mockOrderItem, "OrderItem entity");
    });

    it("should require id, orderId, menuItemId, quantity, unitPrice, totalPrice", () => {
      const minimalItem = {
        id: 101,
        orderId: 1,
        menuItemId: "menu-001",
        quantity: 1,
        unitPrice: 10.0,
        totalPrice: 10.0,
        createdAt: now,
        updatedAt: now,
      };

      assertMatchesSchema(OrderItemSchema, minimalItem, "OrderItem minimal");
    });

    it("should reject quantity of 0 or negative", () => {
      const invalidItem = {
        ...mockOrderItem,
        quantity: 0,
      };

      const result = OrderItemSchema.safeParse(invalidItem);
      expect(result.success).toBe(false);
    });

    it("should accept both numeric and string ids", () => {
      const stringIdItem = {
        ...mockOrderItem,
        id: "item-uuid-001",
        orderId: "order-uuid-001",
        menuItemId: "menu-uuid-001",
      };

      assertMatchesSchema(
        OrderItemSchema,
        stringIdItem,
        "OrderItem with string ids",
      );
    });
  });

  // =======================================================================
  // Order Schema Contract
  // =======================================================================
  describe("Order Schema Contract", () => {
    it("should match OrderSchema with all fields", () => {
      assertMatchesSchema(OrderSchema, mockOrder, "Order entity (full)");
    });

    it("should require id, restaurantId, status, totalAmount", () => {
      const minimalOrder = {
        id: 1,
        restaurantId: "rest-001",
        status: "pending",
        totalAmount: 29.0,
        createdAt: now,
        updatedAt: now,
      };

      assertMatchesSchema(OrderSchema, minimalOrder, "Order minimal");
    });

    it("should accept order without items array", () => {
      const orderWithoutItems = { ...mockOrder };
      delete (orderWithoutItems as Record<string, unknown>).items;

      assertMatchesSchema(
        OrderSchema,
        orderWithoutItems,
        "Order without items",
      );
    });

    it("should accept order with empty items array", () => {
      const orderEmptyItems = { ...mockOrder, items: [] };

      assertMatchesSchema(
        OrderSchema,
        orderEmptyItems,
        "Order with empty items",
      );
    });
  });

  // =======================================================================
  // Enum Contracts
  // =======================================================================
  describe("Order Enum Contracts", () => {
    it("should validate known order statuses", () => {
      const validStatuses = [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "delivered",
        "paid",
        "cancelled",
      ];

      for (const status of validStatuses) {
        const result = OrderStatusEnum.safeParse(status);
        expect(result.success).toBe(true);
      }
    });

    it("should reject unknown order status", () => {
      const result = OrderStatusEnum.safeParse("shipped");
      expect(result.success).toBe(false);
    });

    it("should validate known payment statuses", () => {
      const validStatuses = ["pending", "paid", "failed"];

      for (const status of validStatuses) {
        const result = PaymentStatusEnum.safeParse(status);
        expect(result.success).toBe(true);
      }
    });

    it("should validate known order types", () => {
      const validTypes = ["shop", "table", "seat"];

      for (const type of validTypes) {
        const result = OrderTypeEnum.safeParse(type);
        expect(result.success).toBe(true);
      }
    });
  });

  // =======================================================================
  // CreateOrder Response Contract
  // =======================================================================
  describe("CreateOrder Response Contract", () => {
    it("should match CreateOrderResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: { ...mockOrder },
      };

      assertMatchesSchema(CreateOrderResponse, mockResponse, "POST /orders");
    });

    it("should include items in the created order", () => {
      const mockResponse = {
        success: true as const,
        data: { ...mockOrder, items: [mockOrderItem] },
      };

      assertMatchesSchema(
        CreateOrderResponse,
        mockResponse,
        "POST /orders (with items)",
      );

      expect(mockResponse.data.items).toHaveLength(1);
      expect(mockResponse.data.items[0]).toHaveProperty("id");
      expect(mockResponse.data.items[0]).toHaveProperty("quantity");
      expect(mockResponse.data.items[0]).toHaveProperty("unitPrice");
      expect(mockResponse.data.items[0]).toHaveProperty("totalPrice");
    });
  });

  // =======================================================================
  // GetOrder Response Contract
  // =======================================================================
  describe("GetOrder Response Contract", () => {
    it("should match GetOrderResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: { ...mockOrder },
      };

      assertMatchesSchema(GetOrderResponse, mockResponse, "GET /orders/:id");
    });

    it("should wrap order in { success: true, data: order } envelope", () => {
      const mockResponse = {
        success: true as const,
        data: { ...mockOrder },
      };

      expect(mockResponse).toHaveProperty("success", true);
      expect(mockResponse).toHaveProperty("data");
      expect(mockResponse.data).toHaveProperty("id");
      expect(mockResponse.data).toHaveProperty("restaurantId");
      expect(mockResponse.data).toHaveProperty("status");
      expect(mockResponse.data).toHaveProperty("totalAmount");
    });
  });

  // =======================================================================
  // ListOrders Response Contract
  // =======================================================================
  describe("ListOrders Response Contract", () => {
    it("should match ListOrdersResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: [mockOrder],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      };

      assertMatchesSchema(ListOrdersResponse, mockResponse, "GET /orders");
    });

    it("should match ListOrdersResponse without pagination", () => {
      const mockResponse = {
        success: true as const,
        data: [mockOrder],
      };

      assertMatchesSchema(
        ListOrdersResponse,
        mockResponse,
        "GET /orders (no pagination)",
      );
    });

    it("should match ListOrdersResponse with empty data array", () => {
      const mockResponse = {
        success: true as const,
        data: [] as (typeof mockOrder)[],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      };

      assertMatchesSchema(
        ListOrdersResponse,
        mockResponse,
        "GET /orders (empty)",
      );
    });
  });

  // =======================================================================
  // UpdateOrderStatus Response Contract
  // =======================================================================
  describe("UpdateOrderStatus Response Contract", () => {
    it("should match UpdateOrderStatusResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: { ...mockOrder, status: "confirmed" },
      };

      assertMatchesSchema(
        UpdateOrderStatusResponse,
        mockResponse,
        "PATCH /orders/:id/status",
      );
    });
  });

  // =======================================================================
  // CancelOrder Response Contract
  // =======================================================================
  describe("CancelOrder Response Contract", () => {
    it("should match message-only response", () => {
      const mockResponse = {
        success: true as const,
        message: "Order cancelled successfully",
      };

      assertMatchesSchema(
        CancelOrderResponse,
        mockResponse,
        "POST /orders/:id/cancel",
      );
    });
  });

  // =======================================================================
  // OrderStats Response Contract
  // =======================================================================
  describe("OrderStats Response Contract", () => {
    it("should match OrderStatsResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: {
          totalOrders: 150,
          totalRevenue: 4500.0,
          averageOrderValue: 30.0,
        },
      };

      assertMatchesSchema(
        OrderStatsResponse,
        mockResponse,
        "GET /orders/stats",
      );
    });
  });

  // =======================================================================
  // OrderReceipt Response Contract
  // =======================================================================
  describe("OrderReceipt Response Contract", () => {
    it("should match OrderReceiptResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: {
          orderId: 1,
          orderNumber: "ORD-20260330-001",
          items: [
            {
              name: "Nasi Lemak",
              quantity: 2,
              price: 12.5,
            },
          ],
          totalAmount: 29.0,
        },
      };

      assertMatchesSchema(
        OrderReceiptResponse,
        mockResponse,
        "GET /orders/:id/receipt",
      );
    });
  });

  // =======================================================================
  // Response Envelope Contract
  // =======================================================================
  describe("Response Envelope Contract", () => {
    it("should wrap order data in { success: true, data: {...} } envelope", () => {
      const mockResponse = {
        success: true as const,
        data: { ...mockOrder },
      };

      expect(mockResponse).toHaveProperty("success", true);
      expect(mockResponse).toHaveProperty("data");
      expect(mockResponse.data).toHaveProperty("id");
      expect(mockResponse.data).toHaveProperty("items");
    });

    it("should wrap order list in { success: true, data: [...] } envelope", () => {
      const mockResponse = {
        success: true as const,
        data: [mockOrder],
      };

      expect(mockResponse).toHaveProperty("success", true);
      expect(mockResponse.data).toBeInstanceOf(Array);
      expect(mockResponse.data).toHaveLength(1);
    });
  });
});
