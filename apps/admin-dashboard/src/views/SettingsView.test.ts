// @vitest-environment jsdom

import { mount, flushPromises } from "@vue/test-utils";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsView from "./SettingsView.vue";
import { AxiosHeaders, type AxiosResponse } from "axios";
import type { ApiResponse } from "@/types";
import { api } from "@/services/api";
import { marketsService } from "@/services/marketsService";
import { useAuthStore } from "@/stores/auth";
import { useRoute } from "vue-router";

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: ref("zh-TW"),
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

// api.get resolves a full AxiosResponse whose body is the { success, data }
// envelope; the mock has to produce the same thing.
function apiGetResponse<T>(data: T): AxiosResponse<ApiResponse<T>> {
  return {
    data: { success: true, data },
    status: 200,
    statusText: "OK",
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  };
}

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
        return apiGetResponse({ name: "雞排攤" });
      }
      if (url === "/restaurants/restaurant-1/contact-profile") {
        return apiGetResponse({ messagingChannels: {}, faqs: [] });
      }
      if (url === "/restaurants/restaurant-1/qr/shop") {
        return apiGetResponse({ enabled: false });
      }
      if (url === "/restaurants/restaurant-1/service-items") {
        return apiGetResponse([]);
      }
      if (url === "/service-bookings/slots") {
        return apiGetResponse({ slots: [] });
      }
      return apiGetResponse({});
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
        return apiGetResponse({
          name: "雞排攤",
          isAvailable: false,
          settings: {
            allowGuestOrders: false,
            currency: "MYR",
            enableDineIn: true,
            enableTakeaway: true,
            enableDelivery: false,
          },
        });
      }
      if (url === "/restaurants/restaurant-1/contact-profile") {
        return apiGetResponse({ messagingChannels: {}, faqs: [] });
      }
      if (url === "/restaurants/restaurant-1/qr/shop") {
        return apiGetResponse({ enabled: false });
      }
      if (url === "/restaurants/restaurant-1/service-items") {
        return apiGetResponse([]);
      }
      if (url === "/service-bookings/slots") {
        return apiGetResponse({ slots: [] });
      }
      return apiGetResponse({});
    });
    vi.mocked(marketsService.listMarkets).mockResolvedValue([]);
    vi.mocked(marketsService.listRestaurantMemberships).mockResolvedValue([]);
    vi.mocked(marketsService.listJoinRequests).mockResolvedValue([]);
  });

  async function mountSettings() {
    const wrapper = mount(SettingsView, {
      global: {
        stubs: {
          IntegrationsSettings: true,
          RestaurantServiceItemsManager: true,
        },
      },
    });
    await flushPromises();
    return wrapper;
  }

  it("saves the guest ordering switch to both restaurant availability gates", async () => {
    const wrapper = await mountSettings();

    const guestOrderingCheckbox = wrapper
      .findAll<HTMLInputElement>('input[type="checkbox"]')
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

    expect(api.put).toHaveBeenCalledWith(
      "/restaurants/restaurant-1",
      expect.objectContaining({
        isAvailable: true,
        supportsTakeaway: true,
        supportsDelivery: false,
        settings: expect.objectContaining({
          allowGuestOrders: true,
          currency: "MYR",
          enableDineIn: true,
          enableTakeaway: true,
          enableDelivery: false,
          deliveryFee: 0,
          estimatedPrepTimeMin: 15,
          estimatedPrepTimeMax: 20,
        }),
      }),
    );
  });

  // Editing a field, saving, and reloading used to return the original value:
  // the payload carried three sources out of the reactive tree's thirty-odd
  // leaves and the rest were dropped between the form and the request, with a
  // success toast either way (#309).
  it("sends the fields the form edits, not just the three it used to", async () => {
    const wrapper = await mountSettings();

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "settings.saveSettings")
      ?.trigger("click");
    await flushPromises();

    const body = vi.mocked(api.put).mock.calls[0][1] as {
      name?: string;
      settings: Record<string, unknown>;
    };

    // Loaded from the API and echoed back rather than dropped.
    expect(body.name).toBe("雞排攤");

    // Declared by restaurantSettingsSchema and read by the server.
    expect(body.settings).toMatchObject({
      minOrderAmount: expect.any(Number),
      autoAcceptOrders: expect.any(Boolean),
      timezone: expect.any(String),
    });

    // Console-only preferences, grouped so the flat namespace stays "settings
    // the server acts on".
    expect(body.settings.adminConsole).toMatchObject({
      retentionDays: expect.any(Number),
      tables: expect.objectContaining({ prefix: expect.any(String) }),
      notifications: expect.objectContaining({
        sound: expect.objectContaining({ enabled: expect.any(Boolean) }),
      }),
      security: expect.objectContaining({
        password: expect.objectContaining({ minLength: expect.any(Number) }),
      }),
    });
  });

  // The order gate is `minOrderAmount > 0`, so zero and "off" are the same
  // state. Storing the toggle as well would let the two disagree with no way
  // to tell which one the gate follows.
  it("sends zero for the minimum spend when the toggle is off", async () => {
    const wrapper = await mountSettings();

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "settings.saveSettings")
      ?.trigger("click");
    await flushPromises();

    const body = vi.mocked(api.put).mock.calls[0][1] as {
      settings: { minOrderAmount: number };
    };
    expect(body.settings.minOrderAmount).toBe(0);
  });

  // OrderService computes tax as `subtotalCents * taxRate`, so the server
  // wants a fraction while the owner types a percentage. Both rates had no
  // field at all on this screen, so every order carried taxAmount 0 and
  // serviceCharge 0 whatever the shop actually charged (#313).
  it("converts the tax and service percentages to the fractions the server multiplies by", async () => {
    const wrapper = await mountSettings();

    // 0.7 is one of the 261 percentages in the 0.1-step range whose division
    // by 100 is inexact: 0.7 / 100 is 0.006999999999999999. A round number
    // like 5 divides cleanly and would pass with the rounding removed.
    await wrapper.get('[data-testid="settings-tax-rate"]').setValue(0.7);
    await wrapper
      .get('[data-testid="settings-service-charge-rate"]')
      .setValue(10);
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "settings.saveSettings")
      ?.trigger("click");
    await flushPromises();

    const body = vi.mocked(api.put).mock.calls[0][1] as {
      settings: { taxRate: number; serviceChargeRate: number };
    };
    expect(body.settings.taxRate).toBe(0.007);
    expect(body.settings.serviceChargeRate).toBe(0.1);
  });

  it("reads a stored fraction back as the percentage the owner entered", async () => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === "/restaurants/restaurant-1") {
        return apiGetResponse({
          name: "雞排攤",
          // 0.07 and 0.035 are picked because they are among the 93 rates in
          // the 0.1-step range whose value changes across an unrounded round
          // trip: 0.07 * 100 is 7.000000000000001. A tidier-looking fixture
          // like 0.0825 multiplies back exactly and would pass with the
          // rounding removed, proving nothing.
          settings: { taxRate: 0.07, serviceChargeRate: 0.035 },
        });
      }
      return apiGetResponse({});
    });
    const wrapper = await mountSettings();

    expect(
      (
        wrapper.get('[data-testid="settings-tax-rate"]')
          .element as HTMLInputElement
      ).value,
    ).toBe("7");
    expect(
      (
        wrapper.get('[data-testid="settings-service-charge-rate"]')
          .element as HTMLInputElement
      ).value,
    ).toBe("3.5");
  });

  // The picker offered nine options while every business-day bucket in the
  // platform is a hardcoded '+8 hours'. Choosing GMT+9 reported success and
  // changed nothing, which #309 made worse by finally persisting the value.
  it("shows the timezone as fixed rather than offering a choice nothing honours", async () => {
    const wrapper = await mountSettings();

    expect(wrapper.get('[data-testid="settings-timezone-fixed"]').text()).toBe(
      "GMT+8",
    );
    expect(
      wrapper
        .findAll("option")
        .some((o) => o.attributes("value") === "Asia/Tokyo"),
    ).toBe(false);
  });

  // businessHours is Record<day, ...> and the customer app renders it per day.
  // This screen shows one pair for the week, so sending it unconditionally
  // would flatten per-day hours the owner never looked at.
  it("leaves business hours alone when the hours fields were not touched", async () => {
    const wrapper = await mountSettings();

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "settings.saveSettings")
      ?.trigger("click");
    await flushPromises();

    const body = vi.mocked(api.put).mock.calls[0][1] as Record<string, unknown>;
    expect(body).not.toHaveProperty("businessHours");
  });
});

