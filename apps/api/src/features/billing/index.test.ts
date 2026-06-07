import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";

vi.mock("./routes", () => {
  const routes = new Hono();
  routes.get("/probe", (c) => c.json({ success: true, module: "billing" }));

  return { default: routes };
});

describe("billing feature module", () => {
  it("exposes module metadata, mounted routes, and health status", async () => {
    const module = (await import("./index")).default;

    expect(module.name).toBe("billing");
    expect(module.version).toBe("1.0.0");

    const response = await module.routes.request("/probe");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      module: "billing",
    });
    await expect(module.healthCheck()).resolves.toEqual({
      status: "healthy",
      message: "Billing module operational",
    });
  });
});
