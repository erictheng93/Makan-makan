import { mount } from "@vue/test-utils";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OrderTrackingView from "@/views/OrderTrackingView.vue";
import { orderApi } from "@/services/orderApi";

const websocketOptions = vi.hoisted(() => ({
  current: null as null | { getUrl: () => Promise<string> },
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("vue-toastification", () => ({
  useToast: () => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@tanstack/vue-query", () => ({
  useQueryClient: () => ({ setQueryData: vi.fn() }),
  useQuery: () => ({
    data: ref(null),
    isLoading: ref(false),
    error: ref(null),
    refetch: vi.fn(),
  }),
  useMutation: () => ({ mutate: vi.fn() }),
}));

vi.mock("@/composables/useWebSocket", () => ({
  useWebSocket: (options: { getUrl: () => Promise<string> }) => {
    websocketOptions.current = options;
    return {
      connectionStatus: ref("disconnected"),
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  },
}));

vi.mock("@/composables/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    tWithParams: (key: string) => key,
  }),
}));

vi.mock("@/composables/useCurrency", () => ({
  useCurrency: () => ({ formatPrice: (value: number) => String(value) }),
}));

vi.mock("@/services/orderApi", () => ({
  orderApi: {
    getGuestRealtimeToken: vi.fn(),
    getGuestOrder: vi.fn(),
    getOrder: vi.fn(),
    cancelOrder: vi.fn(),
  },
}));

function mountView() {
  return mount(OrderTrackingView, {
    props: {
      restaurantId: "restaurant-1",
      tableId: 7,
      orderId: "1001",
    },
    shallow: true,
  });
}

describe("OrderTrackingView guest realtime URL", () => {
  beforeEach(() => {
    websocketOptions.current = null;
    vi.mocked(orderApi.getGuestRealtimeToken).mockReset();
    localStorage.setItem("guest_auth_token", "guest-token");
    localStorage.setItem("makanmakan_table_qr:restaurant-1:7", "signed-qr");
  });

  it("uses and caches the order-scoped WebSocket URL returned by the API", async () => {
    vi.mocked(orderApi.getGuestRealtimeToken).mockResolvedValue({
      token: "realtime-token",
      expiresAt: "2099-01-01T00:00:00.000Z",
      wsUrl:
        "wss://realtime.example.test/customer/order:1001?token=realtime-token",
    });
    const wrapper = mountView();

    const url = await websocketOptions.current?.getUrl();

    expect(url).toBe(
      "wss://realtime.example.test/customer/order:1001?token=realtime-token",
    );
    expect(
      JSON.parse(
        localStorage.getItem(
          "makanmakan_guest_realtime_token:restaurant-1:7:1001",
        ) ?? "{}",
      ),
    ).toMatchObject({
      token: "realtime-token",
      wsUrl:
        "wss://realtime.example.test/customer/order:1001?token=realtime-token",
    });
    wrapper.unmount();
  });

  it("reuses the cached order-scoped WebSocket URL", async () => {
    localStorage.setItem(
      "makanmakan_guest_realtime_token:restaurant-1:7:1001",
      JSON.stringify({
        token: "realtime-token",
        expiresAt: "2099-01-01T00:00:00.000Z",
        wsUrl:
          "wss://realtime.example.test/customer/order:1001?token=realtime-token",
      }),
    );
    const wrapper = mountView();

    const url = await websocketOptions.current?.getUrl();

    expect(url).toBe(
      "wss://realtime.example.test/customer/order:1001?token=realtime-token",
    );
    expect(orderApi.getGuestRealtimeToken).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
