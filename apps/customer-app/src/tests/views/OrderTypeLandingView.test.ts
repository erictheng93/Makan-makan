import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises, VueWrapper } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import OrderTypeLandingView from "@/views/OrderTypeLandingView.vue";
import { menuApi } from "@/services/menuApi";
import { useShopCartStore } from "@/stores/shopCart";

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

const mockRestaurant = {
  id: "rest-001",
  name: "測試餐廳",
  description: "美味的測試餐廳",
  logo: null,
  settings: {
    enableDelivery: false,
    deliveryFee: 0,
  },
};

const mockRestaurantWithLogo = {
  ...mockRestaurant,
  logo: "https://example.com/logo.png",
};

const mockRestaurantWithDelivery = {
  ...mockRestaurant,
  settings: {
    enableDelivery: true,
    deliveryFee: 5000,
  },
};

describe("OrderTypeLandingView", () => {
  let wrapper: VueWrapper<any>;

  beforeEach(() => {
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
      vi.mocked(menuApi.getRestaurant).mockResolvedValue(mockRestaurant as any);
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

      expect(wrapper.text()).toContain("無法載入餐廳資訊");
    });

    it("should show retry button on error", async () => {
      vi.mocked(menuApi.getRestaurant).mockRejectedValue(
        new Error("Network error"),
      );
      wrapper = mountComponent();

      await flushPromises();

      const retryButton = wrapper.find("button");
      expect(retryButton.exists()).toBe(true);
      expect(retryButton.text()).toContain("重試");
    });

    it("should retry fetching restaurant when retry button is clicked", async () => {
      vi.mocked(menuApi.getRestaurant)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(mockRestaurant as any);

      wrapper = mountComponent();
      await flushPromises();

      // Should be in error state
      expect(wrapper.text()).toContain("無法載入餐廳資訊");

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
      vi.mocked(menuApi.getRestaurant).mockResolvedValue(mockRestaurant as any);
      wrapper = mountComponent();

      await flushPromises();

      expect(wrapper.text()).toContain("測試餐廳");
    });

    it("should show placeholder icon when no logo", async () => {
      vi.mocked(menuApi.getRestaurant).mockResolvedValue(mockRestaurant as any);
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
        mockRestaurantWithLogo as any,
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
      vi.mocked(menuApi.getRestaurant).mockResolvedValue(mockRestaurant as any);
      wrapper = mountComponent();

      await flushPromises();

      expect(wrapper.text()).toContain("外帶 Takeaway");
    });

    it("should hide delivery button when enableDelivery is false", async () => {
      vi.mocked(menuApi.getRestaurant).mockResolvedValue(mockRestaurant as any);
      wrapper = mountComponent();

      await flushPromises();

      expect(wrapper.text()).not.toContain("外送 Delivery");
    });

    it("should show delivery button when enableDelivery is true", async () => {
      vi.mocked(menuApi.getRestaurant).mockResolvedValue(
        mockRestaurantWithDelivery as any,
      );
      wrapper = mountComponent();

      await flushPromises();

      expect(wrapper.text()).toContain("外送 Delivery");
    });

    it("should select takeaway by default", async () => {
      vi.mocked(menuApi.getRestaurant).mockResolvedValue(
        mockRestaurantWithDelivery as any,
      );
      wrapper = mountComponent();

      await flushPromises();

      // Takeaway button should have selected styling (green border)
      const buttons = wrapper.findAll("button");
      const takeawayBtn = buttons.find((btn) =>
        btn.text().includes("外帶 Takeaway"),
      );
      expect(takeawayBtn?.classes()).toContain("border-green-500");
    });

    it("should update selection when delivery button is clicked", async () => {
      vi.mocked(menuApi.getRestaurant).mockResolvedValue(
        mockRestaurantWithDelivery as any,
      );
      wrapper = mountComponent();

      await flushPromises();

      const buttons = wrapper.findAll("button");
      const deliveryBtn = buttons.find((btn) =>
        btn.text().includes("外送 Delivery"),
      );
      await deliveryBtn?.trigger("click");

      // Delivery button should now have selected styling (amber border)
      expect(deliveryBtn?.classes()).toContain("border-amber-500");
    });
  });

  describe("繼續按鈕", () => {
    it("should navigate to ShopPhoneVerification on continue", async () => {
      vi.mocked(menuApi.getRestaurant).mockResolvedValue(mockRestaurant as any);
      wrapper = mountComponent();

      await flushPromises();

      const continueButton = wrapper.find("button.bg-indigo-600");
      await continueButton.trigger("click");

      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "ShopPhoneVerification",
          params: { restaurantId: "rest-001" },
        }),
      );
    });

    it("should call setFulfillmentType on store when continuing", async () => {
      vi.mocked(menuApi.getRestaurant).mockResolvedValue(mockRestaurant as any);
      wrapper = mountComponent();

      await flushPromises();

      const store = useShopCartStore();
      const setFulfillmentTypeSpy = vi.spyOn(store, "setFulfillmentType");

      const continueButton = wrapper.find("button.bg-indigo-600");
      await continueButton.trigger("click");

      expect(setFulfillmentTypeSpy).toHaveBeenCalledWith("takeaway");
    });

    it("should call setDeliveryFee when delivery is selected and fee is set", async () => {
      vi.mocked(menuApi.getRestaurant).mockResolvedValue(
        mockRestaurantWithDelivery as any,
      );
      wrapper = mountComponent();

      await flushPromises();

      const store = useShopCartStore();
      const setDeliveryFeeSpy = vi.spyOn(store, "setDeliveryFee");

      // Select delivery
      const buttons = wrapper.findAll("button");
      const deliveryBtn = buttons.find((btn) =>
        btn.text().includes("外送 Delivery"),
      );
      await deliveryBtn?.trigger("click");

      // Click continue
      const continueButton = wrapper.find("button.bg-indigo-600");
      await continueButton.trigger("click");

      expect(setDeliveryFeeSpy).toHaveBeenCalledWith(5000);
    });
  });
});
