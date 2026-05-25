import { apiClient } from "./api";

export interface DishSearchResult {
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

export interface SearchFilters {
  q?: string;
  district?: string;
  marketId?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  priceMin?: number;
  priceMax?: number;
  openNow?: boolean;
  takeaway?: boolean;
  delivery?: boolean;
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

  async getPopular() {
    return apiClient.get<{
      keywords: string[];
      dishes: DishSearchResult[];
      restaurants: RestaurantListItem[];
    }>("/discovery/popular");
  },
};
