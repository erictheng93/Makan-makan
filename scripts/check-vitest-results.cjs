#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const COUNT_FIELDS = [
  "numTotalTestSuites",
  "numPassedTestSuites",
  "numFailedTestSuites",
  "numPendingTestSuites",
  "numTotalTests",
  "numPassedTests",
  "numFailedTests",
  "numPendingTests",
];

function evaluateVitestResults(results) {
  const failures = [];

  if (results.success !== true) {
    failures.push("Vitest reported success=false");
  }

  for (const field of COUNT_FIELDS) {
    if (!Number.isInteger(results[field]) || results[field] < 0) {
      failures.push(`Vitest report is missing a valid ${field}`);
    }
  }

  if (
    Number.isInteger(results.numFailedTestSuites) &&
    results.numFailedTestSuites > 0
  ) {
    failures.push(
      `Vitest reported ${results.numFailedTestSuites} failed test suites`,
    );
  }

  return { ok: failures.length === 0, failures };
}

function formatVitestSummary(results) {
  const evaluation = evaluateVitestResults(results);
  const status = evaluation.ok
    ? "✅ Vitest result guard passed"
    : "❌ Vitest result guard failed";
  const details = evaluation.failures.length
    ? `\n\n${evaluation.failures.map((failure) => `- ${failure}`).join("\n")}`
    : "";

  return [
    "## Unit test results",
    "",
    status,
    "",
    "| Scope | Total | Passed | Failed | Pending |",
    "| --- | ---: | ---: | ---: | ---: |",
    `| Suites | ${results.numTotalTestSuites} | ${results.numPassedTestSuites} | ${results.numFailedTestSuites} | ${results.numPendingTestSuites} |`,
    `| Tests | ${results.numTotalTests} | ${results.numPassedTests} | ${results.numFailedTests} | ${results.numPendingTests} |`,
    details,
  ].join("\n");
}

function checkVitestResults(reportPath, options = {}) {
  const absolutePath = path.resolve(reportPath);
  const results = JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  const summary = formatVitestSummary(results);
  const evaluation = evaluateVitestResults(results);

  console.log(summary);
  if (options.summaryPath) {
    fs.appendFileSync(options.summaryPath, `${summary}\n`);
  }

  if (!evaluation.ok) {
    throw new Error(evaluation.failures.join("; "));
  }

  return results;
}

if (require.main === module) {
  const reportPath = process.argv[2];
  if (!reportPath) {
    console.error("Usage: check-vitest-results.cjs <vitest-json-report>");
    process.exit(2);
  }

  try {
    checkVitestResults(reportPath, {
      summaryPath: process.env.GITHUB_STEP_SUMMARY,
    });
  } catch (error) {
    console.error(`[check-vitest-results] ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  checkVitestResults,
  evaluateVitestResults,
  formatVitestSummary,
};
