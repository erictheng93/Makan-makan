import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

const pagesApps = [
  "apps/customer-app",
  "apps/admin-dashboard",
  "apps/kitchen-display",
  "apps/management-portal",
  "apps/onboarding-app",
] as const;

interface PagesRoutesConfig {
  version: number;
  include: string[];
  exclude: string[];
}

function readRoutesConfig(appPath: string): PagesRoutesConfig {
  const routesPath = join(repoRoot, appPath, "public", "_routes.json");

  expect(existsSync(routesPath), `${appPath} has public/_routes.json`).toBe(
    true,
  );

  return JSON.parse(readFileSync(routesPath, "utf8")) as PagesRoutesConfig;
}

describe("Cloudflare Pages routing config", () => {
  it("keeps hashed assets out of SPA fallback for every Pages app", () => {
    for (const appPath of pagesApps) {
      const routesConfig = readRoutesConfig(appPath);

      expect(routesConfig.version, `${appPath} routes version`).toBe(1);
      expect(routesConfig.include, `${appPath} SPA fallback include`).toEqual([
        "/*",
      ]);
      expect(
        routesConfig.exclude,
        `${appPath} excludes Vite assets from fallback`,
      ).toContain("/assets/*");
    }
  });
});
