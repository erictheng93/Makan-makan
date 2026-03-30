/**
 * Contract Tests for Kitchen API
 *
 * Validates that response shapes match declared Zod schemas.
 * Any schema drift (field added, removed, or renamed) causes a test failure.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetAllFactories } from "@makanmakan/testing-utils";
import { assertMatchesSchema } from "../../../contracts/helpers";
import {
  GetKitchenOrdersResponse,
  UpdateItemStatusResponse,
  KitchenConnectionsResponse,
  BroadcastTestResponse,
} from "../../../contracts/schemas/kitchen";

describe("Kitchen API Response Contracts", () => {
  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
  });

  // =========================================================================
  // Get Kitchen Orders
  // =========================================================================
  describe("Get Kitchen Orders Response Contract", () => {
    it("should match GetKitchenOrdersResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: [
          {
            orderId: "order-001",
            items: [
              {
                id: "item-001",
                name: "Nasi Lemak",
                quantity: 2,
                status: "pending",
              },
            ],
            tableNumber: "A12",
            createdAt: new Date().toISOString(),
          },
        ],
      };

      assertMatchesSchema(
        GetKitchenOrdersResponse,
        mockResponse,
        "GET /kitchen/orders",
      );
    });

    it("should accept empty orders list", () => {
      const mockResponse = {
        success: true as const,
        data: [],
      };

      assertMatchesSchema(
        GetKitchenOrdersResponse,
        mockResponse,
        "GET /kitchen/orders (empty)",
      );
    });
  });

  // =========================================================================
  // Update Item Status
  // =========================================================================
  describe("Update Item Status Response Contract", () => {
    it("should match UpdateItemStatusResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: {
          itemId: "item-001",
          status: "completed",
          updatedAt: new Date().toISOString(),
        },
        message: "Item status updated",
      };

      assertMatchesSchema(
        UpdateItemStatusResponse,
        mockResponse,
        "PATCH /kitchen/items/:id/status",
      );
    });

    it("should accept response without message", () => {
      const mockResponse = {
        success: true as const,
        data: {
          itemId: "item-001",
          status: "in_progress",
        },
      };

      assertMatchesSchema(
        UpdateItemStatusResponse,
        mockResponse,
        "PATCH /kitchen/items/:id/status (no message)",
      );
    });
  });

  // =========================================================================
  // Kitchen Connections
  // =========================================================================
  describe("Kitchen Connections Response Contract", () => {
    it("should match KitchenConnectionsResponse schema", () => {
      const mockResponse = {
        success: true as const,
        data: {
          connections: 3,
          clients: [
            { id: "client-1", connectedAt: new Date().toISOString() },
            { id: "client-2", connectedAt: new Date().toISOString() },
            { id: "client-3", connectedAt: new Date().toISOString() },
          ],
        },
      };

      assertMatchesSchema(
        KitchenConnectionsResponse,
        mockResponse,
        "GET /kitchen/connections",
      );
    });

    it("should accept zero connections", () => {
      const mockResponse = {
        success: true as const,
        data: {
          connections: 0,
          clients: [],
        },
      };

      assertMatchesSchema(
        KitchenConnectionsResponse,
        mockResponse,
        "GET /kitchen/connections (empty)",
      );
    });
  });

  // =========================================================================
  // Broadcast Test
  // =========================================================================
  describe("Broadcast Test Response Contract", () => {
    it("should match BroadcastTestResponse schema with all fields", () => {
      const mockResponse = {
        success: true as const,
        data: {
          message: "Test broadcast sent",
          sentCount: 5,
          event: "test_broadcast",
        },
        message: "Broadcast sent successfully",
      };

      assertMatchesSchema(
        BroadcastTestResponse,
        mockResponse,
        "POST /kitchen/broadcast-test",
      );
    });

    it("should accept response with partial data fields", () => {
      const mockResponse = {
        success: true as const,
        data: {
          sentCount: 0,
        },
      };

      assertMatchesSchema(
        BroadcastTestResponse,
        mockResponse,
        "POST /kitchen/broadcast-test (partial)",
      );
    });
  });
});
