import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the utils module
const mockMonitor = {
  getMetrics: vi.fn(() => []),
  getResourceTimings: vi.fn(() => []),
  getWebVitals: vi.fn(() => ({})),
  mark: vi.fn(),
  measureBetween: vi.fn(),
  measure: vi.fn(async (_name: string, fn: () => any) => fn()),
  generateReport: vi.fn(() => ({ timestamp: Date.now(), metrics: [] })),
  clear: vi.fn(),
  disconnect: vi.fn(),
  trackMetric: vi.fn(),
};

vi.mock("@makanmakan/utils", () => ({
  getPerformanceMonitor: vi.fn(() => mockMonitor),
}));

// Mock Vue lifecycle hooks
vi.mock("vue", async () => {
  const actual = await vi.importActual("vue");
  return {
    ...actual,
    onMounted: vi.fn((cb: () => void) => cb()),
    onBeforeUnmount: vi.fn(),
  };
});

import { usePerformanceMonitor } from "@/composables/usePerformanceMonitor";

describe("usePerformanceMonitor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Mock navigator.onLine
    Object.defineProperty(navigator, "onLine", {
      value: true,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should initialize with monitor and reactive state", () => {
    const result = usePerformanceMonitor();

    expect(result.monitor).toBeDefined();
    expect(result.webVitals.value).toEqual({});
    expect(result.metrics.value).toEqual([]);
    expect(result.resources.value).toEqual([]);
    expect(result.isOnline.value).toBe(true);
  });

  describe("trackRouteChange", () => {
    it("should mark route start and schedule end measurement", () => {
      const { trackRouteChange } = usePerformanceMonitor();

      trackRouteChange("/home", "/menu");

      expect(mockMonitor.mark).toHaveBeenCalledWith("route-/menu-start");
    });
  });

  describe("trackApiRequest", () => {
    it("should delegate to monitor.measure with api prefix", async () => {
      const { trackApiRequest } = usePerformanceMonitor();
      const mockResult = { data: "test" };
      const requestFn = vi.fn().mockResolvedValue(mockResult);

      const result = await trackApiRequest("/orders", requestFn);

      expect(mockMonitor.measure).toHaveBeenCalledWith(
        "api-/orders",
        requestFn,
        expect.objectContaining({ type: "api", endpoint: "/orders" }),
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe("trackComponentRender", () => {
    it("should delegate to monitor.measure with component prefix", async () => {
      const { trackComponentRender } = usePerformanceMonitor();
      const renderFn = vi.fn().mockReturnValue("rendered");

      await trackComponentRender("MenuCard", renderFn);

      expect(mockMonitor.measure).toHaveBeenCalledWith(
        "component-MenuCard",
        renderFn,
        expect.objectContaining({
          type: "component",
          component: "MenuCard",
        }),
      );
    });
  });

  describe("getPerformanceScore", () => {
    it("should return 100 when no vitals are reported", () => {
      mockMonitor.getWebVitals.mockReturnValue({});
      const { getPerformanceScore } = usePerformanceMonitor();

      expect(getPerformanceScore()).toBe(100);
    });

    it("should deduct points for poor LCP", () => {
      mockMonitor.getWebVitals.mockReturnValue({ LCP: 6000 }); // > 5000 = -30
      const { getPerformanceScore } = usePerformanceMonitor();

      expect(getPerformanceScore()).toBe(70);
    });

    it("should deduct points for poor FID", () => {
      mockMonitor.getWebVitals.mockReturnValue({ FID: 600 }); // > 500 = -20
      const { getPerformanceScore } = usePerformanceMonitor();

      expect(getPerformanceScore()).toBe(80);
    });

    it("should deduct points for poor CLS", () => {
      mockMonitor.getWebVitals.mockReturnValue({ CLS: 0.3 }); // > 0.25 = -20
      const { getPerformanceScore } = usePerformanceMonitor();

      expect(getPerformanceScore()).toBe(80);
    });

    it("should accumulate deductions from multiple poor metrics", () => {
      mockMonitor.getWebVitals.mockReturnValue({
        LCP: 6000, // -30
        FID: 600, // -20
        CLS: 0.3, // -20
        FCP: 5000, // -15
        TTFB: 3000, // -15
      });
      const { getPerformanceScore } = usePerformanceMonitor();

      expect(getPerformanceScore()).toBe(0); // 100 - 30 - 20 - 20 - 15 - 15 = 0
    });

    it("should never go below 0", () => {
      mockMonitor.getWebVitals.mockReturnValue({
        LCP: 10000,
        FID: 1000,
        CLS: 1.0,
        FCP: 10000,
        TTFB: 10000,
      });
      const { getPerformanceScore } = usePerformanceMonitor();

      expect(getPerformanceScore()).toBe(0);
    });
  });

  describe("getPerformanceGrade", () => {
    it("should return A for score >= 90", () => {
      mockMonitor.getWebVitals.mockReturnValue({});
      const { getPerformanceGrade } = usePerformanceMonitor();
      expect(getPerformanceGrade()).toBe("A");
    });

    it("should return B for score >= 80", () => {
      mockMonitor.getWebVitals.mockReturnValue({ FID: 600 }); // score = 80
      const { getPerformanceGrade } = usePerformanceMonitor();
      expect(getPerformanceGrade()).toBe("B");
    });

    it("should return F for very poor score", () => {
      mockMonitor.getWebVitals.mockReturnValue({
        LCP: 6000,
        FID: 600,
        CLS: 0.3,
        FCP: 5000,
        TTFB: 3000,
      });
      const { getPerformanceGrade } = usePerformanceMonitor();
      expect(getPerformanceGrade()).toBe("F");
    });
  });

  describe("generateReport", () => {
    it("should delegate to monitor.generateReport", () => {
      const { generateReport } = usePerformanceMonitor();
      generateReport();
      expect(mockMonitor.generateReport).toHaveBeenCalledOnce();
    });
  });

  describe("clear", () => {
    it("should clear monitor and reset reactive state", () => {
      const { clear, webVitals, metrics, resources } =
        usePerformanceMonitor();

      clear();

      expect(mockMonitor.clear).toHaveBeenCalledOnce();
      expect(webVitals.value).toEqual({});
      expect(metrics.value).toEqual([]);
      expect(resources.value).toEqual([]);
    });
  });
});
