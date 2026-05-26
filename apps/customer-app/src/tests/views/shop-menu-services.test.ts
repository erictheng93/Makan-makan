import { mount } from "@vue/test-utils";
import { computed, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ShopMenuView from "@/views/ShopMenuView.vue";
import { menuApi } from "@/services/menuApi";
import { restaurantContactApi } from "@/services/restaurantContactApi";

const routerPush = vi.hoisted(() => vi.fn());

vi.mock("vue-router", () => ({
  useRoute: () => ({ path: "/restaurant/restaurant-1/shop/menu" }),
  useRouter: () => ({ back: vi.fn(), push: routerPush }),
}));

vi.mock("vue-toastification", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/composables/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    tWithParams: (key: string, params: Record<string, unknown>) =>
      `${key}:${params.name}`,
  }),
}));

vi.mock("@/composables/useBreakpoint", () => ({
  useIsDesktop: () => ref(false),
}));

vi.mock("@/stores/app", () => ({
  useAppStore: () => ({
    currentRestaurant: null,
    setRestaurantContext: vi.fn(),
  }),
}));

vi.mock("@/stores/shopCart", () => ({
  useShopCartStore: () => ({
    itemCount: 0,
    items: [],
    subtotal: 0,
    fulfillmentType: "takeaway",
    initializeCart: vi.fn(),
    addItem: vi.fn(),
    removeItem: vi.fn(),
    updateQuantity: vi.fn(),
  }),
}));

vi.mock("@/utils/seoMeta", () => ({
  applyShopMenuSeoMeta: vi.fn(),
}));

vi.mock("@/components/MenuItemCard.vue", () => ({
  default: { template: "<div />" },
}));

vi.mock("@/components/MenuItemModal.vue", () => ({
  default: { template: "<div />" },
}));

vi.mock("@/components/CustomizationModal.vue", () => ({
  default: { template: "<div />" },
}));

vi.mock("@/components/ShopCartModal.vue", () => ({
  default: { template: "<div />" },
}));

vi.mock("@/components/DesktopCartPanel.vue", () => ({
  default: { template: "<div />" },
}));

vi.mock("@tanstack/vue-query", () => ({
  useQuery: (options: { queryKey: string[]; queryFn: () => unknown }) => {
    if (options.queryKey[0] === "restaurant") {
      return {
        data: ref({
          id: "restaurant-1",
          name: "服務測試店",
          settings: { currency: "TWD" },
        }),
        isLoading: ref(false),
        error: ref(null),
        refetch: vi.fn(),
      };
    }

    if (options.queryKey[0] === "menu") {
      return {
        data: ref({
          categories: [
            {
              id: 10,
              restaurantId: "restaurant-1",
              name: "小吃",
              sortOrder: 0,
              status: 1,
            },
          ],
          menuItems: [
            {
              id: 42,
              restaurantId: "restaurant-1",
              categoryId: 10,
              name: "章魚燒",
              price: 8000,
              spiceLevel: 0,
              sortOrder: 1,
              isAvailable: true,
              isFeatured: false,
              inventoryCount: -1,
              orderCount: 0,
              createdAt: "",
              updatedAt: "",
            },
          ],
        }),
        isLoading: ref(false),
        error: ref(null),
        refetch: vi.fn(),
      };
    }

    return {
      data: ref([
        {
          id: 1,
          restaurantId: "restaurant-1",
          name: "預約外送",
          description: "滿額可預約外送",
          serviceType: "delivery",
          priceLabel: "依距離報價",
          requiresBooking: true,
          sortOrder: 0,
          isActive: true,
          isPublic: true,
          createdAt: "",
          updatedAt: "",
        },
      ]),
      isLoading: ref(false),
      error: ref(null),
      refetch: vi.fn(),
    };
  },
}));

vi.mock("@/services/menuApi", () => ({
  menuApi: {
    getRestaurant: vi.fn(),
    getMenu: vi.fn(),
  },
}));

