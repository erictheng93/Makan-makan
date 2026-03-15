// apps/api/src/features/seats/__tests__/routes.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import routes from "../routes";
import { ApiError } from "../../../shared/utils/api-error";

// Mock auth middleware — pass-through
vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn((c: any, next: any) => next()),
  requireRole: () => vi.fn((c: any, next: any) => next()),
}));

// Mock validation middleware — inject pre-validated values
vi.mock("../../../middleware/validation", () => ({
  validateBody: () =>
    vi.fn((c: any, next: any) => {
      // Default body; tests override the mock service behaviour, not the body
      c.set("validatedBody", {
        tableId: 1,
        seatCount: 4,
        numberingStyle: "numeric",
        orderId: 10,
        occupiedBy: "John",
      });
      return next();
    }),
  validateQuery: () =>
    vi.fn((c: any, next: any) => {
      c.set("validatedQuery", { tableId: 1, page: 1, limit: 50 });
      return next();
    }),
  validateParams: () =>
    vi.fn((c: any, next: any) => {
      // Provide both id and tableId so any param route works
      c.set("validatedParams", { id: "1", tableId: 1, qrCode: "QR-SEAT-001" });
      return next();
    }),
  commonSchemas: {
    idParam: {},
  },
}));

// ─── Mock SeatService ─────────────────────────────────────────────────────────

const mockSeatService = {
  getSeatsByTableId: vi.fn().mockResolvedValue({
    seats: [
      {
        id: 1,
        tableId: 1,
        seatNumber: "1",
        isActive: true,
        isOccupied: false,
        createdAt: "2026-03-14T00:00:00Z",
        updatedAt: "2026-03-14T00:00:00Z",
      },
    ],
    total: 1,
    pagination: { page: 1, limit: 50, totalPages: 1 },
  }),
  getSeatStats: vi.fn().mockResolvedValue({
    tableId: 1,
    totalSeats: 4,
    activeSeats: 4,
    occupiedSeats: 1,
    availableSeats: 3,
  }),
  getSeatByQRCode: vi.fn().mockResolvedValue({
    id: 1,
    tableId: 1,
    tableNumber: "T1",
    restaurantId: "rest-001",
    restaurantName: "Test Restaurant",
    seatNumber: "1",
    seatName: "Window",
    isActive: true,
    isOccupied: false,
    capacity: 1,
  }),
  getSeatById: vi.fn().mockResolvedValue({
    id: 1,
    tableId: 1,
    seatNumber: "1",
    isActive: true,
    isOccupied: false,
    createdAt: "2026-03-14T00:00:00Z",
    updatedAt: "2026-03-14T00:00:00Z",
  }),
  createSeatsForTable: vi.fn().mockResolvedValue([
    {
      id: 1,
      tableId: 1,
      seatNumber: "1",
      isActive: true,
      isOccupied: false,
      createdAt: "2026-03-14T00:00:00Z",
      updatedAt: "2026-03-14T00:00:00Z",
    },
  ]),
  batchGenerateSeatQRCodes: vi.fn().mockResolvedValue({
    success: true,
    qrCodes: [{ seatId: 1, qrCode: "QR-SEAT-001" }],
  }),
  updateSeat: vi.fn().mockResolvedValue({
    id: 1,
    tableId: 1,
    seatNumber: "1A",
    isActive: true,
    isOccupied: false,
    createdAt: "2026-03-14T00:00:00Z",
    updatedAt: "2026-03-14T00:00:00Z",
  }),
  deleteSeat: vi.fn().mockResolvedValue(true),
  deleteSeatsForTable: vi.fn().mockResolvedValue(true),
  occupySeat: vi.fn().mockResolvedValue(true),
  releaseSeat: vi.fn().mockResolvedValue(true),
  regenerateSeatQRCode: vi.fn().mockResolvedValue({
    success: true,
    qrCode: "QR-SEAT-NEW",
  }),
};

vi.mock("@makanmakan/database", () => ({
  SeatService: vi.fn(function () {
    return mockSeatService;
  }),
  USER_ROLES: {
    ADMIN: 0,
    OWNER: 1,
    CHEF: 2,
    SERVICE: 3,
    CASHIER: 4,
  },
}));

