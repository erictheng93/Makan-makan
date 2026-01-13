/**
 * usePerformanceMonitor Composable Tests
 * 測試效能監控功能的核心邏輯
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
} from "vitest";

// Use vi.hoisted for mock data that needs to be available in vi.mock factories
const mockMonitor = vi.hoisted(() => ({
  getWebVitals: vi.fn().mockReturnValue({
    LCP: 2000,
    FID: 50,
    CLS: 0.05,
    FCP: 1500,
    TTFB: 600,
  }),
  getMetrics: vi.fn().mockReturnValue([]),
  getResourceTimings: vi.fn().mockReturnValue([]),
  disconnect: vi.fn(),
  mark: vi.fn(),
  measureBetween: vi.fn(),
  measure: vi
    .fn()
    .mockImplementation(async (_name: string, fn: () => any) => fn()),
  trackMetric: vi.fn(),
  generateReport: vi.fn().mockReturnValue({
    timestamp: Date.now(),
    url: "http://localhost",
    webVitals: { LCP: 2000 },
    metrics: [],
    resources: [],
  }),
  clear: vi.fn(),
}));

vi.mock("@makanmakan/utils", () => ({
  getPerformanceMonitor: vi.fn().mockReturnValue(mockMonitor),
}));

// Mock Vue lifecycle hooks
vi.mock("vue", async () => {
  const actual = await vi.importActual<typeof import("vue")>("vue");
  return {
    ...actual,
    onMounted: vi.fn((cb: () => void) => cb()),
    onBeforeUnmount: vi.fn(),
  };
});

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({ ok: true }) as typeof fetch;

// Variable to hold the imported module
let usePerformanceMonitor: typeof import("../usePerformanceMonitor").usePerformanceMonitor;

describe("usePerformanceMonitor", () => {
  beforeAll(async () => {
    // Import after mocks are set up
    const module = await import("../usePerformanceMonitor");
    usePerformanceMonitor = module.usePerformanceMonitor;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("初始化", () => {
    it("應該正確初始化並返回所有必需的屬性", () => {
      const {
        monitor,
        webVitals,
        metrics,
        resources,
        trackRouteChange,
        trackApiRequest,
        trackComponentRender,
        getPerformanceScore,
        getPerformanceGrade,
        generateReport,
        clear,
      } = usePerformanceMonitor();

      expect(monitor).toBeDefined();
      expect(webVitals).toBeDefined();
      expect(metrics).toBeDefined();
      expect(resources).toBeDefined();
      expect(trackRouteChange).toBeInstanceOf(Function);
      expect(trackApiRequest).toBeInstanceOf(Function);
      expect(trackComponentRender).toBeInstanceOf(Function);
      expect(getPerformanceScore).toBeInstanceOf(Function);
      expect(getPerformanceGrade).toBeInstanceOf(Function);
      expect(generateReport).toBeInstanceOf(Function);
      expect(clear).toBeInstanceOf(Function);
    });

    it("應該在掛載時獲取初始指標", () => {
      usePerformanceMonitor();

      expect(mockMonitor.getWebVitals).toHaveBeenCalled();
      expect(mockMonitor.getMetrics).toHaveBeenCalled();
      expect(mockMonitor.getResourceTimings).toHaveBeenCalled();
    });
  });

  describe("getPerformanceScore", () => {
    it("良好指標應該返回高分數", () => {
      mockMonitor.getWebVitals.mockReturnValue({
        LCP: 2000, // Good < 2500
        FID: 50, // Good < 100
        CLS: 0.05, // Good < 0.1
        FCP: 1500, // Good < 1800
        TTFB: 600, // Good < 800
      });

      const { getPerformanceScore } = usePerformanceMonitor();
      const score = getPerformanceScore();

      expect(score).toBeGreaterThanOrEqual(90);
    });

    it("較差的 LCP 應該降低分數", () => {
      mockMonitor.getWebVitals.mockReturnValue({
        LCP: 5000, // Poor > 4000 (-30)
        FID: 50,
        CLS: 0.05,
        FCP: 1500,
        TTFB: 600,
      });

      const { getPerformanceScore } = usePerformanceMonitor();
      const score = getPerformanceScore();

      expect(score).toBeLessThan(80);
    });

    it("較差的 FID 應該降低分數", () => {
      mockMonitor.getWebVitals.mockReturnValue({
        LCP: 2000,
        FID: 400, // Poor > 300 (-20)
        CLS: 0.05,
        FCP: 1500,
        TTFB: 600,
      });

      const { getPerformanceScore } = usePerformanceMonitor();
      const score = getPerformanceScore();

      expect(score).toBeLessThan(90);
    });

    it("較差的 CLS 應該降低分數", () => {
      mockMonitor.getWebVitals.mockReturnValue({
        LCP: 2000,
        FID: 50,
        CLS: 0.3, // Poor > 0.25 (-20)
        FCP: 1500,
        TTFB: 600,
      });

      const { getPerformanceScore } = usePerformanceMonitor();
      const score = getPerformanceScore();

      expect(score).toBeLessThan(90);
    });

    it("多個較差指標應該累積扣分", () => {
      mockMonitor.getWebVitals.mockReturnValue({
        LCP: 5000, // Poor: -30
        FID: 400, // Poor: -20
        CLS: 0.3, // Poor: -20
        FCP: 4000, // Poor: -15
        TTFB: 2000, // Poor: -15
      });

      const { getPerformanceScore } = usePerformanceMonitor();
      const score = getPerformanceScore();

      expect(score).toBe(0); // 100 - 30 - 20 - 20 - 15 - 15 = 0
    });

    it("分數不應低於 0", () => {
      mockMonitor.getWebVitals.mockReturnValue({
        LCP: 10000,
        FID: 1000,
        CLS: 1.0,
        FCP: 10000,
        TTFB: 5000,
      });

      const { getPerformanceScore } = usePerformanceMonitor();
      const score = getPerformanceScore();

      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe("getPerformanceGrade", () => {
    it("分數 >= 90 應該返回 A", () => {
      mockMonitor.getWebVitals.mockReturnValue({
        LCP: 2000,
        FID: 50,
        CLS: 0.05,
        FCP: 1500,
        TTFB: 600,
      });

      const { getPerformanceGrade } = usePerformanceMonitor();
      expect(getPerformanceGrade()).toBe("A");
    });

    it("分數 80-89 應該返回 B", () => {
      mockMonitor.getWebVitals.mockReturnValue({
        LCP: 3000, // -15
        FID: 50,
        CLS: 0.05,
        FCP: 1500,
        TTFB: 600,
      });

      const { getPerformanceGrade } = usePerformanceMonitor();
      expect(getPerformanceGrade()).toBe("B");
    });

    it("分數 < 60 應該返回 F", () => {
      mockMonitor.getWebVitals.mockReturnValue({
        LCP: 5000, // -30
        FID: 400, // -20
        CLS: 0.3, // -20
        FCP: 3000,
        TTFB: 1000,
      });

      const { getPerformanceGrade } = usePerformanceMonitor();
      const grade = getPerformanceGrade();
      expect(["D", "F"]).toContain(grade);
    });
  });

  describe("trackRouteChange", () => {
    it("應該標記路由變更的開始和結束", () => {
      const { trackRouteChange } = usePerformanceMonitor();

      // Mock requestAnimationFrame
      vi.spyOn(global, "requestAnimationFrame").mockImplementation((cb) => {
        cb(0);
        return 0;
      });

      trackRouteChange("/home", "/dashboard");

      expect(mockMonitor.mark).toHaveBeenCalledWith("route-/dashboard-start");
    });
  });

  describe("trackApiRequest", () => {
    it("應該追蹤 API 請求效能", async () => {
      const { trackApiRequest } = usePerformanceMonitor();

      const mockApiCall = vi.fn().mockResolvedValue({ data: "test" });

      const result = await trackApiRequest("/users", mockApiCall);

      expect(mockMonitor.measure).toHaveBeenCalled();
      expect(mockApiCall).toHaveBeenCalled();
      expect(result).toEqual({ data: "test" });
    });
  });

  describe("trackComponentRender", () => {
    it("應該追蹤組件渲染效能", async () => {
      const { trackComponentRender } = usePerformanceMonitor();

      const mockRenderFn = vi.fn().mockReturnValue("rendered");

      const result = await trackComponentRender("TestComponent", mockRenderFn);

      expect(mockMonitor.measure).toHaveBeenCalled();
      expect(mockRenderFn).toHaveBeenCalled();
      expect(result).toBe("rendered");
    });
  });

  describe("generateReport", () => {
    it("應該生成效能報告", () => {
      const { generateReport } = usePerformanceMonitor();

      const report = generateReport();

      expect(mockMonitor.generateReport).toHaveBeenCalled();
      expect(report).toHaveProperty("timestamp");
      expect(report).toHaveProperty("url");
      expect(report).toHaveProperty("webVitals");
    });
  });

  describe("clear", () => {
    it("應該清除所有指標", () => {
      const { clear, webVitals, metrics, resources } = usePerformanceMonitor();

      clear();

      expect(mockMonitor.clear).toHaveBeenCalled();
      expect(webVitals.value).toEqual({});
      expect(metrics.value).toEqual([]);
      expect(resources.value).toEqual([]);
    });
  });

  describe("定期更新", () => {
    it("應該每 5 秒更新一次指標", () => {
      usePerformanceMonitor();

      // 快轉 5 秒
      vi.advanceTimersByTime(5000);

      // getWebVitals 應該被調用（初始 + 更新）
      expect(mockMonitor.getWebVitals).toHaveBeenCalledTimes(2);
    });
  });
});
