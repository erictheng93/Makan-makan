/**
 * OrderStatus Filter Regression Guard — Issue #9 / PR #7
 *
 * This test is the Phase 1 signal flare for the OrderStatus unification plan
 * (`docs/superpowers/plans/2026-04-09-orderstatus-unification.md`). It has two
 * jobs:
 *
 *   1. **Signal flare (block A)** — assert that the shared-types `OrderStatus`
 *      enum is consistent with the DB canonical set. This FAILS today because
 *      `packages/shared-types/src/order.ts` still ships a numeric enum with 7
 *      members (missing `refunded`). Phase 2 Task 13 (rewrite shared-types to
 *      a string union) is the fix. When this test goes green, Phase 2 is done.
 *
 *   2. **Regression guard (block B)** — assert that for every one of the 8
 *      canonical states, `OrdersService.getOrders({ status: [X] })` round-trips
 *      the string filter through to `baseOrderService.getOrders` unchanged.
 *      This PASSES today because PR #7 (commit 3ea69a8f "align orders status
 *      query filter with DB string-union type") fixed the filter plumbing.
 *      The test exists to prevent a future refactor from silently re-introducing
 *      a numeric coercion layer or dropping a state from the filter path.
 *
 * The `CANONICAL_ORDER_STATUSES` array is pinned to the DB schema source of
 * truth (`packages/database/src/schema/orders.ts:14-24`). A separate test
 * (block C) asserts they stay in sync — if you add a 9th state to the DB,
 * this file's test array must grow or CI fails.
 *
 * @see docs/investigations/2026-04-09-orderstatus-surface-audit.md
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ORDER_STATUS } from "@makanmakan/database";
import { ORDER_STATUSES } from "@makanmakan/shared-types";
import { envFactory, resetAllFactories } from "@makanmakan/testing-utils";
import { OrdersService } from "../services/OrdersService";

// ---------------------------------------------------------------------------
// Canonical source of truth — MUST stay in sync with packages/database/src/schema/orders.ts
// ---------------------------------------------------------------------------

const CANONICAL_ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "delivered",
  "paid",
  "cancelled",
  "refunded",
] as const;

// ---------------------------------------------------------------------------
// Mocks — same pattern as service.test.ts so we don't touch the real DB
// ---------------------------------------------------------------------------

vi.mock("@makanmakan/database", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
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
  };
});

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

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("OrderStatus canonical set invariants (Issue #9)", () => {
  // Block C: the test array must mirror the DB
  it("CANONICAL_ORDER_STATUSES stays in sync with DB ORDER_STATUS", () => {
    const dbValues = new Set(Object.values(ORDER_STATUS));
    const testValues = new Set(CANONICAL_ORDER_STATUSES);
    expect(testValues).toEqual(dbValues);
  });

  // Block A: the signal flare — passes now that Phase 2 Task 13 rewrote shared-types
  // to a string union. ORDER_STATUSES is the runtime const array of all valid statuses.
  it("shared-types OrderStatus matches the DB canonical set (FAILS until Phase 2 Task 13)", () => {
    // ORDER_STATUSES is the runtime array exported alongside the OrderStatus type alias.
    const sharedValues = new Set(ORDER_STATUSES as unknown as string[]);
    const canonical = new Set(CANONICAL_ORDER_STATUSES);
    expect(sharedValues).toEqual(canonical);
  });
});

describe("OrdersService.getOrders — status filter regression (PR #7 lock-in)", () => {
  let service: OrdersService;
  let mockBaseOrderService: {
    createOrder: ReturnType<typeof vi.fn>;
    getOrder: ReturnType<typeof vi.fn>;
    getOrders: ReturnType<typeof vi.fn>;
    updateOrderStatus: ReturnType<typeof vi.fn>;
    cancelOrder: ReturnType<typeof vi.fn>;
    getDailyOrderStats: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    resetAllFactories();

    const env = envFactory.build();

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
    (OrderService as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      function () {
        return mockBaseOrderService;
      },
    );
    (CouponService as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      function () {
        return { validateCoupon: vi.fn() };
      },
    );

    service = new OrdersService(env as never);
  });

  // Block B: parametrized round-trip
  it.each(CANONICAL_ORDER_STATUSES)(
    "returns the row and forwards string filter when filtering by status=%s",
    async (status) => {
      mockBaseOrderService.getOrders.mockResolvedValue({
        orders: [
          {
            id: 1,
            restaurantId: "r1",
            status,
            totalAmount: 1000,
            items: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const result = await service.getOrders({
        restaurantId: "r1",
        // OrderQueryFilters.status uses the DB string-union, cast narrows to the
        // canonical literal type without pulling in testing-utils OrderStatus drift.
        status: [status] as never,
      });

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].status).toBe(status);
      expect(mockBaseOrderService.getOrders).toHaveBeenCalledOnce();
      // This is the load-bearing assertion: if anyone re-introduces a numeric
      // coercion layer in convertToBaseFilters, the status array won't match.
      expect(mockBaseOrderService.getOrders).toHaveBeenCalledWith(
        expect.objectContaining({ status: [status] }),
        expect.any(Number),
        expect.any(Number),
      );
    },
  );

  it("accepts a multi-status array filter", async () => {
    mockBaseOrderService.getOrders.mockResolvedValue({
      orders: [
        {
          id: 1,
          restaurantId: "r1",
          status: "pending",
          items: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          restaurantId: "r1",
          status: "confirmed",
          items: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
    });

    const result = await service.getOrders({
      restaurantId: "r1",
      status: ["pending", "confirmed"] as never,
    });

    expect(result.orders).toHaveLength(2);
    expect(mockBaseOrderService.getOrders).toHaveBeenCalledWith(
      expect.objectContaining({ status: ["pending", "confirmed"] }),
      expect.any(Number),
      expect.any(Number),
    );
  });
});
