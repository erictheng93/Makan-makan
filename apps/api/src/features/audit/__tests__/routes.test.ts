import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { ApiError } from "../../../shared/utils/api-error";

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set("user", {
      id: 7,
      username: "owner",
      role: 1,
      restaurantId: "rest-1",
    });
    await next();
  }),
}));

import auditRoutes from "../routes";

function createMockDb() {
  const run = vi.fn().mockResolvedValue({ meta: { last_row_id: 42 } });
  const bind = vi.fn(() => ({ run }));
  const prepare = vi.fn(() => ({ bind }));

  return { prepare, bind, run };
}

function buildApp(db = createMockDb()) {
  const app = new Hono<any>();

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        { success: false, error: { code: err.code, message: err.message } },
        err.status as never,
      );
    }
    return c.json(
      {
        success: false,
        error: { code: "INTERNAL_ERROR", message: err.message },
      },
      500,
    );
  });

  app.route("/audit", auditRoutes);
  return { app, db };
}

describe("Audit Compatibility Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists offline user actions to audit_logs", async () => {
    const { app, db } = buildApp();

    const response = await app.request(
      "/audit/actions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "user-agent": "vitest",
        },
        body: JSON.stringify({
          action_type: "menu_update",
          target_id: "menu-1",
          data: { available: false },
          user_id: 99,
          restaurant_id: "rest-1",
          timestamp: "2026-04-29T00:00:00.000Z",
        }),
      },
      { DB: { prepare: db.prepare } },
    );
    const json = (await response.json()) as ApiTestResponse;

    expect(response.status).toBe(201);
    expect(json).toMatchObject({
      success: true,
      data: {
        auditLogId: 42,
        synced: true,
        action: "menu_update",
        resource: "menu_items",
        resourceId: "menu-1",
        restaurantId: "rest-1",
      },
    });
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO audit_logs"),
    );
    expect(db.bind).toHaveBeenCalledWith(
      7,
      "rest-1",
      "menu_update",
      "menu_items",
      "menu-1",
      "Offline menu_update on menu_items#menu-1",
      expect.stringContaining('"offline":true'),
      null,
      "vitest",
      1,
      Date.parse("2026-04-29T00:00:00.000Z"),
    );
  });

  it("rejects invalid audit action payloads", async () => {
    const { app, db } = buildApp();

    const response = await app.request(
      "/audit/actions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action_type: "" }),
      },
      { DB: { prepare: db.prepare } },
    );
    const json = (await response.json()) as ApiTestResponse;

    expect(response.status).toBe(400);
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(db.prepare).not.toHaveBeenCalled();
  });

  it("rejects owner audit syncs for another restaurant", async () => {
    const { app, db } = buildApp();

    const response = await app.request(
      "/audit/actions",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_type: "settings_update",
          restaurant_id: "rest-2",
        }),
      },
      { DB: { prepare: db.prepare } },
    );
    const json = (await response.json()) as ApiTestResponse;

    expect(response.status).toBe(403);
    expect(json.error.code).toBe("AUDIT_ACTION_FORBIDDEN");
    expect(db.prepare).not.toHaveBeenCalled();
  });
});
