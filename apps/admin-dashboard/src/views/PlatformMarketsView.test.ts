import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlatformMarketsView from "./PlatformMarketsView.vue";
import { marketsService } from "@/services/marketsService";
import { useAuthStore } from "@/stores/auth";
import { useRouter } from "vue-router";

vi.mock("@/services/marketsService", () => ({
  marketsService: {
    listPlatformReadiness: vi.fn(),
    updateMarketPublicProfile: vi.fn(),
    importVendors: vi.fn(),
  },
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: vi.fn(),
}));

vi.mock("vue-router", () => ({
  useRouter: vi.fn(),
}));

describe("PlatformMarketsView", () => {
  const selectRestaurant = vi.fn();
  const push = vi.fn();
  const createObjectURL = vi.fn(() => "blob:market-catalog-gaps");
  const revokeObjectURL = vi.fn();
  const click = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("URL", {
      createObjectURL,
      revokeObjectURL,
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(click);
    vi.mocked(useAuthStore).mockReturnValue({
      selectRestaurant,
    } as unknown as ReturnType<typeof useAuthStore>);
    vi.mocked(useRouter).mockReturnValue({
      push,
    } as unknown as ReturnType<typeof useRouter>);
    vi.mocked(marketsService.listPlatformReadiness).mockResolvedValue([
      {
        id: "market-1",
        slug: "fengjia",
        name: "逢甲夜市",
        type: "night_market",
        city: "台中市",
        district: "西屯區",
        vendorCount: 1,
        catalogCoverage: {
          searchableProductCount: 0,
          publicServiceCount: 0,
          vendorsWithSearchableProducts: 0,
          vendorsMissingSearchableProducts: 1,
          vendorsWithPublicServices: 0,
          vendorsMissingPublicServices: 1,
          missingProductVendors: [
            {
              restaurantId: "restaurant-1",
              name: "缺商品攤",
              stallNumber: "A-01",
            },
          ],
          missingServiceVendors: [
            {
              restaurantId: "restaurant-1",
              name: "缺商品攤",
              stallNumber: "A-01",
            },
          ],
        },
        publicReadiness: {
          ready: false,
          score: 71,
          completedCount: 5,
          totalCount: 7,
          issues: [{ key: "products", severity: "required" }],
        },
      },
    ]);
  });

  it("switches restaurant context before opening menu or service settings", async () => {
    const wrapper = mount(PlatformMarketsView);
    await flushPromises();

    await wrapper
      .get('[data-testid="manage-products-restaurant-1"]')
      .trigger("click");

    expect(selectRestaurant).toHaveBeenCalledWith("restaurant-1", "缺商品攤");
    expect(push).toHaveBeenCalledWith({ name: "Menu" });

    await wrapper
      .get('[data-testid="manage-services-restaurant-1"]')
      .trigger("click");

    expect(selectRestaurant).toHaveBeenLastCalledWith(
      "restaurant-1",
      "缺商品攤",
    );
    expect(push).toHaveBeenLastCalledWith({
      name: "Settings",
      query: { tab: "contact" },
    });
  });

  it("filters readiness rows by product or service catalog gaps", async () => {
    vi.mocked(marketsService.listPlatformReadiness).mockResolvedValue([
      {
        id: "market-products",
        slug: "products-gap",
        name: "缺商品市場",
        type: "night_market",
        city: "台中市",
        district: "西屯區",
        vendorCount: 1,
        catalogCoverage: {
          searchableProductCount: 0,
          publicServiceCount: 1,
          vendorsWithSearchableProducts: 0,
          vendorsMissingSearchableProducts: 1,
          vendorsWithPublicServices: 1,
          vendorsMissingPublicServices: 0,
          missingProductVendors: [],
          missingServiceVendors: [],
        },
        publicReadiness: {
          ready: false,
          score: 71,
          completedCount: 5,
          totalCount: 7,
          issues: [{ key: "products", severity: "required" }],
        },
      },
      {
        id: "market-services",
        slug: "services-gap",
        name: "缺服務市場",
        type: "commercial_district",
        city: "台中市",
        district: "北區",
        vendorCount: 1,
        catalogCoverage: {
          searchableProductCount: 1,
          publicServiceCount: 0,
          vendorsWithSearchableProducts: 1,
          vendorsMissingSearchableProducts: 0,
          vendorsWithPublicServices: 0,
          vendorsMissingPublicServices: 1,
          missingProductVendors: [],
          missingServiceVendors: [],
        },
        publicReadiness: {
          ready: false,
          score: 71,
          completedCount: 5,
          totalCount: 7,
          issues: [{ key: "services", severity: "recommended" }],
        },
      },
    ]);

    const wrapper = mount(PlatformMarketsView);
    await flushPromises();

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "缺商品")!
      .trigger("click");
    expect(wrapper.text()).toContain("缺商品市場");
    expect(wrapper.text()).not.toContain("缺服務市場");

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "缺服務")!
      .trigger("click");
    expect(wrapper.text()).not.toContain("缺商品市場");
    expect(wrapper.text()).toContain("缺服務市場");
  });

  it("downloads a CSV for currently visible catalog gaps", async () => {
    const wrapper = mount(PlatformMarketsView);
    await flushPromises();

    await wrapper.get('[data-testid="export-catalog-gaps"]').trigger("click");

    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("text/csv;charset=utf-8;");
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:market-catalog-gaps");
  });

  it("imports vendors into the selected market from JSON", async () => {
    vi.mocked(marketsService.importVendors).mockResolvedValue({
      createdRestaurants: 1,
      attachedVendors: 2,
      skipped: 0,
      results: [],
    });
    const wrapper = mount(PlatformMarketsView);
    await flushPromises();

    const editButton = wrapper
      .findAll("button")
      .find((button) => button.text() === "編輯");
    expect(editButton).toBeDefined();
    await editButton!.trigger("click");

    await wrapper
      .get('[data-testid="vendor-import-format-json"]')
      .trigger("click");
    await wrapper.get('[data-testid="vendor-import-json"]').setValue(
      JSON.stringify([
        {
          restaurantId: "restaurant-1",
          stallNumber: "A-01",
        },
        {
          name: "新匯入店鋪",
          address: "台中市西屯區文華路 100 號",
          district: "西屯區",
        },
      ]),
    );
    await wrapper.get('[data-testid="vendor-import-submit"]').trigger("click");
    await flushPromises();

    expect(marketsService.importVendors).toHaveBeenCalledWith("market-1", [
      {
        restaurantId: "restaurant-1",
        stallNumber: "A-01",
      },
      {
        name: "新匯入店鋪",
        address: "台中市西屯區文華路 100 號",
        district: "西屯區",
      },
    ]);
    expect(marketsService.listPlatformReadiness).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("已建立 1 間店鋪");
  });

  it("imports vendors into the selected market from CSV with a preview", async () => {
    vi.mocked(marketsService.importVendors).mockResolvedValue({
      createdRestaurants: 1,
      attachedVendors: 1,
      skipped: 0,
      results: [],
    });
    const wrapper = mount(PlatformMarketsView);
    await flushPromises();

    const editButton = wrapper
      .findAll("button")
      .find((button) => button.text() === "編輯");
    expect(editButton).toBeDefined();
    await editButton!.trigger("click");

    await wrapper
      .get('[data-testid="vendor-import-json"]')
      .setValue(
        [
          "restaurantId,name,address,district,stallNumber,isPrimary",
          ',"CSV 匯入店鋪","台中市西屯區文華路 100 號","西屯區","C-01",true',
        ].join("\n"),
      );
    expect(wrapper.text()).toContain("已解析 1 筆店鋪");

    await wrapper.get('[data-testid="vendor-import-submit"]').trigger("click");
    await flushPromises();

    expect(marketsService.importVendors).toHaveBeenCalledWith("market-1", [
      {
        name: "CSV 匯入店鋪",
        address: "台中市西屯區文華路 100 號",
        district: "西屯區",
        stallNumber: "C-01",
        isPrimary: true,
      },
    ]);
  });
});

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}
