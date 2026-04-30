import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("../api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { api } from "../api";
import { ownerService } from "../ownerService";

describe("ownerService", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    ownerService.clearCache();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it("gets dashboard data through the shared API client", async () => {
    const dashboard = {
      today_overview: {},
      staff_status: {},
      system_health: [],
      emergency_alerts: [],
      popular_items: [],
    };
    vi.mocked(api.get).mockResolvedValue({
      data: { success: true, data: dashboard },
    } as never);

    const result = await ownerService.getDashboardData("r1");

    expect(api.get).toHaveBeenCalledWith("/analytics/owner-dashboard", {
      restaurantId: "r1",
    });
    expect(result).toBe(dashboard);
  });

  it("omits empty params when getting dashboard data", async () => {
    const dashboard = {
      today_overview: {},
      staff_status: {},
      system_health: [],
      emergency_alerts: [],
      popular_items: [],
    };
    vi.mocked(api.get).mockResolvedValue({
      data: { success: true, data: dashboard },
    } as never);

    await ownerService.getDashboardData();

    expect(api.get).toHaveBeenCalledWith(
      "/analytics/owner-dashboard",
      undefined,
    );
  });

  it("throws API error messages from dashboard responses", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        success: false,
        error: { message: "Not allowed" },
      },
    } as never);

    await expect(ownerService.getDashboardData("r1")).rejects.toThrow(
      "Not allowed",
    );
  });

  it("gets financial reports with only provided filters", async () => {
    const report = {
      period: "monthly",
      revenue_summary: {},
      payment_methods: [],
      refund_stats: {},
    };
    vi.mocked(api.get).mockResolvedValue({
      data: { success: true, data: report },
    } as never);

    const result = await ownerService.getFinancialReport({
      restaurantId: "r1",
      period: "monthly",
      year: "2026",
    });

    expect(api.get).toHaveBeenCalledWith("/analytics/financial-report", {
      restaurantId: "r1",
      period: "monthly",
      year: "2026",
    });
    expect(result).toBe(report);
  });

  it("returns active orders from realtime dashboard data", async () => {
    const activeOrders = [{ id: 1, order_number: "A001" }];
    vi.mocked(api.get).mockResolvedValue({
      data: {
        success: true,
        data: { active_orders: activeOrders },
      },
    } as never);

    const result = await ownerService.getRealtimeOrders("r1");

    expect(api.get).toHaveBeenCalledWith("/analytics/realtime-dashboard", {
      restaurantId: "r1",
    });
    expect(result).toBe(activeOrders);
  });

  it("maps staff activity from users", async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            id: 1,
            fullName: "Alice",
            username: "alice",
            roleName: "Manager",
            status: "active",
          },
          {
            id: 2,
            username: "bob",
            status: "inactive",
          },
        ],
      },
    } as never);

    const result = await ownerService.getStaffActivity("r1");

    expect(api.get).toHaveBeenCalledWith("/users", {
      restaurantId: "r1",
      limit: "10",
    });
    expect(result).toEqual([
      {
        id: 1,
        name: "Alice",
        role: "Manager",
        status: "online",
        performance: 0,
      },
      {
        id: 2,
        name: "bob",
        role: "Staff",
        status: "offline",
        performance: 0,
      },
    ]);
  });

  it("keeps staff activity failure tolerant", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("Network error"));

    await expect(ownerService.getStaffActivity("r1")).resolves.toEqual([]);
  });

  it("posts emergency alert actions through the shared API client", async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true } } as never);

    await ownerService.resolveEmergencyAlert(42);
    await ownerService.escalateEmergencyAlert(42);

    expect(api.post).toHaveBeenNthCalledWith(1, "/alerts/42/resolve");
    expect(api.post).toHaveBeenNthCalledWith(2, "/alerts/42/escalate");
  });
});
