// @vitest-environment jsdom

/**
 * The API can switch market checkouts off (see apps/api/src/shared/
 * feature-adoption.ts, served from GET /info). When it does, the customer app
 * must present the checkout controls as unavailable instead of offering a flow
 * whose requests the API refuses -- and must leave everything else alone, since
 * browsing a market never touches /market-checkouts.
 */

import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MarketsView from "@/views/MarketsView.vue";
import MarketDetailView from "@/views/MarketDetailView.vue";
import MarketCheckoutTrackingView from "@/views/MarketCheckoutTrackingView.vue";
import { useMarketCartStore } from "@/stores/marketCart";
import { useMarketsStore } from "@/stores/markets";
import type { StoredMarketCheckout } from "@/utils/marketCheckouts";

const disabledFeatures = vi.hoisted(() => ({ value: new Set<string>() }));
const routerPush = vi.hoisted(() => vi.fn());
const routerReplace = vi.hoisted(() => vi.fn());
const routerBack = vi.hoisted(() => vi.fn());
const createMarketCheckout = vi.hoisted(() => vi.fn());
const getMarketCheckout = vi.hoisted(() => vi.fn());
const payMarketCheckout = vi.hoisted(() => vi.fn());
const applyMarketCheckoutVoucher = vi.hoisted(() => vi.fn());
const removeMarketCheckoutVoucher = vi.hoisted(() => vi.fn());
const recoverMarketCheckoutGuestToken = vi.hoisted(() => vi.fn());
const listRecentMarketCheckouts = vi.hoisted(() => vi.fn((): unknown[] => []));

vi.mock("@/composables/useFeatureAvailability", () => ({
  useFeatureAvailability: () => ({
    isDisabled: (feature: string) => disabledFeatures.value.has(feature),
  }),
}));

// MarketDetailView reads the locale to localize the cart summary's item names
// (#112). Mounted without an i18n plugin, the real composable throws "Need to
// install with `app.use` function".
vi.mock("@/composables/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    tWithParams: (key: string, params: Record<string, unknown>) =>
      `${key}:${Object.values(params).join(",")}`,
    currentLanguage: ref("zh-TW"),
    hasTranslation: () => true,
  }),
}));

vi.mock("vue-router", () => ({
  useRoute: () => ({
    params: { slug: "fengjia" },
    fullPath: "/markets/fengjia",
    query: {},
  }),
  useRouter: () => ({
    push: routerPush,
    replace: routerReplace,
    back: routerBack,
  }),
}));

vi.mock("@/stores/markets", () => ({
  useMarketsStore: vi.fn(),
}));

vi.mock("vue-toastification", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/services/orderApi", () => ({
  orderApi: {
    createMarketCheckout,
    getMarketCheckout,
    payMarketCheckout,
    applyMarketCheckoutVoucher,
    removeMarketCheckoutVoucher,
    recoverMarketCheckoutGuestToken,
  },
}));

vi.mock("@/services/marketsApi", () => ({
  marketsApi: { listAreas: vi.fn().mockResolvedValue({ areas: [] }) },
}));

vi.mock("@/services/discoveryApi", () => ({
  discoveryApi: { getTakeawayEligibility: vi.fn() },
}));

vi.mock("@/services/restaurantContactApi", () => ({
  restaurantContactApi: { getContactProfile: vi.fn() },
}));

vi.mock("@/utils/seoMeta", () => ({ applyMarketSeoMeta: vi.fn() }));

vi.mock("@/utils/marketEngagement", () => ({
  hydrateFavoriteMarketsFromIdentity: vi.fn().mockResolvedValue(undefined),
  hydrateRecentMarketsFromIdentity: vi.fn().mockResolvedValue(undefined),
  listFavoriteMarkets: vi.fn(() => []),
  listRecentMarkets: vi.fn(() => []),
  isFavoriteMarket: vi.fn(() => false),
  recordRecentMarket: vi.fn(),
  syncRecentMarketVisit: vi.fn().mockResolvedValue(undefined),
  syncFavoriteMarketPreference: vi.fn().mockResolvedValue(undefined),
  toggleFavoriteMarket: vi.fn(() => true),
}));

