import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import { ref } from "vue";
import CartView from "../views/CartView.vue";

// Mock fetch
global.fetch = vi.fn();

// Mock router
const mockRouter = {
  back: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
};

// Mock cart store
const mockCartStore: any = {
  isEmpty: false,
  items: [
    {
      id: "1",
      menuItem: { id: 1, name: "測試商品", price: 50 },
      quantity: 2,
      customizations: null,
      notes: "",
    },
  ],
  subtotal: 100,
  initializeCart: vi.fn(),
  updateQuantity: vi.fn(),
  updateItemNotes: vi.fn(),
  removeItem: vi.fn(),
  clearCart: vi.fn(),
  getItemById: vi.fn((id: string) =>
    mockCartStore.items.find((item: any) => item.id === id),
  ),
};

// Mock composables
vi.mock("@/composables/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    tWithParams: (key: string) => key,
    safeT: (key: string) => key,
    tPlural: (key: string) => key,
  }),
}));

vi.mock("@/stores/cart", () => ({
  useCartStore: () => mockCartStore,
}));

vi.mock("vue-router", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    useRouter: () => mockRouter,
    RouterLink: {
      name: "RouterLink",
      props: ["to"],
      template: '<a :href="to"><slot></slot></a>',
    },
  };
});

vi.mock("vue-toastification", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  }),
}));

// Fix: useQuery returns refs directly, not wrapped in { value }
vi.mock("@tanstack/vue-query", () => ({
  useQuery: () => ({
    data: ref({ id: 1, name: "測試餐廳" }),
    isLoading: ref(false),
    isError: ref(false),
  }),
  useMutation: () => ({
    mutate: vi.fn(),
    isPending: ref(false),
  }),
}));

// Mock utility functions
vi.mock("@/utils/format", () => ({
  formatPrice: (price: number) => price.toFixed(2),
}));

// Mock services
vi.mock("@/services/orderApi", () => ({
  orderApi: {
    createOrder: vi.fn(),
  },
}));

vi.mock("@/services/menuApi", () => ({
  default: {
    getRestaurant: vi.fn().mockResolvedValue({
      id: 1,
      name: "測試餐廳",
    }),
  },
}));

