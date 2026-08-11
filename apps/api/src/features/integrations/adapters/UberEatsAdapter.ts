import type {
  PlatformType,
  PlatformCredentials,
  ParsedPlatformOrder,
  MenuSyncPayload,
  MenuSyncResult,
} from "@makanmasak/shared-types";
import type { PlatformAdapter } from "./PlatformAdapter";

const UBER_API_BASE = "https://api.uber.com";
const UBER_AUTH_URL = "https://login.uber.com/oauth/v2/token";

export class UberEatsAdapter implements PlatformAdapter {
  readonly platform: PlatformType = "uber_eats";

  async verifyWebhook(request: Request, secret: string): Promise<boolean> {
    const signature = request.headers.get("X-Uber-Signature");
    if (!signature) return false;

    const body = await request.clone().text();

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(body),
    );

    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return computedSignature === signature;
  }

  async refreshToken(
    credentials: PlatformCredentials,
  ): Promise<PlatformCredentials> {
    const response = await fetch(UBER_AUTH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: credentials.clientId ?? "",
        client_secret: credentials.clientSecret ?? "",
        scope: "eats.store eats.order eats.store.orders.read",
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Uber Eats token refresh failed (${response.status}): ${errorBody}`,
      );
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    return {
      ...credentials,
      accessToken: data.access_token,
      tokenExpiresAt: Date.now() + data.expires_in * 1000,
    };
  }

  async parseOrder(payload: unknown): Promise<ParsedPlatformOrder> {
    const order = payload as UberEatsOrderPayload;

    const items = (order.cart?.items ?? []).map((item) => {
      const quantity = item.quantity ?? 1;
      const unitPrice = item.price?.unit_price?.amount ?? 0;
      return {
        platformItemId: item.id ?? "",
        name: item.title ?? "",
        quantity,
        unitPrice,
        totalPrice: unitPrice * quantity,
        customizations: (item.selected_modifier_groups ?? []).flatMap((group) =>
          (group.items ?? []).map((mod) => ({
            name: mod.title ?? "",
            value: mod.title ?? "",
            priceAdjustment: mod.price?.unit_price?.amount ?? 0,
          })),
        ),
      };
    });

    return {
      platformOrderId: order.id,
      platformStoreId: order.store?.id ?? "",
      customerName: order.eater?.first_name ?? "Unknown",
      customerPhone: order.eater?.phone ?? "",
      deliveryAddress: order.delivery_info?.location?.address ?? "",
      items,
      totalAmount: order.payment?.charges?.total?.amount ?? 0,
      subtotal: order.payment?.charges?.sub_total?.amount ?? 0,
      taxAmount: order.payment?.charges?.tax?.amount ?? 0,
      platformStatus: "received",
      rawPayload: payload,
    };
  }

  async acceptOrder(
    platformOrderId: string,
    creds: PlatformCredentials,
  ): Promise<void> {
    const activeCreds = await this.ensureValidToken(creds);
    const response = await fetch(
      `${UBER_API_BASE}/v2/eats/orders/${platformOrderId}/accept_pos_order`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${activeCreds.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: "accepted" }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Failed to accept Uber Eats order ${platformOrderId} (${response.status}): ${errorBody}`,
      );
    }
  }

  async denyOrder(
    platformOrderId: string,
    reason: string,
    creds: PlatformCredentials,
  ): Promise<void> {
    const activeCreds = await this.ensureValidToken(creds);
    const response = await fetch(
      `${UBER_API_BASE}/v2/eats/orders/${platformOrderId}/deny_pos_order`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${activeCreds.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: { explanation: reason },
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Failed to deny Uber Eats order ${platformOrderId} (${response.status}): ${errorBody}`,
      );
    }
  }

  async cancelOrder(
    platformOrderId: string,
    reason: string,
    creds: PlatformCredentials,
  ): Promise<void> {
    const activeCreds = await this.ensureValidToken(creds);
    const response = await fetch(
      `${UBER_API_BASE}/v2/eats/orders/${platformOrderId}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${activeCreds.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: reason,
          cancelling_party: "MERCHANT",
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Failed to cancel Uber Eats order ${platformOrderId} (${response.status}): ${errorBody}`,
      );
    }
  }

  async syncMenu(
    menuData: MenuSyncPayload,
    creds: PlatformCredentials,
  ): Promise<MenuSyncResult> {
    const activeCreds = await this.ensureValidToken(creds);
    const storeId = creds.storeId;
    if (!storeId) {
      throw new Error("storeId is required for menu sync");
    }

    const response = await fetch(
      `${UBER_API_BASE}/v2/eats/stores/${storeId}/menus`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${activeCreds.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(menuData),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Menu sync to Uber Eats failed (${response.status}): ${errorBody}`,
      );
    }

    const result = (await response.json()) as {
      menus?: Array<{
        categories?: Array<{
          items?: Array<{
            id: string;
            external_id?: string;
          }>;
        }>;
      }>;
    };

    const platformItemIds: Record<number, string> = {};
    for (const menu of result.menus ?? []) {
      for (const category of menu.categories ?? []) {
        for (const item of category.items ?? []) {
          if (item.external_id) {
            platformItemIds[Number(item.external_id)] = item.id;
          }
        }
      }
    }

    return {
      success: true,
      syncedItems: Object.keys(platformItemIds).length,
      platformItemIds,
    };
  }

  private async ensureValidToken(
    creds: PlatformCredentials,
  ): Promise<PlatformCredentials> {
    if (creds.tokenExpiresAt && creds.tokenExpiresAt > Date.now() + 60_000) {
      return creds;
    }
    return this.refreshToken(creds);
  }
}

// --- Internal type for Uber Eats raw order payload ---

interface UberEatsOrderPayload {
  id: string;
  store?: { id: string };
  eater?: { first_name: string; phone: string };
  delivery_info?: { location?: { address: string } };
  cart?: {
    items: Array<{
      id?: string;
      title?: string;
      quantity?: number;
      price?: { unit_price?: { amount: number } };
      selected_modifier_groups?: Array<{
        items?: Array<{
          title?: string;
          price?: { unit_price?: { amount: number } };
        }>;
      }>;
    }>;
  };
  payment?: {
    charges?: {
      total?: { amount: number };
      sub_total?: { amount: number };
      tax?: { amount: number };
    };
  };
}
