import { apiClient } from "./api";
import type {
  JoinWaitingListRequest,
  QueueStatus,
  WaitingListResponse,
  WaitTimeEstimateResult,
} from "@makanmasak/shared-types";

const BASE_URL = "/waiting-list";

export const waitingListApi = {
  async join(data: JoinWaitingListRequest): Promise<WaitingListResponse> {
    const response = await apiClient.post<WaitingListResponse>(BASE_URL, data);
    return response;
  },

  async lookup(
    restaurantId: string,
    phone: string,
  ): Promise<WaitingListResponse> {
    const queryParams = new URLSearchParams({
      restaurantId,
      phone,
    });
    const response = await apiClient.get<WaitingListResponse>(
      `${BASE_URL}/lookup?${queryParams.toString()}`,
    );
    return response;
  },

  async history(
    restaurantId: string,
    phone: string,
  ): Promise<WaitingListResponse[]> {
    const queryParams = new URLSearchParams({
      restaurantId,
      phone,
      limit: "20",
    });
    const response = await apiClient.get<WaitingListResponse[]>(
      `${BASE_URL}/history?${queryParams.toString()}`,
    );
    return response;
  },

  async getById(id: string): Promise<WaitingListResponse> {
    const response = await apiClient.get<WaitingListResponse>(
      `${BASE_URL}/${id}`,
    );
    return response;
  },

  async getQueueStatus(restaurantId: string): Promise<QueueStatus> {
    const response = await apiClient.get<QueueStatus>(
      `${BASE_URL}/queue-status/${restaurantId}`,
    );
    return response;
  },

  async estimateWait(
    restaurantId: string,
    partySize: number,
  ): Promise<WaitTimeEstimateResult> {
    const queryParams = new URLSearchParams({
      partySize: partySize.toString(),
    });
    const response = await apiClient.get<WaitTimeEstimateResult>(
      `${BASE_URL}/estimate-wait/${restaurantId}?${queryParams.toString()}`,
    );
    return response;
  },

  async cancel(
    id: string,
    customerPhone: string,
  ): Promise<WaitingListResponse> {
    const response = await apiClient.request<WaitingListResponse>({
      method: "DELETE",
      url: `${BASE_URL}/${id}`,
      data: { customerPhone },
    });
    return response;
  },

  async confirmArrival(
    id: string,
    customerPhone: string,
  ): Promise<WaitingListResponse> {
    const response = await apiClient.post<WaitingListResponse>(
      `${BASE_URL}/${id}/confirm`,
      { customerPhone },
    );
    return response;
  },
};

export default waitingListApi;
