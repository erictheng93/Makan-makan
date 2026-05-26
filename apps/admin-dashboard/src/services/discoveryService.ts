import { api, unwrapApiPayload } from "@/services/api";

export interface DiscoveryReindexResult {
  dishes: number;
  restaurants: number;
  duration_ms: number;
}

export const discoveryService = {
  async reindex(): Promise<DiscoveryReindexResult> {
    const response =
      await api.post<DiscoveryReindexResult>("/discovery/reindex");
    return unwrapApiPayload<DiscoveryReindexResult>(response.data);
  },
};
