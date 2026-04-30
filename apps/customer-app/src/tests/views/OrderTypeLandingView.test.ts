import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises, VueWrapper } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import OrderTypeLandingView from "@/views/OrderTypeLandingView.vue";
import { menuApi } from "@/services/menuApi";
import { useShopCartStore } from "@/stores/shopCart";
import {
  restaurantFactory,
  resetAllFactories,
} from "@makanmakan/testing-utils";
import { PlanType, Status } from "@makanmakan/shared-types";
import type { Restaurant } from "@makanmakan/shared-types";

// Mock menuApi
vi.mock("@/services/menuApi", () => ({
  menuApi: {
    getRestaurant: vi.fn(),
  },
}));

// Mock vue-router
const mockPush = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
  useRoute: vi.fn(() => ({ query: {} })),
}));

// Build restaurant mocks from factory
const baseRestaurant = restaurantFactory.build({
  overrides: {
    name: "測試餐廳",
    description: "美味的測試餐廳",
    logoUrl: null,
  },
});

const mockRestaurant: Restaurant = {
  id: "rest-001",
  name: baseRestaurant.name,
  description: baseRestaurant.description,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  status: Status.ACTIVE,
  planType: PlanType.BASIC,
  logoUrl: undefined,
  settings: {
    enableDineIn: false,
    enableTakeaway: true,
    enableDelivery: false,
    deliveryFee: 0,
  },
};

const mockRestaurantWithLogo = {
  ...mockRestaurant,
  logoUrl: "https://example.com/logo.png",
};

const mockRestaurantWithDelivery = {
  ...mockRestaurant,
  settings: {
    enableDineIn: false,
    enableTakeaway: true,
    enableDelivery: true,
    deliveryFee: 5000,
  },
};

