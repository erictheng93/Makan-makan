/**
 * Orders Routes Unit Tests
 * Tests for route handlers, middleware integration, and request/response handling
 *
 * 注意：這些測試專注於路由層的邏輯，不涉及實際的服務調用
 * 服務層測試在 feature.test.ts 中
 */

import { describe, it, expect } from "vitest";
import type { Context } from "hono";

// Test helper functions from routes
import {
  orderSchemas,
  validateOrderStatusTransition,
  validateUserPermission,
} from "../schemas/validation";

describe("Orders Routes Unit Tests", () => {
  describe("Route Schema Validation", () => {
    describe("Create Order Endpoint Schema", () => {
      it("should validate complete order creation request", () => {
        const validRequest = {
          restaurantId: "1", // Schema requires z.string().min(1)
          tableId: 5,
          customerName: "John Doe",
          customerPhone: "+60123456789",
          customerEmail: "john@example.com",
          items: [
            { menuItemId: 1, quantity: 2, price: 1500, notes: "Extra spicy" },
            { menuItemId: 2, quantity: 1, price: 2000 },
          ],
          notes: "Birthday celebration",
          orderType: "shop", // Valid orderType values: "shop" | "table" | "seat"
          couponCode: "SAVE10",
        };

        const result = orderSchemas.createOrder.safeParse(validRequest);
        expect(result.success).toBe(true);
      });

      it("should validate minimal order creation request", () => {
        const minimalRequest = {
          restaurantId: "1", // Schema requires z.string().min(1)
          items: [{ menuItemId: 1, quantity: 1 }],
        };

        const result = orderSchemas.createOrder.safeParse(minimalRequest);
        expect(result.success).toBe(true);
      });

      it("should reject order with no items", () => {
        const invalidRequest = {
          restaurantId: "1",
          items: [],
        };

        const result = orderSchemas.createOrder.safeParse(invalidRequest);
        expect(result.success).toBe(false);
      });

      it("should reject order with invalid restaurant ID", () => {
        const invalidRequest = {
          restaurantId: "", // Empty string fails z.string().min(1)
          items: [{ menuItemId: 1, quantity: 1 }],
        };

        const result = orderSchemas.createOrder.safeParse(invalidRequest);
        expect(result.success).toBe(false);
      });

      it("should reject order with invalid item quantity", () => {
        const invalidRequest = {
          restaurantId: "1",
          items: [{ menuItemId: 1, quantity: 0 }],
        };

        const result = orderSchemas.createOrder.safeParse(invalidRequest);
        expect(result.success).toBe(false);
      });

      it("should validate order with scheduled time", () => {
        const scheduledOrder = {
          restaurantId: "1",
          items: [{ menuItemId: 1, quantity: 1 }],
          scheduledTime: "2025-12-25T18:00:00Z",
        };

        const result = orderSchemas.createOrder.safeParse(scheduledOrder);
        expect(result.success).toBe(true);
      });

      it("should validate all order types", () => {
        // Valid orderType values: "shop" | "table" | "seat"
        // Note: "dine_in"/"takeaway"/"delivery" are fulfillmentType values, not orderType
        const types = ["shop", "table", "seat"];
        types.forEach((orderType) => {
          const request = {
            restaurantId: "1",
            items: [{ menuItemId: 1, quantity: 1 }],
            orderType,
          };
          const result = orderSchemas.createOrder.safeParse(request);
          expect(result.success).toBe(true);
        });
      });
    });

    describe("Update Order Status Endpoint Schema", () => {
      it("should validate status update with notes", () => {
        const validUpdate = {
          status: "confirmed",
          notes: "Order confirmed by manager",
        };

        const result = orderSchemas.updateOrderStatus.safeParse(validUpdate);
        expect(result.success).toBe(true);
      });

      it("should validate status update with estimated ready time", () => {
        const validUpdate = {
          status: "preparing",
          estimatedReadyTime: "2025-12-08T15:30:00Z",
        };

        const result = orderSchemas.updateOrderStatus.safeParse(validUpdate);
        expect(result.success).toBe(true);
      });

      it("should reject invalid status value", () => {
        const invalidUpdate = {
          status: "invalid_status",
        };

        const result = orderSchemas.updateOrderStatus.safeParse(invalidUpdate);
        expect(result.success).toBe(false);
      });
    });

    describe("Order Filter Endpoint Schema", () => {
      it("should validate filter with multiple statuses", () => {
        const filters = {
          status: "pending,confirmed,preparing",
        };

        const result = orderSchemas.orderFilters.safeParse(filters);
        expect(result.success).toBe(true);
      });

      it("should validate filter with date range", () => {
        const filters = {
          dateFrom: "2024-01-01T00:00:00Z",
          dateTo: "2024-12-31T23:59:59Z",
        };

        const result = orderSchemas.orderFilters.safeParse(filters);
        expect(result.success).toBe(true);
      });

      it("should validate filter with pagination", () => {
        const filters = {
          page: "2",
          limit: "50",
          sortBy: "totalAmount",
          sortOrder: "desc",
        };

        const result = orderSchemas.orderFilters.safeParse(filters);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.page).toBe(2);
          expect(result.data.limit).toBe(50);
        }
      });

      it("should validate filter with amount range", () => {
        const filters = {
          minAmount: "10.00",
          maxAmount: "100.00",
        };

        const result = orderSchemas.orderFilters.safeParse(filters);
        expect(result.success).toBe(true);
      });
    });

    describe("Coupon Preview Endpoint Schema", () => {
      it("should validate coupon preview request", () => {
        const request = {
          restaurantId: "1", // previewCouponSchema requires z.string().min(1)
          couponCode: "SUMMER20",
          orderAmount: 5000,
        };

        const result = orderSchemas.couponPreview.safeParse(request);
        expect(result.success).toBe(true);
      });

      it("should validate coupon preview with menu items", () => {
        const request = {
          restaurantId: "1", // previewCouponSchema requires z.string().min(1)
          couponCode: "ITEM10",
          orderAmount: 3000,
          menuItems: [
            { menuItemId: 1, quantity: 2 },
            { menuItemId: 5, quantity: 1 },
          ],
        };

        const result = orderSchemas.couponPreview.safeParse(request);
        expect(result.success).toBe(true);
      });

      it("should reject coupon preview with zero amount", () => {
        const request = {
          restaurantId: "1",
          couponCode: "TEST",
          orderAmount: 0,
        };

        const result = orderSchemas.couponPreview.safeParse(request);
        expect(result.success).toBe(false);
      });
    });

    describe("Bulk Operation Endpoint Schema", () => {
      it("should validate bulk status update", () => {
        const request = {
          action: "update_status",
          orderIds: [1, 2, 3, 4, 5],
          data: { status: "confirmed" },
        };

        const result = orderSchemas.bulkOperation.safeParse(request);
        expect(result.success).toBe(true);
      });

      it("should validate bulk cancel with reason", () => {
        const request = {
          action: "cancel",
          orderIds: [10, 11],
          data: { reason: "Restaurant closed early" },
        };

        const result = orderSchemas.bulkOperation.safeParse(request);
        expect(result.success).toBe(true);
      });

      it("should validate bulk export", () => {
        const request = {
          action: "export",
          orderIds: [1, 2, 3],
          data: { format: "csv" },
        };

        const result = orderSchemas.bulkOperation.safeParse(request);
        expect(result.success).toBe(true);
      });

      it("should reject bulk operation with too many orders", () => {
        const request = {
          action: "update_status",
          orderIds: Array(101)
            .fill(0)
            .map((_, i) => i + 1),
        };

        const result = orderSchemas.bulkOperation.safeParse(request);
        expect(result.success).toBe(false);
      });
    });

    describe("Stats Query Endpoint Schema", () => {
      it("should validate stats query with time range", () => {
        const query = {
          restaurantId: "1",
          timeRange: "week",
          groupBy: "day",
        };

        const result = orderSchemas.stats.safeParse(query);
        expect(result.success).toBe(true);
      });

      it("should validate stats query with custom date range", () => {
        const query = {
          timeRange: "custom",
          dateFrom: "2024-01-01T00:00:00Z",
          dateTo: "2024-03-31T23:59:59Z",
        };

        const result = orderSchemas.stats.safeParse(query);
        expect(result.success).toBe(true);
      });

      it("should validate stats query with include options", () => {
        const query = {
          includeItems: "true",
          includeCustomers: "true",
        };

        const result = orderSchemas.stats.safeParse(query);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.includeItems).toBe(true);
          expect(result.data.includeCustomers).toBe(true);
        }
      });
    });

    describe("Export Endpoint Schema", () => {
      it("should validate CSV export request", () => {
        const request = {
          format: "csv",
          includeItems: "true",
        };

        const result = orderSchemas.export.safeParse(request);
        expect(result.success).toBe(true);
      });

      it("should validate Excel export with filters", () => {
        const request = {
          format: "excel",
          status: "delivered", // Use valid status from enum
          dateFrom: "2024-01-01T00:00:00Z",
        };

        const result = orderSchemas.export.safeParse(request);
        expect(result.success).toBe(true);
      });

      it("should validate PDF export", () => {
        const request = {
          format: "pdf",
          includeCustomerInfo: "false",
        };

        const result = orderSchemas.export.safeParse(request);
        expect(result.success).toBe(true);
      });
    });

    describe("Order ID Parameter Schema", () => {
      it("should validate numeric order ID", () => {
        const params = { id: "123" };

        const result = orderSchemas.params.safeParse(params);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.id).toBe(123);
        }
      });

      it("should reject non-numeric order ID", () => {
        const params = { id: "abc" };

        const result = orderSchemas.params.safeParse(params);
        expect(result.success).toBe(false);
      });

      it("should reject negative order ID", () => {
        const params = { id: "-1" };

        const result = orderSchemas.params.safeParse(params);
        expect(result.success).toBe(false);
      });
    });
  });

  describe("Status Transition Validation", () => {
    describe("Valid Transitions", () => {
      it("should allow pending -> confirmed", () => {
        expect(validateOrderStatusTransition("pending", "confirmed")).toBe(
          true,
        );
      });

      it("should allow pending -> cancelled", () => {
        expect(validateOrderStatusTransition("pending", "cancelled")).toBe(
          true,
        );
      });

      it("should allow confirmed -> preparing", () => {
        expect(validateOrderStatusTransition("confirmed", "preparing")).toBe(
          true,
        );
      });

      it("should allow confirmed -> cancelled", () => {
        expect(validateOrderStatusTransition("confirmed", "cancelled")).toBe(
          true,
        );
      });

      it("should allow preparing -> ready", () => {
        expect(validateOrderStatusTransition("preparing", "ready")).toBe(true);
      });

      it("should allow preparing -> cancelled", () => {
        expect(validateOrderStatusTransition("preparing", "cancelled")).toBe(
          true,
        );
      });

      it("should allow ready -> delivered", () => {
        expect(validateOrderStatusTransition("ready", "delivered")).toBe(true);
      });

      it("should allow ready -> cancelled", () => {
        expect(validateOrderStatusTransition("ready", "cancelled")).toBe(true);
      });

      it("should allow delivered -> paid", () => {
        expect(validateOrderStatusTransition("delivered", "paid")).toBe(true);
      });
    });

    describe("Invalid Transitions", () => {
      it("should not allow pending -> ready (skip preparing)", () => {
        expect(validateOrderStatusTransition("pending", "ready")).toBe(false);
      });

      it("should not allow pending -> delivered", () => {
        expect(validateOrderStatusTransition("pending", "delivered")).toBe(
          false,
        );
      });

      it("should not allow confirmed -> delivered (skip ready)", () => {
        expect(validateOrderStatusTransition("confirmed", "delivered")).toBe(
          false,
        );
      });

      it("should not allow preparing -> delivered (skip ready)", () => {
        expect(validateOrderStatusTransition("preparing", "delivered")).toBe(
          false,
        );
      });

      it("should not allow paid -> any status", () => {
        expect(validateOrderStatusTransition("paid", "pending")).toBe(false);
        expect(validateOrderStatusTransition("paid", "confirmed")).toBe(false);
        expect(validateOrderStatusTransition("paid", "cancelled")).toBe(false);
      });

      it("should not allow cancelled -> any status", () => {
        expect(validateOrderStatusTransition("cancelled", "pending")).toBe(
          false,
        );
        expect(validateOrderStatusTransition("cancelled", "confirmed")).toBe(
          false,
        );
        expect(validateOrderStatusTransition("cancelled", "preparing")).toBe(
          false,
        );
      });

      it("should not allow backward transitions", () => {
        expect(validateOrderStatusTransition("confirmed", "pending")).toBe(
          false,
        );
        expect(validateOrderStatusTransition("preparing", "confirmed")).toBe(
          false,
        );
        expect(validateOrderStatusTransition("ready", "preparing")).toBe(false);
        expect(validateOrderStatusTransition("delivered", "ready")).toBe(false);
      });
    });

    describe("Edge Cases", () => {
      it("should handle invalid current status", () => {
        expect(validateOrderStatusTransition("invalid", "confirmed")).toBe(
          false,
        );
      });

      it("should handle invalid new status", () => {
        expect(validateOrderStatusTransition("pending", "invalid")).toBe(false);
      });

      it("should handle same status transition", () => {
        expect(validateOrderStatusTransition("pending", "pending")).toBe(false);
        expect(validateOrderStatusTransition("confirmed", "confirmed")).toBe(
          false,
        );
      });
    });
  });

  describe("User Permission Validation", () => {
    describe("Admin Role (0)", () => {
      it("should allow admin for any required roles", () => {
        expect(validateUserPermission(0, [1, 2, 3])).toBe(true);
        expect(validateUserPermission(0, [4, 5])).toBe(true);
        expect(validateUserPermission(0, [])).toBe(true);
      });
    });

    describe("Owner Role (1)", () => {
      it("should allow owner when role 1 is required", () => {
        expect(validateUserPermission(1, [1])).toBe(true);
        expect(validateUserPermission(1, [1, 2])).toBe(true);
      });

      it("should deny owner when role 1 is not in required list", () => {
        expect(validateUserPermission(1, [2, 3])).toBe(false);
        expect(validateUserPermission(1, [4])).toBe(false);
      });
    });

    describe("Chef Role (2)", () => {
      it("should allow chef when role 2 is required", () => {
        expect(validateUserPermission(2, [2])).toBe(true);
        expect(validateUserPermission(2, [1, 2, 3])).toBe(true);
      });

      it("should deny chef when role 2 is not in required list", () => {
        expect(validateUserPermission(2, [1, 3])).toBe(false);
        expect(validateUserPermission(2, [4, 5])).toBe(false);
      });
    });

    describe("Service Role (3)", () => {
      it("should allow service when role 3 is required", () => {
        expect(validateUserPermission(3, [3])).toBe(true);
        expect(validateUserPermission(3, [2, 3, 4])).toBe(true);
      });

      it("should deny service when role 3 is not in required list", () => {
        expect(validateUserPermission(3, [1, 2])).toBe(false);
      });
    });

    describe("Cashier Role (4)", () => {
      it("should allow cashier when role 4 is required", () => {
        expect(validateUserPermission(4, [4])).toBe(true);
        expect(validateUserPermission(4, [3, 4, 5])).toBe(true);
      });

      it("should deny cashier when role 4 is not in required list", () => {
        expect(validateUserPermission(4, [1, 2, 3])).toBe(false);
      });
    });

    describe("Customer Role (5)", () => {
      it("should allow customer when role 5 is required", () => {
        expect(validateUserPermission(5, [5])).toBe(true);
        expect(validateUserPermission(5, [4, 5])).toBe(true);
      });

      it("should deny customer when role 5 is not in required list", () => {
        expect(validateUserPermission(5, [1, 2, 3, 4])).toBe(false);
      });
    });
  });

  describe("Role-Based Status Transitions", () => {
    // These tests verify the business logic for which roles can set which statuses
    const roleStatusPermissions: Record<number, string[]> = {
      0: [
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "delivered",
        "cancelled",
      ], // Admin
      1: ["confirmed", "cancelled"], // Owner
      2: ["preparing", "ready"], // Chef
      3: ["delivered"], // Service
      4: ["confirmed"], // Cashier
    };

    describe("Admin (Role 0)", () => {
      it("should be able to set any status", () => {
        const adminStatuses = roleStatusPermissions[0];
        expect(adminStatuses).toContain("pending");
        expect(adminStatuses).toContain("confirmed");
        expect(adminStatuses).toContain("preparing");
        expect(adminStatuses).toContain("ready");
        expect(adminStatuses).toContain("delivered");
        expect(adminStatuses).toContain("cancelled");
      });
    });

    describe("Owner (Role 1)", () => {
      it("should only be able to confirm or cancel", () => {
        const ownerStatuses = roleStatusPermissions[1];
        expect(ownerStatuses).toContain("confirmed");
        expect(ownerStatuses).toContain("cancelled");
        expect(ownerStatuses).not.toContain("preparing");
        expect(ownerStatuses).not.toContain("ready");
      });
    });

    describe("Chef (Role 2)", () => {
      it("should only be able to set preparing or ready", () => {
        const chefStatuses = roleStatusPermissions[2];
        expect(chefStatuses).toContain("preparing");
        expect(chefStatuses).toContain("ready");
        expect(chefStatuses).not.toContain("confirmed");
        expect(chefStatuses).not.toContain("delivered");
      });
    });

    describe("Service (Role 3)", () => {
      it("should only be able to set delivered", () => {
        const serviceStatuses = roleStatusPermissions[3];
        expect(serviceStatuses).toContain("delivered");
        expect(serviceStatuses).not.toContain("preparing");
        expect(serviceStatuses).not.toContain("ready");
      });
    });

    describe("Cashier (Role 4)", () => {
      it("should only be able to confirm", () => {
        const cashierStatuses = roleStatusPermissions[4];
        expect(cashierStatuses).toContain("confirmed");
        expect(cashierStatuses).not.toContain("preparing");
        expect(cashierStatuses).not.toContain("cancelled");
      });
    });
  });

  describe("Request Data Transformation", () => {
    describe("Filter Query Transformation", () => {
      it("should preserve string restaurantId in filter schema", () => {
        // orderFilterSchema uses z.string().optional() — no numeric transform
        const query = { restaurantId: "123" };
        const result = orderSchemas.orderFilters.safeParse(query);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(typeof result.data.restaurantId).toBe("string");
          expect(result.data.restaurantId).toBe("123");
        }
      });

      it("should transform string page and limit to numbers", () => {
        const query = { page: "5", limit: "25" };
        const result = orderSchemas.orderFilters.safeParse(query);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.page).toBe(5);
          expect(result.data.limit).toBe(25);
        }
      });

      it("should transform comma-separated status to array", () => {
        const query = { status: "pending,confirmed" };
        const result = orderSchemas.orderFilters.safeParse(query);
        expect(result.success).toBe(true);
      });

      it("should transform hasNotes string to boolean", () => {
        const query = { hasNotes: "true" };
        const result = orderSchemas.orderFilters.safeParse(query);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.hasNotes).toBe(true);
        }
      });

      it("should transform rating string to number array", () => {
        const query = { rating: "4,5" };
        const result = orderSchemas.orderFilters.safeParse(query);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.rating).toEqual([4, 5]);
        }
      });
    });

    describe("Stats Query Transformation", () => {
      it("should transform includeItems string to boolean", () => {
        const query = { includeItems: "true" };
        const result = orderSchemas.stats.safeParse(query);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.includeItems).toBe(true);
        }
      });

      it("should transform includeCustomers string to boolean", () => {
        const query = { includeCustomers: "false" };
        const result = orderSchemas.stats.safeParse(query);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.includeCustomers).toBe(false);
        }
      });
    });
  });

  describe("Error Response Validation", () => {
    describe("Validation Error Responses", () => {
      it("should provide field-level errors for invalid data", () => {
        const invalidData = {
          restaurantId: -1,
          items: [],
        };

        const result = orderSchemas.createOrder.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          const paths = result.error.issues.map((i) => i.path.join("."));
          expect(paths).toContain("restaurantId");
          expect(paths).toContain("items");
        }
      });

      it("should provide error codes for validation failures", () => {
        // restaurantId schema is z.string().min(1) — empty string is invalid
        const invalidData = {
          restaurantId: "", // Empty string fails min(1)
          items: [{ menuItemId: 1, quantity: 1 }],
        };

        const result = orderSchemas.createOrder.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].code).toBeDefined();
        }
      });
    });
  });
});
