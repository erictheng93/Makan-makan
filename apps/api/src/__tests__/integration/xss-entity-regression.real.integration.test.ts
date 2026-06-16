import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers, type SeedHelpers } from "./helpers/seed-helper";

const CSRF_TOKEN = "d".repeat(64);
const CSRF_HEADERS = {
  host: "test",
  origin: "https://test",
  "x-csrf-token": CSRF_TOKEN,
  cookie: `csrf_token=${CSRF_TOKEN}`,
};

function assertNoRawLessThan(value: unknown): void {
  expect(JSON.stringify(value)).not.toContain("<");
}

function assertEscapedLessThan(value: string): void {
  expect(value).toContain("&lt;");
  assertNoRawLessThan(value);
}

async function loginCustomer(testApp: RealIntegrationTestApp): Promise<string> {
  const otpRes = await testApp.app.fetch(
    new Request("https://test/api/v1/customer/auth/request-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone: "+886912345678" }),
    }),
  );
  expect(otpRes.status).toBe(200);
  const otpJson: any = await otpRes.json();

  const verifyRes = await testApp.app.fetch(
    new Request("https://test/api/v1/customer/auth/verify-otp", {
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
  return verifyJson.data.accessToken as string;
}

describe("XSS entity decoding regression — real integration", () => {
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

  it("does not turn double-encoded less-than entities into raw '<' through market, restaurant, or customer routes", async () => {
    const adminToken = await testApp.authHelper.adminToken();
    const unsafeEntity = "&amp;lt;script&amp;gt;";

    const marketSlug = `xss-entity-market-${crypto.randomUUID()}`;
    const createMarketRes = await testApp.app.fetch(
      new Request("https://test/api/v1/admin/markets", {
        method: "POST",
        headers: {
          authorization: `Bearer ${adminToken}`,
          "content-type": "application/json",
          ...CSRF_HEADERS,
        },
        body: JSON.stringify({
          slug: marketSlug,
          name: "XSS Entity Market",
          type: "night_market",
          description: "Regression fixture",
          city: "台中市",
          district: "西屯區",
          address: "台中市西屯區文華路",
          latitude: 24.1764,
          longitude: 120.6466,
          openingHours: {
            friday: { open: "17:00", close: "23:30" },
          },
          bannerUrl: `https://example.test/banner?next=${unsafeEntity}`,
        }),
      }),
    );
    expect(createMarketRes.status).toBe(201);

    const publicMarketRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/markets/${marketSlug}`),
    );
    expect(publicMarketRes.status).toBe(200);
    const publicMarketJson: any = await publicMarketRes.json();
    assertEscapedLessThan(publicMarketJson.data.market.bannerUrl);

    const restaurant = await seed.restaurant({
      name: "XSS Entity Restaurant",
    });
    const updateContactRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/restaurants/${restaurant.id}/contact-profile`,
        {
          method: "PUT",
          headers: {
            authorization: `Bearer ${adminToken}`,
            "content-type": "application/json",
            ...CSRF_HEADERS,
          },
          body: JSON.stringify({
            faqs: [
              {
                question: `Question ${unsafeEntity}`,
                answer: `Answer ${unsafeEntity}`,
                keywords: [`Keyword ${unsafeEntity}`],
                isActive: true,
              },
            ],
          }),
        },
      ),
    );
    expect(updateContactRes.status).toBe(200);

    const publicContactRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/restaurants/${restaurant.id}/contact-profile`,
      ),
    );
    expect(publicContactRes.status).toBe(200);
    const publicContactJson: any = await publicContactRes.json();
    assertEscapedLessThan(publicContactJson.data.faqs[0].question);
    assertEscapedLessThan(publicContactJson.data.faqs[0].answer);
    assertEscapedLessThan(publicContactJson.data.faqs[0].keywords[0]);
    assertNoRawLessThan(publicContactJson.data.faqs);

    const customerToken = await loginCustomer(testApp);
    const pushRes = await testApp.app.fetch(
      new Request("https://test/api/v1/customer/push-subscriptions", {
        method: "POST",
        headers: {
          authorization: `Bearer ${customerToken}`,
          "content-type": "application/json",
          ...CSRF_HEADERS,
        },
        body: JSON.stringify({
          endpoint: `https://push.example.test/sub?next=${unsafeEntity}`,
          p256dh: "public-key",
          auth: "auth-secret",
        }),
      }),
    );
    expect(pushRes.status).toBe(201);
    const pushJson: any = await pushRes.json();
    assertEscapedLessThan(pushJson.data.endpoint);
  });
});
