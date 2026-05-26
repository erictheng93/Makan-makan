// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlatformMarketsView from "./PlatformMarketsView.vue";
import { marketsService } from "@/services/marketsService";
import { useAuthStore } from "@/stores/auth";
import { useRoute, useRouter } from "vue-router";

vi.mock("@/services/marketsService", () => ({
  marketsService: {
    listPlatformReadiness: vi.fn(),
    listAreaReadiness: vi.fn(),
    updateMarketPublicProfile: vi.fn(),
    importVendors: vi.fn(),
    searchVendorCandidates: vi.fn(),
    addVendor: vi.fn(),
    listMarketVendors: vi.fn(),
    updateVendor: vi.fn(),
    removeVendor: vi.fn(),
  },
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: vi.fn(),
}));

vi.mock("vue-router", () => ({
  useRoute: vi.fn(),
  useRouter: vi.fn(),
}));

describe("PlatformMarketsView", () => {
  const selectRestaurant = vi.fn();
  const push = vi.fn();
  const replace = vi.fn();
  const createObjectURL = vi.fn(() => "blob:market-catalog-gaps");
  const revokeObjectURL = vi.fn();
  const click = vi.fn();
  const routeQuery = {} as Record<string, unknown>;

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
    Object.keys(routeQuery).forEach((key) => delete routeQuery[key]);
    vi.mocked(useRoute).mockReturnValue({
      query: routeQuery,
    } as unknown as ReturnType<typeof useRoute>);
    vi.mocked(useRouter).mockReturnValue({
      push,
      replace,
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
      {
        id: "market-2",
        slug: "yizhong",
        name: "一中商圈",
        type: "commercial_district",
        city: "台中市",
        district: "北區",
        vendorCount: 1,
        catalogCoverage: {
          searchableProductCount: 3,
          publicServiceCount: 1,
          vendorsWithSearchableProducts: 1,
          vendorsMissingSearchableProducts: 0,
          vendorsWithPublicServices: 1,
          vendorsMissingPublicServices: 0,
          missingProductVendors: [],
          missingServiceVendors: [],
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
    vi.mocked(marketsService.listAreaReadiness).mockResolvedValue([
      {
        city: "台中市",
        district: "西屯區",
        marketCount: 2,
        vendorCount: 8,
        searchableProductCount: 20,
        publicServiceCount: 4,
        vendorsMissingSearchableProducts: 3,
        vendorsMissingPublicServices: 4,
        totalCatalogGapVendors: 7,
        averageReadinessScore: 72,
      },
      {
        city: "台中市",
        district: "北區",
        marketCount: 1,
        vendorCount: 3,
        searchableProductCount: 8,
        publicServiceCount: 1,
        vendorsMissingSearchableProducts: 1,
        vendorsMissingPublicServices: 1,
        totalCatalogGapVendors: 2,
        averageReadinessScore: 91,
      },
    ]);
    vi.mocked(marketsService.searchVendorCandidates).mockResolvedValue({
      restaurants: [],
      total: 0,
    });
    vi.mocked(marketsService.listMarketVendors).mockResolvedValue({
      vendors: [],
      total: 0,
      page: 1,
      limit: 10,
    });
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

  it("shows catalog completion priority and sorts urgent markets first", async () => {
    vi.mocked(marketsService.listPlatformReadiness).mockResolvedValue([
      {
        id: "market-low",
        slug: "low-gap",
        name: "低缺口市場",
        type: "night_market",
        city: "台中市",
        district: "西屯區",
        vendorCount: 3,
        catalogCoverage: {
          searchableProductCount: 8,
          publicServiceCount: 2,
          vendorsWithSearchableProducts: 3,
          vendorsMissingSearchableProducts: 0,
          vendorsWithPublicServices: 2,
          vendorsMissingPublicServices: 1,
          missingProductVendors: [],
          missingServiceVendors: [],
        },
        publicReadiness: {
          ready: true,
          score: 100,
          completedCount: 7,
          totalCount: 7,
          issues: [],
        },
      },
      {
        id: "market-high",
        slug: "high-gap",
        name: "高缺口市場",
        type: "night_market",
        city: "台中市",
        district: "北區",
        vendorCount: 5,
        catalogCoverage: {
          searchableProductCount: 0,
          publicServiceCount: 0,
          vendorsWithSearchableProducts: 2,
          vendorsMissingSearchableProducts: 3,
          vendorsWithPublicServices: 3,
          vendorsMissingPublicServices: 2,
          missingProductVendors: [],
          missingServiceVendors: [],
        },
        publicReadiness: {
          ready: false,
          score: 50,
          completedCount: 4,
          totalCount: 7,
          issues: [{ key: "products", severity: "required" }],
        },
      },
    ]);

    const wrapper = mount(PlatformMarketsView);
    await flushPromises();

    const rows = wrapper.findAll("tbody tr");
    expect(rows[0].text()).toContain("高缺口市場");
    expect(rows[0].get('[data-testid="catalog-priority"]').text()).toContain(
      "18",
    );
    expect(rows[1].text()).toContain("低缺口市場");
  });

  it("shows area-level catalog gap rankings for operations planning", async () => {
    const wrapper = mount(PlatformMarketsView);
    await flushPromises();

    expect(marketsService.listAreaReadiness).toHaveBeenCalledOnce();

    const areaRows = wrapper.findAll('[data-testid="area-readiness-row"]');
    expect(areaRows).toHaveLength(2);
    expect(areaRows[0].text()).toContain("台中市 · 西屯區");
    expect(areaRows[0].text()).toContain("總缺口 7");
    expect(areaRows[0].text()).toContain("缺商品 3");
    expect(areaRows[0].text()).toContain("缺服務 4");
    expect(areaRows[1].text()).toContain("台中市 · 北區");
  });

  it("filters the market list when selecting an area readiness row", async () => {
    const wrapper = mount(PlatformMarketsView);
    await flushPromises();

    expect(wrapper.text()).toContain("逢甲夜市");
    expect(wrapper.text()).toContain("一中商圈");

    await wrapper
      .findAll('[data-testid="area-readiness-row"]')[1]
      .trigger("click");

    expect(wrapper.text()).not.toContain("逢甲夜市");
    expect(wrapper.text()).toContain("一中商圈");
    expect(
      wrapper.get('[data-testid="selected-area-filter"]').text(),
    ).toContain("台中市 · 北區");

    await wrapper.get('[data-testid="clear-area-filter"]').trigger("click");

    expect(wrapper.text()).toContain("逢甲夜市");
    expect(wrapper.text()).toContain("一中商圈");
  });

  it("initializes and syncs the selected area through the URL query", async () => {
    routeQuery.areaCity = "台中市";
    routeQuery.areaDistrict = "北區";

    const wrapper = mount(PlatformMarketsView);
    await flushPromises();

    expect(wrapper.text()).not.toContain("逢甲夜市");
    expect(wrapper.text()).toContain("一中商圈");
    expect(
      wrapper.get('[data-testid="selected-area-filter"]').text(),
    ).toContain("台中市 · 北區");

    await wrapper
      .findAll('[data-testid="area-readiness-row"]')[0]
      .trigger("click");

    expect(replace).toHaveBeenLastCalledWith({
      query: {
        areaCity: "台中市",
        areaDistrict: "西屯區",
      },
    });

    await wrapper.get('[data-testid="clear-area-filter"]').trigger("click");

    expect(replace).toHaveBeenLastCalledWith({ query: {} });
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

  it("downloads a CSV for area-level readiness summaries", async () => {
    const wrapper = mount(PlatformMarketsView);
    await flushPromises();

    await wrapper.get('[data-testid="export-area-readiness"]').trigger("click");

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

  it("searches existing vendors and attaches one to the selected market", async () => {
    vi.mocked(marketsService.searchVendorCandidates).mockResolvedValue({
      restaurants: [
        {
          id: "restaurant-candidate",
          name: "既有滷味攤",
          city: "台中市",
          district: "西屯區",
          address: "台中市西屯區文華路 12 號",
          type: "market_stall",
          category: "food",
          isAvailable: true,
          supportsTakeaway: true,
          supportsDelivery: false,
        },
      ],
      total: 1,
    });
    vi.mocked(marketsService.addVendor).mockResolvedValue({
      id: 8,
      restaurantId: "restaurant-candidate",
      marketId: "market-1",
      stallNumber: "D-08",
      isPrimary: false,
      joinedAt: new Date(),
    });
    const wrapper = mount(PlatformMarketsView);
    await flushPromises();

    const editButton = wrapper
      .findAll("button")
      .find((button) => button.text() === "編輯");
    expect(editButton).toBeDefined();
    await editButton!.trigger("click");

    await wrapper
      .get('[data-testid="vendor-candidate-query"]')
      .setValue("滷味");
    await wrapper
      .get('[data-testid="vendor-candidate-search"]')
      .trigger("click");
    await flushPromises();

    expect(marketsService.searchVendorCandidates).toHaveBeenCalledWith({
      q: "滷味",
      marketId: "market-1",
      limit: 10,
    });
    expect(wrapper.text()).toContain("既有滷味攤");

    await wrapper
      .get('[data-testid="vendor-candidate-stall-restaurant-candidate"]')
      .setValue("D-08");
    await wrapper
      .get('[data-testid="vendor-candidate-primary-restaurant-candidate"]')
      .setValue(true);
    await wrapper
      .get('[data-testid="vendor-candidate-attach-restaurant-candidate"]')
      .trigger("click");
    await flushPromises();

    expect(marketsService.addVendor).toHaveBeenCalledWith("market-1", {
      restaurantId: "restaurant-candidate",
      stallNumber: "D-08",
      isPrimary: true,
    });
    expect(marketsService.listPlatformReadiness).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("已加入既有滷味攤");
  });

  it("loads attached vendors and lets admins update or remove them", async () => {
    vi.mocked(marketsService.listMarketVendors).mockResolvedValue({
      vendors: [
        {
          restaurantId: "restaurant-1",
          name: "已加入雞排",
          type: "market_stall",
          category: "food",
          city: "台中市",
          district: "西屯區",
          supportsTakeaway: true,
          supportsDelivery: false,
          stallNumber: "A-01",
          isPrimary: false,
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
    });
    vi.mocked(marketsService.updateVendor).mockResolvedValue({
      id: 1,
      restaurantId: "restaurant-1",
      marketId: "market-1",
      stallNumber: "A-02",
      isPrimary: true,
      joinedAt: new Date(),
    });
    vi.mocked(marketsService.removeVendor).mockResolvedValue(true);
    const wrapper = mount(PlatformMarketsView);
    await flushPromises();

    const editButton = wrapper
      .findAll("button")
      .find((button) => button.text() === "編輯");
    expect(editButton).toBeDefined();
    await editButton!.trigger("click");
    await flushPromises();

    expect(marketsService.listMarketVendors).toHaveBeenCalledWith("fengjia", {
      q: undefined,
      page: 1,
      limit: 10,
    });
    expect(wrapper.text()).toContain("已加入雞排");

    await wrapper
      .get('[data-testid="attached-vendor-stall-restaurant-1"]')
      .setValue("A-02");
    await wrapper
      .get('[data-testid="attached-vendor-primary-restaurant-1"]')
      .setValue(true);
    await wrapper
      .get('[data-testid="attached-vendor-save-restaurant-1"]')
      .trigger("click");
    await flushPromises();

    expect(marketsService.updateVendor).toHaveBeenCalledWith(
      "market-1",
      "restaurant-1",
      {
        stallNumber: "A-02",
        isPrimary: true,
      },
    );

    await wrapper
      .get('[data-testid="attached-vendor-remove-restaurant-1"]')
      .trigger("click");
    await flushPromises();

    expect(marketsService.removeVendor).toHaveBeenCalledWith(
      "market-1",
      "restaurant-1",
    );
  });

  it("searches and paginates attached vendors for large markets", async () => {
    vi.mocked(marketsService.listMarketVendors)
      .mockResolvedValueOnce({
        vendors: [
          {
            restaurantId: "restaurant-1",
            name: "第一頁店鋪",
            city: "台中市",
            district: "西屯區",
            supportsTakeaway: true,
            supportsDelivery: false,
            stallNumber: "A-01",
            isPrimary: false,
          },
        ],
        total: 21,
        page: 1,
        limit: 10,
      })
      .mockResolvedValueOnce({
        vendors: [
          {
            restaurantId: "restaurant-11",
            name: "第二頁雞排",
            city: "台中市",
            district: "西屯區",
            supportsTakeaway: true,
            supportsDelivery: false,
            stallNumber: "B-11",
            isPrimary: false,
          },
        ],
        total: 21,
        page: 2,
        limit: 10,
      })
      .mockResolvedValueOnce({
        vendors: [
          {
            restaurantId: "restaurant-search",
            name: "搜尋雞排",
            city: "台中市",
            district: "西屯區",
            supportsTakeaway: true,
            supportsDelivery: false,
            stallNumber: "C-01",
            isPrimary: false,
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
      });

    const wrapper = mount(PlatformMarketsView);
    await flushPromises();

    const editButton = wrapper
      .findAll("button")
      .find((button) => button.text() === "編輯");
    await editButton!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("第 1 / 3 頁");
    await wrapper
      .get('[data-testid="attached-vendor-next-page"]')
      .trigger("click");
    await flushPromises();

    expect(marketsService.listMarketVendors).toHaveBeenLastCalledWith(
      "fengjia",
      {
        q: undefined,
        page: 2,
        limit: 10,
      },
    );
    expect(wrapper.text()).toContain("第二頁雞排");

    await wrapper.get('[data-testid="attached-vendor-query"]').setValue("雞排");
    await wrapper
      .get('[data-testid="attached-vendor-search"]')
      .trigger("click");
    await flushPromises();

    expect(marketsService.listMarketVendors).toHaveBeenLastCalledWith(
      "fengjia",
      {
        q: "雞排",
        page: 1,
        limit: 10,
      },
    );
    expect(wrapper.text()).toContain("搜尋雞排");
  });
});

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}
