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
});
