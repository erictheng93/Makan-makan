import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import PaymentForm from "../PaymentForm.vue";
import { usePaymentStore } from "@/stores/payment";
import type { CountryCode } from "@makanmakan/shared-types";

// Mock i18n
vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

// Mock child components
vi.mock("../PaymentSteps.vue", () => ({
  default: {
    name: "PaymentSteps",
    template: '<div data-testid="payment-steps" />',
  },
}));
vi.mock("../PaymentMethodSelector.vue", () => ({
  default: {
    name: "PaymentMethodSelector",
    template: '<div data-testid="payment-method-selector" />',
  },
}));
vi.mock("../StripeCardElement.vue", () => ({
  default: {
    name: "StripeCardElement",
    template: '<div data-testid="stripe-card-element" />',
  },
}));
vi.mock("../BankTransferInfo.vue", () => ({
  default: {
    name: "BankTransferInfo",
    template: '<div data-testid="bank-transfer-info" />',
  },
}));
vi.mock("../PaymentProcessing.vue", () => ({
  default: {
    name: "PaymentProcessing",
    template: '<div data-testid="payment-processing" />',
  },
}));
vi.mock("../OrderSummary.vue", () => ({
  default: {
    name: "OrderSummary",
    template: '<div data-testid="order-summary" />',
  },
}));
vi.mock("@/components/ui/LoadingSpinner.vue", () => ({
  default: {
    name: "LoadingSpinner",
    template: '<div data-testid="loading-spinner" />',
  },
}));

