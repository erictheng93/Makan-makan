import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
const packageJson = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf8"),
) as { scripts: Record<string, string> };

const expectedExistingPaths = [
  ["test:smoke:staging", "playwright.staging.config.ts"],
  ["test:performance", "tests/performance/artillery-api-ci.yml"],
  ["test:performance:ws", "tests/performance/artillery-realtime-ci.yml"],
  ["test:load:peak", "tests/performance/artillery-lunch-peak.yml"],
  ["test:soak", "tests/performance/artillery-soak-test.yml"],
  ["test:stress", "tests/performance/artillery-stress-test.yml"],
  ["test:visual", "playwright.visual.config.ts"],
] as const;

describe("package test scripts", () => {
  it("point smoke, performance, and visual scripts at existing files", () => {
    for (const [scriptName, expectedPath] of expectedExistingPaths) {
      const script = packageJson.scripts[scriptName];

      expect(script, `${scriptName} script exists`).toBeTruthy();
      expect(script, `${scriptName} references ${expectedPath}`).toContain(
        expectedPath,
      );
      expect(
        existsSync(join(repoRoot, expectedPath)),
        `${expectedPath} exists`,
      ).toBe(true);
    }
  });

  it("allows currently empty worker and visual suites without failing locally", () => {
    expect(packageJson.scripts["test:workers"]).toContain("--passWithNoTests");
    expect(packageJson.scripts["test:visual"]).toContain(
      "--pass-with-no-tests",
    );
    expect(packageJson.scripts["test:workers:integration"]).toContain(
      "No worker integration tests present",
    );
  });
});
