import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CartView from "@/views/CartView.vue";

const routeQuery = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}));
const createGuestOrder = vi.hoisted(() => vi.fn());
const initializeCart = vi.hoisted(() => vi.fn());

vi.mock("vue-router", () => ({
  useRoute: () => ({ query: routeQuery.current }),
  useRouter: () => ({
    back: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("vue-toastification", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}));

vi.mock("@/composables/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    tWithParams: (key: string) => key,
    currentLanguage: ref("zh-TW"),
  }),
}));

vi.mock("@/composables/useCurrency", () => ({
  useCurrency: () => ({ formatPrice: (value: number) => `$${value}` }),
}));

vi.mock("@/utils/localized-menu-content", () => ({
  getLocalizedMenuName: (item: { name?: string }) => item.name ?? "",
}));

vi.mock("@/stores/cart", () => ({
  useCartStore: () => ({
    isEmpty: false,
    items: [
      {
        id: "42",
        menuItem: { id: 42, name: "Beef Noodles" },
        quantity: 1,
        customizations: undefined,
        notes: "",
      },
    ],
    subtotal: 100,
    initializeCart,
    clearCart: vi.fn(),
    updateQuantity: vi.fn(),
    updateItemNotes: vi.fn(),
    removeItem: vi.fn(),
    getItemById: vi.fn(),
  }),
}));

vi.mock("@/services/orderApi", () => ({
  orderApi: {
    createOrder: vi.fn(),
    createGuestOrder: vi.fn(),
  },
}));

vi.mock("@/services/api", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("@/services/menuApi", () => ({
  default: {
    getRestaurant: vi.fn(),
  },
}));

vi.mock("@tanstack/vue-query", () => ({
  useQuery: () => ({
    data: ref({ name: "Demo Restaurant", settings: {} }),
  }),
  useMutation: (options: { mutationFn: (data: unknown) => unknown }) => ({
    mutate: (data: unknown) => {
      options.mutationFn(data);
      createGuestOrder(data);
    },
  }),
}));

vi.mock("@/components/CartItemCard.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("@/components/ConfirmationModal.vue", () => ({
  default: {
    emits: ["confirm", "cancel"],
    template: '<button data-testid="confirm" @click="$emit(\'confirm\')" />',
  },
}));
vi.mock("@/components/CouponRecommendation.vue", () => ({
  default: { template: "<div />" },
}));

describe("CartView seat orders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeQuery.current = { seatId: "6" };
    sessionStorage.clear();
  });

  it("initializes the cart for the seat and submits a seat guest order", async () => {
    const wrapper = mount(CartView, {
      props: {
        restaurantId: "restaurant-1",
        tableId: 4,
      },
      global: {
        stubs: {
          RouterLink: true,
        },
      },
    });

    await flushPromises();
    expect(initializeCart).toHaveBeenCalledWith("restaurant-1", 4, 6);
    expect(wrapper.text()).toContain("06 號座");

    await wrapper.find("button[data-testid='confirm']").trigger("click");

    expect(createGuestOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "restaurant-1",
        orderType: "seat",
        tableId: 4,
        seatId: 6,
      }),
    );
  });
});
