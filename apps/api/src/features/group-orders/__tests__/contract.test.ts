/**
 * Contract Tests for Group Orders API
 *
 * Validates that group ordering API responses match their declared Zod
 * schemas. Covers group creation, joining, share codes, and cart items.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetAllFactories } from "@makanmakan/testing-utils";
import { assertMatchesSchema } from "../../../contracts/helpers";
import {
  CreateGroupOrderResponse,
  JoinGroupResponse,
  GenerateShareCodeResponse,
  AddCartItemResponse,
  GetGroupOrderResponse,
  ListGroupOrdersResponse,
  UpdateCartItemResponse,
  RemoveCartItemResponse,
  LeaveGroupResponse,
} from "../../../contracts/schemas/group-orders";

describe("Group Orders API Response Contracts", () => {
  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Create Group Order
  // -------------------------------------------------------------------------
  describe("CreateGroupOrderResponse", () => {
    it("should match schema for newly created group order", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: "go-001",
          restaurantId: "rest-001",
          hostId: 1,
          shareCode: "ABC123",
          status: "open",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      assertMatchesSchema(
        CreateGroupOrderResponse,
        mockResponse,
        "POST /group-orders",
      );
    });

    it("should match schema without optional fields", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: "go-002",
          restaurantId: "rest-001",
          status: "open",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      assertMatchesSchema(
        CreateGroupOrderResponse,
        mockResponse,
        "POST /group-orders (minimal)",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Get Group Order
  // -------------------------------------------------------------------------
  describe("GetGroupOrderResponse", () => {
    it("should match schema for single group order", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: "go-001",
          restaurantId: "rest-001",
          hostId: 1,
          shareCode: "ABC123",
          status: "open",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };

      assertMatchesSchema(
        GetGroupOrderResponse,
        mockResponse,
        "GET /group-orders/:id",
      );
    });
  });

  // -------------------------------------------------------------------------
  // List Group Orders
  // -------------------------------------------------------------------------
  describe("ListGroupOrdersResponse", () => {
    it("should match schema with group orders array", () => {
      const mockResponse = {
        success: true as const,
        data: [
          {
            id: "go-001",
            restaurantId: "rest-001",
            hostId: 1,
            shareCode: "ABC123",
            status: "open",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          {
            id: "go-002",
            restaurantId: "rest-001",
            hostId: 2,
            shareCode: "XYZ789",
            status: "closed",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };

      assertMatchesSchema(
        ListGroupOrdersResponse,
        mockResponse,
        "GET /group-orders",
      );
    });

    it("should match schema with empty list", () => {
      const mockResponse = {
        success: true as const,
        data: [],
      };

      assertMatchesSchema(
        ListGroupOrdersResponse,
        mockResponse,
        "GET /group-orders (empty)",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Join Group
  // -------------------------------------------------------------------------
  describe("JoinGroupResponse", () => {
    it("should match schema with group order and member data", () => {
      const mockResponse = {
        success: true as const,
        data: {
          groupOrder: {
            id: "go-001",
            restaurantId: "rest-001",
            hostId: 1,
            shareCode: "ABC123",
            status: "open",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          member: {
            id: "mem-005",
            groupOrderId: "go-001",
            name: "Jane Smith",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        },
      };

      assertMatchesSchema(
        JoinGroupResponse,
        mockResponse,
        "POST /group-orders/:id/join",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Generate Share Code
  // -------------------------------------------------------------------------
  describe("GenerateShareCodeResponse", () => {
    it("should match schema with share code and URL", () => {
      const mockResponse = {
        success: true as const,
        data: {
          shareCode: "NEW456",
          shareUrl: "https://app.makanmakan.com/group/NEW456",
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      };

      assertMatchesSchema(
        GenerateShareCodeResponse,
        mockResponse,
        "POST /group-orders/:id/share-code",
      );
    });

    it("should match schema without optional fields", () => {
      const mockResponse = {
        success: true as const,
        data: {
          shareCode: "QWE789",
        },
      };

      assertMatchesSchema(
        GenerateShareCodeResponse,
        mockResponse,
        "POST /group-orders/:id/share-code (minimal)",
      );
    });

    it("should match schema with numeric expiresAt", () => {
      const mockResponse = {
        success: true as const,
        data: {
          shareCode: "NUM123",
          expiresAt: Date.now() + 3600000,
        },
      };

      assertMatchesSchema(
        GenerateShareCodeResponse,
        mockResponse,
        "POST /group-orders/:id/share-code (numeric)",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Cart Items
  // -------------------------------------------------------------------------
  describe("AddCartItemResponse", () => {
    it("should match schema for added cart item", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: "cart-001",
          menuItemId: "item-010",
          name: "Nasi Lemak",
          quantity: 2,
          price: 12.5,
        },
      };

      assertMatchesSchema(
        AddCartItemResponse,
        mockResponse,
        "POST /group-orders/:id/cart",
      );
    });

    it("should match schema without optional fields", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: "cart-002",
          menuItemId: "item-020",
          quantity: 1,
        },
      };

      assertMatchesSchema(
        AddCartItemResponse,
        mockResponse,
        "POST /group-orders/:id/cart (minimal)",
      );
    });
  });

  describe("UpdateCartItemResponse", () => {
    it("should match schema for updated cart item", () => {
      const mockResponse = {
        success: true as const,
        data: {
          id: "cart-001",
          menuItemId: "item-010",
          name: "Nasi Lemak",
          quantity: 3,
          price: 12.5,
        },
      };

      assertMatchesSchema(
        UpdateCartItemResponse,
        mockResponse,
        "PUT /group-orders/:id/cart/:itemId",
      );
    });
  });

  describe("RemoveCartItemResponse", () => {
    it("should match message-only schema", () => {
      const mockResponse = {
        success: true as const,
        message: "Cart item removed",
      };

      assertMatchesSchema(
        RemoveCartItemResponse,
        mockResponse,
        "DELETE /group-orders/:id/cart/:itemId",
      );
    });
  });

  // -------------------------------------------------------------------------
  // Leave Group
  // -------------------------------------------------------------------------
  describe("LeaveGroupResponse", () => {
    it("should match message-only schema", () => {
      const mockResponse = {
        success: true as const,
        message: "Left group order successfully",
      };

      assertMatchesSchema(
        LeaveGroupResponse,
        mockResponse,
        "POST /group-orders/:id/leave",
      );
    });
  });
});
