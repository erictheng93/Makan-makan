import { expect, test, type Page } from "@playwright/test";
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
const ADMIN_URL =
  optionalEnv("WORKFLOW_ADMIN_URL") || optionalEnv("SMOKE_ADMIN_URL");
const KITCHEN_URL =
  optionalEnv("WORKFLOW_KITCHEN_URL") || optionalEnv("SMOKE_KITCHEN_URL");
const MANAGEMENT_PORTAL_URL = optionalEnv("WORKFLOW_MANAGEMENT_PORTAL_URL");
const ONBOARDING_URL = optionalEnv("WORKFLOW_ONBOARDING_URL");
const MANAGEMENT_API_URL = optionalEnv("WORKFLOW_MANAGEMENT_API_URL");

const AUTH_USERNAME =
  optionalEnv("WORKFLOW_AUTH_USERNAME") || optionalEnv("SMOKE_AUTH_USERNAME");
const AUTH_PASSWORD =
  optionalEnv("WORKFLOW_AUTH_PASSWORD") || optionalEnv("SMOKE_AUTH_PASSWORD");
const CHEF_USERNAME = optionalEnv("WORKFLOW_CHEF_USERNAME");
const CHEF_PASSWORD = optionalEnv("WORKFLOW_CHEF_PASSWORD");
const MANAGEMENT_TOKEN = optionalEnv("WORKFLOW_MANAGEMENT_TOKEN");
const CLOUDFLARE_ACCOUNT_ID = optionalEnv("WORKFLOW_CLOUDFLARE_ACCOUNT_ID");
const CLOUDFLARE_API_TOKEN = optionalEnv("WORKFLOW_CLOUDFLARE_API_TOKEN");
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

interface OrderBody {
  success: boolean;
  data?: {
    id?: number;
    status?: string;
    items?: Array<{
      id?: number;
      status?: string;
    }>;
  };
}

interface KitchenOrdersBody {
  success: boolean;
  data?: {
    pending?: Array<{
      id?: number;
      items?: Array<{ id?: number; status?: string }>;
    }>;
    preparing?: Array<{
      id?: number;
      items?: Array<{ id?: number; status?: string }>;
    }>;
    ready?: Array<{
      id?: number;
      items?: Array<{ id?: number; status?: string }>;
    }>;
  };
}

interface LoginResponse {
  success: boolean;
  data?: {
    token?: string;
    refreshToken?: string;
    user?: SmokeLoginData["user"] & {
      id?: number;
      username?: string;
      role?: number;
      permissions?: string[];
    };
  };
}

let loginDataPromise: Promise<SmokeLoginData> | undefined;
let chefLoginDataPromise: Promise<LoginResponse["data"]> | undefined;

function csrfHeaders() {
  const token = "a".repeat(64);
  const api = new URL(API_URL);
  return {
    "X-CSRF-Token": token,
    cookie: `csrf_token=${token}`,
    origin: api.origin,
    host: api.host,
  };
}

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

