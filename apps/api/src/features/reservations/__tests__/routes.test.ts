import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import routes from "../routes";

// Default mock user (admin role 0 to bypass all permission checks)
const mockUser = {
  id: "user-001",
  role: 0,
  restaurantId: "restaurant-001",
  email: "admin@test.com",
};

// Mock auth middleware to pass through
vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn((c: any, next: any) => {
    c.set("user", mockUser);
    return next();
  }),
  requireRole: () =>
    vi.fn((c: any, next: any) => {
      c.set("user", mockUser);
      return next();
    }),
}));

// Mock ReservationService from @makanmakan/database
const mockServiceInstance = {
  createReservation: vi.fn(),
  getReservationByCode: vi.fn(),
  getAvailableSlots: vi.fn(),
  getReservationById: vi.fn(),
  cancelReservation: vi.fn(),
  listReservations: vi.fn(),
  updateReservation: vi.fn(),
  confirmReservation: vi.fn(),
  markArrived: vi.fn(),
  markSeated: vi.fn(),
  completeReservation: vi.fn(),
  markNoShow: vi.fn(),
  getReservationStats: vi.fn(),
  createSlot: vi.fn(),
  batchCreateSlots: vi.fn(),
};

vi.mock("@makanmakan/database", () => ({
  ReservationService: vi.fn(function () {
    return mockServiceInstance;
  }),
}));

const mockEnv = { DB: {}, CACHE_KV: {} };

// Shared mock data
const mockReservation = {
  id: "res-001",
  restaurantId: "restaurant-001",
  customerName: "John Doe",
  customerPhone: "+60123456789",
  partySize: 4,
  reservationDate: "2026-03-20",
  reservationTime: "19:00",
  durationMinutes: 90,
  status: "pending",
  confirmationCode: "CONF123",
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
};