vi.mock("@/utils/marketCheckouts", () => ({
  listRecentMarketCheckouts,
  recordRecentMarketCheckout: vi.fn(),
  activateMarketCheckoutGuestToken: vi.fn(() => true),
  getRecentMarketCheckoutPhoneLastDigits: vi.fn(() => "789"),
}));

vi.mock("@/composables/useCurrency", () => ({
  useCurrency: () => ({ formatPrice: (amount: number) => `NT$${amount}` }),
}));

function marketsStore() {
  return {
    markets: [],
    nearbyMarkets: [],
    vendors: [],
    vendorCount: 0,
    explorationSummary: null,
    selectedMarket: { id: "market-1", slug: "fengjia", name: "逢甲夜市" },
    loading: false,
    vendorsLoading: false,
    hasMarkets: false,
    hasMoreMarkets: false,
    hasMoreVendors: false,
    error: null,
    loadMarkets: vi.fn(),
    loadMoreMarkets: vi.fn(),
    loadNearby: vi.fn(),
    loadMarketDetail: vi.fn().mockResolvedValue(undefined),
    loadVendors: vi.fn().mockResolvedValue(undefined),
    loadMoreVendors: vi.fn().mockResolvedValue(undefined),
    resetSelectedMarket: vi.fn(),
  };
}

function stallItem(id: number, restaurantId: string, name: string) {
  return {
    id,
    restaurantId,
    categoryId: 10,
    catalogType: "menu_item" as const,
    name,
    price: 80,
    spiceLevel: 0,
    sortOrder: 1,
    isAvailable: true,
    isFeatured: false,
    inventoryCount: null,
    orderCount: 0,
    createdAt: 1786_000_000_000,
    updatedAt: 1786_000_000_000,
  };
}

/** Two vendors, because a market checkout needs at least two stalls. */
function seedTwoVendorCart() {
  const cartStore = useMarketCartStore();
  cartStore.addItem({
    marketSlug: "fengjia",
    marketName: "逢甲夜市",
    restaurantId: "restaurant-1",
    restaurantName: "雞排攤",
    item: stallItem(42, "restaurant-1", "章魚燒"),
    quantity: 2,
  });
  cartStore.addItem({
    marketSlug: "fengjia",
    marketName: "逢甲夜市",
    restaurantId: "restaurant-2",
    restaurantName: "甜點攤",
    item: stallItem(43, "restaurant-2", "豆花"),
    quantity: 1,
  });
}

function checkoutSummary() {
  return {
    id: "checkout-1",
    market: { id: "market-1", slug: "fengjia", name: "逢甲夜市" },
    status: "submitted",
    childOrders: [
      {
        restaurantId: "restaurant-1",
        restaurantName: "雞排攤",
        orderId: 101,
        orderNumber: "A001",
        totalAmount: 160,
        tokenExpiresAt: "2026-06-01T12:00:00.000Z",
        status: "preparing",
        paymentStatus: "pending",
        updatedAt: 1780308300000,
      },
    ],
    subtotal: 160,
    createdAt: "2026-06-01T10:00:00.000Z",
  };
}

async function mountTrackingView() {
  getMarketCheckout.mockResolvedValueOnce(checkoutSummary());
  const wrapper = mount(MarketCheckoutTrackingView, {
    props: { slug: "fengjia", checkoutId: "checkout-1" },
  });
  await flushPromises();
  return wrapper;
}

