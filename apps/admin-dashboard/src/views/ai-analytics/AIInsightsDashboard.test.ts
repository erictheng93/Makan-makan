// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AIInsightsDashboard from "./AIInsightsDashboard.vue";

const apiError = ref<string | null>(null);
const apiErrorCode = ref<string | null>(null);
const generateReport = vi.fn(async () => {
  apiError.value =
    "AI provider not configured. Please configure an AI provider first.";
  apiErrorCode.value = "AI_PROVIDER_NOT_CONFIGURED";
  return null;
});

vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({ restaurantId: "restaurant-1" }),
}));

vi.mock("@/composables/useAIAnalytics", () => ({
  useAIAnalytics: () => ({
    generateReport,
    error: apiError,
    errorCode: apiErrorCode,
  }),
}));

vi.mock("@/composables/useCurrency", () => ({
  useCurrency: () => ({ formatPrice: (value: number) => String(value) }),
}));

describe("AIInsightsDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiError.value = null;
    apiErrorCode.value = null;
  });

  it("guides an unconfigured provider to AI settings instead of retrying", async () => {
    const wrapper = mount(AIInsightsDashboard, {
      global: {
        mocks: {
          $route: { path: "/dashboard/ai-analytics/insights" },
        },
        stubs: {
          ModuleGate: { props: ["module"], template: "<slot />" },
          RouterLink: { props: ["to"], template: '<a :href="to"><slot /></a>' },
        },
      },
    });

    await wrapper
      .findAll("button")
      .find((button) => button.text() === "aiAnalytics.generateNow")
      ?.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("aiAnalytics.providerNotConfiguredTitle");
    expect(wrapper.text()).toContain("aiAnalytics.providerNotConfiguredHint");
    expect(wrapper.text()).not.toContain(
      "AI provider not configured. Please configure an AI provider first.",
    );
    expect(wrapper.text()).not.toContain("aiAnalytics.retry");
    expect(
      wrapper
        .findAll('a[href="/dashboard/ai-analytics/config"]')
        .find((link) => link.text() === "aiAnalytics.configureProvider")
        ?.exists(),
    ).toBe(true);
  });
});