describe("Reservations Routes", () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset default mock implementations
    mockServiceInstance.createReservation.mockResolvedValue(mockReservation);
    mockServiceInstance.getReservationByCode.mockResolvedValue(mockReservation);
    mockServiceInstance.getAvailableSlots.mockResolvedValue({
      date: "2026-03-20",
      partySize: 4,
      slots: [],
    });
    mockServiceInstance.getReservationById.mockResolvedValue(mockReservation);
    mockServiceInstance.cancelReservation.mockResolvedValue({
      ...mockReservation,
      status: "cancelled",
    });
    mockServiceInstance.listReservations.mockResolvedValue({
      data: [mockReservation],
      total: 1,
    });
    mockServiceInstance.updateReservation.mockResolvedValue({
      ...mockReservation,
      customerName: "Jane Doe",
    });
    mockServiceInstance.confirmReservation.mockResolvedValue({
      ...mockReservation,
      status: "confirmed",
    });
    mockServiceInstance.markArrived.mockResolvedValue({
      ...mockReservation,
      status: "arrived",
    });
    mockServiceInstance.markSeated.mockResolvedValue({
      ...mockReservation,
      status: "seated",
    });
    mockServiceInstance.completeReservation.mockResolvedValue({
      ...mockReservation,
      status: "completed",
    });
    mockServiceInstance.markNoShow.mockResolvedValue({
      ...mockReservation,
      status: "no_show",
    });
    mockServiceInstance.getReservationStats.mockResolvedValue({
      restaurantId: "restaurant-001",
      totalReservations: 10,
      confirmedCount: 5,
      completedCount: 3,
      noShowCount: 1,
      cancelledCount: 1,
      totalGuests: 25,
      noShowRate: 10,
      averagePartySize: 2.5,
    });
    mockServiceInstance.createSlot.mockResolvedValue({
      id: "slot-001",
      restaurantId: "restaurant-001",
      date: "2026-03-20",
      timeSlot: "19:00",
      maxCapacity: 40,
      maxTables: 10,
    });
    mockServiceInstance.batchCreateSlots.mockResolvedValue(5);

    app = new Hono();
    app.route("/reservations", routes);
  });

  // ─── POST / - Create Reservation ─────────────────────────────────

  describe("POST / - Create Reservation", () => {
    it("returns 201 with valid creation request", async () => {
      const req = new Request("http://localhost/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: "restaurant-001",
          customerName: "John Doe",
          customerPhone: "+60123456789",
          partySize: 4,
          reservationDate: "2026-03-20",
          reservationTime: "19:00",
        }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(201);
      const json = (await res.json()) as {
        success: boolean;
        data: any;
        message: string;
      };
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
      expect(json.message).toBe("訂位成功！確認碼已發送至您的手機");
    });

    it("returns 400 when restaurantId is missing", async () => {
      const req = new Request("http://localhost/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: "John Doe",
          customerPhone: "+60123456789",
          partySize: 4,
          reservationDate: "2026-03-20",
          reservationTime: "19:00",
        }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe("缺少必填欄位");
    });

    it("returns 400 when customerName is missing", async () => {
      const req = new Request("http://localhost/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: "restaurant-001",
          customerPhone: "+60123456789",
          partySize: 4,
          reservationDate: "2026-03-20",
          reservationTime: "19:00",
        }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
    });

    it("returns 400 when customerPhone is missing", async () => {
      const req = new Request("http://localhost/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: "restaurant-001",
          customerName: "John Doe",
          partySize: 4,
          reservationDate: "2026-03-20",
          reservationTime: "19:00",
        }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
    });

    it("returns 400 when partySize is missing", async () => {
      const req = new Request("http://localhost/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: "restaurant-001",
          customerName: "John Doe",
          customerPhone: "+60123456789",
          reservationDate: "2026-03-20",
          reservationTime: "19:00",
        }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
    });

    it("returns 400 when service throws an error", async () => {
      mockServiceInstance.createReservation.mockRejectedValue(
        new Error("Time slot not available"),
      );
      const req = new Request("http://localhost/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: "restaurant-001",
          customerName: "John Doe",
          customerPhone: "+60123456789",
          partySize: 4,
          reservationDate: "2026-03-20",
          reservationTime: "19:00",
        }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe("Time slot not available");
    });
  });

  // ─── GET /verify/:code - Verify Confirmation Code ────────────────

  describe("GET /verify/:code - Verify Confirmation Code", () => {
    it("returns 200 with reservation data for valid code", async () => {
      const req = new Request("http://localhost/reservations/verify/CONF123");
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; data: any };
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
      expect(mockServiceInstance.getReservationByCode).toHaveBeenCalledWith(
        "CONF123",
      );
    });

    it("returns 404 when confirmation code is not found", async () => {
      mockServiceInstance.getReservationByCode.mockResolvedValue(null);
      const req = new Request("http://localhost/reservations/verify/INVALID");
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(404);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe("找不到此訂位");
    });

    it("returns 500 when service throws an error", async () => {
      mockServiceInstance.getReservationByCode.mockRejectedValue(
        new Error("DB error"),
      );
      const req = new Request("http://localhost/reservations/verify/CONF123");
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
    });
  });

  // ─── GET /availability - Check Available Slots ───────────────────

  describe("GET /availability - Check Available Slots", () => {
    it("returns 200 with availability data for valid params", async () => {
      const req = new Request(
        "http://localhost/reservations/availability?restaurantId=restaurant-001&date=2026-03-20&partySize=4",
      );
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; data: any };
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
      expect(mockServiceInstance.getAvailableSlots).toHaveBeenCalledWith({
        restaurantId: "restaurant-001",
        date: "2026-03-20",
        partySize: 4,
        duration: 90,
      });
    });

    it("returns 400 when restaurantId is missing", async () => {
      const req = new Request(
        "http://localhost/reservations/availability?date=2026-03-20&partySize=4",
      );
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe("缺少必填參數");
    });

    it("returns 400 when date is missing", async () => {
      const req = new Request(
        "http://localhost/reservations/availability?restaurantId=restaurant-001&partySize=4",
      );
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
    });

    it("returns 400 when partySize is missing", async () => {
      const req = new Request(
        "http://localhost/reservations/availability?restaurantId=restaurant-001&date=2026-03-20",
      );
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
    });

    it("uses custom duration when provided", async () => {
      const req = new Request(
        "http://localhost/reservations/availability?restaurantId=restaurant-001&date=2026-03-20&partySize=4&duration=120",
      );
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      expect(mockServiceInstance.getAvailableSlots).toHaveBeenCalledWith({
        restaurantId: "restaurant-001",
        date: "2026-03-20",
        partySize: 4,
        duration: 120,
      });
    });

    it("returns 500 when service throws an error", async () => {
      mockServiceInstance.getAvailableSlots.mockRejectedValue(
        new Error("Service error"),
      );
      const req = new Request(
        "http://localhost/reservations/availability?restaurantId=restaurant-001&date=2026-03-20&partySize=4",
      );
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
    });
  });

  // ─── DELETE /:id/cancel - Cancel Reservation ─────────────────────

  describe("DELETE /:id/cancel - Cancel Reservation", () => {
    it("returns 200 when valid confirmationCode provided", async () => {
      const req = new Request("http://localhost/reservations/res-001/cancel", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmationCode: "CONF123",
          reason: "Change of plans",
        }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: any;
        message: string;
      };
      expect(json.success).toBe(true);
      expect(json.message).toBe("訂位已取消");
    });

    it("returns 400 when confirmationCode is missing", async () => {
      const req = new Request("http://localhost/reservations/res-001/cancel", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Change of plans" }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe("需要確認碼");
    });

    it("returns 403 when confirmationCode is wrong", async () => {
      const req = new Request("http://localhost/reservations/res-001/cancel", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationCode: "WRONGCODE" }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(403);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe("確認碼錯誤");
    });

    it("returns 403 when reservation is not found during cancel", async () => {
      mockServiceInstance.getReservationById.mockResolvedValue(null);
      const req = new Request(
        "http://localhost/reservations/non-existent/cancel",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmationCode: "CONF123" }),
        },
      );
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(403);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
    });

    it("returns 400 when cancelReservation throws an error", async () => {
      mockServiceInstance.cancelReservation.mockRejectedValue(
        new Error("Cannot cancel confirmed reservation"),
      );
      const req = new Request("http://localhost/reservations/res-001/cancel", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationCode: "CONF123" }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe("Cannot cancel confirmed reservation");
    });
  });

  // ─── GET / - List Reservations (protected) ────────────────────────

  describe("GET / - List Reservations (roles 0, 1, 4)", () => {
    it("returns 200 with paginated list for admin user", async () => {
      const req = new Request("http://localhost/reservations", {
        headers: { Authorization: "Bearer token" },
      });
      // Auth middleware is mocked to pass through, user context set via mock
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: any[];
        pagination: any;
      };
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
      expect(json.pagination).toBeDefined();
      expect(json.pagination.page).toBe(1);
      expect(json.pagination.limit).toBe(20);
      expect(json.pagination.total).toBe(1);
    });

    it("includes correct pagination totalPages", async () => {
      mockServiceInstance.listReservations.mockResolvedValue({
        data: new Array(20).fill(mockReservation),
        total: 45,
      });
      const req = new Request("http://localhost/reservations?page=2&limit=20");
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; pagination: any };
      expect(json.pagination.totalPages).toBe(3);
    });

    it("passes status filter to service", async () => {
      const req = new Request("http://localhost/reservations?status=confirmed");
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      expect(mockServiceInstance.listReservations).toHaveBeenCalled();
    });

    it("passes date filter to service", async () => {
      const req = new Request("http://localhost/reservations?date=2026-03-20");
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      expect(mockServiceInstance.listReservations).toHaveBeenCalled();
    });

    it("passes phone filter to service", async () => {
      const req = new Request(
        "http://localhost/reservations?phone=%2B60123456789",
      );
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      expect(mockServiceInstance.listReservations).toHaveBeenCalled();
    });

    it("returns 500 when service throws an error", async () => {
      mockServiceInstance.listReservations.mockRejectedValue(
        new Error("DB error"),
      );
      const req = new Request("http://localhost/reservations");
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
    });
  });

  // ─── GET /:id - Get Single Reservation ───────────────────────────

  describe("GET /:id - Get Single Reservation (roles 0, 1, 3, 4)", () => {
    it("returns 200 with reservation data", async () => {
      const req = new Request("http://localhost/reservations/res-001");
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; data: any };
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
      expect(mockServiceInstance.getReservationById).toHaveBeenCalledWith(
        "res-001",
      );
    });

    it("returns 404 when reservation is not found", async () => {
      mockServiceInstance.getReservationById.mockResolvedValue(null);
      const req = new Request("http://localhost/reservations/non-existent");
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(404);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe("找不到此訂位");
    });

    it("returns 500 when service throws an error", async () => {
      mockServiceInstance.getReservationById.mockRejectedValue(
        new Error("DB error"),
      );
      const req = new Request("http://localhost/reservations/res-001");
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
    });
  });

  // ─── PUT /:id - Update Reservation ───────────────────────────────

  describe("PUT /:id - Update Reservation (roles 0, 1, 4)", () => {
    it("returns 200 when successfully updated", async () => {
      const req = new Request("http://localhost/reservations/res-001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName: "Jane Doe" }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: any;
        message: string;
      };
      expect(json.success).toBe(true);
      expect(json.message).toBe("訂位已更新");
    });

    it("returns 404 when reservation is not found", async () => {
      mockServiceInstance.getReservationById.mockResolvedValue(null);
      const req = new Request("http://localhost/reservations/non-existent", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName: "Jane Doe" }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(404);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe("找不到此訂位");
    });

    it("returns 400 when updateReservation throws an error", async () => {
      mockServiceInstance.updateReservation.mockRejectedValue(
        new Error("Cannot update completed reservation"),
      );
      const req = new Request("http://localhost/reservations/res-001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName: "Jane Doe" }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe("Cannot update completed reservation");
    });
  });

  // ─── POST /:id/confirm - Confirm Reservation ─────────────────────

  describe("POST /:id/confirm - Confirm Reservation (state: pending → confirmed)", () => {
    it("returns 200 and transitions status to confirmed", async () => {
      const req = new Request("http://localhost/reservations/res-001/confirm", {
        method: "POST",
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: any;
        message: string;
      };
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("confirmed");
      expect(json.message).toBe("訂位已確認");
      expect(mockServiceInstance.confirmReservation).toHaveBeenCalledWith(
        "res-001",
      );
    });

    it("returns 400 when confirm throws (invalid state transition)", async () => {
      mockServiceInstance.confirmReservation.mockRejectedValue(
        new Error("Reservation already confirmed"),
      );
      const req = new Request("http://localhost/reservations/res-001/confirm", {
        method: "POST",
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe("Reservation already confirmed");
    });
  });

  // ─── POST /:id/arrive - Mark Arrived ─────────────────────────────

  describe("POST /:id/arrive - Mark Arrived (state: confirmed → arrived)", () => {
    it("returns 200 and transitions status to arrived", async () => {
      const req = new Request("http://localhost/reservations/res-001/arrive", {
        method: "POST",
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: any;
        message: string;
      };
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("arrived");
      expect(json.message).toBe("已標記到店");
      expect(mockServiceInstance.markArrived).toHaveBeenCalledWith("res-001");
    });

    it("returns 400 when markArrived throws (invalid state transition)", async () => {
      mockServiceInstance.markArrived.mockRejectedValue(
        new Error("Reservation not confirmed"),
      );
      const req = new Request("http://localhost/reservations/res-001/arrive", {
        method: "POST",
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe("Reservation not confirmed");
    });
  });

  // ─── POST /:id/seat - Mark Seated ────────────────────────────────

  describe("POST /:id/seat - Mark Seated (state: arrived → seated)", () => {
    it("returns 200 and transitions status to seated", async () => {
      const req = new Request("http://localhost/reservations/res-001/seat", {
        method: "POST",
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: any;
        message: string;
      };
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("seated");
      expect(json.message).toBe("已標記入座");
      expect(mockServiceInstance.markSeated).toHaveBeenCalledWith("res-001");
    });

    it("returns 400 when markSeated throws (invalid state transition)", async () => {
      mockServiceInstance.markSeated.mockRejectedValue(
        new Error("Guest has not arrived yet"),
      );
      const req = new Request("http://localhost/reservations/res-001/seat", {
        method: "POST",
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe("Guest has not arrived yet");
    });
  });

  // ─── POST /:id/complete - Complete Reservation ───────────────────

  describe("POST /:id/complete - Complete Reservation (state: seated → completed)", () => {
    it("returns 200 and transitions status to completed", async () => {
      const req = new Request(
        "http://localhost/reservations/res-001/complete",
        {
          method: "POST",
        },
      );
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: any;
        message: string;
      };
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("completed");
      expect(json.message).toBe("訂位已完成");
      expect(mockServiceInstance.completeReservation).toHaveBeenCalledWith(
        "res-001",
      );
    });

    it("returns 400 when completeReservation throws (invalid state transition)", async () => {
      mockServiceInstance.completeReservation.mockRejectedValue(
        new Error("Reservation not seated"),
      );
      const req = new Request(
        "http://localhost/reservations/res-001/complete",
        {
          method: "POST",
        },
      );
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe("Reservation not seated");
    });
  });

  // ─── POST /:id/no-show - Mark No Show ────────────────────────────

  describe("POST /:id/no-show - Mark No Show (roles 0, 1, 4)", () => {
    it("returns 200 and transitions status to no_show", async () => {
      const req = new Request("http://localhost/reservations/res-001/no-show", {
        method: "POST",
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: any;
        message: string;
      };
      expect(json.success).toBe(true);
      expect(json.data.status).toBe("no_show");
      expect(json.message).toBe("已標記未到店");
      expect(mockServiceInstance.markNoShow).toHaveBeenCalledWith("res-001");
    });

    it("returns 400 when markNoShow throws (invalid state transition)", async () => {
      mockServiceInstance.markNoShow.mockRejectedValue(
        new Error("Reservation already completed"),
      );
      const req = new Request("http://localhost/reservations/res-001/no-show", {
        method: "POST",
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe("Reservation already completed");
    });
  });

  // ─── GET /stats/:restaurantId - Reservation Stats ─────────────────

  describe("GET /stats/:restaurantId - Reservation Stats (roles 0, 1)", () => {
    it("returns 200 with stats data for valid restaurant", async () => {
      const req = new Request(
        "http://localhost/reservations/stats/restaurant-001",
      );
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; data: any };
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
      expect(json.data.restaurantId).toBe("restaurant-001");
      expect(mockServiceInstance.getReservationStats).toHaveBeenCalledWith(
        "restaurant-001",
        undefined,
      );
    });

    it("passes date query param to service", async () => {
      const req = new Request(
        "http://localhost/reservations/stats/restaurant-001?date=2026-03-20",
      );
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      expect(mockServiceInstance.getReservationStats).toHaveBeenCalledWith(
        "restaurant-001",
        "2026-03-20",
      );
    });

    it("returns 500 when service throws an error", async () => {
      mockServiceInstance.getReservationStats.mockRejectedValue(
        new Error("DB error"),
      );
      const req = new Request(
        "http://localhost/reservations/stats/restaurant-001",
      );
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
    });
  });

  // ─── POST /slots - Create Slot ────────────────────────────────────

  describe("POST /slots - Create Slot (roles 0, 1)", () => {
    it("returns 200 when slot is created successfully", async () => {
      const req = new Request("http://localhost/reservations/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: "restaurant-001",
          date: "2026-03-20",
          timeSlot: "19:00",
          maxCapacity: 40,
          maxTables: 10,
        }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: any;
        message: string;
      };
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
      expect(json.message).toBe("時段建立成功");
    });

    it("returns 400 when createSlot throws an error", async () => {
      mockServiceInstance.createSlot.mockRejectedValue(
        new Error("Slot already exists"),
      );
      const req = new Request("http://localhost/reservations/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: "restaurant-001",
          date: "2026-03-20",
          timeSlot: "19:00",
          maxCapacity: 40,
          maxTables: 10,
        }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe("Slot already exists");
    });
  });

  // ─── POST /slots/batch - Batch Create Slots ───────────────────────

  describe("POST /slots/batch - Batch Create Slots (roles 0, 1)", () => {
    it("returns 200 with created count when batch create is successful", async () => {
      const req = new Request("http://localhost/reservations/slots/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: "restaurant-001",
          startDate: "2026-03-20",
          endDate: "2026-03-27",
          timeSlots: ["11:00", "11:30", "12:00", "19:00", "19:30"],
          maxCapacity: 40,
          maxTables: 10,
        }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        success: boolean;
        data: { created: number };
        message: string;
      };
      expect(json.success).toBe(true);
      expect(json.data.created).toBe(5);
      expect(json.message).toBe("成功建立 5 個時段");
    });

    it("returns 400 when batchCreateSlots throws an error", async () => {
      mockServiceInstance.batchCreateSlots.mockRejectedValue(
        new Error("Invalid date range"),
      );
      const req = new Request("http://localhost/reservations/slots/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: "restaurant-001",
          startDate: "2026-03-27",
          endDate: "2026-03-20",
          timeSlots: ["11:00"],
          maxCapacity: 40,
          maxTables: 10,
        }),
      });
      const res = await app.fetch(req, mockEnv);
      expect(res.status).toBe(400);
      const json = (await res.json()) as { success: boolean; error: string };
      expect(json.success).toBe(false);
      expect(json.error).toBe("Invalid date range");
    });
  });

  // ─── State Machine - Full Flow ────────────────────────────────────

  describe("State Machine - Full Reservation Flow", () => {
    it("full flow: pending → confirmed → arrived → seated → completed", async () => {
      // Step 1: Confirm
      mockServiceInstance.confirmReservation.mockResolvedValue({
        ...mockReservation,
        status: "confirmed",
      });
      const confirmRes = await app.fetch(
        new Request("http://localhost/reservations/res-001/confirm", {
          method: "POST",
        }),
        mockEnv,
      );
      expect(confirmRes.status).toBe(200);
      let json = (await confirmRes.json()) as { data: { status: string } };
      expect(json.data.status).toBe("confirmed");

      // Step 2: Arrive
      mockServiceInstance.markArrived.mockResolvedValue({
        ...mockReservation,
        status: "arrived",
      });
      const arriveRes = await app.fetch(
        new Request("http://localhost/reservations/res-001/arrive", {
          method: "POST",
        }),
        mockEnv,
      );
      expect(arriveRes.status).toBe(200);
      json = (await arriveRes.json()) as { data: { status: string } };
      expect(json.data.status).toBe("arrived");

      // Step 3: Seat
      mockServiceInstance.markSeated.mockResolvedValue({
        ...mockReservation,
        status: "seated",
      });
      const seatRes = await app.fetch(
        new Request("http://localhost/reservations/res-001/seat", {
          method: "POST",
        }),
        mockEnv,
      );
      expect(seatRes.status).toBe(200);
      json = (await seatRes.json()) as { data: { status: string } };
      expect(json.data.status).toBe("seated");

      // Step 4: Complete
      mockServiceInstance.completeReservation.mockResolvedValue({
        ...mockReservation,
        status: "completed",
      });
      const completeRes = await app.fetch(
        new Request("http://localhost/reservations/res-001/complete", {
          method: "POST",
        }),
        mockEnv,
      );
      expect(completeRes.status).toBe(200);
      json = (await completeRes.json()) as { data: { status: string } };
      expect(json.data.status).toBe("completed");
    });

    it("alternative flow: pending → confirmed → no_show", async () => {
      // Confirm first
      mockServiceInstance.confirmReservation.mockResolvedValue({
        ...mockReservation,
        status: "confirmed",
      });
      const confirmRes = await app.fetch(
        new Request("http://localhost/reservations/res-001/confirm", {
          method: "POST",
        }),
        mockEnv,
      );
      expect(confirmRes.status).toBe(200);

      // Then mark no-show
      mockServiceInstance.markNoShow.mockResolvedValue({
        ...mockReservation,
        status: "no_show",
      });
      const noShowRes = await app.fetch(
        new Request("http://localhost/reservations/res-001/no-show", {
          method: "POST",
        }),
        mockEnv,
      );
      expect(noShowRes.status).toBe(200);
      const json = (await noShowRes.json()) as { data: { status: string } };
      expect(json.data.status).toBe("no_show");
    });
  });

  // ─── Response Structure Validation ───────────────────────────────

  describe("Response structure validation", () => {
    it("POST / response includes reservation data with confirmationCode", async () => {
      const req = new Request("http://localhost/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: "restaurant-001",
          customerName: "John Doe",
          customerPhone: "+60123456789",
          partySize: 4,
          reservationDate: "2026-03-20",
          reservationTime: "19:00",
        }),
      });
      const res = await app.fetch(req, mockEnv);
      const json = (await res.json()) as { success: boolean; data: any };
      expect(json.data.confirmationCode).toBe("CONF123");
      expect(json.data.restaurantId).toBe("restaurant-001");
    });

    it("GET /verify/:code response includes full reservation data", async () => {
      const req = new Request("http://localhost/reservations/verify/CONF123");
      const res = await app.fetch(req, mockEnv);
      const json = (await res.json()) as { success: boolean; data: any };
      expect(json.data.id).toBe("res-001");
      expect(json.data.customerName).toBe("John Doe");
    });

    it("GET / response includes pagination object", async () => {
      const req = new Request("http://localhost/reservations");
      const res = await app.fetch(req, mockEnv);
      const json = (await res.json()) as { pagination: any };
      expect(json.pagination.page).toBeDefined();
      expect(json.pagination.limit).toBeDefined();
      expect(json.pagination.total).toBeDefined();
      expect(json.pagination.totalPages).toBeDefined();
    });

    it("GET /stats/:restaurantId response includes all stats fields", async () => {
      const req = new Request(
        "http://localhost/reservations/stats/restaurant-001",
      );
      const res = await app.fetch(req, mockEnv);
      const json = (await res.json()) as { success: boolean; data: any };
      expect(json.data.totalReservations).toBeDefined();
      expect(json.data.confirmedCount).toBeDefined();
      expect(json.data.completedCount).toBeDefined();
      expect(json.data.noShowRate).toBeDefined();
    });
  });
});
