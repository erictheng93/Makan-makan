import { apiClient } from "./api";
import type { RestaurantServiceItem } from "@makanmakan/shared-types";

export interface MessagingChannels {
  line?: string;
  whatsapp?: string;
  instagram?: string;
  telegram?: string;
}

export interface RestaurantFaq {
  id: number;
  question: string;
  answer: string;
  keywords: string[];
  displayOrder: number;
  isActive: boolean;
}

export interface RestaurantContactProfile {
  restaurantId: string;
  messagingChannels: MessagingChannels;
  faqs: RestaurantFaq[];
}

export const restaurantContactApi = {
  async getContactProfile(restaurantId: string) {
    return apiClient.get<RestaurantContactProfile>(
      `/restaurants/${restaurantId}/contact-profile`,
    );
  },

  async listServiceItems(restaurantId: string) {
    return apiClient.get<RestaurantServiceItem[]>(
      `/restaurants/${restaurantId}/service-items`,
    );
  },
};
