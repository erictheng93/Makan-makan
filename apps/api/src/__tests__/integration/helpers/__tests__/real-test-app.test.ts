import { describe, it, expect, afterEach, vi } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "../real-test-app";

// Undo the global vi.mock("drizzle-orm/d1") so this test uses the real drizzle instance.
vi.unmock("drizzle-orm/d1");

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

  it("responds 200 on GET /health", async () => {
    testApp = await createRealIntegrationTestApp();
    const res = await testApp.app.fetch(new Request("https://test/health"));
    expect(res.status).toBe(200);
  });

  it("rejects unauthenticated requests to protected endpoints", async () => {
    testApp = await createRealIntegrationTestApp();
    const res = await testApp.app.fetch(
      new Request("https://test/api/v1/customers/me/orders"),
    );
    expect(res.status).toBe(401);
  });

  it("dispose releases resources without error", async () => {
    testApp = await createRealIntegrationTestApp();
    await expect(testApp.dispose()).resolves.not.toThrow();
    testApp = null;
  });
});
