import { ref, computed } from "vue";
import { api } from "@/services/api";
import { schedulingService } from "@/services/schedulingService";
import { useAuthStore } from "@/stores/auth";
import type {
  Employee,
  EmployeeWithStatus,
  EmployeeStats,
  EmployeeFormData,
} from "@/types/employee";
import type { EmployeeSchedule } from "@/types/scheduling";
import { t } from "@/i18n";
import { resolveUserFacingError } from "@makanmasak/shared/utils/user-facing-error";
import { mapApiUser, type ApiUser } from "@/types/api-user";

// Module-level shared state — all callers share the same data
const users = ref<Employee[]>([]);
const clockedInList = ref<EmployeeSchedule[]>([]);
const todayLeaveRequests = ref<
  Array<{ employeeId: number; leaveTypeName: string; endDate: string }>
>([]);
const isLoading = ref(false);
const clockedInLoading = ref(false);
const leaveLoading = ref(false);
const error = ref<string | null>(null);

function buildUsersUrl(restaurantId: string | number | null | undefined) {
  if (!restaurantId) return "/users";

  const params = new URLSearchParams({
    restaurantId: String(restaurantId),
  });

  return `/users?${params.toString()}`;
}

export function useEmployeeList() {
  const authStore = useAuthStore();

  // In-flight fetch promise for deduplication
  let fetchUsersPromise: Promise<void> | null = null;

  // Lookup maps
  const clockedInMap = computed(() => {
    const map = new Map<
      number,
      { isClockedIn: boolean; clockInTime?: string; scheduleId?: number }
    >();
    for (const schedule of clockedInList.value) {
      map.set(schedule.employeeId, {
        isClockedIn: true,
        clockInTime: schedule.clockInTime || undefined,
        scheduleId: schedule.id,
      });
    }
    return map;
  });

  const onLeaveMap = computed(() => {
    const map = new Map<
      number,
      { isOnLeave: boolean; leaveType?: string; endDate?: string }
    >();
    for (const req of todayLeaveRequests.value) {
      map.set(req.employeeId, {
        isOnLeave: true,
        leaveType: req.leaveTypeName,
        endDate: req.endDate,
      });
    }
    return map;
  });

  // Enhanced users with status
  const usersWithStatus = computed<EmployeeWithStatus[]>(() => {
    return users.value.map((u) => ({
      ...u,
      clockInStatus: clockedInMap.value.get(u.id) || { isClockedIn: false },
      leaveStatus: onLeaveMap.value.get(u.id) || { isOnLeave: false },
    }));
  });

  // Stats
  const stats = computed<EmployeeStats>(() => ({
    owner: users.value.filter((u) => u.role === 1).length,
    chef: users.value.filter((u) => u.role === 2).length,
    service: users.value.filter((u) => u.role === 3).length,
    cashier: users.value.filter((u) => u.role === 4).length,
    total: users.value.length,
    currentlyWorking: clockedInList.value.length,
    onLeaveToday: todayLeaveRequests.value.length,
  }));

  // Fetch methods (with deduplication — concurrent callers share the same in-flight request)
  const fetchUsers = () => {
    if (fetchUsersPromise) return fetchUsersPromise;
    fetchUsersPromise = (async () => {
      isLoading.value = true;
      error.value = null;
      try {
        const response = await api.get(buildUsersUrl(authStore.restaurantId));
        const payload = response.data?.success
          ? response.data.data
          : response.data;
        users.value = (Array.isArray(payload) ? payload : []).map((user) =>
          mapApiUser(user as ApiUser),
        );
      } catch (e: unknown) {
        error.value = resolveUserFacingError(e, t, {
          fallbackKey: "errors.loadUsersFailed",
        }).message;
        console.error("Failed to fetch users:", e);
      } finally {
        isLoading.value = false;
        fetchUsersPromise = null;
      }
    })();
    return fetchUsersPromise;
  };

  const fetchClockedIn = async () => {
    const restaurantId = authStore.restaurantId;
    if (!restaurantId) return;
    clockedInLoading.value = true;
    try {
      clockedInList.value =
        await schedulingService.getClockedInEmployees(restaurantId);
    } catch (e) {
      console.error("Failed to fetch clocked-in employees:", e);
    } finally {
      clockedInLoading.value = false;
    }
  };

  const fetchTodayLeaves = async () => {
    const restaurantId = authStore.restaurantId;
    if (!restaurantId) return;
    leaveLoading.value = true;
    try {
      const today = new Date().toISOString().split("T")[0];
      const response = await api.get(`/leaves/${restaurantId}/requests`, {
        status: "approved",
        startDate: today,
        endDate: today,
      });
      const data = response.data?.data || response.data || [];
      todayLeaveRequests.value = (Array.isArray(data) ? data : []).map(
        (r: any) => ({
          employeeId: r.employeeId,
          leaveTypeName: r.leaveType?.name || r.leaveTypeName || "Leave",
          endDate: r.endDate,
        }),
      );
    } catch (e) {
      console.error("Failed to fetch today leaves:", e);
    } finally {
      leaveLoading.value = false;
    }
  };

  const fetchAll = async () => {
    await fetchUsers();
    // Fire-and-forget for secondary data
    fetchClockedIn();
    fetchTodayLeaves();
  };

  // CRUD
  const createUser = async (form: EmployeeFormData) => {
    await api.post("/users", {
      username: form.username,
      password: form.password,
      fullName: form.fullName,
      email: form.email,
      role: form.role,
    });
    await fetchUsers();
    // Initialize leave balances for new employee (non-blocking)
    try {
      const year = new Date().getFullYear();
      await api.post(`/leaves/${authStore.restaurantId}/balances/accrue`, {
        year,
      });
    } catch {
      /* non-blocking */
    }
  };

  const updateUser = async (id: number, form: EmployeeFormData) => {
    await api.put(`/users/${id}`, {
      fullName: form.fullName,
      email: form.email,
      role: form.role,
    });
    await fetchUsers();
  };

  const toggleUserStatus = async (user: Employee) => {
    const newIsActive = user.status !== "active";
    await api.patch(`/users/${user.id}/status`, { isActive: newIsActive });
    await fetchUsers();
  };

  const resetPassword = async (userId: number) => {
    const tempPassword = `Reset${Date.now().toString(36)}!`;
    await api.post(`/users/${userId}/reset-password`, {
      newPassword: tempPassword,
      confirmPassword: tempPassword,
    });
  };

  return {
    // State
    users,
    usersWithStatus,
    stats,
    clockedInList,
    isLoading,
    clockedInLoading,
    leaveLoading,
    error,

    // Methods
    fetchAll,
    fetchUsers,
    fetchClockedIn,
    fetchTodayLeaves,
    createUser,
    updateUser,
    toggleUserStatus,
    resetPassword,
  };
}