async function loginChef() {
  if (!CHEF_USERNAME || !CHEF_PASSWORD) return undefined;

  chefLoginDataPromise ??= fetch(`${API_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: CHEF_USERNAME,
      password: CHEF_PASSWORD,
      system: "kitchen",
    }),
  }).then(async (response) => {
    expect(response.ok, `chef login status ${response.status}`).toBe(true);
    const body = (await response.json()) as LoginResponse;
    expect(body.success, "chef login should succeed").toBe(true);
    expect(body.data?.user?.role, "chef role").toBe(2);
    return body.data;
  });

  chefLoginDataPromise = chefLoginDataPromise.catch((error) => {
    chefLoginDataPromise = undefined;
    throw error;
  });

  return chefLoginDataPromise;
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

async function addMenuItemThroughUi(page: Page, id: number) {
  const quickAdd = page.getByTestId(`menu-item-add-${id}`).first();
  const customize = page.getByTestId(`menu-item-customize-${id}`).first();

  if ((await quickAdd.count()) > 0) {
    await quickAdd.click();
    return;
  }

  await customize.click();
  await expect(page.getByTestId("menu-item-modal")).toBeVisible();
  await page.getByTestId("menu-item-modal-add").click();
}

function adminOrderNumber(orderId: number) {
  return `ORD-${orderId.toString().padStart(6, "0")}`;
}

async function installAdminSession(page: Page, loginData: SmokeLoginData) {
  await page.addInitScript((session) => {
    window.localStorage.setItem("auth_token", session.token ?? "");
    if (session.refreshToken) {
      window.localStorage.setItem("auth_refresh_token", session.refreshToken);
    }
    if (session.user) {
      window.localStorage.setItem("auth_user", JSON.stringify(session.user));
    }
    window.localStorage.setItem("makanmakan_locale", "en-US");
    window.localStorage.setItem("locale", "en-US");
  }, loginData);
}

async function installKitchenSession(
  page: Page,
  loginData: NonNullable<LoginResponse["data"]>,
) {
  await page.addInitScript((session) => {
    window.localStorage.setItem("kitchen_auth_token", session.token ?? "");
    if (session.refreshToken) {
      window.localStorage.setItem(
        "kitchen_refresh_token",
        session.refreshToken,
      );
    }
    if (session.user) {
      window.localStorage.setItem("kitchen_user", JSON.stringify(session.user));
    }
    window.localStorage.setItem("makanmakan_locale", "en-US");
    window.localStorage.setItem("locale", "en-US");
    window.localStorage.setItem("kitchen-view-mode", "kanban");
  }, loginData);
}

async function confirmOrder(orderId: number, token: string) {
  const response = await fetch(`${API_URL}/api/v1/orders/${orderId}/status`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...csrfHeaders(),
    },
    body: JSON.stringify({ status: "confirmed" }),
  });

  expect(response.ok, `confirm order status ${response.status}`).toBe(true);
}

async function fetchOrder(orderId: number, token: string): Promise<OrderBody> {
  const response = await fetch(`${API_URL}/api/v1/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok, `fetch order status ${response.status}`).toBe(true);
  return (await response.json()) as OrderBody;
}

