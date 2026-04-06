import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { ApiError } from "../../../shared/utils/api-error";
import { ErrorSanitizer } from "../../../utils/errorSanitizer";

// ─── Mutable state shared between mocks and tests ──────────────────────────
const state = vi.hoisted(() => ({
  user: {
    id: 1,
    role: 0,
    restaurantId: null as string | null,
    username: "admin",
  },
  validatedBody: null as Record<string, unknown> | null,
  validatedQuery: { page: 1, limit: 20 } as Record<string, unknown>,
  validatedParams: { id: 1 } as Record<string, unknown>,
}));

// ─── Auth middleware mock ──────────────────────────────────────────────────
vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn((c: any, next: any) => {
    c.set("user", state.user);
    return next();
  }),
  requireRole: () => vi.fn((c: any, next: any) => next()),
}));

// ─── Validation middleware mock ────────────────────────────────────────────
vi.mock("../../../middleware/validation", () => ({
  validateBody: () =>
    vi.fn((c: any, next: any) => {
      c.set("validatedBody", state.validatedBody);
      return next();
    }),
  validateQuery: () =>
    vi.fn((c: any, next: any) => {
      c.set("validatedQuery", state.validatedQuery);
      return next();
    }),
  validateParams: () =>
    vi.fn((c: any, next: any) => {
      c.set("validatedParams", state.validatedParams);
      return next();
    }),
}));

// ─── FeedbackService mock ──────────────────────────────────────────────────
const mockService = vi.hoisted(() => ({
  createFeedback: vi.fn(),
  getFeedbackById: vi.fn(),
  listFeedback: vi.fn(),
  updateFeedbackStatus: vi.fn(),
  updateFeedback: vi.fn(),
  deleteFeedback: vi.fn(),
  addResponse: vi.fn(),
  getResponses: vi.fn(),
  getFeedbackStats: vi.fn(),
  updateResponse: vi.fn(),
  deleteResponse: vi.fn(),
}));

vi.mock("@makanmakan/database", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@makanmakan/database")>();
  return {
    ...actual,
    FeedbackService: vi.fn(function () {
      return mockService;
    }),
  };
});

// Import routes AFTER mocks
import routes from "../routes";

// ─── Helpers ───────────────────────────────────────────────────────────────
const mockEnv = { DB: {}, CACHE_KV: {} };

/** Mirrors the global onError handler in apps/api/src/index.ts */
function attachGlobalErrorHandler(app: Hono) {
  const STATUS_MAP: Record<string, number> = {
    validation: 400,
    authentication: 401,
    authorization: 403,
    not_found: 404,
    rate_limit: 429,
    server_error: 500,
  };

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        {
          success: false,
          error: {
            code: err.code,
            message: ErrorSanitizer.sanitizeMessage(err.message),
          },
        },
        err.status as any,
      );
    }

    const sanitized = ErrorSanitizer.sanitizeError(err);
    const status = STATUS_MAP[sanitized.type] ?? 500;

    return c.json(
      {
        success: false,
        error: {
          code: sanitized.code ?? "INTERNAL_ERROR",
          message: sanitized.message,
        },
      },
      status as any,
    );
  });
}

// Shared mock data
const mockFeedback = {
  id: 1,
  restaurantId: "restaurant-A",
  userId: 2,
  category: "bug_report",
  priority: "medium",
  status: "open",
  relatedModule: "orders",
  subject: "Orders page not loading",
  description: "The orders page shows a blank screen after login.",
  attachmentUrls: [],
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  resolvedAt: null,
  resolvedBy: null,
  user: { id: 2, username: "owner1" },
  restaurant: { id: "restaurant-A", name: "Grandma Shop" },
  responses: [],
};

const mockResponse = {
  id: 1,
  feedbackId: 1,
  userId: 1,
  message: "We are looking into this issue.",
  isInternal: false,
  createdAt: new Date("2026-01-02"),
};

