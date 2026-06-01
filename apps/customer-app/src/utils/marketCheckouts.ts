import type { MarketCheckoutSummary } from "@/services/orderApi";

const STORAGE_KEY = "makanmakan_recent_market_checkouts";
const MAX_RECENT_CHECKOUTS = 10;
const CHECKOUT_TTL_MS = 4 * 60 * 60 * 1000;

export interface StoredMarketCheckout {
  id: string;
  marketSlug: string;
  marketName: string;
  childOrderCount: number;
  totalAmount: number;
  paymentStatus: "pending" | "partial_paid" | "paid" | "failed";
  createdAt: string;
  updatedAt: number;
}

export function recordRecentMarketCheckout(checkout: MarketCheckoutSummary) {
  const storedCheckout: StoredMarketCheckout = {
    id: checkout.id,
    marketSlug: checkout.market.slug,
    marketName: checkout.market.name,
    childOrderCount: checkout.childOrders.length,
    totalAmount: checkout.subtotal,
    paymentStatus: checkout.payment?.status ?? "pending",
    createdAt: checkout.createdAt,
    updatedAt: Date.now(),
  };

  const nextCheckouts = [
    storedCheckout,
    ...listRecentMarketCheckouts().filter(
      (item) => item.id !== storedCheckout.id,
    ),
  ].slice(0, MAX_RECENT_CHECKOUTS);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextCheckouts));
  } catch (error) {
    console.warn("保存最近市場訂單失敗:", error);
  }
}

export function listRecentMarketCheckouts(): StoredMarketCheckout[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }

    const now = Date.now();
    const checkouts = parsed
      .filter(isStoredMarketCheckout)
      .filter((checkout) => now - checkout.updatedAt <= CHECKOUT_TTL_MS)
      .slice(0, MAX_RECENT_CHECKOUTS);

    if (checkouts.length !== parsed.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checkouts));
    }

    return checkouts;
  } catch (error) {
    console.warn("讀取最近市場訂單失敗:", error);
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

function isStoredMarketCheckout(value: unknown): value is StoredMarketCheckout {
  if (!value || typeof value !== "object") return false;
  const checkout = value as Partial<StoredMarketCheckout>;
  return (
    typeof checkout.id === "string" &&
    typeof checkout.marketSlug === "string" &&
    typeof checkout.marketName === "string" &&
    typeof checkout.childOrderCount === "number" &&
    typeof checkout.totalAmount === "number" &&
    isPaymentStatus(checkout.paymentStatus) &&
    typeof checkout.createdAt === "string" &&
    typeof checkout.updatedAt === "number"
  );
}

function isPaymentStatus(
  value: unknown,
): value is StoredMarketCheckout["paymentStatus"] {
  return (
    value === "pending" ||
    value === "partial_paid" ||
    value === "paid" ||
    value === "failed"
  );
}
