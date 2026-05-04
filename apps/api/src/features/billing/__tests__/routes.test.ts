import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { ApiError } from "../../../shared/utils/api-error";
import billingRoutes from "../routes";

function buildApp(env: Record<string, unknown>) {
  const app = new Hono<any>();
  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json(
        { success: false, error: { code: err.code, message: err.message } },
        err.status as never,
      );
    }
    return c.json({ success: false, error: { message: err.message } }, 500);
  });
  app.route("/billing", billingRoutes);
  return { app, env: { NODE_ENV: "test", ...env } };
}

describe("Billing webhook routes", () => {
  it("records provider webhooks and reconciles invoice.paid", async () => {
    const rawBody = JSON.stringify({
      id: "evt_1",
      type: "invoice.paid",
      data: {
        object: {
          metadata: { restaurantId: "rest-1" },
        },
      },
    });
    const secret = "whsec_test";
    const auditRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const auditBind = vi.fn(() => ({ run: auditRun }));
    const reconcileStatements: Array<{ args: unknown[] }> = [];
    const prepare = vi.fn((sql: string) => {
      if (sql.includes("INSERT OR IGNORE INTO payment_audit_log")) {
        return { bind: auditBind };
      }
      return {
        bind: vi.fn((...args: unknown[]) => {
          const statement = { args };
          reconcileStatements.push(statement);
          return statement;
        }),
      };
    });
    const batch = vi.fn().mockResolvedValue([]);
    const { app, env } = buildApp({
      DB: { prepare, batch },
      STRIPE_WEBHOOK_SECRET: secret,
    });

    const response = await app.request(
      "/billing/webhooks/stripe",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-signature": await hmacSha256Hex(secret, rawBody),
        },
        body: rawBody,
      },
      env,
    );
    const json = (await response.json()) as {
      data: { duplicate: boolean; reconciled: boolean };
    };

    expect(response.status).toBe(200);
    expect(json.data).toMatchObject({ duplicate: false, reconciled: true });
    expect(auditBind).toHaveBeenCalledWith(
      expect.any(String),
      "rest-1",
      null,
      null,
      "webhook_received",
      "stripe",
      "evt_1",
      "invoice.paid",
      null,
      null,
      expect.stringContaining('"type":"invoice.paid"'),
      null,
      null,
      expect.any(Number),
    );
    expect(batch).toHaveBeenCalledOnce();
    expect(reconcileStatements[0].args).toEqual([expect.any(Number), "rest-1"]);
    expect(reconcileStatements[1].args).toContain("success");
  });

  it("does not reconcile duplicate provider events", async () => {
    const rawBody = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
    const secret = "whsec_test";
    const auditRun = vi.fn().mockResolvedValue({ meta: { changes: 0 } });
    const auditBind = vi.fn(() => ({ run: auditRun }));
    const prepare = vi.fn(() => ({ bind: auditBind }));
    const batch = vi.fn();
    const { app, env } = buildApp({
      DB: { prepare, batch },
      STRIPE_WEBHOOK_SECRET: secret,
    });

    const response = await app.request(
      "/billing/webhooks/stripe",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-signature": await hmacSha256Hex(secret, rawBody),
        },
        body: rawBody,
      },
      env,
    );
    const json = (await response.json()) as {
      data: { duplicate: boolean; reconciled: boolean };
    };

    expect(response.status).toBe(200);
    expect(json.data).toMatchObject({ duplicate: true, reconciled: false });
    expect(batch).not.toHaveBeenCalled();
  });

  it("records payment failed webhooks and dispatches a billing alert", async () => {
    const rawBody = JSON.stringify({
      id: "evt_failed",
      type: "invoice.payment_failed",
      data: {
        object: {
          metadata: { restaurantId: "rest-1" },
        },
      },
    });
    const secret = "whsec_test";
    const auditRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const graceRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const notificationFirst = vi.fn().mockResolvedValue(null);
    const notificationRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const auditBind = vi.fn(() => ({ run: auditRun }));
    const graceBind = vi.fn(() => ({ run: graceRun }));
    const notificationLookupBind = vi.fn(() => ({ first: notificationFirst }));
    const notificationInsertBind = vi.fn(() => ({ run: notificationRun }));
    const prepare = vi
      .fn()
      .mockReturnValueOnce({ bind: auditBind })
      .mockReturnValueOnce({ bind: graceBind })
      .mockReturnValueOnce({ bind: notificationLookupBind })
      .mockReturnValueOnce({ bind: notificationInsertBind });
    const { app, env } = buildApp({
      DB: { prepare },
      STRIPE_WEBHOOK_SECRET: secret,
    });

    const response = await app.request(
      "/billing/webhooks/stripe",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-signature": await hmacSha256Hex(secret, rawBody),
        },
        body: rawBody,
      },
      env,
    );
    const json = (await response.json()) as {
      data: { duplicate: boolean; reconciled: boolean };
    };

    expect(response.status).toBe(200);
    expect(json.data).toMatchObject({ duplicate: false, reconciled: true });
    expect(graceBind).toHaveBeenCalledWith(
      expect.any(String),
      "rest-1",
      null,
      null,
      "grace_period_start",
      "stripe",
      null,
      "invoice.payment_failed",
      null,
      null,
      expect.stringContaining("webhook_reconcile"),
      null,
      null,
      expect.any(Number),
    );
    expect(notificationInsertBind).toHaveBeenCalledWith(
      expect.any(String),
      "rest-1",
      "payment_failed",
      "payment_failed:rest-1:evt_failed",
      "slack",
      "skipped_provider_unconfigured",
      null,
      null,
      null,
      expect.stringContaining('"provider":"stripe"'),
      expect.any(Number),
    );
  });

  it("rejects Stripe webhooks when a configured signature is missing", async () => {
    const { app, env } = buildApp({
      DB: { prepare: vi.fn() },
      STRIPE_WEBHOOK_SECRET: "whsec_test",
    });

    const response = await app.request(
      "/billing/webhooks/stripe",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "evt_1", type: "invoice.paid" }),
      },
      env,
    );
    const json = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(401);
    expect(json.error.code).toBe("WEBHOOK_SIGNATURE_INVALID");
  });

  it("rejects Stripe webhooks when the signing secret is not configured", async () => {
    const prepare = vi.fn();
    const rawBody = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
    const { app, env } = buildApp({
      DB: { prepare },
    });
    const response = await app.request(
      "/billing/webhooks/stripe",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-signature": await hmacSha256Hex("whsec_test", rawBody),
        },
        body: rawBody,
      },
      env,
    );
    const json = (await response.json()) as {
      error: { code: string };
    };

    expect(response.status).toBe(401);
    expect(json.error.code).toBe("WEBHOOK_SIGNATURE_INVALID");
    expect(prepare).not.toHaveBeenCalled();
  });

  it("rejects unsupported billing webhook providers", async () => {
    const prepare = vi.fn();
    const { app, env } = buildApp({
      DB: { prepare },
      STRIPE_WEBHOOK_SECRET: "whsec_test",
    });

    const response = await app.request(
      "/billing/webhooks/unknown",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: "evt_1", type: "invoice.paid" }),
      },
      env,
    );

    expect(response.status).toBe(401);
    expect(prepare).not.toHaveBeenCalled();
  });

  it("accepts signed LINE Pay webhooks as a second provider", async () => {
    const rawBody = JSON.stringify({
      id: "line_evt_1",
      type: "invoice.paid",
      data: {
        object: {
          metadata: { restaurantId: "rest-1" },
        },
      },
    });
    const nonce = "nonce-1";
    const secret = "linepay-secret";
    const signature = await hmacSha256Base64(
      secret,
      `${secret}${rawBody}${nonce}`,
    );
    const auditRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const auditBind = vi.fn(() => ({ run: auditRun }));
    const prepare = vi.fn((sql: string) => {
      if (sql.includes("INSERT OR IGNORE INTO payment_audit_log")) {
        return { bind: auditBind };
      }
      return { bind: vi.fn(() => ({})) };
    });
    const batch = vi.fn().mockResolvedValue([]);
    const { app, env } = buildApp({
      DB: { prepare, batch },
      LINEPAY_WEBHOOK_SECRET: secret,
    });

    const response = await app.request(
      "/billing/webhooks/linepay",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-linepay-nonce": nonce,
          "x-linepay-signature": signature,
        },
        body: rawBody,
      },
      env,
    );
    const json = (await response.json()) as {
      data: { provider: string; reconciled: boolean };
    };

    expect(response.status).toBe(200);
    expect(json.data).toMatchObject({ provider: "linepay", reconciled: true });
    expect(auditBind).toHaveBeenCalledWith(
      expect.any(String),
      "rest-1",
      null,
      null,
      "webhook_received",
      "linepay",
      "line_evt_1",
      "invoice.paid",
      null,
      null,
      expect.stringContaining('"type":"invoice.paid"'),
      null,
      null,
      expect.any(Number),
    );
  });
});

async function hmacSha256Hex(secret: string, value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Base64(secret: string, value: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  const bytes = new Uint8Array(signature);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
