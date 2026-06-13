import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usageTracker } from "./usageTracker";
import { meterEmit } from "../shared/utils/meter";

vi.mock("../shared/utils/meter", () => ({
  meterEmit: vi.fn(async () => undefined),
}));

function createApp() {
  const app = new Hono();
  app.use("*", usageTracker);
  app.get("/api/v1/orders", (c) => c.json({ success: true }));
  app.get("/api/v1/health", (c) => c.json({ dead: true }));
  app.get("/info", (c) => c.json({ ok: true }));
  return app;
}

describe("usageTracker", () => {
  beforeEach(() => {
    vi.mocked(meterEmit).mockClear();
  });

  it("meters stale /api/v1/health requests instead of hiding them", async () => {
    const app = createApp();

    await app.fetch(new Request("https://api.test/api/v1/health"), {} as never);

    expect(meterEmit).toHaveBeenCalledOnce();
    expect(meterEmit).toHaveBeenCalledWith(
      expect.anything(),
      "api.requests",
      expect.objectContaining({
        metadata: expect.objectContaining({ path: "/api/v1/health" }),
      }),
    );
  });

  it("continues to skip the real public liveness endpoint", async () => {
    const app = createApp();

    await app.fetch(new Request("https://api.test/info"), {} as never);

    expect(meterEmit).not.toHaveBeenCalled();
  });
});
