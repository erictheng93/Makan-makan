import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

type Scope = {
  app: boolean;
  backend: boolean;
  frontend: boolean;
  integration: boolean;
  tooling: boolean;
  guard_tests: boolean;
  full_lint: boolean;
  full: boolean;
};

const classifier = path.resolve(
  process.cwd(),
  "scripts/classify-ci-changes.sh",
);

function classify(files: string[], initialFull = false): Scope {
  const result = spawnSync("bash", [classifier, String(initialFull)], {
    cwd: process.cwd(),
    encoding: "utf8",
    input: `${files.join("\n")}\n`,
  });

  expect(result.status, result.stderr).toBe(0);

  return Object.fromEntries(
    result.stdout
      .trim()
      .split("\n")
      .map((line) => {
        const [key, value] = line.split("=");
        return [key, value === "true"];
      }),
  ) as Scope;
}

const none: Scope = {
  app: false,
  backend: false,
  frontend: false,
  integration: false,
  tooling: false,
  guard_tests: false,
  full_lint: false,
  full: false,
};

describe("CI change classifier", () => {
  it.each(["docs/operations.md", "README.md", ".github/workflows/test.yml"])(
    "skips application checks for %s",
    (file) => {
      expect(classify([file])).toEqual(none);
    },
  );

  it("runs full lint when the root ESLint configuration changes", () => {
    expect(classify(["eslint.config.js"])).toEqual({
      ...none,
      tooling: true,
      full_lint: true,
    });
  });

  it.each([".prettierrc.json", ".prettierignore"])(
    "runs tooling checks for Prettier configuration %s",
    (file) => {
      expect(classify([file])).toEqual({
        ...none,
        tooling: true,
      });
    },
  );

  it.each([".npmrc", "codecov.yml"])(
    "uses full validation when root CI behavior changes in %s",
    (file) => {
      expect(classify([file])).toEqual({
        app: true,
        backend: true,
        frontend: true,
        integration: true,
        tooling: true,
        guard_tests: false,
        full_lint: false,
        full: true,
      });
    },
  );

  it("runs targeted guard tests when a tested guard script changes", () => {
    expect(classify(["scripts/check-production-config.cjs"])).toEqual({
      ...none,
      tooling: true,
      guard_tests: true,
    });
  });

  it("runs tooling checks without guard tests for other scripts", () => {
    expect(classify(["scripts/setup-secrets.ts"])).toEqual({
      ...none,
      tooling: true,
    });
  });

  it("runs the owning real integration suite for frontend apps that have one", () => {
    expect(classify(["apps/customer-app/src/App.vue"])).toEqual({
      ...none,
      app: true,
      frontend: true,
      integration: true,
    });
  });

  it("does not run API integration tests for an isolated worker change", () => {
    expect(classify(["apps/image-processor/src/index.ts"])).toEqual({
      ...none,
      app: true,
      backend: true,
    });
  });

  it("uses the widest scope for an unknown future package", () => {
    expect(classify(["packages/payments/src/index.ts"])).toEqual({
      app: true,
      backend: true,
      frontend: true,
      integration: true,
      tooling: false,
      guard_tests: false,
      full_lint: false,
      full: false,
    });
  });

  it("treats an unavailable comparison base as a full validation", () => {
    expect(classify(["docs/operations.md"], true)).toEqual({
      app: true,
      backend: true,
      frontend: true,
      integration: true,
      tooling: true,
      guard_tests: false,
      full_lint: false,
      full: true,
    });
  });
});