describe("SettingsView shop QR management", () => {
  const shopQrCode = "SHOP-019fa136-cfe3-709f-a2ab-f8a3ebcd31a1-1785563580";
  const shopQrUrl = `https://makanmasak.com/restaurant/019fa136-cfe3-709f-a2ab-f8a3ebcd31a1/shop/order-type?qr=${encodeURIComponent(shopQrCode)}`;
  let shopQrInfo: Record<string, unknown> = {};

  beforeEach(() => {
    shopQrInfo = {
      enabled: true,
      qrCode: shopQrCode,
      qrUrl: shopQrUrl,
      qrCodeImageUrl: null,
      version: 1,
    };
    vi.clearAllMocks();
    vi.mocked(useAuthStore).mockReturnValue({
      restaurantId: "019fa136-cfe3-709f-a2ab-f8a3ebcd31a1",
    } as unknown as ReturnType<typeof useAuthStore>);
    vi.mocked(useRoute).mockReturnValue({
      query: { tab: "qrcode" },
    } as unknown as ReturnType<typeof useRoute>);
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === "/restaurants/019fa136-cfe3-709f-a2ab-f8a3ebcd31a1/qr/shop") {
        return apiGetResponse(shopQrInfo);
      }
      if (url === "/restaurants/019fa136-cfe3-709f-a2ab-f8a3ebcd31a1") {
        return apiGetResponse({ name: "雞排攤" });
      }
      if (
        url ===
        "/restaurants/019fa136-cfe3-709f-a2ab-f8a3ebcd31a1/contact-profile"
      ) {
        return apiGetResponse({ messagingChannels: {}, faqs: [] });
      }
      if (
        url ===
        "/restaurants/019fa136-cfe3-709f-a2ab-f8a3ebcd31a1/service-items"
      ) {
        return apiGetResponse([]);
      }
      if (url === "/service-bookings/slots") {
        return apiGetResponse({ slots: [] });
      }
      return apiGetResponse({});
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

    // The bitmap must encode the openable link, not the internal lookup key —
    // a phone camera does nothing useful with a bare "SHOP-…" string.
    expect(toPrintableDataUrl).toHaveBeenCalledWith(shopQrUrl);
    const fallbackImage = wrapper.get(
      `img[src="data:image/png;base64,c2hvcA=="]`,
    );
    expect(fallbackImage.attributes("alt")).toBe("settings.qrcode.previewAlt");

    await wrapper.get('[data-testid="shop-qr-download"]').trigger("click");
    await flushPromises();

    expect(anchorClick).toHaveBeenCalledOnce();
    // mock.instances is typed from the spied signature (`click(): void`), so it
    // carries no element type of its own.
    const anchor = anchorClick.mock.instances[0] as HTMLAnchorElement;
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

  it("falls back to the raw code when the API predates qrUrl", async () => {
    // A dashboard deployed ahead of the API must still print something
    // scannable-by-the-app rather than a blank sticker.
    delete shopQrInfo.qrUrl;

    mount(SettingsView, {
      global: {
        stubs: {
          IntegrationsSettings: true,
          RestaurantServiceItemsManager: true,
        },
      },
    });
    await flushPromises();

    expect(toPrintableDataUrl).toHaveBeenCalledWith(shopQrCode);
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
      .findAll<HTMLInputElement>('input[type="checkbox"]')
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
        return apiGetResponse({ enabled: false });
      }
      if (url === "/restaurants/019fa136-cfe3-709f-a2ab-f8a3ebcd31a1") {
        return apiGetResponse({
          name: "雞排攤",
          supportsTakeaway: false,
          settings: {
            enableDineIn: false,
            enableTakeaway: false,
            enableDelivery: false,
          },
        });
      }
      if (
        url ===
        "/restaurants/019fa136-cfe3-709f-a2ab-f8a3ebcd31a1/contact-profile"
      ) {
        return apiGetResponse({ messagingChannels: {}, faqs: [] });
      }
      if (
        url ===
        "/restaurants/019fa136-cfe3-709f-a2ab-f8a3ebcd31a1/service-items"
      ) {
        return apiGetResponse([]);
      }
      if (url === "/service-bookings/slots") {
        return apiGetResponse({ slots: [] });
      }
      return apiGetResponse({});
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
      .findAll<HTMLInputElement>('input[type="checkbox"]')
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
