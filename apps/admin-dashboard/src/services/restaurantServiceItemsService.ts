import { api, unwrapApiPayload } from "@/services/api";
import type {
  CreateRestaurantServiceItemRequest,
  RestaurantServiceItem,
  UpdateRestaurantServiceItemRequest,
} from "@makanmasak/shared-types";

export type ServiceItemFormInput = Omit<
  CreateRestaurantServiceItemRequest,
  "restaurantId"
>;

export const restaurantServiceItemsService = {
  async list(restaurantId: string): Promise<RestaurantServiceItem[]> {
    const response = await api.get<RestaurantServiceItem[]>(
      `/restaurants/${restaurantId}/service-items`,
    );
    return unwrapApiPayload<RestaurantServiceItem[]>(response.data);
  },

  async create(
    restaurantId: string,
    input: ServiceItemFormInput,
  ): Promise<RestaurantServiceItem> {
    const response = await api.post<RestaurantServiceItem>(
      `/restaurants/${restaurantId}/service-items`,
      input,
    );
    return unwrapApiPayload<RestaurantServiceItem>(response.data);
  },

  async update(
    restaurantId: string,
    serviceItemId: number,
    input: UpdateRestaurantServiceItemRequest,
  ): Promise<RestaurantServiceItem> {
    const response = await api.put<RestaurantServiceItem>(
      `/restaurants/${restaurantId}/service-items/${serviceItemId}`,
      input,
    );
    return unwrapApiPayload<RestaurantServiceItem>(response.data);
  },

  async remove(restaurantId: string, serviceItemId: number): Promise<void> {
    await api.delete(
      `/restaurants/${restaurantId}/service-items/${serviceItemId}`,
    );
  },
};
