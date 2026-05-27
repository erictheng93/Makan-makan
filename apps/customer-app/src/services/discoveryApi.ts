import { apiClient } from "./api";

export interface DishSearchResult {
  resultType?: "menu_item";
  menuItemId: number;
  dishName: string;
  price: number;
  categoryName: string | null;
  restaurantId: string;
  restaurantName: string;
  district: string | null;
  isOpen: boolean;
  supportsTakeaway: boolean;
  supportsDelivery: boolean;
  tags: string[];
  marketVendor?: {
    marketId: string;
    stallNumber: string | null;
    isPrimary: boolean;
  } | null;
}

export interface RestaurantListItem {
  restaurantId: string;
  name: string;
  type: string | null;
  district: string | null;
  priceRange: number | null;
  rating: number | null;
  isOpen: boolean;
  supportsTakeaway: boolean;
  supportsDelivery: boolean;
  imageUrl: string | null;
}

export interface ServiceSearchResult {
  resultType?: "service";
  serviceItemId: number;
  name: string;
  description: string | null;
  serviceType: string;
  priceCents: number | null;
  priceLabel: string | null;
  durationMinutes: number | null;
  requiresBooking: boolean;
  bookingUrl: string | null;
  tags: string[];
  restaurantId: string;
  restaurantName: string;
  district: string | null;
  city: string | null;
  isOpen: boolean;
  marketVendor?: {
    marketId: string;
    stallNumber: string | null;
    isPrimary: boolean;
  } | null;
}

export interface ServiceTypeFacet {
  serviceType: NonNullable<SearchFilters["serviceType"]>;
  count: number;
}

export interface RestaurantMarketMembership {
  marketId: string;
  stallNumber: string | null;
  isPrimary: boolean;
  market: {
    id: string;
    slug: string;
    name: string;
    type: string;
    city: string;
    district: string;
  };
  marketUrl: string;
}

export interface SearchFilters {
  q?: string;
  city?: string;
  district?: string;
  categoryName?: string;
  marketId?: string;
  marketSlug?: string;
  serviceType?:
    | "general"
    | "booking"
    | "pickup"
    | "delivery"
    | "consultation"
    | "rental"
    | "activity";
  lat?: number;
  lng?: number;
  radiusKm?: number;
  priceMin?: number;
  priceMax?: number;
  openNow?: boolean;
  takeaway?: boolean;
  delivery?: boolean;
  sortBy?: "price_asc" | "price_desc" | "popular";
  page?: number;
  limit?: number;
}

export const discoveryApi = {
  async searchDishes(filters: SearchFilters) {
    return apiClient.get<{ results: DishSearchResult[]; total: number }>(
      "/discovery/search",
      filters,
    );
  },

  async browseRestaurants(filters: SearchFilters) {
    return apiClient.get<{ results: RestaurantListItem[]; total: number }>(
      "/discovery/restaurants",
      filters,
    );
  },

  async searchServices(filters: SearchFilters) {
    return apiClient.get<{ results: ServiceSearchResult[]; total: number }>(
      "/discovery/services",
      filters,
    );
  },

  async listCategories(filters: SearchFilters = {}) {
    return apiClient.get<{ categories: string[] }>(
      "/discovery/categories",
      filters,
    );
  },

  async listServiceTypes(filters: SearchFilters = {}) {
    return apiClient.get<{ serviceTypes: ServiceTypeFacet[] }>(
      "/discovery/service-types",
      filters,
    );
  },

  async getRestaurantMenu(restaurantId: string) {
    return apiClient.get<any[]>(`/discovery/restaurants/${restaurantId}/menu`);
  },

  async getTakeawayEligibility(restaurantId: string) {
    return apiClient.get<
      | { eligible: true; shopQrCode: string }
      | {
          eligible: false;
          reason: "restaurant_disabled" | "takeaway_disabled" | "closed_now";
        }
    >(`/discovery/restaurants/${restaurantId}/takeaway-eligibility`);
  },

  async getRestaurantMarkets(restaurantId: string) {
    return apiClient.get<{ memberships: RestaurantMarketMembership[] }>(
      `/discovery/restaurants/${restaurantId}/markets`,
    );
  },

  async getPopular() {
    return apiClient.get<{
      keywords: string[];
      dishes: DishSearchResult[];
      restaurants: RestaurantListItem[];
    }>("/discovery/popular");
  },
};
