import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    isAuthenticated: false,
    checkAuth: vi.fn(),
  }),
}));

describe("market route titles", () => {
  // The first import of @/router transforms its eager dependency graph, which
  // alone approaches the 5s test timeout on a loaded machine (#211). Pay it
  // here under the hook's own budget.
  beforeAll(async () => {
    await import("@/router");
  }, 30_000);

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
