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

// Handed to bash, not to Node, so the separators have to be POSIX ones: bash
// reads the backslashes in a resolved Windows path as escape characters and
// collapses D:\repo\scripts\x.sh into D:reposcriptsx.sh before it ever stats
// the file. Forward slashes are accepted on both platforms, so this is a no-op
// off Windows.
const classifier = path
  .resolve(process.cwd(), "scripts/classify-ci-changes.sh")
  .replace(/\\/g, "/");

// On Windows, a bare `bash` usually resolves to C:\Windows\system32\bash.exe --
// that is WSL, which mounts this drive under /mnt and so cannot see the repo
// path at all. Git ships a bash that shares the Win32 namespace, and it lives
// next door to the git.exe we were launched with.
function resolveBash(): string | null {
  if (process.platform !== "win32") return "bash";

  const located = spawnSync("where", ["git"], { encoding: "utf8" });
  const gitExe = located.stdout?.split(/\r?\n/)[0]?.trim();
  if (!gitExe) return null;

  const gitBash = path
    .resolve(path.dirname(gitExe), "..", "bin", "bash.exe")
    .replace(/\\/g, "/");

  // Confirm rather than assume: layouts differ between the Git installer and
  // portable/scoop copies, and a bash that cannot stat the script is useless.
  const probe = spawnSync(gitBash, ["-c", `test -f '${classifier}'`], {
    encoding: "utf8",
  });

  return probe.status === 0 ? gitBash : null;
}

const bashCommand = resolveBash();

function classify(files: string[], initialFull = false): Scope {
  const result = spawnSync(
    bashCommand as string,
    [classifier, String(initialFull)],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      input: `${files.join("\n")}\n`,
    },
  );

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

const fullValidation: Scope = {
  app: true,
  backend: true,
  frontend: true,
  integration: true,
  tooling: true,
  guard_tests: false,
  full_lint: false,
  full: true,
};

// Skipped rather than failed where no bash can reach the script: the classifier
// is a CI concern and CI runs on Linux, so a red suite here would only ever be
// reporting on the developer's shell, not on the script under test.
describe.skipIf(bashCommand === null)("CI change classifier", () => {
  it.each(["docs/operations.md", "README.md"])(
    "skips application checks for %s",
    (file) => {
      expect(classify([file])).toEqual(none);
    },
  );

  it("uses full validation when a GitHub Actions workflow changes", () => {
    expect(classify([".github/workflows/test.yml"])).toEqual(fullValidation);
  });

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
      expect(classify([file])).toEqual(fullValidation);
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
    expect(classify(["docs/operations.md"], true)).toEqual(fullValidation);
  });
});
