import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { ApiError } from "../../../shared/utils/api-error";

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set("user", {
      id: 6,
      username: "owner",
      role: 1,
      restaurantId: "rest-1",
    });
    await next();
  }),
  requireRole: vi.fn(() => async (_c: any, next: any) => {
    await next();
  }),
}));

vi.mock("@makanmasak/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@makanmasak/database")>();
  return {
    ...actual,
    FeedbackService: vi.fn(),
  };
});

import feedbackRoutes from "../routes";

function createMockKV() {
  return {
    put: vi.fn().mockResolvedValue(undefined),
  };
}

function buildApp(kv = createMockKV()) {
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

  app.route("/feedback", feedbackRoutes);
  return { app, kv };
}

describe("Feedback Batch Sync Compatibility Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores feedback batch sync payloads in KV", async () => {
    const { app, kv } = buildApp();
    const payload = {
      sync_id: "feedback-1",
      feedback: [{ order_id: "order-1", rating: 5, comment: "Good" }],
    };

    const response = await app.request(
      "/feedback/batch-sync",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      { CACHE_KV: kv },
    );
    const json = (await response.json()) as ApiTestResponse;

    expect(response.status).toBe(200);
    expect(json.data).toMatchObject({
      syncId: "feedback-1",
      synced: true,
      itemCount: 1,
      restaurantId: "rest-1",
    });
    expect(kv.put).toHaveBeenCalledWith(
      "feedback:batch-sync:rest-1:6:feedback-1",
      expect.stringContaining('"rating":5'),
      { expirationTtl: 2592000 },
    );
    expect(kv.put).toHaveBeenCalledWith(
      "feedback:batch-sync:rest-1:6:latest",
      expect.stringContaining('"rating":5'),
      { expirationTtl: 2592000 },
    );
  });
});
