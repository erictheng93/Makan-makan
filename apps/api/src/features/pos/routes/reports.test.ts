import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../shared/utils/api-error";

const mocks = vi.hoisted(() => ({
  user: {
    id: 10,
    username: "owner",
    role: 1,
    restaurantId: "restaurant-1",
  },
  reportService: {
    generateShiftReport: vi.fn(),
    getDailyReport: vi.fn(),
    getRegisterUsageStats: vi.fn(),
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

vi.mock("../services/ReportService", () => ({
  ReportService: vi.fn(function ReportService(...args: unknown[]) {
    mocks.reportServiceCtor(...args);
    return mocks.reportService;
  }),
}));

import routes from "./reports";

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

function request(path: string) {
  return routes.request(path, undefined, { DB: { binding: "db" } } as never);
}

async function json(response: Response) {
  return (await response.json()) as {
    success: boolean;
    data?: Record<string, unknown>;
    error?: { code?: string; message?: string; details?: unknown };
  };
}

const dailyReport = {
  date: "2026-06-07",
  summary: {
    totalOrders: 5,
    totalSales: 1200,
    totalTax: 60,
    totalDiscounts: 20,
    totalRefunds: 1,
    totalRefundAmount: 100,
    netSales: 1140,
  },
};

describe("POS report routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(1710000000000);
    mocks.user = {
      id: 10,
      username: "owner",
      role: 1,
      restaurantId: "restaurant-1",
    };
    mocks.reportService.getDailyReport.mockResolvedValue({
      success: true,
      data: dailyReport,
    });
    mocks.reportService.getRegisterUsageStats.mockResolvedValue({
      success: true,
      data: { registers: [{ id: "register-1", totalSales: 900 }] },
    });
    mocks.reportService.generateShiftReport.mockResolvedValue({
      success: true,
      data: { shiftId: "550e8400-e29b-41d4-a716-446655440000" },
    });
  });

  it("returns daily reports for the owner restaurant or explicit admin restaurant", async () => {
    let response = await request("/daily?date=2026-06-07");
    let body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.reportServiceCtor).toHaveBeenCalledWith({ binding: "db" });
    expect(mocks.reportService.getDailyReport).toHaveBeenCalledWith(
      "restaurant-1",
      "2026-06-07",
    );
    expect(body).toEqual({ success: true, data: dailyReport });

    mocks.user = {
      id: 1,
      username: "admin",
      role: 0,
      restaurantId: undefined,
    };
    response = await request(
      "/daily?restaurantId=restaurant-2&date=2026-06-07",
    );
    body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.reportService.getDailyReport).toHaveBeenLastCalledWith(
      "restaurant-2",
      "2026-06-07",
    );
    expect(body.success).toBe(true);
  });

  it("rejects invalid daily report scope, missing restaurant, and service failures", async () => {
    let response = await request(
      "/daily?restaurantId=restaurant-2&date=2026-06-07",
    );
    let body = await json(response);

    expect(response.status).toBe(403);
    expect(body.error?.code).toBe("FORBIDDEN");
    expect(mocks.reportService.getDailyReport).not.toHaveBeenCalled();

    mocks.user = {
      id: 1,
      username: "admin",
      role: 0,
      restaurantId: undefined,
    };
    response = await request("/daily?date=2026-06-07");
    body = await json(response);
    expect(response.status).toBe(400);
    expect(body.error?.code).toBe("BAD_REQUEST");

    mocks.user.restaurantId = "restaurant-1";
    mocks.reportService.getDailyReport.mockResolvedValueOnce({
      success: false,
      error: "daily unavailable",
    });
    response = await request("/daily?date=2026-06-07");
    body = await json(response);
    expect(response.status).toBe(400);
    expect(body.error?.message).toBe("daily unavailable");
  });

  it("returns register usage stats with default and explicit periods", async () => {
    let response = await request("/register-usage");
    let body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.reportService.getRegisterUsageStats).toHaveBeenCalledWith(
      "restaurant-1",
      "day",
    );
    expect(body.data).toEqual({
      registers: [{ id: "register-1", totalSales: 900 }],
    });

    response = await request(
      "/register-usage?restaurantId=restaurant-1&period=month",
    );
    body = await json(response);
    expect(response.status).toBe(200);
    expect(mocks.reportService.getRegisterUsageStats).toHaveBeenLastCalledWith(
      "restaurant-1",
      "month",
    );
    expect(body.success).toBe(true);
  });

  it("rejects invalid register usage scope and service failures", async () => {
    let response = await request("/register-usage?restaurantId=restaurant-2");
    let body = await json(response);

    expect(response.status).toBe(403);
    expect(body.error?.code).toBe("FORBIDDEN");

    mocks.reportService.getRegisterUsageStats.mockResolvedValueOnce({
      success: false,
      error: "usage unavailable",
    });
    response = await request("/register-usage");
    body = await json(response);
    expect(response.status).toBe(400);
    expect(body.error?.message).toBe("usage unavailable");
  });

  it("exports daily reports as JSON and CSV", async () => {
    let response = await request(
      "/export?type=daily&format=json&startDate=2026-06-07",
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.reportService.getDailyReport).toHaveBeenCalledWith(
      "restaurant-1",
      "2026-06-07",
    );
    expect(body).toEqual({ success: true, data: dailyReport });

    response = await request(
      "/export?type=daily&format=csv&startDate=2026-06-07",
    );
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="daily-report-1710000000000.csv"',
    );
    expect(csv).toContain("2026-06-07,5,1200,60,20,1,100,1140");
  });

  it("exports shift and register usage reports, and returns PDF not implemented", async () => {
    const shiftId = "550e8400-e29b-41d4-a716-446655440000";
    let response = await request(`/export?type=shift&shiftId=${shiftId}`);
    let body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.reportService.generateShiftReport).toHaveBeenCalledWith(
      shiftId,
    );
    expect(body.data).toEqual({ shiftId });

    response = await request("/export?type=register-usage");
    body = await json(response);
    expect(response.status).toBe(200);
    expect(mocks.reportService.getRegisterUsageStats).toHaveBeenCalledWith(
      "restaurant-1",
      "day",
    );
    expect(body.success).toBe(true);

    response = await request("/export?type=register-usage&format=pdf");
    body = await json(response);
    expect(response.status).toBe(501);
    expect(body.success).toBe(false);
  });

  it("validates export-specific required inputs and service errors", async () => {
    let response = await request("/export?type=daily");
    let body = await json(response);
    expect(response.status).toBe(400);
    expect(body.error?.code).toBe("BAD_REQUEST");

    response = await request("/export?type=shift");
    body = await json(response);
    expect(response.status).toBe(400);
    expect(body.error?.code).toBe("BAD_REQUEST");

    mocks.reportService.getDailyReport.mockResolvedValueOnce({
      success: false,
      error: "export failed",
    });
    response = await request(
      "/export?type=daily&format=json&startDate=2026-06-07",
    );
    body = await json(response);
    expect(response.status).toBe(400);
    expect(body.error?.message).toBe("export failed");
  });
});
