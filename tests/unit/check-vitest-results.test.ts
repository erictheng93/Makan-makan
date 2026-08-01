import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { evaluateVitestResults, formatVitestSummary } =
  require("../../scripts/check-vitest-results.cjs") as {
    evaluateVitestResults: (results: Record<string, unknown>) => {
      ok: boolean;
      failures: string[];
    };
    formatVitestSummary: (results: Record<string, unknown>) => string;
  };

describe("check-vitest-results", () => {
  it("rejects a run with failed suites even when no test failed", () => {
    const result = evaluateVitestResults({
      success: false,
      numTotalTestSuites: 12,
      numPassedTestSuites: 6,
      numFailedTestSuites: 6,
      numPendingTestSuites: 0,
      numTotalTests: 177,
      numPassedTests: 0,
      numFailedTests: 0,
      numPendingTests: 177,
    });

    expect(result.ok).toBe(false);
    expect(result.failures).toContain("Vitest reported success=false");
    expect(result.failures).toContain("Vitest reported 6 failed test suites");
  });

  it("accepts a successful run with no failed suites", () => {
    const result = evaluateVitestResults({
      success: true,
      numTotalTestSuites: 12,
      numPassedTestSuites: 12,
      numFailedTestSuites: 0,
      numPendingTestSuites: 0,
      numTotalTests: 177,
      numPassedTests: 177,
      numFailedTests: 0,
      numPendingTests: 0,
    });

    expect(result).toEqual({ ok: true, failures: [] });
  });

  it("shows suite counts separately from test counts in the summary", () => {
    const summary = formatVitestSummary({
      success: false,
      numTotalTestSuites: 12,
      numPassedTestSuites: 6,
      numFailedTestSuites: 6,
      numPendingTestSuites: 0,
      numTotalTests: 177,
      numPassedTests: 0,
      numFailedTests: 0,
      numPendingTests: 177,
    });

    expect(summary).toContain("| Suites | 12 | 6 | 6 | 0 |");
    expect(summary).toContain("| Tests | 177 | 0 | 0 | 177 |");
    expect(summary).toContain("❌ Vitest result guard failed");
  });

  it("rejects malformed reports instead of treating missing counts as zero", () => {
    const result = evaluateVitestResults({ success: true });

    expect(result.ok).toBe(false);
    expect(result.failures).toContain(
      "Vitest report is missing a valid numFailedTestSuites",
    );
  });
});
