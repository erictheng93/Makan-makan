import { describe, it, expect, vi, afterEach } from "vitest";
import { UberEatsAdapter } from "../adapters/UberEatsAdapter";

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Compute a real HMAC-SHA256 hex string for a given secret + body,
 * matching exactly what UberEatsAdapter.verifyWebhook does.
 */
async function computeHmac(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function makeRequest(body: string, signature: string | null): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (signature !== null) {
    headers["X-Uber-Signature"] = signature;
  }
  return new Request("https://example.com/webhook", {
    method: "POST",
    headers,
    body,
  });
}

// ─── UberEatsAdapter — HMAC verification ──────────────────────────────────

describe("UberEatsAdapter — verifyWebhook", () => {
  const adapter = new UberEatsAdapter();
  const secret = "my-webhook-secret";
  const body = JSON.stringify({
    id: "order-abc",
    event_type: "orders.notification",
  });

  it("returns true for a valid signature", async () => {
    const sig = await computeHmac(secret, body);
    const req = makeRequest(body, sig);

    const result = await adapter.verifyWebhook(req, secret);

    expect(result).toBe(true);
  });

  it("returns false when X-Uber-Signature header is missing", async () => {
    const req = makeRequest(body, null);

    const result = await adapter.verifyWebhook(req, secret);

    expect(result).toBe(false);
  });

  it("returns false when the body has been tampered with", async () => {
    const sig = await computeHmac(secret, body);
    const tamperedBody = JSON.stringify({
      id: "order-abc",
      event_type: "orders.cancel",
    });
    const req = makeRequest(tamperedBody, sig);

    const result = await adapter.verifyWebhook(req, secret);

    expect(result).toBe(false);
  });

  it("returns false when the secret is wrong", async () => {
    const sig = await computeHmac("correct-secret", body);
    const req = makeRequest(body, sig);

    const result = await adapter.verifyWebhook(req, "wrong-secret");

    expect(result).toBe(false);
  });

  it("returns false when the signature header is an empty string", async () => {
    const req = makeRequest(body, "");

    const result = await adapter.verifyWebhook(req, secret);

    expect(result).toBe(false);
  });

  it("returns true for an empty-body webhook with correct HMAC", async () => {
    const emptyBody = "";
    const sig = await computeHmac(secret, emptyBody);
    const req = makeRequest(emptyBody, sig);

    const result = await adapter.verifyWebhook(req, sig);
    // sig computed against emptyBody with secret, but we pass sig as the secret too
    // Let's recompute properly: verify(req, secret)
    const sig2 = await computeHmac(secret, emptyBody);
    const req2 = makeRequest(emptyBody, sig2);
    const result2 = await adapter.verifyWebhook(req2, secret);

    expect(result2).toBe(true);
  });
});

// ─── UberEatsAdapter — parseOrder ─────────────────────────────────────────

