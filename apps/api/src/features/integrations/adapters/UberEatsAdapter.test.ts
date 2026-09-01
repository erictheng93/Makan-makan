import { beforeEach, describe, expect, it, vi } from "vitest";
import { UberEatsAdapter } from "./UberEatsAdapter";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json", ...init.headers },
  });
}

function textResponse(body: string, init: ResponseInit = {}) {
  const status = init.status ?? 200;
  const responseBody = [204, 205, 304].includes(status) ? null : body;
  return new Response(responseBody, { status, headers: init.headers });
}

async function hmacSha256Hex(secret: string, body: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function createAdapter() {
  return new UberEatsAdapter();
}

describe("UberEatsAdapter", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("verifies Uber webhook HMAC signatures", async () => {
    const body = JSON.stringify({ id: "order-1" });
    const signature = await hmacSha256Hex("secret", body);
    const validRequest = new Request("https://example.test/webhook", {
      method: "POST",
      headers: { "X-Uber-Signature": signature },
      body,
    });
    const invalidRequest = new Request("https://example.test/webhook", {
      method: "POST",
      headers: { "X-Uber-Signature": "bad" },
      body,
    });
    const missingRequest = new Request("https://example.test/webhook", {
      method: "POST",
      body,
    });

    await expect(
      createAdapter().verifyWebhook(validRequest, "secret"),
    ).resolves.toBe(true);
    await expect(
      createAdapter().verifyWebhook(invalidRequest, "secret"),
    ).resolves.toBe(false);
    await expect(
      createAdapter().verifyWebhook(missingRequest, "secret"),
    ).resolves.toBe(false);
  });

  it("parses Uber order payloads with item totals, modifiers, and defaults", async () => {
    const payload = {
      id: "uber-order-1",
      store: { id: "store-1" },
      eater: { first_name: "Mina", phone: "0912345678" },
      delivery_info: { location: { address: "1 Main Street" } },
      cart: {
        items: [
          {
            id: "item-1",
            title: "Laksa",
            quantity: 2,
            price: { unit_price: { amount: 12.5 } },
            selected_modifier_groups: [
              {
                items: [
                  {
                    title: "Extra egg",
                    price: { unit_price: { amount: 1.5 } },
                  },
                ],
              },
            ],
          },
          {
            title: undefined,
            price: undefined,
          },
        ],
      },
      payment: {
        charges: {
          total: { amount: 30 },
          sub_total: { amount: 25 },
          tax: { amount: 5 },
        },
      },
    };

    await expect(createAdapter().parseOrder(payload)).resolves.toEqual({
      platformOrderId: "uber-order-1",
      platformStoreId: "store-1",
      customerName: "Mina",
      customerPhone: "0912345678",
      deliveryAddress: "1 Main Street",
      totalAmount: 30,
      subtotal: 25,
      taxAmount: 5,
      platformStatus: "received",
      rawPayload: payload,
      items: [
        {
          platformItemId: "item-1",
          name: "Laksa",
          quantity: 2,
          unitPrice: 12.5,
          totalPrice: 25,
          customizations: [
            {
              name: "Extra egg",
              value: "Extra egg",
              priceAdjustment: 1.5,
            },
          ],
        },
        {
          platformItemId: "",
          name: "",
          quantity: 1,
          unitPrice: 0,
          totalPrice: 0,
          customizations: [],
        },
      ],
    });
  });

  it("parses cancellation notifications without treating them as carts", async () => {
    await expect(
      createAdapter().parseCancellation({
        order: { id: "uber-order-cancelled" },
        reason: "customer_cancelled",
      }),
    ).resolves.toEqual({
      platformOrderId: "uber-order-cancelled",
      reason: "customer_cancelled",
    });
  });

  it("rejects cancellation notifications without a string order id", async () => {
    await expect(
      createAdapter().parseCancellation({ order_id: 42 }),
    ).rejects.toThrow("missing an order id");
  });

  it("refreshes access tokens and reports token refresh failures", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "token-1", expires_in: 600 }),
      )
      .mockResolvedValueOnce(textResponse("bad credentials", { status: 401 }));
    vi.spyOn(Date, "now").mockReturnValue(1710000000000);

    await expect(
      createAdapter().refreshToken({
        clientId: "client-1",
        clientSecret: "secret-1",
      }),
    ).resolves.toMatchObject({
      clientId: "client-1",
      clientSecret: "secret-1",
      accessToken: "token-1",
      tokenExpiresAt: 1710000600000,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://login.uber.com/oauth/v2/token",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: expect.any(URLSearchParams),
      }),
    );

    await expect(
      createAdapter().refreshToken({
        clientId: "client-1",
        clientSecret: "bad",
      }),
    ).rejects.toThrow("Uber Eats token refresh failed (401): bad credentials");
  });

  it("sends order action requests with existing valid tokens and surfaces API errors", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(textResponse("", { status: 204 }))
      .mockResolvedValueOnce(textResponse("", { status: 204 }))
      .mockResolvedValueOnce(textResponse("", { status: 204 }))
      .mockResolvedValueOnce(textResponse("denied", { status: 409 }));
    vi.spyOn(Date, "now").mockReturnValue(1710000000000);
    const creds = {
      accessToken: "token-1",
      tokenExpiresAt: 1710001000000,
    };

    await createAdapter().acceptOrder("order-1", creds);
    await createAdapter().denyOrder("order-2", "out of stock", creds);
    await createAdapter().cancelOrder("order-3", "closed", creds);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.uber.com/v2/eats/orders/order-1/accept_pos_order",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token-1",
        }),
        body: JSON.stringify({ reason: "accepted" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.uber.com/v2/eats/orders/order-2/deny_pos_order",
      expect.objectContaining({
        body: JSON.stringify({ reason: { explanation: "out of stock" } }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.uber.com/v2/eats/orders/order-3/cancel",
      expect.objectContaining({
        body: JSON.stringify({
          reason: "closed",
          cancelling_party: "MERCHANT",
        }),
      }),
    );
    await expect(
      createAdapter().denyOrder("order-4", "duplicate", creds),
    ).rejects.toThrow("Failed to deny Uber Eats order order-4 (409): denied");
  });

  it("refreshes expired tokens before order actions", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({ access_token: "fresh", expires_in: 600 }),
      )
      .mockResolvedValueOnce(textResponse("", { status: 204 }));
    vi.spyOn(Date, "now").mockReturnValue(1710000000000);

    await createAdapter().acceptOrder("order-1", {
      clientId: "client-1",
      clientSecret: "secret-1",
      accessToken: "old",
      tokenExpiresAt: 1710000000000,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.uber.com/v2/eats/orders/order-1/accept_pos_order",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer fresh" }),
      }),
    );
  });

  it("syncs menus, maps returned platform item ids, and requires a store id", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        menus: [
          {
            categories: [
              {
                items: [
                  { id: "platform-101", external_id: "101" },
                  { id: "platform-102" },
                ],
              },
            ],
          },
        ],
      }),
    );
    vi.spyOn(Date, "now").mockReturnValue(1710000000000);

    await expect(
      createAdapter().syncMenu({ menus: [] } as never, {
        storeId: "store-1",
        accessToken: "token-1",
        tokenExpiresAt: 1710001000000,
      }),
    ).resolves.toEqual({
      success: true,
      syncedItems: 1,
      platformItemIds: { 101: "platform-101" },
    });

    await expect(
      createAdapter().syncMenu({ menus: [] } as never, {
        accessToken: "token-1",
        tokenExpiresAt: 1710001000000,
      }),
    ).rejects.toThrow("storeId is required for menu sync");
  });

  it("reports menu sync API failures", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      textResponse("invalid menu", { status: 400 }),
    );
    vi.spyOn(Date, "now").mockReturnValue(1710000000000);

    await expect(
      createAdapter().syncMenu({ menus: [] } as never, {
        storeId: "store-1",
        accessToken: "token-1",
        tokenExpiresAt: 1710001000000,
      }),
    ).rejects.toThrow("Menu sync to Uber Eats failed (400): invalid menu");
  });
});
