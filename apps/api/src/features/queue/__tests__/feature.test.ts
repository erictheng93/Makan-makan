/**
 * Queue Feature Tests
 *
 * Verifies the queue routes correctly delegate to WaitingListService
 * (the production backing service). Each test mocks the service at the
 * @makanmakan/database boundary so route behaviour is exercised against
 * deterministic fakes without touching D1.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { ApiError } from "../../../shared/utils/api-error";
import { ErrorSanitizer } from "../../../utils/errorSanitizer";

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: any;
  message?: string;
}

const mockService = {
  joinWaitingList: vi.fn(),
  getQueueStatus: vi.fn(),
  getWaitingListEntryById: vi.fn(),
  listWaitingList: vi.fn(),
  callWaiting: vi.fn(),
  findAvailableTable: vi.fn(),
  batchCallNext: vi.fn(),
  markSeated: vi.fn(),
  cancelWaiting: vi.fn(),
};

vi.mock("@makanmakan/database", () => ({
  WaitingListService: vi.fn(function (this: any) {
    Object.assign(this, mockService);
  }),
}));

let mockUserRole = 0;
let mockUserRestaurantId: string | number = "1";

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set("user", {
      id: 1,
      username: "tester",
      role: mockUserRole,
      restaurantId: mockUserRestaurantId,
    });
    await next();
  }),
  optionalAuth: vi.fn(async (_c: any, next: any) => next()),
}));

const mockEnv = {
  DB: {},
  CACHE_KV: {},
  NODE_ENV: "test",
  API_BASE_URL: "", // suppress SSE broadcast network calls in tests
};

const sampleEntry = {
  id: "entry-uuid-1",
  restaurantId: "1",
  customerName: "John Doe",
  customerPhone: "0912345678",
  partySize: 4,
  queueNumber: 5,
  queueLetter: "A",
  queueDisplay: "A005",
  priority: 0,
  estimatedWaitMinutes: 30,
  status: "waiting" as const,
  partiesAhead: 2,
  notes: undefined,
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
};

describe("Queue routes (real WaitingListService delegation)", () => {
  let app: Hono<{ Bindings: typeof mockEnv }>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockUserRole = 0;
    mockUserRestaurantId = "1";

    const { default: queueRoutes } = await import("../routes/index");
    app = new Hono<{ Bindings: typeof mockEnv }>();
    app.route("/queue", queueRoutes);

    app.onError((err, c) => {
      if (err instanceof ApiError) {
        return c.json(
          {
            success: false,
            error: { code: err.code, message: err.message },
          },
          err.status as never,
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
        (STATUS_MAP[sanitized.type] ?? 500) as never,
      );
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const request = (path: string, options: RequestInit = {}) =>
    app.fetch(new Request(`http://localhost${path}`, options), mockEnv);

  describe("POST /join", () => {
    it("persists the entry via WaitingListService and returns the join shape", async () => {
      mockService.joinWaitingList.mockResolvedValue(sampleEntry);

      const res = await request("/queue/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: "1",
          customerName: "John Doe",
          customerPhone: "0912345678",
          partySize: 4,
          specialRequests: "Window seat",
        }),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiResponse;
      expect(json.success).toBe(true);
      expect(json.data).toMatchObject({
        queueId: "entry-uuid-1",
        queueNumber: 5,
        queueDisplay: "A005",
        currentPosition: 3, // partiesAhead (2) + 1
        estimatedWaitMinutes: 30,
        customerName: "John Doe",
      });

      expect(mockService.joinWaitingList).toHaveBeenCalledOnce();
      expect(mockService.joinWaitingList).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId: "1",
          customerName: "John Doe",
          customerPhone: "0912345678",
          partySize: 4,
          notes: "Window seat",
        }),
      );
    });

    it("accepts snake_case request fields for compatibility", async () => {
      mockService.joinWaitingList.mockResolvedValue(sampleEntry);

      await request("/queue/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: "1",
          customer_name: "Jane Doe",
          customer_phone: "0987654321",
          party_size: 2,
        }),
      });

      expect(mockService.joinWaitingList).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId: "1",
          customerName: "Jane Doe",
          customerPhone: "0987654321",
          partySize: 2,
        }),
      );
    });

    it("rejects requests missing the required identification fields", async () => {
      const res = await request("/queue/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId: "1" }),
      });

      expect(res.status).toBe(400);
      expect(mockService.joinWaitingList).not.toHaveBeenCalled();
    });

    it("propagates service-side errors with a 400", async () => {
      mockService.joinWaitingList.mockRejectedValue(
        new Error("您已在候位列表中"),
      );

      const res = await request("/queue/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: "1",
          customerName: "John Doe",
          customerPhone: "0912345678",
          partySize: 2,
        }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /:restaurantId/status", () => {
    it("returns the queue status from WaitingListService", async () => {
      mockService.getQueueStatus.mockResolvedValue({
        restaurantId: "1",
        totalWaiting: 7,
        averageWaitMinutes: 25,
        availableTables: 3,
        byTableType: [],
      });

      const res = await request("/queue/1/status");

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiResponse;
      expect(json.success).toBe(true);
      expect(json.data).toMatchObject({
        totalWaiting: 7,
        averageWaitMinutes: 25,
        availableTables: 3,
      });
      expect(mockService.getQueueStatus).toHaveBeenCalledWith("1");
    });
  });

  describe("GET /:restaurantId/current", () => {
    it("returns the current waiting entries for staff", async () => {
      mockService.listWaitingList.mockResolvedValue({
        data: [sampleEntry],
        total: 1,
      });

      const res = await request("/queue/1/current", {
        headers: { Authorization: "Bearer test" },
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiResponse;
      expect(json.data.queue).toHaveLength(1);
      expect(json.data.total).toBe(1);
      expect(mockService.listWaitingList).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId: "1",
          status: "waiting",
        }),
      );
    });

    it("blocks staff viewing another restaurant's queue", async () => {
      mockUserRole = 1;
      mockUserRestaurantId = "9";

      const res = await request("/queue/1/current", {
        headers: { Authorization: "Bearer test" },
      });

      expect(res.status).toBe(403);
      expect(mockService.listWaitingList).not.toHaveBeenCalled();
    });

    it("allows restaurant access when token restaurantId is numeric", async () => {
      mockUserRole = 1;
      mockUserRestaurantId = 1;
      mockService.listWaitingList.mockResolvedValue({
        data: [sampleEntry],
        total: 1,
      });

      const res = await request("/queue/1/current", {
        headers: { Authorization: "Bearer test" },
      });

      expect(res.status).toBe(200);
      expect(mockService.listWaitingList).toHaveBeenCalledOnce();
    });
  });

  describe("GET /:queueId/position", () => {
    it("returns position info for the customer", async () => {
      mockService.getWaitingListEntryById.mockResolvedValue(sampleEntry);

      const res = await request("/queue/entry-uuid-1/position");

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiResponse;
      expect(json.data).toMatchObject({
        queueId: "entry-uuid-1",
        currentPosition: 3,
        partiesAhead: 2,
        canCancel: true,
      });
    });

    it("returns 400 when the entry does not exist", async () => {
      mockService.getWaitingListEntryById.mockResolvedValue(null);

      const res = await request("/queue/missing/position");
      expect(res.status).toBe(400);
    });
  });

  describe("POST /:restaurantId/call-next", () => {
    it("auto-calls the next waiting entry via batchCallNext", async () => {
      mockService.batchCallNext.mockResolvedValue([
        { id: "entry-uuid-1", success: true, tableId: 5, message: "已叫號" },
      ]);
      mockService.getWaitingListEntryById.mockResolvedValue({
        ...sampleEntry,
        status: "called",
        tableId: 5,
        calledAt: 1700000100000,
      });

      const res = await request("/queue/1/call-next", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test",
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiResponse;
      expect(json.data).toMatchObject({
        queueId: "entry-uuid-1",
        tableId: 5,
        status: "called",
      });
      expect(mockService.batchCallNext).toHaveBeenCalledWith("1", 1);
      expect(mockService.callWaiting).not.toHaveBeenCalled();
    });

    it("calls a specific entry when specificQueueId + tableId are provided", async () => {
      mockService.getWaitingListEntryById.mockResolvedValue(sampleEntry);
      mockService.callWaiting.mockResolvedValue({
        ...sampleEntry,
        status: "called",
        tableId: 7,
      });

      const res = await request("/queue/1/call-next", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test",
        },
        body: JSON.stringify({
          specificQueueId: "entry-uuid-1",
          tableId: 7,
        }),
      });

      expect(res.status).toBe(200);
      expect(mockService.callWaiting).toHaveBeenCalledWith("entry-uuid-1", {
        tableId: 7,
      });
      expect(mockService.batchCallNext).not.toHaveBeenCalled();
    });

    it("auto-assigns a table when a specific entry is called without tableId", async () => {
      mockService.getWaitingListEntryById.mockResolvedValue(sampleEntry);
      mockService.findAvailableTable.mockResolvedValue({
        tableId: 7,
        tableNumber: "T7",
        confidence: 1,
        reason: "best fit",
      });
      mockService.callWaiting.mockResolvedValue({
        ...sampleEntry,
        status: "called",
        tableId: 7,
      });

      const res = await request("/queue/1/call-next", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test",
        },
        body: JSON.stringify({
          specificQueueId: "entry-uuid-1",
        }),
      });

      expect(res.status).toBe(200);
      expect(mockService.findAvailableTable).toHaveBeenCalledWith("1", 4);
      expect(mockService.callWaiting).toHaveBeenCalledWith("entry-uuid-1", {
        tableId: 7,
      });
      expect(mockService.batchCallNext).not.toHaveBeenCalled();
    });

    it("rejects specific entries from another restaurant", async () => {
      mockService.getWaitingListEntryById.mockResolvedValue({
        ...sampleEntry,
        restaurantId: "9",
      });

      const res = await request("/queue/1/call-next", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test",
        },
        body: JSON.stringify({
          specificQueueId: "entry-uuid-1",
          tableId: 7,
        }),
      });

      expect(res.status).toBe(400);
      expect(mockService.callWaiting).not.toHaveBeenCalled();
      expect(mockService.batchCallNext).not.toHaveBeenCalled();
    });

    it("returns 400 when no customers are waiting", async () => {
      mockService.batchCallNext.mockResolvedValue([]);

      const res = await request("/queue/1/call-next", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test",
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    it("blocks staff calling for another restaurant", async () => {
      mockUserRole = 1;
      mockUserRestaurantId = "9";

      const res = await request("/queue/1/call-next", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test",
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(403);
    });

    it("allows staff calling when token restaurantId is numeric", async () => {
      mockUserRole = 1;
      mockUserRestaurantId = 1;
      mockService.batchCallNext.mockResolvedValue([
        { id: "entry-uuid-1", success: true, tableId: 5, message: "已叫號" },
      ]);
      mockService.getWaitingListEntryById.mockResolvedValue({
        ...sampleEntry,
        status: "called",
        tableId: 5,
        calledAt: 1700000100000,
      });

      const res = await request("/queue/1/call-next", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test",
        },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      expect(mockService.batchCallNext).toHaveBeenCalledWith("1", 1);
    });
  });

  describe("POST /:queueId/seat", () => {
    it("delegates to markSeated and returns success", async () => {
      mockService.markSeated.mockResolvedValue({
        ...sampleEntry,
        status: "seated",
      });

      const res = await request("/queue/entry-uuid-1/seat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test",
        },
        body: JSON.stringify({ tableId: 5 }),
      });

      expect(res.status).toBe(200);
      expect(mockService.markSeated).toHaveBeenCalledWith("entry-uuid-1");
    });

    it("surfaces service errors as 400", async () => {
      mockService.markSeated.mockRejectedValue(new Error("候位記錄不存在"));

      const res = await request("/queue/missing/seat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test",
        },
        body: JSON.stringify({ tableId: 5 }),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("POST /:queueId/cancel", () => {
    it("delegates to cancelWaiting", async () => {
      mockService.cancelWaiting.mockResolvedValue({
        ...sampleEntry,
        status: "cancelled",
      });

      const res = await request("/queue/entry-uuid-1/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      expect(mockService.cancelWaiting).toHaveBeenCalledWith("entry-uuid-1");
    });
  });

  describe("GET /health", () => {
    it("reports the WaitingListService backend", async () => {
      const res = await request("/queue/health");
      expect(res.status).toBe(200);
      const json = (await res.json()) as ApiResponse;
      expect(json.data.status).toBe("healthy");
      expect(json.data.backend).toBe("WaitingListService");
    });
  });
});
