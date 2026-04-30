import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ErrorReport } from "@/services/errorReportingService";

const { mockApiPost } = vi.hoisted(() => ({
  mockApiPost: vi.fn(),
}));

vi.mock("@/services/authApi", () => ({
  apiClient: {
    post: mockApiPost,
  },
}));

// Mock performanceService before importing the module under test
vi.mock("../performanceService", () => ({
  performanceService: {
    recordMetric: vi.fn(),
  },
}));

// Declare the type alias for convenience
type ErrorReportingServiceType = any;
type ErrorReportType = ErrorReport;

// Helper to create a fresh instance by resetting modules
async function createFreshService(): Promise<{
  errorReportingService: ErrorReportingServiceType;
  performanceService: { recordMetric: ReturnType<typeof vi.fn> };
}> {
  vi.resetModules();
  const mod = await import("@/services/errorReportingService");
  const perfMod = await import("../performanceService");
  return {
    errorReportingService:
      mod.errorReportingService as ErrorReportingServiceType,
    performanceService: {
      recordMetric: vi.mocked(perfMod.performanceService.recordMetric),
    },
  };
}

// Helper to build a mock ErrorReport
function createMockReport(
  overrides: Partial<ErrorReportType> = {},
): ErrorReportType {
  return {
    id: `error_${Date.now()}_mock`,
    timestamp: new Date().toISOString(),
    error: { name: "Error", message: "test error" },
    context: { url: "http://localhost/kitchen", userAgent: "test-agent" },
    systemInfo: {
      appVersion: "1.0.0",
      networkStatus: "online",
      storageAvailable: true,
    },
    severity: "low",
    resolved: false,
    tags: ["general"],
    ...overrides,
  };
}

