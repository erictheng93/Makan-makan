import { mount } from "@vue/test-utils";
import { computed, ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import ShopMenuView from "@/views/ShopMenuView.vue";
import { menuApi } from "@/services/menuApi";
import { restaurantContactApi } from "@/services/restaurantContactApi";

vi.mock("vue-router", () => ({
  useRoute: () => ({ path: "/restaurant/restaurant-1/shop/menu" }),
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
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
          menuItems: [],
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
});
