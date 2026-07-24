import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  user: { id: 42, role: 1, restaurantId: "rest-1" } as {
    id: number;
    role: number;
    restaurantId?: string;
  },
}));

vi.mock("../../../shared/middleware", async () => {
  const validation = await vi.importActual<
    typeof import("../../../middleware/validation")
  >("../../../middleware/validation");
  return {
    authMiddleware: vi.fn(async (c: any, next: any) => {
      c.set("user", auth.user);
      await next();
    }),
    requireRole: vi.fn(
      () => async (_c: unknown, next: () => Promise<void>) => next(),
    ),
    requireRestaurantAccess: vi.fn(
      () => async (_c: unknown, next: () => Promise<void>) => next(),
    ),
    validateBody: validation.validateBody,
    validateQuery: validation.validateQuery,
    validateParams: validation.validateParams,
  };
});

const serviceFns = vi.hoisted(() => ({
  getShiftTemplates: vi.fn(),
  getShiftTemplate: vi.fn(),
  createShiftTemplate: vi.fn(),
  updateShiftTemplate: vi.fn(),
  deleteShiftTemplate: vi.fn(),
  getSchedules: vi.fn(),
  getSchedule: vi.fn(),
  createSchedule: vi.fn(),
  bulkCreateSchedules: vi.fn(),
  updateSchedule: vi.fn(),
  deleteSchedule: vi.fn(),
  clockIn: vi.fn(),
  clockOut: vi.fn(),
  getClockedInEmployees: vi.fn(),
  getAttendanceReport: vi.fn(),
  getScheduleById: vi.fn(),
  createSwapRequest: vi.fn(),
  getSwapRequests: vi.fn(),
  acceptSwapRequest: vi.fn(),
  approveSwapRequest: vi.fn(),
  rejectSwapRequest: vi.fn(),
  cancelSwapRequest: vi.fn(),
  getAvailableEmployees: vi.fn(),
  getConflicts: vi.fn(),
  getConflict: vi.fn(),
  resolveConflict: vi.fn(),
  getDailyStats: vi.fn(),
  getWeeklySummary: vi.fn(),
  getEmployeeNames: vi.fn(),
}));

vi.mock("@makanmakan/database", () => ({
  SchedulingService: class {
    getShiftTemplates = serviceFns.getShiftTemplates;
    getShiftTemplate = serviceFns.getShiftTemplate;
    createShiftTemplate = serviceFns.createShiftTemplate;
    updateShiftTemplate = serviceFns.updateShiftTemplate;
    deleteShiftTemplate = serviceFns.deleteShiftTemplate;
    getSchedules = serviceFns.getSchedules;
    getSchedule = serviceFns.getSchedule;
    createSchedule = serviceFns.createSchedule;
    bulkCreateSchedules = serviceFns.bulkCreateSchedules;
    updateSchedule = serviceFns.updateSchedule;
    deleteSchedule = serviceFns.deleteSchedule;
    clockIn = serviceFns.clockIn;
    clockOut = serviceFns.clockOut;
    getClockedInEmployees = serviceFns.getClockedInEmployees;
    getAttendanceReport = serviceFns.getAttendanceReport;
    getScheduleById = serviceFns.getScheduleById;
    createSwapRequest = serviceFns.createSwapRequest;
    getSwapRequests = serviceFns.getSwapRequests;
    acceptSwapRequest = serviceFns.acceptSwapRequest;
    approveSwapRequest = serviceFns.approveSwapRequest;
    rejectSwapRequest = serviceFns.rejectSwapRequest;
    cancelSwapRequest = serviceFns.cancelSwapRequest;
    getAvailableEmployees = serviceFns.getAvailableEmployees;
    getConflicts = serviceFns.getConflicts;
    getConflict = serviceFns.getConflict;
    resolveConflict = serviceFns.resolveConflict;
    getDailyStats = serviceFns.getDailyStats;
    getWeeklySummary = serviceFns.getWeeklySummary;
    getEmployeeNames = serviceFns.getEmployeeNames;
  },
}));

import app from "./index";
import { ApiError } from "../../../shared/utils/api-error";

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      { success: false, error: { code: err.code, message: err.message } },
      err.status as 400 | 401 | 403 | 404 | 409,
    );
  }
  return c.json({ success: false, error: { message: String(err) } }, 500);
});

