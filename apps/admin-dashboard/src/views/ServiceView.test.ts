// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ServiceView from "./ServiceView.vue";
import { api } from "@/services/api";

vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key, locale: ref("zh-TW") }),
}));

vi.mock("@/composables/useDateFormatter", () => ({
  useDateFormatter: () => ({
    formatTime: () => "12:00",
    formatTimeWithSeconds: () => "12:00:00",
  }),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    restaurantId: "restaurant-1",
    user: { id: 3, username: "service-crew" },
  }),
}));

vi.mock("@/services/api", () => ({
  api: { get: vi.fn(), put: vi.fn() },
  unwrapApiData: (response: { data: { data: unknown } }) => response.data.data,
}));

const readyOrder = {
  id: "order-1",
  orderNumber: "ORD-1",
  orderType: "table",
  status: "ready",
  table: { number: "A1" },
  readyAt: Date.parse("2026-08-21T12:00:00.000Z"),
  updatedAt: Date.parse("2026-08-21T12:00:00.000Z"),
  customerInfo: { name: "Ada", phone: "0912345678" },
  items: [],
};

describe("ServiceView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // api.get takes `paramsOrConfig?: unknown`; optional-chaining it narrows to
    // `{}`, which has no `status`. Cast to the shape ServiceView actually sends.
    vi.mocked(api.get).mockImplementation(
      async (_url: string, paramsOrConfig?: unknown) => {
        const options = paramsOrConfig as { status?: string } | undefined;
        const orders = options?.status === "ready" ? [readyOrder] : [];
        return { data: { data: orders } } as never;
      },
    );
    vi.mocked(api.put).mockResolvedValue({ data: { data: {} } } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses only server-supported statuses for service delivery", async () => {
    const wrapper = mount(ServiceView);
    await flushPromises();

    expect(api.get).toHaveBeenCalledWith("/orders", {
      status: "ready",
      restaurantId: "restaurant-1",
    });

    const startButton = wrapper
      .findAll("button")
      .find((button) => button.text() === "serviceView.startDelivery");
    expect(startButton).toBeDefined();
    await startButton!.trigger("click");

    expect(api.put).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("serviceView.confirmDelivery");

    const confirmButton = wrapper
      .findAll("button")
      .find((button) => button.text() === "serviceView.confirmDelivery");
    expect(confirmButton).toBeDefined();
    await confirmButton!.trigger("click");

    expect(api.put).toHaveBeenCalledWith("/orders/order-1/status", {
      status: "delivered",
      notes: "Delivered by service crew",
    });

    wrapper.unmount();
  });
});