describe("market checkout availability", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.mocked(useMarketsStore).mockReturnValue(
      marketsStore() as unknown as ReturnType<typeof useMarketsStore>,
    );
    disabledFeatures.value = new Set();
    routerPush.mockReset();
    createMarketCheckout.mockReset();
    getMarketCheckout.mockReset();
    payMarketCheckout.mockReset();
    applyMarketCheckoutVoucher.mockReset();
    removeMarketCheckoutVoucher.mockReset();
    listRecentMarketCheckouts.mockReturnValue([
      {
        id: "checkout-1",
        marketSlug: "fengjia",
        marketName: "逢甲夜市",
        childOrderCount: 2,
        paymentStatus: "partial_paid",
      } satisfies Partial<StoredMarketCheckout>,
    ]);
  });

  describe("MarketsView recent checkout entry", () => {
    async function mountMarketsView() {
      const wrapper = mount(MarketsView, { shallow: true });
      await flushPromises();
      return wrapper;
    }

    it("renders the recent checkout entry as inert when the API has it off", async () => {
      disabledFeatures.value = new Set(["marketCheckouts"]);

      const wrapper = await mountMarketsView();
      const entry = wrapper.get('[data-testid="recent-market-checkout"]');

      expect(entry.attributes("data-disabled")).toBe("true");
      expect(entry.attributes("aria-disabled")).toBe("true");
      expect(entry.attributes("disabled")).toBeDefined();
      expect(entry.text()).toContain("markets.common.checkoutUnavailable");

      await entry.trigger("click");
      expect(routerPush).not.toHaveBeenCalled();
    });

    it("opens the tracking screen normally when the API has it on", async () => {
      const wrapper = await mountMarketsView();
      const entry = wrapper.get('[data-testid="recent-market-checkout"]');

      expect(entry.attributes("data-disabled")).toBeUndefined();
      expect(entry.attributes("aria-disabled")).toBeUndefined();
      expect(entry.attributes("disabled")).toBeUndefined();
      expect(entry.text()).not.toContain("markets.common.checkoutUnavailable");

      await entry.trigger("click");
      expect(routerPush).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "MarketCheckoutTracking",
          params: expect.objectContaining({ checkoutId: "checkout-1" }),
        }),
      );
    });

    it("leaves market browsing untouched when checkouts are off", async () => {
      disabledFeatures.value = new Set(["marketCheckouts"]);

      const wrapper = await mountMarketsView();

      expect(wrapper.find('[data-testid="markets-search-form"]').exists()).toBe(
        true,
      );
      expect(
        wrapper
          .get('[data-testid="markets-search-input"]')
          .attributes("disabled"),
      ).toBeUndefined();
      expect(
        wrapper
          .get('[data-testid="markets-city-select"]')
          .attributes("disabled"),
      ).toBeUndefined();
      expect(
        wrapper
          .get('[data-testid="markets-type-select"]')
          .attributes("disabled"),
      ).toBeUndefined();
    });
  });

  describe("MarketDetailView checkout submit", () => {
    async function mountDetailView() {
      seedTwoVendorCart();
      const wrapper = mount(MarketDetailView, { shallow: true });
      await flushPromises();
      return wrapper;
    }

    it("renders the submit control as inert when the API has it off", async () => {
      disabledFeatures.value = new Set(["marketCheckouts"]);

      const wrapper = await mountDetailView();
      const submit = wrapper.get('[data-testid="market-checkout-submit"]');

      expect(submit.attributes("data-disabled")).toBe("true");
      expect(submit.attributes("aria-disabled")).toBe("true");
      expect(submit.attributes("disabled")).toBeDefined();
      expect(submit.text()).toContain("markets.common.checkoutUnavailable");
      expect(
        wrapper.get('[data-testid="market-checkout-unavailable-hint"]').text(),
      ).toContain("markets.detail.checkoutDisabledHint");

      await submit.trigger("click");
      await flushPromises();
      expect(createMarketCheckout).not.toHaveBeenCalled();
    });

    it("submits normally when the API has it on", async () => {
      createMarketCheckout.mockResolvedValueOnce({
        checkout: { id: "checkout-1", childOrders: [] },
        childOrders: [],
      });

      const wrapper = await mountDetailView();
      const submit = wrapper.get('[data-testid="market-checkout-submit"]');

      expect(submit.attributes("data-disabled")).toBeUndefined();
      expect(submit.attributes("aria-disabled")).toBeUndefined();
      expect(submit.attributes("disabled")).toBeUndefined();
      expect(
        wrapper
          .find('[data-testid="market-checkout-unavailable-hint"]')
          .exists(),
      ).toBe(false);

      await wrapper
        .get('[data-testid="market-checkout-phone"]')
        .setValue("789");
      await submit.trigger("click");
      await flushPromises();

      expect(createMarketCheckout).toHaveBeenCalledOnce();
      expect(createMarketCheckout).toHaveBeenCalledWith(
        expect.objectContaining({ marketSlug: "fengjia" }),
      );
    });

    it("leaves the rest of the market screen untouched when checkouts are off", async () => {
      disabledFeatures.value = new Set(["marketCheckouts"]);

      const wrapper = await mountDetailView();

      expect(
        wrapper
          .get('[data-testid="market-favorite-toggle"]')
          .attributes("disabled"),
      ).toBeUndefined();
      expect(
        wrapper
          .get('[data-testid="market-detail-back"]')
          .attributes("disabled"),
      ).toBeUndefined();
      expect(wrapper.find('[data-testid="market-cart-summary"]').exists()).toBe(
        true,
      );
    });
  });

  describe("MarketCheckoutTrackingView payment and voucher", () => {
    it("renders pay and voucher controls as inert when the API has it off", async () => {
      disabledFeatures.value = new Set(["marketCheckouts"]);

      const wrapper = await mountTrackingView();
      const pay = wrapper.get('[data-testid="market-checkout-pay"]');
      const applyVoucher = wrapper.get(
        '[data-testid="market-checkout-voucher-apply"]',
      );

      expect(pay.attributes("data-disabled")).toBe("true");
      expect(pay.attributes("aria-disabled")).toBe("true");
      expect(pay.attributes("disabled")).toBeDefined();
      expect(pay.text()).toContain("markets.common.checkoutUnavailable");
      expect(
        wrapper.get('[data-testid="market-checkout-unavailable-hint"]').text(),
      ).toContain("markets.checkout.unavailableHint");

      expect(applyVoucher.attributes("data-disabled")).toBe("true");
      expect(applyVoucher.attributes("aria-disabled")).toBe("true");
      expect(applyVoucher.attributes("disabled")).toBeDefined();

      await pay.trigger("click");
      await wrapper
        .get('[data-testid="market-checkout-voucher-code"]')
        .setValue("VOUCHER1");
      await applyVoucher.trigger("submit");
      await flushPromises();

      expect(payMarketCheckout).not.toHaveBeenCalled();
      expect(applyMarketCheckoutVoucher).not.toHaveBeenCalled();
    });

    it("pays normally when the API has it on", async () => {
      payMarketCheckout.mockResolvedValueOnce({
        checkout: checkoutSummary(),
        payment: {},
      });

      const wrapper = await mountTrackingView();
      const pay = wrapper.get('[data-testid="market-checkout-pay"]');

      expect(pay.attributes("data-disabled")).toBeUndefined();
      expect(pay.attributes("aria-disabled")).toBeUndefined();
      expect(pay.attributes("disabled")).toBeUndefined();
      expect(pay.text()).toContain("markets.checkout.payCombined");
      expect(
        wrapper
          .find('[data-testid="market-checkout-unavailable-hint"]')
          .exists(),
      ).toBe(false);

      await pay.trigger("click");
      await flushPromises();

      expect(payMarketCheckout).toHaveBeenCalledOnce();
      expect(payMarketCheckout).toHaveBeenCalledWith(
        "checkout-1",
        expect.objectContaining({ method: "market_online" }),
      );
    });

    it("leaves the read-only summary and exits untouched when checkouts are off", async () => {
      disabledFeatures.value = new Set(["marketCheckouts"]);

      const wrapper = await mountTrackingView();

      expect(
        wrapper.find('[data-testid="market-checkout-summary"]').exists(),
      ).toBe(true);
      expect(
        wrapper
          .get('[data-testid="market-checkout-return"]')
          .attributes("disabled"),
      ).toBeUndefined();
      expect(
        wrapper
          .get('[data-testid="market-checkout-child-track"]')
          .attributes("disabled"),
      ).toBeUndefined();
      expect(
        wrapper.findAll('[data-testid="market-checkout-child-order"]'),
      ).toHaveLength(1);
    });
  });
});
