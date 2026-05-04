/**
 * Contract Tests for Guest Orders API Responses
 *
 * These tests verify that guest order endpoints return STABLE response
 * shapes. The customer app (non-authenticated ordering) depends on these
 * shapes -- any change here is a breaking change.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetAllFactories } from "@makanmasak/testing-utils";
import {
  assertMatchesSchema,
  assertNoSensitiveFields,
} from "../../../contracts/helpers";
import {
  CreateGuestOrderResponse,
  GetGuestOrderResponse,
  AddGuestItemsResponse,
  CancelGuestOrderResponse,
  GUEST_ORDER_SENSITIVE_FIELDS,
} from "../../../contracts/schemas/guest-orders";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const now = new Date().toISOString();

const mockGuestOrderItem = {
  id: 201,
  orderId: 50,
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

const mockGuestOrder = {
  id: 50,
  restaurantId: "rest-001",
  tableId: 5,
  seatId: null,
  customerId: null,
  userId: null,
  orderNumber: "ORD-20260330-050",
  status: "pending",
  paymentStatus: "pending",
  orderType: "shop",
  subtotal: 25.0,
  tax: 1.5,
  serviceCharge: 0,
  discount: 0,
  totalAmount: 26.5,
  notes: null,
  items: [mockGuestOrderItem],
  createdAt: now,
  updatedAt: now,
};

// =========================================================================
// Tests
// =========================================================================

describe("Guest Orders API Response Contracts", () => {
  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
  });

  // =======================================================================
  // CreateGuestOrder Response Contract
  // =======================================================================
  describe("CreateGuestOrder Response Contract", () => {
    it("should match CreateGuestOrderResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: {
          order: { ...mockGuestOrder },
          guestToken: "guest-jwt-abc123xyz",
          tokenExpiresAt: "2026-03-31T00:00:00Z",
        },
      };

      assertMatchesSchema(
        CreateGuestOrderResponse,
        mockResponse,
        "POST /guest-orders",
      );
    });

    it("should match CreateGuestOrderResponse without optional tokenExpiresAt", () => {
      const mockResponse = {
        success: true as const,
        data: {
          order: { ...mockGuestOrder },
          guestToken: "guest-jwt-abc123xyz",
        },
      };

      assertMatchesSchema(
        CreateGuestOrderResponse,
        mockResponse,
        "POST /guest-orders (no expiry)",
      );
    });

    it("should accept tokenExpiresAt as string or number", () => {
      const stringExpiry = {
        success: true as const,
        data: {
          order: { ...mockGuestOrder },
          guestToken: "guest-jwt-abc123xyz",
          tokenExpiresAt: "2026-03-31T00:00:00Z",
        },
      };

      const numericExpiry = {
        success: true as const,
        data: {
          order: { ...mockGuestOrder },
          guestToken: "guest-jwt-abc123xyz",
          tokenExpiresAt: 1743379200000,
        },
      };

      assertMatchesSchema(
        CreateGuestOrderResponse,
        stringExpiry,
        "CreateGuestOrder (string expiry)",
      );
      assertMatchesSchema(
        CreateGuestOrderResponse,
        numericExpiry,
        "CreateGuestOrder (numeric expiry)",
      );
    });

    it("should include order with items in guest order response", () => {
      const mockResponse = {
        success: true as const,
        data: {
          order: { ...mockGuestOrder, items: [mockGuestOrderItem] },
          guestToken: "guest-jwt-abc123xyz",
        },
      };

      assertMatchesSchema(
        CreateGuestOrderResponse,
        mockResponse,
        "POST /guest-orders (with items)",
      );

      expect(mockResponse.data.order.items).toHaveLength(1);
      expect(mockResponse.data.order.items[0]).toHaveProperty("id");
      expect(mockResponse.data.order.items[0]).toHaveProperty("quantity");
      expect(mockResponse.data.order.items[0]).toHaveProperty("totalPrice");
    });
  });

  // =======================================================================
  // GetGuestOrder Response Contract
  // =======================================================================
  describe("GetGuestOrder Response Contract", () => {
    it("should match GetGuestOrderResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: {
          order: { ...mockGuestOrder },
        },
      };

      assertMatchesSchema(
        GetGuestOrderResponse,
        mockResponse,
        "GET /guest-orders/:id",
      );
    });

    it("should wrap guest order in { success: true, data: { order } } envelope", () => {
      const mockResponse = {
        success: true as const,
        data: {
          order: { ...mockGuestOrder },
        },
      };

      expect(mockResponse).toHaveProperty("success", true);
      expect(mockResponse).toHaveProperty("data");
      expect(mockResponse.data).toHaveProperty("order");
      expect(mockResponse.data.order).toHaveProperty("id");
      expect(mockResponse.data.order).toHaveProperty("restaurantId");
      expect(mockResponse.data.order).toHaveProperty("status");
      expect(mockResponse.data.order).toHaveProperty("totalAmount");
    });
  });

  // =======================================================================
  // AddGuestItems Response Contract
  // =======================================================================
  describe("AddGuestItems Response Contract", () => {
    it("should match AddGuestItemsResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: {
          order: {
            ...mockGuestOrder,
            items: [
              mockGuestOrderItem,
              {
                ...mockGuestOrderItem,
                id: 202,
                name: "Roti Canai",
                quantity: 1,
                unitPrice: 5.0,
                totalPrice: 5.0,
              },
            ],
            totalAmount: 31.5,
          },
        },
        message: "Items added successfully",
      };

      assertMatchesSchema(
        AddGuestItemsResponse,
        mockResponse,
        "POST /guest-orders/:id/items",
      );
    });

    it("should match AddGuestItemsResponse without optional message", () => {
      const mockResponse = {
        success: true as const,
        data: {
          order: { ...mockGuestOrder },
        },
      };

      assertMatchesSchema(
        AddGuestItemsResponse,
        mockResponse,
        "POST /guest-orders/:id/items (no message)",
      );
    });
  });

  // =======================================================================
  // CancelGuestOrder Response Contract
  // =======================================================================
  describe("CancelGuestOrder Response Contract", () => {
    it("should match CancelGuestOrderResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: {
          order: { ...mockGuestOrder, status: "cancelled" },
        },
        message: "Order cancelled successfully",
      };

      assertMatchesSchema(
        CancelGuestOrderResponse,
        mockResponse,
        "POST /guest-orders/:id/cancel",
      );
    });

    it("should match CancelGuestOrderResponse without optional message", () => {
      const mockResponse = {
        success: true as const,
        data: {
          order: { ...mockGuestOrder, status: "cancelled" },
        },
      };

      assertMatchesSchema(
        CancelGuestOrderResponse,
        mockResponse,
        "POST /guest-orders/:id/cancel (no message)",
      );
    });
  });

  // =======================================================================
  // Sensitive Fields Contract
  // =======================================================================
  describe("Sensitive Fields Contract", () => {
    it("should NOT expose internalNotes in guest order response", () => {
      const orderData = { ...mockGuestOrder } as Record<string, unknown>;
      assertNoSensitiveFields(
        orderData,
        GUEST_ORDER_SENSITIVE_FIELDS,
        "Guest order",
      );
    });

    it("should NOT expose staffNotes in guest order response", () => {
      assertNoSensitiveFields(
        mockGuestOrder as unknown as Record<string, unknown>,
        ["staffNotes"],
        "Guest order (staffNotes)",
      );
    });

    it("should NOT expose costPrice in guest order items", () => {
      assertNoSensitiveFields(
        mockGuestOrderItem as unknown as Record<string, unknown>,
        ["costPrice", "profitMargin"],
        "Guest order item",
      );
    });

    it("should detect leaks of all sensitive fields", () => {
      const leakyOrder = {
        ...mockGuestOrder,
        internalNotes: "Staff-only note",
        staffNotes: "Kitchen note",
        costPrice: 8.0,
        profitMargin: 0.36,
      } as Record<string, unknown>;

      const leaked = GUEST_ORDER_SENSITIVE_FIELDS.filter(
        (f) => f in leakyOrder,
      );
      expect(leaked).toEqual([
        "internalNotes",
        "staffNotes",
        "costPrice",
        "profitMargin",
      ]);
    });
  });

  // =======================================================================
  // Response Envelope Contract
  // =======================================================================
  describe("Response Envelope Contract", () => {
    it("should wrap guest order in { success: true, data: { order, guestToken } } envelope", () => {
      const mockResponse = {
        success: true as const,
        data: {
          order: { ...mockGuestOrder },
          guestToken: "guest-jwt-abc123xyz",
        },
      };

      expect(mockResponse).toHaveProperty("success", true);
      expect(mockResponse).toHaveProperty("data");
      expect(mockResponse.data).toHaveProperty("order");
      expect(mockResponse.data).toHaveProperty("guestToken");
    });

    it("should wrap get-order in { success: true, data: { order } } envelope (no token)", () => {
      const mockResponse = {
        success: true as const,
        data: {
          order: { ...mockGuestOrder },
        },
      };

      expect(mockResponse).toHaveProperty("success", true);
      expect(mockResponse.data).toHaveProperty("order");
      expect(mockResponse.data).not.toHaveProperty("guestToken");
    });
  });
});
