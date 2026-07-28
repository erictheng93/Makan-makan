import { describe, it, expect, afterEach } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";

describe("createRealIntegrationTestApp", () => {
  let testApp: RealIntegrationTestApp | null = null;

  afterEach(async () => {
    if (testApp) {
      await testApp.dispose();
      testApp = null;
    }
  });

  it("boots a Hono app with a real miniflare D1 binding", async () => {
    testApp = await createRealIntegrationTestApp();
    expect(testApp.app).toBeDefined();
    expect(testApp.testDb).toBeDefined();
    expect(testApp.env.DB).toBe(testApp.testDb.db);
  });

  it("responds 200 on GET /info", async () => {
    // `/info` is app-level and has no auth middleware — ideal for a boot check.
    // Do NOT use `/health` here: production `/health` redirects to
    // `/api/v1/monitoring/health`, which sits behind `apiV1.use("/monitoring/*", authMiddleware)`,
    // so an unauthenticated health check would actually surface as a 401.
    testApp = await createRealIntegrationTestApp();
    const res = await testApp.app.fetch(new Request("https://test/info"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string };
    expect(body.name).toBe("MakanMasak API");
  });

  it("rejects unauthenticated requests to protected endpoints", async () => {
    testApp = await createRealIntegrationTestApp();
    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/customers/me/orders"),
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 for unknown paths under protected prefixes", async () => {
    testApp = await createRealIntegrationTestApp();
    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/orders/definitely/not-a-route"),
    );
    const body = (await res.json()) as {
      success: boolean;
      error?: { code?: string };
    };

    expect(res.status).toBe(404);
    expect(body).toMatchObject({
      success: false,
      error: { code: "ROUTE_NOT_FOUND" },
    });
  });

  it("dispose releases resources without error", async () => {
    testApp = await createRealIntegrationTestApp();
    await expect(testApp.dispose()).resolves.not.toThrow();
    testApp = null;
  });
});