// ─── Tests ─────────────────────────────────────────────────────────────────
describe("Feedback Routes", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default: admin user
    state.user = { id: 1, role: 0, restaurantId: null, username: "admin" };
    state.validatedQuery = { page: 1, limit: 20 };
    state.validatedParams = { id: 1 };
    state.validatedBody = null;

    // Default service responses
    mockService.createFeedback.mockResolvedValue(mockFeedback);
    mockService.getFeedbackById.mockResolvedValue({ ...mockFeedback });
    mockService.listFeedback.mockResolvedValue({
      feedback: [mockFeedback],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    mockService.updateFeedbackStatus.mockResolvedValue({
      ...mockFeedback,
      status: "in_progress",
    });
    mockService.addResponse.mockResolvedValue(mockResponse);
    mockService.getFeedbackStats.mockResolvedValue({
      total: 5,
      byStatus: { open: 3, in_progress: 2 },
      byCategory: { bug_report: 3, feature_request: 2 },
      byPriority: { medium: 4, high: 1 },
      avgResolutionTimeMs: null,
    });

    app = new Hono();
    app.route("/feedback", routes);
    attachGlobalErrorHandler(app);
  });

  // ─── POST / — Create feedback ────────────────────────────────────
  describe("POST /", () => {
    beforeEach(() => {
      state.user = {
        id: 2,
        role: 1,
        restaurantId: "restaurant-A",
        username: "owner1",
      };
      state.validatedBody = {
        subject: "Orders page not loading",
        description: "The orders page shows a blank screen after login.",
        category: "bug_report",
        priority: "medium",
        relatedModule: "orders",
      };
    });

    it("returns 201 when owner submits valid feedback", async () => {
      const res = await app.fetch(
        new Request("http://localhost/feedback", { method: "POST" }),
        mockEnv,
      );
      expect(res.status).toBe(201);
      const json = (await res.json()) as { success: boolean; data: unknown };
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();

      expect(mockService.createFeedback).toHaveBeenCalledOnce();
      expect(mockService.createFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId: "restaurant-A",
          userId: 2,
          category: "bug_report",
        }),
      );
    });

    it("returns 400 when owner has no restaurantId", async () => {
      state.user = { id: 2, role: 1, restaurantId: null, username: "owner1" };

      const res = await app.fetch(
        new Request("http://localhost/feedback", { method: "POST" }),
        mockEnv,
      );
      expect(res.status).toBe(400);
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("NO_RESTAURANT");

      expect(mockService.createFeedback).not.toHaveBeenCalled();
    });

    it("returns 500 when service throws", async () => {
      mockService.createFeedback.mockRejectedValue(new Error("DB write failed"));

      const res = await app.fetch(
        new Request("http://localhost/feedback", { method: "POST" }),
        mockEnv,
      );
      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });
  });

  // ─── GET /stats — Admin statistics ───────────────────────────────
  describe("GET /stats", () => {
    it("returns 200 with stats for admin", async () => {
      const res = await app.fetch(
        new Request("http://localhost/feedback/stats"),
        mockEnv,
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: { total: number; byStatus: unknown };
      };
      expect(json.success).toBe(true);
      expect(json.data.total).toBe(5);
      expect(json.data.byStatus).toBeDefined();

      expect(mockService.getFeedbackStats).toHaveBeenCalledOnce();
    });

    it("returns 500 when stats service throws", async () => {
      mockService.getFeedbackStats.mockRejectedValue(new Error("Query failed"));

      const res = await app.fetch(
        new Request("http://localhost/feedback/stats"),
        mockEnv,
      );
      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });
  });

  // ─── GET / — List feedback ────────────────────────────────────────
  describe("GET /", () => {
    it("returns 200 with paginated list for admin", async () => {
      const res = await app.fetch(
        new Request("http://localhost/feedback"),
        mockEnv,
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        feedback: unknown[];
        pagination: unknown;
      };
      expect(json.success).toBe(true);
      expect(Array.isArray(json.feedback)).toBe(true);
      expect(json.pagination).toBeDefined();

      expect(mockService.listFeedback).toHaveBeenCalledOnce();
    });

    it("admin does NOT force-filter by restaurantId", async () => {
      state.validatedQuery = { page: 1, limit: 20 }; // no restaurantId

      await app.fetch(new Request("http://localhost/feedback"), mockEnv);

      expect(mockService.listFeedback).toHaveBeenCalledOnce();
      // Admin with no restaurantId query: restaurantId is not added to filters
      const [filters, , , isAdmin] = mockService.listFeedback.mock.calls[0];
      expect(isAdmin).toBe(true);
      expect(filters.restaurantId).toBeUndefined();
    });

    it("admin CAN filter by specific restaurantId", async () => {
      state.validatedQuery = {
        page: 1,
        limit: 20,
        restaurantId: "restaurant-B",
      };

      await app.fetch(new Request("http://localhost/feedback"), mockEnv);

      expect(mockService.listFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ restaurantId: "restaurant-B" }),
        1,
        20,
        true,
      );
    });

    it("owner list is force-filtered to own userId", async () => {
      state.user = {
        id: 2,
        role: 1,
        restaurantId: "restaurant-A",
        username: "owner1",
      };
      state.validatedQuery = { page: 1, limit: 20 };

      await app.fetch(new Request("http://localhost/feedback"), mockEnv);

      expect(mockService.listFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 2 }),
        1,
        20,
        false, // isAdmin=false for owner
      );
    });

    it("returns 500 when list service throws", async () => {
      mockService.listFeedback.mockRejectedValue(new Error("Query error"));

      const res = await app.fetch(
        new Request("http://localhost/feedback"),
        mockEnv,
      );
      expect(res.status).toBe(500);
    });
  });

  // ─── GET /:id — Feedback detail ───────────────────────────────────
  describe("GET /:id", () => {
    it("returns 200 with full feedback including internal responses for admin", async () => {
      const feedbackWithInternal = {
        ...mockFeedback,
        responses: [
          { ...mockResponse, isInternal: false },
          { ...mockResponse, id: 2, message: "Internal note", isInternal: true },
        ],
      };
      mockService.getFeedbackById.mockResolvedValue(feedbackWithInternal);

      const res = await app.fetch(
        new Request("http://localhost/feedback/1"),
        mockEnv,
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: { responses: Array<{ isInternal: boolean }> };
      };
      expect(json.success).toBe(true);
      // Admin sees all responses including internal
      expect(json.data.responses).toHaveLength(2);
    });

    it("owner sees own restaurant feedback with internal responses filtered out", async () => {
      state.user = {
        id: 2,
        role: 1,
        restaurantId: "restaurant-A",
        username: "owner1",
      };
      mockService.getFeedbackById.mockResolvedValue({
        ...mockFeedback,
        restaurantId: "restaurant-A",
        responses: [
          { ...mockResponse, isInternal: false },
          { ...mockResponse, id: 2, message: "Internal note", isInternal: true },
        ],
      });

      const res = await app.fetch(
        new Request("http://localhost/feedback/1"),
        mockEnv,
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: { responses: Array<{ isInternal: boolean }> };
      };
      expect(json.success).toBe(true);
      // Owner sees only non-internal responses
      expect(json.data.responses).toHaveLength(1);
      expect(json.data.responses[0].isInternal).toBe(false);
    });

    it("returns 403 when owner tries to access another user's feedback", async () => {
      state.user = {
        id: 99,
        role: 1,
        restaurantId: "restaurant-A",
        username: "owner2",
      };
      // Feedback belongs to userId=2, not userId=99
      mockService.getFeedbackById.mockResolvedValue({
        ...mockFeedback,
      });

      const res = await app.fetch(
        new Request("http://localhost/feedback/1"),
        mockEnv,
      );
      expect(res.status).toBe(403);
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("FEEDBACK_ACCESS_DENIED");
    });

    it("returns 404 when feedback does not exist", async () => {
      mockService.getFeedbackById.mockResolvedValue(null);

      const res = await app.fetch(
        new Request("http://localhost/feedback/999"),
        mockEnv,
      );
      expect(res.status).toBe(404);
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("FEEDBACK_NOT_FOUND");
    });

    it("returns 500 when service throws", async () => {
      mockService.getFeedbackById.mockRejectedValue(new Error("DB read failed"));

      const res = await app.fetch(
        new Request("http://localhost/feedback/1"),
        mockEnv,
      );
      expect(res.status).toBe(500);
    });
  });

  // ─── PUT /:id/status — Update status ─────────────────────────────
  describe("PUT /:id/status", () => {
    beforeEach(() => {
      state.validatedBody = { status: "in_progress" };
    });

    it("returns 200 when admin updates status", async () => {
      const res = await app.fetch(
        new Request("http://localhost/feedback/1/status", { method: "PUT" }),
        mockEnv,
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: unknown;
        message: string;
      };
      expect(json.success).toBe(true);
      expect(json.message).toBe("Status updated successfully");

      expect(mockService.updateFeedbackStatus).toHaveBeenCalledOnce();
      expect(mockService.updateFeedbackStatus).toHaveBeenCalledWith(
        1,
        "in_progress",
        undefined, // not resolved, so no resolvedBy
      );
    });

    it("passes resolvedBy when status changes to 'resolved'", async () => {
      state.user = { id: 1, role: 0, restaurantId: null, username: "admin" };
      state.validatedBody = { status: "resolved" };
      mockService.updateFeedbackStatus.mockResolvedValue({
        ...mockFeedback,
        status: "resolved",
        resolvedBy: 1,
      });

      await app.fetch(
        new Request("http://localhost/feedback/1/status", { method: "PUT" }),
        mockEnv,
      );

      expect(mockService.updateFeedbackStatus).toHaveBeenCalledWith(
        1,
        "resolved",
        1, // admin user id
      );
    });

    it("does NOT pass resolvedBy for non-resolved statuses", async () => {
      state.validatedBody = { status: "closed" };

      await app.fetch(
        new Request("http://localhost/feedback/1/status", { method: "PUT" }),
        mockEnv,
      );

      expect(mockService.updateFeedbackStatus).toHaveBeenCalledWith(
        1,
        "closed",
        undefined,
      );
    });

    it("returns 500 when service throws", async () => {
      mockService.updateFeedbackStatus.mockRejectedValue(
        new Error("Update failed"),
      );

      const res = await app.fetch(
        new Request("http://localhost/feedback/1/status", { method: "PUT" }),
        mockEnv,
      );
      expect(res.status).toBe(500);
    });
  });

  // ─── POST /:id/responses — Add response ───────────────────────────
  describe("POST /:id/responses", () => {
    beforeEach(() => {
      state.validatedBody = { message: "We are looking into this.", isInternal: false };
    });

    it("returns 201 when admin adds a public response", async () => {
      const res = await app.fetch(
        new Request("http://localhost/feedback/1/responses", { method: "POST" }),
        mockEnv,
      );
      expect(res.status).toBe(201);
      const json = (await res.json()) as { success: boolean; data: unknown };
      expect(json.success).toBe(true);

      expect(mockService.addResponse).toHaveBeenCalledOnce();
      expect(mockService.addResponse).toHaveBeenCalledWith(
        1,
        1,
        "We are looking into this.",
        false,
      );
    });

    it("admin can post internal note (isInternal=true)", async () => {
      state.validatedBody = { message: "Internal: needs DB check", isInternal: true };

      await app.fetch(
        new Request("http://localhost/feedback/1/responses", { method: "POST" }),
        mockEnv,
      );

      expect(mockService.addResponse).toHaveBeenCalledWith(
        1,
        1,
        "Internal: needs DB check",
        true, // admin isInternal passes through
      );
    });

    it("owner's isInternal is always forced to false", async () => {
      state.user = {
        id: 2,
        role: 1,
        restaurantId: "restaurant-A",
        username: "owner1",
      };
      state.validatedBody = { message: "Any reply", isInternal: true }; // owner tries to set isInternal
      mockService.getFeedbackById.mockResolvedValue({
        ...mockFeedback,
        restaurantId: "restaurant-A",
      });

      await app.fetch(
        new Request("http://localhost/feedback/1/responses", { method: "POST" }),
        mockEnv,
      );

      // Even though owner passed isInternal=true, it gets forced to false
      expect(mockService.addResponse).toHaveBeenCalledWith(
        1,
        2,
        "Any reply",
        false, // forced to false for non-admin
      );
    });

    it("returns 404 when feedback does not exist", async () => {
      mockService.getFeedbackById.mockResolvedValue(null);

      const res = await app.fetch(
        new Request("http://localhost/feedback/1/responses", { method: "POST" }),
        mockEnv,
      );
      expect(res.status).toBe(404);
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("FEEDBACK_NOT_FOUND");

      expect(mockService.addResponse).not.toHaveBeenCalled();
    });

    it("returns 403 when owner replies to another user's feedback", async () => {
      state.user = {
        id: 99,
        role: 1,
        restaurantId: "restaurant-A",
        username: "owner2",
      };
      // Feedback belongs to userId=2, not userId=99
      mockService.getFeedbackById.mockResolvedValue({
        ...mockFeedback,
      });

      const res = await app.fetch(
        new Request("http://localhost/feedback/1/responses", { method: "POST" }),
        mockEnv,
      );
      expect(res.status).toBe(403);
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("FEEDBACK_ACCESS_DENIED");

      expect(mockService.addResponse).not.toHaveBeenCalled();
    });

    it("returns 500 when addResponse service throws", async () => {
      mockService.addResponse.mockRejectedValue(new Error("Insert failed"));

      const res = await app.fetch(
        new Request("http://localhost/feedback/1/responses", { method: "POST" }),
        mockEnv,
      );
      expect(res.status).toBe(500);
    });
  });

  // ── PATCH /:id (edit feedback) ────────────────────────────────────────────
  describe("PATCH /:id", () => {
    it("admin can edit any feedback", async () => {
      state.validatedBody = { subject: "Updated subject" };
      mockService.updateFeedback.mockResolvedValue({
        ...mockFeedback,
        subject: "Updated subject",
      });

      const res = await app.fetch(
        new Request("http://localhost/feedback/1", { method: "PATCH" }),
        mockEnv,
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; data: any };
      expect(json.success).toBe(true);
      expect(json.data.subject).toBe("Updated subject");
      expect(mockService.updateFeedback).toHaveBeenCalledWith(
        1,
        { subject: "Updated subject" },
        1,
        true,
      );
    });

    it("owner can edit own feedback", async () => {
      state.user = {
        id: 2,
        role: 1,
        restaurantId: "restaurant-A",
        username: "owner1",
      };
      state.validatedBody = { priority: "high" };
      mockService.updateFeedback.mockResolvedValue({
        ...mockFeedback,
        priority: "high",
      });

      const res = await app.fetch(
        new Request("http://localhost/feedback/1", { method: "PATCH" }),
        mockEnv,
      );
      expect(res.status).toBe(200);
      expect(mockService.updateFeedback).toHaveBeenCalledWith(
        1,
        { priority: "high" },
        2,
        false,
      );
    });

    it("returns 403 when owner edits another user's feedback", async () => {
      state.user = {
        id: 99,
        role: 1,
        restaurantId: "restaurant-A",
        username: "owner2",
      };
      state.validatedBody = { subject: "Hacked" };

      const res = await app.fetch(
        new Request("http://localhost/feedback/1", { method: "PATCH" }),
        mockEnv,
      );
      expect(res.status).toBe(403);
      expect(mockService.updateFeedback).not.toHaveBeenCalled();
    });

    it("returns 404 when feedback not found", async () => {
      mockService.getFeedbackById.mockResolvedValue(null);
      state.validatedBody = { subject: "test" };

      const res = await app.fetch(
        new Request("http://localhost/feedback/999", { method: "PATCH" }),
        mockEnv,
      );
      // Admin path: goes directly to updateFeedback, returns null → 404
      mockService.updateFeedback.mockResolvedValue(null);
      // Re-test for admin
      const res2 = await app.fetch(
        new Request("http://localhost/feedback/999", { method: "PATCH" }),
        mockEnv,
      );
      expect(res2.status).toBe(404);
    });

    it("returns 404 when owner edits non-open feedback (service returns null)", async () => {
      state.user = {
        id: 2,
        role: 1,
        restaurantId: "restaurant-A",
        username: "owner1",
      };
      state.validatedBody = { subject: "test" };
      mockService.updateFeedback.mockResolvedValue(null);

      const res = await app.fetch(
        new Request("http://localhost/feedback/1", { method: "PATCH" }),
        mockEnv,
      );
      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /:id (delete feedback) ─────────────────────────────────────────
  describe("DELETE /:id", () => {
    it("admin can delete any feedback", async () => {
      mockService.deleteFeedback.mockResolvedValue(true);

      const res = await app.fetch(
        new Request("http://localhost/feedback/1", { method: "DELETE" }),
        mockEnv,
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(true);
      expect(mockService.deleteFeedback).toHaveBeenCalledWith(1, 1, true);
    });

    it("owner can delete own feedback", async () => {
      state.user = {
        id: 2,
        role: 1,
        restaurantId: "restaurant-A",
        username: "owner1",
      };
      mockService.deleteFeedback.mockResolvedValue(true);

      const res = await app.fetch(
        new Request("http://localhost/feedback/1", { method: "DELETE" }),
        mockEnv,
      );
      expect(res.status).toBe(200);
      expect(mockService.deleteFeedback).toHaveBeenCalledWith(1, 2, false);
    });

    it("returns 403 when owner deletes another user's feedback", async () => {
      state.user = {
        id: 99,
        role: 1,
        restaurantId: "restaurant-A",
        username: "owner2",
      };

      const res = await app.fetch(
        new Request("http://localhost/feedback/1", { method: "DELETE" }),
        mockEnv,
      );
      expect(res.status).toBe(403);
      expect(mockService.deleteFeedback).not.toHaveBeenCalled();
    });

    it("returns 404 when feedback not found", async () => {
      mockService.deleteFeedback.mockResolvedValue(false);

      const res = await app.fetch(
        new Request("http://localhost/feedback/1", { method: "DELETE" }),
        mockEnv,
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 when owner deletes non-open feedback (service returns false)", async () => {
      state.user = {
        id: 2,
        role: 1,
        restaurantId: "restaurant-A",
        username: "owner1",
      };
      mockService.deleteFeedback.mockResolvedValue(false);

      const res = await app.fetch(
        new Request("http://localhost/feedback/1", { method: "DELETE" }),
        mockEnv,
      );
      expect(res.status).toBe(404);
    });

    it("returns 500 when service throws", async () => {
      mockService.deleteFeedback.mockRejectedValue(
        new Error("Transaction failed"),
      );

      const res = await app.fetch(
        new Request("http://localhost/feedback/1", { method: "DELETE" }),
        mockEnv,
      );
      expect(res.status).toBe(500);
    });
  });

  // ── PUT /:id/responses/:responseId (edit response) ─────────────────────
  describe("PUT /:id/responses/:responseId", () => {
    beforeEach(() => {
      state.validatedParams = { id: 1, responseId: 10 };
      state.validatedBody = { message: "Updated reply" };
      mockService.updateResponse.mockResolvedValue({
        ...mockResponse,
        id: 10,
        message: "Updated reply",
      });
    });

    it("returns 200 when admin edits any response", async () => {
      const res = await app.fetch(
        new Request("http://localhost/feedback/1/responses/10", {
          method: "PUT",
        }),
        mockEnv,
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; data: any };
      expect(json.success).toBe(true);
      expect(json.data.message).toBe("Updated reply");

      expect(mockService.updateResponse).toHaveBeenCalledOnce();
      expect(mockService.updateResponse).toHaveBeenCalledWith(
        10,
        1, // admin user id
        "Updated reply",
        true, // isAdmin
      );
    });

    it("owner can edit response on own feedback", async () => {
      state.user = {
        id: 2,
        role: 1,
        restaurantId: "restaurant-A",
        username: "owner1",
      };

      const res = await app.fetch(
        new Request("http://localhost/feedback/1/responses/10", {
          method: "PUT",
        }),
        mockEnv,
      );
      expect(res.status).toBe(200);

      expect(mockService.getFeedbackById).toHaveBeenCalledOnce();
      expect(mockService.updateResponse).toHaveBeenCalledWith(
        10,
        2, // owner user id
        "Updated reply",
        false, // isAdmin=false for owner
      );
    });

    it("returns 403 when owner edits response on another user's feedback", async () => {
      state.user = {
        id: 99,
        role: 1,
        restaurantId: "restaurant-A",
        username: "owner2",
      };

      const res = await app.fetch(
        new Request("http://localhost/feedback/1/responses/10", {
          method: "PUT",
        }),
        mockEnv,
      );
      expect(res.status).toBe(403);
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("FEEDBACK_ACCESS_DENIED");

      expect(mockService.updateResponse).not.toHaveBeenCalled();
    });

    it("returns 404 when feedback does not exist (owner path)", async () => {
      state.user = {
        id: 2,
        role: 1,
        restaurantId: "restaurant-A",
        username: "owner1",
      };
      mockService.getFeedbackById.mockResolvedValue(null);

      const res = await app.fetch(
        new Request("http://localhost/feedback/1/responses/10", {
          method: "PUT",
        }),
        mockEnv,
      );
      expect(res.status).toBe(404);
      expect(mockService.updateResponse).not.toHaveBeenCalled();
    });

    it("returns 404 when response not found (service returns null)", async () => {
      mockService.updateResponse.mockResolvedValue(null);

      const res = await app.fetch(
        new Request("http://localhost/feedback/1/responses/10", {
          method: "PUT",
        }),
        mockEnv,
      );
      expect(res.status).toBe(404);
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(json.error.code).toBe("RESPONSE_NOT_FOUND");
    });

    it("returns 500 when service throws", async () => {
      mockService.updateResponse.mockRejectedValue(
        new Error("Update failed"),
      );

      const res = await app.fetch(
        new Request("http://localhost/feedback/1/responses/10", {
          method: "PUT",
        }),
        mockEnv,
      );
      expect(res.status).toBe(500);
    });
  });

  // ── DELETE /:id/responses/:responseId (delete response) ────────────────
  describe("DELETE /:id/responses/:responseId", () => {
    beforeEach(() => {
      state.validatedParams = { id: 1, responseId: 10 };
      mockService.deleteResponse.mockResolvedValue(true);
    });

    it("returns 200 when admin deletes any response", async () => {
      const res = await app.fetch(
        new Request("http://localhost/feedback/1/responses/10", {
          method: "DELETE",
        }),
        mockEnv,
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(true);

      expect(mockService.deleteResponse).toHaveBeenCalledOnce();
      expect(mockService.deleteResponse).toHaveBeenCalledWith(
        10,
        1, // admin user id
        true, // isAdmin
      );
    });

    it("owner can delete response on own feedback", async () => {
      state.user = {
        id: 2,
        role: 1,
        restaurantId: "restaurant-A",
        username: "owner1",
      };

      const res = await app.fetch(
        new Request("http://localhost/feedback/1/responses/10", {
          method: "DELETE",
        }),
        mockEnv,
      );
      expect(res.status).toBe(200);

      expect(mockService.getFeedbackById).toHaveBeenCalledOnce();
      expect(mockService.deleteResponse).toHaveBeenCalledWith(
        10,
        2,
        false, // isAdmin=false
      );
    });

    it("returns 403 when owner deletes response on another user's feedback", async () => {
      state.user = {
        id: 99,
        role: 1,
        restaurantId: "restaurant-A",
        username: "owner2",
      };

      const res = await app.fetch(
        new Request("http://localhost/feedback/1/responses/10", {
          method: "DELETE",
        }),
        mockEnv,
      );
      expect(res.status).toBe(403);
      expect(mockService.deleteResponse).not.toHaveBeenCalled();
    });

    it("returns 404 when feedback does not exist (owner path)", async () => {
      state.user = {
        id: 2,
        role: 1,
        restaurantId: "restaurant-A",
        username: "owner1",
      };
      mockService.getFeedbackById.mockResolvedValue(null);

      const res = await app.fetch(
        new Request("http://localhost/feedback/1/responses/10", {
          method: "DELETE",
        }),
        mockEnv,
      );
      expect(res.status).toBe(404);
      expect(mockService.deleteResponse).not.toHaveBeenCalled();
    });

    it("returns 404 when response not found (service returns false)", async () => {
      mockService.deleteResponse.mockResolvedValue(false);

      const res = await app.fetch(
        new Request("http://localhost/feedback/1/responses/10", {
          method: "DELETE",
        }),
        mockEnv,
      );
      expect(res.status).toBe(404);
      const json = (await res.json()) as {
        success: boolean;
        error: { code: string };
      };
      expect(json.error.code).toBe("RESPONSE_NOT_FOUND");
    });

    it("returns 500 when service throws", async () => {
      mockService.deleteResponse.mockRejectedValue(
        new Error("Delete failed"),
      );

      const res = await app.fetch(
        new Request("http://localhost/feedback/1/responses/10", {
          method: "DELETE",
        }),
        mockEnv,
      );
      expect(res.status).toBe(500);
    });
  });
});
