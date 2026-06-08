import { expect, test } from "@playwright/test";
import {
  firstAvailableMenuItemId,
  optionalEnv,
  resolveLocalSmokeFixtureIds,
  smokeLogin,
  type SmokeLoginData,
} from "../smoke/smoke-env";

const API_URL =
  optionalEnv("WORKFLOW_API_URL") ||
  optionalEnv("SMOKE_API_URL") ||
  "http://localhost:8787";
const CUSTOMER_URL =
  optionalEnv("WORKFLOW_CUSTOMER_URL") ||
  optionalEnv("SMOKE_CUSTOMER_URL") ||
  "http://localhost:3000";

const AUTH_USERNAME =
  optionalEnv("WORKFLOW_AUTH_USERNAME") || optionalEnv("SMOKE_AUTH_USERNAME");
const AUTH_PASSWORD =
  optionalEnv("WORKFLOW_AUTH_PASSWORD") || optionalEnv("SMOKE_AUTH_PASSWORD");
const RESTAURANT_ID =
  optionalEnv("WORKFLOW_RESTAURANT_ID") || optionalEnv("SMOKE_RESTAURANT_ID");
const MENU_ITEM_ID = Number(
  optionalEnv("WORKFLOW_MENU_ITEM_ID") ||
    optionalEnv("SMOKE_MENU_ITEM_ID") ||
    NaN,
);

interface MenuItemCandidate {
  id?: number | string;
  name?: string;
  isAvailable?: boolean | number;
}

interface MenuBody {
  success: boolean;
  data?: {
    menuItems?: MenuItemCandidate[];
    items?: MenuItemCandidate[];
    categories?: Array<{ items?: MenuItemCandidate[] }>;
  };
}

interface GuestOrderResponse {
  success: boolean;
  data?: {
    order?: {
      id?: number;
      orderNumber?: string;
    };
    guestToken?: string;
  };
}

let loginDataPromise: Promise<SmokeLoginData> | undefined;

function getLoginData(): Promise<SmokeLoginData> | undefined {
  if (!AUTH_USERNAME || !AUTH_PASSWORD) return undefined;

  loginDataPromise ??= smokeLogin(API_URL, AUTH_USERNAME, AUTH_PASSWORD);
  loginDataPromise = loginDataPromise.catch((error) => {
    loginDataPromise = undefined;
    throw error;
  });

  return loginDataPromise;
}

async function resolveFixtureIds() {
  return resolveLocalSmokeFixtureIds({
    apiUrl: API_URL,
    authUsername: AUTH_USERNAME,
    authPassword: AUTH_PASSWORD,
    restaurantId: RESTAURANT_ID,
    menuItemId: Number.isFinite(MENU_ITEM_ID) ? MENU_ITEM_ID : undefined,
    loginData: await getLoginData(),
  });
}

async function fetchMenu(restaurantId: string): Promise<MenuBody> {
  const response = await fetch(`${API_URL}/api/v1/menu/${restaurantId}`);
  expect(response.ok, `menu API status ${response.status}`).toBe(true);
  return (await response.json()) as MenuBody;
}

function allMenuItems(menu: MenuBody): MenuItemCandidate[] {
  return [
    ...(menu.data?.menuItems ?? []),
    ...(menu.data?.items ?? []),
    ...(menu.data?.categories ?? []).flatMap(
      (category) => category.items ?? [],
    ),
  ];
}

function firstAvailableNamedMenuItem(menu: MenuBody) {
  return allMenuItems(menu).find(
    (item) =>
      item.name &&
      item.isAvailable !== false &&
      item.isAvailable !== 0 &&
      Number.isFinite(Number(item.id)),
  );
}

test.describe.configure({ mode: "serial" });

test.describe("Real system workflows", () => {
  test("API and customer SPA are both reachable without mocks", async ({
    page,
  }) => {
    const infoResponse = await fetch(`${API_URL}/info`);
    expect(infoResponse.status, `${API_URL}/info status`).toBe(200);

    const response = await page.goto(CUSTOMER_URL, {
      waitUntil: "domcontentloaded",
    });
    expect(response?.ok(), `${CUSTOMER_URL} should serve the app`).toBe(true);
    await expect(page.locator("#app")).toBeVisible();
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  });

  test("customer menu page renders menu data served by the real API", async ({
    page,
  }) => {
    const fixtureIds = await resolveFixtureIds();
    test.skip(
      !fixtureIds.restaurantId,
      "WORKFLOW_RESTAURANT_ID/SMOKE_RESTAURANT_ID not set and local discovery failed",
    );

    const menu = await fetchMenu(fixtureIds.restaurantId!);
    const item = firstAvailableNamedMenuItem(menu);
    test.skip(!item?.name, "real API did not return an available named item");

    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes(`/api/v1/menu/${fixtureIds.restaurantId}`) &&
          response.ok(),
      ),
      page.goto(
        `${CUSTOMER_URL}/restaurant/${fixtureIds.restaurantId}/table/1`,
        { waitUntil: "domcontentloaded" },
      ),
    ]);

    await expect(page.getByTestId("cart-btn")).toBeVisible();
    await expect(page.getByText(item!.name!, { exact: false })).toBeVisible();
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  });

  test("guest order created by the real API is readable in customer tracking UI", async ({
    page,
  }) => {
    const fixtureIds = await resolveFixtureIds();
    test.skip(
      !fixtureIds.restaurantId || fixtureIds.menuItemId === undefined,
      "WORKFLOW_RESTAURANT_ID and WORKFLOW_MENU_ITEM_ID are required for guest workflow",
    );

    const menu = await fetchMenu(fixtureIds.restaurantId!);
    const menuItemId =
      fixtureIds.menuItemId ?? firstAvailableMenuItemId(menu as any);
    test.skip(menuItemId === undefined, "real API did not return a menu item");

    const createResponse = await fetch(`${API_URL}/api/v1/guest-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId: fixtureIds.restaurantId,
        orderType: "shop",
        items: [{ menuItemId, quantity: 1 }],
        guestName: "workflow-test",
        phoneLastDigits: String(100 + Math.floor(Math.random() * 900)),
      }),
    });
    expect(
      createResponse.ok,
      `guest order create status ${createResponse.status}`,
    ).toBe(true);

    const createBody = (await createResponse.json()) as GuestOrderResponse;
    const orderId = createBody.data?.order?.id;
    const orderNumber = createBody.data?.order?.orderNumber;
    const guestToken = createBody.data?.guestToken;

    expect(typeof orderId, "created order id").toBe("number");
    expect(typeof guestToken, "created guest token").toBe("string");

    await page.addInitScript((token) => {
      window.localStorage.setItem("guest_auth_token", token);
    }, guestToken);

    try {
      await page.goto(
        `${CUSTOMER_URL}/restaurant/${fixtureIds.restaurantId}/shop/order/${orderId}`,
        { waitUntil: "domcontentloaded" },
      );

      await expect(page.getByTestId("order-timeline")).toBeVisible();
      if (orderNumber) {
        await expect(
          page.getByText(orderNumber, { exact: false }),
        ).toBeVisible();
      }
      await expect(page.locator("vite-error-overlay")).toHaveCount(0);
    } finally {
      await fetch(`${API_URL}/api/v1/guest-orders/${orderId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${guestToken}` },
      }).catch(() => {
        /* best-effort cleanup */
      });
    }
  });
});
