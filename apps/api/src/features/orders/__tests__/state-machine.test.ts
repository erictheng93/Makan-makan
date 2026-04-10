/**
 * Order Status State Machine Tests
 * Exhaustive testing of status transitions, role permissions, and normalization
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { OrdersService } from "../services/OrdersService";
import type { OrderStatus } from "@makanmakan/shared-types";
import type { UserRole } from "../../../shared/constants";
import { resetAllFactories } from "@makanmakan/testing-utils";

// Mock dependencies
vi.mock("@makanmakan/database", () => ({
  OrderService: vi.fn(function () {
    return {
      createOrder: vi.fn(),
      getOrder: vi.fn(),
      getOrders: vi.fn(),
      updateOrderStatus: vi.fn(),
      cancelOrder: vi.fn(),
      getDailyOrderStats: vi.fn(),
    };
  }),
  CouponService: vi.fn(function () {
    return {
      validateCoupon: vi.fn(),
    };
  }),
}));

vi.mock("../../../services/RealtimeBroadcastService", () => ({
  RealtimeBroadcastService: vi.fn(function () {
    return {
      broadcastNewOrder: vi.fn().mockResolvedValue({
        success: true,
        eventId: "evt-1",
        recipientCount: 1,
      }),
      broadcastOrderStatusUpdate: vi.fn().mockResolvedValue({
        success: true,
        eventId: "evt-2",
        recipientCount: 1,
      }),
      generateEventId: vi.fn().mockReturnValue("evt-123"),
    };
  }),
}));

vi.mock("../../../core/monitoring", () => ({
  ConsoleLogger: vi.fn(function () {
    return {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
  }),
}));

// Mock environment
const createMockEnv = () => ({
  NODE_ENV: "test",
  DB: {
    prepare: vi.fn(() => ({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [] }),
    })),
  },
  CACHE_KV: {
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
});

// Helper to create a mock order with a given status
const createMockOrder = (status: string | number) => ({
  id: 1,
  orderNumber: "ORD-TEST-001",
  restaurantId: "rest-1",
  tableId: 5,
  customerId: 10,
  customerName: "Test Customer",
  customerPhone: "+60123456789",
  subtotal: 5000,
  taxAmount: 300,
  serviceCharge: 250,
  discountAmount: 0,
  totalAmount: 5550,
  status,
  paymentStatus: 0,
  paymentMethod: "cash" as const,
  notes: "Test order",
  orderSource: "direct" as const,
  items: [
    {
      id: 1,
      orderId: 1,
      menuItemId: 1,
      quantity: 2,
      unitPrice: 2500,
      totalPrice: 5000,
      status: 0,
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

// All status strings used in the transition table
const ALL_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "delivered",
  "paid",
  "cancelled",
] as const;

// The valid transitions map (source of truth from OrdersService)
const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["delivered", "cancelled"],
  delivered: ["paid"],
  paid: [],
  cancelled: [],
};

// Role permissions (source of truth from OrdersService)
const ROLE_PERMISSIONS: Record<number, string[]> = {
  0: [
    "pending",
    "confirmed",
    "preparing",
    "ready",
    "delivered",
    "paid",
    "cancelled",
  ], // Admin
  1: ["confirmed", "cancelled"], // Owner
  2: ["preparing", "ready"], // Chef
  3: ["delivered"], // Service
  4: ["confirmed"], // Cashier
};

// Numeric status map (source of truth from OrdersService)
const STATUS_MAP: Record<number, string> = {
  0: "pending",
  1: "confirmed",
  2: "preparing",
  3: "ready",
  4: "delivered",
  5: "paid",
  6: "cancelled",
};

// Role names for readable test output
const ROLE_NAMES: Record<number, string> = {
  0: "Admin",
  1: "Owner",
  2: "Chef",
  3: "Service",
  4: "Cashier",
};

describe("Order Status State Machine", () => {
  let service: OrdersService;
  let mockEnv: ReturnType<typeof createMockEnv>;
  let mockBaseOrderService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    resetAllFactories();
    mockEnv = createMockEnv();

    const { OrderService, CouponService } =
      await import("@makanmakan/database");
    mockBaseOrderService = {
      createOrder: vi.fn(),
      getOrder: vi.fn(),
      getOrders: vi.fn(),
      updateOrderStatus: vi.fn(),
      cancelOrder: vi.fn(),
      getDailyOrderStats: vi.fn(),
    };
    const mockCouponService = {
      validateCoupon: vi.fn(),
    };

    (OrderService as any).mockImplementation(function () {
      return mockBaseOrderService;
    });
    (CouponService as any).mockImplementation(function () {
      return mockCouponService;
    });

    service = new OrdersService(mockEnv as any);
  });

  // =========================================================================
  // 1. Exhaustive Transition Matrix (7x7 = 49 pairs)
  // =========================================================================
  describe("Exhaustive transition matrix (49 pairs)", () => {
    for (const fromStatus of ALL_STATUSES) {
      for (const toStatus of ALL_STATUSES) {
        const isValid =
          VALID_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;

        if (isValid) {
          it(`should ALLOW transition: ${fromStatus} -> ${toStatus}`, async () => {
            const mockOrder = createMockOrder(fromStatus);
            mockEnv.CACHE_KV.get.mockResolvedValue(mockOrder);

            const updatedOrder = createMockOrder(toStatus);
            mockBaseOrderService.updateOrderStatus.mockResolvedValue(
              updatedOrder,
            );

            // Use Admin role (0) which has permission for all statuses
            const result = await service.updateOrderStatus(
              1,
              {
                status: toStatus as OrderStatus,
              },
              100,
              0,
            );

            expect(result).toBeDefined();
            expect(result).not.toBeNull();
            expect(mockBaseOrderService.updateOrderStatus).toHaveBeenCalled();
          });
        } else {
          it(`should REJECT transition: ${fromStatus} -> ${toStatus}`, async () => {
            const mockOrder = createMockOrder(fromStatus);
            mockEnv.CACHE_KV.get.mockResolvedValue(mockOrder);

            // Use Admin role (0) to isolate transition validation from role check
            await expect(
              service.updateOrderStatus(
                1,
                {
                  status: toStatus as OrderStatus,
                },
                100,
                0,
              ),
            ).rejects.toThrow("Invalid status transition");
          });
        }
      }
    }
  });

  // =========================================================================
  // 2. Role-Based Transition Tests
  // =========================================================================
  describe("Role-based permission checks", () => {
    for (const [roleNum, roleName] of Object.entries(ROLE_NAMES)) {
      const role = Number(roleNum) as UserRole;
      const allowedTargets = ROLE_PERMISSIONS[role];

      describe(`Role: ${roleName} (${role})`, () => {
        // Test transitions this role IS allowed to make
        for (const targetStatus of allowedTargets) {
          // Find a valid "from" status that can transition to targetStatus
          const validFromStatus = ALL_STATUSES.find((from) =>
            VALID_TRANSITIONS[from]?.includes(targetStatus),
          );

          if (validFromStatus) {
            it(`should ALLOW ${roleName} to transition ${validFromStatus} -> ${targetStatus}`, async () => {
              const mockOrder = createMockOrder(validFromStatus);
              mockEnv.CACHE_KV.get.mockResolvedValue(mockOrder);

              const updatedOrder = createMockOrder(targetStatus);
              mockBaseOrderService.updateOrderStatus.mockResolvedValue(
                updatedOrder,
              );

              const result = await service.updateOrderStatus(
                1,
                {
                  status: targetStatus as OrderStatus,
                },
                100,
                role,
              );

              expect(result).toBeDefined();
              expect(result).not.toBeNull();
            });
          }
        }

        // Test transitions this role is NOT allowed to make
        const disallowedTargets = ALL_STATUSES.filter(
          (s) => !allowedTargets.includes(s),
        );

        for (const targetStatus of disallowedTargets) {
          // Find a valid "from" status that can transition to targetStatus
          // so we isolate the role permission error from the transition error
          const validFromStatus = ALL_STATUSES.find((from) =>
            VALID_TRANSITIONS[from]?.includes(targetStatus),
          );

          if (validFromStatus) {
            it(`should REJECT ${roleName} from transitioning to ${targetStatus}`, async () => {
              const mockOrder = createMockOrder(validFromStatus);
              mockEnv.CACHE_KV.get.mockResolvedValue(mockOrder);

              await expect(
                service.updateOrderStatus(
                  1,
                  {
                    status: targetStatus as OrderStatus,
                  },
                  100,
                  role,
                ),
              ).rejects.toThrow("Insufficient permissions");
            });
          }
        }
      });
    }

    describe("No role provided (userRole = undefined)", () => {
      it("should allow valid transitions without role checking", async () => {
        const mockOrder = createMockOrder("pending");
        mockEnv.CACHE_KV.get.mockResolvedValue(mockOrder);

        const updatedOrder = createMockOrder("confirmed");
        mockBaseOrderService.updateOrderStatus.mockResolvedValue(updatedOrder);

        // No userRole parameter means role check is skipped
        const result = await service.updateOrderStatus(
          1,
          { status: "confirmed" as OrderStatus },
          100,
          undefined,
        );

        expect(result).toBeDefined();
        expect(result).not.toBeNull();
      });

      it("should still reject invalid transitions even without role", async () => {
        const mockOrder = createMockOrder("pending");
        mockEnv.CACHE_KV.get.mockResolvedValue(mockOrder);

        await expect(
          service.updateOrderStatus(
            1,
            { status: "delivered" as OrderStatus },
            100,
            undefined,
          ),
        ).rejects.toThrow("Invalid status transition");
      });
    });
  });

  // =========================================================================
  // 3. Numeric Status Input Handling
  // =========================================================================
  describe("Numeric status normalization", () => {
    for (const [numStr, statusStr] of Object.entries(STATUS_MAP)) {
      const numericValue = Number(numStr);

      it(`should normalize numeric status ${numericValue} to "${statusStr}"`, async () => {
        // Test that order with numeric current status works
        const mockOrder = createMockOrder(numericValue);
        mockEnv.CACHE_KV.get.mockResolvedValue(mockOrder);

        const validTargets = VALID_TRANSITIONS[statusStr];
        if (validTargets && validTargets.length > 0) {
          const targetStatus = validTargets[0]; // Pick the first valid transition
          const updatedOrder = createMockOrder(targetStatus);
          mockBaseOrderService.updateOrderStatus.mockResolvedValue(
            updatedOrder,
          );

          const result = await service.updateOrderStatus(
            1,
            {
              status: targetStatus as OrderStatus,
            },
            100,
            0, // Admin
          );

          expect(result).toBeDefined();
          expect(result).not.toBeNull();
        } else {
          // Terminal status (paid/cancelled) - should reject any transition
          await expect(
            service.updateOrderStatus(
              1,
              { status: "confirmed" as OrderStatus },
              100,
              0,
            ),
          ).rejects.toThrow("Invalid status transition");
        }
      });
    }

    it('should handle string status values for new status ("pending" = 0)', async () => {
      const mockOrder = createMockOrder("confirmed");
      mockEnv.CACHE_KV.get.mockResolvedValue(mockOrder);

      const updatedOrder = createMockOrder("preparing");
      mockBaseOrderService.updateOrderStatus.mockResolvedValue(updatedOrder);

      // "preparing" as OrderStatus = 2, passed as numeric
      const result = await service.updateOrderStatus(
        1,
        { status: "preparing" as OrderStatus },
        100,
        0,
      );

      expect(result).toBeDefined();
    });

    it("should handle order with numeric current status and numeric new status", async () => {
      // Order has numeric status 0 (pending), transition to numeric 1 (confirmed)
      const mockOrder = createMockOrder(0);
      mockEnv.CACHE_KV.get.mockResolvedValue(mockOrder);

      const updatedOrder = createMockOrder(1);
      mockBaseOrderService.updateOrderStatus.mockResolvedValue(updatedOrder);

      const result = await service.updateOrderStatus(
        1,
        { status: "confirmed" as OrderStatus }, // enum value = 1
        100,
        0,
      );

      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });

    it("should handle order with string current status and numeric new status", async () => {
      const mockOrder = createMockOrder("pending");
      mockEnv.CACHE_KV.get.mockResolvedValue(mockOrder);

      const updatedOrder = createMockOrder("confirmed");
      mockBaseOrderService.updateOrderStatus.mockResolvedValue(updatedOrder);

      const result = await service.updateOrderStatus(
        1,
        { status: 1 as unknown as OrderStatus }, // numeric 1 = confirmed
        100,
        0,
      );

      expect(result).toBeDefined();
      expect(result).not.toBeNull();
    });
  });

  // =========================================================================
  // 4. Edge Cases
  // =========================================================================
  describe("Edge cases", () => {
    describe("Unknown status values", () => {
      it("should reject unknown numeric status as current status", async () => {
        const mockOrder = createMockOrder(99); // Unknown numeric status
        mockEnv.CACHE_KV.get.mockResolvedValue(mockOrder);

        await expect(
          service.updateOrderStatus(
            1,
            { status: "confirmed" as OrderStatus },
            100,
            0,
          ),
        ).rejects.toThrow("Invalid status transition");
      });

      it("should reject unknown string status as current status", async () => {
        const mockOrder = createMockOrder("invalid_status");
        mockEnv.CACHE_KV.get.mockResolvedValue(mockOrder);

        await expect(
          service.updateOrderStatus(
            1,
            { status: "confirmed" as OrderStatus },
            100,
            0,
          ),
        ).rejects.toThrow("Invalid status transition");
      });

      it("should reject unknown numeric status as new status", async () => {
        const mockOrder = createMockOrder("pending");
        mockEnv.CACHE_KV.get.mockResolvedValue(mockOrder);

        await expect(
          service.updateOrderStatus(
            1,
            { status: 99 as unknown as OrderStatus },
            100,
            0,
          ),
        ).rejects.toThrow("Invalid status transition");
      });

      it("should reject unknown string as new status", async () => {
        const mockOrder = createMockOrder("pending");
        mockEnv.CACHE_KV.get.mockResolvedValue(mockOrder);

        await expect(
          service.updateOrderStatus(
            1,
            { status: "nonexistent" as unknown as OrderStatus },
            100,
            0,
          ),
        ).rejects.toThrow("Invalid status transition");
      });
    });

    describe("Same status transition (no-op)", () => {
      for (const status of ALL_STATUSES) {
        it(`should reject same-status transition: ${status} -> ${status}`, async () => {
          const mockOrder = createMockOrder(status);
          mockEnv.CACHE_KV.get.mockResolvedValue(mockOrder);

          await expect(
            service.updateOrderStatus(
              1,
              {
                status: status as OrderStatus,
              },
              100,
              0,
            ),
          ).rejects.toThrow("Invalid status transition");
        });
      }
    });

    describe("Terminal states", () => {
      it("should reject all transitions from 'paid' status", async () => {
        const mockOrder = createMockOrder("paid");
        mockEnv.CACHE_KV.get.mockResolvedValue(mockOrder);

        for (const targetStatus of ALL_STATUSES) {
          await expect(
            service.updateOrderStatus(
              1,
              {
                status: targetStatus as OrderStatus,
              },
              100,
              0,
            ),
          ).rejects.toThrow("Invalid status transition");
        }
      });

      it("should reject all transitions from 'cancelled' status", async () => {
        const mockOrder = createMockOrder("cancelled");
        mockEnv.CACHE_KV.get.mockResolvedValue(mockOrder);

        for (const targetStatus of ALL_STATUSES) {
          await expect(
            service.updateOrderStatus(
              1,
              {
                status: targetStatus as OrderStatus,
              },
              100,
              0,
            ),
          ).rejects.toThrow("Invalid status transition");
        }
      });
    });

    describe("Non-existent order", () => {
      it("should return null when order does not exist", async () => {
        mockEnv.CACHE_KV.get.mockResolvedValue(null);
        mockBaseOrderService.getOrder.mockResolvedValue(null);

        const result = await service.updateOrderStatus(
          999,
          { status: "confirmed" as OrderStatus },
          100,
          0,
        );

        expect(result).toBeNull();
      });
    });

    describe("Cancellation from every cancellable status", () => {
      const cancellableStatuses = [
        "pending",
        "confirmed",
        "preparing",
        "ready",
      ];

      for (const fromStatus of cancellableStatuses) {
        it(`should allow cancellation from ${fromStatus}`, async () => {
          const mockOrder = createMockOrder(fromStatus);
          mockEnv.CACHE_KV.get.mockResolvedValue(mockOrder);

          const updatedOrder = createMockOrder("cancelled");
          mockBaseOrderService.updateOrderStatus.mockResolvedValue(
            updatedOrder,
          );

          const result = await service.updateOrderStatus(
            1,
            { status: "cancelled" as OrderStatus },
            100,
            0, // Admin
          );

          expect(result).toBeDefined();
          expect(result).not.toBeNull();
        });
      }

      const nonCancellableStatuses = ["delivered", "paid", "cancelled"];

      for (const fromStatus of nonCancellableStatuses) {
        it(`should reject cancellation from ${fromStatus}`, async () => {
          const mockOrder = createMockOrder(fromStatus);
          mockEnv.CACHE_KV.get.mockResolvedValue(mockOrder);

          await expect(
            service.updateOrderStatus(
              1,
              { status: "cancelled" as OrderStatus },
              100,
              0,
            ),
          ).rejects.toThrow("Invalid status transition");
        });
      }
    });

    describe("Full happy-path lifecycle", () => {
      it("should complete the full order lifecycle: pending -> confirmed -> preparing -> ready -> delivered -> paid", async () => {
        const lifecycle = [
          "pending",
          "confirmed",
          "preparing",
          "ready",
          "delivered",
          "paid",
        ] as const;

        for (let i = 0; i < lifecycle.length - 1; i++) {
          const fromStatus = lifecycle[i];
          const toStatus = lifecycle[i + 1];

          // Reset mocks without breaking references held by the service instance
          mockEnv.CACHE_KV.get.mockReset();
          mockEnv.CACHE_KV.set.mockReset();
          mockEnv.CACHE_KV.delete.mockReset();
          mockBaseOrderService.updateOrderStatus.mockReset();

          const mockOrder = createMockOrder(fromStatus);
          mockEnv.CACHE_KV.get.mockResolvedValue(mockOrder);
          mockEnv.CACHE_KV.set.mockResolvedValue(undefined);
          mockEnv.CACHE_KV.delete.mockResolvedValue(undefined);

          const updatedOrder = createMockOrder(toStatus);
          mockBaseOrderService.updateOrderStatus.mockResolvedValue(
            updatedOrder,
          );

          const result = await service.updateOrderStatus(
            1,
            {
              status: toStatus as OrderStatus,
            },
            100,
            0, // Admin
          );

          expect(result).toBeDefined();
          expect(result).not.toBeNull();
          expect(result!.status).toBe(toStatus);
        }
      });
    });
  });
});
