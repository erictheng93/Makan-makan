/**
 * Performance Regression Detection Script
 *
 * Compares current performance with baseline and detects regressions
 * Usage: ts-node compare-performance.ts [--fail-on-regression]
 */

import {
  DatabasePerformanceTester,
  PerformanceBaselineManager,
} from "./db-performance-tester";
import { createBaseline, BENCHMARK_QUERIES } from "./create-baseline";
import { createTestDB, cleanupTestDB } from "../../helpers/test-db";

interface RegressionConfig {
  warningThreshold: number; // Percentage increase that triggers warning
  failureThreshold: number; // Percentage increase that triggers failure
  failOnRegression: boolean;
}

const DEFAULT_CONFIG: RegressionConfig = {
  warningThreshold: 20, // 20% slower = warning
  failureThreshold: 50, // 50% slower = failure
  failOnRegression: false,
};

async function comparePerformance(config: RegressionConfig = DEFAULT_CONFIG) {
  console.log("🔍 Performance Regression Detection\n");

  // Load baseline
  const baselineManager = new PerformanceBaselineManager();
  const baseline = await baselineManager.loadBaseline();

  if (!baseline) {
    console.log("⚠️  No baseline found. Creating new baseline...\n");
    await createBaseline("v1.0.0");
    console.log(
      "✅ Baseline created. Run this script again to compare performance.",
    );
    return { passed: true, warnings: 0, failures: 0 };
  }

  console.log(`📊 Baseline Version: ${baseline.version}`);
  console.log(
    `📅 Baseline Date: ${new Date(baseline.timestamp).toISOString()}`,
  );
  console.log();

  // Run current benchmarks against the same queries
  console.log("🚀 Running Current Benchmarks...\n");

  const db = await createTestDB();
  const tester = new DatabasePerformanceTester(db);
  const currentResults: Record<string, { avgTime: number; p95Time: number }> =
    {};

  for (const benchmark of BENCHMARK_QUERIES) {
    process.stdout.write(`  [${benchmark.category}] ${benchmark.name}... `);
    try {
      const result = await tester.benchmarkQuery(
        benchmark.query,
        benchmark.params,
        10,
      );
      currentResults[benchmark.name] = {
        avgTime: Math.round(result.avgTime * 100) / 100,
        p95Time: Math.round(result.p95Time * 100) / 100,
      };
      console.log(`${result.avgTime.toFixed(2)}ms`);
    } catch (error: any) {
      console.log(`❌ ${error.message}`);
      currentResults[benchmark.name] = { avgTime: -1, p95Time: -1 };
    }
  }

  await cleanupTestDB(db);
  console.log();

  // Compare
  const comparison = baselineManager.compareWithBaseline(
    currentResults,
    baseline,
  );

  console.log("📈 Performance Comparison:\n");

  let warnings = 0;
  let failures = 0;
  let improvements = 0;
  let stable = 0;

  for (const result of comparison) {
    const percentChange = result.percentageChange;
    let statusIcon = "";
    let statusText = "";

    if (result.status === "improved") {
      statusIcon = "🟢";
      statusText = `↓ ${Math.abs(percentChange).toFixed(1)}% faster`;
      improvements++;
    } else if (result.status === "stable") {
      statusIcon = "🔵";
      statusText = `→ ${Math.abs(percentChange).toFixed(1)}% change`;
      stable++;
    } else {
      // Degraded
      if (percentChange > config.failureThreshold) {
        statusIcon = "🔴";
        statusText = `↑ ${percentChange.toFixed(1)}% SLOWER (FAIL)`;
        failures++;
      } else if (percentChange > config.warningThreshold) {
        statusIcon = "🟡";
        statusText = `↑ ${percentChange.toFixed(1)}% slower (warning)`;
        warnings++;
      } else {
        statusIcon = "🔵";
        statusText = `↑ ${percentChange.toFixed(1)}% slower`;
        stable++;
      }
    }

    console.log(`  ${statusIcon} ${result.queryName}`);
    console.log(
      `     Baseline: ${result.baselineAvg.toFixed(2)}ms → Current: ${result.currentAvg.toFixed(2)}ms`,
    );
    console.log(`     ${statusText}`);
    console.log();
  }

  // Summary
  console.log("━".repeat(60));
  console.log("📊 Summary:\n");
  console.log(`  🟢 Improvements: ${improvements}`);
  console.log(`  🔵 Stable: ${stable}`);
  console.log(`  🟡 Warnings: ${warnings}`);
  console.log(`  🔴 Failures: ${failures}`);
  console.log();

  // Overall result
  const passed = failures === 0;

  if (passed && warnings === 0) {
    console.log("✅ All performance tests PASSED");
  } else if (passed) {
    console.log(`⚠️  Performance tests PASSED with ${warnings} warnings`);
  } else {
    console.log(`❌ Performance tests FAILED with ${failures} regressions`);
  }

  console.log();

  // Details for failures/warnings
  if (failures > 0 || warnings > 0) {
    console.log("📋 Details:\n");

    if (failures > 0) {
      console.log("  🔴 Performance Regressions (Action Required):");
      comparison
        .filter((r) => r.percentageChange > config.failureThreshold)
        .forEach((r) => {
          console.log(
            `     • ${r.queryName}: +${r.percentageChange.toFixed(1)}% (${r.baselineAvg.toFixed(2)}ms → ${r.currentAvg.toFixed(2)}ms)`,
          );
        });
      console.log();
    }

    if (warnings > 0) {
      console.log("  🟡 Performance Warnings (Review Recommended):");
      comparison
        .filter(
          (r) =>
            r.percentageChange > config.warningThreshold &&
            r.percentageChange <= config.failureThreshold,
        )
        .forEach((r) => {
          console.log(
            `     • ${r.queryName}: +${r.percentageChange.toFixed(1)}% (${r.baselineAvg.toFixed(2)}ms → ${r.currentAvg.toFixed(2)}ms)`,
          );
        });
      console.log();
    }

    console.log("  💡 Recommendations:");
    console.log("     • Review query execution plans (EXPLAIN QUERY PLAN)");
    console.log("     • Check for missing or unused indexes");
    console.log("     • Look for N+1 query problems");
    console.log("     • Consider query optimization or caching");
    console.log(
      "     • Run `npm run db:analyze` to update query planner statistics",
    );
    console.log();
  }

  // Fail if configured to do so
  if (!passed && config.failOnRegression) {
    console.log(
      "❌ Failing due to performance regressions (--fail-on-regression)\n",
    );
    process.exit(1);
  }

  return { passed, warnings, failures, improvements, stable };
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const config = { ...DEFAULT_CONFIG };

  if (args.includes("--fail-on-regression")) {
    config.failOnRegression = true;
  }

  if (args.includes("--warning-threshold")) {
    const idx = args.indexOf("--warning-threshold");
    config.warningThreshold = parseInt(args[idx + 1]);
  }

  if (args.includes("--failure-threshold")) {
    const idx = args.indexOf("--failure-threshold");
    config.failureThreshold = parseInt(args[idx + 1]);
  }

  comparePerformance(config).catch((error) => {
    console.error("❌ Error comparing performance:", error);
    process.exit(1);
  });
}

export { comparePerformance };
