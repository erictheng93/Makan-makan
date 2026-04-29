/**
 * useEmployeeData Composable Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ref, nextTick } from "vue";

// ── Hoisted mocks ────────────────────────────────────────────────────────

const mockApiGet = vi.hoisted(() => vi.fn());
const mockGetSchedules = vi.hoisted(() => vi.fn());

vi.mock("@/services/api", () => {
  const unwrapApiPayload = (payload: unknown) =>
    typeof payload === "object" && payload !== null && "data" in payload
      ? (payload as { data: unknown }).data
      : payload;

  return {
    api: {
      get: mockApiGet,
    },
    unwrapApiPayload,
    unwrapApiData: (response: { data: unknown }) =>
      unwrapApiPayload(response.data),
    unwrapApiList: (payload: unknown) => {
      const data = unwrapApiPayload(payload);
      return Array.isArray(data) ? data : [];
    },
  };
});

vi.mock("@/services/schedulingService", () => ({
  schedulingService: {
    getSchedules: mockGetSchedules,
  },
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    restaurantId: "r1",
  }),
}));

// Mock watch to not auto-trigger (we call fetchAll manually)
vi.mock("vue", async () => {
  const actual = await vi.importActual("vue");
  return {
    ...actual,
    watch: vi.fn(),
  };
});

import { useEmployeeData } from "../useEmployeeData";

describe("useEmployeeData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial state", () => {
    it("should have null employee and empty arrays", () => {
      const employeeId = () => undefined;
      const { employee, schedules, leaveBalances, leaveRequests, error } =
        useEmployeeData(employeeId);

      expect(employee.value).toBeNull();
      expect(schedules.value).toEqual([]);
      expect(leaveBalances.value).toEqual([]);
      expect(leaveRequests.value).toEqual([]);
      expect(error.value).toBeNull();
    });

    it("should have loading states as false", () => {
      const { employeeLoading, schedulesLoading, leavesLoading } =
        useEmployeeData(() => undefined);

      expect(employeeLoading.value).toBe(false);
      expect(schedulesLoading.value).toBe(false);
      expect(leavesLoading.value).toBe(false);
    });
  });

  describe("fetchEmployee", () => {
    it("should fetch and map employee data", async () => {
      mockApiGet.mockResolvedValue({
        data: {
          data: {
            id: 42,
            username: "johndoe",
            fullName: "John Doe",
            email: "john@test.com",
            phone: "123456",
            role: 1,
            isActive: true,
            lastLoginAt: "2026-04-01",
            createdAt: "2026-01-01",
            profileImageUrl: null,
          },
        },
      });

      const { fetchEmployee, employee, employeeLoading } = useEmployeeData(
        () => 42,
      );

      await fetchEmployee(42);

      expect(mockApiGet).toHaveBeenCalledWith("/users/42");
      expect(employee.value).toEqual(
        expect.objectContaining({
          id: 42,
          username: "johndoe",
          fullName: "John Doe",
          email: "john@test.com",
          status: "active",
          isActive: true,
        }),
      );
      expect(employeeLoading.value).toBe(false);
    });

    it("should map inactive employee status", async () => {
      mockApiGet.mockResolvedValue({
        data: {
          data: {
            id: 43,
            username: "jane",
            isActive: false,
            role: 2,
          },
        },
      });

      const { fetchEmployee, employee } = useEmployeeData(() => 43);
      await fetchEmployee(43);

      expect(employee.value!.status).toBe("inactive");
      expect(employee.value!.isActive).toBe(false);
    });

    it("should set error on fetch failure", async () => {
      mockApiGet.mockRejectedValue(new Error("Not found"));

      const { fetchEmployee, error, employee } = useEmployeeData(() => 99);
      await fetchEmployee(99);

      expect(error.value).toBe("Not found");
      expect(employee.value).toBeNull();
    });
  });

  describe("fetchSchedules", () => {
    it("should fetch schedules with date range", async () => {
      mockGetSchedules.mockResolvedValue({
        data: [{ id: "sch1", date: "2026-04-05" }],
      });

      const { fetchSchedules, schedules } = useEmployeeData(() => 42);
      await fetchSchedules(42);

      expect(mockGetSchedules).toHaveBeenCalledWith(
        expect.objectContaining({
          restaurantId: "r1",
          employeeId: 42,
          limit: 50,
          startDate: expect.any(String),
          endDate: expect.any(String),
        }),
      );
      expect(schedules.value).toEqual([{ id: "sch1", date: "2026-04-05" }]);
    });

    it("should handle schedule fetch error gracefully", async () => {
      mockGetSchedules.mockRejectedValue(new Error("fail"));

      const { fetchSchedules, schedules } = useEmployeeData(() => 42);
      await fetchSchedules(42);

      // Should not throw, schedules stay empty
      expect(schedules.value).toEqual([]);
    });
  });

  describe("fetchLeaveData", () => {
    it("should fetch balances and requests in parallel", async () => {
      mockApiGet.mockImplementation((url: string) => {
        if (url.includes("balances")) {
          return Promise.resolve({
            data: {
              data: [{ type: "annual", balance: 10, used: 2 }],
            },
          });
        }
        if (url.includes("requests")) {
          return Promise.resolve({
            data: {
              data: [{ id: "lr1", status: "approved" }],
            },
          });
        }
        return Promise.resolve({ data: {} });
      });

      const { fetchLeaveData, leaveBalances, leaveRequests } = useEmployeeData(
        () => 42,
      );
      await fetchLeaveData(42);

      expect(mockApiGet).toHaveBeenCalledWith(
        "/leaves/balances",
        expect.objectContaining({ employeeId: 42 }),
      );
      expect(mockApiGet).toHaveBeenCalledWith(
        "/leaves/r1/requests",
        expect.objectContaining({ employeeId: 42 }),
      );
      expect(leaveBalances.value).toHaveLength(1);
      expect(leaveRequests.value).toHaveLength(1);
    });

    it("should handle non-array responses", async () => {
      mockApiGet.mockResolvedValue({
        data: { data: null },
      });

      const { fetchLeaveData, leaveBalances, leaveRequests } = useEmployeeData(
        () => 42,
      );
      await fetchLeaveData(42);

      expect(leaveBalances.value).toEqual([]);
      expect(leaveRequests.value).toEqual([]);
    });
  });

  describe("fetchAll", () => {
    it("should not fetch when employeeId is undefined", async () => {
      const { fetchAll } = useEmployeeData(() => undefined);
      await fetchAll();

      expect(mockApiGet).not.toHaveBeenCalled();
      expect(mockGetSchedules).not.toHaveBeenCalled();
    });

    it("should fetch employee first, then schedules and leaves", async () => {
      const callOrder: string[] = [];

      mockApiGet.mockImplementation((url: string) => {
        callOrder.push(url);
        if (url.includes("/users/")) {
          return Promise.resolve({
            data: {
              data: { id: 42, username: "test", role: 1, isActive: true },
            },
          });
        }
        return Promise.resolve({ data: { data: [] } });
      });
      mockGetSchedules.mockImplementation(() => {
        callOrder.push("schedules");
        return Promise.resolve({ data: [] });
      });

      const { fetchAll } = useEmployeeData(() => 42);
      await fetchAll();

      // Employee fetch should come first
      expect(callOrder[0]).toBe("/users/42");
      expect(mockApiGet).toHaveBeenCalled();
    });
  });
});
