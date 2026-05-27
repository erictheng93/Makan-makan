// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import RestaurantServiceItemsManager from "./RestaurantServiceItemsManager.vue";
import { restaurantServiceItemsService } from "@/services/restaurantServiceItemsService";

vi.mock("@/services/restaurantServiceItemsService", () => ({
  restaurantServiceItemsService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

describe("RestaurantServiceItemsManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(restaurantServiceItemsService.list).mockResolvedValue([]);
  });

  it("loads and creates restaurant service items", async () => {
    vi.mocked(restaurantServiceItemsService.list)
      .mockResolvedValueOnce([
        {
          id: 1,
          restaurantId: "restaurant-1",
          name: "預約外送",
          serviceType: "delivery",
          priceLabel: "依距離報價",
          requiresBooking: true,
          sortOrder: 1,
          isActive: true,
          isPublic: true,
          createdAt: "",
          updatedAt: "",
        },
      ])
      .mockResolvedValueOnce([]);
    vi.mocked(restaurantServiceItemsService.create).mockResolvedValueOnce({
      id: 2,
      restaurantId: "restaurant-1",
      name: "代客切水果",
      serviceType: "general",
      requiresBooking: false,
      sortOrder: 0,
      isActive: true,
      isPublic: true,
      createdAt: "",
      updatedAt: "",
    });

    const wrapper = mount(RestaurantServiceItemsManager, {
      props: { restaurantId: "restaurant-1" },
    });

    await flushPromises();

    expect(restaurantServiceItemsService.list).toHaveBeenCalledWith(
      "restaurant-1",
    );
    expect(wrapper.text()).toContain("預約外送");

    await wrapper
      .get('[data-testid="service-name-input"]')
      .setValue("代客切水果");
    await wrapper.get("form").trigger("submit.prevent");

    expect(restaurantServiceItemsService.create).toHaveBeenCalledWith(
      "restaurant-1",
      expect.objectContaining({
        name: "代客切水果",
        serviceType: "general",
        isPublic: true,
        isActive: true,
      }),
    );
  });

  it("updates and removes existing service items", async () => {
    const serviceItem = {
      id: 1,
      restaurantId: "restaurant-1",
      name: "代客切水果",
      description: "現場代切並分裝",
      serviceType: "general" as const,
      priceLabel: "依份量報價",
      requiresBooking: false,
      sortOrder: 0,
      isActive: true,
      isPublic: true,
      createdAt: "",
      updatedAt: "",
    };
    vi.mocked(restaurantServiceItemsService.list)
      .mockResolvedValueOnce([serviceItem])
      .mockResolvedValueOnce([serviceItem]);
    vi.mocked(restaurantServiceItemsService.update).mockResolvedValueOnce({
      id: 1,
      restaurantId: "restaurant-1",
      name: "預約切水果",
      serviceType: "general",
      requiresBooking: false,
      sortOrder: 0,
      isActive: true,
      isPublic: true,
      createdAt: "",
      updatedAt: "",
    });
    vi.mocked(restaurantServiceItemsService.remove).mockResolvedValueOnce();

    const wrapper = mount(RestaurantServiceItemsManager, {
      props: { restaurantId: "restaurant-1" },
    });

    await flushPromises();
    await wrapper.get('[data-testid="edit-service-1"]').trigger("click");
    await wrapper
      .get('[data-testid="service-name-input"]')
      .setValue("預約切水果");
    await wrapper.get('[data-testid="service-description-input"]').setValue("");
    await wrapper.get('[data-testid="service-price-label-input"]').setValue("");
    await wrapper.get("form").trigger("submit.prevent");

    expect(restaurantServiceItemsService.update).toHaveBeenCalledWith(
      "restaurant-1",
      1,
      expect.objectContaining({
        name: "預約切水果",
        description: null,
        priceLabel: null,
      }),
    );

    await wrapper.get('[data-testid="delete-service-1"]').trigger("click");

    expect(restaurantServiceItemsService.remove).toHaveBeenCalledWith(
      "restaurant-1",
      1,
    );
  });

  it("imports service items from CSV", async () => {
    vi.mocked(restaurantServiceItemsService.create).mockResolvedValue({
      id: 2,
      restaurantId: "restaurant-1",
      name: "代客切水果",
      serviceType: "general",
      requiresBooking: false,
      sortOrder: 1,
      isActive: true,
      isPublic: true,
      createdAt: "",
      updatedAt: "",
    });
    const wrapper = mount(RestaurantServiceItemsManager, {
      props: { restaurantId: "restaurant-1" },
    });

    await flushPromises();
    await wrapper
      .get('[data-testid="service-import-csv"]')
      .setValue(
        [
          "name,serviceType,description,priceCents,durationMinutes,requiresBooking,tags,sortOrder,isActive,isPublic",
          '"代客切水果",general,"現場代切並分裝",5000,15,false,"水果;分裝",1,true,true',
        ].join("\n"),
      );
    expect(wrapper.text()).toContain("已解析 1 筆服務");

    await wrapper.get('[data-testid="service-import-submit"]').trigger("click");
    await flushPromises();

    expect(restaurantServiceItemsService.create).toHaveBeenCalledWith(
      "restaurant-1",
      expect.objectContaining({
        name: "代客切水果",
        serviceType: "general",
        priceCents: 5000,
        durationMinutes: 15,
        requiresBooking: false,
        tags: ["水果", "分裝"],
        keywords: "水果 分裝",
        sortOrder: 1,
        isActive: true,
        isPublic: true,
      }),
    );
    expect(restaurantServiceItemsService.list).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("已成功匯入 1 筆服務");
  });

  it("shows market gap context and reindex next step after service import", async () => {
    vi.mocked(restaurantServiceItemsService.create).mockResolvedValue({
      id: 2,
      restaurantId: "restaurant-1",
      name: "代客切水果",
      serviceType: "general",
      requiresBooking: false,
      sortOrder: 1,
      isActive: true,
      isPublic: true,
      createdAt: "",
      updatedAt: "",
    });
    const wrapper = mount(RestaurantServiceItemsManager, {
      props: {
        restaurantId: "restaurant-1",
        isMarketServiceGapContext: true,
        marketGapName: "逢甲夜市",
      },
    });

    await flushPromises();

    expect(
      wrapper.get('[data-testid="market-service-gap-context"]').text(),
    ).toContain("逢甲夜市");

    await wrapper
      .get('[data-testid="service-import-csv"]')
      .setValue(
        [
          "name,serviceType,description,requiresBooking,sortOrder,isActive,isPublic",
          '"代客切水果",general,"現場代切並分裝",false,1,true,true',
        ].join("\n"),
      );
    await wrapper.get('[data-testid="service-import-submit"]').trigger("click");
    await flushPromises();

    expect(
      wrapper.get('[data-testid="market-service-gap-next-step"]').text(),
    ).toContain("重建搜尋索引");
    expect(
      wrapper.get('[data-testid="market-service-gap-next-step"]').text(),
    ).toContain("逢甲夜市");
  });

  it("shows market gap reindex next step after manually adding a service", async () => {
    vi.mocked(restaurantServiceItemsService.create).mockResolvedValue({
      id: 2,
      restaurantId: "restaurant-1",
      name: "代客切水果",
      serviceType: "general",
      requiresBooking: false,
      sortOrder: 0,
      isActive: true,
      isPublic: true,
      createdAt: "",
      updatedAt: "",
    });
    const wrapper = mount(RestaurantServiceItemsManager, {
      props: {
        restaurantId: "restaurant-1",
        isMarketServiceGapContext: true,
        marketGapName: "逢甲夜市",
      },
    });

    await flushPromises();
    await wrapper
      .get('[data-testid="service-name-input"]')
      .setValue("代客切水果");
    await wrapper.get("form").trigger("submit.prevent");
    await flushPromises();

    expect(restaurantServiceItemsService.create).toHaveBeenCalledWith(
      "restaurant-1",
      expect.objectContaining({
        name: "代客切水果",
        isPublic: true,
        isActive: true,
      }),
    );
    expect(
      wrapper.get('[data-testid="market-service-gap-next-step"]').text(),
    ).toContain("重建搜尋索引");
  });
});

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}
