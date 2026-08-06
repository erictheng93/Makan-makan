// @vitest-environment jsdom

import { mount, flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsView from "./SettingsView.vue";
import { api } from "@/services/api";
import { marketsService } from "@/services/marketsService";
import { useAuthStore } from "@/stores/auth";
import { useRoute } from "vue-router";

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("vue-toastification", () => ({
  useToast: () => ({
    success: toastSuccess,
    error: toastError,
  }),
}));

vi.mock("@/composables/useConfirmModal", () => ({
  useConfirmModal: () => ({
    confirm: vi.fn().mockResolvedValue(true),
  }),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: vi.fn(),
}));

vi.mock("vue-router", () => ({
  useRoute: vi.fn(),
}));

vi.mock("@/services/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  unwrapApiPayload: vi.fn((payload) => {
    if (payload && typeof payload === "object" && "data" in payload) {
      return (payload as { data: unknown }).data;
    }

    return payload;
  }),
  unwrapApiData: vi.fn((response: { data: unknown }) => {
    const payload = response.data;
    if (payload && typeof payload === "object" && "data" in payload) {
      return (payload as { data: unknown }).data;
    }

    return payload;
  }),
  unwrapApiList: vi.fn((payload) => {
    const data =
      payload && typeof payload === "object" && "data" in payload
        ? (payload as { data: unknown }).data
        : payload;
    return Array.isArray(data) ? data : [];
  }),
}));

vi.mock("@/services/marketsService", () => ({
  marketsService: {
    listMarkets: vi.fn(),
    listRestaurantMemberships: vi.fn(),
    listJoinRequests: vi.fn(),
    requestJoin: vi.fn(),
  },
}));

vi.mock("@/composables/useCurrency", () => ({
  setRestaurantCurrency: vi.fn(),
}));

const toPrintableDataUrl = vi.hoisted(() =>
  vi.fn(async () => "data:image/png;base64,c2hvcA=="),
);
const printQRCodeSheet = vi.hoisted(() => vi.fn(() => true));

vi.mock("@/utils/qrPrintSheet", () => ({
  toPrintableDataUrl,
  printQRCodeSheet,
}));

describe("SettingsView market join requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuthStore).mockReturnValue({
      restaurantId: "restaurant-1",
    } as unknown as ReturnType<typeof useAuthStore>);
    vi.mocked(useRoute).mockReturnValue({
      query: { tab: "markets" },
    } as unknown as ReturnType<typeof useRoute>);
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === "/restaurants/restaurant-1") {
        return { data: { data: { name: "雞排攤" } } };
      }
      if (url === "/restaurants/restaurant-1/contact-profile") {
        return { data: { data: { messagingChannels: {}, faqs: [] } } };
      }
      if (url === "/restaurants/restaurant-1/qr/shop") {
        return { data: { data: { enabled: false } } };
      }
      if (url === "/restaurants/restaurant-1/service-items") {
        return { data: { data: [] } };
      }
      if (url === "/service-bookings/slots") {
        return { data: { data: { slots: [] } } };
      }
      return { data: { data: {} } };
    });
    vi.mocked(marketsService.listMarkets).mockResolvedValue([
      {
        id: "market-1",
        slug: "fengjia",
        name: "逢甲夜市",
        type: "night_market",
        city: "台中市",
        district: "西屯區",
        vendorCount: 3,
        catalogCoverage: {
          searchableProductCount: 12,
          publicServiceCount: 4,
        },
        publicReadiness: {
          ready: true,
          score: 100,
          completedCount: 7,
          totalCount: 7,
          issues: [],
        },
      },
    ]);
    vi.mocked(marketsService.listRestaurantMemberships).mockResolvedValue([]);
    vi.mocked(marketsService.listJoinRequests)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 9,
          restaurantId: "restaurant-1",
          marketId: "market-1",
          status: "pending",
          message: "我們想加入夜市。",
          requestedAt: Date.now(),
          market: {
            id: "market-1",
            slug: "fengjia",
            name: "逢甲夜市",
            type: "night_market",
            city: "台中市",
            district: "西屯區",
          },
        },
      ]);
    vi.mocked(marketsService.requestJoin).mockResolvedValue({
      id: 9,
      restaurantId: "restaurant-1",
      marketId: "market-1",
      status: "pending",
      message: "我們想加入夜市。",
      requestedAt: Date.now(),
      market: {
        id: "market-1",
        slug: "fengjia",
        name: "逢甲夜市",
        type: "night_market",
        city: "台中市",
        district: "西屯區",
      },
    });
  });

  it("lets a restaurant owner submit a market join request from settings", async () => {
    const wrapper = mount(SettingsView, {
      global: {
        stubs: {
          IntegrationsSettings: true,
          RestaurantServiceItemsManager: true,
        },
      },
    });
    await flushPromises();

    await wrapper.get('[data-testid="market-join-search"]').setValue("逢甲");
    await wrapper
      .get('[data-testid="market-join-select"]')
      .setValue("market-1");
    await wrapper
      .get('[data-testid="market-join-message"]')
      .setValue("我們想加入夜市。");
    await wrapper.get('[data-testid="market-join-submit"]').trigger("click");
    await flushPromises();

    expect(marketsService.requestJoin).toHaveBeenCalledWith("restaurant-1", {
      marketId: "market-1",
      message: "我們想加入夜市。",
    });
    expect(toastSuccess).toHaveBeenCalledWith(
      "settings.markets.requestSuccess",
    );
    expect(marketsService.listJoinRequests).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("逢甲夜市");
    expect(wrapper.text()).toContain("settings.markets.requestStatus.pending");
  });
});