async function cancelOrderAsOwner(orderId: number, token: string) {
  await fetch(`${API_URL}/api/v1/orders/${orderId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...csrfHeaders(),
    },
    body: JSON.stringify({ reason: "workflow cleanup" }),
  }).catch(() => {
    /* best-effort cleanup */
  });
}

async function fetchKitchenOrders(
  restaurantId: string,
  token: string,
): Promise<KitchenOrdersBody> {
  const response = await fetch(
    `${API_URL}/api/v1/kitchen/${restaurantId}/orders`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  expect(response.ok, `fetch kitchen orders status ${response.status}`).toBe(
    true,
  );
  return (await response.json()) as KitchenOrdersBody;
}

function findKitchenOrder(body: KitchenOrdersBody, orderId: number) {
  return [
    ...(body.data?.pending ?? []),
    ...(body.data?.preparing ?? []),
    ...(body.data?.ready ?? []),
  ].find((order) => order.id === orderId);
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
    await expect(page.locator("#app[data-v-app]")).toBeVisible();
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
    await expect(
      page.getByText(item!.name!, { exact: false }).first(),
    ).toBeVisible();
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  });

  test("customer can add a real menu item to cart and submit through checkout UI", async ({
    page,
  }) => {
    const fixtureIds = await resolveFixtureIds();
    test.skip(
      !fixtureIds.restaurantId,
      "WORKFLOW_RESTAURANT_ID/SMOKE_RESTAURANT_ID not set and local discovery failed",
    );

    const menu = await fetchMenu(fixtureIds.restaurantId!);
    const item =
      allMenuItems(menu).find(
        (candidate) =>
          Number(candidate.id) === fixtureIds.menuItemId &&
          candidate.name &&
          candidate.isAvailable !== false &&
          candidate.isAvailable !== 0,
      ) ?? firstAvailableNamedMenuItem(menu);
    const menuItemId = Number(item?.id);

    test.skip(
      !item?.name || !Number.isFinite(menuItemId),
      "real API did not return an available named item",
    );

    await page.goto(
      `${CUSTOMER_URL}/restaurant/${fixtureIds.restaurantId}/table/1`,
      { waitUntil: "domcontentloaded" },
    );

    await expect(
      page.getByTestId(`menu-item-card-${menuItemId}`).first(),
    ).toBeVisible();
    await addMenuItemThroughUi(page, menuItemId);
    await expect(page.getByTestId("cart-count")).toHaveText("1");

    await page.getByTestId("cart-btn").click();
    await expect(page.getByTestId("cart-page")).toBeVisible();
    await expect(
      page.getByText(item!.name!, { exact: false }).first(),
    ).toBeVisible();

    const increaseButton = page.locator('[data-testid^="qty-increase-"]');
    await expect(increaseButton).toHaveCount(1);
    const quantityTestId = (await increaseButton.getAttribute("data-testid"))!;
    const cartItemId = quantityTestId.replace("qty-increase-", "");

    await increaseButton.click();
    await expect(
      page.getByTestId(`cart-item-quantity-${cartItemId}`),
    ).toHaveText("2");

    await page.getByTestId(`cart-item-notes-toggle-${cartItemId}`).click();
    await page
      .getByTestId(`cart-item-notes-${cartItemId}`)
      .fill("less spicy workflow note");
    await page.getByTestId("order-notes").fill("workflow table note");

    await page.locator("#customer-name").fill("Workflow UI");
    await page.locator("#customer-phone").fill("0912345678");

    let orderId: number | undefined;
    let guestToken: string | undefined;

    try {
      const createResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes("/api/v1/guest-orders") &&
          response.request().method() === "POST",
      );

      await page.getByTestId("submit-order-btn").click();
      await expect(page.getByTestId("confirmation-modal")).toBeVisible();
      await page.getByTestId("confirmation-confirm").click();

      const createResponse = await createResponsePromise;
      expect(
        createResponse.ok(),
        `guest checkout status ${createResponse.status()}`,
      ).toBe(true);
      const createRequestBody = createResponse.request().postDataJSON() as {
        guestName?: string;
        phoneLastDigits?: string;
        notes?: string;
        items?: Array<{
          menuItemId?: number;
          quantity?: number;
          notes?: string;
        }>;
      };
      expect(createRequestBody.guestName).toBe("Workflow UI");
      expect(createRequestBody.phoneLastDigits).toBe("678");
      expect(createRequestBody.notes).toBe("workflow table note");
      expect(createRequestBody.items).toEqual([
        expect.objectContaining({
          menuItemId,
          quantity: 2,
          notes: "less spicy workflow note",
        }),
      ]);
      const createBody = (await createResponse.json()) as GuestOrderResponse;
      orderId = createBody.data?.order?.id;
      guestToken = createBody.data?.guestToken;

      expect(typeof orderId, "created order id").toBe("number");
      expect(typeof guestToken, "created guest token").toBe("string");

      await expect(page.getByTestId("order-timeline")).toBeVisible();
      await expect(page.locator("vite-error-overlay")).toHaveCount(0);
    } finally {
      if (orderId && guestToken) {
        await fetch(`${API_URL}/api/v1/guest-orders/${orderId}/cancel`, {
          method: "POST",
          headers: { Authorization: `Bearer ${guestToken}` },
        }).catch(() => {
          /* best-effort cleanup */
        });
      }
    }
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
          page.getByText(orderNumber, { exact: true }),
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

  test("owner dashboard updates a real API order status", async ({ page }) => {
    test.skip(!ADMIN_URL, "WORKFLOW_ADMIN_URL/SMOKE_ADMIN_URL is required");

    const loginData = await getLoginData();
    test.skip(
      !loginData?.token || !loginData.user,
      "WORKFLOW_AUTH_USERNAME/SMOKE_AUTH_USERNAME and password are required",
    );

    const fixtureIds = await resolveFixtureIds();
    test.skip(
      !fixtureIds.restaurantId || fixtureIds.menuItemId === undefined,
      "WORKFLOW_RESTAURANT_ID and WORKFLOW_MENU_ITEM_ID are required for admin workflow",
    );

    const createResponse = await fetch(`${API_URL}/api/v1/guest-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId: fixtureIds.restaurantId,
        orderType: "table",
        tableId: 1,
        items: [{ menuItemId: fixtureIds.menuItemId, quantity: 1 }],
        guestName: "workflow-admin",
        phoneLastDigits: String(100 + Math.floor(Math.random() * 900)),
      }),
    });
    expect(
      createResponse.ok,
      `guest order create status ${createResponse.status}`,
    ).toBe(true);

    const createBody = (await createResponse.json()) as GuestOrderResponse;
    const orderId = createBody.data?.order?.id;
    const guestToken = createBody.data?.guestToken;

    expect(typeof orderId, "created order id").toBe("number");
    expect(typeof guestToken, "created guest token").toBe("string");

    await installAdminSession(page, loginData);

    try {
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.url().includes("/api/v1/orders") && response.ok(),
        ),
        page.goto(`${ADMIN_URL}/dashboard/orders`, {
          waitUntil: "domcontentloaded",
        }),
      ]);

      await expect(page.getByTestId("admin-orders-page")).toBeVisible();
      await expect(page.getByText(adminOrderNumber(orderId!))).toBeVisible();

      const updateResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/v1/orders/${orderId}/status`) &&
          response.request().method() === "PUT",
      );
      await page.getByTestId(`admin-order-update-${orderId}`).click();
      const updateResponse = await updateResponsePromise;
      expect(
        updateResponse.ok(),
        `admin order status update ${updateResponse.status()}`,
      ).toBe(true);

      await expect
        .poll(async () => {
          const body = await fetchOrder(orderId!, loginData.token!);
          return body.data?.status;
        })
        .toBe("confirmed");
      await expect(page.locator("vite-error-overlay")).toHaveCount(0);
    } finally {
      await cancelOrderAsOwner(orderId!, loginData.token!);
      await fetch(`${API_URL}/api/v1/guest-orders/${orderId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${guestToken}` },
      }).catch(() => {
        /* best-effort cleanup */
      });
    }
  });

  test("kitchen display shows a confirmed order from the real API", async ({
    page,
  }) => {
    test.skip(
      !KITCHEN_URL,
      "WORKFLOW_KITCHEN_URL/SMOKE_KITCHEN_URL is required",
    );

    const ownerLoginData = await getLoginData();
    test.skip(
      !ownerLoginData?.token,
      "WORKFLOW_AUTH_USERNAME/SMOKE_AUTH_USERNAME and password are required",
    );

    const chefLoginData = await loginChef();
    test.skip(
      !chefLoginData?.token || !chefLoginData.user,
      "WORKFLOW_CHEF_USERNAME and WORKFLOW_CHEF_PASSWORD are required",
    );

    const fixtureIds = await resolveFixtureIds();
    test.skip(
      !fixtureIds.restaurantId || fixtureIds.menuItemId === undefined,
      "WORKFLOW_RESTAURANT_ID and WORKFLOW_MENU_ITEM_ID are required for kitchen workflow",
    );

    const createResponse = await fetch(`${API_URL}/api/v1/guest-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId: fixtureIds.restaurantId,
        orderType: "table",
        tableId: 1,
        items: [{ menuItemId: fixtureIds.menuItemId, quantity: 1 }],
        guestName: "workflow-kitchen",
        phoneLastDigits: String(100 + Math.floor(Math.random() * 900)),
      }),
    });
    expect(
      createResponse.ok,
      `guest order create status ${createResponse.status}`,
    ).toBe(true);

    const createBody = (await createResponse.json()) as GuestOrderResponse;
    const orderId = createBody.data?.order?.id;
    const guestToken = createBody.data?.guestToken;

    expect(typeof orderId, "created order id").toBe("number");
    expect(typeof guestToken, "created guest token").toBe("string");

    await confirmOrder(orderId!, ownerLoginData!.token!);
    await installKitchenSession(page, chefLoginData);

    try {
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response
              .url()
              .includes(`/api/v1/kitchen/${fixtureIds.restaurantId}/orders`) &&
            response.ok(),
        ),
        page.goto(`${KITCHEN_URL}/kitchen/${fixtureIds.restaurantId}`, {
          waitUntil: "domcontentloaded",
        }),
      ]);

      await expect(page.getByTestId("kitchen-dashboard")).toBeVisible();
      await expect(
        page.getByTestId(`kitchen-order-card-${orderId}`),
      ).toBeVisible();

      const updateResponsePromise = page.waitForResponse(
        (response) =>
          response
            .url()
            .includes(`/api/v1/kitchen/${fixtureIds.restaurantId}/orders/`) &&
          response.request().method() === "PUT",
      );
      await page.getByTestId(`kitchen-order-start-${orderId}`).click();
      const updateResponse = await updateResponsePromise;
      expect(
        updateResponse.ok(),
        `kitchen item status update ${updateResponse.status()}`,
      ).toBe(true);

      await expect
        .poll(async () => {
          const body = await fetchKitchenOrders(
            fixtureIds.restaurantId!,
            chefLoginData.token!,
          );
          const order = findKitchenOrder(body, orderId!);
          return order?.items?.some((item) => item.status === "preparing");
        })
        .toBe(true);
      await expect(page.locator("vite-error-overlay")).toHaveCount(0);
    } finally {
      await cancelOrderAsOwner(orderId!, ownerLoginData!.token!);
      await fetch(`${API_URL}/api/v1/guest-orders/${orderId}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${guestToken}` },
      }).catch(() => {
        /* best-effort cleanup */
      });
    }
  });

  test("management portal health page loads data from the management API", async ({
    page,
  }) => {
    test.skip(
      !MANAGEMENT_PORTAL_URL || !MANAGEMENT_TOKEN,
      "WORKFLOW_MANAGEMENT_PORTAL_URL and WORKFLOW_MANAGEMENT_TOKEN are required",
    );

    await page.addInitScript((token) => {
      window.localStorage.setItem("management_token", token);
    }, MANAGEMENT_TOKEN);

    const healthResponse = page.waitForResponse(
      (response) => response.url().includes("/api/v1/health") && response.ok(),
    );

    await page.goto(`${MANAGEMENT_PORTAL_URL}/health`, {
      waitUntil: "domcontentloaded",
    });

    await healthResponse;
    await expect(page.getByTestId("management-health-page")).toBeVisible();
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  });

  test("management portal tenants page loads tenant data from the management API", async ({
    page,
  }) => {
    test.skip(
      !MANAGEMENT_PORTAL_URL || !MANAGEMENT_TOKEN,
      "WORKFLOW_MANAGEMENT_PORTAL_URL and WORKFLOW_MANAGEMENT_TOKEN are required",
    );

    await page.addInitScript((token) => {
      window.localStorage.setItem("management_token", token);
    }, MANAGEMENT_TOKEN);

    const tenantsResponse = page.waitForResponse(
      (response) => response.url().includes("/api/v1/tenants") && response.ok(),
    );

    await page.goto(`${MANAGEMENT_PORTAL_URL}/tenants`, {
      waitUntil: "domcontentloaded",
    });

    await tenantsResponse;
    await expect(page.getByTestId("management-tenants-page")).toBeVisible();
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  });

  test("onboarding app submits the application form to the management API", async ({
    page,
  }) => {
    test.skip(
      !ONBOARDING_URL || !MANAGEMENT_API_URL,
      "WORKFLOW_ONBOARDING_URL and WORKFLOW_MANAGEMENT_API_URL are required",
    );

    const suffix = Math.random().toString(36).slice(2, 8);
    const subdomain = `workflow-${suffix}`;

    await page.goto(`${ONBOARDING_URL}/apply`, {
      waitUntil: "domcontentloaded",
    });

    await page.getByTestId("onboarding-business-name").fill("Workflow Laksa");
    await page.getByTestId("onboarding-contact-name").fill("Tan Mei");
    await page
      .getByTestId("onboarding-contact-email")
      .fill(`workflow-${suffix}@example.com`);
    await page.getByTestId("onboarding-contact-phone").fill("0912345678");
    await page.getByTestId("onboarding-latitude").fill("24.147736");
    await page.getByTestId("onboarding-longitude").fill("120.673648");
    await page.getByTestId("onboarding-subdomain").fill(subdomain);

    await expect
      .poll(async () => {
        const response = await fetch(
          `${MANAGEMENT_API_URL}/api/v1/onboarding/subdomain/check?subdomain=${subdomain}`,
        );
        if (!response.ok) return false;
        const body = (await response.json()) as {
          success: boolean;
          data?: { available?: boolean };
        };
        return body.success && body.data?.available === true;
      })
      .toBe(true);

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/onboarding/applications") &&
        response.request().method() === "POST",
    );

    await page.getByTestId("onboarding-submit").click();

    const createResponse = await createResponsePromise;
    expect(
      createResponse.ok(),
      `onboarding create status ${createResponse.status()}`,
    ).toBe(true);
    const createBody = (await createResponse.json()) as {
      success: boolean;
      data?: { applicationId?: string; assignedSubdomain?: string };
    };
    expect(createBody.success).toBe(true);
    expect(createBody.data?.assignedSubdomain).toBe(subdomain);

    await expect(page).toHaveURL(/\/connect$/);
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  });

  test("onboarding app verifies Cloudflare credentials and completes from the browser", async ({
    page,
  }) => {
    test.skip(
      !ONBOARDING_URL ||
        !MANAGEMENT_API_URL ||
        !CLOUDFLARE_ACCOUNT_ID ||
        !CLOUDFLARE_API_TOKEN,
      "WORKFLOW_ONBOARDING_URL, WORKFLOW_MANAGEMENT_API_URL, WORKFLOW_CLOUDFLARE_ACCOUNT_ID, and WORKFLOW_CLOUDFLARE_API_TOKEN are required",
    );

    const suffix = Math.random().toString(36).slice(2, 8);
    const subdomain = `workflow-cf-${suffix}`;

    await page.goto(`${ONBOARDING_URL}/apply`, {
      waitUntil: "domcontentloaded",
    });

    await page
      .getByTestId("onboarding-business-name")
      .fill("Workflow Cloudflare");
    await page.getByTestId("onboarding-contact-name").fill("Tan Mei");
    await page
      .getByTestId("onboarding-contact-email")
      .fill(`workflow-cf-${suffix}@example.com`);
    await page.getByTestId("onboarding-contact-phone").fill("0912345678");
    await page.getByTestId("onboarding-latitude").fill("24.147736");
    await page.getByTestId("onboarding-longitude").fill("120.673648");
    await page.getByTestId("onboarding-subdomain").fill(subdomain);

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/onboarding/applications") &&
        response.request().method() === "POST",
    );

    await page.getByTestId("onboarding-submit").click();

    const createResponse = await createResponsePromise;
    expect(
      createResponse.ok(),
      `onboarding create status ${createResponse.status()}`,
    ).toBe(true);
    const createBody = (await createResponse.json()) as {
      success: boolean;
      data?: { applicationId?: string; assignedSubdomain?: string };
    };
    const applicationId = createBody.data?.applicationId;
    expect(typeof applicationId, "created application id").toBe("string");
    expect(createBody.data?.assignedSubdomain).toBe(subdomain);

    await expect(page).toHaveURL(/\/connect$/);
    await page
      .getByTestId("onboarding-cf-account-id")
      .fill(CLOUDFLARE_ACCOUNT_ID!);
    await page
      .getByTestId("onboarding-cf-api-token")
      .fill(CLOUDFLARE_API_TOKEN!);

    const verifyResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes(
            `/api/v1/onboarding/applications/${applicationId}/verify-cloudflare`,
          ) && response.request().method() === "POST",
    );

    await page.getByTestId("onboarding-cf-verify").click();
    const verifyResponse = await verifyResponsePromise;
    expect(
      verifyResponse.ok(),
      `onboarding verify status ${verifyResponse.status()}`,
    ).toBe(true);
    const verifyBody = (await verifyResponse.json()) as {
      success: boolean;
      data?: { verified?: boolean };
    };
    expect(verifyBody.success).toBe(true);
    expect(verifyBody.data?.verified).toBe(true);
    await expect(page.getByTestId("onboarding-cf-verified")).toBeVisible();

    const completeResponsePromise = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes(
            `/api/v1/onboarding/applications/${applicationId}/complete`,
          ) && response.request().method() === "POST",
    );

    await page.getByTestId("onboarding-complete").click();
    const completeResponse = await completeResponsePromise;
    expect(
      completeResponse.ok(),
      `onboarding complete status ${completeResponse.status()}`,
    ).toBe(true);
    const completeBody = (await completeResponse.json()) as {
      success: boolean;
      data?: { tenantId?: string; subdomain?: string; status?: string };
    };
    expect(completeBody.success).toBe(true);
    expect(typeof completeBody.data?.tenantId).toBe("string");
    expect(completeBody.data?.subdomain).toBe(subdomain);
    expect(completeBody.data?.status).toBe("completed");

    await expect(page).toHaveURL(/\/success$/);
    await expect(page.getByTestId("onboarding-success")).toBeVisible();
    await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  });
});
