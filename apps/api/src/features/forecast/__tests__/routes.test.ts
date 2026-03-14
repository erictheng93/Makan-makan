import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import routes from "../routes";

// Mock auth middleware to pass through
vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn((c: any, next: any) => next()),
  requireRole: () => vi.fn((c: any, next: any) => next()),
}));

vi.mock("../../../middleware/validation", () => ({
  validateBody: () =>
    vi.fn((c: any, next: any) => {
      c.set("validatedBody", {
        startDate: "2026-03-15",
        endDate: "2026-03-15",
        type: "item_level",
        useAI: false,
      });
      return next();
    }),
  validateQuery: () =>
    vi.fn((c: any, next: any) => {
      c.set("validatedQuery", { date: "2026-03-15" });
      return next();
    }),
  validateParams: () =>
    vi.fn((c: any, next: any) => {
      c.set("validatedParams", { restaurantId: "test-restaurant" });
      return next();
    }),
}));

// Mock ForecastService
vi.mock("../services/ForecastService", () => ({
  ForecastService: vi.fn(function () {
    return {
      generateForecast: vi.fn().mockResolvedValue([
        {
          date: "2026-03-15",
          type: "item_level",
          items: [],
          generatedBy: "statistical",
          metadata: {},
        },
      ]),
      getForecast: vi.fn().mockResolvedValue([
        {
          date: "2026-03-15",
          type: "item_level",
          items: [],
          generatedBy: "statistical",
          metadata: {},
        },
      ]),
      getAccuracy: vi.fn().mockResolvedValue([]),
      getAlerts: vi.fn().mockResolvedValue([]),
    };
  }),
}));

const mockEnv = { DB: {}, CACHE_KV: {} };

describe("Forecast Routes", () => {
  let app: Hono;

  beforeEach(() => {
    app = new Hono();
    app.route("/forecast", routes);
  });

  it("POST /:restaurantId/generate returns 200", async () => {
    const req = new Request(
      "http://localhost/forecast/test-restaurant/generate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: "2026-03-15",
          endDate: "2026-03-15",
        }),
      },
    );
    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("GET /:restaurantId returns 200", async () => {
    const req = new Request(
      "http://localhost/forecast/test-restaurant?date=2026-03-15",
    );
    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("GET /:restaurantId/accuracy returns 200", async () => {
    const req = new Request(
      "http://localhost/forecast/test-restaurant/accuracy?startDate=2026-03-01&endDate=2026-03-14",
    );
    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(200);
  });

  it("GET /:restaurantId/alerts returns 200", async () => {
    const req = new Request("http://localhost/forecast/test-restaurant/alerts");
    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(200);
  });
});
