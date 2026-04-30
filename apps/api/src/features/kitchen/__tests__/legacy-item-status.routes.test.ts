import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { ApiError } from "../../../shared/utils/api-error";

const mockKitchenService = {
  validateChefAccess: vi.fn(),
  updateOrderItemStatus: vi.fn(),
};

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set("user", {
      id: 8,
      username: "chef",
      role: 2,
      restaurantId: "rest-1",
    });
    await next();
  }),
  sseAuthMiddleware: vi.fn(async (c: any, next: any) => {
    c.set("user", {
      id: 8,
      username: "chef",
      role: 2,
      restaurantId: "rest-1",
    });
    await next();
  }),
}));

vi.mock("../../../middleware/moduleGate", () => ({
  moduleGate: vi.fn(() => async (_c: any, next: any) => {
    await next();
  }),
}));

vi.mock("../services/KitchenService", () => ({
  // Must be a function declaration (not an arrow) so production code can
  // invoke it with `new KitchenService(env)` — vitest 4.x rejects arrow
  // functions used as constructors.
  KitchenService: vi.fn(function (this: any) {
    Object.assign(this, mockKitchenService);
  }),
}));

import kitchenRoutes from "../routes";

function buildApp() {
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
        error: {
          code: "INTERNAL_ERROR",
          message: err instanceof Error ? err.message : String(err),
        },
      },
      500,
    );
  });

  app.route("/kitchen", kitchenRoutes);
  return app;
}

describe("Kitchen Legacy Item Status Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockKitchenService.validateChefAccess.mockReturnValue(true);
    mockKitchenService.updateOrderItemStatus.mockResolvedValue({
      orderId: 55,
      itemId: 12,
      status: "preparing",
      updatedAt: "2026-04-29T00:00:00.000Z",
    });
  });

  it("maps legacy start action to preparing item status", async () => {
    const app = buildApp();

    const response = await app.request("/kitchen/55/items/12/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "start_cooking",
        data: { notes: "Fire now" },
      }),
    });
    const json = (await response.json()) as ApiTestResponse;

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockKitchenService.updateOrderItemStatus).toHaveBeenCalledWith(
      "rest-1",
      55,
      12,
      { status: "preparing", notes: "Fire now" },
      8,
    );
  });

  it("maps legacy ready action to ready item status", async () => {
    const app = buildApp();
    mockKitchenService.updateOrderItemStatus.mockResolvedValue({
      orderId: 55,
      itemId: 12,
      status: "ready",
      updatedAt: "2026-04-29T00:00:00.000Z",
    });

    const response = await app.request("/kitchen/55/items/12/ready", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_ready" }),
    });
    const json = (await response.json()) as ApiTestResponse;

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockKitchenService.updateOrderItemStatus).toHaveBeenCalledWith(
      "rest-1",
      55,
      12,
      { status: "ready", notes: undefined },
      8,
    );
  });

  it("keeps legacy route access behind chef permission checks", async () => {
    const app = buildApp();
    mockKitchenService.validateChefAccess.mockReturnValue(false);

    const response = await app.request("/kitchen/55/items/12/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const json = (await response.json()) as ApiTestResponse;

    expect(response.status).toBe(403);
    expect(json.error.code).toBe("CHEF_ACCESS_REQUIRED");
    expect(mockKitchenService.updateOrderItemStatus).not.toHaveBeenCalled();
  });
});
