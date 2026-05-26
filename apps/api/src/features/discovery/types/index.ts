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
  detailUrl: string;
  menuUrl: string;
  menuItemUrl: string;
  serviceItemsUrl: string;
}

export interface RestaurantListItem {
  restaurantId: string;
  name: string;
  type: string | null;
  category: string | null;
  district: string | null;
  city: string | null;
  priceRange: number | null;
  rating: number | null;
  isOpen: boolean;
  supportsTakeaway: boolean;
  supportsDelivery: boolean;
  imageUrl: string | null;
}

export interface ServiceSearchResult {
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
  detailUrl: string;
  menuUrl: string;
  serviceItemsUrl: string;
}

export interface SearchFilters {
  q?: string;
  district?: string;
  city?: string;
  categoryName?: string;
  marketId?: string;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  priceMin?: number;
  priceMax?: number;
  openNow?: boolean;
  takeaway?: boolean;
  delivery?: boolean;
  serviceType?:
    | "general"
    | "booking"
    | "pickup"
    | "delivery"
    | "consultation"
    | "rental"
    | "activity";
  cuisineType?: string;
  priceRange?: number;
  sortBy?: "rating" | "popular" | "price_asc" | "price_desc";
  page?: number;
  limit?: number;
}

export interface SearchResponse<T> {
  results: T[];
  total: number;
  page: number;
  limit: number;
}

export interface BusinessHours {
  [day: string]: {
    open: string;
    close: string;
    closed?: boolean;
  };
}
