import { apiClient } from "./api";
import type { RestaurantListItem } from "./discoveryApi";

export type MarketGeoJsonBoundary =
  | {
      type: "Polygon";
      coordinates: number[][][];
    }
  | {
      type: "MultiPolygon";
      coordinates: number[][][][];
    };

export interface MarketListItem {
  id: string;
  slug: string;
  name: string;
  type: string;
  description: string | null;
  city: string;
  district: string;
  address: string;
  latitude: number;
  longitude: number;
  boundaryGeojson?: MarketGeoJsonBoundary | null;
  openingHours?: Record<
    string,
    { open: string; close: string; closed?: boolean }
  > | null;
  bannerUrl: string | null;
  logoUrl: string | null;
  imageUrls?: string[] | null;
  tags: string[] | null;
  vendorCount: number;
  catalogCoverage?: {
    searchableProductCount: number;
    publicServiceCount: number;
  };
  publicReadiness?: MarketPublicReadiness;
}

export interface MarketDetail extends MarketListItem {
  openingHours?: Record<
    string,
    { open: string; close: string; closed?: boolean }
  > | null;
  imageUrls?: string[] | null;
}

export interface MarketPublicReadiness {
  ready: boolean;
  score: number;
  completedCount: number;
  totalCount: number;
  issues: Array<{
    key:
      | "description"
      | "location"
      | "openingHours"
      | "image"
      | "vendors"
      | "products"
      | "services";
    severity: "required" | "recommended";
  }>;
}

export interface MarketExplorationSummary {
  dishSearchUrl: string;
  serviceSearchUrl: string;
  dishCategories: Array<{
    categoryName: string;
    catalogType?: "menu_item" | "product";
    count: number;
    searchUrl: string;
  }>;
  menuItemCategories?: Array<{
    categoryName: string;
    catalogType: "menu_item";
    count: number;
    searchUrl: string;
  }>;
  productCategories?: Array<{
    categoryName: string;
    catalogType: "product";
    count: number;
    searchUrl: string;
  }>;
  serviceTypes: Array<{
    serviceType: string;
    count: number;
    searchUrl: string;
  }>;
}

export interface MarketVendor extends RestaurantListItem {
  stallNumber: string | null;
  isPrimary: boolean;
  detailUrl?: string;
  menuUrl?: string;
  serviceItemsUrl?: string;
  availableMenuItemCount: number;
  publicServiceItemCount: number;
}

export interface MarketArea {
  city: string;
  districts: string[];
}

export interface ListMarketsParams {
  q?: string;
  city?: string;
  district?: string;
  type?: string;
  page?: number;
  limit?: number;
}

export interface NearbyMarketsParams {
  lat: number;
  lng: number;
  radiusKm?: number;
  limit?: number;
}

export interface VendorFilters {
  openNow?: boolean;
  takeaway?: boolean;
  delivery?: boolean;
  q?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  sortBy?: "rating" | "popular" | "distance";
  page?: number;
  limit?: number;
}

export const marketsApi = {
  async listMarkets(params: ListMarketsParams = {}) {
    return apiClient.get<{
      markets: MarketListItem[];
      total: number;
      page: number;
      limit: number;
    }>("/markets", params);
  },

  async listAreas() {
    return apiClient.get<{
      areas: MarketArea[];
    }>("/markets/areas");
  },

  async getMarket(slug: string) {
    return apiClient.get<{
      market: MarketDetail;
      vendorCount: number;
      explorationSummary?: MarketExplorationSummary;
    }>(`/markets/${slug}`);
  },

  async listVendors(slug: string, params: VendorFilters = {}) {
    return apiClient.get<{
      vendors: MarketVendor[];
      total: number;
      page: number;
      limit: number;
    }>(`/markets/${slug}/vendors`, params);
  },

  async findNearby(params: NearbyMarketsParams) {
    return apiClient.get<{
      markets: Array<MarketListItem & { distanceKm: number }>;
    }>("/markets/nearby", params);
  },
};
