/**
 * Regression coverage for bug-inventory lead A: app-factory.ts used to mount
 * feedback behind `apiV1.use("/feedback/*", moduleGate("analytics"))`.
 * Feedback is the shop's support-ticket channel (POST / creates a ticket,
 * role=1 owner only) — gating it behind a paid module meant a basic-tier
 * owner got 403'd out of the only way to contact support, which is a worse
 * failure than leaving it ungated. The fix removed the moduleGate("analytics")
 * line in app-factory.ts (the authMiddleware line stays).
 *
 * This test mirrors that exact mount structure — NOT the whole app-factory
 * (too much unrelated wiring/bindings to stand up) — and exercises the REAL
 * moduleGate with a poisoned CACHE_KV/DB so the test fails loudly if a
 * moduleGate call is ever reintroduced on this path.
 */

import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { ApiError } from "../../../shared/utils/api-error";
import { authMiddleware } from "../../../middleware/auth";

const currentUser = { id: 10, role: 1, restaurantId: "rest-basic" };

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set("user", currentUser);
    await next();
  }),
  requireRole: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

const feedbackServiceFns = vi.hoisted(() => ({
  createFeedback: vi.fn(),
}));

vi.mock("@makanmakan/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@makanmakan/database")>();
  return {
    ...actual,
    FeedbackService: class {
      createFeedback = feedbackServiceFns.createFeedback;
    },
  };
});

import feedbackRoutes from "./index";

/** A binding that explodes on any property access — proves moduleGate never ran. */
function poisonedBinding(label: string): unknown {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        throw new Error(
          `${label} was accessed (property ${String(prop)}) but must not be`,
        );
      },
    },
  );
}

function buildApp() {
  // Mirror the app-factory mount for /feedback/*: blanket authMiddleware,
  // deliberately WITHOUT a moduleGate line, then the feedback sub-app.
  const app = new Hono();
  app.use("/feedback/*", authMiddleware as never);
  app.route("/feedback", feedbackRoutes);
  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        { success: false, error: { code: err.code, message: err.message } },
        err.status as 400 | 401 | 403 | 404 | 409 | 500,
      );
    }
    return c.json(
      { success: false, error: { code: "INTERNAL", message: String(err) } },
      500,
    );
  });
  return app;
}

describe("feedback/* is never gated behind a subscription module", () => {
  it("lets a basic-tier owner create a support ticket without touching CACHE_KV or DB", async () => {
    feedbackServiceFns.createFeedback.mockResolvedValue({
      id: 1,
      status: "open",
    });

    const response = await buildApp().fetch(
      new Request("https://test/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category: "bug_report",
          priority: "high",
          subject: "Can't print receipts",
          description: "The receipt printer keeps failing.",
        }),
      }),
      // If a moduleGate() call were reintroduced, it would try to read
      // "subscription:rest-basic" from this poisoned KV and throw.
      {
        DB: poisonedBinding("DB"),
        CACHE_KV: poisonedBinding("CACHE_KV"),
      } as never,
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ success: true });
    expect(feedbackServiceFns.createFeedback).toHaveBeenCalledOnce();
  });
});
