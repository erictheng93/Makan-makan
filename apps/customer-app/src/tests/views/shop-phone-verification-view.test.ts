import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ShopPhoneVerificationView from "@/views/ShopPhoneVerificationView.vue";
import { apiClient } from "@/services/api";

const routerPush = vi.hoisted(() => vi.fn());

vi.mock("vue-router", () => ({
  useRoute: () => ({
    query: {
      qr: "SHOP-restaurant-1",
      itemId: "42",
      fulfillmentType: "takeaway",
    },
  }),
  useRouter: () => ({
    push: routerPush,
    back: vi.fn(),
  }),
}));

vi.mock("@/composables/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/services/api", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe("ShopPhoneVerificationView", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    routerPush.mockReset();
    vi.mocked(apiClient.get).mockResolvedValue({
      id: "restaurant-1",
      name: "章魚燒攤",
      enableShopMode: true,
    } as never);
    vi.mocked(apiClient.post).mockResolvedValue({
      success: true,
      token: "guest-token",
    } as never);
  });

  it("verifies the shop QR against the mounted route, not the /qr-codes prefix", async () => {
    // The qr-codes feature is mounted at /qr (app-factory: apiV1.route("/qr")).
    // Asserting only that apiClient.get was called let a /qr-codes path ship and
    // 404 in the shop ordering flow, so pin the path itself.
    const wrapper = mount(ShopPhoneVerificationView, {
      props: {
        restaurantId: "restaurant-1",
        shopQrCode: "SHOP-1-1760068334",
      },
    });
    await vi.runAllTimersAsync();
    await wrapper.get("#phone").setValue("123");
    await wrapper.get('[data-testid="verify-btn"]').trigger("click");
    await vi.runAllTimersAsync();

    expect(vi.mocked(apiClient.get)).toHaveBeenCalledWith(
      "/qr/verify/shop/SHOP-1-1760068334",
    );
  });

  it("preserves market dish deep-link query when verification opens the shop menu", async () => {
    const wrapper = mount(ShopPhoneVerificationView, {
      props: {
        restaurantId: "restaurant-1",
      },
    });
    await vi.runAllTimersAsync();
    await wrapper.get("#phone").setValue("123");
    await wrapper.get('[data-testid="verify-btn"]').trigger("click");
    await vi.runAllTimersAsync();

    expect(routerPush).toHaveBeenCalledWith({
      name: "ShopMenu",
      params: { restaurantId: "restaurant-1" },
      query: {
        qr: "SHOP-restaurant-1",
        itemId: "42",
        fulfillmentType: "takeaway",
        phone: "123",
      },
    });
  });
});
