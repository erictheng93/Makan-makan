import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount, VueWrapper } from "@vue/test-utils";
import PaymentProcessing from "../PaymentProcessing.vue";

describe("PaymentProcessing", () => {
  let wrapper: VueWrapper<any>;

  const createWrapper = (props = {}) => {
    return mount(PaymentProcessing, {
      props: {
        status: "processing",
        transactionId: "TXN_123456789",
        ...props,
      },
    });
  };

  beforeEach(() => {
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    if (wrapper) {
      wrapper.unmount();
    }
  });

  describe("Processing State", () => {
    it("renders processing state correctly", () => {
      wrapper = createWrapper({ status: "processing" });

      expect(wrapper.find(".processing-state").exists()).toBe(true);
      expect(wrapper.text()).toContain("處理付款中");
      expect(wrapper.text()).toContain("正在安全地處理您的支付請求");
    });

    it("shows processing spinner", () => {
      wrapper = createWrapper({ status: "processing" });

      const spinner = wrapper.find(".processing-spinner");
      expect(spinner.exists()).toBe(true);

      const svg = spinner.find("svg");
      expect(svg.classes()).toContain("animate-spin");
    });

    it("displays processing steps", () => {
      wrapper = createWrapper({ status: "processing" });

      const steps = wrapper.findAll(".processing-step");
      expect(steps).toHaveLength(3);
      expect(steps[0].text()).toContain("驗證支付資訊");
      expect(steps[1].text()).toContain("連接支付網關");
      expect(steps[2].text()).toContain("確認交易");
    });

    it("animates processing steps", async () => {
      wrapper = createWrapper({ status: "processing" });

      // Initial state - first step active
      expect(wrapper.vm.processingStep).toBe(1);

      // Advance timers to trigger step animation
      vi.advanceTimersByTime(2000);
      await wrapper.vm.$nextTick();

      expect(wrapper.vm.processingStep).toBe(2);
    });

    it("displays transaction ID when available", () => {
      wrapper = createWrapper({
        status: "processing",
        transactionId: "TXN_123456789",
      });

      expect(wrapper.text()).toContain("交易編號");
      expect(wrapper.text()).toContain("TXN_123456789");
    });
  });

  describe("Success State", () => {
    it("renders success state correctly", () => {
      wrapper = createWrapper({
        status: "success",
        transactionId: "TXN_SUCCESS_123",
      });

      expect(wrapper.find(".success-state").exists()).toBe(true);
      expect(wrapper.text()).toContain("支付成功！");
      expect(wrapper.text()).toContain("您的支付已成功處理");
    });

    it("shows success checkmark", () => {
      wrapper = createWrapper({ status: "success" });

      const checkmark = wrapper.find(".success-checkmark");
      expect(checkmark.exists()).toBe(true);

      const ring = wrapper.find(".success-ring");
      expect(ring.exists()).toBe(true);
      expect(ring.classes()).toContain("animate-ping");
    });

    it("displays success details", () => {
      wrapper = createWrapper({
        status: "success",
        transactionId: "TXN_SUCCESS_123",
      });

      const details = wrapper.find(".success-details");
      expect(details.exists()).toBe(true);

      expect(wrapper.text()).toContain("TXN_SUCCESS_123");
      expect(wrapper.text()).toContain("支付時間");
      expect(wrapper.text()).toContain("已完成");
    });

    it("shows success action buttons", () => {
      wrapper = createWrapper({ status: "success" });

      const actions = wrapper.find(".success-actions");
      expect(actions.exists()).toBe(true);

      expect(wrapper.text()).toContain("繼續購物");
      expect(wrapper.text()).toContain("查看訂單");
    });

    it("emits continue-shopping event", async () => {
      wrapper = createWrapper({ status: "success" });

      const continueBtn = wrapper.find("button:first-child");
      await continueBtn.trigger("click");

      expect(wrapper.emitted("continue-shopping")).toBeTruthy();
    });

    it("emits view-order event", async () => {
      wrapper = createWrapper({ status: "success" });

      const viewBtn = wrapper.find("button:last-child");
      await viewBtn.trigger("click");

      expect(wrapper.emitted("view-order")).toBeTruthy();
    });
  });

  describe("Error State", () => {
    it("renders error state correctly", () => {
      wrapper = createWrapper({
        status: "error",
        errorMessage: "支付處理失敗",
      });

      expect(wrapper.find(".error-state").exists()).toBe(true);
      expect(wrapper.text()).toContain("支付失敗");
      expect(wrapper.text()).toContain("支付處理失敗");
    });

    it("shows default error message when none provided", () => {
      wrapper = createWrapper({ status: "error" });

      expect(wrapper.text()).toContain("很抱歉，您的支付處理過程中遇到問題");
    });

    it("displays error details when available", () => {
      wrapper = createWrapper({
        status: "error",
        errorDetails: {
          code: "CARD_DECLINED",
          message: "信用卡被拒絕",
        },
      });

      const errorDetails = wrapper.find(".error-details");
      expect(errorDetails.exists()).toBe(true);

      // Expand error details
      const summary = wrapper.find(".error-summary");
      await summary.trigger("click");

      expect(wrapper.text()).toContain("CARD_DECLINED");
      expect(wrapper.text()).toContain("信用卡被拒絕");
    });

    it("shows retry button", () => {
      wrapper = createWrapper({ status: "error" });

      const retryBtn = wrapper.find("button:first-child");
      expect(retryBtn.text()).toContain("重新支付");
    });

    it("emits retry event", async () => {
      wrapper = createWrapper({ status: "error" });

      const retryBtn = wrapper.find("button:first-child");
      await retryBtn.trigger("click");

      expect(wrapper.emitted("retry")).toBeTruthy();
    });

    it("disables retry button when retryDisabled is true", () => {
      wrapper = createWrapper({
        status: "error",
        retryDisabled: true,
      });

      const retryBtn = wrapper.find("button:first-child");
      expect(retryBtn.attributes("disabled")).toBeDefined();
    });

    it("shows loading state during retry", async () => {
      wrapper = createWrapper({ status: "error" });

      // Trigger retry
      const retryBtn = wrapper.find("button:first-child");
      await retryBtn.trigger("click");

      // Should show loading state
      expect(wrapper.find(".btn-loading").exists()).toBe(true);
      expect(wrapper.text()).toContain("重試中...");
    });

    it("shows help links", () => {
      wrapper = createWrapper({ status: "error" });

      const helpLinks = wrapper.find(".help-links");
      expect(helpLinks.exists()).toBe(true);

      expect(wrapper.text()).toContain("聯繫客服");
      expect(wrapper.text()).toContain("常見問題");
    });

    it("emits contact-support event", async () => {
      wrapper = createWrapper({ status: "error" });

      const supportLink = wrapper.find(".help-link:first-child");
      await supportLink.trigger("click");

      expect(wrapper.emitted("contact-support")).toBeTruthy();
    });

    it("opens FAQ in new window", async () => {
      wrapper = createWrapper({ status: "error" });

      // Mock window.open
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

      const faqLink = wrapper.find(".help-link:last-child");
      await faqLink.trigger("click");

      expect(openSpy).toHaveBeenCalledWith("/faq", "_blank");
    });
  });

  describe("Cancelled State", () => {
    it("renders cancelled state correctly", () => {
      wrapper = createWrapper({ status: "cancelled" });

      expect(wrapper.find(".cancelled-state").exists()).toBe(true);
      expect(wrapper.text()).toContain("支付已取消");
      expect(wrapper.text()).toContain("您已取消此次支付");
    });

    it("shows return to shopping button", () => {
      wrapper = createWrapper({ status: "cancelled" });

      const returnBtn = wrapper.find("button");
      expect(returnBtn.text()).toContain("返回購物");
    });

    it("emits continue-shopping event on return button click", async () => {
      wrapper = createWrapper({ status: "cancelled" });

      const returnBtn = wrapper.find("button");
      await returnBtn.trigger("click");

      expect(wrapper.emitted("continue-shopping")).toBeTruthy();
    });
  });

  describe("Date Formatting", () => {
    it("formats date correctly", () => {
      wrapper = createWrapper({ status: "success" });

      const testDate = new Date("2023-12-25T15:30:45");
      const formatted = wrapper.vm.formatDateTime(testDate);

      expect(formatted).toMatch(/2023/);
      expect(formatted).toMatch(/12/);
      expect(formatted).toMatch(/25/);
      expect(formatted).toMatch(/15:30:45/);
    });
  });

  describe("Lifecycle Management", () => {
    it("starts processing animation on mount for processing status", () => {
      wrapper = createWrapper({ status: "processing" });

      expect(wrapper.vm.processingStep).toBe(1);

      // Verify interval is set up
      vi.advanceTimersByTime(2000);
      expect(wrapper.vm.processingStep).toBe(2);
    });

    it("cleans up interval on unmount", () => {
      wrapper = createWrapper({ status: "processing" });

      const clearIntervalSpy = vi.spyOn(global, "clearInterval");
      wrapper.unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it("does not start animation for non-processing status", () => {
      wrapper = createWrapper({ status: "success" });

      // Should not have processing animation
      expect(wrapper.vm.processingStep).toBe(1);

      vi.advanceTimersByTime(2000);
      expect(wrapper.vm.processingStep).toBe(1); // Should not change
    });
  });

  describe("Accessibility", () => {
    it("has proper heading structure", () => {
      wrapper = createWrapper({ status: "success" });

      const title = wrapper.find(".state-title");
      expect(title.exists()).toBe(true);
      expect(title.text()).toContain("支付成功！");
    });

    it("provides meaningful button labels", () => {
      wrapper = createWrapper({ status: "error" });

      const buttons = wrapper.findAll("button");
      buttons.forEach((button) => {
        expect(button.text().length).toBeGreaterThan(0);
      });
    });

    it("includes proper ARIA attributes for loading states", async () => {
      wrapper = createWrapper({ status: "error" });

      const retryBtn = wrapper.find("button:first-child");
      await retryBtn.trigger("click");

      // Check for loading indicator
      const loadingIndicator = wrapper.find(".btn-loading");
      expect(loadingIndicator.exists()).toBe(true);
    });
  });

  describe("Responsive Design", () => {
    it("applies mobile-specific styles", () => {
      wrapper = createWrapper({ status: "processing" });

      expect(wrapper.find(".payment-processing").exists()).toBe(true);
      expect(wrapper.find(".state-container").exists()).toBe(true);
    });

    it("handles different screen sizes", () => {
      wrapper = createWrapper({ status: "success" });

      // Check for responsive action layout
      const actions = wrapper.find(".success-actions");
      expect(actions.classes()).toContain("flex-col");
      expect(actions.classes()).toContain("sm:flex-row");
    });
  });
});
