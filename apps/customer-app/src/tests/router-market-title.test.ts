import { describe, expect, it, vi } from "vitest";

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    isAuthenticated: false,
    checkAuth: vi.fn(),
  }),
}));

describe("market route titles", () => {
  it("uses market-specific navigation title keys", async () => {
    const { default: router } = await import("@/router");

    expect(router.resolve("/markets").meta.titleKey).toBe("navigation.markets");
    expect(router.resolve("/markets/fengjia").meta.titleKey).toBe(
      "navigation.markets",
    );
  });

  it("recognizes signed QR order entry URLs", async () => {
    const { default: router } = await import("@/router");

    expect(router.resolve("/order?t=table").name).toBe("SignedOrderEntry");
  });
});
