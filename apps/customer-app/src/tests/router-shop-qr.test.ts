import { describe, expect, it, vi } from "vitest";
import type { RouteLocationNormalizedGeneric } from "vue-router";

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    isAuthenticated: false,
    checkAuth: vi.fn(),
  }),
}));

function resolveProps(url: string) {
  return import("@/router").then(({ default: router }) => {
    const resolved = router.resolve(url);
    const propsOption = resolved.matched[0]?.props?.default;
    return typeof propsOption === "function"
      ? (propsOption(
          // resolve() widens `name` to allow null; the props functions only
          // read params/query, which are identical between the two shapes.
          resolved as unknown as RouteLocationNormalizedGeneric,
        ) as Record<string, unknown>)
      : {};
  });
}

describe("shop menu route", () => {
  const SHOP_QR_CODE = "SHOP-restaurant-1-1785563580";

  it("carries the scanned code from the URL into the view", async () => {
    // This is the whole chain that lets a regenerated QR retire the old
    // sticker: `?qr=` rides every push from the landing page onward, and
    // checkout can only prove which sticker it came from if it lands here.
    const props = await resolveProps(
      `/restaurant/restaurant-1/shop/menu?phone=678&qr=${SHOP_QR_CODE}`,
    );

    expect(props).toMatchObject({
      restaurantId: "restaurant-1",
      phoneLastDigits: "678",
      shopQrCode: SHOP_QR_CODE,
    });
  });

  it("leaves the code undefined for entries that had no sticker", async () => {
    const props = await resolveProps(
      "/restaurant/restaurant-1/shop/menu?waitingTicketId=w-1",
    );

    expect(props.shopQrCode).toBeUndefined();
  });
});
