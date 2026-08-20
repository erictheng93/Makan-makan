import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";
import { readEnvelope } from "../helpers/read-json";

const USERS_ENDPOINT = "https://test/api/v1/users";
const CSRF_TOKEN = "a".repeat(64);
const CSRF_HEADERS = {
  host: "test",
  origin: "https://test",
  cookie: `csrf_token=${CSRF_TOKEN}`,
  "x-csrf-token": CSRF_TOKEN,
};

describe("Users API — real integration", () => {
  let testApp: RealIntegrationTestApp;
  let seed: ReturnType<typeof buildSeedHelpers>;

  beforeAll(async () => {
    testApp = await createRealIntegrationTestApp();
    seed = buildSeedHelpers(testApp.testDb);
  });

  afterAll(async () => {
    if (testApp) await testApp.dispose();
  });

  beforeEach(async () => {
    await testApp.testDb.truncateAll();
  });

  it("rejects an owner creating staff for another restaurant", async () => {
    const ownerRestaurant = await seed.restaurant();
    const otherRestaurant = await seed.restaurant({
      name: "Other Restaurant",
      slug: "other-restaurant",
    });
    const owner = await seed.user({
      username: "owner-cross-restaurant-deny",
      role: 1,
      restaurantId: String(ownerRestaurant.id),
    });
    const ownerToken = await testApp.authHelper.ownerToken(
      owner.id,
      String(ownerRestaurant.id),
    );

    const response = await testApp.app.fetch(
      new Request(USERS_ENDPOINT, {
        method: "POST",
        headers: {
          ...CSRF_HEADERS,
          authorization: `Bearer ${ownerToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          username: "cross-restaurant-chef",
          fullName: "Cross Restaurant Chef",
          email: "cross-restaurant-chef@example.test",
          password: "Secure@123",
          role: 2,
          restaurantId: String(otherRestaurant.id),
        }),
      }),
    );

    expect(response.status).toBe(403);
    const body = await readEnvelope(response);
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe("FORBIDDEN");

    const created = await testApp.env.DB.prepare(
      `SELECT id, restaurant_id
         FROM users
        WHERE username = ?`,
    )
      .bind("cross-restaurant-chef")
      .first();
    expect(created).toBeNull();
  });
});