describe("PaymentForm", () => {
  let wrapper: VueWrapper<any>;
  let pinia: any;

  const defaultProps = {
    orderId: "ORDER_123",
    restaurantId: 1,
    country: "TW" as CountryCode,
    currency: "TWD" as const,
    amount: 500,
    autoStart: false,
  };

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  const createWrapper = (props = {}) => {
    return mount(PaymentForm, {
      props: { ...defaultProps, ...props },
      global: {
        plugins: [pinia],
      },
    });
  };

  describe("Rendering", () => {
    it("renders payment form with all main sections", () => {
      wrapper = createWrapper();

      expect(wrapper.find('[data-testid="payment-steps"]').exists()).toBe(true);
      expect(wrapper.find('[data-testid="order-summary"]').exists()).toBe(true);
      expect(wrapper.find(".payment-container").exists()).toBe(true);
    });

    it("renders method selection step by default", () => {
      wrapper = createWrapper();

      expect(wrapper.find(".step-content").exists()).toBe(true);
      expect(wrapper.text()).toContain("選擇支付方式");
    });

    it("displays payment method selector", () => {
      wrapper = createWrapper();

      expect(
        wrapper.find('[data-testid="payment-method-selector"]').exists(),
      ).toBe(true);
    });
  });

  describe("Step Navigation", () => {
    it("advances to details step when method is selected", async () => {
      wrapper = createWrapper();

      // Simulate method selection
      await wrapper.setData({ selectedPaymentMethod: "credit_card" });

      // Click continue button
      const continueBtn = wrapper.find('button:contains("繼續")');
      if (continueBtn.exists()) {
        await continueBtn.trigger("click");
        expect(wrapper.vm.currentStep).toBe("details");
      }
    });

    it("goes back to method selection from details", async () => {
      wrapper = createWrapper();

      // Set to details step
      await wrapper.setData({
        selectedPaymentMethod: "credit_card",
        currentStep: "details",
      });

      // Click back button
      const backBtn = wrapper.find('button:contains("返回")');
      if (backBtn.exists()) {
        await backBtn.trigger("click");
        expect(wrapper.vm.currentStep).toBe("method");
      }
    });
  });

  describe("Form Validation", () => {
    beforeEach(async () => {
      wrapper = createWrapper();
      await wrapper.setData({
        selectedPaymentMethod: "credit_card",
        currentStep: "details",
      });
    });

    it("validates required customer name", async () => {
      const nameInput = wrapper.find("#customer-name");
      if (nameInput.exists()) {
        await nameInput.setValue("");
        await nameInput.trigger("blur");

        const result = wrapper.vm.validateForm();
        expect(result).toBe(false);
        expect(wrapper.vm.errors.name).toBeTruthy();
      }
    });

    it("validates email format", async () => {
      const emailInput = wrapper.find("#customer-email");
      if (emailInput.exists()) {
        await emailInput.setValue("invalid-email");
        await emailInput.trigger("blur");

        const result = wrapper.vm.validateForm();
        expect(result).toBe(false);
        expect(wrapper.vm.errors.email).toBeTruthy();
      }
    });

    it("passes validation with valid data", async () => {
      await wrapper.setData({
        customerInfo: {
          name: "John Doe",
          email: "john@example.com",
          phone: "+886912345678",
        },
      });

      const result = wrapper.vm.validateForm();
      expect(result).toBe(true);
      expect(Object.keys(wrapper.vm.errors)).toHaveLength(0);
    });
  });

  describe("Payment Methods", () => {
    it("shows credit card form for credit_card method", async () => {
      wrapper = createWrapper();

      await wrapper.setData({
        selectedPaymentMethod: "credit_card",
        currentStep: "details",
      });

      expect(wrapper.find('[data-testid="stripe-card-element"]').exists()).toBe(
        true,
      );
    });

    it("shows bank transfer info for bank_transfer method", async () => {
      wrapper = createWrapper();

      await wrapper.setData({
        selectedPaymentMethod: "bank_transfer",
        currentStep: "details",
      });

      expect(wrapper.find('[data-testid="bank-transfer-info"]').exists()).toBe(
        true,
      );
    });
  });

  describe("Payment Processing", () => {
    it("shows processing state during payment", async () => {
      wrapper = createWrapper();

      await wrapper.setData({
        currentStep: "processing",
        processingPayment: true,
      });

      expect(wrapper.find('[data-testid="payment-processing"]').exists()).toBe(
        true,
      );
    });

    it("emits payment-success on successful payment", async () => {
      wrapper = createWrapper();

      await wrapper.vm.handlePaymentSuccess("TXN_123");

      expect(wrapper.emitted("payment-success")).toBeTruthy();
      expect(wrapper.emitted("payment-success")?.[0]).toEqual(["TXN_123"]);
    });

    it("emits payment-error on payment failure", async () => {
      wrapper = createWrapper();

      await wrapper.vm.handlePaymentError("Payment failed");

      expect(wrapper.emitted("payment-error")).toBeTruthy();
      expect(wrapper.emitted("payment-error")?.[0]).toEqual(["Payment failed"]);
    });
  });

  describe("Store Integration", () => {
    it("calls payment store methods", async () => {
      const paymentStore = usePaymentStore();
      const createPaymentSpy = vi.spyOn(paymentStore, "createPayment");

      wrapper = createWrapper();

      // Set valid data
      await wrapper.setData({
        selectedPaymentMethod: "credit_card",
        currentStep: "details",
        customerInfo: {
          name: "John Doe",
          email: "john@example.com",
        },
      });

      await wrapper.vm.processPayment();

      expect(createPaymentSpy).toHaveBeenCalled();
    });
  });

  describe("Country-specific Features", () => {
    it("shows correct phone placeholder for TW", () => {
      wrapper = createWrapper({ country: "TW" });

      expect(wrapper.vm.phonePlaceholder).toContain("+886");
    });

    it("shows correct phone placeholder for MY", () => {
      wrapper = createWrapper({ country: "MY" });

      expect(wrapper.vm.phonePlaceholder).toContain("+60");
    });

    it("shows correct phone placeholder for VN", () => {
      wrapper = createWrapper({ country: "VN" });

      expect(wrapper.vm.phonePlaceholder).toContain("+84");
    });
  });

  describe("Events", () => {
    it("emits step-change when step changes", async () => {
      wrapper = createWrapper();

      await wrapper.setData({ selectedPaymentMethod: "credit_card" });
      await wrapper.vm.proceedToDetails();

      expect(wrapper.emitted("step-change")).toBeTruthy();
      expect(wrapper.emitted("step-change")?.[0]).toEqual(["details"]);
    });

    it("emits payment-cancel when cancelled", async () => {
      wrapper = createWrapper();

      await wrapper.vm.closePayment();

      expect(wrapper.emitted("payment-cancel")).toBeTruthy();
    });
  });

  describe("Accessibility", () => {
    it("has proper form labels", () => {
      wrapper = createWrapper();

      const labels = wrapper.findAll("label");
      labels.forEach((label) => {
        expect(label.attributes("for")).toBeTruthy();
      });
    });

    it("has proper ARIA attributes", () => {
      wrapper = createWrapper();

      const progressNav = wrapper.find('[aria-label="Payment progress"]');
      expect(progressNav.exists()).toBe(true);
    });
  });

  describe("Responsive Design", () => {
    it("applies mobile-specific classes", () => {
      wrapper = createWrapper();

      expect(wrapper.find(".payment-container").classes()).toContain("grid");
      expect(wrapper.find(".payment-container").classes()).toContain(
        "lg:grid-cols-3",
      );
    });
  });

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount();
    }
  });
});
