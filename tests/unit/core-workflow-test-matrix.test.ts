import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

const requiredFiles = [
  "tests/e2e/integration/real-workflows.spec.ts",
  "apps/customer-app/src/__tests__/integration/customer-app.real.integration.test.ts",
  "apps/admin-dashboard/src/__tests__/integration/admin-dashboard.real.integration.test.ts",
  "apps/kitchen-display/src/__tests__/integration/kitchen-display.real.integration.test.ts",
  "apps/management-api/src/__tests__/onboarding-workflow.real.integration.test.ts",
  "docs/testing/CORE_WORKFLOW_TEST_MATRIX.md",
] as const;

const requiredModules = [
  "customer-app",
  "admin-dashboard",
  "kitchen-display",
  "management-portal",
  "onboarding-app",
] as const;

describe("core workflow test matrix", () => {
  it("keeps core workflow test assets discoverable", () => {
    for (const relativePath of requiredFiles) {
      expect(
        existsSync(join(repoRoot, relativePath)),
        `${relativePath} exists`,
      ).toBe(true);
    }
  });

  it("documents every core frontend module in the workflow matrix", () => {
    const matrix = readFileSync(
      join(repoRoot, "docs/testing/CORE_WORKFLOW_TEST_MATRIX.md"),
      "utf8",
    );

    for (const moduleName of requiredModules) {
      expect(matrix, `${moduleName} is documented`).toContain(moduleName);
    }

    expect(matrix).toContain("test:e2e:integration");
    expect(matrix).toContain("Real Integration");
    expect(matrix).toContain("Real Browser Workflow");
  });
});
