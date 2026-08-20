import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";
import { readData, readEnvelope, type ServiceData } from "../helpers/read-json";
import type { TablesService } from "../../features/tables/services/TablesService";

type Table = ServiceData<TablesService["getTableById"]>;
type TableList = ServiceData<TablesService["getRestaurantTables"]>["tables"];
type PublicTableInfo = ReturnType<TablesService["getPublicTableInfo"]>;
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
    const createJson = await readData<Table>(createRes);
    const createdTable = createJson;
    expect(createdTable.id).toBeTruthy();
    expect(createdTable.restaurantId).toBe(String(restaurant.id));
    expect(createdTable.isOccupied).toBe(false);
    const createdQrCode = createdTable.qrCode;
    if (!createdQrCode) {
      throw new Error("created table came back without a qrCode");
    }
    expect(createdQrCode).toContain("t=table");
    expect(createdQrCode).toContain(`r=${restaurant.id}`);

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
    const occupyJson = await readEnvelope(occupyRes);
    expect(occupyJson.success).toBe(true);

    const getOccupiedRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/tables/${createdTable.id}`, {
        headers: { authorization: `Bearer ${token}` },
      }),
    );

    expect(getOccupiedRes.status).toBe(200);
    const getOccupiedJson = await readData<Table>(getOccupiedRes);
    expect(getOccupiedJson.id).toBe(createdTable.id);
    expect(getOccupiedJson.isOccupied).toBe(true);
    expect(getOccupiedJson.currentOrderId).toBe(order.id);
    expect(getOccupiedJson.occupiedBy).toBe("Walk-in guest");

    const publicLookupRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/tables/qr/${encodeURIComponent(createdQrCode)}`,
      ),
    );

    expect(publicLookupRes.status).toBe(200);
    const publicLookupJson = await readData<PublicTableInfo>(publicLookupRes);
    expect(publicLookupJson.id).toBe(createdTable.id);
    expect(publicLookupJson.number).toBe("T-07");
    expect(publicLookupJson.isOccupied).toBe(true);
    expect(publicLookupJson).not.toHaveProperty("currentOrderId");
    expect(publicLookupJson).not.toHaveProperty("occupiedBy");

    const releaseRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/tables/${createdTable.id}/release`, {
        method: "POST",
        headers: withCsrf({
          authorization: `Bearer ${token}`,
        }),
      }),
    );

    expect(releaseRes.status).toBe(200);
    const releaseJson = await readEnvelope(releaseRes);
    expect(releaseJson.success).toBe(true);

    const getReleasedRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/tables/${createdTable.id}`, {
        headers: { authorization: `Bearer ${token}` },
      }),
    );

    expect(getReleasedRes.status).toBe(200);
    const getReleasedJson = await readData<Table>(getReleasedRes);
    expect(getReleasedJson.isOccupied).toBe(false);
    expect(getReleasedJson.currentOrderId).toBeNull();
    expect(getReleasedJson.occupiedBy).toBeNull();
    expect(getReleasedJson.totalUsage).toBeGreaterThanOrEqual(1);

    // The list projection must carry qrCode: the admin table-setup grid renders
    // the QR straight from this payload, and without it every card, the preview
    // modal, download and print come out blank.
    const listRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/tables?restaurantId=${encodeURIComponent(String(restaurant.id))}`,
        { headers: { authorization: `Bearer ${token}` } },
      ),
    );

    expect(listRes.status).toBe(200);
    const listJson = await readData<TableList>(listRes);
    const listed = listJson.find((t) => t.id === createdTable.id);
    if (!listed) {
      throw new Error(`table ${createdTable.id} missing from the list`);
    }
    expect(listed.qrCode).toBe(createdTable.qrCode);

    expect(admin.id).toBe("01900000-0000-7000-8000-000000000001");
  });
});
