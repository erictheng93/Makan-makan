import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import PaymentSteps from "../PaymentSteps.vue";
describe("PaymentSteps", () => {
    const defaultSteps = [
        {
            key: "method",
            label: "選擇支付方式",
            description: "選擇您偏好的支付方式",
        },
        { key: "details", label: "填寫資訊", description: "輸入支付詳情" },
        { key: "processing", label: "處理付款", description: "正在處理您的付款" },
    ];
    const createWrapper = (props = {}) => {
        return mount(PaymentSteps, {
            props: {
                currentStep: "method",
                steps: defaultSteps,
                ...props,
            },
        });
    };
    describe("Rendering", () => {
        it("renders all steps", () => {
            const wrapper = createWrapper();
            expect(wrapper.findAll(".step-item")).toHaveLength(3);
            expect(wrapper.text()).toContain("選擇支付方式");
            expect(wrapper.text()).toContain("填寫資訊");
            expect(wrapper.text()).toContain("處理付款");
        });
        it("renders step descriptions when showDescriptions is true", () => {
            const wrapper = createWrapper({ showDescriptions: true });
            expect(wrapper.text()).toContain("選擇您偏好的支付方式");
            expect(wrapper.text()).toContain("輸入支付詳情");
        });
        it("hides step descriptions when showDescriptions is false", () => {
            const wrapper = createWrapper({ showDescriptions: false });
            expect(wrapper.text()).not.toContain("選擇您偏好的支付方式");
        });
    });
    describe("Step States", () => {
        it("marks first step as current by default", () => {
            const wrapper = createWrapper({ currentStep: "method" });
            const firstStep = wrapper.find(".step-item");
            expect(firstStep.classes()).toContain("step-current");
        });
        it("marks completed steps correctly", () => {
            const wrapper = createWrapper({ currentStep: "details" });
            const steps = wrapper.findAll(".step-item");
            expect(steps[0].classes()).toContain("step-completed");
            expect(steps[1].classes()).toContain("step-current");
            expect(steps[2].classes()).toContain("step-pending");
        });
        it("shows checkmark icon for completed steps", () => {
            const wrapper = createWrapper({ currentStep: "processing" });
            const completedSteps = wrapper.findAll(".step-icon-completed");
            expect(completedSteps).toHaveLength(2);
        });
        it("shows step numbers for pending steps", () => {
            const wrapper = createWrapper({ currentStep: "method" });
            const stepNumbers = wrapper.findAll(".step-number");
            expect(stepNumbers).toHaveLength(3);
            expect(stepNumbers[0].text()).toBe("1");
            expect(stepNumbers[1].text()).toBe("2");
            expect(stepNumbers[2].text()).toBe("3");
        });
    });
    describe("Progress Calculation", () => {
        it("calculates progress percentage correctly", () => {
            const wrapper = createWrapper({ currentStep: "details" });
            const progressFill = wrapper.find(".progress-fill");
            expect(progressFill.attributes("style")).toContain("width: 67%");
        });
        it("handles invalid current step gracefully", () => {
            const wrapper = createWrapper({ currentStep: "invalid" });
            const progressFill = wrapper.find(".progress-fill");
            expect(progressFill.attributes("style")).toContain("width: 33%");
        });
        it("handles empty steps array", () => {
            const wrapper = createWrapper({ steps: [] });
            const progressFill = wrapper.find(".progress-fill");
            expect(progressFill.attributes("style")).toContain("width: 0%");
        });
    });
    describe("Mobile Progress Bar", () => {
        it("shows mobile progress bar", () => {
            const wrapper = createWrapper();
            const mobileProgress = wrapper.find(".progress-bar-mobile");
            expect(mobileProgress.exists()).toBe(true);
            expect(mobileProgress.classes()).toContain("md:hidden");
        });
        it("displays current step info in mobile view", () => {
            const wrapper = createWrapper({ currentStep: "details" });
            const progressText = wrapper.find(".progress-text");
            expect(progressText.text()).toContain("步驟 2 / 3");
            expect(progressText.text()).toContain("填寫資訊");
        });
        it("updates progress fill width based on current step", () => {
            const wrapper = createWrapper({ currentStep: "details" });
            const progressFill = wrapper.find(".progress-fill");
            expect(progressFill.attributes("style")).toContain("width: 67%");
        });
    });
    describe("Step Navigation", () => {
        it("identifies current step correctly", () => {
            const wrapper = createWrapper({ currentStep: "details" });
            const currentStepElement = wrapper.find(".step-current");
            expect(currentStepElement.exists()).toBe(true);
            const stepNumber = currentStepElement.find(".step-number");
            expect(stepNumber.text()).toBe("2"); // Second step (index 1)
        });
        it("displays current step content correctly", () => {
            const wrapper = createWrapper({ currentStep: "processing" });
            const currentStepElement = wrapper.find(".step-current");
            const stepLabel = currentStepElement.find(".step-label");
            expect(stepLabel.text()).toBe("處理付款");
        });
    });
    describe("Connectors", () => {
        it("shows connectors between steps", () => {
            const wrapper = createWrapper();
            const connectors = wrapper.findAll(".step-connector");
            expect(connectors).toHaveLength(2); // n-1 connectors for n steps
        });
        it("styles completed connectors differently", () => {
            const wrapper = createWrapper({ currentStep: "processing" });
            const connectors = wrapper.findAll(".step-connector");
            expect(connectors[0].classes()).toContain("connector-completed");
            expect(connectors[1].classes()).toContain("connector-completed");
        });
        it("styles pending connectors differently", () => {
            const wrapper = createWrapper({ currentStep: "method" });
            const connectors = wrapper.findAll(".step-connector");
            expect(connectors[0].classes()).toContain("connector-pending");
            expect(connectors[1].classes()).toContain("connector-pending");
        });
    });
    describe("Animations", () => {
        it("applies pulse animation to current step", () => {
            const wrapper = createWrapper({ currentStep: "method" });
            const currentStepIcon = wrapper.find(".step-icon-current");
            const pulse = currentStepIcon.find(".step-pulse");
            expect(pulse.exists()).toBe(true);
            expect(pulse.classes()).toContain("animate-ping");
        });
    });
    describe("Responsive Behavior", () => {
        it("hides desktop steps on mobile", () => {
            const wrapper = createWrapper();
            const stepsContainer = wrapper.find(".steps-container");
            expect(stepsContainer.classes()).toContain("hidden");
            expect(stepsContainer.classes()).toContain("md:block");
        });
        it("adjusts step content for mobile", () => {
            const wrapper = createWrapper();
            // Check for responsive classes
            expect(wrapper.find(".step-item").exists()).toBe(true);
        });
    });
    describe("Accessibility", () => {
        it("has proper navigation role and label", () => {
            const wrapper = createWrapper();
            const nav = wrapper.find('nav[aria-label="Payment progress"]');
            expect(nav.exists()).toBe(true);
        });
        it("uses semantic list structure", () => {
            const wrapper = createWrapper();
            expect(wrapper.find("ol.steps-list").exists()).toBe(true);
            expect(wrapper.findAll("li.step-item")).toHaveLength(3);
        });
        it("provides proper step descriptions", () => {
            const wrapper = createWrapper();
            const descriptions = wrapper.findAll(".step-description");
            expect(descriptions.length).toBeGreaterThan(0);
        });
    });
    describe("Edge Cases", () => {
        it("handles single step", () => {
            const singleStep = [{ key: "only", label: "唯一步驟" }];
            const wrapper = createWrapper({
                steps: singleStep,
                currentStep: "only",
            });
            expect(wrapper.findAll(".step-item")).toHaveLength(1);
            expect(wrapper.findAll(".step-connector")).toHaveLength(0);
        });
        it("handles very long step labels gracefully", () => {
            const longSteps = [
                {
                    key: "long",
                    label: "這是一個非常非常非常長的步驟標題用來測試響應式設計",
                },
            ];
            const wrapper = createWrapper({
                steps: longSteps,
                currentStep: "long",
            });
            expect(wrapper.find(".step-title").text()).toContain("這是一個非常");
        });
        it("handles missing current step gracefully", () => {
            const wrapper = createWrapper({ currentStep: "nonexistent" });
            const currentStepElement = wrapper.find(".step-current");
            expect(currentStepElement.exists()).toBe(false);
        });
    });
});
