import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MarketsView from "@/views/MarketsView.vue";
import { marketsApi } from "@/services/marketsApi";
import { useMarketsStore } from "@/stores/markets";

const routerPush = vi.hoisted(() => vi.fn());

vi.mock("vue-router", () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}));

vi.mock("@/stores/markets", () => ({
  useMarketsStore: vi.fn(),
}));

vi.mock("@/services/marketsApi", () => ({
  marketsApi: {
    listAreas: vi.fn(),
  },
}));

function marketsStore(overrides: Record<string, unknown> = {}) {
  return {
    markets: [],
    nearbyMarkets: [],
    loading: false,
    error: null,
    hasMarkets: false,
    loadMarkets: vi.fn(),
    loadNearby: vi.fn(),
    ...overrides,
  };
}

function mountView() {
  return mount(MarketsView, {
    global: {
      stubs: {
        MarketCard: true,
      },
    },
  });
}

describe("MarketsView", () => {
  beforeEach(() => {
    routerPush.mockReset();
    vi.mocked(marketsApi.listAreas).mockResolvedValue({
      areas: [],
    } as never);
    vi.mocked(useMarketsStore).mockReturnValue(marketsStore() as never);
  });

  it("loads city and district filter options from market areas", async () => {
    vi.mocked(marketsApi.listAreas).mockResolvedValueOnce({
      areas: [
        { city: "台中市", districts: ["西屯區"] },
        { city: "台北市", districts: ["萬華區"] },
      ],
    } as never);
    const store = marketsStore();
    vi.mocked(useMarketsStore).mockReturnValue(store as never);

    const wrapper = mountView();
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain("台北市");
    });

    await wrapper.get('[data-testid="markets-city-select"]').setValue("台北市");

    expect(wrapper.text()).toContain("萬華區");
    expect(store.loadMarkets).toHaveBeenLastCalledWith({
      city: "台北市",
      district: undefined,
    });
  });
});
