import { api, unwrapApiPayload } from "@/services/api";

export interface DiscoveryReindexResult {
  dishes: number;
  restaurants: number;
  duration_ms: number;
}

export interface DiscoveryIndexStatus {
  version: string;
  lastReindexedAt: string | null;
  indexedDishCount: number;
  availableDishCount: number;
  indexedRestaurantCount: number;
  sourceAvailableDishCount: number;
  unindexedAvailableDishCount: number;
  restaurantsWithUnindexedAvailableDishes: number;
}

export const discoveryService = {
  async reindex(): Promise<DiscoveryReindexResult> {
    const response =
      await api.post<DiscoveryReindexResult>("/discovery/reindex");
    return unwrapApiPayload<DiscoveryReindexResult>(response.data);
  },

  async getIndexStatus(): Promise<DiscoveryIndexStatus> {
    const response = await api.get<DiscoveryIndexStatus>(
      "/discovery/index-status",
    );
    return unwrapApiPayload<DiscoveryIndexStatus>(response.data);
  },
};
