import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const repoRoot = process.cwd();
const packageJson = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf8"),
) as { scripts: Record<string, string> };

function workspacePackageJson(path: string) {
  return JSON.parse(readFileSync(join(repoRoot, path), "utf8")) as {
    scripts: Record<string, string>;
  };
}

const expectedExistingPaths = [
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

  it("runs local D1 migrations against the API dev server state path", () => {
    const expectedPersistPath = "--persist-to ./.wrangler/shared-state";

    expect(packageJson.scripts["db:migrate:local"]).toContain(
      "pnpm db:migrate:local:api",
    );
    expect(packageJson.scripts["db:migrate:local:api"]).toContain(
      expectedPersistPath,
    );
    expect(packageJson.scripts["db:seed:local"]).toContain(expectedPersistPath);
    expect(packageJson.scripts["db:reset:local"]).toContain(
      ".wrangler/shared-state/v3/d1/",
    );
  });

  it("prevents unqualified worker deploy scripts from publishing dev config", () => {
    for (const packagePath of [
      "apps/api/package.json",
      "apps/management-api/package.json",
    ]) {
      const pkg = workspacePackageJson(packagePath);

      expect(pkg.scripts.deploy).toMatch(/Refusing unqualified deploy/);
      expect(pkg.scripts.deploy).not.toContain("wrangler deploy");
      expect(pkg.scripts["deploy:prod"]).toContain("--env production");
    }
  });
});

// The worker-ceiling half of the guard, exercised end to end: copy the script
// into a throwaway repo so its `__dirname/..` ROOT points at the fixture.
const guardRoot = fileURLToPath(new URL("../../", import.meta.url));

function runGuardWithConfig(vitestConfig: string): {
  code: number;
  output: string;
} {
  const fixture = mkdtempSync(join(tmpdir(), "package-test-guard-"));
  const guard = join(fixture, "scripts", "check-package-test-scripts.cjs");
  mkdirSync(join(fixture, "scripts"), { recursive: true });
  copyFileSync(
    join(guardRoot, "scripts", "check-package-test-scripts.cjs"),
    guard,
  );

  const pkgDir = join(fixture, "packages", "demo");
  mkdirSync(pkgDir, { recursive: true });
  writeFileSync(
    join(pkgDir, "package.json"),
    JSON.stringify({ name: "demo", scripts: { test: "vitest run" } }),
  );
  writeFileSync(join(pkgDir, "demo.test.ts"), "");
  writeFileSync(join(pkgDir, "vitest.config.ts"), vitestConfig);

  try {
    return {
      code: 0,
      output: execFileSync(process.execPath, [guard], { encoding: "utf8" }),
    };
  } catch (error) {
    const failure = error as { status: number; stdout: string; stderr: string };
    return { code: failure.status, output: failure.stdout + failure.stderr };
  }
}

const activeConfig = `import { defineConfig } from "vitest/config";
import { sharedTestConfig } from "../../vitest.shared";

export default defineConfig({
  test: { ...sharedTestConfig, environment: "node" },
});
`;

describe("shared worker ceiling guard", () => {
  it("accepts a config that spreads the ceiling", () => {
    expect(runGuardWithConfig(activeConfig).code).toBe(0);
  });

  it("rejects a spread that is only present in a comment", () => {
    const lineCommented = activeConfig.replace(
      "...sharedTestConfig,",
      "// ...sharedTestConfig,",
    );
    const blockCommented = activeConfig.replace(
      "...sharedTestConfig,",
      "/* ...sharedTestConfig, */",
    );

    for (const config of [lineCommented, blockCommented]) {
      const result = runGuardWithConfig(config);

      expect(result.code, config).toBe(1);
      expect(result.output).toContain("does not spread the shared worker");
    }
  });
});
