import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

const pagesApps = [
  "apps/customer-app",
  "apps/admin-dashboard",
  "apps/kitchen-display",
  "apps/management-portal",
  "apps/onboarding-app",
] as const;

interface PagesAssetFunctionContext {
  request: Request;
  env: { ASSETS: { fetch(request: Request): Promise<Response> } };
}

type PagesAssetFunction = (
  context: PagesAssetFunctionContext,
) => Promise<Response>;

async function loadAssetFunction(appPath: string): Promise<PagesAssetFunction> {
  const functionUrl = pathToFileURL(
    join(repoRoot, appPath, "functions", "assets", "[[path]].js"),
  );
  const functionModule = (await import(functionUrl.href)) as {
    onRequest: PagesAssetFunction;
  };

  return functionModule.onRequest;
}

function createAssetsBinding(response: Response) {
  return {
    fetch: async () => response,
  };
}

describe.each(pagesApps)("Pages asset guard: %s", (appPath) => {
  it("does not keep the ineffective manual routing config", () => {
    const routesPath = join(repoRoot, appPath, "public", "_routes.json");

    expect(existsSync(routesPath)).toBe(false);
  });

  it("turns an asset HTML fallback into an uncacheable 404", async () => {
    const onRequest = await loadAssetFunction(appPath);
    const request = new Request("https://example.com/assets/missing-entry.js");
    const fallback = new Response("<!doctype html><div id='app'></div>", {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=14400",
        "Content-Type": "text/html; charset=utf-8",
      },
    });

    const response = await onRequest({
      request,
      env: { ASSETS: createAssetsBinding(fallback) },
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Type")).toBeNull();
    expect(await response.text()).toBe("");
  });

  it("preserves a real asset response", async () => {
    const onRequest = await loadAssetFunction(appPath);
    const request = new Request("https://example.com/assets/index-abc123.js");
    const asset = new Response("console.log('loaded');", {
      status: 200,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": "application/javascript",
      },
    });

    const response = await onRequest({
      request,
      env: { ASSETS: createAssetsBinding(asset) },
    });

    expect(response).toBe(asset);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/javascript");
    expect(await response.text()).toBe("console.log('loaded');");
  });

  it("adds no-store to an asset 404 returned by Pages", async () => {
    const onRequest = await loadAssetFunction(appPath);
    const request = new Request(
      "https://example.com/assets/missing-image.webp",
    );
    const notFound = new Response(null, { status: 404 });

    const response = await onRequest({
      request,
      env: { ASSETS: createAssetsBinding(notFound) },
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toBe("");
  });
});