function request(path: string, method = "GET", body?: unknown) {
  return app.request(
    path,
    {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
    },
    { DB: {} } as never,
  );
}

const templateBody = {
  name: "Dinner",
  startTime: "17:00",
  endTime: "22:00",
  durationMinutes: 300,
};

const scheduleBody = {
  employeeId: 42,
  workDate: "2026-06-10",
  startTime: "09:00",
  endTime: "17:00",
  scheduledHours: 8,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  auth.user = { id: 42, role: 1, restaurantId: "rest-1" };

  serviceFns.getShiftTemplates.mockResolvedValue([{ id: 1, name: "Dinner" }]);
  serviceFns.getShiftTemplate.mockResolvedValue({ id: 1, name: "Dinner" });
  serviceFns.createShiftTemplate.mockResolvedValue({ id: 2, name: "Dinner" });
  serviceFns.updateShiftTemplate.mockResolvedValue({ id: 1, name: "Lunch" });
  serviceFns.deleteShiftTemplate.mockResolvedValue(true);
  serviceFns.getSchedules.mockResolvedValue({
    items: [{ id: 10, employeeId: 42 }],
    total: 25,
  });
  serviceFns.getSchedule.mockResolvedValue({ id: 10, employeeId: 42 });
  serviceFns.createSchedule.mockResolvedValue({ id: 10, employeeId: 42 });
  serviceFns.bulkCreateSchedules.mockResolvedValue(3);
  serviceFns.updateSchedule.mockResolvedValue({ id: 10, status: "confirmed" });
  serviceFns.deleteSchedule.mockResolvedValue(true);
  serviceFns.clockIn.mockResolvedValue({ id: 10, status: "clocked_in" });
  serviceFns.clockOut.mockResolvedValue({ id: 10, status: "clocked_out" });
  serviceFns.getClockedInEmployees.mockResolvedValue([{ id: 42 }]);
  serviceFns.getAttendanceReport.mockResolvedValue({
    records: [
      {
        employeeId: 42,
        workDate: "2026-06-10",
        startTime: "09:00",
        endTime: "17:00",
        clockInTime: "2026-06-10T01:00:00.000Z",
        clockOutTime: "2026-06-10T09:00:00.000Z",
        scheduledHours: 8,
        actualHours: 8,
        overtimeHours: 0,
        status: "completed",
      },
    ],
  });
  serviceFns.getEmployeeNames.mockResolvedValue(
    new Map<string | number, string>([[42, "Alice Server"]]),
  );
  serviceFns.getScheduleById.mockResolvedValue({ id: 10, employeeId: 42 });
  serviceFns.createSwapRequest.mockResolvedValue({ id: 20 });
  serviceFns.getSwapRequests.mockResolvedValue({
    items: [{ id: 20, requesterEmployeeId: 42 }],
    total: 1,
  });
  serviceFns.acceptSwapRequest.mockResolvedValue({
    id: 20,
    status: "accepted",
  });
  serviceFns.approveSwapRequest.mockResolvedValue({
    id: 20,
    status: "approved",
  });
  serviceFns.rejectSwapRequest.mockResolvedValue({
    id: 20,
    status: "rejected",
  });
  serviceFns.cancelSwapRequest.mockResolvedValue({
    id: 20,
    status: "cancelled",
  });
  serviceFns.getAvailableEmployees.mockResolvedValue([{ id: 42 }]);
  serviceFns.getConflicts.mockResolvedValue({
    items: [{ id: 30, status: "unresolved" }],
    total: 1,
  });
  serviceFns.getConflict.mockResolvedValue({ id: 30 });
  serviceFns.resolveConflict.mockResolvedValue({ id: 30, status: "resolved" });
  serviceFns.getDailyStats.mockResolvedValue({ totalSchedules: 4 });
  serviceFns.getWeeklySummary.mockResolvedValue({
    weekStartDate: "2026-06-08",
  });
});

