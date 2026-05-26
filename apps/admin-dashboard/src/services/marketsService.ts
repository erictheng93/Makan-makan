import { api, unwrapApiPayload } from "@/services/api";
import type { MarketPublicReadiness } from "@/utils/marketPublicReadiness";

export interface MarketCatalogGapVendor {
  restaurantId: string;
  name: string;
  stallNumber?: string | null;
}

export interface MarketCatalogCoverage {
  searchableProductCount: number;
  publicServiceCount: number;
  vendorsWithSearchableProducts?: number;
  vendorsMissingSearchableProducts?: number;
  vendorsWithPublicServices?: number;
  vendorsMissingPublicServices?: number;
  missingProductVendors?: MarketCatalogGapVendor[];
  missingServiceVendors?: MarketCatalogGapVendor[];
}

export interface MarketListItem {
  id: string;
  slug: string;
  name: string;
  type: string;
  description?: string | null;
  city: string;
  district: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  openingHours?: Record<string, unknown> | null;
  bannerUrl?: string | null;
  logoUrl?: string | null;
  imageUrls?: string[] | null;
  tags?: string[] | null;
  vendorCount?: number;
  catalogCoverage?: MarketCatalogCoverage;
  publicReadiness?: MarketPublicReadiness;
}

export interface UpdateMarketPublicProfileInput {
  description: string | null;
  address: string;
  latitude: number;
  longitude: number;
  openingHours: Record<string, unknown> | null;
  bannerUrl: string | null;
  logoUrl: string | null;
  imageUrls: string[] | null;
  tags: string[] | null;
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
  resolvedAt?: string | number | Date | null;
  market: {
    id: string;
    slug: string;
    name: string;
    type: string;
    city: string;
    district: string;
  };
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

  async listPlatformReadiness(): Promise<MarketListItem[]> {
    const response = await api.get<{
      markets: MarketListItem[];
      total: number;
      page: number;
      limit: number;
    }>("/admin/markets/readiness");
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

  async listJoinRequests(restaurantId: string): Promise<MarketJoinRequest[]> {
    const response = await api.get<{
      requests: MarketJoinRequest[];
    }>(`/restaurants/${restaurantId}/market-join-requests`);
    return unwrapApiPayload<{ requests: MarketJoinRequest[] }>(response.data)
      .requests;
  },

  async updateMarketPublicProfile(
    marketId: string,
    input: UpdateMarketPublicProfileInput,
  ): Promise<MarketListItem> {
    const response = await api.put<{ market: MarketListItem }>(
      `/admin/markets/${marketId}`,
      input,
    );
    return unwrapApiPayload<{ market: MarketListItem }>(response.data).market;
  },
};
