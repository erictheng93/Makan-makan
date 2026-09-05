/**
 * Scheduling calls the kitchen display needs for the employee-facing shift
 * swap entry (#320).
 *
 * Only the four endpoints a chef can legitimately reach. Every one of them is
 * scoped server-side to the session user: `GET /schedules` and
 * `GET /swap-requests` overwrite the employee filter with the caller's own id
 * for non-managers, and `POST /swap-requests` binds `requesterEmployeeId` to
 * the session (#99). So there is no employee id to pass — and nothing here
 * would be honoured if there were.
 *
 * Unlike `kitchenApi`, these throw. The caller renders the failure through
 * `resolveUserFacingError`, which needs the axios error to tell a 403 (module
 * disabled) from a 401 (session lapsed) from a network drop.
 */
import api from "./authApi";

export interface MyShift {
  id: number;
  workDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  status: "scheduled" | "confirmed" | "completed" | "cancelled" | "no_show";
}

export type SwapRequestType = "swap" | "cover" | "drop";
export type SwapUrgency = "low" | "normal" | "high" | "urgent";

export interface MySwapRequest {
  id: number;
  requesterScheduleId: number;
  requestType: SwapRequestType;
  reason: string;
  urgency: SwapUrgency;
  status:
    | "pending"
    | "accepted"
    | "approved"
    | "rejected"
    | "cancelled"
    | "expired";
  rejectionReason: string | null;
}

export interface CreateSwapRequestInput {
  requesterScheduleId: number;
  requestType: SwapRequestType;
  urgency: SwapUrgency;
  reason: string;
  isOpenRequest: boolean;
}

/** These routes answer `{ success, data: [...], pagination }`. */
function unwrapList<T>(payload: unknown): T[] {
  const data =
    typeof payload === "object" && payload !== null && "data" in payload
      ? (payload as { data: unknown }).data
      : payload;
  return Array.isArray(data) ? (data as T[]) : [];
}

export const schedulingApi = {
  async getMyShifts(
    restaurantId: string,
    startDate: string,
    endDate: string,
  ): Promise<MyShift[]> {
    const response = await api.get(`/scheduling/${restaurantId}/schedules`, {
      params: { startDate, endDate, limit: 100 },
    });
    return unwrapList<MyShift>(response.data);
  },

  async getMySwapRequests(restaurantId: string): Promise<MySwapRequest[]> {
    const response = await api.get(
      `/scheduling/${restaurantId}/swap-requests`,
      { params: { limit: 50 } },
    );
    return unwrapList<MySwapRequest>(response.data);
  },

  async createSwapRequest(
    restaurantId: string,
    input: CreateSwapRequestInput,
  ): Promise<void> {
    await api.post(`/scheduling/${restaurantId}/swap-requests`, input);
  },

  async cancelSwapRequest(id: number): Promise<void> {
    await api.post(`/scheduling/swap-requests/${id}/cancel`);
  },
};

export default schedulingApi;
