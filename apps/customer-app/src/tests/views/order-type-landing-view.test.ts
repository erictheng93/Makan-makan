import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OrderTypeLandingView from "@/views/OrderTypeLandingView.vue";
import { menuApi } from "@/services/menuApi";

const routerPush = vi.hoisted(() => vi.fn());
const routeQuery = vi.hoisted(() => ({
  qr: "SHOP-restaurant-1",
  itemId: "42",
  categoryName: "小吃",
  returnPath: "/markets/fengjia",
  returnLabel: "逢甲夜市",
}));

vi.mock("vue-router", () => ({
  useRoute: () => ({ query: routeQuery }),
  useRouter: () => ({ push: routerPush }),
}));

vi.mock("@/composables/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/stores/shopCart", () => ({
  useShopCartStore: () => ({
    setFulfillmentType: vi.fn(),
    setDeliveryFee: vi.fn(),
  }),
}));

vi.mock("@/services/menuApi", () => ({
  menuApi: {
    getRestaurant: vi.fn(),
  },
}));

describe("OrderTypeLandingView", () => {
  beforeEach(() => {
    routerPush.mockReset();
    delete (
      routeQuery as Partial<typeof routeQuery> & {
        serviceItemId?: string;
      }
    ).serviceItemId;
    Object.assign(routeQuery, {
      qr: "SHOP-restaurant-1",
      itemId: "42",
      categoryName: "小吃",
      returnPath: "/markets/fengjia",
      returnLabel: "逢甲夜市",
    });
    vi.mocked(menuApi.getRestaurant).mockResolvedValue({
      id: "restaurant-1",
      name: "市場入口店",
      settings: {
        enableDineIn: true,
        enableTakeaway: true,
        enableDelivery: true,
      },
    } as never);
  });

  it("preserves market item deep-link query when dine-in opens the shop menu", async () => {
    const wrapper = mount(OrderTypeLandingView, {
      props: { restaurantId: "restaurant-1" },
    });

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="continue-btn"]').exists()).toBe(true);
    });
    await wrapper.get('[data-testid="continue-btn"]').trigger("click");

    expect(routerPush).toHaveBeenCalledWith({
      name: "ShopMenu",
      params: { restaurantId: "restaurant-1" },
      query: {
        qr: "SHOP-restaurant-1",
        itemId: "42",
        categoryName: "小吃",
        returnPath: "/markets/fengjia",
        returnLabel: "逢甲夜市",
        fulfillmentType: "dine-in",
      },
    });
  });

  it("preserves market service deep-link query when dine-in opens the shop menu", async () => {
    delete (routeQuery as Partial<typeof routeQuery>).itemId;
    delete (routeQuery as Partial<typeof routeQuery>).categoryName;
    Object.assign(routeQuery, {
      serviceItemId: "7",
    });

    const wrapper = mount(OrderTypeLandingView, {
      props: { restaurantId: "restaurant-1" },
    });

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="continue-btn"]').exists()).toBe(true);
    });
    await wrapper.get('[data-testid="continue-btn"]').trigger("click");

    expect(routerPush).toHaveBeenCalledWith({
      name: "ShopMenu",
      params: { restaurantId: "restaurant-1" },
      query: {
        qr: "SHOP-restaurant-1",
        serviceItemId: "7",
        returnPath: "/markets/fengjia",
        returnLabel: "逢甲夜市",
        fulfillmentType: "dine-in",
      },
    });
  });
});