describe("OrderTypeLandingView", () => {
  let wrapper: VueWrapper<any>;

  beforeEach(() => {
    resetAllFactories();
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });

  const mountComponent = (props = { restaurantId: "rest-001" }) => {
    return mount(OrderTypeLandingView, { props });
  };

  describe("載入狀態", () => {
    it("should show loading spinner initially", () => {
      // Keep the promise pending so loading state persists
      vi.mocked(menuApi.getRestaurant).mockReturnValue(new Promise(() => {}));
      wrapper = mountComponent();

      const spinner = wrapper.find(".animate-spin");
      expect(spinner.exists()).toBe(true);
    });

    it("should hide loading spinner after data is fetched", async () => {
      vi.mocked(menuApi.getRestaurant).mockResolvedValue(mockRestaurant);
      wrapper = mountComponent();

      await flushPromises();

      const spinner = wrapper.find(".animate-spin");
      expect(spinner.exists()).toBe(false);
    });
  });

  describe("錯誤狀態", () => {
    it("should show error message when API fails", async () => {
      vi.mocked(menuApi.getRestaurant).mockRejectedValue(
        new Error("Network error"),
      );
      wrapper = mountComponent();

      await flushPromises();

      expect(wrapper.text()).toContain("Unable to load restaurant information");
    });

    it("should show retry button on error", async () => {
      vi.mocked(menuApi.getRestaurant).mockRejectedValue(
        new Error("Network error"),
      );
      wrapper = mountComponent();

      await flushPromises();

      const retryButton = wrapper.find("button");
      expect(retryButton.exists()).toBe(true);
      expect(retryButton.text()).toContain("Retry");
    });

    it("should retry fetching restaurant when retry button is clicked", async () => {
      vi.mocked(menuApi.getRestaurant)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(mockRestaurant);

      wrapper = mountComponent();
      await flushPromises();

      // Should be in error state
      expect(wrapper.text()).toContain("Unable to load restaurant information");

      // Click retry
      const retryButton = wrapper.find("button");
      await retryButton.trigger("click");
      await flushPromises();

      // Should now show restaurant data
      expect(wrapper.text()).toContain("測試餐廳");
    });
  });

  describe("成功狀態", () => {
    it("should display restaurant name after successful fetch", async () => {
      vi.mocked(menuApi.getRestaurant).mockResolvedValue(mockRestaurant);
      wrapper = mountComponent();

      await flushPromises();

      expect(wrapper.text()).toContain("測試餐廳");
    });

    it("should show placeholder icon when no logo", async () => {
      vi.mocked(menuApi.getRestaurant).mockResolvedValue(mockRestaurant);
      wrapper = mountComponent();

      await flushPromises();

      // No img element should be in the logo area
      const img = wrapper.find("img");
      expect(img.exists()).toBe(false);

      // Placeholder should exist with the fork-and-plate emoji
      expect(wrapper.text()).toContain("🍽️");
    });

    it("should show restaurant logo when available", async () => {
      vi.mocked(menuApi.getRestaurant).mockResolvedValue(
        mockRestaurantWithLogo,
      );
      wrapper = mountComponent();

      await flushPromises();

      const img = wrapper.find("img");
      expect(img.exists()).toBe(true);
      expect(img.attributes("src")).toBe("https://example.com/logo.png");
      expect(img.attributes("alt")).toBe("測試餐廳");
    });
  });

  describe("取餐方式選擇", () => {
    it("should show takeaway button by default", async () => {
      vi.mocked(menuApi.getRestaurant).mockResolvedValue(mockRestaurant);
      wrapper = mountComponent();

      await flushPromises();

      expect(wrapper.text()).toContain("Takeaway");
    });

    it("should hide delivery button when enableDelivery is false", async () => {
      vi.mocked(menuApi.getRestaurant).mockResolvedValue(mockRestaurant);
      wrapper = mountComponent();

      await flushPromises();

      expect(wrapper.text()).not.toContain("Delivery");
    });

    it("should show delivery button when enableDelivery is true", async () => {
      vi.mocked(menuApi.getRestaurant).mockResolvedValue(
        mockRestaurantWithDelivery,
      );
      wrapper = mountComponent();

      await flushPromises();

      expect(wrapper.text()).toContain("Delivery");
    });

    it("should select takeaway by default", async () => {
      vi.mocked(menuApi.getRestaurant).mockResolvedValue(
        mockRestaurantWithDelivery,
      );
      wrapper = mountComponent();

      await flushPromises();

      // Takeaway button should have the selected state checkmark icon
      const buttons = wrapper.findAll("button");
      const takeawayBtn = buttons.find((btn) =>
        btn.text().includes("Takeaway"),
      );
      expect(takeawayBtn?.find("svg").exists()).toBe(true);
    });

    it("should update selection when delivery button is clicked", async () => {
      vi.mocked(menuApi.getRestaurant).mockResolvedValue(
        mockRestaurantWithDelivery,
      );
      wrapper = mountComponent();

      await flushPromises();

      const buttons = wrapper.findAll("button");
      const deliveryBtn = buttons.find((btn) =>
        btn.text().includes("Delivery"),
      );
      await deliveryBtn?.trigger("click");

      // After clicking delivery, it should show the checkmark icon (selected state)
      expect(deliveryBtn?.find("svg").exists()).toBe(true);
    });
  });

  describe("繼續按鈕", () => {
    it("should navigate to ShopPhoneVerification on continue", async () => {
      vi.mocked(menuApi.getRestaurant).mockResolvedValue(mockRestaurant);
      wrapper = mountComponent();

      await flushPromises();

      const continueButton = wrapper.find('[data-testid="continue-btn"]');
      await continueButton.trigger("click");

      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "ShopPhoneVerification",
          params: { restaurantId: "rest-001" },
        }),
      );
    });

    it("should call setFulfillmentType on store when continuing", async () => {
      vi.mocked(menuApi.getRestaurant).mockResolvedValue(mockRestaurant);
      wrapper = mountComponent();

      await flushPromises();

      const store = useShopCartStore();
      const setFulfillmentTypeSpy = vi.spyOn(store, "setFulfillmentType");

      const continueButton = wrapper.find('[data-testid="continue-btn"]');
      await continueButton.trigger("click");

      expect(setFulfillmentTypeSpy).toHaveBeenCalledWith("takeaway");
    });

    it("should call setDeliveryFee when delivery is selected and fee is set", async () => {
      vi.mocked(menuApi.getRestaurant).mockResolvedValue(
        mockRestaurantWithDelivery,
      );
      wrapper = mountComponent();

      await flushPromises();

      const store = useShopCartStore();

      // Select delivery
      const buttons = wrapper.findAll("button");
      const deliveryBtn = buttons.find((btn) =>
        btn.text().includes("Delivery"),
      );
      await deliveryBtn?.trigger("click");
      await wrapper.vm.$nextTick();

      // Click continue
      const continueButton = wrapper.find('[data-testid="continue-btn"]');
      await continueButton.trigger("click");
      await wrapper.vm.$nextTick();

      // Verify the delivery fee was set on the store state
      expect(store.deliveryFee).toBe(5000);
    });
  });
});