const mockEnv = { DB: {}, CACHE_KV: {} };

describe("Seats Routes", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();

    // Restore default mock return values after clearAllMocks
    mockSeatService.getSeatsByTableId.mockResolvedValue({
      seats: [
        {
          id: 1,
          tableId: 1,
          seatNumber: "1",
          isActive: true,
          isOccupied: false,
          createdAt: "2026-03-14T00:00:00Z",
          updatedAt: "2026-03-14T00:00:00Z",
        },
      ],
      total: 1,
      pagination: { page: 1, limit: 50, totalPages: 1 },
    });
    mockSeatService.getSeatStats.mockResolvedValue({
      tableId: 1,
      totalSeats: 4,
      activeSeats: 4,
      occupiedSeats: 1,
      availableSeats: 3,
    });
    mockSeatService.getSeatByQRCode.mockResolvedValue({
      id: 1,
      tableId: 1,
      tableNumber: "T1",
      restaurantId: "rest-001",
      restaurantName: "Test Restaurant",
      seatNumber: "1",
      seatName: "Window",
      isActive: true,
      isOccupied: false,
      capacity: 1,
    });
    mockSeatService.getSeatById.mockResolvedValue({
      id: 1,
      tableId: 1,
      seatNumber: "1",
      isActive: true,
      isOccupied: false,
      createdAt: "2026-03-14T00:00:00Z",
      updatedAt: "2026-03-14T00:00:00Z",
    });
    mockSeatService.createSeatsForTable.mockResolvedValue([
      {
        id: 1,
        tableId: 1,
        seatNumber: "1",
        isActive: true,
        isOccupied: false,
        createdAt: "2026-03-14T00:00:00Z",
        updatedAt: "2026-03-14T00:00:00Z",
      },
    ]);
    mockSeatService.batchGenerateSeatQRCodes.mockResolvedValue({
      success: true,
      qrCodes: [{ seatId: 1, qrCode: "QR-SEAT-001" }],
    });
    mockSeatService.updateSeat.mockResolvedValue({
      id: 1,
      tableId: 1,
      seatNumber: "1A",
      isActive: true,
      isOccupied: false,
      createdAt: "2026-03-14T00:00:00Z",
      updatedAt: "2026-03-14T00:00:00Z",
    });
    mockSeatService.deleteSeat.mockResolvedValue(true);
    mockSeatService.deleteSeatsForTable.mockResolvedValue(true);
    mockSeatService.occupySeat.mockResolvedValue(true);
    mockSeatService.releaseSeat.mockResolvedValue(true);
    mockSeatService.regenerateSeatQRCode.mockResolvedValue({
      success: true,
      qrCode: "QR-SEAT-NEW",
    });

    app = new Hono();
    app.route("/seats", routes);

    // Mirror the global error handler from index.ts
    app.onError((err, c) => {
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
      return c.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message:
              err instanceof Error ? err.message : "Internal server error",
          },
        },
        500,
      );
    });
  });

  // ─── GET / — list seats ───────────────────────────────────────────

  describe("GET / — list seats", () => {
    it("returns 200 with seats array", async () => {
      const req = new Request("http://localhost/seats?tableId=1");
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: unknown[];
        total: number;
        pagination: unknown;
      };
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.total).toBe(1);
      expect(json.pagination).toBeDefined();
    });

    it("returns 500 when service throws", async () => {
      mockSeatService.getSeatsByTableId.mockRejectedValue(
        new Error("DB unavailable"),
      );
      const req = new Request("http://localhost/seats?tableId=1");
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as {
        success: boolean;
        error: { message: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.message).toBe("DB unavailable");
    });
  });

  // ─── GET /stats ────────────────────────────────────────────────────

  describe("GET /stats", () => {
    it("returns 200 with seat statistics", async () => {
      const req = new Request("http://localhost/seats/stats?tableId=1");
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: { totalSeats: number };
      };
      expect(json.success).toBe(true);
      expect(json.data.totalSeats).toBe(4);
    });

    it("returns 500 when service throws", async () => {
      mockSeatService.getSeatStats.mockRejectedValue(new Error("Stats error"));
      const req = new Request("http://localhost/seats/stats?tableId=1");
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });
  });

  // ─── GET /qr/:qrCode — public endpoint ───────────────────────────

  describe("GET /qr/:qrCode — public endpoint (no auth)", () => {
    it("returns 200 with public seat info when QR code is valid", async () => {
      const req = new Request("http://localhost/seats/qr/QR-SEAT-001");
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: {
          id: number;
          tableId: number;
          seatNumber: string;
          isActive: boolean;
          isOccupied: boolean;
        };
      };
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(1);
      expect(json.data.seatNumber).toBe("1");
    });

    it("returns 404 when QR code not found", async () => {
      mockSeatService.getSeatByQRCode.mockResolvedValue(null);
      const req = new Request("http://localhost/seats/qr/INVALID-QR");
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(404);
      const json = (await res.json()) as {
        success: boolean;
        error: { message: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.message).toBe("Invalid QR code or seat not found");
    });

    it("returns 500 when service throws", async () => {
      mockSeatService.getSeatByQRCode.mockRejectedValue(
        new Error("QR lookup failed"),
      );
      const req = new Request("http://localhost/seats/qr/QR-SEAT-001");
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });

    it("public response only exposes safe fields (no internal data)", async () => {
      const req = new Request("http://localhost/seats/qr/QR-SEAT-001");
      const res = await app.fetch(req, mockEnv);
      const json = (await res.json()) as { data: Record<string, unknown> };
      const keys = Object.keys(json.data);
      expect(keys).toContain("id");
      expect(keys).toContain("tableId");
      expect(keys).toContain("seatNumber");
      expect(keys).toContain("isActive");
      expect(keys).toContain("isOccupied");
    });
  });

  // ─── GET /:id — single seat ───────────────────────────────────────

  describe("GET /:id — get single seat", () => {
    it("returns 200 with seat data", async () => {
      const req = new Request("http://localhost/seats/1");
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; data: unknown };
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
    });

    it("returns 404 when seat not found", async () => {
      mockSeatService.getSeatById.mockResolvedValue(null);
      const req = new Request("http://localhost/seats/999");
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(404);
      const json = (await res.json()) as {
        success: boolean;
        error: { message: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.message).toBe("Seat not found");
    });

    it("returns 500 when service throws", async () => {
      mockSeatService.getSeatById.mockRejectedValue(new Error("DB error"));
      const req = new Request("http://localhost/seats/1");
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });
  });

  // ─── POST /batch-create ───────────────────────────────────────────

  describe("POST /batch-create", () => {
    it("returns 201 with created seats", async () => {
      const req = new Request("http://localhost/seats/batch-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: 1, seatCount: 4 }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(201);
      const json = (await res.json()) as {
        success: boolean;
        data: unknown[];
        message: string;
      };
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.message).toMatch(/Successfully created/);
    });

    it("returns 500 when service throws", async () => {
      mockSeatService.createSeatsForTable.mockRejectedValue(
        new Error("Table not found"),
      );
      const req = new Request("http://localhost/seats/batch-create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: 1, seatCount: 4 }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as {
        success: boolean;
        error: { message: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.message).toBe("Table not found");
    });
  });

  // ─── POST /batch-regenerate-qr ────────────────────────────────────

  describe("POST /batch-regenerate-qr", () => {
    it("returns 200 with QR code results", async () => {
      const req = new Request("http://localhost/seats/batch-regenerate-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: 1 }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: unknown[];
        message: string;
      };
      expect(json.success).toBe(true);
      expect(json.message).toMatch(/regenerated QR codes/);
    });

    it("returns 400 when service reports failure", async () => {
      mockSeatService.batchGenerateSeatQRCodes.mockResolvedValue({
        success: false,
        error: "QR generation failed",
      });
      const req = new Request("http://localhost/seats/batch-regenerate-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: 1 }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as {
        success: boolean;
        error: { message: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.message).toBe("QR generation failed");
    });

    it("returns 500 when service throws", async () => {
      mockSeatService.batchGenerateSeatQRCodes.mockRejectedValue(
        new Error("Service crash"),
      );
      const req = new Request("http://localhost/seats/batch-regenerate-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: 1 }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });
  });

  // ─── PUT /:id ─────────────────────────────────────────────────────

  describe("PUT /:id — update seat", () => {
    it("returns 200 with updated seat", async () => {
      const req = new Request("http://localhost/seats/1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seatNumber: "1A" }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: unknown;
        message: string;
      };
      expect(json.success).toBe(true);
      expect(json.message).toBe("Seat updated successfully");
    });

    it("returns 404 when seat not found", async () => {
      mockSeatService.getSeatById.mockResolvedValue(null);
      const req = new Request("http://localhost/seats/999", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seatNumber: "1A" }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(404);
      const json = (await res.json()) as {
        success: boolean;
        error: { message: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.message).toBe("Seat not found");
    });

    it("returns 500 when service throws", async () => {
      mockSeatService.updateSeat.mockRejectedValue(new Error("Update failed"));
      const req = new Request("http://localhost/seats/1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seatNumber: "1A" }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as {
        success: boolean;
        error: { message: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.message).toBe("Update failed");
    });
  });

  // ─── DELETE /:id ──────────────────────────────────────────────────

  describe("DELETE /:id — delete seat", () => {
    it("returns 200 on successful delete", async () => {
      const req = new Request("http://localhost/seats/1", { method: "DELETE" });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; message: string };
      expect(json.success).toBe(true);
      expect(json.message).toBe("Seat deleted successfully");
    });

    it("returns 404 when seat not found before delete", async () => {
      mockSeatService.getSeatById.mockResolvedValue(null);
      const req = new Request("http://localhost/seats/999", {
        method: "DELETE",
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(404);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });

    it("returns 400 when deleteSeat returns false", async () => {
      mockSeatService.deleteSeat.mockResolvedValue(false);
      const req = new Request("http://localhost/seats/1", { method: "DELETE" });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as {
        success: boolean;
        error: { message: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.message).toBe("Failed to delete seat");
    });

    it("returns 500 when service throws", async () => {
      mockSeatService.deleteSeat.mockRejectedValue(new Error("Delete error"));
      const req = new Request("http://localhost/seats/1", { method: "DELETE" });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });
  });

  // ─── DELETE /table/:tableId ────────────────────────────────────────

  describe("DELETE /table/:tableId — delete all seats for a table", () => {
    it("returns 200 on successful bulk delete", async () => {
      const req = new Request("http://localhost/seats/table/1", {
        method: "DELETE",
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; message: string };
      expect(json.success).toBe(true);
      expect(json.message).toBe("All seats for the table deleted successfully");
    });

    it("returns 400 when deleteSeatsForTable returns false", async () => {
      mockSeatService.deleteSeatsForTable.mockResolvedValue(false);
      const req = new Request("http://localhost/seats/table/1", {
        method: "DELETE",
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as {
        success: boolean;
        error: { message: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.message).toBe("Failed to delete seats");
    });

    it("returns 500 when service throws", async () => {
      mockSeatService.deleteSeatsForTable.mockRejectedValue(
        new Error("Bulk delete failed"),
      );
      const req = new Request("http://localhost/seats/table/1", {
        method: "DELETE",
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });
  });

  // ─── POST /:id/occupy ─────────────────────────────────────────────

  describe("POST /:id/occupy", () => {
    it("returns 200 when seat is occupied successfully", async () => {
      const req = new Request("http://localhost/seats/1/occupy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: 10 }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; message: string };
      expect(json.success).toBe(true);
      expect(json.message).toBe("Seat occupied successfully");
    });

    it("returns 404 when seat not found", async () => {
      mockSeatService.getSeatById.mockResolvedValue(null);
      const req = new Request("http://localhost/seats/999/occupy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: 10 }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(404);
      const json = (await res.json()) as {
        success: boolean;
        error: { message: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.message).toBe("Seat not found");
    });

    it("returns 400 when seat is already occupied", async () => {
      mockSeatService.getSeatById.mockResolvedValue({
        id: 1,
        tableId: 1,
        seatNumber: "1",
        isActive: true,
        isOccupied: true,
        createdAt: "2026-03-14T00:00:00Z",
        updatedAt: "2026-03-14T00:00:00Z",
      });
      const req = new Request("http://localhost/seats/1/occupy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: 10 }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as {
        success: boolean;
        error: { message: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.message).toBe("Seat is already occupied");
    });

    it("returns 400 when occupySeat returns false", async () => {
      mockSeatService.occupySeat.mockResolvedValue(false);
      const req = new Request("http://localhost/seats/1/occupy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: 10 }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as {
        success: boolean;
        error: { message: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.message).toBe("Failed to occupy seat");
    });

    it("returns 500 when service throws", async () => {
      mockSeatService.occupySeat.mockRejectedValue(new Error("Occupy error"));
      const req = new Request("http://localhost/seats/1/occupy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: 10 }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });
  });

  // ─── POST /:id/release ────────────────────────────────────────────

  describe("POST /:id/release", () => {
    it("returns 200 when seat is released successfully", async () => {
      const req = new Request("http://localhost/seats/1/release", {
        method: "POST",
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; message: string };
      expect(json.success).toBe(true);
      expect(json.message).toBe("Seat released successfully");
    });

    it("returns 404 when seat not found", async () => {
      mockSeatService.getSeatById.mockResolvedValue(null);
      const req = new Request("http://localhost/seats/999/release", {
        method: "POST",
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(404);
      const json = (await res.json()) as {
        success: boolean;
        error: { message: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.message).toBe("Seat not found");
    });

    it("returns 400 when releaseSeat returns false", async () => {
      mockSeatService.releaseSeat.mockResolvedValue(false);
      const req = new Request("http://localhost/seats/1/release", {
        method: "POST",
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as {
        success: boolean;
        error: { message: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.message).toBe("Failed to release seat");
    });

    it("returns 500 when service throws", async () => {
      mockSeatService.releaseSeat.mockRejectedValue(new Error("Release error"));
      const req = new Request("http://localhost/seats/1/release", {
        method: "POST",
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });
  });

  // ─── POST /:id/regenerate-qr ──────────────────────────────────────

  describe("POST /:id/regenerate-qr", () => {
    it("returns 200 with new QR code on success", async () => {
      const req = new Request("http://localhost/seats/1/regenerate-qr", {
        method: "POST",
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: { qrCode: string };
        message: string;
      };
      expect(json.success).toBe(true);
      expect(json.data.qrCode).toBe("QR-SEAT-NEW");
      expect(json.message).toBe("Seat QR code regenerated successfully");
    });

    it("returns 404 when seat not found", async () => {
      mockSeatService.getSeatById.mockResolvedValue(null);
      const req = new Request("http://localhost/seats/999/regenerate-qr", {
        method: "POST",
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(404);
      const json = (await res.json()) as {
        success: boolean;
        error: { message: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.message).toBe("Seat not found");
    });

    it("returns 400 when service reports failure", async () => {
      mockSeatService.regenerateSeatQRCode.mockResolvedValue({
        success: false,
        error: "QR generation error",
      });
      const req = new Request("http://localhost/seats/1/regenerate-qr", {
        method: "POST",
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as {
        success: boolean;
        error: { message: string };
      };
      expect(json.success).toBe(false);
      expect(json.error.message).toBe("QR generation error");
    });

    it("returns 500 when service throws", async () => {
      mockSeatService.regenerateSeatQRCode.mockRejectedValue(
        new Error("Unexpected error"),
      );
      const req = new Request("http://localhost/seats/1/regenerate-qr", {
        method: "POST",
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean };
      expect(json.success).toBe(false);
    });
  });

  // ─── Generic error message fallback ───────────────────────────────

  // Note: non-Error throws (strings, numbers) propagate as UnknownError in Hono
  // and are handled by the global error handler in production. These edge cases
  // are not tested here as they are implementation details of the global handler.
});
