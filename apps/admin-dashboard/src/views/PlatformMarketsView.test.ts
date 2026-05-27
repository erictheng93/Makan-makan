// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PlatformMarketsView from "./PlatformMarketsView.vue";
import { marketsService } from "@/services/marketsService";
import { discoveryService } from "@/services/discoveryService";
import { useAuthStore } from "@/stores/auth";
import { useRoute, useRouter } from "vue-router";

vi.mock("@/services/marketsService", () => ({
  marketsService: {
    listPlatformReadiness: vi.fn(),
    listAreaReadiness: vi.fn(),
    updateMarketPublicProfile: vi.fn(),
    createMarket: vi.fn(),
    importVendors: vi.fn(),
    searchVendorCandidates: vi.fn(),
    addVendor: vi.fn(),
    listMarketVendors: vi.fn(),
    updateVendor: vi.fn(),
    removeVendor: vi.fn(),
    listAdminJoinRequests: vi.fn(),
    approveJoinRequest: vi.fn(),
    rejectJoinRequest: vi.fn(),
  },
}));

vi.mock("@/services/discoveryService", () => ({
  discoveryService: {
    getIndexStatus: vi.fn(),
    reindex: vi.fn(),
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
          vendorsMissingStallNumbers: 1,
          vendorsMissingSearchEntrypoints: 1,
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
          missingStallNumberVendors: [
            {
              restaurantId: "restaurant-2",
              name: "缺攤位號攤",
              stallNumber: null,
            },
          ],
          missingSearchEntrypointVendors: [
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
        marketsWithoutVendors: 1,
        marketsWithoutSearchableCatalog: 2,
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
        marketsWithoutVendors: 0,
        marketsWithoutSearchableCatalog: 0,
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
    vi.mocked(marketsService.listAdminJoinRequests).mockResolvedValue([]);
    vi.mocked(marketsService.approveJoinRequest).mockResolvedValue(undefined);
    vi.mocked(marketsService.rejectJoinRequest).mockResolvedValue(undefined);
    vi.mocked(discoveryService.reindex).mockResolvedValue({
      dishes: 12,
      restaurants: 4,
      duration_ms: 250,
    });
    vi.mocked(discoveryService.getIndexStatus).mockResolvedValue({
      version: "1779870000000",
      lastReindexedAt: "2026-05-27T08:00:00.000Z",
      indexedDishCount: 12,
      availableDishCount: 10,
      indexedRestaurantCount: 4,
    });
  });

  it("switches restaurant context before opening menu or service settings", async () => {
    routeQuery.areaCity = "台中市";
    routeQuery.areaDistrict = "西屯區";
    const wrapper = mount(PlatformMarketsView);
    await flushPromises();

    await wrapper
      .get('[data-testid="manage-products-restaurant-1"]')
      .trigger("click");

    expect(selectRestaurant).toHaveBeenCalledWith("restaurant-1", "缺商品攤");
    expect(push).toHaveBeenCalledWith({
      name: "Menu",
      query: {
        source: "market-gap",
        gap: "products",
        marketName: "逢甲夜市",
        marketSlug: "fengjia",
        areaCity: "台中市",
        areaDistrict: "西屯區",
      },
    });

    await wrapper
      .get('[data-testid="manage-services-restaurant-1"]')
      .trigger("click");

    expect(selectRestaurant).toHaveBeenLastCalledWith(
      "restaurant-1",
      "缺商品攤",
    );
    expect(push).toHaveBeenLastCalledWith({
      name: "Settings",
      query: {
        source: "market-gap",
        gap: "services",
        tab: "contact",
        section: "services",
        marketName: "逢甲夜市",
        marketSlug: "fengjia",
        areaCity: "台中市",
        areaDistrict: "西屯區",
      },
    });
  });

  it("shows stall number and search entrypoint gaps for operators", async () => {
    const wrapper = mount(PlatformMarketsView);
    await flushPromises();

    expect(wrapper.text()).toContain("缺攤位號");
    expect(wrapper.text()).toContain("缺搜尋入口");
    expect(wrapper.text()).toContain("缺攤位號攤");
    expect(wrapper.text()).toContain("缺商品攤");

    await wrapper
      .get('[data-testid="manage-stall-restaurant-2"]')
      .trigger("click");

    expect(marketsService.listMarketVendors).toHaveBeenLastCalledWith(
      "fengjia",
      {
        q: undefined,
        page: 1,
        limit: 10,
      },
    );

    await wrapper
      .get('[data-testid="manage-entrypoint-products-restaurant-1"]')
      .trigger("click");

    expect(selectRestaurant).toHaveBeenLastCalledWith(
      "restaurant-1",
      "缺商品攤",
    );
    expect(push).toHaveBeenLastCalledWith({
      name: "Menu",
      query: {
        source: "market-gap",
        gap: "products",
        marketName: "逢甲夜市",
        marketSlug: "fengjia",
        areaCity: "台中市",
        areaDistrict: "西屯區",
      },
    });

    await wrapper
      .get('[data-testid="manage-entrypoint-services-restaurant-1"]')
      .trigger("click");

    expect(selectRestaurant).toHaveBeenLastCalledWith(
      "restaurant-1",
      "缺商品攤",
    );
    expect(push).toHaveBeenLastCalledWith({
      name: "Settings",
      query: {
        source: "market-gap",
        gap: "services",
        tab: "contact",
        section: "services",
        marketName: "逢甲夜市",
        marketSlug: "fengjia",
        areaCity: "台中市",
        areaDistrict: "西屯區",
      },
    });
  });

  it("lets platform operators approve pending market join requests", async () => {
    vi.mocked(marketsService.listAdminJoinRequests).mockResolvedValue([
      {
        id: 7,
        restaurantId: "restaurant-join-1",
        marketId: "market-1",
        status: "pending",
        message: "A-12，每週五六日營業",
        requestedAt: "2026-05-27T01:00:00.000Z",
        resolvedAt: null,
        market: {
          id: "market-1",
          slug: "fengjia",
          name: "逢甲夜市",
          type: "night_market",
          city: "台中市",
          district: "西屯區",
        },
        restaurant: {
          id: "restaurant-join-1",
          name: "新加入雞排",
          city: "台中市",
          district: "西屯區",
        },
      },
    ]);
    const wrapper = mount(PlatformMarketsView);
    await flushPromises();

    expect(marketsService.listAdminJoinRequests).toHaveBeenCalledWith({
      status: "pending",
    });
    expect(wrapper.text()).toContain("新加入雞排");
    expect(wrapper.text()).toContain("逢甲夜市");

    await wrapper.get('[data-testid="join-request-stall-7"]').setValue("A-12");
    await wrapper.get('[data-testid="join-request-primary-7"]').setValue(true);
    await wrapper
      .get('[data-testid="approve-join-request-7"]')
      .trigger("click");
    await flushPromises();

    expect(marketsService.approveJoinRequest).toHaveBeenCalledWith(7, {
      stallNumber: "A-12",
      isPrimary: true,
    });
    expect(marketsService.listAdminJoinRequests).toHaveBeenCalledTimes(2);
    expect(marketsService.listPlatformReadiness).toHaveBeenCalledTimes(2);
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

  it("surfaces customer empty-state gaps and filters them for operators", async () => {
    vi.mocked(marketsService.listPlatformReadiness).mockResolvedValue([
      {
        id: "market-empty-vendors",
        slug: "empty-vendors",
        name: "尚無店鋪市場",
        type: "night_market",
        city: "台中市",
        district: "西屯區",
        vendorCount: 0,
        catalogCoverage: {
          searchableProductCount: 0,
          publicServiceCount: 0,
          vendorsWithSearchableProducts: 0,
          vendorsMissingSearchableProducts: 0,
          vendorsWithPublicServices: 0,
          vendorsMissingPublicServices: 0,
          missingProductVendors: [],
          missingServiceVendors: [],
        },
        publicReadiness: {
          ready: false,
          score: 43,
          completedCount: 3,
          totalCount: 7,
          issues: [{ key: "vendors", severity: "required" }],
        },
      },
      {
        id: "market-empty-catalog",
        slug: "empty-catalog",
        name: "尚無搜尋內容市場",
        type: "commercial_district",
        city: "台中市",
        district: "北區",
        vendorCount: 3,
        catalogCoverage: {
          searchableProductCount: 0,
          publicServiceCount: 0,
          vendorsWithSearchableProducts: 0,
          vendorsMissingSearchableProducts: 3,
          vendorsWithPublicServices: 0,
          vendorsMissingPublicServices: 3,
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
    ]);

    const wrapper = mount(PlatformMarketsView);
    await flushPromises();

    expect(wrapper.text()).toContain("無店鋪市場");
    expect(wrapper.text()).toContain("無搜尋內容市場");
    expect(wrapper.text()).toContain("使用者會看到尚未收錄店鋪");
    expect(wrapper.text()).toContain("使用者會看到尚未上架商品/服務");
    expect(wrapper.text()).toContain("補菜單/服務或重建索引");

    await wrapper
      .get('[data-testid="reindex-market-empty-catalog"]')
      .trigger("click");
    await flushPromises();

    expect(discoveryService.reindex).toHaveBeenCalledOnce();
    expect(marketsService.listPlatformReadiness).toHaveBeenCalledTimes(2);
    expect(marketsService.listAreaReadiness).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("已重建 12 筆商品索引");

    await wrapper
      .get('[data-testid="import-vendors-market-empty-vendors"]')
      .trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("編輯公開資料：尚無店鋪市場");
    expect(
      wrapper.get('[data-testid="vendor-import-section"]').text(),
    ).toContain("批次匯入店鋪");
    expect(marketsService.listMarketVendors).toHaveBeenLastCalledWith(
      "empty-vendors",
      {
        q: undefined,
        page: 1,
        limit: 10,
      },
    );

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "無店鋪")!
      .trigger("click");
    expect(wrapper.text()).toContain("尚無店鋪市場");
    expect(wrapper.text()).not.toContain("尚無搜尋內容市場");

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "無搜尋內容")!
      .trigger("click");
    expect(wrapper.text()).toContain("尚無店鋪市場");
    expect(wrapper.text()).toContain("尚無搜尋內容市場");
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
      "24",
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
    expect(areaRows[0].text()).toContain("無店鋪 1");
    expect(areaRows[0].text()).toContain("無搜尋內容 2");
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

  it("drills from an area catalog gap into the matching market worklist", async () => {
    vi.mocked(marketsService.listPlatformReadiness).mockResolvedValue([
      {
        id: "market-products",
        slug: "products-gap",
        name: "西屯缺商品市場",
        type: "night_market",
        city: "台中市",
        district: "西屯區",
        vendorCount: 2,
        catalogCoverage: {
          searchableProductCount: 1,
          publicServiceCount: 2,
          vendorsWithSearchableProducts: 1,
          vendorsMissingSearchableProducts: 1,
          vendorsWithPublicServices: 2,
          vendorsMissingPublicServices: 0,
          missingProductVendors: [],
          missingServiceVendors: [],
        },
        publicReadiness: {
          ready: false,
          score: 86,
          completedCount: 6,
          totalCount: 7,
          issues: [{ key: "products", severity: "required" }],
        },
      },
      {
        id: "market-services",
        slug: "services-gap",
        name: "西屯缺服務市場",
        type: "night_market",
        city: "台中市",
        district: "西屯區",
        vendorCount: 2,
        catalogCoverage: {
          searchableProductCount: 2,
          publicServiceCount: 0,
          vendorsWithSearchableProducts: 2,
          vendorsMissingSearchableProducts: 0,
          vendorsWithPublicServices: 1,
          vendorsMissingPublicServices: 1,
          missingProductVendors: [],
          missingServiceVendors: [],
        },
        publicReadiness: {
          ready: false,
          score: 86,
          completedCount: 6,
          totalCount: 7,
          issues: [{ key: "services", severity: "recommended" }],
        },
      },
      {
        id: "market-north-products",
        slug: "north-products-gap",
        name: "北區缺商品市場",
        type: "commercial_district",
        city: "台中市",
        district: "北區",
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
    ]);
    const wrapper = mount(PlatformMarketsView);
    await flushPromises();

    await wrapper
      .findAll('[data-testid="area-gap-missing-products"]')[0]
      .trigger("click");

    expect(
      wrapper.get('[data-testid="selected-area-filter"]').text(),
    ).toContain("台中市 · 西屯區");
    expect(wrapper.text()).toContain("西屯缺商品市場");
    expect(wrapper.text()).not.toContain("西屯缺服務市場");
    expect(wrapper.text()).not.toContain("北區缺商品市場");
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

  it("initializes the market search from a market slug query", async () => {
    routeQuery.marketSlug = "fengjia";

    const wrapper = mount(PlatformMarketsView);
    await flushPromises();

    expect(
      wrapper.get<HTMLInputElement>('[data-testid="platform-market-query"]')
        .element.value,
    ).toBe("fengjia");
  });

  it("prompts operators to reindex after returning from a market gap fix", async () => {
    routeQuery.marketSlug = "fengjia";
    routeQuery.areaCity = "台中市";
    routeQuery.areaDistrict = "西屯區";

    const wrapper = mount(PlatformMarketsView);
    await flushPromises();

    expect(
      wrapper.get('[data-testid="returned-market-reindex-notice"]').text(),
    ).toContain("逢甲夜市");
    expect(
      wrapper.get('[data-testid="returned-market-reindex-notice"]').text(),
    ).toContain("重建搜尋索引");

    await wrapper
      .get('[data-testid="returned-market-reindex"]')
      .trigger("click");
    await flushPromises();

    expect(discoveryService.reindex).toHaveBeenCalledOnce();
    expect(marketsService.listPlatformReadiness).toHaveBeenCalledTimes(2);
    expect(marketsService.listAreaReadiness).toHaveBeenCalledTimes(2);
    expect(discoveryService.getIndexStatus).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenLastCalledWith({
      query: {
        areaCity: "台中市",
        areaDistrict: "西屯區",
      },
    });
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

  it("downloads a vendor import worklist for currently visible setup gaps", async () => {
    vi.mocked(marketsService.listPlatformReadiness).mockResolvedValueOnce([
      {
        id: "market-empty",
        slug: "empty-market",
        name: "空白夜市",
        type: "night_market",
        city: "台中市",
        district: "西屯區",
        vendorCount: 0,
        catalogCoverage: {
          searchableProductCount: 0,
          publicServiceCount: 0,
          vendorsWithSearchableProducts: 0,
          vendorsMissingSearchableProducts: 0,
          vendorsWithPublicServices: 0,
          vendorsMissingPublicServices: 0,
          vendorsMissingStallNumbers: 0,
          vendorsMissingSearchEntrypoints: 0,
          missingProductVendors: [],
          missingServiceVendors: [],
          missingStallNumberVendors: [],
          missingSearchEntrypointVendors: [],
        },
        publicReadiness: {
          ready: false,
          score: 40,
          completedCount: 2,
          totalCount: 7,
          issues: [{ key: "vendors", severity: "required" }],
        },
      },
    ]);
    const wrapper = mount(PlatformMarketsView);
    await flushPromises();

    const exportButton = wrapper.get(
      '[data-testid="export-vendor-import-worklist"]',
    );
    expect(exportButton.attributes("disabled")).toBeUndefined();

    await exportButton.trigger("click");

    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("text/csv;charset=utf-8;");
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:market-catalog-gaps");
  });

  it("exports market-level gaps even when no vendor gap rows exist", async () => {
    vi.mocked(marketsService.listPlatformReadiness).mockResolvedValueOnce([
      {
        id: "market-empty",
        slug: "empty-market",
        name: "空白夜市",
        type: "night_market",
        city: "台中市",
        district: "西屯區",
        vendorCount: 0,
        catalogCoverage: {
          searchableProductCount: 0,
          publicServiceCount: 0,
          vendorsWithSearchableProducts: 0,
          vendorsMissingSearchableProducts: 0,
          vendorsWithPublicServices: 0,
          vendorsMissingPublicServices: 0,
          vendorsMissingStallNumbers: 0,
          vendorsMissingSearchEntrypoints: 0,
          missingProductVendors: [],
          missingServiceVendors: [],
          missingStallNumberVendors: [],
          missingSearchEntrypointVendors: [],
        },
        publicReadiness: {
          ready: false,
          score: 40,
          completedCount: 2,
          totalCount: 7,
          issues: [{ key: "vendors", severity: "required" }],
        },
      },
    ]);
    const wrapper = mount(PlatformMarketsView);
    await flushPromises();

    const exportButton = wrapper.get('[data-testid="export-catalog-gaps"]');
    expect(exportButton.attributes("disabled")).toBeUndefined();

    await exportButton.trigger("click");

    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("text/csv;charset=utf-8;");
    expect(click).toHaveBeenCalledOnce();
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

  it("rebuilds the discovery search index from platform operations", async () => {
    const wrapper = mount(PlatformMarketsView);
    await flushPromises();

    await wrapper.get('[data-testid="discovery-reindex"]').trigger("click");
    await flushPromises();

    expect(discoveryService.reindex).toHaveBeenCalledOnce();
    expect(marketsService.listPlatformReadiness).toHaveBeenCalledTimes(2);
    expect(marketsService.listAreaReadiness).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("已重建 12 筆商品索引");
    expect(wrapper.text()).toContain("4 間店鋪");
    expect(wrapper.text()).toContain("250ms");
  });

  it("shows discovery index status for operations", async () => {
    const wrapper = mount(PlatformMarketsView);
    await flushPromises();

    const status = wrapper.get('[data-testid="discovery-index-status"]');
    expect(discoveryService.getIndexStatus).toHaveBeenCalledOnce();
    expect(status.text()).toContain("1779870000000");
    expect(status.text()).toContain("10 / 12");
    expect(status.text()).toContain("4");
  });

  it("imports vendors into the selected market from JSON", async () => {
    vi.mocked(marketsService.importVendors).mockResolvedValue({
      createdRestaurants: 1,
      attachedVendors: 2,
      skipped: 1,
      issueCount: 1,
      blockingIssueCount: 1,
      warningIssueCount: 0,
      publicReadiness: {
        ready: false,
        score: 71,
        completedCount: 5,
        totalCount: 7,
        issues: [{ key: "products", severity: "required" }],
      },
      catalogReadiness: {
        searchableProductCount: 0,
        publicServiceCount: 0,
        vendorsWithSearchableProducts: 0,
        vendorsMissingSearchableProducts: 1,
        vendorsWithPublicServices: 0,
        vendorsMissingPublicServices: 1,
        vendorsMissingSearchEntrypoints: 1,
        missingProductVendors: [
          {
            restaurantId: "imported-vendor-1",
            name: "匯入缺商品攤",
            stallNumber: "B-01",
          },
        ],
        missingServiceVendors: [
          {
            restaurantId: "imported-vendor-1",
            name: "匯入缺商品攤",
            stallNumber: "B-01",
          },
        ],
        missingSearchEntrypointVendors: [
          {
            restaurantId: "imported-vendor-1",
            name: "匯入缺商品攤",
            stallNumber: "B-01",
          },
        ],
      },
      issues: [
        {
          index: 1,
          code: "duplicate_in_payload",
          severity: "blocking",
          message: "Vendor appears more than once in this import payload",
          restaurantName: "新匯入店鋪",
        },
      ],
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
    expect(wrapper.text()).toContain("略過 1 筆");
    expect(
      wrapper.get('[data-testid="vendor-import-result-issues"]').text(),
    ).toContain("新匯入店鋪");
    const catalogGaps = wrapper.get(
      '[data-testid="vendor-import-catalog-gaps"]',
    );
    expect(catalogGaps.text()).toContain("缺商品");
    expect(catalogGaps.text()).toContain("缺服務");
    expect(catalogGaps.text()).toContain("缺搜尋入口");
    expect(catalogGaps.text()).toContain("匯入缺商品攤 (B-01)");

    await wrapper
      .get('[data-testid="vendor-import-manage-products-imported-vendor-1"]')
      .trigger("click");

    expect(selectRestaurant).toHaveBeenCalledWith(
      "imported-vendor-1",
      "匯入缺商品攤",
    );
    expect(push).toHaveBeenCalledWith({
      name: "Menu",
      query: {
        source: "market-gap",
        gap: "products",
        marketName: "逢甲夜市",
        marketSlug: "fengjia",
        areaCity: "台中市",
        areaDistrict: "西屯區",
      },
    });
    expect(wrapper.text()).toContain("公開頁狀態： 公開頁完整度 71%");
  });

  it("dry-runs vendor imports before committing them", async () => {
    vi.mocked(marketsService.importVendors).mockResolvedValue({
      dryRun: true,
      wouldCreateRestaurants: 1,
      wouldAttachVendors: 1,
      skipped: 1,
      issueCount: 1,
      blockingIssueCount: 1,
      warningIssueCount: 0,
      publicReadiness: {
        ready: false,
        score: 71,
        completedCount: 5,
        totalCount: 7,
        issues: [{ key: "products", severity: "required" }],
      },
      issues: [
        {
          index: 0,
          code: "already_attached",
          severity: "blocking",
          message: "Restaurant already belongs to this market",
          restaurantId: "restaurant-1",
          restaurantName: "既有雞排",
        },
      ],
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
          '"restaurant-1",,,,"A-01",true',
          ',"CSV 匯入店鋪","台中市西屯區文華路 100 號","西屯區","C-01",true',
        ].join("\n"),
      );
    await wrapper.get('[data-testid="vendor-import-dry-run"]').trigger("click");
    await flushPromises();

    expect(marketsService.importVendors).toHaveBeenCalledWith(
      "market-1",
      [
        {
          restaurantId: "restaurant-1",
          stallNumber: "A-01",
          isPrimary: true,
        },
        {
          name: "CSV 匯入店鋪",
          address: "台中市西屯區文華路 100 號",
          district: "西屯區",
          stallNumber: "C-01",
          isPrimary: true,
        },
      ],
      { dryRun: true },
    );
    expect(marketsService.listPlatformReadiness).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("預檢結果");
    expect(wrapper.text()).toContain("會建立 1 間");
    expect(wrapper.text()).toContain("預估公開頁狀態： 公開頁完整度 71%");
    expect(wrapper.text()).toContain("阻擋 1");
    expect(wrapper.text()).toContain("既有雞排");
  });

  it("imports markets from CSV and refreshes platform readiness", async () => {
    vi.mocked(marketsService.createMarket).mockResolvedValue({
      id: "market-3",
      slug: "miaokou",
      name: "基隆廟口夜市",
      type: "night_market",
      city: "基隆市",
      district: "仁愛區",
    });
    const wrapper = mount(PlatformMarketsView);
    await flushPromises();

    await wrapper
      .get('[data-testid="market-import-text"]')
      .setValue(
        [
          "slug,name,type,city,district,address,latitude,longitude,tags",
          '"miaokou","基隆廟口夜市","night_market","基隆市","仁愛區","仁三路",25.128,121.743,"夜市,海港"',
        ].join("\n"),
      );
    expect(wrapper.text()).toContain("已解析 1 筆市場");

    await wrapper.get('[data-testid="market-import-submit"]').trigger("click");
    await flushPromises();

    expect(marketsService.createMarket).toHaveBeenCalledWith({
      slug: "miaokou",
      name: "基隆廟口夜市",
      type: "night_market",
      city: "基隆市",
      district: "仁愛區",
      address: "仁三路",
      latitude: 25.128,
      longitude: 121.743,
      tags: ["夜市", "海港"],
    });
    expect(marketsService.listPlatformReadiness).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("已建立 1 個市場");
    expect(wrapper.text()).toContain("下一步：編輯市場並批次匯入店鋪");

    await wrapper
      .get('[data-testid="market-import-edit-miaokou"]')
      .trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("編輯公開資料：基隆廟口夜市");
    expect(wrapper.text()).toContain("批次匯入店鋪");
    expect(marketsService.listMarketVendors).toHaveBeenLastCalledWith(
      "miaokou",
      {
        q: undefined,
        page: 1,
        limit: 10,
      },
    );
  });

  it("reports per-market import failures without hiding created markets", async () => {
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      vi.mocked(marketsService.createMarket).mockImplementation(
        async (market) => {
          if (market.slug === "created-market") {
            return {
              id: "market-3",
              slug: market.slug,
              name: market.name,
              type: market.type,
              city: market.city,
              district: market.district,
            };
          }

          throw new Error("slug 已存在");
        },
      );
      const wrapper = mount(PlatformMarketsView);
      await flushPromises();

      await wrapper
        .get('[data-testid="market-import-text"]')
        .setValue(
          [
            "slug,name,type,city,district,address,latitude,longitude",
            '"created-market","成功市場","night_market","台中市","西屯區","文華路",24.176,120.646',
            '"existing-market","既有市場","night_market","台中市","西屯區","福星路",24.179,120.645',
          ].join("\n"),
        );

      await wrapper
        .get('[data-testid="market-import-submit"]')
        .trigger("click");
      await flushPromises();

      expect(marketsService.createMarket).toHaveBeenCalledTimes(2);
      expect(marketsService.listPlatformReadiness).toHaveBeenCalledTimes(2);
      expect(wrapper.text()).toContain("已建立 1 個市場");
      expect(wrapper.text()).toContain("匯入失敗 1 筆");
      expect(wrapper.text()).toContain("既有市場");
      expect(wrapper.text()).toContain("slug 已存在");
      expect(
        wrapper.get<HTMLTextAreaElement>('[data-testid="market-import-text"]')
          .element.value,
      ).toContain("existing-market");
      expect(
        wrapper.get<HTMLTextAreaElement>('[data-testid="market-import-text"]')
          .element.value,
      ).not.toContain("created-market");
    } finally {
      errorSpy.mockRestore();
    }
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

  it("imports only rows for the selected market from a vendor worklist CSV", async () => {
    vi.mocked(marketsService.importVendors).mockResolvedValue({
      createdRestaurants: 0,
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
          "marketId,marketSlug,marketName,restaurantId,name,address,district,stallNumber,isPrimary",
          "market-1,fengjia,逢甲夜市,restaurant-1,,,,A-01,true",
          "market-2,yizhong,一中商圈,restaurant-2,,,,B-01,true",
        ].join("\n"),
      );
    expect(wrapper.text()).toContain("已解析 1 筆店鋪");

    await wrapper.get('[data-testid="vendor-import-submit"]').trigger("click");
    await flushPromises();

    expect(marketsService.importVendors).toHaveBeenCalledWith("market-1", [
      {
        restaurantId: "restaurant-1",
        stallNumber: "A-01",
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

  it("prompts reindex after updating attached vendor market metadata", async () => {
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
          stallNumber: "",
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
    const wrapper = mount(PlatformMarketsView);
    await flushPromises();

    const editButton = wrapper
      .findAll("button")
      .find((button) => button.text() === "編輯");
    expect(editButton).toBeDefined();
    await editButton!.trigger("click");
    await flushPromises();

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

    expect(
      wrapper.get('[data-testid="market-vendor-reindex-next-step"]').text(),
    ).toContain("攤位號或店鋪關聯已更新");
    expect(
      wrapper.get('[data-testid="market-vendor-reindex-next-step"]').text(),
    ).toContain("重建搜尋索引");

    await wrapper.get('[data-testid="market-vendor-reindex"]').trigger("click");
    await flushPromises();

    expect(discoveryService.reindex).toHaveBeenCalledOnce();
    expect(marketsService.listPlatformReadiness).toHaveBeenCalledTimes(3);
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
