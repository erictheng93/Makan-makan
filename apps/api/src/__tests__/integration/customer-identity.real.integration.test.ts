import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { sign } from "hono/jwt";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers, type SeedHelpers } from "./helpers/seed-helper";
import { CUSTOMER_CONSENT_VERSIONS } from "@makanmakan/shared-types";
import { pruneStaleCustomerPushSubscriptions } from "../../features/customer/routes";

const BASE = "https://test/api/v1/customer";
const CSRF = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("Customer Identity API - real integration", () => {
  let testApp: RealIntegrationTestApp;
  let seed: SeedHelpers;

  beforeAll(async () => {
    testApp = await createRealIntegrationTestApp();
    seed = buildSeedHelpers(testApp.testDb);
  });

  afterAll(async () => {
    await testApp.dispose();
  });

  beforeEach(async () => {
    await testApp.testDb.truncateAll();
  });

  it("issues customer tokens through phone OTP and returns /customer/me", async () => {
    const otpRes = await testApp.app.fetch(
      new Request(`${BASE}/auth/request-otp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: "+886912345678" }),
      }),
    );

    expect(otpRes.status).toBe(200);
    const otpJson: any = await otpRes.json();
    expect(otpJson.data.devOtp).toMatch(/^\d{6}$/);

    const verifyRes = await testApp.app.fetch(
      new Request(`${BASE}/auth/verify-otp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: "+886912345678",
          otp: otpJson.data.devOtp,
        }),
      }),
    );

    expect(verifyRes.status).toBe(200);
    const verifyJson: any = await verifyRes.json();
    expect(verifyJson.data.accessToken).toBeTruthy();
    expect(verifyJson.data.customer.primaryPhone).toBe("+886912345678");

    const meRes = await testApp.app.fetch(
      new Request(`${BASE}/me`, {
        headers: { authorization: `Bearer ${verifyJson.data.accessToken}` },
      }),
    );

    expect(meRes.status).toBe(200);
    const meJson: any = await meRes.json();
    expect(meJson.data.customer.id).toBe(verifyJson.data.customer.id);
    expect(meJson.data.preferences.waitingListOptIn).toBe(true);
  });

  it("normalizes Taiwan local phone numbers to E.164", async () => {
    const otpRes = await testApp.app.fetch(
      new Request(`${BASE}/auth/request-otp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: "0912-345-678" }),
      }),
    );

    expect(otpRes.status).toBe(200);
    const otpJson: any = await otpRes.json();

    const verifyRes = await testApp.app.fetch(
      new Request(`${BASE}/auth/verify-otp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: "0912345678",
          otp: otpJson.data.devOtp,
        }),
      }),
    );

    expect(verifyRes.status).toBe(200);
    const verifyJson: any = await verifyRes.json();
    expect(verifyJson.data.customer.primaryPhone).toBe("+886912345678");
  });

  it("reclaims a phone from a deleted customer when the number is reused", async () => {
    await testApp.env.DB.prepare(
      `INSERT INTO customers
        (id, display_name, primary_phone, status, deleted_at_ms,
         created_at_ms, updated_at_ms)
       VALUES ('deleted-customer', 'Deleted Customer', '+886977777777',
         'deleted', 1, 1, 1)`,
    ).run();

    const otpRes = await testApp.app.fetch(
      new Request(`${BASE}/auth/request-otp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: "+886977777777" }),
      }),
    );
    const otpJson: any = await otpRes.json();

    const verifyRes = await testApp.app.fetch(
      new Request(`${BASE}/auth/verify-otp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: "+886977777777",
          otp: otpJson.data.devOtp,
        }),
      }),
    );

    expect(verifyRes.status).toBe(200);
    const verifyJson: any = await verifyRes.json();
    expect(verifyJson.data.customer.id).not.toBe("deleted-customer");
    expect(verifyJson.data.customer.primaryPhone).toBe("+886977777777");

    const oldCustomer = await testApp.env.DB.prepare(
      `SELECT primary_phone, status
         FROM customers
        WHERE id = 'deleted-customer'`,
    ).first<{ primary_phone: string | null; status: string }>();
    expect(oldCustomer).toEqual({
      primary_phone: null,
      status: "deleted",
    });
  });

  it("revokes refresh tokens on logout", async () => {
    const session = await loginCustomerSession("+886945678901");

    const logoutRes = await authedPost(
      session.accessToken,
      `${BASE}/auth/logout`,
      {
        refreshToken: session.refreshToken,
      },
    );
    expect(logoutRes.status).toBe(200);

    const refreshRes = await testApp.app.fetch(
      new Request(`${BASE}/auth/refresh`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      }),
    );
    expect(refreshRes.status).toBe(401);
  });

  it("rejects staff JWTs on canonical customer endpoints", async () => {
    const staffToken = await sign(
      {
        id: 1,
        sub: "1",
        username: "owner",
        role: 1,
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
      testApp.env.JWT_SECRET,
    );

    const res = await testApp.app.fetch(
      new Request(`${BASE}/me`, {
        headers: { authorization: `Bearer ${staffToken}` },
      }),
    );

    expect(res.status).toBe(401);
  });

  it("upserts push subscriptions for the authenticated customer", async () => {
    const accessToken = await loginCustomer("+886923456789");

    const res = await authedPost(accessToken, `${BASE}/push-subscriptions`, {
      endpoint: "https://push.example.test/abc",
      p256dh: "p256dh-key",
      auth: "auth-key",
      deviceLabel: "Browser",
    });

    expect(res.status).toBe(201);

    const listRes = await testApp.app.fetch(
      new Request(`${BASE}/push-subscriptions`, {
        headers: { authorization: `Bearer ${accessToken}` },
      }),
    );
    const listJson: any = await listRes.json();
    expect(listJson.data).toHaveLength(1);
    expect(listJson.data[0].endpoint).toBe("https://push.example.test/abc");
  });

  it("prunes stale failed push subscriptions on the daily cadence", async () => {
    const accessToken = await loginCustomer("+886922222222");
    const meRes = await testApp.app.fetch(
      new Request(`${BASE}/me`, {
        headers: { authorization: `Bearer ${accessToken}` },
      }),
    );
    const meJson: any = await meRes.json();
    const customerId = meJson.data.customer.id;
    const now = Date.now();
    const ninetyOneDaysAgo = now - 91 * 24 * 60 * 60 * 1000;

    await Promise.all([
      insertPushSubscription(customerId, "stale-failed", ninetyOneDaysAgo, 3),
      insertPushSubscription(
        customerId,
        "stale-low-failure",
        ninetyOneDaysAgo,
        2,
      ),
      insertPushSubscription(customerId, "recent-failed", now, 3),
    ]);

    const result = await pruneStaleCustomerPushSubscriptions(testApp.env, now);

    expect(result.deleted).toBe(1);
    const remaining = await testApp.env.DB.prepare(
      `SELECT id
         FROM customer_push_subscriptions
        ORDER BY id ASC`,
    ).all<{ id: string }>();
    expect(remaining.results.map((row) => row.id)).toEqual([
      "recent-failed",
      "stale-low-failure",
    ]);
  });

  it("creates idempotent favorites only for valid targets", async () => {
    const accessToken = await loginCustomer("+886956789012");
    const restaurant = await seed.restaurant();

    const createRes = await authedPost(accessToken, `${BASE}/favorites`, {
      targetType: "restaurant",
      targetId: String(restaurant.id),
    });
    expect(createRes.status).toBe(201);
    const createJson: any = await createRes.json();
    expect(createJson.data.targetType).toBe("restaurant");
    expect(createJson.data.targetId).toBe(String(restaurant.id));

    const duplicateRes = await authedPost(accessToken, `${BASE}/favorites`, {
      targetType: "restaurant",
      targetId: String(restaurant.id),
    });
    expect(duplicateRes.status).toBe(200);
    const duplicateJson: any = await duplicateRes.json();
    expect(duplicateJson.data.id).toBe(createJson.data.id);

    const invalidRes = await authedPost(accessToken, `${BASE}/favorites`, {
      targetType: "restaurant",
      targetId: "missing-restaurant",
    });
    expect(invalidRes.status).toBe(400);

    const listRes = await testApp.app.fetch(
      new Request(`${BASE}/favorites?targetType=restaurant`, {
        headers: { authorization: `Bearer ${accessToken}` },
      }),
    );
    expect(listRes.status).toBe(200);
    const listJson: any = await listRes.json();
    expect(listJson.data).toHaveLength(1);

    const deleteRes = await testApp.app.fetch(
      new Request(`${BASE}/favorites/${createJson.data.id}`, {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${accessToken}`,
          host: "test",
          origin: "https://test",
          "x-csrf-token": CSRF,
          cookie: `csrf_token=${CSRF}`,
        },
      }),
    );
    expect(deleteRes.status).toBe(200);
  });

  it("records consent grants and revokes previous active grants", async () => {
    const accessToken = await loginCustomer("+886934567890");

    const grantRes = await authedPost(accessToken, `${BASE}/consents`, {
      consentType: "marketing",
      version: CUSTOMER_CONSENT_VERSIONS.marketing,
      granted: true,
      source: "onboarding",
    });
    expect(grantRes.status).toBe(201);

    let activeRes = await testApp.app.fetch(
      new Request(`${BASE}/consents`, {
        headers: { authorization: `Bearer ${accessToken}` },
      }),
    );
    let activeJson: any = await activeRes.json();
    expect(activeJson.data).toHaveLength(1);

    const revokeRes = await authedPost(accessToken, `${BASE}/consents`, {
      consentType: "marketing",
      version: CUSTOMER_CONSENT_VERSIONS.marketing,
      granted: false,
      source: "settings",
    });
    expect(revokeRes.status).toBe(201);

    activeRes = await testApp.app.fetch(
      new Request(`${BASE}/consents`, {
        headers: { authorization: `Bearer ${accessToken}` },
      }),
    );
    activeJson = await activeRes.json();
    expect(activeJson.data).toHaveLength(0);

    const ledger = await testApp.env.DB.prepare(
      `SELECT granted, revoked_at_ms
         FROM customer_consents
        WHERE consent_type = 'marketing'
        ORDER BY granted_at_ms ASC`,
    ).all<{ granted: number; revoked_at_ms: number | null }>();
    expect(ledger.results).toHaveLength(2);
    expect(ledger.results?.[0].granted).toBe(1);
    expect(ledger.results?.[0].revoked_at_ms).toBeTypeOf("number");
    expect(ledger.results?.[1].granted).toBe(0);
  });

  it("rejects customer consent versions outside the shared catalog", async () => {
    const accessToken = await loginCustomer("+886933333333");

    const res = await authedPost(accessToken, `${BASE}/consents`, {
      consentType: "marketing",
      version: "ad-hoc-version",
      granted: true,
      source: "settings",
    });

    expect(res.status).toBe(400);
  });

  async function loginCustomer(phone: string): Promise<string> {
    const session = await loginCustomerSession(phone);
    return session.accessToken;
  }

  async function loginCustomerSession(
    phone: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const otpRes = await testApp.app.fetch(
      new Request(`${BASE}/auth/request-otp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
      }),
    );
    const otpJson: any = await otpRes.json();

    const verifyRes = await testApp.app.fetch(
      new Request(`${BASE}/auth/verify-otp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, otp: otpJson.data.devOtp }),
      }),
    );
    const verifyJson: any = await verifyRes.json();
    return {
      accessToken: verifyJson.data.accessToken,
      refreshToken: verifyJson.data.refreshToken,
    };
  }

  function authedPost(accessToken: string, url: string, body: unknown) {
    return testApp.app.fetch(
      new Request(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json",
          host: "test",
          origin: "https://test",
          "x-csrf-token": CSRF,
          cookie: `csrf_token=${CSRF}`,
        },
        body: JSON.stringify(body),
      }),
    );
  }

  function insertPushSubscription(
    customerId: string,
    id: string,
    lastUsedAtMs: number,
    failureCount: number,
  ) {
    return testApp.env.DB.prepare(
      `INSERT INTO customer_push_subscriptions
        (id, customer_id, endpoint, p256dh_key, auth_key, last_used_at_ms,
         failure_count, created_at_ms)
       VALUES (?, ?, ?, 'p256dh', 'auth', ?, ?, ?)`,
    )
      .bind(
        id,
        customerId,
        `https://push.example.test/${id}`,
        lastUsedAtMs,
        failureCount,
        lastUsedAtMs,
      )
      .run();
  }
});
