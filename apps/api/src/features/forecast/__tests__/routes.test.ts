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

// Mock ForecastService — configurable per test
const mockServiceInstance = {
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

vi.mock("../services/ForecastService", () => ({
  ForecastService: vi.fn(function () {
    return mockServiceInstance;
  }),
}));

const mockEnv = { DB: {}, CACHE_KV: {} };

describe("Forecast Routes", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    mockServiceInstance.generateForecast.mockResolvedValue([
      {
        date: "2026-03-15",
        type: "item_level",
        items: [],
        generatedBy: "statistical",
        metadata: {},
      },
    ]);
    mockServiceInstance.getForecast.mockResolvedValue([
      {
        date: "2026-03-15",
        type: "item_level",
        items: [],
        generatedBy: "statistical",
        metadata: {},
      },
    ]);
    mockServiceInstance.getAccuracy.mockResolvedValue([]);
    mockServiceInstance.getAlerts.mockResolvedValue([]);

    app = new Hono();
    app.route("/forecast", routes);
  });

  // ─── Happy Path ─────────────────────────────────────────────────

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
    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(true);
  });

  it("GET /:restaurantId returns 200", async () => {
    const req = new Request(
      "http://localhost/forecast/test-restaurant?date=2026-03-15",
    );
    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean };
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

  // ─── Response Structure ─────────────────────────────────────────

  it("POST /generate response includes forecasts array and timestamp", async () => {
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
    const json = (await res.json()) as {
      success: boolean;
      data: { forecasts: unknown[] };
      timestamp: string;
    };
    expect(json.data.forecasts).toBeDefined();
    expect(Array.isArray(json.data.forecasts)).toBe(true);
    expect(json.timestamp).toBeDefined();
  });

  it("GET /accuracy response wraps data in accuracy key", async () => {
    const req = new Request(
      "http://localhost/forecast/test-restaurant/accuracy?startDate=2026-03-01&endDate=2026-03-14",
    );
    const res = await app.fetch(req, mockEnv);
    const json = (await res.json()) as {
      success: boolean;
      data: { accuracy: unknown[] };
    };
    expect(json.data.accuracy).toBeDefined();
  });

  it("GET /alerts response wraps data in alerts key", async () => {
    const req = new Request("http://localhost/forecast/test-restaurant/alerts");
    const res = await app.fetch(req, mockEnv);
    const json = (await res.json()) as {
      success: boolean;
      data: { alerts: unknown[] };
    };
    expect(json.data.alerts).toBeDefined();
  });

  // ─── Error Handling ─────────────────────────────────────────────

  it("POST /generate returns 500 with error code when service throws", async () => {
    mockServiceInstance.generateForecast.mockRejectedValue(
      new Error("DB connection lost"),
    );

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
    expect(res.status).toBe(500);
    const json = (await res.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("FORECAST_GENERATE_FAILED");
    expect(json.error.message).toBe("DB connection lost");
  });

  it("GET /:restaurantId returns 500 with error code when service throws", async () => {
    mockServiceInstance.getForecast.mockRejectedValue(
      new Error("KV unavailable"),
    );

    const req = new Request(
      "http://localhost/forecast/test-restaurant?date=2026-03-15",
    );
    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(500);
    const json = (await res.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("FORECAST_GET_FAILED");
  });

  it("GET /accuracy returns 500 with error code when service throws", async () => {
    mockServiceInstance.getAccuracy.mockRejectedValue(
      new Error("Query failed"),
    );

    const req = new Request(
      "http://localhost/forecast/test-restaurant/accuracy?startDate=2026-03-01&endDate=2026-03-14",
    );
    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(500);
    const json = (await res.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("FORECAST_ACCURACY_FAILED");
  });

  it("GET /alerts returns 500 with error code when service throws", async () => {
    mockServiceInstance.getAlerts.mockRejectedValue(new Error("Alerts failed"));

    const req = new Request("http://localhost/forecast/test-restaurant/alerts");
    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(500);
    const json = (await res.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("FORECAST_ALERTS_FAILED");
  });

  it("should use generic message when error is not an Error instance", async () => {
    mockServiceInstance.generateForecast.mockRejectedValue("string error");

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
    expect(res.status).toBe(500);
    const json = (await res.json()) as {
      success: boolean;
      error: { message: string };
    };
    expect(json.error.message).toBe("Failed to generate forecast");
  });

  // ─── Non-Error exception on other endpoints ──────────────────────

  it("GET /:restaurantId uses generic message when error is not an Error instance", async () => {
    mockServiceInstance.getForecast.mockRejectedValue(42);

    const req = new Request(
      "http://localhost/forecast/test-restaurant?date=2026-03-15",
    );
    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(500);
    const json = (await res.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("FORECAST_GET_FAILED");
    expect(json.error.message).toBe("Failed to get forecast");
  });

  it("GET /accuracy uses generic message when error is not an Error instance", async () => {
    mockServiceInstance.getAccuracy.mockRejectedValue(null);

    const req = new Request(
      "http://localhost/forecast/test-restaurant/accuracy?startDate=2026-03-01&endDate=2026-03-14",
    );
    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(500);
    const json = (await res.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("FORECAST_ACCURACY_FAILED");
    expect(json.error.message).toBe("Failed to get forecast accuracy");
  });

  it("GET /alerts uses generic message when error is not an Error instance", async () => {
    mockServiceInstance.getAlerts.mockRejectedValue(undefined);

    const req = new Request("http://localhost/forecast/test-restaurant/alerts");
    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(500);
    const json = (await res.json()) as {
      success: boolean;
      error: { code: string; message: string };
    };
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("FORECAST_ALERTS_FAILED");
    expect(json.error.message).toBe("Failed to get forecast alerts");
  });

  // ─── Response data passthrough ───────────────────────────────────

  it("GET /:restaurantId passes forecast data array through", async () => {
    mockServiceInstance.getForecast.mockResolvedValue([
      {
        date: "2026-03-15",
        type: "item_level",
        items: [{ menuItemId: 1, menuItemName: "Test", predicted: 10 }],
        generatedBy: "statistical",
        metadata: {},
      },
    ]);

    const req = new Request(
      "http://localhost/forecast/test-restaurant?date=2026-03-15",
    );
    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data: { forecasts: Array<{ items: unknown[] }> };
    };
    expect(json.data.forecasts).toHaveLength(1);
    expect(json.data.forecasts[0].items).toHaveLength(1);
  });

  it("POST /generate passes multiple forecasts in data array", async () => {
    mockServiceInstance.generateForecast.mockResolvedValue([
      {
        date: "2026-03-15",
        type: "item_level",
        items: [],
        generatedBy: "statistical",
        metadata: {},
      },
      {
        date: "2026-03-16",
        type: "item_level",
        items: [],
        generatedBy: "statistical",
        metadata: {},
      },
    ]);

    const req = new Request(
      "http://localhost/forecast/test-restaurant/generate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: "2026-03-15",
          endDate: "2026-03-16",
        }),
      },
    );
    const res = await app.fetch(req, mockEnv);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      success: boolean;
      data: { forecasts: unknown[] };
    };
    expect(json.data.forecasts).toHaveLength(2);
  });
});
