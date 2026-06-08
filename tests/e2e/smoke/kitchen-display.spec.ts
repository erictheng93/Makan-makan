/**
 * Kitchen Display smoke canary.
 *
 * Layer 1 always verifies the deployed/static kitchen app returns HTML.
 * Layer 2 runs only when SMOKE_KITCHEN_USERNAME / SMOKE_KITCHEN_PASSWORD are
 * configured, proving a chef can authenticate and read their kitchen queue.
 */

import { expect, test } from "@playwright/test";
import { optionalEnv, smokeLogin } from "./smoke-env";

const API_URL = process.env.SMOKE_API_URL || "http://localhost:8787";
const KITCHEN_URL =
  process.env.SMOKE_KITCHEN_URL ||
  process.env.E2E_KITCHEN_URL ||
  "http://localhost:3002";

const KITCHEN_USERNAME = optionalEnv("SMOKE_KITCHEN_USERNAME");
const KITCHEN_PASSWORD = optionalEnv("SMOKE_KITCHEN_PASSWORD");
const KITCHEN_RESTAURANT_ID = optionalEnv("SMOKE_KITCHEN_RESTAURANT_ID");
const REQUIRE_KITCHEN_AUTH =
  optionalEnv("SMOKE_REQUIRE_KITCHEN_AUTH") === "true";

test.describe("Smoke: Kitchen Display", () => {
  test("GET / returns HTML for the kitchen app", async () => {
    const response = await fetch(KITCHEN_URL);
    expect(response.status, `${KITCHEN_URL} status`).toBeGreaterThanOrEqual(
      200,
    );
    expect(response.status).toBeLessThan(400);
    expect(response.headers.get("content-type")?.toLowerCase()).toContain(
      "html",
    );
  });

  test("chef login can read the kitchen queue when credentials are configured", async () => {
    if (REQUIRE_KITCHEN_AUTH) {
      expect(
        KITCHEN_USERNAME,
        "SMOKE_KITCHEN_USERNAME is required when SMOKE_REQUIRE_KITCHEN_AUTH=true",
      ).toBeTruthy();
      expect(
        KITCHEN_PASSWORD,
        "SMOKE_KITCHEN_PASSWORD is required when SMOKE_REQUIRE_KITCHEN_AUTH=true",
      ).toBeTruthy();
    }

    test.skip(
      !REQUIRE_KITCHEN_AUTH && (!KITCHEN_USERNAME || !KITCHEN_PASSWORD),
      "SMOKE_KITCHEN_USERNAME / SMOKE_KITCHEN_PASSWORD not set",
    );

    const loginData = await smokeLogin(
      API_URL,
      KITCHEN_USERNAME!,
      KITCHEN_PASSWORD!,
    );
    expect(loginData.user?.role, "smoke user must be a chef").toBe(2);

    const restaurantId =
      KITCHEN_RESTAURANT_ID ?? loginData.user?.restaurantId ?? undefined;
    expect(
      restaurantId,
      "kitchen smoke needs a restaurant id from env or login response",
    ).toBeTruthy();

    const response = await fetch(
      `${API_URL}/api/v1/kitchen/${restaurantId}/orders`,
      {
        headers: { Authorization: `Bearer ${loginData.token}` },
      },
    );
    expect(response.ok, `kitchen queue status ${response.status}`).toBe(true);

    const body = (await response.json()) as {
      success?: boolean;
      data?: {
        pending?: unknown[];
        preparing?: unknown[];
        ready?: unknown[];
        stats?: unknown;
      };
    };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data?.pending)).toBe(true);
    expect(Array.isArray(body.data?.preparing)).toBe(true);
    expect(Array.isArray(body.data?.ready)).toBe(true);
    expect(typeof body.data?.stats).toBe("object");
  });
});
