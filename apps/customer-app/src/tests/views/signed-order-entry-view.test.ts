import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SignedOrderEntryView from "@/views/SignedOrderEntryView.vue";
import { signedQrApi } from "@/services/signedQrApi";

const routerReplace = vi.hoisted(() => vi.fn());
const route = vi.hoisted(() => ({
  fullPath:
    "/order?t=seat&r=restaurant-1&d=10&n=VIP-1&v=4&f=2&sig=0123456789abcdef",
}));

vi.mock("vue-router", () => ({
  useRoute: () => route,
  useRouter: () => ({ replace: routerReplace }),
}));

vi.mock("@/composables/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/services/signedQrApi", () => ({
  signedQrApi: {
    verify: vi.fn(),
  },
}));

describe("SignedOrderEntryView", () => {
  beforeEach(() => {
    routerReplace.mockReset();
    vi.clearAllMocks();
  });

  it("verifies the signed QR and redirects a seat to its table menu", async () => {
    vi.mocked(signedQrApi.verify).mockResolvedValue({
      valid: true,
      type: "seat",
      restaurantId: "restaurant-1",
      tableId: 10,
      tableNumber: "A1",
      seatId: 21,
      seatNumber: "VIP-1",
      formatVersion: 2,
    });

    mount(SignedOrderEntryView);
    await flushPromises();

    expect(signedQrApi.verify).toHaveBeenCalledWith(
      "seat",
      `${window.location.origin}${route.fullPath}`,
    );
    expect(localStorage.getItem("makanmakan_table_qr:restaurant-1:10")).toBe(
      `${window.location.origin}${route.fullPath}`,
    );
    expect(routerReplace).toHaveBeenCalledWith({
      name: "RestaurantMenu",
      params: {
        restaurantId: "restaurant-1",
        tableId: 10,
      },
      query: {
        seatId: 21,
      },
    });
  });
});
