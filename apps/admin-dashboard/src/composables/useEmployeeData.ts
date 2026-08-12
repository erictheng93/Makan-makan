import { ref, watch } from "vue";
import { api, unwrapApiList } from "@/services/api";
import { schedulingService } from "@/services/schedulingService";
import { useAuthStore } from "@/stores/auth";
import type { Employee, LeaveBalance, LeaveRequest } from "@/types/employee";
import type { EmployeeSchedule } from "@/types/scheduling";

export function useEmployeeData(employeeId: () => number | undefined) {
  const authStore = useAuthStore();

  const employee = ref<Employee | null>(null);
  const schedules = ref<EmployeeSchedule[]>([]);
  const leaveBalances = ref<LeaveBalance[]>([]);
  const leaveRequests = ref<LeaveRequest[]>([]);

  const employeeLoading = ref(false);
  const schedulesLoading = ref(false);
  const leavesLoading = ref(false);
  const error = ref<string | null>(null);

  const fetchEmployee = async (id: number) => {
    employeeLoading.value = true;
    error.value = null;
    try {
      const response = await api.get(`/users/${id}`);
      const u: unknown = response.data?.data || response.data;
      employee.value = {
        id: u.id,
        username: u.username,
        fullName: u.fullName || "",
        email: u.email || "",
        phone: u.phone || "",
        role: u.role,
        status: u.isActive ? "active" : "inactive",
        isActive: u.isActive !== false,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
        profileImageUrl: u.profileImageUrl,
      };
    } catch (e: unknown) {
      error.value = e.message || "Failed to fetch employee";
      console.error("Failed to fetch employee:", e);
    } finally {
      employeeLoading.value = false;
    }
  };

  const fetchSchedules = async (id: number) => {
    const restaurantId = authStore.restaurantId;
    if (!restaurantId) return;
    schedulesLoading.value = true;
    try {
      // Fetch upcoming + recent schedules (past 7 days, next 30 days)
      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + 30);

      const result = await schedulingService.getSchedules({
        restaurantId,
        employeeId: id,
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
        limit: 50,
      });
      schedules.value = unwrapApiList<EmployeeSchedule>(result);
    } catch (e) {
      console.error("Failed to fetch schedules:", e);
    } finally {
      schedulesLoading.value = false;
    }
  };

  const fetchLeaveData = async (id: number) => {
    const restaurantId = authStore.restaurantId;
    if (!restaurantId) return;
    leavesLoading.value = true;
    try {
      const [balancesRes, requestsRes] = await Promise.all([
        api.get("/leaves/balances", {
          employeeId: id,
          year: new Date().getFullYear(),
        }),
        api.get(`/leaves/${restaurantId}/requests`, {
          employeeId: id,
          limit: 20,
        }),
      ]);

      const balancesData = balancesRes.data?.data || balancesRes.data || [];
      leaveBalances.value = Array.isArray(balancesData) ? balancesData : [];

      const requestsData = requestsRes.data?.data || requestsRes.data || [];
      leaveRequests.value = Array.isArray(requestsData) ? requestsData : [];
    } catch (e) {
      console.error("Failed to fetch leave data:", e);
    } finally {
      leavesLoading.value = false;
    }
  };

  const fetchAll = async () => {
    const id = employeeId();
    if (!id) return;

    // Critical path: employee details
    await fetchEmployee(id);

    // Fire-and-forget: secondary data
    fetchSchedules(id);
    fetchLeaveData(id);
  };

  // Auto-fetch when employeeId changes
  watch(
    employeeId,
    (newId) => {
      if (newId) fetchAll();
    },
    { immediate: true },
  );

  return {
    employee,
    schedules,
    leaveBalances,
    leaveRequests,
    employeeLoading,
    schedulesLoading,
    leavesLoading,
    error,
    fetchAll,
    fetchEmployee,
    fetchSchedules,
    fetchLeaveData,
  };
}
