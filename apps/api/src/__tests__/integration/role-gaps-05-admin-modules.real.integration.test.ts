import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";

describe("Role gap coverage: admin-only modules boundary", () => {
  let testApp: RealIntegrationTestApp;
  let seed: ReturnType<typeof buildSeedHelpers>;

  beforeAll(async () => {
    testApp = await createRealIntegrationTestApp();
    seed = buildSeedHelpers(testApp.testDb);
  });

  afterAll(async () => {
    if (testApp) {
      await testApp.dispose();
    }
  });

  function csrfHeaders(token: string) {
    return {
      host: "test",
      origin: "https://test",
      "x-csrf-token": token,
      cookie: `csrf_token=${token}`,
    };
  }

  beforeEach(async () => {
    await testApp.testDb.truncateAll();
  });

  async function insertActiveSubscription(restaurantId: string) {
    await testApp.env.DB.prepare(
      `INSERT INTO shop_subscriptions
        (id, restaurant_id, plan_tier, module_overrides, deployment_mode,
         is_active, trial_ends_at_ms, created_at_ms, updated_at_ms)
       VALUES (?, ?, 'trial', '{}', 'managed', 1, ?, ?, ?)`,
    )
      .bind(
        `sub-${restaurantId}`,
        restaurantId,
        Date.now() + 24 * 60 * 60 * 1000,
        Date.now(),
        Date.now(),
      )
      .run();
  }

  it("enforces auth module scope for /api/v1/auth/stats", async () => {
    const restaurant = await seed.restaurant();

    const adminUser = await seed.user({
      id: 1,
      username: "ticket05-admin",
      role: 0,
      restaurantId: String(restaurant.id),
    });
    const adminToken = await testApp.authHelper.adminToken(
      String(restaurant.id),
    );

    const owner = await seed.user({
      username: "ticket05-owner",
      role: 1,
      restaurantId: String(restaurant.id),
    });
    const ownerToken = await testApp.authHelper.ownerToken(
      owner.id,
      String(restaurant.id),
    );

    const adminRes = await testApp.app.fetch(
      new Request("https://test/api/v1/auth/stats?timeRange=30d", {
        headers: { authorization: `Bearer ${adminToken}` },
      }),
    );
    expect(adminRes.status).toBe(200);
    const adminJson: any = await adminRes.json();
    expect(adminJson.success).toBe(true);

    const ownerRes = await testApp.app.fetch(
      new Request("https://test/api/v1/auth/stats?timeRange=30d", {
        headers: { authorization: `Bearer ${ownerToken}` },
      }),
    );
    expect(ownerRes.status).toBe(403);
  });

  it("covers monitoring metrics role boundary for admin/owner vs staff", async () => {
    const restaurant = await seed.restaurant();

    const owner = await seed.user({
      username: "ticket05-monitor-owner",
      role: 1,
      restaurantId: String(restaurant.id),
    });
    const ownerToken = await testApp.authHelper.ownerToken(
      owner.id,
      String(restaurant.id),
    );

    const chef = await seed.user({
      username: "ticket05-monitor-chef",
      role: 2,
      restaurantId: String(restaurant.id),
    });
    const chefToken = await testApp.authHelper.staffToken(
      chef.id,
      2,
      String(restaurant.id),
    );

    const ownerRes = await testApp.app.fetch(
      new Request("https://test/api/v1/monitoring/metrics", {
        headers: { authorization: `Bearer ${ownerToken}` },
      }),
    );
    expect(ownerRes.status).toBe(200);

    const chefRes = await testApp.app.fetch(
      new Request("https://test/api/v1/monitoring/metrics", {
        headers: { authorization: `Bearer ${chefToken}` },
      }),
    );
    expect(chefRes.status).toBe(403);
  });

  it("keeps monitoring and system health publicly reachable", async () => {
    const monitoringHealthRes = await testApp.app.fetch(
      new Request("https://test/api/v1/monitoring/health"),
    );
    expect(monitoringHealthRes.status).toBe(200);

    const systemHealthRes = await testApp.app.fetch(
      new Request("https://test/api/v1/system/health"),
    );
    expect(systemHealthRes.status).toBe(200);
  });

  it("requires admin for /api/v1/system/health/detailed", async () => {
    const restaurant = await seed.restaurant();
    const adminUser = await seed.user({
      id: 2,
      username: "ticket05-system-admin",
      role: 0,
      restaurantId: String(restaurant.id),
    });
    const adminToken = await testApp.authHelper.adminToken(
      String(restaurant.id),
      adminUser.id,
    );

    const owner = await seed.user({
      username: "ticket05-system-owner",
      role: 1,
      restaurantId: String(restaurant.id),
    });
    const ownerToken = await testApp.authHelper.ownerToken(
      owner.id,
      String(restaurant.id),
    );

    const adminRes = await testApp.app.fetch(
      new Request("https://test/api/v1/system/health/detailed", {
        headers: { authorization: `Bearer ${adminToken}` },
      }),
    );
    expect(adminRes.status).toBe(200);

    const ownerRes = await testApp.app.fetch(
      new Request("https://test/api/v1/system/health/detailed", {
        headers: { authorization: `Bearer ${ownerToken}` },
      }),
    );
    expect(ownerRes.status).toBe(403);
  });

  it("scopes /api/v1/system/error-stats by restaurant for owners while allowing admin full view", async () => {
    const restaurantA = await seed.restaurant({
      name: "Ticket 05 Restaurant A",
    });
    const restaurantB = await seed.restaurant({
      name: "Ticket 05 Restaurant B",
    });

    const ownerA = await seed.user({
      username: "ticket05-error-owner-a",
      role: 1,
      restaurantId: String(restaurantA.id),
    });
    const ownerB = await seed.user({
      username: "ticket05-error-owner-b",
      role: 1,
      restaurantId: String(restaurantB.id),
    });
    const admin = await seed.user({
      id: 3,
      username: "ticket05-error-admin",
      role: 0,
      restaurantId: String(restaurantA.id),
    });

    const ownerAToken = await testApp.authHelper.ownerToken(
      ownerA.id,
      String(restaurantA.id),
    );
    const ownerBToken = await testApp.authHelper.ownerToken(
      ownerB.id,
      String(restaurantB.id),
    );
    const adminToken = await testApp.authHelper.adminToken(
      String(restaurantA.id),
      admin.id,
    );

    const errorPayload = {
      errors: [
        {
          type: "validation",
          severity: "high",
          code: "EVAL",
          message: "integration test error",
          timestamp: new Date().toISOString(),
          url: "https://test/test",
        },
      ],
    };

    const ownerAError = await testApp.app.fetch(
      new Request("https://test/api/v1/system/errors", {
        method: "POST",
        headers: {
          authorization: `Bearer ${ownerAToken}`,
          "content-type": "application/json",
          ...csrfHeaders("a".repeat(64)),
        },
        body: JSON.stringify(errorPayload),
      }),
    );
    expect(ownerAError.status).toBe(200);

    const ownerBError = await testApp.app.fetch(
      new Request("https://test/api/v1/system/errors", {
        method: "POST",
        headers: {
          authorization: `Bearer ${ownerBToken}`,
          "content-type": "application/json",
          ...csrfHeaders("b".repeat(64)),
        },
        body: JSON.stringify(errorPayload),
      }),
    );
    expect(ownerBError.status).toBe(200);

    const ownerAStatsRes = await testApp.app.fetch(
      new Request("https://test/api/v1/system/error-stats", {
        headers: { authorization: `Bearer ${ownerAToken}` },
      }),
    );
    expect(ownerAStatsRes.status).toBe(200);
    const ownerAStats: any = await ownerAStatsRes.json();
    expect(ownerAStats.success).toBe(true);
    expect(ownerAStats.data.summary.total_errors_24h).toBe(1);

    const ownerBStatsRes = await testApp.app.fetch(
      new Request("https://test/api/v1/system/error-stats", {
        headers: { authorization: `Bearer ${ownerBToken}` },
      }),
    );
    expect(ownerBStatsRes.status).toBe(200);
    const ownerBStats: any = await ownerBStatsRes.json();
    expect(ownerBStats.success).toBe(true);
    expect(ownerBStats.data.summary.total_errors_24h).toBe(1);

    const adminStatsRes = await testApp.app.fetch(
      new Request("https://test/api/v1/system/error-stats", {
        headers: { authorization: `Bearer ${adminToken}` },
      }),
    );
    expect(adminStatsRes.status).toBe(200);
    const adminStats: any = await adminStatsRes.json();
    expect(adminStats.success).toBe(true);
    expect(adminStats.data.summary.total_errors_24h).toBe(2);
  });

  it("allows owners to read own feedback and blocks owner on feedback stats", async () => {
    const restaurantA = await seed.restaurant({ name: "Ticket 05 Feedback A" });
    const restaurantB = await seed.restaurant({ name: "Ticket 05 Feedback B" });

    const ownerA = await seed.user({
      username: "ticket05-feedback-owner-a",
      role: 1,
      restaurantId: String(restaurantA.id),
    });
    const ownerB = await seed.user({
      username: "ticket05-feedback-owner-b",
      role: 1,
      restaurantId: String(restaurantB.id),
    });
    const admin = await seed.user({
      id: 4,
      username: "ticket05-feedback-admin",
      role: 0,
      restaurantId: String(restaurantA.id),
    });

    const ownerAToken = await testApp.authHelper.ownerToken(
      ownerA.id,
      String(restaurantA.id),
    );
    const ownerBToken = await testApp.authHelper.ownerToken(
      ownerB.id,
      String(restaurantB.id),
    );
    const adminToken = await testApp.authHelper.adminToken(
      String(restaurantA.id),
      admin.id,
    );

    await insertActiveSubscription(String(restaurantA.id));
    await insertActiveSubscription(String(restaurantB.id));

    const feedbackPayloadA = {
      subject: "OwnerA 的回報",
      description: "這是一則可用來驗證 owner 權限範圍的回報內容",
      category: "other",
    };
    const feedbackPayloadB = {
      subject: "OwnerB 的回報",
      description: "這也是一則給另一個 owner 的測試回報內容",
      category: "other",
    };

    const createA = await testApp.app.fetch(
      new Request("https://test/api/v1/feedback", {
        method: "POST",
        headers: {
          authorization: `Bearer ${ownerAToken}`,
          "content-type": "application/json",
          ...csrfHeaders("c".repeat(64)),
        },
        body: JSON.stringify(feedbackPayloadA),
      }),
    );
    expect(createA.status).toBe(201);

    const createB = await testApp.app.fetch(
      new Request("https://test/api/v1/feedback", {
        method: "POST",
        headers: {
          authorization: `Bearer ${ownerBToken}`,
          "content-type": "application/json",
          ...csrfHeaders("d".repeat(64)),
        },
        body: JSON.stringify(feedbackPayloadB),
      }),
    );
    expect(createB.status).toBe(201);

    const ownerAList = await testApp.app.fetch(
      new Request("https://test/api/v1/feedback?page=1&limit=20", {
        headers: { authorization: `Bearer ${ownerAToken}` },
      }),
    );
    expect(ownerAList.status).toBe(200);
    const ownerAJson: any = await ownerAList.json();
    expect(Array.isArray(ownerAJson.feedback)).toBe(true);
    expect(ownerAJson.feedback).toHaveLength(1);
    expect(ownerAJson.feedback[0].user.id).toBe(ownerA.id);

    const ownerAStats = await testApp.app.fetch(
      new Request("https://test/api/v1/feedback/stats", {
        headers: { authorization: `Bearer ${ownerAToken}` },
      }),
    );
    expect(ownerAStats.status).toBe(403);

    const adminStats = await testApp.app.fetch(
      new Request("https://test/api/v1/feedback/stats", {
        headers: { authorization: `Bearer ${adminToken}` },
      }),
    );
    expect(adminStats.status).toBe(200);
    const adminStatsJson: any = await adminStats.json();
    expect(adminStatsJson.success).toBe(true);
  });
});
