import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  createRealIntegrationTestApp,
  type RealIntegrationTestApp,
} from "./helpers/real-test-app";
import { buildSeedHelpers } from "./helpers/seed-helper";

/**
 * Cross-tenant isolation on the forecast endpoints (#275).
 *
 * All five /forecast/* routes carried authMiddleware + requireRole + a
 * moduleGate, and nothing else. `moduleGate` resolves the caller's OWN
 * restaurantId off the JWT (middleware/moduleGate.ts:154-157), so it never
 * looks at the path — the `:restaurantId` segment reached the services
 * unchecked.
 *
 * This is the #265 shape one step worse: there the guard checked the path
 * parameter and the second identifier slipped past; here nobody checked the
 * path parameter at all.
 *
 * The write side is an upsert, not an append — ForecastService.ts:606-625
 * targets (restaurantId, forecastDate, forecastType) with onConflictDoUpdate —
 * so a generate against another restaurant overwrites their cached forecast.
 * Even the GETs write: getIngredientForecast falls through to on-demand
 * generation on a cache miss.
 *
 * Real D1 rather than a route test, because a mocked service cannot show that
 * the victim's forecast_cache row survived.
 */
describe("Forecast endpoints — cross-tenant isolation", () => {
  let testApp: RealIntegrationTestApp;
  let seed: ReturnType<typeof buildSeedHelpers>;

  beforeAll(async () => {
    testApp = await createRealIntegrationTestApp();
    seed = buildSeedHelpers(testApp.testDb);
  });

  afterAll(async () => {
    await testApp?.dispose();
  });

  beforeEach(async () => {
    await testApp.testDb.truncateAll();
  });

  /**
   * trial grants both analytics and inventory, and is the schema default for
   * plan_tier — so in production these gates are open by default. Granting
   * them explicitly here keeps the negative tests honest: without a
   * subscription row they would 403 on SUBSCRIPTION_NOT_FOUND and never reach
   * the ownership check they exist to cover.
   */
  async function grantForecastModules(restaurantId: string) {
    await testApp.testDb.bindings.DB.prepare(
      `INSERT INTO shop_subscriptions
         (id, restaurant_id, plan_tier, is_active, module_overrides)
       VALUES (?, ?, 'pro', 1, '{"analytics":true,"inventory":true}')`,
    )
      .bind(crypto.randomUUID(), restaurantId)
      .run();
  }

  const VICTIM_DATE = "2026-08-27";

  async function seedVictimForecast(restaurantId: string) {
    await testApp.testDb.bindings.DB.prepare(
      `INSERT INTO forecast_cache
         (restaurant_id, forecast_date, forecast_type, data, metadata,
          generated_by, expires_at_ms, created_at_ms)
       VALUES (?, ?, 'item_level', ?, ?, 'statistical', ?, ?)`,
    )
      .bind(
        restaurantId,
        VICTIM_DATE,
        JSON.stringify({
          "1": { predicted: 42, confidence: 0.9, trend: "up" },
        }),
        JSON.stringify({ marker: "victim-original" }),
        Date.now() + 86_400_000,
        Date.now(),
      )
      .run();
  }

  async function readVictimForecast(restaurantId: string) {
    const rows = await testApp.testDb.bindings.DB.prepare(
      `SELECT forecast_date, forecast_type, data, metadata, generated_by
         FROM forecast_cache
        WHERE restaurant_id = ?
        ORDER BY forecast_date`,
    )
      .bind(restaurantId)
      .all<{
        forecast_date: string;
        forecast_type: string;
        data: string;
        metadata: string;
        generated_by: string;
      }>();
    return rows.results;
  }

  async function twoRestaurants() {
    const attacker = await seed.restaurant();
    const victim = await seed.restaurant();
    await grantForecastModules(String(attacker.id));
    await grantForecastModules(String(victim.id));

    // The victim's trade secrets: a dish, an ingredient, and the BOM that ties
    // them together — exactly what ingredient-forecast unwraps.
    const victimItem = await seed.menuItem(victim.id, {
      name: "B店招牌生魚片",
      priceCents: 88000,
      isAvailable: true,
    });
    const now = Date.now();
    const ing = await testApp.testDb.bindings.DB.prepare(
      `INSERT INTO ingredient_definitions
         (restaurant_id, name, unit, current_stock, is_active,
          created_at_ms, updated_at_ms)
       VALUES (?, 'B店黑鮪魚大腹', 'kg', 3.5, 1, ?, ?)
       RETURNING id`,
    )
      .bind(String(victim.id), now, now)
      .first<{ id: number }>();
    await testApp.testDb.bindings.DB.prepare(
      `INSERT INTO menu_item_ingredients
         (menu_item_id, ingredient_id, quantity_per_serving, unit,
          is_optional, created_at_ms, updated_at_ms)
       VALUES (?, ?, 0.2, 'kg', 0, ?, ?)`,
    )
      .bind(victimItem.id, ing!.id, now, now)
      .run();

    await seedVictimForecast(String(victim.id));

    const token = await testApp.authHelper.ownerToken(1, attacker.id);
    return { attacker, victim, token };
  }

  const CSRF = "a".repeat(64);

  function call(path: string, token: string, method = "GET", body?: unknown) {
    return testApp.app.fetch(
      new Request(`https://test/api/v1${path}`, {
        method,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
          "x-csrf-token": CSRF,
          cookie: `__Host-mm_csrf=${CSRF}`,
          origin: "http://localhost:3001",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      }),
    );
  }

  // Each endpoint has its own required query shape; sending the wrong one
  // yields a 400 that would pass a naive "not 200" assertion for the wrong
  // reason. These are the shapes validation.ts actually accepts.
  const RANGE = `startDate=${VICTIM_DATE}&endDate=${VICTIM_DATE}`;

  it.each([
    [`?date=${VICTIM_DATE}`, "demand forecast"],
    [`/accuracy?${RANGE}`, "accuracy"],
    ["/alerts", "alerts"],
  ])("refuses to read another restaurant's %s", async (suffix) => {
    const { victim, token } = await twoRestaurants();

    const res = await call(`/forecast/${victim.id}${suffix}`, token);

    expect(res.status).toBe(403);
  });

  it("refuses to read another restaurant's ingredient forecast, and leaks no ingredient or stock", async () => {
    const { victim, token } = await twoRestaurants();

    const res = await call(
      `/forecast/${victim.id}/ingredient-forecast?${RANGE}`,
      token,
    );

    expect(res.status).toBe(403);
    // explodeForecast returns ingredientName / currentStock / gap and the
    // contributing dish names — the victim's stock levels and recipe makeup.
    const body = await res.text();
    expect(body).not.toContain("B店黑鮪魚大腹");
    expect(body).not.toContain("B店招牌生魚片");
    expect(body).not.toContain("3.5");
  });

  it("refuses to generate over another restaurant's forecast, and leaves the cached row intact", async () => {
    const { victim, token } = await twoRestaurants();
    const before = await readVictimForecast(String(victim.id));
    expect(before).toHaveLength(1);
    expect(before[0].metadata).toContain("victim-original");

    const res = await call(`/forecast/${victim.id}/generate`, token, "POST", {
      startDate: VICTIM_DATE,
      endDate: VICTIM_DATE,
      type: "item_level",
    });

    expect(res.status).toBe(403);
    // The write is onConflictDoUpdate on (restaurantId, date, type), so a
    // successful call would have replaced this row rather than added one.
    await expect(readVictimForecast(String(victim.id))).resolves.toEqual(
      before,
    );
  });

  it("does not write a forecast row for another restaurant through a read", async () => {
    const { victim, token } = await twoRestaurants();

    // getIngredientForecast falls through to on-demand generation on a cache
    // miss, so even a GET could seed the victim's cache.
    await call(`/forecast/${victim.id}/ingredient-forecast?${RANGE}`, token);

    const rows = await readVictimForecast(String(victim.id));
    expect(rows.filter((r) => r.forecast_type === "ingredient_level")).toEqual(
      [],
    );
  });

  it("still lets an owner read and generate their own forecast", async () => {
    const { attacker, token } = await twoRestaurants();

    const read = await call(
      `/forecast/${attacker.id}?date=${VICTIM_DATE}`,
      token,
    );
    expect(read.status).toBe(200);

    const generate = await call(
      `/forecast/${attacker.id}/generate`,
      token,
      "POST",
      { startDate: VICTIM_DATE, endDate: VICTIM_DATE, type: "item_level" },
    );
    expect(generate.status).toBe(200);
  });
});
