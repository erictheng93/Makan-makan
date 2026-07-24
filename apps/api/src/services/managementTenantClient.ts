import type { Env } from "../types/env";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string | { message?: string; code?: string };
  code?: string;
}

interface TenantPayload {
  tenant: {
    id: string;
    platformRestaurantId?: string;
    ownerUserId?: string;
    ownerUsername?: string;
  };
}

export class ManagementTenantClient {
  constructor(private readonly env: Env) {}

  async provisionRestaurantTenant(input: {
    restaurantId: string;
    businessName: string;
    contactEmail: string;
    contactPhone?: string;
    planId?: "trial" | "standard" | "professional" | "enterprise";
  }) {
    return this.request<TenantPayload>(
      `/api/v1/internal/platform-restaurants/${encodeURIComponent(
        input.restaurantId,
      )}/tenant`,
      "POST",
      {
        businessName: input.businessName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        planId: input.planId ?? "trial",
      },
    );
  }

  async linkRestaurantOwner(input: {
    restaurantId: string;
    ownerUserId: string;
    ownerUsername: string;
  }) {
    return this.request<TenantPayload>(
      `/api/v1/internal/platform-restaurants/${encodeURIComponent(
        input.restaurantId,
      )}/owner`,
      "PATCH",
      {
        ownerUserId: input.ownerUserId,
        ownerUsername: input.ownerUsername,
      },
    );
  }

  private async request<T>(
    path: string,
    method: "POST" | "PATCH",
    body: Record<string, unknown>,
  ): Promise<T> {
    if (!this.env.MANAGEMENT_API) {
      throw new Error("MANAGEMENT_API service binding is not configured");
    }
    if (!this.env.INTERNAL_API_TOKEN) {
      throw new Error("INTERNAL_API_TOKEN is not configured");
    }

    const response = await this.env.MANAGEMENT_API.fetch(
      new Request(`https://management.internal${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Internal-API-Token": this.env.INTERNAL_API_TOKEN,
        },
        body: JSON.stringify(body),
      }),
    );
    const payload = (await response
      .json()
      .catch(() => null)) as ApiResponse<T> | null;

    if (!response.ok || !payload?.success || !payload.data) {
      // Nested unified error format first; flat-string fallback for legacy
      // workers. TODO(cleanup): drop the flat branch once every deployed
      // management-api is at or past commit 7151ca2c.
      const message =
        typeof payload?.error === "string"
          ? payload.error
          : payload?.error?.message ||
            payload?.code ||
            `Management API request failed with ${response.status}`;
      throw new Error(message);
    }

    return payload.data;
  }
}