describe("scheduling routes", () => {
  it("lists and creates shift templates with URL restaurant and user metadata", async () => {
    let res = await request("/rest-1/templates");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      data: [{ id: 1, name: "Dinner" }],
    });
    expect(serviceFns.getShiftTemplates).toHaveBeenCalledWith("rest-1");

    res = await request("/rest-1/templates", "POST", templateBody);
    expect(res.status).toBe(201);
    expect(serviceFns.createShiftTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "rest-1",
        createdBy: "42",
        name: "Dinner",
        shiftType: "regular",
      }),
    );
  });

  it("returns not found for missing templates and schedules", async () => {
    serviceFns.getShiftTemplate.mockResolvedValueOnce(null);
    let res = await request("/templates/999");
    expect(res.status).toBe(404);

    serviceFns.deleteSchedule.mockResolvedValueOnce(false);
    res = await request("/schedules/999", "DELETE");
    expect(res.status).toBe(404);
  });

  it("filters non-manager schedule lists to the authenticated employee", async () => {
    auth.user = { id: 42, role: 2, restaurantId: "rest-1" };

    const res = await request(
      "/rest-1/schedules?employeeId=99&page=2&limit=10",
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      pagination: { page: 2, limit: 10, total: 25, totalPages: 3 },
    });
    expect(serviceFns.getSchedules).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "rest-1",
        employeeId: "42",
        page: 2,
        limit: 10,
      }),
    );
  });

  it("allows managers to create, bulk create, update, and cancel schedules", async () => {
    auth.user = { id: 7, role: 1, restaurantId: "rest-1" };

    let res = await request("/rest-1/schedules", "POST", scheduleBody);
    expect(res.status).toBe(201);
    expect(serviceFns.createSchedule).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: "rest-1", createdBy: "7" }),
    );

    res = await request("/rest-1/schedules/bulk", "POST", {
      shiftTemplateId: 1,
      employeeIds: [42, 43],
      dateRange: { startDate: "2026-06-10", endDate: "2026-06-12" },
      daysOfWeek: [3, 4],
    });
    expect(res.status).toBe(201);
    expect(serviceFns.bulkCreateSchedules).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: "rest-1", createdBy: "7" }),
    );

    res = await request("/schedules/10", "PUT", {
      status: "confirmed",
      notes: "ready",
    });
    expect(res.status).toBe(200);
    expect(serviceFns.updateSchedule).toHaveBeenCalledWith(10, {
      status: "confirmed",
      notes: "ready",
      updatedBy: "7",
    });

    res = await request("/schedules/10", "DELETE");
    expect(res.status).toBe(200);
    expect(serviceFns.deleteSchedule).toHaveBeenCalledWith(10);
  });

  it("prevents employees from reading or clocking another employee schedule", async () => {
    auth.user = { id: 42, role: 2, restaurantId: "rest-1" };
    serviceFns.getSchedule.mockResolvedValueOnce({ id: 10, employeeId: 99 });

    let res = await request("/schedules/10");
    expect(res.status).toBe(403);

    res = await request("/schedules/10/clock-in", "POST", {
      scheduleId: 10,
      employeeId: 99,
      notes: "late",
    });
    expect(res.status).toBe(403);
    expect(serviceFns.clockIn).not.toHaveBeenCalled();
  });

  it("clocks employees in and out with current timestamps", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T01:00:00.000Z"));
    auth.user = { id: 42, role: 2, restaurantId: "rest-1" };

    let res = await request("/schedules/10/clock-in", "POST", {
      scheduleId: 10,
      employeeId: "42",
      notes: "arrived",
    });
    expect(res.status).toBe(200);
    expect(serviceFns.clockIn).toHaveBeenCalledWith({
      scheduleId: 10,
      employeeId: "42",
      clockInTime: new Date("2026-06-10T01:00:00.000Z"),
      notes: "arrived",
    });

    res = await request("/schedules/10/clock-out", "POST", {
      scheduleId: 10,
      employeeId: 42,
      notes: "done",
    });
    expect(res.status).toBe(200);
    expect(serviceFns.clockOut).toHaveBeenCalledWith({
      scheduleId: 10,
      employeeId: "42",
      clockOutTime: new Date("2026-06-10T01:00:00.000Z"),
      notes: "done",
    });
  });

  it("exports attendance reports as CSV with attachment headers", async () => {
    const res = await request(
      "/rest-1/attendance-report/export?startDate=2026-06-10&endDate=2026-06-11&employeeId=42",
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="attendance-report-2026-06-10-to-2026-06-11.csv"',
    );
    const body = await res.text();
    expect(body).toContain(
      "Employee Name,Date,Scheduled Start,Scheduled End,Clock In,Clock Out",
    );
    // Resolved display name is emitted, not the raw employee id.
    expect(body).toContain('"Alice Server"');
    expect(body).not.toContain('"42"');
    expect(serviceFns.getEmployeeNames).toHaveBeenCalledWith([42]);
    expect(serviceFns.getAttendanceReport).toHaveBeenCalledWith("rest-1", {
      startDate: "2026-06-10",
      endDate: "2026-06-11",
      employeeId: "42",
    });
  });

  it("performs admin clock actions from the schedule employee id", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T01:00:00.000Z"));
    serviceFns.getScheduleById.mockResolvedValueOnce({
      id: 10,
      employeeId: 99,
    });

    const res = await request("/schedules/10/admin-clock-in", "POST", {
      notes: "manual",
    });

    expect(res.status).toBe(200);
    expect(serviceFns.clockIn).toHaveBeenCalledWith(
      {
        scheduleId: 10,
        employeeId: 99,
        clockInTime: new Date("2026-06-10T01:00:00.000Z"),
        notes: "manual",
      },
      true,
    );
  });

  it("normalizes swap request dates and constrains employee swap list filters", async () => {
    auth.user = { id: 42, role: 2, restaurantId: "rest-1" };

    let res = await request("/rest-1/swap-requests", "POST", {
      requesterEmployeeId: 42,
      requesterScheduleId: 10,
      requestType: "cover",
      reason: "Appointment",
      expiresAt: 1_780_800_000_000,
    });
    expect(res.status).toBe(201);
    expect(serviceFns.createSwapRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "rest-1",
        requesterEmployeeId: "42",
        expiresAt: new Date(1_780_800_000_000),
      }),
    );

    res = await request("/rest-1/swap-requests?requesterEmployeeId=99");
    expect(res.status).toBe(200);
    expect(serviceFns.getSwapRequests).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurantId: "rest-1",
        requesterEmployeeId: "42",
      }),
    );
  });

  it("accepts, approves, rejects, and cancels swap requests", async () => {
    auth.user = { id: 42, role: 2, restaurantId: "rest-1" };
    let res = await request("/swap-requests/20/accept", "POST", {
      employeeId: 42,
    });
    expect(res.status).toBe(200);
    expect(serviceFns.acceptSwapRequest).toHaveBeenCalledWith(20, "42");

    res = await request("/swap-requests/20/approve", "POST", {
      managerId: 7,
    });
    expect(res.status).toBe(200);
    expect(serviceFns.approveSwapRequest).toHaveBeenCalledWith(20, "7");

    res = await request("/swap-requests/20/reject", "POST", {
      managerId: 7,
      reason: "coverage unavailable",
    });
    expect(res.status).toBe(200);
    expect(serviceFns.rejectSwapRequest).toHaveBeenCalledWith(
      20,
      "7",
      "coverage unavailable",
    );

    res = await request("/swap-requests/20/cancel", "POST");
    expect(res.status).toBe(200);
    expect(serviceFns.cancelSwapRequest).toHaveBeenCalledWith(20, "42");
  });

  it("returns availability, conflicts, and scheduling stats", async () => {
    let res = await request(
      "/rest-1/available-employees?date=2026-06-10&shiftTemplateId=1",
    );
    expect(res.status).toBe(200);
    expect(serviceFns.getAvailableEmployees).toHaveBeenCalledWith({
      restaurantId: "rest-1",
      date: "2026-06-10",
      shiftTemplateId: 1,
    });

    res = await request("/rest-1/conflicts?page=1&limit=5");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      pagination: { page: 1, limit: 5, total: 1, totalPages: 1 },
    });

    res = await request("/conflicts/30/resolve", "POST", {
      userId: 7,
      resolutionNotes: "Adjusted shift",
    });
    expect(res.status).toBe(200);
    expect(serviceFns.resolveConflict).toHaveBeenCalledWith(
      30,
      "7",
      "Adjusted shift",
    );

    res = await request("/rest-1/stats/daily?date=2026-06-10");
    expect(res.status).toBe(200);
    expect(serviceFns.getDailyStats).toHaveBeenCalledWith(
      "rest-1",
      "2026-06-10",
    );

    res = await request("/rest-1/stats/weekly?weekStartDate=2026-06-08");
    expect(res.status).toBe(200);
    expect(serviceFns.getWeeklySummary).toHaveBeenCalledWith(
      "rest-1",
      "2026-06-08",
    );
  });
});