vi.mock("@/services/restaurantContactApi", () => ({
  restaurantContactApi: {
    listServiceItems: vi.fn(),
  },
}));

vi.mock("@/composables/useCurrency", () => ({
  useCurrency: () => ({
    formatPrice: (amount: number) => `NT$${amount}`,
    currencyCode: computed(() => "TWD"),
  }),
}));

describe("ShopMenuView service items", () => {
  let scrollIntoView: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    routerPush.mockReset();
    scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
  });

  it("renders public restaurant service items beside the menu", () => {
    const wrapper = mount(ShopMenuView, {
      props: { restaurantId: "restaurant-1" },
      global: {
        stubs: {
          MenuItemCard: true,
          MenuItemModal: true,
          CustomizationModal: true,
          ShopCartModal: true,
          DesktopCartPanel: true,
        },
      },
    });

    expect(menuApi.getRestaurant).toBeDefined();
    expect(restaurantContactApi.listServiceItems).toBeDefined();
    expect(wrapper.get('[data-testid="shop-service-items"]').text()).toContain(
      "預約外送",
    );
    expect(wrapper.get('[data-testid="shop-service-items"]').text()).toContain(
      "滿額可預約外送",
    );
    expect(wrapper.get('[data-testid="shop-service-items"]').text()).toContain(
      "依距離報價",
    );
  });

  it("highlights and scrolls to a linked service item", async () => {
    const wrapper = mount(ShopMenuView, {
      props: { restaurantId: "restaurant-1", linkedServiceItemId: "1" },
      attachTo: document.body,
      global: {
        stubs: {
          MenuItemCard: true,
          MenuItemModal: true,
          CustomizationModal: true,
          ShopCartModal: true,
          DesktopCartPanel: true,
        },
      },
    });

    await wrapper.vm.$nextTick();
    await wrapper.vm.$nextTick();

    const service = wrapper.get("#service-item-1");
    expect(service.classes()).toContain("border-ios-blue");
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
    wrapper.unmount();
  });

  it("shows the linked service target and returns to the search context", async () => {
    const wrapper = mount(ShopMenuView, {
      props: {
        restaurantId: "restaurant-1",
        linkedServiceItemId: "1",
        returnPath: "/discover?q=%E5%A4%96%E9%80%81",
        returnLabel: "搜尋結果",
      },
      global: {
        stubs: {
          MenuItemCard: true,
          MenuItemModal: true,
          CustomizationModal: true,
          ShopCartModal: true,
          DesktopCartPanel: true,
        },
      },
    });

    const context = wrapper.get('[data-testid="shop-menu-entry-context"]');
    expect(context.text()).toContain("預約外送");
    expect(context.text()).toContain("搜尋結果");

    await wrapper
      .get('[data-testid="shop-menu-return-context"]')
      .trigger("click");

    expect(routerPush).toHaveBeenCalledWith("/discover?q=%E5%A4%96%E9%80%81");
  });

  it("shows the linked menu item target when opening from a dish result", () => {
    const wrapper = mount(ShopMenuView, {
      props: { restaurantId: "restaurant-1", linkedItemId: "42" },
      global: {
        stubs: {
          MenuItemCard: true,
          MenuItemModal: true,
          CustomizationModal: true,
          ShopCartModal: true,
          DesktopCartPanel: true,
        },
      },
    });

    expect(
      wrapper.get('[data-testid="shop-menu-entry-context"]').text(),
    ).toContain("章魚燒");
  });

  it("ignores unsafe return paths", async () => {
    const wrapper = mount(ShopMenuView, {
      props: {
        restaurantId: "restaurant-1",
        returnPath: "https://example.com/phishing",
        returnLabel: "外部網站",
      },
      global: {
        stubs: {
          MenuItemCard: true,
          MenuItemModal: true,
          CustomizationModal: true,
          ShopCartModal: true,
          DesktopCartPanel: true,
        },
      },
    });

    expect(
      wrapper.find('[data-testid="shop-menu-return-context"]').exists(),
    ).toBe(false);
  });
});
