import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";

vi.unmock("drizzle-orm/d1");

function withCsrf(
  headers: Record<string, string> = {},
): Record<string, string> {
  const csrfToken = "b".repeat(64);
  return {
    host: "test",
    origin: "https://test",
    "x-csrf-token": csrfToken,
    cookie: `csrf_token=${csrfToken}`,
    ...headers,
  };
}

describe("Tables API - real integration", () => {
  let testApp: RealIntegrationTestApp;
  let seed: ReturnType<typeof buildSeedHelpers>;

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

  it("creates a table, exposes the public QR lookup, and round-trips occupancy state", async () => {
    const restaurant = await seed.restaurant();
    const admin = await seed.user({ id: 1, role: 0, username: "test-admin" });
    const order = await seed.order(String(restaurant.id));
    const token = await testApp.authHelper.adminToken(String(restaurant.id));

    const createRes = await testApp.app.fetch(
      new Request("https://test/api/v1/tables", {
        method: "POST",
        headers: withCsrf({
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        }),
        body: JSON.stringify({
          restaurantId: String(restaurant.id),
          number: "T-07",
          name: "Dogfood Window Table",
          capacity: 4,
          floor: 2,
          section: "Dining",
          location: "Window",
          isReservable: true,
          features: {
            hasWifi: true,
            hasChargingPort: true,
          },
        }),
      }),
    );

    expect(createRes.status).toBe(201);
    const createJson: any = await createRes.json();
    expect(createJson.success).toBe(true);
    const createdTable = createJson.data;
    expect(createdTable.id).toBeTruthy();
    expect(createdTable.restaurantId).toBe(String(restaurant.id));
    expect(createdTable.isOccupied).toBe(false);
    expect(createdTable.qrCode).toContain("t=table");
    expect(createdTable.qrCode).toContain(`r=${restaurant.id}`);

    const occupyRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/tables/${createdTable.id}/occupy`, {
        method: "POST",
        headers: withCsrf({
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        }),
        body: JSON.stringify({
          orderId: order.id,
          occupiedBy: "Walk-in guest",
          estimatedMinutes: 45,
        }),
      }),
    );

    expect(occupyRes.status).toBe(200);
    const occupyJson: any = await occupyRes.json();
    expect(occupyJson.success).toBe(true);

    const getOccupiedRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/tables/${createdTable.id}`, {
        headers: { authorization: `Bearer ${token}` },
      }),
    );

    expect(getOccupiedRes.status).toBe(200);
    const getOccupiedJson: any = await getOccupiedRes.json();
    expect(getOccupiedJson.success).toBe(true);
    expect(getOccupiedJson.data.id).toBe(createdTable.id);
    expect(getOccupiedJson.data.isOccupied).toBe(true);
    expect(getOccupiedJson.data.currentOrderId).toBe(order.id);
    expect(getOccupiedJson.data.occupiedBy).toBe("Walk-in guest");

    const publicLookupRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/tables/qr/${encodeURIComponent(createdTable.qrCode)}`,
      ),
    );

    expect(publicLookupRes.status).toBe(200);
    const publicLookupJson: any = await publicLookupRes.json();
    expect(publicLookupJson.success).toBe(true);
    expect(publicLookupJson.data.id).toBe(createdTable.id);
    expect(publicLookupJson.data.number).toBe("T-07");
    expect(publicLookupJson.data.isOccupied).toBe(true);
    expect(publicLookupJson.data).not.toHaveProperty("currentOrderId");
    expect(publicLookupJson.data).not.toHaveProperty("occupiedBy");

    const releaseRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/tables/${createdTable.id}/release`, {
        method: "POST",
        headers: withCsrf({
          authorization: `Bearer ${token}`,
        }),
      }),
    );

    expect(releaseRes.status).toBe(200);
    const releaseJson: any = await releaseRes.json();
    expect(releaseJson.success).toBe(true);

    const getReleasedRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/tables/${createdTable.id}`, {
        headers: { authorization: `Bearer ${token}` },
      }),
    );

    expect(getReleasedRes.status).toBe(200);
    const getReleasedJson: any = await getReleasedRes.json();
    expect(getReleasedJson.success).toBe(true);
    expect(getReleasedJson.data.isOccupied).toBe(false);
    expect(getReleasedJson.data.currentOrderId).toBeNull();
    expect(getReleasedJson.data.occupiedBy).toBeNull();
    expect(getReleasedJson.data.totalUsage).toBeGreaterThanOrEqual(1);

    expect(admin.id).toBe(1);
  });
});
