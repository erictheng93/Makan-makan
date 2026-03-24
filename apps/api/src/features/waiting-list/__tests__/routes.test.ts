/**
 * Waiting List Routes Tests
 * HTTP-level tests for queue management endpoints
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { AuthUser } from "../../../middleware/auth";
import { ApiError } from "../../../shared/utils/api-error";
import { ErrorSanitizer } from "../../../utils/errorSanitizer";

// Mock auth middleware to pass through by default
vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn((c: any, next: any) => next()),
  requireRole: () => vi.fn((c: any, next: any) => next()),
}));

// Mock WaitingListService
const mockServiceInstance = {
  joinWaitingList: vi.fn(),
  getWaitingListEntryById: vi.fn(),
  getQueueStatus: vi.fn(),
  estimateWaitTime: vi.fn(),
  cancelWaiting: vi.fn(),
  confirmWaiting: vi.fn(),
  listWaitingList: vi.fn(),
  callWaiting: vi.fn(),
  markSeated: vi.fn(),
  expireWaiting: vi.fn(),
  getWaitingStats: vi.fn(),
  batchCallNext: vi.fn(),
};

vi.mock("@makanmakan/database", () => ({
  WaitingListService: vi.fn(function () {
    return mockServiceInstance;
  }),
}));

const mockEnv = { DB: {}, CACHE_KV: {} };

// Helper to attach the unified error handler to any test app
function attachOnError(honoApp: Hono): void {
  honoApp.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        {
          success: false,
          error: {
            code: err.code,
            message: err.message,
            ...(err.details !== undefined && { details: err.details }),
          },
        },
        err.status as any,
      );
    }
    const sanitized = ErrorSanitizer.sanitizeError(err);
    const STATUS_MAP: Record<string, number> = {
      validation: 400,
      authentication: 401,
      authorization: 403,
      not_found: 404,
      rate_limit: 429,
      server_error: 500,
    };
    return c.json(
      {
        success: false,
        error: {
          code: sanitized.code ?? "INTERNAL_ERROR",
          message: sanitized.message,
        },
      },
      (STATUS_MAP[sanitized.type] ?? 500) as any,
    );
  });
}

describe("Waiting List Routes", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Default happy-path mock values
    mockServiceInstance.joinWaitingList.mockResolvedValue({
      id: "wait-001",
      restaurantId: "restaurant-001",
      customerName: "Alice",
      customerPhone: "0912345678",
      partySize: 2,
      status: "waiting",
      queueNumber: 5,
      queueDisplay: "A005",
      createdAt: Date.now(),
    });

    mockServiceInstance.getWaitingListEntryById.mockResolvedValue({
      id: "wait-001",
      restaurantId: "restaurant-001",
      customerName: "Alice",
      customerPhone: "0912345678",
      partySize: 2,
      status: "waiting",
      queueNumber: 5,
      queueDisplay: "A005",
    });

    mockServiceInstance.getQueueStatus.mockResolvedValue({
      restaurantId: "restaurant-001",
      totalWaiting: 5,
      currentQueueNumber: 3,
      estimatedWaitMinutes: 20,
    });

    mockServiceInstance.estimateWaitTime.mockResolvedValue({
      restaurantId: "restaurant-001",
      partySize: 2,
      estimatedWaitMinutes: 15,
      positionsAhead: 3,
    });

    mockServiceInstance.cancelWaiting.mockResolvedValue({
      id: "wait-001",
      status: "cancelled",
    });

    mockServiceInstance.confirmWaiting.mockResolvedValue({
      id: "wait-001",
      status: "confirmed",
    });

    mockServiceInstance.listWaitingList.mockResolvedValue({
      data: [
        {
          id: "wait-001",
          restaurantId: "restaurant-001",
          customerName: "Alice",
          status: "waiting",
        },
      ],
      total: 1,
    });

    mockServiceInstance.callWaiting.mockResolvedValue({
      id: "wait-001",
      status: "called",
      tableId: "table-001",
    });

    mockServiceInstance.markSeated.mockResolvedValue({
      id: "wait-001",
      status: "seated",
    });

    mockServiceInstance.expireWaiting.mockResolvedValue({
      id: "wait-001",
      status: "expired",
    });

    mockServiceInstance.getWaitingStats.mockResolvedValue({
      restaurantId: "restaurant-001",
      totalWaiting: 10,
      totalSeated: 50,
      totalCancelled: 5,
      totalExpired: 2,
      avgWaitMinutes: 25,
    });

    // Import routes fresh so mocks are applied
    const routesModule = await import("../routes/index");
    app = new Hono();

    // Inject a default staff user into context
    app.use("/*", async (c, next) => {
      c.set("user", {
        id: 1,
        username: "testuser",
        role: 1,
        restaurantId: "restaurant-001",
      } as AuthUser);
      await next();
    });

    app.route("/waiting-list", routesModule.default);
    attachOnError(app);
  });

  // ─── POST / - Join Waiting List ──────────────────────────────────

  describe("POST / - Join Waiting List", () => {
    it("returns 400 when restaurantId is missing", async () => {
      const req = new Request("http://localhost/waiting-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "Alice",
          customerPhone: "0912345678",
          partySize: 2,
        }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
    });

    it("returns 400 when customerName is missing", async () => {
      const req = new Request("http://localhost/waiting-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: "restaurant-001",
          customerPhone: "0912345678",
          partySize: 2,
        }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });

    it("returns 400 when customerPhone is missing", async () => {
      const req = new Request("http://localhost/waiting-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: "restaurant-001",
          customerName: "Alice",
          partySize: 2,
        }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });

    it("returns 400 when partySize is missing", async () => {
      const req = new Request("http://localhost/waiting-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: "restaurant-001",
          customerName: "Alice",
          customerPhone: "0912345678",
        }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });

    it("returns 201 with entry and queue display on valid join", async () => {
      const req = new Request("http://localhost/waiting-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: "restaurant-001",
          customerName: "Alice",
          customerPhone: "0912345678",
          partySize: 2,
        }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(201);
      const json = (await res.json()) as {
        success: boolean;
        data: { id: string; queueDisplay: string };
        message: string;
      };
      expect(json.success).toBe(true);
      expect(json.data.id).toBe("wait-001");
      expect(json.message).toContain("A005");
    });

    it("returns 500 when service throws an error", async () => {
      mockServiceInstance.joinWaitingList.mockRejectedValue(
        new Error("Queue is closed"),
      );
      const req = new Request("http://localhost/waiting-list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: "restaurant-001",
          customerName: "Alice",
          customerPhone: "0912345678",
          partySize: 2,
        }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string; message: string };
      };
      expect(json.success).toBe(false);
      expect(json.error).toHaveProperty("code");
      expect(json.error).toHaveProperty("message");
    });
  });

  // ─── GET /:id - Get Entry by ID ──────────────────────────────────

  describe("GET /:id - Get Entry by ID", () => {
    it("returns 200 with entry when found", async () => {
      const req = new Request("http://localhost/waiting-list/wait-001");
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: { id: string };
      };
      expect(json.success).toBe(true);
      expect(json.data.id).toBe("wait-001");
    });

    it("returns 404 when entry is not found", async () => {
      mockServiceInstance.getWaitingListEntryById.mockResolvedValue(null);
      const req = new Request("http://localhost/waiting-list/non-existent");
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(404);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
    });

    it("returns 500 when service throws", async () => {
      mockServiceInstance.getWaitingListEntryById.mockRejectedValue(
        new Error("DB error"),
      );
      const req = new Request("http://localhost/waiting-list/wait-001");
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });
  });

  // ─── GET /queue-status/:restaurantId ────────────────────────────

  describe("GET /queue-status/:restaurantId", () => {
    it("returns 200 with queue status", async () => {
      const req = new Request(
        "http://localhost/waiting-list/queue-status/restaurant-001",
      );
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: { totalWaiting: number };
      };
      expect(json.success).toBe(true);
      expect(json.data.totalWaiting).toBe(5);
    });

    it("returns 500 when service throws", async () => {
      mockServiceInstance.getQueueStatus.mockRejectedValue(
        new Error("Queue status error"),
      );
      const req = new Request(
        "http://localhost/waiting-list/queue-status/restaurant-001",
      );
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });
  });

  // ─── GET /estimate-wait/:restaurantId ───────────────────────────

  describe("GET /estimate-wait/:restaurantId", () => {
    it("returns 200 with wait estimation", async () => {
      const req = new Request(
        "http://localhost/waiting-list/estimate-wait/restaurant-001?partySize=2",
      );
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: { estimatedWaitMinutes: number };
      };
      expect(json.success).toBe(true);
      expect(json.data.estimatedWaitMinutes).toBe(15);
    });

    it("defaults partySize to 2 when not provided", async () => {
      const req = new Request(
        "http://localhost/waiting-list/estimate-wait/restaurant-001",
      );
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      expect(mockServiceInstance.estimateWaitTime).toHaveBeenCalledWith({
        restaurantId: "restaurant-001",
        partySize: 2,
      });
    });

    it("returns 500 when service throws", async () => {
      mockServiceInstance.estimateWaitTime.mockRejectedValue(
        new Error("Estimation error"),
      );
      const req = new Request(
        "http://localhost/waiting-list/estimate-wait/restaurant-001",
      );
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });
  });

  // ─── DELETE /:id - Cancel Waiting ───────────────────────────────

  describe("DELETE /:id - Cancel Waiting", () => {
    it("returns 400 when customerPhone is missing", async () => {
      const req = new Request("http://localhost/waiting-list/wait-001", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
    });

    it("returns 403 when phone does not match", async () => {
      mockServiceInstance.getWaitingListEntryById.mockResolvedValue({
        id: "wait-001",
        customerPhone: "0912345678",
        restaurantId: "restaurant-001",
      });
      const req = new Request("http://localhost/waiting-list/wait-001", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerPhone: "0999999999" }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(403);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
    });

    it("returns 403 when entry is not found (phone mismatch)", async () => {
      mockServiceInstance.getWaitingListEntryById.mockResolvedValue(null);
      const req = new Request("http://localhost/waiting-list/wait-001", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerPhone: "0912345678" }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(403);
    });

    it("returns 200 when phone matches and cancellation succeeds", async () => {
      mockServiceInstance.getWaitingListEntryById.mockResolvedValue({
        id: "wait-001",
        customerPhone: "0912345678",
        restaurantId: "restaurant-001",
      });
      const req = new Request("http://localhost/waiting-list/wait-001", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerPhone: "0912345678" }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: { status: string };
        message: string;
      };
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("cancelled");
    });

    it("returns 500 when cancel service throws", async () => {
      mockServiceInstance.getWaitingListEntryById.mockResolvedValue({
        id: "wait-001",
        customerPhone: "0912345678",
        restaurantId: "restaurant-001",
      });
      mockServiceInstance.cancelWaiting.mockRejectedValue(
        new Error("Cannot cancel at this state"),
      );
      const req = new Request("http://localhost/waiting-list/wait-001", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerPhone: "0912345678" }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string; message: string };
      };
      expect(json.success).toBe(false);
      expect(json.error).toHaveProperty("code");
      expect(json.error).toHaveProperty("message");
    });
  });

  // ─── POST /:id/confirm - Customer Confirm ───────────────────────

  describe("POST /:id/confirm - Customer Confirm", () => {
    it("returns 200 with confirmed entry", async () => {
      const req = new Request(
        "http://localhost/waiting-list/wait-001/confirm",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: { status: string };
      };
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("confirmed");
    });

    it("returns 500 when service throws", async () => {
      mockServiceInstance.confirmWaiting.mockRejectedValue(
        new Error("Invalid state transition"),
      );
      const req = new Request(
        "http://localhost/waiting-list/wait-001/confirm",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string; message: string };
      };
      expect(json.success).toBe(false);
      expect(json.error).toHaveProperty("code");
      expect(json.error).toHaveProperty("message");
    });
  });

  // ─── GET / - List Waiting List (Protected) ───────────────────────

  describe("GET / - List Waiting List (Protected)", () => {
    it("returns 200 with list and pagination", async () => {
      const req = new Request("http://localhost/waiting-list");
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: unknown[];
        pagination: { total: number };
      };
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.pagination.total).toBe(1);
    });

    it("includes pagination metadata in response", async () => {
      mockServiceInstance.listWaitingList.mockResolvedValue({
        data: [],
        total: 20,
      });
      const req = new Request("http://localhost/waiting-list?page=2&limit=10");
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      };
      expect(json.pagination.page).toBe(2);
      expect(json.pagination.limit).toBe(10);
      expect(json.pagination.total).toBe(20);
      expect(json.pagination.totalPages).toBe(2);
    });

    it("returns 500 when service throws", async () => {
      mockServiceInstance.listWaitingList.mockRejectedValue(
        new Error("DB error"),
      );
      const req = new Request("http://localhost/waiting-list");
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });
  });

  // ─── POST /:id/call - Call Waiting (Protected) ───────────────────

  describe("POST /:id/call - Call Waiting (Protected)", () => {
    it("returns 400 when tableId is missing", async () => {
      const req = new Request("http://localhost/waiting-list/wait-001/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });

    it("returns 404 when entry is not found", async () => {
      mockServiceInstance.getWaitingListEntryById.mockResolvedValue(null);
      const req = new Request("http://localhost/waiting-list/wait-001/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: "table-001" }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(404);
    });

    it("returns 403 when user operates on another restaurant", async () => {
      mockServiceInstance.getWaitingListEntryById.mockResolvedValue({
        id: "wait-001",
        restaurantId: "other-restaurant",
        customerPhone: "0912345678",
      });

      // Override user middleware to role=1 with different restaurantId
      const appWithDiffRestaurant = new Hono();
      appWithDiffRestaurant.use("/*", async (c, next) => {
        c.set("user", {
          id: 2,
          username: "testuser2",
          role: 1,
          restaurantId: "restaurant-001",
        } as AuthUser);
        await next();
      });
      const routesModule = await import("../routes/index");
      appWithDiffRestaurant.route("/waiting-list", routesModule.default);
      attachOnError(appWithDiffRestaurant);

      const req = new Request("http://localhost/waiting-list/wait-001/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: "table-001" }),
      });
      const res = await appWithDiffRestaurant.fetch(req, mockEnv);
      expect(res.status).toBe(403);
    });

    it("returns 200 when call succeeds", async () => {
      const req = new Request("http://localhost/waiting-list/wait-001/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: "table-001" }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: { status: string };
      };
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("called");
    });

    it("returns 500 when call service throws", async () => {
      mockServiceInstance.callWaiting.mockRejectedValue(
        new Error("Table not available"),
      );
      const req = new Request("http://localhost/waiting-list/wait-001/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: "table-001" }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string; message: string };
      };
      expect(json.success).toBe(false);
      expect(json.error).toHaveProperty("code");
      expect(json.error).toHaveProperty("message");
    });
  });

  // ─── POST /:id/seat - Mark Seated (Protected) ────────────────────

  describe("POST /:id/seat - Mark Seated (Protected)", () => {
    it("returns 404 when entry is not found", async () => {
      mockServiceInstance.getWaitingListEntryById.mockResolvedValue(null);
      const req = new Request("http://localhost/waiting-list/wait-001/seat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(404);
    });

    it("returns 403 when user operates on another restaurant", async () => {
      mockServiceInstance.getWaitingListEntryById.mockResolvedValue({
        id: "wait-001",
        restaurantId: "other-restaurant",
      });

      const appWithDiffRestaurant = new Hono();
      appWithDiffRestaurant.use("/*", async (c, next) => {
        c.set("user", {
          id: 2,
          username: "testuser2",
          role: 1,
          restaurantId: "restaurant-001",
        } as AuthUser);
        await next();
      });
      const routesModule = await import("../routes/index");
      appWithDiffRestaurant.route("/waiting-list", routesModule.default);
      attachOnError(appWithDiffRestaurant);

      const req = new Request("http://localhost/waiting-list/wait-001/seat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const res = await appWithDiffRestaurant.fetch(req, mockEnv);
      expect(res.status).toBe(403);
    });

    it("returns 200 when mark seated succeeds", async () => {
      const req = new Request("http://localhost/waiting-list/wait-001/seat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: { status: string };
      };
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("seated");
    });

    it("returns 500 when service throws", async () => {
      mockServiceInstance.markSeated.mockRejectedValue(
        new Error("Invalid state"),
      );
      const req = new Request("http://localhost/waiting-list/wait-001/seat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });
  });

  // ─── POST /:id/expire - Mark Expired (Protected) ─────────────────

  describe("POST /:id/expire - Mark Expired (Protected)", () => {
    it("returns 404 when entry is not found", async () => {
      mockServiceInstance.getWaitingListEntryById.mockResolvedValue(null);
      const req = new Request("http://localhost/waiting-list/wait-001/expire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(404);
    });

    it("returns 403 when user operates on another restaurant", async () => {
      mockServiceInstance.getWaitingListEntryById.mockResolvedValue({
        id: "wait-001",
        restaurantId: "other-restaurant",
      });

      const appWithDiffRestaurant = new Hono();
      appWithDiffRestaurant.use("/*", async (c, next) => {
        c.set("user", {
          id: 2,
          username: "testuser2",
          role: 1,
          restaurantId: "restaurant-001",
        } as AuthUser);
        await next();
      });
      const routesModule = await import("../routes/index");
      appWithDiffRestaurant.route("/waiting-list", routesModule.default);
      attachOnError(appWithDiffRestaurant);

      const req = new Request("http://localhost/waiting-list/wait-001/expire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const res = await appWithDiffRestaurant.fetch(req, mockEnv);
      expect(res.status).toBe(403);
    });

    it("returns 200 when expire succeeds", async () => {
      const req = new Request("http://localhost/waiting-list/wait-001/expire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: { status: string };
      };
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("expired");
    });

    it("returns 500 when service throws", async () => {
      mockServiceInstance.expireWaiting.mockRejectedValue(
        new Error("Cannot expire in current state"),
      );
      const req = new Request("http://localhost/waiting-list/wait-001/expire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });
  });

  // ─── GET /stats/:restaurantId - Stats (Protected, roles 0/1) ─────

  describe("GET /stats/:restaurantId - Waiting Stats (Protected)", () => {
    it("returns 200 with stats for own restaurant", async () => {
      const req = new Request(
        "http://localhost/waiting-list/stats/restaurant-001",
      );
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: { totalWaiting: number };
      };
      expect(json.success).toBe(true);
      expect(json.data.totalWaiting).toBe(10);
    });

    it("returns 403 when non-admin accesses another restaurant stats", async () => {
      const appWithDiffRestaurant = new Hono();
      appWithDiffRestaurant.use("/*", async (c, next) => {
        c.set("user", {
          id: 2,
          username: "testuser2",
          role: 1,
          restaurantId: "restaurant-001",
        } as AuthUser);
        await next();
      });
      const routesModule = await import("../routes/index");
      appWithDiffRestaurant.route("/waiting-list", routesModule.default);
      attachOnError(appWithDiffRestaurant);

      const req = new Request(
        "http://localhost/waiting-list/stats/other-restaurant",
      );
      const res = await appWithDiffRestaurant.fetch(req, mockEnv);
      expect(res.status).toBe(403);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });

    it("allows admin (role 0) to access any restaurant stats", async () => {
      const appAdmin = new Hono();
      appAdmin.use("/*", async (c, next) => {
        c.set("user", {
          id: 999,
          username: "admin",
          role: 0,
          restaurantId: undefined,
        } as AuthUser);
        await next();
      });
      const routesModule = await import("../routes/index");
      appAdmin.route("/waiting-list", routesModule.default);
      attachOnError(appAdmin);

      const req = new Request(
        "http://localhost/waiting-list/stats/any-restaurant",
      );
      const res = await appAdmin.fetch(req, mockEnv);
      expect(res.status).toBe(200);
    });

    it("returns 500 when service throws", async () => {
      mockServiceInstance.getWaitingStats.mockRejectedValue(
        new Error("Stats error"),
      );
      const req = new Request(
        "http://localhost/waiting-list/stats/restaurant-001",
      );
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });

    it("passes date query parameter to service", async () => {
      const req = new Request(
        "http://localhost/waiting-list/stats/restaurant-001?date=2026-03-14",
      );
      await app.fetch(req, mockEnv);
      expect(mockServiceInstance.getWaitingStats).toHaveBeenCalledWith(
        "restaurant-001",
        "2026-03-14",
      );
    });
  });

  // ─── POST /batch-call - Batch Call (Protected) ───────────────────

  describe("POST /batch-call - Batch Call (Protected)", () => {
    it("returns 200 with batch call results", async () => {
      mockServiceInstance.batchCallNext.mockResolvedValue([
        { id: "wait-001", success: true, tableId: 1, message: "已叫號" },
        { id: "wait-002", success: false, message: "無可用桌位" },
      ]);

      const req = new Request("http://localhost/waiting-list/batch-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: "restaurant-001", count: 2 }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: unknown[];
        message: string;
      };
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.message).toContain("1/2");
    });

    it("returns 400 when no restaurantId and admin role", async () => {
      const appAdmin = new Hono();
      appAdmin.use("/*", async (c, next) => {
        c.set("user", {
          id: 999,
          username: "admin",
          role: 0,
          restaurantId: undefined,
        } as AuthUser);
        await next();
      });
      const routesModule = await import("../routes/index");
      appAdmin.route("/waiting-list", routesModule.default);
      attachOnError(appAdmin);

      const req = new Request("http://localhost/waiting-list/batch-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 2 }), // no restaurantId
      });
      const res = await appAdmin.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });

    it("uses user restaurantId for non-admin roles", async () => {
      mockServiceInstance.batchCallNext.mockResolvedValue([]);
      const req = new Request("http://localhost/waiting-list/batch-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 1 }), // no restaurantId in body
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      // Service should have been called with user's restaurantId
      expect(mockServiceInstance.batchCallNext).toHaveBeenCalledWith(
        "restaurant-001",
        1,
      );
    });

    it("returns 500 when service throws", async () => {
      mockServiceInstance.batchCallNext.mockRejectedValue(
        new Error("DB failure"),
      );
      const req = new Request("http://localhost/waiting-list/batch-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: "restaurant-001", count: 1 }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });

    it("defaults count to 1 when not provided", async () => {
      mockServiceInstance.batchCallNext.mockResolvedValue([]);
      const req = new Request("http://localhost/waiting-list/batch-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: "restaurant-001" }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      expect(mockServiceInstance.batchCallNext).toHaveBeenCalledWith(
        "restaurant-001",
        1,
      );
    });
  });
});
