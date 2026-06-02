import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";

function csrfHeaders(token: string) {
  const csrfToken = "c".repeat(64);
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    host: "test",
    origin: "https://test",
    "x-csrf-token": csrfToken,
    cookie: `csrf_token=${csrfToken}`,
  };
}

describe("Role gap coverage: tables and seats owner boundaries", () => {
  let testApp: RealIntegrationTestApp;
  let seed: ReturnType<typeof buildSeedHelpers>;

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

  async function createTable(
    restaurantId: string,
    ownerToken: string,
    suffix: string,
  ): Promise<{ id: number }> {
    const createRes = await testApp.app.fetch(
      new Request("https://test/api/v1/tables", {
        method: "POST",
        headers: csrfHeaders(ownerToken),
        body: JSON.stringify({
          restaurantId,
          number: `T-${suffix}`,
          name: `Table ${suffix}`,
          capacity: 4,
          floor: 1,
          section: "Main",
          location: "Window",
          isReservable: true,
        }),
      }),
    );

    expect(createRes.status).toBe(201);
    const createJson: any = await createRes.json();
    expect(createJson.success).toBe(true);
    return { id: createJson.data.id };
  }

  async function createSeats(
    ownerToken: string,
    tableId: number,
    seatCount = 2,
  ): Promise<{ id: number }> {
    const seatRes = await testApp.app.fetch(
      new Request("https://test/api/v1/seats/batch-create", {
        method: "POST",
        headers: {
          ...csrfHeaders(ownerToken),
          authorization: `Bearer ${ownerToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          tableId,
          seatCount,
          numberingStyle: "numeric",
        }),
      }),
    );

    expect(seatRes.status).toBe(201);
    const seatJson: any = await seatRes.json();
    expect(seatJson.success).toBe(true);
    expect(seatJson.data).toHaveLength(seatCount);

    return { id: seatJson.data[0].id };
  }

  it("covers table boundary for own vs cross-restaurant operations", async () => {
    const restaurantA = await seed.restaurant({ name: "Owner A" });
    const restaurantB = await seed.restaurant({ name: "Owner B" });
    await insertActiveSubscription(String(restaurantA.id));
    await insertActiveSubscription(String(restaurantB.id));

    const ownerAUser = await seed.user({
      username: "owner-a-03",
      role: 1,
      restaurantId: String(restaurantA.id),
    });
    const ownerBUser = await seed.user({
      username: "owner-b-03",
      role: 1,
      restaurantId: String(restaurantB.id),
    });

    const ownerAToken = await testApp.authHelper.ownerToken(
      ownerAUser.id,
      String(restaurantA.id),
    );
    const ownerBToken = await testApp.authHelper.ownerToken(
      ownerBUser.id,
      String(restaurantB.id),
    );

    const tableA = await createTable(String(restaurantA.id), ownerAToken, "A1");
    const tableB = await createTable(String(restaurantB.id), ownerBToken, "B1");

    const tableListRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/tables?restaurantId=${restaurantA.id}`, {
        headers: { authorization: `Bearer ${ownerAToken}` },
      }),
    );
    expect(tableListRes.status).toBe(200);
    const tableList: any = await tableListRes.json();
    expect(tableList.success).toBe(true);

    const tableCrossRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/tables/${tableB.id}`, {
        headers: { authorization: `Bearer ${ownerAToken}` },
      }),
    );
    expect(tableCrossRes.status).toBe(403);

    const tableCreateCrossRes = await testApp.app.fetch(
      new Request("https://test/api/v1/tables", {
        method: "POST",
        headers: csrfHeaders(ownerAToken),
        body: JSON.stringify({
          restaurantId: String(restaurantB.id),
          number: "T-HIJACK",
          name: "Hijack",
          capacity: 4,
          floor: 1,
          section: "Main",
          location: "Window",
          isReservable: true,
        }),
      }),
    );
    expect(tableCreateCrossRes.status).toBe(403);

    const tableUpdateCrossRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/tables/${tableB.id}`, {
        method: "PUT",
        headers: csrfHeaders(ownerAToken),
        body: JSON.stringify({ name: "Updated from ownerA" }),
      }),
    );
    expect(tableUpdateCrossRes.status).toBe(403);

    const tableDeleteCrossRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/tables/${tableB.id}`, {
        method: "DELETE",
        headers: csrfHeaders(ownerAToken),
      }),
    );
    expect(tableDeleteCrossRes.status).toBe(403);

    const tableBOwnRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/tables/${tableB.id}`, {
        headers: { authorization: `Bearer ${ownerBToken}` },
      }),
    );
    expect(tableBOwnRes.status).toBe(200);
  });

  it("covers seat boundary for own vs cross-restaurant operations", async () => {
    const restaurantA = await seed.restaurant({ name: "Seat Owner A" });
    const restaurantB = await seed.restaurant({ name: "Seat Owner B" });
    await insertActiveSubscription(String(restaurantA.id));
    await insertActiveSubscription(String(restaurantB.id));

    const ownerAUser = await seed.user({
      username: "seat-owner-a-03",
      role: 1,
      restaurantId: String(restaurantA.id),
    });
    const ownerBUser = await seed.user({
      username: "seat-owner-b-03",
      role: 1,
      restaurantId: String(restaurantB.id),
    });

    const ownerAToken = await testApp.authHelper.ownerToken(
      ownerAUser.id,
      String(restaurantA.id),
    );
    const ownerBToken = await testApp.authHelper.ownerToken(
      ownerBUser.id,
      String(restaurantB.id),
    );

    const tableA = await createTable(String(restaurantA.id), ownerAToken, "SA");
    const tableB = await createTable(String(restaurantB.id), ownerBToken, "SB");
    const seatA = await createSeats(ownerAToken, tableA.id, 1);
    const seatB = await createSeats(ownerBToken, tableB.id, 1);

    const seatListRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/seats?tableId=${tableA.id}&page=1&limit=20`,
        {
          headers: { authorization: `Bearer ${ownerAToken}` },
        },
      ),
    );
    expect(seatListRes.status).toBe(200);
    const seatList: any = await seatListRes.json();
    expect(seatList.success).toBe(true);
    expect(Array.isArray(seatList.data)).toBe(true);

    const seatCrossCreateRes = await testApp.app.fetch(
      new Request("https://test/api/v1/seats/batch-create", {
        method: "POST",
        headers: {
          ...csrfHeaders(ownerAToken),
          authorization: `Bearer ${ownerAToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          tableId: tableB.id,
          seatCount: 1,
          numberingStyle: "numeric",
        }),
      }),
    );
    expect(seatCrossCreateRes.status).toBe(403);

    const seatCrossGetRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/seats/${seatB.id}`, {
        headers: { authorization: `Bearer ${ownerAToken}` },
      }),
    );
    expect(seatCrossGetRes.status).toBe(403);

    const seatCrossPutRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/seats/${seatB.id}`, {
        method: "PUT",
        headers: { authorization: `Bearer ${ownerAToken}` },
        body: JSON.stringify({ seatName: "跨店改名" }),
      }),
    );
    expect(seatCrossPutRes.status).toBe(403);

    const seatOwnGetRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/seats/${seatA.id}`, {
        headers: { authorization: `Bearer ${ownerAToken}` },
      }),
    );
    expect(seatOwnGetRes.status).toBe(200);
  });
});
