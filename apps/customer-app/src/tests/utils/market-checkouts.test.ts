import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listRecentMarketCheckouts,
  recordRecentMarketCheckout,
} from "@/utils/marketCheckouts";
import type { MarketCheckoutSummary } from "@/services/orderApi";

function checkout(
  overrides: Partial<MarketCheckoutSummary> = {},
): MarketCheckoutSummary {
  return {
    id: "checkout-1",
    market: {
      id: "market-1",
      slug: "fengjia",
      name: "逢甲夜市",
    },
    status: "submitted",
    childOrders: [
      {
        restaurantId: "restaurant-1",
        restaurantName: "雞排攤",
        orderId: 101,
        orderNumber: "A001",
        totalAmount: 160,
        tokenExpiresAt: "2026-06-01T12:00:00.000Z",
      },
      {
        restaurantId: "restaurant-2",
        restaurantName: "甜點攤",
        orderId: 102,
        orderNumber: "A002",
        totalAmount: 80,
        tokenExpiresAt: "2026-06-01T12:00:00.000Z",
      },
    ],
    subtotal: 240,
    createdAt: "2026-06-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("marketCheckouts", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.setSystemTime(new Date("2026-06-01T12:00:00Z"));
  });

  it("records recent market checkouts newest first", () => {
    recordRecentMarketCheckout(checkout({ id: "checkout-1" }));
    recordRecentMarketCheckout(
      checkout({
        id: "checkout-2",
        market: { id: "market-2", slug: "ximen", name: "西門町商圈" },
      }),
    );
    recordRecentMarketCheckout(checkout({ id: "checkout-1" }));

    expect(listRecentMarketCheckouts().map((item) => item.id)).toEqual([
      "checkout-1",
      "checkout-2",
    ]);
    expect(listRecentMarketCheckouts()[0]).toMatchObject({
      marketSlug: "fengjia",
      marketName: "逢甲夜市",
      childOrderCount: 2,
      totalAmount: 240,
      paymentStatus: "pending",
    });
  });

  it("keeps payment status in recent market checkout records", () => {
    recordRecentMarketCheckout(
      checkout({
        payment: {
          status: "partial_paid",
          method: "market_online",
          currency: "TWD",
          country: "TW",
          totalAmount: 240,
          totalAmountCents: 24000,
          paidAmount: 160,
          paidAmountCents: 16000,
          childPayments: [],
        },
      }),
    );

    expect(listRecentMarketCheckouts()[0].paymentStatus).toBe("partial_paid");
  });
});
