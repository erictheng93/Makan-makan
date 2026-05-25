import { api, unwrapApiPayload } from "@/services/api";

export interface MarketListItem {
  id: string;
  slug: string;
  name: string;
  type: string;
  city: string;
  district: string;
  vendorCount?: number;
}

export interface RestaurantMarketMembership {
  id: number;
  restaurantId: string;
  marketId: string;
  stallNumber?: string | null;
  isPrimary: boolean;
  joinedAt: string | number | Date;
  market: {
    id: string;
    slug: string;
    name: string;
    type: string;
    city: string;
    district: string;
  };
}

export interface MarketJoinRequest {
  id: number;
  restaurantId: string;
  marketId: string;
  status: "pending" | "approved" | "rejected";
  message?: string | null;
  requestedAt: string | number | Date;
}

export const marketsService = {
  async listMarkets(): Promise<MarketListItem[]> {
    const response = await api.get<{
      markets: MarketListItem[];
      total: number;
      page: number;
      limit: number;
    }>("/markets", { limit: 100 });
    return unwrapApiPayload<{ markets: MarketListItem[] }>(response.data)
      .markets;
  },

  async listRestaurantMemberships(
    restaurantId: string,
  ): Promise<RestaurantMarketMembership[]> {
    const response = await api.get<{
      memberships: RestaurantMarketMembership[];
    }>(`/restaurants/${restaurantId}/markets`);
    return unwrapApiPayload<{ memberships: RestaurantMarketMembership[] }>(
      response.data,
    ).memberships;
  },

  async requestJoin(
    restaurantId: string,
    input: { marketId: string; message?: string | null },
  ): Promise<MarketJoinRequest> {
    const response = await api.post<{ request: MarketJoinRequest }>(
      `/restaurants/${restaurantId}/market-join-requests`,
      input,
    );
    return unwrapApiPayload<{ request: MarketJoinRequest }>(response.data)
      .request;
  },
};
