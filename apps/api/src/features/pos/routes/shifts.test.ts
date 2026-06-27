import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../shared/utils/api-error";

const mocks = vi.hoisted(() => ({
  user: {
    id: 10,
    username: "cashier",
    role: 4,
    restaurantId: "restaurant-1",
  },
  shiftService: {
    endShift: vi.fn(),
    getCurrentShift: vi.fn(),
    resumeShift: vi.fn(),
    startShift: vi.fn(),
    suspendShift: vi.fn(),
  },
  shiftServiceCtor: vi.fn(),
  reportService: {
    generateShiftReport: vi.fn(),
    getShiftStats: vi.fn(),
  },
  reportServiceCtor: vi.fn(),
}));

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c, next) => {
    c.set("user", mocks.user);
    await next();
  }),
  requireRole: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

vi.mock("../services/ShiftService", () => ({
  ShiftService: vi.fn(function ShiftService(...args: unknown[]) {
    mocks.shiftServiceCtor(...args);
    return mocks.shiftService;
  }),
}));

vi.mock("../services/ReportService", () => ({
  ReportService: vi.fn(function ReportService(...args: unknown[]) {
    mocks.reportServiceCtor(...args);
    return mocks.reportService;
  }),
}));

import routes from "./shifts";

routes.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      },
      err.status as 400 | 401 | 403 | 404 | 409,
    );
  }

  return c.json({ success: false, error: { message: String(err) } }, 500);
});

function request(path: string, init: RequestInit = {}) {
  return routes.request(path, init, { DB: { binding: "db" } } as never);
}

async function json(response: Response) {
  return (await response.json()) as {
    success: boolean;
    data?: unknown;
    message?: string;
    error?: { code?: string; message?: string; details?: unknown };
  };
}

const shiftId = "550e8400-e29b-41d4-a716-446655440000";
const registerId = "550e8400-e29b-41d4-a716-446655440001";

