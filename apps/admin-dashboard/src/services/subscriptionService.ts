/**
 * Subscription Service
 * API client for platform subscription management (admin only)
 */

import { api } from "@/services/api";

export interface Subscription {
  id: string;
  restaurantId: string;
  planTier: "trial" | "basic" | "pro" | "enterprise";
  moduleOverrides: Record<string, boolean>;
  isActive: boolean;
  trialEndsAt: string | null;
  billingCycleStartAt: string | null;
  billingCycleEndAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  effectiveModules: Record<string, boolean>;
}

export type PlanTier = Subscription["planTier"];

class SubscriptionService {
  private api: typeof api;

  constructor() {
    this.api = api;
  }

  /**
   * Get all subscriptions (admin only)
   */
  async getAll(): Promise<Subscription[]> {
    const response = await this.api.get<Subscription[]>("/admin/subscriptions");
    return response.data.data ?? [];
  }

  /**
   * Get subscription for a specific restaurant
   */
  async getByRestaurantId(restaurantId: string): Promise<Subscription> {
    const response = await this.api.get<Subscription>(
      `/admin/subscriptions/${restaurantId}`,
    );
    return response.data.data!;
  }

  /**
   * Create a new subscription
   */
  async create(data: {
    restaurantId: string;
    planTier: PlanTier;
    trialEndsAt?: string | null;
    notes?: string | null;
  }): Promise<Subscription> {
    const response = await this.api.post<Subscription>(
      "/admin/subscriptions",
      data,
    );
    return response.data.data!;
  }

  /**
   * Update module overrides for a subscription
   */
  async updateModules(
    restaurantId: string,
    overrides: Record<string, boolean>,
  ): Promise<Subscription> {
    const response = await this.api.patch<Subscription>(
      `/admin/subscriptions/${restaurantId}/modules`,
      { overrides },
    );
    return response.data.data!;
  }

  /**
   * Change plan tier for a subscription
   */
  async changePlan(
    restaurantId: string,
    planTier: PlanTier,
  ): Promise<Subscription> {
    const response = await this.api.patch<Subscription>(
      `/admin/subscriptions/${restaurantId}/plan`,
      { planTier },
    );
    return response.data.data!;
  }

  /**
   * Activate or deactivate a subscription (kill switch)
   */
  async setActive(
    restaurantId: string,
    isActive: boolean,
  ): Promise<Subscription> {
    const response = await this.api.patch<Subscription>(
      `/admin/subscriptions/${restaurantId}/status`,
      { isActive },
    );
    return response.data.data!;
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService();
export default subscriptionService;
