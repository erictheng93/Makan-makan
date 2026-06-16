import { describe, expect, it } from "vitest";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = process.cwd();
const queueServicePackage = "@makanmakan/" + "queue-service";

const dependencySections = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

type PackageJson = {
  name?: string;
} & Partial<
  Record<(typeof dependencySections)[number], Record<string, string>>
>;

function listPackageJsonFiles(root: string): string[] {
  const roots = ["apps", "packages"];
  const files: string[] = [];

  for (const workspaceRoot of roots) {
    const workspacePath = join(root, workspaceRoot);
    for (const entry of readdirSync(workspacePath)) {
      const packagePath = join(workspacePath, entry, "package.json");
      if (existsSync(packagePath)) {
        files.push(packagePath);
      }
    }
  }

  return files.sort();
}

function listBoundaryFiles(root: string): string[] {
  const ignoredDirectoryNames = new Set([
    ".claude",
    ".git",
    ".turbo",
    ".wrangler",
    "coverage",
    "dist",
    "docs",
    "node_modules",
  ]);
  const ignoredFiles = new Set([
    "package.json",
    "pnpm-lock.yaml",
    "tests/unit/package-boundaries.test.ts",
  ]);
  const extensions = new Set([".cjs", ".js", ".json", ".mjs", ".ts", ".tsx"]);
  const files: string[] = [];

  function walk(directory: string): void {
    for (const entry of readdirSync(directory)) {
      const absolutePath = join(directory, entry);
      const relativePath = relative(root, absolutePath);
      const stats = lstatSync(absolutePath);

      if (stats.isSymbolicLink()) {
        continue;
      }

      if (stats.isDirectory()) {
        const pathParts = relativePath.split("/");
        const isIgnoredDirectory =
          relativePath === "packages/queue-service" ||
          pathParts.some((part) => ignoredDirectoryNames.has(part));

        if (!isIgnoredDirectory) {
          walk(absolutePath);
        }
        continue;
      }

      if (ignoredFiles.has(relativePath)) continue;
      if (!extensions.has(relativePath.slice(relativePath.lastIndexOf(".")))) {
        continue;
      }

      files.push(absolutePath);
    }
  }

  walk(root);
  return files.sort();
}

describe("package boundaries", () => {
  it("keeps queue-service as a leaf package, not an app/database dependency", () => {
    const violations: string[] = [];

    for (const packageJsonPath of listPackageJsonFiles(repoRoot)) {
      const manifest = JSON.parse(
        readFileSync(packageJsonPath, "utf8"),
      ) as PackageJson;

      if (manifest.name === queueServicePackage) continue;

      for (const section of dependencySections) {
        if (manifest[section]?.[queueServicePackage]) {
          violations.push(
            `${relative(repoRoot, packageJsonPath)} ${section}.${queueServicePackage}`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("does not expose queue-service aliases or imports outside the package", () => {
    const violations = listBoundaryFiles(repoRoot)
      .filter((file) =>
        readFileSync(file, "utf8").includes(queueServicePackage),
      )
      .map((file) => relative(repoRoot, file));

    expect(violations).toEqual([]);
  });
});