describe("SettingsView guest ordering availability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuthStore).mockReturnValue({
      restaurantId: "restaurant-1",
    } as unknown as ReturnType<typeof useAuthStore>);
    vi.mocked(useRoute).mockReturnValue({
      query: { tab: "orders" },
    } as unknown as ReturnType<typeof useRoute>);
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === "/restaurants/restaurant-1") {
        return {
          data: {
            data: {
              name: "雞排攤",
              isAvailable: false,
              settings: {
                allowGuestOrders: false,
                currency: "MYR",
                enableDineIn: true,
                enableTakeaway: true,
                enableDelivery: false,
              },
            },
          },
        };
      }
      if (url === "/restaurants/restaurant-1/contact-profile") {
        return { data: { data: { messagingChannels: {}, faqs: [] } } };
      }
      if (url === "/restaurants/restaurant-1/qr/shop") {
        return { data: { data: { enabled: false } } };
      }
      if (url === "/restaurants/restaurant-1/service-items") {
        return { data: { data: [] } };
      }
      if (url === "/service-bookings/slots") {
        return { data: { data: { slots: [] } } };
      }
      return { data: { data: {} } };
    });
    vi.mocked(marketsService.listMarkets).mockResolvedValue([]);
    vi.mocked(marketsService.listRestaurantMemberships).mockResolvedValue([]);
    vi.mocked(marketsService.listJoinRequests).mockResolvedValue([]);
  });

  it("saves the guest ordering switch to both restaurant availability gates", async () => {
    const wrapper = mount(SettingsView, {
      global: {
        stubs: {
          IntegrationsSettings: true,
          RestaurantServiceItemsManager: true,
        },
      },
    });
    await flushPromises();

    const guestOrderingCheckbox = wrapper
      .findAll('input[type="checkbox"]')
      .find((input) =>
        input.element.parentElement?.parentElement?.textContent?.includes(
          "settings.orders.acceptGuestOrders",
        ),
      );
    expect(guestOrderingCheckbox?.element.checked).toBe(false);

    await guestOrderingCheckbox?.setValue(true);
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "settings.saveSettings")
      ?.trigger("click");
    await flushPromises();

    expect(api.put).toHaveBeenCalledWith("/restaurants/restaurant-1", {
      isAvailable: true,
      supportsTakeaway: true,
      supportsDelivery: false,
      settings: {
        allowGuestOrders: true,
        currency: "MYR",
        enableDineIn: true,
        enableTakeaway: true,
        enableDelivery: false,
        deliveryFee: 0,
        estimatedPrepTimeMin: 15,
        estimatedPrepTimeMax: 20,
      },
    });
  });
});

