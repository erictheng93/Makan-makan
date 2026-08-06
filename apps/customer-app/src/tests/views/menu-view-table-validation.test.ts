import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MenuView from "@/views/MenuView.vue";

const routerReplace = vi.hoisted(() => vi.fn());
const initializeCart = vi.hoisted(() => vi.fn());
const routeQuery = vi.hoisted(() => ({}));

vi.mock("vue-router", () => ({
  useRoute: () => ({
    query: routeQuery,
  }),
  useRouter: () => ({
    push: vi.fn(),
    replace: routerReplace,
  }),
}));

vi.mock("vue-toastification", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/composables/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    tWithParams: (key: string) => key,
    currentLanguage: ref("zh-TW"),
  }),
}));

vi.mock("@/composables/useBreakpoint", () => ({
  useIsDesktop: () => ref(false),
}));

vi.mock("@/composables/useCurrency", () => ({
  useCurrency: () => ({ formatPrice: (value: number) => `$${value}` }),
}));

vi.mock("@/stores/app", () => ({
  useAppStore: () => ({ setRestaurantContext: vi.fn() }),
}));

vi.mock("@/stores/cart", () => ({
  useCartStore: () => ({
    itemCount: 0,
    items: [],
    subtotal: 0,
    initializeCart,
    addItem: vi.fn(),
    removeItem: vi.fn(),
    updateQuantity: vi.fn(),
  }),
}));

vi.mock("@/utils/localized-menu-content", () => ({
  getLocalizedMenuName: (item: { name?: string }) => item.name ?? "",
  menuItemMatchesQuery: () => true,
}));

vi.mock("@/services/menuApi", () => ({
  menuApi: {
    validateTable: vi.fn(),
    getRestaurant: vi.fn(),
    getMenu: vi.fn(),
  },
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
vi.mock("@/components/DesktopCartPanel.vue", () => ({
  default: { template: "<div />" },
}));

vi.mock("@tanstack/vue-query", () => ({
  useQuery: (options: { queryKey: unknown[] }) => {
    if (options.queryKey[0] === "table-validation") {
      return {
        data: ref({ isValid: false }),
        isLoading: ref(false),
        error: ref(null),
        refetch: vi.fn(),
      };
    }

    return {
      data: ref(null),
      isLoading: ref(false),
      error: ref(null),
      refetch: vi.fn(),
    };
  },
}));

describe("MenuView table validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects invalid table deep links to the error page", async () => {
    mount(MenuView, {
      props: {
        restaurantId: "restaurant-1",
        tableId: 9999,
      },
    });
    await flushPromises();

    expect(initializeCart).not.toHaveBeenCalled();
    expect(routerReplace).toHaveBeenCalledWith({
      name: "Error",
      query: {
        code: "INVALID_TABLE",
        message: "此桌號無效或已停用，請重新掃描 QR Code。",
      },
    });
  });
});
