import type { BaseEntity } from "./common";

export type RestaurantServiceType =
  | "general"
  | "booking"
  | "pickup"
  | "delivery"
  | "consultation"
  | "rental"
  | "activity";

export interface RestaurantServiceItem extends BaseEntity {
  restaurantId: string;
  name: string;
  description?: string;
  serviceType: RestaurantServiceType;
  priceCents?: number;
  priceLabel?: string;
  durationMinutes?: number;
  requiresBooking: boolean;
  bookingUrl?: string;
  availableHours?: {
    start?: string;
    end?: string;
    days?: number[];
  };
  tags?: string[];
  keywords?: string;
  sortOrder: number;
  isActive: boolean;
  isPublic: boolean;
  deletedAt?: string;
}

export interface CreateRestaurantServiceItemRequest {
  restaurantId: string;
  name: string;
  description?: string;
  serviceType?: RestaurantServiceType;
  priceCents?: number;
  priceLabel?: string;
  durationMinutes?: number;
  requiresBooking?: boolean;
  bookingUrl?: string;
  availableHours?: RestaurantServiceItem["availableHours"];
  tags?: string[];
  keywords?: string;
  sortOrder?: number;
  isActive?: boolean;
  isPublic?: boolean;
}

export interface UpdateRestaurantServiceItemRequest extends Partial<CreateRestaurantServiceItemRequest> {}
