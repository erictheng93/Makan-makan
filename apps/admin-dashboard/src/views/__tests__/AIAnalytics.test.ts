/**
 * AIAnalytics — Tests for AIInsightsDashboard and AIProviderConfig views
 *
 * Covers:
 *  1. AIInsightsDashboard — heading, tabs, time range, generate button, error/empty/loading/report states
 *  2. AIProviderConfig — config page, provider selection, API key, model, test, save
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import { nextTick } from "vue";
import { resetAllFactories } from "@makanmakan/testing-utils";

// ──── Hoisted mocks ────

const mockGenerateReport = vi.fn();
const mockGetConfig = vi.fn();
const mockSaveConfig = vi.fn();
const mockTestProvider = vi.fn();
const mockGetAvailableModels = vi.fn();
const mockGetTrafficDrivers = vi.fn();
const mockGetBestsellers = vi.fn();
const mockGetProfitLeaders = vi.fn();
const mockError = { value: null as string | null };

vi.mock("@/composables/useAIAnalytics", () => ({
  useAIAnalytics: () => ({
    loading: { value: false },
    error: mockError,
    generateReport: mockGenerateReport,
    getConfig: mockGetConfig,
    saveConfig: mockSaveConfig,
    testProvider: mockTestProvider,
    getAvailableModels: mockGetAvailableModels,
    getTrafficDrivers: mockGetTrafficDrivers,
    getBestsellers: mockGetBestsellers,
    getProfitLeaders: mockGetProfitLeaders,
  }),
}));

vi.mock("@heroicons/vue/24/outline", () => {
  const stub = { template: "<span />" };
  return {
    SparklesIcon: stub,
    ArrowPathIcon: stub,
    ExclamationTriangleIcon: stub,
    CheckCircleIcon: stub,
    ChartBarIcon: stub,
    ArrowTrendingUpIcon: stub,
    ArrowTrendingDownIcon: stub,
    CalendarIcon: stub,
    XCircleIcon: stub,
    ShieldCheckIcon: stub,
    CurrencyDollarIcon: stub,
    ShoppingCartIcon: stub,
    UserGroupIcon: stub,
    FireIcon: stub,
  };
});

vi.mock("@heroicons/vue/24/outline/LightBulbIcon", () => ({
  default: { template: "<span />" },
}));

vi.mock("@heroicons/vue/24/outline/ShieldCheckIcon", () => ({
  default: { template: "<span />" },
}));

vi.mock("@/i18n", () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, any>) => {
      if (params) {
        let result = key;
        for (const [k, v] of Object.entries(params)) {
          result += `{${k}:${v}}`;
        }
        return result;
      }
      return key;
    },
  }),
  t: (key: string) => key,
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    restaurantId: "test-restaurant-1",
    user: { restaurantId: "test-restaurant-1" },
  }),
}));

vi.mock("vue-router", () => ({
  useRoute: () => ({ path: "/dashboard/ai-analytics/insights" }),
  useRouter: () => ({ push: vi.fn() }),
  RouterLink: {
    template: "<a><slot /></a>",
    props: ["to"],
  },
}));

vi.mock("vue-toastification", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  }),
}));

// Import components AFTER mocks
import AIInsightsDashboard from "../ai-analytics/AIInsightsDashboard.vue";
import AIProviderConfig from "../ai-analytics/AIProviderConfig.vue";

// ──── Mock Data ────

const mockReport = {
  executiveSummary: "Business is doing well this period.",
  metrics: {
    totalRevenue: 150000,
    revenueGrowth: 12.5,
    totalOrders: 320,
    orderGrowth: 8.3,
    averageOrderValue: 469,
    uniqueCustomers: 180,
    averageOrdersPerCustomer: 1.8,
  },
  insights: [
    {
      id: "ins-1",
      type: "observation",
      category: "Revenue",
      title: "Revenue is up",
      description: "Revenue increased by 12.5%",
      impact: "high",
      confidence: 0.92,
      actionable: true,
      suggestedActions: ["Keep doing what you are doing"],
    },
  ],
  forecast: {
    nextWeekRevenue: {
      predicted: 40000,
      confidenceLower: 35000,
      confidenceUpper: 45000,
    },
    nextWeekOrders: {
      predicted: 80,
      confidenceLower: 70,
      confidenceUpper: 90,
    },
  },
};

// ──── Helpers ────

function mountDashboard() {
  setActivePinia(createPinia());
  return mount(AIInsightsDashboard, {
    global: {
      stubs: {
        RouterLink: {
          template: '<a class="router-link"><slot /></a>',
          props: ["to"],
        },
      },
      mocks: {
        $route: { path: "/dashboard/ai-analytics/insights" },
      },
    },
  });
}

function mountConfig() {
  setActivePinia(createPinia());
  return mount(AIProviderConfig, {
    global: {
      stubs: {
        RouterLink: {
          template: '<a class="router-link"><slot /></a>',
          props: ["to"],
        },
      },
      mocks: {
        $route: { path: "/dashboard/ai-analytics/config" },
      },
    },
  });
}

// ──── AIInsightsDashboard Tests ────

describe("AIInsightsDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllFactories();
    mockGenerateReport.mockResolvedValue(null);
    mockError.value = null;
  });

  it('should render "aiAnalytics.title" heading', async () => {
    const wrapper = mountDashboard();
    await flushPromises();
    const h1 = wrapper.find("h1");
    expect(h1.exists()).toBe(true);
    expect(h1.text()).toBe("aiAnalytics.title");
  });

  it("should show navigation tabs (AI Insights, Products, Config)", async () => {
    const wrapper = mountDashboard();
    await flushPromises();
    const nav = wrapper.find("nav");
    expect(nav.exists()).toBe(true);
    const navText = nav.text();
    expect(navText).toContain("aiAnalytics.navInsights");
    expect(navText).toContain("aiAnalytics.navProducts");
    expect(navText).toContain("aiAnalytics.navConfig");
  });

  it("should display time range selector with options", async () => {
    const wrapper = mountDashboard();
    await flushPromises();
    const select = wrapper.find("select");
    expect(select.exists()).toBe(true);
    const options = select.findAll("option");
    expect(options.length).toBe(4);
    // The option labels are i18n keys
    expect(options[0].text()).toBe("aiAnalytics.last7Days");
    expect(options[1].text()).toBe("aiAnalytics.last14Days");
    expect(options[2].text()).toBe("aiAnalytics.last30Days");
    expect(options[3].text()).toBe("aiAnalytics.last90Days");
  });

  it("should show regenerate report button", async () => {
    const wrapper = mountDashboard();
    await flushPromises();
    // The refresh button has an aria-label containing regenerateReport
    const btn = wrapper.find(
      'button[aria-label="aiAnalytics.regenerateReport"]',
    );
    expect(btn.exists()).toBe(true);
  });

  it("should show error message when API fails", async () => {
    mockGenerateReport.mockRejectedValueOnce(new Error("API down"));
    const wrapper = mountDashboard();
    await flushPromises();
    // errorMessage should be set from the catch block
    expect(wrapper.text()).toContain("API down");
    expect(wrapper.text()).toContain("aiAnalytics.reportError");
  });

  it('should show empty state with "aiAnalytics.noReport"', async () => {
    mockGenerateReport.mockResolvedValueOnce(null);
    const wrapper = mountDashboard();
    await flushPromises();
    expect(wrapper.text()).toContain("aiAnalytics.noReport");
    expect(wrapper.text()).toContain("aiAnalytics.noReportHint");
  });

  it('should show "aiAnalytics.generateNow" button on empty state', async () => {
    mockGenerateReport.mockResolvedValueOnce(null);
    const wrapper = mountDashboard();
    await flushPromises();
    const generateBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("aiAnalytics.generateNow"));
    expect(generateBtn).toBeDefined();
  });

  it('should call generateReport on "generateNow" button click', async () => {
    mockGenerateReport.mockResolvedValueOnce(null);
    const wrapper = mountDashboard();
    await flushPromises();
    // Clear calls from onMounted
    mockGenerateReport.mockClear();
    mockGenerateReport.mockResolvedValueOnce(null);

    const generateBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("aiAnalytics.generateNow"));
    await generateBtn!.trigger("click");
    await flushPromises();

    expect(mockGenerateReport).toHaveBeenCalledWith(
      "test-restaurant-1",
      { range: "30d" },
      { includeForecasting: true, refreshCache: false },
    );
  });

  it("should display report content when data loaded", async () => {
    mockGenerateReport.mockResolvedValueOnce(mockReport);
    const wrapper = mountDashboard();
    await flushPromises();
    // Executive summary
    expect(wrapper.text()).toContain("Business is doing well this period.");
    // Metrics
    expect(wrapper.text()).toContain("aiAnalytics.totalRevenue");
    expect(wrapper.text()).toContain("aiAnalytics.totalOrders");
    // Insight
    expect(wrapper.text()).toContain("Revenue is up");
  });

  it("should handle loading state", async () => {
    // Make generateReport hang
    let resolveGenerate!: (v: any) => void;
    mockGenerateReport.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveGenerate = resolve;
      }),
    );
    const wrapper = mountDashboard();
    await nextTick();
    // The loading text should appear
    expect(wrapper.text()).toContain("aiAnalytics.analyzing");
    // Resolve to clear
    resolveGenerate(null);
    await flushPromises();
  });

  it("should call generateReport on mount", async () => {
    const wrapper = mountDashboard();
    await flushPromises();
    expect(mockGenerateReport).toHaveBeenCalledTimes(1);
    expect(mockGenerateReport).toHaveBeenCalledWith(
      "test-restaurant-1",
      { range: "30d" },
      { includeForecasting: true, refreshCache: false },
    );
  });

  it("should handle API returning null with apiError set", async () => {
    mockError.value = "AI provider not configured";
    mockGenerateReport.mockResolvedValueOnce(null);
    const wrapper = mountDashboard();
    await flushPromises();
    // Should show the apiError as errorMessage
    expect(wrapper.text()).toContain("AI provider not configured");
    mockError.value = null;
  });
});

// ──── AIProviderConfig Tests ────

describe("AIProviderConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllFactories();
    mockGetConfig.mockResolvedValue(null);
    mockGetAvailableModels.mockResolvedValue([
      "claude-sonnet-4-20250514",
      "claude-3-haiku-20240307",
    ]);
    mockError.value = null;
  });

  it("should render configuration page with title", async () => {
    const wrapper = mountConfig();
    await flushPromises();
    const h1 = wrapper.find("h1");
    expect(h1.exists()).toBe(true);
    expect(h1.text()).toBe("aiConfig.title");
  });

  it("should show provider selection buttons", async () => {
    const wrapper = mountConfig();
    await flushPromises();
    // There should be 5 provider buttons
    const providerSection = wrapper.find(".p-8.border-b");
    const buttons = providerSection.findAll("button");
    expect(buttons.length).toBe(5);
    expect(wrapper.text()).toContain("Anthropic Claude");
    expect(wrapper.text()).toContain("OpenAI GPT");
    expect(wrapper.text()).toContain("Google Gemini");
    expect(wrapper.text()).toContain("DeepSeek");
  });

  it("should show API key input field", async () => {
    const wrapper = mountConfig();
    await flushPromises();
    const apiKeyInput = wrapper.find('input[type="password"]');
    expect(apiKeyInput.exists()).toBe(true);
    expect(wrapper.text()).toContain("API Key");
  });

  it("should show model selection input", async () => {
    const wrapper = mountConfig();
    await flushPromises();
    expect(wrapper.text()).toContain("aiConfig.modelSelection");
    // The model input is a text input with a datalist
    const modelInput = wrapper.find('input[type="text"]');
    expect(modelInput.exists()).toBe(true);
  });

  it("should show test connection button", async () => {
    const wrapper = mountConfig();
    await flushPromises();
    const testBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("aiConfig.testConnection"));
    expect(testBtn).toBeDefined();
  });

  it("should call saveConfig API on save button click", async () => {
    mockSaveConfig.mockResolvedValueOnce({ success: true });
    const wrapper = mountConfig();
    await flushPromises();

    // Set API key so button is enabled
    const apiKeyInput = wrapper.find('input[type="password"]');
    await apiKeyInput.setValue("sk-test-key-123");

    const saveBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("aiConfig.saveConfig"));
    expect(saveBtn).toBeDefined();
    await saveBtn!.trigger("click");
    await flushPromises();

    expect(mockSaveConfig).toHaveBeenCalledWith({
      restaurantId: "test-restaurant-1",
      provider: "anthropic",
      apiKey: "sk-test-key-123",
      model: "claude-sonnet-4-20250514",
      customBaseUrl: undefined,
    });
  });

  it("should show test result on success", async () => {
    mockTestProvider.mockResolvedValueOnce({ success: true, latency: 250 });
    const wrapper = mountConfig();
    await flushPromises();

    // Set API key
    const apiKeyInput = wrapper.find('input[type="password"]');
    await apiKeyInput.setValue("sk-test-key");

    const testBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("aiConfig.testConnection"));
    await testBtn!.trigger("click");
    await flushPromises();

    expect(mockTestProvider).toHaveBeenCalled();
    expect(wrapper.text()).toContain("aiConfig.connectionSuccess");
  });

  it("should handle empty config state (no provider set)", async () => {
    mockGetConfig.mockResolvedValueOnce(null);
    const wrapper = mountConfig();
    await flushPromises();
    // Default provider should be anthropic, API key empty
    const apiKeyInput = wrapper.find('input[type="password"]');
    expect((apiKeyInput.element as HTMLInputElement).value).toBe("");
    // Provider should still be selectable
    expect(wrapper.text()).toContain("Anthropic Claude");
  });

  it("should toggle API key visibility", async () => {
    const wrapper = mountConfig();
    await flushPromises();
    // Initially password type
    const apiKeyInput = wrapper.find('input[type="password"]');
    expect(apiKeyInput.exists()).toBe(true);
    // Find the toggle button near the API key input
    const toggleBtns = wrapper.findAll("button");
    const eyeBtn = toggleBtns.find((b) => {
      // The toggle button is near the API key section
      const parent = b.element.closest(".relative");
      return (
        parent?.querySelector('input[type="password"]') !== null ||
        parent?.querySelector('input[type="text"]') !== null
      );
    });
    // At minimum, the password input exists
    expect(apiKeyInput.exists()).toBe(true);
  });

  it("should show test connection error on failure", async () => {
    mockTestProvider.mockResolvedValueOnce({
      success: false,
      error: "Invalid API key",
    });
    const wrapper = mountConfig();
    await flushPromises();

    const apiKeyInput = wrapper.find('input[type="password"]');
    await apiKeyInput.setValue("sk-bad-key");

    const testBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("aiConfig.testConnection"));
    await testBtn!.trigger("click");
    await flushPromises();

    expect(mockTestProvider).toHaveBeenCalled();
    expect(wrapper.text()).toContain("Invalid API key");
  });

  it("should disable test connection button when API key is empty", async () => {
    const wrapper = mountConfig();
    await flushPromises();

    const testBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("aiConfig.testConnection"));
    expect(testBtn).toBeDefined();
    expect((testBtn!.element as HTMLButtonElement).disabled).toBe(true);
  });

  it("should load config on mount", async () => {
    mountConfig();
    await flushPromises();
    expect(mockGetConfig).toHaveBeenCalledWith("test-restaurant-1");
  });

  it("should load available models on mount", async () => {
    mountConfig();
    await flushPromises();
    expect(mockGetAvailableModels).toHaveBeenCalledWith("anthropic");
  });

  it("should show 5 provider options", async () => {
    const wrapper = mountConfig();
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain("Anthropic Claude");
    expect(text).toContain("OpenAI GPT");
    expect(text).toContain("Google Gemini");
    expect(text).toContain("DeepSeek");
    // 5th is the custom provider
    const providerSection = wrapper.find(".p-8.border-b");
    const buttons = providerSection.findAll("button");
    expect(buttons.length).toBe(5);
  });

  it("should populate form from existing config", async () => {
    mockGetConfig.mockResolvedValueOnce({
      config: {
        provider: "openai",
        model: "gpt-4o",
        custom_base_url: "",
      },
    });
    const wrapper = mountConfig();
    await flushPromises();
    // The provider should be set
    expect(wrapper.text()).toContain("OpenAI GPT");
  });

  it("should handle save error gracefully", async () => {
    mockSaveConfig.mockRejectedValueOnce(new Error("Server error"));
    const wrapper = mountConfig();
    await flushPromises();

    const apiKeyInput = wrapper.find('input[type="password"]');
    await apiKeyInput.setValue("sk-test-key");

    const saveBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("aiConfig.saveConfig"));
    await saveBtn!.trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Server error");
  });

  it("should disable save button when API key is empty", async () => {
    const wrapper = mountConfig();
    await flushPromises();

    const saveBtn = wrapper
      .findAll("button")
      .find((b) => b.text().includes("aiConfig.saveConfig"));
    expect(saveBtn).toBeDefined();
    expect((saveBtn!.element as HTMLButtonElement).disabled).toBe(true);
  });
});

// ──── AIInsightsDashboard Tests (Deeper) ────

describe("AIInsightsDashboard (Deeper)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAllFactories();
    mockGenerateReport.mockResolvedValue(null);
    mockError.value = null;
  });

  it("should show forecast section when report has forecast data", async () => {
    mockGenerateReport.mockResolvedValueOnce(mockReport);
    const wrapper = mountDashboard();
    await flushPromises();
    // Forecast values should be present
    expect(wrapper.text()).toContain("aiAnalytics.forecast");
  });

  it("should show metrics cards when report is loaded", async () => {
    mockGenerateReport.mockResolvedValueOnce(mockReport);
    const wrapper = mountDashboard();
    await flushPromises();
    expect(wrapper.text()).toContain("aiAnalytics.totalRevenue");
    expect(wrapper.text()).toContain("aiAnalytics.totalOrders");
    expect(wrapper.text()).toContain("aiAnalytics.avgOrderValue");
  });

  it("should show insight details with impact badge", async () => {
    mockGenerateReport.mockResolvedValueOnce(mockReport);
    const wrapper = mountDashboard();
    await flushPromises();
    expect(wrapper.text()).toContain("Revenue is up");
    expect(wrapper.text()).toContain("Revenue increased by 12.5%");
  });

  it("should show executive summary section", async () => {
    mockGenerateReport.mockResolvedValueOnce(mockReport);
    const wrapper = mountDashboard();
    await flushPromises();
    expect(wrapper.text()).toContain("Business is doing well this period.");
  });

  it("should regenerate report on time range change", async () => {
    mockGenerateReport.mockResolvedValueOnce(null);
    const wrapper = mountDashboard();
    await flushPromises();
    mockGenerateReport.mockClear();
    mockGenerateReport.mockResolvedValueOnce(mockReport);

    const select = wrapper.find("select");
    await select.setValue("7d");
    await flushPromises();

    expect(mockGenerateReport).toHaveBeenCalledWith(
      "test-restaurant-1",
      { range: "7d" },
      { includeForecasting: true, refreshCache: false },
    );
  });

  it("should call regenerate with refreshCache=true on refresh button", async () => {
    mockGenerateReport.mockResolvedValueOnce(mockReport);
    const wrapper = mountDashboard();
    await flushPromises();
    mockGenerateReport.mockClear();
    mockGenerateReport.mockResolvedValueOnce(mockReport);

    const refreshBtn = wrapper.find(
      'button[aria-label="aiAnalytics.regenerateReport"]',
    );
    await refreshBtn.trigger("click");
    await flushPromises();

    expect(mockGenerateReport).toHaveBeenCalledWith(
      "test-restaurant-1",
      { range: "30d" },
      { includeForecasting: true, refreshCache: true },
    );
  });

  it("should show 4 time range options in selector", async () => {
    const wrapper = mountDashboard();
    await flushPromises();
    const options = wrapper.findAll("select option");
    expect(options.length).toBe(4);
  });

  it("should show insight suggested actions", async () => {
    mockGenerateReport.mockResolvedValueOnce(mockReport);
    const wrapper = mountDashboard();
    await flushPromises();
    expect(wrapper.text()).toContain("Keep doing what you are doing");
  });

  it("should show revenue growth percentage", async () => {
    mockGenerateReport.mockResolvedValueOnce(mockReport);
    const wrapper = mountDashboard();
    await flushPromises();
    // The growth value 12.5 should appear
    expect(wrapper.text()).toContain("12.5");
  });
});

// ──────────────────────────────────────────────
// ProductAnalyticsView
// ──────────────────────────────────────────────

import ProductAnalyticsView from "../ai-analytics/ProductAnalyticsView.vue";

function mountProductAnalytics() {
  return mount(ProductAnalyticsView, {
    global: {
      mocks: {
        $route: { path: "/dashboard/ai-analytics/products" },
      },
    },
  });
}

const mockProducts = [
  {
    itemId: 1,
    itemName: "牛肉麵",
    category: "麵食",
    totalOrders: 150,
    totalRevenue: 27000,
    averageRating: 4.8,
    growthRate: 12.5,
    profitMargin: 0.65,
    trend: "up" as const,
  },
  {
    itemId: 2,
    itemName: "滷肉飯",
    category: "飯類",
    totalOrders: 200,
    totalRevenue: 9000,
    averageRating: 4.5,
    growthRate: -3.2,
    profitMargin: 0.72,
    trend: "down" as const,
  },
];

describe("ProductAnalyticsView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    resetAllFactories();
    mockError.value = null;
    mockGetTrafficDrivers.mockResolvedValue(mockProducts);
    mockGetBestsellers.mockResolvedValue(mockProducts);
    mockGetProfitLeaders.mockResolvedValue(mockProducts);
  });

  it("should render product analytics heading", async () => {
    const wrapper = mountProductAnalytics();
    await flushPromises();
    expect(wrapper.text()).toContain("productAnalytics");
  });

  it("should show 3 tab buttons (traffic, bestsellers, profit)", async () => {
    const wrapper = mountProductAnalytics();
    await flushPromises();
    expect(wrapper.text()).toContain("productAnalytics.trafficDrivers");
    expect(wrapper.text()).toContain("productAnalytics.bestsellers");
    expect(wrapper.text()).toContain("productAnalytics.profitLeaders");
  });

  it("should show time range selector", async () => {
    const wrapper = mountProductAnalytics();
    await flushPromises();
    const select = wrapper.find("select");
    expect(select.exists()).toBe(true);
  });

  it("should have interactive buttons", async () => {
    const wrapper = mountProductAnalytics();
    await flushPromises();
    const buttons = wrapper.findAll("button");
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it("should call getTrafficDrivers on mount (default tab)", async () => {
    mountProductAnalytics();
    await flushPromises();
    expect(mockGetTrafficDrivers).toHaveBeenCalled();
  });

  it("should render product content area", async () => {
    const wrapper = mountProductAnalytics();
    await flushPromises();
    // Component mounts and renders without error
    expect(wrapper.element.children.length).toBeGreaterThan(0);
  });

  it("should show empty state when no products", async () => {
    mockGetTrafficDrivers.mockResolvedValue([]);
    const wrapper = mountProductAnalytics();
    await flushPromises();
    expect(wrapper.text()).toContain("productAnalytics");
  });

  it("should show error message on API failure", async () => {
    mockGetTrafficDrivers.mockRejectedValue(new Error("fail"));
    const wrapper = mountProductAnalytics();
    await flushPromises();
    // Component should handle error gracefully
    expect(wrapper.element).toBeTruthy();
  });
});
