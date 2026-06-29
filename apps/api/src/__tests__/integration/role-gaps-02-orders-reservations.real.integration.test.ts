import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";

describe("Role gap coverage: reservations & order status transitions", () => {
  let testApp: RealIntegrationTestApp;
  let seed: ReturnType<typeof buildSeedHelpers>;

  function csrfHeaders(token: string) {
    return {
      host: "test",
      origin: "https://test",
      "x-csrf-token": token,
      cookie: `csrf_token=${token}`,
    };
  }

  async function insertActiveSubscription(restaurantId: string) {
    await testApp.env.DB.prepare(
      `INSERT INTO shop_subscriptions
        (id, restaurant_id, plan_tier, module_overrides,
         is_active, trial_ends_at_ms, created_at_ms, updated_at_ms)
       VALUES (?, ?, 'trial', '{}', 1, ?, ?, ?)`,
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

  async function insertReservationForRestaurant(
    restaurantId: string,
    status: string = "pending",
  ): Promise<{ id: string }> {
    const id = `res-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    await testApp.env.DB.prepare(
      `INSERT INTO reservations
        (id, restaurant_id, customer_name, customer_phone, party_size,
         reservation_date, reservation_time, confirmation_code, status, created_at,
         updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        restaurantId,
        "Ticket-02 User",
        "0912345678",
        2,
        "2026-05-28",
        "18:30",
        `CONF-${Math.random().toString(36).slice(2, 12)}`,
        status,
        now,
        now,
      )
      .run();

    return { id };
  }

  // ── reservations role matrix ─────────────────────────────────────────────

  it("denies service role from reservations list but allows single-record access and seat action in own scope", async () => {
    const restaurant = await seed.restaurant();
    const crossRestaurant = await seed.restaurant({
      name: "Ticket 02 Cross Restaurant",
    });
    await insertActiveSubscription(String(restaurant.id));
    await insertActiveSubscription(String(crossRestaurant.id));
    const serviceUser = await seed.user({
      username: "service-role-02",
      role: 3,
      restaurantId: String(restaurant.id),
    });
    const serviceToken = await testApp.authHelper.staffToken(
      serviceUser.id,
      3,
      String(restaurant.id),
    );

    const reservationA = await insertReservationForRestaurant(
      String(restaurant.id),
    );
    const reservationB = await insertReservationForRestaurant(
      String(crossRestaurant.id),
    );

    const listRes = await testApp.app.fetch(
      new Request("https://test/api/v1/reservations", {
        headers: { authorization: `Bearer ${serviceToken}` },
      }),
    );
    expect(listRes.status).toBe(403);

    const detailRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/reservations/${reservationA.id}`, {
        headers: { authorization: `Bearer ${serviceToken}` },
      }),
    );
    expect(detailRes.status).toBe(200);

    const confirmRes = await testApp.app.fetch(
      new Request(
        `https://test/api/v1/reservations/${reservationA.id}/confirm`,
        {
          method: "POST",
          headers: {
            ...csrfHeaders(
              "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
            ),
            authorization: `Bearer ${serviceToken}`,
            "content-type": "application/json",
          },
        },
      ),
    );
    expect(confirmRes.status).toBe(403);

    const seatRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/reservations/${reservationA.id}/seat`, {
        method: "POST",
        headers: {
          ...csrfHeaders(
            "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
          ),
          authorization: `Bearer ${serviceToken}`,
          "content-type": "application/json",
        },
      }),
    );
    expect(seatRes.status).toBe(200);

    const crossDetailRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/reservations/${reservationB.id}`, {
        headers: { authorization: `Bearer ${serviceToken}` },
      }),
    );
    expect(crossDetailRes.status).toBe(403);
  });

  // ── orders status role matrix ───────────────────────────────────────────

  it("enforces role-based status permissions for role2/3 in orders", async () => {
    const restaurant = await seed.restaurant();
    await insertActiveSubscription(String(restaurant.id));
    const chefUser = await seed.user({
      username: "chef-role-02",
      role: 2,
      restaurantId: String(restaurant.id),
    });
    const serviceUser = await seed.user({
      username: "service-role-02-status",
      role: 3,
      restaurantId: String(restaurant.id),
    });
    const chefToken = await testApp.authHelper.staffToken(
      chefUser.id,
      2,
      String(restaurant.id),
    );
    const serviceToken = await testApp.authHelper.staffToken(
      serviceUser.id,
      3,
      String(restaurant.id),
    );

    const pendingOrder = await seed.order(restaurant.id, { status: "pending" });
    const confirmedOrder = await seed.order(restaurant.id, {
      status: "confirmed",
    });
    const readyOrder = await seed.order(restaurant.id, { status: "ready" });

    const serviceConfirmRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/orders/${pendingOrder.id}/status`, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${serviceToken}`,
          "content-type": "application/json",
          ...csrfHeaders(
            "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          ),
        },
        body: JSON.stringify({ status: "confirmed" }),
      }),
    );
    expect(serviceConfirmRes.status).toBe(403);

    const chefConfirmedRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/orders/${pendingOrder.id}/status`, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${chefToken}`,
          "content-type": "application/json",
          ...csrfHeaders(
            "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
          ),
        },
        body: JSON.stringify({ status: "confirmed" }),
      }),
    );
    expect(chefConfirmedRes.status).toBe(403);

    const chefPreparingRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/orders/${confirmedOrder.id}/status`, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${chefToken}`,
          "content-type": "application/json",
          ...csrfHeaders(
            "1111111111111111111111111111111111111111111111111111111111111111",
          ),
        },
        body: JSON.stringify({ status: "preparing" }),
      }),
    );
    expect(chefPreparingRes.status).toBe(200);

    const serviceDeliveredRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/orders/${readyOrder.id}/status`, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${serviceToken}`,
          "content-type": "application/json",
          ...csrfHeaders(
            "2222222222222222222222222222222222222222222222222222222222222222",
          ),
        },
        body: JSON.stringify({ status: "delivered" }),
      }),
    );
    expect(serviceDeliveredRes.status).toBe(200);

    const chefDeliveredRes = await testApp.app.fetch(
      new Request(`https://test/api/v1/orders/${readyOrder.id}/status`, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${chefToken}`,
          "content-type": "application/json",
          ...csrfHeaders(
            "3333333333333333333333333333333333333333333333333333333333333333",
          ),
        },
        body: JSON.stringify({ status: "delivered" }),
      }),
    );
    expect(chefDeliveredRes.status).toBe(403);
  });
});