describe("UberEatsAdapter — parseOrder", () => {
  const adapter = new UberEatsAdapter();

  it("parses a complete Uber Eats order payload correctly", async () => {
    const payload = {
      id: "uber-order-001",
      store: { id: "store-456" },
      eater: { first_name: "John", phone: "+60123456789" },
      delivery_info: { location: { address: "123 Main St, KL" } },
      cart: {
        items: [
          {
            id: "item-1",
            title: "Nasi Lemak",
            quantity: 2,
            price: { unit_price: { amount: 1500 } },
            selected_modifier_groups: [
              {
                items: [
                  {
                    title: "Extra Sambal",
                    price: { unit_price: { amount: 200 } },
                  },
                ],
              },
            ],
          },
        ],
      },
      payment: {
        charges: {
          total: { amount: 3400 },
          sub_total: { amount: 3000 },
          tax: { amount: 400 },
        },
      },
    };

    const parsed = await adapter.parseOrder(payload);

    expect(parsed.platformOrderId).toBe("uber-order-001");
    expect(parsed.platformStoreId).toBe("store-456");
    expect(parsed.customerName).toBe("John");
    expect(parsed.customerPhone).toBe("+60123456789");
    expect(parsed.deliveryAddress).toBe("123 Main St, KL");
    expect(parsed.totalAmount).toBe(3400);
    expect(parsed.subtotal).toBe(3000);
    expect(parsed.taxAmount).toBe(400);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].platformItemId).toBe("item-1");
    expect(parsed.items[0].name).toBe("Nasi Lemak");
    expect(parsed.items[0].quantity).toBe(2);
    expect(parsed.items[0].unitPrice).toBe(1500);
    expect(parsed.items[0].totalPrice).toBe(3000);
    expect(parsed.items[0].customizations).toHaveLength(1);
    expect(parsed.items[0].customizations![0].name).toBe("Extra Sambal");
    expect(parsed.items[0].customizations![0].priceAdjustment).toBe(200);
    expect(parsed.platformStatus).toBe("received");
    expect(parsed.rawPayload).toBe(payload);
  });

  it("uses fallback values for missing optional fields", async () => {
    const minimalPayload = {
      id: "uber-order-002",
      // no store, no eater, no delivery_info, no cart items, no payment
    };

    const parsed = await adapter.parseOrder(minimalPayload);

    expect(parsed.platformOrderId).toBe("uber-order-002");
    expect(parsed.platformStoreId).toBe("");
    expect(parsed.customerName).toBe("Unknown");
    expect(parsed.customerPhone).toBe("");
    expect(parsed.deliveryAddress).toBe("");
    expect(parsed.items).toHaveLength(0);
    expect(parsed.totalAmount).toBe(0);
    expect(parsed.subtotal).toBe(0);
    expect(parsed.taxAmount).toBe(0);
  });

  it("handles an order with an empty cart", async () => {
    const payload = {
      id: "uber-order-003",
      cart: { items: [] },
      payment: {
        charges: {
          total: { amount: 0 },
          sub_total: { amount: 0 },
          tax: { amount: 0 },
        },
      },
    };

    const parsed = await adapter.parseOrder(payload);

    expect(parsed.items).toHaveLength(0);
    expect(parsed.totalAmount).toBe(0);
  });

  it("handles items with missing quantity (defaults to 1)", async () => {
    const payload = {
      id: "uber-order-004",
      cart: {
        items: [
          {
            id: "item-2",
            title: "Teh Tarik",
            // quantity omitted
            price: { unit_price: { amount: 500 } },
          },
        ],
      },
    };

    const parsed = await adapter.parseOrder(payload);

    expect(parsed.items[0].quantity).toBe(1);
    expect(parsed.items[0].totalPrice).toBe(500);
  });

  it("handles items with no selected_modifier_groups (empty customizations)", async () => {
    const payload = {
      id: "uber-order-005",
      cart: {
        items: [
          {
            id: "item-3",
            title: "Roti Canai",
            quantity: 1,
            price: { unit_price: { amount: 300 } },
            // no modifier groups
          },
        ],
      },
    };

    const parsed = await adapter.parseOrder(payload);

    expect(parsed.items[0].customizations).toHaveLength(0);
  });
});

// ─── UberEatsAdapter — platform property ──────────────────────────────────

describe("UberEatsAdapter — platform identity", () => {
  it('has platform set to "uber_eats"', () => {
    const adapter = new UberEatsAdapter();
    expect(adapter.platform).toBe("uber_eats");
  });
});

// ─── UberEatsAdapter — refreshToken ───────────────────────────────────────

describe("UberEatsAdapter — refreshToken", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns updated credentials with new accessToken on success", async () => {
    const adapter = new UberEatsAdapter();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: "new-token-xyz", expires_in: 3600 }),
        { status: 200 },
      ),
    );

    const creds = { clientId: "cid", clientSecret: "csec" };
    const updated = await adapter.refreshToken(creds);

    expect(updated.accessToken).toBe("new-token-xyz");
    expect(updated.tokenExpiresAt).toBeGreaterThan(Date.now());
    expect(updated.clientId).toBe("cid");
  });

  it("throws when Uber auth endpoint returns a non-OK status", async () => {
    const adapter = new UberEatsAdapter();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Unauthorized", { status: 401 }),
    );

    const creds = { clientId: "bad-cid", clientSecret: "bad-sec" };

    await expect(adapter.refreshToken(creds)).rejects.toThrow(
      "Uber Eats token refresh failed (401)",
    );
  });
});
