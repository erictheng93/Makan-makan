import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ShopCartModal from "@/components/ShopCartModal.vue";

const post = vi.hoisted(() => vi.fn());
const hasCustomerAccessToken = vi.hoisted(() => vi.fn());
const clearCart = vi.hoisted(() => vi.fn());
const routerPush = vi.hoisted(() => vi.fn());

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: routerPush }),
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

vi.mock("@/services/api", () => ({
  apiClient: { get: vi.fn(), post },
}));

vi.mock("@/services/customerAccessToken", () => ({
  hasCustomerAccessToken,
}));

vi.mock("@/stores/shopCart", () => ({
  useShopCartStore: () => ({
    isEmpty: false,
    items: [
      {
        id: "42",
        menuItem: { id: 42, name: "鹽酥雞" },
        quantity: 1,
        customizations: undefined,
        notes: "",
        price: 120,
        totalPrice: 120,
      },
    ],
    subtotal: 120,
    totalWithDelivery: 120,
    fulfillmentType: "takeaway",
    deliveryFee: 0,
    clearCart,
    updateQuantity: vi.fn(),
    removeItem: vi.fn(),
    setDeliveryInfo: vi.fn(),
  }),
}));

const SHOP_QR_CODE = "SHOP-restaurant-1-1785563580";

function mountModal(props: Record<string, unknown> = {}) {
  return mount(ShopCartModal, {
    props: {
      show: true,
      restaurantId: "restaurant-1",
      phoneLastDigits: "678",
      ...props,
    },
    global: { stubs: { Teleport: true, Transition: false } },
  });
}

async function checkout(props: Record<string, unknown> = {}) {
  const wrapper = mountModal(props);
  await wrapper.get('[data-testid="submit-order-btn"]').trigger("click");
  await flushPromises();
  return wrapper;
}

describe("ShopCartModal checkout payload", () => {
  beforeEach(() => {
    post.mockReset();
    post.mockResolvedValue({ order: { id: 501 }, guestToken: "gt_test" });
    hasCustomerAccessToken.mockReset();
    hasCustomerAccessToken.mockReturnValue(false);
    clearCart.mockReset();
    routerPush.mockReset();
  });

  it("sends the scanned code so the server can retire an old sticker", async () => {
    await checkout({ shopQrCode: SHOP_QR_CODE });

    expect(post).toHaveBeenCalledWith(
      "/guest-orders",
      expect.objectContaining({ shopQrCode: SHOP_QR_CODE }),
    );
  });

  it("omits the field entirely when the session did not start from a scan", async () => {
    // The server reads "absent" as nothing to check. Sending an empty string
    // instead would look like a scan of a code that matches nothing.
    await checkout();

    const [, payload] = post.mock.calls[0];
    expect(payload).not.toHaveProperty("shopQrCode");
  });

  it("sends it on the authenticated endpoint too", async () => {
    hasCustomerAccessToken.mockReturnValue(true);
    post.mockResolvedValue({ id: 501 });

    await checkout({ shopQrCode: SHOP_QR_CODE });

    expect(post).toHaveBeenCalledWith(
      "/orders",
      expect.objectContaining({ shopQrCode: SHOP_QR_CODE }),
    );
  });
});