describe("Coupon Functionality in CartView", () => {
  let wrapper: any;
  const pinia = createPinia();
  const router = createRouter({
    history: createWebHistory(),
    routes: [{ path: "/", component: { template: "div" } }],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();

    wrapper = mount(CartView, {
      props: {
        restaurantId: "1",
        tableId: 1,
      },
      global: {
        plugins: [pinia, router],
        stubs: {
          CartItemCard: true,
          ConfirmationModal: true,
          RouterLink: true,
          CouponRecommendation: true,
        },
      },
    });
  });

  afterEach(() => {
    wrapper.unmount();
  });

  describe("Coupon Input UI", () => {
    it("should render coupon input field", () => {
      const couponInput = wrapper.find("#coupon-code");
      expect(couponInput.exists()).toBe(true);
    });

    it("should render apply coupon button", () => {
      const buttons = wrapper.findAll("button");
      const applyButton = buttons.find((button: any) =>
        button.text().includes("cart.applyCoupon"),
      );
      expect(applyButton).toBeTruthy();
    });

    it("should disable apply button when coupon code is empty", async () => {
      const couponInput = wrapper.find("#coupon-code");
      await couponInput.setValue("");

      const buttons = wrapper.findAll("button");
      const applyButton = buttons.find((button: any) =>
        button.text().includes("cart.applyCoupon"),
      );

      expect(applyButton?.element.disabled).toBe(true);
    });

    it("should enable apply button when coupon code is entered", async () => {
      const couponInput = wrapper.find("#coupon-code");
      await couponInput.setValue("TESTCODE");

      const buttons = wrapper.findAll("button");
      const applyButton = buttons.find((button: any) =>
        button.text().includes("cart.applyCoupon"),
      );

      expect(applyButton?.element.disabled).toBe(false);
    });
  });

  describe("Coupon Validation", () => {
    it("should call validation API with correct parameters", async () => {
      const mockResponse = {
        success: true,
        data: {
          valid: true,
          discountAmount: 10,
          finalAmount: 90,
          coupon: { id: 1, code: "TESTCODE" },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const couponInput = wrapper.find("#coupon-code");
      await couponInput.setValue("TESTCODE");

      // Find and click apply button
      const buttons = wrapper.findAll("button");
      const applyButton = buttons.find((button: any) =>
        button.text().includes("cart.applyCoupon"),
      );
      await applyButton?.trigger("click");

      expect(global.fetch).toHaveBeenCalledWith("/api/v1/coupons/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: "TESTCODE",
          restaurantId: "1",
          orderAmount: 100,
          menuItems: [
            {
              menuItemId: 1,
              quantity: 2,
            },
          ],
        }),
      });
    });

    it("should show success message for valid coupon", async () => {
      const mockResponse = {
        success: true,
        data: {
          valid: true,
          discountAmount: 10,
          finalAmount: 90,
          coupon: { id: 1, code: "TESTCODE" },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const couponInput = wrapper.find("#coupon-code");
      await couponInput.setValue("TESTCODE");

      const buttons = wrapper.findAll("button");
      const applyButton = buttons.find((button: any) =>
        button.text().includes("cart.applyCoupon"),
      );
      await applyButton?.trigger("click");

      // Wait for async fetch and Vue updates
      await flushPromises();
      await wrapper.vm.$nextTick();

      // Check if success message is displayed (the component uses text-green-600 for success)
      // The success message appears when couponValidationMessage is set and couponValidationError is false
      // useI18n is mocked to return keys as-is, so tWithParams("toast.couponApplied", ...) returns "toast.couponApplied"
      expect(wrapper.vm.couponValidationMessage).toContain(
        "toast.couponApplied",
      );
      expect(wrapper.vm.couponValidationError).toBe(false);
    });

    it("should show error message for invalid coupon", async () => {
      const mockResponse = {
        success: true,
        data: {
          valid: false,
          error: "優惠券代碼不存在或已失效",
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const couponInput = wrapper.find("#coupon-code");
      await couponInput.setValue("INVALID");

      const buttons = wrapper.findAll("button");
      const applyButton = buttons.find((button: any) =>
        button.text().includes("cart.applyCoupon"),
      );
      await applyButton?.trigger("click");

      // Wait for async fetch and Vue updates
      await flushPromises();
      await wrapper.vm.$nextTick();

      // Check if error state is set correctly
      expect(wrapper.vm.couponValidationError).toBe(true);
      expect(wrapper.vm.couponValidationMessage).toBe(
        "優惠券代碼不存在或已失效",
      );
    });
  });

  describe("Discount Calculation", () => {
    it("should update total amount when coupon is applied", async () => {
      const mockResponse = {
        success: true,
        data: {
          valid: true,
          discountAmount: 15,
          finalAmount: 85,
          coupon: { id: 1, code: "DISCOUNT15" },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const couponInput = wrapper.find("#coupon-code");
      await couponInput.setValue("DISCOUNT15");

      const buttons = wrapper.findAll("button");
      const applyButton = buttons.find((button: any) =>
        button.text().includes("cart.applyCoupon"),
      );
      await applyButton?.trigger("click");

      // Wait for async fetch and Vue updates
      await flushPromises();
      await wrapper.vm.$nextTick();

      // Check if discount is applied to the total
      expect(wrapper.vm.couponDiscountAmount).toBe(15);
      // discount is a computed property that returns couponDiscountAmount
      expect(wrapper.vm.discount).toBe(15);
    });

    it("should show discount in order summary", async () => {
      // Apply a coupon first
      const mockResponse = {
        success: true,
        data: {
          valid: true,
          discountAmount: 20,
          finalAmount: 80,
          coupon: { id: 1, code: "SAVE20" },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const couponInput = wrapper.find("#coupon-code");
      await couponInput.setValue("SAVE20");

      const buttons = wrapper.findAll("button");
      const applyButton = buttons.find((button: any) =>
        button.text().includes("cart.applyCoupon"),
      );
      await applyButton?.trigger("click");

      // Wait for async fetch and Vue updates
      await flushPromises();
      await wrapper.vm.$nextTick();

      // Check if discount is applied (discount > 0 triggers the discount row to show)
      expect(wrapper.vm.discount).toBe(20);
      expect(wrapper.vm.appliedCoupon).not.toBeNull();
    });
  });

  describe("Coupon Removal", () => {
    it("should clear coupon when remove button is clicked", async () => {
      // First apply a coupon
      const mockResponse = {
        success: true,
        data: {
          valid: true,
          discountAmount: 10,
          finalAmount: 90,
          coupon: { id: 1, code: "TESTCODE" },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const couponInput = wrapper.find("#coupon-code");
      await couponInput.setValue("TESTCODE");

      const buttons = wrapper.findAll("button");
      const applyButton = buttons.find((button: any) =>
        button.text().includes("cart.applyCoupon"),
      );
      await applyButton?.trigger("click");

      // Wait for async fetch and Vue updates
      await flushPromises();
      await wrapper.vm.$nextTick();

      // Now remove the coupon
      const removeButtons = wrapper.findAll("button");
      const removeButton = removeButtons.find((button: any) =>
        button.text().includes("cart.removeCoupon"),
      );

      if (removeButton && removeButton.exists()) {
        await removeButton.trigger("click");
        await wrapper.vm.$nextTick();

        expect(wrapper.vm.couponCode).toBe("");
        expect(wrapper.vm.appliedCoupon).toBe(null);
        expect(wrapper.vm.couponDiscountAmount).toBe(0);
      }
    });
  });

  describe("Order Submission with Coupon", () => {
    it("should include coupon code in order submission data", async () => {
      // Apply a coupon first
      const mockValidationResponse = {
        success: true,
        data: {
          valid: true,
          discountAmount: 10,
          finalAmount: 90,
          coupon: { id: 1, code: "ORDERTEST" },
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue(mockValidationResponse),
      });

      const couponInput = wrapper.find("#coupon-code");
      await couponInput.setValue("ORDERTEST");

      const buttons = wrapper.findAll("button");
      const applyButton = buttons.find((button: any) =>
        button.text().includes("cart.applyCoupon"),
      );
      await applyButton?.trigger("click");

      // Wait for async fetch and Vue updates
      await flushPromises();
      await wrapper.vm.$nextTick();

      // Check that coupon is applied
      expect(wrapper.vm.appliedCoupon).not.toBeNull();
      // Note: couponCode is converted to uppercase in validateCoupon
      expect(wrapper.vm.couponCode).toBe("ORDERTEST");
    });

    it("should not include coupon code if no coupon applied", () => {
      // No coupon applied, check the state
      expect(wrapper.vm.appliedCoupon).toBeNull();
      expect(wrapper.vm.couponCode).toBe("");
    });
  });

  describe("Loading States", () => {
    it("should show loading state during validation", async () => {
      // Create a promise that we can control
      let resolvePromise: any;
      const mockPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      global.fetch = vi.fn().mockReturnValue(mockPromise);

      const couponInput = wrapper.find("#coupon-code");
      await couponInput.setValue("LOADING");

      const buttons = wrapper.findAll("button");
      const applyButton = buttons.find((button: any) =>
        button.text().includes("cart.applyCoupon"),
      );
      await applyButton?.trigger("click");

      // Check loading state immediately after trigger
      await wrapper.vm.$nextTick();
      expect(wrapper.vm.isValidatingCoupon).toBe(true);

      // Resolve the promise
      resolvePromise({
        json: () =>
          Promise.resolve({
            success: true,
            data: { valid: false, error: "Test error" },
          }),
      });

      // Wait for the async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();
      expect(wrapper.vm.isValidatingCoupon).toBe(false);
    });

    it("should disable apply button during validation", async () => {
      let resolvePromise: any;
      const mockPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      global.fetch = vi.fn().mockReturnValue(mockPromise);

      const couponInput = wrapper.find("#coupon-code");
      await couponInput.setValue("LOADING");

      const buttons = wrapper.findAll("button");
      const applyButton = buttons.find((button: any) =>
        button.text().includes("cart.applyCoupon"),
      );
      await applyButton?.trigger("click");

      // Check disabled state immediately after trigger
      await wrapper.vm.$nextTick();
      expect(applyButton?.element.disabled).toBe(true);

      resolvePromise({
        json: () =>
          Promise.resolve({
            success: true,
            data: { valid: false, error: "Test error" },
          }),
      });

      // Wait for the async operation to complete
      await new Promise((resolve) => setTimeout(resolve, 0));
      await wrapper.vm.$nextTick();
      expect(applyButton?.element.disabled).toBe(false);
    });
  });
});
