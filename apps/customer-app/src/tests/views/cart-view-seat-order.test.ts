import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CartView from "@/views/CartView.vue";

const routeQuery = vi.hoisted(() => ({
  current: {} as Record<string, unknown>,
}));
const createOrder = vi.hoisted(() => vi.fn());
const createGuestOrder = vi.hoisted(() => vi.fn());
const initializeCart = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock("vue-router", () => ({
  useRoute: () => ({ query: routeQuery.current }),
  useRouter: () => ({
    back: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock("vue-toastification", () => ({
  useToast: () => ({ success: vi.fn(), error: toastError, warning: vi.fn() }),
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
    createOrder,
    createGuestOrder,
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
  useMutation: (options: {
    mutationFn: (data: unknown) => unknown;
    onError?: (error: unknown) => void;
  }) => ({
    mutate: async (data: unknown) => {
      try {
        await options.mutationFn(data);
      } catch (error) {
        options.onError?.(error);
      }
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
    // Row id and printed number deliberately differ: seat "02" on this table
    // is row 6. The header must show "02".
    routeQuery.current = { seatId: "6", seatNumber: "02" };
    sessionStorage.clear();
    createOrder.mockResolvedValue({ id: 123 });
    createGuestOrder.mockResolvedValue({ order: { id: 123 } });
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
    expect(wrapper.text()).toContain("menu.seatContext");

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

  it("omits the seat label when only the row id is known", async () => {
    // Older links carry just seatId. Showing String(seatId).padStart(2,"0")
    // told a diner at sticker "02" they were at "06", so the label is dropped
    // rather than invented — the order still carries the id.
    routeQuery.current = { seatId: "6" };

    const wrapper = mount(CartView, {
      props: { restaurantId: "restaurant-1", tableId: 4 },
      global: { stubs: { RouterLink: true } },
    });

    await flushPromises();
    expect(initializeCart).toHaveBeenCalledWith("restaurant-1", 4, 6);
    expect(wrapper.text()).not.toContain("menu.seatContext");
    expect(wrapper.text()).not.toContain("06");

    await wrapper.find("button[data-testid='confirm']").trigger("click");
    expect(createGuestOrder).toHaveBeenCalledWith(
      expect.objectContaining({ orderType: "seat", tableId: 4, seatId: 6 }),
    );
  });

  it("shows the generic submit failure toast for network errors", async () => {
    createGuestOrder.mockRejectedValue(
      Object.assign(new Error("Network Error"), {
        code: "NETWORK_ERROR",
      }),
    );

    const wrapper = mount(CartView, {
      props: { restaurantId: "restaurant-1", tableId: 4 },
      global: { stubs: { RouterLink: true } },
    });

    await flushPromises();
    await wrapper.find("button[data-testid='confirm']").trigger("click");
    await flushPromises();

    expect(toastError).toHaveBeenCalledWith("toast.orderSubmitFailed");
  });

  it("uses localized copy for API business errors", async () => {
    createGuestOrder.mockRejectedValue(
      Object.assign(
        new Error(
          "You already have an active order at this restaurant. Please wait for it to complete.",
        ),
        {
          code: "ACTIVE_GUEST_ORDER_EXISTS",
          status: 429,
        },
      ),
    );

    const wrapper = mount(CartView, {
      props: { restaurantId: "restaurant-1", tableId: 4 },
      global: { stubs: { RouterLink: true } },
    });

    await flushPromises();
    await wrapper.find("button[data-testid='confirm']").trigger("click");
    await flushPromises();

    expect(toastError).toHaveBeenCalledWith(
      "toast.orderSubmitActiveGuestOrder",
    );
  });

  it("falls back to generic localized copy for unmapped API errors", async () => {
    createGuestOrder.mockRejectedValue(
      Object.assign(new Error("Unexpected backend implementation detail"), {
        code: "UNMAPPED_BACKEND_ERROR",
        status: 429,
      }),
    );

    const wrapper = mount(CartView, {
      props: { restaurantId: "restaurant-1", tableId: 4 },
      global: { stubs: { RouterLink: true } },
    });

    await flushPromises();
    await wrapper.find("button[data-testid='confirm']").trigger("click");
    await flushPromises();

    expect(toastError).toHaveBeenCalledWith("toast.orderSubmitFailed");
  });
});