describe("POS shift routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = {
      id: 10,
      username: "cashier",
      role: 4,
      restaurantId: "restaurant-1",
    };
    mocks.shiftService.startShift.mockResolvedValue({
      success: true,
      data: { id: shiftId, registerId, operatorId: "10", status: "active" },
    });
    mocks.shiftService.endShift.mockResolvedValue({
      success: true,
      data: { shift: { id: shiftId, status: "closed" } },
    });
    mocks.shiftService.suspendShift.mockResolvedValue({ success: true });
    mocks.shiftService.resumeShift.mockResolvedValue({ success: true });
    mocks.shiftService.getCurrentShift.mockResolvedValue({
      success: true,
      data: { id: shiftId, registerId, status: "active" },
    });
    mocks.reportService.generateShiftReport.mockResolvedValue({
      success: true,
      data: { shiftId, totals: { sales: 1200 } },
    });
    mocks.reportService.getShiftStats.mockResolvedValue({
      success: true,
      data: { totalShifts: 3 },
    });
  });

  it("starts a shift for the authenticated cashier", async () => {
    const payload = {
      registerId,
      operatorId: "10",
      startAmount: 500,
      notes: "morning shift",
    };

    const response = await request("/start", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.shiftServiceCtor).toHaveBeenCalledWith({ binding: "db" });
    expect(mocks.shiftService.startShift).toHaveBeenCalledWith(payload);
    expect(body).toEqual({
      success: true,
      data: { id: shiftId, registerId, operatorId: "10", status: "active" },
    });
  });

  it("rejects starting another operator's shift and propagates start errors", async () => {
    let response = await request("/start", {
      method: "POST",
      body: JSON.stringify({
        registerId,
        operatorId: 11,
        startAmount: 500,
      }),
      headers: { "Content-Type": "application/json" },
    });
    let body = await json(response);

    expect(response.status).toBe(403);
    expect(body.error?.code).toBe("FORBIDDEN");
    expect(mocks.shiftService.startShift).not.toHaveBeenCalled();

    mocks.user.role = 0;
    mocks.shiftService.startShift.mockResolvedValueOnce({
      success: false,
      error: "register already has an active shift",
    });
    response = await request("/start", {
      method: "POST",
      body: JSON.stringify({
        registerId,
        operatorId: 11,
        startAmount: 500,
      }),
      headers: { "Content-Type": "application/json" },
    });
    body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error?.message).toBe("register already has an active shift");
  });

  it("ends, suspends, and resumes shifts", async () => {
    let response = await request(`/${shiftId}/end`, {
      method: "POST",
      body: JSON.stringify({
        actualAmount: 1200,
        closingNotes: "balanced",
      }),
      headers: { "Content-Type": "application/json" },
    });
    let body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.shiftService.endShift).toHaveBeenCalledWith(
      shiftId,
      { actualAmount: 1200, closingNotes: "balanced" },
      10,
    );
    expect(body.data).toEqual({ shift: { id: shiftId, status: "closed" } });

    response = await request(`/${shiftId}/suspend`, {
      method: "POST",
      body: JSON.stringify({ reason: "cash count" }),
      headers: { "Content-Type": "application/json" },
    });
    body = await json(response);
    expect(response.status).toBe(200);
    expect(mocks.shiftService.suspendShift).toHaveBeenCalledWith(
      shiftId,
      "cash count",
    );
    expect(body.success).toBe(true);

    response = await request(`/${shiftId}/resume`, { method: "POST" });
    body = await json(response);
    expect(response.status).toBe(200);
    expect(mocks.shiftService.resumeShift).toHaveBeenCalledWith(shiftId);
    expect(body.success).toBe(true);
  });

  it("maps shift action service failures to bad requests", async () => {
    mocks.shiftService.endShift.mockResolvedValueOnce({
      success: false,
      error: "shift is not active",
    });
    let response = await request(`/${shiftId}/end`, {
      method: "POST",
      body: JSON.stringify({ actualAmount: 1000 }),
      headers: { "Content-Type": "application/json" },
    });
    let body = await json(response);
    expect(response.status).toBe(400);
    expect(body.error?.message).toBe("shift is not active");

    mocks.shiftService.suspendShift.mockResolvedValueOnce({
      success: false,
      error: "cannot suspend closed shift",
    });
    response = await request(`/${shiftId}/suspend`, {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    body = await json(response);
    expect(response.status).toBe(400);
    expect(body.error?.message).toBe("cannot suspend closed shift");

    mocks.shiftService.resumeShift.mockResolvedValueOnce({
      success: false,
      error: "shift is not suspended",
    });
    response = await request(`/${shiftId}/resume`, { method: "POST" });
    body = await json(response);
    expect(response.status).toBe(400);
    expect(body.error?.message).toBe("shift is not suspended");
  });

  it("returns current shift and shift report", async () => {
    let response = await request(`/current/${registerId}`);
    let body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.shiftService.getCurrentShift).toHaveBeenCalledWith(registerId);
    expect(body.data).toEqual({ id: shiftId, registerId, status: "active" });

    response = await request(`/${shiftId}/report`);
    body = await json(response);
    expect(response.status).toBe(200);
    expect(mocks.reportService.generateShiftReport).toHaveBeenCalledWith(
      shiftId,
    );
    expect(body.data).toEqual({ shiftId, totals: { sales: 1200 } });
  });

  it("returns shift stats with owner restaurant scoping and date ranges", async () => {
    const response = await request(
      "/stats?restaurantId=restaurant-1&dateFrom=2026-06-01T00:00:00.000Z&dateTo=2026-06-07T23:59:59.000Z",
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.reportService.getShiftStats).toHaveBeenCalledWith(
      "restaurant-1",
      {
        from: new Date("2026-06-01T00:00:00.000Z"),
        to: new Date("2026-06-07T23:59:59.000Z"),
      },
    );
    expect(body.data).toEqual({ totalShifts: 3 });
  });

  it("rejects invalid stats restaurant scope and missing admin restaurant", async () => {
    mocks.user.role = 1;
    let response = await request("/stats?restaurantId=restaurant-2");
    let body = await json(response);

    expect(response.status).toBe(403);
    expect(body.error?.code).toBe("FORBIDDEN");
    expect(mocks.reportService.getShiftStats).not.toHaveBeenCalled();

    mocks.user = {
      id: 1,
      username: "admin",
      role: 0,
      restaurantId: undefined,
    };
    response = await request("/stats");
    body = await json(response);
    expect(response.status).toBe(400);
    expect(body.error?.code).toBe("BAD_REQUEST");
  });
});
