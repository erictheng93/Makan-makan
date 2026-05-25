import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { sign } from "hono/jwt";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";

const BASE = "https://test/api/v1/customer";
const CSRF = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

describe("Customer Identity API - real integration", () => {
  let testApp: RealIntegrationTestApp;

  beforeAll(async () => {
    testApp = await createRealIntegrationTestApp();
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

  it("records consent grants and revokes previous active grants", async () => {
    const accessToken = await loginCustomer("+886934567890");

    const grantRes = await authedPost(accessToken, `${BASE}/consents`, {
      consentType: "marketing",
      version: "2026-05-25-v1",
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
      version: "2026-05-25-v1",
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

  async function loginCustomer(phone: string): Promise<string> {
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
    return verifyJson.data.accessToken;
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
});
