import { describe, it, expect, beforeEach, vi } from "vitest";
import { FeedbackService } from "../FeedbackService";
import { resetAllFactories } from "@makanmakan/testing-utils";

// ─── Mock database helpers ────────────────────────────────────────────────
function createMockDb() {
  const returning = vi.fn();
  const whereFn = vi.fn(() => ({ returning, orderBy: vi.fn(() => []) }));
  const setFn = vi.fn(() => ({ where: whereFn }));
  const fromFn = vi.fn(() => ({
    where: whereFn,
    leftJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn(() => []),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn(() => []),
    groupBy: vi.fn(() => []),
  }));
  const valuesFn = vi.fn(() => ({ returning }));

  return {
    select: vi.fn(() => ({
      from: fromFn,
    })),
    insert: vi.fn(() => ({
      values: valuesFn,
    })),
    update: vi.fn(() => ({
      set: setFn,
    })),
    delete: vi.fn(() => ({
      where: whereFn,
    })),
    transaction: vi.fn((fn: any) => fn(mockTx)),
    // expose inner mocks for assertion
    _returning: returning,
    _where: whereFn,
    _set: setFn,
    _from: fromFn,
    _values: valuesFn,
  };
}

// Transaction mock reuses the same shape
const mockTx = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

// ─── Tests ────────────────────────────────────────────────────────────────
describe("FeedbackService", () => {
  let service: FeedbackService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    resetAllFactories();
    vi.clearAllMocks();
    mockDb = createMockDb();
    service = new FeedbackService({} as any, {
      JWT_SECRET: "test-secret",
      NODE_ENV: "test",
      MOCK_DRIZZLE_DB: mockDb,
    });
  });

  // ─── createFeedback ──────────────────────────────────────────────────
  describe("createFeedback", () => {
    it("inserts feedback and returns the created record", async () => {
      const input = {
        restaurantId: "rest-1",
        userId: 1,
        category: "bug_report" as const,
        subject: "Test bug",
        description: "Something is broken",
      };
      const expected = { id: 1, ...input, priority: "medium", status: "open" };
      mockDb._returning.mockResolvedValue([expected]);

      const result = await service.createFeedback(input);

      expect(result).toEqual(expected);
      expect(mockDb.insert).toHaveBeenCalledOnce();
      expect(mockDb._values).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId: "rest-1",
          userId: 1,
          category: "bug_report",
          subject: "Test bug",
          priority: "medium",
          relatedModule: "other",
        }),
      );
    });

    it("uses provided priority and relatedModule", async () => {
      const input = {
        restaurantId: "rest-1",
        userId: 1,
        category: "feature_request" as const,
        priority: "urgent" as const,
        relatedModule: "pos" as const,
        subject: "Add feature",
        description: "We need a new feature",
      };
      mockDb._returning.mockResolvedValue([{ id: 2, ...input }]);

      await service.createFeedback(input);

      expect(mockDb._values).toHaveBeenCalledWith(
        expect.objectContaining({
          priority: "urgent",
          relatedModule: "pos",
        }),
      );
    });

    it("serializes attachmentUrls as JSON string", async () => {
      const urls = ["https://example.com/a.png", "https://example.com/b.png"];
      mockDb._returning.mockResolvedValue([{ id: 3 }]);

      await service.createFeedback({
        restaurantId: "rest-1",
        userId: 1,
        category: "bug_report" as const,
        subject: "With attachments",
        description: "See screenshots",
        attachmentUrls: urls,
      });

      expect(mockDb._values).toHaveBeenCalledWith(
        expect.objectContaining({
          attachmentUrls: JSON.stringify(urls),
        }),
      );
    });

    it("sets attachmentUrls to null when not provided", async () => {
      mockDb._returning.mockResolvedValue([{ id: 4 }]);

      await service.createFeedback({
        restaurantId: "rest-1",
        userId: 1,
        category: "bug_report" as const,
        subject: "No attachments",
        description: "Nothing to attach",
      });

      expect(mockDb._values).toHaveBeenCalledWith(
        expect.objectContaining({
          attachmentUrls: null,
        }),
      );
    });

    it("throws on database error", async () => {
      mockDb._returning.mockRejectedValue(new Error("DB insert failed"));

      await expect(
        service.createFeedback({
          restaurantId: "rest-1",
          userId: 1,
          category: "bug_report" as const,
          subject: "Fail",
          description: "Will fail",
        }),
      ).rejects.toThrow("DB insert failed");
    });
  });

  // ─── getFeedbackById ─────────────────────────────────────────────────
  describe("getFeedbackById", () => {
    it("returns null when feedback does not exist", async () => {
      // Mock the select chain to return empty
      const leftJoin2 = vi.fn(() => ({ where: vi.fn(() => []) }));
      const leftJoin1 = vi.fn(() => ({ leftJoin: leftJoin2 }));
      const fromFn = vi.fn(() => ({ leftJoin: leftJoin1 }));
      mockDb.select.mockReturnValue({ from: fromFn });

      const result = await service.getFeedbackById(999);

      expect(result).toBeNull();
    });

    it("returns feedback with parsed attachmentUrls and responses", async () => {
      const rawFeedback = {
        shop_feedback: {
          id: 1,
          restaurantId: "rest-1",
          userId: 1,
          subject: "Test",
          description: "Desc",
          attachmentUrls: '["https://example.com/a.png"]',
          status: "open",
        },
        users: { id: 1, username: "owner1" },
        restaurants: { id: "rest-1", name: "Shop A" },
      };

      // First select (main feedback query)
      const whereFn = vi.fn(() => [rawFeedback]);
      const leftJoin2 = vi.fn(() => ({ where: whereFn }));
      const leftJoin1 = vi.fn(() => ({ leftJoin: leftJoin2 }));
      const fromFn = vi.fn(() => ({ leftJoin: leftJoin1 }));
      mockDb.select.mockReturnValueOnce({ from: fromFn });

      // Second select (getResponses — called internally)
      const respOrderBy = vi.fn(() => [
        {
          feedback_responses: {
            id: 10,
            feedbackId: 1,
            message: "Reply",
            isInternal: false,
          },
          users: { id: 2, username: "admin" },
        },
      ]);
      const respWhere = vi.fn(() => ({ orderBy: respOrderBy }));
      const respLeftJoin = vi.fn(() => ({ where: respWhere }));
      const respFrom = vi.fn(() => ({ leftJoin: respLeftJoin }));
      mockDb.select.mockReturnValueOnce({ from: respFrom });

      const result = await service.getFeedbackById(1);

      expect(result).not.toBeNull();
      expect(result!.attachmentUrls).toEqual(["https://example.com/a.png"]);
      expect(result!.user).toEqual(
        expect.objectContaining({ username: "owner1" }),
      );
      expect(result!.responses).toHaveLength(1);
      expect(result!.responses[0].message).toBe("Reply");
    });

    it("returns empty array when attachmentUrls is null", async () => {
      const rawFeedback = {
        shop_feedback: {
          id: 1,
          attachmentUrls: null,
          status: "open",
        },
        users: { id: 1 },
        restaurants: { id: "rest-1" },
      };

      const whereFn = vi.fn(() => [rawFeedback]);
      const leftJoin2 = vi.fn(() => ({ where: whereFn }));
      const leftJoin1 = vi.fn(() => ({ leftJoin: leftJoin2 }));
      const fromFn = vi.fn(() => ({ leftJoin: leftJoin1 }));
      mockDb.select.mockReturnValueOnce({ from: fromFn });

      // Empty responses
      const respOrderBy = vi.fn(() => []);
      const respWhere = vi.fn(() => ({ orderBy: respOrderBy }));
      const respLeftJoin = vi.fn(() => ({ where: respWhere }));
      const respFrom = vi.fn(() => ({ leftJoin: respLeftJoin }));
      mockDb.select.mockReturnValueOnce({ from: respFrom });

      const result = await service.getFeedbackById(1);

      expect(result!.attachmentUrls).toEqual([]);
    });
  });

  // ─── updateFeedbackStatus ────────────────────────────────────────────
  describe("updateFeedbackStatus", () => {
    it("updates status and returns the record", async () => {
      const updated = { id: 1, status: "in_progress" };
      mockDb._returning.mockResolvedValue([updated]);

      const result = await service.updateFeedbackStatus(1, "in_progress");

      expect(result).toEqual(updated);
      expect(mockDb.update).toHaveBeenCalledOnce();
      expect(mockDb._set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "in_progress",
          updatedAt: expect.any(Date),
        }),
      );
    });

    it("sets resolvedAt and resolvedBy when status is 'resolved'", async () => {
      const updated = { id: 1, status: "resolved", resolvedBy: 5 };
      mockDb._returning.mockResolvedValue([updated]);

      const result = await service.updateFeedbackStatus(1, "resolved", 5);

      expect(result).toEqual(updated);
      expect(mockDb._set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "resolved",
          resolvedAt: expect.any(Date),
          resolvedBy: 5,
        }),
      );
    });

    it("does NOT set resolvedAt for non-resolved status", async () => {
      mockDb._returning.mockResolvedValue([{ id: 1, status: "closed" }]);

      await service.updateFeedbackStatus(1, "closed");

      const setArg = mockDb._set.mock.calls[0][0];
      expect(setArg.resolvedAt).toBeUndefined();
      expect(setArg.resolvedBy).toBeUndefined();
    });

    it("throws when feedback not found", async () => {
      mockDb._returning.mockResolvedValue([]);

      await expect(
        service.updateFeedbackStatus(999, "in_progress"),
      ).rejects.toThrow("Feedback not found");
    });
  });

  // ─── updateFeedback ──────────────────────────────────────────────────
  describe("updateFeedback", () => {
    it("admin can update any feedback (no userId/status constraint)", async () => {
      const updated = { id: 1, subject: "Updated" };
      mockDb._returning.mockResolvedValue([updated]);

      const result = await service.updateFeedback(
        1,
        { subject: "Updated" },
        99,
        true,
      );

      expect(result).toEqual(updated);
      expect(mockDb.update).toHaveBeenCalledOnce();
    });

    it("returns null when non-admin update finds no matching record", async () => {
      mockDb._returning.mockResolvedValue([]);

      const result = await service.updateFeedback(
        1,
        { subject: "Nope" },
        2,
        false,
      );

      expect(result).toBeNull();
    });

    it("serializes attachmentUrls when updating", async () => {
      const urls = ["https://example.com/new.png"];
      mockDb._returning.mockResolvedValue([{ id: 1 }]);

      await service.updateFeedback(1, { attachmentUrls: urls }, 1, true);

      expect(mockDb._set).toHaveBeenCalledWith(
        expect.objectContaining({
          attachmentUrls: JSON.stringify(urls),
        }),
      );
    });

    it("only includes defined fields in update payload", async () => {
      mockDb._returning.mockResolvedValue([{ id: 1 }]);

      await service.updateFeedback(1, { priority: "high" }, 1, true);

      const setArg = mockDb._set.mock.calls[0][0];
      expect(setArg.priority).toBe("high");
      expect(setArg.subject).toBeUndefined();
      expect(setArg.description).toBeUndefined();
      expect(setArg.category).toBeUndefined();
      expect(setArg.updatedAt).toEqual(expect.any(Date));
    });
  });

  // ─── deleteFeedback ──────────────────────────────────────────────────
  describe("deleteFeedback", () => {
    it("admin deletes feedback and its responses in a transaction", async () => {
      // Setup tx mocks
      const txSelectWhere = vi.fn(() => [
        { id: 1, status: "in_progress", userId: 2 },
      ]);
      const txSelectFrom = vi.fn(() => ({ where: txSelectWhere }));
      mockTx.select.mockReturnValue({ from: txSelectFrom });

      const txDeleteWhere = vi.fn();
      const txDeleteReturning = vi.fn(() => [{ id: 1 }]);
      txDeleteWhere.mockReturnValueOnce(undefined); // delete responses
      txDeleteWhere.mockReturnValueOnce({ returning: txDeleteReturning }); // delete feedback
      mockTx.delete.mockReturnValue({ where: txDeleteWhere });

      const result = await service.deleteFeedback(1, 99, true);

      expect(result).toBe(true);
      expect(mockTx.delete).toHaveBeenCalledTimes(2); // responses + feedback
    });

    it("returns false when feedback not found", async () => {
      const txSelectWhere = vi.fn(() => []);
      const txSelectFrom = vi.fn(() => ({ where: txSelectWhere }));
      mockTx.select.mockReturnValue({ from: txSelectFrom });

      const result = await service.deleteFeedback(999, 1, true);

      expect(result).toBe(false);
    });

    it("non-admin cannot delete non-open feedback", async () => {
      const txSelectWhere = vi.fn(() => [
        { id: 1, status: "resolved", userId: 2 },
      ]);
      const txSelectFrom = vi.fn(() => ({ where: txSelectWhere }));
      mockTx.select.mockReturnValue({ from: txSelectFrom });

      const result = await service.deleteFeedback(1, 2, false);

      expect(result).toBe(false);
      expect(mockTx.delete).not.toHaveBeenCalled();
    });

    it("non-admin cannot delete another user's feedback", async () => {
      const txSelectWhere = vi.fn(() => [
        { id: 1, status: "open", userId: 2 },
      ]);
      const txSelectFrom = vi.fn(() => ({ where: txSelectWhere }));
      mockTx.select.mockReturnValue({ from: txSelectFrom });

      const result = await service.deleteFeedback(1, 99, false);

      expect(result).toBe(false);
    });

    it("non-admin can delete own open feedback", async () => {
      const txSelectWhere = vi.fn(() => [
        { id: 1, status: "open", userId: 2 },
      ]);
      const txSelectFrom = vi.fn(() => ({ where: txSelectWhere }));
      mockTx.select.mockReturnValue({ from: txSelectFrom });

      const txDeleteWhere = vi.fn();
      const txDeleteReturning = vi.fn(() => [{ id: 1 }]);
      txDeleteWhere.mockReturnValueOnce(undefined);
      txDeleteWhere.mockReturnValueOnce({ returning: txDeleteReturning });
      mockTx.delete.mockReturnValue({ where: txDeleteWhere });

      const result = await service.deleteFeedback(1, 2, false);

      expect(result).toBe(true);
    });
  });

  // ─── addResponse ─────────────────────────────────────────────────────
  describe("addResponse", () => {
    it("inserts a response and updates feedback updatedAt", async () => {
      const expected = {
        id: 10,
        feedbackId: 1,
        userId: 2,
        message: "Thanks for reporting",
        isInternal: false,
      };

      // update (updatedAt)
      mockDb._where.mockReturnValueOnce(undefined);
      // insert response
      mockDb._returning.mockResolvedValue([expected]);

      const result = await service.addResponse(
        1,
        2,
        "Thanks for reporting",
        false,
      );

      expect(result).toEqual(expected);
      expect(mockDb.update).toHaveBeenCalledOnce();
      expect(mockDb.insert).toHaveBeenCalledOnce();
      expect(mockDb._values).toHaveBeenCalledWith(
        expect.objectContaining({
          feedbackId: 1,
          userId: 2,
          message: "Thanks for reporting",
          isInternal: false,
        }),
      );
    });

    it("supports internal notes", async () => {
      mockDb._where.mockReturnValueOnce(undefined);
      mockDb._returning.mockResolvedValue([
        { id: 11, isInternal: true, message: "Internal note" },
      ]);

      const result = await service.addResponse(1, 1, "Internal note", true);

      expect(result.isInternal).toBe(true);
      expect(mockDb._values).toHaveBeenCalledWith(
        expect.objectContaining({ isInternal: true }),
      );
    });
  });

  // ─── getResponses ────────────────────────────────────────────────────
  describe("getResponses", () => {
    it("returns all responses for admin (including internal)", async () => {
      const rows = [
        {
          feedback_responses: { id: 1, isInternal: false, message: "Public" },
          users: { id: 1, username: "admin" },
        },
        {
          feedback_responses: { id: 2, isInternal: true, message: "Internal" },
          users: { id: 1, username: "admin" },
        },
      ];

      const orderBy = vi.fn(() => rows);
      const whereFn = vi.fn(() => ({ orderBy }));
      const leftJoin = vi.fn(() => ({ where: whereFn }));
      const fromFn = vi.fn(() => ({ leftJoin }));
      mockDb.select.mockReturnValue({ from: fromFn });

      const result = await service.getResponses(1, true);

      expect(result).toHaveLength(2);
      expect(result[0].user).toBeDefined();
      expect(result[1].message).toBe("Internal");
    });

    it("returns empty array when no responses exist", async () => {
      const orderBy = vi.fn(() => []);
      const whereFn = vi.fn(() => ({ orderBy }));
      const leftJoin = vi.fn(() => ({ where: whereFn }));
      const fromFn = vi.fn(() => ({ leftJoin }));
      mockDb.select.mockReturnValue({ from: fromFn });

      const result = await service.getResponses(999, false);

      expect(result).toEqual([]);
    });
  });

  // ─── updateResponse ──────────────────────────────────────────────────
  describe("updateResponse", () => {
    it("admin can update any response", async () => {
      const updated = { id: 10, message: "Edited reply" };
      mockDb._returning.mockResolvedValue([updated]);

      const result = await service.updateResponse(10, 99, "Edited reply", true);

      expect(result).toEqual(updated);
      expect(mockDb.update).toHaveBeenCalledOnce();
      expect(mockDb._set).toHaveBeenCalledWith({ message: "Edited reply" });
    });

    it("non-admin can only update own response", async () => {
      const updated = { id: 10, message: "My edit", userId: 2 };
      mockDb._returning.mockResolvedValue([updated]);

      const result = await service.updateResponse(10, 2, "My edit", false);

      expect(result).toEqual(updated);
      // The where clause should include userId check for non-admin
      expect(mockDb._where).toHaveBeenCalled();
    });

    it("returns null when response not found", async () => {
      mockDb._returning.mockResolvedValue([]);

      const result = await service.updateResponse(999, 1, "Nope", true);

      expect(result).toBeNull();
    });

    it("returns null when non-admin tries to update another user's response", async () => {
      mockDb._returning.mockResolvedValue([]);

      const result = await service.updateResponse(10, 99, "Hack", false);

      expect(result).toBeNull();
    });
  });

  // ─── deleteResponse ──────────────────────────────────────────────────
  describe("deleteResponse", () => {
    it("admin can delete any response", async () => {
      mockDb._returning.mockResolvedValue([{ id: 10 }]);

      const result = await service.deleteResponse(10, 99, true);

      expect(result).toBe(true);
      expect(mockDb.delete).toHaveBeenCalledOnce();
    });

    it("returns false when response not found", async () => {
      mockDb._returning.mockResolvedValue([]);

      const result = await service.deleteResponse(999, 1, true);

      expect(result).toBe(false);
    });

    it("non-admin can delete own response", async () => {
      mockDb._returning.mockResolvedValue([{ id: 10 }]);

      const result = await service.deleteResponse(10, 2, false);

      expect(result).toBe(true);
    });

    it("returns false when non-admin tries to delete another user's response", async () => {
      mockDb._returning.mockResolvedValue([]);

      const result = await service.deleteResponse(10, 99, false);

      expect(result).toBe(false);
    });
  });

  // ─── getFeedbackStats ────────────────────────────────────────────────
  describe("getFeedbackStats", () => {
    it("returns aggregated stats", async () => {
      // total count
      const totalFrom = vi.fn(() => ({
        where: vi.fn(() => [{ total: 10 }]),
      }));
      mockDb.select.mockReturnValueOnce({ from: totalFrom });

      // status stats
      const statusFrom = vi.fn(() => ({
        where: vi.fn(() => ({
          groupBy: vi.fn(() => [
            { status: "open", count: 6 },
            { status: "resolved", count: 4 },
          ]),
        })),
      }));
      mockDb.select.mockReturnValueOnce({ from: statusFrom });

      // category stats
      const categoryFrom = vi.fn(() => ({
        where: vi.fn(() => ({
          groupBy: vi.fn(() => [
            { category: "bug_report", count: 7 },
            { category: "feature_request", count: 3 },
          ]),
        })),
      }));
      mockDb.select.mockReturnValueOnce({ from: categoryFrom });

      // priority stats
      const priorityFrom = vi.fn(() => ({
        where: vi.fn(() => ({
          groupBy: vi.fn(() => [
            { priority: "medium", count: 5 },
            { priority: "high", count: 5 },
          ]),
        })),
      }));
      mockDb.select.mockReturnValueOnce({ from: priorityFrom });

      // avg resolution
      const avgFrom = vi.fn(() => ({
        where: vi.fn(() => [{ avgMs: 86400000 }]),
      }));
      mockDb.select.mockReturnValueOnce({ from: avgFrom });

      const result = await service.getFeedbackStats();

      expect(result.total).toBe(10);
      expect(result.byStatus).toEqual({ open: 6, resolved: 4 });
      expect(result.byCategory).toEqual({
        bug_report: 7,
        feature_request: 3,
      });
      expect(result.byPriority).toEqual({ medium: 5, high: 5 });
      expect(result.avgResolutionTimeMs).toBe(86400000);
    });

    it("returns null avgResolutionTimeMs when no resolved feedback", async () => {
      const totalFrom = vi.fn(() => ({
        where: vi.fn(() => [{ total: 3 }]),
      }));
      mockDb.select.mockReturnValueOnce({ from: totalFrom });

      const statusFrom = vi.fn(() => ({
        where: vi.fn(() => ({
          groupBy: vi.fn(() => [{ status: "open", count: 3 }]),
        })),
      }));
      mockDb.select.mockReturnValueOnce({ from: statusFrom });

      const categoryFrom = vi.fn(() => ({
        where: vi.fn(() => ({
          groupBy: vi.fn(() => [{ category: "bug_report", count: 3 }]),
        })),
      }));
      mockDb.select.mockReturnValueOnce({ from: categoryFrom });

      const priorityFrom = vi.fn(() => ({
        where: vi.fn(() => ({
          groupBy: vi.fn(() => [{ priority: "medium", count: 3 }]),
        })),
      }));
      mockDb.select.mockReturnValueOnce({ from: priorityFrom });

      const avgFrom = vi.fn(() => ({
        where: vi.fn(() => [{ avgMs: null }]),
      }));
      mockDb.select.mockReturnValueOnce({ from: avgFrom });

      const result = await service.getFeedbackStats();

      expect(result.avgResolutionTimeMs).toBeNull();
    });

    it("filters by restaurantId when provided", async () => {
      // We just need to verify it doesn't throw with a restaurantId
      const totalFrom = vi.fn(() => ({
        where: vi.fn(() => [{ total: 2 }]),
      }));
      mockDb.select.mockReturnValueOnce({ from: totalFrom });

      const emptyGroupBy = vi.fn(() => ({
        where: vi.fn(() => ({ groupBy: vi.fn(() => []) })),
      }));
      mockDb.select.mockReturnValueOnce({ from: emptyGroupBy });
      mockDb.select.mockReturnValueOnce({ from: emptyGroupBy });
      mockDb.select.mockReturnValueOnce({ from: emptyGroupBy });

      const avgFrom = vi.fn(() => ({
        where: vi.fn(() => [{ avgMs: null }]),
      }));
      mockDb.select.mockReturnValueOnce({ from: avgFrom });

      const result = await service.getFeedbackStats("rest-1");

      expect(result.total).toBe(2);
    });
  });

  // ─── listFeedback ────────────────────────────────────────────────────
  describe("listFeedback", () => {
    it("returns paginated feedback list with parsed attachments", async () => {
      const rows = [
        {
          shop_feedback: {
            id: 1,
            subject: "Bug",
            attachmentUrls: '["https://example.com/a.png"]',
          },
          users: { id: 1, username: "owner" },
          restaurants: { id: "rest-1", name: "Shop" },
        },
      ];

      // Main query chain
      const offsetFn = vi.fn(() => rows);
      const limitFn = vi.fn(() => ({ offset: offsetFn }));
      const orderByFn = vi.fn(() => ({ limit: limitFn }));
      const whereFn = vi.fn(() => ({ orderBy: orderByFn }));
      const leftJoin2 = vi.fn(() => ({ where: whereFn }));
      const leftJoin1 = vi.fn(() => ({ leftJoin: leftJoin2 }));
      const fromFn = vi.fn(() => ({ leftJoin: leftJoin1 }));
      mockDb.select.mockReturnValueOnce({ from: fromFn });

      // Count query
      const countWhere = vi.fn(() => [{ total: 1 }]);
      const countFrom = vi.fn(() => ({ where: countWhere }));
      mockDb.select.mockReturnValueOnce({ from: countFrom });

      const result = await service.listFeedback({}, 1, 20, false);

      expect(result!.feedback).toHaveLength(1);
      expect(result!.feedback[0].attachmentUrls).toEqual([
        "https://example.com/a.png",
      ]);
      expect(result!.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it("returns empty attachmentUrls when null", async () => {
      const rows = [
        {
          shop_feedback: { id: 1, attachmentUrls: null },
          users: { id: 1 },
          restaurants: { id: "rest-1" },
        },
      ];

      const offsetFn = vi.fn(() => rows);
      const limitFn = vi.fn(() => ({ offset: offsetFn }));
      const orderByFn = vi.fn(() => ({ limit: limitFn }));
      const whereFn = vi.fn(() => ({ orderBy: orderByFn }));
      const leftJoin2 = vi.fn(() => ({ where: whereFn }));
      const leftJoin1 = vi.fn(() => ({ leftJoin: leftJoin2 }));
      const fromFn = vi.fn(() => ({ leftJoin: leftJoin1 }));
      mockDb.select.mockReturnValueOnce({ from: fromFn });

      const countWhere = vi.fn(() => [{ total: 1 }]);
      const countFrom = vi.fn(() => ({ where: countWhere }));
      mockDb.select.mockReturnValueOnce({ from: countFrom });

      const result = await service.listFeedback({}, 1, 20);

      expect(result!.feedback[0].attachmentUrls).toEqual([]);
    });

    it("calculates totalPages correctly", async () => {
      const offsetFn = vi.fn(() => []);
      const limitFn = vi.fn(() => ({ offset: offsetFn }));
      const orderByFn = vi.fn(() => ({ limit: limitFn }));
      const whereFn = vi.fn(() => ({ orderBy: orderByFn }));
      const leftJoin2 = vi.fn(() => ({ where: whereFn }));
      const leftJoin1 = vi.fn(() => ({ leftJoin: leftJoin2 }));
      const fromFn = vi.fn(() => ({ leftJoin: leftJoin1 }));
      mockDb.select.mockReturnValueOnce({ from: fromFn });

      const countWhere = vi.fn(() => [{ total: 45 }]);
      const countFrom = vi.fn(() => ({ where: countWhere }));
      mockDb.select.mockReturnValueOnce({ from: countFrom });

      const result = await service.listFeedback({}, 1, 20);

      expect(result!.pagination.totalPages).toBe(3); // ceil(45/20) = 3
    });
  });
});