describe("SettingsView shop QR management", () => {
  const shopQrCode = "SHOP-019fa136-cfe3-709f-a2ab-f8a3ebcd31a1-1785563580";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuthStore).mockReturnValue({
      restaurantId: "019fa136-cfe3-709f-a2ab-f8a3ebcd31a1",
    } as unknown as ReturnType<typeof useAuthStore>);
    vi.mocked(useRoute).mockReturnValue({
      query: { tab: "qrcode" },
    } as unknown as ReturnType<typeof useRoute>);
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === "/restaurants/019fa136-cfe3-709f-a2ab-f8a3ebcd31a1/qr/shop") {
        return {
          data: {
            data: {
              enabled: true,
              qrCode: shopQrCode,
              qrCodeImageUrl: null,
              version: 1,
            },
          },
        };
      }
      if (url === "/restaurants/019fa136-cfe3-709f-a2ab-f8a3ebcd31a1") {
        return { data: { data: { name: "雞排攤" } } };
      }
      if (
        url ===
        "/restaurants/019fa136-cfe3-709f-a2ab-f8a3ebcd31a1/contact-profile"
      ) {
        return { data: { data: { messagingChannels: {}, faqs: [] } } };
      }
      if (
        url ===
        "/restaurants/019fa136-cfe3-709f-a2ab-f8a3ebcd31a1/service-items"
      ) {
        return { data: { data: [] } };
      }
      if (url === "/service-bookings/slots") {
        return { data: { data: { slots: [] } } };
      }
      return { data: { data: {} } };
    });
    vi.mocked(marketsService.listMarkets).mockResolvedValue([]);
    vi.mocked(marketsService.listRestaurantMemberships).mockResolvedValue([]);
    vi.mocked(marketsService.listJoinRequests).mockResolvedValue([]);
  });

  it("renders, downloads, and prints a shop QR even when the API image URL is null", async () => {
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);
    const wrapper = mount(SettingsView, {
      global: {
        stubs: {
          IntegrationsSettings: true,
          RestaurantServiceItemsManager: true,
        },
      },
    });
    await flushPromises();

    expect(toPrintableDataUrl).toHaveBeenCalledWith(shopQrCode);
    const fallbackImage = wrapper.get(
      `img[src="data:image/png;base64,c2hvcA=="]`,
    );
    expect(fallbackImage.attributes("alt")).toBe("settings.qrcode.previewAlt");

    await wrapper.get('[data-testid="shop-qr-download"]').trigger("click");
    await flushPromises();

    expect(anchorClick).toHaveBeenCalledOnce();
    const anchor = anchorClick.mock.instances[0];
    expect(anchor.download).toBe(`shop-qr-${shopQrCode}.png`);
    expect(anchor.href).toBe("data:image/png;base64,c2hvcA==");

    await wrapper.get('[data-testid="shop-qr-print"]').trigger("click");
    await flushPromises();

    expect(printQRCodeSheet).toHaveBeenCalledWith(
      "settings.qrcode.printTitle",
      [
        {
          label: "settings.qrcode.printTitle",
          dataUrl: "data:image/png;base64,c2hvcA==",
        },
      ],
    );
  });

  it("does not show desktop notification controls on the QR Code tab", async () => {
    const wrapper = mount(SettingsView, {
      global: {
        stubs: {
          IntegrationsSettings: true,
          RestaurantServiceItemsManager: true,
        },
      },
    });
    await flushPromises();

    const desktopCheckbox = wrapper
      .findAll('input[type="checkbox"]')
      .find((input) =>
        input.element.parentElement?.parentElement?.textContent?.includes(
          "settings.notifications.enableDesktop",
        ),
      );

    expect(desktopCheckbox?.isVisible()).toBe(false);
  });

  it("blocks enabling shop mode until at least one fulfillment method is enabled", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === "/restaurants/019fa136-cfe3-709f-a2ab-f8a3ebcd31a1/qr/shop") {
        return { data: { data: { enabled: false } } };
      }
      if (url === "/restaurants/019fa136-cfe3-709f-a2ab-f8a3ebcd31a1") {
        return {
          data: {
            data: {
              name: "雞排攤",
              supportsTakeaway: false,
              settings: {
                enableDineIn: false,
                enableTakeaway: false,
                enableDelivery: false,
              },
            },
          },
        };
      }
      if (
        url ===
        "/restaurants/019fa136-cfe3-709f-a2ab-f8a3ebcd31a1/contact-profile"
      ) {
        return { data: { data: { messagingChannels: {}, faqs: [] } } };
      }
      if (
        url ===
        "/restaurants/019fa136-cfe3-709f-a2ab-f8a3ebcd31a1/service-items"
      ) {
        return { data: { data: [] } };
      }
      if (url === "/service-bookings/slots") {
        return { data: { data: { slots: [] } } };
      }
      return { data: { data: {} } };
    });
    const wrapper = mount(SettingsView, {
      global: {
        stubs: {
          IntegrationsSettings: true,
          RestaurantServiceItemsManager: true,
        },
      },
    });
    await flushPromises();

    const shopModeCheckbox = wrapper
      .findAll('input[type="checkbox"]')
      .find((input) =>
        input.element.parentElement?.parentElement?.textContent?.includes(
          "settings.qrcode.enableShopMode",
        ),
      );
    await shopModeCheckbox?.setValue(true);
    await flushPromises();

    expect(api.put).not.toHaveBeenCalledWith(
      "/restaurants/019fa136-cfe3-709f-a2ab-f8a3ebcd31a1/shop-mode",
      expect.anything(),
    );
    expect(toastError).toHaveBeenCalledWith(
      "settings.alerts.fulfillmentRequired",
    );
  });
});