describe("ErrorReportingService", () => {
  let service: ErrorReportingServiceType;
  let perfService: { recordMetric: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();

    // Suppress console output during tests
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    mockApiPost.mockReset();
    mockApiPost.mockResolvedValue({ data: {} });

    // Mock __APP_VERSION__
    vi.stubGlobal("__APP_VERSION__", "1.0.0-test");

    const result = await createFreshService();
    service = result.errorReportingService;
    perfService = result.performanceService;
  });

  afterEach(() => {
    service.cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // -----------------------------------------------------------------------
  // reportError
  // -----------------------------------------------------------------------
  describe("reportError", () => {
    it("should report an Error object and return a report id", () => {
      const error = new Error("Something went wrong");
      const id = service.reportError(error);

      expect(id).toBeDefined();
      expect(id).toMatch(/^error_/);
      expect(service.errorReports.value).toHaveLength(1);
      expect(service.errorReports.value[0].error.message).toBe(
        "Something went wrong",
      );
      expect(service.errorReports.value[0].error.name).toBe("Error");
    });

    it("should report a string by converting it to an Error", () => {
      const id = service.reportError("string error message");

      expect(id).toBeDefined();
      expect(service.errorReports.value).toHaveLength(1);
      expect(service.errorReports.value[0].error.message).toBe(
        "string error message",
      );
      expect(service.errorReports.value[0].error.name).toBe("Error");
    });

    it("should merge provided context into the report", () => {
      const id = service.reportError(new Error("ctx test"), {
        component: "OrderCard",
        action: "submitOrder",
        user: "chef-1",
      });

      expect(id).toBeDefined();
      const report = service.errorReports.value[0];
      expect(report.context.component).toBe("OrderCard");
      expect(report.context.action).toBe("submitOrder");
      expect(report.context.user).toBe("chef-1");
      expect(report.context.url).toBeDefined();
      expect(report.context.userAgent).toBeDefined();
    });

    it("should call performanceService.recordMetric on each report", () => {
      service.reportError(new Error("metric test"));

      expect(perfService.recordMetric).toHaveBeenCalledWith(
        "error_occurrence",
        1,
        "count",
        "system",
      );
    });
  });

  // -----------------------------------------------------------------------
  // determineSeverity (tested indirectly)
  // -----------------------------------------------------------------------
  describe("determineSeverity", () => {
    it("should classify TypeError as medium", () => {
      const err = new TypeError("Cannot read properties of undefined");
      service.reportError(err);
      expect(service.errorReports.value[0].severity).toBe("medium");
    });

    it("should classify SecurityError as critical", () => {
      const err = new DOMException("blocked", "SecurityError");
      // DOMException.name is 'SecurityError'
      service.reportError(err as unknown as Error);
      expect(service.errorReports.value[0].severity).toBe("critical");
    });

    it("should classify ReferenceError as high", () => {
      const err = new ReferenceError("x is not defined");
      service.reportError(err);
      expect(service.errorReports.value[0].severity).toBe("high");
    });

    it("should classify SyntaxError as high", () => {
      const err = new SyntaxError("Unexpected token");
      service.reportError(err);
      expect(service.errorReports.value[0].severity).toBe("high");
    });

    it("should classify errors with 'fetch' in message as medium", () => {
      const err = new Error("fetch failed for /api/orders");
      service.reportError(err);
      expect(service.errorReports.value[0].severity).toBe("medium");
    });

    it("should classify errors with 'network' in message as medium", () => {
      const err = new Error("network timeout occurred");
      service.reportError(err);
      expect(service.errorReports.value[0].severity).toBe("medium");
    });

    it("should classify errors with 'permission' in message as critical", () => {
      const err = new Error("permission denied for resource");
      service.reportError(err);
      expect(service.errorReports.value[0].severity).toBe("critical");
    });

    it("should classify errors with 'unauthorized' in message as critical", () => {
      const err = new Error("unauthorized access attempt");
      service.reportError(err);
      expect(service.errorReports.value[0].severity).toBe("critical");
    });

    it("should default to low severity for unknown errors", () => {
      const err = new Error("some random error");
      service.reportError(err);
      expect(service.errorReports.value[0].severity).toBe("low");
    });
  });

  // -----------------------------------------------------------------------
  // generateTags (tested indirectly)
  // -----------------------------------------------------------------------
  describe("generateTags", () => {
    it("should use known category tags for TypeError", () => {
      const err = new TypeError("type issue");
      service.reportError(err);
      const tags = service.errorReports.value[0].tags;
      expect(tags).toContain("code");
      expect(tags).toContain("runtime");
    });

    it("should add order-management tag when message contains 'order'", () => {
      const err = new Error("order processing failed");
      service.reportError(err);
      expect(service.errorReports.value[0].tags).toContain("order-management");
    });

    it("should add audio-system tag when message contains 'audio'", () => {
      const err = new Error("audio playback error");
      service.reportError(err);
      expect(service.errorReports.value[0].tags).toContain("audio-system");
    });

    it("should add offline-mode tag when message contains 'offline'", () => {
      const err = new Error("offline sync failed");
      service.reportError(err);
      expect(service.errorReports.value[0].tags).toContain("offline-mode");
    });

    it("should add routing tag when stack contains 'vue-router'", () => {
      const err = new Error("navigation error");
      err.stack =
        "Error: navigation error\n    at vue-router/dist/index.js:123";
      service.reportError(err);
      expect(service.errorReports.value[0].tags).toContain("routing");
    });

    it("should add state-management tag when stack contains 'pinia'", () => {
      const err = new Error("store error");
      err.stack = "Error: store error\n    at pinia/dist/index.js:456";
      service.reportError(err);
      expect(service.errorReports.value[0].tags).toContain("state-management");
    });

    it("should deduplicate tags", () => {
      // An error with category tags that might also match message patterns
      const err = new TypeError("order type issue");
      service.reportError(err);
      const tags = service.errorReports.value[0].tags;
      const uniqueTags = [...new Set(tags)];
      expect(tags).toEqual(uniqueTags);
    });
  });

  // -----------------------------------------------------------------------
  // collectSystemInfo (tested indirectly)
  // -----------------------------------------------------------------------
  describe("collectSystemInfo", () => {
    it("should report online status when navigator.onLine is true", () => {
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: true,
      });
      service.reportError(new Error("online test"));
      expect(service.errorReports.value[0].systemInfo.networkStatus).toBe(
        "online",
      );
    });

    it("should report offline status when navigator.onLine is false", async () => {
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: false,
      });
      // Need fresh service since constructor already ran
      service.reportError(new Error("offline test"));
      expect(service.errorReports.value[0].systemInfo.networkStatus).toBe(
        "offline",
      );
    });

    it("should include appVersion from __APP_VERSION__", () => {
      service.reportError(new Error("version test"));
      expect(service.errorReports.value[0].systemInfo.appVersion).toBe(
        "1.0.0-test",
      );
    });

    it("should include storageAvailable status", () => {
      service.reportError(new Error("storage test"));
      expect(
        service.errorReports.value[0].systemInfo.storageAvailable,
      ).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // processError (tested indirectly)
  // -----------------------------------------------------------------------
  describe("processError", () => {
    it("should limit stored reports to MAX_STORED_ERRORS (100)", () => {
      // Report 105 errors
      for (let i = 0; i < 105; i++) {
        service.reportError(new Error(`error #${i}`));
      }
      expect(service.errorReports.value.length).toBeLessThanOrEqual(100);
    });

    it("should add new reports at the front (most recent first)", () => {
      service.reportError(new Error("first error"));
      service.reportError(new Error("second error"));

      expect(service.errorReports.value[0].error.message).toBe("second error");
      expect(service.errorReports.value[1].error.message).toBe("first error");
    });

    it("should send report immediately in immediate mode", async () => {
      service.reportingMode.value = "immediate";
      service.reportError(new Error("immediate test"));

      // sendErrorReport calls fetch
      await vi.advanceTimersByTimeAsync(0);
      expect(mockApiPost).toHaveBeenCalledWith(
        "/system/errors",
        expect.objectContaining({
          error: expect.objectContaining({ message: "immediate test" }),
        }),
      );
    });

    it("should add report to batch queue in batch mode", () => {
      service.reportingMode.value = "batch";
      service.reportError(new Error("batch test"));

      // The error should be stored but not immediately sent via direct fetch
      // (batch sends through the shared API client when flushed)
      expect(service.errorReports.value).toHaveLength(1);
    });

    it("should only store report in offline mode without sending", async () => {
      service.reportingMode.value = "offline";
      service.reportError(new Error("offline test"));

      await vi.advanceTimersByTimeAsync(0);
      // In offline mode, no API call should occur
      // (unless it is also a critical error which always sends)
      const directCalls = mockApiPost.mock.calls.filter(
        (call: any[]) => call[0] === "/system/errors",
      );
      // Offline mode: no direct sends for low-severity errors
      expect(directCalls.length).toBe(0);
    });

    it("should always send critical errors immediately regardless of mode", async () => {
      service.reportingMode.value = "offline";

      // Create a SecurityError which maps to critical severity
      const err = new DOMException("security breach", "SecurityError");
      service.reportError(err as unknown as Error);

      await vi.advanceTimersByTimeAsync(0);
      // handleCriticalError sends via sendErrorReport
      expect(mockApiPost).toHaveBeenCalledWith(
        "/system/errors",
        expect.objectContaining({
          error: expect.objectContaining({ name: "SecurityError" }),
        }),
      );
    });

    it("should save errors to localStorage after processing", () => {
      service.reportError(new Error("save test"));

      expect(localStorage.setItem).toHaveBeenCalledWith(
        "kitchen-error-reports",
        expect.any(String),
      );
    });
  });

  // -----------------------------------------------------------------------
  // getErrorStats
  // -----------------------------------------------------------------------
  describe("getErrorStats", () => {
    it("should return empty stats when no errors exist", () => {
      const stats = service.getErrorStats();

      expect(stats.totalErrors).toBe(0);
      expect(stats.errorsByType).toEqual({});
      expect(stats.errorsBySeverity).toEqual({});
      expect(stats.recentErrors).toEqual([]);
      expect(stats.errorRate).toBe(0);
    });

    it("should calculate totals and group by type and severity", () => {
      service.reportError(new TypeError("type err 1"));
      service.reportError(new TypeError("type err 2"));
      service.reportError(new ReferenceError("ref err"));

      const stats = service.getErrorStats();

      expect(stats.totalErrors).toBe(3);
      expect(stats.errorsByType["TypeError"]).toBe(2);
      expect(stats.errorsByType["ReferenceError"]).toBe(1);
      expect(stats.errorsBySeverity["medium"]).toBe(2); // TypeErrors
      expect(stats.errorsBySeverity["high"]).toBe(1); // ReferenceError
    });

    it("should include recent errors from within the last hour", () => {
      const now = new Date("2026-02-06T12:00:00Z");
      vi.setSystemTime(now);

      service.reportError(new Error("recent error"));

      const stats = service.getErrorStats();
      expect(stats.recentErrors.length).toBe(1);
      expect(stats.errorRate).toBe(1);
    });

    it("should exclude errors older than 1 hour from recent", () => {
      // Set time to a known point
      const pastTime = new Date("2026-02-06T10:00:00Z");
      vi.setSystemTime(pastTime);

      service.reportError(new Error("old error"));

      // Advance time by more than 1 hour
      const futureTime = new Date("2026-02-06T11:30:00Z");
      vi.setSystemTime(futureTime);

      const stats = service.getErrorStats();
      expect(stats.recentErrors.length).toBe(0);
      expect(stats.errorRate).toBe(0);
      // But totalErrors still counts it
      expect(stats.totalErrors).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // resolveError
  // -----------------------------------------------------------------------
  describe("resolveError", () => {
    it("should mark an error as resolved", () => {
      const id = service.reportError(new Error("to resolve"));
      expect(service.errorReports.value[0].resolved).toBe(false);

      service.resolveError(id);

      expect(service.errorReports.value[0].resolved).toBe(true);
    });

    it("should be a no-op for non-existent error id", () => {
      service.reportError(new Error("existing"));
      const _initialState = JSON.stringify(service.errorReports.value);

      service.resolveError("non_existent_id");

      // State should not change (other than potential save calls)
      expect(service.errorReports.value[0].resolved).toBe(false);
    });

    it("should save after resolving", () => {
      const id = service.reportError(new Error("resolve save test"));
      vi.clearAllMocks();

      service.resolveError(id);

      expect(localStorage.setItem).toHaveBeenCalledWith(
        "kitchen-error-reports",
        expect.any(String),
      );
    });
  });

  // -----------------------------------------------------------------------
  // clearErrors
  // -----------------------------------------------------------------------
  describe("clearErrors", () => {
    it("should empty the error reports array and save", () => {
      service.reportError(new Error("err 1"));
      service.reportError(new Error("err 2"));
      expect(service.errorReports.value.length).toBe(2);

      service.clearErrors();

      expect(service.errorReports.value).toEqual([]);
      expect(localStorage.setItem).toHaveBeenCalledWith(
        "kitchen-error-reports",
        "[]",
      );
    });
  });

  // -----------------------------------------------------------------------
  // exportErrors
  // -----------------------------------------------------------------------
  describe("exportErrors", () => {
    it("should return a JSON string of all error reports", () => {
      service.reportError(new Error("export test"));

      const exported = service.exportErrors();
      const parsed = JSON.parse(exported);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].error.message).toBe("export test");
    });

    it("should return '[]' when there are no errors", () => {
      const exported = service.exportErrors();
      expect(exported).toBe("[]");
    });
  });

  // -----------------------------------------------------------------------
  // importErrors
  // -----------------------------------------------------------------------
  describe("importErrors", () => {
    it("should import valid error report data", async () => {
      const reports = [createMockReport({ id: "imported_1" })];
      const result = await service.importErrors(JSON.stringify(reports));

      expect(result).toBe(true);
      expect(service.errorReports.value).toHaveLength(1);
      expect(service.errorReports.value[0].id).toBe("imported_1");
    });

    it("should return false for invalid JSON", async () => {
      const result = await service.importErrors("not valid json {{{");

      expect(result).toBe(false);
    });

    it("should return false for non-array JSON data", async () => {
      const result = await service.importErrors(
        JSON.stringify({ not: "an array" }),
      );

      expect(result).toBe(false);
    });

    it("should replace existing errors on successful import", async () => {
      service.reportError(new Error("existing"));
      expect(service.errorReports.value).toHaveLength(1);

      const newReports = [
        createMockReport({ id: "new_1" }),
        createMockReport({ id: "new_2" }),
      ];
      await service.importErrors(JSON.stringify(newReports));

      expect(service.errorReports.value).toHaveLength(2);
      expect(service.errorReports.value[0].id).toBe("new_1");
    });

    it("should save to localStorage after successful import", async () => {
      vi.clearAllMocks();
      const reports = [createMockReport()];
      await service.importErrors(JSON.stringify(reports));

      expect(localStorage.setItem).toHaveBeenCalledWith(
        "kitchen-error-reports",
        expect.any(String),
      );
    });
  });

  // -----------------------------------------------------------------------
  // getErrorInsights
  // -----------------------------------------------------------------------
  describe("getErrorInsights", () => {
    it("should return top error types with percentages", () => {
      service.reportError(new TypeError("type 1"));
      service.reportError(new TypeError("type 2"));
      service.reportError(new TypeError("type 3"));
      service.reportError(new ReferenceError("ref 1"));

      const insights = service.getErrorInsights();

      expect(insights.topErrorTypes.length).toBeGreaterThan(0);
      // TypeError should be top with 3/4 = 75%
      const typeErrorEntry = insights.topErrorTypes.find(
        (t: any) => t.type === "TypeError",
      );
      expect(typeErrorEntry).toBeDefined();
      expect(typeErrorEntry!.count).toBe(3);
      expect(typeErrorEntry!.percentage).toBe(75);
    });

    it("should limit topErrorTypes to 5 entries", () => {
      // Create 6 different error types
      const errorTypes = [
        TypeError,
        ReferenceError,
        RangeError,
        URIError,
        EvalError,
        SyntaxError,
      ];
      errorTypes.forEach((ErrType, i) => {
        service.reportError(new ErrType(`err ${i}`));
      });
      // Add an extra generic Error
      service.reportError(new Error("generic"));

      const insights = service.getErrorInsights();
      expect(insights.topErrorTypes.length).toBeLessThanOrEqual(5);
    });

    it("should return error trends for the last 7 days", () => {
      vi.setSystemTime(new Date("2026-02-06T12:00:00Z"));
      service.reportError(new Error("today's error"));

      const insights = service.getErrorInsights();

      expect(insights.errorTrends).toHaveLength(7);
      // Each trend entry should have date and count
      insights.errorTrends.forEach((trend: any) => {
        expect(trend).toHaveProperty("date");
        expect(trend).toHaveProperty("count");
      });

      // The last day (today) should have count >= 1
      const todayTrend = insights.errorTrends.find(
        (t: any) => t.date === "2026-02-06",
      );
      expect(todayTrend).toBeDefined();
      expect(todayTrend!.count).toBeGreaterThanOrEqual(1);
    });

    it("should return unresolved critical errors", () => {
      // Create a critical error (SecurityError)
      const err = new DOMException("security issue", "SecurityError");
      service.reportError(err as unknown as Error);

      const insights = service.getErrorInsights();

      expect(insights.criticalErrors.length).toBe(1);
      expect(insights.criticalErrors[0].severity).toBe("critical");
      expect(insights.criticalErrors[0].resolved).toBe(false);
    });

    it("should not include resolved critical errors in criticalErrors", () => {
      const err = new DOMException("security", "SecurityError");
      const id = service.reportError(err as unknown as Error);
      service.resolveError(id);

      const insights = service.getErrorInsights();
      expect(insights.criticalErrors.length).toBe(0);
    });

    it("should generate recommendations for NetworkError", () => {
      // Manually insert a report with NetworkError name
      const report = createMockReport({
        error: { name: "NetworkError", message: "network fail" },
        severity: "medium",
        tags: ["network", "api"],
      });
      service.errorReports.value.push(report);

      const insights = service.getErrorInsights();
      expect(
        insights.recommendations.some((r: any) => r.includes("網路連線")),
      ).toBe(true);
    });

    it("should generate recommendations for TimeoutError", () => {
      const report = createMockReport({
        error: { name: "TimeoutError", message: "timeout" },
        severity: "medium",
        tags: ["performance", "network"],
      });
      service.errorReports.value.push(report);

      const insights = service.getErrorInsights();
      expect(
        insights.recommendations.some((r: any) => r.includes("API響應時間")),
      ).toBe(true);
    });

    it("should generate recommendations for TypeError", () => {
      service.reportError(new TypeError("null check missing"));

      const insights = service.getErrorInsights();
      expect(
        insights.recommendations.some((r: any) => r.includes("類型檢查")),
      ).toBe(true);
    });

    it("should generate recommendations for ChunkLoadError", () => {
      const report = createMockReport({
        error: { name: "ChunkLoadError", message: "chunk load fail" },
        severity: "high",
        tags: ["deployment", "build"],
      });
      service.errorReports.value.push(report);

      const insights = service.getErrorInsights();
      expect(
        insights.recommendations.some((r: any) => r.includes("部署配置")),
      ).toBe(true);
    });

    it("should generate recommendations for QuotaExceededError", () => {
      const report = createMockReport({
        error: { name: "QuotaExceededError", message: "quota exceeded" },
        severity: "low",
        tags: ["storage", "limit"],
      });
      service.errorReports.value.push(report);

      const insights = service.getErrorInsights();
      expect(
        insights.recommendations.some((r: any) => r.includes("數據清理")),
      ).toBe(true);
    });

    it("should generate high error rate recommendation when rate exceeds 10", () => {
      vi.setSystemTime(new Date("2026-02-06T12:00:00Z"));
      // Generate more than 10 errors within the last hour
      for (let i = 0; i < 12; i++) {
        service.reportError(new Error(`rate error ${i}`));
      }

      const insights = service.getErrorInsights();
      expect(
        insights.recommendations.some((r: any) => r.includes("錯誤率偏高")),
      ).toBe(true);
    });

    it("should return default recommendation when system is healthy", () => {
      // No errors reported, empty system
      const insights = service.getErrorInsights();
      expect(insights.recommendations).toContain("系統運行良好，持續監控即可");
    });
  });

  // -----------------------------------------------------------------------
  // submitErrorReport
  // -----------------------------------------------------------------------
  describe("submitErrorReport", () => {
    it("should POST custom report and return true on success", async () => {
      const customReport = { type: "custom", data: "test" };
      const result = await service.submitErrorReport(customReport);

      expect(result).toBe(true);
      expect(mockApiPost).toHaveBeenCalledWith("/system/errors", customReport);
    });

    it("should return false on network failure", async () => {
      mockApiPost.mockRejectedValueOnce(new Error("Network error"));

      const result = await service.submitErrorReport({ data: "test" });

      expect(result).toBe(false);
    });

    it("should return false when the API client rejects", async () => {
      mockApiPost.mockRejectedValueOnce({ response: { status: 500 } });

      const result = await service.submitErrorReport({ data: "test" });

      expect(result).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Batch processing
  // -----------------------------------------------------------------------
  describe("batch processing", () => {
    it("should trigger processBatch when batch reaches BATCH_SIZE (10)", async () => {
      service.reportingMode.value = "batch";

      for (let i = 0; i < 10; i++) {
        service.reportError(new Error(`batch err ${i}`));
      }

      // processBatch sends batched reports through the shared API client
      await vi.advanceTimersByTimeAsync(0);
      expect(mockApiPost).toHaveBeenCalledWith(
        "/system/errors",
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              error: expect.objectContaining({ message: "batch err 0" }),
            }),
          ]),
        }),
      );
    });

    it("should process batch on 30s timer interval", async () => {
      service.reportingMode.value = "batch";

      // Add some errors but not enough to trigger batch size
      for (let i = 0; i < 3; i++) {
        service.reportError(new Error(`timer err ${i}`));
      }

      // Initially no batch send (batch size not reached)
      const batchCallsBefore = mockApiPost.mock.calls.filter((c: any[]) =>
        Array.isArray(c[1]?.errors),
      ).length;

      // Advance timer by 30 seconds
      await vi.advanceTimersByTimeAsync(30000);

      const batchCallsAfter = mockApiPost.mock.calls.filter((c: any[]) =>
        Array.isArray(c[1]?.errors),
      ).length;

      expect(batchCallsAfter).toBeGreaterThan(batchCallsBefore);
    });

    it("should not send batch when queue is empty on timer", async () => {
      service.reportingMode.value = "batch";

      const callsBefore = mockApiPost.mock.calls.length;

      // Advance timer without adding any errors
      await vi.advanceTimersByTimeAsync(30000);

      const callsAfter = mockApiPost.mock.calls.length;

      expect(callsAfter).toBe(callsBefore);
    });
  });

  // -----------------------------------------------------------------------
  // cleanup
  // -----------------------------------------------------------------------
  describe("cleanup", () => {
    it("should clear the batch timer", () => {
      const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
      service.cleanup();
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it("should process remaining batch items on cleanup", async () => {
      service.reportingMode.value = "batch";
      // Add a few errors to the batch queue
      for (let i = 0; i < 3; i++) {
        service.reportError(new Error(`cleanup err ${i}`));
      }

      service.cleanup();

      // processBatch should have been triggered for remaining items
      await vi.advanceTimersByTimeAsync(0);
      expect(mockApiPost).toHaveBeenCalledWith(
        "/system/errors",
        expect.objectContaining({
          errors: expect.arrayContaining([
            expect.objectContaining({
              error: expect.objectContaining({ message: "cleanup err 0" }),
            }),
          ]),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // localStorage persistence
  // -----------------------------------------------------------------------
  describe("localStorage persistence", () => {
    it("should load stored errors from localStorage on construction", async () => {
      const storedReports = [
        createMockReport({ id: "stored_1" }),
        createMockReport({ id: "stored_2" }),
      ];
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValueOnce(
        JSON.stringify(storedReports),
      );

      const { errorReportingService: freshService } =
        await createFreshService();

      expect(freshService.errorReports.value).toHaveLength(2);
      expect(freshService.errorReports.value[0].id).toBe("stored_1");

      freshService.cleanup();
    });

    it("should limit loaded errors to MAX_STORED_ERRORS (100)", async () => {
      const manyReports = Array.from({ length: 120 }, (_, i) =>
        createMockReport({ id: `stored_${i}` }),
      );
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValueOnce(
        JSON.stringify(manyReports),
      );

      const { errorReportingService: freshService } =
        await createFreshService();

      expect(freshService.errorReports.value.length).toBeLessThanOrEqual(100);

      freshService.cleanup();
    });

    it("should handle corrupted localStorage data gracefully", async () => {
      (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValueOnce(
        "corrupted{{{data",
      );

      const { errorReportingService: freshService } =
        await createFreshService();

      // Should not throw, errors array should be empty
      expect(freshService.errorReports.value).toEqual([]);

      freshService.cleanup();
    });
  });
});
